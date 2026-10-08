use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::compound_model::*;
use reaction_chamber_engine::vessel::*;
fn main() {
    let m = model_compound(&CompoundRequest { id: "nahco3_s".into(), name: "x".into(), formula: "CHNaO3".into(), smiles: None, mw: None, density: None, state: Some("solid".into()), molarity: None, ghs: vec![], ..Default::default() });
    if let Some(e) = &m.entry { chem_db::register_custom_reagent(e.clone()); }
    if let Some(min) = &m.mineral { chem_db::register_custom_mineral(min.clone()); }
    let mut v = Vessel::new(VesselConfig { vessel_type: "beaker-100".into(), capacity_ml: 100.0, glass_mass_g: 50.0, inner_radius_cm: 2.5, temperature_k: Some(295.15), room_k: Some(295.15), sealed: Some(false), stopper_pop_atm: Some(2.2), burst_atm: Some(6.0) });
    v.dose(DoseRequest { reagent_id: "water".into(), volume_ml: Some(50.0), mass_g: None, drops: None, temperature_k: None, solid_form: None }).unwrap();
    v.dose(DoseRequest { reagent_id: "nahco3_s".into(), volume_ml: None, mass_g: Some(2.5), drops: None, temperature_k: None, solid_form: None }).unwrap();
    for _ in 0..600 { v.step(0.5).unwrap(); }
    let mut names: Vec<_> = v.species_mol.iter().map(|(k, m)| format!("{}={:.4e}", k, m)).collect();
    names.sort();
    println!("{}\npH {:.3}", names.join("  "), v.current_ph());
}
