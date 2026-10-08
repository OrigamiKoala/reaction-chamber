//! Complex formation and ligand substitution kinetics (Eigen-Wilkins mechanism).
//!
//! For a dissociative-interchange (Id) substitution, `k_f = K_os * k_ex`, where `k_ex` is the measured water-exchange rate
//! constant of the aqua ion (`data/water_exchange.json`) and `K_os` is the outer-sphere association constant (the Fuoss
//! constant of `ion_pairing`; for a neutral ligand the statistical value `4 pi N a^3 / 3000`). Dissociation follows from
//! detailed balance, `k_d = k_f / K`, so the end state of a vessel is the equilibrium the row already describes and only the
//! approach to it is slowed (`EquilibriumRate`, relaxed in `Vessel::step_equilibria`).
//!
//! * A complexation row is `M + n L <=> ML_n` with one metal ion of the table and one ligand that is neither H+ nor OH-
//!   (those are proton transfers, diffusion-controlled). The first metal-ligand bond is rate-limiting; ring closure and the
//!   later bonds of a polydentate or multi-ligand product are taken as fast (`FirstStep`).
//! * Conjugate-base path: the hydroxo ion of the metal (`FeOH2+`, `CrOH2+`) exchanges water orders of magnitude faster than
//!   the aqua ion. When the table has a row for it and the engine has the hydrolysis equilibrium, the rate gets a second
//!   term proportional to `[OH-]`, so the pH-weighted sum over both forms emerges: `k_f(M) + k_f(MOH) K_h / [H+]`.
//! * Labile ions: when `k_f` is large enough that the relaxation at 10 mM ligand is complete within a bench step
//!   (`k_f * 0.01 M >= INSTANT_RELAXATION_PER_S`), the row stays instantaneous (no cost).
//! * Associative (Ia) ions depend on the entering ligand; their rate is labelled an estimate in the source line.

use std::collections::HashMap;
use std::sync::OnceLock;

use serde::Deserialize;

use crate::chem_db::{EquilibriumRate, FirstStep, GeneralEquilibrium, RateTerm};
use crate::ion_pairing::fuoss_k;

/// A relaxation that fast (per second, at 10 mM ligand) is complete within one bench step: the row stays instantaneous.
pub const INSTANT_RELAXATION_PER_S: f64 = 1.0e3;

/// Activation enthalpy of the autoionisation of water, kJ/mol (K_w(T) enters the hydroxo path).
const DH_WATER_KJ: f64 = 55.8;

#[derive(Deserialize, Clone, Debug)]
pub struct WaterExchangeRow {
    pub ion: String,
    pub k_ex: f64,
    pub delta_h_kj: Option<f64>,
    pub mechanism: String,
    pub source: String,
    /// `verified_secondary` when `k_ex` matches a published copy of the cited table, `recalled` when it was written from memory
    /// and has not been checked. Absent = recalled.
    #[serde(default)]
    pub verification: Option<String>,
}

#[derive(Deserialize)]
struct WaterExchangeFile {
    ions: Vec<WaterExchangeRow>,
}

fn exchange_table() -> &'static HashMap<String, WaterExchangeRow> {
    static TABLE: OnceLock<HashMap<String, WaterExchangeRow>> = OnceLock::new();
    TABLE.get_or_init(|| {
        let file: WaterExchangeFile = serde_json::from_str(include_str!("../data/water_exchange.json"))
            .expect("water_exchange.json is valid");
        file.ions.into_iter().map(|r| (r.ion.clone(), r)).collect()
    })
}

/// Lookup the water exchange rate constant (s^-1) of an aqua ion.
pub fn water_exchange_rate(ion: &str) -> Option<&'static WaterExchangeRow> {
    exchange_table().get(ion)
}

/// Hydrolysis `M + H2O <=> MOH + H+` of the engine's own rows: aqua ion -> (hydroxo species, log K at 298 K, dH kJ/mol).
fn hydrolysis_rows() -> &'static HashMap<String, (String, f64, f64)> {
    static ROWS: OnceLock<HashMap<String, (String, f64, f64)>> = OnceLock::new();
    ROWS.get_or_init(|| {
        let mut out = HashMap::new();
        for eq in crate::chem_db::raw_default_equilibria() {
            let others = |m: &HashMap<String, f64>| m.keys().filter(|k| k.as_str() != crate::db::seed::WATER).cloned().collect::<Vec<_>>();
            let (r, p) = (others(&eq.reactants), others(&eq.products));
            if r.len() != 1 || p.len() != 2 || !p.iter().any(|k| k == crate::db::seed::PROTON) {
                continue;
            }
            let metal = &r[0];
            let hydroxo = p.iter().find(|k| k.as_str() != crate::db::seed::PROTON).unwrap();
            if water_exchange_rate(metal).is_some() && water_exchange_rate(hydroxo).is_some() {
                out.entry(metal.clone()).or_insert((hydroxo.clone(), eq.log_k_298, eq.delta_h_kj));
            }
        }
        out
    })
}

/// Outer-sphere association constant (M^-1) of a metal ion of charge `zm` and a ligand of charge `zl` at contact distance `a`.
fn k_outer_sphere(zm: i32, zl: i32, a_angstrom: f64, t_k: f64) -> f64 {
    if zl == 0 || zm == 0 {
        const N_A: f64 = 6.02214076e23;
        let a_cm = a_angstrom.max(2.0) * 1e-8;
        4.0 * std::f64::consts::PI * N_A * a_cm.powi(3) / 3000.0
    } else {
        fuoss_k(zm, zl, a_angstrom.max(2.0), t_k)
    }
}

/// Forward rate constant `k_f` (M^-1 s^-1) of the aqua form of `metal` with a ligand, and the rate law as an
/// `EquilibriumRate` (None for a labile ion: the row is instantaneous). `n` is the number of ligands the row binds.
pub fn eigen_wilkins_rate(
    metal: &str,
    metal_charge: i32,
    ligand_charge: i32,
    contact_distance_a: f64,
    t_k: f64,
) -> Option<EquilibriumRate> {
    let row = water_exchange_rate(metal)?;
    let k_os = k_outer_sphere(metal_charge, ligand_charge, contact_distance_a, t_k);
    let k_f = k_os * row.k_ex;
    let ea_j = row.delta_h_kj.unwrap_or(50.0) * 1000.0;
    let mut terms = vec![RateTerm { catalyst: None, k_298: k_f, ea_j_mol: ea_j }];
    let mut label = format!("k_ex = {:.2e} s^-1 ({}, {})", row.k_ex, row.mechanism, row.source);

    // conjugate-base path through the hydroxo ion
    if let Some((hydroxo, log_k_h, dh_h)) = hydrolysis_rows().get(metal) {
        if let Some(orow) = water_exchange_rate(hydroxo) {
            let k_f_oh = k_outer_sphere(metal_charge - 1, ligand_charge, contact_distance_a, t_k) * orow.k_ex;
            // k_f(MOH) K_h / [H+] = k_f(MOH) K_h [OH-] / K_w
            let kw = 10f64.powf(crate::chem_db::water_log_kw(298.15));
            terms.push(RateTerm {
                catalyst: Some(crate::db::seed::HYDROXIDE.to_string()),
                k_298: k_f_oh * 10f64.powf(*log_k_h) / kw,
                ea_j_mol: orow.delta_h_kj.unwrap_or(50.0) * 1000.0 + (dh_h - DH_WATER_KJ) * 1000.0,
            });
            label.push_str(&format!("; hydroxo path {} k_ex = {:.2e} s^-1", hydroxo, orow.k_ex));
        }
    }
    if row.mechanism.starts_with("Ia") {
        label.push_str("; associative ion: depends on the entering ligand, estimate");
    }
    let flag = if row.verification.as_deref().map_or(false, |v| v.starts_with("verified")) { "" } else { " [k_ex recalled, not checked against the table]" };
    Some(EquilibriumRate {
        terms,
        first_step: None,
        source: format!("Eigen-Wilkins k_f = K_os k_ex, K_os = {:.3e} M^-1: {}{}", k_os, label, flag),
    })
}

/// True when `eq` is a complexation `M + n L <=> ML_n` of an aqua ion of the table (one product, one metal, one ligand that
/// is neither H+ nor OH-): the metal, the ligand and the number of ligands.
fn complexation_parts(eq: &GeneralEquilibrium) -> Option<(String, String, f64)> {
    let solvent = |k: &str| k == crate::db::seed::WATER;
    let reactants: Vec<(&String, &f64)> = eq.reactants.iter().filter(|(k, _)| !solvent(k)).collect();
    let products: Vec<(&String, &f64)> = eq.products.iter().filter(|(k, _)| !solvent(k)).collect();
    if reactants.len() != 2 || products.len() != 1 || (*products[0].1 - 1.0).abs() > 1e-9 {
        return None;
    }
    let metal = reactants.iter().find(|(k, c)| (**c - 1.0).abs() < 1e-9 && water_exchange_rate(k).is_some() && crate::ions::species_charge(k) > 0)?;
    let ligand = reactants.iter().find(|(k, _)| *k != metal.0)?;
    if ligand.0 == crate::db::seed::PROTON || ligand.0 == crate::db::seed::HYDROXIDE {
        return None;
    }
    Some((metal.0.clone(), ligand.0.clone(), *ligand.1))
}

/// Gives a complexation row the ligand-substitution kinetics of its metal ion when they are slow on the bench. Rows that
/// already have a rate, are not complexations, or belong to a labile ion are left as they are (instantaneous).
pub fn attach_rate(eq: &mut GeneralEquilibrium) {
    if eq.rate.is_some() {
        return;
    }
    let Some((metal, ligand, n)) = complexation_parts(eq) else { return };
    let zm = crate::ions::species_charge(&metal);
    let zl = crate::ions::species_charge(&ligand);
    let rm = crate::crystal::ionic_radius_angstrom(&metal).unwrap_or(0.8);
    let rl = crate::crystal::ionic_radius_angstrom(&ligand).unwrap_or(1.4);
    let dist = rm + rl + crate::ion_pairing::CONTACT_OFFSET_A;
    let Some(mut rate) = eigen_wilkins_rate(&metal, zm, zl, dist, 298.15) else { return };
    // at 10 mM ligand, in the aqua form (the hydroxo path only adds to it): is the relaxation complete within a bench step?
    if rate.terms[0].k_298 * 0.01 >= INSTANT_RELAXATION_PER_S {
        return;
    }
    rate.first_step = Some(FirstStep { metal, ligand, n });
    eq.rate = Some(rate);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chem_db::get_default_equilibria;

    #[test]
    fn chromium_is_inert_and_copper_is_labile() {
        assert!(water_exchange_rate("Cr+3").unwrap().k_ex < 1e-5);
        assert!(water_exchange_rate("Cu+2").unwrap().k_ex > 1e9);
        let cr = eigen_wilkins_rate("Cr+3", 3, -1, 3.5, 298.15).unwrap();
        assert!(cr.terms[0].k_298 < 1e-2, "Cr3+ + anion k_f {:e}", cr.terms[0].k_298);
        // the labile ion's complexation row is left instantaneous by attach_rate
        let mut cu = GeneralEquilibrium {
            id: "t".into(), name: "t".into(), equation: "".into(),
            reactants: [("Cu+2".to_string(), 1.0), ("Cl-".to_string(), 1.0)].into_iter().collect(),
            products: [("CuCl+".to_string(), 1.0)].into_iter().collect(),
            log_k_298: 0.4, delta_h_kj: 0.0, log_k_analytic: None, rate: None,
            tier: crate::types::ProvenanceTier::Estimated, source: String::new(),
        };
        attach_rate(&mut cu);
        assert!(cu.rate.is_none());
    }

    #[test]
    fn hydroxo_path_makes_iron_iii_faster_at_high_ph() {
        let r = eigen_wilkins_rate("Fe+3", 3, -1, 3.5, 298.15).unwrap();
        assert_eq!(r.terms.len(), 2, "aqua path and hydroxo path");
        let conc = |sp: &str| if sp == "OH-" { 1e-12 } else { 0.0 }; // pH 2
        let conc_hi = |sp: &str| if sp == "OH-" { 1e-10 } else { 0.0 }; // pH 4
        let (lo, hi) = (r.k_forward(298.15, &conc), r.k_forward(298.15, &conc_hi));
        assert!(hi > lo, "pH 4 {hi:e} vs pH 2 {lo:e}");
        // k_f(FeOH) K_h / [H+] at pH 2 equals the second term
        let (hydroxo, log_kh, _) = hydrolysis_rows().get("Fe+3").unwrap().clone();
        assert_eq!(hydroxo, "FeOH+2");
        let k_oh = k_outer_sphere(2, -1, 3.5, 298.15) * water_exchange_rate("FeOH+2").unwrap().k_ex;
        let expected = k_oh * 10f64.powf(log_kh) / 1e-2;
        let second = r.terms[1].k_298 * 1e-12;
        assert!((second / expected - 1.0).abs() < 0.05, "{second:e} vs {expected:e}");
    }

    #[test]
    fn substitution_keeps_equilibria_and_leaves_labile_rows_alone() {
        // The kinetics only slow the approach: the rows' equilibrium constants are the ones of the data files.
        let raw = crate::chem_db::raw_default_equilibria();
        let with = get_default_equilibria();
        assert_eq!(raw.len(), with.len());
        let mut slow = 0;
        for (a, b) in raw.iter().zip(&with) {
            assert_eq!(a.id, b.id);
            assert_eq!(a.log_k_298, b.log_k_298);
            assert_eq!(a.delta_h_kj, b.delta_h_kj);
            if b.rate.is_some() && a.rate.is_none() {
                slow += 1;
                assert!(b.rate.as_ref().unwrap().first_step.is_some(), "{} is slow without a first step", b.id);
            }
        }
        assert!(slow > 0, "some complexation rows are slow");
        let by_id = |id: &str| with.iter().find(|e| e.id == id);
        // Fe3+ + SCN- (core row) and Ni(NH3)n are slow, Cu(NH3)4 2+ and Co2+ chlorides are instantaneous
        assert!(by_id("iron_thiocyanate").unwrap().rate.is_some(), "Fe3+ + SCN- is rate-limited by water exchange");
        assert!(by_id("copper_tetraammine").unwrap().rate.is_none());
        assert!(by_id("co_cl_1").unwrap().rate.is_none());
        let mut ni = crate::ion_pairing::complex_equilibria(&|_| true)
            .into_iter()
            .find(|e| e.id == "cplx_Ni(NH3)6+2")
            .expect("hexaammine row");
        attach_rate(&mut ni);
        let rate = ni.rate.as_ref().expect("Ni2+ + NH3 is slow");
        assert_eq!(rate.first_step.as_ref().unwrap().n, 6.0);
        // the hydrolysis (proton transfer) is never slowed
        assert!(by_id("iron_monohydroxo").unwrap().rate.is_none());
    }
}
