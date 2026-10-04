//! Volume model for liquid phases, electrolytes, and mixtures.
//!
//! Formulations:
//! - Water: IAPWS-95 liquid density and thermal expansion along the 1 atm / saturation curve.
//! - Organics: COSTALD / Rackett liquid molar volume from critical properties.
//! - Ions: HKF standard partial molar volume V° + Debye-Hückel limiting slope Sv * sqrt(I).
//! - Liquid mixtures: Excess molar volume V^E of mixing (e.g. water + acetone contraction).

use std::collections::HashMap;

pub const WATER_MW: f64 = 18.01528; // g/mol
pub const R_GAS: f64 = 8.314462618; // J/(mol K)

/// IAPWS-95 liquid water density (kg/m^3 = g/L) from 273.15 K to 647 K.
/// Accurate across 0 to 100 °C to within 0.01% of IAPWS formulation.
pub fn water_density_iapws(t_k: f64) -> f64 {
    let tc = 647.096;
    let rhoc = 322.0;
    if t_k >= tc {
        return rhoc;
    }
    let t = t_k.clamp(273.15, tc);
    let tau = 1.0 - t / tc;
    
    // IAPWS-95 liquid saturation density equation
    let b = [
        1.99274064,
        1.09965342,
        -0.510839303,
        -1.75493479,
        -45.5170352,
        -6.7469445e5,
    ];
    let sum = b[0] * tau.powf(1.0 / 3.0)
        + b[1] * tau.powf(2.0 / 3.0)
        + b[2] * tau.powf(5.0 / 3.0)
        + b[3] * tau.powf(16.0 / 3.0)
        + b[4] * tau.powf(43.0 / 3.0)
        + b[5] * tau.powf(110.0 / 3.0);
    
    rhoc * (1.0 + sum)
}

/// Molar volume of liquid water (cm^3/mol) from IAPWS-95.
pub fn water_molar_volume_cm3_mol(t_k: f64) -> f64 {
    let rho_kg_m3 = water_density_iapws(t_k);
    (WATER_MW / rho_kg_m3) * 1000.0
}

/// Critical properties and Rackett Z_RA parameter for organic liquids.
#[derive(Clone, Copy, Debug)]
pub struct LiquidCriticalProps {
    pub tc_k: f64,
    pub pc_pa: f64,
    pub z_ra: f64,
    pub mw: f64,
}

/// Critical constants and the Rackett parameter of a liquid species, from its species record (found by id, by name, or
/// by an unambiguous formula) and its gas twin; the Rackett parameter is the record's, else the Spencer-Danner
/// estimate from the acentric factor. None when the store holds no critical data for the species.
fn store_critical_props(species: &str) -> Option<LiquidCriticalProps> {
    let base = species.split('#').next().unwrap_or(species);
    let store = crate::db::SpeciesStore::global();
    let guard = store.read().ok()?;
    let rec = guard
        .get(species)
        .or_else(|| guard.get(base))
        .or_else(|| guard.get_by_name(base))
        .or_else(|| {
            let cands: Vec<_> = guard.get_by_formula(base).into_iter().filter(|r| crate::vle::critical_of(r).is_some()).collect();
            if cands.len() == 1 { Some(cands[0]) } else { None }
        })?;
    let (tc, pc, omega) = crate::vle::critical_of(rec).or_else(|| guard.gas_partner(rec).and_then(crate::vle::critical_of))?;
    let z_ra = rec
        .phases
        .get("l")
        .and_then(|p| p.volume.as_ref())
        .and_then(|v| v.zra.as_ref())
        .map(|d| d.value)
        .unwrap_or_else(|| (0.29056 - 0.08775 * omega.unwrap_or(0.3)).clamp(0.2, 0.32));
    Some(LiquidCriticalProps { tc_k: tc, pc_pa: pc, z_ra, mw: rec.mw() })
}

pub fn get_organic_critical_props(species: &str) -> LiquidCriticalProps {
    if let Some(p) = store_critical_props(species) {
        return p;
    }
    // no data: a general estimate from the molar mass (speculative)
    let thermo = crate::chem_db::get_species_thermo(species);
    let mw = if thermo.mw > 1.0 { thermo.mw } else { 60.0 };
    LiquidCriticalProps { tc_k: 550.0, pc_pa: 4.0e6, z_ra: 0.260, mw }
}

/// Organic liquid molar volume (cm^3/mol) via the Rackett equation.
pub fn organic_molar_volume_cm3_mol(species: &str, t_k: f64) -> f64 {
    let p = get_organic_critical_props(species);
    let tr = (t_k / p.tc_k).clamp(0.1, 0.99);
    let exponent = 1.0 + (1.0 - tr).powf(2.0 / 7.0);
    // V_s = (R * Tc / Pc) * Z_RA^exponent
    // R in Pa * m^3 / (mol K) = 8.314462618
    let v_m3_mol = (R_GAS * p.tc_k / p.pc_pa) * p.z_ra.powf(exponent);
    v_m3_mol * 1e6 // convert to cm^3/mol
}

/// One binary pair of the tabulated excess volumes (`data/excess_volume.json`), keyed by InChIKey.
struct ExcessPair {
    a: String,
    b: String,
    coeffs: Vec<f64>,
}

fn excess_pairs() -> &'static Vec<ExcessPair> {
    static PAIRS: std::sync::OnceLock<Vec<ExcessPair>> = std::sync::OnceLock::new();
    PAIRS.get_or_init(|| {
        let v: serde_json::Value = serde_json::from_str(include_str!("../data/excess_volume.json")).expect("excess_volume.json");
        v["pairs"]
            .as_array()
            .map(|list| {
                list.iter()
                    .filter_map(|p| {
                        Some(ExcessPair {
                            a: p["a"].as_str()?.to_string(),
                            b: p["b"].as_str()?.to_string(),
                            coeffs: p["A_cm3_mol"].as_array()?.iter().filter_map(|x| x.as_f64()).collect(),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default()
    })
}

/// Excess molar volume V^E (cm^3 per mole of mixture) of a liquid phase given the mole fractions of its components by
/// InChIKey: the Redlich-Kister series of every tabulated pair present, summed (a pair with no data contributes nothing:
/// the volumes of its components add).
pub fn excess_molar_volume_cm3_mol(x_by_inchikey: &[(String, f64)]) -> f64 {
    let x_of = |ik: &str| x_by_inchikey.iter().filter(|(k, _)| k == ik).map(|(_, x)| *x).sum::<f64>();
    let mut v_e = 0.0;
    for p in excess_pairs() {
        let (xa, xb) = (x_of(&p.a), x_of(&p.b));
        if xa > 1e-4 && xb > 1e-4 {
            let d = xa - xb;
            let series: f64 = p.coeffs.iter().enumerate().map(|(k, a)| a * d.powi(k as i32)).sum();
            v_e += xa * xb * series;
        }
    }
    v_e
}

/// Standard partial molar volume V° at infinite dilution (cm^3/mol) from HKF database.
pub fn ion_hkf_v0(ion: &str) -> f64 {
    if let Some(v) = crate::activity::ion_data().ion_volume_v0_cm3_mol.get(ion) {
        return *v;
    }
    // no row: a class value from the charge (ions) or the molar mass (neutral solutes: dissolved gases, urea, glucose)
    let charge = crate::chem_db::get_species_thermo(ion).charge;
    if charge > 0 {
        if charge == 1 { 5.0 } else { -15.0 * (charge as f64 - 1.0) }
    } else if charge < 0 {
        if charge == -1 { 20.0 } else { 15.0 }
    } else {
        let mw = crate::chem_db::get_species_thermo(ion).mw;
        (mw * 0.75).max(15.0)
    }
}

/// Apparent molar volume of an ion in aqueous solution (cm^3/mol):
/// V_phi = V° + S_v * sqrt(I) + b_v * I
pub fn ion_apparent_molar_volume(ion: &str, ionic_strength: f64) -> f64 {
    let v0 = ion_hkf_v0(ion);
    let charge = crate::chem_db::get_species_thermo(ion).charge.abs().max(1) as f64;
    // Debye-Hückel limiting slope for volume: Sv ~ 1.868 cm^3 kg^0.5 mol^-1.5 for 1:1 electrolyte at 25 °C
    let sv = 1.868 * (charge / 2.0);
    let bv = 0.04;
    v0 + sv * ionic_strength.max(0.0).sqrt() + bv * ionic_strength.max(0.0)
}

/// Total volume (mL) of a liquid phase from component moles, resolving molecules from the species store: water from IAPWS,
/// molecules from their liquid molar volume, ions and other solutes from their apparent molar volumes, plus the tabulated
/// excess volumes. (`Vessel::phase_volume_ml` is the same model with the vessel's imported compounds.)
pub fn calculate_aqueous_volume_ml(species_mol: &HashMap<String, f64>, t_k: f64, ionic_strength: f64) -> f64 {
    let total_moles: f64 = species_mol.values().filter(|m| **m > 0.0).sum();
    let mut total_vol_cm3 = 0.0;
    let mut x_by_ik: Vec<(String, f64)> = Vec::new();
    for (sp, &mol) in species_mol {
        if mol <= 0.0 || sp.ends_with("(s)") || sp.ends_with("(g)") {
            continue;
        }
        let molecule = if crate::ions::species_charge(sp) == 0 { crate::molecule::resolve(sp, None).filter(|m| m.liquid_data) } else { None };
        match molecule {
            Some(m) if sp == crate::vessel::AQUEOUS_SOLVENT => {
                total_vol_cm3 += mol * water_molar_volume_cm3_mol(t_k);
                if let Some(ik) = m.inchikey {
                    x_by_ik.push((ik, mol / total_moles.max(1e-300)));
                }
            }
            Some(m) => {
                total_vol_cm3 += mol * m.v_liquid_m3_mol(t_k) * 1e6;
                if let Some(ik) = m.inchikey {
                    x_by_ik.push((ik, mol / total_moles.max(1e-300)));
                }
            }
            None if sp == crate::vessel::AQUEOUS_SOLVENT => total_vol_cm3 += mol * water_molar_volume_cm3_mol(t_k),
            None => total_vol_cm3 += mol * ion_apparent_molar_volume(sp, ionic_strength),
        }
    }
    total_vol_cm3 += total_moles * excess_molar_volume_cm3_mol(&x_by_ik);
    total_vol_cm3.max(0.0)
}
