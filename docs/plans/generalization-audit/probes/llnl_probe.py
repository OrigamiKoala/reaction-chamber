# Probe: count llnl.dat / minteq.v4 / NASA thermo.inp coverage and compare the engine's hand-typed Ksp table with llnl.dat.
import re, json
KEYW={'LLNL_AQUEOUS_MODEL_PARAMETERS','NAMED_EXPRESSIONS','SOLUTION_MASTER_SPECIES','SOLUTION_SPECIES','PHASES','EXCHANGE_MASTER_SPECIES','EXCHANGE_SPECIES','SURFACE_MASTER_SPECIES','SURFACE_SPECIES','RATES','END','LLNL_AQUEOUS_MODEL_PARAMETERS'}
def blocks(path):
    txt=open(path,encoding='latin-1').read().splitlines()
    sec=None; out={'SOLUTION_SPECIES':[], 'PHASES':[]}; cur=None
    for ln in txt:
        s=ln.split('#')[0].rstrip()
        if not s.strip(): continue
        if s.strip() in KEYW and not s.startswith((' ','\t')):
            sec=s.strip(); cur=None; continue
        if sec=='PHASES':
            if not s.startswith((' ','\t')): cur={'name':s.strip()}; out['PHASES'].append(cur)
            elif cur is not None:
                t=s.strip()
                if 'rxn' not in cur and '=' in t: cur['rxn']=t
                m=re.match(r'-?log_?k\s+([-+\d.eE]+)',t)
                if m: cur['logk']=float(m.group(1))
                m=re.match(r'-?delta_?h\s+([-+\d.eE]+)\s*(\w+)?',t)
                if m: cur['dh']=(float(m.group(1)), m.group(2))
                if t.startswith(('-analytic','-a_e','-analytical')): cur['analytic']=True
        elif sec=='SOLUTION_SPECIES':
            if '=' in s and 'log' not in s: out['SOLUTION_SPECIES'].append(s.strip())
    return out
L=blocks('llnl.dat'); M=blocks('minteq.v4.dat')
print('llnl.dat: SOLUTION_SPECIES reactions', len(L['SOLUTION_SPECIES']), '| PHASES', len(L['PHASES']), '| with log_k', sum('logk' in p for p in L['PHASES']), '| with analytic', sum('analytic' in p for p in L['PHASES']), '| with delta_h', sum('dh' in p for p in L['PHASES']))
print('minteq.v4.dat: SOLUTION_SPECIES', len(M['SOLUTION_SPECIES']), '| PHASES', len(M['PHASES']))
# NASA CEA thermo.inp species count (species header lines start in col 1 with a name, followed by a line with nintervals)
lines=open('thermo.inp',encoding='latin-1').read().splitlines()
names=[]; i=0
while i<len(lines):
    ln=lines[i]
    if ln.startswith('thermo') : i+=2; continue
    if ln and not ln.startswith(('!',' ')) and i+1<len(lines) and re.match(r'^\s*\d+\s',lines[i+1][:3]+' '):
        names.append(ln[:24].strip())
    i+=1
cond=[n for n in names if re.search(r'\((cr|L|a|b|c|I|II|III)', n)]
print('NASA thermo.inp: species blocks ~', len(names), '| condensed-phase blocks ~', len(cond), '| e.g.', names[:5], cond[:4])
# Compare the engine's table to llnl.dat (match by phase name)
eng=json.load(open('/Users/carlliu/reaction-chamber/engine/data/solubility.json'))['minerals']
llnl={p['name'].split()[0]: p for p in L['PHASES']}
alias={'AgCl':'Cerargyrite','AgBr':'Bromyrite','AgI':'Iodyrite','BaSO4':'Barite','CaCO3':'Calcite','CaF2':'Fluorite','PbI2':'PbI2','Fe(OH)3':'Fe(OH)3','Mg(OH)2':'Brucite','Ca(OH)2':'Portlandite','CaSO4':'Anhydrite','PbCl2':'Cotunnite','Al(OH)3':'Gibbsite','CuS':'Covellite','HgS':'Cinnabar','PbSO4':'Anglesite','SrSO4':'Celestite','BaCO3':'Witherite','ZnS':'Sphalerite','PbS':'Galena','Ag2CrO4':'Ag2CrO4','ZnF2':'ZnF2','MgCO3':'Magnesite','SrCO3':'Strontianite','PbCO3':'Cerussite','Cu(OH)2':'Cu(OH)2','Zn(OH)2':'Zn(OH)2(beta)','Ni(OH)2':'Ni(OH)2','Co(OH)2':'Co(OH)2','Fe(OH)2':'Fe(OH)2','Ag2SO4':'Ag2SO4','Hg2Cl2':'Calomel','CuI':'CuI','CuCl':'Nantokite','BaF2':'BaF2','SrF2':'SrF2','MgF2':'Sellaite','PbF2':'PbF2','Ag2CO3':'Ag2CO3','FeS':'Pyrrhotite','CdS':'Greenockite','Ag2S':'Acanthite','MnS':'Alabandite','AgSCN':'AgSCN'}
print(f"\n{'formula':10} {'engine':>8} {'llnl':>8} {'diff':>6}  llnl phase / reaction")
rows=0; big=0
for m in eng:
    f=m['formula']; nm=alias.get(f)
    p=llnl.get(nm) if nm else None
    if p and 'logk' in p:
        # llnl writes dissolution with H+ for hydroxides/carbonates/sulfides; only compare when reaction has no H+ on the left
        rx=p.get('rxn','')
        lhs=rx.split('=')[0]
        note='' if 'H+' not in lhs else '(H+-based, not a Ksp)'
        d=m['log_ksp_298']-p['logk']
        rows+=1; big+= (abs(d)>0.3 and not note)
        print(f"{f:10} {m['log_ksp_298']:8.2f} {p['logk']:8.2f} {d:+6.2f}  {nm}: {rx[:60]} {note}")
print('compared', rows, '| |diff|>0.3 (true Ksp rows)', big)
