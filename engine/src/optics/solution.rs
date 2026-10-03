//! Absorption of a liquid phase: the sum over its species of `c_i eps_i(lambda)`, where `eps_i` is the species' own band set
//! *in the phase's solvent*.
//!
//! Where a species' bands come from, in this order: bands the vessel holds for an imported compound (PubChem UV text), the
//! species store's optical record, the seed row, the ligand-field estimate for a first-row d-ion complex (Estimated). A
//! species with none of these is optically empty. Solvent dependence (iodine violet in alkanes, brown in water) is the
//! `solvent` of a band: the exact solvent class wins, then a band valid in any solvent, then another solvent's bands (and the
//! colour is then labelled as not solvent-matched).

use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

use super::cie::{bin_nm, N_BINS};
use super::ligand_field;
use crate::db::record::OpticsBand;
use crate::types::ProvenanceTier;

/// Solvent class of a liquid phase: "water", "alcohol", "aromatic", "alkane" (hydrocarbons without aromatic rings), "other".
pub fn solvent_class(is_water_phase: bool, smiles: Option<&str>) -> &'static str {
    if is_water_phase {
        return "water";
    }
    let Some(m) = smiles.and_then(crate::smiles::parse) else { return "other" };
    if m.atoms.is_empty() {
        return "other";
    }
    if m.atoms.iter().any(|a| a.aromatic) {
        return "aromatic";
    }
    if m.atoms.iter().all(|a| a.element == "C" || a.element == "H") {
        return "alkane";
    }
    // an alcohol: a hydroxyl on a carbon
    for (i, a) in m.atoms.iter().enumerate() {
        if a.element == "O" && m.hydrogens(i) >= 1 && m.neighbours(i).iter().any(|(j, _)| m.atoms[*j].element == "C") {
            return "alcohol";
        }
    }
    "other"
}

/// Pope & Fry (1997) absorption coefficients of pure water, decadic per cm, on the 380..780 nm grid (step 10 nm).
/// Extended above 720 nm from Hale & Querry (1973).
pub const POPE_FRY_WATER_A_PER_CM: [f64; N_BINS] = [
    4.91e-5, 3.65e-5, 2.88e-5, 2.05e-5, 1.97e-5, 2.15e-5, 2.76e-5, 4.00e-5, 4.25e-5, 4.60e-5,
    5.52e-5, 6.51e-5, 8.86e-5, 1.41e-4, 1.72e-4, 1.87e-4, 2.06e-4, 2.45e-4, 2.59e-4, 3.02e-4,
    3.89e-4, 5.87e-4, 9.66e-4, 1.15e-3, 1.20e-3, 1.27e-3, 1.35e-3, 1.48e-3, 1.78e-3, 1.91e-3,
    2.02e-3, 2.24e-3, 2.71e-3, 3.60e-3, 5.08e-3, 7.77e-3, 1.03e-2, 1.07e-2, 1.11e-2, 1.09e-2,
    1.02e-2,
];

/// Baseline absorption spectrum of pure solvents by solvent class (decadic per cm).
pub fn solvent_baseline_absorbance(solvent_class: &str) -> [f64; N_BINS] {
    match solvent_class {
        "water" => POPE_FRY_WATER_A_PER_CM,
        "alcohol" => {
            let mut a = [1e-5; N_BINS];
            a[34] = 5e-4; // 720 nm
            a[35] = 1.2e-3; // 730 nm
            a[36] = 2.0e-3; // 740 nm
            a[37] = 1.5e-3; // 750 nm
            a
        }
        "alkane" | "aromatic" => {
            let mut a = [5e-6; N_BINS];
            a[35] = 1e-4;
            a[36] = 3e-4;
            a[37] = 2e-4;
            a
        }
        _ => [1e-5; N_BINS],
    }
}

/// The bands that apply to a species in a solvent, with the provenance of the data.
#[derive(Clone, Debug)]
pub struct Resolved {
    pub bands: Vec<OpticsBand>,
    pub tier: ProvenanceTier,
    pub source: String,
    /// False when no band was recorded for this solvent and another solvent's bands were used.
    pub solvent_matched: bool,
}

/// Width (nm) of a band whose record gives none: charge-transfer and pi-pi* bands of dyes are 60-100 nm wide, d-d bands are
/// set by the ligand-field model, so this is only the default for imported (PubChem) bands.
pub fn default_fwhm_nm(kind: Option<&str>, eps: f64) -> f64 {
    match kind {
        Some("d-d") => 100.0,
        Some("n-pi*") => 60.0,
        _ if eps >= 1e4 => 65.0,
        _ if eps >= 1e3 => 80.0,
        _ => 100.0,
    }
}

fn pick(bands: &[OpticsBand], solvent: &str) -> (Vec<OpticsBand>, bool) {
    let exact: Vec<OpticsBand> = bands.iter().filter(|b| b.solvent.as_deref() == Some(solvent)).cloned().collect();
    if !exact.is_empty() {
        return (exact, true);
    }
    let any: Vec<OpticsBand> = bands.iter().filter(|b| b.solvent.is_none()).cloned().collect();
    if !any.is_empty() {
        return (any, true);
    }
    // another solvent's bands: water first, otherwise the first solvent that has any
    let water: Vec<OpticsBand> = bands.iter().filter(|b| b.solvent.as_deref() == Some("water")).cloned().collect();
    if !water.is_empty() {
        return (water, false);
    }
    let first = bands.first().and_then(|b| b.solvent.clone());
    (bands.iter().filter(|b| b.solvent == first).cloned().collect(), false)
}

type Cache = Mutex<(u64, HashMap<(String, String), Option<Arc<Resolved>>>)>;

fn cache() -> &'static Cache {
    static C: OnceLock<Cache> = OnceLock::new();
    C.get_or_init(|| Mutex::new((0, HashMap::new())))
}

/// Bands of `id` in `solvent` from the records and the models (no vessel-held import bands).
pub fn resolve(id: &str, solvent: &str) -> Option<Arc<Resolved>> {
    let generation = crate::db::SpeciesStore::generation();
    {
        let mut c = cache().lock().ok()?;
        if c.0 != generation {
            c.0 = generation;
            c.1.clear();
        }
        if let Some(v) = c.1.get(&(id.to_string(), solvent.to_string())) {
            return v.clone();
        }
    }
    let resolved = resolve_uncached(id, solvent).map(Arc::new);
    if let Ok(mut c) = cache().lock() {
        c.1.insert((id.to_string(), solvent.to_string()), resolved.clone());
    }
    resolved
}

fn resolve_uncached(id: &str, solvent: &str) -> Option<Resolved> {
    if let Some(o) = super::records::lookup(id) {
        if !o.bands.is_empty() {
            let (bands, matched) = pick(&o.bands, solvent);
            return Some(Resolved {
                bands,
                tier: o.tier.clone().unwrap_or(ProvenanceTier::Estimated),
                source: o.source.clone().unwrap_or_default(),
                solvent_matched: matched,
            });
        }
    }
    // d-d bands of a first-row transition-metal complex in water
    if let Some(est) = ligand_field::estimate_species(id) {
        let mut bands = est.bands;
        for b in bands.iter_mut() {
            b.solvent = Some("water".to_string());
        }
        return Some(Resolved {
            bands,
            tier: ProvenanceTier::Estimated,
            source: "ligand-field model (Tanabe-Sugano, Jorgensen f*g, nephelauxetic beta)".to_string(),
            solvent_matched: solvent == "water",
        });
    }
    None
}

/// Bands for a species held by a vessel as an import (`extra`, UV bands of the compound) or from the records.
pub fn resolve_with(id: &str, solvent: &str, extra: &[OpticsBand]) -> Option<Arc<Resolved>> {
    if extra.is_empty() {
        return resolve(id, solvent);
    }
    let (bands, matched) = pick(extra, solvent);
    Some(Arc::new(Resolved { bands, tier: ProvenanceTier::Imported, source: "PubChem UV/Vis text".to_string(), solvent_matched: matched }))
}

/// Adds `conc_m * eps(lambda)` of the bands to the absorbance spectrum `a` (decadic, per cm).
pub fn accumulate(a: &mut [f64], bands: &[OpticsBand], conc_m: f64) {
    const LN2_TIMES_4: f64 = 2.772588722239781;
    for b in bands {
        let fwhm = b.fwhm.unwrap_or_else(|| default_fwhm_nm(b.kind.as_deref(), b.eps)).max(1.0);
        for (i, v) in a.iter_mut().enumerate().take(N_BINS) {
            let x = (bin_nm(i) - b.nm) / fwhm;
            let e = -LN2_TIMES_4 * x * x;
            if e > -20.0 {
                *v += conc_m * b.eps * e.exp();
            }
        }
    }
}

/// Decadic absorbance per cm at an arbitrary wavelength `nm` of the bands at concentration `conc_m`.
pub fn absorbance_at(bands: &[OpticsBand], conc_m: f64, nm: f64) -> f64 {
    const LN2_TIMES_4: f64 = 2.772588722239781;
    let mut a = 0.0;
    for b in bands {
        let fwhm = b.fwhm.unwrap_or_else(|| default_fwhm_nm(b.kind.as_deref(), b.eps)).max(1.0);
        let x = (nm - b.nm) / fwhm;
        let e = -LN2_TIMES_4 * x * x;
        if e > -20.0 {
            a += conc_m * b.eps * e.exp();
        }
    }
    a
}

/// Peak decadic absorbance per cm over the grid.
pub fn peak(a: &[f64]) -> (f64, f64) {
    let mut best = (0.0, super::cie::BIN_NM0);
    for (i, v) in a.iter().enumerate() {
        if *v > best.0 {
            best = (*v, bin_nm(i));
        }
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn solvent_classes() {
        assert_eq!(solvent_class(true, None), "water");
        assert_eq!(solvent_class(false, Some("CCCCCC")), "alkane");
        assert_eq!(solvent_class(false, Some("c1ccccc1")), "aromatic");
        assert_eq!(solvent_class(false, Some("CCO")), "alcohol");
        assert_eq!(solvent_class(false, Some("CC(=O)C")), "other");
    }

    #[test]
    fn iodine_bands_follow_the_solvent() {
        let w = resolve("I2(aq)", "water").unwrap();
        let h = resolve("I2(aq)", "alkane").unwrap();
        assert!(w.solvent_matched && h.solvent_matched);
        assert!((w.bands[0].nm - 460.0).abs() < 10.0 && (h.bands[0].nm - 520.0).abs() < 10.0);
        // an unknown solvent falls back to water's bands and says so
        let o = resolve("I2(aq)", "other").unwrap();
        assert!(!o.solvent_matched);
    }

    #[test]
    fn ligand_field_fills_in_for_ions_without_data() {
        let r = resolve("Ni+2", "water").unwrap();
        assert_eq!(r.tier, ProvenanceTier::Estimated);
        let mut a = [0.0; N_BINS];
        accumulate(&mut a, &r.bands, 0.1);
        assert!(peak(&a).0 > 0.01);
        assert!(resolve("Na+", "water").is_none());
    }
}
