//! Generic ion / formula machinery: periodic table, common ions, and automatic decomposition of an
//! arbitrary ionic formula (e.g. "KCl", "ClK", "Pb(NO3)2", "N2O6Pb", "CuSO4.5H2O") into the ions it releases in
//! water. Nothing here is specific to one compound: the compound's element counts are matched against general
//! anion / cation tables with charge balance, so any simple salt, acid or hydroxide is handled.

use std::collections::HashMap;

// ---------------------------------------------------------------------------------------------- periodic table

/// Standard atomic weights (g/mol).
static ATOMIC_MASS: &[(&str, f64)] = &[
    ("H", 1.008), ("He", 4.0026), ("Li", 6.94), ("Be", 9.0122), ("B", 10.81), ("C", 12.011), ("N", 14.007),
    ("O", 15.999), ("F", 18.998), ("Ne", 20.180), ("Na", 22.990), ("Mg", 24.305), ("Al", 26.982), ("Si", 28.085),
    ("P", 30.974), ("S", 32.06), ("Cl", 35.45), ("Ar", 39.948), ("K", 39.098), ("Ca", 40.078), ("Sc", 44.956),
    ("Ti", 47.867), ("V", 50.942), ("Cr", 51.996), ("Mn", 54.938), ("Fe", 55.845), ("Co", 58.933), ("Ni", 58.693),
    ("Cu", 63.546), ("Zn", 65.38), ("Ga", 69.723), ("Ge", 72.630), ("As", 74.922), ("Se", 78.971), ("Br", 79.904),
    ("Kr", 83.798), ("Rb", 85.468), ("Sr", 87.62), ("Y", 88.906), ("Zr", 91.224), ("Nb", 92.906), ("Mo", 95.95),
    ("Tc", 98.0), ("Ru", 101.07), ("Rh", 102.91), ("Pd", 106.42), ("Ag", 107.868), ("Cd", 112.414), ("In", 114.818),
    ("Sn", 118.710), ("Sb", 121.760), ("Te", 127.60), ("I", 126.904), ("Xe", 131.293), ("Cs", 132.905),
    ("Ba", 137.327), ("La", 138.905), ("Ce", 140.116), ("Pr", 140.908), ("Nd", 144.242), ("Pm", 145.0),
    ("Sm", 150.36), ("Eu", 151.964), ("Gd", 157.25), ("Tb", 158.925), ("Dy", 162.500), ("Ho", 164.930),
    ("Er", 167.259), ("Tm", 168.934), ("Yb", 173.045), ("Lu", 174.967), ("Hf", 178.49), ("Ta", 180.948),
    ("W", 183.84), ("Re", 186.207), ("Os", 190.23), ("Ir", 192.217), ("Pt", 195.084), ("Au", 196.967),
    ("Hg", 200.592), ("Tl", 204.38), ("Pb", 207.2), ("Bi", 208.980), ("Po", 209.0), ("Ra", 226.0), ("Th", 232.038),
    ("U", 238.029),
];

pub fn atomic_mass(symbol: &str) -> Option<f64> {
    ATOMIC_MASS.iter().find(|(s, _)| *s == symbol).map(|(_, m)| *m)
}

/// Molar mass of an element-count map. Returns None if any symbol is unknown.
pub fn mass_of_elements(elems: &HashMap<String, f64>) -> Option<f64> {
    let mut m = 0.0;
    for (e, n) in elems {
        m += atomic_mass(e)? * n;
    }
    Some(m)
}

// ---------------------------------------------------------------------------------------------- formula parsing

/// Parses a plain formula (no charge, no phase tag, no hydrate) into element counts.
/// Supports nested ( ) / [ ] groups with multipliers, dot-separated components (e.g. CaO.SiO2),
/// and variable / polymer indices ('n', 'x'). Returns None on malformed input or unknown symbols.
pub fn parse_formula_strict(formula: &str) -> Option<HashMap<String, f64>> {
    let chars: Vec<char> = formula.chars().filter(|c| !c.is_whitespace()).collect();
    let mut i = 0;
    if let Some(out) = parse_group(&chars, &mut i, 0) {
        if i == chars.len() && !out.is_empty() && out.keys().all(|e| atomic_mass(e).is_some()) {
            return Some(out);
        }
    }
    // If direct parse failed and formula contains '.' or '·', try splitting components
    if formula.contains('.') || formula.contains('·') {
        let parts: Vec<&str> = formula.split(|c| c == '.' || c == '·').collect();
        if parts.len() > 1 {
            let mut combined: HashMap<String, f64> = HashMap::new();
            for part in parts {
                let part = part.trim();
                if part.is_empty() {
                    continue;
                }
                let p_chars: Vec<char> = part.chars().collect();
                let mut pi = 0;
                let mult = read_count(&p_chars, &mut pi);
                let remainder: String = p_chars[pi..].iter().collect();
                let sub = parse_formula_strict(&remainder)?;
                for (elem, count) in sub {
                    *combined.entry(elem).or_insert(0.0) += count * mult;
                }
            }
            if !combined.is_empty() && combined.keys().all(|e| atomic_mass(e).is_some()) {
                return Some(combined);
            }
        }
    }
    None
}

fn read_count(chars: &[char], i: &mut usize) -> f64 {
    let mut s = String::new();
    while *i < chars.len() && (chars[*i].is_ascii_digit() || chars[*i] == '.') {
        s.push(chars[*i]);
        *i += 1;
    }
    if s.is_empty() {
        if *i < chars.len()
            && (chars[*i] == 'n' || chars[*i] == 'x')
            && (*i + 1 >= chars.len() || !chars[*i + 1].is_ascii_lowercase())
        {
            *i += 1;
            1.0
        } else {
            1.0
        }
    } else {
        s.parse().unwrap_or(1.0)
    }
}

fn parse_group(chars: &[char], i: &mut usize, depth: usize) -> Option<HashMap<String, f64>> {
    if depth > 6 {
        return None;
    }
    let mut out: HashMap<String, f64> = HashMap::new();
    while *i < chars.len() {
        let c = chars[*i];
        if c == '(' || c == '[' {
            *i += 1;
            let inner = parse_group(chars, i, depth + 1)?;
            let mult = read_count(chars, i);
            for (e, n) in inner {
                *out.entry(e).or_insert(0.0) += n * mult;
            }
        } else if c == ')' || c == ']' {
            if depth == 0 {
                return None;
            }
            *i += 1;
            return Some(out);
        } else if c.is_ascii_uppercase() {
            let mut sym = String::new();
            sym.push(c);
            *i += 1;
            if *i < chars.len() && chars[*i].is_ascii_lowercase() {
                sym.push(chars[*i]);
                *i += 1;
            }
            let n = read_count(chars, i);
            *out.entry(sym).or_insert(0.0) += n;
        } else {
            return None;
        }
    }
    if depth > 0 {
        return None;
    }
    Some(out)
}

/// Splits a trailing charge from a species id: "Ba+2" -> ("Ba", 2), "CH3COO-" -> ("CH3COO", -1), "Hg2+2" -> ("Hg2", 2).
pub fn split_charge(species: &str) -> (&str, i32) {
    if let Some(pos) = species.rfind(|c| c == '+' || c == '-') {
        let tail = &species[pos + 1..];
        if tail.chars().all(|c| c.is_ascii_digit()) {
            let sign = if species.as_bytes()[pos] == b'+' { 1 } else { -1 };
            let mag: i32 = if tail.is_empty() { 1 } else { tail.parse().unwrap_or(1) };
            return (&species[..pos], sign * mag);
        }
    }
    (species, 0)
}

/// Charge of a species id, e.g. "PO4-3" -> -3.
pub fn species_charge(species: &str) -> i32 {
    let (body, q) = split_charge(species.trim().trim_end_matches("(s)").trim_end_matches("(l)").trim_end_matches("(g)").trim_end_matches("(aq)"));
    if q != 0 {
        return q;
    }
    if let Some(global) = crate::db::SpeciesStore::try_global() {
        if let Ok(store) = global.try_read() {
            if let Some(rec) = store.get(body).or_else(|| store.get(species)) {
                return rec.identity.charge;
            }
        }
    }
    q
}

thread_local! {
    /// Element counts and molar masses by species id: pure functions of the id (a static table and a formula parser) that the
    /// equilibrium solver asks for thousands of times per step. The cache is dropped whenever the species store changes
    /// (an id that was unknown can become a record) and a lookup that could not read the store is never cached.
    static ELEMENT_CACHE: std::cell::RefCell<(u64, HashMap<String, Option<(HashMap<String, f64>, Option<f64>)>>)> = std::cell::RefCell::new((0, HashMap::new()));
}

/// Element counts of a species id, and whether the answer may be cached (false when the store was busy).
fn species_elements_uncached(species: &str) -> (Option<HashMap<String, f64>>, bool) {
    let s = species.trim().trim_end_matches("(s)").trim_end_matches("(l)").trim_end_matches("(g)").trim_end_matches("(aq)");
    // isomer tag of an inert compound id ("C2H6O#LCGLNKUT"): identity only, the formula is what comes before it
    let s = s.split('#').next().unwrap_or(s);
    let (body, _) = split_charge(s);
    if let Some(elems) = parse_formula_strict(body) {
        return (Some(elems), true);
    }
    if let Some(global) = crate::db::SpeciesStore::try_global() {
        match global.try_read() {
            Ok(store) => {
                if let Some(rec) = store.get(body).or_else(|| store.get(species)).or_else(|| store.get_by_name(species)) {
                    let (rec_body, _) = split_charge(&rec.identity.formula);
                    return (parse_formula_strict(rec_body), true);
                }
            }
            // a writer (or this thread's own write lock) holds the store: the answer is unknown, not "no such species"
            Err(_) => return (None, false),
        }
    }
    (None, true)
}

fn cached_species<R>(species: &str, f: impl FnOnce(&Option<(HashMap<String, f64>, Option<f64>)>) -> R) -> R {
    ELEMENT_CACHE.with(|c| {
        let generation = crate::db::SpeciesStore::generation();
        {
            let mut guard = c.borrow_mut();
            if guard.0 != generation {
                guard.1.clear();
                guard.0 = generation;
            }
            if let Some(v) = guard.1.get(species) {
                return f(v);
            }
        }
        let (elems, cacheable) = species_elements_uncached(species);
        let entry = elems.map(|e| {
            let m = mass_of_elements(&e);
            (e, m)
        });
        let r = f(&entry);
        if cacheable {
            let mut guard = c.borrow_mut();
            if guard.1.len() > 20_000 {
                guard.1.clear();
            }
            guard.1.insert(species.to_string(), entry);
        }
        r
    })
}

/// Element counts of a species id (charge and phase tags ignored).
pub fn species_elements(species: &str) -> Option<HashMap<String, f64>> {
    cached_species(species, |e| e.as_ref().map(|(el, _)| el.clone()))
}

/// Molar mass of a species id from its formula (None if it cannot be parsed).
pub fn species_mass(species: &str) -> Option<f64> {
    cached_species(species, |e| e.as_ref().and_then(|(_, m)| *m))
}

/// Canonical order-independent key of an element multiset ("ClNa" and "NaCl" give the same key).
pub fn element_key(elems: &HashMap<String, f64>) -> String {
    let mut v: Vec<(&String, &f64)> = elems.iter().collect();
    v.sort_by(|a, b| a.0.cmp(b.0));
    v.iter().map(|(e, n)| format!("{}{}", e, **n as i64)).collect::<Vec<_>>().join("")
}

pub fn formula_key(formula: &str) -> Option<String> {
    let cleaned = strip_hydrate(formula).0;
    parse_formula_strict(&cleaned).map(|e| element_key(&e))
}

/// Strips a hydrate suffix ("CuSO4.5H2O", "CuSO4·5H2O", "CuSO4*5H2O") returning (anhydrous formula, n_water).
pub fn strip_hydrate(formula: &str) -> (String, f64) {
    let f = formula.trim();
    for sep in ['·', '.', '*', '•'] {
        if let Some(pos) = f.find(sep) {
            let tail = &f[pos + sep.len_utf8()..];
            let digits: String = tail.chars().take_while(|c| c.is_ascii_digit() || *c == '.').collect();
            let rest = &tail[digits.len()..];
            if rest == crate::db::seed::WATER {
                let n: f64 = if digits.is_empty() { 1.0 } else { digits.parse().unwrap_or(1.0) };
                return (f[..pos].to_string(), n);
            }
        }
    }
    (f.to_string(), 0.0)
}

// ---------------------------------------------------------------------------------------------- ion tables

#[derive(Clone, Debug)]
pub struct IonDef {
    /// Species id used by the engine (PHREEQC style, e.g. "SO4-2").
    pub id: &'static str,
    /// Element composition formula of the ion (no charge), e.g. "SO4".
    pub formula: &'static str,
    pub charge: i32,
    /// Neutral parent acid species id for anions that protonate (used to look up weak-acid equilibria).
    pub acid: Option<&'static str>,
}

#[derive(serde::Deserialize)]
struct AnionRow {
    id: String,
    formula: String,
    charge: i32,
    acid: Option<String>,
}

#[derive(serde::Deserialize)]
struct PolyCationRow {
    id: String,
    formula: String,
    charge: i32,
    /// False for a cation the splitter must not propose (H3O+: acid hydrogens are H+).
    split: bool,
}

#[derive(serde::Deserialize)]
struct IonDictionary {
    anions: Vec<AnionRow>,
    cation_charges: Vec<(String, Vec<i32>)>,
    poly_cations: Vec<PolyCationRow>,
    cation_solid_hue: HashMap<String, [f64; 3]>,
    cation_solid_hue_default: [f64; 3],
    anion_solid_tint: HashMap<String, [f64; 3]>,
}

struct Dictionary {
    anions: Vec<IonDef>,
    cation_charges: Vec<(&'static str, &'static [i32])>,
    poly_cations: Vec<(&'static str, &'static str, i32)>,
    raw: IonDictionary,
}

fn leak(s: String) -> &'static str {
    Box::leak(s.into_boxed_str())
}

/// The ion dictionary (`data/ion_dictionary.json`), parsed once.
fn dictionary() -> &'static Dictionary {
    static D: std::sync::OnceLock<Dictionary> = std::sync::OnceLock::new();
    D.get_or_init(|| {
        let raw: IonDictionary = serde_json::from_str(include_str!("../data/ion_dictionary.json")).expect("data/ion_dictionary.json");
        let anions = raw.anions.iter().map(|a| IonDef { id: leak(a.id.clone()), formula: leak(a.formula.clone()), charge: a.charge, acid: a.acid.clone().map(leak) }).collect();
        let cation_charges = raw.cation_charges.iter().map(|(s, c)| (leak(s.clone()), &*Box::leak(c.clone().into_boxed_slice()))).collect();
        let poly_cations = raw.poly_cations.iter().filter(|p| p.split).map(|p| (leak(p.id.clone()), leak(p.formula.clone()), p.charge)).collect();
        Dictionary { anions, cation_charges, poly_cations, raw }
    })
}

/// Anions, most complex first (they are matched in this order so "HSO4-" wins over "SO4-2" + H).
pub fn anions() -> &'static [IonDef] {
    &dictionary().anions
}

/// Allowed charges of a monatomic cation, most common first.
pub fn cation_charges(symbol: &str) -> Option<&'static [i32]> {
    dictionary().cation_charges.iter().find(|(s, _)| *s == symbol).map(|(_, c)| *c)
}

/// Engine species id of a monatomic cation: "Na+", "Ca+2", "Fe+3".
pub fn cation_id(symbol: &str, charge: i32) -> String {
    match charge {
        1 => format!("{}+", symbol),
        n => format!("{}+{}", symbol, n),
    }
}

pub fn anion_def(id: &str) -> Option<&'static IonDef> {
    anions().iter().find(|a| a.id == id)
}


#[derive(Clone, Debug, PartialEq)]
pub struct IonCount {
    pub id: String,
    pub charge: i32,
    pub n: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct IonicSplit {
    pub cations: Vec<IonCount>,
    pub anions: Vec<IonCount>,
}

impl IonicSplit {
    pub fn all(&self) -> impl Iterator<Item = &IonCount> {
        self.cations.iter().chain(self.anions.iter())
    }
}

type Elems = HashMap<String, f64>;

fn sub_elems(have: &Elems, unit: &Elems, n: f64) -> Option<Elems> {
    let mut out = have.clone();
    for (e, c) in unit {
        let cur = out.get(e).copied().unwrap_or(0.0);
        let left = cur - c * n;
        if left < -1e-9 {
            return None;
        }
        if left < 1e-9 {
            out.remove(e);
        } else {
            out.insert(e.clone(), left);
        }
    }
    Some(out)
}

fn is_int(x: f64) -> bool {
    (x - x.round()).abs() < 1e-6
}

/// Expresses `rest` as a set of cations of total charge `target`: polyatomic cations (NH4+, Hg2+2) first with
/// every feasible multiplicity (largest first), then monatomic cations with every allowed oxidation state.
fn cation_solutions(rest: &Elems, target: i32) -> Option<Vec<IonCount>> {
    if !rest.values().all(|&c| is_int(c)) {
        return None;
    }
    poly_cations(0, rest, target, Vec::new())
}

fn poly_cations(idx: usize, rest: &Elems, target: i32, chosen: Vec<IonCount>) -> Option<Vec<IonCount>> {
    // (H3O+ is not in the list the splitter uses: acid hydrogens are handled as H+ by the monatomic table.)
    let poly = &dictionary().poly_cations;
    if idx >= poly.len() {
        return mono_cations(rest, target, chosen);
    }
    let (id, formula, z) = poly[idx];
    let unit = parse_formula_strict(formula)?;
    let max_n = unit
        .iter()
        .map(|(e, c)| (rest.get(e).copied().unwrap_or(0.0) / c).floor() as i64)
        .min()
        .unwrap_or(0);
    for n in (1..=max_n).rev() {
        if let Some(w2) = sub_elems(rest, &unit, n as f64) {
            let mut c2 = chosen.clone();
            c2.push(IonCount { id: id.to_string(), charge: z, n: n as f64 });
            if let Some(res) = poly_cations(idx + 1, &w2, target - z * n as i32, c2) {
                return Some(res);
            }
        }
    }
    poly_cations(idx + 1, rest, target, chosen)
}

fn mono_cations(rest: &Elems, target: i32, base: Vec<IonCount>) -> Option<Vec<IonCount>> {
    let mut elems: Vec<(String, f64)> = rest.iter().map(|(e, n)| (e.clone(), *n)).collect();
    elems.sort_by(|a, b| a.0.cmp(&b.0));
    if elems.is_empty() {
        return if target == 0 { Some(base) } else { None };
    }
    if elems.len() > 3 {
        return None;
    }
    fn rec(elems: &[(String, f64)], idx: usize, remaining: i32, acc: &mut Vec<IonCount>) -> bool {
        if idx == elems.len() {
            return remaining == 0;
        }
        let (sym, n) = &elems[idx];
        let charges = match cation_charges(sym) {
            Some(c) => c,
            None => return false,
        };
        if !is_int(*n) {
            return false;
        }
        for &z in charges {
            let contribution = z * (*n as i32);
            acc.push(IonCount { id: cation_id(sym, z), charge: z, n: *n });
            if rec(elems, idx + 1, remaining - contribution, acc) {
                return true;
            }
            acc.pop();
        }
        false
    }
    let mut acc = base;
    if rec(&elems, 0, target, &mut acc) {
        Some(acc)
    } else {
        None
    }
}

/// Decomposes an ionic formula into cations and anions by element-multiset matching with charge balance.
/// Order-independent (works for Hill-ordered PubChem formulas such as "ClK" / "N2O6Pb"). Returns None for
/// molecular (non-salt) formulas.
pub fn decompose_ionic(formula: &str) -> Option<IonicSplit> {
    let (base, _) = strip_hydrate(formula);
    let elems = parse_formula_strict(&base)?;
    decompose_elems(&elems)
}

pub fn decompose_elems(elems: &Elems) -> Option<IonicSplit> {
    decompose_elems_with_charge(elems, 0)
}

/// `decompose_elems` for a species of net charge `charge` (a complex or ion pair such as "CeH2PO4+2" = Ce+3 + H2PO4-):
/// the cations then carry the anions' charge plus `charge`.
pub fn decompose_elems_with_charge(elems: &Elems, charge: i32) -> Option<IonicSplit> {
    // A compound of a single element has no ionic split (metals, O2, ...)
    if elems.len() < 2 || element_key(elems) == "H2O1" {
        return None;
    }
    let mut cands: Vec<IonicSplit> = Vec::new();
    search_anions(elems, 0, Vec::new(), 0, &mut cands, 0, charge);
    // Prefer the simplest explanation: fewest distinct anions, then fewest distinct cations; ties keep table order
    // (so more protonated anions such as HSO4- win over SO4-2 + H+).
    let mut best: Option<(usize, usize, IonicSplit)> = None;
    for c in cands {
        if !acceptable(&c) {
            continue;
        }
        let key = (c.anions.len(), c.cations.len());
        if best.as_ref().map_or(true, |(a, b, _)| key < (*a, *b)) {
            best = Some((key.0, key.1, c));
        }
    }
    best.map(|(_, _, c)| c)
}

/// An acid (only H+ as cation) must be exactly one anion unit with its protons (HCl, H2SO4, CH3COOH), otherwise
/// arbitrary molecules such as glucose (= 3 x acetic acid) would be mistaken for acids.
fn acceptable(split: &IonicSplit) -> bool {
    if split.cations.iter().all(|c| c.id == crate::db::seed::PROTON) {
        return split.anions.len() == 1 && (split.anions[0].n - 1.0).abs() < 1e-9;
    }
    true
}

fn search_anions(
    rest: &Elems,
    start: usize,
    chosen: Vec<IonCount>,
    anion_charge: i32,
    out: &mut Vec<IonicSplit>,
    depth: usize,
    extra: i32,
) {
    if depth > 2 || out.len() > 64 {
        return;
    }
    for idx in start..anions().len() {
        let a = &anions()[idx];
        let unit = match parse_formula_strict(a.formula) {
            Some(u) => u,
            None => continue,
        };
        let max_n = unit
            .iter()
            .map(|(e, c)| (rest.get(e).copied().unwrap_or(0.0) / c).floor() as i64)
            .min()
            .unwrap_or(0);
        for n in (1..=max_n).rev() {
            let w2 = match sub_elems(rest, &unit, n as f64) {
                Some(w) => w,
                None => continue,
            };
            let mut chosen2 = chosen.clone();
            chosen2.push(IonCount { id: a.id.to_string(), charge: a.charge, n: n as f64 });
            let ac2 = anion_charge + (-a.charge) * n as i32;
            if !w2.is_empty() {
                if let Some(cats) = cation_solutions(&w2, ac2 + extra) {
                    out.push(IonicSplit { cations: cats, anions: chosen2.clone() });
                }
            }
            search_anions(&w2, idx + 1, chosen2, ac2, out, depth + 1, extra);
        }
    }
}

/// Atoms of hydrogen delivered to solution as H+ in a split (acids).
pub fn proton_count(split: &IonicSplit) -> f64 {
    split.cations.iter().filter(|c| c.id == crate::db::seed::PROTON).map(|c| c.n).sum()
}

// ---------------------------------------------------------------------------------------------- appearance hints

/// Fallback colour (linear-sRGB-ish) of a solid containing this cation, from general transition-metal chemistry
/// (`data/ion_dictionary.json`).
pub fn cation_solid_hue(cation_id: &str) -> [f64; 3] {
    let d = &dictionary().raw;
    d.cation_solid_hue.get(cation_id).copied().unwrap_or(d.cation_solid_hue_default)
}

/// Strongly coloured anion contributing to a solid's colour (chromate, permanganate, sulfide of heavy metals...).
pub fn anion_solid_tint(anion_id: &str) -> Option<[f64; 3]> {
    dictionary().raw.anion_solid_tint.get(anion_id).copied()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(split: &IonicSplit) -> (Vec<(String, f64)>, Vec<(String, f64)>) {
        let mut c: Vec<_> = split.cations.iter().map(|i| (i.id.clone(), i.n)).collect();
        let mut a: Vec<_> = split.anions.iter().map(|i| (i.id.clone(), i.n)).collect();
        c.sort_by(|x, y| x.0.cmp(&y.0));
        a.sort_by(|x, y| x.0.cmp(&y.0));
        (c, a)
    }

    #[test]
    fn decomposes_common_salts_in_any_order() {
        let cases: &[(&str, &[(&str, f64)], &[(&str, f64)])] = &[
            ("KCl", &[("K+", 1.0)], &[("Cl-", 1.0)]),
            ("ClK", &[("K+", 1.0)], &[("Cl-", 1.0)]),
            ("Pb(NO3)2", &[("Pb+2", 1.0)], &[("NO3-", 2.0)]),
            ("N2O6Pb", &[("Pb+2", 1.0)], &[("NO3-", 2.0)]),
            ("Na2SO4", &[("Na+", 2.0)], &[("SO4-2", 1.0)]),
            ("Na2O4S", &[("Na+", 2.0)], &[("SO4-2", 1.0)]),
            ("K2CrO4", &[("K+", 2.0)], &[("CrO4-2", 1.0)]),
            ("CrK2O4", &[("K+", 2.0)], &[("CrO4-2", 1.0)]),
            ("BaCl2", &[("Ba+2", 1.0)], &[("Cl-", 2.0)]),
            ("FeCl3", &[("Fe+3", 1.0)], &[("Cl-", 3.0)]),
            ("FeCl2", &[("Fe+2", 1.0)], &[("Cl-", 2.0)]),
            ("Fe2(SO4)3", &[("Fe+3", 2.0)], &[("SO4-2", 3.0)]),
            ("Al2(SO4)3", &[("Al+3", 2.0)], &[("SO4-2", 3.0)]),
            ("(NH4)2SO4", &[("NH4+", 2.0)], &[("SO4-2", 1.0)]),
            ("NH4Cl", &[("NH4+", 1.0)], &[("Cl-", 1.0)]),
            ("NaHCO3", &[("Na+", 1.0)], &[("HCO3-", 1.0)]),
            ("CHNaO3", &[("Na+", 1.0)], &[("HCO3-", 1.0)]),
            ("NaOH", &[("Na+", 1.0)], &[("OH-", 1.0)]),
            ("Ca(OH)2", &[("Ca+2", 1.0)], &[("OH-", 2.0)]),
            ("HCl", &[("H+", 1.0)], &[("Cl-", 1.0)]),
            ("H2SO4", &[("H+", 1.0)], &[("HSO4-", 1.0)]),
            ("Na3PO4", &[("Na+", 3.0)], &[("PO4-3", 1.0)]),
            ("Na2S2O3", &[("Na+", 2.0)], &[("S2O3-2", 1.0)]),
            ("KMnO4", &[("K+", 1.0)], &[("MnO4-", 1.0)]),
            ("CuCl", &[("Cu+", 1.0)], &[("Cl-", 1.0)]),
            ("Hg2Cl2", &[("Hg2+2", 1.0)], &[("Cl-", 2.0)]),
            ("CH3COONa", &[("Na+", 1.0)], &[("CH3COO-", 1.0)]),
            ("CuSO4.5H2O", &[("Cu+2", 1.0)], &[("SO4-2", 1.0)]),
        ];
        for (f, cats, ans) in cases {
            let split = decompose_ionic(f).unwrap_or_else(|| panic!("{} should decompose", f));
            let (c, a) = ids(&split);
            let mut ec: Vec<(String, f64)> = cats.iter().map(|(i, n)| (i.to_string(), *n)).collect();
            let mut ea: Vec<(String, f64)> = ans.iter().map(|(i, n)| (i.to_string(), *n)).collect();
            ec.sort_by(|x, y| x.0.cmp(&y.0));
            ea.sort_by(|x, y| x.0.cmp(&y.0));
            // Fe(II) vs Fe(III) / acid forms: compare exactly
            assert_eq!((c, a), (ec, ea), "decomposition of {}", f);
        }
    }

    #[test]
    fn molecules_and_elements_are_not_salts() {
        for f in ["C2H6O", "C6H12O6", crate::db::seed::WATER, "Mg", "O2", "CH4"] {
            assert!(decompose_ionic(f).is_none(), "{} must not be treated as a salt", f);
        }
    }

    #[test]
    fn charge_and_mass_parsing() {
        assert_eq!(species_charge("PO4-3"), -3);
        assert_eq!(species_charge("Hg2+2"), 2);
        assert_eq!(species_charge("Cu(NH3)4+2"), 2);
        assert_eq!(species_charge("Na+"), 1);
        assert_eq!(species_charge("CO2(aq)"), 0);
        assert!((species_mass("Pb+2").unwrap() - 207.2).abs() < 1e-6);
        assert!((species_mass("CrO4-2").unwrap() - 115.99).abs() < 0.01);
        assert!((species_mass("PbI2(s)").unwrap() - 461.0).abs() < 0.1);
        assert_eq!(formula_key("ClNa"), formula_key("NaCl"));
    }
}
