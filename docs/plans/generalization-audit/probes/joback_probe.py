# Probe: Joback SMARTS decomposition on a scratch copy (Tuple import patched). Compares Tb with literature normal bp.
from rdkit import Chem
from pipeline.joback_estimator import decompose_smiles_to_groups, estimate_for_smiles
tests = {  # name: (smiles, literature Tb K)
 'ethanol':('CCO',351.4),'acetic acid':('CC(=O)O',391.1),'acetone':('CC(C)=O',329.2),'dimethyl ether':('COC',248.3),
 'benzene':('c1ccccc1',353.2),'toluene':('Cc1ccccc1',383.8),'benzoic acid':('OC(=O)c1ccccc1',522.4),'naphthalene':('c1ccc2ccccc2c1',491.1),
 'cyclohexane':('C1CCCCC1',353.9),'methylcyclohexane':('CC1CCCCC1',374.0),'cyclohexanol':('OC1CCCCC1',434.0),
 'pyridine':('c1ccncc1',388.4),'DMSO':('CS(C)=O',462.0),'formaldehyde':('C=O',254.0),'methyl formate':('COC=O',304.9),
 'nitrobenzene':('[O-][N+](=O)c1ccccc1',483.9),'acetonitrile':('CC#N',354.8),'triethylamine':('CCN(CC)CC',362.0),
 'glucose':('OCC1OC(O)C(O)C(O)C1O',None),'phenol':('Oc1ccccc1',455.0),'chloroform':('ClC(Cl)Cl',334.3),'urea':('NC(N)=O',None),
}
print(f"{'name':18} {'Tb_lit':>7} {'Tb_job':>7} {'err':>6} unassigned_heavy groups")
for n,(s,tb) in tests.items():
    m=Chem.MolFromSmiles(s); g=decompose_smiles_to_groups(s); r=estimate_for_smiles(s)
    nheavy=m.GetNumHeavyAtoms()
    # atoms that are 'centres' counted; count heavy atoms not covered by any group: approximate = nheavy - sum(group sizes)
    size={'-COOH (acid)':3,'-COO- (ester)':3,'-CHO (aldehyde)':2,'>C=O (ring)':2,'>C=O (non-ring)':2,'-NO2':3,'-CN':2}
    cov=sum(c*size.get(k,1) for k,c in g.items())
    tbj=r['tb_k'] if r else None
    err=f"{tbj-tb:+.0f}" if (tbj and tb) else ''
    print(f"{n:18} {tb or '':>7} {tbj or '':>7} {err:>6} {nheavy-cov:>3}  {g}")
