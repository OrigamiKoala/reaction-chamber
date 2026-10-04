//! M5 Chemical Database.
//! General reaction frameworks, species registry, thermodynamic properties,
//! and extensible reaction network supporting PubChem imports and arbitrary compounds.

use std::collections::HashMap;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use crate::types::ProvenanceTier;
use crate::compound_thermo::CompoundThermo;

static CUSTOM_REAGENTS: Mutex<Vec<ReagentCatalogEntry>> = Mutex::new(Vec::new());
static CUSTOM_EQUILIBRIA: Mutex<Vec<GeneralEquilibrium>> = Mutex::new(Vec::new());
static CUSTOM_MINERALS: Mutex<Vec<GeneralMineral>> = Mutex::new(Vec::new());
static CUSTOM_KINETICS: Mutex<Vec<GeneralKineticRxn>> = Mutex::new(Vec::new());
static CUSTOM_COMPOUNDS: Mutex<Vec<CompoundThermo>> = Mutex::new(Vec::new());

pub fn register_custom_reagent(entry: ReagentCatalogEntry) {
    if let Ok(mut lock) = CUSTOM_REAGENTS.lock() {
        lock.retain(|r| r.id != entry.id);
        lock.push(entry);
    }
}

pub fn register_custom_equilibrium(eq: GeneralEquilibrium) {
    if let Ok(mut lock) = CUSTOM_EQUILIBRIA.lock() {
        lock.retain(|e| e.id != eq.id);
        lock.push(eq);
    }
}

pub fn register_custom_mineral(min: GeneralMineral) {
    if let Ok(mut lock) = CUSTOM_MINERALS.lock() {
        lock.retain(|m| m.id != min.id && m.solid_species != min.solid_species);
        lock.push(min);
    }
}

pub fn get_mineral_registry() -> Vec<GeneralMineral> {
    let mut list = get_default_minerals();
    if let Ok(lock) = CUSTOM_MINERALS.lock() {
        for m in lock.iter() {
            list.retain(|x| x.id != m.id && x.solid_species != m.solid_species);
            list.push(m.clone());
        }
    }
    list
}

/// Registers the physical-data record of a compound (keyed by its base species id).
pub fn register_custom_compound(c: CompoundThermo) {
    if let Ok(mut lock) = CUSTOM_COMPOUNDS.lock() {
        lock.retain(|x| x.species != c.species);
        lock.push(c);
    }
}

/// Every registered compound record (new vessels start with these).
pub fn get_compound_registry() -> Vec<CompoundThermo> {
    CUSTOM_COMPOUNDS.lock().map(|l| l.clone()).unwrap_or_default()
}

pub fn register_custom_kinetic_rxn(rxn: GeneralKineticRxn) {
    if let Ok(mut lock) = CUSTOM_KINETICS.lock() {
        lock.retain(|r| r.id != rxn.id);
        lock.push(rxn);
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReagentCatalogEntry {
    pub id: String,
    pub name: String,
    pub formula: String,
    pub form: String, // "solid" | "liquid" | "solution"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub concentration_m: Option<f64>,
    pub density_g_ml: f64,
    pub ghs: Vec<String>,
    pub signal_word: String,
    pub bottle_colour: String, // "amber" | "clear" | "white"
    pub composition: HashMap<String, f64>,
    pub label: String,
    pub by_mass: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dropper: Option<bool>,
    /// InChIKey of the main species (identity for matching imports against catalog reagents).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inchi_key: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeneralEquilibrium {
    pub id: String,
    pub name: String,
    pub equation: String,
    pub reactants: HashMap<String, f64>,
    pub products: HashMap<String, f64>,
    pub log_k_298: f64,
    pub delta_h_kj: f64,
    /// Optional analytic temperature dependence log10 K(T) = a1 + a2 T + a3 / T + a4 log10 T + a5 / T^2 (PHREEQC
    /// `-analytical_expression` form). When present it replaces the constant-ΔH van 't Hoff extrapolation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub log_k_analytic: Option<[f64; 5]>,
    /// Kinetics of this row when it is not instantaneous on the time scale of the bench (CO2 hydration, ...): the forward
    /// rate constant as a sum of an uncatalysed and species-catalysed terms. A row without a rate is in equilibrium at
    /// all times (proton transfers, complexation: diffusion-controlled).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rate: Option<EquilibriumRate>,
    pub tier: ProvenanceTier,
    pub source: String,
}

/// Forward rate law of an equilibrium row: k_f = sum_i k_i(T) [catalyst_i] (the reverse rate follows from detailed balance,
/// k_r = k_f / K(T)).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EquilibriumRate {
    pub terms: Vec<RateTerm>,
    pub source: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RateTerm {
    /// Species whose molar concentration multiplies the term; None = the uncatalysed (solvent) path.
    pub catalyst: Option<String>,
    /// Rate constant at 298.15 K (s^-1, or M^-1 s^-1 with a catalyst).
    pub k_298: f64,
    /// Arrhenius activation energy, J/mol.
    pub ea_j_mol: f64,
}

impl EquilibriumRate {
    /// Forward first-order rate coefficient (s^-1) at `t_k` given the molar concentration of a species.
    pub fn k_forward(&self, t_k: f64, conc_m: &dyn Fn(&str) -> f64) -> f64 {
        let inv = 1.0 / t_k.max(1.0) - 1.0 / 298.15;
        self.terms
            .iter()
            .map(|term| {
                let k = term.k_298 * (-term.ea_j_mol / crate::physics::R_GAS * inv).exp();
                k * term.catalyst.as_deref().map_or(1.0, conc_m)
            })
            .sum()
    }
}

impl GeneralEquilibrium {
    /// log10 K at temperature `t_k` (analytic expression if given, else constant-ΔH van 't Hoff from 298.15 K).
    pub fn log_k_at(&self, t_k: f64) -> f64 {
        if let Some(a) = &self.log_k_analytic {
            let t = t_k.max(1.0);
            return a[0] + a[1] * t + a[2] / t + a[3] * t.log10() + a[4] / (t * t);
        }
        self.log_k_298 + (-self.delta_h_kj * 1000.0 / crate::physics::R_GAS) * (1.0 / t_k.max(1.0) - 1.0 / 298.15) / std::f64::consts::LN_10
    }
}

/// log10 Kw of water autoionisation H2O <=> H+ + OH- (PHREEQC phreeqc.dat analytic expression, 0-300 C).
pub const WATER_KW_ANALYTIC: [f64; 5] = [-283.971, -0.05069842, 13323.0, 102.24447, -1119669.0];

/// log10 Kw(T) (concentration scale, as used by the solver's water equilibrium).
pub fn water_log_kw(t_k: f64) -> f64 {
    let a = &WATER_KW_ANALYTIC;
    let t = t_k.max(1.0);
    a[0] + a[1] * t + a[2] / t + a[3] * t.log10() + a[4] / (t * t)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeneralMineral {
    pub id: String,
    pub mineral: String,
    pub formula: String,
    pub solid_species: String,
    pub dissolved_products: HashMap<String, f64>,
    pub log_ksp_298: f64,
    pub delta_h_kj: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub log_ksp_analytic: Option<[f64; 5]>,
    pub solid_color: [f64; 3],
    pub density_g_ml: f64,
    pub default_particle_um: f64,
    pub kind: String, // "powder" | "curds" | "gel" | "crystal" | "metal"
    pub tier: ProvenanceTier,
    pub source: String,
    /// Optional measured solid-water interfacial energy (J/m^2, e.g. Nielsen & Sohnel 1971). When present it replaces
    /// the Mersmann estimate in the nucleation model (`transfer::nucleation::SaltProps::gamma_override_j_m2`); the
    /// model needs no such value to run. Per-compound data, tier `Tabulated`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interfacial_energy_j_m2: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interfacial_energy_source: Option<String>,
}

impl GeneralMineral {
    pub fn log_ksp_at(&self, t_k: f64) -> f64 {
        if let Some(a) = &self.log_ksp_analytic {
            let t = t_k.max(1.0);
            return a[0] + a[1] * t + a[2] / t + a[3] * t.log10() + a[4] / (t * t);
        }
        self.log_ksp_298 + (-self.delta_h_kj * 1000.0 / crate::physics::R_GAS) * (1.0 / t_k.max(1.0) - 1.0 / 298.15) / std::f64::consts::LN_10
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeneralKineticRxn {
    pub id: String,
    pub equation: String,
    pub reactants: HashMap<String, f64>,
    pub products: HashMap<String, f64>,
    pub gas_products: HashMap<String, f64>,
    /// Reaction order per reactant. Absent = the stoichiometric coefficient (elementary step); a reactant missing
    /// from the map also defaults to its coefficient. Orders never alter how much of a species is consumed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub orders: Option<HashMap<String, f64>>,
    pub arrhenius_a: f64,
    pub arrhenius_n: f64,
    pub arrhenius_ea: f64, // J/mol
    pub delta_h_kj: f64,
    pub catalyst_species: Option<String>,
    pub is_reversible: bool,
    pub k_eq_298: Option<f64>,
    pub tier: ProvenanceTier,
    pub source: String,
}

/// Molar mass and charge of a species: what almost every caller needs. The mass is exact whenever the id parses as a
/// formula or has a store record; an id with neither gets 50 g/mol and a property request is queued. The
/// thermodynamics of a species are `thermo::try_thermo_state` (formation data or None) and `species_cp_j_mol_k`.
#[derive(Clone, Copy, Debug)]
pub struct SpeciesThermo {
    pub mw: f64,
    pub charge: i32,
}

/// Parses chemical formula to element count map for universal conservation checks
pub fn parse_elements(formula: &str) -> HashMap<String, f64> {
    let mut elements = HashMap::new();
    let cleaned = formula.replace("(s)", "").replace("(l)", "").replace("(g)", "").replace("(aq)", "");
    let mut i = 0;
    let chars: Vec<char> = cleaned.chars().collect();


    fn parse_sub(chars: &[char], i: &mut usize, mult: f64, out: &mut HashMap<String, f64>) {
        let n = chars.len();
        while *i < n {
            let c = chars[*i];
            if c == '(' || c == '[' {
                *i += 1;
                let mut inner = HashMap::new();
                parse_sub(chars, i, 1.0, &mut inner);
                // read multiplier after closing bracket
                let mut count_str = String::new();
                while *i < n && (chars[*i].is_ascii_digit() || chars[*i] == '.') {
                    count_str.push(chars[*i]);
                    *i += 1;
                }
                let count: f64 = count_str.parse().unwrap_or(1.0);
                for (elem, cnt) in inner {
                    *out.entry(elem).or_insert(0.0) += cnt * count * mult;
                }
            } else if c == ')' || c == ']' {
                *i += 1;
                return;
            } else if c.is_ascii_uppercase() {
                let mut elem = String::new();
                elem.push(c);
                *i += 1;
                if *i < n && chars[*i].is_ascii_lowercase() {
                    elem.push(chars[*i]);
                    *i += 1;
                }
                let mut count_str = String::new();
                while *i < n && (chars[*i].is_ascii_digit() || chars[*i] == '.') {
                    count_str.push(chars[*i]);
                    *i += 1;
                }
                let count: f64 = count_str.parse().unwrap_or(1.0);
                *out.entry(elem).or_insert(0.0) += count * mult;
            } else {
                *i += 1;
            }
        }
    }

    parse_sub(&chars, &mut i, 1.0, &mut elements);
    elements
}

/// Result of an element + charge balance check of a reaction written as species-id -> coefficient maps.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct BalanceReport {
    /// All species were parseable and elements and charge balance within tolerance.
    pub balanced: bool,
    /// Species ids whose formula could not be parsed (pseudo-species such as indicators); the balance is unverifiable.
    pub unverifiable: Vec<String>,
    /// Net (products - reactants) per element where non-zero, mol per mol of reaction.
    pub element_imbalance: HashMap<String, f64>,
    /// Net charge (products - reactants).
    pub charge_imbalance: f64,
}

impl BalanceReport {
    /// Human-readable reason, or None when the reaction balances.
    pub fn problem(&self) -> Option<String> {
        if !self.element_imbalance.is_empty() || self.charge_imbalance.abs() > 1e-9 {
            let mut parts: Vec<String> = self.element_imbalance.iter().map(|(e, d)| format!("{}{:+}", e, d)).collect();
            parts.sort();
            if self.charge_imbalance.abs() > 1e-9 {
                parts.push(format!("charge{:+}", self.charge_imbalance));
            }
            Some(format!("not balanced ({})", parts.join(", ")))
        } else if !self.unverifiable.is_empty() {
            Some(format!("cannot verify balance: unparseable species {}", self.unverifiable.join(", ")))
        } else {
            None
        }
    }
}

/// Element + charge balance of `reactants -> products (+ gas_products)` using `ions::species_elements` / `species_charge`.
pub fn check_balance(
    reactants: &HashMap<String, f64>,
    products: &HashMap<String, f64>,
    gas_products: &HashMap<String, f64>,
) -> BalanceReport {
    let mut rep = BalanceReport::default();
    let mut net: HashMap<String, f64> = HashMap::new();
    let mut charge = 0.0;
    for (side, sign) in [(reactants, -1.0), (products, 1.0), (gas_products, 1.0)] {
        for (sp, &nu) in side {
            match crate::ions::species_elements(sp) {
                Some(elems) => {
                    for (e, n) in elems {
                        *net.entry(e).or_insert(0.0) += sign * nu * n;
                    }
                    charge += sign * nu * crate::ions::species_charge(sp) as f64;
                }
                None => {
                    if !rep.unverifiable.contains(sp) {
                        rep.unverifiable.push(sp.clone());
                    }
                }
            }
        }
    }
    rep.unverifiable.sort();
    // With any unparseable species the element sums are meaningless; only report them when everything parsed.
    if rep.unverifiable.is_empty() {
        rep.element_imbalance = net.into_iter().filter(|(_, d)| d.abs() > 1e-9).collect();
        rep.charge_imbalance = charge;
    }
    rep.balanced = rep.problem().is_none();
    rep
}

/// Audits a kinetic reaction: an unbalanced or unverifiable one is demoted to the Speculative tier. Returns the warning.
pub fn audit_kinetic_reaction(rxn: &mut GeneralKineticRxn) -> Option<String> {
    let rep = check_balance(&rxn.reactants, &rxn.products, &rxn.gas_products);
    rep.problem().map(|p| {
        rxn.tier = ProvenanceTier::Speculative;
        format!("Reaction '{}' ({}) {}", rxn.id, rxn.equation, p)
    })
}

/// Audits an equilibrium (H2O included on both sides): unbalanced / unverifiable ones are demoted to Speculative.
pub fn audit_equilibrium(eq: &mut GeneralEquilibrium) -> Option<String> {
    let rep = check_balance(&eq.reactants, &eq.products, &HashMap::new());
    rep.problem().map(|p| {
        eq.tier = ProvenanceTier::Speculative;
        format!("Equilibrium '{}' ({}) {}", eq.id, eq.equation, p)
    })
}

pub fn get_species_thermo(species: &str) -> SpeciesThermo {
    let charge = crate::ions::species_charge(species);
    match crate::ions::species_mass(species).filter(|m| *m > 0.5) {
        Some(mw) => SpeciesThermo { mw, charge },
        None => {
            // no formula and no record: the mass is unknown, not 50 g/mol; ask for the data
            crate::queue_property_request(crate::PropertyRequest {
                species_id: species.to_string(),
                identity: crate::db::Identity {
                    inchikey: None,
                    smiles: None,
                    formula: species.to_string(),
                    charge,
                    cas: None,
                    cid: None,
                    names: vec![species.to_string()],
                    db_names: HashMap::new(),
                },
                kinds: vec!["thermo".to_string()],
                reason: format!("molar mass of {} is unknown", species),
                current_tier: ProvenanceTier::Speculative,
            });
            SpeciesThermo { mw: 50.0, charge }
        }
    }
}

/// Molar heat capacity (J/(mol K)) of a species at 298.15 K in the phase its id names, from its record; None when the
/// store has no heat capacity for it (no placeholder).
pub fn species_cp_j_mol_k(species: &str) -> Option<f64> {
    let phase = crate::thermo::phase_of_id(species);
    if let Some(st) = crate::thermo::try_thermo_state(species, phase, 298.15, 101_325.0) {
        // (the standard partial molar heat capacity of an aqueous ion is often negative: only zero means "no datum")
        if st.cp_j_mol_k.abs() > 1e-9 {
            return Some(st.cp_j_mol_k);
        }
    }
    let global = crate::db::SpeciesStore::global();
    let store = global.read().ok()?;
    let rec = store.get(species)?;
    ["aq", "l", "s", "g"].iter().find_map(|ph| rec.phases.get(*ph).and_then(|p| p.thermo.as_ref()).and_then(|t| t.cp.as_ref()).map(|d| d.value)).filter(|v| v.abs() > 1e-9)
}

/// Provenance of the thermodynamic data of a species: the tier of its formation record, Speculative when it has none.
pub fn species_thermo_tier(species: &str) -> ProvenanceTier {
    let phase = crate::thermo::phase_of_id(species);
    if let Some(st) = crate::thermo::try_thermo_state(species, phase, 298.15, 101_325.0) {
        return st.tier;
    }
    if let Ok(store) = crate::db::SpeciesStore::global().read() {
        if let Some(rec) = store.get(species) {
            let phase_thermo = rec.phases.get("aq")
                .or_else(|| rec.phases.get("l"))
                .or_else(|| rec.phases.get("s"))
                .or_else(|| rec.phases.get("g"))
                .and_then(|p| p.thermo.as_ref());
            if let Some(pt) = phase_thermo {
                return pt.tier.clone();
            }
        }
    }
    ProvenanceTier::Speculative
}

#[derive(Deserialize)]
struct CoreRows {
    equilibria: Vec<GeneralEquilibrium>,
    minerals: Vec<GeneralMineral>,
    kinetics: Vec<GeneralKineticRxn>,
}

/// The hand-curated rows of `data/core_reactions.json` (no reaction is written in this file).
fn core_rows() -> &'static CoreRows {
    static ROWS: std::sync::OnceLock<CoreRows> = std::sync::OnceLock::new();
    ROWS.get_or_init(|| serde_json::from_str(include_str!("../data/core_reactions.json")).expect("data/core_reactions.json"))
}

pub fn get_default_equilibria() -> Vec<GeneralEquilibrium> {
    let mut list = core_rows().equilibria.clone();
    // Data-driven acid/base and speciation equilibria (engine/data/solubility.json).
    for eq in crate::solubility::table_equilibria() {
        if !list.iter().any(|e| e.id == eq.id) {
            list.push(eq.clone());
        }
    }
    if let Ok(lock) = CUSTOM_EQUILIBRIA.lock() {
        for eq in lock.iter() {
            list.retain(|e| e.id != eq.id);
            list.push(eq.clone());
        }
    }
    list
}

pub fn get_default_minerals() -> Vec<GeneralMineral> {
    let mut list = core_rows().minerals.clone();
    // Data-driven solubility table: any cation/anion pair with IAP > Ksp precipitates (engine/data/solubility.json).
    for m in crate::solubility::table_minerals() {
        if !list.iter().any(|x| x.solid_species == m.solid_species) {
            list.push(m.clone());
        }
    }
    if let Ok(lock) = CUSTOM_MINERALS.lock() {
        for min in lock.iter() {
            list.retain(|m| m.id != min.id && m.solid_species != min.solid_species);
            list.push(min.clone());
        }
    }
    list
}

pub fn get_default_kinetic_reactions() -> Vec<GeneralKineticRxn> {
    let mut list = core_rows().kinetics.clone();
    if let Ok(lock) = CUSTOM_KINETICS.lock() {
        for rxn in lock.iter() {
            list.retain(|r| r.id != rxn.id);
            list.push(rxn.clone());
        }
    }
    list
}

/// InChIKey of the main species of each catalog reagent (verified against the PubChem-derived bundle).
const CATALOG_INCHIKEYS: &[(&str, &str)] = &[
    ("water", "XLYOFNOQVPJJNP-UHFFFAOYSA-N"),
    ("ethanol", "LFQSCWFLJHTTHZ-UHFFFAOYSA-N"),
    ("hcl_0_1m", "VEXZGXHMUGYJMC-UHFFFAOYSA-N"),
    ("hcl_1m", "VEXZGXHMUGYJMC-UHFFFAOYSA-N"),
    ("naoh_0_1m", "HEMHJVSKTPXQMS-UHFFFAOYSA-M"),
    ("naoh_1m", "HEMHJVSKTPXQMS-UHFFFAOYSA-M"),
    ("cuso4_0_1m", "ARUVKPQLZAKDPS-UHFFFAOYSA-L"),
    ("nh3_2m", "QGZKDVFQNNGYKY-UHFFFAOYSA-N"),
    ("nahco3_s", "UIIMBOGNXHQVGW-UHFFFAOYSA-M"),
    ("ch3cooh_5pct", "QTBSBXVTEAMEQO-UHFFFAOYSA-N"),
    ("h2o2_3pct", "MHAJPDPJQMAIIY-UHFFFAOYSA-N"),
    ("mno2_s", "NUJOXMJBOLGQSY-UHFFFAOYSA-N"),
    ("ki_0_5m", "NLKNQRATVPKPDG-UHFFFAOYSA-M"),
    ("ki_0_05m", "NLKNQRATVPKPDG-UHFFFAOYSA-M"),
    ("agno3_0_1m", "SQGYOTSLMSWVJD-UHFFFAOYSA-N"),
    ("nacl_0_1m", "FAPWRFPIFSIZLT-UHFFFAOYSA-M"),
    ("cocl2_0_1m", "GVPFVAHMJGGAJG-UHFFFAOYSA-L"),
    ("kscn_0_1m", "ZNNZYHKDIALBAK-UHFFFAOYSA-M"),
    ("na2s2o3_0_002m", "AKHNMLFCWUSKQB-UHFFFAOYSA-L"),
    ("phenolphthalein_drop", "KJFMBFZCATUALV-UHFFFAOYSA-N"),
    ("mg_ribbon", "FYYHWMGAXLPEAU-UHFFFAOYSA-N"),
];

pub fn get_reagent_catalog() -> Vec<ReagentCatalogEntry> {
    let mut catalog = build_reagent_catalog();
    for e in catalog.iter_mut() {
        if e.inchi_key.is_none() {
            e.inchi_key = CATALOG_INCHIKEYS.iter().find(|(id, _)| *id == e.id).map(|(_, k)| k.to_string());
        }
    }
    catalog
}

fn build_reagent_catalog() -> Vec<ReagentCatalogEntry> {
    let mut catalog = Vec::new();

    // 1. Water
    let mut comp = HashMap::new();
    comp.insert("H2O".to_string(), 1.0 / 18.015);
    catalog.push(ReagentCatalogEntry {
        id: "water".to_string(),
        name: "Distilled Water".to_string(),
        formula: "H2O".to_string(),
        form: "liquid".to_string(),
        concentration_m: Some(55.5),
        density_g_ml: 1.000,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp,
        label: "H2O".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 2. Ethanol
    let mut comp = HashMap::new();
    comp.insert("C2H5OH".to_string(), 0.789 / 46.069);
    catalog.push(ReagentCatalogEntry {
        id: "ethanol".to_string(),
        name: "Ethanol 95%".to_string(),
        formula: "C2H5OH".to_string(),
        form: "liquid".to_string(),
        concentration_m: Some(16.3),
        density_g_ml: 0.789,
        ghs: vec!["GHS02".to_string()],
        signal_word: "Danger".to_string(),
        bottle_colour: "amber".to_string(),
        composition: comp,
        label: "C2H5OH".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 3. Hydrochloric Acid 0.1 M
    let mut comp = HashMap::new();
    comp.insert("H+".to_string(), 0.0001);
    comp.insert("Cl-".to_string(), 0.0001);
    comp.insert("H2O".to_string(), 0.0554);
    catalog.push(ReagentCatalogEntry {
        id: "hcl_0_1m".to_string(),
        name: "Hydrochloric Acid 0.10 M".to_string(),
        formula: "HCl".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.10),
        density_g_ml: 1.002,
        ghs: vec!["GHS05".to_string()],
        signal_word: "Warning".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp,
        label: "HCl (0.1 M)".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 4. Hydrochloric Acid 1.0 M
    let mut comp = HashMap::new();
    comp.insert("H+".to_string(), 0.001);
    comp.insert("Cl-".to_string(), 0.001);
    comp.insert("H2O".to_string(), 0.0545);
    catalog.push(ReagentCatalogEntry {
        id: "hcl_1m".to_string(),
        name: "Hydrochloric Acid 1.0 M".to_string(),
        formula: "HCl".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(1.0),
        density_g_ml: 1.016,
        ghs: vec!["GHS05".to_string()],
        signal_word: "Danger".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp,
        label: "HCl (1.0 M)".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 5. Sodium Hydroxide 0.1 M
    let mut comp = HashMap::new();
    comp.insert("Na+".to_string(), 0.0001);
    comp.insert("OH-".to_string(), 0.0001);
    comp.insert("H2O".to_string(), 0.0554);
    catalog.push(ReagentCatalogEntry {
        id: "naoh_0_1m".to_string(),
        name: "Sodium Hydroxide 0.10 M".to_string(),
        formula: "NaOH".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.10),
        density_g_ml: 1.004,
        ghs: vec!["GHS05".to_string()],
        signal_word: "Warning".to_string(),
        bottle_colour: "white".to_string(),
        composition: comp,
        label: "NaOH (0.1 M)".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 6. Sodium Hydroxide 1.0 M
    let mut comp = HashMap::new();
    comp.insert("Na+".to_string(), 0.001);
    comp.insert("OH-".to_string(), 0.001);
    comp.insert("H2O".to_string(), 0.0545);
    catalog.push(ReagentCatalogEntry {
        id: "naoh_1m".to_string(),
        name: "Sodium Hydroxide 1.0 M".to_string(),
        formula: "NaOH".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(1.0),
        density_g_ml: 1.040,
        ghs: vec!["GHS05".to_string()],
        signal_word: "Danger".to_string(),
        bottle_colour: "white".to_string(),
        composition: comp,
        label: "NaOH (1.0 M)".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 7. Copper(II) Sulfate 0.10 M
    let mut comp = HashMap::new();
    comp.insert("Cu+2".to_string(), 0.0001);
    comp.insert("SO4-2".to_string(), 0.00010005); // + 5e-8 mol/mL from the trace of H2SO4 below (charge balance)
    comp.insert("H+".to_string(), 0.0000001); // trace H2SO4: pH ~ 4.2 suppresses spurious precipitation (no Cu hydroxo complexes yet)
    comp.insert("H2O".to_string(), 0.0553);
    catalog.push(ReagentCatalogEntry {
        id: "cuso4_0_1m".to_string(),
        name: "Copper(II) Sulfate 0.10 M".to_string(),
        formula: "CuSO4".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.10),
        density_g_ml: 1.015,
        ghs: vec!["GHS07".to_string(), "GHS09".to_string()],
        signal_word: "Warning".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp,
        label: "CuSO4 (0.1 M)".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 8. Ammonia Solution 2.0 M
    let mut comp = HashMap::new();
    comp.insert("NH3".to_string(), 0.002);
    comp.insert("H2O".to_string(), 0.0535);
    catalog.push(ReagentCatalogEntry {
        id: "nh3_2m".to_string(),
        name: "Aqueous Ammonia 2.0 M".to_string(),
        formula: "NH3".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(2.0),
        density_g_ml: 0.985,
        ghs: vec!["GHS05".to_string(), "GHS07".to_string()],
        signal_word: "Danger".to_string(),
        bottle_colour: "amber".to_string(),
        composition: comp,
        label: "NH3 (2.0 M)".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 9. Sodium Bicarbonate Solid
    let mut comp = HashMap::new();
    comp.insert("NaHCO3(s)".to_string(), 1.0 / 84.007);
    catalog.push(ReagentCatalogEntry {
        id: "nahco3_s".to_string(),
        name: "Sodium Bicarbonate (Powder)".to_string(),
        formula: "NaHCO3".to_string(),
        form: "solid".to_string(),
        concentration_m: None,
        density_g_ml: 2.20,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "white".to_string(),
        composition: comp,
        label: "NaHCO3".to_string(),
        by_mass: true,
        dropper: None,
        inchi_key: None,
    });

    // 10. Acetic Acid 5% (0.83 M) Vinegar
    let mut comp = HashMap::new();
    comp.insert("CH3COOH".to_string(), 0.00083);
    comp.insert("H2O".to_string(), 0.0548);
    catalog.push(ReagentCatalogEntry {
        id: "ch3cooh_5pct".to_string(),
        name: "Acetic Acid 5% (0.83 M)".to_string(),
        formula: "CH3COOH".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.83),
        density_g_ml: 1.006,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp,
        label: "CH3COOH 5%".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 11. Hydrogen Peroxide 3% (0.88 M)
    let mut comp = HashMap::new();
    comp.insert("H2O2".to_string(), 0.00088);
    comp.insert("H2O".to_string(), 0.0545);
    catalog.push(ReagentCatalogEntry {
        id: "h2o2_3pct".to_string(),
        name: "Hydrogen Peroxide 3% (0.88 M)".to_string(),
        formula: "H2O2".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.88),
        density_g_ml: 1.010,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "amber".to_string(),
        composition: comp,
        label: "H2O2 3%".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 12. Manganese Dioxide Solid
    let mut comp = HashMap::new();
    comp.insert("MnO2(s)".to_string(), 1.0 / 86.937);
    catalog.push(ReagentCatalogEntry {
        id: "mno2_s".to_string(),
        name: "Manganese(IV) Dioxide (Powder)".to_string(),
        formula: "MnO2".to_string(),
        form: "solid".to_string(),
        concentration_m: None,
        density_g_ml: 5.03,
        ghs: vec!["GHS07".to_string()],
        signal_word: "Warning".to_string(),
        bottle_colour: "amber".to_string(),
        composition: comp,
        label: "MnO2".to_string(),
        by_mass: true,
        dropper: None,
        inchi_key: None,
    });

    // 13. Potassium Iodide 0.5 M
    let mut comp = HashMap::new();
    comp.insert("K+".to_string(), 0.0005);
    comp.insert("I-".to_string(), 0.0005);
    comp.insert("H2O".to_string(), 0.0545);
    catalog.push(ReagentCatalogEntry {
        id: "ki_0_5m".to_string(),
        name: "Potassium Iodide 0.50 M".to_string(),
        formula: "KI".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.50),
        density_g_ml: 1.060,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "amber".to_string(),
        composition: comp,
        label: "KI (0.5 M)".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 14. Silver Nitrate 0.10 M
    let mut comp = HashMap::new();
    comp.insert("Ag+".to_string(), 0.0001);
    comp.insert("NO3-".to_string(), 0.0001);
    comp.insert("H2O".to_string(), 0.0553);
    catalog.push(ReagentCatalogEntry {
        id: "agno3_0_1m".to_string(),
        name: "Silver Nitrate 0.10 M".to_string(),
        formula: "AgNO3".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.10),
        density_g_ml: 1.012,
        ghs: vec!["GHS05".to_string(), "GHS09".to_string()],
        signal_word: "Danger".to_string(),
        bottle_colour: "amber".to_string(),
        composition: comp,
        label: "AgNO3 (0.1 M)".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 15. Sodium Chloride 0.10 M
    let mut comp = HashMap::new();
    comp.insert("Na+".to_string(), 0.0001);
    comp.insert("Cl-".to_string(), 0.0001);
    comp.insert("H2O".to_string(), 0.0554);
    catalog.push(ReagentCatalogEntry {
        id: "nacl_0_1m".to_string(),
        name: "Sodium Chloride 0.10 M".to_string(),
        formula: "NaCl".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.10),
        density_g_ml: 1.004,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp,
        label: "NaCl (0.1 M)".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 16. Cobalt(II) Chloride 0.10 M
    let mut comp = HashMap::new();
    comp.insert("Co+2".to_string(), 0.0001);
    comp.insert("Cl-".to_string(), 0.0002);
    comp.insert("H2O".to_string(), 0.0553);
    catalog.push(ReagentCatalogEntry {
        id: "cocl2_0_1m".to_string(),
        name: "Cobalt(II) Chloride 0.10 M".to_string(),
        formula: "CoCl2".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.10),
        density_g_ml: 1.010,
        ghs: vec!["GHS08".to_string(), "GHS09".to_string()],
        signal_word: "Danger".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp,
        label: "CoCl2 (0.1 M)".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 17. Cobalt(II) Chloride in 10 M Chloride
    let mut comp = HashMap::new();
    comp.insert("Co+2".to_string(), 0.0001);
    comp.insert("Cl-".to_string(), 0.010);
    comp.insert("H+".to_string(), 0.0098);
    comp.insert("H2O".to_string(), 0.045);
    catalog.push(ReagentCatalogEntry {
        id: "cocl2_10m_cl".to_string(),
        name: "Cobalt(II) in 10 M Chloride".to_string(),
        formula: "CoCl2 / HCl".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.10),
        density_g_ml: 1.150,
        ghs: vec!["GHS05".to_string(), "GHS08".to_string()],
        signal_word: "Danger".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp,
        label: "Co(II) / 10M Cl-".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 18. Iron(III) Nitrate 0.10 M
    let mut comp = HashMap::new();
    comp.insert("Fe+3".to_string(), 0.0001);
    comp.insert("NO3-".to_string(), 0.0003);
    comp.insert("H2O".to_string(), 0.0550);
    catalog.push(ReagentCatalogEntry {
        id: "fe_no3_3_0_1m".to_string(),
        name: "Iron(III) Nitrate 0.10 M".to_string(),
        formula: "Fe(NO3)3".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.10),
        density_g_ml: 1.020,
        ghs: vec!["GHS05".to_string()],
        signal_word: "Warning".to_string(),
        bottle_colour: "amber".to_string(),
        composition: comp,
        label: "Fe(NO3)3 (0.1 M)".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 19. Potassium Thiocyanate 0.10 M
    let mut comp = HashMap::new();
    comp.insert("K+".to_string(), 0.0001);
    comp.insert("SCN-".to_string(), 0.0001);
    comp.insert("H2O".to_string(), 0.0553);
    catalog.push(ReagentCatalogEntry {
        id: "kscn_0_1m".to_string(),
        name: "Potassium Thiocyanate 0.10 M".to_string(),
        formula: "KSCN".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.10),
        density_g_ml: 1.005,
        ghs: vec!["GHS07".to_string()],
        signal_word: "Warning".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp,
        label: "KSCN (0.1 M)".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 20. Potassium Persulfate 0.04 M
    let mut comp = HashMap::new();
    comp.insert("S2O8-2".to_string(), 0.00004);
    comp.insert("K+".to_string(), 0.00008);
    comp.insert("H2O".to_string(), 0.0554);
    catalog.push(ReagentCatalogEntry {
        id: "s2o8_0_04m".to_string(),
        name: "Potassium Persulfate 0.040 M".to_string(),
        formula: "K2S2O8".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.04),
        density_g_ml: 1.005,
        ghs: vec!["GHS03".to_string(), "GHS07".to_string()],
        signal_word: "Warning".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp,
        label: "K2S2O8 (0.04 M)".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 21. Potassium Iodide 0.05 M
    let mut comp = HashMap::new();
    comp.insert("K+".to_string(), 0.00005);
    comp.insert("I-".to_string(), 0.00005);
    comp.insert("H2O".to_string(), 0.0554);
    catalog.push(ReagentCatalogEntry {
        id: "ki_0_05m".to_string(),
        name: "Potassium Iodide 0.050 M".to_string(),
        formula: "KI".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.05),
        density_g_ml: 1.005,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "amber".to_string(),
        composition: comp,
        label: "KI (0.05 M)".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 22. Sodium Thiosulfate 0.002 M
    let mut comp = HashMap::new();
    comp.insert("S2O3-2".to_string(), 0.000002);
    comp.insert("Na+".to_string(), 0.000004);
    comp.insert("H2O".to_string(), 0.0555);
    catalog.push(ReagentCatalogEntry {
        id: "na2s2o3_0_002m".to_string(),
        name: "Sodium Thiosulfate 0.0020 M".to_string(),
        formula: "Na2S2O3".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.002),
        density_g_ml: 1.000,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp,
        label: "Na2S2O3 (2 mM)".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });

    // 23. Starch Indicator Solution
    let mut comp = HashMap::new();
    comp.insert("starch".to_string(), 0.0001);
    comp.insert("H2O".to_string(), 0.0555);
    catalog.push(ReagentCatalogEntry {
        id: "starch_sol".to_string(),
        name: "Starch Indicator 1%".to_string(),
        formula: "(C6H10O5)n".to_string(),
        form: "solution".to_string(),
        concentration_m: None,
        density_g_ml: 1.000,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp,
        label: "Starch 1%".to_string(),
        by_mass: false,
        dropper: Some(true),
        inchi_key: None,
    });

    // 24. Phenolphthalein Indicator
    let mut comp = HashMap::new();
    comp.insert("HIn_phph".to_string(), 0.00003);
    comp.insert("C2H5OH".to_string(), 0.008);
    comp.insert("H2O".to_string(), 0.030);
    catalog.push(ReagentCatalogEntry {
        id: "phenolphthalein_drop".to_string(),
        name: "Phenolphthalein 1% (Dropper)".to_string(),
        formula: "C20H14O4".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.03),
        density_g_ml: 0.920,
        ghs: vec!["GHS02".to_string(), "GHS08".to_string()],
        signal_word: "Danger".to_string(),
        bottle_colour: "amber".to_string(),
        composition: comp,
        label: "Phenolphthalein".to_string(),
        by_mass: false,
        dropper: Some(true),
        inchi_key: None,
    });

    // 25. Bromothymol Blue Indicator
    let mut comp = HashMap::new();
    comp.insert("HIn_btb".to_string(), 0.00002);
    comp.insert("H2O".to_string(), 0.0555);
    catalog.push(ReagentCatalogEntry {
        id: "bromothymol_blue_drop".to_string(),
        name: "Bromothymol Blue (Dropper)".to_string(),
        formula: "C27H28Br2O5S".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.02),
        density_g_ml: 1.000,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "amber".to_string(),
        composition: comp,
        label: "Bromothymol Blue".to_string(),
        by_mass: false,
        dropper: Some(true),
        inchi_key: None,
    });

    // 26. Methyl Orange Indicator
    let mut comp = HashMap::new();
    comp.insert("HIn_mo".to_string(), 0.00003);
    comp.insert("H2O".to_string(), 0.0555);
    catalog.push(ReagentCatalogEntry {
        id: "methyl_orange_drop".to_string(),
        name: "Methyl Orange (Dropper)".to_string(),
        formula: "C14H14N3NaO3S".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.03),
        density_g_ml: 1.000,
        ghs: vec!["GHS06".to_string()],
        signal_word: "Danger".to_string(),
        bottle_colour: "amber".to_string(),
        composition: comp,
        label: "Methyl Orange".to_string(),
        by_mass: false,
        dropper: Some(true),
        inchi_key: None,
    });

    // 26b. Methyl Red Indicator (0.1 % w/v = 3.7 mM; red below pH 4.4, yellow above 6.2)
    let mut comp = HashMap::new();
    comp.insert("HIn_mr".to_string(), 0.0000037);
    comp.insert("H2O".to_string(), 0.0555);
    catalog.push(ReagentCatalogEntry {
        id: "methyl_red_drop".to_string(),
        name: "Methyl Red (Dropper)".to_string(),
        formula: "C15H15N3O2".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.0037),
        density_g_ml: 1.000,
        ghs: vec!["GHS07".to_string()],
        signal_word: "Warning".to_string(),
        bottle_colour: "amber".to_string(),
        composition: comp,
        label: "Methyl Red".to_string(),
        by_mass: false,
        dropper: Some(true),
        inchi_key: None,
    });

    // 27. Magnesium Metal Ribbon
    let mut comp = HashMap::new();
    comp.insert("Mg(s)".to_string(), 1.0 / 24.305);
    catalog.push(ReagentCatalogEntry {
        id: "mg_ribbon".to_string(),
        name: "Magnesium Ribbon".to_string(),
        formula: "Mg".to_string(),
        form: "solid".to_string(),
        concentration_m: None,
        density_g_ml: 1.74,
        ghs: vec!["GHS02".to_string()],
        signal_word: "Danger".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp,
        label: "Mg Ribbon".to_string(),
        by_mass: true,
        dropper: None,
        inchi_key: None,
    });

    if let Ok(lock) = CUSTOM_REAGENTS.lock() {
        for reagent in lock.iter() {
            catalog.retain(|r| r.id != reagent.id);
            catalog.push(reagent.clone());
        }
    }

    catalog
}
