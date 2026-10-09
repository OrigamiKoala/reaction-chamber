//! Gates of the Mayr nucleofugality relation (`data/mayr_nucleofugality.json`, read from Streidl 2010, Tables 5.1 / 5.2 / S1).
//!
//! What these gates are and are not: the parameters were fitted by their authors to the very rate constants of Table S1, so
//! reproducing those constants shows that the file was transcribed correctly and that the engine evaluates the relation correctly;
//! it does not test the relation against data it was not fitted to (there are no such data in an open table here).

use reaction_chamber_engine::rate_harness;
use serde_json::Value;

fn data() -> Value {
    serde_json::from_str(&std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/data/mayr_nucleofugality.json")).unwrap()).unwrap()
}

#[test]
fn the_file_reproduces_every_table_s1_halide_row_the_authors_fitted() {
    let d = data();
    let ef: std::collections::HashMap<String, f64> = d["electrofuges"].as_array().unwrap().iter().map(|e| (e["id"].as_str().unwrap().to_string(), e["ef"].as_f64().unwrap())).collect();
    let nf: std::collections::HashMap<String, (f64, f64)> =
        d["nucleofuges"].as_array().unwrap().iter().map(|n| (n["id"].as_str().unwrap().to_string(), (n["nf"].as_f64().unwrap(), n["sf"].as_f64().unwrap()))).collect();
    let rows = d["table_s1_halides"].as_array().unwrap();
    assert!(rows.len() >= 150, "{} rows", rows.len());
    let mut ratios = Vec::new();
    for r in rows {
        let (n, e) = (r["nucleofuge"].as_str().unwrap(), r["electrofuge"].as_str().unwrap());
        let (nfv, sf) = nf[n];
        let calc = 10f64.powf(sf * (nfv + ef[e]));
        let (kc, kx) = (r["k_calc"].as_f64().unwrap(), r["k_exp"].as_f64().unwrap());
        // the thesis prints Nf, sf to two decimals and k_calc to three figures: the recomputed value agrees to the rounding of the parameters
        assert!((calc / kc - 1.0).abs() < 0.08, "{n} {e}: sf (Nf + Ef) gives {calc:.3e}, Table S1 prints {kc:.3e}");
        ratios.push(kx / kc);
    }
    // the authors report an average factor of 1.1 between experiment and relation for the benzhydryl set
    let mean_log: f64 = ratios.iter().map(|x| x.log10().abs()).sum::<f64>() / ratios.len() as f64;
    assert!(mean_log < 0.1, "mean |log10 kexp/kcalc| = {mean_log}");
}

#[test]
fn the_generator_uses_the_relation_for_a_benzhydryl_halide_and_not_the_secondary_halide_rule() {
    let find = |smi: &str| {
        rate_harness::generate("sn1_ionisation", &[smi.to_string()], 298.15, "water")
            .into_iter()
            .find(|g| g.family_id == "sn1_ionisation")
            .unwrap_or_else(|| panic!("no ionisation generated for {smi}"))
    };
    let g = find("ClC(c1ccccc1)c1ccccc1");
    assert!(g.template_source.contains("nucleofugality relation"), "{}", g.template_source);
    let k = rate_harness::engine_k(&g, 298.15);
    let expected = 10f64.powf(0.96 * (3.84 - 6.03));
    assert!((k / expected - 1.0).abs() < 1e-6, "k {k:.4e} vs {expected:.4e}");
    // a plain secondary chloride keeps the rule (2-chloropropane: 1e-6 s-1 scale)
    let sec = find("CC(C)Cl");
    assert!(!sec.template_source.contains("nucleofugality"), "{}", sec.template_source);
    assert!(rate_harness::engine_k(&sec, 298.15) < 1e-4);
    // the more donor-substituted the ring, the faster: 4,4'-dimethoxybenzhydryl chloride vs benzhydryl chloride, Ef -2.09 vs -6.03 -> factor 10^(0.96 * 3.94)
    let m = find("COc1ccc(C(Cl)c2ccccc2)cc1");
    let ratio = rate_harness::engine_k(&m, 298.15) / k;
    assert!((ratio.log10() - 0.96 * (-2.09 + 6.03)).abs() < 1e-6, "{ratio:e}");
}
