//! M5 optics. Absorbance bins, scattering extinction, and sRGB tables.

use std::collections::HashMap;
use crate::spectra;

pub const N_BINS: usize = 32;
pub const BIN_NM0: f64 = 400.0;
pub const BIN_STEP_NM: f64 = 10.0;

/// Normalized linear sRGB weights per bin for illuminant D65, white balanced so T=1 => rgb=(1,1,1).
pub static RGB_WEIGHTS: [f64; 96] = [
    0.00093632474, -0.00080665328, 0.0056853705, // bin 0: 400 nm
    0.0030992647, -0.0027067814, 0.019213132, // bin 1: 410 nm
    0.0095163259, -0.0084750023, 0.061065865, // bin 2: 420 nm
    0.017367187, -0.016053169, 0.12152093, // bin 3: 430 nm
    0.022092962, -0.021997851, 0.1851348, // bin 4: 440 nm
    0.016368571, -0.020021962, 0.20911071, // bin 5: 450 nm
    0.0020042278, -0.011134304, 0.19760125, // bin 6: 460 nm
    -0.016192552, 0.0037836741, 0.14744606, // bin 7: 470 nm
    -0.033959889, 0.022131938, 0.091949805, // bin 8: 480 nm
    -0.046201223, 0.038953927, 0.046552506, // bin 9: 490 nm
    -0.063873752, 0.063340994, 0.023015095, // bin 10: 500 nm
    -0.083987251, 0.095951963, 0.0066598781, // bin 11: 510 nm
    -0.091917327, 0.12624359, -0.005824444, // bin 12: 520 nm
    -0.082658632, 0.14853406, -0.012468499, // bin 13: 530 nm
    -0.053001599, 0.14900864, -0.015547509, // bin 14: 540 nm
    -0.012739436, 0.14236344, -0.016737796, // bin 15: 550 nm
    0.037447646, 0.12204945, -0.015723692, // bin 16: 560 nm
    0.091782637, 0.095415452, -0.013667078, // bin 17: 570 nm
    0.14810465, 0.067403753, -0.011334458, // bin 18: 580 nm
    0.18171983, 0.035682653, -0.008089336, // bin 19: 590 nm
    0.21088794, 0.013129519, -0.0058719208, // bin 20: 600 nm
    0.21025407, -0.0023842908, -0.0039483457, // bin 21: 610 nm
    0.18148252, -0.0094069866, -0.0024941205, // bin 22: 620 nm
    0.13218911, -0.0098862762, -0.0014429899, // bin 23: 630 nm
    0.093811378, -0.0083771582, -0.00085414099, // bin 24: 640 nm
    0.057214441, -0.0056047485, -0.00045961309, // bin 25: 650 nm
    0.033498695, -0.003443465, -0.0002487352, // bin 26: 660 nm
    0.01825282, -0.0019205345, -0.0001299652, // bin 27: 670 nm
    0.0093068577, -0.00099499024, -6.4288184e-05, // bin 28: 680 nm
    0.0040273342, -0.00043518768, -2.7237198e-05, // bin 29: 690 nm
    0.0020709758, -0.00022478411, -1.3880712e-05, // bin 30: 700 nm
    0.0010958969, -0.0001189129, -7.3497705e-06, // bin 31: 710 nm
];

/// JSON of `OpticsTables` (see web/src/types/sim.ts).
pub fn tables_json() -> String {
    let weights_vec: Vec<f64> = RGB_WEIGHTS.to_vec();
    serde_json::json!({
        "n_bins": N_BINS,
        "rgb_weights": weights_vec,
        // hash of every absorption band: caches of colours derived from the optics data key on it
        "data_version": format!("{:016x}", spectra::data_hash())
    }).to_string()
}

/// Decadic absorbance per cm per bin from species concentrations (mol/L, keyed by species id).
pub fn absorbance_per_cm(conc_m: &HashMap<String, f64>) -> [f64; N_BINS] {
    let mut a_bins = [0.0; N_BINS];
    const LN2_TIMES_4: f64 = 2.772588722239781;

    for (species_id, &conc) in conc_m {
        if conc <= 1e-12 {
            continue;
        }
        if let Some(bands) = spectra::bands(species_id) {
            for band in bands {
                for (i, a_bin) in a_bins.iter_mut().enumerate() {
                    let lambda = BIN_NM0 + (i as f64) * BIN_STEP_NM;
                    let diff = lambda - band.centre_nm;
                    let fwhm = band.fwhm_nm.max(1.0);
                    let exponent = -LN2_TIMES_4 * (diff / fwhm).powi(2);
                    if exponent > -20.0 {
                        let eps_lambda = band.eps * exponent.exp();
                        *a_bin += conc * eps_lambda;
                    }
                }
            }
        }
    }

    a_bins
}

/// Natural-log extinction per cm from a suspension of spheres (Mie / Rayleigh-Gans blend).
pub fn scatter_extinction_per_cm(
    mass_conc_g_per_ml: f64,
    diameter_um: f64,
    solid_density_g_ml: f64,
    n_solid: f64,
    n_medium: f64,
) -> f64 {
    if mass_conc_g_per_ml <= 1e-9 || diameter_um <= 1e-4 || solid_density_g_ml <= 1e-4 {
        return 0.0;
    }

    // Diameter in cm: 1 um = 1e-4 cm
    let d_cm = diameter_um * 1e-4;
    let r_cm = d_cm * 0.5;
    let vol_particle_cm3 = (4.0 / 3.0) * std::f64::consts::PI * r_cm.powi(3);
    let mass_particle_g = vol_particle_cm3 * solid_density_g_ml;
    let num_particles_per_ml = mass_conc_g_per_ml / mass_particle_g;

    let cross_section_geom_cm2 = std::f64::consts::PI * r_cm.powi(2);
    let m = (n_solid / n_medium.max(1.0)).max(1.0001);
    let lambda_cm = 5.5e-5; // 550 nm average green wavelength in cm

    // Van de Hulst phase shift parameter rho = 2 * x * |m - 1|
    let x = std::f64::consts::PI * d_cm / lambda_cm;
    let rho = 2.0 * x * (m - 1.0).abs();

    // Scattering efficiency Q_sca:
    let q_sca = if rho < 0.1 {
        // Rayleigh / small-particle limit
        (8.0 / 3.0) * x.powi(4) * ((m.powi(2) - 1.0) / (m.powi(2) + 2.0)).powi(2)
    } else if rho < 20.0 {
        2.0 - (4.0 / rho) * rho.sin() + (4.0 / (rho * rho)) * (1.0 - rho.cos())
    } else {
        2.0
    };

    let sigma_sca_cm2 = cross_section_geom_cm2 * q_sca.max(0.001);
    num_particles_per_ml * sigma_sca_cm2
}

/// Linear-sRGB colour of a white illuminant transmitted through `path_cm` of absorber (white-balanced).
pub fn transmitted_linear_rgb(a_per_cm: &[f64; N_BINS], path_cm: f64) -> [f64; 3] {
    let mut r = 0.0;
    let mut g = 0.0;
    let mut b = 0.0;

    for i in 0..N_BINS {
        let decadic_a = a_per_cm[i] * path_cm;
        let trans = 10.0_f64.powf(-decadic_a);
        let w_r = RGB_WEIGHTS[i * 3];
        let w_g = RGB_WEIGHTS[i * 3 + 1];
        let w_b = RGB_WEIGHTS[i * 3 + 2];

        r += w_r * trans;
        g += w_g * trans;
        b += w_b * trans;
    }

    [
        r.clamp(0.0, 1.0),
        g.clamp(0.0, 1.0),
        b.clamp(0.0, 1.0),
    ]
}
