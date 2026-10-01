"""
IUPAC Organic and Inorganic pKa Dataset
Digitized compilation of thermodynamic acid dissociation constants at 25 °C.
"""
from typing import Dict, Any, List

IUPAC_PKA_RECORDS = [
    # Carboxylic acids
    {"name": "Formic acid", "smiles": "C(=O)O", "formula": "CH2O2", "pka": [3.75], "source": "IUPAC"},
    {"name": "Acetic acid", "smiles": "CC(=O)O", "formula": "C2H4O2", "pka": [4.76], "source": "IUPAC"},
    {"name": "Propionic acid", "smiles": "CCC(=O)O", "formula": "C3H6O2", "pka": [4.88], "source": "IUPAC"},
    {"name": "Butyric acid", "smiles": "CCCC(=O)O", "formula": "C4H8O2", "pka": [4.82], "source": "IUPAC"},
    {"name": "Benzoic acid", "smiles": "C1=CC=C(C=C1)C(=O)O", "formula": "C7H6O2", "pka": [4.20], "source": "IUPAC"},
    {"name": "Salicylic acid", "smiles": "C1=CC=C(C(=C1)C(=O)O)O", "formula": "C7H6O3", "pka": [2.97, 13.82], "source": "IUPAC"},
    {"name": "Citric acid", "smiles": "C(C(=O)O)C(CC(=O)O)(C(=O)O)O", "formula": "C6H8O7", "pka": [3.13, 4.76, 6.40], "source": "IUPAC"},
    {"name": "Oxalic acid", "smiles": "C(=O)(C(=O)O)O", "formula": "C2H2O4", "pka": [1.25, 4.27], "source": "IUPAC"},
    {"name": "Malonic acid", "smiles": "C(C(=O)O)C(=O)O", "formula": "C3H4O4", "pka": [2.85, 5.70], "source": "IUPAC"},
    {"name": "Succinic acid", "smiles": "C(CC(=O)O)C(=O)O", "formula": "C4H6O4", "pka": [4.21, 5.64], "source": "IUPAC"},
    {"name": "Lactic acid", "smiles": "CC(C(=O)O)O", "formula": "C3H6O3", "pka": [3.86], "source": "IUPAC"},
    {"name": "Chloroacetic acid", "smiles": "C(C(=O)O)Cl", "formula": "C2H3ClO2", "pka": [2.86], "source": "IUPAC"},
    {"name": "Trichloroacetic acid", "smiles": "C(=O)(C(Cl)(Cl)Cl)O", "formula": "C2HCl3O2", "pka": [0.66], "source": "IUPAC"},
    {"name": "Trifluoroacetic acid", "smiles": "C(=O)(C(F)(F)F)O", "formula": "C2HF3O2", "pka": [0.23], "source": "IUPAC"},

    # Phenols and alcohols
    {"name": "Phenol", "smiles": "C1=CC=C(C=C1)O", "formula": "C6H6O", "pka": [9.99], "source": "IUPAC"},
    {"name": "4-Nitrophenol", "smiles": "C1=CC(=CC=C1O)[N+](=O)[O-]", "formula": "C6H5NO3", "pka": [7.15], "source": "IUPAC"},
    {"name": "2,4-Dinitrophenol", "smiles": "C1=CC(=C(C=C1[N+](=O)[O-])[N+](=O)[O-])O", "formula": "C6H4N2O5", "pka": [4.07], "source": "IUPAC"},
    {"name": "Picric acid", "smiles": "C1=C(C(=C(C=C1[N+](=O)[O-])[N+](=O)[O-])O)[N+](=O)[O-]", "formula": "C6H3N3O7", "pka": [0.38], "source": "IUPAC"},
    {"name": "Ethanol", "smiles": "CCO", "formula": "C2H6O", "pka": [15.9], "source": "IUPAC"},
    {"name": "Methanol", "smiles": "CO", "formula": "CH4O", "pka": [15.5], "source": "IUPAC"},

    # Amines and nitrogen bases (conjugate acid pKa)
    {"name": "Ammonia", "smiles": "N", "formula": "H3N", "pka": [9.25], "source": "IUPAC"},
    {"name": "Methylamine", "smiles": "CN", "formula": "CH5N", "pka": [10.64], "source": "IUPAC"},
    {"name": "Ethylamine", "smiles": "CCN", "formula": "C2H7N", "pka": [10.65], "source": "IUPAC"},
    {"name": "Triethylamine", "smiles": "CCN(CC)CC", "formula": "C6H15N", "pka": [10.75], "source": "IUPAC"},
    {"name": "Pyridine", "smiles": "C1=CC=NC=C1", "formula": "C5H5N", "pka": [5.25], "source": "IUPAC"},
    {"name": "Aniline", "smiles": "C1=CC=C(C=C1)N", "formula": "C6H7N", "pka": [4.60], "source": "IUPAC"},
    {"name": "Imidazole", "smiles": "C1=CN=CN1", "formula": "C3H4N2", "pka": [6.95, 14.2], "source": "IUPAC"},

    # Inorganic acids
    {"name": "Hydrochloric acid", "smiles": "Cl", "formula": "HCl", "pka": [-6.3], "source": "IUPAC"},
    {"name": "Hydrobromic acid", "smiles": "Br", "formula": "HBr", "pka": [-9.0], "source": "IUPAC"},
    {"name": "Hydrofluoric acid", "smiles": "F", "formula": "HF", "pka": [3.17], "source": "IUPAC"},
    {"name": "Nitric acid", "smiles": "[N+](=O)(O)[O-]", "formula": "HNO3", "pka": [-1.4], "source": "IUPAC"},
    {"name": "Sulfuric acid", "smiles": "OS(=O)(=O)O", "formula": "H2SO4", "pka": [-3.0, 1.99], "source": "IUPAC"},
    {"name": "Phosphoric acid", "smiles": "OP(=O)(O)O", "formula": "H3PO4", "pka": [2.15, 7.20, 12.35], "source": "IUPAC"},
    {"name": "Carbonic acid", "smiles": "C(=O)(O)O", "formula": "H2CO3", "pka": [6.35, 10.33], "source": "IUPAC"},
    {"name": "Hydrogen sulfide", "smiles": "S", "formula": "H2S", "pka": [7.05, 19.0], "source": "IUPAC"},
    {"name": "Hydrogen cyanide", "smiles": "C#N", "formula": "HCN", "pka": [9.21], "source": "IUPAC"},
    {"name": "Boric acid", "smiles": "B(O)(O)O", "formula": "H3BO3", "pka": [9.24], "source": "IUPAC"},
]

def get_pka_records() -> List[Dict[str, Any]]:
    return IUPAC_PKA_RECORDS
