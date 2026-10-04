//! Estimators for the thermodynamic data a species record lacks: entropy of an ion or a solid when only the enthalpy of
//! formation is known (T3), and the temperature dependence of the heat capacity when only Cp(298) is known (T2). Every
//! output is tier Estimated; parameters are data (`data/thermo_estimators.json`), validated against the seeded NBS rows
//! by `tests/open_items.rs`.

use std::collections::HashMap;
use std::sync::OnceLock;

use serde::Deserialize;

use crate::physics::R_GAS;

#[derive(Deserialize)]
struct Cation {
    a: f64,
    b: f64,
    c: f64,
    k: f64,
}

#[derive(Deserialize)]
struct AnionPoly {
    a: f64,
    b_cbrt_m: f64,
    c_z: f64,
}

#[derive(Deserialize)]
struct IonEntropy {
    cation: Cation,
    anion_monatomic: Cation,
    anion_polyatomic: AnionPoly,
}

#[derive(Deserialize)]
struct Params {
    element_entropy: HashMap<String, serde_json::Value>,
    solid_entropy_latimer: HashMap<String, serde_json::Value>,
    solid_cp_kopp: HashMap<String, serde_json::Value>,
    liquid_cp_kopp: HashMap<String, serde_json::Value>,
    ion_entropy: IonEntropy,
}

fn params() -> &'static Params {
    static P: OnceLock<Params> = OnceLock::new();
    P.get_or_init(|| serde_json::from_str(include_str!("../../data/thermo_estimators.json")).expect("data/thermo_estimators.json"))
}

/// Standard entropy per atom of an element in its reference state, J/(mol K); None for an element without a row.
pub fn element_entropy_per_atom(el: &str) -> Option<f64> {
    let v = params().element_entropy.get(el)?.as_array()?;
    Some(v.first()?.as_f64()? / v.get(1)?.as_f64()?.max(1.0))
}

/// Sum of the standard entropies of the elements of a formula in their reference states (J/(mol K)). An element without a
/// row counts 35 J/(mol K) (the median of the table).
pub fn elements_entropy_sum(formula: &str) -> f64 {
    let elems = crate::ions::species_elements(formula).unwrap_or_default();
    elems.iter().map(|(el, n)| n * element_entropy_per_atom(el).unwrap_or(35.0)).sum()
}

/// Entropy S(298) of a solid compound from Latimer's element contributions (J/(mol K)).
pub fn solid_entropy_latimer(formula: &str) -> f64 {
    let t = &params().solid_entropy_latimer;
    let default = t.get("default").and_then(|v| v.as_f64()).unwrap_or(30.0);
    let elems = crate::ions::species_elements(formula).unwrap_or_default();
    elems.iter().map(|(el, n)| n * t.get(el).and_then(|v| v.as_f64()).unwrap_or(default)).sum()
}

fn atom_count(formula: &str) -> f64 {
    crate::ions::species_elements(formula).map(|e| e.values().sum::<f64>()).unwrap_or(1.0).max(1.0)
}

/// Conventional entropy S(298) of an aqueous ion (J/(mol K), S(H+) = 0), Powell-Latimer form fitted per class: monatomic
/// cations and anions, polyatomic anions. A polyatomic cation uses the cation form with the radius from its molar mass.
pub fn ion_entropy_conventional(formula: &str, charge: i32, mass: f64, radius_a: f64) -> f64 {
    let p = &params().ion_entropy;
    let z = charge.abs() as f64;
    let ln_m = 1.5 * R_GAS * mass.max(1.0).ln();
    if charge > 0 {
        let c = &p.cation;
        c.a + c.b * ln_m + c.c * z / (radius_a + c.k).powi(2)
    } else if atom_count(formula) <= 1.0 {
        let c = &p.anion_monatomic;
        c.a + c.b * ln_m + c.c * z / (radius_a + c.k).powi(2)
    } else {
        let c = &p.anion_polyatomic;
        c.a + c.b_cbrt_m * mass.max(1.0).cbrt() + c.c_z * z
    }
}

/// Formation entropy of an aqueous ion from its conventional entropy: dfS = S(ion) - sum S(elements) + (z/2) S(H2), the
/// hydrogen term coming from the convention dfG(H+) = 0 (formation from the elements and H2 / H+).
pub fn ion_formation_entropy(formula: &str, charge: i32, mass: f64, radius_a: f64) -> f64 {
    let s_h2 = element_entropy_per_atom("H").unwrap_or(65.34) * 2.0;
    ion_entropy_conventional(formula, charge, mass, radius_a) - elements_entropy_sum(formula) + 0.5 * charge as f64 * s_h2
}

/// Heat capacity at 298 K from Kopp's rule (solid or liquid compound), J/(mol K).
pub fn kopp_cp(formula: &str, liquid: bool) -> f64 {
    let t = if liquid { &params().liquid_cp_kopp } else { &params().solid_cp_kopp };
    let default = t.get("default").and_then(|v| v.as_f64()).unwrap_or(26.0);
    let elems = crate::ions::species_elements(formula).unwrap_or_default();
    elems.iter().map(|(el, n)| n * t.get(el).and_then(|v| v.as_f64()).unwrap_or(default)).sum()
}

/// Temperature dependence of a heat capacity known at 298.15 K.
#[derive(Clone, Debug)]
pub enum CpModel {
    /// Cp independent of T.
    Constant(f64),
    /// Einstein solid: 3 n_atoms R E(theta / T) with theta set by Cp(298); tends to the Dulong-Petit limit at high T.
    Einstein { cp298: f64, n_atoms: f64, theta: f64 },
    /// Ideal gas with frozen translation + rotation (`cp_tr_rot`) and `n_modes` Einstein oscillators of one effective
    /// temperature `theta`, set so that Cp(298.15 K) equals the datum.
    EinsteinGas { cp_tr_rot: f64, n_modes: f64, theta: f64 },
    /// Joback ideal-gas polynomial Cp(T) = a + bT + cT^2 + dT^3 shifted so that it passes through the datum at 298.15 K.
    Polynomial { coeffs: [f64; 4], offset: f64 },
}

const T_REF: f64 = 298.15;

fn einstein_fn(x: f64) -> f64 {
    // x^2 e^x / (e^x - 1)^2
    if x < 1e-6 {
        return 1.0;
    }
    if x > 60.0 {
        return 0.0;
    }
    let e = x.exp();
    x * x * e / ((e - 1.0) * (e - 1.0))
}

impl CpModel {
    /// Einstein model through (298.15 K, cp298) for a solid of `n_atoms` atoms; constant when Cp(298) is at the
    /// Dulong-Petit limit (or below the range of the model).
    pub fn einstein(cp298: f64, n_atoms: f64) -> CpModel {
        let limit = 3.0 * R_GAS * n_atoms;
        let y = cp298 / limit;
        if !(0.02..0.995).contains(&y) {
            return CpModel::Constant(cp298);
        }
        // E(x) = y, x = theta / 298.15; E is monotonically decreasing
        let (mut lo, mut hi) = (1e-4_f64, 60.0_f64);
        for _ in 0..80 {
            let mid = 0.5 * (lo + hi);
            if einstein_fn(mid) > y { lo = mid } else { hi = mid }
        }
        CpModel::Einstein { cp298, n_atoms, theta: 0.5 * (lo + hi) * T_REF }
    }

    /// Ideal gas of `n_atoms` atoms: translation (3/2 R) and rotation (R linear, 3/2 R non-linear) plus 3n-5 / 3n-6
    /// Einstein vibrations. `cp298 = Some(c)` anchors the vibrational temperature at the datum; `None` leaves the
    /// vibrations frozen (the lower bound: `cp_tr_rot` everywhere).
    pub fn einstein_gas(cp_tr_rot_or_datum: f64, anchor: f64, n_atoms: f64, linear: bool) -> CpModel {
        if n_atoms <= 1.0 {
            return CpModel::Constant(2.5 * R_GAS);
        }
        let cp_tr_rot = if linear { 3.5 * R_GAS } else { 4.0 * R_GAS };
        let n_modes = (3.0 * n_atoms - if linear { 5.0 } else { 6.0 }).max(1.0);
        if anchor <= 0.0 {
            return CpModel::Constant(cp_tr_rot_or_datum.max(cp_tr_rot));
        }
        let y = ((anchor - cp_tr_rot) / (n_modes * R_GAS)).clamp(0.0015, 0.995);
        let (mut lo, mut hi) = (1e-4_f64, 60.0_f64);
        for _ in 0..80 {
            let mid = 0.5 * (lo + hi);
            if einstein_fn(mid) > y { lo = mid } else { hi = mid }
        }
        CpModel::EinsteinGas { cp_tr_rot, n_modes, theta: 0.5 * (lo + hi) * T_REF }
    }

    pub fn polynomial(coeffs: [f64; 4], cp298: f64) -> CpModel {
        let [a, b, c, d] = coeffs;
        let at = a + b * T_REF + c * T_REF * T_REF + d * T_REF.powi(3);
        CpModel::Polynomial { coeffs, offset: cp298 - at }
    }

    pub fn cp(&self, t: f64) -> f64 {
        match self {
            CpModel::Constant(c) => *c,
            CpModel::Einstein { n_atoms, theta, .. } => 3.0 * R_GAS * n_atoms * einstein_fn(theta / t),
            CpModel::EinsteinGas { cp_tr_rot, n_modes, theta } => cp_tr_rot + n_modes * R_GAS * einstein_fn(theta / t),
            CpModel::Polynomial { coeffs: [a, b, c, d], offset } => a + b * t + c * t * t + d * t.powi(3) + offset,
        }
    }

    /// Integral of Cp dT from 298.15 K to `t` (J/mol).
    pub fn delta_h(&self, t: f64) -> f64 {
        match self {
            CpModel::Constant(c) => c * (t - T_REF),
            CpModel::Einstein { n_atoms, theta, .. } => {
                let h = |t: f64| 3.0 * R_GAS * n_atoms * theta / ((theta / t).exp() - 1.0);
                h(t) - h(T_REF)
            }
            CpModel::EinsteinGas { cp_tr_rot, n_modes, theta } => {
                let h = |t: f64| n_modes * R_GAS * theta / ((theta / t).exp() - 1.0);
                cp_tr_rot * (t - T_REF) + h(t) - h(T_REF)
            }
            CpModel::Polynomial { coeffs: [a, b, c, d], offset } => {
                let f = |t: f64| (a + offset) * t + b * t * t / 2.0 + c * t.powi(3) / 3.0 + d * t.powi(4) / 4.0;
                f(t) - f(T_REF)
            }
        }
    }

    /// Integral of Cp / T dT from 298.15 K to `t` (J/(mol K)).
    pub fn delta_s(&self, t: f64) -> f64 {
        match self {
            CpModel::Constant(c) => c * (t / T_REF).ln(),
            CpModel::Einstein { n_atoms, theta, .. } => {
                let s = |t: f64| {
                    let x = theta / t;
                    3.0 * R_GAS * n_atoms * (x / (x.exp() - 1.0) - (1.0 - (-x).exp()).ln())
                };
                s(t) - s(T_REF)
            }
            CpModel::EinsteinGas { cp_tr_rot, n_modes, theta } => {
                let s = |t: f64| {
                    let x = theta / t;
                    n_modes * R_GAS * (x / (x.exp() - 1.0) - (1.0 - (-x).exp()).ln())
                };
                cp_tr_rot * (t / T_REF).ln() + s(t) - s(T_REF)
            }
            CpModel::Polynomial { coeffs: [a, b, c, d], offset } => {
                let f = |t: f64| (a + offset) * t.ln() + b * t + c * t * t / 2.0 + d * t.powi(3) / 3.0;
                f(t) - f(T_REF)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn einstein_model_reproduces_its_anchor_and_the_dulong_petit_limit() {
        // CaCO3: 5 atoms, Cp(298) = 81.9 J/(mol K)
        let m = CpModel::einstein(81.9, 5.0);
        assert!((m.cp(298.15) - 81.9).abs() < 1e-6);
        let hi = m.cp(1500.0);
        assert!(hi > 115.0 && hi < 3.0 * R_GAS * 5.0 + 1e-9, "{}", hi);
        // H and S integrals agree with numerical quadrature of Cp
        let (mut h, mut s) = (0.0, 0.0);
        let n = 20000;
        let (t0, t1) = (298.15, 1100.0);
        for i in 0..n {
            let t = t0 + (t1 - t0) * (i as f64 + 0.5) / n as f64;
            h += m.cp(t) * (t1 - t0) / n as f64;
            s += m.cp(t) / t * (t1 - t0) / n as f64;
        }
        assert!((m.delta_h(t1) - h).abs() < 1.0, "{} vs {}", m.delta_h(t1), h);
        assert!((m.delta_s(t1) - s).abs() < 1e-3);
    }

    #[test]
    fn polynomial_shift_and_integrals() {
        let m = CpModel::polynomial([20.0, 0.05, 0.0, 0.0], 40.0);
        assert!((m.cp(298.15) - 40.0).abs() < 1e-9);
        let (t0, t1) = (298.15, 800.0);
        let n = 20000;
        let (mut h, mut s) = (0.0, 0.0);
        for i in 0..n {
            let t = t0 + (t1 - t0) * (i as f64 + 0.5) / n as f64;
            h += m.cp(t) * (t1 - t0) / n as f64;
            s += m.cp(t) / t * (t1 - t0) / n as f64;
        }
        assert!((m.delta_h(t1) - h).abs() < 1.0);
        assert!((m.delta_s(t1) - s).abs() < 1e-3);
    }
}
