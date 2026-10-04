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
    let solvent_sp = phase.solvent_species.as_deref().unwrap_or(crate::vessel::AQUEOUS_SOLVENT);
    let n_solv = phase.species_mol.get(solvent_sp).copied().unwrap_or(0.0);
    let mw_solv_kg = if solvent_sp == crate::vessel::AQUEOUS_SOLVENT { crate::volume::WATER_MW } else { crate::chem_db::get_species_thermo(solvent_sp).mw } * 1e-3;
    (n_solv * mw_solv_kg).max(1e-12)
}

/// Helper: computes molality m_i = n_i / kg_solvent in phase.
pub fn get_molalities(phase: &LiquidPhase) -> (HashMap<String, f64>, f64) {
    let mut molalities = HashMap::new();
    let solvent_sp = phase.solvent_species.as_deref().unwrap_or(crate::db::seed::WATER);
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
    let solvent_sp = phase.solvent_species.as_deref().unwrap_or(crate::db::seed::WATER);
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

/// Reference state of the Debye-Hueckel slopes (the 25 C values the activity gates are written against).
const DH_A_GAMMA_298: f64 = 0.5092;
const DH_B_GAMMA_298: f64 = 0.3283;
const DH_A_PHI_298: f64 = 0.3915;

/// `(eps T)^-1.5 sqrt(rho)` of liquid water relative to 298.15 K: the physical T dependence of the Debye-Hueckel limiting
/// slope (A is proportional to sqrt(rho) / (eps T)^1.5, B to sqrt(rho) / (eps T)^0.5). The dielectric constant of water
/// falls from 78 to 56 between 25 and 100 C, so the slope *rises* with temperature (0.509 -> 0.594 kg^0.5 mol^-0.5).
fn debye_huckel_factors(t_k: f64) -> (f64, f64) {
    let t = t_k.clamp(273.15, 473.15);
    let eps = crate::thermo::water::water_dielectric_sat(t);
    let eps_ref = crate::thermo::water::water_dielectric_sat(298.15);
    let et_ratio = (eps_ref * 298.15) / (eps * t);
    let rho_ratio = crate::volume::water_density_iapws(t) / crate::volume::water_density_iapws(298.15);
    (et_ratio, rho_ratio)
}

/// Debye-Hückel A_gamma parameter at temperature T (K) (log10 base): 0.5092 at 298.15 K, 0.594 at 373 K.
pub fn debye_huckel_a_gamma(t_k: f64) -> f64 {
    let (et, rho) = debye_huckel_factors(t_k);
    DH_A_GAMMA_298 * et.powf(1.5) * rho.sqrt()
}

/// Debye-Hückel B_gamma parameter in Angstrom^-1: 0.3283 at 298.15 K.
pub fn debye_huckel_b_gamma(t_k: f64) -> f64 {
    let (et, rho) = debye_huckel_factors(t_k);
    DH_B_GAMMA_298 * et.sqrt() * rho.sqrt()
}

/// Pitzer / Debye-Hückel osmotic slope A_phi (natural-log base): 0.3915 at 298.15 K.
pub fn debye_huckel_a_phi(t_k: f64) -> f64 {
    DH_A_PHI_298 * debye_huckel_a_gamma(t_k) / DH_A_GAMMA_298
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
// Ion-specific data (data/ion_interactions.json)
// ----------------------------------------------------------------------------
#[derive(serde::Deserialize)]
struct PitzerRow {
    cation: String,
    anion: String,
    beta0: f64,
    beta1: f64,
    c_phi: f64,
    alpha: f64,
}

#[derive(serde::Deserialize)]
pub(crate) struct IonData {
    ion_size_angstrom: HashMap<String, f64>,
    ion_size_default_by_abs_charge: HashMap<String, f64>,
    sit_epsilon: Vec<(String, String, f64)>,
    sit_epsilon_default: f64,
    pitzer_binary: Vec<PitzerRow>,
    pub(crate) ion_volume_v0_cm3_mol: HashMap<String, f64>,
}

pub(crate) fn ion_data() -> &'static IonData {
    static D: std::sync::OnceLock<IonData> = std::sync::OnceLock::new();
    D.get_or_init(|| serde_json::from_str(include_str!("../data/ion_interactions.json")).expect("data/ion_interactions.json"))
}

// ----------------------------------------------------------------------------
// 3. B-Dot (Helgeson / Truesdell-Jones)
// ----------------------------------------------------------------------------
#[derive(Clone, Copy, Debug, Default)]
pub struct BDotActivity;

impl BDotActivity {
    /// Ion-size parameter a (Angstrom) of the extended Debye-Hueckel / B-dot form: the species' row of
    /// `data/ion_interactions.json`, else the class value of its charge.
    pub fn ion_size_angstrom(species: &str) -> f64 {
        let d = ion_data();
        if let Some(a) = d.ion_size_angstrom.get(species) {
            return *a;
        }
        let charge = crate::chem_db::get_species_thermo(species).charge.abs();
        d.ion_size_default_by_abs_charge.get(&charge.to_string()).copied().unwrap_or(6.0)
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

    fn solvent_activity(&self, phase: &LiquidPhase, t_k: f64, _p_atm: f64) -> f64 {
        let (m_map, _) = get_molalities(phase);
        let sum_m: f64 = m_map.values().sum();
        let i = calc_molal_ionic_strength(phase);
        let phi = 1.0 - debye_huckel_a_phi(t_k) * (i.sqrt() / (1.0 + 1.2 * i.sqrt())) + 0.05 * i;
        (-0.01801528 * sum_m * phi).exp().clamp(0.01, 1.0)
    }
}

// ----------------------------------------------------------------------------
// 4. SIT (Specific Ion Interaction Theory)
// ----------------------------------------------------------------------------
#[derive(Clone, Copy, Debug, Default)]
pub struct SitActivity;

impl SitActivity {
    /// SIT interaction coefficient of an ion pair (`data/ion_interactions.json`, either order), else the default.
    pub fn epsilon(ion1: &str, ion2: &str) -> f64 {
        let d = ion_data();
        d.sit_epsilon
            .iter()
            .find(|(a, b, _)| (a == ion1 && b == ion2) || (a == ion2 && b == ion1))
            .map(|(_, _, e)| *e)
            .unwrap_or(d.sit_epsilon_default)
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
    /// Pitzer binary parameters of a cation-anion pair at 25 C (`data/ion_interactions.json`; the order of the two is free).
    pub fn get_params(cat: &str, an: &str) -> Option<PitzerBinaryParams> {
        ion_data()
            .pitzer_binary
            .iter()
            .find(|r| (r.cation == cat && r.anion == an) || (r.cation == an && r.anion == cat))
            .map(|r| PitzerBinaryParams { beta0: r.beta0, beta1: r.beta1, c_phi: r.c_phi, alpha: r.alpha })
    }

    /// Single electrolyte mean activity coefficient ln(gamma_pm)
    pub fn single_electrolyte_ln_gamma(m: f64, i_soln: f64, z_m: f64, z_x: f64, nu_m: f64, nu_x: f64, params: &PitzerBinaryParams, t_k: f64) -> f64 {
        let nu = nu_m + nu_x;
        let i = i_soln.max(0.5 * (nu_m * z_m * z_m + nu_x * z_x * z_x) * m);
        let sqrt_i = i.max(1e-12).sqrt();
        let a_phi = debye_huckel_a_phi(t_k);
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

impl PitzerActivity {
    /// Osmotic coefficient of a single electrolyte (Pitzer): `phi = 1 + |zM zX| f^phi + m (2 nuM nuX / nu) B^phi
    /// + m^2 (2 (nuM nuX)^1.5 / nu) C^phi`, `f^phi = -A_phi sqrt(I) / (1 + 1.2 sqrt(I))`, `B^phi = beta0 + beta1 exp(-alpha sqrt(I))`.
    pub fn single_electrolyte_osmotic_coefficient(m: f64, i_soln: f64, z_m: f64, z_x: f64, nu_m: f64, nu_x: f64, params: &PitzerBinaryParams, t_k: f64) -> f64 {
        let nu = nu_m + nu_x;
        let i = i_soln.max(0.5 * (nu_m * z_m * z_m + nu_x * z_x * z_x) * m);
        let sqrt_i = i.max(1e-12).sqrt();
        let a_phi = debye_huckel_a_phi(t_k);
        let f_phi = -a_phi * sqrt_i / (1.0 + 1.2 * sqrt_i);
        let b_phi = params.beta0 + params.beta1 * (-params.alpha * sqrt_i).exp();
        1.0 + z_m.abs() * z_x.abs() * f_phi + m * (2.0 * nu_m * nu_x / nu) * b_phi + m * m * (2.0 * (nu_m * nu_x).powf(1.5) / nu) * params.c_phi
    }
}

/// ln of the water activity from the *ionic* solutes of an aqueous solution (`species_mol` holds the amounts; molality
/// on the water in it): `ln a_w = -phi M_w sum_i m_i`. A single dominant electrolyte with Pitzer parameters uses its
/// own osmotic coefficient; every other ionic mixture uses the generic Debye-Hueckel osmotic coefficient with the
/// temperature-dependent slope. Neutral solutes (ethanol, dissolved gases) are not included: molecular solvents enter the
/// vapour-liquid equilibrium through their own activity model (UNIFAC), and mixing the two is first-order additive.
pub fn ionic_ln_water_activity(species_mol: &HashMap<String, f64>, t_k: f64) -> f64 {
    let n_h2o = species_mol.get(crate::db::seed::WATER).copied().unwrap_or(0.0);
    if n_h2o <= 0.0 {
        return 0.0;
    }
    let kg = n_h2o * 0.01801528;
    // (species, charge, m)
    let mut ions: Vec<(&str, f64, f64)> = Vec::new();
    for (sp, &mol) in species_mol {
        if mol <= 0.0 || sp == crate::db::seed::WATER || sp.ends_with("(s)") || sp.ends_with("(l)") || sp.ends_with("(g)") {
            continue;
        }
        let charge = crate::ions::species_charge(sp) as f64;
        if charge != 0.0 {
            ions.push((sp.as_str(), charge, mol / kg));
        }
    }
    if ions.is_empty() {
        return 0.0;
    }
    let two_i: f64 = ions.iter().map(|(_, z, m)| m * z * z).sum();
    let i_tot = 0.5 * two_i;
    let sum_m: f64 = ions.iter().map(|(_, _, m)| *m).sum();
    if i_tot <= 1e-12 {
        return 0.0;
    }
    // dominant cation and anion
    let cat = ions.iter().filter(|(_, z, _)| *z > 0.0).max_by(|a, b| (a.2 * a.1 * a.1).partial_cmp(&(b.2 * b.1 * b.1)).unwrap());
    let an = ions.iter().filter(|(_, z, _)| *z < 0.0).max_by(|a, b| (a.2 * a.1 * a.1).partial_cmp(&(b.2 * b.1 * b.1)).unwrap());
    if let (Some(&(c_sp, zc, mc)), Some(&(a_sp, za, ma))) = (cat, an) {
        if let Some(p) = PitzerActivity::get_params(c_sp, a_sp) {
            let dominated = (mc * zc * zc + ma * za * za) >= 0.98 * two_i;
            if dominated {
                // formula-unit stoichiometry: nuM zM = nuX |zX|
                let (zm, zx) = (zc, -za);
                let g = {
                    let (mut a, mut b) = (zm as i64, zx as i64);
                    while b != 0 {
                        let t = a % b;
                        a = b;
                        b = t;
                    }
                    a.max(1) as f64
                };
                let (nu_m, nu_x) = (zx / g, zm / g);
                let m_salt = (mc / nu_m).max(ma / nu_x);
                let phi = PitzerActivity::single_electrolyte_osmotic_coefficient(m_salt, i_tot, zm, zx, nu_m, nu_x, &p, t_k);
                return -phi * 0.01801528 * (nu_m + nu_x) * m_salt;
            }
        }
    }
    let sqrt_i = i_tot.sqrt();
    let phi = 1.0 - debye_huckel_a_phi(t_k) * sqrt_i / (1.0 + 1.2 * sqrt_i) + 0.04 * i_tot;
    -0.01801528 * sum_m * phi
}

impl ActivityModel for PitzerActivity {
    fn ln_gamma(&self, species: &str, phase: &LiquidPhase, t_k: f64, p_atm: f64) -> f64 {
        let charge = crate::chem_db::get_species_thermo(species).charge as f64;
        let i_tot = calc_molal_ionic_strength(phase);
        if charge == 0.0 {
            return 0.1 * i_tot * LN_10;
        }

        let solvent_sp = phase.solvent_species.as_deref().unwrap_or(crate::db::seed::WATER);
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
            return Self::single_electrolyte_ln_gamma(best_m_salt, i_tot, z_m, z_x, nu_m, nu_x, &p, t_k);
        }

        // Fallback to BDot for unparameterized ions
        BDotActivity.ln_gamma(species, phase, t_k, p_atm)
    }

    fn solvent_activity(&self, phase: &LiquidPhase, t_k: f64, _p_atm: f64) -> f64 {
        let solvent_sp = phase.solvent_species.as_deref().unwrap_or(crate::db::seed::WATER);
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
        let a_phi = debye_huckel_a_phi(t_k);
        let phi = 1.0 - a_phi * (i.sqrt() / (1.0 + 1.2 * i.sqrt())) + 0.04 * i;
        (-0.01801528 * sum_m * phi).exp().clamp(0.01, 1.0)
    }
}

// ----------------------------------------------------------------------------
// 6. UNIFAC
// ----------------------------------------------------------------------------
//
// Group-contribution activity coefficients for mixtures of neutral molecules (Fredenslund, Jones & Prausnitz 1975):
//
//   ln gamma_i = ln gamma_i^C + ln gamma_i^R
//   ln gamma_i^C = 1 - V_i + ln V_i - 5 q_i (1 - V_i/F_i + ln(V_i/F_i)),  V_i = r_i / sum x r,  F_i = q_i / sum x q
//   ln gamma_i^R = sum_k nu_k^(i) (ln Gamma_k - ln Gamma_k^(i))
//   ln Gamma_k   = Q_k [1 - ln(sum_m Theta_m Psi_mk) - sum_m Theta_m Psi_km / sum_n Theta_n Psi_nm],  Psi_mn = exp(-a_mn / T)
//
// The group volumes R, areas Q and interaction parameters a_mn live in `data/unifac_vle.json` (written with an honest
// tier; the pipeline replaces them). The groups of a species come from its SMILES (`groups.rs`) or from an explicit
// record field; a species without groups, or a mixture that needs a pair the table lacks, is *outside UNIFAC*:
// `unifac_ln_gamma` returns None and callers use an ideal solution and label it.

/// UNIFAC subgroup (R, Q), the main group it belongs to and the patterns that assign it to a molecule.
#[derive(Clone, Debug)]
pub struct UnifacSubgroup {
    pub id: u32,
    pub name: String,
    pub main: usize,
    pub r: f64,
    pub q: f64,
    /// Hydrogens the subgroup accounts for (the sum over its atoms); a match must agree with it.
    pub h: u32,
    /// SMARTS patterns (any one matches); empty when the table's patterns use unsupported syntax.
    pub patterns: Vec<crate::smarts::Pattern>,
}

pub struct UnifacParams {
    pub subgroups: Vec<UnifacSubgroup>,
    a_mn: HashMap<(usize, usize), f64>,
    name_index: HashMap<String, usize>,
    pub tier: crate::types::ProvenanceTier,
    pub source: String,
    /// Subgroups whose published SMARTS could not be parsed (they are never assigned).
    pub unsupported: Vec<String>,
}

impl UnifacParams {
    pub fn subgroup_index(&self, name: &str) -> Option<usize> {
        self.name_index.get(name).copied()
    }

    /// Interaction a_mn (K) between two main groups: 0 inside a main group, None when the table lacks the pair.
    pub fn a(&self, m: usize, n: usize) -> Option<f64> {
        if m == n {
            return Some(0.0);
        }
        self.a_mn.get(&(m, n)).copied()
    }
}

/// Removes recursive negative look-ahead clauses (`;!$(...)`) from a published SMARTS. They only disambiguate groups
/// that overlap in the table's own matcher (CH2Cl against CH2Cl2); the exact-cover assignment in `groups.rs` resolves
/// such overlaps by itself, so the plain pattern is what the engine matches.
fn strip_negative_lookaheads(s: &str) -> String {
    let mut out = String::new();
    let b: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < b.len() {
        if b[i] == ';' && b.get(i + 1) == Some(&'!') && b.get(i + 2) == Some(&'$') && b.get(i + 3) == Some(&'(') {
            let mut depth = 0;
            let mut j = i + 3;
            while j < b.len() {
                if b[j] == '(' {
                    depth += 1;
                } else if b[j] == ')' {
                    depth -= 1;
                    if depth == 0 {
                        break;
                    }
                }
                j += 1;
            }
            i = j + 1;
            continue;
        }
        out.push(b[i]);
        i += 1;
    }
    out
}

static UNIFAC_PARAMS: std::sync::OnceLock<UnifacParams> = std::sync::OnceLock::new();

pub fn unifac_params() -> &'static UnifacParams {
    UNIFAC_PARAMS.get_or_init(|| {
        let v: serde_json::Value = serde_json::from_str(include_str!("../data/unifac_vle.json")).expect("unifac_vle.json");
        let mut subgroups = Vec::new();
        let mut name_index = HashMap::new();
        let mut unsupported = Vec::new();
        for sg in v["subgroups"].as_array().expect("subgroups") {
            let name = sg["name"].as_str().unwrap_or("").to_string();
            let mut patterns = Vec::new();
            let mut all_ok = true;
            if let Some(list) = sg["smarts"].as_array() {
                for sm in list.iter().filter_map(|x| x.as_str()) {
                    match crate::smarts::parse(&strip_negative_lookaheads(sm)) {
                        Some(p) => patterns.push(p),
                        None => all_ok = false,
                    }
                }
            }
            if !all_ok {
                unsupported.push(name.clone());
            }
            name_index.insert(name.clone(), subgroups.len());
            subgroups.push(UnifacSubgroup {
                id: sg["id"].as_u64().unwrap_or(0) as u32,
                name,
                main: sg["main"].as_u64().unwrap_or(0) as usize,
                r: sg["R"].as_f64().unwrap_or(0.0),
                q: sg["Q"].as_f64().unwrap_or(0.0),
                h: sg["h"].as_u64().unwrap_or(0) as u32,
                patterns,
            });
        }
        let mut a_mn = HashMap::new();
        for row in v["a_mn"].as_array().expect("a_mn") {
            let (m, n, a) = (row[0].as_u64().unwrap_or(0) as usize, row[1].as_u64().unwrap_or(0) as usize, row[2].as_f64().unwrap_or(0.0));
            a_mn.insert((m, n), a);
        }
        UnifacParams {
            subgroups,
            a_mn,
            name_index,
            tier: match v["tier"].as_str() {
                Some("tabulated") => crate::types::ProvenanceTier::Tabulated,
                _ => crate::types::ProvenanceTier::Speculative,
            },
            source: v["source"].as_str().unwrap_or("").to_string(),
            unsupported,
        }
    })
}

/// Subgroup counts of one molecule: (index into `UnifacParams::subgroups`, count).
pub type GroupCounts = Vec<(usize, f64)>;

/// ln gamma_i of every component of a mixture (mole fractions `x`, subgroup counts `groups`) at `t_k`. Components with
/// x = 0 are left out of the mixture sums and get gamma = 1 (use `ln_gamma_infinite_dilution` for them). None when
/// the table lacks an interaction pair between two main groups present in the mixture.
pub fn unifac_ln_gamma(groups: &[&GroupCounts], x: &[f64], t_k: f64) -> Option<Vec<f64>> {
    let p = unifac_params();

    let nc = groups.len();
    let r_i: Vec<f64> = groups.iter().map(|g| g.iter().map(|&(k, v)| v * p.subgroups[k].r).sum()).collect();
    let q_i: Vec<f64> = groups.iter().map(|g| g.iter().map(|&(k, v)| v * p.subgroups[k].q).sum()).collect();
    let sum_r: f64 = (0..nc).map(|i| x[i] * r_i[i]).sum();
    let sum_q: f64 = (0..nc).map(|i| x[i] * q_i[i]).sum();
    if sum_r <= 0.0 || sum_q <= 0.0 {
        return Some(vec![0.0; nc]);
    }
    // distinct subgroups present (x > 0)
    let mut present: Vec<usize> = Vec::new();
    for i in 0..nc {
        if x[i] > 0.0 {
            for &(k, _) in groups[i] {
                if !present.contains(&k) {
                    present.push(k);
                }
            }
        }
    }
    let ng = present.len();
    let pos = |k: usize| present.iter().position(|&g| g == k);
    // Psi_mn between present subgroups (symmetric table lookup by main group)
    let mut psi = vec![vec![1.0; ng]; ng];
    for (a, &ka) in present.iter().enumerate() {
        for (b, &kb) in present.iter().enumerate() {
            let a_mn = p.a(p.subgroups[ka].main, p.subgroups[kb].main)?;
            psi[a][b] = (-a_mn / t_k).exp(); // psi[m][n] = Psi_mn
        }
    }
    let q_g: Vec<f64> = present.iter().map(|&k| p.subgroups[k].q).collect();
    // ln Gamma_k of a group set with amounts `nu` (per present subgroup)
    let ln_gamma_k = |nu: &[f64]| -> Vec<f64> {
        let tot: f64 = nu.iter().sum();
        if tot <= 0.0 {
            return vec![0.0; ng];
        }
        let qx: Vec<f64> = (0..ng).map(|k| q_g[k] * nu[k] / tot).collect();
        let sq: f64 = qx.iter().sum();
        let theta: Vec<f64> = qx.iter().map(|v| v / sq.max(1e-300)).collect();
        (0..ng)
            .map(|k| {
                let s1: f64 = (0..ng).map(|m| theta[m] * psi[m][k]).sum();
                let mut s2 = 0.0;
                for m in 0..ng {
                    let den: f64 = (0..ng).map(|n| theta[n] * psi[n][m]).sum();
                    s2 += theta[m] * psi[k][m] / den.max(1e-300);
                }
                q_g[k] * (1.0 - s1.max(1e-300).ln() - s2)
            })
            .collect()
    };
    // mixture group amounts
    let mut nu_mix = vec![0.0; ng];
    for i in 0..nc {
        if x[i] > 0.0 {
            for &(k, v) in groups[i] {
                if let Some(g) = pos(k) {
                    nu_mix[g] += x[i] * v;
                }
            }
        }
    }
    let ln_g_mix = ln_gamma_k(&nu_mix);
    let mut out = vec![0.0; nc];
    for i in 0..nc {
        if x[i] <= 0.0 {
            continue;
        }
        let v = r_i[i] / sum_r;
        let f = q_i[i] / sum_q;
        let ln_c = if q_i[i] > 0.0 && f > 0.0 {
            1.0 - v + v.ln() - 5.0 * q_i[i] * (1.0 - v / f + (v / f).ln())
        } else {
            1.0 - v + v.ln()
        };
        let mut nu_i = vec![0.0; ng];
        for &(k, c) in groups[i] {
            if let Some(g) = pos(k) {
                nu_i[g] += c;
            }
        }
        let ln_g_pure = ln_gamma_k(&nu_i);
        let ln_r: f64 = (0..ng).map(|k| nu_i[k] * (ln_g_mix[k] - ln_g_pure[k])).sum();
        out[i] = ln_c + ln_r;
    }
    Some(out)
}

static GROUP_CACHE: std::sync::Mutex<Option<(u64, HashMap<String, Option<GroupCounts>>)>> = std::sync::Mutex::new(None);

fn base_species_id(sp: &str) -> &str {
    let s = sp.strip_suffix("(l)").or_else(|| sp.strip_suffix("(aq)")).or_else(|| sp.strip_suffix("(s)")).or_else(|| sp.strip_suffix("(g)")).unwrap_or(sp);
    s
}

/// UNIFAC subgroup counts of a species id: explicit record field, else decomposed from the SMILES of its store record,
/// else from a SMILES registered for it (`register_unifac_smiles`, used for imported compounds). None = outside UNIFAC.
pub fn unifac_groups(species: &str) -> Option<GroupCounts> {
    let base = base_species_id(species).to_string();
    let generation = crate::db::SpeciesStore::generation();
    if let Ok(mut lock) = GROUP_CACHE.lock() {
        let entry = lock.get_or_insert_with(|| (generation, HashMap::new()));
        if entry.0 != generation {
            *entry = (generation, HashMap::new());
        }
        if let Some(v) = entry.1.get(&base) {
            return v.clone();
        }
    }
    let p = unifac_params();
    let resolved: Option<GroupCounts> = (|| {
        let named: Option<Vec<(String, f64)>> = {
            let store = crate::db::SpeciesStore::global();
            let guard = store.read().ok()?;
            let rec = guard.get(&base).or_else(|| guard.get(species));
            match rec {
                Some(r) => r.unifac_groups.clone().or_else(|| r.identity.smiles.as_deref().and_then(crate::groups::unifac_subgroups_from_smiles)),
                None => None,
            }
        };
        let named = named.or_else(|| {
            REGISTERED_SMILES.lock().ok().and_then(|m| m.as_ref().and_then(|map| map.get(&base).cloned())).and_then(|s| crate::groups::unifac_subgroups_from_smiles(&s))
        })?;
        let mut out = Vec::new();
        for (name, c) in named {
            out.push((p.subgroup_index(&name)?, c));
        }
        Some(out)
    })();
    if let Ok(mut lock) = GROUP_CACHE.lock() {
        if let Some(entry) = lock.as_mut() {
            entry.1.insert(base, resolved.clone());
        }
    }
    resolved
}

static REGISTERED_SMILES: std::sync::Mutex<Option<HashMap<String, String>>> = std::sync::Mutex::new(None);

/// Registers the SMILES of a species that has no store record (an imported compound), so UNIFAC can decompose it.
pub fn register_unifac_smiles(species: &str, smiles: &str) {
    if let Ok(mut lock) = REGISTERED_SMILES.lock() {
        lock.get_or_insert_with(HashMap::new).insert(base_species_id(species).to_string(), smiles.to_string());
    }
    if let Ok(mut lock) = GROUP_CACHE.lock() {
        *lock = None;
    }
}

#[derive(Clone, Copy, Debug, Default)]
pub struct UnifacActivity;

impl UnifacActivity {
    /// ln gamma of every neutral species of the phase that UNIFAC covers (mole fractions among those species), or
    /// None when any of them is outside UNIFAC.
    pub fn ln_gamma_map(phase: &LiquidPhase, t_k: f64) -> Option<HashMap<String, f64>> {
        let mut names: Vec<&String> = Vec::new();
        let mut groups: Vec<GroupCounts> = Vec::new();
        let mut mols: Vec<f64> = Vec::new();
        for (sp, &mol) in &phase.species_mol {
            if mol <= 0.0 || sp.ends_with("(s)") || sp.ends_with("(g)") {
                continue;
            }
            if crate::chem_db::get_species_thermo(sp).charge != 0 {
                continue;
            }
            groups.push(unifac_groups(sp)?);
            names.push(sp);
            mols.push(mol);
        }
        let tot: f64 = mols.iter().sum();
        if names.is_empty() || tot <= 0.0 {
            return None;
        }
        let x: Vec<f64> = mols.iter().map(|m| m / tot).collect();
        let grefs: Vec<&GroupCounts> = groups.iter().collect();
        let lg = unifac_ln_gamma(&grefs, &x, t_k)?;
        Some(names.into_iter().zip(lg).map(|(n, v)| (n.clone(), v)).collect())
    }
}

impl ActivityModel for UnifacActivity {
    fn ln_gamma(&self, species: &str, phase: &LiquidPhase, t_k: f64, _p_atm: f64) -> f64 {
        Self::ln_gamma_map(phase, t_k).and_then(|m| m.get(species).copied()).unwrap_or(0.0)
    }

    fn solvent_activity(&self, phase: &LiquidPhase, t_k: f64, p_atm: f64) -> f64 {
        let solvent = phase.solvent_species.as_deref().unwrap_or(crate::db::seed::WATER);
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

/// A neutral molecule that the molecular activity model (UNIFAC) covers: it enters the vapour-liquid and liquid-liquid
/// equilibria through its own activity coefficient, not through the electrolyte sums of the batch evaluation below
/// (which describe the ions and the neutral solutes outside UNIFAC, such as dissolved gases).
fn is_molecular_component(sp: &str) -> bool {
    crate::ions::species_charge(sp) == 0 && unifac_groups(sp).is_some()
}

/// High-performance batch evaluation of aqueous activity coefficients and solvent activity a_w.
pub fn batch_aqueous_gamma_and_aw(
    species_mol: &HashMap<String, f64>,
    t_k: f64,
) -> (HashMap<String, f64>, f64) {
    let n_h2o = species_mol.get(crate::db::seed::WATER).copied().unwrap_or(0.0);
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
        if mol <= 0.0 || sp == crate::db::seed::WATER || is_molecular_component(sp) || sp.ends_with("(s)") || sp.ends_with("(l)") || sp.ends_with("(g)") {
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
        let a_phi = debye_huckel_a_phi(t_k);
        let sqrt_i = i_tot.sqrt();
        let phi = 1.0 - a_phi * (sqrt_i / (1.0 + 1.2 * sqrt_i)) + 0.04 * i_tot;
        (-0.01801528 * sum_m * phi).exp().clamp(0.01, 1.0)
    };

    let a_gamma = debye_huckel_a_gamma(t_k);
    let b_gamma = debye_huckel_b_gamma(t_k);
    let sqrt_i = i_tot.max(1e-12).sqrt();

    let mut gamma_cache = HashMap::with_capacity(solutes.len() + 1);
    gamma_cache.insert(crate::db::seed::WATER.to_string(), 0.0);

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
                PitzerActivity::single_electrolyte_ln_gamma(best_m_salt, i_tot, z_m, z_x, nu_m, nu_x, &p, t_k)
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
        if name == crate::db::seed::WATER {
            n_h2o = amounts[i];
            break;
        }
    }
    if n_h2o <= 0.0 {
        n_h2o = extra_species.get(crate::db::seed::WATER).copied().unwrap_or(0.0);
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
        if mol <= 0.0 || name == crate::db::seed::WATER || is_molecular_component(name) || name.ends_with("(s)") || name.ends_with("(l)") || name.ends_with("(g)") {
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
        if mol <= 0.0 || sp == crate::db::seed::WATER || is_molecular_component(sp) || sp.ends_with("(s)") || sp.ends_with("(l)") || sp.ends_with("(g)") {
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
        let a_phi = debye_huckel_a_phi(t_k);
        let sqrt_i = i_tot.sqrt();
        let phi = 1.0 - a_phi * (sqrt_i / (1.0 + 1.2 * sqrt_i)) + 0.04 * i_tot;
        (-0.01801528 * sum_m * phi).exp().clamp(0.01, 1.0)
    };

    let a_gamma = debye_huckel_a_gamma(t_k);
    let b_gamma = debye_huckel_b_gamma(t_k);
    let sqrt_i = i_tot.max(1e-12).sqrt();

    let mut gamma_cache = HashMap::with_capacity(solutes.len() + 1);
    gamma_cache.insert(crate::db::seed::WATER.to_string(), 0.0);

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
                PitzerActivity::single_electrolyte_ln_gamma(best_m_salt, i_tot, z_m, z_x, nu_m, nu_x, &p, t_k)
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


#[cfg(test)]
mod unifac_tests {
    use super::*;

    fn gr(smiles: &str) -> GroupCounts {
        let p = unifac_params();
        crate::groups::unifac_subgroups_from_smiles(smiles).unwrap().into_iter().map(|(n, c)| (p.subgroup_index(&n).unwrap(), c)).collect()
    }

    #[test]
    fn ethanol_water_activity_coefficients_and_the_azeotrope_fall_out_of_the_group_table() {
        let (w, e) = (gr("O"), gr("CCO"));
        // infinite dilution at the azeotrope temperature (UNIFAC): ethanol in water ~ 7, water in ethanol ~ 2.8
        let lg_e = unifac_ln_gamma(&[&e, &w], &[0.001, 0.999], 351.3).unwrap();
        let lg_w = unifac_ln_gamma(&[&e, &w], &[0.999, 0.001], 351.3).unwrap();
        assert!((lg_e[0].exp() - 6.9).abs() < 1.0, "gamma_inf(EtOH in water) {}", lg_e[0].exp());
        assert!((lg_w[1].exp() - 2.8).abs() < 0.5, "gamma_inf(water in EtOH) {}", lg_w[1].exp());
        // the azeotrope: x = 0.894, y = x, P = 1 atm at 351.3 K: sum x gamma Psat = 101.3 kPa with the pure-component Psat
        // of ethanol 100.8 kPa and water 44.2 kPa at that temperature
        let x = 0.894;
        let lg = unifac_ln_gamma(&[&e, &w], &[x, 1.0 - x], 351.3).unwrap();
        let (pe, pw) = (x * lg[0].exp() * 100.8, (1.0 - x) * lg[1].exp() * 44.2);
        assert!((pe + pw - 101.3).abs() < 3.0, "{} + {} kPa", pe, pw);
        assert!((pe / (pe + pw) - x).abs() < 0.02, "vapour composition at the azeotrope {}", pe / (pe + pw));
    }

    #[test]
    fn alkane_aromatic_mixtures_are_nearly_ideal_and_water_does_not_mix_with_them() {
        let (h, t, w, e) = (gr("CCCCCC"), gr("Cc1ccccc1"), gr("O"), gr("CCO"));
        let lg = unifac_ln_gamma(&[&h, &t], &[0.5, 0.5], 355.0).unwrap();
        assert!(lg[0].exp() > 1.0 && lg[0].exp() < 1.25 && lg[1].exp() > 1.0 && lg[1].exp() < 1.25, "{:?}", lg);
        // binary miscibility by the convexity test of the Gibbs energy of mixing
        let miscible = |a: &GroupCounts, b: &GroupCounts, t: f64| -> bool {
            let g = |x: f64| {
                let lg = unifac_ln_gamma(&[a, b], &[x, 1.0 - x], t).unwrap();
                x * (x.ln() + lg[0]) + (1.0 - x) * ((1.0 - x).ln() + lg[1])
            };
            (1..60).all(|i| {
                let x = 0.005 + 0.99 * i as f64 / 60.0;
                let h = 0.99 / 60.0;
                g(x - h) - 2.0 * g(x) + g(x + h) > -1e-9
            })
        };
        assert!(miscible(&e, &w, 298.15), "ethanol + water mix");
        assert!(miscible(&h, &t, 298.15), "hexane + toluene mix");
        assert!(!miscible(&h, &w, 298.15), "hexane + water do not mix");
        assert!(!miscible(&t, &w, 298.15), "toluene + water do not mix");
    }

    #[test]
    fn a_species_outside_the_group_set_is_outside_unifac() {
        // charged species, species without carbon and a molecule the table has no group for: no UNIFAC (the caller falls
        // back to an ideal solution, labelled); ethers, esters, acids now have groups (the full original table)
        assert!(unifac_groups("C2H5OH").is_some());
        assert!(unifac_groups(crate::db::seed::WATER).is_some());
        assert!(unifac_groups("Na+").is_none());
        assert!(unifac_groups("NoSuchSpecies").is_none());
        register_unifac_smiles("test_dme", "COC");
        assert!(unifac_groups("test_dme").is_some());
        register_unifac_smiles("test_methane", "C");
        assert!(unifac_groups("test_methane").is_none());
        register_unifac_smiles("test_diiodine", "II");
        assert!(unifac_groups("test_diiodine").is_none());
        register_unifac_smiles("test_butanone", "CCC(C)=O");
        assert!(unifac_groups("test_butanone").is_some());
    }
}
