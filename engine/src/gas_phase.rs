//! The gas phase of a vessel and the atmosphere it sits in (Stage 4).
//!
//! * An **open** vessel is in contact with an infinite atmosphere: a total pressure, a dry-gas composition and the
//!   relative saturation of every condensable vapour (humidity). Vacuum, pressurised, inert (N2 / Ar) and O2-rich
//!   atmospheres are just different inputs. The atmosphere is a room input of the vessel (`VesselControls.atmosphere`).
//! * A **sealed** vessel holds a closed gas inventory (`Vessel::headspace_gas_mol`: air captured when it was
//!   closed, vapour of its liquids, evolved gas), whose pressure follows from the equation of state at the
//!   headspace volume and temperature.
//!
//! The default atmosphere is the standard dry air of `db::seed_vle::STANDARD_DRY_AIR` at 1 atm with the relative
//! saturation of `STANDARD_RELATIVE_SATURATION` for every condensable vapour listed there. Nothing here names a compound:
//! species are gas ids ("N2(g)") and the vapour pressure of a condensable comes from its record through `vle`.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::db::seed_vle::{STANDARD_DRY_AIR, STANDARD_RELATIVE_SATURATION};

/// Standard pressure, Pa.
pub const ATM_PA: f64 = 101_325.0;

/// The atmosphere an open vessel exchanges with.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct Atmosphere {
    /// Total pressure, atm.
    pub pressure_atm: f64,
    /// Dry-gas mole fractions (gas species ids), normalised when used.
    pub composition: Vec<(String, f64)>,
    /// Relative saturation (0-1) of condensable vapours: partial pressure = fraction x Psat(room temperature).
    pub relative_saturation: Vec<(String, f64)>,
}

impl Default for Atmosphere {
    fn default() -> Self {
        Self {
            pressure_atm: 1.0,
            composition: STANDARD_DRY_AIR.iter().map(|(k, v)| (k.to_string(), *v)).collect(),
            relative_saturation: STANDARD_RELATIVE_SATURATION.iter().map(|(k, v)| (k.to_string(), *v)).collect(),
        }
    }
}

/// Partial update of the atmosphere (a control): absent fields keep their value.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct AtmosphereSpec {
    pub pressure_atm: Option<f64>,
    pub composition: Option<HashMap<String, f64>>,
    pub relative_saturation: Option<HashMap<String, f64>>,
}

impl Atmosphere {
    pub fn apply(&mut self, spec: &AtmosphereSpec) {
        if let Some(p) = spec.pressure_atm.filter(|p| p.is_finite() && *p >= 0.0) {
            self.pressure_atm = p;
        }
        if let Some(c) = &spec.composition {
            let mut v: Vec<(String, f64)> = c.iter().filter(|(_, x)| **x > 0.0).map(|(k, x)| (k.clone(), *x)).collect();
            v.sort_by(|a, b| a.0.cmp(&b.0));
            self.composition = v;
        }
        if let Some(r) = &spec.relative_saturation {
            let mut v: Vec<(String, f64)> = r.iter().filter(|(_, x)| **x >= 0.0).map(|(k, x)| (k.clone(), x.min(1.0))).collect();
            v.sort_by(|a, b| a.0.cmp(&b.0));
            self.relative_saturation = v;
        }
    }

    pub fn pressure_pa(&self) -> f64 {
        self.pressure_atm * ATM_PA
    }

    /// Partial pressures (Pa) of every gas of the atmosphere at room temperature `t_k`. `psat_of` gives the
    /// saturation pressure of a condensable's gas id (None = unknown: the species is treated as a dry gas).
    pub fn partial_pressures_pa(&self, t_k: f64, psat_of: &dyn Fn(&str, f64) -> Option<f64>) -> Vec<(String, f64)> {
        let p_tot = self.pressure_pa();
        let mut out: Vec<(String, f64)> = Vec::new();
        let mut p_cond = 0.0;
        for (id, rs) in &self.relative_saturation {
            if let Some(ps) = psat_of(id, t_k) {
                let p = (rs * ps).min(0.99 * p_tot);
                p_cond += p;
                out.push((id.clone(), p));
            }
        }
        let dry_tot: f64 = self.composition.iter().map(|(_, x)| *x).sum();
        let p_dry = (p_tot - p_cond).max(0.0);
        if dry_tot > 0.0 {
            for (id, x) in &self.composition {
                if let Some(e) = out.iter_mut().find(|(k, _)| k == id) {
                    e.1 += p_dry * x / dry_tot;
                } else {
                    out.push((id.clone(), p_dry * x / dry_tot));
                }
            }
        }
        out
    }
}

/// One gas species of a gas phase.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GasPhaseSpecies {
    pub species: String,
    /// Moles (a sealed vessel's inventory); 0 for an open vessel's atmosphere.
    pub mol: f64,
    pub mole_fraction: f64,
    pub partial_atm: f64,
}

/// What the snapshot reports about the gas phase of a vessel.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GasPhaseInfo {
    /// "atmosphere" (open vessel) | "sealed" (closed inventory)
    pub kind: String,
    pub pressure_atm: f64,
    pub temperature_k: f64,
    /// True when a liquid species of the vessel is above its critical temperature: it is one fluid with the gas.
    pub supercritical: bool,
    /// Equation of state used for the pressure: "ideal" or "peng-robinson".
    pub eos: String,
    pub species: Vec<GasPhaseSpecies>,
}
