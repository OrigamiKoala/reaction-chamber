use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, OnceLock, RwLock};
use crate::db::record::SpeciesRecord;
use crate::db::seed::seed_species;

static GLOBAL_STORE: OnceLock<Arc<RwLock<SpeciesStore>>> = OnceLock::new();
/// Bumped on every registration: caches derived from store contents (UNIFAC groups, gas partners, volatile data) key on it.
static GENERATION: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Debug)]
pub struct SpeciesStore {
    records: HashMap<String, SpeciesRecord>,
    by_inchikey: HashMap<String, Vec<String>>,
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

    pub fn try_global() -> Option<Arc<RwLock<SpeciesStore>>> {
        GLOBAL_STORE.get().cloned()
    }

    /// Current registration generation (changes whenever any store registers a record).
    pub fn generation() -> u64 {
        GENERATION.load(Ordering::Relaxed)
    }

    pub fn register(&mut self, record: SpeciesRecord) {
        GENERATION.fetch_add(1, Ordering::Relaxed);
        let id = record.id.clone();
        // a record id is registered once (re-registering replaces the record, never duplicates the index entries)
        if let Some(old) = self.records.get(&id) {
            if let Some(ref ik) = old.identity.inchikey {
                if let Some(v) = self.by_inchikey.get_mut(ik) {
                    v.retain(|x| x != &id);
                }
            }
            if let Some(v) = self.by_formula.get_mut(&old.identity.formula) {
                v.retain(|x| x != &id);
            }
        }
        if let Some(ref ik) = record.identity.inchikey {
            self.by_inchikey.entry(ik.clone()).or_default().push(id.clone());
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

    /// Most recently registered record under this InChIKey (a molecule can have one record per phase id: "H2O", "H2O(g)").
    pub fn get_by_inchikey(&self, inchi_key: &str) -> Option<&SpeciesRecord> {
        self.by_inchikey.get(inchi_key).and_then(|ids| ids.last()).and_then(|id| self.records.get(id))
    }

    /// Every record that shares this InChIKey (the same molecule in its different phases).
    pub fn all_by_inchikey(&self, inchi_key: &str) -> Vec<&SpeciesRecord> {
        self.by_inchikey
            .get(inchi_key)
            .map(|ids| ids.iter().filter_map(|id| self.records.get(id)).collect())
            .unwrap_or_default()
    }

    /// The record of the same molecule that carries a gas phase (`CO2(aq)` -> `CO2(g)`, `H2O` -> `H2O(g)`), found
    /// by InChIKey; None when the record has no key or no gas-phase twin exists.
    pub fn gas_partner(&self, rec: &SpeciesRecord) -> Option<&SpeciesRecord> {
        let ik = rec.identity.inchikey.as_ref()?;
        self.all_by_inchikey(ik).into_iter().find(|r| r.id != rec.id && r.has_phase("g"))
    }

    /// A record by one of its names (case-insensitive); the first match.
    pub fn get_by_name(&self, name: &str) -> Option<&SpeciesRecord> {
        let n = name.to_lowercase();
        self.records.values().find(|r| r.identity.names.iter().any(|x| x.to_lowercase() == n))
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
