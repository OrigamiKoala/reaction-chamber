use std::collections::HashMap;
use crate::types::ProvenanceTier;
use crate::db::record::{
    Datum, Identity, Optics, OpticsBand, PhaseData, PhaseThermo, SpeciesRecord,
};

fn make_aq(id: &str, formula: &str, charge: i32, df_h: f64, cp: f64, inchi: Option<&str>, smiles: Option<&str>) -> SpeciesRecord {
    let mut phases = HashMap::new();
    let thermo = PhaseThermo {
        model: "point+cp".to_string(),
        tier: ProvenanceTier::Tabulated,
        source: "NBS Tables / llnl.dat".to_string(),
        dfH: Some(Datum::new(df_h, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
        dfG: None,
        S: None,
        cp: Some(Datum::new(cp, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
        ranges: None,
        params: None,
    };
    phases.insert("aq".to_string(), PhaseData {
        thermo: Some(thermo),
        volume: None,
        rho: None,
        polymorph: None,
    });

    SpeciesRecord {
        id: id.to_string(),
        identity: Identity {
            inchikey: inchi.map(|s| s.to_string()),
            smiles: smiles.map(|s| s.to_string()),
            formula: formula.to_string(),
            charge,
            cas: None,
            cid: None,
            names: vec![id.to_string()],
            db_names: HashMap::new(),
        },
        phases,
        critical: None,
        points: Vec::new(),
        acid_base: Vec::new(),
        redox: Vec::new(),
        optics: None,
        transport: None,
        kinetics_refs: Vec::new(),
        rejected: Vec::new(),
    }
}

fn make_liquid(id: &str, formula: &str, df_h: f64, cp: f64, inchi: &str, smiles: &str) -> SpeciesRecord {
    let mut phases = HashMap::new();
    phases.insert("l".to_string(), PhaseData {
        thermo: Some(PhaseThermo {
            model: "point+cp".to_string(),
            tier: ProvenanceTier::Tabulated,
            source: "NBS Tables".to_string(),
            dfH: Some(Datum::new(df_h, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
            dfG: None,
            S: None,
            cp: Some(Datum::new(cp, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
            ranges: None,
            params: None,
        }),
        volume: None,
        rho: None,
        polymorph: None,
    });

    SpeciesRecord {
        id: id.to_string(),
        identity: Identity {
            inchikey: Some(inchi.to_string()),
            smiles: Some(smiles.to_string()),
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
        acid_base: Vec::new(),
        redox: Vec::new(),
        optics: None,
        transport: None,
        kinetics_refs: Vec::new(),
        rejected: Vec::new(),
    }
}

fn make_gas(id: &str, formula: &str, df_h: f64, cp: f64, inchi: Option<&str>) -> SpeciesRecord {
    let mut phases = HashMap::new();
    phases.insert("g".to_string(), PhaseData {
        thermo: Some(PhaseThermo {
            model: "point+cp".to_string(),
            tier: ProvenanceTier::Tabulated,
            source: "NBS Tables".to_string(),
            dfH: Some(Datum::new(df_h, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
            dfG: None,
            S: None,
            cp: Some(Datum::new(cp, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
            ranges: None,
            params: None,
        }),
        volume: None,
        rho: None,
        polymorph: None,
    });

    SpeciesRecord {
        id: id.to_string(),
        identity: Identity {
            inchikey: inchi.map(|s| s.to_string()),
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
        acid_base: Vec::new(),
        redox: Vec::new(),
        optics: None,
        transport: None,
        kinetics_refs: Vec::new(),
        rejected: Vec::new(),
    }
}

fn make_solid(id: &str, formula: &str, df_h: f64, cp: f64, density: f64) -> SpeciesRecord {
    let mut phases = HashMap::new();
    phases.insert("s".to_string(), PhaseData {
        thermo: Some(PhaseThermo {
            model: "point+cp".to_string(),
            tier: ProvenanceTier::Tabulated,
            source: "NBS Tables".to_string(),
            dfH: Some(Datum::new(df_h, "kJ/mol", ProvenanceTier::Tabulated, "NBS Tables")),
            dfG: None,
            S: None,
            cp: Some(Datum::new(cp, "J/(mol K)", ProvenanceTier::Tabulated, "NBS Tables")),
            ranges: None,
            params: None,
        }),
        volume: None,
        rho: Some(Datum::new(density, "g/mL", ProvenanceTier::Tabulated, "CRC / NBS")),
        polymorph: None,
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
        acid_base: Vec::new(),
        redox: Vec::new(),
        optics: None,
        transport: None,
        kinetics_refs: Vec::new(),
        rejected: Vec::new(),
    }
}

pub fn seed_species() -> Vec<SpeciesRecord> {
    let mut records = vec![
        make_aq("H+", "H+", 1, 0.0, 0.0, None, Some("[H+]")),
        make_aq("OH-", "OH-", -1, -230.0, -148.5, None, Some("[OH-]")),
        make_aq("Na+", "Na+", 1, -240.1, 46.4, None, Some("[Na+]")),
        make_aq("K+", "K+", 1, -252.4, 21.8, None, Some("[K+]")),
        make_aq("Cl-", "Cl-", -1, -167.2, -136.4, None, Some("[Cl-]")),
        make_aq("SO4-2", "SO4-2", -2, -909.3, -293.0, None, Some("[O-]S(=O)(=O)[O-]")),
        make_aq("NO3-", "NO3-", -1, -205.0, -86.6, None, Some("[O-][N+](=O)[O-]")),
        make_aq("Cu+2", "Cu+2", 2, 64.8, -99.6, None, Some("[Cu+2]")),
        make_aq("Cu(NH3)4+2", "Cu(NH3)4+2", 2, -347.0, 250.0, None, None),
        make_aq("NH3", "NH3", 0, -80.3, 80.0, Some("QGZKDVFQNNGYKY-UHFFFAOYSA-N"), Some("N")),
        make_aq("NH4+", "NH4+", 1, -132.5, 79.9, None, Some("[NH4+]")),
        make_aq("Ag+", "Ag+", 1, 105.6, 77.0, None, Some("[Ag+]")),
        make_aq("Ag(NH3)2+", "Ag(NH3)2+", 1, -111.0, 180.0, None, None),
        make_aq("CO3-2", "CO3-2", -2, -677.1, -50.0, None, Some("[O-]C(=O)[O-]")),
        make_aq("HCO3-", "HCO3-", -1, -692.0, 112.0, None, Some("OC(=O)[O-]")),
        make_aq("CO2(aq)", "CO2", 0, -413.8, 243.0, Some("CURLTQBHLGFTAB-UHFFFAOYSA-N"), Some("O=C=O")),
        make_aq("CH3COOH", "C2H4O2", 0, -484.5, 124.0, Some("QTBSBXVTEAMEQO-UHFFFAOYSA-N"), Some("CC(=O)O")),
        make_aq("CH3COO-", "C2H3O2-", -1, -486.0, 80.0, None, Some("CC(=O)[O-]")),
        make_aq("Fe+3", "Fe+3", 3, -48.5, 150.0, None, Some("[Fe+3]")),
        make_aq("Fe(SCN)+2", "Fe(SCN)+2", 2, 30.0, 200.0, None, None),
        make_aq("SCN-", "SCN-", -1, 76.4, 40.0, None, Some("N#C[S-]")),
        make_aq("Co+2", "Co+2", 2, -58.2, 110.0, None, Some("[Co+2]")),
        make_aq("CoCl4-2", "CoCl4-2", -2, -8.0, 280.0, None, None),
        make_aq("I-", "I-", -1, -55.2, -142.3, None, Some("[I-]")),
        make_aq("I3-", "I3-", -1, -51.5, 120.0, None, None),
        make_aq("I2(aq)", "I2", 0, 22.6, 116.0, Some("PNDPGZBMCMUPRI-UHFFFAOYSA-N"), Some("II")),
        make_aq("S2O8-2", "S2O8-2", -2, -1345.0, 280.0, None, None),
        make_aq("S2O3-2", "S2O3-2", -2, -648.5, 150.0, None, None),
        make_aq("S4O6-2", "S4O6-2", -2, -1224.0, 300.0, None, None),
        make_aq("H2O2", "H2O2", 0, -191.17, 89.0, Some("MHAJPDPJQMAIIY-UHFFFAOYSA-N"), Some("OO")),
        make_aq("O2(aq)", "O2", 0, -11.7, 45.0, Some("MYMOFIZGZYHOMD-UHFFFAOYSA-N"), Some("O=O")),
        make_aq("Mg+2", "Mg+2", 2, -466.85, -118.0, None, Some("[Mg+2]")),
        make_aq("MnO4-", "MnO4-", -1, -541.4, 117.0, None, Some("[O-][Mn](=O)(=O)=O")),
        make_aq("Cr2O7-2", "Cr2O7-2", -2, -1490.3, 220.0, None, None),
        make_aq("CrO4-2", "CrO4-2", -2, -881.2, 110.0, None, None),
        make_aq("HIn_phph", "C20H14O4", 0, -500.0, 300.0, None, None),
        make_aq("In_phph-", "C20H13O4-", -1, -450.0, 300.0, None, None),
        make_aq("starch", "C6H10O5", 0, -800.0, 200.0, None, None),
        make_aq("starch_I3", "C6H10O5I3-", -1, -860.0, 320.0, None, None),
        make_aq("HIn_btb", "C27H28Br2O5S", 0, -600.0, 400.0, None, None),
        make_aq("In_btb-", "C27H27Br2O5S-", -1, -560.0, 400.0, None, None),
        make_aq("HIn_mo", "C14H15N3O3S", 0, -200.0, 300.0, None, None),
        make_aq("In_mo-", "C14H14N3O3S-", -1, -170.0, 300.0, None, None),
        make_aq("HIn_mr", "C15H15N3O2", 0, -120.0, 300.0, None, None),
        make_aq("In_mr-", "C15H14N3O2-", -1, -95.0, 300.0, None, None),

        // Liquids
        make_liquid("H2O", "H2O", -285.83, 75.38, "GPRLSGONYQIRFK-UHFFFAOYSA-N", "O"),
        make_liquid("C2H5OH", "C2H6O", -277.69, 112.3, "LFQSCWFLJHTTHZ-UHFFFAOYSA-N", "CCO"),

        // Solids
        make_solid("AgCl(s)", "AgCl", -127.07, 50.8, 5.56),
        make_solid("Cu(OH)2(s)", "Cu(OH)2", -450.0, 96.0, 3.37),
        make_solid("NaHCO3(s)", "NaHCO3", -950.8, 87.6, 2.20),
        make_solid("MnO2(s)", "MnO2", -520.0, 54.1, 5.03),
        make_solid("Mg(s)", "Mg", 0.0, 24.89, 1.74),
        make_solid("CoCl2(s)", "CoCl2", -312.5, 78.5, 3.36),
        make_solid("NaCl(s)", "NaCl", -411.15, 50.5, 2.16),
        make_solid("NaOH(s)", "NaOH", -425.61, 59.5, 2.13),
        make_solid("KI(s)", "KI", -327.9, 52.9, 3.12),
        make_solid("CaCO3(s)", "CaCO3", -1207.6, 81.9, 2.71),
        make_solid("BaSO4(s)", "BaSO4", -1473.2, 101.8, 4.50),
        make_solid("Fe(OH)3(s)", "Fe(OH)3", -823.0, 105.0, 3.40),
        make_solid("PbI2(s)", "PbI2", -175.5, 77.0, 6.16),
        make_solid("ZnF2(s)", "ZnF2", -764.4, 65.0, 4.95),

        // Gases
        make_gas("CO2(g)", "CO2", -393.51, 37.1, Some("CURLTQBHLGFTAB-UHFFFAOYSA-N")),
        make_gas("O2(g)", "O2", 0.0, 29.4, Some("MYMOFIZGZYHOMD-UHFFFAOYSA-N")),
        make_gas("H2(g)", "H2", 0.0, 28.8, Some("UFHFLCQGNIYNRP-UHFFFAOYSA-N")),
        make_gas("NH3(g)", "NH3", -46.11, 35.1, Some("QGZKDVFQNNGYKY-UHFFFAOYSA-N")),
        make_gas("HCl(g)", "HCl", -92.31, 29.1, Some("VEXZGXHMUGYJMC-UHFFFAOYSA-N")),
        make_gas("N2(g)", "N2", 0.0, 29.1, Some("IJGRMHOSHXDMSA-UHFFFAOYSA-N")),
        make_gas("H2O(g)", "H2O", -241.82, 33.6, Some("GPRLSGONYQIRFK-UHFFFAOYSA-N")),
        make_gas("C2H5OH(g)", "C2H6O", -235.3, 65.4, Some("LFQSCWFLJHTTHZ-UHFFFAOYSA-N")),
    ];

    // Attach optics to selected species
    for rec in records.iter_mut() {
        if rec.id == "Cu+2" {
            rec.optics = Some(Optics {
                bands: vec![OpticsBand { solvent: Some("water".to_string()), nm: 800.0, eps: 12.0, fwhm: Some(250.0) }],
                ..Default::default()
            });
        } else if rec.id == "Cu(NH3)4+2" {
            rec.optics = Some(Optics {
                bands: vec![OpticsBand { solvent: Some("water".to_string()), nm: 610.0, eps: 55.0, fwhm: Some(120.0) }],
                ..Default::default()
            });
        } else if rec.id == "In_phph-" {
            rec.optics = Some(Optics {
                bands: vec![OpticsBand { solvent: Some("water".to_string()), nm: 552.0, eps: 31000.0, fwhm: Some(50.0) }],
                ..Default::default()
            });
        } else if rec.id == "Fe(SCN)+2" {
            rec.optics = Some(Optics {
                bands: vec![OpticsBand { solvent: Some("water".to_string()), nm: 460.0, eps: 4500.0, fwhm: Some(90.0) }],
                ..Default::default()
            });
        } else if rec.id == "MnO4-" {
            rec.optics = Some(Optics {
                bands: vec![
                    OpticsBand { solvent: Some("water".to_string()), nm: 525.0, eps: 2400.0, fwhm: Some(50.0) },
                    OpticsBand { solvent: Some("water".to_string()), nm: 545.0, eps: 2400.0, fwhm: Some(50.0) },
                ],
                ..Default::default()
            });
        }
    }

    records
}
