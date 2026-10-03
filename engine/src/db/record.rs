#![allow(non_snake_case)]
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::types::ProvenanceTier;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Datum {
    pub value: f64,
    pub unit: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub T_K: Option<f64>,
    pub tier: ProvenanceTier,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uncertainty: Option<f64>,
}

impl Datum {
    pub fn new(value: f64, unit: &str, tier: ProvenanceTier, source: &str) -> Self {
        Self {
            value,
            unit: unit.to_string(),
            T_K: None,
            tier,
            source: source.to_string(),
            uncertainty: None,
        }
    }

    pub fn with_t(mut self, t_k: f64) -> Self {
        self.T_K = Some(t_k);
        self
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct Identity {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inchikey: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub smiles: Option<String>,
    pub formula: String,
    pub charge: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cas: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cid: Option<u64>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub names: Vec<String>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub db_names: HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct PhaseThermo {
    pub model: String,
    pub tier: ProvenanceTier,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dfH: Option<Datum>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dfG: Option<Datum>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub S: Option<Datum>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cp: Option<Datum>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ranges: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct PhaseVolume {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zra: Option<Datum>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub v0: Option<Datum>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct PhaseData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thermo: Option<PhaseThermo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub volume: Option<PhaseVolume>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rho: Option<Datum>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub polymorph: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct Critical {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub Tc: Option<Datum>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub Pc: Option<Datum>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub Vc: Option<Datum>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub omega: Option<Datum>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct CurvePoint {
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub T_K: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub P_Pa: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub solvent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    pub tier: ProvenanceTier,
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uncertainty: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AcidBaseSite {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub site: Option<String>,
    pub pKa: Datum,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dH: Option<Datum>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub T_K: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub I: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct RedoxCouple {
    pub partner: String,
    pub E0: Datum,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub n_electrons: Option<i32>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct OpticsBand {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub solvent: Option<String>,
    pub nm: f64,
    pub eps: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fwhm: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct Optics {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub bands: Vec<OpticsBand>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub molar_refraction: Option<Datum>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub band_gap_eV: Option<Datum>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gas_xsec: Option<Vec<f64>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flame_rgb: Option<[f64; 3]>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct Transport {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eta_l: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sigma: Option<Datum>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct RejectedDatum {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub datum: Option<serde_json::Value>,
    pub reason: String,
}

/// A reference-quality saturation-pressure *curve* of a liquid (a labelled curve, never a stored boiling point): the
/// equation, its parameters and the temperature range it is valid for. `model` names an equation, not a compound
/// ("iapws-if97-region4", "wagner", "antoine"); a record without one gets its vapour pressure from its labelled
/// `points` plus critical constants (Lee-Kesler corresponding states) or from a Clausius-Clapeyron fit (`vle.rs`).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct VaporPressureSpec {
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub t_min_k: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub t_max_k: Option<f64>,
    pub tier: ProvenanceTier,
    pub source: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct SpeciesRecord {
    pub id: String,
    pub identity: Identity,
    #[serde(default)]
    pub phases: HashMap<String, PhaseData>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub critical: Option<Critical>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub points: Vec<CurvePoint>,
    /// Explicit saturation-pressure equation of the liquid (see `VaporPressureSpec`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vapor_pressure: Option<VaporPressureSpec>,
    /// Explicit UNIFAC subgroup counts (`[["CH3", 1], ["CH2", 1], ["OH", 1]]`); when absent they are derived from
    /// `identity.smiles` by `groups.rs`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unifac_groups: Option<Vec<(String, f64)>>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub acid_base: Vec<AcidBaseSite>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub redox: Vec<RedoxCouple>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub optics: Option<Optics>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transport: Option<Transport>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub kinetics_refs: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub rejected: Vec<RejectedDatum>,
}

impl SpeciesRecord {
    pub fn mw(&self) -> f64 {
        crate::ions::species_mass(&self.identity.formula)
            .filter(|m| *m > 0.5)
            .unwrap_or(50.0)
    }

    pub fn charge(&self) -> i32 {
        self.identity.charge
    }

    pub fn elements(&self) -> HashMap<String, f64> {
        let (body, _) = crate::ions::split_charge(&self.identity.formula);
        crate::ions::parse_formula_strict(body)
            .or_else(|| crate::ions::species_elements(&self.identity.formula))
            .unwrap_or_default()
    }

    pub fn has_phase(&self, phase_tag: &str) -> bool {
        self.phases.contains_key(phase_tag)
    }
}
