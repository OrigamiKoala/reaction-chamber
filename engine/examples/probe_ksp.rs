fn main() {
    use reaction_chamber_engine::*;
    for m in chem_db::get_mineral_registry() {
        if m.formula == "CaCO3" || m.mineral == "CaCO3" {
            println!("registry: id {} mineral {} formula {} solid {} log_ksp298 {} dh {} analytic {:?} source {}", m.id, m.mineral, m.formula, m.solid_species, m.log_ksp_298, m.delta_h_kj, m.log_ksp_analytic, m.source);
        }
    }
    let store = db::SpeciesStore::global();
    let g = store.read().unwrap();
    if let Some(r) = g.get("CaCO3(s)") {
        println!("store: {:?}", r.phases.get("s").and_then(|p| p.thermo.as_ref()).map(|t| (&t.params, &t.model, &t.source)));
    }
    println!("{}", thermo::k_sp::mineral_log_ksp("CaCO3", 373.15, 101325.0));
}
