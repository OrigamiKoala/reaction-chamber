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
