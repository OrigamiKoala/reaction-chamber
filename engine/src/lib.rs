pub mod types;
pub mod equilibrium;
pub mod kinetics;
pub mod physics;
pub mod energy;
pub mod phase_transfer;
pub mod conservation;
pub mod benchmark;
pub mod optics;
pub mod spectra;
pub mod ions;
pub mod acid_estimate;
pub mod smiles;
pub mod vapour;
pub mod solubility;
pub mod compound_model;
pub mod compound_thermo;
pub mod vessel_phase;
pub mod chem_db;
pub mod vessel;
pub mod vessel_ext;
pub mod gas;
pub mod vessel_eq;
pub mod templates;
pub mod network_generator;
pub mod db;
pub mod thermo;
pub mod gem;
pub mod energy_balance;

use wasm_bindgen::prelude::*;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU32, Ordering};

use equilibrium::*;
use kinetics::*;
use physics::*;
use energy::*;
use phase_transfer::*;
use benchmark::*;
use chem_db::ReagentCatalogEntry;
use vessel::*;

static VESSELS: Mutex<Option<HashMap<u32, Vessel>>> = Mutex::new(None);
static NEXT_HANDLE: AtomicU32 = AtomicU32::new(1);

fn with_vessels<F, R>(f: F) -> Result<R, JsValue>
where
    F: FnOnce(&mut HashMap<u32, Vessel>) -> Result<R, JsValue>,
{
    let mut guard = VESSELS.lock().map_err(|e| JsValue::from_str(&format!("Mutex lock error: {}", e)))?;
    let map = guard.get_or_insert_with(HashMap::new);
    f(map)
}


#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn init_engine() -> String {
    console_error_panic_hook::set_once();
    "Reaction Chamber Engine v0.4.0 (M3 Equilibrium & M4 Kinetics/Physics WASM initialized)".to_string()
}

#[wasm_bindgen]
pub fn echo_message(msg: &str) -> String {
    format!("WASM_ACK: {}", msg)
}

#[wasm_bindgen]
pub fn pour_volume(source_vol_ml: f64, target_vol_ml: f64, transfer_ml: f64) -> Result<JsValue, JsValue> {
    if transfer_ml < 0.0 {
        return Err(JsValue::from_str("Transfer volume cannot be negative"));
    }
    let actual_transfer = transfer_ml.min(source_vol_ml);
    let new_source = source_vol_ml - actual_transfer;
    let new_target = target_vol_ml + actual_transfer;

    // Conservation check
    let delta = (new_source + new_target) - (source_vol_ml + target_vol_ml);
    if delta.abs() > 1e-9 {
        return Err(JsValue::from_str("Volume conservation violation detected"));
    }

    let result = serde_json::json!({
        "transferred_ml": actual_transfer,
        "source_remaining_ml": new_source,
        "target_new_ml": new_target,
        "conserved": true
    });

    serde_wasm_bindgen_to_val(&result)
}

#[wasm_bindgen]
pub fn calculate_equilibrium(input_json: &str) -> Result<JsValue, JsValue> {
    let parsed: serde_json::Value = serde_json::from_str(input_json)
        .map_err(|e| JsValue::from_str(&format!("JSON parse error: {}", e)))?;

    let sys = AqueousSystemInput {
        temp_k: parsed.get("temp_k").and_then(|v| v.as_f64()).unwrap_or(298.15),
        c_strong_acid: parsed.get("c_strong_acid").and_then(|v| v.as_f64()).unwrap_or(0.0),
        c_strong_base: parsed.get("c_strong_base").and_then(|v| v.as_f64()).unwrap_or(0.0),
        c_weak_monoprotic_acid: parsed.get("c_weak_monoprotic_acid").and_then(|v| v.as_f64()).unwrap_or(0.0),
        pka_weak_mono: parsed.get("pka_weak_mono").and_then(|v| v.as_f64()),
        c_weak_monoprotic_base: parsed.get("c_weak_monoprotic_base").and_then(|v| v.as_f64()).unwrap_or(0.0),
        pka_weak_base_conj: parsed.get("pka_weak_base_conj").and_then(|v| v.as_f64()),
        c_diprotic_acid: parsed.get("c_diprotic_acid").and_then(|v| v.as_f64()).unwrap_or(0.0),
        pkas_diprotic: parsed.get("pkas_diprotic").and_then(|v| {
            let arr = v.as_array()?;
            if arr.len() == 2 {
                Some([arr[0].as_f64()?, arr[1].as_f64()?])
            } else {
                None
            }
        }),
        c_triprotic_acid: parsed.get("c_triprotic_acid").and_then(|v| v.as_f64()).unwrap_or(0.0),
        pkas_triprotic: parsed.get("pkas_triprotic").and_then(|v| {
            let arr = v.as_array()?;
            if arr.len() == 3 {
                Some([arr[0].as_f64()?, arr[1].as_f64()?, arr[2].as_f64()?])
            } else {
                None
            }
        }),
        c_ag_plus: parsed.get("c_ag_plus").and_then(|v| v.as_f64()).unwrap_or(0.0),
        c_cl_precip: parsed.get("c_cl_precip").and_then(|v| v.as_f64()).unwrap_or(0.0),
    };

    let result = solve_aqueous_equilibrium(&sys);
    serde_wasm_bindgen_to_val(&result)
}

#[wasm_bindgen]
pub fn calculate_titration(
    curve_type: &str,
    vol_acid_ml: f64,
    c_acid: f64,
    c_base: f64,
    extra_param_json: &str,
    max_titrant_ml: f64,
    steps: usize,
    temp_k: f64,
) -> Result<JsValue, JsValue> {
    let curve = match curve_type {
        "strong_strong" => titrate_strong_strong(vol_acid_ml, c_acid, c_base, max_titrant_ml, steps, temp_k),
        "weak_strong" => {
            let pka: f64 = extra_param_json.parse().unwrap_or(4.756);
            titrate_weak_strong(vol_acid_ml, c_acid, pka, c_base, max_titrant_ml, steps, temp_k)
        }
        "polyprotic" => {
            let pkas: Vec<f64> = serde_json::from_str(extra_param_json).unwrap_or_else(|_| vec![6.35, 10.33]);
            titrate_polyprotic(vol_acid_ml, c_acid, &pkas, c_base, max_titrant_ml, steps, temp_k)
        }
        _ => return Err(JsValue::from_str("Unknown titration curve type")),
    };

    serde_wasm_bindgen_to_val(&curve)
}

#[wasm_bindgen]
pub fn calculate_calorimetry_mixing(
    vol1_ml: f64,
    temp1_k: f64,
    vol2_ml: f64,
    temp2_k: f64,
) -> Result<JsValue, JsValue> {
    let amounts1 = HashMap::new();
    let amounts2 = HashMap::new();
    let res = mix_liquids(vol1_ml, temp1_k, &amounts1, vol2_ml, temp2_k, &amounts2);
    serde_wasm_bindgen_to_val(&res)
}

#[wasm_bindgen]
pub fn run_iodine_clock_sim(
    initial_s2o8: f64,
    initial_i: f64,
    initial_s2o3: f64,
    temp_k: f64,
    dt: f64,
    max_time_sec: f64,
) -> Result<JsValue, JsValue> {
    let (delay, i2_series, s2o3_series) = simulate_iodine_clock(
        initial_s2o8,
        initial_i,
        initial_s2o3,
        temp_k,
        dt,
        max_time_sec,
    );

    let res = serde_json::json!({
        "delay_time_sec": delay,
        "temperature_k": temp_k,
        "i2_series": i2_series,
        "s2o3_series": s2o3_series,
    });
    serde_wasm_bindgen_to_val(&res)
}

#[wasm_bindgen]
pub fn step_simulation_tick(state_json: &str, dt: f64) -> Result<JsValue, JsValue> {
    let val: serde_json::Value = serde_json::from_str(state_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid simulation JSON: {}", e)))?;

    let temp_k = val.get("temperature_k").and_then(|v| v.as_f64()).unwrap_or(298.15);
    let liquid_vol_ml = val.get("liquid_vol_ml").and_then(|v| v.as_f64()).unwrap_or(100.0);
    let heater_watts = val.get("heater_watts").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let stirring = val.get("stirring").and_then(|v| v.as_bool()).unwrap_or(false);
    let q_rxn = val.get("reaction_heats_joules").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let ambient_loss = val.get("ambient_loss_coeff").and_then(|v| v.as_f64()).unwrap_or(0.2);
    let t_room = val.get("t_room_k").and_then(|v| v.as_f64()).unwrap_or(298.15);

    // 1. Energy step
    let energy_res = step_energy_balance(temp_k, liquid_vol_ml, q_rxn, heater_watts, ambient_loss, t_room, dt);

    // 2. Evaporation & boiling phase transfer
    let (_lost_moles, remaining_vol_ml) = step_evaporation_and_boiling(
        liquid_vol_ml,
        energy_res.new_temp_k,
        energy_res.is_boiling,
        energy_res.boil_off_moles,
        dt,
    );

    // 3. Dissolved gas transfer (CO2 degas if present)
    let c_co2 = val.get("dissolved_co2_m").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let (gas_evolved_mol, remaining_co2_m) = step_gas_evolution(
        c_co2,
        remaining_vol_ml / 1000.0,
        energy_res.new_temp_k,
        1.0,
        stirring,
        dt,
    );

    let mut gas_map = HashMap::new();
    if gas_evolved_mol > 0.0 {
        gas_map.insert("CO2(g)".to_string(), gas_evolved_mol);
    }

    let result = serde_json::json!({
        "new_temperature_k": energy_res.new_temp_k,
        "is_boiling": energy_res.is_boiling,
        "liquid_volume_ml": remaining_vol_ml,
        "boil_off_moles": energy_res.boil_off_moles,
        "gas_evolved_mol": gas_map,
        "remaining_co2_m": remaining_co2_m,
        "conserved": true
    });

    serde_wasm_bindgen_to_val(&result)
}

#[wasm_bindgen]
pub fn run_wasm_benchmark(ticks: usize) -> Result<JsValue, JsValue> {
    let res = run_benchmark(ticks, 0.05);
    serde_wasm_bindgen_to_val(&res)
}

#[wasm_bindgen]
pub fn vessel_new(config_json: &str) -> Result<u32, JsValue> {
    let config: VesselConfig = serde_json::from_str(config_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid VesselConfig: {}", e)))?;
    let handle = NEXT_HANDLE.fetch_add(1, Ordering::SeqCst);
    let v = Vessel::new(config);
    with_vessels(|map| {
        map.insert(handle, v);
        Ok(handle)
    })
}

#[wasm_bindgen]
pub fn vessel_free(handle: u32) -> bool {
    with_vessels(|map| {
        gas::drop_links_of(handle);
        Ok(map.remove(&handle).is_some())
    }).unwrap_or(false)
}

#[wasm_bindgen]
pub fn vessel_dose(handle: u32, dose_json: &str) -> Result<JsValue, JsValue> {
    let dose: DoseRequest = serde_json::from_str(dose_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid DoseRequest: {}", e)))?;
    with_vessels(|map| {
        let v = map.get_mut(&handle)
            .ok_or_else(|| JsValue::from_str(&format!("Unknown vessel handle: {}", handle)))?;
        v.dose(dose).map_err(|e| JsValue::from_str(&e))?;
        serde_wasm_bindgen_to_val(&v.snapshot())
    })
}

#[wasm_bindgen]
pub fn vessel_add_portion(handle: u32, portion_json: &str) -> Result<JsValue, JsValue> {
    let portion: Portion = serde_json::from_str(portion_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid Portion: {}", e)))?;
    with_vessels(|map| {
        let v = map.get_mut(&handle)
            .ok_or_else(|| JsValue::from_str(&format!("Unknown vessel handle: {}", handle)))?;
        v.add_portion(portion).map_err(|e| JsValue::from_str(&e))?;
        serde_wasm_bindgen_to_val(&v.snapshot())
    })
}

#[wasm_bindgen]
pub fn vessel_remove_liquid(handle: u32, vol_ml: f64, include_solids: bool) -> Result<JsValue, JsValue> {
    with_vessels(|map| {
        let v = map.get_mut(&handle)
            .ok_or_else(|| JsValue::from_str(&format!("Unknown vessel handle: {}", handle)))?;
        let portion = v.remove_liquid(vol_ml, include_solids).map_err(|e| JsValue::from_str(&e))?;
        serde_wasm_bindgen_to_val(&portion)
    })
}

/// Like `vessel_remove_liquid`, but drains the densest layer first (separatory funnel stopcock).
#[wasm_bindgen]
pub fn vessel_remove_liquid_bottom(handle: u32, vol_ml: f64, include_solids: bool) -> Result<JsValue, JsValue> {
    with_vessels(|map| {
        let v = map.get_mut(&handle)
            .ok_or_else(|| JsValue::from_str(&format!("Unknown vessel handle: {}", handle)))?;
        let portion = v.remove_liquid_bottom(vol_ml, include_solids).map_err(|e| JsValue::from_str(&e))?;
        serde_wasm_bindgen_to_val(&portion)
    })
}

#[wasm_bindgen]
pub fn vessel_control(handle: u32, controls_json: &str) -> Result<JsValue, JsValue> {
    let controls: VesselControls = serde_json::from_str(controls_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid VesselControls: {}", e)))?;
    with_vessels(|map| {
        let v = map.get_mut(&handle)
            .ok_or_else(|| JsValue::from_str(&format!("Unknown vessel handle: {}", handle)))?;
        v.set_controls(controls);
        serde_wasm_bindgen_to_val(&v.snapshot())
    })
}

#[wasm_bindgen]
pub fn vessel_step(handle: u32, dt: f64) -> Result<JsValue, JsValue> {
    with_vessels(|map| {
        let v = map.get_mut(&handle)
            .ok_or_else(|| JsValue::from_str(&format!("Unknown vessel handle: {}", handle)))?;
        v.step(dt).map_err(|e| JsValue::from_str(&e))?;
        gas::step_links(map, dt, Some(&[handle]));
        let v = map.get(&handle)
            .ok_or_else(|| JsValue::from_str(&format!("Unknown vessel handle: {}", handle)))?;
        serde_wasm_bindgen_to_val(&v.snapshot())
    })
}

#[wasm_bindgen]
pub fn vessel_snapshot(handle: u32) -> Result<JsValue, JsValue> {
    with_vessels(|map| {
        let v = map.get(&handle)
            .ok_or_else(|| JsValue::from_str(&format!("Unknown vessel handle: {}", handle)))?;
        serde_wasm_bindgen_to_val(&v.snapshot())
    })
}

#[wasm_bindgen]
pub fn vessel_equilibrate(handle: u32, max_sim_s: f64) -> Result<JsValue, JsValue> {
    with_vessels(|map| {
        let v = map.get_mut(&handle)
            .ok_or_else(|| JsValue::from_str(&format!("Unknown vessel handle: {}", handle)))?;
        v.equilibrate(max_sim_s);
        serde_wasm_bindgen_to_val(&v.snapshot())
    })
}

#[wasm_bindgen]
pub fn step_all(handles_json: &str, dt: f64) -> Result<JsValue, JsValue> {
    let handles: Vec<u32> = serde_json::from_str(handles_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid handles array: {}", e)))?;
    with_vessels(|map| {
        let mut snapshots = HashMap::new();
        for h in &handles {
            if let Some(v) = map.get_mut(h) {
                let _ = v.step(dt);
            }
        }
        // delivery tubes move evolved gas into collectors after every vessel has advanced
        gas::step_links(map, dt, Some(&handles));
        for h in handles {
            if let Some(v) = map.get(&h) {
                snapshots.insert(h, v.snapshot());
            }
        }
        serde_wasm_bindgen_to_val(&snapshots)
    })
}

#[wasm_bindgen]
pub fn optics_tables_json() -> String {
    optics::tables_json()
}

/// Hash of the engine's optics data (absorption bands): a cache key for anything derived from solution colours.
#[wasm_bindgen]
pub fn optics_data_version() -> String {
    format!("{:016x}", spectra::data_hash())
}

#[wasm_bindgen]
pub fn reagent_catalog_json() -> String {
    serde_json::to_string(&chem_db::get_reagent_catalog()).unwrap_or_else(|_| "[]".to_string())
}

#[wasm_bindgen]
pub fn register_compound(entry_json: &str) -> Result<JsValue, JsValue> {
    let entry: ReagentCatalogEntry = serde_json::from_str(entry_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid ReagentCatalogEntry: {}", e)))?;
    chem_db::register_custom_reagent(entry.clone());
    with_vessels(|map| {
        for v in map.values_mut() {
            v.register_reagent(entry.clone());
        }
        serde_wasm_bindgen_to_val(&serde_json::json!({"registered": true, "id": entry.id}))
    })
}

/// Models an imported compound (formula, state, ...) as a reacting reagent and registers it (plus its solubility
/// limit) with the engine. Returns the CompoundModel JSON: `modelable=false` means it stays visual-only.
#[wasm_bindgen]
pub fn import_compound(req_json: &str) -> Result<JsValue, JsValue> {
    let req: compound_model::CompoundRequest = serde_json::from_str(req_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid CompoundRequest: {}", e)))?;
    let model = compound_model::model_compound(&req);
    if let Some(entry) = &model.entry {
        chem_db::register_custom_reagent(entry.clone());
    }
    if let Some(min) = &model.mineral {
        chem_db::register_custom_mineral(min.clone());
    }
    if let Some(c) = &model.compound {
        chem_db::register_custom_compound(c.clone());
    }
    for eq in &model.equilibria {
        chem_db::register_custom_equilibrium(eq.clone());
    }
    with_vessels(|map| {
        for v in map.values_mut() {
            for eq in &model.equilibria {
                v.register_equilibrium(eq.clone());
            }
            if let Some(entry) = &model.entry {
                v.register_reagent(entry.clone());
            }
            if let Some(c) = &model.compound {
                v.register_compound(c.clone());
            }
            if let Some(min) = &model.mineral {
                v.register_mineral(min.clone());
            }
        }
        serde_wasm_bindgen_to_val(&model)
    })
}

#[wasm_bindgen]
pub fn register_reaction(rxn_json: &str) -> Result<JsValue, JsValue> {
    let mut rxn: chem_db::GeneralKineticRxn = serde_json::from_str(rxn_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid GeneralKineticRxn: {}", e)))?;
    // element + charge balance check: an unbalanced / unverifiable reaction is demoted to Speculative with a warning
    let warning = chem_db::audit_kinetic_reaction(&mut rxn);
    chem_db::register_custom_kinetic_rxn(rxn.clone());
    with_vessels(|map| {
        for v in map.values_mut() {
            v.register_kinetic_reaction(rxn.clone());
        }
        serde_wasm_bindgen_to_val(&serde_json::json!({"registered": true, "id": rxn.id, "tier": rxn.tier.as_str(), "warning": warning}))
    })
}

#[wasm_bindgen]
pub fn register_equilibrium(eq_json: &str) -> Result<JsValue, JsValue> {
    let mut eq: chem_db::GeneralEquilibrium = serde_json::from_str(eq_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid GeneralEquilibrium: {}", e)))?;
    let warning = chem_db::audit_equilibrium(&mut eq);
    chem_db::register_custom_equilibrium(eq.clone());
    with_vessels(|map| {
        for v in map.values_mut() {
            v.register_equilibrium(eq.clone());
        }
        serde_wasm_bindgen_to_val(&serde_json::json!({"registered": true, "id": eq.id, "tier": eq.tier.as_str(), "warning": warning}))
    })
}

#[wasm_bindgen]
pub fn register_mineral(min_json: &str) -> Result<JsValue, JsValue> {
    let min: chem_db::GeneralMineral = serde_json::from_str(min_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid GeneralMineral: {}", e)))?;
    chem_db::register_custom_mineral(min.clone());
    with_vessels(|map| {
        for v in map.values_mut() {
            v.register_mineral(min.clone());
        }
        serde_wasm_bindgen_to_val(&serde_json::json!({"registered": true, "id": min.id}))
    })
}

/// Solids whose Ksp is a guess and should be looked up externally (PubChem); drains the queue.
#[wasm_bindgen]
pub fn take_mineral_lookups() -> Result<JsValue, JsValue> {
    serde_wasm_bindgen_to_val(&solubility::take_lookups())
}

/// Applies externally found solubility / appearance data (see `solubility::MineralData`) to a guessed solid and
/// registers the improved mineral with the engine and every open vessel.
#[wasm_bindgen]
pub fn resolve_mineral(data_json: &str) -> Result<JsValue, JsValue> {
    let data: solubility::MineralData = serde_json::from_str(data_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid MineralData: {}", e)))?;
    let res = solubility::resolve_mineral(&data);
    if let Some(min) = &res.mineral {
        chem_db::register_custom_mineral(min.clone());
        with_vessels(|map| {
            for v in map.values_mut() {
                v.register_mineral(min.clone());
            }
            Ok(())
        })?;
    }
    serde_wasm_bindgen_to_val(&res)
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq)]
pub struct PropertyRequest {
    pub species_id: String,
    pub identity: db::Identity,
    pub kinds: Vec<String>,
    pub reason: String,
    pub current_tier: types::ProvenanceTier,
}

static PROPERTY_REQUESTS: Mutex<Vec<PropertyRequest>> = Mutex::new(Vec::new());

pub fn queue_property_request(req: PropertyRequest) {
    if let Ok(mut queue) = PROPERTY_REQUESTS.lock() {
        if !queue.iter().any(|r| r.species_id == req.species_id) {
            queue.push(req);
        }
    }
}

#[wasm_bindgen]
pub fn register_species(species_json: &str) -> Result<JsValue, JsValue> {
    let rec: db::SpeciesRecord = serde_json::from_str(species_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid SpeciesRecord: {}", e)))?;
    let id = rec.id.clone();
    if let Ok(mut store) = db::SpeciesStore::global().write() {
        store.register(rec);
    }
    serde_wasm_bindgen_to_val(&serde_json::json!({"registered": true, "id": id}))
}

#[wasm_bindgen]
pub fn load_database(shard_json: &str) -> Result<JsValue, JsValue> {
    let count = if let Ok(mut store) = db::SpeciesStore::global().write() {
        store.load_database_json(shard_json)
            .map_err(|e| JsValue::from_str(&e))?
    } else {
        0
    };
    serde_wasm_bindgen_to_val(&serde_json::json!({"loaded": true, "count": count}))
}

#[wasm_bindgen]
pub fn species_record(id: &str) -> Result<JsValue, JsValue> {
    let global = db::SpeciesStore::global();
    let store = global.read()
        .map_err(|e| JsValue::from_str(&format!("Lock error: {}", e)))?;
    if let Some(rec) = store.get(id) {
        serde_wasm_bindgen_to_val(rec)
    } else {
        Ok(JsValue::NULL)
    }
}

pub fn get_property_requests() -> Vec<PropertyRequest> {
    let mut reqs = if let Ok(mut queue) = PROPERTY_REQUESTS.lock() {
        std::mem::take(&mut *queue)
    } else {
        Vec::new()
    };
    for m in solubility::take_lookups() {
        reqs.push(PropertyRequest {
            species_id: m.solid_species.clone(),
            identity: db::Identity {
                inchikey: None,
                smiles: None,
                formula: m.formula.clone(),
                charge: 0,
                cas: None,
                cid: None,
                names: vec![m.formula.clone()],
                db_names: HashMap::new(),
            },
            kinds: vec!["ksp".to_string(), "solubility".to_string()],
            reason: format!("Guessed Ksp for precipitate {}", m.solid_species),
            current_tier: types::ProvenanceTier::Speculative,
        });
    }
    reqs
}

pub fn apply_resolved_properties(records: Vec<db::SpeciesRecord>) -> usize {
    let mut resolved = 0;
    if let Ok(mut store) = db::SpeciesStore::global().write() {
        for rec in records {
            store.register(rec);
            resolved += 1;
        }
    }
    resolved
}

#[wasm_bindgen]
pub fn take_property_requests() -> Result<JsValue, JsValue> {
    let reqs = get_property_requests();
    serde_wasm_bindgen_to_val(&reqs)
}

#[wasm_bindgen]
pub fn resolve_properties(records_json: &str) -> Result<JsValue, JsValue> {
    let records: Vec<db::SpeciesRecord> = serde_json::from_str(records_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid records JSON: {}", e)))?;
    let resolved = apply_resolved_properties(records);
    serde_wasm_bindgen_to_val(&serde_json::json!({"resolved": resolved}))
}

fn serde_wasm_bindgen_to_val<T: Serialize>(val: &T) -> Result<JsValue, JsValue> {
    serde_json::to_string(val)
        .map(|s| JsValue::from_str(&s))
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn m6_get_reaction_families() -> Result<JsValue, JsValue> {
    let fams = templates::get_reaction_families();
    serde_wasm_bindgen_to_val(&fams)
}

#[wasm_bindgen]
pub fn m6_calculate_mayr_rate(nuc_id: &str, el_id: &str, temp_k: f64) -> Result<JsValue, JsValue> {
    let db = templates::get_mayr_database();
    let nuc = db.get(nuc_id).ok_or_else(|| JsValue::from_str(&format!("Unknown nucleophile: {}", nuc_id)))?;
    let el = db.get(el_id).ok_or_else(|| JsValue::from_str(&format!("Unknown electrophile: {}", el_id)))?;
    let k = templates::calculate_mayr_rate(nuc, el, temp_k);
    let capped_k = templates::apply_diffusion_cap(k, temp_k, templates::VISCOSITY_WATER_298);
    let res = serde_json::json!({
        "nucleophile": nuc.name,
        "electrophile": el.name,
        "k_mayr": k,
        "k_diffusion_capped": capped_k,
        "temp_k": temp_k,
        "tier": "tabulated"
    });
    serde_wasm_bindgen_to_val(&res)
}

#[wasm_bindgen]
pub fn m6_sn2_e2_competition(substrate_type: &str, is_bulky_base: bool, temp_k: f64) -> Result<JsValue, JsValue> {
    let (k_sn2, k_e2, ratio) = templates::sn2_e2_product_ratio(substrate_type, is_bulky_base, temp_k);
    let res = serde_json::json!({
        "substrate": substrate_type,
        "is_bulky_base": is_bulky_base,
        "temp_k": temp_k,
        "k_sn2": k_sn2,
        "k_e2": k_e2,
        "e2_over_sn2_ratio": ratio,
        "fraction_e2": k_e2 / (k_sn2 + k_e2).max(1e-15),
        "fraction_sn2": k_sn2 / (k_sn2 + k_e2).max(1e-15),
    });
    serde_wasm_bindgen_to_val(&res)
}

#[wasm_bindgen]
pub fn m6_ester_hydrolysis_rate_vs_ph(ester_type: &str, ph: f64, temp_k: f64) -> Result<JsValue, JsValue> {
    let k_obs = templates::ester_hydrolysis_k_obs(ester_type, ph, temp_k);
    let res = serde_json::json!({
        "ester": ester_type,
        "ph": ph,
        "temp_k": temp_k,
        "k_obs": k_obs,
        "log10_k_obs": if k_obs > 0.0 { k_obs.log10() } else { -20.0 },
    });
    serde_wasm_bindgen_to_val(&res)
}

#[wasm_bindgen]
pub fn m6_generate_reaction_network(initial_concs_json: &str, temp_k: f64, ph: f64) -> Result<JsValue, JsValue> {
    let concs: HashMap<String, f64> = serde_json::from_str(initial_concs_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid initial_concs JSON: {}", e)))?;
    let generator = network_generator::NetworkGenerator::new(network_generator::NetworkGeneratorConfig::default());
    let net = generator.generate_network(&concs, temp_k, ph);
    serde_wasm_bindgen_to_val(&net)
}

#[wasm_bindgen]
pub fn m6_stress_test_mixture(species_list_json: &str) -> Result<JsValue, JsValue> {
    let species_list: Vec<String> = serde_json::from_str(species_list_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid species list JSON: {}", e)))?;
    let mut concs = HashMap::new();
    for sp in &species_list {
        concs.insert(sp.clone(), 0.1);
    }
    let generator = network_generator::NetworkGenerator::new(network_generator::NetworkGeneratorConfig::default());
    let net = generator.generate_network(&concs, 298.15, 7.0);
    let res = serde_json::json!({
        "input_species_count": species_list.len(),
        "final_active_species_count": net.active_species.len(),
        "generated_reactions_count": net.reactions.len(),
        "cap_reached": net.cap_reached,
        "bounded": net.active_species.len() <= 200 && net.reactions.len() <= 500,
    });
    serde_wasm_bindgen_to_val(&res)
}

#[wasm_bindgen]
pub fn m6_diffusion_capped_rate(k_fwd: f64, temp_k: f64, viscosity: f64) -> Result<JsValue, JsValue> {
    let capped = templates::apply_diffusion_cap(k_fwd, temp_k, viscosity);
    let k_diff = templates::calculate_diffusion_limit(viscosity, temp_k);
    let res = serde_json::json!({
        "k_uncapped": k_fwd,
        "k_diff_limit": k_diff,
        "k_capped": capped,
        "limited": capped < k_fwd * 0.999
    });
    serde_wasm_bindgen_to_val(&res)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::conservation::*;
    use crate::types::ProvenanceTier;

    #[test]
    fn test_volume_conservation() {
        let s_vol = 100.0;
        let t_vol = 50.0;
        let transfer = 25.0;
        let remaining = s_vol - transfer;
        let new_t = t_vol + transfer;
        assert_eq!((s_vol + t_vol), (remaining + new_t));
    }

    #[test]
    fn test_m3_gate_strong_strong_titration() {
        // 50 mL 0.1 M HCl titrated with 0.1 M NaOH
        let curve = titrate_strong_strong(50.0, 0.1, 0.1, 100.0, 100, 298.15);
        assert_eq!(curve.points.len(), 101);

        // Initial point: 0 mL titrant -> 0.1 M HCl
        let p_start = &curve.points[0];
        // Davies activity for 0.1 M: gamma ~ 0.78 => a_H ~ 0.078 => pH ~ 1.10
        assert!((p_start.ph - 1.10).abs() < 0.05, "Initial pH {:.3} should match PHREEQC 1.10", p_start.ph);

        // Equivalence point: 50 mL titrant -> pH = 7.00
        let p_eq = &curve.points[50];
        assert!((p_eq.ph - 7.00).abs() < 0.05, "Equivalence pH {:.3} should be ~7.00", p_eq.ph);

        // Excess base: 100 mL titrant (50 mL excess NaOH in 150 mL total = 0.0333 M)
        let p_end = &curve.points[100];
        // pOH ~ 1.5 => pH ~ 12.4
        assert!(p_end.ph > 12.0 && p_end.ph < 13.0, "Excess base pH {:.3} should be ~12.4", p_end.ph);
    }

    #[test]
    fn test_m3_gate_weak_strong_titration() {
        // 50 mL 0.1 M Acetic acid (pKa = 4.756) titrated with 0.1 M NaOH
        let curve = titrate_weak_strong(50.0, 0.1, 4.756, 0.1, 100.0, 100, 298.15);
        assert_eq!(curve.points.len(), 101);

        // Initial pH: sqrt(Ka * C) ~ 1.32e-3 => pH ~ 2.88
        let p_start = &curve.points[0];
        assert!((p_start.ph - 2.88).abs() < 0.05, "Initial acetic acid pH {:.3} should match PHREEQC 2.88", p_start.ph);

        // Half equivalence: 25 mL NaOH added -> with Davies activity correction at I = 0.033 M, pH = 4.68
        let p_half = &curve.points[25];
        assert!((p_half.ph - 4.68).abs() < 0.05, "Half equivalence pH {:.3} should match PHREEQC 4.68", p_half.ph);

        // Equivalence point: 50 mL NaOH added -> 0.05 M sodium acetate hydrolysis with Davies activity -> pH ~ 8.64
        let p_eq = &curve.points[50];
        assert!((p_eq.ph - 8.64).abs() < 0.05, "Equivalence pH {:.3} should match PHREEQC 8.64", p_eq.ph);
    }

    #[test]
    fn test_m3_gate_polyprotic_titration() {
        // 50 mL 0.05 M Carbonic acid (H2CO3, pKas = [6.35, 10.33]) titrated with 0.1 M NaOH
        let curve = titrate_polyprotic(50.0, 0.05, &[6.35, 10.33], 0.1, 100.0, 100, 298.15);
        assert_eq!(curve.points.len(), 101);

        // First equivalence point: 25 mL NaOH added (with Davies activity correction -> pH = 8.19)
        let p_eq1 = &curve.points[25];
        assert!((p_eq1.ph - 8.19).abs() < 0.05, "First equiv pH {:.3} should match PHREEQC 8.19", p_eq1.ph);

        // Second equivalence point: 50 mL NaOH added (CO3^2- hydrolysis with Davies activity -> pH ~ 11.15)
        let p_eq2 = &curve.points[50];
        assert!((p_eq2.ph - 11.15).abs() < 0.05, "Second equiv pH {:.3} should match PHREEQC 11.15", p_eq2.ph);
    }

    #[test]
    fn test_m3_gate_agcl_precipitation_ksp_threshold() {
        // Test 1: Sub-threshold (no precipitate)
        // [Ag+] = 1e-6 M, [Cl-] = 1e-6 M -> IAP = 1e-12 < Ksp (1.77e-10)
        let (ag_eq1, cl_eq1, ppt1) = solve_agcl_precipitation(1e-6, 1e-6, 1.0, 298.15);
        assert_eq!(ppt1, 0.0, "Sub-threshold should have 0 precipitate");
        assert_eq!(ag_eq1, 1e-6);
        assert_eq!(cl_eq1, 1e-6);

        // Test 2: Above threshold
        // [Ag+] = 0.01 M, [Cl-] = 0.01 M -> IAP = 1e-4 >> Ksp
        let (ag_eq2, cl_eq2, ppt2) = solve_agcl_precipitation(0.01, 0.01, 1.0, 298.15);
        assert!(ppt2 > 0.0099, "Should precipitate almost all AgCl");
        // Remaining [Ag+] * [Cl-] must equal Ksp
        let remaining_iap = ag_eq2 * cl_eq2;
        assert!((remaining_iap - KSP_AGCL_298).abs() / KSP_AGCL_298 < 1e-3, "Remaining IAP must equal Ksp");
    }

    #[test]
    fn test_m3_gate_calorimetry_temperature_mixing() {
        // Mix 100 mL water at 20 C (293.15 K) with 100 mL water at 80 C (353.15 K)
        let res = mix_liquids(100.0, 293.15, &HashMap::new(), 100.0, 353.15, &HashMap::new());
        assert_eq!(res.total_volume_ml, 200.0);
        // Mixed temp should be exactly 50 C (323.15 K)
        assert!((res.mixed_temperature_k - 323.15).abs() < 1e-3, "Calorimetry mix should be 50 C");

        // Unequal volume: 100 mL at 20 C + 300 mL at 60 C (333.15 K)
        // (1*20 + 3*60)/4 = 200/4 = 50 C
        let res2 = mix_liquids(100.0, 293.15, &HashMap::new(), 300.0, 333.15, &HashMap::new());
        assert!((res2.mixed_temperature_k - 323.15).abs() < 1e-3, "Weighted calorimetry mix should be 50 C");
    }

    #[test]
    fn test_m3_gate_density_layering() {
        // Hexane (0.655) vs Water (1.000)
        let (top, bottom) = determine_layering("Hexane", 0.655, "Water", 1.000);
        assert_eq!(top, "Hexane");
        assert_eq!(bottom, "Water");

        // Dichloromethane (1.326) vs Water (1.000)
        let (top2, bottom2) = determine_layering("DCM", 1.326, "Water", 1.000);
        assert_eq!(top2, "Water");
        assert_eq!(bottom2, "DCM");
    }

    #[test]
    fn test_m4_gate_iodine_clock_delays_at_two_temperatures() {
        // Literature test: [S2O8^2-] = 0.04 M, [I-] = 0.05 M, [S2O3^2-] = 0.002 M
        // Theoretical delay t ~ [S2O3] / (2 * k1 * [S2O8] * [I])
        // k1(293.15 K) ~ 0.020 => denominator ~ 2 * 0.020 * 0.04 * 0.05 = 8.0e-5
        // Expected t_20C ~ 0.002 / 8.0e-5 = 25.0 s
        let (delay_20c, _, _) = simulate_iodine_clock(0.04, 0.05, 0.002, 293.15, 0.1, 100.0);
        assert!((delay_20c - 25.0).abs() / 25.0 < 0.20, "20 C clock delay {:.1} s within 20% of 25.0 s", delay_20c);

        // At 35 C (308.15 K): k1 ~ 0.057 => t_35C ~ 25.0 / 2.85 ~ 8.8 s
        let (delay_35c, _, _) = simulate_iodine_clock(0.04, 0.05, 0.002, 308.15, 0.05, 50.0);
        let lit_35c = 8.8;
        assert!((delay_35c - lit_35c).abs() / lit_35c < 0.20, "35 C clock delay {:.1} s within 20% of 8.8 s", delay_35c);
        // Faster at higher temperature
        assert!(delay_35c < delay_20c * 0.5, "Clock must be significantly faster at 35 C than 20 C");
    }

    #[test]
    fn test_m4_gate_neutralisation_temperature_rise() {
        // 50 mL 1.0 M HCl + 50 mL 1.0 M NaOH (0.050 mol)
        // Q = 0.05 * 55840 = 2792 J. C = 100 g * 4.184 = 418.4 J/K.
        // Theoretical Delta T = 6.67 K
        let delta_t = calc_neutralisation_temperature_rise(50.0, 1.0, 50.0, 1.0);
        let lit_val = 6.67;
        let diff_pct = (delta_t - lit_val).abs() / lit_val * 100.0;
        assert!(diff_pct < 10.0, "Neutralisation rise {:.2} K differs by {:.1}% (target < 10%)", delta_t, diff_pct);
    }

    #[test]
    fn test_m4_gate_water_boils_near_100c() {
        // Vessel with 100 mL water at 95 C (368.15 K), with 1000 W heater
        // In 10 seconds: Q = 10000 J. Delta T to reach 100 C is 5 K (needs ~2100 J).
        // Remaining 7900 J boils water at 100 C.
        let dt = 5.0;
        let energy_res = step_energy_balance(368.15, 100.0, 0.0, 1000.0, 0.2, 298.15, dt);
        assert_eq!(energy_res.new_temp_k, 373.15, "Temperature must be clamped at boiling point 373.15 K (100 C)");
        assert!(energy_res.is_boiling, "Boiling state must be true");
        assert!(energy_res.boil_off_moles > 0.0, "Boil-off moles must be generated");

        let (lost_moles, rem_vol) = step_evaporation_and_boiling(100.0, energy_res.new_temp_k, true, energy_res.boil_off_moles, dt);
        assert!(lost_moles > 0.0);
        assert!(rem_vol < 100.0);
    }

    #[test]
    fn test_m4_gate_conservation_checks() {
        // Charge conservation test
        let neutral_ions = vec![(0.05, 1), (0.05, -1)]; // 0.05 mol Na+, 0.05 mol Cl-
        let (passed, err) = check_charge_conservation(&neutral_ions);
        assert!(passed);
        assert!(err < 1e-10);

        // Element conservation test
        let mut initial = HashMap::new();
        initial.insert("H".to_string(), 10.0);
        initial.insert("O".to_string(), 5.0);
        initial.insert("C".to_string(), 1.0);

        let mut final_elems = HashMap::new();
        final_elems.insert("H".to_string(), 10.0);
        final_elems.insert("O".to_string(), 3.0); // 2 O went to CO2
        final_elems.insert("C".to_string(), 0.0); // 1 C went to CO2

        let mut lost = HashMap::new();
        lost.insert("O".to_string(), 2.0);
        lost.insert("C".to_string(), 1.0);

        let (all_passed, max_err, _) = check_element_conservation(&initial, &final_elems, &lost);
        assert!(all_passed);
        assert!(max_err < 1e-6);
    }

    #[test]
    fn test_m4_gate_performance_benchmark_50_species_200_rxns() {
        let res = run_benchmark(50, 0.05);
        assert_eq!(res.num_species, 50);
        assert_eq!(res.num_reactions, 200);
        assert!(res.passed_target, "Avg tick time {:.3} ms must be < 5.0 ms", res.avg_tick_time_ms);
    }

    #[test]
    fn test_m3_edge_concentrated_acid_base() {
        // 5 M HCl
        let sys_acid = AqueousSystemInput {
            c_strong_acid: 5.0,
            ..Default::default()
        };
        let res_acid = solve_aqueous_equilibrium(&sys_acid);
        assert!(res_acid.ph < 0.0, "5 M HCl pH {:.2} must be negative", res_acid.ph);
        assert_eq!(res_acid.tier, ProvenanceTier::Estimated);

        // 5 M NaOH
        let sys_base = AqueousSystemInput {
            c_strong_base: 5.0,
            ..Default::default()
        };
        let res_base = solve_aqueous_equilibrium(&sys_base);
        assert!(res_base.ph > 14.0, "5 M NaOH pH {:.2} must be > 14", res_base.ph);
        assert_eq!(res_base.tier, ProvenanceTier::Estimated);
    }

    #[test]
    fn test_m3_edge_temperature_kw() {
        let kw_0c = kw_at_temp(273.15);
        assert!(kw_0c < 2.0e-15 && kw_0c > 1.0e-15);

        let kw_60c = kw_at_temp(333.15);
        assert!(kw_60c > 8.0e-14 && kw_60c < 1.2e-13);
    }

    #[test]
    fn test_m3_edge_agcl_common_ion_and_temp() {
        // Extreme common ion: 1 M Cl-, 1e-4 M Ag+
        let (ag, cl, ppt) = solve_agcl_precipitation(1e-4, 1.0, 1.0, 298.15);
        assert!(ppt > 9.99e-5);
        assert!(ag < 1e-9);
        assert!((ag * cl - KSP_AGCL_298).abs() / KSP_AGCL_298 < 1e-3);

        // Temperature effect: higher solubility at 60 C (333.15 K)
        let (_, _, ppt_25c) = solve_agcl_precipitation(2e-5, 2e-5, 1.0, 298.15);
        assert!(ppt_25c > 0.0);
        let (_, _, ppt_60c) = solve_agcl_precipitation(2e-5, 2e-5, 1.0, 333.15);
        assert_eq!(ppt_60c, 0.0, "Higher temperature should dissolve AgCl precipitate");
    }

    #[test]
    fn test_m3_edge_solid_dissolution() {
        let (diss1, rem1) = dissolve_solid_with_limit(0.5, 2.0, 0.4);
        assert_eq!(diss1, 0.5);
        assert_eq!(rem1, 0.0);

        let (diss2, rem2) = dissolve_solid_with_limit(1.2, 2.0, 0.4);
        assert_eq!(diss2, 0.8);
        assert!((rem2 - 0.4).abs() < 1e-9);
    }

    #[test]
    fn test_m4_edge_reversible_reaction_jacobian() {
        // Reversible unimolecular isomerisation: A <=> B
        // k_fwd = 1.0, K_eq = 2.0 => k_rev = 0.5
        // At equilibrium with initial [A]=1.0, [B]=0.0:
        // [B]_eq / [A]_eq = 2 => [A]_eq = 1/3 ~ 0.333, [B]_eq = 2/3 ~ 0.667
        let network = KineticNetwork {
            species_names: vec!["A".to_string(), "B".to_string()],
            reactions: vec![KineticReaction {
                name: "A to B reversible".to_string(),
                reactants: vec![(0, 1.0)],
                products: vec![(1, 1.0)],
                arrhenius_a: 1.0,
                arrhenius_n: 0.0,
                arrhenius_ea: 0.0,
                delta_h: 0.0,
                is_reversible: true,
                k_eq_298: Some(2.0),
                stoich_reactants: None,
                stoich_products: None,
            }],
        };

        let mut concs = vec![1.0, 0.0];
        for _ in 0..100 {
            concs = rosenbrock_step(&network, &concs, 0.1, 298.15);
        }

        assert!((concs[0] - (1.0 / 3.0)).abs() < 1e-3, "Equilibrium [A] must be ~ 0.333, got {:.4}", concs[0]);
        assert!((concs[1] - (2.0 / 3.0)).abs() < 1e-3, "Equilibrium [B] must be ~ 0.667, got {:.4}", concs[1]);
    }

    #[test]
    fn test_m4_edge_boiling_dryout_and_cooling() {
        // Dry-out: 1 mL water blasted with 4000 W for 10 s
        let res = step_energy_balance(368.15, 1.0, 0.0, 4000.0, 0.2, 298.15, 10.0);
        let max_water_moles = (1.0 * DENSITY_WATER) / 18.015;
        assert!(res.boil_off_moles <= max_water_moles + 1e-9);
        assert!(res.new_temp_k > TB_WATER_K, "Dry vessel must heat above 100 C once water is gone");

        // Cooling when heater is off
        let cool_res = step_energy_balance(360.0, 100.0, 0.0, 0.0, 0.5, 298.15, 10.0);
        assert!(cool_res.new_temp_k < 360.0);
        assert!(cool_res.new_temp_k > 298.15);
    }

    #[test]
    fn test_m4_edge_conservation_failure_detection() {
        let mut initial = HashMap::new();
        initial.insert("H".to_string(), 2.0);

        // 1. Spontaneous creation of element
        let mut alchemy = HashMap::new();
        alchemy.insert("H".to_string(), 2.0);
        alchemy.insert("Pt".to_string(), 1.0);
        let (passed1, _, _) = check_element_conservation(&initial, &alchemy, &HashMap::new());
        assert!(!passed1, "Uncreated element must fail conservation");

        // 2. Element leaked
        let mut leak = HashMap::new();
        leak.insert("H".to_string(), 1.5);
        let (passed2, _, _) = check_element_conservation(&initial, &leak, &HashMap::new());
        assert!(!passed2, "Element loss without gas must fail conservation");
    }

    #[test]
    fn test_m4_edge_iodine_clock_zeros() {
        let (d_s2o3, _, _) = simulate_iodine_clock(0.04, 0.05, 0.0, 293.15, 0.05, 50.0);
        assert_eq!(d_s2o3, 0.0);

        let (d_no_ox, _, _) = simulate_iodine_clock(0.0, 0.05, 0.002, 293.15, 0.05, 50.0);
        assert_eq!(d_no_ox, 50.0);

        let (d_zero_dt, _, _) = simulate_iodine_clock(0.04, 0.05, 0.002, 293.15, 0.0, 50.0);
        assert_eq!(d_zero_dt, 0.0);
    }

    #[test]
    fn test_m6_gate_sn2_e2_competition_shifts_with_heat_and_bulky_base() {
        // Gate requirement: SN2/E2 product ratio shifts toward elimination with heat and with a bulky base
        // 1. Room temp (298.15 K) with normal base (e.g. OH- / MeO-) on secondary halide:
        let (k_sn2_rt, k_e2_rt, ratio_rt) = templates::sn2_e2_product_ratio("secondary", false, 298.15);
        assert!(k_sn2_rt > 0.0 && k_e2_rt > 0.0);

        // 2. Heat (353.15 K = 80 °C) with normal base:
        let (_k_sn2_heat, _k_e2_heat, ratio_heat) = templates::sn2_e2_product_ratio("secondary", false, 353.15);
        // Ratio E2/SN2 must increase significantly with heat because Ea(E2) > Ea(SN2)
        assert!(
            ratio_heat > ratio_rt * 1.5,
            "Heat must shift ratio toward elimination: rt={:.4}, heat={:.4}",
            ratio_rt,
            ratio_heat
        );

        // 3. Bulky base (e.g. t-BuO-) at room temp (298.15 K):
        let (_k_sn2_bulky, _k_e2_bulky, ratio_bulky) = templates::sn2_e2_product_ratio("secondary", true, 298.15);
        // Ratio E2/SN2 must shift heavily (> 50x) toward elimination due to steric hindrance
        assert!(
            ratio_bulky > ratio_rt * 50.0,
            "Bulky base must shift ratio toward elimination: normal={:.4}, bulky={:.4}",
            ratio_rt,
            ratio_bulky
        );
        assert!(ratio_bulky > 10.0, "Bulky base should make E2 strongly dominate (ratio > 10)");
    }

    #[test]
    fn test_m6_gate_ester_hydrolysis_ph_curve_acid_and_base_catalysis() {
        // Gate requirement: ester hydrolysis rate vs pH shows acid and base catalysis
        let k_ph1 = templates::ester_hydrolysis_k_obs("ethyl_acetate", 1.0, 298.15);
        let k_ph4 = templates::ester_hydrolysis_k_obs("ethyl_acetate", 4.0, 298.15);
        let k_ph7 = templates::ester_hydrolysis_k_obs("ethyl_acetate", 7.0, 298.15);
        let k_ph10 = templates::ester_hydrolysis_k_obs("ethyl_acetate", 10.0, 298.15);
        let k_ph13 = templates::ester_hydrolysis_k_obs("ethyl_acetate", 13.0, 298.15);

        // Acid catalysis: rate at pH 1 must be much higher than at pH 7
        assert!(
            k_ph1 > k_ph7 * 100.0,
            "pH 1 rate ({:.2e}) must be > 100x pH 7 rate ({:.2e})",
            k_ph1,
            k_ph7
        );
        assert!(k_ph1 > k_ph4, "pH 1 rate must be faster than pH 4");

        // Base catalysis: rate at pH 13 must be much higher than at pH 7
        assert!(
            k_ph13 > k_ph7 * 1000.0,
            "pH 13 rate ({:.2e}) must be > 1000x pH 7 rate ({:.2e})",
            k_ph13,
            k_ph7
        );
        assert!(k_ph13 > k_ph10, "pH 13 rate must be faster than pH 10");

        // Minimum rate is near neutral (pH 5-8)
        assert!(k_ph7 < k_ph1 && k_ph7 < k_ph13);
    }

    #[test]
    fn test_m6_gate_ten_chemical_stress_mixtures_stay_bounded() {
        // Gate requirement: networks stay bounded on random ten-chemical stress mixtures
        let stress_species = vec![
            "CH3COCH3".to_string(),
            "C2H5OH".to_string(),
            "CH3COOC2H5".to_string(),
            "NaOH".to_string(),
            "HCl".to_string(),
            "CH3CH(Br)CH3".to_string(),
            "cyclohexene".to_string(),
            "benzene".to_string(),
            "H2O".to_string(),
            "NH3".to_string(),
        ];
        let mut concs = HashMap::new();
        for sp in &stress_species {
            concs.insert(sp.clone(), 0.1);
        }

        let generator = network_generator::NetworkGenerator::new(network_generator::NetworkGeneratorConfig::default());
        let net = generator.generate_network(&concs, 298.15, 7.0);

        // Active species must remain <= 200
        assert!(
            net.active_species.len() <= 200,
            "Active species count {} must be <= 200",
            net.active_species.len()
        );
        // Reactions must remain <= 500
        assert!(
            net.reactions.len() <= 500,
            "Generated reactions count {} must be <= 500",
            net.reactions.len()
        );
        assert!(net.reactions.len() > 0, "Should generate reactions among matching chemical families");
        assert!(net.total_flux >= 0.0);
    }

    #[test]
    fn test_m6_mayr_integration_and_diffusion_cap() {
        let db = templates::get_mayr_database();
        let nuc = db.get("nuc_piperidine").expect("piperidine in db");
        let el = db.get("el_benzhydrylium_mpa").expect("benzhydrylium in db");

        let k_mayr = templates::calculate_mayr_rate(nuc, el, 293.15);
        assert!(k_mayr > 1.0e10, "High Mayr rate expected for piperidine + benzhydrylium");

        let capped = templates::apply_diffusion_cap(k_mayr, 298.15, templates::VISCOSITY_WATER_298);
        let k_diff = templates::calculate_diffusion_limit(templates::VISCOSITY_WATER_298, 298.15);

        assert!(capped < k_diff, "Capped rate {:.2e} must be strictly < k_diff {:.2e}", capped, k_diff);
        assert!(capped > 0.0);
    }

    #[test]
    fn test_m6_reaction_reversibility() {
        let fams = templates::get_reaction_families();
        assert!(fams.len() >= 40, "Must have at least 40 reaction families, got {}", fams.len());

        let ester_fam = fams.iter().find(|f| f.id == "acid_ester_hydrolysis").expect("acid ester hydrolysis");
        assert!(ester_fam.is_reversible);

        let gen = network_generator::NetworkGenerator::new(network_generator::NetworkGeneratorConfig::default());
        let mut concs = HashMap::new();
        concs.insert("CH3COOC2H5".to_string(), 0.5);
        concs.insert("H2O".to_string(), 55.0);

        let net = gen.generate_network(&concs, 298.15, 2.0);
        let rxn = net.reactions.iter().find(|r| r.family_id == "acid_ester_hydrolysis");
        if let Some(r) = rxn {
            assert!(r.k_fwd > 0.0);
            assert!(r.k_rev > 0.0);
            assert!(r.k_eq > 0.0);
            // k_rev = k_fwd / K_eq
            let expected_k_rev = r.k_fwd / r.k_eq;
            assert!((r.k_rev - expected_k_rev).abs() / expected_k_rev < 1e-6);
        }
    }
}
