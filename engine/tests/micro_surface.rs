//! Gates of stage R4 of the reaction viewer (docs/plans/reaction-viewer-plan.md, section 6): reactions at solid surfaces and
//! across phase boundaries (`micro_view/surface.rs`): the lattice of a solid, precipitation / dissolution, electrode
//! half-reactions, metal / solution pairs, thermal decomposition, evaporation / Henry exchange / boiling, combustion.

use std::collections::HashSet;

use reaction_chamber_engine::micro_view::{MicroReaction, SurfaceDesc};
use reaction_chamber_engine::structure3d;
use reaction_chamber_engine::transfer::electrochem::SupplyMode;
use reaction_chamber_engine::vessel::*;
use reaction_chamber_engine::vessel_electro::{ElectrodeSpec, ElectrolysisSpec};

fn flask_at(t: f64) -> Vessel {
    Vessel::new(VesselConfig { vessel_type: "test-flask".into(), capacity_ml: 250.0, glass_mass_g: 100.0, inner_radius_cm: 3.5, temperature_k: Some(t), room_k: Some(298.15), sealed: Some(false), stopper_pop_atm: Some(2.0), burst_atm: Some(6.0) })
}

fn flask() -> Vessel {
    flask_at(298.15)
}

fn dose(v: &mut Vessel, id: &str, ml: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(ml), mass_g: None, drops: None, temperature_k: Some(298.15), solid_form: None }).unwrap();
}

fn run(v: &mut Vessel, seconds: f64, dt: f64) {
    for _ in 0..(seconds / dt).round() as usize {
        v.step(dt).unwrap();
    }
}

fn row<'a>(rows: &'a [MicroReaction], id: &str) -> &'a MicroReaction {
    rows.iter().find(|r| r.id == id).unwrap_or_else(|| panic!("row {} missing; rows: {:?}", id, rows.iter().map(|r| (&r.id, &r.kind)).collect::<Vec<_>>()))
}

/// The atom map of a description is a bijection onto the reactant atoms and keeps every element and the net charge.
fn check_map(reactants: &[String], products: &[String], atom_map: &[Vec<[usize; 2]>], label: &str) {
    let r: Vec<_> = reactants.iter().map(|s| structure3d::for_species(s, None)).collect();
    let p: Vec<_> = products.iter().map(|s| structure3d::for_species(s, None)).collect();
    assert_eq!(atom_map.len(), p.len(), "{}: one map row per product", label);
    let mut used: HashSet<[usize; 2]> = HashSet::new();
    for (pi, rowm) in atom_map.iter().enumerate() {
        assert_eq!(rowm.len(), p[pi].atoms.len(), "{}: every atom of {} is mapped", label, products[pi]);
        for (a, o) in rowm.iter().enumerate() {
            assert!(used.insert(*o), "{}: reactant atom {:?} used twice", label, o);
            assert_eq!(r[o[0]].atoms[o[1]].el, p[pi].atoms[a].el, "{}: element changes along the map", label);
        }
    }
    assert_eq!(used.len(), r.iter().map(|s| s.atoms.len()).sum::<usize>(), "{}: every reactant atom is used", label);
}

/// Elements and net charge of a list of species.
fn tally(species: &[String]) -> (std::collections::BTreeMap<String, usize>, i32) {
    let mut el = std::collections::BTreeMap::new();
    let mut q = 0;
    for s in species {
        let st = structure3d::for_species(s, None);
        for a in &st.atoms {
            *el.entry(a.el.clone()).or_insert(0) += 1;
        }
        q += st.charge;
    }
    (el, q)
}

/// The parts of a surface description add up to the reaction: the elements on the two sides are the same, and the charge differs by
/// the electrons (an anode gives them to the electrode, a cathode takes them; a pair or a mineral moves none net).
fn check_surface_balance(r: &MicroReaction) {
    let Some(s) = &r.surface else { return };
    let mut left: Vec<String> = Vec::new();
    let mut right: Vec<String> = Vec::new();
    for l in &s.leaves {
        left.push(l.occupant.clone());
        right.extend(l.becomes.iter().cloned());
    }
    for j in &s.joins {
        left.extend(j.takes.iter().cloned());
        right.push(j.occupant.clone());
    }
    right.extend(s.residue.iter().cloned());
    if let Some(m) = &s.morph {
        left.extend(m.reactants.iter().cloned());
        right.extend(m.products.iter().cloned());
    }
    let (el_l, q_l) = tally(&left);
    let (el_r, q_r) = tally(&right);
    assert_eq!(el_l, el_r, "{}: elements of the surface parts", r.equation);
    let expect = if s.electrode.is_none() { 0 } else if s.oxidation { r.electrons as i32 } else { -(r.electrons as i32) };
    assert_eq!(q_r - q_l, expect, "{}: charge of the surface parts against the electrons", r.equation);
}

fn surface_of(r: &MicroReaction) -> &SurfaceDesc {
    r.surface.as_ref().unwrap_or_else(|| panic!("{} has no surface part", r.equation))
}

// ------------------------------------------------------------------------------------------------ lattices

#[test]
fn a_solid_has_a_lattice_from_its_mineral_record_its_formula_or_its_element() {
    let v = flask();
    for (solid, ions) in [("AgCl(s)", vec![("Ag+", 1), ("Cl-", 1)]), ("BaSO4(s)", vec![("Ba+2", 1), ("SO4-2", 1)]), ("Ag2CrO4(s)", vec![("Ag+", 2), ("CrO4-2", 1)])] {
        let l = v.micro_lattice(solid).unwrap_or_else(|| panic!("no lattice for {}", solid));
        let got: Vec<(String, u32)> = l.ions.iter().map(|i| (i.species.clone(), i.count)).collect();
        let mut want: Vec<(String, u32)> = ions.iter().map(|(s, n)| (s.to_string(), *n)).collect();
        want.sort();
        let mut got_sorted = got.clone();
        got_sorted.sort();
        assert_eq!(got_sorted, want, "{}", solid);
        assert_eq!(l.kind, "mineral");
        assert!(l.ions.iter().all(|i| i.radius_a > 0.3 && i.radius_a < 3.5), "{:?}", l.ions);
        // cations first, with the charges of the ions
        assert!(l.ions[0].charge > 0 && l.ions.last().unwrap().charge < 0, "{:?}", l.ions);
    }
    let zn = v.micro_lattice("Zn(s)").expect("zinc");
    assert_eq!((zn.kind.as_str(), zn.ions.len(), zn.ions[0].count), ("metal", 1, 1));
    assert!(zn.ions[0].radius_a > 1.0 && zn.ions[0].radius_a < 1.8, "{}", zn.ions[0].radius_a);
    // an ionic formula with no mineral record is split into its ions
    let nacl = v.micro_lattice("NaCl(s)").expect("sodium chloride");
    assert!(nacl.ions.len() == 2 && nacl.ions.iter().all(|i| i.count == 1), "{:?}", nacl);
    // a molecular solid has no lattice here
    assert!(v.micro_lattice("C6H12O6(s)").is_none());
}

// ------------------------------------------------------------------------------------------------ precipitation

#[test]
fn a_precipitate_exchanges_ions_with_its_lattice_at_the_film_limited_rate() {
    let mut v = flask();
    dose(&mut v, "water", 50.0);
    v.species_mol.insert("Ag+".into(), 0.002);
    v.species_mol.insert("Cl-".into(), 0.002);
    v.species_mol.insert("NO3-".into(), 0.0);
    run(&mut v, 60.0, 1.0);
    assert!(v.solid_mol.get("AgCl(s)").copied().unwrap_or(0.0) > 1e-4, "AgCl formed: {:?}", v.solid_mol);
    let rows = v.micro_reactions(0);
    let r = row(&rows, "solid_AgCl(s)");
    assert_eq!(r.kind, "dissolution");
    assert_eq!(r.reactants, vec!["AgCl(s)".to_string()]);
    let mut products = r.products.clone();
    products.sort();
    assert_eq!(products, vec!["Ag+".to_string(), "Cl-".to_string()]);
    check_surface_balance(r);
    let s = surface_of(r);
    assert_eq!((s.slab.as_str(), s.slab_kind.as_str()), ("AgCl(s)", "mineral"));
    assert_eq!(s.leaves.len(), 2);
    assert!(s.joins.is_empty() && s.morph.is_none());
    assert!(r.gross_forward_mol_s > 0.0 && r.gross_reverse_mol_s > 0.0 && r.reversible);
    // net = k A (c_sat - c) is what the engine's own transfer step does, so it equals forward - reverse and is small near saturation
    assert!((r.net_rate_mol_s - (r.gross_forward_mol_s - r.gross_reverse_mol_s)).abs() < 1e-18);
    assert!(r.net_rate_mol_s.abs() < 0.5 * r.gross_forward_mol_s, "far from saturation: fwd {:e} rev {:e}", r.gross_forward_mol_s, r.gross_reverse_mol_s);
    // dissolution and precipitation each run faster on a larger surface: the exchange scales with the particle area
    let area = |v: &Vessel| v.particle_populations.get("AgCl(s)").map_or(0.0, |p| p.surface_area_m2());
    assert!(area(&v) > 0.0);
    // more ions in solution: the precipitation side grows, the dissolution side (saturation) does not
    let before = (r.gross_forward_mol_s, r.gross_reverse_mol_s);
    v.species_mol.insert("Cl-".into(), v.species_mol["Cl-"] * 10.0);
    let rows2 = v.micro_reactions(0);
    let r2 = row(&rows2, "solid_AgCl(s)");
    assert!(r2.gross_reverse_mol_s > 3.0 * before.1, "precipitation side {:e} -> {:e}", before.1, r2.gross_reverse_mol_s);
    assert!(r2.gross_forward_mol_s > 0.0 && (r2.gross_forward_mol_s / before.0 - 1.0).abs() < 0.5, "dissolution side {:e} -> {:e}", before.0, r2.gross_forward_mol_s);
    // a mineral without solid has no row
    let mut w = flask();
    dose(&mut w, "water", 50.0);
    assert!(w.micro_reactions(0).iter().all(|r| r.kind != "dissolution"));
}

// ------------------------------------------------------------------------------------------------ electrodes

fn cell(anode: &str, cathode: &str, volts: f64, setup: impl FnOnce(&mut Vessel)) -> Vessel {
    let mut v = flask();
    dose(&mut v, "water", 100.0);
    setup(&mut v);
    v.set_electrolysis(Some(ElectrolysisSpec {
        anode: ElectrodeSpec { material: anode.into(), area_cm2: 10.0 },
        cathode: ElectrodeSpec { material: cathode.into(), area_cm2: 10.0 },
        supply: SupplyMode::Voltage(volts),
        spacing_cm: 2.0,
        on: true,
    }));
    run(&mut v, 20.0, 0.5);
    v
}

#[test]
fn a_copper_plating_cell_shows_the_cathode_joining_and_the_anode_leaving_the_lattice() {
    let v = cell("Cu", "Cu", 4.0, |v| {
        v.species_mol.insert("Cu+2".into(), 0.01);
        v.species_mol.insert("SO4-2".into(), 0.01);
    });
    let rows = v.micro_reactions(0);
    let electrode: Vec<&MicroReaction> = rows.iter().filter(|r| r.kind == "electrode").collect();
    assert!(!electrode.is_empty(), "no electrode rows: {:?}", rows.iter().map(|r| (&r.id, &r.kind)).collect::<Vec<_>>());
    let plating = electrode.iter().find(|r| surface_of(r).electrode.as_deref() == Some("cathode") && surface_of(r).joins.iter().any(|j| j.takes == vec!["Cu+2".to_string()])).expect("Cu2+ + 2 e- -> Cu(s) at the cathode");
    for r in electrode.iter() {
        check_surface_balance(r);
    }
    let s = surface_of(plating);
    assert_eq!(s.slab, "Cu(s)");
    assert_eq!(s.joins[0].occupant, "Cu(s)");
    assert_eq!(s.joins[0].takes, vec!["Cu+2".to_string()]);
    assert!(s.leaves.is_empty() && s.morph.is_none());
    assert_eq!(plating.electrons, 2);
    assert!(plating.gross_forward_mol_s > 0.0 && plating.gross_reverse_mol_s == 0.0);
    let dissolving = electrode.iter().find(|r| surface_of(r).electrode.as_deref() == Some("anode") && surface_of(r).leaves.iter().any(|l| l.becomes == vec!["Cu+2".to_string()])).expect("Cu(s) -> Cu2+ + 2 e- at the anode");
    let s = surface_of(dissolving);
    assert_eq!(s.slab, "Cu(s)");
    assert_eq!(s.leaves[0].occupant, "Cu(s)");
    assert_eq!(s.leaves[0].becomes, vec!["Cu+2".to_string()]);
    assert_eq!(dissolving.electrons, 2);
    // Faraday: the current the readout reports is the extent times the electrons times F
    let ro = v.snapshot().electrolysis.expect("readout");
    let amps: f64 = electrode.iter().filter(|r| surface_of(r).electrode.as_deref() == Some("cathode")).map(|r| r.gross_forward_mol_s * r.electrons as f64 * 96485.0).sum();
    assert!(ro.current_a > 0.0 && (amps / ro.current_a - 1.0).abs() < 0.05, "cathode rows carry {} A of {} A", amps, ro.current_a);
}

#[test]
fn water_electrolysis_makes_hydrogen_and_oxygen_at_the_surface_with_a_mapped_morph() {
    let v = cell("Pt", "Pt", 6.0, |v| {
        v.species_mol.insert("Na+".into(), 0.1);
        v.species_mol.insert("SO4-2".into(), 0.05);
    });
    let rows = v.micro_reactions(0);
    let electrode: Vec<&MicroReaction> = rows.iter().filter(|r| r.kind == "electrode").collect();
    let gas_rows: Vec<&&MicroReaction> = electrode.iter().filter(|r| r.products.iter().any(|p| p.ends_with("(g)")) || surface_of(r).morph.as_ref().map_or(false, |m| m.products.iter().any(|p| p.ends_with("(g)")))).collect();
    assert!(!gas_rows.is_empty(), "gas-evolving rows missing: {:?}", electrode.iter().map(|r| (&r.equation, &r.kind)).collect::<Vec<_>>());
    for r in electrode.iter().filter(|r| r.surface.as_ref().map_or(false, |s| s.morph.is_some())) {
        let s = surface_of(r);
        let m = s.morph.as_ref().unwrap();
        check_map(&m.reactants, &m.products, &m.atom_map, &r.equation);
        // charge: the electrons the half-reaction moves balance the charge of the morph
        check_surface_balance(r);
        let q = |l: &[String]| l.iter().map(|s| structure3d::for_species(s, None).charge).sum::<i32>();
        let dq = q(&m.products) - q(&m.reactants);
        let expect = if s.oxidation { r.electrons as i32 } else { -(r.electrons as i32) };
        assert_eq!(dq, expect, "{}: charge change of the morph against the electrons", r.equation);
    }
    let strongest = |which: &str| electrode.iter().filter(|r| surface_of(r).electrode.as_deref() == Some(which)).max_by(|a, b| a.gross_forward_mol_s.partial_cmp(&b.gross_forward_mol_s).unwrap()).copied().unwrap();
    let cathode = strongest("cathode");
    assert!(surface_of(cathode).morph.as_ref().unwrap().products.iter().any(|p| p == "H2(g)"), "{:?}", cathode.equation);
    let anode = strongest("anode");
    assert!(surface_of(anode).morph.as_ref().unwrap().products.iter().any(|p| p.starts_with("O2")), "{:?}", anode.equation);
}

// ------------------------------------------------------------------------------------------------ cementation, decomposition

#[test]
fn a_cementation_pair_dissolves_zinc_from_the_lattice_and_plates_copper_on_it() {
    let mut v = flask();
    dose(&mut v, "water", 50.0);
    v.species_mol.insert("Cu+2".into(), 0.005);
    v.species_mol.insert("SO4-2".into(), 0.005);
    v.solid_mol.insert("Zn(s)".into(), 0.005);
    run(&mut v, 2.0, 0.5);
    let rows = v.micro_reactions(0);
    let pair = rows.iter().find(|r| r.kind == "electron_transfer" && r.reactants.contains(&"Zn(s)".to_string()) && r.products.contains(&"Cu(s)".to_string())).expect("the Zn + Cu2+ pair");
    let s = surface_of(pair);
    assert_eq!(s.slab, "Zn(s)");
    assert_eq!(s.slab_kind, "metal");
    assert_eq!(s.leaves.len(), 1);
    assert_eq!((s.leaves[0].occupant.as_str(), s.leaves[0].becomes.clone()), ("Zn(s)", vec!["Zn+2".to_string()]));
    assert_eq!(s.joins.len(), 1);
    assert_eq!((s.joins[0].occupant.as_str(), s.joins[0].takes.clone()), ("Cu(s)", vec!["Cu+2".to_string()]));
    assert!(s.morph.is_none());
    assert_eq!(pair.electrons, 2);
    check_surface_balance(pair);
}

#[test]
fn a_decomposing_carbonate_leaves_the_oxide_on_the_surface_and_the_gas_through_the_top() {
    let mut v = flask_at(1200.0);
    v.solid_mol.insert("CaCO3(s)".into(), 0.01);
    run(&mut v, 0.1, 0.1); // the whole charge goes in the first step; the rows are those of the last one
    let rows = v.micro_gas_reactions();
    let r = rows.iter().find(|r| r.kind == "decomposition").unwrap_or_else(|| panic!("no decomposition row: {:?}", rows.iter().map(|r| (&r.id, &r.kind)).collect::<Vec<_>>()));
    assert!(r.reactants.contains(&"CaCO3(s)".to_string()) && r.products.contains(&"CaO(s)".to_string()) && r.products.contains(&"CO2(g)".to_string()), "{} -> {}", r.reactants.join(" + "), r.products.join(" + "));
    assert!(r.schematic_mapping);
    check_map(&r.reactants, &r.products, &r.atom_map, &r.equation);
    let s = surface_of(r);
    assert_eq!(s.slab, "CaCO3(s)");
    assert_eq!(s.residue, vec!["CaO(s)".to_string()]);
    assert_eq!(s.leaves.len(), 1);
    assert_eq!(s.leaves[0].becomes, vec!["CO2(g)".to_string()]);
    assert!(r.gross_forward_mol_s > 0.0 && !r.reversible);
    check_surface_balance(r);
}

// ------------------------------------------------------------------------------------------------ phase transfer, combustion

#[test]
fn evaporation_and_dissolved_gases_cross_the_surface_with_gross_rates() {
    // a warm solution of a gas in open air: oxygen dissolved above its equilibrium leaves, water evaporates
    let mut v = flask_at(330.0);
    dose(&mut v, "water", 100.0);
    run(&mut v, 5.0, 0.5);
    let liquid = v.micro_reactions(0);
    let evap = liquid.iter().find(|r| r.kind == "phase_transfer" && r.reactants == vec!["H2O".to_string()]).unwrap_or_else(|| panic!("no evaporation row: {:?}", liquid.iter().map(|r| (&r.id, &r.kind)).collect::<Vec<_>>()));
    assert_eq!(evap.products, vec!["H2O(g)".to_string()]);
    assert!(evap.gross_forward_mol_s > evap.gross_reverse_mol_s && evap.gross_reverse_mol_s > 0.0, "warm water in humid air: {:e} out, {:e} in", evap.gross_forward_mol_s, evap.gross_reverse_mol_s);
    check_map(&evap.reactants, &evap.products, &evap.atom_map, "evaporation");
    // the engine's own net: the liquid loses mass at (forward - reverse) times the molar mass
    let g_s = v.evaporation_g_s;
    assert!(g_s > 0.0 && ((evap.net_rate_mol_s * 18.015) / g_s - 1.0).abs() < 0.3, "net {:e} mol/s = {:e} g/s against the engine's {:e} g/s", evap.net_rate_mol_s, evap.net_rate_mol_s * 18.015, g_s);
    // the same rows seen from the gas side
    let gas = v.micro_gas_reactions();
    assert!(gas.iter().any(|r| r.id == evap.id), "the gas side lists the same transfer");
    // a gas that is dissolved and in equilibrium with the air still exchanges: forward and reverse nearly equal
    let mut w = flask();
    dose(&mut w, "water", 100.0);
    run(&mut w, 600.0, 5.0);
    let rows = w.micro_reactions(0);
    let henry = rows.iter().find(|r| r.kind == "phase_transfer" && r.reactants.iter().any(|s| s.starts_with("O2") || s.starts_with("N2") || s.starts_with("CO2")));
    if let Some(h) = henry {
        assert!(h.gross_forward_mol_s > 0.0 && h.gross_reverse_mol_s > 0.0, "{} {:e} {:e}", h.equation, h.gross_forward_mol_s, h.gross_reverse_mol_s);
    }
}

#[test]
fn a_burning_fuel_is_a_combustion_row_of_the_gas_phase() {
    let mut v = flask();
    dose(&mut v, "ethanol", 30.0);
    v.set_controls(VesselControls { igniter: Some(true), ..Default::default() });
    run(&mut v, 3.0, 0.5);
    assert!(v.snapshot().flame.is_some(), "the ethanol burns");
    let rows = v.micro_gas_reactions();
    let r = rows.iter().find(|r| r.kind == "combustion").unwrap_or_else(|| panic!("no combustion row: {:?}", rows.iter().map(|r| (&r.id, &r.kind)).collect::<Vec<_>>()));
    assert!(r.reactants.iter().any(|s| s == "O2(g)") && r.products.iter().any(|s| s == "CO2(g)") && r.products.iter().any(|s| s == "H2O(g)"), "{} -> {}", r.reactants.join(" + "), r.products.join(" + "));
    assert!(r.schematic_mapping && r.gross_forward_mol_s > 0.0);
    check_map(&r.reactants, &r.products, &r.atom_map, &r.equation);
}

#[test]
fn rows_of_a_busy_vessel_keep_atoms_and_electrons_whatever_they_are() {
    // a vessel with a precipitate, a metal and an acid: every row that has an atom map keeps elements, every surface row has parts
    let mut v = flask();
    dose(&mut v, "water", 50.0);
    v.species_mol.insert("Ag+".into(), 0.003);
    v.species_mol.insert("Cl-".into(), 0.003);
    v.species_mol.insert("Cu+2".into(), 0.003);
    v.species_mol.insert("SO4-2".into(), 0.003);
    v.solid_mol.insert("Zn(s)".into(), 0.004);
    run(&mut v, 20.0, 0.5);
    for r in v.micro_reactions(0) {
        if !r.atom_map.is_empty() && r.kind != "phase_transfer" {
            check_map(&r.reactants, &r.products, &r.atom_map, &r.equation);
        }
        check_surface_balance(&r);
        if let Some(s) = &r.surface {
            assert!(!s.leaves.is_empty() || !s.joins.is_empty() || s.morph.is_some() || !s.residue.is_empty(), "{}: a surface row without parts", r.equation);
            if let Some(m) = &s.morph {
                check_map(&m.reactants, &m.products, &m.atom_map, &r.equation);
            }
        }
        assert!(r.gross_forward_mol_s.is_finite() && r.gross_reverse_mol_s.is_finite(), "{}: finite rates", r.equation);
    }
}

#[test]
fn zinc_in_acid_dissolves_from_the_lattice_while_hydrogen_forms_above_it() {
    let mut v = flask();
    dose(&mut v, "water", 50.0);
    dose(&mut v, "hcl_1m", 10.0);
    v.solid_mol.insert("Zn(s)".into(), 0.01);
    run(&mut v, 2.0, 0.5);
    let rows = v.micro_reactions(0);
    let pair = rows
        .iter()
        .filter(|r| r.kind == "electron_transfer" && r.surface.as_ref().map_or(false, |s| s.slab == "Zn(s)" && s.morph.as_ref().map_or(false, |m| m.products.iter().any(|p| p == "H2(g)"))))
        .max_by(|a, b| a.gross_forward_mol_s.partial_cmp(&b.gross_forward_mol_s).unwrap())
        .unwrap_or_else(|| panic!("no Zn + 2 H+ row: {:?}", rows.iter().map(|r| (&r.id, &r.kind, &r.equation)).collect::<Vec<_>>()));
    let s = surface_of(pair);
    assert_eq!(s.leaves.len(), 1);
    assert_eq!((s.leaves[0].occupant.as_str(), s.leaves[0].becomes.clone()), ("Zn(s)", vec!["Zn+2".to_string()]));
    assert!(s.joins.is_empty());
    let m = s.morph.as_ref().unwrap();
    assert_eq!(m.reactants, vec!["H+".to_string(), "H+".to_string()]);
    check_map(&m.reactants, &m.products, &m.atom_map, &pair.equation);
    assert_eq!(pair.electrons, 2);
    check_surface_balance(pair);
    for r in rows.iter().filter(|r| r.surface.is_some()) {
        check_surface_balance(r);
    }
}
