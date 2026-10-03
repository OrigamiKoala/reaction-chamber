//! Performance benchmark of the kinetics integrator the vessel runs (`kinetics::core::KineticExtentSystem`, adaptive ROS2
//! in extent coordinates) on a synthetic 50-species / 200-reaction reversible network. Native only: it reads the wall
//! clock, which wasm32-unknown-unknown does not provide.

use std::collections::HashMap;

use crate::kinetics::{KineticExtentReaction, KineticExtentSystem};
use crate::types::ProvenanceTier;
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

/// Synthetic network: 50 species, 200 bimolecular reversible reactions A + B <=> C + D with spread Arrhenius parameters.
/// Returns the system and the initial amounts (mol in 1 L).
pub fn build_50_species_200_reactions_network() -> (KineticExtentSystem, Vec<f64>) {
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
        let delta_h = -30.0 + ((r * 73) % 60) as f64;

        reactions.push(KineticExtentReaction {
            id: format!("Rxn_{:03}", r),
            equation: String::new(),
            reactants: vec![(s1, 1.0), (s2, 1.0)],
            products: vec![(p1, 1.0), (p2, 1.0)],
            gas_products: Vec::new(),
            orders_reactants: vec![(s1, 1.0), (s2, 1.0)],
            orders_products: vec![(p1, 1.0), (p2, 1.0)],
            arrhenius_a: a,
            arrhenius_n: 0.0,
            arrhenius_ea: ea,
            delta_h_kj: delta_h,
            catalyst_species: None,
            is_reversible: true,
            k_eq_298: Some(1.2 + (r % 10) as f64 * 0.1),
            tier: ProvenanceTier::Estimated,
            source: "benchmark".to_string(),
        });
    }

    let initial: Vec<f64> = (0..num_species).map(|i| 0.05 + (i as f64 * 0.002)).collect();
    (KineticExtentSystem::new(species_names, reactions), initial)
}

/// Runs the 50 species / 200 reactions benchmark for a given number of ticks of `dt` seconds.
pub fn run_benchmark(ticks: usize, dt: f64) -> BenchmarkResult {
    let (system, mut moles) = build_50_species_200_reactions_network();
    let temp_k = 298.15;
    let solids: HashMap<String, f64> = HashMap::new();

    let start = std::time::Instant::now();
    for _ in 0..ticks {
        let (xi, _) = system.integrate_extent_step(&moles, dt, 1.0, temp_k, 101_325.0, 0.0, &solids);
        for (i, m) in moles.iter_mut().enumerate() {
            for (r, x) in xi.iter().enumerate() {
                *m += system.nu[r][i] * x;
            }
            *m = m.max(0.0);
        }
    }
    let total_time_ms = start.elapsed().as_secs_f64() * 1000.0;
    let avg_tick_time_ms = total_time_ms / (ticks.max(1) as f64);

    BenchmarkResult {
        num_species: 50,
        num_reactions: 200,
        num_ticks: ticks,
        total_time_ms,
        avg_tick_time_ms,
        passed_target: avg_tick_time_ms < 5.0, // target is < 5 ms per tick
    }
}
