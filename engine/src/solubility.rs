//! Data-driven solubility: a generated table of solubility products (engine/data/solubility.json, built by
//! pipeline/build_solubility_table.py from pipeline/data/*.csv) plus general solubility rules for ion pairs the
//! table does not list. Any cation/anion pair that meets in a vessel is looked up here, so precipitation is not
//! tied to hand-written per-compound entries.

use std::collections::{BTreeMap, HashMap};
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};

use crate::chem_db::{GeneralEquilibrium, GeneralMineral};
use crate::ions;
use crate::types::ProvenanceTier;

#[derive(Deserialize)]
struct SolubilityData {
    minerals: Vec<GeneralMineral>,
    equilibria: Vec<GeneralEquilibrium>,
}

static DATA: OnceLock<SolubilityData> = OnceLock::new();

fn data() -> &'static SolubilityData {
    DATA.get_or_init(|| {
        serde_json::from_str(include_str!("../data/solubility.json"))
            .expect("engine/data/solubility.json is valid (regenerate with pipeline/build_solubility_table.py)")
    })
}

/// All tabulated sparingly-soluble / saturation-limited solids.
pub fn table_minerals() -> &'static [GeneralMineral] {
    &data().minerals
}

/// Tabulated acid/base and speciation equilibria for ions the core catalog does not cover.
pub fn table_equilibria() -> &'static [GeneralEquilibrium] {
    &data().equilibria
}

fn ion_key(ions: &HashMap<String, f64>) -> String {
    let mut v: Vec<String> = ions.iter().map(|(k, n)| format!("{}:{}", k, *n as i64)).collect();
    v.sort();
    v.join("|")
}

/// Tabulated mineral whose dissolved ions are exactly `ions`.
pub fn table_mineral_for(ions: &HashMap<String, f64>) -> Option<GeneralMineral> {
    let key = ion_key(ions);
    table_minerals().iter().find(|m| ion_key(&m.dissolved_products) == key).cloned()
}

fn gcd(a: i32, b: i32) -> i32 {
    if b == 0 {
        a.abs().max(1)
    } else {
        gcd(b, a % b)
    }
}

fn formula_part(base: &str, n: i32) -> String {
    let elems = ions::parse_formula_strict(base).map(|e| e.len()).unwrap_or(1);
    let atoms: f64 = ions::parse_formula_strict(base).map(|e| e.values().sum()).unwrap_or(1.0);
    let wrap = elems > 1 || atoms > 1.0;
    match (n, wrap) {
        (1, _) => base.to_string(),
        (n, true) => format!("({}){}", base, n),
        (n, false) => format!("{}{}", base, n),
    }
}

fn anion_formula(id: &str) -> String {
    ions::anion_def(id).map(|a| a.formula.to_string()).unwrap_or_else(|| ions::split_charge(id).0.to_string())
}

/// Formula of the neutral solid formed from `n_c` cations and `n_a` anions, e.g. ("Pb+2",1,"NO3-",2) -> "Pb(NO3)2".
pub fn solid_formula(cation: &str, n_c: i32, anion: &str, n_a: i32) -> String {
    format!("{}{}", formula_part(ions::split_charge(cation).0, n_c), formula_part(&anion_formula(anion), n_a))
}

/// True when general solubility rules (not the table) say the pair forms an insoluble solid.
pub fn insoluble_by_rules(cation: &str, anion: &str) -> bool {
    // Alkali metals, ammonium and the proton give soluble salts with everything we model.
    if matches!(cation, "Li+" | "Na+" | "K+" | "Rb+" | "Cs+" | "NH4+" | "H+" | "H3O+") {
        return false;
    }
    let group2 = matches!(cation, "Mg+2" | "Ca+2" | "Sr+2" | "Ba+2" | "Ra+2");
    let transition_or_p = !group2;
    match anion {
        // Always soluble families
        "NO3-" | "CH3COO-" | "HCOO-" | "ClO3-" | "ClO4-" | "ClO-" | "ClO2-" | "MnO4-" | "NO2-" | "HCO3-" | "HSO4-"
        | "H2PO4-" | "HS-" | "HSO3-" | "HCrO4-" | "HC2O4-" | "IO4-" | "N3-" => false,
        "Cl-" | "Br-" | "I-" | "SCN-" | "CN-" | "BrO3-" => matches!(cation, "Ag+" | "Pb+2" | "Hg2+2" | "Cu+" | "Tl+" | "Au+" | "Hg+2"),
        "F-" => group2 || matches!(cation, "Pb+2" | "Cu+2" | "Zn+2") || cation.ends_with("+3"),
        "SO4-2" => matches!(cation, "Ba+2" | "Sr+2" | "Pb+2" | "Ra+2" | "Hg2+2" | "Ca+2" | "Ag+"),
        "S2O3-2" | "Cr2O7-2" | "S2O8-2" | "SeO4-2" => matches!(cation, "Ag+" | "Pb+2" | "Hg2+2" | "Tl+"),
        "OH-" => !matches!(cation, "Ba+2" | "Sr+2" | "Ra+2"),
        "S-2" => !group2,
        "CrO4-2" | "MoO4-2" | "WO4-2" => !matches!(cation, "Mg+2" | "Ca+2"),
        "CO3-2" | "PO4-3" | "HPO4-2" | "C2O4-2" | "SO3-2" | "SiO3-2" | "IO3-" | "AsO4-3" | "B4O7-2" | "C6H5O7-3" => true,
        "Fe(CN)6-4" | "Fe(CN)6-3" => transition_or_p,
        _ => false,
    }
}

fn charges(cation: &str, anion: &str) -> (i32, i32) {
    (ions::species_charge(cation), -ions::species_charge(anion))
}

/// Builds a mineral for the pair with the supplied Ksp (log10) and generic appearance.
fn make_mineral(cation: &str, anion: &str, log_ksp: f64, tier: ProvenanceTier, source: &str) -> Option<GeneralMineral> {
    let (zc, za) = charges(cation, anion);
    if zc <= 0 || za <= 0 {
        return None;
    }
    let g = gcd(zc, za);
    let (n_c, n_a) = (za / g, zc / g);
    let formula = solid_formula(cation, n_c, anion, n_a);
    let hue = ions::anion_solid_tint(anion).unwrap_or_else(|| ions::cation_solid_hue(cation));
    let kind = if anion == "OH-" {
        "gel"
    } else if matches!(anion, "Cl-" | "Br-" | "I-") {
        "curds"
    } else {
        "powder"
    };
    let mut dissolved = HashMap::new();
    dissolved.insert(cation.to_string(), n_c as f64);
    dissolved.insert(anion.to_string(), n_a as f64);
    // Density from the ions' sizes at a typical ionic-crystal packing fraction (`crystal.rs`) when nothing better is known.
    let density = ions::species_mass(&formula)
        .and_then(|m| crate::crystal::estimate_density_g_ml(&[(cation.to_string(), n_c as f64), (anion.to_string(), n_a as f64)], m))
        .map_or(2.5, |d| d.clamp(1.0, 12.0));
    Some(GeneralMineral {
        id: format!("{}_auto", formula),
        mineral: formula.clone(),
        formula: formula.clone(),
        solid_species: format!("{}(s)", formula),
        dissolved_products: dissolved,
        log_ksp_298: log_ksp,
        delta_h_kj: 0.0,
        solid_color: hue,
        density_g_ml: density,
        default_particle_um: if kind == "curds" { 2.0 } else if kind == "gel" { 5.0 } else { 10.0 },
        kind: kind.to_string(),
        log_ksp_analytic: None,
        tier,
        source: source.to_string(),
        interfacial_energy_j_m2: None,
        interfacial_energy_source: None,
    })
}

/// Mineral controlling a cation/anion pair: the tabulated Ksp if present, otherwise a rule-based estimate when the
/// solubility rules call the pair insoluble, otherwise None (the pair stays dissolved).
pub fn mineral_for_pair(cation: &str, anion: &str) -> Option<GeneralMineral> {
    let (zc, za) = charges(cation, anion);
    if zc <= 0 || za <= 0 {
        return None;
    }
    let g = gcd(zc, za);
    let mut ions_map = HashMap::new();
    ions_map.insert(cation.to_string(), (za / g) as f64);
    ions_map.insert(anion.to_string(), (zc / g) as f64);
    if let Some(m) = table_mineral_for(&ions_map) {
        return Some(m);
    }
    if !insoluble_by_rules(cation, anion) {
        return None;
    }
    let log_ksp = -(4.0 + 2.0 * (zc * za) as f64);
    make_mineral(cation, anion, log_ksp, ProvenanceTier::Speculative, "General solubility rules (order-of-magnitude estimate)")
}

/// Mineral describing the *solid form of a soluble salt* (its saturation limit). Table value if listed, else a
/// default saturation of ~3 mol/L of formula units.
pub fn saturation_mineral(cation: &str, n_c: f64, anion: &str, n_a: f64) -> Option<GeneralMineral> {
    let mut ions_map = HashMap::new();
    ions_map.insert(cation.to_string(), n_c);
    ions_map.insert(anion.to_string(), n_a);
    if let Some(m) = table_mineral_for(&ions_map) {
        return Some(m);
    }
    let s: f64 = 3.0;
    let log_ksp = n_c * (n_c * s).log10() + n_a * (n_a * s).log10();
    let tier = ProvenanceTier::Estimated;
    let mut m = make_mineral(cation, anion, log_ksp, tier, "Solubility cap estimate (3 mol/L)")?;
    // make_mineral derives stoichiometry from charges; honour the formula's own ratio when it differs (e.g. Hg2+2)
    m.dissolved_products.insert(cation.to_string(), n_c);
    m.dissolved_products.insert(anion.to_string(), n_a);
    m.kind = "crystal".to_string();
    m.default_particle_um = 40.0;
    Some(m)
}

// ---------------------------------------------------------------------------------------------- external data (PubChem)
//
// Solids whose Ksp is only a rule-of-thumb guess (or a default saturation cap) are queued here. The web layer drains the
// queue, looks the compound up on PubChem, and answers with `resolve_mineral`, which replaces the guess with a Ksp derived
// from the measured solubility (plus the record's colour / density / name).

/// A solid whose solubility data should be looked up externally.
#[derive(Clone, Debug, Serialize)]
pub struct MineralLookup {
    pub solid_species: String,
    pub formula: String,
    /// Hill-ordered formula without groups ("I2Pb"), the form PubChem formula search expects.
    pub hill_formula: String,
    pub cation: String,
    pub anion: String,
    pub n_c: f64,
    pub n_a: f64,
    pub molar_mass: f64,
    /// "speculative" (rule-based) or "estimated" (default saturation cap).
    pub tier: String,
}

/// Minerals awaiting data (the guess that is replaced when data arrives), with whether the web layer was told yet.
static PENDING: Mutex<BTreeMap<String, (GeneralMineral, bool)>> = Mutex::new(BTreeMap::new());
/// Every species ever queued: each is requested at most once per session, even if the lookup finds nothing.
static SEEN: Mutex<Vec<String>> = Mutex::new(Vec::new());

/// Hill-system formula (C, H, then alphabetical; purely alphabetical without carbon) with parentheses expanded.
pub fn hill_formula(formula: &str) -> Option<String> {
    let elems = ions::parse_formula_strict(formula)?;
    Some(hill_from_elems(&elems))
}

/// Hill-system formula of an element-count map.
pub fn hill_from_elems(elems: &std::collections::HashMap<String, f64>) -> String {
    let mut keys: Vec<&String> = elems.keys().collect();
    let has_c = elems.contains_key("C");
    keys.sort_by(|a, b| {
        let rank = |e: &str| if has_c && e == "C" { 0 } else if has_c && e == "H" { 1 } else { 2 };
        rank(a).cmp(&rank(b)).then(a.cmp(b))
    });
    let mut out = String::new();
    for k in keys {
        out.push_str(k);
        let n = elems[k];
        if (n - 1.0).abs() > 1e-9 {
            out.push_str(&format!("{}", n.round() as i64));
        }
    }
    out
}

/// Queues a guessed mineral for an external data lookup (no-op for tabulated / already-imported data and repeats).
pub fn request_lookup(m: &GeneralMineral) {
    if !matches!(m.tier, ProvenanceTier::Speculative | ProvenanceTier::Estimated) {
        return;
    }
    if let (Ok(mut seen), Ok(mut pending)) = (SEEN.lock(), PENDING.lock()) {
        if seen.contains(&m.solid_species) {
            return;
        }
        seen.push(m.solid_species.clone());
        pending.insert(m.solid_species.clone(), (m.clone(), false));
    }
}

fn split_ions(m: &GeneralMineral) -> Option<((String, f64), (String, f64))> {
    let mut cat = None;
    let mut an = None;
    for (id, n) in &m.dissolved_products {
        match ions::species_charge(id) {
            z if z > 0 => cat = Some((id.clone(), *n)),
            z if z < 0 => an = Some((id.clone(), *n)),
            _ => {}
        }
    }
    Some((cat?, an?))
}

/// Lookups queued since the last call (each solid is reported once per session).
pub fn take_lookups() -> Vec<MineralLookup> {
    let mut out = Vec::new();
    let Ok(mut pending) = PENDING.lock() else { return out };
    for (sp, (m, announced)) in pending.iter_mut() {
        if *announced {
            continue;
        }
        let Some(((cation, n_c), (anion, n_a))) = split_ions(m) else { continue };
        let Some(hill) = hill_formula(&m.formula) else { continue };
        *announced = true;
        out.push(MineralLookup {
            solid_species: sp.clone(),
            formula: m.formula.clone(),
            hill_formula: hill,
            cation,
            anion,
            n_c,
            n_a,
            molar_mass: ions::species_mass(&m.formula).unwrap_or(0.0),
            tier: if m.tier == ProvenanceTier::Speculative { "speculative" } else { "estimated" }.to_string(),
        });
    }
    out
}

/// What the web layer found out about a solid (all fields optional; priority log_ksp > solubility > qualitative).
#[derive(Clone, Debug, Default, Deserialize)]
pub struct MineralData {
    pub solid_species: String,
    #[serde(default)]
    pub cid: Option<u64>,
    #[serde(default)]
    pub name: Option<String>,
    /// Solubility in water at ~25 C, grams of solid per litre of solution.
    #[serde(default)]
    pub solubility_g_per_l: Option<f64>,
    #[serde(default)]
    pub log_ksp: Option<f64>,
    /// USP descriptive term, used only when no number was found.
    #[serde(default)]
    pub qualitative: Option<String>,
    /// Linear (not sRGB) colour.
    #[serde(default)]
    pub color_linear_rgb: Option<[f64; 3]>,
    #[serde(default)]
    pub density_g_ml: Option<f64>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub source: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct MineralResolution {
    pub registered: bool,
    pub id: String,
    pub log_ksp: Option<f64>,
    pub tier: String,
    pub source: String,
    pub detail: String,
    /// The mineral to register everywhere (None when the solid is unknown to the engine).
    #[serde(skip)]
    pub mineral: Option<GeneralMineral>,
}

/// Geometric midpoint (g/L) of the USP solubility band for a descriptive term.
fn qualitative_g_per_l(term: &str) -> Option<f64> {
    Some(match term {
        "very_soluble" => 2000.0,
        "freely_soluble" => 300.0,
        "soluble" => 60.0,
        "sparingly_soluble" => 18.0,
        "slightly_soluble" => 3.0,
        "very_slightly_soluble" => 0.3,
        "practically_insoluble" => 0.03,
        _ => return None,
    })
}

/// Ksp (log10) of a salt `n_c`:`n_a` with molar solubility `s` (mol/L), ideal dissociation.
fn log_ksp_from_molar_solubility(n_c: f64, n_a: f64, s: f64) -> f64 {
    n_c * (n_c * s).log10() + n_a * (n_a * s).log10()
}

/// Sets a mineral's Ksp from a measured water solubility (g of solid per litre of solution), the one derivation used
/// by both PubChem mineral lookups (`resolve_mineral`) and imported compounds (`compound_model`). Returns the new
/// log Ksp, or None when the mineral is not a simple cation/anion pair or its molar mass is unknown.
pub fn apply_solubility(m: &mut GeneralMineral, g_per_l: f64) -> Option<f64> {
    if !(g_per_l.is_finite() && g_per_l > 0.0) {
        return None;
    }
    let ((_, n_c), (_, n_a)) = split_ions(m)?;
    let molar_mass = ions::species_mass(&m.formula).filter(|mm| *mm > 0.0)?;
    m.log_ksp_298 = log_ksp_from_molar_solubility(n_c, n_a, g_per_l / molar_mass).clamp(-60.0, 4.0);
    m.tier = ProvenanceTier::Imported;
    Some(m.log_ksp_298)
}

/// Applies externally found data to the guessed mineral for `d.solid_species`.
pub fn resolve_mineral(d: &MineralData) -> MineralResolution {
    let base = PENDING
        .lock()
        .ok()
        .and_then(|p| p.get(&d.solid_species).map(|(m, _)| m.clone()))
        .or_else(|| crate::chem_db::get_default_minerals().into_iter().find(|m| m.solid_species == d.solid_species));
    let fail = |detail: &str| MineralResolution {
        registered: false,
        id: String::new(),
        log_ksp: None,
        tier: String::new(),
        source: d.source.clone(),
        detail: detail.to_string(),
        mineral: None,
    };
    let Some(mut m) = base else { return fail("unknown solid") };
    let Some(((_, n_c), (_, n_a))) = split_ions(&m) else { return fail("solid is not a simple salt") };
    let molar_mass = ions::species_mass(&m.formula).unwrap_or(0.0);

    let mut detail = String::new();
    if let Some(l) = d.log_ksp.filter(|l| l.is_finite()) {
        m.log_ksp_298 = l.clamp(-60.0, 4.0);
        m.tier = ProvenanceTier::Imported;
        detail = format!("Ksp stated in record: 10^{:.2}", m.log_ksp_298);
    } else if let (Some(g), true) = (d.solubility_g_per_l.filter(|g| g.is_finite() && *g > 0.0), molar_mass > 0.0) {
        apply_solubility(&mut m, g);
        detail = format!("solubility {:.3e} g/L -> Ksp 10^{:.2}", g, m.log_ksp_298);
    } else if let (Some(g), true) = (d.qualitative.as_deref().and_then(qualitative_g_per_l), molar_mass > 0.0) {
        m.log_ksp_298 = log_ksp_from_molar_solubility(n_c, n_a, g / molar_mass).clamp(-60.0, 4.0);
        m.tier = ProvenanceTier::Estimated;
        detail = format!("described as {} -> Ksp 10^{:.2}", d.qualitative.as_deref().unwrap_or(""), m.log_ksp_298);
    }
    if let Some(n) = d.name.as_ref().filter(|n| !n.trim().is_empty()) {
        m.mineral = n.trim().to_string();
    }
    if let Some(c) = d.color_linear_rgb {
        m.solid_color = c.map(|x| x.clamp(0.0, 1.0));
    }
    if let Some(rho) = d.density_g_ml.filter(|r| r.is_finite() && *r > 0.3 && *r < 25.0) {
        m.density_g_ml = rho;
    }
    if let Some(k) = d.kind.as_deref().filter(|k| matches!(*k, "powder" | "curds" | "gel" | "crystal")) {
        m.kind = k.to_string();
        m.default_particle_um = match k {
            "curds" => 2.0,
            "gel" => 5.0,
            "crystal" => 40.0,
            _ => 10.0,
        };
    }
    if !d.source.is_empty() {
        m.source = if detail.is_empty() { d.source.clone() } else { format!("{} ({})", d.source, detail) };
    }
    if let Ok(mut p) = PENDING.lock() {
        p.remove(&d.solid_species);
    }
    MineralResolution {
        registered: true,
        id: m.id.clone(),
        log_ksp: Some(m.log_ksp_298),
        tier: m.tier.as_str().to_string(),
        source: m.source.clone(),
        detail,
        mineral: Some(m),
    }
}

/// Mineral for the solid form of an imported salt. One solid, one record: whatever already controls this solid
/// (tabulated, resolved from PubChem, or the insoluble-by-rules estimate that precipitation uses) wins over the generic
/// 3 mol/L saturation cap, so adding the salt as a reagent and forming it by precipitation behave identically.
pub fn mineral_for_import(cation: &str, n_c: f64, anion: &str, n_a: f64) -> Option<GeneralMineral> {
    let cap = saturation_mineral(cation, n_c, anion, n_a)?;
    if let Some(known) = crate::chem_db::get_default_minerals().into_iter().find(|m| m.solid_species == cap.solid_species) {
        return Some(known);
    }
    let by_rules = if n_c.fract() == 0.0 && n_a.fract() == 0.0 { mineral_for_pair(cation, anion) } else { None };
    match by_rules {
        Some(m) if m.solid_species == cap.solid_species => Some(m),
        _ => Some(cap),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn table_loads_and_is_balanced() {
        assert!(table_minerals().len() > 100);
        for m in table_minerals() {
            let mut charge = 0.0;
            for (ion, n) in &m.dissolved_products {
                charge += ions::species_charge(ion) as f64 * n;
            }
            assert!(charge.abs() < 1e-9, "{} not charge balanced", m.formula);
        }
        assert!(table_mineral_for(&[("Ag+".to_string(), 1.0), ("I-".to_string(), 1.0)].into()).is_some());
    }

    #[test]
    fn rules_cover_unlisted_pairs() {
        // CdS-like pair not in the table: Sn+2 + CO3-2 -> insoluble by rule
        let m = mineral_for_pair("Sn+2", "CO3-2").expect("rule-based mineral");
        assert_eq!(m.solid_species, "SnCO3(s)");
        assert!(mineral_for_pair("Rb+", "Cl-").is_none());
        assert!(mineral_for_pair("Rb+", "NO3-").is_none());
        assert_eq!(solid_formula("Pb+2", 1, "NO3-", 2), "Pb(NO3)2");
        assert_eq!(solid_formula("Ca+2", 3, "PO4-3", 2), "Ca3(PO4)2");
        assert_eq!(solid_formula("NH4+", 2, "SO4-2", 1), "(NH4)2SO4");
    }
}
