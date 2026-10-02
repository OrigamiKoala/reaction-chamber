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
    pub tier: ProvenanceTier,
    pub source: String,
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

#[derive(Clone, Copy, Debug)]
pub struct SpeciesThermo {
    pub mw: f64,
    pub charge: i32,
    pub delta_h_f: f64, // kJ/mol
    pub cp: f64,        // J/(mol·K)
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

fn species_thermo_table(species: &str) -> Option<SpeciesThermo> {
    match species {
        "H+" => Some(SpeciesThermo { mw: 1.008, charge: 1, delta_h_f: 0.0, cp: 0.0 }),
        "OH-" => Some(SpeciesThermo { mw: 17.007, charge: -1, delta_h_f: -230.0, cp: -148.5 }),
        "H2O" => Some(SpeciesThermo { mw: 18.015, charge: 0, delta_h_f: -285.83, cp: 75.38 }),
        "Na+" => Some(SpeciesThermo { mw: 22.990, charge: 1, delta_h_f: -240.1, cp: 46.4 }),
        "K+" => Some(SpeciesThermo { mw: 39.098, charge: 1, delta_h_f: -252.4, cp: 21.8 }),
        "Cl-" => Some(SpeciesThermo { mw: 35.453, charge: -1, delta_h_f: -167.2, cp: -136.4 }),
        "SO4-2" => Some(SpeciesThermo { mw: 96.06, charge: -2, delta_h_f: -909.3, cp: -293.0 }),
        "NO3-" => Some(SpeciesThermo { mw: 62.00, charge: -1, delta_h_f: -205.0, cp: -86.6 }),
        "Cu+2" => Some(SpeciesThermo { mw: 63.546, charge: 2, delta_h_f: 64.8, cp: -99.6 }),
        "Cu(NH3)4+2" => Some(SpeciesThermo { mw: 131.67, charge: 2, delta_h_f: -347.0, cp: 250.0 }),
        "NH3" => Some(SpeciesThermo { mw: 17.031, charge: 0, delta_h_f: -80.3, cp: 80.0 }),
        "NH4+" => Some(SpeciesThermo { mw: 18.039, charge: 1, delta_h_f: -132.5, cp: 79.9 }),
        "Ag+" => Some(SpeciesThermo { mw: 107.868, charge: 1, delta_h_f: 105.6, cp: 77.0 }),
        "Ag(NH3)2+" => Some(SpeciesThermo { mw: 141.93, charge: 1, delta_h_f: -111.0, cp: 180.0 }),
        "CO3-2" => Some(SpeciesThermo { mw: 60.01, charge: -2, delta_h_f: -677.1, cp: -50.0 }),
        "HCO3-" => Some(SpeciesThermo { mw: 61.017, charge: -1, delta_h_f: -692.0, cp: 112.0 }),
        "CO2(aq)" => Some(SpeciesThermo { mw: 44.01, charge: 0, delta_h_f: -413.8, cp: 243.0 }),
        "CH3COOH" => Some(SpeciesThermo { mw: 60.052, charge: 0, delta_h_f: -484.5, cp: 124.0 }),
        "CH3COO-" => Some(SpeciesThermo { mw: 59.044, charge: -1, delta_h_f: -486.0, cp: 80.0 }),
        "Fe+3" => Some(SpeciesThermo { mw: 55.845, charge: 3, delta_h_f: -48.5, cp: 150.0 }),
        "Fe(SCN)+2" => Some(SpeciesThermo { mw: 113.92, charge: 2, delta_h_f: 30.0, cp: 200.0 }),
        "SCN-" => Some(SpeciesThermo { mw: 58.08, charge: -1, delta_h_f: 76.4, cp: 40.0 }),
        "Co+2" | "Co(H2O)6+2" => Some(SpeciesThermo { mw: 58.933, charge: 2, delta_h_f: -58.2, cp: 110.0 }),
        "CoCl4-2" => Some(SpeciesThermo { mw: 200.75, charge: -2, delta_h_f: -8.0, cp: 280.0 }),
        "I-" => Some(SpeciesThermo { mw: 126.904, charge: -1, delta_h_f: -55.2, cp: -142.3 }),
        "I3-" => Some(SpeciesThermo { mw: 380.71, charge: -1, delta_h_f: -51.5, cp: 120.0 }),
        "I2(aq)" => Some(SpeciesThermo { mw: 253.808, charge: 0, delta_h_f: 22.6, cp: 116.0 }),
        "S2O8-2" => Some(SpeciesThermo { mw: 192.12, charge: -2, delta_h_f: -1345.0, cp: 280.0 }),
        "S2O3-2" => Some(SpeciesThermo { mw: 112.13, charge: -2, delta_h_f: -648.5, cp: 150.0 }),
        "S4O6-2" => Some(SpeciesThermo { mw: 224.26, charge: -2, delta_h_f: -1224.0, cp: 300.0 }),
        "H2O2" => Some(SpeciesThermo { mw: 34.015, charge: 0, delta_h_f: -191.17, cp: 89.0 }),
        "O2(aq)" => Some(SpeciesThermo { mw: 31.999, charge: 0, delta_h_f: -11.7, cp: 45.0 }),
        "Mg+2" => Some(SpeciesThermo { mw: 24.305, charge: 2, delta_h_f: -466.85, cp: -118.0 }),
        "MnO4-" => Some(SpeciesThermo { mw: 118.94, charge: -1, delta_h_f: -541.4, cp: 117.0 }),
        "Cr2O7-2" => Some(SpeciesThermo { mw: 215.99, charge: -2, delta_h_f: -1490.3, cp: 220.0 }),
        "CrO4-2" => Some(SpeciesThermo { mw: 115.99, charge: -2, delta_h_f: -881.2, cp: 110.0 }),
        "HIn_phph" => Some(SpeciesThermo { mw: 318.32, charge: 0, delta_h_f: -500.0, cp: 300.0 }),
        "In_phph-" => Some(SpeciesThermo { mw: 317.32, charge: -1, delta_h_f: -450.0, cp: 300.0 }),
        "starch" => Some(SpeciesThermo { mw: 162.14, charge: 0, delta_h_f: -800.0, cp: 200.0 }),
        "starch_I3" => Some(SpeciesThermo { mw: 542.85, charge: -1, delta_h_f: -860.0, cp: 320.0 }),
        "HIn_btb" => Some(SpeciesThermo { mw: 624.38, charge: 0, delta_h_f: -600.0, cp: 400.0 }),
        "In_btb-" => Some(SpeciesThermo { mw: 623.37, charge: -1, delta_h_f: -560.0, cp: 400.0 }),
        "HIn_mo" => Some(SpeciesThermo { mw: 327.33, charge: 0, delta_h_f: -200.0, cp: 300.0 }),
        "In_mo-" => Some(SpeciesThermo { mw: 326.32, charge: -1, delta_h_f: -170.0, cp: 300.0 }),
        "HIn_mr" => Some(SpeciesThermo { mw: 269.30, charge: 0, delta_h_f: -120.0, cp: 300.0 }),
        "In_mr-" => Some(SpeciesThermo { mw: 268.29, charge: -1, delta_h_f: -95.0, cp: 300.0 }),
        "C2H5OH" => Some(SpeciesThermo { mw: 46.069, charge: 0, delta_h_f: -277.69, cp: 112.3 }),

        // Solids
        "AgCl(s)" => Some(SpeciesThermo { mw: 143.32, charge: 0, delta_h_f: -127.07, cp: 50.8 }),
        "Cu(OH)2(s)" => Some(SpeciesThermo { mw: 97.561, charge: 0, delta_h_f: -450.0, cp: 96.0 }),
        "NaHCO3(s)" => Some(SpeciesThermo { mw: 84.007, charge: 0, delta_h_f: -950.8, cp: 87.6 }),
        "MnO2(s)" => Some(SpeciesThermo { mw: 86.937, charge: 0, delta_h_f: -520.0, cp: 54.1 }),
        "Mg(s)" => Some(SpeciesThermo { mw: 24.305, charge: 0, delta_h_f: 0.0, cp: 24.89 }),
        "CoCl2(s)" => Some(SpeciesThermo { mw: 129.84, charge: 0, delta_h_f: -312.5, cp: 78.5 }),
        "NaCl(s)" => Some(SpeciesThermo { mw: 58.443, charge: 0, delta_h_f: -411.15, cp: 50.5 }),
        "NaOH(s)" => Some(SpeciesThermo { mw: 39.997, charge: 0, delta_h_f: -425.61, cp: 59.5 }),
        "KI(s)" => Some(SpeciesThermo { mw: 166.00, charge: 0, delta_h_f: -327.9, cp: 52.9 }),
        "CaCO3(s)" => Some(SpeciesThermo { mw: 100.087, charge: 0, delta_h_f: -1207.6, cp: 81.9 }),
        "BaSO4(s)" => Some(SpeciesThermo { mw: 233.39, charge: 0, delta_h_f: -1473.2, cp: 101.8 }),
        "Fe(OH)3(s)" => Some(SpeciesThermo { mw: 106.87, charge: 0, delta_h_f: -823.0, cp: 105.0 }),

        // Gases
        "CO2(g)" => Some(SpeciesThermo { mw: 44.01, charge: 0, delta_h_f: -393.51, cp: 37.1 }),
        "O2(g)" => Some(SpeciesThermo { mw: 31.999, charge: 0, delta_h_f: 0.0, cp: 29.4 }),
        "H2(g)" => Some(SpeciesThermo { mw: 2.016, charge: 0, delta_h_f: 0.0, cp: 28.8 }),
        "NH3(g)" => Some(SpeciesThermo { mw: 17.031, charge: 0, delta_h_f: -46.11, cp: 35.1 }),
        "HCl(g)" => Some(SpeciesThermo { mw: 35.453, charge: 0, delta_h_f: -92.31, cp: 29.1 }),
        "N2(g)" => Some(SpeciesThermo { mw: 28.013, charge: 0, delta_h_f: 0.0, cp: 29.1 }),
        "H2O(g)" => Some(SpeciesThermo { mw: 18.015, charge: 0, delta_h_f: -241.82, cp: 33.6 }),
        "C2H5OH(g)" => Some(SpeciesThermo { mw: 46.069, charge: 0, delta_h_f: -235.3, cp: 65.4 }),

        _ => None,
    }
}

/// Thermo record of a species: checks SpeciesStore, then table entry, else a general estimate from the formula
/// (mass and charge are real; ΔfH° and Cp are placeholders, so `species_thermo_tier` reports Speculative, and queues a PropertyRequest).
pub fn get_species_thermo(species: &str) -> SpeciesThermo {
    if let Ok(store) = crate::db::SpeciesStore::global().read() {
        if let Some(rec) = store.get(species) {
            let charge = rec.charge();
            let mw = rec.mw();
            let phase_thermo = rec.phases.get("aq")
                .or_else(|| rec.phases.get("l"))
                .or_else(|| rec.phases.get("s"))
                .or_else(|| rec.phases.get("g"))
                .and_then(|p| p.thermo.as_ref());
            let (dfh, cp) = if let Some(pt) = phase_thermo {
                (
                    pt.dfH.as_ref().map(|d| d.value).unwrap_or(-100.0),
                    pt.cp.as_ref().map(|d| d.value).unwrap_or(50.0),
                )
            } else {
                (-100.0, 50.0)
            };
            return SpeciesThermo { mw, charge, delta_h_f: dfh, cp };
        }
    }

    if let Some(t) = species_thermo_table(species) {
        return t;
    }
    // General estimator from the formula: full periodic table for the mass, charge parsed from the id.
    let mw = crate::ions::species_mass(species).filter(|m| *m > 0.5).unwrap_or(50.0);
    let charge = crate::ions::species_charge(species);

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
        reason: format!("Fallback thermo estimation for {}", species),
        current_tier: ProvenanceTier::Speculative,
    });

    SpeciesThermo {
        mw,
        charge,
        delta_h_f: -100.0,
        cp: 50.0,
    }
}

/// Provenance of the thermo record `get_species_thermo` returns: Tabulated for a table entry or store entry, Speculative for the
/// placeholder estimate (the mass and charge of such a species are still exact; its enthalpy and heat capacity are not).
pub fn species_thermo_tier(species: &str) -> ProvenanceTier {
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
    if species_thermo_table(species).is_some() {
        ProvenanceTier::Tabulated
    } else {
        ProvenanceTier::Speculative
    }
}

pub fn get_default_equilibria() -> Vec<GeneralEquilibrium> {
    let mut list = vec![
        // 1. Water autoionization
        GeneralEquilibrium {
            id: "water_autoionization".to_string(),
            name: "Water autoionization".to_string(),
            equation: "H2O <=> H+ + OH-".to_string(),
            reactants: [("H2O".to_string(), 1.0)].into(),
            products: [("H+".to_string(), 1.0), ("OH-".to_string(), 1.0)].into(),
            log_k_298: -14.00,
            delta_h_kj: 55.84,
            log_k_analytic: Some(WATER_KW_ANALYTIC),
            tier: ProvenanceTier::Tabulated,
            source: "PHREEQC phreeqc.dat (analytical expression for Kw, 0-300 C)".to_string(),
        },
        // 2. Acetic acid dissociation
        GeneralEquilibrium {
            id: "acetic_acid_dissoc".to_string(),
            name: "Acetic acid dissociation".to_string(),
            equation: "CH3COOH <=> H+ + CH3COO-".to_string(),
            reactants: [("CH3COOH".to_string(), 1.0)].into(),
            products: [("H+".to_string(), 1.0), ("CH3COO-".to_string(), 1.0)].into(),
            log_k_298: -4.756,
            delta_h_kj: -0.41,
            log_k_analytic: None,
            tier: ProvenanceTier::Tabulated,
            source: "IUPAC pKa Dataset".to_string(),
        },
        // 3. Carbonic acid 1st dissociation
        GeneralEquilibrium {
            id: "carbonic_acid_dissoc1".to_string(),
            name: "Carbonic acid 1st dissociation".to_string(),
            equation: "CO2(aq) + H2O <=> H+ + HCO3-".to_string(),
            reactants: [("CO2(aq)".to_string(), 1.0), ("H2O".to_string(), 1.0)].into(),
            products: [("H+".to_string(), 1.0), ("HCO3-".to_string(), 1.0)].into(),
            log_k_298: -6.35,
            delta_h_kj: 9.16,
            log_k_analytic: None,
            tier: ProvenanceTier::Tabulated,
            source: "PHREEQC core".to_string(),
        },
        // 4. Bicarbonate 2nd dissociation
        GeneralEquilibrium {
            id: "bicarbonate_dissoc2".to_string(),
            name: "Bicarbonate 2nd dissociation".to_string(),
            equation: "HCO3- <=> H+ + CO3-2".to_string(),
            reactants: [("HCO3-".to_string(), 1.0)].into(),
            products: [("H+".to_string(), 1.0), ("CO3-2".to_string(), 1.0)].into(),
            log_k_298: -10.33,
            delta_h_kj: 14.85,
            log_k_analytic: None,
            tier: ProvenanceTier::Tabulated,
            source: "PHREEQC core".to_string(),
        },
        // 5. Ammonia aqueous hydrolysis
        GeneralEquilibrium {
            id: "ammonia_hydrolysis".to_string(),
            name: "Ammonia aqueous hydrolysis".to_string(),
            equation: "NH3 + H2O <=> NH4+ + OH-".to_string(),
            reactants: [("NH3".to_string(), 1.0), ("H2O".to_string(), 1.0)].into(),
            products: [("NH4+".to_string(), 1.0), ("OH-".to_string(), 1.0)].into(),
            log_k_298: -4.75,
            delta_h_kj: 3.64,
            log_k_analytic: None,
            tier: ProvenanceTier::Tabulated,
            source: "PHREEQC core".to_string(),
        },
        // 6. Copper tetraammine complexation
        GeneralEquilibrium {
            id: "copper_tetraammine".to_string(),
            name: "Tetraamminecopper(II) formation".to_string(),
            equation: "Cu+2 + 4 NH3 <=> Cu(NH3)4+2".to_string(),
            reactants: [("Cu+2".to_string(), 1.0), ("NH3".to_string(), 4.0)].into(),
            products: [("Cu(NH3)4+2".to_string(), 1.0)].into(),
            log_k_298: 13.8,
            delta_h_kj: -88.0,
            log_k_analytic: None,
            tier: ProvenanceTier::Tabulated,
            source: "Critical Stability Constants (Smith & Martell)".to_string(),
        },
        // 7. Silver diammines complexation
        GeneralEquilibrium {
            id: "silver_diammine".to_string(),
            name: "Diamminesilver(I) formation".to_string(),
            equation: "Ag+ + 2 NH3 <=> Ag(NH3)2+".to_string(),
            reactants: [("Ag+".to_string(), 1.0), ("NH3".to_string(), 2.0)].into(),
            products: [("Ag(NH3)2+".to_string(), 1.0)].into(),
            log_k_298: 7.40,
            delta_h_kj: -56.1,
            log_k_analytic: None,
            tier: ProvenanceTier::Tabulated,
            source: "Critical Stability Constants".to_string(),
        },
        // 8. Iron(III) thiocyanate complexation
        GeneralEquilibrium {
            id: "iron_thiocyanate".to_string(),
            name: "Iron(III) thiocyanate complexation".to_string(),
            equation: "Fe+3 + SCN- <=> Fe(SCN)+2".to_string(),
            reactants: [("Fe+3".to_string(), 1.0), ("SCN-".to_string(), 1.0)].into(),
            products: [("Fe(SCN)+2".to_string(), 1.0)].into(),
            log_k_298: 2.301, // K1 = 200.0 M^-1
            delta_h_kj: -26.0,
            log_k_analytic: None,
            tier: ProvenanceTier::Tabulated,
            source: "IUPAC Stability Constants".to_string(),
        },
        // 9. Cobalt(II) chloride thermochromic complexation
        GeneralEquilibrium {
            id: "cobalt_tetrachloro".to_string(),
            name: "Tetrachlorocobaltate(II) formation".to_string(),
            equation: "Co+2 + 4 Cl- <=> CoCl4-2".to_string(),
            reactants: [("Co+2".to_string(), 1.0), ("Cl-".to_string(), 4.0)].into(),
            products: [("CoCl4-2".to_string(), 1.0)].into(),
            log_k_298: -4.0, // effective K in aqueous chloride
            delta_h_kj: 50.0, // endothermic => turns blue on heating
            log_k_analytic: None,
            tier: ProvenanceTier::Tabulated,
            source: "J. Chem. Educ. Thermochromic Cobalt System".to_string(),
        },
        // 10. Triiodide equilibrium
        GeneralEquilibrium {
            id: "triiodide_formation".to_string(),
            name: "Triiodide formation".to_string(),
            equation: "I2(aq) + I- <=> I3-".to_string(),
            reactants: [("I2(aq)".to_string(), 1.0), ("I-".to_string(), 1.0)].into(),
            products: [("I3-".to_string(), 1.0)].into(),
            log_k_298: 2.85, // K ~ 710 M^-1
            delta_h_kj: -17.0,
            log_k_analytic: None,
            tier: ProvenanceTier::Tabulated,
            source: "IUPAC Stability Constants".to_string(),
        },
        // 11. Starch-triiodide complexation
        GeneralEquilibrium {
            id: "starch_triiodide_formation".to_string(),
            name: "Starch-triiodide complexation".to_string(),
            equation: "I3- + starch <=> starch_I3".to_string(),
            reactants: [("I3-".to_string(), 1.0), ("starch".to_string(), 1.0)].into(),
            products: [("starch_I3".to_string(), 1.0)].into(),
            log_k_298: 4.5,
            delta_h_kj: -30.0,
            log_k_analytic: None,
            tier: ProvenanceTier::Tabulated,
            source: "J. Am. Chem. Soc. Starch-Iodine Complex".to_string(),
        },
        // 12. Phenolphthalein indicator equilibrium
        GeneralEquilibrium {
            id: "phenolphthalein_indicator".to_string(),
            name: "Phenolphthalein lactone to coloured anion (one H+; balanced pseudo-species)".to_string(),
            equation: "HIn_phph <=> In_phph- + H+".to_string(),
            reactants: [("HIn_phph".to_string(), 1.0)].into(),
            products: [("In_phph-".to_string(), 1.0), ("H+".to_string(), 1.0)].into(),
            log_k_298: -9.30,
            delta_h_kj: 12.0,
            log_k_analytic: None,
            tier: ProvenanceTier::Tabulated,
            source: "IUPAC Indicator pKa".to_string(),
        },
        // 13. Bromothymol blue indicator equilibrium
        GeneralEquilibrium {
            id: "btb_indicator".to_string(),
            name: "Bromothymol blue dissociation".to_string(),
            equation: "HIn_btb <=> In_btb- + H+".to_string(),
            reactants: [("HIn_btb".to_string(), 1.0)].into(),
            products: [("In_btb-".to_string(), 1.0), ("H+".to_string(), 1.0)].into(),
            log_k_298: -7.00,
            delta_h_kj: 10.0,
            log_k_analytic: None,
            tier: ProvenanceTier::Tabulated,
            source: "IUPAC Indicator pKa".to_string(),
        },
        // 14. Methyl orange indicator equilibrium
        GeneralEquilibrium {
            id: "mo_indicator".to_string(),
            name: "Methyl orange dissociation".to_string(),
            equation: "HIn_mo <=> In_mo- + H+".to_string(),
            reactants: [("HIn_mo".to_string(), 1.0)].into(),
            products: [("In_mo-".to_string(), 1.0), ("H+".to_string(), 1.0)].into(),
            log_k_298: -3.70,
            delta_h_kj: 8.0,
            log_k_analytic: None,
            tier: ProvenanceTier::Tabulated,
            source: "IUPAC Indicator pKa".to_string(),
        },
        // 15. Methyl red indicator equilibrium (red acid form, yellow base form)
        GeneralEquilibrium {
            id: "mr_indicator".to_string(),
            name: "Methyl red dissociation".to_string(),
            equation: "HIn_mr <=> In_mr- + H+".to_string(),
            reactants: [("HIn_mr".to_string(), 1.0)].into(),
            products: [("In_mr-".to_string(), 1.0), ("H+".to_string(), 1.0)].into(),
            log_k_298: -5.00,
            delta_h_kj: 8.0,
            log_k_analytic: None,
            tier: ProvenanceTier::Tabulated,
            source: "IUPAC Indicator pKa".to_string(),
        },
    ];
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
    let mut list = vec![
        // 1. AgCl (Chlorargyrite)
        GeneralMineral {
            id: "AgCl_ppt".to_string(),
            mineral: "Chlorargyrite".to_string(),
            formula: "AgCl".to_string(),
            solid_species: "AgCl(s)".to_string(),
            dissolved_products: [("Ag+".to_string(), 1.0), ("Cl-".to_string(), 1.0)].into(),
            log_ksp_298: -9.752, // Ksp = 1.77e-10
            delta_h_kj: 65.7,
            log_ksp_analytic: Some([2.671219, -0.007312, -3053.408327, 0.0, 0.0]),
            solid_color: [0.95, 0.95, 0.95],
            density_g_ml: 5.56,
            default_particle_um: 2.0,
            kind: "curds".to_string(),
            tier: ProvenanceTier::Tabulated,
            source: "PHREEQC core".to_string(),
        },
        // 2. Cu(OH)2
        GeneralMineral {
            id: "CuOH2_ppt".to_string(),
            mineral: "Copper(II) Hydroxide".to_string(),
            formula: "Cu(OH)2".to_string(),
            solid_species: "Cu(OH)2(s)".to_string(),
            dissolved_products: [("Cu+2".to_string(), 1.0), ("OH-".to_string(), 2.0)].into(),
            log_ksp_298: -18.60, // Active amorphous precipitate (PHREEQC minteq.v4.dat)
            delta_h_kj: 54.0,
            log_ksp_analytic: None,
            solid_color: [0.35, 0.65, 0.88],
            density_g_ml: 3.37,
            default_particle_um: 5.0,
            kind: "gel".to_string(),
            tier: ProvenanceTier::Tabulated,
            source: "PHREEQC minteq.v4.dat".to_string(),
        },
        // 3. NaHCO3
        GeneralMineral {
            id: "NaHCO3_sol".to_string(),
            mineral: "Nahcolite (Sodium Bicarbonate)".to_string(),
            formula: "NaHCO3".to_string(),
            solid_species: "NaHCO3(s)".to_string(),
            dissolved_products: [("Na+".to_string(), 1.0), ("HCO3-".to_string(), 1.0)].into(),
            log_ksp_298: 0.15, // Soluble up to ~ 1.1 M
            delta_h_kj: 16.5,
            log_ksp_analytic: None,
            solid_color: [0.95, 0.95, 0.95],
            density_g_ml: 2.20,
            default_particle_um: 50.0,
            kind: "powder".to_string(),
            tier: ProvenanceTier::Tabulated,
            source: "PHREEQC core".to_string(),
        },
        // 4. MnO2
        GeneralMineral {
            id: "MnO2_sol".to_string(),
            mineral: "Pyrolusite".to_string(),
            formula: "MnO2".to_string(),
            solid_species: "MnO2(s)".to_string(),
            dissolved_products: HashMap::new(), // Insoluble heterogeneous catalyst
            log_ksp_298: -50.0,
            delta_h_kj: 0.0,
            log_ksp_analytic: None,
            solid_color: [0.08, 0.08, 0.08],
            density_g_ml: 5.03,
            default_particle_um: 10.0,
            kind: "powder".to_string(),
            tier: ProvenanceTier::Tabulated,
            source: "CRC Handbook".to_string(),
        },
        // 5. Magnesium metal
        GeneralMineral {
            id: "Mg_metal".to_string(),
            mineral: "Magnesium Metal".to_string(),
            formula: "Mg".to_string(),
            solid_species: "Mg(s)".to_string(),
            dissolved_products: HashMap::new(),
            log_ksp_298: -100.0,
            delta_h_kj: 0.0,
            log_ksp_analytic: None,
            solid_color: [0.82, 0.84, 0.86],
            density_g_ml: 1.74,
            default_particle_um: 100.0,
            kind: "metal".to_string(),
            tier: ProvenanceTier::Tabulated,
            source: "CRC Handbook".to_string(),
        },
    ];
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
    let mut list = vec![
        // 2. Catalysed H2O2 decomposition
        GeneralKineticRxn {
            id: "h2o2_decomposition".to_string(),
            equation: "2 H2O2 -> 2 H2O + O2(g)".to_string(),
            reactants: [("H2O2".to_string(), 2.0)].into(),
            products: [("H2O".to_string(), 2.0)].into(),
            gas_products: [("O2(g)".to_string(), 1.0)].into(),
            // heterogeneously catalysed decomposition is first order in H2O2 (surface-limited), not second
            orders: Some([("H2O2".to_string(), 1.0)].into()),
            arrhenius_a: 1000.0,
            arrhenius_n: 0.0,
            arrhenius_ea: 25000.0,
            delta_h_kj: -98.0, // exothermic
            catalyst_species: Some("MnO2(s)".to_string()),
            is_reversible: false,
            k_eq_298: None,
            tier: ProvenanceTier::Tabulated,
            source: "NIST Chemical Kinetics".to_string(),
        },
        // 3. Iodine clock: persulfate + iodide
        GeneralKineticRxn {
            id: "iodine_clock_slow".to_string(),
            equation: "S2O8-2 + 2 I- -> 2 SO4-2 + I2(aq)".to_string(),
            reactants: [("S2O8-2".to_string(), 1.0), ("I-".to_string(), 2.0)].into(),
            products: [("SO4-2".to_string(), 2.0), ("I2(aq)".to_string(), 1.0)].into(),
            gas_products: HashMap::new(),
            // measured rate law: rate = k [S2O8 2-][I-] (first order in iodide although two I- are consumed)
            orders: Some([("S2O8-2".to_string(), 1.0), ("I-".to_string(), 1.0)].into()),
            arrhenius_a: 1.15e8,
            arrhenius_n: 0.0,
            arrhenius_ea: 52000.0,
            delta_h_kj: -140.0,
            catalyst_species: None,
            is_reversible: false,
            k_eq_298: None,
            tier: ProvenanceTier::Tabulated,
            source: "J. Chem. Educ. Iodine Clock Kinetics".to_string(),
        },
        // 4. Iodine clock fast reduction: I2 + 2 S2O3-2 -> 2 I- + S4O6-2
        GeneralKineticRxn {
            id: "iodine_thiosulfate_fast".to_string(),
            equation: "I2(aq) + 2 S2O3-2 -> 2 I- + S4O6-2".to_string(),
            reactants: [("I2(aq)".to_string(), 1.0), ("S2O3-2".to_string(), 2.0)].into(),
            products: [("I-".to_string(), 2.0), ("S4O6-2".to_string(), 1.0)].into(),
            gas_products: HashMap::new(),
            // rate = k [I2][S2O3 2-] (first order in each)
            orders: Some([("I2(aq)".to_string(), 1.0), ("S2O3-2".to_string(), 1.0)].into()),
            arrhenius_a: 1e11,
            arrhenius_n: 0.0,
            arrhenius_ea: 0.0,
            delta_h_kj: -95.0,
            catalyst_species: None,
            is_reversible: false,
            k_eq_298: None,
            tier: ProvenanceTier::Tabulated,
            source: "Diffusion-controlled Redox Kinetics".to_string(),
        },
        // 5. Magnesium dissolution in acid: Mg(s) + 2 H+ -> Mg+2 + H2(g)
        GeneralKineticRxn {
            id: "mg_acid_dissolution".to_string(),
            equation: "Mg(s) + 2 H+ -> Mg+2 + H2(g)".to_string(),
            reactants: [("Mg(s)".to_string(), 1.0), ("H+".to_string(), 2.0)].into(),
            products: [("Mg+2".to_string(), 1.0)].into(),
            gas_products: [("H2(g)".to_string(), 1.0)].into(),
            // surface reaction, first order in [H+]
            orders: Some([("H+".to_string(), 1.0)].into()),
            arrhenius_a: 475.0,
            arrhenius_n: 0.0,
            arrhenius_ea: 20000.0,
            delta_h_kj: -467.0,
            catalyst_species: None,
            is_reversible: false,
            k_eq_298: None,
            tier: ProvenanceTier::Tabulated,
            source: "CRC Handbook".to_string(),
        },
        // 6. Ethanol combustion: C2H5OH + 3 O2 -> 2 CO2(g) + 3 H2O
        GeneralKineticRxn {
            id: "ethanol_combustion".to_string(),
            equation: "C2H5OH + 3 O2 -> 2 CO2(g) + 3 H2O".to_string(),
            reactants: [("C2H5OH".to_string(), 1.0), ("O2".to_string(), 3.0)].into(),
            products: [("H2O".to_string(), 3.0)].into(),
            gas_products: [("CO2(g)".to_string(), 2.0)].into(),
            orders: None,
            arrhenius_a: 1e9,
            arrhenius_n: 0.0,
            arrhenius_ea: 120000.0,
            delta_h_kj: -1367.0,
            catalyst_species: None,
            is_reversible: false,
            k_eq_298: None,
            tier: ProvenanceTier::Tabulated,
            source: "NIST WebBook".to_string(),
        },
    ];
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
