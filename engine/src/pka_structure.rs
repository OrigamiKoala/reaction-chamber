//! pKa from molecular structure (E4): linear free-energy relations over the SMILES graph in the manner of Perrin,
//! Dempsey and Serjeant ("pKa prediction for organic acids and bases"). A site (carboxyl OH, phenol, alcohol, thiol,
//! ammonium / amine N, pyridine N ...) has a class value pKa0; the substituent groups on its skeleton shift it by
//! `- rho * sum_k w_k sigma_k att(d_k)`: inductive constants `sigma_I` of the groups on a saturated skeleton, attenuated
//! by `f` per bond beyond the first shell, or Hammett constants (sigma_m, sigma_p, sigma_p-) for the groups on an
//! aromatic ring (ortho groups by an inductive plus steric term). The k-th strongest contribution carries the weight
//! `w_k` (a second chlorine does not acidify as much as the first). Parameters are data (`data/pka_structure.json`).
//!
//! Tier Estimated: errors of 0.3-0.6 pK units for the classes above (see the gate in `tests/open_items.rs`); a molecule
//! with an unrecognised acidic or basic function simply has no site for it.

use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::OnceLock;

use serde::Deserialize;

use crate::analytical::graph::Mol;

#[derive(Deserialize)]
struct Class {
    pka0: f64,
    #[serde(default)]
    rho: f64,
    #[serde(default = "default_f")]
    f: f64,
    #[serde(default)]
    formic: Option<f64>,
    /// Attenuation factor of an unsaturated group (phenyl, vinyl) at the second shell: 1 when the skeleton is cut by a
    /// carbonyl (carboxylic acids), else 1 / f like any other group.
    #[serde(default)]
    unsat_d2: Option<f64>,
}

fn default_f() -> f64 {
    0.4
}

#[derive(Deserialize)]
struct Ortho {
    k_polar: f64,
    alkyl_steric: f64,
}

#[derive(Deserialize)]
struct Params {
    #[serde(rename = "sigma_I")]
    sigma_i: HashMap<String, f64>,
    hammett: HashMap<String, serde_json::Value>,
    ortho: Ortho,
    classes: HashMap<String, Class>,
    weights: Vec<f64>,
}

fn params() -> &'static Params {
    static P: OnceLock<Params> = OnceLock::new();
    P.get_or_init(|| serde_json::from_str(include_str!("../data/pka_structure.json")).expect("data/pka_structure.json"))
}

#[derive(Deserialize)]
struct PlusParams {
    sigma: HashMap<String, [f64; 2]>,
    aza: [f64; 2],
    ortho_steric_kj: f64,
}

fn plus_params() -> &'static PlusParams {
    static P: OnceLock<PlusParams> = OnceLock::new();
    P.get_or_init(|| serde_json::from_str(include_str!("../data/hammett_plus.json")).expect("data/hammett_plus.json"))
}

/// An ionisable site of a molecule.
#[derive(Clone, Debug, PartialEq)]
pub struct Site {
    /// Heavy atom that carries / loses the proton.
    pub atom: usize,
    pub class: &'static str,
    /// true: a proton leaves X-H (acid); false: the site is a base and `pka` is that of its conjugate acid.
    pub acid: bool,
    pub pka: f64,
}

fn weighted_sum(mut contrib: Vec<f64>) -> f64 {
    contrib.sort_by(|a, b| b.abs().partial_cmp(&a.abs()).unwrap_or(std::cmp::Ordering::Equal));
    let w = &params().weights;
    contrib.iter().enumerate().map(|(k, c)| c * w.get(k).copied().unwrap_or(0.1)).sum()
}

fn is_carbonyl_c(mol: &Mol, c: usize) -> bool {
    mol.is(c, "C") && mol.double_to(c, "O", None)
}

/// The functional group that starts at atom `a`, entered from `from`: (name, atoms the group consumes). None for a
/// saturated carbon (the skeleton continues through it) or an atom that is not a recognised substituent.
fn group_at(mol: &Mol, a: usize, from: usize) -> Option<(&'static str, Vec<usize>)> {
    let el = mol.el(a);
    let others: Vec<usize> = mol.nbrs(a).filter(|&j| j != from).collect();
    match el {
        "F" => Some(("F", vec![a])),
        "Cl" => Some(("Cl", vec![a])),
        "Br" => Some(("Br", vec![a])),
        "I" => Some(("I", vec![a])),
        "O" => {
            if others.is_empty() {
                return Some(("OH", vec![a]));
            }
            let o = others[0];
            if is_carbonyl_c(mol, o) {
                Some(("OCOR", vec![a]))
            } else if mol.atoms[o].arom {
                Some(("OAr", vec![a]))
            } else {
                Some(("OR", vec![a]))
            }
        }
        "S" => {
            if others.iter().any(|&j| mol.double_to(a, "O", None) && mol.is(j, "O")) {
                return None;
            }
            if others.is_empty() { Some(("SH", vec![a])) } else { Some(("SR", vec![a])) }
        }
        "N" => {
            let oxy: Vec<usize> = others.iter().copied().filter(|&j| mol.is(j, "O")).collect();
            if mol.atoms[a].charge == 1 && oxy.len() >= 2 || (oxy.len() >= 2 && mol.double_to(a, "O", None)) {
                let mut c = vec![a];
                c.extend(oxy);
                return Some(("NO2", c));
            }
            if mol.atoms[a].charge == 1 && mol.atoms[a].h >= 1 {
                return Some(("NH3+", vec![a]));
            }
            if others.iter().any(|&j| is_carbonyl_c(mol, j)) {
                return Some(("NHCOR", vec![a]));
            }
            if mol.atoms[a].h >= 2 { Some(("NH2", vec![a])) } else { Some(("NR2", vec![a])) }
        }
        "C" => {
            if mol.atoms[a].arom {
                return Some(("Ph", vec![a]));
            }
            if let Some(n) = mol.triple_bonded(a) {
                if mol.is(n, "N") {
                    return Some(("CN", vec![a, n]));
                }
                return Some(("ethynyl", vec![a, n]));
            }
            if is_carbonyl_c(mol, a) {
                let mut consumed = vec![a];
                let mut name = "COR";
                for &j in &others {
                    if mol.is(j, "O") && mol.double_to(a, "O", None) && mol.bond(a, j) == Some(2.0) {
                        consumed.push(j);
                    } else if mol.is(j, "O") {
                        consumed.push(j);
                        name = if mol.atoms[j].charge == -1 {
                            "COO-"
                        } else if mol.atoms[j].h >= 1 {
                            "COOH"
                        } else {
                            "COOR"
                        };
                    } else if mol.is(j, "N") {
                        consumed.push(j);
                        name = "CONH2";
                    }
                }
                return Some((name, consumed));
            }
            if mol.has_double(a) {
                return Some(("vinyl", vec![a]));
            }
            // trihalomethyl
            let hal: Vec<usize> = others.iter().copied().filter(|&j| mol.is(j, "F") || mol.is(j, "Cl")).collect();
            if hal.len() >= 3 {
                let name = if mol.is(hal[0], "F") { "CF3" } else { "CCl3" };
                let mut c = vec![a];
                c.extend(hal);
                return Some((name, c));
            }
            None
        }
        _ => None,
    }
}

/// Inductive shift (pK units, negative = acid strengthened) of the groups on the saturated skeleton around `x`.
/// `skip` are atoms of the ionisable function itself. `rho` and `f` are the class constants.
fn inductive_shift(mol: &Mol, x: usize, skip: &HashSet<usize>, cl: &Class) -> f64 {
    let (rho, f) = (cl.rho, cl.f);
    let p = params();
    let n = mol.n();
    let mut dist = vec![usize::MAX; n];
    // atoms of recognised groups: counted once, never traversed
    let mut consumed: HashSet<usize> = HashSet::new();
    dist[x] = 0;
    let mut q = VecDeque::new();
    q.push_back(x);
    let mut contrib: Vec<f64> = Vec::new();
    while let Some(u) = q.pop_front() {
        let nbs: Vec<usize> = mol.nbrs(u).collect();
        for v in nbs {
            if dist[v] != usize::MAX || consumed.contains(&v) {
                continue;
            }
            dist[v] = dist[u] + 1;
            let d = dist[v];
            if d >= 2 && !skip.contains(&v) {
                if let Some((name, atoms)) = group_at(mol, v, u) {
                    if let Some(&sigma) = p.sigma_i.get(name) {
                        let unsat = matches!(name, "Ph" | "vinyl" | "ethynyl");
                        let att = if d == 2 {
                            if unsat { cl.unsat_d2.unwrap_or(1.0 / f) } else { 1.0 / f }
                        } else {
                            f.powi(d as i32 - 3)
                        };
                        contrib.push(sigma * att);
                    }
                    for a in atoms {
                        consumed.insert(a);
                        if dist[a] == usize::MAX {
                            dist[a] = d;
                        }
                    }
                    continue;
                }
            }
            q.push_back(v);
        }
    }
    -rho * weighted_sum(contrib)
}

fn hammett_row(name: &str) -> Option<[f64; 3]> {
    let v = params().hammett.get(name)?.as_array()?;
    Some([v.first()?.as_f64()?, v.get(1)?.as_f64()?, v.get(2)?.as_f64()?])
}

/// Hammett shift of the substituents of the six-membered ring that contains `r0` (the ring atom carrying the ionisable
/// function, or the ring nitrogen). `para_minus` selects sigma_p- (phenols, anilinium-free resonance).
fn ring_shift(mol: &Mol, r0: usize, exclude: &HashSet<usize>, rho: f64, para_minus: bool) -> f64 {
    let p = params();
    // the ring through r0
    let ring_nbrs: Vec<usize> = mol.nbrs(r0).filter(|&j| mol.atoms[j].arom).collect();
    if ring_nbrs.len() < 2 {
        return 0.0;
    }
    let ring = mol.smallest_ring_through(r0, ring_nbrs[0]);
    if ring.len() != 6 {
        return 0.0;
    }
    // order the ring starting at r0
    let pos = ring.iter().position(|&a| a == r0).unwrap_or(0);
    let mut contrib = Vec::new();
    for (k, _) in ring.iter().enumerate() {
        let a = ring[(pos + k) % 6];
        let rd = k.min(6 - k); // ring distance from r0: 1 ortho, 2 meta, 3 para
        if rd == 0 {
            continue;
        }
        for s in mol.nbrs(a).collect::<Vec<_>>() {
            if ring.contains(&s) || exclude.contains(&s) {
                continue;
            }
            // fused rings: a neighbour that is aromatic and in another ring is skipped
            let (name, polar) = match group_at(mol, s, a) {
                Some((nm, _)) => (nm, true),
                None => ("alkyl", false),
            };
            let row = match hammett_row(name) {
                Some(r) => r,
                None => continue,
            };
            let sigma = match rd {
                2 => row[0],
                3 => if para_minus { row[2] } else { row[1] },
                _ => {
                    // ortho: inductive plus steric
                    if polar {
                        p.ortho.k_polar * p.sigma_i.get(name).copied().unwrap_or(0.0)
                    } else {
                        p.ortho.alkyl_steric
                    }
                }
            };
            contrib.push(sigma);
        }
    }
    -rho * weighted_sum(contrib)
}

/// The electronic environment of the ring position an electrophile attacks (`ring_sigma_plus`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct RingSigma {
    /// Sum of the substituent constants seen from the attacked position (sigma+ for ortho and para, sigma_m for meta);
    /// negative where the ring is activated. Brown's additivity: no damping, the rates multiply.
    pub sum: f64,
    /// Number of substituents on the two ortho positions (each hinders the approach).
    pub n_ortho: usize,
}

/// Sum of the electrophilic substituent constants of the six-membered aromatic ring through atom `r0` of the molecule, as
/// seen from `r0` (the carbon being substituted), by the group of every ring substituent (`group_at`) and its position
/// (ortho and para count with sigma+, meta with sigma_m). None when `r0` is not in a six-membered aromatic ring or a
/// substituent has no constant: a rate nothing can estimate is not invented.
pub fn ring_sigma_plus(molecule: &crate::smiles::Molecule, r0: usize) -> Option<RingSigma> {
    let mol = Mol::from_molecule(molecule);
    if r0 >= mol.n() || !mol.atoms[r0].arom {
        return None;
    }
    let ring_nbrs: Vec<usize> = mol.nbrs(r0).filter(|&j| mol.atoms[j].arom).collect();
    if ring_nbrs.len() < 2 {
        return None;
    }
    let ring = mol.smallest_ring_through(r0, ring_nbrs[0]);
    if ring.len() != 6 {
        return None;
    }
    let p = plus_params();
    let pos = ring.iter().position(|&a| a == r0)?;
    let (mut sum, mut n_ortho) = (0.0, 0);
    for k in 1..6 {
        let a = ring[(pos + k) % 6];
        let rd = k.min(6 - k); // 1 ortho, 2 meta, 3 para
        let pick = |row: [f64; 2]| if rd == 2 { row[0] } else { row[1] };
        if !mol.is(a, "C") {
            sum += pick(p.aza);
            continue;
        }
        for s in mol.nbrs(a).collect::<Vec<_>>() {
            if ring.contains(&s) {
                continue;
            }
            let name = match group_at(&mol, s, a) {
                Some(("OH", _)) if mol.atoms[s].charge == -1 => "O-",
                Some((nm, _)) => nm,
                None if mol.is(s, "C") && !mol.atoms[s].arom => "alkyl",
                None => return None,
            };
            sum += pick(*p.sigma.get(name)?);
            if rd == 1 {
                n_ortho += 1;
            }
        }
    }
    Some(RingSigma { sum, n_ortho })
}

/// Steric cost (kJ/mol) of one ortho substituent on the activation energy of an electrophilic substitution.
pub fn ortho_steric_kj() -> f64 {
    plus_params().ortho_steric_kj
}

fn class_value(name: &'static str) -> &'static Class {
    &params().classes[name]
}

/// All ionisable sites of the molecule (a charged O / N is read as its protonated form: a carboxylate O- is the
/// carboxylic acid site, an ammonium N+ the amine site).
pub fn sites_of(mol: &Mol) -> Vec<Site> {
    let mut out = Vec::new();
    for x in 0..mol.n() {
        let a = &mol.atoms[x];
        match a.el.as_str() {
            "O" if (a.charge == 0 && a.h >= 1) || (a.charge == -1 && a.h == 0) => {
                let nb: Vec<usize> = mol.nbrs(x).collect();
                if nb.len() != 1 {
                    continue;
                }
                let c = nb[0];
                if mol.is(c, "S") && mol.adj[c].iter().filter(|(j, o)| mol.is(*j, "O") && *o >= 1.9).count() >= 2 {
                    out.push(Site { atom: x, class: "sulfonic", acid: true, pka: class_value("sulfonic").pka0 });
                    continue;
                }
                if mol.is(c, "P") && mol.double_to(c, "O", None) {
                    out.push(Site { atom: x, class: "phosphonic", acid: true, pka: class_value("phosphonic").pka0 });
                    continue;
                }
                if !mol.is(c, "C") {
                    continue;
                }
                if is_carbonyl_c(mol, c) {
                    // carboxylic acid: C(=O)(OH) with one carbon / hydrogen substituent
                    let others: Vec<usize> = mol.nbrs(c).filter(|&j| j != x && !(mol.is(j, "O") && mol.bond(c, j) == Some(2.0))).collect();
                    if others.iter().any(|&j| !mol.is(j, "C")) || others.len() > 1 {
                        continue;
                    }
                    let mut skip: HashSet<usize> = [x, c].into_iter().collect();
                    for j in mol.nbrs(c) {
                        if mol.is(j, "O") {
                            skip.insert(j);
                        }
                    }
                    if let Some(&alpha) = others.first() {
                        if mol.atoms[alpha].arom {
                            let cl = class_value("benzoic");
                            let pka = cl.pka0 + ring_shift(mol, alpha, &skip, cl.rho, false);
                            out.push(Site { atom: x, class: "benzoic", acid: true, pka });
                            continue;
                        }
                    }
                    let cl = class_value("carboxylic");
                    let pka = if others.is_empty() {
                        cl.formic.unwrap_or(cl.pka0)
                    } else {
                        cl.pka0 + inductive_shift(mol, x, &skip, cl)
                    };
                    out.push(Site { atom: x, class: "carboxylic", acid: true, pka });
                } else if mol.atoms[c].arom {
                    let cl = class_value("phenol");
                    let skip: HashSet<usize> = [x].into_iter().collect();
                    out.push(Site { atom: x, class: "phenol", acid: true, pka: cl.pka0 + ring_shift(mol, c, &skip, cl.rho, true) });
                } else if !mol.has_double(c) && mol.atoms[c].charge == 0 {
                    let cl = class_value("alcohol");
                    let skip: HashSet<usize> = [x, c].into_iter().collect();
                    out.push(Site { atom: x, class: "alcohol", acid: true, pka: cl.pka0 + inductive_shift(mol, x, &skip, cl) });
                }
            }
            "S" if a.charge == 0 && a.h >= 1 || (a.el == "S" && a.charge == -1 && a.h == 0 && mol.heavy_degree(x) == 1) => {
                let nb: Vec<usize> = mol.nbrs(x).collect();
                if nb.len() != 1 || !mol.is(nb[0], "C") {
                    continue;
                }
                let c = nb[0];
                if mol.atoms[c].arom {
                    let cl = class_value("thiophenol");
                    let skip: HashSet<usize> = [x].into_iter().collect();
                    out.push(Site { atom: x, class: "thiophenol", acid: true, pka: cl.pka0 + ring_shift(mol, c, &skip, cl.rho, true) });
                } else {
                    let cl = class_value("thiol");
                    let skip: HashSet<usize> = [x, c].into_iter().collect();
                    out.push(Site { atom: x, class: "thiol", acid: true, pka: cl.pka0 + inductive_shift(mol, x, &skip, cl) });
                }
            }
            "N" => {
                let nb: Vec<usize> = mol.nbrs(x).collect();
                // aromatic nitrogen: pyridine type (6-ring) or imidazole type
                if a.arom {
                    if a.h == 0 && a.charge == 0 && nb.len() == 2 {
                        let ring = mol.smallest_ring_through(x, nb[0]);
                        if ring.len() == 6 {
                            let cl = class_value("pyridinium");
                            let skip: HashSet<usize> = [x].into_iter().collect();
                            out.push(Site { atom: x, class: "pyridinium", acid: false, pka: cl.pka0 + ring_shift(mol, x, &skip, cl.rho, false) });
                        } else if ring.len() == 5 && ring.iter().any(|&r| r != x && mol.is(r, "N") && mol.atoms[r].h >= 1) {
                            out.push(Site { atom: x, class: "imidazolium", acid: false, pka: class_value("imidazolium").pka0 });
                        }
                    }
                    continue;
                }
                // not an amine: amide, nitro, nitrile, imine, N-oxide, sulfonamide
                if mol.has_double(x) || mol.triple_bonded(x).is_some() {
                    continue;
                }
                if nb.iter().any(|&j| is_carbonyl_c(mol, j) || mol.is(j, "S") || mol.is(j, "O") || mol.is(j, "N")) {
                    continue;
                }
                let charged = a.charge == 1;
                if a.charge != 0 && !(charged && a.h >= 1) {
                    continue;
                }
                let arom_nb = nb.iter().any(|&j| mol.atoms[j].arom);
                let skip: HashSet<usize> = [x].into_iter().collect();
                if arom_nb {
                    let cl = class_value("anilinium");
                    let ring_atom = nb.iter().copied().find(|&j| mol.atoms[j].arom).unwrap();
                    out.push(Site { atom: x, class: "anilinium", acid: false, pka: cl.pka0 + ring_shift(mol, ring_atom, &skip, cl.rho, true) });
                    continue;
                }
                let degree = nb.len();
                let (name, cl): (&'static str, &Class) = match degree {
                    0 => ("ammonia", class_value("ammonia")),
                    1 => ("amine_primary", class_value("amine_primary")),
                    2 => ("amine_secondary", class_value("amine_secondary")),
                    _ => ("amine_tertiary", class_value("amine_tertiary")),
                };
                let pka = if degree == 0 { cl.pka0 } else { cl.pka0 + inductive_shift(mol, x, &skip, cl) };
                out.push(Site { atom: x, class: name, acid: false, pka });
            }
            _ => {}
        }
    }
    out
}

/// Ionisable sites of the largest connected component of a SMILES string.
pub fn sites(smiles: &str) -> Option<Vec<Site>> {
    let comps = Mol::components_from_smiles(smiles)?;
    let mol = comps.iter().max_by_key(|m| m.n())?;
    Some(sites_of(mol))
}

/// Macroscopic stepwise pKa values of the acidic sites (X-H) of the molecule, strongest first, with the statistical factor
/// of equal sites and an electrostatic term that falls with the distance between the sites. None without an acidic site.
pub fn acid_ladder(smiles: &str) -> Option<(Vec<f64>, &'static str)> {
    let comps = Mol::components_from_smiles(smiles)?;
    let mol = comps.iter().max_by_key(|m| m.n())?;
    let mut acid: Vec<Site> = sites_of(mol).into_iter().filter(|s| s.acid).collect();
    if acid.is_empty() {
        return None;
    }
    acid.sort_by(|a, b| a.pka.partial_cmp(&b.pka).unwrap_or(std::cmp::Ordering::Equal));
    let class = acid[0].class;
    let ka: Vec<f64> = acid.iter().map(|s| 10f64.powf(-s.pka)).collect();
    let k = ka.len();
    // elementary symmetric polynomials -> macroscopic constants (independent sites)
    let mut e = vec![0.0; k + 1];
    e[0] = 1.0;
    for &x in &ka {
        for j in (1..=k).rev() {
            e[j] += e[j - 1] * x;
        }
    }
    let mut pka: Vec<f64> = (1..=k).map(|j| -(e[j] / e[j - 1]).log10()).collect();
    // electrostatic term: nearest pair of sites, a charge already on the molecule
    let mut dmin = usize::MAX;
    for i in 0..k {
        for j in (i + 1)..k {
            dmin = dmin.min(graph_distance(mol, acid[i].atom, acid[j].atom));
        }
    }
    let step = electrostatic_step(dmin);
    for (j, v) in pka.iter_mut().enumerate() {
        *v += step * j as f64;
    }
    Some((pka, class))
}

/// pK increase per charge already on a polyprotic acid whose nearest acidic sites are `d` bonds apart (o-phthalic,
/// oxalic: 2.4; malonic: 2.3; succinic: 0.8; glutaric: 0.35).
pub fn electrostatic_step(d: usize) -> f64 {
    match d {
        usize::MAX => 0.0,
        0..=3 => 2.4,
        4 => 2.3,
        5 => 0.8,
        6 => 0.35,
        _ => 0.15,
    }
}

fn graph_distance(mol: &Mol, a: usize, b: usize) -> usize {
    let mut dist = vec![usize::MAX; mol.n()];
    dist[a] = 0;
    let mut q = VecDeque::new();
    q.push_back(a);
    while let Some(u) = q.pop_front() {
        for v in mol.nbrs(u).collect::<Vec<_>>() {
            if dist[v] == usize::MAX {
                dist[v] = dist[u] + 1;
                q.push_back(v);
            }
        }
    }
    dist[b]
}

/// pKa of the strongest acidic site (X-H), or of the conjugate acid of the strongest basic site when the molecule has
/// no acidic one: the single number T5 needs for a dissociation free energy.
pub fn primary_pka(smiles: &str) -> Option<f64> {
    let s = sites(smiles)?;
    let min = |it: &mut dyn Iterator<Item = f64>| it.fold(None, |m: Option<f64>, v| Some(m.map_or(v, |c| c.min(v))));
    let max = |it: &mut dyn Iterator<Item = f64>| it.fold(None, |m: Option<f64>, v| Some(m.map_or(v, |c| c.max(v))));
    // an acid within the range of water, else the strongest base, else whatever acid there is (alcohols)
    min(&mut s.iter().filter(|x| x.acid && x.pka <= 14.0).map(|x| x.pka))
        .or_else(|| max(&mut s.iter().filter(|x| !x.acid).map(|x| x.pka)))
        .or_else(|| min(&mut s.iter().filter(|x| x.acid).map(|x| x.pka)))
}
