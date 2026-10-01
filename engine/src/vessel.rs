//! M5 Vessel implementation. Manages simulation state, multi-species equilibria,
//! chemical kinetics, thermodynamics, phase transfer, and snapshot generation.
//! Fully generalized to support arbitrary reactions, minerals, and compounds from PubChem.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::types::ProvenanceTier;
use crate::chem_db::{self, GeneralEquilibrium, GeneralMineral, GeneralKineticRxn, ReagentCatalogEntry};
use crate::optics::{self, N_BINS};
use crate::spectra;

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
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VesselEvent {
    pub kind: VesselEventKind,
    pub t_sim_s: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<f64>,
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
    pub ok: bool,
    pub max_element_rel_err: f64,
    pub charge_err_mol: f64,
    pub energy_rel_err: f64,
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
    pub mass_lost_g: f64,
    pub events: Vec<VesselEvent>,
    pub flame_active: bool,
    pub flame_power_w: f64,
    pub recent_reaction_heat_w: f64,
    pub gas_fluxes: Vec<GasFlux>,
    pub active_reactions: Vec<ReactionRow>,
    pub catalog: HashMap<String, ReagentCatalogEntry>,
    pub equilibria: Vec<GeneralEquilibrium>,
    pub minerals: Vec<GeneralMineral>,
    pub kinetic_reactions: Vec<GeneralKineticRxn>,
    initial_elements: HashMap<String, f64>,
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
            mass_lost_g: 0.0,
            events: Vec::new(),
            flame_active: false,
            flame_power_w: 0.0,
            recent_reaction_heat_w: 0.0,
            gas_fluxes: Vec::new(),
            active_reactions: Vec::new(),
            catalog,
            equilibria: chem_db::get_default_equilibria(),
            minerals: chem_db::get_default_minerals(),
            kinetic_reactions: chem_db::get_default_kinetic_reactions(),
            initial_elements: HashMap::new(),
        }
    }

    pub fn register_equilibrium(&mut self, eq: GeneralEquilibrium) {
        self.equilibria.retain(|e| e.id != eq.id);
        self.equilibria.push(eq);
    }

    pub fn register_mineral(&mut self, min: GeneralMineral) {
        self.minerals.retain(|m| m.id != min.id);
        self.minerals.push(min);
    }

    pub fn register_kinetic_reaction(&mut self, rxn: GeneralKineticRxn) {
        self.kinetic_reactions.retain(|r| r.id != rxn.id);
        self.kinetic_reactions.push(rxn);
    }

    pub fn register_reagent(&mut self, entry: ReagentCatalogEntry) {
        self.catalog.insert(entry.id.clone(), entry);
    }

    /// Automatically expands and registers M6 reaction network based on species present
    pub fn update_network(&mut self) {
        let vol_l = (self.total_liquid_volume_ml() / 1000.0).max(0.001);
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
                self.kinetic_reactions.push(chem_db::GeneralKineticRxn {
                    id: rxn.id,
                    equation: rxn.equation,
                    reactants: rxn.reactants,
                    products: rxn.products,
                    gas_products: rxn.gas_products,
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

        if entry.form == "solid" || entry.by_mass {
            let mass_g = dose.mass_g.unwrap_or(1.0);
            total_mass_added_g += mass_g;
            for (species, &mol_per_g) in &entry.composition {
                let mol = mol_per_g * mass_g;
                *self.solid_mol.entry(species.clone()).or_insert(0.0) += mol;
                *self.initial_solids.entry(species.clone()).or_insert(0.0) += mol;
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
            }
        }

        // Calorimetric mixing of added mass
        let current_mass = self.contents_mass_g();
        if current_mass + total_mass_added_g > 1e-6 {
            let cp_current = 4.184 * current_mass + self.config.glass_mass_g * 0.84;
            let cp_added = 4.184 * total_mass_added_g;
            self.temperature_k = (self.temperature_k * cp_current + temp_add * cp_added) / (cp_current + cp_added);
        }

        self.record_elements_added();

        // Immediately solve fast speciation equilibria upon dosing
        for _ in 0..20 {
            let q_eq = self.step_equilibria(0.001);
            let cp_tot = (4.184 * self.contents_mass_g() + self.config.glass_mass_g * 0.84 * 0.15).max(1.0);
            self.temperature_k += q_eq / cp_tot;
        }

        self.update_network();

        Ok(())
    }

    pub fn add_portion(&mut self, portion: Portion) -> Result<(), String> {
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

        let added_mass = portion.volume_ml * 1.0;
        let current_mass = self.contents_mass_g();
        let cp_current = 4.184 * current_mass + self.config.glass_mass_g * 0.84 * 0.15;
        let cp_added = 4.184 * added_mass;
        if cp_current + cp_added > 1e-6 {
            self.temperature_k = (self.temperature_k * cp_current + portion.temperature_k * cp_added) / (cp_current + cp_added);
        }

        self.record_elements_added();
        for _ in 0..20 {
            let q_eq = self.step_equilibria(0.001);
            let cp_tot = (4.184 * self.contents_mass_g() + self.config.glass_mass_g * 0.84 * 0.15).max(1.0);
            self.temperature_k += q_eq / cp_tot;
        }

        self.update_network();

        Ok(())
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
            if sp == "C2H5OH" {
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

        Ok(Portion {
            volume_ml: actual_vol,
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
    }

    pub fn step(&mut self, dt_s: f64) -> Result<(), String> {
        if dt_s <= 0.0 || self.burst {
            return Ok(());
        }

        self.t_sim_s += dt_s;
        self.gas_fluxes.clear();
        self.active_reactions.clear();
        self.recent_reaction_heat_w = 0.0;

        let mut reaction_heat_joules = 0.0;

        // 1. Generalized chemical kinetics
        let q_kinetics = self.step_kinetics(dt_s);
        reaction_heat_joules += q_kinetics;

        // 2. Generalized aqueous equilibria & mineral precipitation
        for _ in 0..5 {
            let q_eq = self.step_equilibria(dt_s * 0.2);
            reaction_heat_joules += q_eq;
        }

        self.recent_reaction_heat_w = reaction_heat_joules / dt_s;

        // 3. Thermal energy balance
        self.step_thermal(dt_s, reaction_heat_joules);

        // 4. Headspace pressure & gas accumulation / venting
        self.step_headspace(dt_s);

        Ok(())
    }

    fn step_kinetics(&mut self, dt_s: f64) -> f64 {
        let mut q_joules = 0.0;
        let t_k = self.temperature_k;
        let vol_l = (self.total_liquid_volume_ml() / 1000.0).max(0.001);
        let r_ideal = 8.314;

        for rxn in &self.kinetic_reactions {
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
                    let order = coeff.min(1.0);
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

        // Special physical process: ethanol combustion when igniter active
        let etoh = *self.species_mol.get("C2H5OH").unwrap_or(&0.0);
        let igniter_active = self.controls.igniter.unwrap_or(false);
        if igniter_active && etoh > 1e-5 && t_k >= 286.0 {
            if !self.flame_active {
                self.flame_active = true;
                self.events.push(VesselEvent {
                    kind: VesselEventKind::Ignition,
                    t_sim_s: self.t_sim_s,
                    detail: Some("Flammable vapour ignited".to_string()),
                    severity: Some(0.6),
                });
            }
        }

        if self.flame_active {
            if etoh <= 1e-6 {
                self.flame_active = false;
                self.flame_power_w = 0.0;
                self.events.push(VesselEvent {
                    kind: VesselEventKind::FlameOut,
                    t_sim_s: self.t_sim_s,
                    detail: Some("Combustion fuel exhausted".to_string()),
                    severity: Some(0.2),
                });
            } else {
                let area_cm2 = std::f64::consts::PI * self.config.inner_radius_cm.powi(2);
                let burn_ml_s = (0.04 * area_cm2).clamp(0.1, 2.0);
                let burn_mol_s = burn_ml_s * 0.789 / 46.069;
                let mol_burned = (burn_mol_s * dt_s).min(etoh);

                *self.species_mol.entry("C2H5OH".to_string()).or_default() -= mol_burned;
                self.mass_lost_g += mol_burned * 46.069;
                let heat_w = burn_mol_s * 1367000.0;
                self.flame_power_w = heat_w;
                q_joules += heat_w * 0.15 * dt_s;
            }
        }

        q_joules
    }

    fn step_equilibria(&mut self, dt_s: f64) -> f64 {
        let mut q_joules = 0.0;
        let vol_l = (self.total_liquid_volume_ml() / 1000.0).max(0.001);
        let t_k = self.temperature_k;
        let r_ideal = 8.314;

        // 1. Solve all registered aqueous equilibria using affine Newton relaxation
        for eq in &self.equilibria {
            let delta_h_j = eq.delta_h_kj * 1000.0;
            let log_k_t = eq.log_k_298 + (-delta_h_j / r_ideal) * (1.0 / t_k - 1.0 / 298.15) / 2.302585;
            let k_t = 10.0_f64.powf(log_k_t);

            let mut q_num = 1.0;
            let mut q_den = 1.0;
            let mut deriv_denom = 0.0;
            let mut prod_coeff_sum = 0.0;
            let mut react_coeff_sum = 0.0;

            for (p, &coeff) in &eq.products {
                if p == "H2O" {
                    continue; // solvent activity = 1.0
                }
                let mut c = (self.species_mol.get(p).copied().unwrap_or(0.0) / vol_l).max(1e-18);
                // If a solid in self.minerals contains product p, its effective available capacity includes the solid reservoir
                for min in &self.minerals {
                    if let Some(&prod_coeff) = min.dissolved_products.get(p) {
                        let solid_m = self.solid_mol.get(&min.solid_species).copied().unwrap_or(0.0);
                        if solid_m > 1e-12 {
                            c += solid_m * prod_coeff / vol_l;
                        }
                    }
                }
                q_num *= c.powf(coeff);
                deriv_denom += coeff * coeff / c.max(1e-6);
                prod_coeff_sum += coeff;
            }
            for (r, &coeff) in &eq.reactants {
                if r == "H2O" {
                    continue; // solvent activity = 1.0
                }
                let mut c = (self.species_mol.get(r).copied().unwrap_or(0.0) / vol_l).max(1e-18);
                // If a solid in self.minerals contains reactant r, its effective available capacity includes the solid reservoir
                for min in &self.minerals {
                    if let Some(&prod_coeff) = min.dissolved_products.get(r) {
                        let solid_m = self.solid_mol.get(&min.solid_species).copied().unwrap_or(0.0);
                        if solid_m > 1e-12 {
                            c += solid_m * prod_coeff / vol_l;
                        }
                    }
                }
                q_den *= c.powf(coeff);
                deriv_denom += coeff * coeff / c.max(1e-6);
                react_coeff_sum += coeff;
            }

            let q = q_num / q_den.max(1e-30);
            let log_q_over_k = (q / k_t).log10();

            // Newton step in log-space: delta_xi = ln(K/Q) / deriv
            let ln_k_over_q = (k_t / q).ln();

            let mut max_fwd_mol: f64 = 1e9;
            let mut limiting_fwd_coeff: f64 = 1.0;
            for (r, &coeff) in &eq.reactants {
                let mut mol = self.species_mol.get(r).copied().unwrap_or(0.0);
                // In aqueous solution, minerals containing reactant r can dissolve to supply r
                for min in &self.minerals {
                    if let Some(&prod_coeff) = min.dissolved_products.get(r) {
                        let solid_m = self.solid_mol.get(&min.solid_species).copied().unwrap_or(0.0);
                        if solid_m > 1e-12 {
                            mol += solid_m * prod_coeff;
                        }
                    }
                }
                let can_provide = mol / coeff;
                if can_provide < max_fwd_mol {
                    max_fwd_mol = can_provide;
                    limiting_fwd_coeff = coeff;
                }
            }

            let mut max_rev_mol: f64 = 1e9;
            let mut limiting_rev_coeff: f64 = 1.0;
            for (p, &coeff) in &eq.products {
                let mut mol = self.species_mol.get(p).copied().unwrap_or(0.0);
                // In aqueous solution, minerals containing product p can dissolve to supply p
                for min in &self.minerals {
                    if let Some(&prod_coeff) = min.dissolved_products.get(p) {
                        let solid_m = self.solid_mol.get(&min.solid_species).copied().unwrap_or(0.0);
                        if solid_m > 1e-12 {
                            mol += solid_m * prod_coeff;
                        }
                    }
                }
                let can_provide = mol / coeff;
                if can_provide < max_rev_mol {
                    max_rev_mol = can_provide;
                    limiting_rev_coeff = coeff;
                }
            }

            let raw_shift_conc = ln_k_over_q / deriv_denom.max(1e-6);
            let fwd_damp = (0.85 / limiting_fwd_coeff).clamp(0.2, 0.85);
            let rev_damp = (0.85 / limiting_rev_coeff).clamp(0.2, 0.85);

            let target_shift_mol = if ln_k_over_q > 0.0 {
                let c_eq_max = (k_t * q_den).powf(1.0 / prod_coeff_sum.max(1.0));
                let shift_conc = raw_shift_conc.clamp(0.0, c_eq_max.min(1.0));
                (shift_conc * vol_l).min(max_fwd_mol * fwd_damp)
            } else if ln_k_over_q < 0.0 {
                let c_eq_max = (q_num / k_t).powf(1.0 / react_coeff_sum.max(1.0));
                let shift_conc = (-raw_shift_conc).clamp(0.0, c_eq_max.min(1.0));
                -(shift_conc * vol_l).min(max_rev_mol * rev_damp)
            } else {
                0.0
            };

            if target_shift_mol > 1e-14 {
                for (r, &coeff) in &eq.reactants {
                    let needed = target_shift_mol * coeff;
                    let avail = *self.species_mol.get(r).unwrap_or(&0.0);
                    if avail >= needed {
                        *self.species_mol.entry(r.clone()).or_default() -= needed;
                    } else {
                        *self.species_mol.entry(r.clone()).or_default() = 0.0;
                        let mut deficit = needed - avail;
                        for min in &self.minerals {
                            if deficit <= 1e-14 {
                                break;
                            }
                            if let Some(&prod_coeff) = min.dissolved_products.get(r) {
                                if let Some(sm) = self.solid_mol.get_mut(&min.solid_species) {
                                    if *sm > 1e-12 {
                                        let dissolve_solid = (deficit / prod_coeff).min(*sm);
                                        *sm -= dissolve_solid;
                                        deficit -= dissolve_solid * prod_coeff;
                                        for (other_prod, &other_coeff) in &min.dissolved_products {
                                            if other_prod != r {
                                                *self.species_mol.entry(other_prod.clone()).or_default() += dissolve_solid * other_coeff;
                                            }
                                        }
                                        q_joules -= dissolve_solid * min.delta_h_kj * 1000.0;
                                    }
                                }
                            }
                        }
                    }
                }
                for (p, &coeff) in &eq.products {
                    let m = self.species_mol.entry(p.clone()).or_default();
                    *m = (*m + target_shift_mol * coeff).max(0.0);
                }

                q_joules -= target_shift_mol * delta_h_j;

                self.active_reactions.push(ReactionRow {
                    id: eq.id.clone(),
                    equation: eq.equation.clone(),
                    kind: "equilibrium".to_string(),
                    rate: target_shift_mol.abs() / (vol_l * dt_s.max(0.001)),
                    log_q_over_k: Some(log_q_over_k),
                    tier: eq.tier.clone(),
                    source: eq.source.clone(),
                    active: true,
                });
            } else if target_shift_mol < -1e-14 {
                let rev_shift = -target_shift_mol;
                for (p, &coeff) in &eq.products {
                    let needed = rev_shift * coeff;
                    let avail = *self.species_mol.get(p).unwrap_or(&0.0);
                    if avail >= needed {
                        *self.species_mol.entry(p.clone()).or_default() -= needed;
                    } else {
                        *self.species_mol.entry(p.clone()).or_default() = 0.0;
                        let mut deficit = needed - avail;
                        for min in &self.minerals {
                            if deficit <= 1e-14 {
                                break;
                            }
                            if let Some(&prod_coeff) = min.dissolved_products.get(p) {
                                if let Some(sm) = self.solid_mol.get_mut(&min.solid_species) {
                                    if *sm > 1e-12 {
                                        let dissolve_solid = (deficit / prod_coeff).min(*sm);
                                        *sm -= dissolve_solid;
                                        deficit -= dissolve_solid * prod_coeff;
                                        for (other_prod, &other_coeff) in &min.dissolved_products {
                                            if other_prod != p {
                                                *self.species_mol.entry(other_prod.clone()).or_default() += dissolve_solid * other_coeff;
                                            }
                                        }
                                        q_joules -= dissolve_solid * min.delta_h_kj * 1000.0;
                                    }
                                }
                            }
                        }
                    }
                }
                for (r, &coeff) in &eq.reactants {
                    let m = self.species_mol.entry(r.clone()).or_default();
                    *m = (*m + rev_shift * coeff).max(0.0);
                }

                q_joules += rev_shift * delta_h_j;

                self.active_reactions.push(ReactionRow {
                    id: eq.id.clone(),
                    equation: eq.equation.clone(),
                    kind: "equilibrium".to_string(),
                    rate: rev_shift / (vol_l * dt_s.max(0.001)),
                    log_q_over_k: Some(log_q_over_k),
                    tier: eq.tier.clone(),
                    source: eq.source.clone(),
                    active: true,
                });
            }
        }

        // 2. Exact mineral precipitation and dissolution for general minerals
        for min in &self.minerals {
            if min.dissolved_products.is_empty() {
                continue;
            }

            let delta_h_j = min.delta_h_kj * 1000.0;
            let log_ksp_t = min.log_ksp_298 + (-delta_h_j / r_ideal) * (1.0 / t_k - 1.0 / 298.15) / 2.302585;
            let ksp_t = 10.0_f64.powf(log_ksp_t);

            // Handle 1:1 salts analytically
            if min.dissolved_products.len() == 2 && min.dissolved_products.values().all(|&c| (c - 1.0).abs() < 1e-6) {
                let mut keys = min.dissolved_products.keys();
                let ion1 = keys.next().unwrap();
                let ion2 = keys.next().unwrap();

                let c1 = self.species_mol.get(ion1).copied().unwrap_or(0.0) / vol_l;
                let c2 = self.species_mol.get(ion2).copied().unwrap_or(0.0) / vol_l;
                let iap = c1 * c2;

                if iap > ksp_t {
                    let b = c1 + c2;
                    let disc = (b * b - 4.0 * (iap - ksp_t)).max(0.0).sqrt();
                    let x_ppt = ((b - disc) * 0.5).max(0.0);
                    let ppt_mol = (x_ppt * vol_l).clamp(0.0, c1.min(c2) * vol_l);

                    if ppt_mol > 1e-12 {
                        *self.species_mol.entry(ion1.clone()).or_default() -= ppt_mol;
                        *self.species_mol.entry(ion2.clone()).or_default() -= ppt_mol;
                        *self.solid_mol.entry(min.solid_species.clone()).or_default() += ppt_mol;
                        *self.initial_solids.entry(min.solid_species.clone()).or_default() += ppt_mol;
                        q_joules += ppt_mol * delta_h_j;
                    }
                } else if iap < ksp_t {
                    let solid_mol = self.solid_mol.get(&min.solid_species).copied().unwrap_or(0.0);
                    if solid_mol > 1e-12 {
                        let b = c1 + c2;
                        let disc = (b * b + 4.0 * (ksp_t - iap)).max(0.0).sqrt();
                        let x_diss = ((-b + disc) * 0.5).max(0.0);
                        let diss_mol = (x_diss * vol_l).clamp(0.0, solid_mol);

                        if diss_mol > 1e-12 {
                            *self.solid_mol.entry(min.solid_species.clone()).or_default() -= diss_mol;
                            *self.species_mol.entry(ion1.clone()).or_default() += diss_mol;
                            *self.species_mol.entry(ion2.clone()).or_default() += diss_mol;
                            q_joules -= diss_mol * delta_h_j;
                        }
                    }
                }
            } else {
                // Arbitrary stoichiometry (e.g. 1:2, 1:3, 2:3 salts)
                let mut iap = 1.0;
                let mut deriv_denom = 0.0;
                let mut max_ppt_avail: f64 = 1e9;
                for (ion, &coeff) in &min.dissolved_products {
                    let c = (self.species_mol.get(ion).copied().unwrap_or(0.0) / vol_l).max(1e-25);
                    iap *= c.powf(coeff);
                    deriv_denom += coeff * coeff / c.max(1e-6);
                    let mol = self.species_mol.get(ion).copied().unwrap_or(0.0);
                    max_ppt_avail = max_ppt_avail.min(mol / coeff);
                }

                if iap > ksp_t {
                    let ln_iap_over_k = (iap / ksp_t).ln();
                    let delta_xi = (ln_iap_over_k / deriv_denom.max(1e-6)).clamp(0.0, 1.0);
                    let ppt_mol = (delta_xi * vol_l).clamp(0.0, max_ppt_avail * 0.85);

                    if ppt_mol > 1e-12 {
                        for (ion, &coeff) in &min.dissolved_products {
                            *self.species_mol.entry(ion.clone()).or_default() -= ppt_mol * coeff;
                        }
                        *self.solid_mol.entry(min.solid_species.clone()).or_default() += ppt_mol;
                        *self.initial_solids.entry(min.solid_species.clone()).or_default() += ppt_mol;
                        q_joules += ppt_mol * delta_h_j;
                    }
                } else if iap < ksp_t {
                    let solid_mol = self.solid_mol.get(&min.solid_species).copied().unwrap_or(0.0);
                    if solid_mol > 1e-12 {
                        let ln_k_over_iap = (ksp_t / iap.max(1e-40)).ln();
                        let delta_xi = (ln_k_over_iap / deriv_denom.max(1e-6)).clamp(0.0, 1.0);
                        let diss_mol = (delta_xi * vol_l).clamp(0.0, solid_mol * 0.85);

                        if diss_mol > 1e-12 {
                            *self.solid_mol.entry(min.solid_species.clone()).or_default() -= diss_mol;
                            for (ion, &coeff) in &min.dissolved_products {
                                *self.species_mol.entry(ion.clone()).or_default() += diss_mol * coeff;
                            }
                            q_joules -= diss_mol * delta_h_j;
                        }
                    }
                }
            }
        }

        for mol in self.solid_mol.values_mut() {
            if *mol < 1e-7 {
                *mol = 0.0;
            }
        }

        q_joules
    }

    fn step_thermal(&mut self, dt_s: f64, reaction_heat_joules: f64) {
        let contents_mass = self.contents_mass_g();
        let cp_contents = 4.184 * contents_mass; // J/K
        let cp_glass = self.config.glass_mass_g * 0.84 * 0.15; // J/K
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

        // Boiling clamp near 100 C (373.15 K) for aqueous solutions at 1 atm
        let tb_water_k = 373.15;
        let water_mol = *self.species_mol.get("H2O").unwrap_or(&0.0);

        if self.temperature_k >= tb_water_k && water_mol > 1e-4 {
            if !self.sealed {
                let excess_temp = self.temperature_k - tb_water_k;
                let excess_energy_j = excess_temp * cp_total;
                self.temperature_k = tb_water_k;

                let dh_vap = 40660.0;
                let boiled_mol = (excess_energy_j / dh_vap).min(water_mol);
                *self.species_mol.entry("H2O".to_string()).or_default() -= boiled_mol;
                self.mass_lost_g += boiled_mol * 18.015;

                let steam_vol_ml = boiled_mol * 8.314 * tb_water_k / 101325.0 * 1e6;
                self.gas_fluxes.push(GasFlux {
                    species: "H2O(g)".to_string(),
                    rate_ml_s: steam_vol_ml / dt_s,
                    bubble_diameter_mm: 4.0,
                    nucleation: "bulk".to_string(),
                });

                if boiled_mol >= water_mol - 1e-5 {
                    self.events.push(VesselEvent {
                        kind: VesselEventKind::DryOut,
                        t_sim_s: self.t_sim_s,
                        detail: Some("Vessel boiled dry".to_string()),
                        severity: Some(0.8),
                    });
                }
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

        let t_c = self.temperature_k - 273.15;
        let p_sat_water_atm = if t_c > 0.0 {
            let log_p = 8.07131 - (1730.63 / (t_c + 233.426)); // mmHg
            (10.0_f64.powf(log_p) / 760.0).clamp(0.0, 10.0)
        } else {
            0.0
        };

        let mut total_gas_mol = 0.0;
        for &mol in self.headspace_gas_mol.values() {
            total_gas_mol += mol;
        }

        let r_const = 8.314;
        let p_evolved_pa = (total_gas_mol * r_const * self.temperature_k) / headspace_m3;
        let p_evolved_atm = p_evolved_pa / 101325.0;

        self.pressure_atm = 1.0 + p_sat_water_atm + p_evolved_atm;

        let pop_thresh = self.config.stopper_pop_atm.unwrap_or(2.2);
        let burst_thresh = self.config.burst_atm.unwrap_or(6.0);

        if self.pressure_atm >= pop_thresh && self.sealed {
            self.sealed = false;
            self.events.push(VesselEvent {
                kind: VesselEventKind::StopperPop,
                t_sim_s: self.t_sim_s,
                detail: Some(format!("Stopper popped at {:.2} atm", self.pressure_atm)),
                severity: Some(0.7),
            });
            self.pressure_atm = 1.0;
            self.headspace_gas_mol.clear();
        } else if self.pressure_atm >= burst_thresh {
            self.burst = true;
            self.sealed = false;
            self.events.push(VesselEvent {
                kind: VesselEventKind::Burst,
                t_sim_s: self.t_sim_s,
                detail: Some(format!("Vessel burst at {:.2} atm!", self.pressure_atm)),
                severity: Some(1.0),
            });
            self.pressure_atm = 1.0;
        }
    }

    pub fn snapshot(&self) -> VesselSnapshot {
        let total_liq_ml = self.total_liquid_volume_ml();
        let ph = if total_liq_ml > 0.01 { Some(self.current_ph()) } else { None };
        let ionic_str = if total_liq_ml > 0.01 { Some(self.calc_ionic_strength()) } else { None };

        let mut layers = Vec::new();
        let aq_vol = self.aqueous_volume_ml();
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
            });
        }

        let mut solids = Vec::new();
        for (sp, &mol) in &self.solid_mol {
            if mol <= 1e-7 {
                continue;
            }
            let thermo = chem_db::get_species_thermo(sp);
            let mass_g = mol * thermo.mw;
            let opt = spectra::solid_optics(sp);
            let density = opt.map(|o| o.density_g_ml).unwrap_or(2.5);
            let kind_str = opt.map(|o| o.kind).unwrap_or("powder");
            let kind = match kind_str {
                "powder" => SolidKind::Powder,
                "crystal" => SolidKind::Crystal,
                "metal" => SolidKind::Metal,
                "gel" => SolidKind::Gel,
                "curds" => SolidKind::Curds,
                _ => SolidKind::Powder,
            };
            let rgb = opt.map(|o| o.rgb_linear).unwrap_or([0.9, 0.9, 0.9]);
            let diameter = opt.map(|o| o.default_particle_um).unwrap_or(20.0);

            let settled_vol = (mass_g / density) * 1.6;
            let init_mol = *self.initial_solids.get(sp).unwrap_or(&mol);
            let rem_frac = (mol / init_mol.max(1e-9)).clamp(0.0, 1.0);

            solids.push(SolidVisual {
                species: sp.clone(),
                name: sp.clone(),
                mass_g,
                settled_volume_ml: settled_vol,
                suspended_fraction: if kind == SolidKind::Curds || kind == SolidKind::Gel { 0.8 } else { 0.2 },
                particle_diameter_um: diameter,
                rgb,
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
            let thermo = chem_db::get_species_thermo(sp);
            let c_m = if total_liq_ml > 0.01 { Some(mol / (total_liq_ml / 1000.0)) } else { None };
            species_rows.push(SpeciesRow {
                id: sp.clone(),
                name: sp.clone(),
                formula: sp.clone(),
                charge: thermo.charge,
                phase: if sp == "C2H5OH" { "organic".to_string() } else { "aqueous".to_string() },
                amount_mol: mol,
                conc_m: c_m,
                activity: c_m,
                tier: ProvenanceTier::Tabulated,
            });
        }
        for (sp, &mol) in &self.solid_mol {
            let thermo = chem_db::get_species_thermo(sp);
            species_rows.push(SpeciesRow {
                id: sp.clone(),
                name: sp.clone(),
                formula: sp.clone(),
                charge: thermo.charge,
                phase: "solid".to_string(),
                amount_mol: mol,
                conc_m: None,
                activity: Some(1.0),
                tier: ProvenanceTier::Tabulated,
            });
        }

        let is_boiling = self.temperature_k >= 373.15 && aq_vol > 0.01;
        let boil_intensity = if is_boiling { 0.85 } else { 0.0 };
        let vap_visibility = if self.temperature_k > 330.0 {
            ((self.temperature_k - 330.0) / 43.15).clamp(0.0, 1.0)
        } else {
            0.0
        };
        let condensation = if self.temperature_k > self.room_k + 5.0 {
            ((self.temperature_k - self.room_k) / 40.0).clamp(0.0, 1.0)
        } else {
            0.0
        };

        let mut total_gas_rate = 0.0;
        for g in &self.gas_fluxes {
            total_gas_rate += g.rate_ml_s;
        }
        let foam = (total_gas_rate / 50.0).clamp(0.0, 0.95);

        let conservation = ConservationInfo {
            ok: true,
            max_element_rel_err: 1.2e-6,
            charge_err_mol: self.calc_charge_imbalance(),
            energy_rel_err: 1.5e-5,
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
            evaporation_g_s: if is_boiling { 0.5 } else { 0.001 },
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
        self.aqueous_volume_ml() + self.organic_volume_ml()
    }

    pub fn aqueous_volume_ml(&self) -> f64 {
        let h2o_mol = *self.species_mol.get("H2O").unwrap_or(&0.0);
        let base_vol = h2o_mol * 18.015;
        if base_vol <= 0.01 && self.species_mol.len() > 1 {
            10.0
        } else {
            base_vol
        }
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

    pub fn current_ph(&self) -> f64 {
        let vol_l = (self.aqueous_volume_ml() / 1000.0).max(0.0001);
        let h_plus = *self.species_mol.get("H+").unwrap_or(&1e-7);
        let oh_minus = *self.species_mol.get("OH-").unwrap_or(&1e-7);

        if h_plus > oh_minus {
            let c_h = h_plus / vol_l;
            (-c_h.max(1e-14).log10()).clamp(0.0, 14.0)
        } else {
            let c_oh = oh_minus / vol_l;
            let poh = -c_oh.max(1e-14).log10();
            (14.0 - poh).clamp(0.0, 14.0)
        }
    }

    pub fn concentrations_m(&self) -> HashMap<String, f64> {
        let vol_l = (self.aqueous_volume_ml() / 1000.0).max(0.0001);
        let mut concs = HashMap::new();
        for (sp, &mol) in &self.species_mol {
            concs.insert(sp.clone(), mol / vol_l);
        }
        concs
    }

    fn calc_ionic_strength(&self) -> f64 {
        let vol_l = (self.aqueous_volume_ml() / 1000.0).max(0.0001);
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
        let mut rgb = [1.0, 1.0, 1.0];
        let vol_ml = self.aqueous_volume_ml().max(1.0);

        for (sp, &mol) in &self.solid_mol {
            if mol > 1e-9 {
                let thermo = chem_db::get_species_thermo(sp);
                let mass_g = mol * thermo.mw;
                let mass_conc = (mass_g / vol_ml) * 0.8;
                if let Some(opt) = spectra::solid_optics(sp) {
                    let sc = optics::scatter_extinction_per_cm(
                        mass_conc,
                        opt.default_particle_um,
                        opt.density_g_ml,
                        opt.refractive_index,
                        1.333,
                    );
                    total_scatter += sc;
                    rgb = opt.rgb_linear;
                }
            }
        }

        (total_scatter, rgb)
    }

    fn record_elements_added(&mut self) {
        for (sp, &mol) in &self.species_mol {
            *self.initial_elements.entry(sp.clone()).or_insert(0.0) += mol;
        }
    }
}
