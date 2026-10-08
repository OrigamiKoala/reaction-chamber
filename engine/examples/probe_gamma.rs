use std::collections::HashMap;
fn main() {
    use reaction_chamber_engine::activity::*;
    let mut sp: HashMap<String, f64> = HashMap::new();
    sp.insert("H2O".into(), 500.0 / 18.015);
    for (k, v) in [("Mg+2", 0.0262), ("SO4-2", 0.0262), ("MgSO4", 0.0238)] {
        sp.insert(k.into(), v);
    }
    let (g, aw) = batch_aqueous_gamma_and_aw(&sp, 298.15);
    let mut v: Vec<_> = g.iter().collect();
    v.sort_by(|a, b| a.0.cmp(b.0));
    for (k, x) in v { println!("{k}: ln gamma {x:.4}  gamma {:.4}", x.exp()); }
    println!("aw {aw}");
    println!("size Mg+2 {}  SO4-2 {}", BDotActivity::ion_size_angstrom("Mg+2"), BDotActivity::ion_size_angstrom("SO4-2"));
}
