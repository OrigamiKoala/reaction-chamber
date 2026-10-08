//! A carbonyl-stabilised ylide olefinates an aldehyde once. Its own acetyl C=O is not an electrophile (it is part of the delocalised
//! ylide) and the enone it makes does not react with another ylide; before the `forbid` of the carbonyl slot and the ketone modifier
//! of `wittig_olefination`, ylide + benzaldehyde grew an oligomer network (262 core reactions, species up to C41H48O2P2, 303 s).

use reaction_chamber_engine::network_generator::{NetworkGenerator, NetworkGeneratorConfig};
use reaction_chamber_engine::rate_harness;
use std::collections::HashMap;

#[test]
fn a_stabilised_ylide_with_benzaldehyde_makes_one_alkene_not_a_chain() {
    let ids: Vec<String> = ["O=Cc1ccccc1", "CC(=O)C=P(c1ccccc1)(c1ccccc1)c1ccccc1"].iter().map(|s| rate_harness::species_id(s).unwrap()).collect();
    let concs: HashMap<String, f64> = ids.iter().map(|i| (i.clone(), 0.1)).collect();
    let t0 = std::time::Instant::now();
    let net = NetworkGenerator::new(NetworkGeneratorConfig::default()).generate_network_in(&concs, 293.15, 7.0, "other");
    let elapsed = t0.elapsed().as_secs_f64();
    assert!(elapsed < 20.0, "the network took {elapsed:.1} s");
    assert!(!net.cap_reached, "the species / reaction cap was hit: the network is a runaway");
    assert!(net.reactions.len() <= 10, "{} core reactions: {:?}", net.reactions.len(), net.reactions.iter().map(|r| r.id.clone()).collect::<Vec<_>>());
    // the aldehyde step is there, with the Mayr rate where both partners have rows
    let step = net.reactions.iter().find(|r| r.family_id == "wittig_olefination" && r.reactants.keys().any(|k| k == &ids[0])).expect("the Wittig step with benzaldehyde");
    assert!(step.k_fwd > 0.0);
    // no product larger than the ylide itself (23 heavy atoms): no ylide reacts with the ylide or with the alkene it made
    for r in &net.reactions {
        for p in r.products.keys() {
            let heavy = reaction_chamber_engine::network_generator::resolve_molecule(p).map_or(0, |m| m.atoms.len());
            assert!(heavy <= 23, "{} makes {} ({} heavy atoms)", r.id, p, heavy);
        }
    }
}

/// The ketone rule is the aldehyde rule scaled by Mayr's electrophilicities: log10(k_ketone / k_aldehyde) = sN (E_ketone - E_benzaldehyde),
/// recomputed here from `data/mayr_parameters.json` (the ten ketone electrophiles, benzaldehyde in DMSO, the phosphonium ylides).
#[test]
fn the_ketone_rule_follows_from_mayr_electrophilicities() {
    let mayr: serde_json::Value = serde_json::from_str(include_str!("../data/mayr_parameters.json")).unwrap();
    let rows = mayr["parameters"].as_array().unwrap();
    let class_has = |p: &serde_json::Value, s: &str| p["class"].as_str().unwrap_or("").to_lowercase().contains(s);
    let ket: Vec<f64> = rows.iter().filter(|p| !p["is_nucleophile"].as_bool().unwrap() && class_has(p, "ketones")).filter_map(|p| p["e"].as_f64()).collect();
    let e_ald = rows.iter().find(|p| p["name"] == "benzaldehyde (in DMSO)").unwrap()["e"].as_f64().unwrap();
    let sn: Vec<f64> = rows.iter().filter(|p| p["is_nucleophile"].as_bool().unwrap() && p["name"].as_str().unwrap_or("").starts_with("Ph3P=")).filter_map(|p| p["s_n"].as_f64()).collect();
    assert!(ket.len() >= 8 && sn.len() >= 5, "{} ketones, {} ylides", ket.len(), sn.len());
    let factor = 10f64.powf(sn.iter().sum::<f64>() / sn.len() as f64 * (ket.iter().sum::<f64>() / ket.len() as f64 - e_ald));

    let templates: serde_json::Value = serde_json::from_str(include_str!("../data/reaction_templates.json")).unwrap();
    let w = templates["templates"].as_array().unwrap().iter().find(|t| t["id"] == "wittig_olefination").unwrap();
    let a_of = |prefix: &str| w["rules"].as_array().unwrap().iter().find(|r| r["id"].as_str().unwrap().starts_with(prefix)).unwrap()["a"].as_f64().unwrap();
    let ratio = a_of("ketone") / a_of("semi-stabilised");
    assert!((ratio / factor).log10().abs() < 0.1, "ketone / aldehyde pre-exponential {ratio:.3e}, Mayr gives {factor:.3e}");
}

/// The enol of a carbonyl-stabilised ylide is not a ylide of its own to olefinate with: its C=O is part of the delocalised ylide
/// and keto-enol tautomerism does not apply to it (it used to make an enol that the Wittig matcher took for a non-stabilised ylide).
#[test]
fn a_stabilised_ylide_has_no_keto_enol_isomer() {
    let ids: Vec<String> = ["CC(=O)C=P(c1ccccc1)(c1ccccc1)c1ccccc1"].iter().map(|s| rate_harness::species_id(s).unwrap()).collect();
    let concs: HashMap<String, f64> = ids.iter().map(|i| (i.clone(), 0.1)).collect();
    let net = NetworkGenerator::new(NetworkGeneratorConfig::default()).generate_network_in(&concs, 298.15, 1.0, "water");
    assert!(
        !net.reactions.iter().chain(net.edge.iter()).any(|r| r.family_id == "keto_enol_tautomerism"),
        "keto-enol generated for a stabilised ylide: {:?}",
        net.reactions.iter().chain(net.edge.iter()).map(|r| r.id.clone()).collect::<Vec<_>>()
    );
}
