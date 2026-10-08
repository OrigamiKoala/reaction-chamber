//! Prints what the network generator makes of reactants: `cargo run --release --example rates_probe -- <template> <T_K> <solvent_class> <SMILES>...`
//! (`<template>` is a family id with its variant tag, e.g. `acid_ester_hydrolysis_acid`, or `-` for any). Use it to find the
//! products and the rule a measured row has to name.

use reaction_chamber_engine::rate_harness;
use reaction_chamber_engine::rate_data;

fn main() {
    rate_data::ensure_loaded();
    let a: Vec<String> = std::env::args().skip(1).collect();
    if a.len() < 4 {
        eprintln!("usage: rates_probe <template|-> <T_K> <solvent_class> <SMILES>...");
        std::process::exit(2);
    }
    let (template, t_k, class) = (a[0].clone(), a[1].parse::<f64>().expect("T_K"), a[2].clone());
    let reactants: Vec<String> = a[3..].to_vec();
    let ph_template = if template == "-" { "x".to_string() } else { template.clone() };
    for g in rate_harness::generate(&ph_template, &reactants, t_k, &class) {
        if template != "-" && !g.rate_key.starts_with(&format!("{}|", template)) {
            continue;
        }
        let mut prods: Vec<String> = g.products.keys().cloned().collect();
        prods.sort();
        let mut reacts: Vec<String> = g.reactants.keys().cloned().collect();
        reacts.sort();
        println!(
            "{} | {} -> {} | rule k {:.4e} (A {:.3e} x{} Ea {:.1} kJ) | engine k {:.4e} | stored {} | {}",
            g.rate_key.split('|').next().unwrap_or(""),
            reacts.join(" + "),
            prods.join(" + "),
            rate_harness::rule_k(&g, t_k),
            g.template_a,
            g.pathways,
            g.template_ea_j_mol / 1000.0,
            rate_harness::engine_k(&g, t_k),
            g.rate_from_store,
            g.template_source.chars().take(70).collect::<String>()
        );
    }
}
