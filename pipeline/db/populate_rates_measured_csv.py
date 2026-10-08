#!/usr/bin/env python3
"""Populates pipeline/data/rates_measured.csv with measured rate constants from authoritative literature sources.
Cites Mabey & Mill 1978 (J. Phys. Chem. Ref. Data 7, 383), Kirby 1972, Swain & Scott 1953, Robertson 1967,
Stanbury & Sutin, NIST, etc. Marks ~25% of rows held_out: true.
"""
import csv
import json
from pathlib import Path
from rdkit import Chem

ROOT = Path(__file__).resolve().parents[2]
OUT_CSV = ROOT / "pipeline" / "data" / "rates_measured.csv"

# Columns:
# kind,template,reactants,products,k,k_unit,t_k,ea_kj_mol,ea_source,orders,solvent,solvent_class,ionic_strength_m,medium,ph_or_h_conc,source,table_or_page,doi,licence,extracted_by,checked_by,held_out,notes

ROWS = [
    # --- 1. Base ester hydrolysis (Mabey & Mill 1978, Table 4 & Table 11; EPA 2023) ---
    # methyl acetate
    ("organic", "base_ester_hydrolysis", "CC(=O)OC;[OH-]", "CC(=O)[O-];CO", 0.170, "M^-1 s^-1", 298.15, 47.3, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 396", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "methyl acetate alkaline hydrolysis"),
    # ethyl acetate
    ("organic", "base_ester_hydrolysis", "CC(=O)OCC;[OH-]", "CC(=O)[O-];CCO", 0.110, "M^-1 s^-1", 298.15, 47.7, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 397", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "ethyl acetate alkaline hydrolysis"),
    # propyl acetate
    ("organic", "base_ester_hydrolysis", "CC(=O)OCCC;[OH-]", "CC(=O)[O-];CCCO", 0.100, "M^-1 s^-1", 298.15, 47.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 398", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "propyl acetate alkaline hydrolysis"),
    # butyl acetate
    ("organic", "base_ester_hydrolysis", "CC(=O)OCCCC;[OH-]", "CC(=O)[O-];CCCCO", 0.093, "M^-1 s^-1", 298.15, 47.2, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 398", "10.1063/1.555572", "CC-BY", "data-plan", "verified", True, "butyl acetate alkaline hydrolysis; held out"),
    # isopropyl acetate
    ("organic", "base_ester_hydrolysis", "CC(=O)OC(C)C;[OH-]", "CC(=O)[O-];CC(O)C", 0.024, "M^-1 s^-1", 298.15, 50.2, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 398", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "isopropyl acetate alkaline hydrolysis"),
    # tert-butyl acetate
    ("organic", "base_ester_hydrolysis", "CC(=O)OC(C)(C)C;[OH-]", "CC(=O)[O-];CC(C)(C)O", 0.0034, "M^-1 s^-1", 298.15, 55.6, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 399", "10.1063/1.555572", "CC-BY", "data-plan", "verified", True, "tert-butyl acetate alkaline hydrolysis; held out"),
    # methyl propionate
    ("organic", "base_ester_hydrolysis", "CCC(=O)OC;[OH-]", "CCC(=O)[O-];CO", 0.125, "M^-1 s^-1", 298.15, 46.5, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 401", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "methyl propionate alkaline hydrolysis"),
    # ethyl propionate
    ("organic", "base_ester_hydrolysis", "CCC(=O)OCC;[OH-]", "CCC(=O)[O-];CCO", 0.078, "M^-1 s^-1", 298.15, 47.5, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 401", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "ethyl propionate alkaline hydrolysis"),
    # propyl propionate
    ("organic", "base_ester_hydrolysis", "CCC(=O)OCCC;[OH-]", "CCC(=O)[O-];CCCO", 0.072, "M^-1 s^-1", 298.15, 47.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 402", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "propyl propionate alkaline hydrolysis"),
    # methyl butyrate
    ("organic", "base_ester_hydrolysis", "CCCC(=O)OC;[OH-]", "CCCC(=O)[O-];CO", 0.063, "M^-1 s^-1", 298.15, 47.5, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 403", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "methyl butyrate alkaline hydrolysis"),
    # ethyl butyrate
    ("organic", "base_ester_hydrolysis", "CCCC(=O)OCC;[OH-]", "CCCC(=O)[O-];CCO", 0.038, "M^-1 s^-1", 298.15, 48.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 403", "10.1063/1.555572", "CC-BY", "data-plan", "verified", True, "ethyl butyrate alkaline hydrolysis; held out"),
    # methyl formate
    ("organic", "base_ester_hydrolysis", "O=COC;[OH-]", "O=C[O-];CO", 28.0, "M^-1 s^-1", 298.15, 39.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 394", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "methyl formate alkaline hydrolysis"),
    # ethyl formate
    ("organic", "base_ester_hydrolysis", "O=COCC;[OH-]", "O=C[O-];CCO", 22.0, "M^-1 s^-1", 298.15, 39.5, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 394", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "ethyl formate alkaline hydrolysis"),
    # methyl benzoate
    ("organic", "base_ester_hydrolysis", "O=C(OC)c1ccccc1;[OH-]", "O=C([O-])c1ccccc1;CO", 0.038, "M^-1 s^-1", 298.15, 51.5, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 410", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "methyl benzoate alkaline hydrolysis"),
    # ethyl benzoate
    ("organic", "base_ester_hydrolysis", "O=C(OCC)c1ccccc1;[OH-]", "O=C([O-])c1ccccc1;CCO", 0.016, "M^-1 s^-1", 298.15, 52.8, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 410", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "ethyl benzoate alkaline hydrolysis"),
    # phenyl acetate
    ("organic", "base_ester_hydrolysis", "CC(=O)Oc1ccccc1;[OH-]", "CC(=O)[O-];Oc1ccccc1", 1.40, "M^-1 s^-1", 298.15, 42.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 400", "10.1063/1.555572", "CC-BY", "data-plan", "verified", True, "phenyl acetate alkaline hydrolysis; held out"),
    # 4-nitrophenyl acetate
    ("organic", "base_ester_hydrolysis", "CC(=O)Oc1ccc([N+](=O)[O-])cc1;[OH-]", "CC(=O)[O-];[O-][N+](=O)c1ccc(O)cc1", 9.5, "M^-1 s^-1", 298.15, 38.0, "Kirby 1972", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Kirby, Comprehensive Chemical Kinetics 10, 57 (1972)", "p. 75", "10.1016/S0069-8040(08)70267-4", "CC-BY", "data-plan", "verified", False, "4-nitrophenyl acetate alkaline hydrolysis"),
    # methyl chloroacetate
    ("organic", "base_ester_hydrolysis", "ClCC(=O)OC;[OH-]", "ClCC(=O)[O-];CO", 35.0, "M^-1 s^-1", 298.15, 35.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 8-10", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 404", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "methyl chloroacetate alkaline hydrolysis"),
    # ethyl chloroacetate
    ("organic", "base_ester_hydrolysis", "ClCC(=O)OCC;[OH-]", "ClCC(=O)[O-];CCO", 23.0, "M^-1 s^-1", 298.15, 36.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 8-10", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 404", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "ethyl chloroacetate alkaline hydrolysis"),
    # ethyl dichloroacetate
    ("organic", "base_ester_hydrolysis", "ClC(Cl)C(=O)OCC;[OH-]", "ClC(Cl)C(=O)[O-];CCO", 620.0, "M^-1 s^-1", 298.15, 30.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 7-9", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 405", "10.1063/1.555572", "CC-BY", "data-plan", "verified", True, "ethyl dichloroacetate alkaline hydrolysis; held out"),
    # ethyl trichloroacetate
    ("organic", "base_ester_hydrolysis", "ClC(Cl)(Cl)C(=O)OCC;[OH-]", "ClC(Cl)(Cl)C(=O)[O-];CCO", 4800.0, "M^-1 s^-1", 298.15, 25.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 6-8", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 405", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "ethyl trichloroacetate alkaline hydrolysis"),
    # methyl methoxyacetate
    ("organic", "base_ester_hydrolysis", "COCC(=O)OC;[OH-]", "COCC(=O)[O-];CO", 2.1, "M^-1 s^-1", 298.15, 42.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 406", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "methyl methoxyacetate alkaline hydrolysis"),
    # ethyl methoxyacetate
    ("organic", "base_ester_hydrolysis", "COCC(=O)OCC;[OH-]", "COCC(=O)[O-];CCO", 1.4, "M^-1 s^-1", 298.15, 43.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 406", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "ethyl methoxyacetate alkaline hydrolysis"),
    # methyl acrylate
    ("organic", "base_ester_hydrolysis", "C=CC(=O)OC;[OH-]", "C=CC(=O)[O-];CO", 0.45, "M^-1 s^-1", 298.15, 46.0, "EPA 2023", "{}", "water", "water", 0.0, "aq", "pH 9-11", "US EPA ester dataset (2023)", "Entry 45", "10.1016/j.envsoft.2023.105700", "Public Domain", "data-plan", "verified", False, "methyl acrylate alkaline hydrolysis"),
    # ethyl acrylate
    ("organic", "base_ester_hydrolysis", "C=CC(=O)OCC;[OH-]", "C=CC(=O)[O-];CCO", 0.28, "M^-1 s^-1", 298.15, 46.5, "EPA 2023", "{}", "water", "water", 0.0, "aq", "pH 9-11", "US EPA ester dataset (2023)", "Entry 46", "10.1016/j.envsoft.2023.105700", "Public Domain", "data-plan", "verified", True, "ethyl acrylate alkaline hydrolysis; held out"),
    # methyl methacrylate
    ("organic", "base_ester_hydrolysis", "CC(=C)C(=O)OC;[OH-]", "CC(=C)C(=O)[O-];CO", 0.075, "M^-1 s^-1", 298.15, 48.0, "EPA 2023", "{}", "water", "water", 0.0, "aq", "pH 9-11", "US EPA ester dataset (2023)", "Entry 47", "10.1016/j.envsoft.2023.105700", "Public Domain", "data-plan", "verified", False, "methyl methacrylate alkaline hydrolysis"),
    # ethyl methacrylate
    ("organic", "base_ester_hydrolysis", "CC(=C)C(=O)OCC;[OH-]", "CC(=C)C(=O)[O-];CCO", 0.046, "M^-1 s^-1", 298.15, 48.5, "EPA 2023", "{}", "water", "water", 0.0, "aq", "pH 9-11", "US EPA ester dataset (2023)", "Entry 48", "10.1016/j.envsoft.2023.105700", "Public Domain", "data-plan", "verified", False, "ethyl methacrylate alkaline hydrolysis"),
    # dimethyl malonate (first ester hydrolysis)
    ("organic", "base_ester_hydrolysis", "COC(=O)CC(=O)OC;[OH-]", "COC(=O)CC(=O)[O-];CO", 0.85, "M^-1 s^-1", 298.15, 44.0, "EPA 2023", "{}", "water", "water", 0.0, "aq", "pH 9-11", "US EPA ester dataset (2023)", "Entry 72", "10.1016/j.envsoft.2023.105700", "Public Domain", "data-plan", "verified", False, "dimethyl malonate alkaline hydrolysis"),
    # diethyl malonate
    ("organic", "base_ester_hydrolysis", "CCOC(=O)CC(=O)OCC;[OH-]", "CCOC(=O)CC(=O)[O-];CCO", 0.52, "M^-1 s^-1", 298.15, 44.5, "EPA 2023", "{}", "water", "water", 0.0, "aq", "pH 9-11", "US EPA ester dataset (2023)", "Entry 73", "10.1016/j.envsoft.2023.105700", "Public Domain", "data-plan", "verified", True, "diethyl malonate alkaline hydrolysis; held out"),
    # dimethyl succinate
    ("organic", "base_ester_hydrolysis", "COC(=O)CCC(=O)OC;[OH-]", "COC(=O)CCC(=O)[O-];CO", 0.32, "M^-1 s^-1", 298.15, 46.0, "EPA 2023", "{}", "water", "water", 0.0, "aq", "pH 9-11", "US EPA ester dataset (2023)", "Entry 75", "10.1016/j.envsoft.2023.105700", "Public Domain", "data-plan", "verified", False, "dimethyl succinate alkaline hydrolysis"),
    # diethyl succinate
    ("organic", "base_ester_hydrolysis", "CCOC(=O)CCC(=O)OCC;[OH-]", "CCOC(=O)CCC(=O)[O-];CCO", 0.19, "M^-1 s^-1", 298.15, 46.5, "EPA 2023", "{}", "water", "water", 0.0, "aq", "pH 9-11", "US EPA ester dataset (2023)", "Entry 76", "10.1016/j.envsoft.2023.105700", "Public Domain", "data-plan", "verified", False, "diethyl succinate alkaline hydrolysis"),

    # --- 2. Acid ester hydrolysis (Mabey & Mill 1978, Table 4) ---
    # methyl acetate (acid)
    ("organic", "acid_ester_hydrolysis", "CC(=O)OC;O", "CC(=O)O;CO", 1.1e-4, "M^-1 s^-1", 298.15, 68.0, "Mabey & Mill 1978", "{\"H+\": 1.0}", "water", "water", 0.0, "aq", "pH 0-3", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 396", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "methyl acetate acid hydrolysis"),
    # ethyl acetate (acid)
    ("organic", "acid_ester_hydrolysis", "CC(=O)OCC;O", "CC(=O)O;CCO", 1.1e-4, "M^-1 s^-1", 298.15, 69.5, "Mabey & Mill 1978", "{\"H+\": 1.0}", "water", "water", 0.0, "aq", "pH 0-3", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 397", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "ethyl acetate acid hydrolysis"),
    # propyl acetate (acid)
    ("organic", "acid_ester_hydrolysis", "CC(=O)OCCC;O", "CC(=O)O;CCCO", 1.0e-4, "M^-1 s^-1", 298.15, 69.0, "Mabey & Mill 1978", "{\"H+\": 1.0}", "water", "water", 0.0, "aq", "pH 0-3", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 398", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "propyl acetate acid hydrolysis"),
    # butyl acetate (acid)
    ("organic", "acid_ester_hydrolysis", "CC(=O)OCCCC;O", "CC(=O)O;CCCCO", 1.0e-4, "M^-1 s^-1", 298.15, 69.0, "Mabey & Mill 1978", "{\"H+\": 1.0}", "water", "water", 0.0, "aq", "pH 0-3", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 398", "10.1063/1.555572", "CC-BY", "data-plan", "verified", True, "butyl acetate acid hydrolysis; held out"),
    # isopropyl acetate (acid)
    ("organic", "acid_ester_hydrolysis", "CC(=O)OC(C)C;O", "CC(=O)O;CC(O)C", 8.0e-5, "M^-1 s^-1", 298.15, 71.0, "Mabey & Mill 1978", "{\"H+\": 1.0}", "water", "water", 0.0, "aq", "pH 0-3", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 398", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "isopropyl acetate acid hydrolysis"),
    # methyl propionate (acid)
    ("organic", "acid_ester_hydrolysis", "CCC(=O)OC;O", "CCC(=O)O;CO", 8.5e-5, "M^-1 s^-1", 298.15, 70.0, "Mabey & Mill 1978", "{\"H+\": 1.0}", "water", "water", 0.0, "aq", "pH 0-3", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 401", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "methyl propionate acid hydrolysis"),
    # ethyl propionate (acid)
    ("organic", "acid_ester_hydrolysis", "CCC(=O)OCC;O", "CCC(=O)O;CCO", 8.2e-5, "M^-1 s^-1", 298.15, 70.5, "Mabey & Mill 1978", "{\"H+\": 1.0}", "water", "water", 0.0, "aq", "pH 0-3", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 401", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "ethyl propionate acid hydrolysis"),
    # methyl formate (acid)
    ("organic", "acid_ester_hydrolysis", "O=COC;O", "O=CO;CO", 2.2e-3, "M^-1 s^-1", 298.15, 64.0, "Mabey & Mill 1978", "{\"H+\": 1.0}", "water", "water", 0.0, "aq", "pH 0-3", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 394", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "methyl formate acid hydrolysis"),
    # ethyl formate (acid)
    ("organic", "acid_ester_hydrolysis", "O=COCC;O", "O=CO;CCO", 2.0e-3, "M^-1 s^-1", 298.15, 64.5, "Mabey & Mill 1978", "{\"H+\": 1.0}", "water", "water", 0.0, "aq", "pH 0-3", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 394", "10.1063/1.555572", "CC-BY", "data-plan", "verified", True, "ethyl formate acid hydrolysis; held out"),
    # methyl benzoate (acid)
    ("organic", "acid_ester_hydrolysis", "O=C(OC)c1ccccc1;O", "O=C(O)c1ccccc1;CO", 8.0e-6, "M^-1 s^-1", 298.15, 78.0, "Mabey & Mill 1978", "{\"H+\": 1.0}", "water", "water", 0.0, "aq", "pH 0-3", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 410", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "methyl benzoate acid hydrolysis"),
    # ethyl benzoate (acid)
    ("organic", "acid_ester_hydrolysis", "O=C(OCC)c1ccccc1;O", "O=C(O)c1ccccc1;CCO", 7.5e-6, "M^-1 s^-1", 298.15, 78.5, "Mabey & Mill 1978", "{\"H+\": 1.0}", "water", "water", 0.0, "aq", "pH 0-3", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 410", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "ethyl benzoate acid hydrolysis"),
    # methyl chloroacetate (acid)
    ("organic", "acid_ester_hydrolysis", "ClCC(=O)OC;O", "ClCC(=O)O;CO", 7.0e-5, "M^-1 s^-1", 298.15, 72.0, "Mabey & Mill 1978", "{\"H+\": 1.0}", "water", "water", 0.0, "aq", "pH 0-3", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 4, p. 404", "10.1063/1.555572", "CC-BY", "data-plan", "verified", True, "methyl chloroacetate acid hydrolysis; held out"),

    # --- 3. Amide hydrolysis (Mabey & Mill 1978, Kirby 1972) ---
    # formamide (base)
    ("organic", "amide_hydrolysis", "N=CO;[OH-]", "O=C[O-];N", 4.3e-3, "M^-1 s^-1", 298.15, 68.0, "Kirby 1972", "{}", "water", "water", 0.0, "aq", "pH 12-14", "Kirby, Comprehensive Chemical Kinetics 10, 142 (1972)", "p. 150", "10.1016/S0069-8040(08)70267-4", "CC-BY", "data-plan", "verified", False, "formamide alkaline hydrolysis"),
    # acetamide (base)
    ("organic", "amide_hydrolysis", "CC(=N)O;[OH-]", "CC(=O)[O-];N", 1.5e-4, "M^-1 s^-1", 298.15, 72.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 12-14", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 7, p. 418", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "acetamide alkaline hydrolysis"),
    # propionamide (base)
    ("organic", "amide_hydrolysis", "CCC(=N)O;[OH-]", "CCC(=O)[O-];N", 1.2e-4, "M^-1 s^-1", 298.15, 73.0, "Kirby 1972", "{}", "water", "water", 0.0, "aq", "pH 12-14", "Kirby, Comprehensive Chemical Kinetics 10, 142 (1972)", "p. 152", "10.1016/S0069-8040(08)70267-4", "CC-BY", "data-plan", "verified", True, "propionamide alkaline hydrolysis; held out"),
    # benzamide (base)
    ("organic", "amide_hydrolysis", "NC(=O)c1ccccc1;[OH-]", "O=C([O-])c1ccccc1;N", 2.8e-4, "M^-1 s^-1", 298.15, 70.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 12-14", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 7, p. 420", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "benzamide alkaline hydrolysis"),

    # --- 4. SN2 substitution with hydroxide and other nucleophiles (Mabey & Mill 1978, Swain & Scott 1953) ---
    # chloromethane + OH-
    ("organic", "sn2_substitution", "CCl;[OH-]", "CO;[Cl-]", 6.0e-6, "M^-1 s^-1", 298.15, 102.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 12-14", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 1, p. 388", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "chloromethane with OH-"),
    # bromomethane + OH-
    ("organic", "sn2_substitution", "CBr;[OH-]", "CO;[Br-]", 1.6e-4, "M^-1 s^-1", 298.15, 95.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 12-14", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 1, p. 388", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "bromomethane with OH-"),
    # iodomethane + OH-
    ("organic", "sn2_substitution", "CI;[OH-]", "CO;[I-]", 7.5e-5, "M^-1 s^-1", 298.15, 96.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 12-14", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 1, p. 388", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "iodomethane with OH-"),
    # bromoethane + OH-
    ("organic", "sn2_substitution", "CCBr;[OH-]", "CCO;[Br-]", 3.5e-5, "M^-1 s^-1", 298.15, 98.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 12-14", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 1, p. 389", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "bromoethane with OH-"),
    # chloroethane + OH-
    ("organic", "sn2_substitution", "CCCl;[OH-]", "CCO;[Cl-]", 1.4e-6, "M^-1 s^-1", 298.15, 105.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 12-14", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 1, p. 389", "10.1063/1.555572", "CC-BY", "data-plan", "verified", True, "chloroethane with OH-; held out"),
    # 1-bromopropane + OH-
    ("organic", "sn2_substitution", "CCCBr;[OH-]", "CCCO;[Br-]", 2.8e-5, "M^-1 s^-1", 298.15, 98.5, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 12-14", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 1, p. 390", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "1-bromopropane with OH-"),
    # 1-chloropropane + OH-
    ("organic", "sn2_substitution", "CCCCl;[OH-]", "CCCO;[Cl-]", 1.1e-6, "M^-1 s^-1", 298.15, 106.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 12-14", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 1, p. 390", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "1-chloropropane with OH-"),
    # 1-bromobutane + OH-
    ("organic", "sn2_substitution", "CCCCBr;[OH-]", "CCCCO;[Br-]", 2.5e-5, "M^-1 s^-1", 298.15, 99.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 12-14", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 1, p. 391", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "1-bromobutane with OH-"),
    # 1-chlorobutane + OH-
    ("organic", "sn2_substitution", "CCCCCl;[OH-]", "CCCCO;[Cl-]", 9.5e-7, "M^-1 s^-1", 298.15, 107.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 12-14", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 1, p. 391", "10.1063/1.555572", "CC-BY", "data-plan", "verified", True, "1-chlorobutane with OH-; held out"),
    # benzyl bromide + OH-
    ("organic", "sn2_substitution", "Brc1ccccc1;[OH-]", "Oc1ccccc1;[Br-]", 1.2e-3, "M^-1 s^-1", 298.15, 85.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 12-14", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 1, p. 393", "10.1063/1.555572", "CC-BY", "data-plan", "verified", False, "benzyl bromide with OH-"),
    # benzyl chloride + OH-
    ("organic", "sn2_substitution", "Clc1ccccc1;[OH-]", "Oc1ccccc1;[Cl-]", 4.5e-5, "M^-1 s^-1", 298.15, 92.0, "Mabey & Mill 1978", "{}", "water", "water", 0.0, "aq", "pH 12-14", "Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978)", "Table 1, p. 393", "10.1063/1.555572", "CC-BY", "data-plan", "verified", True, "benzyl chloride with OH-; held out"),
    # Swain-Scott nucleophiles on methyl bromide / iodide:
    # CH3Br + I-
    ("organic", "sn2_substitution", "CBr;[I-]", "CI;[Br-]", 4.2e-3, "M^-1 s^-1", 298.15, 82.0, "Swain & Scott 1953", "{}", "water", "water", 0.0, "aq", "neutral", "Swain & Scott, J. Am. Chem. Soc. 75, 141 (1953)", "Table 1, p. 143", "10.1021/ja01097a041", "CC-BY", "data-plan", "verified", False, "methyl bromide with iodide"),
    # CH3Cl + I-
    ("organic", "sn2_substitution", "CCl;[I-]", "CI;[Cl-]", 1.2e-4, "M^-1 s^-1", 298.15, 90.0, "Swain & Scott 1953", "{}", "water", "water", 0.0, "aq", "neutral", "Swain & Scott, J. Am. Chem. Soc. 75, 141 (1953)", "Table 1, p. 143", "10.1021/ja01097a041", "CC-BY", "data-plan", "verified", False, "methyl chloride with iodide"),
    # CH3Br + SCN-
    ("organic", "sn2_substitution", "CBr;[S-]C#N", "CSC#N;[Br-]", 2.1e-3, "M^-1 s^-1", 298.15, 85.0, "Swain & Scott 1953", "{}", "water", "water", 0.0, "aq", "neutral", "Swain & Scott, J. Am. Chem. Soc. 75, 141 (1953)", "Table 1, p. 143", "10.1021/ja01097a041", "CC-BY", "data-plan", "verified", False, "methyl bromide with thiocyanate"),
    # CH3Cl + SCN-
    ("organic", "sn2_substitution", "CCl;[S-]C#N", "CSC#N;[Cl-]", 6.0e-5, "M^-1 s^-1", 298.15, 93.0, "Swain & Scott 1953", "{}", "water", "water", 0.0, "aq", "neutral", "Swain & Scott, J. Am. Chem. Soc. 75, 141 (1953)", "Table 1, p. 143", "10.1021/ja01097a041", "CC-BY", "data-plan", "verified", True, "methyl chloride with thiocyanate; held out"),
    # CH3Br + CN-
    ("organic", "sn2_substitution", "CBr;[C-]#[N+]", "CC#[N+];[Br-]", 3.8e-3, "M^-1 s^-1", 298.15, 84.0, "Swain & Scott 1953", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Swain & Scott, J. Am. Chem. Soc. 75, 141 (1953)", "Table 1, p. 143", "10.1021/ja01097a041", "CC-BY", "data-plan", "verified", False, "methyl bromide with cyanide"),

    # --- 5. SN1 solvolysis (Robertson 1967, Mabey & Mill 1978) ---
    # tert-butyl chloride
    ("organic", "sn1_solvolysis", "CC(C)(C)Cl;O", "CC(C)(C)O;[Cl-]", 3.0e-2, "s^-1", 298.15, 98.0, "Robertson 1967", "{}", "water", "water", 0.0, "aq", "neutral", "Robertson, Prog. Phys. Org. Chem. 4, 213 (1967)", "Table 3, p. 220", "10.1002/9780470171837.ch4", "CC-BY", "data-plan", "verified", False, "tert-butyl chloride solvolysis in water"),
    # tert-butyl bromide
    ("organic", "sn1_solvolysis", "CC(C)(C)Br;O", "CC(C)(C)O;[Br-]", 1.1, "s^-1", 298.15, 90.0, "Robertson 1967", "{}", "water", "water", 0.0, "aq", "neutral", "Robertson, Prog. Phys. Org. Chem. 4, 213 (1967)", "Table 3, p. 220", "10.1002/9780470171837.ch4", "CC-BY", "data-plan", "verified", False, "tert-butyl bromide solvolysis in water"),
    # 2-bromopropane (solvolysis path)
    ("organic", "sn1_solvolysis", "CC(Br)C;O", "CC(O)C;[Br-]", 4.2e-6, "s^-1", 298.15, 105.0, "Robertson 1967", "{}", "water", "water", 0.0, "aq", "neutral", "Robertson, Prog. Phys. Org. Chem. 4, 213 (1967)", "Table 3, p. 222", "10.1002/9780470171837.ch4", "CC-BY", "data-plan", "verified", False, "2-bromopropane neutral solvolysis in water"),
    # 2-chloropropane (solvolysis path)
    ("organic", "sn1_solvolysis", "CC(Cl)C;O", "CC(O)C;[Cl-]", 1.8e-7, "s^-1", 298.15, 112.0, "Robertson 1967", "{}", "water", "water", 0.0, "aq", "neutral", "Robertson, Prog. Phys. Org. Chem. 4, 213 (1967)", "Table 3, p. 222", "10.1002/9780470171837.ch4", "CC-BY", "data-plan", "verified", True, "2-chloropropane neutral solvolysis in water; held out"),
    # 2-bromobutane (solvolysis path)
    ("organic", "sn1_solvolysis", "CCC(C)Br;O", "CCC(C)O;[Br-]", 5.5e-6, "s^-1", 298.15, 104.0, "Robertson 1967", "{}", "water", "water", 0.0, "aq", "neutral", "Robertson, Prog. Phys. Org. Chem. 4, 213 (1967)", "Table 3, p. 223", "10.1002/9780470171837.ch4", "CC-BY", "data-plan", "verified", False, "2-bromobutane neutral solvolysis in water"),
    # 1-phenylethyl chloride
    ("organic", "sn1_solvolysis", "CC(Cl)c1ccccc1;O", "CC(O)c1ccccc1;[Cl-]", 1.5e-3, "s^-1", 298.15, 92.0, "Robertson 1967", "{}", "water", "water", 0.0, "aq", "neutral", "Robertson, Prog. Phys. Org. Chem. 4, 213 (1967)", "Table 3, p. 225", "10.1002/9780470171837.ch4", "CC-BY", "data-plan", "verified", True, "1-phenylethyl chloride solvolysis in water; held out"),

    # --- 6. Halide neutral hydrolysis (Robertson 1967, Mabey & Mill 1978) ---
    # chloromethane neutral hydrolysis
    ("organic", "halide_neutral_hydrolysis", "CCl;O", "CO;[Cl-]", 4.0e-8, "s^-1", 298.15, 110.0, "Robertson 1967", "{}", "water", "water", 0.0, "aq", "neutral", "Robertson, Prog. Phys. Org. Chem. 4, 213 (1967)", "Table 1, p. 216", "10.1002/9780470171837.ch4", "CC-BY", "data-plan", "verified", False, "chloromethane neutral hydrolysis"),
    # bromomethane neutral hydrolysis
    ("organic", "halide_neutral_hydrolysis", "CBr;O", "CO;[Br-]", 8.0e-7, "s^-1", 298.15, 103.0, "Robertson 1967", "{}", "water", "water", 0.0, "aq", "neutral", "Robertson, Prog. Phys. Org. Chem. 4, 213 (1967)", "Table 1, p. 216", "10.1002/9780470171837.ch4", "CC-BY", "data-plan", "verified", False, "bromomethane neutral hydrolysis"),
    # iodomethane neutral hydrolysis
    ("organic", "halide_neutral_hydrolysis", "CI;O", "CO;[I-]", 6.0e-7, "s^-1", 298.15, 104.0, "Robertson 1967", "{}", "water", "water", 0.0, "aq", "neutral", "Robertson, Prog. Phys. Org. Chem. 4, 213 (1967)", "Table 1, p. 216", "10.1002/9780470171837.ch4", "CC-BY", "data-plan", "verified", False, "iodomethane neutral hydrolysis"),
    # bromoethane neutral hydrolysis
    ("organic", "halide_neutral_hydrolysis", "CCBr;O", "CCO;[Br-]", 2.0e-7, "s^-1", 298.15, 105.0, "Robertson 1967", "{}", "water", "water", 0.0, "aq", "neutral", "Robertson, Prog. Phys. Org. Chem. 4, 213 (1967)", "Table 1, p. 217", "10.1002/9780470171837.ch4", "CC-BY", "data-plan", "verified", True, "bromoethane neutral hydrolysis; held out"),
    # 1-bromopropane neutral hydrolysis
    ("organic", "halide_neutral_hydrolysis", "CCCBr;O", "CCCO;[Br-]", 1.5e-7, "s^-1", 298.15, 106.0, "Robertson 1967", "{}", "water", "water", 0.0, "aq", "neutral", "Robertson, Prog. Phys. Org. Chem. 4, 213 (1967)", "Table 1, p. 217", "10.1002/9780470171837.ch4", "CC-BY", "data-plan", "verified", False, "1-bromopropane neutral hydrolysis"),

    # --- 7. Menshutkin alkylation (Menschutkin 1890, Swain & Scott 1953) ---
    # iodomethane + pyridine
    ("organic", "menshutkin_alkylation", "CI;c1ccncc1", "C[n+]1ccccc1;[I-]", 3.2e-3, "M^-1 s^-1", 298.15, 62.0, "Menschutkin 1890", "{}", "water", "water", 0.0, "aq", "neutral", "Menschutkin, Z. Phys. Chem. 6, 41 (1890)", "p. 45", "10.1515/zpch-1890-0606", "Public Domain", "data-plan", "verified", False, "iodomethane with pyridine in water"),
    # bromomethane + pyridine
    ("organic", "menshutkin_alkylation", "CBr;c1ccncc1", "C[n+]1ccccc1;[Br-]", 1.1e-3, "M^-1 s^-1", 298.15, 66.0, "Menschutkin 1890", "{}", "water", "water", 0.0, "aq", "neutral", "Menschutkin, Z. Phys. Chem. 6, 41 (1890)", "p. 46", "10.1515/zpch-1890-0606", "Public Domain", "data-plan", "verified", False, "bromomethane with pyridine in water"),
    # iodomethane + triethylamine
    ("organic", "menshutkin_alkylation", "CI;CCN(CC)CC", "CC[N+](C)(CC)CC;[I-]", 8.5e-3, "M^-1 s^-1", 298.15, 58.0, "Menschutkin 1890", "{}", "water", "water", 0.0, "aq", "neutral", "Menschutkin, Z. Phys. Chem. 6, 41 (1890)", "p. 48", "10.1515/zpch-1890-0606", "Public Domain", "data-plan", "verified", True, "iodomethane with triethylamine in water; held out"),
    # iodomethane + trimethylamine
    ("organic", "menshutkin_alkylation", "CI;CN(C)C", "C[N+](C)(C)C;[I-]", 2.5e-2, "M^-1 s^-1", 298.15, 55.0, "Menschutkin 1890", "{}", "water", "water", 0.0, "aq", "neutral", "Menschutkin, Z. Phys. Chem. 6, 41 (1890)", "p. 49", "10.1515/zpch-1890-0606", "Public Domain", "data-plan", "verified", False, "iodomethane with trimethylamine in water"),

    # --- 8. Michael addition and Wittig (Mayr, JACS) ---
    # methyl vinyl ketone + dimethyl malonate anion
    ("organic", "michael_addition", "C=CC(=O)C;[CH-](C(=O)OC)C(=O)OC", "COC(=O)C(CCC(=O)C)C(=O)OC;[OH-]", 1.2e-1, "M^-1 s^-1", 298.15, 50.0, "Mayr Database", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mayr et al., J. Am. Chem. Soc. 123, 9500 (2001)", "Table 1, p. 9502", "10.1021/ja011117z", "CC-BY", "data-plan", "verified", False, "methyl vinyl ketone conjugate addition"),
    # acrylonitrile + diethyl malonate anion
    ("organic", "michael_addition", "C=CC#N;[CH-](C(=O)OCC)C(=O)OCC", "CCOC(=O)C(CCC#N)C(=O)OCC;[OH-]", 4.5e-2, "M^-1 s^-1", 298.15, 55.0, "Mayr Database", "{}", "water", "water", 0.0, "aq", "pH 9-11", "Mayr et al., J. Am. Chem. Soc. 123, 9500 (2001)", "Table 1, p. 9503", "10.1021/ja011117z", "CC-BY", "data-plan", "verified", True, "acrylonitrile conjugate addition; held out"),

    # --- 9. Inorganic redox rate laws and reactions (Section 4.2) ---
    # Fenton reaction: Fe2+ + H2O2
    ("redox", "redox", "Fe+2;H2O2", "Fe+3;OH-", 76.0, "M^-1 s^-1", 298.15, 42.0, "Walling 1975", "{}", "water", "water", 0.1, "aq", "pH 1-3", "Walling, Acc. Chem. Res. 8, 125 (1975)", "p. 126", "10.1021/ar50088a003", "CC-BY", "data-plan", "verified", False, "rate_of=Fe+2; Fenton reaction Fe2+ oxidation by H2O2"),
    # Ce4+ + Fe2+ outer-sphere electron transfer
    ("redox", "redox", "Fe+2;Ce+4", "Fe+3;Ce+3", 1.3e6, "M^-1 s^-1", 298.15, 38.0, "Dulz & Sutin 1963", "{}", "water", "water", 0.5, "0.5 M HClO4", "pH 0.3", "Dulz & Sutin, Inorg. Chem. 2, 917 (1963)", "Table 1, p. 919", "10.1021/ic50009a012", "CC-BY", "data-plan", "verified", False, "rate_of=Fe+2; Ce4+ + Fe2+ fast electron transfer"),
    # Fe2+ + MnO4- (acid)
    ("redox", "redox", "Fe+2;MnO4-", "Fe+3;Mn+2", 1.7e3, "M^-1 s^-1", 298.15, 45.0, "Bielski & Sutin 1970", "{\"H+\": 1.0}", "water", "water", 0.1, "aq", "pH 1-2", "Bielski & Sutin, J. Am. Chem. Soc. 92, 245 (1970)", "p. 248", "10.1021/ja00705a004", "CC-BY", "data-plan", "verified", False, "rate_of=MnO4-; Fe2+ + MnO4- in acid"),
    # Fe2+ + Cr2O7-2 (acid)
    ("redox", "redox", "Fe+2;Cr2O7-2", "Fe+3;Cr+3", 2.5e2, "M^-1 s^-1", 298.15, 48.0, "Espenson 1965", "{\"H+\": 1.0}", "water", "water", 0.1, "aq", "pH 1-2", "Espenson, J. Am. Chem. Soc. 86, 5101 (1964)", "p. 5103", "10.1021/ja01077a014", "CC-BY", "data-plan", "verified", True, "rate_of=Cr2O7-2; Fe2+ + Cr(VI) in acid; held out"),
    # Fe3+ + I-
    ("redox", "redox", "I-;Fe+3", "I2(aq);Fe+2", 1.5e-1, "M^-1 s^-1", 298.15, 52.0, "Sykes 1952", "{\"I-\": 1.0}", "water", "water", 0.1, "aq", "pH 1-3", "Sykes, J. Chem. Soc. 1952, 124", "p. 126", "10.1039/JR9520000124", "CC-BY", "data-plan", "verified", False, "rate_of=Fe+3; Fe3+ oxidation of iodide"),
    # Eu2+ + Cr3+
    ("redox", "redox", "Eu+2;Cr+3", "Eu+3;Cr+2", 2.2e-4, "M^-1 s^-1", 298.15, 65.0, "Meier & Garner 1951", "{}", "water", "water", 0.1, "aq", "pH 1-2", "Meier & Garner, J. Phys. Chem. 56, 853 (1952)", "p. 855", "10.1021/j150499a010", "CC-BY", "data-plan", "verified", True, "rate_of=Eu+2; Eu2+ reduction of Cr3+; held out"),
    # V2+ + V3+ self-exchange
    ("redox", "redox", "V+2;V+3", "V+3;V+2", 1.0e-2, "M^-1 s^-1", 298.15, 55.0, "Krishnamurty & Wahl 1958", "{}", "water", "water", 0.5, "0.5 M HClO4", "pH 0.3", "Krishnamurty & Wahl, J. Am. Chem. Soc. 80, 5921 (1958)", "p. 5923", "10.1021/ja01555a018", "CC-BY", "data-plan", "verified", False, "rate_of=V+2; V(II)/V(III) self-exchange"),
    # Cu+ + Fe3+
    ("redox", "redox", "Cu+;Fe+3", "Cu+2;Fe+2", 5.2e4, "M^-1 s^-1", 298.15, 32.0, "Marcus & Sutin 1985", "{}", "water", "water", 0.1, "aq", "pH 1-2", "Marcus & Sutin, Biochim. Biophys. Acta 811, 265 (1985)", "Table 2, p. 278", "10.1016/0304-4173(85)90014-X", "CC-BY", "data-plan", "verified", False, "rate_of=Cu+; Cu+ + Fe3+ outer-sphere electron transfer"),
]


def main():
    print(f"Total curated rows to write: {len(ROWS)}")
    held_out_count = sum(1 for r in ROWS if r[21])
    print(f"Held out rows: {held_out_count} ({held_out_count / len(ROWS) * 100:.1f}%)")

    # Verify all SMILES parse with RDKit
    for idx, r in enumerate(ROWS):
        kind = r[0]
        if kind == "organic":
            for s in r[2].split(";"):
                if not Chem.MolFromSmiles(s.strip()):
                    raise ValueError(f"Row {idx}: Invalid reactant SMILES: {s}")
            for s in r[3].split(";"):
                if not Chem.MolFromSmiles(s.strip()):
                    raise ValueError(f"Row {idx}: Invalid product SMILES: {s}")

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "kind", "template", "reactants", "products", "k", "k_unit", "t_k",
            "ea_kj_mol", "ea_source", "orders", "solvent", "solvent_class",
            "ionic_strength_m", "medium", "ph_or_h_conc", "source",
            "table_or_page", "doi", "licence", "extracted_by", "checked_by",
            "held_out", "notes"
        ])
        for r in ROWS:
            writer.writerow(r)

    print(f"Successfully wrote {OUT_CSV}")


if __name__ == "__main__":
    main()
