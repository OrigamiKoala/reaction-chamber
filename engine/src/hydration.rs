//! Hydration free energy of a neutral organic solute from its structure (T4): the standard Gibbs energy of transferring the
//! molecule from the ideal gas to the dilute aqueous solution (Ben-Naim standard states: 1 mol/L in both phases, 298.15 K),
//! as a sum of atom-environment contributions in the style of Cabani et al. (1981).
//!
//! `mu0(aq) = mu0(gas, 1 bar) + RT ln(R T c0 / P0) + dG_hyd`, so a species that has a gas-phase or liquid-phase formation
//! record and a structure gets an aqueous standard state (and with it a Henry constant, an infinite-dilution activity
//! coefficient in water and the pKa cycle of T5) where the engine used to substitute the pure liquid.
//!
//! The group contributions are `data/hydration_groups.json`, fitted (ridge-regularised least squares) to experimental
//! hydration free energies of about 90 compounds by the ignored test `fit_hydration_groups` in `tests/open_items_b.rs`; the
//! leave-one-out error is recorded in the file and gated by the same test file. A molecule with an atom or environment
//! that has no group (charged atoms, silicon, an aromatic heteroatom other than pyridine nitrogen, nitro groups, ...)
//! gets no estimate. Tier Estimated.

use std::collections::BTreeMap;
use std::sync::OnceLock;

use serde::Deserialize;

use crate::physics::R_GAS;
use crate::smiles::Molecule;

const T_REF: f64 = 298.15;

#[derive(Deserialize)]
struct File {
    groups: BTreeMap<String, f64>,
}

fn table() -> &'static File {
    static T: OnceLock<File> = OnceLock::new();
    T.get_or_init(|| serde_json::from_str(include_str!("../data/hydration_groups.json")).expect("data/hydration_groups.json"))
}

fn is_close(a: f64, b: f64) -> bool {
    (a - b).abs() < 1e-9
}

/// Counts of the hydration groups of a molecule (keys of the data file), or None when an atom is not covered.
pub fn group_counts(mol_in: &Molecule) -> Option<BTreeMap<String, f64>> {
    let mol = mol_in.aromatized();
    let n = mol.atoms.len();
    if n == 0 || mol.atoms.iter().any(|a| a.charge != 0) {
        return None;
    }
    let nbrs: Vec<Vec<(usize, f64)>> = (0..n).map(|i| mol.neighbours(i)).collect();
    let h: Vec<u32> = (0..n).map(|i| mol.hydrogens(i)).collect();
    let el = |i: usize| mol.atoms[i].element.as_str();
    let arom = |i: usize| mol.atoms[i].aromatic;
    let dbl_to = |i: usize, e: &str| nbrs[i].iter().any(|&(j, b)| is_close(b, 2.0) && el(j) == e);
    let trip_to = |i: usize, e: &str| nbrs[i].iter().any(|&(j, b)| is_close(b, 3.0) && el(j) == e);
    let is_carbonyl = |i: usize| el(i) == "C" && !arom(i) && dbl_to(i, "O");
    let mut counts: BTreeMap<String, f64> = BTreeMap::new();
    let mut add = |k: &str, v: f64| *counts.entry(k.to_string()).or_insert(0.0) += v;
    let hal = |e: &str| matches!(e, "F" | "Cl" | "Br" | "I");

    for i in 0..n {
        match el(i) {
            "C" => {
                if arom(i) {
                    add(if h[i] == 1 { "Car_H" } else { "Car_sub" }, 1.0);
                } else if is_carbonyl(i) {
                    let single_o: Vec<usize> = nbrs[i].iter().filter(|&&(j, b)| is_close(b, 1.0) && el(j) == "O").map(|&(j, _)| j).collect();
                    let has_n = nbrs[i].iter().any(|&(j, b)| is_close(b, 1.0) && el(j) == "N");
                    if let Some(&o) = single_o.first() {
                        add(if h[o] == 1 { "acid" } else { "ester" }, 1.0);
                    } else if has_n {
                        add("amide", 1.0);
                    } else if h[i] >= 1 {
                        add("aldehyde", 1.0);
                    } else {
                        add("ketone", 1.0);
                    }
                } else if trip_to(i, "N") {
                    add("nitrile", 1.0);
                } else if nbrs[i].iter().any(|&(_, b)| is_close(b, 3.0) || (is_close(b, 2.0) && !dbl_to(i, "C"))) {
                    return None;
                } else if dbl_to(i, "C") {
                    let key = match h[i] {
                        2 => "C_sp2_H2",
                        1 => "C_sp2_H1",
                        0 => "C_sp2_H0",
                        _ => return None,
                    };
                    add(key, 1.0);
                } else {
                    let key = match h[i] {
                        4 => "C_sp3_H4",
                        3 => "C_sp3_H3",
                        2 => "C_sp3_H2",
                        1 => "C_sp3_H1",
                        0 => "C_sp3_H0",
                        _ => return None,
                    };
                    add(key, 1.0);
                    let mut n_hal = 0;
                    for &(j, _) in &nbrs[i] {
                        match el(j) {
                            "O" => add("alpha_O", 1.0),
                            "N" => add("alpha_N", 1.0),
                            e if hal(e) => {
                                add("alpha_Hal", 1.0);
                                n_hal += 1;
                            }
                            _ => {}
                        }
                    }
                    if n_hal >= 2 {
                        add("gem_hal", 1.0);
                    }
                }
            }
            "O" => {
                if dbl_to(i, "C") && nbrs[i].len() == 1 {
                    continue; // carbonyl oxygen: part of its carbon's group
                }
                // the oxygens of an acid or ester are part of the carbonyl group
                if nbrs[i].iter().any(|&(j, _)| is_carbonyl(j)) {
                    continue;
                }
                if h[i] == 1 && nbrs[i].len() == 1 {
                    add(if arom(nbrs[i][0].0) { "O_ArOH" } else { "O_OH" }, 1.0);
                } else if h[i] == 0 && nbrs[i].len() == 2 {
                    add("O_ether", 1.0);
                } else {
                    return None;
                }
            }
            "N" => {
                if nbrs[i].iter().any(|&(j, _)| is_carbonyl(j)) || trip_to(i, "C") {
                    continue; // amide or nitrile nitrogen
                }
                if arom(i) {
                    if h[i] == 0 && nbrs[i].len() == 2 { add("Nar", 1.0); } else { return None; }
                } else if nbrs[i].iter().any(|&(j, _)| arom(j)) {
                    if h[i] == 2 { add("N_ArH2", 1.0); } else { return None; }
                } else if nbrs[i].iter().any(|&(_, b)| !is_close(b, 1.0)) {
                    return None;
                } else {
                    match h[i] {
                        2 => add("N_H2", 1.0),
                        1 => add("N_H1", 1.0),
                        0 => add("N_H0", 1.0),
                        _ => return None,
                    }
                }
            }
            e if hal(e) => add(match e { "F" => "X_F", "Cl" => "X_Cl", "Br" => "X_Br", _ => "X_I" }, 1.0),
            _ => return None,
        }
    }
    Some(counts)
}

/// Hydration free energy (kJ/mol, 1 M gas -> 1 M solution, 298.15 K), or None when a group has no parameter.
pub fn hydration_gibbs_kj(mol: &Molecule) -> Option<f64> {
    let counts = group_counts(mol)?;
    let t = table();
    let mut dg = 0.0;
    for (g, c) in &counts {
        dg += c * t.groups.get(g)?;
    }
    Some(dg)
}

/// ln of the ideal-gas conversion between the 1 bar gas standard state and the 1 mol/L one at `t_k`.
fn ln_gas_standard_shift(t_k: f64) -> f64 {
    // c0 R T / P0 with c0 = 1000 mol/m3, P0 = 1e5 Pa
    (1000.0 * R_GAS * t_k / 1e5).ln()
}

/// Aqueous formation Gibbs energy of a solute (kJ/mol, molal standard state) from its ideal-gas formation Gibbs energy.
pub fn aqueous_dgf_from_gas_kj(dgf_gas_kj: f64, hydration_kj: f64) -> f64 {
    dgf_gas_kj + R_GAS * T_REF * ln_gas_standard_shift(T_REF) / 1000.0 + hydration_kj
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::smiles::parse;

    #[test]
    fn groups_of_common_molecules() {
        let c = |s: &str| group_counts(&parse(s).unwrap()).unwrap();
        let e = c("CCO");
        assert_eq!(e.get("C_sp3_H3"), Some(&1.0));
        assert_eq!(e.get("C_sp3_H2"), Some(&1.0));
        assert_eq!(e.get("O_OH"), Some(&1.0));
        assert_eq!(e.get("alpha_O"), Some(&1.0));
        let ea = c("CC(=O)OCC");
        assert_eq!(ea.get("ester"), Some(&1.0));
        assert!(ea.get("O_ether").is_none(), "ester oxygens belong to the carbonyl group");
        assert_eq!(c("CC(=O)O").get("acid"), Some(&1.0));
        assert_eq!(c("c1ccccc1").get("Car_H"), Some(&6.0));
        assert_eq!(c("ClC(Cl)Cl").get("gem_hal"), Some(&1.0));
        assert!(group_counts(&parse("CC(=O)[O-]").unwrap()).is_none());
    }
}
