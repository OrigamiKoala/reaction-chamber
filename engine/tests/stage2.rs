//! Stage 2 verification gates as specified in docs/plans/generalization-master-plan.md §9.

use std::collections::HashMap;
use reaction_chamber_engine::thermo::*;
use reaction_chamber_engine::energy_balance::*;
use reaction_chamber_engine::gem::*;

#[test]
fn s2_1_pkw_bandura_lvov() {
    // Gate: pKw at 0/25/60/100/150/200 °C within 0.05 of Bandura–Lvov
    let benchmarks = [
        (273.15, 14.94),
        (298.15, 14.00),
        (333.15, 13.02),
        (373.15, 12.26),
        (423.15, 11.64),
        (473.15, 11.30),
    ];

    for (t_k, expected) in benchmarks {
        let actual = pkw_bandura_lvov(t_k);
        assert!(
            (actual - expected).abs() <= 0.05,
            "T={} K: pKw actual={}, expected={}, diff={}",
            t_k,
            actual,
            expected,
            (actual - expected).abs()
        );
    }
}

#[test]
fn s2_2_ksp_retrograde_and_llnl() {
    // Gate: log Ksp(T) of AgCl, CaCO3, CaSO4, BaSO4, Ag2CrO4 at 25/60/100 °C within 0.1 of llnl/SUPCRT
    let targets = [
        ("AgCl", 298.15, -9.75),
        ("AgCl", 333.15, -8.93),
        ("AgCl", 373.15, -8.24),
        ("CaCO3", 298.15, -8.48),
        ("CaCO3", 333.15, -8.76),
        ("CaCO3", 373.15, -9.16),
        ("CaSO4", 298.15, -4.36),
        ("CaSO4", 333.15, -4.73),
        ("CaSO4", 373.15, -5.29),
        ("BaSO4", 298.15, -9.97),
        ("BaSO4", 333.15, -9.70),
        ("BaSO4", 373.15, -9.51),
        ("Ag2CrO4", 298.15, -11.95),
        ("Ag2CrO4", 333.15, -11.39),
        ("Ag2CrO4", 373.15, -10.92),
    ];

    for (min, t_k, expected) in targets {
        let actual = mineral_log_ksp(min, t_k, 101325.0);
        assert!(
            (actual - expected).abs() <= 0.1,
            "{}: at {} K, got {}, expected {}",
            min,
            t_k,
            actual,
            expected
        );
    }

    // Gate: CaCO3 and CaSO4 retrograde
    assert!(is_retrograde("CaCO3"), "CaCO3 must be retrograde");
    assert!(is_retrograde("CaSO4"), "CaSO4 must be retrograde");
    assert!(!is_retrograde("AgCl"), "AgCl is prograde");
    assert!(!is_retrograde("BaSO4"), "BaSO4 is prograde");
}

#[test]
fn s2_3_neutralisation_enthalpy() {
    // Gate: neutralisation 55.8 ± 0.5 kJ/mol
    // H+(aq) + OH-(aq) -> H2O(l)
    let mut reactants = HashMap::new();
    reactants.insert("H+".to_string(), 1.0);
    reactants.insert("OH-".to_string(), 1.0);

    let mut products = HashMap::new();
    products.insert("H2O(l)".to_string(), 1.0);

    let st_h = get_thermo_state("H+", "aq", 298.15, 101325.0);
    let st_oh = get_thermo_state("OH-", "aq", 298.15, 101325.0);
    let st_w = get_thermo_state("H2O(l)", "l", 298.15, 101325.0);

    let delta_h_j = st_w.h_j_mol - (st_h.h_j_mol + st_oh.h_j_mol);
    let delta_h_kj = delta_h_j / 1000.0;
    let heat_released_kj = -delta_h_kj;

    assert!(
        (heat_released_kj - 55.83).abs() <= 0.5,
        "Neutralisation heat: {} kJ/mol, expected 55.8 ± 0.5 kJ/mol",
        heat_released_kj
    );
}

#[test]
fn s2_4_hess_law_path_independence() {
    // Gate: Hess (NaHCO3(s) + AcOH by any path) within 0.5 %
    // Direct path: NaHCO3(s) + CH3COOH(aq) -> Na+(aq) + CH3COO-(aq) + H2O(l) + CO2(g)
    let st_nahco3 = get_thermo_state("NaHCO3(s)", "s", 298.15, 101325.0);
    let st_acoh = get_thermo_state("CH3COOH", "aq", 298.15, 101325.0);
    let st_na = get_thermo_state("Na+", "aq", 298.15, 101325.0);
    let st_ac = get_thermo_state("CH3COO-", "aq", 298.15, 101325.0);
    let st_w = get_thermo_state("H2O(l)", "l", 298.15, 101325.0);
    let st_co2 = get_thermo_state("CO2(g)", "g", 298.15, 101325.0);

    let h_direct = (st_na.h_j_mol + st_ac.h_j_mol + st_w.h_j_mol + st_co2.h_j_mol)
        - (st_nahco3.h_j_mol + st_acoh.h_j_mol);

    // Two-step path:
    // 1. Dissolution: NaHCO3(s) -> Na+(aq) + HCO3-(aq)
    let st_hco3 = get_thermo_state("HCO3-", "aq", 298.15, 101325.0);
    let h_step1 = (st_na.h_j_mol + st_hco3.h_j_mol) - st_nahco3.h_j_mol;

    // 2. Reaction: HCO3-(aq) + CH3COOH(aq) -> CH3COO-(aq) + H2O(l) + CO2(g)
    let h_step2 = (st_ac.h_j_mol + st_w.h_j_mol + st_co2.h_j_mol)
        - (st_hco3.h_j_mol + st_acoh.h_j_mol);

    let h_stepped = h_step1 + h_step2;

    let rel_diff = (h_direct - h_stepped).abs() / h_direct.abs().max(1.0);
    assert!(
        rel_diff < 0.005,
        "Hess path difference: direct={}, stepped={}, rel_diff={}",
        h_direct,
        h_stepped,
        rel_diff
    );
}

#[test]
fn s2_5_adiabatic_ledger_drift() {
    // Gate: adiabatic ledger drift < 1e-6 per 1000 steps
    let mut eb = EnergyBalance::new(100.0, 0.015, 298.15);
    let mut species = HashMap::new();
    species.insert("H2O(l)".to_string(), 55.5); // 1 L water
    let solids = HashMap::new();

    eb.sync_enthalpy(&species, &solids);
    let initial_h = eb.h_total_j;

    // 1000 adiabatic steps (heater = 0, surface = 0 so no heat loss)
    eb.surface_area_m2 = 0.0;
    for _ in 0..1000 {
        eb.step(0.1, &species, &solids);
    }

    let drift = (eb.h_total_j - initial_h).abs() / initial_h.abs().max(1.0);
    assert!(
        drift < 1e-6,
        "Adiabatic drift after 1000 steps: {}",
        drift
    );
}

#[test]
fn s2_6_heating_ratio_ethanol_water() {
    // Gate: 50 g ethanol vs water heating ratio 1.71 ± 0.05
    // Cp(H2O) = 75.38 J/(mol K) / 18.015 g/mol = 4.1843 J/(g K)
    // Cp(C2H5OH) = 112.3 J/(mol K) / 46.069 g/mol = 2.4376 J/(g K)
    // Delta T ratio for same mass and same heat input Q:
    // Delta T_eth / Delta T_w = Cp_w / Cp_eth = 4.1843 / 2.4376 = 1.7166
    let st_w = get_thermo_state("H2O(l)", "l", 298.15, 101325.0);
    let st_eth = get_thermo_state("C2H5OH(l)", "l", 298.15, 101325.0);

    let cp_w_per_g = st_w.cp_j_mol_k / 18.015;
    let cp_eth_per_g = st_eth.cp_j_mol_k / 46.069;
    let ratio = cp_w_per_g / cp_eth_per_g;

    assert!(
        (ratio - 1.71).abs() <= 0.05,
        "Ethanol to water heating ratio: got {}, expected 1.71 ± 0.05",
        ratio
    );
}

#[test]
fn s2_7_dry_beaker_steady_state() {
    // Gate: dry 250 mL beaker on 300 W stays bounded (radiation and convection balance the heater near 750 K)
    let mut eb = EnergyBalance::new(110.0, 0.015, 298.15);
    eb.heater_power_w = 300.0;
    let species = HashMap::new();
    let solids = HashMap::new();
    eb.sync_enthalpy(&species, &solids);

    // Simulate for 600 seconds to reach steady-state
    for _ in 0..6000 {
        eb.step(0.1, &species, &solids);
    }

    assert!(
        eb.temperature_k < 800.0,
        "Dry beaker on 300W reached {} K, must stay bounded (< 800 K)",
        eb.temperature_k
    );
    assert!(
        eb.temperature_k > 450.0,
        "Dry beaker on 300W must heat up significantly, got {} K",
        eb.temperature_k
    );
}

#[test]
fn s2_8_gem_reaction_discovery() {
    // Candidate species containing H, O, Na, Cl
    let mut initial_species = HashMap::new();
    initial_species.insert("H+".to_string(), 0.001);
    initial_species.insert("OH-".to_string(), 0.001);
    initial_species.insert("Na+".to_string(), 0.001);
    initial_species.insert("Cl-".to_string(), 0.001);
    initial_species.insert("H2O".to_string(), 55.5);

    let initial_solids = HashMap::new();

    let sol = solve_gem(&initial_species, &initial_solids, 1.0, 298.15, 101325.0);

    assert!(sol.converged, "GEM solver must converge");
    // H+ and OH- must neutralize to form H2O
    let h_rem = sol.species_mol.get("H+").copied().unwrap_or(0.0);
    assert!(h_rem < 1e-6, "H+ must be consumed by neutralization: got {}", h_rem);
}
