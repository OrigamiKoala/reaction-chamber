//! Measured mutual solubilities of water and organic liquids (`data/solubility_points.json`, built by
//! `pipeline/db/build_solubility_points.py` from the NIST/TRC ThermoML Archive): activity points by InChIKey of the solute.
//! `molecule::resolve` turns each into a `GammaPoint` (ln gamma at the saturation mole fraction), which corrects the UNIFAC model
//! where it is far off (alkanes in water: UNIFAC is 30-50 times too soluble).

use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Clone, Debug, serde::Deserialize)]
pub struct TablePoint {
    pub solute: String,
    pub solvent: String,
    pub x: f64,
    #[serde(rename = "T_K")]
    pub t_k: f64,
    pub n_papers: u32,
    #[serde(rename = "dlnx_d_invT")]
    pub dlnx_d_invt: Option<f64>,
}

#[derive(serde::Deserialize)]
struct Entry {
    points: Vec<TablePoint>,
}

#[derive(serde::Deserialize)]
struct File {
    compounds: HashMap<String, Entry>,
}

fn table() -> &'static HashMap<String, Vec<TablePoint>> {
    static T: OnceLock<HashMap<String, Vec<TablePoint>>> = OnceLock::new();
    T.get_or_init(|| {
        let f: File = serde_json::from_str(include_str!("../data/solubility_points.json")).expect("data/solubility_points.json");
        let mut m: HashMap<String, Vec<TablePoint>> = HashMap::new();
        for e in f.compounds.into_values() {
            for p in e.points {
                m.entry(p.solute.clone()).or_default().push(p);
            }
        }
        m
    })
}

/// The measured saturation points of the compound with this InChIKey (as the solute).
pub fn points_for(inchikey: &str) -> &'static [TablePoint] {
    table().get(inchikey).map(|v| v.as_slice()).unwrap_or(&[])
}
