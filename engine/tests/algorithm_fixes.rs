//! Regression tests for the algorithm audit (ALGORITHM-IMPROVEMENT.md, "Fixed in this pass"): each test pins one bug that
//! the audit found and fixed, through the same code path the bench runs.

use std::collections::HashMap;

use reaction_chamber_engine::chem_db::GeneralKineticRxn;
use reaction_chamber_engine::db::record::{Datum, Identity, PhaseData, PhaseThermo, SpeciesRecord};
use reaction_chamber_engine::db::SpeciesStore;
use reaction_chamber_engine::network_generator::{NetworkGenerator, NetworkGeneratorConfig};
use reaction_chamber_engine::thermo::functions::try_thermo_state;
use reaction_chamber_engine::types::ProvenanceTier;
use reaction_chamber_engine::vessel::*;

fn beaker(t: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: 250.0,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(t),
        room_k: Some(t),
        sealed: Some(false),
        stopper_pop_atm: Some(1.0e4),
        burst_atm: Some(1.0e4),
    })
}

fn rxn(id: &str, orders: &[(&str, f64)], k_eq: Option<f64>) -> GeneralKineticRxn {
    GeneralKineticRxn {
        id: id.into(),
        equation: "A <=> B".into(),
        reactants: [("A".to_string(), 1.0)].into(),
        products: [("B".to_string(), 1.0)].into(),
        gas_products: HashMap::new(),
        orders: Some(orders.iter().map(|(s, o)| (s.to_string(), *o)).collect()),
        arrhenius_a: 0.05,
        arrhenius_n: 0.0,
        arrhenius_ea: 0.0,
        delta_h_kj: 0.0,
        catalyst_species: None,
        is_reversible: k_eq.is_some(),
        k_eq_298: k_eq,
        tier: ProvenanceTier::Tabulated,
        source: "test".into(),
        phase_class: None,
    }
}

/// A reversible reaction that starts from its products runs backward to K (the vessel used to drop negative extents).
#[test]
fn reversible_reaction_runs_backward_from_its_products() {
    let mut v = beaker(298.15);
    v.species_mol.insert("H2O".into(), 1000.0 / 18.015);
    v.species_mol.insert("B".into(), 1.0);
    v.register_kinetic_reaction(rxn("A_rev_B", &[("A", 1.0)], Some(1.0)));
    for _ in 0..400 {
        v.step(0.5).unwrap();
    }
    let a = v.species_mol.get("A").copied().unwrap_or(0.0);
    let b = v.species_mol.get("B").copied().unwrap_or(0.0);
    assert!((a - 0.5).abs() < 0.002, "A {} B {}", a, b);
    assert!((a + b - 1.0).abs() < 1e-9);
}

/// An order on a species the reaction does not consume (a dissolved catalyst) enters the rate law; the catalyst stays.
#[test]
fn dissolved_catalyst_order_scales_the_rate_and_is_not_consumed() {
    let rate_with = |h_mol: f64| {
        let mut v = beaker(298.15);
        v.species_mol.insert("H2O".into(), 1000.0 / 18.015);
        v.species_mol.insert("A".into(), 1.0);
        v.species_mol.insert("H+".into(), h_mol);
        v.species_mol.insert("Cl-".into(), h_mol);
        v.register_kinetic_reaction(rxn("A_to_B_cat", &[("A", 1.0), ("H+", 1.0)], None));
        let h_before = v.species_mol.get("H+").copied().unwrap();
        v.step(0.001).unwrap();
        let r = v.active_reactions.iter().find(|r| r.id == "A_to_B_cat").map(|r| r.rate).unwrap_or(0.0);
        let h_after = v.species_mol.get("H+").copied().unwrap();
        (r, h_before, h_after)
    };
    let (r1, _, _) = rate_with(0.01);
    let (r2, hb, ha) = rate_with(0.02);
    assert!(r1 > 0.0 && (r2 / r1 - 2.0).abs() < 0.1, "rate ratio {}", r2 / r1);
    assert!((ha - hb).abs() < 1e-6 * hb.max(1e-12) + 1e-9, "catalyst consumed: {} -> {}", hb, ha);
}

/// The thermodynamic cache follows the species store: a record registered after a lookup is seen by the next lookup,
/// and a species without formation data has none (no invented placeholder).
#[test]
fn thermo_lookup_sees_records_registered_later_and_invents_nothing() {
    let id = "AuditTestSpecies(s)";
    assert!(try_thermo_state(id, "s", 298.15, 1e5).is_none());
    let datum = |v: f64| Datum::new(v, "kJ/mol", ProvenanceTier::Tabulated, "test");
    let mut phases = HashMap::new();
    phases.insert(
        "s".to_string(),
        PhaseData {
            thermo: Some(PhaseThermo {
                model: "point+cp".into(),
                tier: ProvenanceTier::Tabulated,
                source: "test".into(),
                dfH: Some(datum(-100.0)),
                dfG: Some(datum(-90.0)),
                S: None,
                cp: Some(Datum::new(30.0, "J/(mol K)", ProvenanceTier::Tabulated, "test")),
                ranges: None,
                params: None,
            }),
            volume: None,
            rho: None,
            polymorph: None,
            specific_area: None,
        },
    );
    SpeciesStore::global().write().unwrap().register(SpeciesRecord {
        id: id.into(),
        identity: Identity { formula: "AuTe".into(), ..Default::default() },
        phases,
        critical: None,
        points: Vec::new(),
        vapor_pressure: None,
        unifac_groups: None,
        acid_base: Vec::new(),
        redox: Vec::new(),
        optics: None,
        transport: None,
        kinetics_refs: Vec::new(),
        rejected: Vec::new(),
    });
    let st = try_thermo_state(id, "s", 298.15, 1e5).expect("seen after registration");
    assert!((st.h_j_mol + 100_000.0).abs() < 1.0);
    // a solid never borrows another phase's data
    assert!(try_thermo_state(id, "g", 298.15, 1e5).is_none());
}

/// Products the generator creates get Joback estimates (labelled), not a fixed -100 kJ/mol stamp.
#[test]
fn generated_products_carry_joback_estimates() {
    let gen = NetworkGenerator::new(NetworkGeneratorConfig::default());
    let concs: HashMap<String, f64> = [("2-bromopropane".to_string(), 0.1), ("OH-".to_string(), 0.1), ("H2O".to_string(), 55.5)].into();
    let net = gen.generate_network(&concs, 298.15, 13.0);
    let sn2 = net.reactions.iter().find(|r| r.family_id == "sn2_substitution").expect("SN2 generated");
    let alcohol = sn2.products.keys().find(|k| k.as_str() != "Br-").unwrap().clone();
    let store = SpeciesStore::global();
    let store = store.read().unwrap();
    let rec = store.get(&alcohol).expect("product registered");
    if let Some(gas) = rec.phases.get("g").and_then(|p| p.thermo.as_ref()) {
        // propan-2-ol, ideal gas: dfH -272.6 kJ/mol (NIST); Joback within 25 kJ/mol
        let h = gas.dfH.as_ref().unwrap();
        assert_eq!(h.tier, ProvenanceTier::Estimated);
        assert!((h.value + 272.6).abs() < 25.0, "Joback dfH(g) of {} = {}", alcohol, h.value);
        assert!(rec.points.iter().any(|p| p.kind == "psat"), "normal boiling point stored as a labelled curve point");
    } else {
        // a seeded record (measured data) is also fine: it must just not be the old stamp
        let any = rec.phases.values().filter_map(|p| p.thermo.as_ref()).filter_map(|t| t.dfH.as_ref()).next();
        assert!(any.map_or(true, |h| (h.value + 100.0).abs() > 1e-9), "no -100 kJ/mol stamp");
    }
    // a secondary bromide with hydroxide mostly eliminates, a primary mostly substitutes (Hughes-Ingold)
    let e2: f64 = net.reactions.iter().filter(|r| r.family_id == "e2_elimination").map(|r| r.k_fwd).sum();
    assert!(e2 > sn2.k_fwd, "secondary: E2 {} vs SN2 {}", e2, sn2.k_fwd);
    let concs: HashMap<String, f64> = [("bromoethane".to_string(), 0.1), ("OH-".to_string(), 0.1), ("H2O".to_string(), 55.5)].into();
    let net = gen.generate_network(&concs, 298.15, 13.0);
    let k = |fam: &str| net.reactions.iter().filter(|r| r.family_id == fam).map(|r| r.k_fwd).sum::<f64>();
    assert!(k("e2_elimination") < 0.05 * k("sn2_substitution"), "primary: E2 {} vs SN2 {}", k("e2_elimination"), k("sn2_substitution"));
}

/// Structure-derived templates: an alkoxide substitutes to an ether (not only hydroxide works), and hydration follows
/// Markovnikov's rule.
#[test]
fn templates_follow_structure() {
    let gen = NetworkGenerator::new(NetworkGeneratorConfig::default());
    let ethoxide = reaction_chamber_engine::network_generator::register_or_find_species(
        &reaction_chamber_engine::smiles::parse("CC[O-]").unwrap(),
    );
    let concs: HashMap<String, f64> = [("bromoethane".to_string(), 0.1), (ethoxide, 0.1)].into();
    let net = gen.generate_network(&concs, 298.15, 13.0);
    let sn2 = net.reactions.iter().find(|r| r.family_id == "sn2_substitution").expect("SN2 by ethoxide");
    let ether = sn2.products.keys().find(|k| k.as_str() != "Br-").unwrap();
    let mol = reaction_chamber_engine::network_generator::resolve_molecule(ether).unwrap();
    assert_eq!(mol.formula(), "C4H10O", "diethyl ether from {}", ether);

    let propene = reaction_chamber_engine::network_generator::register_or_find_species(
        &reaction_chamber_engine::smiles::parse("CC=C").unwrap(),
    );
    let concs: HashMap<String, f64> = [(propene, 0.1), ("H2O".to_string(), 55.5)].into();
    let net = gen.generate_network(&concs, 298.15, 0.0);
    let hyd = net.reactions.iter().find(|r| r.family_id == "alkene_hydration").expect("hydration in acid");
    assert_eq!(hyd.orders.get("H+"), Some(&1.0));
    let alc = resolve_molecule_of(hyd.products.keys().next().unwrap());
    // propan-2-ol: the O sits on the carbon that has two carbon neighbours
    let o = alc.atoms.iter().position(|a| a.element == "O").unwrap();
    let c = alc.neighbours(o)[0].0;
    let n_c = alc.neighbours(c).iter().filter(|&&(j, _)| alc.atoms[j].element == "C").count();
    assert_eq!(n_c, 2, "Markovnikov alcohol");
}

fn resolve_molecule_of(id: &str) -> reaction_chamber_engine::smiles::Molecule {
    reaction_chamber_engine::network_generator::resolve_molecule(id).unwrap()
}

/// The network is looked at again when the solution turns acidic: an ester in neutral water has no acid-hydrolysis path,
/// acidified it does.
#[test]
fn acidifying_regenerates_the_network() {
    let mut v = beaker(298.15);
    v.species_mol.insert("H2O".into(), 100.0 / 18.015);
    v.species_mol.insert("ethyl_acetate".into(), 0.01);
    v.step(0.05).unwrap();
    assert!(!v.kinetic_reactions.iter().any(|r| r.id.starts_with("acid_ester_hydrolysis")), "no acid path at pH 7");
    v.species_mol.insert("H+".into(), 0.1);
    v.species_mol.insert("Cl-".into(), 0.1);
    v.step(0.05).unwrap();
    assert!(
        v.kinetic_reactions.iter().any(|r| r.id.starts_with("acid_ester_hydrolysis")),
        "acid path after acidifying (pH {}, T {}, reactions {:?}, species {:?}, cap {})",
        v.current_ph(),
        v.temperature_k,
        v.kinetic_reactions.iter().map(|r| r.id.clone()).collect::<Vec<_>>(),
        v.species_mol,
        v.network_cap_reached
    );
}

/// Electron transfer stops at equilibrium: Fe2+ + I2 has Delta_r G0 > 0, so only a trace converts (it used to be
/// all-or-nothing on the sign of Delta_r G0).
#[test]
fn redox_stops_at_its_equilibrium() {
    let mut v = beaker(298.15);
    v.species_mol.insert("H2O".into(), 100.0 / 18.015);
    v.species_mol.insert("Fe+2".into(), 0.01);
    v.species_mol.insert("SO4-2".into(), 0.01);
    v.species_mol.insert("I2(aq)".into(), 0.0001);
    for _ in 0..40 {
        v.step(0.25).unwrap();
    }
    let fe3 = v.species_mol.get("Fe+3").copied().unwrap_or(0.0);
    assert!(fe3 < 0.0002 + 1e-12, "at most the iodine's worth of Fe3+, got {}", fe3);
    // (Fe2+ is partly the FeSO4 ion pair: count both)
    let fe2 = v.species_mol.get("Fe+2").copied().unwrap_or(0.0) + v.species_mol.get("FeSO4").copied().unwrap_or(0.0);
    assert!(fe2 > 0.0098, "Fe(II) total {}", fe2);
}
