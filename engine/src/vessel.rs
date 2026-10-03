//! M5 Vessel implementation. Manages simulation state, multi-species equilibria,
//! chemical kinetics, thermodynamics, phase transfer, and snapshot generation.
//! Fully generalized to support arbitrary reactions, minerals, and compounds from PubChem.

use std::cell::RefCell;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::types::ProvenanceTier;
use crate::chem_db::{self, GeneralEquilibrium, GeneralMineral, GeneralKineticRxn, ReagentCatalogEntry};
use crate::compound_thermo::CompoundThermo;
use crate::optics::{self};
use crate::spectra;
use crate::ions;
use crate::conservation::{self, ElementError, ElementLedger};
use crate::physics::R_GAS;
use crate::activity::ActivityModel;

/// Fraction of the glass heat capacity that follows the contents' temperature on the time scale of a tick (the one
/// glass factor used by dosing, portions, equilibria heat and the thermal step; Stage 2 replaces it with a glass node).
pub(crate) const GLASS_THERMAL_FRACTION: f64 = 0.15;
/// Specific heat of borosilicate glass, J/(g K).
pub(crate) const GLASS_CP_J_G_K: f64 = 0.84;
/// Below this amount of water (mol, ~18 ng) no aqueous phase exists. Every other aqueous tolerance scales with volume.
pub(crate) const MIN_AQUEOUS_H2O_MOL: f64 = 1e-9;
/// Pool-fire burning rate of volatile organic liquid fuels at infinite diameter, kg m-2 s-1, and the extinction-absorption product k*beta,
/// m-1 (Babrauskas, SFPE Handbook of Fire Protection Engineering).
pub(crate) const POOL_BURN_MASS_FLUX_INF_KG_M2_S: f64 = 0.015;
pub(crate) const POOL_BURN_KBETA_PER_M: f64 = 100.0;
/// Species id of the aqueous solvent (the species the aqueous equilibria, pH and ionic activities are written for).
pub(crate) const AQUEOUS_SOLVENT: &str = "H2O";

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
    /// Species id of the main component of a non-aqueous layer; absent for the water-containing layer.
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
    /// The gas phase: the atmosphere an open vessel sits in, or the closed gas mixture of a sealed one.
    pub gas_phase: Option<crate::gas_phase::GasPhaseInfo>,
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
    /// Partial update of the atmosphere an open vessel exchanges with (pressure, dry composition, humidity).
    #[serde(default)]
    pub atmosphere: Option<crate::gas_phase::AtmosphereSpec>,
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
    /// The primary liquid phase: the water-containing phase the solution chemistry runs in (its species and amounts).
    pub species_mol: HashMap<String, f64>,
    /// Immiscible liquid phases beside the primary one (densest first), decided by the liquid-liquid equilibrium.
    pub extra_liquids: Vec<HashMap<String, f64>>,
    pub solid_mol: HashMap<String, f64>,
    pub initial_solids: HashMap<String, f64>,
    /// The closed gas inventory of a sealed vessel: air captured at sealing, the vapour of its liquids (species id
    /// "X(g)") and evolved gas, all one gas phase. Empty for an open vessel, whose gas phase is the atmosphere.
    pub headspace_gas_mol: HashMap<String, f64>,
    /// The atmosphere an open vessel exchanges with (room input; see `gas_phase`).
    pub atmosphere: crate::gas_phase::Atmosphere,
    /// Memoised store lookups of the vapour-liquid-equilibrium layer.
    pub(crate) vle_cache: RefCell<crate::vle::VleCache>,
    /// Memoised `Molecule` lookups of the phase models (see `vessel_phase`).
    pub(crate) mol_cache: RefCell<crate::vessel_phase::MolCache>,
    /// Mass flow (g/s) of liquid leaving as vapour below the boiling point in the last step.
    pub evaporation_g_s: f64,
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
    pub phases: crate::phases::PhaseState,
    /// Particle populations for heterogeneous solid transfer (moments mu0-mu3).
    pub particle_populations: HashMap<String, crate::transfer::ParticlePopulation>,
    pub burning_fuel: Option<String>,
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

        let mut v = Self {
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
            extra_liquids: Vec::new(),
            solid_mol: HashMap::new(),
            initial_solids: HashMap::new(),
            headspace_gas_mol: HashMap::new(),
            atmosphere: Default::default(),
            vle_cache: RefCell::new(Default::default()),
            mol_cache: RefCell::new(Default::default()),
            evaporation_g_s: 0.0,
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
            phases: crate::phases::PhaseState::new(temp_k),
            particle_populations: HashMap::new(),
            burning_fuel: None,
        };
        v.update_phases();
        let compounds: Vec<CompoundThermo> = v.compounds.values().cloned().collect();
        for c in &compounds {
            v.register_vle_compound(c);
        }
        if sealed {
            // assembled at room temperature: the headspace holds the atmosphere's gas at that temperature
            let room = v.room_k;
            v.seal_capture(room);
        }
        v
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
        self.dose_with_opt_diameter(dose, None)
    }

    pub fn dose_with_diameter(&mut self, dose: DoseRequest, particle_diameter_um: f64) -> Result<(), String> {
        self.dose_with_opt_diameter(dose, Some(particle_diameter_um))
    }

    fn dose_with_opt_diameter(&mut self, dose: DoseRequest, override_diameter_um: Option<f64>) -> Result<(), String> {
        let entry = self.catalog.get(&dose.reagent_id)
            .ok_or_else(|| format!("Unknown reagent: {}", dose.reagent_id))?
            .clone();

        let temp_add = dose.temperature_k.unwrap_or(self.room_k);
        let head_before = self.headspace_volume_m3();
        let mut total_mass_added_g = 0.0;
        // heat capacity of what is already in the vessel (before this dose goes in)
        let cp_before = self.contents_heat_capacity() + self.glass_heat_capacity();
        let mut added: Vec<(String, f64, bool)> = Vec::new();

        if entry.form == "gas" {
            // a gas reagent is dosed by the volume of gas at room conditions (default 10 mL); its composition holds the
            // mole fractions of its gas species, which go into the headspace (sealed) or are sparged through the liquid
            let vol_ml = dose.volume_ml.unwrap_or(10.0);
            let n_total = self.p_ext_pa() * vol_ml * 1e-6 / (R_GAS * self.room_k);
            let frac_sum: f64 = entry.composition.values().sum::<f64>().max(1e-300);
            let mut parts: Vec<(String, f64)> = entry.composition.iter().map(|(k, v)| (k.clone(), n_total * v / frac_sum)).collect();
            parts.sort_by(|a, b| a.0.cmp(&b.0));
            for (gas_id, mol) in parts {
                self.dose_gas(&gas_id, mol);
            }
        } else if entry.form == "solid" || entry.by_mass {
            let mass_g = dose.mass_g.unwrap_or(1.0);
            total_mass_added_g += mass_g;
            for (species, &mol_per_g) in &entry.composition {
                let mol = mol_per_g * mass_g;
                if species.ends_with("(s)") {
                    *self.solid_mol.entry(species.clone()).or_insert(0.0) += mol;
                    *self.initial_solids.entry(species.clone()).or_insert(0.0) += mol;
                    let props = self.solid_props(species);
                    let d_m = override_diameter_um.map(|u| u * 1e-6).unwrap_or(props.particle_um * 1e-6);
                    let solid_mass_g = mol * chem_db::get_species_thermo(species).mw;
                    self.particle_populations.entry(species.clone())
                        .and_modify(|p| p.add_solid(solid_mass_g, props.density_g_ml, d_m))
                        .or_insert_with(|| crate::transfer::ParticlePopulation::from_mass_and_diameter(solid_mass_g, props.density_g_ml, d_m));
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
            // The catalog composition is a recipe: its solutes are the labelled concentration, its solvent fills the volume at
            // 20 C (`reagent_recipe`); the dose is `vol_ml` of the liquid at its own temperature, whose volume the volume
            // model derives from the recipe. Density, molarity and the mass added (hence its heat) follow from that.
            let recipe = self.reagent_recipe(&entry.composition);
            let unit_volume_ml = self.phase_volume_ml(&recipe, temp_add);
            let scale = if unit_volume_ml > 1e-9 { vol_ml / unit_volume_ml } else { vol_ml };
            for (species, &mol_per_ml) in &recipe {
                let mol = mol_per_ml * scale;
                total_mass_added_g += mol * chem_db::get_species_thermo(species).mw;
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
        self.hold_pressure_after_filling(head_before);

        Ok(())
    }

    /// Volume of the gas space (m^3): the vessel's capacity less its liquid.
    pub(crate) fn headspace_volume_m3(&self) -> f64 {
        ((self.config.capacity_ml - self.total_liquid_volume_ml()).max(10.0)) * 1e-6
    }

    /// Liquid added to a sealed vessel went in through the opening (a stopper with a port, a neck before closing): the
    /// gas it displaced left with it, so adding liquid does not raise the pressure. The gas inventory is scaled by the
    /// headspace volume ratio, the vented gas is booked out. (Gas *dosed* as gas, and reactions, do change the pressure.)
    pub(crate) fn hold_pressure_after_filling(&mut self, head_before_m3: f64) {
        if !self.sealed {
            return;
        }
        let head_after = self.headspace_volume_m3();
        if head_after >= head_before_m3 || head_before_m3 <= 0.0 {
            return;
        }
        let factor = head_after / head_before_m3;
        let ids: Vec<String> = self.headspace_gas_mol.keys().cloned().collect();
        for id in ids {
            let n = self.headspace_gas_mol[&id];
            let vented = n * (1.0 - factor);
            self.headspace_gas_mol.insert(id.clone(), n - vented);
            self.mass_lost_g += vented * chem_db::get_species_thermo(&id).mw;
            self.ledger.book_out(&id, vented);
        }
    }

    /// Solves fast speciation / solubility equilibria right after an addition and records what happened in the log.
    fn settle_after_addition(&mut self) {
        // Whatever solid is in the vessel now was put there by the user: only *new* solids count as precipitates.
        self.sync_known_solids();
        // solids dissolve or melt, liquids split into their phases, at conserved enthalpy
        self.phase_flash();
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
        self.phase_flash();
        self.update_network();
        self.detect_events(true);
        self.update_phases();
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
        let head_before = self.headspace_volume_m3();

        for (sp, mol) in portion.aqueous_mol {
            *self.species_mol.entry(sp).or_insert(0.0) += mol;
        }
        for (sp, mol) in portion.organic_mol {
            *self.species_mol.entry(sp).or_insert(0.0) += mol;
        }
        for (sp, mol) in portion.solid_mol {
            *self.solid_mol.entry(sp.clone()).or_insert(0.0) += mol;
            *self.initial_solids.entry(sp.clone()).or_insert(0.0) += mol;
            let props = self.solid_props(&sp);
            let d_m = props.particle_um * 1e-6;
            let solid_mass_g = mol * chem_db::get_species_thermo(&sp).mw;
            self.particle_populations.entry(sp.clone())
                .and_modify(|p| p.add_solid(solid_mass_g, props.density_g_ml, d_m))
                .or_insert_with(|| crate::transfer::ParticlePopulation::from_mass_and_diameter(solid_mass_g, props.density_g_ml, d_m));
        }
        for (sp, mol) in book {
            self.ledger.book_in(&sp, mol);
        }

        if added_mass > 0.0 && cp_current + cp_added > 1e-6 {
            self.temperature_k = (self.temperature_k * cp_current + portion.temperature_k * cp_added) / (cp_current + cp_added);
        }

        self.settle_after_addition();
        self.hold_pressure_after_filling(head_before);

        Ok(())
    }

    /// Heat capacity (J/K) of the part of the glass that follows the contents (see `GLASS_THERMAL_FRACTION`).
    pub(crate) fn glass_heat_capacity(&self) -> f64 {
        self.config.glass_mass_g * GLASS_CP_J_G_K * GLASS_THERMAL_FRACTION
    }

    pub fn remove_liquid(&mut self, volume_ml: f64, include_solids: bool) -> Result<Portion, String> {
        let t = self.temperature_k;
        let vols: Vec<f64> = self.liquid_maps().map(|m| self.phase_volume_ml(m, t)).collect();
        let total_vol: f64 = vols.iter().sum();
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
        let fractions = vec![frac; vols.len()];
        Ok(self.draw_off(&fractions, if include_solids { frac } else { 0.0 }, total_vol * frac))
    }

    /// Takes `fractions[p]` of every liquid phase `p` (primary phase first) and `solid_fraction` of the solids; returns
    /// them as a portion (water-containing phases as `aqueous_mol`, the others as `organic_mol`).
    fn draw_off(&mut self, fractions: &[f64], solid_fraction: f64, volume_ml: f64) -> Portion {
        let mut aq_mol = HashMap::new();
        let mut org_mol: HashMap<String, f64> = HashMap::new();
        let n_phases = 1 + self.extra_liquids.len();
        for p in 0..n_phases {
            let f = fractions.get(p).copied().unwrap_or(0.0);
            if f <= 0.0 {
                continue;
            }
            let aqueous = {
                let m = if p == 0 { &self.species_mol } else { &self.extra_liquids[p - 1] };
                self.phase_is_aqueous(m)
            };
            let m = if p == 0 { &mut self.species_mol } else { &mut self.extra_liquids[p - 1] };
            for (sp, mol) in m.iter_mut() {
                let removed = *mol * f;
                *mol -= removed;
                if aqueous {
                    *aq_mol.entry(sp.clone()).or_insert(0.0) += removed;
                } else {
                    *org_mol.entry(sp.clone()).or_insert(0.0) += removed;
                }
            }
        }
        self.species_mol.retain(|_, v| *v > 0.0);
        self.extra_liquids.iter_mut().for_each(|m| m.retain(|_, v| *v > 0.0));
        self.extra_liquids.retain(|m| !m.is_empty());

        let mut s_mol = HashMap::new();
        if solid_fraction > 0.0 {
            for (sp, mol) in self.solid_mol.iter_mut() {
                let removed = *mol * solid_fraction;
                *mol -= removed;
                s_mol.insert(sp.clone(), removed);
            }
        }
        for (sp, mol) in aq_mol.iter().chain(org_mol.iter()).chain(s_mol.iter()) {
            self.ledger.book_out(sp, *mol);
        }
        self.update_phases();
        Portion { volume_ml, temperature_k: self.temperature_k, aqueous_mol: aq_mol, organic_mol: org_mol, solid_mol: s_mol }
    }

    /// Drain from the bottom (separatory funnel): the densest liquid phase leaves first, then the next one, in the order
    /// of the computed phase densities. Settled solids leave with the bottom phase. `remove_liquid` (proportional over
    /// everything) is unchanged.
    pub fn remove_liquid_bottom(&mut self, volume_ml: f64, include_solids: bool) -> Result<Portion, String> {
        let t = self.temperature_k;
        let info: Vec<(f64, f64)> = self
            .liquid_maps()
            .map(|m| {
                let v = self.phase_volume_ml(m, t);
                (if v > 1e-12 { self.phase_mass_g(m) / v } else { 0.0 }, v)
            })
            .collect();
        let total_vol: f64 = info.iter().map(|x| x.1).sum();
        if total_vol <= 1e-6 || volume_ml <= 0.0 {
            return self.remove_liquid(0.0, include_solids);
        }
        let mut order: Vec<usize> = (0..info.len()).collect();
        order.sort_by(|&a, &b| info[b].0.partial_cmp(&info[a].0).unwrap_or(std::cmp::Ordering::Equal));
        let mut left = volume_ml.clamp(0.0, total_vol);
        let mut fractions = vec![0.0; info.len()];
        let mut taken = 0.0;
        let mut solid_fraction = 0.0;
        for (rank, &p) in order.iter().enumerate() {
            if left <= 0.0 {
                break;
            }
            let take = left.min(info[p].1);
            fractions[p] = if info[p].1 > 1e-12 { (take / info[p].1).clamp(0.0, 1.0) } else { 0.0 };
            if rank == 0 {
                solid_fraction = fractions[p];
            }
            left -= take;
            taken += take;
        }
        Ok(self.draw_off(&fractions, if include_solids { solid_fraction } else { 0.0 }, taken))
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
        if let Some(spec) = &controls.atmosphere {
            self.atmosphere.apply(spec);
            if !self.sealed {
                self.pressure_atm = self.atmosphere.pressure_atm;
            }
        }
        if let Some(seal) = controls.sealed {
            self.controls.sealed = Some(seal);
            if seal && !self.sealed {
                self.sealed = true;
                let t = self.temperature_k;
                self.seal_capture(t);
            } else if !seal && self.sealed {
                self.sealed = false;
                self.vent_headspace();
                self.pressure_atm = self.atmosphere.pressure_atm;
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

        // 1. Generalized chemical kinetics & combustion
        let q_kinetics = self.step_kinetics(dt_s);
        reaction_heat_joules += q_kinetics;

        // 1b. Generalized redox reactions (electron transfer between couples via GEM driving force)
        let q_redox = self.step_redox(dt_s);
        reaction_heat_joules += q_redox;

        // 1c. Thermal decomposition of solids (solid -> solid + gas via GEM driving force)
        let q_decomp = self.step_thermal_decomposition(dt_s);
        reaction_heat_joules += q_decomp;

        // 1d. Heterogeneous metal acid corrosion (Butler-Volmer mixed potential)
        let q_corrosion = self.step_corrosion(dt_s);
        reaction_heat_joules += q_corrosion;

        // 1e. Heterogeneous solid dissolution and growth (Sherwood transport)
        let q_dissolution = self.step_dissolution_and_growth(dt_s);
        reaction_heat_joules += q_dissolution;
        eprintln!("AFTER 1e: solid={:?}, species={:?}", self.solid_mol, self.species_mol);

        // 2. Generalized aqueous equilibria & mineral precipitation
        for _ in 0..5 {
            self.eq_moved = false;
            let q_eq = self.step_equilibria(dt_s * 0.2);
            reaction_heat_joules += q_eq;
            if !self.eq_moved || self.eq_converged {
                break;
            }
        }

        // 2b. Dissolved gases exchange with the gas phase through Henry's constant (every gas of the species store with an
        // aqueous twin: CO2, O2, NH3, ...), and supersaturated gas leaves as bubbles.
        reaction_heat_joules += self.step_gas_exchange(dt_s);

        self.recent_reaction_heat_w = reaction_heat_joules / dt_s;

        // 3. Thermal energy balance
        self.step_thermal(dt_s, reaction_heat_joules);

        // 4. Headspace pressure & gas accumulation / venting
        self.step_headspace(dt_s);

        self.update_suspension(dt_s);

        // 5. Generic reaction log
        self.detect_events(false);

        self.update_phases();

        Ok(())
    }

    fn step_kinetics(&mut self, dt_s: f64) -> f64 {
        let mut q_joules = 0.0;
        let t_k = self.temperature_k;
        let vol_l = self.reaction_volume_ml() / 1000.0;
        let r_ideal = R_GAS;
        let mut gas_out: Vec<(String, f64)> = Vec::new();

        if vol_l <= 0.0 || self.kinetic_reactions.is_empty() {
            // General pool fire combustion of volatile liquid fuels with atmospheric oxygen
            q_joules += self.step_combustion(dt_s);
            return q_joules;
        }

        let p_pa = self.pressure_atm * 101325.0;
        let ionic_str = self.calc_ionic_strength();

        // Collect all species involved across all kinetic reactions
        let mut species_set: Vec<String> = Vec::new();
        let mut spec_map: HashMap<String, usize> = HashMap::new();

        let get_or_add_species = |sp: &str, set: &mut Vec<String>, map: &mut HashMap<String, usize>| -> usize {
            if let Some(&idx) = map.get(sp) {
                idx
            } else {
                let idx = set.len();
                set.push(sp.to_string());
                map.insert(sp.to_string(), idx);
                idx
            }
        };

        let mut extent_reactions = Vec::new();
        for rxn in &self.kinetic_reactions {
            let mut reactants = Vec::new();
            for (r, &c) in &rxn.reactants {
                let idx = get_or_add_species(r, &mut species_set, &mut spec_map);
                reactants.push((idx, c));
            }

            let mut products = Vec::new();
            for (p, &c) in &rxn.products {
                let idx = get_or_add_species(p, &mut species_set, &mut spec_map);
                products.push((idx, c));
            }

            let mut gas_products = Vec::new();
            for (g, &c) in &rxn.gas_products {
                gas_products.push((g.clone(), c));
            }

            let mut orders_reactants = Vec::new();
            if let Some(ref ord_map) = rxn.orders {
                for (r, &ord) in ord_map {
                    if let Some(&idx) = spec_map.get(r) {
                        orders_reactants.push((idx, ord));
                    }
                }
            } else {
                orders_reactants = reactants.clone();
            }

            let orders_products = products.clone();

            extent_reactions.push(crate::kinetics::KineticExtentReaction {
                id: rxn.id.clone(),
                equation: rxn.equation.clone(),
                reactants,
                products,
                gas_products,
                orders_reactants,
                orders_products,
                arrhenius_a: rxn.arrhenius_a,
                arrhenius_n: rxn.arrhenius_n,
                arrhenius_ea: rxn.arrhenius_ea,
                delta_h_kj: rxn.delta_h_kj,
                catalyst_species: rxn.catalyst_species.clone(),
                is_reversible: rxn.is_reversible,
                k_eq_298: rxn.k_eq_298,
                tier: rxn.tier.clone(),
                source: rxn.source.clone(),
            });
        }

        let num_spec = species_set.len();
        let mut initial_moles = vec![0.0; num_spec];
        for (i, sp) in species_set.iter().enumerate() {
            initial_moles[i] = self.species_mol.get(sp).copied()
                .or_else(|| self.solid_mol.get(sp).copied())
                .unwrap_or(0.0);
        }

        let system = crate::kinetics::KineticExtentSystem::new(species_set.clone(), extent_reactions);
        let (extents, rates) = system.integrate_extent_step(
            &initial_moles,
            dt_s,
            vol_l,
            t_k,
            p_pa,
            ionic_str,
            &self.solid_mol,
        );

        for (r_idx, rxn) in self.kinetic_reactions.iter().enumerate() {
            let extent = extents[r_idx];
            if extent <= 1e-15 {
                continue;
            }

            // Apply consumption of reactants
            for (reactant, &coeff) in &rxn.reactants {
                let d = extent * coeff;
                if let Some(m) = self.species_mol.get_mut(reactant) {
                    *m = (*m - d).max(0.0);
                } else if let Some(m) = self.solid_mol.get_mut(reactant) {
                    *m = (*m - d).max(0.0);
                }
            }

            // Apply formation of products
            for (prod, &coeff) in &rxn.products {
                let d = extent * coeff;
                if prod.ends_with("(s)") {
                    *self.solid_mol.entry(prod.clone()).or_default() += d;
                } else {
                    *self.species_mol.entry(prod.clone()).or_default() += d;
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
                rate: rates[r_idx],
                log_q_over_k: None,
                tier: rxn.tier.clone(),
                source: rxn.source.clone(),
                active: true,
            });
        }

        for (sp, mol) in gas_out {
            self.ledger.book_out(&sp, mol);
        }

        // General pool fire combustion of volatile liquid fuels with atmospheric oxygen
        q_joules += self.step_combustion(dt_s);

        q_joules
    }

    /// General pool fire combustion of any volatile organic liquid fuels present (C_x H_y O_z).
    /// Requires oxygen (y_O2 >= 0.12); extinguishes under N2, vacuum, or when fuel is exhausted.
    pub(crate) fn step_combustion(&mut self, dt_s: f64) -> f64 {
        let igniter_active = self.controls.igniter.unwrap_or(false);
        let t_k = self.temperature_k;

        // Limiting Oxygen Concentration (LOC): hydrocarbons and alcohols need y_O2 >= 0.12 to ignite/burn
        const MIN_O2_MOL_FRAC: f64 = 0.12;
        let y_o2 = if self.sealed {
            let total_head: f64 = self.headspace_gas_mol.values().sum();
            if total_head > 1e-12 {
                self.headspace_gas_mol.get("O2(g)").or_else(|| self.headspace_gas_mol.get("O2")).copied().unwrap_or(0.0) / total_head
            } else {
                0.0
            }
        } else {
            self.atmosphere.composition.iter().find(|(k, _)| k == "O2" || k == "O2(g)").map(|(_, v)| *v).unwrap_or(0.0)
        };

        // Extinguish flame if oxygen is depleted (e.g. under N2 atmosphere or vacuum)
        if self.flame_active && y_o2 < MIN_O2_MOL_FRAC {
            self.flame_active = false;
            self.flame_power_w = 0.0;
            self.push_event(VesselEventKind::FlameOut, "Flame extinguished: oxygen starved".to_string(), 0.3);
            return 0.0;
        }

        // Find all combustible volatile liquid species (contain C and H)
        let mut combustible_fuels: Vec<(String, f64, f64, f64)> = Vec::new(); // (species_id, amount_mol, mw, delta_c_h_j_mol)
        let keys: Vec<String> = self.species_mol.keys().cloned().collect();
        for sp in &keys {
            let mol = self.liquid_total(sp);
            if mol <= 1e-6 {
                continue;
            }
            if let Some(elems) = crate::ions::species_elements(sp) {
                let c_count = elems.get("C").copied().unwrap_or(0.0);
                let h_count = elems.get("H").copied().unwrap_or(0.0);
                if c_count > 0.0 && h_count > 0.0 {
                    let mw = chem_db::get_species_thermo(sp).mw;
                    // General combustion enthalpy ~ 29-45 kJ/g for volatile organics
                    let dh_c_j_mol = mw * 30000.0;
                    combustible_fuels.push((sp.clone(), mol, mw, dh_c_j_mol));
                }
            }
        }

        let total_fuel_mol: f64 = combustible_fuels.iter().map(|f| f.1).sum();

        if igniter_active && y_o2 >= MIN_O2_MOL_FRAC && total_fuel_mol > 1e-5 && t_k >= 286.0 {
            if !self.flame_active {
                self.flame_active = true;
                self.push_event(VesselEventKind::Ignition, "Flammable vapour ignited".to_string(), 0.6);
            }
        }

        if !self.flame_active {
            return 0.0;
        }

        if total_fuel_mol <= 1e-6 {
            self.flame_active = false;
            self.flame_power_w = 0.0;
            self.push_event(VesselEventKind::FlameOut, "Combustion fuel exhausted".to_string(), 0.2);
            return 0.0;
        }

        // Babrauskas pool fire model
        let area_cm2 = std::f64::consts::PI * self.config.inner_radius_cm.powi(2);
        let diameter_m = 2.0 * self.config.inner_radius_cm / 100.0;
        let m_flux_kg_m2_s = POOL_BURN_MASS_FLUX_INF_KG_M2_S * (1.0 - (-POOL_BURN_KBETA_PER_M * diameter_m).exp());
        let burn_g_s = m_flux_kg_m2_s * 1000.0 * area_cm2 / 1.0e4;

        let mut q_joules = 0.0;
        let mut total_heat_w = 0.0;

        let mut main_fuel = None;
        let mut max_fuel_mol = 0.0;
        for (fuel, mol, mw, dh_c) in combustible_fuels {
            if mol > max_fuel_mol {
                max_fuel_mol = mol;
                main_fuel = Some(fuel.clone());
            }
            let frac = mol / total_fuel_mol;
            let fuel_burn_g_s = burn_g_s * frac;
            let fuel_burn_mol_s = fuel_burn_g_s / mw.max(1.0);
            let mol_burned = (fuel_burn_mol_s * dt_s).min(mol);

            let left = mol - mol_burned;
            self.set_liquid_total(&fuel, left);
            self.mass_lost_g += mol_burned * mw;
            self.ledger.book_out(&fuel, mol_burned);

            let heat_w = fuel_burn_mol_s * dh_c;
            total_heat_w += heat_w;
            q_joules += heat_w * 0.15 * dt_s;
        }

        self.burning_fuel = main_fuel;
        self.flame_power_w = total_heat_w;
        q_joules
    }

    pub fn set_particle_population(&mut self, species: &str, pop: crate::transfer::ParticlePopulation) {
        self.particle_populations.insert(species.to_string(), pop);
    }

    /// Heterogeneous metal acid corrosion via Butler-Volmer mixed potential model.
    pub(crate) fn step_corrosion(&mut self, dt_s: f64) -> f64 {
        if dt_s <= 0.0 || self.solid_mol.is_empty() || self.aqueous_volume_ml() <= 1e-6 {
            return 0.0;
        }
        let ph = self.current_ph();
        let t_k = self.temperature_k;
        let mut q_joules = 0.0;
        let solid_keys: Vec<String> = self.solid_mol.keys().cloned().collect();

        for sp in solid_keys {
            let solid_mol = match self.solid_mol.get(&sp).copied() {
                Some(m) if m > 1e-12 => m,
                _ => continue,
            };
            let base_name = sp.trim_end_matches("(s)").trim();
            if !crate::transfer::corrosion::is_corrodible_metal(base_name) {
                continue;
            }

            let area_m2 = if let Some(pop) = self.particle_populations.get(&sp) {
                pop.surface_area_m2().max(1e-4)
            } else {
                0.001
            };

            let res = crate::transfer::corrosion::step_corrosion(base_name, ph, t_k, area_m2, dt_s);

            if res.mol_metal_dissolved > 0.0 {
                let actual_diss = res.mol_metal_dissolved.min(solid_mol);
                let ratio = if res.mol_metal_dissolved > 0.0 { actual_diss / res.mol_metal_dissolved } else { 0.0 };

                let props = self.solid_props(&sp);
                if let Some(sm) = self.solid_mol.get_mut(&sp) {
                    *sm = (*sm - actual_diss).max(0.0);
                }
                if let Some(pop) = self.particle_populations.get_mut(&sp) {
                    let mw = chem_db::get_species_thermo(&sp).mw;
                    pop.scale_to_mass((solid_mol - actual_diss).max(0.0) * mw, props.density_g_ml);
                }

                let cation = format!("{}+2", base_name);
                *self.species_mol.entry(cation).or_insert(0.0) += actual_diss;

                let h_cons = res.mol_h_consumed * ratio;
                if let Some(h) = self.species_mol.get_mut("H+") {
                    *h = (*h - h_cons).max(0.0);
                }

                let h2_mol = res.mol_h2_gas * ratio;
                if h2_mol > 0.0 {
                    if self.sealed {
                        *self.headspace_gas_mol.entry("H2(g)".to_string()).or_insert(0.0) += h2_mol;
                    } else {
                        let ml_s = (h2_mol / dt_s) * 24400.0;
                        self.gas_fluxes.push(GasFlux {
                            species: "H2(g)".to_string(),
                            rate_ml_s: ml_s,
                            bubble_diameter_mm: 1.5,
                            nucleation: "solid".to_string(),
                        });
                        self.gas.escaped_mol += h2_mol;
                    }
                    self.ledger.book_out("H2(g)", h2_mol);
                    self.push_event(VesselEventKind::GasEvolved, format!("Hydrogen gas evolved from {} corrosion", base_name), 0.4);
                }

                q_joules += res.heat_j * ratio;
            }
        }

        self.solid_mol.retain(|_, m| *m > 1e-12);
        q_joules
    }

    /// Rate-limited heterogeneous solid dissolution and growth via Sherwood mass-transfer correlation.
    pub(crate) fn step_dissolution_and_growth(&mut self, dt_s: f64) -> f64 {
        if dt_s <= 0.0 || self.solid_mol.is_empty() || self.total_liquid_volume_ml() <= 1e-6 {
            return 0.0;
        }
        let vol_l = (self.reaction_volume_ml() / 1000.0).max(1e-9);
        let t_k = self.temperature_k;
        let stirring = self.controls.stirring.unwrap_or(false);
        let stir_rpm = self.controls.stir_rpm.unwrap_or(if stirring { 300.0 } else { 0.0 });
        let eta_fluid = crate::transport::viscosity_water_pa_s(t_k);
        let rho_fluid = 1000.0;
        let nu_fluid = eta_fluid / rho_fluid;
        let diff_fluid = 1.5e-9 * (t_k / 298.15) * (crate::transport::viscosity_water_pa_s(298.15) / eta_fluid);

        let mut q_joules = 0.0;
        let solid_keys: Vec<String> = self.solid_mol.keys().cloned().collect();

        for sp in solid_keys {
            let solid_mol = match self.solid_mol.get(&sp).copied() {
                Some(m) if m > 1e-12 => m,
                _ => continue,
            };
            let props = self.solid_props(&sp);
            let mw = chem_db::get_species_thermo(&sp).mw.max(10.0);
            let rho_g_ml = props.density_g_ml.max(0.1);

            let mut pop = self.particle_populations.remove(&sp).unwrap_or_else(|| {
                crate::transfer::ParticlePopulation::from_mass_and_diameter(solid_mol * mw, rho_g_ml, props.particle_um * 1e-6)
            });

            let mut c_sat_mol_m3 = 0.0;
            let mut c_bulk_mol_m3 = 0.0;
            let mut dh_diss_j = 0.0;
            let mut ions_produced: Vec<(String, f64)> = Vec::new();

            if let Some(min) = self.minerals.iter().find(|m| m.solid_species == sp).cloned() {
                if !min.dissolved_products.is_empty() {
                    let log_ksp = min.log_ksp_at(t_k);
                    let ksp = 10.0_f64.powf(log_ksp);
                    let nu_sum: f64 = min.dissolved_products.values().sum();
                    let nu_prod: f64 = min.dissolved_products.values().map(|c| c.powf(*c)).product();
                    let s_sat_mol_l = (ksp / nu_prod.max(1e-30)).powf(1.0 / nu_sum.max(1.0));
                    c_sat_mol_m3 = s_sat_mol_l * 1000.0;

                    let mut s_bulk_mol_l = f64::INFINITY;
                    for (ion, &coeff) in &min.dissolved_products {
                        let amt = self.species_mol.get(ion).copied().unwrap_or(0.0);
                        let conc = (amt / vol_l) / coeff;
                        s_bulk_mol_l = s_bulk_mol_l.min(conc);
                        ions_produced.push((ion.clone(), coeff));
                    }
                    if s_bulk_mol_l.is_infinite() {
                        s_bulk_mol_l = 0.0;
                    }
                    c_bulk_mol_m3 = (s_bulk_mol_l.max(0.0)) * 1000.0;
                    dh_diss_j = min.delta_h_kj * 1000.0;
                }
            } else if let Some(c) = self.compound_for(&sp) {
                let aq_key = self.liquid_key_of_solid(&sp).unwrap_or_else(|| sp.trim_end_matches("(s)").to_string());
                let is_partitionable = self.molecule(&aq_key).map_or(false, |m| m.partitionable());
                if !is_partitionable {
                    let sol_g_l = c.solubility_g_per_l.unwrap_or(10.0);
                    let s_sat_mol_l = sol_g_l / mw;
                    c_sat_mol_m3 = s_sat_mol_l * 1000.0;
                    let amt = self.species_mol.get(&aq_key).copied().unwrap_or(0.0);
                    c_bulk_mol_m3 = (amt / vol_l) * 1000.0;
                    ions_produced.push((aq_key, 1.0));
                    dh_diss_j = c.dh_fus_kj_mol.map(|d| d * 1000.0).unwrap_or(15000.0);
                }
            }

            if c_sat_mol_m3 > 0.0 && c_bulk_mol_m3 < c_sat_mol_m3 {
                let res = crate::transfer::dissolution::step_particle_dissolution(
                    &mut pop,
                    solid_mol,
                    mw,
                    rho_g_ml,
                    diff_fluid,
                    nu_fluid,
                    stir_rpm,
                    c_sat_mol_m3,
                    c_bulk_mol_m3,
                    dt_s,
                );

                if res.moles_dissolved > 0.0 {
                    let dm = res.moles_dissolved;
                    for (prod, coeff) in ions_produced {
                        *self.species_mol.entry(prod).or_insert(0.0) += coeff * dm;
                    }
                    if let Some(sm) = self.solid_mol.get_mut(&sp) {
                        *sm = (*sm - dm).max(0.0);
                    }
                    q_joules -= dm * dh_diss_j;
                }

                if res.fully_depleted {
                    self.solid_mol.remove(&sp);
                    self.push_event(VesselEventKind::SolidDissolved, format!("{} dissolved completely", props.name), 0.3);
                } else {
                    self.particle_populations.insert(sp, pop);
                }
            } else {
                self.particle_populations.insert(sp, pop);
            }
        }

        self.solid_mol.retain(|_, m| *m > 1e-12);
        q_joules
    }

    /// Thermal decomposition and dehydration of solids (solid -> solid + gas), driven by GEM thermodynamics.
    pub(crate) fn step_thermal_decomposition(&mut self, dt_s: f64) -> f64 {
        let t_k = self.temperature_k;
        let p_pa = self.pressure_atm * crate::vle::P_BAR_PA;
        let rxns = crate::gem::discovery::discover_thermal_decompositions(&self.solid_mol, t_k, p_pa);
        if rxns.is_empty() {
            return 0.0;
        }

        let mut total_q_joules = 0.0;
        let rt = crate::physics::R_GAS * t_k;

        for rxn in rxns {
            // Find limiting solid reactant
            let mut max_xi = f64::INFINITY;
            let mut can_react = true;

            for &(idx, coeff) in &rxn.nu {
                if coeff < 0.0 {
                    let sp = &rxn.species_names[idx];
                    let amt = self.solid_mol.get(sp).copied().unwrap_or(0.0);
                    if amt <= 1e-9 {
                        can_react = false;
                        break;
                    }
                    let avail = amt / (-coeff);
                    if avail < max_xi {
                        max_xi = avail;
                    }
                }
            }

            if !can_react || max_xi <= 1e-12 {
                continue;
            }

            // Delta G of reaction
            let delta_g = rxn.delta_g0_j;
            if delta_g >= 0.0 {
                // Thermodynamically unfavorable below onset temperature
                continue;
            }

            // Thermal rate driven by driving force -Delta G / RT
            let driving = ((-delta_g) / rt).min(20.0);
            let rate_k = 0.1 * (1.0 - (-driving).exp());
            let extent = (rate_k * dt_s * max_xi).min(max_xi);

            if extent <= 1e-15 {
                continue;
            }

            // Apply reaction extent
            for &(idx, coeff) in &rxn.nu {
                let sp = &rxn.species_names[idx];
                let change = coeff * extent;
                if sp.ends_with("(s)") {
                    let cur = self.solid_mol.entry(sp.clone()).or_insert(0.0);
                    *cur = (*cur + change).max(0.0);
                    if coeff > 0.0 {
                        *self.initial_solids.entry(sp.clone()).or_insert(0.0) += change;
                    }
                } else if sp.ends_with("(g)") {
                    if self.sealed {
                        *self.headspace_gas_mol.entry(sp.clone()).or_insert(0.0) += change;
                    } else {
                        let mw = chem_db::get_species_thermo(sp).mw;
                        self.mass_lost_g += change * mw;
                        self.ledger.book_out(sp, change);
                    }
                }
            }

            total_q_joules -= extent * rxn.delta_h0_j;

            let eq_str = rxn.nu.iter()
                .map(|&(i, c)| format!("{} {}", c, rxn.species_names[i]))
                .collect::<Vec<_>>()
                .join(" + ");

            self.active_reactions.push(ReactionRow {
                id: format!("decomp_{}", rxn.species_names[rxn.nu[0].0]),
                equation: eq_str,
                kind: "thermal_decomposition".to_string(),
                rate: extent / dt_s.max(0.001),
                log_q_over_k: None,
                tier: crate::types::ProvenanceTier::Tabulated,
                source: "Thermodynamics / GEM".to_string(),
                active: true,
            });
        }

        total_q_joules
    }

    /// Generalized redox reactions: electron transfer between couples, metal oxidation / cementation.
    pub(crate) fn step_redox(&mut self, dt_s: f64) -> f64 {
        let t_k = self.temperature_k;
        let p_pa = self.pressure_atm * crate::vle::P_BAR_PA;
        let vol_l = (self.reaction_volume_ml() / 1000.0).max(0.001);

        let rxns = crate::gem::discovery::discover_reactions(&self.species_mol, &self.solid_mol, t_k, p_pa);
        let mut total_q_joules = 0.0;
        let rt = crate::physics::R_GAS * t_k;

        for rxn in rxns {
            if !matches!(rxn.kind, crate::gem::discovery::DiscoveredRxnKind::Redox { .. }) {
                continue;
            }

            // Find limiting reactant
            let mut max_xi = f64::INFINITY;
            let mut can_react = true;
            let mut has_solid_reactant = false;
            let mut solid_area_scale = 1.0;

            for &(idx, coeff) in &rxn.nu {
                if coeff < 0.0 {
                    let sp = &rxn.species_names[idx];
                    let amt = if sp.ends_with("(s)") {
                        has_solid_reactant = true;
                        self.solid_mol.get(sp).copied().unwrap_or(0.0)
                    } else if sp == "H2O" {
                        self.species_mol.get(sp).copied().unwrap_or(55.5)
                    } else {
                        self.species_mol.get(sp).copied().unwrap_or(0.0)
                    };

                    if amt <= 1e-9 {
                        can_react = false;
                        break;
                    }
                    let avail = amt / (-coeff);
                    if avail < max_xi {
                        max_xi = avail;
                    }
                    if sp.ends_with("(s)") {
                        solid_area_scale = (amt * 100.0).clamp(0.05, 5.0);
                    }
                }
            }

            if !can_react || max_xi <= 1e-12 {
                continue;
            }

            // Delta G check: only spontaneous redox reactions proceed forward
            if rxn.delta_g0_j > 0.0 {
                continue;
            }

            // Rate: active metals (Na) react vigorously; heterogeneous rates scale with solid surface contact;
            // homogeneous electron transfer couples are fast
            let is_alkali = rxn.species_names.iter().any(|s| s.starts_with("Na") || s.starts_with("K"));
            let base_rate = if is_alkali {
                5.0
            } else if has_solid_reactant {
                0.2 * solid_area_scale
            } else {
                1.0
            };

            let driving = ((-rxn.delta_g0_j) / rt).min(30.0);
            let driving_factor = 1.0 - (-driving).exp();
            let rate = base_rate * driving_factor;
            let extent = (rate * dt_s * max_xi).min(max_xi);

            if extent <= 1e-15 {
                continue;
            }

            // Apply reaction extent
            for &(idx, coeff) in &rxn.nu {
                let sp = &rxn.species_names[idx];
                let change = coeff * extent;

                if sp.ends_with("(s)") {
                    let cur = self.solid_mol.entry(sp.clone()).or_insert(0.0);
                    *cur = (*cur + change).max(0.0);
                    if coeff > 0.0 {
                        *self.initial_solids.entry(sp.clone()).or_insert(0.0) += change;
                    }
                } else if sp.ends_with("(g)") {
                    if self.sealed {
                        *self.headspace_gas_mol.entry(sp.clone()).or_insert(0.0) += change;
                    } else {
                        let mw = chem_db::get_species_thermo(sp).mw;
                        self.mass_lost_g += change * mw;
                        self.ledger.book_out(sp, change);
                    }
                } else {
                    let cur = self.species_mol.entry(sp.clone()).or_insert(0.0);
                    *cur = (*cur + change).max(0.0);
                }
            }

            total_q_joules -= extent * rxn.delta_h0_j;

            let eq_str = rxn.nu.iter()
                .map(|&(i, c)| format!("{} {}", c, rxn.species_names[i]))
                .collect::<Vec<_>>()
                .join(" + ");

            self.active_reactions.push(ReactionRow {
                id: format!("redox_{}", rxn.species_names[rxn.nu[0].0]),
                equation: eq_str,
                kind: "redox".to_string(),
                rate: extent / (vol_l * dt_s.max(0.001)),
                log_q_over_k: None,
                tier: crate::types::ProvenanceTier::Tabulated,
                source: "Redox / GEM".to_string(),
                active: true,
            });
        }

        total_q_joules
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

        // Solid-liquid and liquid-liquid equilibrium at conserved enthalpy: freezing and melting plateaus, dissolution
        // and crystallisation with their heats, immiscible phases (`vessel_phase`).
        self.phase_flash();

        // Boiling and evaporation of every volatile liquid (open vessel): the bubble point of the actual mixture at the
        // atmosphere's pressure, and evaporation toward the atmosphere's partial pressures below it (see `vessel_vle`).
        let cp_total = (self.contents_heat_capacity() + self.glass_heat_capacity()).max(1.0);
        self.step_boil_open(dt_s, cp_total);
        self.step_evaporation_open(dt_s, cp_total);
    }

    fn step_headspace(&mut self, _dt_s: f64) {
        if !self.sealed {
            self.pressure_atm = self.atmosphere.pressure_atm;
            return;
        }
        // isochoric vapour-liquid flash of the closed gas inventory (air, vapour, evolved gas) at the headspace volume
        let cp_total = (self.contents_heat_capacity() + self.glass_heat_capacity()).max(1.0);
        self.step_sealed_sublimation(cp_total);
        let p_pa = self.step_sealed_flash(cp_total);
        self.pressure_atm = p_pa / 101325.0;

        let pop_thresh = self.config.stopper_pop_atm.unwrap_or(2.2);
        let burst_thresh = self.config.burst_atm.unwrap_or(6.0);

        if self.pressure_atm >= pop_thresh && self.sealed {
            self.sealed = false;
            self.push_event(VesselEventKind::StopperPop, format!("Stopper popped at {:.2} atm", self.pressure_atm), 0.7);
            self.vent_headspace();
            self.pressure_atm = self.atmosphere.pressure_atm;
        } else if self.pressure_atm >= burst_thresh {
            self.burst = true;
            self.sealed = false;
            self.push_event(VesselEventKind::Burst, format!("Vessel burst at {:.2} atm!", self.pressure_atm), 1.0);
            self.vent_headspace();
            self.pressure_atm = self.atmosphere.pressure_atm;
        }
    }

    pub fn snapshot(&self) -> VesselSnapshot {
        let total_liq_ml = self.total_liquid_volume_ml();
        let ph = if self.has_aqueous_phase() { Some(self.current_ph()) } else { None };
        let ionic_str = if self.has_aqueous_phase() { Some(self.calc_ionic_strength()) } else { None };

        // one layer per liquid phase (the phases are the liquid-liquid equilibrium's, densest first)
        let views = self.phase_views();
        let mut layers: Vec<LiquidLayer> = Vec::new();
        for (idx, v) in views.iter().enumerate() {
            if v.volume_ml <= 0.001 {
                continue;
            }
            let aqueous = self.phase_is_aqueous(&v.species_mol);
            let (scatter, sc_rgb) = if idx == 0 { self.calc_turbidity_and_scatter_rgb() } else { (0.0, [1.0, 1.0, 1.0]) };
            // the dominant molecule names a non-aqueous layer
            let lead = if aqueous {
                None
            } else {
                v.species_mol.iter().filter(|(k, _)| ions::species_charge(k) == 0).max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal).then(b.0.cmp(a.0))).map(|(k, _)| k.clone())
            };
            layers.push(LiquidLayer {
                phase: if aqueous { PhaseKind::Aqueous } else { PhaseKind::Organic },
                volume_ml: v.volume_ml,
                density_g_ml: if v.volume_ml > 1e-9 { v.mass_g / v.volume_ml } else { 1.0 },
                refractive_index: crate::props::lorentz_lorenz_refractive_index(&v.species_mol, v.volume_ml),
                absorbance_per_cm: self.phase_absorbance(&v.species_mol, v.volume_ml),
                scatter_per_cm: scatter,
                scatter_rgb: sc_rgb,
                name: lead.as_ref().map(|k| self.display_name(k)),
                species: lead,
            });
        }
        // densest at the bottom (first in the list for rendering order)
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

            let d_um = if let Some(pop) = self.particle_populations.get(sp) {
                pop.mean_diameter_m() * 1e6
            } else {
                props.particle_um
            };

            solids.push(SolidVisual {
                species: sp.clone(),
                name: props.name.clone(),
                mass_g,
                settled_volume_ml: settled_vol,
                suspended_fraction: self.ev.susp.get(sp).copied().unwrap_or(if kind == SolidKind::Curds || kind == SolidKind::Gel { 0.8 } else { 0.2 }),
                particle_diameter_um: d_um,
                rgb: props.rgb,
                kind,
                floating: if density < 1.0 || (kind == SolidKind::Metal && self.gas_fluxes.iter().any(|g| g.rate_ml_s > 0.01)) { Some(true) } else { None },
                remaining_fraction: Some(rem_frac),
            });
        }

        let mut fumes = Vec::new();
        // a sealed vessel's fumes are its evolved gas (not the air it was closed on, nor the vapour of its own liquids)
        for (sp, mol) in self.evolved_headspace() {
            if mol > 1e-5 {
                let sp = &sp;
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
            let fuel_name = self.burning_fuel.clone().unwrap_or_else(|| "Ethanol".to_string());
            let app = crate::transfer::combustion::fuel_flame_appearance(&fuel_name);
            Some(FlameVisual {
                fuel: fuel_name,
                power_w: self.flame_power_w,
                luminosity: app.luminosity,
                flame_temp_k: 1200.0,
                emitter_rgb: app.emitter_rgb,
            })
        } else {
            None
        };

        let solvent_vol_l = (self.solvent_volume_ml() / 1000.0).max(1e-9);
        let gamma_cache: HashMap<String, f64> = if self.has_aqueous_phase() {
            let temp_aq;
            let aq = if let Some(aq_ref) = self.phases.aqueous_phase() {
                aq_ref
            } else {
                temp_aq = {
                    let mut p = crate::phases::LiquidPhase::new_aqueous();
                    p.species_mol = self.species_mol.clone();
                    p
                };
                &temp_aq
            };
            let model = crate::activity::default_activity_model();
            let t_k = self.temperature_k;
            let p_atm = self.pressure_atm;
            self.species_mol.keys().map(|k| (k.clone(), model.ln_gamma(k, aq, t_k, p_atm))).collect()
        } else {
            HashMap::new()
        };

        let mut species_rows = Vec::new();
        for (pi, view) in views.iter().enumerate() {
            let aqueous_phase = self.phase_is_aqueous(&view.species_mol);
            let phase_l = (view.volume_ml / 1000.0).max(1e-9);
            for (sp, &mol) in &view.species_mol {
                if mol <= 0.0 {
                    continue;
                }
                let thermo = chem_db::get_species_thermo(sp);
                let c_m = if view.volume_ml > 0.01 { Some(mol / phase_l) } else { None };
                species_rows.push(SpeciesRow {
                    id: sp.clone(),
                    name: self.display_name(sp),
                    formula: sp.clone(),
                    charge: thermo.charge,
                    phase: if aqueous_phase { "aqueous".to_string() } else { "organic".to_string() },
                    amount_mol: mol,
                    conc_m: c_m,
                    activity: if pi == 0 && self.has_aqueous_phase() {
                        let ln_g = gamma_cache.get(sp).copied().unwrap_or(0.0);
                        let conc = mol / solvent_vol_l;
                        Some(conc * ln_g.exp())
                    } else {
                        c_m
                    },
                    tier: self.species_tier(sp),
                });
            }
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
            evaporation_g_s: if is_boiling { self.boil_mass_g_s } else { self.evaporation_g_s },
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
            gas_phase: Some(self.gas_phase_info()),
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

    /// Volume (mL) of the aqueous solvent itself (water from IAPWS).
    pub fn solvent_volume_ml(&self) -> f64 {
        let h2o_mol = self.species_mol.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0);
        if h2o_mol <= MIN_AQUEOUS_H2O_MOL {
            return 0.0;
        }
        h2o_mol * crate::volume::water_molar_volume_cm3_mol(self.temperature_k)
    }

    /// True when there is enough water for an aqueous phase to exist.
    pub fn has_aqueous_phase(&self) -> bool {
        self.species_mol.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0) > MIN_AQUEOUS_H2O_MOL
    }

    pub fn species_ln_gamma(&self, species: &str) -> f64 {
        let temp_aq;
        let aq = if let Some(aq_ref) = self.phases.aqueous_phase() {
            aq_ref
        } else {
            temp_aq = {
                let mut p = crate::phases::LiquidPhase::new_aqueous();
                p.species_mol = self.species_mol.clone();
                p
            };
            &temp_aq
        };
        crate::activity::default_activity_model().ln_gamma(species, aq, self.temperature_k, self.pressure_atm)
    }

    pub fn water_activity(&self) -> f64 {
        let temp_aq;
        let aq = if let Some(aq_ref) = self.phases.aqueous_phase() {
            aq_ref
        } else {
            temp_aq = {
                let mut p = crate::phases::LiquidPhase::new_aqueous();
                p.species_mol = self.species_mol.clone();
                p
            };
            &temp_aq
        };
        crate::activity::default_activity_model().solvent_activity(aq, self.temperature_k, self.pressure_atm)
    }

    /// Update the generic phase description from the vessel's amounts: the gas, the liquid phases (as the liquid-liquid
    /// equilibrium left them) and the solids.
    pub fn update_phases(&mut self) {
        let t_k = self.temperature_k;
        let p_atm = self.pressure_atm;

        // 1. Gas phase
        self.phases.gas.temperature_k = t_k;
        self.phases.gas.pressure_atm = p_atm;
        self.phases.gas.species_mol.clear();
        for (sp, &mol) in &self.headspace_gas_mol {
            if mol > 0.0 {
                self.phases.gas.species_mol.insert(sp.clone(), mol);
            }
        }

        // 2. Liquid phases
        let maps: Vec<HashMap<String, f64>> = self.liquid_maps().filter(|m| !m.is_empty()).cloned().collect();
        let mut liquids: Vec<crate::phases::LiquidPhase> = Vec::new();
        for (idx, map) in maps.iter().enumerate() {
            let aqueous = self.phase_is_aqueous(map);
            let lead = map.iter().filter(|(k, _)| ions::species_charge(k) == 0).max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal).then(b.0.cmp(a.0))).map(|(k, _)| k.clone());
            let mut ph = if aqueous {
                crate::phases::LiquidPhase::new_aqueous()
            } else {
                crate::phases::LiquidPhase::new_organic(&format!("liquid_{}", idx), lead.as_deref(), lead.as_ref().map(|k| self.display_name(k)).as_deref())
            };
            ph.species_mol = map.clone();
            ph.volume_ml = self.phase_volume_ml(map, t_k);
            ph.mass_g = self.phase_mass_g(map);
            ph.density_g_ml = if ph.volume_ml > 0.001 { ph.mass_g / ph.volume_ml } else { 1.0 };
            ph.neat_species = if aqueous { None } else { lead };
            liquids.push(ph);
        }
        self.phases.liquids = liquids;

        // 3. Solids
        self.phases.solids.clear();
        for (sp, &mol) in &self.solid_mol {
            if mol > 0.0 {
                let props = self.solid_props(sp);
                let thermo = chem_db::get_species_thermo(sp);
                let mass_g = mol * thermo.mw;
                let volume_ml = mass_g / props.density_g_ml;
                self.phases.solids.push(crate::phases::SolidPhase {
                    species: sp.clone(),
                    name: props.name.clone(),
                    mol,
                    mass_g,
                    density_g_cm3: props.density_g_ml,
                    volume_ml,
                    kind: props.kind,
                    rgb: props.rgb,
                    particle_diameter_um: props.particle_um,
                    suspended_fraction: self.ev.susp.get(sp).copied().unwrap_or(0.2),
                });
            }
        }
    }

    pub fn contents_mass_g(&self) -> f64 {
        let mut m = 0.0;
        for map in self.liquid_maps() {
            for (sp, &mol) in map {
                let thermo = chem_db::get_species_thermo(sp);
                m += mol * thermo.mw;
            }
        }
        for (sp, &mol) in &self.solid_mol {
            let thermo = chem_db::get_species_thermo(sp);
            m += mol * thermo.mw;
        }
        m
    }

    /// pH = -log10(m_H+ * gamma_H+) in the phase that contains water (decision D6 for other solvents).
    pub fn current_ph(&self) -> f64 {
        if !self.has_aqueous_phase() || self.solvent_volume_ml() <= 0.0 {
            return f64::NAN;
        }
        let t_k = self.temperature_k;
        let n_h2o = self.species_mol.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0);
        let kg_w = (n_h2o * 0.01801528).max(1e-12);
        let m_h = self.species_mol.get("H+").copied().unwrap_or(0.0) / kg_w;
        let m_oh = self.species_mol.get("OH-").copied().unwrap_or(0.0) / kg_w;

        let pkw = self
            .equilibria
            .iter()
            .find(|e| {
                e.reactants.len() == 1
                    && e.reactants.contains_key(AQUEOUS_SOLVENT)
                    && e.products.len() == 2
                    && e.products.contains_key("H+")
                    && e.products.contains_key("OH-")
            })
            .map(|e| -e.log_k_at(self.temperature_k))
            .unwrap_or_else(|| -chem_db::water_log_kw(self.temperature_k));

        let (gamma_cache, a_w) = crate::activity::batch_aqueous_gamma_and_aw(&self.species_mol, t_k);

        if m_h > 0.0 && m_oh > 0.0 && (m_h - m_oh).abs() <= 1e-6 * m_h.max(m_oh) {
            return 0.5 * (pkw - a_w.log10());
        }

        if m_h > 0.0 && m_h >= m_oh {
            let ln_gamma_h = gamma_cache.get("H+").copied().unwrap_or(0.0);
            let a_h = m_h * ln_gamma_h.exp();
            return -a_h.log10();
        }

        if m_oh > 0.0 {
            let ln_gamma_oh = gamma_cache.get("OH-").copied().unwrap_or(0.0);
            let a_oh = m_oh * ln_gamma_oh.exp();
            pkw - a_w.log10() + a_oh.log10()
        } else {
            0.5 * (pkw - a_w.log10())
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
        let h2o_mol = self.species_mol.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0);
        if h2o_mol <= MIN_AQUEOUS_H2O_MOL {
            return 0.0;
        }
        let vol_l = (h2o_mol * crate::volume::WATER_MW / 1000.0).max(1e-9);
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
        let vol_ml = self.reaction_volume_ml();
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
        for (sp, &mol) in self.liquid_maps().flat_map(|m| m.iter()).chain(self.solid_mol.iter()) {
            if sp != AQUEOUS_SOLVENT && mol > largest {
                largest = mol;
            }
        }
        (1e-7 * largest).max(1e-13)
    }

    /// Element inventory of everything the vessel currently holds (solution, solids, headspace, collected gas).
    pub(crate) fn element_inventory(&self) -> (HashMap<String, f64>, Vec<String>) {
        let mut inv: HashMap<String, f64> = HashMap::new();
        let mut unparsed: Vec<String> = Vec::new();
        for map in self.liquid_maps().chain([&self.solid_mol, &self.headspace_gas_mol, &self.gas.collected_mol]) {
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
