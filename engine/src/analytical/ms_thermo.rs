//! Group-additive gas-phase ion energetics for the EI fragmentation model: ionisation energies of molecules and radicals,
//! bond dissociation energies, radical stabilisation. Approximate (tier Estimated): a few tenths of an eV.

use super::graph::Mol;

fn n_carbon_nbrs(g: &Mol, a: usize, skip: Option<usize>) -> usize {
    g.nbrs(a).filter(|&k| Some(k) != skip && g.atoms[k].el == "C").count()
}

fn is_donor(el: &str) -> Option<f64> {
    match el {
        "O" => Some(2.3),
        "N" => Some(3.5),
        "S" => Some(2.5),
        "Cl" => Some(1.0),
        "Br" => Some(1.2),
        "I" => Some(1.5),
        "F" => Some(0.5),
        "P" => Some(2.0),
        _ => None,
    }
}

/// Ionisation energy (eV) of the radical centred on atom `a` of fragment graph `x` (the cation's ionisation threshold).
pub fn ie_radical(x: &Mol, a: usize) -> f64 {
    let at = &x.atoms[a];
    match at.el.as_str() {
        "C" => {
            if at.arom {
                // phenyl-type sigma radical; a tolyl-type cation (alkyl on the ring) isomerises to benzyl / tropylium
                let ring_alkyl = x.nbrs(a).any(|r| x.atoms[r].arom && x.nbrs(r).any(|s| !x.atoms[s].arom && x.atoms[s].el == "C" && x.atoms[s].h > 0 && x.is_sp3(s)))
                    || x.nbrs(a).any(|r| x.atoms[r].arom && x.nbrs(r).any(|q| x.atoms[q].arom && x.nbrs(q).any(|s| !x.atoms[s].arom && x.atoms[s].el == "C" && x.atoms[s].h > 0 && x.is_sp3(s))))
                    || x.atoms.iter().enumerate().any(|(i, t)| t.el == "C" && !t.arom && t.h > 0 && x.is_sp3(i) && x.nbrs(i).any(|r| x.atoms[r].arom));
                return if ring_alkyl { 6.7 } else { 8.3 };
            }
            // sp2 / sp centres
            if x.double_to(a, "O", None) {
                return if x.heavy_degree(a) <= 1 { 8.1 } else if x.nbrs(a).any(|k| x.atoms[k].el == "O" && x.bond(a, k) == Some(1.0)) { 8.0 } else { 7.0 };
            }
            if x.double_to(a, "N", None) {
                return 7.8;
            }
            if x.has_double(a) {
                return 8.25;
            }
            if x.triple_bonded(a).is_some() {
                return 11.0;
            }
            let mut n_c = 0;
            let mut reduce = Vec::new();
            for k in x.nbrs(a) {
                let nb = &x.atoms[k];
                if nb.el == "C" {
                    if nb.arom {
                        reduce.push(2.64);
                    } else if x.has_double(k) {
                        if x.double_to(k, "O", None) {
                            reduce.push(1.4);
                        } else {
                            reduce.push(1.71);
                        }
                    } else if x.triple_bonded(k).is_some() {
                        reduce.push(0.4);
                    } else {
                        n_c += 1;
                    }
                } else if let Some(d) = is_donor(&nb.el) {
                    reduce.push(d);
                }
            }
            let mut base = [9.84, 8.12, 7.37, 6.70][n_c.min(3)];
            // an acyclic saturated hydrocarbon cation isomerises (hydride / methyl shifts) to its most stable form
            if reduce.is_empty() && x.atoms.iter().all(|a| a.el == "C" && !a.arom) && x.atoms.iter().enumerate().all(|(i, _)| x.is_sp3(i)) && !x.atoms.iter().enumerate().any(|(i, _)| x.in_ring(i)) {
                let n = x.n();
                let branched = (0..n).any(|i| x.heavy_degree(i) >= 3);
                let iso = match n {
                    1 => 9.84,
                    2 => 8.12,
                    3 => 7.37,
                    _ => if branched { 6.75 } else { 7.2 },
                };
                base = iso;
            }
            reduce.sort_by(|p, q| q.partial_cmp(p).unwrap());
            let mut r = 0.0;
            let mut f = 1.0;
            for d in reduce {
                r += d * f;
                f *= 0.6;
            }
            let ie = base - r * ((base - 5.0f64) / 4.84).max(0.0);
            ie.max(5.2)
        }
        "O" => {
            if x.heavy_degree(a) == 0 {
                13.0
            } else if x.nbrs(a).any(|k| x.atoms[k].arom) {
                8.6
            } else {
                10.7
            }
        }
        "N" => {
            if x.nbrs(a).any(|k| x.atoms[k].el == "O") {
                9.6
            } else {
                (11.1 - 0.9 * x.heavy_degree(a) as f64).max(8.0)
            }
        }
        "S" => {
            if x.heavy_degree(a) == 0 {
                10.4
            } else {
                9.2
            }
        }
        "F" => 17.4,
        "Cl" => 12.97,
        "Br" => 11.81,
        "I" => 10.45,
        "P" => 9.9,
        "Si" => 8.2,
        "B" => 8.3,
        _ => 9.5,
    }
}

/// Ionisation energy (eV) of a closed-shell molecule: the lowest of its ionisable groups.
pub fn ie_molecule(g: &Mol) -> f64 {
    let n = g.n();
    let mut best = 99.0f64;
    let mut n_c = 0usize;
    let mut n_heavy_c = 0usize;
    for i in 0..n {
        if g.atoms[i].el == "C" {
            n_heavy_c += 1;
        }
    }
    let _ = &mut n_c;
    // aromatic systems
    let mut seen_ring: Vec<bool> = vec![false; n];
    for i in 0..n {
        if !g.atoms[i].arom || seen_ring[i] {
            continue;
        }
        // connected aromatic system
        let mut comp = vec![i];
        seen_ring[i] = true;
        let mut st = vec![i];
        while let Some(u) = st.pop() {
            for k in g.nbrs(u) {
                if g.atoms[k].arom && !seen_ring[k] && g.bond(u, k) == Some(1.5) {
                    seen_ring[k] = true;
                    comp.push(k);
                    st.push(k);
                }
            }
        }
        let n_rings = comp.len().saturating_sub(1).max(1) as f64 / 4.0; // ~ fused ring count for 6-membered systems
        let mut ie = 9.24 - 0.55 * (n_rings.round() - 1.0).max(0.0);
        let hetero_ring = comp.iter().filter(|&&k| g.atoms[k].el != "C").count();
        if hetero_ring > 0 {
            ie += 0.05 * hetero_ring as f64;
        }
        for &k in &comp {
            for y in g.nbrs(k).filter(|y| !comp.contains(y)) {
                let ya = &g.atoms[y];
                ie += match ya.el.as_str() {
                    "C" => {
                        if g.double_to(y, "O", None) {
                            0.05
                        } else if ya.arom {
                            -0.3
                        } else if g.has_double(y) {
                            -0.45
                        } else if g.triple_bonded(y).is_some() {
                            0.1
                        } else {
                            -0.4
                        }
                    }
                    "O" => -0.75,
                    "N" => {
                        if g.nbrs(y).any(|z| z != k && g.atoms[z].el == "O") { 0.6 } else { -1.5 }
                    }
                    "S" => -0.5,
                    "Cl" | "Br" => -0.18,
                    "I" => -0.4,
                    "F" => -0.1,
                    _ => 0.0,
                };
            }
        }
        best = best.min(ie.max(6.8));
    }
    for i in 0..n {
        let a = &g.atoms[i];
        let nbc = n_carbon_nbrs(g, i, None);
        match a.el.as_str() {
            "N" if !a.arom && !g.has_double(i) && g.triple_bonded(i).is_none() && a.charge == 0 => {
                let o_nb = g.nbrs(i).any(|k| g.atoms[k].el == "O");
                let co = g.nbrs(i).any(|k| g.atoms[k].el == "C" && g.double_to(k, "O", None));
                let ar = g.nbrs(i).any(|k| g.atoms[k].arom);
                if o_nb {
                    continue;
                }
                let mut ie: f64 = [10.07, 8.9, 8.24, 7.85][nbc.min(3)];
                if co {
                    ie = ie.max(9.1);
                }
                if ar {
                    ie = ie.min(7.8).max(7.2);
                }
                best = best.min(ie);
            }
            "N" if a.arom && a.h == 0 && a.charge == 0 => {
                // pyridine-type lone pair
                best = best.min(9.3);
            }
            "O" if a.charge == 0 && !a.arom => {
                if g.has_double(i) {
                    let c = g.nbrs(i).next().unwrap_or(i);
                    let hetero = g.nbrs(c).filter(|&k| k != i && matches!(g.atoms[k].el.as_str(), "O" | "N")).count();
                    let hy = g.nbrs(c).any(|k| g.atoms[k].el == "O" && g.atoms[k].h > 0);
                    let conj = g.nbrs(c).any(|k| k != i && (g.atoms[k].arom || g.has_double(k) && !g.double_to(k, "O", None)));
                    let mut ie = if hetero == 0 {
                        if g.atoms[c].h > 0 { 10.2 } else { 9.65 }
                    } else if hy {
                        10.5
                    } else if g.nbrs(c).any(|k| g.atoms[k].el == "N") {
                        9.7
                    } else {
                        10.1
                    };
                    if conj {
                        ie -= 0.45;
                    }
                    best = best.min(ie);
                } else if g.heavy_degree(i) == 1 && g.atoms[i].h > 0 {
                    let c = g.nbrs(i).next().unwrap();
                    if g.atoms[c].el == "C" && !g.atoms[c].arom {
                        let k = n_carbon_nbrs(g, c, Some(i));
                        best = best.min([10.85, 10.5, 10.15, 9.9][k.min(3)]);
                    }
                } else if g.heavy_degree(i) == 2 {
                    let carbons = g.nbrs(i).filter(|&k| g.atoms[k].el == "C" && !g.atoms[k].arom && !g.double_to(k, "O", None)).count();
                    if carbons == 2 {
                        let branch: usize = g.nbrs(i).map(|k| n_carbon_nbrs(g, k, Some(i))).sum();
                        let mut ie = 10.0 - 0.18 * branch as f64;
                        if g.in_ring(i) {
                            ie -= 0.25;
                        }
                        best = best.min(ie.max(9.2));
                    }
                } else if g.heavy_degree(i) == 0 {
                    best = best.min(12.6); // water
                }
            }
            "S" if !a.arom => {
                if g.has_double(i) {
                    continue;
                }
                let ie = match g.heavy_degree(i) {
                    0 | 1 => 9.4,
                    _ => 8.7,
                };
                best = best.min(ie);
            }
            "Cl" | "Br" | "I" if a.charge == 0 => {
                if g.heavy_degree(i) == 0 {
                    best = best.min(match a.el.as_str() {
                        "Cl" => 12.75,
                        "Br" => 11.66,
                        _ => 10.39,
                    });
                } else {
                    let c = g.nbrs(i).next().unwrap();
                    let k = n_carbon_nbrs(g, c, Some(i)) as f64;
                    let hal_count = g.nbrs(c).filter(|&z| matches!(g.atoms[z].el.as_str(), "Cl" | "Br" | "I" | "F")).count() as f64;
                    let base = match a.el.as_str() {
                        "Cl" => 11.3,
                        "Br" => 10.55,
                        _ => 9.55,
                    };
                    best = best.min(base - 0.27 * k + 0.05 * (hal_count - 1.0));
                }
            }
            "P" => best = best.min(9.0),
            "Si" => best = best.min(10.0),
            _ => {}
        }
    }
    // pi bonds
    for i in 0..n {
        for &(j, o) in &g.adj[i] {
            if j < i || g.atoms[i].arom {
                continue;
            }
            if (o - 2.0).abs() < 1e-9 && g.atoms[i].el == "C" && g.atoms[j].el == "C" {
                let subs = g.heavy_degree(i) + g.heavy_degree(j) - 2;
                let conj = [i, j].iter().any(|&c| g.nbrs(c).any(|k| g.atoms[k].arom || (g.has_double(k) && k != i && k != j)));
                let mut ie = 10.5 - 0.55 * subs as f64;
                if conj {
                    ie -= 0.8;
                }
                best = best.min(ie.max(7.8));
            } else if (o - 3.0).abs() < 1e-9 && g.atoms[i].el == "C" && g.atoms[j].el == "C" {
                let subs = g.heavy_degree(i) + g.heavy_degree(j) - 2;
                best = best.min(11.4 - 0.5 * subs as f64);
            } else if (o - 3.0).abs() < 1e-9 && (g.atoms[i].el == "N" || g.atoms[j].el == "N") {
                best = best.min(12.2);
            }
        }
    }
    // sigma framework (alkanes and anything with nothing softer)
    if best > 11.0 && n_heavy_c > 0 {
        let n = n_heavy_c as f64;
        let mut ie = 9.55 + 3.05 / n;
        let branching = (0..g.n()).filter(|&i| g.atoms[i].el == "C" && g.heavy_degree(i) >= 3).count() as f64;
        ie -= 0.18 * branching;
        if g.in_ring(0) {
            ie -= 0.35;
        }
        best = best.min(ie);
    }
    if best > 98.0 {
        // inorganic leftovers: dominated by the most polarisable atom
        best = g
            .atoms
            .iter()
            .map(|a| match a.el.as_str() {
                "H" => 15.4,
                "O" => 12.1,
                "N" => 15.6,
                "C" => 14.0,
                "F" => 15.7,
                _ => 11.0,
            })
            .fold(99.0, f64::min);
    }
    best
}

/// Bond dissociation energy (eV) of the single bond a-b in `g`, including the stabilisation of the radicals formed.
pub fn bde(g: &Mol, a: usize, b: usize) -> f64 {
    let (ea, eb) = (g.atoms[a].el.as_str(), g.atoms[b].el.as_str());
    let hyb = |i: usize| -> u8 {
        let at = &g.atoms[i];
        if at.arom || g.has_double(i) {
            2
        } else if g.triple_bonded(i).is_some() {
            1
        } else {
            3
        }
    };
    let carbonyl = |i: usize| g.atoms[i].el == "C" && g.double_to(i, "O", None);
    let (ha, hb) = (hyb(a), hyb(b));
    let pair = |x: &str, y: &str| (ea == x && eb == y) || (ea == y && eb == x);
    let is_c = |i: usize| g.atoms[i].el == "C";
    let mut d = if pair("C", "C") {
        match (ha, hb) {
            (3, 3) => 3.80,
            (2, 3) | (3, 2) => 4.25,
            (2, 2) => 4.9,
            _ => 5.0,
        }
    } else if pair("C", "H") {
        let c = if is_c(a) { a } else { b };
        match hyb(c) {
            3 => 4.45,
            2 => if g.atoms[c].arom { 4.85 } else { 4.7 },
            _ => 5.7,
        }
    } else if pair("O", "H") {
        let o = if ea == "O" { a } else { b };
        let phenol = g.nbrs(o).any(|k| g.atoms[k].arom);
        let acid = g.nbrs(o).any(|k| carbonyl(k));
        if phenol { 3.9 } else if acid { 4.6 } else { 4.9 }
    } else if pair("N", "H") {
        4.1
    } else if pair("S", "H") {
        3.8
    } else if pair("C", "O") {
        let c = if is_c(a) { a } else { b };
        if carbonyl(c) { 4.0 } else if hyb(c) == 2 { 4.3 } else { 3.75 }
    } else if pair("C", "N") {
        let c = if is_c(a) { a } else { b };
        let n = if is_c(a) { b } else { a };
        if g.nbrs(n).any(|k| g.atoms[k].el == "O") && g.atoms[n].charge > 0 {
            if hyb(c) == 2 { 3.1 } else { 2.7 }
        } else if carbonyl(c) { 4.0 } else if hyb(c) == 2 { 4.2 } else { 3.5 }
    } else if pair("C", "S") {
        3.0
    } else if pair("C", "Cl") {
        if hyb(if is_c(a) { a } else { b }) == 2 { 4.0 } else { 3.55 }
    } else if pair("C", "Br") {
        if hyb(if is_c(a) { a } else { b }) == 2 { 3.4 } else { 3.0 }
    } else if pair("C", "I") {
        if hyb(if is_c(a) { a } else { b }) == 2 { 2.8 } else { 2.4 }
    } else if pair("C", "F") {
        4.6
    } else if pair("N", "O") {
        // the N-O bonds of a nitro group (N+ with O-) are resonance hybrids with partial double-bond character
        let n = if ea == "N" { a } else { b };
        if g.atoms[n].charge > 0 && (g.atoms[a].charge < 0 || g.atoms[b].charge < 0) { 4.3 } else { 2.2 }
    } else if pair("O", "O") {
        1.5
    } else if pair("S", "S") {
        2.7
    } else if pair("C", "P") {
        3.2
    } else if pair("C", "Si") {
        3.5
    } else {
        3.4
    };
    d -= rse(g, a, b) + rse(g, b, a);
    d.max(0.4)
}

/// Stabilisation (eV, relative to a methyl radical) of the radical left on `c` when bond (c, other) is broken.
fn rse(g: &Mol, c: usize, other: usize) -> f64 {
    let at = &g.atoms[c];
    match at.el.as_str() {
        "C" => {
            if at.arom {
                return -0.4; // sigma radical, destabilised: aryl bonds are strong (already in D0)
            }
            if g.double_to(c, "O", None) {
                return 0.3; // acyl radical
            }
            if g.has_double(c) {
                return -0.3;
            }
            let mut r = 0.0;
            let mut n_c = 0;
            for k in g.nbrs(c).filter(|&k| k != other) {
                let nb = &g.atoms[k];
                match nb.el.as_str() {
                    "C" => {
                        if nb.arom {
                            r += 0.65;
                        } else if g.double_to(k, "O", None) {
                            r += 0.45;
                        } else if g.has_double(k) {
                            r += 0.62;
                        } else if g.triple_bonded(k).is_some() {
                            r += 0.3;
                        } else {
                            n_c += 1;
                        }
                    }
                    "O" => r += 0.45,
                    "N" => r += 0.6,
                    "S" => r += 0.4,
                    "Cl" | "Br" | "I" => r += 0.1,
                    _ => {}
                }
            }
            r + [0.0, 0.10, 0.20, 0.30][n_c.min(3)]
        }
        "O" => {
            if g.nbrs(c).any(|k| k != other && g.atoms[k].arom) { 0.9 } else { 0.0 }
        }
        "N" => 0.3,
        _ => 0.0,
    }
}

/// Dissociation energy (eV) of the bond between atom `a` and one of its hydrogens.
pub fn bde_h(g: &Mol, a: usize) -> f64 {
    let at = &g.atoms[a];
    let base = match at.el.as_str() {
        "C" => {
            if at.arom {
                4.85
            } else if g.has_double(a) {
                4.7
            } else if g.triple_bonded(a).is_some() {
                5.7
            } else {
                4.45
            }
        }
        "O" => {
            if g.nbrs(a).any(|k| g.atoms[k].arom) {
                3.9
            } else if g.nbrs(a).any(|k| g.atoms[k].el == "C" && g.double_to(k, "O", None)) {
                4.6
            } else {
                4.9
            }
        }
        "N" => 4.1,
        "S" => 3.8,
        _ => 4.0,
    };
    (base - rse(g, a, usize::MAX)).max(0.8)
}
