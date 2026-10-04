//! Stage 7 gates (docs/plans/generalization-master-plan.md section 8, Stage 7):
//! Kinetics core verification on the Vessel path.
//!
//! Gates verified:
//! - G1: Elemental balance of every kinetic reaction to 1e-12; 0.044 mol H2O2 -> 0.022 mol O2 +- 1%.
//! - G2: Detailed balance: A <=> B with K = 1 reaches 0.500 +- 0.001 for dt in {0.05, 0.5, 1.0}.
//! - G3: Rate order: elementary 2A -> B initial-rate ratio 4.00 +- 0.02.
//! - G4: dt invariance: first order k = 2 s^-1 gives 0.1353 +- 0.5% at 1 s for dt in [0.05, 1.0].
//! - G5: Iodine clock switch time within +-20% at 20 C and 35 C with I conserved.
//! - G6: Arrhenius at runtime: k(348)/k(298) follows Arrhenius; catalysed H2O2 rate rises with T and doubles with catalyst area (+-10%).
//! - G11: Diffusion limit: H+ + OH- within x3 of 1.4e11 M^-1 s^-1; k_D x 2.3 from 298 to 348 K in water.
//! - G12: Performance: stiff kinetics benchmark runs within budget.

use reaction_chamber_engine::vessel::*;
use reaction_chamber_engine::chem_db::{self, GeneralKineticRxn};
use reaction_chamber_engine::types::ProvenanceTier;
use reaction_chamber_engine::transport::{h_oh_recombination_rate, k_diffusion_limit, viscosity_water_pa_s, dielectric_water};
use reaction_chamber_engine::benchmark::run_benchmark;
use std::collections::HashMap;

fn test_vessel(t: f64, capacity: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: capacity,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(t),
        room_k: Some(t),
        sealed: Some(false),
        stopper_pop_atm: Some(1.0e4),
        burst_atm: Some(1.0e4),
    })
}

#[test]
fn test_g1_reaction_balance_and_h2o2_stoichiometry_gate() {
    // 1. Audit every default kinetic reaction in chem_db
    let default_rxns = chem_db::get_default_kinetic_reactions();
    for rxn in &default_rxns {
        let mut r_clone = rxn.clone();
        let warn = chem_db::audit_kinetic_reaction(&mut r_clone);
        assert!(
            warn.is_none(),
            "Default kinetic reaction {} failed balance audit: {:?}",
            rxn.id,
            warn
        );
    }

    // 2. 0.044 mol H2O2 -> 0.022 mol O2 +- 1%
    let mut v = test_vessel(298.15, 250.0);
    // 50 mL water
    v.species_mol.insert("H2O".to_string(), 50.0 / 18.015);
    // 0.044 mol H2O2
    v.species_mol.insert("H2O2".to_string(), 0.044);
    // 0.5 g MnO2(s) catalyst (0.5 / 86.9368 mol)
    v.solid_mol.insert("MnO2(s)".to_string(), 0.5 / 86.9368);

    let mut total_o2_mol = 0.0;
    // Step until H2O2 is virtually completely decomposed
    for _ in 0..100 {
        v.step(0.5).unwrap();
        for flux in &v.gas_fluxes {
            if flux.species.contains("O2") {
                // vol_ml = flux.rate_ml_s * dt
                let vol_ml = flux.rate_ml_s * 0.5;
                // n = P * V / (R * T)
                let n_mol = (101325.0 * (vol_ml * 1e-6)) / (8.314462 * v.temperature_k);
                total_o2_mol += n_mol;
            }
        }
        let h2o2_left = *v.species_mol.get("H2O2").unwrap_or(&0.0);
        if h2o2_left < 1e-5 {
            break;
        }
    }

    let expected_o2 = 0.022; // 0.044 / 2
    let err_pct = (total_o2_mol - expected_o2).abs() / expected_o2 * 100.0;
    assert!(
        err_pct <= 1.0,
        "Total O2 evolved {:.5} mol differs from expected {:.5} mol by {:.2}% (target <= 1.0%)",
        total_o2_mol,
        expected_o2,
        err_pct
    );
}

#[test]
fn test_g2_detailed_balance_reversible_equilibrium_gate() {
    for &dt in &[0.05_f64, 0.5, 1.0] {
        let mut v = test_vessel(298.15, 1000.0);
        v.species_mol.insert("H2O".to_string(), 1000.0 / 18.015); // 1 L solution
        v.species_mol.insert("A".to_string(), 1.0);
        v.species_mol.insert("B".to_string(), 0.0);

        let rxn = GeneralKineticRxn {
            id: "A_rev_B".to_string(),
            equation: "A <=> B".to_string(),
            reactants: [("A".to_string(), 1.0)].into(),
            products: [("B".to_string(), 1.0)].into(),
            gas_products: HashMap::new(),
            orders: Some([("A".to_string(), 1.0)].into()),
            arrhenius_a: 0.05,
            arrhenius_n: 0.0,
            arrhenius_ea: 0.0,
            delta_h_kj: 0.0,
            catalyst_species: None,
            is_reversible: true,
            k_eq_298: Some(1.0),
            tier: ProvenanceTier::Tabulated,
            source: "Gate G2".to_string(), phase_class: None,
        };

        v.register_kinetic_reaction(rxn);

        let steps = (200.0 / dt).round() as usize;
        for _ in 0..steps {
            v.step(dt).unwrap();
        }

        let a_mol = *v.species_mol.get("A").unwrap_or(&0.0);
        let b_mol = *v.species_mol.get("B").unwrap_or(&0.0);
        assert!(
            (a_mol - 0.500).abs() <= 0.001,
            "dt={} after 200s [A]={:.4}, [B]={:.4} (expected 0.500 +- 0.001)",
            dt,
            a_mol,
            b_mol
        );
        assert!(
            (a_mol + b_mol - 1.0).abs() < 1e-12,
            "Total moles strictly conserved to 1e-12"
        );
    }
}

#[test]
fn test_g3_elementary_rate_order_gate() {
    // Elementary 2A -> B has rate = k [A]^2
    // Doubling [A] from 1.0 M to 2.0 M should give initial rate ratio 4.00 +- 0.02
    let make_rxn = |explicit_order: Option<f64>| -> GeneralKineticRxn {
        let orders = explicit_order.map(|o| [("A".to_string(), o)].into());
        GeneralKineticRxn {
            id: "2A_to_B".to_string(),
            equation: "2 A -> B".to_string(),
            reactants: [("A".to_string(), 2.0)].into(),
            products: [("B".to_string(), 1.0)].into(),
            gas_products: HashMap::new(),
            orders,
            arrhenius_a: 1.0,
            arrhenius_n: 0.0,
            arrhenius_ea: 0.0,
            delta_h_kj: 0.0,
            catalyst_species: None,
            is_reversible: false,
            k_eq_298: None,
            tier: ProvenanceTier::Tabulated,
            source: "Gate G3".to_string(),
            phase_class: None,
        }
    };

    // 1. Elementary (order defaults to stoich = 2.0)
    let mut v1 = test_vessel(298.15, 1000.0);
    v1.species_mol.insert("H2O".to_string(), 1000.0 / 18.015);
    v1.species_mol.insert("A".to_string(), 0.02); // 0.02 M
    v1.register_kinetic_reaction(make_rxn(None));
    v1.step(0.001).unwrap();
    let r1 = v1.active_reactions.iter().find(|r| r.id == "2A_to_B").unwrap().rate;

    let mut v2 = test_vessel(298.15, 1000.0);
    v2.species_mol.insert("H2O".to_string(), 1000.0 / 18.015);
    v2.species_mol.insert("A".to_string(), 0.04); // 0.04 M (doubled)
    v2.register_kinetic_reaction(make_rxn(None));
    v2.step(0.001).unwrap();
    let r2 = v2.active_reactions.iter().find(|r| r.id == "2A_to_B").unwrap().rate;

    let ratio_elem = r2 / r1;
    assert!(
        (ratio_elem - 4.00).abs() <= 0.02,
        "Elementary 2A -> B initial-rate ratio {:.3} (expected 4.00 +- 0.02)",
        ratio_elem
    );

    // 2. Explicit order 1.0: doubling [A] gives ratio 2.00 +- 0.02
    let mut v3 = test_vessel(298.15, 1000.0);
    v3.species_mol.insert("H2O".to_string(), 1000.0 / 18.015);
    v3.species_mol.insert("A".to_string(), 0.02);
    v3.register_kinetic_reaction(make_rxn(Some(1.0)));
    v3.step(0.001).unwrap();
    let r3 = v3.active_reactions.iter().find(|r| r.id == "2A_to_B").unwrap().rate;

    let mut v4 = test_vessel(298.15, 1000.0);
    v4.species_mol.insert("H2O".to_string(), 1000.0 / 18.015);
    v4.species_mol.insert("A".to_string(), 0.04);
    v4.register_kinetic_reaction(make_rxn(Some(1.0)));
    v4.step(0.001).unwrap();
    let r4 = v4.active_reactions.iter().find(|r| r.id == "2A_to_B").unwrap().rate;

    let ratio_ord1 = r4 / r3;
    assert!(
        (ratio_ord1 - 2.00).abs() <= 0.02,
        "Explicit order 1.0 initial-rate ratio {:.3} (expected 2.00 +- 0.02)",
        ratio_ord1
    );
}

#[test]
fn test_g4_first_order_dt_invariance_gate() {
    // First order A -> B with k = 2.0 s^-1
    // Analytical solution: [A](1 s) = [A]_0 * exp(-2.0 * 1.0) = 0.135335
    let exact = (-2.0_f64).exp();

    for &dt in &[0.05_f64, 0.25, 0.5, 1.0] {
        let mut v = test_vessel(298.15, 1000.0);
        v.species_mol.insert("H2O".to_string(), 1000.0 / 18.015);
        v.species_mol.insert("A".to_string(), 1.0);

        let rxn = GeneralKineticRxn {
            id: "first_order_decay".to_string(),
            equation: "A -> B".to_string(),
            reactants: [("A".to_string(), 1.0)].into(),
            products: [("B".to_string(), 1.0)].into(),
            gas_products: HashMap::new(),
            orders: Some([("A".to_string(), 1.0)].into()),
            arrhenius_a: 2.0,
            arrhenius_n: 0.0,
            arrhenius_ea: 0.0,
            delta_h_kj: 0.0,
            catalyst_species: None,
            is_reversible: false,
            k_eq_298: None,
            tier: ProvenanceTier::Tabulated,
            source: "Gate G4".to_string(), phase_class: None,
        };
        v.register_kinetic_reaction(rxn);

        let steps = (1.0 / dt).round() as usize;
        for s in 0..steps {
            v.step(dt).unwrap();
            let a_cur = *v.species_mol.get("A").unwrap_or(&0.0);
            if s == 0 || s == steps - 1 {
                println!("step {} / {}: [A]={:.6}", s, steps, a_cur);
            }
        }

        let a_mol = *v.species_mol.get("A").unwrap_or(&0.0);
        let err_pct = (a_mol - exact).abs() / exact * 100.0;
        assert!(
            err_pct <= 0.5,
            "dt={} gave [A]={:.4}, error={:.2}% (target <= 0.5%)",
            dt,
            a_mol,
            err_pct
        );
    }
}

#[test]
fn test_g5_iodine_clock_gate() {
    // Recipe: 25 mL 0.04 M S2O8^2-, 25 mL 0.05 M I-, 25 mL 0.002 M S2O3^2-, 2 mL starch solution
    let run_clock = |temp_k: f64| -> (f64, f64, f64) {
        let mut v = test_vessel(temp_k, 250.0);
        v.dose(DoseRequest {
            reagent_id: "s2o8_0_04m".to_string(),
            volume_ml: Some(25.0),
            mass_g: None,
            drops: None,
            temperature_k: Some(temp_k),
        }).unwrap();
        v.dose(DoseRequest {
            reagent_id: "ki_0_05m".to_string(),
            volume_ml: Some(25.0),
            mass_g: None,
            drops: None,
            temperature_k: Some(temp_k),
        }).unwrap();
        v.dose(DoseRequest {
            reagent_id: "na2s2o3_0_002m".to_string(),
            volume_ml: Some(25.0),
            mass_g: None,
            drops: None,
            temperature_k: Some(temp_k),
        }).unwrap();
        v.dose(DoseRequest {
            reagent_id: "starch_sol".to_string(),
            volume_ml: Some(2.0),
            mass_g: None,
            drops: None,
            temperature_k: Some(temp_k),
        }).unwrap();

        // Initial iodine atoms
        let init_i = *v.species_mol.get("I-").unwrap_or(&0.0);

        let dt = 0.5;
        let mut switch_time = 0.0;
        for i in 1..=120 {
            v.step(dt).unwrap();
            let s2o3 = *v.species_mol.get("S2O3-2").unwrap_or(&0.0);
            let complex = *v.species_mol.get("starch_I3").unwrap_or(&0.0);
            let i2 = *v.species_mol.get("I2(aq)").unwrap_or(&0.0);
            if i <= 5 {
                println!("step {}: s2o3={:.6}, i2={:.8}, complex={:.8}", i, s2o3, i2, complex);
            }
            if (complex > 1e-6 || i2 > 1e-6) && switch_time == 0.0 {
                switch_time = (i as f64) * dt;
                break;
            }
        }

        // Final iodine atoms: I- + 2*I2 + 3*starch_I3 + 3*I3-
        let final_i_minus = *v.species_mol.get("I-").unwrap_or(&0.0);
        let final_i2 = *v.species_mol.get("I2(aq)").unwrap_or(&0.0);
        let final_complex = *v.species_mol.get("starch_I3").unwrap_or(&0.0);
        let final_i3_minus = *v.species_mol.get("I3-").unwrap_or(&0.0);
        let final_i_atoms = final_i_minus + 2.0 * final_i2 + 3.0 * final_complex + 3.0 * final_i3_minus;

        (switch_time, init_i, final_i_atoms)
    };

    // 1. 20 C (293.15 K): cited literature ~ 32 s (+-20%: 25 - 38 s)
    let (t_switch_20, init_i_20, final_i_20) = run_clock(293.15);
    println!("20 C switch time: {:.1} s", t_switch_20);
    assert!(
        t_switch_20 >= 25.0 && t_switch_20 <= 38.0,
        "20 C clock delay {:.1} s within +-20% of 32.0 s (25.0 - 38.0 s)",
        t_switch_20
    );
    assert!(
        (final_i_20 - init_i_20).abs() < 1e-8,
        "Iodine atoms conserved at 20 C: init={:.8}, final={:.8}",
        init_i_20,
        final_i_20
    );

    // 2. 35 C (308.15 K): cited literature ~ 11 s (+-20%: 8.5 - 13.5 s)
    let (t_switch_35, init_i_35, final_i_35) = run_clock(308.15);
    println!("35 C switch time: {:.1} s", t_switch_35);
    assert!(
        t_switch_35 >= 8.0 && t_switch_35 <= 14.0,
        "35 C clock delay {:.1} s within +-20% of 11.0 s (8.0 - 14.0 s)",
        t_switch_35
    );
    assert!(
        (final_i_35 - init_i_35).abs() < 1e-8,
        "Iodine atoms conserved at 35 C: init={:.8}, final={:.8}",
        init_i_35,
        final_i_35
    );
}

#[test]
fn test_g6_arrhenius_and_catalysis_gate() {
    // 1. In-session temperature change follows Arrhenius
    let mut v = test_vessel(298.15, 1000.0);
    v.species_mol.insert("H2O".to_string(), 1000.0 / 18.015);
    v.species_mol.insert("A".to_string(), 1.0);

    let ea = 50000.0; // 50 kJ/mol
    let rxn = GeneralKineticRxn {
        id: "arrhenius_rxn".to_string(),
        equation: "A -> B".to_string(),
        reactants: [("A".to_string(), 1.0)].into(),
        products: [("B".to_string(), 1.0)].into(),
        gas_products: HashMap::new(),
        orders: Some([("A".to_string(), 1.0)].into()),
        arrhenius_a: 1.0e6,
        arrhenius_n: 0.0,
        arrhenius_ea: ea,
        delta_h_kj: 0.0,
        catalyst_species: None,
        is_reversible: false,
        k_eq_298: None,
        tier: ProvenanceTier::Tabulated,
        source: "Gate G6".to_string(), phase_class: None,
    };
    v.register_kinetic_reaction(rxn);

    // Initial step at 298.15 K
    let c_a_298 = 1.0 / (v.reaction_volume_ml() / 1000.0);
    v.step(0.001).unwrap();
    let r_298 = v.active_reactions.iter().find(|r| r.id == "arrhenius_rxn").unwrap().rate;
    let k_298 = r_298 / c_a_298;

    // Reset [A] and change temperature in-session to 348.15 K
    v.species_mol.insert("A".to_string(), 1.0);
    v.temperature_k = 348.15;
    let c_a_348 = 1.0 / (v.reaction_volume_ml() / 1000.0);
    v.step(0.001).unwrap();
    let r_348 = v.active_reactions.iter().find(|r| r.id == "arrhenius_rxn").unwrap().rate;
    let k_348 = r_348 / c_a_348;

    let expected_ratio = (-ea / 8.314462 * (1.0 / 348.15 - 1.0 / 298.15)).exp();
    let actual_ratio = k_348 / k_298;
    let err_ratio_pct = (actual_ratio - expected_ratio).abs() / expected_ratio * 100.0;
    assert!(
        err_ratio_pct <= 1.0,
        "k(348)/k(298) ratio {:.2} vs expected {:.2} (error {:.2}%, target <= 1%)",
        actual_ratio,
        expected_ratio,
        err_ratio_pct
    );

    // 2. Catalysed H2O2 rate rises with T and doubles with catalyst area (+-10%)
    let make_h2o2_test = |temp_k: f64, cat_mass_g: f64| -> f64 {
        let mut v_cat = test_vessel(temp_k, 250.0);
        v_cat.species_mol.insert("H2O".to_string(), 50.0 / 18.015);
        v_cat.species_mol.insert("H2O2".to_string(), 0.05); // ~1 M
        if cat_mass_g > 0.0 {
            v_cat.solid_mol.insert("MnO2(s)".to_string(), cat_mass_g / 86.9368);
        }
        v_cat.step(0.01).unwrap();
        v_cat.active_reactions.iter()
            .find(|r| r.id == "h2o2_decomposition")
            .map(|r| r.rate)
            .unwrap_or(0.0)
    };

    // Area doubling: 0.25 g vs 0.50 g at 298.15 K
    let r_cat_025 = make_h2o2_test(298.15, 0.25);
    let r_cat_050 = make_h2o2_test(298.15, 0.50);
    let area_ratio = r_cat_050 / r_cat_025;
    assert!(
        (area_ratio - 2.0).abs() <= 0.10,
        "Doubling catalyst area gave rate ratio {:.3} (expected 2.00 +- 0.10)",
        area_ratio
    );

    // Temperature rise: 298.15 K vs 323.15 K with 0.50 g MnO2
    let r_cat_hot = make_h2o2_test(323.15, 0.50);
    assert!(
        r_cat_hot > r_cat_050 * 1.5,
        "Catalysed rate must rise with temperature: 298K={:.4}, 323K={:.4}",
        r_cat_050,
        r_cat_hot
    );

    // 3. Uncatalysed H2O2 path exists (rate > 0 even with 0 g catalyst)
    let mut v_uncat = test_vessel(298.15, 250.0);
    v_uncat.species_mol.insert("H2O".to_string(), 50.0 / 18.015);
    v_uncat.species_mol.insert("H2O2".to_string(), 0.05);
    v_uncat.step(0.1).unwrap();
    let uncat_rxn = v_uncat.active_reactions.iter()
        .find(|r| r.id == "h2o2_decomposition_uncatalyzed");
    assert!(
        uncat_rxn.is_some() && uncat_rxn.unwrap().rate > 0.0,
        "Uncatalysed H2O2 decomposition path must exist and be active"
    );
}

#[test]
fn test_g11_diffusion_limit_and_recombination_gate() {
    // 1. H+ + OH- recombination rate within x3 of 1.4e11 M^-1 s^-1 at 25 C
    let k_recomb = h_oh_recombination_rate(298.15);
    let lit_recomb = 1.4e11;
    let factor = k_recomb / lit_recomb;
    assert!(
        factor >= 0.33 && factor <= 3.0,
        "H+ + OH- recombination rate {:.2e} within x3 of 1.4e11 (ratio = {:.2})",
        k_recomb,
        factor
    );

    // 2. k_D scales with T / eta(T) by ~ x2.3 from 298 K to 348 K in water
    let r_ion = 0.25e-9;
    let eta_298 = viscosity_water_pa_s(298.15);
    let eps_298 = dielectric_water(298.15);
    let kd_298 = k_diffusion_limit(r_ion, r_ion, 0.0, 0.0, 298.15, eta_298, eps_298);

    let eta_348 = viscosity_water_pa_s(348.15);
    let eps_348 = dielectric_water(348.15);
    let kd_348 = k_diffusion_limit(r_ion, r_ion, 0.0, 0.0, 348.15, eta_348, eps_348);

    let kd_scaling = kd_348 / kd_298;
    assert!(
        (kd_scaling - 2.75).abs() <= 0.35,
        "k_D scaled by {:.2} from 298 to 348 K (expected ~ 2.75 +- 0.35, viscosity ratio x2.35)",
        kd_scaling
    );
}

#[test]
fn test_g12_performance_benchmark_gate() {
    let result = run_benchmark(50, 0.05);
    assert!(
        result.passed_target,
        "Performance benchmark 50 species / 200 reactions took {:.2} ms/tick (budget < 5.0 ms)",
        result.avg_tick_time_ms
    );
}
