//! A small SMARTS subset and a subgraph matcher over the SMILES graph (`smiles.rs`), used to assign UNIFAC subgroups.
//!
//! Supported (everything the original-UNIFAC subgroup patterns of the published table use, apart from recursive
//! `$()` atoms, which the loader reports as unsupported):
//!   * atoms: bare organic-subset symbols (`C` aliphatic, `c` aromatic, `N`, `O`, `S`, `Cl`, `Br`, `F`, `I`, ...), `*`,
//!     and bracket atoms with the primitives element symbol, `X<n>` (total connections incl. hydrogens), `H<n>` (hydrogens),
//!     `D<n>` (heavy-atom degree), `R` / `R0` (ring membership), `+`/`-` charge, `#<Z>`, `a` / `A`, combined with `!`
//!     (not), `,` (or), `&` or juxtaposition (and), `;` (low-precedence and);
//!   * bonds: default (single or aromatic), `-`, `=`, `#`, `:` (aromatic), `~` (any);
//!   * branches `( )`, ring-closure digits, `.` is not supported.
//! A pattern that uses anything else fails to parse (`parse` returns None) so it is never silently half-applied.

use crate::smiles::Molecule;

#[derive(Clone, Debug, PartialEq)]
enum Prim {
    Elem { sym: String, aromatic: Option<bool> },
    AnyAtom,
    Aromatic(bool),
    X(u32),
    H(u32),
    D(u32),
    Ring(bool),
    Charge(i32),
    Z(u32),
}

#[derive(Clone, Debug, PartialEq)]
enum Expr {
    And(Vec<Expr>),
    Or(Vec<Expr>),
    Not(Box<Expr>),
    Prim(Prim),
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum BondQ {
    /// single or aromatic (the SMARTS default)
    Default,
    Single,
    Double,
    Triple,
    Aromatic,
    Any,
}

#[derive(Clone, Debug)]
pub struct Pattern {
    atoms: Vec<Expr>,
    /// (earlier atom, later atom, bond query), in construction order
    bonds: Vec<(usize, usize, BondQ)>,
}

fn count_prims(e: &Expr) -> u32 {
    match e {
        Expr::Prim(_) => 1,
        Expr::Not(x) => count_prims(x),
        Expr::And(v) | Expr::Or(v) => v.iter().map(count_prims).sum(),
    }
}

impl Pattern {
    pub fn n_atoms(&self) -> usize {
        self.atoms.len()
    }

    /// How many primitive constraints the pattern states (a ring-specific ether pattern is more specific than a plain one).
    pub fn specificity(&self) -> u32 {
        self.atoms.iter().map(count_prims).sum::<u32>() + self.bonds.iter().filter(|b| b.2 != BondQ::Default).count() as u32
    }
}

// ------------------------------------------------------------------------------------------------ parsing

struct Cursor {
    ch: Vec<char>,
    i: usize,
}

impl Cursor {
    fn peek(&self) -> Option<char> {
        self.ch.get(self.i).copied()
    }
    fn digits(&mut self) -> Option<u32> {
        let start = self.i;
        while self.peek().map_or(false, |c| c.is_ascii_digit()) {
            self.i += 1;
        }
        if start == self.i {
            None
        } else {
            self.ch[start..self.i].iter().collect::<String>().parse().ok()
        }
    }
}

fn parse_element(c: &mut Cursor) -> Option<Prim> {
    let first = c.peek()?;
    if first.is_ascii_uppercase() {
        let mut sym = first.to_string();
        c.i += 1;
        // two-letter symbols
        if let Some(n) = c.peek() {
            let two: String = format!("{}{}", sym, n);
            if matches!(two.as_str(), "Cl" | "Br" | "Si") {
                sym = two;
                c.i += 1;
            }
        }
        Some(Prim::Elem { sym, aromatic: Some(false) })
    } else if matches!(first, 'c' | 'n' | 'o' | 's' | 'p' | 'b') {
        c.i += 1;
        Some(Prim::Elem { sym: first.to_ascii_uppercase().to_string(), aromatic: Some(true) })
    } else {
        None
    }
}

fn parse_prim(c: &mut Cursor) -> Option<Expr> {
    match c.peek()? {
        '!' => {
            c.i += 1;
            Some(Expr::Not(Box::new(parse_prim(c)?)))
        }
        '$' => None, // recursive SMARTS: unsupported
        'X' => {
            c.i += 1;
            Some(Expr::Prim(Prim::X(c.digits().unwrap_or(1))))
        }
        'H' => {
            c.i += 1;
            Some(Expr::Prim(Prim::H(c.digits().unwrap_or(1))))
        }
        'D' => {
            c.i += 1;
            Some(Expr::Prim(Prim::D(c.digits().unwrap_or(1))))
        }
        'R' => {
            c.i += 1;
            match c.digits() {
                Some(0) => Some(Expr::Prim(Prim::Ring(false))),
                _ => Some(Expr::Prim(Prim::Ring(true))),
            }
        }
        'a' => {
            c.i += 1;
            Some(Expr::Prim(Prim::Aromatic(true)))
        }
        'A' => {
            c.i += 1;
            Some(Expr::Prim(Prim::Aromatic(false)))
        }
        '#' => {
            c.i += 1;
            Some(Expr::Prim(Prim::Z(c.digits()?)))
        }
        '+' => {
            c.i += 1;
            Some(Expr::Prim(Prim::Charge(c.digits().unwrap_or(1) as i32)))
        }
        '-' => {
            c.i += 1;
            Some(Expr::Prim(Prim::Charge(-(c.digits().unwrap_or(1) as i32))))
        }
        '*' => {
            c.i += 1;
            Some(Expr::Prim(Prim::AnyAtom))
        }
        _ => parse_element(c).map(Expr::Prim),
    }
}

fn parse_and_list(c: &mut Cursor) -> Option<Expr> {
    let mut items = Vec::new();
    loop {
        match c.peek() {
            Some(',') | Some(';') | Some(']') | None => break,
            Some('&') => {
                c.i += 1;
            }
            Some(_) => items.push(parse_prim(c)?),
        }
    }
    if items.is_empty() {
        None
    } else if items.len() == 1 {
        items.pop()
    } else {
        Some(Expr::And(items))
    }
}

fn parse_or_list(c: &mut Cursor) -> Option<Expr> {
    let mut alts = vec![parse_and_list(c)?];
    while c.peek() == Some(',') {
        c.i += 1;
        alts.push(parse_and_list(c)?);
    }
    Some(if alts.len() == 1 { alts.pop().unwrap() } else { Expr::Or(alts) })
}

fn parse_bracket(c: &mut Cursor) -> Option<Expr> {
    // after '['
    let mut parts = vec![parse_or_list(c)?];
    while c.peek() == Some(';') {
        c.i += 1;
        parts.push(parse_or_list(c)?);
    }
    if c.peek() != Some(']') {
        return None;
    }
    c.i += 1;
    Some(if parts.len() == 1 { parts.pop().unwrap() } else { Expr::And(parts) })
}

/// Parses a SMARTS pattern of the supported subset.
pub fn parse(smarts: &str) -> Option<Pattern> {
    let mut c = Cursor { ch: smarts.trim().chars().collect(), i: 0 };
    let mut atoms: Vec<Expr> = Vec::new();
    let mut bonds: Vec<(usize, usize, BondQ)> = Vec::new();
    let mut stack: Vec<usize> = Vec::new();
    let mut prev: Option<usize> = None;
    let mut pending: Option<BondQ> = None;
    let mut rings: std::collections::HashMap<u32, (usize, Option<BondQ>)> = std::collections::HashMap::new();
    while let Some(ch) = c.peek() {
        match ch {
            '(' => {
                stack.push(prev?);
                c.i += 1;
            }
            ')' => {
                prev = Some(stack.pop()?);
                c.i += 1;
            }
            '-' => {
                pending = Some(BondQ::Single);
                c.i += 1;
            }
            '=' => {
                pending = Some(BondQ::Double);
                c.i += 1;
            }
            '#' => {
                pending = Some(BondQ::Triple);
                c.i += 1;
            }
            ':' => {
                pending = Some(BondQ::Aromatic);
                c.i += 1;
            }
            '~' => {
                pending = Some(BondQ::Any);
                c.i += 1;
            }
            '0'..='9' => {
                let n = ch.to_digit(10)?;
                c.i += 1;
                let here = prev?;
                match rings.remove(&n) {
                    Some((other, q)) => {
                        let bq = pending.take().or(q).unwrap_or(BondQ::Default);
                        bonds.push((other.min(here), other.max(here), bq));
                    }
                    None => {
                        rings.insert(n, (here, pending.take()));
                    }
                }
            }
            '[' => {
                c.i += 1;
                let e = parse_bracket(&mut c)?;
                let idx = atoms.len();
                atoms.push(e);
                if let Some(p) = prev {
                    bonds.push((p, idx, pending.take().unwrap_or(BondQ::Default)));
                }
                prev = Some(idx);
            }
            '*' => {
                c.i += 1;
                let idx = atoms.len();
                atoms.push(Expr::Prim(Prim::AnyAtom));
                if let Some(p) = prev {
                    bonds.push((p, idx, pending.take().unwrap_or(BondQ::Default)));
                }
                prev = Some(idx);
            }
            _ => {
                let prim = parse_element(&mut c)?;
                let idx = atoms.len();
                atoms.push(Expr::Prim(prim));
                if let Some(p) = prev {
                    bonds.push((p, idx, pending.take().unwrap_or(BondQ::Default)));
                }
                prev = Some(idx);
            }
        }
    }
    if !stack.is_empty() || !rings.is_empty() || atoms.is_empty() {
        return None;
    }
    Some(Pattern { atoms, bonds })
}

// ------------------------------------------------------------------------------------------------ matching

/// Precomputed per-atom facts of a molecule the matcher needs.
pub struct MolView<'a> {
    pub mol: &'a Molecule,
    pub adj: Vec<Vec<(usize, f64)>>,
    pub h: Vec<u32>,
    pub in_ring: Vec<bool>,
}

impl<'a> MolView<'a> {
    pub fn new(mol: &'a Molecule) -> Self {
        let n = mol.atoms.len();
        let mut adj: Vec<Vec<(usize, f64)>> = vec![Vec::new(); n];
        for &(a, b, o) in &mol.bonds {
            adj[a].push((b, o));
            adj[b].push((a, o));
        }
        let h: Vec<u32> = (0..n).map(|i| mol.hydrogens(i)).collect();
        // ring atoms: an atom is in a ring when one of its bonds is not a bridge
        let mut in_ring = vec![false; n];
        let mut bridge = vec![false; mol.bonds.len()];
        {
            let mut disc = vec![usize::MAX; n];
            let mut low = vec![0usize; n];
            let mut timer = 0usize;
            // adjacency with bond ids
            let mut adj_id: Vec<Vec<(usize, usize)>> = vec![Vec::new(); n];
            for (id, &(a, b, _)) in mol.bonds.iter().enumerate() {
                adj_id[a].push((b, id));
                adj_id[b].push((a, id));
            }
            for root in 0..n {
                if disc[root] != usize::MAX {
                    continue;
                }
                // iterative DFS: (node, parent bond id, next neighbour index)
                let mut st: Vec<(usize, usize, usize)> = vec![(root, usize::MAX, 0)];
                disc[root] = timer;
                low[root] = timer;
                timer += 1;
                while let Some(&mut (u, pb, ref mut k)) = st.last_mut() {
                    if *k < adj_id[u].len() {
                        let (v, id) = adj_id[u][*k];
                        *k += 1;
                        if id == pb {
                            continue;
                        }
                        if disc[v] == usize::MAX {
                            disc[v] = timer;
                            low[v] = timer;
                            timer += 1;
                            st.push((v, id, 0));
                        } else {
                            low[u] = low[u].min(disc[v]);
                        }
                    } else {
                        st.pop();
                        if let Some(&(p, _, _)) = st.last() {
                            low[p] = low[p].min(low[u]);
                            if low[u] > disc[p] {
                                bridge[pb] = true;
                            }
                        }
                    }
                }
            }
            for (id, &(a, b, _)) in mol.bonds.iter().enumerate() {
                if !bridge[id] {
                    in_ring[a] = true;
                    in_ring[b] = true;
                }
            }
        }
        Self { mol, adj, h, in_ring }
    }

    fn eval_prim(&self, p: &Prim, i: usize) -> bool {
        let a = &self.mol.atoms[i];
        match p {
            Prim::AnyAtom => true,
            Prim::Elem { sym, aromatic } => a.element == *sym && aromatic.map_or(true, |ar| ar == a.aromatic),
            Prim::Aromatic(v) => a.aromatic == *v,
            Prim::X(n) => (self.adj[i].len() as u32 + self.h[i]) == *n,
            Prim::H(n) => self.h[i] == *n,
            Prim::D(n) => self.adj[i].len() as u32 == *n,
            Prim::Ring(v) => self.in_ring[i] == *v,
            Prim::Charge(q) => a.charge == *q,
            Prim::Z(z) => crate::smarts::atomic_number(&a.element) == Some(*z),
        }
    }

    fn eval(&self, e: &Expr, i: usize) -> bool {
        match e {
            Expr::Prim(p) => self.eval_prim(p, i),
            Expr::Not(x) => !self.eval(x, i),
            Expr::And(v) => v.iter().all(|x| self.eval(x, i)),
            Expr::Or(v) => v.iter().any(|x| self.eval(x, i)),
        }
    }
}

/// Atomic number of the elements organic molecules contain (enough for `#Z` primitives).
pub fn atomic_number(sym: &str) -> Option<u32> {
    const SYMBOLS: [&str; 92] = [
        "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca", "Sc", "Ti", "V", "Cr",
        "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr", "Y", "Zr", "Nb", "Mo", "Tc", "Ru", "Rh", "Pd",
        "Ag", "Cd", "In", "Sn", "Sb", "Te", "I", "Xe", "Cs", "Ba", "La", "Ce", "Pr", "Nd", "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er",
        "Tm", "Yb", "Lu", "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg", "Tl", "Pb", "Bi", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Th",
        "Pa", "U",
    ];
    SYMBOLS.iter().position(|s| *s == sym).map(|i| i as u32 + 1)
}

fn bond_ok(q: BondQ, order: f64) -> bool {
    let eq = |x: f64| (order - x).abs() < 1e-9;
    match q {
        BondQ::Default => eq(1.0) || eq(1.5),
        BondQ::Single => eq(1.0),
        BondQ::Double => eq(2.0),
        BondQ::Triple => eq(3.0),
        BondQ::Aromatic => eq(1.5),
        BondQ::Any => true,
    }
}

/// Every embedding of the pattern in the molecule: for each, the molecule atom matched by each pattern atom.
pub fn find_matches(view: &MolView, pat: &Pattern) -> Vec<Vec<usize>> {
    let n = view.mol.atoms.len();
    let np = pat.atoms.len();
    // bonds of each pattern atom to earlier atoms
    let mut back: Vec<Vec<(usize, BondQ)>> = vec![Vec::new(); np];
    for &(a, b, q) in &pat.bonds {
        let (lo, hi) = (a.min(b), a.max(b));
        back[hi].push((lo, q));
    }
    let mut out = Vec::new();
    let mut map = vec![usize::MAX; np];
    let mut used = vec![false; n];

    fn rec(k: usize, np: usize, view: &MolView, pat: &Pattern, back: &[Vec<(usize, BondQ)>], map: &mut Vec<usize>, used: &mut Vec<bool>, out: &mut Vec<Vec<usize>>) {
        if k == np {
            out.push(map.clone());
            return;
        }
        let n = view.mol.atoms.len();
        // candidates: neighbours of the anchor when the atom has an earlier bonded atom, else every atom
        let cands: Vec<usize> = match back[k].first() {
            Some(&(anchor, q)) => view.adj[map[anchor]].iter().filter(|&&(_, o)| bond_ok(q, o)).map(|&(j, _)| j).collect(),
            None => (0..n).collect(),
        };
        for j in cands {
            if used[j] || !view.eval(&pat.atoms[k], j) {
                continue;
            }
            // every bond to an earlier pattern atom must exist with the right order
            let ok = back[k].iter().all(|&(e, q)| view.adj[j].iter().any(|&(t, o)| t == map[e] && bond_ok(q, o)));
            if !ok {
                continue;
            }
            map[k] = j;
            used[j] = true;
            rec(k + 1, np, view, pat, back, map, used, out);
            used[j] = false;
            map[k] = usize::MAX;
        }
    }
    rec(0, np, view, pat, &back, &mut map, &mut used, &mut out);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::smiles;

    fn count(smi: &str, sma: &str) -> usize {
        let m = smiles::parse(smi).unwrap();
        let v = MolView::new(&m);
        let p = parse(sma).unwrap_or_else(|| panic!("pattern {} must parse", sma));
        let mut sets: Vec<Vec<usize>> = find_matches(&v, &p).into_iter().map(|mut s| { s.sort(); s }).collect();
        sets.sort();
        sets.dedup();
        sets.len()
    }

    #[test]
    fn primitives_and_hydrogens() {
        assert_eq!(count("CCO", "[CX4;H3]"), 1);
        assert_eq!(count("CCO", "[CX4;H2]"), 1);
        assert_eq!(count("CCO", "[OX2;H1]"), 1);
        assert_eq!(count("COC", "[OX2;H1]"), 0);
        assert_eq!(count("O", "[OH2]"), 1);
        assert_eq!(count("c1ccccc1", "[cX3;H1]"), 6);
        assert_eq!(count("Cc1ccccc1", "[cX3;H0][CX4;H3]"), 1);
    }

    #[test]
    fn bonds_rings_and_or_lists() {
        assert_eq!(count("CC(C)=O", "[CX4;H3][CX3](=O)"), 2);
        assert_eq!(count("CC(=O)OCC", "[CH3][CX3;H0](=[O])[O]"), 1);
        assert_eq!(count("C1CCOC1", "[CX4;H2;R][OX2;R]"), 2);
        assert_eq!(count("CCOCC", "[CX4;H2;R][OX2;R]"), 0);
        assert_eq!(count("CC(=O)OC", "[CX3,cX3](=[OX1])[OX2,oX2]"), 1);
        assert_eq!(count("c1ccncc1", "[cX3;H1]1:[cX3;H1]:[cX3;H1]:[nX2;H0]:[cX3;H1]:[cX3;H1]:1"), 1);
    }

    #[test]
    fn unsupported_patterns_do_not_parse() {
        assert!(parse("[$([Cl;H0]([C]=[C]))]").is_none());
        assert!(parse("[CX4;H2").is_none());
        assert!(parse("C(").is_none());
    }
}
