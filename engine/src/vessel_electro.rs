//! Electrode reactions in a vessel: the corrosion and cementation of conducting solids (open-circuit mixed potential)
//! and the electrolysis cell of a supply with two electrodes. The models are in `transfer::electrochem`.
//!
//! The half-reactions come from the species the vessel actually holds (plus the electrode materials), their standard
//! potentials from the species store's chemical potentials; the vessel applies the Faraday stoichiometry of each reaction
//! to its species, solids and gases, so elements and charge are conserved by construction.

use crate::db::seed::{HYDROXIDE, WATER};
use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::chem_db;
use crate::compound_thermo::is_metal_element;
use crate::transfer::diffusion::species_diffusivity_water_m2_s;
use crate::transfer::electrochem::{self as ec, ChannelFlow, Electrode, ElectroCtx, HalfReaction, SupplyMode};
use crate::vessel::*;

/// Diameter (m) of the particles a metal deposits as when it is reduced out of solution onto a surface (a powdery to
/// finely crystalline deposit).
const DEPOSIT_DIAMETER_M: f64 = 10e-6;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ElectrodeSpec {
    /// Element symbol (or species id) of the electrode material, e.g. "C", "Pt", "Cu".
    pub material: String,
    /// Immersed area, cm2.
    pub area_cm2: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ElectrolysisSpec {
    pub anode: ElectrodeSpec,
    pub cathode: ElectrodeSpec,
    #[serde(flatten)]
    pub supply: SupplyMode,
    /// Distance between the electrodes, cm.
    #[serde(default = "default_spacing")]
    pub spacing_cm: f64,
    /// The supply output is on.
    #[serde(default)]
    pub on: bool,
}

fn default_spacing() -> f64 {
    2.0
}

/// One line of the electrode reaction table the readout shows.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ElectrodeReactionRow {
    pub electrode: String,
    pub equation: String,
    pub current_a: f64,
    /// Share of the electrode's current this reaction carries (0..1).
    pub faradaic_fraction: f64,
    pub e0_v: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ElectrodeVisual {
    pub material: String,
    pub mass_change_g: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deposit: Option<SolidVisual>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ElectroReadout {
    pub current_a: f64,
    pub cell_voltage_v: f64,
    pub anode_potential_v: f64,
    pub cathode_potential_v: f64,
    pub ohmic_drop_v: f64,
    pub resistance_ohm: f64,
    pub charge_c: f64,
    pub rows: Vec<ElectrodeReactionRow>,
    #[serde(default)]
    pub electrodes: Vec<ElectrodeVisual>,
}

#[derive(Clone, Debug, Default)]
pub struct ElectroState {
    pub spec: Option<ElectrolysisSpec>,
    pub readout: Option<ElectroReadout>,
    pub charge_c: f64,
    pub anode_mass_change_g: f64,
    pub cathode_mass_change_g: f64,
    pub cathode_deposit_mol: HashMap<String, f64>,
    /// Moles of each solid the electrodes took up (+) or gave up (-): plating and electrode dissolution.
    pub electrode_exchange_mol: HashMap<String, f64>,
    /// Open-circuit mixed potential of the conducting solids (V vs SHE), when there are any.
    pub mixed_potential_v: Option<f64>,
    pub(crate) halves: Vec<HalfReaction>,
    pub(crate) halves_key: String,
}

/// Element symbol of an electrode material given as "Cu", "Cu(s)" or "graphite"-like text (the web sends symbols).
fn material_element(material: &str) -> String {
    material.trim().trim_end_matches("(s)").to_string()
}

impl Vessel {
    pub fn set_electrolysis(&mut self, spec: Option<ElectrolysisSpec>) {
        if spec.is_none() {
            self.electro.readout = None;
            self.electro.anode_mass_change_g = 0.0;
            self.electro.cathode_mass_change_g = 0.0;
            self.electro.cathode_deposit_mol.clear();
        }
        self.electro.spec = spec;
    }

    fn half_reactions_for(&mut self, present: &[String], extra: &[String]) -> Vec<HalfReaction> {
        let mut elements: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
        for sp in present {
            if let Some(m) = crate::ions::species_elements(sp) {
                elements.extend(m.into_keys());
            }
        }
        elements.extend(extra.iter().cloned());
        elements.insert("H".to_string());
        elements.insert("O".to_string());
        let temp_band = (self.temperature_k / 5.0).round() as i64 * 5;
        let key = format!("{}:{}", elements.into_iter().collect::<Vec<_>>().join(","), temp_band);
        if self.electro.halves_key != key {
            self.electro.halves = ec::discover_half_reactions(present, extra, self.temperature_k);
            self.electro.halves_key = key;
        }
        self.electro.halves.clone()
    }

    /// Whether a stable oxide / hydroxide film passivates the metal `el` at the vessel's pH: a mineral of the metal with
    /// hydroxide that keeps the dissolved metal below 1 uM there.
    fn metal_is_passive(&self, el: &str, gamma: &HashMap<String, f64>) -> bool {
        let ph = self.current_ph();
        if !ph.is_finite() {
            return false;
        }
        // ln a(OH-) = -(pKw - pH) ln 10, with the pKw of the solvent at the vessel's temperature
        let a_oh_ln = -(self.pkw() - ph) * std::f64::consts::LN_10;
        for m in &self.minerals {
            if m.dissolved_products.is_empty() || !m.dissolved_products.contains_key(HYDROXIDE) {
                continue;
            }
            let cations: Vec<(&String, &f64)> = m.dissolved_products.iter().filter(|(i, _)| i.as_str() != HYDROXIDE).collect();
            if cations.len() != 1 {
                continue;
            }
            let (ion, &nu_m) = cations[0];
            let has_el = crate::ions::species_elements(ion).map_or(false, |e| e.contains_key(el));
            if !has_el {
                continue;
            }
            let nu_oh = m.dissolved_products[HYDROXIDE];
            // ln a(M) = (ln Ksp - nu_oh ln a(OH-)) / nu_m
            let ln_ksp = m.log_ksp_at(self.temperature_k) * std::f64::consts::LN_10;
            let ln_a_m = (ln_ksp - nu_oh * a_oh_ln) / nu_m;
            let _ = gamma;
            if ln_a_m.exp() < 1e-6 {
                return true;
            }
        }
        false
    }

    /// Runs the electrode reactions of the vessel for `dt_s`; returns the heat released into the solution (J).
    pub(crate) fn step_electrochemistry(&mut self, dt_s: f64) -> f64 {
        if dt_s <= 0.0 || !self.has_aqueous_phase() {
            return 0.0;
        }
        let vol_l = self.solvent_volume_ml() / 1000.0;
        if vol_l <= 1e-9 {
            return 0.0;
        }
        let powered = self.electro.spec.as_ref().map_or(false, |s| s.on);
        let mut metals: Vec<String> = self
            .solid_mol
            .iter()
            .filter(|(sp, m)| **m > 1e-12 && is_conducting_solid(sp))
            .map(|(sp, _)| sp.clone())
            .collect();
        // (hash order must never decide the electrode or half-reaction order)
        metals.sort();
        if !powered && metals.is_empty() && self.electro.spec.is_none() {
            self.electro.mixed_potential_v = None;
            self.electro.readout = None;
            return 0.0;
        }

        let t_k = self.temperature_k;
        let p_pa = self.pressure_atm * 101_325.0;
        let (gamma, _aw) = crate::activity::batch_aqueous_gamma_and_aw(&self.species_mol, t_k);
        let hyd = self.hydro_state();
        // species present in the vessel
        // (a species without formation data, an ion pair or a generated complex, has no E0 and takes no part)
        let mut present: Vec<String> = self
            .species_mol
            .iter()
            .filter(|(sp, m)| **m > 1e-15 && crate::thermo::functions::has_thermo_data(sp, crate::thermo::functions::phase_of_id(sp)))
            .map(|(k, _)| k.clone())
            .collect();
        present.extend(self.solid_mol.iter().filter(|(_, m)| **m > 1e-15).map(|(k, _)| k.clone()));
        present.sort();
        let mut extra: Vec<String> = metals.iter().map(|m| m.trim_end_matches("(s)").to_string()).collect();
        if let Some(spec) = &self.electro.spec {
            for e in [&spec.anode, &spec.cathode] {
                let el = material_element(&e.material);
                if is_metal_element(&el) {
                    extra.push(el);
                }
            }
        }
        extra.sort();
        extra.dedup();
        let halves = self.half_reactions_for(&present, &extra);
        if halves.is_empty() {
            return 0.0;
        }

        let species_mol = self.species_mol.clone();
        let solid_mol = self.solid_mol.clone();
        let activity = |sp: &str| -> f64 {
            if sp.ends_with("(s)") || sp.ends_with("(g)") || sp == WATER {
                return 1.0;
            }
            let n = species_mol.get(sp).copied().unwrap_or(0.0);
            if n <= 0.0 {
                return 0.0;
            }
            (n / vol_l) * gamma.get(sp).copied().unwrap_or(0.0).exp()
        };
        let conc = |sp: &str| -> f64 {
            if sp.ends_with("(s)") || sp.ends_with("(g)") || sp == WATER {
                return f64::INFINITY;
            }
            species_mol.get(sp).copied().unwrap_or(0.0) / vol_l * 1000.0
        };
        let available = |sp: &str| solid_mol.get(sp).copied().unwrap_or(0.0) > 1e-12;
        let mut q_total = 0.0;

        // ------------------------------------------------------------------ open circuit: the conducting solids
        if !metals.is_empty() {
            let mut electrodes: Vec<Electrode> = Vec::new();
            let mut d_sum = 0.0;
            let mut a_sum = 0.0;
            for sp in &metals {
                let pop = self.particle_populations.get(sp).cloned().unwrap_or_default();
                let area = pop.surface_area_m2();
                if area <= 0.0 {
                    continue;
                }
                let el = sp.trim_end_matches("(s)").to_string();
                d_sum += pop.sauter_diameter_m() * area;
                a_sum += area;
                let passive = self.metal_is_passive(&el, &gamma);
                electrodes.push(Electrode { id: sp.clone(), element: el, area_m2: area, active_species: Some(sp.clone()), passive });
            }
            if !electrodes.is_empty() {
                let d_mean = d_sum / a_sum.max(1e-30);
                let km = |sp: &str| -> f64 {
                    let diff = species_diffusivity_water_m2_s(sp, t_k);
                    crate::transfer::hydro::particle_mass_transfer(d_mean, diff, 7000.0, hyd.rho_l, hyd.eta, &hyd.st, hyd.eps)
                };
                let solid_amount = |sp: &str, _el: &Electrode| -> f64 { solid_mol.get(sp).copied().unwrap_or(0.0) };
                let total_area: f64 = electrodes.iter().map(|e| e.area_m2).sum();
                let ctx = ElectroCtx { t_k, p_pa, activity: &activity, conc_mol_m3: &conc, k_m: &km, available: &available, solid_mol: &solid_amount, dt_s, total_area_m2: total_area };
                let refs: Vec<&Electrode> = electrodes.iter().collect();
                let (e_mix, flows) = ec::solve_mixed_potential(&refs, &halves, &ctx);
                
                self.electro.mixed_potential_v = Some(e_mix);
                q_total += self.apply_flows(&halves, &electrodes, &flows, None, dt_s, 0.0, &ctx, false);
            }
        } else {
            self.electro.mixed_potential_v = None;
        }

        // ------------------------------------------------------------------------- the electrolysis cell
        if powered {
            q_total += self.step_electrolysis_cell(&halves, &gamma, &hyd, &activity, &conc, &available, dt_s, vol_l);
        } else if self.electro.spec.is_some() {
            self.update_open_circuit_cell(&halves, &gamma, &hyd, &activity, &conc, &available, dt_s, vol_l);
        }
        q_total
    }

    #[allow(clippy::too_many_arguments)]
    fn step_electrolysis_cell(
        &mut self,
        halves: &[HalfReaction],
        gamma: &HashMap<String, f64>,
        hyd: &crate::vessel_transfer::Hydro,
        activity: &dyn Fn(&str) -> f64,
        conc: &dyn Fn(&str) -> f64,
        available: &dyn Fn(&str) -> bool,
        dt_s: f64,
        vol_l: f64,
    ) -> f64 {
        let spec = match self.electro.spec.clone() {
            Some(s) => s,
            None => return 0.0,
        };
        let t_k = self.temperature_k;
        let p_pa = self.pressure_atm * 101_325.0;
        let mk = |e: &ElectrodeSpec| -> Electrode {
            let el = material_element(&e.material);
            let active = if is_metal_element(&el) && crate::db::SpeciesStore::global().read().map_or(false, |s| s.get(&format!("{}(s)", el)).is_some()) {
                Some(format!("{}(s)", el))
            } else {
                None
            };
            let passive = active.is_some() && self.metal_is_passive(&el, gamma);
            Electrode { id: e.material.clone(), element: el, area_m2: (e.area_cm2 * 1e-4).max(1e-8), active_species: active, passive }
        };
        let anode = mk(&spec.anode);
        let cathode = mk(&spec.cathode);
        // flat electrode in a (possibly stirred) liquid: natural-convection diffusion layer or small-eddy renewal
        let km = |sp: &str| -> f64 {
            let d = species_diffusivity_water_m2_s(sp, t_k);
            let sc = hyd.nu / d.max(1e-14);
            let k_nc = d / 3.0e-4;
            let k_eddy = if hyd.eps > 0.0 { 0.4 * (hyd.eps * hyd.nu).powf(0.25) / sc.sqrt() } else { 0.0 };
            k_nc.max(k_eddy)
        };
        // a macroscopic electrode's own material is inexhaustible; other solids are limited to what the vessel holds
        let solid_map = self.solid_mol.clone();
        let solid_amount = |sp: &str, el: &Electrode| -> f64 { if el.active_species.as_deref() == Some(sp) { f64::INFINITY } else { solid_map.get(sp).copied().unwrap_or(0.0) } };
        let ctx = ElectroCtx { t_k, p_pa, activity, conc_mol_m3: conc, k_m: &km, available, solid_mol: &solid_amount, dt_s, total_area_m2: anode.area_m2 + cathode.area_m2 };
        // solution resistance
        let ions: Vec<(String, f64)> = self
            .species_mol
            .iter()
            .filter(|(sp, m)| **m > 0.0 && crate::ions::species_charge(sp) != 0)
            .map(|(sp, m)| (sp.clone(), m / vol_l * 1000.0))
            .collect();
        let kappa = ec::solution_conductivity_s_m(&ions, self.ionic_strength_molal(), t_k).max(1e-6);
        let a_eff = anode.area_m2.min(cathode.area_m2);
        let resistance = (spec.spacing_cm * 1e-2) / (kappa * a_eff);
        let res = ec::solve_electrolysis(&anode, &cathode, halves, &ctx, resistance, spec.supply);
        let dq = res.current_a * dt_s;
        self.electro.charge_c += dq;

        // apply the two electrodes' flows (the electrodes themselves are not in the vessel: their solids are tracked apart)
        let electrodes = [anode.clone(), cathode.clone()];
        let mut flows: Vec<ChannelFlow> = Vec::new();
        for f in &res.anode_flows {
            flows.push(ChannelFlow { electrode: 0, ..f.clone() });
        }
        for f in &res.cathode_flows {
            flows.push(ChannelFlow { electrode: 1, ..f.clone() });
        }
        let electrical_j = res.current_a * res.cell_voltage_v * dt_s;
        let mut q = self.apply_flows(halves, &electrodes, &flows, Some(&spec), dt_s, electrical_j, &ctx, true);

        // readout
        let mut rows: Vec<ElectrodeReactionRow> = Vec::new();
        for (role, fl) in [("anode", &res.anode_flows), ("cathode", &res.cathode_flows)] {
            let total: f64 = fl.iter().map(|f| f.net_oxidation_a.abs()).sum::<f64>().max(1e-30);
            for f in fl.iter() {
                if f.net_oxidation_a.abs() < 1e-3 * total {
                    continue;
                }
                let h = &halves[f.half];
                // anode rows read in the oxidation direction
                let eq = if f.net_oxidation_a > 0.0 { reverse_equation(h) } else { h.equation() };
                rows.push(ElectrodeReactionRow { electrode: role.to_string(), equation: eq, current_a: f.net_oxidation_a.abs(), faradaic_fraction: f.net_oxidation_a.abs() / total, e0_v: h.e0(t_k, p_pa) });
            }
        }
        let electrodes_vis = self.build_electrode_visuals(&spec);
        self.electro.readout = Some(ElectroReadout {
            current_a: res.current_a,
            cell_voltage_v: res.cell_voltage_v,
            anode_potential_v: res.anode_potential_v,
            cathode_potential_v: res.cathode_potential_v,
            ohmic_drop_v: res.ohmic_drop_v,
            resistance_ohm: resistance,
            charge_c: self.electro.charge_c,
            rows,
            electrodes: electrodes_vis,
        });
        let _ = &mut q;
        q
    }

    fn build_electrode_visuals(&self, spec: &ElectrolysisSpec) -> Vec<ElectrodeVisual> {
        let anode_vis = ElectrodeVisual {
            material: spec.anode.material.clone(),
            mass_change_g: self.electro.anode_mass_change_g,
            deposit: None,
        };
        let deposit = self
            .electro
            .cathode_deposit_mol
            .iter()
            .filter(|(_, &m)| m > 1e-9)
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(sp, &mol)| {
                let props = self.solid_props(sp);
                let mw = chem_db::get_species_thermo(sp).mw;
                let mass_g = mol * mw;
                let density = props.density_g_ml;
                let volume_ml = if density > 1e-9 { mass_g / density } else { 0.0 };
                SolidVisual {
                    species: sp.clone(),
                    name: props.name.clone(),
                    mass_g,
                    density_g_ml: density,
                    volume_ml,
                    settled_volume_ml: volume_ml,
                    morphology: "film".to_string(),
                    suspended_fraction: 0.0,
                    particle_diameter_um: DEPOSIT_DIAMETER_M * 1e6,
                    suspended_diameter_um: 0.0,
                    particle_sigma_g: 1.0,
                    rgb: props.rgb,
                    colour_tier: props.colour_tier,
                    colour_source: props.colour_source,
                    kind: props.kind,
                    floating: None,
                    layer_index: None,
                    remaining_fraction: Some(1.0),
                    settling_velocity_mm_s: 0.0,
                    surface_area_cm2: spec.cathode.area_cm2,
                }
            });
        let cathode_vis = ElectrodeVisual {
            material: spec.cathode.material.clone(),
            mass_change_g: self.electro.cathode_mass_change_g,
            deposit,
        };
        vec![anode_vis, cathode_vis]
    }

    #[allow(clippy::too_many_arguments)]
    fn update_open_circuit_cell(
        &mut self,
        halves: &[HalfReaction],
        gamma: &HashMap<String, f64>,
        hyd: &crate::vessel_transfer::Hydro,
        activity: &dyn Fn(&str) -> f64,
        conc: &dyn Fn(&str) -> f64,
        available: &dyn Fn(&str) -> bool,
        dt_s: f64,
        vol_l: f64,
    ) {
        let spec = match self.electro.spec.clone() {
            Some(s) => s,
            None => return,
        };
        let t_k = self.temperature_k;
        let p_pa = self.pressure_atm * 101_325.0;
        let mk = |e: &ElectrodeSpec| -> Electrode {
            let el = material_element(&e.material);
            let active = if is_metal_element(&el) && crate::db::SpeciesStore::global().read().map_or(false, |s| s.get(&format!("{}(s)", el)).is_some()) {
                Some(format!("{}(s)", el))
            } else {
                None
            };
            let passive = active.is_some() && self.metal_is_passive(&el, gamma);
            Electrode { id: e.material.clone(), element: el, area_m2: (e.area_cm2 * 1e-4).max(1e-8), active_species: active, passive }
        };
        let anode = mk(&spec.anode);
        let cathode = mk(&spec.cathode);
        let km = |sp: &str| -> f64 {
            let d = species_diffusivity_water_m2_s(sp, t_k);
            let sc = hyd.nu / d.max(1e-14);
            let k_nc = d / 3.0e-4;
            let k_eddy = if hyd.eps > 0.0 { 0.4 * (hyd.eps * hyd.nu).powf(0.25) / sc.sqrt() } else { 0.0 };
            k_nc.max(k_eddy)
        };
        let solid_map = self.solid_mol.clone();
        let solid_amount = |sp: &str, el: &Electrode| -> f64 { if el.active_species.as_deref() == Some(sp) { f64::INFINITY } else { solid_map.get(sp).copied().unwrap_or(0.0) } };
        let ctx = ElectroCtx { t_k, p_pa, activity, conc_mol_m3: conc, k_m: &km, available, solid_mol: &solid_amount, dt_s, total_area_m2: anode.area_m2 + cathode.area_m2 };
        let ions: Vec<(String, f64)> = self
            .species_mol
            .iter()
            .filter(|(sp, m)| **m > 0.0 && crate::ions::species_charge(sp) != 0)
            .map(|(sp, m)| (sp.clone(), m / vol_l * 1000.0))
            .collect();
        let kappa = ec::solution_conductivity_s_m(&ions, self.ionic_strength_molal(), t_k).max(1e-6);
        let a_eff = anode.area_m2.min(cathode.area_m2);
        let resistance = (spec.spacing_cm * 1e-2) / (kappa * a_eff);

        let a_ref = [&anode];
        let c_ref = [&cathode];
        let ea = ec::potential_for_current(&a_ref, halves, &ctx, 0.0);
        let ec = ec::potential_for_current(&c_ref, halves, &ctx, 0.0);
        // a voltmeter reads the signed potential of the cathode lead against the anode lead: a cell wired the other way
        // round reads negative
        let cell_v = ec - ea;

        let mut rows: Vec<ElectrodeReactionRow> = Vec::new();
        for (role, el) in [("anode", &anode), ("cathode", &cathode)] {
            for h in halves.iter() {
                let e0 = h.e0(t_k, p_pa);
                let has_el = |s: &str| crate::ions::species_elements(s).map_or(false, |e| e.contains_key(&el.element));
                let matches_el = h.ox.iter().any(|(s, _)| has_el(s)) || h.red.iter().any(|(s, _)| has_el(s));
                let matches_water = h.ox.iter().any(|(s, _)| s == "H+" || s == "O2(g)") || h.red.iter().any(|(s, _)| s == "H2(g)" || s == "OH-");
                if matches_el || matches_water {
                    rows.push(ElectrodeReactionRow {
                        electrode: role.to_string(),
                        equation: if role == "anode" { reverse_equation(h) } else { h.equation() },
                        current_a: 0.0,
                        faradaic_fraction: 0.0,
                        e0_v: e0,
                    });
                }
            }
        }
        rows.truncate(6);

        let electrodes_vis = self.build_electrode_visuals(&spec);
        self.electro.readout = Some(ElectroReadout {
            current_a: 0.0,
            cell_voltage_v: cell_v,
            anode_potential_v: ea,
            cathode_potential_v: ec,
            ohmic_drop_v: 0.0,
            resistance_ohm: resistance,
            charge_c: self.electro.charge_c,
            rows,
            electrodes: electrodes_vis,
        });
    }

    /// Applies the Faraday stoichiometry of the channel flows over `dt_s`. `electrical_j` is the energy the supply put in
    /// (0 for open circuit). Returns the heat released into the solution.
    #[allow(clippy::too_many_arguments)]
    fn apply_flows(
        &mut self,
        halves: &[HalfReaction],
        electrodes: &[Electrode],
        flows: &[ChannelFlow],
        spec: Option<&ElectrolysisSpec>,
        dt_s: f64,
        electrical_j: f64,
        ctx: &ElectroCtx,
        is_cell: bool,
    ) -> f64 {
        // reduction extent rate of each half-reaction (mol/s, > 0 = net reduction)
        let mut xi: std::collections::BTreeMap<usize, f64> = std::collections::BTreeMap::new();
        for f in flows {
            let h = &halves[f.half];
            *xi.entry(f.half).or_default() += -f.net_oxidation_a / (h.n_e * crate::physics::FARADAY);
        }
        // electroneutrality: the electrons taken up by the reductions are exactly the electrons released by the oxidations
        // (the root finders that produced the flows stop within a tolerance; the side with the larger flux is trimmed to
        // the smaller so that no net charge is created in the solution)
        let (mut e_red, mut e_ox) = (0.0, 0.0);
        for (&hi, &rate) in &xi {
            let ne = halves[hi].n_e * rate;
            if ne > 0.0 {
                e_red += ne;
            } else {
                e_ox += -ne;
            }
        }
        if (e_red > 0.0) != (e_ox > 0.0) {
            // electrons have nowhere to come from (or go to): no current flows
            xi.values_mut().for_each(|r| *r = 0.0);
        } else if e_red > 0.0 && (e_red - e_ox).abs() > 0.0 {
            let (s_red, s_ox) = if e_red > e_ox { (e_ox / e_red, 1.0) } else { (1.0, e_red / e_ox) };
            for (&hi, rate) in xi.iter_mut() {
                *rate *= if *rate > 0.0 { s_red } else { s_ox };
                let _ = hi;
            }
        }
        // one common scale so that no reactant goes negative (and electrons stay balanced): the total demand on every
        // species, over all the half-reactions that consume it, against what the vessel holds
        let mut demand: std::collections::BTreeMap<String, (f64, usize)> = std::collections::BTreeMap::new();
        for (&hi, &rate) in &xi {
            let h = &halves[hi];
            let ext = rate * dt_s;
            if ext.abs() < 1e-30 {
                continue;
            }
            let consumed = if ext > 0.0 { &h.ox } else { &h.red };
            for (sp, c) in consumed {
                let e = demand.entry(sp.clone()).or_insert((0.0, hi));
                e.0 += c * ext.abs();
            }
        }
        let mut scale: f64 = 1.0;
        for (sp, (need, hi)) in &demand {
            let have = self.amount_for_electrode(sp, electrodes, flows, *hi, is_cell);
            if have.is_finite() && *need > have {
                scale = scale.min((have / need).max(0.0));
            }
        }
        let mut heat = 0.0;
        let mut dh_total = 0.0;
        let t_k = self.temperature_k;
        let p_pa = self.pressure_atm * 101_325.0;
        for (&hi, &rate) in &xi {
            let h = &halves[hi];
            let ext = rate * dt_s * scale;
            if ext.abs() < 1e-30 {
                continue;
            }
            self.eq_moved = true;
            for (sp, c) in &h.ox {
                self.apply_species_change(sp, -c * ext, hi, flows, electrodes, is_cell, dt_s);
            }
            for (sp, c) in &h.red {
                self.apply_species_change(sp, c * ext, hi, flows, electrodes, is_cell, dt_s);
            }
            dh_total += ext * h.delta_h0(t_k, p_pa);
            if ext.abs() / dt_s > 1e-12 {
                self.active_reactions.push(ReactionRow {
                    id: format!("electrode_{}", hi),
                    equation: if ext > 0.0 { h.equation() } else { reverse_equation(h) },
                    kind: if is_cell { "electrolysis".to_string() } else { "corrosion".to_string() },
                    rate: ext.abs() / dt_s,
                    log_q_over_k: None,
                    tier: crate::types::ProvenanceTier::Estimated,
                    source: "Butler-Volmer / species store E0".to_string(),
                    active: true,
                    role: None,
                });
            }
        }
        // energy: electrical work in, chemical enthalpy stored; the rest is heat in the solution
        heat += electrical_j - dh_total;
        let _ = (spec, ctx);
        heat
    }

    /// Amount (mol) of a reactant available to an electrode reaction; infinite for the solvent, for gases (only produced
    /// here) and for an electrode's own material.
    fn amount_for_electrode(&self, sp: &str, electrodes: &[Electrode], flows: &[ChannelFlow], half: usize, is_cell: bool) -> f64 {
        if sp == WATER {
            return f64::INFINITY;
        }
        if sp.ends_with("(g)") {
            return f64::INFINITY;
        }
        if sp.ends_with("(s)") {
            // the electrode's own material is a reservoir (a cell electrode is macroscopic)
            if is_cell {
                for f in flows.iter().filter(|f| f.half == half) {
                    if electrodes[f.electrode].active_species.as_deref() == Some(sp) {
                        return f64::INFINITY;
                    }
                }
            }
            return self.solid_mol.get(sp).copied().unwrap_or(0.0);
        }
        self.species_mol.get(sp).copied().unwrap_or(0.0)
    }

    #[allow(clippy::too_many_arguments)]
    fn apply_species_change(&mut self, sp: &str, d_mol: f64, half: usize, flows: &[ChannelFlow], electrodes: &[Electrode], is_cell: bool, dt_s: f64) {
        if d_mol == 0.0 {
            return;
        }
        if sp.ends_with("(s)") {
            // plating on (or dissolution of) an electrode of a cell stays on the electrode: its atoms leave / enter the vessel
            if is_cell {
                let own = flows.iter().any(|f| f.half == half && electrodes[f.electrode].active_species.as_deref() == Some(sp));
                if d_mol > 0.0 || own {
                    *self.electro.electrode_exchange_mol.entry(sp.to_string()).or_default() += d_mol;
                    let mw = chem_db::get_species_thermo(sp).mw;
                    let el_idx = flows.iter().find(|f| f.half == half).map(|f| f.electrode);
                    if el_idx == Some(0) {
                        self.electro.anode_mass_change_g += d_mol * mw;
                    } else if el_idx == Some(1) {
                        self.electro.cathode_mass_change_g += d_mol * mw;
                        if d_mol > 0.0 {
                            *self.electro.cathode_deposit_mol.entry(sp.to_string()).or_default() += d_mol;
                        }
                    }
                    if d_mol > 0.0 {
                        self.ledger.book_out(sp, d_mol);
                    } else {
                        self.ledger.book_in(sp, -d_mol);
                    }
                    return;
                }
            }
            if d_mol > 0.0 {
                self.add_solid_particles(sp, d_mol, Some(DEPOSIT_DIAMETER_M));
                *self.solid_mol.entry(sp.to_string()).or_default() += d_mol;
                *self.initial_solids.entry(sp.to_string()).or_default() += d_mol;
            } else {
                let m = self.solid_mol.entry(sp.to_string()).or_default();
                *m = (*m + d_mol).max(0.0);
            }
            return;
        }
        if sp.ends_with("(g)") {
            if d_mol > 0.0 {
                if self.sealed {
                    *self.headspace_gas_mol.entry(sp.to_string()).or_default() += d_mol;
                } else {
                    let ml_s = d_mol / dt_s * crate::physics::R_GAS * self.temperature_k / self.p_ext_pa().max(1.0) * 1e6;
                    if ml_s >= 1e-4 {
                        self.gas_fluxes.push(GasFlux {
                            species: sp.to_string(),
                            rate_ml_s: ml_s,
                            bubble_diameter_mm: self.bubble_diameter_mm("solid"),
                            nucleation: "solid".to_string(),
                            origin: None,
                        });
                    }
                    self.mass_lost_g += d_mol * chem_db::get_species_thermo(sp).mw;
                    self.ledger.book_out(sp, d_mol);
                    self.gas.escaped_mol += d_mol;
                }
            } else if self.sealed {
                let g = self.headspace_gas_mol.entry(sp.to_string()).or_default();
                *g = (*g + d_mol).max(0.0);
            }
            return;
        }
        let m = self.species_mol.entry(sp.to_string()).or_default();
        *m = (*m + d_mol).max(0.0);
    }

    /// The electrochemistry part of the snapshot.
    pub(crate) fn electrolysis_snapshot(&self) -> Option<ElectroReadout> {
        self.electro.readout.clone()
    }
}

pub(crate) fn is_conducting_solid(sp: &str) -> bool {
    let formula = sp.trim_end_matches("(s)");
    crate::ions::parse_formula_strict(formula).map_or(false, |e| e.len() == 1 && e.keys().all(|k| is_metal_element(k)))
}

fn reverse_equation(h: &HalfReaction) -> String {
    let side = |v: &Vec<(String, f64)>| -> String {
        v.iter().map(|(s, c)| if (*c - 1.0).abs() < 1e-9 { s.clone() } else { format!("{} {}", c.round(), s) }).collect::<Vec<_>>().join(" + ")
    };
    format!("{} -> {} + {} e-", side(&h.red), side(&h.ox), h.n_e.round())
}
