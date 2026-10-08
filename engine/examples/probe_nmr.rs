//! Prints, for every carbon of a SMILES, the increment-model shift and the environment table's correction (radius, count, sd).
//! Usage: cargo run --release --example probe_nmr -- "CN(C)C=O"
use reaction_chamber_engine::analytical::graph::Mol;
use reaction_chamber_engine::analytical::hose::*;
use reaction_chamber_engine::analytical::nmr::{c13_increment_shift, h1_increment_mean};

fn main() {
    let smi = std::env::args().nth(1).expect("smiles");
    let g = Mol::components_from_smiles(&smi).unwrap().remove(0);
    for i in 0..g.n() {
        if g.atoms[i].el != "C" {
            continue;
        }
        let c = predict(Kind::C13, &g, i);
        let h = predict(Kind::H1, &g, i);
        println!("C{} {:<3} 13C increments {:7.2}  table {:?} | 1H increments {:5.2}  table {:?}", i, g.atoms[i].el, c13_increment_shift(&g, i), c.map(|x| (x.0 as f32, x.1, x.2, x.3 as f32)), h1_increment_mean(&g, i), h.map(|x| (x.0 as f32, x.1, x.2, x.3 as f32)));
    }
}
