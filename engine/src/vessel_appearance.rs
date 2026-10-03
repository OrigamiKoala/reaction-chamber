//! What a vessel's vapours look like: the plume above an open vessel (gas inventory, buoyancy, exchange), fumes and aerosols,
//! steam / mist from mixing-line supersaturation, wall condensation, and the flame-test colour of dissolved metals.
//!
//! Nothing here is keyed on a compound: the gases that colour the air come from cross-section records, whether a plume sinks
//! or rises from the mixture's molar mass and temperature, mist from the vapour-pressure curves of whatever evaporates (the
//! "breath fog" calculation), aerosols from the thermodynamics of solution droplets and of gas-phase solid formation.

use std::collections::HashMap;

use crate::optics::gas::{self, M_AIR_G_MOL};
use crate::physics::R_GAS;
use crate::vessel::*;

/// Fraction of the liquid-to-room temperature difference the glass wall above the liquid sits at (heat flows through the wall
/// from the hot headspace to the room; a placeholder for a wall node with a proper heat-transfer coefficient).
const WALL_TEMPERATURE_FRACTION: f64 = 0.3;
/// Effective radius of fresh condensation droplets, m (fog droplets are 1-10 um).
const MIST_DROPLET_RADIUS_M: f64 = 2e-6;
/// Rise velocity of the vapour plume above an open vessel, m/s (a placeholder for the plume's buoyant velocity).
const PLUME_RISE_M_S: f64 = 0.3;
/// Dew-point depression below the wall (K) over which the wall goes from dry to fully misted.
const CONDENSATION_SPAN_K: f64 = 30.0;
/// Mixing fractions sampled along the plume's mixing line.
const MIX_STEPS: usize = 24;

/// The mist state above a vessel.
#[derive(Clone, Debug, Default)]
pub struct MistState {
    /// 0-1: how visible the vapour plume is.
    pub visibility: f64,
    /// 0-1: how much the upper glass is misted with condensed vapour.
    pub condensation: f64,
    /// Peak condensed liquid water content of the plume's mixing line, g/m3.
    pub lwc_g_m3: f64,
}

/// Longest unbranched chain of saturated, non-ring carbons of a molecule (the hydrophobic tail of an amphiphile).
pub fn alkyl_chain_length(m: &crate::smiles::Molecule) -> usize {
    let n = m.atoms.len();
    let ok = |i: usize| m.atoms[i].element == "C" && !m.atoms[i].aromatic && m.neighbours(i).iter().all(|(_, order)| *order == 1.0);
    let mut best = 0usize;
    // longest simple path through chain carbons (tail molecules are small trees: depth-first from every chain carbon)
    fn dfs(m: &crate::smiles::Molecule, ok: &dyn Fn(usize) -> bool, at: usize, prev: usize, len: usize, best: &mut usize, depth: usize) {
        *best = (*best).max(len);
        if depth > 40 {
            return;
        }
        for (j, _) in m.neighbours(at) {
            if j != prev && ok(j) {
                dfs(m, ok, j, at, len + 1, best, depth + 1);
            }
        }
    }
    for i in 0..n {
        if ok(i) {
            dfs(m, &ok, i, usize::MAX, 1, &mut best, 0);
        }
    }
    best
}

/// Whether a molecule is surface-active by structure: a hydrocarbon tail of at least `MIN_TAIL_CARBONS` and a polar head
/// (a charge, or several oxygens / a sulfur- or phosphorus-bearing group). Returns the tail length.
pub fn amphiphile_tail(smiles: &str) -> Option<usize> {
    const MIN_TAIL_CARBONS: usize = 8;
    let m = crate::smiles::parse(smiles)?;
    let tail = alkyl_chain_length(&m);
    if tail < MIN_TAIL_CARBONS {
        return None;
    }
    let charged = m.atoms.iter().any(|a| a.charge != 0);
    let heteroatoms = m.atoms.iter().filter(|a| matches!(a.element.as_str(), "O" | "N" | "S" | "P")).count();
    let has_sp = m.atoms.iter().any(|a| matches!(a.element.as_str(), "S" | "P")) && heteroatoms >= 3;
    if charged || has_sp || heteroatoms >= 4 {
        Some(tail)
    } else {
        None
    }
}

/// Szyszkowski adsorption: maximum surface excess of an amphiphile, mol/m2.
const SURFACE_EXCESS_MAX_MOL_M2: f64 = 3.3e-6;
/// Traube's rule: the adsorption constant triples per CH2; reference constant of a one-carbon tail, L/mol.
const ADSORPTION_K_ONE_CARBON_L_MOL: f64 = 0.01;
/// Surface-tension lowering (mN/m) at which a foam is fully stable.
const FULL_FOAM_LOWERING_MN_M: f64 = 10.0;

impl Vessel {
    /// Free height (m) above the liquid in the vessel: the column that holds a heavy plume.
    pub(crate) fn head_height_m(&self) -> f64 {
        let r = self.config.inner_radius_cm.max(0.3);
        let area_cm2 = std::f64::consts::PI * r * r;
        let total_cm = self.config.capacity_ml / area_cm2;
        let liquid_cm = self.total_liquid_volume_ml() / area_cm2;
        ((total_cm - liquid_cm).max(1.0)) * 1e-2
    }

    /// Gas volume (m3) of that free column.
    fn head_volume_m3(&self) -> f64 {
        let r = self.config.inner_radius_cm.max(0.3) * 1e-2;
        std::f64::consts::PI * r * r * self.head_height_m()
    }

    /// Relative saturation of the room air for a gas id (the atmosphere's setting; 0 when it is not a humid gas).
    fn room_relative_saturation(&self, gas_id: &str) -> f64 {
        self.atmosphere.relative_saturation.iter().find(|(k, _)| k == gas_id).map_or(0.0, |(_, v)| *v)
    }

    // ------------------------------------------------------------------------------------------------ surface tension, bubbles, foam
    /// Surface tension (N/m) of one liquid component at the vessel temperature: the import's measured value scaled with the
    /// Guggenheim-Katayama exponent, else the Brock-Bird corresponding-states estimate from the critical constants and the
    /// normal boiling point of its vapour-pressure curve; None when the component has neither.
    fn component_surface_tension_n_m(&self, key: &str) -> Option<f64> {
        let t = self.temperature_k;
        let vol = self.volatile_for(key)?;
        let tc = vol.tc_k()?;
        let tb = vol.psat.t_sat(101_325.0);
        let pc_bar = vol.crit.map(|c| c.pc_pa / 1e5).or_else(|| crate::vle::gas_critical(&vol.gas_id).map(|c| c.pc_pa / 1e5))?;
        if let Some(sig) = self.compound_for(key).and_then(|c| c.surface_tension_mn_m) {
            // measured at ~22 C
            let tr = |x: f64| (1.0 - x / tc).max(1e-3);
            return Some(sig * 1e-3 * (tr(t) / tr(295.0)).powf(11.0 / 9.0));
        }
        // Brock & Bird (1955): sigma [dyn/cm] = Pc^(2/3) Tc^(1/3) Q (1 - Tr)^(11/9), Q = 0.1196 (1 + Tbr ln(Pc/1.01325)/(1 - Tbr)) - 0.279
        let tbr = (tb / tc).clamp(0.3, 0.95);
        let q = 0.1196 * (1.0 + tbr * (pc_bar / 1.01325).ln() / (1.0 - tbr)) - 0.279;
        let tr = (t / tc).clamp(0.0, 0.99);
        Some((pc_bar.powf(2.0 / 3.0) * tc.powf(1.0 / 3.0) * q * (1.0 - tr).powf(11.0 / 9.0)).max(1.0) * 1e-3)
    }

    /// Surface tension (N/m) of the liquid the bubbles form in: water (IAPWS) lowered by the adsorption of surface-active
    /// species (Szyszkowski with Traube's rule) when the main phase is aqueous; otherwise the mole-fraction mean of the
    /// components' tensions.
    pub(crate) fn liquid_surface_tension_n_m(&self) -> f64 {
        let t = self.temperature_k;
        if self.has_aqueous_phase() {
            let sigma0 = crate::transfer::hydro::water_surface_tension_n_m(t);
            let v_l = (self.aqueous_volume_ml() / 1000.0).max(1e-9);
            let mut lowering = 0.0;
            let mut keys: Vec<&String> = self.species_mol.keys().collect();
            keys.sort();
            for k in keys {
                let c = self.species_mol[k] / v_l;
                if c < 1e-9 {
                    continue;
                }
                if let Some(tail) = self.smiles_of(Some(k)).and_then(|s| amphiphile_tail(&s)) {
                    let kc = ADSORPTION_K_ONE_CARBON_L_MOL * 3f64.powi(tail as i32 - 1);
                    lowering += R_GAS * t * SURFACE_EXCESS_MAX_MOL_M2 * (1.0 + kc * c).ln();
                }
            }
            return (sigma0 - lowering).max(0.015);
        }
        let mut num = 0.0;
        let mut den = 0.0;
        for m in self.liquid_maps() {
            for (k, &mol) in m {
                if mol <= 0.0 {
                    continue;
                }
                if let Some(s) = self.component_surface_tension_n_m(k) {
                    num += mol * s;
                    den += mol;
                }
            }
        }
        if den > 0.0 { num / den } else { crate::transfer::hydro::water_surface_tension_n_m(t) }
    }

    /// Departure diameter (mm) of a gas bubble: Fritz's correlation with the liquid's own surface tension and density at the
    /// vessel temperature; the contact angle depends on where it forms (a heated surface boils at a larger angle than a
    /// wetted wall or crystal face). One function for every call site.
    pub fn bubble_diameter_mm(&self, nucleation: &str) -> f64 {
        use crate::transfer::gas_transfer as gt;
        let sigma = self.liquid_surface_tension_n_m();
        let rho_l = self.hydro_state().rho_l;
        let theta = if nucleation == "bulk" { gt::BOILING_CONTACT_ANGLE_DEG } else { gt::BUBBLE_CONTACT_ANGLE_DEG };
        (gt::departure_diameter_m(theta, sigma, rho_l, 1.2) * 1e3).clamp(0.2, 8.0)
    }

    /// Foam head (0-0.95) for a total gas flow: a gas flow only builds a lasting foam when something lowers the surface
    /// tension (a surface-active species); plain fizz is transient. The flow sets how fast the head builds.
    pub(crate) fn foam_level(&self, total_gas_ml_s: f64) -> f64 {
        if !self.has_aqueous_phase() || total_gas_ml_s <= 0.0 {
            return 0.0;
        }
        let sigma0 = crate::transfer::hydro::water_surface_tension_n_m(self.temperature_k);
        let lowering_mn_m = ((sigma0 - self.liquid_surface_tension_n_m()) * 1e3).max(0.0);
        let stability = (lowering_mn_m / FULL_FOAM_LOWERING_MN_M).clamp(0.0, 1.0);
        ((total_gas_ml_s / 50.0).clamp(0.0, 1.0) * stability).clamp(0.0, 0.95)
    }

    // ------------------------------------------------------------------------------------------------ plume
    /// Updates the plume of an open vessel: gases that left the liquid this step (reaction gas, boiling, evaporation,
    /// sublimation) join the gas pooled in the vessel, which leaves by buoyancy (light gases) or turbulent mixing (heavy ones).
    /// A sealed vessel has no plume (its gas is the headspace).
    pub fn step_plume(&mut self, dt_s: f64) {
        if self.sealed || self.burst {
            self.plume_mol.clear();
            self.plume_aerosol.clear();
            self.vapour_sources.clear();
            return;
        }
        let t_liq = self.temperature_k;
        let p = self.p_ext_pa();
        // sources of this step (mol)
        let mut src: HashMap<String, f64> = HashMap::new();
        for g in &self.gas_fluxes {
            if g.rate_ml_s > 0.0 {
                let id = if g.species.ends_with("(g)") { g.species.clone() } else { format!("{}(g)", g.species) };
                *src.entry(id).or_default() += g.rate_ml_s * 1e-6 * dt_s * p / (R_GAS * t_liq);
            }
        }
        for (id, mol) in self.vapour_sources.drain(..) {
            *src.entry(id).or_default() += mol;
        }

        // buoyancy of what is pooled (including this step's gas)
        let mut total: HashMap<String, f64> = self.plume_mol.clone();
        for (k, v) in &src {
            *total.entry(k.clone()).or_default() += v;
        }
        let v_head = self.head_volume_m3();
        let n_head = p * v_head / (R_GAS * self.room_k);
        let gas_mol: f64 = total.iter().filter(|(k, _)| k.ends_with("(g)")).map(|(_, v)| *v).sum();
        let n_all = n_head.max(gas_mol * 1.0001);
        let mass_gas: f64 = total.iter().filter(|(k, _)| k.ends_with("(g)")).map(|(k, v)| v * crate::ions::species_mass(k.trim_end_matches("(g)")).unwrap_or(M_AIR_G_MOL)).sum();
        let n_air = (n_all - gas_mol).max(0.0);
        let m_mix = (mass_gas + n_air * M_AIR_G_MOL) / n_all;
        let t_plume = (gas_mol * t_liq + n_air * self.room_k) / n_all;
        let ratio = gas::density_ratio(m_mix, t_plume, M_AIR_G_MOL, self.room_k);
        let tau = gas::exchange_time_s(ratio, self.head_height_m());
        let decay = (-dt_s / tau).exp();
        let mut next: HashMap<String, f64> = HashMap::new();
        for (k, v) in &self.plume_mol {
            let n = v * decay;
            if n > 1e-15 {
                next.insert(k.clone(), n);
            }
        }
        for (k, v) in src {
            *next.entry(k).or_default() += v;
        }

        // gas-phase reactions that make a solid: the gases combine into the aerosol (mass conserved inside the plume)
        let mut gases: Vec<(String, f64)> = next.iter().filter(|(k, v)| k.ends_with("(g)") && **v > 1e-12).map(|(k, v)| (k.clone(), v / n_all * p)).collect();
        gases.sort_by(|a, b| a.0.cmp(&b.0));
        if gases.len() >= 2 {
            let mut solids = gas::gas_phase_solids(&gases, t_plume);
            solids.sort_by(|a, b| a.solid_id.cmp(&b.solid_id));
            for s in solids {
                let n_s = s.parts.iter().map(|(g, a)| next.get(g).copied().unwrap_or(0.0) / a).fold(f64::MAX, f64::min);
                if n_s > 1e-15 && n_s.is_finite() {
                    for (g, a) in &s.parts {
                        if let Some(n) = next.get_mut(g) {
                            *n = (*n - a * n_s).max(0.0);
                        }
                    }
                    *next.entry(s.solid_id.clone()).or_default() += n_s;
                }
            }
        }
        next.retain(|_, v| *v > 1e-15);

        // aerosols from dissolution into humid-air droplets (acid / soluble gases)
        let mut aerosol: HashMap<String, f64> = HashMap::new();
        let rh = self.room_relative_saturation(crate::db::seed::WATER_VAPOUR).max(0.05);
        let v_m3 = v_head.max(1e-9);
        for (id, n) in next.iter().filter(|(k, _)| k.ends_with("(g)")) {
            let p_i = n / n_all * p;
            if let Some((s, m_eq)) = gas::solution_droplet_supersaturation(id, p_i, rh, self.room_k) {
                if s > gas::FUMING_SUPERSATURATION {
                    let mw = crate::ions::species_mass(id.trim_end_matches("(g)")).unwrap_or(30.0);
                    // the solute beyond what the air holds condenses with the water of a droplet at equilibrium molality
                    let n_cond = n * (1.0 - 1.0 / s);
                    aerosol.insert(id.clone(), n_cond / v_m3 * (mw + 1000.0 / m_eq));
                }
            }
        }
        for (id, n) in next.iter().filter(|(k, _)| k.ends_with("(s)")) {
            let mw = crate::ions::species_mass(id.trim_end_matches("(s)")).unwrap_or(50.0);
            aerosol.insert(id.clone(), n / v_m3 * mw);
        }
        self.plume_mol = next;
        self.plume_aerosol = aerosol;
    }

    /// The fumes above the vessel as the renderer draws them: coloured gases (cross-section x column density), aerosols (white
    /// haze of droplets or smoke), each with its buoyancy. A sealed vessel's fumes are its evolved gas.
    pub(crate) fn fume_visuals(&self) -> Vec<FumeVisual> {
        let mut out: Vec<FumeVisual> = Vec::new();
        let path_cm = 2.0 * self.config.inner_radius_cm.max(0.3);
        if self.sealed {
            let v_l = (self.headspace_volume_m3() * 1000.0).max(1e-6);
            let mut keys: Vec<(String, f64)> = self.evolved_headspace().into_iter().filter(|(_, m)| *m > 1e-9).collect();
            keys.sort_by(|a, b| a.0.cmp(&b.0));
            for (id, mol) in keys {
                if let Some(look) = gas::plume_look(&[(id.as_str(), mol / v_l)], path_cm) {
                    if look.opacity > 0.01 {
                        let m = crate::ions::species_mass(id.trim_end_matches("(g)")).unwrap_or(M_AIR_G_MOL);
                        let ratio = gas::density_ratio(m, self.temperature_k, M_AIR_G_MOL, self.room_k);
                        out.push(FumeVisual { species: id, intensity: (1.0 - (-look.peak_optical_depth).exp()).clamp(0.0, 1.0), rgb: look.rgb, opacity: look.opacity, denser_than_air: ratio > 1.0, density_ratio: ratio, kind: "gas".to_string() });
                    }
                }
            }
            return out;
        }
        let v_l = (self.head_volume_m3() * 1000.0).max(1e-6);
        let total_gas: f64 = self.plume_mol.iter().filter(|(k, _)| k.ends_with("(g)")).map(|(_, v)| *v).sum();
        let p = self.p_ext_pa();
        let n_head = (p * self.head_volume_m3() / (R_GAS * self.room_k)).max(total_gas * 1.0001);
        let mass_gas: f64 = self.plume_mol.iter().filter(|(k, _)| k.ends_with("(g)")).map(|(k, v)| v * crate::ions::species_mass(k.trim_end_matches("(g)")).unwrap_or(M_AIR_G_MOL)).sum();
        let n_air = (n_head - total_gas).max(0.0);
        let t_plume = (total_gas * self.temperature_k + n_air * self.room_k) / n_head;
        let ratio = gas::density_ratio((mass_gas + n_air * M_AIR_G_MOL) / n_head, t_plume, M_AIR_G_MOL, self.room_k);
        let mut ids: Vec<&String> = self.plume_mol.keys().collect();
        ids.sort();
        for id in ids {
            let mol = self.plume_mol[id];
            if !id.ends_with("(g)") || mol < 1e-12 {
                continue;
            }
            if let Some(look) = gas::plume_look(&[(id.as_str(), mol / v_l)], path_cm) {
                if look.opacity > 0.01 {
                    out.push(FumeVisual { species: id.clone(), intensity: (1.0 - (-look.peak_optical_depth).exp()).clamp(0.0, 1.0), rgb: look.rgb, opacity: look.opacity, denser_than_air: ratio > 1.0, density_ratio: ratio, kind: "gas".to_string() });
                }
            }
        }
        let mut aer: Vec<(&String, &f64)> = self.plume_aerosol.iter().collect();
        aer.sort_by(|a, b| a.0.cmp(b.0));
        for (id, g_m3) in aer {
            let opacity = 1.0 - (-g_m3 / gas::OPAQUE_AEROSOL_G_M3).exp();
            if opacity > 0.02 {
                out.push(FumeVisual { species: id.clone(), intensity: opacity.clamp(0.0, 1.0), rgb: [0.93, 0.93, 0.95], opacity, denser_than_air: ratio > 1.0, density_ratio: ratio, kind: "aerosol".to_string() });
            }
        }
        out
    }

    // ------------------------------------------------------------------------------------------------ mist and condensation
    /// Visible vapour above the vessel and condensation on its glass, from the vapour-pressure curves of what evaporates.
    ///
    /// *Mist*: the plume is a mixing line between the saturated surface vapour (temperature of the liquid) and the room air
    /// (room temperature and humidity): `y(f) = f y_s + (1-f) y_a`, `T(f) = f T_liq + (1-f) T_room`. Wherever `y(f)` exceeds the
    /// saturation mole fraction `P_sat(T(f)) / P` the vapour condenses into droplets; the largest condensed liquid water
    /// content on the line, scaled by the evaporation flux, is the visibility. No liquid, no vapour, no mist.
    /// *Condensation*: the glass wall above the liquid sits between the liquid and the room temperature; it mists when the
    /// dew point of the headspace vapour is above that wall temperature.
    pub(crate) fn mist_state(&self) -> MistState {
        let mut st = MistState::default();
        if self.sealed || self.total_liquid_volume_ml() < 0.01 {
            return st;
        }
        let t_liq = self.temperature_k;
        let t_room = self.room_k;
        if t_liq <= t_room + 0.5 {
            return st;
        }
        let p = self.p_ext_pa();
        let phases = self.vle_phases(t_liq);
        if phases.is_empty() {
            return st;
        }
        let (parts, _sum) = self.phase_partials(&phases, t_liq);
        let atm = self.atmosphere_partials();
        // surface vapour per component (Pa); when boiling the vapour is at the ambient pressure
        let mut comps: Vec<(std::sync::Arc<crate::vle::Volatile>, f64)> = Vec::new();
        for (ph, row) in phases.iter().zip(&parts) {
            for (c, p_s) in ph.comps.iter().zip(row) {
                if let Some(e) = comps.iter_mut().find(|(v, _)| v.id == c.vol.id) {
                    e.1 += p_s;
                } else {
                    comps.push((c.vol.clone(), *p_s));
                }
            }
        }
        let p_sum: f64 = comps.iter().map(|(_, ps)| ps).sum();
        let boiling = self.boil_vapour_ml_s > 0.0;
        let scale = if boiling && p_sum > 0.0 { p / p_sum } else { 1.0 };
        let mut lwc_total = 0.0;
        let mut dew_k = 0.0_f64;
        for (vol, p_s) in &comps {
            let y_s = (p_s * scale / p).min(1.0);
            let p_amb = atm.iter().find(|(k, _)| *k == vol.gas_id).map(|(_, v)| *v).unwrap_or(0.0);
            let y_a = p_amb / p;
            let mut best = 0.0_f64;
            for k in 1..MIX_STEPS {
                let f = k as f64 / MIX_STEPS as f64;
                let y = f * y_s + (1.0 - f) * y_a;
                let t_m = f * t_liq + (1.0 - f) * t_room;
                let y_sat = vol.psat_pa(t_m) / p;
                let excess = (y - y_sat).max(0.0);
                // mol of condensate per m3 of the mixed air, as grams
                let g_m3 = excess * p / (R_GAS * t_m) * vol.mw;
                best = best.max(g_m3);
            }
            lwc_total += best;
            // dew point of the headspace vapour (partial pressure y_s P)
            let p_v = y_s * p;
            if p_v > 1.0 {
                dew_k = dew_k.max(vol.psat.t_sat(p_v));
            }
        }
        // the plume carries the vapour flux up through the vessel opening: its condensed water content cannot exceed what
        // the mixing line allows nor what the flux supplies (flux / (rise velocity x opening area)); the optical depth
        // of droplets across the plume is tau = 3 LWC L / (2 rho_w r_eff)
        let flux_g_s = self.evaporation_g_s + self.boil_mass_g_s;
        let r_m = self.config.inner_radius_cm.max(0.3) * 1e-2;
        let area_m2 = std::f64::consts::PI * r_m * r_m;
        let lwc_flux = flux_g_s / (PLUME_RISE_M_S * area_m2);
        let lwc = lwc_total.min(lwc_flux);
        let tau = 1.5 * (lwc * 1e-3) * (2.0 * r_m) / (1000.0 * MIST_DROPLET_RADIUS_M);
        st.lwc_g_m3 = lwc;
        st.visibility = (1.0 - (-tau).exp()).clamp(0.0, 1.0);
        let t_wall = t_room + WALL_TEMPERATURE_FRACTION * (t_liq - t_room);
        st.condensation = ((dew_k - t_wall) / CONDENSATION_SPAN_K).clamp(0.0, 1.0);
        st
    }
}
