//! NMR and mass spectra of a vessel's contents: builds the sample from a liquid layer (or, for a dry vessel, a few
//! milligrams of its solids) and hands it to the structure-based predictors in `analytical`.
//!
//! Sample preparation, as at the bench: NMR takes 150 uL of the layer into 450 uL of deuterated solvent (or ~30 mg of solid
//! in 600 uL); GC/MS and ESI take the layer as it is (ESI infuses it diluted by a constant factor).

use crate::analytical::ms::{self, MassSpectrum, MsSampleSpecies};
use crate::analytical::nmr::{self, NmrSpectrum, Nucleus, SampleSpecies, Solvent};
use crate::ions;
use crate::vessel::*;

/// Dilute-solution NMR sample volume taken from the vessel, mL, and the mass of solid dissolved when the vessel holds no liquid.
const SOLID_MG: f64 = 30.0;
const TUBE_ML: f64 = 0.6;

struct Layer {
    /// (species key, mol)
    items: Vec<(String, f64)>,
    /// Effective volume the amounts are spread over, L.
    volume_l: f64,
    aqueous: bool,
    from_solid: bool,
}

fn hill_counts(elements: &std::collections::HashMap<String, f64>) -> Vec<(String, u32)> {
    let mut v: Vec<(String, u32)> = elements.iter().map(|(e, n)| (e.clone(), n.round() as u32)).filter(|(_, n)| *n > 0).collect();
    v.sort_by(|a, b| a.0.cmp(&b.0));
    v
}

impl Vessel {
    fn sample_layer(&self, layer: usize) -> Option<Layer> {
        let views: Vec<_> = self.phase_views().into_iter().filter(|v| v.volume_ml > 0.001).collect();
        if let Some(v) = views.get(layer.min(views.len().saturating_sub(1))) {
            let aqueous = self.phase_is_aqueous(&v.species_mol);
            let mut items: Vec<(String, f64)> = v.species_mol.iter().filter(|(_, &n)| n > 0.0).map(|(k, &n)| (k.clone(), n)).collect();
            items.sort_by(|a, b| a.0.cmp(&b.0));
            return Some(Layer { items, volume_l: v.volume_ml / 1000.0, aqueous, from_solid: false });
        }
        // a dry vessel: dissolve a few milligrams of what the solids are
        let mut items: Vec<(String, f64)> = Vec::new();
        let mut total_g = 0.0;
        for (k, &n) in &self.solid_mol {
            if n <= 0.0 {
                continue;
            }
            let base = k.trim_end_matches("(s)").to_string();
            let m = ions::species_mass(&base).unwrap_or(100.0);
            total_g += n * m;
            items.push((base, n));
        }
        if items.is_empty() || total_g <= 0.0 {
            return None;
        }
        let take = (SOLID_MG / 1000.0 / total_g).min(1.0);
        for it in items.iter_mut() {
            it.1 *= take;
        }
        items.sort_by(|a, b| a.0.cmp(&b.0));
        Some(Layer { items, volume_l: TUBE_ML / 1000.0 / 0.25, aqueous: false, from_solid: true })
    }

    /// Normal boiling point and dHvap/R (K) of a species from its saturation-pressure model.
    fn gc_volatility(&self, key: &str) -> (Option<f64>, Option<f64>) {
        let Some(v) = self.volatile_for(key) else { return (None, None) };
        let p_atm = 101325.0;
        let (mut lo, mut hi) = (120.0f64, 900.0f64);
        if let Some(tc) = v.tc_k() {
            hi = hi.min(tc * 0.9999);
        }
        if v.psat_pa(hi) < p_atm || v.psat_pa(lo) > p_atm {
            return (None, None);
        }
        for _ in 0..60 {
            let mid = 0.5 * (lo + hi);
            if v.psat_pa(mid) < p_atm {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        let tb = 0.5 * (lo + hi);
        let (t1, t2) = (tb * 0.93, tb * 1.0);
        let (p1, p2) = (v.psat_pa(t1), v.psat_pa(t2));
        let b = if p1 > 0.0 && p2 > p1 { Some((p2 / p1).ln() / (1.0 / t1 - 1.0 / t2)) } else { None };
        (Some(tb), b)
    }

    fn structure_smiles(&self, key: &str) -> Option<String> {
        if let Some(s) = self.smiles_of(Some(key)) {
            return Some(s);
        }
        // bare proton and hydroxide have no store record but a fixed structure
        let el = ions::species_elements(key)?;
        let q = ions::species_charge(key);
        if q == 1 && el.len() == 1 && el.get("H").copied() == Some(1.0) {
            return Some("[H+]".to_string());
        }
        if q == -1 && el.len() == 2 && el.get("H").copied() == Some(1.0) && el.get("O").copied() == Some(1.0) {
            return Some("[OH-]".to_string());
        }
        None
    }

    fn species_formula(&self, key: &str) -> String {
        match ions::species_elements(key) {
            Some(e) => {
                let mut v: Vec<(String, u32)> = hill_counts(&e);
                let c = v.iter().position(|(e, _)| e == "C");
                if let Some(ci) = c {
                    let carbon = v.remove(ci);
                    v.insert(0, carbon);
                    if let Some(hi) = v.iter().position(|(e, _)| e == "H") {
                        let h = v.remove(hi);
                        v.insert(1, h);
                    }
                }
                v.iter().map(|(e, n)| if *n == 1 { e.clone() } else { format!("{}{}", e, n) }).collect()
            }
            None => key.to_string(),
        }
    }

    /// 1H or 13C NMR of a liquid layer in a deuterated solvent.
    pub fn nmr_spectrum(&self, layer: usize, nucleus: &str, solvent: &str, scans: u32, seed: u64) -> Result<NmrSpectrum, String> {
        let nuc = match nucleus {
            "1H" => Nucleus::H1,
            "13C" => Nucleus::C13,
            other => return Err(format!("unsupported nucleus {}", other)),
        };
        let solv = Solvent::parse(solvent).ok_or_else(|| format!("unknown solvent {}", solvent))?;
        let lay = self.sample_layer(layer).ok_or_else(|| "nothing to measure: the vessel holds no liquid or solid".to_string())?;
        let mut sample: Vec<SampleSpecies> = Vec::new();
        for (key, mol) in &lay.items {
            let conc = mol / lay.volume_l.max(1e-9); // mol/L
            let charge = ions::species_charge(key);
            sample.push(SampleSpecies {
                id: key.clone(),
                name: self.display_name(key),
                smiles: self.structure_smiles(key),
                formula: self.species_formula(key),
                charge,
                conc_mm: conc * 1000.0,
            });
        }
        let biphasic = lay.aqueous && !lay.from_solid && !solv.dissolves_water();
        Ok(nmr::simulate(&sample, nuc, solv, scans, seed, biphasic))
    }

    /// GC/EI-MS ("EI") or direct-infusion ESI ("ESI+" / "ESI-") of a liquid layer.
    pub fn ms_spectrum(&self, layer: usize, mode: &str, seed: u64) -> Result<MassSpectrum, String> {
        let lay = self.sample_layer(layer).ok_or_else(|| "nothing to inject: the vessel holds no liquid or solid".to_string())?;
        let mut sample: Vec<MsSampleSpecies> = Vec::new();
        for (key, mol) in &lay.items {
            let conc = mol / lay.volume_l.max(1e-9) * 1000.0;
            let charge = ions::species_charge(key);
            let (tb, b) = if mode == "EI" { self.gc_volatility(key) } else { (None, None) };
            let elements = ions::species_elements(key).map(|e| hill_counts(&e)).unwrap_or_default();
            sample.push(MsSampleSpecies {
                id: key.clone(),
                name: self.display_name(key),
                smiles: self.structure_smiles(key),
                formula: self.species_formula(key),
                charge,
                elements,
                conc_mm: conc,
                tb_k: tb,
                b_k: b,
            });
        }
        match mode {
            "EI" => Ok(ms::simulate_ei(&sample, seed)),
            "ESI+" | "ESI_POS" => Ok(ms::simulate_esi(&sample, ms::EsiPolarity::Positive)),
            "ESI-" | "ESI_NEG" => Ok(ms::simulate_esi(&sample, ms::EsiPolarity::Negative)),
            other => Err(format!("unknown ionisation mode {}", other)),
        }
    }
}
