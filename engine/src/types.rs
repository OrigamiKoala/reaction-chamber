use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum ProvenanceTier {
    Tabulated,
    Estimated,
    Speculative,
    Refined,
    UserSet,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Parameter {
    pub value: f64,
    pub units: String,
    pub tier: ProvenanceTier,
    pub source: String,
    pub uncertainty: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Species {
    pub inchi_key: String,
    pub cid: Option<u64>,
    pub name: String,
    pub smiles: String,
    pub formula: String,
    pub charge: i32,
    pub mw: f64,
    pub tm: Option<Parameter>,
    pub tb: Option<Parameter>,
    pub density: Option<Parameter>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DissolutionComponent {
    pub inchi_key: String,
    pub formula: String,
    pub stoichiometry: f64,
    pub charge: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Substance {
    pub cid: Option<u64>,
    pub name: String,
    pub form: String,
    pub dissolution_composition: Vec<DissolutionComponent>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Phase {
    pub kind: String, // "aqueous", "organic", "solid", "gas_headspace"
    pub volume_ml: f64,
    pub density_g_ml: f64,
    pub amounts_mol: HashMap<String, f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Vessel {
    pub id: String,
    pub capacity_ml: f64,
    pub phases: Vec<Phase>,
    pub temperature_k: f64,
    pub is_sealed: bool,
    pub stirring: bool,
    pub heat_input_watts: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TitrationPoint {
    pub titrant_vol_ml: f64,
    pub total_vol_ml: f64,
    pub ph: f64,
    pub ionic_strength: f64,
    pub tier: ProvenanceTier,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TitrationCurve {
    pub title: String,
    pub points: Vec<TitrationPoint>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EquilibriumResult {
    pub ph: f64,
    pub ionic_strength: f64,
    pub species_mol_l: HashMap<String, f64>,
    pub activities: HashMap<String, f64>,
    pub precipitate_mol: HashMap<String, f64>,
    pub tier: ProvenanceTier,
    pub iterations: usize,
    pub converged: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SimulationTickResult {
    pub time_sec: f64,
    pub temperature_k: f64,
    pub ph: f64,
    pub is_boiling: bool,
    pub gas_evolved_mol: HashMap<String, f64>,
    pub precipitates_mol: HashMap<String, f64>,
    pub liquid_volume_ml: f64,
    pub phases: Vec<Phase>,
    pub conservation_passed: bool,
    pub max_conservation_error: f64,
}
