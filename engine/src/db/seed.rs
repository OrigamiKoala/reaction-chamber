use std::collections::HashMap;
use crate::types::ProvenanceTier;
use crate::db::record::{
    Datum, Identity, PhaseData, PhaseThermo, RedoxCouple, SpeciesRecord,
};

fn make_aq(id: &str, formula: &str, charge: i32, df_h: f64, df_g: f64, cp: f64, inchi: Option<&str>, smiles: Option<&str>) -> SpeciesRecord {
    let mut phases = HashMap::new();
    let thermo = PhaseThermo {
        model: "point+cp".to_string(),
        tier: ProvenanceTier::Tabulated,
        source: "NBS Tables / llnl.dat".to_string(),
        dfH: Some(Datum::new(df_h, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
        dfG: Some(Datum::new(df_g, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
        S: Some(Datum::new((df_h - df_g) * 1000.0 / 298.15, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
        cp: Some(Datum::new(cp, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
        ranges: None,
        params: None,
    };
    phases.insert("aq".to_string(), PhaseData {
        thermo: Some(thermo),
        volume: None,
        rho: None,
        polymorph: None,
        specific_area: None,
    });

    let mut names = vec![id.to_string()];
    if id == "CH3COO-" {
        names.push("acetate".to_string());
    } else if id == "CH3COOH" {
        names.push("acetic_acid".to_string());
    }

    SpeciesRecord {
        id: id.to_string(),
        identity: Identity {
            inchikey: inchi.map(|s| s.to_string()),
            smiles: smiles.map(|s| s.to_string()),
            formula: formula.to_string(),
            charge,
            cas: None,
            cid: None,
            names,
            db_names: HashMap::new(),
        },
        phases,
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

/// A dissolved species whose identity (formula, charge) is known but whose formation data are not: the record carries no
/// thermodynamic datum, so nothing that needs one (redox discovery, detailed balance) can use an invented value. Its
/// equilibria are the stability / acidity constants of the equilibrium rows.
fn make_aq_identity(id: &str, formula: &str, charge: i32) -> SpeciesRecord {
    let mut rec = make_aq(id, formula, charge, 0.0, 0.0, 0.0, None, None);
    rec.phases.insert("aq".to_string(), PhaseData::default());
    rec
}

/// A dissolved species whose formation data are derived from a measured stability constant and the formation data of its
/// parts (`dfG = -RT ln K + sum dfG(parts)`, same for dfH from the reaction enthalpy): tier Estimated.
fn make_aq_derived(id: &str, formula: &str, charge: i32, df_h: f64, df_g: f64, cp: f64, source: &str) -> SpeciesRecord {
    let mut rec = make_aq(id, formula, charge, df_h, df_g, cp, None, None);
    if let Some(t) = rec.phases.get_mut("aq").and_then(|p| p.thermo.as_mut()) {
        t.tier = ProvenanceTier::Estimated;
        t.source = source.to_string();
        for d in [t.dfH.as_mut(), t.dfG.as_mut(), t.S.as_mut(), t.cp.as_mut()].into_iter().flatten() {
            d.tier = ProvenanceTier::Estimated;
            d.source = source.to_string();
        }
    }
    rec
}

/// A neutral molecule the engine has chemistry for (acid-base equilibria, kinetics) whose formation data are not seeded:
/// its identity (formula, InChIKey) is what lets an import be recognised as this species. Imports are matched on the
/// InChIKey, never on the formula alone (isomers share a formula).
fn make_identity(id: &str, formula: &str, inchikey: &str) -> SpeciesRecord {
    let mut rec = make_aq(id, formula, 0, 0.0, 0.0, 0.0, Some(inchikey), None);
    rec.phases.insert("aq".to_string(), PhaseData::default());
    rec
}

fn make_liquid(id: &str, formula: &str, df_h: f64, df_g: f64, cp: f64, inchi: &str, smiles: &str) -> SpeciesRecord {
    let mut phases = HashMap::new();
    phases.insert("l".to_string(), PhaseData {
        thermo: Some(PhaseThermo {
            model: "point+cp".to_string(),
            tier: ProvenanceTier::Tabulated,
            source: "NBS Tables".to_string(),
            dfH: Some(Datum::new(df_h, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
            dfG: Some(Datum::new(df_g, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
            S: Some(Datum::new((df_h - df_g) * 1000.0 / 298.15, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
            cp: Some(Datum::new(cp, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
            ranges: None,
            params: None,
        }),
        volume: None,
        rho: None,
        polymorph: None,
        specific_area: None,
    });

    let mut names = vec![id.to_string()];
    if id == "C2H5OH" {
        names.push("ethanol".to_string());
    } else if id == "CH3OH" {
        names.push("methanol".to_string());
    } else if id == "H2O" {
        names.push("water".to_string());
    } else if id == "ethyl_acetate" {
        names.push("CC(=O)OCC".to_string());
        names.push("EtOAc".to_string());
        names.push("CH3COOC2H5".to_string());
    } else if id == "bromoethane" {
        names.push("CCBr".to_string());
        names.push("ethyl_bromide".to_string());
    } else if id == "2-bromopropane" {
        names.push("CH3CH(Br)CH3".to_string());
        names.push("CC(Br)C".to_string());
        names.push("isopropyl_bromide".to_string());
    } else if id == "acetone" {
        names.push("CH3COCH3".to_string());
        names.push("CC(=O)C".to_string());
    } else if id == "benzene" {
        names.push("c1ccccc1".to_string());
    } else if id == "cyclohexene" {
        names.push("C1=CCCCC1".to_string());
    }

    SpeciesRecord {
        id: id.to_string(),
        identity: Identity {
            inchikey: Some(inchi.to_string()),
            smiles: Some(smiles.to_string()),
            formula: formula.to_string(),
            charge: 0,
            cas: None,
            cid: None,
            names,
            db_names: HashMap::new(),
        },
        phases,
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

fn make_gas(id: &str, formula: &str, df_h: f64, df_g: f64, cp: f64, inchi: Option<&str>) -> SpeciesRecord {
    let mut phases = HashMap::new();
    phases.insert("g".to_string(), PhaseData {
        thermo: Some(PhaseThermo {
            model: "point+cp".to_string(),
            tier: ProvenanceTier::Tabulated,
            source: "NBS Tables".to_string(),
            dfH: Some(Datum::new(df_h, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
            dfG: Some(Datum::new(df_g, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
            S: Some(Datum::new((df_h - df_g) * 1000.0 / 298.15, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
            cp: Some(Datum::new(cp, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
            ranges: None,
            params: None,
        }),
        volume: None,
        rho: None,
        polymorph: None,
        specific_area: None,
    });

    let mut names = vec![id.to_string()];
    if id == "ethene" {
        names.push("ethylene".to_string());
        names.push("C=C".to_string());
    }

    SpeciesRecord {
        id: id.to_string(),
        identity: Identity {
            inchikey: inchi.map(|s| s.to_string()),
            smiles: if id == "ethene" { Some("C=C".to_string()) } else { None },
            formula: formula.to_string(),
            charge: 0,
            cas: None,
            cid: None,
            names,
            db_names: HashMap::new(),
        },
        phases,
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

fn make_solid(id: &str, formula: &str, df_h: f64, df_g: f64, cp: f64, density: f64) -> SpeciesRecord {
    make_solid_with_params(id, formula, df_h, df_g, cp, density, None)
}

fn make_solid_ik(id: &str, formula: &str, df_h: f64, df_g: f64, cp: f64, density: f64, inchikey: &str) -> SpeciesRecord {
    let mut rec = make_solid(id, formula, df_h, df_g, cp, density);
    rec.identity.inchikey = Some(inchikey.to_string());
    rec
}

fn make_solid_with_analytic(id: &str, formula: &str, df_h: f64, df_g: f64, cp: f64, density: f64, analytic: [f64; 5]) -> SpeciesRecord {
    make_solid_with_params(id, formula, df_h, df_g, cp, density, Some(analytic))
}

fn make_solid_with_shomate(
    id: &str,
    formula: &str,
    df_h: f64,
    df_g: f64,
    cp: f64,
    density: f64,
    analytic: Option<[f64; 5]>,
    shomate: [f64; 8],
) -> SpeciesRecord {
    let mut phases = HashMap::new();
    phases.insert("s".to_string(), PhaseData {
        thermo: Some(PhaseThermo {
            model: "shomate".to_string(),
            tier: ProvenanceTier::Tabulated,
            source: "NBS Tables / NIST WebBook".to_string(),
            dfH: Some(Datum::new(df_h, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
            dfG: Some(Datum::new(df_g, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
            S: Some(Datum::new((df_h - df_g) * 1000.0 / 298.15, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
            cp: Some(Datum::new(cp, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
            ranges: Some(serde_json::to_value(&shomate).unwrap()),
            params: analytic.map(|a| serde_json::to_value(a).unwrap()),
        }),
        volume: None,
        rho: Some(Datum::new(density, "g/mL", ProvenanceTier::Tabulated, "CRC / NBS")),
        polymorph: None,
        specific_area: None,
    });

    SpeciesRecord {
        id: id.to_string(),
        identity: Identity {
            inchikey: None,
            smiles: None,
            formula: formula.to_string(),
            charge: 0,
            cas: None,
            cid: None,
            names: vec![id.to_string()],
            db_names: HashMap::new(),
        },
        phases,
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

fn make_gas_with_shomate(id: &str, formula: &str, df_h: f64, df_g: f64, cp: f64, inchi: Option<&str>, shomate: [f64; 8]) -> SpeciesRecord {
    let mut phases = HashMap::new();
    phases.insert("g".to_string(), PhaseData {
        thermo: Some(PhaseThermo {
            model: "shomate".to_string(),
            tier: ProvenanceTier::Tabulated,
            source: "NIST WebBook / JANAF".to_string(),
            dfH: Some(Datum::new(df_h, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
            dfG: Some(Datum::new(df_g, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
            S: Some(Datum::new((df_h - df_g) * 1000.0 / 298.15, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
            cp: Some(Datum::new(cp, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
            ranges: Some(serde_json::to_value(&shomate).unwrap()),
            params: None,
        }),
        volume: None,
        rho: None,
        polymorph: None,
        specific_area: None,
    });

    let names = vec![id.to_string()];
    SpeciesRecord {
        id: id.to_string(),
        identity: Identity {
            inchikey: inchi.map(|s| s.to_string()),
            smiles: None,
            formula: formula.to_string(),
            charge: 0,
            cas: None,
            cid: None,
            names,
            db_names: HashMap::new(),
        },
        phases,
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

fn make_solid_with_params(id: &str, formula: &str, df_h: f64, df_g: f64, cp: f64, density: f64, analytic: Option<[f64; 5]>) -> SpeciesRecord {
    let mut phases = HashMap::new();
    phases.insert("s".to_string(), PhaseData {
        thermo: Some(PhaseThermo {
            model: if analytic.is_some() { "analytic".to_string() } else { "point+cp".to_string() },
            tier: ProvenanceTier::Tabulated,
            source: "NBS Tables / llnl.dat".to_string(),
            dfH: Some(Datum::new(df_h, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
            dfG: Some(Datum::new(df_g, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
            S: Some(Datum::new((df_h - df_g) * 1000.0 / 298.15, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
            cp: Some(Datum::new(cp, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
            ranges: None,
            params: analytic.map(|a| serde_json::to_value(a).unwrap()),
        }),
        volume: None,
        rho: Some(Datum::new(density, "g/mL", ProvenanceTier::Tabulated, "CRC / NBS")),
        polymorph: None,
        specific_area: None,
    });

    SpeciesRecord {
        id: id.to_string(),
        identity: Identity {
            inchikey: None,
            smiles: None,
            formula: formula.to_string(),
            charge: 0,
            cas: None,
            cid: None,
            names: vec![id.to_string()],
            db_names: HashMap::new(),
        },
        phases,
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

/// Rows of `data/species_inorganic.json`: common inorganic species with NBS formation data (recalled, tier Estimated).
#[derive(serde::Deserialize)]
struct InorganicFile {
    aq: Vec<(String, String, i32, f64, f64, Option<f64>, Option<String>)>,
    s: Vec<(String, String, f64, f64, f64, f64)>,
    l: Vec<(String, String, f64, f64, f64, String, String)>,
    g: Vec<(String, String, f64, f64, f64, Option<String>)>,
}

const SRC_INORGANIC: &str = "NBS Tables of Chemical Thermodynamic Properties (1982) / CRC Handbook, recalled from memory (verify via the pipeline's NBS parser)";

/// Marks every datum of the record as recalled (Estimated) rather than checked against the table.
fn label_recalled(mut rec: SpeciesRecord, cp_known: bool) -> SpeciesRecord {
    for p in rec.phases.values_mut() {
        if let Some(t) = p.thermo.as_mut() {
            t.tier = ProvenanceTier::Estimated;
            t.source = SRC_INORGANIC.to_string();
            if !cp_known {
                t.cp = None;
            }
            for d in [t.dfH.as_mut(), t.dfG.as_mut(), t.S.as_mut(), t.cp.as_mut()].into_iter().flatten() {
                d.tier = ProvenanceTier::Estimated;
                d.source = SRC_INORGANIC.to_string();
            }
        }
        if let Some(r) = p.rho.as_mut() {
            r.tier = ProvenanceTier::Estimated;
            r.source = SRC_INORGANIC.to_string();
        }
    }
    rec
}

fn inorganic_species() -> Vec<SpeciesRecord> {
    let f: InorganicFile = serde_json::from_str(include_str!("../../data/species_inorganic.json")).expect("data/species_inorganic.json");
    let mut out = Vec::new();
    for (id, formula, charge, h, g, cp, ik) in &f.aq {
        let rec = make_aq(id, formula, *charge, *h, *g, cp.unwrap_or(0.0), ik.as_deref(), None);
        out.push(label_recalled(rec, cp.is_some()));
    }
    for (id, formula, h, g, cp, rho) in &f.s {
        out.push(label_recalled(make_solid(id, formula, *h, *g, *cp, *rho), true));
    }
    for (id, formula, h, g, cp, ik, smiles) in &f.l {
        out.push(label_recalled(make_liquid(id, formula, *h, *g, *cp, ik, smiles), true));
    }
    for (id, formula, h, g, cp, ik) in &f.g {
        out.push(label_recalled(make_gas(id, formula, *h, *g, *cp, ik.as_deref()), true));
    }
    out
}

/// Rows of `data/species_tabulated.json` (generated by `pipeline/db/build_engine_species.py` from the OBIGT database):
/// standard formation data of ~1200 inorganic species at 298.15 K, tier Tabulated with the reference of each row.
#[derive(serde::Deserialize)]
struct TabulatedFile {
    source: String,
    rows: Vec<TabulatedRow>,
}

#[derive(serde::Deserialize)]
struct TabulatedRow {
    id: String,
    phase: String,
    formula: String,
    charge: i32,
    #[serde(rename = "dfH")]
    df_h: f64,
    #[serde(rename = "dfG")]
    df_g: f64,
    cp: Option<f64>,
    density: Option<f64>,
    inchikey: Option<String>,
    #[serde(rename = "ref")]
    reference: String,
}

fn tabulated_species() -> Vec<SpeciesRecord> {
    let f: TabulatedFile = serde_json::from_str(include_str!("../../data/species_tabulated.json")).expect("data/species_tabulated.json");
    let mut out = Vec::new();
    for r in &f.rows {
        let mut rec = match r.phase.as_str() {
            "aq" => make_aq(&r.id, &r.formula, r.charge, r.df_h, r.df_g, r.cp.unwrap_or(0.0), r.inchikey.as_deref(), None),
            "s" => make_solid(&r.id, &r.formula, r.df_h, r.df_g, r.cp.unwrap_or(0.0), r.density.unwrap_or(0.0)),
            "g" => make_gas(&r.id, &r.formula, r.df_h, r.df_g, r.cp.unwrap_or(0.0), r.inchikey.as_deref()),
            "l" => {
                let mut l = make_liquid(&r.id, &r.formula, r.df_h, r.df_g, r.cp.unwrap_or(0.0), r.inchikey.as_deref().unwrap_or(""), "");
                if l.identity.inchikey.as_deref() == Some("") {
                    l.identity.inchikey = None;
                }
                if l.identity.smiles.as_deref() == Some("") {
                    l.identity.smiles = None;
                }
                l
            }
            other => panic!("species_tabulated.json: unknown phase {other}"),
        };
        rec.identity.charge = r.charge;
        let source = format!("{} ({})", f.source, r.reference);
        for p in rec.phases.values_mut() {
            if let Some(t) = p.thermo.as_mut() {
                t.source = source.clone();
                if r.cp.is_none() {
                    t.cp = None;
                }
                for d in [t.dfH.as_mut(), t.dfG.as_mut(), t.S.as_mut(), t.cp.as_mut()].into_iter().flatten() {
                    d.source = source.clone();
                }
            }
            if r.density.is_none() {
                p.rho = None;
            } else if let Some(d) = p.rho.as_mut() {
                d.source = source.clone();
            }
        }
        out.push(rec);
    }
    out
}

/// Rows of `data/redox_couples.json`: the self-exchange rate of oxo-transfer couples, attached to the oxidised form's record.
#[derive(serde::Deserialize)]
struct RedoxCoupleFile {
    couples: Vec<RedoxCoupleRow>,
}

#[derive(serde::Deserialize)]
struct RedoxCoupleRow {
    reduced: Vec<String>,
    oxidised: Vec<String>,
    n_electrons: i32,
    #[serde(rename = "E0_V")]
    e0_v: f64,
    k_self: f64,
    tier: ProvenanceTier,
    source: String,
}

/// Gives every record of an oxidised form the couples of `data/redox_couples.json` (species the store does not hold are skipped).
fn attach_redox_couples(records: &mut [SpeciesRecord]) {
    let f: RedoxCoupleFile = serde_json::from_str(include_str!("../../data/redox_couples.json")).expect("data/redox_couples.json");
    for row in &f.couples {
        for ox in &row.oxidised {
            for red in &row.reduced {
                if !records.iter().any(|r| &r.id == red) {
                    continue;
                }
                if let Some(rec) = records.iter_mut().find(|r| &r.id == ox) {
                    rec.redox.retain(|c| &c.partner != red);
                    rec.redox.push(RedoxCouple {
                        partner: red.clone(),
                        E0: Datum::new(row.e0_v, "V", row.tier.clone(), &row.source),
                        n_electrons: Some(row.n_electrons),
                        k_self: Some(Datum::new(row.k_self, "M-1 s-1", row.tier.clone(), &row.source)),
                    });
                }
            }
        }
    }
}

pub fn seed_species() -> Vec<SpeciesRecord> {
    let mut records = vec![
        make_aq("H+", "H+", 1, 0.0, 0.0, 0.0, None, Some("[H+]")),
        make_aq("OH-", "OH-", -1, -230.0, -157.24, -148.5, None, Some("[OH-]")),
        make_aq("Na+", "Na+", 1, -240.1, -261.91, 46.4, None, Some("[Na+]")),
        make_aq("K+", "K+", 1, -252.4, -283.27, 21.8, None, Some("[K+]")),
        make_aq("Ca+2", "Ca+2", 2, -542.8, -553.58, -22.0, None, Some("[Ca+2]")),
        make_aq("Ba+2", "Ba+2", 2, -537.6, -560.77, -30.0, None, Some("[Ba+2]")),
        make_aq("Pb+2", "Pb+2", 2, -1.7, -24.4, -16.0, None, Some("[Pb+2]")),
        make_aq("Zn+2", "Zn+2", 2, -153.89, -147.06, 46.0, None, Some("[Zn+2]")),
        make_aq("F-", "F-", -1, -332.63, -278.79, -106.7, None, Some("[F-]")),
        make_aq("Cl-", "Cl-", -1, -167.2, -131.23, -136.4, None, Some("[Cl-]")),
        make_aq("Br-", "Br-", -1, -121.55, -103.96, 82.4, None, Some("[Br-]")),
        make_aq("SO4-2", "SO4-2", -2, -909.3, -744.53, -293.0, None, Some("[O-]S(=O)(=O)[O-]")),
        make_aq("NO3-", "NO3-", -1, -205.0, -108.74, -86.6, None, Some("[O-][N+](=O)[O-]")),
        make_aq("Cu+2", "Cu+2", 2, 64.8, 65.5, -99.6, None, Some("[Cu+2]")),
        make_aq("Cu(NH3)4+2", "Cu(NH3)4+2", 2, -347.0, -110.0, 250.0, None, None),
        make_aq("NH3", "NH3", 0, -80.3, -26.50, 80.0, Some("QGZKDVFQNNGYKY-UHFFFAOYSA-N"), Some("N")),
        make_aq("NH4+", "NH4+", 1, -132.5, -79.31, 79.9, None, Some("[NH4+]")),
        make_aq("Ag+", "Ag+", 1, 105.6, 77.11, 77.0, None, Some("[Ag+]")),
        make_aq("Ag(NH3)2+", "Ag(NH3)2+", 1, -111.0, -17.2, 180.0, None, None),
        make_aq("CO3-2", "CO3-2", -2, -677.1, -527.81, -50.0, None, Some("[O-]C(=O)[O-]")),
        make_aq("HCO3-", "HCO3-", -1, -692.0, -586.77, 112.0, None, Some("OC(=O)[O-]")),
        make_aq("CO2(aq)", "CO2", 0, -413.8, -385.98, 243.0, Some("CURLTUGMZLYLDI-UHFFFAOYSA-N"), Some("O=C=O")),
        // molecular carbonic acid (the intermediate of CO2 hydration): dfG from K_h = 1.7e-3, dfH from zero hydration enthalpy.
        // No SMILES: it is a speciation species that never forms a phase of its own, and a trace partitionable component
        // destabilises the solid-liquid solve of the phase flash
        make_aq("H2CO3(aq)", "H2CO3", 0, -699.63, -607.3, 243.0, Some("BVKZGUZCCUSVTD-UHFFFAOYSA-N"), None),
        make_aq("CH3COOH", "C2H4O2", 0, -484.5, -396.46, 124.0, Some("QTBSBXVTEAMEQO-UHFFFAOYSA-N"), Some("CC(=O)O")),
        make_aq("CH3COO-", "C2H3O2-", -1, -486.0, -369.31, 80.0, None, Some("CC(=O)[O-]")),
        make_aq("Fe+3", "Fe+3", 3, -48.5, -4.7, 150.0, None, Some("[Fe+3]")),
        make_aq_derived("Fe(SCN)+2", "Fe(SCN)+2", 2, 1.9, 74.9, 200.0, "derived from K1 = 200 M-1 and dH = -26 kJ/mol of the thiocyanatoiron row"),
        make_aq("SCN-", "SCN-", -1, 76.4, 92.7, 40.0, None, Some("N#C[S-]")),
        make_aq("Co+2", "Co+2", 2, -58.2, -54.4, 110.0, None, Some("[Co+2]")),
        make_aq_derived("CoCl4-2", "CoCl4-2", -2, -677.0, -556.5, 280.0, "derived from log beta4 = -4.0 and dH = +50 kJ/mol of the tetrachlorocobaltate row"),
        make_aq("I-", "I-", -1, -55.2, -51.57, -142.3, None, Some("[I-]")),
        make_aq("I3-", "I3-", -1, -51.5, -51.4, 120.0, None, None),
        make_aq("I2(aq)", "I2", 0, 22.6, 16.4, 116.0, Some("PNDPGZBMCMUPRI-UHFFFAOYSA-N"), Some("II")),
        make_aq("S2O8-2", "S2O8-2", -2, -1345.0, -1115.0, 280.0, None, None),
        make_aq("S2O3-2", "S2O3-2", -2, -648.5, -522.5, 150.0, None, None),
        make_aq("S4O6-2", "S4O6-2", -2, -1224.0, -1040.0, 300.0, None, None),
        make_aq("H2O2", "H2O2", 0, -191.17, -134.03, 89.0, Some("MHAJPDPJQMAIIY-UHFFFAOYSA-N"), Some("OO")),
        make_aq("O2(aq)", "O2", 0, -11.7, 16.4, 45.0, Some("MYMOFIZGZYHOMD-UHFFFAOYSA-N"), Some("O=O")),
        make_aq("Mg+2", "Mg+2", 2, -466.85, -454.8, -118.0, None, Some("[Mg+2]")),
        make_aq("MnO4-", "MnO4-", -1, -541.4, -447.2, 117.0, None, Some("[O-][Mn](=O)(=O)=O")),
        make_aq("Cr2O7-2", "Cr2O7-2", -2, -1490.3, -1301.1, 220.0, None, None),
        make_aq("CrO4-2", "CrO4-2", -2, -881.2, -727.75, 110.0, None, None),
        make_aq("Cr+3", "Cr+3", 3, -256.0, -215.5, 0.0, None, Some("[Cr+3]")),
        make_aq_identity("starch", "C6H10O5", 0),
        make_aq_identity("starch_I3", "C6H10O5I3-", -1),

        // Stage 6 Redox & Speciation Aqueous Species
        make_identity("HCOOH", "CH2O2", "BDAGIHXWWSANSR-UHFFFAOYSA-N"),
        make_identity("HF", "HF", "KRHYYFGTRYWZRS-UHFFFAOYSA-N"),
        make_identity("HCN", "CHN", "LELOWRISYMNNSU-UHFFFAOYSA-N"),
        make_identity("HNO2", "HNO2", "IOVCWXUNBOPUCH-UHFFFAOYSA-N"),
        make_identity("HClO", "HClO", "QWPPOHNGKGFGJK-UHFFFAOYSA-N"),
        make_identity("H2SO3", "H2SO3", "LSNNMFCWUKXFEE-UHFFFAOYSA-N"),
        make_identity("H3PO4", "H3PO4", "NBIIXXVUZAFLBC-UHFFFAOYSA-N"),
        make_identity("H2C2O4", "C2H2O4", "MUBZPKHOEPUJKR-UHFFFAOYSA-N"),
        make_identity("H2SO4", "H2SO4", "QAOWNCQODCNURD-UHFFFAOYSA-N"),

        make_aq("Al+3", "Al+3", 3, -531.0, -485.0, -115.0, None, Some("[Al+3]")),
        make_aq("Al(OH)+2", "Al(OH)+2", 2, -764.0, -694.0, -40.0, None, None),
        make_aq("Al(OH)2+", "Al(OH)2+", 1, -995.0, -902.0, 50.0, None, None),
        make_aq("Al(OH)4-", "Al(OH)4-", -1, -1500.8, -1305.6, 90.0, None, None),
        make_aq("Fe+2", "Fe+2", 2, -89.1, -78.9, -20.0, None, Some("[Fe+2]")),
        make_aq("FeOH+2", "FeOH+2", 2, -292.0, -233.0, 50.0, None, None),
        make_aq("Fe(OH)2+", "Fe(OH)2+", 1, -550.0, -440.0, 100.0, None, None),
        make_aq("Cu+", "Cu+", 1, 71.67, 49.98, -30.0, None, Some("[Cu+]")),
        make_aq("Mn+2", "Mn+2", 2, -220.8, -228.1, -25.0, None, Some("[Mn+2]")),
        make_aq("S-2", "S-2", -2, 33.1, 85.8, -100.0, None, Some("[S-2]")),
        make_aq("HS-", "HS-", -1, -17.6, 12.08, -70.0, None, Some("[S-]")),
        make_aq("H2S(aq)", "H2S", 0, -39.7, -27.83, 180.0, Some("RWSXRVCMGQZWBV-UHFFFAOYSA-N"), Some("S")),

        // Liquids
        make_liquid("H2O", "H2O", -285.83, -237.13, 75.38, "XLYOFNOQVPJJNP-UHFFFAOYSA-N", "O"),
        make_liquid("C2H5OH", "C2H6O", -277.69, -174.78, 112.3, "LFQSCWFLJHTTHZ-UHFFFAOYSA-N", "CCO"),
        make_liquid("CH3OH", "CH4O", -239.2, -166.6, 81.1, "OKKJLVBELUTLKV-UHFFFAOYSA-N", "CO"),
        make_liquid("ethyl_acetate", "C4H8O2", -480.0, -332.7, 170.0, "XEKOWRVHYACXOJ-UHFFFAOYSA-N", "CC(=O)OCC"),
        make_liquid("bromoethane", "C2H5Br", -90.5, -26.9, 100.8, "RDHPKYGYEGBPIA-UHFFFAOYSA-N", "CCBr"),
        make_liquid("2-bromopropane", "C3H7Br", -120.0, -45.0, 140.0, "XRHCAGNSDHCHF-UHFFFAOYSA-N", "CC(Br)C"),
        make_liquid("acetone", "C3H6O", -248.4, -155.4, 126.0, "CSCPPACGZOOCGX-UHFFFAOYSA-N", "CC(=O)C"),
        make_liquid("benzene", "C6H6", 49.0, 124.5, 136.0, "UHOVQNZJYSORNB-UHFFFAOYSA-N", "c1ccccc1"),
        make_liquid("cyclohexene", "C6H10", -38.5, 52.0, 150.0, "XDRDYGQBUYVLNZ-UHFFFAOYSA-N", "C1=CCCCC1"),

        // Solids with PHREEQC llnl.dat analytic expressions
        make_solid_with_analytic("AgCl(s)", "AgCl", -127.07, -109.79, 50.8, 5.56, [2.671219, -0.007312, -3053.408327, 0.0, 0.0]),
        make_solid_with_shomate("CaCO3(s)", "CaCO3", -1207.6, -1128.8, 81.9, 2.71, Some([0.187056, -0.017951, -988.386510, 0.0, 0.0]), [82.3458, 49.7513, -12.8712, 1.056, -1.63027, -1239.719, 169.111, -1207.6]),
        make_solid_with_analytic("CaSO4(s)", "CaSO4", -1434.5, -1321.8, 99.6, 2.96, [9.560767, -0.027630, -1694.376875, 0.0, 0.0]),
        make_solid_with_analytic("BaSO4(s)", "BaSO4", -1473.2, -1362.2, 101.8, 4.50, [-2.959406, -0.007034, -1464.930007, 0.0, 0.0]),
        make_solid_with_analytic("Ag2CrO4(s)", "Ag2CrO4", -731.8, -642.3, 142.3, 5.53, [-3.371456, -0.005145, -2100.321335, 0.0, 0.0]),

        make_solid("Cu(OH)2(s)", "Cu(OH)2", -450.0, -359.0, 96.0, 3.37),
        make_solid("NaHCO3(s)", "NaHCO3", -950.8, -851.0, 87.6, 2.20),
        make_solid("Na2CO3(s)", "Na2CO3", -1130.7, -1044.4, 112.3, 2.54),
        make_solid("MnO2(s)", "MnO2", -520.0, -465.1, 54.1, 5.03),
        make_solid_ik("Mg(s)", "Mg", 0.0, 0.0, 24.89, 1.74, "FYYHWMGAXLPEAU-UHFFFAOYSA-N"),
        make_solid("CoCl2(s)", "CoCl2", -312.5, -269.8, 78.5, 3.36),
        make_solid("NaCl(s)", "NaCl", -411.15, -384.14, 50.5, 2.16),
        make_solid("NaOH(s)", "NaOH", -425.61, -379.49, 59.5, 2.13),
        make_solid("KI(s)", "KI", -327.9, -324.9, 52.9, 3.12),
        make_solid("Fe(OH)3(s)", "Fe(OH)3", -823.0, -696.5, 105.0, 3.40),
        make_solid("PbI2(s)", "PbI2", -175.5, -173.6, 77.0, 6.16),
        make_solid("ZnF2(s)", "ZnF2", -764.4, -713.4, 65.0, 4.95),

        // Stage 6 Metals, Minerals & Oxides
        make_solid("Al(OH)3(s)", "Al(OH)3", -1293.1, -1154.9, 93.0, 2.42),
        make_solid("AlCl3(s)", "AlCl3", -704.2, -628.8, 91.1, 2.48),
        make_solid("Fe(s)", "Fe", 0.0, 0.0, 25.1, 7.87),
        make_solid("FeS(s)", "FeS", -100.0, -100.4, 50.5, 4.74),
        make_solid("FeCl3(s)", "FeCl3", -399.5, -334.0, 96.6, 2.90),
        make_solid("FeSO4(s)", "FeSO4", -928.4, -820.8, 100.6, 3.65),
        make_solid("Zn(s)", "Zn", 0.0, 0.0, 25.4, 7.14),
        make_solid("ZnS(s)", "ZnS", -206.0, -201.3, 46.0, 4.09),
        make_solid("ZnSO4(s)", "ZnSO4", -982.8, -871.5, 99.0, 3.54),
        make_solid("Cu(s)", "Cu", 0.0, 0.0, 24.44, 8.96),
        // elements in their reference state (dfH = dfG = 0 by definition): the metals the console offers as electrodes and
        // whose cations the store holds (Cp, density: CRC Handbook)
        make_solid("Ag(s)", "Ag", 0.0, 0.0, 25.35, 10.49),
        make_solid("Pb(s)", "Pb", 0.0, 0.0, 26.44, 11.34),
        make_solid("Al(s)", "Al", 0.0, 0.0, 24.20, 2.70),
        make_solid("Co(s)", "Co", 0.0, 0.0, 24.81, 8.90),
        make_solid("Mn(s)", "Mn", 0.0, 0.0, 26.32, 7.43),
        make_solid("Cr(s)", "Cr", 0.0, 0.0, 23.35, 7.19),
        make_solid("CuSO4(s)", "CuSO4", -771.4, -662.2, 100.0, 3.60),
        make_solid("Na(s)", "Na", 0.0, 0.0, 28.2, 0.97),
        make_solid("Na2S(s)", "Na2S", -364.8, -349.8, 77.0, 1.86),
        make_solid_with_shomate("CaO(s)", "CaO", -634.9, -603.3, 42.8, 3.34, None, [49.95403, 4.887916, -0.352056, 0.046187, -0.825097, -652.775, 94.119, -634.9]),
        make_solid("KMnO4(s)", "KMnO4", -837.2, -737.6, 117.6, 2.70),
        make_solid("NH4Cl(s)", "NH4Cl", -314.4, -202.9, 84.1, 1.53),

        // Gases
        make_gas_with_shomate("CO2(g)", "CO2", -393.51, -394.39, 37.1, Some("CURLTUGMZLYLDI-UHFFFAOYSA-N"), [24.99735, 55.18696, -33.69137, 7.948387, -0.136638, -403.592, 228.195, -393.51]),
        make_gas("O2(g)", "O2", 0.0, 0.0, 29.4, Some("MYMOFIZGZYHOMD-UHFFFAOYSA-N")),
        make_gas("H2(g)", "H2", 0.0, 0.0, 28.8, Some("UFHFLCQGNIYNRP-UHFFFAOYSA-N")),
        make_gas("NH3(g)", "NH3", -46.11, -16.45, 35.1, Some("QGZKDVFQNNGYKY-UHFFFAOYSA-N")),
        make_gas("HCl(g)", "HCl", -92.31, -95.30, 29.1, Some("VEXZGXHMUGYJMC-UHFFFAOYSA-N")),
        make_gas("N2(g)", "N2", 0.0, 0.0, 29.1, Some("IJGRMHOSHXDMSA-UHFFFAOYSA-N")),
        make_gas("H2O(g)", "H2O", -241.82, -228.57, 33.6, Some("XLYOFNOQVPJJNP-UHFFFAOYSA-N")),
        make_gas("C2H5OH(g)", "C2H6O", -235.3, -168.49, 65.4, Some("LFQSCWFLJHTTHZ-UHFFFAOYSA-N")),
        make_gas("H2S(g)", "H2S", -20.6, -33.4, 34.2, Some("RWSXRVCMGQZWBV-UHFFFAOYSA-N")),
        make_gas("ethene", "C2H4", 52.4, 68.4, 42.9, Some("VGGSQFUCUMXWEO-UHFFFAOYSA-N")),
    ];

    // inorganic species of the data file replace identity-only seeds of the same id (acids whose formation data were missing)
    for rec in inorganic_species() {
        if let Some(i) = records.iter().position(|r| r.id == rec.id) {
            records[i] = rec;
        } else {
            records.push(rec);
        }
    }

    // Optical records are the seed rows of `optics/records.rs` (data/optics_seed.json), looked up by species id.

    attach_redox_couples(&mut records);
    crate::db::seed_vle::attach_vle_data(&mut records);
    crate::db::seed_phases::attach_phase_data(&mut records);

    // tabulated species (OBIGT): replace the recalled rows of species_inorganic.json of the same id (keeping identity keys the
    // recalled row carried), and add the rest; the literal seeds above are not touched (their values were tuned with the tests)
    let inorganic_ids: std::collections::HashSet<String> = inorganic_species().into_iter().map(|r| r.id).collect();
    for mut rec in tabulated_species() {
        if let Some(i) = records.iter().position(|r| r.id == rec.id) {
            if !inorganic_ids.contains(&rec.id) {
                continue;
            }
            let old = &records[i];
            if rec.identity.inchikey.is_none() {
                rec.identity.inchikey = old.identity.inchikey.clone();
            }
            if rec.identity.smiles.is_none() {
                rec.identity.smiles = old.identity.smiles.clone();
            }
            rec.identity.names = old.identity.names.clone();
            rec.redox = old.redox.clone();
            records[i] = rec;
        } else {
            records.push(rec);
        }
    }

    attach_redox_couples(&mut records);

    records.extend(indicator_records());
    records
}

// ---- Roles of the aqueous medium and of complete-oxidation products ----------------------------------------------------
// Electrochemistry balances half-reactions with the solvent and its ions, combustion closes its element balance with
// the stable oxides, and both look the species up by these ids. Naming them once, here with the other seed tables, keeps
// engine logic free of compound literals (the species themselves are ordinary records above).
pub const WATER: &str = "H2O";
pub const WATER_VAPOUR: &str = "H2O(g)";
pub const PROTON: &str = "H+";
pub const HYDROXIDE: &str = "OH-";
pub const HYDROGEN_GAS: &str = "H2(g)";
pub const OXYGEN_GAS: &str = "O2(g)";
pub const CARBON_DIOXIDE_GAS: &str = "CO2(g)";
pub const NITROGEN_GAS: &str = "N2(g)";


/// One acid-base indicator dye of `data/indicators.json`: the acid and base forms as structures and the pKa of the site.
#[derive(serde::Deserialize, Clone, Debug)]
pub struct IndicatorDef {
    pub name: String,
    pub acid: String,
    pub base: String,
    pub acid_formula: String,
    pub acid_smiles: String,
    pub base_formula: String,
    pub base_smiles: String,
    #[serde(rename = "pKa")]
    pub pka: f64,
    #[serde(rename = "pKa_source")]
    pub pka_source: String,
    #[serde(rename = "dH_kj")]
    pub dh_kj: f64,
    #[serde(rename = "dH_source")]
    pub dh_source: String,
}

#[derive(serde::Deserialize)]
struct IndicatorFile {
    indicators: Vec<IndicatorDef>,
}

/// The indicator dyes (`data/indicators.json`).
pub fn indicator_defs() -> &'static [IndicatorDef] {
    static D: std::sync::OnceLock<Vec<IndicatorDef>> = std::sync::OnceLock::new();
    D.get_or_init(|| serde_json::from_str::<IndicatorFile>(include_str!("../../data/indicators.json")).expect("data/indicators.json").indicators)
}

/// Species records of the indicator dyes: structures (SMILES) but no formation data (the dyes are measured by their pKa),
/// and one acid-base site on the acid form whose `site` names the conjugate base species. The equilibrium row is generated
/// from that site (`chem_db::record_acid_equilibria`).
fn indicator_records() -> Vec<SpeciesRecord> {
    let mut out = Vec::new();
    for d in indicator_defs() {
        let mut acid = make_aq_identity(&d.acid, &d.acid_formula, 0);
        acid.identity.smiles = Some(d.acid_smiles.clone());
        acid.identity.names.push(d.name.clone());
        let mut dh = Datum::new(d.dh_kj, "kJ/mol", ProvenanceTier::Estimated, &d.dh_source);
        dh.T_K = Some(298.15);
        acid.acid_base.push(crate::db::record::AcidBaseSite {
            site: Some(d.base.clone()),
            pKa: Datum::new(d.pka, "pKa", ProvenanceTier::Tabulated, &d.pka_source),
            dH: Some(dh),
            T_K: Some(298.15),
            I: Some(0.0),
        });
        let mut base = make_aq_identity(&d.base, &d.base_formula, -1);
        base.identity.smiles = Some(d.base_smiles.clone());
        out.push(acid);
        out.push(base);
    }
    out
}
