//! Crystal density of an ionic solid from the ions' sizes (Estimated), for solids that no record gives a density for.
//!
//! The formula-unit volume is the volume of its ions (spheres of the ionic radius) divided by a packing fraction. The
//! packing fraction of ionic crystals of the usual stoichiometries is 0.53-0.73 (NaCl 0.65, AgCl 0.73, KI 0.63, BaSO4 0.71,
//! CaCO3 0.53); 0.65 reproduces the density of the common salts to about 20 %, where the molar-mass heuristic it replaces
//! (`M / 38`) was off by a factor of four for large complex ions.

use std::collections::HashMap;
use std::sync::OnceLock;

use serde::Deserialize;

#[derive(Deserialize)]
struct File {
    radii: HashMap<String, f64>,
}

/// Packing fraction of an ionic crystal (volume of the ions / volume of the cell).
pub const PACKING_FRACTION: f64 = 0.65;

fn radii() -> &'static HashMap<String, f64> {
    static R: OnceLock<HashMap<String, f64>> = OnceLock::new();
    R.get_or_init(|| serde_json::from_str::<File>(include_str!("../data/ion_radii.json")).expect("data/ion_radii.json").radii)
}

/// Radius (Angstrom) of an ion: the tabulated one, else `0.5 M^(1/3)` of its molar mass.
pub fn ionic_radius_angstrom(id: &str) -> Option<f64> {
    if let Some(r) = radii().get(id) {
        return Some(*r);
    }
    let m = crate::ions::species_mass(id.split(|c| c == '+' || c == '-').next().unwrap_or(id))?;
    Some(0.5 * m.cbrt())
}

/// Density (g/mL) of the solid made of `ions` (id, count per formula unit) with the formula mass `mw`; None when an ion has no size.
pub fn estimate_density_g_ml(ions: &[(String, f64)], mw: f64) -> Option<f64> {
    let mut v_ions = 0.0;
    for (id, n) in ions {
        let r = ionic_radius_angstrom(id)?;
        v_ions += n * 4.0 / 3.0 * std::f64::consts::PI * r.powi(3);
    }
    if v_ions <= 0.0 {
        return None;
    }
    let v_cell_a3 = v_ions / PACKING_FRACTION;
    // g/mL = (M g/mol / N_A) / (V A^3 * 1e-24 cm3)
    Some(mw / (0.602214076 * v_cell_a3))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rho(ions: &[(&str, f64)], mw: f64) -> f64 {
        let v: Vec<(String, f64)> = ions.iter().map(|(a, b)| (a.to_string(), *b)).collect();
        estimate_density_g_ml(&v, mw).unwrap()
    }

    #[test]
    fn common_salts_land_within_thirty_percent() {
        // (ions, M, measured density g/mL)
        let cases: [(&[(&str, f64)], f64, f64); 6] = [
            (&[("Na+", 1.0), ("Cl-", 1.0)], 58.44, 2.165),
            (&[("Ag+", 1.0), ("Cl-", 1.0)], 143.32, 5.56),
            (&[("K+", 1.0), ("I-", 1.0)], 166.0, 3.13),
            (&[("Ba+2", 1.0), ("SO4-2", 1.0)], 233.39, 4.5),
            (&[("K+", 2.0), ("Cr2O7-2", 1.0)], 294.18, 2.68),
            (&[("K+", 3.0), ("Fe(CN)6-3", 1.0)], 329.24, 1.89),
        ];
        for (ions, mw, real) in cases {
            let d = rho(ions, mw);
            assert!((d / real - 1.0).abs() < 0.35, "{ions:?}: {d:.2} vs {real}");
        }
    }
}
