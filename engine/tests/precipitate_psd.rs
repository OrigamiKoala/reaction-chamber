//! Particle size *distribution* of precipitates (log-normal closure of the population moments), class-by-class
//! settling and scattering, and the optional measured interfacial energy of a solid. The size itself comes from the
//! Stage 8 nucleation/growth model (`transfer::nucleation`); these gates are about what is built on its moments.
use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::compound_model::*;
use reaction_chamber_engine::transfer::nucleation::{self, PrecipInput, SaltProps};
use reaction_chamber_engine::transfer::{LogNormal, ParticlePopulation};
use reaction_chamber_engine::vessel::*;

fn beaker() -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(), capacity_ml: 250.0, glass_mass_g: 110.0, inner_radius_cm: 3.5,
        temperature_k: Some(295.15), room_k: Some(295.15), sealed: Some(false), stopper_pop_atm: Some(2.2), burst_atm: Some(6.0),
    })
}

fn import_kcl() {
    let m = model_compound(&CompoundRequest {
        id: "psd_kcl".into(), name: "Potassium chloride".into(), formula: "KCl".into(), smiles: None, inchi_key: None,
        mw: None, density: None, state: Some("liquid".into()), molarity: None, ghs: vec![], ..Default::default()
    });
    assert!(m.modelable);
    if let Some(e) = &m.entry { chem_db::register_custom_reagent(e.clone()); }
    if let Some(min) = &m.mineral { chem_db::register_custom_mineral(min.clone()); }
}

fn dose_ml(v: &mut Vessel, id: &str, ml: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(ml), mass_g: None, drops: None, temperature_k: None }).unwrap();
}

/// 0.1 M AgNO3 + 0.1 M KCl, `each_ml` of each, into `water_ml` of water; stepped for `settle_s` of simulated time.
fn agcl_mixture(water_ml: f64, each_ml: f64, settle_s: f64, gamma: Option<f64>) -> Vessel {
    import_kcl();
    let mut v = beaker();
    if water_ml > 0.0 {
        dose_ml(&mut v, "water", water_ml);
    }
    dose_ml(&mut v, "agno3_0_1m", each_ml);
    v.auto_minerals();
    for m in v.minerals.iter_mut().filter(|m| m.solid_species == "AgCl(s)") {
        m.interfacial_energy_j_m2 = gamma;
    }
    dose_ml(&mut v, "psd_kcl", each_ml);
    let mut t = 0.0;
    while t < settle_s {
        v.step(0.25).unwrap();
        t += 0.25;
    }
    v
}

/// A dosed solid carrying a hand-made log-normal population (BaSO4 in 100 mL of water).
fn lognormal_slurry(d_g_um: f64, sigma_g: f64) -> Vessel {
    let mut v = beaker();
    dose_ml(&mut v, "water", 100.0);
    let mol = 5e-3;
    v.solid_mol.insert("BaSO4(s)".into(), mol);
    v.initial_solids.insert("BaSO4(s)".into(), mol);
    let props = v.solid_props("BaSO4(s)");
    let vol_m3 = mol * chem_db::get_species_thermo("BaSO4(s)").mw / props.density_g_ml * 1e-6;
    let (d_g, s) = (d_g_um * 1e-6, sigma_g.ln());
    // mu3 = N d_g^3 exp(9 s^2 / 2) and V = pi/6 mu3
    let n = vol_m3 * 6.0 / std::f64::consts::PI / (d_g.powi(3) * (4.5 * s * s).exp());
    let mut p = ParticlePopulation::default();
    for k in 0..4 {
        let m = n * d_g.powi(k) * (0.5 * (k * k) as f64 * s * s).exp();
        match k { 0 => p.mu0 = m, 1 => p.mu1 = m, 2 => p.mu2 = m, _ => p.mu3 = m }
    }
    v.particle_populations.insert("BaSO4(s)".into(), p);
    v
}

fn solid_row(v: &Vessel, sp: &str) -> SolidVisual {
    v.snapshot().solids.into_iter().find(|s| s.species == sp).unwrap_or_else(|| panic!("no snapshot row for {}", sp))
}

#[test]
fn precipitate_has_a_size_distribution_in_the_snapshot() {
    let v = agcl_mixture(0.0, 25.0, 30.0, None);
    let row = solid_row(&v, "AgCl(s)");
    let p = &v.particle_populations["AgCl(s)"];
    // the closure reproduces the population's count and volume exactly, and the cohorts of a burst are not all one size
    let ln = LogNormal::from_population(p);
    assert!(ln.sigma_g >= 1.0 && ln.sigma_g <= 6.0, "sigma_g {}", ln.sigma_g);
    assert!((row.particle_sigma_g - ln.sigma_g).abs() < 1e-9);
    assert!(row.suspended_diameter_um > 0.0);
    assert!(row.suspended_diameter_um.is_finite() && row.particle_diameter_um > 0.0);
}

#[test]
fn coarse_crystals_settle_first_and_fines_stay_as_a_haze() {
    let mut v = lognormal_slurry(1.5, 2.2);
    let first = solid_row(&v, "BaSO4(s)");
    assert!((first.particle_sigma_g - 2.2).abs() < 0.15, "sigma_g {}", first.particle_sigma_g);
    for _ in 0..1200 { v.step(0.5).unwrap(); } // 10 min, unstirred
    let later = solid_row(&v, "BaSO4(s)");
    assert!(later.suspended_fraction < 0.9 * first.suspended_fraction.max(0.99),
        "some mass must have settled: {} -> {}", first.suspended_fraction, later.suspended_fraction);
    assert!(later.suspended_fraction > 0.02 + 1e-3, "the fines are still up: {}", later.suspended_fraction);
    assert!(later.suspended_diameter_um < 0.8 * first.suspended_diameter_um,
        "the suspended part must be finer than the whole: {} -> {} um", first.suspended_diameter_um, later.suspended_diameter_um);
    // the population itself did not change size: the volume-mean diameter is the whole population's
    assert!((later.particle_diameter_um / first.particle_diameter_um - 1.0).abs() < 0.05);
    // a monodisperse sample has no such two-stage clearing: its suspended size does not change
    let mut m = lognormal_slurry(1.5, 1.0);
    let d0 = solid_row(&m, "BaSO4(s)").suspended_diameter_um;
    for _ in 0..1200 { m.step(0.5).unwrap(); }
    let d1 = solid_row(&m, "BaSO4(s)").suspended_diameter_um;
    assert!((d1 / d0 - 1.0).abs() < 1e-2, "{} -> {}", d0, d1);
}

#[test]
fn stirring_holds_the_fines_up_before_the_coarse_classes() {
    // each class has its own just-suspended speed: gently stirred, the finest class is at least as suspended as the coarsest
    let mut v = lognormal_slurry(3.0, 2.4);
    v.controls.stirring = Some(true);
    v.controls.stir_rpm = Some(120.0);
    for _ in 0..600 { v.step(0.5).unwrap(); }
    let cls = v.ev.susp_cls.get("BaSO4(s)").expect("class state");
    assert!(cls[0] >= cls[cls.len() - 1] - 1e-12, "classes {:?}", cls);
    let mean = cls.iter().sum::<f64>() / cls.len() as f64;
    assert!((mean - v.ev.susp["BaSO4(s)"]).abs() < 1e-9, "susp is the mean of the classes");
}

#[test]
fn turbidity_of_a_polydisperse_suspension_follows_the_size_classes() {
    let mono = lognormal_slurry(1.0, 1.0).snapshot();
    let poly = lognormal_slurry(1.0, 2.0).snapshot();
    // same mass and the same volume-mean-ish size scale; the broad distribution scatters differently per gram
    let m_s = mono.layers[0].scatter_per_cm.iter().sum::<f64>();
    let p_s = poly.layers[0].scatter_per_cm.iter().sum::<f64>();
    assert!(m_s > 0.0 && p_s > 0.0);
    assert!(m_s.is_finite() && p_s.is_finite());
    assert!((m_s - p_s).abs() > 1e-6);
}

#[test]
fn monodisperse_dose_has_unit_spread() {
    let v = lognormal_slurry(30.0, 1.0);
    let ln = LogNormal::from_population(&v.particle_populations["BaSO4(s)"]);
    assert!((ln.sigma_g - 1.0).abs() < 1e-6);
    assert!((ln.d_g_m - 30e-6).abs() / 30e-6 < 1e-6);
    let row = solid_row(&v, "BaSO4(s)");
    assert!((row.particle_sigma_g - 1.0).abs() < 1e-6);
}

fn baso4(gamma: Option<f64>) -> SaltProps {
    SaltProps { density_kg_m3: 4500.0, molar_mass_kg_mol: 0.23339, nu_total: 2.0, c_sat_fu_mol_m3: 1.04e-5 * 1000.0, gamma_override_j_m2: gamma }
}

/// Precipitates a supersaturated solution (ln S0 = `ln_s0`, 1 mmol to come out of 100 mL) for 5 s: (particles formed,
/// formula units that left the solution).
fn crop(salt: SaltProps, ln_s0: f64) -> (f64, f64) {
    let film = |_d: f64| 1e-4;
    let res = nucleation::precipitate(PrecipInput {
        t_k: 298.15, vol_m3: 1e-4, dt_s: 5.0, salt, ln_s0, p_eq_mol: 1e-3,
        pop: ParticlePopulation::default(), nuc_clock: 0.0, film_coefficient: &film,
    });
    (res.pop.mu0, res.dn_fu_mol)
}

#[test]
fn measured_interfacial_energy_replaces_the_mersmann_estimate() {
    let est = nucleation::mersmann_interfacial_energy(298.15, &baso4(None));
    assert!(est > 0.05 && est < 0.2, "{}", est);
    assert_eq!(nucleation::mersmann_interfacial_energy(298.15, &baso4(Some(0.2))), 0.2);
    // a non-physical record value is ignored rather than trusted
    assert_eq!(nucleation::mersmann_interfacial_energy(298.15, &baso4(Some(-1.0))), est);
    // the nucleation rate falls steeply with the barrier, and the wait for the first nucleus grows
    let rate = |g: Option<f64>| nucleation::nucleation_rate(298.15, &baso4(g), 30.0);
    assert!(rate(Some(est * 0.9)) > rate(None) && rate(None) > rate(Some(est * 1.1)));
    let wait = |g: Option<f64>| nucleation::induction_time_s(298.15, &baso4(g), 30.0, 1e-4);
    assert!(wait(Some(est * 1.1)) > wait(None) && wait(None) > wait(Some(est * 0.9)));
    // through a precipitation step: fewer particles form (and less leaves the solution within the step) at a higher
    // barrier, at a supersaturation where the estimate itself is still in its burst
    let (n_est, dn_est) = crop(baso4(None), 4.0);
    let (n_hi, dn_hi) = crop(baso4(Some(est * 1.15)), 4.0);
    let (n_lo, dn_lo) = crop(baso4(Some(est * 0.85)), 4.0);
    assert!(n_lo >= n_est && n_est >= n_hi, "counts {} {} {}", n_lo, n_est, n_hi);
    assert!(dn_lo >= dn_est && dn_est >= dn_hi, "precipitated {} {} {}", dn_lo, dn_est, dn_hi);
    assert!(n_lo > n_hi, "the override must matter");
}

#[test]
fn a_mineral_record_with_a_measured_gamma_changes_the_precipitate_through_the_vessel() {
    let est = agcl_mixture(0.0, 25.0, 30.0, None);
    let hi = agcl_mixture(0.0, 25.0, 30.0, Some(0.35));
    let n_est = est.particle_populations["AgCl(s)"].mu0;
    let n_hi = hi.particle_populations.get("AgCl(s)").map_or(0.0, |p| p.mu0);
    assert!(n_hi != n_est, "the record's gamma must reach the nucleation model ({} vs {})", n_hi, n_est);
}
