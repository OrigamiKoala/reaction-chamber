//! The one RGB -> spectrum inversion, a **Speculative** fallback.
//!
//! Some things are known only by a colour (the neat colour of a pure liquid from a PubChem colour phrase, the bulk colour of a
//! solid): there is no absorptivity behind them, so the spectrum built here is a smooth, bounded stand-in that reproduces the
//! colour under D65 and nothing else (no concentration dependence beyond Beer-Lambert scaling, no physical band positions).
//! It must never be used where a real band, band gap or ligand-field estimate exists, and the snapshot labels what used it.
//!
//! The spectrum is the sigmoid-of-a-quadratic family of Jakob & Hanika (EGSR 2019): `T(l) = sigmoid(c0 x^2 + c1 x + c2)`
//! with `x` the normalised wavelength, whose three coefficients are found by Gauss-Newton on the engine's own colorimetry.

use super::cie::{bin_nm, spectrum_to_rgb, Spectrum, BIN_NM0, BIN_STEP_NM, N_BINS};

fn sigmoid(x: f64) -> f64 {
    0.5 + x / (2.0 * (1.0 + x * x).sqrt())
}

fn spectrum_of(c: [f64; 3]) -> Spectrum {
    let mut s = [0.0; N_BINS];
    let span = BIN_STEP_NM * (N_BINS - 1) as f64;
    for (i, v) in s.iter_mut().enumerate() {
        let x = (bin_nm(i) - BIN_NM0) / span;
        *v = sigmoid(c[0] * x * x + c[1] * x + c[2]);
    }
    s
}

fn solve3(a: [[f64; 3]; 3], b: [f64; 3]) -> Option<[f64; 3]> {
    let det = |m: &[[f64; 3]; 3]| {
        m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    };
    let d = det(&a);
    if d.abs() < 1e-14 {
        return None;
    }
    let mut out = [0.0; 3];
    for k in 0..3 {
        let mut m = a;
        for r in 0..3 {
            m[r][k] = b[r];
        }
        out[k] = det(&m) / d;
    }
    Some(out)
}

/// A smooth transmittance / reflectance spectrum in (0, 1) whose D65 colour is the linear-sRGB `target`.
/// Components are limited to [0.015, 0.985]: pure black and pure white have no finite sigmoid.
pub fn spectrum_from_rgb(target: [f64; 3]) -> Spectrum {
    let tgt = target.map(|v| v.clamp(0.015, 0.985));
    let mean = (tgt[0] + tgt[1] + tgt[2]) / 3.0;
    let logit = |p: f64| {
        let p = p.clamp(1e-4, 1.0 - 1e-4);
        (2.0 * p - 1.0) / (4.0 * p * (1.0 - p)).sqrt()
    };
    let mut c = [0.0, 0.0, logit(mean)];
    let mut best = (f64::MAX, c);
    for _ in 0..40 {
        let rgb = spectrum_to_rgb(&spectrum_of(c));
        let err = [rgb[0] - tgt[0], rgb[1] - tgt[1], rgb[2] - tgt[2]];
        let norm = err.iter().map(|e| e * e).sum::<f64>();
        if norm < best.0 {
            best = (norm, c);
        }
        if norm < 1e-10 {
            break;
        }
        let mut jac = [[0.0; 3]; 3];
        for k in 0..3 {
            let mut cp = c;
            cp[k] += 1e-4;
            let r2 = spectrum_to_rgb(&spectrum_of(cp));
            for j in 0..3 {
                jac[j][k] = (r2[j] - rgb[j]) / 1e-4;
            }
        }
        let Some(step) = solve3(jac, [-err[0], -err[1], -err[2]]) else { break };
        // damped step: the sigmoid saturates for large coefficients
        let scale = (step.iter().map(|s| s * s).sum::<f64>().sqrt() / 8.0).max(1.0);
        for k in 0..3 {
            c[k] += step[k] / scale;
        }
    }
    spectrum_of(best.1)
}

/// Decadic absorbance per cm per bin whose transmission over `path_cm` has the colour `target` (linear sRGB).
pub fn absorbance_for_colour(target: [f64; 3], path_cm: f64) -> Vec<f64> {
    spectrum_from_rgb(target).iter().map(|t| (-t.max(1e-4).log10() / path_cm.max(1e-6)).max(0.0)).collect()
}

/// Mean transmittance of a spectrum (a grey-level strength of absorption).
pub fn mean(s: &Spectrum) -> f64 {
    s.iter().sum::<f64>() / N_BINS as f64
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::optics::cie::delta_e;

    #[test]
    fn reproduces_colours_under_d65() {
        let cases: [[f64; 3]; 6] = [[0.9, 0.9, 0.9], [0.8, 0.2, 0.1], [0.1, 0.4, 0.8], [0.3, 0.7, 0.2], [0.5, 0.5, 0.5], [0.85, 0.7, 0.05]];
        for t in cases {
            let rgb = spectrum_to_rgb(&spectrum_from_rgb(t));
            assert!(delta_e(rgb, t) < 4.0, "{t:?} -> {rgb:?} (dE {})", delta_e(rgb, t));
        }
    }

    #[test]
    fn spectra_are_bounded_and_smooth() {
        let s = spectrum_from_rgb([0.7, 0.1, 0.5]);
        assert!(s.iter().all(|v| *v > 0.0 && *v < 1.0));
        let max_step = s.windows(2).map(|w| (w[1] - w[0]).abs()).fold(0.0, f64::max);
        assert!(max_step < 0.2, "{max_step}");
    }
}
