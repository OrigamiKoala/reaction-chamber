//! Gas collection: delivery-tube links between a (stoppered) source vessel and a collector vessel.
//!
//! Gas evolved in a sealed vessel accumulates in its headspace (`headspace_gas_mol`). A *link* (delivery tube) lets that
//! gas flow into a collector (gas syringe / gas collection tube over water / gas jar) instead of building pressure. The
//! transfer conserves moles exactly: `moles removed from the source headspace == moles added to the collector`, except
//! what a full collector pushes out into the room (`escaped_mol`), which is tracked so the books always balance.
//!
//! Collector volumes use the ideal gas law at the collector's own temperature (lab temperature) and ambient pressure;
//! over water the dry-gas partial pressure is `P - p_sat(H2O)` so the reading includes the water vapour, as in a real
//! eudiometer.

use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::db::seed_vle::OVER_WATER_SEAL_LIQUID;
use crate::vessel::Vessel;

/// J / (mol K)
pub const R_GAS: f64 = crate::physics::R_GAS;
/// Pa per atm.
pub const ATM_PA: f64 = 101325.0;
/// Relaxation time (s) of the source pressure through the delivery tube (flow ~ proportional to the excess pressure).
pub const TUBE_TAU_S: f64 = 0.08;
/// Pressure (atm) the source has to keep above ambient to push gas into a collector (plunger friction / water column).
pub const BACK_PRESSURE_ATM: f64 = 0.002;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CollectorKind {
    /// Gas syringe: the plunger floats, gas is held at ambient pressure.
    Syringe,
    /// Graduated tube inverted over water: the gas is saturated with water vapour.
    OverWater,
    /// Gas jar: gas displaces the air in the jar (dry), cover plate on top.
    Jar,
}

/// Which collector a vessel type is (None = an ordinary vessel).
pub fn collector_kind(vessel_type: &str) -> Option<CollectorKind> {
    if vessel_type.starts_with("gas-syringe") {
        Some(CollectorKind::Syringe)
    } else if vessel_type.starts_with("gas-collection-tube") {
        Some(CollectorKind::OverWater)
    } else if vessel_type.starts_with("gas-jar") {
        Some(CollectorKind::Jar)
    } else {
        None
    }
}

/// Collected-gas bookkeeping of one vessel.
#[derive(Clone, Debug, Default)]
pub struct GasState {
    /// Gas held by a collector (species id like "H2(g)" -> mol).
    pub collected_mol: HashMap<String, f64>,
    /// The atmosphere's gas captured in the headspace when the vessel was closed (species id -> mol): what is *not*
    /// evolved gas. `gas_info` reports the excess over it.
    pub seal_baseline_mol: HashMap<String, f64>,
    /// Gas a full collector pushed out into the room (mol).
    pub escaped_mol: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GasAmount {
    pub species: String,
    pub mol: f64,
}

/// What the snapshot reports about gas in a vessel. For a collector: the collected gas. For anything else: the evolved
/// gas trapped in the headspace of a sealed vessel.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GasInfo {
    /// "syringe" | "over_water" | "jar" for collectors, null for ordinary vessels.
    pub collector: Option<CollectorKind>,
    pub species: Vec<GasAmount>,
    pub total_mol: f64,
    /// Volume the gas occupies at the vessel's temperature and ambient pressure (mL).
    pub volume_ml: f64,
    /// Collector capacity (mL; 0 for ordinary vessels).
    pub capacity_ml: f64,
    /// Moles that did not fit and escaped into the room.
    pub escaped_mol: f64,
    /// Partial pressure of water vapour in the collected gas (atm), 0 unless collected over water.
    pub vapour_atm: f64,
}

/// Volume (mL) of `n_mol` of ideal gas at `t_k` and `p_atm`.
pub fn gas_volume_ml(n_mol: f64, t_k: f64, p_atm: f64) -> f64 {
    n_mol * R_GAS * t_k / (p_atm.max(1e-6) * ATM_PA) * 1e6
}

/// Moles in `v_ml` of ideal gas at `t_k` and `p_atm`.
pub fn gas_moles(v_ml: f64, t_k: f64, p_atm: f64) -> f64 {
    p_atm * ATM_PA * v_ml * 1e-6 / (R_GAS * t_k.max(1.0))
}

impl Vessel {
    pub fn collector(&self) -> Option<CollectorKind> {
        collector_kind(&self.config.vessel_type)
    }

    /// Total moles of gas held by a collector.
    pub fn collected_total_mol(&self) -> f64 {
        self.gas.collected_mol.values().fold(0.0, |a, b| a + b)
    }

    /// Total moles of gas in the headspace of a sealed vessel (air, vapour and evolved gas).
    pub fn headspace_total_mol(&self) -> f64 {
        self.headspace_gas_mol.values().fold(0.0, |a, b| a + b)
    }

    /// Moles of evolved gas (excess over the atmosphere captured at sealing, vapour of the liquids excluded).
    pub fn evolved_total_mol(&self) -> f64 {
        self.evolved_headspace().values().sum()
    }

    /// Vapour pressure (atm) of the sealing liquid in an over-water collector; 0 for the other collectors.
    pub fn collector_vapour_atm(&self) -> f64 {
        match self.collector() {
            Some(CollectorKind::OverWater) => self
                .volatile_for(OVER_WATER_SEAL_LIQUID)
                .map(|v| v.psat_pa(self.temperature_k) / ATM_PA)
                .unwrap_or(0.0),
            _ => 0.0,
        }
    }

    /// Pressure (atm) that the dry collected gas exerts (ambient minus the vapour for over-water collection).
    fn dry_gas_pressure_atm(&self) -> f64 {
        (self.p_ext_atm() - self.collector_vapour_atm()).max(0.01)
    }

    /// Evolved gas in the headspace of a sealed vessel: what exceeds the atmosphere captured at sealing, apart from the
    /// vapour of the vessel's own liquids (which the flash keeps in equilibrium).
    pub(crate) fn evolved_headspace(&self) -> HashMap<String, f64> {
        let mut out = HashMap::new();
        for (sp, &mol) in &self.headspace_gas_mol {
            let excess = mol - self.gas.seal_baseline_mol.get(sp).copied().unwrap_or(0.0);
            if excess > 1e-12 && !self.volatile_for_gas(sp).map_or(false, |v| self.species_mol.contains_key(&v.id)) {
                out.insert(sp.clone(), excess);
            }
        }
        out
    }

    /// Volume (mL) of the collected gas, as read on the collector's scale.
    pub fn collector_volume_ml(&self) -> f64 {
        gas_volume_ml(self.collected_total_mol(), self.temperature_k, self.dry_gas_pressure_atm())
    }

    /// Collector capacity in mL (the profile's nominal volume = the catalog capacity).
    pub fn collector_capacity_ml(&self) -> f64 {
        if self.collector().is_some() { self.config.capacity_ml } else { 0.0 }
    }

    /// Gas information for the snapshot.
    pub fn gas_info(&self) -> GasInfo {
        let collector = self.collector();
        let evolved;
        let src: &HashMap<String, f64> = if collector.is_some() {
            &self.gas.collected_mol
        } else {
            evolved = self.evolved_headspace();
            &evolved
        };
        let mut species: Vec<GasAmount> = src
            .iter()
            .filter(|(_, &m)| m > 0.0)
            .map(|(s, &m)| GasAmount { species: s.clone(), mol: m })
            .collect();
        species.sort_by(|a, b| b.mol.partial_cmp(&a.mol).unwrap_or(std::cmp::Ordering::Equal).then(a.species.cmp(&b.species)));
        let total: f64 = species.iter().fold(0.0, |a, g| a + g.mol);
        let p = if collector.is_some() { self.dry_gas_pressure_atm() } else { self.p_ext_atm() };
        GasInfo {
            collector,
            species,
            total_mol: total,
            volume_ml: gas_volume_ml(total, self.temperature_k, p),
            capacity_ml: self.collector_capacity_ml(),
            escaped_mol: self.gas.escaped_mol,
            vapour_atm: self.collector_vapour_atm(),
        }
    }

    /// Put `mol` of `species` into the collector. Returns the moles that did not fit (they escape into the room).
    /// A non-collector vessel just keeps nothing: everything escapes.
    fn receive_gas(&mut self, species: &str, mol: f64) -> f64 {
        if mol <= 0.0 {
            return 0.0;
        }
        if self.collector().is_none() {
            self.gas.escaped_mol += mol;
            return mol;
        }
        let cap_mol = gas_moles(self.collector_capacity_ml(), self.temperature_k, self.dry_gas_pressure_atm());
        let room = (cap_mol - self.collected_total_mol()).max(0.0);
        let take = mol.min(room);
        if take > 0.0 {
            *self.gas.collected_mol.entry(species.to_string()).or_default() += take;
            self.ledger.book_in(species, take);
        }
        let lost = mol - take;
        if lost > 0.0 {
            self.gas.escaped_mol += lost;
        }
        lost
    }

    /// Empty a collector (plunger pushed in, jar flushed, tube refilled with water). Returns the moles discarded.
    pub fn vent_collector(&mut self) -> f64 {
        let n = self.collected_total_mol();
        for (sp, mol) in std::mem::take(&mut self.gas.collected_mol) {
            self.ledger.book_out(&sp, mol);
        }
        n
    }
}

/// One step of a delivery-tube link: gas flows from `src`'s headspace into `dst`'s collector.
/// The source pressure relaxes toward the collector back-pressure with time constant `TUBE_TAU_S`.
/// Returns (moles moved out of the source, moles that escaped because the collector was full).
pub fn step_link(src: &mut Vessel, dst: &mut Vessel, dt_s: f64) -> (f64, f64) {
    if dt_s <= 0.0 || src.burst {
        return (0.0, 0.0);
    }
    let total = src.headspace_total_mol();
    if total <= 0.0 {
        return (0.0, 0.0);
    }
    // the headspace gas (air, vapour, evolved gas: everything the tube sees) flows while the vessel is above the
    // collector's back pressure; the moles that would sit at that pressure stay
    let p_target = src.p_ext_atm() + BACK_PRESSURE_ATM;
    if src.pressure_atm <= p_target {
        return (0.0, 0.0);
    }
    let excess = total * (1.0 - p_target / src.pressure_atm);
    if excess <= 0.0 {
        return (0.0, 0.0);
    }
    let f = 1.0 - (-dt_s / TUBE_TAU_S).exp();
    let mut moved = 0.0;
    let mut lost = 0.0;
    let species: Vec<(String, f64)> = src.headspace_gas_mol.iter().map(|(k, &v)| (k.clone(), v)).collect();
    for (sp, mol) in species {
        let share = excess * f * (mol / total);
        let take = share.min(mol);
        if take <= 0.0 {
            continue;
        }
        if let Some(m) = src.headspace_gas_mol.get_mut(&sp) {
            *m -= take;
            if *m <= 0.0 {
                src.headspace_gas_mol.remove(&sp);
            }
        }
        src.ledger.book_out(&sp, take);
        lost += dst.receive_gas(&sp, take);
        moved += take;
    }
    (moved, lost)
}

// ------------------------------------------------------------------ link registry (wasm side)
/// Active delivery tubes: (source handle, collector handle). A source has at most one tube.
static LINKS: Mutex<Vec<(u32, u32)>> = Mutex::new(Vec::new());

pub fn links() -> Vec<(u32, u32)> {
    LINKS.lock().map(|g| g.clone()).unwrap_or_default()
}

pub fn set_link(src: u32, dst: u32) -> bool {
    if src == dst {
        return false;
    }
    match LINKS.lock() {
        Ok(mut g) => {
            g.retain(|&(s, _)| s != src);
            g.push((src, dst));
            true
        }
        Err(_) => false,
    }
}

pub fn clear_link(src: u32) -> bool {
    match LINKS.lock() {
        Ok(mut g) => {
            let n = g.len();
            g.retain(|&(s, _)| s != src);
            g.len() != n
        }
        Err(_) => false,
    }
}

/// Drop every link that mentions `handle` (vessel freed).
pub fn drop_links_of(handle: u32) {
    if let Ok(mut g) = LINKS.lock() {
        g.retain(|&(s, d)| s != handle && d != handle);
    }
}

/// Advance every link once. The vessel map is borrowed mutably: take both vessels out for the step, then put them back.
/// `only`: step just the tubes whose source is in this list (None = all).
pub fn step_links(map: &mut HashMap<u32, Vessel>, dt_s: f64, only: Option<&[u32]>) {
    for (s, d) in links() {
        if s == d || only.map_or(false, |o| !o.contains(&s)) {
            continue;
        }
        if !map.contains_key(&s) || !map.contains_key(&d) {
            continue; // one end was freed
        }
        let (Some(mut src), Some(mut dst)) = (map.remove(&s), map.remove(&d)) else { continue };
        step_link(&mut src, &mut dst, dt_s);
        map.insert(s, src);
        map.insert(d, dst);
    }
}

// ------------------------------------------------------------------ wasm exports
/// Connect a delivery tube from `src` (the stoppered flask) to the collector `dst`. Seals the source (the stopper).
#[wasm_bindgen]
pub fn vessel_gas_link(src: u32, dst: u32) -> bool {
    crate::with_vessels(|map| {
        if !map.contains_key(&src) || !map.contains_key(&dst) || src == dst {
            return Ok(false);
        }
        if let Some(v) = map.get_mut(&src) {
            let mut c = crate::vessel::VesselControls::default();
            c.sealed = Some(true);
            v.set_controls(c);
        }
        Ok(set_link(src, dst))
    })
    .unwrap_or(false)
}

/// Remove the delivery tube of `src` (the vessel stays stoppered).
#[wasm_bindgen]
pub fn vessel_gas_unlink(src: u32) -> bool {
    clear_link(src)
}

/// Empty a collector's gas (plunger pushed home / jar flushed). Returns the moles discarded.
#[wasm_bindgen]
pub fn vessel_gas_vent(handle: u32) -> f64 {
    crate::with_vessels(|map| Ok(map.get_mut(&handle).map(|v| v.vent_collector()).unwrap_or(0.0))).unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vessel::{DoseRequest, VesselConfig, VesselControls};

    fn mk(t: &str, cap: f64, sealed: bool) -> Vessel {
        Vessel::new(VesselConfig {
            vessel_type: t.to_string(),
            capacity_ml: cap,
            glass_mass_g: 100.0,
            inner_radius_cm: 3.0,
            temperature_k: Some(293.15),
            room_k: Some(293.15),
            sealed: Some(sealed),
            stopper_pop_atm: Some(2.2),
            burst_atm: Some(6.0),
        })
    }

    /// Fit the stopper: the atmosphere's gas in the headspace is captured at this moment.
    fn stopper(v: &mut Vessel) {
        let mut c = VesselControls::default();
        c.sealed = Some(true);
        v.set_controls(c);
    }

    #[test]
    fn ideal_gas_helpers_roundtrip() {
        let n = gas_moles(240.0, 293.15, 1.0);
        assert!((gas_volume_ml(n, 293.15, 1.0) - 240.0).abs() < 1e-9);
        // 1 mol at 20 C and 1 atm = 24.06 L
        assert!((gas_volume_ml(1.0, 293.15, 1.0) - 24055.0).abs() < 30.0);
    }

    #[test]
    fn collector_kinds_by_type() {
        assert_eq!(collector_kind("gas-syringe-100"), Some(CollectorKind::Syringe));
        assert_eq!(collector_kind("gas-collection-tube-50"), Some(CollectorKind::OverWater));
        assert_eq!(collector_kind("gas-jar-250"), Some(CollectorKind::Jar));
        assert_eq!(collector_kind("beaker-250"), None);
    }

    #[test]
    fn link_conserves_moles_nahco3() {
        // the liquid goes in first, then the stopper (the air captured is the air that is really there)
        let mut src = mk("erlenmeyer-250", 250.0, false);
        let mut dst = mk("gas-syringe-100", 100.0, false);
        src.dose(DoseRequest { reagent_id: "ch3cooh_5pct".into(), volume_ml: Some(20.0), mass_g: None, drops: None, temperature_k: None }).unwrap();
        stopper(&mut src);
        src.dose(DoseRequest { reagent_id: "nahco3_s".into(), volume_ml: None, mass_g: Some(0.3), drops: None, temperature_k: None }).unwrap();
        let mut moved = 0.0;
        let mut lost_total = 0.0;
        let mut max_p = 0.0f64;
        for _ in 0..1500 {
            src.step(0.1).unwrap();
            dst.step(0.1).unwrap();
            let (m, l) = step_link(&mut src, &mut dst, 0.1);
            moved += m;
            lost_total += l;
            max_p = max_p.max(src.pressure_atm);
        }
        // everything that left the source headspace is in the collector (nothing escaped: 100 mL is plenty)
        assert!(lost_total.abs() < 1e-12);
        assert!((moved - dst.collected_total_mol()).abs() < 1e-12, "moved {} vs collected {}", moved, dst.collected_total_mol());
        // 0.3 g NaHCO3 = 3.57 mmol CO2 = ~86 mL at 20 C
        // (a little stays dissolved as CO2(aq)/HCO3-/CO3-2 at the exact carbonate equilibrium; count it for conservation).
        // The tube carries whatever the headspace holds: the flask's air and vapour go over first, mixed with the CO2.
        let sp = |n: &str| src.species_mol.get(n).copied().unwrap_or(0.0);
        let dissolved = sp("CO2(aq)") + sp("HCO3-") + sp("CO3-2");
        let co2_gas = dst.collected_mol_of("CO2(g)") + src.headspace_gas_mol.get("CO2(g)").copied().unwrap_or(0.0)
            - src.gas.seal_baseline_mol.get("CO2(g)").copied().unwrap_or(0.0);
        let total = co2_gas + dissolved;
        assert!((total - 3.57e-3).abs() < 0.06e-3, "CO2 total {} mol", total);
        // (the flask holds air too, so CO2 keeps a partial pressure of a few tenths of an atmosphere and more of it stays
        // dissolved than when the tube drew off pure CO2)
        assert!(dissolved < 1.3e-3, "dissolved carbonate species {} mol", dissolved);
        // the collector reads the volume of gas the flask pushed out: close to the CO2 volume produced
        let v = dst.collector_volume_ml();
        assert!(v > 60.0 && v < 95.0, "collected {} mL (CO2 produced 86 mL, about 18 mL of it still dissolved)", v);
        assert!(dst.collected_mol_of("N2(g)") > 0.0, "the displaced air is in the collector too");
        // the flask did not pressurise noticeably
        assert!(max_p < 1.06 + 0.04, "pressure peaked at {} atm", max_p);
        assert!(src.sealed, "stopper must not pop while connected");
    }

    #[test]
    fn mg_hcl_collects_hydrogen() {
        let mut src = mk("erlenmeyer-250", 250.0, false);
        // (a 250 mL syringe: the flask pushes out 84 mL of hydrogen plus the thermal expansion of its air)
        let mut dst = mk("gas-syringe-250", 250.0, false);
        src.dose(DoseRequest { reagent_id: "hcl_1m".into(), volume_ml: Some(30.0), mass_g: None, drops: None, temperature_k: None }).unwrap();
        stopper(&mut src);
        // 0.0851 g Mg = 3.5 mmol -> 3.5 mmol H2 (~84 mL), HCl in excess (30 mmol)
        src.dose(DoseRequest { reagent_id: "mg_ribbon".into(), volume_ml: None, mass_g: Some(0.0851), drops: None, temperature_k: None }).unwrap();
        let mut moved = 0.0;
        for _ in 0..1200 {
            src.step(0.1).unwrap();
            dst.step(0.1).unwrap();
            moved += step_link(&mut src, &mut dst, 0.1).0;
        }
        assert!((moved - dst.collected_total_mol()).abs() < 1e-12);
        let h2 = dst.collected_mol_of("H2(g)") + src.headspace_gas_mol.get("H2(g)").copied().unwrap_or(0.0);
        assert!((h2 - 3.5e-3).abs() < 0.2e-3, "H2 total {} mol (expected 3.5 mmol)", h2);
        // the gas that left the flask is the volume of hydrogen produced (84 mL), diluted by the flask's own air
        let v = dst.collector_volume_ml();
        assert!(v > 80.0 && v < 115.0, "collected {} mL", v);
        assert!(dst.collected_mol_of("H2(g)") > 0.15 * 3.5e-3);
    }

    #[test]
    fn full_collector_escapes_and_still_conserves() {
        let mut src = mk("erlenmeyer-250", 250.0, false);
        let mut dst = mk("gas-syringe-100", 100.0, false);
        src.dose(DoseRequest { reagent_id: "ch3cooh_5pct".into(), volume_ml: Some(100.0), mass_g: None, drops: None, temperature_k: None }).unwrap();
        stopper(&mut src);
        let mut moved = 0.0;
        let mut lost = 0.0;
        // 5 g of NaHCO3 added in 0.25 g portions (as a manual pour would): ~1.4 L of CO2 for a 100 mL syringe
        for i in 0..800 {
            if i % 5 == 0 && i < 100 {
                src.dose(DoseRequest { reagent_id: "nahco3_s".into(), volume_ml: None, mass_g: Some(0.25), drops: None, temperature_k: None }).unwrap();
            }
            src.step(0.1).unwrap();
            let (m, l) = step_link(&mut src, &mut dst, 0.1);
            moved += m;
            lost += l;
        }
        assert!(src.sealed, "stopper must hold while the tube is connected");
        assert!(lost > 0.0, "a 100 mL syringe cannot hold 1.4 L of CO2");
        assert!((moved - dst.collected_total_mol() - lost).abs() < 1e-12);
        let cap = dst.collector_capacity_ml();
        assert!(dst.collector_volume_ml() <= cap + 1e-6);
        assert!((dst.collector_volume_ml() - cap).abs() < 0.5, "syringe should be full");
        assert!((dst.gas.escaped_mol - lost).abs() < 1e-12);
    }

    #[test]
    fn over_water_reads_a_little_more_than_dry() {
        let mut dry = mk("gas-syringe-100", 100.0, false);
        let mut wet = mk("gas-collection-tube-50", 50.0, false);
        dry.receive_gas("H2(g)", 1.0e-3);
        wet.receive_gas("H2(g)", 1.0e-3);
        let vd = dry.collector_volume_ml();
        let vw = wet.collector_volume_ml();
        let ratio = vw / vd;
        let expect = 1.0 / (1.0 - wet.collector_vapour_atm());
        assert!((ratio - expect).abs() < 1e-9);
        assert!(ratio > 1.015 && ratio < 1.03, "vapour correction {}", ratio);
    }

    #[test]
    fn unsealed_source_collects_nothing() {
        // without the stopper the gas escapes to the room: the tube cannot collect it
        let mut src = mk("erlenmeyer-250", 250.0, false);
        let mut dst = mk("gas-syringe-100", 100.0, false);
        src.dose(DoseRequest { reagent_id: "ch3cooh_5pct".into(), volume_ml: Some(20.0), mass_g: None, drops: None, temperature_k: None }).unwrap();
        src.dose(DoseRequest { reagent_id: "nahco3_s".into(), volume_ml: None, mass_g: Some(0.3), drops: None, temperature_k: None }).unwrap();
        for _ in 0..100 {
            src.step(0.1).unwrap();
            step_link(&mut src, &mut dst, 0.1);
        }
        assert!(dst.collected_total_mol() < 1e-12);
        let mut c = VesselControls::default();
        c.sealed = Some(true);
        src.set_controls(c);
        assert!(src.sealed);
    }

    #[test]
    fn vent_collector_empties() {
        let mut dst = mk("gas-syringe-100", 100.0, false);
        dst.receive_gas("CO2(g)", 2.0e-3);
        let n = dst.vent_collector();
        assert!((n - 2.0e-3).abs() < 1e-15);
        assert_eq!(dst.collected_total_mol(), 0.0);
    }
}

impl Vessel {
    /// Moles of one gas species held by a collector.
    pub fn collected_mol_of(&self, species: &str) -> f64 {
        self.gas.collected_mol.get(species).copied().unwrap_or(0.0)
    }
}
