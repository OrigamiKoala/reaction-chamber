//! Gates of the seventh audit pass (ALGORITHM-IMPROVEMENT.md, section 2.9): each one pins a fix through the public API and
//! none of them knows a particular reaction. Several are consequences of the species data added in this pass
//! (`data/species_inorganic.json`): data that was missing used to hide these defects.

use std::collections::HashMap;

use reaction_chamber_engine::transfer::electrochem::SupplyMode;
use reaction_chamber_engine::vessel::*;
use reaction_chamber_engine::vessel_electro::{ElectrodeSpec, ElectrolysisSpec};

fn beaker(t: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: 250.0,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(t),
        room_k: Some(t),
        sealed: Some(false),
        stopper_pop_atm: Some(2.2),
        burst_atm: Some(6.0),
    })
}
fn dose_ml(v: &mut Vessel, id: &str, ml: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(ml), mass_g: None, drops: None, temperature_k: None, solid_form: None }).unwrap();
}
fn run(v: &mut Vessel, seconds: f64, dt: f64) {
    for _ in 0..(seconds / dt).round() as usize {
        v.step(dt).unwrap();
    }
}

/// Viscosity of water follows the IAPWS-type curve at 0, 25 and 100 C (1.79, 0.89, 0.28 cP): the Andrade-style fit it replaced
/// gave 1.0 and 0.67 cP at the ends. A solvent mixture mixes logarithmically instead of taking water's value.
#[test]
fn water_viscosity_and_solvent_mixtures() {
    use reaction_chamber_engine::props::calculate_viscosity_cp;
    let none = |_: &str| None;
    let water = |t: f64| {
        let m: HashMap<String, f64> = [("H2O".to_string(), 55.5)].into_iter().collect();
        calculate_viscosity_cp(&m, t, 1000.0, &none)
    };
    assert!((water(273.15) - 1.79).abs() < 0.08, "0 C: {}", water(273.15));
    assert!((water(298.15) - 0.89).abs() < 0.03, "25 C: {}", water(298.15));
    assert!((water(373.15) - 0.28).abs() < 0.03, "100 C: {}", water(373.15));
    // an ethanol-rich mixture is thicker than either pure component's logarithmic mean would put it only if data say so; without a
    // record the default Andrade curve stands in for the co-solvent and the mixture lies between the components
    let m: HashMap<String, f64> = [("H2O".to_string(), 27.0), ("C2H5OH".to_string(), 8.5)].into_iter().collect();
    let eta = calculate_viscosity_cp(&m, 298.15, 1000.0, &|sp: &str| if sp == "C2H5OH" { Some((-6.44, 2180.0)) } else { None });
    assert!(eta > 0.5 && eta < 1.6, "mixture {}", eta);
}

/// Brine on graphite: chlorine is the anode product (oxygen evolution on carbon is sluggish), hydrogen the cathode product. This
/// needs the elemental halogens in the species store and oxygen-evolution kinetics for every H/O-only half-reaction, whatever
/// phase the oxygen leaves in (the dissolved-oxygen variant used to run with the generic prefactor and beat chloride).
#[test]
fn brine_electrolysis_makes_chlorine_on_graphite() {
    let mut v = beaker(298.15);
    v.species_mol.insert("H2O".into(), 100.0 / 18.015);
    v.species_mol.insert("Na+".into(), 0.1);
    v.species_mol.insert("Cl-".into(), 0.1);
    v.set_electrolysis(Some(ElectrolysisSpec {
        anode: ElectrodeSpec { material: "C".into(), area_cm2: 10.0 },
        cathode: ElectrodeSpec { material: "C".into(), area_cm2: 10.0 },
        supply: SupplyMode::Voltage(6.0),
        spacing_cm: 2.0,
        on: true,
    }));
    run(&mut v, 60.0, 0.5);
    let snap = v.snapshot();
    let ro = snap.electrolysis.expect("readout");
    let cl2: f64 = ro.rows.iter().filter(|r| r.electrode == "anode" && r.equation.contains("Cl2")).map(|r| r.current_a).sum();
    let o2: f64 = ro.rows.iter().filter(|r| r.electrode == "anode" && r.equation.contains("O2")).map(|r| r.current_a).sum();
    let h2: f64 = ro.rows.iter().filter(|r| r.electrode == "cathode" && r.equation.contains("H2(g)")).map(|r| r.current_a).sum();
    assert!(cl2 > o2 && cl2 > 0.3 * ro.current_a, "Cl2 {} A, O2 {} A of {} A", cl2, o2, ro.current_a);
    assert!(h2 > 0.8 * ro.current_a, "H2 {} A of {} A", h2, ro.current_a);
    assert!(ro.anode_potential_v > 1.4, "carbon needs an overpotential for O2: anode at {} V", ro.anode_potential_v);
    assert!(snap.gas_fluxes.iter().any(|f| f.species == "Cl2(g)"));
    // in a sulfate cell (nothing to oxidise but water) the anode gives oxygen, never ozone or peroxide as the main product
    let mut w = beaker(298.15);
    w.species_mol.insert("H2O".into(), 100.0 / 18.015);
    w.species_mol.insert("Na+".into(), 0.1);
    w.species_mol.insert("SO4-2".into(), 0.05);
    w.set_electrolysis(Some(ElectrolysisSpec {
        anode: ElectrodeSpec { material: "Pt".into(), area_cm2: 10.0 },
        cathode: ElectrodeSpec { material: "Pt".into(), area_cm2: 10.0 },
        supply: SupplyMode::Voltage(6.0),
        spacing_cm: 2.0,
        on: true,
    }));
    run(&mut w, 60.0, 0.5);
    let ro = w.snapshot().electrolysis.expect("readout");
    let o2: f64 = ro.rows.iter().filter(|r| r.electrode == "anode" && r.equation.contains("O2")).map(|r| r.current_a).sum();
    let o3: f64 = ro.rows.iter().filter(|r| r.electrode == "anode" && r.equation.contains("O3")).map(|r| r.current_a).sum();
    assert!(o2 > 5.0 * o3, "O2 {} A vs O3 {} A", o2, o3);
}

/// Thermal decomposition is found by the Gibbs-minimising product set of each solid, not by the arbitrary combinations of a null
/// space basis: adding species to the store (gases, solids with the same elements) must not change which reactions NaHCO3 and
/// CaCO3 have, and no formation of metals or carbon out of a carbonate is offered.
#[test]
fn decomposition_pathways_do_not_depend_on_the_store() {
    use reaction_chamber_engine::gem::discovery::discover_thermal_decompositions;
    let mut solids = HashMap::new();
    solids.insert("NaHCO3(s)".to_string(), 0.1);
    let at = |t: f64| discover_thermal_decompositions(&solids, t, 101_325.0);
    for t in [300.0, 420.0, 900.0] {
        let rxns = at(t);
        assert!(!rxns.is_empty(), "{} K", t);
        for r in &rxns {
            assert!(r.species_names.iter().all(|s| s != "Na(s)" && s != "C(s)" && s != "CH4(g)" && s != "O3(g)"), "{:?}", r.species_names);
        }
    }
    let r420 = at(420.0);
    let main = r420.iter().find(|r| r.species_names.iter().any(|s| s == "Na2CO3(s)")).expect("bicarbonate -> carbonate");
    assert!(main.delta_g0_j < 0.0, "decomposes at 420 K ({} kJ)", main.delta_g0_j / 1000.0);
    assert!(at(300.0).iter().find(|r| r.species_names.iter().any(|s| s == "Na2CO3(s)")).unwrap().delta_g0_j > 0.0, "stable at 300 K");
}

/// A discovered redox in water forms no compound solid that has no precipitation model: dilute Fe(II) / permanganate / iodide
/// does not make hematite or magnetite out of solution (they have no solubility row), while manganese dioxide from permanganate
/// and elemental deposits are allowed. Atoms are conserved: reactions that share a species are applied as one net change.
#[test]
fn redox_in_water_does_not_precipitate_oxides_without_a_model_and_conserves_atoms() {
    let mut v = beaker(295.15);
    dose_ml(&mut v, "water", 50.0);
    for (sp, mol) in [("Fe+2", 0.002), ("SO4-2", 0.002), ("I-", 0.002), ("K+", 0.0021), ("MnO4-", 0.0001)] {
        *v.species_mol.entry(sp.to_string()).or_insert(0.0) += mol;
        v.ledger.book_in(sp, mol);
    }
    run(&mut v, 300.0, 0.5);
    let c = v.snapshot().conservation;
    assert!(c.ok, "rel {:e} {:?}", c.max_element_rel_err, c.element_errors);
    let oxide = |sp: &str| v.solid_mol.get(sp).copied().unwrap_or(0.0);
    // (slow dehydration of the hydroxide may leave a trace of Fe2O3; magnetite needs the redox path that is closed)
    assert!(oxide("Fe3O4(s)") < 1e-9, "magnetite {} mol", oxide("Fe3O4(s)"));
    assert!(oxide("Fe2O3(s)") < 2e-6, "hematite {} mol", oxide("Fe2O3(s)"));
    assert!(oxide("MnO2(s)") > 1e-5, "permanganate gives manganese dioxide: {}", oxide("MnO2(s)"));
}

/// CO2 absorbs into sodium hydroxide while the air-equilibrated liquid is (by the 50 % relative humidity of the room air) a few
/// pascal supersaturated in total: surface exchange and bubble loss add, a gas far below saturation is not forbidden to absorb.
#[test]
fn undersaturated_gas_absorbs_while_the_liquid_is_marginally_supersaturated() {
    let mut v = beaker(298.15);
    dose_ml(&mut v, "water", 99.0);
    dose_ml(&mut v, "naoh_0_1m", 1.0);
    v.set_controls(VesselControls { stirring: Some(true), ..Default::default() });
    run(&mut v, 3600.0, 10.0);
    let carbonate: f64 = ["CO3-2", "HCO3-", "CO2(aq)", "H2CO3(aq)"].iter().map(|s| v.species_mol.get(*s).copied().unwrap_or(0.0)).sum();
    assert!(carbonate > 5e-5, "carbonate after an hour: {} mol", carbonate);
    assert!(v.current_ph() < 10.5, "pH {}", v.current_ph());
}

/// A mixed solvent changes the solvation of ions (Born): NaCl is far less soluble in water + ethanol than in water, and the shift
/// is zero for pure water. The dielectric constant of every component comes from a record (by InChIKey), else from its
/// composition: no compound name selects it.
#[test]
fn mixed_solvent_changes_ion_activity_and_dielectric_comes_from_data() {
    use reaction_chamber_engine::activity::BornTransferActivity;
    assert_eq!(BornTransferActivity::ln_gamma_born("Na+", reaction_chamber_engine::transport::dielectric_water(298.15), 298.15), 0.0);
    let half = BornTransferActivity::ln_gamma_born("Na+", 50.0, 298.15) + BornTransferActivity::ln_gamma_born("Cl-", 50.0, 298.15);
    assert!(half > 1.5 && half < 3.5, "Born shift of NaCl in eps 50: {} (ln units)", half);
    assert!(BornTransferActivity::ln_gamma_born("SO4-2", 50.0, 298.15) > BornTransferActivity::ln_gamma_born("Cl-", 50.0, 298.15), "z^2 scaling");
    assert!((reaction_chamber_engine::dielectric::tabulated_298("LFQSCWFLJHTTHZ-UHFFFAOYSA-N").unwrap() - 24.3).abs() < 1e-9);
}

/// Flocculation by the electrolyte is a rate: 10 nm AgCl nuclei in 0.05 M nitrate are still cloudy after a few seconds and have
/// flocculated (tens of micrometres) after about two minutes; a stable colloid (no electrolyte) does not aggregate; the flocs of a
/// well stirred suspension are smaller than those of a quiet one.
#[test]
fn flocculation_is_kinetic_and_limited_by_shear() {
    let floc = |stirred: bool| {
        let mut v = beaker(295.15);
        dose_ml(&mut v, "agno3_0_1m", 25.0);
        dose_ml(&mut v, "nacl_0_1m", 25.0);
        if stirred {
            v.set_controls(VesselControls { stirring: Some(true), stir_rpm: Some(600.0), ..Default::default() });
        }
        run(&mut v, 5.0, 0.5);
        let early = v.snapshot().solids[0].floc_diameter_um;
        run(&mut v, 175.0, 0.5);
        (early, v.snapshot().solids[0].floc_diameter_um)
    };
    let (early, late) = floc(false);
    assert!(late > 5.0 * early && late > 20.0, "quiet: {} -> {} um", early, late);
    let (_, late_stirred) = floc(true);
    assert!(late_stirred < late, "stirring breaks flocs: {} vs {} um", late_stirred, late);
    // pure water + a sparingly soluble salt without a screening electrolyte stays dispersed: nothing to flocculate it
    use reaction_chamber_engine::transfer::settling::{aggregation_rate_per_s, floc_solid_fraction, max_floc_diameter_m};
    assert_eq!(aggregation_rate_per_s(0.0, 1e21, 1e-7, 1e-3, 298.0, 0.5, 0.0), 0.0);
    assert!(floc_solid_fraction(1e-8, 1e-5) < 0.1);
    assert!(max_floc_diameter_m(1e-8, 1e-3, 0.2, 1e-6) > max_floc_diameter_m(1e-8, 1e-3, 200.0, 1e-6));
}

/// The aqueous standard state of a neutral solute without data carries a ring term: cyclic hydrocarbons dissolve more readily
/// than their open-chain isomers by about a kcal/mol.
#[test]
fn hydration_free_energy_has_a_ring_term() {
    use reaction_chamber_engine::hydration::hydration_gibbs_kj;
    use reaction_chamber_engine::smiles::parse;
    let g = |s: &str| hydration_gibbs_kj(&parse(s).unwrap()).unwrap() / 4.184;
    assert!(g("C1CCCCC1") < g("CCCCCC") - 0.8, "cyclohexane {} vs hexane {} kcal/mol", g("C1CCCCC1"), g("CCCCCC"));
    assert!(g("OC1CCCCC1") < g("CCCCCCO") - 0.5);
}
