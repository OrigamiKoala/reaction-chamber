//! Mineral solubility products log Ksp(T) from species chemical potentials and analytic formulations.
//!
//! Evaluates:
//! - AgCl, CaCO3, CaSO4, BaSO4, Ag2CrO4 across 25 °C, 60 °C, 100 °C within 0.1 of llnl / SUPCRTBL.
//! - Captures retrograde solubility of CaCO3 and CaSO4 (solubility decreases as temperature rises).

use std::collections::HashMap;
use crate::physics::R_GAS;

/// Evaluates log10 Ksp of a mineral at temperature `t_k` and pressure `p_pa`.
/// If the mineral has an analytic expression from llnl.dat / SUPCRTBL, it is used;
/// otherwise, log10 Ksp is computed directly from Delta_sol G0 = sum nu_i mu0_ion - mu0_solid.
pub fn mineral_log_ksp(mineral: &str, t_k: f64, p_pa: f64) -> f64 {
    let t = t_k.clamp(100.0, 3000.0);
    let norm_name = mineral.trim_end_matches("(s)");

    // 1. Query SpeciesStore for analytic parameters or solid record
    if let Ok(store) = crate::db::SpeciesStore::global().read() {
        let rec = store.get(mineral)
            .or_else(|| store.get(norm_name))
            .or_else(|| store.get(&format!("{}(s)", norm_name)));
        if let Some(r) = rec {
            if let Some(p_data) = r.phases.get("s") {
                if let Some(thermo) = &p_data.thermo {
                    if let Some(params_val) = &thermo.params {
                        if let Ok(a) = serde_json::from_value::<[f64; 5]>(params_val.clone()) {
                            return a[0] + a[1] * t + a[2] / t + a[3] * t.log10() + a[4] / (t * t);
                        }
                    }
                }
            }
        }
    }

    // 2. Query registered mineral in chem_db
    for m in crate::chem_db::get_mineral_registry() {
        if m.mineral == mineral || m.formula == mineral || m.solid_species == mineral || m.formula == norm_name {
            return m.log_ksp_at(t);
        }
    }

    // 3. General thermodynamic calculation: Delta_r G0 = sum nu_i mu0(ion) - mu0(solid)
    let solid_key = if mineral.ends_with("(s)") {
        mineral.to_string()
    } else {
        format!("{}(s)", mineral)
    };
    let mut reactants = HashMap::new();
    reactants.insert(solid_key.clone(), 1.0);
    let mut products = HashMap::new();

    // Check if dissolved_products known from any registered mineral
    let mut found_products = false;
    for m in crate::chem_db::get_mineral_registry() {
        if m.solid_species == solid_key || m.formula == norm_name {
            products = m.dissolved_products.clone();
            found_products = true;
            break;
        }
    }

    if !found_products {
        if let Some(elems) = crate::ions::species_elements(norm_name) {
            for (e, &n) in &elems {
                products.insert(e.clone(), n);
            }
        }
    }

    let dg = crate::thermo::functions::delta_r_g0(&reactants, &products, t, p_pa);
    -dg / (R_GAS * t * std::f64::consts::LN_10)
}

/// Checks if a mineral exhibits retrograde solubility (d(log Ksp)/dT < 0).
pub fn is_retrograde(mineral: &str) -> bool {
    let k25 = mineral_log_ksp(mineral, 298.15, 101325.0);
    let k60 = mineral_log_ksp(mineral, 333.15, 101325.0);
    k60 < k25
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mineral_log_ksp_gate() {
        // Plan Stage 2 Gate: log Ksp(T) of AgCl, CaCO3, CaSO4, BaSO4, Ag2CrO4 at 25/60/100 °C within 0.1 of llnl/SUPCRT
        let targets = [
            ("AgCl", 298.15, -9.75),
            ("AgCl", 333.15, -8.93),
            ("AgCl", 373.15, -8.24),
            ("CaCO3", 298.15, -8.48),
            ("CaCO3", 333.15, -8.76),
            ("CaCO3", 373.15, -9.16),
            ("CaSO4", 298.15, -4.36),
            ("CaSO4", 333.15, -4.73),
            ("CaSO4", 373.15, -5.29),
            ("BaSO4", 298.15, -9.97),
            ("BaSO4", 333.15, -9.70),
            ("BaSO4", 373.15, -9.51),
            ("Ag2CrO4", 298.15, -11.95),
            ("Ag2CrO4", 333.15, -11.39),
            ("Ag2CrO4", 373.15, -10.92),
        ];

        for (min, t_k, expected) in targets {
            let actual = mineral_log_ksp(min, t_k, 101325.0);
            assert!(
                (actual - expected).abs() <= 0.1,
                "{}: at {} K, got {}, expected {}, diff {}",
                min,
                t_k,
                actual,
                expected,
                (actual - expected).abs()
            );
        }

        // Gate: CaCO3 and CaSO4 retrograde
        assert!(is_retrograde("CaCO3"), "CaCO3 must be retrograde");
        assert!(is_retrograde("CaSO4"), "CaSO4 must be retrograde");
        assert!(!is_retrograde("AgCl"), "AgCl is prograde");
        assert!(!is_retrograde("BaSO4"), "BaSO4 is prograde");
    }
}
