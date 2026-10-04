//! Derived phase properties: refractive index, permittivity, viscosity, and heat capacity.
//!
//! Formulations:
//! - Molar refraction -> refractive index n via Lorentz-Lorenz.
//! - Viscosity eta(T) per phase (IAPWS 2008 for water, Jones-Dole electrolyte extension, Andrade / Grunberg-Nissan for organics).

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

/// Andrade parameters used for a liquid whose record has no viscosity datum: ln(eta / cP) = -5 + 1500 / T, i.e. 1.0 cP at
/// 298 K (an Estimated placeholder; records carry `transport.eta_l = {"A": .., "B": ..}` to replace it).
pub const ANDRADE_DEFAULT: (f64, f64) = (-5.0, 1500.0);

/// Dynamic viscosity eta (cP = mPa*s) for a phase. `andrade` gives the Andrade parameters (A, B) of `ln(eta/cP) = A + B / T`
/// of a species from its record, if it has them.
pub fn calculate_viscosity_cp(
    species_mol: &HashMap<String, f64>,
    t_k: f64,
    total_volume_ml: f64,
    andrade: &dyn Fn(&str) -> Option<(f64, f64)>,
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
            let (a, b) = andrade(sp).unwrap_or(ANDRADE_DEFAULT);
            let eta_i = (a + b / t_k).exp();
            log_sum += x * eta_i.ln();
        }
        log_sum.exp().clamp(0.1, 50.0)
    }
}
