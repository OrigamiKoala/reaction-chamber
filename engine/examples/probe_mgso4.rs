use reaction_chamber_engine::vessel::*;
use std::collections::HashMap;
fn main() {
    let mut v = Vessel::new(VesselConfig { vessel_type: "beaker-1000".into(), capacity_ml: 1000.0, glass_mass_g: 400.0, inner_radius_cm: 5.5, temperature_k: Some(298.15), room_k: Some(298.15), sealed: Some(false), stopper_pop_atm: Some(2.2), burst_atm: Some(6.0) });
    let mut aq: HashMap<String, f64> = HashMap::new();
    aq.insert("H2O".into(), 500.0 * 0.997 / 18.015);
    aq.insert("Mg+2".into(), 0.05);
    aq.insert("SO4-2".into(), 0.05);
    v.add_portion(Portion { volume_ml: 500.0, temperature_k: 298.15, aqueous_mol: aq, organic_mol: HashMap::new(), solid_mol: HashMap::new(), particles: HashMap::new(), forms: HashMap::new() }).unwrap();
    v.equilibrate(60.0);
    let mut names: Vec<_> = v.species_mol.iter().map(|(k, m)| format!("{}={:.4e}", k, m)).collect();
    names.sort();
    println!("{}", names.join("\n"));
    println!("equilibria: {:?}", v.equilibria.iter().map(|e| (e.id.clone(), e.log_k_298)).filter(|(i, _)| i.contains("Mg") || i.contains("SO4")).collect::<Vec<_>>());
}
