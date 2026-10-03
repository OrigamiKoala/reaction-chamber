//! Molecular diffusivities from a species' formula (and charge), for the transfer rates of Stage 8.
//!
//! * liquid (dilute solute in water or another solvent): Hayduk-Laudie (1974), needs the molar volume at the normal
//!   boiling point, here from the Le Bas atomic volume increments.
//! * gas (dilute vapour in air): Fuller-Schettler-Giddings (1966) with atomic diffusion volumes.
//! * ions: Nernst-Einstein from the limiting molar conductivity when the species record has one, else a
//!   Stokes-Einstein estimate from the ion's charge-scaled hydrodynamic radius.
//!
//! The two small increment tables are method parameters (Le Bas volumes, Fuller atomic diffusion volumes), not
//! per-compound data: they apply to any molecule built from these elements.

use crate::transport::{viscosity_water_pa_s, K_BOLTZMANN};
use std::collections::HashMap;

/// Le Bas atomic volume increments, cm3/mol (Reid, Prausnitz & Poling, The Properties of Gases and Liquids, table 4-8).
fn le_bas_increment(el: &str) -> f64 {
    match el {
        "C" => 14.8,
        "H" => 3.7,
        "O" => 7.4,
        "N" => 15.6,
        "S" => 25.6,
        "F" => 8.7,
        "Cl" => 24.6,
        "Br" => 27.0,
        "I" => 37.0,
        "P" => 27.0,
        "Si" => 32.0,
        // a metal or other element without an entry: a sphere of its covalent radius is a poor guess, so use the
        // rough rule of 1.5 x the element's molar volume class (~ 15 cm3/mol)
        _ => 15.0,
    }
}

/// Atomic diffusion volumes of the Fuller-Schettler-Giddings method (Reid, Prausnitz & Poling, table 11-1).
fn fuller_increment(el: &str) -> f64 {
    match el {
        "C" => 15.9,
        "H" => 2.31,
        "O" => 6.11,
        "N" => 4.54,
        "F" => 14.7,
        "Cl" => 21.0,
        "Br" => 21.9,
        "I" => 29.8,
        "S" => 22.9,
        _ => 16.0,
    }
}

/// Fuller diffusion volume of air (dimensionless, same units as the increments).
pub const FULLER_VOLUME_AIR: f64 = 19.7;
/// Molar mass of air, g/mol.
pub const MOLAR_MASS_AIR: f64 = 28.97;

/// Molar volume at the normal boiling point, cm3/mol, by Le Bas additive increments.
pub fn le_bas_volume_cm3_mol(elements: &HashMap<String, f64>) -> f64 {
    elements.iter().map(|(e, &n)| le_bas_increment(e) * n).sum::<f64>().max(10.0)
}

/// Fuller diffusion volume of a molecule from its elemental formula.
pub fn fuller_volume(elements: &HashMap<String, f64>) -> f64 {
    elements.iter().map(|(e, &n)| fuller_increment(e) * n).sum::<f64>().max(2.0)
}

/// Diffusivity (m2/s) of a dilute solute in a liquid of viscosity `eta_pa_s` at `t_k` (Hayduk-Laudie).
/// D = 13.26e-5 eta_cP^-1.14 V_b^-0.589 cm2/s, valid for non-electrolyte solutes in water and in solvents of low
/// viscosity (eta < ~30 cP).
pub fn hayduk_laudie_m2_s(elements: &HashMap<String, f64>, eta_pa_s: f64) -> f64 {
    let eta_cp = (eta_pa_s * 1e3).max(0.05);
    let v_b = le_bas_volume_cm3_mol(elements);
    13.26e-5 * eta_cp.powf(-1.14) * v_b.powf(-0.589) * 1e-4
}

/// Diffusivity (m2/s) of a species in water at `t_k`: a neutral molecule by Hayduk-Laudie; an ion from its record's
/// limiting molar conductivity (Nernst-Einstein, D = lambda R T / (|z| F^2)) when it has one, otherwise
/// Stokes-Einstein with a hydrodynamic radius that shrinks with the charge density, r = 0.21 nm x (1 + 1/|z|)... (a
/// 1+ ion ~ 0.42 nm, a 2+ ion ~ 0.31 nm... no, bounded to the 0.1-0.4 nm range), speculative.
pub fn species_diffusivity_water_m2_s(species: &str, t_k: f64) -> f64 {
    let eta = viscosity_water_pa_s(t_k);
    let charge = crate::ions::species_charge(species);
    let elements = crate::ions::species_elements(species).unwrap_or_default();
    if charge == 0 {
        return hayduk_laudie_m2_s(&elements, eta);
    }
    if let Some(l) = crate::transfer::electrochem::limiting_conductivity_s_cm2_mol(species) {
        // lambda in S cm2/mol -> D = lambda R T / (|z| F^2), with lambda in S m2/mol = lambda 1e-4
        let f = crate::physics::FARADAY;
        let d298 = l * 1e-4 * crate::physics::R_GAS * 298.15 / (charge.abs() as f64 * f * f);
        // Walden: D eta / T constant
        return d298 * (t_k / 298.15) * (viscosity_water_pa_s(298.15) / eta);
    }
    let z = (charge.abs() as f64).max(1.0);
    let r = (0.42e-9 / z.powf(0.5)).clamp(0.15e-9, 0.42e-9);
    K_BOLTZMANN * t_k / (6.0 * std::f64::consts::PI * eta * r)
}

/// Binary gas diffusivity in air (m2/s), Fuller-Schettler-Giddings: D = 0.00143 T^1.75 / (P M_AB^0.5 (v_A^1/3 +
/// v_B^1/3)^2) cm2/s with P in bar.
pub fn fuller_gas_diffusivity_m2_s(t_k: f64, p_pa: f64, molar_mass_g_mol: f64, elements: &HashMap<String, f64>) -> f64 {
    let p_bar = (p_pa / 1e5).max(1e-3);
    let m_b = molar_mass_g_mol.max(2.0);
    let m_ab = 2.0 / (1.0 / MOLAR_MASS_AIR + 1.0 / m_b);
    let v_b = if elements.is_empty() { m_b * 0.5 } else { fuller_volume(elements) };
    let denom = p_bar * m_ab.sqrt() * (FULLER_VOLUME_AIR.cbrt() + v_b.cbrt()).powi(2);
    0.00143 * t_k.max(100.0).powf(1.75) / denom * 1e-4
}

#[cfg(test)]
mod tests {
    use super::*;

    fn el(pairs: &[(&str, f64)]) -> HashMap<String, f64> {
        pairs.iter().map(|(k, v)| (k.to_string(), *v)).collect()
    }

    #[test]
    fn co2_in_water() {
        let d = hayduk_laudie_m2_s(&el(&[("C", 1.0), ("O", 2.0)]), 0.89e-3);
        assert!(d > 1.5e-9 && d < 2.6e-9, "D(CO2, water) = {:e} (literature 1.9e-9)", d);
    }

    #[test]
    fn hexane_in_air() {
        let d = fuller_gas_diffusivity_m2_s(295.0, 101325.0, 86.18, &el(&[("C", 6.0), ("H", 14.0)]));
        assert!(d > 6e-6 && d < 9e-6, "D(hexane, air) = {:e} (literature 7.5e-6)", d);
    }
}
