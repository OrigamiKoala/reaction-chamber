//! Quadrupole GC/MS and ESI-MS of an arbitrary sample.
//!
//! EI (GC/MS): every volatile species of the injected liquid is separated on the column (`gc`), its 70 eV spectrum predicted
//! from the structure (`ms_ei`), and the chromatogram built from the amounts and ionisation cross-sections. ESI: each species
//! ionises by protonation / deprotonation / cationisation with a response set by its basic or acidic sites; pre-formed ions
//! (Na+, Cl-, ...) pass straight through; spectra carry exact isotope patterns.

use serde::Serialize;

use super::graph::Mol;
use super::isotopes;
use super::ms_ei;
use super::gc;

#[derive(Clone, Debug)]
pub struct MsSampleSpecies {
    pub id: String,
    pub name: String,
    pub smiles: Option<String>,
    pub formula: String,
    pub charge: i32,
    /// Element counts of the species (from its id) for ions without a structure.
    pub elements: Vec<(String, u32)>,
    /// Concentration in the vessel liquid, mmol/L.
    pub conc_mm: f64,
    /// Normal boiling point and dHvap/R (K) from the saturation-pressure model, when known.
    pub tb_k: Option<f64>,
    pub b_k: Option<f64>,
}

#[derive(Clone, Debug, Serialize)]
pub struct MsPeak {
    pub mz: f64,
    pub intensity: f64,
    pub assignment: String,
    pub molecular: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct MsComponent {
    pub id: String,
    pub name: String,
    pub formula: String,
    pub mw: f64,
    pub rt_min: Option<f64>,
    /// Share of the total ion current, %.
    pub share_pct: f64,
    pub peaks: Vec<MsPeak>,
    pub base_mz: f64,
    pub notes: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct MassSpectrum {
    pub mode: String,
    pub components: Vec<MsComponent>,
    /// Sum of all component spectra (EI: weighted by area; ESI: the spectrum itself).
    pub summed: Vec<MsPeak>,
    pub chrom_t0: f64,
    pub chrom_dt: f64,
    pub tic: Vec<f32>,
    pub oven: Vec<f32>,
    pub not_analysed: Vec<String>,
    pub notes: Vec<String>,
    pub tier: String,
    pub method: String,
}

// Additive electron-impact ionisation cross-section contributions (A^2 at 70 eV), after the Fitch-Sauter atomic scheme.
fn sigma_atom(el: &str) -> f64 {
    match el {
        "H" => 0.4,
        "C" => 1.6,
        "N" => 1.8,
        "O" => 1.5,
        "F" => 1.0,
        "Si" => 4.5,
        "P" => 4.5,
        "S" => 4.5,
        "Cl" => 4.5,
        "Br" => 6.0,
        "I" => 8.0,
        _ => 5.0,
    }
}

fn response_of(g: &Mol) -> f64 {
    g.atoms.iter().map(|a| sigma_atom(&a.el) + a.h as f64 * sigma_atom("H")).sum::<f64>().max(0.5)
}

fn estimate_tb(mass: f64, g: &Mol) -> f64 {
    let polar = g.atoms.iter().filter(|a| matches!(a.el.as_str(), "O" | "N") && a.h > 0).count() as f64;
    22.5 * mass.powf(0.6) + 18.0 * polar
}

fn nominal(x: f64) -> f64 {
    x
}

fn merge_peaks(parts: Vec<(f64, f64, String, bool)>, floor_pct: f64) -> Vec<MsPeak> {
    // parts: (mz, abundance, label, molecular)
    let mut by: std::collections::BTreeMap<i64, (f64, f64, String, bool)> = std::collections::BTreeMap::new();
    for (mz, a, label, mol) in parts {
        let key = (nominal(mz) * 2.0).round() as i64;
        let e = by.entry(key).or_insert((mz, 0.0, String::new(), false));
        if a > e.1 {
            e.2 = label.clone();
        }
        e.1 += a;
        if e.2.is_empty() {
            e.2 = label;
        }
        e.3 |= mol;
        e.0 = mz;
    }
    let top = by.values().map(|v| v.1).fold(0.0, f64::max).max(1e-300);
    by.into_values()
        .map(|(mz, a, label, mol)| MsPeak { mz, intensity: a / top * 100.0, assignment: label, molecular: mol })
        .filter(|p| p.intensity >= floor_pct)
        .collect()
}

// -------------------------------------------------------------------------------------------------------- EI / GC

pub fn simulate_ei(sample: &[MsSampleSpecies], seed: u64) -> MassSpectrum {
    let _ = seed;
    let mut comps: Vec<(MsComponent, f64)> = Vec::new();
    let mut not_analysed: Vec<String> = Vec::new();
    let mut notes: Vec<String> = Vec::new();
    for sp in sample {
        if sp.conc_mm <= 1e-9 {
            continue;
        }
        let Some(smi) = &sp.smiles else {
            not_analysed.push(format!("{} ({}): no structure data", sp.name, sp.formula));
            continue;
        };
        let Some(parts) = Mol::components_from_smiles(smi) else {
            not_analysed.push(format!("{}: SMILES not readable", sp.name));
            continue;
        };
        if sp.charge != 0 || parts.len() != 1 || parts[0].charge() != 0 || parts[0].atoms.iter().any(|a| a.charge != 0 && !a.arom) && !is_zwitterion_ok(&parts[0]) {
            not_analysed.push(format!("{}: ionic / salt, not volatile, stays in the injector liner", sp.name));
            continue;
        }
        let g = &parts[0];
        let Some(mass) = g.mono_mass() else {
            not_analysed.push(format!("{}: element without isotope data", sp.name));
            continue;
        };
        let tb = sp.tb_k.unwrap_or_else(|| estimate_tb(mass, g));
        let Some(rt) = gc::retention_time(tb, sp.b_k) else {
            not_analysed.push(format!("{}: boils at {:.0} °C, does not elute within the {:.0} °C programme", sp.name, tb - 273.15, gc::T_END_C));
            continue;
        };
        let spectrum = if g.n() == 1 && g.atoms[0].h == 0 {
            atom_spectrum(g)
        } else {
            ms_ei::ei_spectrum_with(g, &ms_ei::EiParams::default())
        };
        let Some((peaks, _ie)) = spectrum else {
            not_analysed.push(format!("{}: structure too large or unsupported for fragmentation", sp.name));
            continue;
        };
        let area = sp.conc_mm * response_of(g);
        let mw = mass;
        let mpeaks: Vec<MsPeak> = peaks.iter().map(|p| MsPeak { mz: p.mz as f64, intensity: p.intensity, assignment: p.label.clone(), molecular: p.molecular }).collect();
        let base = mpeaks.iter().max_by(|a, b| a.intensity.partial_cmp(&b.intensity).unwrap()).map(|p| p.mz).unwrap_or(0.0);
        let mut cn = Vec::new();
        if sp.tb_k.is_none() {
            cn.push("boiling point estimated from the molar mass (no vapour-pressure data)".to_string());
        }
        comps.push((
            MsComponent { id: sp.id.clone(), name: sp.name.clone(), formula: g.formula(), mw, rt_min: Some(rt), share_pct: 0.0, peaks: mpeaks, base_mz: base, notes: cn },
            area,
        ));
    }
    comps.sort_by(|a, b| a.0.rt_min.partial_cmp(&b.0.rt_min).unwrap());
    let total: f64 = comps.iter().map(|c| c.1).sum::<f64>().max(1e-300);
    for c in comps.iter_mut() {
        c.0.share_pct = c.1 / total * 100.0;
    }
    // chromatogram
    let n = 1200usize;
    let dt = gc::RUN_MIN / (n as f64 - 1.0);
    let mut tic = vec![0.0f64; n];
    for (c, area) in &comps {
        let t0 = c.rt_min.unwrap_or(0.0);
        let sigma = 0.035 + 0.004 * t0;
        for (i, v) in tic.iter_mut().enumerate() {
            let t = i as f64 * dt;
            let x = (t - t0) / sigma;
            if x.abs() < 8.0 {
                *v += area / total * (-0.5 * x * x).exp();
            }
        }
    }
    let oven: Vec<f32> = (0..n).map(|i| gc::oven_c(i as f64 * dt) as f32).collect();
    // sum spectrum
    let mut parts: Vec<(f64, f64, String, bool)> = Vec::new();
    for (c, area) in &comps {
        let top = c.peaks.iter().map(|p| p.intensity).fold(0.0, f64::max).max(1e-9);
        let sum: f64 = c.peaks.iter().map(|p| p.intensity / top).sum::<f64>().max(1e-9);
        for p in &c.peaks {
            parts.push((p.mz, area * (p.intensity / top) / sum, format!("{}: {}", c.name, p.assignment), p.molecular));
        }
    }
    if comps.is_empty() {
        notes.push("Nothing in the sample is volatile and structure-known: the chromatogram is empty.".into());
    }
    MassSpectrum {
        mode: "EI".into(),
        components: comps.into_iter().map(|c| c.0).collect(),
        summed: merge_peaks(parts, 0.5),
        chrom_t0: 0.0,
        chrom_dt: dt,
        tic: tic.iter().map(|v| *v as f32).collect(),
        oven,
        not_analysed,
        notes,
        tier: "Estimated".into(),
        method: "GC: retention from vapour pressure under a 40-300 °C programme; EI: quasi-equilibrium (RRKM-style) fragmentation of the structure graph with group-additive ion energetics; exact isotope patterns".into(),
    }
}

fn is_zwitterion_ok(g: &Mol) -> bool {
    // nitro groups and N-oxides carry formal charges but are neutral molecules
    g.charge() == 0
}

fn atom_spectrum(g: &Mol) -> Option<(Vec<ms_ei::EiPeak>, f64)> {
    let el = &g.atoms[0].el;
    let dist = isotopes::distribution(&[(el.clone(), 1)], 1e-4)?;
    let top = dist.iter().map(|l| l.p).fold(0.0, f64::max);
    let mut peaks: Vec<ms_ei::EiPeak> = dist.iter().map(|l| ms_ei::EiPeak { mz: l.nominal, intensity: l.p / top * 100.0, label: format!("{}+•", el), molecular: true }).collect();
    // doubly charged ion at half the mass (noble gases give ~10 %)
    for l in &dist {
        if l.p / top > 0.5 {
            peaks.push(ms_ei::EiPeak { mz: l.nominal / 2, intensity: 10.0 * l.p / top, label: format!("{}2+", el), molecular: false });
        }
    }
    peaks.sort_by_key(|p| p.mz);
    Some((peaks, 15.0))
}

// -------------------------------------------------------------------------------------------------------- ESI

#[derive(Clone, Copy, PartialEq)]
pub enum EsiPolarity {
    Positive,
    Negative,
}

fn basic_site_factor(g: &Mol) -> f64 {
    // proton affinity / solution basicity class of the best site
    let mut best = 0.0f64;
    for i in 0..g.n() {
        let a = &g.atoms[i];
        let co = |k: usize| g.atoms[k].el == "C" && g.double_to(k, "O", None);
        let f = match a.el.as_str() {
            "N" if a.charge == 0 => {
                let amide = g.nbrs(i).any(co);
                let aryl = g.nbrs(i).any(|k| g.atoms[k].arom);
                let nitro = g.nbrs(i).any(|k| g.atoms[k].el == "O");
                if nitro || g.triple_bonded(i).is_some() {
                    0.0
                } else if a.arom {
                    if a.h == 0 { 0.5 } else { 0.05 }
                } else if amide {
                    0.08
                } else if aryl {
                    0.25
                } else if g.has_double(i) {
                    0.6 // imine / amidine
                } else {
                    1.0
                }
            }
            "N" if a.charge > 0 && !g.nbrs(i).any(|k| g.atoms[k].el == "O") => 1.2, // quaternary / ammonium: pre-formed cation
            "O" if a.charge == 0 && !a.arom => {
                if g.has_double(i) {
                    0.03
                } else if g.heavy_degree(i) == 2 {
                    0.01
                } else {
                    0.008
                }
            }
            "S" if a.charge == 0 && !a.arom && !g.has_double(i) => 0.01,
            "P" => 0.05,
            _ => 0.0,
        };
        best = best.max(f);
    }
    best
}

fn acid_site_factor(g: &Mol) -> f64 {
    let mut best = 0.0f64;
    for i in 0..g.n() {
        let a = &g.atoms[i];
        let f = match a.el.as_str() {
            "O" if a.h > 0 && g.heavy_degree(i) == 1 => {
                let c = g.nbrs(i).next().unwrap();
                match g.atoms[c].el.as_str() {
                    "C" if g.double_to(c, "O", None) => 1.0, // carboxylic acid
                    "C" if g.atoms[c].arom => {
                        let ewg = g.nbrs(c).any(|_| true) && g.atoms.iter().any(|b| b.el == "N" && b.charge > 0 || matches!(b.el.as_str(), "Cl" | "Br" | "F"));
                        if ewg { 0.8 } else { 0.25 }
                    }
                    "S" | "P" => 2.0,
                    "C" => 0.01,
                    _ => 0.1,
                }
            }
            "O" if a.charge < 0 => 1.5,
            "N" if a.h > 0 && g.nbrs(i).any(|k| g.atoms[k].el == "S" && g.double_to(k, "O", None)) => 0.3,
            "S" if a.h > 0 => 0.15,
            _ => 0.0,
        };
        best = best.max(f);
    }
    best
}

struct IonDraft {
    counts: Vec<(String, u32)>,
    z: i32,
    weight: f64,
    label: String,
    molecular: bool,
}

fn counts_add(counts: &[(String, u32)], el: &str, n: i32) -> Vec<(String, u32)> {
    let mut v: Vec<(String, u32)> = counts.to_vec();
    if let Some(e) = v.iter_mut().find(|(e, _)| e == el) {
        let k = e.1 as i32 + n;
        e.1 = k.max(0) as u32;
    } else if n > 0 {
        v.push((el.to_string(), n as u32));
    }
    v.retain(|(_, k)| *k > 0);
    v
}

pub fn simulate_esi(sample: &[MsSampleSpecies], polarity: EsiPolarity) -> MassSpectrum {
    let pos = polarity == EsiPolarity::Positive;
    let conc_of = |el: &str, z: i32| -> f64 {
        sample
            .iter()
            .filter(|s| s.charge == z && s.elements.len() == 1 && s.elements[0].0 == el && s.elements[0].1 == 1)
            .map(|s| s.conc_mm)
            .sum::<f64>()
    };
    let na = conc_of("Na", 1) + 0.01;
    let k_ = conc_of("K", 1) + 0.003;
    let cl = conc_of("Cl", -1);
    let mut per_species: Vec<(usize, Vec<IonDraft>)> = Vec::new();
    let mut not_analysed: Vec<String> = Vec::new();
    for (si, sp) in sample.iter().enumerate() {
        if sp.conc_mm <= 1e-9 {
            continue;
        }
        let mut ions: Vec<IonDraft> = Vec::new();
        let mol = sp.smiles.as_ref().and_then(|s| Mol::components_from_smiles(s));
        let counts: Vec<(String, u32)> = match &mol {
            Some(c) if c.len() == 1 => c[0].element_counts(),
            _ => sp.elements.clone(),
        };
        if counts.is_empty() {
            not_analysed.push(format!("{}: no composition", sp.name));
            continue;
        }
        let mono: Option<f64> = counts.iter().map(|(e, n)| isotopes::mono_mass(e).map(|m| m * *n as f64)).sum::<Option<f64>>();
        let Some(_) = mono else {
            not_analysed.push(format!("{}: element without isotope data", sp.name));
            continue;
        };
        let c = sp.conc_mm;
        let z = sp.charge;
        if z != 0 {
            // a pre-formed ion of the right polarity passes straight through
            if (z > 0) == pos {
                ions.push(IonDraft { counts: counts.clone(), z: z.abs(), weight: c, label: format!("{}{}", sp.formula.trim_end_matches(|ch: char| ch == '+' || ch == '-' || ch.is_ascii_digit()), if z > 0 { format!("{}+", if z > 1 { z.to_string() } else { String::new() }) } else { format!("{}-", if z < -1 { (-z).to_string() } else { String::new() }) }), molecular: true });
            }
        } else if let Some(parts) = &mol {
            let g = &parts[0];
            if parts.len() > 1 {
                not_analysed.push(format!("{}: salt, its ions are listed separately", sp.name));
                continue;
            }
            let n_c = g.atoms.iter().filter(|a| a.el == "C").count() as f64;
            let surf = 1.0 + 0.06 * n_c;
            let n_don = g.atoms.iter().filter(|a| matches!(a.el.as_str(), "O" | "N")).count().min(5) as f64;
            let has_oh = g.atoms.iter().enumerate().any(|(i, a)| a.el == "O" && a.h == 1 && g.heavy_degree(i) == 1 && g.nbrs(i).any(|k| g.atoms[k].el == "C" && g.is_sp3(k)));
            if pos {
                let rf = basic_site_factor(g) * surf;
                if rf > 0.0 {
                    ions.push(IonDraft { counts: counts_add(&counts, "H", 1), z: 1, weight: c * rf, label: "[M+H]+".into(), molecular: true });
                    if has_oh {
                        // tertiary / benzylic / secondary alcohols lose water in the source
                        ions.push(IonDraft { counts: counts_add(&counts_add(&counts, "H", -1), "O", -1), z: 1, weight: c * rf * 0.6, label: "[M+H-H2O]+".into(), molecular: false });
                    }
                }
                if n_don >= 1.0 {
                    let rna = 0.04 * n_don * surf;
                    ions.push(IonDraft { counts: counts_add(&counts, "Na", 1), z: 1, weight: c * rna * na / (na + 0.3), label: "[M+Na]+".into(), molecular: true });
                    ions.push(IonDraft { counts: counts_add(&counts, "K", 1), z: 1, weight: c * rna * 0.6 * k_ / (k_ + 0.3), label: "[M+K]+".into(), molecular: true });
                }
                // proton-bound dimer of an easily protonated compound at high concentration
                if rf > 0.2 && c > 20.0 {
                    ions.push(IonDraft { counts: counts_add(&counts.iter().map(|(e, n)| (e.clone(), n * 2)).collect::<Vec<_>>(), "H", 1), z: 1, weight: c * rf * (c / 800.0).min(0.5), label: "[2M+H]+".into(), molecular: false });
                }
            } else {
                let rf = acid_site_factor(g) * surf;
                if rf > 0.0 {
                    ions.push(IonDraft { counts: counts_add(&counts, "H", -1), z: 1, weight: c * rf, label: "[M-H]-".into(), molecular: true });
                    if rf > 0.2 && c > 20.0 {
                        ions.push(IonDraft { counts: counts_add(&counts.iter().map(|(e, n)| (e.clone(), n * 2)).collect::<Vec<_>>(), "H", -1), z: 1, weight: c * rf * (c / 800.0).min(0.5), label: "[2M-H]-".into(), molecular: false });
                    }
                }
                if g.atoms.iter().any(|a| a.el == "N" && a.charge > 0) && g.atoms.iter().any(|a| a.arom) {
                    ions.push(IonDraft { counts: counts.clone(), z: 1, weight: c * 0.05 * surf, label: "[M]-•".into(), molecular: true });
                }
                if cl > 0.0 && n_don >= 2.0 {
                    ions.push(IonDraft { counts: counts_add(&counts, "Cl", 1), z: 1, weight: c * 0.03 * n_don * cl / (cl + 1.0), label: "[M+Cl]-".into(), molecular: false });
                }
            }
        } else {
            not_analysed.push(format!("{} ({}): no structure data", sp.name, sp.formula));
            continue;
        }
        if !ions.is_empty() {
            per_species.push((si, ions));
        }
    }
    // ion suppression in the electrospray droplet
    let total_w: f64 = per_species.iter().flat_map(|(_, v)| v.iter().map(|i| i.weight)).sum();
    let scale = 1.0 / (1.0 + total_w / 40.0);
    let mut components: Vec<MsComponent> = Vec::new();
    let mut parts_all: Vec<(f64, f64, String, bool)> = Vec::new();
    let tot_signal: f64 = total_w * scale;
    for (si, ions) in &per_species {
        let sp = &sample[*si];
        let mut parts: Vec<(f64, f64, String, bool)> = Vec::new();
        let mut sig = 0.0;
        for ion in ions {
            let Some(dist) = isotopes::distribution(&ion.counts, 1e-3) else { continue };
            for (k, l) in dist.iter().enumerate() {
                let mz = l.mass / ion.z as f64;
                let a = ion.weight * scale * l.p;
                let label = if k == 0 { ion.label.clone() } else { format!("{} (M+{})", ion.label, k) };
                parts.push((mz, a, label.clone(), ion.molecular && k == 0));
                parts_all.push((mz, a, format!("{}: {}", sp.name, label), ion.molecular && k == 0));
                sig += a;
            }
        }
        if parts.is_empty() {
            continue;
        }
        let peaks = merge_peaks(parts, 0.3);
        let base = peaks.iter().max_by(|a, b| a.intensity.partial_cmp(&b.intensity).unwrap()).map(|p| p.mz).unwrap_or(0.0);
        let mw = isotopes_mass(&sp.elements, sp.smiles.as_deref());
        components.push(MsComponent { id: sp.id.clone(), name: sp.name.clone(), formula: sp.formula.clone(), mw, rt_min: None, share_pct: if tot_signal > 0.0 { sig / tot_signal * 100.0 } else { 0.0 }, peaks, base_mz: base, notes: vec![] });
    }
    components.sort_by(|a, b| b.share_pct.partial_cmp(&a.share_pct).unwrap());
    let summed = merge_peaks(parts_all, 0.3);
    MassSpectrum {
        mode: if pos { "ESI+".into() } else { "ESI-".into() },
        components,
        summed,
        chrom_t0: 0.0,
        chrom_dt: 0.0,
        tic: vec![],
        oven: vec![],
        not_analysed,
        notes: vec!["Direct infusion: no chromatographic separation.".into()],
        tier: "Estimated".into(),
        method: "ESI: ion formation by protonation / deprotonation / Na+ K+ cationisation with site-class response factors and droplet ion suppression; exact isotope patterns".into(),
    }
}

fn isotopes_mass(elements: &[(String, u32)], smiles: Option<&str>) -> f64 {
    if let Some(s) = smiles {
        if let Some(c) = Mol::components_from_smiles(s) {
            if c.len() == 1 {
                if let Some(m) = c[0].mono_mass() {
                    return m;
                }
            }
        }
    }
    elements.iter().filter_map(|(e, n)| isotopes::mono_mass(e).map(|m| m * *n as f64)).sum()
}
