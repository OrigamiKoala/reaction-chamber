//! What a glass pH electrode with a 3 M KCl reference junction reads in a liquid phase (I1).
//!
//! The engine's `current_ph` is the thermodynamic molal pH of the water-containing phase, `-log10(m_H gamma_H)`. An electrode
//! reads that plus the liquid-junction potential between its KCl bridge and the sample (Henderson's equation, linear mixing,
//! from the limiting ionic conductivities), and only means something where the medium is water: in a phase whose solvent
//! is mostly something else (water mole fraction below 0.5) the glass electrode is outside its calibrated range and the
//! meter shows nothing. A phase without water (an organic layer) has no pH at all.
//!
//! Henderson (zero current, concentrations varying linearly across the junction, Nernst-Einstein diffusion coefficients):
//! `phi_R - phi_L = -(RT/F) [sum_i (lambda_i / z_i) (c_i^R - c_i^L)] / (S_R - S_L) ln(S_R / S_L)`, `S = sum_i lambda_i c_i`,
//! lambda_i the molar ionic conductivity (S cm2 per mol of ion), z_i the signed charge. The reading is shifted by
//! `-(phi_R - phi_L) / (RT ln10 / F)` pH units (a sample that is negative of its bridge, an acid, reads high).

use crate::physics::{FARADAY, R_GAS};
use crate::transfer::electrochem::limiting_conductivity_s_cm2_mol;

#[derive(serde::Deserialize)]
struct ElectrodeData {
    bridge_molar: std::collections::BTreeMap<String, f64>,
    min_water_mole_fraction: f64,
}

fn data() -> &'static ElectrodeData {
    static D: std::sync::OnceLock<ElectrodeData> = std::sync::OnceLock::new();
    D.get_or_init(|| serde_json::from_str(include_str!("../data/ph_electrode.json")).expect("data/ph_electrode.json"))
}

/// Below this water mole fraction of the solvent the electrode is out of its aqueous range.
pub fn min_water_mole_fraction() -> f64 {
    data().min_water_mole_fraction
}

fn lambda_s_cm2_mol(sp: &str) -> f64 {
    limiting_conductivity_s_cm2_mol(sp).unwrap_or_else(|| {
        // Nernst-Einstein from the species' Stokes-Einstein diffusivity (per mole of ion)
        let z = crate::ions::species_charge(sp).abs() as f64;
        let d = crate::transfer::diffusion::species_diffusivity_water_m2_s(sp, 298.15);
        d * z * z * FARADAY * FARADAY / (R_GAS * 298.15) * 1e4
    })
}

/// Junction potential `phi_sample - phi_bridge` (V) for a sample holding `ions` (species id, mol/L).
pub fn henderson_junction_v(ions: &[(String, f64)], t_k: f64) -> f64 {
    // (lambda, z, c_bridge, c_sample) for every ion of either side
    let mut rows: Vec<(f64, f64, f64, f64)> = Vec::new();
    let bridge = &data().bridge_molar;
    for (sp, c_bridge) in bridge {
        let z = crate::ions::species_charge(sp) as f64;
        let c_sample = ions.iter().find(|(s, _)| s == sp).map_or(0.0, |(_, c)| *c);
        rows.push((lambda_s_cm2_mol(sp), z, *c_bridge, c_sample));
    }
    for (sp, c) in ions {
        if bridge.contains_key(sp) || *c <= 0.0 {
            continue;
        }
        let z = crate::ions::species_charge(sp) as f64;
        if z == 0.0 {
            continue;
        }
        rows.push((lambda_s_cm2_mol(sp), z, 0.0, *c));
    }
    let s_l: f64 = rows.iter().map(|r| r.0 * r.2).sum();
    let s_r: f64 = rows.iter().map(|r| r.0 * r.3).sum();
    if s_r <= 1e-12 || s_l <= 1e-12 {
        return 0.0;
    }
    let numer: f64 = rows.iter().map(|r| r.0 / r.1 * (r.3 - r.2)).sum();
    let rt_f = R_GAS * t_k / FARADAY;
    if (s_r - s_l).abs() < 1e-9 * s_l {
        // equal total conductivity on both sides: the limit of the logarithmic mean is S
        return -rt_f * numer / s_l;
    }
    -rt_f * numer / (s_r - s_l) * (s_r / s_l).ln()
}

/// pH units by which the junction shifts an electrode reading (`phi_sample - phi_bridge` in V).
pub fn junction_ph_shift(junction_v: f64, t_k: f64) -> f64 {
    -junction_v / (R_GAS * t_k * std::f64::consts::LN_10 / FARADAY)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strong_acid_and_base_junctions_have_the_textbook_size_and_sign() {
        // 0.1 M HCl against 3 M KCl: about -5 mV (the sample negative), the meter reads about 0.09 high
        let acid = henderson_junction_v(&[("H+".into(), 0.1), ("Cl-".into(), 0.1)], 298.15);
        assert!((acid * 1000.0 + 5.3).abs() < 0.8, "{} mV", acid * 1000.0);
        assert!((junction_ph_shift(acid, 298.15) - 0.09).abs() < 0.02);
        // 0.1 M NaOH: OH- is the fast ion, the sample is positive of the bridge: a small low reading error
        let base = henderson_junction_v(&[("Na+".into(), 0.1), ("OH-".into(), 0.1)], 298.15);
        assert!(base > 0.0 && base * 1000.0 < 5.0, "{} mV", base * 1000.0);
        // a KCl sample is nearly equitransferent: a diffusion potential of a couple of mV from the 30-fold concentration step
        // (t+ - t- = -0.02), far from the acid's
        let kcl = henderson_junction_v(&[("K+".into(), 0.1), ("Cl-".into(), 0.1)], 298.15);
        assert!(kcl.abs() < 3e-3 && kcl.abs() < acid.abs() / 2.0, "{}", kcl);
    }
}
