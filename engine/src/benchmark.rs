use crate::kinetics::{rosenbrock_step, KineticNetwork, KineticReaction};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BenchmarkResult {
    pub num_species: usize,
    pub num_reactions: usize,
    pub num_ticks: usize,
    pub total_time_ms: f64,
    pub avg_tick_time_ms: f64,
    pub passed_target: bool,
}

/// Generates a test network with 50 species and 200 reactions
pub fn build_50_species_200_reactions_network() -> (KineticNetwork, Vec<f64>) {
    let num_species = 50;
    let num_reactions = 200;

    let species_names: Vec<String> = (0..num_species).map(|i| format!("Spec_{:02}", i)).collect();
    let mut reactions = Vec::with_capacity(num_reactions);

    for r in 0..num_reactions {
        let s1 = r % num_species;
        let s2 = (r + 1) % num_species;
        let p1 = (r + 7) % num_species;
        let p2 = (r + 13) % num_species;

        let a = 1.0e3 + ((r * 37) % 5000) as f64;
        let ea = 20000.0 + ((r * 101) % 30000) as f64;
        let delta_h = -30000.0 + ((r * 73) % 60000) as f64;

        reactions.push(KineticReaction {
            name: format!("Rxn_{:03}", r),
            reactants: vec![(s1, 1.0), (s2, 1.0)],
            products: vec![(p1, 1.0), (p2, 1.0)],
            arrhenius_a: a,
            arrhenius_n: 0.0,
            arrhenius_ea: ea,
            delta_h,
            is_reversible: true,
            k_eq_298: Some(1.2 + (r % 10) as f64 * 0.1),
            stoich_reactants: None,
            stoich_products: None,
        });
    }

    let initial_concs: Vec<f64> = (0..num_species).map(|i| 0.05 + (i as f64 * 0.002)).collect();

    (KineticNetwork { species_names, reactions }, initial_concs)
}

/// Runs the 50 species / 200 reactions benchmark for a given number of ticks
pub fn run_benchmark(ticks: usize, dt: f64) -> BenchmarkResult {
    let (network, mut concs) = build_50_species_200_reactions_network();
    let temp_k = 298.15;

    // Measure time
    let start = std::time::Instant::now();
    for _ in 0..ticks {
        concs = rosenbrock_step(&network, &concs, dt, temp_k);
    }
    let elapsed = start.elapsed();
    let total_time_ms = elapsed.as_secs_f64() * 1000.0;
    let avg_tick_time_ms = total_time_ms / (ticks as f64);

    BenchmarkResult {
        num_species: 50,
        num_reactions: 200,
        num_ticks: ticks,
        total_time_ms,
        avg_tick_time_ms,
        passed_target: avg_tick_time_ms < 5.0, // target is < 5 ms per tick
    }
}
