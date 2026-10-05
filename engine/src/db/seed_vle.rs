//! Stage 4 seed data: the intrinsic constants the gas-phase / vapour-liquid-equilibrium models need, as *records*.
//!
//! Everything here is data with an honest tier and source, never logic:
//!   * critical constants and acentric factors (Peng-Robinson EOS, Lee-Kesler vapour pressure, Rackett volume),
//!   * labelled saturation-pressure points `(T, P)` (normal boiling points / the CO2 triple point): they anchor the
//!     corresponding-states curve; a boiling point is never a stored property, only one point on the curve,
//!   * water's reference saturation-pressure equation (IAPWS-IF97 region 4, a standard formulation),
//!   * the composition of the default atmosphere (a room input, see `Atmosphere`).
//!
//! The constants were written from the textbook tables (Reid, Prausnitz & Poling, "The Properties of Gases and
//! Liquids", 4th ed., appendix A) from memory, so they carry the `estimated` tier and a "verify" source string; the
//! pipeline (`pipeline/db`) and the per-user NIST WebBook proxy replace them. IAPWS values (water) are the standard
//! reference constants and are tabulated.

use std::collections::HashMap;

use crate::db::record::{CurvePoint, Critical, Datum, Identity, PhaseData, PhaseVolume, SpeciesRecord, VaporPressureSpec};
use crate::types::ProvenanceTier;

/// (record id, Tc / K, Pc / bar, omega)
const CRITICAL: &[(&str, f64, f64, f64)] = &[
    ("C2H5OH", 513.92, 61.48, 0.649),
    ("N2(g)", 126.2, 33.98, 0.037),
    ("O2(g)", 154.58, 50.43, 0.022),
    ("Ar(g)", 150.86, 48.98, -0.002),
    ("CO2(g)", 304.13, 73.77, 0.224),
    ("NH3(g)", 405.5, 113.5, 0.253),
    ("H2(g)", 33.19, 13.13, -0.216),
    ("HCl(g)", 324.7, 83.1, 0.132),
    ("Cl2(g)", 417.2, 77.1, 0.069),
    ("Br2(l)", 588.0, 103.0, 0.108),
    ("SO2(g)", 430.8, 78.8, 0.245),
    ("CH4(g)", 190.56, 45.99, 0.011),
    ("CO(g)", 132.85, 34.94, 0.045),
    ("NO(g)", 180.0, 64.8, 0.583),
    ("HBr(g)", 363.2, 85.5, 0.063),
    ("HI(g)", 424.0, 83.1, 0.05),
    ("F2(g)", 144.3, 52.2, 0.053),
    ("O3(g)", 261.0, 55.7, 0.212),
    ("ik:VLKZOEOYAKHREP-UHFFFAOYSA-N", 507.6, 30.25, 0.301),
    ("ik:YXFVVABEGXRONW-UHFFFAOYSA-N", 591.75, 41.08, 0.264),
    ("ik:CSCPPACGZOOCGX-UHFFFAOYSA-N", 508.1, 47.0, 0.307),
];

/// (record id, T / K, P / Pa): one point of the saturation curve of the liquid (the normal boiling point, or the triple
/// point for CO2 which has no liquid at 1 atm).
const PSAT_POINTS: &[(&str, f64, f64)] = &[
    ("C2H5OH", 351.44, 101_325.0),
    ("N2(g)", 77.36, 101_325.0),
    ("O2(g)", 90.19, 101_325.0),
    ("Ar(g)", 87.30, 101_325.0),
    ("CO2(g)", 216.59, 518_500.0),
    ("NH3(g)", 239.82, 101_325.0),
    ("H2(g)", 20.28, 101_325.0),
    ("HCl(g)", 188.1, 101_325.0),
    ("Cl2(g)", 239.11, 101_325.0),
    ("Br2(l)", 332.0, 101_325.0),
    ("SO2(g)", 263.13, 101_325.0),
    ("CH4(g)", 111.66, 101_325.0),
    ("CO(g)", 81.66, 101_325.0),
    ("NO(g)", 121.4, 101_325.0),
    ("HBr(g)", 206.45, 101_325.0),
    ("HI(g)", 237.8, 101_325.0),
    ("F2(g)", 85.03, 101_325.0),
    ("O3(g)", 161.3, 101_325.0),
    ("ik:VLKZOEOYAKHREP-UHFFFAOYSA-N", 341.88, 101_325.0),
    ("ik:YXFVVABEGXRONW-UHFFFAOYSA-N", 383.78, 101_325.0),
    ("ik:CSCPPACGZOOCGX-UHFFFAOYSA-N", 329.22, 101_325.0),
];

/// (record id, Rackett parameter Z_RA of the liquid): the Spencer-Danner estimate from the acentric factor is poor for
/// associating liquids (ethanol), so the measured parameters are records too.
const RACKETT_ZRA: &[(&str, f64)] = &[
    ("C2H5OH", 0.2502),
    ("ik:VLKZOEOYAKHREP-UHFFFAOYSA-N", 0.264),
    ("ik:YXFVVABEGXRONW-UHFFFAOYSA-N", 0.264),
    ("ik:CSCPPACGZOOCGX-UHFFFAOYSA-N", 0.233),
];

const SRC_RPP: &str = "Reid-Prausnitz-Poling, Properties of Gases and Liquids 4th ed. App. A (recalled from memory; verify via pipeline / NIST WebBook proxy)";
const SRC_NBP: &str = "normal boiling point, NIST WebBook / RPP (recalled from memory; verify)";

fn bare_record(id: &str, formula: &str, inchikey: &str, smiles: &str, name: &str) -> SpeciesRecord {
    SpeciesRecord {
        id: id.to_string(),
        identity: Identity {
            inchikey: Some(inchikey.to_string()),
            smiles: Some(smiles.to_string()),
            formula: formula.to_string(),
            charge: 0,
            cas: None,
            cid: None,
            names: vec![name.to_string()],
            db_names: HashMap::new(),
        },
        phases: HashMap::<String, PhaseData>::new(),
        critical: None,
        points: Vec::new(),
        vapor_pressure: None,
        unifac_groups: None,
        acid_base: Vec::new(),
        redox: Vec::new(),
        optics: None,
        transport: None,
        kinetics_refs: Vec::new(),
        rejected: Vec::new(),
    }
}

/// Records that exist only to carry VLE data for molecules the engine knows no reaction chemistry for.
fn extra_records() -> Vec<SpeciesRecord> {
    vec![
        bare_record("Ar(g)", "Ar", "XKRFYHLGVUSROY-UHFFFAOYSA-N", "[Ar]", "argon"),
        bare_record("ik:VLKZOEOYAKHREP-UHFFFAOYSA-N", "C6H14", "VLKZOEOYAKHREP-UHFFFAOYSA-N", "CCCCCC", "hexane"),
        bare_record("ik:YXFVVABEGXRONW-UHFFFAOYSA-N", "C7H8", "YXFVVABEGXRONW-UHFFFAOYSA-N", "Cc1ccccc1", "toluene"),
        bare_record("ik:CSCPPACGZOOCGX-UHFFFAOYSA-N", "C3H6O", "CSCPPACGZOOCGX-UHFFFAOYSA-N", "CC(C)=O", "acetone"),
    ]
}

/// Adds the Stage 4 records and attaches critical constants, saturation points and water's reference curve.
pub fn attach_vle_data(records: &mut Vec<SpeciesRecord>) {
    for r in extra_records() {
        if !records.iter().any(|x| x.id == r.id) {
            records.push(r);
        }
    }
    for rec in records.iter_mut() {
        if let Some(&(_, tc, pc_bar, omega)) = CRITICAL.iter().find(|(id, ..)| *id == rec.id) {
            let d = |v: f64, unit: &str| Datum::new(v, unit, ProvenanceTier::Estimated, SRC_RPP);
            rec.critical = Some(Critical { Tc: Some(d(tc, "K")), Pc: Some(d(pc_bar * 1.0e5, "Pa")), Vc: None, omega: Some(d(omega, "1")) });
        }
        if let Some(&(_, z)) = RACKETT_ZRA.iter().find(|(id, _)| *id == rec.id) {
            let l = rec.phases.entry("l".to_string()).or_default();
            l.volume = Some(PhaseVolume { model: Some("rackett".to_string()), zra: Some(Datum::new(z, "1", ProvenanceTier::Estimated, SRC_RPP)), v0: None });
        }
        if let Some(&(_, t, p)) = PSAT_POINTS.iter().find(|(id, ..)| *id == rec.id) {
            rec.points.push(CurvePoint {
                kind: "psat".to_string(),
                T_K: Some(t),
                P_Pa: Some(p),
                solvent: None,
                value: None,
                unit: None,
                tier: ProvenanceTier::Estimated,
                source: SRC_NBP.to_string(),
                uncertainty: None,
            });
        }
        // Water: the IAPWS standard constants and the IF97 region-4 saturation-pressure equation (tabulated).
        if rec.id == "H2O" {
            let d = |v: f64, unit: &str| Datum::new(v, unit, ProvenanceTier::Tabulated, "IAPWS R6-95 (2018) critical constants");
            rec.critical = Some(Critical { Tc: Some(d(647.096, "K")), Pc: Some(d(22.064e6, "Pa")), Vc: None, omega: Some(Datum::new(0.3443, "1", ProvenanceTier::Tabulated, "RPP / IAPWS (acentric factor)")) });
            if let Some(l) = rec.phases.get_mut("l") {
                l.volume = Some(PhaseVolume { model: Some("iapws-saturated-liquid".to_string()), zra: None, v0: None });
            }
            rec.vapor_pressure = Some(VaporPressureSpec {
                model: "iapws-if97-region4".to_string(),
                params: None,
                t_min_k: Some(273.15),
                t_max_k: Some(647.096),
                tier: ProvenanceTier::Tabulated,
                source: "IAPWS-IF97 (R7-97) region 4 saturation-pressure equation, 273.15 K to the critical point".to_string(),
            });
        }
    }
}

/// Composition of dry air (mole fractions, gas species ids): the default atmosphere an open vessel exchanges with.
/// US Standard Atmosphere 1976 with CO2 at 420 ppm (current annual mean); argon and the trace gases lumped into Ar.
pub const STANDARD_DRY_AIR: &[(&str, f64)] = &[("N2(g)", 0.78084), ("O2(g)", 0.20946), ("Ar(g)", 0.00934), ("CO2(g)", 0.00042)];

/// Relative saturation (humidity) of condensable vapours in the default atmosphere: a typical indoor 50 %.
pub const STANDARD_RELATIVE_SATURATION: &[(&str, f64)] = &[("H2O(g)", 0.5)];

/// The liquid that seals an over-water gas collector (a property of that glassware kind): its own saturation pressure,
/// from its species record, is the vapour in the collected gas.
pub const OVER_WATER_SEAL_LIQUID: &str = "H2O";
