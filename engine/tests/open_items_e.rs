//! Gates of the sixth pass (ALGORITHM-IMPROVEMENT.md 6.7): heat of mixing, per-layer settling, bath evaporation, new
//! organic templates, ion-pair enthalpy.

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

fn dose_ml(v: &mut Vessel, reagent: &str, ml: f64) {
    v.dose(DoseRequest { reagent_id: reagent.into(), volume_ml: Some(ml), mass_g: None, drops: None, temperature_k: None, solid_form: None }).expect("dose");
}

/// Mixing water and ethanol releases heat (the mixture is exothermic at 25 C) and the same amount of ethanol added in
/// halves releases the same total: the heat is a function of the final composition, not of the path.
#[test]
fn water_and_ethanol_warm_on_mixing_and_the_heat_is_path_independent() {
    let mut one = beaker();
    dose_ml(&mut one, "water", 100.0);
    let t0 = one.temperature_k;
    dose_ml(&mut one, "ethanol", 50.0);
    let rise_one = one.temperature_k - t0;
    assert!(rise_one > 1.0 && rise_one < 12.0, "mixing 100 mL water with 50 mL ethanol warms by a few K: {}", rise_one);

    let mut two = beaker();
    dose_ml(&mut two, "water", 100.0);
    dose_ml(&mut two, "ethanol", 25.0);
    dose_ml(&mut two, "ethanol", 25.0);
    let rise_two = two.temperature_k - t0;
    assert!((rise_one - rise_two).abs() < 0.25 * rise_one, "path independence: {} vs {}", rise_one, rise_two);

    // the excess enthalpy is a state function: the audit sees it
    assert!(one.excess_enthalpy_j() < -500.0, "H^E of the mixture is negative: {}", one.excess_enthalpy_j());
}

/// Drawing off part of a mixture costs no heat: the share that leaves carries its excess enthalpy.
#[test]
fn drawing_off_a_mixture_does_not_heat_the_rest() {
    let mut v = beaker();
    dose_ml(&mut v, "water", 100.0);
    dose_ml(&mut v, "ethanol", 50.0);
    for _ in 0..4 {
        v.step(0.5).unwrap();
    }
    let t = v.temperature_k;
    v.remove_liquid(60.0, false).unwrap();
    for _ in 0..2 {
        v.step(0.5).unwrap();
    }
    assert!((v.temperature_k - t).abs() < 0.15, "{} -> {}", t, v.temperature_k);
}

/// A pair with no measured data still gets a heat of mixing from the temperature derivative of the activity model, and a
/// mixture of identical liquids (one component) gets none.
#[test]
fn a_single_liquid_has_no_heat_of_mixing() {
    let mut v = beaker();
    dose_ml(&mut v, "water", 50.0);
    dose_ml(&mut v, "water", 50.0);
    assert!(v.excess_enthalpy_j().abs() < 1e-9);
}

/// W5: a hot water bath steams: it loses water through its open surface and the latent heat cools it faster than the room
/// coupling alone.
#[test]
fn a_hot_bath_loses_water_by_evaporation() {
    use reaction_chamber_engine::bath::BathSpec;
    let mut v = beaker();
    dose_ml(&mut v, "water", 50.0);
    v.set_controls(VesselControls { bath: Some(Some(BathSpec { temperature_k: 350.0, mass_g: 800.0, ice_fraction: 0.0, melt_k: None })), ..Default::default() });
    for _ in 0..1200 {
        v.step(0.5).unwrap();
    }
    let snap = v.snapshot();
    let bath = snap.bath.expect("finite bath in the snapshot");
    assert!(bath.mass_g < 795.0 && bath.mass_g > 600.0, "bath mass {} g (steaming away a few grams over ten minutes)", bath.mass_g);
    assert!(bath.temperature_k < 350.0 && bath.temperature_k > 330.0, "bath temperature {}", bath.temperature_k);
}

// ------------------------------------------------------------------------------------------------ organic templates

mod organic {
    use std::collections::HashMap;

    use reaction_chamber_engine::network_generator::{register_or_find_species, resolve_molecule, GeneratedNetwork, NetworkGenerator, NetworkGeneratorConfig};
    use reaction_chamber_engine::smiles;

    pub fn id_of(smi: &str) -> String {
        register_or_find_species(&smiles::parse(smi).expect("valid SMILES"))
    }

    pub fn generate(species: &[(&str, f64)], ph: f64) -> GeneratedNetwork {
        let concs: HashMap<String, f64> = species.iter().map(|(s, c)| (s.to_string(), *c)).collect();
        NetworkGenerator::new(NetworkGeneratorConfig::default()).generate_network(&concs, 298.15, ph)
    }

    pub fn formula_of(id: &str) -> String {
        resolve_molecule(id).map(|m| m.formula()).unwrap_or_default()
    }

    pub fn all<'a>(net: &'a GeneratedNetwork, family: &str) -> Vec<&'a reaction_chamber_engine::network_generator::GeneratedReaction> {
        net.reactions.iter().chain(net.edge.iter()).filter(|r| r.family_id == family).collect()
    }
}

/// Diels-Alder: compounds the code has never seen add as a diene and a dienophile; an electron-poor dienophile and a
/// ring-locked s-cis diene are faster, by structure alone.
#[test]
fn diels_alder_adds_a_diene_and_a_dienophile_by_structure() {
    use organic::*;
    use reaction_chamber_engine::network_generator::resolve_molecule;
    let cp = id_of("C1=CC=CC1");
    let ma = id_of("O=C1C=CC(=O)O1");
    let ethene = id_of("C=C");
    let butadiene = id_of("C=CC=C");
    let net = generate(&[(&cp, 0.1), (&ma, 0.1), (&ethene, 0.1), ("H2O", 0.0)], 7.0);
    let da = all(&net, "diels_alder");
    let adduct = da.iter().find(|r| r.products.keys().any(|p| formula_of(p) == "C9H8O3")).expect("cyclopentadiene + maleic anhydride adduct C9H8O3");
    let plain = da.iter().find(|r| r.products.keys().any(|p| formula_of(p) == "C7H10")).expect("cyclopentadiene + ethene adduct C7H10 (norbornene)");
    assert!(adduct.k_fwd > 1.0e5 * plain.k_fwd, "an electron-poor dienophile is far faster: {:e} vs {:e}", adduct.k_fwd, plain.k_fwd);
    // atoms are conserved and the product has one ring more
    let prod = resolve_molecule(adduct.products.keys().next().unwrap()).unwrap();
    let rings = |m: &reaction_chamber_engine::smiles::Molecule| m.bonds.len() as i32 - m.atoms.len() as i32 + 1;
    assert_eq!(rings(&prod), rings(&resolve_molecule(&cp).unwrap()) + rings(&resolve_molecule(&ma).unwrap()) + 1);
    // the open-chain diene is slower than the ring-locked one with the same dienophile
    let net2 = generate(&[(&butadiene, 0.1), (&ma, 0.1)], 7.0);
    let open = all(&net2, "diels_alder").into_iter().find(|r| r.products.keys().any(|p| formula_of(p) == "C8H8O3")).expect("butadiene adduct");
    assert!(adduct.k_fwd > 100.0 * open.k_fwd, "{:e} vs {:e}", adduct.k_fwd, open.k_fwd);
}

/// Friedel-Crafts alkylation: the ring's substituents set the rate and the orientation (Hammett), the Lewis acid is a
/// catalyst species of the rate law, the alkyl halide class sets the rate.
#[test]
fn friedel_crafts_alkylation_follows_the_ring_and_the_halide() {
    use organic::*;
    use reaction_chamber_engine::network_generator::resolve_molecule;
    let benzene = id_of("c1ccccc1");
    let toluene = id_of("Cc1ccccc1");
    let tbucl = id_of("CC(C)(C)Cl");
    let prcl = id_of("CCCCl");
    let cat = [("AlCl3", 0.05)];
    let mk = |arene: &str, rx: &str| {
        let mut s = vec![(arene, 0.5), (rx, 0.5)];
        s.extend(cat.iter().copied());
        generate(&s, 7.0)
    };
    let net_b = mk(&benzene, &tbucl);
    let net_t = mk(&toluene, &tbucl);
    let tot = |net: &reaction_chamber_engine::network_generator::GeneratedNetwork, formula: &str| -> f64 {
        all(net, "friedel_crafts_alkylation").iter().filter(|r| r.products.keys().any(|p| formula_of(p) == formula)).map(|r| r.k_fwd).sum()
    };
    let kb = tot(&net_b, "C10H14");
    let kt = tot(&net_t, "C11H16");
    // (relative rate of toluene to benzene in AlCl3 / alkyl halide alkylation is 2-3: rho+ is only about -2.4)
    assert!(kb > 0.0 && kt > 1.5 * kb && kt < 10.0 * kb, "toluene is mildly activated: {:e} vs benzene {:e}", kt, kb);
    // orientation: three substitution isomers (ortho, meta, para), the meta one the slowest
    let mut iso: Vec<f64> = all(&net_t, "friedel_crafts_alkylation").iter().filter(|r| r.products.keys().any(|p| formula_of(p) == "C11H16")).map(|r| r.k_fwd).collect();
    iso.sort_by(|a, b| a.partial_cmp(b).unwrap());
    assert!(iso.len() >= 2 && iso[iso.len() - 1] > 1.5 * iso[0], "orientation: {:?}", iso);
    // a tertiary halide is far faster than a primary one
    let net_p = mk(&benzene, &prcl);
    let kp = all(&net_p, "friedel_crafts_alkylation").iter().map(|r| r.k_fwd).sum::<f64>();
    assert!(kb > 100.0 * kp, "{:e} vs {:e}", kb, kp);
    // the catalyst is in the rate law
    let r = all(&net_b, "friedel_crafts_alkylation").into_iter().next().unwrap();
    assert!(r.orders.get("AlCl3").copied().unwrap_or(0.0) > 0.99, "{:?}", r.orders);
}

/// An organomagnesium halide adds to a carbonyl, and is destroyed by water much faster than that.
#[test]
fn a_grignard_reagent_adds_to_carbonyls_and_is_protonated_by_water() {
    use organic::*;
    use reaction_chamber_engine::network_generator::resolve_molecule;
    let mgx = id_of("C[Mg]Br");
    let ald = id_of("CC=O");
    let net = generate(&[(&mgx, 0.1), (&ald, 0.1), ("H2O", 5.0)], 7.0);
    let add = all(&net, "organomagnesium_carbonyl_addition");
    let prot = all(&net, "organomagnesium_protonolysis");
    assert!(!add.is_empty() && !prot.is_empty());
    assert!(add[0].products.keys().any(|p| formula_of(p) == "C3H7BrMgO"), "magnesium alkoxide: {:?}", add[0].products.keys().map(|p| formula_of(p)).collect::<Vec<_>>());
    assert!(prot[0].products.keys().any(|p| formula_of(p) == "CH4"), "methane");
    assert!(prot[0].k_fwd > 1.0e2 * add[0].k_fwd, "water wins by orders of magnitude: {:e} vs {:e}", prot[0].k_fwd, add[0].k_fwd);
}

/// Wittig: the ylide's C=C replaces the carbonyl's C=O and the phosphine oxide leaves.
#[test]
fn a_wittig_ylide_turns_a_carbonyl_into_an_alkene() {
    use organic::*;
    use reaction_chamber_engine::network_generator::resolve_molecule;
    let ylide = id_of("C=P(c1ccccc1)(c1ccccc1)c1ccccc1");
    let bza = id_of("O=Cc1ccccc1");
    let net = generate(&[(&ylide, 0.1), (&bza, 0.1)], 7.0);
    let w = all(&net, "wittig_olefination");
    assert!(!w.is_empty(), "no Wittig reaction generated");
    let forms: Vec<String> = w[0].products.keys().map(|p| formula_of(p)).collect();
    assert!(forms.contains(&"C8H8".to_string()) && forms.contains(&"C18H15OP".to_string()), "styrene + triphenylphosphine oxide: {:?}", forms);
}

// ------------------------------------------------------------------------------------------------ Cr(VI)

/// Dichromate oxidises iron(II) in acid: 6 Fe2+ per Cr2O7 2-, chromium(III) appears, and atoms and charge are conserved.
#[test]
fn dichromate_oxidises_iron_two_in_acid_and_gives_chromium_three() {
    use reaction_chamber_engine::chem_db::{self, ReagentCatalogEntry};
    let entry = |id: &str, comp: &[(&str, f64)], conc: f64| ReagentCatalogEntry {
        id: id.into(), name: id.into(), formula: id.into(), form: "solution".into(), concentration_m: Some(conc), density_g_ml: 1.0, ghs: vec![],
        signal_word: String::new(), bottle_colour: "clear".into(), composition: comp.iter().map(|(k, v)| (k.to_string(), *v)).collect(),
        label: id.into(), by_mass: false, dropper: None, inchi_key: None, solid_form: None, particle_um: None,
    };
    let mut v = beaker();
    v.register_reagent(entry("k2cr2o7_t", &[("K+", 0.00002), ("Cr2O7-2", 0.00001), ("H2O", 0.05549)], 0.01));
    v.register_reagent(entry("feso4_t", &[("Fe+2", 0.0001), ("SO4-2", 0.0001), ("H2O", 0.0555)], 0.1));
    dose_ml(&mut v, "k2cr2o7_t", 20.0);
    dose_ml(&mut v, "hcl_1m", 10.0);
    dose_ml(&mut v, "feso4_t", 10.0);
    for _ in 0..400 {
        v.step(0.5).unwrap();
    }
    // the atoms of an element in a given oxidation state, over every species form (free ion, ion pair, hydroxo complex)
    let atoms_in_state = |v: &Vessel, element: &str, state: f64| -> f64 {
        use reaction_chamber_engine::gem::redox::determine_oxidation_states_exact;
        let mut total = 0.0;
        let all = v.species_mol.iter().chain(v.solid_mol.iter());
        for (sp, mol) in all {
            let ox = determine_oxidation_states_exact(sp);
            let n = reaction_chamber_engine::ions::species_elements(sp).and_then(|e| e.get(element).copied()).unwrap_or(0.0);
            if n > 0.0 && ox.get(element).map_or(false, |o| (o - state).abs() < 0.01) {
                total += mol * n;
            }
        }
        total
    };
    let fe2 = atoms_in_state(&v, "Fe", 2.0);
    let fe3 = atoms_in_state(&v, "Fe", 3.0);
    let cr3 = atoms_in_state(&v, "Cr", 3.0);
    let cr6 = atoms_in_state(&v, "Cr", 6.0);
    // 1.0 mmol Fe(II) against 0.4 mmol Cr(VI) (which takes 1.2 mmol): iron is the limiting reagent
    assert!(fe2 < 5.0e-5, "iron(II) is used up: {} mol left of 1e-3", fe2);
    assert!((fe3 - 1.0e-3).abs() < 1.0e-4, "all of it is iron(III): {} mol", fe3);
    assert!((cr3 - fe3 / 3.0).abs() < 4.0e-5, "one chromium(III) for three iron(III): {} vs {}", cr3, fe3 / 3.0);
    assert!((cr6 - (4.0e-4 - cr3)).abs() < 4.0e-5, "the rest of the chromium stays hexavalent: {} mol", cr6);
    // atoms and charge are conserved
    let cons = v.snapshot().conservation;
    assert!(cons.ok, "atoms and charge are conserved: {:?}", cons.element_errors);
}

// ------------------------------------------------------------------------------------------------ E5 (acid-base + partition)

mod extraction {
    use super::*;
    use reaction_chamber_engine::chem_db;
    use reaction_chamber_engine::compound_model::*;

    pub fn import(req: CompoundRequest) -> CompoundModel {
        let m = model_compound(&req);
        assert!(m.modelable, "{}: {}", req.id, m.reason);
        chem_db::register_custom_reagent(m.entry.clone().expect("entry"));
        if let Some(c) = &m.compound {
            chem_db::register_custom_compound(c.clone());
        }
        if let Some(min) = &m.mineral {
            chem_db::register_custom_mineral(min.clone());
        }
        for eq in &m.equilibria {
            chem_db::register_custom_equilibrium(eq.clone());
        }
        m
    }
}

/// A weak organic acid distributes between water and an immiscible solvent as its neutral form; the aqueous dissociation
/// pulls it into the water as the pH rises (acid-base equilibria in the water phase coupled with the partition of the
/// neutral molecule), and acid pulls it back out.
#[test]
fn a_weak_acid_is_extracted_into_the_organic_layer_only_while_it_is_neutral() {
    use extraction::*;
    use reaction_chamber_engine::compound_model::CompoundRequest;
    import(CompoundRequest {
        id: "e5_dcm".into(), name: "Dichloromethane".into(), formula: "CH2Cl2".into(), smiles: Some("ClCCl".into()), state: Some("liquid".into()), density: Some(1.33),
        t_melt_ref_k: Some(178.0), vapor_pressure_points: vec![[313.15, 101_325.0], [298.15, 58_000.0]], solubility_g_per_l: Some(13.0), ..Default::default()
    });
    import(CompoundRequest {
        id: "e5_ba".into(), name: "Benzoic acid".into(), formula: "C7H6O2".into(), smiles: Some("OC(=O)c1ccccc1".into()), state: Some("solid".into()), density: Some(1.27),
        t_melt_ref_k: Some(395.5), dh_fus_kj_mol: Some(18.0), solubility_g_per_l: Some(3.4), vapor_pressure_points: vec![[298.15, 0.1], [523.0, 101_325.0]], ..Default::default()
    });
    let run = |reagent: &str, ml: f64| -> (f64, f64, f64) {
        let mut v = beaker();
        dose_ml(&mut v, "water", 50.0);
        dose_ml(&mut v, reagent, ml);
        dose_ml(&mut v, "e5_dcm", 30.0);
        v.dose(DoseRequest { reagent_id: "e5_ba".into(), volume_ml: None, mass_g: Some(0.1), drops: None, temperature_k: None, solid_form: None }).unwrap();
        for _ in 0..240 {
            v.step(0.5).unwrap();
        }
        let in_org: f64 = v.extra_liquids.iter().map(|m| m.iter().filter(|(k, _)| k.starts_with("C7H6O2")).map(|(_, x)| *x).sum::<f64>()).sum();
        let in_aq: f64 = v.species_mol.iter().filter(|(k, _)| k.starts_with("C7H5O2") || k.starts_with("C7H6O2")).map(|(_, x)| *x).sum();
        (in_org, in_aq, v.current_ph())
    };
    let (org_acid, aq_acid, ph_acid) = run("hcl_0_1m", 5.0);
    let (org_base, aq_base, ph_base) = run("naoh_0_1m", 12.0);
    let frac_acid = org_acid / (org_acid + aq_acid).max(1e-12);
    let frac_base = org_base / (org_base + aq_base).max(1e-12);
    eprintln!("acid: pH {:.2} organic fraction {:.3}; base: pH {:.2} organic fraction {:.3}", ph_acid, frac_acid, ph_base, frac_base);
    assert!(ph_acid < 3.0 && ph_base > 7.0);
    assert!(frac_acid > 0.5, "neutral benzoic acid prefers dichloromethane: {}", frac_acid);
    assert!(frac_base < 0.05, "benzoate stays in the water: {}", frac_base);
}

/// The same for a base: an amine is protonated (and held in the water) in acid, free and extracted in base.
#[test]
fn a_weak_base_is_extracted_into_the_organic_layer_only_while_it_is_neutral() {
    use extraction::*;
    use reaction_chamber_engine::compound_model::CompoundRequest;
    import(CompoundRequest {
        id: "e5_dcm2".into(), name: "Dichloromethane".into(), formula: "CH2Cl2".into(), smiles: Some("ClCCl".into()), state: Some("liquid".into()), density: Some(1.33),
        t_melt_ref_k: Some(178.0), vapor_pressure_points: vec![[313.15, 101_325.0], [298.15, 58_000.0]], solubility_g_per_l: Some(13.0), ..Default::default()
    });
    import(CompoundRequest {
        id: "e5_an".into(), name: "Aniline".into(), formula: "C6H7N".into(), smiles: Some("Nc1ccccc1".into()), state: Some("liquid".into()), density: Some(1.02),
        t_melt_ref_k: Some(266.8), vapor_pressure_points: vec![[298.15, 65.0], [457.0, 101_325.0]], solubility_g_per_l: Some(36.0), ..Default::default()
    });
    let run = |reagent: &str, ml: f64| -> (f64, f64) {
        let mut v = beaker();
        dose_ml(&mut v, "water", 50.0);
        dose_ml(&mut v, reagent, ml);
        dose_ml(&mut v, "e5_dcm2", 30.0);
        dose_ml(&mut v, "e5_an", 0.5);
        for _ in 0..240 {
            v.step(0.5).unwrap();
        }
        let org: f64 = v.extra_liquids.iter().map(|m| m.iter().filter(|(k, _)| k.starts_with("C6H7N")).map(|(_, x)| *x).sum::<f64>()).sum();
        let aq: f64 = v.species_mol.iter().filter(|(k, _)| k.starts_with("C6H7N") || k.starts_with("C6H8N")).map(|(_, x)| *x).sum();
        (org / (org + aq).max(1e-12), v.current_ph())
    };
    let (f_acid, ph_acid) = run("hcl_1m", 10.0);
    let (f_base, ph_base) = run("naoh_0_1m", 5.0);
    eprintln!("acid: pH {:.2} organic fraction {:.3}; base: pH {:.2} organic fraction {:.3}", ph_acid, f_acid, ph_base, f_base);
    // (the neutral base is extracted ~100:1 by the UNIFAC activity coefficients, so even at pH 1 a tenth stays organic)
    assert!(f_acid < 0.25, "anilinium stays in the water: {}", f_acid);
    assert!(f_base > 0.9 && f_base > 4.0 * f_acid, "aniline goes to dichloromethane: {}", f_base);
}

// ------------------------------------------------------------------------------------------------ A1 (complexes before precipitation)

/// Mercury(II) in chloride at pH 8 stays dissolved as chloro complexes: the complexation rows are registered before the first
/// settle of the dose, so the hydroxide never precipitates on the free-ion product that the complexes do not allow.
#[test]
fn chloro_complexes_are_in_place_before_the_hydroxide_can_precipitate() {
    use reaction_chamber_engine::chem_db::ReagentCatalogEntry;
    let mut v = beaker();
    v.register_reagent(ReagentCatalogEntry {
        id: "hg_t".into(), name: "hg_t".into(), formula: "Hg(NO3)2".into(), form: "solution".into(), concentration_m: Some(0.01), density_g_ml: 1.0, ghs: vec![],
        signal_word: String::new(), bottle_colour: "clear".into(), composition: [("Hg+2".to_string(), 0.00001), ("NO3-".to_string(), 0.00002), ("H2O".to_string(), 0.0555)].into(),
        label: "Hg".into(), by_mass: false, dropper: None, inchi_key: None, solid_form: None, particle_um: None,
    });
    dose_ml(&mut v, "nacl_0_1m", 40.0);
    dose_ml(&mut v, "naoh_0_1m", 0.5);
    dose_ml(&mut v, "hg_t", 5.0);
    let solids: f64 = v.solid_mol.values().sum();
    assert!(solids < 1.0e-7, "no mercury solid forms while the chloro complexes hold the metal: {:?}", v.solid_mol);
    let complexed = ["HgCl+", "HgCl2", "HgCl3-", "HgCl4-2"].iter().map(|s| v.species_mol.get(*s).copied().unwrap_or(0.0)).sum::<f64>();
    assert!(complexed > 4.0e-5, "the mercury (5e-5 mol) is complexed: {}", complexed);
}

/// R7: ion pairs and hydroxo complexes are forms of the free cation, not redox partners of their own: adding them to a solution
/// does not multiply the discovered reactions.
#[test]
fn derived_ion_forms_do_not_multiply_the_redox_candidates() {
    use reaction_chamber_engine::gem::discovery::discover_reactions;
    use reaction_chamber_engine::gem::redox::is_derived_ion_form;
    let base: std::collections::HashMap<String, f64> =
        [("H2O", 55.0), ("H+", 0.1), ("Fe+2", 0.01), ("Cr2O7-2", 0.002), ("SO4-2", 0.01), ("Cl-", 0.1)].iter().map(|(k, v)| (k.to_string(), *v)).collect();
    let mut rich = base.clone();
    for (sp, n) in [("FeSO4", 0.004), ("FeSO4+", 0.0001), ("FeOH+2", 0.0001), ("Fe(OH)2+", 0.0001), ("CrSO4+", 0.0001)] {
        rich.insert(sp.to_string(), n);
    }
    let none = std::collections::HashMap::new();
    let n_base = discover_reactions(&base, &none, 298.15, 101_325.0).len();
    let n_rich = discover_reactions(&rich, &none, 298.15, 101_325.0).len();
    assert!(n_base > 0);
    assert_eq!(n_rich, n_base, "the pairs and hydroxo complexes add no candidates ({} vs {})", n_rich, n_base);
    for sp in ["FeSO4", "FeSO4+", "FeOH+2", "CrSO4+"] {
        assert!(is_derived_ion_form(sp), "{}", sp);
    }
    for sp in ["Fe+2", "Cr2O7-2", "MnO4-", "Fe(CN)6-3", "Cu(NH3)4+2", "SO4-2"] {
        assert!(!is_derived_ion_form(sp), "{}", sp);
    }
}
