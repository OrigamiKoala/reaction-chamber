"""
Salt and Hydrate Splitting Module
Parses compound SMILES/formula into dissolution fragments (cations, anions, water).
e.g.
  [Na+].[Cl-] -> Na+ (1.0), Cl- (1.0)
  O.O.O.O.O.[Cu+2].[O-]S(=O)(=O)[O-] -> Cu+2 (1.0), SO4-2 (1.0), H2O (5.0)
"""
from typing import Dict, Any, List
from rdkit import Chem

def split_salts_and_hydrates(smiles: str) -> Dict[str, Any]:
    """Splits SMILES dot-separated fragments into solvent (H2O), cations, anions, or neutral molecules."""
    fragments = smiles.split(".")
    water_count = 0
    dissolution_components = []
    
    for frag in fragments:
        if frag == "O":
            water_count += 1
            continue
        try:
            mol = Chem.MolFromSmiles(frag)
            if not mol:
                continue
            charge = sum(atom.GetFormalCharge() for atom in mol.GetAtoms())
            formula = Chem.rdMolDescriptors.CalcMolFormula(mol)
            dissolution_components.append({
                "fragment_smiles": frag,
                "formula": formula,
                "charge": charge,
                "stoichiometry": 1.0
            })
        except Exception:
            dissolution_components.append({
                "fragment_smiles": frag,
                "formula": frag,
                "charge": 0,
                "stoichiometry": 1.0
            })
            
    # Aggregate duplicate fragments
    aggregated: Dict[str, Dict[str, Any]] = {}
    for comp in dissolution_components:
        f = comp["formula"]
        if f not in aggregated:
            aggregated[f] = comp
        else:
            aggregated[f]["stoichiometry"] += 1.0
            
    if water_count > 0:
        aggregated["H2O"] = {
            "fragment_smiles": "O",
            "formula": "H2O",
            "charge": 0,
            "stoichiometry": float(water_count)
        }
        
    return {
        "original_smiles": smiles,
        "is_hydrate": water_count > 0,
        "water_hydrate_number": water_count,
        "components": list(aggregated.values())
    }
