//! Vapour-liquid equilibrium data and models (Stage 4): everything is derived from intrinsic species records.
//!
//! A *volatile* component is a liquid species with a saturation-pressure curve. Its curve comes from, in order:
//!   1. an explicit equation named by the record (`vapor_pressure.model`: "iapws-if97-region4", "wagner", "antoine"),
//!      valid inside the record's temperature range;
//!   2. Lee-Kesler corresponding states (`ln Pr = f0(Tr) + omega f1(Tr)`) from the critical constants, with the
//!      acentric factor *fitted to the labelled saturation point* nearest 1 atm (the Kesler-Lee construction), so the
//!      curve passes exactly through that point and through (Tc, Pc);
//!   3. a Clausius-Clapeyron / Antoine-like fit through the labelled points (`compound_thermo::fit_vapor_curve`),
//!      with Trouton's rule when there is a single point (tier speculative).
//! No boiling point is ever stored: it is where the curve reaches the pressure the vessel is at.
//!
//! Latent heat is not a datum either: `latent_heat_j_mol` is the Clapeyron equation `T (dP/dT) (V_g - V_l)` on the same
//! curve, so the vapour pressure and the heat of vaporisation are consistent by construction.
//!
//! Henry's constants for dissolved gases come from the standard chemical potentials of the aqueous and gas species,
//! `k_H = exp(-(mu_aq - mu_g)/RT)` (mol / kg / bar), with the T dependence of both phases' mu from the thermo layer.
//!
//! This module is pure (no vessel state). `vessel_vle.rs` applies it to a vessel.

use std::collections::HashMap;
use std::sync::Arc;

use crate::compound_thermo::{fit_vapor_curve, VaporCurve, P_ATM_PA};
use crate::db::record::{PhaseData, SpeciesRecord};
use crate::db::SpeciesStore;
use crate::eos::PrComp;
use crate::physics::R_GAS;
use crate::types::ProvenanceTier;

/// 1 bar in Pa (the standard-state pressure of the thermodynamic tables).
pub const P_BAR_PA: f64 = 1.0e5;

/// Critical constants of a volatile component.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Critical {
    pub tc_k: f64,
    pub pc_pa: f64,
    pub omega: f64,
}

impl Critical {
    pub fn pr(&self) -> PrComp {
        PrComp { tc_k: self.tc_k, pc_pa: self.pc_pa, omega: self.omega }
    }
}

/// Lee-Kesler simple-fluid and reference-fluid terms of ln(P/Pc).
fn lk_f0(tr: f64) -> f64 {
    5.92714 - 6.09648 / tr - 1.28862 * tr.ln() + 0.169347 * tr.powi(6)
}
fn lk_f1(tr: f64) -> f64 {
    15.2518 - 15.6875 / tr - 13.4721 * tr.ln() + 0.43577 * tr.powi(6)
}

/// The acentric factor that makes the Lee-Kesler curve pass through the saturation point `(t_k, p_pa)`.
pub fn lk_omega_through(tc_k: f64, pc_pa: f64, t_k: f64, p_pa: f64) -> f64 {
    let tr = (t_k / tc_k).clamp(0.2, 0.99);
    ((p_pa / pc_pa).ln() - lk_f0(tr)) / lk_f1(tr)
}

/// How the saturation pressure of a liquid is computed.
#[derive(Clone, Debug)]
pub enum PsatModel {
    /// IAPWS-IF97 region 4 (the equation a record names for water).
    Iapws97,
    /// Wagner equation `ln(P/Pc) = (A t + B t^1.5 + C t^3 + D t^6) / Tr`, `t = 1 - Tr`.
    Wagner { tc_k: f64, pc_pa: f64, a: f64, b: f64, c: f64, d: f64 },
    /// Antoine `log10(P/Pa) = A - B / (T/K + C)`.
    Antoine { a: f64, b: f64, c: f64 },
    /// Lee-Kesler corresponding states with the acentric factor fitted to a saturation point.
    LeeKesler { tc_k: f64, pc_pa: f64, omega_fit: f64 },
    /// `ln P = a - b / (T + c)` through measured points (no critical data).
    Curve(VaporCurve),
}

impl PsatModel {
    /// Saturation pressure (Pa). Above the critical temperature (when known) it returns the critical pressure.
    pub fn psat_pa(&self, t_k: f64) -> f64 {
        match self {
            PsatModel::Iapws97 => crate::thermo::water::water_sat_pressure_pa(t_k),
            PsatModel::Wagner { tc_k, pc_pa, a, b, c, d } => {
                if t_k >= *tc_k {
                    return *pc_pa;
                }
                let tr = (t_k / tc_k).max(0.2);
                let t = 1.0 - tr;
                pc_pa * ((a * t + b * t.powf(1.5) + c * t.powi(3) + d * t.powi(6)) / tr).exp()
            }
            PsatModel::Antoine { a, b, c } => 10f64.powf(a - b / (t_k + c)),
            PsatModel::LeeKesler { tc_k, pc_pa, omega_fit } => {
                if t_k >= *tc_k {
                    return *pc_pa;
                }
                let tr = (t_k / tc_k).max(0.15);
                pc_pa * (lk_f0(tr) + omega_fit * lk_f1(tr)).exp()
            }
            PsatModel::Curve(c) => c.p_pa(t_k),
        }
    }

    /// Critical temperature when the model knows one (the liquid cannot exist above it).
    pub fn tc_k(&self) -> Option<f64> {
        match self {
            PsatModel::Iapws97 => Some(crate::thermo::water::WATER_TC_K),
            PsatModel::Wagner { tc_k, .. } => Some(*tc_k),
            PsatModel::LeeKesler { tc_k, .. } => Some(*tc_k),
            _ => None,
        }
    }

    /// Temperature (K) at which the curve reaches `p_pa`: below the critical pressure it is the boiling point at that
    /// pressure; at or above it the critical temperature is returned (no liquid-vapour boundary exists).
    pub fn t_sat(&self, p_pa: f64) -> f64 {
        if p_pa <= 0.0 {
            return 1.0;
        }
        if let PsatModel::Curve(c) = self {
            return c.t_at(p_pa).unwrap_or(f64::INFINITY);
        }
        let tc = self.tc_k().unwrap_or(2000.0);
        if self.psat_pa(tc * 0.999999) <= p_pa {
            return tc;
        }
        let (mut lo, mut hi) = (self.t_floor(), tc);
        for _ in 0..80 {
            let mid = 0.5 * (lo + hi);
            if self.psat_pa(mid) < p_pa {
                lo = mid;
            } else {
                hi = mid;
            }
            if hi - lo < 1e-9 {
                break;
            }
        }
        0.5 * (lo + hi)
    }

    fn t_floor(&self) -> f64 {
        match self {
            PsatModel::Iapws97 => 273.15,
            PsatModel::LeeKesler { tc_k, .. } => 0.15 * tc_k,
            PsatModel::Wagner { tc_k, .. } => 0.2 * tc_k,
            _ => 10.0,
        }
    }

    /// d ln P / dT (1/K), central difference on the model.
    pub fn dlnp_dt(&self, t_k: f64) -> f64 {
        let h = 0.05 * (t_k / 300.0).max(0.2);
        let tc = self.tc_k().unwrap_or(f64::INFINITY);
        let (t1, t2) = ((t_k - h).max(self.t_floor()), (t_k + h).min(tc * 0.9999));
        if t2 <= t1 {
            return 0.0;
        }
        (self.psat_pa(t2).ln() - self.psat_pa(t1).ln()) / (t2 - t1)
    }
}

/// How the molar volume of the pure liquid is computed.
#[derive(Clone, Debug)]
pub enum LiquidVolume {
    /// IAPWS-95 saturated liquid (the record names the model).
    Iapws,
    /// Rackett equation from the critical constants and Z_RA.
    Rackett { crit: Critical, z_ra: f64 },
    /// Constant density, g/mL.
    Density(f64),
}

/// A volatile liquid component: everything the VLE layer needs, resolved from records.
#[derive(Clone, Debug)]
pub struct Volatile {
    /// Species id of the liquid in the vessel (`species_mol` key).
    pub id: String,
    /// Species id of its gas phase (`headspace_gas_mol` key).
    pub gas_id: String,
    pub name: String,
    pub mw: f64,
    pub psat: PsatModel,
    pub psat_tier: ProvenanceTier,
    pub psat_source: String,
    pub crit: Option<Critical>,
    pub volume: LiquidVolume,
}

impl Volatile {
    pub fn psat_pa(&self, t_k: f64) -> f64 {
        self.psat.psat_pa(t_k)
    }

    /// Critical temperature (K): from the critical constants, else from the curve model; None when unknown.
    pub fn tc_k(&self) -> Option<f64> {
        self.crit.map(|c| c.tc_k).or_else(|| self.psat.tc_k())
    }

    /// Liquid molar volume, m^3/mol.
    pub fn v_liquid_m3_mol(&self, t_k: f64) -> f64 {
        match &self.volume {
            LiquidVolume::Iapws => crate::volume::water_molar_volume_cm3_mol(t_k) * 1e-6,
            LiquidVolume::Rackett { crit, z_ra } => {
                let tr = (t_k / crit.tc_k).clamp(0.1, 0.999);
                let expo = 1.0 + (1.0 - tr).powf(2.0 / 7.0);
                R_GAS * crit.tc_k / crit.pc_pa * z_ra.powf(expo)
            }
            LiquidVolume::Density(rho) => self.mw / rho.max(0.05) * 1e-6,
        }
    }

    /// ln of the fugacity coefficient of the saturated vapour at (T, Psat): the reference of the gamma-phi method.
    pub fn ln_phi_saturation(&self, crit: Critical, t_k: f64, psat_pa: f64) -> f64 {
        crate::eos::ln_phi_pure_vapour(crit.pr(), t_k, psat_pa)
    }

    /// Latent heat of vaporisation (J/mol): the Clapeyron equation on the saturation curve,
    /// `T (dP/dT)_sat (V_g - V_l) = R T^2 dlnP/dT (Z_g - Z_l)`, with Z_g from Peng-Robinson when critical data exist.
    /// Zero at and above the critical temperature.
    pub fn latent_heat_j_mol(&self, t_k: f64) -> f64 {
        if let Some(tc) = self.tc_k() {
            if t_k >= tc * 0.9995 {
                return 0.0;
            }
        }
        let p = self.psat_pa(t_k);
        let z_l = p * self.v_liquid_m3_mol(t_k) / (R_GAS * t_k);
        let z_g = match &self.crit {
            Some(c) => crate::eos::z_vapour_tp(&[c.pr()], &[1.0], t_k, p),
            None => 1.0,
        };
        let dz = (z_g - z_l).max(0.05);
        R_GAS * t_k * t_k * self.psat.dlnp_dt(t_k) * dz
    }
}

// ----------------------------------------------------------------------------------------------- record resolution

fn datum(rec: &SpeciesRecord, pick: impl Fn(&crate::db::record::Critical) -> &Option<crate::db::record::Datum>) -> Option<f64> {
    rec.critical.as_ref().and_then(|c| pick(c).as_ref().map(|d| d.value))
}

/// Critical constants stored on a record: needs Tc and Pc; the acentric factor is optional.
pub fn critical_of(rec: &SpeciesRecord) -> Option<(f64, f64, Option<f64>)> {
    let tc = datum(rec, |c| &c.Tc)?;
    let pc = datum(rec, |c| &c.Pc)?;
    if tc > 1.0 && pc > 1.0 {
        Some((tc, pc, datum(rec, |c| &c.omega)))
    } else {
        None
    }
}

/// Labelled saturation points `(T, P)` of a record (kinds "psat" and "tb").
pub fn psat_points_of(rec: &SpeciesRecord) -> Vec<[f64; 2]> {
    rec.points
        .iter()
        .filter(|p| p.kind == "psat" || p.kind == "tb")
        .filter_map(|p| Some([p.T_K?, p.P_Pa.unwrap_or(P_ATM_PA)]))
        .collect()
}

fn weakest(a: &ProvenanceTier, b: &ProvenanceTier) -> ProvenanceTier {
    fn rank(t: &ProvenanceTier) -> u8 {
        match t {
            ProvenanceTier::Tabulated => 0,
            ProvenanceTier::Refined => 0,
            ProvenanceTier::UserSet => 0,
            ProvenanceTier::Imported => 1,
            ProvenanceTier::Estimated => 2,
            ProvenanceTier::Speculative => 3,
        }
    }
    if rank(a) >= rank(b) { a.clone() } else { b.clone() }
}

/// Builds the saturation-pressure model for a liquid from its record (and the record of its gas-phase twin).
/// Returns the model with its tier and a source note, or None when the records hold no vapour-pressure data.
pub fn psat_model_from_records(liq: &SpeciesRecord, gas: Option<&SpeciesRecord>) -> Option<(PsatModel, ProvenanceTier, String)> {
    let recs: Vec<&SpeciesRecord> = std::iter::once(liq).chain(gas).collect();
    // 1. an explicit equation
    for r in &recs {
        if let Some(spec) = &r.vapor_pressure {
            let par = |k: &str| spec.params.as_ref().and_then(|p| p.get(k)).and_then(|v| v.as_f64());
            let model = match spec.model.as_str() {
                "iapws-if97-region4" => Some(PsatModel::Iapws97),
                "wagner" => {
                    let (tc, pc, _) = critical_of(r)?;
                    Some(PsatModel::Wagner { tc_k: tc, pc_pa: pc, a: par("a")?, b: par("b")?, c: par("c")?, d: par("d")? })
                }
                "antoine" => Some(PsatModel::Antoine { a: par("a")?, b: par("b")?, c: par("c")? }),
                _ => None,
            };
            if let Some(m) = model {
                return Some((m, spec.tier.clone(), spec.source.clone()));
            }
        }
    }
    // 2. corresponding states through the labelled point nearest 1 atm
    let mut points: Vec<[f64; 2]> = Vec::new();
    let mut crit: Option<(f64, f64, Option<f64>, ProvenanceTier)> = None;
    let mut point_tier = ProvenanceTier::Speculative;
    for r in &recs {
        for p in psat_points_of(r) {
            points.push(p);
        }
        for pt in r.points.iter().filter(|p| p.kind == "psat" || p.kind == "tb") {
            point_tier = weakest(&point_tier, &pt.tier);
            if matches!(point_tier, ProvenanceTier::Speculative) {
                point_tier = pt.tier.clone();
            }
        }
        if crit.is_none() {
            if let Some((tc, pc, w)) = critical_of(r) {
                let tier = r.critical.as_ref().and_then(|c| c.Tc.as_ref()).map(|d| d.tier.clone()).unwrap_or(ProvenanceTier::Estimated);
                crit = Some((tc, pc, w, tier));
            }
        }
    }
    if points.is_empty() {
        return None;
    }
    let anchor = *points.iter().min_by(|a, b| (a[1].ln() - P_ATM_PA.ln()).abs().partial_cmp(&(b[1].ln() - P_ATM_PA.ln()).abs()).unwrap())?;
    if let Some((tc, pc, _w, ctier)) = &crit {
        if anchor[0] < *tc {
            let omega_fit = lk_omega_through(*tc, *pc, anchor[0], anchor[1]);
            let tier = weakest(&point_tier, ctier);
            return Some((
                PsatModel::LeeKesler { tc_k: *tc, pc_pa: *pc, omega_fit },
                tier,
                "Lee-Kesler corresponding states, acentric factor fitted to the labelled saturation point".to_string(),
            ));
        }
    }
    // 3. fit through the points (Trouton's rule for a single point)
    let fit = fit_vapor_curve(&points, None)?;
    let tier = if fit.trouton { ProvenanceTier::Speculative } else { point_tier };
    Some((PsatModel::Curve(fit.curve), tier, "Clausius-Clapeyron fit through labelled saturation points".to_string()))
}

/// Liquid-volume model from a record: the named model, Rackett from critical data, else the record's density.
pub fn liquid_volume_of(liq: &SpeciesRecord, crit: Option<Critical>, mw: f64) -> LiquidVolume {
    let ph: Option<&PhaseData> = liq.phases.get("l");
    if let Some(v) = ph.and_then(|p| p.volume.as_ref()) {
        if v.model.as_deref() == Some("iapws-saturated-liquid") {
            return LiquidVolume::Iapws;
        }
        if let (Some(zra), Some(c)) = (v.zra.as_ref(), crit) {
            return LiquidVolume::Rackett { crit: c, z_ra: zra.value };
        }
    }
    // a measured density of the liquid beats the Spencer-Danner estimate of the Rackett parameter
    if let Some(rho) = ph.and_then(|p| p.rho.as_ref()) {
        return LiquidVolume::Density(rho.value);
    }
    if let Some(c) = crit {
        // Spencer-Danner estimate of the Rackett parameter from the acentric factor
        return LiquidVolume::Rackett { crit: c, z_ra: (0.29056 - 0.08775 * c.omega).clamp(0.2, 0.32) };
    }
    let _ = mw;
    LiquidVolume::Density(1.0)
}

/// The volatile component a liquid species id is (water, ethanol, ...), resolved from the store; None when the
/// store has no record with vapour-pressure data for it.
pub fn volatile_from_store(liq_id: &str) -> Option<Arc<Volatile>> {
    let store = SpeciesStore::global();
    let guard = store.read().ok()?;
    let own = guard.get(liq_id)?;
    // A record without a liquid phase (an aqueous solute "I2(aq)", an inventory key) is the same molecule as the liquid
    // record that shares its InChIKey: the volatility of the dissolved molecule is the pure liquid's (Raoult with the
    // activity coefficient). A gas twin alone does not make a liquid (CO2(aq) stays a Henry species).
    let liq = if own.has_phase("l") {
        own
    } else {
        let ik = own.identity.inchikey.as_ref()?;
        guard.all_by_inchikey(ik).into_iter().find(|r| r.has_phase("l") && r.identity.charge == 0)?
    };
    let gas = guard.gas_partner(liq);
    let gas_id = gas.map(|g| g.id.clone()).unwrap_or_else(|| format!("{}(g)", liq_id));
    build_volatile(liq_id, &gas_id, liq, gas)
}

/// Builds a `Volatile` from a liquid record and (optionally) its gas twin.
pub fn build_volatile(liq_id: &str, gas_id: &str, liq: &SpeciesRecord, gas: Option<&SpeciesRecord>) -> Option<Arc<Volatile>> {
    let (psat, tier, source) = psat_model_from_records(liq, gas)?;
    let crit = critical_of(liq).or_else(|| gas.and_then(critical_of)).map(|(tc, pc, w)| {
        let omega = w.unwrap_or_else(|| {
            // acentric factor from the saturation curve at Tr = 0.7 (the definition of omega)
            -(psat.psat_pa((0.7 * tc).max(1.0)) / pc).log10() - 1.0
        });
        Critical { tc_k: tc, pc_pa: pc, omega }
    });
    let mw = liq.mw();
    Some(Arc::new(Volatile {
        id: liq_id.to_string(),
        gas_id: gas_id.to_string(),
        name: liq.identity.names.first().cloned().unwrap_or_else(|| liq_id.to_string()),
        mw,
        psat,
        psat_tier: tier,
        psat_source: source,
        crit,
        volume: liquid_volume_of(liq, crit, mw),
    }))
}

/// Critical constants of a *gas* species (id like "N2(g)"): from its record or its liquid twin's.
pub fn gas_critical(gas_id: &str) -> Option<Critical> {
    let store = SpeciesStore::global();
    let guard = store.read().ok()?;
    let rec = guard.get(gas_id)?;
    let (tc, pc, w) = critical_of(rec).or_else(|| {
        let ik = rec.identity.inchikey.as_ref()?;
        guard.all_by_inchikey(ik).into_iter().find_map(critical_of)
    })?;
    Some(Critical { tc_k: tc, pc_pa: pc, omega: w.unwrap_or(0.2) })
}

/// Crude critical-constant estimate for a compound with only a normal boiling point (`tb_k`) and molar mass:
/// Tc = Tb / 0.65 (Guldberg's rule), Pc from a power law in the molar mass fitted to the n-alkanes
/// (`Pc = 30.3 bar (86/M)^0.72`, +-30 % for aromatics and polar compounds), omega from the Kesler-Lee relation through
/// the boiling point. Always *speculative*; replaced by data when the record has it.
pub fn estimate_critical_from_tb(tb_k: f64, mw: f64) -> Critical {
    let tc = tb_k / 0.65;
    let pc = 30.3e5 * (86.0 / mw.max(10.0)).powf(0.72);
    let omega = lk_omega_through(tc, pc, tb_k, P_ATM_PA);
    Critical { tc_k: tc, pc_pa: pc, omega }
}

// ----------------------------------------------------------------------------------------------- Henry's constant

/// Henry's constant `k_H` (mol of solute per kg of water per bar of partial pressure) of a dissolved gas from the
/// standard chemical potentials of its aqueous and gas species at `t_k`.
pub fn henry_k_mol_kg_bar(aq_id: &str, gas_id: &str, t_k: f64) -> f64 {
    let p = P_BAR_PA;
    let aq = crate::thermo::functions::get_thermo_state(aq_id, "aq", t_k, p);
    let g = crate::thermo::functions::get_thermo_state(gas_id, "g", t_k, p);
    (-(aq.mu0_j_mol - g.mu0_j_mol) / (R_GAS * t_k)).exp()
}

/// Enthalpy of transfer gas -> aqueous solution (J/mol, negative: dissolving a gas releases heat).
pub fn henry_dh_dissolve_j_mol(aq_id: &str, gas_id: &str, t_k: f64) -> f64 {
    let p = P_BAR_PA;
    let aq = crate::thermo::functions::get_thermo_state(aq_id, "aq", t_k, p);
    let g = crate::thermo::functions::get_thermo_state(gas_id, "g", t_k, p);
    aq.h_j_mol - g.h_j_mol
}

/// A dissolved species with a gas-phase twin in the store (`CO2(aq)` / `CO2(g)`).
#[derive(Clone, Debug)]
pub struct HenrySpecies {
    pub aq_id: String,
    pub gas_id: String,
    pub mw: f64,
}

/// Resolves the gas twin of an aqueous species id by InChIKey (neutral molecules only).
pub fn henry_species(aq_id: &str) -> Option<HenrySpecies> {
    let store = SpeciesStore::global();
    let guard = store.read().ok()?;
    let rec = guard.get(aq_id)?;
    if rec.identity.charge != 0 || !rec.has_phase("aq") {
        return None;
    }
    let gas = guard.gas_partner(rec)?;
    Some(HenrySpecies { aq_id: aq_id.to_string(), gas_id: gas.id.clone(), mw: rec.mw() })
}

fn twin_of_gas(gas_id: &str, phase: &str, neutral_only: bool) -> Option<String> {
    let store = SpeciesStore::global();
    let guard = store.read().ok()?;
    let rec = guard.get(gas_id)?;
    let ik = rec.identity.inchikey.as_ref()?;
    guard
        .all_by_inchikey(ik)
        .into_iter()
        .find(|r| r.has_phase(phase) && (!neutral_only || r.identity.charge == 0))
        .map(|r| r.id.clone())
}

/// Memoised store lookups (invalidated when the store changes).
pub struct VleCache {
    generation: u64,
    volatile: HashMap<String, Option<Arc<Volatile>>>,
    henry: HashMap<String, Option<HenrySpecies>>,
    gas_crit: HashMap<String, Option<Critical>>,
    /// gas species id -> the liquid species id of the same molecule (by InChIKey)
    gas_liquid: HashMap<String, Option<String>>,
    /// gas species id -> the aqueous species id of the same molecule
    gas_aqueous: HashMap<String, Option<String>>,
}

impl Default for VleCache {
    fn default() -> Self {
        Self { generation: 0, volatile: HashMap::new(), henry: HashMap::new(), gas_crit: HashMap::new(), gas_liquid: HashMap::new(), gas_aqueous: HashMap::new() }
    }
}

impl VleCache {
    fn sync(&mut self) {
        let g = SpeciesStore::generation();
        if g != self.generation {
            self.generation = g;
            self.volatile.clear();
            self.henry.clear();
            self.gas_crit.clear();
            self.gas_liquid.clear();
            self.gas_aqueous.clear();
        }
    }

    /// The liquid species id that shares a molecule (InChIKey) with the gas species `gas_id`.
    pub fn liquid_twin_of_gas(&mut self, gas_id: &str) -> Option<String> {
        self.sync();
        if let Some(v) = self.gas_liquid.get(gas_id) {
            return v.clone();
        }
        let v = twin_of_gas(gas_id, "l", false);
        self.gas_liquid.insert(gas_id.to_string(), v.clone());
        v
    }

    /// The aqueous species id (neutral) that shares a molecule with the gas species `gas_id`.
    pub fn aqueous_twin_of_gas(&mut self, gas_id: &str) -> Option<String> {
        self.sync();
        if let Some(v) = self.gas_aqueous.get(gas_id) {
            return v.clone();
        }
        let v = twin_of_gas(gas_id, "aq", true);
        self.gas_aqueous.insert(gas_id.to_string(), v.clone());
        v
    }

    /// A cached entry: Some(None) when the lookup was made and found nothing; None when it was never made.
    pub fn cached_volatile(&mut self, key: &str) -> Option<Option<Arc<Volatile>>> {
        self.sync();
        self.volatile.get(key).cloned()
    }

    pub fn forget(&mut self, key: &str) {
        self.volatile.remove(key);
    }

    pub fn volatile(&mut self, liq_id: &str) -> Option<Arc<Volatile>> {
        self.sync();
        if let Some(v) = self.volatile.get(liq_id) {
            return v.clone();
        }
        let v = volatile_from_store(liq_id);
        self.volatile.insert(liq_id.to_string(), v.clone());
        v
    }

    /// Inserts a volatile component built outside the store (an imported compound).
    pub fn insert_volatile(&mut self, liq_id: &str, v: Option<Arc<Volatile>>) {
        self.sync();
        self.volatile.insert(liq_id.to_string(), v);
    }

    pub fn henry(&mut self, aq_id: &str) -> Option<HenrySpecies> {
        self.sync();
        if let Some(v) = self.henry.get(aq_id) {
            return v.clone();
        }
        let v = henry_species(aq_id);
        self.henry.insert(aq_id.to_string(), v.clone());
        v
    }

    pub fn gas_critical(&mut self, gas_id: &str) -> Option<Critical> {
        self.sync();
        if let Some(v) = self.gas_crit.get(gas_id) {
            return *v;
        }
        let v = gas_critical(gas_id);
        self.gas_crit.insert(gas_id.to_string(), v);
        v
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn water_curve_comes_from_the_record_and_matches_steam_tables() {
        let w = volatile_from_store("H2O").expect("water");
        // steam-table saturation pressures (kPa): 25 C 3.169, 100 C 101.42, 150 C 476.2, 200 C 1554, 300 C 8588
        for (t_c, kpa) in [(25.0, 3.169), (100.0, 101.42), (150.0, 476.2), (200.0, 1554.0), (300.0, 8588.0)] {
            let p = w.psat_pa(273.15 + t_c) / 1e3;
            assert!(((p - kpa) / kpa).abs() < 0.01, "{} C: {} kPa vs {}", t_c, p, kpa);
        }
        // latent heat: 40.66 kJ/mol at 100 C, 34.96 kJ/mol at 200 C (steam tables 2257 and 1940 kJ/kg)
        let l100 = w.latent_heat_j_mol(373.15) / 1e3;
        let l200 = w.latent_heat_j_mol(473.15) / 1e3;
        assert!((l100 - 40.66).abs() < 1.2, "{}", l100);
        assert!((l200 - 34.96).abs() < 1.8, "{}", l200);
        assert_eq!(w.latent_heat_j_mol(650.0), 0.0);
    }

    #[test]
    fn corresponding_states_curve_is_anchored_at_the_saturation_point() {
        let e = volatile_from_store("C2H5OH").expect("ethanol");
        // passes through the labelled point (351.44 K, 1 atm) and the critical point
        assert!((e.psat_pa(351.44) / 101325.0 - 1.0).abs() < 1e-6);
        assert!((e.psat_pa(513.92) / 61.48e5 - 1.0).abs() < 1e-9);
        let tb = e.psat.t_sat(101325.0);
        assert!((tb - 351.44).abs() < 1e-4, "{}", tb);
        // 0.1 atm boiling point ~ 302 K (about 29 C)
        let t01 = e.psat.t_sat(0.1 * 101325.0);
        assert!(t01 > 299.0 && t01 < 305.0, "{}", t01);
        // heat of vaporisation at the normal boiling point ~ 38.6 kJ/mol
        let l = e.latent_heat_j_mol(351.44) / 1e3;
        assert!((l - 38.6).abs() < 2.5, "{}", l);
    }

    #[test]
    fn henry_constants_follow_from_chemical_potentials() {
        // CO2 0.0334 mol/(kg bar) at 25 C, O2 1.3e-3, NH3 ~ 58
        let k_co2 = henry_k_mol_kg_bar("CO2(aq)", "CO2(g)", 298.15);
        let k_o2 = henry_k_mol_kg_bar("O2(aq)", "O2(g)", 298.15);
        let k_nh3 = henry_k_mol_kg_bar("NH3", "NH3(g)", 298.15);
        assert!((k_co2 / 0.0334 - 1.0).abs() < 0.1, "{}", k_co2);
        assert!((k_o2 / 1.3e-3 - 1.0).abs() < 0.25, "{}", k_o2);
        assert!((k_nh3 / 58.0 - 1.0).abs() < 0.15, "{}", k_nh3);
        // solubility falls with temperature (all three are exothermic to dissolve)
        assert!(henry_k_mol_kg_bar("NH3", "NH3(g)", 363.15) < 0.15 * k_nh3);
        assert!(henry_dh_dissolve_j_mol("CO2(aq)", "CO2(g)", 298.15) < 0.0);
        // the gas twin is found by InChIKey, not by formula
        assert_eq!(henry_species("CO2(aq)").unwrap().gas_id, "CO2(g)");
        assert_eq!(henry_species("NH3").unwrap().gas_id, "NH3(g)");
        assert!(henry_species("Na+").is_none());
    }

    #[test]
    fn estimator_gives_a_consistent_curve() {
        let c = estimate_critical_from_tb(341.88, 86.18); // hexane-like
        assert!(c.tc_k > 500.0 && c.tc_k < 540.0);
        assert!(c.pc_pa > 25e5 && c.pc_pa < 36e5);
        let m = PsatModel::LeeKesler { tc_k: c.tc_k, pc_pa: c.pc_pa, omega_fit: c.omega };
        assert!((m.psat_pa(341.88) / 101325.0 - 1.0).abs() < 1e-6);
    }
}
