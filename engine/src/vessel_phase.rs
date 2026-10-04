//! Liquid phases, solid-liquid phase changes and the molecular species of a vessel (Stage 5).
//!
//! One mechanism replaces the separate "inert compound" melt plateau, the water-only dissolution cap, the ethanol layer and
//! the neat-liquid layers of the earlier engine:
//!
//! * **Molecules.** Every neutral species with an activity model (UNIFAC groups or measured activity points) is a
//!   `Molecule` (`molecule.rs`). Its amount in the liquid is one number per species: the vessel's liquid inventory is the
//!   primary phase `species_mol` (the water-containing phase, where the solution chemistry runs) plus `extra_liquids`
//!   (immiscible liquid phases). Which phases exist, and what each holds, is decided by `lle.rs`.
//! * **Solids.** A solid `X(s)` is in equilibrium with the liquid when the liquid-reference activity of X equals
//!   `exp(-dG_fus(T)/RT)` (Schroeder-van Laar): ice in cold water (colligative freezing-point depression falls out of the
//!   water activity), naphthalene in water or hexane (its solubility), a pure compound melting (a = 1). The solid-liquid
//!   state is solved at a temperature `T*` that conserves enthalpy with the heat of fusion (and of mixing), so heating
//!   or cooling shows plateaus without any per-compound code.
//! * **Sublimation** is the vapour pressure over the solid, `a_sat(T) P_sat(T)`, in the evaporation step.
//!
//! Dissolution, freezing and phase splitting are instantaneous equilibria; their rates belong to Stage 8.

use std::collections::{BTreeSet, HashMap, HashSet};
use std::sync::Arc;

use crate::chem_db;
use crate::compound_thermo::{CompoundThermo, P_ATM_PA};
use crate::db::SpeciesStore;
use crate::ions;
use crate::lle;
use crate::molecule::{self, IonEnv, Mixture, Molecule, SolidModel};
use crate::optics::{self, N_BINS};
use crate::types::ProvenanceTier;
use crate::physics::R_GAS;
use crate::vessel::*;

/// Specific heat assumed for an aqueous solute or species no record describes, J/(g K): dilute aqueous solutions are
/// water-like (estimator, labelled speculative where it is used).
const CP_UNKNOWN_J_G_K: f64 = 4.184;
/// Specific heat of an unknown solid, J/(g K) (Kopp / Dulong-Petit order of magnitude).
const CP_UNKNOWN_SOLID_J_G_K: f64 = 1.0;
/// Amounts below this (mol) are not phases.
const TINY_MOL: f64 = 1e-30;
const DUST_REL: f64 = 1e-12;

/// Memoised `Molecule` lookups (invalidated when the species store or the vessel's compound registry changes).
#[derive(Default)]
pub(crate) struct MolCache {
    generation: u64,
    map: HashMap<String, Option<Arc<Molecule>>>,
    /// Crystal volumes of salts by (cation, nu, anion, nu): looked up in the mineral registry once, not on every step.
    salt_volume: HashMap<(String, i32, String, i32), Option<f64>>,
    minerals_len: usize,
}

/// A readable form of an engine species id for the log: charges as superscripts ("Fe+3" -> "Fe³⁺"), digits of the formula as
/// subscripts, the phase tag dropped ("AgCl(s)" -> "AgCl").
pub fn prettify_species_id(sp: &str) -> String {
    let base = sp.trim_end_matches("(s)").trim_end_matches("(aq)").trim_end_matches("(g)").trim_end_matches("(l)");
    let (body, z) = ions::split_charge(base);
    let sub = |c: char| match c {
        '0'..='9' => char::from_u32('₀' as u32 + (c as u32 - '0' as u32)).unwrap_or(c),
        _ => c,
    };
    let sup = |c: char| match c {
        '0' => '⁰', '1' => '¹', '2' => '²', '3' => '³', '4' => '⁴', '5' => '⁵', '6' => '⁶', '7' => '⁷', '8' => '⁸', '9' => '⁹',
        '+' => '⁺', '-' => '⁻',
        _ => c,
    };
    let mut out = String::new();
    for c in body.chars() {
        out.push(sub(c));
    }
    if z != 0 {
        let mag = z.abs();
        let digits = if mag > 1 { mag.to_string() } else { String::new() };
        let sign = if z > 0 { '+' } else { '-' };
        for c in digits.chars().chain(std::iter::once(sign)) {
            out.push(sup(c));
        }
    }
    out
}

fn base_id(sp: &str) -> &str {
    sp.strip_suffix("(s)").or_else(|| sp.strip_suffix("(l)")).or_else(|| sp.strip_suffix("(g)")).or_else(|| sp.strip_suffix("(aq)")).unwrap_or(sp)
}

/// The optical state of one liquid phase (see `Vessel::phase_optics`).
pub(crate) struct PhaseOptics {
    pub a_per_cm: Vec<f64>,
    pub tier: ProvenanceTier,
    pub sources: Vec<String>,
    pub solvent: &'static str,
}

fn tier_rank(t: &ProvenanceTier) -> u8 {
    match t {
        ProvenanceTier::Tabulated | ProvenanceTier::Refined | ProvenanceTier::UserSet => 0,
        ProvenanceTier::Imported => 1,
        ProvenanceTier::Estimated => 2,
        ProvenanceTier::Speculative => 3,
    }
}

/// The weaker (less trusted) of two provenance tiers.
pub(crate) fn weaker(a: &ProvenanceTier, b: &ProvenanceTier) -> ProvenanceTier {
    if tier_rank(b) > tier_rank(a) {
        b.clone()
    } else {
        a.clone()
    }
}

/// One liquid phase as the snapshot sees it.
pub(crate) struct PhaseView {
    pub species_mol: HashMap<String, f64>,
    pub volume_ml: f64,
    pub mass_g: f64,
}

/// The state the phase-equilibrium solver returns for one temperature.
#[derive(Clone)]
struct Solved {
    n_liq: Vec<f64>,
    n_sol: Vec<f64>,
    lle: lle::LleResult,
}

impl Vessel {
    // ------------------------------------------------------------------------------------------------ registry
    pub fn register_compound(&mut self, c: CompoundThermo) {
        self.register_vle_compound(&c);
        self.compounds.insert(c.species.clone(), c);
        {
            let mut c = self.mol_cache.borrow_mut();
            c.map.clear();
            c.salt_volume.clear();
        }
    }

    /// The import record of a liquid-inventory or solid key.
    pub(crate) fn compound_for(&self, key: &str) -> Option<&CompoundThermo> {
        self.compounds.get(key).or_else(|| self.compounds.get(base_id(key)))
    }

    /// The molecule a liquid-inventory key stands for (None for ions, pseudo-species and anything the store does not know).
    pub(crate) fn molecule(&self, key: &str) -> Option<Arc<Molecule>> {
        let generation = SpeciesStore::generation();
        {
            let mut c = self.mol_cache.borrow_mut();
            if c.generation != generation {
                c.map.clear();
                c.salt_volume.clear();
                c.generation = generation;
            }
            if let Some(v) = c.map.get(key) {
                return v.clone();
            }
        }
        let m = if ions::species_charge(key) != 0 || key.ends_with("(s)") || key.ends_with("(g)") {
            None
        } else {
            molecule::resolve(key, self.compound_for(key)).map(Arc::new)
        };
        self.mol_cache.borrow_mut().map.insert(key.to_string(), m.clone());
        m
    }

    /// The liquid-inventory key of the molecule whose solid is `solid_key` ("I2(s)" -> "I2(aq)", "H2O(s)" -> "H2O").
    pub(crate) fn liquid_key_of_solid(&self, solid_key: &str) -> Option<String> {
        let base = base_id(solid_key);
        for cand in [base.to_string(), format!("{}(aq)", base)] {
            if let Some(m) = self.molecule(&cand) {
                if m.solid_key == solid_key {
                    return Some(cand);
                }
            }
        }
        None
    }

    /// Name shown for a species row.
    pub(crate) fn display_name(&self, sp: &str) -> String {
        if let Some(m) = self.molecule(sp) {
            if !m.name.is_empty() {
                return m.name.clone();
            }
        }
        if let Some(c) = self.compound_for(sp) {
            if !c.name.is_empty() {
                return c.name.clone();
            }
        }
        if sp.ends_with("(s)") {
            if let Some(k) = self.liquid_key_of_solid(sp) {
                if let Some(m) = self.molecule(&k) {
                    return m.name.clone();
                }
            }
        }
        // a mineral's registered name (resolved from PubChem when it formed), else a readable formula
        if let Some(m) = self.minerals.iter().find(|m| m.solid_species == sp) {
            if !m.mineral.is_empty() && m.mineral != m.formula {
                return m.mineral.clone();
            }
        }
        prettify_species_id(sp)
    }

    // ------------------------------------------------------------------------------------------------ liquid inventory
    /// Every liquid phase's amounts: the primary phase, then the immiscible ones.
    pub(crate) fn liquid_maps(&self) -> impl Iterator<Item = &HashMap<String, f64>> {
        std::iter::once(&self.species_mol).chain(self.extra_liquids.iter())
    }

    pub(crate) fn liquid_total(&self, key: &str) -> f64 {
        self.liquid_maps().map(|m| m.get(key).copied().unwrap_or(0.0)).sum()
    }

    /// Every liquid-inventory key with its total amount over the phases.
    pub(crate) fn liquid_totals(&self) -> HashMap<String, f64> {
        let mut out: HashMap<String, f64> = HashMap::new();
        for m in self.liquid_maps() {
            for (k, &v) in m {
                if v > 0.0 {
                    *out.entry(k.clone()).or_insert(0.0) += v;
                }
            }
        }
        out
    }

    /// Sets the total liquid amount of a key, spread over the phases that hold it in their current proportions (a key that
    /// no phase holds goes to the primary phase).
    pub(crate) fn set_liquid_total(&mut self, key: &str, total: f64) {
        let cur = self.liquid_total(key);
        let total = if total > TINY_MOL { total } else { 0.0 };
        if cur <= 0.0 {
            if total > 0.0 {
                self.species_mol.insert(key.to_string(), total);
            }
            return;
        }
        let f = total / cur;
        let mut all: Vec<&mut HashMap<String, f64>> = std::iter::once(&mut self.species_mol).chain(self.extra_liquids.iter_mut()).collect();
        for m in all.iter_mut() {
            if let Some(v) = m.get_mut(key) {
                *v *= f;
                if *v <= TINY_MOL {
                    m.remove(key);
                }
            }
        }
    }

    /// Removes `d` mol of a key from phase `phase` (never below zero).
    pub(crate) fn take_from_phase(&mut self, phase: usize, key: &str, d: f64) {
        let m = if phase == 0 { &mut self.species_mol } else { match self.extra_liquids.get_mut(phase - 1) { Some(m) => m, None => return } };
        if let Some(v) = m.get_mut(key) {
            *v = (*v - d).max(0.0);
            if *v <= TINY_MOL {
                m.remove(key);
            }
        }
    }

    // ------------------------------------------------------------------------------------------------ heat capacity
    /// Specific heat of a species in J/(g K), from its records: the molecule's liquid (or solid) heat capacity, an import's
    /// neat-phase value, else the aqueous-solute / solid estimators above.
    pub(crate) fn species_cp_j_g_k(&self, sp: &str) -> f64 {
        if sp.ends_with("(s)") {
            if let Some(k) = self.liquid_key_of_solid(sp) {
                if let Some(m) = self.molecule(&k) {
                    if let Some(cp) = m.cp_solid_j_mol_k {
                        return cp / m.mw;
                    }
                }
            }
            if let Some(c) = self.compound_for(sp) {
                if c.cp_j_g_k > 0.01 {
                    return c.cp_j_g_k;
                }
            }
            if let (Some(cp), Some(mw)) = (chem_db::species_cp_j_mol_k(sp), ions::species_mass(sp)) {
                return cp / mw;
            }
            return CP_UNKNOWN_SOLID_J_G_K;
        }
        if let Some(m) = self.molecule(sp) {
            if let Some(cp) = m.cp_liquid_j_mol_k {
                return cp / m.mw;
            }
        }
        if let Some(c) = self.compound_for(sp) {
            if c.cp_j_g_k > 0.01 {
                return c.cp_j_g_k;
            }
        }
        // dissolved ions and solutes: the standard partial molar heat capacity of the aqueous species record
        if let (Some(cp), Some(mw)) = (chem_db::species_cp_j_mol_k(sp), ions::species_mass(sp)) {
            return cp / mw;
        }
        CP_UNKNOWN_J_G_K
    }

    /// Heat capacity of the contents (J/K): every liquid phase and every solid. A dissolved ion carries its apparent molar
    /// heat capacity, the standard partial molar value plus the Debye-Hueckel-type concentration terms
    /// `Cp,phi = Cp0 + S_c sqrt(I) + b_c I` with `S_c = 14.5 |z|^1.5` and `b_c = 3.5 |z|^1.2` J mol^-1 K^-1 (molal I; an
    /// Estimated generic form that reproduces the heat capacity of strong brines to a few per cent).
    pub fn contents_heat_capacity(&self) -> f64 {
        let mut total = 0.0;
        let kg_w = self.species_mol.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0) * crate::volume::WATER_MW * 1e-3;
        let ionic = if kg_w > 1e-9 {
            0.5 * self.species_mol.iter().map(|(sp, &mol)| mol / kg_w * (ions::species_charge(sp) as f64).powi(2)).sum::<f64>()
        } else {
            0.0
        };
        for (pi, m) in self.liquid_maps().enumerate() {
            for (sp, &mol) in m {
                let mw = chem_db::get_species_thermo(sp).mw;
                let mut cp = self.species_cp_j_g_k(sp) * mw;
                let z = ions::species_charge(sp).abs() as f64;
                if pi == 0 && z > 0.0 && ionic > 0.0 {
                    cp += 14.5 * z.powf(1.5) * ionic.sqrt() + 3.5 * z.powf(1.2) * ionic;
                }
                total += cp * mol;
            }
        }
        for (sp, &mol) in &self.solid_mol {
            total += self.species_cp_j_g_k(sp) * mol * chem_db::get_species_thermo(sp).mw;
        }
        total
    }

    /// Specific heat (J/(g K)) of what a reagent adds: its composition's mass-weighted heat capacity.
    pub(crate) fn entry_cp_j_g_k(&self, entry: &chem_db::ReagentCatalogEntry) -> f64 {
        let mut m_tot = 0.0;
        let mut cp_tot = 0.0;
        for (sp, &n) in &entry.composition {
            let m = n * chem_db::get_species_thermo(sp).mw;
            m_tot += m;
            cp_tot += m * self.species_cp_j_g_k(sp);
        }
        if m_tot > 0.0 { cp_tot / m_tot } else { CP_UNKNOWN_J_G_K }
    }

    // ------------------------------------------------------------------------------------------------ volumes
    /// Volume (mL) of a liquid phase holding `map` at `t_k`: water from IAPWS, molecules from their liquid molar volume,
    /// ions and other solutes from their apparent molar volumes, plus the tabulated excess volume of the pairs that have it.
    pub(crate) fn phase_volume_ml(&self, map: &HashMap<String, f64>, t_k: f64) -> f64 {
        let mut ionic = 0.0;
        let kg = map.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0) * crate::volume::WATER_MW * 1e-3;
        if kg > 0.0 {
            for (sp, &mol) in map {
                let z = ions::species_charge(sp) as f64;
                if mol > 0.0 && z != 0.0 {
                    ionic += 0.5 * mol / kg * z * z;
                }
            }
        }
        let mut v = 0.0;
        let mut x_by_ik: Vec<(String, f64)> = Vec::new();
        let total_mol: f64 = map.values().filter(|m| **m > 0.0).sum();
        for (sp, &mol) in map {
            if mol <= 0.0 {
                continue;
            }
            if sp == AQUEOUS_SOLVENT {
                v += mol * crate::volume::water_molar_volume_cm3_mol(t_k);
            } else if let Some(m) = self.molecule(sp).filter(|m| m.liquid_data) {
                v += mol * m.v_liquid_m3_mol(t_k) * 1e6;
            } else {
                v += mol * crate::volume::ion_apparent_molar_volume(sp, ionic);
            }
            if let Some(ik) = self.molecule(sp).and_then(|m| m.inchikey.clone()) {
                x_by_ik.push((ik, mol / total_mol.max(1e-300)));
            }
        }
        if let Some(w) = self.molecule(AQUEOUS_SOLVENT).and_then(|m| m.inchikey.clone()) {
            // water is a molecule too (its key above is handled by the special case, its InChIKey joins the excess terms)
            if !x_by_ik.iter().any(|(k, _)| *k == w) {
                if let Some(&n) = map.get(AQUEOUS_SOLVENT) {
                    x_by_ik.push((w, n / total_mol.max(1e-300)));
                }
            }
        }
        v += total_mol * crate::volume::excess_molar_volume_cm3_mol(&x_by_ik);
        v.max(0.0)
    }

    pub(crate) fn phase_mass_g(&self, map: &HashMap<String, f64>) -> f64 {
        map.iter().map(|(sp, &mol)| mol * chem_db::get_species_thermo(sp).mw).sum()
    }

    pub(crate) fn phase_views(&self) -> Vec<PhaseView> {
        let t = self.temperature_k;
        self.liquid_maps()
            .filter(|m| !m.is_empty())
            .map(|m| PhaseView { species_mol: m.clone(), volume_ml: self.phase_volume_ml(m, t), mass_g: self.phase_mass_g(m) })
            .collect()
    }

    /// Volume of the water-containing (primary) liquid phase, mL.
    pub fn aqueous_volume_ml(&self) -> f64 {
        if !self.has_aqueous_phase() {
            return 0.0;
        }
        self.phase_volume_ml(&self.species_mol, self.temperature_k)
    }

    /// Volume of the liquid phases other than the primary one (the immiscible layers), mL.
    pub fn organic_volume_ml(&self) -> f64 {
        let t = self.temperature_k;
        self.extra_liquids.iter().map(|m| self.phase_volume_ml(m, t)).sum()
    }

    pub fn total_liquid_volume_ml(&self) -> f64 {
        let t = self.temperature_k;
        self.liquid_maps().map(|m| self.phase_volume_ml(m, t)).sum()
    }

    /// Volume the solution chemistry (equilibria, kinetics) happens in: the primary liquid phase.
    pub fn reaction_volume_ml(&self) -> f64 {
        self.phase_volume_ml(&self.species_mol, self.temperature_k)
    }

    /// The recipe of a liquid reagent per millilitre at the reference temperature of volumetric glassware (20 C): the solutes
    /// as the catalog gives them (the labelled concentration), the solvent (the species that fills most of the volume) in
    /// the amount that makes the solution occupy exactly 1 mL there. Its density and molarity at any other temperature
    /// follow from the volume model, not from stored numbers.
    pub(crate) fn reagent_recipe(&self, composition: &HashMap<String, f64>) -> HashMap<String, f64> {
        const T_REF_K: f64 = 293.15;
        if composition.len() < 2 {
            // a neat liquid: its amount per mL is whatever fills 1 mL
            let mut r = composition.clone();
            if let Some((k, n)) = r.iter_mut().next() {
                let v1 = self.phase_volume_ml(&HashMap::from([(k.clone(), 1.0)]), T_REF_K);
                if v1 > 1e-9 {
                    *n = 1.0 / v1;
                }
            }
            return r;
        }
        let solvent = composition
            .iter()
            .map(|(k, &n)| (k.clone(), self.phase_volume_ml(&HashMap::from([(k.clone(), n)]), T_REF_K)))
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal).then(b.0.cmp(&a.0)))
            .map(|(k, _)| k);
        let Some(solvent) = solvent else { return composition.clone() };
        let v_all = self.phase_volume_ml(composition, T_REF_K);
        let n_s = composition[&solvent];
        let v_s = self.phase_volume_ml(&HashMap::from([(solvent.clone(), 1.0)]), T_REF_K);
        if v_s <= 1e-9 {
            return composition.clone();
        }
        let v_rest = v_all - n_s * v_s;
        let mut r = composition.clone();
        r.insert(solvent, ((1.0 - v_rest) / v_s).max(0.0));
        r
    }

    // ------------------------------------------------------------------------------------------------ electrolytes
    /// The electrolyte environment of the primary phase: its ions and the electrostriction of its salts.
    pub(crate) fn ion_env(&self) -> Option<IonEnv> {
        self.ion_env_of(&self.species_mol)
    }

    /// The electrolyte environment of a liquid phase holding `phase` (amounts by species).
    pub(crate) fn ion_env_of(&self, phase: &HashMap<String, f64>) -> Option<IonEnv> {
        let mut env = IonEnv::default();
        for (sp, &mol) in phase {
            if mol > 0.0 && ions::species_charge(sp) != 0 {
                env.ions.insert(sp.clone(), mol);
            }
        }
        if env.ions.is_empty() {
            return None;
        }
        // pair the ions into salts (greedy) and add f (V_crystal - sum V0_aq) for those whose crystal volume is known
        let mut cats: Vec<(String, i32, f64)> = Vec::new();
        let mut ans: Vec<(String, i32, f64)> = Vec::new();
        for (sp, &mol) in &env.ions {
            let z = ions::species_charge(sp);
            if z > 0 {
                cats.push((sp.clone(), z, mol));
            } else {
                ans.push((sp.clone(), -z, mol));
            }
        }
        cats.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal).then(a.0.cmp(&b.0)));
        ans.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal).then(a.0.cmp(&b.0)));
        fn gcd(a: i32, b: i32) -> i32 {
            if b == 0 { a.abs().max(1) } else { gcd(b, a % b) }
        }
        let mut electro = 0.0;
        for c in cats.iter_mut() {
            for a in ans.iter_mut() {
                let g = gcd(c.1, a.1);
                let (nu_c, nu_a) = ((a.1 / g) as f64, (c.1 / g) as f64);
                let f = (c.2 / nu_c).min(a.2 / nu_a);
                if f <= 0.0 {
                    continue;
                }
                if let Some(v_cryst) = self.salt_crystal_volume_cm3(&c.0, nu_c, &a.0, nu_a) {
                    let v_aq = nu_c * crate::volume::ion_hkf_v0(&c.0) + nu_a * crate::volume::ion_hkf_v0(&a.0);
                    electro += f * (v_cryst - v_aq) * 1e-6;
                }
                c.2 -= f * nu_c;
                a.2 -= f * nu_a;
            }
        }
        env.electrostriction_m3 = electro;
        Some(env)
    }

    /// Molar volume of the crystal of a salt (cm3/mol) from the vessel's mineral registry (its density), if it has one.
    fn salt_crystal_volume_cm3(&self, cation: &str, nu_c: f64, anion: &str, nu_a: f64) -> Option<f64> {
        let key = (cation.to_string(), nu_c as i32, anion.to_string(), nu_a as i32);
        {
            let mut c = self.mol_cache.borrow_mut();
            if c.minerals_len != self.minerals.len() {
                c.salt_volume.clear();
                c.minerals_len = self.minerals.len();
            }
            if let Some(v) = c.salt_volume.get(&key) {
                return *v;
            }
        }
        let v = self
            .minerals
            .iter()
            .find(|m| {
                m.dissolved_products.len() == 2
                    && (m.dissolved_products.get(cation).copied().unwrap_or(0.0) - nu_c).abs() < 1e-9
                    && (m.dissolved_products.get(anion).copied().unwrap_or(0.0) - nu_a).abs() < 1e-9
            })
            .and_then(|m| {
                let mw = chem_db::get_species_thermo(&m.solid_species).mw;
                if m.density_g_ml > 0.3 { Some(mw / m.density_g_ml) } else { None }
            });
        self.mol_cache.borrow_mut().salt_volume.insert(key, v);
        v
    }

    // ------------------------------------------------------------------------------------------------ the phase solver
    /// The components of the phase problem: molecules (with an activity model) present in the liquid or as a solid, by key.
    fn phase_components(&self) -> Vec<(String, Arc<Molecule>)> {
        let mut keys: BTreeSet<String> = BTreeSet::new();
        for m in self.liquid_maps() {
            for (k, &v) in m {
                if v > TINY_MOL {
                    keys.insert(k.clone());
                }
            }
        }
        for (sk, &v) in &self.solid_mol {
            if v > TINY_MOL {
                if let Some(lk) = self.liquid_key_of_solid(sk) {
                    keys.insert(lk);
                }
            }
        }
        keys.into_iter().filter_map(|k| self.molecule(&k).filter(|m| m.partitionable()).map(|m| (k, m))).collect()
    }

    /// Solves the liquid-liquid and solid-liquid equilibrium at `t_k` from the amounts `n_liq0` (liquid) and `n_sol0`
    /// (solid) of the components. The solids dissolve, melt or form until each liquid-reference activity is at most its
    /// saturation value, and equal to it while a solid remains.
    fn solve_at(&self, comps: &[(String, Arc<Molecule>)], t_k: f64, p_pa: f64, n_liq0: &[f64], n_sol0: &[f64], env: Option<&IonEnv>) -> Solved {
        // While the vessel has a single liquid phase the search for the saturation amounts uses the single-phase activities
        // (a full tangent-plane analysis at every trial amount would dominate the cost); the converged state is always
        // verified with the full liquid-liquid solve, and a second liquid phase there repeats the search in full.
        let cheap = self.extra_liquids.is_empty();
        let s = self.solve_at_mode(comps, t_k, p_pa, n_liq0, n_sol0, env, cheap);
        if cheap && s.lle.phases.len() > 1 {
            return self.solve_at_mode(comps, t_k, p_pa, n_liq0, n_sol0, env, false);
        }
        s
    }

    fn solve_at_mode(&self, comps: &[(String, Arc<Molecule>)], t_k: f64, p_pa: f64, n_liq0: &[f64], n_sol0: &[f64], env: Option<&IonEnv>, cheap: bool) -> Solved {
        let nc = comps.len();
        let mix = Mixture::new(comps.iter().map(|(_, m)| m.clone()).collect(), t_k);
        let total: Vec<f64> = (0..nc).map(|i| n_liq0[i] + n_sol0[i]).collect();
        let mut n_liq = n_liq0.to_vec();
        // ln a_i of the liquid state: from the phase where the component is richest (equal across phases at equilibrium)
        let eval = |n: &[f64]| -> (lle::LleResult, Vec<f64>) {
            let r = if cheap {
                let ion_phase = if env.is_some() && mix.water.map_or(false, |w| n[w] > 0.0) { Some(0) } else { None };
                lle::LleResult { phases: vec![n.to_vec()], ion_phase }
            } else {
                lle::solve(&mix, n, env)
            };
            let mut ln_a = vec![f64::NEG_INFINITY; nc];
            for i in 0..nc {
                let mut best = 0usize;
                let mut best_x = -1.0;
                for (p, ph) in r.phases.iter().enumerate() {
                    let tot: f64 = ph.iter().sum();
                    let x = if tot > 0.0 { ph[i] / tot } else { 0.0 };
                    if x > best_x {
                        best_x = x;
                        best = p;
                    }
                }
                let ph = &r.phases[best];
                let with_ions = r.ion_phase == Some(best);
                ln_a[i] = mix.ln_activity(ph, if with_ions { env } else { None })[i];
            }
            (r, ln_a)
        };
        let ln_sat: Vec<Option<f64>> = comps.iter().map(|(_, m)| m.ln_a_sat(t_k, p_pa)).collect();
        for _sweep in 0..10 {
            let mut changed = false;
            for i in 0..nc {
                let Some(ls) = ln_sat[i] else { continue };
                if total[i] <= TINY_MOL {
                    continue;
                }
                if matches!(comps[i].1.solid, Some(SolidModel::Insoluble)) {
                    continue; // never dissolves, never forms
                }
                let f = |nl: f64, n_liq: &mut Vec<f64>| -> f64 {
                    let keep = n_liq[i];
                    n_liq[i] = nl;
                    let (_, la) = eval(n_liq);
                    n_liq[i] = keep;
                    la[i] - ls
                };
                let cur = n_liq[i];
                let mut nl_vec = n_liq.clone();
                let f_hi = f(total[i], &mut nl_vec);
                let target = if f_hi <= 1e-12 {
                    total[i] // everything dissolves: the liquid is undersaturated even with all of it in
                } else {
                    let lo0 = (total[i] * 1e-18).max(1e-40);
                    let f_lo = f(lo0, &mut nl_vec);
                    if f_lo >= 0.0 {
                        0.0
                    } else {
                        // bisection in ln(n) (f is increasing in the liquid amount and nearly linear in ln n)
                        let (mut lo, mut hi) = (lo0.ln(), total[i].ln());
                        let (mut flo, mut fhi) = (f_lo, f_hi);
                        for _ in 0..80 {
                            let mid = if flo.is_finite() && fhi.is_finite() && (fhi - flo).abs() > 1e-300 { lo - flo * (hi - lo) / (fhi - flo) } else { 0.5 * (lo + hi) };
                            let mid = mid.clamp(lo + 1e-3 * (hi - lo), hi - 1e-3 * (hi - lo));
                            let fm = f(mid.exp(), &mut nl_vec);
                            if fm.abs() < 1e-10 {
                                lo = mid;
                                hi = mid;
                                break;
                            }
                            if fm > 0.0 {
                                hi = mid;
                                fhi = fm;
                            } else {
                                lo = mid;
                                flo = fm;
                            }
                            if (hi - lo).abs() < 1e-12 {
                                break;
                            }
                        }
                        (0.5 * (lo + hi)).exp()
                    }
                };
                // a solid that is absent stays absent when undersaturated; amounts barely changing are not changes
                if (target - cur).abs() > 1e-12 * total[i].max(1e-30) {
                    n_liq[i] = target.min(total[i]);
                    changed = true;
                }
            }
            if !changed {
                break;
            }
        }
        let lle = lle::solve(&mix, &n_liq, env);
        let n_sol: Vec<f64> = (0..nc).map(|i| (total[i] - n_liq[i]).max(0.0)).collect();
        // snap round-off: a component that is all liquid / all solid
        let mut n_liq = n_liq;
        let mut n_sol = n_sol;
        for i in 0..nc {
            if n_sol[i] <= DUST_REL * total[i].max(1e-30) {
                n_liq[i] = total[i];
                n_sol[i] = 0.0;
            }
        }
        Solved { n_liq, n_sol, lle }
    }

    /// Excess enthalpy (J) of a set of liquid phases (amounts per component, the ion phase carrying the ions):
    /// `H^E = -R T^2 d(sum n_i ln gamma_i)/dT`, by central difference of the activity model in temperature. Totals, not
    /// partial molar values, so large transfers (a solvent freezing almost completely) are balanced exactly.
    fn excess_enthalpy(&self, comps: &[(String, Arc<Molecule>)], t_k: f64, phases: &[Vec<f64>], env: Option<&IonEnv>, ion_phase: Option<usize>) -> f64 {
        let dt = 0.5;
        let arcs: Vec<Arc<Molecule>> = comps.iter().map(|(_, m)| m.clone()).collect();
        let (m1, m2) = (Mixture::new(arcs.clone(), t_k - dt), Mixture::new(arcs, t_k + dt));
        let mut dg = 0.0;
        for (p, ph) in phases.iter().enumerate() {
            if ph.iter().sum::<f64>() <= 0.0 {
                continue;
            }
            let e = if ion_phase == Some(p) { env } else { None };
            let (g1, g2) = (m1.ln_gamma(ph, e), m2.ln_gamma(ph, e));
            dg += (0..ph.len()).map(|i| ph[i] * (g2[i] - g1[i])).sum::<f64>();
        }
        -R_GAS * t_k * t_k * dg / (2.0 * dt)
    }

    /// Re-establishes the liquid-liquid and solid-liquid equilibrium of the vessel at conserved enthalpy: moves material
    /// between the liquid phases and the solids, and shifts the temperature by the heat of the transfer (a freezing liquid
    /// holds the temperature at the freezing point of its composition; a dissolving solid cools the solution).
    pub(crate) fn phase_flash(&mut self) {
        let comps = self.phase_components();
        if comps.is_empty() {
            self.merge_extra_liquids();
            return;
        }
        let nc = comps.len();
        let t0 = self.temperature_k;
        let p_pa = if self.sealed { self.pressure_atm * P_ATM_PA } else { self.atmosphere.pressure_pa() };
        let env = self.ion_env();
        let n_liq0: Vec<f64> = comps.iter().map(|(k, _)| self.liquid_total(k)).collect();
        // one solid belongs to one component: when two liquid keys name the same molecule (I2(aq) and I2(l)) only the first
        // carries the solid, the other is a liquid-only twin (counting the solid for both would create atoms)
        let mut solid_owner: HashSet<&str> = HashSet::new();
        let n_sol0: Vec<f64> = comps
            .iter()
            .map(|(_, m)| if solid_owner.insert(m.solid_key.as_str()) { self.solid_mol.get(&m.solid_key).copied().unwrap_or(0.0) } else { 0.0 })
            .collect();
        // nothing can change phase: a single liquid component with no solid and no chance to freeze
        let multi = comps.iter().filter(|(k, _)| self.liquid_total(k) > TINY_MOL).count() >= 2;
        let has_solid = n_sol0.iter().any(|&s| s > TINY_MOL);

        let sol0 = self.solve_at(&comps, t0, p_pa, &n_liq0, &n_sol0, env.as_ref());
        let formed0: Vec<f64> = (0..nc).map(|i| sol0.n_sol[i] - n_sol0[i]).collect();
        let scale = (0..nc).map(|i| n_liq0[i] + n_sol0[i]).fold(0.0, f64::max).max(1e-30);
        let moves = formed0.iter().any(|d| d.abs() > 1e-12 * scale);
        if !multi && !has_solid && !moves {
            // single liquid phase, nothing precipitates: only the layout (extras) must be consistent
            self.apply_solved(&comps, &sol0, &n_sol0, env.as_ref(), t0);
            return;
        }
        let c_tot = (self.contents_heat_capacity() + self.glass_heat_capacity()).max(1.0);
        // heat released by the transfers at temperature t, J (positive = warms the contents)
        // the liquid before the transfer, per component, phase by phase (the primary phase carries the ions)
        let init_phases: Vec<Vec<f64>> = self
            .liquid_maps()
            .map(|m| comps.iter().map(|(k, _)| m.get(k).copied().unwrap_or(0.0)).collect::<Vec<f64>>())
            .filter(|v| v.iter().sum::<f64>() > 0.0)
            .collect();
        let heat_at = |this: &Vessel, s: &Solved, t: f64| -> f64 {
            // fusion enthalpies of the solid formed, plus the excess (mixing) enthalpy released: liquid before minus after
            let mut q = 0.0;
            let mut moved = false;
            for i in 0..nc {
                let d = s.n_sol[i] - n_sol0[i];
                if d.abs() > 1e-18 {
                    q += d * comps[i].1.dh_dissolve_ideal(t);
                    moved = true;
                }
            }
            if moved {
                q += this.excess_enthalpy(&comps, t, &init_phases, env.as_ref(), Some(0)) - this.excess_enthalpy(&comps, t, &s.lle.phases, env.as_ref(), s.lle.ion_phase);
            }
            q
        };
        let q0 = heat_at(self, &sol0, t0);
        let mut best_t = t0;
        let mut best = sol0;
        if q0.abs() / c_tot > 1e-7 {
            // h(T) = T - T0 - Q(T)/C increases with T (less solid forms as T rises); the root lies between T0 and T0 + Q0/C.
            // Illinois (modified regula falsi) on the bracket, every evaluation a full phase solve from the initial amounts.
            let h_of = |this: &Vessel, t: f64| -> (f64, Solved) {
                let s = this.solve_at(&comps, t, p_pa, &n_liq0, &n_sol0, env.as_ref());
                let h = t - t0 - heat_at(this, &s, t) / c_tot;
                (h, s)
            };
            let (mut ta, mut ha) = (t0, -q0 / c_tot);
            let mut sa = best.clone();
            let mut tb = t0 + q0 / c_tot;
            let (mut hb, sb0) = h_of(self, tb);
            let mut sb = sb0.clone();
            best_t = tb;
            best = sb0;
            if ha * hb <= 0.0 {
                let mut side = 0i32;
                let mut last_h = f64::INFINITY;
                let mut width_prev = (tb - ta).abs();
                let mut bisect = false;
                for it in 0..80 {
                    // regula falsi (Illinois); when it stops shrinking the bracket (h(T) has a jump, e.g. a pure solvent
                    // freezing at one temperature) the search switches to bisection, which always shrinks it
                    if it >= 3 && it % 3 == 0 {
                        let w = (tb - ta).abs();
                        bisect = bisect || w > 0.2 * width_prev;
                        width_prev = w;
                    }
                    let tm = if !bisect && (hb - ha).abs() > 1e-300 { (ta * hb - tb * ha) / (hb - ha) } else { 0.5 * (ta + tb) };
                    let (lo, hi) = (ta.min(tb), ta.max(tb));
                    let tm = tm.clamp(lo, hi);
                    let (hm, sm) = h_of(self, tm);
                    best_t = tm;
                    best = sm.clone();
                    last_h = hm;
                    if hm.abs() < 1e-8 || (hi - lo) < 1e-7 || (bisect && (hi - lo) < 2e-4 && hm.abs() > 1e-3) {
                        break;
                    }
                    if hm * hb > 0.0 {
                        tb = tm;
                        hb = hm;
                        sb = sm;
                        if side == -1 {
                            ha *= 0.5;
                        }
                        side = -1;
                    } else {
                        ta = tm;
                        ha = hm;
                        sa = sm;
                        if side == 1 {
                            hb *= 0.5;
                        }
                        side = 1;
                    }
                }
                // The bracket collapsed onto a jump of h(T): a pure (or eutectic-like) system whose equilibrium amount of
                // solid is not a function of temperature (a pure solvent freezes at one temperature). The state is then
                // a mixture of the two sides at that temperature, its solid fraction fixed by the enthalpy balance (lever
                // rule), which is the freezing / melting plateau.
                if last_h.abs() > 1e-5 && (ta - tb).abs() < 5e-4 {
                    let t_star = 0.5 * (ta + tb);
                    // the side with more solid is the colder one (h < 0)
                    let (s_more, s_less) = if sa.n_sol.iter().sum::<f64>() >= sb.n_sol.iter().sum::<f64>() { (&sa, &sb) } else { (&sb, &sa) };
                    let (q_more, q_less) = (heat_at(self, s_more, t_star), heat_at(self, s_less, t_star));
                    let lam = if (q_more - q_less).abs() > 1e-300 { (((t_star - t0) * c_tot - q_less) / (q_more - q_less)).clamp(0.0, 1.0) } else { 0.0 };
                    let n_sol: Vec<f64> = (0..nc).map(|i| s_less.n_sol[i] + lam * (s_more.n_sol[i] - s_less.n_sol[i])).collect();
                    let n_liq: Vec<f64> = (0..nc).map(|i| (n_liq0[i] + n_sol0[i] - n_sol[i]).max(0.0)).collect();
                    let mix = Mixture::new(comps.iter().map(|(_, m)| m.clone()).collect(), t_star);
                    let lle = lle::solve(&mix, &n_liq, env.as_ref());
                    best_t = t_star;
                    best = Solved { n_liq, n_sol, lle };
                }
            }
        }
        self.temperature_k = best_t;
        self.apply_solved(&comps, &best, &n_sol0, env.as_ref(), best_t);
    }

    /// Writes a solved state into the vessel: the liquid phases (ordered by density), the solids, and the announcements.
    fn apply_solved(&mut self, comps: &[(String, Arc<Molecule>)], s: &Solved, n_sol0: &[f64], env: Option<&IonEnv>, t_k: f64) {
        let nc = comps.len();
        // confined species (ions, non-partitionable molecules) stay in the primary phase
        let comp_keys: Vec<&String> = comps.iter().map(|(k, _)| k).collect();
        let mut confined: HashMap<String, f64> = HashMap::new();
        for m in self.liquid_maps() {
            for (k, &v) in m {
                if v > TINY_MOL && !comp_keys.contains(&k) {
                    *confined.entry(k.clone()).or_insert(0.0) += v;
                }
            }
        }
        // the phase maps of the components
        let mut maps: Vec<HashMap<String, f64>> = Vec::new();
        for ph in &s.lle.phases {
            let mut m: HashMap<String, f64> = HashMap::new();
            for i in 0..nc {
                if ph[i] > TINY_MOL {
                    m.insert(comps[i].0.clone(), ph[i]);
                }
            }
            maps.push(m);
        }
        if maps.is_empty() {
            maps.push(HashMap::new());
        }
        // which phase is the primary: the one with the ions, else the most water, else the most material
        let water_key = AQUEOUS_SOLVENT;
        let primary = if env.is_some() && !confined.is_empty() {
            s.lle.ion_phase.unwrap_or(0)
        } else {
            (0..maps.len())
                .max_by(|&a, &b| {
                    let wa = maps[a].get(water_key).copied().unwrap_or(0.0);
                    let wb = maps[b].get(water_key).copied().unwrap_or(0.0);
                    let ta: f64 = maps[a].values().sum();
                    let tb: f64 = maps[b].values().sum();
                    wa.partial_cmp(&wb).unwrap_or(std::cmp::Ordering::Equal).then(ta.partial_cmp(&tb).unwrap_or(std::cmp::Ordering::Equal))
                })
                .unwrap_or(0)
        };
        let mut primary_map = maps.remove(primary);
        for (k, v) in confined {
            *primary_map.entry(k).or_insert(0.0) += v;
        }
        // the others, densest first (the order of a separatory funnel from the bottom)
        let mut others: Vec<(f64, HashMap<String, f64>)> = maps
            .into_iter()
            .filter(|m| !m.is_empty())
            .map(|m| {
                let v = self.phase_volume_ml(&m, t_k).max(1e-12);
                (self.phase_mass_g(&m) / v, m)
            })
            .collect();
        others.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        self.species_mol = primary_map;
        self.extra_liquids = others.into_iter().map(|(_, m)| m).collect();
        // solids
        for i in 0..nc {
            let key = comps[i].1.solid_key.clone();
            let before = n_sol0[i];
            let after = s.n_sol[i];
            if (after - before).abs() > 0.0 {
                if after > TINY_MOL {
                    self.solid_mol.insert(key.clone(), after);
                    if after > before {
                        *self.initial_solids.entry(key.clone()).or_insert(0.0) += after - before;
                        // a solid that grows here formed from the vessel's own liquid: it is cast to the vessel
                        *self.solid_cast_mol.entry(key.clone()).or_insert(0.0) += after - before;
                    } else if before > 0.0 {
                        // melting takes the cast and the added part alike
                        if let Some(c) = self.solid_cast_mol.get_mut(&key) {
                            *c *= after / before;
                        }
                    }
                } else {
                    self.solid_mol.remove(&key);
                    self.solid_cast_mol.remove(&key);
                }
            }
            // announce a solid appearing from a liquid: the solvent freezing, a solute crystallising
            let announce = (5e-5 * self.solvent_volume_ml().max(1.0) / 1000.0).max(20.0 * self.dust_mol());
            if after > announce && before <= announce && !self.ev.solids.contains(&key) {
                self.ev.solids.insert(key.clone());
                self.ev.susp.insert(key.clone(), 0.05);
                let liquid_total: f64 = s.n_liq[i];
                let phase_total: f64 = self.liquid_maps().map(|m| m.values().sum::<f64>()).sum();
                let is_solvent = phase_total > 0.0 && liquid_total / phase_total > 0.3;
                let name = comps[i].1.name.clone();
                let text = if is_solvent { format!("{} freezing at {:.1} °C", name, t_k - 273.15) } else { format!("{} crystallising out of solution", name) };
                self.push_event_full(VesselEventKind::PrecipitateFormed, text, 0.5, Some(key), None);
            }
        }
    }

    /// Whether a solid is a frozen liquid rather than a crystalline powder: the solid phase of a molecule that is the main
    /// liquid component of the vessel (the solvent freezing), or, in a vessel with no liquid, one that melts below standard
    /// temperature (298 K) (a block of ice, frozen benzene) as opposed to one that is solid at room temperature (iodine).
    pub(crate) fn solid_is_frozen_liquid(&self, sp: &str) -> bool {
        let Some(key) = self.liquid_key_of_solid(sp) else { return false };
        let Some(m) = self.molecule(&key) else { return false };
        let Some(SolidModel::Fusion(f)) = &m.solid else { return false };
        let total_liquid: f64 = self.liquid_maps().map(|mp| mp.values().sum::<f64>()).sum();
        if total_liquid > 1e-12 {
            self.liquid_total(&key) >= 0.3 * total_liquid
        } else {
            f.tm_k < 298.15 // liquid at standard temperature
        }
    }

    /// Folds every extra liquid phase into the primary one (no component can be partitioned).
    fn merge_extra_liquids(&mut self) {
        if self.extra_liquids.is_empty() {
            return;
        }
        let extras = std::mem::take(&mut self.extra_liquids);
        for m in extras {
            for (k, v) in m {
                *self.species_mol.entry(k).or_insert(0.0) += v;
            }
        }
    }

    // ------------------------------------------------------------------------------------------------ snapshot helpers
    /// Whether a liquid phase is the aqueous kind: water is its main component by amount.
    pub(crate) fn phase_is_aqueous(&self, map: &HashMap<String, f64>) -> bool {
        let w = map.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0);
        let molecules: f64 = map.iter().filter(|(k, _)| ions::species_charge(k) == 0).map(|(_, v)| *v).sum();
        w > 0.0 && w >= 0.5 * molecules.max(1e-300)
    }

    /// Optics of one liquid phase: the absorbance per cm of its species *in this phase's solvent*, and where the data came
    /// from. A species contributes through (in order) the UV bands of its import, the species store's optical record, the seed
    /// row, the ligand-field estimate; a pure liquid with a colour phrase also carries its neat colour in proportion to its
    /// volume fraction (a Speculative colour, never an absorptivity of a solute). `lead` is the main component of a
    /// non-aqueous phase (it names the solvent class).
    pub(crate) fn phase_optics(&self, map: &HashMap<String, f64>, volume_ml: f64, lead: Option<&str>) -> PhaseOptics {
        let aqueous = self.phase_is_aqueous(map);
        let smiles: Option<String> = lead.and_then(|k| {
            self.compound_for(k)
                .and_then(|c| c.smiles.clone())
                .or_else(|| crate::db::SpeciesStore::global().read().ok().and_then(|st| st.get(k).and_then(|r| r.identity.smiles.clone())))
        });
        let solvent = optics::solution::solvent_class(aqueous, smiles.as_deref());
        let mut a = vec![0.0; N_BINS];
        let vol_l = volume_ml / 1000.0;
        // (peak absorbance of the species, tier, source, solvent matched)
        let mut used: Vec<(f64, ProvenanceTier, String, bool)> = Vec::new();
        if vol_l > 1e-9 {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            for sp in keys {
                let conc = map[sp] / vol_l;
                if conc <= 1e-12 {
                    continue;
                }
                let extra: &[crate::db::record::OpticsBand] = self.compound_for(sp).map_or(&[], |c| c.uv_bands.as_slice());
                if let Some(r) = optics::solution::resolve_with(sp, solvent, extra) {
                    let mut one = vec![0.0; N_BINS];
                    optics::solution::accumulate(&mut one, &r.bands, conc);
                    let peak = optics::solution::peak(&one).0;
                    if peak > 0.0 {
                        for (x, y) in a.iter_mut().zip(&one) {
                            *x += y;
                        }
                        used.push((peak, r.tier.clone(), r.source.clone(), r.solvent_matched));
                    }
                }
            }
        }
        let t = self.temperature_k;
        for (sp, &mol) in map {
            if let Some(c) = self.compound_for(sp) {
                if let (Some(rgb), true) = (c.color_linear_rgb, c.state_at_room() == "liquid") {
                    if c.solid_colour.as_ref().map_or(true, |m| m.subject != "solution") {
                        if let Some(m) = self.molecule(sp) {
                            let phi = (mol * m.v_liquid_m3_mol(t) * 1e6 / volume_ml.max(1e-12)).clamp(0.0, 1.0);
                            let neat = optics::fallback::absorbance_for_colour(rgb, 2.0);
                            for (x, y) in a.iter_mut().zip(neat) {
                                *x += phi * y;
                            }
                            let peak = a.iter().cloned().fold(0.0, f64::max).max(1e-9);
                            used.push((peak * phi, ProvenanceTier::Speculative, format!("neat colour phrase of {} (speculative inversion)", c.name), true));
                        }
                    }
                }
            }
        }
        let baseline = optics::solution::solvent_baseline_absorbance(solvent);
        for (x, y) in a.iter_mut().zip(&baseline) {
            *x += y;
        }
        // weakest tier among the species that matter (>= 5 % of the strongest contribution)
        let max_peak = used.iter().map(|u| u.0).fold(0.0, f64::max);
        let mut tier = ProvenanceTier::Tabulated;
        let mut sources: Vec<String> = Vec::new();
        for (peak, ti, src, matched) in &used {
            if *peak < 0.05 * max_peak {
                continue;
            }
            let ti = if *matched { ti.clone() } else { weaker(ti, &ProvenanceTier::Estimated) };
            tier = weaker(&tier, &ti);
            let label = if *matched { src.clone() } else { format!("{} (solvent not matched)", src) };
            if !sources.contains(&label) {
                sources.push(label);
            }
        }
        if used.is_empty() {
            tier = ProvenanceTier::Tabulated;
            sources.push(format!("{} baseline absorbance spectrum (Pope & Fry 1997 / open spectral atlases)", solvent));
        }
        PhaseOptics { a_per_cm: a, tier, sources, solvent }
    }

    // ------------------------------------------------------------------------------------------------ sublimation
    /// Vapour pressure (Pa) above the solid `solid_key` at `t_k`: the saturation activity of its liquid reference times the
    /// liquid's vapour pressure, `a_sat(T) P_sat(T)`. None without a vapour-pressure model or solid line.
    pub(crate) fn solid_vapour_pressure_pa(&self, solid_key: &str, t_k: f64) -> Option<(Arc<crate::vle::Volatile>, f64)> {
        let lk = self.liquid_key_of_solid(solid_key)?;
        let m = self.molecule(&lk)?;
        let ls = m.ln_a_sat(t_k, P_ATM_PA)?;
        if !ls.is_finite() {
            return None;
        }
        let vol = self.volatile_for(&lk)?;
        Some((vol.clone(), ls.exp().min(1.0) * vol.psat_pa(t_k)))
    }
}
