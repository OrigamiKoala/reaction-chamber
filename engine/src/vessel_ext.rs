//! Vessel extensions: automatic solubility control for ion pairs that meet in the vessel, solid appearance lookup,
//! and the generic reaction log (events derived purely from state differences, with no per-reaction text).

use std::collections::{HashMap, HashSet};

use crate::chem_db;
use crate::compound_thermo::is_metal_element;
use crate::ions;
use crate::optics;
use crate::solubility;
use crate::vessel::*;

/// A new solid is announced above this concentration-equivalent (mol per litre of aqueous solvent: 2.5 umol in 50 mL,
/// 1 nmol in a 22 uL droplet) and counts as gone below `SOLID_GONE_M`; both are also at least a few multiples of the
/// vessel's dust amount (`Vessel::dust_mol`). Scale-relative, so a droplet and a litre behave alike.
const SOLID_ANNOUNCE_M: f64 = 5e-5;
const SOLID_GONE_M: f64 = 6e-6;
const SOLID_ANNOUNCE_DUST: f64 = 20.0;
const SOLID_GONE_DUST: f64 = 3.0;
const MAX_EVENTS: usize = 80;

#[derive(Default, Clone, Debug)]
pub struct EventState {
    pub seq: u64,
    /// Solids already accounted for (user-added or announced).
    pub solids: HashSet<String>,
    /// Gas species currently evolving -> last sim time a flux was seen.
    pub gas_seen: HashMap<String, f64>,
    pub complexes: HashSet<String>,
    /// Display (sRGB) colour of the solution at the last colour report.
    pub colour_ref: Option<[f64; 3]>,
    /// Display colour each liquid layer had at its last colour report (keyed by the layer's lead species, "aqueous" for water).
    pub layer_colour_ref: HashMap<String, [f64; 3]>,
    pub colour_t: f64,
    pub colour_reported: bool,
    pub colour_eval_t: f64,
    pub temp_ref: Option<f64>,
    pub temp_ref_t: f64,
    pub checked_pairs: HashSet<(String, String)>,
    /// Fraction of each solid currently suspended (1 = freshly precipitated cloud, decays as it settles).
    pub susp: HashMap<String, f64>,
    /// Suspended fraction of each equal-mass size class of a solid (`transfer::psd`); `susp` is their mean and stays the
    /// interface the rest of the engine uses: a change to `susp` from outside resets the classes to that value.
    pub susp_cls: HashMap<String, [f64; crate::transfer::N_CLASSES]>,
    /// Dynamic aggregate diameter of each size class of a solid (m), growing into fractal flocs.
    pub floc_d_cls: HashMap<String, [f64; crate::transfer::N_CLASSES]>,
    /// Announced phase changes of inert compounds (bit flags, see `vessel_phase`).
    pub phase: HashMap<String, u8>,
}

/// Particle size of one solid as the snapshot and optics see it (see `Vessel::solid_size_view`).
#[derive(Clone, Debug)]
pub struct SizeView {
    pub class_d_m: [f64; crate::transfer::N_CLASSES],
    pub class_susp: [f64; crate::transfer::N_CLASSES],
    /// Mass-weighted mean diameter of the suspended part (the haze), m.
    pub suspended_d_m: f64,
    pub sigma_g: f64,
}

#[derive(Clone, Debug)]
pub struct SolidProps {
    pub name: String,
    pub formula: String,
    pub rgb: [f64; 3],
    pub kind: SolidKind,
    pub density_g_ml: f64,
    pub particle_um: f64,
    pub refractive_index: f64,
    /// Absorption coefficient of the solid material per bin, cm-1 (imaginary part of its refractive index).
    pub alpha_per_cm: optics::Spectrum,
    /// Tier and source of the colour (see `optics::solid`).
    pub colour_tier: crate::types::ProvenanceTier,
    pub colour_source: String,
}

fn kind_from_str(k: &str) -> SolidKind {
    match k {
        "crystal" => SolidKind::Crystal,
        "metal" => SolidKind::Metal,
        "gel" => SolidKind::Gel,
        "curds" => SolidKind::Curds,
        _ => SolidKind::Powder,
    }
}

/// Linear -> sRGB transfer for one channel.
fn to_srgb(c: f64) -> f64 {
    let c = c.clamp(0.0, 1.0);
    if c <= 0.0031308 {
        12.92 * c
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    }
}

/// Plain-English colour of an sRGB triple (generic hue/lightness naming, not per-compound text).
pub fn colour_name(srgb: [f64; 3]) -> String {
    let [r, g, b] = srgb;
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let chroma = max - min;
    let light = (max + min) * 0.5;
    if chroma < 0.08 {
        return if max < 0.18 {
            "black".to_string()
        } else if max < 0.55 {
            "grey".to_string()
        } else {
            "white".to_string()
        };
    }
    let mut h = if (max - r).abs() < 1e-12 {
        ((g - b) / chroma).rem_euclid(6.0)
    } else if (max - g).abs() < 1e-12 {
        (b - r) / chroma + 2.0
    } else {
        (r - g) / chroma + 4.0
    } * 60.0;
    if h < 0.0 {
        h += 360.0;
    }
    let base = if h < 15.0 || h >= 345.0 {
        "red"
    } else if h < 40.0 {
        if light < 0.45 { "brown" } else { "orange" }
    } else if h < 70.0 {
        if light < 0.4 { "brown" } else { "yellow" }
    } else if h < 160.0 {
        "green"
    } else if h < 200.0 {
        "teal"
    } else if h < 255.0 {
        "blue"
    } else if h < 290.0 {
        "purple"
    } else {
        "pink"
    };
    let sat_light = if light > 0.78 && chroma < 0.35 {
        "pale "
    } else if light < 0.25 {
        "dark "
    } else {
        ""
    };
    format!("{}{}", sat_light, base)
}

fn capitalise(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
        None => String::new(),
    }
}

/// A complex or ion pair that only an association row describes has no species record, so its enthalpy would be missing
/// from the vessel's energy state (`vessel_energy`) and its formation data from the thermodynamic lookups. Gives it one from
/// the row: dfG = sum of the reactants' dfG + the row's reaction Gibbs energy at 298.15 K, dfH = sum of the reactants' dfH +
/// the row's reaction enthalpy (0 for a row that gives none), Cp = sum of the reactants' (dCp = 0): tier Estimated, labelled
/// as derived from the association constant. Does nothing when the species already has data or a reactant lacks it.
fn ensure_complex_record(eq: &crate::chem_db::GeneralEquilibrium) {
    use crate::db::record::{Datum, Identity, PhaseData, PhaseThermo, SpeciesRecord};
    use crate::thermo::functions::{phase_of_id, try_thermo_state};
    use crate::types::ProvenanceTier;
    if eq.products.len() != 1 {
        return;
    }
    let (prod, &nu) = eq.products.iter().next().unwrap();
    if nu != 1.0 || prod.ends_with("(s)") || prod.ends_with("(g)") || try_thermo_state(prod, "aq", 298.15, 1.0e5).is_some() {
        return;
    }
    let (mut dfh, mut dfg, mut cp) = (0.0, 0.0, 0.0);
    for (sp, &c) in &eq.reactants {
        let Some(st) = try_thermo_state(sp, phase_of_id(sp), 298.15, 1.0e5) else { return };
        dfh += c * st.h_j_mol / 1000.0;
        dfg += c * st.mu0_j_mol / 1000.0;
        cp += c * st.cp_j_mol_k;
    }
    dfg += -crate::physics::R_GAS * 298.15 * std::f64::consts::LN_10 * eq.log_k_298 / 1000.0;
    dfh += eq.delta_h_kj;
    let source = format!("derived from the association row {} (log K {:.2}, dCp = 0)", eq.id, eq.log_k_298);
    let datum = |v: f64, unit: &str| Datum::new(v, unit, ProvenanceTier::Estimated, &source);
    let thermo = PhaseThermo {
        model: "point+cp".to_string(),
        tier: ProvenanceTier::Estimated,
        source: source.clone(),
        dfH: Some(datum(dfh, "kJ/mol")),
        dfG: Some(datum(dfg, "kJ/mol")),
        S: Some(datum((dfh - dfg) * 1000.0 / 298.15, "J/(mol K)")),
        cp: Some(datum(cp, "J/(mol K)")),
        ranges: None,
        params: None,
    };
    let mut phases = HashMap::new();
    phases.insert("aq".to_string(), PhaseData { thermo: Some(thermo), volume: None, rho: None, polymorph: None, specific_area: None });
    let global = crate::db::SpeciesStore::global();
    let mut store = match global.write() {
        Ok(s) => s,
        Err(_) => return,
    };
    let mut rec = store.get(prod).cloned().unwrap_or_else(|| SpeciesRecord {
        id: prod.clone(),
        identity: Identity { inchikey: None, smiles: None, formula: prod.clone(), charge: ions::species_charge(prod), cas: None, cid: None, names: vec![prod.clone()], db_names: HashMap::new() },
        phases: HashMap::new(),
        critical: None,
        points: Vec::new(),
        vapor_pressure: None,
        unifac_groups: None,
        acid_base: Vec::new(),
        redox: Vec::new(),
        optics: None,
        transport: None,
        kinetics_refs: Vec::new(),
        rejected: Vec::new(),
    });
    rec.phases.extend(phases);
    store.register(rec);
}

impl Vessel {
    // ------------------------------------------------------------------------------------------ appearance
    /// Appearance of a solid species. Colour comes from `optics::solid` (a measured colour, else Kubelka-Munk reflectance from
    /// the band gap and the inherited ion chromophores), failing that from the hand-picked mineral colour or the cation/anion
    /// hue rules (Speculative). Refractive index is Lorentz-Lorenz from the molar refractions and the density (a measured
    /// n_D wins); density comes from the mineral / import record, never from a formula-mass heuristic.
    pub fn solid_props(&self, sp: &str) -> SolidProps {
        use crate::optics::solid::{self as osolid, SolidSpec};
        let formula = sp.trim_end_matches("(s)").to_string();
        let mineral = self.minerals.iter().find(|m| m.solid_species == sp);
        let default_name = mineral.map(|m| m.mineral.clone()).unwrap_or_else(|| formula.clone());
        let compound = self.compound_for(sp);
        let mw = chem_db::get_species_thermo(sp).mw;

        // ---- the physical solid: density, grain size, morphology
        let (name, density_g_ml, particle_um, kind, hand_rgb, is_metal);
        if let Some(c) = compound.filter(|c| c.phase_model != "ionic") {
            // metals are a bright grey sheet-like solid, other solids a fine pale powder
            let single_metal = ions::parse_formula_strict(&c.formula).map_or(false, |e| e.len() == 1 && e.keys().all(|k| is_metal_element(k)));
            name = if c.name.is_empty() { default_name } else { c.name.clone() };
            density_g_ml = c.rho_solid.max(0.3);
            particle_um = 30.0;
            kind = if single_metal { SolidKind::Metal } else { SolidKind::Powder };
            hand_rgb = if single_metal { [0.55, 0.56, 0.58] } else { [0.85, 0.85, 0.85] };
            is_metal = single_metal;
        } else if let Some((rec_name, d)) = mineral.is_none().then(|| self.molecular_solid_of(sp)).flatten() {
            // a molecular solid the species store describes (ice, iodine): its record's name and density
            name = rec_name;
            density_g_ml = d;
            particle_um = 150.0;
            kind = SolidKind::Crystal;
            hand_rgb = [0.88, 0.9, 0.93];
            is_metal = false;
        } else if let Some(m) = mineral {
            name = default_name;
            density_g_ml = m.density_g_ml.max(0.3);
            particle_um = m.default_particle_um.max(0.5);
            kind = kind_from_str(&m.kind);
            hand_rgb = m.solid_color;
            is_metal = false;
        } else {
            let single_metal = ions::parse_formula_strict(&formula).map_or(false, |e| e.len() == 1 && e.keys().all(|k| is_metal_element(k)));
            name = default_name;
            density_g_ml = 2.5;
            particle_um = if single_metal { 30.0 } else { 20.0 };
            kind = if single_metal { SolidKind::Metal } else { SolidKind::Powder };
            hand_rgb = if single_metal { [0.55, 0.56, 0.58] } else { [0.9, 0.9, 0.9] };
            is_metal = single_metal;
        }

        // ---- appearance
        let ions: Vec<(String, f64)> = {
            let mut v: Vec<(String, f64)> = mineral.map(|m| m.dissolved_products.iter().map(|(k, n)| (k.clone(), *n)).collect()).unwrap_or_default();
            v.sort_by(|a, b| a.0.cmp(&b.0));
            v
        };
        let record = optics::records::lookup(sp);
        let measured = compound.and_then(|c| c.solid_colour.as_ref());
        let spec = SolidSpec { ions: &ions, density_g_ml, mw, particle_um, record: record.as_ref(), measured_colour: measured, is_metal };
        let look = osolid::look(&spec);
        let (rgb, alpha, tier, source) = match look {
            Some(l) => (l.rgb, l.alpha_per_cm, l.tier, l.source),
            None => {
                // Speculative fallbacks: the mineral's hand-picked colour (or the hue rules that produced it), else grey
                let refl = optics::fallback::spectrum_from_rgb(hand_rgb);
                let s_coef = 1.5 / (particle_um.clamp(0.5, 200.0) * 1e-4);
                let mut a = [0.0; optics::N_BINS];
                for (x, r) in a.iter_mut().zip(refl.iter()) {
                    *x = 0.5 * s_coef * (1.0 - r).powi(2) / (2.0 * r.max(1e-4));
                }
                let basis = if mineral.is_some() { "hand-picked mineral colour / cation-anion hue rules" } else { "default colour" };
                (hand_rgb, a, crate::types::ProvenanceTier::Speculative, basis.to_string())
            }
        };

        // ---- refractive index
        let n = record
            .as_ref()
            .and_then(|o| o.refractive_index.as_ref().map(|d| d.value))
            .or_else(|| compound.and_then(|c| c.refractive_index))
            .unwrap_or_else(|| {
                let rm: f64 = if ions.is_empty() {
                    optics::records::molar_refraction(sp).0
                } else {
                    ions.iter().map(|(id, n)| n * optics::records::molar_refraction(id).0).sum()
                };
                osolid::refractive_index(rm, density_g_ml, mw)
            });
        SolidProps { name, formula, rgb, kind, density_g_ml, particle_um, refractive_index: n, alpha_per_cm: alpha, colour_tier: tier, colour_source: source }
    }

    /// Name and density of a molecular solid (ice, iodine) from the species store and the molecule model.
    fn molecular_solid_of(&self, sp: &str) -> Option<(String, f64)> {
        let lk = self.liquid_key_of_solid(sp)?;
        let mol = self.molecule(&lk)?;
        let rec_name = crate::db::SpeciesStore::global().read().ok().and_then(|st| st.get(sp).and_then(|r| r.identity.names.first().cloned()));
        Some((rec_name.unwrap_or_else(|| mol.name.clone()), mol.v_solid_m3_mol.map(|v| mol.mw / (v * 1e6)).unwrap_or(1.5).max(0.3)))
    }

    // ------------------------------------------------------------------------------------------ solubility control
    /// For every simple cation/anion pair dissolved in the vessel, makes sure the solubility table (or, failing
    /// that, the solubility rules) controls it. This is what lets arbitrary salts precipitate each other.
    pub fn auto_minerals(&mut self) {
        let mut cats: Vec<String> = Vec::new();
        let mut ans: Vec<String> = Vec::new();
        for (sp, &mol) in &self.species_mol {
            if mol <= 1e-12 {
                continue;
            }
            if is_simple_cation(sp) {
                cats.push(sp.clone());
            } else if ions::anion_def(sp).is_some() {
                ans.push(sp.clone());
            }
        }
        // (sorted: the order in which minerals are registered fixes the order of the solver's unknowns)
        cats.sort();
        ans.sort();
        for c in &cats {
            for a in &ans {
                let key = (c.clone(), a.clone());
                if self.ev.checked_pairs.contains(&key) {
                    continue;
                }
                self.ev.checked_pairs.insert(key);
                if let Some(m) = solubility::mineral_for_pair(c, a) {
                    // A rule-based guess is queued so the web layer can replace it with PubChem data.
                    solubility::request_lookup(&m);
                    if !self.minerals.iter().any(|x| x.solid_species == m.solid_species) {
                        self.minerals.push(m);
                    }
                }
            }
        }
    }

    /// Registers the association rows (Fuoss ion pairs, complexation data) of the ions that are present in an amount that
    /// matters. Called after a dose has settled (the precipitating ions are gone by then) and before each equilibrium step.
    pub fn auto_associations(&mut self) {
        self.register_associations(true);
    }

    /// `with_pairs` false registers only the complexation data rows (strong, inner-sphere: they must be in place before the
    /// first solve of a dose so that a complex can compete with a precipitate); the weak outer-sphere Fuoss pairs follow
    /// once the dose has settled.
    pub(crate) fn register_associations(&mut self, with_pairs: bool) {
        let mut cats: Vec<String> = Vec::new();
        let mut ans: Vec<String> = Vec::new();
        for (sp, &mol) in &self.species_mol {
            if mol <= 1e-12 {
                continue;
            }
            if is_simple_cation(sp) {
                cats.push(sp.clone());
            } else if ions::anion_def(sp).is_some() {
                ans.push(sp.clone());
            }
        }
        cats.sort();
        ans.sort();
        // outer-sphere ion pairs (Fuoss association) of pairs that are both present in an amount that matters (a pair that
        // is registered adds a species row to the solver, so a trace of either ion does not earn one)
        for c in cats.iter().filter(|_| with_pairs) {
            for a in &ans {
                let key = ("pair".to_string(), format!("{}|{}", c, a));
                if self.ev.checked_pairs.contains(&key) {
                    continue;
                }
                let n_c = self.species_mol.get(c).copied().unwrap_or(0.0);
                let n_a = self.species_mol.get(a).copied().unwrap_or(0.0);
                if n_c.min(n_a) < crate::ion_pairing::MIN_PAIR_AMOUNT_MOL {
                    continue;
                }
                match crate::ion_pairing::fuoss_pair_equilibrium(c, a, self.temperature_k) {
                    None => {
                        self.ev.checked_pairs.insert(key);
                    }
                    Some(eq) => {
                        // worth a species row only when it would hold a noticeable share of the scarcer ion at the
                        // current concentration (activity coefficients ~0.3 for a divalent pair)
                        let vol_l = (self.solvent_volume_ml() / 1000.0).max(1e-6);
                        let c_other = n_c.max(n_a) / vol_l;
                        if 10f64.powf(eq.log_k_298) * 0.3 * c_other < crate::ion_pairing::MIN_PAIRED_FRACTION {
                            continue;
                        }
                        self.ev.checked_pairs.insert(key);
                        if !self.equilibria.iter().any(|e| e.id == eq.id) && !self.species_has_a_row(&eq) {
                            ensure_complex_record(&eq);
                            self.register_equilibrium(eq);
                        }
                    }
                }
            }
        }
        // complexation rows whose metal and ligand are both present
        let present = |sp: &str| self.species_mol.get(sp).map_or(false, |m| *m > crate::ion_pairing::MIN_PAIR_AMOUNT_MOL);
        let new_rows: Vec<_> = crate::ion_pairing::complex_equilibria(&present)
            .into_iter()
            .filter(|eq| !self.ev.checked_pairs.contains(&("cplx".to_string(), eq.id.clone())))
            .collect();
        for eq in new_rows {
            self.ev.checked_pairs.insert(("cplx".to_string(), eq.id.clone()));
            if !self.equilibria.iter().any(|e| e.id == eq.id) && !self.species_has_a_row(&eq) {
                ensure_complex_record(&eq);
                self.register_equilibrium(eq);
            }
        }
    }

    /// True when a registered equilibrium already forms the species this row would create (same elements and charge under
    /// any name): tabulated data wins over a generated association row.
    fn species_has_a_row(&self, eq: &chem_db::GeneralEquilibrium) -> bool {
        let key = |sp: &str| (ions::species_elements(sp).map(|e| ions::element_key(&e)), ions::species_charge(sp));
        let wanted: Vec<_> = eq.products.keys().map(|p| key(p)).collect();
        self.equilibria.iter().any(|e| e.id != eq.id && e.products.keys().chain(e.reactants.keys()).any(|sp| wanted.contains(&key(sp))))
    }

    // ------------------------------------------------------------------------------------------ settling
    /// Stokes-like sedimentation of suspended solids: a fresh precipitate is a cloud that settles over tens of
    /// seconds (faster for large/dense particles, aggregated 10x); stirring keeps solids suspended.
    pub fn update_suspension(&mut self, dt_s: f64) {
        use crate::transfer::{LogNormal, N_CLASSES};
        let dust = self.dust_mol();
        let live: Vec<String> = self.solid_mol.iter().filter(|(_, m)| **m > dust).map(|(k, _)| k.clone()).collect();
        self.ev.susp.retain(|k, _| live.contains(k));
        self.ev.susp_cls.retain(|k, _| live.contains(k));
        self.ev.floc_d_cls.retain(|k, _| live.contains(k));
        if live.is_empty() {
            return;
        }
        let t_k = self.temperature_k;
        let hyd = self.hydro_state();
        let r_cm = self.config.inner_radius_cm.max(0.5);
        let area_cm2 = std::f64::consts::PI * r_cm.powi(2);
        let liq_h_m = ((self.total_liquid_volume_ml() / area_cm2) * 0.01).max(0.01);
        // the electrolyte decides whether a colloid coagulates (Schulze-Hardy, z^6)
        let vol_l = (self.solvent_volume_ml() / 1000.0).max(1e-9);
        let ions: Vec<(f64, f64)> = self
            .species_mol
            .iter()
            .filter(|(sp, m)| **m > 0.0 && ions::species_charge(sp) != 0)
            .map(|(sp, m)| (m / vol_l, ions::species_charge(sp) as f64))
            .collect();
        let gamma_index = crate::transfer::settling::coagulation_index(&ions);
        // with immiscible layers a particle falls through each layer lighter than itself and rests on the first denser one
        let column = if self.extra_liquids.is_empty() { Vec::new() } else { self.settling_column() };

        let vol_m3 = (self.total_liquid_volume_ml() * 1e-6).max(1e-9);
        let eps = crate::transfer::hydro::dissipation_w_kg(&hyd.st, hyd.rho_l, hyd.nu, vol_m3);
        let shear_rate = (eps / hyd.nu.max(1e-9)).sqrt();
        let shear_eff = (shear_rate * shear_rate + 0.04).sqrt();
        let gamma_ref = 50.0;

        for sp in live {
            let props = self.solid_props(&sp);
            let ln = self
                .particle_populations
                .get(&sp)
                .filter(|p| !p.is_empty())
                .map(LogNormal::from_population)
                .unwrap_or(LogNormal { d_g_m: props.particle_um * 1e-6, sigma_g: 1.0 });
            let d_cls = ln.class_diameters_m();
            let rho_p = props.density_g_ml * 1000.0;
            let solid_vol_m3 = self.solid_mol.get(&sp).copied().unwrap_or(0.0) * chem_db::get_species_thermo(&sp).mw * 1e-3 / rho_p.max(100.0);
            let phi_solid = (solid_vol_m3 / (self.total_liquid_volume_ml() * 1e-6).max(1e-9)).clamp(0.0, 0.5);

            let d_pe1 = (6.0 * crate::transport::K_BOLTZMANN * t_k / (std::f64::consts::PI * crate::transfer::hydro::G_ACCEL * (rho_p - hyd.rho_l).abs().max(1.0))).powf(0.25);
            let w = ((gamma_index - 0.3) / 0.7).clamp(0.0, 1.0);
            let d_max_shear = (20.0 * d_pe1) / (1.0 + shear_eff / gamma_ref).sqrt();

            let mean_of = |c: &[f64; N_CLASSES]| c.iter().sum::<f64>() / N_CLASSES as f64;
            let published = self.ev.susp.get(&sp).copied();
            let mut cls = match (self.ev.susp_cls.get(&sp), published) {
                (Some(c), Some(m)) if (mean_of(c) - m).abs() < 1e-9 => *c,
                (Some(c), None) => *c,
                (_, m) => [m.unwrap_or(1.0); N_CLASSES],
            };
            let mut floc_cls = self.ev.floc_d_cls.get(&sp).copied().unwrap_or(d_cls);

            for k in 0..N_CLASSES {
                let d_primary = d_cls[k];
                let d_cur = floc_cls[k].max(d_primary);
                let d_target = d_primary + w * (d_max_shear.max(d_primary) - d_primary);

                // Fractal aggregate (D_f ~ 2.0): R_agg = a0 * sqrt(g), rho_eff = rho_l + (rho_p - rho_l) / sqrt(g)
                let g = (d_cur / d_primary.max(1e-12)).powi(2).max(1.0);
                let rho_eff_cur = hyd.rho_l + (rho_p - hyd.rho_l) / g.sqrt();
                let v_s_agg = crate::transfer::hydro::terminal_velocity(d_cur, rho_eff_cur, hyd.rho_l, hyd.eta).abs();

                // Dynamic aggregation vs shear breakage
                let d_eff = if d_cur < d_target {
                    let alpha_sed = 1.5 * phi_solid * v_s_agg / d_primary.max(1e-9);
                    let alpha_shear = 1.2 * shear_eff * phi_solid * (d_cur / d_primary.max(1e-9));
                    let alpha_br = (8.0 * crate::transport::K_BOLTZMANN * t_k / (3.0 * hyd.eta)) * (phi_solid / (std::f64::consts::PI / 6.0 * d_primary.powi(3) * g)).max(0.0);
                    let k_coll = w * (alpha_sed + alpha_shear + alpha_br);
                    let tau_agg = (1.0 / k_coll.max(0.1)).clamp(0.5, 10.0);
                    d_target + (d_cur - d_target) * (-dt_s / tau_agg).exp()
                } else if d_cur > d_target {
                    let k_break = 0.2 * shear_eff.sqrt().max(0.1);
                    let tau_break = (1.0 / k_break).clamp(0.2, 5.0);
                    d_target + (d_cur - d_target) * (-dt_s / tau_break).exp()
                } else {
                    d_target
                };
                let d_eff = d_eff.clamp(d_primary, 50.0 * d_pe1.max(d_primary));
                floc_cls[k] = d_eff;

                let rho_eff = hyd.rho_l + (rho_p - hyd.rho_l) * (d_primary / d_eff);
                let tau = if column.len() > 1 {
                    self.settling_time_through(&column, d_eff, rho_eff, phi_solid, t_k)
                } else {
                    crate::transfer::settling::settling_time_s(liq_h_m, d_eff, rho_eff, hyd.rho_l, hyd.eta, phi_solid, t_k)
                };
                let n_js = crate::transfer::hydro::just_suspended_rps(
                    &hyd.st,
                    d_eff,
                    rho_eff,
                    hyd.rho_l,
                    hyd.nu,
                    100.0 * solid_vol_m3 * rho_p / (self.total_liquid_volume_ml() * 1e-6 * hyd.rho_l).max(1e-12),
                );
                let target = crate::transfer::hydro::suspended_fraction(&hyd.st, n_js);

                let cur = &mut cls[k];
                let floor = 0.02;
                if hyd.st.is_stirred() && target > *cur {
                    // the stirring lifts the bed: faster than it settles
                    *cur += (target.max(floor) - *cur) * (1.0 - (-dt_s / 2.0).exp());
                } else if tau.is_finite() {
                    // sedimentation toward the floor, held up by whatever the stirring still keeps suspended
                    let rest = floor.max(if hyd.st.is_stirred() { target } else { 0.0 });
                    *cur = rest + (*cur - rest) * (-dt_s / tau).exp();
                }
            }
            self.ev.susp.insert(sp.clone(), mean_of(&cls));
            self.ev.susp_cls.insert(sp.clone(), cls);
            self.ev.floc_d_cls.insert(sp, floc_cls);
        }
    }

    /// Size view of a solid for the snapshot and the optics: diameter and suspended fraction of each equal-mass size
    /// class, the mass-weighted mean diameter of what is suspended (the haze) and the log-normal spread.
    pub(crate) fn solid_size_view(&self, sp: &str, props: &SolidProps) -> SizeView {
        use crate::transfer::{LogNormal, N_CLASSES};
        let ln = self
            .particle_populations
            .get(sp)
            .filter(|p| !p.is_empty())
            .map(LogNormal::from_population)
            .unwrap_or(LogNormal { d_g_m: props.particle_um * 1e-6, sigma_g: 1.0 });
        let d = ln.class_diameters_m();
        let published = self.ev.susp.get(sp).copied();
        let s = match (self.ev.susp_cls.get(sp), published) {
            (Some(c), Some(m)) if (c.iter().sum::<f64>() / N_CLASSES as f64 - m).abs() < 1e-9 => *c,
            (Some(c), None) => *c,
            (_, m) => [m.unwrap_or(0.5); N_CLASSES],
        };
        let s_sum: f64 = s.iter().sum();
        let suspended_d = if s_sum > 1e-9 { d.iter().zip(s.iter()).map(|(d, s)| d * s).sum::<f64>() / s_sum } else { ln.mass_median_m() };
        SizeView { class_d_m: d, class_susp: s, suspended_d_m: suspended_d, sigma_g: ln.sigma_g }
    }

    /// Mass-weighted mean effective (flocculated) diameter, m, of the size classes of solid `sp` in the current liquid: each
    /// class grows from its primary size toward fractal flocs limited by shear breakage.
    pub(crate) fn floc_diameter_m(&self, sp: &str, props: &SolidProps, view: &SizeView) -> f64 {
        if let Some(cls) = self.ev.floc_d_cls.get(sp) {
            let n = cls.len().max(1) as f64;
            return cls.iter().sum::<f64>() / n;
        }
        let vol_l = (self.solvent_volume_ml() / 1000.0).max(1e-9);
        let ions: Vec<(f64, f64)> = self.species_mol.iter().filter(|(s, m)| **m > 0.0 && ions::species_charge(s) != 0).map(|(s, m)| (m / vol_l, ions::species_charge(s) as f64)).collect();
        let gamma_index = crate::transfer::settling::coagulation_index(&ions);
        let w = ((gamma_index - 0.3) / 0.7).clamp(0.0, 1.0);
        let hyd = self.hydro_state();
        let rho_p = props.density_g_ml * 1000.0;
        let d_pe1 = (6.0 * crate::transport::K_BOLTZMANN * self.temperature_k / (std::f64::consts::PI * crate::transfer::hydro::G_ACCEL * (rho_p - hyd.rho_l).abs().max(1.0))).powf(0.25);
        let vol_m3 = (self.total_liquid_volume_ml() * 1e-6).max(1e-9);
        let eps = crate::transfer::hydro::dissipation_w_kg(&hyd.st, hyd.rho_l, hyd.nu, vol_m3);
        let shear_rate = (eps / hyd.nu.max(1e-9)).sqrt();
        let shear_eff = (shear_rate * shear_rate + 0.04).sqrt();
        let d_max_shear = (20.0 * d_pe1) / (1.0 + shear_eff / 50.0).sqrt();
        let n = view.class_d_m.len().max(1) as f64;
        view.class_d_m.iter().map(|&d| d + w * (d_max_shear.max(d) - d)).sum::<f64>() / n
    }

    // ------------------------------------------------------------------------------------------ events
    pub fn push_event_full(
        &mut self,
        kind: VesselEventKind,
        detail: String,
        severity: f64,
        species: Option<String>,
        rgb: Option<[f64; 3]>,
    ) {
        self.ev.seq += 1;
        self.events.push(VesselEvent {
            kind,
            t_sim_s: self.t_sim_s,
            detail: Some(detail),
            severity: Some(severity),
            seq: self.ev.seq,
            species,
            rgb,
        });
        if self.events.len() > MAX_EVENTS {
            let drop = self.events.len() - MAX_EVENTS;
            self.events.drain(0..drop);
        }
    }

    pub fn push_event(&mut self, kind: VesselEventKind, detail: String, severity: f64) {
        self.push_event_full(kind, detail, severity, None, None);
    }

    fn solid_gone_mol(&self) -> f64 {
        (SOLID_GONE_M * self.solvent_volume_ml() / 1000.0).max(SOLID_GONE_DUST * self.dust_mol())
    }

    /// Marks every solid currently present as known (user-added), so only later arrivals are reported as precipitates.
    pub fn sync_known_solids(&mut self) {
        let gone_mol = self.solid_gone_mol();
        for (sp, &mol) in &self.solid_mol {
            if mol > gone_mol {
                self.ev.solids.insert(sp.clone());
                self.ev.susp.entry(sp.clone()).or_insert(0.2);
            }
        }
    }

    /// Derives log entries from state differences. `force` also evaluates the solution colour right away.
    pub fn detect_events(&mut self, force: bool) {
        let t = self.t_sim_s;
        // --- solids appearing / disappearing
        let mut appeared: Vec<String> = Vec::new();
        let announce_mol = (SOLID_ANNOUNCE_M * self.solvent_volume_ml() / 1000.0).max(SOLID_ANNOUNCE_DUST * self.dust_mol());
        let gone_mol = self.solid_gone_mol();
        for (sp, &mol) in &self.solid_mol {
            if mol > announce_mol && !self.ev.solids.contains(sp) {
                appeared.push(sp.clone());
            }
        }
        appeared.sort();
        for sp in appeared {
            self.ev.solids.insert(sp.clone());
            let props = self.solid_props(&sp);
            let srgb = [to_srgb(props.rgb[0]), to_srgb(props.rgb[1]), to_srgb(props.rgb[2])];
            let cname = colour_name(srgb);
            let text = format!("{} precipitate formed: {}", capitalise(&cname), props.formula);
            self.push_event_full(VesselEventKind::PrecipitateFormed, text, 0.5, Some(sp), Some(props.rgb));
        }
        let gone: Vec<String> = self
            .ev
            .solids
            .iter()
            .filter(|sp| self.solid_mol.get(*sp).copied().unwrap_or(0.0) <= gone_mol)
            .cloned()
            .collect();
        let mut gone = gone;
        gone.sort();
        for sp in gone {
            self.ev.solids.remove(&sp);
            let props = self.solid_props(&sp);
            let detail = format!("Solid gone (dissolved or consumed): {}", props.formula);
            if let Some(last) = self.events.iter_mut().rev().find(|e| e.kind == VesselEventKind::SolidDissolved && e.species.as_deref() == Some(&sp) && (t - e.t_sim_s <= 30.0)) {
                last.detail = Some(detail);
                last.t_sim_s = t;
            } else {
                self.push_event_full(
                    VesselEventKind::SolidDissolved,
                    detail,
                    0.2,
                    Some(sp),
                    Some(props.rgb),
                );
            }
        }

        // --- gas evolution (steam from boiling is reported by the boil display, not here)
        let t = self.t_sim_s;
        let fluxes: Vec<(String, f64)> = self.gas_fluxes.iter().map(|g| (g.species.clone(), g.rate_ml_s)).collect();
        for (sp, rate) in fluxes {
            if sp == crate::db::seed::WATER_VAPOUR || rate < 0.02 {
                continue;
            }
            if self.ev.gas_seen.insert(sp.clone(), t).is_none() {
                self.push_event_full(
                    VesselEventKind::GasEvolved,
                    format!("Gas evolving: {}", sp.trim_end_matches("(g)")),
                    0.4,
                    Some(sp),
                    None,
                );
            }
        }
        self.ev.gas_seen.retain(|_, last| t - *last < 3.0);

        // --- association complexes (A + nL <=> AL_n equilibria): announce when one first accumulates
        let assoc: Vec<String> = self
            .equilibria
            .iter()
            .filter_map(|eq| {
                // generated outer-sphere ion pairs are speciation, not an event worth announcing
                if eq.id.starts_with("pair_") {
                    return None;
                }
                let reac: Vec<&String> = eq.reactants.keys().filter(|k| k.as_str() != crate::db::seed::WATER).collect();
                let prod: Vec<&String> = eq.products.keys().filter(|k| k.as_str() != crate::db::seed::WATER).collect();
                if reac.len() >= 2 && prod.len() == 1 && !reac.iter().any(|r| r.as_str() == crate::db::seed::PROTON || r.as_str() == crate::db::seed::HYDROXIDE) {
                    Some(prod[0].clone())
                } else {
                    None
                }
            })
            .collect();
        for sp in assoc {
            let mol = self.species_mol.get(&sp).copied().unwrap_or(0.0);
            if mol > 5e-6 && !self.ev.complexes.contains(&sp) {
                self.ev.complexes.insert(sp.clone());
                self.push_event_full(VesselEventKind::ComplexFormed, format!("Complex formed: {}", sp), 0.3, Some(sp), None);
            } else if mol < 1e-6 {
                self.ev.complexes.remove(&sp);
            }
        }

        // --- solution colour
        if force || t - self.ev.colour_eval_t >= 0.5 {
            self.ev.colour_eval_t = t;
            self.detect_colour_change();
        }

        // --- temperature jumps from reaction heat (external heating / baths are silent)
        let temp = self.temperature_k;
        let external = self.controls.heater_w.unwrap_or(0.0) > 0.0
            || self.controls.burner_w.unwrap_or(0.0) > 0.0
            || self.bath_k.is_some()
            || temp >= 372.0;
        match self.ev.temp_ref {
            None => {
                self.ev.temp_ref = Some(temp);
                self.ev.temp_ref_t = t;
            }
            Some(r) => {
                if external || t - self.ev.temp_ref_t > 30.0 {
                    self.ev.temp_ref = Some(temp);
                    self.ev.temp_ref_t = t;
                } else if (temp - r).abs() >= 3.0 && self.total_liquid_volume_ml() > 0.5 {
                    let text = if temp > r {
                        format!("Temperature rose {:.1} °C (to {:.1} °C)", temp - r, temp - 273.15)
                    } else {
                        format!("Temperature fell {:.1} °C (to {:.1} °C)", r - temp, temp - 273.15)
                    };
                    if let Some(last) = self.events.iter_mut().rev().find(|e| e.kind == VesselEventKind::TemperatureChange && (t - e.t_sim_s <= 30.0)) {
                        last.detail = Some(text);
                        last.t_sim_s = t;
                    } else {
                        self.push_event_full(VesselEventKind::TemperatureChange, text, 0.4, None, None);
                    }
                }
            }
        }
    }

    /// Colour-change detection per layer: the colour a layer shows at a 2 cm path (its absorption plus the turbidity of the
    /// solids suspended in it), for every liquid layer, aqueous or not. The report names the layer when there is more than
    /// one; each layer keeps its own reference colour.
    fn detect_colour_change(&mut self) {
        let views = self.phase_views();
        // (distance, key, name of the layer, colour, linear colour)
        let mut worst: Option<(f64, String, String, [f64; 3], [f64; 3])> = None;
        for (idx, v) in views.iter().enumerate() {
            if v.volume_ml <= 0.001 {
                continue;
            }
            let aqueous = self.phase_is_aqueous(&v.species_mol);
            let lead = if aqueous {
                None
            } else {
                v.species_mol.iter().filter(|(k, _)| ions::species_charge(k) == 0).max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal).then(b.0.cmp(a.0))).map(|(k, _)| k.clone())
            };
            let po = self.phase_optics(&v.species_mol, v.volume_ml, lead.as_deref());
            let n_layer = crate::props::lorentz_lorenz_refractive_index(&v.species_mol, v.volume_ml);
            let (ext, albedo) = if idx == 0 { self.suspension_optics(n_layer) } else { (vec![0.0; optics::N_BINS], vec![1.0; optics::N_BINS]) };
            let lin = layer_colour_at(&po.a_per_cm, &ext, &albedo, 2.0);
            let cur = [to_srgb(lin[0]), to_srgb(lin[1]), to_srgb(lin[2])];
            let key = match &lead {
                None => "aqueous".to_string(),
                Some(k) => k.clone(),
            };
            let reference = *self.ev.layer_colour_ref.entry(key.clone()).or_insert([1.0, 1.0, 1.0]);
            let dist = ((cur[0] - reference[0]).powi(2) + (cur[1] - reference[1]).powi(2) + (cur[2] - reference[2]).powi(2)).sqrt();
            if dist > 0.12 && worst.as_ref().map_or(true, |w| dist > w.0) {
                let name = lead.as_ref().map(|k| self.display_name(k)).unwrap_or_else(|| "aqueous layer".to_string());
                worst = Some((dist, key, name, cur, lin));
            }
        }
        let many = views.iter().filter(|v| v.volume_ml > 0.001).count() > 1;
        if let Some((_, key, name, cur, lin)) = worst {
            if !self.ev.colour_reported || self.t_sim_s - self.ev.colour_t >= 0.5 {
                self.ev.colour_reported = true;
                let chroma = cur.iter().cloned().fold(0.0, f64::max) - cur.iter().cloned().fold(1.0, f64::min);
                let subject = if many { capitalise(&name) } else { "Solution".to_string() };
                let text = if chroma < 0.06 { format!("{} became colourless", subject) } else { format!("{} turned {}", subject, colour_name(cur)) };
                self.ev.layer_colour_ref.insert(key, cur);
                self.ev.colour_ref = Some(cur);
                self.ev.colour_t = self.t_sim_s;
                if let Some(last) = self.events.iter_mut().rev().find(|e| e.kind == VesselEventKind::ColourChange && (self.t_sim_s - e.t_sim_s <= 30.0)) {
                    last.detail = Some(text);
                    last.t_sim_s = self.t_sim_s;
                    last.rgb = Some(lin);
                } else {
                    self.push_event_full(VesselEventKind::ColourChange, text, 0.4, None, Some(lin));
                }
            }
        }
    }
}

/// Linear-sRGB colour of a layer seen through `path_cm`: Beer-Lambert absorption times the extinction of its suspension, plus
/// the scattered light in proportion to the albedo (single-scattering approximation, as the shader does).
pub fn layer_colour_at(a_per_cm: &[f64], ext_per_cm: &[f64], albedo: &[f64], path_cm: f64) -> [f64; 3] {
    let mut t = [0.0; optics::N_BINS];
    let mut s = [0.0; optics::N_BINS];
    for i in 0..optics::N_BINS {
        let a = a_per_cm.get(i).copied().unwrap_or(0.0);
        let e = ext_per_cm.get(i).copied().unwrap_or(0.0);
        let w = albedo.get(i).copied().unwrap_or(1.0);
        let trans = 10f64.powf(-a * path_cm) * (-e * path_cm).exp();
        t[i] = trans;
        s[i] = (1.0 - (-e * path_cm).exp()) * w * 10f64.powf(-a * path_cm * 0.5);
    }
    let direct = optics::spectrum_to_rgb(&t);
    let scat = optics::spectrum_to_rgb(&s);
    [(direct[0] + scat[0]).clamp(0.0, 1.0), (direct[1] + scat[1]).clamp(0.0, 1.0), (direct[2] + scat[2]).clamp(0.0, 1.0)]
}

/// A monatomic (or Hg2/NH4) cation the solubility table / rules can reason about.
pub fn is_simple_cation(id: &str) -> bool {
    let (body, z) = ions::split_charge(id);
    if z <= 0 {
        return false;
    }
    if body == "NH4" || body == "Hg2" {
        return true;
    }
    ions::cation_charges(body).map_or(false, |cs| cs.contains(&z))
}
