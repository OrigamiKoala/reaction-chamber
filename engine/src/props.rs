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
    // Neutral liquid components mix by the logarithmic (Arrhenius) rule ln eta = sum x_i ln eta_i, each with its own
    // curve: water from the IAPWS-type fit of `transport`, others from the Andrade parameters of their record (else the
    // labelled default). Ions are not solvent components; they act through the Jones-Dole term below.
    let mut neutral_mol = 0.0;
    let mut ion_mol = 0.0;
    for (sp, &mol) in species_mol {
        if mol <= 0.0 {
            continue;
        }
        if crate::ions::species_charge(sp) != 0 {
            ion_mol += mol;
        } else {
            neutral_mol += mol;
        }
    }
    if neutral_mol <= 0.0 {
        return 1.0;
    }
    let mut log_sum = 0.0;
    for (sp, &mol) in species_mol {
        if mol <= 0.0 || crate::ions::species_charge(sp) != 0 {
            continue;
        }
        let x = mol / neutral_mol;
        let eta_i = if sp == crate::db::seed::WATER {
            crate::transport::viscosity_water_pa_s(t_k) * 1e3
        } else {
            let (a, b) = andrade(sp).unwrap_or(ANDRADE_DEFAULT);
            (a + b / t_k).exp()
        };
        log_sum += x * eta_i.ln();
    }
    let eta_solvent = log_sum.exp();
    // Jones-Dole electrolyte extension eta / eta_0 = 1 + A sqrt(c) + B c with the average coefficients of 1:1 salts.
    let factor = if ion_mol > 0.0 && total_volume_ml > 0.0 {
        let c = ion_mol / (total_volume_ml / 1000.0);
        1.0 + 0.005 * c.sqrt() + 0.08 * c
    } else {
        1.0
    };
    (eta_solvent * factor).clamp(0.05, 50.0)
}
