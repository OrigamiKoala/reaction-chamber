//! Ligand-field band positions of first-row d-ion complexes (Estimated tier).
//!
//! No large database holds d-d spectra, so the visible bands of a transition-metal complex are *derived* from three
//! kinds of intrinsic parameter (`data/ligand_field.json`): the spectrochemical factors of its ligands and of the metal
//! ion (Jorgensen: `Delta_o = g * mean(f)` over the six sites, the average-environment rule), the nephelauxetic
//! reduction of the Racah parameter `B` and the mean spin-pairing energy of the d4-d7 ions. The band energies then come
//! from the Tanabe-Sugano secular equations of the d^n configuration in an octahedral field (tetrahedral complexes
//! use the d^(10-n) octahedral equations with `Delta_t = 4/9 Delta_o`). Spin-allowed bands get a Laporte-forbidden
//! (octahedral) or partly allowed (tetrahedral) absorptivity, spin-forbidden ones a tiny one.
//!
//! Only d-d bands are produced. Charge-transfer colours (permanganate, chromate, thiocyanato complexes, Prussian blue)
//! are not ligand-field transitions and must come from data (`optics_seed.json`, imported UV bands).

use std::collections::HashMap;
use std::sync::OnceLock;

use serde::Deserialize;

use crate::db::record::OpticsBand;

#[derive(Deserialize)]
struct LigandRow {
    f: f64,
    h: f64,
    charge: i32,
    #[serde(default)]
    halide: bool,
}

#[derive(Deserialize)]
struct MetalRow {
    g: f64,
    #[serde(rename = "B")]
    b: f64,
    k: f64,
    #[serde(rename = "P", default)]
    p: Option<f64>,
}

#[derive(Deserialize)]
struct Params {
    ligands: HashMap<String, LigandRow>,
    metals: HashMap<String, MetalRow>,
    group_numbers: HashMap<String, i32>,
    aqua_ligand: String,
    anion_ligands: HashMap<String, String>,
    anion_without_ligand: Vec<String>,
    /// Ligand a complex anion (hexacyanoferrate, ...) offers a cation: bound through the nitrogen end of its cyanides.
    complex_anion_ligand: String,
}

fn params() -> &'static Params {
    static P: OnceLock<Params> = OnceLock::new();
    P.get_or_init(|| serde_json::from_str(include_str!("../../data/ligand_field.json")).expect("data/ligand_field.json"))
}

/// Free-ion C/B ratio of the first-row ions (typically 3.7-4.5).
const C_OVER_B: f64 = 4.0;
/// Molar absorptivity of a spin-allowed d-d band in a centrosymmetric complex, L/(mol cm).
const EPS_OCT: f64 = 8.0;
/// ... when the ligand set breaks the inversion centre (mixed ligands) or the geometry is tetrahedral.
const EPS_LOW_SYMMETRY: f64 = 25.0;
const EPS_TETRAHEDRAL: f64 = 300.0;
/// ... of a spin-forbidden band.
const EPS_SPIN_FORBIDDEN: f64 = 0.03;

#[derive(Clone, Debug, PartialEq)]
pub enum Geometry {
    Octahedral,
    Tetrahedral,
}

/// A complex as the model sees it: the metal ion (element, oxidation state) and its ligands.
#[derive(Clone, Debug)]
pub struct Complex {
    pub metal: String,
    pub ox: i32,
    /// (ligand name, count). Missing sites of an octahedron are filled with water.
    pub ligands: Vec<(String, u32)>,
    pub geometry: Geometry,
}

/// What the estimator found out about a complex.
#[derive(Clone, Debug)]
pub struct Estimate {
    pub bands: Vec<OpticsBand>,
    pub d_count: i32,
    pub delta_cm: f64,
    pub b_cm: f64,
    pub high_spin: bool,
    pub geometry: Geometry,
}

fn gaussian_fwhm_nm(nu_cm: f64, narrow: bool) -> f64 {
    let lambda_nm = 1e7 / nu_cm;
    let fwhm_cm = if narrow { 800.0 } else { 2500.0 + 0.1 * nu_cm };
    // a band of width dnu at wavenumber nu spans lambda^2 dnu in wavelength
    (lambda_nm * lambda_nm * fwhm_cm * 1e-7).max(5.0)
}

fn band(nu_cm: f64, eps: f64, narrow: bool) -> OpticsBand {
    OpticsBand { solvent: None, nm: 1e7 / nu_cm, eps, fwhm: Some(gaussian_fwhm_nm(nu_cm, narrow)), kind: Some("d-d".to_string()) }
}

/// d^2 / d^7 (high spin) octahedral transitions from the ground T1g(F): the 3T1g(F)/3T1g(P) secular determinant
/// `[[-6Dq, 4Dq], [4Dq, 15B]]`, then 3T2g(F) = 2Dq and 3A2g(F) = 12Dq. Returns the three transition energies (cm-1).
fn d2_like(dq: f64, b: f64) -> [f64; 3] {
    let s = ((15.0 * b + 6.0 * dq).powi(2) + 64.0 * dq * dq).sqrt();
    let e_low = 0.5 * (15.0 * b - 6.0 * dq - s);
    let e_high = 0.5 * (15.0 * b - 6.0 * dq + s);
    [2.0 * dq - e_low, e_high - e_low, 12.0 * dq - e_low]
}

/// d^3 / d^8 octahedral transitions from the ground A2g: 10Dq, and the mixed T1g(F)/T1g(P) pair
/// `15Dq + 7.5B -+ 1/2 sqrt(225B^2 - 180 B Dq + 100 Dq^2)`.
fn d3_like(dq: f64, b: f64) -> [f64; 3] {
    let root = (225.0 * b * b - 180.0 * b * dq + 100.0 * dq * dq).max(0.0).sqrt();
    [10.0 * dq, 15.0 * dq + 7.5 * b - 0.5 * root, 15.0 * dq + 7.5 * b + 0.5 * root]
}

/// Bands of one `d^n` configuration with octahedral-equivalent field `delta` (cm-1) and Racah `b`.
fn octahedral_equivalent_bands(n: i32, delta: f64, b: f64, high_spin: bool, eps: f64) -> Vec<OpticsBand> {
    let dq = delta / 10.0;
    let c = C_OVER_B * b;
    let mut out = Vec::new();
    match (n, high_spin) {
        (1, _) | (9, _) | (4, true) | (6, true) => out.push(band(delta, eps, false)),
        (2, _) | (7, true) => {
            let t = d2_like(dq, b);
            out.push(band(t[0], eps, false));
            out.push(band(t[1], eps, false));
            out.push(band(t[2], eps * 0.3, false));
        }
        (3, _) | (8, _) => {
            let t = d3_like(dq, b);
            out.push(band(t[0], eps, false));
            out.push(band(t[1], eps, false));
            out.push(band(t[2], eps, false));
        }
        (5, true) => {
            // the sextet ground state has no spin-allowed band: 6A1 -> 4A1,4E(G) at 10B + 5C (field independent) and
            // -> 4T1(G) near 10B + 6C - Delta
            out.push(band(10.0 * b + 5.0 * c, EPS_SPIN_FORBIDDEN, true));
            out.push(band((10.0 * b + 6.0 * c - delta).max(9000.0), EPS_SPIN_FORBIDDEN, true));
        }
        (6, false) => {
            // low-spin d6: 1A1g -> 1T1g, 1T2g (Lever)
            let nu1 = delta - c + 86.0 * b * b / delta;
            out.push(band(nu1, eps, false));
            out.push(band(nu1 + 16.0 * b, eps, false));
        }
        _ => {}
    }
    out
}

/// Whether a complex with `n` d electrons is high spin in a field `delta` with the ion's pairing energy `p`.
fn is_high_spin(n: i32, delta: f64, pairing: Option<f64>) -> bool {
    match n {
        4..=7 => pairing.map_or(true, |p| delta < p),
        _ => true,
    }
}

impl Complex {
    /// Estimates the d-d bands. None when the ion is outside the first-row table, has no d electrons that can absorb in
    /// the visible, or a ligand is unknown.
    pub fn estimate(&self) -> Option<Estimate> {
        let p = params();
        let key = format!("{}{:+}", self.metal, self.ox);
        let metal = p.metals.get(&key)?;
        let group = *p.group_numbers.get(&self.metal)?;
        let n = group - self.ox;
        if !(1..=9).contains(&n) {
            return None;
        }
        let n_sites: u32 = if self.geometry == Geometry::Tetrahedral { 4 } else { 6 };
        let given: u32 = self.ligands.iter().map(|(_, c)| *c).sum();
        if given > n_sites {
            return None;
        }
        let mut f_sum = 0.0;
        let mut h_sum = 0.0;
        let mut non_aqua = 0u32;
        for (name, count) in &self.ligands {
            let l = p.ligands.get(name)?;
            f_sum += l.f * *count as f64;
            h_sum += l.h * *count as f64;
            if *name != p.aqua_ligand {
                non_aqua += *count;
            }
        }
        // the sites without a listed ligand are water
        let water = p.ligands.get(&p.aqua_ligand)?;
        let rest = (n_sites - given) as f64;
        f_sum += water.f * rest;
        h_sum += water.h * rest;
        let h_mean = h_sum / n_sites as f64;
        // a Jahn-Teller ion (d9, high-spin d4) elongates along one axis: the band follows the four strongest in-plane ligands
        let jahn_teller = !matches!(self.geometry, Geometry::Tetrahedral) && (n == 9 || (n == 4 && is_high_spin(n, metal.g * 1000.0 * f_sum / n_sites as f64, metal.p)));
        let f_mean = if jahn_teller {
            let mut sites: Vec<f64> = Vec::new();
            for (name, count) in &self.ligands {
                for _ in 0..*count {
                    sites.push(p.ligands.get(name)?.f);
                }
            }
            for _ in 0..(n_sites - given) {
                sites.push(water.f);
            }
            sites.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
            sites.iter().take(4).sum::<f64>() / 4.0
        } else {
            f_sum / n_sites as f64
        };

        let delta_o = metal.g * 1000.0 * f_mean;
        let beta = (1.0 - h_mean * metal.k).clamp(0.4, 1.0);
        let b = metal.b * beta;
        let tetra = self.geometry == Geometry::Tetrahedral;
        let delta = if tetra { 4.0 / 9.0 * delta_o } else { delta_o };
        // a complex of identical ligands keeps the inversion centre
        let symmetric = non_aqua == 0 || (self.ligands.len() == 1 && given == n_sites);
        let eps = if tetra {
            EPS_TETRAHEDRAL
        } else if symmetric {
            EPS_OCT
        } else {
            EPS_LOW_SYMMETRY
        };

        let high_spin = if tetra { true } else { is_high_spin(n, delta, metal.p) };
        // a tetrahedral d^n complex has the spectrum of the octahedral d^(10-n) one (hole formalism)
        let n_eq = if tetra && n != 5 { 10 - n } else { n };
        let bands = octahedral_equivalent_bands(n_eq, delta, b, high_spin, eps);
        if bands.is_empty() {
            return None;
        }
        Some(Estimate { bands, d_count: n, delta_cm: delta, b_cm: b, high_spin, geometry: self.geometry.clone() })
    }
}

// -------------------------------------------------------------------------------------------------- species ids

/// Ligand a solid's anion offers a cation: halides and pseudo-halides as themselves, other oxyanions as oxygen donors (the
/// aqua ligand), None for sulfide-like anions without a tabulated field strength.
pub fn ligand_of_anion(id: &str) -> Option<String> {
    let p = params();
    if let Some(l) = p.anion_ligands.get(id) {
        return Some(l.clone());
    }
    if p.anion_without_ligand.iter().any(|a| a == id) {
        return None;
    }
    // a complex anion with a metal binds through the nitrogen end of its cyanide; an oxyanion through oxygen
    if complex_from_species_id(id).is_some() {
        return Some(p.complex_anion_ligand.clone());
    }
    if crate::ions::anion_def(id).is_some() && id.contains('O') {
        return Some(p.aqua_ligand.clone());
    }
    None
}

fn charge_of_ligand(name: &str) -> Option<i32> {
    params().ligands.get(name).map(|l| l.charge)
}

fn is_halide_ligand(name: &str) -> bool {
    params().ligands.get(name).map_or(false, |l| l.halide)
}

/// Splits `body` after the metal symbol into (ligand, count) groups. Accepts `(NH3)4`, `Cl4`, `(CN)6`, `H2O`...
fn parse_ligands(rest: &str) -> Option<Vec<(String, u32)>> {
    let p = params();
    let mut names: Vec<&String> = p.ligands.keys().collect();
    names.sort_by_key(|n| std::cmp::Reverse(n.len()));
    let chars: Vec<char> = rest.chars().collect();
    let mut i = 0;
    let mut out: Vec<(String, u32)> = Vec::new();
    let read_count = |i: &mut usize| -> u32 {
        let start = *i;
        while *i < chars.len() && chars[*i].is_ascii_digit() {
            *i += 1;
        }
        if start == *i {
            1
        } else {
            chars[start..*i].iter().collect::<String>().parse().unwrap_or(1)
        }
    };
    while i < chars.len() {
        if chars[i] == '(' {
            let close = chars[i..].iter().position(|c| *c == ')')? + i;
            let inner: String = chars[i + 1..close].iter().collect();
            i = close + 1;
            if !p.ligands.contains_key(&inner) {
                return None;
            }
            let count = read_count(&mut i);
            out.push((inner, count));
        } else {
            let tail: String = chars[i..].iter().collect();
            let name = names.iter().find(|n| tail.starts_with(n.as_str()))?;
            i += name.len();
            let count = read_count(&mut i);
            out.push((name.to_string(), count));
        }
    }
    Some(out)
}

/// Reads a complex ion id ("Ni+2", "Cu(NH3)4+2", "CoCl4-2", "Fe(CN)6-3") into a `Complex`. None for an id that is not a
/// first-row metal ion with known ligands.
pub fn complex_from_species_id(id: &str) -> Option<Complex> {
    let (body, z) = crate::ions::split_charge(id);
    let mut chars = body.chars();
    let first = chars.next()?;
    if !first.is_ascii_uppercase() {
        return None;
    }
    let mut metal = first.to_string();
    let mut consumed = 1;
    if let Some(c) = body.chars().nth(1) {
        if c.is_ascii_lowercase() {
            metal.push(c);
            consumed = 2;
        }
    }
    if !params().group_numbers.contains_key(&metal) {
        return None;
    }
    let ligands = parse_ligands(&body[consumed..])?;
    let ligand_charge: i32 = ligands.iter().map(|(n, c)| charge_of_ligand(n).unwrap_or(0) * *c as i32).sum();
    let ox = z - ligand_charge;
    let n_given: u32 = ligands.iter().map(|(_, c)| *c).sum();
    let all_halide = !ligands.is_empty() && ligands.iter().all(|(n, _)| is_halide_ligand(n));
    let geometry = if all_halide && n_given == 4 { Geometry::Tetrahedral } else { Geometry::Octahedral };
    Some(Complex { metal, ox, ligands, geometry })
}

/// Estimated d-d bands of a species id (water solvent). None when the ligand-field model does not apply.
pub fn estimate_species(id: &str) -> Option<Estimate> {
    complex_from_species_id(id)?.estimate()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn nm_of(e: &Estimate) -> Vec<f64> {
        e.bands.iter().map(|b| b.nm).collect()
    }

    #[test]
    fn aqua_ions_land_on_their_classical_bands() {
        // [Cr(H2O)6]3+: 575 nm (17,400 cm-1) and 408 nm (24,500)
        let cr = estimate_species("Cr+3").unwrap();
        let nm = nm_of(&cr);
        assert!((nm[0] - 575.0).abs() < 15.0, "{nm:?}");
        assert!((nm[1] - 408.0).abs() < 15.0, "{nm:?}");
        // [Ni(H2O)6]2+: 395 nm and ~710 nm (14,000), NIR band outside the grid
        let ni = estimate_species("Ni+2").unwrap();
        let nm = nm_of(&ni);
        assert!(nm.iter().any(|x| (x - 395.0).abs() < 15.0), "{nm:?}");
        assert!(nm.iter().any(|x| (x - 710.0).abs() < 50.0), "{nm:?}");
        // [Cu(H2O)6]2+: ~800 nm
        let cu = estimate_species("Cu+2").unwrap();
        assert!((cu.bands[0].nm - 800.0).abs() < 40.0, "{:?}", cu.bands);
        // [Co(H2O)6]2+ is high spin, absorbs near 500 nm
        let co = estimate_species("Co+2").unwrap();
        assert!(co.high_spin && nm_of(&co).iter().any(|x| (x - 510.0).abs() < 70.0), "{:?}", nm_of(&co));
        // [V(H2O)6]3+: 17,200 and 25,600 cm-1
        let v = estimate_species("V+3").unwrap();
        let nm = nm_of(&v);
        assert!((nm[0] - 580.0).abs() < 40.0 && (nm[1] - 390.0).abs() < 25.0, "{nm:?}");
    }

    #[test]
    fn ligands_shift_the_bands() {
        let aqua = estimate_species("Cu+2").unwrap();
        let ammine = estimate_species("Cu(NH3)4+2").unwrap();
        assert!(ammine.bands[0].nm < aqua.bands[0].nm - 100.0, "ammonia must blue-shift the Cu2+ band");
        assert!((ammine.bands[0].nm - 610.0).abs() < 80.0, "{:?}", ammine.bands);
    }

    #[test]
    fn tetrahedral_cobalt_chloride() {
        let c = estimate_species("CoCl4-2").unwrap();
        assert_eq!(c.geometry, Geometry::Tetrahedral);
        let nm = nm_of(&c);
        assert!(nm.iter().any(|x| *x > 550.0 && *x < 750.0), "{nm:?}");
        assert!(c.bands.iter().any(|b| b.eps > 100.0), "tetrahedral bands are 100x stronger than octahedral");
    }

    #[test]
    fn strong_field_low_spin_and_non_applicable() {
        // hexaamminecobalt(III) is low-spin d6: 1A1g -> 1T1g near 475 nm
        let co3 = estimate_species("Co(NH3)6+3").unwrap();
        assert!(!co3.high_spin);
        assert!((co3.bands[0].nm - 475.0).abs() < 40.0, "{:?}", co3.bands);
        assert!(estimate_species("Zn+2").is_none(), "d10 has no d-d band");
        assert!(estimate_species("Na+").is_none());
        assert!(estimate_species("MnO4-").is_none(), "d0 charge-transfer species are not ligand-field");
    }
}
