//! Refits the ten constants of the EI model (`EiParams`) on the training split of the MassBank EI records by coordinate descent on
//! the mean cosine similarity (see `validate_ms.rs`); prints the parameters and the dev-split score after each sweep.
//! Usage: cargo run --release --example fit_ei -- <ei_train.jsonl> <ei_dev.jsonl> [n_train_subset] [sweeps]

use reaction_chamber_engine::analytical::ms_ei::EiParams;
use std::collections::BTreeMap;

#[path = "validate_ms.rs"]
#[allow(dead_code)]
mod vms;

fn vec_of(p: &EiParams) -> [f64; 10] {
    [p.theta, p.w2, p.tail, p.w_low, p.theta_low, p.s_factor, p.tau, p.cleave_shift, p.rearr_shift, p.keep]
}
fn params_of(v: &[f64; 10]) -> EiParams {
    EiParams { theta: v[0], w2: v[1], tail: v[2], w_low: v[3], theta_low: v[4], s_factor: v[5], tau: v[6], cleave_shift: v[7], rearr_shift: v[8], keep: v[9] }
}

fn score(path: &str, n: usize, v: &[f64; 10]) -> f64 {
    let mut by = BTreeMap::new();
    let (s, _, _) = vms::evaluate(path, n, &params_of(v), &mut by);
    let (b, m, _) = vms::summary(&s);
    m + 0.3 * b
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let (train, dev) = (&a[1], &a[2]);
    let n: usize = a.get(3).and_then(|x| x.parse().ok()).unwrap_or(800);
    let sweeps: usize = a.get(4).and_then(|x| x.parse().ok()).unwrap_or(3);
    let mut v = vec_of(&EiParams::default());
    let mut best = score(train, n, &v);
    println!("start: train score {:.4}", best);
    // additive steps for the shifts (which may be zero or negative), multiplicative for the rest
    for sweep in 0..sweeps {
        for k in 0..10 {
            for &f in &[1.25, 0.8, 1.1, 0.9] {
                let mut t = v;
                if k == 7 || k == 8 {
                    t[k] += (f - 1.0) * 2.0;
                } else {
                    t[k] *= f;
                }
                if t[1] > 0.95 || t[3] > 0.95 || t[9] > 1.0 || t[9] < 0.3 || t[0] < 0.2 {
                    continue;
                }
                let s = score(train, n, &t);
                if s > best + 1e-4 {
                    best = s;
                    v = t;
                    println!("  sweep {} param {} -> {:?} train {:.4}", sweep, k, t[k], best);
                    break;
                }
            }
        }
        let mut by = BTreeMap::new();
        let (s, _, _) = vms::evaluate(dev, usize::MAX, &params_of(&v), &mut by);
        let (b, m, md) = vms::summary(&s);
        println!("after sweep {}: train {:.4}; dev base peak {:.1}% cos mean {:.3} median {:.3}", sweep, best, 100.0 * b, m, md);
        println!("PARAMS {}", v.iter().map(|x| format!("{:e}", x)).collect::<Vec<_>>().join(","));
    }
}
