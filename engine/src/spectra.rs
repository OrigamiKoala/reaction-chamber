//! M5 spectra data. Defines spectral bands, solid optical properties, and fume optics.

#[derive(Clone, Copy, Debug)]
pub struct Band {
    pub centre_nm: f64,
    pub fwhm_nm: f64,
    /// Molar absorptivity at band centre, L/(mol·cm).
    pub eps: f64,
}

#[derive(Clone, Copy, Debug)]
pub struct SolidOptics {
    pub rgb_linear: [f64; 3],
    pub kind: &'static str, // "powder" | "crystal" | "metal" | "gel" | "curds"
    pub default_particle_um: f64,
    pub refractive_index: f64,
    pub density_g_ml: f64,
}

#[derive(Clone, Copy, Debug)]
pub struct FumeOptics {
    pub rgb_linear: [f64; 3],
    pub opacity: f64,
    pub denser_than_air: bool,
}

// Band definitions
static BANDS_CU2: [Band; 1] = [Band { centre_nm: 800.0, fwhm_nm: 250.0, eps: 12.0 }];
static BANDS_CU_NH3_4: [Band; 1] = [Band { centre_nm: 610.0, fwhm_nm: 120.0, eps: 55.0 }];
static BANDS_HIN_PHPH: [Band; 0] = [];
static BANDS_IN_PHPH: [Band; 1] = [Band { centre_nm: 552.0, fwhm_nm: 50.0, eps: 31000.0 }];
static BANDS_HIN_BTB: [Band; 1] = [Band { centre_nm: 430.0, fwhm_nm: 65.0, eps: 22000.0 }];
static BANDS_IN_BTB: [Band; 1] = [Band { centre_nm: 615.0, fwhm_nm: 65.0, eps: 35000.0 }];
static BANDS_HIN_MO: [Band; 1] = [Band { centre_nm: 505.0, fwhm_nm: 75.0, eps: 56000.0 }];
static BANDS_IN_MO: [Band; 1] = [Band { centre_nm: 460.0, fwhm_nm: 65.0, eps: 25000.0 }];
static BANDS_CO2: [Band; 1] = [Band { centre_nm: 510.0, fwhm_nm: 80.0, eps: 5.0 }];
static BANDS_COCL4: [Band; 3] = [
    Band { centre_nm: 625.0, fwhm_nm: 45.0, eps: 420.0 },
    Band { centre_nm: 660.0, fwhm_nm: 45.0, eps: 600.0 },
    Band { centre_nm: 690.0, fwhm_nm: 45.0, eps: 480.0 },
];
static BANDS_I2_AQ: [Band; 1] = [Band { centre_nm: 460.0, fwhm_nm: 95.0, eps: 750.0 }];
static BANDS_I3: [Band; 2] = [
    Band { centre_nm: 460.0, fwhm_nm: 80.0, eps: 975.0 },
    Band { centre_nm: 400.0, fwhm_nm: 70.0, eps: 2600.0 },
];
static BANDS_STARCH_I3: [Band; 1] = [Band { centre_nm: 600.0, fwhm_nm: 100.0, eps: 40000.0 }];
static BANDS_FE3: [Band; 1] = [Band { centre_nm: 400.0, fwhm_nm: 80.0, eps: 150.0 }];
static BANDS_FE_SCN: [Band; 1] = [Band { centre_nm: 460.0, fwhm_nm: 90.0, eps: 4500.0 }];
static BANDS_MNO4: [Band; 2] = [
    Band { centre_nm: 525.0, fwhm_nm: 50.0, eps: 2400.0 },
    Band { centre_nm: 545.0, fwhm_nm: 50.0, eps: 2400.0 },
];
static BANDS_CR2O7: [Band; 1] = [Band { centre_nm: 450.0, fwhm_nm: 85.0, eps: 370.0 }];
static BANDS_CRO4: [Band; 1] = [Band { centre_nm: 400.0, fwhm_nm: 60.0, eps: 4200.0 }];

pub fn bands(species_id: &str) -> Option<&'static [Band]> {
    match species_id {
        "Cu+2" => Some(&BANDS_CU2),
        "Cu(NH3)4+2" => Some(&BANDS_CU_NH3_4),
        "HIn_phph" => Some(&BANDS_HIN_PHPH),
        "In_phph-2" => Some(&BANDS_IN_PHPH),
        "HIn_btb" => Some(&BANDS_HIN_BTB),
        "In_btb-" => Some(&BANDS_IN_BTB),
        "HIn_mo" => Some(&BANDS_HIN_MO),
        "In_mo-" => Some(&BANDS_IN_MO),
        "Co+2" | "Co(H2O)6+2" => Some(&BANDS_CO2),
        "CoCl4-2" => Some(&BANDS_COCL4),
        "I2(aq)" => Some(&BANDS_I2_AQ),
        "I3-" => Some(&BANDS_I3),
        "starch_I3" => Some(&BANDS_STARCH_I3),
        "Fe+3" => Some(&BANDS_FE3),
        "Fe(SCN)+2" => Some(&BANDS_FE_SCN),
        "MnO4-" => Some(&BANDS_MNO4),
        "Cr2O7-2" => Some(&BANDS_CR2O7),
        "CrO4-2" => Some(&BANDS_CRO4),
        _ => None,
    }
}

pub fn solid_optics(species_id: &str) -> Option<SolidOptics> {
    match species_id {
        "AgCl(s)" => Some(SolidOptics {
            rgb_linear: [0.95, 0.95, 0.95],
            kind: "curds",
            default_particle_um: 2.0,
            refractive_index: 2.07,
            density_g_ml: 5.56,
        }),
        "Cu(OH)2(s)" => Some(SolidOptics {
            rgb_linear: [0.35, 0.65, 0.88],
            kind: "gel",
            default_particle_um: 5.0,
            refractive_index: 1.55,
            density_g_ml: 3.37,
        }),
        "NaHCO3(s)" => Some(SolidOptics {
            rgb_linear: [0.95, 0.95, 0.95],
            kind: "powder",
            default_particle_um: 50.0,
            refractive_index: 1.50,
            density_g_ml: 2.20,
        }),
        "MnO2(s)" => Some(SolidOptics {
            rgb_linear: [0.08, 0.08, 0.08],
            kind: "powder",
            default_particle_um: 10.0,
            refractive_index: 2.10,
            density_g_ml: 5.03,
        }),
        "Mg(s)" => Some(SolidOptics {
            rgb_linear: [0.82, 0.84, 0.86],
            kind: "metal",
            default_particle_um: 100.0,
            refractive_index: 1.30,
            density_g_ml: 1.74,
        }),
        "CoCl2(s)" => Some(SolidOptics {
            rgb_linear: [0.25, 0.20, 0.60],
            kind: "crystal",
            default_particle_um: 20.0,
            refractive_index: 1.60,
            density_g_ml: 3.36,
        }),
        "NaCl(s)" => Some(SolidOptics {
            rgb_linear: [0.95, 0.95, 0.95],
            kind: "powder",
            default_particle_um: 30.0,
            refractive_index: 1.54,
            density_g_ml: 2.16,
        }),
        "NaOH(s)" => Some(SolidOptics {
            rgb_linear: [0.95, 0.95, 0.95],
            kind: "powder",
            default_particle_um: 40.0,
            refractive_index: 1.47,
            density_g_ml: 2.13,
        }),
        "KI(s)" => Some(SolidOptics {
            rgb_linear: [0.95, 0.95, 0.95],
            kind: "crystal",
            default_particle_um: 30.0,
            refractive_index: 1.67,
            density_g_ml: 3.12,
        }),
        _ => None,
    }
}

pub fn fume_optics(species_id: &str) -> Option<FumeOptics> {
    match species_id {
        "NO2(g)" => Some(FumeOptics {
            rgb_linear: [0.65, 0.25, 0.05],
            opacity: 0.85,
            denser_than_air: true,
        }),
        "Cl2(g)" => Some(FumeOptics {
            rgb_linear: [0.75, 0.85, 0.25],
            opacity: 0.45,
            denser_than_air: true,
        }),
        "I2(g)" => Some(FumeOptics {
            rgb_linear: [0.45, 0.05, 0.55],
            opacity: 0.70,
            denser_than_air: true,
        }),
        "HCl(g)" => Some(FumeOptics {
            rgb_linear: [0.92, 0.92, 0.95],
            opacity: 0.50,
            denser_than_air: false,
        }),
        "NH3(g)" => Some(FumeOptics {
            rgb_linear: [0.95, 0.95, 0.98],
            opacity: 0.25,
            denser_than_air: false,
        }),
        "H2O(g)" => Some(FumeOptics {
            rgb_linear: [0.95, 0.95, 0.95],
            opacity: 0.40,
            denser_than_air: false,
        }),
        "CO2(g)" => Some(FumeOptics {
            rgb_linear: [0.95, 0.95, 0.95],
            opacity: 0.0,
            denser_than_air: true,
        }),
        "O2(g)" | "H2(g)" | "N2(g)" => Some(FumeOptics {
            rgb_linear: [0.95, 0.95, 0.95],
            opacity: 0.0,
            denser_than_air: false,
        }),
        _ => None,
    }
}

pub fn species_with_spectra() -> Vec<&'static str> {
    vec![
        "Cu+2",
        "Cu(NH3)4+2",
        "HIn_phph",
        "In_phph-2",
        "HIn_btb",
        "In_btb-",
        "HIn_mo",
        "In_mo-",
        "Co+2",
        "Co(H2O)6+2",
        "CoCl4-2",
        "I2(aq)",
        "I3-",
        "starch_I3",
        "Fe+3",
        "Fe(SCN)+2",
        "MnO4-",
        "Cr2O7-2",
        "CrO4-2",
    ]
}
