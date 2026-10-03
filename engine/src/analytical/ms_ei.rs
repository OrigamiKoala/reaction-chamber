//! 70 eV electron-ionisation mass spectrum of any molecule, predicted from its structure graph.
//!
//! A quasi-equilibrium (RRKM-style) model: the molecular ion M+. is formed with an internal-energy distribution; every ion
//! has a list of unimolecular channels (single-bond cleavages with threshold AE = D(A-B) + IE(A.) - IE(M), hydrogen loss,
//! McLafferty and related rearrangements, water / HX / alkene / CO / C2H2 / HCN losses, retro-Diels-Alder, ring contraction,
//! and the decays of the common even-electron ions); channel rates k(E) = A ((E - E0)/E)^(s-1) compete at each internal
//! energy, daughters inherit the leftover energy and decay in turn. What survives (undecayed) at the detection time is the
//! peak. Isotope patterns come from the exact isotope table. Every energy is a group-additive estimate (tier Estimated).

use std::collections::HashMap;

use super::graph::{GAtom, Mol};
use super::isotopes;
use super::ms_thermo::*;

#[derive(Clone, Debug)]
pub struct EiPeak {
    pub mz: i32,
    /// Relative abundance, 0..100 (base peak = 100).
    pub intensity: f64,
    pub label: String,
    pub molecular: bool,
}

#[derive(Clone)]
struct Ion {
    g: Mol,
    site: Option<usize>,
    odd: bool,
    /// Pure hydrocarbon cation described by its formula only.
    hc: Option<(usize, usize)>,
    e_form: f64,
    key: String,
}

struct Channel {
    child: Ion,
    e0: f64,
    loga: f64,
    /// Atoms (heavy + H) of the neutral that leaves, for the energy partition.
    n_neutral: usize,
}

const E_MAX: f64 = 25.0;
const E_STEP: f64 = 0.1;

/// Constants of the quasi-equilibrium model (fitted once on the reference spectra of the test suite).
#[derive(Clone, Copy, Debug)]
pub struct EiParams {
    /// Internal-energy distribution of M+.: (1 - w2) gamma(2, theta) + w2 gamma(2, theta * tail)
    pub theta: f64,
    pub w2: f64,
    pub tail: f64,
    /// Weight and scale (eV) of an exponential component for ionisation into the lowest states (little internal energy)
    pub w_low: f64,
    pub theta_low: f64,
    /// Effective oscillator fraction in s = f (3N - 6)
    pub s_factor: f64,
    /// Observation time, s
    pub tau: f64,
    /// Added to every single-bond cleavage threshold (systematic error of the additive thermochemistry)
    pub cleave_shift: f64,
    /// Added to the thresholds of the rearrangement channels
    pub rearr_shift: f64,
    /// Fraction of the excess energy that the charged daughter keeps
    pub keep: f64,
}

impl Default for EiParams {
    fn default() -> Self {
        EiParams { theta: 1.4505131495442884, w2: 0.19672195107108428, tail: 5.864985186415715, w_low: 0.05212909997425462, theta_low: 0.6179876079846159, s_factor: 0.23570399004481069, tau: 2.3285060409191215e-6, cleave_shift: -0.35141627591719526, rearr_shift: 0.010685451966422788, keep: 0.8990528869462281 }
    }
}

// ------------------------------------------------------------------------------------------------------ graph helpers

fn component(g: &Mol, start: usize, cut: (usize, usize)) -> Vec<usize> {
    let mut seen = vec![false; g.n()];
    seen[start] = true;
    let mut st = vec![start];
    let mut out = vec![start];
    while let Some(u) = st.pop() {
        for &(v, _) in &g.adj[u] {
            if (u == cut.0 && v == cut.1) || (u == cut.1 && v == cut.0) || seen[v] {
                continue;
            }
            seen[v] = true;
            out.push(v);
            st.push(v);
        }
    }
    out
}

fn subgraph(g: &Mol, keep: &[usize]) -> (Mol, Vec<usize>) {
    let mut map = vec![usize::MAX; g.n()];
    for (k, &i) in keep.iter().enumerate() {
        map[i] = k;
    }
    let atoms: Vec<GAtom> = keep.iter().map(|&i| g.atoms[i].clone()).collect();
    let adj = keep.iter().map(|&i| g.adj[i].iter().filter(|(j, _)| map[*j] != usize::MAX).map(|&(j, o)| (map[j], o)).collect()).collect();
    (Mol { atoms, adj }, map)
}

fn set_bond(g: &mut Mol, a: usize, b: usize, order: f64) {
    for e in g.adj[a].iter_mut() {
        if e.0 == b {
            e.1 = order;
        }
    }
    for e in g.adj[b].iter_mut() {
        if e.0 == a {
            e.1 = order;
        }
    }
}

fn add_bond(g: &mut Mol, a: usize, b: usize, order: f64) {
    if g.bond(a, b).is_some() {
        set_bond(g, a, b, order);
    } else {
        g.adj[a].push((b, order));
        g.adj[b].push((a, order));
    }
}

fn n_atoms_with_h(g: &Mol) -> usize {
    g.n() + g.total_h() as usize
}

fn mass_of(g: &Mol) -> Option<f64> {
    let mut m = 0.0;
    for (e, n) in g.element_counts() {
        m += isotopes::mono_mass(&e)? * n as f64;
    }
    Some(m)
}

fn make_key(g: &Mol, odd: bool, site: Option<usize>) -> String {
    let mut sig: Vec<String> = (0..g.n()).map(|i| format!("{}{}.{}{}", g.atoms[i].el, g.atoms[i].h, g.heavy_degree(i), if Some(i) == site { "+" } else { "" })).collect();
    sig.sort();
    format!("{}|{}|{}", g.formula(), odd, sig.join(","))
}

fn hc_ion(n: usize, m: usize, e_form: f64) -> Ion {
    // a chain stand-in: only (n, m) matter for the decays of hydrocarbon cations
    let mut atoms = Vec::with_capacity(n);
    let mut left = m as i64;
    for i in 0..n {
        let cap = if i == 0 || i + 1 == n { 3 } else { 2 };
        let h = left.clamp(0, cap) as u32;
        left -= h as i64;
        atoms.push(GAtom { el: "C".into(), arom: false, charge: 0, h });
    }
    if left > 0 {
        atoms[0].h += left as u32;
    }
    let mut adj = vec![Vec::new(); n];
    for i in 0..n.saturating_sub(1) {
        adj[i].push((i + 1, 1.0));
        adj[i + 1].push((i, 1.0));
    }
    Ion { g: Mol { atoms, adj }, site: None, odd: false, hc: Some((n, m)), e_form, key: format!("HC{}_{}", n, m) }
}

fn is_pure_hydrocarbon(g: &Mol) -> bool {
    g.atoms.iter().all(|a| a.el == "C" && !a.arom)
}

fn finish(mut ion: Ion) -> Ion {
    if !ion.odd && ion.hc.is_none() && is_pure_hydrocarbon(&ion.g) && ion.g.n() >= 1 {
        let n = ion.g.n();
        let m = ion.g.total_h() as usize;
        let e = ion.e_form;
        return hc_ion(n, m, e);
    }
    if ion.odd && ion.hc.is_none() && ion.g.n() >= 3 && ion.g.atoms.iter().all(|a| a.el == "C") {
        let n = ion.g.n();
        let m = ion.g.total_h() as usize;
        if 2 * n + 2 >= m && (2 * n + 2 - m) / 2 >= 3 && ion.g.atoms.iter().any(|a| a.arom) == false {
            let mut p = hc_ion(n, m, ion.e_form);
            p.odd = true;
            p.key = format!("HCo{}_{}", n, m);
            return p;
        }
    }
    ion.key = make_key(&ion.g, ion.odd, ion.site);
    ion
}

fn is_bridge_split(g: &Mol, a: usize, b: usize) -> Option<(Vec<usize>, Vec<usize>)> {
    let ca = component(g, a, (a, b));
    if ca.contains(&b) {
        return None;
    }
    let cb = component(g, b, (a, b));
    Some((ca, cb))
}

// ------------------------------------------------------------------------------------------------------ channels

fn n_h_loss_channels(ion: &Ion, ie_ref: f64, out: &mut Vec<Channel>) {
    let g = &ion.g;
    let cls = g.classes();
    let mut seen: Vec<usize> = Vec::new();
    for a in 0..g.n() {
        if g.atoms[a].h == 0 || seen.contains(&cls[a]) {
            continue;
        }
        seen.push(cls[a]);
        let d = bde_h(g, a);
        let mut child = g.clone();
        child.atoms[a].h -= 1;
        let e0 = d + ie_radical(&child, a) - ie_ref;
        let e0 = e0 + 0.25;
        out.push(Channel { child: finish(Ion { g: child, site: Some(a), odd: false, hc: None, e_form: ion.e_form + e0.max(0.05), key: String::new() }), e0: e0.max(0.05), loga: 14.0, n_neutral: 1 });
    }
}

fn simple_cleavages(ion: &Ion, ie_ref: f64, out: &mut Vec<Channel>) {
    let g = &ion.g;
    for a in 0..g.n() {
        for &(b, o) in &g.adj[a] {
            if b < a || (o - 1.0).abs() > 1e-9 || g.atoms[a].arom && g.atoms[b].arom {
                continue;
            }
            let Some((ca, cb)) = is_bridge_split(g, a, b) else { continue };
            let d = bde(g, a, b);
            let (ga, ma) = subgraph(g, &ca);
            let (gb, mb) = subgraph(g, &cb);
            let (na, nb_) = (n_atoms_with_h(&ga), n_atoms_with_h(&gb));
            for (xg, xa, nn, other) in [(&ga, ma[a], nb_, 0), (&gb, mb[b], na, 1)] {
                let _ = other;
                let e0 = d + ie_radical(xg, xa) - ie_ref;
                let e0 = e0.max(0.05);
                let child = finish(Ion { g: xg.clone(), site: Some(xa), odd: false, hc: None, e_form: ion.e_form + e0, key: String::new() });
                // loss of OH / OR / NR2 from an acyl group goes through a tighter transition state than a plain C-C split
                let acyl_hetero = (g.atoms[a].el == "C" && g.double_to(a, "O", None) && matches!(g.atoms[b].el.as_str(), "O" | "N"))
                    || (g.atoms[b].el == "C" && g.double_to(b, "O", None) && matches!(g.atoms[a].el.as_str(), "O" | "N"));
                out.push(Channel { child, e0, loga: if acyl_hetero { 14.5 } else { 15.5 }, n_neutral: nn });
            }
        }
    }
}

/// H-transfer rearrangements of radical cations.
fn rearrangements(ion: &Ion, ie_ref: f64, out: &mut Vec<Channel>) {
    let g = &ion.g;
    let n = g.n();
    let push = |out: &mut Vec<Channel>, g2: Mol, e0: f64, loga: f64, nn: usize, odd: bool, site: Option<usize>| {
        out.push(Channel { child: finish(Ion { g: g2, site, odd, hc: None, e_form: ion.e_form + e0, key: String::new() }), e0, loga, n_neutral: nn });
    };
    // --- McLafferty: A=Z-Ca-Cb-Cg(H)
    for z in 0..n {
        for &(acc, o) in &g.adj[z] {
            if o < 1.5 - 1e-9 {
                continue;
            }
            let acc_arom = g.atoms[acc].arom;
            if !matches!(g.atoms[acc].el.as_str(), "O" | "N" | "S" | "C") {
                continue;
            }
            if g.atoms[acc].el == "C" && !acc_arom && (o - 2.0).abs() >= 1e-9 {
                continue;
            }
            for &(ca, oa) in &g.adj[z] {
                if ca == acc || (oa - 1.0).abs() > 1e-9 || g.atoms[ca].el != "C" || g.atoms[ca].arom {
                    continue;
                }
                for &(cb, ob) in &g.adj[ca] {
                    if cb == z || (ob - 1.0).abs() > 1e-9 || g.atoms[cb].el != "C" || g.atoms[cb].arom || g.has_double(cb) && false {
                        continue;
                    }
                    let Some((keep, lose)) = is_bridge_split(g, ca, cb) else { continue };
                    if !keep.contains(&z) {
                        continue;
                    }
                    for &(cg, og) in &g.adj[cb] {
                        if cg == ca || (og - 1.0).abs() > 1e-9 || g.atoms[cg].h == 0 || !lose.contains(&cg) || g.atoms[cg].arom {
                            continue;
                        }
                        // ion: kept side, acceptor gains H (aromatic acceptor: the alpha carbon does)
                        let (mut ig, map) = subgraph(g, &keep);
                        if acc_arom {
                            ig.atoms[map[ca]].h += 1;
                        } else {
                            ig.atoms[map[acc]].h += 1;
                            set_bond(&mut ig, map[z], map[acc], o - 1.0);
                            set_bond(&mut ig, map[z], map[ca], 2.0);
                        }
                        let e0 = if acc_arom { 1.1 } else if g.atoms[acc].el == "O" { 0.65 } else { 0.9 };
                        let nn = lose.len() + lose.iter().map(|&i| g.atoms[i].h as usize).sum::<usize>();
                        push(out, ig, e0, 11.8, nn, true, None);
                    }
                }
            }
        }
    }
    // --- loss of water from alcohols, HX from alkyl halides
    for o_at in 0..n {
        let el = g.atoms[o_at].el.as_str();
        let is_oh = el == "O" && g.atoms[o_at].h == 1 && g.heavy_degree(o_at) == 1;
        let is_x = matches!(el, "Cl" | "Br" | "I" | "F") && g.heavy_degree(o_at) == 1;
        if !(is_oh || is_x) {
            continue;
        }
        let ca = g.nbrs(o_at).next().unwrap();
        if g.atoms[ca].el != "C" || !g.is_sp3(ca) {
            continue;
        }
        // gamma-H available (1,4 elimination) or beta-H (1,2)
        let mut best: Option<(usize, f64)> = None;
        for cb in g.nbrs(ca).filter(|&k| g.atoms[k].el == "C" && g.is_sp3(k) && g.atoms[k].h > 0) {
            best = Some((cb, 1.8));
        }
        let delta_h = g.nbrs(ca).any(|cb| g.atoms[cb].el == "C" && g.nbrs(cb).any(|cc| cc != ca && g.nbrs(cc).any(|cd| cd != cb && g.atoms[cd].el == "C" && g.atoms[cd].h > 0 && cd != ca)));
        let e0_base = if is_oh { if delta_h { 1.0 } else { 1.8 } } else { match el { "Cl" => 1.6, "Br" => 1.4, "I" => 1.2, _ => 2.0 } };
        if let Some((cb, _)) = best {
            let mut g2 = g.clone();
            g2.atoms[cb].h -= 1;
            // remove the heteroatom (and its H)
            let keep: Vec<usize> = (0..n).filter(|&i| i != o_at).collect();
            let (mut sub, map) = subgraph(&g2, &keep);
            set_bond(&mut sub, map[ca], map[cb], 2.0);
            let nn = if is_oh { 3 } else { 2 };
            push(out, sub, e0_base, 12.5, nn, true, None);
        }
    }
    // --- alkene loss from ethers / thioethers / amines: X-Ca-Cb(H)
    for x in 0..n {
        if !matches!(g.atoms[x].el.as_str(), "O" | "S" | "N") || g.atoms[x].arom || g.heavy_degree(x) < 2 {
            continue;
        }
        for ca in g.nbrs(x).collect::<Vec<_>>() {
            if g.atoms[ca].el != "C" || !g.is_sp3(ca) || g.ring_bond(x, ca) {
                continue;
            }
            for cb in g.nbrs(ca).filter(|&k| k != x && g.atoms[k].el == "C" && g.is_sp3(k) && g.atoms[k].h > 0).collect::<Vec<_>>() {
                let Some((keep, lose)) = is_bridge_split(g, x, ca) else { continue };
                if !lose.contains(&cb) {
                    continue;
                }
                let (mut sub, map) = subgraph(g, &keep);
                sub.atoms[map[x]].h += 1;
                let aryl = g.nbrs(x).any(|k| g.atoms[k].arom);
                let e0 = if aryl { 1.2 } else if g.atoms[x].el == "O" { 1.9 } else { 1.7 };
                let nn = lose.len() + lose.iter().map(|&i| g.atoms[i].h as usize).sum::<usize>();
                push(out, sub, e0, 12.3, nn, true, None);
                break;
            }
        }
    }
    // --- aryl methyl ether: loss of CH2O
    for o_at in 0..n {
        if g.atoms[o_at].el != "O" || g.heavy_degree(o_at) != 2 {
            continue;
        }
        let nb: Vec<usize> = g.nbrs(o_at).collect();
        let (ar, me) = if g.atoms[nb[0]].arom { (nb[0], nb[1]) } else { (nb[1], nb[0]) };
        if g.atoms[ar].arom && g.atoms[me].el == "C" && g.atoms[me].h == 3 && g.heavy_degree(me) == 1 {
            let keep: Vec<usize> = (0..n).filter(|&i| i != o_at && i != me).collect();
            let (mut sub, map) = subgraph(g, &keep);
            sub.atoms[map[ar]].h += 1;
            push(out, sub, 1.5, 12.8, 4, true, None);
        }
    }
    // --- retro-Diels-Alder: six-membered ring with one C=C
    for a in 0..n {
        for &(b, o) in &g.adj[a] {
            if b < a || (o - 2.0).abs() > 1e-9 || g.atoms[a].arom || g.atoms[b].arom || g.atoms[a].el != "C" || g.atoms[b].el != "C" {
                continue;
            }
            if g.ring_size_of_bond(a, b) != Some(6) {
                continue;
            }
            let ring = g.smallest_ring_through(a, b); // path b ... a
            if ring.len() != 6 {
                continue;
            }
            // order the ring as r0=a, r1=b, then the path around
            let mut r: Vec<usize> = vec![a];
            let mut rest: Vec<usize> = ring.clone();
            rest.retain(|&x| x != a);
            // path from b back to a through the ring
            let mut order: Vec<usize> = Vec::new();
            let mut cur = b;
            let mut prev = a;
            order.push(b);
            while order.len() < 5 {
                let nx = g.nbrs(cur).find(|&k| k != prev && ring.contains(&k)).unwrap();
                order.push(nx);
                prev = cur;
                cur = nx;
            }
            r.extend(order); // r0=a, r1=b, r2, r3, r4, r5
            if r.iter().any(|&x| g.atoms[x].arom || g.has_double(x) && x != a && x != b) {
                continue;
            }
            // cut bonds (r2,r3) and (r4,r5)
            let (r2, r3, r4, r5) = (r[2], r[3], r[4], r[5]);
            let mut tmp = g.clone();
            tmp.adj[r2].retain(|&(k, _)| k != r3);
            tmp.adj[r3].retain(|&(k, _)| k != r2);
            tmp.adj[r4].retain(|&(k, _)| k != r5);
            tmp.adj[r5].retain(|&(k, _)| k != r4);
            let diene = component(&tmp, a, (usize::MAX, usize::MAX));
            if diene.contains(&r3) {
                continue;
            }
            let ene = component(&tmp, r3, (usize::MAX, usize::MAX));
            if diene.len() + ene.len() != n {
                continue;
            }
            let (mut dg, dm) = subgraph(&tmp, &diene);
            set_bond(&mut dg, dm[r5], dm[a], 2.0);
            set_bond(&mut dg, dm[b], dm[r2], 2.0);
            set_bond(&mut dg, dm[a], dm[b], 1.0);
            let (mut eg, em) = subgraph(&tmp, &ene);
            add_bond(&mut eg, em[r3], em[r4], 2.0);
            let (ie_d, ie_e) = (ie_molecule(&dg), ie_molecule(&eg));
            let nn_e = n_atoms_with_h(&eg);
            let nn_d = n_atoms_with_h(&dg);
            push(out, dg, 0.9 + (ie_d - ie_ref).max(0.0) * 0.0, 13.8, nn_e, true, None);
            let pen = (ie_e - ie_d).max(0.0);
            push(out, eg, 0.9 + pen, 13.8, nn_d, true, None);
        }
    }
    // --- ring contraction with loss of an ethylene unit from a non-aromatic ring
    for a in 0..n {
        for &(x, ox) in &g.adj[a] {
            if (ox - 1.0).abs() > 1e-9 || g.atoms[x].arom || !g.ring_bond(a, x) {
                continue;
            }
            for &(y, oy) in &g.adj[x] {
                if y == a || (oy - 1.0).abs() > 1e-9 || g.atoms[y].arom || !g.ring_bond(x, y) || g.atoms[x].el != "C" || g.atoms[y].el != "C" {
                    continue;
                }
                for &(b, ob) in &g.adj[y] {
                    if b == x || b == a || (ob - 1.0).abs() > 1e-9 || !g.ring_bond(y, b) {
                        continue;
                    }
                    if g.ring_size_of_bond(a, x).map_or(true, |s| s < 5) || g.ring_size_of_bond(a, x) != g.ring_size_of_bond(y, b) {
                        continue;
                    }
                    if g.has_double(x) || g.has_double(y) {
                        continue;
                    }
                    // remove x and y with their non-ring substituents
                    let mut tmp = g.clone();
                    tmp.adj[a].retain(|&(k, _)| k != x);
                    tmp.adj[x].retain(|&(k, _)| k != a);
                    tmp.adj[y].retain(|&(k, _)| k != b);
                    tmp.adj[b].retain(|&(k, _)| k != y);
                    let neutral = component(&tmp, x, (usize::MAX, usize::MAX));
                    if neutral.contains(&a) || neutral.contains(&b) {
                        continue;
                    }
                    let keep: Vec<usize> = (0..n).filter(|i| !neutral.contains(i)).collect();
                    let (mut sub, map) = subgraph(&tmp, &keep);
                    add_bond(&mut sub, map[a], map[b], 1.0);
                    let nn = neutral.len() + neutral.iter().map(|&i| g.atoms[i].h as usize).sum::<usize>();
                    push(out, sub, 1.0, 13.0, nn, true, None);
                }
            }
        }
    }
    // --- aromatic ring losses: C2H2, HCN, CO
    for i in 0..n {
        if !g.atoms[i].arom {
            continue;
        }
        for &(j, o) in &g.adj[i] {
            if j < i || (o - 1.5).abs() > 1e-9 {
                continue;
            }
            let ring = g.smallest_ring_through(i, j);
            if ring.len() != 6 || !ring.iter().all(|&k| g.atoms[k].arom) || ring.iter().any(|&k| g.nbrs(k).any(|m| g.atoms[m].arom && !ring.contains(&m))) {
                continue;
            }
            // C2H2 from two adjacent carbons that each carry hydrogen (or are fully substituted: skip)
            if g.atoms[i].el == "C" && g.atoms[j].el == "C" && g.atoms[i].h == 1 && g.atoms[j].h == 1 {
                let mut keep: Vec<usize> = (0..n).filter(|&k| k != i && k != j).collect();
                keep.sort();
                let (mut sub, map) = subgraph(g, &keep);
                for k in 0..sub.n() {
                    sub.atoms[k].arom = false;
                }
                for k in 0..sub.n() {
                    for e in sub.adj[k].iter_mut() {
                        if (e.1 - 1.5).abs() < 1e-9 {
                            e.1 = 1.0;
                        }
                    }
                }
                let _ = map;
                push(out, sub, 4.4, 14.0, 4, true, None);
            }
        }
        // HCN from a ring nitrogen with an adjacent CH, or from an aromatic amine
        if g.atoms[i].el == "N" {
            for c in g.nbrs(i).filter(|&k| g.atoms[k].arom && g.atoms[k].el == "C" && g.atoms[k].h == 1).collect::<Vec<_>>() {
                let keep: Vec<usize> = (0..n).filter(|&k| k != i && k != c).collect();
                let (mut sub, _) = subgraph(g, &keep);
                for k in 0..sub.n() {
                    sub.atoms[k].arom = false;
                    for e in sub.adj[k].iter_mut() {
                        if (e.1 - 1.5).abs() < 1e-9 {
                            e.1 = 1.0;
                        }
                    }
                }
                push(out, sub, 3.6, 13.8, 2, true, None);
                break;
            }
        }
    }
    for c in 0..n {
        if !g.atoms[c].arom || g.atoms[c].el != "C" {
            continue;
        }
        for x in g.nbrs(c).filter(|&k| !g.atoms[k].arom && g.heavy_degree(k) <= 2).collect::<Vec<_>>() {
            let el = g.atoms[x].el.as_str();
            // phenol-type C-OH: ring contraction with CO loss
            if el == "O" && g.atoms[x].h == 1 && g.heavy_degree(x) == 1 {
                let ring_nb: Vec<usize> = g.nbrs(c).filter(|&k| g.atoms[k].arom).collect();
                if ring_nb.len() != 2 {
                    continue;
                }
                let keep: Vec<usize> = (0..n).filter(|&k| k != c && k != x).collect();
                let (mut sub, map) = subgraph(g, &keep);
                sub.atoms[map[ring_nb[0]]].h += 1;
                add_bond(&mut sub, map[ring_nb[0]], map[ring_nb[1]], 1.5);
                push(out, sub, 3.0, 13.8, 2, true, None);
            }
            // aromatic amine: loss of HCN (ipso carbon + amino N)
            if el == "N" && g.heavy_degree(x) == 1 && g.atoms[x].h == 2 {
                let ring_nb: Vec<usize> = g.nbrs(c).filter(|&k| g.atoms[k].arom).collect();
                if ring_nb.len() != 2 {
                    continue;
                }
                let keep: Vec<usize> = (0..n).filter(|&k| k != c && k != x).collect();
                let (mut sub, map) = subgraph(g, &keep);
                sub.atoms[map[ring_nb[0]]].h += 1;
                add_bond(&mut sub, map[ring_nb[0]], map[ring_nb[1]], 1.5);
                push(out, sub, 3.0, 13.8, 2, true, None);
            }
            // nitro: loss of NO (nitro-nitrite rearrangement)
            if el == "N" && g.atoms[x].charge > 0 && g.heavy_degree(x) == 3 {
                let os: Vec<usize> = g.nbrs(x).filter(|&k| g.atoms[k].el == "O").collect();
                if os.len() == 2 {
                    let keep: Vec<usize> = (0..n).filter(|&k| k != x && k != os[0]).collect();
                    let (mut sub, map) = subgraph(g, &keep);
                    add_bond(&mut sub, map[c], map[os[1]], 1.0);
                    sub.atoms[map[os[1]]].charge = 0;
                    let site = map[os[1]];
                    push(out, sub, 1.7, 13.0, 2, false, Some(site));
                }
            }
        }
    }
}

/// Decays of even-electron ions.
fn ee_decays(ion: &Ion, out: &mut Vec<Channel>) {
    let push = |out: &mut Vec<Channel>, child: Ion, e0: f64, loga: f64, nn: usize| {
        out.push(Channel { child, e0, loga, n_neutral: nn });
    };
    if let Some((n, m)) = ion.hc {
        let sat = m == 2 * n + 1;
        // hydrogen loss
        if m >= 3 && n >= 2 {
            push(out, hc_ion(n, m - 2, ion.e_form + if sat { 2.0 } else { 3.0 }), if sat { 2.0 } else { 3.0 }, 13.5, 2);
        }
        if sat && n >= 3 {
            push(out, hc_ion(n - 1, m - 4, ion.e_form + 2.3), 2.3, 13.3, 5);
        }
        if sat && n >= 4 {
            for k in 2..=(n - 2) {
                let e0 = 1.3 + 0.4 * (3i32 - (n - k) as i32).max(0) as f64 + if n <= 4 { 0.6 } else { 0.0 };
                push(out, hc_ion(n - k, 2 * (n - k) + 1, ion.e_form + e0), e0, 12.8, 3 * k);
            }
        }
        if !sat && n >= 5 && m >= 3 {
            push(out, hc_ion(n - 2, m - 2, ion.e_form + if n >= 7 { 3.2 } else { 2.7 }), if n >= 7 { 3.2 } else { 2.7 }, 13.3, 4);
        }
        return;
    }
    let g = &ion.g;
    let Some(site) = ion.site else { return };
    // aromatic hydrocarbon cations
    if g.atoms.iter().all(|a| a.el == "C") && g.atoms.iter().any(|a| a.arom || true) && g.n() >= 4 {
        let n = g.n();
        let m = g.total_h() as usize;
        if n >= 5 && m >= 3 {
            let e0 = if n >= 7 { 3.3 } else if n == 6 { 3.3 } else { 2.7 };
            push(out, hc_ion(n - 2, m - 2, ion.e_form + e0), e0, 13.5, 4);
        }
        if n >= 4 && m >= 3 {
            push(out, hc_ion(n, m - 2, ion.e_form + 3.4), 3.4, 13.0, 2);
        }
        return;
    }
    // acylium: R-C(=O)+ -> R+ + CO
    if g.atoms[site].el == "C" && g.double_to(site, "O", None) && g.heavy_degree(site) == 2 {
        let o = g.nbrs(site).find(|&k| g.atoms[k].el == "O").unwrap();
        let r = g.nbrs(site).find(|&k| k != o).unwrap();
        let keep: Vec<usize> = (0..g.n()).filter(|&k| k != site && k != o).collect();
        let (sub, map) = subgraph(g, &keep);
        let e0 = (0.4 + ie_radical(&sub, map[r]) - 7.0).max(0.3);
        push(out, finish(Ion { g: sub, site: Some(map[r]), odd: false, hc: None, e_form: ion.e_form + e0, key: String::new() }), e0, 14.0, 2);
    }
    // oxonium / iminium: X+=C with an ethyl-or-longer group on the heteroatom loses an alkene
    if g.atoms[site].el == "C" {
        for z in g.nbrs(site).filter(|&k| matches!(g.atoms[k].el.as_str(), "O" | "N" | "S")).collect::<Vec<_>>() {
            for ca in g.nbrs(z).filter(|&k| k != site && g.atoms[k].el == "C" && g.is_sp3(k) && !g.ring_bond(z, k)).collect::<Vec<_>>() {
                for cb in g.nbrs(ca).filter(|&k| k != z && g.atoms[k].el == "C" && g.atoms[k].h > 0 && g.is_sp3(k)).collect::<Vec<_>>() {
                    let Some((keep, lose)) = is_bridge_split(g, z, ca) else { continue };
                    if !lose.contains(&cb) || !keep.contains(&site) {
                        continue;
                    }
                    let (mut sub, map) = subgraph(g, &keep);
                    sub.atoms[map[z]].h += 1;
                    let nn = lose.len() + lose.iter().map(|&i| g.atoms[i].h as usize).sum::<usize>();
                    push(out, finish(Ion { g: sub, site: Some(map[site]), odd: false, hc: None, e_form: ion.e_form + 1.2, key: String::new() }), 1.2, 12.5, nn);
                    break;
                }
            }
            // CH2=OH+ -> HCO+ + H2 (and the nitrogen / sulfur analogues)
            if g.atoms[site].h >= 1 && g.atoms[z].h >= 1 && g.heavy_degree(site) == 1 && g.heavy_degree(z) == 1 {
                let mut sub = g.clone();
                sub.atoms[site].h -= 1;
                sub.atoms[z].h -= 1;
                push(out, finish(Ion { g: sub, site: Some(site), odd: false, hc: None, e_form: ion.e_form + 1.6, key: String::new() }), 1.6, 12.8, 2);
            }
        }
    }
}

fn channels_of(ion: &Ion, prm: &EiParams) -> Vec<Channel> {
    let mut out: Vec<Channel> = Vec::new();
    if let (true, Some(_)) = (ion.odd, ion.hc) {
        odd_hc_decays(ion, &mut out);
    } else if ion.odd {
        let ie_ref = ie_molecule(&ion.g);
        simple_cleavages(ion, ie_ref, &mut out);
        n_h_loss_channels(ion, ie_ref, &mut out);
        let n_simple = out.len();
        for c in out.iter_mut() {
            c.e0 = (c.e0 + prm.cleave_shift).max(0.05);
            c.child.e_form = ion.e_form + c.e0;
        }
        let _ = n_simple;
        let before = out.len();
        rearrangements(ion, ie_ref, &mut out);
        for c in out.iter_mut().skip(before) {
            c.e0 = (c.e0 + prm.rearr_shift).max(0.05);
            c.child.e_form = ion.e_form + c.e0;
        }
    } else {
        ee_decays(ion, &mut out);
    }
    out
}

/// Decays of unsaturated hydrocarbon radical cations (C4H4+., C5H6+., ...), described by formula only.
fn odd_hc_decays(ion: &Ion, out: &mut Vec<Channel>) {
    let (n, m) = ion.hc.unwrap();
    let push = |out: &mut Vec<Channel>, child: Ion, e0: f64, loga: f64, nn: usize| out.push(Channel { child, e0, loga, n_neutral: nn });
    if m >= 2 {
        let e0 = if n >= 5 { 2.3 } else { 3.0 };
        push(out, hc_ion(n, m - 1, ion.e_form + e0), e0, 13.5, 1);
    }
    if n >= 4 && m >= 3 {
        let mut c = hc_ion(n - 2, m - 2, ion.e_form + 3.3);
        c.odd = true;
        c.key = format!("HCo{}_{}", n - 2, m - 2);
        push(out, c, 3.3, 13.5, 4);
    }
    if n >= 6 && m >= 4 {
        push(out, hc_ion(n - 1, m - 3, ion.e_form + 2.4), 2.4, 14.0, 4);
    }
}

// ------------------------------------------------------------------------------------------------------ QET

fn ion_label(ion: &Ion) -> String {
    if let Some((n, m)) = ion.hc {
        return format!("{}{}", hill(&[("C".to_string(), n as u32), ("H".to_string(), m as u32)]), if ion.odd { "+•" } else { "+" });
    }
    format!("{}{}", ion.g.formula(), if ion.odd { "+•" } else { "+" })
}

fn hill(counts: &[(String, u32)]) -> String {
    counts.iter().map(|(e, n)| if *n == 1 { e.clone() } else if *n == 0 { String::new() } else { format!("{}{}", e, n) }).collect()
}

fn ion_counts(ion: &Ion) -> Vec<(String, u32)> {
    if let Some((n, m)) = ion.hc {
        return vec![("C".to_string(), n as u32), ("H".to_string(), m as u32)];
    }
    ion.g.element_counts()
}

/// 70 eV EI spectrum of `smiles` (a single neutral molecule). None when the structure cannot be treated.
pub fn ei_spectrum(g: &Mol, theta_ev: f64) -> Option<(Vec<EiPeak>, f64)> {
    let mut p = EiParams::default();
    p.theta = theta_ev;
    ei_spectrum_with(g, &p)
}

pub fn ei_spectrum_with(g: &Mol, prm: &EiParams) -> Option<(Vec<EiPeak>, f64)> {
    let n = g.n();
    if n == 0 || n > 70 {
        return None;
    }
    let ie_m = ie_molecule(g);
    let mut root = Ion { g: g.clone(), site: None, odd: true, hc: None, e_form: ie_m, key: String::new() };
    root.key = make_key(&root.g, true, None);
    let nb = (E_MAX / E_STEP) as usize + 1;
    // initial distribution of the internal energy of M+. (gamma, shape 2)
    let mut p0 = vec![0.0f64; nb];
    for (i, p) in p0.iter_mut().enumerate() {
        let e = (i as f64 + 0.5) * E_STEP;
        let (th1, th2) = (prm.theta, prm.theta * prm.tail);
        let body = (1.0 - prm.w2) * e / (th1 * th1) * (-e / th1).exp() + prm.w2 * e / (th2 * th2) * (-e / th2).exp();
        *p = prm.w_low * (-e / prm.theta_low).exp() / prm.theta_low + (1.0 - prm.w_low) * body;
    }
    let tot: f64 = p0.iter().sum();
    for p in p0.iter_mut() {
        *p /= tot;
    }
    let mut nodes: Vec<Ion> = vec![root.clone()];
    let mut index: HashMap<String, usize> = HashMap::new();
    index.insert(root.key.clone(), 0);
    let mut pop: Vec<Vec<f64>> = vec![p0];
    let mut surv: Vec<f64> = vec![0.0];
    let mut chan_cache: Vec<Option<Vec<Channel>>> = vec![None];
    // process nodes in order of increasing formation energy
    let mut done = vec![false];
    let mut guard = 0;
    loop {
        guard += 1;
        if guard > 2000 {
            break;
        }
        // next unprocessed node of lowest e_form
        let mut pick: Option<usize> = None;
        for (i, nd) in nodes.iter().enumerate() {
            if !done[i] && pick.map_or(true, |p| nd.e_form < nodes[p].e_form) {
                pick = Some(i);
            }
        }
        let Some(i) = pick else { break };
        done[i] = true;
        let ion = nodes[i].clone();
        let chans = channels_of(&ion, prm);
        let s = (prm.s_factor * (3.0 * n_atoms_with_h(&ion.g).max(2) as f64 - 6.0)).max(2.0);
        let s = if ion.hc.is_some() { (prm.s_factor * (3.0 * (ion.hc.unwrap().0 + ion.hc.unwrap().1) as f64 - 6.0)).max(3.0) } else { s };
        // channel -> node index
        let mut targets: Vec<usize> = Vec::with_capacity(chans.len());
        for ch in &chans {
            let idx = match index.get(&ch.child.key) {
                Some(&k) => k,
                None => {
                    if nodes.len() >= 900 {
                        targets.push(usize::MAX);
                        continue;
                    }
                    let k = nodes.len();
                    index.insert(ch.child.key.clone(), k);
                    nodes.push(ch.child.clone());
                    pop.push(vec![0.0; nb]);
                    surv.push(0.0);
                    chan_cache.push(None);
                    done.push(false);
                    k
                }
            };
            targets.push(idx);
        }
        let s_child = |c: &Channel| -> f64 { (prm.s_factor * (3.0 * n_atoms_with_h(&c.child.g).max(2) as f64 - 6.0)).max(2.0) };
        for e_i in 0..nb {
            let p = pop[i][e_i];
            if p < 1e-12 {
                continue;
            }
            let e = (e_i as f64 + 0.5) * E_STEP;
            let mut ks: Vec<f64> = Vec::with_capacity(chans.len());
            let mut ktot = 0.0;
            for ch in &chans {
                let k = if e > ch.e0 { 10f64.powf(ch.loga) * ((e - ch.e0) / e).powf(s - 1.0) } else { 0.0 };
                ks.push(k);
                ktot += k;
            }
            let decay = if ktot > 0.0 { 1.0 - (-ktot * prm.tau).exp() } else { 0.0 };
            surv[i] += p * (1.0 - decay);
            if decay <= 0.0 {
                continue;
            }
            for (ci, ch) in chans.iter().enumerate() {
                if ks[ci] <= 0.0 || targets[ci] == usize::MAX {
                    continue;
                }
                let flux = p * decay * ks[ci] / ktot;
                let sc = s_child(ch);
                let sn = (3.0 * ch.n_neutral as f64 - 6.0).max(1.0) * prm.s_factor + 1.0;
                let share = sc / (sc + sn);
                let e_d = (e - ch.e0).max(0.0) * share * prm.keep;
                let bin = ((e_d / E_STEP) as usize).min(nb - 1);
                pop[targets[ci]][bin] += flux;
            }
        }
    }
    // peaks
    let mut by_mz: HashMap<i32, (f64, f64, String, bool)> = HashMap::new(); // mz -> (intensity, best node weight, label, molecular)
    let m_nominal = mass_of(g)?.round() as i32;
    for (i, ion) in nodes.iter().enumerate() {
        let w = surv[i];
        if w < 1e-6 {
            continue;
        }
        let counts = ion_counts(ion);
        let Some(dist) = isotopes::distribution(&counts, 1e-4) else { continue };
        let label = ion_label(ion);
        for (k, line) in dist.iter().enumerate() {
            let entry = by_mz.entry(line.nominal).or_insert((0.0, 0.0, String::new(), false));
            entry.0 += w * line.p;
            let contribution = w * line.p;
            if contribution > entry.1 {
                entry.1 = contribution;
                entry.2 = if k == 0 { label.clone() } else if k == 1 { format!("{} (M+1 isotopes)", label) } else { format!("{} (M+{})", label, k) };
            }
            if i == 0 && k == 0 {
                entry.3 = true;
            }
        }
    }
    let top = by_mz.values().map(|v| v.0).fold(0.0, f64::max);
    if top <= 0.0 {
        return None;
    }
    let mut peaks: Vec<EiPeak> = by_mz
        .into_iter()
        .map(|(mz, (inten, _, label, molecular))| EiPeak { mz, intensity: inten / top * 100.0, label, molecular })
        .filter(|p| p.intensity >= 0.25 && p.mz >= 1)
        .collect();
    peaks.sort_by_key(|p| p.mz);
    let _ = m_nominal;
    Some((peaks, ie_m))
}

/// Root-ion channels with their threshold energies (diagnostics and tests): (child label, E0 eV, log10 A).
pub fn root_channels(g: &Mol) -> (f64, Vec<(String, f64, f64)>) {
    let ie = ie_molecule(g);
    let root = finish(Ion { g: g.clone(), site: None, odd: true, hc: None, e_form: ie, key: String::new() });
    let ch = channels_of(&root, &EiParams::default());
    (ie, ch.into_iter().map(|c| (ion_label(&c.child), c.e0, c.loga)).collect())
}
