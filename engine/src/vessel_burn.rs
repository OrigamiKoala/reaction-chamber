//! Combustion in a vessel: ignition, the burning pool, the products (Stage 8, item 8). The model is
//! `transfer::combustion`; this file gathers the fuel data from the species store and the vessel state and applies the
//! result.

use crate::db::seed::{CARBON_DIOXIDE_GAS, NITROGEN_GAS, OXYGEN_GAS, WATER_VAPOUR};
use std::collections::HashMap;

use crate::chem_db;
use crate::physics::R_GAS;
use crate::thermo::functions::get_thermo_state;
use crate::transfer::combustion::{self as comb, FuelData, ProductCp};
use crate::vessel::*;

struct Fuel {
    id: String,
    mol: f64,
    data: FuelData,
    /// Saturation pressure at the liquid temperature, Pa.
    psat_pa: f64,
}

impl Vessel {
    /// Mole fraction of oxygen in the oxidiser the flame sees: the headspace of a sealed vessel, the atmosphere of an
    /// open one.
    pub(crate) fn oxidiser_o2_fraction(&self) -> f64 {
        if self.sealed {
            let total: f64 = self.headspace_gas_mol.values().sum();
            if total > 1e-15 {
                self.headspace_gas_mol.get(OXYGEN_GAS).copied().unwrap_or(0.0) / total
            } else {
                0.0
            }
        } else {
            self.atmosphere.composition.iter().find(|(k, _)| k.trim_end_matches("(g)") == OXYGEN_GAS.trim_end_matches("(g)")).map(|(_, v)| *v).unwrap_or(0.0)
        }
    }

    /// Fuel data of a liquid species from its formula, enthalpies of formation, vapour-pressure curve and structure; None
    /// when the species is not a CHON fuel or has no vapour-pressure model.
    fn fuel_data_for(&self, sp: &str) -> Option<FuelData> {
        let el = crate::ions::species_elements(sp)?;
        if el.get("C").copied().unwrap_or(0.0) <= 0.0 || el.get("H").copied().unwrap_or(0.0) <= 0.0 {
            return None;
        }
        let vol = self.volatile_for(sp)?;
        let t0 = 298.15;
        let p = crate::vle::P_BAR_PA;
        let mw = chem_db::get_species_thermo(sp).mw;
        let dfh_fuel = self
            .compound_for(sp)
            .and_then(|c| c.dhf_kj_mol)
            .map(|v| v * 1e3)
            .unwrap_or_else(|| get_thermo_state(sp, "l", t0, p).h_j_mol);
        let dfh_co2 = get_thermo_state(CARBON_DIOXIDE_GAS, "g", t0, p).h_j_mol;
        let dfh_h2o = get_thermo_state(WATER_VAPOUR, "g", t0, p).h_j_mol;
        let dh_c = comb::heat_of_combustion_j_mol(&el, dfh_fuel, dfh_co2, dfh_h2o)?;
        if dh_c <= 0.0 {
            return None;
        }
        let t_boil = vol.psat.t_sat(self.p_ext_pa().max(1000.0));
        let smiles = self
            .compound_for(sp)
            .and_then(|c| c.smiles.clone())
            .or_else(|| crate::db::SpeciesStore::global().read().ok().and_then(|st| st.get(sp).and_then(|r| r.identity.smiles.clone())));
        let soot = smiles.as_deref().and_then(comb::soot_structure_from_smiles).unwrap_or_else(|| comb::soot_structure_from_formula(&el));
        Some(FuelData {
            molar_mass_g_mol: mw,
            elements: el,
            dh_c_j_mol: dh_c,
            dh_vap_j_mol: vol.latent_heat_j_mol(t_boil),
            t_boil_k: t_boil,
            cp_liquid_j_mol_k: self.species_cp_j_g_k(sp) * mw,
            soot,
        })
    }

    fn fuels(&self) -> Vec<Fuel> {
        let t = self.temperature_k;
        let mut keys: Vec<String> = self.liquid_totals().keys().cloned().collect();
        keys.sort();
        let mut out = Vec::new();
        for sp in keys {
            let mol = self.liquid_total(&sp);
            if mol <= 1e-9 {
                continue;
            }
            if let Some(data) = self.fuel_data_for(&sp) {
                let psat = self.volatile_for(&sp).map(|v| v.psat_pa(t)).unwrap_or(0.0);
                out.push(Fuel { id: sp, mol, data, psat_pa: psat });
            }
        }
        out
    }

    /// Ignition, burning and extinction of the fuels present. Returns the heat delivered to the liquid (J).
    pub(crate) fn step_combustion(&mut self, dt_s: f64) -> f64 {
        let igniter = self.controls.igniter.unwrap_or(false);
        if !igniter && !self.flame_active {
            return 0.0;
        }
        let y_o2 = self.oxidiser_o2_fraction();
        let t = self.temperature_k;
        let p_total = if self.sealed { self.pressure_atm * crate::vle::P_BAR_PA * 1.01325 } else { self.p_ext_pa() };
        let fuels = self.fuels();

        // Le Chatelier's mixing rule on the flammability of the vapour above the liquid; the limiting oxygen of the
        // vapour-weighted fuels
        let total_liq: f64 = self.liquid_totals().values().sum::<f64>().max(1e-12);
        let mut le_chatelier = 0.0;
        let mut loc = 0.0;
        let mut vap_weight = 0.0;
        for f in &fuels {
            let x = f.mol / total_liq;
            let y = x * f.psat_pa / p_total.max(1.0);
            le_chatelier += y / comb::lower_flammability_limit(&f.data);
            loc += y * comb::limiting_oxygen_concentration(&f.data);
            vap_weight += y;
        }
        let loc = if vap_weight > 0.0 { loc / vap_weight } else { comb::FALLBACK_LOC };
        let fuel_mol: f64 = fuels.iter().map(|f| f.mol).sum();

        if self.flame_active && (y_o2 < loc || fuel_mol <= 1e-9) {
            self.flame_active = false;
            self.flame_power_w = 0.0;
            self.flame_visual = None;
            let why = if fuel_mol <= 1e-9 { "Combustion fuel exhausted" } else { "Flame extinguished: oxygen starved" };
            self.push_event(VesselEventKind::FlameOut, why.to_string(), 0.3);
            return 0.0;
        }
        if !self.flame_active {
            if igniter && le_chatelier >= 1.0 && y_o2 >= loc && fuel_mol > 1e-9 {
                self.flame_active = true;
                self.push_event(VesselEventKind::Ignition, "Flammable vapour ignited".to_string(), 0.6);
            } else {
                return 0.0;
            }
        }
        if fuels.is_empty() {
            return 0.0;
        }

        // burning rate: each fuel as a pool of the vessel's cross-section, weighted by its share of the vapour
        let pool_d = 2.0 * self.config.inner_radius_cm * 1e-2;
        let area = std::f64::consts::PI * (pool_d / 2.0).powi(2);
        let cp_co2 = get_thermo_state(CARBON_DIOXIDE_GAS, "g", 298.15, 1e5).cp_j_mol_k;
        let cp = ProductCp { co2: cp_co2, h2o: get_thermo_state(WATER_VAPOUR, "g", 298.15, 1e5).cp_j_mol_k, n2: get_thermo_state(NITROGEN_GAS, "g", 298.15, 1e5).cp_j_mol_k };
        let share_den: f64 = fuels.iter().map(|f| (f.mol / total_liq) * f.psat_pa).sum::<f64>().max(1e-30);
        let mut q_liquid = 0.0;
        let mut power = 0.0;
        let mut lead: Option<(f64, usize)> = None;
        let mut burn: Vec<(String, f64)> = Vec::new();
        for (k, f) in fuels.iter().enumerate() {
            let share = (f.mol / total_liq) * f.psat_pa / share_den;
            let t_flame = comb::adiabatic_flame_temperature_k(&f.data, y_o2, t, cp);
            let flux = comb::pool_burning_flux_kg_m2_s(&f.data, pool_d, t, self.room_k, y_o2, t_flame);
            let mol_s = share * flux * area / (f.data.molar_mass_g_mol * 1e-3);
            let n = (mol_s * dt_s).min(f.mol);
            if n <= 0.0 {
                continue;
            }
            power += mol_s * f.data.dh_c_j_mol;
            q_liquid += n * f.data.cp_liquid_j_mol_k * (f.data.t_boil_k - t).max(0.0);
            if lead.map_or(true, |(s, _)| share > s) {
                lead = Some((share, k));
            }
            burn.push((f.id.clone(), n));
        }
        let mut products: HashMap<String, f64> = HashMap::new();
        let mut o2_used = 0.0;
        for (id, n) in &burn {
            let f = fuels.iter().find(|f| &f.id == id).unwrap();
            let left = self.liquid_total(id) - n;
            self.set_liquid_total(id, left.max(0.0));
            self.ledger.book_out(id, *n);
            let c = f.data.elements.get("C").copied().unwrap_or(0.0);
            let h = f.data.elements.get("H").copied().unwrap_or(0.0);
            let nn = f.data.elements.get("N").copied().unwrap_or(0.0);
            *products.entry(CARBON_DIOXIDE_GAS.to_string()).or_default() += c * n;
            *products.entry(WATER_VAPOUR.to_string()).or_default() += 0.5 * h * n;
            *products.entry(NITROGEN_GAS.to_string()).or_default() += 0.5 * nn * n;
            o2_used += f.data.o2_stoich() * n;
        }
        if self.sealed {
            let have = self.headspace_gas_mol.get(OXYGEN_GAS).copied().unwrap_or(0.0);
            let used = o2_used.min(have);
            if used > 0.0 {
                *self.headspace_gas_mol.entry(OXYGEN_GAS.to_string()).or_default() -= used;
                self.ledger.book_out(OXYGEN_GAS, used);
            }
            for (g, n) in products {
                if n > 0.0 {
                    *self.headspace_gas_mol.entry(g.clone()).or_default() += n;
                    self.ledger.book_in(&g, n);
                }
            }
        } else {
            for (id, n) in &burn {
                if let Some(f) = fuels.iter().find(|f| &f.id == id) {
                    self.mass_lost_g += n * f.data.molar_mass_g_mol;
                }
            }
        }
        self.flame_power_w = power;
        if let Some((_, k)) = lead {
            let f = &fuels[k];
            let t_flame = comb::adiabatic_flame_temperature_k(&f.data, y_o2, t, cp);
            let app = comb::flame_appearance(&f.data, t_flame);
            self.flame_visual = Some(FlameVisual {
                fuel: self.display_name(&f.id),
                power_w: power,
                luminosity: app.luminosity,
                flame_temp_k: t_flame,
                emitter_rgb: Some(app.emitter_rgb),
            });
        }
        let _ = R_GAS;
        q_liquid
    }
}
