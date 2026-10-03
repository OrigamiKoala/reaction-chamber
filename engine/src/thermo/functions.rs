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

use std::sync::atomic::{AtomicBool, Ordering};

/// Flag indicating the engine is currently deciding whether a reaction happens (discovery, detailed balance, extents).
pub static IN_REACTION_DECISION: AtomicBool = AtomicBool::new(false);

/// Scoped guard setting IN_REACTION_DECISION during reaction decision blocks.
pub struct ReactionDecisionGuard;
impl ReactionDecisionGuard {
    pub fn new() -> Self {
        IN_REACTION_DECISION.store(true, Ordering::Relaxed);
        ReactionDecisionGuard
    }
}
impl Drop for ReactionDecisionGuard {
    fn drop(&mut self) {
        IN_REACTION_DECISION.store(false, Ordering::Relaxed);
    }
}

/// Evaluates Shomate polynomial parameters [A, B, C, D, E, F, G, H] at temperature T_K:
/// t = T / 1000
/// Cp = A + B*t + C*t^2 + D*t^3 + E/t^2 (J/(mol K))
/// H(T) = 1000.0 * (A*t + B*t^2/2 + C*t^3/3 + D*t^4/4 - E/t + F) (J/mol)
/// S(T) = A*ln(t) + B*t + C*t^2/2 + D*t^3/3 - E/(2*t^2) + G (J/(mol K))
pub fn eval_shomate(coeffs: &[f64; 8], t_k: f64) -> (f64, f64, f64) {
    let t = (t_k / 1000.0).max(0.01);
    let a = coeffs[0];
    let b = coeffs[1];
    let c = coeffs[2];
    let d = coeffs[3];
    let e = coeffs[4];
    let f = coeffs[5];
    let g = coeffs[6];
    let cp = a + b * t + c * t * t + d * t * t * t + e / (t * t);
    let h_j = 1000.0 * (a * t + b * t * t / 2.0 + c * t * t * t / 3.0 + d * t * t * t * t / 4.0 - e / t + f);
    let s_j = a * t.ln() + b * t + c * t * t / 2.0 + d * t * t * t / 3.0 - e / (2.0 * t * t) + g;
    (h_j, s_j, cp)
}

/// Evaluates NASA-7 polynomial parameters [a1, a2, a3, a4, a5, a6, a7] at temperature T_K.
pub fn eval_nasa7(coeffs: &[f64; 7], t_k: f64) -> (f64, f64, f64) {
    let t = t_k.max(10.0);
    let cp = R_GAS * (coeffs[0] + coeffs[1] * t + coeffs[2] * t * t + coeffs[3] * t * t * t + coeffs[4] * t * t * t * t);
    let h_j = R_GAS * t * (coeffs[0] + coeffs[1] * t / 2.0 + coeffs[2] * t * t / 3.0 + coeffs[3] * t * t * t / 4.0 + coeffs[4] * t * t * t * t / 5.0 + coeffs[5] / t);
    let s_j = R_GAS * (coeffs[0] * t.ln() + coeffs[1] * t + coeffs[2] * t * t / 2.0 + coeffs[3] * t * t * t / 3.0 + coeffs[4] * t * t * t * t / 4.0 + coeffs[6]);
    (h_j, s_j, cp)
}

/// Powell-Latimer estimation for standard aqueous ion absolute entropy S0(aq) (J/(mol K)).
pub fn powell_latimer_ion_entropy(charge: i32, mass: f64, radius_angstrom: f64) -> f64 {
    let z = (charge.abs() as f64).max(1.0);
    let r_eff = (radius_angstrom + 1.4).max(1.5);
    1.5 * R_GAS * mass.max(1.0).ln() + 37.0 - 270.0 * z / (r_eff * r_eff)
}

/// Latimer element contributions for solid compound absolute entropy S0(s) (J/(mol K)).
pub fn latimer_solid_entropy(formula: &str) -> f64 {
    let elems = crate::ions::species_elements(formula).unwrap_or_default();
    let mut s_tot = 0.0;
    for (elem, count) in elems {
        let s_elem = match elem.as_str() {
            "H" => 8.0,
            "Li" => 15.0,
            "Be" => 10.0,
            "B" => 8.0,
            "C" => 10.0,
            "N" => 15.0,
            "O" => 16.0,
            "F" => 20.0,
            "Na" => 31.4,
            "Mg" => 25.0,
            "Al" => 28.0,
            "Si" => 25.0,
            "P" => 27.0,
            "S" => 30.0,
            "Cl" => 40.0,
            "K" => 38.0,
            "Ca" => 35.0,
            "Ti" => 35.0,
            "Cr" => 36.0,
            "Mn" => 38.0,
            "Fe" => 38.0,
            "Co" => 38.0,
            "Ni" => 38.0,
            "Cu" => 40.0,
            "Zn" => 42.0,
            "Br" => 50.0,
            "Ag" => 55.0,
            "I" => 55.0,
            "Ba" => 50.0,
            "Pb" => 60.0,
            _ => 30.0,
        };
        s_tot += count * s_elem;
    }
    s_tot
}

/// Standard reference entropy sum of constituent elements in their standard states at 298.15 K.
pub fn elements_entropy_sum(formula: &str) -> f64 {
    let elems = crate::ions::species_elements(formula).unwrap_or_default();
    let mut s_tot = 0.0;
    for (elem, count) in elems {
        let s_ref = match elem.as_str() {
            "H" => 130.68 / 2.0,
            "O" => 205.15 / 2.0,
            "N" => 191.61 / 2.0,
            "F" => 202.79 / 2.0,
            "Cl" => 223.08 / 2.0,
            "Br" => 152.21 / 2.0,
            "I" => 116.14 / 2.0,
            "C" => 5.74,
            "S" => 32.05,
            "P" => 41.09 / 4.0,
            "Na" => 51.3,
            "K" => 64.7,
            "Mg" => 32.7,
            "Ca" => 41.6,
            "Ba" => 62.8,
            "Fe" => 27.3,
            "Cu" => 33.15,
            "Zn" => 41.6,
            "Ag" => 42.6,
            "Pb" => 64.8,
            "Al" => 28.3,
            "Mn" => 32.0,
            "Co" => 30.0,
            _ => 35.0,
        };
        s_tot += count * s_ref;
    }
    s_tot
}

fn try_eval_polynomial(t_data: &crate::db::PhaseThermo, t_k: f64) -> Option<(f64, f64, f64)> {
    if let Some(r_val) = &t_data.ranges {
        if let Some(arr) = r_val.as_array() {
            if arr.len() == 8 {
                let mut coeffs = [0.0; 8];
                for (i, v) in arr.iter().enumerate() {
                    coeffs[i] = v.as_f64()?;
                }
                return Some(eval_shomate(&coeffs, t_k));
            } else if arr.len() == 7 {
                let mut coeffs = [0.0; 7];
                for (i, v) in arr.iter().enumerate() {
                    coeffs[i] = v.as_f64()?;
                }
                return Some(eval_nasa7(&coeffs, t_k));
            } else {
                for item in arr {
                    if let Some(obj) = item.as_object() {
                        let t_min = obj.get("t_min").and_then(|v| v.as_f64()).unwrap_or(0.0);
                        let t_max = obj.get("t_max").and_then(|v| v.as_f64()).unwrap_or(5000.0);
                        if t_k >= t_min && t_k <= t_max {
                            if let Some(c_arr) = obj.get("coeffs").and_then(|v| v.as_array()) {
                                if c_arr.len() == 8 {
                                    let mut coeffs = [0.0; 8];
                                    for (i, v) in c_arr.iter().enumerate() {
                                        coeffs[i] = v.as_f64()?;
                                    }
                                    return Some(eval_shomate(&coeffs, t_k));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
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
    #[cfg(debug_assertions)]
    assert!(
        !IN_REACTION_DECISION.load(Ordering::Relaxed),
        "get_thermo_state placeholder called during reaction decision for {} in phase {}",
        species, phase
    );
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
    let (r, ha_lookup, b_lookup) = {
        let global_arc = SpeciesStore::global();
        let store = match global_arc.read() {
            Ok(s) => s,
            Err(_) => return None,
        };
        let base_id = species.trim_end_matches("(s)").trim_end_matches("(g)").trim_end_matches("(l)").trim_end_matches("(aq)");
        let r = store.get(species)
            .or_else(|| store.get(base_id))
            .or_else(|| store.get(&format!("{}(s)", base_id)))
            .or_else(|| store.get(&format!("{}(g)", base_id)))
            .or_else(|| store.get(&format!("{}(l)", base_id)))
            .or_else(|| store.by_smiles(species))
            .cloned();

        let (ha_res, b_res) = if let Some(ref r) = r {
            let ha = if phase == "aq" && r.identity.charge < 0 {
                if let Some(smiles) = &r.identity.smiles {
                    if smiles.contains("[O-]") {
                        let ha_smiles = smiles.replace("[O-]", "O");
                        let pka = crate::acid_estimate::estimate_pka(&ha_smiles).unwrap_or(4.75);
                        let ha_id = store.get(&ha_smiles).or_else(|| store.by_smiles(&ha_smiles)).map(|rec| rec.id.clone());
                        Some((ha_id, pka))
                    } else { None }
                } else { None }
            } else { None };

            let b = if phase == "aq" && r.identity.charge > 0 {
                if let Some(smiles) = &r.identity.smiles {
                    let b_smiles = if smiles.contains("[NH3+]") {
                        Some(smiles.replace("[NH3+]", "N"))
                    } else if smiles.contains("[NH2+]") {
                        Some(smiles.replace("[NH2+]", "N"))
                    } else if smiles.contains("[NH+]") {
                        Some(smiles.replace("[NH+]", "N"))
                    } else {
                        None
                    };
                    b_smiles.and_then(|b_sm| {
                        let pka = 9.25;
                        let b_id = store.get(&b_sm).or_else(|| store.by_smiles(&b_sm)).map(|rec| rec.id.clone());
                        Some((b_id, pka))
                    })
                } else { None }
            } else { None };
            (ha, b)
        } else {
            (None, None)
        };

        (r, ha_res, b_res)
    };

    if let Some(r) = r {
        // the requested phase's own data; the only substitution allowed is the pure liquid for a neutral solute
        // (aq -> l, an estimate: it ignores the solute's standard-state transfer energy). A solid or a gas never
        // borrows another phase's formation data.
        let own = r.phases.get(phase).and_then(|p_data| p_data.thermo.as_ref()).filter(|t| t.dfH.is_some() || t.ranges.is_some());
        let (t_data, substituted) = match own {
            Some(t) => (Some(t), false),
            None if phase == "aq" && r.identity.charge == 0 => {
                (r.phases.get("l").and_then(|p_data| p_data.thermo.as_ref()).filter(|t| t.dfH.is_some() || t.ranges.is_some()), true)
            }
            None => (None, false),
        };
        if let Some(t_data) = t_data {
            let mut tier = t_data.tier.clone();
            if substituted && matches!(tier, ProvenanceTier::Tabulated | ProvenanceTier::Imported) {
                tier = ProvenanceTier::Estimated;
            }

            // 1. Check for Cp polynomial integration (NASA-7 / Shomate ranges)
            if let Some((h_j, s_j, cp_j)) = try_eval_polynomial(t_data, t) {
                let df_s = s_j - elements_entropy_sum(&r.identity.formula);
                let mu0_j = h_j - t * df_s;
                out = Some(ThermoState {
                    h_j_mol: h_j,
                    s_j_mol_k: df_s,
                    cp_j_mol_k: cp_j,
                    mu0_j_mol: mu0_j,
                    tier,
                });
            } else if let Some(h) = &t_data.dfH {
                let dfg_kj = if let Some(g) = &t_data.dfG {
                    g.value
                } else if let Some(s) = &t_data.S {
                    let df_s = s.value - elements_entropy_sum(&r.identity.formula);
                    h.value - 298.15 * df_s / 1000.0
                } else {
                    // T3: S0/dfG estimate when only dfH is known
                    if matches!(tier, ProvenanceTier::Tabulated | ProvenanceTier::Imported) {
                        tier = ProvenanceTier::Estimated;
                    }
                    if phase == "aq" && r.identity.charge != 0 {
                        let mw = r.mw();
                        let s_ion = powell_latimer_ion_entropy(r.identity.charge, mw, 1.8);
                        let df_s = s_ion - elements_entropy_sum(&r.identity.formula);
                        h.value - 298.15 * df_s / 1000.0
                    } else if phase == "s" {
                        let s_sol = latimer_solid_entropy(&r.identity.formula);
                        let df_s = s_sol - elements_entropy_sum(&r.identity.formula);
                        h.value - 298.15 * df_s / 1000.0
                    } else {
                        h.value
                    }
                };
                let cp = t_data.cp.as_ref().map_or(50.0, |c| c.value);
                out = Some(state_from_formation(h.value, dfg_kj, cp, t, tier));
            }
        } else if phase == "aq" && r.identity.charge != 0 {
            // T5: Cycle closure for carboxylates / created anions and protonated amines
            if let Some((Some(ha_id), pka)) = ha_lookup {
                if let Some(ha_st) = try_thermo_state(&ha_id, "aq", t, p).or_else(|| try_thermo_state(&ha_id, "l", t, p)) {
                    let delta_g_diss = R_GAS * 298.15 * std::f64::consts::LN_10 * pka;
                    let mu0 = ha_st.mu0_j_mol + delta_g_diss;
                    out = Some(ThermoState {
                        h_j_mol: ha_st.h_j_mol,
                        s_j_mol_k: ha_st.s_j_mol_k - delta_g_diss / 298.15,
                        cp_j_mol_k: (ha_st.cp_j_mol_k - 40.0).max(20.0),
                        mu0_j_mol: mu0,
                        tier: ProvenanceTier::Estimated,
                    });
                }
            } else if let Some((Some(b_id), pka)) = b_lookup {
                if let Some(b_st) = try_thermo_state(&b_id, "aq", t, p).or_else(|| try_thermo_state(&b_id, "l", t, p)) {
                    let delta_g_diss = R_GAS * 298.15 * std::f64::consts::LN_10 * pka;
                    let mu0 = b_st.mu0_j_mol - delta_g_diss;
                    out = Some(ThermoState {
                        h_j_mol: b_st.h_j_mol,
                        s_j_mol_k: b_st.s_j_mol_k + delta_g_diss / 298.15,
                        cp_j_mol_k: (b_st.cp_j_mol_k + 40.0),
                        mu0_j_mol: mu0,
                        tier: ProvenanceTier::Estimated,
                    });
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
