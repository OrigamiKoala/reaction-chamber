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
    /// Specific surface area of the solid as handled (BET, m^2/g). A property of the material in its usual powder form;
    /// without it the surface follows from the particle size of the solid in the vessel.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub specific_area: Option<Datum>,
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
    /// Self-exchange rate constant of the couple (M^-1 s^-1): the rate of electron exchange between its two forms, from
    /// which the Marcus cross relation derives the rate of every reaction the couple takes part in.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub k_self: Option<Datum>,
}

/// One Gaussian absorption band of a species in a solvent (or in the solid lattice): the molar absorptivity at the band
/// centre and the full width at half maximum. `solvent` is a solvent *class* ("water", "alkane", "aromatic", "alcohol",
/// "other") or a species id; absent means "any solvent" (the band is not known to depend on it).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct OpticsBand {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub solvent: Option<String>,
    pub nm: f64,
    /// Molar absorptivity at the centre, L/(mol cm).
    pub eps: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fwhm: Option<f64>,
    /// "d-d" | "ct" | "pi-pi*" | "n-pi*" | "ivct" ...: informational (and which width estimate applies when `fwhm` is absent).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
}

/// One Gaussian band of a gas-phase absorption cross-section.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct GasBand {
    pub nm: f64,
    /// Cross-section at the centre, cm2 per molecule.
    pub sigma_cm2: f64,
    pub fwhm: f64,
}

/// A measured colour of a solid as stated by a source (parsed colour phrase): never an absorptivity.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct SolidColour {
    /// Linear sRGB of the diffuse (bulk powder) colour.
    pub rgb_linear: [f64; 3],
    /// What the phrase describes: "solid" | "solution" | "vapour" | "liquid".
    #[serde(default = "default_subject")]
    pub subject: String,
    /// True when the phrase is about a hydrate, false for an anhydrous form, absent when unstated.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hydrate: Option<bool>,
    /// 0..1: how sure the parser is that `rgb_linear` is the phrase's colour (compound hues and modifiers lower it).
    #[serde(default = "default_confidence")]
    pub confidence: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phrase: Option<String>,
}

fn default_subject() -> String {
    "solid".to_string()
}

fn default_confidence() -> f64 {
    0.5
}

/// Optical record of a species (every value carries the record's tier and source).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct Optics {
    /// Solution absorption bands (per solvent).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub bands: Vec<OpticsBand>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tier: Option<ProvenanceTier>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    /// Molar refraction R_D, cm3/mol (Lorentz-Lorenz).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub molar_refraction: Option<Datum>,
    /// Measured refractive index n_D of the pure phase (overrides Lorentz-Lorenz).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refractive_index: Option<Datum>,
    /// Optical band gap of the solid, eV (absorption edge).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub band_gap_eV: Option<Datum>,
    /// Absorption bands of chromophores in the solid lattice (intervalence / charge transfer / d-d) with the
    /// absorptivity the chromophore has in the lattice.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub solid_bands: Vec<OpticsBand>,
    /// Measured colour of the solid.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub colour: Option<SolidColour>,
    /// Gas-phase absorption cross-section.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub gas_bands: Vec<GasBand>,
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
