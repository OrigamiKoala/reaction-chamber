//! Gates for the data-driven organic network (O1-O4 of ALGORITHM-IMPROVEMENT.md 6.4): compounds the code has never heard of
//! get their reactions from the templates alone, the core / edge split, and K only from formation data.

use std::collections::HashMap;

use reaction_chamber_engine::network_generator::{register_or_find_species, resolve_molecule, NetworkGenerator, NetworkGeneratorConfig};
use reaction_chamber_engine::smiles;
use reaction_chamber_engine::vessel::*;

fn beaker() -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: 250.0,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(298.15),
        room_k: Some(298.15),
        sealed: Some(false),
        stopper_pop_atm: Some(1.0e4),
        burst_atm: Some(1.0e4),
    })
}

fn id_of(smi: &str) -> String {
    register_or_find_species(&smiles::parse(smi).expect("valid SMILES"))
}

fn generate(species: &[(&str, f64)], ph: f64) -> reaction_chamber_engine::network_generator::GeneratedNetwork {
    let concs: HashMap<String, f64> = species.iter().map(|(s, c)| (s.to_string(), *c)).collect();
    NetworkGenerator::new(NetworkGeneratorConfig::default()).generate_network(&concs, 298.15, ph)
}

/// Compounds that appear nowhere in the code or the data (butyl propanoate, 1-chlorobutane, 2-methylbut-2-ene) react by
/// the same templates as ethyl acetate / bromoethane / propene.
#[test]
fn unseen_compounds_react_through_the_templates() {
    let ester = id_of("CCC(=O)OCCCC");
    let net = generate(&[(&ester, 0.1), ("OH-", 0.1), ("H2O", 55.5)], 13.0);
    let sap = net.reactions.iter().find(|r| r.family_id == "base_ester_hydrolysis").expect("base hydrolysis of butyl propanoate");
    assert!(sap.products.keys().any(|p| resolve_molecule(p).map_or(false, |m| m.formula() == "C4H10O")), "butanol is a product: {:?}", sap.products);

    let rcl = id_of("CCCCCl");
    let net = generate(&[(&rcl, 0.1), ("OH-", 0.1), ("H2O", 55.5)], 13.0);
    let fams: Vec<&str> = net.reactions.iter().map(|r| r.family_id.as_str()).collect();
    assert!(fams.contains(&"sn2_substitution"), "SN2 of 1-chlorobutane: {:?}", fams);

    let alkene = id_of("CC=C(C)C");
    let net = generate(&[(&alkene, 0.1), ("H2O", 55.5)], 0.0);
    // both orientations are candidates; the rate rules make the tertiary-carbocation one (Markovnikov) the fast one
    let mut hyds: Vec<_> = net.reactions.iter().chain(net.edge.iter()).filter(|r| r.family_id == "alkene_hydration").collect();
    assert!(hyds.len() >= 2, "two orientations: {:?}", hyds.iter().map(|r| &r.id).collect::<Vec<_>>());
    hyds.sort_by(|a, b| b.k_fwd.partial_cmp(&a.k_fwd).unwrap());
    assert!(hyds[0].k_fwd > 1.0e3 * hyds[1].k_fwd, "Markovnikov dominates by orders of magnitude");
    let alc = resolve_molecule(hyds[0].products.keys().next().unwrap()).unwrap();
    let o = alc.atoms.iter().position(|a| a.element == "O").unwrap();
    let c = alc.neighbours(o)[0].0;
    let n_c = alc.neighbours(c).iter().filter(|&&(j, _)| alc.atoms[j].element == "C").count();
    assert_eq!(n_c, 3, "tertiary alcohol");
}

/// K comes from formation data only: a reaction whose species lack it is irreversible with k_rev = 0 and no invented K.
#[test]
fn equilibrium_constants_come_from_data_or_not_at_all() {
    let ester = id_of("CCC(=O)OCCCC");
    let net = generate(&[(&ester, 0.1), ("OH-", 0.1), ("H2O", 55.5)], 13.0);
    assert!(!net.reactions.is_empty());
    for r in &net.reactions {
        if r.k_eq_from_data {
            assert!(r.k_eq > 0.0 && (r.k_rev - r.k_fwd / r.k_eq).abs() <= 1e-9 * r.k_rev.max(1e-30));
        } else {
            assert_eq!(r.k_rev, 0.0, "{} has no formation data, so it is irreversible", r.id);
            assert_eq!(r.k_eq_298, 0.0);
        }
    }
}

/// Candidates below the flux threshold are the edge; the vessel promotes one when the contents make it fast. Acid-catalysed
/// ester hydrolysis is a candidate in neutral water (rate ~ k[H+]), too slow for the core; at pH 0 it is the core.
#[test]
fn edge_candidates_are_promoted_when_the_solution_changes() {
    let mut v = beaker();
    v.species_mol.insert("H2O".into(), 100.0 / 18.015);
    v.species_mol.insert("ethyl_acetate".into(), 0.01);
    v.update_network();
    assert!(!v.kinetic_reactions.iter().any(|r| r.id.starts_with("acid_ester_hydrolysis")), "not in the core at pH 7");
    assert!(v.network_edge.iter().any(|e| e.family_id == "acid_ester_hydrolysis"), "but it is on the edge: {:?}", v.network_edge.iter().map(|e| &e.id).collect::<Vec<_>>());
    // nothing has changed yet: no promotion
    assert!(!v.promote_edge_reactions());
    v.species_mol.insert("H+".into(), 1.0);
    v.species_mol.insert("Cl-".into(), 1.0);
    assert!(v.promote_edge_reactions(), "the acid made an edge reaction fast");
    assert!(v.kinetic_reactions.iter().any(|r| r.id.starts_with("acid_ester_hydrolysis")), "promoted to the core");
}

/// Template rates depend on the solvent class: the same SN2 is slower in water than in an aprotic medium would be, and a
/// rule that does not name a solvent class applies to all of them.
#[test]
fn rate_rules_follow_the_solvent_class() {
    let rbr = id_of("CCBr");
    let concs: HashMap<String, f64> = [(rbr.clone(), 0.1), ("OH-".to_string(), 0.1)].into();
    let gen = NetworkGenerator::new(NetworkGeneratorConfig::default());
    let water = gen.generate_network_in(&concs, 298.15, 13.0, "water");
    let alcohol = gen.generate_network_in(&concs, 298.15, 13.0, "alcohol");
    assert!(water.reactions.iter().any(|r| r.family_id == "sn2_substitution"));
    assert!(alcohol.reactions.iter().any(|r| r.family_id == "sn2_substitution"));
}

/// Isomers get distinct ids (the id used to be the SMILES with its brackets stripped: 2-methylbutan-2-ol and pentan-1-ol
/// collided).
#[test]
fn isomers_have_distinct_ids() {
    let a = id_of("CCC(C)(C)O");
    let b = id_of("CCCCCO");
    let c = id_of("CC(O)C(C)C");
    assert!(a != b && b != c && a != c, "{} {} {}", a, b, c);
    for id in [&a, &b, &c] {
        assert_eq!(resolve_molecule(id).map(|m| m.formula()), Some("C5H12O".to_string()), "{}", id);
    }
    // registering the same molecule again finds the same id
    assert_eq!(a, id_of("OC(C)(C)CC"));
}
