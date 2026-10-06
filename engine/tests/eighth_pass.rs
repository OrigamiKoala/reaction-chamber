//! Gates of the eighth audit pass (ALGORITHM-IMPROVEMENT.md, section 2.10): homogeneous redox that the element-name gate used to
//! silence. None of them names a reaction in the engine; each one pins a general rule through the public API.
//!
//! * a couple whose two forms differ by electrons only (X2 / X-, Hg2+2 / Hg+2) is eligible by its structure, whatever the element;
//! * a couple that moves an oxygen atom is eligible only through a record's self-exchange rate (`data/redox_couples.json`);
//! * the driving force of the Marcus rate is that of the solution's own pH, and the H+ / OH- versions of one reaction are one;
//! * a trace reaction at equilibrium never throttles the real ones;
//! * no gas that is only a dissolved acid / anhydride (HI, SO3) and no metal made from an oxo anion comes out of a solution reaction.

use std::collections::HashMap;

use reaction_chamber_engine::gem::redox::is_electron_transfer_couple;
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
        stopper_pop_atm: Some(2.2),
        burst_atm: Some(6.0),
    })
}

/// 100 g of water with the given dissolved species (mol); returns the vessel after `secs` seconds.
fn react(mix: &[(&str, f64)], secs: f64) -> Vessel {
    let mut v = beaker();
    // through `add_portion`, so that the element ledger knows what went in
    let mut aqueous: HashMap<String, f64> = HashMap::new();
    aqueous.insert("H2O".into(), 100.0 / 18.015);
    for (id, n) in mix {
        *aqueous.entry(id.to_string()).or_insert(0.0) += n;
    }
    v.add_portion(Portion { volume_ml: 100.0, temperature_k: 298.15, aqueous_mol: aqueous, organic_mol: HashMap::new(), solid_mol: HashMap::new(), particles: HashMap::new(), forms: HashMap::new() }).unwrap();
    let mut t = 0.0;
    while t < secs {
        v.step(0.5).unwrap();
        t += 0.5;
    }
    v
}

fn amount(v: &Vessel, id: &str) -> f64 {
    v.species_mol.get(id).copied().unwrap_or(0.0) + v.solid_mol.get(id).copied().unwrap_or(0.0)
}

#[test]
fn couples_that_differ_by_electrons_only_are_found_by_structure() {
    for (a, b) in [("I2(aq)", "I-"), ("Cl2(aq)", "Cl-"), ("Br2(aq)", "Br-"), ("Hg2+2", "Hg+2"), ("Fe(CN)6-3", "Fe(CN)6-4")] {
        // the species that the store does not hold are not a failure of the rule
        if reaction_chamber_engine::ions::species_elements(a).is_some() && reaction_chamber_engine::ions::species_elements(b).is_some() {
            assert!(is_electron_transfer_couple(a, b), "{a} / {b} differ by electrons only");
        }
    }
    // atom, proton or ligand transfer, or only hydrogen and oxygen: not an electron-transfer couple
    // (S2O8-2 / SO4-2 has the multiples but breaks an O-O bond: a row of the data file, not a structural rule)
    for (a, b) in [("SO3-2", "SO4-2"), ("NO2-", "NO3-"), ("ClO-", "Cl-"), ("ClO3-", "ClO4-"), ("H2O2", "H2O"), ("O2(aq)", "H2O"), ("N2(aq)", "NH3"), ("H2(aq)", "H+"), ("ethene", "C2H5OH"), ("S2O8-2", "SO4-2"), ("S4O6-2", "S2O3-2")] {
        assert!(!is_electron_transfer_couple(a, b), "{a} / {b} move an atom");
    }
}

/// Bromine oxidises iodide, chlorine oxidises iron(II): both couples are electron transfers of an element that is in no list.
#[test]
fn halogens_oxidise_by_structure() {
    let v = react(&[("Br2(aq)", 0.002), ("I-", 0.004), ("K+", 0.004)], 60.0);
    assert!(amount(&v, "Br-") > 0.0036, "Br- {}", amount(&v, "Br-"));
    assert!(amount(&v, "Br2(aq)") < 2e-4, "Br2 {}", amount(&v, "Br2(aq)"));
    assert!(v.snapshot().conservation.ok);

    let v = react(&[("Cl2(aq)", 0.002), ("Fe+2", 0.004), ("SO4-2", 0.004)], 60.0);
    let fe3: f64 = ["Fe+3", "FeOH+2", "Fe(OH)2+", "FeSO4+", "FeCl+2", "Fe(OH)3(s)"].iter().map(|s| amount(&v, s)).sum();
    assert!(fe3 > 0.0033, "iron(III) {}", fe3);
    assert!(v.snapshot().conservation.ok);
}

/// Oxygen-atom-transfer couples with a self-exchange rate in the data: sulfite is oxidised by permanganate, iodine and
/// dichromate; nitrite by permanganate; hypochlorite oxidises iodide; the products are the aqueous species of the store.
#[test]
fn oxo_transfer_couples_with_data_react() {
    let v = react(&[("MnO4-", 0.002), ("K+", 0.002), ("SO3-2", 0.005), ("Na+", 0.01)], 60.0);
    assert!(amount(&v, "MnO4-") < 1e-4, "permanganate left {}", amount(&v, "MnO4-"));
    assert!(amount(&v, "SO4-2") + amount(&v, "HSO4-") > 0.0025, "sulfate {}", amount(&v, "SO4-2"));
    let snap = v.snapshot();
    assert!(snap.conservation.ok, "{:?}", snap.conservation.element_errors);
    // permanganate does not become manganese metal (the last step of the seven-electron reduction is uphill for a reductant)
    assert!(amount(&v, "Mn(s)") < 1e-9, "Mn(s) {}", amount(&v, "Mn(s)"));
    // nor does the solution lose sulfur trioxide as a gas
    assert!(snap.gas_fluxes.iter().all(|f| f.species != "SO3(g)"), "{:?}", snap.gas_fluxes);

    let v = react(&[("I2(aq)", 0.001), ("SO3-2", 0.002), ("Na+", 0.004)], 60.0);
    assert!(amount(&v, "SO4-2") + amount(&v, "HSO4-") > 0.0006, "sulfate {}", amount(&v, "SO4-2") + amount(&v, "HSO4-"));
    assert!(amount(&v, "I-") + amount(&v, "I3-") > 0.0012);
    assert!(v.snapshot().gas_fluxes.iter().all(|f| f.species != "HI(g)"));

    let v = react(&[("Cr2O7-2", 0.001), ("K+", 0.002), ("SO3-2", 0.004), ("Na+", 0.008), ("H+", 0.02), ("Cl-", 0.02)], 120.0);
    let cr3: f64 = ["Cr+3", "CrSO4+"].iter().map(|s| amount(&v, s)).sum();
    assert!(cr3 > 0.0018, "chromium(III) {}", cr3);

    let v = react(&[("ClO-", 0.003), ("Na+", 0.003), ("I-", 0.004), ("K+", 0.004)], 60.0);
    assert!(amount(&v, "ClO-") < 0.0006, "hypochlorite left {}", amount(&v, "ClO-"));
    assert!(amount(&v, "Cl-") > 0.002);
}

/// Hydrogen peroxide oxidises iodide at about the measured rate (0.0115 M-1 s-1 at 25 C for the uncatalysed path, recalled): the
/// rate comes from one effective self-exchange rate of the O-O couple and the Marcus cross relation, so it is within an order of
/// magnitude, and it follows the concentrations (second order).
#[test]
fn peroxide_iodide_rate_is_of_the_measured_order() {
    let i2_total = |v: &Vessel| amount(v, "I2(aq)") + amount(v, "I2(s)") + amount(v, "I3-");
    let secs = 120.0;
    let v = react(&[("H2O2", 0.003), ("I-", 0.002), ("K+", 0.002), ("H+", 0.01), ("SO4-2", 0.005)], secs);
    let x = i2_total(&v) / 0.1; // mol/L of I2 made
    // second order: dx/dt = k [H2O2] [I-] with the concentrations of the start (a few % consumed)
    let k = x / secs / (0.03 * 0.02);
    assert!(k > 0.0115 / 15.0 && k < 0.0115 * 15.0, "k = {:e} M-1 s-1 against 0.0115", k);
    // doubling the iodide doubles the rate
    let w = react(&[("H2O2", 0.003), ("I-", 0.004), ("K+", 0.004), ("H+", 0.01), ("SO4-2", 0.005)], secs);
    let ratio = i2_total(&w) / i2_total(&v);
    assert!(ratio > 1.6 && ratio < 2.4, "doubling iodide changed the rate by {}", ratio);
}

/// What must stay inert on bench time: the strong oxo ends (perchlorate, sulfate, nitrate), dinitrogen and oxygen against a
/// mild reductant. Thermodynamics allows several of these; the couples have no low barrier and no data.
#[test]
fn inert_couples_stay_inert() {
    let v = react(&[("ClO4-", 0.01), ("Na+", 0.01), ("I-", 0.01), ("K+", 0.01), ("H+", 0.1), ("Cl-", 0.1)], 120.0);
    assert!(amount(&v, "I-") > 0.0099, "iodide {}", amount(&v, "I-"));
    let v = react(&[("SO4-2", 0.01), ("Na+", 0.02), ("I-", 0.01), ("K+", 0.01), ("H+", 0.1), ("Cl-", 0.1)], 120.0);
    assert!(amount(&v, "I-") > 0.0099, "iodide {}", amount(&v, "I-"));
    let v = react(&[("NO3-", 0.01), ("Na+", 0.01), ("Fe+2", 0.01), ("SO4-2", 0.01), ("H+", 0.1), ("Cl-", 0.1)], 120.0);
    assert!(amount(&v, "Fe+2") + amount(&v, "FeSO4") > 0.0098, "iron(II) {}", amount(&v, "Fe+2"));
    // dinitrogen stays dinitrogen (it only leaves by degassing); it is not reduced to ammonium by iodide
    let v = react(&[("N2(aq)", 0.0002), ("I-", 0.01), ("K+", 0.01), ("H+", 0.1), ("Cl-", 0.1)], 120.0);
    assert!(amount(&v, "NH4+") + amount(&v, "NH3") < 1e-9, "ammonium {}", amount(&v, "NH4+"));
    assert!(amount(&v, "I-") + amount(&v, "I3-") > 0.0099);
}

/// The trace equilibria that the new couples add (nitrate / nitrite by iodide, iodate, ...) sit at their equilibrium and are
/// pushed past it by any real progress of the main reaction. They wait; they do not hold the main reaction back (it used to run
/// at 1/1000 of its speed, the scale at which nothing overshoots).
#[test]
fn trace_equilibria_do_not_throttle_the_main_reaction() {
    let v = react(&[("Fe+3", 0.004), ("NO3-", 0.012), ("I-", 0.002), ("K+", 0.002)], 30.0);
    let fe2 = amount(&v, "Fe+2") + amount(&v, "FeSO4");
    assert!(fe2 > 0.0012, "iron(II) after 30 s: {}", fe2);
    assert!(v.snapshot().conservation.ok);
}

/// Step size does not matter for the new reactions either: the same extent at 0.1 s, 0.5 s and 2 s steps (within the
/// first-order accuracy of the relaxation).
#[test]
fn redox_extent_does_not_depend_on_the_step() {
    let run = |dt: f64| {
        let mut v = beaker();
        let mut aqueous: HashMap<String, f64> = HashMap::new();
        aqueous.insert("H2O".into(), 100.0 / 18.015);
        for (k, n) in [("I2(aq)", 0.001), ("SO3-2", 0.002), ("Na+", 0.004)] {
            aqueous.insert(k.to_string(), n);
        }
        v.add_portion(Portion { volume_ml: 100.0, temperature_k: 298.15, aqueous_mol: aqueous, organic_mol: HashMap::new(), solid_mol: HashMap::new(), particles: HashMap::new(), forms: HashMap::new() }).unwrap();
        let mut t = 0.0;
        while t < 30.0 {
            v.step(dt).unwrap();
            t += dt;
        }
        amount(&v, "SO4-2") + amount(&v, "HSO4-")
    };
    let (a, b, c) = (run(0.1), run(0.5), run(2.0));
    assert!((a - b).abs() < 0.2 * a.max(1e-9) && (c - b).abs() < 0.2 * b.max(1e-9), "{a:e} {b:e} {c:e}");
}

// ---------------------------------------------------------------------------------------------------------------------
// Conservation bugs the store-wide fuzz found (they predate the redox work above and were silent before it).

fn sealed_beaker() -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: 250.0,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(295.15),
        room_k: Some(295.15),
        sealed: Some(true),
        stopper_pop_atm: Some(2.2),
        burst_atm: Some(6.0),
    })
}

fn portion(aqueous: HashMap<String, f64>) -> Portion {
    Portion { volume_ml: 80.0, temperature_k: 295.15, aqueous_mol: aqueous, organic_mol: HashMap::new(), solid_mol: HashMap::new(), particles: HashMap::new(), forms: HashMap::new() }
}

/// A molecule held under two liquid keys that share one gas phase (a neat liquid and its dissolved form: `Br2(l)` / `Br2(aq)`)
/// is one inventory in the sealed-vessel flash. It used to count the headspace gas once per key and write both back: dosing
/// 2 mmol of bromine into a stoppered flask made 3.8 mmol in 40 steps.
#[test]
fn a_sealed_flash_counts_the_gas_of_a_molecule_once() {
    let mut v = sealed_beaker();
    let mut m = HashMap::new();
    m.insert("H2O".to_string(), 80.0 / 18.015);
    m.insert("Br2(l)".to_string(), 0.002);
    v.add_portion(portion(m)).unwrap();
    for _ in 0..40 {
        v.step(0.5).unwrap();
    }
    let snap = v.snapshot();
    assert!(snap.conservation.ok, "{:?}", snap.conservation.element_errors);
    // every bromine atom is somewhere: the liquid, the dissolved molecule, the ions, the headspace
    let br: f64 = v.species_mol.iter().chain(v.headspace_gas_mol.iter()).filter(|(k, _)| k.starts_with("Br")).map(|(k, x)| x * if k.starts_with("Br2") { 2.0 } else { 1.0 }).sum();
    assert!((br - 0.004).abs() < 4e-6, "bromine atoms {br} against 0.004");
}

/// A solid that an *oxidation* makes at an electrode of a cell (iodine on a graphite anode) is booked with the electrode, like
/// the plating of a reduction: its atoms are no longer in the solution but they are not lost (the ledger of the vessel closes).
#[test]
fn solids_made_at_an_electrode_are_booked() {
    use reaction_chamber_engine::transfer::electrochem::SupplyMode;
    use reaction_chamber_engine::vessel_electro::{ElectrodeSpec, ElectrolysisSpec};
    for sealed in [false, true] {
        let mut v = if sealed { sealed_beaker() } else { beaker() };
        let mut m = HashMap::new();
        m.insert("H2O".to_string(), 80.0 / 18.015);
        m.insert("I-".to_string(), 0.008);
        m.insert("K+".to_string(), 0.008);
        v.add_portion(portion(m)).unwrap();
        v.set_electrolysis(Some(ElectrolysisSpec {
            anode: ElectrodeSpec { material: "C".into(), area_cm2: 10.0 },
            cathode: ElectrodeSpec { material: "C".into(), area_cm2: 10.0 },
            supply: SupplyMode::Voltage(5.0),
            spacing_cm: 2.0,
            on: true,
        }));
        for _ in 0..120 {
            v.step(0.5).unwrap();
        }
        let snap = v.snapshot();
        assert!(snap.conservation.ok, "sealed = {sealed}: {:?}", snap.conservation.element_errors);
        assert!(snap.electrolysis.as_ref().map_or(false, |r| r.charge_c > 1.0), "the cell passed current");
        assert!(amount(&v, "I-") < 0.00799, "iodide was oxidised: {}", amount(&v, "I-"));
    }
}
