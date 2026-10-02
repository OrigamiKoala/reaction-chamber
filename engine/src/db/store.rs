use std::collections::{HashMap, HashSet};
use std::sync::{Arc, OnceLock, RwLock};
use crate::db::record::SpeciesRecord;
use crate::db::seed::seed_species;

static GLOBAL_STORE: OnceLock<Arc<RwLock<SpeciesStore>>> = OnceLock::new();

#[derive(Clone, Debug)]
pub struct SpeciesStore {
    records: HashMap<String, SpeciesRecord>,
    by_inchikey: HashMap<String, String>,
    by_formula: HashMap<String, Vec<String>>,
    by_element: HashMap<String, HashSet<String>>,
}

impl Default for SpeciesStore {
    fn default() -> Self {
        let mut store = Self {
            records: HashMap::new(),
            by_inchikey: HashMap::new(),
            by_formula: HashMap::new(),
            by_element: HashMap::new(),
        };
        for rec in seed_species() {
            store.register(rec);
        }
        store
    }
}

impl SpeciesStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn global() -> Arc<RwLock<SpeciesStore>> {
        GLOBAL_STORE.get_or_init(|| Arc::new(RwLock::new(SpeciesStore::default()))).clone()
    }

    pub fn register(&mut self, record: SpeciesRecord) {
        let id = record.id.clone();
        if let Some(ref ik) = record.identity.inchikey {
            self.by_inchikey.insert(ik.clone(), id.clone());
        }
        let formula = record.identity.formula.clone();
        self.by_formula.entry(formula.clone()).or_default().push(id.clone());

        for elem in record.elements().keys() {
            self.by_element.entry(elem.clone()).or_default().insert(id.clone());
        }

        self.records.insert(id, record);
    }

    pub fn iter(&self) -> impl Iterator<Item = &SpeciesRecord> {
        self.records.values()
    }

    pub fn get(&self, id: &str) -> Option<&SpeciesRecord> {
        self.records.get(id)
    }

    pub fn get_by_inchikey(&self, inchi_key: &str) -> Option<&SpeciesRecord> {
        self.by_inchikey.get(inchi_key).and_then(|id| self.records.get(id))
    }

    pub fn get_by_formula(&self, formula: &str) -> Vec<&SpeciesRecord> {
        self.by_formula
            .get(formula)
            .map(|ids| ids.iter().filter_map(|id| self.records.get(id)).collect())
            .unwrap_or_default()
    }

    pub fn find_candidates_by_elements(&self, elements: &HashSet<String>) -> Vec<&SpeciesRecord> {
        self.records
            .values()
            .filter(|rec| {
                let rec_elems = rec.elements();
                !rec_elems.is_empty() && rec_elems.keys().all(|e| elements.contains(e))
            })
            .collect()
    }

    pub fn load_database_json(&mut self, json_str: &str) -> Result<usize, String> {
        let list: Vec<SpeciesRecord> = serde_json::from_str(json_str)
            .map_err(|e| format!("Invalid species records JSON: {}", e))?;
        let count = list.len();
        for rec in list {
            self.register(rec);
        }
        Ok(count)
    }

    pub fn len(&self) -> usize {
        self.records.len()
    }

    pub fn is_empty(&self) -> bool {
        self.records.is_empty()
    }
}
