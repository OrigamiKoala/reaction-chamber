//! The literal ban (docs/plans/generalization-master-plan.md section 5.5 and Stage 2 item 6): compound-id literals
//! (`"H2O"`, `"C2H5OH"`, `"CO2(aq)"`, `"NH4+"`, ...) are data. They belong in species records (`engine/src/db/seed*`), not in
//! engine logic, where each one is a special case that a general model should have produced.
//!
//! This test is a ratchet. `literal_baseline.txt` records, per source file, how many such literals the code still holds
//! outside comments and `#[cfg(test)]` modules; a file may never gain one, and a file that is not listed may hold none.
//! Every stage removes the literals of the code it touches and lowers the baseline (`UPDATE_LITERAL_BASELINE=1 cargo test
//! --test literal_ban` rewrites it from the current tree; review the diff before committing: it must only go down).
//!
//! The ids that count are every species id and formula of the seed store plus every species of the default equilibria,
//! minerals and kinetic reactions (so a newly seeded compound is covered automatically). One- and two-letter element
//! symbols are not compound ids.

use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};

use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::db::SpeciesStore;

/// Files that *are* data tables (the seeds): exempt.
const EXEMPT: &[&str] = &["db/seed.rs", "db/seed_vle.rs"];

fn known_ids() -> HashSet<String> {
    let mut ids: HashSet<String> = HashSet::new();
    let store = SpeciesStore::default();
    for r in store.iter() {
        ids.insert(r.id.clone());
        ids.insert(r.identity.formula.clone());
    }
    for e in chem_db::get_default_equilibria() {
        ids.extend(e.reactants.keys().cloned());
        ids.extend(e.products.keys().cloned());
    }
    for m in chem_db::get_default_minerals() {
        ids.insert(m.solid_species.clone());
        ids.extend(m.dissolved_products.keys().cloned());
    }
    for k in chem_db::get_default_kinetic_reactions() {
        ids.extend(k.reactants.keys().cloned());
        ids.extend(k.products.keys().cloned());
        ids.extend(k.gas_products.keys().cloned());
    }
    ids.retain(|s| {
        let letters_only = s.chars().all(|c| c.is_ascii_alphabetic());
        !(letters_only && s.len() <= 2) && !s.starts_with("ik:")
    });
    ids
}

/// String literals of the non-comment, non-test part of a source file.
fn string_literals(src: &str) -> Vec<String> {
    let body = match src.find("#[cfg(test)]") {
        Some(i) => &src[..i],
        None => src,
    };
    let mut out = Vec::new();
    for line in body.lines() {
        let t = line.trim_start();
        if t.starts_with("//") {
            continue;
        }
        let chars: Vec<char> = line.chars().collect();
        let mut i = 0;
        while i < chars.len() {
            match chars[i] {
                '/' if chars.get(i + 1) == Some(&'/') => break,
                '"' => {
                    let mut j = i + 1;
                    let mut s = String::new();
                    while j < chars.len() && chars[j] != '"' {
                        if chars[j] == '\\' {
                            j += 1;
                        }
                        if j < chars.len() {
                            s.push(chars[j]);
                        }
                        j += 1;
                    }
                    out.push(s);
                    i = j + 1;
                }
                '\'' => {
                    // char literal or lifetime: skip a quoted char
                    if chars.get(i + 2) == Some(&'\'') {
                        i += 3;
                    } else {
                        i += 1;
                    }
                }
                _ => i += 1,
            }
        }
    }
    out
}

fn rs_files(dir: &Path, out: &mut Vec<PathBuf>) {
    for e in std::fs::read_dir(dir).unwrap() {
        let p = e.unwrap().path();
        if p.is_dir() {
            rs_files(&p, out);
        } else if p.extension().map_or(false, |x| x == "rs") {
            out.push(p);
        }
    }
}

fn count_by_file() -> BTreeMap<String, usize> {
    let ids = known_ids();
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut files = Vec::new();
    rs_files(&root, &mut files);
    let mut counts = BTreeMap::new();
    for f in files {
        let rel = f.strip_prefix(&root).unwrap().to_string_lossy().replace('\\', "/");
        if EXEMPT.contains(&rel.as_str()) {
            continue;
        }
        let src = std::fs::read_to_string(&f).unwrap();
        let n = string_literals(&src).iter().filter(|s| ids.contains(s.as_str())).count();
        if n > 0 {
            counts.insert(rel, n);
        }
    }
    counts
}

fn baseline_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests").join("literal_baseline.txt")
}

fn read_baseline() -> BTreeMap<String, usize> {
    let mut m = BTreeMap::new();
    if let Ok(s) = std::fs::read_to_string(baseline_path()) {
        for line in s.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let mut it = line.split_whitespace();
            if let (Some(f), Some(n)) = (it.next(), it.next()) {
                m.insert(f.to_string(), n.parse().unwrap());
            }
        }
    }
    m
}

#[test]
fn no_file_gains_compound_literals_and_the_stage4_files_are_clean() {
    let now = count_by_file();
    if std::env::var("UPDATE_LITERAL_BASELINE").is_ok() {
        let mut s = String::from("# compound-id literals per source file outside comments and test modules (a ratchet: only goes down)\n");
        for (f, n) in &now {
            s.push_str(&format!("{} {}\n", f, n));
        }
        std::fs::write(baseline_path(), s).unwrap();
        return;
    }
    let base = read_baseline();
    let mut problems = Vec::new();
    for (f, n) in &now {
        let allowed = base.get(f).copied().unwrap_or(0);
        if *n > allowed {
            problems.push(format!("{}: {} compound-id literals, baseline {}", f, n, allowed));
        }
    }
    assert!(problems.is_empty(), "new compound literals in logic (put the data in a species record instead):\n{}", problems.join("\n"));
    // the Stage 4 modules hold none: their volatile components, gases and critical constants all come from records
    // (groups.rs names the UNIFAC water group, which is a group name, not a compound id)
    for clean in ["vle.rs", "eos.rs", "gas_phase.rs", "vessel_vle.rs", "gas.rs"] {
        assert!(!now.contains_key(clean), "{} must stay free of compound literals", clean);
    }
}

#[test]
fn the_baseline_only_lists_files_that_still_hold_literals() {
    // a stale entry (a file that was cleaned) must be removed so the ratchet really moves down
    let now = count_by_file();
    let base = read_baseline();
    let stale: Vec<&String> = base.keys().filter(|f| now.get(*f).copied().unwrap_or(0) == 0 && !EXEMPT.contains(&f.as_str())).collect();
    assert!(stale.is_empty(), "baseline lists clean files (lower it): {:?}", stale);
}
