//! SN1 solvolysis is two steps: ionisation (rate-limiting, the measured first-order rate) and trapping of the carbocation (by the
//! solvent, or by the halide that left: the common-ion return). Before the split `sn1_solvolysis` made the alcohol in one step.

use reaction_chamber_engine::network_generator::{NetworkGenerator, NetworkGeneratorConfig};
use reaction_chamber_engine::rate_harness;
use std::collections::HashMap;

fn network(reactants: &[&str], t_k: f64, class: &str) -> (Vec<reaction_chamber_engine::network_generator::GeneratedReaction>, HashMap<String, String>) {
    let mut concs: HashMap<String, f64> = HashMap::new();
    let mut ids = HashMap::new();
    for r in reactants {
        let id = rate_harness::species_id(r).unwrap();
        concs.insert(id.clone(), 0.1);
        ids.insert(r.to_string(), id);
    }
    concs.insert(reaction_chamber_engine::db::seed::WATER.to_string(), 55.5);
    let net = NetworkGenerator::new(NetworkGeneratorConfig::default()).generate_network_in(&concs, t_k, 7.0, class);
    let mut all = net.reactions;
    all.extend(net.edge);
    (all, ids)
}

fn reaction<'a>(rs: &'a [reaction_chamber_engine::network_generator::GeneratedReaction], family: &str, reactant: &str) -> &'a reaction_chamber_engine::network_generator::GeneratedReaction {
    rs.iter().find(|r| r.family_id == family && r.reactants.keys().any(|k| k == reactant)).unwrap_or_else(|| panic!("no {family} step of {reactant}"))
}

#[test]
fn tert_butyl_chloride_ionises_once_and_the_cation_decides_the_products() {
    let (rs, ids) = network(&["CC(C)(C)Cl"], 298.15, "water");
    // the substrate is consumed by one reaction only (the ionisation, measured 0.0302 s-1): no one-step solvolysis and no one-step E1 beside it
    let from_substrate: Vec<&str> = rs.iter().filter(|r| r.reactants.keys().any(|k| k == &ids["CC(C)(C)Cl"])).map(|r| r.family_id.as_str()).collect();
    assert_eq!(from_substrate, vec!["sn1_ionisation"], "{from_substrate:?}");
    let ion = reaction(&rs, "sn1_ionisation", &ids["CC(C)(C)Cl"]);
    assert!(ion.rate_from_store && (rate_harness::engine_k(ion, 298.15) / 3.02e-2 - 1.0).abs() < 1e-6);
    let cation = ion.products.keys().find(|k| k.as_str() != "Cl-").unwrap().clone();
    // the cation is trapped by water and loses a proton (E1): the alkene share is the ratio of the two rates, 8 % as the rule states
    let trap = reaction(&rs, "carbocation_trapping_by_solvent", &cation);
    let e1 = rs.iter().find(|r| r.family_id == "e1_deprotonation" && r.reactants.keys().any(|k| k == &cation)).expect("E1 step of the cation");
    let (k_trap, k_e1) = (rate_harness::engine_k(trap, 298.15), rate_harness::engine_k(e1, 298.15));
    let share = k_e1 / (k_e1 + k_trap);
    assert!((0.05..0.12).contains(&share), "alkene share {share:.3}");
    // trapping by water is far faster than ionisation: the cation never accumulates, so the measured solvolysis rate is the ionisation rate
    assert!(k_trap * 55.5 > 1e4 * 3.02e-2);
}

/// The whole mechanism in a vessel: tert-butyl chloride dosed into water solvolyses (the liquid-phase ionisation has a half-life of
/// 23 s), the cation never accumulates, the alcohol is the main product with the alkene share of the E1 rule, the halide is conserved.
#[test]
fn solvolysis_in_a_vessel_completes_through_the_cation() {
    use reaction_chamber_engine::chem_db;
    use reaction_chamber_engine::vessel::*;
    let tbucl = rate_harness::species_id("CC(C)(C)Cl").unwrap();
    let mut comp = HashMap::new();
    comp.insert(tbucl.clone(), 0.842 / 92.57);
    chem_db::register_custom_reagent(chem_db::ReagentCatalogEntry {
        id: "tbucl_neat".into(), name: "tert-Butyl chloride".into(), formula: "C4H9Cl".into(), form: "liquid".into(), concentration_m: None,
        density_g_ml: 0.842, ghs: vec![], signal_word: "".into(), bottle_colour: "clear".into(), composition: comp, label: "tert-Butyl chloride".into(),
        by_mass: false, dropper: None, inchi_key: None, solid_form: None, particle_um: None,
    });
    let mut v = Vessel::new(VesselConfig {
        vessel_type: "test-flask".into(), capacity_ml: 250.0, glass_mass_g: 100.0, inner_radius_cm: 3.5, temperature_k: Some(298.15), room_k: Some(298.15),
        sealed: Some(true), stopper_pop_atm: Some(20.0), burst_atm: Some(60.0), // sealed: tert-butyl chloride (bp 51 C) would otherwise leave the open flask
    });
    let dose = |id: &str, ml: f64| DoseRequest { reagent_id: id.into(), volume_ml: Some(ml), mass_g: None, drops: None, temperature_k: Some(298.15), solid_form: None };
    v.dose(dose("water", 100.0)).unwrap();
    v.dose(dose("tbucl_neat", 0.1)).unwrap();
    let n0 = v.species_mol.get(&tbucl).copied().unwrap_or(0.0);
    assert!(n0 > 5e-4, "{n0}");
    // the network of the vessel: ionisation, trapping by water, E1 proton loss, in that order of the mechanism
    let ids: Vec<&str> = v.kinetic_reactions.iter().map(|r| r.id.as_str()).collect();
    for want in ["sn1_ionisation_", "carbocation_trapping_by_solvent_", "e1_deprotonation_"] {
        assert!(ids.iter().any(|i| i.starts_with(want)), "{want}: {ids:?}");
    }
    // 20 half-lives of the liquid-phase ionisation (the chloride is volatile and re-dissolves from the headspace)
    let mut cation_max = 0.0f64;
    for _ in 0..1200 {
        v.step(1.0).unwrap();
        let c: f64 = v.species_mol.iter().filter(|(k, _)| k.ends_with('+') && k.starts_with("C4H9")).map(|(_, m)| *m).sum();
        cation_max = cation_max.max(c);
    }
    let cl = v.species_mol.get("Cl-").copied().unwrap_or(0.0);
    assert!(cl / n0 > 0.97, "solvolysis did not run to completion: {:.3} of the chloride was released", cl / n0);
    assert!(cation_max < 1e-6 * n0, "the carbocation accumulated: {cation_max:e} mol");
    let alcohol: f64 = v.species_mol.iter().filter(|(k, _)| k.starts_with("C4H10O")).map(|(_, m)| *m).sum();
    assert!(alcohol / n0 > 0.7, "tert-butanol is the main product: {:.3}", alcohol / n0);
}
