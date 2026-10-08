//! Gates for the fifth pass (ALGORITHM-IMPROVEMENT.md 6.6): carbonyl addition, aldol, electrophilic aromatic substitution and
//! acyl substitution as data templates, Hammett-Brown rates, thermodynamic screening of the expansion, aromaticity perception,
//! and organic oxidation by redox discovery.

use std::collections::HashMap;

use reaction_chamber_engine::network_generator::{register_or_find_species, resolve_molecule, GeneratedNetwork, NetworkGenerator, NetworkGeneratorConfig};
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
    register_or_find_species(&smiles::parse(smi).expect("valid SMILES").perceived())
}

fn generate(species: &[(&str, f64)], ph: f64) -> GeneratedNetwork {
    let concs: HashMap<String, f64> = species.iter().map(|(s, c)| (s.to_string(), *c)).collect();
    NetworkGenerator::new(NetworkGeneratorConfig::default()).generate_network(&concs, 298.15, ph)
}

fn fam<'a>(net: &'a GeneratedNetwork, family: &str) -> Vec<&'a reaction_chamber_engine::network_generator::GeneratedReaction> {
    net.reactions.iter().chain(net.edge.iter()).filter(|r| r.family_id == family).collect()
}

fn aqueous(species: &[(&str, f64)]) -> Vessel {
    let mut v = beaker();
    v.species_mol.insert("H2O".into(), 100.0 / 18.015);
    for (s, mol) in species {
        v.species_mol.insert(s.to_string(), *mol);
    }
    v
}

fn run(v: &mut Vessel, seconds: f64, dt: f64) {
    for _ in 0..(seconds / dt) as usize {
        v.step(dt).unwrap();
    }
}

/// A compound the code has never heard of (butanal) hydrates; ketones are slower than aldehydes by orders of magnitude, and
/// formaldehyde faster; K comes from the species data; hydrates of hydrates do not enter the network.
#[test]
fn carbonyl_hydration_follows_structure() {
    let butanal = id_of("CCCC=O");
    let net = generate(&[(&butanal, 0.1), ("H2O", 55.5), ("H+", 1e-7), ("OH-", 1e-7)], 7.0);
    let hyd = fam(&net, "carbonyl_hydration");
    assert!(hyd.len() >= 3, "neutral, acid and base paths: {}", hyd.len());
    assert!(hyd.iter().all(|r| r.k_eq_from_data && r.k_eq > 0.0));
    let ketone = id_of("CCC(=O)CC");
    let formaldehyde = id_of("C=O");
    let k_neutral = |sp: &str| -> f64 {
        let n = generate(&[(sp, 0.1), ("H2O", 55.5)], 7.0);
        fam(&n, "carbonyl_hydration").iter().filter(|r| r.orders.get("H+").is_none() && r.orders.get("OH-").is_none()).map(|r| r.k_fwd).fold(0.0, f64::max)
    };
    let (ka, kk, kf) = (k_neutral(&butanal), k_neutral(&ketone), k_neutral(&formaldehyde));
    assert!(ka > 50.0 * kk && kf > 100.0 * ka, "formaldehyde {:e} > aldehyde {:e} > ketone {:e}", kf, ka, kk);
    // the hydrate's own OH groups are not nucleophiles for hemiacetal growth, and no species exceeds the size cap
    for r in net.reactions.iter().chain(net.edge.iter()) {
        for p in r.products.keys() {
            if let Some(m) = resolve_molecule(p) {
                assert!(m.atoms.len() <= 20, "{} has {} heavy atoms", p, m.atoms.len());
            }
        }
    }
}

/// Acetaldehyde in water reaches the equilibrium of its own K (from the species data) and conserves its carbon.
#[test]
fn aldehyde_hydrate_equilibrates_at_the_data_k() {
    let ald = id_of("CC=O");
    let mut v = aqueous(&[(&ald, 0.01), ("H+", 1e-3), ("Cl-", 1e-3)]);
    v.update_network();
    let hyd_rxn = v.kinetic_reactions.iter().find(|r| r.id.starts_with("carbonyl_hydration") && r.reactants.contains_key(&ald)).expect("hydration is in the network").clone();
    let hydrate = hyd_rxn.products.keys().next().unwrap().clone();
    let k_eq = hyd_rxn.k_eq_298.expect("K from data");
    run(&mut v, 600.0, 1.0);
    let (a, h) = (v.species_mol[&ald], v.species_mol.get(&hydrate).copied().unwrap_or(0.0));
    assert!(h > 0.0 && a > 0.0);
    let q = h / a;
    assert!((q / k_eq - 1.0).abs() < 0.15, "Q = {:e}, K = {:e}", q, k_eq);
    let carbon: f64 = v.species_mol.iter().filter_map(|(k, &n)| resolve_molecule(k).map(|m| n * m.atoms.iter().filter(|x| x.element == "C").count() as f64)).sum();
    // acetaldehyde boils at 20 C and the bench is at 25 C: a few percent of this 0.2 M solution leave the open vessel in
    // ten minutes (it was a few tenths at the 22 C room of an earlier version); the rest is conserved
    assert!(carbon <= 0.02 * (1.0 + 1e-9) && carbon > 0.02 * 0.94, "carbon {:e}", carbon);
}

/// Base-catalysed aldol addition then dehydration to the enone for an aldehyde the code has never seen; a ketone with no
/// hydroxide does nothing.
#[test]
fn aldol_runs_only_with_base() {
    let butanal = id_of("CCCC=O");
    let net = generate(&[(&butanal, 0.5), ("H2O", 55.5), ("OH-", 0.05)], 12.7);
    let ald = fam(&net, "aldol_addition");
    assert!(ald.iter().any(|r| r.orders.get("OH-") == Some(&1.0)), "OH- first order");
    let dim = ald.iter().find(|r| r.reactants.contains_key(&butanal)).expect("self-aldol");
    let p = resolve_molecule(dim.products.keys().next().unwrap()).unwrap();
    assert_eq!(p.formula(), "C8H16O2");
    assert!(!fam(&net, "aldol_dehydration").is_empty(), "the aldol dehydrates (E1cB)");
    let neutral = generate(&[(&butanal, 0.5), ("H2O", 55.5), ("H+", 1e-7), ("OH-", 1e-7)], 7.0);
    let k_base = ald.iter().map(|r| r.k_fwd).fold(0.0, f64::max);
    let k_neutral = fam(&neutral, "aldol_addition").iter().map(|r| r.k_fwd).fold(0.0, f64::max);
    assert!(k_base > 1.0e5 * k_neutral, "pH 12.7 vs 7: {:e} vs {:e}", k_base, k_neutral);
}

/// Electrophilic aromatic substitution: the Hammett-Brown relation makes phenol brominate in seconds, benzene not at all on
/// the bench, nitrobenzene meta only; ortho / para are the fast positions of phenol; HBr appears as H+ and Br-.
#[test]
fn bromination_follows_the_hammett_relation() {
    let phenol = id_of("Oc1ccccc1");
    let benzene = id_of("c1ccccc1");
    let br2 = id_of("BrBr");
    let net = generate(&[(&phenol, 0.01), (&br2, 0.005), ("H2O", 55.5)], 7.0);
    let mono: Vec<_> = fam(&net, "eas_halogenation").into_iter().filter(|r| r.reactants.contains_key(&phenol)).collect();
    assert!(mono.len() >= 3, "ortho, meta, para: {}", mono.len());
    let mut k: Vec<f64> = mono.iter().map(|r| r.k_fwd).collect();
    k.sort_by(|a, b| b.partial_cmp(a).unwrap());
    assert!(k[0] > 10.0 && k[0] / k[k.len() - 1] > 1e6, "o / p fast, m slow: {:?}", k);
    assert!(mono.iter().all(|r| r.products.contains_key("Br-") && r.products.contains_key("H+")));
    let nb = generate(&[(&benzene, 0.01), (&br2, 0.005), ("H2O", 55.5)], 7.0);
    let kb = fam(&nb, "eas_halogenation").iter().map(|r| r.k_fwd).fold(0.0, f64::max);
    assert!(kb < 1e-5, "benzene brominates negligibly without a catalyst: {:e}", kb);
    // in a vessel phenol + Br2 goes to bromophenols within a minute and Br2 is used up
    let mut v = aqueous(&[(&phenol, 0.002), (&br2, 0.001)]);
    v.update_network();
    run(&mut v, 60.0, 0.5);
    assert!(v.species_mol.get(&br2).copied().unwrap_or(0.0) < 1e-5, "Br2 left: {:?}", v.species_mol.get(&br2));
    assert!(v.species_mol.get("Br-").copied().unwrap_or(0.0) > 0.9e-3, "one Br- per Br2 used");
    // Kekule benzene (as PubChem writes it) is aromatic, not an alkene: no halogen addition across a double bond
    let kek = register_or_find_species(&smiles::parse("C1=CC=CC=C1").unwrap());
    let kn = generate(&[(&kek, 0.01), (&br2, 0.005), ("H2O", 55.5)], 7.0);
    assert!(fam(&kn, "alkene_halogenation").is_empty() && !fam(&kn, "eas_halogenation").is_empty());
}

/// Acyl halides and anhydrides hydrolyse by structure alone: the chloride in seconds, the anhydride in minutes; acetic acid
/// and HCl result.
#[test]
fn acyl_substitution_rates_follow_the_leaving_group() {
    let acl = id_of("CC(=O)Cl");
    let anh = id_of("CC(=O)OC(C)=O");
    let mut v = aqueous(&[(&acl, 0.01), (&anh, 0.01)]);
    v.update_network();
    run(&mut v, 10.0, 0.1);
    let (c10, a10) = (v.species_mol[&acl], v.species_mol[&anh]);
    assert!(c10 < 5e-4, "acetyl chloride after 10 s: {:e}", c10);
    assert!(a10 > 0.008, "the anhydride survives 10 s: {:e}", a10);
    run(&mut v, 1200.0, 1.0);
    assert!(v.species_mol[&anh] < 0.002, "anhydride after 20 min: {:e}", v.species_mol[&anh]);
    assert!(v.species_mol.get("Cl-").copied().unwrap_or(0.0) > 9e-3);
}

/// The expansion screens candidates by their net flux: an adduct whose K is far below what the concentrations could reach
/// does not enter the network, and a base-catalysed ketone network stays below the species cap.
#[test]
fn expansion_is_bounded_by_thermodynamics_and_size() {
    let acetone = id_of("CC(C)=O");
    let net = generate(&[(&acetone, 0.1), ("H2O", 55.5), ("OH-", 0.1)], 13.0);
    assert!(net.active_species.len() < 150, "{} species", net.active_species.len());
    for r in &net.reactions {
        if r.k_eq_from_data {
            assert!(r.k_eq > 1e-15, "{} has K {:e} and cannot have a net flux", r.id, r.k_eq);
        }
    }
}

/// Organic oxidation through redox discovery: ethanol and isopropanol reduce permanganate on the minutes scale in acid
/// (the class rate scale of the oxidation templates), the secondary alcohol faster; tert-butanol has no alpha hydrogen and
/// no oxidised form; nothing oxidises in plain air. (The acid is sulfuric: permanganate oxidises the chloride of a hydrochloric
/// acid background, the interference that keeps analysts from using HCl in permanganate work, which since the eighth pass the
/// engine reproduces, so the control with tert-butanol would no longer be inert.)
#[test]
fn alcohols_are_oxidised_by_permanganate_but_not_by_air() {
    let rate = |smi: &str| -> f64 {
        let alc = id_of(smi);
        let mut v = aqueous(&[(&alc, 0.005), ("MnO4-", 2e-4), ("K+", 2e-4), ("H+", 0.01), ("SO4-2", 0.005)]);
        v.update_network();
        run(&mut v, 60.0, 0.5);
        let m = v.species_mol.get("MnO4-").copied().unwrap_or(0.0);
        (2e-4 / m.max(1e-12)).ln() / 60.0
    };
    let (e, ip, tb) = (rate("CCO"), rate("CC(C)O"), rate("CC(C)(C)O"));
    assert!(e > 3e-4 && e < 3e-2, "ethanol: {:e} /s", e);
    assert!(ip > 1.5 * e, "secondary faster than primary: {:e} vs {:e}", ip, e);
    assert!(tb < 0.02 * e, "tert-butanol: {:e}", tb);
    // the product is the carbonyl compound / acid, with the element balance kept
    let alc = id_of("CC(C)O");
    let mut v = aqueous(&[(&alc, 0.005), ("MnO4-", 4e-4), ("K+", 4e-4), ("H+", 0.01), ("SO4-2", 0.005)]);
    v.update_network();
    run(&mut v, 300.0, 0.5);
    // acetone, or its hydrate (the group-additivity K of a ketone hydrate is orders of magnitude too high: a known limit)
    let formed = |v: &Vessel| -> f64 { v.species_mol.iter().filter(|(k, _)| resolve_molecule(k).map_or(false, |m| matches!(m.formula().as_str(), "C3H6O" | "C3H8O2"))).map(|(_, &n)| n).sum() };
    assert!(formed(&v) > 2e-4, "acetone formed: {:e}", formed(&v));
    // air alone: dissolved O2 oxidises neither
    let mut air = aqueous(&[(&alc, 0.05)]);
    air.update_network();
    run(&mut air, 600.0, 1.0);
    assert!(formed(&air) < 1e-6, "no oxidation by air");
}
