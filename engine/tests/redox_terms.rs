//! A measured multi-term electron-transfer law (Section 3.3 of docs/plans/rates-from-data-plan.md) as the vessel evaluates it:
//! `-d[H2O2]/dt = (k_0 + k_1 [H+]) [I-] [H2O2]` reproduces each term alone and their sum. This binary owns the rate table of the
//! pair I- / H2O2, so no other test can register a law for it in parallel.

use reaction_chamber_engine::rate_data::{self, RateLawTerm, RedoxRate};
use reaction_chamber_engine::vessel::*;
use std::collections::HashMap;

fn law(terms: Vec<RateLawTerm>) -> RedoxRate {
    RedoxRate {
        donor: "I-".into(),
        // a law measured as the loss of the reactants: it governs every pathway of the pair, whatever the products (H2O2 gives
        // H2O in acid and OH- near neutral)
        donor_product: String::new(),
        acceptor: "H2O2".into(),
        acceptor_product: String::new(),
        rate_of: "H2O2".into(),
        k_m_s: 0.0,
        t_k: 298.15,
        ea_kj_mol: None,
        h_order: 0.0,
        terms,
        source: "test law".into(),
        verification: Some("verified".into()),
    }
}

fn neutral(k: f64) -> RateLawTerm {
    RateLawTerm { k, t_k: 298.15, ea_kj_mol: None, orders: HashMap::new() }
}

fn acid(k: f64) -> RateLawTerm {
    RateLawTerm { k, t_k: 298.15, ea_kj_mol: None, orders: [("H+".to_string(), 1.0)].into_iter().collect() }
}

/// Moles of H2O2 lost in 0.5 s from a vessel of 50 mL water + 10 mL of `acid_id` with 0.01 mol I- and 0.001 mol H2O2.
fn h2o2_lost(acid_id: &str) -> f64 {
    let mut v = Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: 250.0,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(298.15),
        room_k: Some(298.15),
        sealed: Some(false),
        stopper_pop_atm: Some(1.0e4),
        burst_atm: Some(1.0e4),
    });
    for (id, ml) in [("water", 50.0), (acid_id, 10.0)] {
        v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(ml), mass_g: None, drops: None, temperature_k: None, solid_form: None }).unwrap();
    }
    v.species_mol.insert("I-".to_string(), 0.01);
    v.species_mol.insert("K+".to_string(), 0.01);
    v.species_mol.insert("H2O2".to_string(), 0.001);
    let before = v.species_mol["H2O2"];
    v.step(0.5).unwrap();
    before - v.species_mol.get("H2O2").copied().unwrap_or(0.0)
}

#[test]
fn a_two_term_redox_law_is_the_sum_of_its_terms_in_the_vessel() {
    let (k0, k1) = (0.02, 0.2); // M-1 s-1 and M-2 s-1: small enough that 0.5 s removes a fraction of a percent
    // the same vessel with an acid dose of water: the acid term vanishes, only the neutral term acts
    let run = |terms: Vec<RateLawTerm>, acid_id: &str| {
        rate_data::register_redox(vec![law(terms)]);
        h2o2_lost(acid_id)
    };
    // water as the "acid" dose: [H+] stays at 1e-7, the acid term is negligible
    let neutral_only = run(vec![neutral(k0)], "water");
    let neutral_in_acid = run(vec![neutral(k0)], "hcl_1m");
    let acid_only_in_acid = run(vec![acid(k1)], "hcl_1m");
    let both_in_acid = run(vec![neutral(k0), acid(k1)], "hcl_1m");
    let both_neutral = run(vec![neutral(k0), acid(k1)], "water");
    println!("lost H2O2 / mol: neutral term alone {neutral_only:.3e} (water), {neutral_in_acid:.3e} (acid); acid term alone {acid_only_in_acid:.3e}; both {both_in_acid:.3e} (acid), {both_neutral:.3e} (water)");
    assert!(neutral_only > 1e-9, "the law acts at all: {neutral_only:e}");
    // each term alone, and the sum (the vessel adds the rates of the terms)
    assert!((both_in_acid / (neutral_in_acid + acid_only_in_acid) - 1.0).abs() < 0.05, "sum of terms: {both_in_acid:e} vs {:e}", neutral_in_acid + acid_only_in_acid);
    // the acid term needs acid: in plain water the two-term law reduces to its neutral term
    assert!((both_neutral / neutral_only - 1.0).abs() < 0.05, "no acid, no acid term: {both_neutral:e} vs {neutral_only:e}");
    assert!(acid_only_in_acid > neutral_in_acid, "the acid term dominates at [H+] ~ 0.17 M (k1 [H+] = 0.034 vs k0 = 0.02): {acid_only_in_acid:e} vs {neutral_in_acid:e}");
}
