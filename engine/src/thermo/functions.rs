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

pub use super::estimate::{elements_entropy_sum, ion_formation_entropy, kopp_cp, solid_entropy_latimer, CpModel};

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

/// Standard state thermo of a species the store has formation data for. Panics for one it has none for: there is no
/// placeholder (an invented value would decide reactions, heats and equilibria silently); code that cannot know whether a
/// species has data calls `try_thermo_state` and leaves the species out.
pub fn get_thermo_state(species: &str, phase: &str, t_k: f64, p_pa: f64) -> ThermoState {
    try_thermo_state(species, phase, t_k, p_pa).unwrap_or_else(|| panic!("no formation data for {} in phase {}", species, phase))
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
    let (r, partner) = {
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
        // T5: the conjugate acid / base the cycle closure would use, found by formula (one H and one charge apart)
        let partner = match &r {
            // only for a species with a structure: a bare identity record has no pKa to close a cycle with
            Some(rec) if phase == "aq" && rec.identity.charge != 0 && rec.identity.smiles.is_some() => conjugate_partner(&store, rec),
            _ => None,
        };
        (r, partner)
    };

    if let Some(r) = r {
        // the requested phase's own data; the only substitution allowed is the pure liquid for a neutral solute
        // (aq -> l, an estimate: it ignores the solute's standard-state transfer energy). A solid or a gas never
        // borrows another phase's formation data.
        let own = r.phases.get(phase).and_then(|p_data| p_data.thermo.as_ref()).filter(|t| t.dfH.is_some() || t.ranges.is_some());
        // T4: a neutral solute with a structure and gas / liquid formation data gets an aqueous standard state from its
        // hydration free energy; only without a structure (or with an atom the groups do not cover) does the pure liquid
        // stand in for it
        let synth = if own.is_none() && phase == "aq" && r.identity.charge == 0 { aqueous_from_hydration(&r) } else { None };
        let (t_data, substituted) = match own {
            Some(t) => (Some(t), false),
            None if synth.is_some() => (synth.as_ref(), false),
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
            let downgrade = |tier: &mut ProvenanceTier| {
                if matches!(tier, ProvenanceTier::Tabulated | ProvenanceTier::Imported) {
                    *tier = ProvenanceTier::Estimated;
                }
            };

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
                    downgrade(&mut tier);
                    if phase == "aq" && r.identity.charge != 0 {
                        let radius = crate::crystal::ionic_radius_angstrom(&r.identity.formula).unwrap_or(1.8);
                        let df_s = ion_formation_entropy(&r.identity.formula, r.identity.charge, r.mw(), radius);
                        h.value - 298.15 * df_s / 1000.0
                    } else if phase == "s" {
                        let s_sol = solid_entropy_latimer(&r.identity.formula);
                        let df_s = s_sol - elements_entropy_sum(&r.identity.formula);
                        h.value - 298.15 * df_s / 1000.0
                    } else {
                        h.value
                    }
                };
                // T2: heat capacity as a function of T. Measured Cp(298) is carried to T by a physical model (Einstein
                // solid, Joback gas polynomial); without a datum Kopp's rule (solids, liquids) or zero (a solute: its
                // reaction heat capacity is then taken as nil, the van 't Hoff limit) is used and the tier says so.
                let (model, cp_estimated) = cp_model(&r, phase, t_data.cp.as_ref().map(|c| c.value));
                if cp_estimated || (t - 298.15).abs() > 150.0 && !matches!(model, CpModel::Constant(_)) {
                    downgrade(&mut tier);
                }
                out = Some(state_from_formation(h.value, dfg_kj, &model, t, tier));
            }
        } else if phase == "aq" && r.identity.charge != 0 {
            // T5: cycle closure for created anions / protonated amines through the conjugate partner and its pKa
            if let Some(pt) = partner {
                if let Some(st) = try_thermo_state(&pt.id, "aq", t, p).or_else(|| try_thermo_state(&pt.id, "l", t, p)) {
                    let dg = R_GAS * 298.15 * std::f64::consts::LN_10 * pt.pka;
                    if pt.partner_is_acid {
                        // A- = HA - H+ : mu0(A-) = mu0(HA) + RT ln10 pKa (dHdiss ~ 0)
                        out = Some(ThermoState {
                            h_j_mol: st.h_j_mol,
                            s_j_mol_k: st.s_j_mol_k - dg / 298.15,
                            cp_j_mol_k: st.cp_j_mol_k,
                            mu0_j_mol: st.mu0_j_mol + dg,
                            tier: ProvenanceTier::Estimated,
                        });
                    } else {
                        // BH+ = B + H+ : mu0(BH+) = mu0(B) - RT ln10 pKa
                        out = Some(ThermoState {
                            h_j_mol: st.h_j_mol,
                            s_j_mol_k: st.s_j_mol_k + dg / 298.15,
                            cp_j_mol_k: st.cp_j_mol_k,
                            mu0_j_mol: st.mu0_j_mol - dg,
                            tier: ProvenanceTier::Estimated,
                        });
                    }
                }
            }
        }
    }

    put_cached(cache_key, out.clone());
    out
}

/// T4: the aqueous standard state of a neutral solute built from its ideal-gas formation Gibbs energy (or the liquid's, with
/// the saturation pressure) and the group-additive hydration free energy of its structure. The formation enthalpy is the
/// liquid's (zero enthalpy of mixing at infinite dilution), the heat capacity the liquid's or the gas's.
fn aqueous_from_hydration(r: &crate::db::SpeciesRecord) -> Option<crate::db::record::PhaseThermo> {
    use crate::db::record::{Datum, PhaseThermo};
    let mol = crate::smiles::parse(r.identity.smiles.as_deref()?)?;
    // a measured hydration free energy (FreeSolv, by InChIKey) beats the group-additive estimate
    let measured = r.identity.inchikey.as_deref().and_then(crate::hydration::measured_kj);
    let hyd = match measured {
        Some(v) => v,
        None => crate::hydration::hydration_gibbs_kj(&mol)?,
    };
    let thermo_of = |ph: &str| r.phases.get(ph).and_then(|p| p.thermo.as_ref());
    let (gas, liq) = (thermo_of("g"), thermo_of("l"));
    let dfg_gas = match (gas.and_then(|g| g.dfG.as_ref()), liq.and_then(|l| l.dfG.as_ref())) {
        (Some(g), _) => g.value,
        (None, Some(l)) => {
            let (model, _, _) = crate::vle::psat_model_from_records(r, None)?;
            let p_sat = model.psat_pa(298.15);
            l.value - R_GAS * 298.15 * (p_sat / crate::vle::P_BAR_PA).ln() / 1000.0
        }
        _ => return None,
    };
    let dfh = liq.and_then(|l| l.dfH.as_ref()).map(|d| d.value)?;
    let cp = liq.and_then(|l| l.cp.as_ref()).or_else(|| gas.and_then(|g| g.cp.as_ref())).map(|d| d.value);
    let source = if measured.is_some() {
        "measured hydration free energy (FreeSolv) on the gas-phase formation energy"
    } else {
        "hydration free energy (group additivity) on the gas-phase formation energy"
    };
    let datum = |v: f64, unit: &str| Datum::new(v, unit, ProvenanceTier::Estimated, source);
    Some(PhaseThermo {
        model: "point+cp".to_string(),
        tier: ProvenanceTier::Estimated,
        source: source.to_string(),
        dfH: Some(datum(dfh, "kJ/mol")),
        dfG: Some(datum(crate::hydration::aqueous_dgf_from_gas_kj(dfg_gas, hyd), "kJ/mol")),
        S: None,
        cp: cp.map(|c| datum(c, "J/(mol K)")),
        ranges: None,
        params: None,
    })
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

fn state_from_formation(dfh_kj: f64, dfg_kj: f64, cp: &CpModel, t: f64, tier: ProvenanceTier) -> ThermoState {
    // Formation entropy dfS = (dfH - dfG) / 298.15 stands in for the absolute entropy: the element entropies cancel in
    // every balanced reaction, so reaction quantities are exact; Cp(T) follows the species' heat-capacity model.
    let df_s_j_mol_k = (dfh_kj - dfg_kj) * 1000.0 / 298.15;
    let h_j_mol = dfh_kj * 1000.0 + cp.delta_h(t);
    let s_j_mol_k = df_s_j_mol_k + cp.delta_s(t);
    let mu0_j_mol = h_j_mol - t * s_j_mol_k;
    ThermoState { h_j_mol, s_j_mol_k, cp_j_mol_k: cp.cp(t), mu0_j_mol, tier }
}

/// Heat-capacity model of a record in a phase: (model, true when the 298 K value itself is an estimate).
/// Linear or not, from the formula alone (no structure): diatomics, and triatomics whose central atom is carbon or nitrogen
/// bonded to two other atoms of one or two elements (CO2, CS2, N2O, HCN, C2H2): the classes where it matters for Cp.
fn gas_is_linear(r: &crate::db::SpeciesRecord) -> bool {
    let e = r.elements();
    let n: f64 = e.values().sum();
    if n <= 2.0 {
        return true;
    }
    let c = e.get("C").copied().unwrap_or(0.0);
    let h = e.get("H").copied().unwrap_or(0.0);
    // triatomic with a carbon or nitrogen centre and at most one hydrogen (CO2, CS2, N2O, HCN), and a C2 hydrocarbon
    // with as many H as C (acetylene-type)
    if n == 3.0 && (c > 0.0 || e.contains_key("N")) && h <= 1.0 {
        return true;
    }
    if n == 4.0 && c == 2.0 && h == 2.0 {
        return true;
    }
    false
}

fn cp_model(r: &crate::db::SpeciesRecord, phase: &str, cp298: Option<f64>) -> (CpModel, bool) {
    let n_atoms = r.elements().values().sum::<f64>().max(1.0);
    match phase {
        "s" => match cp298 {
            Some(c) => (CpModel::einstein(c, n_atoms), false),
            None => (CpModel::einstein(kopp_cp(&r.identity.formula, false), n_atoms), true),
        },
        "g" => {
            if n_atoms <= 1.0 {
                // monatomic ideal gas: translation only
                return (CpModel::Constant(2.5 * R_GAS), cp298.is_none());
            }
            let joback = r
                .identity
                .smiles
                .as_deref()
                .and_then(crate::smiles::parse)
                .and_then(|m| crate::joback::estimate(&m));
            match (joback, cp298) {
                (Some(j), Some(c)) => (CpModel::polynomial(j.cp_coeffs, c), false),
                (Some(j), None) => (CpModel::polynomial(j.cp_coeffs, j.cp_gas(298.15)), true),
                // data but no structure: translation, rotation and Einstein vibrations anchored at the datum
                (None, Some(c)) => (CpModel::einstein_gas(c, c, n_atoms, gas_is_linear(r)), false),
                // no datum, no structure: translation + rotation, vibrations frozen at 298 K, labelled estimate
                (None, None) => (CpModel::einstein_gas(if gas_is_linear(r) { 3.5 * R_GAS } else { 4.0 * R_GAS }, 0.0, n_atoms, gas_is_linear(r)), true),
            }
        }
        "l" => match cp298 {
            Some(c) => (CpModel::Constant(c), false),
            None => (CpModel::Constant(kopp_cp(&r.identity.formula, true)), true),
        },
        _ => match cp298 {
            Some(c) => (CpModel::Constant(c), false),
            // a dissolved species without a heat-capacity datum carries none (the solvent dominates the heat capacity)
            None => (CpModel::Constant(0.0), true),
        },
    }
}

/// A conjugate acid / base pair partner of an ion: (partner record id, pKa, whether the partner is the acid).
struct Partner {
    id: String,
    pka: f64,
    partner_is_acid: bool,
}

/// Looks for the species one proton away from `rec` (the conjugate acid of an anion, the conjugate base of a cation) in
/// the store and the pKa of that pair: tabulated sites of the acid, else the structure-based estimate (`pka_structure`),
/// else the functional-class estimate from the formula.
fn conjugate_partner(store: &SpeciesStore, rec: &crate::db::SpeciesRecord) -> Option<Partner> {
    // only pure formula parsing in here: `SpeciesRecord::elements` can fall back to a store lookup, and this runs under the
    // store's read guard (a nested read deadlocks against a waiting writer)
    let pure_elements = |c: &crate::db::SpeciesRecord| {
        let (body, _) = crate::ions::split_charge(&c.identity.formula);
        crate::ions::parse_formula_strict(body).unwrap_or_default()
    };
    let elems = pure_elements(rec);
    if elems.is_empty() {
        return None;
    }
    let z = rec.identity.charge;
    let has_data = |c: &crate::db::SpeciesRecord| {
        ["aq", "l"].iter().any(|ph| c.phases.get(*ph).and_then(|p| p.thermo.as_ref()).map_or(false, |t| t.dfH.is_some() || t.dfG.is_some()))
    };
    let with_h = |delta: f64| {
        let mut e = elems.clone();
        *e.entry("H".to_string()).or_insert(0.0) += delta;
        e.retain(|_, v| *v > 0.0);
        e
    };
    // acid partner: elements + H, charge + 1 (for a species that can take a proton: anions and neutral bases)
    let acid_elems = with_h(1.0);
    let base_elems = with_h(-1.0);
    for cand in store.iter() {
        if cand.id == rec.id || !has_data(cand) {
            continue;
        }
        if cand.identity.charge == z + 1 && z <= 0 && pure_elements(cand) == acid_elems {
            let pka = cand
                .acid_base
                .iter()
                .map(|s| s.pKa.value)
                .fold(None, |m: Option<f64>, v| Some(m.map_or(v, |c| c.min(v))))
                .or_else(|| cand.identity.smiles.as_deref().and_then(crate::pka_structure::primary_pka))
                .or_else(|| rec.identity.smiles.as_deref().and_then(crate::pka_structure::primary_pka))
                .or_else(|| crate::acid_estimate::estimate_pka(&cand.identity.formula));
            if let Some(pka) = pka {
                return Some(Partner { id: cand.id.clone(), pka, partner_is_acid: true });
            }
        }
        if z > 0 && cand.identity.charge == z - 1 && pure_elements(cand) == base_elems {
            let pka = rec
                .acid_base
                .iter()
                .map(|s| s.pKa.value)
                .fold(None, |m: Option<f64>, v| Some(m.map_or(v, |c| c.max(v))))
                .or_else(|| rec.identity.smiles.as_deref().and_then(crate::pka_structure::primary_pka));
            if let Some(pka) = pka {
                return Some(Partner { id: cand.id.clone(), pka, partner_is_acid: false });
            }
        }
    }
    None
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
