//! Gas phase, vapour-liquid equilibrium and gas-liquid exchange of a vessel (Stage 4).
//!
//! One set of general models replaces the per-compound clamps of the earlier engine:
//!
//! * **Volatile components** are resolved from species records (`vle.rs`): any liquid with a saturation-pressure curve.
//!   Water, ethanol, the neat liquids of imported compounds all go through the same code.
//! * **Liquid mixtures** are partitioned into liquid phases by a binary UNIFAC miscibility test (water + ethanol and
//!   hexane + toluene mix; water + hexane do not), and every phase gets UNIFAC activity coefficients (with the ionic
//!   water activity of the dissolved salts added to the water component).
//! * **Boiling** (open vessel) is the bubble point: the temperature at which `sum x_i gamma_i Psat_i(T)` reaches the
//!   atmosphere's pressure; heat above it is spent on vapour of the *equilibrium vapour composition* (distillation),
//!   so a mixture boils over a temperature range and an azeotrope boils at constant composition. Below the bubble point
//!   every volatile component evaporates (or condenses) toward the partial pressure of the atmosphere.
//! * **Sealed vessels** hold a closed gas inventory (air captured when the stopper went in, vapour, evolved gas). An
//!   isochoric flash puts every volatile at gamma-phi equilibrium (Peng-Robinson fugacities of the gas mixture, Lee-Kesler
//!   saturation curves, UNIFAC activities, Poynting correction); species above their critical temperature are one fluid
//!   with the gas.
//! * **Dissolved gases** exchange with the gas phase through Henry's constant `k_H = exp(-(mu_aq - mu_g)/RT)` of the
//!   records' chemical potentials, with the partial pressure of the atmosphere (open) or of the headspace (sealed).
//!
//! The rates of the transfer processes below come from the Stage 8 transport models (`transfer/`: film coefficients from the
//! stirring and the geometry, Fuller / Wilke-Chang diffusivities, Sherwood correlations); the one remaining placeholder is
//! `SPARGE_EFFICIENCY`, the share of a sparged gas that reaches Henry equilibrium. Equilibrium positions and heats are derived.

use std::collections::{BTreeSet, HashMap};
use std::sync::Arc;

use crate::activity;
use crate::compound_thermo::{CompoundThermo, P_ATM_PA};
use crate::eos::{self, PrComp};
use crate::gas_phase::{GasPhaseInfo, GasPhaseSpecies, ATM_PA};
use crate::physics::R_GAS;
use crate::vessel::*;
use crate::vle::{self, Critical, LiquidVolume, PsatModel, Volatile};

/// Fraction of a gas sparged through a liquid that comes to Henry equilibrium with it (bubble contact efficiency).
const SPARGE_EFFICIENCY: f64 = 0.5;
/// Thinnest liquid film that still spreads over an area (cm): a droplet does not cover the whole vessel floor.
const MIN_FILM_CM: f64 = 0.05;

const F_BOILING: u8 = 8;

fn ions_charge_nonzero(key: &str) -> bool {
    crate::ions::species_charge(key) != 0
}
const MIN_AMOUNT_MOL: f64 = 1e-15;

/// One volatile liquid component of the vessel with its amount.
#[derive(Clone)]
pub(crate) struct VleComp {
    pub vol: Arc<Volatile>,
    /// `species_mol` key.
    pub key: String,
    pub mol: f64,
    /// The liquid phase the amount is in (0 = the primary phase, p = `extra_liquids[p - 1]`).
    pub phase: usize,
}

/// A liquid phase for the vapour-liquid equilibrium: components that mix.
#[derive(Clone)]
pub(crate) struct VlePhase {
    pub comps: Vec<VleComp>,
    /// Contains the aqueous solvent (ionic water activity applies).
    pub aqueous: bool,
    /// Index of the liquid phase (0 = primary).
    pub index: usize,
}

/// One volatile component of a sealed-vessel flash.
struct FlashItem {
    vol: Arc<Volatile>,
    key: String,
    n_liq0: f64,
    n_tot: f64,
    /// Every liquid key that holds this molecule (its neat liquid and its dissolved form: `Br2(l)` and `Br2(aq)` share one gas
    /// phase) with its amount: they are one inventory in the flash and are scaled together when the result is written back.
    members: Vec<(String, f64)>,
}

/// The temperature-independent part of a flash problem.
struct FlashInputs {
    t: f64,
    items: Vec<FlashItem>,
    /// Gas species that are not volatile liquids of the vessel (air, evolved gas), fixed amounts.
    others: Vec<(String, f64)>,
    other_crit: Vec<PrComp>,
    pr_ok: bool,
    v_liq_other: f64,
    n_gas0: Vec<f64>,
}

#[derive(Clone)]
struct FlashOut {
    n_gas: Vec<f64>,
    pressure_pa: f64,
    v_liq: f64,
}

impl FlashOut {
    /// Heat (J) taken from the contents by the vapour made since the start of the step.
    fn q_latent(&self, inp: &FlashInputs, t: f64) -> f64 {
        inp.items.iter().enumerate().map(|(k, it)| (self.n_gas[k] - inp.n_gas0[k]) * it.vol.latent_heat_j_mol(t)).sum()
    }
}

impl Vessel {
    /// Vapour flux (mol/s, + = leaving the surface) of a species with surface partial pressure `p_surface` into a gas of
    /// partial pressure `p_inf`, across `area_m2` of the vessel (depth below the rim from the geometry).
    pub(crate) fn vapour_flux_mol_s(&self, liquid_id: &str, mw: f64, p_surface: f64, p_inf: f64, area_m2: f64, t: f64) -> f64 {
        if area_m2 <= 1e-10 {
            return 0.0;
        }
        let r_cm = self.config.inner_radius_cm.max(0.5);
        let cross_cm2 = std::f64::consts::PI * r_cm.powi(2);
        let depth_below_rim_m = ((self.config.capacity_ml - self.total_liquid_volume_ml()) / cross_cm2).max(0.0) * 0.01;
        let el = crate::ions::species_elements(liquid_id).unwrap_or_default();
        let p_tot = self.p_ext_pa();
        let d_gas = crate::transfer::diffusion::fuller_gas_diffusivity_m2_s(t, p_tot, mw, &el);
        let k = crate::transfer::evaporation::mass_transfer_coefficient_m_s(t, p_tot, area_m2, depth_below_rim_m, p_surface.max(p_inf), mw, d_gas);
        k * area_m2 * (p_surface - p_inf) / (R_GAS * t.max(100.0))
    }

    /// Evaporation of the water of a bath from its free surface (`area_m2`) at `t_bath` into the atmosphere: the same
    /// mass-transfer correlation as an open vessel, with the saturation pressure and latent heat of the solvent's own
    /// record. Returns (mol/s, latent-heat flux W, g/s); nothing when the solvent has no vapour-pressure data.
    pub(crate) fn bath_evaporation(&self, t_bath: f64, area_m2: f64) -> (f64, f64, f64) {
        if area_m2 <= 1e-8 {
            return (0.0, 0.0, 0.0);
        }
        let Some(vol) = self.volatile_for(crate::vessel::AQUEOUS_SOLVENT) else { return (0.0, 0.0, 0.0) };
        let p_surface = vol.psat_pa(t_bath);
        let p_inf = self.atmosphere_partials().iter().find(|(k, _)| *k == vol.gas_id).map(|(_, p)| *p).unwrap_or(0.0);
        if p_surface <= p_inf {
            return (0.0, 0.0, 0.0);
        }
        let el = crate::ions::species_elements(&vol.id).unwrap_or_default();
        let p_tot = self.p_ext_pa();
        let d_gas = crate::transfer::diffusion::fuller_gas_diffusivity_m2_s(t_bath, p_tot, vol.mw, &el);
        let k = crate::transfer::evaporation::mass_transfer_coefficient_m_s(t_bath, p_tot, area_m2, 0.0, p_surface, vol.mw, d_gas);
        let mol_s = k * area_m2 * (p_surface - p_inf) / (R_GAS * t_bath.max(100.0));
        (mol_s, mol_s * vol.latent_heat_j_mol(t_bath), mol_s * vol.mw)
    }

    // ------------------------------------------------------------------------------------------------ atmosphere
    pub fn p_ext_pa(&self) -> f64 {
        self.atmosphere.pressure_pa()
    }

    pub fn p_ext_atm(&self) -> f64 {
        self.atmosphere.pressure_atm
    }

    /// Partial pressures (Pa) of the atmosphere at the room temperature.
    pub(crate) fn atmosphere_partials(&self) -> Vec<(String, f64)> {
        let psat_of = |gas_id: &str, t: f64| -> Option<f64> { self.volatile_for_gas(gas_id).map(|v| v.psat_pa(t)) };
        self.atmosphere.partial_pressures_pa(self.room_k, &psat_of)
    }


    // ------------------------------------------------------------------------------------------------ resolution
    /// The volatile component a liquid-inventory key is (water, ethanol, iodine, an imported hexane), if it is one: from the
    /// species records of its molecule (any of the records that share its InChIKey), else from the import's own data.
    pub fn volatile_for(&self, key: &str) -> Option<Arc<Volatile>> {
        if key.ends_with("(s)") || key.ends_with("(g)") || ions_charge_nonzero(key) {
            return None;
        }
        let cache_key = format!("liquid:{}", key);
        if let Some(v) = self.vle_cache.borrow_mut().cached_volatile(&cache_key) {
            return v;
        }
        let from_store = self.vle_cache.borrow_mut().volatile(key);
        let v = from_store.or_else(|| self.compound_for(key).and_then(|c| self.volatile_from_compound(c, key)));
        self.vle_cache.borrow_mut().insert_volatile(&cache_key, v.clone());
        v
    }

    /// The volatile liquid whose gas phase is `gas_id` ("H2O(g)" -> water): the liquid the vessel holds under that molecule's
    /// key if there is one, else the liquid record of the same molecule.
    pub fn volatile_for_gas(&self, gas_id: &str) -> Option<Arc<Volatile>> {
        let held: Option<String> = self
            .liquid_maps()
            .flat_map(|m| m.keys())
            .find(|k| self.molecule(k).map_or(false, |m| m.gas_key.as_deref() == Some(gas_id)) || format!("{}(g)", k.trim_end_matches("(aq)")) == gas_id)
            .cloned();
        if let Some(k) = held {
            if let Some(v) = self.volatile_for(&k) {
                return Some(v);
            }
        }
        let liq_id = self.vle_cache.borrow_mut().liquid_twin_of_gas(gas_id)?;
        self.volatile_for(&liq_id)
    }

    fn volatile_from_compound(&self, c: &CompoundThermo, key: &str) -> Option<Arc<Volatile>> {
        let curve = c.vapor_curve?;
        let liq_id = key.to_string();
        let gas_id = format!("{}(g)", key.trim_end_matches("(aq)"));
        let tb = curve.t_at(P_ATM_PA);
        // critical constants from the store record of the same molecule (by InChIKey), else estimated from Tb
        let store_crit: Option<Critical> = c.inchi_key.as_ref().and_then(|ik| {
            let store = crate::db::SpeciesStore::global();
            let guard = store.read().ok()?;
            guard.all_by_inchikey(ik).into_iter().find_map(vle::critical_of).map(|(tc, pc, w)| Critical {
                tc_k: tc,
                pc_pa: pc,
                omega: w.unwrap_or(0.3),
            })
        });
        let (psat, crit, tier, source) = if c.n_psat_points >= 2 || tb.is_none() {
            let crit = store_crit.or_else(|| tb.map(|tb| vle::estimate_critical_from_tb(tb, c.mw)));
            (PsatModel::Curve(curve), crit, crate::types::ProvenanceTier::Imported, "Clausius-Clapeyron / Antoine-type fit through the imported saturation points".to_string())
        } else {
            let tb = tb.unwrap();
            let (cr, tier) = match store_crit {
                Some(c) => (c, crate::types::ProvenanceTier::Estimated),
                None => (vle::estimate_critical_from_tb(tb, c.mw), crate::types::ProvenanceTier::Speculative),
            };
            if tb < cr.tc_k {
                (
                    PsatModel::LeeKesler { tc_k: cr.tc_k, pc_pa: cr.pc_pa, omega_fit: vle::lk_omega_through(cr.tc_k, cr.pc_pa, tb, P_ATM_PA) },
                    Some(cr),
                    tier,
                    "Lee-Kesler corresponding states anchored at the imported normal boiling point".to_string(),
                )
            } else {
                (PsatModel::Curve(curve), None, crate::types::ProvenanceTier::Speculative, "Trouton-rule Clausius-Clapeyron through one imported point".to_string())
            }
        };
        Some(Arc::new(Volatile {
            id: liq_id,
            gas_id,
            name: c.name.clone(),
            mw: c.mw,
            psat,
            psat_tier: tier,
            psat_source: source,
            crit,
            volume: LiquidVolume::Density(c.rho_liquid),
        }))
    }

    /// Henry species whose aqueous id is `key`.
    pub(crate) fn henry_for_aq(&self, key: &str) -> Option<vle::HenrySpecies> {
        self.vle_cache.borrow_mut().henry(key)
    }

    /// Henry species whose gas phase is `gas_id` (the aqueous twin of a gas, by InChIKey).
    pub(crate) fn henry_for_gas(&self, gas_id: &str) -> Option<vle::HenrySpecies> {
        let aq_id = self.vle_cache.borrow_mut().aqueous_twin_of_gas(gas_id)?;
        self.henry_for_aq(&aq_id)
    }

    pub(crate) fn register_vle_compound(&mut self, c: &CompoundThermo) {
        if let Some(sm) = &c.smiles {
            activity::register_unifac_smiles(&c.species, sm);
        }
        self.vle_cache.borrow_mut().forget(&format!("liquid:{}", c.species));
    }

    // ------------------------------------------------------------------------------------------------ liquid phases
    /// Volatile liquid components present, with amounts and the phase each is in, as one list.
    pub(crate) fn vle_components(&self) -> Vec<VleComp> {
        let mut out: Vec<VleComp> = Vec::new();
        for (p, map) in self.liquid_maps().enumerate() {
            for (key, &mol) in map {
                if mol <= MIN_AMOUNT_MOL {
                    continue;
                }
                if let Some(vol) = self.volatile_for(key) {
                    out.push(VleComp { vol, key: key.clone(), mol, phase: p });
                }
            }
        }
        out.sort_by(|a, b| a.phase.cmp(&b.phase).then(a.key.cmp(&b.key)));
        out
    }

    /// Groups components by the liquid phase they are in (the phases are the liquid-liquid equilibrium's, `phase_flash`).
    pub(crate) fn group_by_phase(&self, comps: Vec<VleComp>) -> Vec<VlePhase> {
        let mut phases: Vec<VlePhase> = Vec::new();
        for c in comps {
            let idx = match phases.iter().position(|p| p.index == c.phase) {
                Some(i) => i,
                None => {
                    phases.push(VlePhase { comps: Vec::new(), aqueous: false, index: c.phase });
                    phases.len() - 1
                }
            };
            if c.key == AQUEOUS_SOLVENT {
                phases[idx].aqueous = true;
            }
            phases[idx].comps.push(c);
        }
        phases
    }

    pub(crate) fn vle_phases(&self, _t_k: f64) -> Vec<VlePhase> {
        self.group_by_phase(self.vle_components())
    }

    /// The liquid phase that holds most of `key` (0 when none does).
    pub(crate) fn phase_of_key(&self, key: &str) -> usize {
        let mut best = 0;
        let mut best_n = -1.0;
        for (p, m) in self.liquid_maps().enumerate() {
            let n = m.get(key).copied().unwrap_or(0.0);
            if n > best_n {
                best_n = n;
                best = p;
            }
        }
        best
    }

    /// The molecular composition of a vapour-liquid phase: its volatile components at their trial amounts plus the other
    /// molecules of the same liquid phase (non-volatile solutes) at their amounts; (molecules, amounts, position of each
    /// of `ph.comps` in that list).
    fn phase_molecules(&self, ph: &VlePhase) -> (Vec<Arc<crate::molecule::Molecule>>, Vec<f64>, Vec<Option<usize>>) {
        let mut mols: Vec<Arc<crate::molecule::Molecule>> = Vec::new();
        let mut amounts: Vec<f64> = Vec::new();
        let mut pos: Vec<Option<usize>> = Vec::new();
        for c in &ph.comps {
            match self.molecule(&c.key) {
                Some(m) => {
                    pos.push(Some(mols.len()));
                    mols.push(m);
                    amounts.push(c.mol);
                }
                None => pos.push(None),
            }
        }
        let map = if ph.index == 0 { Some(&self.species_mol) } else { self.extra_liquids.get(ph.index - 1) };
        if let Some(map) = map {
            for (k, &v) in map {
                if v > MIN_AMOUNT_MOL && !ph.comps.iter().any(|c| c.key == *k) {
                    if let Some(m) = self.molecule(k).filter(|m| m.partitionable()) {
                        mols.push(m);
                        amounts.push(v);
                    }
                }
            }
        }
        (mols, amounts, pos)
    }

    /// Total amount (mol) of the molecules of a phase: the mole-fraction basis of its activities.
    pub(crate) fn phase_total_mol(&self, ph: &VlePhase) -> f64 {
        self.phase_molecules(ph).1.iter().sum::<f64>().max(1e-300)
    }

    /// ln gamma of the volatile components of a phase (pure-liquid reference): the molecular activity model of
    /// `molecule::Mixture` (UNIFAC over the components that have groups, ideal and labelled for the rest, measured-activity
    /// corrections), with the ionic water activity and the salting-out added in the phase that holds the electrolytes.
    pub(crate) fn phase_ln_gamma(&self, ph: &VlePhase, t_k: f64) -> Vec<f64> {
        let (mols, amounts, pos) = self.phase_molecules(ph);
        let mut out = vec![0.0; ph.comps.len()];
        if mols.is_empty() {
            return out;
        }
        let mix = crate::molecule::Mixture::new(mols, t_k);
        let env = if ph.index == 0 { self.ion_env() } else { None };
        let lg = mix.ln_gamma(&amounts, env.as_ref());
        for (i, p) in pos.iter().enumerate() {
            if let Some(k) = p {
                out[i] = lg[*k];
            }
        }
        out
    }

    /// Partial pressures (Pa) `x_i gamma_i Psat_i(T)` above the liquid phases, one per component, plus their sum.
    pub(crate) fn phase_partials(&self, phases: &[VlePhase], t_k: f64) -> (Vec<Vec<f64>>, f64) {
        let mut all = Vec::with_capacity(phases.len());
        let mut gas_partials: HashMap<String, f64> = HashMap::new();
        for ph in phases {
            let tot: f64 = self.phase_total_mol(ph);
            let lg = self.phase_ln_gamma(ph, t_k);
            let mut row = Vec::with_capacity(ph.comps.len());
            for (i, c) in ph.comps.iter().enumerate() {
                let tc = c.vol.tc_k();
                let p = if tc.map_or(false, |tc| t_k >= tc) {
                    0.0 // above its critical temperature a component is not a liquid
                } else {
                    let act = (c.mol / tot.max(1e-300) * lg[i].exp()).min(1.0);
                    act * c.vol.psat_pa(t_k)
                };
                let entry = gas_partials.entry(c.vol.gas_id.clone()).or_insert(0.0);
                *entry = entry.max(p);
                row.push(p);
            }
            all.push(row);
        }
        let sum: f64 = gas_partials.values().sum();
        (all, sum)
    }

    /// Total vapour pressure (Pa) of the liquid at `t_k`.
    pub fn liquid_vapour_pressure_pa(&self, t_k: f64) -> f64 {
        let phases = self.vle_phases(t_k);
        self.phase_partials(&phases, t_k).1
    }

    /// Bubble point (K) of the current liquid at pressure `p_pa`: where the sum of the partial pressures reaches it.
    pub fn bubble_point_k(&self, p_pa: f64) -> Option<f64> {
        let phases = self.vle_phases(self.temperature_k);
        if phases.is_empty() {
            return None;
        }
        Some(self.bubble_point_of(&phases, p_pa))
    }

    pub(crate) fn bubble_point_of(&self, phases: &[VlePhase], p_pa: f64) -> f64 {
        let mut hi = 1500.0f64;
        for ph in phases {
            for c in &ph.comps {
                if let Some(tc) = c.vol.tc_k() {
                    hi = hi.min(tc * 0.9999);
                }
            }
        }
        let mut lo = 100.0;
        if self.phase_partials(phases, hi).1 < p_pa {
            return hi; // no vapour-liquid boundary at this pressure for the lightest critical point: supercritical limit
        }
        for _ in 0..70 {
            let mid = 0.5 * (lo + hi);
            if self.phase_partials(phases, mid).1 < p_pa {
                lo = mid;
            } else {
                hi = mid;
            }
            if hi - lo < 1e-7 {
                break;
            }
        }
        0.5 * (lo + hi)
    }

    /// Composition (mole fractions of the vapour in equilibrium at the bubble point of the current liquid at `p_pa`):
    /// (T_bubble, [(gas id, y)]).
    pub fn bubble_point_vapour(&self, p_pa: f64) -> Option<(f64, Vec<(String, f64)>)> {
        let phases = self.vle_phases(self.temperature_k);
        if phases.is_empty() {
            return None;
        }
        let tb = self.bubble_point_of(&phases, p_pa);
        let (parts, sum) = self.phase_partials(&phases, tb);
        let mut y_map: HashMap<String, f64> = HashMap::new();
        for (ph, row) in phases.iter().zip(&parts) {
            for (c, &p) in ph.comps.iter().zip(row) {
                let entry = y_map.entry(c.vol.gas_id.clone()).or_insert(0.0);
                *entry = entry.max(p / sum.max(1e-300));
            }
        }
        let mut y: Vec<(String, f64)> = y_map.into_iter().collect();
        y.sort_by(|a, b| a.0.cmp(&b.0));
        Some((tb, y))
    }

    // ------------------------------------------------------------------------------------------------ transfer helpers
    fn surface_area_m2(&self) -> f64 {
        std::f64::consts::PI * (self.config.inner_radius_cm / 100.0).powi(2)
    }

    /// Area (m2) a liquid of `volume_ml` covers: the vessel's cross-section, or less for a thin film.
    fn wetted_area_m2(&self, volume_ml: f64) -> f64 {
        let full_cm2 = self.surface_area_m2() * 1e4;
        (volume_ml / MIN_FILM_CM).min(full_cm2) * 1e-4
    }

    fn record_boil_flag(&mut self, key: &str) -> bool {
        let flags = self.ev.phase.entry(key.to_string()).or_insert(0);
        let first = *flags & F_BOILING == 0;
        *flags |= F_BOILING;
        first
    }

    fn book_vapour_out(&mut self, vol: &Volatile, mol: f64) {
        if mol <= 0.0 {
            return;
        }
        self.mass_lost_g += mol * vol.mw;
        self.ledger.book_out(&vol.id, mol);
    }

    // ------------------------------------------------------------------------------------------------ open vessel: boiling
    /// Boils off the heat above the bubble point (open vessel). `cp_total` is the heat capacity (J/K) of the contents.
    pub(crate) fn step_boil_open(&mut self, dt_s: f64, cp_total: f64) {
        if self.sealed {
            return;
        }
        let p_ext = self.p_ext_pa();
        let mut boiled: HashMap<String, (f64, Arc<Volatile>)> = HashMap::new();
        let mut t_boil_last = self.temperature_k;
        for _ in 0..60 {
            let t = self.temperature_k;
            let phases = self.vle_phases(t);
            if phases.is_empty() {
                break;
            }
            if self.phase_partials(&phases, t).1 <= p_ext {
                break;
            }
            let tb = self.bubble_point_of(&phases, p_ext);
            let e = (t - tb) * cp_total;
            if e <= 1e-9 {
                break;
            }
            t_boil_last = tb;
            let (parts, sum) = self.phase_partials(&phases, tb);
            // heat per mole of vapour of the equilibrium composition (latent heat minus partial excess enthalpy in liquid)
            let mut latent = 0.0;
            for (ph, row) in phases.iter().zip(&parts) {
                let map = if ph.index == 0 { Some(&self.species_mol) } else { self.extra_liquids.get(ph.index - 1) };
                for (c, p) in ph.comps.iter().zip(row) {
                    let h_ex = map.map_or(0.0, |m| self.partial_excess_enthalpy(m, &c.key, tb));
                    latent += p / sum.max(1e-300) * (c.vol.latent_heat_j_mol(tb) - h_ex);
                }
            }
            if latent <= 1.0 {
                break;
            }
            let n_liquid: f64 = phases.iter().flat_map(|p| p.comps.iter()).map(|c| c.mol).sum();
            // boil in chunks of at most a tenth of the liquid so the vapour composition follows the changing liquid
            // (distillation), but never leave heat unspent while the last of it is going
            let want = e / latent;
            let dn = if want >= n_liquid { n_liquid } else { want.min(0.1 * n_liquid) };
            if dn <= 0.0 {
                break;
            }
            for (ph, row) in phases.iter().zip(&parts) {
                for (c, p) in ph.comps.iter().zip(row) {
                    let take = (dn * p / sum.max(1e-300)).min(c.mol);
                    if take <= 0.0 {
                        continue;
                    }
                    self.take_from_phase(c.phase, &c.key, take);
                    boiled.entry(c.key.clone()).or_insert_with(|| (0.0, c.vol.clone())).0 += take;
                }
            }
            self.temperature_k -= dn * latent / cp_total.max(1.0);
        }
        let mut total_vol_ml = 0.0;
        let mut total_mass = 0.0;
        let mut events: Vec<(String, Arc<Volatile>, bool, f64)> = Vec::new();
        let mut keys: Vec<String> = boiled.keys().cloned().collect();
        keys.sort();
        for key in keys {
            let (mol, vol) = boiled[&key].clone();
            self.book_vapour_out(&vol, mol);
            let vol_ml = mol * R_GAS * t_boil_last / p_ext * 1e6;
            total_vol_ml += vol_ml;
            total_mass += mol * vol.mw;
            self.gas_fluxes.push(GasFlux {
                species: vol.gas_id.clone(),
                rate_ml_s: vol_ml / dt_s,
                bubble_diameter_mm: self.bubble_diameter_mm("bulk"),
                nucleation: "bulk".to_string(),
                origin: Some("boil".to_string()),
            });
            let first = self.record_boil_flag(&key);
            let gone = self.liquid_total(&key) <= 1e-5;
            events.push((key, vol, first, if gone { 1.0 } else { 0.0 }));
        }
        self.boil_vapour_ml_s += total_vol_ml / dt_s;
        self.boil_mass_g_s += total_mass / dt_s;
        for (key, vol, first, gone) in events {
            if first {
                self.push_event_full(VesselEventKind::TemperatureChange, format!("{} boiling at {:.1} °C", vol.name, t_boil_last - 273.15), 0.5, Some(key.clone()), None);
            }
            if gone > 0.0 {
                self.push_event_full(VesselEventKind::DryOut, format!("{} boiled off", vol.name), 0.8, Some(key.clone()), None);
                self.ev.phase.entry(key).and_modify(|f| *f &= !F_BOILING);
            }
        }
        // boiling stopped: allow announcing it again
        let live: Vec<String> = self.gas_fluxes.iter().filter_map(|g| self.volatile_for_gas(&g.species).map(|v| v.id.clone())).collect();
        let live_ids = live;
        for (sp, flags) in self.ev.phase.iter_mut() {
            if *flags & F_BOILING != 0 && !live_ids.contains(sp) {
                *flags &= !F_BOILING;
            }
        }
    }

    // ------------------------------------------------------------------------------------------------ open vessel: evaporation
    /// Evaporation (or condensation) of every volatile component toward the atmosphere's partial pressure of its vapour.
    pub(crate) fn step_evaporation_open(&mut self, dt_s: f64, cp_total: f64) {
        self.evaporation_g_s = 0.0;
        if self.sealed {
            return;
        }
        let t = self.temperature_k;
        let phases = self.vle_phases(t);
        let p_ext = self.p_ext_pa();
        let (parts, sum) = self.phase_partials(&phases, t);
        if !phases.is_empty() && sum > 0.9999 * p_ext {
            return; // at the bubble point boiling handles it
        }
        let area = self.wetted_area_m2(self.total_liquid_volume_ml());
        let atm = self.atmosphere_partials();
        let mut heat = 0.0;
        let mut evap_mass = 0.0;
        // sublimation: a solid exposes its vapour pressure `a_sat(T) P_sat(T)` to the atmosphere
        let solids: Vec<(String, f64)> = self.solid_mol.iter().filter(|(_, v)| **v > 1e-18).map(|(k, v)| (k.clone(), *v)).collect();
        for (sk, n_s) in solids {
            let Some((vol, p_surface)) = self.solid_vapour_pressure_pa(&sk, t) else { continue };
            let p_inf = atm.iter().find(|(k, _)| *k == vol.gas_id).map(|(_, p)| *p).unwrap_or(0.0);
            let props = self.solid_props(&sk);
            let solid_ml = n_s * vol.mw / props.density_g_ml.max(0.1);
            let a_s = self.wetted_area_m2(solid_ml);
            let flux = self.vapour_flux_mol_s(&vol.id, vol.mw, p_surface, p_inf, a_s, t);
            let dn = (flux * dt_s).min(n_s);
            if dn <= 1e-18 {
                continue; // a solid does not take up vapour from the air here
            }
            if let Some(v) = self.solid_mol.get_mut(&sk) {
                *v = (*v - dn).max(0.0);
            }
            self.solid_mol.retain(|_, v| *v > 0.0);
            self.mass_lost_g += dn * vol.mw;
            self.ledger.book_out(&vol.id, dn);
            evap_mass += dn * vol.mw;
            // latent heat of sublimation: fusion plus vaporisation
            let dh_sub = vol.latent_heat_j_mol(t) + self.molecule(&vol.id).map_or(0.0, |m| m.dh_dissolve_ideal(t));
            heat += dn * dh_sub;
        }
        for (ph, row) in phases.iter().zip(&parts) {
            let map = if ph.index == 0 { self.species_mol.clone() } else { self.extra_liquids.get(ph.index - 1).cloned().unwrap_or_default() };
            for (c, p_surface) in ph.comps.iter().zip(row) {
                let p_inf = atm.iter().find(|(k, _)| *k == c.vol.gas_id).map(|(_, p)| *p).unwrap_or(0.0);
                let flux = self.vapour_flux_mol_s(&c.vol.id, c.vol.mw, *p_surface, p_inf, area, t);
                let mut dn = flux * dt_s;
                if dn > 0.0 {
                    dn = dn.min(c.mol);
                } else {
                    dn = dn.max(-c.mol); // condensation from humid air, never more than doubles the component
                }
                if dn.abs() < 1e-18 {
                    continue;
                }
                if dn > 0.0 {
                    self.take_from_phase(c.phase, &c.key, dn);
                } else {
                    // condensation from humid air joins the phase the component is in
                    let m = if c.phase == 0 { &mut self.species_mol } else { &mut self.extra_liquids[c.phase - 1] };
                    *m.entry(c.key.clone()).or_default() += -dn;
                }
                if dn > 0.0 {
                    self.mass_lost_g += dn * c.vol.mw;
                    self.ledger.book_out(&c.vol.id, dn);
                    evap_mass += dn * c.vol.mw;
                } else {
                    self.mass_lost_g += dn * c.vol.mw;
                    self.ledger.book_in(&c.vol.id, -dn);
                }
                let h_ex = self.partial_excess_enthalpy(&map, &c.key, t);
                heat += dn * (c.vol.latent_heat_j_mol(t) - h_ex);
            }
        }
        self.evaporation_g_s = evap_mass / dt_s;
        if heat != 0.0 {
            self.temperature_k -= heat / cp_total.max(1.0);
        }
    }

    /// Sublimation in a sealed vessel: every solid with a vapour pressure `a_sat(T) P_sat(T)` exchanges vapour with the
    /// headspace until the partial pressure equals it (or the solid is gone), with the latent heat of sublimation.
    pub(crate) fn step_sealed_sublimation(&mut self, cp_total: f64) {
        if !self.sealed {
            return;
        }
        let t = self.temperature_k;
        let v_g = self.headspace_volume_m3();
        let solids: Vec<(String, f64)> = self.solid_mol.iter().filter(|(_, v)| **v > 1e-18).map(|(k, v)| (k.clone(), *v)).collect();
        let mut heat = 0.0;
        for (sk, n_s) in solids {
            let Some((vol, p_surface)) = self.solid_vapour_pressure_pa(&sk, t) else { continue };
            let n_eq = p_surface * v_g / (R_GAS * t);
            let n_cur = self.headspace_gas_mol.get(&vol.gas_id).copied().unwrap_or(0.0);
            let dn = (n_eq - n_cur).clamp(-n_cur, n_s);
            if dn.abs() <= 1e-18 {
                continue;
            }
            if let Some(v) = self.solid_mol.get_mut(&sk) {
                *v = (*v - dn).max(0.0);
            }
            self.solid_mol.retain(|_, v| *v > 1e-18);
            let g = self.headspace_gas_mol.entry(vol.gas_id.clone()).or_insert(0.0);
            *g = (*g + dn).max(0.0);
            let dh_sub = vol.latent_heat_j_mol(t) + self.molecule(&vol.id).map_or(0.0, |m| m.dh_dissolve_ideal(t));
            heat += dn * dh_sub;
        }
        if heat != 0.0 {
            self.temperature_k -= heat / cp_total.max(1.0);
        }
    }

    // ------------------------------------------------------------------------------------------------ dissolved gases
    /// Henry exchange of every dissolved gas with the gas phase (atmosphere or headspace) plus bubble release of
    /// supersaturated gas. Returns the heat (J) delivered to the solution (negative when gas leaves it).
    pub(crate) fn step_gas_exchange(&mut self, dt_s: f64) -> f64 {
        let n_h2o = self.species_mol.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0);
        if n_h2o <= MIN_AQUEOUS_H2O_MOL {
            return 0.0;
        }
        let kg_w = n_h2o * 0.018_015_28;
        let t = self.temperature_k;
        // candidate gases: dissolved Henry species present, plus the gases of the gas phase that have an aqueous twin
        let mut species: BTreeSet<String> = BTreeSet::new();
        let mut twins: Vec<vle::HenrySpecies> = Vec::new();
        let consider = |h: vle::HenrySpecies, species: &mut BTreeSet<String>, twins: &mut Vec<vle::HenrySpecies>| {
            if species.insert(h.aq_id.clone()) {
                twins.push(h);
            }
        };
        let keys: Vec<String> = self.species_mol.keys().cloned().collect();
        for k in &keys {
            if k.ends_with("(l)") || k.ends_with("(s)") {
                continue;
            }
            if let Some(h) = self.henry_for_aq(k) {
                consider(h, &mut species, &mut twins);
            }
        }
        let gas_ids: Vec<String> = if self.sealed {
            self.headspace_gas_mol.keys().cloned().collect()
        } else {
            self.atmosphere.composition.iter().map(|(k, _)| k.clone()).collect()
        };
        for g in &gas_ids {
            if let Some(h) = self.henry_for_gas(g) {
                consider(h, &mut species, &mut twins);
            }
        }
        if twins.is_empty() {
            return 0.0;
        }

        let ionic = self.ionic_strength_molal();
        let ln_gamma = 0.1 * ionic * std::f64::consts::LN_10; // Setschenow salting-out of a neutral solute
        let aq_ml = self.aqueous_volume_ml().max(1e-6);
        let depth_m = (aq_ml / (self.surface_area_m2() * 1e6)).max(1e-4);
        let hyd = self.hydro_state();
        let p_ext = self.p_ext_pa();
        let phases = self.vle_phases(t);
        let p_liq = self.phase_partials(&phases, t).1;
        let head_v_m3 = ((self.config.capacity_ml - self.total_liquid_volume_ml()).max(10.0)) * 1e-6;
        let atm = if self.sealed { Vec::new() } else { self.atmosphere_partials() };

        struct Item {
            h: vle::HenrySpecies,
            k: f64,
            n_aq: f64,
            p_eq_pa: f64,
        }
        let mut items: Vec<Item> = Vec::new();
        for h in twins {
            let k = vle::henry_k_mol_kg_bar(&h.aq_id, &h.gas_id, t);
            let n_aq = self.species_mol.get(&h.aq_id).copied().unwrap_or(0.0).max(0.0);
            let m = n_aq / kg_w;
            let p_eq_bar = m * ln_gamma.exp() / k.max(1e-300);
            items.push(Item { h, k, n_aq, p_eq_pa: p_eq_bar * vle::P_BAR_PA });
        }
        // bubble release: the dissolved-gas tension plus the liquid's own vapour pressure exceeds the ambient pressure
        let tension: f64 = items.iter().map(|i| i.p_eq_pa).sum();
        let p_ambient = if self.sealed { self.pressure_atm * ATM_PA } else { p_ext };
        let supersat = tension > 0.0 && p_liq + tension > p_ambient && !self.sealed;
        let bubble_factor = if supersat { ((p_ambient - p_liq).max(0.0) / tension).clamp(0.0, 1.0) } else { 1.0 };

        let mut heat = 0.0;
        let mut bubbled_ml = 0.0;
        let r_m = self.config.inner_radius_cm.max(0.2) * 1e-2;
        let liq_h_m = aq_ml * 1e-6 / (std::f64::consts::PI * r_m * r_m);
        let wall_area = 2.0 * std::f64::consts::PI * r_m * liq_h_m + std::f64::consts::PI * r_m * r_m;
        let solid_area: f64 = self.particle_populations.values().map(|p| p.surface_area_m2()).sum();
        let sigma = crate::transfer::hydro::water_surface_tension_n_m(t);
        for it in items {
            let gas_id = it.h.gas_id.clone();
            let diff = crate::transfer::diffusion::species_diffusivity_water_m2_s(&it.h.aq_id, t);
            let lam_surface = crate::transfer::hydro::gas_liquid_kl(diff, hyd.nu, hyd.eps, depth_m) / depth_m;
            let tension_ratio = if self.sealed { it.p_eq_pa / p_ambient.max(1.0) } else { (p_liq + tension) / p_ambient.max(1.0) };
            let lam_bubble = crate::transfer::gas_transfer::bubble_release_rate_per_s(tension_ratio, p_ambient, wall_area, solid_area, hyd.liquid_m3, liq_h_m, it.k * 8.314_462_618 * t * 0.01, diff, hyd.rho_l, hyd.eta, sigma);
            // equilibrium target of the dissolved amount against the gas phase
            let exp_g = (-ln_gamma).exp();
            let n_target = if self.sealed {
                let n_g = self.headspace_gas_mol.get(&gas_id).copied().unwrap_or(0.0);
                let total = n_g + it.n_aq;
                let a = it.k * kg_w * exp_g * R_GAS * t / (head_v_m3 * vle::P_BAR_PA);
                total * a / (1.0 + a)
            } else {
                let p_inf_bar = atm.iter().find(|(k, _)| *k == gas_id).map(|(_, p)| *p).unwrap_or(0.0) / vle::P_BAR_PA;
                it.k * kg_w * exp_g * p_inf_bar
            };
            // the surface exchanges the gas toward its equilibrium with the atmosphere (in either direction); bubbles, where the
            // liquid is supersaturated, take gas out on top of that, in proportion to what each gas has dissolved. The two add:
            // a gas far below saturation (CO2 in a sodium hydroxide solution) still absorbs while the liquid fizzes with the
            // others, and a gas above its target never goes below the lower of the two targets.
            let mut n_new = it.n_aq + (n_target - it.n_aq) * (1.0 - (-lam_surface * dt_s).exp());
            let mut bubbling = false;
            if supersat && bubble_factor < 1.0 {
                let n_bub = it.n_aq * bubble_factor;
                let via_bubbles = it.n_aq + (n_bub - it.n_aq) * (1.0 - (-lam_bubble * dt_s).exp());
                let loss = via_bubbles - it.n_aq; // <= 0
                if loss < -1e-18 {
                    n_new = (n_new + loss).max(n_target.min(n_bub).min(it.n_aq));
                    bubbling = n_new < it.n_aq;
                }
            }
            if self.sealed && it.p_eq_pa > p_ambient {
                // supersaturated against the headspace: bubbles
                let via = it.n_aq + (n_target - it.n_aq) * (1.0 - (-lam_bubble * dt_s).exp());
                if via < n_new {
                    n_new = via;
                    bubbling = true;
                }
            }
            let delta = n_new - it.n_aq; // + dissolving, - degassing
            if delta.abs() < 1e-18 {
                continue;
            }
            if delta > 0.0 {
                // absorption: sealed takes it from the headspace, open takes it from the atmosphere
                let avail = if self.sealed { self.headspace_gas_mol.get(&gas_id).copied().unwrap_or(0.0) } else { f64::INFINITY };
                let d = delta.min(avail);
                if d <= 0.0 {
                    continue;
                }
                *self.species_mol.entry(it.h.aq_id.clone()).or_default() += d;
                self.ledger.book_in(&it.h.aq_id, d);
                if !self.sealed {
                    // dissolved from the open atmosphere: gas drawn in is a negative loss
                    self.mass_lost_g -= d * it.h.mw;
                }
                if self.sealed {
                    let g = self.headspace_gas_mol.entry(gas_id.clone()).or_default();
                    *g -= d;
                    self.ledger.book_out(&gas_id, d);
                    if *g <= 1e-18 {
                        self.headspace_gas_mol.remove(&gas_id);
                    }
                }
                heat += d * (-vle::henry_dh_dissolve_j_mol(&it.h.aq_id, &gas_id, t));
            } else {
                let d = (-delta).min(it.n_aq);
                let m = self.species_mol.entry(it.h.aq_id.clone()).or_default();
                *m = (*m - d).max(0.0);
                if *m <= 1e-18 {
                    self.species_mol.remove(&it.h.aq_id);
                }
                self.ledger.book_out(&it.h.aq_id, d);
                if self.sealed {
                    *self.headspace_gas_mol.entry(gas_id.clone()).or_default() += d;
                    self.ledger.book_in(&gas_id, d);
                } else {
                    self.mass_lost_g += d * it.h.mw;
                    if bubbling {
                        let vol_ml = d * R_GAS * t / p_ext.max(1.0) * 1e6;
                        bubbled_ml += vol_ml;
                        self.gas_fluxes.push(GasFlux {
                            species: gas_id.clone(),
                            rate_ml_s: vol_ml / dt_s,
                            bubble_diameter_mm: self.bubble_diameter_mm("wall"),
                            nucleation: "bulk".to_string(),
                            origin: None,
                        });
                    }
                }
                heat += -d * -vle::henry_dh_dissolve_j_mol(&it.h.aq_id, &gas_id, t);
            }
        }
        let _ = bubbled_ml;
        heat
    }

    /// Molal ionic strength of the aqueous solution (mol / kg water).
    pub(crate) fn ionic_strength_molal(&self) -> f64 {
        let kg = self.species_mol.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0) * 0.018_015_28;
        if kg <= 0.0 {
            return 0.0;
        }
        let mut s = 0.0;
        for (sp, &mol) in &self.species_mol {
            if mol <= 0.0 || sp.ends_with("(l)") || sp.ends_with("(s)") || sp.ends_with("(g)") {
                continue;
            }
            let z = crate::ions::species_charge(sp) as f64;
            if z != 0.0 {
                s += mol / kg * z * z;
            }
        }
        0.5 * s
    }

    // ------------------------------------------------------------------------------------------------ sealed vessels
    /// Captures the atmosphere's gas in the headspace when the vessel is closed (at gas temperature `t_k`).
    pub(crate) fn seal_capture(&mut self, t_k: f64) {
        let head_m3 = ((self.config.capacity_ml - self.total_liquid_volume_ml()).max(10.0)) * 1e-6;
        let partials = self.atmosphere_partials();
        let mut baseline: HashMap<String, f64> = HashMap::new();
        for (id, p) in partials {
            let n = p * head_m3 / (R_GAS * t_k.max(1.0));
            if n > 0.0 {
                *self.headspace_gas_mol.entry(id.clone()).or_default() += n;
                self.ledger.book_in(&id, n);
                *baseline.entry(id).or_default() += n;
            }
        }
        self.gas.seal_baseline_mol = baseline;
    }

    /// Everything in the gas phase leaves (stopper removed or popped, glass burst).
    pub(crate) fn vent_headspace(&mut self) {
        // the air that was in the vessel when it was closed is not a loss of what was put in: only the gas beyond that baseline is
        let baseline = std::mem::take(&mut self.gas.seal_baseline_mol);
        for (sp, mol) in std::mem::take(&mut self.headspace_gas_mol) {
            let net = (mol - baseline.get(&sp).copied().unwrap_or(0.0)).max(0.0);
            self.mass_lost_g += net * crate::chem_db::get_species_thermo(&sp).mw;
            self.ledger.book_out(&sp, mol);
        }
    }

    /// Isochoric vapour-liquid flash of a sealed vessel with the latent heat coupled implicitly to the temperature
    /// (the vapour made at T cools the contents, which changes the vapour made: the fixed point is solved, not
    /// iterated tick by tick, so the stiff near-critical region does not oscillate). Returns the pressure in Pa.
    pub(crate) fn step_sealed_flash(&mut self, cp_total: f64) -> f64 {
        let t0 = self.temperature_k;
        let v_total = self.config.capacity_ml * 1e-6;
        let mut inp = match self.flash_inputs(t0) {
            Some(i) => i,
            None => {
                // no volatile liquid: the gas phase alone
                return self.gas_only_pressure(t0, v_total);
            }
        };
        let cp = cp_total.max(1.0);
        // residual g(T) = T0 - T - Q_latent(T)/Cp, decreasing in T; the root is the new temperature
        let mut guess = inp.n_gas0.clone();
        let (mut out0, mut q0);
        {
            let o = self.flash_at(&inp, t0, &guess, v_total);
            q0 = o.q_latent(&inp, t0);
            out0 = o;
        }
        let mut t_best = t0;
        let mut out_best = out0.clone();
        if (q0 / cp).abs() > 1e-4 {
            // secant / bisection on the temperature between T0 and the explicit estimate
            let mut ta = t0;
            let mut ga = 0.0 - q0 / cp; // g(T0)
            let mut tb = t0 - q0 / cp;
            guess = out0.n_gas.clone();
            let mut best_abs = f64::INFINITY;
            for _ in 0..14 {
                let o = self.flash_at(&inp, tb, &guess, v_total);
                let q = o.q_latent(&inp, tb);
                let gb = t0 - tb - q / cp;
                guess = o.n_gas.clone();
                if gb.abs() < best_abs {
                    best_abs = gb.abs();
                    t_best = tb;
                    out_best = o;
                }
                if gb.abs() < 1e-5 {
                    break;
                }
                let slope = (gb - ga) / (tb - ta);
                let next = if slope.abs() > 1e-12 { tb - gb / slope } else { tb - gb };
                // keep the iterate in a sane bracket (a hot vessel cannot drop by more than the latent heat allows)
                let next = next.clamp(t0 - 400.0, t0 + 400.0);
                ta = tb;
                ga = gb;
                tb = next;
            }
            out0 = out_best.clone();
            q0 = out0.q_latent(&inp, t_best);
            let _ = q0;
        }
        inp.t = t_best;
        // write back
        self.temperature_k = t_best;
        for (k, it) in inp.items.iter().enumerate() {
            let n_gas = out_best.n_gas[k];
            let n_liq = (it.n_tot - n_gas).max(0.0);
            let n_liq = if n_liq > MIN_AMOUNT_MOL { n_liq } else { 0.0 };
            if it.members.len() > 1 {
                // the neat liquid and the dissolved form of one molecule share what evaporated or condensed in proportion
                let f = if it.n_liq0 > 0.0 { n_liq / it.n_liq0 } else { 0.0 };
                for (k, a) in &it.members {
                    self.set_liquid_total(k, a * f);
                }
            } else {
                self.set_liquid_total(&it.key, n_liq);
            }
            if n_gas > MIN_AMOUNT_MOL {
                self.headspace_gas_mol.insert(it.vol.gas_id.clone(), n_gas);
            } else {
                self.headspace_gas_mol.remove(&it.vol.gas_id);
            }
        }
        let mut pressure = out_best.pressure_pa;
        // a liquid that fills the vessel is hydraulically over-pressured
        if out_best.v_liq > 0.995 * v_total {
            let kappa = 4.6e-10; // isothermal compressibility of a liquid, 1/Pa (water at 25 C)
            pressure += (out_best.v_liq - 0.995 * v_total) / (kappa * v_total);
        }
        pressure
    }

    fn gas_only_pressure(&self, t: f64, v_total: f64) -> f64 {
        let v_liq = self.total_liquid_volume_ml() * 1e-6;
        let v_g = (v_total - v_liq).max(0.005 * v_total);
        let gases: Vec<(String, f64)> = self.headspace_gas_mol.iter().filter(|(_, v)| **v > 0.0).map(|(k, v)| (k.clone(), *v)).collect();
        let mut comps = Vec::new();
        let mut ok = true;
        for (g, _) in &gases {
            match self.vle_cache.borrow_mut().gas_critical(g) {
                Some(c) => comps.push(c.pr()),
                None => ok = false,
            }
        }
        let n: Vec<f64> = gases.iter().map(|(_, v)| *v).collect();
        if ok && !comps.is_empty() {
            eos::pressure_tv(&comps, &n, t, v_g)
        } else {
            eos::ideal_pressure(n.iter().sum(), t, v_g)
        }
    }

    /// Everything the flash needs that does not depend on the temperature being solved for.
    fn flash_inputs(&self, t: f64) -> Option<FlashInputs> {
        let mut items: Vec<FlashItem> = Vec::new();
        let mut keys: BTreeSet<String> = self.liquid_totals().keys().cloned().collect();
        for g in self.headspace_gas_mol.keys() {
            if let Some(v) = self.volatile_for_gas(g) {
                keys.insert(v.id.clone());
            }
        }
        let mut n_gas0 = Vec::new();
        for key in keys {
            let Some(vol) = self.volatile_for(&key) else { continue };
            let n_liq0 = self.liquid_total(&key);
            // another liquid key of a molecule already in the flash (same gas phase): one inventory, the gas counted once
            if let Some(it) = items.iter_mut().find(|it| it.vol.gas_id == vol.gas_id) {
                it.n_liq0 += n_liq0;
                it.n_tot += n_liq0;
                if n_liq0 > 0.0 {
                    it.members.push((key, n_liq0));
                }
                continue;
            }
            let n_gas = self.headspace_gas_mol.get(&vol.gas_id).copied().unwrap_or(0.0);
            if n_liq0 + n_gas <= MIN_AMOUNT_MOL {
                continue;
            }
            n_gas0.push(n_gas);
            let members = if n_liq0 > 0.0 { vec![(key.clone(), n_liq0)] } else { Vec::new() };
            items.push(FlashItem { vol, key, n_liq0, n_tot: n_liq0 + n_gas, members });
        }
        if items.is_empty() {
            return None;
        }
        let volatile_gas_ids: Vec<String> = items.iter().map(|i| i.vol.gas_id.clone()).collect();
        let others: Vec<(String, f64)> = self
            .headspace_gas_mol
            .iter()
            .filter(|(k, v)| **v > 0.0 && !volatile_gas_ids.contains(k))
            .map(|(k, v)| (k.clone(), *v))
            .collect();
        let mut pr_ok = true;
        let mut other_crit: Vec<PrComp> = Vec::new();
        for (g, _) in &others {
            match self.vle_cache.borrow_mut().gas_critical(g) {
                Some(c) => other_crit.push(c.pr()),
                None => pr_ok = false,
            }
        }
        if items.iter().any(|i| i.vol.crit.is_none()) {
            pr_ok = false;
        }
        let v_liq_now = self.total_liquid_volume_ml() * 1e-6;
        let v_vol_now: f64 = items.iter().map(|i| i.n_liq0 * i.vol.v_liquid_m3_mol(t)).sum();
        Some(FlashInputs { t, items, others, other_crit, pr_ok, v_liq_other: (v_liq_now - v_vol_now).max(0.0), n_gas0 })
    }

    /// Isothermal-isochoric equilibrium at temperature `t` (fixed-point on the vapour amounts of the volatile
    /// components, gamma-phi with Peng-Robinson fugacities).
    fn flash_at(&self, inp: &FlashInputs, t: f64, guess: &[f64], v_total: f64) -> FlashOut {
        let ni = inp.items.len();
        let supercritical: Vec<bool> = inp.items.iter().map(|i| i.vol.tc_k().map_or(false, |tc| t >= 0.9999 * tc)).collect();
        let mut gas_comps: Vec<PrComp> = Vec::new();
        if inp.pr_ok {
            for it in &inp.items {
                gas_comps.push(it.vol.crit.unwrap().pr());
            }
            gas_comps.extend(inp.other_crit.iter().copied());
        }
        let mut n_gas: Vec<f64> = (0..ni).map(|k| if supercritical[k] { inp.items[k].n_tot } else { guess[k].clamp(0.0, inp.items[k].n_tot) }).collect();
        let mut pressure = 0.0;
        let mut v_liq = 0.0;
        for _iter in 0..120 {
            let n_liq: Vec<f64> = (0..ni).map(|k| (inp.items[k].n_tot - n_gas[k]).max(0.0)).collect();
            v_liq = inp.v_liq_other + (0..ni).map(|k| n_liq[k] * inp.items[k].vol.v_liquid_m3_mol(t)).sum::<f64>();
            let v_g = (v_total - v_liq).max(0.005 * v_total);
            let mut n_vec: Vec<f64> = n_gas.iter().map(|x| x.max(1e-300)).collect();
            n_vec.extend(inp.others.iter().map(|(_, v)| *v));
            let n_gas_tot: f64 = n_vec.iter().sum();
            let (p_gas, ln_phi) = if inp.pr_ok {
                let (_z, p, lp) = eos::ln_phi_tv(&gas_comps, &n_vec, t, v_g);
                (p, lp)
            } else {
                (eos::ideal_pressure(n_gas_tot, t, v_g), vec![0.0; n_vec.len()])
            };
            pressure = p_gas;
            // liquid phases with the trial amounts (a tiny seed amount lets a dry component dissolve into an existing phase)
            let comps: Vec<VleComp> = (0..ni)
                .filter(|k| !supercritical[*k])
                .map(|k| VleComp { vol: inp.items[k].vol.clone(), key: inp.items[k].key.clone(), mol: n_liq[k].max(1e-12 * inp.items[k].n_tot), phase: self.phase_of_key(&inp.items[k].key) })
                .collect();
            let phases = self.group_by_phase(comps);
            let mut f_liq: HashMap<String, f64> = HashMap::new();
            for ph in &phases {
                let tot: f64 = self.phase_total_mol(ph);
                let lg = self.phase_ln_gamma(ph, t);
                for (c, l) in ph.comps.iter().zip(lg) {
                    let psat = c.vol.psat_pa(t);
                    let x = c.mol / tot.max(1e-300);
                    let ln_phi_sat = match c.vol.crit {
                        Some(cr) if inp.pr_ok => c.vol.ln_phi_saturation(cr, t, psat),
                        _ => 0.0,
                    };
                    let poy = (c.vol.v_liquid_m3_mol(t) * (p_gas - psat) / (R_GAS * t)).clamp(-2.0, 5.0);
                    f_liq.insert(c.key.clone(), x * (l + ln_phi_sat + poy).exp() * psat);
                }
            }
            let mut worst: f64 = 0.0;
            for k in 0..ni {
                if supercritical[k] {
                    n_gas[k] = inp.items[k].n_tot;
                    continue;
                }
                let Some(&fl) = f_liq.get(&inp.items[k].key) else { continue };
                let y = n_gas[k].max(1e-300) / n_gas_tot;
                let fg = y * ln_phi[k].exp() * p_gas;
                let target = if n_gas[k] <= 1e-290 { fl * v_g / (R_GAS * t) } else { n_gas[k] * (fl / fg.max(1e-300)).powf(0.9) };
                let new_gas = target.clamp(0.0, inp.items[k].n_tot);
                if new_gas < inp.items[k].n_tot && new_gas > 0.0 {
                    worst = worst.max((fl / fg.max(1e-300)).ln().abs());
                } else {
                    worst = worst.max((new_gas - n_gas[k]).abs() / inp.items[k].n_tot.max(1e-300));
                }
                n_gas[k] = new_gas;
            }
            if worst < 1e-9 {
                break;
            }
        }
        FlashOut { n_gas, pressure_pa: pressure, v_liq }
    }

    // ------------------------------------------------------------------------------------------------ gas dosing
    /// Adds `mol` of a gas: into the headspace of a sealed vessel, or sparged through the liquid of an open one
    /// (part of it comes to Henry equilibrium with the liquid, the rest leaves).
    pub fn dose_gas(&mut self, gas_id: &str, mol: f64) {
        if mol <= 0.0 {
            return;
        }
        if self.sealed {
            *self.headspace_gas_mol.entry(gas_id.to_string()).or_default() += mol;
            self.ledger.book_in(gas_id, mol);
            return;
        }
        let t = self.temperature_k;
        let n_h2o = self.species_mol.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0);
        let mut dissolved = 0.0;
        if n_h2o > MIN_AQUEOUS_H2O_MOL {
            if let Some(h) = self.henry_for_gas(gas_id) {
                let kg_w = n_h2o * 0.018_015_28;
                let k = vle::henry_k_mol_kg_bar(&h.aq_id, gas_id, t);
                let ln_gamma = 0.1 * self.ionic_strength_molal() * std::f64::consts::LN_10;
                // pure gas bubbles at the ambient pressure saturate the liquid
                let n_sat = k * kg_w * (-ln_gamma).exp() * self.p_ext_pa() / vle::P_BAR_PA;
                let n_now = self.species_mol.get(&h.aq_id).copied().unwrap_or(0.0);
                dissolved = (mol * SPARGE_EFFICIENCY).min((n_sat - n_now).max(0.0));
                if dissolved > 0.0 {
                    *self.species_mol.entry(h.aq_id.clone()).or_default() += dissolved;
                    self.ledger.book_in(&h.aq_id, dissolved);
                    let heat = dissolved * (-vle::henry_dh_dissolve_j_mol(&h.aq_id, gas_id, t));
                    let cp = (self.contents_heat_capacity() + self.glass_heat_capacity()).max(1.0);
                    self.temperature_k += heat / cp;
                }
            }
            let rest = mol - dissolved;
            if rest > 0.0 {
                let vol_ml = rest * R_GAS * t / self.p_ext_pa().max(1.0) * 1e6;
                self.gas_fluxes.push(GasFlux {
                    species: gas_id.to_string(),
                    rate_ml_s: vol_ml / 0.1,
                    bubble_diameter_mm: self.bubble_diameter_mm("wall"),
                    nucleation: "bulk".to_string(),
                    origin: None,
                });
            }
        }
        // whatever did not dissolve leaves into the room; it was never booked in
    }

    // ------------------------------------------------------------------------------------------------ reporting
    pub(crate) fn gas_phase_info(&self) -> GasPhaseInfo {
        let t = self.temperature_k;
        // one fluid: a component of the gas phase that is above its own critical temperature
        let supercritical = self.sealed
            && self.headspace_gas_mol.iter().any(|(g, &mol)| {
                mol > 1e-9 && self.volatile_for_gas(g).map_or(false, |v| v.tc_k().map_or(false, |tc| t >= tc))
            });
        if !self.sealed {
            let partials = self.atmosphere_partials();
            let total: f64 = partials.iter().map(|(_, p)| *p).sum();
            return GasPhaseInfo {
                kind: "atmosphere".to_string(),
                pressure_atm: self.p_ext_atm(),
                temperature_k: self.room_k,
                supercritical: false,
                eos: "ideal".to_string(),
                species: partials
                    .into_iter()
                    .map(|(species, p)| GasPhaseSpecies { species, mol: 0.0, mole_fraction: p / total.max(1e-300), partial_atm: p / ATM_PA })
                    .collect(),
            };
        }
        let n_tot: f64 = self.headspace_gas_mol.values().sum();
        let p = self.pressure_atm;
        let mut species: Vec<GasPhaseSpecies> = self
            .headspace_gas_mol
            .iter()
            .filter(|(_, v)| **v > 0.0)
            .map(|(k, v)| GasPhaseSpecies { species: k.clone(), mol: *v, mole_fraction: v / n_tot.max(1e-300), partial_atm: p * v / n_tot.max(1e-300) })
            .collect();
        species.sort_by(|a, b| b.mol.partial_cmp(&a.mol).unwrap_or(std::cmp::Ordering::Equal).then(a.species.cmp(&b.species)));
        let all_pr = self.headspace_gas_mol.keys().all(|g| {
            self.volatile_for_gas(g).map_or(false, |v| v.crit.is_some()) || self.vle_cache.borrow_mut().gas_critical(g).is_some()
        });
        GasPhaseInfo {
            kind: "sealed".to_string(),
            pressure_atm: p,
            temperature_k: t,
            supercritical,
            eos: if all_pr { "peng-robinson" } else { "ideal" }.to_string(),
            species,
        }
    }
}
