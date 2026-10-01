//! M6 Chemical Templates and Reaction Families.
//! Defines 40+ fundamental organic & general reaction families,
//! Mayr linear free-energy parameter database, diffusion capping,
//! and SN2/E2 and ester hydrolysis catalysis kinetics.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

pub const R_IDEAL: f64 = 8.314462618; // J/(mol·K)
pub const BOLTZMANN_K: f64 = 1.380649e-23; // J/K
pub const PLANCK_H: f64 = 6.62607015e-34; // J·s
pub const VISCOSITY_WATER_298: f64 = 8.90e-4; // Pa·s (at 25 °C)

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CatalysisType {
    None,
    Acid,
    Base,
    BothAcidBase,
    RadicalInitiator,
    TransitionMetal,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReactionFamily {
    pub id: String,
    pub name: String,
    pub category: String,
    pub equation_pattern: String,
    pub arrhenius_a: f64,
    pub arrhenius_n: f64,
    pub arrhenius_ea: f64, // J/mol
    pub delta_h_kj: f64,
    pub delta_s_j_k: f64,
    pub is_reversible: bool,
    pub catalysis: CatalysisType,
    pub base_steric_penalty: f64, // Steric factor reducing SN2 if base is bulky
    pub base_elimination_boost: f64, // Factor boosting E2 if base is bulky
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MayrParameter {
    pub id: String,
    pub name: String,
    pub is_nucleophile: bool,
    pub n: f64,    // Nucleophilicity N
    pub s_n: f64,  // Nucleophile sensitivity s_N
    pub e: f64,    // Electrophilicity E
    pub solvent: String,
}

/// Calculate Mayr rate constant at 20 °C (293.15 K) and scale with temperature:
/// log10(k_20C) = s_N * (N + E)
/// Arrhenius / Eyring temperature adjustment with assumed delta_S_ddagger = -60 J/(mol·K)
pub fn calculate_mayr_rate(nuc: &MayrParameter, el: &MayrParameter, temp_k: f64) -> f64 {
    let t = if temp_k.is_nan() || temp_k <= 100.0 { 298.15 } else { temp_k };
    let log_k_20c = nuc.s_n * (nuc.n + el.e);
    let k_20c = 10.0_f64.powf(log_k_20c.clamp(-15.0, 15.0));

    // Convert k at 293.15 K to Delta G_ddagger(293.15)
    let t_ref = 293.15;
    let factor = (BOLTZMANN_K * t_ref) / PLANCK_H; // ~ 6.11e12 s^-1
    let delta_g_ddagger_20c = -R_IDEAL * t_ref * (k_20c / factor).max(1e-30).ln();

    // Standard bimolecular activation entropy Delta S_ddagger ~ -60 J/(mol*K)
    let delta_s_ddagger = -60.0;
    let delta_h_ddagger = delta_g_ddagger_20c + t_ref * delta_s_ddagger;

    // Eyring rate at temperature T:
    // k(T) = (k_B * T / h) * exp(-Delta H_ddagger / (R*T)) * exp(Delta S_ddagger / R)
    let k_t = ((BOLTZMANN_K * t) / PLANCK_H)
        * (-delta_h_ddagger / (R_IDEAL * t)).exp()
        * (delta_s_ddagger / R_IDEAL).exp();

    if k_t.is_finite() && k_t >= 0.0 {
        k_t
    } else {
        k_20c
    }
}

/// Calculate Stokes-Einstein / Smoluchowski diffusion limit:
/// k_diff = (8 * R * T) / (3 * eta)
/// In M^-1 s^-1 (with eta in Pa*s, 1 m^3/mol*s = 1000 L/(mol*s) = 1000 M^-1 s^-1)
pub fn calculate_diffusion_limit(viscosity_pa_s: f64, temp_k: f64) -> f64 {
    let t = if temp_k <= 100.0 || temp_k.is_nan() { 298.15 } else { temp_k };
    let eta = if viscosity_pa_s <= 1e-6 || viscosity_pa_s.is_nan() { VISCOSITY_WATER_298 } else { viscosity_pa_s };
    // (8 * 8.314 * T) / (3 * eta) in m^3/(mol*s) * 1000 = L/(mol*s) = M^-1 s^-1
    (8.0 * R_IDEAL * t) / (3.0 * eta) * 1000.0
}

/// Smoothly cap bimolecular rate constant at diffusion limit:
/// 1 / k_eff = 1 / k_fwd + 1 / k_diff  =>  k_eff = (k_fwd * k_diff) / (k_fwd + k_diff)
pub fn apply_diffusion_cap(k_fwd: f64, temp_k: f64, viscosity: f64) -> f64 {
    if k_fwd <= 0.0 || k_fwd.is_nan() {
        return 0.0;
    }
    let k_diff = calculate_diffusion_limit(viscosity, temp_k);
    (k_fwd * k_diff) / (k_fwd + k_diff)
}

/// Evaluate SN2 vs E2 competition:
/// Returns (k_sn2, k_e2, ratio_e2_over_sn2)
/// Gate requirement: SN2/E2 product ratio shifts toward elimination with heat and with a bulky base
pub fn sn2_e2_product_ratio(substrate_type: &str, is_bulky_base: bool, temp_k: f64) -> (f64, f64, f64) {
    let t = if temp_k <= 100.0 || temp_k.is_nan() { 298.15 } else { temp_k };

    // Baseline kinetic parameters for secondary haloalkane (e.g. 2-bromopropane)
    // SN2: lower Ea, lower A (ordered transition state, Delta S_ddagger < 0)
    // E2: higher Ea, higher A (entropy favored, Delta S_ddagger >= 0)
    let (ea_sn2, a_sn2, ea_e2, a_e2) = match substrate_type {
        "primary" => (75_000.0, 5.0e8, 95_000.0, 5.0e10),
        "tertiary" => (120_000.0, 1.0e6, 82_000.0, 5.0e11),
        _ => (85_000.0, 2.0e9, 98_000.0, 2.0e11), // default secondary
    };

    let mut k_sn2 = a_sn2 * (-ea_sn2 / (R_IDEAL * t)).exp();
    let mut k_e2 = a_e2 * (-ea_e2 / (R_IDEAL * t)).exp();

    // Bulky base effect (e.g. tert-butoxide vs methoxide/hydroxide):
    // Severe steric crowding at alpha-carbon heavily penalizes backside SN2 attack
    // while deprotonation on outer beta-hydrogens for E2 is unhindered / promoted.
    if is_bulky_base {
        k_sn2 *= 0.005;  // 200x penalty for SN2
        k_e2 *= 3.0;    // 3x boost for E2
    }

    let ratio = if k_sn2 > 1e-15 { k_e2 / k_sn2 } else { 1e6 };
    (k_sn2, k_e2, ratio)
}

/// Ester hydrolysis pseudo-first-order rate constant as a function of pH:
/// k_obs = k_acid * [H+] + k_neutral + k_base * [OH-]
/// Gate requirement: rate vs pH shows V-shaped / U-shaped acid and base catalysis
pub fn ester_hydrolysis_k_obs(ester_type: &str, ph: f64, temp_k: f64) -> f64 {
    let t = if temp_k <= 100.0 || temp_k.is_nan() { 298.15 } else { temp_k };
    let clamped_ph = ph.clamp(0.0, 14.0);
    let h_conc = 10.0_f64.powf(-clamped_ph);
    let oh_conc = 10.0_f64.powf(-(14.0 - clamped_ph));

    // Temperature factor relative to 298.15 K (typical Ea ~ 60 kJ/mol)
    let ea = match ester_type {
        "aromatic" => 68_000.0,
        _ => 60_000.0, // ethyl acetate / aliphatic
    };
    let t_factor = ((-ea / R_IDEAL) * (1.0 / t - 1.0 / 298.15)).exp();

    // Literature catalytic rate constants at 25 °C (M^-1 s^-1)
    let k_acid_25 = 1.1e-4;   // M^-1 s^-1 (acid-catalysed A_Ac2)
    let k_neutral_25 = 1.5e-8; // s^-1 (spontaneous neutral hydrolysis)
    let k_base_25 = 0.11;      // M^-1 s^-1 (base-catalysed B_Ac2 saponification)

    let k_acid = k_acid_25 * t_factor;
    let k_neutral = k_neutral_25 * t_factor;
    let k_base = k_base_25 * t_factor;

    k_acid * h_conc + k_neutral + k_base * oh_conc
}

/// Returns the 45 curated reaction families covering intro organic and general chemistry
pub fn get_reaction_families() -> Vec<ReactionFamily> {
    vec![
        // 1. SN2 on primary halide
        ReactionFamily {
            id: "sn2_primary_halide".to_string(),
            name: "SN2 Nucleophilic Substitution (Primary Halide)".to_string(),
            category: "substitution".to_string(),
            equation_pattern: "R-CH2-X + Nu- -> R-CH2-Nu + X-".to_string(),
            arrhenius_a: 1.0e9,
            arrhenius_n: 0.0,
            arrhenius_ea: 75_000.0,
            delta_h_kj: -35.0,
            delta_s_j_k: -20.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 0.01,
            base_elimination_boost: 1.0,
        },
        // 2. SN2 on secondary halide
        ReactionFamily {
            id: "sn2_secondary_halide".to_string(),
            name: "SN2 Nucleophilic Substitution (Secondary Halide)".to_string(),
            category: "substitution".to_string(),
            equation_pattern: "R2CH-X + Nu- -> R2CH-Nu + X-".to_string(),
            arrhenius_a: 2.0e9,
            arrhenius_n: 0.0,
            arrhenius_ea: 85_000.0,
            delta_h_kj: -30.0,
            delta_s_j_k: -35.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 0.005,
            base_elimination_boost: 2.0,
        },
        // 3. E2 elimination
        ReactionFamily {
            id: "e2_elimination".to_string(),
            name: "E2 Bimolecular Elimination".to_string(),
            category: "elimination".to_string(),
            equation_pattern: "R-CH2-CH(X)-R + B- -> R-CH=CH-R + BH + X-".to_string(),
            arrhenius_a: 2.0e11,
            arrhenius_n: 0.0,
            arrhenius_ea: 98_000.0,
            delta_h_kj: 15.0,
            delta_s_j_k: 45.0,
            is_reversible: false,
            catalysis: CatalysisType::Base,
            base_steric_penalty: 1.0,
            base_elimination_boost: 3.5,
        },
        // 4. SN1 solvolysis (tertiary halide)
        ReactionFamily {
            id: "sn1_solvolysis".to_string(),
            name: "SN1 Unimolecular Substitution".to_string(),
            category: "substitution".to_string(),
            equation_pattern: "R3C-X + H2O -> R3C-OH + HX".to_string(),
            arrhenius_a: 5.0e10,
            arrhenius_n: 0.0,
            arrhenius_ea: 90_000.0,
            delta_h_kj: -25.0,
            delta_s_j_k: 10.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 5. E1 elimination (tertiary halide)
        ReactionFamily {
            id: "e1_elimination".to_string(),
            name: "E1 Unimolecular Elimination".to_string(),
            category: "elimination".to_string(),
            equation_pattern: "R3C-X -> R2C=CR2 + HX".to_string(),
            arrhenius_a: 1.0e11,
            arrhenius_n: 0.0,
            arrhenius_ea: 95_000.0,
            delta_h_kj: 20.0,
            delta_s_j_k: 50.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 6. Acid-catalysed ester hydrolysis
        ReactionFamily {
            id: "acid_ester_hydrolysis".to_string(),
            name: "Acid-Catalyzed Ester Hydrolysis".to_string(),
            category: "condensation".to_string(),
            equation_pattern: "RCOOR' + H2O + H+ -> RCOOH + R'OH + H+".to_string(),
            arrhenius_a: 1.1e6,
            arrhenius_n: 0.0,
            arrhenius_ea: 62_000.0,
            delta_h_kj: 2.0,
            delta_s_j_k: -15.0,
            is_reversible: true,
            catalysis: CatalysisType::Acid,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 7. Base-catalysed ester hydrolysis (saponification)
        ReactionFamily {
            id: "base_ester_hydrolysis".to_string(),
            name: "Base-Catalyzed Ester Saponification".to_string(),
            category: "condensation".to_string(),
            equation_pattern: "RCOOR' + OH- -> RCOO- + R'OH".to_string(),
            arrhenius_a: 1.0e9,
            arrhenius_n: 0.0,
            arrhenius_ea: 48_000.0,
            delta_h_kj: -45.0,
            delta_s_j_k: -10.0,
            is_reversible: false,
            catalysis: CatalysisType::Base,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 8. Fischer esterification
        ReactionFamily {
            id: "fischer_esterification".to_string(),
            name: "Fischer Esterification".to_string(),
            category: "condensation".to_string(),
            equation_pattern: "RCOOH + R'OH + H+ <-> RCOOR' + H2O + H+".to_string(),
            arrhenius_a: 8.0e5,
            arrhenius_n: 0.0,
            arrhenius_ea: 64_000.0,
            delta_h_kj: -2.0,
            delta_s_j_k: 15.0,
            is_reversible: true,
            catalysis: CatalysisType::Acid,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 9. Aldol addition
        ReactionFamily {
            id: "aldol_addition".to_string(),
            name: "Aldol Addition".to_string(),
            category: "carbonyl".to_string(),
            equation_pattern: "2 R-CH2-CHO <-> R-CH2-CH(OH)-CH(R)-CHO".to_string(),
            arrhenius_a: 5.0e7,
            arrhenius_n: 0.0,
            arrhenius_ea: 58_000.0,
            delta_h_kj: -18.0,
            delta_s_j_k: -80.0,
            is_reversible: true,
            catalysis: CatalysisType::BothAcidBase,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 10. Aldol condensation (dehydration)
        ReactionFamily {
            id: "aldol_condensation".to_string(),
            name: "Aldol Dehydration Condensation".to_string(),
            category: "carbonyl".to_string(),
            equation_pattern: "beta-hydroxy-carbonyl -> alpha,beta-unsaturated-carbonyl + H2O".to_string(),
            arrhenius_a: 2.0e8,
            arrhenius_n: 0.0,
            arrhenius_ea: 65_000.0,
            delta_h_kj: -12.0,
            delta_s_j_k: 25.0,
            is_reversible: false,
            catalysis: CatalysisType::BothAcidBase,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 11. Keto-enol tautomerism
        ReactionFamily {
            id: "keto_enol_tautomerism".to_string(),
            name: "Keto-Enol Tautomerism".to_string(),
            category: "tautomerism".to_string(),
            equation_pattern: "R-CO-CH2-R <-> R-C(OH)=CH-R".to_string(),
            arrhenius_a: 1.0e6,
            arrhenius_n: 0.0,
            arrhenius_ea: 70_000.0,
            delta_h_kj: 42.0,
            delta_s_j_k: 5.0,
            is_reversible: true,
            catalysis: CatalysisType::BothAcidBase,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 12. Mayr carbocation polar addition
        ReactionFamily {
            id: "mayr_carbocation_addition".to_string(),
            name: "Mayr Carbocation Addition".to_string(),
            category: "mayr".to_string(),
            equation_pattern: "R+ + Nu -> R-Nu+".to_string(),
            arrhenius_a: 1.0e11,
            arrhenius_n: 0.0,
            arrhenius_ea: 25_000.0,
            delta_h_kj: -60.0,
            delta_s_j_k: -60.0,
            is_reversible: true,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 13. Mayr Michael conjugate addition
        ReactionFamily {
            id: "mayr_michael_addition".to_string(),
            name: "Mayr Michael Conjugate Addition".to_string(),
            category: "mayr".to_string(),
            equation_pattern: "Michael_Acceptor + Nu- -> Adduct-".to_string(),
            arrhenius_a: 5.0e8,
            arrhenius_n: 0.0,
            arrhenius_ea: 40_000.0,
            delta_h_kj: -55.0,
            delta_s_j_k: -75.0,
            is_reversible: true,
            catalysis: CatalysisType::Base,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 14. Mayr carbonyl nucleophilic addition
        ReactionFamily {
            id: "mayr_carbonyl_addition".to_string(),
            name: "Mayr Carbonyl Nucleophilic Addition".to_string(),
            category: "mayr".to_string(),
            equation_pattern: "R2C=O + Nu -> R2C(O-)-Nu".to_string(),
            arrhenius_a: 2.0e9,
            arrhenius_n: 0.0,
            arrhenius_ea: 38_000.0,
            delta_h_kj: -48.0,
            delta_s_j_k: -70.0,
            is_reversible: true,
            catalysis: CatalysisType::BothAcidBase,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 15. Alkene bromination
        ReactionFamily {
            id: "alkene_bromination".to_string(),
            name: "Alkene Electrophilic Bromination".to_string(),
            category: "addition".to_string(),
            equation_pattern: "R-CH=CH-R + Br2 -> R-CH(Br)-CH(Br)-R".to_string(),
            arrhenius_a: 5.0e9,
            arrhenius_n: 0.0,
            arrhenius_ea: 28_000.0,
            delta_h_kj: -125.0,
            delta_s_j_k: -110.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 16. Alkene chlorination
        ReactionFamily {
            id: "alkene_chlorination".to_string(),
            name: "Alkene Electrophilic Chlorination".to_string(),
            category: "addition".to_string(),
            equation_pattern: "R-CH=CH-R + Cl2 -> R-CH(Cl)-CH(Cl)-R".to_string(),
            arrhenius_a: 8.0e9,
            arrhenius_n: 0.0,
            arrhenius_ea: 22_000.0,
            delta_h_kj: -180.0,
            delta_s_j_k: -115.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 17. Alkene hydrobromination (Markovnikov)
        ReactionFamily {
            id: "alkene_hydrobromination".to_string(),
            name: "Alkene Hydrobromination (Markovnikov)".to_string(),
            category: "addition".to_string(),
            equation_pattern: "R-CH=CH2 + HBr -> R-CH(Br)-CH3".to_string(),
            arrhenius_a: 1.0e8,
            arrhenius_n: 0.0,
            arrhenius_ea: 45_000.0,
            delta_h_kj: -80.0,
            delta_s_j_k: -90.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 18. Alkene hydrochlorination
        ReactionFamily {
            id: "alkene_hydrochlorination".to_string(),
            name: "Alkene Hydrochlorination".to_string(),
            category: "addition".to_string(),
            equation_pattern: "R-CH=CH2 + HCl -> R-CH(Cl)-CH3".to_string(),
            arrhenius_a: 5.0e7,
            arrhenius_n: 0.0,
            arrhenius_ea: 52_000.0,
            delta_h_kj: -70.0,
            delta_s_j_k: -95.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 19. Alkene hydration (acid catalysed)
        ReactionFamily {
            id: "alkene_hydration".to_string(),
            name: "Alkene Acid-Catalyzed Hydration".to_string(),
            category: "addition".to_string(),
            equation_pattern: "R-CH=CH2 + H2O + H+ -> R-CH(OH)-CH3 + H+".to_string(),
            arrhenius_a: 3.0e6,
            arrhenius_n: 0.0,
            arrhenius_ea: 68_000.0,
            delta_h_kj: -45.0,
            delta_s_j_k: -85.0,
            is_reversible: true,
            catalysis: CatalysisType::Acid,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 20. Alkene epoxidation (peracid)
        ReactionFamily {
            id: "alkene_epoxidation".to_string(),
            name: "Alkene Prilezhaev Epoxidation".to_string(),
            category: "addition".to_string(),
            equation_pattern: "Alkene + RCOOOH -> Epoxide + RCOOH".to_string(),
            arrhenius_a: 2.0e7,
            arrhenius_n: 0.0,
            arrhenius_ea: 55_000.0,
            delta_h_kj: -105.0,
            delta_s_j_k: -70.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 21. Alkyne hydration
        ReactionFamily {
            id: "alkyne_hydration".to_string(),
            name: "Alkyne Hydration (Markovnikov to Ketone)".to_string(),
            category: "addition".to_string(),
            equation_pattern: "R-C#CH + H2O + H+ -> R-CO-CH3 + H+".to_string(),
            arrhenius_a: 1.0e6,
            arrhenius_n: 0.0,
            arrhenius_ea: 65_000.0,
            delta_h_kj: -110.0,
            delta_s_j_k: -80.0,
            is_reversible: false,
            catalysis: CatalysisType::Acid,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 22. Alkyne halogenation
        ReactionFamily {
            id: "alkyne_halogenation".to_string(),
            name: "Alkyne Dihalogenation".to_string(),
            category: "addition".to_string(),
            equation_pattern: "R-C#CH + X2 -> R-C(X)=CH(X)".to_string(),
            arrhenius_a: 1.0e8,
            arrhenius_n: 0.0,
            arrhenius_ea: 35_000.0,
            delta_h_kj: -115.0,
            delta_s_j_k: -90.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 23. Alcohol oxidation (dichromate)
        ReactionFamily {
            id: "alcohol_oxidation_dichromate".to_string(),
            name: "Jones Alcohol Oxidation (Dichromate)".to_string(),
            category: "redox".to_string(),
            equation_pattern: "3 R-CH2OH + Cr2O7-2 + 8 H+ -> 3 R-CHO + 2 Cr+3 + 7 H2O".to_string(),
            arrhenius_a: 4.0e6,
            arrhenius_n: 0.0,
            arrhenius_ea: 42_000.0,
            delta_h_kj: -210.0,
            delta_s_j_k: 30.0,
            is_reversible: false,
            catalysis: CatalysisType::Acid,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 24. Aldehyde oxidation (permanganate)
        ReactionFamily {
            id: "aldehyde_oxidation_permanganate".to_string(),
            name: "Permanganate Aldehyde Oxidation".to_string(),
            category: "redox".to_string(),
            equation_pattern: "3 R-CHO + 2 MnO4- + H+ -> 3 R-COOH + 2 MnO2(s) + H2O".to_string(),
            arrhenius_a: 1.0e7,
            arrhenius_n: 0.0,
            arrhenius_ea: 38_000.0,
            delta_h_kj: -260.0,
            delta_s_j_k: 20.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 25. Carbonyl reduction (NaBH4)
        ReactionFamily {
            id: "carbonyl_reduction_borohydride".to_string(),
            name: "Sodium Borohydride Carbonyl Reduction".to_string(),
            category: "redox".to_string(),
            equation_pattern: "4 R2CO + NaBH4 + 4 H2O -> 4 R2CHOH + NaB(OH)4".to_string(),
            arrhenius_a: 8.0e6,
            arrhenius_n: 0.0,
            arrhenius_ea: 45_000.0,
            delta_h_kj: -140.0,
            delta_s_j_k: -40.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 26. Carbonyl reduction (LiAlH4)
        ReactionFamily {
            id: "carbonyl_reduction_lah".to_string(),
            name: "Lithium Aluminium Hydride Reduction".to_string(),
            category: "redox".to_string(),
            equation_pattern: "RCOOR' + LiAlH4 -> RCH2OH + R'OH".to_string(),
            arrhenius_a: 5.0e8,
            arrhenius_n: 0.0,
            arrhenius_ea: 28_000.0,
            delta_h_kj: -220.0,
            delta_s_j_k: -30.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 27. Grignard addition to ketone
        ReactionFamily {
            id: "grignard_addition_ketone".to_string(),
            name: "Grignard Addition to Ketone".to_string(),
            category: "carbonyl".to_string(),
            equation_pattern: "RMgX + R'2CO -> R'2RCO- + MgX+".to_string(),
            arrhenius_a: 1.0e9,
            arrhenius_n: 0.0,
            arrhenius_ea: 24_000.0,
            delta_h_kj: -180.0,
            delta_s_j_k: -60.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 28. Grignard addition to aldehyde
        ReactionFamily {
            id: "grignard_addition_aldehyde".to_string(),
            name: "Grignard Addition to Aldehyde".to_string(),
            category: "carbonyl".to_string(),
            equation_pattern: "RMgX + R'CHO -> R'RCH-O- + MgX+".to_string(),
            arrhenius_a: 3.0e9,
            arrhenius_n: 0.0,
            arrhenius_ea: 20_000.0,
            delta_h_kj: -190.0,
            delta_s_j_k: -55.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 29. Organolithium addition to carbonyl
        ReactionFamily {
            id: "organolithium_addition".to_string(),
            name: "Organolithium Carbonyl Addition".to_string(),
            category: "carbonyl".to_string(),
            equation_pattern: "RLi + R'2CO -> R'2RC-OLi".to_string(),
            arrhenius_a: 5.0e9,
            arrhenius_n: 0.0,
            arrhenius_ea: 18_000.0,
            delta_h_kj: -210.0,
            delta_s_j_k: -50.0,
            is_reversible: false,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 30. Acetal formation
        ReactionFamily {
            id: "acetal_formation".to_string(),
            name: "Acid-Catalyzed Acetal Formation".to_string(),
            category: "carbonyl".to_string(),
            equation_pattern: "R2CO + 2 R'OH + H+ <-> R2C(OR')2 + H2O + H+".to_string(),
            arrhenius_a: 4.0e6,
            arrhenius_n: 0.0,
            arrhenius_ea: 58_000.0,
            delta_h_kj: -15.0,
            delta_s_j_k: -65.0,
            is_reversible: true,
            catalysis: CatalysisType::Acid,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 31. Acetal hydrolysis
        ReactionFamily {
            id: "acetal_hydrolysis".to_string(),
            name: "Acid-Catalyzed Acetal Hydrolysis".to_string(),
            category: "carbonyl".to_string(),
            equation_pattern: "R2C(OR')2 + H2O + H+ <-> R2CO + 2 R'OH + H+".to_string(),
            arrhenius_a: 8.0e6,
            arrhenius_n: 0.0,
            arrhenius_ea: 73_000.0,
            delta_h_kj: 15.0,
            delta_s_j_k: 65.0,
            is_reversible: true,
            catalysis: CatalysisType::Acid,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 32. Imine formation (Schiff base)
        ReactionFamily {
            id: "imine_formation".to_string(),
            name: "Imine (Schiff Base) Formation".to_string(),
            category: "carbonyl".to_string(),
            equation_pattern: "R2CO + R'NH2 <-> R2C=NR' + H2O".to_string(),
            arrhenius_a: 2.0e7,
            arrhenius_n: 0.0,
            arrhenius_ea: 46_000.0,
            delta_h_kj: -22.0,
            delta_s_j_k: -40.0,
            is_reversible: true,
            catalysis: CatalysisType::Acid,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 33. Enamine formation
        ReactionFamily {
            id: "enamine_formation".to_string(),
            name: "Enamine Formation (Secondary Amine)".to_string(),
            category: "carbonyl".to_string(),
            equation_pattern: "R-CH2-CO-R + R'2NH <-> R-CH=C(NR'2)-R + H2O".to_string(),
            arrhenius_a: 1.5e7,
            arrhenius_n: 0.0,
            arrhenius_ea: 50_000.0,
            delta_h_kj: -18.0,
            delta_s_j_k: -35.0,
            is_reversible: true,
            catalysis: CatalysisType::Acid,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 34. Imine hydrolysis
        ReactionFamily {
            id: "imine_hydrolysis".to_string(),
            name: "Imine Hydrolysis".to_string(),
            category: "carbonyl".to_string(),
            equation_pattern: "R2C=NR' + H2O + H+ -> R2CO + R'NH3+".to_string(),
            arrhenius_a: 5.0e7,
            arrhenius_n: 0.0,
            arrhenius_ea: 52_000.0,
            delta_h_kj: 22.0,
            delta_s_j_k: 40.0,
            is_reversible: true,
            catalysis: CatalysisType::Acid,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 35. Acid-catalysed amide hydrolysis
        ReactionFamily {
            id: "amide_hydrolysis_acid".to_string(),
            name: "Acid-Catalyzed Amide Hydrolysis".to_string(),
            category: "condensation".to_string(),
            equation_pattern: "RCONH2 + H2O + H+ -> RCOOH + NH4+".to_string(),
            arrhenius_a: 2.0e7,
            arrhenius_n: 0.0,
            arrhenius_ea: 88_000.0,
            delta_h_kj: -30.0,
            delta_s_j_k: -10.0,
            is_reversible: false,
            catalysis: CatalysisType::Acid,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 36. Base-catalysed amide hydrolysis
        ReactionFamily {
            id: "amide_hydrolysis_base".to_string(),
            name: "Base-Catalyzed Amide Hydrolysis".to_string(),
            category: "condensation".to_string(),
            equation_pattern: "RCONH2 + OH- -> RCOO- + NH3".to_string(),
            arrhenius_a: 8.0e7,
            arrhenius_n: 0.0,
            arrhenius_ea: 84_000.0,
            delta_h_kj: -60.0,
            delta_s_j_k: -15.0,
            is_reversible: false,
            catalysis: CatalysisType::Base,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 37. Diels-Alder cycloaddition [4+2]
        ReactionFamily {
            id: "diels_alder_cycloaddition".to_string(),
            name: "Diels-Alder [4+2] Cycloaddition".to_string(),
            category: "pericyclic".to_string(),
            equation_pattern: "Diene + Dienophile -> Cyclohexene Derivative".to_string(),
            arrhenius_a: 1.0e8,
            arrhenius_n: 0.0,
            arrhenius_ea: 70_000.0,
            delta_h_kj: -140.0,
            delta_s_j_k: -140.0,
            is_reversible: true,
            catalysis: CatalysisType::None,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 38. Electrophilic aromatic nitration
        ReactionFamily {
            id: "eas_nitration".to_string(),
            name: "Electrophilic Aromatic Nitration".to_string(),
            category: "aromatic".to_string(),
            equation_pattern: "Ar-H + HNO3 + H2SO4 -> Ar-NO2 + H2O + H2SO4".to_string(),
            arrhenius_a: 5.0e7,
            arrhenius_n: 0.0,
            arrhenius_ea: 60_000.0,
            delta_h_kj: -120.0,
            delta_s_j_k: -30.0,
            is_reversible: false,
            catalysis: CatalysisType::Acid,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 39. Electrophilic aromatic bromination
        ReactionFamily {
            id: "eas_bromination".to_string(),
            name: "Electrophilic Aromatic Bromination".to_string(),
            category: "aromatic".to_string(),
            equation_pattern: "Ar-H + Br2 + FeBr3 -> Ar-Br + HBr + FeBr3".to_string(),
            arrhenius_a: 2.0e7,
            arrhenius_n: 0.0,
            arrhenius_ea: 65_000.0,
            delta_h_kj: -95.0,
            delta_s_j_k: -25.0,
            is_reversible: false,
            catalysis: CatalysisType::TransitionMetal,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 40. Electrophilic aromatic chlorination
        ReactionFamily {
            id: "eas_chlorination".to_string(),
            name: "Electrophilic Aromatic Chlorination".to_string(),
            category: "aromatic".to_string(),
            equation_pattern: "Ar-H + Cl2 + AlCl3 -> Ar-Cl + HCl + AlCl3".to_string(),
            arrhenius_a: 3.0e7,
            arrhenius_n: 0.0,
            arrhenius_ea: 62_000.0,
            delta_h_kj: -110.0,
            delta_s_j_k: -25.0,
            is_reversible: false,
            catalysis: CatalysisType::TransitionMetal,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 41. Friedel-Crafts alkylation
        ReactionFamily {
            id: "eas_friedel_crafts_alkylation".to_string(),
            name: "Friedel-Crafts Alkylation".to_string(),
            category: "aromatic".to_string(),
            equation_pattern: "Ar-H + R-Cl + AlCl3 -> Ar-R + HCl + AlCl3".to_string(),
            arrhenius_a: 1.0e7,
            arrhenius_n: 0.0,
            arrhenius_ea: 68_000.0,
            delta_h_kj: -85.0,
            delta_s_j_k: -35.0,
            is_reversible: false,
            catalysis: CatalysisType::TransitionMetal,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 42. Friedel-Crafts acylation
        ReactionFamily {
            id: "eas_friedel_crafts_acylation".to_string(),
            name: "Friedel-Crafts Acylation".to_string(),
            category: "aromatic".to_string(),
            equation_pattern: "Ar-H + R-COCl + AlCl3 -> Ar-CO-R + HCl + AlCl3".to_string(),
            arrhenius_a: 8.0e6,
            arrhenius_n: 0.0,
            arrhenius_ea: 72_000.0,
            delta_h_kj: -90.0,
            delta_s_j_k: -30.0,
            is_reversible: false,
            catalysis: CatalysisType::TransitionMetal,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 43. Ether cleavage with HI
        ReactionFamily {
            id: "ether_cleavage_hi".to_string(),
            name: "Ether Cleavage with Hydroiodic Acid".to_string(),
            category: "substitution".to_string(),
            equation_pattern: "R-O-R' + HI -> R-I + R'OH".to_string(),
            arrhenius_a: 5.0e8,
            arrhenius_n: 0.0,
            arrhenius_ea: 82_000.0,
            delta_h_kj: -25.0,
            delta_s_j_k: 10.0,
            is_reversible: false,
            catalysis: CatalysisType::Acid,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 44. Pinacol rearrangement
        ReactionFamily {
            id: "pinacol_rearrangement".to_string(),
            name: "Pinacol-Pinacolone Rearrangement".to_string(),
            category: "rearrangement".to_string(),
            equation_pattern: "R2C(OH)-C(OH)R2 + H+ -> R3C-CO-R + H2O + H+".to_string(),
            arrhenius_a: 1.0e10,
            arrhenius_n: 0.0,
            arrhenius_ea: 90_000.0,
            delta_h_kj: -40.0,
            delta_s_j_k: 25.0,
            is_reversible: false,
            catalysis: CatalysisType::Acid,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
        // 45. Radical combustion (hydrocarbons)
        ReactionFamily {
            id: "radical_combustion".to_string(),
            name: "Gas-Phase Radical Combustion".to_string(),
            category: "combustion".to_string(),
            equation_pattern: "CxHy + (x + y/4) O2 -> x CO2 + y/2 H2O".to_string(),
            arrhenius_a: 1.0e12,
            arrhenius_n: 0.0,
            arrhenius_ea: 125_000.0,
            delta_h_kj: -800.0,
            delta_s_j_k: 80.0,
            is_reversible: false,
            catalysis: CatalysisType::RadicalInitiator,
            base_steric_penalty: 1.0,
            base_elimination_boost: 1.0,
        },
    ]
}

/// Returns curated Mayr nucleophiles and electrophiles
pub fn get_mayr_database() -> HashMap<String, MayrParameter> {
    let mut db = HashMap::new();

    // Nucleophiles (is_nucleophile: true, N, s_N)
    let nucs = vec![
        ("nuc_piperidine", "Piperidine", 18.25, 0.78, "CH2Cl2"),
        ("nuc_morpholine", "Morpholine", 15.39, 0.75, "CH2Cl2"),
        ("nuc_pyrrolidine", "Pyrrolidine", 20.21, 0.81, "CH2Cl2"),
        ("nuc_triethylamine", "Triethylamine", 15.80, 0.65, "CH2Cl2"),
        ("nuc_water", "Water", 5.20, 0.89, "H2O"),
        ("nuc_methanol", "Methanol", 7.55, 0.86, "MeOH"),
        ("nuc_ethanol", "Ethanol", 8.10, 0.84, "EtOH"),
        ("nuc_hydroxide", "Hydroxide Ion", 14.50, 0.90, "H2O"),
        ("nuc_methoxide", "Methoxide Ion", 15.80, 0.85, "MeOH"),
        ("nuc_cyanide", "Cyanide Ion", 16.40, 0.72, "DMSO"),
        ("nuc_iodide", "Iodide Ion", 12.10, 0.80, "MeCN"),
        ("nuc_azide", "Azide Ion", 14.20, 0.78, "MeCN"),
        ("nuc_enamine_cyclohexenyl", "1-Morpholinocyclohexene", 11.20, 0.92, "CH2Cl2"),
        ("nuc_allylsilane", "Allyltrimethylsilane", 1.82, 0.95, "CH2Cl2"),
        ("nuc_hydride_borohydride", "Borohydride Ion", 13.60, 0.70, "H2O"),
    ];

    for (id, name, n, s_n, solv) in nucs {
        db.insert(id.to_string(), MayrParameter {
            id: id.to_string(),
            name: name.to_string(),
            is_nucleophile: true,
            n,
            s_n,
            e: 0.0,
            solvent: solv.to_string(),
        });
    }

    // Electrophiles (is_nucleophile: false, E)
    let els = vec![
        ("el_benzhydrylium_dma", "Bis(4-dimethylaminophenyl)methylium", -7.02, "CH2Cl2"),
        ("el_benzhydrylium_mpa", "Bis(4-methoxyphenyl)methylium", 0.00, "CH2Cl2"), // Mayr reference E = 0
        ("el_benzhydrylium_ph", "Diphenylmethylium", 5.90, "CH2Cl2"),
        ("el_quinone_methide", "Quinone Methide Acceptor", -3.50, "CH2Cl2"),
        ("el_benzylidene_indandione", "Benzylidene Indandione", -8.20, "DMSO"),
        ("el_chalcone", "Chalcone Michael Acceptor", -12.50, "DMSO"),
        ("el_acrolein", "Acrolein", -10.10, "MeCN"),
        ("el_methyl_vinyl_ketone", "Methyl Vinyl Ketone", -11.30, "MeCN"),
        ("el_formaldehyde", "Formaldehyde", -3.20, "H2O"),
        ("el_acetaldehyde", "Acetaldehyde", -5.80, "H2O"),
        ("el_acetone", "Acetone", -8.90, "H2O"),
    ];

    for (id, name, e, solv) in els {
        db.insert(id.to_string(), MayrParameter {
            id: id.to_string(),
            name: name.to_string(),
            is_nucleophile: false,
            n: 0.0,
            s_n: 1.0,
            e,
            solvent: solv.to_string(),
        });
    }

    db
}
