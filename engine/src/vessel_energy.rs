//! Enthalpy state function and energy audit of a vessel (P2).
//!
//! The vessel's temperature is advanced from process heats (each reaction's heat, the latent heats, the heater and the
//! losses); `enthalpy_state_j` is the independent check: the enthalpy `H(T, n) = sum_i n_i H_i(T)` of everything the vessel
//! holds (every liquid phase, the solids, the headspace gas and the part of the glass that follows the contents), from the
//! species records' formation enthalpies and heat-capacity models (`thermo::functions::try_thermo_state`). For a closed
//! vessel the change of this function over any interval must equal the energy the surroundings supplied
//! (`Vessel::external_energy_j`); `energy_audit` reports the difference, the defect, and which species the state function
//! could not evaluate (no formation data: they carry no energy in it, nothing is invented).

use crate::thermo::functions::try_thermo_state;
use crate::vessel::Vessel;

/// Result of one evaluation of the enthalpy state function.
#[derive(Clone, Debug, Default)]
pub struct EnthalpyState {
    /// Total enthalpy (J) relative to the elements in their reference states at 298.15 K (plus the glass's sensible part).
    pub h_j: f64,
    /// Species present without formation data (not in `h_j`).
    pub uncovered: Vec<String>,
    /// Moles of everything counted and of everything not counted.
    pub covered_mol: f64,
    pub uncovered_mol: f64,
}

/// A mark of the vessel's energy state, to be compared with a later one.
#[derive(Clone, Debug)]
pub struct EnergyMark {
    pub h_j: f64,
    pub external_j: f64,
    pub uncovered: Vec<String>,
}

/// Energy audit between a mark and now.
#[derive(Clone, Debug)]
pub struct EnergyAudit {
    /// Change of the state function (J).
    pub delta_h_j: f64,
    /// Energy supplied by heater, burner and bath minus the loss to the room (J).
    pub external_j: f64,
    /// `delta_h_j - external_j`: zero when every process heat is consistent with the species enthalpies and nothing left.
    pub defect_j: f64,
    /// Species without data at either end of the interval (their energy is not audited).
    pub uncovered: Vec<String>,
}

impl Vessel {
    /// `H(T, n)` of the contents at the current temperature.
    pub fn enthalpy_state_j(&self) -> EnthalpyState {
        self.enthalpy_state_excluding(&[])
    }

    /// `H(T, n)` without the listed species (an audit that compares vessels with different headspace volumes leaves the
    /// vapour of the solvent out, its amount follows the free volume and not the chemistry).
    pub fn enthalpy_state_excluding(&self, skip: &[&str]) -> EnthalpyState {
        let t = self.temperature_k;
        let p = self.pressure_atm.max(0.01) * 101_325.0;
        let mut out = EnthalpyState::default();
        let add = |out: &mut EnthalpyState, sp: &str, phase: &str, mol: f64| {
            if mol <= 0.0 || skip.contains(&sp) {
                return;
            }
            match try_thermo_state(sp, phase, t, p) {
                Some(st) => {
                    out.h_j += mol * st.h_j_mol;
                    out.covered_mol += mol;
                }
                None => {
                    if !out.uncovered.iter().any(|u| u == sp) {
                        out.uncovered.push(sp.to_string());
                    }
                    out.uncovered_mol += mol;
                }
            }
        };
        for (i, m) in self.liquid_maps().enumerate() {
            let mut keys: Vec<&String> = m.keys().collect();
            keys.sort();
            for k in keys {
                add(&mut out, k, if i == 0 { "aq" } else { "l" }, m[k]);
            }
        }
        let mut keys: Vec<&String> = self.solid_mol.keys().collect();
        keys.sort();
        for k in keys {
            add(&mut out, k, "s", self.solid_mol[k]);
        }
        let mut keys: Vec<&String> = self.headspace_gas_mol.keys().collect();
        keys.sort();
        for k in keys {
            add(&mut out, k, "g", self.headspace_gas_mol[k]);
        }
        out.h_j += self.glass_heat_capacity() * (t - 298.15);
        // the heat of mixing of the liquids (ideal mixing is what the species enthalpies describe)
        out.h_j += self.excess_enthalpy_j();
        out.uncovered.sort();
        out
    }

    /// Marks the energy state now (start of an audited interval).
    pub fn energy_mark(&self) -> EnergyMark {
        let s = self.enthalpy_state_j();
        EnergyMark { h_j: s.h_j, external_j: self.external_energy_j, uncovered: s.uncovered }
    }

    /// The energy audit since `mark`. Meaningful for a closed vessel (sealed, or nothing left an open one).
    pub fn energy_audit(&self, mark: &EnergyMark) -> EnergyAudit {
        let now = self.enthalpy_state_j();
        let delta_h = now.h_j - mark.h_j;
        let external = self.external_energy_j - mark.external_j;
        let mut uncovered = mark.uncovered.clone();
        for u in now.uncovered {
            if !uncovered.contains(&u) {
                uncovered.push(u);
            }
        }
        uncovered.sort();
        EnergyAudit { delta_h_j: delta_h, external_j: external, defect_j: delta_h - external, uncovered }
    }
}
