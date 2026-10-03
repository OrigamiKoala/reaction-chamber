//! Physical data of a compound and the phase behaviour derived from it.
//!
//! Nothing here is a stored "state" or "boiling point". A compound carries
//!   * intrinsic values: molar mass, standard enthalpy of formation (from the heat of combustion), standard entropy
//!     and heat capacity (optional), heat of fusion / vaporisation;
//!   * curve parameters and labelled anchor points: a vapour-pressure curve fitted to every measured (T, P) point, a
//!     melting point *reference at 1 atm* (one point on the solid-liquid line, shifted with pressure by the Clapeyron
//!     equation), reference densities and a 25 C solubility (optionally with a van't Hoff slope).
//! Phase (solid / liquid / gas) follows from the vessel's temperature and pressure at run time; the state at room
//! temperature and the normal boiling point are *derived* (where the fitted curve crosses 1 atm).
//!
//! Missing values are estimated and labelled as estimates: Walden's rule (ΔSfus = 56.5 J/mol/K) or Richard's rule
//! (ΔSfus = R, elemental metals) for the heat of fusion, Trouton's rule (ΔSvap = 88 J/mol/K) for the heat of
//! vaporisation, Dulong-Petit for elemental solids' heat capacity. The standard enthalpy of formation comes from a
//! measured heat of combustion by Hess's law.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::compound_model::CompoundRequest;

pub const R_GAS: f64 = crate::physics::R_GAS;
pub const P_ATM_PA: f64 = 101_325.0;
/// Reference temperature of "state at room temperature".
pub const ROOM_REF_K: f64 = 298.15;
/// Trouton's rule, J/(mol K).
pub const TROUTON_J_MOL_K: f64 = 88.0;
/// Walden's rule (molecular crystals), J/(mol K).
pub const WALDEN_J_MOL_K: f64 = 56.5;
/// Ratio Tb/Tc used for the Watson correction (Guldberg: ~2/3).
const TB_OVER_TC: f64 = 0.65;

/// ln(P/Pa) = a - b / (T/K + c). `c` is 0 for a plain Clausius-Clapeyron line, Antoine-like when fitted.
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct VaporCurve {
    pub a: f64,
    pub b: f64,
    pub c: f64,
}

impl VaporCurve {
    pub fn p_pa(&self, t_k: f64) -> f64 {
        let d = t_k + self.c;
        if d <= 1.0 {
            return 0.0;
        }
        (self.a - self.b / d).exp()
    }

    /// Temperature at which the curve reaches `p_pa`; None if it never does (or the pressure is not positive).
    pub fn t_at(&self, p_pa: f64) -> Option<f64> {
        if p_pa <= 0.0 {
            return None;
        }
        let den = self.a - p_pa.ln();
        if den <= 1e-9 {
            return None;
        }
        let t = self.b / den - self.c;
        if t.is_finite() && t > 1.0 { Some(t) } else { None }
    }

    /// Clausius-Clapeyron enthalpy (J/mol) implied by the local slope of the curve at `t_k`.
    pub fn slope_dh_j_mol(&self, t_k: f64) -> f64 {
        let d = (t_k + self.c).max(1.0);
        R_GAS * self.b * (t_k / d).powi(2)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NeatPhase {
    Solid,
    Liquid,
    Gas,
}

/// The data the engine keeps per compound (registered with the chem_db compound registry, keyed by `species`).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CompoundThermo {
    /// Base species id ("C10H8"): the solid is "C10H8(s)", its liquid (neat or dissolved, whatever phase it is in) "C10H8", its
    /// vapour "C10H8(g)".
    pub species: String,
    pub name: String,
    pub formula: String,
    /// "ionic" | "neutral" | "inert"
    pub phase_model: String,
    /// The request's `state` string: a hint used only when there is no melting reference.
    pub state_hint: Option<String>,
    /// State assumed when neither data nor a hint exist ("solid" for salts and inert compounds).
    pub state_fallback: String,
    // ---- intrinsic values
    pub mw: f64,
    /// Standard entropy S° (J/(mol K)); optional, not consumed yet (for future dG(T) / phase equilibria).
    pub s_j_mol_k: Option<f64>,
    /// Molar heat capacity at 298 K (J/(mol K)); when given it sets `cp_j_g_k`.
    pub cp_j_mol_k: Option<f64>,
    /// Shomate / NASA coefficients as supplied (not consumed yet).
    pub cp_coefficients: Vec<f64>,
    // ---- curve anchors / parameters
    /// Melting point *reference at 1 atm* (K): one point of the solid-liquid line.
    pub t_melt_ref_k: Option<f64>,
    pub dh_fus_kj_mol: Option<f64>,
    /// Heat of vaporisation (kJ/mol) quoted at `dh_vap_ref_k`; `dh_vap_at` applies the Watson correction.
    pub dh_vap_kj_mol: Option<f64>,
    pub dh_vap_ref_k: f64,
    pub vapor_curve: Option<VaporCurve>,
    /// Estimated critical temperature (K) for the Watson correction.
    pub tc_k: Option<f64>,
    /// Standard enthalpy of formation (kJ/mol), from the heat of combustion.
    pub dhf_kj_mol: Option<f64>,
    /// Reference densities at ~25 C (g/mL); the one supplied is for the room-temperature phase, the other is estimated.
    pub rho_solid: f64,
    pub rho_liquid: f64,
    /// Heat capacity of the neat phases, J/(g K).
    pub cp_j_g_k: f64,
    /// Water solubility datum at `solubility_ref_k` (g/L): becomes a saturation point of the activity model (`molecule.rs`);
    /// its temperature dependence comes from the solid-liquid equilibrium (and `dh_sol_kj_mol` when measured).
    pub solubility_g_per_l: Option<f64>,
    pub solubility_ref_k: f64,
    /// Enthalpy of solution (kJ/mol) for the temperature dependence of the solubility; None = constant.
    pub dh_sol_kj_mol: Option<f64>,
    pub color_linear_rgb: Option<[f64; 3]>,
    /// The colour with its provenance (subject, hydrate flag, confidence): `color_linear_rgb` as a solid-colour datum.
    #[serde(default)]
    pub solid_colour: Option<crate::db::record::SolidColour>,
    /// Solution absorption bands of the compound (imported UV text): the only source of a dissolved import's colour.
    #[serde(default)]
    pub uv_bands: Vec<crate::db::record::OpticsBand>,
    /// Measured refractive index of the neat compound.
    #[serde(default)]
    pub refractive_index: Option<f64>,
    /// Measured surface tension of the neat liquid, mN/m.
    #[serde(default)]
    pub surface_tension_mn_m: Option<f64>,
    /// Names of the values above that are estimates (not from the supplied data).
    pub estimated: Vec<String>,
    /// SMILES of the compound (UNIFAC groups are decomposed from it).
    #[serde(default)]
    pub smiles: Option<String>,
    /// InChIKey of the compound (links it to its store record: critical constants).
    #[serde(default)]
    pub inchi_key: Option<String>,
    /// Number of distinct measured vapour-pressure points the curve was fitted through (1 = anchored, not fitted).
    #[serde(default)]
    pub n_psat_points: usize,
}

/// Summary shown in the UI (engine -> web). Everything is derived from the fitted data, nothing is a stored mp/bp.
#[derive(Clone, Debug, Default, Serialize)]
pub struct ThermoSummary {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dhf_kj_mol: Option<f64>,
    /// Heat of vaporisation at the normal boiling point.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dh_vap_kj_mol: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dh_fus_kj_mol: Option<f64>,
    /// Where the fitted vapour-pressure curve crosses 1 atm.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub normal_bp_k: Option<f64>,
    /// The 1 atm melting reference.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub normal_mp_k: Option<f64>,
    /// Which of the quantities above are estimates: "dh_fus", "dh_vap".
    pub estimated: Vec<String>,
}

/// State at 298.15 K / 1 atm from the melting reference and the curve's 1 atm crossing; the request's `state` string
/// is only a hint, used when there is no melting reference. `fallback` applies when nothing is known.
pub fn derive_state_at_room(t_melt_ref_k: Option<f64>, normal_bp_k: Option<f64>, hint: Option<&str>, fallback: &str) -> String {
    if let Some(tm) = t_melt_ref_k {
        if tm > ROOM_REF_K {
            return "solid".into();
        }
    }
    if let Some(tb) = normal_bp_k {
        if tb < ROOM_REF_K {
            return "gas".into();
        }
    }
    if t_melt_ref_k.is_some() {
        return "liquid".into();
    }
    match hint {
        Some(h @ ("solid" | "liquid" | "gas")) => h.to_string(),
        _ if normal_bp_k.is_some() => "liquid".into(),
        _ => fallback.to_string(),
    }
}

// ---------------------------------------------------------------------------------------------- vapour-pressure fit

struct LineFit {
    a: f64,
    slope: f64,
    rss: f64,
}

/// Least-squares line y = a + slope * x.
fn linfit(xs: &[f64], ys: &[f64]) -> Option<LineFit> {
    let n = xs.len() as f64;
    if xs.len() < 2 {
        return None;
    }
    let (mx, my) = (xs.iter().sum::<f64>() / n, ys.iter().sum::<f64>() / n);
    let sxx: f64 = xs.iter().map(|x| (x - mx).powi(2)).sum();
    if sxx < 1e-30 {
        return None;
    }
    let sxy: f64 = xs.iter().zip(ys).map(|(x, y)| (x - mx) * (y - my)).sum();
    let slope = sxy / sxx;
    let a = my - slope * mx;
    let rss = xs.iter().zip(ys).map(|(x, y)| (y - a - slope * x).powi(2)).sum();
    Some(LineFit { a, slope, rss })
}

pub struct VaporFit {
    pub curve: VaporCurve,
    /// Enthalpy implied by the fit (J/mol) and the temperature it applies at; None for an anchored curve.
    pub fit_dh_j_mol: Option<(f64, f64)>,
    /// True when the slope came from Trouton's rule rather than data.
    pub trouton: bool,
}

/// Largest vapour pressure (Pa) accepted as a data point of a fitted curve.
pub const MAX_VAPOR_POINT_PA: f64 = 1.0e8;

/// Fits ln P = a - b/(T + c) to measured (T/K, P/Pa) points. Two or more distinct temperatures give a
/// Clausius-Clapeyron regression (Antoine's C is added from three points up when it clearly improves the fit).
/// A single point is anchored with the supplied heat of vaporisation (J/mol), or with Trouton's rule.
pub fn fit_vapor_curve(points: &[[f64; 2]], dh_vap_j_mol: Option<f64>) -> Option<VaporFit> {
    // average duplicate temperatures
    let mut pts: Vec<(f64, f64)> = Vec::new();
    let mut raw: Vec<(f64, f64)> = points
        .iter()
        // no liquid is above 1e8 Pa (1000 bar) at a bench temperature: such a point is a mis-parsed table, not data
        .filter(|p| p[0].is_finite() && p[1].is_finite() && p[0] > 10.0 && p[0] < 3000.0 && p[1] > 0.0 && p[1] <= MAX_VAPOR_POINT_PA)
        .map(|p| (p[0], p[1].ln()))
        .collect();
    raw.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
    for (t, y) in raw {
        match pts.last_mut() {
            Some(last) if (last.0 - t).abs() < 0.05 => last.1 = 0.5 * (last.1 + y),
            _ => pts.push((t, y)),
        }
    }
    if pts.is_empty() {
        return None;
    }
    if pts.len() >= 2 {
        let xs: Vec<f64> = pts.iter().map(|p| 1.0 / p.0).collect();
        let ys: Vec<f64> = pts.iter().map(|p| p.1).collect();
        if let Some(cc) = linfit(&xs, &ys) {
            if cc.slope < 0.0 {
                let mut best = VaporCurve { a: cc.a, b: -cc.slope, c: 0.0 };
                if pts.len() >= 3 && cc.rss > 1e-3 {
                    let tmin = pts[0].0;
                    let mut best_rss = cc.rss;
                    let mut c = -1.0;
                    while c >= -0.35 * tmin {
                        let xc: Vec<f64> = pts.iter().map(|p| 1.0 / (p.0 + c)).collect();
                        if let Some(f) = linfit(&xc, &ys) {
                            if f.slope < 0.0 && f.rss < best_rss {
                                best_rss = f.rss;
                                best = VaporCurve { a: f.a, b: -f.slope, c };
                            }
                        }
                        c -= 1.0;
                    }
                    if best_rss > 0.4 * cc.rss {
                        best = VaporCurve { a: cc.a, b: -cc.slope, c: 0.0 };
                    }
                }
                let t_mean = pts.len() as f64 / xs.iter().sum::<f64>();
                return Some(VaporFit { curve: best, fit_dh_j_mol: Some((best.slope_dh_j_mol(t_mean), t_mean)), trouton: false });
            }
        }
    }
    // single point (or inconsistent data): anchor on the point nearest 1 atm
    let ln_atm = P_ATM_PA.ln();
    let (t0, y0) = *pts.iter().min_by(|a, b| (a.1 - ln_atm).abs().partial_cmp(&(b.1 - ln_atm).abs()).unwrap()).unwrap();
    if let Some(dh) = dh_vap_j_mol.filter(|d| *d > 1000.0) {
        let b = dh / R_GAS;
        return Some(VaporFit { curve: VaporCurve { a: y0 + b / t0, b, c: 0.0 }, fit_dh_j_mol: None, trouton: false });
    }
    // Trouton + Clausius-Clapeyron through the point: dH = 88 Tb, ln(Patm/P0) = dH/R (1/Tb... ) solves in closed form
    let tb = t0 * (1.0 + R_GAS * (ln_atm - y0) / TROUTON_J_MOL_K);
    if !(tb > 20.0) {
        return None;
    }
    let b = TROUTON_J_MOL_K * tb / R_GAS;
    Some(VaporFit { curve: VaporCurve { a: y0 + b / t0, b, c: 0.0 }, fit_dh_j_mol: None, trouton: true })
}

// ---------------------------------------------------------------------------------------------- enthalpy of formation

/// Standard enthalpy of formation (kJ/mol) from the standard heat of combustion `dh_comb_kj_mol` (negative =
/// exothermic) by Hess's law: products CO2(g), H2O(l), N2(g), SO2(g). Only C/H/O/N/S compounds are covered.
/// A positive value is taken as the reported magnitude of an exothermic combustion.
pub fn dhf_from_combustion(elems: &HashMap<String, f64>, dh_comb_kj_mol: f64) -> Option<f64> {
    if elems.keys().any(|e| !matches!(e.as_str(), "C" | "H" | "O" | "N" | "S")) || !dh_comb_kj_mol.is_finite() {
        return None;
    }
    let dh_c = -dh_comb_kj_mol.abs();
    let n = |e: &str| elems.get(e).copied().unwrap_or(0.0);
    Some(n("C") * -393.51 + n("H") / 2.0 * -285.83 + n("S") * -296.84 - dh_c)
}

pub fn is_metal_element(e: &str) -> bool {
    !matches!(e, "H" | "He" | "B" | "C" | "N" | "O" | "F" | "Ne" | "Si" | "P" | "S" | "Cl" | "Ar" | "Ge" | "As" | "Se" | "Br" | "Kr" | "Te" | "I" | "Xe" | "At" | "Rn")
}

// ---------------------------------------------------------------------------------------------- the record

impl CompoundThermo {
    /// Builds the record for a modelled compound. `species` is the base species id, `fallback_state` the state used
    /// when neither data nor the request's hint say anything.
    pub fn build(req: &CompoundRequest, species: &str, mw: f64, phase_model: &str, elems: &HashMap<String, f64>, fallback_state: &str) -> Self {
        let mut estimated: Vec<String> = Vec::new();
        let t_melt_ref_k = req.t_melt_ref_k.filter(|t| t.is_finite() && *t > 1.0 && *t < 6000.0);
        let dh_vap_given = req.dh_vap_kj_mol.filter(|d| d.is_finite() && *d > 0.5);

        let fit = fit_vapor_curve(&req.vapor_pressure_points, dh_vap_given.map(|d| d * 1000.0));
        let vapor_curve = fit.as_ref().map(|f| f.curve);
        let normal_bp = vapor_curve.and_then(|c| c.t_at(P_ATM_PA));
        let tc_k = normal_bp.map(|tb| tb / TB_OVER_TC);

        let state_at_room = derive_state_at_room(t_melt_ref_k, normal_bp, req.state.as_deref(), fallback_state);
        let hint = req.state.clone().filter(|h| matches!(h.as_str(), "solid" | "liquid" | "gas"));

        // densities: the request has one value (the room-temperature phase); the other phase is estimated
        let rho = req.density.filter(|d| d.is_finite() && *d > 0.3 && *d < 25.0);
        let (rho_solid, rho_liquid) = match (rho, state_at_room.as_str()) {
            (Some(d), "solid") => {
                estimated.push("rho_liquid".into());
                (d, d * 0.9)
            }
            (Some(d), _) => {
                estimated.push("rho_solid".into());
                (d * 1.1, d)
            }
            (None, "solid") => {
                estimated.push("rho_solid".into());
                estimated.push("rho_liquid".into());
                (1.5, 1.35)
            }
            (None, _) => {
                estimated.push("rho_solid".into());
                estimated.push("rho_liquid".into());
                (1.1, 1.0)
            }
        };

        // heat capacity: supplied molar value, else Dulong-Petit for elemental solids, typical organic values otherwise
        let cp_j_mol_k = req.cp_j_mol_k.filter(|c| c.is_finite() && *c > 1.0);
        let cp_j_g_k = if let (Some(c), true) = (cp_j_mol_k, mw > 0.0) {
            c / mw
        } else {
            estimated.push("cp_j_g_k".into());
            if elems.len() == 1 && state_at_room == "solid" && mw > 0.0 {
                3.0 * R_GAS / mw
            } else if state_at_room == "solid" {
                1.3
            } else {
                2.0
            }
        };

        // heat of fusion
        let dh_fus_given = req.dh_fus_kj_mol.filter(|d| d.is_finite() && *d > 0.0);
        let dh_fus_kj_mol = match (dh_fus_given, t_melt_ref_k) {
            (Some(d), _) => Some(d),
            (None, Some(tm)) => {
                estimated.push("dh_fus".into());
                let ds = if elems.len() == 1 && elems.keys().all(|e| is_metal_element(e)) { R_GAS } else { WALDEN_J_MOL_K };
                Some(ds * tm / 1000.0)
            }
            (None, None) => None,
        };

        // heat of vaporisation: supplied, else the fitted curve's slope, else Trouton's rule at the boiling point
        let (dh_vap_kj_mol, dh_vap_ref_k) = if let Some(d) = dh_vap_given {
            (Some(d), req.dh_vap_at_k.filter(|t| t.is_finite() && *t > 1.0).unwrap_or(ROOM_REF_K))
        } else if let Some((dh, t)) = fit.as_ref().and_then(|f| f.fit_dh_j_mol) {
            (Some(dh / 1000.0), t)
        } else if let (Some(tb), true) = (normal_bp, vapor_curve.is_some()) {
            estimated.push("dh_vap".into());
            (Some(TROUTON_J_MOL_K * tb / 1000.0), tb)
        } else {
            (None, ROOM_REF_K)
        };
        if fit.as_ref().map_or(false, |f| f.trouton) && !estimated.iter().any(|e| e == "dh_vap") {
            estimated.push("dh_vap".into());
        }

        if req.solubility_g_per_l.filter(|s| s.is_finite() && *s >= 0.0).is_none() {
            estimated.push("solubility_g_per_l".into());
        }

        CompoundThermo {
            species: species.to_string(),
            name: req.name.clone(),
            formula: req.formula.clone(),
            phase_model: phase_model.to_string(),
            state_hint: hint,
            state_fallback: fallback_state.to_string(),
            mw,
            s_j_mol_k: req.s_j_mol_k.filter(|x| x.is_finite() && *x > 0.0),
            cp_j_mol_k,
            cp_coefficients: req.cp_coefficients.iter().copied().filter(|x| x.is_finite()).collect(),
            t_melt_ref_k,
            dh_fus_kj_mol,
            dh_vap_kj_mol,
            dh_vap_ref_k,
            vapor_curve,
            tc_k,
            dhf_kj_mol: req.dh_comb_kj_mol.and_then(|h| dhf_from_combustion(elems, h)),
            rho_solid,
            rho_liquid,
            cp_j_g_k,
            solubility_g_per_l: req.solubility_g_per_l.filter(|s| s.is_finite() && *s >= 0.0),
            solubility_ref_k: ROOM_REF_K,
            dh_sol_kj_mol: req.dh_sol_kj_mol.filter(|x| x.is_finite()),
            color_linear_rgb: req.color_linear_rgb.map(|c| c.map(|x| x.clamp(0.0, 1.0))),
            solid_colour: req.color_linear_rgb.map(|c| {
                let m = req.color_meta.clone().unwrap_or_default();
                crate::db::record::SolidColour {
                    rgb_linear: c.map(|x| x.clamp(0.0, 1.0)),
                    subject: m.subject.unwrap_or_else(|| "solid".to_string()),
                    hydrate: m.hydrate,
                    confidence: m.confidence.unwrap_or(0.6).clamp(0.0, 1.0),
                    phrase: m.phrase,
                }
            }),
            uv_bands: req
                .uv_bands
                .iter()
                .filter(|(nm, eps, _, _)| nm.is_finite() && eps.is_finite() && *nm > 150.0 && *nm < 2500.0 && *eps > 0.0)
                .map(|(nm, eps, fwhm, solvent)| crate::db::record::OpticsBand {
                    solvent: solvent.clone(),
                    nm: *nm,
                    eps: *eps,
                    fwhm: fwhm.filter(|w| w.is_finite() && *w > 1.0),
                    kind: None,
                })
                .collect(),
            refractive_index: req.refractive_index.filter(|n| n.is_finite() && *n > 1.0 && *n < 4.0),
            surface_tension_mn_m: req.surface_tension_mn_m.filter(|s| s.is_finite() && *s > 1.0 && *s < 600.0),
            estimated,
            smiles: req.smiles.clone(),
            inchi_key: req.inchi_key.clone(),
            n_psat_points: {
                let mut ts: Vec<f64> = req
                    .vapor_pressure_points
                    .iter()
                    .filter(|p| p[0].is_finite() && p[1].is_finite() && p[1] > 0.0 && p[1] <= MAX_VAPOR_POINT_PA)
                    .map(|p| p[0])
                    .collect();
                ts.sort_by(|a, b| a.partial_cmp(b).unwrap());
                ts.dedup_by(|a, b| (*a - *b).abs() < 0.05);
                ts.len()
            },
        }
    }

    /// State at 298.15 K / 1 atm, derived from the melting reference and the vapour-pressure curve (the stored hint
    /// and fallback only apply when there is no melting reference).
    pub fn state_at_room(&self) -> String {
        derive_state_at_room(self.t_melt_ref_k, self.normal_bp_k(), self.state_hint.as_deref(), &self.state_fallback)
    }

    pub fn is_estimated(&self, what: &str) -> bool {
        self.estimated.iter().any(|e| e == what)
    }

    /// Melting point (K) at `p_atm`: the 1 atm reference shifted by the Clapeyron equation.
    pub fn melt_k(&self, p_atm: f64) -> Option<f64> {
        let tm0 = self.t_melt_ref_k?;
        let dh = self.dh_fus_kj_mol.filter(|d| *d > 0.0)? * 1000.0;
        // molar volume change on melting, m^3/mol
        let dv = self.mw * (1.0 / self.rho_liquid - 1.0 / self.rho_solid) * 1e-6;
        let dp = (p_atm - 1.0) * P_ATM_PA;
        Some((tm0 * (1.0 + dv * dp / dh)).max(1.0))
    }

    /// Vapour pressure (Pa) of the liquid from the fitted curve.
    pub fn vapor_pressure_pa(&self, t_k: f64) -> Option<f64> {
        self.vapor_curve.map(|c| c.p_pa(t_k))
    }

    /// Boiling temperature (K) at an ambient pressure of `p_pa`.
    pub fn boil_k(&self, p_pa: f64) -> Option<f64> {
        self.vapor_curve?.t_at(p_pa)
    }

    pub fn normal_bp_k(&self) -> Option<f64> {
        self.boil_k(P_ATM_PA)
    }

    /// Heat of vaporisation (J/mol) at `t_k` (Watson relation from the quoted value).
    pub fn dh_vap_at(&self, t_k: f64) -> f64 {
        let base = self.dh_vap_kj_mol.unwrap_or(TROUTON_J_MOL_K * 400.0 / 1000.0) * 1000.0;
        match self.tc_k {
            Some(tc) if tc > 50.0 => {
                let tr = (t_k / tc).clamp(0.0, 0.98);
                let tr0 = (self.dh_vap_ref_k / tc).clamp(0.0, 0.98);
                base * ((1.0 - tr) / (1.0 - tr0)).powf(0.38)
            }
            _ => base,
        }
    }

    /// Phase of the neat compound at `t_k` and `p_atm`. Without a melting reference the state at room temperature
    /// is kept (a solid never melts, a liquid never freezes); without a vapour-pressure curve nothing boils.
    pub fn neat_phase(&self, t_k: f64, p_atm: f64) -> NeatPhase {
        match self.melt_k(p_atm) {
            Some(tm) if t_k < tm => return NeatPhase::Solid,
            None if self.state_at_room() == "solid" => return NeatPhase::Solid,
            _ => {}
        }
        match self.vapor_pressure_pa(t_k) {
            Some(p) if p >= p_atm * P_ATM_PA => NeatPhase::Gas,
            None if self.state_at_room() == "gas" => NeatPhase::Gas,
            _ => NeatPhase::Liquid,
        }
    }

    pub fn summary(&self) -> ThermoSummary {
        let normal_bp_k = self.normal_bp_k();
        let dh_vap_kj_mol = self.dh_vap_kj_mol.map(|_| self.dh_vap_at(normal_bp_k.unwrap_or(self.dh_vap_ref_k)) / 1000.0);
        let mut estimated = Vec::new();
        for k in ["dh_fus", "dh_vap"] {
            if self.is_estimated(k) {
                estimated.push(k.to_string());
            }
        }
        ThermoSummary {
            dhf_kj_mol: self.dhf_kj_mol,
            dh_vap_kj_mol,
            dh_fus_kj_mol: self.dh_fus_kj_mol,
            normal_bp_k,
            normal_mp_k: self.t_melt_ref_k,
            estimated,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn single_point_trouton_curve_hits_one_atm_at_the_point() {
        let fit = fit_vapor_curve(&[[353.15, 101325.0]], None).unwrap();
        assert!(fit.trouton);
        let tb = fit.curve.t_at(P_ATM_PA).unwrap();
        assert!((tb - 353.15).abs() < 1e-6, "{}", tb);
    }

    #[test]
    fn two_points_give_clausius_clapeyron() {
        // water: 0.0313 atm at 25 C, 1 atm at 100 C
        let fit = fit_vapor_curve(&[[298.15, 3169.0], [373.15, 101325.0]], None).unwrap();
        let dh = fit.fit_dh_j_mol.unwrap().0;
        assert!((dh - 43_000.0).abs() < 4_000.0, "dH {}", dh);
        assert!((fit.curve.t_at(P_ATM_PA).unwrap() - 373.15).abs() < 0.01);
    }

    #[test]
    fn glucose_heat_of_formation_from_combustion() {
        let e: HashMap<String, f64> = [("C".to_string(), 6.0), ("H".to_string(), 12.0), ("O".to_string(), 6.0)].into();
        let dhf = dhf_from_combustion(&e, -2803.0).unwrap();
        assert!((dhf + 1273.0).abs() < 2.0, "{}", dhf);
        assert!((dhf_from_combustion(&e, 2803.0).unwrap() - dhf).abs() < 1e-9);
    }
}
