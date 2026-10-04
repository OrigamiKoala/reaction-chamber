//! Physical form of a dosed solid (`data/solid_forms.json`): the grain size the particle population starts with and whether
//! the solid stays a set of separate pieces. The chemistry (dissolution rate, surface area) follows from the population; the
//! renderer reads the morphology from the snapshot instead of guessing it from the formula.

use std::collections::HashMap;
use std::sync::OnceLock;

use serde::Deserialize;

#[derive(Deserialize)]
struct Form {
    diameter_um: f64,
    #[serde(default)]
    loose_pieces: bool,
}

#[derive(Deserialize)]
struct File {
    forms: HashMap<String, Form>,
}

fn table() -> &'static File {
    static T: OnceLock<File> = OnceLock::new();
    T.get_or_init(|| serde_json::from_str(include_str!("../data/solid_forms.json")).expect("data/solid_forms.json"))
}

/// Starting grain diameter (um) of a dosed solid in the named form: the reagent's own size when it gives one, else the
/// form's. None for a form the table does not know (the solid keeps its default grain).
pub fn form_diameter_um(form: &str, reagent_um: Option<f64>) -> Option<f64> {
    let f = table().forms.get(form)?;
    Some(reagent_um.filter(|u| *u > 0.0).unwrap_or(f.diameter_um))
}

/// Whether the form stays separate pieces (`pieces` morphology).
pub fn is_loose_pieces(form: &str) -> bool {
    table().forms.get(form).map_or(false, |f| f.loose_pieces)
}

/// The whole table as JSON (`{form: {diameter_um, loose_pieces}}`) for the front end, which needs to know which catalog
/// forms are separate pieces (a ribbon in a jar is poured as a piece) without keeping its own list.
pub fn table_json() -> String {
    let m: std::collections::BTreeMap<&String, serde_json::Value> =
        table().forms.iter().map(|(k, f)| (k, serde_json::json!({"diameter_um": f.diameter_um, "loose_pieces": f.loose_pieces}))).collect();
    serde_json::to_string(&m).unwrap_or_else(|_| "{}".to_string())
}
