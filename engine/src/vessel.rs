//! M5 Vessel implementation. Manages simulation state, multi-species equilibria,
//! chemical kinetics, thermodynamics, phase transfer, and snapshot generation.
//! Fully generalized to support arbitrary reactions, minerals, and compounds from PubChem.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::types::ProvenanceTier;
use crate::chem_db::{self, GeneralEquilibrium, GeneralMineral, GeneralKineticRxn, ReagentCatalogEntry};
use crate::compound_thermo::CompoundThermo;
use crate::optics::{self, N_BINS};
use crate::spectra;
use crate::ions;
use crate::conservation::{self, ElementError, ElementLedger};
use crate::physics::R_GAS;

/// Fraction of the glass heat capacity that follows the contents' temperature on the time scale of a tick (the one
/// glass factor used by dosing, portions, equilibria heat and the thermal step; Stage 2 replaces it with a glass node).
pub(crate) const GLASS_THERMAL_FRACTION: f64 = 0.15;
/// Specific heat of borosilicate glass, J/(g K).
pub(crate) const GLASS_CP_J_G_K: f64 = 0.84;
/// Below this amount of water (mol, ~18 ng) no aqueous phase exists. Every other aqueous tolerance scales with volume.
pub(crate) const MIN_AQUEOUS_H2O_MOL: f64 = 1e-9;
/// Pool-fire burning rate of ethanol at infinite diameter, kg m-2 s-1, and the extinction-absorption product k*beta,
/// m-1 (Babrauskas, SFPE Handbook of Fire Protection Engineering).
pub(crate) const POOL_BURN_ETHANOL_KG_M2_S: f64 = 0.015;
pub(crate) const POOL_BURN_KBETA_PER_M: f64 = 100.0;
/// Enthalpy of CO2(aq) -> CO2(g), J/mol: dHf(CO2,g) - dHf(CO2,aq) = -393.51 - (-413.8) = +20.3 kJ/mol (species table; Stage 2 derives it from mu).
pub(crate) const DH_CO2_DEGAS_J_MOL: f64 = 20_290.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PhaseKind {
    Aqueous,
    Organic,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LiquidLayer {
    pub phase: PhaseKind,
    pub volume_ml: f64,
    pub density_g_ml: f64,
    pub refractive_index: f64,
    pub absorbance_per_cm: Vec<f64>,
    pub scatter_per_cm: f64,
    pub scatter_rgb: [f64; 3],
    /// Species id of a neat compound layer ("C10H8(l)"); absent for the aqueous and ethanol layers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub species: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SolidKind {
    Powder,
    Crystal,
    Metal,
    Gel,
    Curds,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SolidVisual {
    pub species: String,
    pub name: String,
    pub mass_g: f64,
    pub settled_volume_ml: f64,
    pub suspended_fraction: f64,
    pub particle_diameter_um: f64,
    pub rgb: [f64; 3],
    pub kind: SolidKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub floating: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remaining_fraction: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GasFlux {
    pub species: String,
    pub rate_ml_s: f64,
    pub bubble_diameter_mm: f64,
    pub nucleation: String, // "bulk" | "wall" | "solid"
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FumeVisual {
    pub species: String,
    pub intensity: f64,
    pub rgb: [f64; 3],
    pub opacity: f64,
    pub denser_than_air: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FlameVisual {
    pub fuel: String,
    pub power_w: f64,
    pub luminosity: f64,
    pub flame_temp_k: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emitter_rgb: Option<[f64; 3]>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VesselEventKind {
    Burst,
    StopperPop,
    Ignition,
    FlameOut,
    BoilOver,
    Splatter,
    DryOut,
    ConservationWarning,
    SolverWarning,
    /// A solid appeared that was not added by the user (precipitation / crystallisation).
    PrecipitateFormed,
    /// A solid disappeared (dissolved or was consumed by reaction).
    SolidDissolved,
    GasEvolved,
    ColourChange,
    TemperatureChange,
    ComplexFormed,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VesselEvent {
    pub kind: VesselEventKind,
    pub t_sim_s: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<f64>,
    /// Monotonic per-vessel sequence number (events are capped, so array length is not a stable cursor).
    #[serde(default)]
    pub seq: u64,
    /// Engine species id the event is about (e.g. "AgCl(s)").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub species: Option<String>,
    /// Linear-sRGB colour associated with the event (precipitate / solution colour).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rgb: Option<[f64; 3]>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SpeciesRow {
    pub id: String,
    pub name: String,
    pub formula: String,
    pub charge: i32,
    pub phase: String, // "aqueous" | "solid" | "gas" | "organic"
    pub amount_mol: f64,
    pub conc_m: Option<f64>,
    pub activity: Option<f64>,
    pub tier: ProvenanceTier,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReactionRow {
    pub id: String,
    pub equation: String,
    pub kind: String, // "equilibrium" | "kinetic" | "phase-transfer" | "combustion"
    pub rate: f64,
    pub log_q_over_k: Option<f64>,
    pub tier: ProvenanceTier,
    pub source: String,
    pub active: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConservationInfo {
    /// Every element within the ledger tolerance (1e-6 relative) and net charge within tolerance.
    pub ok: bool,
    /// Largest relative element error against the cumulative ledger (added - removed).
    pub max_element_rel_err: f64,
    /// Largest absolute element error, mol.
    pub max_element_abs_err_mol: f64,
    pub charge_err_mol: f64,
    /// Every element with a non-zero discrepancy (absolute and relative).
    pub element_errors: Vec<ElementError>,
    /// Species present or booked whose formula cannot be parsed: their atoms are not covered by the check.
    pub unverified_species: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VesselSnapshot {
    pub t_sim_s: f64,
    pub temperature_k: f64,
    pub room_k: f64,
    pub bath_k: Option<f64>,
    pub pressure_atm: f64,
    pub sealed: bool,
    pub burst: bool,
    pub ph: Option<f64>,
    pub ionic_strength: Option<f64>,
    pub layers: Vec<LiquidLayer>,
    pub total_liquid_ml: f64,
    pub solids: Vec<SolidVisual>,
    pub gas_fluxes: Vec<GasFlux>,
    pub foam: f64,
    pub boil_intensity: f64,
    pub evaporation_g_s: f64,
    pub vapour_visibility: f64,
    pub condensation: f64,
    pub fumes: Vec<FumeVisual>,
    pub flame: Option<FlameVisual>,
    pub contents_mass_g: f64,
    pub mass_lost_g: f64,
    pub heat_input_w: f64,
    pub net_reaction_heat_w: f64,
    pub species: Vec<SpeciesRow>,
    pub reactions: Vec<ReactionRow>,
    pub conservation: ConservationInfo,
    pub events: Vec<VesselEvent>,
    /// Collected gas (collectors) or evolved headspace gas (stoppered vessels).
    pub gas: crate::gas::GasInfo,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VesselConfig {
    #[serde(rename = "type")]
    pub vessel_type: String,
    pub capacity_ml: f64,
    pub glass_mass_g: f64,
    pub inner_radius_cm: f64,
    pub temperature_k: Option<f64>,
    pub room_k: Option<f64>,
    pub sealed: Option<bool>,
    pub stopper_pop_atm: Option<f64>,
    pub burst_atm: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DoseRequest {
    pub reagent_id: String,
    pub volume_ml: Option<f64>,
    pub mass_g: Option<f64>,
    pub drops: Option<f64>,
    pub temperature_k: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Portion {
    pub volume_ml: f64,
    pub temperature_k: f64,
    pub aqueous_mol: HashMap<String, f64>,
    pub organic_mol: HashMap<String, f64>,
    pub solid_mol: HashMap<String, f64>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct VesselControls {
    pub heater_w: Option<f64>,
    pub stirring: Option<bool>,
    pub stir_rpm: Option<f64>,
    pub sealed: Option<bool>,
    pub bath_k: Option<Option<f64>>,
    pub igniter: Option<bool>,
    pub burner_w: Option<f64>,
    /// Debug: enable the substring-matched organic network generator (off by default, see `update_network`).
    #[serde(default)]
    pub debug_network_generator: Option<bool>,
}

pub struct Vessel {
    pub config: VesselConfig,
    pub t_sim_s: f64,
    pub temperature_k: f64,
    pub room_k: f64,
    pub bath_k: Option<f64>,
    pub pressure_atm: f64,
    pub sealed: bool,
    pub burst: bool,
    pub controls: VesselControls,
    pub species_mol: HashMap<String, f64>,
    pub solid_mol: HashMap<String, f64>,
    pub initial_solids: HashMap<String, f64>,
    pub headspace_gas_mol: HashMap<String, f64>,
    /// Vapour of the liquids in a sealed vessel (species id "H2O(g)", "C2H5OH(g)", "X(g)"), in equilibrium with the liquid
    /// at x * Psat(T); kept apart from `headspace_gas_mol` (evolved gas, which delivery tubes draw off).
    pub vapour_mol: HashMap<String, f64>,
    /// Gas collection bookkeeping (collected moles / escaped moles), see `gas.rs`.
    pub gas: crate::gas::GasState,
    pub mass_lost_g: f64,
    pub events: Vec<VesselEvent>,
    pub flame_active: bool,
    pub flame_power_w: f64,
    pub recent_reaction_heat_w: f64,
    /// Vapour volume flow (mL/s) and mass flow (g/s) of every liquid that boiled in the last step (water, ethanol,
    /// inert compounds): the visual boil state is derived from it, not from a water-only temperature test.
    pub boil_vapour_ml_s: f64,
    pub boil_mass_g_s: f64,
    /// Set by the equilibrium solver whenever a sweep changed the contents (lets `step` stop sweeping once settled).
    pub(crate) eq_moved: bool,
    /// True when the last coupled solve reached its tolerance (the sequential relaxation sweeps are then not needed).
    pub(crate) eq_converged: bool,
    pub gas_fluxes: Vec<GasFlux>,
    pub active_reactions: Vec<ReactionRow>,
    pub catalog: HashMap<String, ReagentCatalogEntry>,
    /// Physical data of every imported compound, keyed by base species id (see `compound_thermo`).
    pub compounds: HashMap<String, CompoundThermo>,
    pub equilibria: Vec<GeneralEquilibrium>,
    pub minerals: Vec<GeneralMineral>,
    pub kinetic_reactions: Vec<GeneralKineticRxn>,
    /// Cumulative element ledger (see `conservation::ElementLedger`).
    pub ledger: ElementLedger,
    /// Debug switch: the substring-matched organic network generator is OFF unless this is set (Stage 9 replaces it).
    pub debug_network_generator: bool,
    /// State for the generic reaction log (precipitate / gas / colour / temperature events).
    pub ev: crate::vessel_ext::EventState,
}

impl Vessel {
    pub fn new(config: VesselConfig) -> Self {
        let temp_k = config.temperature_k.unwrap_or(295.15);
        let room_k = config.room_k.unwrap_or(295.15);
        let sealed = config.sealed.unwrap_or(false);

        let cat_list = chem_db::get_reagent_catalog();
        let mut catalog = HashMap::new();
        for item in cat_list {
            catalog.insert(item.id.clone(), item);
        }

        Self {
            config,
            t_sim_s: 0.0,
            temperature_k: temp_k,
            room_k,
            bath_k: None,
            pressure_atm: 1.0,
            sealed,
            burst: false,
            controls: VesselControls::default(),
            species_mol: HashMap::new(),
            solid_mol: HashMap::new(),
            initial_solids: HashMap::new(),
            headspace_gas_mol: HashMap::new(),
            vapour_mol: HashMap::new(),
            gas: Default::default(),
            mass_lost_g: 0.0,
            events: Vec::new(),
            flame_active: false,
            flame_power_w: 0.0,
            recent_reaction_heat_w: 0.0,
            boil_vapour_ml_s: 0.0,
            boil_mass_g_s: 0.0,
            eq_moved: false,
            eq_converged: false,
            gas_fluxes: Vec::new(),
            active_reactions: Vec::new(),
            catalog,
            compounds: chem_db::get_compound_registry().into_iter().map(|c| (c.species.clone(), c)).collect(),
            equilibria: chem_db::get_default_equilibria(),
            minerals: chem_db::get_default_minerals(),
            kinetic_reactions: chem_db::get_default_kinetic_reactions(),
            ledger: ElementLedger::default(),
            debug_network_generator: false,
            ev: crate::vessel_ext::EventState::default(),
        }
    }

    /// Registers an equilibrium. An unbalanced or unverifiable one is demoted to the Speculative tier and a warning is
    /// logged; the warning text is returned.
    pub fn register_equilibrium(&mut self, mut eq: GeneralEquilibrium) -> Option<String> {
        let warning = chem_db::audit_equilibrium(&mut eq);
        self.equilibria.retain(|e| e.id != eq.id);
        self.equilibria.push(eq);
        if let Some(w) = &warning {
            self.push_event(VesselEventKind::ConservationWarning, w.clone(), 0.5);
        }
        warning
    }

    pub fn register_mineral(&mut self, min: GeneralMineral) {
        self.minerals.retain(|m| m.id != min.id && m.solid_species != min.solid_species);
        self.minerals.push(min);
    }

    /// Registers a kinetic reaction. An unbalanced or unverifiable one is demoted to the Speculative tier and a
    /// warning is logged (the reaction still runs, and the element ledger will flag what it does); the warning is returned.
    pub fn register_kinetic_reaction(&mut self, mut rxn: GeneralKineticRxn) -> Option<String> {
        let warning = chem_db::audit_kinetic_reaction(&mut rxn);
        self.kinetic_reactions.retain(|r| r.id != rxn.id);
        self.kinetic_reactions.push(rxn);
        if let Some(w) = &warning {
            self.push_event(VesselEventKind::ConservationWarning, w.clone(), 0.5);
        }
        warning
    }

    pub fn register_reagent(&mut self, entry: ReagentCatalogEntry) {
        self.catalog.insert(entry.id.clone(), entry);
    }

    /// Automatically expands and registers M6 reaction network based on species present
    pub fn update_network(&mut self) {
        if !self.debug_network_generator {
            return;
        }
        let vol_l = self.reaction_volume_ml() / 1000.0;
        if vol_l <= 0.0 {
            return;
        }
        let mut concs = HashMap::new();
        for (sp, &mol) in &self.species_mol {
            concs.insert(sp.clone(), mol / vol_l);
        }
        for (sp, &mol) in &self.solid_mol {
            concs.insert(sp.clone(), mol / vol_l);
        }
        let ph = self.current_ph();
        let generator = crate::network_generator::NetworkGenerator::new(
            crate::network_generator::NetworkGeneratorConfig::default()
        );
        let gen_net = generator.generate_network(&concs, self.temperature_k, ph);
        for rxn in gen_net.reactions {
            if !self.kinetic_reactions.iter().any(|r| r.id == rxn.id) {
                // generated rate constants are written for first order in every reactant
                let orders: HashMap<String, f64> = rxn.reactants.keys().map(|k| (k.clone(), 1.0)).collect();
                self.kinetic_reactions.push(chem_db::GeneralKineticRxn {
                    id: rxn.id,
                    equation: rxn.equation,
                    reactants: rxn.reactants,
                    products: rxn.products,
                    gas_products: rxn.gas_products,
                    orders: Some(orders),
                    arrhenius_a: rxn.k_fwd,
                    arrhenius_n: 0.0,
                    arrhenius_ea: 0.0,
                    delta_h_kj: rxn.delta_h_kj,
                    catalyst_species: None,
                    is_reversible: rxn.k_rev > 0.0,
                    k_eq_298: Some(rxn.k_eq),
                    tier: rxn.tier,
                    source: rxn.source,
                });
            }
        }
    }

    pub fn dose(&mut self, dose: DoseRequest) -> Result<(), String> {
        let entry = self.catalog.get(&dose.reagent_id)
            .ok_or_else(|| format!("Unknown reagent: {}", dose.reagent_id))?
            .clone();

        let temp_add = dose.temperature_k.unwrap_or(self.room_k);
        let mut total_mass_added_g = 0.0;
        // heat capacity of what is already in the vessel (before this dose goes in)
        let cp_before = self.contents_heat_capacity() + self.glass_heat_capacity();
        let mut added: Vec<(String, f64, bool)> = Vec::new();

        if entry.form == "solid" || entry.by_mass {
            let mass_g = dose.mass_g.unwrap_or(1.0);
            total_mass_added_g += mass_g;
            for (species, &mol_per_g) in &entry.composition {
                let mol = mol_per_g * mass_g;
                if species.ends_with("(s)") {
                    *self.solid_mol.entry(species.clone()).or_insert(0.0) += mol;
                    *self.initial_solids.entry(species.clone()).or_insert(0.0) += mol;
                } else {
                    // Non-solid components of a solid reagent (water of crystallisation, instantly dissolving
                    // ions of multi-ion salts) go straight into solution.
                    *self.species_mol.entry(species.clone()).or_insert(0.0) += mol;
                }
                added.push((species.clone(), mol, false));
            }
        } else {
            let vol_ml = if let Some(d) = dose.drops {
                d * 0.05
            } else {
                dose.volume_ml.unwrap_or(10.0)
            };
            total_mass_added_g += vol_ml * entry.density_g_ml;
            for (species, &mol_per_ml) in &entry.composition {
                let mol = mol_per_ml * vol_ml;
                *self.species_mol.entry(species.clone()).or_insert(0.0) += mol;
                added.push((species.clone(), mol, false));
            }
        }
        for (sp, mol, _) in added {
            self.ledger.book_in(&sp, mol);
        }

        // Calorimetric mixing of the added mass with what was there
        let cp_added = self.entry_cp_j_g_k(&entry) * total_mass_added_g;
        if cp_before + cp_added > 1e-6 {
            self.temperature_k = (self.temperature_k * cp_before + temp_add * cp_added) / (cp_before + cp_added);
        }

        self.settle_after_addition();

        Ok(())
    }

    /// Solves fast speciation / solubility equilibria right after an addition and records what happened in the log.
    fn settle_after_addition(&mut self) {
        // Whatever solid is in the vessel now was put there by the user: only *new* solids count as precipitates.
        self.sync_known_solids();
        self.inert_dissolution(None);
        self.auto_minerals();
        for _ in 0..40 {
            let (sp0, so0) = (self.species_mol.clone(), self.solid_mol.clone());
            let q_eq = self.step_equilibria(0.001);
            let cp_tot = (self.contents_heat_capacity() + self.glass_heat_capacity()).max(1.0);
            self.temperature_k += q_eq / cp_tot;
            // stop as soon as a sweep no longer moves anything (the coupled solve normally gets there in one pass)
            let moved = |a: &HashMap<String, f64>, b: &HashMap<String, f64>| {
                a.len() != b.len() || a.iter().any(|(k, v)| (b.get(k).copied().unwrap_or(f64::NAN) - v).abs() > 1e-14 * v.abs().max(1e-6))
            };
            if !moved(&sp0, &self.species_mol) && !moved(&so0, &self.solid_mol) {
                break;
            }
        }
        self.update_network();
        self.detect_events(true);
    }

    pub fn add_portion(&mut self, portion: Portion) -> Result<(), String> {
        // the portion's own mass and heat capacity (per species), not "volume x water"
        let mut added_mass = 0.0;
        let mut cp_added = 0.0;
        let mut book: Vec<(String, f64)> = Vec::new();
        for map in [&portion.aqueous_mol, &portion.organic_mol, &portion.solid_mol] {
            for (sp, &mol) in map {
                let mass = mol * chem_db::get_species_thermo(sp).mw;
                added_mass += mass;
                cp_added += mass * self.species_cp_j_g_k(sp);
                book.push((sp.clone(), mol));
            }
        }
        let cp_current = self.contents_heat_capacity() + self.glass_heat_capacity();

        for (sp, mol) in portion.aqueous_mol {
            *self.species_mol.entry(sp).or_insert(0.0) += mol;
        }
        for (sp, mol) in portion.organic_mol {
            *self.species_mol.entry(sp).or_insert(0.0) += mol;
        }
        for (sp, mol) in portion.solid_mol {
            *self.solid_mol.entry(sp.clone()).or_insert(0.0) += mol;
            *self.initial_solids.entry(sp).or_insert(0.0) += mol;
        }
        for (sp, mol) in book {
            self.ledger.book_in(&sp, mol);
        }

        if added_mass > 0.0 && cp_current + cp_added > 1e-6 {
            self.temperature_k = (self.temperature_k * cp_current + portion.temperature_k * cp_added) / (cp_current + cp_added);
        }

        self.settle_after_addition();

        Ok(())
    }

    /// Heat capacity (J/K) of the part of the glass that follows the contents (see `GLASS_THERMAL_FRACTION`).
    pub(crate) fn glass_heat_capacity(&self) -> f64 {
        self.config.glass_mass_g * GLASS_CP_J_G_K * GLASS_THERMAL_FRACTION
    }

    pub fn remove_liquid(&mut self, volume_ml: f64, include_solids: bool) -> Result<Portion, String> {
        let total_vol = self.total_liquid_volume_ml();
        if total_vol <= 1e-6 {
            return Ok(Portion {
                volume_ml: 0.0,
                temperature_k: self.temperature_k,
                aqueous_mol: HashMap::new(),
                organic_mol: HashMap::new(),
                solid_mol: HashMap::new(),
            });
        }

        let frac = (volume_ml / total_vol).clamp(0.0, 1.0);
        let actual_vol = total_vol * frac;

        let mut aq_mol = HashMap::new();
        let mut org_mol = HashMap::new();
        for (sp, mol) in self.species_mol.iter_mut() {
            let removed = *mol * frac;
            *mol -= removed;
            if sp == "C2H5OH" || sp.ends_with("(l)") {
                org_mol.insert(sp.clone(), removed);
            } else {
                aq_mol.insert(sp.clone(), removed);
            }
        }

        let mut s_mol = HashMap::new();
        if include_solids {
            for (sp, mol) in self.solid_mol.iter_mut() {
                let removed = *mol * frac;
                *mol -= removed;
                s_mol.insert(sp.clone(), removed);
            }
        }
        for (sp, mol) in aq_mol.iter().chain(org_mol.iter()).chain(s_mol.iter()) {
            self.ledger.book_out(sp, *mol);
        }

        Ok(Portion {
            volume_ml: actual_vol,
            temperature_k: self.temperature_k,
            aqueous_mol: aq_mol,
            organic_mol: org_mol,
            solid_mol: s_mol,
        })
    }

    /// Drain from the bottom (separatory funnel): the densest liquid phase leaves first (aqueous, 1.0+ g/mL, before the
    /// ethanol layer at 0.789 g/mL), then the next one. Settled solids leave with the bottom phase. `remove_liquid`
    /// (proportional over everything) is unchanged.
    pub fn remove_liquid_bottom(&mut self, volume_ml: f64, include_solids: bool) -> Result<Portion, String> {
        let aq_vol = self.aqueous_volume_ml();
        let org_vol = self.organic_volume_ml() + self.neat_volume_ml();
        let org_mass = self.species_mol.get("C2H5OH").copied().unwrap_or(0.0) * 46.069 + self.neat_mass_g();
        let org_density = if org_vol > 1e-9 { org_mass / org_vol } else { 0.789 };
        let total_vol = aq_vol + org_vol;
        if total_vol <= 1e-6 || volume_ml <= 0.0 {
            return self.remove_liquid(0.0, include_solids);
        }
        let want = volume_ml.clamp(0.0, total_vol);
        // phases in order of decreasing density (all non-aqueous liquids count as one organic phase)
        let aq_density = 1.0 + (self.calc_ionic_strength() * 0.03).min(0.2);
        let aq_first = aq_density >= org_density;
        let (first_vol, second_vol) = if aq_first { (aq_vol, org_vol) } else { (org_vol, aq_vol) };
        let take_first = want.min(first_vol);
        let take_second = (want - take_first).min(second_vol);
        let frac_of = |take: f64, vol: f64| if vol > 1e-9 { (take / vol).clamp(0.0, 1.0) } else { 0.0 };
        let (f_aq, f_org) = if aq_first {
            (frac_of(take_first, aq_vol), frac_of(take_second, org_vol))
        } else {
            (frac_of(take_second, aq_vol), frac_of(take_first, org_vol))
        };

        let mut aq_mol = HashMap::new();
        let mut org_mol = HashMap::new();
        for (sp, mol) in self.species_mol.iter_mut() {
            if sp == "C2H5OH" || sp.ends_with("(l)") {
                let removed = *mol * f_org;
                *mol -= removed;
                org_mol.insert(sp.clone(), removed);
            } else {
                let removed = *mol * f_aq;
                *mol -= removed;
                aq_mol.insert(sp.clone(), removed);
            }
        }
        let mut s_mol = HashMap::new();
        if include_solids {
            let f_solid = if aq_first { f_aq } else { f_org };
            for (sp, mol) in self.solid_mol.iter_mut() {
                let removed = *mol * f_solid;
                *mol -= removed;
                s_mol.insert(sp.clone(), removed);
            }
        }
        for (sp, mol) in aq_mol.iter().chain(org_mol.iter()).chain(s_mol.iter()) {
            self.ledger.book_out(sp, *mol);
        }
        Ok(Portion {
            volume_ml: take_first + take_second,
            temperature_k: self.temperature_k,
            aqueous_mol: aq_mol,
            organic_mol: org_mol,
            solid_mol: s_mol,
        })
    }

    pub fn set_controls(&mut self, controls: VesselControls) {
        if let Some(h) = controls.heater_w {
            self.controls.heater_w = Some(h);
        }
        if let Some(s) = controls.stirring {
            self.controls.stirring = Some(s);
        }
        if let Some(r) = controls.stir_rpm {
            self.controls.stir_rpm = Some(r);
        }
        if let Some(seal) = controls.sealed {
            self.controls.sealed = Some(seal);
            self.sealed = seal;
            if !seal {
                self.pressure_atm = 1.0;
                self.vent_vapour();
            }
        }
        if let Some(b) = controls.bath_k {
            self.bath_k = b;
            self.controls.bath_k = Some(b);
        }
        if let Some(ig) = controls.igniter {
            self.controls.igniter = Some(ig);
        }
        if let Some(bw) = controls.burner_w {
            self.controls.burner_w = Some(bw);
        }
        if let Some(dbg) = controls.debug_network_generator {
            self.debug_network_generator = dbg;
        }
    }

    pub fn step(&mut self, dt_s: f64) -> Result<(), String> {
        if dt_s <= 0.0 || self.burst {
            return Ok(());
        }

        self.t_sim_s += dt_s;
        self.gas_fluxes.clear();
        self.boil_vapour_ml_s = 0.0;
        self.boil_mass_g_s = 0.0;
        self.active_reactions.clear();
        self.recent_reaction_heat_w = 0.0;

        let mut reaction_heat_joules = 0.0;

        // 1. Generalized chemical kinetics
        let q_kinetics = self.step_kinetics(dt_s);
        reaction_heat_joules += q_kinetics;

        // 2. Generalized aqueous equilibria & mineral precipitation
        for _ in 0..5 {
            self.eq_moved = false;
            let q_eq = self.step_equilibria(dt_s * 0.2);
            reaction_heat_joules += q_eq;
            // a sweep that moved nothing means the contents are at equilibrium: the remaining sweeps would be no-ops
            if !self.eq_moved {
                break;
            }
        }

        // 2b. Dissolved CO2 above its Henry solubility at the current gas pressure bubbles out. Without this the
        // (now exact) carbonate equilibrium would hold all CO2 from an acid + carbonate reaction in solution.
        reaction_heat_joules += self.step_co2_degassing(dt_s);

        self.recent_reaction_heat_w = reaction_heat_joules / dt_s;

        // 3. Thermal energy balance
        self.step_thermal(dt_s, reaction_heat_joules);

        // 3b. Inert compounds: dissolution equilibrium after the phase changes of the thermal step
        self.inert_dissolution(Some(dt_s));

        // 4. Headspace pressure & gas accumulation / venting
        self.step_headspace(dt_s);

        self.update_suspension(dt_s);

        // 5. Generic reaction log
        self.detect_events(false);

        Ok(())
    }

    /// The vapour leaves the vessel (stopper removed or popped, vessel burst): booked out of the ledger.
    pub(crate) fn vent_vapour(&mut self) {
        for (sp, mol) in std::mem::take(&mut self.vapour_mol) {
            self.ledger.book_out(&sp, mol);
        }
    }

    /// Sealed-vessel vapour-liquid equilibrium bridge (Stage 0; Stage 4 replaces it with a general VLE flash).
    /// Each volatile liquid (water, ethanol, neat imported liquids) holds x * Psat(T) of vapour in the headspace; the
    /// vapour moles come out of the liquid and the latent heat (Watson-corrected) out of the contents. At and above
    /// the critical temperature the whole inventory of that liquid is vapour. Returns the vapour pressure in atm.
    fn step_sealed_vapour(&mut self, headspace_m3: f64) -> f64 {
        use crate::vapour;
        struct Comp {
            liq: String,
            vap: String,
            psat_pa: f64,
            tc_k: f64,
            dh_j_mol: f64,
            x: f64,
        }
        let t = self.temperature_k;
        let mol = |m: &HashMap<String, f64>, k: &str| m.get(k).copied().unwrap_or(0.0);
        let mut comps: Vec<Comp> = Vec::new();
        let n_w = mol(&self.species_mol, "H2O");
        let n_e = mol(&self.species_mol, "C2H5OH");
        let mix = (n_w + n_e).max(1e-300);
        if n_w + mol(&self.vapour_mol, "H2O(g)") > 1e-12 {
            comps.push(Comp {
                liq: "H2O".into(),
                vap: "H2O(g)".into(),
                psat_pa: vapour::water_psat_pa(t),
                tc_k: vapour::WATER_TC_K,
                dh_j_mol: vapour::watson_dh_j_mol(40_660.0, 373.15, vapour::WATER_TC_K, t),
                x: n_w / mix,
            });
        }
        if n_e + mol(&self.vapour_mol, "C2H5OH(g)") > 1e-12 {
            comps.push(Comp {
                liq: "C2H5OH".into(),
                vap: "C2H5OH(g)".into(),
                psat_pa: vapour::ethanol_psat_pa(t),
                tc_k: vapour::ETHANOL_TC_K,
                dh_j_mol: vapour::watson_dh_j_mol(38_560.0, 351.5, vapour::ETHANOL_TC_K, t),
                x: n_e / mix,
            });
        }
        for c in self.present_inert() {
            let neat = format!("{}(l)", c.species);
            let gas = format!("{}(g)", c.species);
            if let Some(curve) = c.vapor_curve {
                let tc = c.tc_k.unwrap_or(f64::INFINITY);
                comps.push(Comp {
                    liq: neat,
                    vap: gas,
                    psat_pa: curve.p_pa(t),
                    tc_k: tc,
                    dh_j_mol: c.dh_vap_at(t),
                    x: 1.0,
                });
            }
        }
        let r_t = R_GAS * t;
        let mut latent_j = 0.0;
        for c in &comps {
            let n_liq = mol(&self.species_mol, &c.liq);
            let n_vap = mol(&self.vapour_mol, &c.vap);
            let available = n_liq + n_vap;
            let target = if t >= c.tc_k { available } else { (c.x * c.psat_pa * headspace_m3 / r_t).min(available) };
            let delta = target - n_vap;
            if delta.abs() < 1e-15 {
                continue;
            }
            let new_liq = (n_liq - delta).max(0.0);
            if new_liq > 0.0 {
                self.species_mol.insert(c.liq.clone(), new_liq);
            } else {
                self.species_mol.remove(&c.liq);
            }
            if target > 0.0 {
                self.vapour_mol.insert(c.vap.clone(), target);
            } else {
                self.vapour_mol.remove(&c.vap);
            }
            latent_j += delta * c.dh_j_mol;
        }
        if latent_j != 0.0 {
            let cp_total = (self.contents_heat_capacity() + self.glass_heat_capacity()).max(1.0);
            self.temperature_k -= latent_j / cp_total;
        }
        let n_vap_total: f64 = self.vapour_mol.values().sum();
        n_vap_total * R_GAS * self.temperature_k / headspace_m3 / 101325.0
    }

    /// Partial pressure (atm) of an evolved gas species in the headspace of a sealed vessel (ideal gas).
    pub(crate) fn headspace_partial_atm(&self, gas: &str) -> f64 {
        let mol = self.headspace_gas_mol.get(gas).copied().unwrap_or(0.0);
        let head_ml = (self.config.capacity_ml - self.total_liquid_volume_ml()).max(10.0);
        mol * R_GAS * self.temperature_k / (head_ml * 1e-6) / 101325.0
    }

    /// Returns the enthalpy change of the solution (J, negative: the escaping gas takes the heat of desolvation).
    fn step_co2_degassing(&mut self, dt_s: f64) -> f64 {
        let co2 = self.species_mol.get("CO2(aq)").copied().unwrap_or(0.0);
        let vol_l = self.solvent_volume_ml() / 1000.0;
        if vol_l <= 0.0 || co2 <= 1e-12 {
            return 0.0;
        }
        // Henry's law needs the CO2 partial pressure: in a sealed vessel that is what the headspace holds (a delivery
        // tube that draws the gas off lets the solution degas below 1 atm), in an open one the 1 atm bubbling threshold.
        let p_gas = if self.sealed { self.headspace_partial_atm("CO2(g)") } else { 1.0 };
        let stirring = self.controls.stirring.unwrap_or(false);
        let (evolved, c_new) = crate::phase_transfer::step_gas_evolution(co2 / vol_l, vol_l, self.temperature_k, p_gas, stirring, dt_s);
        if evolved <= 1e-12 {
            return 0.0;
        }
        self.species_mol.insert("CO2(aq)".to_string(), (c_new * vol_l).max(0.0));
        let vol_gas_ml = evolved * R_GAS * self.temperature_k / (self.pressure_atm.max(0.1) * 101325.0) * 1e6;
        self.gas_fluxes.push(GasFlux {
            species: "CO2(g)".to_string(),
            rate_ml_s: vol_gas_ml / dt_s,
            bubble_diameter_mm: 2.0,
            nucleation: "bulk".to_string(),
        });
        // sealed: the gas stays in the vessel (headspace is part of the inventory); open: it leaves
        if self.sealed {
            *self.headspace_gas_mol.entry("CO2(g)".to_string()).or_default() += evolved;
        } else {
            self.mass_lost_g += evolved * chem_db::get_species_thermo("CO2(g)").mw;
            self.ledger.book_out("CO2(g)", evolved);
        }
        -evolved * DH_CO2_DEGAS_J_MOL
    }

    fn step_kinetics(&mut self, dt_s: f64) -> f64 {
        let mut q_joules = 0.0;
        let t_k = self.temperature_k;
        let vol_l = self.reaction_volume_ml() / 1000.0;
        let r_ideal = R_GAS;
        let mut gas_out: Vec<(String, f64)> = Vec::new();

        for rxn in &self.kinetic_reactions {
            // solution kinetics need a solution; a dry vessel has no volume to put concentrations on
            if vol_l <= 0.0 {
                break;
            }
            // Check catalyst requirement
            if let Some(ref cat) = rxn.catalyst_species {
                let cat_mol = self.solid_mol.get(cat).copied()
                    .or_else(|| self.species_mol.get(cat).copied())
                    .unwrap_or(0.0);
                if cat_mol <= 1e-8 {
                    continue;
                }
            }

            // Calculate rate constant
            let exp_arg = (-rxn.arrhenius_ea / (r_ideal * t_k.max(100.0))).clamp(-100.0, 100.0);
            let mut k = rxn.arrhenius_a * t_k.powf(rxn.arrhenius_n) * exp_arg.exp();

            // If catalyst is present, boost rate
            if let Some(ref cat) = rxn.catalyst_species {
                let cat_mol = self.solid_mol.get(cat).copied().unwrap_or(0.0);
                if cat_mol > 0.0 {
                    k = 0.08 * (cat_mol * 100.0).clamp(0.5, 10.0);
                }
            }

            // Forward rate
            let mut r_fwd = k;
            let mut max_extent = 1e9;
            for (reactant, &coeff) in &rxn.reactants {
                let is_solid = reactant.ends_with("(s)");
                let mol = self.species_mol.get(reactant).copied()
                    .or_else(|| self.solid_mol.get(reactant).copied())
                    .unwrap_or(0.0);
                if mol <= 1e-12 {
                    r_fwd = 0.0;
                    max_extent = 0.0;
                    break;
                }
                if is_solid {
                    let thermo = chem_db::get_species_thermo(reactant);
                    let mass_g = mol * thermo.mw;
                    r_fwd *= (mass_g / thermo.mw).powf(0.67).clamp(0.1, 5.0);
                } else {
                    let conc = mol / vol_l;
                    // rate order: explicit per-reactant order, otherwise the stoichiometric coefficient (elementary step)
                    let order = rxn.orders.as_ref().and_then(|o| o.get(reactant)).copied().unwrap_or(coeff);
                    r_fwd *= conc.powf(order);
                }
                let can_provide = mol / coeff;
                if can_provide < max_extent {
                    max_extent = can_provide;
                }
            }

            if r_fwd <= 0.0 || max_extent <= 0.0 {
                continue;
            }

            let extent = (r_fwd * vol_l * dt_s).min(max_extent);
            if extent <= 1e-12 {
                continue;
            }

            // Apply consumption of reactants
            for (reactant, &coeff) in &rxn.reactants {
                if let Some(m) = self.species_mol.get_mut(reactant) {
                    *m = (*m - extent * coeff).max(0.0);
                } else if let Some(m) = self.solid_mol.get_mut(reactant) {
                    *m = (*m - extent * coeff).max(0.0);
                }
            }

            for (prod, &coeff) in &rxn.products {
                if prod.ends_with("(s)") {
                    *self.solid_mol.entry(prod.clone()).or_default() += extent * coeff;
                } else {
                    *self.species_mol.entry(prod.clone()).or_default() += extent * coeff;
                }
            }

            // Apply gas evolution
            for (gas_sp, &coeff) in &rxn.gas_products {
                let gas_mol = extent * coeff;
                let vol_gas_ml = gas_mol * r_ideal * t_k / (self.pressure_atm * 101325.0) * 1e6;
                self.gas_fluxes.push(GasFlux {
                    species: gas_sp.clone(),
                    rate_ml_s: vol_gas_ml / dt_s,
                    bubble_diameter_mm: if gas_sp.contains("CO2") { 2.0 } else { 1.0 },
                    nucleation: if rxn.reactants.keys().any(|k| k.ends_with("(s)")) {
                        "solid".to_string()
                    } else {
                        "bulk".to_string()
                    },
                });

                if self.sealed {
                    *self.headspace_gas_mol.entry(gas_sp.clone()).or_default() += gas_mol;
                } else {
                    let thermo = chem_db::get_species_thermo(gas_sp);
                    self.mass_lost_g += gas_mol * thermo.mw;
                    gas_out.push((gas_sp.clone(), gas_mol));
                }
            }

            let delta_h_j = rxn.delta_h_kj * 1000.0;
            q_joules -= extent * delta_h_j;

            self.active_reactions.push(ReactionRow {
                id: rxn.id.clone(),
                equation: rxn.equation.clone(),
                kind: "kinetic".to_string(),
                rate: extent / (vol_l * dt_s),
                log_q_over_k: None,
                tier: rxn.tier.clone(),
                source: rxn.source.clone(),
                active: true,
            });
        }

        for (sp, mol) in gas_out {
            self.ledger.book_out(&sp, mol);
        }

        // Special physical process: ethanol combustion when igniter active
        let etoh = *self.species_mol.get("C2H5OH").unwrap_or(&0.0);
        let igniter_active = self.controls.igniter.unwrap_or(false);
        if igniter_active && etoh > 1e-5 && t_k >= 286.0 {
            if !self.flame_active {
                self.flame_active = true;
                self.push_event(VesselEventKind::Ignition, "Flammable vapour ignited".to_string(), 0.6);
            }
        }

        if self.flame_active {
            if etoh <= 1e-6 {
                self.flame_active = false;
                self.flame_power_w = 0.0;
                self.push_event(VesselEventKind::FlameOut, "Combustion fuel exhausted".to_string(), 0.2);
            } else {
                // Pool fire: mass burning rate per area m'' = m''_inf (1 - exp(-k*beta*D)) (Babrauskas; ethanol m''_inf =
                // 0.015 kg m-2 s-1, k*beta = 100 m-1), so a 7 cm beaker burns ~0.06 g/s, not a fixed volume flow per area.
                let area_cm2 = std::f64::consts::PI * self.config.inner_radius_cm.powi(2);
                let diameter_m = 2.0 * self.config.inner_radius_cm / 100.0;
                let m_flux_kg_m2_s = POOL_BURN_ETHANOL_KG_M2_S * (1.0 - (-POOL_BURN_KBETA_PER_M * diameter_m).exp());
                let burn_g_s = m_flux_kg_m2_s * 1000.0 * area_cm2 / 1.0e4;
                let burn_mol_s = burn_g_s / 46.069;
                let mol_burned = (burn_mol_s * dt_s).min(etoh);

                *self.species_mol.entry("C2H5OH".to_string()).or_default() -= mol_burned;
                self.mass_lost_g += mol_burned * 46.069;
                // the combustion products (CO2, H2O) leave with the plume: book the fuel's atoms as gone
                self.ledger.book_out("C2H5OH", mol_burned);
                let heat_w = burn_mol_s * 1367000.0;
                self.flame_power_w = heat_w;
                q_joules += heat_w * 0.15 * dt_s;
            }
        }

        q_joules
    }

    fn step_thermal(&mut self, dt_s: f64, reaction_heat_joules: f64) {
        let cp_contents = self.contents_heat_capacity(); // J/K
        let cp_glass = self.glass_heat_capacity(); // J/K
        let cp_total = (cp_contents + cp_glass).max(1.0);

        let mut net_energy_j = reaction_heat_joules;

        // External heater / hot plate
        let heater_w = self.controls.heater_w.unwrap_or(0.0);
        let burner_w = self.controls.burner_w.unwrap_or(0.0);
        net_energy_j += (heater_w + burner_w) * dt_s;

        // Thermal bath coupling
        if let Some(t_bath) = self.bath_k {
            let k_bath = 25.0; // W/K
            net_energy_j += k_bath * (t_bath - self.temperature_k) * dt_s;
        }

        // Ambient loss to room
        let h_ambient = 0.5; // W/K
        net_energy_j -= h_ambient * (self.temperature_k - self.room_k) * dt_s;

        let delta_t = net_energy_j / cp_total;
        self.temperature_k += delta_t;

        // Melting / freezing plateaus and boil-off of inert compounds (clamps the temperature like water below)
        self.step_inert_thermal(dt_s, cp_total);

        // Pressure-dependent boiling for volatile liquids in open/vented vessels
        let p_atm = if self.sealed { self.pressure_atm.max(0.01) } else { 1.0 };

        // 1. Water boiling
        let dh_vap_w = 40660.0;
        let tb_water_k = 1.0 / (1.0 / 373.15 - (R_GAS / dh_vap_w) * p_atm.ln());
        let water_mol = *self.species_mol.get("H2O").unwrap_or(&0.0);

        if !self.sealed && self.temperature_k >= tb_water_k && water_mol > 1e-4 {
            let excess_temp = self.temperature_k - tb_water_k;
            let excess_energy_j = excess_temp * cp_total;
            self.temperature_k = tb_water_k;

            let boiled_mol = (excess_energy_j / dh_vap_w).min(water_mol);
            *self.species_mol.entry("H2O".to_string()).or_default() -= boiled_mol;
            self.mass_lost_g += boiled_mol * 18.015;
            self.ledger.book_out("H2O", boiled_mol);

            let steam_vol_ml = boiled_mol * R_GAS * tb_water_k / (p_atm * 101325.0) * 1e6;
            self.boil_vapour_ml_s += steam_vol_ml / dt_s;
            self.boil_mass_g_s += boiled_mol * 18.015 / dt_s;
            self.gas_fluxes.push(GasFlux {
                species: "H2O(g)".to_string(),
                rate_ml_s: steam_vol_ml / dt_s,
                bubble_diameter_mm: 4.0,
                nucleation: "bulk".to_string(),
            });

            if boiled_mol >= water_mol - 1e-5 {
                self.push_event(VesselEventKind::DryOut, "Vessel boiled dry".to_string(), 0.8);
            }
        }

        // 2. Ethanol boiling
        let dh_vap_etoh = 38560.0;
        let tb_etoh_k = 1.0 / (1.0 / 351.5 - (R_GAS / dh_vap_etoh) * p_atm.ln());
        let etoh_mol = *self.species_mol.get("C2H5OH").unwrap_or(&0.0);

        if !self.sealed && self.temperature_k >= tb_etoh_k && etoh_mol > 1e-4 {
            let excess_temp = self.temperature_k - tb_etoh_k;
            let excess_energy_j = excess_temp * cp_total;
            self.temperature_k = tb_etoh_k;

            let boiled_mol = (excess_energy_j / dh_vap_etoh).min(etoh_mol);
            *self.species_mol.entry("C2H5OH".to_string()).or_default() -= boiled_mol;
            self.mass_lost_g += boiled_mol * 46.069;
            self.ledger.book_out("C2H5OH", boiled_mol);

            let vapour_vol_ml = boiled_mol * R_GAS * tb_etoh_k / (p_atm * 101325.0) * 1e6;
            self.boil_vapour_ml_s += vapour_vol_ml / dt_s;
            self.boil_mass_g_s += boiled_mol * 46.069 / dt_s;
            self.gas_fluxes.push(GasFlux {
                species: "C2H5OH(g)".to_string(),
                rate_ml_s: vapour_vol_ml / dt_s,
                bubble_diameter_mm: 3.5,
                nucleation: "bulk".to_string(),
            });

            if boiled_mol >= etoh_mol - 1e-5 {
                self.push_event(VesselEventKind::DryOut, "Ethanol boiled off".to_string(), 0.8);
            }
        }
    }

    fn step_headspace(&mut self, _dt_s: f64) {
        if !self.sealed {
            self.pressure_atm = 1.0;
            return;
        }

        let total_vol = self.config.capacity_ml;
        let liq_vol = self.total_liquid_volume_ml();
        let headspace_ml = (total_vol - liq_vol).max(10.0);
        let headspace_m3 = headspace_ml * 1e-6;

        // vapour of the liquids: x * Psat(T) for water, ethanol and imported liquids, with the vapour moles taken from
        // the liquid and the latent heat taken from the contents (cut at the critical temperature: all vapour)
        let p_vapour_atm = self.step_sealed_vapour(headspace_m3);

        let mut total_gas_mol = 0.0;
        for &mol in self.headspace_gas_mol.values() {
            total_gas_mol += mol;
        }

        let r_const = R_GAS;
        let p_evolved_pa = (total_gas_mol * r_const * self.temperature_k) / headspace_m3;
        let p_evolved_atm = p_evolved_pa / 101325.0;
        let p_air_atm = 1.0 * (self.temperature_k / self.room_k);

        self.pressure_atm = p_air_atm + p_vapour_atm + p_evolved_atm;

        let pop_thresh = self.config.stopper_pop_atm.unwrap_or(2.2);
        let burst_thresh = self.config.burst_atm.unwrap_or(6.0);

        if self.pressure_atm >= pop_thresh && self.sealed {
            self.sealed = false;
            self.push_event(VesselEventKind::StopperPop, format!("Stopper popped at {:.2} atm", self.pressure_atm), 0.7);
            self.pressure_atm = 1.0;
            for (sp, mol) in std::mem::take(&mut self.headspace_gas_mol) {
                self.ledger.book_out(&sp, mol);
            }
            self.vent_vapour();
        } else if self.pressure_atm >= burst_thresh {
            self.burst = true;
            self.sealed = false;
            self.push_event(VesselEventKind::Burst, format!("Vessel burst at {:.2} atm!", self.pressure_atm), 1.0);
            self.pressure_atm = 1.0;
            self.vent_vapour();
        }
    }

    pub fn snapshot(&self) -> VesselSnapshot {
        let total_liq_ml = self.total_liquid_volume_ml();
        let aq_vol = self.aqueous_volume_ml();
        let ph = if self.has_aqueous_phase() { Some(self.current_ph()) } else { None };
        let ionic_str = if self.has_aqueous_phase() { Some(self.calc_ionic_strength()) } else { None };

        let mut layers = Vec::new();
        let org_vol = self.organic_volume_ml();

        if aq_vol > 0.01 {
            let a_per_cm = optics::absorbance_per_cm(&self.concentrations_m());
            let (scatter, sc_rgb) = self.calc_turbidity_and_scatter_rgb();
            layers.push(LiquidLayer {
                phase: PhaseKind::Aqueous,
                volume_ml: aq_vol,
                density_g_ml: 1.0 + (ionic_str.unwrap_or(0.0) * 0.03).min(0.2),
                refractive_index: 1.333,
                absorbance_per_cm: a_per_cm.to_vec(),
                scatter_per_cm: scatter,
                scatter_rgb: sc_rgb,
                species: None,
                name: None,
            });
        }

        if org_vol > 0.01 {
            let org_a = [0.0; N_BINS];
            layers.push(LiquidLayer {
                phase: PhaseKind::Organic,
                volume_ml: org_vol,
                density_g_ml: 0.789,
                refractive_index: 1.361,
                absorbance_per_cm: org_a.to_vec(),
                scatter_per_cm: 0.0,
                scatter_rgb: [1.0, 1.0, 1.0],
                species: None,
                name: None,
            });
        }
        // neat liquid compounds: one layer each (own density and colour); densest at the bottom (first)
        layers.extend(self.neat_layers());
        layers.sort_by(|a, b| b.density_g_ml.partial_cmp(&a.density_g_ml).unwrap_or(std::cmp::Ordering::Equal));

        let mut solids = Vec::new();
        let dust = self.dust_mol();
        for (sp, &mol) in &self.solid_mol {
            if mol <= dust {
                continue;
            }
            let thermo = chem_db::get_species_thermo(sp);
            let mass_g = mol * thermo.mw;
            let props = self.solid_props(sp);
            let kind = props.kind;
            let density = props.density_g_ml;

            let settled_vol = (mass_g / density) * 1.6;
            let init_mol = *self.initial_solids.get(sp).unwrap_or(&mol);
            let rem_frac = (mol / init_mol.max(1e-9)).clamp(0.0, 1.0);

            solids.push(SolidVisual {
                species: sp.clone(),
                name: props.name.clone(),
                mass_g,
                settled_volume_ml: settled_vol,
                suspended_fraction: self.ev.susp.get(sp).copied().unwrap_or(if kind == SolidKind::Curds || kind == SolidKind::Gel { 0.8 } else { 0.2 }),
                particle_diameter_um: props.particle_um,
                rgb: props.rgb,
                kind,
                floating: if density < 1.0 || (kind == SolidKind::Metal && self.gas_fluxes.iter().any(|g| g.rate_ml_s > 0.01)) { Some(true) } else { None },
                remaining_fraction: Some(rem_frac),
            });
        }

        let mut fumes = Vec::new();
        for (sp, &mol) in &self.headspace_gas_mol {
            if mol > 1e-5 {
                if let Some(fo) = spectra::fume_optics(sp) {
                    if fo.opacity > 0.01 {
                        fumes.push(FumeVisual {
                            species: sp.clone(),
                            intensity: (mol * 100.0).clamp(0.0, 1.0),
                            rgb: fo.rgb_linear,
                            opacity: fo.opacity,
                            denser_than_air: fo.denser_than_air,
                        });
                    }
                }
            }
        }
        // An open vessel keeps no headspace gas: its fumes are the gases leaving right now (the step's gas fluxes).
        for g in &self.gas_fluxes {
            if g.species == "H2O(g)" || g.rate_ml_s <= 0.0 || fumes.iter().any(|f| f.species == g.species) {
                continue;
            }
            if let Some(fo) = spectra::fume_optics(&g.species) {
                if fo.opacity > 0.01 {
                    fumes.push(FumeVisual {
                        species: g.species.clone(),
                        intensity: (g.rate_ml_s / 25.0).clamp(0.05, 1.0),
                        rgb: fo.rgb_linear,
                        opacity: fo.opacity,
                        denser_than_air: fo.denser_than_air,
                    });
                }
            }
        }

        let flame = if self.flame_active {
            Some(FlameVisual {
                fuel: "Ethanol".to_string(),
                power_w: self.flame_power_w,
                luminosity: 0.05,
                flame_temp_k: 1200.0,
                emitter_rgb: None,
            })
        } else {
            None
        };

        let mut species_rows = Vec::new();
        for (sp, &mol) in &self.species_mol {
            if mol <= 0.0 {
                continue;
            }
            let thermo = chem_db::get_species_thermo(sp);
            let c_m = if total_liq_ml > 0.01 { Some(mol / (total_liq_ml / 1000.0)) } else { None };
            species_rows.push(SpeciesRow {
                id: sp.clone(),
                name: self.display_name(sp),
                formula: sp.clone(),
                charge: thermo.charge,
                phase: if sp == "C2H5OH" || sp.ends_with("(l)") { "organic".to_string() } else { "aqueous".to_string() },
                amount_mol: mol,
                conc_m: c_m,
                activity: c_m,
                tier: self.species_tier(sp),
            });
        }
        for (sp, &mol) in &self.solid_mol {
            if mol <= 0.0 {
                continue;
            }
            let thermo = chem_db::get_species_thermo(sp);
            species_rows.push(SpeciesRow {
                id: sp.clone(),
                name: self.display_name(sp),
                formula: sp.clone(),
                charge: thermo.charge,
                phase: "solid".to_string(),
                amount_mol: mol,
                conc_m: None,
                activity: Some(1.0),
                tier: self.species_tier(sp),
            });
        }

        // Boiling is whatever the thermal step actually boiled (water, ethanol, any imported compound): a real vapour
        // flow of a liquid that is there. No liquid, no boil, no steam, no condensation.
        let has_liquid = total_liq_ml > 0.01;
        let is_boiling = has_liquid && self.boil_vapour_ml_s > 0.0;
        // bubbling vigour from the vapour flow: a gentle simmer (~20 mL/s of vapour) to a hard boil (500+ mL/s)
        let boil_intensity = if is_boiling { (1.0 - (-self.boil_vapour_ml_s / 150.0).exp()).clamp(0.12, 1.0) } else { 0.0 };
        let vap_visibility = if !has_liquid {
            0.0
        } else {
            let hot = if self.temperature_k > 330.0 { ((self.temperature_k - 330.0) / 43.15).clamp(0.0, 1.0) } else { 0.0 };
            if is_boiling { hot.max(boil_intensity) } else { hot }
        };
        let condensation = if has_liquid && self.temperature_k > self.room_k + 5.0 {
            ((self.temperature_k - self.room_k) / 40.0).clamp(0.0, 1.0)
        } else {
            0.0
        };

        let mut total_gas_rate = 0.0;
        for g in &self.gas_fluxes {
            total_gas_rate += g.rate_ml_s;
        }
        let foam = (total_gas_rate / 50.0).clamp(0.0, 0.95);

        let (current_elements, mut unparsed_now) = self.element_inventory();
        let (element_errors, max_rel, max_abs, elements_ok) = conservation::audit_elements(&self.ledger, &current_elements);
        for sp in &self.ledger.unverified {
            if !unparsed_now.contains(sp) {
                unparsed_now.push(sp.clone());
            }
        }
        unparsed_now.sort();

        // net charge: tolerance scales with the amount of charge carried (1e-6 relative, 1e-13 mol floor)
        let charge_err = self.calc_charge_imbalance();
        let charge_scale: f64 = self
            .species_mol
            .iter()
            .map(|(sp, &mol)| mol * (chem_db::get_species_thermo(sp).charge as f64).abs())
            .sum();
        let charge_ok = charge_err <= (conservation::ELEMENT_REL_TOL * charge_scale).max(conservation::ELEMENT_DUST_MOL);
        let conservation = ConservationInfo {
            ok: elements_ok && charge_ok,
            max_element_rel_err: max_rel,
            max_element_abs_err_mol: max_abs,
            charge_err_mol: charge_err,
            element_errors,
            unverified_species: unparsed_now,
        };

        VesselSnapshot {
            t_sim_s: self.t_sim_s,
            temperature_k: self.temperature_k,
            room_k: self.room_k,
            bath_k: self.bath_k,
            pressure_atm: self.pressure_atm,
            sealed: self.sealed,
            burst: self.burst,
            ph,
            ionic_strength: ionic_str,
            layers,
            total_liquid_ml: total_liq_ml,
            solids,
            gas_fluxes: self.gas_fluxes.clone(),
            foam,
            boil_intensity,
            evaporation_g_s: if is_boiling { self.boil_mass_g_s } else { 0.001 },
            vapour_visibility: vap_visibility,
            condensation,
            fumes,
            flame,
            contents_mass_g: self.contents_mass_g(),
            mass_lost_g: self.mass_lost_g,
            heat_input_w: self.controls.heater_w.unwrap_or(0.0) + self.controls.burner_w.unwrap_or(0.0),
            net_reaction_heat_w: self.recent_reaction_heat_w,
            species: species_rows,
            reactions: self.active_reactions.clone(),
            conservation,
            events: self.events.clone(),
            gas: self.gas_info(),
        }
    }

    pub fn equilibrate(&mut self, max_sim_s: f64) {
        let dt = 0.05;
        let mut t = 0.0;
        while t < max_sim_s {
            let _ = self.step(dt);
            t += dt;
        }
    }

    pub fn total_liquid_volume_ml(&self) -> f64 {
        self.aqueous_volume_ml() + self.organic_volume_ml() + self.neat_volume_ml()
    }

    /// Volume the solution chemistry (equilibria, kinetics) happens in: water plus the miscible ethanol phase.
    /// Immiscible neat liquid compounds are separate layers and do not dilute it.
    pub fn reaction_volume_ml(&self) -> f64 {
        self.aqueous_volume_ml() + self.organic_volume_ml()
    }

    /// Volume (mL) of the aqueous solvent itself (water at 1 g/mL). This is the concentration basis of the equilibrium
    /// solver, of the reported pH and of dissolved-gas bookkeeping until Stage 3 makes volumes per-phase.
    pub fn solvent_volume_ml(&self) -> f64 {
        let h2o_mol = self.species_mol.get("H2O").copied().unwrap_or(0.0);
        if h2o_mol <= MIN_AQUEOUS_H2O_MOL {
            return 0.0;
        }
        h2o_mol * 18.015
    }

    /// True when there is enough water for an aqueous phase to exist.
    pub fn has_aqueous_phase(&self) -> bool {
        self.species_mol.get("H2O").copied().unwrap_or(0.0) > MIN_AQUEOUS_H2O_MOL
    }

    pub fn aqueous_volume_ml(&self) -> f64 {
        let base_vol = self.solvent_volume_ml();
        if base_vol <= 0.0 {
            return 0.0;
        }
        let mut solute_vol = 0.0;
        for (sp, &mol) in &self.species_mol {
            if sp != "H2O" && sp != "C2H5OH" && !sp.ends_with("(l)") && !sp.ends_with("(s)") && !sp.ends_with("(g)") && mol > 0.0 {
                let mw = chem_db::get_species_thermo(sp).mw;
                solute_vol += mol * mw / 2.0;
            }
        }
        base_vol + solute_vol
    }

    pub fn organic_volume_ml(&self) -> f64 {
        let etoh_mol = *self.species_mol.get("C2H5OH").unwrap_or(&0.0);
        etoh_mol * 46.069 / 0.789
    }

    pub fn contents_mass_g(&self) -> f64 {
        let mut m = 0.0;
        for (sp, &mol) in &self.species_mol {
            let thermo = chem_db::get_species_thermo(sp);
            m += mol * thermo.mw;
        }
        for (sp, &mol) in &self.solid_mol {
            let thermo = chem_db::get_species_thermo(sp);
            m += mol * thermo.mw;
        }
        m
    }

    /// pH = -log10 of the solver's H+ concentration (mol per litre of aqueous solvent, the solver's own basis; activity
    /// coefficients arrive with Stage 3). No clamp: concentrated acids and bases read below 0 / above 14.
    /// Without any H+ the OH- amount fixes it through the solver's own water equilibrium (Kw(T)); with neither, the
    /// neutral point of that equilibrium is returned.
    pub fn current_ph(&self) -> f64 {
        let vol_l = self.solvent_volume_ml() / 1000.0;
        if vol_l <= 0.0 {
            return f64::NAN;
        }
        let h = self.species_mol.get("H+").copied().unwrap_or(0.0);
        if h > 0.0 {
            return -(h / vol_l).log10();
        }
        // pKw(T) from the registered water equilibrium (H2O <=> H+ + OH-), found structurally
        let pkw = self
            .equilibria
            .iter()
            .find(|e| {
                e.reactants.len() == 1
                    && e.reactants.contains_key("H2O")
                    && e.products.len() == 2
                    && e.products.contains_key("H+")
                    && e.products.contains_key("OH-")
            })
            .map(|e| -e.log_k_at(self.temperature_k))
            .unwrap_or_else(|| -chem_db::water_log_kw(self.temperature_k));
        let oh = self.species_mol.get("OH-").copied().unwrap_or(0.0);
        if oh > 0.0 {
            pkw + (oh / vol_l).log10()
        } else {
            0.5 * pkw
        }
    }

    pub fn concentrations_m(&self) -> HashMap<String, f64> {
        let vol_l = self.aqueous_volume_ml() / 1000.0;
        let mut concs = HashMap::new();
        if vol_l <= 0.0 {
            return concs;
        }
        for (sp, &mol) in &self.species_mol {
            concs.insert(sp.clone(), mol / vol_l);
        }
        concs
    }

    fn calc_ionic_strength(&self) -> f64 {
        let vol_l = self.aqueous_volume_ml() / 1000.0;
        if vol_l <= 0.0 {
            return 0.0;
        }
        let mut sum = 0.0;
        for (sp, &mol) in &self.species_mol {
            let thermo = chem_db::get_species_thermo(sp);
            let z = thermo.charge as f64;
            let c = mol / vol_l;
            sum += c * z * z;
        }
        0.5 * sum
    }

    fn calc_charge_imbalance(&self) -> f64 {
        let mut sum = 0.0;
        for (sp, &mol) in &self.species_mol {
            let thermo = chem_db::get_species_thermo(sp);
            sum += mol * (thermo.charge as f64);
        }
        sum.abs()
    }

    fn calc_turbidity_and_scatter_rgb(&self) -> (f64, [f64; 3]) {
        let mut total_scatter = 0.0;
        let mut rgb_weighted = [0.0_f64; 3];
        let rgb = [1.0, 1.0, 1.0];
        let vol_ml = self.aqueous_volume_ml();
        if vol_ml <= 0.0 {
            return (total_scatter, rgb);
        }
        let dust = self.dust_mol();

        for (sp, &mol) in &self.solid_mol {
            if mol > dust {
                let thermo = chem_db::get_species_thermo(sp);
                let mass_g = mol * thermo.mw;
                let mass_conc = (mass_g / vol_ml) * self.ev.susp.get(sp).copied().unwrap_or(0.8).clamp(0.0, 1.0);
                let props = self.solid_props(sp);
                let sc = optics::scatter_extinction_per_cm(
                    mass_conc,
                    props.particle_um,
                    props.density_g_ml,
                    props.refractive_index,
                    1.333,
                );
                total_scatter += sc;
                // the scattered colour is the scattering-weighted mean of the suspended solids (order independent)
                for k in 0..3 {
                    rgb_weighted[k] += sc * props.rgb[k];
                }
            }
        }
        if total_scatter > 0.0 {
            return (total_scatter, [rgb_weighted[0] / total_scatter, rgb_weighted[1] / total_scatter, rgb_weighted[2] / total_scatter]);
        }
        (total_scatter, rgb)
    }

    /// Provenance of the data actually used for a species: the mineral record for a solid, the import record for an
    /// imported compound, else the species thermo table (a species outside it uses a Speculative placeholder).
    pub(crate) fn species_tier(&self, sp: &str) -> ProvenanceTier {
        if sp.ends_with("(s)") {
            if let Some(m) = self.minerals.iter().find(|m| m.solid_species == sp) {
                return m.tier.clone();
            }
        }
        if self.compounds.contains_key(sp.trim_end_matches("(s)").trim_end_matches("(l)")) {
            return ProvenanceTier::Imported;
        }
        chem_db::species_thermo_tier(sp)
    }

    /// Amount (mol) below which a solid is treated as dust: no snapshot row, no suspension state, no turbidity. It is
    /// relative to what the vessel holds (1e-7 of the largest solute/solid amount), with a floor of 1e-13 mol, so a
    /// 22 microlitre droplet keeps its micromole precipitate while a litre vessel still ignores nanomole noise.
    pub(crate) fn dust_mol(&self) -> f64 {
        let mut largest = 0.0_f64;
        for (sp, &mol) in self.species_mol.iter().chain(self.solid_mol.iter()) {
            if sp != "H2O" && mol > largest {
                largest = mol;
            }
        }
        (1e-7 * largest).max(1e-13)
    }

    /// Element inventory of everything the vessel currently holds (solution, solids, headspace, collected gas).
    pub(crate) fn element_inventory(&self) -> (HashMap<String, f64>, Vec<String>) {
        let mut inv: HashMap<String, f64> = HashMap::new();
        let mut unparsed: Vec<String> = Vec::new();
        for map in [&self.species_mol, &self.solid_mol, &self.headspace_gas_mol, &self.vapour_mol, &self.gas.collected_mol] {
            for (sp, &mol) in map {
                if mol <= 0.0 {
                    continue;
                }
                match ions::species_elements(sp) {
                    Some(elems) => {
                        for (elem, count) in elems {
                            *inv.entry(elem).or_insert(0.0) += mol * count;
                        }
                    }
                    None => {
                        if !unparsed.contains(sp) {
                            unparsed.push(sp.clone());
                        }
                    }
                }
            }
        }
        unparsed.sort();
        (inv, unparsed)
    }
}
