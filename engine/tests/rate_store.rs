//! Rate store (`rate_store.rs`): generated reactions carry a structural key and a stored rate replaces the template rule
//! in new and existing reactions.
//! The store is global to the test binary, so each test uses its own substrate.

use std::collections::HashMap;

use reaction_chamber_engine::network_generator::{GeneratedReaction, NetworkGenerator, NetworkGeneratorConfig};
use reaction_chamber_engine::rate_store::{self, RateEntry};
use reaction_chamber_engine::types::ProvenanceTier;
use reaction_chamber_engine::vessel::{Vessel, VesselConfig};

fn concs(substrate: &str) -> HashMap<String, f64> {
    let mut c = HashMap::new();
    c.insert(substrate.to_string(), 0.1);
    c.insert("OH-".to_string(), 0.1);
    c.insert("Na+".to_string(), 0.1);
    c.insert("H2O".to_string(), 55.5);
    c
}

fn sn2(substrate: &str) -> GeneratedReaction {
    let net = NetworkGenerator::new(NetworkGeneratorConfig::default()).generate_network(&concs(substrate), 298.15, 13.0);
    net.reactions.into_iter().find(|r| r.family_id == "sn2_substitution").expect("SN2 of the substrate")
}

#[test]
fn generated_reactions_carry_a_structural_key() {
    let substrate = reaction_chamber_engine::network_generator::register_or_find_species(
        &reaction_chamber_engine::smiles::parse("CCCCCCCBr").unwrap(),
    );
    let r = sn2(&substrate);
    assert!(r.rate_key.starts_with("sn2_substitution|"), "key {}", r.rate_key);
    assert!(!r.rate_from_store);
    assert!(r.template_a > 0.0 && r.template_ea_j_mol > 0.0);
    // the same reaction from another lookup of the substrate has the same key
    let again = sn2(&substrate);
    assert_eq!(again.rate_key, r.rate_key);
}

#[test]
fn a_stored_rate_replaces_the_template_rule() {
    let before = sn2("2-bromopropane");
    let entry = RateEntry {
        key: before.rate_key.clone(),
        a: before.template_a * 7.0,
        ea_j_mol: before.template_ea_j_mol + 2000.0,
        tier: ProvenanceTier::Estimated,
        source: "test entry".to_string(),
        per_reaction: false,
        k_ref: None,
        t_ref_k: None,
        terms: Vec::new(),
    };
    assert_eq!(rate_store::register(vec![entry.clone()]), 1);
    assert_eq!(rate_store::register(vec![entry.clone()]), 0, "an unchanged entry is not a change");
    let after = sn2("2-bromopropane");
    assert!(after.rate_from_store);
    assert!((after.arrhenius_a - entry.a * after.pathways as f64).abs() < 1e-6 * after.arrhenius_a);
    assert_eq!(after.arrhenius_ea, entry.ea_j_mol);
    assert!(after.source.starts_with("test entry"), "{}", after.source);
    assert_eq!(after.template_a, before.template_a, "the rule's own estimate is kept for display");
}

#[test]
fn a_vessel_takes_a_stored_rate_when_it_arrives() {
    let mut v = Vessel::new(VesselConfig {
        vessel_type: "test-flask".into(),
        capacity_ml: 250.0,
        glass_mass_g: 100.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(298.15),
        room_k: Some(298.15),
        sealed: Some(false),
        stopper_pop_atm: Some(2.0),
        burst_atm: Some(6.0),
    });
    // 1-iodohexane is an unmeasured substrate
    for (sp, mol) in [("H2O", 5.55), ("OH-", 0.01), ("Na+", 0.01)] {
        v.species_mol.insert(sp.to_string(), mol);
    }
    let substrate = reaction_chamber_engine::network_generator::register_or_find_species(
        &reaction_chamber_engine::smiles::parse("CCCCCCI").unwrap(),
    );
    v.species_mol.insert(substrate.clone(), 0.01);
    v.update_network();
    let row = v
        .kinetic_reactions
        .iter()
        .find(|r| r.id.starts_with("sn2_substitution") && r.reactants.contains_key(&substrate))
        .expect("the vessel generated the SN2 of 1-iodohexane")
        .clone();
    let rule = sn2(&substrate);
    assert!(!rule.rate_from_store && rule.template_a > 0.0);
    rate_store::register(vec![RateEntry {
        key: rule.rate_key.clone(),
        a: rule.template_a * 3.0,
        ea_j_mol: rule.template_ea_j_mol,
        tier: ProvenanceTier::Estimated,
        source: "computed".to_string(),
        per_reaction: false,
        k_ref: None,
        t_ref_k: None,
        terms: Vec::new(),
    }]);
    v.apply_stored_rates();
    let updated = v.kinetic_reactions.iter().find(|r| r.id == row.id).unwrap();
    assert!((updated.arrhenius_a / row.arrhenius_a - 3.0).abs() < 1e-9, "{} vs {}", updated.arrhenius_a, row.arrhenius_a);
    assert!(updated.source.starts_with("computed"));
}
