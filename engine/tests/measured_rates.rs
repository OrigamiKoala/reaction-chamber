//! Harness of the measured reaction rates (Sections 3.2 and 6 of docs/plans/rates-from-data-plan.md).
//!
//! Every row is evaluated against what the engine really builds: its reactants go through the network generator
//! (`rate_harness`), the reaction with the row's structural key is found, and the rate the engine uses is read from it.
//!
//! * Used rows (`data/rates_measured.json`, only values read from their source): the generated reaction exists, takes the stored
//!   rate, and reproduces the measured constant at the row's temperature to 1e-6.
//! * Held-out rows (`tests/fixtures/rates_held_out.json`, never loaded): the generated reaction exists, did NOT take a stored rate,
//!   and the rule's estimate (with its structural modifiers) is compared with the measurement: rms error per rule <= 0.7 log10
//!   (a factor 5) and no row beyond a factor 10, as the plan's gate says.
//! * The fit metadata written into `reaction_templates.json` (`n_points`, `held_out_rms_log10`) is checked against what this
//!   harness measures, so it cannot go stale, and a rule without a verified row must say "uncited".
//! * Marcus and Eigen-Wilkins are compared with reference values that were written from memory and are NOT verified; those two
//!   tests are sanity checks (an order of magnitude), not validations, and say so.
//!
//! Run `cargo test --release --test measured_rates -- --nocapture` to see the per-rule table.

use std::collections::BTreeMap;

use reaction_chamber_engine::rate_data::{self, OrganicRate, RedoxRate};
use reaction_chamber_engine::rate_harness;

#[derive(serde::Deserialize)]
struct OrganicFile {
    organic: Vec<OrganicRate>,
}

#[derive(serde::Deserialize)]
struct RedoxFile {
    redox: Vec<RedoxRate>,
}

fn used_rows() -> Vec<OrganicRate> {
    serde_json::from_str::<OrganicFile>(include_str!("../data/rates_measured.json")).expect("rates_measured.json").organic
}

fn held_out_rows() -> Vec<OrganicRate> {
    serde_json::from_str::<OrganicFile>(include_str!("fixtures/rates_held_out.json")).expect("rates_held_out.json").organic
}

fn name(r: &OrganicRate) -> String {
    format!("{} {} -> {}", r.template, r.reactants.join(" + "), r.products.join(" + "))
}

fn rule_of(source: &str) -> String {
    source.split("/ rule '").nth(1).and_then(|s| s.split('\'').next()).unwrap_or("?").to_string()
}

#[test]
fn every_used_row_connects_to_a_generated_reaction_and_is_reproduced() {
    rate_data::ensure_loaded();
    let rows = used_rows();
    assert!(rows.len() >= 40, "the shipped table holds {} organic rows", rows.len());
    let mut problems = Vec::new();
    for r in &rows {
        let Some(g) = rate_harness::find_reaction(&r.template, &r.reactants, &r.products, r.t_k, &r.solvent_class) else {
            problems.push(format!("no generated reaction for {}", name(r)));
            continue;
        };
        if !g.rate_from_store || !g.rate_per_reaction {
            problems.push(format!("{}: the generated reaction did not take the stored rate", name(r)));
            continue;
        }
        let k = rate_harness::engine_k(&g, r.t_k);
        if (k / r.k_m_s - 1.0).abs() > 1e-6 {
            problems.push(format!("{}: engine k {:.4e} vs measured {:.4e}", name(r), k, r.k_m_s));
        }
    }
    assert!(problems.is_empty(), "{} of {} rows do not reach the engine:\n{}", problems.len(), rows.len(), problems.join("\n"));
}

/// (template family, rule) -> (held-out errors log10, number of held-out rows)
fn held_out_errors() -> BTreeMap<(String, String), Vec<f64>> {
    rate_data::ensure_loaded();
    let mut out: BTreeMap<(String, String), Vec<f64>> = BTreeMap::new();
    for r in held_out_rows() {
        let g = rate_harness::find_reaction(&r.template, &r.reactants, &r.products, r.t_k, &r.solvent_class)
            .unwrap_or_else(|| panic!("no generated reaction for held-out row {}", name(&r)));
        assert!(!g.rate_from_store, "held-out row {} was loaded into the rate store", name(&r));
        let err = r.k_m_s.log10() - rate_harness::rule_k(&g, r.t_k).log10();
        out.entry((g.family_id.clone(), rule_of(&g.template_source))).or_default().push(err);
    }
    out
}

#[test]
fn held_out_rows_are_not_loaded_and_the_rules_meet_the_factor_five_gate() {
    let errors = held_out_errors();
    assert!(!errors.is_empty(), "no held-out rows");
    let mut failures = Vec::new();
    for ((family, rule), errs) in &errors {
        let rms = (errs.iter().map(|e| e * e).sum::<f64>() / errs.len() as f64).sqrt();
        let worst = errs.iter().fold(0.0f64, |m, e| m.max(e.abs()));
        println!("held out  {family} / {rule}: {} rows, rms {:.2} log10, worst {:.2}", errs.len(), rms, worst);
        if rms > 0.7 || worst > 1.0 {
            failures.push(format!("{family} / {rule}: rms {:.2}, worst {:.2} log10 (gate 0.7 / 1.0)", rms, worst));
        }
    }
    assert!(failures.is_empty(), "held-out gate failed:\n{}", failures.join("\n"));
}

#[test]
fn the_fit_metadata_of_the_rules_is_what_the_harness_measures() {
    let templates: serde_json::Value = serde_json::from_str(include_str!("../data/reaction_templates.json")).unwrap();
    let errors = held_out_errors();
    // training rows per rule, from the engine's own assignment
    let mut train: BTreeMap<(String, String), usize> = BTreeMap::new();
    for r in used_rows() {
        let g = rate_harness::find_reaction(&r.template, &r.reactants, &r.products, r.t_k, &r.solvent_class).expect("used row connects");
        *train.entry((g.family_id.clone(), rule_of(&g.template_source))).or_default() += 1;
    }
    let mut checked = 0;
    for t in templates["templates"].as_array().unwrap() {
        let id = t["id"].as_str().unwrap().to_string();
        let mut rules: Vec<&serde_json::Value> = t["rules"].as_array().map(|a| a.iter().collect()).unwrap_or_default();
        for v in t["variants"].as_array().into_iter().flatten() {
            rules.extend(v["rules"].as_array().into_iter().flatten());
        }
        for rule in rules {
            let rid = rule["id"].as_str().unwrap().to_string();
            let source = rule["source"].as_str().unwrap_or("");
            match rule.get("n_points").and_then(|n| n.as_u64()) {
                Some(n) => {
                    checked += 1;
                    assert_eq!(Some(&(n as usize)), train.get(&(id.clone(), rid.clone())), "{id} / {rid}: n_points {n} is not the number of training rows");
                    assert_eq!(rule["tier"], "estimated", "{id} / {rid}: a fitted rule is an estimate, not a tabulated value");
                    assert!(source.contains("verified rows"), "{id} / {rid}: source {source}");
                    if let Some(stated) = rule.get("held_out_rms_log10").and_then(|x| x.as_f64()) {
                        let errs = &errors[&(id.clone(), rid.clone())];
                        let rms = (errs.iter().map(|e| e * e).sum::<f64>() / errs.len() as f64).sqrt();
                        assert!((stated - rms).abs() < 0.1, "{id} / {rid}: the file says held-out rms {stated}, the engine gives {rms:.3}");
                    }
                }
                None => {
                    // Section 13.1: no verified row, so the rule says it is uncited and speculative
                    assert!(source.to_lowercase().contains("uncited"), "{id} / {rid}: no verified row and not labelled uncited: {source}");
                    assert_eq!(rule["tier"], "speculative", "{id} / {rid}");
                }
            }
        }
    }
    assert!(checked >= 7, "only {checked} fitted rules");
}

#[test]
fn redox_rows_reproduce_and_state_their_verification() {
    rate_data::ensure_loaded();
    let file: RedoxFile = serde_json::from_str(include_str!("../data/rates_measured.json")).unwrap();
    assert!(!file.redox.is_empty());
    for row in &file.redox {
        let entry = rate_data::redox_rate(&row.donor, &row.donor_product, &row.acceptor, &row.acceptor_product)
            .unwrap_or_else(|| panic!("redox row {} + {} not found", row.donor, row.acceptor));
        assert!((entry.k_at(row.t_k) / row.k_m_s - 1.0).abs() < 1e-6, "{} + {}", row.donor, row.acceptor);
        assert!(!row.source.trim().is_empty());
        assert!(matches!(row.verification.as_deref(), Some("verified") | Some("recalled")), "{} + {}: verification", row.donor, row.acceptor);
    }
}

/// NOT a validation: the reference cross rate was written from memory (it sits in `pipeline/data/rates_measured.csv` flagged
/// `recalled`). A Marcus estimate that is wrong by orders of magnitude would still show here.
#[test]
fn marcus_cross_relation_is_within_two_orders_of_recalled_cross_rates_sanity_only() {
    // Fe3+ + Cu+ -> Fe2+ + Cu2+ (recalled k = 5.2e4 M-1 s-1), E0 Fe3+/Fe2+ 0.77 V, Cu2+/Cu+ 0.15 V
    let dg = -0.62 * 96485.0;
    let et = reaction_chamber_engine::gem::rates::electron_transfer_rate("Cu+", "Cu+2", "Fe+3", "Fe+2", 1.0, dg, 298.15, 0.1);
    let ratio = et.k12 / 5.2e4;
    println!("Marcus Cu+ + Fe3+: {:.2e} vs recalled 5.2e4 (ratio {:.2})", et.k12, ratio);
    assert!(ratio > 0.01 && ratio < 100.0, "ratio {ratio}");
}

/// NOT a validation: the reference formation rates were written from memory. They guard against an Eigen-Wilkins estimate that is
/// off by orders of magnitude (a wrong units or a missing factor), nothing finer.
#[test]
fn eigen_wilkins_is_within_an_order_of_recalled_formation_rates_sanity_only() {
    use reaction_chamber_engine::substitution::eigen_wilkins_rate;
    // Ni2+ + NH3: recalled k_f ~ 3e3 M-1 s-1
    let ni = eigen_wilkins_rate("Ni+2", 2, 0, 3.0, 298.15).expect("Ni2+ is rate-limited by water exchange");
    let k = ni.terms[0].k_298;
    println!("Eigen-Wilkins Ni2+ + NH3: {:.2e} (recalled 3e3)", k);
    assert!(k / 3.0e3 > 0.1 && k / 3.0e3 < 10.0, "{k:e}");
    // Fe3+ + SCN- (aqua path, pH 0 where the hydroxo path is negligible): recalled observed ~1e2..1e3 M-1 s-1. Fe3+ is an associative
    // (Ia) ion in the literature, for which the plan says the relation is reported, not asserted: the estimate lands within two
    // orders of magnitude, which is all this guards. The hydroxo path (FeOH2+, Id) is compared in the unit tests of substitution.rs
    // only for its pH dependence.
    let fe = eigen_wilkins_rate("Fe+3", 3, -1, 3.5, 298.15).expect("Fe3+");
    let conc = |sp: &str| if sp == "OH-" { 1.0e-14 } else { 0.0 };
    let k = fe.k_forward(298.15, &conc);
    println!("Eigen-Wilkins Fe3+ + SCN- (pH 0, aqua path): {:.2e} (recalled 1e2..1e3)", k);
    assert!(k > 1.0e1 && k < 1.0e5, "{k:e}");
}

#[test]
fn the_mayr_relation_reaches_the_reaction_and_is_per_solvent() {
    // benzylidenemalononitrile (E = -9.42) + propylamine in water (N = 13.33, sN = 0.56, both rows of the Mayr database)
    let acceptor = "N#CC(C#N)=Cc1ccccc1".to_string();
    let amine = "CCCN".to_string();
    let g = rate_harness::generate("michael_addition", &[acceptor.clone(), amine.clone()], 293.15, "water")
        .into_iter()
        .find(|g| g.family_id == "michael_addition")
        .expect("the Michael addition is generated");
    assert!(g.template_source.contains("Mayr relation"), "{}", g.template_source);
    let expected = 10f64.powf(0.56 * (13.33 - 9.42));
    let k = rate_harness::engine_k(&g, 293.15);
    assert!((k / expected - 1.0).abs() < 0.02, "engine k {k:.4e} vs sN (N + E) = {expected:.4e}");
    assert!(g.rate_per_reaction, "a Mayr constant is that of the whole reaction: the pathways of the template match are not added");
    // N and sN are per solvent and there is no cross-solvent N: hydroxide has rows in water only
    let g = rate_harness::generate("michael_addition", &[acceptor, "[OH-]".to_string()], 293.15, "alkane")
        .into_iter()
        .find(|g| g.family_id == "michael_addition");
    if let Some(g) = g {
        assert!(!g.template_source.contains("Mayr relation"), "a water N was used in an alkane: {}", g.template_source);
    }
}

#[test]
fn carbocation_trapping_charges_balance_and_use_mayr() {
    // bis(4-methoxyphenyl)carbenium (E = 0.00) + water (N = 5.20, sN = 0.89): k = 10^(0.89 * 5.2) s-1, the proton is released
    let cation = "[H][C+](c1ccc(OC)cc1)c1ccc(OC)cc1".to_string();
    let g = rate_harness::generate("carbocation_trapping_by_solvent", &[cation.clone(), "O".to_string()], 293.15, "water")
        .into_iter()
        .find(|g| g.family_id == "carbocation_trapping_by_solvent")
        .expect("trapping by water");
    let charge = |m: &std::collections::HashMap<String, f64>| m.keys().map(|k| reaction_chamber_engine::ions::species_charge(k) as f64 * m[k]).sum::<f64>();
    assert!((charge(&g.reactants) - charge(&g.products)).abs() < 1e-9, "charge: {:?} -> {:?}", g.reactants, g.products);
    assert!(g.products.keys().any(|k| k == "H+"), "the alcohol loses its proton: {:?}", g.products);
    assert!(g.template_source.contains("Mayr relation"), "{}", g.template_source);
    // an amine adds without losing a proton: the product is the ammonium ion
    let a = rate_harness::generate("carbocation_trapping_by_amine", &[cation, "CCCN".to_string()], 293.15, "water")
        .into_iter()
        .find(|g| g.family_id == "carbocation_trapping_by_amine")
        .expect("trapping by an amine");
    assert!((charge(&a.reactants) - charge(&a.products)).abs() < 1e-9, "charge: {:?} -> {:?}", a.reactants, a.products);
}
