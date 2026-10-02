"""
Species Curation Module: the hand-checked core species (about 70 common bench chemicals).
Provides InChIKey mapping and reference properties (mp, bp, density, solubility, GHS hazards).

Only entries whose values were written down from a reference are kept. The generated homologous series and the
cation x anion salt matrix that used to pad this list to 500 species were removed (Stage 0): their mp / bp / density were
molar-mass arithmetic, their formulas tokens like "Salt_Sodium_bromide", and they overrode PubChem data on import.
"""
from typing import Dict, Any, List, Optional
from rdkit import Chem

# Core list of curated chemical compounds with verified reference values
PRIMARY_CHEMICALS = [
    # Solvents and organics
    {"name": "Water", "cid": 962, "formula": "H2O", "smiles": "O", "charge": 0, "mw": 18.015, "mp_c": 0.0, "bp_c": 100.0, "density": 0.998, "solubility": "miscible", "ghs": []},
    {"name": "Ethanol", "cid": 702, "formula": "C2H6O", "smiles": "CCO", "charge": 0, "mw": 46.069, "mp_c": -114.1, "bp_c": 78.2, "density": 0.789, "solubility": "miscible", "ghs": ["H225", "H319"]},
    {"name": "Methanol", "cid": 887, "formula": "CH4O", "smiles": "CO", "charge": 0, "mw": 32.042, "mp_c": -97.6, "bp_c": 64.7, "density": 0.792, "solubility": "miscible", "ghs": ["H225", "H301", "H311", "H331", "H370"]},
    {"name": "Acetone", "cid": 180, "formula": "C3H6O", "smiles": "CC(=O)C", "charge": 0, "mw": 58.08, "mp_c": -94.7, "bp_c": 56.1, "density": 0.784, "solubility": "miscible", "ghs": ["H225", "H319", "H336"]},
    {"name": "Isopropanol", "cid": 3776, "formula": "C3H8O", "smiles": "CC(C)O", "charge": 0, "mw": 60.096, "mp_c": -89.0, "bp_c": 82.6, "density": 0.786, "solubility": "miscible", "ghs": ["H225", "H319", "H336"]},
    {"name": "Acetic acid", "cid": 176, "formula": "C2H4O2", "smiles": "CC(=O)O", "charge": 0, "mw": 60.052, "mp_c": 16.6, "bp_c": 118.1, "density": 1.049, "solubility": "miscible", "ghs": ["H226", "H314"]},
    {"name": "Diethyl ether", "cid": 3283, "formula": "C4H10O", "smiles": "CCOCC", "charge": 0, "mw": 74.123, "mp_c": -116.3, "bp_c": 34.6, "density": 0.713, "solubility": "6.9 g/100 mL", "ghs": ["H224", "H302", "H336"]},
    {"name": "Ethyl acetate", "cid": 8857, "formula": "C4H8O2", "smiles": "CCOC(=O)C", "charge": 0, "mw": 88.106, "mp_c": -83.6, "bp_c": 77.1, "density": 0.902, "solubility": "8.3 g/100 mL", "ghs": ["H225", "H319", "H336"]},
    {"name": "Hexane", "cid": 8058, "formula": "C6H14", "smiles": "CCCCCC", "charge": 0, "mw": 86.177, "mp_c": -95.3, "bp_c": 68.7, "density": 0.655, "solubility": "immiscible", "ghs": ["H225", "H304", "H315", "H336", "H361f", "H373", "H411"]},
    {"name": "Toluene", "cid": 1140, "formula": "C7H8", "smiles": "CC1=CC=CC=C1", "charge": 0, "mw": 92.141, "mp_c": -94.9, "bp_c": 110.6, "density": 0.867, "solubility": "immiscible", "ghs": ["H225", "H304", "H315", "H336", "H361d", "H373"]},
    {"name": "Dichloromethane", "cid": 6344, "formula": "CH2Cl2", "smiles": "C(Cl)Cl", "charge": 0, "mw": 84.93, "mp_c": -96.7, "bp_c": 39.6, "density": 1.326, "solubility": "1.3 g/100 mL", "ghs": ["H315", "H319", "H351", "H336"]},
    {"name": "Chloroform", "cid": 6212, "formula": "CHCl3", "smiles": "C(Cl)(Cl)Cl", "charge": 0, "mw": 119.37, "mp_c": -63.5, "bp_c": 61.2, "density": 1.489, "solubility": "0.8 g/100 mL", "ghs": ["H302", "H315", "H319", "H331", "H351", "H361d", "H372"]},
    {"name": "Acetonitrile", "cid": 6342, "formula": "C2H3N", "smiles": "CC#N", "charge": 0, "mw": 41.053, "mp_c": -45.7, "bp_c": 81.6, "density": 0.786, "solubility": "miscible", "ghs": ["H225", "H302", "H312", "H319", "H332"]},
    {"name": "Tetrahydrofuran", "cid": 8028, "formula": "C4H8O", "smiles": "C1CCOC1", "charge": 0, "mw": 72.107, "mp_c": -108.4, "bp_c": 66.0, "density": 0.889, "solubility": "miscible", "ghs": ["H225", "H302", "H319", "H335", "H351"]},
    {"name": "Dimethyl sulfoxide", "cid": 679, "formula": "C2H6OS", "smiles": "CS(=O)C", "charge": 0, "mw": 78.13, "mp_c": 19.0, "bp_c": 189.0, "density": 1.100, "solubility": "miscible", "ghs": []},
    {"name": "Glycerol", "cid": 753, "formula": "C3H8O3", "smiles": "C(C(CO)O)O", "charge": 0, "mw": 92.094, "mp_c": 17.8, "bp_c": 290.0, "density": 1.261, "solubility": "miscible", "ghs": []},
    {"name": "Ethylene glycol", "cid": 174, "formula": "C2H6O2", "smiles": "C(CO)O", "charge": 0, "mw": 62.068, "mp_c": -12.9, "bp_c": 197.3, "density": 1.113, "solubility": "miscible", "ghs": ["H302", "H373"]},
    {"name": "Benzene", "cid": 241, "formula": "C6H6", "smiles": "C1=CC=CC=C1", "charge": 0, "mw": 78.114, "mp_c": 5.5, "bp_c": 80.1, "density": 0.876, "solubility": "0.18 g/100 mL", "ghs": ["H225", "H304", "H315", "H319", "H340", "H350", "H372"]},
    {"name": "Cyclohexane", "cid": 8078, "formula": "C6H12", "smiles": "C1CCCCC1", "charge": 0, "mw": 84.161, "mp_c": 6.5, "bp_c": 80.7, "density": 0.779, "solubility": "immiscible", "ghs": ["H225", "H304", "H315", "H336", "H410"]},
    {"name": "1-Butanol", "cid": 263, "formula": "C4H10O", "smiles": "CCCCO", "charge": 0, "mw": 74.123, "mp_c": -89.8, "bp_c": 117.7, "density": 0.810, "solubility": "7.7 g/100 mL", "ghs": ["H226", "H302", "H315", "H318", "H335", "H336"]},
    
    # Acids and Bases
    {"name": "Hydrochloric acid", "cid": 313, "formula": "ClH", "smiles": "Cl", "charge": 0, "mw": 36.46, "mp_c": -114.2, "bp_c": -85.1, "density": 1.189, "solubility": "miscible", "ghs": ["H314", "H335"]},
    {"name": "Sulfuric acid", "cid": 1118, "formula": "H2SO4", "smiles": "OS(=O)(=O)O", "charge": 0, "mw": 98.08, "mp_c": 10.3, "bp_c": 337.0, "density": 1.840, "solubility": "miscible", "ghs": ["H314"]},
    {"name": "Nitric acid", "cid": 944, "formula": "HNO3", "smiles": "[N+](=O)(O)[O-]", "charge": 0, "mw": 63.012, "mp_c": -41.6, "bp_c": 83.0, "density": 1.513, "solubility": "miscible", "ghs": ["H272", "H314"]},
    {"name": "Phosphoric acid", "cid": 1004, "formula": "H3PO4", "smiles": "OP(=O)(O)O", "charge": 0, "mw": 97.994, "mp_c": 42.4, "bp_c": 158.0, "density": 1.685, "solubility": "miscible", "ghs": ["H314"]},
    {"name": "Formic acid", "cid": 280, "formula": "CH2O2", "smiles": "C(=O)O", "charge": 0, "mw": 46.025, "mp_c": 8.4, "bp_c": 100.8, "density": 1.220, "solubility": "miscible", "ghs": ["H226", "H302", "H314", "H331"]},
    {"name": "Sodium hydroxide", "cid": 14798, "formula": "HNaO", "smiles": "[OH-].[Na+]", "charge": 0, "mw": 39.997, "mp_c": 318.0, "bp_c": 1388.0, "density": 2.130, "solubility": "109 g/100 mL", "ghs": ["H314"]},
    {"name": "Potassium hydroxide", "cid": 14797, "formula": "HKO", "smiles": "[OH-].[K+]", "charge": 0, "mw": 56.106, "mp_c": 360.0, "bp_c": 1327.0, "density": 2.044, "solubility": "121 g/100 mL", "ghs": ["H302", "H314"]},
    {"name": "Ammonia", "cid": 222, "formula": "H3N", "smiles": "N", "charge": 0, "mw": 17.031, "mp_c": -77.7, "bp_c": -33.3, "density": 0.730, "solubility": "miscible", "ghs": ["H221", "H280", "H314", "H331", "H400"]},
    {"name": "Calcium hydroxide", "cid": 24553, "formula": "CaH2O2", "smiles": "[OH-].[OH-].[Ca+2]", "charge": 0, "mw": 74.093, "mp_c": 580.0, "bp_c": 2850.0, "density": 2.211, "solubility": "0.17 g/100 mL", "ghs": ["H315", "H318", "H335"]},

    # Inorganic Salts
    {"name": "Sodium chloride", "cid": 5234, "formula": "ClNa", "smiles": "[Na+].[Cl-]", "charge": 0, "mw": 58.44, "mp_c": 801.0, "bp_c": 1465.0, "density": 2.165, "solubility": "36.0 g/100 mL", "ghs": []},
    {"name": "Potassium chloride", "cid": 4873, "formula": "ClK", "smiles": "[K+].[Cl-]", "charge": 0, "mw": 74.551, "mp_c": 770.0, "bp_c": 1420.0, "density": 1.984, "solubility": "34.2 g/100 mL", "ghs": []},
    {"name": "Calcium chloride", "cid": 5284359, "formula": "CaCl2", "smiles": "[Cl-].[Cl-].[Ca+2]", "charge": 0, "mw": 110.98, "mp_c": 772.0, "bp_c": 1935.0, "density": 2.150, "solubility": "74.5 g/100 mL", "ghs": ["H319"]},
    {"name": "Magnesium chloride", "cid": 5360315, "formula": "Cl2Mg", "smiles": "[Cl-].[Cl-].[Mg+2]", "charge": 0, "mw": 95.211, "mp_c": 714.0, "bp_c": 1412.0, "density": 2.320, "solubility": "54.3 g/100 mL", "ghs": []},
    {"name": "Copper(II) sulfate", "cid": 24462, "formula": "CuO4S", "smiles": "[Cu+2].[O-]S(=O)(=O)[O-]", "charge": 0, "mw": 159.61, "mp_c": 110.0, "bp_c": 650.0, "density": 3.603, "solubility": "20.3 g/100 mL", "ghs": ["H302", "H315", "H319", "H410"]},
    {"name": "Copper(II) sulfate pentahydrate", "cid": 24463, "formula": "CuH10O9S", "smiles": "O.O.O.O.O.[Cu+2].[O-]S(=O)(=O)[O-]", "charge": 0, "mw": 249.68, "mp_c": 110.0, "bp_c": 150.0, "density": 2.286, "solubility": "31.6 g/100 mL", "ghs": ["H302", "H315", "H319", "H410"]},
    {"name": "Iron(II) sulfate", "cid": 24393, "formula": "FeO4S", "smiles": "[Fe+2].[O-]S(=O)(=O)[O-]", "charge": 0, "mw": 151.91, "mp_c": 680.0, "bp_c": 680.0, "density": 2.840, "solubility": "25.6 g/100 mL", "ghs": ["H302", "H315", "H319"]},
    {"name": "Iron(III) chloride", "cid": 24380, "formula": "Cl3Fe", "smiles": "[Cl-].[Cl-].[Cl-].[Fe+3]", "charge": 0, "mw": 162.2, "mp_c": 306.0, "bp_c": 315.0, "density": 2.900, "solubility": "91.8 g/100 mL", "ghs": ["H302", "H315", "H318"]},
    {"name": "Silver nitrate", "cid": 24470, "formula": "AgNO3", "smiles": "[Ag+].[N+](=O)([O-])[O-]", "charge": 0, "mw": 169.87, "mp_c": 212.0, "bp_c": 440.0, "density": 4.350, "solubility": "222 g/100 mL", "ghs": ["H272", "H314", "H410"]},
    {"name": "Barium chloride", "cid": 25204, "formula": "BaCl2", "smiles": "[Cl-].[Cl-].[Ba+2]", "charge": 0, "mw": 208.23, "mp_c": 962.0, "bp_c": 1560.0, "density": 3.856, "solubility": "35.8 g/100 mL", "ghs": ["H301", "H332"]},
    {"name": "Sodium carbonate", "cid": 10340, "formula": "CNa2O3", "smiles": "[Na+].[Na+].[O-]C(=O)[O-]", "charge": 0, "mw": 105.99, "mp_c": 851.0, "bp_c": 1600.0, "density": 2.540, "solubility": "21.5 g/100 mL", "ghs": ["H319"]},
    {"name": "Sodium bicarbonate", "cid": 516892, "formula": "CHNaO3", "smiles": "[Na+].[O-]C(=O)O", "charge": 0, "mw": 84.007, "mp_c": 50.0, "bp_c": 851.0, "density": 2.200, "solubility": "9.6 g/100 mL", "ghs": []},
    {"name": "Potassium carbonate", "cid": 11430, "formula": "CK2O3", "smiles": "[K+].[K+].[O-]C(=O)[O-]", "charge": 0, "mw": 138.205, "mp_c": 891.0, "bp_c": 1600.0, "density": 2.430, "solubility": "112 g/100 mL", "ghs": ["H315", "H319", "H335"]},
    {"name": "Sodium sulfate", "cid": 24436, "formula": "Na2O4S", "smiles": "[Na+].[Na+].[O-]S(=O)(=O)[O-]", "charge": 0, "mw": 142.04, "mp_c": 884.0, "bp_c": 1429.0, "density": 2.664, "solubility": "28.1 g/100 mL", "ghs": []},
    {"name": "Potassium iodide", "cid": 4875, "formula": "IK", "smiles": "[K+].[I-]", "charge": 0, "mw": 166.003, "mp_c": 681.0, "bp_c": 1330.0, "density": 3.123, "solubility": "140 g/100 mL", "ghs": []},
    {"name": "Potassium permanganate", "cid": 516875, "formula": "KMnO4", "smiles": "[K+].[O-][Mn](=O)(=O)=O", "charge": 0, "mw": 158.034, "mp_c": 240.0, "bp_c": 240.0, "density": 2.703, "solubility": "6.4 g/100 mL", "ghs": ["H272", "H302", "H314", "H361d", "H373", "H410"]},
    {"name": "Potassium dichromate", "cid": 24502, "formula": "Cr2K2O7", "smiles": "[K+].[K+].[O-][Cr](=O)(=O)O[Cr](=O)(=O)[O-]", "charge": 0, "mw": 294.185, "mp_c": 398.0, "bp_c": 500.0, "density": 2.676, "solubility": "13.0 g/100 mL", "ghs": ["H272", "H301", "H312", "H314", "H330", "H334", "H340", "H350", "H360FD", "H372", "H410"]},
    {"name": "Ammonium chloride", "cid": 25517, "formula": "H4ClN", "smiles": "[NH4+].[Cl-]", "charge": 0, "mw": 53.49, "mp_c": 338.0, "bp_c": 520.0, "density": 1.527, "solubility": "37.2 g/100 mL", "ghs": ["H302", "H319"]},
    {"name": "Potassium thiocyanate", "cid": 516872, "formula": "CKNS", "smiles": "[K+].[S-]C#N", "charge": 0, "mw": 97.18, "mp_c": 173.2, "bp_c": 500.0, "density": 1.886, "solubility": "217 g/100 mL", "ghs": ["H302", "H312", "H332", "H412"]},
    {"name": "Cobalt(II) chloride", "cid": 24297, "formula": "Cl2Co", "smiles": "[Cl-].[Cl-].[Co+2]", "charge": 0, "mw": 129.84, "mp_c": 735.0, "bp_c": 1049.0, "density": 3.356, "solubility": "52.9 g/100 mL", "ghs": ["H302", "H317", "H334", "H341", "H350i", "H360F", "H410"]},
    {"name": "Nickel(II) sulfate", "cid": 24586, "formula": "NiO4S", "smiles": "[Ni+2].[O-]S(=O)(=O)[O-]", "charge": 0, "mw": 154.75, "mp_c": 848.0, "bp_c": 848.0, "density": 3.680, "solubility": "38.3 g/100 mL", "ghs": ["H302", "H315", "H317", "H334", "H341", "H350i", "H360D", "H372", "H410"]},
    {"name": "Hydrogen peroxide", "cid": 784, "formula": "H2O2", "smiles": "OO", "charge": 0, "mw": 34.014, "mp_c": -0.4, "bp_c": 150.2, "density": 1.450, "solubility": "miscible", "ghs": ["H271", "H302", "H314", "H332"]},

    # Common classroom & lab organic reagents
    {"name": "Benzoic acid", "cid": 243, "formula": "C7H6O2", "smiles": "C1=CC=C(C=C1)C(=O)O", "charge": 0, "mw": 122.12, "mp_c": 122.3, "bp_c": 249.2, "density": 1.266, "solubility": "0.34 g/100 mL", "ghs": ["H315", "H318", "H372"]},
    {"name": "Salicylic acid", "cid": 338, "formula": "C7H6O3", "smiles": "C1=CC=C(C(=C1)C(=O)O)O", "charge": 0, "mw": 138.12, "mp_c": 158.6, "bp_c": 211.0, "density": 1.443, "solubility": "0.22 g/100 mL", "ghs": ["H302", "H318", "H361d"]},
    {"name": "Phenol", "cid": 996, "formula": "C6H6O", "smiles": "C1=CC=C(C=C1)O", "charge": 0, "mw": 94.11, "mp_c": 40.5, "bp_c": 181.7, "density": 1.070, "solubility": "8.3 g/100 mL", "ghs": ["H301", "H311", "H314", "H331", "H341", "H373", "H411"]},
    {"name": "Aniline", "cid": 6115, "formula": "C6H7N", "smiles": "C1=CC=C(C=C1)N", "charge": 0, "mw": 93.13, "mp_c": -6.3, "bp_c": 184.1, "density": 1.022, "solubility": "3.6 g/100 mL", "ghs": ["H301", "H311", "H317", "H318", "H331", "H341", "H351", "H372", "H400"]},
    {"name": "Benzaldehyde", "cid": 240, "formula": "C7H6O", "smiles": "C1=CC=C(C=C1)C=O", "charge": 0, "mw": 106.12, "mp_c": -26.0, "bp_c": 178.1, "density": 1.044, "solubility": "0.3 g/100 mL", "ghs": ["H302", "H315", "H319", "H335"]},
    {"name": "Citric acid", "cid": 311, "formula": "C6H8O7", "smiles": "C(C(=O)O)C(CC(=O)O)(C(=O)O)O", "charge": 0, "mw": 192.12, "mp_c": 153.0, "bp_c": 175.0, "density": 1.665, "solubility": "59.2 g/100 mL", "ghs": ["H319"]},
    {"name": "Oxalic acid", "cid": 971, "formula": "C2H2O4", "smiles": "C(=O)(C(=O)O)O", "charge": 0, "mw": 90.03, "mp_c": 189.5, "bp_c": 189.5, "density": 1.900, "solubility": "14.3 g/100 mL", "ghs": ["H302", "H312", "H318"]},
    {"name": "Glucose", "cid": 5793, "formula": "C6H12O6", "smiles": "C(C1C(C(C(C(O1)O)O)O)O)O", "charge": 0, "mw": 180.16, "mp_c": 146.0, "bp_c": 527.1, "density": 1.540, "solubility": "91.0 g/100 mL", "ghs": []},
    {"name": "Sucrose", "cid": 5988, "formula": "C12H22O11", "smiles": "C(C1C(C(C(C(O1)OC2(C(C(C(O2)CO)O)O)CO)O)O)O)O", "charge": 0, "mw": 342.30, "mp_c": 186.0, "bp_c": 697.1, "density": 1.587, "solubility": "200 g/100 mL", "ghs": []},
    {"name": "Urea", "cid": 1176, "formula": "CH4N2O", "smiles": "C(=O)(N)N", "charge": 0, "mw": 60.06, "mp_c": 133.0, "bp_c": 196.6, "density": 1.320, "solubility": "108 g/100 mL", "ghs": []},
    {"name": "Calcium carbonate", "cid": 10112, "formula": "CCaO3", "smiles": "[Ca+2].[O-]C(=O)[O-]", "charge": 0, "mw": 100.086, "mp_c": 825.0, "bp_c": 1339.0, "density": 2.711, "solubility": "0.0013 g/100 mL", "ghs": []},
    {"name": "Barium sulfate", "cid": 24414, "formula": "BaO4S", "smiles": "[Ba+2].[O-]S(=O)(=O)[O-]", "charge": 0, "mw": 233.39, "mp_c": 1580.0, "bp_c": 1600.0, "density": 4.49, "solubility": "0.00024 g/100 mL", "ghs": []},
    {"name": "Magnesium sulfate", "cid": 24083, "formula": "MgO4S", "smiles": "[Mg+2].[O-]S(=O)(=O)[O-]", "charge": 0, "mw": 120.366, "mp_c": 1124.0, "bp_c": 1200.0, "density": 2.66, "solubility": "35.1 g/100 mL", "ghs": []},
    {"name": "Potassium nitrate", "cid": 24434, "formula": "KNO3", "smiles": "[K+].[N+](=O)([O-])[O-]", "charge": 0, "mw": 101.103, "mp_c": 334.0, "bp_c": 400.0, "density": 2.109, "solubility": "38.3 g/100 mL", "ghs": ["H272"]},
    {"name": "Sodium thiosulfate", "cid": 24477, "formula": "Na2O3S2", "smiles": "[Na+].[Na+].[O-]S(=O)(=O)[S-]", "charge": 0, "mw": 158.11, "mp_c": 48.3, "bp_c": 100.0, "density": 1.667, "solubility": "70.1 g/100 mL", "ghs": []},
    {"name": "Phenolphthalein", "cid": 4764, "formula": "C20H14O4", "smiles": "C1=CC=C2C(=C1)C(=O)OC2(C3=CC=C(C=C3)O)C4=CC=C(C=C4)O", "charge": 0, "mw": 318.32, "mp_c": 260.0, "bp_c": 557.8, "density": 1.277, "solubility": "insoluble", "ghs": ["H341", "H350", "H361f"]},
]

def generate_inchikey(smiles: str) -> str:
    """Standard InChIKey of `smiles` via RDKit. An unparseable SMILES is an error: no key is ever fabricated."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"RDKit cannot parse SMILES {smiles!r}")
    return Chem.MolToInchiKey(mol)

def build_curated_database() -> Dict[str, Dict[str, Any]]:
    """Builds the curated database keyed by InChIKey."""
    db: Dict[str, Dict[str, Any]] = {}

    # 1. Process primary chemicals
    for chem in PRIMARY_CHEMICALS:
        ikey = generate_inchikey(chem["smiles"])
        db[ikey] = {
            "inchi_key": ikey,
            "cid": chem["cid"],
            "name": chem["name"],
            "formula": chem["formula"],
            "smiles": chem["smiles"],
            "charge": chem["charge"],
            "mw": chem["mw"],
            "mp_c": chem["mp_c"],
            "bp_c": chem["bp_c"],
            "density": chem["density"],
            "solubility": chem["solubility"],
            "ghs": chem["ghs"],
            "tier": "tabulated",
            "source": "PubChem_Evaluated"
        }

    # Real, hand-checked light alkanes (CRC Handbook values). Everything else that used to be generated here
    # (inorganic salt matrix, homologous series of alkanes / alcohols / acids / esters / halides, amino acids with
    # bp = mp + 150) was synthetic: formulas such as "Salt_Sodium_bromide", mp/bp from molar-mass arithmetic, fake CIDs,
    # labelled tabulated. It overrode PubChem on import and was removed in Stage 0. A real species store arrives in Stage 1.
    for name, cid, formula, smi, mw, mp, bp, d in [
        ("Methane", 297, "CH4", "C", 16.043, -182.5, -161.5, 0.422),
        ("Ethane", 6324, "C2H6", "CC", 30.07, -182.8, -88.6, 0.548),
        ("Propane", 6334, "C3H8", "CCC", 44.097, -187.7, -42.1, 0.582),
        ("Butane", 7843, "C4H10", "CCCC", 58.124, -138.4, -0.5, 0.601),
        ("Pentane", 8003, "C5H12", "CCCCC", 72.151, -129.8, 36.1, 0.626),
    ]:
        ikey = generate_inchikey(smi)
        db[ikey] = {
            "inchi_key": ikey, "cid": cid, "name": name, "formula": formula, "smiles": smi, "charge": 0, "mw": mw,
            "mp_c": mp, "bp_c": bp, "density": d, "solubility": "immiscible", "ghs": ["H220"] if name != "Pentane" else ["H225"],
            "tier": "tabulated", "source": "CRC Handbook",
        }

    return db
