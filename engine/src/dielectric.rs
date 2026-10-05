//! Static dielectric constant of a liquid component (decision: data first, structure estimate second, never a name).
//!
//! A measured value is a *point* of eps(T): `data/dielectric.json` holds eps at 298.15 K by InChIKey; the temperature
//! dependence is the generic ln(eps) slope of molecular liquids (d ln eps / dT = -4.6e-3 /K, the value of water and within
//! 3-5e-3 for the common solvents). A liquid without a point gets an estimate from its elemental composition (the share of
//! N, O and halogen atoms among the heavy atoms interpolates ln eps between a hydrocarbon, 1.9, and a strongly dipolar
//! liquid, 40); that estimate is Speculative and the phase model labels it.

use std::collections::HashMap;
use std::sync::OnceLock;

/// d ln(eps) / dT of molecular liquids, 1/K.
pub const DIELECTRIC_LN_SLOPE_PER_K: f64 = -4.6e-3;

pub const EPS_HYDROCARBON: f64 = 1.9;
pub const EPS_STRONGLY_POLAR: f64 = 40.0;

fn table() -> &'static HashMap<String, f64> {
    static T: OnceLock<HashMap<String, f64>> = OnceLock::new();
    T.get_or_init(|| {
        let v: serde_json::Value = serde_json::from_str(include_str!("../data/dielectric.json")).expect("dielectric.json");
        v["eps"].as_object().map(|o| o.iter().filter_map(|(k, x)| Some((k.clone(), x.as_f64()?))).collect()).unwrap_or_default()
    })
}

/// Tabulated eps at 298.15 K of the liquid with this InChIKey.
pub fn tabulated_298(inchikey: &str) -> Option<f64> {
    table().get(inchikey).copied()
}

/// Moves a 298.15 K value to `t_k` with the generic slope.
pub fn at_temperature(eps_298: f64, t_k: f64) -> f64 {
    (eps_298 * (DIELECTRIC_LN_SLOPE_PER_K * (t_k - 298.15)).exp()).clamp(1.2, 120.0)
}

/// Speculative eps(298.15 K) from the heavy-atom composition (`elements`: element -> count, hydrogen included or not).
pub fn estimate_298(elements: &HashMap<String, f64>) -> f64 {
    let heavy: f64 = elements.iter().filter(|(e, _)| e.as_str() != "H").map(|(_, n)| *n).sum();
    if heavy <= 0.0 {
        return EPS_HYDROCARBON;
    }
    let get = |e: &str| elements.get(e).copied().unwrap_or(0.0);
    let polar = get("N") + get("O") + 0.5 * (get("F") + get("Cl") + get("Br") + get("I")) + 0.5 * get("S");
    let x = (polar / heavy / 0.3).clamp(0.0, 1.0);
    (EPS_HYDROCARBON.ln() + (EPS_STRONGLY_POLAR.ln() - EPS_HYDROCARBON.ln()) * x).exp()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn table_and_estimate_are_sane() {
        assert_eq!(tabulated_298("LFQSCWFLJHTTHZ-UHFFFAOYSA-N"), Some(24.3));
        let hexane: HashMap<String, f64> = [("C".to_string(), 6.0), ("H".to_string(), 14.0)].into_iter().collect();
        assert!((estimate_298(&hexane) - 1.9).abs() < 1e-9);
        let nitro: HashMap<String, f64> = [("C".to_string(), 1.0), ("N".to_string(), 1.0), ("O".to_string(), 2.0)].into_iter().collect();
        assert!(estimate_298(&nitro) > 30.0);
        assert!(at_temperature(78.4, 273.15) > at_temperature(78.4, 323.15));
    }
}
