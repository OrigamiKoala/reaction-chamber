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

pub fn get_organic_critical_props(species: &str) -> LiquidCriticalProps {
    match species {
        "C2H5OH" | "ik:LFQSCWFLJHTTHZ-UHFFFAOYSA-N" => LiquidCriticalProps {
            tc_k: 514.0,
            pc_pa: 6.14e6,
            z_ra: 0.252,
            mw: 46.069,
        },
        "C3H6O" | "acetone" | "ik:CSCPPACGZOOCGX-UHFFFAOYSA-N" => LiquidCriticalProps {
            tc_k: 508.2,
            pc_pa: 4.70e6,
            z_ra: 0.233,
            mw: 58.08,
        },
        "C6H14" | "hexane" | "ik:VLKZOEOYAKHREP-UHFFFAOYSA-N" => LiquidCriticalProps {
            tc_k: 507.6,
            pc_pa: 3.02e6,
            z_ra: 0.264,
            mw: 86.18,
        },
        "C7H8" | "toluene" | "ik:YXFVVABEGXRONW-UHFFFAOYSA-N" => LiquidCriticalProps {
            tc_k: 591.8,
            pc_pa: 4.10e6,
            z_ra: 0.264,
            mw: 92.14,
        },
        _ => {
            // General estimate from molar mass
            let thermo = crate::chem_db::get_species_thermo(species);
            let mw = if thermo.mw > 1.0 { thermo.mw } else { 60.0 };
            LiquidCriticalProps {
                tc_k: 550.0,
                pc_pa: 4.0e6,
                z_ra: 0.260,
                mw,
            }
        }
    }
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

/// Excess molar volume V^E of liquid mixtures (cm^3/mol of mixture).
pub fn excess_molar_volume_cm3_mol(x_map: &HashMap<String, f64>, _t_k: f64) -> f64 {
    let x_water = x_map.get("H2O").copied().unwrap_or(0.0);
    let x_acetone = x_map.get("C3H6O")
        .or_else(|| x_map.get("acetone"))
        .or_else(|| x_map.get("ik:CSCPPACGZOOCGX-UHFFFAOYSA-N"))
        .copied()
        .unwrap_or(0.0);
    let x_ethanol = x_map.get("C2H5OH")
        .or_else(|| x_map.get("ik:LFQSCWFLJHTTHZ-UHFFFAOYSA-N"))
        .copied()
        .unwrap_or(0.0);

    let mut v_e = 0.0;

    // Water + Acetone: Redlich-Kister expansion at 25 °C
    if x_water > 1e-4 && x_acetone > 1e-4 {
        let x1 = x_water;
        let x2 = x_acetone;
        let a0 = -4.50; // cm^3/mol
        let a1 = -1.20;
        v_e += x1 * x2 * (a0 + a1 * (x1 - x2));
    }

    // Water + Ethanol: Redlich-Kister expansion
    if x_water > 1e-4 && x_ethanol > 1e-4 {
        let x1 = x_water;
        let x2 = x_ethanol;
        let a0 = -4.25;
        let a1 = -1.10;
        v_e += x1 * x2 * (a0 + a1 * (x1 - x2));
    }

    v_e
}

/// Standard partial molar volume V° at infinite dilution (cm^3/mol) from HKF database.
pub fn ion_hkf_v0(ion: &str) -> f64 {
    match ion {
        "H+" => 0.00,
        "Na+" => -1.21,
        "K+" => 9.02,
        "Li+" => -0.88,
        "NH4+" => 17.90,
        "Ag+" => -5.90,
        "Ca+2" | "Ca2+" => -17.85,
        "Mg+2" | "Mg2+" => -21.17,
        "Ba+2" | "Ba2+" => -12.50,
        "Fe+2" | "Fe2+" => -24.70,
        "Fe+3" | "Fe3+" => -43.70,
        "Cu+2" | "Cu2+" => -23.50,
        "Zn+2" | "Zn2+" => -21.60,
        "Pb+2" | "Pb2+" => -7.30,
        "Cl-" => 17.83,
        "Br-" => 24.71,
        "I-" => 36.22,
        "F-" => -2.40,
        "OH-" => -4.04,
        "NO3-" => 29.00,
        "HCO3-" => 24.20,
        "CO3-2" | "CO32-" => -3.70,
        "HSO4-" => 35.70,
        "SO4-2" | "SO42-" => 13.98,
        "CH3COO-" | "acetate" => 40.50,
        _ => {
            let charge = crate::chem_db::get_species_thermo(ion).charge;
            if charge > 0 {
                if charge == 1 { 5.0 } else { -15.0 * (charge as f64 - 1.0) }
            } else if charge < 0 {
                if charge == -1 { 20.0 } else { 15.0 }
            } else {
                // Neutral solute (e.g. dissolved O2, CO2, urea, glucose)
                let mw = crate::chem_db::get_species_thermo(ion).mw;
                (mw * 0.75).max(15.0)
            }
        }
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

/// Computes the total volume (mL) of an aqueous phase from component moles.
pub fn calculate_aqueous_volume_ml(
    species_mol: &HashMap<String, f64>,
    t_k: f64,
    ionic_strength: f64,
) -> f64 {
    let h2o_mol = species_mol.get("H2O").copied().unwrap_or(0.0);
    if h2o_mol <= 0.0 {
        return 0.0;
    }
    let v_water_molar = water_molar_volume_cm3_mol(t_k);
    let mut total_vol_cm3 = h2o_mol * v_water_molar;

    let mut total_solute_moles = 0.0;
    let total_moles: f64 = species_mol.values().sum();
    let (x_water, x_acetone, x_ethanol) = if total_moles > 0.0 {
        let xw = h2o_mol / total_moles;
        let xa = (species_mol.get("C3H6O")
            .or_else(|| species_mol.get("acetone"))
            .or_else(|| species_mol.get("ik:CSCPPACGZOOCGX-UHFFFAOYSA-N"))
            .copied()
            .unwrap_or(0.0)) / total_moles;
        let xe = (species_mol.get("C2H5OH")
            .or_else(|| species_mol.get("ik:LFQSCWFLJHTTHZ-UHFFFAOYSA-N"))
            .copied()
            .unwrap_or(0.0)) / total_moles;
        (xw, xa, xe)
    } else {
        (0.0, 0.0, 0.0)
    };

    for (sp, &mol) in species_mol {
        if mol <= 0.0 || sp == "H2O" {
            continue;
        }
        if sp.ends_with("(s)") || sp.ends_with("(g)") {
            continue;
        }
        let thermo = crate::chem_db::get_species_thermo(sp);
        if thermo.charge != 0 {
            let v_phi = ion_apparent_molar_volume(sp, ionic_strength);
            total_vol_cm3 += mol * v_phi;
        } else if sp == "C2H5OH" || sp == "C3H6O" || sp == "acetone" {
            let v_org = organic_molar_volume_cm3_mol(sp, t_k);
            total_vol_cm3 += mol * v_org;
        } else {
            let v_solute = ion_apparent_molar_volume(sp, ionic_strength);
            total_vol_cm3 += mol * v_solute;
        }
        total_solute_moles += mol;
    }

    // Add excess volume of mixing
    if total_solute_moles > 0.0 && total_moles > 0.0 {
        let mut v_e = 0.0;
        if x_water > 1e-4 && x_acetone > 1e-4 {
            let a0 = -4.50;
            let a1 = -1.20;
            v_e += x_water * x_acetone * (a0 + a1 * (x_water - x_acetone));
        }
        if x_water > 1e-4 && x_ethanol > 1e-4 {
            let a0 = -4.25;
            let a1 = -1.10;
            v_e += x_water * x_ethanol * (a0 + a1 * (x_water - x_ethanol));
        }
        total_vol_cm3 += total_moles * v_e;
    }

    total_vol_cm3.max(0.0)
}
