//! Stage 0 gates (docs/plans/generalization-master-plan.md section 8, tasks 0.1-0.16). Every test runs on the
//! `Vessel` path, the same code the built WASM runs, and compares with literature values (plan section 9).

use reaction_chamber_engine::chem_db::{self, GeneralKineticRxn, ReagentCatalogEntry};
use reaction_chamber_engine::compound_model::*;
use reaction_chamber_engine::types::ProvenanceTier;
use reaction_chamber_engine::gas_phase::AtmosphereSpec;
use reaction_chamber_engine::vessel::*;
use std::collections::HashMap;

fn beaker_at(t: f64, sealed: bool, capacity: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: capacity,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(t),
        room_k: Some(t),
        sealed: Some(sealed),
        stopper_pop_atm: Some(2.2),
        burst_atm: Some(6.0),
    })
}
fn beaker() -> Vessel {
    beaker_at(298.15, false, 250.0)
}
fn ml(v: &mut Vessel, id: &str, x: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(x), mass_g: None, drops: None, temperature_k: None }).unwrap();
}
fn grams(v: &mut Vessel, id: &str, x: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: None, mass_g: Some(x), drops: None, temperature_k: None }).unwrap();
}
fn sp(v: &Vessel, s: &str) -> f64 {
    v.species_mol.get(s).copied().unwrap_or(0.0)
}
fn solid(v: &Vessel, s: &str) -> f64 {
    v.solid_mol.get(s).copied().unwrap_or(0.0)
}
fn run(v: &mut Vessel, seconds: f64, dt: f64) {
    let n = (seconds / dt).round() as usize;
    for _ in 0..n {
        v.step(dt).unwrap();
    }
}
fn import(id: &str, name: &str, formula: &str, smiles: Option<&str>, inchi_key: Option<&str>, state: &str) -> CompoundModel {
    let m = model_compound(&CompoundRequest {
        id: id.into(),
        name: name.into(),
        formula: formula.into(),
        smiles: smiles.map(|s| s.to_string()),
        inchi_key: inchi_key.map(|s| s.to_string()),
        state: Some(state.into()),
        ..Default::default()
    });
    if let Some(e) = &m.entry {
        chem_db::register_custom_reagent(e.clone());
    }
    if let Some(min) = &m.mineral {
        chem_db::register_custom_mineral(min.clone());
    }
    for eq in &m.equilibria {
        chem_db::register_custom_equilibrium(eq.clone());
    }
    if let Some(c) = &m.compound {
        chem_db::register_custom_compound(c.clone());
    }
    m
}

// ---- 0.1 pH -------------------------------------------------------------------------------------------------------

#[test]
fn s0_1_pure_water_ph_follows_pkw_of_temperature() {
    // pKw at saturation pressure: Bandura & Lvov, J. Phys. Chem. Ref. Data 35 (2006): 14.95 / 13.99 / 13.02 / 12.26
    for (t_c, pkw) in [(0.0, 14.95), (25.0, 13.99), (60.0, 13.02), (100.0, 12.26)] {
        let mut v = beaker_at(273.15 + t_c, false, 250.0);
        // CO2-free air: this gate is the autoionisation of water (water open to ordinary air takes up CO2, see stage4.rs)
        v.set_controls(VesselControls { atmosphere: Some(AtmosphereSpec { composition: Some([("N2(g)".to_string(), 0.79), ("O2(g)".to_string(), 0.21)].into()), ..Default::default() }), ..Default::default() });
        ml(&mut v, "water", 50.0);
        run(&mut v, 10.0, 0.5);
        let ph = v.current_ph();
        assert!((ph - pkw / 2.0).abs() <= 0.01, "T={} C: pH {:.3}, expected {:.3}", t_c, ph, pkw / 2.0);
    }
}

#[test]
fn s0_1_ph_is_not_clamped_and_basic_branch_uses_the_solver() {
    // 1 M NaOH at 60 C: [OH-] = 1 M, pOH 0, pH = pKw(60 C) = 13.0 on the concentration scale (the old sign error gave 15.0)
    let mut v = beaker_at(333.15, false, 250.0);
    ml(&mut v, "naoh_1m", 20.0);
    let ph = v.current_ph();
    assert!(ph > 12.7 && ph < 13.2, "1 M NaOH at 60 C read pH {}", ph);
    // concentrated acid reads below 0 (no clamp at -3 either way, none at 0)
    let mut w = beaker();
    ml(&mut w, "hcl_1m", 20.0);
    assert!(w.current_ph().abs() < 0.2, "1 M HCl pH {}", w.current_ph());
    // exactly neutral water: the H+ = OH- tie reads the neutral pH, not an OH- branch artefact
    let mut n = beaker();
    ml(&mut n, "water", 50.0);
    assert!((n.current_ph() - 7.0).abs() < 0.01);
}

#[test]
fn s0_1_template_catalysis_reads_oh_from_the_solution_not_14_minus_ph() {
    use reaction_chamber_engine::network_generator::{NetworkGenerator, NetworkGeneratorConfig};
    use reaction_chamber_engine::templates::Medium;
    // same pH 7 but a hot medium: OH- from Kw(T) is 10x larger at 60 C than 14 - pH would give
    let medium_hot = Medium::from_solution(7.0, 333.15, &HashMap::new());
    // Kw(60 C) = 10^-13.02, so [OH-] at pH 7 is 9e-7 M (14 - pH would give 1e-7)
    assert!(medium_hot.oh_conc > 8.0e-7 && medium_hot.oh_conc < 1.1e-6, "OH- at pH 7, 60 C: {}", medium_hot.oh_conc);
    // an explicit solver OH- concentration wins over any inference
    let concs: HashMap<String, f64> = [("OH-".to_string(), 0.01), ("H+".to_string(), 1e-12)].into();
    let strong = Medium::from_solution(12.0, 298.15, &concs);
    assert_eq!(strong.oh_conc, 0.01);
    // (the hand-written ethyl-acetate k_obs(pH) function is gone) generated reactions carry their catalyst in the rate
    // law, so the vessel reads [H+] / [OH-] from the solution every tick: acid hydrolysis is first order in H+ and zero
    // order in the solvent
    let gen = NetworkGenerator::new(NetworkGeneratorConfig::default());
    let concs: HashMap<String, f64> = [("ethyl_acetate".to_string(), 0.1), ("H2O".to_string(), 55.5), ("H+".to_string(), 0.1)].into();
    let net = gen.generate_network(&concs, 298.15, 1.0);
    let acid = net.reactions.iter().find(|r| r.family_id == "acid_ester_hydrolysis").expect("acid hydrolysis generated");
    assert_eq!(acid.orders.get("H+"), Some(&1.0));
    assert_eq!(acid.orders.get("H2O"), Some(&0.0));
    // k(298) per M of H+ is the measured k_H of ethyl acetate within a factor of 3 (1.1e-4 M^-1 s^-1)
    let k_h = acid.arrhenius_a * (-acid.arrhenius_ea / (8.314462618 * 298.15)).exp();
    assert!(k_h > 1.1e-4 / 3.0 && k_h < 1.1e-4 * 3.0, "k_H {}", k_h);
}

// ---- 0.2 kinetic records + balance check ---------------------------------------------------------------------------

fn i_atoms(v: &Vessel) -> f64 {
    let mut n = 0.0;
    for (id, mol) in &v.species_mol {
        let k = match id.as_str() {
            "I-" | "I2(aq)" => if id == "I-" { 1.0 } else { 2.0 },
            "I3-" | "starch_I3" => 3.0,
            _ => 0.0,
        };
        n += k * mol;
    }
    n
}

#[test]
fn s0_2_iodine_clock_conserves_iodine() {
    for dt in [0.05, 0.5] {
        let mut v = beaker_at(293.15, false, 250.0);
        ml(&mut v, "s2o8_0_04m", 25.0);
        ml(&mut v, "ki_0_05m", 25.0);
        ml(&mut v, "na2s2o3_0_002m", 25.0);
        ml(&mut v, "starch_sol", 2.0);
        let i0 = i_atoms(&v);
        assert!(i0 > 1e-3);
        run(&mut v, 300.0, dt);
        let i1 = i_atoms(&v);
        // Changed in Stage 5: dissolved I2 is a volatile solute now (its liquid twin gives it a vapour pressure, the
        // dissolved-inert-compounds-evaporate gap of Stage 4), so a little iodine leaves the open beaker over 300 s. The
        // reactions still create no iodine: the inventory can only fall, by the evaporated I2 (< 0.2 % here), and the
        // conservation ledger (which books the evaporation out) must stay balanced.
        let rel = (i1 - i0) / i0;
        assert!(rel <= 1e-9 && rel > -2e-3, "dt {}: I atoms {} -> {}", dt, i0, i1);
        let c = v.snapshot().conservation;
        assert!(c.ok, "dt {}: {:?}", dt, c);
        assert!(c.max_element_rel_err < 1e-6);
        // the reaction really ran: iodine was produced (and the blue complex appeared once thiosulfate was used up)
        let reacted = v.species_mol.get("SO4-2").copied().unwrap_or(0.0);
        assert!(reacted > 1e-4, "dt {}: sulfate {}", dt, reacted);
    }
}

#[test]
fn s0_2_h2o2_decomposition_gives_half_a_mole_of_o2_per_mole() {
    let mut v = beaker();
    ml(&mut v, "h2o2_3pct", 50.0);
    grams(&mut v, "mno2_s", 0.5);
    let h0 = sp(&v, "H2O2");
    // Changed in Stage 5: a catalog solution is a recipe per mL at the 20 C reference of volumetric glassware, dosed so that
    // it fills the requested volume at the dose temperature (22 C here): 0.1 % fewer moles than the 0.044 mol stamped before
    assert!((h0 - 0.044).abs() < 0.044 * 3e-3, "H2O2 {}", h0);
    let w0 = sp(&v, "H2O");
    run(&mut v, 240.0, 0.5);
    // what left the vessel is the oxygen and a little evaporated water (the reaction warms the solution): the water
    // lost is the initial water plus the 0.044 mol the reaction made minus what is left
    let water_lost_mol = w0 + h0 - sp(&v, "H2O");
    let o2_mol = (v.mass_lost_g - water_lost_mol * 18.015) / 31.999;
    assert!((o2_mol - h0 / 2.0).abs() < h0 / 2.0 * 0.01, "O2 {} mol (expected {} +/- 1 %)", o2_mol, h0 / 2.0);
    assert!(sp(&v, "H2O2") < 1e-5);
    let c = v.snapshot().conservation;
    assert!(c.ok && c.max_element_rel_err < 1e-9, "{:?}", c);
}

#[test]
fn s0_2_every_default_record_is_balanced_or_declared_unverifiable() {
    let mut problems = Vec::new();
    for e in chem_db::get_default_equilibria() {
        let rep = chem_db::check_balance(&e.reactants, &e.products, &HashMap::new());
        if !rep.balanced {
            problems.push(format!("equilibrium {}: {:?}", e.id, rep.problem()));
        }
    }
    for k in chem_db::get_default_kinetic_reactions() {
        let rep = chem_db::check_balance(&k.reactants, &k.products, &k.gas_products);
        if !rep.balanced {
            problems.push(format!("kinetic {}: {:?}", k.id, rep.problem()));
        }
    }
    for m in chem_db::get_default_minerals() {
        if m.dissolved_products.is_empty() {
            continue;
        }
        let reac: HashMap<String, f64> = [(m.solid_species.clone(), 1.0)].into();
        let rep = chem_db::check_balance(&reac, &m.dissolved_products, &HashMap::new());
        if !rep.balanced {
            problems.push(format!("mineral {}: {:?}", m.id, rep.problem()));
        }
    }
    assert!(problems.is_empty(), "unbalanced defaults:\n{}", problems.join("\n"));
}

#[test]
fn s0_2_registered_unbalanced_reaction_is_flagged_by_the_ledger() {
    let mut v = beaker();
    let bad = GeneralKineticRxn {
        id: "bad_iodide_to_iodine".into(),
        equation: "I- -> I2(aq)".into(),
        reactants: [("I-".to_string(), 1.0)].into(),
        products: [("I2(aq)".to_string(), 1.0)].into(),
        gas_products: HashMap::new(),
        orders: None,
        arrhenius_a: 1.0,
        arrhenius_n: 0.0,
        arrhenius_ea: 0.0,
        delta_h_kj: 0.0,
        catalyst_species: None,
        is_reversible: false,
        k_eq_298: None,
        tier: ProvenanceTier::Tabulated,
        source: "test".into(),
    };
    let warning = v.register_kinetic_reaction(bad);
    assert!(warning.as_deref().map_or(false, |w| w.contains("not balanced")), "{:?}", warning);
    assert!(v.snapshot().events.iter().any(|e| e.kind == VesselEventKind::ConservationWarning));
    assert_eq!(v.kinetic_reactions.iter().find(|r| r.id == "bad_iodide_to_iodine").unwrap().tier, ProvenanceTier::Speculative);
    ml(&mut v, "ki_0_05m", 20.0);
    assert!(v.snapshot().conservation.ok, "balanced before the reaction runs");
    run(&mut v, 5.0, 0.5);
    let c = v.snapshot().conservation;
    assert!(!c.ok, "the ledger must flag created iodine atoms: {:?}", c);
    assert!(c.element_errors.iter().any(|e| e.element == "I" && e.rel_err > 0.01 && e.abs_err_mol > 1e-5), "{:?}", c.element_errors);
    assert!(c.max_element_rel_err > 0.01);
}

#[test]
fn s0_2_ledger_follows_what_leaves_the_vessel() {
    // boil off, pour out, gas vented: nothing may register as an element error
    let mut v = beaker();
    ml(&mut v, "water", 100.0);
    ml(&mut v, "nacl_0_1m", 10.0);
    v.set_controls(VesselControls { heater_w: Some(800.0), ..Default::default() });
    run(&mut v, 150.0, 0.5);
    assert!(v.mass_lost_g > 1.0, "should have boiled");
    let c = v.snapshot().conservation;
    assert!(c.ok && c.max_element_rel_err < 1e-9, "boil-off: {:?}", c);
    let p = v.remove_liquid(20.0, true).unwrap();
    assert!(p.volume_ml > 10.0);
    let c = v.snapshot().conservation;
    assert!(c.ok, "after removing a portion: {:?}", c);
    let mut w = beaker();
    w.add_portion(p).unwrap();
    assert!(w.snapshot().conservation.ok);
    // CO2 evolved from bicarbonate + acid in an open beaker leaves with the gas
    let mut x = beaker();
    ml(&mut x, "ch3cooh_5pct", 30.0);
    grams(&mut x, "nahco3_s", 2.0);
    run(&mut x, 60.0, 0.25);
    assert!(x.mass_lost_g > 0.5);
    let c = x.snapshot().conservation;
    assert!(c.ok && c.max_element_rel_err < 1e-9, "open-beaker CO2: {:?}", c);
}

#[test]
fn s0_5_unparseable_species_are_reported_not_skipped() {
    let mut v = beaker();
    // a custom reagent made of a pseudo-species the formula parser cannot read
    let mut comp = HashMap::new();
    comp.insert("H2O".to_string(), 0.0555);
    comp.insert("Zq".to_string(), 0.0001);
    v.register_reagent(ReagentCatalogEntry {
        id: "mystery".into(),
        name: "Mystery".into(),
        formula: "Zq".into(),
        form: "solution".into(),
        concentration_m: Some(0.1),
        density_g_ml: 1.0,
        ghs: vec![],
        signal_word: String::new(),
        bottle_colour: "clear".into(),
        composition: comp,
        label: "Zq".into(),
        by_mass: false,
        dropper: None,
        inchi_key: None,
    });
    ml(&mut v, "mystery", 10.0);
    let c = v.snapshot().conservation;
    assert!(c.unverified_species.contains(&"Zq".to_string()), "{:?}", c.unverified_species);
}

// ---- 0.3 water in equilibria ---------------------------------------------------------------------------------------

#[test]
fn s0_3_neutralisation_makes_one_water_per_proton() {
    let mut v = beaker();
    ml(&mut v, "hcl_0_1m", 50.0);
    let w0 = sp(&v, "H2O");
    let h0 = sp(&v, "H+");
    assert!((h0 - 0.005).abs() < 1e-4);
    // (Stage 5: the water a catalog solution brings is the recipe's, scaled to the dosed volume at the dose temperature, so
    // it is measured by dosing the base into an empty beaker rather than read from the per-mL catalog composition)
    let mut b = beaker();
    ml(&mut b, "naoh_0_1m", 50.0);
    let water_in_base = sp(&b, "H2O");
    ml(&mut v, "naoh_0_1m", 50.0);
    let made = sp(&v, "H2O") - w0 - water_in_base;
    assert!((made - 0.005).abs() < 0.005 * 0.01, "water formed {} mol per 0.005 mol H+", made);
    // (Stage 5: the acid and the base are recipes dosed to 50 mL at the dose temperature; their moles differ by ~3e-6
    // relative through the two solutions' own volume models, and the pH of an equivalence point moves a unit per 1e-7 mol of
    // imbalance, so the neutral pH is asserted to a unit, not to 0.05)
    assert!((v.current_ph() - 7.0).abs() < 1.0, "pH {}", v.current_ph());
    let c = v.snapshot().conservation;
    assert!(c.ok, "{:?}", c);
}

// ---- 0.4 network generator is off ----------------------------------------------------------------------------------

#[test]
fn s0_4_no_invented_organic_species_after_any_pair_of_catalog_reagents() {
    let ids: Vec<ReagentCatalogEntry> = chem_db::get_reagent_catalog();
    let mut pairs = 0;
    let mut offenders: Vec<String> = Vec::new();
    for i in 0..ids.len() {
        for j in (i + 1)..ids.len() {
            let mut v = beaker();
            for e in [&ids[i], &ids[j]] {
                let req = if e.by_mass || e.form == "solid" {
                    DoseRequest { reagent_id: e.id.clone(), volume_ml: None, mass_g: Some(1.0), drops: None, temperature_k: None }
                } else {
                    DoseRequest { reagent_id: e.id.clone(), volume_ml: Some(10.0), mass_g: None, drops: None, temperature_k: None }
                };
                v.dose(req).unwrap();
            }
            v.step(0.5).unwrap();
            pairs += 1;
            for k in v.species_mol.keys().chain(v.solid_mol.keys()) {
                if k.contains("_subst") || k.contains("_enol") || k.contains("_alkene") || k.contains("_alcohol") {
                    offenders.push(format!("{} + {}: {}", ids[i].id, ids[j].id, k));
                }
            }
            for r in &v.kinetic_reactions {
                if r.id.contains("tautomerism") || r.id.starts_with("sn2_") || r.id.starts_with("sn1_") || r.id.starts_with("e2_") {
                    offenders.push(format!("{} + {}: generated reaction {}", ids[i].id, ids[j].id, r.id));
                }
            }
        }
    }
    assert!(pairs >= 300, "{} pairs", pairs);
    assert!(offenders.is_empty(), "{} offenders, first: {:?}", offenders.len(), &offenders[..offenders.len().min(5)]);
}

#[test]
fn s0_4_generator_still_available_behind_the_debug_flag() {
    let mut v = beaker();
    assert!(!v.debug_network_generator);
    v.set_controls(VesselControls { debug_network_generator: Some(true), ..Default::default() });
    assert!(v.debug_network_generator);
}

// ---- 0.6 acids -----------------------------------------------------------------------------------------------------

#[test]
fn s0_6_citric_acid_is_weak_with_estimated_pka() {
    let m = import(
        "s0_citric", "Citric acid", "C6H8O7",
        Some("C(C(=O)O)C(CC(=O)O)(C(=O)O)O"), Some("KRKNYBCHXYNGOX-UHFFFAOYSA-N"), "solid",
    );
    assert!(m.modelable && m.kind == "acid", "{} / {}", m.kind, m.reason);
    assert_eq!(m.species, vec![("C6H8O7".to_string(), 1.0)], "the neutral parent, not H+ + citrate: {:?}", m.species);
    assert_eq!(m.equilibria.len(), 3);
    assert!(m.equilibria.iter().all(|e| e.tier == ProvenanceTier::Estimated));
    let mut v = beaker();
    ml(&mut v, "water", 100.0);
    grams(&mut v, "s0_citric", 1.9212); // 0.0100 mol in ~100 mL = 0.1 M
    run(&mut v, 3.0, 0.5);
    let ph = v.current_ph();
    assert!((ph - 2.1).abs() <= 0.3, "0.1 M citric acid pH {} (real 2.1)", ph);
    // the equilibria in the vessel carry the Estimated tier into the UI
    let mine: Vec<_> = v.equilibria.iter().filter(|e| e.id.starts_with("est_acid_") && e.id.contains("C6H")).collect();
    assert_eq!(mine.len(), 3);
    assert!(mine.iter().all(|e| e.tier == ProvenanceTier::Estimated));
}

#[test]
fn s0_6_acids_are_strong_only_with_data() {
    // HCl, HNO3: tabulated pKa < 0 -> strong; an unknown oxoacid (chloric acid has data; periodic acid does not) is not
    let hcl = import("s0_hcl", "Hydrochloric acid", "ClH", Some("Cl"), Some("VEXZGXHMUGYJMC-UHFFFAOYSA-N"), "liquid");
    assert_eq!(hcl.kind, "acid");
    assert!(hcl.species.iter().any(|(s, _)| s == "H+") && hcl.equilibria.is_empty());
    let hio3 = import("s0_hio3", "Iodic acid", "HIO3", Some("OI(=O)=O"), Some("JHWIEAWILPSRMU-UHFFFAOYSA-N"), "solid");
    assert!(hio3.modelable && hio3.kind == "acid");
    assert!(!hio3.equilibria.is_empty(), "no data -> weak acid with an estimated pKa: {:?}", hio3.species);
    assert!(hio3.equilibria.iter().all(|e| e.tier == ProvenanceTier::Estimated));
}

#[test]
fn s0_6_charge_free_carbon_smiles_is_never_split_into_h_plus_and_anion() {
    // an organic acid whose SMILES has no charges keeps its neutral parent (weak), it is not H+ + anion
    let m = import("s0_oxalic", "Oxalic acid", "C2H2O4", Some("C(=O)(C(=O)O)O"), Some("MUBZPKHOEPUJKR-UHFFFAOYSA-N"), "solid");
    assert!(m.species.iter().all(|(s, _)| s != "H+"), "{:?}", m.species);
    // and with no charges at all, a carbon compound that matches no anion stays an inert molecule
    let g = import("s0_glc", "Glucose", "C6H12O6", Some("C(C1C(C(C(C(O1)O)O)O)O)O"), Some("WQZGKKKJIJFFOK-GASJEMHNSA-N"), "solid");
    assert_eq!(g.kind, "inert");
}

// ---- 0.7 identity --------------------------------------------------------------------------------------------------

#[test]
fn s0_7_isomers_are_not_mistaken_for_known_molecules() {
    let methyl_formate = import("s0_mf", "Methyl formate", "C2H4O2", Some("COC=O"), Some("TZIHFWKZFHZASV-UHFFFAOYSA-N"), "liquid");
    let acetic = import("s0_aa", "Acetic acid", "C2H4O2", Some("CC(=O)O"), Some("QTBSBXVTEAMEQO-UHFFFAOYSA-N"), "liquid");
    let dme = import("s0_dme", "Dimethyl ether", "C2H6O", Some("COC"), Some("LCGLNKUTAGEVQW-UHFFFAOYSA-N"), "gas");
    let etoh = import("s0_etoh", "Ethanol", "C2H6O", Some("CCO"), Some("LFQSCWFLJHTTHZ-UHFFFAOYSA-N"), "liquid");
    assert_eq!(methyl_formate.kind, "inert", "{}", methyl_formate.reason);
    assert!(methyl_formate.species.iter().all(|(s, _)| s != "CH3COOH"));
    assert!(acetic.species.iter().any(|(s, _)| s == "CH3COOH"), "acetic acid is recognised by InChIKey: {:?}", acetic.species);
    assert_eq!(dme.kind, "inert", "{}", dme.reason);
    assert!(dme.species.iter().all(|(s, _)| s != "C2H5OH"));
    assert!(etoh.species.iter().any(|(s, _)| s == "C2H5OH"));
    // no InChIKey: the formula alone never proves identity; a structure with one carboxylic OH does prove an acid
    let nosmiles = import("s0_nokey", "Acetic acid", "C2H4O2", None, None, "liquid");
    assert_eq!(nosmiles.kind, "inert", "formula only: {}", nosmiles.reason);
    let by_structure = import("s0_nokey2", "Acetic acid", "C2H4O2", Some("CC(=O)O"), None, "liquid");
    assert!(by_structure.species.iter().any(|(s, _)| s == "CH3COOH"), "{:?}", by_structure.species);
    let mf_structure = import("s0_nokey3", "Methyl formate", "C2H4O2", Some("COC=O"), None, "liquid");
    assert_eq!(mf_structure.kind, "inert", "an ester is not an acid: {}", mf_structure.reason);
}

#[test]
fn s0_7_inert_isomers_get_distinct_engine_species() {
    let a = import("s0_1prop", "1-Propanol", "C3H8O", Some("CCCO"), Some("BDERNNFJNOPAEC-UHFFFAOYSA-N"), "liquid");
    let b = import("s0_2prop", "2-Propanol", "C3H8O", Some("CC(C)O"), Some("KFZMGEQAYNKOFK-UHFFFAOYSA-N"), "liquid");
    assert!(a.kind == "inert" && b.kind == "inert");
    assert_ne!(a.species[0].0, b.species[0].0, "isomers share an engine species: {:?} {:?}", a.species, b.species);
    // both ids still parse as C3H8O
    for m in [&a, &b] {
        let e = reaction_chamber_engine::ions::species_elements(&format!("{}(l)", m.species[0].0)).unwrap();
        assert_eq!(e.get("C").copied(), Some(3.0));
        assert_eq!(e.get("O").copied(), Some(1.0));
    }
    let mut v = beaker();
    ml(&mut v, "s0_1prop", 5.0);
    ml(&mut v, "s0_2prop", 5.0);
    let n: usize = v.species_mol.keys().filter(|k| k.starts_with("C3H8O")).count();
    assert_eq!(n, 2, "{:?}", v.species_mol.keys().collect::<Vec<_>>());
}

#[test]
fn s0_7_every_builtin_neutral_molecule_has_an_inchikey() {
    // the formula proposes candidates, so each parseable neutral species the engine reacts must be matchable by key
    let mut missing = Vec::new();
    let mut seen: Vec<String> = Vec::new();
    for eq in chem_db::get_default_equilibria().into_iter().filter(|e| !e.id.starts_with("est_acid_")) {
        for k in eq.reactants.keys().chain(eq.products.keys()) {
            seen.push(k.clone());
        }
    }
    for r in chem_db::get_default_kinetic_reactions() {
        for k in r.reactants.keys().chain(r.products.keys()) {
            seen.push(k.clone());
        }
    }
    seen.sort();
    seen.dedup();
    for s in seen {
        // (acids imported by other tests register their estimated ladders in the shared custom registry)
        if s == "H2O" || s.ends_with("(g)") || reaction_chamber_engine::ions::species_charge(&s) != 0 {
            continue;
        }
        if reaction_chamber_engine::ions::species_elements(&s).is_none() {
            continue;
        }
        if !KNOWN_NEUTRAL_INCHIKEYS.iter().any(|(id, _)| *id == s) {
            missing.push(s);
        }
    }
    // pseudo-species with a formula (indicator dyes, starch) are reagents, not PubChem molecules
    missing.retain(|s| !(s.starts_with("HIn_") || s == "starch"));
    assert!(missing.is_empty(), "neutral species without an InChIKey: {:?}", missing);
}

// ---- 0.8 scale and volume gates --------------------------------------------------------------------------------------

#[test]
fn s0_8_microlitre_droplets_precipitate() {
    let mut v = beaker();
    ml(&mut v, "agno3_0_1m", 0.011);
    ml(&mut v, "nacl_0_1m", 0.011);
    let agcl = solid(&v, "AgCl(s)");
    assert!(agcl >= 1.0e-6, "AgCl {} mol from 1.1 umol + 1.1 umol", agcl);
    run(&mut v, 2.0, 0.1);
    assert!(solid(&v, "AgCl(s)") >= 1.0e-6);
    // it is announced and visible in the snapshot
    let s = v.snapshot();
    assert!(s.solids.iter().any(|x| x.species == "AgCl(s)"), "AgCl row missing from the snapshot");
    assert!(s.events.iter().any(|e| e.kind == VesselEventKind::PrecipitateFormed));
    assert!(s.conservation.ok, "{:?}", s.conservation);
}

#[test]
fn s0_8_salt_solubility_is_set_by_the_solvent_mixture_not_by_the_water_volume_alone() {
    // Changed in Stage 5. The old gate asserted that 25 mL ethanol next to 25 mL water leaves the NaCl solubility exactly as
    // in 25 mL of water: the "water-only basis" the plan lists under Deletes. Dissolution is now a solid-liquid equilibrium
    // in whatever liquid is there: ethanol lowers the water activity's capacity to hold the salt (Born / Long-McDevit
    // salting-out in the mixed solvent), so LESS salt dissolves than in water alone, but the dissolved salt is never more
    // dilute than a saturated aqueous solution (ethanol dilutes nothing by volume).
    let nacl = import("s0_nacl_s", "Sodium chloride", "ClNa", Some("[Na+].[Cl-]"), Some("FAPWRFPIFSIZLT-UHFFFAOYSA-M"), "solid");
    assert!(nacl.modelable);
    let mut v = beaker();
    ml(&mut v, "water", 25.0);
    ml(&mut v, "ethanol", 25.0);
    grams(&mut v, "s0_nacl_s", 10.0);
    run(&mut v, 3.0, 0.5);
    let undissolved_g = solid(&v, "NaCl(s)") * 58.443;
    // plain water: 25 g of water holds 9.0 g NaCl at 25 C (36 g / 100 g)
    let mut w = beaker();
    ml(&mut w, "water", 25.0);
    grams(&mut w, "s0_nacl_s", 10.0);
    run(&mut w, 3.0, 0.5);
    let left = solid(&w, "NaCl(s)") * 58.443;
    assert!(left > 0.5 && left < 2.5, "undissolved in water alone: {:.2} g", left);
    assert!(undissolved_g > left + 1.0 && undissolved_g < 10.0, "ethanol must salt the NaCl out: {:.2} g undissolved with ethanol vs {:.2} g in water alone", undissolved_g, left);
}

// ---- 0.9 energy hygiene --------------------------------------------------------------------------------------------

#[test]
fn s0_9_bicarbonate_plus_vinegar_cools_with_the_degassing_enthalpy() {
    // Hess: NaHCO3(s) + AcOH -> Na+ + AcO- + H2O + CO2(g): ~ +30 kJ/mol; 1 g in 50 mL cools by well over 0.5 K
    let mut v = beaker();
    ml(&mut v, "ch3cooh_5pct", 50.0);
    let t0 = v.temperature_k;
    grams(&mut v, "nahco3_s", 1.0);
    run(&mut v, 120.0, 0.25);
    let dt = v.temperature_k - t0;
    // (Stage 8: the CO2 leaves as bubbles over tens of seconds while the room warms the beaker back at 0.5 W/K, so the
    // measured dip is the middle of the Hess value, about -1.6 K, and the room's recovery)
    assert!(dt < -0.6 && dt > -2.5, "temperature change {:.2} K (Hess route about -1.5 K)", dt);
    // and no kinetic shortcut record exists any more
    assert!(v.kinetic_reactions.iter().all(|r| r.id != "baking_soda_vinegar"));
}

#[test]
fn s0_9_one_gas_constant_and_one_glass_factor() {
    assert_eq!(reaction_chamber_engine::physics::R_GAS, 8.314462618);
    assert_eq!(reaction_chamber_engine::templates::R_IDEAL, reaction_chamber_engine::physics::R_GAS);
    // pouring 10 mL of 80 C water into an empty beaker: the same glass fraction as every other path
    let mut v = beaker();
    v.dose(DoseRequest { reagent_id: "water".into(), volume_ml: Some(10.0), mass_g: None, drops: None, temperature_k: Some(353.15) }).unwrap();
    // (Stage 5: 10 mL of water at 80 C is 9.718 g, its density at that temperature, not the 10.0 g the stamped 1 g/mL gave)
    let cp_water = 10.0 * 0.97179 * 4.184;
    let expected = (353.15 * cp_water + 298.15 * 110.0 * 0.84 * 0.15) / (cp_water + 110.0 * 0.84 * 0.15);
    assert!((v.temperature_k - expected).abs() < 0.2, "{} vs {}", v.temperature_k, expected);
}

#[test]
fn s0_9_portion_carries_its_own_heat_capacity() {
    // 10 mL of hot ethanol (cp 2.44, 0.789 g/mL) poured into 50 mL of cold water
    let mut a = beaker();
    ml(&mut a, "water", 50.0);
    let mut src = beaker();
    src.dose(DoseRequest { reagent_id: "ethanol".into(), volume_ml: Some(10.0), mass_g: None, drops: None, temperature_k: Some(340.0) }).unwrap();
    src.temperature_k = 340.0;
    let p = src.remove_liquid(10.0, true).unwrap();
    let c_water = 50.0 * 1.0 * 4.184;
    let m_etoh = 10.0 * 0.789;
    let c_etoh = m_etoh * 2.44;
    let c_glass = 110.0 * 0.84 * 0.15;
    let expected = (298.15 * (c_water + c_glass) + 340.0 * c_etoh) / (c_water + c_glass + c_etoh);
    a.add_portion(p).unwrap();
    assert!((a.temperature_k - expected).abs() < 0.3, "{} vs {}", a.temperature_k, expected);
}

// ---- 0.10 solver hygiene ---------------------------------------------------------------------------------------------

#[test]
fn s0_10_no_zero_amount_species_after_solving() {
    let mut v = beaker();
    ml(&mut v, "water", 50.0);
    for id in ["nh3_2m", "cuso4_0_1m", "agno3_0_1m", "nacl_0_1m", "ch3cooh_5pct", "hcl_0_1m", "cocl2_0_1m", "ki_0_05m"] {
        ml(&mut v, id, 5.0);
    }
    run(&mut v, 2.0, 0.1);
    let zeros: Vec<&String> = v.species_mol.iter().filter(|(_, m)| **m <= 0.0).map(|(k, _)| k).collect();
    assert!(zeros.is_empty(), "zero-amount species kept: {:?}", zeros);
    let zs: Vec<&String> = v.solid_mol.iter().filter(|(_, m)| **m <= 0.0).map(|(k, _)| k).collect();
    assert!(zs.is_empty(), "{:?}", zs);
    let snap = v.snapshot();
    assert!(snap.species.iter().all(|s| s.amount_mol > 0.0));
    assert!(snap.conservation.ok, "{:?}", snap.conservation);
}

// ---- 0.13 provenance -------------------------------------------------------------------------------------------------

#[test]
fn s0_13_provenance_tier_serialises_as_kebab_case() {
    for (t, s) in [
        (ProvenanceTier::Tabulated, "tabulated"),
        (ProvenanceTier::Imported, "imported"),
        (ProvenanceTier::Estimated, "estimated"),
        (ProvenanceTier::Speculative, "speculative"),
        (ProvenanceTier::Refined, "refined"),
        (ProvenanceTier::UserSet, "user-set"),
    ] {
        assert_eq!(serde_json::to_string(&t).unwrap(), format!("\"{}\"", s));
        assert_eq!(t.as_str(), s);
        let back: ProvenanceTier = serde_json::from_str(&format!("\"{}\"", s)).unwrap();
        assert_eq!(back, t);
    }
    // the capitalised spelling of older data files is still accepted
    let old: ProvenanceTier = serde_json::from_str("\"Tabulated\"").unwrap();
    assert_eq!(old, ProvenanceTier::Tabulated);
}

#[test]
fn s0_13_species_rows_carry_the_tier_of_the_data_used() {
    let mut v = beaker();
    ml(&mut v, "agno3_0_1m", 10.0);
    ml(&mut v, "nacl_0_1m", 10.0);
    let tier = |v: &Vessel, id: &str| v.snapshot().species.iter().find(|s| s.id == id).map(|s| s.tier.clone());
    assert_eq!(tier(&v, "Na+"), Some(ProvenanceTier::Tabulated));
    assert_eq!(tier(&v, "AgCl(s)"), Some(ProvenanceTier::Tabulated));
    // a species outside the thermo table runs on a placeholder enthalpy / heat capacity: Speculative
    let mut w = beaker();
    ml(&mut w, "water", 20.0);
    w.species_mol.insert("Zn(OH)4-2".to_string(), 1e-4);
    assert_eq!(chem_db::species_thermo_tier("Zn(OH)4-2"), ProvenanceTier::Speculative);
    assert_eq!(tier(&w, "Zn(OH)4-2"), Some(ProvenanceTier::Speculative));
    // imported compounds are Imported
    let m = import("s0_naph", "Naphthalene", "C10H8", Some("c1ccc2ccccc2c1"), Some("UFWIBTONFRDIAS-UHFFFAOYSA-N"), "solid");
    assert!(m.modelable);
    let mut x = beaker();
    ml(&mut x, "water", 20.0);
    grams(&mut x, "s0_naph", 0.5);
    let snap = x.snapshot();
    assert!(snap.species.iter().any(|s| s.id.starts_with("C10H8") && s.tier == ProvenanceTier::Imported), "{:?}", snap.species.iter().map(|s| (&s.id, &s.tier)).collect::<Vec<_>>());
}

// ---- 0.14 visual corrections (engine side) ---------------------------------------------------------------------------

#[test]
fn s0_14_any_boiling_liquid_boils_on_screen_and_a_dry_vessel_has_no_steam() {
    let mut v = beaker();
    ml(&mut v, "ethanol", 50.0);
    v.set_controls(VesselControls { heater_w: Some(400.0), ..Default::default() });
    run(&mut v, 40.0, 0.5);
    let s = v.snapshot();
    assert!((v.temperature_k - 351.5).abs() < 1.0, "ethanol T {}", v.temperature_k);
    assert!(s.boil_intensity > 0.12, "boiling ethanol must read as boiling: {}", s.boil_intensity);
    assert!(s.evaporation_g_s > 0.1, "evaporation {}", s.evaporation_g_s);
    // intensity grows with the vapour flow
    let mut hard = beaker();
    ml(&mut hard, "ethanol", 50.0);
    hard.set_controls(VesselControls { heater_w: Some(900.0), ..Default::default() });
    run(&mut hard, 40.0, 0.5);
    assert!(hard.snapshot().boil_intensity > s.boil_intensity);
    // water below its boiling point does not boil; just under it nothing bubbles
    let mut warm = beaker();
    ml(&mut warm, "water", 50.0);
    warm.temperature_k = 360.0;
    warm.room_k = 360.0;
    run(&mut warm, 2.0, 0.5);
    assert_eq!(warm.snapshot().boil_intensity, 0.0);
    // an empty hot vessel: no liquid, so no steam, no condensation, no boil
    let mut dry = beaker();
    dry.temperature_k = 420.0;
    let sd = dry.snapshot();
    assert_eq!((sd.vapour_visibility, sd.condensation, sd.boil_intensity), (0.0, 0.0, 0.0));
}

#[test]
fn s0_14_open_vessel_fumes_come_from_the_gas_leaving() {
    // Stage 10: fumes are the plume of gas that left the liquid. A gas is visible because of its absorption (chlorine) or
    // because it condenses into droplets in humid air (hydrogen chloride); nitrogen leaving is invisible. Heavy gas pools.
    let mut v = beaker();
    ml(&mut v, "water", 20.0);
    assert!(v.snapshot().fumes.is_empty());
    v.gas_fluxes.push(GasFlux { species: "HCl(g)".into(), rate_ml_s: 120.0, bubble_diameter_mm: 1.0, nucleation: "bulk".into(), origin: None });
    v.gas_fluxes.push(GasFlux { species: "N2(g)".into(), rate_ml_s: 120.0, bubble_diameter_mm: 1.0, nucleation: "bulk".into(), origin: None });
    v.gas_fluxes.push(GasFlux { species: "Cl2(g)".into(), rate_ml_s: 120.0, bubble_diameter_mm: 1.0, nucleation: "bulk".into(), origin: None });
    v.step_plume(1.0);
    let f = v.snapshot().fumes;
    let find = |id: &str| f.iter().find(|x| x.species == id);
    assert!(find("HCl(g)").map_or(false, |x| x.kind == "aerosol" && x.opacity > 0.2), "{:?}", f);
    let cl = find("Cl2(g)").expect("chlorine is coloured");
    assert!(cl.kind == "gas" && cl.denser_than_air, "{:?}", cl);
    assert!(cl.rgb[0] > cl.rgb[2], "chlorine transmits red/green, absorbs blue: {:?}", cl.rgb);
    assert!(find("N2(g)").is_none(), "nitrogen has no absorption: {:?}", f);
}

#[test]
fn s0_14_scatter_spectrum_is_deterministic() {
    // Stage 10: the turbidity is a per-bin extinction and albedo spectrum summed over solids in sorted order, so two solids never
    // give a hash-order-dependent result
    let build = |order: &[&str]| {
        let mut v = beaker();
        ml(&mut v, "water", 20.0);
        ml(&mut v, "agno3_0_1m", 10.0);
        ml(&mut v, "cuso4_0_1m", 10.0);
        for id in order {
            ml(&mut v, id, 12.0);
        }
        let l = v.snapshot().layers.into_iter().find(|l| l.phase == PhaseKind::Aqueous).unwrap();
        (l.scatter_per_cm, l.scatter_albedo)
    };
    let a = build(&["nacl_0_1m", "naoh_0_1m"]);
    assert!(a.0.iter().any(|e| *e > 0.0), "two precipitates must make the liquid turbid");
    for _ in 0..8 {
        let b = build(&["nacl_0_1m", "naoh_0_1m"]);
        for k in 0..a.0.len() {
            assert!((a.0[k] - b.0[k]).abs() < 1e-12 && (a.1[k] - b.1[k]).abs() < 1e-12, "non-deterministic scatter spectrum");
        }
    }
    assert!(a.1.iter().all(|w| (0.0..=1.0).contains(w)));
}

#[test]
fn s0_14_ionic_import_keeps_its_own_density_and_colour() {
    let req = CompoundRequest {
        id: "s0_pbi2".into(), name: "Lead iodide".into(), formula: "I2Pb".into(),
        smiles: Some("[Pb+2].[I-].[I-]".into()), inchi_key: Some("RQYUTQAIUDQGIC-UHFFFAOYSA-L".into()),
        state: Some("solid".into()), density: Some(6.16), color_linear_rgb: Some([0.71, 0.60, 0.02]), ..Default::default()
    };
    let m = model_compound(&req);
    let min = m.mineral.expect("PbI2 mineral");
    assert_eq!(min.density_g_ml, 6.16);
    assert_eq!(min.solid_color, [0.71, 0.60, 0.02]);
}

#[test]
fn s0_14_bottle_colour_cache_key_changes_with_the_optics_data() {
    let h = reaction_chamber_engine::optics::records::data_hash();
    assert_ne!(h, 0);
    assert_eq!(h, reaction_chamber_engine::optics::records::data_hash());
}

#[test]
fn s0_14_flame_power_follows_the_pool_burning_rate() {
    // Stage 8: the burning rate of a pool is the Spalding mass-transfer-number result for the fuel's own data (no stored
    // 0.015 kg/m2/s). A 250 mL beaker of ethanol burns at about a kilowatt and a half (Babrauskas measured 0.015 kg/m2/s for
    // large pools); the power is the burning rate times the net heat of combustion (1235 kJ/mol to H2O(g)).
    let mut v = beaker();
    ml(&mut v, "ethanol", 40.0);
    v.set_controls(VesselControls { igniter: Some(true), ..Default::default() });
    run(&mut v, 1.0, 0.1);
    let n0 = v.species_mol.get("C2H5OH").copied().unwrap_or(0.0);
    run(&mut v, 10.0, 0.1);
    let n1 = v.species_mol.get("C2H5OH").copied().unwrap_or(0.0);
    let flame = v.snapshot().flame.expect("flame");
    let burn_mol_s = (n0 - n1) / 10.0;
    let expected_w = burn_mol_s * 1_235_000.0;
    // (the vapour also evaporates unburnt below the pool's own vapour pressure: the consumption is at least what burns)
    assert!(flame.power_w > 0.85 * expected_w && flame.power_w < 1.25 * expected_w, "{} W vs {} W from the consumption", flame.power_w, expected_w);
    assert!(flame.power_w > 1000.0 && flame.power_w < 2000.0, "{} W", flame.power_w);
}

// ---- 0.15 sealed-vessel vapour pressure bridge --------------------------------------------------------------------------

/// Saturation pressure (Pa) of a liquid species from its record (Stage 4: the one vapour-pressure layer).
fn psat(id: &str, t: f64) -> f64 {
    reaction_chamber_engine::vle::volatile_from_store(id).expect("volatile").psat_pa(t)
}

/// Pressure (Pa) the air of a sealed vessel exerts: its (non-condensable) gas moles at the headspace volume.
fn air_pressure_pa(v: &Vessel) -> f64 {
    let n: f64 = ["N2(g)", "O2(g)", "Ar(g)"].iter().map(|k| v.headspace_gas_mol.get(*k).copied().unwrap_or(0.0)).sum();
    n * 8.314462618 * v.temperature_k / ((v.config.capacity_ml - v.total_liquid_volume_ml()) * 1e-6)
}

#[test]
fn s0_15_sealed_water_pressure_follows_iapws_to_the_critical_region() {
    // 250 mL sealed vessel, 50 mL of water, a stopper that holds; the temperature is held by a bath
    // (Stage 4: the sealed gas phase now holds real air that the liquid compresses, the vapour pressure is the record's
    // IF97 curve, and the mixture is a Peng-Robinson gas)
    for t_c in [100.0, 150.0, 200.0, 218.0, 250.0, 318.0] {
        let t = 273.15 + t_c;
        let mut v = Vessel::new(VesselConfig {
            vessel_type: "erlenmeyer-250".into(), capacity_ml: 250.0, glass_mass_g: 110.0, inner_radius_cm: 3.5,
            temperature_k: Some(t), room_k: Some(298.15), sealed: Some(true), stopper_pop_atm: Some(1.0e4), burst_atm: Some(1.0e4),
        });
        ml(&mut v, "water", 50.0);
        v.temperature_k = t;
        v.set_controls(VesselControls { bath_k: Some(Some(t)), ..Default::default() });
        run(&mut v, 60.0, 0.5);
        let t_now = v.temperature_k;
        assert!((t_now - t).abs() < 15.0, "bath held {} K, got {}", t, t_now);
        let psat_atm = psat("H2O", t_now) / 101325.0;
        let expect = psat_atm + air_pressure_pa(&v) / 101325.0;
        assert!((v.pressure_atm - expect).abs() < 0.05 * expect + 0.1, "T={} C: {:.2} atm vs {:.2}", t_c, v.pressure_atm, expect);
        if t_c >= 218.0 {
            assert!(v.pressure_atm > 20.0, "old model clamped at 10 atm: {}", v.pressure_atm);
        }
        // the vapour came out of the liquid (mass and latent heat are booked), nothing is lost
        assert!(v.headspace_gas_mol.get("H2O(g)").copied().unwrap_or(0.0) > 0.0);
        let c = v.snapshot().conservation;
        assert!(c.ok, "T={}: {:?}", t_c, c);
        // nothing but the air that the 50 mL of water pushed out of the stoppered vessel has left (< 0.1 g)
        assert!(v.mass_lost_g.abs() < 0.1, "{}", v.mass_lost_g);
    }
}

#[test]
fn s0_15_sealed_ethanol_and_mixtures_use_their_own_curves() {
    let t = 400.0;
    let mk = || Vessel::new(VesselConfig {
        vessel_type: "erlenmeyer-250".into(), capacity_ml: 250.0, glass_mass_g: 110.0, inner_radius_cm: 3.5,
        temperature_k: Some(t), room_k: Some(298.15), sealed: Some(true), stopper_pop_atm: Some(1.0e4), burst_atm: Some(1.0e4),
    });
    let mut e = mk();
    ml(&mut e, "ethanol", 30.0);
    e.temperature_k = t;
    e.set_controls(VesselControls { bath_k: Some(Some(t)), ..Default::default() });
    run(&mut e, 20.0, 0.5);
    let expect = psat("C2H5OH", e.temperature_k) / 101325.0 + air_pressure_pa(&e) / 101325.0;
    assert!((e.pressure_atm - expect).abs() < 0.07 * expect, "ethanol {} atm vs {}", e.pressure_atm, expect);
    // the old model had no ethanol vapour pressure at all (1.0 + T/Troom only)
    assert!(e.pressure_atm > 5.0);
    // an equimolar water + ethanol liquid: the total vapour pressure is x_i gamma_i Psat_i summed (UNIFAC gamma > 1 for
    // this mixture), so it lies above the ideal Raoult value but within a factor of two of it
    let mut m = mk();
    ml(&mut m, "ethanol", 20.0);
    let n_e = sp(&m, "C2H5OH");
    let water_ml = n_e * 18.015;
    ml(&mut m, "water", water_ml);
    m.temperature_k = t;
    m.set_controls(VesselControls { bath_k: Some(Some(t)), ..Default::default() });
    run(&mut m, 20.0, 0.5);
    let tt = m.temperature_k;
    let raoult = 0.5 * psat("H2O", tt) + 0.5 * psat("C2H5OH", tt);
    let n_vap = m.headspace_gas_mol.get("H2O(g)").copied().unwrap_or(0.0) + m.headspace_gas_mol.get("C2H5OH(g)").copied().unwrap_or(0.0);
    let vap = n_vap * 8.314462618 * tt / ((250.0 - m.total_liquid_volume_ml()).max(10.0) * 1e-6);
    assert!(vap > 0.9 * raoult && vap < 2.0 * raoult, "{} Pa vs Raoult {}", vap, raoult);
}

#[test]
fn s0_15_sealed_vapour_latent_heat_cools_the_contents() {
    // a sealed vessel heated 100 -> 200 C holds more vapour; that vapour was made at the expense of the liquid and heat
    let mut v = Vessel::new(VesselConfig {
        vessel_type: "erlenmeyer-250".into(), capacity_ml: 250.0, glass_mass_g: 110.0, inner_radius_cm: 3.5,
        temperature_k: Some(300.0), room_k: Some(298.15), sealed: Some(true), stopper_pop_atm: Some(1.0e4), burst_atm: Some(1.0e4),
    });
    ml(&mut v, "water", 50.0);
    let w0 = sp(&v, "H2O");
    let vapour0 = v.headspace_gas_mol.get("H2O(g)").copied().unwrap_or(0.0);
    v.temperature_k = 300.0;
    v.set_controls(VesselControls { heater_w: Some(300.0), ..Default::default() });
    run(&mut v, 150.0, 0.5);
    let liquid_lost = w0 - sp(&v, "H2O");
    let vapour = v.headspace_gas_mol.get("H2O(g)").copied().unwrap_or(0.0) - vapour0;
    assert!((liquid_lost - vapour).abs() < 1e-6, "liquid lost {} vs vapour {}", liquid_lost, vapour);
    assert!(vapour > 1e-3);
    // energy: heater input (minus the ambient loss) = sensible heat + latent heat of the vapour formed
    let c = v.snapshot().conservation;
    assert!(c.ok, "{:?}", c);
}
