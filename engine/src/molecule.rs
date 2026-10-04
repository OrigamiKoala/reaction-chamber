//! Molecular species of the liquid phases (Stage 5): the intrinsic data a molecule brings to phase equilibria, and the
//! activity model that mixes them.
//!
//! A `Molecule` is resolved from the species store (the records of one InChIKey: liquid, solid, gas and aqueous twins) and,
//! for an imported compound, its `CompoundThermo`. It carries
//!   * the solid-liquid line (`SolidModel`): the melting point and enthalpy of fusion as *points*, from which the Gibbs
//!     energy of fusion at any temperature gives the activity at which the solid is in equilibrium with the liquid
//!     (Schroeder-van Laar): `ln a_sat(T) = -dG_fus(T) / RT`. The same equation freezes a solvent, dissolves a solute and
//!     melts a pure compound. No freezing point, solubility or miscibility is stored anywhere;
//!   * UNIFAC subgroups (from the structure) for the liquid-phase activity coefficient;
//!   * *activity points*: infinite-dilution activity coefficients in a named solvent, derived from a measured solubility
//!     (kind `solubility` points: iodine in hexane, any PubChem water solubility) or from the aqueous standard chemical
//!     potential against the liquid reference (a species with no groups). They correct (or, without groups, replace) the
//!     UNIFAC value near the temperature they were measured at and are labelled with their tier;
//!   * the liquid and solid molar volumes and heat capacities the volume and energy balances use.
//!
//! `Mixture` evaluates `ln gamma_i` of the components of one liquid phase: UNIFAC over the components that have groups
//! (ideal and labelled for the rest), the activity-point corrections, and, in the phase that holds the electrolytes, the
//! ionic water activity (Pitzer / Debye-Hueckel) and the salting-out of neutral solutes (Long-McDevit electrostriction
//! model from the ions' partial molar volumes and the crystal volume of the salt).

use std::collections::HashMap;
use std::sync::Arc;

use crate::activity::{self, GroupCounts};
use crate::compound_thermo::CompoundThermo;
use crate::db::record::SpeciesRecord;
use crate::db::SpeciesStore;
use crate::physics::R_GAS;
use crate::types::ProvenanceTier;
use crate::vle::{self, LiquidVolume};

/// Isothermal compressibility of liquid water, 1/Pa (20-25 C), for the Long-McDevit salting-out coefficient.
pub const WATER_COMPRESSIBILITY_PER_PA: f64 = 4.52e-10;
/// Ambient pressure of the data points (1 atm), Pa.
const P_REF_PA: f64 = 101_325.0;

fn weakest(a: &ProvenanceTier, b: &ProvenanceTier) -> ProvenanceTier {
    fn rank(t: &ProvenanceTier) -> u8 {
        match t {
            ProvenanceTier::Tabulated | ProvenanceTier::Refined | ProvenanceTier::UserSet => 0,
            ProvenanceTier::Imported => 1,
            ProvenanceTier::Estimated => 2,
            ProvenanceTier::Speculative => 3,
        }
    }
    if rank(a) >= rank(b) { a.clone() } else { b.clone() }
}

// ------------------------------------------------------------------------------------------------ solid-liquid line

/// The solid-liquid line of a compound: the Gibbs energy of fusion as a function of temperature.
#[derive(Clone, Debug)]
pub struct Fusion {
    /// The melting temperature at 1 atm (one point of the line), K.
    pub tm_k: f64,
    /// Enthalpy of fusion at `tm_k`, J/mol.
    pub dh_fus_j_mol: f64,
    /// Cp(liquid) - Cp(solid), J/(mol K); 0 when the heat capacities are unknown (then `dcp_known` is false).
    pub dcp_j_mol_k: f64,
    pub dcp_known: bool,
    /// Molar volume of the solid, m3/mol, for the pressure dependence of the line (Clapeyron); None = incompressible, no shift.
    pub v_solid_m3_mol: Option<f64>,
    pub tier: ProvenanceTier,
    pub source: String,
    /// The enthalpy of fusion is an estimate (Walden / Richard's rule) rather than data.
    pub dh_estimated: bool,
}

impl Fusion {
    /// `mu_liquid - mu_solid` of the pure compound at (T, P): the subcooled liquid against the solid. Positive below the
    /// melting point, negative above. `v_liquid_m3_mol` supplies the liquid volume for the pressure term.
    pub fn dg_fus_j_mol(&self, t_k: f64, p_pa: f64, v_liquid_m3_mol: Option<f64>) -> f64 {
        let (tm, dh, dcp) = (self.tm_k, self.dh_fus_j_mol, self.dcp_j_mol_k);
        let dg = dh * (1.0 - t_k / tm) + dcp * ((t_k - tm) - t_k * (t_k / tm).ln());
        let dv = match (self.v_solid_m3_mol, v_liquid_m3_mol) {
            (Some(vs), Some(vl)) => vl - vs,
            _ => 0.0,
        };
        dg + dv * (p_pa - P_REF_PA)
    }

    /// Enthalpy of fusion at `t_k` (heat taken up when the solid becomes liquid), J/mol.
    pub fn dh_fus_at(&self, t_k: f64) -> f64 {
        self.dh_fus_j_mol + self.dcp_j_mol_k * (t_k - self.tm_k)
    }
}

/// How a compound's solid phase is in equilibrium with its liquid solutions.
#[derive(Clone, Debug)]
pub enum SolidModel {
    /// A fusion line: the solid is stable where the liquid's activity exceeds `exp(-dG_fus/RT)`.
    Fusion(Fusion),
    /// A solid with no fusion data but a measured solubility: it saturates at unit activity of the (subcooled) liquid, the
    /// activity coefficient being fitted to the measurement; speculative, constant in temperature.
    UnitActivity,
    /// A solid with neither: it does not dissolve (labelled speculative; no solubility default is invented).
    Insoluble,
}

impl SolidModel {
    /// ln of the activity of the pure liquid-reference component in equilibrium with its solid at (T, P).
    pub fn ln_a_sat(&self, t_k: f64, p_pa: f64, v_liquid_m3_mol: Option<f64>) -> f64 {
        match self {
            SolidModel::Fusion(f) => -f.dg_fus_j_mol(t_k, p_pa, v_liquid_m3_mol) / (R_GAS * t_k),
            SolidModel::UnitActivity => 0.0,
            SolidModel::Insoluble => f64::NEG_INFINITY,
        }
    }
}

/// An activity-coefficient datum of a molecule in a named solvent, at `t_ref_k`: either the infinite-dilution value (from
/// the aqueous standard chemical potential, `x_sat` None) or the value at saturation (from a measured solubility,
/// `x_sat` the mole fraction of the saturated solution).
#[derive(Clone, Debug)]
pub struct GammaPoint {
    /// InChIKey of the solvent.
    pub solvent_ik: String,
    pub t_ref_k: f64,
    /// ln gamma at infinite dilution, or ln gamma at the saturation mole fraction `x_sat` when that is Some.
    pub ln_gamma_inf: f64,
    pub x_sat: Option<f64>,
    /// Partial excess enthalpy of the solute in this solvent (J/mol): the measured enthalpy of solution minus the enthalpy
    /// of fusion. When known it fixes the temperature dependence of the activity coefficient,
    /// `ln gamma(T) = ln gamma(T_ref) + h/R (1/T - 1/T_ref)`; without it the correction scales as `T_ref/T` (regular solution).
    pub h_excess_j_mol: Option<f64>,
    pub tier: ProvenanceTier,
    pub source: String,
}

#[derive(Clone, Debug)]
pub struct Molecule {
    /// `species_mol` key of the molecule in the liquid phases.
    pub key: String,
    pub name: String,
    pub formula: String,
    pub inchikey: Option<String>,
    pub mw: f64,
    /// Key of the solid in `solid_mol` ("X(s)").
    pub solid_key: String,
    /// Key of the gas in `headspace_gas_mol` ("X(g)") when the store has a gas twin.
    pub gas_key: Option<String>,
    pub groups: Option<GroupCounts>,
    pub solid: Option<SolidModel>,
    pub volume: LiquidVolume,
    /// A liquid record or an import describes the liquid (otherwise `volume` is a placeholder density).
    pub liquid_data: bool,
    pub v_solid_m3_mol: Option<f64>,
    pub cp_liquid_j_mol_k: Option<f64>,
    pub cp_solid_j_mol_k: Option<f64>,
    /// Andrade parameters (A, B) of the liquid viscosity ln(eta/cP) = A + B/T from the record's `transport.eta_l`.
    pub andrade_viscosity: Option<(f64, f64)>,
    pub gamma_points: Vec<GammaPoint>,
    /// Weakest tier of the data that determines the molecule's phase behaviour.
    pub tier: ProvenanceTier,
    /// Human-readable labels of the models and estimates used ("no UNIFAC groups: ideal", "melting enthalpy estimated").
    pub notes: Vec<String>,
}

impl Molecule {
    /// A molecule the liquid-phase models can place in a phase of its own or dissolve in another: it has an activity model
    /// (UNIFAC groups) or measured activity points. Anything else stays where it was put (the water-containing phase).
    pub fn partitionable(&self) -> bool {
        self.groups.is_some() || !self.gamma_points.is_empty()
    }

    /// Molar volume of the pure liquid, m3/mol.
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

    pub fn ln_a_sat(&self, t_k: f64, p_pa: f64) -> Option<f64> {
        self.solid.as_ref().map(|s| s.ln_a_sat(t_k, p_pa, Some(self.v_liquid_m3_mol(t_k))))
    }

    /// Enthalpy taken up when one mole of the solid dissolves in an ideal solution (J/mol): the enthalpy of fusion.
    pub fn dh_dissolve_ideal(&self, t_k: f64) -> f64 {
        match &self.solid {
            Some(SolidModel::Fusion(f)) => f.dh_fus_at(t_k),
            _ => 0.0,
        }
    }
}

// ------------------------------------------------------------------------------------------------ resolution

fn point<'a>(recs: &[&'a SpeciesRecord], kind: &str) -> Option<&'a crate::db::record::CurvePoint> {
    recs.iter().flat_map(|r| r.points.iter()).find(|p| p.kind == kind)
}

fn phase_cp(recs: &[&SpeciesRecord], tag: &str) -> Option<f64> {
    recs.iter().find_map(|r| r.phases.get(tag).and_then(|p| p.thermo.as_ref()).and_then(|t| t.cp.as_ref()).map(|d| d.value)).filter(|v| *v > 1.0)
}

/// Converts a solubility point of the record to a mole fraction of the solute at saturation. Units: "x" (mole fraction),
/// "g/L" (grams of solute per litre of solution), "mol/kg" (molality).
fn solubility_to_x(value: f64, unit: &str, mw_solute: f64, solvent_mw: f64, solvent_rho_g_ml: f64) -> Option<f64> {
    match unit {
        "x" => Some(value),
        "mol/kg" => Some(value * solvent_mw * 1e-3 / (1.0 + value * solvent_mw * 1e-3)),
        "g/L" => {
            // dilute: moles of solute per litre against moles of solvent per litre of solvent
            let c = value / mw_solute;
            let c_solvent = 1000.0 * solvent_rho_g_ml / solvent_mw;
            Some(c / (c + c_solvent))
        }
        _ => None,
    }
}

/// Resolves the molecule a liquid-inventory key stands for. `compound` is the import record of that key, if the vessel has
/// one. None when the key is no neutral molecule (an ion, a pseudo-species) or nothing is known about it.
pub fn resolve(key: &str, compound: Option<&CompoundThermo>) -> Option<Molecule> {
    // The records are cloned out of the store and the read lock released at once: the helpers below (UNIFAC groups, thermo
    // states, solvent data) read the store themselves, and a nested read while another thread waits to write deadlocks.
    let (own_owned, recs_owned, water_ik): (Option<SpeciesRecord>, Vec<SpeciesRecord>, Option<String>) = {
        let store_arc = SpeciesStore::global();
        let store = store_arc.read().ok()?;
        let own = store.get(key).cloned();
        let ik = own.as_ref().and_then(|r| r.identity.inchikey.clone()).or_else(|| compound.and_then(|c| c.inchi_key.clone()));
        let recs: Vec<SpeciesRecord> = match &ik {
            Some(k) => store.all_by_inchikey(k).into_iter().cloned().collect(),
            None => Vec::new(),
        };
        let water = store.get(crate::vessel::AQUEOUS_SOLVENT).and_then(|r| r.identity.inchikey.clone());
        (own, recs, water)
    };
    let own: Option<&SpeciesRecord> = own_owned.as_ref();
    let ik: Option<String> = own.and_then(|r| r.identity.inchikey.clone()).or_else(|| compound.and_then(|c| c.inchi_key.clone()));
    let mut recs: Vec<&SpeciesRecord> = recs_owned.iter().collect();
    if let Some(o) = own {
        if !recs.iter().any(|r| r.id == o.id) {
            recs.push(o);
        }
    }
    if recs.is_empty() && compound.is_none() {
        return None;
    }
    if recs.iter().any(|r| r.identity.charge != 0) || compound.map_or(false, |c| c.phase_model == "ionic") {
        return None;
    }
    let liq = recs.iter().find(|r| r.has_phase("l")).copied();
    let sol = recs.iter().find(|r| r.has_phase("s")).copied();
    let gas = recs.iter().find(|r| r.has_phase("g")).copied();
    let aq = recs.iter().find(|r| r.has_phase("aq")).copied();
    let main = own.or(liq).or(sol).or(aq).or_else(|| recs.first().copied());

    let name = main
        .and_then(|r| r.identity.names.first().cloned())
        .or_else(|| compound.map(|c| c.name.clone()))
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| key.to_string());
    let formula = main.map(|r| r.identity.formula.clone()).or_else(|| compound.map(|c| c.formula.clone())).unwrap_or_default();
    let mw = main.map(|r| r.mw()).filter(|m| *m > 0.5).or_else(|| compound.map(|c| c.mw)).unwrap_or(0.0);
    if mw <= 0.0 {
        return None;
    }
    let mut notes: Vec<String> = Vec::new();
    let mut tier = ProvenanceTier::Tabulated;

    // ---- liquid volume
    let crit = liq.and_then(vle::critical_of).or_else(|| gas.and_then(vle::critical_of)).map(|(tc, pc, w)| vle::Critical { tc_k: tc, pc_pa: pc, omega: w.unwrap_or(0.3) });
    let volume = match (liq, compound) {
        (Some(l), _) => vle::liquid_volume_of(l, crit, mw),
        (None, Some(c)) => LiquidVolume::Density(c.rho_liquid),
        (None, None) => LiquidVolume::Density(1.0),
    };
    if liq.is_none() && compound.is_none() {
        notes.push("liquid density assumed 1 g/mL (no data)".to_string());
        tier = weakest(&tier, &ProvenanceTier::Speculative);
    }

    // ---- heat capacities and solid volume
    let cp_l = phase_cp(&recs, "l").or_else(|| compound.map(|c| c.cp_j_g_k * mw)).filter(|v| *v > 1.0);
    let cp_s = phase_cp(&recs, "s").or_else(|| compound.filter(|_| sol.is_none()).map(|c| c.cp_j_g_k * mw)).filter(|v| *v > 1.0);
    let rho_s = sol.and_then(|r| r.phases.get("s")).and_then(|p| p.rho.as_ref()).map(|d| d.value).or_else(|| compound.map(|c| c.rho_solid));
    let v_solid = rho_s.filter(|r| *r > 0.05).map(|r| mw / r * 1e-6);

    // ---- solid-liquid line
    let tm_pt = point(&recs, "tm");
    let dh_pt = point(&recs, "dhfus");
    let mut solid: Option<SolidModel> = None;
    if let Some(tm_p) = tm_pt {
        let tm = tm_p.T_K.unwrap_or(0.0);
        if tm > 1.0 {
            let (dh, dh_tier, dh_src, dh_est) = match dh_pt {
                Some(p) => (p.value.unwrap_or(0.0) * 1000.0, p.tier.clone(), p.source.clone(), false),
                None => match compound.and_then(|c| c.dh_fus_kj_mol.map(|d| (d, c.is_estimated("dh_fus")))) {
                    Some((d, est)) => (d * 1000.0, if est { ProvenanceTier::Estimated } else { ProvenanceTier::Imported }, "imported enthalpy of fusion".to_string(), est),
                    None => {
                        // Walden's rule: entropy of fusion of molecular crystals 56.5 J/(mol K)
                        (crate::compound_thermo::WALDEN_J_MOL_K * tm, ProvenanceTier::Estimated, "Walden's rule (56.5 J/(mol K))".to_string(), true)
                    }
                },
            };
            let (dcp, dcp_known) = match (cp_l, cp_s) {
                (Some(l), Some(s)) => (l - s, true),
                _ => (0.0, false),
            };
            let tier_f = weakest(&weakest(&tm_p.tier, &dh_tier), if dcp_known { &ProvenanceTier::Tabulated } else { &ProvenanceTier::Estimated });
            tier = weakest(&tier, &tier_f);
            if dh_est {
                notes.push("enthalpy of fusion estimated (Walden's rule)".to_string());
            }
            if !dcp_known {
                notes.push("heat-capacity change on fusion unknown (taken as 0)".to_string());
            }
            solid = Some(SolidModel::Fusion(Fusion {
                tm_k: tm,
                dh_fus_j_mol: dh,
                dcp_j_mol_k: dcp,
                dcp_known,
                v_solid_m3_mol: v_solid,
                tier: tier_f,
                source: format!("melting point {}; enthalpy of fusion {}", tm_p.source, dh_src),
                dh_estimated: dh_est,
            }));
        }
    }
    if solid.is_none() {
        if let Some(c) = compound {
            if let Some(tm) = c.t_melt_ref_k.filter(|t| *t > 1.0) {
                let dh_est = c.is_estimated("dh_fus");
                let dh = c.dh_fus_kj_mol.unwrap_or(crate::compound_thermo::WALDEN_J_MOL_K * tm / 1000.0) * 1000.0;
                let (dcp, dcp_known) = match (cp_l, cp_s) {
                    (Some(l), Some(s)) if (l - s).abs() > 1e-9 => (l - s, true),
                    _ => (0.0, false),
                };
                let t = if dh_est { ProvenanceTier::Estimated } else { ProvenanceTier::Imported };
                tier = weakest(&tier, &t);
                if dh_est {
                    notes.push("enthalpy of fusion estimated (Walden's rule)".to_string());
                }
                solid = Some(SolidModel::Fusion(Fusion {
                    tm_k: tm,
                    dh_fus_j_mol: dh,
                    dcp_j_mol_k: dcp,
                    dcp_known,
                    v_solid_m3_mol: v_solid,
                    tier: t,
                    source: "imported melting point".to_string(),
                    dh_estimated: dh_est,
                }));
            }
        }
    }

    // ---- activity: groups and points
    let groups = activity::unifac_groups(key).or_else(|| compound.and_then(|c| activity::unifac_groups(&c.species)));
    if groups.is_none() {
        notes.push("no UNIFAC groups: ideal in mixtures except where activity points exist".to_string());
    }
    let mut gamma_points: Vec<GammaPoint> = Vec::new();
    let solvent_info = |ik: &str| -> Option<(f64, f64)> {
        // (molar mass, density g/mL at 298 K) of the solvent named by an InChIKey
        let r_owned: SpeciesRecord = {
            let store_arc = SpeciesStore::global();
            let store = store_arc.read().ok()?;
            let found = store.all_by_inchikey(ik).into_iter().find(|r| r.has_phase("l"))?.clone();
            found
        };
        let r = &r_owned;
        let mws = r.mw();
        let rho = match vle::liquid_volume_of(r, vle::critical_of(r).map(|(tc, pc, w)| vle::Critical { tc_k: tc, pc_pa: pc, omega: w.unwrap_or(0.3) }), mws) {
            LiquidVolume::Iapws => 0.997,
            LiquidVolume::Density(d) => d,
            LiquidVolume::Rackett { crit, z_ra } => {
                let tr = (298.15 / crit.tc_k).clamp(0.1, 0.999);
                mws / (R_GAS * crit.tc_k / crit.pc_pa * z_ra.powf(1.0 + (1.0 - tr).powf(2.0 / 7.0)) * 1e6)
            }
        };
        Some((mws, rho))
    };
    let ln_a_sat_at = |t: f64, solid: &Option<SolidModel>| -> f64 {
        // the liquid reference activity of a saturated solution at t: the solid line when there is one and the solid is the
        // stable condensed phase (t below its melting temperature), else 1: above the melting point the solute is a liquid
        // and saturates at the activity of the pure liquid (a solid line there is metastable: its "activity" exceeds 1)
        match solid {
            Some(s) => s.ln_a_sat(t, P_REF_PA, None).min(0.0).max(-60.0),
            None => 0.0,
        }
    };
    for p in recs.iter().flat_map(|r| r.points.iter()).filter(|p| p.kind == "solubility") {
        let (Some(solvent_ik), Some(t), Some(v), Some(unit)) = (p.solvent.clone(), p.T_K, p.value, p.unit.clone()) else { continue };
        let Some((mws, rho)) = solvent_info(&solvent_ik) else { continue };
        let Some(x) = solubility_to_x(v, &unit, mw, mws, rho).filter(|x| *x > 0.0 && *x <= 1.0) else { continue };
        gamma_points.push(GammaPoint { solvent_ik, t_ref_k: t, ln_gamma_inf: ln_a_sat_at(t, &solid) - x.ln(), x_sat: Some(x), h_excess_j_mol: None, tier: p.tier.clone(), source: p.source.clone() });
    }
    // PubChem-style water solubility of an import
    if let (Some(c), Some(wik)) = (compound, water_ik.clone()) {
        if let Some(g_l) = c.solubility_g_per_l.filter(|s| *s > 0.0) {
            if !gamma_points.iter().any(|g| g.solvent_ik == wik) {
                if let Some((mws, rho)) = solvent_info(&wik) {
                    if let Some(x) = solubility_to_x(g_l, "g/L", mw, mws, rho).filter(|x| *x > 0.0 && *x <= 1.0) {
                        gamma_points.push(GammaPoint {
                            solvent_ik: wik.clone(),
                            t_ref_k: c.solubility_ref_k,
                            ln_gamma_inf: ln_a_sat_at(c.solubility_ref_k, &solid) - x.ln(),
                            x_sat: Some(x),
                            h_excess_j_mol: match (&solid, c.dh_sol_kj_mol) {
                                (Some(SolidModel::Fusion(f)), Some(dh_sol)) => Some(dh_sol * 1000.0 - f.dh_fus_at(c.solubility_ref_k)),
                                _ => None,
                            },
                            tier: ProvenanceTier::Imported,
                            source: "imported water solubility".to_string(),
                        });
                    }
                }
            }
        }
    }
    // a species with an aqueous standard state and no groups: infinite-dilution gamma in water from mu0(aq) - mu0(liquid)
    if groups.is_none() && !gamma_points.iter().any(|g| Some(&g.solvent_ik) == water_ik.as_ref()) {
        if let (Some(a), Some(wik)) = (aq, water_ik.clone()) {
            let t = 298.15;
            let aq_has = a.phases.get("aq").and_then(|p| p.thermo.as_ref()).map_or(false, |t| t.dfG.is_some());
            let mu_aq = crate::thermo::functions::try_thermo_state(&a.id, "aq", t, P_REF_PA).map(|st| st.mu0_j_mol);
            // liquid reference: the liquid record's own formation energy, else the solid's plus the Gibbs energy of fusion
            let mu_liq: Option<f64> = liq
                .filter(|l| l.phases.get("l").and_then(|p| p.thermo.as_ref()).map_or(false, |t| t.dfG.is_some()))
                .and_then(|l| crate::thermo::functions::try_thermo_state(&l.id, "l", t, P_REF_PA).map(|st| st.mu0_j_mol))
                .or_else(|| {
                    let s = sol.filter(|s| s.phases.get("s").and_then(|p| p.thermo.as_ref()).map_or(false, |t| t.dfG.is_some()))?;
                    let f = match &solid {
                        Some(SolidModel::Fusion(f)) => f.dg_fus_j_mol(t, P_REF_PA, None),
                        _ => return None,
                    };
                    Some(crate::thermo::functions::try_thermo_state(&s.id, "s", t, P_REF_PA)?.mu0_j_mol + f)
                });
            if let (true, Some(mu_aq), Some(mu_l)) = (aq_has, mu_aq, mu_liq) {
                // m = x / (x_w M_w) -> 55.51 x at infinite dilution
                let ln_g = (1.0 / 0.018_015_28f64).ln() + (mu_aq - mu_l) / (R_GAS * t);
                gamma_points.push(GammaPoint {
                    solvent_ik: wik,
                    t_ref_k: t,
                    ln_gamma_inf: ln_g,
                    x_sat: None,
                    h_excess_j_mol: None,
                    tier: ProvenanceTier::Estimated,
                    source: "aqueous standard chemical potential against the pure-liquid reference".to_string(),
                });
            }
        }
    }
    // a solid with no fusion line: unit activity if a solubility point exists, else insoluble
    if solid.is_none() && (sol.is_some() || compound.map_or(false, |c| c.state_at_room() == "solid")) {
        if gamma_points.is_empty() {
            solid = Some(SolidModel::Insoluble);
            notes.push("solid with no melting or solubility data: treated as insoluble".to_string());
            tier = weakest(&tier, &ProvenanceTier::Speculative);
        } else {
            // the fitted points were made with a_sat = 1 above (no fusion line), so unit activity is consistent
            solid = Some(SolidModel::UnitActivity);
            notes.push("solid with no melting data: saturates at the fitted solubility, constant in temperature".to_string());
            tier = weakest(&tier, &ProvenanceTier::Speculative);
        }
    }
    for g in &gamma_points {
        tier = weakest(&tier, &g.tier);
    }
    if groups.is_some() {
        tier = weakest(&tier, &ProvenanceTier::Estimated);
    }
    let base = key.trim_end_matches("(aq)").trim_end_matches("(l)").trim_end_matches("(s)").trim_end_matches("(g)");
    Some(Molecule {
        key: key.to_string(),
        name,
        formula,
        inchikey: ik,
        mw,
        solid_key: format!("{}(s)", base),
        gas_key: gas.map(|g| g.id.clone()),
        groups,
        solid,
        volume,
        liquid_data: liq.is_some() || compound.is_some(),
        v_solid_m3_mol: v_solid,
        cp_liquid_j_mol_k: cp_l,
        cp_solid_j_mol_k: cp_s,
        andrade_viscosity: recs.iter().find_map(|r| r.transport.as_ref().and_then(|t| t.eta_l.as_ref())).and_then(|j| Some((j.get("A")?.as_f64()?, j.get("B")?.as_f64()?))),
        gamma_points,
        tier,
        notes,
    })
}

// ------------------------------------------------------------------------------------------------ the mixture model

/// The electrolyte environment of the liquid phase that holds the ions.
#[derive(Clone, Debug, Default)]
pub struct IonEnv {
    /// Ion amounts (mol) in that phase (no water, no neutral molecules).
    pub ions: HashMap<String, f64>,
    /// `sum over salts (f_salt * (V_crystal - V0_aq))`, m3: the electrostriction volume the dissolved salts produce.
    pub electrostriction_m3: f64,
}

/// The components of one set of liquid phases, with the temperature the activity model is evaluated at.
pub struct Mixture {
    pub comps: Vec<Arc<Molecule>>,
    pub t_k: f64,
    pub water: Option<usize>,
    /// ln gamma of component i in solvent j from UNIFAC alone at the composition of its activity point (infinite dilution, or
    /// the saturation mole fraction), for the pairs that have one.
    unifac_at_point: Vec<Vec<Option<f64>>>,
}

impl Mixture {
    pub fn new(comps: Vec<Arc<Molecule>>, t_k: f64) -> Self {
        let n = comps.len();
        let water_ik = SpeciesStore::global().read().ok().and_then(|s| s.get(crate::vessel::AQUEOUS_SOLVENT).and_then(|r| r.identity.inchikey.clone()));
        let water = comps.iter().position(|c| c.inchikey.is_some() && c.inchikey == water_ik);
        let mut unifac_at_point = vec![vec![None; n]; n];
        for i in 0..n {
            for g in &comps[i].gamma_points {
                for j in 0..n {
                    if i != j && comps[j].inchikey.as_deref() == Some(g.solvent_ik.as_str()) {
                        if let (Some(gi), Some(gj)) = (&comps[i].groups, &comps[j].groups) {
                            let xi = g.x_sat.unwrap_or(1e-9);
                            if let Some(v) = activity::unifac_ln_gamma(&[gi, gj], &[xi, 1.0 - xi], t_k) {
                                unifac_at_point[i][j] = Some(v[0]);
                            }
                        }
                    }
                }
            }
        }
        Self { comps, t_k, water, unifac_at_point }
    }

    pub fn len(&self) -> usize {
        self.comps.len()
    }

    /// ln gamma of every component of a phase holding `n` mol of each (pure-liquid reference, mole-fraction basis over the
    /// molecular components). `ions` is Some for the phase that holds the electrolytes.
    pub fn ln_gamma(&self, n: &[f64], ions: Option<&IonEnv>) -> Vec<f64> {
        let nc = self.comps.len();
        let mut out = vec![0.0; nc];
        let total: f64 = n.iter().filter(|v| **v > 0.0).sum();
        if total <= 0.0 {
            return out;
        }
        let x: Vec<f64> = n.iter().map(|v| v.max(0.0) / total).collect();
        // UNIFAC over the components that have groups (renormalised among themselves)
        let cov: Vec<usize> = (0..nc).filter(|&i| n[i] > 0.0 && self.comps[i].groups.is_some()).collect();
        if cov.len() >= 2 {
            let tot_c: f64 = cov.iter().map(|&i| n[i]).sum();
            let xc: Vec<f64> = cov.iter().map(|&i| n[i] / tot_c).collect();
            let gr: Vec<&GroupCounts> = cov.iter().map(|&i| self.comps[i].groups.as_ref().unwrap()).collect();
            if let Some(lg) = activity::unifac_ln_gamma(&gr, &xc, self.t_k) {
                for (k, &i) in cov.iter().enumerate() {
                    out[i] = lg[k];
                }
            }
        }
        // Activity points (measured solubilities, aqueous standard states) correct the group-contribution model by a
        // two-suffix Margules excess Gibbs energy over the pairs that have a datum, G^E/RT = sum_p A_p x_a x_b, so that the
        // solute and the solvent activities stay Gibbs-Duhem consistent (a one-sided correction of the solute alone cannot
        // describe a miscibility gap):  ln gamma_k = sum_{p containing k} A_p x_other - G^E/RT.
        // A_p is fitted so that the model reproduces the datum at its own composition: at infinite dilution it is the
        // difference to UNIFAC itself, at a saturation mole fraction x_s it is the difference over (1-x_s)^2 (a very soluble
        // solute, glucose x_s = 0.08, would else miss its solubility); both scale as T_ref/T (regular-solution excess).
        let mut pairs: Vec<(usize, usize, f64)> = Vec::new();
        for i in 0..nc {
            if n[i] <= 0.0 {
                continue;
            }
            for g in &self.comps[i].gamma_points {
                for j in 0..nc {
                    if j == i || n[j] <= 0.0 || self.comps[j].inchikey.as_deref() != Some(g.solvent_ik.as_str()) {
                        continue;
                    }
                    let model = self.unifac_at_point[i][j].unwrap_or(0.0);
                    let denom = g.x_sat.map_or(1.0, |xs| (1.0 - xs) * (1.0 - xs)).max(1e-3);
                    let delta = match g.h_excess_j_mol {
                        // measured heat of solution: the activity coefficient follows its van 't Hoff line from the datum
                        Some(h) => g.ln_gamma_inf + h / R_GAS * (1.0 / self.t_k - 1.0 / g.t_ref_k) - model,
                        None => (g.ln_gamma_inf - model) * g.t_ref_k / self.t_k,
                    };
                    pairs.push((i, j, delta / denom));
                }
            }
        }
        if !pairs.is_empty() {
            let ge: f64 = pairs.iter().map(|&(i, j, a)| a * x[i] * x[j]).sum();
            for &(i, j, a) in &pairs {
                out[i] += a * x[j];
                out[j] += a * x[i];
            }
            for k in 0..nc {
                if n[k] > 0.0 {
                    out[k] -= ge;
                }
            }
        }
        // electrolytes: ionic water activity and the salting-out of neutral solutes
        if let (Some(env), Some(w)) = (ions, self.water) {
            if n[w] > 0.0 {
                let mut amounts: HashMap<String, f64> = env.ions.clone();
                amounts.insert(crate::vessel::AQUEOUS_SOLVENT.to_string(), n[w]);
                out[w] += activity::ionic_ln_water_activity(&amounts, self.t_k);
                if env.electrostriction_m3 > 0.0 {
                    let v_phase: f64 = (0..nc).map(|i| n[i].max(0.0) * self.comps[i].v_liquid_m3_mol(self.t_k)).sum::<f64>().max(1e-12);
                    let rt = R_GAS * self.t_k;
                    for i in 0..nc {
                        if i == w || n[i] <= 0.0 {
                            continue;
                        }
                        out[i] += self.comps[i].v_liquid_m3_mol(self.t_k) * env.electrostriction_m3 / (v_phase * WATER_COMPRESSIBILITY_PER_PA * rt);
                    }
                }
            }
        }
        out
    }

    /// ln of the liquid-reference activity `x_i gamma_i` of every component.
    pub fn ln_activity(&self, n: &[f64], ions: Option<&IonEnv>) -> Vec<f64> {
        let total: f64 = n.iter().filter(|v| **v > 0.0).sum();
        let lg = self.ln_gamma(n, ions);
        (0..self.comps.len()).map(|i| if n[i] > 0.0 && total > 0.0 { (n[i] / total).ln() + lg[i] } else { f64::NEG_INFINITY }).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_gibbs_energy_of_fusion_follows_the_melting_point_and_enthalpy() {
        let f = Fusion { tm_k: 273.15, dh_fus_j_mol: 6012.0, dcp_j_mol_k: 0.0, dcp_known: false, v_solid_m3_mol: None, tier: ProvenanceTier::Estimated, source: String::new(), dh_estimated: false };
        assert!(f.dg_fus_j_mol(273.15, P_REF_PA, None).abs() < 1e-9);
        assert!(f.dg_fus_j_mol(263.15, P_REF_PA, None) > 0.0, "liquid is unstable below the melting point");
        assert!(f.dg_fus_j_mol(283.15, P_REF_PA, None) < 0.0);
        // ln a at -1.86 K: -(dH/R)(1/T - 1/Tm)
        let t = 273.15 - 1.86;
        let expect = -(6012.0 / R_GAS) * (1.0 / t - 1.0 / 273.15);
        assert!((SolidModel::Fusion(f).ln_a_sat(t, P_REF_PA, None) - expect).abs() < 1e-12);
    }

    #[test]
    fn iodine_resolves_with_its_condensed_phases_and_activity_points() {
        let i2 = resolve("I2(aq)", None).expect("iodine is in the store");
        assert!(matches!(i2.solid, Some(SolidModel::Fusion(_))));
        assert_eq!(i2.solid_key, "I2(s)");
        assert!(i2.groups.is_none(), "no UNIFAC group describes I2");
        // water point from the aqueous standard chemical potential, hexane point from the measured solubility
        assert_eq!(i2.gamma_points.len(), 2, "{:?}", i2.gamma_points);
        let aq = i2.gamma_points.iter().find(|g| g.solvent_ik.starts_with("XLYOFNOQ")).unwrap();
        // 0.34 g/L at 25 C means x = 2.4e-5 and gamma_inf ~ 1.1e4 against the subcooled liquid
        assert!((aq.ln_gamma_inf - 9.3).abs() < 0.3, "{}", aq.ln_gamma_inf);
        assert!(i2.partitionable());
    }
}
