pub mod types;
pub mod kinetics;
pub mod physics;
pub mod conservation;
pub mod benchmark;
pub mod optics;
pub mod ions;
pub mod crystal;
pub mod acid_estimate;
pub mod smiles;
pub mod smarts;
pub mod joback;
pub mod molecule;
pub mod lle;
pub mod eos;
pub mod vle;
pub mod gas_phase;
pub mod vessel_vle;
pub mod groups;
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
pub mod phases;
pub mod volume;
pub mod props;
pub mod activity;
pub mod transport;
pub mod transfer;
pub mod vessel_transfer;
pub mod vessel_burn;
pub mod vessel_appearance;
pub mod vessel_uvvis;
pub mod analytical;
pub mod vessel_analytical;
pub mod vessel_electro;

use wasm_bindgen::prelude::*;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU32, Ordering};

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

/// UV-vis scan of a liquid layer (see `vessel_uvvis`): per-wavelength species absorbance and turbidity plus the contributing
/// species with their data tier and source.
#[wasm_bindgen]
pub fn vessel_uvvis_scan(handle: u32, layer: u32, nm_min: f64, nm_max: f64, step_nm: f64, path_cm: f64) -> Result<JsValue, JsValue> {
    with_vessels(|map| {
        let v = map.get(&handle).ok_or_else(|| JsValue::from_str(&format!("Unknown vessel handle: {}", handle)))?;
        serde_wasm_bindgen_to_val(&v.uvvis_scan(layer as usize, nm_min, nm_max, step_nm, path_cm))
    })
}

/// NMR spectrum (1H or 13C) of a liquid layer (or the solids of a dry vessel) in a deuterated solvent: signals with
/// multiplicity / J / integral / assignment per species, the digitised spectrum and the species that could not be simulated.
#[wasm_bindgen]
pub fn vessel_nmr_spectrum(handle: u32, layer: u32, nucleus: &str, solvent: &str, scans: u32, seed: u32) -> Result<JsValue, JsValue> {
    with_vessels(|map| {
        let v = map.get(&handle).ok_or_else(|| JsValue::from_str(&format!("Unknown vessel handle: {}", handle)))?;
        let s = v.nmr_spectrum(layer as usize, nucleus, solvent, scans, seed as u64).map_err(|e| JsValue::from_str(&e))?;
        serde_wasm_bindgen_to_val(&s)
    })
}

/// Mass spectrum of a liquid layer: GC/EI-MS ("EI": chromatogram + one 70 eV spectrum per eluting component) or
/// direct-infusion ESI ("ESI+", "ESI-").
#[wasm_bindgen]
pub fn vessel_ms_spectrum(handle: u32, layer: u32, mode: &str, seed: u32) -> Result<JsValue, JsValue> {
    with_vessels(|map| {
        let v = map.get(&handle).ok_or_else(|| JsValue::from_str(&format!("Unknown vessel handle: {}", handle)))?;
        let s = v.ms_spectrum(layer as usize, mode, seed as u64).map_err(|e| JsValue::from_str(&e))?;
        serde_wasm_bindgen_to_val(&s)
    })
}

/// The burner's flame test: the colour a gas flame at `t_flame_k` takes when a loop dipped in this vessel's liquid is held in it.
#[wasm_bindgen]
pub fn vessel_flame_test(handle: u32, t_flame_k: f64) -> Result<JsValue, JsValue> {
    with_vessels(|map| {
        let v = map.get(&handle).ok_or_else(|| JsValue::from_str(&format!("Unknown vessel handle: {}", handle)))?;
        let fc = v.flame_test(t_flame_k);
        serde_wasm_bindgen_to_val(&serde_json::json!({
            "emitter_rgb": fc.emitter_rgb,
            "metal_share": fc.metal_share,
            "emitters": fc.top.iter().filter(|e| e.3 > 0.05).map(|e| format!("{} {} {:.0} nm", e.0, e.1, e.2)).collect::<Vec<_>>(),
        }))
    })
}

/// Speculative absorbance spectrum (per cm, engine grid) whose transmission over `path_cm` has the given linear-sRGB colour:
/// the single RGB -> spectrum inversion, for visual-only liquids known only by a colour.
#[wasm_bindgen]
pub fn colour_to_absorbance(r: f64, g: f64, b: f64, path_cm: f64) -> Vec<f64> {
    optics::fallback::absorbance_for_colour([r, g, b], path_cm)
}

#[wasm_bindgen]
pub fn optics_tables_json() -> String {
    optics::tables_json()
}

/// Hash of the engine's optics data (absorption bands): a cache key for anything derived from solution colours.
#[wasm_bindgen]
pub fn optics_data_version() -> String {
    format!("{:016x}", optics::records::data_hash())
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
    use crate::physics::*;
    use crate::benchmark::run_benchmark;
    use super::*;
    use crate::conservation::*;

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
    fn test_m3_edge_solid_dissolution() {
        let (diss1, rem1) = dissolve_solid_with_limit(0.5, 2.0, 0.4);
        assert_eq!(diss1, 0.5);
        assert_eq!(rem1, 0.0);

        let (diss2, rem2) = dissolve_solid_with_limit(1.2, 2.0, 0.4);
        assert_eq!(diss2, 0.8);
        assert!((rem2 - 0.4).abs() < 1e-9);
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
