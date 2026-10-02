//! Phase behaviour of compounds without reaction chemistry ("inert" compounds: organics, oxides, elements, ...).
//!
//! Every inert compound has one conserved total amount per vessel, spread over up to four places, all derived from the
//! vessel state at run time:
//!   * `solid_mol["X(s)"]`   undissolved solid (below the melting point at the vessel pressure)
//!   * `species_mol["X(l)"]` neat liquid, an immiscible layer of its own (above the melting point)
//!   * `species_mol["X"]`    the part dissolved in the water of the vessel
//!   * gas                   above its boiling point (vapour pressure >= ambient pressure) the neat liquid boils off
//!                           (unsealed vessels, like water); undissolved excess of a compound that is a gas at the
//!                           vessel temperature is vented
//!
//! Melting / freezing and boiling clamp the temperature like the water boiling clamp: energy above (below) the
//! transition temperature is spent on the phase change, so heating a low-melting solid shows a plateau, then a liquid.
//!
//! Dissolution in water is instantaneous equilibrium capped by the compound's solubility (g/L of water volume, 0.1 g/L
//! when unknown). A liquid with solubility >= 500 g/L counts as miscible (dissolves completely). Solubility is not
//! temperature dependent and dissolution has no heat of solution. Dissolved compounds do not evaporate or boil off.

use std::collections::HashMap;

use crate::chem_db;
use crate::compound_thermo::*;
use crate::optics::{self, BIN_NM0, BIN_STEP_NM, N_BINS};
use crate::vessel::*;

const EPS_MOL: f64 = 1e-12;
const CP_WATER_J_G_K: f64 = 4.184;

// per-compound announcement flags (`EventState::phase`)
const F_MELTING: u8 = 1;
const F_MOLTEN: u8 = 2;
const F_FREEZING: u8 = 4;
const F_BOILING: u8 = 8;

fn bump(map: &mut HashMap<String, f64>, key: &str, d: f64) {
    let v = (map.get(key).copied().unwrap_or(0.0) + d).max(0.0);
    if v <= 1e-15 {
        map.remove(key);
    } else {
        map.insert(key.to_string(), v);
    }
}

fn base_id(sp: &str) -> &str {
    sp.strip_suffix("(s)").or_else(|| sp.strip_suffix("(l)")).or_else(|| sp.strip_suffix("(g)")).unwrap_or(sp)
}

/// Decadic absorbance per cm per bin whose 2 cm transmission approximates the linear colour `target`.
fn absorbance_for_colour(target: [f64; 3]) -> Vec<f64> {
    let path = 2.0;
    let share = |i: usize| -> [f64; 3] {
        let l = BIN_NM0 + i as f64 * BIN_STEP_NM;
        let w = [((l - 560.0) / 70.0).clamp(0.0, 1.0), (1.0 - (l - 545.0).abs() / 80.0).clamp(0.0, 1.0), ((510.0 - l) / 70.0).clamp(0.0, 1.0)];
        let s = (w[0] + w[1] + w[2]).max(1e-9);
        [w[0] / s, w[1] / s, w[2] / s]
    };
    let tgt = target.map(|x| x.clamp(0.02, 1.0));
    let mut a_ch = tgt.map(|t| -t.log10() / path);
    let mut bins = [0.0; N_BINS];
    for _ in 0..10 {
        for (i, b) in bins.iter_mut().enumerate() {
            let w = share(i);
            *b = w[0] * a_ch[0] + w[1] * a_ch[1] + w[2] * a_ch[2];
        }
        let got = optics::transmitted_linear_rgb(&bins, path);
        for c in 0..3 {
            a_ch[c] = (a_ch[c] + (got[c].max(1e-3).log10() - tgt[c].log10()) / path).clamp(0.0, 6.0);
        }
    }
    for (i, b) in bins.iter_mut().enumerate() {
        let w = share(i);
        *b = w[0] * a_ch[0] + w[1] * a_ch[1] + w[2] * a_ch[2];
    }
    bins.to_vec()
}

impl Vessel {
    pub fn register_compound(&mut self, c: CompoundThermo) {
        self.compounds.insert(c.species.clone(), c);
    }

    /// The inert compound a species id ("X", "X(s)", "X(l)") belongs to.
    pub fn inert_of(&self, sp: &str) -> Option<&CompoundThermo> {
        self.compounds.get(base_id(sp)).filter(|c| c.phase_model == "inert")
    }

    /// Name shown for a species row (the compound's name for inert compounds, else the id).
    pub(crate) fn display_name(&self, sp: &str) -> String {
        self.inert_of(sp).map(|c| c.name.clone()).filter(|n| !n.is_empty()).unwrap_or_else(|| sp.to_string())
    }

    fn ambient_atm(&self) -> f64 {
        if self.sealed { self.pressure_atm.max(0.05) } else { 1.0 }
    }

    /// (solid, neat liquid, dissolved) mol of an inert compound.
    pub(crate) fn inert_amounts(&self, c: &CompoundThermo) -> (f64, f64, f64) {
        let g = |m: &HashMap<String, f64>, k: String| m.get(&k).copied().unwrap_or(0.0);
        (
            g(&self.solid_mol, format!("{}(s)", c.species)),
            g(&self.species_mol, format!("{}(l)", c.species)),
            g(&self.species_mol, c.species.clone()),
        )
    }

    /// Inert compounds with any amount in the vessel.
    pub(crate) fn present_inert(&self) -> Vec<CompoundThermo> {
        self.compounds
            .values()
            .filter(|c| c.phase_model == "inert")
            .filter(|c| {
                let (s, l, d) = self.inert_amounts(c);
                s + l + d > EPS_MOL
            })
            .cloned()
            .collect()
    }

    /// Specific heat of a species in J/(g K): ethanol 2.44, solid minerals ~1.0, water 4.184.
    pub(crate) fn species_cp_j_g_k(&self, sp: &str) -> f64 {
        if sp == "H2O" {
            return CP_WATER_J_G_K;
        }
        if sp == "C2H5OH" || sp == "C2H5OH(l)" {
            return 2.44; // Ethanol liquid Cp = 2.44 J/(g K)
        }
        if let Some(c) = self.compounds.get(base_id(sp)) {
            if c.cp_j_g_k > 0.01 {
                return c.cp_j_g_k;
            }
        }
        if sp.ends_with("(s)") {
            return 1.0; // Solid crystals Cp ~ 0.8 - 1.2 J/(g K)
        }
        CP_WATER_J_G_K
    }

    /// Heat capacity of the contents (J/K).
    pub(crate) fn contents_heat_capacity(&self) -> f64 {
        let mut default_mass = 0.0;
        let mut own = 0.0;
        for map in [&self.species_mol, &self.solid_mol] {
            for (sp, &mol) in map {
                let mass = mol * chem_db::get_species_thermo(sp).mw;
                let cp = self.species_cp_j_g_k(sp);
                if cp == CP_WATER_J_G_K {
                    default_mass += mass;
                } else {
                    own += cp * mass;
                }
            }
        }
        CP_WATER_J_G_K * default_mass + own
    }

    /// Specific heat (J/(g K)) of what a reagent adds: the compound's neat value for inert solids/liquids.
    pub(crate) fn entry_cp_j_g_k(&self, entry: &chem_db::ReagentCatalogEntry) -> f64 {
        entry
            .composition
            .keys()
            .find(|k| (k.ends_with("(s)") || k.ends_with("(l)")) && self.inert_of(k).is_some())
            .map(|k| self.species_cp_j_g_k(k))
            .unwrap_or(CP_WATER_J_G_K)
    }

    // ------------------------------------------------------------------------------------------ neat liquids
    /// Neat liquid layers: (compound record if any, species id, mol, molar mass, density g/mL).
    fn neat_liquids(&self) -> Vec<(String, f64, f64, f64)> {
        let mut out = Vec::new();
        for (sp, &mol) in &self.species_mol {
            if mol > EPS_MOL && sp.ends_with("(l)") {
                let mw = chem_db::get_species_thermo(sp).mw;
                let rho = self.inert_of(sp).map(|c| c.rho_liquid).unwrap_or(1.0);
                out.push((sp.clone(), mol, mw, rho));
            }
        }
        out
    }

    pub fn neat_volume_ml(&self) -> f64 {
        self.neat_liquids().iter().map(|(_, mol, mw, rho)| mol * mw / rho).sum()
    }

    /// Mass (g) of the neat liquids.
    pub(crate) fn neat_mass_g(&self) -> f64 {
        self.neat_liquids().iter().map(|(_, mol, mw, _)| mol * mw).sum()
    }

    /// One `LiquidLayer` per neat liquid compound, with its own density and colour.
    pub(crate) fn neat_layers(&self) -> Vec<LiquidLayer> {
        let mut layers = Vec::new();
        for (sp, mol, mw, rho) in self.neat_liquids() {
            let vol = mol * mw / rho;
            if vol <= 0.01 {
                continue;
            }
            let c = self.inert_of(&sp);
            let absorb = c.and_then(|c| c.color_linear_rgb).map(absorbance_for_colour).unwrap_or_else(|| vec![0.0; N_BINS]);
            layers.push(LiquidLayer {
                phase: PhaseKind::Organic,
                volume_ml: vol,
                density_g_ml: rho,
                refractive_index: 1.45,
                absorbance_per_cm: absorb,
                scatter_per_cm: 0.0,
                scatter_rgb: [1.0, 1.0, 1.0],
                species: Some(sp.clone()),
                name: c.map(|c| c.name.clone()),
            });
        }
        layers
    }

    // ------------------------------------------------------------------------------------------ dissolution
    fn vent_gas(&mut self, c: &CompoundThermo, mol: f64, dt_s: f64) {
        if mol <= 0.0 {
            return;
        }
        let gas = format!("{}(g)", c.species);
        let p_atm = self.ambient_atm();
        if self.sealed {
            *self.headspace_gas_mol.entry(gas.clone()).or_default() += mol;
        } else {
            self.mass_lost_g += mol * c.mw;
            self.ledger.book_out(&c.species, mol);
        }
        let vol_ml = mol * R_GAS * self.temperature_k / (p_atm * P_ATM_PA) * 1e6;
        self.gas_fluxes.push(GasFlux { species: gas, rate_ml_s: vol_ml / dt_s.max(1e-6), bubble_diameter_mm: 2.0, nucleation: "bulk".into() });
    }

    /// Re-establishes the dissolution equilibrium of every inert compound (see the module comment).
    pub(crate) fn inert_dissolution(&mut self, dt_s: Option<f64>) {
        let t = self.temperature_k;
        let p_atm = self.ambient_atm();
        let water_mol = self.species_mol.get("H2O").copied().unwrap_or(0.0);
        let water_l = if water_mol > crate::vessel::MIN_AQUEOUS_H2O_MOL { water_mol * 0.018015 } else { 0.0 };
        for c in self.present_inert() {
            let (n_s, n_l, n_d) = self.inert_amounts(&c);
            let total = n_s + n_l + n_d;
            let phase = c.neat_phase(t, p_atm);
            let cap = if water_l <= 0.0 {
                0.0
            } else if c.is_miscible_liquid() && phase == NeatPhase::Liquid {
                f64::INFINITY
            } else {
                c.solubility_limit_g_per_l(t) * water_l / c.mw
            };
            let new_d = total.min(cap);
            let delta = new_d - n_d;
            if delta.abs() < 1e-15 {
                continue;
            }
            let (sid, lid) = (format!("{}(s)", c.species), format!("{}(l)", c.species));
            if delta > 0.0 {
                let neat = (n_s + n_l).max(1e-300);
                let from_s = (delta * n_s / neat).min(n_s);
                let from_l = (delta - from_s).min(n_l);
                bump(&mut self.solid_mol, &sid, -from_s);
                bump(&mut self.species_mol, &lid, -from_l);
                bump(&mut self.species_mol, &c.species, from_s + from_l);
            } else {
                let back = -delta;
                bump(&mut self.species_mol, &c.species, -back);
                match phase {
                    NeatPhase::Solid => bump(&mut self.solid_mol, &sid, back),
                    NeatPhase::Liquid => bump(&mut self.species_mol, &lid, back),
                    NeatPhase::Gas => self.vent_gas(&c, back, dt_s.unwrap_or(1.0)),
                }
            }
        }
    }

    // ------------------------------------------------------------------------------------------ melting / boiling
    fn phase_event(&mut self, c: &CompoundThermo, species: &str, text: String) {
        self.push_event_full(VesselEventKind::TemperatureChange, text, 0.5, Some(species.to_string()), c.color_linear_rgb);
    }

    /// Melt/freeze plateaus and boil-off of the neat phases. Called from `step_thermal` right after the temperature
    /// update, `cp_total` (J/K) being the heat capacity that update used.
    pub(crate) fn step_inert_thermal(&mut self, dt_s: f64, cp_total: f64) {
        let p_atm = self.ambient_atm();
        let compounds = self.present_inert();
        if compounds.is_empty() {
            return;
        }
        let mut boiled: HashMap<String, f64> = HashMap::new();
        for _pass in 0..6 {
            let mut changed = false;
            for c in &compounds {
                let (sid, lid) = (format!("{}(s)", c.species), format!("{}(l)", c.species));
                let (n_s, n_l, _) = self.inert_amounts(c);
                let tc_c = |k: f64| k - 273.15;
                // ---- melting / freezing
                if let (Some(tm), Some(dh_fus)) = (c.melt_k(p_atm), c.dh_fus_kj_mol.map(|d| d * 1000.0)) {
                    let t = self.temperature_k;
                    if t > tm + 1e-9 && n_s > EPS_MOL {
                        let excess_j = (t - tm) * cp_total;
                        let melt = (excess_j / dh_fus).min(n_s);
                        bump(&mut self.solid_mol, &sid, -melt);
                        bump(&mut self.species_mol, &lid, melt);
                        self.temperature_k = tm + (excess_j - melt * dh_fus) / cp_total;
                        changed = true;
                        let flags = self.ev.phase.entry(c.species.clone()).or_insert(0);
                        let first = *flags & F_MELTING == 0;
                        *flags = (*flags | F_MELTING) & !(F_FREEZING);
                        if first {
                            self.phase_event(c, &sid, format!("{} melting at {:.1} °C", c.name, tc_c(tm)));
                        }
                        if n_s - melt <= EPS_MOL {
                            self.ev.solids.remove(&sid);
                            self.ev.susp.remove(&sid);
                            let flags = self.ev.phase.entry(c.species.clone()).or_insert(0);
                            if *flags & F_MOLTEN == 0 {
                                *flags |= F_MOLTEN;
                                self.phase_event(c, &lid, format!("{} melted", c.name));
                            }
                        }
                    } else if t < tm - 1e-9 && n_l > EPS_MOL {
                        let deficit_j = (tm - t) * cp_total;
                        let freeze = (deficit_j / dh_fus).min(n_l);
                        bump(&mut self.species_mol, &lid, -freeze);
                        bump(&mut self.solid_mol, &sid, freeze);
                        self.ev.solids.insert(sid.clone());
                        self.ev.susp.insert(sid.clone(), 0.02);
                        self.temperature_k = tm - (deficit_j - freeze * dh_fus) / cp_total;
                        changed = true;
                        let flags = self.ev.phase.entry(c.species.clone()).or_insert(0);
                        let first = *flags & F_FREEZING == 0;
                        *flags = (*flags | F_FREEZING) & !(F_MELTING | F_MOLTEN);
                        if first {
                            self.phase_event(c, &sid, format!("{} solidifying at {:.1} °C", c.name, tc_c(tm)));
                        }
                        if n_l - freeze <= EPS_MOL {
                            self.phase_event(c, &sid, format!("{} solidified", c.name));
                            self.ev.phase.entry(c.species.clone()).and_modify(|f| *f &= !F_FREEZING);
                        }
                    }
                }
                // ---- boiling (unsealed vessels only, like water)
                if !self.sealed {
                    let (_, n_l, _) = self.inert_amounts(c);
                    if let Some(tb) = c.boil_k(p_atm * P_ATM_PA) {
                        let t = self.temperature_k;
                        if t > tb + 1e-9 && n_l > EPS_MOL {
                            let excess_j = (t - tb) * cp_total;
                            let dh = c.dh_vap_at(tb).max(1000.0);
                            let boil = (excess_j / dh).min(n_l);
                            bump(&mut self.species_mol, &lid, -boil);
                            self.mass_lost_g += boil * c.mw;
                            self.ledger.book_out(&c.species, boil);
                            self.temperature_k = tb + (excess_j - boil * dh) / cp_total;
                            *boiled.entry(c.species.clone()).or_default() += boil;
                            changed = true;
                            let flags = self.ev.phase.entry(c.species.clone()).or_insert(0);
                            let first = *flags & F_BOILING == 0;
                            *flags |= F_BOILING;
                            if first {
                                self.phase_event(c, &lid, format!("{} boiling at {:.1} °C", c.name, tc_c(tb)));
                            }
                            if n_l - boil <= EPS_MOL {
                                self.push_event_full(VesselEventKind::DryOut, format!("{} boiled off", c.name), 0.6, Some(lid.clone()), c.color_linear_rgb);
                                self.ev.phase.entry(c.species.clone()).and_modify(|f| *f &= !F_BOILING);
                            }
                        }
                    }
                }
            }
            if !changed {
                break;
            }
        }
        for c in &compounds {
            if let Some(&mol) = boiled.get(&c.species) {
                let t_boil = c.boil_k(P_ATM_PA * p_atm).unwrap_or(self.temperature_k);
                let vol_ml = mol * R_GAS * t_boil / (p_atm * P_ATM_PA) * 1e6;
                self.boil_vapour_ml_s += vol_ml / dt_s.max(1e-6);
                self.boil_mass_g_s += mol * c.mw / dt_s.max(1e-6);
                self.gas_fluxes.push(GasFlux {
                    species: format!("{}(g)", c.species),
                    rate_ml_s: vol_ml / dt_s.max(1e-6),
                    bubble_diameter_mm: 3.0,
                    nucleation: "bulk".into(),
                });
            }
        }
        // boiling stopped (cooled below the boiling point or liquid gone): allow announcing it again
        let live: Vec<String> = self.gas_fluxes.iter().map(|g| base_id(&g.species).to_string()).collect();
        for (sp, flags) in self.ev.phase.iter_mut() {
            if *flags & F_BOILING != 0 && !live.contains(sp) {
                *flags &= !F_BOILING;
            }
        }
    }
}
