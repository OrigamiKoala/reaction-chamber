//! UV-vis spectrum of a liquid layer as an instrument sees it: the same optical records and models that colour the liquid
//! in the 3D scene, evaluated at the wavelengths a spectrophotometer scans (any step, including the near UV below the 380 nm
//! edge of the colour grid), with the contribution of every species and of the turbidity of suspended solids reported
//! separately. The instrument (cell baseline, detector saturation, blank) stays in the web layer.

use serde::Serialize;

use crate::optics::{self, cie::BIN_NM0, cie::BIN_STEP_NM, N_BINS};
use crate::types::ProvenanceTier;
use crate::vessel::*;

#[derive(Clone, Debug, Serialize)]
pub struct UvPoint {
    pub nm: f64,
    /// Decadic absorbance of the dissolved species over the path (Beer-Lambert).
    pub a_species: f64,
    /// Apparent absorbance from the extinction (scattering + absorption) of suspended solids.
    pub a_turbidity: f64,
}

#[derive(Clone, Debug, Serialize)]
pub struct UvContributor {
    pub species: String,
    pub name: String,
    /// Wavelength (nm) and decadic absorbance per cm of the strongest point of this species in the scanned range.
    pub peak_nm: f64,
    pub peak_a_per_cm: f64,
    /// Decadic absorbance per cm of this species at every scanned point (aligned with `UvVisScan::points`).
    pub a_per_cm: Vec<f64>,
    pub tier: ProvenanceTier,
    pub source: String,
    pub solvent_matched: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct UvVisScan {
    pub layer: usize,
    pub solvent_class: String,
    pub path_cm: f64,
    pub points: Vec<UvPoint>,
    /// Species with measurable absorbance, strongest first.
    pub contributors: Vec<UvContributor>,
}

impl Vessel {
    /// Scans liquid layer `layer` (0 = the first liquid phase, the water-containing one when there is one) from `nm_min` to
    /// `nm_max` in `step_nm` over a cell of `path_cm`.
    pub fn uvvis_scan(&self, layer: usize, nm_min: f64, nm_max: f64, step_nm: f64, path_cm: f64) -> UvVisScan {
        let views: Vec<_> = self.phase_views().into_iter().filter(|v| v.volume_ml > 0.001).collect();
        let step = step_nm.max(0.5);
        let n_pts = (((nm_max - nm_min) / step).floor() as usize + 1).min(2000);
        let mut points: Vec<UvPoint> = (0..n_pts).map(|i| UvPoint { nm: nm_min + i as f64 * step, a_species: 0.0, a_turbidity: 0.0 }).collect();
        let Some(v) = views.get(layer.min(views.len().saturating_sub(1))) else {
            return UvVisScan { layer, solvent_class: String::new(), path_cm, points, contributors: Vec::new() };
        };
        let aqueous = self.phase_is_aqueous(&v.species_mol);
        let lead = if aqueous {
            None
        } else {
            v.species_mol.iter().filter(|(k, _)| crate::ions::species_charge(k) == 0).max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal).then(b.0.cmp(a.0))).map(|(k, _)| k.clone())
        };
        let solvent = optics::solution::solvent_class(aqueous, self.smiles_of(lead.as_deref()).as_deref());
        let vol_l = v.volume_ml / 1000.0;
        let mut contributors: Vec<UvContributor> = Vec::new();
        let mut keys: Vec<&String> = v.species_mol.keys().collect();
        keys.sort();
        for sp in keys {
            let conc = v.species_mol[sp] / vol_l.max(1e-9);
            if conc <= 1e-12 {
                continue;
            }
            let extra: &[crate::db::record::OpticsBand] = self.compound_for(sp).map_or(&[], |c| c.uv_bands.as_slice());
            let Some(r) = optics::solution::resolve_with(sp, solvent, extra) else { continue };
            let (mut peak_a, mut peak_nm) = (0.0, nm_min);
            let mut per_cm = Vec::with_capacity(points.len());
            for p in points.iter_mut() {
                let a = optics::solution::absorbance_at(&r.bands, conc, p.nm);
                per_cm.push(a);
                p.a_species += a * path_cm;
                if a > peak_a {
                    peak_a = a;
                    peak_nm = p.nm;
                }
            }
            if peak_a > 1e-4 {
                contributors.push(UvContributor { species: sp.clone(), name: self.display_name(sp), peak_nm, peak_a_per_cm: peak_a, a_per_cm: per_cm, tier: r.tier.clone(), source: r.source.clone(), solvent_matched: r.solvent_matched });
            }
        }
        contributors.sort_by(|a, b| b.peak_a_per_cm.partial_cmp(&a.peak_a_per_cm).unwrap_or(std::cmp::Ordering::Equal));
        // turbidity of the suspended solids (first layer): extinction per bin, interpolated to the scanned wavelengths
        if layer == 0 {
            let n_layer = crate::props::lorentz_lorenz_refractive_index(&v.species_mol, v.volume_ml);
            let (ext, _) = self.suspension_optics(n_layer);
            for p in points.iter_mut() {
                let u = ((p.nm - BIN_NM0) / BIN_STEP_NM).clamp(0.0, (N_BINS - 1) as f64);
                let i = (u.floor() as usize).min(N_BINS - 2);
                let f = u - i as f64;
                let e = ext[i] * (1.0 - f) + ext[i + 1] * f;
                p.a_turbidity = e * path_cm / std::f64::consts::LN_10;
            }
        }
        UvVisScan { layer, solvent_class: solvent.to_string(), path_cm, points, contributors }
    }

    /// SMILES of a species from the vessel's imports or the species store.
    pub(crate) fn smiles_of(&self, key: Option<&str>) -> Option<String> {
        let k = key?;
        self.compound_for(k)
            .and_then(|c| c.smiles.clone())
            .or_else(|| crate::db::SpeciesStore::global().read().ok().and_then(|st| st.get(k).and_then(|r| r.identity.smiles.clone())))
    }
}
