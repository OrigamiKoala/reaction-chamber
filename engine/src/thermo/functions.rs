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

/// General physical estimation for unknown species when absent from SpeciesStore.
fn estimate_species_thermo_298(species: &str, phase: &str) -> (f64, f64, f64, ProvenanceTier) {
    let charge = crate::ions::species_charge(species);
    let tier = ProvenanceTier::Speculative;
    match phase {
        "s" => (-100.0, -80.0, 50.0, tier),
        "g" => (-50.0, -50.0, 30.0, tier),
        "aq" => {
            if charge != 0 {
                let z = charge.abs() as f64;
                (-150.0 * z, -120.0 * z, -40.0 * z, tier)
            } else {
                (-100.0, -80.0, 80.0, tier)
            }
        }
        _ => (-100.0, -80.0, 50.0, tier),
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

    let mut found = false;
    let mut tier = ProvenanceTier::Tabulated;
    let (mut dfh_kj, mut dfg_kj, mut cp) = (0.0, 0.0, 0.0);

    // 1. Query SpeciesStore
    if let Ok(store) = SpeciesStore::global().read() {
        let base_id = species.trim_end_matches("(s)").trim_end_matches("(g)").trim_end_matches("(l)").trim_end_matches("(aq)");
        let rec = store.get(species)
            .or_else(|| store.get(base_id))
            .or_else(|| store.get(&format!("{}(s)", base_id)))
            .or_else(|| store.get(&format!("{}(g)", base_id)))
            .or_else(|| store.get(&format!("{}(l)", base_id)));
        if let Some(r) = rec {
            let ph = r.phases.get(phase)
                .or_else(|| r.phases.get("aq"))
                .or_else(|| r.phases.get("l"))
                .or_else(|| r.phases.get("s"))
                .or_else(|| r.phases.get("g"));
            if let Some(p_data) = ph {
                if let Some(t_data) = &p_data.thermo {
                    if let Some(d) = &t_data.dfH {
                        dfh_kj = d.value;
                        tier = d.tier.clone();
                        found = true;
                    }
                    if let Some(d) = &t_data.dfG {
                        dfg_kj = d.value;
                    } else {
                        // Approximate dfG ~ dfH if missing
                        dfg_kj = dfh_kj;
                    }
                    if let Some(d) = &t_data.cp {
                        cp = d.value;
                    } else {
                        cp = 50.0;
                    }
                }
            }
        }
    }

    // 2. Fallback to general physical estimation if not in store
    if !found {
        let (est_h, est_g, est_cp, est_tier) = estimate_species_thermo_298(species, phase);
        dfh_kj = est_h;
        dfg_kj = est_g;
        cp = est_cp;
        tier = est_tier;
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
