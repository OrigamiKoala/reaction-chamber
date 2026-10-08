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
    /// Physical form of a solid reagent (`piece`, `turnings`, `granules`, `powder`; see `solid_forms.rs`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub solid_form: Option<String>,
    /// Grain size of that form, um, when the reagent's own differs from the form's default (the thickness of a ribbon).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub particle_um: Option<f64>,
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
    /// Ligand substitution (Eigen-Wilkins): the row is a complexation `M + n L <=> ML_n` whose first metal-ligand bond is
    /// rate-limiting, and `terms` hold the rate constant of that bond (M^-1 s^-1) rather than a rate law of the whole row.
    /// The approach to equilibrium then relaxes with `k_f ([M] + [L]) + k_f / K_step` (`K_step` the geometric-mean
    /// stepwise constant `K^(1/n)`), which needs no concentration power of the ligand.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub first_step: Option<FirstStep>,
    pub source: String,
}

/// The metal and the ligand of a first-bond-limited complexation row (see `EquilibriumRate::first_step`).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FirstStep {
    pub metal: String,
    pub ligand: String,
    /// Number of ligands the row binds.
    pub n: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RateTerm {
    /// Species whose molar concentration multiplies the term; None = the uncatalysed (solvent) path.
    pub catalyst: Option<String>,
    /// Rate constant at 298.15 K (s^-1, or M^-1 s^-1 with a catalyst).
    pub k_298: f64,
    /// Arrhenius activation energy, J/mol.
    pub ea_j_mol: f64,
    /// Product of the charges of the two partners of the outer-sphere encounter that sets `k_298` (z_metal x z_ligand, negative
    /// for an attraction); 0 = no ionic-strength dependence. The association constant K_os and so the rate scale with
    /// gamma_M gamma_L / gamma_pair, `log10 = 2 A z_M z_L f(I)` (`EquilibriumRate::k_forward_at`).
    #[serde(default)]
    pub z_product: f64,
}

impl EquilibriumRate {
    /// Forward first-order rate coefficient (s^-1) at `t_k` given the molar concentration of a species, at infinite dilution.
    pub fn k_forward(&self, t_k: f64, conc_m: &dyn Fn(&str) -> f64) -> f64 {
        self.k_forward_at(t_k, conc_m, 0.0)
    }

    /// Same at ionic strength `ionic_strength` (mol/kg): a term with a charge product `z_product` is multiplied by
    /// `10^(2 A z f(I))`, `f(I) = sqrt(I) / (1 + sqrt(I)) - 0.3 I` (Davies), the change of the outer-sphere association constant
    /// of two ions (an attraction, z < 0, is screened; a repulsion is helped).
    pub fn k_forward_at(&self, t_k: f64, conc_m: &dyn Fn(&str) -> f64, ionic_strength: f64) -> f64 {
        let inv = 1.0 / t_k.max(1.0) - 1.0 / 298.15;
        let i = ionic_strength.max(0.0);
        let f = i.sqrt() / (1.0 + i.sqrt()) - 0.3 * i;
        let a = crate::activity::debye_huckel_a_gamma(t_k);
        self.terms
            .iter()
            .map(|term| {
                let k = term.k_298 * (-term.ea_j_mol / crate::physics::R_GAS * inv).exp() * 10f64.powf(2.0 * a * term.z_product * f);
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
    /// Solvent class ("water", "alcohol", "alkane", ...) of the liquid phase this reaction was generated for (its rate
    /// constant is that of the solvent class); it runs only in phases of that class. `None` (the hand-curated rows of
    /// `core_reactions.json`) = the primary liquid phase, as before.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phase_class: Option<String>,
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

/// Equilibrium rows `HA <=> A- + H+` generated from the acid-base sites of the seeded species records (a site's `site`
/// field names the conjugate base species): log K = -pKa at the site's reference temperature, the enthalpy and the tier
/// and source of the pKa datum carried over. Nothing about a particular acid is written here.
pub fn record_acid_equilibria() -> Vec<GeneralEquilibrium> {
    let mut rows = Vec::new();
    for rec in crate::db::seed::seed_species() {
        for site in &rec.acid_base {
            let Some(base) = &site.site else { continue };
            let mut reactants = HashMap::new();
            reactants.insert(rec.id.clone(), 1.0);
            let mut products = HashMap::new();
            products.insert(base.clone(), 1.0);
            products.insert(crate::db::seed::PROTON.to_string(), 1.0);
            rows.push(GeneralEquilibrium {
                id: format!("{}_dissociation", rec.id),
                name: format!("{} dissociation", rec.identity.names.last().cloned().unwrap_or_else(|| rec.id.clone())),
                equation: format!("{} <=> {} + H+", rec.id, base),
                reactants,
                products,
                log_k_298: -site.pKa.value,
                delta_h_kj: site.dH.as_ref().map_or(0.0, |d| d.value),
                log_k_analytic: None,
                rate: None,
                tier: site.pKa.tier.clone(),
                source: site.pKa.source.clone(),
            });
        }
    }
    rows
}

/// Every default equilibrium row, with the ligand-substitution kinetics of the complexation rows attached
/// (`substitution::attach_rate`: inert and slow aqua ions form their complexes over seconds to hours, not at once).
pub fn get_default_equilibria() -> Vec<GeneralEquilibrium> {
    let mut list = raw_default_equilibria();
    for eq in list.iter_mut() {
        crate::substitution::attach_rate(eq);
    }
    list
}

/// The default rows as the data files and custom registrations give them, without any derived kinetics.
pub(crate) fn raw_default_equilibria() -> Vec<GeneralEquilibrium> {
    let mut list = core_rows().equilibria.clone();
    // Acid-base sites of the seeded species records (the indicator dyes): the row is generated from the record's pKa.
    for eq in record_acid_equilibria() {
        if !list.iter().any(|e| e.id == eq.id) {
            list.push(eq);
        }
    }
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

/// Dissolution enthalpy (kJ/mol of solid) from the formation enthalpies of the solid and its dissolved products, or None
/// when one has no data, the row is not balanced in elements and charge (a dissolution that consumes water), or the
/// solid has no ionic split.
fn dissolution_enthalpy_from_formation(m: &GeneralMineral) -> Option<f64> {
    let h = |sp: &str| {
        let ph = if sp.ends_with("(s)") { "s" } else if sp.ends_with("(g)") { "g" } else { "aq" };
        crate::thermo::functions::try_thermo_state(sp, ph, 298.15, 101_325.0).map(|s| s.h_j_mol / 1000.0)
    };
    let mut elems_solid = crate::ions::species_elements(&m.solid_species)?;
    let mut charge = 0.0;
    let mut dh = -h(&m.solid_species)?;
    let mut elems_out: HashMap<String, f64> = HashMap::new();
    for (sp, c) in &m.dissolved_products {
        dh += c * h(sp)?;
        charge += c * crate::ions::species_charge(sp) as f64;
        for (e, n) in crate::ions::species_elements(sp)? {
            *elems_out.entry(e).or_insert(0.0) += c * n;
        }
    }
    elems_solid.retain(|_, v| *v > 0.0);
    let balanced = charge.abs() < 1e-9
        && elems_solid.len() == elems_out.len()
        && elems_solid.iter().all(|(e, n)| (elems_out.get(e).copied().unwrap_or(-1.0) - n).abs() < 1e-9);
    if balanced { Some(dh) } else { None }
}

/// A row without an enthalpy (0 means "not given") or with one that disagrees with the formation enthalpies of its own
/// species by more than 10 kJ/mol takes the enthalpy of the species data: the temperature dependence of K and the heat
/// of dissolving or precipitating then follow the same data as everything else.
fn reconcile_mineral_enthalpy(m: &mut GeneralMineral) {
    if let Some(dh) = dissolution_enthalpy_from_formation(m) {
        if m.delta_h_kj == 0.0 || (m.delta_h_kj - dh).abs() > 10.0 {
            m.delta_h_kj = dh;
            m.source = format!("{} (dH from formation enthalpies)", m.source);
        }
    }
}

/// Whether `solid_id` is the solid of a registered mineral (a core row, a row of the solubility table, or an import).
pub fn is_registered_mineral(solid_id: &str) -> bool {
    core_rows().minerals.iter().any(|m| m.solid_species == solid_id)
        || crate::solubility::table_minerals().iter().any(|m| m.solid_species == solid_id)
        || CUSTOM_MINERALS.lock().map_or(false, |l| l.iter().any(|m| m.solid_species == solid_id))
}

pub fn get_default_minerals() -> Vec<GeneralMineral> {
    let mut list = core_rows().minerals.clone();
    // Data-driven solubility table: any cation/anion pair with IAP > Ksp precipitates (engine/data/solubility.json).
    for m in crate::solubility::table_minerals() {
        if !list.iter().any(|x| x.solid_species == m.solid_species) {
            list.push(m.clone());
        }
    }
    for m in list.iter_mut() {
        reconcile_mineral_enthalpy(m);
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

#[derive(Deserialize)]
struct CatalogFile {
    reagents: Vec<ReagentCatalogEntry>,
}

/// The bench's reagents (`data/reagent_catalog.json`): bottles, hazard data and the composition of each. The InChIKey of
/// the main species identifies an import as this reagent.
pub fn get_reagent_catalog() -> Vec<ReagentCatalogEntry> {
    static CAT: std::sync::OnceLock<Vec<ReagentCatalogEntry>> = std::sync::OnceLock::new();
    let mut catalog = CAT.get_or_init(|| serde_json::from_str::<CatalogFile>(include_str!("../data/reagent_catalog.json")).expect("data/reagent_catalog.json").reagents).clone();
    // reagents registered at run time (imports, custom compounds) replace a shelf reagent of the same id
    if let Ok(lock) = CUSTOM_REAGENTS.lock() {
        for reagent in lock.iter() {
            catalog.retain(|r| r.id != reagent.id);
            catalog.push(reagent.clone());
        }
    }
    catalog
}
