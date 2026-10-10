//! Ideal local geometry: hybridisation from bonds and lone pairs, VSEPR angles (with lone-pair compression), ring angles
//! of small rings, coordination polyhedra of metals (square planar for d8 / d9 four-coordinate centres).

use std::collections::{HashMap, VecDeque};
use std::sync::{Mutex, OnceLock};

use super::data;
use super::graph::BuildGraph;

pub type V3 = [f64; 3];

pub fn sub(a: V3, b: V3) -> V3 {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
pub fn add(a: V3, b: V3) -> V3 {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
pub fn scale(a: V3, s: f64) -> V3 {
    [a[0] * s, a[1] * s, a[2] * s]
}
pub fn dot(a: V3, b: V3) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
pub fn cross(a: V3, b: V3) -> V3 {
    [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
pub fn norm(a: V3) -> f64 {
    dot(a, a).sqrt()
}
pub fn unit(a: V3) -> V3 {
    let n = norm(a);
    if n < 1e-12 {
        [1.0, 0.0, 0.0]
    } else {
        scale(a, 1.0 / n)
    }
}

/// A molecular graph with explicit hydrogens and its local geometry.
pub struct Topo {
    pub g: BuildGraph,
    /// Atoms before this index are the skeleton (the input graph's atoms); the rest are the hydrogens added for its counts.
    pub n_skel: usize,
    pub adj: Vec<Vec<(usize, usize)>>,
    pub metal: Vec<bool>,
    /// Steric number used for the geometry (neighbours + lone pairs that take a direction).
    pub sn: Vec<usize>,
    pub planar: Vec<bool>,
    pub linear: Vec<bool>,
    /// Ideal bond length per bond.
    pub r0: Vec<f64>,
    /// (a, centre, b, ideal angle in radians), a < b.
    pub angles: Vec<(usize, usize, usize, f64)>,
    pub angle_of: HashMap<(usize, usize, usize), f64>,
    /// Van der Waals radius per atom.
    pub vdw: Vec<f64>,
    ring_cache: std::cell::RefCell<HashMap<Vec<usize>, Vec<f64>>>,
}

impl Topo {
    /// Expands the implicit hydrogens of `g` into atoms (after all skeleton atoms, in the order of their heavy atom).
    pub fn new(src: &BuildGraph) -> Topo {
        let mut g = src.clone();
        let n_skel = g.n();
        for i in 0..n_skel {
            let h = g.hcount[i];
            g.hcount[i] = 0;
            for _ in 0..h {
                let k = g.add_atom("H", 0);
                g.add_bond(i, k, 1.0, false);
            }
        }
        Topo::from_explicit(g, n_skel)
    }

    /// A graph whose hydrogens are already atoms.
    pub fn from_explicit(g: BuildGraph, n_skel: usize) -> Topo {
        let n = g.n();
        let mut adj: Vec<Vec<(usize, usize)>> = vec![Vec::new(); n];
        for (k, b) in g.bonds.iter().enumerate() {
            adj[b.a].push((b.b, k));
            adj[b.b].push((b.a, k));
        }
        for a in adj.iter_mut() {
            a.sort();
        }
        let metal: Vec<bool> = (0..n).map(|i| g.is_metal(i)).collect();
        let has_pi: Vec<bool> = (0..n).map(|i| adj[i].iter().any(|&(_, k)| !g.bonds[k].coordinate && (g.bonds[k].order >= 1.5 || g.bonds[k].aromatic))).collect();
        let arom: Vec<bool> = (0..n).map(|i| g.arom[i] || adj[i].iter().any(|&(_, k)| g.bonds[k].aromatic)).collect();
        let mut sn = vec![0usize; n];
        let mut planar = vec![false; n];
        let mut linear = vec![false; n];
        for c in 0..n {
            let deg = adj[c].len();
            if metal[c] {
                sn[c] = deg;
                linear[c] = deg == 2;
                continue;
            }
            let mut lp = g.lone_pairs(c).max(0) as usize;
            // a donor bound to a metal keeps at most one stereo-active lone pair (M-O-S of a bound sulfate ~120 degrees,
            // M-C-N of cyanide and M-N-C of thiocyanate linear): the bond to the metal is largely ionic
            if adj[c].iter().any(|&(_, k)| g.bonds[k].coordinate) {
                lp = lp.min(1);
            }
            if arom[c] && deg <= 3 {
                lp = 3 - deg;
            } else if deg == 3 && lp == 1 && data::group(&g.el[c]) == Some(15) && data::element(&g.el[c]).map_or(false, |r| r.z <= 10) {
                // amide / aniline / enamine nitrogen: its lone pair conjugates and the centre is planar
                if adj[c].iter().any(|&(j, k)| !g.bonds[k].coordinate && has_pi[j]) {
                    lp = 0;
                }
            } else if deg == 2 && lp == 2 && data::group(&g.el[c]) == Some(16) && data::element(&g.el[c]).map_or(false, |r| r.z <= 10) {
                // ester / aryl ether oxygen between two heavy atoms, one of them in a pi system: one lone pair conjugates,
                // the angle opens towards 120 (esters and anisoles ~117 degrees); an O-H oxygen stays bent
                let heavy = adj[c].iter().all(|&(j, _)| g.el[j] != "H");
                if heavy && adj[c].iter().any(|&(j, k)| !g.bonds[k].coordinate && has_pi[j]) {
                    lp = 1;
                }
            }
            sn[c] = deg + lp;
            planar[c] = sn[c] == 3 && deg >= 2;
            linear[c] = sn[c] == 2 && deg == 2;
        }
        let r0: Vec<f64> = g.bonds.iter().map(|b| data::bond_length(&g.el[b.a], &g.el[b.b], if b.aromatic { 1.5 } else { b.order })).collect();
        let mut t = Topo { g, n_skel, adj, metal, sn, planar, linear, r0, angles: Vec::new(), angle_of: HashMap::new(), vdw: Vec::new(), ring_cache: Default::default() };
        t.vdw = (0..n).map(|i| data::vdw_radius(&t.g.el[i])).collect();
        let mut angles = Vec::new();
        for c in 0..n {
            for (a, b, th) in t.centre_angles(c) {
                let (a, b) = if a < b { (a, b) } else { (b, a) };
                angles.push((a, c, b, th));
            }
        }
        for &(a, c, b, th) in &angles {
            t.angle_of.insert((a, c, b), th);
        }
        t.angles = angles;
        t
    }

    pub fn n(&self) -> usize {
        self.g.n()
    }

    pub fn nbrs(&self, i: usize) -> impl Iterator<Item = usize> + '_ {
        self.adj[i].iter().map(|(j, _)| *j)
    }

    pub fn bond_between(&self, a: usize, b: usize) -> Option<usize> {
        self.adj[a].iter().find(|(j, _)| *j == b).map(|(_, k)| *k)
    }

    pub fn ideal_angle(&self, a: usize, c: usize, b: usize) -> Option<f64> {
        let (a, b) = if a < b { (a, b) } else { (b, a) };
        self.angle_of.get(&(a, c, b)).copied()
    }

    /// Atoms of the smallest ring through a-c-b in ring order (c, a, ..., b), up to `max` atoms.
    pub fn ring_path_through(&self, a: usize, c: usize, b: usize, max: usize) -> Option<Vec<usize>> {
        let n = self.n();
        let mut prev = vec![usize::MAX; n];
        let mut dist = vec![usize::MAX; n];
        dist[a] = 0;
        let mut q = VecDeque::new();
        q.push_back(a);
        while let Some(u) = q.pop_front() {
            if dist[u] + 2 >= max {
                continue;
            }
            for v in self.nbrs(u) {
                if v == c || dist[v] != usize::MAX {
                    continue;
                }
                dist[v] = dist[u] + 1;
                prev[v] = u;
                if v == b {
                    let mut path = vec![b];
                    let mut k = b;
                    while k != a {
                        k = prev[k];
                        path.push(k);
                    }
                    path.push(c);
                    path.reverse();
                    return Some(path);
                }
                q.push_back(v);
            }
        }
        None
    }

    /// Ideal interior angle (degrees) at `c` of the smallest ring through a-c-b with at most `max` atoms: a three-ring from
    /// its side lengths; four- to six-rings from a planar polygon with the ideal bond lengths as sides whose angles are as
    /// close as the sides allow to the regular values (sp2 atoms (n-2)180/n; sp3 atoms 88 in a four-ring and 105 in a
    /// five-ring, the puckering deficit spread over the ring). Six-rings only when every atom is planar.
    pub fn ring_angle(&self, a: usize, c: usize, b: usize, max: usize) -> Option<f64> {
        let path = self.ring_path_through(a, c, b, max + 1)?;
        let n = path.len();
        if n > max {
            return None;
        }
        let side = |i: usize, j: usize| self.bond_between(i, j).map(|k| self.r0[k]).unwrap_or(1.5);
        if n == 3 {
            let (ra, rb, rab) = (side(c, a), side(c, b), side(a, b));
            return Some(((ra * ra + rb * rb - rab * rab) / (2.0 * ra * rb)).clamp(-1.0, 1.0).acos().to_degrees());
        }
        let planar_atom = |i: usize| self.planar[i] || self.metal[i];
        if n == 6 && !path.iter().all(|&i| planar_atom(i)) {
            return if planar_atom(c) { Some(120.0) } else { None };
        }
        let mut key = path.clone();
        key.sort();
        if let Some(v) = self.ring_cache.borrow().get(&key) {
            let k = key.iter().position(|&i| i == c).unwrap();
            return Some(v[k]);
        }
        let regular = 180.0 * (n as f64 - 2.0) / n as f64;
        let target: Vec<f64> = path
            .iter()
            .map(|&i| if planar_atom(i) { regular } else if n == 4 { 88.0 } else if n == 5 { 105.0 } else { regular })
            .collect();
        let shift = (180.0 * (n as f64 - 2.0) - target.iter().sum::<f64>()) / n as f64;
        let sides: Vec<f64> = (0..n).map(|k| side(path[k], path[(k + 1) % n])).collect();
        let fitted = fit_polygon(&sides, &target.iter().map(|t| t + shift).collect::<Vec<_>>());
        let angles: Vec<f64> = fitted.iter().map(|f| f - shift).collect();
        let mut by_atom = vec![0.0; n];
        for (k, &i) in path.iter().enumerate() {
            by_atom[key.iter().position(|&j| j == i).unwrap()] = angles[k];
        }
        self.ring_cache.borrow_mut().insert(key, by_atom);
        Some(angles[0])
    }

    /// Is the bond a-b in a ring of at most `max` atoms?
    pub fn bond_ring_size(&self, a: usize, b: usize, max: usize) -> Option<usize> {
        let n = self.n();
        let mut dist = vec![usize::MAX; n];
        dist[a] = 0;
        let mut q = VecDeque::new();
        q.push_back(a);
        while let Some(u) = q.pop_front() {
            if dist[u] + 1 >= max {
                continue;
            }
            for v in self.nbrs(u) {
                if (u == a && v == b) || dist[v] != usize::MAX {
                    continue;
                }
                dist[v] = dist[u] + 1;
                if v == b {
                    return Some(dist[v] + 1);
                }
                q.push_back(v);
            }
        }
        None
    }

    fn d_count(&self, c: usize) -> Option<i32> {
        let g = data::group(&self.g.el[c])? as i32;
        if !(3..=12).contains(&g) {
            return None;
        }
        Some(g - self.g.ox[c].unwrap_or(self.g.charge[c]))
    }

    /// Ideal angles (radians) between the neighbours of centre `c`: (neighbour a, neighbour b, angle).
    fn centre_angles(&self, c: usize) -> Vec<(usize, usize, f64)> {
        let nb: Vec<usize> = self.nbrs(c).collect();
        let deg = nb.len();
        if deg < 2 {
            return vec![];
        }
        let pairs = |f: &dyn Fn(usize, usize) -> f64| -> Vec<(usize, usize, f64)> {
            let mut v = Vec::new();
            for i in 0..deg {
                for j in i + 1..deg {
                    v.push((nb[i], nb[j], f(i, j)));
                }
            }
            v
        };
        let from_dirs = |dirs: &[V3]| -> Vec<(usize, usize, f64)> { pairs(&|i, j| dot(dirs[i], dirs[j]).clamp(-1.0, 1.0).acos()) };
        if self.metal[c] {
            return match deg {
                2 => pairs(&|_, _| std::f64::consts::PI),
                3 => from_dirs(&polyhedron(3)),
                4 if matches!(self.d_count(c), Some(8) | Some(9)) => from_dirs(&square_planar()),
                4 => from_dirs(&polyhedron(4)),
                d => from_dirs(&polyhedron(d)),
            };
        }
        let sn = self.sn[c].max(deg);
        let lp = sn - deg;
        match sn {
            2 => pairs(&|_, _| std::f64::consts::PI),
            3 => self.planar_angles(c, &nb),
            4 => self.tetrahedral_angles(c, &nb, lp),
            _ => from_dirs(&polyhedron(sn)),
        }
    }

    fn planar_angles(&self, c: usize, nb: &[usize]) -> Vec<(usize, usize, f64)> {
        let deg = nb.len();
        let mut fixed: Vec<Option<f64>> = Vec::new();
        let mut idx: Vec<(usize, usize)> = Vec::new();
        for i in 0..deg {
            for j in i + 1..deg {
                fixed.push(self.ring_angle(nb[i], c, nb[j], 6));
                idx.push((i, j));
            }
        }
        if deg == 2 {
            return vec![(nb[0], nb[1], fixed[0].unwrap_or(120.0).to_radians())];
        }
        let sum_fixed: f64 = fixed.iter().flatten().sum();
        let n_free = fixed.iter().filter(|f| f.is_none()).count();
        let vals: Vec<f64> = if n_free == 0 {
            fixed.iter().map(|f| f.unwrap() * 360.0 / sum_fixed).collect()
        } else {
            let each = ((360.0 - sum_fixed) / n_free as f64).max(90.0);
            fixed.iter().map(|f| f.unwrap_or(each)).collect()
        };
        idx.iter().zip(vals).map(|(&(i, j), v)| (nb[i], nb[j], v.to_radians())).collect()
    }

    fn tetrahedral_angles(&self, c: usize, nb: &[usize], lp: usize) -> Vec<(usize, usize, f64)> {
        let deg = nb.len();
        let mut cons: Vec<(usize, usize, f64)> = Vec::new();
        for i in 0..deg {
            for j in i + 1..deg {
                if let Some(th) = self.ring_angle(nb[i], c, nb[j], 5) {
                    cons.push((i, j, th.to_radians()));
                }
            }
        }
        if cons.is_empty() {
            let th = (109.4712 - 2.5 * lp as f64).to_radians();
            let mut v = Vec::new();
            for i in 0..deg {
                for j in i + 1..deg {
                    v.push((nb[i], nb[j], th));
                }
            }
            return v;
        }
        let dirs = constrained_sphere(deg, deg + lp, &cons);
        let mut v = Vec::new();
        for i in 0..deg {
            for j in i + 1..deg {
                v.push((nb[i], nb[j], dot(dirs[i], dirs[j]).clamp(-1.0, 1.0).acos()));
            }
        }
        v
    }
}

/// Unit vectors of an ideal polyhedron with `n` vertices (2 linear, 3 trigonal, 4 tetrahedral, 5 trigonal bipyramid with
/// the two axial positions first, 6 octahedral in +-x, +-y, +-z order, more: points spread on the sphere).
pub fn polyhedron(n: usize) -> Vec<V3> {
    let s3 = 3f64.sqrt() / 2.0;
    match n {
        0 => vec![],
        1 => vec![[1.0, 0.0, 0.0]],
        2 => vec![[1.0, 0.0, 0.0], [-1.0, 0.0, 0.0]],
        3 => vec![[1.0, 0.0, 0.0], [-0.5, s3, 0.0], [-0.5, -s3, 0.0]],
        4 => [[1.0, 1.0, 1.0], [1.0, -1.0, -1.0], [-1.0, 1.0, -1.0], [-1.0, -1.0, 1.0]].iter().map(|v| unit(*v)).collect(),
        5 => vec![[0.0, 0.0, 1.0], [0.0, 0.0, -1.0], [1.0, 0.0, 0.0], [-0.5, s3, 0.0], [-0.5, -s3, 0.0]],
        6 => vec![[1.0, 0.0, 0.0], [-1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, -1.0, 0.0], [0.0, 0.0, 1.0], [0.0, 0.0, -1.0]],
        n => sphere_points(n),
    }
}

pub fn square_planar() -> Vec<V3> {
    vec![[1.0, 0.0, 0.0], [-1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, -1.0, 0.0]]
}

/// `n` points spread on the unit sphere (repulsion from a Fibonacci start; cached).
fn sphere_points(n: usize) -> Vec<V3> {
    static C: OnceLock<Mutex<HashMap<usize, Vec<V3>>>> = OnceLock::new();
    let cache = C.get_or_init(|| Mutex::new(HashMap::new()));
    if let Some(v) = cache.lock().unwrap().get(&n) {
        return v.clone();
    }
    let golden = std::f64::consts::PI * (3.0 - 5f64.sqrt());
    let mut p: Vec<V3> = (0..n)
        .map(|i| {
            let y = 1.0 - 2.0 * (i as f64 + 0.5) / n as f64;
            let r = (1.0 - y * y).sqrt();
            let t = golden * i as f64;
            [r * t.cos(), y, r * t.sin()]
        })
        .collect();
    for _ in 0..400 {
        let mut f = vec![[0.0; 3]; n];
        for i in 0..n {
            for j in 0..n {
                if i != j {
                    let d = sub(p[i], p[j]);
                    let r2 = dot(d, d).max(1e-6);
                    f[i] = add(f[i], scale(d, 1.0 / (r2 * r2.sqrt())));
                }
            }
        }
        for i in 0..n {
            p[i] = unit(add(p[i], scale(f[i], 0.02)));
        }
    }
    cache.lock().unwrap().insert(n, p.clone());
    p
}

/// Directions of `total` electron domains on a centre (the first `deg` bonds, the rest lone pairs) where some bond pairs
/// have a fixed angle (small rings): the fixed pairs are held, the others repel (lone pairs more strongly), so the
/// exocyclic angles of a ring atom open up the way VSEPR says.
fn constrained_sphere(deg: usize, total: usize, cons: &[(usize, usize, f64)]) -> Vec<V3> {
    let mut v: Vec<V3> = polyhedron(total.max(2));
    v.truncate(total.max(2));
    let w = |i: usize, j: usize| -> f64 {
        let lp = (i >= deg) as u32 + (j >= deg) as u32;
        [1.0, 1.2, 1.4][lp as usize]
    };
    let is_cons = |i: usize, j: usize| cons.iter().find(|c| (c.0 == i && c.1 == j) || (c.0 == j && c.1 == i)).map(|c| c.2);
    for _ in 0..600 {
        let mut grad = vec![[0.0; 3]; v.len()];
        for i in 0..v.len() {
            for j in 0..v.len() {
                if i == j {
                    continue;
                }
                let cs = dot(v[i], v[j]).clamp(-0.999999, 0.999999);
                let de_dcos = if let Some(th0) = is_cons(i, j) {
                    let th = cs.acos();
                    // E = 40 (th - th0)^2; dth/dcos = -1/sin
                    -80.0 * (th - th0) / (1.0 - cs * cs).sqrt()
                } else {
                    // E = w / (1.5 - cos)^2
                    2.0 * w(i, j) / (1.5 - cs).powi(3)
                };
                grad[i] = add(grad[i], scale(v[j], de_dcos));
            }
        }
        for i in 0..v.len() {
            let g = grad[i];
            let tang = sub(g, scale(v[i], dot(g, v[i])));
            v[i] = unit(sub(v[i], scale(tang, 0.01)));
        }
    }
    v
}

/// Interior angles (degrees) of a planar polygon with these side lengths whose angles are as close as possible to `target`
/// (side k joins vertex k and k+1).
fn fit_polygon(sides: &[f64], target: &[f64]) -> Vec<f64> {
    let n = sides.len();
    let mean = sides.iter().sum::<f64>() / n as f64;
    let rad = mean / (2.0 * (std::f64::consts::PI / n as f64).sin());
    let mut x: Vec<f64> = (0..n)
        .flat_map(|k| {
            let t = 2.0 * std::f64::consts::PI * k as f64 / n as f64;
            [rad * t.cos(), rad * t.sin()]
        })
        .collect();
    let tg: Vec<f64> = target.iter().map(|t| t.to_radians()).collect();
    let interior = |x: &[f64], k: usize| -> (f64, [f64; 2], [f64; 2], f64, f64) {
        let (p, q, r) = ((k + n - 1) % n, k, (k + 1) % n);
        let u = [x[2 * p] - x[2 * q], x[2 * p + 1] - x[2 * q + 1]];
        let v = [x[2 * r] - x[2 * q], x[2 * r + 1] - x[2 * q + 1]];
        let (ru, rv) = ((u[0] * u[0] + u[1] * u[1]).sqrt().max(1e-9), (v[0] * v[0] + v[1] * v[1]).sqrt().max(1e-9));
        let cs = ((u[0] * v[0] + u[1] * v[1]) / (ru * rv)).clamp(-1.0, 1.0);
        (cs.acos(), u, v, ru, rv)
    };
    super::embed::lbfgs(&mut x, 300, 1e-8, 0.05, |x, g| {
        g.iter_mut().for_each(|v| *v = 0.0);
        let mut e = 0.0;
        for k in 0..n {
            let j = (k + 1) % n;
            let d = [x[2 * j] - x[2 * k], x[2 * j + 1] - x[2 * k + 1]];
            let r = (d[0] * d[0] + d[1] * d[1]).sqrt().max(1e-9);
            let dr = r - sides[k];
            e += 100.0 * dr * dr;
            for m in 0..2 {
                let f = 200.0 * dr * d[m] / r;
                g[2 * j + m] += f;
                g[2 * k + m] -= f;
            }
        }
        for k in 0..n {
            let (th, u, v, ru, rv) = interior(x, k);
            let (p, q, r) = ((k + n - 1) % n, k, (k + 1) % n);
            let dth = th - tg[k];
            e += 10.0 * dth * dth;
            let cs = th.cos();
            let sn = th.sin().max(1e-8);
            let de = 20.0 * dth;
            for m in 0..2 {
                let ga = -(v[m] / rv - cs * u[m] / ru) / (ru * sn) * de;
                let gb = -(u[m] / ru - cs * v[m] / rv) / (rv * sn) * de;
                g[2 * p + m] += ga;
                g[2 * r + m] += gb;
                g[2 * q + m] -= ga + gb;
            }
        }
        e
    });
    (0..n).map(|k| interior(&x, k).0.to_degrees()).collect()
}
