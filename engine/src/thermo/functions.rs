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

type ThermoKey = (String, String, i64, i64);

// Global thread-safe cache for thermo state keyed by (species_id, phase, T_centikelvin, P_kpa). `None` is a cached "no
// data" answer. The cache belongs to one generation of the species store: registering or replacing any record (an
// import, a database shard, a resolved property request) empties it, so a value looked up before its record arrived is
// never served afterwards.
static THERMO_CACHE: RwLock<Option<(u64, HashMap<ThermoKey, Option<ThermoState>>)>> = RwLock::new(None);

fn get_cached(key: &ThermoKey) -> Option<Option<ThermoState>> {
    let gen = SpeciesStore::generation();
    if let Ok(lock) = THERMO_CACHE.read() {
        if let Some((g, map)) = lock.as_ref() {
            if *g == gen {
                return map.get(key).cloned();
            }
        }
    }
    None
}

fn put_cached(key: ThermoKey, state: Option<ThermoState>) {
    let gen = SpeciesStore::generation();
    if let Ok(mut lock) = THERMO_CACHE.write() {
        let stale = lock.as_ref().map_or(true, |(g, map)| *g != gen || map.len() > 10000);
        if stale {
            *lock = Some((gen, HashMap::new()));
        }
        if let Some((_, map)) = lock.as_mut() {
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
/// A species without formation data gets a placeholder (tier Speculative); callers that decide *whether a reaction
/// happens* must use `try_thermo_state` instead and leave such species out, because the placeholder would invent a driving
/// force.
pub fn get_thermo_state(species: &str, phase: &str, t_k: f64, p_pa: f64) -> ThermoState {
    if let Some(st) = try_thermo_state(species, phase, t_k, p_pa) {
        return st;
    }
    let t = t_k.clamp(100.0, 3000.0);
    let (dfh_kj, dfg_kj, cp, tier) = estimate_species_thermo_298(species, phase);
    state_from_formation(dfh_kj, dfg_kj, cp, t, tier)
}

/// Standard state thermo from the species store, or None when the store has no enthalpy of formation for the species.
pub fn try_thermo_state(species: &str, phase: &str, t_k: f64, p_pa: f64) -> Option<ThermoState> {
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

    let mut out = None;
    if let Ok(store) = SpeciesStore::global().read() {
        let base_id = species.trim_end_matches("(s)").trim_end_matches("(g)").trim_end_matches("(l)").trim_end_matches("(aq)");
        let rec = store.get(species)
            .or_else(|| store.get(base_id))
            .or_else(|| store.get(&format!("{}(s)", base_id)))
            .or_else(|| store.get(&format!("{}(g)", base_id)))
            .or_else(|| store.get(&format!("{}(l)", base_id)));
        if let Some(r) = rec {
            // the requested phase's own data; the only substitution allowed is the pure liquid for a neutral solute
            // (aq -> l, an estimate: it ignores the solute's standard-state transfer energy). A solid or a gas never
            // borrows another phase's formation data.
            let own = r.phases.get(phase).and_then(|p_data| p_data.thermo.as_ref()).filter(|t| t.dfH.is_some());
            let (t_data, substituted) = match own {
                Some(t) => (Some(t), false),
                None if phase == "aq" && r.identity.charge == 0 => {
                    (r.phases.get("l").and_then(|p_data| p_data.thermo.as_ref()).filter(|t| t.dfH.is_some()), true)
                }
                None => (None, false),
            };
            if let Some(t_data) = t_data {
                if let Some(h) = &t_data.dfH {
                    let mut tier = h.tier.clone();
                    if substituted && matches!(tier, ProvenanceTier::Tabulated | ProvenanceTier::Imported) {
                        tier = ProvenanceTier::Estimated;
                    }
                    let dfg_kj = match &t_data.dfG {
                        Some(g) => g.value,
                        None => {
                            // no Gibbs energy: dfS = 0 is a guess, so the result is at best an estimate
                            if matches!(tier, ProvenanceTier::Tabulated | ProvenanceTier::Imported) {
                                tier = ProvenanceTier::Estimated;
                            }
                            h.value
                        }
                    };
                    let cp = t_data.cp.as_ref().map_or(50.0, |c| c.value);
                    out = Some(state_from_formation(h.value, dfg_kj, cp, t, tier));
                }
            }
        }
    }

    put_cached(cache_key, out.clone());
    out
}

/// True when the store has formation data for the species (the phase falls back like `try_thermo_state`).
pub fn has_thermo_data(species: &str, phase: &str) -> bool {
    try_thermo_state(species, phase, 298.15, 101_325.0).is_some()
}

/// Phase key used for a species id in reaction thermodynamics: "(s)" solid, "(g)" gas, otherwise the solution.
pub fn phase_of_id(species: &str) -> &'static str {
    if species.ends_with("(s)") {
        "s"
    } else if species.ends_with("(g)") {
        "g"
    } else {
        "aq"
    }
}

fn state_from_formation(dfh_kj: f64, dfg_kj: f64, cp: f64, t: f64, tier: ProvenanceTier) -> ThermoState {
    // Formation entropy dfS = (dfH - dfG) / 298.15 stands in for the absolute entropy: the element entropies cancel in
    // every balanced reaction, so reaction quantities are exact; Cp is taken constant from 298.15 K.
    let df_s_j_mol_k = (dfh_kj - dfg_kj) * 1000.0 / 298.15;
    let t_ref = 298.15;
    let h_j_mol = dfh_kj * 1000.0 + cp * (t - t_ref);
    let s_j_mol_k = df_s_j_mol_k + cp * (t / t_ref).ln();
    let mu0_j_mol = h_j_mol - t * s_j_mol_k;
    ThermoState { h_j_mol, s_j_mol_k, cp_j_mol_k: cp, mu0_j_mol, tier }
}

/// ln K(T, P) of a reaction when every species has formation data, else None.
pub fn try_ln_k_equilibrium(
    reactants: &HashMap<String, f64>,
    products: &HashMap<String, f64>,
    t_k: f64,
    p_pa: f64,
) -> Option<f64> {
    let mut dg = 0.0;
    for (p, &c) in products {
        dg += c * try_thermo_state(p, phase_of_id(p), t_k, p_pa)?.mu0_j_mol;
    }
    for (r, &c) in reactants {
        dg -= c * try_thermo_state(r, phase_of_id(r), t_k, p_pa)?.mu0_j_mol;
    }
    Some(-dg / (R_GAS * t_k.max(1.0)))
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
