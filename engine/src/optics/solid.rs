//! Colour of a solid: Kubelka-Munk reflectance of a powder from what is known about the solid's absorption.
//!
//! Evidence, strongest first:
//! 1. a *measured colour* of the solid (a parsed colour phrase of the record, never for a hydrate when the solid is
//!    anhydrous) - used as the colour itself, with the spectrum behind it from the Speculative RGB inversion;
//! 2. computed absorption: the *band edge* of the solid's optical band gap (absorption above `E_g`, an Urbach tail below),
//!    the d-d bands of its transition-metal cations *inherited* from the ligand-field model with the anion as ligand, and
//!    an intervalence-charge-transfer band when one metal appears in two oxidation states (Robin-Day class II mixed
//!    valence); the powder reflectance follows from `K/S` with the scattering coefficient `S` set by the grain size;
//! 3. nothing known: `None` (the caller falls back to the hand-picked mineral colour or the cation/anion hue rules, both
//!    labelled Speculative).
//!
//! Absorption coefficients are in cm-1: `K = 2 alpha`, `alpha = 2.303 eps c` with `c` the molar concentration of the
//! chromophore *in the solid* (density / molar mass x count per formula unit).

use super::cie::{bin_nm, spectrum_to_rgb, Spectrum, N_BINS};
use super::fallback;
use super::ligand_field::{self, Complex, Geometry};
use crate::db::record::{Optics, SolidColour};
use crate::types::ProvenanceTier;

/// Direct-gap absorption constant, cm-1 eV-1/2 (typical 1e5).
const ALPHA_EDGE: f64 = 1.0e5;
/// Urbach tail energy, eV.
const URBACH_EV: f64 = 0.025;
/// Host gap of a solid known only by its d-d chromophores (colourless host), eV.
const COLOURLESS_HOST_GAP_EV: f64 = 5.5;
/// Intervalence band of a class-II mixed-valence solid: photon energy (eV), width (eV) and absorptivity per pair.
const IVCT_EV: f64 = 1.8;
const IVCT_FWHM_EV: f64 = 0.8;
const IVCT_EPS: f64 = 5000.0;
/// Hc, eV nm.
const HC_EV_NM: f64 = 1239.84198;

/// Everything the solid colour needs about one solid species.
pub struct SolidSpec<'a> {
    /// Ions of one formula unit (cation/anion ids with counts), e.g. `[("Fe+3", 4), ("Fe(CN)6-4", 3)]`; empty for a molecular
    /// solid or an element.
    pub ions: &'a [(String, f64)],
    pub density_g_ml: f64,
    pub mw: f64,
    pub particle_um: f64,
    /// The optical record (store or seed row).
    pub record: Option<&'a Optics>,
    /// A measured colour supplied with an import (overrides the record's).
    pub measured_colour: Option<&'a SolidColour>,
    pub is_metal: bool,
}

/// The computed look of a solid.
#[derive(Clone, Debug)]
pub struct SolidLook {
    /// Bulk (powder) colour, linear sRGB.
    pub rgb: [f64; 3],
    /// Diffuse reflectance per bin.
    pub reflectance: Spectrum,
    /// Absorption coefficient of the solid material per bin, cm-1 (the imaginary refractive index for scattering).
    pub alpha_per_cm: Spectrum,
    pub tier: ProvenanceTier,
    pub source: String,
    /// "measured-colour" | "band-edge" | "ion-chromophore" | "mixed-valence" | "metal-lustre"
    pub basis: &'static str,
}

fn km_reflectance(ks: f64) -> f64 {
    (1.0 + ks - (ks * ks + 2.0 * ks).sqrt()).clamp(0.0, 1.0)
}

/// Edge absorption coefficient (cm-1) at photon energy `e_ev` for a gap `eg_ev`: a square-root edge above the gap and an
/// Urbach tail `alpha_g exp((E - E_g)/E_u)` below it, continuous at the gap.
pub fn edge_alpha(e_ev: f64, eg_ev: f64) -> f64 {
    let de = e_ev - eg_ev;
    if de >= 0.0 {
        ALPHA_EDGE * (URBACH_EV + de).sqrt()
    } else {
        ALPHA_EDGE * URBACH_EV.sqrt() * (de / URBACH_EV).exp()
    }
}

/// Scattering coefficient S (cm-1) of a powder of grains of `d_um` (Kubelka-Munk: ~ 1.5 / d).
fn scattering_coefficient(d_um: f64) -> f64 {
    1.5 / (d_um.clamp(0.5, 200.0) * 1e-4)
}

/// Chromophore bands of the solid's transition-metal cations: (cation count per formula unit, bands).
fn inherited_bands(ions: &[(String, f64)]) -> Vec<(f64, Vec<crate::db::record::OpticsBand>)> {
    let anion_ligand = ions.iter().filter(|(id, _)| crate::ions::species_charge(id) < 0).find_map(|(id, _)| ligand_field::ligand_of_anion(id));
    let Some(lig) = anion_ligand else { return Vec::new() };
    let mut out = Vec::new();
    for (id, n) in ions.iter().filter(|(id, _)| crate::ions::species_charge(id) > 0) {
        let Some(base) = ligand_field::complex_from_species_id(id) else { continue };
        if !base.ligands.is_empty() {
            continue; // a complex cation brings its own ligands: its bands are the solution ones
        }
        let c = Complex { metal: base.metal, ox: base.ox, ligands: vec![(lig.clone(), 6)], geometry: Geometry::Octahedral };
        if let Some(est) = c.estimate() {
            out.push((*n, est.bands));
        }
    }
    out
}

/// Pairs of a metal in two oxidation states per formula unit (mixed valence), 0 when there are none.
fn mixed_valence_pairs(ions: &[(String, f64)]) -> f64 {
    let mut by_metal: std::collections::HashMap<String, std::collections::HashMap<i32, f64>> = std::collections::HashMap::new();
    for (id, n) in ions {
        if let Some(c) = ligand_field::complex_from_species_id(id) {
            *by_metal.entry(c.metal).or_default().entry(c.ox).or_insert(0.0) += *n;
        }
    }
    let mut pairs = 0.0;
    for states in by_metal.values() {
        if states.len() >= 2 {
            let mut counts: Vec<f64> = states.values().copied().collect();
            counts.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            pairs += counts[0];
        }
    }
    pairs
}

/// The look of a solid, or None when nothing is known about its absorption.
pub fn look(spec: &SolidSpec) -> Option<SolidLook> {
    let measured = spec.measured_colour.or_else(|| spec.record.and_then(|o| o.colour.as_ref()));
    // a hydrate's colour is not the colour of the anhydrous solid the engine holds
    if let Some(c) = measured.filter(|c| c.subject == "solid" && c.hydrate != Some(true) && c.confidence >= 0.5) {
        let tier = spec.record.and_then(|o| o.tier.clone()).unwrap_or(ProvenanceTier::Imported);
        let refl = fallback::spectrum_from_rgb(c.rgb_linear);
        let mut alpha = [0.0; N_BINS];
        let s = scattering_coefficient(spec.particle_um);
        for (a, r) in alpha.iter_mut().zip(refl.iter()) {
            // invert Kubelka-Munk: K/S = (1 - R)^2 / (2 R)
            *a = 0.5 * s * (1.0 - r).powi(2) / (2.0 * r.max(1e-4));
        }
        return Some(SolidLook {
            rgb: c.rgb_linear.map(|v| v.clamp(0.0, 1.0)),
            reflectance: refl,
            alpha_per_cm: alpha,
            tier,
            source: format!("measured colour{}", c.phrase.as_ref().map_or(String::new(), |p| format!(" \"{}\"", p))),
            basis: "measured-colour",
        });
    }

    let gap = spec.record.and_then(|o| o.band_gap_eV.as_ref());
    let chromophores = inherited_bands(spec.ions);
    let ivct_pairs = mixed_valence_pairs(spec.ions);
    let explicit: &[crate::db::record::OpticsBand] = spec.record.map_or(&[], |o| o.solid_bands.as_slice());
    if gap.is_none() && chromophores.is_empty() && ivct_pairs <= 0.0 && explicit.is_empty() {
        return None;
    }
    let formula_units_per_l = spec.density_g_ml * 1000.0 / spec.mw.max(1.0);
    let s_coef = scattering_coefficient(spec.particle_um);
    let eg = gap.map_or(COLOURLESS_HOST_GAP_EV, |g| g.value);
    let mut alpha = [0.0; N_BINS];
    let mut refl = [0.0; N_BINS];
    for i in 0..N_BINS {
        let nm = bin_nm(i);
        let e_ev = HC_EV_NM / nm;
        let mut a = if eg > 0.05 { edge_alpha(e_ev, eg) } else { ALPHA_EDGE * (e_ev.max(0.0)).sqrt() * 3.0 };
        // inherited d-d chromophores: eps(lambda) of the band set at the cation concentration in the solid
        for (count, bands) in &chromophores {
            let mut eps = vec![0.0; N_BINS];
            super::solution::accumulate(&mut eps, bands, 1.0);
            a += 2.303 * eps[i] * count * formula_units_per_l;
        }
        for b in explicit {
            let mut eps = vec![0.0; N_BINS];
            super::solution::accumulate(&mut eps, std::slice::from_ref(b), 1.0);
            a += 2.303 * eps[i] * formula_units_per_l;
        }
        if ivct_pairs > 0.0 {
            // Gaussian in photon energy
            let x = (e_ev - IVCT_EV) / IVCT_FWHM_EV;
            a += 2.303 * IVCT_EPS * (-2.772588722239781 * x * x).exp() * ivct_pairs * formula_units_per_l;
        }
        alpha[i] = a;
        refl[i] = km_reflectance(2.0 * a / s_coef);
    }
    let rgb = spectrum_to_rgb(&refl).map(|v| v.clamp(0.0, 1.0));
    let (basis, tier, source) = if ivct_pairs > 0.0 {
        ("mixed-valence", ProvenanceTier::Speculative, "intervalence charge transfer of a mixed-valence solid (Robin-Day class II, 1.8 eV)".to_string())
    } else if let Some(g) = gap {
        ("band-edge", g.tier.clone(), format!("band edge at {:.2} eV ({})", g.value, g.source.split(',').next().unwrap_or("")))
    } else if !chromophores.is_empty() {
        ("ion-chromophore", ProvenanceTier::Estimated, "inherited d-d bands of the cations (ligand-field model, anion as ligand)".to_string())
    } else {
        ("band-edge", ProvenanceTier::Estimated, "solid-state absorption bands".to_string())
    };
    Some(SolidLook { rgb, reflectance: refl, alpha_per_cm: alpha, tier, source, basis })
}

/// Lorentz-Lorenz refractive index of a solid from its molar refraction (cm3/mol), density (g/mL) and molar mass.
pub fn refractive_index(molar_refraction_cm3_mol: f64, density_g_ml: f64, mw: f64) -> f64 {
    let phi = (molar_refraction_cm3_mol * density_g_ml / mw.max(1.0)).clamp(0.01, 0.92);
    ((1.0 + 2.0 * phi) / (1.0 - phi)).sqrt().clamp(1.2, 3.2)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::record::Datum;

    fn gap_record(eg: f64) -> Optics {
        Optics { band_gap_eV: Some(Datum::new(eg, "eV", ProvenanceTier::Estimated, "test")), ..Default::default() }
    }

    fn ion(id: &str, n: f64) -> (String, f64) {
        (id.to_string(), n)
    }

    fn hue_of(rgb: [f64; 3]) -> &'static str {
        let (r, g, b) = (rgb[0], rgb[1], rgb[2]);
        let mx = r.max(g).max(b);
        let mn = r.min(g).min(b);
        if mx < 0.12 {
            return "black";
        }
        if mx - mn < 0.1 * mx.max(0.2) {
            return if mx > 0.6 { "white" } else { "grey" };
        }
        if b >= r && b >= g {
            "blue"
        } else if g >= r && g >= b {
            if r > 0.6 * g && b < 0.5 * g { "yellow" } else { "green" }
        } else if g > 0.55 * r { if b < 0.4 * r { "orange-yellow" } else { "pink" } } else { "red" }
    }

    fn look_of(ions: &[(String, f64)], rho: f64, mw: f64, rec: Option<&Optics>) -> SolidLook {
        look(&SolidSpec { ions, density_g_ml: rho, mw, particle_um: 10.0, record: rec, measured_colour: None, is_metal: false }).unwrap()
    }

    #[test]
    fn band_gap_sets_the_colour_of_main_group_solids() {
        let agcl = look_of(&[ion("Ag+", 1.0), ion("Cl-", 1.0)], 5.56, 143.3, Some(&gap_record(3.25)));
        assert_eq!(hue_of(agcl.rgb), "white", "{:?}", agcl.rgb);
        let pbi2 = look_of(&[ion("Pb+2", 1.0), ion("I-", 2.0)], 6.16, 461.0, Some(&gap_record(2.5)));
        assert!(pbi2.rgb[0] > pbi2.rgb[2] * 3.0 && pbi2.rgb[1] > pbi2.rgb[2] * 2.0, "PbI2 should be yellow, got {:?}", pbi2.rgb);
        let pbs = look_of(&[ion("Pb+2", 1.0), ion("S-2", 1.0)], 7.6, 239.3, Some(&gap_record(0.41)));
        assert!(pbs.rgb.iter().all(|c| *c < 0.05), "PbS should be black, got {:?}", pbs.rgb);
        let hgi2 = look_of(&[ion("Hg+2", 1.0), ion("I-", 2.0)], 6.36, 454.4, Some(&gap_record(2.1)));
        assert!(hgi2.rgb[0] > hgi2.rgb[1] * 2.0 && hgi2.rgb[0] > hgi2.rgb[2] * 3.0, "HgI2 should be red, got {:?}", hgi2.rgb);
    }

    #[test]
    fn d_d_chromophores_colour_hydroxides() {
        let cu = look_of(&[ion("Cu+2", 1.0), ion("OH-", 2.0)], 3.37, 97.56, None);
        assert!(cu.rgb[2] > cu.rgb[0] * 1.5, "Cu(OH)2 should be blue, got {:?}", cu.rgb);
        assert_eq!(cu.basis, "ion-chromophore");
        let ni = look_of(&[ion("Ni+2", 1.0), ion("OH-", 2.0)], 4.1, 92.7, None);
        assert!(ni.rgb[1] > ni.rgb[0] && ni.rgb[1] > ni.rgb[2], "Ni(OH)2 should be green, got {:?}", ni.rgb);
        // anhydrous copper sulfate is nearly white-pale (the d-d band moves into the near infrared)
        let cuso4 = look_of(&[ion("Cu+2", 1.0), ion("SO4-2", 1.0)], 3.6, 159.6, None);
        let mx = cuso4.rgb.iter().cloned().fold(0.0, f64::max);
        let mn = cuso4.rgb.iter().cloned().fold(1.0, f64::min);
        assert!(mx > 0.6 && (mx - mn) < 0.35, "CuSO4 should be pale, got {:?}", cuso4.rgb);
    }

    #[test]
    fn mixed_valence_iron_cyanide_is_blue() {
        // Fe(III) cations with hexacyanoferrate(II): one metal in two oxidation states
        let pb = look_of(&[ion("Fe+3", 4.0), ion("Fe(CN)6-4", 3.0)], 1.8, 859.2, None);
        assert_eq!(pb.basis, "mixed-valence");
        assert!(pb.rgb[2] > pb.rgb[0] * 2.0 && pb.rgb[2] > pb.rgb[1], "Prussian blue should be blue, got {:?}", pb.rgb);
        // Fe(III) with hexacyanoferrate(III) is not mixed valence
        assert_eq!(mixed_valence_pairs(&[ion("Fe+3", 1.0), ion("Fe(CN)6-3", 1.0)]), 0.0);
    }

    #[test]
    fn measured_colour_wins_but_not_for_hydrates() {
        let blue = SolidColour { rgb_linear: [0.05, 0.2, 0.8], subject: "solid".into(), hydrate: None, confidence: 0.9, phrase: Some("blue".into()) };
        let spec = SolidSpec { ions: &[], density_g_ml: 1.5, mw: 100.0, particle_um: 20.0, record: None, measured_colour: Some(&blue), is_metal: false };
        let l = look(&spec).unwrap();
        assert_eq!(l.basis, "measured-colour");
        assert!(l.rgb[2] > 0.7);
        let hyd = SolidColour { hydrate: Some(true), ..blue.clone() };
        let spec = SolidSpec { measured_colour: Some(&hyd), ..spec };
        assert!(look(&spec).is_none(), "a hydrate colour says nothing about the anhydrous solid");
    }

    #[test]
    fn lorentz_lorenz_of_silver_chloride() {
        let n = refractive_index(4.30 + 9.0, 5.56, 143.3);
        assert!((n - 2.07).abs() < 0.12, "{n}");
    }
}

