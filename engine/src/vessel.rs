//! M5 Vessel implementation. Manages simulation state, multi-species equilibria,
//! chemical kinetics, thermodynamics, phase transfer, and snapshot generation.
//! Fully generalized to support arbitrary reactions, minerals, and compounds from PubChem.

use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};

use crate::types::ProvenanceTier;
use crate::chem_db::{self, GeneralEquilibrium, GeneralMineral, GeneralKineticRxn, ReagentCatalogEntry};
use crate::compound_thermo::CompoundThermo;
use crate::optics::{self};
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
/// Species id of the aqueous solvent (the species the aqueous equilibria, pH and ionic activities are written for).
pub(crate) const AQUEOUS_SOLVENT: &str = crate::db::seed::WATER;

/// The solvent's own ionisation row: one reactant, the solvent, and its two ions as products.
pub(crate) fn is_autoprotolysis(e: &GeneralEquilibrium) -> bool {
    e.reactants.len() == 1 && e.reactants.contains_key(AQUEOUS_SOLVENT) && e.products.len() == 2 && e.products.contains_key(crate::db::seed::PROTON) && e.products.contains_key(crate::db::seed::HYDROXIDE)
}

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
    /// Refractive index of the layer (Lorentz-Lorenz from the molar refractions of its species).
    pub refractive_index: f64,
    /// Decadic absorbance per cm per bin of the engine grid (`optics::N_BINS`, 380-780 nm).
    pub absorbance_per_cm: Vec<f64>,
    /// Extinction coefficient (1/cm, natural) of the suspended solids per bin (Mie / Rayleigh-Gans), absorption included.
    pub scatter_per_cm: Vec<f64>,
    /// Single-scattering albedo of the suspended solids per bin (scattered / extinguished).
    pub scatter_albedo: Vec<f64>,
    /// Weakest provenance tier of the optical data that colour the layer (a species with no data adds none).
    #[serde(default)]
    pub colour_tier: ProvenanceTier,
    /// Where the colour comes from ("PubChem UV/Vis text", "ligand-field model ...", "neat colour of ... (speculative)").
    #[serde(default)]
    pub colour_sources: Vec<String>,
    /// Solvent class the absorption was evaluated in ("water", "alkane", "aromatic", "alcohol", "other").
    #[serde(default)]
    pub solvent_class: String,
    /// Species id of the main component of a non-aqueous layer; absent for the water-containing layer.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub species: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// What a glass pH electrode with a 3 M KCl bridge reads in this layer (`ph_electrode`): the molal pH shifted by the
    /// liquid-junction potential; absent for a layer without water and where water is under half of the solvent.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ph: Option<f64>,
    /// The thermodynamic molal pH of the layer, `-log10(m_H gamma_H)`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ph_activity: Option<f64>,
    /// Junction potential (mV, sample minus bridge) behind the difference between the two.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ph_junction_mv: Option<f64>,
    /// Mole fraction of water among the layer's molecules (ions left out).
    #[serde(default)]
    pub water_mole_fraction: f64,
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
    #[serde(default)]
    pub density_g_ml: f64,
    #[serde(default)]
    pub volume_ml: f64,
    pub settled_volume_ml: f64,
    #[serde(default = "default_solid_morphology")]
    pub morphology: String, // "bed" | "monolith" | "pieces" | "film"
    pub suspended_fraction: f64,
    /// Volume-equivalent mean diameter of the whole population, um.
    pub particle_diameter_um: f64,
    /// Mass-weighted mean diameter of the *suspended* part, um: coarse crystals settle first, so a settling precipitate
    /// leaves a haze of fines and this falls below `particle_diameter_um`. 0 in snapshots that predate it.
    #[serde(default)]
    pub suspended_diameter_um: f64,
    /// Geometric standard deviation of the size distribution (log-normal closure of the moments; 1 = monodisperse).
    #[serde(default)]
    pub particle_sigma_g: f64,
    pub rgb: [f64; 3],
    /// Provenance tier and basis of the colour (measured phrase, band edge, inherited chromophore, mixed valence, or the
    /// Speculative hand colour / hue rules).
    #[serde(default)]
    pub colour_tier: ProvenanceTier,
    #[serde(default)]
    pub colour_source: String,
    pub kind: SolidKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub floating: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layer_index: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remaining_fraction: Option<f64>,
    /// Stokes settling velocity of the particles in the liquid that is in the vessel, mm/s (0: floats or stays colloidal).
    #[serde(default)]
    pub settling_velocity_mm_s: f64,
    /// Total particle surface, cm2.
    #[serde(default)]
    pub surface_area_cm2: f64,
    /// Mass-weighted mean size (um) of what the particles settle as in this liquid: the primary size, grown into flocs where
    /// the electrolyte is at or beyond the critical coagulation concentration (Schulze-Hardy, `transfer/settling.rs`). A
    /// nanometre-scale hydroxide sol (`particle_diameter_um` of a few nm) has a floc size of micrometres once salted.
    #[serde(default)]
    pub floc_diameter_um: f64,
}

fn default_solid_morphology() -> String {
    "bed".to_string()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GasFlux {
    pub species: String,
    pub rate_ml_s: f64,
    pub bubble_diameter_mm: f64,
    pub nucleation: String, // "bulk" | "wall" | "solid"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FumeVisual {
    pub species: String,
    /// 0-1 strength (optical depth of a coloured gas, opacity of an aerosol).
    pub intensity: f64,
    /// Hue of the fume (transmitted colour of a gas, tint of an aerosol).
    pub rgb: [f64; 3],
    pub opacity: f64,
    /// Derived from the plume's molar mass and temperature (`density_ratio > 1`), never stored per species.
    pub denser_than_air: bool,
    /// Plume density relative to the room air, `(M / T) / (M_air / T_room)`.
    #[serde(default)]
    pub density_ratio: f64,
    /// "gas" (absorbing gas) | "aerosol" (droplets or smoke).
    #[serde(default)]
    pub kind: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FlameVisual {
    pub fuel: String,
    pub power_w: f64,
    pub luminosity: f64,
    pub flame_temp_k: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emitter_rgb: Option<[f64; 3]>,
    /// Share (0-1) of the flame's visible light that comes from emitting metals (flame-test colours); 0 for a plain flame.
    #[serde(default)]
    pub metal_share: f64,
    /// The strongest emitters, e.g. "Na atom 589 nm", "SrOH 606 nm".
    #[serde(default)]
    pub emitters: Vec<String>,
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
    /// What the row is for the UI when that is more than its kind: `"autoprotolysis"` is the solvent's own ionisation (acid
    /// and base neutralising shows as this row relaxing toward the solvent).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
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
    /// The bath as an object (finite mass, ice fraction) when the controls gave one; `bath_k` alone is an infinite reservoir.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bath: Option<crate::bath::BathVisual>,
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
    /// Electrolysis cell readout (current, voltage, electrode potentials, reactions); absent without electrodes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub electrolysis: Option<crate::vessel_electro::ElectroReadout>,
    /// Electrode visuals (anode, cathode, mass change, plated deposit).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub electrodes: Vec<crate::vessel_electro::ElectrodeVisual>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub network_cap_reached: Option<bool>,
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
    /// Physical form of a solid reagent (`piece`, `turnings`, `granules`, `powder`); absent = the catalog entry's form, else
    /// the solid's own grain size. The form sets the starting grain size and whether the solid is a bed or loose pieces.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub solid_form: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Portion {
    pub volume_ml: f64,
    pub temperature_k: f64,
    pub aqueous_mol: HashMap<String, f64>,
    pub organic_mol: HashMap<String, f64>,
    pub solid_mol: HashMap<String, f64>,
    /// The particle populations of the solids drawn off with the liquid (they keep their size).
    #[serde(default)]
    pub particles: HashMap<String, crate::transfer::ParticlePopulation>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct VesselControls {
    pub heater_w: Option<f64>,
    pub stirring: Option<bool>,
    pub stir_rpm: Option<f64>,
    pub sealed: Option<bool>,
    pub bath_k: Option<Option<f64>>,
    /// A finite bath with mass and ice (`Some(Some(spec))`) or none (`Some(None)`); replaces `bath_k`'s infinite reservoir.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bath: Option<Option<crate::bath::BathSpec>>,
    /// Thermal conductance (W/K) between the vessel and its bath; absent = from the vessel's geometry and the wall
    /// (`heat_transfer::bath_coupling_w_per_k`). A thermostatted jacket or a vigorously stirred slurry bath couples harder.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bath_coupling_w_k: Option<f64>,
    pub igniter: Option<bool>,
    pub burner_w: Option<f64>,
    /// Debug: enable the substring-matched organic network generator (off by default, see `update_network`).
    #[serde(default)]
    pub debug_network_generator: Option<bool>,
    /// Partial update of the atmosphere an open vessel exchanges with (pressure, dry composition, humidity).
    #[serde(default)]
    pub atmosphere: Option<crate::gas_phase::AtmosphereSpec>,
    /// Two electrodes and a supply (electrolysis); replaces any earlier setup.
    #[serde(default)]
    pub electrolysis: Option<crate::vessel_electro::ElectrolysisSpec>,
    /// Takes the electrodes out of the vessel.
    #[serde(default)]
    pub remove_electrodes: Option<bool>,
}

/// Activities of a vessel at the start of a step, for reaction quotients (`Vessel::activity_context`).
pub(crate) struct ActivityContext {
    /// ln gamma of the aqueous solutes
    pub gamma: HashMap<String, f64>,
    pub ln_aw: f64,
    pub vol_l: f64,
    /// kg of solvent water of the primary phase: solute activities are molal (a = gamma m), like the equilibrium solver
    pub solvent_kg: f64,
    /// partial pressure (Pa) of each gas: headspace (sealed) or atmosphere (open)
    pub gas_pa: HashMap<String, f64>,
    pub sealed: bool,
    pub head_m3: f64,
}

pub struct Vessel {
    pub config: VesselConfig,
    pub t_sim_s: f64,
    pub temperature_k: f64,
    pub room_k: f64,
    pub bath_k: Option<f64>,
    /// The finite bath, when the controls gave one (`VesselControls::bath`): its temperature drives `bath_k`.
    pub bath: Option<crate::bath::BathState>,
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
    /// Moles of each solid that formed from the vessel's own liquid (ice that froze in the beaker, a crystal cake) as opposed
    /// to what was added as a solid: a frozen liquid is cast to the vessel (a monolith), added pieces are not.
    pub solid_cast_mol: HashMap<String, f64>,
    /// The physical form a solid was dosed in (`solid_forms.json`: piece, turnings, granules, powder).
    pub solid_forms: HashMap<String, String>,
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
    /// Cumulative energy (J) the surroundings have put into the contents: heater, burner and bath minus the loss to the room
    /// (the reaction and phase-change heats are internal). With `enthalpy_state_j` it makes the energy audit of
    /// `vessel_energy`.
    pub external_energy_j: f64,
    /// Vapour volume flow (mL/s) and mass flow (g/s) of every liquid that boiled in the last step (water, ethanol,
    /// inert compounds): the visual boil state is derived from it, not from a water-only temperature test.
    pub boil_vapour_ml_s: f64,
    pub boil_mass_g_s: f64,
    /// Set by the equilibrium solver whenever a sweep changed the contents (lets `step` stop sweeping once settled).
    pub(crate) eq_moved: bool,
    /// True when the last coupled solve reached its tolerance (the sequential relaxation sweeps are then not needed).
    pub(crate) eq_converged: bool,
    pub gas_fluxes: Vec<GasFlux>,
    /// Gas pooled in the free column of an open vessel (species id "X(g)", plus smoke solids "X(s)"), mol: the plume.
    pub plume_mol: HashMap<String, f64>,
    /// Aerosol mass concentration of the plume by source species, g/m3 (droplets of a soluble gas, smoke of a gas-phase solid).
    pub plume_aerosol: HashMap<String, f64>,
    /// Vapour that left the liquid by evaporation or sublimation this step (gas id, mol); drained by `step_plume`.
    pub(crate) vapour_sources: Vec<(String, f64)>,
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
    /// Species ids of the organic (SMILES-bearing) species the Stage 9 network generator last expanded for.
    pub last_smiles_species: HashSet<String>,
    /// (pH unit, 10 K band) the organic network was last generated in: candidates are filtered by their rate at the
    /// generation conditions, so a path that was too slow then (acid hydrolysis at pH 7) is looked for again when the
    /// solution turns acidic or hot
    pub last_network_env: (i32, i32),
    pub network_cap_reached: bool,
    /// Candidate reactions of the generated network that were below the flux threshold (the edge), re-evaluated periodically.
    pub network_edge: Vec<crate::network_generator::GeneratedReaction>,
    /// How the current flame looks (fuel, power, luminosity, temperature, emission colour); None when nothing burns.
    pub flame_visual: Option<FlameVisual>,
    /// Expected-nuclei clock of each supersaturated solid that has no particle yet (the induction timer).
    pub nuc_clock: HashMap<String, f64>,
    /// Minerals the equilibrium solver must leave alone in this pass (supersaturated: their precipitation is kinetic).
    pub blocked_minerals: std::collections::HashSet<String>,
    /// Formula units a blocked (supersaturated) mineral may still form in this pass: its kinetic precipitation.
    pub(crate) precip_cap: HashMap<String, f64>,
    /// Seconds the slow (rate-limited) equilibrium rows advance in the current equilibrium pass; set by the caller.
    pub(crate) kinetic_dt_s: f64,
    /// True while the equilibrium solvers must leave the slow rows alone (they are on the slow manifold).
    pub(crate) slow_exclude: bool,
    /// Electrolysis cell and the last electrode solution (see `vessel_electro`).
    pub electro: crate::vessel_electro::ElectroState,
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
            bath: None,
            pressure_atm: 1.0,
            sealed,
            burst: false,
            controls: VesselControls::default(),
            species_mol: HashMap::new(),
            extra_liquids: Vec::new(),
            solid_mol: HashMap::new(),
            initial_solids: HashMap::new(),
            solid_cast_mol: HashMap::new(),
            solid_forms: HashMap::new(),
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
            external_energy_j: 0.0,
            boil_vapour_ml_s: 0.0,
            boil_mass_g_s: 0.0,
            eq_moved: false,
            eq_converged: false,
            gas_fluxes: Vec::new(),
            plume_mol: HashMap::new(),
            plume_aerosol: HashMap::new(),
            vapour_sources: Vec::new(),
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
            last_smiles_species: HashSet::new(),
            last_network_env: (i32::MIN, i32::MIN),
            network_cap_reached: false,
            network_edge: Vec::new(),
            flame_visual: None,
            nuc_clock: HashMap::new(),
            blocked_minerals: Default::default(),
            precip_cap: HashMap::new(),
            kinetic_dt_s: 0.0,
            slow_exclude: false,
            electro: Default::default(),
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

    /// Automatically expands and registers the reaction network of the species present, in every liquid phase: each phase
    /// (the primary one and each immiscible layer) is expanded with its own concentrations and the rate rules of its own
    /// solvent class, and the reactions are tagged with that class so they run only in phases of it (`step_kinetics`).
    pub fn update_network(&mut self) {
        let mut edge: Vec<crate::network_generator::GeneratedReaction> = Vec::new();
        let mut cap = false;
        for p in 0..(1 + self.extra_liquids.len()) {
            let Some((concs, ph, class)) = self.phase_network_inputs(p) else { continue };
            let generator = crate::network_generator::NetworkGenerator::new(crate::network_generator::NetworkGeneratorConfig::default());
            let gen_net = generator.generate_network_in(&concs, self.temperature_k, ph, class);
            cap |= gen_net.cap_reached;
            edge.extend(gen_net.edge);
            for rxn in gen_net.reactions {
                // the primary phase keeps the plain id; another phase's reaction of the same template and species (a
                // different solvent class has its own rate) is told apart by the class
                let id = if p == 0 { rxn.id.clone() } else { format!("{}@{}", rxn.id, class) };
                if self.kinetic_reactions.iter().any(|r| r.id == id) {
                    continue;
                }
                // the rate law carries its own orders (solvent zero order, dissolved catalysts such as H+ first order) and
                // K(298) with the reaction enthalpy, so the vessel re-evaluates catalysis, temperature and detailed balance
                // every tick instead of freezing the conditions of the moment the network was generated
                self.kinetic_reactions.push(chem_db::GeneralKineticRxn {
                    id,
                    equation: rxn.equation,
                    reactants: rxn.reactants,
                    products: rxn.products,
                    gas_products: rxn.gas_products,
                    orders: Some(rxn.orders),
                    arrhenius_a: rxn.arrhenius_a,
                    arrhenius_n: 0.0,
                    arrhenius_ea: rxn.arrhenius_ea,
                    delta_h_kj: rxn.delta_h_kj,
                    catalyst_species: None,
                    // K only from the species' formation data; without it the reaction is irreversible, not given an invented K
                    is_reversible: rxn.k_eq_from_data,
                    k_eq_298: if rxn.k_eq_from_data { Some(rxn.k_eq_298) } else { None },
                    tier: rxn.tier,
                    source: rxn.source,
                    phase_class: Some(class.to_string()),
                });
            }
        }
        self.network_cap_reached = cap;
        self.network_edge = edge;
        // oxidised forms of the organic species present become candidates of the redox discovery
        let present: Vec<String> = (0..(1 + self.extra_liquids.len())).flat_map(|p| self.liquid_phase_map(p).iter().filter(|(_, &n)| n > 1e-12).map(|(k, _)| k.clone()).collect::<Vec<_>>()).collect();
        crate::network_generator::register_redox_partners(&present);
    }

    /// The molecular map of liquid phase `p` (0 = primary).
    pub(crate) fn liquid_phase_map(&self, p: usize) -> &HashMap<String, f64> {
        if p == 0 { &self.species_mol } else { &self.extra_liquids[p - 1] }
    }

    pub(crate) fn liquid_phase_map_mut(&mut self, p: usize) -> &mut HashMap<String, f64> {
        if p == 0 { &mut self.species_mol } else { &mut self.extra_liquids[p - 1] }
    }

    /// Solvent class of liquid phase `p`: water for an aqueous phase, else the class of its most abundant molecular
    /// component (by its structure).
    pub fn phase_solvent_class(&self, p: usize) -> &'static str {
        let map = self.liquid_phase_map(p);
        if self.phase_is_aqueous(map) {
            return "water";
        }
        let lead = map
            .iter()
            .filter(|(k, &n)| n > 0.0 && crate::network_generator::resolve_molecule(k).is_some())
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal).then(b.0.cmp(a.0)))
            .map(|(k, _)| k.clone());
        crate::optics::solution::solvent_class(false, self.smiles_of(lead.as_deref()).as_deref())
    }

    /// Concentrations (mol/L of the phase), pH and solvent class the network generator sees for liquid phase `p`; None when
    /// the phase is empty or holds no species with a structure. Only the primary phase carries the aqueous pH and the
    /// dissolved solids.
    fn phase_network_inputs(&self, p: usize) -> Option<(HashMap<String, f64>, f64, &'static str)> {
        let map = self.liquid_phase_map(p);
        let vol_l = self.phase_volume_ml(map, self.temperature_k) / 1000.0;
        if vol_l <= 0.0 || !map.iter().any(|(sp, &m)| m > 1e-12 && crate::network_generator::resolve_molecule(sp).is_some()) {
            return None;
        }
        let mut concs: HashMap<String, f64> = map.iter().map(|(sp, &mol)| (sp.clone(), mol / vol_l)).collect();
        let ph = if p == 0 {
            for (sp, &mol) in &self.solid_mol {
                concs.insert(sp.clone(), mol / vol_l);
            }
            self.current_ph()
        } else {
            7.0
        };
        Some((concs, ph, self.phase_solvent_class(p)))
    }

    /// Class of the vessel's primary solvent for the solvent-dependent rate rules: water when the primary liquid phase is
    /// aqueous, else the class of its most abundant molecular component.
    pub fn primary_solvent_class(&self) -> &'static str {
        self.phase_solvent_class(0)
    }

    /// Re-evaluates the edge of the reaction network at the current contents: when a candidate has become fast (its rate at
    /// the live concentrations reaches the generation threshold) the network is regenerated, which promotes it to the core.
    /// Returns whether a regeneration happened.
    pub fn promote_edge_reactions(&mut self) -> bool {
        if self.network_edge.is_empty() || self.network_cap_reached {
            return false;
        }
        let vol_l = self.reaction_volume_ml() / 1000.0;
        if vol_l <= 0.0 {
            return false;
        }
        let mut concs: HashMap<String, f64> = HashMap::new();
        for (sp, &mol) in self.species_mol.iter().chain(self.solid_mol.iter()) {
            concs.insert(sp.clone(), mol / vol_l);
        }
        let threshold = crate::network_generator::NetworkGeneratorConfig::default().flux_threshold_abs;
        let t = self.temperature_k;
        let fast = self.network_edge.iter().any(|e| e.rate_in(&concs, t) >= threshold);
        if fast {
            self.update_network();
        }
        fast
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
        let liquid_before = self.species_mol.clone();
        let mut liquid_added: HashMap<String, f64> = HashMap::new();
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
                    // the form the solid was added in: its grain size (unless the caller set one) and its morphology
                    let form = dose.solid_form.clone().or_else(|| entry.solid_form.clone());
                    // the reagent's own grain size belongs to its own form: another form asked for gets that form's size
                    let own_um = if dose.solid_form.is_none() || dose.solid_form == entry.solid_form { entry.particle_um } else { None };
                    let form_um = form.as_deref().and_then(|f| crate::solid_forms::form_diameter_um(f, own_um));
                    if let Some(f) = &form {
                        if crate::solid_forms::is_loose_pieces(f) {
                            self.solid_forms.insert(species.clone(), f.clone());
                        } else {
                            self.solid_forms.remove(species);
                        }
                    }
                    self.add_solid_particles(species, mol, override_diameter_um.or(form_um).map(|u| u * 1e-6));
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
                *liquid_added.entry(species.clone()).or_insert(0.0) += mol;
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
        // the excess enthalpy of the new mixture against its parts (miscible liquids warm or cool on mixing)
        if !liquid_added.is_empty() && cp_before + cp_added > 1e-6 {
            let q = self.mixing_heat_j(&liquid_before, &[&liquid_added], &self.species_mol, self.temperature_k);
            self.temperature_k += q / (cp_before + cp_added);
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

    /// Solves fast speciation equilibria right after an addition and records what happened in the log. The addition is
    /// mixed in over `DOSE_MIXING_TIME_S`: solids dissolve and precipitate only as far as that much time allows
    /// (transport-limited dissolution, nucleation and growth), so a fine precipitate appears at once while a coarse
    /// crystal is still a crystal.
    fn settle_after_addition(&mut self) {
        // Whatever solid is in the vessel now was put there by the user: only *new* solids count as precipitates.
        self.sync_known_solids();
        // solids melt (heat-limited) and liquids split into their phases, at conserved enthalpy
        self.phase_flash();
        self.auto_minerals();
        const MIX_SLICES: usize = 6;
        for it in 0..40 {
            let (sp0, so0) = (self.species_mol.clone(), self.solid_mol.clone());
            let dt_it = if it < MIX_SLICES { crate::vessel_transfer::DOSE_MIXING_TIME_S / MIX_SLICES as f64 } else { 0.0 };
            // (slow chemistry such as CO2 hydration does not advance while an addition is being mixed in)
            let q_eq = self.step_equilibria_limited(0.001, dt_it, 0.0);
            let cp_tot = (self.contents_heat_capacity() + self.glass_heat_capacity()).max(1.0);
            self.temperature_k += q_eq / cp_tot;
            // stop as soon as a sweep no longer moves anything (the coupled solve normally gets there in one pass)
            let moved = |a: &HashMap<String, f64>, b: &HashMap<String, f64>| {
                a.len() != b.len() || a.iter().any(|(k, v)| (b.get(k).copied().unwrap_or(f64::NAN) - v).abs() > 1e-14 * v.abs().max(1e-6))
            };
            if it >= MIX_SLICES && !moved(&sp0, &self.species_mol) && !moved(&so0, &self.solid_mol) {
                break;
            }
        }
        self.sync_populations();
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
        let liquid_before = self.species_mol.clone();
        let (portion_aq, portion_org) = (portion.aqueous_mol.clone(), portion.organic_mol.clone());

        for (sp, mol) in portion.aqueous_mol {
            *self.species_mol.entry(sp).or_insert(0.0) += mol;
        }
        for (sp, mol) in portion.organic_mol {
            *self.species_mol.entry(sp).or_insert(0.0) += mol;
        }
        for (sp, mol) in portion.solid_mol {
            *self.solid_mol.entry(sp.clone()).or_insert(0.0) += mol;
            *self.initial_solids.entry(sp.clone()).or_insert(0.0) += mol;
            match portion.particles.get(&sp) {
                Some(pop) if !pop.is_empty() => {
                    let e = self.particle_populations.entry(sp.clone()).or_default();
                    e.mu0 += pop.mu0;
                    e.mu1 += pop.mu1;
                    e.mu2 += pop.mu2;
                    e.mu3 += pop.mu3;
                }
                _ => self.add_solid_particles(&sp, mol, None),
            }
        }
        for (sp, mol) in book {
            self.ledger.book_in(&sp, mol);
        }

        if added_mass > 0.0 && cp_current + cp_added > 1e-6 {
            self.temperature_k = (self.temperature_k * cp_current + portion.temperature_k * cp_added) / (cp_current + cp_added);
            // heat of mixing of the portion's liquid phases with what was there
            let q = self.mixing_heat_j(&liquid_before, &[&portion_aq, &portion_org], &self.species_mol, self.temperature_k);
            self.temperature_k += q / (cp_current + cp_added);
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
                particles: HashMap::new(),
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
        let mut s_pop = HashMap::new();
        if solid_fraction > 0.0 {
            for (sp, mol) in self.solid_mol.iter_mut() {
                let removed = *mol * solid_fraction;
                *mol -= removed;
                s_mol.insert(sp.clone(), removed);
                if let Some(p) = self.particle_populations.get_mut(sp) {
                    s_pop.insert(sp.clone(), p.take_fraction(solid_fraction));
                }
            }
        }
        for (sp, mol) in aq_mol.iter().chain(org_mol.iter()).chain(s_mol.iter()) {
            self.ledger.book_out(sp, *mol);
        }
        self.update_phases();
        Portion { volume_ml, temperature_k: self.temperature_k, aqueous_mol: aq_mol, organic_mol: org_mol, solid_mol: s_mol, particles: s_pop }
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
            // an infinite reservoir at a fixed temperature replaces any finite bath
            self.bath = None;
            self.bath_k = b;
            self.controls.bath_k = Some(b);
        }
        if let Some(spec) = &controls.bath {
            match spec {
                Some(sp) => {
                    let state = crate::bath::BathState::new(sp);
                    self.bath_k = Some(state.t_k);
                    self.bath = Some(state);
                }
                None => {
                    self.bath = None;
                    self.bath_k = None;
                }
            }
        }
        if let Some(g) = controls.bath_coupling_w_k {
            self.controls.bath_coupling_w_k = Some(g);
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
        if let Some(spec) = controls.electrolysis {
            self.set_electrolysis(Some(spec));
        }
        if controls.remove_electrodes == Some(true) {
            self.set_electrolysis(None);
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

        // Structure-based reaction network generator: triggers whenever organic/SMILES species set changes
        let mut cur_smiles_species = HashSet::new();
        for (sp, &mol) in &self.species_mol {
            if mol > 1e-12 && crate::network_generator::resolve_molecule(sp).is_some() {
                cur_smiles_species.insert(sp.clone());
            }
        }
        for (sp, &mol) in &self.solid_mol {
            if mol > 1e-12 && crate::network_generator::resolve_molecule(sp).is_some() {
                cur_smiles_species.insert(sp.clone());
            }
        }
        // a species in another liquid layer is tagged with the layer's solvent class: the same molecule in a different
        // solvent has different rate rules
        for p in 1..(1 + self.extra_liquids.len()) {
            let class = self.phase_solvent_class(p);
            for (sp, &mol) in &self.extra_liquids[p - 1] {
                if mol > 1e-12 && crate::network_generator::resolve_molecule(sp).is_some() {
                    cur_smiles_species.insert(format!("{}@{}", sp, class));
                }
            }
        }
        if !cur_smiles_species.is_empty() {
            let ph = self.current_ph();
            let env = (if ph.is_finite() { ph.floor() as i32 } else { i32::MAX }, (self.temperature_k / 10.0).floor() as i32);
            if cur_smiles_species != self.last_smiles_species || env != self.last_network_env {
                self.last_smiles_species = cur_smiles_species;
                self.last_network_env = env;
                self.update_network();
            } else if (self.t_sim_s * 0.5).floor() != ((self.t_sim_s - dt_s) * 0.5).floor() {
                // every 2 s of simulated time the edge is checked against the live concentrations
                self.promote_edge_reactions();
            }
        }
        // 1. Generalized chemical kinetics & combustion
        let q_kinetics = self.step_kinetics(dt_s);
        reaction_heat_joules += q_kinetics;

        // 1a. Combustion of any fuel present (flash point, limiting oxygen, pool burning rate)
        reaction_heat_joules += self.step_combustion(dt_s);

        // 1b. Generalized redox reactions (electron transfer between couples via GEM driving force)
        let q_redox = self.step_redox(dt_s);
        reaction_heat_joules += q_redox;

        // 1c. Thermal decomposition of solids (solid -> solid + gas via GEM driving force)
        let q_decomp = self.step_thermal_decomposition(dt_s);
        reaction_heat_joules += q_decomp;

        // 1d. Electrode reactions of the conducting solids (corrosion, cementation) and of an electrolysis cell
        let q_electro = self.step_electrochemistry(dt_s);
        reaction_heat_joules += q_electro;

        // 2a. Association rows of the ions that are still there after the dose settled
        self.auto_associations();

        // 2. Generalized aqueous equilibria; solids dissolve, nucleate and grow only as fast as transport and nucleation allow
        for sweep in 0..5 {
            self.eq_moved = false;
            // only the first sweep may move solid across the interface; later ones just re-settle the speciation
            let first = if sweep == 0 { dt_s } else { 0.0 };
            let q_eq = self.step_equilibria_limited(dt_s * 0.2, first, first);
            reaction_heat_joules += q_eq;
            if !self.eq_moved || self.eq_converged {
                break;
            }
        }
        self.sync_populations();

        // 2b. Dissolved gases exchange with the gas phase through Henry's constant (every gas of the species store with an
        // aqueous twin: CO2, O2, NH3, ...), and supersaturated gas leaves as bubbles.
        reaction_heat_joules += self.step_gas_exchange(dt_s);

        self.recent_reaction_heat_w = reaction_heat_joules / dt_s;

        // 3. Thermal energy balance
        self.step_thermal(dt_s, reaction_heat_joules);

        // 4. Headspace pressure & gas accumulation / venting
        self.step_headspace(dt_s);

        // 4b. The plume of gas above an open vessel (what leaves the liquid pools in the free column or rises out of it)
        self.step_plume(dt_s);

        self.update_suspension(dt_s);

        // 5. Generic reaction log
        self.detect_events(false);

        self.update_phases();

        Ok(())
    }

    /// Kinetics of every liquid phase: each phase integrates the reactions of its own solvent class with its own
    /// concentrations and volume (the primary phase also runs the class-less rows of `core_reactions.json`).
    fn step_kinetics(&mut self, dt_s: f64) -> f64 {
        let mut q_joules = 0.0;
        for p in 0..(1 + self.extra_liquids.len()) {
            q_joules += self.step_kinetics_phase(dt_s, p);
        }
        q_joules
    }

    fn step_kinetics_phase(&mut self, dt_s: f64, phase: usize) -> f64 {
        let mut q_joules = 0.0;
        let t_k = self.temperature_k;
        let vol_l = self.phase_volume_ml(self.liquid_phase_map(phase), t_k) / 1000.0;
        let r_ideal = R_GAS;
        let mut gas_out: Vec<(String, f64)> = Vec::new();

        if vol_l <= 0.0 || self.kinetic_reactions.is_empty() {
            return q_joules;
        }

        // the reactions that run in this phase: those generated for its solvent class; the class-less rows run in the
        // primary phase. In another phase a reaction also needs its reactants there (a layer without water does not hydrolyse)
        let class = self.phase_solvent_class(phase);
        let applicable: Vec<usize> = {
            let map = self.liquid_phase_map(phase);
            self.kinetic_reactions
                .iter()
                .enumerate()
                .filter(|(_, r)| match r.phase_class.as_deref() {
                    Some(c) => c == class,
                    None => phase == 0,
                })
                .filter(|(_, r)| phase == 0 || r.reactants.keys().all(|k| map.get(k).copied().unwrap_or(0.0) > 0.0 || self.solid_mol.get(k).copied().unwrap_or(0.0) > 0.0))
                .map(|(i, _)| i)
                .collect()
        };
        if applicable.is_empty() {
            return q_joules;
        }

        let p_pa = self.pressure_atm * 101325.0;
        let ionic_str = if phase == 0 { self.calc_ionic_strength() } else { 0.0 };

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
        for rxn in applicable.iter().map(|&i| &self.kinetic_reactions[i]) {
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
                // an order may name a species the reaction does not consume (a dissolved catalyst such as H+): it enters
                // the rate law with zero stoichiometry
                for (r, &ord) in ord_map {
                    let idx = get_or_add_species(r, &mut species_set, &mut spec_map);
                    orders_reactants.push((idx, ord));
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
            initial_moles[i] = self.liquid_phase_map(phase).get(sp).copied()
                .or_else(|| self.solid_mol.get(sp).copied())
                .unwrap_or(0.0);
        }

        let mut system = crate::kinetics::KineticExtentSystem::new(species_set.clone(), extent_reactions);
        // rate laws in mol/L, K(T) in molality: the solvent mass per litre of solution converts between them
        let kg_solvent = self.liquid_phase_map(phase).get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0) * 0.01801528;
        if kg_solvent > 1e-9 {
            system.solvent_kg_per_l = (kg_solvent / vol_l).clamp(0.2, 1.5);
        }
        let (extents, rates) = system.integrate_extent_step(
            &initial_moles,
            dt_s,
            vol_l,
            t_k,
            p_pa,
            ionic_str,
            &self.catalyst_areas(),
        );

        for (r_idx, &rxn_idx) in applicable.iter().enumerate() {
            let rxn = self.kinetic_reactions[rxn_idx].clone();
            // a reversible reaction runs backward (negative extent) when its quotient is past K
            let extent = extents[r_idx];
            if extent.abs() <= 1e-15 {
                continue;
            }

            // Reactants are consumed (returned when the extent is negative); a solid id lives in `solid_mol`
            for (reactant, &coeff) in &rxn.reactants {
                let d = extent * coeff;
                let map = if reactant.ends_with("(s)") || (!self.liquid_phase_map(phase).contains_key(reactant) && self.solid_mol.contains_key(reactant)) {
                    &mut self.solid_mol
                } else {
                    self.liquid_phase_map_mut(phase)
                };
                let m = map.entry(reactant.clone()).or_default();
                *m = (*m - d).max(0.0);
            }

            // Products are formed (consumed when the extent is negative)
            for (prod, &coeff) in &rxn.products {
                let d = extent * coeff;
                let map = if prod.ends_with("(s)") { &mut self.solid_mol } else { self.liquid_phase_map_mut(phase) };
                let m = map.entry(prod.clone()).or_default();
                *m = (*m + d).max(0.0);
            }

            // Apply gas evolution (gas products make a reaction irreversible in the integrator, so extent > 0 here)
            for (gas_sp, &coeff) in &rxn.gas_products {
                let gas_mol = extent.max(0.0) * coeff;
                if gas_mol <= 0.0 {
                    continue;
                }
                let vol_gas_ml = gas_mol * r_ideal * t_k / (self.pressure_atm * 101325.0) * 1e6;
                let nucleation = if rxn.reactants.keys().any(|k| k.ends_with("(s)")) { "solid" } else { "wall" };
                self.gas_fluxes.push(GasFlux {
                    species: gas_sp.clone(),
                    rate_ml_s: vol_gas_ml / dt_s,
                    bubble_diameter_mm: self.bubble_diameter_mm(nucleation),
                    nucleation: nucleation.to_string(),
                    origin: None,
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
                role: None,
            });
        }

        for (sp, mol) in gas_out {
            self.ledger.book_out(&sp, mol);
        }

        q_joules
    }

    /// Total surface area (m^2) of every solid that catalyses a registered reaction: the solid's specific surface (record
    /// datum, BET) times its mass, else the surface of its particle population, else that of a population of the
    /// default grain size.
    pub(crate) fn catalyst_areas(&self) -> HashMap<String, f64> {
        let mut out = HashMap::new();
        for cat in self.kinetic_reactions.iter().filter_map(|r| r.catalyst_species.as_ref()) {
            if out.contains_key(cat) {
                continue;
            }
            let mol = self.solid_mol.get(cat).copied().unwrap_or(0.0);
            if mol <= 0.0 {
                continue;
            }
            let mass_g = mol * chem_db::get_species_thermo(cat).mw;
            let bet = crate::db::SpeciesStore::global().read().ok().and_then(|st| st.get(cat).and_then(|r| r.phases.get("s").and_then(|p| p.specific_area.as_ref().map(|d| d.value))));
            let area = match bet {
                Some(a) if a > 0.0 => a * mass_g,
                _ => match self.particle_populations.get(cat).filter(|p| !p.is_empty()) {
                    Some(pop) => pop.surface_area_m2(),
                    None => {
                        let props = self.solid_props(cat);
                        crate::transfer::ParticlePopulation::from_mass_and_diameter(mass_g, props.density_g_ml, props.particle_um * 1e-6).surface_area_m2()
                    }
                },
            };
            out.insert(cat.clone(), area);
        }
        out
    }

    pub fn set_particle_population(&mut self, species: &str, pop: crate::transfer::ParticlePopulation) {
        self.particle_populations.insert(species.to_string(), pop);
    }

    fn step_thermal(&mut self, dt_s: f64, reaction_heat_joules: f64) {
        let cp_contents = self.contents_heat_capacity(); // J/K
        let cp_glass = self.glass_heat_capacity(); // J/K
        let cp_total = (cp_contents + cp_glass).max(1.0);

        let mut net_energy_j = reaction_heat_joules;
        let mut external_j = 0.0;

        // External heater / hot plate
        let heater_w = self.controls.heater_w.unwrap_or(0.0);
        let burner_w = self.controls.burner_w.unwrap_or(0.0);
        // a hot plate passes on what its surface temperature allows (`heat_transfer::hot_plate_heat_w`): the knob sets the
        // power, the plate top cannot exceed its limit, so a vessel emptied by boiling does not run away to 1300 K
        let plate_w = crate::heat_transfer::hot_plate_heat_w(heater_w, self.temperature_k, self.room_k, self.config.inner_radius_cm / 100.0);
        external_j += (plate_w + burner_w) * dt_s;

        // Thermal bath coupling: liquid film, glass wall and bath film in series over the wetted wall and base
        if let Some(t_bath) = self.bath_k {
            let r_m = self.config.inner_radius_cm / 100.0;
            let k_bath = self.controls.bath_coupling_w_k.unwrap_or_else(|| crate::heat_transfer::bath_coupling_w_per_k(r_m, self.config.capacity_ml, self.total_liquid_volume_ml(), self.stir_rpm() > 0.0));
            let q_into_vessel_w = k_bath * (t_bath - self.temperature_k);
            external_j += q_into_vessel_w * dt_s;
            // a finite bath pays for it: what the vessel takes leaves the bath's ice and water, the room warms or cools the
            // bath through its open surface and walls
            if let Some(b) = &mut self.bath {
                let r_bath = 1.75 * r_m;
                let volume_ml = (b.mass_g() / 0.998).max(1.0);
                let g_room = crate::heat_transfer::ambient_loss_w_per_k(r_bath, volume_ml * 1.25, volume_ml, b.t_k, self.room_k, false).max(0.5);
                b.step(q_into_vessel_w, g_room, self.room_k, dt_s);
                self.bath_k = Some(b.t_k);
            }
        }

        // Loss to the room: natural convection and radiation from the wall, conduction through the base (the coefficient
        // follows the liquid height and the temperature, so a vessel cools fast while hot and slowly near room temperature)
        let r_m = self.config.inner_radius_cm / 100.0;
        let g_ambient = crate::heat_transfer::ambient_loss_w_per_k(r_m, self.config.capacity_ml, self.total_liquid_volume_ml(), self.temperature_k, self.room_k, self.bath_k.is_some());
        external_j -= g_ambient * (self.temperature_k - self.room_k) * dt_s;
        net_energy_j += external_j;
        self.external_energy_j += external_j;

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

        // what a pH electrode reads in the water-containing phase
        let electrode = self.ph_electrode_reading();
        // one layer per liquid phase (the phases are the liquid-liquid equilibrium's, densest first)
        let views = self.phase_views();
        let mut layers: Vec<LiquidLayer> = Vec::new();
        for (idx, v) in views.iter().enumerate() {
            if v.volume_ml <= 0.001 {
                continue;
            }
            let aqueous = self.phase_is_aqueous(&v.species_mol);
            let lead = if aqueous {
                None
            } else {
                v.species_mol.iter().filter(|(k, _)| ions::species_charge(k) == 0).max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal).then(b.0.cmp(a.0))).map(|(k, _)| k.clone())
            };
            let (lead_species, lead_name) = if aqueous {
                (Some(AQUEOUS_SOLVENT.to_string()), Some("Aqueous phase".to_string()))
            } else {
                let sp = lead;
                let name = sp.as_ref().map(|k| self.display_name(k)).or_else(|| Some("Organic phase".to_string()));
                (sp, name)
            };
            let n_layer = crate::props::lorentz_lorenz_refractive_index(&v.species_mol, v.volume_ml);
            let po = self.phase_optics(&v.species_mol, v.volume_ml, lead_species.as_deref());
            let (scatter, albedo) = if idx == 0 { self.suspension_optics(n_layer) } else { (vec![0.0; optics::N_BINS], vec![1.0; optics::N_BINS]) };
            layers.push(LiquidLayer {
                phase: if aqueous { PhaseKind::Aqueous } else { PhaseKind::Organic },
                volume_ml: v.volume_ml,
                density_g_ml: if v.volume_ml > 1e-9 { v.mass_g / v.volume_ml } else { 1.0 },
                refractive_index: n_layer,
                absorbance_per_cm: po.a_per_cm,
                scatter_per_cm: scatter,
                scatter_albedo: albedo,
                colour_tier: po.tier,
                colour_sources: po.sources,
                solvent_class: po.solvent.to_string(),
                name: lead_name,
                species: lead_species,
                ph: if aqueous && idx == 0 { electrode.0 } else { None },
                ph_activity: if aqueous && idx == 0 { electrode.1 } else { None },
                ph_junction_mv: if aqueous && idx == 0 { electrode.2 } else { None },
                water_mole_fraction: if aqueous { electrode.3 } else { 0.0 },
            });
        }
        // densest at the bottom (first in the list for rendering order)
        layers.sort_by(|a, b| b.density_g_ml.partial_cmp(&a.density_g_ml).unwrap_or(std::cmp::Ordering::Equal));

        let mut solids = Vec::new();
        let hyd = self.hydro_state();
        let dust = self.dust_mol();
        let mut solid_ids: Vec<(&String, &f64)> = self.solid_mol.iter().collect();
        solid_ids.sort_by(|a, b| a.0.cmp(b.0));
        for (sp, &mol) in solid_ids {
            if mol <= dust {
                continue;
            }
            let thermo = chem_db::get_species_thermo(sp);
            let mass_g = mol * thermo.mw;
            let props = self.solid_props(sp);
            let density = props.density_g_ml;
            let volume_ml = if density > 1e-9 { mass_g / density } else { 0.0 };

            let pop = self.particle_populations.get(sp);
            let d_um = pop.map_or(props.particle_um, |p| p.mean_diameter_m() * 1e6);
            let morphology = self.solid_morphology(sp, &props, d_um).to_string();
            let settled_vol = if morphology == "bed" {
                volume_ml * 1.6
            } else {
                volume_ml
            };
            let init_mol = *self.initial_solids.get(sp).unwrap_or(&mol);
            let rem_frac = (mol / init_mol.max(1e-9)).clamp(0.0, 1.0);

            let kind = if props.kind == SolidKind::Metal {
                SolidKind::Metal
            } else if pop.is_none() {
                props.kind
            } else if d_um < 0.5 {
                SolidKind::Gel
            } else if d_um < 5.0 {
                SolidKind::Curds
            } else if d_um < 40.0 {
                SolidKind::Powder
            } else {
                SolidKind::Crystal
            };
            let view = self.solid_size_view(sp, &props);
            let (settle_mm_s, area_cm2) = {
                let rho_p = density * 1000.0;
                let (mut vsum, mut wsum) = (0.0, 0.0);
                for (d_m, s_k) in view.class_d_m.iter().zip(view.class_susp.iter()) {
                    let v = crate::transfer::hydro::terminal_velocity(*d_m, rho_p, hyd.rho_l, hyd.eta);
                    let pe = crate::transfer::settling::peclet_number(v, *d_m, hyd.eta, self.temperature_k);
                    vsum += s_k * if v > 0.0 && pe >= 1.0 { v * 1e3 } else { 0.0 };
                    wsum += s_k;
                }
                (if wsum > 1e-12 { vsum / wsum } else { 0.0 }, pop.map_or(0.0, |p| p.surface_area_m2() * 1e4))
            };

            // only a bed of grains in a liquid can be suspended: pieces and monoliths never are, and nothing is without a liquid
            let (suspended_fraction, suspended_diameter_um) = if morphology != "bed" || layers.is_empty() {
                (0.0, 0.0)
            } else {
                (
                    self.ev.susp.get(sp).copied().unwrap_or(if kind == SolidKind::Curds || kind == SolidKind::Gel { 0.8 } else { 0.2 }),
                    view.suspended_d_m * 1e6,
                )
            };

            let (floating, layer_index) = if layers.is_empty() {
                (if density < 1.0 { Some(true) } else { None }, None)
            } else if density < layers.last().unwrap().density_g_ml {
                (Some(true), Some(layers.len() - 1))
            } else if density > layers[0].density_g_ml {
                (Some(false), Some(0))
            } else {
                let mut idx = 0;
                for (i, layer) in layers.iter().enumerate() {
                    if density <= layer.density_g_ml {
                        idx = i;
                    }
                }
                (Some(true), Some(idx))
            };
            let floating = if kind == SolidKind::Metal && self.gas_fluxes.iter().any(|g| g.rate_ml_s > 0.01) {
                Some(true)
            } else {
                floating
            };

            let floc_diameter_um = self.floc_diameter_m(&props, &view) * 1e6;
            solids.push(SolidVisual {
                species: sp.clone(),
                name: props.name.clone(),
                mass_g,
                density_g_ml: density,
                volume_ml,
                settled_volume_ml: settled_vol,
                morphology,
                suspended_fraction,
                particle_diameter_um: d_um,
                suspended_diameter_um,
                particle_sigma_g: view.sigma_g,
                rgb: props.rgb,
                colour_tier: props.colour_tier.clone(),
                colour_source: props.colour_source.clone(),
                kind,
                floating,
                layer_index,
                remaining_fraction: Some(rem_frac),
                settling_velocity_mm_s: settle_mm_s,
                surface_area_cm2: area_cm2,
                floc_diameter_um,
            });
        }

        let fumes = self.fume_visuals();

        let flame = if self.flame_active { self.flame_visual.clone() } else { None };

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
            let mut view_species: Vec<(&String, &f64)> = view.species_mol.iter().collect();
            view_species.sort_by(|a, b| a.0.cmp(b.0));
            for (sp, &mol) in view_species {
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
        let mut solid_rows: Vec<(&String, &f64)> = self.solid_mol.iter().collect();
        solid_rows.sort_by(|a, b| a.0.cmp(b.0));
        for (sp, &mol) in solid_rows {
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
        // bubbling vigour from the vapour flow: superheat / flux ratio, not saturating at 0.94
        let boil_intensity = if is_boiling { (self.boil_vapour_ml_s / 50.0).max(0.12) } else { 0.0 };
        // visible vapour and wall condensation come from the mixing-line supersaturation of whatever evaporates (a dry vessel, a
        // cold liquid or a sealed vessel shows none)
        let mist = self.mist_state();
        let vap_visibility = if has_liquid { mist.visibility.max(if is_boiling { boil_intensity * mist.visibility } else { 0.0 }) } else { 0.0 };
        let condensation = if has_liquid { mist.condensation } else { 0.0 };

        // Aggregate gas fluxes per species and nucleation site; drop noise below 1e-4 mL/s
        let mut aggregated_fluxes: HashMap<(String, String), (f64, Option<String>)> = HashMap::new();
        for g in &self.gas_fluxes {
            if g.rate_ml_s < 1e-4 {
                continue;
            }
            let entry = aggregated_fluxes.entry((g.species.clone(), g.nucleation.clone())).or_insert((0.0, None));
            entry.0 += g.rate_ml_s;
            if entry.1.is_none() && g.origin.is_some() {
                entry.1 = g.origin.clone();
            }
        }
        let mut final_gas_fluxes: Vec<GasFlux> = aggregated_fluxes
            .into_iter()
            .map(|((species, nucleation), (rate_ml_s, origin))| {
                let bubble_diameter_mm = self.bubble_diameter_mm(&nucleation);
                GasFlux {
                    species,
                    rate_ml_s,
                    bubble_diameter_mm,
                    nucleation,
                    origin,
                }
            })
            .collect();
        final_gas_fluxes.sort_by(|a, b| a.species.cmp(&b.species).then(a.nucleation.cmp(&b.nucleation)));

        let mut total_gas_rate = 0.0;
        for g in &final_gas_fluxes {
            total_gas_rate += g.rate_ml_s;
        }
        let foam = self.foam_level(total_gas_rate);

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

        let electro_readout = self.electrolysis_snapshot();
        let electrodes_vis = electro_readout.as_ref().map(|r| r.electrodes.clone()).unwrap_or_default();

        VesselSnapshot {
            t_sim_s: self.t_sim_s,
            temperature_k: self.temperature_k,
            room_k: self.room_k,
            bath_k: self.bath_k,
            bath: self.bath.as_ref().map(|b| b.visual()),
            pressure_atm: self.pressure_atm,
            sealed: self.sealed,
            burst: self.burst,
            ph,
            ionic_strength: ionic_str,
            layers,
            total_liquid_ml: total_liq_ml,
            solids,
            gas_fluxes: final_gas_fluxes,
            foam,
            boil_intensity,
            evaporation_g_s: if is_boiling { self.boil_mass_g_s } else { self.evaporation_g_s },
            vapour_visibility: vap_visibility,
            condensation,
            fumes,
            flame,
            electrolysis: electro_readout,
            electrodes: electrodes_vis,
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
            network_cap_reached: Some(self.network_cap_reached),
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

    /// pKw of the solvent at the vessel's temperature: from the autoionisation row of the equilibria (the vessel's own data),
    /// else the analytic expression of water.
    pub fn pkw(&self) -> f64 {
        self.equilibria
            .iter()
            .find(|e| is_autoprotolysis(e))
            .map(|e| -e.log_k_at(self.temperature_k))
            .unwrap_or_else(|| -chem_db::water_log_kw(self.temperature_k))
    }

    /// pH = -log10(m_H+ * gamma_H+) in the phase that contains water (decision D6 for other solvents).
    /// A glass pH electrode with a 3 M KCl bridge in the water-containing phase (`ph_electrode`): (reading, thermodynamic
    /// pH, junction potential in mV, water mole fraction of the solvent). The reading is absent when there is no aqueous
    /// phase or water is under half of its molecules (outside the electrode's range).
    pub fn ph_electrode_reading(&self) -> (Option<f64>, Option<f64>, Option<f64>, f64) {
        if !self.has_aqueous_phase() || self.solvent_volume_ml() <= 0.0 {
            return (None, None, None, 0.0);
        }
        let n_w = self.species_mol.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0);
        let n_other: f64 = self.species_mol.iter().filter(|(k, &v)| v > 0.0 && k.as_str() != AQUEOUS_SOLVENT && ions::species_charge(k) == 0 && !k.ends_with("(s)") && !k.ends_with("(g)")).map(|(_, v)| *v).sum();
        let x_w = n_w / (n_w + n_other).max(1e-300);
        let ph_a = self.current_ph();
        if !ph_a.is_finite() {
            return (None, None, None, x_w);
        }
        let t = self.temperature_k;
        let vol_l = (self.phase_volume_ml(&self.species_mol, t) / 1000.0).max(1e-9);
        let ions: Vec<(String, f64)> = self.species_mol.iter().filter(|(k, &v)| v > 0.0 && ions::species_charge(k) != 0).map(|(k, v)| (k.clone(), v / vol_l)).collect();
        let ej = crate::ph_electrode::henderson_junction_v(&ions, t);
        let reading = if x_w >= crate::ph_electrode::min_water_mole_fraction() { Some(ph_a + crate::ph_electrode::junction_ph_shift(ej, t)) } else { None };
        (reading, Some(ph_a), Some(ej * 1000.0), x_w)
    }

    pub fn current_ph(&self) -> f64 {
        if !self.has_aqueous_phase() || self.solvent_volume_ml() <= 0.0 {
            return f64::NAN;
        }
        let t_k = self.temperature_k;
        let n_h2o = self.species_mol.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0);
        let kg_w = (n_h2o * 0.01801528).max(1e-12);
        let m_h = self.species_mol.get(crate::db::seed::PROTON).copied().unwrap_or(0.0) / kg_w;
        let m_oh = self.species_mol.get(crate::db::seed::HYDROXIDE).copied().unwrap_or(0.0) / kg_w;

        let pkw = self.pkw();

        let (gamma_cache, a_w) = crate::activity::batch_aqueous_gamma_and_aw(&self.species_mol, t_k);

        if m_h > 0.0 && m_oh > 0.0 && (m_h - m_oh).abs() <= 1e-6 * m_h.max(m_oh) {
            return 0.5 * (pkw - a_w.log10());
        }

        if m_h > 0.0 && m_h >= m_oh {
            let ln_gamma_h = gamma_cache.get(crate::db::seed::PROTON).copied().unwrap_or(0.0);
            let a_h = m_h * ln_gamma_h.exp();
            return -a_h.log10();
        }

        if m_oh > 0.0 {
            let ln_gamma_oh = gamma_cache.get(crate::db::seed::HYDROXIDE).copied().unwrap_or(0.0);
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

    pub(crate) fn calc_ionic_strength(&self) -> f64 {
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

    /// What a solid is in the vessel: `monolith` (a frozen liquid cast to the vessel), `pieces` (a solid dosed in a loose form,
    /// a large metal grain, ice that was added), or `bed` (grains that settle or stay suspended).
    pub(crate) fn solid_morphology(&self, sp: &str, props: &crate::vessel_ext::SolidProps, d_um: f64) -> &'static str {
        let mol = self.solid_mol.get(sp).copied().unwrap_or(0.0);
        let cast_fraction = (self.solid_cast_mol.get(sp).copied().unwrap_or(0.0) / mol.max(1e-300)).clamp(0.0, 1.0);
        let is_ice = self.solid_is_frozen_liquid(sp);
        if is_ice && cast_fraction >= 0.5 {
            "monolith"
        } else if self.solid_forms.contains_key(sp) || (props.kind == SolidKind::Metal && d_um >= 200.0) || (is_ice && self.total_liquid_volume_ml() > 0.001) {
            "pieces"
        } else if is_ice {
            "monolith"
        } else {
            "bed"
        }
    }

    /// Extinction (1/cm) and single-scattering albedo per bin of the suspended solids in a medium of index `n_medium`: every
    /// size class of every solid is a Mie / Rayleigh-Gans population with the solid's own refractive index and absorption.
    /// Solids are summed in sorted order, so the result never depends on hash order.
    pub(crate) fn suspension_optics(&self, n_medium: f64) -> (Vec<f64>, Vec<f64>) {
        let n = optics::N_BINS;
        let vol_ml = self.reaction_volume_ml();
        let mut ext = vec![0.0; n];
        let mut sca = vec![0.0; n];
        if vol_ml <= 0.0 {
            return (ext, vec![1.0; n]);
        }
        let dust = self.dust_mol();
        let mut keys: Vec<&String> = self.solid_mol.keys().collect();
        keys.sort();
        for sp in keys {
            let mol = self.solid_mol[sp];
            if mol <= dust {
                continue;
            }
            let props = self.solid_props(sp);
            let pop = self.particle_populations.get(sp);
            let d_um = pop.map_or(props.particle_um, |p| p.mean_diameter_m() * 1e6);
            // loose pieces and cast masses do not scatter like a slurry
            if self.solid_morphology(sp, &props, d_um) != "bed" {
                continue;
            }
            let thermo = chem_db::get_species_thermo(sp);
            let mass_g = mol * thermo.mw;
            let mass_conc = (mass_g / vol_ml) * self.ev.susp.get(sp).copied().unwrap_or(0.8).clamp(0.0, 1.0);
            // every equal-mass size class scatters with its own cross-section per gram, weighted by its own suspended
            // fraction (`mass_conc` already carries the mean one)
            let view = self.solid_size_view(sp, &props);
            let susp_mean = (view.class_susp.iter().sum::<f64>() / view.class_susp.len() as f64).max(1e-9);
            let classes: Vec<optics::scatter::Class> = view
                .class_d_m
                .iter()
                .zip(view.class_susp.iter())
                .map(|(d_m, s_k)| optics::scatter::Class {
                    mass_conc_g_ml: mass_conc * (s_k / susp_mean) / view.class_d_m.len() as f64,
                    diameter_um: d_m * 1e6,
                    density_g_ml: props.density_g_ml,
                })
                .collect();
            let (e, s) = optics::scatter::suspension_spectra(&classes, &optics::scatter::Material { n: props.refractive_index, alpha_per_cm: &props.alpha_per_cm }, n_medium);
            for i in 0..n {
                ext[i] += e[i];
                sca[i] += s[i];
            }
        }
        let albedo = (0..n).map(|i| if ext[i] > 1e-12 { (sca[i] / ext[i]).clamp(0.0, 1.0) } else { 1.0 }).collect();
        (ext, albedo)
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
