//! Activity coefficient models for aqueous, non-aqueous, and electrolyte solutions.
//!
//! Formulations implemented:
//! - `IdealActivity`: ideal solution (ln gamma = 0).
//! - `DaviesActivity`: Davies equation for ionic strength up to ~0.5 m.
//! - `BDotActivity`: Helgeson / Truesdell-Jones B-dot equation (ion size å from llnl / PHREEQC).
//! - `SitActivity`: Specific Ion Interaction Theory (SIT).
//! - `PitzerActivity`: Pitzer equations for single and mixed electrolytes.
//! - `UnifacActivity`: UNIFAC group contribution for neutral organic mixtures.
//! - `BornTransferActivity`: Born dielectric solvation model for non-aqueous transfer.
//! - `DefaultActivityModel`: Unified adaptive model.

use std::collections::HashMap;
use std::f64::consts::LN_10;

use crate::phases::LiquidPhase;

pub trait ActivityModel: Send + Sync {
    /// Compute ln(gamma_i) for species `species` in `phase`.
    fn ln_gamma(&self, species: &str, phase: &LiquidPhase, t_k: f64, p_atm: f64) -> f64;
    /// Compute solvent activity (e.g. a_w for water).
    fn solvent_activity(&self, phase: &LiquidPhase, t_k: f64, p_atm: f64) -> f64;
}

/// Helper: computes solvent mass in kg for phase.
#[inline]
pub fn get_solvent_kg(phase: &LiquidPhase) -> f64 {
    let solvent_sp = phase.solvent_species.as_deref().unwrap_or("H2O");
    let n_solv = phase.species_mol.get(solvent_sp).copied().unwrap_or(0.0);
    let mw_solv_kg = match solvent_sp {
        "H2O" => 0.01801528,
        "C2H5OH" => 0.046069,
        "C3H6O" | "acetone" => 0.05808,
        _ => 0.050,
    };
    (n_solv * mw_solv_kg).max(1e-12)
}

/// Helper: computes molality m_i = n_i / kg_solvent in phase.
pub fn get_molalities(phase: &LiquidPhase) -> (HashMap<String, f64>, f64) {
    let mut molalities = HashMap::new();
    let solvent_sp = phase.solvent_species.as_deref().unwrap_or("H2O");
    let kg_solv = get_solvent_kg(phase);
    for (sp, &mol) in &phase.species_mol {
        if sp != solvent_sp && !sp.ends_with("(s)") && !sp.ends_with("(g)") && mol > 0.0 {
            molalities.insert(sp.clone(), mol / kg_solv);
        }
    }
    (molalities, kg_solv)
}

/// Computes ionic strength I = 0.5 * sum(m_i * z_i^2) on the molality scale without allocating.
#[inline]
pub fn calc_molal_ionic_strength(phase: &LiquidPhase) -> f64 {
    let solvent_sp = phase.solvent_species.as_deref().unwrap_or("H2O");
    let kg_solv = get_solvent_kg(phase);
    let mut sum = 0.0;
    for (sp, &mol) in &phase.species_mol {
        if sp != solvent_sp && !sp.ends_with("(s)") && !sp.ends_with("(g)") && mol > 0.0 {
            let charge = crate::chem_db::get_species_thermo(sp).charge as f64;
            if charge != 0.0 {
                let m = mol / kg_solv;
                sum += m * charge * charge;
            }
        }
    }
    0.5 * sum
}

/// Debye-Hückel A_gamma parameter at temperature T (K).
/// At 298.15 K in water, A_gamma ~ 0.5092.
pub fn debye_huckel_a_gamma(t_k: f64) -> f64 {
    let t = t_k.clamp(273.15, 650.0);
    0.5092 * (298.15 / t).powf(1.5)
}

/// Debye-Hückel B_gamma parameter in Angstrom^-1.
/// At 298.15 K in water, B_gamma ~ 0.3283 Å^-1.
pub fn debye_huckel_b_gamma(t_k: f64) -> f64 {
    let t = t_k.clamp(273.15, 650.0);
    0.3283 * (298.15 / t).powf(0.5)
}

// ----------------------------------------------------------------------------
// 1. Ideal
// ----------------------------------------------------------------------------
#[derive(Clone, Copy, Debug, Default)]
pub struct IdealActivity;

impl ActivityModel for IdealActivity {
    fn ln_gamma(&self, _species: &str, _phase: &LiquidPhase, _t_k: f64, _p_atm: f64) -> f64 {
        0.0
    }

    fn solvent_activity(&self, phase: &LiquidPhase, _t_k: f64, _p_atm: f64) -> f64 {
        let total_mol: f64 = phase.species_mol.values().copied().filter(|&m| m > 0.0).sum();
        let solv_mol = phase.solvent_species.as_ref()
            .and_then(|s| phase.species_mol.get(s))
            .copied()
            .unwrap_or(0.0);
        if total_mol > 0.0 {
            (solv_mol / total_mol).clamp(0.0, 1.0)
        } else {
            1.0
        }
    }
}

// ----------------------------------------------------------------------------
// 2. Davies
// ----------------------------------------------------------------------------
#[derive(Clone, Copy, Debug, Default)]
pub struct DaviesActivity;

impl ActivityModel for DaviesActivity {
    fn ln_gamma(&self, species: &str, phase: &LiquidPhase, t_k: f64, _p_atm: f64) -> f64 {
        let charge = crate::chem_db::get_species_thermo(species).charge as f64;
        if charge == 0.0 {
            return 0.0;
        }
        let i = calc_molal_ionic_strength(phase);
        if i <= 1e-12 {
            return 0.0;
        }
        let a = debye_huckel_a_gamma(t_k);
        let sqrt_i = i.sqrt();
        let log10_gamma = -a * charge * charge * (sqrt_i / (1.0 + sqrt_i) - 0.3 * i);
        log10_gamma * LN_10
    }

    fn solvent_activity(&self, phase: &LiquidPhase, _t_k: f64, _p_atm: f64) -> f64 {
        let (m_map, _) = get_molalities(phase);
        let sum_m: f64 = m_map.values().sum();
        (1.0 - 0.01801528 * sum_m).clamp(0.01, 1.0)
    }
}

// ----------------------------------------------------------------------------
// 3. B-Dot (Helgeson / Truesdell-Jones)
// ----------------------------------------------------------------------------
#[derive(Clone, Copy, Debug, Default)]
pub struct BDotActivity;

impl BDotActivity {
    pub fn ion_size_angstrom(species: &str) -> f64 {
        match species {
            "H+" => 9.0,
            "OH-" => 3.5,
            "Na+" => 4.0,
            "K+" => 3.0,
            "Li+" => 6.0,
            "NH4+" => 2.5,
            "Ag+" => 2.5,
            "Ca+2" | "Ca2+" => 6.0,
            "Mg+2" | "Mg2+" => 8.0,
            "Ba+2" | "Ba2+" => 5.0,
            "Fe+2" | "Fe2+" => 6.0,
            "Fe+3" | "Fe3+" => 9.0,
            "Cu+2" | "Cu2+" => 6.0,
            "Zn+2" | "Zn2+" => 6.0,
            "Pb+2" | "Pb2+" => 4.5,
            "Cl-" => 3.0,
            "Br-" => 3.0,
            "I-" => 3.0,
            "F-" => 3.5,
            "NO3-" => 3.0,
            "SO4-2" | "SO42-" => 4.0,
            "HCO3-" => 4.0,
            "CO3-2" | "CO32-" => 4.5,
            _ => {
                let charge = crate::chem_db::get_species_thermo(species).charge.abs();
                if charge == 1 { 3.5 } else if charge == 2 { 5.0 } else { 6.0 }
            }
        }
    }
}

impl ActivityModel for BDotActivity {
    fn ln_gamma(&self, species: &str, phase: &LiquidPhase, t_k: f64, _p_atm: f64) -> f64 {
        let charge = crate::chem_db::get_species_thermo(species).charge as f64;
        let i = calc_molal_ionic_strength(phase);
        if i <= 1e-12 {
            return 0.0;
        }
        if charge == 0.0 {
            // Setchenow equation for neutral solutes: log10(gamma) = 0.1 * I
            return 0.1 * i * LN_10;
        }
        let a = debye_huckel_a_gamma(t_k);
        let b = debye_huckel_b_gamma(t_k);
        let a_ion = Self::ion_size_angstrom(species);
        let b_dot = 0.041; // Helgeson B-dot parameter for 25 °C
        let sqrt_i = i.sqrt();
        let log10_gamma = - (a * charge * charge * sqrt_i) / (1.0 + b * a_ion * sqrt_i) + b_dot * i;
        log10_gamma * LN_10
    }

    fn solvent_activity(&self, phase: &LiquidPhase, _t_k: f64, _p_atm: f64) -> f64 {
        let (m_map, _) = get_molalities(phase);
        let sum_m: f64 = m_map.values().sum();
        let i = calc_molal_ionic_strength(phase);
        let phi = 1.0 - 0.3915 * (i.sqrt() / (1.0 + 1.2 * i.sqrt())) + 0.05 * i;
        (-0.01801528 * sum_m * phi).exp().clamp(0.01, 1.0)
    }
}

// ----------------------------------------------------------------------------
// 4. SIT (Specific Ion Interaction Theory)
// ----------------------------------------------------------------------------
#[derive(Clone, Copy, Debug, Default)]
pub struct SitActivity;

impl SitActivity {
    pub fn epsilon(ion1: &str, ion2: &str) -> f64 {
        let (a, b) = if ion1 < ion2 { (ion1, ion2) } else { (ion2, ion1) };
        match (a, b) {
            ("Cl-", "Na+") => 0.03,
            ("Cl-", "K+") => 0.00,
            ("Cl-", "H+") => 0.12,
            ("Ca+2" | "Ca2+", "Cl-") => 0.15,
            ("NO3-", "Na+") => -0.04,
            ("K+", "NO3-") => -0.08,
            ("Ag+", "NO3-") => -0.06,
            ("Ag+", "Cl-") => 0.00,
            _ => 0.01,
        }
    }
}

impl ActivityModel for SitActivity {
    fn ln_gamma(&self, species: &str, phase: &LiquidPhase, t_k: f64, _p_atm: f64) -> f64 {
        let charge = crate::chem_db::get_species_thermo(species).charge as f64;
        if charge == 0.0 {
            return 0.0;
        }
        let i = calc_molal_ionic_strength(phase);
        if i <= 1e-12 {
            return 0.0;
        }
        let a = debye_huckel_a_gamma(t_k);
        let sqrt_i = i.sqrt();
        let dh = - (a * charge * charge * sqrt_i) / (1.0 + 1.5 * sqrt_i);
        
        let (m_map, _) = get_molalities(phase);
        let mut sit_sum = 0.0;
        for (other_sp, &m) in &m_map {
            let other_z = crate::chem_db::get_species_thermo(other_sp).charge as f64;
            if charge * other_z < 0.0 {
                sit_sum += Self::epsilon(species, other_sp) * m;
            }
        }
        (dh + sit_sum) * LN_10
    }

    fn solvent_activity(&self, phase: &LiquidPhase, _t_k: f64, _p_atm: f64) -> f64 {
        let (m_map, _) = get_molalities(phase);
        let sum_m: f64 = m_map.values().sum();
        (1.0 - 0.01801528 * sum_m).clamp(0.01, 1.0)
    }
}

// ----------------------------------------------------------------------------
// 5. Pitzer
// ----------------------------------------------------------------------------
#[derive(Clone, Copy, Debug, Default)]
pub struct PitzerActivity;

#[derive(Clone, Copy, Debug)]
pub struct PitzerBinaryParams {
    pub beta0: f64,
    pub beta1: f64,
    pub c_phi: f64,
    pub alpha: f64,
}

impl PitzerActivity {
    pub fn get_params(cat: &str, an: &str) -> Option<PitzerBinaryParams> {
        let (c, a) = (cat, an);
        if (c == "Na+" && a == "Cl-") || (a == "Na+" && c == "Cl-") {
            Some(PitzerBinaryParams {
                beta0: 0.0765,
                beta1: 0.2664,
                c_phi: 0.00127,
                alpha: 2.0,
            })
        } else if (c == "Ca+2" || c == "Ca2+") && a == "Cl-" || (a == "Ca+2" || a == "Ca2+") && c == "Cl-" {
            Some(PitzerBinaryParams {
                beta0: 0.3159,
                beta1: 1.6144,
                c_phi: -0.00034,
                alpha: 2.0,
            })
        } else if (c == "H+" && a == "Cl-") || (a == "H+" && c == "Cl-") {
            Some(PitzerBinaryParams {
                beta0: 0.1775,
                beta1: 0.2945,
                c_phi: 0.0008,
                alpha: 2.0,
            })
        } else if (c == "K+" && a == "NO3-") || (a == "K+" && c == "NO3-") {
            Some(PitzerBinaryParams {
                beta0: -0.020,
                beta1: 0.030,
                c_phi: -0.001,
                alpha: 2.0,
            })
        } else if (c == "K+" && a == "Cl-") || (a == "K+" && c == "Cl-") {
            Some(PitzerBinaryParams {
                beta0: 0.04835,
                beta1: 0.2122,
                c_phi: -0.00084,
                alpha: 2.0,
            })
        } else if (c == "Na+" && a == "OH-") || (a == "Na+" && c == "OH-") {
            Some(PitzerBinaryParams {
                beta0: 0.0864,
                beta1: 0.253,
                c_phi: 0.0044,
                alpha: 2.0,
            })
        } else {
            None
        }
    }

    /// Single electrolyte mean activity coefficient ln(gamma_pm)
    pub fn single_electrolyte_ln_gamma(m: f64, i_soln: f64, z_m: f64, z_x: f64, nu_m: f64, nu_x: f64, params: &PitzerBinaryParams) -> f64 {
        let nu = nu_m + nu_x;
        let i = i_soln.max(0.5 * (nu_m * z_m * z_m + nu_x * z_x * z_x) * m);
        let sqrt_i = i.max(1e-12).sqrt();
        let a_phi = 0.3915; // at 25 °C
        let b = 1.2;

        let f_gamma = -a_phi * (sqrt_i / (1.0 + b * sqrt_i) + (2.0 / b) * (1.0 + b * sqrt_i).ln());
        let a_sqrt_i = params.alpha * sqrt_i;
        let a2_i = params.alpha * params.alpha * i;
        let b_gamma = 2.0 * params.beta0 + (2.0 * params.beta1 / a2_i) * (1.0 - (1.0 + a_sqrt_i - 0.5 * a2_i) * (-a_sqrt_i).exp());
        let c_gamma = 1.5 * params.c_phi;

        let term1 = z_m.abs() * z_x.abs() * f_gamma;
        let term2 = m * (2.0 * nu_m * nu_x / nu) * b_gamma;
        let term3 = m * m * (2.0 * (nu_m * nu_x).powf(1.5) / nu) * c_gamma;
        term1 + term2 + term3
    }
}

impl ActivityModel for PitzerActivity {
    fn ln_gamma(&self, species: &str, phase: &LiquidPhase, t_k: f64, p_atm: f64) -> f64 {
        let charge = crate::chem_db::get_species_thermo(species).charge as f64;
        let i_tot = calc_molal_ionic_strength(phase);
        if charge == 0.0 {
            return 0.1 * i_tot * LN_10;
        }

        let solvent_sp = phase.solvent_species.as_deref().unwrap_or("H2O");
        let kg_solv = get_solvent_kg(phase);
        let m = phase.species_mol.get(species).copied().unwrap_or(0.0) / kg_solv;

        // Search for matching counterion to evaluate binary Pitzer, selecting dominant counterion
        let mut best_param = None;
        let mut best_other_m = -1.0;
        let mut best_m_salt = 0.0;
        let mut best_geom = (1.0, 1.0, 1.0, 1.0);

        for (other_sp, &other_mol) in &phase.species_mol {
            if other_sp == solvent_sp || other_sp.ends_with("(s)") || other_sp.ends_with("(g)") || other_mol <= 0.0 {
                continue;
            }
            let other_charge = crate::chem_db::get_species_thermo(other_sp).charge as f64;
            if charge * other_charge < 0.0 {
                let other_m = other_mol / kg_solv;
                let (cat, an, z_m, z_x) = if charge > 0.0 {
                    (species, other_sp.as_str(), charge, other_charge.abs())
                } else {
                    (other_sp.as_str(), species, other_charge, charge.abs())
                };
                if let Some(p) = Self::get_params(cat, an) {
                    if other_m > best_other_m {
                        best_other_m = other_m;
                        let nu_m = z_x;
                        let nu_x = z_m;
                        let m_counter = if charge > 0.0 { other_m / nu_x } else { other_m / nu_m };
                        let m_self = if charge > 0.0 { m / nu_m } else { m / nu_x };
                        best_m_salt = if m_self > other_m { m_self } else { m_counter };
                        best_param = Some(p);
                        best_geom = (z_m, z_x, nu_m, nu_x);
                    }
                }
            }
        }

        if let Some(p) = best_param {
            let (z_m, z_x, nu_m, nu_x) = best_geom;
            return Self::single_electrolyte_ln_gamma(best_m_salt, i_tot, z_m, z_x, nu_m, nu_x, &p);
        }

        // Fallback to BDot for unparameterized ions
        BDotActivity.ln_gamma(species, phase, t_k, p_atm)
    }

    fn solvent_activity(&self, phase: &LiquidPhase, _t_k: f64, _p_atm: f64) -> f64 {
        let solvent_sp = phase.solvent_species.as_deref().unwrap_or("H2O");
        let kg_solv = get_solvent_kg(phase);
        let mut sum_m = 0.0;
        for (sp, &mol) in &phase.species_mol {
            if sp != solvent_sp && !sp.ends_with("(s)") && !sp.ends_with("(g)") && mol > 0.0 {
                sum_m += mol / kg_solv;
            }
        }
        let i = calc_molal_ionic_strength(phase);
        if i <= 1e-12 {
            return 1.0;
        }
        let a_phi = 0.3915;
        let phi = 1.0 - a_phi * (i.sqrt() / (1.0 + 1.2 * i.sqrt())) + 0.04 * i;
        (-0.01801528 * sum_m * phi).exp().clamp(0.01, 1.0)
    }
}

// ----------------------------------------------------------------------------
// 6. UNIFAC
// ----------------------------------------------------------------------------
#[derive(Clone, Copy, Debug, Default)]
pub struct UnifacActivity;

impl ActivityModel for UnifacActivity {
    fn ln_gamma(&self, species: &str, phase: &LiquidPhase, _t_k: f64, _p_atm: f64) -> f64 {
        // Combinatorial (Staverman-Guggenheim) for neutral liquid mixtures
        let total_mol: f64 = phase.species_mol.values().copied().filter(|&m| m > 0.0).sum();
        if total_mol <= 0.0 {
            return 0.0;
        }
        let xi = phase.species_mol.get(species).copied().unwrap_or(0.0) / total_mol;
        if xi <= 0.0 || xi >= 1.0 {
            return 0.0;
        }
        // r (volume) and q (surface area) group parameters
        let (r_i, q_i) = match species {
            "H2O" => (0.920, 1.400),
            "C2H5OH" => (2.575, 2.588),
            "C3H6O" | "acetone" => (2.573, 2.336),
            "C6H14" | "hexane" => (4.499, 3.856),
            "C7H8" | "toluene" => (3.922, 2.968),
            _ => (2.0, 2.0),
        };
        // Combinatorial approximation ln(gamma_C) ~ (1 - r_i / r_bar) + ln(r_i / r_bar)
        let mut r_bar = 0.0;
        let mut q_bar = 0.0;
        for (sp, &mol) in &phase.species_mol {
            let x = mol / total_mol;
            let (r, q) = match sp.as_str() {
                "H2O" => (0.920, 1.400),
                "C2H5OH" => (2.575, 2.588),
                "C3H6O" | "acetone" => (2.573, 2.336),
                _ => (2.0, 2.0),
            };
            r_bar += x * r;
            q_bar += x * q;
        }
        let phi_i = xi * r_i / r_bar;
        let theta_i = xi * q_i / q_bar;
        let z = 10.0;
        let ln_gamma_c = (phi_i / xi).ln() + 1.0 - phi_i / xi - (z / 2.0) * q_i * ((phi_i / theta_i).ln() + 1.0 - phi_i / theta_i);
        ln_gamma_c.clamp(-5.0, 5.0)
    }

    fn solvent_activity(&self, phase: &LiquidPhase, t_k: f64, p_atm: f64) -> f64 {
        let solvent = phase.solvent_species.as_deref().unwrap_or("H2O");
        let total_mol: f64 = phase.species_mol.values().copied().filter(|&m| m > 0.0).sum();
        if total_mol <= 0.0 {
            return 1.0;
        }
        let x_solv = phase.species_mol.get(solvent).copied().unwrap_or(0.0) / total_mol;
        let ln_g = self.ln_gamma(solvent, phase, t_k, p_atm);
        (x_solv * ln_g.exp()).clamp(0.0, 1.0)
    }
}

// ----------------------------------------------------------------------------
// 7. Born Transfer
// ----------------------------------------------------------------------------
#[derive(Clone, Copy, Debug, Default)]
pub struct BornTransferActivity;

impl ActivityModel for BornTransferActivity {
    fn ln_gamma(&self, species: &str, phase: &LiquidPhase, t_k: f64, _p_atm: f64) -> f64 {
        let charge = crate::chem_db::get_species_thermo(species).charge as f64;
        if charge == 0.0 {
            return 0.0;
        }
        let eps_water = 78.4;
        let eps_phase = phase.dielectric_constant.clamp(1.5, 100.0);
        if (eps_phase - eps_water).abs() < 0.5 {
            return 0.0;
        }
        // Born equation: delta_G_trans = (N_A * e^2 * z^2) / (8 * pi * eps_0 * r_ion) * (1/eps_phase - 1/eps_water)
        // With e^2 / (8 pi eps_0 k_B) ~ 83.5 Å K:
        let r_ion_angstrom = BDotActivity::ion_size_angstrom(species);
        let factor = (83.5 * charge * charge / (r_ion_angstrom * t_k)) * (1.0 / eps_phase - 1.0 / eps_water);
        factor.clamp(-20.0, 30.0)
    }

    fn solvent_activity(&self, phase: &LiquidPhase, _t_k: f64, _p_atm: f64) -> f64 {
        let total_mol: f64 = phase.species_mol.values().copied().filter(|&m| m > 0.0).sum();
        let solv_mol = phase.solvent_species.as_ref()
            .and_then(|s| phase.species_mol.get(s))
            .copied()
            .unwrap_or(0.0);
        if total_mol > 0.0 {
            (solv_mol / total_mol).clamp(0.0, 1.0)
        } else {
            1.0
        }
    }
}

// ----------------------------------------------------------------------------
// 8. Default Unified Activity Model
// ----------------------------------------------------------------------------
#[derive(Clone, Copy, Debug, Default)]
pub struct DefaultActivityModel;

impl ActivityModel for DefaultActivityModel {
    fn ln_gamma(&self, species: &str, phase: &LiquidPhase, t_k: f64, p_atm: f64) -> f64 {
        let charge = crate::chem_db::get_species_thermo(species).charge;
        if phase.kind == crate::vessel::PhaseKind::Aqueous {
            if charge != 0 {
                // If Pitzer parameters exist for the electrolyte present, use Pitzer:
                PitzerActivity.ln_gamma(species, phase, t_k, p_atm)
            } else {
                // Neutral solute in water
                BDotActivity.ln_gamma(species, phase, t_k, p_atm)
            }
        } else {
            // Non-aqueous / organic phase
            if charge != 0 {
                BornTransferActivity.ln_gamma(species, phase, t_k, p_atm)
            } else {
                UnifacActivity.ln_gamma(species, phase, t_k, p_atm)
            }
        }
    }

    fn solvent_activity(&self, phase: &LiquidPhase, t_k: f64, p_atm: f64) -> f64 {
        if phase.kind == crate::vessel::PhaseKind::Aqueous {
            PitzerActivity.solvent_activity(phase, t_k, p_atm)
        } else {
            UnifacActivity.solvent_activity(phase, t_k, p_atm)
        }
    }
}

pub fn default_activity_model() -> DefaultActivityModel {
    DefaultActivityModel
}

/// High-performance batch evaluation of aqueous activity coefficients and solvent activity a_w.
pub fn batch_aqueous_gamma_and_aw(
    species_mol: &HashMap<String, f64>,
    t_k: f64,
) -> (HashMap<String, f64>, f64) {
    let n_h2o = species_mol.get("H2O").copied().unwrap_or(0.0);
    let kg_solv = (n_h2o * 0.01801528).max(1e-12);

    #[derive(Clone, Copy)]
    struct Solute<'a> {
        sp: &'a str,
        charge: f64,
        m: f64,
    }

    let mut solutes = Vec::with_capacity(species_mol.len());
    let mut sum_m = 0.0;
    let mut two_i = 0.0;

    for (sp, &mol) in species_mol {
        if mol <= 0.0 || sp == "H2O" || sp == "C2H5OH" || sp.ends_with("(s)") || sp.ends_with("(l)") || sp.ends_with("(g)") {
            continue;
        }
        let charge = crate::chem_db::get_species_thermo(sp).charge as f64;
        let m = mol / kg_solv;
        sum_m += m;
        two_i += m * charge * charge;
        solutes.push(Solute {
            sp: sp.as_str(),
            charge,
            m,
        });
    }

    let i_tot = 0.5 * two_i;
    let a_w = if i_tot <= 1e-12 {
        1.0
    } else {
        let a_phi = 0.3915;
        let sqrt_i = i_tot.sqrt();
        let phi = 1.0 - a_phi * (sqrt_i / (1.0 + 1.2 * sqrt_i)) + 0.04 * i_tot;
        (-0.01801528 * sum_m * phi).exp().clamp(0.01, 1.0)
    };

    let a_gamma = debye_huckel_a_gamma(t_k);
    let b_gamma = debye_huckel_b_gamma(t_k);
    let sqrt_i = i_tot.max(1e-12).sqrt();

    let mut gamma_cache = HashMap::with_capacity(solutes.len() + 1);
    gamma_cache.insert("H2O".to_string(), 0.0);

    for s in &solutes {
        let ln_g = if s.charge == 0.0 {
            0.1 * i_tot * LN_10
        } else {
            let mut best_param = None;
            let mut best_other_m = -1.0;
            let mut best_m_salt = 0.0;
            let mut best_geom = (1.0, 1.0, 1.0, 1.0);

            for other in &solutes {
                if s.charge * other.charge < 0.0 {
                    let (cat, an, z_m, z_x) = if s.charge > 0.0 {
                        (s.sp, other.sp, s.charge, other.charge.abs())
                    } else {
                        (other.sp, s.sp, other.charge, s.charge.abs())
                    };
                    if let Some(p) = PitzerActivity::get_params(cat, an) {
                        if other.m > best_other_m {
                            best_other_m = other.m;
                            let nu_m = z_x;
                            let nu_x = z_m;
                            let m_counter = if s.charge > 0.0 { other.m / nu_x } else { other.m / nu_m };
                            let m_self = if s.charge > 0.0 { s.m / nu_m } else { s.m / nu_x };
                            best_m_salt = if m_self > other.m { m_self } else { m_counter };
                            best_param = Some(p);
                            best_geom = (z_m, z_x, nu_m, nu_x);
                        }
                    }
                }
            }

            if let Some(p) = best_param {
                let (z_m, z_x, nu_m, nu_x) = best_geom;
                PitzerActivity::single_electrolyte_ln_gamma(best_m_salt, i_tot, z_m, z_x, nu_m, nu_x, &p)
            } else {
                if i_tot <= 1e-12 {
                    0.0
                } else {
                    let a_angstrom = BDotActivity::ion_size_angstrom(s.sp);
                    let b_dot = 0.04;
                    let denom = 1.0 + b_gamma * a_angstrom * sqrt_i;
                    let log10_gamma = -a_gamma * s.charge * s.charge * sqrt_i / denom + b_dot * i_tot;
                    log10_gamma * LN_10
                }
            }
        };
        gamma_cache.insert(s.sp.to_string(), ln_g);
    }

    (gamma_cache, a_w)
}

/// Batch aqueous gamma evaluation from a slice of names/amounts plus extra background species.
pub fn batch_aqueous_gamma_and_aw_from_slices(
    names: &[String],
    amounts: &[f64],
    extra_species: &HashMap<String, f64>,
    t_k: f64,
) -> (HashMap<String, f64>, f64) {
    let mut n_h2o = 0.0;
    for (i, name) in names.iter().enumerate() {
        if name == "H2O" {
            n_h2o = amounts[i];
            break;
        }
    }
    if n_h2o <= 0.0 {
        n_h2o = extra_species.get("H2O").copied().unwrap_or(0.0);
    }
    let kg_solv = (n_h2o * 0.01801528).max(1e-12);

    #[derive(Clone, Copy)]
    struct Solute<'a> {
        sp: &'a str,
        charge: f64,
        m: f64,
    }

    let mut solutes = Vec::with_capacity(names.len() + extra_species.len());
    let mut sum_m = 0.0;
    let mut two_i = 0.0;

    for (i, name) in names.iter().enumerate() {
        let mol = amounts[i];
        if mol <= 0.0 || name == "H2O" || name == "C2H5OH" || name.ends_with("(s)") || name.ends_with("(l)") || name.ends_with("(g)") {
            continue;
        }
        let charge = crate::chem_db::get_species_thermo(name).charge as f64;
        let m = mol / kg_solv;
        sum_m += m;
        two_i += m * charge * charge;
        solutes.push(Solute {
            sp: name.as_str(),
            charge,
            m,
        });
    }

    for (sp, &mol) in extra_species {
        if mol <= 0.0 || sp == "H2O" || sp == "C2H5OH" || sp.ends_with("(s)") || sp.ends_with("(l)") || sp.ends_with("(g)") {
            continue;
        }
        if names.iter().any(|n| n == sp) {
            continue;
        }
        let charge = crate::chem_db::get_species_thermo(sp).charge as f64;
        let m = mol / kg_solv;
        sum_m += m;
        two_i += m * charge * charge;
        solutes.push(Solute {
            sp: sp.as_str(),
            charge,
            m,
        });
    }

    let i_tot = 0.5 * two_i;
    let a_w = if i_tot <= 1e-12 {
        1.0
    } else {
        let a_phi = 0.3915;
        let sqrt_i = i_tot.sqrt();
        let phi = 1.0 - a_phi * (sqrt_i / (1.0 + 1.2 * sqrt_i)) + 0.04 * i_tot;
        (-0.01801528 * sum_m * phi).exp().clamp(0.01, 1.0)
    };

    let a_gamma = debye_huckel_a_gamma(t_k);
    let b_gamma = debye_huckel_b_gamma(t_k);
    let sqrt_i = i_tot.max(1e-12).sqrt();

    let mut gamma_cache = HashMap::with_capacity(solutes.len() + 1);
    gamma_cache.insert("H2O".to_string(), 0.0);

    for s in &solutes {
        let ln_g = if s.charge == 0.0 {
            0.1 * i_tot * LN_10
        } else {
            let mut best_param = None;
            let mut best_other_m = -1.0;
            let mut best_m_salt = 0.0;
            let mut best_geom = (1.0, 1.0, 1.0, 1.0);

            for other in &solutes {
                if s.charge * other.charge < 0.0 {
                    let (cat, an, z_m, z_x) = if s.charge > 0.0 {
                        (s.sp, other.sp, s.charge, other.charge.abs())
                    } else {
                        (other.sp, s.sp, other.charge, s.charge.abs())
                    };
                    if let Some(p) = PitzerActivity::get_params(cat, an) {
                        if other.m > best_other_m {
                            best_other_m = other.m;
                            let nu_m = z_x;
                            let nu_x = z_m;
                            let m_counter = if s.charge > 0.0 { other.m / nu_x } else { other.m / nu_m };
                            let m_self = if s.charge > 0.0 { s.m / nu_m } else { s.m / nu_x };
                            best_m_salt = if m_self > other.m { m_self } else { m_counter };
                            best_param = Some(p);
                            best_geom = (z_m, z_x, nu_m, nu_x);
                        }
                    }
                }
            }

            if let Some(p) = best_param {
                let (z_m, z_x, nu_m, nu_x) = best_geom;
                PitzerActivity::single_electrolyte_ln_gamma(best_m_salt, i_tot, z_m, z_x, nu_m, nu_x, &p)
            } else {
                if i_tot <= 1e-12 {
                    0.0
                } else {
                    let a_angstrom = BDotActivity::ion_size_angstrom(s.sp);
                    let b_dot = 0.04;
                    let denom = 1.0 + b_gamma * a_angstrom * sqrt_i;
                    let log10_gamma = -a_gamma * s.charge * s.charge * sqrt_i / denom + b_dot * i_tot;
                    log10_gamma * LN_10
                }
            }
        };
        gamma_cache.insert(s.sp.to_string(), ln_g);
    }

    (gamma_cache, a_w)
}

