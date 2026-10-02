//! Calculation of standard thermodynamic functions H(T), S(T), Cp(T), and mu0(T, P).

use std::collections::HashMap;
use std::sync::RwLock;
use crate::physics::R_GAS;
use crate::types::ProvenanceTier;
use crate::db::SpeciesStore;

/// Standard thermodynamic state for a species in a given phase at (T, P).
#[derive(Clone, Debug, PartialEq)]
pub struct ThermoState {
    /// Enthalpy H(T) in J/mol
    pub h_j_mol: f64,
    /// Entropy S(T) in J/(mol * K)
    pub s_j_mol_k: f64,
    /// Heat capacity Cp(T) in J/(mol * K)
    pub cp_j_mol_k: f64,
    /// Chemical potential mu0(T, P) = H(T) - T * S(T) in J/mol
    pub mu0_j_mol: f64,
    /// Provenance tier of this calculation
    pub tier: ProvenanceTier,
}

// Global thread-safe cache for thermo state keyed by (species_id, phase, T_centikelvin, P_kpa)
static THERMO_CACHE: RwLock<Option<HashMap<(String, String, i64, i64), ThermoState>>> = RwLock::new(None);

fn get_cached(key: &(String, String, i64, i64)) -> Option<ThermoState> {
    if let Ok(lock) = THERMO_CACHE.read() {
        if let Some(map) = lock.as_ref() {
            return map.get(key).cloned();
        }
    }
    None
}

fn put_cached(key: (String, String, i64, i64), state: ThermoState) {
    if let Ok(mut lock) = THERMO_CACHE.write() {
        if lock.is_none() {
            *lock = Some(HashMap::new());
        }
        if let Some(map) = lock.as_mut() {
            // Keep cache bounded
            if map.len() > 10000 {
                map.clear();
            }
            map.insert(key, state);
        }
    }
}

/// Fallback standard properties at 298.15 K: (dfH [kJ/mol], dfG [kJ/mol], Cp [J/(mol*K)])
fn default_species_thermo_298(species: &str) -> (f64, f64, f64) {
    match species {
        "H+" => (0.0, 0.0, 0.0),
        "OH-" => (-230.0, -157.24, -148.5),
        "H2O" | "H2O(l)" => (-285.83, -237.13, 75.38),
        "Cl-" => (-167.2, -131.23, -136.4),
        "Ag+" => (105.6, 77.11, 77.0),
        "Ag(NH3)2+" => (-111.0, -17.2, 180.0),
        "Na+" => (-240.1, -261.91, 46.4),
        "K+" => (-252.4, -283.27, 21.8),
        "Ca+2" => (-542.8, -553.58, -22.0),
        "Ba+2" => (-537.6, -560.77, -30.0),
        "SO4-2" => (-909.3, -744.53, -293.0),
        "CO3-2" => (-677.1, -527.81, -50.0),
        "HCO3-" => (-692.0, -586.77, 112.0),
        "CrO4-2" => (-881.2, -727.75, 110.0),
        "CH3COOH" => (-484.5, -396.46, 124.0),
        "CH3COO-" => (-486.0, -369.31, 80.0),
        "NH3" => (-80.3, -26.50, 80.0),
        "NH4+" => (-132.5, -79.31, 79.9),
        "CO2(aq)" => (-413.8, -385.98, 243.0),
        "CO2(g)" => (-393.5, -394.39, 37.1),
        "NaHCO3(s)" => (-950.8, -851.0, 87.6),
        "Na2CO3(s)" => (-1130.7, -1044.4, 112.3),
        "AgCl(s)" => (-127.07, -109.79, 50.8),
        "CaCO3(s)" => (-1207.6, -1128.8, 81.9),
        "CaSO4(s)" => (-1434.5, -1321.8, 99.6),
        "BaSO4(s)" => (-1473.2, -1362.2, 101.8),
        "Ag2CrO4(s)" => (-731.8, -642.3, 142.3),
        "C2H5OH" | "C2H5OH(l)" => (-277.69, -174.78, 112.3),
        _ => (-100.0, -80.0, 50.0),
    }
}

/// Evaluates standard state thermo for species `species` in phase `phase` at temperature `t_k` and pressure `p_pa`.
pub fn get_thermo_state(species: &str, phase: &str, t_k: f64, p_pa: f64) -> ThermoState {
    let t = t_k.clamp(100.0, 3000.0);
    let p = p_pa.clamp(1.0, 1e9);
    let cache_key = (
        species.to_string(),
        phase.to_string(),
        (t * 100.0).round() as i64,
        (p / 1000.0).round() as i64,
    );

    if let Some(st) = get_cached(&cache_key) {
        return st;
    }

    let mut tier = ProvenanceTier::Tabulated;
    let (mut dfh_kj, mut dfg_kj, mut cp) = default_species_thermo_298(species);

    // 1. Query SpeciesStore
    if let Ok(store) = SpeciesStore::global().read() {
        if let Some(rec) = store.get(species) {
            let ph = rec.phases.get(phase)
                .or_else(|| rec.phases.get("aq"))
                .or_else(|| rec.phases.get("l"))
                .or_else(|| rec.phases.get("s"))
                .or_else(|| rec.phases.get("g"));
            if let Some(p_data) = ph {
                if let Some(t_data) = &p_data.thermo {
                    if let Some(d) = &t_data.dfH {
                        dfh_kj = d.value;
                        tier = d.tier.clone();
                    }
                    if let Some(d) = &t_data.dfG {
                        dfg_kj = d.value;
                    }
                    if let Some(d) = &t_data.cp {
                        cp = d.value;
                    }
                }
            }
        }
    }

    // Standard thermodynamic formation entropy: dfS = (dfH - dfG) / 298.15
    let df_s_j_mol_k = (dfh_kj - dfg_kj) * 1000.0 / 298.15;
    let t_ref = 298.15;
    let h_j_mol = dfh_kj * 1000.0 + cp * (t - t_ref);
    let s_j_mol_k = df_s_j_mol_k + cp * (t / t_ref).ln();
    let mu0_j_mol = h_j_mol - t * s_j_mol_k;

    let res = ThermoState {
        h_j_mol,
        s_j_mol_k,
        cp_j_mol_k: cp,
        mu0_j_mol,
        tier,
    };

    put_cached(cache_key, res.clone());
    res
}

/// Standard reaction Gibbs free energy Delta_r G0(T, P) in J/mol
pub fn delta_r_g0(
    reactants: &HashMap<String, f64>,
    products: &HashMap<String, f64>,
    t_k: f64,
    p_pa: f64,
) -> f64 {
    let mut dg = 0.0;
    for (p, &c) in products {
        let phase = if p.ends_with("(s)") { "s" } else if p.ends_with("(g)") { "g" } else { "aq" };
        let st = get_thermo_state(p, phase, t_k, p_pa);
        dg += c * st.mu0_j_mol;
    }
    for (r, &c) in reactants {
        let phase = if r.ends_with("(s)") { "s" } else if r.ends_with("(g)") { "g" } else { "aq" };
        let st = get_thermo_state(r, phase, t_k, p_pa);
        dg -= c * st.mu0_j_mol;
    }
    dg
}

/// Natural log of the equilibrium constant ln K(T, P) = -Delta_r G0 / (R * T)
pub fn ln_k_equilibrium(
    reactants: &HashMap<String, f64>,
    products: &HashMap<String, f64>,
    t_k: f64,
    p_pa: f64,
) -> f64 {
    let dg = delta_r_g0(reactants, products, t_k, p_pa);
    -dg / (R_GAS * t_k.max(1.0))
}

/// log10 of the equilibrium constant log10 K(T, P)
pub fn log10_k_equilibrium(
    reactants: &HashMap<String, f64>,
    products: &HashMap<String, f64>,
    t_k: f64,
    p_pa: f64,
) -> f64 {
    ln_k_equilibrium(reactants, products, t_k, p_pa) / std::f64::consts::LN_10
}
