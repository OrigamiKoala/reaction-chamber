//! Turns an arbitrary imported compound (formula + physical data, e.g. from PubChem) into an engine reagent plus a
//! `CompoundThermo` record. Every compound is the same kind of thing: phase (solid / liquid / gas / dissolved) is
//! derived from temperature, pressure and contents at run time. Dissociation into ions comes from the formula
//! (general ion tables + charge balance), ionic solids get a solubility limit from the solubility table / rules (or a
//! supplied solubility), and neutral molecules the engine already has equilibria or kinetics for are mapped onto those
//! species. Everything else that parses (organics, oxides, most elements) becomes an *inert* compound: physically
//! present (melting, boiling, dissolving up to its solubility, heat capacity) but with no reaction chemistry. Only
//! unparseable formulas and unknown elements are reported as unmodelable.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::acid_estimate;
use crate::chem_db::{self, GeneralEquilibrium, GeneralMineral, ReagentCatalogEntry};
use crate::compound_thermo::{self, CompoundThermo, ThermoSummary};
use crate::ions::{self, IonCount, IonicSplit};
use crate::solubility;

#[derive(Debug, Clone, Default, Deserialize)]
pub struct CompoundRequest {
    pub id: String,
    pub name: String,
    pub formula: String,
    #[serde(default)]
    pub smiles: Option<String>,
    /// Standard InChIKey (identity). Matching against the engine's built-in molecules and keying of inert compounds use
    /// this; without it a compound is never assumed to be a known molecule.
    #[serde(default)]
    pub inchi_key: Option<String>,
    /// CAS registry number (secondary identity, informational).
    #[serde(default)]
    pub cas: Option<String>,
    #[serde(default)]
    pub mw: Option<f64>,
    /// g/mL of the room-temperature phase (as reported).
    #[serde(default)]
    pub density: Option<f64>,
    /// "solid" | "liquid" | "gas": only a hint, used when there is no melting reference to derive the state from.
    #[serde(default)]
    pub state: Option<String>,
    /// Default molarity (mol/L) of the solution form.
    #[serde(default)]
    pub molarity: Option<f64>,
    #[serde(default)]
    pub ghs: Vec<String>,
    /// Measured vapour-pressure points `[T_kelvin, P_pascal]`, including the normal boiling point as `[Tb, 101325]`.
    /// The engine fits a curve through them; nothing is stored as "the" boiling point.
    #[serde(default)]
    pub vapor_pressure_points: Vec<[f64; 2]>,
    /// Heat of vaporisation (kJ/mol) quoted at `dh_vap_at_k` (default 298.15 K).
    #[serde(default)]
    pub dh_vap_kj_mol: Option<f64>,
    #[serde(default)]
    pub dh_vap_at_k: Option<f64>,
    /// Melting point *reference at 1 atm* (K): one point on the solid-liquid line (Clapeyron applies the pressure shift).
    #[serde(default)]
    pub t_melt_ref_k: Option<f64>,
    /// Heat of fusion (kJ/mol); estimated (Walden / Richard) when absent.
    #[serde(default)]
    pub dh_fus_kj_mol: Option<f64>,
    /// Standard heat of combustion (kJ/mol, negative = exothermic); gives the enthalpy of formation by Hess's law.
    #[serde(default)]
    pub dh_comb_kj_mol: Option<f64>,
    /// Water solubility at ~25 C, g/L.
    #[serde(default)]
    pub solubility_g_per_l: Option<f64>,
    /// Enthalpy of solution (kJ/mol): optional temperature dependence of the solubility (van't Hoff).
    #[serde(default)]
    pub dh_sol_kj_mol: Option<f64>,
    /// Standard entropy S° (J/(mol K)); optional, kept for future free-energy / phase-equilibrium work.
    #[serde(default)]
    pub s_j_mol_k: Option<f64>,
    /// Molar heat capacity at 298 K (J/(mol K)); sets the neat-phase heat capacity when given.
    #[serde(default)]
    pub cp_j_mol_k: Option<f64>,
    /// Shomate / NASA heat-capacity coefficients as supplied; stored, not consumed yet.
    #[serde(default)]
    pub cp_coefficients: Vec<f64>,
    /// Linear (not sRGB) colour.
    #[serde(default)]
    pub color_linear_rgb: Option<[f64; 3]>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompoundModel {
    pub modelable: bool,
    /// Human-readable explanation (why it is / is not modelled).
    pub reason: String,
    /// "salt" | "acid" | "base" | "molecule" | "inert" | "none"
    pub kind: String,
    pub entry: Option<ReagentCatalogEntry>,
    pub mineral: Option<GeneralMineral>,
    /// Estimated acid-dissociation equilibria generated for this compound (registered with the engine, not serialised).
    #[serde(skip)]
    pub equilibria: Vec<GeneralEquilibrium>,
    /// Species released per formula unit.
    pub species: Vec<(String, f64)>,
    pub mw: f64,
    /// Dosed by mass (true: solid at room temperature) or by volume (liquid, or a gas as a solution).
    pub by_mass: bool,
    /// "solid" | "liquid" | "gas", derived from the melting reference and the vapour-pressure curve at 298.15 K, 1 atm.
    pub state_at_room: String,
    /// "ionic" (splits into ions) | "neutral" (known equilibria / kinetics) | "inert" | "none" (unmodelable)
    pub phase_model: String,
    /// Derived summary for the UI (normal bp from the fitted curve, latent heats, which values were estimated).
    pub thermo: ThermoSummary,
    /// The physical-data record to register with the engine (not part of the JSON response).
    #[serde(skip)]
    pub compound: Option<CompoundThermo>,
}

fn none(req: &CompoundRequest, reason: &str) -> CompoundModel {
    // The state is still derived (the UI may show it for visual-only compounds), from the data alone.
    let fit = compound_thermo::fit_vapor_curve(&req.vapor_pressure_points, req.dh_vap_kj_mol.map(|d| d * 1000.0));
    let bp = fit.and_then(|f| f.curve.t_at(compound_thermo::P_ATM_PA));
    let state = compound_thermo::derive_state_at_room(req.t_melt_ref_k, bp, req.state.as_deref(), "solid");
    CompoundModel {
        modelable: false,
        reason: reason.to_string(),
        kind: "none".into(),
        entry: None,
        mineral: None,
        equilibria: vec![],
        species: vec![],
        mw: 0.0,
        by_mass: state == "solid",
        state_at_room: state,
        phase_model: "none".into(),
        thermo: ThermoSummary::default(),
        compound: None,
    }
}

/// First (connectivity) block of the InChIKey of every neutral molecule the engine has built-in chemistry for.
/// Imports are matched on this identity, never on the formula alone (isomers share a formula: dimethyl ether is not
/// ethanol, methyl formate is not acetic acid). The formula only *proposes* the candidate.
pub const KNOWN_NEUTRAL_INCHIKEYS: &[(&str, &str)] = &[
    ("C2H5OH", "LFQSCWFLJHTTHZ-UHFFFAOYSA-N"),
    ("CH3COOH", "QTBSBXVTEAMEQO-UHFFFAOYSA-N"),
    ("HCOOH", "BDAGIHXWWSANSR-UHFFFAOYSA-N"),
    ("NH3", "QGZKDVFQNNGYKY-UHFFFAOYSA-N"),
    ("CO2(aq)", "CURLTUGMZLYLDI-UHFFFAOYSA-N"),
    ("H2O2", "MHAJPDPJQMAIIY-UHFFFAOYSA-N"),
    ("I2(aq)", "PNDPGZBMCMUPRI-UHFFFAOYSA-N"),
    ("O2(aq)", "MYMOFIZGZYHOMD-UHFFFAOYSA-N"),
    ("O2", "MYMOFIZGZYHOMD-UHFFFAOYSA-N"),
    ("HF", "KRHYYFGTRYWZRS-UHFFFAOYSA-N"),
    ("HCN", "LELOWRISYMNNSU-UHFFFAOYSA-N"),
    ("H2S", "RWSOTUBLDIXVET-UHFFFAOYSA-N"),
    ("H2S(aq)", "RWSOTUBLDIXVET-UHFFFAOYSA-N"),
    ("HNO2", "IOVCWXUNBOPUCH-UHFFFAOYSA-N"),
    ("HClO", "QWPPOHNGKGFGJK-UHFFFAOYSA-N"),
    ("H2SO3", "LSNNMFCWUKXFEE-UHFFFAOYSA-N"),
    ("H3PO4", "NBIIXXVUZAFLBC-UHFFFAOYSA-N"),
    ("H2C2O4", "MUBZPKHOEPUJKR-UHFFFAOYSA-N"),
    ("H2SO4", "QAOWNCQODCNURD-UHFFFAOYSA-N"),
    ("Mg(s)", "FYYHWMGAXLPEAU-UHFFFAOYSA-N"),
];

/// Connectivity block (first 14 characters) of an InChIKey, upper-cased; None when it is not a plausible key.
pub fn inchikey_block(key: &str) -> Option<String> {
    let k = key.trim().to_uppercase();
    let first = k.split('-').next()?;
    if first.len() == 14 && first.chars().all(|c| c.is_ascii_uppercase()) {
        Some(first.to_string())
    } else {
        None
    }
}

/// Neutral species the engine has chemistry for, keyed by element multiset. This only *proposes* candidates; the
/// InChIKey decides (`known_neutral_confirmed`).
fn known_neutral_species() -> HashMap<String, Vec<String>> {
    let mut out: HashMap<String, Vec<String>> = HashMap::new();
    let mut add = |sp: &str| {
        if sp == "H2O" || sp.ends_with("(g)") {
            return;
        }
        if let Some(e) = ions::species_elements(sp) {
            if ions::species_charge(sp) == 0 {
                let list = out.entry(ions::element_key(&e)).or_default();
                if !list.iter().any(|x| x == sp) {
                    list.push(sp.to_string());
                }
            }
        }
    };
    for eq in chem_db::get_default_equilibria() {
        for k in eq.reactants.keys().chain(eq.products.keys()) {
            add(k);
        }
    }
    for r in chem_db::get_default_kinetic_reactions() {
        for k in r.reactants.keys().chain(r.products.keys()) {
            add(k);
        }
    }
    out
}

/// The built-in species a request is, confirmed by InChIKey among the formula-proposed candidates.
fn known_neutral_confirmed(candidates: &[String], inchi_key: Option<&str>) -> Option<String> {
    let block = inchikey_block(inchi_key?)?;
    candidates
        .iter()
        .find(|sp| {
            KNOWN_NEUTRAL_INCHIKEYS
                .iter()
                .any(|(id, ik)| *id == sp.as_str() && inchikey_block(ik).as_deref() == Some(block.as_str()))
        })
        .cloned()
}

fn species_is_reactant_in_equilibria(sp: &str) -> bool {
    chem_db::get_default_equilibria().iter().any(|e| e.reactants.contains_key(sp))
}

/// Species an acid H_k A dissociates into, plus the estimated equilibria needed to continue the dissociation.
/// Strong only with tabulated data (`acid_estimate::STRONG_ACIDS`, pKa < 0); an acid with hand-listed equilibria uses
/// them; every other acid becomes a weak-acid ladder with *Estimated* pKa values by functional class.
struct AcidModel {
    species: Vec<(String, f64)>,
    equilibria: Vec<GeneralEquilibrium>,
    note: Option<String>,
}

fn acid_species(split: &IonicSplit, elems: &HashMap<String, f64>) -> AcidModel {
    let plain = |species: Vec<(String, f64)>| AcidModel { species, equilibria: vec![], note: None };
    // Fully deprotonated base: find an anion definition whose formula equals elems minus (H count equal to -charge_of_base)
    let mut best: Option<(&ions::IonDef, f64)> = None;
    for def in ions::ANIONS {
        if let Some(u) = ions::parse_formula_strict(def.formula) {
            // elements of acid = u + k H  with k = -def.charge  (k>=1)
            let k = (-def.charge) as f64;
            let mut cand = u.clone();
            *cand.entry("H".to_string()).or_insert(0.0) += k;
            if cand == *elems {
                best = Some((def, k));
                break;
            }
        }
    }
    if let Some((def, k)) = best {
        if let Some(parent) = def.acid {
            if species_is_reactant_in_equilibria(parent) {
                return plain(vec![(parent.to_string(), 1.0)]);
            }
        }
        // Dissociation continues from the singly-deprotonated anion when an equilibrium exists for it
        if k >= 2.0 {
            let proto = format!("H{}", def.formula);
            let inter = ions::ANIONS.iter().find(|x| x.formula == proto && x.charge == def.charge + 1);
            if let Some(i) = inter {
                if species_is_reactant_in_equilibria(i.id) {
                    return plain(vec![("H+".to_string(), 1.0), (i.id.to_string(), 1.0)]);
                }
            }
        }
        // Tabulated strong acid (pKa < 0): fully dissociated
        if let Some((pka, src)) = acid_estimate::strong_acid(elems) {
            return AcidModel {
                species: vec![("H+".to_string(), k), (def.id.to_string(), 1.0)],
                equilibria: vec![],
                note: Some(format!("strong acid, tabulated pKa {:.1} ({})", pka, src)),
            };
        }
        // Everything else: weak, with an Estimated pKa ladder
        let ki = k as usize;
        let ladder = acid_estimate::estimate_ladder(elems, ki);
        let has_c = elems.contains_key("C");
        let parent = if has_c {
            solubility::hill_from_elems(elems)
        } else {
            format!("H{}{}", if ki == 1 { String::new() } else { ki.to_string() }, def.formula)
        };
        // species ladder: parent, then each deprotonated form, ending in the table anion
        let mut chain: Vec<String> = vec![parent.clone()];
        for j in 1..ki {
            let mut e = elems.clone();
            *e.get_mut("H").unwrap() -= j as f64;
            let existing = ions::ANIONS.iter().find(|x| x.charge == -(j as i32) && ions::parse_formula_strict(x.formula).as_ref() == Some(&e));
            let id = match existing {
                Some(x) => x.id.to_string(),
                None => format!("{}{}", solubility::hill_from_elems(&e), if j == 1 { "-".to_string() } else { format!("-{}", j) }),
            };
            chain.push(id);
        }
        chain.push(def.id.to_string());
        let mut eqs = Vec::new();
        for j in 0..ki {
            eqs.push(acid_estimate::step_equilibrium(&chain[j], &chain[j + 1], j + 1, ladder.pka[j], ladder.class));
        }
        let pk: Vec<String> = ladder.pka.iter().map(|p| format!("{:.1}", p)).collect();
        return AcidModel {
            species: vec![(parent, 1.0)],
            equilibria: eqs,
            note: Some(format!("weak acid, Estimated pKa {} ({})", pk.join(" / "), ladder.class)),
        };
    }
    // fall back to the raw split
    plain(split.all().map(|i| (i.id.clone(), i.n)).collect())
}

fn mol_str(x: f64) -> String {
    if x >= 1.0 {
        format!("{:.1} M", x)
    } else {
        format!("{:.2} M", x)
    }
}

pub fn model_compound(req: &CompoundRequest) -> CompoundModel {
    let (anhydrous_raw, mut n_water) = ions::strip_hydrate(&req.formula);
    let mut elems = match ions::parse_formula_strict(&anhydrous_raw) {
        Some(e) => e,
        None => return none(req, "The molecular formula could not be interpreted."),
    };
    // Water of crystallisation shown as separate ".O" fragments in SMILES (PubChem hydrates have a combined Hill formula)
    if n_water == 0.0 {
        if let Some(sm) = &req.smiles {
            let w = sm.split('.').filter(|f| *f == "O" || *f == "[OH2]").count() as f64;
            let nfrag = sm.split('.').count() as f64;
            if w > 0.0 && nfrag > w {
                let (h, o) = (elems.get("H").copied().unwrap_or(0.0), elems.get("O").copied().unwrap_or(0.0));
                if h >= 2.0 * w && o >= w {
                    *elems.get_mut("H").unwrap() -= 2.0 * w;
                    *elems.get_mut("O").unwrap() -= w;
                    elems.retain(|_, v| *v > 1e-9);
                    n_water = w;
                }
            }
        }
    }
    let mw_anh = match ions::mass_of_elements(&elems) {
        Some(m) => m,
        None => return none(req, "Unknown element in formula."),
    };
    let mw_total = mw_anh + n_water * 18.015;
    let molarity = req.molarity.filter(|m| *m > 0.0).unwrap_or(0.1);
    let rho_s = req.density.filter(|d| *d > 0.3 && *d < 25.0);

    // PubChem writes many salts without charges ("Cl[Ag]", "I[Pb]I"), so a charge-free SMILES only rules out ionic
    // character for carbon compounds (organometallics, covalent organics); inorganic metal salts split by formula.
    // A carbon compound without charges in its SMILES is a molecule: it is never decomposed into cations + anions.
    // (A carbon *acid* still goes through `acid_species`, which keeps the neutral parent and estimates its pKa.)
    let has_c = elems.contains_key("C");
    let ionic_smiles = req.smiles.as_ref().map_or(true, |s| s.contains('.') || s.contains('+') || s.contains('-') || !has_c);
    let known_candidates = known_neutral_species().remove(&ions::element_key(&elems)).unwrap_or_default();
    let known_confirmed = known_neutral_confirmed(&known_candidates, req.inchi_key.as_deref());
    let split = ions::decompose_elems(&elems)
        .filter(|sp| ionic_smiles || sp.cations.iter().all(|c| c.id == "H+"))
        .filter(|sp| {
            // A carbon "acid" must be one: its structure has as many carboxylic-acid OH groups as acidic hydrogens
            // (citric acid yes, methyl formate no), or its InChIKey is a molecule the engine already knows (HCN).
            // The formula alone (C2H4O2 = acetic acid = methyl formate) proves nothing.
            let carbon_acid = has_c && sp.cations.iter().all(|c| c.id == "H+");
            if !carbon_acid {
                return true;
            }
            let k = ions::proton_count(sp).round() as usize;
            let by_structure = req.smiles.as_deref().and_then(crate::smiles::parse).map_or(false, |m| m.carboxylic_acid_oh_count() == k);
            by_structure || known_confirmed.is_some()
        });

    // Base species id of an inert compound: its Hill formula, tagged with the first InChIKey characters when the
    // identity is known, so isomers (dimethyl ether / ethanol) never share one engine species.
    let inert_hill = solubility::hill_formula(&anhydrous_raw).unwrap_or_else(|| anhydrous_raw.clone());
    let inert_id = match req.inchi_key.as_deref().and_then(inchikey_block) {
        Some(block) => format!("{}#{}", inert_hill, &block[..8]),
        None => inert_hill,
    };
    let mut equilibria: Vec<GeneralEquilibrium> = Vec::new();
    let mut acid_note: Option<String> = None;

    // ---- species released per formula unit
    let (kind, species): (&str, Vec<(String, f64)>) = if let Some(sp) = &split {
        if sp.cations.iter().all(|c| c.id == "H+") {
            let am = acid_species(sp, &elems);
            equilibria = am.equilibria;
            acid_note = am.note;
            ("acid", am.species)
        } else if sp.anions.iter().any(|a| a.id == "OH-") && sp.cations.iter().all(|c: &IonCount| c.id != "H+") {
            ("base", sp.all().map(|i| (i.id.clone(), i.n)).collect())
        } else {
            ("salt", sp.all().map(|i| (i.id.clone(), i.n)).collect())
        }
    } else {
        // The formula only proposes candidates; the InChIKey confirms (no name / SMILES-substring guessing).
        match known_confirmed.clone() {
            Some(sp) => ("molecule", vec![(sp, 1.0)]),
            None => ("inert", vec![(inert_id.clone(), 1.0)]),
        }
    };
    let phase_model = match kind {
        "salt" | "acid" | "base" => "ionic",
        "molecule" => "neutral",
        _ => "inert",
    };

    // ---- physical data and the state at room temperature (ionic salts and inert compounds default to solid,
    // acids and known molecules to a solution)
    let fallback_state = if matches!(kind, "acid" | "molecule") { "liquid" } else { "solid" };
    let mut thermo = CompoundThermo::build(req, &inert_id, mw_total, phase_model, &elems, fallback_state);
    let state = thermo.state_at_room();
    let by_mass = state == "solid";
    // A liquid whose dissolved form is one neutral molecule is dosed neat (its own phase, amount from its density);
    // a fully dissociating acid (HCl) or a salt has no neat form and stays a solution.
    let neat_species: Option<String> = match kind {
        "inert" => Some(inert_id.clone()),
        "molecule" => Some(species[0].0.clone()),
        "acid" if species.len() == 1 && (species[0].1 - 1.0).abs() < 1e-9 && ions::species_charge(&species[0].0) == 0 => Some(species[0].0.clone()),
        _ => None,
    };
    let neat_liquid = neat_species.is_some() && state == "liquid";
    // A compound that is a gas at room conditions is a gas reagent: dosed by volume of gas into the headspace (sealed) or
    // sparged through the liquid, never a 0.1 M solution made up of water. A known dissolved molecule uses the gas twin of
    // its species record (found by InChIKey); one without a gas twin keeps the solution form.
    let gas_species: Option<String> = if state == "gas" && !by_mass {
        match kind {
            "inert" => Some(format!("{}(g)", inert_id)),
            "molecule" => {
                let aq = &species[0].0;
                crate::vle::henry_species(aq).map(|h| h.gas_id)
            }
            _ => None,
        }
    } else {
        None
    };

    let mut composition: HashMap<String, f64> = HashMap::new();
    let mut mineral: Option<GeneralMineral> = None;

    if let Some(g) = &gas_species {
        // mole fractions of the gas species of one dose of the reagent
        composition.insert(g.clone(), 1.0);
    } else if by_mass {
        let per_g = 1.0 / mw_total;
        // Solid with a single cation and anion kind and no acid: a solubility-limited solid that dissolves into water
        let single_pair = kind != "molecule" && kind != "inert" && split.as_ref().map_or(false, |s| s.cations.len() == 1 && s.anions.len() == 1) && kind != "acid";
        if kind == "inert" {
            // undissolved solid; `Vessel` dissolves it up to the compound's solubility
            composition.insert(format!("{}(s)", inert_id), per_g);
        } else if kind == "molecule" {
            let sp = &species[0].0;
            let key = if sp.ends_with("(s)") { sp.clone() } else { format!("{}(s)", sp.trim_end_matches("(aq)")) };
            let store_has_solid = crate::db::SpeciesStore::global().read().map_or(false, |st| st.get(&key).map_or(false, |r| r.has_phase("s")));
            if store_has_solid || (ions::species_elements(&key).map(|e| ions::element_key(&e)) == Some(ions::element_key(&elems)) && sp.ends_with("(s)")) {
                // the solid phase: it dissolves up to its saturation (solid-liquid equilibrium), a dry vessel keeps it
                composition.insert(key, per_g);
            } else {
                // no solid record: dissolves as the neutral species
                composition.insert(sp.clone(), per_g);
            }
        } else if single_pair {
            let s = split.as_ref().unwrap();
            let (c, a) = (&s.cations[0], &s.anions[0]);
            if let Some(mut m) = solubility::mineral_for_import(&c.id, c.n, &a.id, a.n) {
                // The import's own density and colour (PubChem) describe this solid: they are not replaced by the
                // generic cation-hue / default-density guesses of the mineral record.
                if let Some(d) = rho_s {
                    m.density_g_ml = d;
                }
                if let Some(col) = req.color_linear_rgb {
                    m.solid_color = col;
                }
                // A supplied solubility replaces a *guessed* Ksp with the same derivation PubChem mineral lookups use;
                // tabulated / already-imported values win over it. Guesses that remain are queued for a lookup.
                if let Some(g) = req.solubility_g_per_l.filter(|g| *g > 0.0) {
                    if matches!(m.tier, crate::types::ProvenanceTier::Speculative | crate::types::ProvenanceTier::Estimated)
                        && solubility::apply_solubility(&mut m, g).is_some()
                    {
                        m.source = format!("imported solubility {:.3e} g/L", g);
                    }
                }
                solubility::request_lookup(&m);
                composition.insert(m.solid_species.clone(), per_g);
                mineral = Some(m);
            }
        }
        if composition.is_empty() {
            // acids and multi-ion salts: released straight into solution
            for (sp, n) in &species {
                *composition.entry(sp.clone()).or_default() += n * per_g;
            }
        }
        if n_water > 0.0 {
            *composition.entry("H2O".to_string()).or_default() += n_water * per_g;
        }
    } else if neat_liquid {
        // neat liquid: per mL amounts = density / molar mass; it forms its own phase unless it mixes with what is there
        let per_ml = thermo.rho_liquid / mw_total;
        composition.insert(neat_species.clone().unwrap_or_else(|| inert_id.clone()), per_ml);
        if n_water > 0.0 {
            *composition.entry("H2O".to_string()).or_default() += n_water * per_ml;
        }
    } else {
        // aqueous solution of `molarity` mol/L; per mL amounts = mol/L / 1000
        let c = molarity;
        let rho_solid = rho_s.unwrap_or(2.0);
        let rho = 0.997 + c * mw_total / 1000.0 * (1.0 - 0.997 / rho_solid.max(1.1));
        for (sp, n) in &species {
            *composition.entry(sp.clone()).or_default() += n * c / 1000.0;
        }
        let water_g = (rho - c * mw_total / 1000.0).max(0.5);
        *composition.entry("H2O".to_string()).or_default() += water_g / 18.015 + n_water * c / 1000.0;
    }

    // Solid ions are only meaningful if every species has a known mass
    for sp in composition.keys() {
        if sp != "H2O" && ions::species_mass(sp).is_none() {
            return none(req, "Contains a species the engine cannot represent.");
        }
    }

    // The record is keyed by the solid / molecule it describes
    if let Some(m) = &mineral {
        thermo.species = m.solid_species.trim_end_matches("(s)").to_string();
    } else if kind == "molecule" {
        thermo.species = species[0].0.trim_end_matches("(s)").to_string();
    }

    let density_g_ml = if gas_species.is_some() {
        // gas density at 298.15 K, 1 atm
        mw_total * 101_325.0 / (crate::physics::R_GAS * 298.15) * 1e-6
    } else if neat_liquid {
        thermo.rho_liquid
    } else if by_mass {
        if kind == "inert" { thermo.rho_solid } else { mineral.as_ref().map(|m| m.density_g_ml).or(rho_s).unwrap_or(2.0) }
    } else {
        0.997 + molarity * mw_total / 1000.0 * (1.0 - 0.997 / rho_s.unwrap_or(2.0).max(1.1))
    };
    let label = if by_mass || neat_liquid || gas_species.is_some() { req.formula.clone() } else { format!("{} ({})", req.formula, mol_str(molarity)) };
    let entry = ReagentCatalogEntry {
        id: req.id.clone(),
        name: req.name.clone(),
        formula: req.formula.clone(),
        form: if gas_species.is_some() { "gas".into() } else if by_mass { "solid".into() } else if neat_liquid { "liquid".into() } else { "solution".into() },
        concentration_m: if gas_species.is_some() || by_mass { None } else if neat_liquid { Some(thermo.rho_liquid / mw_total * 1000.0) } else { Some(molarity) },
        density_g_ml,
        ghs: req.ghs.clone(),
        signal_word: if req.ghs.is_empty() { String::new() } else { "Warning".into() },
        bottle_colour: if by_mass { "white".into() } else { "clear".into() },
        composition,
        label,
        by_mass,
        dropper: None,
        inchi_key: req.inchi_key.clone(),
    };
    let desc = species.iter().map(|(s, n)| if (*n - 1.0).abs() < 1e-9 { s.clone() } else { format!("{}{}", n, s) }).collect::<Vec<_>>().join(" + ");
    let reason = if kind == "inert" {
        format!("Modelled as a molecular compound ({}): solid, liquid and gas phases, its solubility and its liquid-liquid partitioning follow from its melting data and the activity model; no reaction chemistry is known for it", desc)
    } else if let Some(note) = &acid_note {
        format!("Modelled as acid: {} ({})", desc, note)
    } else {
        format!("Modelled as {}: {}", kind, desc)
    };
    CompoundModel {
        modelable: true,
        reason,
        kind: kind.to_string(),
        entry: Some(entry),
        mineral,
        equilibria,
        species,
        mw: mw_total,
        by_mass,
        state_at_room: state,
        phase_model: phase_model.to_string(),
        thermo: thermo.summary(),
        compound: Some(thermo),
    }
}
