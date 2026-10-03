//! 400 MHz 1H and 13C{1H} NMR of an arbitrary sample, predicted from the SMILES graph of every species in it.
//!
//! Per species: chemical shifts by group additivity (`nmr_shift`), J couplings from the connectivity (vicinal sp3 / alkene
//! cis-trans / aromatic ortho-meta-para / allylic / H-X-C-H in slow-exchange solvents / C-F), spin systems from the coupling
//! graph, first-order multiplets for weakly coupled systems and an exact Hamiltonian simulation (`spin::simulate_exact`)
//! for strongly coupled ones. Per sample: concentrations set relative intensities, exchangeable protons average or exchange
//! with the solvent, the deuterated solvent contributes its residual signals, and the number of scans sets the noise (so a
//! dilute sample or a 13C run with few scans really does lose its weak peaks).

use std::collections::HashMap;

use serde::Serialize;

use super::graph::Mol;
use super::nmr_shift::*;
use super::spin::*;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Nucleus {
    H1,
    C13,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Solvent {
    Cdcl3,
    Dmso,
    Acetone,
    C6d6,
    Cd3cn,
    D2o,
    Cd3od,
}

impl Solvent {
    pub fn parse(s: &str) -> Option<Solvent> {
        Some(match s.to_ascii_lowercase().replace(['-', '_', ' '], "").as_str() {
            "cdcl3" => Solvent::Cdcl3,
            "dmsod6" | "dmso" => Solvent::Dmso,
            "acetoned6" | "cd3cocd3" => Solvent::Acetone,
            "c6d6" | "benzened6" => Solvent::C6d6,
            "cd3cn" | "acetonitriled3" => Solvent::Cd3cn,
            "d2o" => Solvent::D2o,
            "cd3od" | "methanold4" => Solvent::Cd3od,
            _ => return None,
        })
    }

    pub fn name(self) -> &'static str {
        match self {
            Solvent::Cdcl3 => "CDCl3",
            Solvent::Dmso => "DMSO-d6",
            Solvent::Acetone => "acetone-d6",
            Solvent::C6d6 => "C6D6",
            Solvent::Cd3cn => "CD3CN",
            Solvent::D2o => "D2O",
            Solvent::Cd3od => "CD3OD",
        }
    }

    /// Column of the exchangeable-proton tables.
    fn table(self) -> usize {
        match self {
            Solvent::Cdcl3 => 0,
            Solvent::Dmso => 1,
            Solvent::Acetone => 2,
            Solvent::C6d6 => 3,
            Solvent::Cd3cn => 4,
            _ => 1,
        }
    }

    /// Protic deuterated solvents exchange every labile proton for deuterium.
    fn exchanges(self) -> bool {
        matches!(self, Solvent::D2o | Solvent::Cd3od)
    }

    /// Solvents that slow proton exchange enough to show O-H couplings and keep alcohols apart from water.
    fn slow_exchange(self) -> bool {
        matches!(self, Solvent::Dmso | Solvent::Acetone)
    }

    /// Water-miscible solvents; the others make a biphasic tube with an aqueous sample.
    pub fn dissolves_water(self) -> bool {
        !matches!(self, Solvent::Cdcl3 | Solvent::C6d6)
    }

    /// Molar concentration of the neat solvent, mol/L.
    fn molarity(self) -> f64 {
        match self {
            Solvent::Cdcl3 => 12.4,
            Solvent::Dmso => 14.1,
            Solvent::Acetone => 13.6,
            Solvent::C6d6 => 11.2,
            Solvent::Cd3cn => 18.7,
            Solvent::D2o => 55.1,
            Solvent::Cd3od => 24.6,
        }
    }

    /// Atom fraction of residual protium on the deuterated positions.
    fn residual_h(self) -> f64 {
        match self {
            Solvent::Cdcl3 => 0.002,
            Solvent::Dmso => 0.0010,
            Solvent::Acetone => 0.0010,
            Solvent::C6d6 => 0.0010,
            Solvent::Cd3cn => 0.0010,
            Solvent::D2o => 0.0010,
            Solvent::Cd3od => 0.0010,
        }
    }

    /// Residual 1H signals of the solvent: (ppm, label, D atoms on the carbon (pattern 2nD+1), J_HD Hz, H count per molecule).
    fn residual_peaks_h(self) -> Vec<(f64, &'static str, u32, f64, f64)> {
        match self {
            Solvent::Cdcl3 => vec![(7.26, "CHCl3 (residual)", 0, 0.0, 1.0)],
            Solvent::Dmso => vec![(2.50, "DMSO-d5 (residual)", 2, 1.9, 3.0)],
            Solvent::Acetone => vec![(2.05, "acetone-d5 (residual)", 2, 2.2, 3.0)],
            Solvent::C6d6 => vec![(7.16, "C6D5H (residual)", 0, 0.0, 6.0)],
            Solvent::Cd3cn => vec![(1.94, "CD2HCN (residual)", 2, 2.5, 3.0)],
            Solvent::Cd3od => vec![(3.31, "CD2HOD (residual)", 2, 1.7, 3.0)],
            Solvent::D2o => vec![],
        }
    }

    /// Solvent 13C signals: (ppm, label, n D on the carbon, J_CD Hz, carbons per molecule).
    fn peaks_c13(self) -> Vec<(f64, &'static str, u32, f64, f64)> {
        match self {
            Solvent::Cdcl3 => vec![(77.16, "CDCl3", 1, 32.0, 1.0)],
            Solvent::Dmso => vec![(39.52, "DMSO-d6", 3, 21.0, 2.0)],
            Solvent::Acetone => vec![(29.84, "acetone-d6 CD3", 3, 20.0, 2.0), (206.26, "acetone-d6 C=O", 0, 0.0, 1.0)],
            Solvent::C6d6 => vec![(128.06, "C6D6", 1, 24.0, 6.0)],
            Solvent::Cd3cn => vec![(1.32, "CD3CN CD3", 3, 21.0, 1.0), (118.26, "CD3CN CN", 0, 0.0, 1.0)],
            Solvent::Cd3od => vec![(49.00, "CD3OD", 3, 21.5, 1.0)],
            Solvent::D2o => vec![],
        }
    }

    fn hdo_ppm(self) -> f64 {
        match self {
            Solvent::Cd3od => 4.87,
            _ => 4.79,
        }
    }
}

#[derive(Clone, Debug)]
pub struct SampleSpecies {
    pub id: String,
    pub name: String,
    pub smiles: Option<String>,
    pub formula: String,
    pub charge: i32,
    /// Concentration in the vessel liquid, mmol/L.
    pub conc_mm: f64,
}

#[derive(Clone, Debug, Serialize)]
pub struct NmrSignal {
    pub ppm: f64,
    pub multiplicity: String,
    pub j_hz: Vec<f64>,
    /// 1H: relative integral in protons of the most abundant species (C-H); 13C: relative intensity in carbons.
    pub integration: f64,
    /// Equivalent nuclei in the molecule that give this signal.
    pub nuclei: u32,
    pub assignment: String,
    pub species: String,
    pub species_id: String,
    pub exchangeable: bool,
    pub solvent: bool,
    pub width_hz: f64,
    /// Peak height over the noise (1 sigma) for this acquisition.
    pub snr: f64,
    pub ppm_lo: f64,
    pub ppm_hi: f64,
}

#[derive(Clone, Debug, Serialize)]
pub struct NmrSpectrum {
    pub nucleus: String,
    pub solvent: String,
    pub frequency_mhz: f64,
    pub scans: u32,
    pub ppm_start: f64,
    pub ppm_step: f64,
    /// Intensity normalised to the tallest peak (noise included), uniform ppm grid ascending from `ppm_start`.
    pub intensity: Vec<f32>,
    pub signals: Vec<NmrSignal>,
    pub noise_sigma: f64,
    pub unobserved: Vec<String>,
    pub notes: Vec<String>,
    pub tier: String,
    pub method: String,
}

/// Draft of a signal before synthesis: positions in ppm, line offsets in Hz about the centre (weights sum to 1).
struct Draft {
    sig: NmrSignal,
    lines: Vec<Line>,
    area: f64,
    /// Exchangeable-proton class and owning species, for pooling with other labile protons.
    kind: Option<Labile>,
    sp: usize,
}

#[derive(Clone)]
struct Prot {
    atom: usize,
    slot: u8,
    shift: f64,
    labile: Option<Labile>,
}

struct Pool {
    species: usize,
    kind: Labile,
    n_h: f64,
    shift: f64,
    area: f64,
}

const DILUTION: f64 = 0.25;
const SIGMA_1SCAN: f64 = 0.05;
const C13_SENS: f64 = 3.5e-4;
const N_H: usize = 32768;
const N_C: usize = 65536;
const H_RANGE: (f64, f64) = (-1.0, 14.0);
const C_RANGE: (f64, f64) = (-10.0, 230.0);

fn nu0(n: Nucleus) -> f64 {
    match n {
        Nucleus::H1 => 400.13,
        Nucleus::C13 => 100.61,
    }
}

fn bfs_dist(g: &Mol, a: usize, b: usize, limit: usize) -> usize {
    if a == b {
        return 0;
    }
    let mut dist = vec![usize::MAX; g.n()];
    dist[a] = 0;
    let mut q = std::collections::VecDeque::new();
    q.push_back(a);
    while let Some(u) = q.pop_front() {
        if dist[u] >= limit {
            continue;
        }
        for v in g.nbrs(u) {
            if dist[v] == usize::MAX {
                dist[v] = dist[u] + 1;
                if v == b {
                    return dist[v];
                }
                q.push_back(v);
            }
        }
    }
    usize::MAX
}

fn fragment(g: &Mol, i: usize) -> String {
    let h = g.atoms[i].h;
    let base = match (g.atoms[i].el.as_str(), h) {
        ("C", 0) => "C".to_string(),
        ("C", 1) => "CH".to_string(),
        ("C", n) => format!("CH{}", n),
        (e, 0) => e.to_string(),
        (e, 1) => format!("{}H", e),
        (e, n) => format!("{}H{}", e, n),
    };
    let nb: Vec<String> = g
        .nbrs(i)
        .map(|j| {
            let a = &g.atoms[j];
            match a.el.as_str() {
                "C" if a.arom => "Ar".to_string(),
                "C" if g.double_to(j, "O", None) => "C=O".to_string(),
                "C" if g.has_double(j) => "C=C".to_string(),
                "C" if g.triple_bonded(j).is_some() => "C≡".to_string(),
                "C" => match a.h {
                    0 => "C".to_string(),
                    1 => "CH".to_string(),
                    n => format!("CH{}", n),
                },
                e => e.to_string(),
            }
        })
        .collect();
    if g.atoms[i].arom {
        let subs: Vec<String> = ring_subs(g, i);
        return if subs.is_empty() { "Ar-H".to_string() } else { format!("Ar-H (ring bears {})", subs.join(", ")) };
    }
    if nb.is_empty() {
        base
    } else {
        format!("{} ({})", base, nb.join(", "))
    }
}

fn ring_subs(g: &Mol, i: usize) -> Vec<String> {
    let ring = aromatic_ring(g, i);
    let mut out: Vec<String> = Vec::new();
    for &a in &ring {
        if g.atoms[a].el != "C" {
            out.push(g.atoms[a].el.clone());
        }
        for y in g.nbrs(a).filter(|y| !ring.contains(y)) {
            let s = match classify(g, y, a) {
                Grp::Alkyl => g.atoms[y].el.clone() + &if g.atoms[y].h > 0 { format!("H{}", g.atoms[y].h).replace("H1", "H") } else { String::new() },
                other => format!("{:?}", other),
            };
            out.push(s);
        }
    }
    out.sort();
    out.dedup();
    out
}

// -------------------------------------------------------------------------------------------------- proton couplings

fn aromatic_pair_j(g: &Mol, ap: usize, aq: usize) -> f64 {
    let ring = aromatic_ring(g, ap);
    let hetero_adj = |a: usize| g.nbrs(a).any(|k| ring.contains(&k) && g.atoms[k].el != "C");
    if ring.len() == 6 {
        if hetero_adj(ap) || hetero_adj(aq) { 4.9 } else { 7.8 }
    } else {
        let el = ring.iter().map(|&k| g.atoms[k].el.as_str()).find(|e| *e != "C").unwrap_or("C");
        if hetero_adj(ap) != hetero_adj(aq) {
            match el {
                "O" => 1.8,
                "S" => 4.9,
                _ => 2.7,
            }
        } else {
            3.5
        }
    }
}

fn vinyl_j(g: &Mol, p: &Prot, q: &Prot) -> f64 {
    let (ap, aq) = (p.atom, q.atom);
    let ring = g.ring_bond(ap, aq);
    if ring {
        return match g.ring_size_of_bond(ap, aq) {
            Some(3) => 1.5,
            Some(4) => 2.8,
            Some(5) => 5.6,
            Some(6) => 10.0,
            _ => 10.5,
        };
    }
    let (hp, hq) = (g.atoms[ap].h, g.atoms[aq].h);
    if hp >= 2 && hq >= 2 {
        return 0.0;
    }
    if hp >= 2 {
        // =CH2 proton: slot 0 is cis to the substituent of the other carbon, i.e. trans to its hydrogen
        return if p.slot == 0 { 17.0 } else { 10.5 };
    }
    if hq >= 2 {
        return if q.slot == 0 { 17.0 } else { 10.5 };
    }
    15.5
}

fn j_hh(g: &Mol, p: &Prot, q: &Prot, solv: Solvent) -> f64 {
    let (ap, aq) = (p.atom, q.atom);
    if ap == aq {
        // geminal coupling matters only between the inequivalent protons of a =CH2
        if p.slot != q.slot && g.has_double(ap) && !g.atoms[ap].arom {
            return 1.5;
        }
        return 0.0;
    }
    if let (Some(_), Some(_)) = (p.labile, q.labile) {
        return 0.0;
    }
    if p.labile.is_some() || q.labile.is_some() {
        let (lab, other) = if p.labile.is_some() { (p, q) } else { (q, p) };
        if bfs_dist(g, lab.atom, other.atom, 2) != 1 {
            return 0.0;
        }
        return match lab.labile.unwrap() {
            Labile::Alcohol if solv.slow_exchange() => 5.2,
            Labile::Amide | Labile::PrimaryAmide | Labile::Anilide => 5.8,
            Labile::Thiol => 7.8,
            Labile::Amine if solv.slow_exchange() => 0.0,
            _ => 0.0,
        };
    }
    let d = bfs_dist(g, ap, aq, 3);
    let (aa, ab) = (&g.atoms[ap], &g.atoms[aq]);
    match d {
        1 => {
            let b = g.bond(ap, aq).unwrap_or(1.0);
            if (b - 1.5).abs() < 1e-9 {
                aromatic_pair_j(g, ap, aq)
            } else if (b - 2.0).abs() < 1e-9 {
                vinyl_j(g, p, q)
            } else {
                let formyl = |a: usize| g.atoms[a].el == "C" && g.double_to(a, "O", None);
                let sp2 = |a: usize| g.has_double(a) && !g.atoms[a].arom;
                if formyl(ap) || formyl(aq) {
                    2.5
                } else if sp2(ap) && sp2(aq) {
                    10.5
                } else if sp2(ap) || sp2(aq) {
                    6.5
                } else {
                    let polar = |a: usize| g.nbrs(a).any(|k| matches!(g.atoms[k].el.as_str(), "O" | "N" | "F" | "Cl" | "Br" | "I"));
                    if g.ring_size_of_bond(ap, aq) == Some(6) && polar(ap) && polar(aq) {
                        8.5 // chair ring with equatorial substituents (carbohydrates): mostly trans-diaxial couplings
                    } else if polar(ap) || polar(aq) {
                        6.9
                    } else {
                        7.2
                    }
                }
            }
        }
        2 => {
            // aromatic meta, allylic, propargylic
            if aa.arom && ab.arom {
                let ring = aromatic_ring(g, ap);
                if ring.contains(&aq) {
                    return if ring.len() == 6 { 1.8 } else { 1.0 };
                }
                return 0.0;
            }
            let via: Vec<usize> = g.nbrs(ap).filter(|&x| g.bond(x, aq).is_some()).collect();
            for x in via {
                let bx_q = g.bond(x, aq).unwrap_or(1.0);
                let bx_p = g.bond(x, ap).unwrap_or(1.0);
                if ((bx_q - 2.0).abs() < 1e-9 && (bx_p - 1.0).abs() < 1e-9 && !g.atoms[aq].arom && g.atoms[aq].el == "C")
                    || ((bx_p - 2.0).abs() < 1e-9 && (bx_q - 1.0).abs() < 1e-9 && !g.atoms[ap].arom && g.atoms[ap].el == "C")
                {
                    return 1.3;
                }
                if (bx_q - 3.0).abs() < 1e-9 || (bx_p - 3.0).abs() < 1e-9 {
                    return 2.5;
                }
            }
            0.0
        }
        3 => {
            if aa.arom && ab.arom {
                let ring = aromatic_ring(g, ap);
                if ring.len() == 6 && ring.contains(&aq) {
                    return 0.6;
                }
            }
            0.0
        }
        _ => 0.0,
    }
}

// -------------------------------------------------------------------------------------------------- 1H of one molecule

struct MolH1 {
    drafts: Vec<Draft>,
    pools: Vec<Pool>,
}

fn alkyne_h(g: &Mol, i: usize) -> f64 {
    let t = g.triple_bonded(i);
    let aryl = t.map_or(false, |t| g.nbrs(t).any(|k| g.atoms[k].arom));
    let conj_c = t.map_or(false, |t| g.nbrs(t).any(|k| g.atoms[k].el == "C" && g.double_to(k, "O", None)));
    if aryl {
        3.05
    } else if conj_c {
        2.9
    } else {
        1.9
    }
}

fn carbon_h_shifts(g: &Mol, i: usize) -> Vec<(u8, f64)> {
    let a = &g.atoms[i];
    if a.arom {
        return vec![(0, aromatic_h_shift(g, i))];
    }
    if g.triple_bonded(i).is_some() {
        return vec![(0, alkyne_h(g, i))];
    }
    if g.double_to(i, "O", None) {
        // formyl proton
        let other = g.nbrs(i).find(|&k| !(g.bond(i, k) == Some(2.0) && g.atoms[k].el == "O"));
        let v = match other {
            Some(k) if matches!(g.atoms[k].el.as_str(), "O" | "N") => 8.05,
            Some(k) if g.atoms[k].arom => 10.0,
            Some(k) if g.has_double(k) => 9.55,
            _ => 9.75,
        };
        return vec![(0, v)];
    }
    if g.double_to(i, "N", None) {
        return vec![(0, 7.7)];
    }
    if g.has_double(i) {
        let ds = alkene_h_shifts(g, i);
        return ds.iter().enumerate().map(|(k, v)| (k as u8, *v)).collect();
    }
    vec![(0, sp3_h_shift(g, i))]
}

fn width_h(labile: Option<Labile>) -> f64 {
    labile.map_or(0.9, labile_width_hz)
}

fn mol_h1(g: &Mol, species: usize, name: &str, id: &str, conc: f64, solv: Solvent) -> MolH1 {
    let mut out = MolH1 { drafts: Vec::new(), pools: Vec::new() };
    let n = g.n();
    let cls = g.classes();
    // dihydrogen and the bare proton
    if g.atoms.iter().all(|a| a.el == "H") {
        if g.n() == 2 {
            out.drafts.push(Draft { kind: None, sp: 0,
                sig: NmrSignal { ppm: 4.60, multiplicity: "s".into(), j_hz: vec![], integration: 0.0, nuclei: 2, assignment: "H-H".into(), species: name.into(), species_id: id.into(), exchangeable: false, solvent: false, width_hz: 1.5, snr: 0.0, ppm_lo: 4.6, ppm_hi: 4.6 },
                lines: vec![Line { hz: 0.0, w: 1.0 }],
                area: conc * 2.0,
            });
        } else if g.n() == 1 && g.atoms[0].charge > 0 {
            out.pools.push(Pool { species, kind: Labile::StrongAcid, n_h: 1.0, shift: 11.0, area: conc });
        }
        return out;
    }
    let mut protons: Vec<Prot> = Vec::new();
    for i in 0..n {
        let a = &g.atoms[i];
        if a.h == 0 {
            continue;
        }
        if let Some(kind) = labile_class(g, i) {
            if kind == Labile::Water && a.charge == 0 {
                out.pools.push(Pool { species, kind, n_h: a.h as f64, shift: labile_shift(kind, solv.table()), area: conc * a.h as f64 });
                continue;
            }
            // hydroxide, hydronium, ammonium: exchange with the water pool
            if a.charge != 0 && a.el == "O" {
                let shift = if a.charge > 0 { 10.5 } else { 1.0 };
                out.pools.push(Pool { species, kind: Labile::StrongAcid, n_h: a.h as f64, shift, area: conc * a.h as f64 });
                continue;
            }
            if solv.exchanges() {
                out.pools.push(Pool { species, kind, n_h: a.h as f64, shift: solv.hdo_ppm(), area: conc * a.h as f64 });
                continue;
            }
            for _ in 0..a.h {
                protons.push(Prot { atom: i, slot: 0, shift: labile_shift(kind, solv.table()), labile: Some(kind) });
            }
            continue;
        }
        if a.el == "C" {
            for (slot, shift) in carbon_h_shifts(g, i) {
                let count = if a.h >= 2 && g.has_double(i) && !a.arom { 1 } else { a.h };
                for _ in 0..count {
                    protons.push(Prot { atom: i, slot, shift, labile: None });
                }
            }
        } else {
            for _ in 0..a.h {
                protons.push(Prot { atom: i, slot: 0, shift: 4.0, labile: None });
            }
        }
    }
    if protons.is_empty() {
        return out;
    }
    // equivalence groups
    let mut key_to_group: HashMap<(usize, u8, i64, bool), usize> = HashMap::new();
    let mut group_of: Vec<usize> = Vec::new();
    let mut groups: Vec<Vec<usize>> = Vec::new();
    for (pi, p) in protons.iter().enumerate() {
        let k = (cls[p.atom], p.slot, (p.shift * 200.0).round() as i64, p.labile.is_some());
        let gi = *key_to_group.entry(k).or_insert_with(|| {
            groups.push(Vec::new());
            groups.len() - 1
        });
        groups[gi].push(pi);
        group_of.push(gi);
    }
    let np = protons.len();
    let mut jm = vec![vec![0.0; np]; np];
    for a in 0..np {
        for b in (a + 1)..np {
            let j = j_hh(g, &protons[a], &protons[b], solv);
            jm[a][b] = j;
            jm[b][a] = j;
        }
    }
    // spin systems: groups connected by couplings between different groups
    let ng = groups.len();
    let mut parent: Vec<usize> = (0..ng).collect();
    fn find(p: &mut Vec<usize>, i: usize) -> usize {
        if p[i] != i {
            let r = find(p, p[i]);
            p[i] = r;
        }
        p[i]
    }
    for a in 0..np {
        for b in (a + 1)..np {
            if group_of[a] != group_of[b] && jm[a][b].abs() >= 0.3 {
                let (ra, rb) = (find(&mut parent, group_of[a]), find(&mut parent, group_of[b]));
                if ra != rb {
                    parent[ra] = rb;
                }
            }
        }
    }
    let mut systems: HashMap<usize, Vec<usize>> = HashMap::new();
    for gi in 0..ng {
        let r = find(&mut parent, gi);
        systems.entry(r).or_default().push(gi);
    }
    let f0 = nu0(Nucleus::H1);
    let mut sys_list: Vec<Vec<usize>> = systems.into_values().collect();
    sys_list.sort();
    for sys in sys_list {
        let sys_protons: Vec<usize> = sys.iter().flat_map(|&gi| groups[gi].iter().copied()).collect();
        // strong coupling between different groups?
        let mut strong = false;
        for &ga in &sys {
            for &gb in &sys {
                if ga >= gb {
                    continue;
                }
                let jmax = groups[ga].iter().flat_map(|&a| groups[gb].iter().map(move |&b| (a, b))).map(|(a, b)| jm[a][b].abs()).fold(0.0, f64::max);
                if jmax >= 1.0 {
                    let dnu = (protons[groups[ga][0]].shift - protons[groups[gb][0]].shift).abs() * f0;
                    if dnu < 15.0 * jmax {
                        strong = true;
                    }
                }
            }
        }
        let exact = strong && sys_protons.len() <= 9;
        let mut exact_lines: Vec<Vec<Line>> = Vec::new();
        if exact {
            let local: HashMap<usize, usize> = sys_protons.iter().enumerate().map(|(k, &p)| (p, k)).collect();
            let nu: Vec<f64> = sys_protons.iter().map(|&p| protons[p].shift * f0).collect();
            let m = sys_protons.len();
            let mut jl = vec![vec![0.0; m]; m];
            for &a in &sys_protons {
                for &b in &sys_protons {
                    jl[local[&a]][local[&b]] = jm[a][b];
                }
            }
            let gl: Vec<Vec<usize>> = sys.iter().map(|&gi| groups[gi].iter().map(|p| local[p]).collect()).collect();
            exact_lines = simulate_exact(&nu, &jl, &gl);
        }
        for (si, &gi) in sys.iter().enumerate() {
            let members = &groups[gi];
            let r = members[0];
            let p = &protons[r];
            let n_h = members.len() as u32;
            let (label, j_list, lines, ppm): (String, Vec<f64>, Vec<Line>, f64) = if exact {
                let ls = &exact_lines[si];
                let tot: f64 = ls.iter().map(|l| l.w).sum::<f64>().max(1e-12);
                let centre_hz = ls.iter().map(|l| l.hz * l.w).sum::<f64>() / tot;
                let rel: Vec<Line> = ls.iter().map(|l| Line { hz: l.hz - centre_hz, w: l.w / tot }).collect();
                let (lab, js) = label_lines(&rel);
                (lab, js.iter().map(|j| (j * 10.0).round() / 10.0).collect(), rel, centre_hz / f0)
            } else {
                // first order: partners of the representative proton, grouped by partner group and coupling value
                let mut partners: Vec<(u32, f64)> = Vec::new();
                for &gj in &sys {
                    if gj == gi {
                        continue;
                    }
                    let mut js: Vec<f64> = groups[gj].iter().map(|&q| jm[r][q]).filter(|j| j.abs() >= 0.5).collect();
                    js.sort_by(|a, b| b.partial_cmp(a).unwrap());
                    let mut k = 0;
                    while k < js.len() {
                        let mut cnt = 1;
                        while k + cnt < js.len() && (js[k + cnt] - js[k]).abs() < 0.3 {
                            cnt += 1;
                        }
                        partners.push((cnt as u32, js[k]));
                        k += cnt;
                    }
                }
                let lab = multiplicity_label(&partners);
                let mut js: Vec<f64> = partners.iter().filter(|(_, j)| *j >= 0.7).map(|(_, j)| (*j * 10.0).round() / 10.0).collect();
                js.dedup();
                let resolved: Vec<(u32, f64)> = partners.iter().copied().filter(|(_, j)| *j >= 0.7).collect();
                (lab, js, first_order(&resolved), p.shift)
            };
            let width = width_h(p.labile);
            let mut frag = fragment(g, p.atom);
            if protons[r].labile.is_none() && g.has_double(p.atom) && !g.atoms[p.atom].arom && g.atoms[p.atom].h >= 2 {
                frag = format!("{} ({})", if p.slot == 0 { "=CH2 H cis to R" } else { "=CH2 H trans to R" }, frag);
            }
            let lo = lines.iter().map(|l| l.hz).fold(f64::MAX, f64::min) / f0 + ppm;
            let hi = lines.iter().map(|l| l.hz).fold(f64::MIN, f64::max) / f0 + ppm;
            out.drafts.push(Draft { kind: p.labile, sp: species,
                sig: NmrSignal {
                    ppm,
                    multiplicity: if p.labile.is_some() && label == "s" { "br s".into() } else { label },
                    j_hz: j_list,
                    integration: 0.0,
                    nuclei: n_h,
                    assignment: frag,
                    species: name.into(),
                    species_id: id.into(),
                    exchangeable: p.labile.is_some(),
                    solvent: false,
                    width_hz: width,
                    snr: 0.0,
                    ppm_lo: lo,
                    ppm_hi: hi,
                },
                lines,
                area: conc * n_h as f64,
            });
        }
    }
    out
}

// -------------------------------------------------------------------------------------------------- 13C of one molecule

fn c13_shift_of(g: &Mol, i: usize) -> (f64, f64, String) {
    let a = &g.atoms[i];
    let q_factor = |h: u32| if h > 0 { 1.0 } else { 0.45 };
    if a.arom {
        return (aromatic_c13_shift(g, i), q_factor(a.h), "aromatic C".into());
    }
    if let Some(_) = g.triple_bonded(i) {
        let is_nitrile = g.nbrs(i).any(|k| g.atoms[k].el == "N" && g.bond(i, k) == Some(3.0));
        if is_nitrile {
            return (nitrile_c13_shift(g, i), 0.35, "nitrile C".into());
        }
        if g.nbrs(i).any(|k| g.atoms[k].el == "C" && g.bond(i, k) == Some(3.0)) {
            return (alkyne_c13_shift(g, i), q_factor(a.h), "alkyne C".into());
        }
        return (120.0, 0.4, "sp C".into());
    }
    if g.double_to(i, "O", None) {
        // carbon dioxide and ketene-like cumulenes
        if g.adj[i].iter().filter(|&&(_, o)| (o - 2.0).abs() < 1e-9).count() == 2 {
            return (124.5, 0.4, "O=C=O".into());
        }
        let (s, label) = carbonyl_c13_shift(g, i);
        return (s, 0.35, label.into());
    }
    if g.double_to(i, "N", None) {
        return (158.0 - if a.h > 0 { 6.0 } else { 0.0 }, 0.4, "C=N".into());
    }
    if g.double_to(i, "S", None) {
        return (193.0, 0.35, "C=S".into());
    }
    if g.has_double(i) {
        let nb_c = g.nbrs(i).filter(|&k| g.atoms[k].el == "C" || g.atoms[k].el == "O" || g.atoms[k].el == "N").count();
        let _ = nb_c;
        return (alkene_c13_shift(g, i), q_factor(a.h), "alkene C".into());
    }
    (sp3_c13_shift(g, i), q_factor(a.h), "sp3 C".into())
}

fn cf_partners(g: &Mol, i: usize) -> Vec<(u32, f64)> {
    let f_on = |a: usize| g.nbrs(a).filter(|&k| g.atoms[k].el == "F").count() as u32;
    let mut p: Vec<(u32, f64)> = Vec::new();
    let n1 = f_on(i);
    if n1 > 0 {
        p.push((n1, if n1 >= 3 { 272.0 } else if g.atoms[i].arom { 245.0 } else { 240.0 }));
    }
    let mut n2 = 0;
    let mut n3 = 0;
    for j in g.nbrs(i) {
        n2 += f_on(j);
        for k in g.nbrs(j).filter(|&k| k != i) {
            n3 += f_on(k);
        }
    }
    if n2 > 0 {
        p.push((n2, if g.atoms[i].arom { 21.0 } else { 22.0 }));
    }
    if n3 > 0 {
        p.push((n3, if g.atoms[i].arom { 8.0 } else { 5.0 }));
    }
    p
}

fn mol_c13(g: &Mol, name: &str, id: &str, conc: f64) -> Vec<Draft> {
    let cls = g.classes();
    let mut groups: HashMap<(usize, i64), Vec<usize>> = HashMap::new();
    let mut shifts: HashMap<usize, (f64, f64, String)> = HashMap::new();
    for i in 0..g.n() {
        if g.atoms[i].el != "C" {
            continue;
        }
        let s = c13_shift_of(g, i);
        groups.entry((cls[i], (s.0 * 10.0).round() as i64)).or_default().push(i);
        shifts.insert(i, s);
    }
    let mut keys: Vec<(usize, i64)> = groups.keys().copied().collect();
    keys.sort();
    let f0 = nu0(Nucleus::C13);
    let mut out = Vec::new();
    for k in keys {
        let members = &groups[&k];
        let r = members[0];
        let (shift, qf, label) = shifts[&r].clone();
        let partners = cf_partners(g, r);
        let lines = first_order(&partners);
        let mult = if partners.is_empty() { "s".to_string() } else { multiplicity_label(&partners) };
        let js: Vec<f64> = partners.iter().map(|(_, j)| *j).collect();
        let lo = lines.iter().map(|l| l.hz).fold(f64::MAX, f64::min) / f0 + shift;
        let hi = lines.iter().map(|l| l.hz).fold(f64::MIN, f64::max) / f0 + shift;
        let frag = if g.atoms[r].h > 0 { format!("{} ({})", fragment_c(g, r), label) } else { label };
        out.push(Draft { kind: None, sp: 0,
            sig: NmrSignal {
                ppm: shift,
                multiplicity: mult,
                j_hz: js,
                integration: 0.0,
                nuclei: members.len() as u32,
                assignment: frag,
                species: name.into(),
                species_id: id.into(),
                exchangeable: false,
                solvent: false,
                width_hz: if g.atoms[r].h > 0 { 1.0 } else { 1.6 },
                snr: 0.0,
                ppm_lo: lo,
                ppm_hi: hi,
            },
            lines,
            area: conc * members.len() as f64 * qf * C13_SENS,
        });
    }
    out
}

fn fragment_c(g: &Mol, i: usize) -> String {
    match g.atoms[i].h {
        0 => "C".into(),
        1 => "CH".into(),
        n => format!("CH{}", n),
    }
}

// -------------------------------------------------------------------------------------------------- the experiment

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> f64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        (self.0 >> 11) as f64 / (1u64 << 53) as f64
    }
    fn gauss(&mut self) -> f64 {
        let (u1, u2) = (self.next().max(1e-12), self.next());
        (-2.0 * u1.ln()).sqrt() * (2.0 * std::f64::consts::PI * u2).cos()
    }
}

fn lorentz_add(buf: &mut [f64], ppm0: f64, dppm: f64, f0: f64, centre_ppm: f64, hz_off: f64, area: f64, width_hz: f64) {
    let pos = centre_ppm + hz_off / f0;
    let w = width_hz / f0; // ppm
    let reach = (w * 30.0).max(dppm * 3.0);
    let lo = (((pos - reach) - ppm0) / dppm).floor().max(0.0) as usize;
    let hi = ((((pos + reach) - ppm0) / dppm).ceil() as i64).clamp(0, buf.len() as i64 - 1) as usize;
    if lo > hi {
        return;
    }
    // unit-area Lorentzian per Hz: (w/2pi) / (dx^2 + (w/2)^2) with x in Hz
    let wh = width_hz;
    let amp = area * wh / (2.0 * std::f64::consts::PI);
    for k in lo..=hi {
        let x_hz = (ppm0 + k as f64 * dppm - pos) * f0;
        buf[k] += amp / (x_hz * x_hz + 0.25 * wh * wh);
    }
}

pub fn simulate(sample: &[SampleSpecies], nucleus: Nucleus, solvent: Solvent, scans: u32, seed: u64, biphasic_aqueous: bool) -> NmrSpectrum {
    let f0 = nu0(nucleus);
    let mut drafts: Vec<Draft> = Vec::new();
    let mut pools: Vec<Pool> = Vec::new();
    let mut unobserved: Vec<String> = Vec::new();
    let mut notes: Vec<String> = Vec::new();
    let mut species_names: Vec<String> = Vec::new();
    for (si, sp) in sample.iter().enumerate() {
        species_names.push(sp.name.clone());
        let conc = sp.conc_mm * DILUTION;
        let Some(smi) = &sp.smiles else {
            if nucleus == Nucleus::H1 && sp.formula.contains('H') || nucleus == Nucleus::C13 && sp.formula.contains('C') {
                unobserved.push(format!("{} ({}): no structure data, not simulated", sp.name, sp.formula));
            }
            continue;
        };
        let Some(comps) = Mol::components_from_smiles(smi) else {
            unobserved.push(format!("{}: SMILES not readable", sp.name));
            continue;
        };
        for g in &comps {
            match nucleus {
                Nucleus::H1 => {
                    let m = mol_h1(g, si, &sp.name, &sp.id, conc, solvent);
                    drafts.extend(m.drafts);
                    pools.extend(m.pools);
                }
                Nucleus::C13 => {
                    if biphasic_aqueous && g.n() == 1 {
                        continue;
                    }
                    drafts.extend(mol_c13(g, &sp.name, &sp.id, conc));
                }
            }
        }
    }
    if biphasic_aqueous {
        notes.push(format!("Aqueous sample in {}: water does not mix with it, the tube is biphasic and water shows only as a small dissolved-water peak.", solvent.name()));
    }

    // exchangeable protons: pooled with the solvent (D2O, CD3OD), averaged (fast exchange), or left as separate signals
    if nucleus == Nucleus::H1 {
        let mut hdo_area = 0.0;
        let solvent_h_area = solvent.molarity() * 1000.0 * (1.0 - DILUTION) * solvent.residual_h() * 2.0;
        let fast_kind = |k: Labile| match k {
            Labile::Water | Labile::StrongAcid | Labile::Acid => true,
            Labile::Alcohol | Labile::Phenol | Labile::Oxime => !solvent.slow_exchange(),
            _ => false,
        };
        // labile protons that were drafted as signals join the pools when they can exchange quickly
        if !solvent.exchanges() {
            let mut keep: Vec<Draft> = Vec::new();
            for d in drafts.drain(..) {
                match d.kind {
                    Some(k) if fast_kind(k) => pools.push(Pool { species: d.sp, kind: k, n_h: d.sig.nuclei as f64, shift: d.sig.ppm, area: d.area }),
                    _ => keep.push(d),
                }
            }
            drafts = keep;
        }
        let mut fast: Vec<&Pool> = Vec::new();
        let mut separate: Vec<&Pool> = Vec::new();
        for p in &pools {
            if solvent.exchanges() {
                hdo_area += p.area;
                continue;
            }
            if fast_kind(p.kind) { fast.push(p) } else { separate.push(p) }
        }
        let species_in_fast: std::collections::HashSet<usize> = fast.iter().map(|p| p.species).collect();
        let coalesce = species_in_fast.len() >= 2 || fast.iter().any(|p| p.kind == Labile::StrongAcid) && !fast.is_empty() && species_in_fast.len() >= 1 && fast.len() >= 2;
        let push_pool = |ps: &[&Pool], drafts: &mut Vec<Draft>, label: &str| {
            let tot: f64 = ps.iter().map(|p| p.area).sum();
            if tot <= 0.0 {
                return;
            }
            let shift = ps.iter().map(|p| p.area * p.shift).sum::<f64>() / tot;
            let n_h: f64 = ps.iter().map(|p| p.n_h).sum::<f64>() / ps.len() as f64;
            let who: Vec<String> = {
                let mut v: Vec<String> = ps.iter().map(|p| species_names[p.species].clone()).collect();
                v.sort();
                v.dedup();
                v
            };
            let width = ps.iter().map(|p| labile_width_hz(p.kind)).fold(0.0, f64::max).max(6.0);
            drafts.push(Draft { kind: None, sp: 0,
                sig: NmrSignal { ppm: shift, multiplicity: "br s".into(), j_hz: vec![], integration: 0.0, nuclei: n_h.round() as u32, assignment: label.into(), species: who.join(" + "), species_id: String::new(), exchangeable: true, solvent: false, width_hz: width, snr: 0.0, ppm_lo: shift, ppm_hi: shift },
                lines: vec![Line { hz: 0.0, w: 1.0 }],
                area: tot,
            });
        };
        if solvent.exchanges() {
            let label = "HDO + exchanged O-H / N-H";
            let tot = hdo_area + solvent_h_area;
            drafts.push(Draft { kind: None, sp: 0,
                sig: NmrSignal { ppm: solvent.hdo_ppm(), multiplicity: "s".into(), j_hz: vec![], integration: 0.0, nuclei: 1, assignment: label.into(), species: format!("{} + sample", solvent.name()), species_id: String::new(), exchangeable: true, solvent: true, width_hz: 6.0, snr: 0.0, ppm_lo: solvent.hdo_ppm(), ppm_hi: solvent.hdo_ppm() },
                lines: vec![Line { hz: 0.0, w: 1.0 }],
                area: tot,
            });
            if hdo_area > 0.0 {
                notes.push("Labile O-H / N-H protons exchange with the deuterated solvent and merge into the HDO line.".into());
            }
        } else {
            if coalesce {
                push_pool(&fast, &mut drafts, "O-H / water / H+ (fast exchange, averaged)");
                notes.push("Hydroxyl, acid and water protons exchange quickly here and appear as one averaged line.".into());
            } else {
                for p in &fast {
                    push_pool(&[*p], &mut drafts, &format!("{} proton{}", pool_label(p.kind), if p.n_h > 1.0 { "s" } else { "" }));
                }
            }
            for p in &separate {
                push_pool(&[*p], &mut drafts, &format!("{} proton{}", pool_label(p.kind), if p.n_h > 1.0 { "s" } else { "" }));
            }
        }
    }

    // reference and solvent signals
    let mut solvent_drafts: Vec<Draft> = Vec::new();
    match nucleus {
        Nucleus::H1 => {
            let tms_area = 7.34e3 * 3.0e-4 * (1.0 - DILUTION) * 12.0;
            solvent_drafts.push(Draft { kind: None, sp: 0,
                sig: NmrSignal { ppm: 0.0, multiplicity: "s".into(), j_hz: vec![], integration: 0.0, nuclei: 12, assignment: if solvent == Solvent::D2o { "DSS (reference)".into() } else { "TMS (reference)".into() }, species: "internal standard".into(), species_id: String::new(), exchangeable: false, solvent: true, width_hz: 0.8, snr: 0.0, ppm_lo: 0.0, ppm_hi: 0.0 },
                lines: vec![Line { hz: 0.0, w: 1.0 }],
                area: tms_area,
            });
            for (ppm, label, nd, jhd, nh) in solvent.residual_peaks_h() {
                let conc_h = solvent.molarity() * 1000.0 * (1.0 - DILUTION) * if nd > 0 { solvent.residual_h() * 3.0 } else { solvent.residual_h() * nh };
                let partners = if nd > 0 { vec![(nd * 2, jhd / 2.0)] } else { vec![] };
                // 2nI+1 pattern of the deuterons (I = 1): convolve nd times (1,1,1) spaced J
                let mut lines = vec![Line { hz: 0.0, w: 1.0 }];
                for _ in 0..nd {
                    let mut next = Vec::new();
                    for l in &lines {
                        for k in [-1.0, 0.0, 1.0] {
                            next.push(Line { hz: l.hz + k * jhd, w: l.w / 3.0 });
                        }
                    }
                    lines = merge_lines(next, 0.05);
                }
                let _ = partners;
                solvent_drafts.push(Draft { kind: None, sp: 0,
                    sig: NmrSignal { ppm, multiplicity: if nd == 2 { "quint".into() } else { "s".into() }, j_hz: if nd > 0 { vec![jhd] } else { vec![] }, integration: 0.0, nuclei: 1, assignment: label.into(), species: solvent.name().into(), species_id: String::new(), exchangeable: false, solvent: true, width_hz: 0.9, snr: 0.0, ppm_lo: ppm, ppm_hi: ppm },
                    lines,
                    area: conc_h,
                });
            }
        }
        Nucleus::C13 => {
            solvent_drafts.push(Draft { kind: None, sp: 0,
                sig: NmrSignal { ppm: 0.0, multiplicity: "s".into(), j_hz: vec![], integration: 0.0, nuclei: 4, assignment: if solvent == Solvent::D2o { "DSS CH3".into() } else { "TMS (reference)".into() }, species: "internal standard".into(), species_id: String::new(), exchangeable: false, solvent: true, width_hz: 1.2, snr: 0.0, ppm_lo: 0.0, ppm_hi: 0.0 },
                lines: vec![Line { hz: 0.0, w: 1.0 }],
                area: 7.34e3 * 3.0e-4 * (1.0 - DILUTION) * 4.0 * C13_SENS * 0.5,
            });
            for (ppm, label, nd, jcd, nc) in solvent.peaks_c13() {
                let mut lines = vec![Line { hz: 0.0, w: 1.0 }];
                for _ in 0..nd {
                    let mut next = Vec::new();
                    for l in &lines {
                        for k in [-1.0, 0.0, 1.0] {
                            next.push(Line { hz: l.hz + k * jcd, w: l.w / 3.0 });
                        }
                    }
                    lines = merge_lines(next, 0.05);
                }
                let mult = match nd {
                    0 => "s",
                    1 => "t",
                    _ => "sept",
                };
                // J_CD is the 13C-2H coupling, so the lines of the 3-deuteron septet are 1:3:6:7:6:3:1 via the 1:1:1 convolution
                solvent_drafts.push(Draft { kind: None, sp: 0,
                    sig: NmrSignal { ppm, multiplicity: mult.into(), j_hz: if nd > 0 { vec![jcd] } else { vec![] }, integration: 0.0, nuclei: nc as u32, assignment: label.into(), species: solvent.name().into(), species_id: String::new(), exchangeable: false, solvent: true, width_hz: 1.2, snr: 0.0, ppm_lo: ppm, ppm_hi: ppm },
                    lines,
                    area: solvent.molarity() * 1000.0 * (1.0 - DILUTION) * nc * C13_SENS * if nd > 0 { 0.5 } else { 0.35 },
                });
            }
        }
    }
    drafts.extend(solvent_drafts);

    // integration reference: the most abundant C-H species
    let mut ref_conc = 0.0f64;
    for d in &drafts {
        if !d.sig.solvent && !d.sig.exchangeable {
            let per = d.area / d.sig.nuclei.max(1) as f64;
            ref_conc = ref_conc.max(per);
        }
    }
    if ref_conc <= 0.0 {
        ref_conc = drafts.iter().filter(|d| !d.sig.solvent).map(|d| d.area / d.sig.nuclei.max(1) as f64).fold(0.0, f64::max);
    }
    if ref_conc <= 0.0 {
        ref_conc = 1.0;
    }
    for d in drafts.iter_mut() {
        d.sig.integration = d.area / ref_conc;
    }

    // synthesis
    let (range, npts) = match nucleus {
        Nucleus::H1 => (H_RANGE, N_H),
        Nucleus::C13 => (C_RANGE, N_C),
    };
    let dppm = (range.1 - range.0) / (npts as f64 - 1.0);
    let mut buf = vec![0.0f64; npts];
    for d in &drafts {
        for l in &d.lines {
            lorentz_add(&mut buf, range.0, dppm, f0, d.sig.ppm, l.hz, d.area * l.w, d.sig.width_hz);
        }
    }
    let sigma = SIGMA_1SCAN / (scans.max(1) as f64).sqrt();
    // heights for SNR
    for d in drafts.iter_mut() {
        let tallest = d.lines.iter().map(|l| l.w).fold(0.0, f64::max);
        let height = d.area * tallest * 2.0 / (std::f64::consts::PI * d.sig.width_hz);
        d.sig.snr = height / sigma;
    }
    let mut rng = Rng(seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407) | 1);
    for v in buf.iter_mut() {
        *v += sigma * rng.gauss();
    }
    let top = buf.iter().cloned().fold(0.0, f64::max).max(1e-12);
    let intensity: Vec<f32> = buf.iter().map(|v| (*v / top) as f32).collect();

    // signal list: observed ones only, sorted from high to low ppm
    let mut signals: Vec<NmrSignal> = Vec::new();
    for d in drafts {
        if d.sig.snr >= 3.0 {
            signals.push(d.sig);
        } else if !d.sig.solvent {
            unobserved.push(format!("{} {}: {:.2} ppm below the noise (S/N {:.1}); more scans or a more concentrated sample", d.sig.species, d.sig.assignment, d.sig.ppm, d.sig.snr));
        }
    }
    signals.sort_by(|a, b| b.ppm.partial_cmp(&a.ppm).unwrap());
    if unobserved.len() > 12 {
        let n = unobserved.len() - 12;
        unobserved.truncate(12);
        unobserved.push(format!("... and {} more", n));
    }
    NmrSpectrum {
        nucleus: match nucleus {
            Nucleus::H1 => "1H".into(),
            Nucleus::C13 => "13C".into(),
        },
        solvent: solvent.name().into(),
        frequency_mhz: f0,
        scans,
        ppm_start: range.0,
        ppm_step: dppm,
        intensity,
        signals,
        noise_sigma: sigma / top,
        unobserved,
        notes,
        tier: "Estimated".into(),
        method: match nucleus {
            Nucleus::H1 => "1H: additive substituent increments (Curphy-Morrison, Pretsch) from the SMILES graph, typically within 0.2 ppm for simple structures and less for fused heterocycles and polyols; J from connectivity; exact spin simulation for strongly coupled systems".into(),
            Nucleus::C13 => "13C{1H}: Grant-Paul / Lindeman-Adams alkane and Pretsch substituent increments from the SMILES graph, typically within 2-4 ppm; poorer for fused heteroaromatics; C-F coupling".into(),
        },
    }
}

fn pool_label(k: Labile) -> &'static str {
    match k {
        Labile::Water => "water",
        Labile::Alcohol => "O-H (alcohol)",
        Labile::Phenol => "O-H (phenol)",
        Labile::Acid => "O-H (acid)",
        Labile::StrongAcid => "H-X (strong acid)",
        Labile::Amine => "N-H (amine)",
        Labile::Aniline => "N-H (aniline)",
        Labile::Amide => "N-H (amide)",
        Labile::PrimaryAmide => "N-H2 (amide)",
        Labile::Anilide => "N-H (anilide)",
        Labile::Ammonium => "N-H (ammonium)",
        Labile::Thiol => "S-H",
        Labile::ArylThiol => "S-H (aryl)",
        Labile::AromNH => "N-H (aromatic)",
        Labile::Oxime => "O-H (oxime)",
        Labile::Other => "X-H",
    }
}
