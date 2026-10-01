"""
PHREEQC Aqueous Chemistry Core
Provides master species, equilibrium constants (log K at 25 °C), reaction enthalpies (dH in kJ/mol),
and mineral precipitation equilibria (Ksp).
"""
from typing import Dict, Any, List

AQUEOUS_MASTER_SPECIES = {
    "H+": {"formula": "H+", "charge": 1, "element": "H", "mw": 1.008, "gfw": 1.008},
    "OH-": {"formula": "OH-", "charge": -1, "element": "O", "mw": 17.008, "gfw": 17.008},
    "H2O": {"formula": "H2O", "charge": 0, "element": "H2O", "mw": 18.015, "gfw": 18.015},
    "Na+": {"formula": "Na+", "charge": 1, "element": "Na", "mw": 22.990, "gfw": 22.990},
    "K+": {"formula": "K+", "charge": 1, "element": "K", "mw": 39.098, "gfw": 39.098},
    "Ca+2": {"formula": "Ca+2", "charge": 2, "element": "Ca", "mw": 40.078, "gfw": 40.078},
    "Mg+2": {"formula": "Mg+2", "charge": 2, "element": "Mg", "mw": 24.305, "gfw": 24.305},
    "Ba+2": {"formula": "Ba+2", "charge": 2, "element": "Ba", "mw": 137.327, "gfw": 137.327},
    "Cu+2": {"formula": "Cu+2", "charge": 2, "element": "Cu", "mw": 63.546, "gfw": 63.546},
    "Fe+2": {"formula": "Fe+2", "charge": 2, "element": "Fe", "mw": 55.845, "gfw": 55.845},
    "Fe+3": {"formula": "Fe+3", "charge": 3, "element": "Fe", "mw": 55.845, "gfw": 55.845},
    "Ag+": {"formula": "Ag+", "charge": 1, "element": "Ag", "mw": 107.868, "gfw": 107.868},
    "Cl-": {"formula": "Cl-", "charge": -1, "element": "Cl", "mw": 35.453, "gfw": 35.453},
    "SO4-2": {"formula": "SO4-2", "charge": -2, "element": "S", "mw": 96.06, "gfw": 96.06},
    "NO3-": {"formula": "NO3-", "charge": -1, "element": "N", "mw": 62.005, "gfw": 62.005},
    "CO3-2": {"formula": "CO3-2", "charge": -2, "element": "C", "mw": 60.008, "gfw": 60.008},
    "PO4-3": {"formula": "PO4-3", "charge": -3, "element": "P", "mw": 94.971, "gfw": 94.971},
    "NH4+": {"formula": "NH4+", "charge": 1, "element": "N(-3)", "mw": 18.038, "gfw": 18.038},
    "CH3COO-": {"formula": "CH3COO-", "charge": -1, "element": "Acetate", "mw": 59.044, "gfw": 59.044},
}

# PHREEQC secondary aqueous equilibria: reactants -> products, log_k at 25 °C, delta_h_kj
AQUEOUS_EQUILIBRIA = [
    {
        "id": "H2O_dissoc",
        "name": "Water autodissociation",
        "equation": "H2O = H+ + OH-",
        "reactants": {"H2O": 1.0},
        "products": {"H+": 1.0, "OH-": 1.0},
        "log_k_25c": -14.00,
        "delta_h_kj": 55.815,
        "source": "phreeqc_llnl.dat",
        "tier": "tabulated"
    },
    {
        "id": "CO2_hydration",
        "name": "Carbonic acid formation",
        "equation": "CO2(aq) + H2O = H+ + HCO3-",
        "reactants": {"CO2": 1.0, "H2O": 1.0},
        "products": {"H+": 1.0, "HCO3-": 1.0},
        "log_k_25c": -6.35,
        "delta_h_kj": 7.64,
        "source": "phreeqc_minteq.v4.dat",
        "tier": "tabulated"
    },
    {
        "id": "HCO3_dissoc",
        "name": "Bicarbonate dissociation",
        "equation": "HCO3- = H+ + CO3-2",
        "reactants": {"HCO3-": 1.0},
        "products": {"H+": 1.0, "CO3-2": 1.0},
        "log_k_25c": -10.33,
        "delta_h_kj": 14.85,
        "source": "phreeqc_minteq.v4.dat",
        "tier": "tabulated"
    },
    {
        "id": "NH4_dissoc",
        "name": "Ammonium dissociation",
        "equation": "NH4+ = NH3 + H+",
        "reactants": {"NH4+": 1.0},
        "products": {"NH3": 1.0, "H+": 1.0},
        "log_k_25c": -9.25,
        "delta_h_kj": 52.09,
        "source": "phreeqc_llnl.dat",
        "tier": "tabulated"
    },
    {
        "id": "HSO4_dissoc",
        "name": "Bisulfate dissociation",
        "equation": "HSO4- = H+ + SO4-2",
        "reactants": {"HSO4-": 1.0},
        "products": {"H+": 1.0, "SO4-2": 1.0},
        "log_k_25c": -1.99,
        "delta_h_kj": -22.4,
        "source": "phreeqc_llnl.dat",
        "tier": "tabulated"
    },
    {
        "id": "H3PO4_dissoc_1",
        "name": "Phosphoric acid pKa1",
        "equation": "H3PO4 = H+ + H2PO4-",
        "reactants": {"H3PO4": 1.0},
        "products": {"H+": 1.0, "H2PO4-": 1.0},
        "log_k_25c": -2.15,
        "delta_h_kj": -8.0,
        "source": "phreeqc_llnl.dat",
        "tier": "tabulated"
    },
    {
        "id": "H2PO4_dissoc_2",
        "name": "Dihydrogen phosphate pKa2",
        "equation": "H2PO4- = H+ + HPO4-2",
        "reactants": {"H2PO4-": 1.0},
        "products": {"H+": 1.0, "HPO4-2": 1.0},
        "log_k_25c": -7.20,
        "delta_h_kj": 3.6,
        "source": "phreeqc_llnl.dat",
        "tier": "tabulated"
    },
    {
        "id": "HPO4_dissoc_3",
        "name": "Hydrogen phosphate pKa3",
        "equation": "HPO4-2 = H+ + PO4-3",
        "reactants": {"HPO4-2": 1.0},
        "products": {"H+": 1.0, "PO4-3": 1.0},
        "log_k_25c": -12.35,
        "delta_h_kj": 16.0,
        "source": "phreeqc_llnl.dat",
        "tier": "tabulated"
    },
    {
        "id": "acetic_acid_dissoc",
        "name": "Acetic acid dissociation",
        "equation": "CH3COOH = H+ + CH3COO-",
        "reactants": {"CH3COOH": 1.0},
        "products": {"H+": 1.0, "CH3COO-": 1.0},
        "log_k_25c": -4.76,
        "delta_h_kj": -0.4,
        "source": "phreeqc_minteq.v4.dat",
        "tier": "tabulated"
    },
    {
        "id": "Cu_NH3_complex",
        "name": "Tetraamminecopper(II) complexation",
        "equation": "Cu+2 + 4NH3 = Cu(NH3)4+2",
        "reactants": {"Cu+2": 1.0, "NH3": 4.0},
        "products": {"Cu(NH3)4+2": 1.0},
        "log_k_25c": 12.59,
        "delta_h_kj": -89.5,
        "source": "phreeqc_llnl.dat",
        "tier": "tabulated"
    },
    {
        "id": "Fe_SCN_complex",
        "name": "Iron(III) thiocyanate complexation",
        "equation": "Fe+3 + SCN- = Fe(SCN)+2",
        "reactants": {"Fe+3": 1.0, "SCN-": 1.0},
        "products": {"Fe(SCN)+2": 1.0},
        "log_k_25c": 2.16,
        "delta_h_kj": -6.7,
        "source": "phreeqc_llnl.dat",
        "tier": "tabulated"
    }
]

# Mineral and precipitation solubility equilibria (Ksp)
MINERAL_SOLUBILITIES = [
    {
        "id": "AgCl_ppt",
        "mineral": "Chlorargyrite (AgCl)",
        "formula": "AgCl(s)",
        "equation": "AgCl(s) = Ag+ + Cl-",
        "log_ksp_25c": -9.75,
        "delta_h_kj": 65.7,
        "solid_color": "#ffffff",
        "source": "phreeqc_llnl.dat",
        "tier": "tabulated"
    },
    {
        "id": "CaCO3_calcite",
        "mineral": "Calcite (CaCO3)",
        "formula": "CaCO3(s)",
        "equation": "CaCO3(s) = Ca+2 + CO3-2",
        "log_ksp_25c": -8.48,
        "delta_h_kj": -9.61,
        "solid_color": "#ffffff",
        "source": "phreeqc_llnl.dat",
        "tier": "tabulated"
    },
    {
        "id": "BaSO4_barite",
        "mineral": "Barite (BaSO4)",
        "formula": "BaSO4(s)",
        "equation": "BaSO4(s) = Ba+2 + SO4-2",
        "log_ksp_25c": -9.97,
        "delta_h_kj": 24.6,
        "solid_color": "#ffffff",
        "source": "phreeqc_llnl.dat",
        "tier": "tabulated"
    },
    {
        "id": "CuOH2_ppt",
        "mineral": "Copper(II) hydroxide",
        "formula": "Cu(OH)2(s)",
        "equation": "Cu(OH)2(s) = Cu+2 + 2OH-",
        "log_ksp_25c": -19.32,
        "delta_h_kj": 52.3,
        "solid_color": "#00bcd4",
        "source": "phreeqc_llnl.dat",
        "tier": "tabulated"
    },
    {
        "id": "FeOH3_ppt",
        "mineral": "Iron(III) hydroxide (amorphous)",
        "formula": "Fe(OH)3(s)",
        "equation": "Fe(OH)3(s) = Fe+3 + 3OH-",
        "log_ksp_25c": -38.8,
        "delta_h_kj": 100.4,
        "solid_color": "#795548",
        "source": "phreeqc_llnl.dat",
        "tier": "tabulated"
    }
]

def get_phreeqc_data() -> Dict[str, Any]:
    return {
        "master_species": AQUEOUS_MASTER_SPECIES,
        "aqueous_equilibria": AQUEOUS_EQUILIBRIA,
        "mineral_solubilities": MINERAL_SOLUBILITIES,
        "version": "phreeqc_core_v1"
    }
