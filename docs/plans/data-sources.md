# External data sources for a general-purpose compound model

Status: research only. Every endpoint below was hit directly on 2026-10-01 (local time; server clocks read
2026-10-02 UTC). Nothing here has been integrated.
Scope: where the engine can get per-compound data that PubChem lacks. Sources are ranked by how well they supply
**intrinsic** values. The document also covers a provider design and a staged plan.
Related: `docs/plans/generality-audit.md` (invariant ledger, F-numbers), `COMPOUND_PHASE_PLAN.md`.

## 0. Design invariant this survey follows

The simulation should rely on **intrinsic** per-compound values and derive everything that depends on conditions.

| Intrinsic (store per compound / species) | Derived at run time (never stored as state-defining) |
|---|---|
| ΔfH°, S°, ΔfG° (298.15 K, 1 bar); Cp(T) polynomial (NASA-7, NASA-9, Shomate or HKF); molar mass; structure (SMILES/InChI); reference-state pKa (I = 0, 25 °C) plus ΔrH° of ionisation; standard potentials, or ΔfG° of both redox partners; solid molar volume at a reference T | phase at (T, P); mp and bp; vapour pressure at T; Ksp(T) and solubility; pH; density at T; E at given activities |
| **Curve parameters** that may be stored: Antoine A/B/C with validity range, Clausius–Clapeyron (ΔvapH, Tref, Pref), viscosity A/B/C, HKF a1–a4/c1–c2/ω | Single-condition readings such as "mp 80 °C", "11 mmHg at 20 °C" or "0.076 g/100 mL at 20 °C" are *evidence*. They are used to fit or check the curves above and are never the model itself |

Three consequences follow. Ksp should eventually come from ΔrG° = Σ ΔfG°(ions) − ΔfG°(solid) (section 5). Vapour pressure
should come from ΔfH°/S° of the two phases or from a fitted curve. E° should come from ΔfG° of the couple.

## 1. Comparison table

**CORS** means the browser can call the source directly; it was tested with `Origin: http://localhost:5173`.
**Verified** means the endpoint actually returned the data quoted in section 2.

| Source | Intrinsic fields | Condition-dependent fields | Access | CORS | Licence / redistribution | Coverage (measured where possible) | Verified |
|---|---|---|---|---|---|---|---|
| **PubChem** PUG REST/View (in use) | formula, SMILES, InChIKey, MW; pKa text ("Dissociation Constants") | mp, bp, density, vapour-pressure points, ΔvapH, ΔcH, viscosity, solubility text, UV λmax text, colour/form text | REST JSON by CID/name/InChIKey/formula | Yes (`*`), with a throttling header | US gov public domain; some depositor content has its own terms (HSDB content is public) | ~120 M compounds; experimental annotations on far fewer | Y |
| **NIST Chemistry WebBook** (SRD 69) | ΔfH° (gas/liquid/solid), S°, Shomate Cp(T), ΔcH°, ΔfusH, ΔsubH, ΔvapH° | Tboil, Tfus, Tc/Pc, **Antoine A/B/C with T range** (curve parameters, acceptable), UV/IR JCAMP spectra | HTML only, no JSON. `cbook.cgi?ID=C<CAS>`, `?InChI=<key>`, `?Name=`, `?Formula=`; `Mask=1` gas thermo, `2` condensed, `4` phase change; `Units=SI`; `JCAMP=C<CAS>&Type=UVVis&Index=0` | **No** | **Copyrighted under the Standard Reference Data Act: no reproduction without NIST permission.** robots.txt has `Crawl-delay: 5` | ~70k compounds; thermo for a few thousand; inorganic salts are patchy (the ZnF2 page exists but has no data) | Y |
| **NASA Glenn / CEA `thermo.inp`** (github nasa/cea) | ΔfH° and NASA-9 Cp/H/S polynomials (give S° and ΔfG° at any T) for gas and condensed phases | phase-transition T implied by interval bounds | plain text, 1.23 MB | Yes (raw.githubusercontent) | repo Apache-2.0; the NASA data is a US gov work | 2111 species, 815 condensed (e.g. `PbI2(cr)`, `C2H5OH(L)`); few organic solids (no naphthalene(cr) or benzoic acid(cr)) | Y |
| **Burcat** third-millennium database | NASA-7 polynomials, ΔfH° | – | The site links to a Google Drive folder. Also bundled in Reaktoro (`embedded/databases/nasa/burcat.dat`, 1.96 MB) | n/a | **"The sale of this information is strictly forbidden and it cannot be listed, printed or copied in any commercial publication form without receiving written agreement from the author"**, so non-commercial use only. Ask before bundling | ~3000+ species, mostly gas-phase combustion | Site Y; data file not downloaded |
| **ATcT** v1.130 (Argonne) | ΔfH°(0 K) and ΔfH°(298 K) with ± uncertainty; best in class | – | One HTML table page (3.7 MB). The homepage sits behind a Cloudflare JS challenge | No | Licence not stated on the reachable pages; published as OSTI dataset DOI 10.17038/CSE/1997229 (cite Ruscic & Bross). Treat as "cite, ask before bundling" | 3044 rows: 2350 g, 435 aq, 152 cr, 47 l. Light elements only (no Pb, no Zn) | Y (table page) |
| **NIST-JANAF** (SRD 13) | Cp, S, H−H(Tr), ΔfH, ΔfG, log Kf vs T | – | tab-separated text per species: `janaf.nist.gov/tables/<id>.txt` | not tested | SRD copyright (same as WebBook) | ~1800 species, mostly small/inorganic | Y |
| **PHREEQC databases** (USGS; github usgs-coupled/phreeqc3 `database/`) | log K(25 °C) and ΔrH° for aqueous-species formation and mineral dissolution; `-analytic` log K(T) fits; llnl comments carry ΔfH° | – | plain-text `.dat` | Yes (raw GitHub) | USGS public domain. The data are compiled from literature (llnl.dat comes from LLNL thermo.com.V8.R6) | llnl: 1215 phases / 1327 aq reactions; minteq.v4: 568 / 1335; sit: 924 / 1371; wateq4f: 319 / 361; phreeqc.dat: 77 / 235; pitzer: 71 phases + Pitzer params | Y |
| **SUPCRT92/07/16, SUPCRTBL** (YAML/JSON copies in Reaktoro `embedded/databases/reaktoro/`) | **ΔfG°, ΔfH°, S°** plus HKF parameters (valid to 1000 °C / 5 kbar) for aqueous ions, complexes and neutral organics; Holland–Powell / Maier–Kelley for minerals | – | YAML/JSON | Yes (raw GitHub) | Reaktoro repo is LGPL-2.1. The underlying slop data (Helgeson group; SUPCRTBL by Zimmer et al. 2016) is distributed freely with attribution. Confirm before bundling | supcrtbl: 1108 species (833 aq, 251 solid, 24 gas); supcrt16-organics: 2029 (1758 aq, incl. ethanol(aq), acetic acid(aq), benzoic acid(aq)) | Y |
| **Thermoddem** v1.10 (BRGM) | log K, ΔrH°, per-row references (ΔfG/ΔfH/S/Cp/V) | – | PHREEQC `.dat` (copy in Reaktoro) | n/a | Homepage returned "Request Rejected" (WAF). Licence **not verified** | minerals, cements, clays; no PbI2 or ZnF2 | Partial (file only) |
| **Wikidata** SPARQL | ΔfH° (P3078), S° (P3071), pKa (P1117), Cp (P2056), ΔcH (P2117), ΔvapH (P2116) | mp (P2101), bp (P2102), density (P2054), vapour pressure (P2119), solubility (P2177), refractive index, flash point | SPARQL by InChIKey (P235), CAS (P231) or PubChem CID (P662) | **Yes** (`*`) | **CC0**: bundle freely | items with a value: mp 31,797; density 2,920; bp 2,022; vapour pressure 639; solubility 461; ΔfH° 430; pKa 281; S° 174; Cp 65; ΔvapH 24; ΔcH 17 | Y |
| **IUPAC digitized pKa** (github IUPAC/Dissociation-Constants) | pKa with T, ionic strength, method, assessment | – | one CSV (6.9 MB, 24,631 rows) with SMILES + InChI | Yes (raw GitHub) | **CC BY-NC 4.0**: not compatible with permissive or commercial redistribution | ~24.6k measurements, mostly organics | Y |
| **IUPAC-NIST Solubility Data Series** (SRD 106) | – (evaluated solubility tables; useful as evidence) | solubility vs T | ASP.NET. `GET /solubility/sol_casno.aspx?STR=<CAS>&OPTION=CASNO&COMP=1` lists systems; `sol_detail.aspx?sysID=` gives details (HTML) | No | SRD copyright | data last updated 2012. Naphthalene 30 systems, benzoic acid 1, PbI2 0, ZnF2 0 | Y |
| **ThermoML Archive** (NIST TRC, data.nist.gov mds2-2422) | ΔfH, Cp, raw phase-equilibrium data | experimental points for density(T), viscosity(T), vapour pressure(T) from 5 journals | 189 MB tgz of XML/JSON | n/a | **NIST open licence** (public) | tens of thousands of data sets | Metadata Y; tarball download timed out |
| **CoolProp** | Helmholtz EOS (reference-quality ρ, P_sat, Cp, μ, k vs T,P) | – | C++ lib, pip `coolprop 8.0.0`, JSON fluid files, Emscripten JS build | Yes (raw GitHub) | MIT | 139 fluid files incl. Water, Ethanol, Methanol, Acetone, Benzene, Toluene (AceticAcid disabled) | Y (repo and file) |
| **Cantera data** | NASA polynomials (`nasa_gas.yaml`, `nasa_condensed.yaml`), critical properties | – | YAML | Yes (raw GitHub) | BSD-3 (code). nasa_* come from NASA TM-4513. critical-properties.yaml is partly from NIST WebBook (do not bundle that file) | NASA set as above | Y (listing) |
| **RMG-database** | thermo libraries (NASA polynomials, many from G4/CBS-QB3), Benson group values, kinetics families/libraries; **solvent library: ε, viscosity A/B/C, Abraham parameters**; 450 Abraham solute entries | – | Python-syntax data files | Yes (raw GitHub) | **No LICENSE file in RMG-database** (RMG-Py is MIT). Some libraries repackage third-party data (`BurcatNS.py`, `NISTThermoLibrary.py`). Ask the maintainers before bundling | 77 thermo libraries; 203 solvents | Y |
| **Materials Project** | DFT formation energy (ΔfH-like, with fitted corrections), structure, density; aqueous-ion reference data for Pourbaix diagrams | – | REST, **API key required** (401 without); bulk copy on AWS Open Data | not tested | **CC BY 4.0** | ~150k inorganic materials | 401 confirmed; no data fetched |
| **OQMD** | DFT ΔfH (`delta_e`), stability | – | REST `oqmdapi/formationenergy` | – | CC BY 4.0 (not re-verified) | ~1M entries | **N: HTTP 502 on two attempts** |
| **AFLOW** AFLUX | DFT `enthalpy_formation_atom` (eV/atom), space group | – | REST, no key | **No** | terms not verified | ~3.5M entries | Y |
| **ChEBI** (new backend API) | identity, ontology roles | – | REST JSON `/chebi/backend/api/public/compound/<id>/` | Yes | CC BY 4.0 | ~60k entities | Y |
| **ChEMBL** | identity; calculated alogp/psa only (CHEMBL541 has no pKa fields today) | – | REST JSON | Yes | CC BY-SA 3.0 | 2.4M molecules | Y (low value) |
| **CAS Common Chemistry** | CAS RN, names, some mp/bp/density | – | REST, key required (401) | – | CC BY-NC 4.0 (per CAS; not re-checked) | ~500k | 401 only |
| **EPA CompTox / CTX API** | OPERA/TEST predictions, experimental phys-chem | – | REST, key required | – | US gov | ~1.2M | **N: `api-ccte.epa.gov` did not resolve (DNS); dashboard timed out** |
| **OPERA** (github kmansouri/OPERA) | QSAR predictions: mp, bp, vapour pressure, water solubility, pKa, logP | – | local executable/models | n/a | MIT | any structure, with an applicability-domain flag | repo Y |
| **chemicals / thermo** (Caleb Bell, Python) | correlations and many tables | – | pip | n/a | **The code is MIT, but the package bundles CRC, Yaws, DIPPR, Perry, Poling and Landolt tables** (`chemicals/Heat Capacity/CRC ...tsv`, `Critical Properties/Yaws Collection.tsv`, ...) | thousands | Y (file listing) |
| **NIST Chemical Kinetics DB** (SRD 17 v7.1) | Arrhenius A, n, Ea | – | HTML form POST only (`Search.jsp`); a simple GET query attempt returned "No search parameters" | No | SRD copyright | gas-phase and radical chemistry | Site Y, query N |
| **NIST/NDRL solution kinetics** | radical rate constants in solution | – | HTML | No | SRD | narrow | Site Y |
| **Open Reaction Database** | reaction outcomes and conditions (no rate constants) | – | GitHub protobuf shards (48 dirs) | Yes (GitHub) | CC BY-SA 4.0 | ~2M reactions, mostly USPTO-derived | Repo Y |
| **Mayr reactivity DB** (already used for N, sN, E) | N, sN, E parameters | – | HTML | – | not checked | ~1300 nucleophiles/electrophiles | Site Y |
| **mendeleev** | element data (radii, electronegativity, ionisation energies) | – | pip / SQLite | – | MIT | all elements | repo Y |
| **CCCBDB** (SRD 101) | computed and experimental gas-phase thermo, vibrational data | – | HTML | – | SRD | ~2000 | Site Y |
| CRC Handbook, Lange's, Yaws, DIPPR 801, Reaxys, Pauling File/MPDS, DDB | various | various | commercial | – | **Commercial or copyrighted: never bundle** | – | not tested (no access) |

## 2. Verified example requests (excerpts)

```
# PubChem: pKa, viscosity and solubility text exist for many compounds (access-control-allow-origin: *)
GET https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/176/JSON?heading=Dissociation+Constants
  -> ['4.756', '4.55', '4.76 (at 25 °C)']                       (acetic acid)
GET .../compound/176/JSON?heading=Heat+of+Combustion  -> ['874.2 kJ/mol']
GET .../compound/702/JSON?heading=Viscosity           -> ['1.074 mPa.s at 25 °C', ...]   (ethanol)
GET .../compound/702/JSON?heading=Dielectric+Constant -> Fault "No data found"
GET .../compound/931/JSON?heading=UV+Spectra          -> 'MAX ABSORPTION (ALCOHOL): 221 NM (LOG E= 5.04); 275.5 NM ...' (naphthalene)
GET .../compound/24931/JSON?heading=Solubility        -> 'Water (g/100 cu cm) 0.076 at 20 °C'      (PbI2)
GET .../compound/24551/JSON?heading=Solubility        -> '1.516 G SOL IN 100 ML WATER ... /TETRAHYDRATE/' (ZnF2)
GET .../compound/176/JSON?heading=Enthalpy+of+Formation -> "No data found"

# NIST WebBook (HTML; no Access-Control-Allow-Origin header)
GET https://webbook.nist.gov/cgi/cbook.cgi?ID=C64175&Units=SI&Mask=4     (ethanol, phase change)
  T boil 351.5 ± 0.2 K ; T fus 159. ± 2. K ; T c 514. ± 7. K ; Δvap H° 42.3 ± 0.4 kJ/mol
  Antoine (log10(P/bar) = A − B/(T + C), T in K):  273.–351.70 K  A 5.37229  B 1670.409  C -40.191
GET ...?ID=C64175&Units=SI&Mask=2  -> Δf H° liquid -276. ± 2. kJ/mol (avg of 6); S° liquid 159.86–161.21 J/mol·K
GET ...?ID=C10101630&Units=SI&Mask=7 (PbI2) -> Δf H° solid -175.39 kJ/mol; S° solid 174.84 J/mol·K (Chase 1998); Shomate
GET ...?ID=C7783495&Units=SI&Mask=7  (ZnF2) -> page exists, no thermochemistry
GET ...?ID=C65850 (benzoic acid)   -> Δf H° solid -384.8 ± 0.50 kJ/mol; S° solid,1 bar 165.71–170.7; T boil 522.2 K
GET ...?ID=C91203&Mask=1 (naphthalene) -> Δf H° gas 150. ± 10. kJ/mol (average of 7)
GET ...?InChI=UFWIBTONFRDIAS-UHFFFAOYSA-N -> Naphthalene, CAS 91-20-3   (InChIKey lookup works)
GET ...?JCAMP=C91203&Index=0&Type=UVVis -> JCAMP-DX UV/VIS, "Collection (C) 2007 copyright by the U.S. Secretary of Commerce"

# NASA CEA thermo.inp (https://raw.githubusercontent.com/nasa/cea/main/data/thermo.inp)
C2H5OH  ... 46.0684400  -234950.000      (ΔfH° gas, J/mol)
C2H5OH(L) ... -277510.000                 (liquid, 159–390 K interval)
PbI2(cr)  -> evaluated at 298.15 K: ΔfH° -176.0 kJ/mol, S° 174.85 J/mol·K, ΔfG° -174.18 kJ/mol

# ATcT 1.130  https://atct.anl.gov/Thermochemical%20Data/version%201.130/index.php
Ethanol CH3CH2OH (cr,l)  ΔfH°(298) -277.50 ± 0.20 kJ/mol ; (g) -235.03 ± 0.20
Benzoic acid (cr,l) -384.73 ± 0.17 ; Naphthalene (cr,l) 74.99 ± 0.57 ; (g) 147.56 ± 0.56
Acetic acid (aq) -485.10 ± 0.27 ; Iodide I- (aq) -56.830 ± 0.090

# NIST-JANAF  https://janaf.nist.gov/tables/I-027.txt
I2(g) 298.15 K: Cp 36.887  S 260.685  ΔfH 62.421  ΔfG 19.325  log Kf -3.386

# PHREEQC (https://raw.githubusercontent.com/usgs-coupled/phreeqc3/master/database/llnl.dat)
PbI2   PbI2 = Pb+2 + 2 I-   log_k -8.0418   -delta_H 62.5717 kJ/mol
ZnF2   ZnF2 = Zn+2 + 2 F-   log_k -0.4418   -delta_H -59.8746 kJ/mol   # Enthalpy of formation: -764.206 kJ/mol
minteq.v4.dat:  Benzoate- + H+ = H(Benzoate)  log_k 4.202  delta_h -0.4602 kJ

# SUPCRTBL / SUPCRT16-organics (https://raw.githubusercontent.com/reaktoro/reaktoro/main/embedded/databases/reaktoro/supcrtbl.yaml)
Pb+2: HKF Gf -23891 J/mol, Hf 920, Sr 17.573 ; I-: Gf -51923, Hf -56902, Sr 106.692
Zn+2: Gf -147277 ; F-: Gf -281751, Hf -335348, Sr -13.18
supcrt16-organics: Ethanol(aq) Gf -180916, Hf -287734, Sr 146.61 ; Acetic-Acid(aq) Gf -396476 ; Benzoic-Acid(aq) Gf -234848

# Wikidata (GET https://query.wikidata.org/sparql?query=..., Accept: application/sparql-results+json; CORS *)
SELECT on ?item wdt:P235 "<InChIKey>" ; p:P2101/P2102/P2054/P1117/P3078/... with quantityAmount + quantityUnit
  ethanol: standard enthalpy of formation -234.8 and -277.6 kJ/mol (gas and liquid; needs the P515 phase qualifier)
           standard molar entropy 160.7 / 281.6 J/mol·K ; combustion enthalpy -1367 kJ/mol ; pKa 16
  acetic acid: pKa 4.74, 4.756 ; mp 16.6 °C, 17 °C, 62 °F (mixed units, duplicates)
  benzoic acid: Cp 102.7/123.5/147.4/172 J/mol·K (different T; qualifiers needed); solubility 2.09 g/kg, 2.7 g/L, ...
  lead(II) iodide: only mp 410/412 °C and bp 872 °C

# IUPAC pKa (https://raw.githubusercontent.com/IUPAC/Dissociation-Constants/main/iupac_high-confidence_v2_4.csv)
CC(=O)O pKa1 4.757 T=25 method E3bg "Approximate" ; also 4.53, 4.48, 4.73, 5.25 (different I / methods)

# RMG solvent library (input/solvation/libraries/solvent.py)
ethanol: eps 24.3, n 1.3611, viscosity A 7.875 B 781.98 C -3.0418, Abraham alpha 0.37 beta 0.48

# AFLOW (no CORS)  https://aflow.org/API/aflux/?species(Pb,I),nspecies(2),enthalpy_formation_atom,compound,$paging(1)
I2Pb1 sg 164 enthalpy_formation_atom -0.675 eV/atom  ->  ≈ -195 kJ/mol (experiment -175.4: ~20 kJ/mol off)

# Failures (reported as observed)
oqmd.org/oqmdapi/formationenergy?composition=PbI2 -> HTTP 502 (twice)
api-ccte.epa.gov -> "Could not resolve host"; comptox.epa.gov/dashboard -> timeout
api.materialsproject.org -> 401 (key required); commonchemistry.cas.org/api -> 401 (key required)
thermoddem.brgm.fr -> "Request Rejected"; atct.anl.gov homepage -> Cloudflare challenge (table page works)
data.nist.gov ThermoML tgz range request -> timeout
```

## 3. Source-priority chains per data type

The tiers map onto the engine's `ProvenanceTier` in `engine/src/types.rs` (Tabulated, Imported, Estimated, Speculative,
Refined, UserSet). Proposed meanings:

| Tier | Meaning |
|---|---|
| **Tabulated** | evaluated or critically reviewed compilation, bundled offline |
| **Imported** | fetched at run time from an external record (a single source or parsed text) |
| **Estimated** | group additivity, QSAR or DFT with a known error model |
| **Speculative** | semi-empirical (xTB) or rule of thumb |
| **Refined** | server-side calibrated computation |
| **UserSet** | user override |

The TypeScript `ProvenanceTier` in `web/src/types/index.ts` has no `'imported'` value yet, so align the two first. Each
chain stops at the first source whose value passes the consistency checks in section 4.4.

| Data type | Chain (left = highest priority) | Notes |
|---|---|---|
| **ΔfH° (gas)** | ATcT (Tab) → NASA CEA (Tab) → NIST WebBook (Imp) → Wikidata P3078 with phase = gas (Imp) → RMG thermo libraries (Tab/Est, check licence) → Benson groups (Est) → Joback (Est, typically ±10 kJ/mol) → GFN2-xTB with atom-equivalent calibration (Spec) | Joback gas ΔfH from the existing estimator: ethanol -236.8 vs -234.95; acetic acid -434.9 vs -432.7 kJ/mol |
| **ΔfH° (liquid/solid)** | ATcT (cr,l) → NASA CEA condensed → NIST WebBook condensed → ΔfH°(gas) − ΔvapH/ΔsubH → ΔcH from PubChem/Wikidata via Hess's law (Imp; already in `COMPOUND_PHASE_PLAN.md`) → estimate | The ΔcH route turns a 0.1 % combustion error into several kJ/mol for large molecules. Label it accordingly |
| **S°** | NASA CEA (polynomial integration constant) → NIST WebBook / JANAF (Imp) → Wikidata P3071 (Imp) → Benson (Est) → ionic solids: Jenkins–Glasser volume-based estimate S° ≈ 1360·Vm + 15 J/(mol·K), with Vm in nm³ per formula unit from density (Est) | ATcT gives ΔfH only |
| **ΔfG°** | Derived from ΔfH° and S° (plus elemental S° from NASA), unless a source gives a self-consistent ΔfG° (SUPCRT, JANAF) | Store ΔfH° + S° and compute ΔfG° |
| **Cp(T)** | NASA CEA NASA-9 → Burcat NASA-7 (licence) → NIST Shomate (Imp) → RMG libraries → Joback Cp polynomial (gas, Est) → Kopp/Neumann rule for solids, Rowlinson–Bondi for liquids (Est) → 3R per atom cap (Spec) | |
| **ΔvapH / vapour-pressure curve** | CoolProp (reference EOS, ~140 fluids) → NIST WebBook Antoine A/B/C with T range (Imp; curve parameters) → derived from ΔfH°/S° of gas and liquid (intrinsic; preferred where both exist) → PubChem/Wikidata vapour-pressure points + Tb, fitted by Clausius–Clapeyron (Imp; the current plan) → Trouton/Kistiakowsky + Joback Tb (Est) | Antoine fits are valid only inside their range. Extrapolate with Clausius–Clapeyron |
| **ΔfusH / Tm** | NIST WebBook ΔfusH (Imp) → NASA (liquid − solid at the transition) → PubChem mp + Walden's rule ΔfusS ≈ 56.5 J/(mol·K) (Est) → Joback Tm (Est) | When both phases have intrinsic data, Tm is derived from G_solid = G_liquid |
| **Density(T)** | CoolProp → ThermoML points, fitted as ρ = ρ0(1 − α(T−T0)) → PubChem/Wikidata single value + generic α (Imp) → Rackett / group contribution (Est). Ionic solids: density of the Materials Project relaxed structure (Est, CC BY) | Solid molar volume is intrinsic. Liquid density at T is derived |
| **Solubility / Ksp** | **Derived from ΔrG°** (section 5): ΔfG° of ions and solid from SUPCRT/ATcT/NASA → PHREEQC llnl/minteq/wateq4f log K + ΔrH, treated as intrinsic reaction data and back-converted to ΔfG° of the solid → PubChem solubility text → Ksp (Imp; current `solubility_parser.ts`) → solubility rules (Spec; current `auto_minerals()`) | Neutral organics: solubility from ΔfG°(aq) − ΔfG°(cr/l) where SUPCRT16-organics has the aqueous species; otherwise PubChem/Wikidata solubility (Imp) → OPERA/GSE estimate (Est) |
| **pKa** | ΔfG° of acid and conjugate base from PHREEQC/SUPCRT (intrinsic, Tab) → PubChem "Dissociation Constants" (Imp; median at 25 °C) → Wikidata P1117 (Imp) → IUPAC digitized dataset (**CC BY-NC**: server-side lookup only, see section 7) → OPERA pKa (Est) → xTB-based or Hammett/Taft estimate (Spec) | Store pKa at I = 0 and 25 °C, plus ΔrH° (van 't Hoff) where known |
| **E° (redox)** | Derived from ΔfG° of both partners (SUPCRT/NBS-derived ions), E° = −ΔrG°/(nF) → PHREEQC redox half-reactions (log K with e⁻) → a short curated table from open sources (Spec) | Verified: SUPCRTBL gives Fe³⁺/Fe²⁺ 0.770 V and Cu²⁺/Cu 0.340 V |
| **Kinetics** | engine templates + Mayr (existing) → RMG kinetics libraries/families (licence check) → NIST Kinetics SRD 17 (gas phase; per-user proxy cache only) → server xTB barrier workflow (Refined; existing M7) → Evans–Polanyi / Eyring defaults (Spec) | No open, bulk database of solution-phase rate constants was found. ORD and USPTO say *which* reactions happen, not how fast |
| **Solvent properties** (ε, viscosity(T), Abraham) | CoolProp (μ, ρ for its fluids) → RMG solvent library (ε, viscosity A/B/C, Abraham parameters; 203 solvents; licence check) → PubChem viscosity/dielectric text (Imp) → Wikidata (dipole, refractive index) → ε estimated from dipole and refractive index via Kirkwood–Fröhlich (Spec) | |
| **Colour / spectra** | curated engine colours (existing) → PubChem "UV Spectra" λmax + log ε text (Imp; build Gaussian bands) → PubChem "Color/Form" text (existing) → sTDA-xTB or TD-DFT on the server (Spec) → NIST UV/Vis JCAMP (copyrighted; per-user only) | |
| **Element data** | mendeleev (MIT) → existing `ions.rs` | |

## 4. Integration design

### 4.1 Identity resolution (always first)
PubChem stays the identity hub. Name or CID resolves to InChIKey, canonical SMILES, formula, charge and CAS RN (taken
from synonyms matching `^\d{2,7}-\d\d-\d$`). Each provider declares which keys it accepts:

- NIST needs a CAS number (`ID=C` + digits) or an InChIKey.
- Wikidata takes InChIKey, CAS or CID.
- NASA, PHREEQC and SUPCRT match by species name plus Hill formula and phase. Maintain a mapping table built
  offline and keyed by InChIKey (e.g. `Acetic-Acid(aq)` ↔ QTBSBXVTEAMEQO-UHFFFAOYSA-N).

Ions and minerals are keyed by formula + charge (+ phase), not by InChIKey. Never match by element multiset alone
(audit F15).

### 4.2 Provider abstraction (`web/src/data/`)
```ts
type DataKind = 'dfH' | 'S' | 'Cp' | 'antoine' | 'dHvap' | 'dHfus' | 'Tm' | 'Tb' | 'density' | 'logK'
              | 'solubility' | 'pKa' | 'E0' | 'viscosity' | 'dielectric' | 'uvvis' | 'colour';
type Phase = 'g' | 'l' | 'cr' | 'aq' | 'cr,l';

interface PropertyRecord {
  kind: DataKind; phase?: Phase;
  value?: number; params?: Record<string, number>;      // SI, see 4.5
  model?: 'nasa7' | 'nasa9' | 'shomate' | 'hkf' | 'antoine_bar_K' | 'ln_mu_ABC' | 'point';
  T_K?: number; P_Pa?: number; Trange_K?: [number, number]; ionicStrength?: number;
  uncertainty?: number; intrinsic: boolean;               // false = condition-dependent evidence
  tier: 'tabulated' | 'imported' | 'estimated' | 'speculative' | 'refined' | 'user-set';
  source: { provider: string; ref?: string; url?: string; retrieved: string; licence: string };
}

interface PropertyProvider {
  id: string;                                   // 'nasa-cea', 'wikidata', 'nist-webbook', ...
  transport: 'bundle' | 'browser' | 'proxy';    // proxy = via the local FastAPI server
  licence: { spdx?: string; bundle: boolean; cacheLocally: boolean; attribution: string };
  kinds: DataKind[];
  lookup(id: CompoundIdentity, kinds: DataKind[], signal?: AbortSignal): Promise<PropertyRecord[]>;
}
```
- **Resolver.** A `PropertyResolver` runs the providers for each kind in the priority order of section 3. It stops
  early for a kind once a record passes the checks. It returns a merged `CompoundData` that feeds the existing
  `CompoundRequest` (`COMPOUND_PHASE_PLAN.md`) with new intrinsic fields (`dhf_kj_mol` per phase, `s_j_mol_k`,
  `cp_model`, ...). On the engine side this needs the `register_species` / `load_database` path (audit F33).
- **Browser providers** (CORS works): Wikidata, PubChem (existing), and GitHub-raw files (only as a fallback for
  bundle updates).
- **Proxy providers** (no CORS, or HTML only): NIST WebBook, JANAF, SDS, the ATcT table, AFLOW, and Materials Project
  (the user's API key stays on the server). They use new FastAPI routes `GET /api/data/{provider}?cas=|inchikey=|formula=`, which:
  - fetch the page and **parse it server-side** into `PropertyRecord[]` JSON;
  - allow only listed hosts, so this is not an open proxy (reuse the existing session-token and DNS-rebinding checks);
  - rate-limit per host (NIST: at least 5 s between requests, per robots.txt);
  - cache on disk in SQLite, keyed by (provider, key, kind), with `retrieved` dates.
- **No server.** When the server is absent, proxy providers report "unavailable" and the chain falls through. This
  must never block an import.
- **Cache.** IndexedDB store `propertyRecords`, reusing the hardened wrapper in `web/src/pubchem/cache.ts`. Imported
  data gets a 90-day TTL. Bundle data has no TTL and is versioned instead. Records from non-redistributable sources are
  cached only in the user's own browser or server. They are never exported in share files or committed.
- **Offline core bundle** (built by `pipeline/` into `web/public/data/thermo_core.json`, gzip). It uses only permissive
  sources (section 7), estimated at a few MB uncompressed:
  - NASA CEA species relevant to bench chemistry (~800 condensed + common gases);
  - PHREEQC llnl/minteq/wateq4f aqueous species and minerals;
  - SUPCRTBL/SUPCRT16 ions and aqueous organics (after the licence is confirmed);
  - a Wikidata subset for the few hundred most-used compounds;
  - CoolProp-derived curve fits for ~10 solvents.

### 4.3 Merge and conflict rules
1. Group records by (kind, phase, reference state). Never mix phases. Wikidata's ethanol ΔfH° values of -234.8 and
   -277.6 are gas and liquid, not a conflict. A Wikidata record with no P515 phase qualifier is dropped.
2. Within a group, take the highest tier present. Within that tier, reuse the idea behind `resolveMedianProperty` in
   `web/src/pubchem/parser.ts`: prefer standard-condition values (25 °C, 1 bar, I = 0) and take the median. Before
   that, reject outliers more than 3 × 1.4826·MAD from the median, and prefer values that carry an uncertainty.
3. When two or more evaluated sources agree within their stated uncertainties, use the uncertainty-weighted mean
   (e.g. ethanol (cr,l): ATcT -277.50 ± 0.20 vs NASA -277.51).
4. A higher tier wins even if lower tiers disagree. A disagreement larger than 3σ is logged as a conflict and shown in
   the Details drawer. Where σ is unknown, the thresholds are 10 kJ/mol or 0.5 log units.
5. Curve parameters are never averaged. Pick one fit per T range: the closest range covering 298 K, then the widest.
6. User overrides (`user-set`) always win. They are kept separate from fetched data.

### 4.4 Consistency checks before a value is accepted
- ΔfG° = ΔfH° − T·(S° − Σ S°elements) when all three are present (within 2 kJ/mol).
- Ksp derived from ΔrG°, PHREEQC log K and PubChem solubility should agree within 0.5 log units. Otherwise flag it.
- The vapour-pressure model must reproduce Tb (P = 101325 Pa) within 3 K and the given vapour-pressure points within 20 %.
- Tm from G_solid = G_liquid must match the reported mp within 5 K.
- Hess's law: ΔfH° derived from ΔcH must match the tabulated value within 5 kJ/mol.

### 4.5 Unit normalisation (SI inside records)
Records store J/mol, J/(mol·K), K, Pa, kg/m³ and Pa·s; convert to g/cm³ only in the UI. Conversions needed in practice:

| Input | Conversion |
|---|---|
| thermochemical calorie (SUPCRT originals, older PHREEQC) | × 4.184 J |
| kcal/mol (RMG) | × 4184 J/mol |
| eV/atom (AFLOW, OQMD, MP) | × 96.485 × atoms per formula unit → kJ/mol |
| mmHg / bar / hPa | × 133.322 / × 1e5 / × 100 → Pa |
| °F | → K |
| NASA coefficients | dimensionless; multiply by R = 8.314462618 |
| NIST Antoine | log10(P/bar), T in K |
| RMG viscosity A/B/C | check the units against a known value (e.g. water or ethanol at 25 °C) before use |
| Wikidata units | map unit QIDs via a small table (Q25267 °C, Q42289 °F, Q11570 K, Q752197 kJ/mol, ...) |
| solubility | keep "g/100 g solvent", "g/kg" and "g/L" distinct |

## 5. Ionic solids and aqueous ions: ΔfH°/S°/ΔfG° so that Ksp follows from ΔG°

Target model: each aqueous ion and each solid carries (ΔfH°, S°, Cp or HKF parameters). Then

```
ΔrG°(T) = Σ ν ΔfG°(ions, T) − ΔfG°(solid, T)      log Ksp(T) = −ΔrG°(T) / (RT ln 10)
```

Solubility, the common-ion effect and the temperature dependence then all follow from the existing IAP = Ksp solver.
The same ΔfG° table also gives E° and acid pKa (ΔrG° of HA → H⁺ + A⁻).

**Aqueous ions (≈ 800 species).**
- Primary bundled source: SUPCRTBL / SUPCRT16 (ΔfG°, ΔfH°, S°, HKF parameters).
- Cross-check: ATcT `(aq)` ΔfH°, which has small uncertainties, for light-element ions.
- Complexes: convert PHREEQC log K of complexation/hydrolysis reactions into ΔfG° of the complex, using the parent ions.
- Convention: ΔfG°(H⁺, aq) = 0.

**Ionic solids, in priority order.**
1. NASA CEA `(cr)` polynomials (ΔfH°, S°, Cp(T)), or JANAF / NIST WebBook values (per-user proxy).
2. SUPCRTBL minerals (Holland–Powell / Maier–Kelley).
3. PHREEQC dissolution log K + ΔrH°. Back out ΔfG°(solid) and ΔfH°(solid) from the ion data. This treats the
   evaluated log K as intrinsic reaction data and keeps everything self-consistent. The llnl `-analytic` fits also
   give ΔrCp.
4. PubChem solubility → Ksp (existing `solubility_parser.ts`) → ΔfG°(solid). Tier Imported, flagged as approximate
   because ion pairing, hydrates and activity coefficients are ignored.
5. DFT ΔfH from Materials Project, OQMD or AFLOW (with MP's fitted anion corrections) + Jenkins–Glasser S°. Tier
   Estimated. Measured error example: AFLOW gives PbI2 ≈ -195 kJ/mol against an experimental -175.4 kJ/mol.
   20 kJ/mol is about 3.5 orders of magnitude in Ksp, so DFT values must never override a measured log K.

**Worked examples (computed from the fetched files).**
- **PbI2.** NASA `PbI2(cr)` + `Pb(cr)` + `I2(cr)` give ΔfG° = -174.18 kJ/mol. With the SUPCRTBL ions, ΔrG° = 46.45 kJ/mol,
  so **log Ksp = -8.14**. For comparison, llnl.dat says -8.04. PubChem's 0.076 g/100 mL at 20 °C gives a crude
  log Ksp ≈ -7.7.
- **ZnF2.** NASA, NIST and ATcT have no data. The llnl log K of -0.4418 with SUPCRTBL Zn²⁺/F⁻ gives
  **ΔfG°(ZnF2, cr) = -713.3 kJ/mol**, which agrees with the standard NBS value. The llnl comments give ΔfH° = -764.2 kJ/mol.
- **Redox** from the same table: Fe³⁺/Fe²⁺ 0.770 V, Cu²⁺/Cu 0.340 V.

Hydrates are separate solids with their own ΔfG°. For example, PubChem's ZnF2 solubility text refers to the
tetrahydrate. The resolver must not attach a hydrate's solubility to the anhydrous phase.

The ΔG° route gives a *thermodynamic* (activity-based) Ksp. The engine currently treats solutions as ideal (audit F12),
so an activity model has to land together with ΔG°-derived Ksp. Otherwise derived values will disagree with today's
concentration-based behaviour at moderate ionic strength.

## 6. Staged integration plan (ordered by value ÷ effort)

**Stage 0: groundwork (small).**
- Align `ProvenanceTier` between Rust and TS (add `imported`).
- Define the `PropertyRecord` / `PropertyProvider` types.
- Add a licence registry (`web/src/data/licences.ts`) that both the bundle builder and the UI attribution panel read.
- Show `source` / `retrieved` for every value in Details.

**Stage 1 (first integration): aqueous ions and minerals from PHREEQC + SUPCRTBL, bundled.**
Why first:
- It has the highest value: aqueous equilibria and precipitation are the core of the engine.
- Both sources are public or permissively distributed, and work offline.
- They are already in PHREEQC syntax, which `pipeline/phreeqc_parser.py` targets (today that file holds only a
  hand-typed subset).

Work:
- Parse llnl / minteq.v4 / wateq4f (log K, ΔrH, analytic fits) and the SUPCRTBL YAML (ΔfG°, ΔfH°, S°, HKF) into
  `thermo_core.json`.
- Derive each mineral's ΔfG° and compute Ksp(T) from ΔG° in the engine. Keep Ksp tables only as cross-checks.
- Replace `pipeline/data/solubility_products.csv`. Its header says CRC/Lange's, and the values were typed from memory.

Gate: PbI2, AgCl, BaSO4, CaCO3, Fe(OH)3 and ZnF2 within 0.3 log units of llnl, and existing precipitation tests unchanged.

**Stage 2: NASA CEA thermo.inp, bundled (gases and condensed phases).** Parse NASA-9 into per-phase H(T), S(T) and Cp(T).
This feeds Stage E of `COMPOUND_PHASE_PLAN.md`. Every species with data for both phases (water, ethanol, acetic acid,
...) then gets its phase from comparing G, and its vapour pressure from ΔG(vap). Boiling and melting need no stored
mp/bp.

**Stage 3: Wikidata browser provider.** CORS works and the data is CC0. Batch SPARQL by InChIKey, with unit and phase
qualifiers. It fills ΔfH°, S°, pKa, ΔcH, density and vapour-pressure points for arbitrary imports. Also put a CC0 dump
of the top few hundred compounds in the bundle.

**Stage 4: server proxy and NIST WebBook provider.** Parse the Mask=1/2/4 pages into records (ΔfH°, S°, Shomate, Antoine,
ΔvapH, ΔfusH, Tc/Pc). Cache per user only, respect the 5 s crawl delay, and show attribution. Then add the ATcT table
(one download, cached) and JANAF.

**Stage 5: real estimators.**
- Rewrite `pipeline/joback_estimator.py` to match groups with RDKit SMARTS. Today it knows only 12 hard-coded SMILES
  and returns `None` for benzoic acid and naphthalene. RDKit 2026.03 and tblite are installed.
- Add Benson group additivity: RMG group values if the licence allows, otherwise published Benson tables re-entered
  with citations.
- Add the Walden, Trouton, Jenkins–Glasser and Kopp rules.
- Add GFN2-xTB atomisation energies with an atom-equivalent fit calibrated on ATcT gas values. Keep them Speculative
  until validated; expect ±20–40 kJ/mol.

**Stage 6: pKa and solvents.**
- pKa: a PubChem dissociation-constant parser (median at 25 °C) plus Wikidata; OPERA predictions on the server; the
  IUPAC CC BY-NC dataset only as an opt-in, server-side lookup.
- Solvents: properties from CoolProp (fits compiled offline) and the RMG solvent library (once the licence is confirmed).

**Stage 7: estimates for ionic solids.** For salts with no measured data, use Materials Project DFT ΔfH (CC BY 4.0, with a
user-supplied API key) plus Jenkins–Glasser S°. These are Estimated tier and never override a measured log K.

**Stage 8: spectra, colour and kinetics.**
- Spectra/colour: PubChem UV text → band model; sTDA-xTB on the server for unknown chromophores.
- Kinetics: keep templates, Mayr and xTB barriers. Use NIST Kinetics via the proxy only for gas-phase cases.

## 7. Licensing risks: what must not be bundled

**Safe to bundle, with attribution:**
- PubChem-derived facts (public domain)
- Wikidata (CC0)
- NASA CEA thermo.inp (Apache-2.0 / US gov)
- PHREEQC databases (USGS public domain)
- ThermoML archive (NIST open licence)
- CoolProp (MIT)
- Cantera `nasa_*.yaml` (BSD / NASA)
- Materials Project (CC BY 4.0, attribution required)
- ChEBI (CC BY 4.0)
- mendeleev (MIT)
- OPERA models (MIT)
- SUPCRT/SUPCRTBL data is widely redistributed (e.g. by Reaktoro under LGPL). Confirm the terms with the SUPCRTBL
  authors before bundling; attribution is required either way.

**Do not bundle or redistribute.** At most, offer a per-user, on-demand lookup with attribution.
- **All NIST Standard Reference Data:** WebBook (SRD 69), JANAF (SRD 13), Solubility (SRD 106), Kinetics (SRD 17) and
  CCCBDB (SRD 101). The SRD Act copyright forbids reproduction without permission. Note that Cantera's
  `critical-properties.yaml` is partly derived from WebBook.
- **IUPAC digitized pKa dataset (CC BY-NC 4.0).** Not compatible with a permissive or commercial distribution. It can be
  cited, used for validation, or fetched by the user's own server.
- **Burcat database.** Copying "in any commercial publication form" is forbidden without written agreement.
- **Share-alike and non-commercial sets:** CAS Common Chemistry (CC BY-NC), ChEMBL (CC BY-SA 3.0) and ORD (CC BY-SA 4.0).
  Keep them out of the core bundle; share-alike terms would propagate to it.
- **`chemicals` / `thermo` Python packages.** The code is MIT, but the TSV tables they ship come from CRC, Yaws, DIPPR,
  Perry, Poling and Landolt-Börnstein. Use the correlations, not the tables.
- **Commercial references:** CRC Handbook, Lange's, Yaws, DIPPR, Reaxys, DDB, Pauling File. Never.
- **Licence unknown:** ATcT, RMG-database, Thermoddem, AFLOW and the Mayr DB have no stated or verified licence. Ask
  before bundling.

**Existing repository items to review.**
- `pipeline/data/solubility_products.csv`. Its header reads "compiled from the CRC Handbook ... / Lange's Handbook",
  and `CLAUDE.md` says the Ksp values were written from memory. Individual numeric facts are generally not
  copyrightable, but the file presents itself as a CRC-derived compilation. Replace it with PHREEQC- or ΔG-derived
  values (Stage 1) and drop the CRC attribution.
- `pipeline/pka_parser.py` labels hand-typed values "IUPAC". That is fine as cited facts. Do not expand it by
  bulk-importing the CC BY-NC CSV into the bundle.
- Several engine `source` strings say "CRC Handbook". Change them to the source actually used.

## 8. Open questions
1. Is the project's intended licence permissive and commercial-friendly? If the project is strictly non-commercial,
   the IUPAC pKa set and Burcat can be bundled with attribution, which simplifies Stages 5–6.
2. Should NIST WebBook data cached by one user's local server ever be shared with other users (e.g. through a shared
   flywheel DB)? Recommendation: no, unless NIST grants permission.
3. Should redistribution permission be requested from ATcT (Ruscic), the RMG team (database licence) and the SUPCRTBL
   authors? All three would add high-quality intrinsic data to the offline bundle.
4. Which activity model ships together with ΔG-derived Ksp: Davies with A(ε(T), ρ(T)) first, with SIT/Pitzer
   (PHREEQC sit.dat / pitzer.dat) later? See audit F12.
5. OQMD, the CompTox CTX API (needs a key) and the ThermoML tarball were unreachable on 2026-10-01 and should be retried.

## Sources
- NIST WebBook: https://webbook.nist.gov/chemistry/ ; SRD law: https://www.nist.gov/srd/public-law ; SRD licence:
  https://www.nist.gov/document/nistwebsublicenseagreementpdf
- NASA CEA: https://github.com/nasa/cea ; Burcat: https://burcat.technion.ac.il/
- ATcT 1.130: https://atct.anl.gov/Thermochemical%20Data/version%201.130/index.php ; OSTI:
  https://www.osti.gov/dataexplorer/biblio/dataset/1997229
- JANAF: https://janaf.nist.gov/ ; PHREEQC databases: https://github.com/usgs-coupled/phreeqc3/tree/master/database
- Reaktoro databases (copies of SUPCRT, SUPCRTBL, Thermoddem): https://github.com/reaktoro/reaktoro/tree/main/embedded/databases
- Wikidata SPARQL: https://query.wikidata.org/ ; IUPAC pKa: https://github.com/IUPAC/Dissociation-Constants
- IUPAC-NIST SDS: https://srdata.nist.gov/solubility/ ; ThermoML: https://data.nist.gov/od/id/mds2-2422
- CoolProp: https://github.com/CoolProp/CoolProp ; Cantera: https://github.com/Cantera/cantera ;
  RMG-database: https://github.com/ReactionMechanismGenerator/RMG-database
- Materials Project terms: https://legacy.materialsproject.org/terms ; AWS: https://registry.opendata.aws/materials-project/
- AFLOW: https://aflow.org/API/aflux/ ; OQMD: https://oqmd.org/ ; ChEBI: https://www.ebi.ac.uk/chebi/ ;
  ChEMBL: https://www.ebi.ac.uk/chembl/ ; OPERA: https://github.com/kmansouri/OPERA ;
  chemicals: https://github.com/CalebBell/chemicals ; ORD: https://github.com/open-reaction-database/ord-data ;
  NIST Kinetics: https://kinetics.nist.gov/kinetics/
