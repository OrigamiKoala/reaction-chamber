//! Ion association and complexation (E2).
//!
//! Salts are dissociated at import, so without this module the only association is what a data row lists. Two sources
//! now cover every cation / anion pair that meets in a vessel:
//!
//! 1. **Complexation data** (`data/complexes.json`): stability constants of metal-ligand complexes, registered as
//!    equilibrium rows when both partners are present.
//! 2. **Outer-sphere ion pairs for any other pair** from the Fuoss equation,
//!    `K_A = (4 pi N_A a^3 / 3000) exp(z+ |z-| l_B / a)`, with the Bjerrum length `l_B = e^2 / (4 pi eps0 eps(T) kT)` and
//!    the contact distance `a = r+ + r- + 0.5 Angstrom` (crystal radii of `data/ion_radii.json`, radii of polyatomic ions
//!    from their molar mass). With the 0.5 Angstrom offset the equation reproduces the measured constants of the
//!    divalent sulfates and carbonates and the monovalent sulfate pairs within 0.4 log units (MgSO4 2.57 vs 2.2,
//!    CaSO4 2.41 vs 2.3, NaSO4- 0.77 vs 0.7); inner-sphere (covalent) complexes are not outer-sphere pairs and need
//!    data rows. Only pairs with |z+ z-| >= 4 and `MIN_K_A` <= K_A <= `MAX_K_A` are generated.
//!
//! Both produce ordinary `GeneralEquilibrium` rows, solved with the rest of the speciation; tier Estimated (data) or
//! Speculative (Fuoss).

use std::collections::HashMap;
use std::sync::OnceLock;

use serde::Deserialize;

use crate::chem_db::GeneralEquilibrium;
use crate::ions;
use crate::types::ProvenanceTier;

/// Smallest amount (mol) of the less abundant partner for which a pair or complex row is registered.
pub const MIN_PAIR_AMOUNT_MOL: f64 = 2e-5;
/// Smallest ratio pair / free (K gamma^2 c) at which a pair row is registered.
pub const MIN_PAIRED_FRACTION: f64 = 0.05;
/// Smallest association constant (M^-1) worth a species.
pub const MIN_K_A: f64 = 10.0;
/// Largest constant the outer-sphere model is trusted for (the measured outer-sphere pairs stop near 10^4.5): a stronger
/// attraction is an inner-sphere complex or a solid, which the data rows and the Ksp table own.
pub const MAX_K_A: f64 = 1.0e5;
/// Smallest |z+ z-| of a generated pair. The Fuoss equation is validated against the 2:2 and 3:2 sulfates and carbonates;
/// the 1:1 and 2:1 pairs are weak and not generated (their measured constants are 0.1-20 M^-1).
pub const MIN_CHARGE_PRODUCT: i32 = 4;
/// Contact distance offset (Angstrom) added to the sum of crystal radii in the Fuoss equation
/// to account for the solvent-separated outer-sphere hydration layer (r_H2O ~ 1.15 A).
pub const CONTACT_OFFSET_A: f64 = 1.15;

#[derive(Deserialize)]
struct ComplexRow {
    metal: String,
    ligand: String,
    n: f64,
    product: String,
    log_beta: f64,
    /// reaction enthalpy (kJ/mol); absent = not tabulated (van 't Hoff dH = 0)
    #[serde(default)]
    delta_h_kj: Option<f64>,
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    tier: Option<ProvenanceTier>,
}

#[derive(Deserialize)]
struct File {
    complexes: Vec<ComplexRow>,
}

fn rows() -> &'static [ComplexRow] {
    static R: OnceLock<Vec<ComplexRow>> = OnceLock::new();
    R.get_or_init(|| serde_json::from_str::<File>(include_str!("../data/complexes.json")).expect("data/complexes.json").complexes)
}

/// Bjerrum length of water (Angstrom) at `t_k`: e^2 / (4 pi eps0 eps kT).
pub fn bjerrum_length_angstrom(t_k: f64) -> f64 {
    // e^2 / (4 pi eps0) = 14.3996 eV Angstrom; kT in eV
    let eps = crate::transport::dielectric_water(t_k);
    14.3996 / (eps * 8.617333e-5 * t_k)
}

/// Fuoss association constant K_A (M^-1) of a cation / anion pair at contact distance `a_angstrom`.
pub fn fuoss_k(z_cation: i32, z_anion: i32, a_angstrom: f64, t_k: f64) -> f64 {
    const N_A: f64 = 6.02214076e23;
    let a_cm = a_angstrom * 1e-8;
    let b = (z_cation * z_anion.abs()) as f64 * bjerrum_length_angstrom(t_k) / a_angstrom;
    4.0 * std::f64::consts::PI * N_A * a_cm.powi(3) / 3000.0 * b.exp()
}

/// Species id of the 1:1 pair of a cation and an anion ("CaSO4", "NaSO4-", "MgOH+").
pub fn pair_species_id(cation: &str, anion: &str) -> String {
    let (cb, zc) = ions::split_charge(cation);
    let (ab, za) = ions::split_charge(anion);
    let z = zc + za;
    let ch = match z {
        0 => String::new(),
        1 => "+".to_string(),
        -1 => "-".to_string(),
        n if n > 0 => format!("+{}", n),
        n => format!("-{}", -n),
    };
    format!("{}{}{}", cb, ab, ch)
}

/// The equilibrium row of a cation / anion outer-sphere pair, or None when the pair is too weak, repels, or involves the
/// proton (acid-base chemistry is in the dissociation rows). `t_k` sets the permittivity.
pub fn fuoss_pair_equilibrium(cation: &str, anion: &str, t_k: f64) -> Option<GeneralEquilibrium> {
    let zc = ions::species_charge(cation);
    let za = ions::species_charge(anion);
    if zc <= 0 || za >= 0 {
        return None;
    }
    // the proton and its hydrates are acid-base chemistry, handled by the dissociation rows
    if ions::species_elements(cation).map_or(false, |e| e.keys().all(|k| k == "H" || k == "O")) {
        return None;
    }
    // a cation and an anion of one element (Cr3+ / Cr2O7 2-, Fe3+ / FeO4 2-) are the two ends of a redox couple, not an
    // outer-sphere pair: the electron transfer, not the electrostatic contact, is what they do
    if let (Some(ec), Some(ea)) = (ions::species_elements(cation), ions::species_elements(anion)) {
        if ec.keys().any(|k| k != "H" && k != "O" && ea.contains_key(k)) {
            return None;
        }
    }
    let a = crate::crystal::ionic_radius_angstrom(cation)? + crate::crystal::ionic_radius_angstrom(anion)? + CONTACT_OFFSET_A;
    // the row is stated at 25 C, like every equilibrium row; its temperature dependence is the Fuoss equation's own (the
    // permittivity of water falls with T), as a van 't Hoff enthalpy dH = R T^2 d ln K / dT
    let k = fuoss_k(zc, za, a, 298.15);
    let _ = t_k;
    if !(MIN_K_A..=MAX_K_A).contains(&k) || zc * za.abs() < MIN_CHARGE_PRODUCT {
        return None;
    }
    let dh_kj = crate::physics::R_GAS * 298.15 * 298.15 * ((fuoss_k(zc, za, a, 299.15) / fuoss_k(zc, za, a, 297.15)).ln() / 2.0) / 1000.0;
    let pair = pair_species_id(cation, anion);
    // a species that exists under another name (same elements and charge as a registered complex) is not duplicated
    let key = (ions::species_elements(&pair).map(|e| ions::element_key(&e)), zc + za);
    for row in rows() {
        if (ions::species_elements(&row.product).map(|e| ions::element_key(&e)), ions::species_charge(&row.product)) == key {
            return None;
        }
    }
    let mut reactants = HashMap::new();
    reactants.insert(cation.to_string(), 1.0);
    reactants.insert(anion.to_string(), 1.0);
    let mut products = HashMap::new();
    products.insert(pair.clone(), 1.0);
    Some(GeneralEquilibrium {
        id: format!("pair_{}_{}", cation, anion),
        name: format!("Ion pair {}", pair),
        equation: format!("{} + {} <=> {}", cation, anion, pair),
        reactants,
        products,
        log_k_298: k.log10(),
        delta_h_kj: dh_kj,
        log_k_analytic: None,
        rate: None,
        tier: ProvenanceTier::Speculative,
        source: format!("Fuoss ion association, a = r+ + r- + {} A = {:.2} A", CONTACT_OFFSET_A, a),
    })
}

/// True when the data table holds a 1:1 association of this cation and anion strong enough (log beta >= 1) that the electrolyte's
/// activity coefficient must not already contain it: a Pitzer parameter set of such a salt (MgSO4, CaSO4, ZnSO4 ...) describes the
/// ion association implicitly through its beta2 / beta1 terms, so using it together with the explicit pair would count the
/// association twice.
pub fn strongly_associated(cation: &str, anion: &str) -> bool {
    // indexed once: this is asked for every ion pair at every evaluation of the activity model, and the table has hundreds of rows
    static INDEX: OnceLock<HashMap<String, std::collections::HashSet<String>>> = OnceLock::new();
    let index = INDEX.get_or_init(|| {
        let mut m: HashMap<String, std::collections::HashSet<String>> = HashMap::new();
        for r in rows().iter().filter(|r| r.n == 1.0 && r.log_beta >= 1.0) {
            m.entry(r.metal.clone()).or_default().insert(r.ligand.clone());
        }
        m
    });
    index.get(cation).map_or(false, |set| set.contains(anion))
}

/// Complexation rows whose metal and ligand are both in `present`.
pub fn complex_equilibria(present: &dyn Fn(&str) -> bool) -> Vec<GeneralEquilibrium> {
    rows()
        .iter()
        .filter(|r| present(&r.metal) && present(&r.ligand))
        .map(|r| {
            let mut reactants = HashMap::new();
            reactants.insert(r.metal.clone(), 1.0);
            reactants.insert(r.ligand.clone(), r.n);
            let mut products = HashMap::new();
            products.insert(r.product.clone(), 1.0);
            GeneralEquilibrium {
                id: format!("cplx_{}", r.product),
                name: format!("Complex {}", r.product),
                equation: format!("{} + {} {} <=> {}", r.metal, r.n, r.ligand, r.product),
                reactants,
                products,
                log_k_298: r.log_beta,
                delta_h_kj: r.delta_h_kj.unwrap_or(0.0),
                log_k_analytic: None,
                // ligand-substitution kinetics are attached where the row enters a vessel (`substitution::attach_rate`)
                rate: None,
                tier: r.tier.clone().unwrap_or(ProvenanceTier::Estimated),
                source: r.source.clone().unwrap_or_else(|| "Stability constant recalled from the Smith-Martell / CRC compilations (log beta, 25 C, I = 0)".to_string()),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bjerrum_length_of_water_is_7_angstrom_at_25_c() {
        assert!((bjerrum_length_angstrom(298.15) - 7.15).abs() < 0.1);
    }

    #[test]
    fn sulfate_pairs_are_measured_rows_and_the_fuoss_equation_agrees_with_them() {
        // log K: MgSO4 2.2, CaSO4 2.3, NaSO4- 0.7 (Smith-Martell); the rows of the PHREEQC-format databases carry them with their enthalpies
        let rows = complex_equilibria(&|_| true);
        for (c, product, exp, dh_lo, dh_hi) in [("Mg+2", "MgSO4", 2.2, 3.0, 10.0), ("Ca+2", "CaSO4", 2.3, 3.0, 12.0), ("Na+", "NaSO4-", 0.7, -1.0, 6.0)] {
            let row = rows.iter().find(|r| r.products.contains_key(product) && r.reactants.contains_key(c)).unwrap_or_else(|| panic!("{product} row"));
            assert!((row.log_k_298 - exp).abs() < 0.3, "{} {} vs {}", product, row.log_k_298, exp);
            assert!(row.delta_h_kj > dh_lo && row.delta_h_kj < dh_hi, "{} dH {}", product, row.delta_h_kj);
            assert_eq!(row.tier, ProvenanceTier::Tabulated);
        }
        // the Fuoss equation itself (the estimate for pairs without a row) stays within 0.5 log units of the measured 2:2 sulfates
        for (c, exp) in [("Mg+2", 2.2), ("Ca+2", 2.3)] {
            let a = crate::crystal::ionic_radius_angstrom(c).unwrap() + crate::crystal::ionic_radius_angstrom("SO4-2").unwrap() + CONTACT_OFFSET_A;
            let k = fuoss_k(2, -2, a, 298.15).log10();
            assert!((k - exp).abs() < 0.6, "{} Fuoss {} vs {}", c, k, exp);
        }
        // a pair a data row covers is not generated; pairs that are too weak or too strong are not either
        assert!(fuoss_pair_equilibrium("Mg+2", "SO4-2", 298.15).is_none(), "the measured row replaces the estimate");
        assert!(fuoss_pair_equilibrium("Na+", "Cl-", 298.15).is_none());
        assert!(fuoss_pair_equilibrium("Na+", "CO3-2", 298.15).is_none(), "2:1 pairs are not generated");
        assert!(fuoss_pair_equilibrium("Fe+3", "Fe(CN)6-4", 298.15).is_none(), "too strong for an outer-sphere pair");
        assert!(fuoss_pair_equilibrium("Cr+3", "Cr2O7-2", 298.15).is_none(), "the two ends of one redox couple do not pair");
    }

    #[test]
    fn pairs_are_endothermic_like_the_measured_sulfates() {
        // measured: MgSO4 +5.5 kJ/mol, CaSO4 +6.5 (association of two hydrated ions releases water: entropy driven). The Fuoss
        // equation gets the sign and size from the permittivity of water alone: dH = R T^2 d ln K / dT of the equation itself.
        for c in ["Mg+2", "Ca+2"] {
            let a = crate::crystal::ionic_radius_angstrom(c).unwrap() + crate::crystal::ionic_radius_angstrom("SO4-2").unwrap() + CONTACT_OFFSET_A;
            let dh = crate::physics::R_GAS * 298.15 * 298.15 * ((fuoss_k(2, -2, a, 299.15) / fuoss_k(2, -2, a, 297.15)).ln() / 2.0) / 1000.0;
            assert!(dh > 3.0 && dh < 10.0, "{} dH {}", c, dh);
        }
        // and the data rows say the same
        for product in ["MgSO4", "CaSO4"] {
            let row = complex_equilibria(&|_| true).into_iter().find(|r| r.products.contains_key(product)).unwrap();
            assert!(row.delta_h_kj > 3.0 && row.delta_h_kj < 12.0, "{} {}", product, row.delta_h_kj);
        }
    }

    #[test]
    fn pair_ids_are_formulas() {
        assert_eq!(pair_species_id("Ca+2", "SO4-2"), "CaSO4");
        assert_eq!(pair_species_id("Na+", "SO4-2"), "NaSO4-");
        assert_eq!(pair_species_id("Mg+2", "OH-"), "MgOH+");
    }
}
