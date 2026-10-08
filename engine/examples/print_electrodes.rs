fn main() {
    let l = reaction_chamber_engine::vessel_electro::electrode_materials();
    println!("{}", l.iter().map(|m| format!("'{}'", m.symbol)).collect::<Vec<_>>().join(", "));
    println!("{} materials, {} inert", l.len(), l.iter().filter(|m| m.inert).count());
}
