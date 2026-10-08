//! Step time of the busy mixture of tests/wasm_e2e.mjs (carbonate, ammonium, phosphate, calcium, copper, silver, acetic acid).
use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::compound_model::*;
use reaction_chamber_engine::vessel::*;

fn imp(id: &str, formula: &str, molarity: f64) {
    let m = model_compound(&CompoundRequest { id: id.into(), name: id.into(), formula: formula.into(), smiles: None, mw: None, density: None, state: Some("liquid".into()), molarity: Some(molarity), ghs: vec![], ..Default::default() });
    if let Some(e) = &m.entry {
        chem_db::register_custom_reagent(e.clone());
    }
    if let Some(min) = &m.mineral {
        chem_db::register_custom_mineral(min.clone());
    }
}

fn main() {
    for (id, f, m) in [("x_Na2CO3", "CNa2O3", 0.5), ("x_NH4Cl", "ClH4N", 1.0), ("x_Na3PO4", "Na3O4P", 0.2), ("x_CaCl2", "CaCl2", 0.5)] {
        imp(id, f, m);
    }
    let mut v = Vessel::new(VesselConfig { vessel_type: "beaker-250".into(), capacity_ml: 250.0, glass_mass_g: 110.0, inner_radius_cm: 3.5, temperature_k: Some(298.15), room_k: Some(298.15), sealed: Some(false), stopper_pop_atm: Some(2.2), burst_atm: Some(6.0) });
    for (id, ml) in [("water", 50.0), ("x_Na2CO3", 20.0), ("x_NH4Cl", 20.0), ("x_Na3PO4", 10.0), ("x_CaCl2", 10.0), ("cuso4_0_1m", 10.0), ("agno3_0_1m", 5.0), ("ch3cooh_5pct", 10.0)] {
        v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(ml), mass_g: None, drops: None, temperature_k: None, solid_form: None }).unwrap();
    }
    for _ in 0..20 {
        v.step(0.05).unwrap();
    }
    let mut best = f64::INFINITY;
    for _ in 0..3 {
        let t0 = std::time::Instant::now();
        for _ in 0..600 {
            v.step(0.05).unwrap();
        }
        best = best.min(t0.elapsed().as_secs_f64() * 1000.0 / 600.0);
    }
    let mut names: Vec<_> = v.species_mol.iter().map(|(k, m)| format!("{}={:.2e}", k, m)).collect();
    names.sort();
    println!("{}", names.join("  "));
    println!("equilibria {} minerals {} kinetic {}", v.equilibria.len(), v.minerals.len(), v.kinetic_reactions.len());
    println!("busy mixture: {:.2} ms/step, {} species", best, v.species_mol.len());
}
