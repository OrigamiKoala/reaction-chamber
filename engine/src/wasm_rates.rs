//! WASM interface of the rate store (`rate_store.rs`): the frontend registers the shipped rate table at startup.

use wasm_bindgen::prelude::*;

use crate::rate_store;

/// Registers stored rates (JSON array of `rate_store::RateEntry`). Vessels pick them up on their next step. Returns
/// how many entries were added or changed.
#[wasm_bindgen]
pub fn register_reaction_rates(entries_json: &str) -> Result<usize, JsValue> {
    let entries: Vec<rate_store::RateEntry> =
        serde_json::from_str(entries_json).map_err(|e| JsValue::from_str(&format!("Invalid rate entries: {}", e)))?;
    Ok(rate_store::register(entries))
}

/// Number of stored rates.
#[wasm_bindgen]
pub fn rate_store_size() -> usize {
    rate_store::len()
}
