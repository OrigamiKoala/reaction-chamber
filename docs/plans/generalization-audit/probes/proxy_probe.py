# Probe: server/data_proxy.py (scratch copy; its SQLite cache lands in probes/server/cache, not the repo).
import json, sys
sys.path.insert(0, '.')
from server.data_proxy import UnifiedPropertyResolver as R, NistWebBookClient as N, WikidataClient as W, CORE_TABULATED_THERMO
print('CORE_TABULATED_THERMO entries:', len(CORE_TABULATED_THERMO))
def show(tag, d, keys=('name','formula','tier','t_boil_k','t_fus_k','dhf_gas_kj_mol','dhf_liquid_kj_mol','s_liquid_j_mol_k','dh_vap_kj_mol')):
    print(tag, {k: d.get(k) for k in keys if k in d}, '| antoine:', len(d.get('antoine') or []), '| cp_tab:', (d.get('cp_tabulated') or [])[:6], '| prov sample:', list((d.get('provenance') or {}).values())[:2])
# 1. isomer collisions via the formula match in the tabulated core (what web/src/pubchem/api.ts sends: formula+name+smiles+inchikey)
show('dimethyl ether ->', R.resolve_compound(name='Methoxymethane', formula='C2H6O', smiles='COC', inchikey='LCGLNKUTAGEVQW-UHFFFAOYSA-N'))
show('methyl formate ->', R.resolve_compound(name='Methyl formate', formula='C2H4O2', smiles='COC=O', inchikey='TZIHFWKZFHZASV-UHFFFAOYSA-N'))
show('propanal ->', R.resolve_compound(name='Propanal', formula='C3H6O', smiles='CCC=O', inchikey='NBBJYMSMWIIQGU-UHFFFAOYSA-N'))
# 2. NIST live: by CAS (ethanol), by InChIKey (ethyl acetate), by formula (multi-hit list page)
for ident, by in [('64-17-5','cas'), ('XEKOWRVHYACXOJ-UHFFFAOYSA-N','inchikey'), ('C4H8O2','formula'), ('sodium chloride','name')]:
    d = N.lookup(ident, by=by)
    show(f'NIST {by}:{ident} ->', d or {}, keys=('name','cas','t_boil_k','t_fus_k','t_crit_k','dhf_gas_kj_mol','dhf_liquid_kj_mol','dhf_solid_kj_mol','s_gas_j_mol_k','s_liquid_j_mol_k','s_solid_j_mol_k','dh_vap_kj_mol','dh_fus_kj_mol'))
    if d and d.get('shomate'): print('   shomate blocks', len(d['shomate']), d['shomate'][0])
    if d and d.get('antoine'): print('   antoine', d['antoine'][:2])
# 3. Wikidata live by InChIKey (ethanol)
w = W.lookup_by_inchikey('LFQSCWFLJHTTHZ-UHFFFAOYSA-N'); print('Wikidata ethanol ->', w)
