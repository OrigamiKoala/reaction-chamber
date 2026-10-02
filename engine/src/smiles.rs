//! A minimal SMILES graph reader, enough to count functional groups for identity confirmation (Stage 0).
//!
//! It parses atoms (organic subset and bracket atoms), bonds, branches, ring closures and dot-disconnected fragments,
//! and derives implicit hydrogens from standard valences. It is *not* a cheminformatics toolkit: stereochemistry is
//! ignored, aromaticity is taken as written. Stage 9 (structure-based chemistry) replaces it with the full structure
//! pipeline; until then it lets the engine ask "is this molecule really a carboxylic acid?" without substring matching.

#[derive(Clone, Debug, PartialEq)]
pub struct Atom {
    pub element: String,
    pub aromatic: bool,
    pub charge: i32,
    /// Explicit hydrogen count of a bracket atom (`[OH]`); None for organic-subset atoms (implicit hydrogens).
    pub explicit_h: Option<u32>,
}

#[derive(Clone, Debug, Default)]
pub struct Molecule {
    pub atoms: Vec<Atom>,
    /// (atom a, atom b, bond order: 1, 2, 3 or 1.5 for an aromatic bond)
    pub bonds: Vec<(usize, usize, f64)>,
}

fn organic_valences(el: &str) -> &'static [u32] {
    match el {
        "B" => &[3],
        "C" => &[4],
        "N" => &[3, 5],
        "O" => &[2],
        "P" => &[3, 5],
        "S" => &[2, 4, 6],
        "F" | "Cl" | "Br" | "I" => &[1],
        _ => &[],
    }
}

/// Parses a SMILES string. None when it is malformed.
pub fn parse(smiles: &str) -> Option<Molecule> {
    let chars: Vec<char> = smiles.trim().chars().collect();
    if chars.is_empty() {
        return None;
    }
    let mut mol = Molecule::default();
    let mut stack: Vec<usize> = Vec::new();
    let mut prev: Option<usize> = None;
    let mut pending_bond: Option<f64> = None;
    let mut rings: std::collections::HashMap<u32, (usize, Option<f64>)> = std::collections::HashMap::new();
    let mut i = 0;

    let add_atom = |mol: &mut Molecule, atom: Atom, prev: &mut Option<usize>, pending: &mut Option<f64>| {
        let idx = mol.atoms.len();
        let aromatic = atom.aromatic;
        mol.atoms.push(atom);
        if let Some(p) = *prev {
            let order = pending.take().unwrap_or(if aromatic && mol.atoms[p].aromatic { 1.5 } else { 1.0 });
            mol.bonds.push((p, idx, order));
        } else {
            pending.take();
        }
        *prev = Some(idx);
    };

    while i < chars.len() {
        let c = chars[i];
        match c {
            '(' => {
                stack.push(prev?);
                i += 1;
            }
            ')' => {
                prev = Some(stack.pop()?);
                i += 1;
            }
            '.' => {
                prev = None;
                pending_bond = None;
                i += 1;
            }
            '-' | '/' | '\\' => {
                pending_bond = Some(1.0);
                i += 1;
            }
            '=' => {
                pending_bond = Some(2.0);
                i += 1;
            }
            '#' => {
                pending_bond = Some(3.0);
                i += 1;
            }
            ':' => {
                pending_bond = Some(1.5);
                i += 1;
            }
            '0'..='9' | '%' => {
                let num: u32 = if c == '%' {
                    let d: String = chars.get(i + 1..i + 3)?.iter().collect();
                    i += 3;
                    d.parse().ok()?
                } else {
                    i += 1;
                    c.to_digit(10)?
                };
                let here = prev?;
                match rings.remove(&num) {
                    Some((other, order)) => {
                        let o = pending_bond.take().or(order).unwrap_or(
                            if mol.atoms[here].aromatic && mol.atoms[other].aromatic { 1.5 } else { 1.0 },
                        );
                        mol.bonds.push((other, here, o));
                    }
                    None => {
                        rings.insert(num, (here, pending_bond.take()));
                    }
                }
            }
            '[' => {
                let end = chars[i..].iter().position(|&x| x == ']')? + i;
                let inner: Vec<char> = chars[i + 1..end].to_vec();
                let mut j = 0;
                while j < inner.len() && inner[j].is_ascii_digit() {
                    j += 1; // isotope
                }
                let mut sym = String::new();
                let aromatic;
                if j < inner.len() && inner[j].is_ascii_lowercase() {
                    aromatic = true;
                    sym.push(inner[j].to_ascii_uppercase());
                    j += 1;
                    if j < inner.len() && inner[j].is_ascii_lowercase() && matches!(sym.as_str(), "S" | "A") && inner[j] == 'e' {
                        sym.push('e');
                        j += 1;
                    }
                } else if j < inner.len() && inner[j].is_ascii_uppercase() {
                    aromatic = false;
                    sym.push(inner[j]);
                    j += 1;
                    if j < inner.len() && inner[j].is_ascii_lowercase() {
                        sym.push(inner[j]);
                        j += 1;
                    }
                } else {
                    return None;
                }
                while j < inner.len() && inner[j] == '@' {
                    j += 1;
                }
                let mut h = 0u32;
                if j < inner.len() && inner[j] == 'H' {
                    j += 1;
                    let mut n = String::new();
                    while j < inner.len() && inner[j].is_ascii_digit() {
                        n.push(inner[j]);
                        j += 1;
                    }
                    h = if n.is_empty() { 1 } else { n.parse().ok()? };
                }
                let mut charge = 0i32;
                if j < inner.len() && (inner[j] == '+' || inner[j] == '-') {
                    let sign = if inner[j] == '+' { 1 } else { -1 };
                    j += 1;
                    let mut n = String::new();
                    while j < inner.len() && inner[j].is_ascii_digit() {
                        n.push(inner[j]);
                        j += 1;
                    }
                    if n.is_empty() {
                        let mut count = 1;
                        while j < inner.len() && ((sign == 1 && inner[j] == '+') || (sign == -1 && inner[j] == '-')) {
                            count += 1;
                            j += 1;
                        }
                        charge = sign * count;
                    } else {
                        charge = sign * n.parse::<i32>().ok()?;
                    }
                }
                add_atom(&mut mol, Atom { element: sym, aromatic, charge, explicit_h: Some(h) }, &mut prev, &mut pending_bond);
                i = end + 1;
            }
            _ if c.is_ascii_alphabetic() => {
                let (sym, aromatic, len) = if c == 'C' && chars.get(i + 1) == Some(&'l') {
                    ("Cl".to_string(), false, 2)
                } else if c == 'B' && chars.get(i + 1) == Some(&'r') {
                    ("Br".to_string(), false, 2)
                } else if c.is_ascii_uppercase() {
                    (c.to_string(), false, 1)
                } else if matches!(c, 'b' | 'c' | 'n' | 'o' | 'p' | 's') {
                    (c.to_ascii_uppercase().to_string(), true, 1)
                } else {
                    return None;
                };
                if organic_valences(&sym).is_empty() {
                    return None;
                }
                add_atom(&mut mol, Atom { element: sym, aromatic, charge: 0, explicit_h: None }, &mut prev, &mut pending_bond);
                i += len;
            }
            _ => return None,
        }
    }
    if !stack.is_empty() || !rings.is_empty() {
        return None;
    }
    Some(mol)
}

impl Molecule {
    pub fn neighbours(&self, i: usize) -> Vec<(usize, f64)> {
        self.bonds
            .iter()
            .filter_map(|&(a, b, o)| if a == i { Some((b, o)) } else if b == i { Some((a, o)) } else { None })
            .collect()
    }

    /// Hydrogen count of atom `i`: explicit for bracket atoms, from the standard valence otherwise.
    pub fn hydrogens(&self, i: usize) -> u32 {
        let atom = &self.atoms[i];
        if let Some(h) = atom.explicit_h {
            return h;
        }
        let nb = self.neighbours(i);
        let mut sum: f64 = 0.0;
        let mut arom = 0u32;
        for (_, o) in &nb {
            if (*o - 1.5).abs() < 1e-9 {
                sum += 1.0;
                arom += 1;
            } else {
                sum += *o;
            }
        }
        if atom.aromatic && arom > 0 {
            sum += 1.0; // the shared pi bond
        }
        let used = sum.round() as u32;
        organic_valences(&atom.element).iter().find(|v| **v >= used).map_or(0, |v| v - used)
    }

    /// A copy in which Kekule aromatic ring systems (as PubChem writes them: `C1=CC=CC=C1`) are marked aromatic, with
    /// aromatic bond orders (1.5) inside them, the form the group patterns are written for. Aromaticity is a Hueckel
    /// perception on ring systems: every atom of a candidate ring is sp2 (a double bond into the system, or a heteroatom lone
    /// pair), and the pi-electron count of the fused system is 4n+2. A molecule that already carries aromatic atoms
    /// (lower-case SMILES) is returned unchanged. Hydrogen counts are frozen from the Kekule form first.
    pub fn aromatized(&self) -> Molecule {
        let n = self.atoms.len();
        let mut out = self.clone();
        if n == 0 || self.atoms.iter().any(|a| a.aromatic) {
            return out;
        }
        let h: Vec<u32> = (0..n).map(|i| self.hydrogens(i)).collect();
        for (i, a) in out.atoms.iter_mut().enumerate() {
            a.explicit_h = Some(h[i]);
        }
        let mut adj: Vec<Vec<(usize, f64)>> = vec![Vec::new(); n];
        for &(a, b, o) in &self.bonds {
            adj[a].push((b, o));
            adj[b].push((a, o));
        }
        // simple cycles of 5-7 atoms (each found from its lowest atom, deduplicated by atom set)
        let mut cycles: Vec<Vec<usize>> = Vec::new();
        {
            let mut seen: std::collections::HashSet<Vec<usize>> = std::collections::HashSet::new();
            fn dfs(start: usize, cur: usize, path: &mut Vec<usize>, adj: &[Vec<(usize, f64)>], seen: &mut std::collections::HashSet<Vec<usize>>, cycles: &mut Vec<Vec<usize>>) {
                if path.len() > 7 {
                    return;
                }
                for &(nx, _) in &adj[cur] {
                    if nx == start && path.len() >= 5 {
                        let mut key = path.clone();
                        key.sort();
                        if seen.insert(key.clone()) {
                            cycles.push(path.clone());
                        }
                    } else if nx > start && !path.contains(&nx) {
                        path.push(nx);
                        dfs(start, nx, path, adj, seen, cycles);
                        path.pop();
                    }
                }
            }
            for s in 0..n {
                let mut path = vec![s];
                dfs(s, s, &mut path, &adj, &mut seen, &mut cycles);
            }
        }
        let double_partner = |i: usize| adj[i].iter().filter(|&&(_, o)| (o - 2.0).abs() < 1e-9).map(|&(j, _)| j).collect::<Vec<usize>>();
        let lone_pair_atom = |i: usize| {
            let a = &self.atoms[i];
            a.charge == 0 && matches!(a.element.as_str(), "O" | "S" | "N") && adj[i].iter().all(|&(_, o)| (o - 1.0).abs() < 1e-9) && (a.element != "N" || adj[i].len() as u32 + h[i] == 3)
        };
        // candidate cycles: every atom sp2 with respect to the cycle's own ring system (decided after the union below)
        // first pass: atoms that could be sp2: carbon/nitrogen with a double bond, or a lone-pair heteroatom
        let sp2_like = |i: usize| -> bool {
            let a = &self.atoms[i];
            match a.element.as_str() {
                "C" | "N" => !double_partner(i).is_empty() && double_partner(i).iter().all(|&j| matches!(self.atoms[j].element.as_str(), "C" | "N")) || (a.element == "N" && lone_pair_atom(i)),
                "O" | "S" => lone_pair_atom(i),
                _ => false,
            }
        };
        let cand: Vec<&Vec<usize>> = cycles.iter().filter(|c| c.iter().all(|&i| sp2_like(i))).collect();
        // union candidate cycles sharing a bond (two or more atoms) into ring systems
        let mut system: Vec<usize> = (0..cand.len()).collect();
        fn find(p: &mut Vec<usize>, i: usize) -> usize {
            if p[i] != i {
                let r = find(p, p[i]);
                p[i] = r;
            }
            p[i]
        }
        for a in 0..cand.len() {
            for b in (a + 1)..cand.len() {
                let shared = cand[a].iter().filter(|x| cand[b].contains(x)).count();
                if shared >= 2 {
                    let (ra, rb) = (find(&mut system, a), find(&mut system, b));
                    if ra != rb {
                        system[rb] = ra;
                    }
                }
            }
        }
        let mut groups: std::collections::HashMap<usize, Vec<usize>> = std::collections::HashMap::new();
        for a in 0..cand.len() {
            let r = find(&mut system, a);
            groups.entry(r).or_default().push(a);
        }
        for (_, members) in groups {
            let mut atoms: Vec<usize> = Vec::new();
            for &m in &members {
                for &i in cand[m] {
                    if !atoms.contains(&i) {
                        atoms.push(i);
                    }
                }
            }
            // pi electrons: 1 for an atom double-bonded to another atom of the system, 2 for a lone-pair heteroatom
            let mut electrons = 0u32;
            let mut ok = true;
            for &i in &atoms {
                if double_partner(i).iter().any(|j| atoms.contains(j)) {
                    electrons += 1;
                } else if lone_pair_atom(i) {
                    electrons += 2;
                } else {
                    ok = false;
                }
            }
            if !ok || electrons % 4 != 2 {
                continue;
            }
            for &m in &members {
                let c = cand[m];
                for (idx, bnd) in out.bonds.iter_mut().enumerate() {
                    let _ = idx;
                    if c.contains(&bnd.0) && c.contains(&bnd.1) {
                        bnd.2 = 1.5;
                    }
                }
                for &i in c {
                    out.atoms[i].aromatic = true;
                }
            }
        }
        out
    }

    /// Number of acidic hydroxyl groups on a carbonyl carbon: carboxylic acids, and the two OH of carbonic acid.
    /// Neutral oxygens only (carboxylate and ester oxygens do not count).
    pub fn carboxylic_acid_oh_count(&self) -> usize {
        let mut n = 0;
        for (c, atom) in self.atoms.iter().enumerate() {
            if atom.element != "C" || atom.aromatic {
                continue;
            }
            let nb = self.neighbours(c);
            let has_carbonyl = nb.iter().any(|&(o, order)| (order - 2.0).abs() < 1e-9 && self.atoms[o].element == "O");
            if !has_carbonyl {
                continue;
            }
            for &(o, order) in &nb {
                let a = &self.atoms[o];
                if a.element == "O" && (order - 1.0).abs() < 1e-9 && a.charge == 0 && self.neighbours(o).len() == 1 && self.hydrogens(o) >= 1 {
                    n += 1;
                }
            }
        }
        n
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn acid_oh(s: &str) -> usize {
        parse(s).unwrap().carboxylic_acid_oh_count()
    }

    #[test]
    fn counts_carboxylic_acid_groups() {
        assert_eq!(acid_oh("CC(=O)O"), 1); // acetic acid
        assert_eq!(acid_oh("OC(=O)C"), 1);
        assert_eq!(acid_oh("C(C(=O)O)C(CC(=O)O)(C(=O)O)O"), 3); // citric acid
        assert_eq!(acid_oh("C(=O)(C(=O)O)O"), 2); // oxalic acid
        assert_eq!(acid_oh("C(=O)(O)O"), 2); // carbonic acid
        assert_eq!(acid_oh("c1ccccc1C(=O)O"), 1); // benzoic acid
    }

    #[test]
    fn esters_ethers_and_carboxylates_are_not_acids() {
        assert_eq!(acid_oh("COC=O"), 0); // methyl formate
        assert_eq!(acid_oh("COC"), 0); // dimethyl ether
        assert_eq!(acid_oh("CCO"), 0); // ethanol
        assert_eq!(acid_oh("CC(=O)[O-].[Na+]"), 0); // sodium acetate
        assert_eq!(acid_oh("CC(=O)OCC"), 0); // ethyl acetate
        assert_eq!(acid_oh("C(C1C(C(C(C(O1)O)O)O)O)O"), 0); // glucose
    }

    #[test]
    fn kekule_aromatic_rings_are_perceived() {
        let benz = parse("C1=CC=CC=C1").unwrap().aromatized();
        assert!(benz.atoms.iter().all(|a| a.aromatic));
        assert!(benz.bonds.iter().all(|b| (b.2 - 1.5).abs() < 1e-9));
        assert!((0..6).all(|i| benz.hydrogens(i) == 1));
        // toluene: the methyl stays aliphatic
        let tol = parse("CC1=CC=CC=C1").unwrap().aromatized();
        assert!(!tol.atoms[0].aromatic && tol.atoms[1..].iter().all(|a| a.aromatic));
        assert_eq!(tol.hydrogens(0), 3);
        // naphthalene: one 10-electron system
        let nap = parse("C1=CC=C2C=CC=CC2=C1").unwrap().aromatized();
        assert!(nap.atoms.iter().all(|a| a.aromatic));
        // furan and pyridine
        assert!(parse("C1=CC=CO1").unwrap().aromatized().atoms.iter().all(|a| a.aromatic));
        assert!(parse("C1=CC=NC=C1").unwrap().aromatized().atoms.iter().all(|a| a.aromatic));
        // cyclohexene and cyclohexane are not aromatic
        assert!(!parse("C1=CCCCC1").unwrap().aromatized().atoms.iter().any(|a| a.aromatic));
        assert!(!parse("C1CCCCC1").unwrap().aromatized().atoms.iter().any(|a| a.aromatic));
        // benzoquinone has exocyclic C=O: not aromatic
        assert!(!parse("O=C1C=CC(=O)C=C1").unwrap().aromatized().atoms.iter().any(|a| a.aromatic));
    }

    #[test]
    fn hydrogens_and_rings() {
        let m = parse("C1CCCCC1").unwrap();
        assert_eq!(m.atoms.len(), 6);
        assert_eq!(m.bonds.len(), 6);
        assert!(m.atoms.iter().enumerate().all(|(i, _)| m.hydrogens(i) == 2));
        let b = parse("c1ccccc1").unwrap();
        assert!(b.atoms.iter().enumerate().all(|(i, _)| b.hydrogens(i) == 1));
        assert!(parse("C(C").is_none());
        assert!(parse("C1CC").is_none());
    }
}
