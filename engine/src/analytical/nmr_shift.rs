//! Additive chemical-shift models over the molecular graph.
//!
//! 1H: Curphy-Morrison alkyl increments (alpha/beta, compressed when several alpha groups act on one carbon), Pretsch
//! alkene (5.25 + Z_gem + Z_cis + Z_trans) and benzene (7.26 + Z_ortho/meta/para) increments, ring-heteroatom increments
//! for pyridine-type and five-membered heteroaromatic rings, and solvent-dependent shifts of exchangeable protons.
//! 13C: Grant-Paul/Lindeman-Adams alkane increments with branching corrections, substituent alpha/beta/gamma increments,
//! Pretsch alkene and benzene substituent-chemical-shift tables, class values for carbonyl and nitrile carbons.
//!
//! All of it is group-additivity (tier Estimated): typical errors are 0.1-0.3 ppm for 1H and 2-4 ppm for 13C.

use super::graph::Mol;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Grp {
    Alkyl,
    Vinyl,
    Alkynyl,
    Aryl,
    Ketone,
    Aldehyde,
    Ester,
    Acid,
    Carboxylate,
    Amide,
    AcylHalide,
    Nitrile,
    Imine,
    Hydroxyl,
    Ether,
    ArylEther,
    Acyloxy,
    Alkoxide,
    Amine,
    ArylAmine,
    Amido,
    Ammonium,
    Nitro,
    NOther,
    Thiol,
    Thioether,
    Sulfoxide,
    Sulfonyl,
    F,
    Cl,
    Br,
    I,
    Other,
}

fn is_carbonyl(g: &Mol, c: usize, except: Option<usize>) -> bool {
    g.atoms[c].el == "C" && g.double_to(c, "O", except)
}

/// Kind of the group whose first atom is `y` when it hangs on atom `from`.
pub fn classify(g: &Mol, y: usize, from: usize) -> Grp {
    let a = &g.atoms[y];
    let others: Vec<usize> = g.nbrs(y).filter(|&k| k != from).collect();
    match a.el.as_str() {
        "C" => {
            if a.arom {
                return Grp::Aryl;
            }
            if let Some(t) = g.triple_bonded(y) {
                return if g.atoms[t].el == "N" { Grp::Nitrile } else { Grp::Alkynyl };
            }
            if g.double_to(y, "O", None) {
                let rest: Vec<usize> = others.iter().copied().filter(|&k| !((g.bond(y, k) == Some(2.0)) && g.atoms[k].el == "O")).collect();
                if rest.is_empty() {
                    return Grp::Aldehyde;
                }
                let o_n_count = rest.iter().filter(|&&k| matches!(g.atoms[k].el.as_str(), "O" | "N")).count();
                for &k in &rest {
                    match g.atoms[k].el.as_str() {
                        "O" => {
                            if g.atoms[k].charge < 0 {
                                return Grp::Carboxylate;
                            }
                            if g.heavy_degree(k) == 1 && g.atoms[k].h > 0 {
                                return Grp::Acid;
                            }
                            return Grp::Ester;
                        }
                        "N" => return if o_n_count > 0 { Grp::Amide } else { Grp::Amide },
                        "F" | "Cl" | "Br" | "I" => return Grp::AcylHalide,
                        "S" => return Grp::Ester,
                        _ => {}
                    }
                }
                return Grp::Ketone;
            }
            if g.double_to(y, "N", None) {
                return Grp::Imine;
            }
            if g.double_to(y, "S", None) {
                return Grp::Other;
            }
            if g.has_double(y) {
                return Grp::Vinyl;
            }
            Grp::Alkyl
        }
        "O" => {
            if a.charge < 0 {
                return Grp::Alkoxide;
            }
            if others.is_empty() {
                return Grp::Hydroxyl;
            }
            let o = others[0];
            match g.atoms[o].el.as_str() {
                "C" => {
                    if g.atoms[o].arom {
                        Grp::ArylEther
                    } else if is_carbonyl(g, o, Some(y)) {
                        Grp::Acyloxy
                    } else {
                        Grp::Ether
                    }
                }
                "S" | "P" | "N" => Grp::Acyloxy,
                _ => Grp::Ether,
            }
        }
        "N" => {
            let o_count = others.iter().filter(|&&k| g.atoms[k].el == "O").count();
            if a.charge > 0 && o_count >= 2 || (o_count >= 1 && a.charge > 0 && g.double_to(y, "O", None)) {
                return Grp::Nitro;
            }
            if a.charge > 0 {
                return Grp::Ammonium;
            }
            if a.arom {
                return Grp::NOther;
            }
            if others.iter().any(|&k| is_carbonyl(g, k, Some(y)) || (g.atoms[k].el == "S" && g.double_to(k, "O", None))) {
                return Grp::Amido;
            }
            if others.iter().any(|&k| g.atoms[k].arom) {
                return Grp::ArylAmine;
            }
            if g.has_double(y) || g.triple_bonded(y).is_some() || o_count > 0 {
                return Grp::NOther;
            }
            Grp::Amine
        }
        "S" => {
            let n_o = g.adj[y].iter().filter(|&&(k, o)| g.atoms[k].el == "O" && o >= 2.0 - 1e-9).count();
            if a.arom {
                Grp::Other
            } else if n_o >= 2 {
                Grp::Sulfonyl
            } else if n_o == 1 {
                Grp::Sulfoxide
            } else if others.is_empty() {
                Grp::Thiol
            } else {
                Grp::Thioether
            }
        }
        "F" => Grp::F,
        "Cl" => Grp::Cl,
        "Br" => Grp::Br,
        "I" => Grp::I,
        _ => Grp::Other,
    }
}

// ------------------------------------------------------------------------------------------------------ 1H, sp3 carbon

fn alpha_h(g: Grp, n_h: u32) -> f64 {
    let methyl = n_h >= 3;
    match g {
        Grp::Alkyl => 0.0,
        Grp::Vinyl => if methyl { 0.85 } else { 0.60 },
        Grp::Alkynyl => 0.9,
        Grp::Aryl => 1.40,
        Grp::Ketone => 1.30,
        Grp::Aldehyde => 1.32,
        Grp::Ester => 1.15,
        Grp::Acid => 1.15,
        Grp::Carboxylate => 1.0,
        Grp::Amide => 1.0,
        Grp::AcylHalide => 1.8,
        Grp::Nitrile => 1.1,
        Grp::Imine => 1.1,
        Grp::Hydroxyl => 2.40,
        Grp::Ether => 2.25,
        Grp::ArylEther => 3.1,
        Grp::Acyloxy => 3.05,
        Grp::Alkoxide => 2.1,
        Grp::Amine => 1.45,
        Grp::ArylAmine => 2.05,
        Grp::Amido => 2.05,
        Grp::Ammonium => 2.3,
        Grp::Nitro => 3.45,
        Grp::NOther => 1.5,
        Grp::Thiol => 1.1,
        Grp::Thioether => 1.3,
        Grp::Sulfoxide => 1.7,
        Grp::Sulfonyl => 2.1,
        Grp::F => if methyl { 3.4 } else { 3.2 },
        Grp::Cl => if methyl { 2.2 } else { 2.4 },
        Grp::Br => if methyl { 1.8 } else { 2.2 },
        Grp::I => if methyl { 1.3 } else { 1.9 },
        Grp::Other => 0.5,
    }
}

fn beta_h(g: Grp) -> f64 {
    match g {
        Grp::Alkyl => 0.0,
        Grp::Vinyl => 0.25,
        Grp::Alkynyl => 0.3,
        Grp::Aryl => 0.35,
        Grp::Ketone => 0.25,
        Grp::Aldehyde => 0.3,
        Grp::Ester => 0.30,
        Grp::Acid => 0.25,
        Grp::Carboxylate => 0.1,
        Grp::Amide => 0.25,
        Grp::AcylHalide => 0.3,
        Grp::Nitrile => 0.35,
        Grp::Imine => 0.2,
        Grp::Hydroxyl => 0.35,
        Grp::Ether => 0.30,
        Grp::ArylEther => 0.4,
        Grp::Acyloxy => 0.38,
        Grp::Alkoxide => 0.1,
        Grp::Amine => 0.20,
        Grp::ArylAmine => 0.3,
        Grp::Amido => 0.35,
        Grp::Ammonium => 0.5,
        Grp::Nitro => 0.9,
        Grp::NOther => 0.2,
        Grp::Thiol => 0.45,
        Grp::Thioether => 0.4,
        Grp::Sulfoxide => 0.5,
        Grp::Sulfonyl => 0.5,
        Grp::F => 0.3,
        Grp::Cl => 0.6,
        Grp::Br => 0.8,
        Grp::I => 1.0,
        Grp::Other => 0.1,
    }
}

fn compress(sum: f64, knee: f64, slope: f64) -> f64 {
    if sum > knee { knee + slope * (sum - knee) } else { sum }
}

fn ring_correction_h(size: usize) -> f64 {
    match size {
        3 => -1.0,
        4 => 0.7,
        5 => 0.25,
        6 => 0.18,
        7 => 0.25,
        _ => 0.0,
    }
}

/// Shift of an sp3 C-H proton.
pub fn sp3_h_shift(g: &Mol, i: usize) -> f64 {
    let nh = g.atoms[i].h;
    let base = match nh {
        3 | 4 => 0.88,
        2 => 1.25,
        _ => 1.55,
    };
    let mut alpha = 0.0;
    let mut beta = 0.0;
    let mut n_beta = 0;
    let mut n_alpha = 0;
    for y in g.nbrs(i) {
        let grp = classify(g, y, i);
        if grp != Grp::Alkyl {
            n_alpha += 1;
        }
        alpha += alpha_h(grp, nh);
        if grp == Grp::NOther && g.atoms[y].arom {
            alpha += 1.25; // N-alkyl on a pyrrole-type ring nitrogen (N-methylimidazole 3.6 ppm)
        }
        if grp == Grp::Ester && g.nbrs(y).any(|o| g.atoms[o].el == "O" && g.heavy_degree(o) == 2 && g.nbrs(o).any(|c| g.atoms[c].arom)) {
            alpha += 0.25; // acetate of a phenol (phenyl acetate CH3 2.29)
        }
        if matches!(grp, Grp::Ketone | Grp::Ester | Grp::Amide | Grp::Acid) {
            let conj = g.nbrs(y).filter(|&z| z != i).any(|z| matches!(classify(g, z, y), Grp::Aryl | Grp::Vinyl));
            if conj {
                alpha += if grp == Grp::Ketone { 0.40 } else { 0.15 };
            }
        }
        if grp == Grp::Alkyl {
            for z in g.nbrs(y).filter(|&z| z != i) {
                let b = beta_h(classify(g, z, y));
                if b > 0.05 {
                    n_beta += 1;
                }
                beta += b;
            }
        }
    }
    let ring = g.ring_size(i);
    base + if n_alpha >= 2 { compress(alpha, 2.3, 0.7) } else { alpha } + if n_beta >= 3 { compress(beta, 0.5, 0.3) } else { compress(beta, 1.0, 0.6) } + if ring > 0 { ring_correction_h(ring) } else { 0.0 }
}

// ------------------------------------------------------------------------------------------------------ 1H, alkene

/// (gem, cis, trans) increments of a substituent on an alkene carbon (Pretsch).
fn alkene_z(g: &Mol, c: usize, y: usize, ring_member: bool) -> (f64, f64, f64) {
    let grp = classify(g, y, c);
    match grp {
        Grp::Alkyl => {
            // CH2X substituents act more strongly
            let hetero = g.nbrs(y).filter(|&z| z != c).map(|z| classify(g, z, y)).collect::<Vec<_>>();
            if hetero.iter().any(|h| matches!(h, Grp::Cl | Grp::Br)) {
                (0.70, 0.11, -0.04)
            } else if hetero.iter().any(|h| matches!(h, Grp::Hydroxyl | Grp::Ether | Grp::Acyloxy | Grp::I)) {
                (0.64, -0.01, -0.02)
            } else if hetero.iter().any(|h| matches!(h, Grp::Amine | Grp::Amido | Grp::ArylAmine)) {
                (0.58, -0.10, -0.08)
            } else if ring_member {
                (0.69, -0.25, -0.28)
            } else {
                (0.45, -0.22, -0.28)
            }
        }
        Grp::Vinyl => (1.00, -0.09, -0.23),
        Grp::Alkynyl => (0.47, 0.38, 0.12),
        Grp::Aryl => (1.38, 0.36, -0.07),
        Grp::Ketone => (1.10, 1.12, 0.87),
        Grp::Aldehyde => (1.03, 0.97, 1.21),
        Grp::Ester => (0.84, 1.15, 0.56),
        Grp::Acid => (1.00, 1.35, 0.74),
        Grp::Carboxylate => (0.8, 1.0, 0.5),
        Grp::Amide => (1.37, 0.98, 0.46),
        Grp::AcylHalide => (1.1, 1.2, 0.9),
        Grp::Nitrile => (0.27, 0.75, 0.55),
        Grp::Imine => (0.9, 0.5, 0.3),
        Grp::Hydroxyl => (1.0, -1.0, -1.1),
        Grp::Ether | Grp::ArylEther => (1.22, -1.07, -1.21),
        Grp::Acyloxy => (2.11, -0.35, -0.64),
        Grp::Alkoxide => (0.6, -1.2, -1.3),
        Grp::Amine | Grp::ArylAmine => (0.80, -1.26, -1.21),
        Grp::Amido => (2.08, -0.57, -0.72),
        Grp::Ammonium => (1.5, 0.0, 0.0),
        Grp::Nitro => (1.87, 1.30, 0.62),
        Grp::NOther => (0.8, -0.3, -0.3),
        Grp::Thiol | Grp::Thioether => (1.11, -0.29, -0.13),
        Grp::Sulfoxide | Grp::Sulfonyl => (1.55, 1.16, 0.93),
        Grp::F => (1.54, -0.40, -1.02),
        Grp::Cl => (1.08, 0.18, 0.13),
        Grp::Br => (1.07, 0.45, 0.55),
        Grp::I => (1.14, 0.81, 0.88),
        Grp::Other => (0.2, 0.0, 0.0),
    }
}

/// Shifts of the protons of an alkene carbon: one value for a =CH-, two (cis-to-substituent, trans-to-substituent) for =CH2.
pub fn alkene_h_shifts(g: &Mol, c: usize) -> Vec<f64> {
    let d = g.adj[c].iter().find(|&&(k, o)| (o - 2.0).abs() < 1e-9 && g.atoms[k].el == "C").map(|&(k, _)| k);
    let Some(d) = d else { return vec![5.25] };
    let in_ring = g.ring_bond(c, d) && g.ring_size_of_bond(c, d).map_or(false, |s| s <= 7);
    let ring_atoms = if in_ring { g.smallest_ring_through(c, d) } else { Vec::new() };
    let mut gem = 0.0;
    for y in g.nbrs(c).filter(|&y| y != d) {
        gem += alkene_z(g, c, y, ring_atoms.contains(&y)).0;
    }
    let subs: Vec<usize> = g.nbrs(d).filter(|&y| y != c).collect();
    let nh = g.atoms[c].h;
    if nh >= 2 {
        // =CH2: the two protons differ by which side of the double bond the substituent(s) of the other carbon are on
        let z = |y: usize, cis: bool| {
            let t = alkene_z(g, d, y, false);
            if cis { t.1 } else { t.2 }
        };
        let (a, b) = match subs.len() {
            0 => (0.0, 0.0),
            1 => (z(subs[0], true), z(subs[0], false)),
            _ => (z(subs[0], true) + z(subs[1], false), z(subs[1], true) + z(subs[0], false)),
        };
        return vec![5.25 + gem + a, 5.25 + gem + b];
    }
    // =CH-R(R'): ring substituents are cis, exocyclic ones trans; two free substituents are averaged over E/Z
    let place = |y: usize, cis: bool| {
        let t = alkene_z(g, d, y, ring_atoms.contains(&y));
        if cis { t.1 } else { t.2 }
    };
    let mut z = 0.0;
    match subs.len() {
        0 => {}
        1 => {
            let y = subs[0];
            z = if ring_atoms.contains(&y) { place(y, true) } else { place(y, false) };
        }
        _ => {
            let (a, b) = (subs[0], subs[1]);
            let (ra, rb) = (ring_atoms.contains(&a), ring_atoms.contains(&b));
            z = if ra && !rb {
                place(a, true) + place(b, false)
            } else if rb && !ra {
                place(b, true) + place(a, false)
            } else {
                0.5 * (place(a, true) + place(b, false) + place(b, true) + place(a, false))
            };
        }
    }
    vec![5.25 + gem + z]
}

// ------------------------------------------------------------------------------------------------------ 1H, aromatic

/// (ortho, meta, para) 1H increments of a ring substituent (Pretsch).
fn arom_z_h(g: &Mol, ring_atom: usize, y: usize) -> (f64, f64, f64) {
    let grp = classify(g, y, ring_atom);
    match grp {
        Grp::Alkyl => {
            if g.atoms[y].h >= 3 {
                (-0.18, -0.10, -0.20)
            } else if g.nbrs(y).filter(|&z| z != ring_atom).any(|z| matches!(classify(g, z, y), Grp::Hydroxyl | Grp::Ether | Grp::Cl | Grp::Br | Grp::I | Grp::Acyloxy)) {
                (-0.07, -0.07, -0.07)
            } else {
                (-0.14, -0.06, -0.17)
            }
        }
        Grp::Vinyl => (0.06, -0.03, -0.10),
        Grp::Alkynyl => (0.15, -0.02, -0.01),
        Grp::Aryl => (0.37, 0.20, 0.10),
        Grp::Ketone => (0.62, 0.14, 0.21),
        Grp::Aldehyde => (0.56, 0.22, 0.29),
        Grp::Ester => (0.71, 0.11, 0.21),
        Grp::Acid => (0.85, 0.18, 0.27),
        Grp::Carboxylate => (0.62, 0.10, 0.15),
        Grp::Amide => (0.61, 0.10, 0.17),
        Grp::AcylHalide => (0.84, 0.30, 0.45),
        Grp::Nitrile => (0.36, 0.18, 0.28),
        Grp::Imine => (0.3, 0.1, 0.1),
        Grp::Hydroxyl => (-0.56, -0.12, -0.45),
        Grp::Ether => (-0.48, -0.09, -0.44),
        Grp::ArylEther => (-0.3, -0.05, -0.2),
        Grp::Acyloxy => (-0.25, 0.03, -0.13),
        Grp::Alkoxide => (-0.8, -0.2, -0.7),
        Grp::Amine => {
            if g.atoms[y].h >= 2 { (-0.75, -0.25, -0.65) } else { (-0.66, -0.18, -0.67) }
        }
        Grp::ArylAmine => (-0.5, -0.1, -0.4),
        Grp::Amido => (0.21, -0.25, -0.13),
        Grp::Ammonium => (0.69, 0.36, 0.31),
        Grp::Nitro => (0.95, 0.26, 0.38),
        Grp::NOther => (0.0, 0.0, 0.0),
        Grp::Thiol => (-0.08, -0.10, -0.24),
        Grp::Thioether => (-0.08, -0.10, -0.24),
        Grp::Sulfoxide => (0.5, 0.2, 0.3),
        Grp::Sulfonyl => (0.8, 0.2, 0.3),
        Grp::F => (-0.26, 0.0, -0.20),
        Grp::Cl => (0.03, -0.02, -0.09),
        Grp::Br => (0.18, -0.08, -0.04),
        Grp::I => (0.39, -0.21, 0.0),
        Grp::Other => (0.0, 0.0, 0.0),
    }
}

/// The aromatic ring (atom list in ring order) of aromatic atom `i`: smallest ring in which every atom is aromatic.
pub fn aromatic_ring(g: &Mol, i: usize) -> Vec<usize> {
    let mut best: Vec<usize> = Vec::new();
    for &(j, o) in &g.adj[i] {
        if (o - 1.5).abs() > 1e-9 {
            continue;
        }
        let r = g.smallest_ring_through(i, j);
        if !r.is_empty() && r.iter().all(|&k| g.atoms[k].arom) && (best.is_empty() || r.len() < best.len()) {
            best = r;
        }
    }
    best
}

fn ring_hetero(g: &Mol, a: usize) -> bool {
    g.atoms[a].el != "C"
}

/// Shift of an aromatic C-H proton.
pub fn aromatic_h_shift(g: &Mol, i: usize) -> f64 {
    let ring = aromatic_ring(g, i);
    if ring.len() < 5 {
        return 7.33;
    }
    let n = ring.len();
    let pos = ring.iter().position(|&x| x == i).unwrap();
    // ring distance to every other atom
    let dist = |k: usize| -> usize {
        let p = ring.iter().position(|&x| x == k).unwrap();
        let d = (p + n - pos) % n;
        d.min(n - d)
    };
    let hetero: Vec<usize> = ring.iter().copied().filter(|&a| ring_hetero(g, a)).collect();
    let mut shift;
    if n == 6 {
        shift = 7.33;
        for &a in &hetero {
            let d = dist(a);
            // pyridine-type nitrogen (no H, not charged) or N-oxide / pyridinium
            let cationic = g.atoms[a].charge > 0 || g.atoms[a].h > 0;
            let inc = match (cationic, d) {
                (false, 1) => 1.27,
                (false, 2) => -0.08,
                (false, 3) => 0.31,
                (true, 1) => 1.7,
                (true, 2) => 0.9,
                (true, _) => 1.3,
                _ => 0.0,
            };
            shift += inc;
        }
    } else {
        // five-membered heteroaromatic: alpha / beta positions relative to the heteroatoms
        let (mut best_alpha, mut best_beta) = (7.2, 6.8);
        let mut kinds: Vec<(usize, &str, bool)> = Vec::new();
        for &a in &hetero {
            let pyr = g.atoms[a].h == 0 && g.atoms[a].el == "N" && g.heavy_degree(a) == 2 && !g.nbrs(a).any(|k| !g.atoms[k].arom);
            kinds.push((dist(a), g.atoms[a].el.as_str(), pyr));
        }
        for &(_, el, _) in &kinds {
            match el {
                "O" => {
                    best_alpha = 7.40;
                    best_beta = 6.30;
                }
                "S" => {
                    best_alpha = 7.25;
                    best_beta = 7.05;
                }
                "N" => {
                    best_alpha = 6.70;
                    best_beta = 6.15;
                }
                _ => {}
            }
        }
        let adjacent = kinds.iter().filter(|(d, _, _)| *d == 1).count();
        shift = if adjacent > 0 { best_alpha } else { best_beta };
        if adjacent >= 2 {
            shift += 0.8; // between two heteroatoms (imidazole C2, thiazole C2)
        }
        if kinds.len() > 1 {
            // an additional pyridine-type nitrogen deshields the ring
            for &(d, _, pyr) in &kinds {
                if pyr {
                    shift += if d == 1 { 0.55 } else { 0.35 };
                }
            }
            if kinds.iter().any(|k| !k.2 && k.1 == "N") {
                shift += 0.3;
            }
        }
    }
    // substituents on the ring atoms (and fused rings, which act like aryl substituents)
    let scale = if n == 6 { 1.0 } else { 0.8 };
    for &a in &ring {
        if a == i {
            continue;
        }
        let d = dist(a);
        for y in g.nbrs(a) {
            if ring.contains(&y) {
                continue;
            }
            let z = arom_z_h(g, a, y);
            let v = match d {
                1 => z.0,
                2 => z.1,
                _ => z.2,
            };
            shift += scale * v;
        }
    }
    shift
}

// ------------------------------------------------------------------------------------------------------ exchangeable protons

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Labile {
    Water,
    Alcohol,
    Phenol,
    Acid,
    Amine,
    Aniline,
    Amide,
    PrimaryAmide,
    Anilide,
    Ammonium,
    Thiol,
    ArylThiol,
    AromNH,
    Oxime,
    StrongAcid,
    Other,
}

/// Which exchangeable-proton class atom `i` (O, N, S or a halogen carrying hydrogen) belongs to.
pub fn labile_class(g: &Mol, i: usize) -> Option<Labile> {
    let a = &g.atoms[i];
    if a.h == 0 {
        return None;
    }
    let nb: Vec<usize> = g.nbrs(i).collect();
    match a.el.as_str() {
        "O" => {
            if nb.is_empty() {
                return Some(Labile::Water);
            }
            let c = nb[0];
            Some(match g.atoms[c].el.as_str() {
                "C" => {
                    if g.atoms[c].arom {
                        Labile::Phenol
                    } else if is_carbonyl(g, c, Some(i)) {
                        Labile::Acid
                    } else if g.double_to(c, "N", None) {
                        Labile::Oxime
                    } else {
                        Labile::Alcohol
                    }
                }
                "S" | "P" => Labile::StrongAcid,
                "N" => Labile::Oxime,
                _ => Labile::Other,
            })
        }
        "N" => {
            if a.arom {
                return Some(Labile::AromNH);
            }
            if a.charge > 0 {
                return Some(Labile::Ammonium);
            }
            if nb.iter().any(|&k| is_carbonyl(g, k, Some(i))) {
                if nb.iter().any(|&k| g.atoms[k].arom) {
                    return Some(Labile::Anilide);
                }
                return Some(if a.h >= 2 { Labile::PrimaryAmide } else { Labile::Amide });
            }
            if nb.iter().any(|&k| g.atoms[k].arom) {
                return Some(Labile::Aniline);
            }
            Some(Labile::Amine)
        }
        "S" => Some(if nb.iter().any(|&k| g.atoms[k].arom) { Labile::ArylThiol } else { Labile::Thiol }),
        "F" | "Cl" | "Br" | "I" => Some(Labile::StrongAcid),
        _ => None,
    }
}

/// Solvent index into the exchangeable-proton tables: CDCl3, DMSO-d6, acetone-d6, C6D6, CD3CN.
pub fn labile_shift(kind: Labile, s: usize) -> f64 {
    let t: [f64; 5] = match kind {
        Labile::Water => [1.56, 3.33, 2.84, 0.40, 2.13],
        Labile::Alcohol => [1.9, 4.4, 3.1, 1.5, 2.5],
        Labile::Phenol => [5.0, 9.4, 8.2, 4.4, 6.9],
        Labile::Acid => [11.0, 12.1, 11.2, 11.0, 10.8],
        Labile::Amine => [1.3, 1.9, 1.7, 0.6, 1.6],
        Labile::Aniline => [3.6, 5.1, 4.6, 2.8, 4.0],
        Labile::Amide => [6.0, 7.9, 7.1, 5.0, 6.6],
        Labile::PrimaryAmide => [5.8, 7.3, 6.6, 5.0, 6.3],
        Labile::Anilide => [7.8, 9.9, 9.2, 7.0, 8.3],
        Labile::Ammonium => [7.5, 7.3, 7.4, 7.0, 7.2],
        Labile::Thiol => [1.4, 2.4, 1.9, 1.0, 1.9],
        Labile::ArylThiol => [3.4, 5.5, 4.4, 2.8, 4.0],
        Labile::AromNH => [8.1, 11.0, 10.0, 7.2, 9.3],
        Labile::Oxime => [8.5, 10.8, 10.0, 7.5, 9.5],
        Labile::StrongAcid => [10.5, 12.5, 11.8, 10.0, 11.0],
        Labile::Other => [3.0, 5.0, 4.0, 2.5, 4.0],
    };
    t[s.min(4)]
}

/// Typical line width of an exchangeable proton signal, Hz.
pub fn labile_width_hz(kind: Labile) -> f64 {
    match kind {
        Labile::Water => 4.0,
        Labile::Alcohol | Labile::Thiol | Labile::ArylThiol => 12.0,
        Labile::Phenol | Labile::Oxime => 18.0,
        Labile::Acid | Labile::StrongAcid => 45.0,
        Labile::Amine | Labile::Aniline => 25.0,
        Labile::Amide | Labile::PrimaryAmide | Labile::Anilide => 20.0,
        Labile::Ammonium => 50.0,
        Labile::AromNH => 20.0,
        Labile::Other => 20.0,
    }
}

// ------------------------------------------------------------------------------------------------------ 13C

/// 13C alkane increments: counts of alkyl carbons at topological distance 1..4 from `i` through alkyl (sp3 carbon) atoms.
fn alkyl_counts(g: &Mol, i: usize) -> [usize; 5] {
    let n = g.n();
    let mut dist = vec![usize::MAX; n];
    dist[i] = 0;
    let mut q = std::collections::VecDeque::new();
    q.push_back(i);
    let mut counts = [0usize; 5];
    while let Some(u) = q.pop_front() {
        if dist[u] >= 4 {
            continue;
        }
        for v in g.nbrs(u) {
            if dist[v] != usize::MAX {
                continue;
            }
            if classify(g, v, u) != Grp::Alkyl {
                continue;
            }
            dist[v] = dist[u] + 1;
            counts[dist[v]] += 1;
            q.push_back(v);
        }
    }
    counts
}

/// (alpha, beta, gamma) 13C increments of a substituent replacing H on an alkane.
fn sub_c13(g: &Mol, y: usize, grp: Grp) -> (f64, f64, f64) {
    match grp {
        Grp::Alkyl => (0.0, 0.0, 0.0),
        Grp::Vinyl => (20.0, 6.0, -0.5),
        Grp::Alkynyl => (4.5, 5.5, -3.5),
        Grp::Aryl => (23.0, 9.0, -2.0),
        Grp::Ketone => (22.0, 3.0, -3.0),
        Grp::Aldehyde => (29.0, -0.5, -2.5),
        Grp::Ester => (23.0, 2.0, -3.0),
        Grp::Acid => (23.0, 2.0, -3.0),
        Grp::Carboxylate => (24.0, 2.0, -3.0),
        Grp::Amide => (23.0, 2.0, -3.0),
        Grp::AcylHalide => (33.0, 2.0, -3.0),
        Grp::Nitrile => (3.0, 3.0, -3.0),
        Grp::Imine => (20.0, 2.0, -2.0),
        Grp::Hydroxyl => (49.0, 10.0, -6.0),
        Grp::Ether => (58.0, 8.0, -4.0),
        Grp::ArylEther => (58.0, 6.0, -4.0),
        Grp::Acyloxy => (51.0, 6.0, -3.0),
        Grp::Alkoxide => (65.0, 6.0, -4.0),
        Grp::Amine => match g.atoms[y].h {
            2 => (28.0, 11.0, -5.0),
            1 => (37.0, 8.0, -4.0),
            _ => (42.0, 6.0, -3.0),
        },
        Grp::ArylAmine => (42.0, 0.0, -3.0),
        Grp::Amido => (28.0, 5.0, -4.0),
        Grp::Ammonium => (53.0, 7.0, -4.0),
        Grp::Nitro => (63.0, 4.0, -4.0),
        Grp::NOther => (30.0, 5.0, -3.0),
        Grp::Thiol => (11.0, 12.0, -4.0),
        Grp::Thioether => (20.0, 7.0, -3.0),
        Grp::Sulfoxide => (43.0, 2.0, -3.0),
        Grp::Sulfonyl => (45.0, 2.0, -3.0),
        Grp::F => (68.0, 9.0, -4.0),
        Grp::Cl => (31.0, 11.0, -4.0),
        Grp::Br => (20.0, 11.0, -3.0),
        Grp::I => (-6.0, 11.0, -1.0),
        Grp::Other => (10.0, 3.0, -1.0),
    }
}

fn ring_correction_c(size: usize) -> f64 {
    match size {
        3 => -18.7,
        4 => -2.9,
        5 => -8.8,
        6 => -5.1,
        7 => -1.0,
        _ => 0.0,
    }
}

/// Branching degree of a carbon: number of carbon neighbours.
fn c_degree(g: &Mol, i: usize) -> usize {
    g.heavy_degree(i)
}

pub fn sp3_c13_shift(g: &Mol, i: usize) -> f64 {
    let cnt = alkyl_counts(g, i);
    let mut s = -2.3 + 9.1 * cnt[1] as f64 + 9.4 * cnt[2] as f64 - 2.5 * cnt[3] as f64 + 0.3 * cnt[4] as f64;
    // steric corrections for branching (Lindeman-Adams)
    let di = c_degree(g, i);
    for y in g.nbrs(i).filter(|&y| classify(g, y, i) == Grp::Alkyl) {
        let dy = c_degree(g, y);
        let corr = match (di, dy) {
            (1, 3) => -1.1,
            (1, 4) => -3.4,
            (2, 3) => -2.5,
            (2, 4) => -7.5,
            (3, 2) => -3.7,
            (3, 3) => -9.5,
            (4, 1) => -1.5,
            (4, 2) => -8.4,
            _ => 0.0,
        };
        s += corr;
    }
    // functional groups at alpha / beta / gamma positions
    let mut alphas: Vec<f64> = Vec::new();
    let (mut beta, mut gamma, mut beyond) = (0.0, 0.0, 0.0);
    // BFS over alkyl atoms recording depth
    let mut depth = vec![usize::MAX; g.n()];
    depth[i] = 0;
    let mut q = std::collections::VecDeque::new();
    q.push_back(i);
    while let Some(u) = q.pop_front() {
        let du = depth[u];
        for v in g.nbrs(u) {
            let grp = classify(g, v, u);
            if grp == Grp::Alkyl {
                if depth[v] == usize::MAX && du < 2 {
                    depth[v] = du + 1;
                    q.push_back(v);
                }
                continue;
            }
            let (a, b, c) = sub_c13(g, v, grp);
            match du {
                0 => alphas.push(a),
                1 => beta += b,
                2 => gamma += c,
                _ => {}
            }
            // carbons on the far side of a carbonyl-type group sit one bond further out than the group itself
            if matches!(grp, Grp::Ketone | Grp::Aldehyde | Grp::Ester | Grp::Acid | Grp::Amide | Grp::AcylHalide | Grp::Imine) && du <= 1 {
                for w in g.nbrs(v).filter(|&w| w != u && g.atoms[w].el == "C") {
                    match classify(g, w, v) {
                        Grp::Alkyl => {
                            if du == 0 {
                                beyond += 9.4;
                                beyond += -2.5 * g.nbrs(w).filter(|&x| x != v && classify(g, x, w) == Grp::Alkyl).count() as f64;
                            } else {
                                beyond += -2.5;
                            }
                        }
                        Grp::Aryl | Grp::Vinyl | Grp::Alkynyl => beyond += if du == 0 { 7.0 } else { -2.0 },
                        _ => {}
                    }
                }
            }
        }
    }
    alphas.sort_by(|a, b| b.partial_cmp(a).unwrap());
    let mut f = 1.0;
    for a in alphas {
        s += a * f;
        f *= 0.8;
    }
    s += beta + gamma + beyond;
    let ring = g.ring_size(i);
    if ring > 0 {
        s += ring_correction_c(ring);
    }
    s
}

/// Alkene carbon (non-carbonyl sp2 C=C): Pretsch increments.
pub fn alkene_c13_shift(g: &Mol, c: usize) -> f64 {
    let d = g.adj[c].iter().find(|&&(k, o)| (o - 2.0).abs() < 1e-9 && g.atoms[k].el == "C").map(|&(k, _)| k);
    let Some(d) = d else { return 123.3 };
    let mut s = 123.3;
    let side = |from: usize, other: usize, alpha_side: bool, s: &mut f64| {
        for y in g.nbrs(from).filter(|&y| y != other) {
            let grp = classify(g, y, from);
            let (za, zb) = match grp {
                Grp::Alkyl => (10.6, -7.9),
                Grp::Vinyl => (13.6, -7.0),
                Grp::Alkynyl => (-6.0, 6.0),
                Grp::Aryl => (12.5, -11.0),
                Grp::Ketone => (14.0, 5.5),
                Grp::Aldehyde => (13.1, 12.7),
                Grp::Ester => (6.3, 7.0),
                Grp::Acid => (5.0, 9.0),
                Grp::Carboxylate => (6.0, 8.0),
                Grp::Amide => (7.0, 6.0),
                Grp::Nitrile => (-15.1, 14.2),
                Grp::Hydroxyl => (22.0, -34.0),
                Grp::Ether | Grp::ArylEther => (28.8, -39.5),
                Grp::Acyloxy => (18.0, -27.0),
                Grp::Amine | Grp::ArylAmine => (28.0, -32.0),
                Grp::Amido => (25.0, -25.0),
                Grp::Thiol | Grp::Thioether => (19.0, -17.0),
                Grp::F => (24.9, -34.3),
                Grp::Cl => (2.6, -6.1),
                Grp::Br => (-8.0, -0.9),
                Grp::I => (-38.1, 7.0),
                Grp::Nitro => (22.3, -0.9),
                _ => (0.0, 0.0),
            };
            *s += if alpha_side { za } else { zb };
            if grp == Grp::Alkyl {
                // beta (+7.2 / -1.8) and gamma (-1.5 / +1.5) alkyl carbons
                for z in g.nbrs(y).filter(|&z| z != from) {
                    if classify(g, z, y) == Grp::Alkyl {
                        *s += if alpha_side { 7.2 } else { -1.8 };
                        for w in g.nbrs(z).filter(|&w| w != y) {
                            if classify(g, w, z) == Grp::Alkyl {
                                *s += if alpha_side { -1.5 } else { 1.5 };
                            }
                        }
                    }
                }
            }
        }
    };
    side(c, d, true, &mut s);
    side(d, c, false, &mut s);
    // cis correction for ring alkenes (two cis alkyl substituents)
    if let Some(r) = g.ring_size_of_bond(c, d) {
        s += match r {
            3 => -21.0,
            4 => 7.3,
            5 => 0.9,
            6 => -3.0,
            7 => 0.3,
            _ => 0.0,
        };
    }
    s
}

/// Benzene-ring substituent-chemical-shift increments (ipso, ortho, meta, para) of a ring substituent.
fn arom_scs_c(g: &Mol, ring_atom: usize, y: usize) -> (f64, f64, f64, f64) {
    let grp = classify(g, y, ring_atom);
    match grp {
        Grp::Alkyl => match c_degree(g, y).saturating_sub(1) {
            0 => (9.3, 0.7, -0.1, -3.0),
            1 => (15.6, -0.5, 0.0, -2.6),
            2 => (20.1, -2.0, 0.0, -2.5),
            _ => (22.1, -3.4, -0.4, -3.1),
        },
        Grp::Vinyl => (12.5, -1.8, -0.2, -3.5),
        Grp::Alkynyl => (-6.1, 3.8, 0.4, -0.2),
        Grp::Aryl => (13.0, -1.1, 0.5, -1.0),
        Grp::Ketone => (8.9, 0.1, -0.1, 4.4),
        Grp::Aldehyde => (8.2, 1.2, 0.5, 5.8),
        Grp::Ester => (2.0, 1.2, -0.1, 4.3),
        Grp::Acid => (2.1, 1.6, -0.1, 5.2),
        Grp::Carboxylate => (4.0, 1.0, 0.0, 3.0),
        Grp::Amide => (5.0, -1.2, 0.0, 3.4),
        Grp::AcylHalide => (4.6, 2.4, 0.6, 6.2),
        Grp::Nitrile => (-15.7, 3.6, 0.7, 4.3),
        Grp::Imine => (8.0, -1.0, 0.0, 2.0),
        Grp::Hydroxyl => (26.9, -12.7, 1.4, -7.3),
        Grp::Ether => (31.4, -14.4, 1.0, -7.7),
        Grp::ArylEther => (29.0, -9.0, 2.0, -5.5),
        Grp::Acyloxy => (22.4, -7.1, -0.4, -3.2),
        Grp::Alkoxide => (39.0, -14.0, 1.0, -9.0),
        Grp::Amine => match g.atoms[y].h {
            2 => (18.2, -13.4, 0.8, -10.0),
            1 => (21.0, -14.0, 0.9, -11.0),
            _ => (22.4, -15.7, 0.8, -11.8),
        },
        Grp::ArylAmine => (20.0, -12.0, 0.8, -8.0),
        Grp::Amido => (11.1, -9.9, 0.2, -5.6),
        Grp::Ammonium => (8.0, -4.0, 2.0, 2.0),
        Grp::Nitro => (20.0, -4.8, 0.9, 5.8),
        Grp::NOther => (10.0, -5.0, 0.5, -3.0),
        Grp::Thiol => (2.2, 0.7, 0.2, -3.1),
        Grp::Thioether => (10.2, -1.8, 0.4, -3.6),
        Grp::Sulfoxide => (20.0, -4.0, 1.0, 1.0),
        Grp::Sulfonyl => (12.3, -1.3, 1.0, 4.9),
        Grp::F => (34.8, -12.9, 1.4, -4.5),
        Grp::Cl => (6.2, 0.4, 1.3, -1.9),
        Grp::Br => (-5.5, 3.4, 1.7, -1.6),
        Grp::I => (-34.1, 8.8, 1.6, -1.0),
        Grp::Other => (0.0, 0.0, 0.0, 0.0),
    }
}

pub fn aromatic_c13_shift(g: &Mol, i: usize) -> f64 {
    let ring = aromatic_ring(g, i);
    if ring.len() < 5 {
        return 128.5;
    }
    let n = ring.len();
    let pos = ring.iter().position(|&x| x == i).unwrap();
    let dist = |k: usize| -> usize {
        let p = ring.iter().position(|&x| x == k).unwrap();
        let d = (p + n - pos) % n;
        d.min(n - d)
    };
    let hetero: Vec<usize> = ring.iter().copied().filter(|&a| g.atoms[a].el != "C").collect();
    let fused = g.nbrs(i).filter(|&k| g.atoms[k].arom && !ring.contains(&k)).count() > 0;
    let mut s = 128.5;
    if n == 6 {
        for &a in &hetero {
            let d = dist(a);
            if d == 0 {
                continue;
            }
            // pyridine: C2 149.9, C3 123.7, C4 135.9
            s += match d {
                1 => 21.4,
                2 => -4.8,
                _ => 7.4,
            };
        }
    } else {
        let mut base_alpha = 128.0;
        let mut base_beta = 127.0;
        for &a in &hetero {
            match g.atoms[a].el.as_str() {
                "O" => {
                    base_alpha = 142.8;
                    base_beta = 109.8;
                }
                "S" => {
                    base_alpha = 125.6;
                    base_beta = 127.3;
                }
                "N" => {
                    base_alpha = 118.4;
                    base_beta = 108.0;
                }
                _ => {}
            }
        }
        let adjacent = hetero.iter().filter(|&&a| dist(a) == 1).count();
        s = if adjacent > 0 { base_alpha } else { base_beta };
        if adjacent >= 2 {
            s += 17.0;
        }
        if hetero.len() > 1 && adjacent < 2 {
            s += 12.0;
        }
    }
    if fused && n == 6 {
        s += 5.0;
    }
    let scale = if n == 6 { 1.0 } else { 0.8 };
    for &a in &ring {
        let d = dist(a);
        for y in g.nbrs(a) {
            if ring.contains(&y) {
                continue;
            }
            let z = arom_scs_c(g, a, y);
            let v = match d {
                0 => z.0,
                1 => z.1,
                2 => z.2,
                _ => z.3,
            };
            s += scale * v;
        }
    }
    s
}

/// 13C shift of a carbonyl carbon from its class and conjugation. (shift, label)
pub fn carbonyl_c13_shift(g: &Mol, c: usize) -> (f64, &'static str) {
    let o_dbl = g.adj[c].iter().find(|&&(k, o)| (o - 2.0).abs() < 1e-9 && g.atoms[k].el == "O").map(|&(k, _)| k);
    let rest: Vec<usize> = g.nbrs(c).filter(|&k| Some(k) != o_dbl).collect();
    let conj = |k: usize| matches!(classify(g, k, c), Grp::Aryl | Grp::Vinyl);
    let n_conj = rest.iter().filter(|&&k| g.atoms[k].el == "C" && conj(k)).count();
    let cls: Vec<Grp> = rest.iter().map(|&k| classify(g, k, c)).collect();
    let n_o = rest.iter().filter(|&&k| g.atoms[k].el == "O").count();
    let n_n = rest.iter().filter(|&&k| g.atoms[k].el == "N").count();
    let n_hal = rest.iter().filter(|&&k| matches!(g.atoms[k].el.as_str(), "F" | "Cl" | "Br" | "I")).count();
    let n_s = rest.iter().filter(|&&k| g.atoms[k].el == "S").count();
    let n_c = rest.iter().filter(|&&k| g.atoms[k].el == "C").count();
    let acid = rest.iter().any(|&k| g.atoms[k].el == "O" && g.heavy_degree(k) == 1 && g.atoms[k].h > 0);
    let carboxylate = rest.iter().any(|&k| g.atoms[k].el == "O" && g.atoms[k].charge < 0);
    // branching at the alpha carbons raises aliphatic ketone / ester carbonyls slightly
    let alpha_branch: f64 = rest
        .iter()
        .filter(|&&k| g.atoms[k].el == "C" && !conj(k))
        .map(|&k| (g.heavy_degree(k) as f64 - 1.0).max(0.0))
        .sum();
    let ring = g.nbrs(c).filter_map(|k| g.ring_size_of_bond(c, k)).min().unwrap_or(0);
    let _ = cls;
    if n_o >= 2 && n_n == 0 && !acid && !carboxylate {
        return (155.0, "carbonate C=O");
    }
    if n_o == 1 && n_n == 1 {
        return (156.5, "carbamate C=O");
    }
    if n_n >= 2 {
        return (160.0, "urea C=O");
    }
    if n_hal >= 2 {
        return (140.0, "C(=O)X2");
    }
    if n_hal == 1 {
        return (170.5 - 4.0 * n_conj as f64, "acyl halide C=O");
    }
    if n_c == 0 && rest.iter().all(|&k| g.atoms[k].el == "H") || rest.is_empty() {
        return (201.0, "aldehyde CHO");
    }
    if rest.len() == 1 && g.atoms[c].h == 1 {
        // formyl: H-C(=O)-X
        let k = rest[0];
        return match g.atoms[k].el.as_str() {
            "C" => (if conj(k) { 192.0 } else { 201.5 }, "aldehyde CHO"),
            "O" => (if acid { 166.0 } else { 161.0 }, "formate C=O"),
            "N" => (162.5, "formamide C=O"),
            _ => (170.0, "formyl C=O"),
        };
    }
    if acid {
        return (178.0 - 6.0 * n_conj as f64 + 1.0 * alpha_branch.min(2.0), "carboxylic acid C=O");
    }
    if carboxylate {
        return (181.5 - 4.0 * n_conj as f64, "carboxylate C=O");
    }
    if n_o == 1 && n_c == 1 {
        let lactone = ring > 0;
        let base = if lactone && ring == 5 { 177.0 } else if lactone && ring == 6 { 171.0 } else { 170.8 };
        return (base - 5.0 * n_conj as f64 + 1.5 * alpha_branch.min(2.0), "ester C=O");
    }
    if n_n == 1 && n_c == 1 {
        let base = if ring == 5 { 175.0 } else if ring == 6 { 171.0 } else { 172.5 };
        return (base - 4.0 * n_conj as f64 + 0.8 * alpha_branch.min(2.0), "amide C=O");
    }
    if n_s >= 1 {
        return (198.0, "thioester C=O");
    }
    // ketone
    let base = 206.5 + 1.6 * alpha_branch.min(4.0) - 9.5 * n_conj as f64;
    let ring_shift = match ring {
        4 => 1.5,
        5 => 11.0,
        6 => 4.5,
        7 => 4.0,
        _ => 0.0,
    };
    (base + ring_shift, "ketone C=O")
}

pub fn alkyne_c13_shift(g: &Mol, c: usize) -> f64 {
    let Some(t) = g.triple_bonded(c) else { return 80.0 };
    let aryl_on = |a: usize| g.nbrs(a).any(|k| k != if a == c { t } else { c } && g.atoms[k].arom);
    let terminal = g.atoms[c].h > 0;
    if terminal {
        if aryl_on(t) { 77.5 } else { 68.5 }
    } else if g.atoms[t].h > 0 {
        if aryl_on(c) { 83.5 } else { 84.0 }
    } else if aryl_on(c) || aryl_on(t) {
        88.0
    } else {
        80.0
    }
}

pub fn nitrile_c13_shift(g: &Mol, c: usize) -> f64 {
    let aryl = g.nbrs(c).any(|k| g.atoms[k].arom);
    if aryl { 118.7 } else { 119.5 }
}
