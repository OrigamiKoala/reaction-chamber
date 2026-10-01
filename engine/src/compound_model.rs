//! Turns an arbitrary imported compound (formula + a few physical properties, e.g. from PubChem) into a reacting
//! engine reagent: dissociation into ions comes from the formula (general ion tables + charge balance), solids get a
//! solubility limit from the solubility table / rules, and neutral molecules the engine already has equilibria or
//! kinetics for are mapped onto those species. Compounds the engine cannot model are reported as such (so the UI can
//! say so) instead of silently doing nothing.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::chem_db::{self, GeneralMineral, ReagentCatalogEntry};
use crate::ions::{self, IonCount, IonicSplit};
use crate::solubility;

#[derive(Debug, Clone, Deserialize)]
pub struct CompoundRequest {
    pub id: String,
    pub name: String,
    pub formula: String,
    #[serde(default)]
    pub smiles: Option<String>,
    #[serde(default)]
    pub mw: Option<f64>,
    #[serde(default)]
    pub density: Option<f64>,
    /// "solid" | "liquid" | "gas"; solids are dosed by mass, everything else as an aqueous solution by volume.
    #[serde(default)]
    pub state: Option<String>,
    /// Default molarity (mol/L) of the solution form.
    #[serde(default)]
    pub molarity: Option<f64>,
    #[serde(default)]
    pub ghs: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompoundModel {
    pub modelable: bool,
    /// Human-readable explanation (why it is / is not modelled).
    pub reason: String,
    /// "salt" | "acid" | "base" | "molecule" | "none"
    pub kind: String,
    pub entry: Option<ReagentCatalogEntry>,
    pub mineral: Option<GeneralMineral>,
    /// Species released per formula unit.
    pub species: Vec<(String, f64)>,
    pub mw: f64,
    pub by_mass: bool,
}

fn none(reason: &str) -> CompoundModel {
    CompoundModel { modelable: false, reason: reason.to_string(), kind: "none".into(), entry: None, mineral: None, species: vec![], mw: 0.0, by_mass: false }
}

/// Neutral species the engine has chemistry for, keyed by element multiset.
fn known_neutral_species() -> HashMap<String, String> {
    let mut out: HashMap<String, String> = HashMap::new();
    let mut add = |sp: &str| {
        if sp == "H2O" || sp.ends_with("(g)") {
            return;
        }
        if let Some(e) = ions::species_elements(sp) {
            if ions::species_charge(sp) == 0 {
                out.entry(ions::element_key(&e)).or_insert_with(|| sp.to_string());
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

fn species_is_reactant_in_equilibria(sp: &str) -> bool {
    chem_db::get_default_equilibria().iter().any(|e| e.reactants.contains_key(sp))
}

/// Species a *neutral* acid parent H_k A dissociates into, following the engine's equilibria.
fn acid_species(split: &IonicSplit, elems: &HashMap<String, f64>) -> Vec<(String, f64)> {
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
                return vec![(parent.to_string(), 1.0)];
            }
        }
        // Strong first dissociation: H+ plus the singly-deprotonated anion when an equilibrium continues from it
        if k >= 2.0 {
            let proto = format!("H{}", def.formula);
            let inter = ions::ANIONS.iter().find(|x| x.formula == proto && x.charge == def.charge + 1);
            if let Some(i) = inter {
                if species_is_reactant_in_equilibria(i.id) {
                    return vec![("H+".to_string(), 1.0), (i.id.to_string(), 1.0)];
                }
            }
        }
        return vec![("H+".to_string(), k), (def.id.to_string(), 1.0)];
    }
    // fall back to the raw split
    split.all().map(|i| (i.id.clone(), i.n)).collect()
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
        None => return none("The molecular formula could not be interpreted."),
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
        None => return none("Unknown element in formula."),
    };
    let mw_total = mw_anh + n_water * 18.015;
    let is_solid = req.state.as_deref() == Some("solid");
    let molarity = req.molarity.filter(|m| *m > 0.0).unwrap_or(0.1);
    let rho_s = req.density.filter(|d| *d > 0.3 && *d < 25.0);

    let dotted = req.smiles.as_ref().map_or(true, |s| s.contains('.') || s.contains('+') || s.contains('-'));
    let split = ions::decompose_elems(&elems).filter(|sp| dotted || sp.cations.iter().all(|c| c.id == "H+"));

    // ---- species released per formula unit
    let (kind, species): (&str, Vec<(String, f64)>) = if let Some(sp) = &split {
        if sp.cations.iter().all(|c| c.id == "H+") {
            ("acid", acid_species(sp, &elems))
        } else if sp.anions.iter().any(|a| a.id == "OH-") && sp.cations.iter().all(|c: &IonCount| c.id != "H+") {
            ("base", sp.all().map(|i| (i.id.clone(), i.n)).collect())
        } else {
            ("salt", sp.all().map(|i| (i.id.clone(), i.n)).collect())
        }
    } else {
        let key = ions::element_key(&elems);
        match known_neutral_species().get(&key) {
            Some(sp) => ("molecule", vec![(sp.clone(), 1.0)]),
            None if elems.len() == 1 && elems.contains_key("H") => return none("Elemental hydrogen is not modelled."),
            None => {
                let single = elems.len() == 1;
                // pure elements: metals the engine knows as solids (Mg ...) were caught above via kinetics
                return none(if single {
                    "No reaction data for this element."
                } else {
                    "Not an ionic compound and no equilibria/kinetics are known for this molecule."
                });
            }
        }
    };

    let mut composition: HashMap<String, f64> = HashMap::new();
    let mut mineral: Option<GeneralMineral> = None;
    let by_mass = is_solid;

    if by_mass {
        let per_g = 1.0 / mw_total;
        // Solid with a single cation and anion kind and no acid: a solubility-limited solid that dissolves into water
        let single_pair = kind != "molecule" && split.as_ref().map_or(false, |s| s.cations.len() == 1 && s.anions.len() == 1) && kind != "acid";
        if kind == "molecule" {
            let sp = &species[0].0;
            let key = if sp.ends_with("(s)") { sp.clone() } else { format!("{}(s)", sp) };
            if ions::species_elements(&key).map(|e| ions::element_key(&e)) == Some(ions::element_key(&elems)) && sp.ends_with("(s)") {
                composition.insert(key, per_g);
            } else {
                // dissolves as the neutral species
                composition.insert(sp.clone(), per_g);
            }
        } else if single_pair {
            let s = split.as_ref().unwrap();
            let (c, a) = (&s.cations[0], &s.anions[0]);
            if let Some(m) = solubility::saturation_mineral(&c.id, c.n, &a.id, a.n) {
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
            return none("Contains a species the engine cannot represent.");
        }
    }

    let density_g_ml = if by_mass {
        mineral.as_ref().map(|m| m.density_g_ml).or(rho_s).unwrap_or(2.0)
    } else {
        0.997 + molarity * mw_total / 1000.0 * (1.0 - 0.997 / rho_s.unwrap_or(2.0).max(1.1))
    };
    let label = if by_mass { req.formula.clone() } else { format!("{} ({})", req.formula, mol_str(molarity)) };
    let entry = ReagentCatalogEntry {
        id: req.id.clone(),
        name: req.name.clone(),
        formula: req.formula.clone(),
        form: if by_mass { "solid".into() } else { "solution".into() },
        concentration_m: if by_mass { None } else { Some(molarity) },
        density_g_ml,
        ghs: req.ghs.clone(),
        signal_word: if req.ghs.is_empty() { String::new() } else { "Warning".into() },
        bottle_colour: if by_mass { "white".into() } else { "clear".into() },
        composition,
        label,
        by_mass,
        dropper: None,
    };
    let desc = species.iter().map(|(s, n)| if (*n - 1.0).abs() < 1e-9 { s.clone() } else { format!("{}{}", n, s) }).collect::<Vec<_>>().join(" + ");
    CompoundModel {
        modelable: true,
        reason: format!("Modelled as {}: {}", kind, desc),
        kind: kind.to_string(),
        entry: Some(entry),
        mineral,
        species,
        mw: mw_total,
        by_mass,
    }
}
