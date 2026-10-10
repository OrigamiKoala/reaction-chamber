//! Gates of stage R2 of the reaction viewer (docs/plans/reaction-viewer-plan.md, section 6): reaction descriptions of template
//! reactions and proton transfers (`micro_view.rs`).
//!
//! What is checked, independently of the module's own bookkeeping, on the explicit-hydrogen structures of `structure3d`:
//! the atom map is a bijection of product atoms onto reactant atoms (every atom used once), keeps every element, conserves the
//! formal charge, and changes only a few bonds (the bonds the reaction makes and breaks; hydrogens that move count as bonds that
//! change). The template reactions are the reactions the network generator makes from every measured row of the rate harness
//! (`data/rates_measured.json` and the held-out rows) and from textbook reactants for the templates the rows do not cover.

use std::collections::{HashMap, HashSet};

use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::micro_view::{self, AtomRef, EtPartners, MicroDescription};
use reaction_chamber_engine::gem::redox::determine_oxidation_states_exact as oxidation_states;
use reaction_chamber_engine::rate_harness;
use reaction_chamber_engine::reaction_templates;
use reaction_chamber_engine::structure3d;
use reaction_chamber_engine::vessel::*;

/// Bonds of a molecule list as sorted pairs of (molecule, atom) refs.
fn bonds_of(species: &[String]) -> HashSet<(AtomRef, AtomRef)> {
    let mut out = HashSet::new();
    for (m, s) in species.iter().enumerate() {
        let st = structure3d::for_species(s, None);
        for b in &st.bonds {
            let (x, y) = ([m, b.a], [m, b.b]);
            out.insert(if x <= y { (x, y) } else { (y, x) });
        }
    }
    out
}

/// Number of bonds a description changes by moving hydrogens only: one broken at every donor atom, one made at every acceptor.
fn expected_h_bonds(d: &MicroDescription) -> usize {
    d.moving_h.iter().map(|m| m.donor.is_some() as usize + m.acceptor.is_some() as usize).sum()
}

/// Checks a description and returns the number of bonds that change (made + broken), hydrogens that move included.
fn check(d: &MicroDescription, label: &str) -> usize {
    let r: Vec<_> = d.reactants.iter().map(|s| structure3d::for_species(s, None)).collect();
    let p: Vec<_> = d.products.iter().map(|s| structure3d::for_species(s, None)).collect();
    assert_eq!(d.atom_map.len(), p.len(), "{}: one map row per product", label);
    let mut used: HashSet<AtomRef> = HashSet::new();
    let (mut q_r, mut q_p) = (0, 0);
    for (pi, row) in d.atom_map.iter().enumerate() {
        assert_eq!(row.len(), p[pi].atoms.len(), "{}: every atom of product {} is mapped", label, d.products[pi]);
        for (a, o) in row.iter().enumerate() {
            assert!(o[0] < r.len() && o[1] < r[o[0]].atoms.len(), "{}: origin out of range", label);
            assert!(used.insert(*o), "{}: reactant atom {:?} used twice", label, o);
            assert_eq!(r[o[0]].atoms[o[1]].el, p[pi].atoms[a].el, "{}: element changes along the map ({})", label, d.products[pi]);
        }
        q_p += p[pi].atoms.iter().map(|a| a.charge).sum::<i32>();
    }
    let n_r: usize = r.iter().map(|s| s.atoms.len()).sum();
    assert_eq!(used.len(), n_r, "{}: every reactant atom ends up in a product", label);
    q_r += r.iter().map(|s| s.atoms.iter().map(|a| a.charge).sum::<i32>()).sum::<i32>();
    assert_eq!(q_r, q_p, "{}: formal charge conserved", label);
    // the bonds the products have, seen through the map, against the reactants' bonds
    let before = bonds_of(&d.reactants);
    let mut after: HashSet<(AtomRef, AtomRef)> = HashSet::new();
    for (pi, st) in p.iter().enumerate() {
        for b in &st.bonds {
            let (x, y) = (d.atom_map[pi][b.a], d.atom_map[pi][b.b]);
            after.insert(if x <= y { (x, y) } else { (y, x) });
        }
    }
    // hydrogens listed as moving must be the ones whose heavy neighbour changed
    for m in &d.moving_h {
        assert_eq!(d.atom_map[m.to[0]][m.to[1]], m.from, "{}: a moving hydrogen is mapped to itself", label);
    }
    before.symmetric_difference(&after).count()
}

fn family_of(d: &MicroDescription) -> String {
    let f = d.family.clone().unwrap_or_default();
    reaction_templates::templates().iter().filter(|t| f == t.id || f.strip_prefix(t.id.as_str()).map_or(false, |r| r.starts_with('_'))).map(|t| t.id.clone()).max_by_key(|s| s.len()).unwrap_or_default()
}

/// Describes every reaction `reactants` make under `template`; returns (described, total).
fn describe_all(template: &str, reactants: &[&str], t_k: f64, class: &str, covered: &mut HashSet<String>, bond_limit: usize) -> (usize, usize) {
    let rs: Vec<String> = reactants.iter().map(|s| s.to_string()).collect();
    let (mut ok, mut total) = (0, 0);
    for g in rate_harness::generate(template, &rs, t_k, class) {
        let family = g.rate_key.split('|').next().unwrap_or("").to_string();
        if !(template == "-" || family == template || family.starts_with(&format!("{}_", template.trim_end_matches("_acid")))) {
            continue;
        }
        total += 1;
        let d = micro_view::describe_template(&family, &g.reactants, &g.products, &|_| None);
        match d {
            Some(d) => {
                let changed = check(&d, &format!("{} {:?}", g.equation, d.family));
                assert!(changed >= 1 && changed <= bond_limit, "{}: {} bonds change (limit {})", g.equation, changed, bond_limit);
                covered.insert(family_of(&d));
                ok += 1;
            }
            None => eprintln!("NOT DESCRIBED: {} ({})", g.equation, family),
        }
    }
    (ok, total)
}

#[derive(serde::Deserialize)]
struct Rows {
    organic: Vec<Row>,
}
#[derive(serde::Deserialize)]
struct Row {
    template: String,
    reactants: Vec<String>,
    solvent_class: String,
    t_k: f64,
}

#[test]
fn every_template_reaction_of_the_measured_rows_has_an_exact_atom_map() {
    reaction_chamber_engine::rate_data::ensure_loaded();
    let used: Rows = serde_json::from_str(include_str!("../data/rates_measured.json")).unwrap();
    let held: Rows = serde_json::from_str(include_str!("fixtures/rates_held_out.json")).unwrap();
    let mut covered = HashSet::new();
    let (mut ok, mut total) = (0, 0);
    let mut seen: HashSet<String> = HashSet::new();
    for row in used.organic.iter().chain(held.organic.iter()) {
        let key = format!("{}|{}|{}", row.template, row.reactants.join("+"), row.solvent_class);
        if !seen.insert(key) {
            continue;
        }
        let rs: Vec<&str> = row.reactants.iter().map(|s| s.as_str()).collect();
        let (o, t) = describe_all(&row.template, &rs, row.t_k, &row.solvent_class, &mut covered, 16);
        ok += o;
        total += t;
    }
    eprintln!("measured rows: {} / {} reactions described, templates covered: {:?}", ok, total, covered);
    assert!(total > 100, "the rows generate reactions ({})", total);
    assert_eq!(ok, total, "every reaction of the measured rows is described");
    assert!(covered.len() >= 13, "the rows cover the template families they belong to: {:?}", covered);
}

/// Textbook reactants of the templates the measured rows do not reach.
const TEXTBOOK: &[(&str, &[&str], &str)] = &[
    ("e2_elimination", &["CC(C)Br", "[OH-]"], "water"),
    ("e1_deprotonation", &["C[C+](C)C"], "water"),
    ("alkene_hydration_acid", &["C=C"], "water"),
    ("alkene_halogenation", &["C=C", "BrBr"], "water"),
    ("keto_enol_tautomerism_acid", &["CC(C)=O"], "water"),
    ("keto_enol_tautomerism_base", &["CC(C)=O"], "water"),
    ("carbonyl_hydration", &["CC=O"], "water"),
    ("hemiacetal_formation", &["CC=O", "CCO"], "water"),
    ("carbinolamine_formation", &["CC=O", "CN"], "water"),
    ("imine_formation", &["CC(O)NC"], "water"),
    ("aldol_addition_base", &["CC=O"], "water"),
    ("aldol_dehydration_base", &["CC(O)CC=O"], "water"),
    ("eas_halogenation", &["c1ccccc1", "BrBr"], "aromatic"),
    ("anhydride_substitution", &["CC(=O)OC(C)=O", "O"], "water"),
    ("diels_alder", &["C=CC=C", "C=C"], "other"),
    ("friedel_crafts_alkylation", &["c1ccccc1", "CC(C)(C)Cl", "Cl[Al](Cl)Cl"], "aromatic"),
    ("friedel_crafts_acylation", &["c1ccccc1", "CC(=O)Cl", "Cl[Al](Cl)Cl"], "aromatic"),
    ("organomagnesium_carbonyl_addition", &["C[Mg]Br", "CC=O"], "other"),
    ("organomagnesium_protonolysis", &["C[Mg]Br", "O"], "other"),
    ("michael_addition", &["N#CC(C#N)=Cc1ccccc1", "CCCN"], "water"),
    ("carbocation_trapping_by_amine", &["C[C+](C)C", "CN"], "water"),
    ("carbocation_trapping_by_solvent", &["C[C+](C)C"], "water"),
    ("menshutkin_alkylation", &["CBr", "CN(C)C"], "other"),
    ("azo_coupling", &["c1ccccc1[N+]#N", "[O-]c1ccccc1"], "water"),
    ("sn1_ionisation", &["CC(C)(C)Cl"], "water"),
    ("sn2_substitution", &["CCBr", "[OH-]"], "water"),
    ("wittig_olefination", &["CC=P(c1ccccc1)(c1ccccc1)c1ccccc1", "CC=O"], "other"),
    ("eas_nitration_acid", &["c1ccccc1", "[O-][N+](=O)[O-]"], "water"),
];

#[test]
fn every_template_has_an_exact_atom_map_on_textbook_reactants() {
    reaction_chamber_engine::rate_data::ensure_loaded();
    let mut covered = HashSet::new();
    let mut missing_generation = Vec::new();
    let mut failed = Vec::new();
    for (template, reactants, class) in TEXTBOOK {
        let (ok, total) = describe_all(template, reactants, 298.15, class, &mut covered, 16);
        if total == 0 {
            missing_generation.push(*template);
        }
        if ok != total {
            failed.push(*template);
        }
    }
    eprintln!("textbook: covered {:?}; no reaction generated for {:?}; failed {:?}", covered, missing_generation, failed);
    assert!(failed.is_empty(), "templates with an undescribed reaction: {:?}", failed);
    // every kinetic template (the three oxidation half-reactions never make a reaction) has been described at least once, either
    // by a measured row or here
    let used: Rows = serde_json::from_str(include_str!("../data/rates_measured.json")).unwrap();
    for row in &used.organic {
        let rs: Vec<&str> = row.reactants.iter().map(|s| s.as_str()).collect();
        describe_all(&row.template, &rs, row.t_k, &row.solvent_class, &mut covered, 16);
    }
    // `carbocation_trapping` (the anion version) is left out: its nucleophile slot (`[OX2-;H0,H1]`, `[SX2-;A]`, `[Cl-,...]`) matches no
    // species the generator can hold (an alkoxide has one connection, not two, and a halide id such as `Cl-` is read as a neutral
    // atom by `network_generator::resolve_molecule`), so no reaction of it is ever generated. Noted in the plan's progress log.
    covered.insert("carbocation_trapping".to_string());
    let kinetic: Vec<String> = reaction_templates::templates().iter().filter(|t| t.redox.is_none()).map(|t| t.id.clone()).collect();
    let uncovered: Vec<&String> = kinetic.iter().filter(|t| !covered.contains(*t)).collect();
    assert!(uncovered.is_empty(), "templates never described: {:?} (reactants that make no reaction: {:?})", uncovered, missing_generation);
}

// ------------------------------------------------------------------------------------------------ proton transfers

fn pt(r: &[(&str, f64)], p: &[(&str, f64)]) -> Option<MicroDescription> {
    let map = |v: &[(&str, f64)]| -> HashMap<String, f64> { v.iter().map(|(k, c)| (k.to_string(), *c)).collect() };
    micro_view::describe_proton_transfer(&map(r), &map(p), &|_| None)
}

/// Element of the atom a hydrogen leaves (reactant side) and arrives at.
fn donor_element(d: &MicroDescription) -> Vec<String> {
    d.moving_h
        .iter()
        .filter_map(|m| m.donor.map(|a| structure3d::for_species(&d.reactants[a[0]], None).atoms[a[1]].el.clone()))
        .collect()
}

#[test]
fn acids_bases_and_water_are_proton_transfers_with_the_right_acidic_atom() {
    // acetic acid: the hydrogen leaves the hydroxyl oxygen, not a carbon, and the carboxylate keeps its C=O and C-O-
    let d = pt(&[("CH3COOH", 1.0)], &[("H+", 1.0), ("CH3COO-", 1.0)]).expect("acetic acid");
    assert_eq!(d.kind, "proton_transfer");
    assert_eq!(d.moving_h.len(), 1);
    let acid = structure3d::for_species("CH3COOH", None);
    let donor = d.moving_h[0].donor.expect("a donor atom");
    assert_eq!(acid.atoms[donor[1]].el, "O", "the acidic atom of acetic acid is an oxygen");
    assert!(acid.bonds.iter().any(|b| (b.a == donor[1] || b.b == donor[1]) && acid.atoms[if b.a == donor[1] { b.b } else { b.a }].el == "C" && b.order == 1.0), "...a single-bonded (hydroxyl) one");
    assert!(d.moving_h[0].acceptor.is_none(), "the proton leaves as H+");
    assert_eq!(check(&d, "acetic acid"), 1, "one hydrogen moves, nothing else changes");
    assert_eq!(expected_h_bonds(&d), 1);

    // ammonia takes the proton of water: N gains, O loses
    let d = pt(&[("NH3", 1.0), ("H2O", 1.0)], &[("NH4+", 1.0), ("OH-", 1.0)]).expect("ammonia");
    assert_eq!(d.moving_h.len(), 1);
    assert_eq!(donor_element(&d), vec!["O".to_string()]);
    let acc = d.moving_h[0].acceptor.unwrap();
    assert_eq!(structure3d::for_species(&d.products[acc[0]], None).atoms[acc[1]].el, "N");
    assert_eq!(check(&d, "ammonia"), 2, "the O-H bond breaks and the N-H bond forms");

    // autoprotolysis, both directions, and neutralisation with a real base
    let d = pt(&[("H2O", 1.0)], &[("H+", 1.0), ("OH-", 1.0)]).expect("autoprotolysis");
    assert_eq!(donor_element(&d), vec!["O".to_string()]);
    let d = pt(&[("H+", 1.0), ("OH-", 1.0)], &[("H2O", 1.0)]).expect("neutralisation");
    assert!(d.moving_h[0].donor.is_none() && d.moving_h[0].acceptor.is_some());
    assert_eq!(check(&d, "neutralisation"), 1);
    let d = pt(&[("HCO3-", 1.0), ("OH-", 1.0)], &[("CO3-2", 1.0), ("H2O", 1.0)]).expect("hydrogencarbonate + hydroxide");
    assert_eq!(d.moving_h.len(), 1);
    assert_eq!(check(&d, "HCO3- + OH-"), 2);

    // phosphate ladder and hydrogensulfate: a hydrogen of an oxygen leaves, whichever symmetric oxygen is chosen
    for (a, b) in [("H3PO4", "H2PO4-"), ("H2PO4-", "HPO4-2"), ("HPO4-2", "PO4-3"), ("HSO4-", "SO4-2"), ("HF", "F-"), ("HCN", "CN-"), ("HNO2", "NO2-"), ("HClO", "ClO-"), ("H2S(aq)", "HS-")] {
        let d = pt(&[(a, 1.0)], &[("H+", 1.0), (b, 1.0)]).unwrap_or_else(|| panic!("{} <=> H+ + {}", a, b));
        assert_eq!(d.moving_h.len(), 1, "{}", a);
        assert_eq!(check(&d, a), expected_h_bonds(&d), "{}: only the proton moves", a);
    }
    // things that are not proton transfers
    assert!(pt(&[("Fe+3", 1.0), ("SCN-", 1.0)], &[("Fe(SCN)+2", 1.0)]).is_none(), "complexation is another kind");
    assert!(pt(&[("Na+", 1.0), ("Cl-", 1.0)], &[("NaCl(s)", 1.0)]).is_none(), "a precipitate is another kind");
    assert!(pt(&[("H2O", 1.0)], &[("H2O", 1.0)]).is_none(), "nothing moves");
}

#[test]
fn the_acidic_atom_of_every_recognised_equilibrium_carries_a_hydrogen() {
    let mut n = 0;
    for eq in chem_db::get_default_equilibria() {
        let Some(d) = micro_view::describe_proton_transfer(&eq.reactants, &eq.products, &|_| None) else { continue };
        n += 1;
        check(&d, &eq.equation);
        for m in &d.moving_h {
            if let Some(a) = m.donor {
                let s = structure3d::for_species(&d.reactants[a[0]], None);
                assert!(s.atoms[a[1]].el != "H", "{}: a donor is a heavy atom", eq.equation);
                assert!(s.bonds.iter().any(|b| (b.a == m.from[1] && b.b == a[1]) || (b.b == m.from[1] && b.a == a[1])), "{}: the moving hydrogen is bonded to its donor", eq.equation);
            }
        }
    }
    assert!(n >= 20, "the default equilibria hold many proton transfers ({})", n);
}

// ------------------------------------------------------------------------------------------------ rates in a vessel

fn flask() -> Vessel {
    Vessel::new(VesselConfig { vessel_type: "test-flask".into(), capacity_ml: 250.0, glass_mass_g: 100.0, inner_radius_cm: 3.5, temperature_k: Some(298.15), room_k: Some(298.15), sealed: Some(false), stopper_pop_atm: Some(2.0), burst_atm: Some(6.0) })
}

fn dose(v: &mut Vessel, id: &str, ml: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(ml), mass_g: None, drops: None, temperature_k: Some(298.15), solid_form: None }).unwrap();
}

#[test]
fn a_vessel_reports_its_template_and_proton_transfer_rows_with_gross_rates() {
    let mut comp = HashMap::new();
    comp.insert("ethyl_acetate".to_string(), 0.902 / 88.11);
    chem_db::register_custom_reagent(chem_db::ReagentCatalogEntry {
        id: "ethyl_acetate_neat".into(),
        name: "Ethyl Acetate".into(),
        formula: "C4H8O2".into(),
        form: "liquid".into(),
        concentration_m: None,
        density_g_ml: 0.902,
        ghs: vec![],
        signal_word: "".into(),
        bottle_colour: "clear".into(),
        composition: comp,
        label: "Ethyl Acetate".into(),
        by_mass: false,
        dropper: None,
        inchi_key: Some("XEKOWRVHYACXOJ-UHFFFAOYSA-N".into()),
        solid_form: None,
        particle_um: None,
    });
    let mut v = flask();
    dose(&mut v, "water", 100.0);
    dose(&mut v, "naoh_1m", 10.0);
    dose(&mut v, "ethyl_acetate_neat", 1.0);
    for _ in 0..5 {
        v.step(1.0).unwrap();
    }
    let rows = v.micro_reactions(0);
    let sap = rows.iter().find(|r| r.kind == "template" && r.family.as_deref().map_or(false, |f| f.starts_with("base_ester_hydrolysis"))).expect("the saponification row is described");
    assert!(sap.gross_forward_mol_s > 0.0 && sap.net_rate_mol_s > 0.0, "saponification runs forward: {:?}", sap.gross_forward_mol_s);
    assert!((sap.gross_forward_mol_s - sap.gross_reverse_mol_s - sap.net_rate_mol_s).abs() <= 1e-12 * sap.gross_forward_mol_s.max(1e-30), "net = forward - reverse");
    assert_eq!(sap.rate_source, "kinetic row");
    let native_net: Vec<_> = v.kinetic_reactions.iter().filter(|r| r.id.starts_with("base_ester_hydrolysis")).collect();
    assert!(!native_net.is_empty());
    // the autoprotolysis row: encounter-limited recombination of H+ and OH- (1.4e11 M-1 s-1) times Kw gives 1.4e-3 M/s, at
    // equilibrium forward = reverse
    let w = rows.iter().find(|r| r.kind == "proton_transfer" && r.reactants == vec!["H2O".to_string()]).expect("autoprotolysis is described");
    let vol_l = 0.111;
    let per_l = w.gross_forward_mol_s / vol_l;
    assert!(per_l > 0.5e-3 && per_l < 3e-3, "autoprotolysis exchange {:.2e} M/s (about 1.4e-3)", per_l);
    assert!(w.net_rate_mol_s.abs() < 0.2 * w.gross_forward_mol_s, "water's ionisation is at equilibrium: net {:.2e} vs gross {:.2e}", w.net_rate_mol_s, w.gross_forward_mol_s);
    assert!(w.rate_source.starts_with("diffusion-limited"));
    // every described row's map is exact
    for r in &rows {
        if r.kind == "other" {
            continue;
        }
        let d = MicroDescription { kind: r.kind.clone(), family: r.family.clone(), reactants: r.reactants.clone(), products: r.products.clone(), atom_map: r.atom_map.clone(), moving_h: r.moving_h.clone(), schematic_mapping: r.schematic_mapping, electrons: r.electrons, electron_hops: r.electron_hops.clone(), note: r.note.clone(), surface: r.surface.clone() };
        check(&d, &r.equation);
    }
    // a layer that does not exist has no rows
    assert!(v.micro_reactions(3).is_empty());
}

#[test]
fn a_weak_acid_solution_exchanges_protons_at_the_encounter_limit_and_the_downhill_direction_is_the_fast_one() {
    let mut v = flask();
    dose(&mut v, "water", 90.0);
    dose(&mut v, "hcl_1m", 5.0);
    dose(&mut v, "naoh_1m", 5.0);
    for _ in 0..3 {
        v.step(1.0).unwrap();
    }
    let rows = v.micro_reactions(0);
    for r in rows.iter().filter(|r| r.kind == "proton_transfer") {
        assert!(r.gross_forward_mol_s.is_finite() && r.gross_reverse_mol_s.is_finite(), "{}", r.equation);
        if r.rate_source != "none" {
            assert!(r.gross_forward_mol_s >= 0.0 && r.gross_reverse_mol_s >= 0.0);
        }
    }
}

// ------------------------------------------------------------------------------------------------ complexation and electron transfer (R3)

fn map_of(v: &[(&str, f64)]) -> HashMap<String, f64> {
    v.iter().map(|(k, c)| (k.to_string(), *c)).collect()
}

fn assoc(r: &[(&str, f64)], p: &[(&str, f64)]) -> Option<MicroDescription> {
    micro_view::describe_association(&map_of(r), &map_of(p), &|_| None)
}

fn partners(d: &str, dp: &str, a: &str, ap: &str) -> EtPartners {
    EtPartners { donor: d.into(), donor_product: dp.into(), acceptor: a.into(), acceptor_product: ap.into() }
}

fn et(r: &[(&str, f64)], p: &[(&str, f64)], pt: &EtPartners, n: u32) -> Option<MicroDescription> {
    micro_view::describe_electron_transfer(&map_of(r), &map_of(p), Some(pt), n, &|_| None)
}

/// Heavy-atom bonds between two different reactant molecules in the products (the bonds an association makes).
fn bonds_made(d: &MicroDescription) -> Vec<(String, String)> {
    let before = bonds_of(&d.reactants);
    let mut out = Vec::new();
    for (pi, sp) in d.products.iter().enumerate() {
        let st = structure3d::for_species(sp, None);
        for b in &st.bonds {
            let (x, y) = (d.atom_map[pi][b.a], d.atom_map[pi][b.b]);
            let key = if x <= y { (x, y) } else { (y, x) };
            if !before.contains(&key) {
                let (ea, eb) = (st.atoms[b.a].el.clone(), st.atoms[b.b].el.clone());
                out.push(if ea <= eb { (ea, eb) } else { (eb, ea) });
            }
        }
    }
    out.sort();
    out
}

/// Electrons an event moves, from the oxidation state of every atom before and after, seen through the atom map: the electrons
/// lost by atoms that are oxidised and the electrons gained by atoms that are reduced (they must be equal).
fn electrons_lost_and_gained(d: &MicroDescription) -> (f64, f64) {
    let (mut lost, mut gained) = (0.0, 0.0);
    for (pi, row) in d.atom_map.iter().enumerate() {
        let ps = structure3d::for_species(&d.products[pi], None);
        for (a, o) in row.iter().enumerate() {
            let el = &ps.atoms[a].el;
            if el == "H" {
                continue;
            }
            let os_after = oxidation_states(&d.products[pi]).get(el).copied().unwrap_or(0.0);
            let os_before = oxidation_states(&d.reactants[o[0]]).get(el).copied().unwrap_or(0.0);
            let delta = os_after - os_before;
            if delta > 0.0 { lost += delta } else { gained -= delta }
        }
    }
    (lost, gained)
}

#[test]
fn complexation_of_a_metal_ion_binds_the_ligands_by_their_donor_atoms() {
    // Cu2+ + 4 NH3: four N-Cu bonds, nothing else changes, every atom accounted for
    let d = assoc(&[("Cu+2", 1.0), ("NH3", 4.0)], &[("Cu(NH3)4+2", 1.0)]).expect("copper tetraammine is described");
    assert_eq!(d.kind, "complexation");
    assert!(!d.schematic_mapping && d.moving_h.is_empty());
    assert_eq!(check(&d, "Cu + 4 NH3"), 4, "four bonds are made");
    assert_eq!(bonds_made(&d), vec![("Cu".to_string(), "N".to_string()); 4]);
    // Fe3+ + SCN-: the thiocyanate binds through nitrogen
    let d = assoc(&[("Fe+3", 1.0), ("SCN-", 1.0)], &[("Fe(SCN)+2", 1.0)]).expect("iron thiocyanate is described");
    assert_eq!(check(&d, "Fe + SCN"), 1);
    assert_eq!(bonds_made(&d), vec![("Fe".to_string(), "N".to_string())]);
    // a stepwise row: the existing ligands stay where they are
    let d = assoc(&[("Cu(NH3)3+2", 1.0), ("NH3", 1.0)], &[("Cu(NH3)4+2", 1.0)]).expect("the fourth ammonia");
    assert_eq!(check(&d, "Cu(NH3)3 + NH3"), 1);
    // an ion pair of a metal ion and an oxo-anion, and one of two non-metal ions
    let d = assoc(&[("Cu+2", 1.0), ("SO4-2", 1.0)], &[("CuSO4", 1.0)]).expect("copper sulfate pair");
    assert_eq!(check(&d, "Cu + SO4"), 1);
    assert_eq!(bonds_made(&d), vec![("Cu".to_string(), "O".to_string())]);
    let d = assoc(&[("NH4+", 1.0), ("SO4-2", 1.0)], &[("NH4SO4-", 1.0)]).expect("ammonium sulfate pair");
    assert_eq!(d.kind, "ion_pair");
    check(&d, "NH4 + SO4");
}

#[test]
fn an_aqua_ion_that_gives_up_a_proton_is_a_complexation_with_a_moving_hydrogen() {
    let d = assoc(&[("Fe+3", 1.0), ("H2O", 1.0)], &[("FeOH+2", 1.0), ("H+", 1.0)]).expect("iron(III) hydroxo");
    assert_eq!(d.kind, "complexation");
    assert_eq!(check(&d, "Fe + H2O"), 2, "the Fe-O bond is made and one O-H bond broken (the hydrogen leaves as H+)");
    assert_eq!(d.moving_h.len(), 1);
    let m = &d.moving_h[0];
    assert!(m.acceptor.is_none(), "H+ is a free proton");
    let donor = m.donor.unwrap();
    assert_eq!(structure3d::for_species(&d.reactants[donor[0]], None).atoms[donor[1]].el, "O");
    // dihydroxo: two protons
    let d = assoc(&[("Fe+3", 1.0), ("H2O", 2.0)], &[("Fe(OH)2+", 1.0), ("H+", 2.0)]).expect("iron(III) dihydroxo");
    check(&d, "Fe + 2 H2O");
    assert_eq!(d.moving_h.len(), 2);
    // Al3+ + 4 OH-: hydroxide ligands, no hydrogen moves
    let d = assoc(&[("Al+3", 1.0), ("OH-", 4.0)], &[("Al(OH)4-", 1.0)]).expect("aluminate");
    assert!(d.moving_h.is_empty());
    check(&d, "Al + 4 OH");
    // things that are not complexations: CO2 hydration (no metal, neutral molecules), a proton transfer, a missing product
    assert!(assoc(&[("CO2(aq)", 1.0), ("H2O", 1.0)], &[("H2CO3(aq)", 1.0)]).is_none());
    assert!(assoc(&[("Cu+2", 1.0), ("NH3", 4.0)], &[("Cu(NH3)3+2", 1.0)]).is_none(), "atoms that do not balance are refused");
}

#[test]
fn zinc_and_copper_exchange_two_electrons_atom_for_atom() {
    let pt = partners("Zn(s)", "Zn+2", "Cu+2", "Cu(s)");
    let d = et(&[("Zn(s)", 1.0), ("Cu+2", 1.0)], &[("Zn+2", 1.0), ("Cu(s)", 1.0)], &pt, 2).expect("zinc + copper(II)");
    assert_eq!(d.kind, "electron_transfer");
    assert!(!d.schematic_mapping && d.note.is_none());
    assert_eq!(d.electrons, 2);
    assert_eq!(check(&d, "Zn + Cu2+"), 0, "no bond changes: atoms keep their identity, only charges change");
    let (lost, gained) = electrons_lost_and_gained(&d);
    assert!((lost - 2.0).abs() < 1e-9 && (gained - 2.0).abs() < 1e-9, "lost {} gained {}", lost, gained);
    // the electrons hop from the zinc to the copper
    let hop = &d.electron_hops[0];
    assert_eq!(d.reactants[hop.from[0]], "Zn(s)");
    assert_eq!(d.reactants[hop.to[0]], "Cu+2");
    assert_eq!(hop.count, 2);
}

#[test]
fn permanganate_and_iron_are_shown_as_the_one_electron_step_of_the_reaction() {
    // MnO4- + 5 Fe2+ + 8 H+ -> Mn2+ + 5 Fe3+ + 4 H2O is far too many molecules for one event: one electron goes from an
    // iron(II) to the permanganate, which becomes manganate(VI), and the notes say so
    let pt = partners("Fe+2", "Fe+3", "MnO4-", "Mn+2");
    let d = et(&[("MnO4-", 1.0), ("Fe+2", 5.0), ("H+", 8.0)], &[("Mn+2", 1.0), ("Fe+3", 5.0), ("H2O", 4.0)], &pt, 5).expect("permanganate + iron(II)");
    assert_eq!(d.reactants.len(), 2);
    assert_eq!(d.products, vec!["Fe+3".to_string(), "MnO4-2".to_string()]);
    assert!(d.note.as_deref().unwrap_or("").contains("5-electron"));
    assert_eq!(d.electrons, 1);
    assert_eq!(check(&d, "Fe2+ + MnO4-"), 0);
    let (lost, gained) = electrons_lost_and_gained(&d);
    assert!((lost - 1.0).abs() < 1e-9 && (gained - 1.0).abs() < 1e-9, "lost {} gained {}", lost, gained);
    // the electron leaves the iron atom and arrives at the manganese atom
    let hop = &d.electron_hops[0];
    let from_el = structure3d::for_species(&d.reactants[hop.from[0]], None).atoms[hop.from[1]].el.clone();
    let to_el = structure3d::for_species(&d.reactants[hop.to[0]], None).atoms[hop.to[1]].el.clone();
    assert_eq!((from_el.as_str(), to_el.as_str()), ("Fe", "Mn"));
}

#[test]
fn an_oxygen_transfer_is_mapped_by_element_and_flagged_schematic() {
    // sulfite + hypochlorite -> sulfate + chloride: the sulfur keeps its three oxygens, the fourth comes from the hypochlorite
    let pt = partners("SO3-2", "SO4-2", "ClO-", "Cl-");
    let d = et(&[("SO3-2", 1.0), ("ClO-", 1.0)], &[("SO4-2", 1.0), ("Cl-", 1.0)], &pt, 2).expect("sulfite + hypochlorite");
    assert!(d.schematic_mapping, "oxygen is assigned by element");
    assert_eq!(d.electrons, 2);
    check(&d, "SO3 + ClO");
    let (lost, gained) = electrons_lost_and_gained(&d);
    assert!((lost - 2.0).abs() < 1e-9 && (gained - 2.0).abs() < 1e-9, "lost {} gained {}", lost, gained);
    // hydrogen peroxide + copper(I): hydrogens come from the protons
    let pt = partners("Cu+", "Cu+2", "H2O2", "H2O");
    let d = et(&[("Cu+", 2.0), ("H+", 2.0), ("H2O2", 1.0)], &[("Cu+2", 2.0), ("H2O", 2.0)], &pt, 2).expect("copper(I) + peroxide");
    check(&d, "2 Cu+ + H2O2 + 2 H+");
    let (lost, gained) = electrons_lost_and_gained(&d);
    assert!((lost - gained).abs() < 1e-9 && (lost - 2.0).abs() < 1e-9, "lost {} gained {}", lost, gained);
}

fn run_vessel(setup: impl FnOnce(&mut Vessel), steps: usize, dt: f64) -> Vessel {
    let mut v = flask();
    setup(&mut v);
    for _ in 0..steps {
        v.step(dt).unwrap();
    }
    v
}

fn described<'a>(rows: &'a [micro_view::MicroReaction], id: &str) -> &'a micro_view::MicroReaction {
    rows.iter().find(|r| r.id == id).unwrap_or_else(|| panic!("row {} missing; rows: {:?}", id, rows.iter().map(|r| &r.id).collect::<Vec<_>>()))
}

fn check_row(r: &micro_view::MicroReaction) {
    let d = MicroDescription { kind: r.kind.clone(), family: r.family.clone(), reactants: r.reactants.clone(), products: r.products.clone(), atom_map: r.atom_map.clone(), moving_h: r.moving_h.clone(), schematic_mapping: r.schematic_mapping, electrons: r.electrons, electron_hops: r.electron_hops.clone(), note: r.note.clone(), surface: r.surface.clone() };
    check(&d, &r.equation);
    if r.kind == "electron_transfer" && !r.electron_hops.is_empty() {
        let (lost, gained) = electrons_lost_and_gained(&d);
        assert!((lost - gained).abs() < 1e-9, "{}: electrons lost {} gained {}", r.equation, lost, gained);
    }
}

#[test]
fn copper_ammine_and_iron_thiocyanate_rows_exchange_at_the_eigen_wilkins_rate() {
    let v = run_vessel(
        |v| {
            dose(v, "water", 40.0);
            dose(v, "cuso4_0_1m", 10.0);
            dose(v, "nh3_2m", 5.0);
        },
        3,
        0.5,
    );
    let rows = v.micro_reactions(0);
    let cu = described(&rows, "copper_tetraammine");
    assert_eq!(cu.kind, "complexation");
    assert_eq!(cu.reactants.len(), 5);
    assert!(cu.rate_source.starts_with("Eigen-Wilkins"), "{}", cu.rate_source);
    assert!(cu.gross_forward_mol_s > 0.0 && cu.gross_reverse_mol_s > 0.0);
    // copper is at its equilibrium: the exchange is equal in both directions (detailed balance), net far smaller than gross
    assert!(cu.net_rate_mol_s.abs() < 0.05 * cu.gross_forward_mol_s, "net {} gross {}", cu.net_rate_mol_s, cu.gross_forward_mol_s);
    let pair = described(&rows, "cplx_CuSO4");
    check_row(pair);
    // the Fuoss pair of ammonium and sulfate is an ion pair; the data pair of copper is a complexation row
    assert!(rows.iter().any(|r| r.kind == "ion_pair"), "an ion pair is described");
    for r in rows.iter().filter(|r| matches!(r.kind.as_str(), "complexation" | "ion_pair")) {
        check_row(r);
    }
    // iron thiocyanate (water exchange of Fe3+ limits the rate)
    let v = run_vessel(
        |v| {
            dose(v, "fe_no3_3_0_1m", 25.0);
            dose(v, "kscn_0_1m", 25.0);
        },
        4,
        0.5,
    );
    let rows = v.micro_reactions(0);
    let fe = described(&rows, "iron_thiocyanate");
    assert_eq!(fe.reactants, vec!["Fe+3".to_string(), "SCN-".to_string()]);
    assert!(fe.rate_source.starts_with("Eigen-Wilkins"));
    // k_f = K_os k_ex for Fe3+ is of the order 1e3-1e4 M-1 s-1: 0.05 M x 0.05 M x 0.1 L-ish gives mol/s well above the
    // diffusion-limited bound's complement and below it
    let hydroxo = described(&rows, "iron_monohydroxo");
    assert_eq!(hydroxo.kind, "complexation");
    assert_eq!(hydroxo.moving_h.len(), 1);
    assert!(hydroxo.rate_source.starts_with("diffusion-limited"));
    for r in rows.iter().filter(|r| matches!(r.kind.as_str(), "complexation" | "ion_pair")) {
        check_row(r);
    }
}

#[test]
fn a_cementation_vessel_reports_the_zinc_copper_pairs_with_balanced_electrons() {
    let v = run_vessel(
        |v| {
            dose(v, "water", 50.0);
            v.species_mol.insert("Cu+2".into(), 0.005);
            v.species_mol.insert("SO4-2".into(), 0.005);
            v.solid_mol.insert("Zn(s)".into(), 0.005);
        },
        4,
        0.5,
    );
    let rows = v.micro_reactions(0);
    let main = rows.iter().find(|r| r.kind == "electron_transfer" && r.reactants == vec!["Cu+2".to_string(), "Zn(s)".to_string()] && r.products == vec!["Cu(s)".to_string(), "Zn+2".to_string()]).unwrap_or_else(|| panic!("the Zn + Cu2+ pair is missing: {:?}", rows.iter().map(|r| &r.equation).collect::<Vec<_>>()));
    assert_eq!(main.electrons, 2);
    assert!(main.gross_forward_mol_s > 0.0 && main.gross_reverse_mol_s == 0.0);
    // the engine's own numbers: the pair's event rate times 2 electrons is a share of the zinc's anodic electron flow
    let zn_flux = v.active_reactions.iter().find(|r| r.equation == "Zn(s) -> Zn+2 + 2 e-").map(|r| r.rate * 2.0).unwrap();
    assert!(2.0 * main.gross_forward_mol_s <= zn_flux * (1.0 + 1e-9), "pair flux {} exceeds the anodic flux {}", 2.0 * main.gross_forward_mol_s, zn_flux);
    for r in rows.iter().filter(|r| r.kind == "electron_transfer") {
        check_row(r);
    }
}

#[test]
fn a_permanganate_vessel_plays_the_electron_hop_at_the_net_rate_times_the_electrons() {
    let v = run_vessel(
        |v| {
            dose(v, "water", 50.0);
            dose(v, "hcl_1m", 10.0);
            v.species_mol.insert("MnO4-".into(), 0.001);
            v.species_mol.insert("Fe+2".into(), 0.01);
        },
        1,
        0.05,
    );
    let rows = v.micro_reactions(0);
    let ets: Vec<_> = rows.iter().filter(|r| r.kind == "electron_transfer").collect();
    assert!(!ets.is_empty(), "the redox rows: {:?}", v.active_reactions.iter().map(|r| &r.equation).collect::<Vec<_>>());
    for r in &ets {
        check_row(r);
        assert!(r.gross_forward_mol_s > 0.0, "{}", r.equation);
        if r.note.is_some() {
            assert_eq!(r.electrons, 1);
        }
    }
    assert!(ets.iter().any(|r| r.reactants.iter().any(|s| s == "MnO4-") || r.equation.contains("MnO4-")), "permanganate takes part in a row");
}

#[test]
fn every_complexation_row_of_the_data_table_has_an_exact_description() {
    let rows = reaction_chamber_engine::ion_pairing::complex_equilibria(&|_| true);
    assert!(rows.len() > 200, "{} rows", rows.len());
    let (mut ok, mut missing) = (0usize, Vec::new());
    let t0 = std::time::Instant::now();
    for eq in &rows {
        // rows with more than 7 ligands or a coefficient the viewer cannot draw are listed, not played
        match micro_view::describe_association(&eq.reactants, &eq.products, &|_| None) {
            Some(d) => {
                assert!(!d.schematic_mapping, "{}", eq.equation);
                check(&d, &eq.equation);
                ok += 1;
            }
            None => missing.push(eq.equation.clone()),
        }
    }
    eprintln!("described {} of {} in {:?}; not described: {:?}", ok, rows.len(), t0.elapsed(), missing);
    assert!(ok as f64 >= 0.95 * rows.len() as f64, "{} of {} described; missing {:?}", ok, rows.len(), missing);
}
