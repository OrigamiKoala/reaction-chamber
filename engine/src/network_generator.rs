//! M6/Stage 9 chemical reaction network generator.
//!
//! Structure-based generation from the molecular graphs of the species a vessel holds: the reaction templates of
//! `data/reaction_templates.json` (`reaction_templates.rs`) are matched against the species, their products are the
//! rewritten graphs, registered in the species store with group-additivity thermodynamics (Benson, else Joback), and every
//! candidate gets its rate from the template's structure-keyed rate rules. K is never a property of a template: it comes
//! from the formation data of the species (a candidate whose species lack data is irreversible).
//!
//! Expansion is rate-based in the manner of RMG: a candidate enters the network (the *core*) when its flux at the generation
//! conditions reaches the threshold; the candidates below it are kept as the *edge* (`GeneratedNetwork::edge`), which the
//! vessel re-evaluates as the contents change and promotes by regenerating when one of them gets fast.

use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};

use crate::reaction_templates::{self, Instance, Template};
use crate::smiles::{self, Molecule};
use crate::templates::{apply_diffusion_cap, Medium, R_IDEAL};
use crate::types::ProvenanceTier;

pub const DEFAULT_MAX_ACTIVE_SPECIES: usize = 200;
pub const DEFAULT_MAX_REACTIONS: usize = 500;
pub const DEFAULT_FLUX_THRESHOLD_ABS: f64 = 1.0e-11; // M/s
/// Candidates below the flux threshold kept as the edge of the network.
pub const MAX_EDGE_REACTIONS: usize = 400;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeneratedReaction {
    pub id: String,
    pub name: String,
    /// Id of the template (reaction family) that produced the reaction.
    pub family_id: String,
    pub equation: String,
    pub reactants: HashMap<String, f64>,
    pub products: HashMap<String, f64>,
    pub gas_products: HashMap<String, f64>,
    pub k_fwd: f64,
    pub k_rev: f64,
    pub arrhenius_a: f64,
    pub arrhenius_ea: f64,
    pub delta_h_kj: f64,
    pub delta_g_kj: f64,
    pub k_eq: f64,
    pub tier: ProvenanceTier,
    pub source: String,
    pub formation_flux: f64,
    /// Rate-law orders: every non-solvent reactant first order, plus the dissolved catalysts the reaction does not consume
    /// (H+ for acid catalysis, OH- for base catalysis); the solvent is zero order. `arrhenius_a` is per unit of these.
    pub orders: HashMap<String, f64>,
    /// Equilibrium constant at 298.15 K (concentration units, solids and solvent at unit activity); 0 when the species
    /// lack formation data (`k_eq_from_data` false): the reaction is then irreversible, not given an invented K.
    pub k_eq_298: f64,
    pub k_eq_from_data: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeneratedNetwork {
    pub active_species: Vec<String>,
    pub reactions: Vec<GeneratedReaction>,
    /// Candidates whose flux at the generation conditions was below the threshold, fastest first.
    pub edge: Vec<GeneratedReaction>,
    pub candidates_rejected: usize,
    pub cap_reached: bool,
    pub total_flux: f64,
}

#[derive(Clone, Debug)]
pub struct NetworkGeneratorConfig {
    pub max_active_species: usize,
    pub max_reactions: usize,
    pub flux_threshold_abs: f64,
    pub viscosity_pa_s: f64,
    pub precomputed_barriers: HashMap<String, f64>, // template id -> Delta G_ddagger (kcal/mol)
}

impl Default for NetworkGeneratorConfig {
    fn default() -> Self {
        Self {
            max_active_species: DEFAULT_MAX_ACTIVE_SPECIES,
            max_reactions: DEFAULT_MAX_REACTIONS,
            flux_threshold_abs: DEFAULT_FLUX_THRESHOLD_ABS,
            viscosity_pa_s: 8.9e-4,
            precomputed_barriers: HashMap::new(),
        }
    }
}

pub struct NetworkGenerator {
    pub config: NetworkGeneratorConfig,
}

/// Matches of every template slot in every species, computed once per generation.
struct MatchCache {
    mols: HashMap<String, Option<Molecule>>,
    matches: HashMap<(usize, usize, String), Vec<Vec<usize>>>,
}

impl MatchCache {
    fn mol(&mut self, sp: &str) -> Option<&Molecule> {
        self.mols.entry(sp.to_string()).or_insert_with(|| resolve_molecule(sp)).as_ref()
    }

    fn slot_matches(&mut self, t_idx: usize, t: &Template, slot: usize, sp: &str) -> Vec<Vec<usize>> {
        let key = (t_idx, slot, sp.to_string());
        if let Some(m) = self.matches.get(&key) {
            return m.clone();
        }
        let found = match self.mol(sp) {
            Some(m) => t.slot_matches(slot, m),
            None => Vec::new(),
        };
        self.matches.insert(key, found.clone());
        found
    }
}

impl NetworkGenerator {
    pub fn new(config: NetworkGeneratorConfig) -> Self {
        Self { config }
    }

    /// Generates the network for a water-based solution (`generate_network_in` with the solvent class "water").
    pub fn generate_network(&self, initial_concs: &HashMap<String, f64>, temp_k: f64, ph: f64) -> GeneratedNetwork {
        self.generate_network_in(initial_concs, temp_k, ph, "water")
    }

    /// Primary entrypoint: given the species and their concentrations (M), the live pH, the temperature (K) and the class of
    /// the solvent ("water", "alcohol", "alkane", "aromatic", "other"), generates the expanded, flux-filtered,
    /// thermodynamically reversible reaction network and the edge of candidates that were too slow.
    pub fn generate_network_in(&self, initial_concs: &HashMap<String, f64>, temp_k: f64, ph: f64, solvent_class: &str) -> GeneratedNetwork {
        let t = if temp_k <= 100.0 || temp_k.is_nan() { 298.15 } else { temp_k };
        let medium = Medium::from_solution(ph, t, initial_concs);
        let mut active_species_set: HashSet<String> = initial_concs.keys().cloned().collect();
        let mut species_concs = initial_concs.clone();
        // an ionic compound named by its formula ("NaOH", "HCl") reacts as the ions it dissolves into
        for (sp, &c) in initial_concs {
            if resolve_molecule(sp).is_some() {
                continue;
            }
            if let Some(split) = crate::ions::decompose_ionic(sp) {
                for ion in split.cations.iter().chain(split.anions.iter()) {
                    *species_concs.entry(ion.id.clone()).or_insert(0.0) += ion.n * c;
                    active_species_set.insert(ion.id.clone());
                }
            }
        }

        let mut generated: Vec<GeneratedReaction> = Vec::new();
        let mut edge: Vec<GeneratedReaction> = Vec::new();
        let mut seen: HashSet<String> = HashSet::new();
        let mut candidates_rejected = 0;
        let mut cap_reached = false;
        let mut total_flux = 0.0;
        let mut cache = MatchCache { mols: HashMap::new(), matches: HashMap::new() };
        let all_templates = reaction_templates::templates();

        // Iterative expansion queue (RMG rate-based expansion)
        let mut queue: Vec<String> = active_species_set.iter().cloned().collect();
        queue.sort();

        while let Some(current) = queue.pop() {
            if active_species_set.len() >= self.config.max_active_species || generated.len() >= self.config.max_reactions {
                cap_reached = true;
                break;
            }
            let mut partners: Vec<String> = active_species_set.iter().cloned().collect();
            partners.sort();

            // every instance of every template in which the current species takes a slot
            let mut candidates: Vec<GeneratedReaction> = Vec::new();
            for (ti, tpl) in all_templates.iter().enumerate() {
                for slot in 0..tpl.n_slots() {
                    let mine = cache.slot_matches(ti, tpl, slot, &current);
                    if mine.is_empty() {
                        continue;
                    }
                    match tpl.n_slots() {
                        1 => {
                            for m in &mine {
                                self.consider(tpl, &[&current], &[m], &mut cache, &species_concs, t, medium, solvent_class, &mut candidates);
                            }
                        }
                        2 => {
                            let other_slot = 1 - slot;
                            for partner in &partners {
                                let theirs = cache.slot_matches(ti, tpl, other_slot, partner);
                                for m in &mine {
                                    for o in &theirs {
                                        let (species, maps): ([&str; 2], [&Vec<usize>; 2]) = if slot == 0 {
                                            ([current.as_str(), partner.as_str()], [m, o])
                                        } else {
                                            ([partner.as_str(), current.as_str()], [o, m])
                                        };
                                        self.consider(tpl, &species, &maps, &mut cache, &species_concs, t, medium, solvent_class, &mut candidates);
                                    }
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }

            // several pathways of one reaction (the beta hydrogens of an E2, the two orientations of a symmetric alkene
            // addition) are one reaction with the pathways' rates added
            for cand in merge_pathways(candidates) {
                if seen.contains(&cand.id) {
                    continue;
                }
                let bal = crate::chem_db::check_balance(&cand.reactants, &cand.products, &cand.gas_products);
                if !bal.balanced {
                    continue;
                }
                let flux = rate_at(&cand, &species_concs);
                if flux >= self.config.flux_threshold_abs {
                    seen.insert(cand.id.clone());
                    total_flux += flux;
                    for prod in cand.products.keys() {
                        if !active_species_set.contains(prod) {
                            if active_species_set.len() < self.config.max_active_species {
                                active_species_set.insert(prod.clone());
                                species_concs.insert(prod.clone(), (flux * 0.1).max(1e-6));
                                queue.push(prod.clone());
                            } else {
                                cap_reached = true;
                            }
                        }
                    }
                    generated.push(GeneratedReaction { formation_flux: flux, ..cand });
                    if generated.len() >= self.config.max_reactions {
                        cap_reached = true;
                        break;
                    }
                } else {
                    candidates_rejected += 1;
                    if flux > 0.0 && !edge.iter().any(|e| e.id == cand.id) {
                        edge.push(GeneratedReaction { formation_flux: flux, ..cand });
                    }
                }
            }
        }

        // the edge: what did not make the core, fastest first, without what the core already holds
        let core_ids: HashSet<&String> = generated.iter().map(|r| &r.id).collect();
        edge.retain(|e| !core_ids.contains(&e.id));
        edge.sort_by(|a, b| b.formation_flux.partial_cmp(&a.formation_flux).unwrap_or(std::cmp::Ordering::Equal).then(a.id.cmp(&b.id)));
        edge.truncate(MAX_EDGE_REACTIONS);

        let mut active_list: Vec<String> = active_species_set.into_iter().collect();
        active_list.sort();
        GeneratedNetwork { active_species: active_list, reactions: generated, edge, candidates_rejected, cap_reached, total_flux }
    }

    /// Builds the reactions of one instance of a template (one per variant that has a rate rule) and pushes them.
    #[allow(clippy::too_many_arguments)]
    fn consider(
        &self,
        tpl: &Template,
        species: &[&str],
        maps: &[&Vec<usize>],
        cache: &mut MatchCache,
        concs: &HashMap<String, f64>,
        temp_k: f64,
        medium: Medium,
        solvent_class: &str,
        out: &mut Vec<GeneratedReaction>,
    ) {
        let mols: Vec<Molecule> = match species.iter().map(|s| cache.mol(s).cloned()).collect::<Option<Vec<_>>>() {
            Some(m) => m,
            None => return,
        };
        let inst = Instance { template: tpl, mols: mols.iter().collect(), maps: maps.to_vec() };
        let rates = tpl.rates(&inst, solvent_class);
        if rates.is_empty() {
            return;
        }
        let Some(product_mols) = tpl.products(&inst) else { return };
        let mut products: HashMap<String, f64> = HashMap::new();
        for pm in &product_mols {
            *products.entry(register_or_find_species(pm)).or_insert(0.0) += 1.0;
        }
        let mut reactants: HashMap<String, f64> = HashMap::new();
        for s in species {
            *reactants.entry(s.to_string()).or_insert(0.0) += 1.0;
        }
        // species that appear on both sides are spectators of the step
        for sp in reactants.keys().cloned().collect::<Vec<_>>() {
            if let (Some(r), Some(p)) = (reactants.get(&sp).copied(), products.get(&sp).copied()) {
                let common = r.min(p);
                if r - common < 1e-9 { reactants.remove(&sp); } else { reactants.insert(sp.clone(), r - common); }
                if p - common < 1e-9 { products.remove(&sp); } else { products.insert(sp, p - common); }
            }
        }
        let thermo = reaction_k_298(&reactants, &products);
        let centre = tpl.centre_key(&inst);
        let reactant_ids = species.join("+");
        for rate in rates {
            let variant = &tpl.variants[rate.variant];
            // an Evans-Polanyi rule completes its activation energy with the reaction enthalpy of the species data
            let ea_j = match (rate.ea_j, rate.ep, thermo) {
                (Some(e), _, _) => e,
                (None, Some((e0, alpha)), Some((_, dh_kj))) => (e0 + alpha * dh_kj * 1000.0).max(dh_kj.max(0.0) * 1000.0).max(0.0),
                _ => continue,
            };
            let tag = if variant.tag.is_empty() { String::new() } else { format!("_{}", variant.tag) };
            out.push(self.build(
                format!("{}{}_{}_{}", tpl.id, tag, reactant_ids, centre),
                format!("{} ({})", tpl.name, reactant_ids),
                &tpl.id,
                reactants.clone(),
                products.clone(),
                &variant.catalysts,
                rate.a,
                ea_j,
                thermo,
                temp_k,
                medium,
                concs,
                &format!("Reaction template {} / rule '{}': {}", tpl.id, rate.rule, rate.source),
            ));
        }
    }

    /// Builds one generated reaction: Arrhenius rate of the matching rule (overridden by a precomputed barrier when the
    /// flywheel has one), diffusion ceiling for bimolecular steps, dissolved-catalyst concentrations folded into `k_fwd` at
    /// the generation conditions (the vessel re-evaluates them every tick through `orders`), and K from the species'
    /// formation data when all of them have it (else the reaction is irreversible).
    #[allow(clippy::too_many_arguments)]
    fn build(
        &self,
        id: String,
        name: String,
        family_id: &str,
        reactants: HashMap<String, f64>,
        products: HashMap<String, f64>,
        catalysts: &[(String, f64)],
        mut arr_a: f64,
        mut arr_ea: f64,
        thermo: Option<(f64, f64)>,
        temp_k: f64,
        medium: Medium,
        concs: &HashMap<String, f64>,
        source: &str,
    ) -> GeneratedReaction {
        if let Some(&dg_kcal) = self.config.precomputed_barriers.get(family_id) {
            arr_ea = dg_kcal * 4184.0;
            arr_a = 1.0e11;
        }
        let k_arr = arr_a * (-arr_ea / (R_IDEAL * temp_k)).clamp(-700.0, 700.0).exp();
        let mut orders: HashMap<String, f64> = HashMap::new();
        for sp in reactants.keys() {
            orders.insert(sp.clone(), if sp == crate::vessel::AQUEOUS_SOLVENT { 0.0 } else { 1.0 });
        }
        let mut cat_factor = 1.0;
        for (cat, ord) in catalysts {
            orders.insert(cat.clone(), *ord);
            let c = match cat.as_str() {
                crate::db::seed::PROTON => medium.h_conc,
                crate::db::seed::HYDROXIDE => medium.oh_conc,
                other => concs.get(other).copied().unwrap_or(0.0),
            };
            cat_factor *= c.max(0.0).powf(*ord);
        }
        // the encounter limit bounds a bimolecular step; an empirical law of other order has a constant in other units
        let total_order: f64 = orders.values().sum();
        let k_cap = if (1.8..=2.2).contains(&total_order) { apply_diffusion_cap(k_arr, temp_k, self.config.viscosity_pa_s) } else { k_arr };
        let k_fwd = k_cap * cat_factor;

        let (k_eq_298, dh_kj, from_data) = match thermo {
            Some((k, dh)) => (k, dh, true),
            None => (0.0, 0.0, false),
        };
        let (k_eq, delta_g_kj) = if from_data {
            // K at the generation temperature by van 't Hoff
            let ln_k_t = k_eq_298.ln() - dh_kj * 1000.0 / R_IDEAL * (1.0 / temp_k - 1.0 / 298.15);
            (ln_k_t.clamp(-690.0, 690.0).exp(), -R_IDEAL * temp_k * ln_k_t / 1000.0)
        } else {
            (0.0, 0.0)
        };
        let mut r_names: Vec<&String> = reactants.keys().collect();
        r_names.sort();
        let mut p_names: Vec<&String> = products.keys().collect();
        p_names.sort();
        let equation = format!(
            "{} <=> {}",
            r_names.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(" + "),
            p_names.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(" + ")
        );
        GeneratedReaction {
            id,
            name,
            family_id: family_id.to_string(),
            equation,
            reactants,
            products,
            gas_products: HashMap::new(),
            k_fwd,
            k_rev: if k_eq > 0.0 { k_fwd / k_eq } else { 0.0 },
            arrhenius_a: arr_a,
            arrhenius_ea: arr_ea,
            delta_h_kj: dh_kj,
            delta_g_kj,
            k_eq,
            tier: ProvenanceTier::Estimated,
            source: format!("{}; K from {}", source, if from_data { "species formation data" } else { "nothing (species lack formation data): irreversible" }),
            formation_flux: 0.0,
            orders,
            k_eq_298,
            k_eq_from_data: from_data,
        }
    }
}

/// Adds the pathways of one reaction (same template variant, reactants, products and activation energy): the rate is the
/// sum, so the pre-exponential factors add. The reaction takes the smallest id of the pathways.
fn merge_pathways(candidates: Vec<GeneratedReaction>) -> Vec<GeneratedReaction> {
    let mut out: Vec<GeneratedReaction> = Vec::new();
    for c in candidates {
        let key = |r: &GeneratedReaction| {
            let sorted = |m: &HashMap<String, f64>| {
                let mut v: Vec<String> = m.iter().map(|(k, n)| format!("{}:{}", k, n)).collect();
                v.sort();
                v.join(",")
            };
            let mut cat: Vec<String> = r.orders.iter().filter(|(k, _)| !r.reactants.contains_key(*k)).map(|(k, o)| format!("{}^{}", k, o)).collect();
            cat.sort();
            format!("{}|{}|{}|{}|{:.1}", r.family_id, sorted(&r.reactants), sorted(&r.products), cat.join(","), r.arrhenius_ea)
        };
        match out.iter_mut().find(|o| key(o) == key(&c)) {
            Some(o) => {
                o.k_fwd += c.k_fwd;
                o.arrhenius_a += c.arrhenius_a;
                if c.id < o.id {
                    o.id = c.id;
                }
            }
            None => out.push(c),
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    out
}

/// Rate of a candidate (M/s) at the generation concentrations: `k_fwd` already holds the catalysts, so only the consumed,
/// non-solvent reactants count.
fn rate_at(r: &GeneratedReaction, concs: &HashMap<String, f64>) -> f64 {
    let mut rate = r.k_fwd;
    for (sp, &ord) in &r.orders {
        if r.reactants.contains_key(sp) && ord > 0.0 {
            rate *= concs.get(sp).copied().unwrap_or(0.0).max(0.0).powf(ord);
        }
    }
    rate
}

impl GeneratedReaction {
    /// Rate (M/s) of the reaction in a solution with the given concentrations (mol/L) at `temp_k`, from its Arrhenius
    /// parameters and rate-law orders (catalysts included): the quantity the vessel's kinetics evaluates every step. Used to
    /// re-evaluate the edge of the network.
    pub fn rate_in(&self, concs: &HashMap<String, f64>, temp_k: f64) -> f64 {
        let mut rate = self.arrhenius_a * (-self.arrhenius_ea / (R_IDEAL * temp_k.max(100.0))).clamp(-700.0, 700.0).exp();
        for (sp, &ord) in &self.orders {
            if ord > 0.0 {
                rate *= concs.get(sp).copied().unwrap_or(0.0).max(0.0).powf(ord);
            }
        }
        rate
    }
}

/// K at 298.15 K and the reaction enthalpy (kJ/mol) from the species' formation data, or None when any species lacks it.
fn reaction_k_298(reactants: &HashMap<String, f64>, products: &HashMap<String, f64>) -> Option<(f64, f64)> {
    use crate::thermo::functions::{phase_of_id, try_ln_k_equilibrium, try_thermo_state};
    let ln_k = try_ln_k_equilibrium(reactants, products, 298.15, 1.0e5)?;
    let mut dh = 0.0;
    for (sign, side) in [(1.0, products), (-1.0, reactants)] {
        for (sp, &c) in side {
            let st = try_thermo_state(sp, phase_of_id(sp), 298.15, 1.0e5)?;
            dh += sign * c * st.h_j_mol / 1000.0;
        }
    }
    Some((ln_k.clamp(-690.0, 690.0).exp(), dh))
}

// ==============================================================================================
// Structure Resolution & Registration
// ==============================================================================================

/// Resolves a species string to a molecular graph.
pub fn resolve_molecule(species: &str) -> Option<Molecule> {
    if let Some(m) = smiles::parse(species) {
        if !m.atoms.is_empty() {
            return Some(m);
        }
    }
    if let Ok(store) = crate::db::SpeciesStore::global().read() {
        if let Some(rec) = store.get(species).or_else(|| store.get_by_name(species)) {
            if let Some(ref smi) = rec.identity.smiles {
                if let Some(m) = smiles::parse(smi) {
                    return Some(m);
                }
            }
        }
    }
    for cat in crate::chem_db::get_reagent_catalog() {
        if cat.id == species || cat.name.eq_ignore_ascii_case(species) {
            if let Some(m) = smiles::parse(&cat.formula) {
                return Some(m);
            }
        }
    }
    None
}

/// Isomer tag of a compound id (`C5H12O#3F9A1C07`): 8 hex digits of the FNV-1a hash of the SMILES. Stripping the brackets
/// of the SMILES instead made `CCC(C)(C)O` and `CCCCCO` one id; the `#TAG` form is the one `ions.rs` and `volume.rs` already
/// read as "formula, then isomer".
fn isomer_tag(smiles: &str) -> String {
    let mut h: u32 = 0x811c_9dc5;
    for b in smiles.bytes() {
        h ^= b as u32;
        h = h.wrapping_mul(0x0100_0193);
    }
    format!("{:08X}", h)
}

/// Registers a generated product Molecule into SpeciesStore if not present.
/// Returns the canonical species id for this product.
pub fn register_or_find_species(mol: &Molecule) -> String {
    let formula = mol.formula();
    let smiles = mol.to_smiles();
    let net_charge = mol.atoms.iter().map(|a| a.charge).sum::<i32>();

    if let Ok(store) = crate::db::SpeciesStore::global().read() {
        for rec in store.iter() {
            if rec.identity.charge == net_charge && rec.identity.formula == formula {
                if let Some(ref s) = rec.identity.smiles {
                    if s == &smiles {
                        return rec.id.clone();
                    }
                    if let Some(rec_mol) = smiles::parse(s) {
                        if mol.is_isomorphic(&rec_mol) {
                            return rec.id.clone();
                        }
                    }
                }
            }
        }
    }

    let mut cand = formula.clone();
    if let Ok(store) = crate::db::SpeciesStore::global().read() {
        if let Some(existing) = store.get(&cand) {
            if existing.identity.smiles.as_deref() != Some(&smiles) {
                cand = format!("{}#{}", formula, isomer_tag(&smiles));
            }
        }
    }
    let id = cand;

    if let Ok(mut store) = crate::db::SpeciesStore::global().write() {
        if store.get(&id).is_none() {
            // Thermodynamics of a created compound: Benson group additivity for the ideal-gas enthalpy and entropy where
            // every atom is covered (about 1 kJ/mol), else Joback; Joback's normal boiling point and heat capacity in
            // both cases. The liquid reference state is derived from the gas (Trouton + Clausius-Clapeyron), tier
            // Estimated; the normal boiling point is stored as a labelled point on the vapour-pressure curve. A molecule
            // outside both methods (an ion, an uncovered atom) gets no thermodynamic data at all rather than an invented
            // value: reactions that need it then fall back to the template's own estimate, labelled as such.
            let mut phases = HashMap::new();
            let mut points = Vec::new();
            let joback = if net_charge == 0 { crate::joback::estimate(&mol.aromatized()).or_else(|| crate::joback::estimate(mol)) } else { None };
            let benson = if net_charge == 0 { crate::benson::estimate(mol) } else { None };
            let datum = |v: f64, unit: &str, src: &str| crate::db::record::Datum::new(v, unit, ProvenanceTier::Estimated, src);
            let thermo = |dfh: f64, dfg: f64, s_abs: Option<f64>, cp: f64, source: &str| crate::db::record::PhaseThermo {
                model: "point+cp".to_string(),
                tier: ProvenanceTier::Estimated,
                source: source.to_string(),
                dfH: Some(datum(dfh, "kJ/mol", source)),
                dfG: Some(datum(dfg, "kJ/mol", source)),
                S: s_abs.map(|v| datum(v, "J/(mol K)", source)),
                cp: Some(datum(cp, "J/(mol K)", source)),
                ranges: None,
                params: None,
            };
            let phase = |t: Option<crate::db::record::PhaseThermo>| crate::db::record::PhaseData { thermo: t, volume: None, rho: None, polymorph: None, specific_area: None };
            if let Some(j) = &joback {
                let cp = j.cp_gas(298.15);
                let (dh_g, dg_g, s_g, src_g) = match &benson {
                    Some(b) => (b.dhf_gas_kj, b.dgf_gas_kj, Some(b.s_gas), "Benson group additivity (ideal gas, 298.15 K)"),
                    None => (j.dhf_gas_kj, j.dgf_gas_kj, None, "Joback (ideal gas, 298.15 K)"),
                };
                let (dfh_l, dfg_l) = j.liquid_formation_from_gas_kj(dh_g, dg_g);
                phases.insert("g".to_string(), phase(Some(thermo(dh_g, dg_g, s_g, cp, src_g))));
                phases.insert("l".to_string(), phase(Some(thermo(dfh_l, dfg_l, None, cp, "gas-phase group additivity + Trouton + Clausius-Clapeyron (liquid, 298.15 K)"))));
                points.push(crate::db::record::CurvePoint {
                    kind: "psat".to_string(),
                    T_K: Some(j.tb_k),
                    P_Pa: Some(101_325.0),
                    solvent: None,
                    value: None,
                    unit: None,
                    tier: ProvenanceTier::Estimated,
                    source: "Joback normal boiling point".to_string(),
                    uncertainty: Some(25.0),
                });
            } else {
                phases.insert(if net_charge != 0 { "aq".to_string() } else { "l".to_string() }, phase(None));
            }

            store.register(crate::db::record::SpeciesRecord {
                id: id.clone(),
                identity: crate::db::record::Identity {
                    inchikey: None,
                    smiles: Some(smiles.clone()),
                    formula: formula.clone(),
                    charge: net_charge,
                    cas: None,
                    cid: None,
                    names: vec![id.clone(), formula.clone(), smiles.clone()],
                    db_names: HashMap::new(),
                },
                phases,
                critical: None,
                points,
                vapor_pressure: None,
                unifac_groups: None,
                acid_base: Vec::new(),
                redox: Vec::new(),
                optics: None,
                transport: None,
                kinetics_refs: Vec::new(),
                rejected: Vec::new(),
            });
        }
    }

    id
}

// ==============================================================================================
// Atom-Mapped Structural Transformations
