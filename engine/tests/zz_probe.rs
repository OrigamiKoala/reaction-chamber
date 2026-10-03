use std::collections::HashMap;
use reaction_chamber_engine::network_generator::*;
#[test]
fn probe() {
    let sp = ["CH3COCH3","C2H5OH","CH3COOC2H5","NaOH","HCl","CH3CH(Br)CH3","cyclohexene","benzene","H2O","NH3"];
    let mut concs = HashMap::new();
    for s in sp { concs.insert(s.to_string(), 0.1); eprintln!("{} -> mol {:?} nuc {:?}", s, resolve_molecule(s).map(|m| m.to_smiles()), nucleophile_of(s).map(|x| x.0)); }
    let g = NetworkGenerator::new(NetworkGeneratorConfig::default());
    let net = g.generate_network(&concs, 298.15, 7.0);
    for r in &net.reactions { eprintln!("{} k={:e} K={:e} {}", r.id, r.k_fwd, r.k_eq, r.source); }
    eprintln!("rejected {}", net.candidates_rejected);
}
#[test]
fn bench_time() { let r = reaction_chamber_engine::benchmark::run_benchmark(50, 0.05); eprintln!("BENCH {:.3} ms/tick", r.avg_tick_time_ms); }
