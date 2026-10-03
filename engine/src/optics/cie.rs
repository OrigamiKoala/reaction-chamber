//! Spectral grid and colorimetry: CIE 1931 2-degree colour matching functions, the D65 illuminant and the sRGB primaries,
//! combined into per-bin weights that turn any spectrum on the 380-780 nm grid into a linear-sRGB colour.
//!
//! The colour matching functions are the CIE 1931 2-degree table at 10 nm (interpolated linearly between nodes; the multi-lobe
//! analytic fit of Wyman, Sloan & Shirley, JCGT 2, 2013, is kept as a cross-check of the table), the illuminant is the
//! tabulated CIE D65 relative spectral power at 10 nm. The weights are *regenerated* from these at first use (no pasted weight
//! table): the TypeScript fallback (`web/src/render/cie.ts`) evaluates the same tables, and the engine ships its own weights to
//! the web in `tables_json`.

use std::sync::OnceLock;

/// Number of bins of the spectral grid (380-780 nm inclusive, 10 nm).
pub const N_BINS: usize = 41;
/// Wavelength (nm) of bin 0.
pub const BIN_NM0: f64 = 380.0;
/// Bin spacing, nm.
pub const BIN_STEP_NM: f64 = 10.0;

/// A spectrum on the engine grid.
pub type Spectrum = [f64; N_BINS];

/// Wavelength (nm) of a bin centre.
#[inline]
pub fn bin_nm(i: usize) -> f64 {
    BIN_NM0 + i as f64 * BIN_STEP_NM
}

/// CIE standard illuminant D65, relative spectral power at 380..780 nm step 10 nm (CIE 15:2004 table).
pub const D65: [f64; N_BINS] = [
    49.9755, 54.6482, 82.7549, 91.486, 93.4318, 86.6823, 104.865, 117.008, 117.812, 114.861, 115.923, 108.811, 109.354, 107.802, 104.79,
    107.689, 104.405, 104.046, 100.0, 96.3342, 95.788, 88.6856, 90.0062, 89.5991, 87.6987, 83.2886, 83.6992, 80.0268, 80.0456, 82.2778,
    78.2842, 69.7213, 71.6091, 74.349, 61.604, 69.8856, 75.087, 63.5927, 46.4182, 66.8054, 63.3828,
];

/// CIE 1931 2-degree standard observer, x-bar / y-bar / z-bar at 380..780 nm step 10 nm.
pub const CMF_X: [f64; N_BINS] = [
    0.001368, 0.004243, 0.01431, 0.04351, 0.13438, 0.2839, 0.34828, 0.3362, 0.2908, 0.19536, 0.09564, 0.03201, 0.0049, 0.0093, 0.06327, 0.1655, 0.2904,
    0.43345, 0.5945, 0.7621, 0.9163, 1.0263, 1.0622, 1.0026, 0.85445, 0.6424, 0.4479, 0.2835, 0.1649, 0.0874, 0.04677, 0.0227, 0.011359, 0.00579,
    0.002899, 0.00144, 0.00069, 0.000332, 0.000166, 0.000083, 0.000042,
];
pub const CMF_Y: [f64; N_BINS] = [
    0.000039, 0.00012, 0.000396, 0.00121, 0.004, 0.0116, 0.023, 0.038, 0.06, 0.09098, 0.13902, 0.20802, 0.323, 0.503, 0.71, 0.862, 0.954, 0.99495, 0.995,
    0.952, 0.87, 0.757, 0.631, 0.503, 0.381, 0.265, 0.175, 0.107, 0.061, 0.032, 0.017, 0.00821, 0.004102, 0.002091, 0.001047, 0.00052, 0.000249, 0.00012,
    0.00006, 0.00003, 0.000015,
];
pub const CMF_Z: [f64; N_BINS] = [
    0.00645, 0.02005, 0.06785, 0.2074, 0.6456, 1.3856, 1.74706, 1.77211, 1.6692, 1.28764, 0.81295, 0.46518, 0.272, 0.1582, 0.07825, 0.04216, 0.0203,
    0.00875, 0.0039, 0.0021, 0.00165, 0.0011, 0.0008, 0.00034, 0.00019, 0.00005, 0.00002, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
];

/// CIE 1931 2-degree colour matching functions (x, y, z) at wavelength `l` nm: the 10 nm table interpolated linearly; zero
/// outside 380-780 nm.
pub fn cmf_xyz(l: f64) -> [f64; 3] {
    if !(BIN_NM0..=BIN_NM0 + BIN_STEP_NM * (N_BINS - 1) as f64).contains(&l) {
        return [0.0; 3];
    }
    let u = (l - BIN_NM0) / BIN_STEP_NM;
    let i = (u.floor() as usize).min(N_BINS - 2);
    let f = u - i as f64;
    [
        CMF_X[i] * (1.0 - f) + CMF_X[i + 1] * f,
        CMF_Y[i] * (1.0 - f) + CMF_Y[i + 1] * f,
        CMF_Z[i] * (1.0 - f) + CMF_Z[i + 1] * f,
    ]
}

fn lobe(l: f64, mu: f64, s1: f64, s2: f64) -> f64 {
    let t = (l - mu) / if l < mu { s1 } else { s2 };
    (-0.5 * t * t).exp()
}

/// Multi-lobe analytic fit of the CIE 1931 functions (Wyman, Sloan & Shirley 2013): cross-check of the table.
pub fn cmf_xyz_fit(l: f64) -> [f64; 3] {
    let x = 1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2);
    let y = 0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1);
    let z = 1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8);
    [x, y, z]
}

/// XYZ -> linear sRGB (D65 white point), IEC 61966-2-1.
pub fn xyz_to_linear_srgb(xyz: [f64; 3]) -> [f64; 3] {
    [
        3.2404542 * xyz[0] - 1.5371385 * xyz[1] - 0.4985314 * xyz[2],
        -0.9692660 * xyz[0] + 1.8760108 * xyz[1] + 0.0415560 * xyz[2],
        0.0556434 * xyz[0] - 0.2040259 * xyz[1] + 1.0572252 * xyz[2],
    ]
}

struct Tables {
    /// Linear-sRGB weights per bin under D65, normalised so a flat spectrum of 1 gives (1, 1, 1) (white balanced).
    weights: [[f64; 3]; N_BINS],
    /// XYZ of an equal-energy spectrum sampled per bin (no illuminant): the emission weights.
    xyz: [[f64; 3]; N_BINS],
}

fn tables() -> &'static Tables {
    static T: OnceLock<Tables> = OnceLock::new();
    T.get_or_init(|| {
        let mut weights = [[0.0; 3]; N_BINS];
        let mut xyz = [[0.0; 3]; N_BINS];
        let mut sum = [0.0; 3];
        for i in 0..N_BINS {
            let c = cmf_xyz(bin_nm(i));
            xyz[i] = c;
            let lit = [c[0] * D65[i], c[1] * D65[i], c[2] * D65[i]];
            let rgb = xyz_to_linear_srgb(lit);
            for k in 0..3 {
                weights[i][k] = rgb[k];
                sum[k] += rgb[k];
            }
        }
        for w in weights.iter_mut() {
            for k in 0..3 {
                w[k] /= sum[k];
            }
        }
        Tables { weights, xyz }
    })
}

/// The per-bin linear-sRGB weights (see `Tables::weights`), flattened `[r0, g0, b0, r1, ...]` for the web.
pub fn rgb_weights_flat() -> Vec<f64> {
    tables().weights.iter().flat_map(|w| w.iter().copied()).collect()
}

/// Colour of a transmittance or reflectance spectrum under D65, linear sRGB, white balanced (T = 1 gives (1, 1, 1)).
/// The result is *not* clamped: a spectrum can lie outside the sRGB gamut.
pub fn spectrum_to_rgb(s: &Spectrum) -> [f64; 3] {
    let t = tables();
    let mut out = [0.0; 3];
    for i in 0..N_BINS {
        for k in 0..3 {
            out[k] += t.weights[i][k] * s[i];
        }
    }
    out
}

/// Clamped version of `spectrum_to_rgb`.
pub fn spectrum_to_rgb_clamped(s: &Spectrum) -> [f64; 3] {
    let c = spectrum_to_rgb(s);
    [c[0].clamp(0.0, 1.0), c[1].clamp(0.0, 1.0), c[2].clamp(0.0, 1.0)]
}

/// Linear-sRGB colour of an *emission* spectrum (power per bin, any unit): Y-normalised so the result has luminance
/// `Y = sum(e * ybar) / sum(ybar)` relative to an equal-energy emitter, plus the total luminance.
pub fn emission_to_rgb(e: &Spectrum) -> ([f64; 3], f64) {
    let t = tables();
    let mut xyz = [0.0; 3];
    let mut y_norm = 0.0;
    for i in 0..N_BINS {
        for k in 0..3 {
            xyz[k] += t.xyz[i][k] * e[i];
        }
        y_norm += t.xyz[i][1];
    }
    for v in xyz.iter_mut() {
        *v /= y_norm.max(1e-12);
    }
    (xyz_to_linear_srgb(xyz), xyz[1])
}

/// Transmittance spectrum `10^-(A L)` of an absorbance-per-cm spectrum over `path_cm`.
pub fn transmittance(a_per_cm: &[f64], path_cm: f64) -> Spectrum {
    let mut t = [1.0; N_BINS];
    for (i, v) in t.iter_mut().enumerate() {
        *v = 10f64.powf(-a_per_cm.get(i).copied().unwrap_or(0.0) * path_cm);
    }
    t
}

/// Linear-sRGB colour of white light transmitted through `path_cm` of absorber (clamped to [0, 1]).
pub fn transmitted_linear_rgb(a_per_cm: &[f64], path_cm: f64) -> [f64; 3] {
    spectrum_to_rgb_clamped(&transmittance(a_per_cm, path_cm))
}

/// sRGB opto-electronic transfer function (linear -> display value).
pub fn to_srgb(v: f64) -> f64 {
    let v = v.clamp(0.0, 1.0);
    if v <= 0.0031308 {
        12.92 * v
    } else {
        1.055 * v.powf(1.0 / 2.4) - 0.055
    }
}

/// CIE L*a*b* of a linear-sRGB colour (D65), for colour differences.
pub fn linear_srgb_to_lab(rgb: [f64; 3]) -> [f64; 3] {
    let x = 0.4124564 * rgb[0] + 0.3575761 * rgb[1] + 0.1804375 * rgb[2];
    let y = 0.2126729 * rgb[0] + 0.7151522 * rgb[1] + 0.0721750 * rgb[2];
    let z = 0.0193339 * rgb[0] + 0.1191920 * rgb[1] + 0.9503041 * rgb[2];
    let f = |t: f64| if t > 216.0 / 24389.0 { t.cbrt() } else { (24389.0 / 27.0 * t + 16.0) / 116.0 };
    let (fx, fy, fz) = (f(x / 0.95047), f(y), f(z / 1.08883));
    [116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz)]
}

/// CIE76 colour difference between two linear-sRGB colours.
pub fn delta_e(a: [f64; 3], b: [f64; 3]) -> f64 {
    let (la, lb) = (linear_srgb_to_lab(a), linear_srgb_to_lab(b));
    ((la[0] - lb[0]).powi(2) + (la[1] - lb[1]).powi(2) + (la[2] - lb[2]).powi(2)).sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn table_agrees_with_the_analytic_fit() {
        // a transcription error in the table would show up as a node far from the smooth fit
        for i in 0..N_BINS {
            let (t, f) = (cmf_xyz(bin_nm(i)), cmf_xyz_fit(bin_nm(i)));
            for k in 0..3 {
                assert!((t[k] - f[k]).abs() < 0.06 * [1.06, 1.0, 1.78][k] + 1e-3, "bin {} ({} nm) channel {}: table {} vs fit {}", i, bin_nm(i), k, t[k], f[k]);
            }
        }
    }

    #[test]
    fn flat_spectrum_is_white() {
        let rgb = spectrum_to_rgb(&[1.0; N_BINS]);
        for c in rgb {
            assert!((c - 1.0).abs() < 1e-9, "{rgb:?}");
        }
    }

    #[test]
    fn d65_white_point_is_neutral_in_xyz() {
        // the D65-weighted Y/X/Z ratios of the fit land on the D65 white point (0.3127, 0.3290) within the fit error
        let (mut x, mut y, mut z) = (0.0, 0.0, 0.0);
        for i in 0..N_BINS {
            let c = cmf_xyz(bin_nm(i));
            x += c[0] * D65[i];
            y += c[1] * D65[i];
            z += c[2] * D65[i];
        }
        let s = x + y + z;
        assert!((x / s - 0.3127).abs() < 0.004 && (y / s - 0.3290).abs() < 0.004, "chromaticity {} {}", x / s, y / s);
    }

    #[test]
    fn monochromatic_hues() {
        let mut s = [0.0; N_BINS];
        s[((650.0 - BIN_NM0) / BIN_STEP_NM) as usize] = 1.0;
        let (rgb, _) = emission_to_rgb(&s);
        assert!(rgb[0] > 0.0 && rgb[0] > 5.0 * rgb[2].abs());
        let mut s = [0.0; N_BINS];
        s[((460.0 - BIN_NM0) / BIN_STEP_NM) as usize] = 1.0;
        let (rgb, _) = emission_to_rgb(&s);
        assert!(rgb[2] > rgb[0] && rgb[2] > rgb[1]);
    }
}
