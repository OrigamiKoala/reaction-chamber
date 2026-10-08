//! Exports, for every measured organic row, what the engine's template rules estimate (Section 4.4 of rates-from-data-plan.md):
//! each row's reactants go through the network generator, the reaction with the row's structural key is found, and the rule
//! that fires for it (with every modifier that applies) gives `log_k_rule`. Nothing here guesses which rule a row belongs to.
//! The regression itself is `pipeline/fit_template_rates.py`, which reads the export, fits the rule constants and structural
//! modifiers on the training rows only, and writes `reaction_templates.json`.
//!
//! Rows: `data/rates_measured.json` (organic) = training; `tests/fixtures/rates_held_out.json` = held out, never fitted.
//! Usage: cargo run --release --example fit_template_rules -- [--export <path>]   (prints a summary either way)

use std::collections::BTreeMap;
use std::path::Path;

use reaction_chamber_engine::rate_data::OrganicRate;
use reaction_chamber_engine::rate_harness;
use serde::Deserialize;

#[derive(Deserialize)]
struct Rows {
    organic: Vec<OrganicRate>,
}

struct Obs {
    held_out: bool,
    t_k: f64,
    log_k_meas: f64,
    log_k_rule: f64,
    ea_meas_kj: Option<f64>,
    ea_rule_kj: f64,
    reactants: Vec<String>,
}

fn rule_of(source: &str) -> Option<String> {
    let after = source.split("/ rule '").nth(1)?;
    Some(after.split('\'').next()?.to_string())
}

fn rms(v: &[f64]) -> f64 {
    (v.iter().map(|x| x * x).sum::<f64>() / v.len() as f64).sqrt()
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let export = args.iter().position(|a| a == "--export").and_then(|i| args.get(i + 1)).cloned();
    let manifest = env!("CARGO_MANIFEST_DIR");
    let used: Rows = serde_json::from_str(&std::fs::read_to_string(Path::new(manifest).join("data/rates_measured.json")).unwrap()).unwrap();
    let held: Rows = serde_json::from_str(&std::fs::read_to_string(Path::new(manifest).join("tests/fixtures/rates_held_out.json")).unwrap()).unwrap();
    let mut groups: BTreeMap<(String, String), Vec<Obs>> = BTreeMap::new();
    let mut unconnected = Vec::new();
    for (rows, held_out) in [(&used.organic, false), (&held.organic, true)] {
        for row in rows {
            let Some(g) = rate_harness::find_reaction(&row.template, &row.reactants, &row.products, row.t_k, &row.solvent_class) else {
                unconnected.push(format!("{} {} -> {}", row.template, row.reactants.join(" + "), row.products.join(" + ")));
                continue;
            };
            let Some(rule) = rule_of(&g.template_source) else { continue };
            groups.entry((g.family_id.clone(), rule)).or_default().push(Obs {
                held_out,
                t_k: row.t_k,
                log_k_meas: row.k_m_s.log10(),
                log_k_rule: rate_harness::rule_k(&g, row.t_k).log10(),
                ea_meas_kj: row.ea_kj_mol,
                ea_rule_kj: g.template_ea_j_mol / 1000.0,
                reactants: row.reactants.clone(),
            });
        }
    }
    println!("rows that do not connect to a generated reaction: {}", unconnected.len());
    for u in &unconnected {
        println!("  {}", u);
    }
    let mut rows_out = Vec::new();
    for ((family, rule), obs) in &groups {
        let train: Vec<&Obs> = obs.iter().filter(|o| !o.held_out).collect();
        let held: Vec<&Obs> = obs.iter().filter(|o| o.held_out).collect();
        let err = |v: &[&Obs]| v.iter().map(|o| o.log_k_meas - o.log_k_rule).collect::<Vec<f64>>();
        println!(
            "{family} / {rule}: {} training rows, rms error of the rule {:.2} log10; {} held out, rms {}",
            train.len(),
            if train.is_empty() { f64::NAN } else { rms(&err(&train)) },
            held.len(),
            if held.is_empty() { "n/a".to_string() } else { format!("{:.2}", rms(&err(&held))) }
        );
        for o in obs {
            rows_out.push(serde_json::json!({
                "template": family, "rule": rule, "reactants": o.reactants, "held_out": o.held_out, "t_k": o.t_k,
                "log_k_meas": o.log_k_meas, "log_k_rule": o.log_k_rule, "ea_meas_kj": o.ea_meas_kj, "ea_rule_kj": o.ea_rule_kj,
            }));
        }
    }
    if let Some(path) = export {
        std::fs::write(&path, serde_json::to_string_pretty(&serde_json::json!({ "rows": rows_out })).unwrap() + "\n").unwrap();
        println!("wrote {}", path);
    }
}
