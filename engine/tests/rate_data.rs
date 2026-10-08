//! Measured rate constants (`rate_data.rs`, `data/rates_measured.json`) outrank the estimates: the template rule of an
//! organic step (with the rule's temperature dependence when the measurement has no Ea, and without adding pathways) and
//! the Marcus cross relation of an inorganic electron transfer. Both tables are global to this test binary.

use std::collections::HashMap;

use reaction_chamber_engine::network_generator::{register_or_find_species, NetworkGenerator, NetworkGeneratorConfig};
use reaction_chamber_engine::physics::R_GAS;
use reaction_chamber_engine::rate_data::{self, OrganicRate, RedoxRate};
use reaction_chamber_engine::smiles::parse;
use reaction_chamber_engine::vessel::*;

fn sn2_of(substrate: &str, t: f64) -> reaction_chamber_engine::network_generator::GeneratedReaction {
    let mut c = HashMap::new();
    for (sp, m) in [(substrate, 0.1), ("OH-", 0.1), ("Na+", 0.1), ("H2O", 55.5)] {
        c.insert(sp.to_string(), m);
    }
    let net = NetworkGenerator::new(NetworkGeneratorConfig::default()).generate_network(&c, t, 13.0);
    net.reactions.into_iter().find(|r| r.family_id == "sn2_substitution" && r.reactants.contains_key(substrate)).expect("SN2 generated")
}

#[test]
fn a_measured_organic_rate_replaces_the_rule_with_the_rules_temperature_dependence() {
    // 1-bromohexane: unmeasured substrate to test rule replacement
    let substrate = register_or_find_species(&parse("CCCCCCBr").unwrap());
    let rule = sn2_of(&substrate, 298.15);
    assert!(!rule.rate_from_store);
    let k_meas = 3.0e-3;
    let n = rate_data::register_organic(&[OrganicRate {
        template: "*".into(),
        reactants: vec!["CCCCCCBr".into(), "[OH-]".into()],
        products: vec!["CCCCCCO".into(), "[Br-]".into()],
        k_m_s: k_meas,
        t_k: 298.15,
        ea_kj_mol: None,
        solvent_class: "water".into(),
        terms: Vec::new(),
        source: "test row".into(),
    }]);
    assert_eq!(n, 1);
    let at = |t: f64| {
        let r = sn2_of(&substrate, t);
        (r.arrhenius_a * (-r.arrhenius_ea / (R_GAS * t)).exp(), r)
    };
    let (k298, r) = at(298.15);
    assert!(r.rate_from_store && r.rate_per_reaction, "{}", r.source);
    assert!(r.source.starts_with("measured"), "{}", r.source);
    assert!((k298 / k_meas - 1.0).abs() < 1e-9, "the measured constant itself, pathways not added: {} vs {}", k298, k_meas);
    // no Ea measured: the rule's activation energy carries it to another temperature
    let (k318, r318) = at(318.15);
    assert_eq!(r318.arrhenius_ea, rule.template_ea_j_mol);
    let expected = k_meas * (-(rule.template_ea_j_mol) / R_GAS * (1.0 / 318.15 - 1.0 / 298.15)).exp();
    assert!((k318 / expected - 1.0).abs() < 1e-9);
    // a measurement in another solvent class does not apply to water
    let hexyl_chloride = register_or_find_species(&parse("CCCCCCCl").unwrap());
    rate_data::register_organic(&[OrganicRate {
        template: "*".into(),
        reactants: vec!["CCCCCCCl".into(), "[OH-]".into()],
        products: vec!["CCCCCCO".into(), "[Cl-]".into()],
        k_m_s: 1.0,
        t_k: 298.15,
        ea_kj_mol: Some(60.0),
        solvent_class: "alcohol".into(),
        terms: Vec::new(),
        source: "other solvent".into(),
    }]);
    assert!(!sn2_of(&hexyl_chloride, 298.15).rate_from_store);
}

fn redox_vessel(with_iron: bool) -> Vessel {
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
    for (id, ml) in [("water", 50.0), ("hcl_1m", 10.0)] {
        v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(ml), mass_g: None, drops: None, temperature_k: None, solid_form: None })
            .unwrap();
    }
    v.species_mol.insert("MnO4-".to_string(), 0.001);
    if with_iron {
        v.species_mol.insert("Fe+2".to_string(), 0.01);
    }
    v
}

fn mno4_left_after(seconds: f64, with_iron: bool) -> f64 {
    let mut v = redox_vessel(with_iron);
    for _ in 0..(seconds / 0.5) as usize {
        v.step(0.5).unwrap();
    }
    v.species_mol.get("MnO4-").copied().unwrap_or(0.0)
}

#[test]
fn a_measured_electron_transfer_rate_replaces_the_marcus_estimate() {
    let marcus = mno4_left_after(2.0, true);
    assert!(marcus < 0.001, "the Marcus estimate makes Fe2+ reduce permanganate: {}", marcus);
    // a (deliberately tiny) measured rate law for the same couples: permanganate must now survive
    rate_data::register_redox(vec![RedoxRate {
        donor: "Fe+2".into(),
        // the rate law is measured as the loss of permanganate whatever it turns into (Mn2+ or MnO2)
        donor_product: String::new(),
        acceptor: "MnO4-".into(),
        acceptor_product: String::new(),
        rate_of: "MnO4-".into(),
        k_m_s: 1.0e-6,
        t_k: 298.15,
        ea_kj_mol: None,
        h_order: 0.0,
        terms: Vec::new(),
        source: "test row".into(),
        verification: Some("verified".into()),
    }]);
    assert!(rate_data::redox_rate("Fe+2", "Fe+3", "MnO4-", "Mn+2").is_some());
    let measured = mno4_left_after(2.0, true);
    // the measured k [Fe2+] = 1e-6 x 0.17 M removes ~3e-7 of the permanganate in 2 s, every Fe2+ pathway (to Mn2+ and to
    // MnO2) included; what is lost besides is the oxidation of the HCl's chloride, which the same vessel without iron shows
    let no_iron = mno4_left_after(2.0, false);
    // iron may shift the chloride route a little (ionic strength, the joint step of the discovered reactions), but it adds
    assert!(measured > no_iron - 1e-6, "the measured rate law governs the Fe2+ / MnO4- pair: {} left, {} without iron (Marcus {})", measured, no_iron, marcus);
    assert!(measured > 0.9e-3);
}

#[test]
fn a_two_term_rate_law_reproduces_each_term_alone_and_their_sum() {
    use reaction_chamber_engine::rate_data::RateLawTerm;

    // 1. Organic multi-term: ester hydrolysis with neutral (term 1) and base (term 2) terms
    let sub = register_or_find_species(&parse("CCCCCBr").unwrap());
    let make_rxn = |terms: Vec<RateLawTerm>| {
        rate_data::register_organic(&[OrganicRate {
            template: "*".into(),
            reactants: vec!["CCCCCBr".into(), "[OH-]".into()],
            products: vec!["CCCCCO".into(), "[Br-]".into()],
            k_m_s: 0.0,
            t_k: 298.15,
            ea_kj_mol: None,
            solvent_class: "water".into(),
            terms,
            source: "multi-term test".into(),
        }]);
        sn2_of(&sub, 298.15)
    };

    let term1 = RateLawTerm {
        k: 1.0e-3,
        t_k: 298.15,
        ea_kj_mol: Some(60.0),
        orders: HashMap::new(),
    };
    let term2 = RateLawTerm {
        k: 2.0e-3,
        t_k: 298.15,
        ea_kj_mol: Some(50.0),
        orders: HashMap::new(),
    };

    let r1 = make_rxn(vec![term1.clone()]);
    let r2 = make_rxn(vec![term2.clone()]);
    let r_both = make_rxn(vec![term1, term2]);

    assert!((r1.k_fwd - 1.0e-3).abs() < 1e-9, "term 1 alone: {}", r1.k_fwd);
    assert!((r2.k_fwd - 2.0e-3).abs() < 1e-9, "term 2 alone: {}", r2.k_fwd);
    assert!((r_both.k_fwd - (r1.k_fwd + r2.k_fwd)).abs() < 1e-9, "sum of terms: {} vs {}", r_both.k_fwd, r1.k_fwd + r2.k_fwd);

    // 2. Redox multi-term: H2O2 + I- with neutral term and acid-catalyzed term
    let r_redox = RedoxRate {
        donor: "I-".into(),
        donor_product: "I2(aq)".into(),
        acceptor: "H2O2".into(),
        acceptor_product: "H2O".into(),
        rate_of: "H2O2".into(),
        k_m_s: 0.0,
        t_k: 298.15,
        ea_kj_mol: None,
        h_order: 0.0,
        terms: vec![
            RateLawTerm { k: 0.0115, t_k: 298.15, ea_kj_mol: None, orders: HashMap::new() },
            RateLawTerm { k: 0.175, t_k: 298.15, ea_kj_mol: None, orders: [("H+".into(), 1.0)].into_iter().collect() },
        ],
        source: "Liebhafsky & Mohammad 1933".into(),
        verification: None,
    };
    let terms = r_redox.all_terms();
    assert_eq!(terms.len(), 2);
    assert_eq!(terms[0].k_at(298.15), 0.0115);
    assert_eq!(terms[1].k_at(298.15), 0.175);
}
