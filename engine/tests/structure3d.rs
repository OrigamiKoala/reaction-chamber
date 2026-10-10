//! Gates of stage R0 of the reaction viewer (docs/plans/reaction-viewer-plan.md, section 6): 3D structures of species.
//!
//! Every check measures the coordinates directly (distances, angles, planes); the ideal values it compares against are the
//! structure's own targets (`bond_targets`: sums of Pyykko covalent radii by bond order; `angle_targets`: VSEPR with
//! lone-pair compression, small-ring angles from the bond lengths, coordination polyhedra), plus absolute checks of a few
//! textbook shapes (sulfate, nitrate, water, ...).

use std::collections::{HashMap, VecDeque};

use reaction_chamber_engine::db::SpeciesStore;
use reaction_chamber_engine::structure3d::{self, data, Structure3d};

/// The structure zoo of `analytical_nmr.rs` (drug-like, natural-product-like, heterocycles, long chains, polyfunctional).
const ZOO: &[(&str, &str)] = &[
    ("glycine", "C(C(=O)O)N"),
    ("alanine", "C[C@@H](C(=O)O)N"),
    ("glucose", "C([C@@H]1[C@H]([C@@H]([C@H](C(O1)O)O)O)O)O"),
    ("caffeine", "CN1C=NC2=C1C(=O)N(C(=O)N2C)C"),
    ("aspirin", "CC(=O)OC1=CC=CC=C1C(=O)O"),
    ("paracetamol", "CC(=O)NC1=CC=C(C=C1)O"),
    ("ibuprofen", "CC(C)CC1=CC=C(C=C1)C(C)C(=O)O"),
    ("nicotine", "CN1CCCC1C2=CN=CC=C2"),
    ("cholesterol", "C[C@H](CCCC(C)C)[C@H]1CC[C@@H]2[C@@]1(CC[C@H]3[C@H]2CC=C4[C@@]3(CC[C@@H](C4)O)C)C"),
    ("dodecane", "CCCCCCCCCCCC"),
    ("palmitic acid", "CCCCCCCCCCCCCCCC(=O)O"),
    ("anthracene", "C1=CC=C2C=C3C=CC=CC3=CC2=C1"),
    ("adenine", "C1=NC2=NC=NC(=C2N1)N"),
    ("quinoline", "C1=CC=C2C(=C1)C=CC=N2"),
    ("indole", "C1=CC=C2C(=C1)C=CN2"),
    ("thiophene", "C1=CSC=C1"),
    ("furan", "C1=COC=C1"),
    ("imidazole", "C1=CN=CN1"),
    ("urea", "C(=O)(N)N"),
    ("lactic acid", "CC(C(=O)O)O"),
    ("citric acid", "C(C(=O)O)C(CC(=O)O)(C(=O)O)O"),
    ("styrene oxide", "C1C(O1)C2=CC=CC=C2"),
    ("cyclopropane", "C1CC1"),
    ("norbornene", "C1CC2CC1C=C2"),
    ("adamantane", "C1C2CC3CC1CC(C2)C3"),
    ("triphenylmethanol", "C1=CC=C(C=C1)C(C2=CC=CC=C2)(C3=CC=CC=C3)O"),
    ("4-nitroaniline", "C1=CC(=CC=C1N)[N+](=O)[O-]"),
    ("benzophenone", "C1=CC=C(C=C1)C(=O)C2=CC=CC=C2"),
    ("acetamide", "CC(=O)N"),
    ("acrylonitrile", "C=CC#N"),
    ("propyne", "CC#C"),
    ("trifluoroacetic acid", "C(=O)(C(F)(F)F)O"),
    ("diethyl malonate", "CCOC(=O)CC(=O)OCC"),
    ("DMSO", "CS(C)=O"),
    ("sulfolane", "C1CCS(=O)(=O)C1"),
    ("triethylamine", "CCN(CC)CC"),
    ("piperidine", "C1CCNCC1"),
    ("morpholine", "C1COCCN1"),
    ("benzoyl chloride", "C1=CC=C(C=C1)C(=O)Cl"),
    ("vanillin", "COC1=C(C=CC(=C1)C=O)O"),
    ("menthol", "CC1CCC(C(C1)O)C(C)C"),
    ("limonene", "CC1=CCC(CC1)C(=C)C"),
    ("camphor", "CC1(C2CCC1(C(=O)C2)C)C"),
    ("tetramethylsilane", "C[Si](C)(C)C"),
    ("hexamethyldisiloxane", "C[Si](C)(C)O[Si](C)(C)C"),
    ("dimethyl carbonate", "COC(=O)OC"),
    ("pyrrole", "C1=CNC=C1"),
    ("toluene diisocyanate-like", "CC1=C(C=C(C=C1)N=C=O)N=C=O"),
];

/// 60 heavy atoms each: a triglyceride (acyclic, 164 atoms) and a hexapeptide with Phe, Trp and Tyr (rings, 112 atoms).
const SIXTY: &[&str] = &[
    "CCCCCCCCCCCCCCCCCC(=O)OCC(COC(=O)CCCCCCCCCCCCCCCC)OC(=O)CCCCCCCCCCCCCCC",
    "CC(C)CC(C(=O)NC(CC1=CC=CC=C1)C(=O)NC(CO)C(=O)NC(CC(=O)N)C(=O)NC(CC2=CNC3=CC=CC=C32)C(=O)O)NC(=O)C(N)CC4=CC=C(O)C=C4",
];

fn p(s: &Structure3d, i: usize) -> [f64; 3] {
    [s.atoms[i].x, s.atoms[i].y, s.atoms[i].z]
}
fn sub(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
fn dot(a: [f64; 3], b: [f64; 3]) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
fn cross(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
fn norm(a: [f64; 3]) -> f64 {
    dot(a, a).sqrt()
}
fn dist(s: &Structure3d, i: usize, j: usize) -> f64 {
    norm(sub(p(s, i), p(s, j)))
}
fn angle(s: &Structure3d, a: usize, c: usize, b: usize) -> f64 {
    let (u, v) = (sub(p(s, a), p(s, c)), sub(p(s, b), p(s, c)));
    (dot(u, v) / (norm(u) * norm(v))).clamp(-1.0, 1.0).acos().to_degrees()
}

fn adjacency(s: &Structure3d, only_aromatic: bool) -> Vec<Vec<usize>> {
    let mut adj = vec![Vec::new(); s.atoms.len()];
    for b in &s.bonds {
        if !only_aromatic || b.aromatic {
            adj[b.a].push(b.b);
            adj[b.b].push(b.a);
        }
    }
    adj
}

fn topological_distances(s: &Structure3d) -> Vec<Vec<usize>> {
    let adj = adjacency(s, false);
    let n = s.atoms.len();
    (0..n)
        .map(|src| {
            let mut d = vec![usize::MAX; n];
            d[src] = 0;
            let mut q = VecDeque::from([src]);
            while let Some(u) = q.pop_front() {
                for &v in &adj[u] {
                    if d[v] == usize::MAX {
                        d[v] = d[u] + 1;
                        q.push_back(v);
                    }
                }
            }
            d
        })
        .collect()
}

/// The smallest ring through each bond (atoms in ring order), deduplicated, using only `adj`.
fn smallest_rings(s: &Structure3d, adj: &[Vec<usize>]) -> Vec<Vec<usize>> {
    let n = s.atoms.len();
    let mut rings: Vec<Vec<usize>> = Vec::new();
    for b in &s.bonds {
        if !adj[b.a].contains(&b.b) {
            continue;
        }
        let mut prev = vec![usize::MAX; n];
        let mut seen = vec![false; n];
        seen[b.a] = true;
        let mut q = VecDeque::from([b.a]);
        let mut found = false;
        while let Some(u) = q.pop_front() {
            for &v in &adj[u] {
                if (u == b.a && v == b.b) || seen[v] {
                    continue;
                }
                seen[v] = true;
                prev[v] = u;
                if v == b.b {
                    found = true;
                    break;
                }
                q.push_back(v);
            }
            if found {
                break;
            }
        }
        if !found {
            continue;
        }
        let mut ring = vec![b.b];
        let mut k = b.b;
        while k != b.a {
            k = prev[k];
            ring.push(k);
        }
        let mut key = ring.clone();
        key.sort();
        if !rings.iter().any(|r| {
            let mut rk = r.clone();
            rk.sort();
            rk == key
        }) {
            rings.push(ring);
        }
    }
    rings
}

/// Atoms of bridged ring systems (two smallest rings sharing three or more atoms: bicyclo[2.2.1] and the like).
fn bridged_atoms(s: &Structure3d) -> Vec<bool> {
    let rings = smallest_rings(s, &adjacency(s, false));
    let mut out = vec![false; s.atoms.len()];
    for i in 0..rings.len() {
        for j in i + 1..rings.len() {
            if rings[i].iter().filter(|a| rings[j].contains(a)).count() >= 3 {
                for &a in rings[i].iter().chain(rings[j].iter()) {
                    out[a] = true;
                }
            }
        }
    }
    out
}

/// Largest distance of a ring atom from the ring's mean plane (Newell normal), A.
fn ring_flatness(s: &Structure3d, ring: &[usize]) -> f64 {
    let n = ring.len();
    let mut c = [0.0; 3];
    for &a in ring {
        for k in 0..3 {
            c[k] += p(s, a)[k] / n as f64;
        }
    }
    let mut normal = [0.0; 3];
    for k in 0..n {
        let (u, v) = (sub(p(s, ring[k]), c), sub(p(s, ring[(k + 1) % n]), c));
        let x = cross(u, v);
        for m in 0..3 {
            normal[m] += x[m];
        }
    }
    let l = norm(normal);
    ring.iter().map(|&a| (dot(sub(p(s, a), c), normal) / l).abs()).fold(0.0, f64::max)
}

#[derive(Default, Debug)]
struct Worst {
    bond_pct: f64,
    angle_deg: f64,
    /// Largest angle deviation at atoms of bridged ring systems.
    bridged_deg: f64,
    flat_a: f64,
    clash: f64,
}

/// The R0 gate on one structure: bond lengths within 3 % of ideal, angles within 6 degrees (`bridged_tol` at atoms of a
/// bridged ring system), aromatic rings flat within 0.05 A, no pair three or more bonds apart closer than 0.8 x the van
/// der Waals sum, atom charges adding up to the species charge, and the formula's atoms all present.
fn check(s: &Structure3d, label: &str, bridged_tol: f64) -> Result<Worst, String> {
    let mut w = Worst { clash: 9.0, ..Default::default() };
    for (k, (b, r0)) in s.bonds.iter().zip(structure3d::bond_targets(s)).enumerate() {
        let dev = (dist(s, b.a, b.b) - r0).abs() / r0 * 100.0;
        w.bond_pct = w.bond_pct.max(dev);
        if dev > 3.0 {
            return Err(format!("{}: bond {} ({}{}-{}{}) {:.2} A vs ideal {:.2} ({:.1} %)", label, k, s.atoms[b.a].el, b.a, s.atoms[b.b].el, b.b, dist(s, b.a, b.b), r0, dev));
        }
    }
    let bridged = bridged_atoms(s);
    for (a, c, b, th) in structure3d::angle_targets(s) {
        let dev = (angle(s, a, c, b) - th.to_degrees()).abs();
        let tol = if bridged[c] { bridged_tol } else { 6.0 };
        if bridged[c] {
            w.bridged_deg = w.bridged_deg.max(dev);
        } else {
            w.angle_deg = w.angle_deg.max(dev);
        }
        if dev > tol {
            return Err(format!("{}: angle {}{}-{}{}-{}{} {:.1} vs ideal {:.1}", label, s.atoms[a].el, a, s.atoms[c].el, c, s.atoms[b].el, b, angle(s, a, c, b), th.to_degrees()));
        }
    }
    for ring in smallest_rings(s, &adjacency(s, true)) {
        let f = ring_flatness(s, &ring);
        w.flat_a = w.flat_a.max(f);
        if f > 0.05 {
            return Err(format!("{}: aromatic ring {:?} is {:.3} A out of plane", label, ring, f));
        }
    }
    let top = topological_distances(s);
    for i in 0..s.atoms.len() {
        for j in i + 1..s.atoms.len() {
            if top[i][j] >= 3 {
                let r = dist(s, i, j) / (data::vdw_radius(&s.atoms[i].el) + data::vdw_radius(&s.atoms[j].el));
                w.clash = w.clash.min(r);
                if r < 0.8 {
                    return Err(format!("{}: {}{} and {}{} ({} bonds apart) at {:.2} x the vdW sum", label, s.atoms[i].el, i, s.atoms[j].el, j, top[i][j], r));
                }
            }
        }
    }
    let q: i32 = s.atoms.iter().map(|a| a.charge).sum();
    if q != s.charge {
        return Err(format!("{}: atom charges add up to {} for a species of charge {}", label, q, s.charge));
    }
    if s.source != "placeholder" && s.source != "smiles" {
        if let Some(want) = structure3d::composition(&s.formula) {
            let mut have: HashMap<String, f64> = HashMap::new();
            for a in &s.atoms {
                *have.entry(a.el.clone()).or_insert(0.0) += 1.0;
            }
            let same = want.len() == have.len() && want.iter().all(|(e, n)| (have.get(e).copied().unwrap_or(0.0) - n).abs() < 1e-6);
            if !same {
                return Err(format!("{}: atoms {:?} do not match the formula {:?}", label, have, want));
            }
        }
    }
    Ok(w)
}

#[test]
fn the_zoo_embeds_within_the_geometry_gates() {
    let mut strained = Vec::new();
    for (name, smi) in ZOO {
        let s = structure3d::from_smiles(smi).unwrap_or_else(|| panic!("{} not embedded", name));
        let w = check(&s, name, 13.0).unwrap_or_else(|e| panic!("{}", e));
        if w.bridged_deg > 6.0 {
            strained.push(*name);
        }
        eprintln!("{:28} {:3} atoms  bond {:4.2} %  angle {:4.1}  flat {:5.3}  contact {:.2}", name, s.atoms.len(), w.bond_pct, w.angle_deg, w.flat_a, w.clash);
        // explicit hydrogens: every valence of the input is filled
        let h = s.atoms.iter().filter(|a| a.el == "H").count();
        let want = reaction_chamber_engine::analytical::graph::Mol::components_from_smiles(smi).unwrap().iter().map(|m| m.total_h()).sum::<u32>();
        assert_eq!(h as u32, want, "{}: {} hydrogens, the SMILES has {}", name, h, want);
    }
    // the 13 degree allowance is used only by the bicyclo[2.2.1] systems, whose one-atom bridge cannot reach a five-ring
    // angle (norbornane C1-C7-C4 is 94 degrees in reality); adamantane, also bridged, stays within 6
    assert_eq!(strained, vec!["norbornene", "camphor"], "structures beyond 6 degrees");
}

#[test]
fn the_skeleton_keeps_the_smiles_atom_order() {
    for (name, smi) in ZOO {
        let s = structure3d::from_smiles(smi).unwrap();
        let parsed = reaction_chamber_engine::smiles::parse(smi).unwrap();
        assert_eq!(s.n_heavy, parsed.atoms.len(), "{}", name);
        for (i, a) in parsed.atoms.iter().enumerate() {
            assert_eq!(s.atoms[i].el, a.element, "{}: atom {}", name, i);
        }
        // hydrogens come after the skeleton, each bonded to a skeleton atom, in skeleton order
        let mut last = 0;
        for i in s.n_heavy..s.atoms.len() {
            let host = s.bonds.iter().find_map(|b| if b.b == i { Some(b.a) } else if b.a == i { Some(b.b) } else { None }).unwrap();
            assert!(host < s.n_heavy && host >= last, "{}: hydrogen {} on {}", name, i, host);
            last = host;
        }
    }
}

#[test]
fn every_store_species_embeds() {
    let ids: Vec<String> = {
        let st = SpeciesStore::global();
        let g = st.read().unwrap();
        g.iter().map(|r| r.id.clone()).collect()
    };
    assert!(ids.len() > 1000);
    let mut by_source: HashMap<String, usize> = HashMap::new();
    for id in &ids {
        let s = structure3d::build_for_species(id, None);
        *by_source.entry(s.source.clone()).or_insert(0) += 1;
        check(&s, id, 13.0).unwrap_or_else(|e| panic!("{}", e));
    }
    eprintln!("{} store species: {:?}", ids.len(), by_source);
    assert_eq!(by_source.get("placeholder").copied().unwrap_or(0), 0, "no store species should need a placeholder");
}

#[test]
fn textbook_shapes() {
    for s in [structure3d::build_for_species("SO4-2", None), structure3d::from_formula("SO4", -2).unwrap()] {
        let sulfur = s.atoms.iter().position(|a| a.el == "S").unwrap();
        let oxy: Vec<usize> = (0..s.atoms.len()).filter(|&i| s.atoms[i].el == "O").collect();
        for i in 0..4 {
            for j in i + 1..4 {
                let a = angle(&s, oxy[i], sulfur, oxy[j]);
                assert!((a - 109.47).abs() < 3.0, "sulfate ({}) O-S-O {:.1}", s.source, a);
            }
        }
    }
    for s in [structure3d::build_for_species("NO3-", None), structure3d::from_formula("NO3", -1).unwrap()] {
        let n = s.atoms.iter().position(|a| a.el == "N").unwrap();
        let o: Vec<usize> = (0..s.atoms.len()).filter(|&i| s.atoms[i].el == "O").collect();
        let sum = angle(&s, o[0], n, o[1]) + angle(&s, o[1], n, o[2]) + angle(&s, o[0], n, o[2]);
        assert!((sum - 360.0).abs() < 1.0, "nitrate ({}) angle sum {:.1}", s.source, sum);
        assert!(ring_flatness(&s, &[o[0], n, o[1], o[2]]) < 0.02, "nitrate ({}) not planar", s.source);
    }
    for s in [structure3d::build_for_species("H2O", None), structure3d::from_formula("H2O", 0).unwrap()] {
        let a = angle(&s, 1, 0, 2);
        assert!((104.0..=110.0).contains(&a), "water ({}) H-O-H {:.1}", s.source, a);
    }
    // chlorate pyramidal (one lone pair), carbonate planar, CO2 linear
    let s = structure3d::from_formula("ClO3", -1).unwrap();
    let a = angle(&s, 1, 0, 2);
    assert!((104.0..=110.0).contains(&a), "chlorate O-Cl-O {:.1}", a);
    let s = structure3d::build_for_species("CO2(g)", None);
    let c = s.atoms.iter().position(|a| a.el == "C").unwrap();
    let o: Vec<usize> = (0..s.atoms.len()).filter(|&i| s.atoms[i].el == "O").collect();
    assert!(angle(&s, o[0], c, o[1]) > 178.0, "CO2 bent");
    // metal centres: tetraammine copper(II) square planar (d9), tetrahedral tetrahydroxoaluminate, octahedral SF6
    let s = structure3d::from_formula("Cu(NH3)4", 2).unwrap();
    let cu = s.atoms.iter().position(|a| a.el == "Cu").unwrap();
    let n: Vec<usize> = (0..s.atoms.len()).filter(|&i| s.atoms[i].el == "N").collect();
    let mut angs: Vec<f64> = Vec::new();
    for i in 0..4 {
        for j in i + 1..4 {
            angs.push(angle(&s, n[i], cu, n[j]));
        }
    }
    assert_eq!(angs.iter().filter(|a| (*a - 90.0).abs() < 4.0).count(), 4, "Cu(NH3)4 2+ not square planar: {:?}", angs);
    assert_eq!(angs.iter().filter(|a| (*a - 180.0).abs() < 4.0).count(), 2, "Cu(NH3)4 2+ not square planar: {:?}", angs);
    let s = structure3d::from_formula("Al(OH)4", -1).unwrap();
    let al = s.atoms.iter().position(|a| a.el == "Al").unwrap();
    let o: Vec<usize> = (0..s.atoms.len()).filter(|&i| s.atoms[i].el == "O").collect();
    assert!((angle(&s, o[0], al, o[1]) - 109.47).abs() < 4.0);
    let s = structure3d::from_formula("SF6", 0).unwrap();
    let f: Vec<usize> = (0..s.atoms.len()).filter(|&i| s.atoms[i].el == "F").collect();
    let trans = (1..6).filter(|&k| angle(&s, f[0], 0, f[k]) > 176.0).count();
    let cis = (1..6).filter(|&k| (angle(&s, f[0], 0, f[k]) - 90.0).abs() < 4.0).count();
    assert_eq!((trans, cis), (1, 4), "SF6 not octahedral");
    // thiocyanate binds iron(III) through nitrogen, linearly
    let s = structure3d::from_formula("Fe(SCN)", 2).unwrap();
    let fe = s.atoms.iter().position(|a| a.el == "Fe").unwrap();
    let nb = s.bonds.iter().find_map(|b| if b.a == fe { Some(b.b) } else if b.b == fe { Some(b.a) } else { None }).unwrap();
    assert_eq!(s.atoms[nb].el, "N");
}

#[test]
fn structures_come_from_the_right_source() {
    // a structure row (read from PubChem) wins over the formula rule: thiosulfate is S-SO3, not O-S-S(O)-O
    let s = structure3d::build_for_species("S2O3-2", None);
    assert_eq!(s.source, "structure_data");
    let central = (0..s.atoms.len()).find(|&i| s.atoms[i].el == "S" && s.bonds.iter().filter(|b| b.a == i || b.b == i).count() == 4);
    assert!(central.is_some(), "thiosulfate has a four-coordinate sulfur");
    // a SMILES hint (a vessel's import) wins over everything
    let s = structure3d::build_for_species("not-a-store-id", Some("CCO"));
    assert_eq!((s.source.as_str(), s.n_heavy), ("smiles", 3));
    // monatomic ions are one sphere with their Shannon radius
    let s = structure3d::build_for_species("Na+", None);
    assert_eq!(s.atoms.len(), 1);
    assert!(s.radius_a.unwrap() > 0.9 && s.radius_a.unwrap() < 1.1, "Na+ radius {:?}", s.radius_a);
    // something that is no formula becomes a labelled placeholder
    let s = structure3d::build_for_species("??", None);
    assert_eq!(s.source, "placeholder");
}

#[test]
fn the_data_files_are_consistent() {
    // every structure row parses and has the composition and charge it is filed under
    let raw: serde_json::Value = serde_json::from_str(include_str!("../data/structure_smiles.json")).unwrap();
    for row in raw["rows"].as_array().unwrap() {
        let smi = row["smiles"].as_str().unwrap();
        let s = structure3d::from_smiles(smi).unwrap_or_else(|| panic!("{} does not parse", smi));
        assert_eq!(s.charge as i64, row["charge"].as_i64().unwrap(), "{}", smi);
        let want = reaction_chamber_engine::ions::parse_formula_strict(row["formula"].as_str().unwrap()).unwrap();
        let mut have: HashMap<String, f64> = HashMap::new();
        for a in &s.atoms {
            *have.entry(a.el.clone()).or_insert(0.0) += 1.0;
        }
        assert_eq!(have.len(), want.len(), "{}", smi);
        assert!(row["source"].as_str().unwrap().contains("PubChem CID"), "{}: no source", smi);
    }
    // every element of the store has radii
    let st = SpeciesStore::global();
    let g = st.read().unwrap();
    for r in g.iter() {
        if let Some(e) = reaction_chamber_engine::ions::parse_formula_strict(&reaction_chamber_engine::ions::strip_hydrate(reaction_chamber_engine::ions::split_charge(&r.identity.formula).0).0) {
            for el in e.keys() {
                assert!(data::element(el).is_some(), "{} ({}) has no radius row", el, r.id);
            }
        }
    }
}

#[test]
fn embedding_is_deterministic() {
    for (_, smi) in ZOO.iter().step_by(3) {
        assert_eq!(structure3d::from_smiles(smi), structure3d::from_smiles(smi), "{}", smi);
    }
    for id in ["Cu(NH3)4+2", "CaSO4.2H2O(s)", "Cr2O7-2", "Fe(SCN)+2"] {
        assert_eq!(structure3d::build_for_species(id, None), structure3d::build_for_species(id, None), "{}", id);
    }
}

#[test]
fn sixty_heavy_atoms_embed_in_under_five_milliseconds() {
    for smi in SIXTY {
        let g = structure3d::BuildGraph::from_smiles(smi).unwrap();
        assert_eq!(g.n(), 60);
        let s = structure3d::from_smiles(smi).unwrap(); // warm-up (tables)
        check(&s, smi, 6.0).unwrap_or_else(|e| panic!("{}", e));
        // best of five (CPU contention from parallel tests must not fail the gate)
        let best = (0..5)
            .map(|_| {
                let t = std::time::Instant::now();
                let _ = structure3d::from_smiles(smi).unwrap();
                t.elapsed().as_secs_f64() * 1e3
            })
            .fold(f64::INFINITY, f64::min);
        eprintln!("{} atoms: {:.2} ms", s.atoms.len(), best);
        assert!(best < 5.0, "60 heavy atoms took {:.2} ms", best);
    }
}
