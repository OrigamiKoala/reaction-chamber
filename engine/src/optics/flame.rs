//! Flame-test emission: the colour a metal gives a flame, from emission lines and bands with Boltzmann and Saha factors.
//!
//! The power an excited level radiates per atom is `g_k A_ki / U exp(-E_k / kT) h nu`. The *fraction of the metal* in each
//! emitting form follows from equilibria at the flame temperature: ionisation (Saha, with the free-electron density of the
//! flame) and association with the flame radicals (`M + OH <-> MOH`, `M + Cl <-> MCl`, with `Delta G = -D0 + T Delta S`).
//! Alkaline-earth flames are coloured by their hydroxides and chlorides (CaOH orange, SrOH red, BaOH green), the alkali metals
//! by their resonance lines (Na yellow, Li crimson, K lilac from the 404 nm doublet since the 766 nm line is invisible), Cu
//! by CuOH (green) and CuCl (blue). The colour is the CIE tristimulus sum of every emitter plus the flame's own
//! (chemiluminescent + soot) light; nothing here names a compound: the data are per-element line and band tables
//! (`data/flame_emitters.json`).

use std::collections::HashMap;
use std::sync::OnceLock;

use serde::Deserialize;

use super::cie::{cmf_xyz, xyz_to_linear_srgb};

#[derive(Deserialize, Clone, Debug)]
pub struct Line {
    pub nm: f64,
    pub gk: f64,
    pub a: f64,
    pub ek_ev: f64,
    #[serde(default)]
    pub ion: bool,
}

#[derive(Deserialize, Clone, Debug)]
pub struct MolBand {
    pub nm: f64,
    pub fwhm: f64,
    pub e_ev: f64,
    pub a_eff: f64,
    /// "OH" | "Cl" | "O2" (forms completely when `d0_ev` is absent)
    pub partner: String,
    #[serde(default)]
    pub d0_ev: Option<f64>,
    pub label: String,
}

#[derive(Deserialize, Clone, Debug)]
pub struct Element {
    pub ionisation_ev: f64,
    pub g_atom: f64,
    pub g_ion: f64,
    pub lines: Vec<Line>,
    pub bands: Vec<MolBand>,
}

#[derive(Deserialize)]
struct File {
    elements: HashMap<String, Element>,
}

fn table() -> &'static HashMap<String, Element> {
    static T: OnceLock<HashMap<String, Element>> = OnceLock::new();
    T.get_or_init(|| serde_json::from_str::<File>(include_str!("../../data/flame_emitters.json")).expect("data/flame_emitters.json").elements)
}

/// Elements that have flame-emission data.
pub fn emitter_elements() -> Vec<String> {
    let mut v: Vec<String> = table().keys().cloned().collect();
    v.sort();
    v
}

/// Free-electron density of a hydrocarbon flame, cm-3 (chemi-ionisation; sets the Saha ionisation). An order-of-magnitude
/// placeholder for the flame, not a property of any metal.
pub const ELECTRON_DENSITY_CM3: f64 = 1e11;
/// Partial pressure of the OH radical in a hydrocarbon-air flame, bar (placeholder, same status).
pub const OH_PARTIAL_BAR: f64 = 3e-3;
/// Entropy change of `M + X -> MX` at flame temperature, J/(mol K): the loss of translational entropy of one species
/// (generic for the association of two gas-phase species into one).
pub const ASSOCIATION_ENTROPY_J_MOL_K: f64 = -130.0;
/// Visible chemiluminescence of a flame (CH*, C2*) as a fraction of its heat release (placeholder).
pub const CHEMILUMINESCENT_FRACTION: f64 = 5e-6;
/// Visible fraction of the heat release carried by incandescent soot per unit of the engine's luminosity index.
pub const SOOT_VISIBLE_FRACTION: f64 = 0.03;
/// Heat-release density of a diffusion flame, W/cm3 (the ratio of metal to flame light is set by atoms per cm3).
pub const HEAT_RELEASE_W_CM3: f64 = 10.0;

const K_B_EV: f64 = 8.617333262e-5;
const E_CHARGE: f64 = 1.602176634e-19;
const R_J_MOL_K: f64 = 8.314462618;
const EV_J_MOL: f64 = 96485.33212;
/// (2 pi m_e k / h^2)^(3/2) in cm-3 K-3/2.
const SAHA_CONST: f64 = 2.4147e15;

/// Result of a flame-test evaluation.
#[derive(Clone, Debug)]
pub struct FlameColour {
    /// Colour of the whole flame (linear sRGB, normalised to its largest channel).
    pub emitter_rgb: [f64; 3],
    /// Share of the visible light that comes from the metals (0 = the flame's own colour).
    pub metal_share: f64,
    /// Strongest emitters: (element, label, wavelength nm, share of the metals' luminance).
    pub top: Vec<(String, String, f64, f64)>,
}

#[derive(Default)]
struct Accum {
    xyz: [f64; 3],
    items: Vec<(String, String, f64, f64)>,
}

fn add_gaussian_band(acc: &mut Accum, el: &str, label: &str, nm: f64, fwhm: f64, power: f64) {
    // area-normalised Gaussian sampled each nm over +-2 fwhm
    let sigma = fwhm / 2.354820045;
    let lo = (nm - 2.0 * fwhm).floor() as i64;
    let hi = (nm + 2.0 * fwhm).ceil() as i64;
    let mut norm = 0.0;
    let mut samples = Vec::new();
    for l in lo..=hi {
        let w = (-0.5 * ((l as f64 - nm) / sigma).powi(2)).exp();
        norm += w;
        samples.push((l as f64, w));
    }
    let mut y = 0.0;
    for (l, w) in samples {
        let c = cmf_xyz(l);
        for k in 0..3 {
            acc.xyz[k] += power * w / norm * c[k];
        }
        y += power * w / norm * c[1];
    }
    acc.items.push((el.to_string(), label.to_string(), nm, y));
}

/// Emission of the metals in a flame at `t_k`. `atoms_cm3` is the total number density of each element's atoms (any form),
/// `cl_cm3` the chlorine atom density (partner of the chlorides). Returns the CIE tristimulus sum (W-equivalent per cm3) and
/// the strongest emitters.
fn metal_emission(atoms_cm3: &HashMap<String, f64>, cl_cm3: f64, t_k: f64) -> Accum {
    let kt_ev = K_B_EV * t_k;
    let mut acc = Accum::default();
    let mut elements: Vec<&String> = atoms_cm3.keys().collect();
    elements.sort();
    for sym in elements {
        let n_tot = atoms_cm3[sym];
        let Some(el) = table().get(sym) else { continue };
        if n_tot <= 0.0 {
            continue;
        }
        // Saha: ionised / neutral
        let saha = 2.0 * el.g_ion / el.g_atom / ELECTRON_DENSITY_CM3 * SAHA_CONST * t_k.powf(1.5) * (-el.ionisation_ev / kt_ev).exp();
        // association constants K = exp(-dG/RT), dG = -D0 + T dS (per mole), in 1/bar
        let mut labels: Vec<(String, f64)> = Vec::new();
        for b in &el.bands {
            if labels.iter().any(|(l, _)| l == &b.label) {
                continue;
            }
            let p_partner_bar = match b.partner.as_str() {
                "OH" => OH_PARTIAL_BAR,
                "Cl" => (cl_cm3 * 1e6 * 1.380649e-23 * t_k / 1e5).max(0.0),
                _ => 1.0,
            };
            let k = match b.d0_ev {
                Some(d0) => {
                    let dg = -d0 * EV_J_MOL - t_k * ASSOCIATION_ENTROPY_J_MOL_K;
                    (-dg / (R_J_MOL_K * t_k)).exp()
                }
                None => 1e6, // forms completely (an oxide of the element)
            };
            labels.push((b.label.clone(), k * p_partner_bar));
        }
        let bound: f64 = labels.iter().map(|(_, kp)| kp).sum();
        let f_atom = 1.0 / (1.0 + saha + bound);
        let f_ion = saha * f_atom;
        for l in &el.lines {
            let f = if l.ion { f_ion } else { f_atom };
            let g0 = if l.ion { el.g_ion } else { el.g_atom };
            let photon_j = 1239.84198 / l.nm * E_CHARGE;
            let power = n_tot * f * l.gk * l.a / g0 * (-l.ek_ev / kt_ev).exp() * photon_j;
            add_gaussian_band(&mut acc, sym, if l.ion { "ion" } else { "atom" }, l.nm, 1.5, power);
        }
        for b in &el.bands {
            let kp = labels.iter().find(|(l, _)| l == &b.label).map_or(0.0, |(_, kp)| *kp);
            let f = kp * f_atom;
            let photon_j = 1239.84198 / b.nm * E_CHARGE;
            let power = n_tot * f * b.a_eff * (-b.e_ev / kt_ev).exp() * photon_j;
            add_gaussian_band(&mut acc, sym, &b.label, b.nm, b.fwhm, power);
        }
    }
    acc
}

/// Colour of a flame carrying the given metals. `base_rgb` / `base_luminosity` are the flame's own colour and soot
/// luminosity index (0-1) from `transfer::combustion::flame_appearance`; `heat_release_w_cm3` scales the flame's own light.
pub fn flame_colour(atoms_cm3: &HashMap<String, f64>, cl_cm3: f64, t_k: f64, base_rgb: [f64; 3], base_luminosity: f64) -> FlameColour {
    let acc = metal_emission(atoms_cm3, cl_cm3, t_k);
    // the flame's own light as a luminance, coloured by `base_rgb`
    let y_base = HEAT_RELEASE_W_CM3 * (CHEMILUMINESCENT_FRACTION + SOOT_VISIBLE_FRACTION * base_luminosity.clamp(0.0, 1.0));
    let base_lum = 0.2126 * base_rgb[0] + 0.7152 * base_rgb[1] + 0.0722 * base_rgb[2];
    let base_lin: [f64; 3] = base_rgb.map(|c| c / base_lum.max(1e-6) * y_base);
    // convert the base linear sRGB into XYZ
    let base_xyz = [
        0.4124564 * base_lin[0] + 0.3575761 * base_lin[1] + 0.1804375 * base_lin[2],
        0.2126729 * base_lin[0] + 0.7151522 * base_lin[1] + 0.0721750 * base_lin[2],
        0.0193339 * base_lin[0] + 0.1191920 * base_lin[1] + 0.9503041 * base_lin[2],
    ];
    let xyz = [acc.xyz[0] + base_xyz[0], acc.xyz[1] + base_xyz[1], acc.xyz[2] + base_xyz[2]];
    let rgb = xyz_to_linear_srgb(xyz);
    let m = rgb.iter().cloned().fold(1e-30, f64::max);
    let emitter_rgb = rgb.map(|c| (c / m).clamp(0.0, 1.0));
    let y_metal = acc.xyz[1];
    let metal_share = if y_metal + y_base > 0.0 { y_metal / (y_metal + y_base) } else { 0.0 };
    let total_y: f64 = acc.items.iter().map(|i| i.3).sum();
    let mut top: Vec<(String, String, f64, f64)> = acc.items.iter().map(|(e, l, nm, y)| (e.clone(), l.clone(), *nm, if total_y > 0.0 { y / total_y } else { 0.0 })).collect();
    top.sort_by(|a, b| b.3.partial_cmp(&a.3).unwrap_or(std::cmp::Ordering::Equal));
    top.truncate(6);
    FlameColour { emitter_rgb, metal_share, top }
}

/// Atoms per cm3 of flame gas that a liquid sample carries into the flame.
///
/// `mol_per_cm3_liquid` is the molar concentration of each element in the sample (mol of atoms per cm3 of liquid);
/// `entrainment` the fraction of the sample the flame carries off as droplets, and `liquid_per_gas` the volume of burning
/// liquid per volume of flame gas (cm3/cm3). The product times Avogadro's number is the atom density.
pub fn atom_density_cm3(mol_per_cm3_liquid: f64, entrainment: f64, liquid_per_gas: f64) -> f64 {
    mol_per_cm3_liquid * entrainment * liquid_per_gas * super::gas::N_A
}

#[cfg(test)]
mod tests {
    use super::*;

    fn colour_of(el: &str, n: f64, cl: f64) -> FlameColour {
        let mut m = HashMap::new();
        m.insert(el.to_string(), n);
        // a pale blue base flame at 2000 K with no soot
        flame_colour(&m, cl, 2000.0, [0.35, 0.5, 1.0], 0.0)
    }

    fn dominant_wavelength_class(lin: [f64; 3]) -> &'static str {
        // classify the display (sRGB-encoded) colour
        let enc = |v: f64| crate::optics::cie::to_srgb(v);
        let (r, g, b) = (enc(lin[0]), enc(lin[1]), enc(lin[2]));
        if r > 0.8 && g > 0.3 && g < 0.9 && b < 0.3 {
            return "yellow-orange";
        }
        if r >= g && r >= b && g < 0.3 * r && b < 0.3 * r {
            return "red";
        }
        if r > 0.5 * g && b > 0.5 * g && g < 0.8 * r.max(b) && b > 0.3 {
            return "violet";
        }
        if g >= r && g >= b {
            return if b > 0.6 * g { "blue-green" } else { "green" };
        }
        if b >= r && b >= g {
            return "blue";
        }
        "other"
    }

    #[test]
    fn flame_test_colours_follow_from_the_line_data() {
        let n = 5e14;
        let na = colour_of("Na", n, 0.0);
        assert_eq!(dominant_wavelength_class(na.emitter_rgb), "yellow-orange", "Na {:?}", na);
        assert!(na.metal_share > 0.9);
        let li = colour_of("Li", n, 0.0);
        assert_eq!(dominant_wavelength_class(li.emitter_rgb), "red", "Li {:?}", li);
        let sr = colour_of("Sr", n, 0.0);
        assert_eq!(dominant_wavelength_class(sr.emitter_rgb), "red", "Sr {:?}", sr);
        let k = colour_of("K", n, 0.0);
        assert_eq!(dominant_wavelength_class(k.emitter_rgb), "violet", "K {:?}", k);
        let ba = colour_of("Ba", n, 0.0);
        assert_eq!(dominant_wavelength_class(ba.emitter_rgb), "green", "Ba {:?}", ba);
    }

    #[test]
    fn copper_is_green_and_turns_blue_green_with_chloride() {
        let cu = colour_of("Cu", 5e14, 0.0);
        let cucl2 = colour_of("Cu", 5e14, 1e15);
        assert!(cu.emitter_rgb[1] > cu.emitter_rgb[0], "CuOH is green: {:?}", cu.emitter_rgb);
        assert!(cucl2.emitter_rgb[2] > cu.emitter_rgb[2], "chloride adds the CuCl blue band: {:?} vs {:?}", cucl2.emitter_rgb, cu.emitter_rgb);
    }

    #[test]
    fn no_metal_leaves_the_flames_own_colour() {
        let none = flame_colour(&HashMap::new(), 0.0, 2000.0, [0.35, 0.5, 1.0], 0.0);
        assert!(none.metal_share == 0.0);
        assert!(none.emitter_rgb[2] > none.emitter_rgb[0]);
    }

    #[test]
    fn a_sooty_flame_hides_a_trace_metal() {
        let mut m = HashMap::new();
        m.insert("Na".to_string(), 1e11);
        let clean = flame_colour(&m, 0.0, 2000.0, [0.35, 0.5, 1.0], 0.0);
        let sooty = flame_colour(&m, 0.0, 2000.0, [1.0, 0.6, 0.2], 0.9);
        assert!(sooty.metal_share < clean.metal_share);
    }
}
