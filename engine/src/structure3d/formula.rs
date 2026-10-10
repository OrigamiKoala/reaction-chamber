//! The formula rule: a structure for a species that has no SMILES (most inorganic ions, ion pairs, complexes and solids
//! of the store), labelled `formula-rule` because it is a schematic built from composition and charge, not a known
//! structure.
//!
//! 1. Ions: the ionic splitter (`ions::decompose_elems_with_charge`) gives cations and anions. Each anion (and a polyatomic
//!    cation) is a fragment: the store's SMILES of that ion if it has one, else a `structure_smiles.json` row, else the
//!    central-atom rule. Protons sit on the most negative atom of an anion.
//! 2. Otherwise the formula text is read: metals are centres, parenthesised non-metal groups are ligands (`Cu(NH3)4`,
//!    `Al(OH)4`), loose non-metals become dictionary anions, an oxo fragment around a central atom, or monatomic anions.
//! 3. Central-atom rule: the least electronegative atom other than H and O is the centre (several centres form a chain,
//!    bridged by oxygen when the centre is electropositive: silicates, borates), the other atoms are its ligands, hydrogens go
//!    on terminal oxygens first; the Lewis assignment gives bond orders and charges (sulfate tetrahedral, nitrate planar,
//!    chlorate pyramidal follow from the lone pairs).
//! 4. Metals bind their fragments by a donor atom (coordinate bonds), forming a tree (no chelate rings: nothing here knows
//!    which ligands chelate). Waters of a hydrate are ligands of the metal. High-valent metals (oxidation state >= 4) bind
//!    their oxo ligands covalently, with double bonds until the metal is neutral (permanganate Mn(=O)3O-).

use std::collections::HashMap;

use super::data;
use super::graph::{assign_lewis, BuildGraph};
use crate::ions;

type Elems = HashMap<String, f64>;

fn count(e: &Elems, el: &str) -> usize {
    e.get(el).copied().unwrap_or(0.0).round().max(0.0) as usize
}

fn is_int_map(e: &Elems) -> bool {
    e.values().all(|v| (v - v.round()).abs() < 1e-6 && *v >= 0.0)
}

/// The structure of a species from its formula body (no phase tag, no charge suffix) and charge.
pub fn build(body: &str, q: i32) -> Option<BuildGraph> {
    let (base, nw) = ions::strip_hydrate(body);
    let elems = ions::parse_formula_strict(&base)?;
    if !is_int_map(&elems) || elems.values().sum::<f64>() > 400.0 {
        return None;
    }
    let waters = (nw.round().max(0.0) as usize).min(12);
    let mut g = if elems.len() == 1 {
        single_element(&elems, q)?
    } else if let Some(g) = split_path(&elems, q) {
        g
    } else {
        parse_path(&base, &elems, q)?
    };
    // waters of a hydrate: ligands of the metals up to six neighbours each, the rest lattice water
    let metals: Vec<usize> = (0..g.n()).filter(|&i| g.is_metal(i)).collect();
    for k in 0..waters {
        let off = g.append(&water());
        let host = (0..metals.len()).map(|j| metals[(j + k) % metals.len()]).find(|&m| g.neighbours(m).len() < 6);
        if let Some(m) = host {
            g.add_bond(m, off, 1.0, true);
        }
    }
    Some(g)
}

fn water() -> BuildGraph {
    let mut e = Elems::new();
    e.insert("H".into(), 2.0);
    e.insert("O".into(), 1.0);
    central_fragment(&e, &[], Some(0)).expect("water fragment")
}

fn single_element(elems: &Elems, q: i32) -> Option<BuildGraph> {
    let (el, n) = elems.iter().next().map(|(e, n)| (e.clone(), n.round() as usize))?;
    data::element(&el)?;
    let n = n.clamp(1, 24);
    let mut g = BuildGraph::default();
    if n == 1 {
        let i = g.add_atom(&el, q);
        if g.is_metal(i) {
            g.ox[i] = Some(q);
        }
        return Some(g);
    }
    for k in 0..n {
        g.add_atom(&el, 0);
        if k > 0 {
            g.add_bond(k - 1, k, 1.0, false);
        }
    }
    if data::is_metal(&el) {
        // the charge shared over the atoms (Hg2+2: two Hg(I))
        for i in 0..n {
            let z = q / n as i32 + if (i as i32) < q % n as i32 { 1 } else { 0 };
            g.charge[i] = z;
            g.ox[i] = Some(z);
        }
        return Some(g);
    }
    // a neutral homonuclear molecule of five or more atoms is a ring (S8); ions and short molecules are chains
    if q == 0 && n >= 5 {
        g.add_bond(n - 1, 0, 1.0, false);
    }
    let all: Vec<usize> = (0..n).collect();
    assign_lewis(&mut g, &all, Some(q));
    Some(g)
}

// ---------------------------------------------------------------------------------------------- fragments

/// A non-metal fragment of an ion or ligand: the store's SMILES of that ion (by `id_hint`), a structure row, a metal-containing
/// ion built by the formula rule, or the central-atom rule.
fn fragment(elems: &Elems, target: Option<i32>, id_hint: Option<&str>) -> Option<BuildGraph> {
    if let Some(id) = id_hint {
        let smi = crate::db::SpeciesStore::global().read().ok().and_then(|st| st.get(id).and_then(|r| r.identity.smiles.clone()));
        if let Some(g) = smi.and_then(|s| BuildGraph::from_smiles(&s)) {
            if target.map_or(true, |t| g.total_charge() == t) && g.has_composition(elems) {
                return Some(g);
            }
        }
    }
    if let Some(row) = data::structure_row(Some(elems), target.unwrap_or(0), None) {
        if let Some(g) = BuildGraph::from_smiles(&row.smiles).filter(|g| g.has_composition(elems)) {
            return Some(g);
        }
    }
    if elems.keys().any(|e| data::is_metal(e)) {
        let body = hill(elems);
        return parse_path(&body, elems, target.unwrap_or(0));
    }
    central_fragment(elems, &[], target)
}

fn hill(elems: &Elems) -> String {
    let mut keys: Vec<&String> = elems.keys().collect();
    keys.sort();
    keys.iter().map(|k| format!("{}{}", k, elems[*k].round() as usize)).collect()
}

/// The skeleton of the central-atom rule (all bonds single, hydrogens as counts) with `groups` attached to the centres;
/// returns the graph and the indices of the centre atoms.
fn central_skeleton(elems: &Elems, groups: &[Elems]) -> Option<(BuildGraph, Vec<usize>)> {
    let mut g = BuildGraph::default();
    let n_h = count(elems, "H");
    let mut n_o = count(elems, "O");
    let mut others: Vec<(String, usize)> = elems.iter().filter(|(e, _)| *e != "H" && *e != "O").map(|(e, n)| (e.clone(), n.round() as usize)).collect();
    others.sort_by(|a, b| {
        let (ea, eb) = (data::electronegativity(&a.0), data::electronegativity(&b.0));
        ea.partial_cmp(&eb).unwrap().then(data::group(&a.0).cmp(&data::group(&b.0))).then(a.0.cmp(&b.0))
    });
    for (e, _) in &others {
        data::element(e)?;
    }
    let mut centres: Vec<usize> = Vec::new();
    if others.is_empty() {
        if n_o == 0 {
            // hydrogen only: a chain of explicit atoms
            for k in 0..n_h.max(1) {
                g.add_atom("H", 0);
                if k > 0 {
                    g.add_bond(k - 1, k, 1.0, false);
                }
            }
            return Some((g, vec![0]));
        }
        for k in 0..n_o {
            let i = g.add_atom("O", 0);
            if k > 0 {
                g.add_bond(i - 1, i, 1.0, false);
            }
            centres.push(i);
        }
        n_o = 0;
    } else {
        let (x, k) = others.remove(0);
        let bridged = k >= 2 && data::electronegativity(&x) < 2.2 && n_o >= k - 1;
        for c in 0..k {
            let i = g.add_atom(&x, 0);
            if c > 0 {
                let prev = centres[c - 1];
                if bridged {
                    let o = g.add_atom("O", 0);
                    g.add_bond(prev, o, 1.0, false);
                    g.add_bond(o, i, 1.0, false);
                    n_o -= 1;
                } else {
                    g.add_bond(prev, i, 1.0, false);
                }
            }
            centres.push(i);
        }
    }
    let cap = |g: &BuildGraph, c: usize| -> i32 {
        let maxv = data::valences(&g.el[c]).last().copied().unwrap_or(4).min(6);
        maxv - g.sigma_degree(c)
    };
    let mut rr = 0usize;
    let next_centre = |g: &BuildGraph, rr: &mut usize| -> usize {
        for k in 0..centres.len() {
            let c = centres[(*rr + k) % centres.len()];
            if cap(g, c) > 0 {
                *rr = (*rr + k + 1) % centres.len();
                return c;
            }
        }
        let c = centres[*rr % centres.len()];
        *rr += 1;
        c
    };
    for (e, n) in &others {
        for _ in 0..*n {
            let c = next_centre(&g, &mut rr);
            let i = g.add_atom(e, 0);
            g.add_bond(c, i, 1.0, false);
        }
    }
    for _ in 0..n_o {
        let c = next_centre(&g, &mut rr);
        let i = g.add_atom("O", 0);
        g.add_bond(c, i, 1.0, false);
    }
    for ge in groups {
        let (sub, _) = central_skeleton(ge, &[])?;
        let c = next_centre(&g, &mut rr);
        let off = g.append(&sub);
        let attach = attach_atom(&sub) + off;
        g.add_bond(c, attach, 1.0, false);
    }
    // hydrogens: one on each terminal oxygen, then the centres, then any atom with free valence
    let mut h_left = n_h;
    let heavy_deg = |g: &BuildGraph, i: usize| g.neighbours(i).len();
    let n0 = g.n();
    for i in 0..n0 {
        if h_left > 0 && g.el[i] == "O" && heavy_deg(&g, i) <= 1 && g.hcount[i] == 0 {
            g.hcount[i] += 1;
            h_left -= 1;
        }
    }
    let minv = |g: &BuildGraph, i: usize| data::valences(&g.el[i]).first().copied().unwrap_or(1);
    let order: Vec<usize> = centres.iter().copied().chain((0..n0).filter(|i| !centres.contains(i))).collect();
    for &i in &order {
        while h_left > 0 && minv(&g, i) - g.sigma_degree(i) > 0 {
            g.hcount[i] += 1;
            h_left -= 1;
        }
    }
    let mut k = 0;
    while h_left > 0 {
        let c = centres[k % centres.len()];
        g.hcount[c] += 1;
        h_left -= 1;
        k += 1;
    }
    Some((g, centres))
}

/// The atom by which a group attaches covalently: the most electronegative non-hydrogen atom with the fewest heavy neighbours.
fn attach_atom(g: &BuildGraph) -> usize {
    (0..g.n())
        .filter(|&i| g.el[i] != "H" || g.n() == 1)
        .max_by(|&a, &b| {
            let ka = (-(g.neighbours(a).len() as i32), data::electronegativity(&g.el[a]));
            let kb = (-(g.neighbours(b).len() as i32), data::electronegativity(&g.el[b]));
            ka.partial_cmp(&kb).unwrap().then(b.cmp(&a))
        })
        .unwrap_or(0)
}

fn central_fragment(elems: &Elems, groups: &[Elems], target: Option<i32>) -> Option<BuildGraph> {
    let (mut g, _) = central_skeleton(elems, groups)?;
    let all: Vec<usize> = (0..g.n()).collect();
    assign_lewis(&mut g, &all, target);
    Some(g)
}

fn monatomic(el: &str) -> BuildGraph {
    let mut g = BuildGraph::default();
    g.add_atom(el, 0);
    let t = -data::valences(el).first().copied().unwrap_or(0);
    assign_lewis(&mut g, &[0], Some(t));
    g
}

// ---------------------------------------------------------------------------------------------- the two paths

fn ion_elems(id: &str) -> Option<Elems> {
    ions::parse_formula_strict(ions::split_charge(id).0)
}

fn split_path(elems: &Elems, q: i32) -> Option<BuildGraph> {
    let split = ions::decompose_elems_with_charge(elems, q)?;
    let mut metals: Vec<(String, i32, usize)> = Vec::new(); // (element, oxidation state, unit) of each metal atom
    let mut frags: Vec<BuildGraph> = Vec::new();
    let mut protons = 0usize;
    let mut unit = 0usize;
    for c in &split.cations {
        let ce = ion_elems(&c.id)?;
        let n = c.n.round() as usize;
        if ce.len() == 1 && ce.contains_key("H") {
            protons += n;
            continue;
        }
        let has_metal = ce.keys().any(|e| data::is_metal(e));
        if ce.len() == 1 && !has_metal {
            return None; // a non-metal "cation" (Si+4, C+4): not an ionic compound
        }
        for _ in 0..n {
            if has_metal && ce.keys().all(|e| data::is_metal(e)) {
                // all-metal cation (Hg2+2): its atoms bonded in a chain, the charge shared
                let atoms: usize = ce.values().map(|v| v.round() as usize).sum();
                for (e, k) in &ce {
                    for _ in 0..k.round() as usize {
                        metals.push((e.clone(), c.charge / atoms.max(1) as i32, unit));
                    }
                }
                let rem = c.charge - (c.charge / atoms.max(1) as i32) * atoms as i32;
                if rem != 0 {
                    let first = metals.iter().position(|m| m.2 == unit).unwrap();
                    metals[first].1 += rem;
                }
            } else if has_metal {
                frags.push(parse_path(&hill(&ce), &ce, c.charge)?);
            } else {
                frags.push(fragment(&ce, Some(c.charge), Some(&c.id))?);
            }
            unit += 1;
        }
    }
    for a in &split.anions {
        let ae = ion_elems(&a.id)?;
        for _ in 0..a.n.round() as usize {
            frags.push(fragment(&ae, Some(a.charge), Some(&a.id))?);
        }
    }
    for _ in 0..protons {
        attach_proton(&mut frags)?;
    }
    let mut g = if metals.is_empty() {
        let mut g = BuildGraph::default();
        for f in &frags {
            g.append(f);
        }
        g
    } else {
        assemble(&metals, &frags)
    };
    reconcile_charge(&mut g, q);
    Some(g)
}

/// A proton onto the most negative atom of the fragments (the most electronegative of those, oxygen before sulfur).
fn attach_proton(frags: &mut [BuildGraph]) -> Option<()> {
    let mut best: Option<(usize, usize, (i32, f64))> = None;
    for (fi, f) in frags.iter().enumerate() {
        for i in 0..f.n() {
            if f.is_metal(i) || f.charge[i] >= 0 {
                continue;
            }
            let key = (-f.charge[i], data::electronegativity(&f.el[i]));
            if best.as_ref().map_or(true, |(_, _, k)| key.partial_cmp(k) == Some(std::cmp::Ordering::Greater)) {
                best = Some((fi, i, key));
            }
        }
    }
    let (fi, i, _) = best.or_else(|| {
        // no negative atom: the atom with a lone pair and the highest electronegativity
        let mut b: Option<(usize, usize, (i32, f64))> = None;
        for (fi, f) in frags.iter().enumerate() {
            for i in 0..f.n() {
                if f.is_metal(i) || f.lone_pairs(i) == 0 {
                    continue;
                }
                let key = (0, data::electronegativity(&f.el[i]));
                if b.as_ref().map_or(true, |(_, _, k)| key.1 > k.1) {
                    b = Some((fi, i, key));
                }
            }
        }
        b
    })?;
    frags[fi].hcount[i] += 1;
    frags[fi].charge[i] += 1;
    Some(())
}

#[derive(Debug)]
enum Tok {
    El(String, usize),
    Group(String, usize),
}

fn tokens(s: &str) -> Option<Vec<Tok>> {
    let mut out = Vec::new();
    for part in s.split(|c| c == '.' || c == '·') {
        let chars: Vec<char> = part.trim().chars().collect();
        let mut i = 0;
        let mut mult = 0usize;
        while i < chars.len() && chars[i].is_ascii_digit() {
            mult = mult * 10 + chars[i].to_digit(10)? as usize;
            i += 1;
        }
        let mult = mult.max(1);
        let read_n = |i: &mut usize| -> usize {
            let mut n = 0usize;
            let mut any = false;
            while *i < chars.len() && chars[*i].is_ascii_digit() {
                n = n * 10 + chars[*i].to_digit(10).unwrap() as usize;
                *i += 1;
                any = true;
            }
            if !any && *i < chars.len() && (chars[*i] == 'n' || chars[*i] == 'x') {
                *i += 1;
            }
            if any { n } else { 1 }
        };
        while i < chars.len() {
            let c = chars[i];
            if c == '(' || c == '[' {
                let mut depth = 1;
                let start = i + 1;
                i += 1;
                while i < chars.len() && depth > 0 {
                    if chars[i] == '(' || chars[i] == '[' {
                        depth += 1;
                    } else if chars[i] == ')' || chars[i] == ']' {
                        depth -= 1;
                    }
                    i += 1;
                }
                if depth != 0 {
                    return None;
                }
                let inner: String = chars[start..i - 1].iter().collect();
                let n = read_n(&mut i);
                out.push(Tok::Group(inner, n * mult));
            } else if c.is_ascii_uppercase() {
                let mut sym = c.to_string();
                i += 1;
                if i < chars.len() && chars[i].is_ascii_lowercase() {
                    sym.push(chars[i]);
                    i += 1;
                }
                let n = read_n(&mut i);
                out.push(Tok::El(sym, n * mult));
            } else {
                return None;
            }
        }
    }
    Some(out)
}

fn parse_path(base: &str, elems: &Elems, q: i32) -> Option<BuildGraph> {
    let toks = tokens(base).unwrap_or_else(|| {
        let mut v: Vec<(String, f64)> = elems.iter().map(|(e, n)| (e.clone(), *n)).collect();
        v.sort_by(|a, b| a.0.cmp(&b.0));
        v.into_iter().map(|(e, n)| Tok::El(e, n.round() as usize)).collect()
    });
    let mut metals: Vec<(String, usize)> = Vec::new();
    let mut loose = Elems::new();
    let mut groups: Vec<Elems> = Vec::new();
    for t in toks {
        match t {
            Tok::El(e, n) => {
                data::element(&e)?;
                if data::is_metal(&e) {
                    metals.push((e, n));
                } else {
                    *loose.entry(e).or_insert(0.0) += n as f64;
                }
            }
            Tok::Group(inner, n) => {
                let ge = ions::parse_formula_strict(&inner)?;
                if ge.keys().any(|e| data::is_metal(e)) {
                    for (e, k) in ge {
                        if data::is_metal(&e) {
                            metals.push((e, (k * n as f64).round() as usize));
                        } else {
                            *loose.entry(e).or_insert(0.0) += k * n as f64;
                        }
                    }
                } else {
                    for _ in 0..n {
                        groups.push(ge.clone());
                    }
                }
            }
        }
    }
    if metals.is_empty() {
        if loose.is_empty() {
            let mut g = BuildGraph::default();
            for ge in &groups {
                let (id, t) = dictionary_match(ge);
                g.append(&fragment(ge, t, id.as_deref())?);
            }
            reconcile_charge(&mut g, q);
            return Some(g);
        }
        let mut g = central_fragment(&loose, &groups, Some(q))?;
        reconcile_charge(&mut g, q);
        return Some(g);
    }
    let mut frags: Vec<BuildGraph> = Vec::new();
    for ge in &groups {
        let (id, t) = dictionary_match(ge);
        frags.push(fragment(ge, t.or(Some(natural_charge(ge))), id.as_deref())?);
    }
    // loose non-metals: dictionary anions (most complex first), then an oxo fragment around a central atom, then monatomic anions
    let mut rest = loose.clone();
    for a in ions::anions() {
        let Some(ae) = ion_elems(a.id) else { continue };
        if ae.keys().any(|e| data::is_metal(e)) {
            continue;
        }
        while ae.iter().all(|(e, n)| rest.get(e).copied().unwrap_or(0.0) + 1e-9 >= *n) {
            for (e, n) in &ae {
                let v = rest.get_mut(e).unwrap();
                *v -= n;
            }
            rest.retain(|_, v| *v > 1e-9);
            frags.push(fragment(&ae, Some(a.charge), Some(a.id))?);
        }
    }
    if !rest.is_empty() {
        let en_o = data::electronegativity("O");
        let has_centre = count(&rest, "O") > 0 && rest.keys().any(|e| e != "O" && e != "H" && data::electronegativity(e) < en_o);
        if has_centre {
            frags.push(central_fragment(&rest, &[], Some(natural_charge(&rest)))?);
        } else {
            let mut keys: Vec<String> = rest.keys().cloned().collect();
            keys.sort();
            for e in keys {
                for _ in 0..count(&rest, &e) {
                    frags.push(monatomic(&e));
                }
            }
        }
    }
    // oxidation states: the most common charge of each metal, the remainder of the species charge on the first metal
    let mut ms: Vec<(String, i32, usize)> = Vec::new();
    for (k, (e, n)) in metals.iter().enumerate() {
        let z = ions::cation_charges(e).and_then(|c| c.first().copied()).unwrap_or(2);
        for _ in 0..*n {
            ms.push((e.clone(), z, usize::MAX - k - ms.len()));
        }
    }
    let frag_q: i32 = frags.iter().map(|f| f.total_charge()).sum();
    let diff = q - frag_q - ms.iter().map(|m| m.1).sum::<i32>();
    if diff != 0 && !ms.is_empty() {
        let n = ms.len() as i32;
        for (k, m) in ms.iter_mut().enumerate() {
            m.1 += diff / n + if (k as i32) < diff % n { 1 } else { 0 };
        }
    }
    let mut g = assemble(&ms, &frags);
    reconcile_charge(&mut g, q);
    Some(g)
}

/// The dictionary anion with exactly these elements (id and charge), if any.
fn dictionary_match(e: &Elems) -> (Option<String>, Option<i32>) {
    let key = ions::element_key(e);
    for a in ions::anions() {
        if let Some(ae) = ion_elems(a.id) {
            if ions::element_key(&ae) == key {
                return (Some(a.id.to_string()), Some(a.charge));
            }
        }
    }
    (None, None)
}

/// The charge the Lewis assignment gives a fragment left to itself (the least charged structure).
fn natural_charge(e: &Elems) -> i32 {
    central_fragment(e, &[], None).map_or(0, |g| g.total_charge())
}

/// Donor atoms of a fragment for a metal, best first.
fn donors(f: &BuildGraph, soft: bool) -> Vec<usize> {
    let mut v: Vec<(usize, f64)> = (0..f.n())
        .filter(|&i| !f.is_metal(i))
        .map(|i| {
            let el = f.el[i].as_str();
            let lp = f.lone_pairs(i);
            let g = data::group(el).unwrap_or(0);
            let mut s = match g {
                16 if el == "O" => 3.0,
                15 if data::element(el).map_or(false, |r| r.z <= 10) => 3.0,
                14 if lp > 0 || f.charge[i] < 0 => 4.0,
                16 | 15 => 2.0,
                17 => 2.0,
                _ => 1.0,
            };
            if lp == 0 && !(g == 14 && f.charge[i] < 0) {
                s -= 10.0;
            }
            if f.charge[i] < 0 {
                s += 1.0;
            }
            let heavy_period3 = data::element(el).map_or(false, |r| r.z > 10);
            if soft && heavy_period3 && (g == 16 || g == 15 || g == 17) {
                s += 2.5;
            }
            if f.neighbours(i).len() <= 1 {
                s += 0.5;
            }
            (i, s)
        })
        .collect();
    v.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap().then(a.0.cmp(&b.0)));
    let mut out: Vec<usize> = v.iter().map(|x| x.0).collect();
    if out.is_empty() && f.n() > 0 {
        out.push(0);
    }
    out
}

/// Soft (polarisable) metal ions prefer heavy donors (S, P, I): group 10-12 metals in low oxidation states.
fn is_soft(el: &str, ox: i32) -> bool {
    matches!(data::group(el), Some(10..=12)) && ox <= 2
}

/// Metals + fragments as one tree: fragment j belongs to metal j mod m (bound by its best donor); every further metal is
/// joined to an earlier fragment by a free donor, so each link joins two separate pieces and no ring is closed.
fn assemble(metals: &[(String, i32, usize)], frags: &[BuildGraph]) -> BuildGraph {
    let mut g = BuildGraph::default();
    let mut mi: Vec<usize> = Vec::new();
    for (e, z, _) in metals {
        let i = g.add_atom(e, *z);
        g.ox[i] = Some(*z);
        mi.push(i);
    }
    // metals of one all-metal unit (Hg2+2) bonded in a chain
    for a in 0..metals.len() {
        for b in a + 1..metals.len() {
            if metals[a].2 == metals[b].2 && metals[a].2 < usize::MAX / 2 && !(a + 1..b).any(|c| metals[c].2 == metals[a].2) {
                g.add_bond(mi[a], mi[b], 1.0, false);
            }
        }
    }
    let m = mi.len();
    let mut offs: Vec<usize> = Vec::new();
    let mut used: Vec<Vec<usize>> = Vec::new();
    for f in frags {
        offs.push(g.append(f));
        used.push(Vec::new());
    }
    if m == 0 {
        return g;
    }
    let link = |g: &mut BuildGraph, used: &mut Vec<Vec<usize>>, metal: usize, fj: usize| {
        let soft = is_soft(&g.el[mi[metal]], g.ox[mi[metal]].unwrap_or(0));
        let ds = donors(&frags[fj], soft);
        let pick = ds.iter().copied().find(|d| !used[fj].contains(d)).unwrap_or(ds[0]);
        used[fj].push(pick);
        g.add_bond(mi[metal], offs[fj] + pick, 1.0, true);
    };
    let mut owner: Vec<usize> = Vec::new();
    for fj in 0..frags.len() {
        let metal = fj % m;
        link(&mut g, &mut used, metal, fj);
        owner.push(metal);
    }
    // join metals that are not yet connected to metal 0's piece (same-unit metals already are)
    for k in 1..m {
        let joined_by_unit = metals[k].2 < usize::MAX / 2 && (0..k).any(|j| metals[j].2 == metals[k].2);
        if joined_by_unit || frags.is_empty() {
            if frags.is_empty() && !joined_by_unit {
                g.add_bond(mi[k - 1], mi[k], 1.0, false);
            }
            continue;
        }
        let candidates: Vec<usize> = (0..frags.len()).filter(|&fj| owner[fj] < k).collect();
        if candidates.is_empty() {
            continue;
        }
        let fj = *candidates.iter().max_by_key(|&&fj| (donors(&frags[fj], false).len() as i64 - used[fj].len() as i64, usize::MAX - fj)).unwrap();
        link(&mut g, &mut used, k, fj);
    }
    high_valent_oxo(&mut g);
    g
}

/// Metals in oxidation state >= 4 bind bare oxo ligands covalently, with double bonds until the metal is neutral.
fn high_valent_oxo(g: &mut BuildGraph) {
    for mtl in 0..g.n() {
        let Some(ox) = g.ox[mtl] else { continue };
        if !g.is_metal(mtl) || ox < 4 {
            continue;
        }
        let oxo: Vec<usize> = g
            .neighbours(mtl)
            .into_iter()
            .filter(|&(o, k)| g.bonds[k].coordinate && g.el[o] == "O" && g.hcount[o] == 0 && g.neighbours(o).len() == 1)
            .map(|(_, k)| k)
            .collect();
        if oxo.is_empty() {
            continue;
        }
        let mut fc = ox;
        for &k in &oxo {
            let o = if g.bonds[k].a == mtl { g.bonds[k].b } else { g.bonds[k].a };
            g.bonds[k].coordinate = false;
            g.charge[o] += 1;
            fc -= 1;
        }
        for &k in &oxo {
            if fc < 1 {
                break;
            }
            let o = if g.bonds[k].a == mtl { g.bonds[k].b } else { g.bonds[k].a };
            if g.charge[o] < 0 {
                g.bonds[k].order = 2.0;
                g.charge[o] += 1;
                fc -= 1;
            }
        }
        g.charge[mtl] = fc;
    }
}

/// Makes the atom charges add up to the species charge (a metal, else the most fitting atom, takes the difference).
fn reconcile_charge(g: &mut BuildGraph, q: i32) {
    let d = q - g.total_charge();
    if d == 0 || g.n() == 0 {
        return;
    }
    let pick = (0..g.n()).find(|&i| g.is_metal(i)).unwrap_or_else(|| {
        if d < 0 {
            (0..g.n()).max_by(|&a, &b| data::electronegativity(&g.el[a]).partial_cmp(&data::electronegativity(&g.el[b])).unwrap().then(b.cmp(&a))).unwrap()
        } else {
            (0..g.n()).filter(|&i| g.el[i] != "H").min_by(|&a, &b| data::electronegativity(&g.el[a]).partial_cmp(&data::electronegativity(&g.el[b])).unwrap().then(a.cmp(&b))).unwrap_or(0)
        }
    });
    g.charge[pick] += d;
}
