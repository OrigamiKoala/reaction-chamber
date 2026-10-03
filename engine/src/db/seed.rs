use std::collections::HashMap;
use crate::types::ProvenanceTier;
use crate::db::record::{
    Datum, Identity, Optics, OpticsBand, PhaseData, PhaseThermo, SpeciesRecord,
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

fn make_solid_with_analytic(id: &str, formula: &str, df_h: f64, df_g: f64, cp: f64, density: f64, analytic: [f64; 5]) -> SpeciesRecord {
    make_solid_with_params(id, formula, df_h, df_g, cp, density, Some(analytic))
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
        make_aq("CH3COOH", "C2H4O2", 0, -484.5, -396.46, 124.0, Some("QTBSBXVTEAMEQO-UHFFFAOYSA-N"), Some("CC(=O)O")),
        make_aq("CH3COO-", "C2H3O2-", -1, -486.0, -369.31, 80.0, None, Some("CC(=O)[O-]")),
        make_aq("Fe+3", "Fe+3", 3, -48.5, -4.7, 150.0, None, Some("[Fe+3]")),
        make_aq("Fe(SCN)+2", "Fe(SCN)+2", 2, 30.0, 45.0, 200.0, None, None),
        make_aq("SCN-", "SCN-", -1, 76.4, 92.7, 40.0, None, Some("N#C[S-]")),
        make_aq("Co+2", "Co+2", 2, -58.2, -54.4, 110.0, None, Some("[Co+2]")),
        make_aq("CoCl4-2", "CoCl4-2", -2, -8.0, 10.0, 280.0, None, None),
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
        make_aq("HIn_phph", "C20H14O4", 0, -500.0, -420.0, 300.0, None, None),
        make_aq("In_phph-", "C20H13O4-", -1, -450.0, -380.0, 300.0, None, None),
        make_aq("starch", "C6H10O5", 0, -800.0, -680.0, 200.0, None, None),
        make_aq("starch_I3", "C6H10O5I3-", -1, -860.0, -740.0, 320.0, None, None),
        make_aq("HIn_btb", "C27H28Br2O5S", 0, -600.0, -510.0, 400.0, None, None),
        make_aq("In_btb-", "C27H27Br2O5S-", -1, -560.0, -475.0, 400.0, None, None),
        make_aq("HIn_mo", "C14H15N3O3S", 0, -200.0, -170.0, 300.0, None, None),
        make_aq("In_mo-", "C14H14N3O3S-", -1, -170.0, -145.0, 300.0, None, None),
        make_aq("HIn_mr", "C15H15N3O2", 0, -120.0, -100.0, 300.0, None, None),
        make_aq("In_mr-", "C15H14N3O2-", -1, -95.0, -80.0, 300.0, None, None),

        // Stage 6 Redox & Speciation Aqueous Species
        make_aq("Al+3", "Al+3", 3, -531.0, -485.0, -115.0, None, Some("[Al+3]")),
        make_aq("Al(OH)+2", "Al(OH)+2", 2, -764.0, -694.0, -40.0, None, None),
        make_aq("Al(OH)2+", "Al(OH)2+", 1, -995.0, -902.0, 50.0, None, None),
        make_aq("Al(OH)4-", "Al(OH)4-", -1, -1500.8, -1305.6, 90.0, None, None),
        make_aq("Fe+2", "Fe+2", 2, -89.1, -78.9, -20.0, None, Some("[Fe+2]")),
        make_aq("FeOH+2", "FeOH+2", 2, -287.0, -233.0, 50.0, None, None),
        make_aq("Fe(OH)2+", "Fe(OH)2+", 1, -520.0, -440.0, 100.0, None, None),
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
        make_solid_with_analytic("CaCO3(s)", "CaCO3", -1207.6, -1128.8, 81.9, 2.71, [0.187056, -0.017951, -988.386510, 0.0, 0.0]),
        make_solid_with_analytic("CaSO4(s)", "CaSO4", -1434.5, -1321.8, 99.6, 2.96, [9.560767, -0.027630, -1694.376875, 0.0, 0.0]),
        make_solid_with_analytic("BaSO4(s)", "BaSO4", -1473.2, -1362.2, 101.8, 4.50, [-2.959406, -0.007034, -1464.930007, 0.0, 0.0]),
        make_solid_with_analytic("Ag2CrO4(s)", "Ag2CrO4", -731.8, -642.3, 142.3, 5.53, [-3.371456, -0.005145, -2100.321335, 0.0, 0.0]),

        make_solid("Cu(OH)2(s)", "Cu(OH)2", -450.0, -359.0, 96.0, 3.37),
        make_solid("NaHCO3(s)", "NaHCO3", -950.8, -851.0, 87.6, 2.20),
        make_solid("Na2CO3(s)", "Na2CO3", -1130.7, -1044.4, 112.3, 2.54),
        make_solid("MnO2(s)", "MnO2", -520.0, -465.1, 54.1, 5.03),
        make_solid("Mg(s)", "Mg", 0.0, 0.0, 24.89, 1.74),
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
        make_solid("CuSO4(s)", "CuSO4", -771.4, -662.2, 100.0, 3.60),
        make_solid("Na(s)", "Na", 0.0, 0.0, 28.2, 0.97),
        make_solid("Na2S(s)", "Na2S", -364.8, -349.8, 77.0, 1.86),
        make_solid("CaO(s)", "CaO", -634.9, -603.3, 42.8, 3.34),
        make_solid("KMnO4(s)", "KMnO4", -837.2, -737.6, 117.6, 2.70),
        make_solid("NH4Cl(s)", "NH4Cl", -314.4, -202.9, 84.1, 1.53),

        // Gases
        make_gas("CO2(g)", "CO2", -393.51, -394.39, 37.1, Some("CURLTUGMZLYLDI-UHFFFAOYSA-N")),
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

    crate::db::seed_vle::attach_vle_data(&mut records);
    crate::db::seed_phases::attach_phase_data(&mut records);
    records
}
