use crate::types::{EquilibriumResult, ProvenanceTier, TitrationCurve, TitrationPoint};
use std::collections::HashMap;

pub const R_IDEAL: f64 = crate::physics::R_GAS; // J/(mol*K)
pub const KW_298: f64 = 1.008e-14;
pub const KSP_AGCL_298: f64 = 1.77e-10;

/// Temperature dependent Kw for water autoionization
pub fn kw_at_temp(temp_k: f64) -> f64 {
    let t = if temp_k.is_nan() { 298.15 } else { temp_k.clamp(273.15, 400.0) };
    // Standard thermodynamic van 't Hoff relation for water autoionization
    // Delta H_auto = 55.84 kJ/mol
    let delta_h = 55840.0;
    let factor = (-delta_h / R_IDEAL) * (1.0 / t - 1.0 / 298.15);
    KW_298 * factor.exp()
}

/// Davies activity coefficient calculator
/// Returns gamma for a given charge and ionic strength I at temperature T
pub fn davies_gamma(z: i32, ionic_strength: f64, temp_k: f64) -> f64 {
    if z == 0 || ionic_strength <= 1e-12 || ionic_strength.is_nan() {
        return 1.0;
    }
    let i = ionic_strength.max(0.0);
    let t = if temp_k.is_nan() { 298.15 } else { temp_k.clamp(273.15, 400.0) };
    // A constant in Debye-Huckel / Davies: ~0.5092 at 298.15 K
    let a = 0.5092 * (298.15 / t).powf(1.5);
    let sqrt_i = i.sqrt();
    let term = sqrt_i / (1.0 + sqrt_i) - 0.3 * i;
    let log10_gamma = -a * (z as f64).powi(2) * term;
    
    // Clamp to prevent numerical extremes
    let gamma = 10.0_f64.powf(log10_gamma);
    if gamma.is_nan() {
        1.0
    } else {
        gamma.clamp(1e-4, 100.0)
    }
}

/// Computes ionic strength: I = 0.5 * sum(c_i * z_i^2)
pub fn calc_ionic_strength(ions: &[(f64, i32)]) -> f64 {
    let mut sum = 0.0;
    for &(conc, z) in ions {
        if conc > 0.0 && conc.is_finite() {
            sum += conc * (z as f64).powi(2);
        }
    }
    0.5 * sum
}

/// Acid-Base and Speciation Specification for an aqueous solution
#[derive(Clone, Debug)]
pub struct AqueousSystemInput {
    pub temp_k: f64,
    pub c_strong_acid: f64,  // e.g. HCl -> [Cl-]
    pub c_strong_base: f64,  // e.g. NaOH -> [Na+]
    pub c_weak_monoprotic_acid: f64, // e.g. Acetic acid
    pub pka_weak_mono: Option<f64>,
    pub c_weak_monoprotic_base: f64, // e.g. NH3
    pub pka_weak_base_conj: Option<f64>, // pKa of NH4+ (~9.25)
    pub c_diprotic_acid: f64, // e.g. H2CO3
    pub pkas_diprotic: Option<[f64; 2]>,
    pub c_triprotic_acid: f64, // e.g. H3PO4
    pub pkas_triprotic: Option<[f64; 3]>,
    pub c_ag_plus: f64,
    pub c_cl_precip: f64,
}

impl Default for AqueousSystemInput {
    fn default() -> Self {
        Self {
            temp_k: 298.15,
            c_strong_acid: 0.0,
            c_strong_base: 0.0,
            c_weak_monoprotic_acid: 0.0,
            pka_weak_mono: None,
            c_weak_monoprotic_base: 0.0,
            pka_weak_base_conj: None,
            c_diprotic_acid: 0.0,
            pkas_diprotic: None,
            c_triprotic_acid: 0.0,
            pkas_triprotic: None,
            c_ag_plus: 0.0,
            c_cl_precip: 0.0,
        }
    }
}

/// Fast equilibrium solver using Davies activities and robust Newton-Raphson with bisection fallback
pub fn solve_aqueous_equilibrium(sys: &AqueousSystemInput) -> EquilibriumResult {
    let kw = kw_at_temp(sys.temp_k);
    let mut ionic_strength = 1e-4;
    let mut h_plus = 1e-7;
    let mut iterations = 0;
    let mut converged = false;

    // Outer Picard iteration on ionic strength
    for _ in 0..30 {
        iterations += 1;
        let gamma_1 = davies_gamma(1, ionic_strength, sys.temp_k);
        let gamma_2 = davies_gamma(2, ionic_strength, sys.temp_k);
        let gamma_3 = davies_gamma(3, ionic_strength, sys.temp_k);

        // Solve for [H+] via root finding of charge balance F([H+]) = 0
        let new_h_plus = solve_h_plus(sys, kw, gamma_1, gamma_2, gamma_3, h_plus);
        h_plus = new_h_plus;

        // Calculate all speciation concentrations
        let a_h = gamma_1 * h_plus;
        let oh_minus = kw / (a_h * gamma_1);

        let mut ions: Vec<(f64, i32)> = Vec::new();
        ions.push((h_plus, 1));
        ions.push((oh_minus, -1));
        if sys.c_strong_base > 0.0 {
            ions.push((sys.c_strong_base, 1)); // Na+
        }
        if sys.c_strong_acid > 0.0 {
            ions.push((sys.c_strong_acid, -1)); // Cl-
        }

        // Weak monoprotic acid HA <=> H+ + A-
        if sys.c_weak_monoprotic_acid > 0.0 && sys.pka_weak_mono.is_some() {
            let ka = 10.0_f64.powf(-sys.pka_weak_mono.unwrap());
            // [A-] = C * (Ka / gamma_1) / (a_H + Ka / gamma_1)
            let a_minus = sys.c_weak_monoprotic_acid * (ka / gamma_1) / (a_h + ka / gamma_1);
            ions.push((a_minus, -1));
        }

        // Weak monoprotic base NH4+ <=> NH3 + H+
        if sys.c_weak_monoprotic_base > 0.0 && sys.pka_weak_base_conj.is_some() {
            let ka = 10.0_f64.powf(-sys.pka_weak_base_conj.unwrap());
            // [NH4+] = C * a_H / (a_H + ka / gamma_1)
            let nh4_plus = sys.c_weak_monoprotic_base * a_h / (a_h + ka / gamma_1);
            ions.push((nh4_plus, 1));
        }

        // Diprotic acid H2A <=> H+ + HA- <=> 2H+ + A2-
        if sys.c_diprotic_acid > 0.0 && sys.pkas_diprotic.is_some() {
            let [pka1, pka2] = sys.pkas_diprotic.unwrap();
            let ka1 = 10.0_f64.powf(-pka1);
            let ka2 = 10.0_f64.powf(-pka2);
            let d = a_h * a_h + a_h * ka1 / gamma_1 + (ka1 * ka2) / gamma_2;
            let ha_minus = sys.c_diprotic_acid * (a_h * ka1 / gamma_1) / d;
            let a_2minus = sys.c_diprotic_acid * (ka1 * ka2 / gamma_2) / d;
            ions.push((ha_minus, -1));
            ions.push((a_2minus, -2));
        }

        // Triprotic acid H3A <=> H+ + H2A- <=> 2H+ + HA2- <=> 3H+ + A3-
        if sys.c_triprotic_acid > 0.0 && sys.pkas_triprotic.is_some() {
            let [pka1, pka2, pka3] = sys.pkas_triprotic.unwrap();
            let ka1 = 10.0_f64.powf(-pka1);
            let ka2 = 10.0_f64.powf(-pka2);
            let ka3 = 10.0_f64.powf(-pka3);
            let d = a_h.powi(3) + a_h.powi(2) * ka1 / gamma_1 + a_h * (ka1 * ka2) / gamma_2 + (ka1 * ka2 * ka3) / gamma_3;
            let h2a_minus = sys.c_triprotic_acid * (a_h.powi(2) * ka1 / gamma_1) / d;
            let ha_2minus = sys.c_triprotic_acid * (a_h * ka1 * ka2 / gamma_2) / d;
            let a_3minus = sys.c_triprotic_acid * (ka1 * ka2 * ka3 / gamma_3) / d;
            ions.push((h2a_minus, -1));
            ions.push((ha_2minus, -2));
            ions.push((a_3minus, -3));
        }

        let new_i = calc_ionic_strength(&ions);
        if (new_i - ionic_strength).abs() < 1e-7 * (ionic_strength + 1e-5) {
            ionic_strength = new_i;
            converged = true;
            break;
        }
        ionic_strength = 0.5 * (ionic_strength + new_i);
    }

    let gamma_1 = davies_gamma(1, ionic_strength, sys.temp_k);
    let a_h = gamma_1 * h_plus;
    let ph = -a_h.log10();
    let oh_minus = kw / (a_h * gamma_1);

    // Compute final speciation and precipitate
    let mut species_mol_l = HashMap::new();
    let mut activities = HashMap::new();
    let mut precipitate_mol = HashMap::new();

    species_mol_l.insert("H+".to_string(), h_plus);
    species_mol_l.insert("OH-".to_string(), oh_minus);
    activities.insert("H+".to_string(), a_h);
    activities.insert("OH-".to_string(), oh_minus * gamma_1);

    if sys.c_strong_base > 0.0 {
        species_mol_l.insert("Na+".to_string(), sys.c_strong_base);
        activities.insert("Na+".to_string(), sys.c_strong_base * gamma_1);
    }
    if sys.c_strong_acid > 0.0 {
        species_mol_l.insert("Cl-".to_string(), sys.c_strong_acid);
        activities.insert("Cl-".to_string(), sys.c_strong_acid * gamma_1);
    }

    if sys.c_weak_monoprotic_acid > 0.0 && sys.pka_weak_mono.is_some() {
        let ka = 10.0_f64.powf(-sys.pka_weak_mono.unwrap());
        let a_minus = sys.c_weak_monoprotic_acid * (ka / gamma_1) / (a_h + ka / gamma_1);
        let ha = sys.c_weak_monoprotic_acid - a_minus;
        species_mol_l.insert("A-".to_string(), a_minus);
        species_mol_l.insert("HA".to_string(), ha);
        activities.insert("A-".to_string(), a_minus * gamma_1);
        activities.insert("HA".to_string(), ha);
    }

    if sys.c_diprotic_acid > 0.0 && sys.pkas_diprotic.is_some() {
        let gamma_2 = davies_gamma(2, ionic_strength, sys.temp_k);
        let [pka1, pka2] = sys.pkas_diprotic.unwrap();
        let ka1 = 10.0_f64.powf(-pka1);
        let ka2 = 10.0_f64.powf(-pka2);
        let d = a_h * a_h + a_h * ka1 / gamma_1 + (ka1 * ka2) / gamma_2;
        let h2a = sys.c_diprotic_acid * (a_h * a_h) / d;
        let ha_minus = sys.c_diprotic_acid * (a_h * ka1 / gamma_1) / d;
        let a_2minus = sys.c_diprotic_acid * (ka1 * ka2 / gamma_2) / d;
        species_mol_l.insert("H2A".to_string(), h2a);
        species_mol_l.insert("HA-".to_string(), ha_minus);
        species_mol_l.insert("A2-".to_string(), a_2minus);
        activities.insert("H2A".to_string(), h2a);
        activities.insert("HA-".to_string(), ha_minus * gamma_1);
        activities.insert("A2-".to_string(), a_2minus * gamma_2);
    }

    if sys.c_triprotic_acid > 0.0 && sys.pkas_triprotic.is_some() {
        let gamma_2 = davies_gamma(2, ionic_strength, sys.temp_k);
        let gamma_3 = davies_gamma(3, ionic_strength, sys.temp_k);
        let [pka1, pka2, pka3] = sys.pkas_triprotic.unwrap();
        let ka1 = 10.0_f64.powf(-pka1);
        let ka2 = 10.0_f64.powf(-pka2);
        let ka3 = 10.0_f64.powf(-pka3);
        let d = a_h.powi(3) + a_h.powi(2) * ka1 / gamma_1 + a_h * (ka1 * ka2) / gamma_2 + (ka1 * ka2 * ka3) / gamma_3;
        let h3a = sys.c_triprotic_acid * a_h.powi(3) / d;
        let h2a_minus = sys.c_triprotic_acid * (a_h.powi(2) * ka1 / gamma_1) / d;
        let ha_2minus = sys.c_triprotic_acid * (a_h * ka1 * ka2 / gamma_2) / d;
        let a_3minus = sys.c_triprotic_acid * (ka1 * ka2 * ka3 / gamma_3) / d;
        species_mol_l.insert("H3A".to_string(), h3a);
        species_mol_l.insert("H2A-".to_string(), h2a_minus);
        species_mol_l.insert("HA2-".to_string(), ha_2minus);
        species_mol_l.insert("A3-".to_string(), a_3minus);
        activities.insert("H3A".to_string(), h3a);
        activities.insert("H2A-".to_string(), h2a_minus * gamma_1);
        activities.insert("HA2-".to_string(), ha_2minus * gamma_2);
        activities.insert("A3-".to_string(), a_3minus * gamma_3);
    }

    // AgCl precipitation equilibrium
    if sys.c_ag_plus > 0.0 && sys.c_cl_precip > 0.0 {
        let (ag_eq, cl_eq, ppt) = solve_agcl_precipitation(sys.c_ag_plus, sys.c_cl_precip, gamma_1, sys.temp_k);
        species_mol_l.insert("Ag+".to_string(), ag_eq);
        species_mol_l.insert("Cl_precip-".to_string(), cl_eq);
        activities.insert("Ag+".to_string(), ag_eq * gamma_1);
        activities.insert("Cl_precip-".to_string(), cl_eq * gamma_1);
        if ppt > 0.0 {
            precipitate_mol.insert("AgCl(s)".to_string(), ppt);
        }
    }

    let tier = if ionic_strength > 0.5 {
        ProvenanceTier::Estimated
    } else {
        ProvenanceTier::Tabulated
    };

    EquilibriumResult {
        ph,
        ionic_strength,
        species_mol_l,
        activities,
        precipitate_mol,
        tier,
        iterations,
        converged,
    }
}

/// Solves charge balance equation F(pH) = 0 for [H+] via monotonic bisection on pH
fn solve_h_plus(
    sys: &AqueousSystemInput,
    kw: f64,
    gamma_1: f64,
    gamma_2: f64,
    gamma_3: f64,
    _guess: f64,
) -> f64 {
    let delta_strong = sys.c_strong_base - sys.c_strong_acid;

    let f = |ph: f64| -> f64 {
        let a_h = 10.0_f64.powf(-ph);
        let h_conc = a_h / gamma_1;
        let oh_conc = kw / (a_h * gamma_1);

        let mut net_charge = delta_strong + h_conc - oh_conc;

        // Weak acid HA <=> H+ + A-
        if sys.c_weak_monoprotic_acid > 0.0 && sys.pka_weak_mono.is_some() {
            let ka = 10.0_f64.powf(-sys.pka_weak_mono.unwrap());
            let a_minus = sys.c_weak_monoprotic_acid * (ka / gamma_1) / (a_h + ka / gamma_1);
            net_charge -= a_minus;
        }

        // Weak base NH4+ <=> NH3 + H+
        if sys.c_weak_monoprotic_base > 0.0 && sys.pka_weak_base_conj.is_some() {
            let ka = 10.0_f64.powf(-sys.pka_weak_base_conj.unwrap());
            let nh4_plus = sys.c_weak_monoprotic_base * a_h / (a_h + ka / gamma_1);
            net_charge += nh4_plus;
        }

        // Diprotic acid H2A
        if sys.c_diprotic_acid > 0.0 && sys.pkas_diprotic.is_some() {
            let [pka1, pka2] = sys.pkas_diprotic.unwrap();
            let ka1 = 10.0_f64.powf(-pka1);
            let ka2 = 10.0_f64.powf(-pka2);
            let d = a_h * a_h + a_h * ka1 / gamma_1 + (ka1 * ka2) / gamma_2;
            let ha_minus = sys.c_diprotic_acid * (a_h * ka1 / gamma_1) / d;
            let a_2minus = sys.c_diprotic_acid * (ka1 * ka2 / gamma_2) / d;
            net_charge -= ha_minus + 2.0 * a_2minus;
        }

        // Triprotic acid H3A
        if sys.c_triprotic_acid > 0.0 && sys.pkas_triprotic.is_some() {
            let [pka1, pka2, pka3] = sys.pkas_triprotic.unwrap();
            let ka1 = 10.0_f64.powf(-pka1);
            let ka2 = 10.0_f64.powf(-pka2);
            let ka3 = 10.0_f64.powf(-pka3);
            let d = a_h.powi(3) + a_h.powi(2) * ka1 / gamma_1 + a_h * (ka1 * ka2) / gamma_2 + (ka1 * ka2 * ka3) / gamma_3;
            let h2a_minus = sys.c_triprotic_acid * (a_h.powi(2) * ka1 / gamma_1) / d;
            let ha_2minus = sys.c_triprotic_acid * (a_h * ka1 * ka2 / gamma_2) / d;
            let a_3minus = sys.c_triprotic_acid * (ka1 * ka2 * ka3 / gamma_3) / d;
            net_charge -= h2a_minus + 2.0 * ha_2minus + 3.0 * a_3minus;
        }

        net_charge
    };

    // Monotonic bracket on pH in range [-2.0, 16.0]
    let mut low_ph = -2.0;
    let mut high_ph = 16.0;

    // Dynamically expand bracket for highly concentrated solutions
    while f(low_ph) < 0.0 && low_ph > -6.0 {
        low_ph -= 2.0;
    }
    while f(high_ph) > 0.0 && high_ph < 20.0 {
        high_ph += 2.0;
    }

    // F(ph) is strictly monotonically decreasing with ph
    for _ in 0..54 {
        let mid_ph = 0.5 * (low_ph + high_ph);
        let val = f(mid_ph);
        if val > 0.0 {
            low_ph = mid_ph; // need higher pH (lower [H+]) to decrease net charge
        } else {
            high_ph = mid_ph;
        }
    }

    let final_ph = 0.5 * (low_ph + high_ph);
    let a_h = 10.0_f64.powf(-final_ph);
    a_h / gamma_1
}

/// Solves AgCl precipitation equilibrium: Ag+ + Cl- <=> AgCl(s)
/// Returns (ag_aq_eq, cl_aq_eq, ppt_mol_l)
pub fn solve_agcl_precipitation(c_ag: f64, c_cl: f64, gamma_1: f64, temp_k: f64) -> (f64, f64, f64) {
    if c_ag <= 0.0 || c_cl <= 0.0 {
        return (c_ag.max(0.0), c_cl.max(0.0), 0.0);
    }
    let t = if temp_k.is_nan() { 298.15 } else { temp_k.clamp(273.15, 400.0) };
    let g1 = gamma_1.max(1e-4);

    // Ksp temperature adjustment via van 't Hoff (Delta H ~ +65.5 kJ/mol)
    let delta_h = 65500.0;
    let ksp = KSP_AGCL_298 * ((-delta_h / R_IDEAL) * (1.0 / t - 1.0 / 298.15)).exp();

    // IAP = a(Ag+) * a(Cl-) = (gamma_1 * c_ag) * (gamma_1 * c_cl)
    let iap = (g1 * c_ag) * (g1 * c_cl);
    if iap <= ksp {
        // Undersaturated: no precipitation
        return (c_ag, c_cl, 0.0);
    }

    // Precipitation extent xi: gamma_1^2 * (c_ag - xi) * (c_cl - xi) = ksp
    let ksp_eff = ksp / (g1 * g1);
    // xi^2 - (c_ag + c_cl) xi + (c_ag * c_cl - ksp_eff) = 0
    let b = -(c_ag + c_cl);
    let c = c_ag * c_cl - ksp_eff;
    let disc = (b * b - 4.0 * c).max(0.0);
    let sqrt_disc = disc.sqrt();

    // Numerically stable quadratic root to prevent catastrophic cancellation: xi = 2c / (-b + sqrt(disc))
    let denom = -b + sqrt_disc;
    let xi = if denom > 0.0 {
        2.0 * c / denom
    } else {
        (-b - sqrt_disc) / 2.0
    };

    let xi_clamped = xi.clamp(0.0, c_ag.min(c_cl));
    let ag_eq = (c_ag - xi_clamped).max(0.0);
    let cl_eq = (c_cl - xi_clamped).max(0.0);

    (ag_eq, cl_eq, xi_clamped)
}

/// Titrates strong acid (e.g. 0.1 M HCl) with strong base (0.1 M NaOH)
pub fn titrate_strong_strong(
    vol_acid_ml: f64,
    c_acid: f64,
    c_base: f64,
    max_titrant_ml: f64,
    steps: usize,
    temp_k: f64,
) -> TitrationCurve {
    let mut points = Vec::with_capacity(steps + 1);
    for i in 0..=steps {
        let v_titrant = (i as f64 / steps as f64) * max_titrant_ml;
        let v_total = vol_acid_ml + v_titrant;
        let c_a_dil = (vol_acid_ml * c_acid) / v_total;
        let c_b_dil = (v_titrant * c_base) / v_total;

        let sys = AqueousSystemInput {
            temp_k,
            c_strong_acid: c_a_dil,
            c_strong_base: c_b_dil,
            ..Default::default()
        };
        let res = solve_aqueous_equilibrium(&sys);
        points.push(TitrationPoint {
            titrant_vol_ml: v_titrant,
            total_vol_ml: v_total,
            ph: res.ph,
            ionic_strength: res.ionic_strength,
            tier: res.tier,
        });
    }

    TitrationCurve {
        title: "Strong Acid / Strong Base Titration (HCl + NaOH)".to_string(),
        points,
    }
}

/// Titrates weak monoprotic acid (e.g. 0.1 M Acetic acid, pKa 4.756) with strong base (0.1 M NaOH)
pub fn titrate_weak_strong(
    vol_acid_ml: f64,
    c_acid: f64,
    pka: f64,
    c_base: f64,
    max_titrant_ml: f64,
    steps: usize,
    temp_k: f64,
) -> TitrationCurve {
    let mut points = Vec::with_capacity(steps + 1);
    for i in 0..=steps {
        let v_titrant = (i as f64 / steps as f64) * max_titrant_ml;
        let v_total = vol_acid_ml + v_titrant;
        let c_a_dil = (vol_acid_ml * c_acid) / v_total;
        let c_b_dil = (v_titrant * c_base) / v_total;

        let sys = AqueousSystemInput {
            temp_k,
            c_weak_monoprotic_acid: c_a_dil,
            pka_weak_mono: Some(pka),
            c_strong_base: c_b_dil,
            ..Default::default()
        };
        let res = solve_aqueous_equilibrium(&sys);
        points.push(TitrationPoint {
            titrant_vol_ml: v_titrant,
            total_vol_ml: v_total,
            ph: res.ph,
            ionic_strength: res.ionic_strength,
            tier: res.tier,
        });
    }

    TitrationCurve {
        title: format!("Weak Acid Titration (pKa = {:.2}) with NaOH", pka),
        points,
    }
}

/// Titrates polyprotic acid (e.g. H2CO3 pKa 6.35, 10.33 or H3PO4 pKa 2.15, 7.20, 12.35) with strong base
pub fn titrate_polyprotic(
    vol_acid_ml: f64,
    c_acid: f64,
    pkas: &[f64],
    c_base: f64,
    max_titrant_ml: f64,
    steps: usize,
    temp_k: f64,
) -> TitrationCurve {
    let mut points = Vec::with_capacity(steps + 1);
    for i in 0..=steps {
        let v_titrant = (i as f64 / steps as f64) * max_titrant_ml;
        let v_total = vol_acid_ml + v_titrant;
        let c_a_dil = (vol_acid_ml * c_acid) / v_total;
        let c_b_dil = (v_titrant * c_base) / v_total;

        let mut sys = AqueousSystemInput {
            temp_k,
            c_strong_base: c_b_dil,
            ..Default::default()
        };

        if pkas.len() == 2 {
            sys.c_diprotic_acid = c_a_dil;
            sys.pkas_diprotic = Some([pkas[0], pkas[1]]);
        } else if pkas.len() >= 3 {
            sys.c_triprotic_acid = c_a_dil;
            sys.pkas_triprotic = Some([pkas[0], pkas[1], pkas[2]]);
        }

        let res = solve_aqueous_equilibrium(&sys);
        points.push(TitrationPoint {
            titrant_vol_ml: v_titrant,
            total_vol_ml: v_total,
            ph: res.ph,
            ionic_strength: res.ionic_strength,
            tier: res.tier,
        });
    }

    TitrationCurve {
        title: format!("Polyprotic Titration ({} pKas) with NaOH", pkas.len()),
        points,
    }
}
