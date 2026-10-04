//! Stage 5 seed data: the intrinsic values the solid-liquid and liquid-liquid models need, as *records*.
//!
//! Like `seed_vle.rs` this file is data, never logic. It carries
//!   * the solid-liquid line of a compound as labelled *points* (`tm`: one point of the melting curve at 1 atm, `dhfus`: the
//!     enthalpy of fusion at that point), never a stored "melting point" property: the freezing / melting temperature of
//!     a mixture is derived by the solid-liquid equilibrium of the activity model (`sle.rs`);
//!   * the heat capacity and density of the condensed phases the energy and volume balances need;
//!   * measured solubility points (mole fraction of a solute in a solvent at a temperature), which *fit* the infinite
//!     dilution activity coefficient where the group-contribution model has no groups (iodine has none);
//!   * the infinite-dilution partial molar volumes and Redlich-Kister excess-volume coefficients of the few binary
//!     mixtures whose non-additive volume is tabulated (`engine/data/excess_volume.json`, keyed by InChIKey).
//!
//! The values were written from textbook tables (CRC Handbook, NIST WebBook, Hildebrand & Scott "Regular Solutions") from
//! memory, so every datum carries the `estimated` tier and a "verify" source string; the per-user NIST proxy and the
//! pipeline replace them. Water's ice point is a definition (tabulated).

use std::collections::HashMap;

use crate::db::record::{CurvePoint, Critical, Datum, Identity, PhaseData, PhaseThermo, SpeciesRecord};
use crate::types::ProvenanceTier;

const SRC_CRC: &str = "CRC Handbook / NIST WebBook phase-change tables (recalled from memory; verify via pipeline / NIST WebBook proxy)";
const SRC_REGSOL: &str = "Hildebrand & Scott, Regular Solutions (1962), solubility of iodine at 25 C (recalled from memory; verify)";

/// (record id, Tm / K at 1 atm, enthalpy of fusion / kJ mol-1 at Tm)
const FUSION: &[(&str, f64, f64)] = &[
    ("H2O", 273.15, 6.012),
    ("C2H5OH", 159.05, 4.931),
    ("ik:VLKZOEOYAKHREP-UHFFFAOYSA-N", 177.83, 13.08),
    ("ik:YXFVVABEGXRONW-UHFFFAOYSA-N", 178.0, 6.85),
    ("ik:CSCPPACGZOOCGX-UHFFFAOYSA-N", 178.5, 5.72),
    ("I2(s)", 386.75, 15.52),
];

/// (record id, molar heat capacity / J mol-1 K-1, phase tag "l" or "s", density / g mL-1 or 0 for none)
const CONDENSED: &[(&str, &str, f64, f64)] = &[
    ("ik:VLKZOEOYAKHREP-UHFFFAOYSA-N", "l", 195.0, 0.0),
    ("ik:YXFVVABEGXRONW-UHFFFAOYSA-N", "l", 157.3, 0.0),
    ("ik:CSCPPACGZOOCGX-UHFFFAOYSA-N", "l", 125.5, 0.0),
    ("H2O(s)", "s", 37.8, 0.9167),
    ("I2(s)", "s", 54.44, 4.93),
    ("I2(l)", "l", 80.7, 3.96),
];

/// (solute record id, solvent InChIKey, T / K, mole fraction of the solute in the saturated solution)
const SOLUBILITY_X: &[(&str, &str, f64, f64)] = &[("I2(s)", "VLKZOEOYAKHREP-UHFFFAOYSA-N", 298.15, 0.0132)];

/// (record id, Andrade A, B): liquid viscosity ln(eta / cP) = A + B / T of the common solvents (recalled values, Estimated).
const VISCOSITY: &[(&str, f64, f64)] = &[
    ("C2H5OH", -6.44, 2180.0),
    ("ik:CSCPPACGZOOCGX-UHFFFAOYSA-N", -4.20, 1050.0),
    ("ik:VLKZOEOYAKHREP-UHFFFAOYSA-N", -4.00, 950.0),
];

/// (solid record id, specific surface area / m2 g-1): the BET area of the material in its usual powder form, for solids that
/// act as surface catalysts. A solid without an entry has the geometric surface of its particles.
const SPECIFIC_AREA: &[(&str, f64)] = &[("MnO2(s)", 50.0)];
const SRC_BET: &str = "typical fine MnO2 powder grade (assumed value; replace with the supplier's BET area)";

fn d(v: f64, unit: &str, tier: ProvenanceTier, src: &str) -> Datum {
    Datum::new(v, unit, tier, src)
}

fn molecule_record(id: &str, formula: &str, inchikey: &str, smiles: &str, name: &str) -> SpeciesRecord {
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
        phases: HashMap::new(),
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

fn phase_with_cp(cp: f64, tier: ProvenanceTier, src: &str) -> PhaseThermo {
    PhaseThermo { model: "cp-only".to_string(), tier: tier.clone(), source: src.to_string(), cp: Some(d(cp, "J/(mol K)", tier, src)), ..Default::default() }
}

/// Records for the condensed and gas phases of iodine (the molecule whose dissolved form `I2(aq)` is a seed species) and
/// ice (the solid phase of water): same InChIKey as their liquid / aqueous twins, so the store groups them.
fn extra_records() -> Vec<SpeciesRecord> {
    let ik_i2 = "PNDPGZBMCMUPRI-UHFFFAOYSA-N";
    let ik_w = "XLYOFNOQVPJJNP-UHFFFAOYSA-N";
    let nbs = "NBS Tables (recalled from memory; verify)";
    let mut i2s = molecule_record("I2(s)", "I2", ik_i2, "II", "iodine");
    i2s.phases.insert(
        "s".to_string(),
        PhaseData {
            thermo: Some(PhaseThermo {
                model: "point+cp".to_string(),
                tier: ProvenanceTier::Estimated,
                source: nbs.to_string(),
                dfH: Some(d(0.0, "kJ/mol", ProvenanceTier::Estimated, nbs)),
                dfG: Some(d(0.0, "kJ/mol", ProvenanceTier::Estimated, nbs)),
                S: Some(d(0.0, "J/(mol K)", ProvenanceTier::Estimated, nbs)),
                cp: Some(d(54.44, "J/(mol K)", ProvenanceTier::Estimated, nbs)),
                ranges: None,
                params: None,
            }),
            volume: None,
            rho: None,
            polymorph: None,
            specific_area: None,
        },
    );
    let mut i2l = molecule_record("I2(l)", "I2", ik_i2, "II", "iodine");
    i2l.phases.insert("l".to_string(), PhaseData::default());
    i2l.critical = Some(Critical {
        Tc: Some(d(819.0, "K", ProvenanceTier::Estimated, "Reid-Prausnitz-Poling App. A (recalled from memory; verify)")),
        Pc: Some(d(11.7e6, "Pa", ProvenanceTier::Estimated, "Reid-Prausnitz-Poling App. A (recalled from memory; verify)")),
        Vc: None,
        omega: Some(d(0.229, "1", ProvenanceTier::Estimated, "Reid-Prausnitz-Poling App. A (recalled from memory; verify)")),
    });
    i2l.points.push(CurvePoint {
        kind: "psat".to_string(),
        T_K: Some(457.55),
        P_Pa: Some(101_325.0),
        solvent: None,
        value: None,
        unit: None,
        tier: ProvenanceTier::Estimated,
        source: "normal boiling point of iodine, CRC Handbook (recalled from memory; verify)".to_string(),
        uncertainty: None,
    });
    let mut i2g = molecule_record("I2(g)", "I2", ik_i2, "II", "iodine");
    i2g.phases.insert(
        "g".to_string(),
        PhaseData {
            thermo: Some(PhaseThermo {
                model: "point+cp".to_string(),
                tier: ProvenanceTier::Estimated,
                source: nbs.to_string(),
                dfH: Some(d(62.42, "kJ/mol", ProvenanceTier::Estimated, nbs)),
                dfG: Some(d(19.33, "kJ/mol", ProvenanceTier::Estimated, nbs)),
                S: Some(d((62.42 - 19.33) * 1000.0 / 298.15, "J/(mol K)", ProvenanceTier::Estimated, nbs)),
                cp: Some(d(36.9, "J/(mol K)", ProvenanceTier::Estimated, nbs)),
                ranges: None,
                params: None,
            }),
            volume: None,
            rho: None,
            polymorph: None,
            specific_area: None,
        },
    );
    let mut ice = molecule_record("H2O(s)", "H2O", ik_w, "O", "ice");
    ice.phases.insert("s".to_string(), PhaseData::default());
    vec![i2s, i2l, i2g, ice]
}

/// Adds the Stage 5 records and attaches the fusion points, condensed-phase heat capacities and densities and the
/// measured solubility points above.
pub fn attach_phase_data(records: &mut Vec<SpeciesRecord>) {
    for r in extra_records() {
        if !records.iter().any(|x| x.id == r.id) {
            records.push(r);
        }
    }
    for rec in records.iter_mut() {
        if let Some(&(_, tm, dh)) = FUSION.iter().find(|(id, ..)| *id == rec.id) {
            let tm_tier = if rec.id == "H2O" { ProvenanceTier::Tabulated } else { ProvenanceTier::Estimated };
            let tm_src = if rec.id == "H2O" { "ice point (definition of the Celsius scale)" } else { SRC_CRC };
            rec.points.push(CurvePoint {
                kind: "tm".to_string(),
                T_K: Some(tm),
                P_Pa: Some(101_325.0),
                solvent: None,
                value: None,
                unit: None,
                tier: tm_tier,
                source: tm_src.to_string(),
                uncertainty: None,
            });
            rec.points.push(CurvePoint {
                kind: "dhfus".to_string(),
                T_K: Some(tm),
                P_Pa: Some(101_325.0),
                solvent: None,
                value: Some(dh),
                unit: Some("kJ/mol".to_string()),
                tier: ProvenanceTier::Estimated,
                source: SRC_CRC.to_string(),
                uncertainty: None,
            });
        }
        if let Some(&(_, a, b)) = VISCOSITY.iter().find(|(id, ..)| *id == rec.id) {
            rec.transport = Some(crate::db::record::Transport {
                eta_l: Some(serde_json::json!({ "A": a, "B": b, "tier": "estimated", "source": SRC_CRC })),
                sigma: None,
            });
        }
        if let Some(&(_, area)) = SPECIFIC_AREA.iter().find(|(id, _)| *id == rec.id) {
            let entry = rec.phases.entry("s".to_string()).or_default();
            entry.specific_area = Some(d(area, "m2/g", ProvenanceTier::Estimated, SRC_BET));
        }
        if let Some(&(_, ph, cp, rho)) = CONDENSED.iter().find(|(id, ..)| *id == rec.id) {
            let entry = rec.phases.entry(ph.to_string()).or_default();
            if entry.thermo.is_none() {
                entry.thermo = Some(phase_with_cp(cp, ProvenanceTier::Estimated, SRC_CRC));
            } else if let Some(t) = entry.thermo.as_mut() {
                if t.cp.is_none() {
                    t.cp = Some(d(cp, "J/(mol K)", ProvenanceTier::Estimated, SRC_CRC));
                }
            }
            if rho > 0.0 && entry.rho.is_none() {
                entry.rho = Some(d(rho, "g/mL", ProvenanceTier::Estimated, SRC_CRC));
            }
        }
        if let Some(&(_, solvent_ik, t, x)) = SOLUBILITY_X.iter().find(|(id, ..)| *id == rec.id) {
            rec.points.push(CurvePoint {
                kind: "solubility".to_string(),
                T_K: Some(t),
                P_Pa: None,
                solvent: Some(solvent_ik.to_string()),
                value: Some(x),
                unit: Some("x".to_string()),
                tier: ProvenanceTier::Estimated,
                source: SRC_REGSOL.to_string(),
                uncertainty: None,
            });
        }
    }
}
