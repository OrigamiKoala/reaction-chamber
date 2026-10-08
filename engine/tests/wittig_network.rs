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
