//! Derived phase properties: refractive index, permittivity, viscosity, and heat capacity.
//!
//! Formulations:
//! - Molar refraction -> refractive index n via Lorentz-Lorenz.
//! - Relative permittivity epsilon(T) per phase (Fernández / IAPWS for water, temperature/composition scaling for organics).
//! - Viscosity eta(T) per phase (IAPWS 2008 for water, Jones-Dole electrolyte extension, Andrade / Grunberg-Nissan for organics).
//! - Specific heat capacity Cp per phase (HKF apparent molar heat capacity for electrolytes).

use std::collections::HashMap;

/// Molar refraction R_M (cm^3/mol) of a species: from its optical record (`optics::records`), else the additive sum of
/// atomic refractions of its formula.
pub fn molar_refraction_cm3_mol(species: &str) -> f64 {
    crate::optics::records::molar_refraction(species).0
}

/// Refractive index n computed via the Lorentz-Lorenz equation:
/// (n^2 - 1) / (n^2 + 2) = R_M / V_molar = (sum n_i R_{M, i}) / V_total
pub fn lorentz_lorenz_refractive_index(species_mol: &HashMap<String, f64>, total_volume_ml: f64) -> f64 {
    if total_volume_ml <= 1e-6 {
        return 1.333;
    }
    let mut total_rm = 0.0;
    for (sp, &mol) in species_mol {
        if mol > 0.0 && !sp.ends_with("(s)") && !sp.ends_with("(g)") {
            total_rm += mol * molar_refraction_cm3_mol(sp);
        }
    }
    let alpha = (total_rm / total_volume_ml).clamp(0.001, 0.90);
    // (n^2 - 1) / (n^2 + 2) = alpha  =>  n^2 = (1 + 2 alpha) / (1 - alpha)
    let n2 = (1.0 + 2.0 * alpha) / (1.0 - alpha);
    n2.sqrt().clamp(1.0, 2.5)
}

/// Relative dielectric permittivity epsilon(T) for a phase.
pub fn calculate_dielectric_constant(
    species_mol: &HashMap<String, f64>,
    t_k: f64,
    total_volume_ml: f64,
) -> f64 {
    let h2o_mol = species_mol.get("H2O").copied().unwrap_or(0.0);
    if h2o_mol > 0.0 && total_volume_ml > 0.0 {
        let rho_w = crate::volume::water_density_iapws(t_k);
        let eps_water = crate::thermo::water::water_dielectric(t_k, rho_w);
        
        // Dielectric decrement from dissolved ions: delta ~ 8 L/mol
        let mut ion_conc_sum = 0.0;
        let vol_l = total_volume_ml / 1000.0;
        for (sp, &mol) in species_mol {
            let charge = crate::chem_db::get_species_thermo(sp).charge;
            if charge != 0 && mol > 0.0 {
                ion_conc_sum += mol / vol_l;
            }
        }
        (eps_water - 8.0 * ion_conc_sum).max(30.0)
    } else {
        // Organic / non-aqueous liquid phase
        let mut weighted_eps = 0.0;
        let mut total_vol = 0.0;
        for (sp, &mol) in species_mol {
            if mol <= 0.0 { continue; }
            let v = mol * crate::volume::organic_molar_volume_cm3_mol(sp, t_k);
            let eps_298 = match sp.as_str() {
                "C2H5OH" | "ik:LFQSCWFLJHTTHZ-UHFFFAOYSA-N" => 24.5,
                "C3H6O" | "acetone" => 20.7,
                "C6H14" | "hexane" => 1.88,
                "C7H8" | "toluene" => 2.38,
                _ => 15.0,
            };
            let eps_t = eps_298 * (-0.0045 * (t_k - 298.15)).exp();
            weighted_eps += v * eps_t;
            total_vol += v;
        }
        if total_vol > 0.0 {
            (weighted_eps / total_vol).clamp(1.5, 80.0)
        } else {
            24.3
        }
    }
}

/// Dynamic viscosity eta (cP = mPa*s) for a phase.
pub fn calculate_viscosity_cp(
    species_mol: &HashMap<String, f64>,
    t_k: f64,
    total_volume_ml: f64,
) -> f64 {
    let h2o_mol = species_mol.get("H2O").copied().unwrap_or(0.0);
    if h2o_mol > 0.0 && total_volume_ml > 0.0 {
        // IAPWS 2008 correlation for pure liquid water
        let eta_pure_w = 0.890 * (1.4 * (298.15 / t_k - 1.0)).exp();
        
        // Jones-Dole electrolyte viscosity extension: eta / eta_0 = 1 + A*sqrt(c) + B*c
        let vol_l = total_volume_ml / 1000.0;
        let mut ion_conc_sum = 0.0;
        for (sp, &mol) in species_mol {
            let charge = crate::chem_db::get_species_thermo(sp).charge;
            if charge != 0 && mol > 0.0 {
                ion_conc_sum += mol / vol_l;
            }
        }
        let b_coeff = 0.08; // average B coefficient for 1:1 salts
        let factor = 1.0 + 0.005 * ion_conc_sum.sqrt() + b_coeff * ion_conc_sum;
        eta_pure_w * factor
    } else {
        // Organic phase viscosity via Andrade equation ln(eta) = A + B/T
        let mut log_sum = 0.0;
        let total_mol: f64 = species_mol.values().copied().filter(|&m| m > 0.0).sum();
        if total_mol <= 0.0 {
            return 1.0;
        }
        for (sp, &mol) in species_mol {
            if mol <= 0.0 { continue; }
            let x = mol / total_mol;
            let (a, b) = match sp.as_str() {
                "C2H5OH" => (-6.44, 2180.0),
                "C3H6O" | "acetone" => (-4.20, 1050.0),
                "C6H14" | "hexane" => (-4.00, 950.0),
                _ => (-5.0, 1500.0),
            };
            let eta_i = (a + b / t_k).exp();
            log_sum += x * eta_i.ln();
        }
        log_sum.exp().clamp(0.1, 50.0)
    }
}

/// Specific heat capacity Cp (J/(g K)) of a liquid phase.
pub fn calculate_heat_capacity_j_g_k(
    species_mol: &HashMap<String, f64>,
    _t_k: f64,
    total_mass_g: f64,
    ionic_strength: f64,
) -> f64 {
    if total_mass_g <= 1e-6 {
        return 4.184;
    }
    let h2o_mol = species_mol.get("H2O").copied().unwrap_or(0.0);
    if h2o_mol > 0.0 {
        // Water base heat capacity: ~4.184 J/(g K)
        let water_mass_g = h2o_mol * crate::volume::WATER_MW;
        let mut total_cp_j_k = water_mass_g * 4.184;

        // Electrolyte apparent molar heat capacity:
        // C_{p, phi} = C_p° + S_c * sqrt(I) + b_c * I
        for (sp, &mol) in species_mol {
            if mol <= 0.0 || sp == "H2O" || sp.ends_with("(s)") || sp.ends_with("(g)") {
                continue;
            }
            let (cp0, sc, bc) = match sp.as_str() {
                "Na+" => (43.0, 14.5, 3.8),
                "Cl-" => (-126.8, 14.5, 3.8),
                "K+" => (22.0, 14.5, 3.0),
                "NO3-" => (-72.0, 14.5, 3.0),
                "Ca+2" | "Ca2+" => (-26.0, 40.0, 8.0),
                "SO4-2" | "SO42-" => (-280.0, 40.0, 8.0),
                _ => {
                    let thermo = crate::chem_db::get_species_thermo(sp);
                    let cp = if thermo.cp > 1.0 { thermo.cp } else { 50.0 };
                    (cp, 0.0, 0.0)
                }
            };
            let cp_phi = cp0 + sc * ionic_strength.max(0.0).sqrt() + bc * ionic_strength.max(0.0);
            total_cp_j_k += mol * cp_phi;
        }

        (total_cp_j_k / total_mass_g).clamp(1.5, 5.0)
    } else {
        // Organic liquid phase
        let mut total_cp_j_k = 0.0;
        for (sp, &mol) in species_mol {
            if mol <= 0.0 { continue; }
            let cp_molar = match sp.as_str() {
                "C2H5OH" => 112.4, // J/(mol K)
                "C3H6O" | "acetone" => 125.0,
                "C6H14" | "hexane" => 195.0,
                "C7H8" | "toluene" => 157.0,
                _ => {
                    let thermo = crate::chem_db::get_species_thermo(sp);
                    if thermo.cp > 1.0 { thermo.cp } else { 100.0 }
                }
            };
            total_cp_j_k += mol * cp_molar;
        }
        (total_cp_j_k / total_mass_g).clamp(1.0, 4.0)
    }
}

/// Single-pass calculation of aqueous derived properties (refractive index, permittivity, viscosity, heat capacity).
pub fn compute_aqueous_derived_properties(
    species_mol: &HashMap<String, f64>,
    t_k: f64,
    total_volume_ml: f64,
    total_mass_g: f64,
    ionic_strength: f64,
) -> (f64, f64, f64, f64) {
    let vol_l = (total_volume_ml / 1000.0).max(1e-9);
    let mut total_rm = 0.0;
    let mut ion_conc_sum = 0.0;
    let h2o_mol = species_mol.get("H2O").copied().unwrap_or(0.0);
    let water_mass_g = h2o_mol * crate::volume::WATER_MW;
    let mut total_cp_j_k = water_mass_g * 4.184;
    let sqrt_i = ionic_strength.max(0.0).sqrt();

    for (sp, &mol) in species_mol {
        if mol <= 0.0 || sp.ends_with("(s)") || sp.ends_with("(g)") {
            continue;
        }
        total_rm += mol * molar_refraction_cm3_mol(sp);
        let thermo = crate::chem_db::get_species_thermo(sp);
        if thermo.charge != 0 {
            ion_conc_sum += mol / vol_l;
        }
        if sp != "H2O" {
            let (cp0, sc, bc) = match sp.as_str() {
                "Na+" => (43.0, 14.5, 3.8),
                "Cl-" => (-126.8, 14.5, 3.8),
                "K+" => (22.0, 14.5, 3.0),
                "NO3-" => (-72.0, 14.5, 3.0),
                "Ca+2" | "Ca2+" => (-26.0, 40.0, 8.0),
                "SO4-2" | "SO42-" => (-280.0, 40.0, 8.0),
                _ => {
                    let cp = if thermo.cp > 1.0 { thermo.cp } else { 50.0 };
                    (cp, 0.0, 0.0)
                }
            };
            let cp_phi = cp0 + sc * sqrt_i + bc * ionic_strength.max(0.0);
            total_cp_j_k += mol * cp_phi;
        }
    }

    let alpha = (total_rm / total_volume_ml.max(1e-6)).clamp(0.001, 0.90);
    let n2 = (1.0 + 2.0 * alpha) / (1.0 - alpha);
    let n = n2.sqrt().clamp(1.0, 2.5);

    let rho_w = crate::volume::water_density_iapws(t_k);
    let eps_water = crate::thermo::water::water_dielectric(t_k, rho_w);
    let eps = (eps_water - 8.0 * ion_conc_sum).max(30.0);

    let eta_pure_w = 0.890 * (1.4 * (298.15 / t_k - 1.0)).exp();
    let b_coeff = 0.08;
    let eta = eta_pure_w * (1.0 + 0.005 * ion_conc_sum.sqrt() + b_coeff * ion_conc_sum);

    let cp = if total_mass_g > 1e-6 { (total_cp_j_k / total_mass_g).clamp(1.5, 5.0) } else { 4.184 };

    (n, eps, eta, cp)
}
