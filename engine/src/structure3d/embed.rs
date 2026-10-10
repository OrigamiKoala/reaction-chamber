//! Embedding: distance geometry on the skeleton in 4D (exact 1-2 and 1-3 distances, 1-4 distances from the torsion
//! class, van der Waals lower bounds), squeezed into 3D, refined by a small force field (bonds, angles, planarity,
//! torsions, soft repulsion); hydrogens are then put on the ideal directions of their atom and the whole molecule is
//! refined again. Disconnected pieces are embedded one by one and packed side by side. Fixed seeds: deterministic.

use std::collections::VecDeque;

use super::geometry::{add, cross, dot, norm, polyhedron, scale, square_planar, sub, unit, Topo, V3};
use super::graph::BuildGraph;

// ---------------------------------------------------------------------------------------------- minimiser

/// L-BFGS (6 pairs of memory, preallocated ring buffers) with an Armijo backtracking line search and a cap on the largest
/// coordinate step; stops when the largest gradient component is below `gtol`. Returns the number of iterations.
pub(super) fn lbfgs(x: &mut [f64], max_iter: usize, gtol: f64, max_step: f64, mut f: impl FnMut(&[f64], &mut [f64]) -> f64) -> usize {
    const M: usize = 6;
    let n = x.len();
    let mut g = vec![0.0; n];
    let mut e = f(x, &mut g);
    let mut s_hist = vec![vec![0.0; n]; M];
    let mut y_hist = vec![vec![0.0; n]; M];
    let mut rho = [0.0f64; M];
    let mut alpha = [0.0f64; M];
    let (mut head, mut len) = (0usize, 0usize); // next slot, entries stored
    let mut xt = vec![0.0; n];
    let mut gt = vec![0.0; n];
    let mut d = vec![0.0; n];
    let dotp = |a: &[f64], b: &[f64]| -> f64 { a.iter().zip(b).map(|(p, q)| p * q).sum() };
    let amax = |a: &[f64]| a.iter().fold(0.0f64, |m, v| m.max(v.abs()));
    let mut it = 0;
    while it < max_iter {
        let gmax = amax(&g);
        if gmax < gtol {
            break;
        }
        it += 1;
        d.copy_from_slice(&g);
        for k in 0..len {
            let i = (head + M - 1 - k) % M;
            alpha[i] = rho[i] * dotp(&s_hist[i], &d);
            let (a, y) = (alpha[i], &y_hist[i]);
            d.iter_mut().zip(y).for_each(|(dv, yv)| *dv -= a * yv);
        }
        if len > 0 {
            let last = (head + M - 1) % M;
            let gamma = 1.0 / (rho[last] * dotp(&y_hist[last], &y_hist[last])).max(1e-12);
            d.iter_mut().for_each(|v| *v *= gamma);
        } else {
            let sc = max_step / gmax.max(1e-12);
            d.iter_mut().for_each(|v| *v *= sc);
        }
        for k in (0..len).rev() {
            let i = (head + M - 1 - k) % M;
            let beta = rho[i] * dotp(&y_hist[i], &d);
            let (c, sv) = (alpha[i] - beta, &s_hist[i]);
            d.iter_mut().zip(sv).for_each(|(dv, s)| *dv += c * s);
        }
        d.iter_mut().for_each(|v| *v = -*v);
        let mut dg = dotp(&d, &g);
        if dg >= 0.0 {
            // not a descent direction: steepest descent, memory dropped
            len = 0;
            let sc = max_step / gmax.max(1e-12);
            d.iter_mut().zip(&g).for_each(|(dv, gv)| *dv = -gv * sc);
            dg = dotp(&d, &g);
        }
        let dmax = amax(&d);
        if dmax > max_step {
            let sc = max_step / dmax;
            d.iter_mut().for_each(|v| *v *= sc);
            dg *= sc;
        }
        let mut step = 1.0;
        let mut et;
        loop {
            xt.iter_mut().zip(x.iter()).zip(&d).for_each(|((t, xv), dv)| *t = xv + step * dv);
            et = f(&xt, &mut gt);
            if et <= e + 1e-4 * step * dg || step < 1e-4 {
                break;
            }
            step *= 0.5;
        }
        if et > e && step < 1e-4 {
            if len == 0 {
                break;
            }
            len = 0;
            continue;
        }
        let slot = head;
        for j in 0..n {
            s_hist[slot][j] = xt[j] - x[j];
            y_hist[slot][j] = gt[j] - g[j];
        }
        let sy = dotp(&s_hist[slot], &y_hist[slot]);
        x.copy_from_slice(&xt);
        g.copy_from_slice(&gt);
        e = et;
        if sy > 1e-12 {
            rho[slot] = 1.0 / sy;
            head = (head + 1) % M;
            len = (len + 1).min(M);
        }
    }
    it
}

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> f64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        (self.0 >> 11) as f64 / (1u64 << 53) as f64
    }
}

// ---------------------------------------------------------------------------------------------- topology helpers

/// All-pairs topological distances over the atoms `atoms` (graph edges among them only).
fn topo_dist(t: &Topo, n: usize) -> Vec<Vec<u16>> {
    let mut d = vec![vec![u16::MAX; n]; n];
    for s in 0..n {
        d[s][s] = 0;
        let mut q = VecDeque::new();
        q.push_back(s);
        while let Some(u) = q.pop_front() {
            for v in t.nbrs(u) {
                if v < n && d[s][v] == u16::MAX {
                    d[s][v] = d[s][u] + 1;
                    q.push_back(v);
                }
            }
        }
    }
    d
}

/// Skeleton atoms reachable from `a` without passing `from`.
fn branch_size(t: &Topo, a: usize, from: usize) -> usize {
    let ns = t.n_skel;
    let mut seen = vec![false; ns];
    seen[from] = true;
    seen[a] = true;
    let mut q = vec![a];
    let mut n = 0;
    while let Some(u) = q.pop() {
        n += 1;
        for v in t.nbrs(u) {
            if v < ns && !seen[v] {
                seen[v] = true;
                q.push(v);
            }
        }
    }
    n
}

/// A path from a to d of at most `max_len` bonds that avoids the atoms `avoid`.
fn path_avoiding(t: &Topo, a: usize, d: usize, avoid: &[usize], max_len: usize) -> bool {
    let n = t.n();
    let mut dist = vec![usize::MAX; n];
    dist[a] = 0;
    let mut q = VecDeque::new();
    q.push_back(a);
    while let Some(u) = q.pop_front() {
        if dist[u] >= max_len {
            continue;
        }
        for v in t.nbrs(u) {
            if avoid.contains(&v) || dist[v] != usize::MAX {
                continue;
            }
            dist[v] = dist[u] + 1;
            if v == d {
                return true;
            }
            q.push_back(v);
        }
    }
    false
}

fn bond_len(t: &Topo, a: usize, b: usize) -> f64 {
    t.bond_between(a, b).map(|k| t.r0[k]).unwrap_or(1.5)
}

fn d13(r1: f64, r2: f64, th: f64) -> f64 {
    (r1 * r1 + r2 * r2 - 2.0 * r1 * r2 * th.cos()).max(0.0).sqrt()
}

/// 1-4 distance of a-b-c-d for torsion phi.
fn d14(r1: f64, r2: f64, r3: f64, t1: f64, t2: f64, phi: f64) -> f64 {
    let v = r1 * r1 + r2 * r2 + r3 * r3 - 2.0 * r1 * r2 * t1.cos() - 2.0 * r2 * r3 * t2.cos()
        + 2.0 * r1 * r3 * (t1.cos() * t2.cos() - t1.sin() * t2.sin() * phi.cos());
    v.max(0.0).sqrt()
}

// ---------------------------------------------------------------------------------------------- distance geometry

struct Bounds {
    pairs: Vec<(usize, usize, f64, f64)>,
    lower: Vec<(usize, usize, f64)>,
}

fn subset_bounds(t: &Topo, atoms: &[usize], top: &[Vec<u16>]) -> Bounds {
    let m = atoms.len();
    let mut loc = vec![usize::MAX; t.n()];
    for (k, &a) in atoms.iter().enumerate() {
        loc[a] = k;
    }
    let inside = |i: usize| loc[i] != usize::MAX;
    let mut set: std::collections::HashMap<(usize, usize), (f64, f64)> = std::collections::HashMap::new();
    let key = |a: usize, b: usize| { let (a, b) = (loc[a], loc[b]); if a < b { (a, b) } else { (b, a) } };
    for (k, b) in t.g.bonds.iter().enumerate() {
        if inside(b.a) && inside(b.b) {
            set.insert(key(b.a, b.b), (t.r0[k], t.r0[k]));
        }
    }
    for &(a, c, b, th) in &t.angles {
        if inside(a) && inside(b) && inside(c) && !set.contains_key(&key(a, b)) {
            let d = d13(bond_len(t, a, c), bond_len(t, c, b), th);
            set.insert(key(a, b), (d, d));
        }
    }
    let pi = std::f64::consts::PI;
    for bd in t.g.bonds.iter() {
        let (b, c) = (bd.a, bd.b);
        if !inside(b) || !inside(c) {
            continue;
        }
        let a_list: Vec<usize> = t.nbrs(b).filter(|&x| x != c && inside(x)).collect();
        let d_list: Vec<usize> = t.nbrs(c).filter(|&x| x != b && inside(x)).collect();
        if a_list.is_empty() || d_list.is_empty() {
            continue;
        }
        let rigid = !t.metal[b] && !t.metal[c] && t.planar[b] && t.planar[c];
        let linear = t.linear[b] || t.linear[c];
        let in_ring = t.bond_ring_size(b, c, 9).is_some();
        let best_branch = |list: &[usize], from: usize| -> usize {
            *list.iter().max_by_key(|&&x| (branch_size(t, x, from), usize::MAX - x)).unwrap()
        };
        let (a_ref, d_ref) = (best_branch(&a_list, b), best_branch(&d_list, c));
        // planar bond: the reference pair is cis when it closes a ring, else trans (E / s-trans)
        let mut ref_pair = (a_ref, d_ref, true);
        if rigid {
            'outer: for &a in &a_list {
                for &d in &d_list {
                    if a != d && path_avoiding(t, a, d, &[b, c], 5) {
                        ref_pair = (a, d, false);
                        break 'outer;
                    }
                }
            }
        }
        let anti_chain = !rigid && !linear && !in_ring && !t.metal[b] && !t.metal[c] && t.sn[b] == 4 && t.sn[c] == 4;
        for &a in &a_list {
            for &d in &d_list {
                if a == d || top[a][d] != 3 || set.contains_key(&key(a, d)) {
                    continue;
                }
                let (Some(t1), Some(t2)) = (t.ideal_angle(a, b, c), t.ideal_angle(b, c, d)) else { continue };
                let (r1, r2, r3) = (bond_len(t, a, b), bond_len(t, b, c), bond_len(t, c, d));
                let cis = d14(r1, r2, r3, t1, t2, 0.0);
                let trans = d14(r1, r2, r3, t1, t2, pi);
                let gauche = d14(r1, r2, r3, t1, t2, pi / 3.0);
                let (lo, hi) = if linear {
                    (cis, cis)
                } else if rigid {
                    let is_trans = ref_pair.2 ^ (a != ref_pair.0) ^ (d != ref_pair.1);
                    if is_trans { (trans, trans) } else { (cis, cis) }
                } else if anti_chain {
                    if a == a_ref && d == d_ref { (trans, trans) } else { (gauche - 0.1, trans) }
                } else {
                    (cis, trans)
                };
                set.insert(key(a, d), (lo, hi));
            }
        }
    }
    let mut pairs: Vec<(usize, usize, f64, f64)> = set.into_iter().map(|((a, b), (lo, hi))| (a, b, lo, hi)).collect();
    pairs.sort_by(|x, y| (x.0, x.1).cmp(&(y.0, y.1)));
    let mut have = vec![vec![false; m]; m];
    for p in &pairs {
        have[p.0][p.1] = true;
    }
    let mut lower = Vec::new();
    for i in 0..m {
        for j in i + 1..m {
            let (gi, gj) = (atoms[i], atoms[j]);
            if !have[i][j] && top[gi][gj] >= 3 {
                let lo = 0.85 * (t.vdw[gi] + t.vdw[gj]);
                lower.push((i, j, lo));
            }
        }
    }
    Bounds { pairs, lower }
}

const DIM: usize = 4;

fn dg_energy(b: &Bounds, kw: f64, x: &[f64], g: &mut [f64]) -> f64 {
    g.iter_mut().for_each(|v| *v = 0.0);
    let mut e = 0.0;
    let mut term = |i: usize, j: usize, lo: f64, hi: f64, g: &mut [f64]| {
        let mut d = [0.0; DIM];
        let mut d2 = 0.0;
        for k in 0..DIM {
            d[k] = x[i * DIM + k] - x[j * DIM + k];
            d2 += d[k] * d[k];
        }
        let de_dd2 = if d2 > hi * hi {
            let u = d2 / (hi * hi) - 1.0;
            e += u * u;
            2.0 * u / (hi * hi)
        } else if d2 < lo * lo {
            let l2 = lo * lo;
            let f = 2.0 * l2 / (l2 + d2) - 1.0;
            e += f * f;
            2.0 * f * (-2.0 * l2 / ((l2 + d2) * (l2 + d2)))
        } else {
            return;
        };
        for k in 0..DIM {
            let gk = de_dd2 * 2.0 * d[k];
            g[i * DIM + k] += gk;
            g[j * DIM + k] -= gk;
        }
    };
    for &(i, j, lo, hi) in &b.pairs {
        term(i, j, lo, hi, g);
    }
    for &(i, j, lo) in &b.lower {
        term(i, j, lo, f64::INFINITY, g);
    }
    if kw > 0.0 {
        let n = x.len() / DIM;
        for i in 0..n {
            let w = x[i * DIM + 3];
            e += kw * w * w;
            g[i * DIM + 3] += 2.0 * kw * w;
        }
    }
    e
}

/// Distance-geometry coordinates of the atoms `atoms` (in that order).
fn distance_geometry(t: &Topo, atoms: &[usize], top: &[Vec<u16>], seed: u64) -> Vec<V3> {
    let m = atoms.len();
    let b = subset_bounds(t, atoms, top);
    let mut rng = Rng(0x9E37_79B9_7F4A_7C15 ^ seed.wrapping_mul(0xD1B5_4A32_D192_ED03).wrapping_add(1));
    let side = 1.5 * (m as f64).cbrt() + 1.0;
    let mut x: Vec<f64> = (0..m * DIM).map(|_| (rng.next() - 0.5) * 2.0 * side).collect();
    lbfgs(&mut x, 300, 1e-2, 0.5, |x, g| dg_energy(&b, 0.0, x, g));
    for kw in [0.05, 0.5, 5.0] {
        lbfgs(&mut x, 80, 1e-2, 0.5, |x, g| dg_energy(&b, kw, x, g));
    }
    (0..m).map(|i| [x[i * DIM], x[i * DIM + 1], x[i * DIM + 2]]).collect()
}

// ---------------------------------------------------------------------------------------------- force field

struct ForceField {
    bonds: Vec<(usize, usize, f64)>,
    angles: Vec<(usize, usize, usize, f64)>,
    oop: Vec<(usize, usize, usize, usize)>,
    tors: Vec<(usize, usize, usize, usize, f64, f64, f64)>,
    rep: Vec<(u32, u32, f32)>,
}

const K_BOND: f64 = 700.0;
const K_ANGLE: f64 = 120.0;
const K_OOP: f64 = 40.0;
const K_REP: f64 = 100.0;

fn build_ff(t: &Topo, include: &[bool], top: &[Vec<u16>]) -> ForceField {
    let n = t.n();
    let inside = |i: usize| include[i];
    let bonds = t.g.bonds.iter().enumerate().filter(|(_, b)| inside(b.a) && inside(b.b)).map(|(k, b)| (b.a, b.b, t.r0[k])).collect();
    let angles = t.angles.iter().filter(|&&(a, c, b, _)| inside(a) && inside(b) && inside(c)).copied().collect();
    let mut oop = Vec::new();
    for c in 0..n {
        if inside(c) && t.planar[c] && !t.metal[c] {
            let nb: Vec<usize> = t.nbrs(c).filter(|&j| inside(j)).collect();
            if nb.len() == 3 {
                oop.push((c, nb[0], nb[1], nb[2]));
            }
        }
    }
    let mut tors = Vec::new();
    let pi = std::f64::consts::PI;
    for bd in t.g.bonds.iter() {
        let (b, c) = (bd.a, bd.b);
        if !inside(b) || !inside(c) || t.linear[b] || t.linear[c] || t.metal[b] || t.metal[c] {
            continue;
        }
        let a_list: Vec<usize> = t.nbrs(b).filter(|&x| x != c && inside(x)).collect();
        let d_list: Vec<usize> = t.nbrs(c).filter(|&x| x != b && inside(x)).collect();
        if a_list.is_empty() || d_list.is_empty() {
            continue;
        }
        let ring = t.bond_ring_size(b, c, 9);
        let (mult, phase, kk) = if t.planar[b] && t.planar[c] {
            if bd.order >= 1.5 || bd.aromatic || ring.is_some() { (2.0, pi, 6.0) } else { (2.0, pi, 0.4) }
        } else if t.sn[b] == 4 && t.sn[c] == 4 && !matches!(ring, Some(3) | Some(4)) {
            (3.0, 0.0, 0.3)
        } else {
            continue;
        };
        if mult == 2.0 && kk > 1.0 {
            // rigid planar bond (aromatic, double, in a ring): every quad, so fused aromatic systems stay flat
            for &a in &a_list {
                for &d in &d_list {
                    if a != d {
                        tors.push((a, b, c, d, mult, phase, kk));
                    }
                }
            }
        } else {
            // one quad per bond (heavy neighbours first): the rigid local geometry carries the other substituents along
            let pick = |list: &[usize]| *list.iter().min_by_key(|&&x| (x >= t.n_skel, x)).unwrap();
            let (a, d) = (pick(&a_list), pick(&d_list));
            if a != d {
                tors.push((a, b, c, d, mult, phase, kk));
            }
        }
    }
    let mut rep = Vec::new();
    for i in (0..n).filter(|&i| inside(i)) {
        for j in (i + 1..n).filter(|&j| inside(j)) {
            let tp = top[i][j];
            if tp >= 3 {
                let s = if tp == 3 { 0.84 } else { 0.86 };
                let d0 = s * (t.vdw[i] + t.vdw[j]);
                rep.push((i as u32, j as u32, d0 as f32));
            }
        }
    }
    ForceField { bonds, angles, oop, tors, rep }
}

fn p3(x: &[f64], i: usize) -> V3 {
    [x[3 * i], x[3 * i + 1], x[3 * i + 2]]
}
fn acc(g: &mut [f64], i: usize, v: V3) {
    g[3 * i] += v[0];
    g[3 * i + 1] += v[1];
    g[3 * i + 2] += v[2];
}

fn ff_energy(ff: &ForceField, active: &[usize], x: &[f64], g: &mut [f64]) -> f64 {
    g.iter_mut().for_each(|v| *v = 0.0);
    let mut e = 0.0;
    for &(a, b, r0) in &ff.bonds {
        let d = sub(p3(x, a), p3(x, b));
        let r = norm(d).max(1e-9);
        let dr = r - r0;
        e += K_BOND * dr * dr;
        let f = scale(d, 2.0 * K_BOND * dr / r);
        acc(g, a, f);
        acc(g, b, scale(f, -1.0));
    }
    for &(a, c, b, th0) in &ff.angles {
        // cosine form with the curvature of K (theta - theta0)^2 at the minimum: K (cos - cos0)^2 / sin^2(theta0), and
        // 2 K (1 + cos) for a linear centre
        let (pa, pc, pb) = (p3(x, a), p3(x, c), p3(x, b));
        let (u, v) = (sub(pa, pc), sub(pb, pc));
        let (ru, rv) = (norm(u).max(1e-9), norm(v).max(1e-9));
        let (uu, vv) = (scale(u, 1.0 / ru), scale(v, 1.0 / rv));
        let cs = dot(uu, vv).clamp(-1.0, 1.0);
        let de_dcos = if th0 > 3.1 {
            e += 2.0 * K_ANGLE * (1.0 + cs);
            2.0 * K_ANGLE
        } else {
            let (c0, s0) = (th0.cos(), th0.sin());
            let k = K_ANGLE / (s0 * s0);
            e += k * (cs - c0) * (cs - c0);
            2.0 * k * (cs - c0)
        };
        let ga = scale(sub(vv, scale(uu, cs)), de_dcos / ru);
        let gb = scale(sub(uu, scale(vv, cs)), de_dcos / rv);
        acc(g, a, ga);
        acc(g, b, gb);
        acc(g, c, scale(add(ga, gb), -1.0));
    }
    for &(c, a, b, d) in &ff.oop {
        let pc = p3(x, c);
        let (ua, ub, ud) = (sub(p3(x, a), pc), sub(p3(x, b), pc), sub(p3(x, d), pc));
        let vol = dot(ua, cross(ub, ud));
        e += K_OOP * vol * vol;
        let de = 2.0 * K_OOP * vol;
        let ga = scale(cross(ub, ud), de);
        let gb = scale(cross(ud, ua), de);
        let gd = scale(cross(ua, ub), de);
        acc(g, a, ga);
        acc(g, b, gb);
        acc(g, d, gd);
        acc(g, c, scale(add(add(ga, gb), gd), -1.0));
    }
    for &(a, b, c, d, n, _phase, k) in &ff.tors {
        let (x0, x1, x2, x3) = (p3(x, a), p3(x, b), p3(x, c), p3(x, d));
        let (b1, b2, b3) = (sub(x1, x0), sub(x2, x1), sub(x3, x2));
        let (n1, n2) = (cross(b1, b2), cross(b2, b3));
        let (n1s, n2s) = (dot(n1, n1), dot(n2, n2));
        let b2n = norm(b2);
        if n1s < 1e-10 || n2s < 1e-10 || b2n < 1e-9 {
            continue;
        }
        let inv = 1.0 / (n1s * n2s).sqrt();
        let (cp, sp) = (dot(n1, n2) * inv, b2n * dot(b1, n2) * inv);
        // E = k (1 + cos(n phi - phase)) for n = 2, phase = pi (planar) and n = 3, phase = 0 (staggered), as polynomials
        let de = if n == 2.0 {
            e += 2.0 * k * sp * sp;
            4.0 * k * sp * cp
        } else {
            e += k * (1.0 + 4.0 * cp * cp * cp - 3.0 * cp);
            -3.0 * k * (3.0 * sp - 4.0 * sp * sp * sp)
        };
        let g0 = scale(n1, -b2n / n1s);
        let g3 = scale(n2, b2n / n2s);
        let f1 = dot(b1, b2) / (b2n * b2n);
        let f3 = dot(b3, b2) / (b2n * b2n);
        let g1 = sub(scale(g0, f1 - 1.0), scale(g3, f3));
        let g2 = sub(scale(g3, f3 - 1.0), scale(g0, f1));
        acc(g, a, scale(g0, de));
        acc(g, b, scale(g1, de));
        acc(g, c, scale(g2, de));
        acc(g, d, scale(g3, de));
    }
    for &ri in active {
        let (i, j, d0) = ff.rep[ri];
        let (i, j, d0) = (i as usize, j as usize, d0 as f64);
        let d = sub(p3(x, i), p3(x, j));
        let r2 = dot(d, d);
        if r2 >= d0 * d0 {
            continue;
        }
        let r = r2.sqrt().max(1e-6);
        let dr = d0 - r;
        e += K_REP * dr * dr;
        let f = scale(d, -2.0 * K_REP * dr / r);
        acc(g, i, f);
        acc(g, j, scale(f, -1.0));
    }
    e
}

/// Force-field refinement of the atoms in `include` (the others stay where they are). The repulsion pairs are a Verlet list
/// (pairs within 1 A of their contact distance) rebuilt whenever an atom has moved 0.5 A from where the list was built, so
/// the energy stays exact.
fn refine(t: &Topo, include: &[bool], top: &[Vec<u16>], coords: &mut [V3], max_iter: usize) -> usize {
    let ff = build_ff(t, include, top);
    let n = t.n();
    let mut x: Vec<f64> = coords[..n].iter().flat_map(|p| p.iter().copied()).collect();
    let skin = 1.0f64;
    let build_list = |x: &[f64]| -> Vec<usize> {
        (0..ff.rep.len())
            .filter(|&k| {
                let (i, j, d0) = ff.rep[k];
                let d = sub(p3(x, i as usize), p3(x, j as usize));
                dot(d, d) < (d0 as f64 + skin).powi(2)
            })
            .collect()
    };
    let moving: Vec<usize> = (0..n).filter(|&i| include[i]).collect();
    let mut active = build_list(&x);
    let mut x_ref = x.clone();
    let it = lbfgs(&mut x, max_iter, 0.3, 0.15, |xx, g| {
        let moved = moving.iter().any(|&i| {
            let d = sub(p3(xx, i), p3(&x_ref, i));
            dot(d, d) > 0.25 * skin * skin
        });
        if moved {
            active = build_list(xx);
            x_ref.copy_from_slice(xx);
        }
        let e = ff_energy(&ff, &active, xx, g);
        for i in 0..n {
            if !include[i] {
                g[3 * i] = 0.0;
                g[3 * i + 1] = 0.0;
                g[3 * i + 2] = 0.0;
            }
        }
        e
    });
    for i in 0..n {
        coords[i] = p3(&x, i);
    }
    it
}

// ---------------------------------------------------------------------------------------------- hydrogens

fn rot_between(a: V3, b: V3) -> [[f64; 3]; 3] {
    let (a, b) = (unit(a), unit(b));
    let v = cross(a, b);
    let c = dot(a, b);
    if c < -0.999999 {
        // 180 degrees about any axis perpendicular to a
        let p = if a[0].abs() < 0.9 { [1.0, 0.0, 0.0] } else { [0.0, 1.0, 0.0] };
        let ax = unit(cross(a, p));
        return rot_axis(ax, std::f64::consts::PI);
    }
    let k = 1.0 / (1.0 + c);
    [
        [v[0] * v[0] * k + c, v[0] * v[1] * k - v[2], v[0] * v[2] * k + v[1]],
        [v[1] * v[0] * k + v[2], v[1] * v[1] * k + c, v[1] * v[2] * k - v[0]],
        [v[2] * v[0] * k - v[1], v[2] * v[1] * k + v[0], v[2] * v[2] * k + c],
    ]
}

fn rot_axis(ax: V3, ang: f64) -> [[f64; 3]; 3] {
    let (s, c) = ang.sin_cos();
    let t = 1.0 - c;
    let [x, y, z] = ax;
    [
        [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
        [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
        [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
    ]
}

fn apply(m: &[[f64; 3]; 3], v: V3) -> V3 {
    [dot(m[0], v), dot(m[1], v), dot(m[2], v)]
}

fn perp(v: V3, axis: V3) -> V3 {
    sub(v, scale(axis, dot(v, axis)))
}

fn signed_angle(from: V3, to: V3, axis: V3) -> f64 {
    dot(cross(from, to), axis).atan2(dot(from, to))
}

/// The free directions around atom `c` for `need` new neighbours: the ideal polyhedron of `c` aligned to its neighbours that
/// are already placed (`done`), the vertices they occupy removed. With a single placed neighbour the polyhedron is turned so
/// the first free direction is anti to a placed neighbour of that neighbour (staggered, zig-zag chains).
fn free_directions(t: &Topo, c: usize, x: &[V3], done: &[bool], need: usize, twist: f64) -> Vec<V3> {
    let deg = t.adj[c].len();
    let mut dirs = if t.metal[c] {
        if deg == 4 && matches!(t.ideal_angle(t.adj[c][0].0, c, t.adj[c][1].0).map(|a| a.to_degrees().round() as i64), Some(90) | Some(180)) {
            square_planar()
        } else {
            polyhedron(deg.max(1))
        }
    } else {
        polyhedron(t.sn[c].max(deg).max(1))
    };
    let placed: Vec<usize> = t.nbrs(c).filter(|&j| done[j]).collect();
    let pc = x[c];
    let u: Vec<V3> = placed.iter().map(|&j| unit(sub(x[j], pc))).collect();
    if u.is_empty() {
        if twist != 0.0 {
            let rr = rot_axis(unit([1.0, 2.0, 3.0]), twist);
            dirs = dirs.iter().map(|d| apply(&rr, *d)).collect();
        }
    } else {
        let r = rot_between(dirs[0], u[0]);
        dirs = dirs.iter().map(|d| apply(&r, *d)).collect();
        let axis = u[0];
        let target = if u.len() >= 2 {
            Some(perp(u[1], axis))
        } else {
            let n0 = placed[0];
            t.nbrs(n0).find(|&j| j != c && done[j]).map(|r| scale(perp(sub(x[r], x[n0]), axis), -1.0))
        };
        if let (Some(tg), true) = (target, dirs.len() > 1) {
            if norm(tg) > 1e-6 && norm(perp(dirs[1], axis)) > 1e-6 {
                let ang = signed_angle(perp(dirs[1], axis), tg, axis) + if u.len() == 1 { twist } else { 0.0 };
                let rr = rot_axis(axis, ang);
                dirs = dirs.iter().map(|d| apply(&rr, *d)).collect();
            }
        } else if twist != 0.0 && dirs.len() > 1 {
            let rr = rot_axis(axis, twist);
            dirs = dirs.iter().map(|d| apply(&rr, *d)).collect();
        }
    }
    let mut taken = vec![false; dirs.len()];
    for uv in &u {
        if let Some((k, _)) = dirs.iter().enumerate().filter(|(k, _)| !taken[*k]).max_by(|a, b| dot(*a.1, *uv).partial_cmp(&dot(*b.1, *uv)).unwrap()) {
            taken[k] = true;
        }
    }
    let mut free: Vec<V3> = dirs.iter().enumerate().filter(|(k, _)| !taken[*k]).map(|(_, d)| *d).collect();
    if free.len() < need {
        let extra = polyhedron(need + u.len());
        for d in extra {
            if free.len() >= need {
                break;
            }
            if u.iter().chain(free.iter()).all(|e| dot(*e, d) < 0.95) {
                free.push(d);
            }
        }
        while free.len() < need {
            free.push(free.last().copied().unwrap_or([1.0, 0.0, 0.0]));
        }
    }
    free
}

/// Puts the hydrogens (atoms >= `n_skel`) of each skeleton atom on its free directions.
fn place_hydrogens(t: &Topo, x: &mut [V3], done: &mut [bool]) {
    let ns = t.n_skel;
    for c in 0..ns {
        let hs: Vec<usize> = t.nbrs(c).filter(|&j| !done[j]).collect();
        if hs.is_empty() {
            continue;
        }
        let free = free_directions(t, c, x, done, hs.len(), 0.0);
        for (k, &h) in hs.iter().enumerate() {
            x[h] = add(x[c], scale(free[k], bond_len(t, c, h)));
            done[h] = true;
        }
    }
}

// ---------------------------------------------------------------------------------------------- tree build

/// Ring systems: skeleton atoms joined by ring bonds (fused, bridged and spiro rings form one system), each with its shell:
/// the acyclic skeleton atoms bonded to it (an atom between two systems belongs to the first one's shell).
fn ring_systems(t: &Topo) -> Vec<(Vec<usize>, Vec<usize>)> {
    let ns = t.n_skel;
    let mut parent: Vec<usize> = (0..ns).collect();
    fn find(p: &mut Vec<usize>, i: usize) -> usize {
        let mut r = i;
        while p[r] != r {
            r = p[r];
        }
        let mut k = i;
        while p[k] != r {
            let nx = p[k];
            p[k] = r;
            k = nx;
        }
        r
    }
    let mut in_ring = vec![false; ns];
    for b in &t.g.bonds {
        if b.a < ns && b.b < ns && t.bond_ring_size(b.a, b.b, ns + 1).is_some() {
            in_ring[b.a] = true;
            in_ring[b.b] = true;
            let (ra, rb) = (find(&mut parent, b.a), find(&mut parent, b.b));
            if ra != rb {
                parent[ra.max(rb)] = ra.min(rb);
            }
        }
    }
    let mut groups: std::collections::BTreeMap<usize, Vec<usize>> = std::collections::BTreeMap::new();
    for i in 0..ns {
        if in_ring[i] {
            let r = find(&mut parent, i);
            groups.entry(r).or_default().push(i);
        }
    }
    let systems: Vec<Vec<usize>> = groups.into_values().collect();
    let mut claimed = in_ring.clone();
    systems
        .into_iter()
        .map(|sys| {
            let mut shell = Vec::new();
            for &a in &sys {
                for j in t.nbrs(a) {
                    if j < ns && !claimed[j] {
                        claimed[j] = true;
                        shell.push(j);
                    }
                }
            }
            shell.sort();
            (sys, shell)
        })
        .collect()
}

/// The atoms a ring system is embedded and docked with: its ring atoms, its shell, and the hydrogens of its ring atoms
/// (whose directions the ring fixes; a shell atom's hydrogens wait for its other neighbours).
fn system_atoms(t: &Topo, sys: &(Vec<usize>, Vec<usize>)) -> Vec<usize> {
    let mut v: Vec<usize> = sys.0.iter().chain(sys.1.iter()).copied().collect();
    for &a in &sys.0 {
        v.extend(t.nbrs(a).filter(|&j| j >= t.n_skel));
    }
    v
}

/// Local coordinates of a ring system and its shell (system atoms first, then the shell, as listed), from distance geometry
/// + force field on those atoms alone; of up to three seeds the least strained (bond and angle deviation) is kept.
fn embed_ring_system(t: &Topo, sys: &(Vec<usize>, Vec<usize>), top: &[Vec<u16>], seed: u64) -> Vec<V3> {
    let heavy: Vec<usize> = sys.0.iter().chain(sys.1.iter()).copied().collect();
    let atoms = system_atoms(t, sys);
    let mut heavy_mask = vec![false; t.n()];
    for &a in &heavy {
        heavy_mask[a] = true;
    }
    let mut mask = vec![false; t.n()];
    for &a in &atoms {
        mask[a] = true;
    }
    let mut best: Option<(f64, Vec<V3>)> = None;
    let seeds = 3u64;
    for k in 0..seeds {
        let local = distance_geometry(t, &heavy, top, seed * 17 + k);
        let mut x = vec![[0.0; 3]; t.n()];
        for (i, &a) in heavy.iter().enumerate() {
            x[a] = local[i];
        }
        refine(t, &heavy_mask, top, &mut x, 400);
        let mut done = heavy_mask.clone();
        for &c in &sys.0 {
            let hs: Vec<usize> = t.nbrs(c).filter(|&j| j >= t.n_skel).collect();
            if !hs.is_empty() {
                let free = free_directions(t, c, &x, &done, hs.len(), 0.0);
                for (i, &h) in hs.iter().enumerate() {
                    x[h] = add(x[c], scale(free[i], bond_len(t, c, h)));
                    done[h] = true;
                }
            }
        }
        refine(t, &mask, top, &mut x, 400);
        let mut strain = 0.0f64;
        for (kb, b) in t.g.bonds.iter().enumerate() {
            if mask[b.a] && mask[b.b] {
                strain = strain.max((norm(sub(x[b.a], x[b.b])) - t.r0[kb]).abs() / t.r0[kb] / 0.03);
            }
        }
        for &(a, c, b, th) in &t.angles {
            if mask[a] && mask[b] && mask[c] {
                let ang = dot(unit(sub(x[a], x[c])), unit(sub(x[b], x[c]))).clamp(-1.0, 1.0).acos();
                strain = strain.max((ang - th).abs().to_degrees() / 6.0);
            }
        }
        if best.as_ref().map_or(true, |(s, _)| strain < *s) {
            best = Some((strain, atoms.iter().map(|&a| x[a]).collect()));
        }
        if strain < 0.5 {
            break;
        }
    }
    best.unwrap().1
}

/// Places ring system `s` (with the shell atoms not yet placed) so that its atom `r` sits at `pos_r`, bonded to the placed
/// atom `c`: along c's local direction when c is in the shell, else along one of r's free directions in the local frame;
/// turned about that bond to the least crowded of twelve orientations. Returns the atoms it placed.
fn dock_system(
    t: &Topo,
    sys: &(Vec<usize>, Vec<usize>),
    local: &[V3],
    r: usize,
    c: usize,
    pos_r: V3,
    x: &mut [V3],
    done: &mut [bool],
    top: &[Vec<u16>],
    attempt: u64,
) -> Vec<usize> {
    let atoms = system_atoms(t, sys);
    let li = |a: usize| atoms.iter().position(|&b| b == a);
    let lr = local[li(r).unwrap()];
    let f = match li(c) {
        Some(k) => unit(sub(local[k], lr)),
        None => {
            let mut lx = vec![[0.0; 3]; t.n()];
            let mut mask = vec![false; t.n()];
            for (k, &a) in atoms.iter().enumerate() {
                lx[a] = local[k];
                mask[a] = sys.0.contains(&a);
            }
            free_directions(t, r, &lx, &mask, 1, 0.0)[0]
        }
    };
    let body: Vec<usize> = (0..atoms.len()).filter(|&k| !done[atoms[k]]).collect();
    let g = unit(sub(x[c], pos_r));
    let r1 = rot_between(f, g);
    let placed: Vec<usize> = (0..t.n()).filter(|&b| done[b]).collect();
    let mut best: Option<(f64, Vec<V3>)> = None;
    for k in 0..12 {
        let phi = (k as f64 + 0.37 * attempt as f64) * std::f64::consts::PI / 6.0;
        let rr = rot_axis(g, phi);
        let pos: Vec<V3> = body.iter().map(|&kb| add(pos_r, apply(&rr, apply(&r1, sub(local[kb], lr))))).collect();
        let mut score = 0.0;
        for (ka, &kb) in body.iter().enumerate() {
            let a = atoms[kb];
            for &b in &placed {
                if top[a][b] >= 3 {
                    let d0 = 0.9 * (t.vdw[a] + t.vdw[b]);
                    let d = norm(sub(pos[ka], x[b]));
                    if d < d0 {
                        score += (d0 - d) * (d0 - d);
                    }
                }
            }
        }
        if best.as_ref().map_or(true, |(s, _)| score < *s - 1e-9) {
            best = Some((score, pos));
        }
    }
    let pos = best.unwrap().1;
    let mut out = Vec::new();
    for (ka, &kb) in body.iter().enumerate() {
        let a = atoms[kb];
        x[a] = pos[ka];
        done[a] = true;
        out.push(a);
    }
    out
}

/// Builds the skeleton outward from the largest ring system (or atom 0): each placed atom puts its unplaced neighbours on
/// its free directions (largest branch first, anti to the chain), a ring system is docked as a rigid body.
fn build_tree(t: &Topo, systems: &[(Vec<usize>, Vec<usize>)], locals: &[Vec<V3>], top: &[Vec<u16>], x: &mut [V3], done: &mut [bool], attempt: u64) {
    let ns = t.n_skel;
    let mut sys_of = vec![usize::MAX; t.n()];
    for (k, s) in systems.iter().enumerate() {
        for &a in &s.0 {
            sys_of[a] = k;
        }
    }
    let mut sys_done = vec![false; systems.len()];
    let mut queue = VecDeque::new();
    if let Some(root) = (0..systems.len()).max_by_key(|&k| (systems[k].0.len(), usize::MAX - k)) {
        for (k, &a) in system_atoms(t, &systems[root]).iter().enumerate() {
            x[a] = locals[root][k];
            done[a] = true;
            if a < ns {
                queue.push_back(a);
            }
        }
        sys_done[root] = true;
    } else {
        x[0] = [0.0; 3];
        done[0] = true;
        queue.push_back(0);
    }
    let twist = 0.5 * attempt as f64;
    while let Some(c) = queue.pop_front() {
        let mut todo: Vec<usize> = t.nbrs(c).filter(|&j| j < ns && !done[j]).collect();
        if todo.is_empty() {
            continue;
        }
        todo.sort_by_key(|&j| (usize::MAX - branch_size(t, j, c), j));
        let mut free = free_directions(t, c, x, done, todo.len(), twist);
        // free rotation about the bond to the only placed neighbour: of the staggered (planar) alternatives, the one whose new
        // atoms come least close to atoms already placed three or more bonds away
        if t.nbrs(c).filter(|&j| done[j]).count() == 1 && !t.metal[c] && (t.sn[c] == 4 || t.sn[c] == 3) {
            let near: Vec<usize> = (0..ns).filter(|&b| done[b] && top[b][c] >= 2).collect();
            let score = |dirs: &[V3]| -> f64 {
                let mut sc = 0.0;
                for (k, &j) in todo.iter().enumerate() {
                    let p = add(x[c], scale(dirs[k], bond_len(t, c, j)));
                    for &b in &near {
                        let d0 = 0.95 * (t.vdw[j] + t.vdw[b]);
                        let d = norm(sub(p, x[b]));
                        if d < d0 {
                            sc += (d0 - d) * (d0 - d);
                        }
                    }
                }
                sc
            };
            let turns: &[f64] = if t.sn[c] == 4 { &[2.0943951023931953, -2.0943951023931953] } else { &[std::f64::consts::PI] };
            let mut best = score(&free);
            for &tw in turns {
                if best <= 1e-9 {
                    break;
                }
                let alt = free_directions(t, c, x, done, todo.len(), twist + tw);
                let sc = score(&alt);
                if sc < best - 1e-9 {
                    best = sc;
                    free = alt;
                }
            }
        }
        for (k, &j) in todo.iter().enumerate() {
            if done[j] {
                continue;
            }
            let pos = add(x[c], scale(free[k], bond_len(t, c, j)));
            let s = sys_of[j];
            if s != usize::MAX && !sys_done[s] {
                let placed = dock_system(t, &systems[s], &locals[s], j, c, pos, x, done, top, attempt);
                sys_done[s] = true;
                queue.extend(placed.into_iter().filter(|&a| a < ns));
            } else {
                x[j] = pos;
                done[j] = true;
                queue.push_back(j);
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------- quality

#[derive(Clone, Copy, Debug, Default)]
pub struct Quality {
    /// Largest relative deviation of a bond from its ideal length.
    pub bond: f64,
    /// Largest deviation of an angle from its ideal value, degrees.
    pub angle: f64,
    /// Smallest distance / (van der Waals sum) over pairs three or more bonds apart (1.0 when there are none).
    pub clash: f64,
}

impl Quality {
    pub fn score(&self) -> f64 {
        (self.bond / 0.03).max(self.angle / 6.0).max(0.8 / self.clash.max(1e-6))
    }
}

pub fn quality(t: &Topo, x: &[V3], top: &[Vec<u16>]) -> Quality {
    let mut q = Quality { bond: 0.0, angle: 0.0, clash: 1.0 };
    for (k, b) in t.g.bonds.iter().enumerate() {
        let r = norm(sub(x[b.a], x[b.b]));
        q.bond = q.bond.max((r - t.r0[k]).abs() / t.r0[k]);
    }
    for &(a, c, b, th) in &t.angles {
        let u = unit(sub(x[a], x[c]));
        let v = unit(sub(x[b], x[c]));
        let ang = dot(u, v).clamp(-1.0, 1.0).acos();
        q.angle = q.angle.max((ang - th).abs().to_degrees());
    }
    let n = t.n();
    for i in 0..n {
        for j in i + 1..n {
            if top[i][j] >= 3 {
                let r = norm(sub(x[i], x[j]));
                let s = t.vdw[i] + t.vdw[j];
                q.clash = q.clash.min(r / s);
            }
        }
    }
    q
}

// ---------------------------------------------------------------------------------------------- connected piece

fn embed_connected(t: &Topo) -> Vec<V3> {
    let n = t.n();
    let top = topo_dist(t, n);
    let systems = ring_systems(t);
    let all = vec![true; n];
    let mut best: Option<(f64, Vec<V3>)> = None;
    for attempt in 0..4u64 {
        let mut x = vec![[0.0; 3]; n];
        let mut done = vec![false; n];
        let locals: Vec<Vec<V3>> = systems.iter().enumerate().map(|(k, s)| embed_ring_system(t, s, &top, attempt * 31 + k as u64)).collect();
        build_tree(t, &systems, &locals, &top, &mut x, &mut done, attempt);
        place_hydrogens(t, &mut x, &mut done);
        // a small deterministic jitter: a built structure can sit exactly on a symmetric saddle (a planar amide pressed
        // against an ortho hydrogen) that the forces alone would never leave
        let mut rng = Rng(0x2545_F491_4F6C_DD1D ^ (attempt + 1));
        for p in x.iter_mut() {
            for k in 0..3 {
                p[k] += (rng.next() - 0.5) * 0.06;
            }
        }
        refine(t, &all, &top, &mut x, 800);
        let q = quality(t, &x, &top);
        let s = q.score();
        if best.as_ref().map_or(true, |(bs, _)| s < *bs) {
            best = Some((s, x));
        }
        if s <= 1.0 {
            break;
        }
    }
    centre(best.unwrap().1)
}

fn centre(mut x: Vec<V3>) -> Vec<V3> {
    if x.is_empty() {
        return x;
    }
    let mut c = [0.0; 3];
    for p in &x {
        c = add(c, *p);
    }
    c = scale(c, 1.0 / x.len() as f64);
    for p in x.iter_mut() {
        *p = sub(*p, c);
    }
    x
}

// ---------------------------------------------------------------------------------------------- whole graph

/// Embeds a graph (hydrogens as counts): the topology with explicit hydrogens and one coordinate per atom.
pub fn embed(src: &BuildGraph) -> (Topo, Vec<V3>) {
    let t = Topo::new(src);
    let n = t.n();
    // connected pieces
    let mut comp = vec![usize::MAX; n];
    let mut pieces: Vec<Vec<usize>> = Vec::new();
    for s in 0..n {
        if comp[s] != usize::MAX {
            continue;
        }
        let id = pieces.len();
        let mut members = vec![s];
        comp[s] = id;
        let mut q = vec![s];
        while let Some(u) = q.pop() {
            for v in t.nbrs(u) {
                if comp[v] == usize::MAX {
                    comp[v] = id;
                    members.push(v);
                    q.push(v);
                }
            }
        }
        members.sort();
        pieces.push(members);
    }
    let mut coords = vec![[0.0; 3]; n];
    if pieces.len() == 1 {
        let x = embed_connected(&t);
        return (t, x);
    }
    let mut placed: Vec<(usize, V3)> = Vec::new();
    let mut order: Vec<usize> = (0..pieces.len()).collect();
    order.sort_by_key(|&p| (usize::MAX - pieces[p].len(), p));
    for &p in &order {
        let members = &pieces[p];
        // the piece as its own graph: its skeleton atoms first, then its hydrogens, both in global order
        let skel: Vec<usize> = members.iter().copied().filter(|&i| i < t.n_skel).collect();
        let hyd: Vec<usize> = members.iter().copied().filter(|&i| i >= t.n_skel).collect();
        let local: Vec<usize> = skel.iter().chain(hyd.iter()).copied().collect();
        let mut map = vec![usize::MAX; n];
        for (k, &i) in local.iter().enumerate() {
            map[i] = k;
        }
        let mut g = BuildGraph::default();
        for &i in &local {
            let k = g.add_atom(&t.g.el[i], t.g.charge[i]);
            g.arom[k] = t.g.arom[i];
            g.ox[k] = t.g.ox[i];
        }
        for b in &t.g.bonds {
            if map[b.a] != usize::MAX && map[b.b] != usize::MAX {
                g.bonds.push(super::graph::GBond { a: map[b.a], b: map[b.b], ..*b });
            }
        }
        let sub_t = Topo::from_explicit(g, skel.len());
        let x = embed_connected(&sub_t);
        let off = pack_offset(&t, &placed, &local, &x);
        for (k, &i) in local.iter().enumerate() {
            coords[i] = add(x[k], off);
            placed.push((i, coords[i]));
        }
    }
    let c = centre(coords);
    (t, c)
}

/// Offset that puts a piece next to the atoms already placed, clear of them (0.9 x the van der Waals sum).
fn pack_offset(t: &Topo, placed: &[(usize, V3)], local: &[usize], x: &[V3]) -> V3 {
    if placed.is_empty() {
        return [0.0; 3];
    }
    let dirs = polyhedron(26);
    let ext = |pts: &mut dyn Iterator<Item = V3>| pts.fold(0.0f64, |m, p| m.max(norm(p)));
    let r_new = ext(&mut x.iter().copied());
    let mut r = 1.0f64;
    let r_max = ext(&mut placed.iter().map(|p| p.1)) + r_new + 6.0;
    while r <= r_max {
        for d in &dirs {
            let off = scale(*d, r);
            let clear = local.iter().enumerate().all(|(k, &i)| {
                let p = add(x[k], off);
                placed.iter().all(|&(j, q)| norm(sub(p, q)) >= 0.9 * (t.vdw[i] + t.vdw[j]))
            });
            if clear {
                return off;
            }
        }
        r += 0.5;
    }
    scale(dirs[0], r_max)
}
