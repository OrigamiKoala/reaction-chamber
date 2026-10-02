//! Functional-class pKa estimates for acids the engine has no equilibrium data for (Stage 0 stopgap).
//!
//! Before this module an imported acid whose parent had no hand-listed equilibrium was assumed to be *strong*
//! (0.1 M citric acid read pH 0.5). Now an acid is strong only when a tabulated pKa < 0 says so (`STRONG_ACIDS`);
//! everything else becomes a weak-acid ladder whose pKa values are *estimated* from the formula and labelled
//! `ProvenanceTier::Estimated`. Real pKa data (IUPAC / Uni-pKa / predicted from structure) replaces these in Stage 1/9.
//!
//! Classes (from the formula of the fully protonated acid, `k` acidic hydrogens):
//! - **carboxylic**: carbon present and O >= 2k: every acidic H sits on a carboxyl group, intrinsic pKa 4.5
//!   (acetic 4.76, propanoic 4.87, benzoic 4.20). Oxygen beyond the carboxyl oxygens is assumed to be an OH / ether /
//!   oxo substituent that acidifies one group by 0.9 (acetic 4.76 -> glycolic 3.83). The `k` groups are independent
//!   sites, so the macroscopic constants follow from the elementary symmetric polynomials of the site constants
//!   (identical sites give the statistical factors (k-j+1)/j), plus an electrostatic term of 0.5 pK per charge already
//!   on the anion.
//! - **oxoacid** (O >= k, not carboxylic): Pauling's rules, pKa1 = 8 - 5 n with n the number of non-hydroxyl oxygens
//!   and each further step 5 units weaker (H3PO4 est. 3 / 8 / 13 vs 2.15 / 7.2 / 12.35; HNO2 3 vs 3.3; HOCl 8 vs 7.5).
//! - **other** (binary acids, no oxygen): generic 7.0, flagged in the description.

use std::collections::HashMap;

use crate::chem_db::GeneralEquilibrium;
use crate::ions;
use crate::types::ProvenanceTier;

/// Intrinsic pKa of a carboxylic acid group (class default).
pub const CARBOXYLIC_PKA: f64 = 4.5;
/// pKa lowering of a carboxyl group that carries an electronegative substituent (OH, oxo, ether) on a nearby carbon.
pub const SUBSTITUENT_SHIFT: f64 = 0.9;
/// Electrostatic pKa increase per negative charge already on the conjugate base.
pub const ELECTROSTATIC_STEP: f64 = 0.5;
/// Generic weak-acid pKa for acids with no better class.
pub const GENERIC_PKA: f64 = 7.0;

/// Acids with tabulated pKa < 0 (fully dissociated at bench concentrations): (formula, pKa, source).
pub const STRONG_ACIDS: &[(&str, f64, &str)] = &[
    ("HCl", -6.3, "CRC Handbook of Chemistry and Physics (aqueous pKa)"),
    ("HBr", -9.0, "CRC Handbook of Chemistry and Physics (aqueous pKa)"),
    ("HI", -10.0, "CRC Handbook of Chemistry and Physics (aqueous pKa)"),
    ("HNO3", -1.4, "CRC Handbook of Chemistry and Physics (aqueous pKa)"),
    ("HClO4", -10.0, "CRC Handbook of Chemistry and Physics (aqueous pKa)"),
    ("HClO3", -1.0, "CRC Handbook of Chemistry and Physics (aqueous pKa)"),
    ("HBrO3", -2.0, "Bordwell / CRC (aqueous pKa)"),
    ("HMnO4", -2.25, "CRC Handbook of Chemistry and Physics (aqueous pKa)"),
    ("HSCN", -1.3, "CRC Handbook of Chemistry and Physics (aqueous pKa)"),
];

/// Tabulated pKa (< 0) of a strong acid given its element counts, if it is one.
pub fn strong_acid(acid_elems: &HashMap<String, f64>) -> Option<(f64, &'static str)> {
    let key = ions::element_key(acid_elems);
    STRONG_ACIDS
        .iter()
        .find(|(f, _, _)| ions::formula_key(f).as_deref() == Some(key.as_str()))
        .map(|(_, p, s)| (*p, *s))
}

/// An estimated stepwise pKa ladder and the class that produced it.
#[derive(Clone, Debug)]
pub struct Ladder {
    /// pKa of step 1..k (HnA -> H(n-1)A-, ...).
    pub pka: Vec<f64>,
    pub class: &'static str,
}

/// Macroscopic stepwise pKa values from independent site constants (Ka_i) of `k` acidic sites.
fn stepwise_from_sites(sites_ka: &[f64]) -> Vec<f64> {
    let k = sites_ka.len();
    // elementary symmetric polynomials e_0..e_k of the site constants
    let mut e = vec![0.0; k + 1];
    e[0] = 1.0;
    for &ka in sites_ka {
        for j in (1..=k).rev() {
            e[j] += e[j - 1] * ka;
        }
    }
    (1..=k).map(|j| -(e[j] / e[j - 1]).log10()).collect()
}

/// Estimates the pKa ladder of the acid with element counts `acid_elems` and `k` acidic hydrogens.
pub fn estimate_ladder(acid_elems: &HashMap<String, f64>, k: usize) -> Ladder {
    let c = acid_elems.get("C").copied().unwrap_or(0.0);
    let o = acid_elems.get("O").copied().unwrap_or(0.0);
    let kf = k as f64;
    if c >= 1.0 && o >= 2.0 * kf {
        let extra_o = (o - 2.0 * kf).round().max(0.0) as usize;
        let activated = extra_o.min(k);
        let mut sites: Vec<f64> = Vec::new();
        for i in 0..k {
            let pka = if i < activated { CARBOXYLIC_PKA - SUBSTITUENT_SHIFT } else { CARBOXYLIC_PKA };
            sites.push(10f64.powf(-pka));
        }
        let mut pka = stepwise_from_sites(&sites);
        for (j, p) in pka.iter_mut().enumerate() {
            *p += ELECTROSTATIC_STEP * j as f64;
        }
        return Ladder { pka, class: "carboxylic acid (4.5; statistical + electrostatic ladder)" };
    }
    if o >= kf {
        let n_nonoh = o - kf;
        let pka1 = 8.0 - 5.0 * n_nonoh;
        return Ladder { pka: (0..k).map(|j| pka1 + 5.0 * j as f64).collect(), class: "oxoacid (Pauling's rules)" };
    }
    Ladder { pka: vec![GENERIC_PKA; k], class: "generic weak acid (no class rule applies)" }
}

/// One estimated dissociation step as an equilibrium record (Estimated tier, ΔH unknown = 0).
pub fn step_equilibrium(parent: &str, base: &str, step: usize, pka: f64, class: &str) -> GeneralEquilibrium {
    GeneralEquilibrium {
        id: format!("est_acid_{}_{}", parent, step),
        name: format!("Estimated acid dissociation {} (step {})", parent, step),
        equation: format!("{} <=> H+ + {}", parent, base),
        reactants: [(parent.to_string(), 1.0)].into(),
        products: [("H+".to_string(), 1.0), (base.to_string(), 1.0)].into(),
        log_k_298: -pka,
        delta_h_kj: 0.0,
        log_k_analytic: None,
        tier: ProvenanceTier::Estimated,
        source: format!("Estimated pKa {:.2}: {}", pka, class),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn elems(f: &str) -> HashMap<String, f64> {
        ions::parse_formula_strict(f).unwrap()
    }

    #[test]
    fn citric_ladder_is_carboxylic_with_one_activated_site() {
        let l = estimate_ladder(&elems("C6H8O7"), 3);
        assert!(l.class.starts_with("carboxylic"));
        assert!(l.pka[0] > 3.0 && l.pka[0] < 3.6, "{:?}", l.pka);
        assert!(l.pka[0] < l.pka[1] && l.pka[1] < l.pka[2]);
    }

    #[test]
    fn pauling_oxoacids() {
        let h3po4 = estimate_ladder(&elems("H3PO4"), 3);
        assert_eq!(h3po4.pka, vec![3.0, 8.0, 13.0]);
        let hno2 = estimate_ladder(&elems("HNO2"), 1);
        assert_eq!(hno2.pka, vec![3.0]);
    }

    #[test]
    fn strong_acid_table_is_keyed_by_elements() {
        assert!(strong_acid(&elems("HCl")).is_some());
        assert!(strong_acid(&elems("ClH")).is_some());
        assert!(strong_acid(&elems("C6H8O7")).is_none());
    }
}
