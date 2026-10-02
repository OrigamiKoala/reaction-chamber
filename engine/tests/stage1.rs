use reaction_chamber_engine::chem_db::{self, GeneralMineral};
use reaction_chamber_engine::db::{SpeciesRecord, SpeciesStore};
use reaction_chamber_engine::types::ProvenanceTier;
use reaction_chamber_engine::vessel::*;
use std::collections::HashMap;

fn beaker() -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: 250.0,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(298.15),
        room_k: Some(298.15),
        sealed: Some(false),
        stopper_pop_atm: Some(2.2),
        burst_atm: Some(6.0),
    })
}

#[test]
fn s1_1_llnl_comparison_within_0_3_log_units() {
    let store_arc = SpeciesStore::global();
    let store = store_arc.read().unwrap();

    let refs = [
        ("AgCl(s)", -9.75),
        ("PbI2(s)", -8.04),
        ("BaSO4(s)", -9.97),
        ("CaCO3(s)", -8.47),
        ("Fe(OH)3(s)", -38.55),
    ];

    for (id, llnl_val) in refs {
        let rec = store.get(id).unwrap_or_else(|| panic!("Missing seed species {}", id));
        assert!(rec.has_phase("s"), "Species {} must have solid phase", id);
        let minerals = chem_db::get_default_minerals();
        let m = minerals.iter().find(|m| m.solid_species == id || m.formula == id.trim_end_matches("(s)"))
            .unwrap_or_else(|| panic!("Missing mineral {}", id));
        let diff = (m.log_ksp_298 - llnl_val).abs();
        assert!(diff <= 0.3, "{} log Ksp {:.2} vs llnl {:.2} diff {:.2} exceeds 0.3", id, m.log_ksp_298, llnl_val, diff);
    }
}

#[test]
fn s1_2_existing_precipitation_unchanged() {
    let mut v = beaker();
    v.dose(DoseRequest { reagent_id: "water".into(), volume_ml: Some(50.0), mass_g: None, drops: None, temperature_k: None }).unwrap();
    v.dose(DoseRequest { reagent_id: "agno3_0_1m".into(), volume_ml: Some(10.0), mass_g: None, drops: None, temperature_k: None }).unwrap();
    v.dose(DoseRequest { reagent_id: "nacl_0_1m".into(), volume_ml: Some(10.0), mass_g: None, drops: None, temperature_k: None }).unwrap();

    let snap = v.snapshot();
    let agcl = snap.solids.iter().find(|s| s.species == "AgCl(s)");
    assert!(agcl.is_some(), "AgCl precipitate must form");
    assert!(agcl.unwrap().mass_g > 0.05, "AgCl mass must be significant");
}

#[test]
fn s1_3_template_formed_c2h6o_resolves_by_inchikey_not_formula() {
    let mut store = SpeciesStore::new();

    let ethanol_json = r#"{
        "id": "ik:LFQSCWFLJHTTHZ-UHFFFAOYSA-N",
        "identity": {
            "formula": "C2H6O",
            "charge": 0,
            "inchikey": "LFQSCWFLJHTTHZ-UHFFFAOYSA-N",
            "smiles": "CCO",
            "names": ["ethanol"]
        },
        "phases": {
            "l": {
                "thermo": {
                    "model": "point+cp",
                    "tier": "tabulated",
                    "source": "NBS Tables",
                    "dfH": { "value": -277.69, "unit": "kJ/mol", "tier": "tabulated", "source": "NBS" }
                }
            }
        },
        "points": [
            { "kind": "tb", "T_K": 351.44, "P_Pa": 101325, "tier": "tabulated", "source": "NIST" }
        ]
    }"#;

    let dme_json = r#"{
        "id": "ik:BSYNRYMUTXBXSQ-UHFFFAOYSA-N",
        "identity": {
            "formula": "C2H6O",
            "charge": 0,
            "inchikey": "BSYNRYMUTXBXSQ-UHFFFAOYSA-N",
            "smiles": "COC",
            "names": ["dimethyl ether"]
        },
        "phases": {
            "g": {
                "thermo": {
                    "model": "point+cp",
                    "tier": "tabulated",
                    "source": "NASA CEA",
                    "dfH": { "value": -184.1, "unit": "kJ/mol", "tier": "tabulated", "source": "NASA" }
                }
            }
        },
        "points": [
            { "kind": "tb", "T_K": 249.1, "P_Pa": 101325, "tier": "tabulated", "source": "NIST" }
        ]
    }"#;

    let rec_eth: SpeciesRecord = serde_json::from_str(ethanol_json).unwrap();
    let rec_dme: SpeciesRecord = serde_json::from_str(dme_json).unwrap();
    store.register(rec_eth);
    store.register(rec_dme);

    let candidates = store.get_by_formula("C2H6O");
    assert!(candidates.len() >= 2, "C2H6O candidates count {}", candidates.len());

    let eth_lookup = store.get_by_inchikey("LFQSCWFLJHTTHZ-UHFFFAOYSA-N").expect("ethanol lookup");
    assert_eq!(eth_lookup.identity.names[0], "ethanol");
    assert_eq!(eth_lookup.points[0].T_K, Some(351.44));

    let dme_lookup = store.get_by_inchikey("BSYNRYMUTXBXSQ-UHFFFAOYSA-N").expect("dme lookup");
    assert_eq!(dme_lookup.identity.names[0], "dimethyl ether");
    assert_eq!(dme_lookup.points[0].T_K, Some(249.1));
}

#[test]
fn s1_4_guessed_pbi2_resolves_through_generic_queue() {
    let _ = reaction_chamber_engine::get_property_requests();

    let mut prod = HashMap::new();
    prod.insert("Pb+2".to_string(), 1.0);
    prod.insert("I-".to_string(), 2.0);

    reaction_chamber_engine::solubility::request_lookup(&GeneralMineral {
        id: "pbi2_test".to_string(),
        mineral: "Lead Iodide".to_string(),
        formula: "PbI2".to_string(),
        solid_species: "PbI2(s)".to_string(),
        dissolved_products: prod,
        log_ksp_298: -7.0,
        delta_h_kj: 0.0,
        solid_color: [1.0, 0.9, 0.1],
        density_g_ml: 6.16,
        default_particle_um: 50.0,
        kind: "crystal".to_string(),
        log_ksp_analytic: None,
        tier: ProvenanceTier::Speculative,
        source: "Rule guess".to_string(),
    });

    let reqs = reaction_chamber_engine::get_property_requests();
    let pbi2_req = reqs.iter().find(|r| r.species_id == "PbI2(s)");
    assert!(pbi2_req.is_some(), "PbI2(s) property request must be queued");

    let resolved_json = r#"[{
        "id": "s:PbI2:solid",
        "identity": { "formula": "PbI2", "charge": 0 },
        "phases": {
            "s": {
                "thermo": {
                    "model": "point+cp",
                    "tier": "tabulated",
                    "source": "llnl.dat",
                    "dfH": { "value": -175.5, "unit": "kJ/mol", "tier": "tabulated", "source": "llnl" }
                }
            }
        }
    }]"#;
    let recs: Vec<SpeciesRecord> = serde_json::from_str(resolved_json).unwrap();
    let count = reaction_chamber_engine::apply_resolved_properties(recs);
    assert_eq!(count, 1);
}

#[test]
fn s1_5_dimethyl_ether_import_never_receives_ethanol_data() {
    let store = SpeciesStore::global();
    let s = store.read().unwrap();
    let dme = s.get_by_inchikey("BSYNRYMUTXBXSQ-UHFFFAOYSA-N");
    if let Some(rec) = dme {
        assert_ne!(rec.identity.names.first().map(|x| x.as_str()), Some("ethanol"));
        if let Some(tb) = rec.points.iter().find(|p| p.kind == "tb") {
            assert!(tb.T_K.unwrap() < 300.0, "DME boiling point must be ~249 K, not ethanol's 351 K");
        }
    }
}
