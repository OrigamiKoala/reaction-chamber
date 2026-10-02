# G. Large external sources for the remaining data needs (extends `docs/plans/data-sources.md`)

Date: 2026-10-01. Scope: only needs that `data-sources.md` covers poorly. Sources already surveyed there (PubChem, NIST
WebBook, NASA CEA, Burcat, ATcT, JANAF, PHREEQC, SUPCRT/SUPCRTBL, Thermoddem, Wikidata, IUPAC pKa, SRD 106, ThermoML,
CoolProp, Cantera, RMG-database, MP, OQMD, AFLOW, ChEBI, ChEMBL, CAS, CompTox, OPERA, chemicals/thermo, NIST kinetics,
ORD, Mayr, mendeleev, CCCBDB) are only re-mentioned where this pass found new facts.

User constraint applied throughout: prefer **a few large databases or bulk downloads**, or **one broad predictive model**
that works for arbitrary structures, over bridging many small tables or narrow equations.

**Evidence legend.** **[V]** = verified in this session (endpoint hit with curl, API metadata read, or file downloaded
and counted). **[R]** = read in a paper/landing page found by web search, not independently checked. **[M]** = from
memory/recollection, needs checking before relying on it.

---

## 0. Headline findings

1. **The NBS Tables (Wagman et al. 1982) now exist as a machine-readable NIST open-data release** [V metadata]:
   `doi:10.18434/M32124` → `data.nist.gov/od/id/mds2-2124`, files `NBS_Tables_with_ErratumValues.csv` (767,554 bytes)
   and two `.xlsx` variants (~1.05 MB). Licence field: `https://www.nist.gov/open/license`, which for non-SRD NIST
   data says works of NIST employees are not subject to US copyright (royalty-free worldwide, attribution required) [V].
   Coverage per the digitisation paper: **14,330 critically evaluated species** (inorganic plus C1/C2 organics,
   including aqueous ions) with ΔfH°, ΔfG°, S°, Cp at 298.15 K and H°−H°(0) [R]. This is the largest single
   bundlable source of *intrinsic* ΔfG°/ΔfH°/S° for salts, ions, oxides, hydrates and small organics. It turns
   Ksp, E°, gas evolution, redox direction and acid strength for inorganic chemistry into ΔrG° arithmetic, which is
   what the design invariant asks for. The CSV download itself **timed out three times** from here (data.nist.gov file
   server, same behaviour as the ThermoML tarball in data-sources.md); fetch it once in the pipeline, not at run time.
2. **No large open solution-phase rate-constant database exists.** The large kinetics sources are gas-phase
   (NIST SRD 17 ~70k rate constants/30k reactions [R], SRD-copyrighted; ReSpecTh 162k indirect data points, CC BY 4.0
   [R]; RMG-database 134 families + 183 kinetics libraries, mostly radical/combustion/surface [V]). For bench solution
   chemistry the realistic large inputs are **computed barrier datasets** (RGD1 177k reactions CC BY 4.0 [V],
   Transition1x MIT [V], Grambow 12k CC BY 4.0 [V]) plus a **barrier ML model** or the existing xTB workflow, plus
   Mayr (1,348 nucleophiles / 369 electrophiles [R]).
3. **Product prediction for organics: one open-weights model covers it.** ReactionT5v2-forward (Hugging Face, MIT,
   795 MB safetensors [V]) or Molecular Transformer (MIT/OpenNMT base [V]; 90.4 % top-1 on USPTO-MIT [R]) on the local
   server, trained on USPTO (Lowe, **CC0**, 1976–Sep 2016, 75 MB + 88 MB SMILES 7z [V]) / ORD (**CC BY-SA 4.0** [V]).
   Inorganic aqueous outcomes are better derived thermodynamically from NBS ΔfG° (finding 1) than from text-mined data.
4. **Solubility of organics: BigSolDB 2.2 (CC BY 4.0, Zenodo, CORS `*`) is the one big table** [V]: 111,505 rows,
   1,522 solutes, 127 solvent names, 243–425 K, SMILES for solute and solvent, plus a 12.7 MB activity-coefficient
   file and solid-form labels. Pair it with **AqSolDB (CC0, 9,982 compounds, 3.8 MB)** [V] for water, and **SolProp**
   (Vermeire/Green, ML + thermodynamic cycle, arbitrary solute/solvent/T) as the predictor [R].
5. **pKa: pKahub (2026) aggregates >90k aqueous pKa for >31k molecules** [R], code MIT with a 96 MB `db.sqlite3` in
   the GitHub repo [V], but it **merges datasets with different licences** (it includes the CC BY-NC IUPAC set, OCHEM,
   QSAR Toolbox, ChEMBL-derived sets) [V list], so it must be filtered per source before bundling. Open predictors with
   weights: MolGpKa (MIT) [V], QupKake (BSD-3) [V], pkasolver (MIT) [V], Uni-pKa (repo Apache-2.0 [V], but the work is
   reported as CC BY-NC-ND [R]: treat as non-commercial).
6. **Critical constants/transport: there is no large open experimental table.** Wikidata has *no* critical-temperature
   or critical-pressure property at all, and only 32 items with surface tension, 59 with dynamic viscosity, 127 with
   thermal conductivity, 233 with refractive index [V]. The large tables inside `chemicals` (Yaws 7,549 Tc/Pc/Vc/ω rows,
   CRC, DIPPR, VDI/PPDS, Perry) are commercial-origin [V filenames]. The defensible broad route is **group contribution
   (Joback already present; Abdulelah–Gani in `ugropy`, MIT [V]) + corresponding-states transport models (Chung,
   Rackett/COSTALD, Brock–Bird) implemented in `chemicals` (MIT code)** and an ML critical-property model (Biswas et al.
   2023, chemprop, data public [R]).

---

## 1. Reaction outcomes (which reactions happen, products)

| Rank | Source / tool | Access, format | Size / coverage | Licence, bundle? | CORS | Effort | Caveats |
|---|---|---|---|---|---|---|---|
| 1 (inorganic) | **NBS Tables digitised** (mds2-2124) as ΔfG° for ΔrG° of any balanced inorganic reaction | CSV 0.77 MB / XLSX | 14,330 species incl. aq ions [R] | NIST open licence, bundle with attribution [V licence field] | data.nist.gov: no ACAO header [V]; bundle anyway | M: parse formula+state strings to engine ids | Download timed out here [V]; 1982 values (CODATA-consistent but old); C>2 organics absent |
| 1 (organic) | **ReactionT5v2-forward** (`sagawa/ReactionT5v2-forward`, also `-USPTO_MIT`) | HF safetensors, T5 | 795 MB weights [V] | MIT model card [V]; trained on ORD (CC BY-SA) | HF API returns ACAO for the origin [V], but run it on the **local server** (PyTorch) | M | Seq2seq: can emit invalid/hallucinated SMILES; validate with RDKit + element balance; no rates |
| 2 (organic) | **Molecular Transformer** (pschwllr/MolecularTransformer, OpenNMT) | PyTorch; weights via paper SI / re-train on USPTO-MIT | 90.4 % top-1 USPTO-MIT [R] | code MIT (OpenNMT base) [V]; trained weights redistribution: check | server | M | Older; Chemformer (Apache-2.0 [V]) and Graph2SMILES (MIT [V]) are alternatives |
| 3 (organic, rules) | **USPTO Lowe** reactions → extract templates with **RDChiral** (MIT [V]) after **RXNMapper** atom mapping (MIT [V]) | figshare 5104873: grants SMILES 7z 75 MB, applications 88 MB, CML 0.64/0.69 GB [V] | ~1.8 M grant reactions [R] | **CC0** [V] | figshare API: no ACAO [V]; pipeline-side | H: extract, dedupe, rank by popularity; templates are retro-oriented, forward application gives many candidates | Ranking needs a model anyway, so (1) is cheaper |
| — | **Open Reaction Database** | GitHub protobuf | >2 M reactions, mostly the same USPTO set [R] | **CC BY-SA 4.0** [V]: share-alike, do not mix into bundled closed data | raw GitHub `*` | M | Adds conditions/yields, not new chemistry beyond USPTO |
| — | **RMG reaction families** | Python data files | 134 family directories [V] | **no LICENSE file in RMG-database; README has none** [V] | raw GitHub | H | Radical/combustion/surface (H_Abstraction, R_Recombination, Surface_*): almost nothing for ionic bench chemistry |
| inorganic (supplementary) | Ceder text-mined solid-state (31,782 reactions + 9,518 sol-gel, 2020 version) [V README]; solution-based synthesis 35,675 procedures (Sci Data 2022) [R] | JSON | as stated | repo has **no licence** [V]; Sci Data article CC BY [R]; dataset licence unclear | GitHub | M | Materials-synthesis recipes (calcination, hydrothermal), not test-tube reactions; useful only as "is this precursor set plausible" evidence |
| redox | **E° derived from NBS ΔfG°** (E° = −ΔrG°/nF) | — | every couple whose two partners are in NBS | as NBS | — | L once NBS is in | Better than a hand-curated E° table (no Bratsch/CRC copying) |
| Pourbaix | **MP aqueous ion reference data** (MPContribs `ion_ref_data`, Persson 2012 scheme: experimental ion ΔGf referenced to a solid) [R] | MPContribs API (key) | a few hundred ions [M] | MP terms (CC BY 4.0) [R] | needs key | M | Only useful combined with MP solid energies; NBS + SUPCRTBL already give ion ΔfG° directly. Use for cross-checks |

Commercial (note only): Reaxys, CAS Reactions/SciFinder, Pistachio (NextMove), SPRESI. Not bundlable.

**Rejected as too small/narrow:** ReSpecTh for outcomes (gas-phase combustion); RetroRules (mostly biochemical [R]);
hand-curated named-reaction lists; the engine's own 45 templates as the long-term mechanism (keep as fast path only).

**Broad predictive tool for gaps:** forward model (ReactionT5/MT) for organics; ΔrG° from NBS/SUPCRTBL/NASA for
inorganic and gas reactions; xTB (already installed) to check ΔrE of a proposed organic product when no ΔfH exists.
Typical errors: forward models ~90–97 % top-1 in-distribution on USPTO [R/M], far worse for textbook inorganic or
unusual reagent classes; NBS-derived ΔrG° errors are typically ≤ a few kJ/mol [M].

---

## 2. Kinetics

| Rank | Source | Access, format | Size | Licence | CORS | Effort | Caveats |
|---|---|---|---|---|---|---|---|
| 1 | **RGD1-CHNO** (Zhao et al. 2023) | figshare 21066901: `RGD1_CHNO.h5` 1.34 GB, `RGD1CHNO_AMsmiles.csv` 61 MB, `DFT_reaction_info.csv` 33 MB [V] | 176,992 reactions with validated TS, Ea, ΔH (C/H/N/O, ≤10 heavy atoms) [R] | figshare: **CC BY 4.0** [V]; code repo GPL-3.0 [V] | no (figshare) | M: train/validate a barrier model on the server | Gas-phase DFT (B3LYP-D3/ωB97X-D level) [M]; unimolecular-heavy; no solvent |
| 2 | **Grambow et al.** (Zenodo 3715478) | `b97d3.csv` 3.6 MB, `wb97xd3.csv` 2.7 MB + multi-GB geometries [V] | ~12k reactions [R] | **CC BY 4.0** [V] | Zenodo API `*` [V] | L | Gas-phase, C/H/N/O ≤7 heavy atoms |
| 2 | **Transition1x** (figshare 19614657) | `Transition1x.h5` 6.6 GB [V] | ~10k reactions, ~9.6 M DFT points [R] | **MIT** [V] | no | M | For training ML potentials/TS search rather than direct Ea lookup |
| 3 | **Mayr database** | HTML per compound | 1,348 nucleophiles, 369 electrophiles [R] | not stated; no bulk download [R] | no | already in use | Polar organic only; log k = sN(N+E) at 20 °C, solvent-specific |
| — | **NIST SRD 17** | HTML form | ~70k rate constants / 30k reactions [R] (older: 38k records, 11.7k reactant pairs) | **SRD copyright** | no | proxy per user only | Gas-phase |
| — | **ReSpecTh** | XML (RKD), OSF mirror `osf.io/nbmzv` | >3,600 files, >162k indirect data points [R] | **CC BY 4.0** [R] | registration for site downloads; OSF open [R] | M | Ignition delays/flame speeds for combustion mechanisms: not useful for bench solution chemistry |
| — | **RMG kinetics libraries + rate rules** | Python | 183 `reactions.py` libraries (12 MB), 134 families, 38.6 MB total kinetics [V] | no licence file [V] | raw GitHub | H | Gas/combustion/surface; licence must be clarified with maintainers |
| — | NDRL/NIST Radiation Chemistry (solution radical rate constants, Buxton 1988 compilation) | HTML | ~ tens of thousands of radical rate constants [M] | SRD/JPCRD copyright [M] | no | — | Radicals (e⁻aq, ·OH, H·) only |

**Broad predictive tools (barriers for arbitrary reactions):**
- **chemprop** (MIT; GitHub reports `NOASSERTION` because of the file format [V]) trained on RGD1/Grambow-type data
  (CGR reaction encoding). Published barrier models reach ~2.5–4 kcal/mol MAE in-distribution [R/M]; gas phase only.
- Solvent correction: Chung & Green kinetic-solvent-effect ML (ΔΔG‡solv from COSMO-RS-generated data) [M: dataset
  and model reported open, verify]. Alternative: openCOSMO-RS / COSMO-SAC solvation of reactant and TS (section 3).
- Existing M7 xTB barrier workflow + calibration (already in repo) remains the "Refined" tier; RGD1 is the right
  validation set for it.
- **Solution-phase ionic reactions** (precipitation, neutralisation, complexation) are diffusion- or
  equilibrium-limited and need no rate database: keep the existing diffusion cap + equilibrium solver.

**Rejected:** ReSpecTh and NIST SRD 17 for bench chemistry (gas-phase, and SRD cannot be bundled); PrIMe/ChemKED (small,
combustion, ChemKED inactive [M]); individual named-reaction rate tables.

---

## 3. Activity and solvation parameters

| Rank | Source | Access | Size | Licence | CORS | Effort | Caveats |
|---|---|---|---|---|---|---|---|
| 1 (organic mixtures) | **UNIFAC 2.0 / modified UNIFAC (Dortmund) 2.0** (Hayer, Hasse, Jirasek; Chem Eng J 2025 / Ind Eng Chem Res 2025): matrix-completed **full** interaction-parameter matrix, so no missing group pairs | SI of the papers; also shipped in `thermo` as `UNIFAC 2.0 interaction parameters.tsv` (47.6 kB) and `UNIFAC 2.0 Dortmund interaction parameters.tsv` (111 kB) [V files] | all main-group pairs [R] | arXiv 2408.05220 / 2412.12962 open access [R]; parameter licence not stated; `thermo` repo MIT [V] | raw GitHub `*` | L–M: port UNIFAC (a few hundred lines) to Rust | Group assignment needs SMARTS: `thermo` ships `DDBST UNIFAC assignments.tsv` (31,777 rows) [V]; `ugropy` (MIT) assigns UNIFAC/PSRK/Joback groups from names/SMILES [V] |
| 1 alt | Original/Dortmund public UNIFAC parameters (DDBST public subset), NIST-KT-UNIFAC 2015 (`UNIFAC modified NIST 2015 interaction parameters.tsv`, 68.8 kB) [V files] | `thermo` | public tables | DDBST public tables: free to use, licence terms not formal [M]; NIST-KT (Kang et al.) is NIST work [M] | raw GitHub | L | Gaps in the matrix (why UNIFAC 2.0 is preferred) |
| 2 (any solute/solvent, incl. ions-free polar) | **COSMO-SAC (NIST, Bell et al. 2020)** code + **2,261-compound sigma-profile database** [R] | GitHub `usnistgov/COSMOSAC` | 2,261 profiles [R] | code **MIT** [V]; profile DB described as free to academic/non-commercial users [R]: check before bundling | raw GitHub | M | DMol3-based profiles; new molecules need a COSMO calculation |
| 2 alt | **openCOSMO-RS** (TUHH) + **CHAOS** sigma-profile DB (53,091 molecules, ωB97X-D/def2-TZVP, also IR, ideal-gas Cp and S) | `openCOSMO-RS_py` (LGPL-3.0 [V]); CHAOS on Zenodo | 53,091 [R] | CHAOS **CC BY 4.0** [R]; new profiles need ORCA (free for academics, closed source) [M] | Zenodo `*` | M | 0.45 kcal/mol AAD for ΔGsolv [R]; requires ORCA on the server for unseen molecules |
| 3 (Abraham LSER) | **UFZ-LSER** database (v3.x) | web (`ufz.de/lserd`) | ~6,364–6,852 compounds with experimental E,S,A,B,V,L [R] | "free" web DB; terms not found [R]; no bulk download known [M] | no | M | Use as validation; for bundling prefer RMG solute library (450 entries, licence unclear) or an ML descriptor predictor |
| electrolytes | **PHREEQC `pitzer.dat`** (37 kB; 199 parameter lines; ions Na, K, Li, Mg, Ca, Ba, Fe²⁺, Mn²⁺, H⁺ / Cl⁻, Br⁻, OH⁻, SO4²⁻, HSO4⁻, CO3²⁻, HCO3⁻, borates) [V] and **`sit.dat`** (446 kB, ThermoChimie-derived, ~2.4k parameter-like lines) [V] | raw GitHub | as stated | USGS public domain (pitzer.dat) [V in data-sources]; sit.dat derived from ThermoChimie: terms not verified | `*` | M | Pitzer is a seawater-system set: small. SIT covers far more ions with one ε per ion pair: the better *general* choice for concentrated salts |
| eNRTL | no large open parameter set found | — | — | Aspen-proprietary banks | — | — | Rejected |

**Broad predictive tool:** UNIFAC 2.0 for organic mixtures (activity coefficients, LLE, VLE) from structure alone;
COSMO-SAC/openCOSMO-RS where a sigma profile can be computed on the server; Davies → SIT for electrolytes (SIT ε can be
estimated per ion pair when missing, typical ±0.05 kg/mol [M]). BigSolDB 2.2 also ships `BigSolDBv2.2_gamma.csv`
(12.7 MB) [V], a ready validation set for activity models.

**Rejected:** THEREDA (Pitzer, high-salinity nuclear-waste focus; licence/access not verified), individual Pitzer
papers, DDB (commercial), Aspen/eNRTL banks (commercial).

---

## 4. Critical constants, acentric factor, transport properties

What exists openly, measured in this session:

| Source | Count | Licence | Verdict |
|---|---|---|---|
| Wikidata | **no Tc/Pc property exists** (label search for "critical" returns none) [V]; surface tension 32 items, dynamic viscosity 59, thermal conductivity 127, refractive index 233, relative permittivity 28, dipole moment 366 [V] | CC0 | too small |
| `chemicals` IUPAC organic critical properties (Ambrose et al., IUPAC series) | 810 rows [V] | IUPAC evaluated data in JCED/JPCRD; redistribution terms unclear [M] | small but high quality; server-side only until cleared |
| `chemicals` PSRK appendix (Tc, Pc, Vc, ω) | 995 rows [V] | from DDBST PSRK revision 4 [V filename]; licence unclear | small |
| `chemicals` "Yaws Collection" (Tc, Pc, Vc, ω) | 7,549 rows [V] | **Yaws: commercial origin** | do not bundle |
| `chemicals` Wilson–Jasperson Tc/Pc *predictions* | 29,726 rows [V] | MIT (generated by the package author) [M] | a precomputed estimate, label Estimated |
| CoolProp | 139 fluids (data-sources.md) | MIT | reference quality, small |
| ThermoML Archive | tens of thousands of data sets incl. viscosity, density, surface tension (data-sources.md) | NIST open | **largest open experimental transport source**; 189 MB tgz download timed out previously |

| Rank | Recommendation | Coverage | Licence | Effort | Typical error |
|---|---|---|---|---|---|
| 1 | **Group contribution from structure**: Joback (in repo) + **Abdulelah–Gani** (2023 update of Constantinou–Gani/Marrero–Gani; Tc, Pc, Vc, ω, Tb, Tm, ΔfH, ΔfG, ΔvapH…) via **`ugropy`** (MIT [V]) | any organic with assignable groups | MIT code; Gani parameters published in papers [R] | M: port tables to pipeline/engine | Tc ~1–2 %, Pc ~4–5 %, ω ~5–10 % for Gani-type methods [M] |
| 2 | **ML critical properties** (Biswas, Chung, Ramirez, Wu, Green, JCIM 2023; chemprop multitask; datasets public) [R] | arbitrary SMILES | chemprop MIT; data licence: check | M on server | reported better than GC on test sets [R] |
| 3 | **Corresponding-states transport models** driven by (Tc, Pc, Vc, ω, μ dipole): Chung (gas/liquid viscosity and k), Rackett/COSTALD (liquid density), Brock–Bird / Sastri–Rao (surface tension), Letsou–Stiel; all implemented in `chemicals` (MIT code) [V module names] | anything with critical constants | MIT code; equations are not copyrightable | M | viscosity of liquids ±10–30 % [M]; density ±2–5 % [M] |
| validation | ThermoML (NIST open) for fitting/validation; IUPAC critical set (810) for Tc/Pc checks | — | — | — | — |

Commercial (note only): DIPPR 801, Yaws, TRC/TDE, DDB, CRC tables (even when bundled inside `chemicals`).

**Rejected:** Wikidata (no Tc/Pc; transport counts < 130), the individual CRC/Perry/VDI tables in `chemicals`
(commercial origin), Passut–Danner (1973, 12 kB) and Mathews 1972 inorganic (6 kB): too small.

---

## 5. UV-Vis spectra, molar absorptivity, colour, flame lines, refractive index

| Rank | Source | Access | Size | Licence | CORS | Effort | Caveats |
|---|---|---|---|---|---|---|---|
| 1 (measured organics) | **Joung et al. 2020 "Experimental database of optical properties of organic compounds"** (Sci Data) | CSV (figshare) | 20,236 records, 7,016 chromophores × 365 solvents/solid; λabs max, FWHM, ε, emission, PLQY, lifetime [R] | Sci Data data record; licence presumed CC BY 4.0 [M: verify] | figshare: no ACAO [V for API] | L | Dye/fluorophore-biased; few simple inorganic/colourless compounds |
| 1 (measured organics) | **Beard et al. 2019 ChemDataExtractor UV/Vis DB** | figshare JSON/CSV | 18,309 records of λmax + ε, plus sTDA/TD-DFT for a validated subset [R] | **CC BY 4.0** [R] | no | L | Text-mined: ~noise; Combine with Joung |
| 2 (predictor) | **Greenman et al. single-/multi-fidelity λmax models** (chemprop) | Zenodo 5573027 (651 MB, **MIT**) and 5773155 (benchmark code, 1.67 GB, MIT) [V] | trained on ~28k experimental + TD-DFT data [M] | MIT [V] | Zenodo `*` [V] | M (server) | Predicts peak λ (and ε in some variants) only; build a Gaussian band from λmax, ε, FWHM |
| 2 (computed) | **PubChemQC** B3LYP/6-31G*//PM6 (85.9 M molecules) with TD-DFT 10 lowest excitations for >2 M molecules (earlier release) [R] | bulk download (RIKEN) | huge | **CC BY 4.0** [R] | no | M: index by InChIKey on server | Gas-phase vertical excitations; B3LYP λ errors ~0.2–0.4 eV [M] |
| 3 (computed on demand) | **sTDA-xTB** (`xtb4stda` LGPL-3.0 [V]; `stda` program) on the local server, xTB already installed | — | any molecule ≤ ~1000 atoms | LGPL | — | M | ~0.3–0.5 eV errors [M]; Speculative tier |
| ions/complexes | No large open table of aqueous d–d/charge-transfer spectra found. Keep curated engine colours for ~50 coloured ions; PubChem "Color/Form" text as fallback | — | — | — | — | — | Gap |
| solids | **MP `absorption` collection** (bulk S3, no key, CORS `*`) [V] and band gaps in MP/Alexandria (Alexandria ~5.8 M structures, CC BY 4.0 [R]) | jsonl.gz partitions | MP: tens of thousands [M] | CC BY 4.0 [R] | S3 `*` [V] | M | PBE band gaps underestimate by ~40 % [M]; colour of a powder needs gap + defect/d–d physics |
| flame lines | **NIST Atomic Spectra Database** (SRD 78) | `physics.nist.gov/cgi-bin/ASD/lines1.pl?...&format=2` returns CSV (Na I 380–720 nm tested) [V] | all elements, observed + Ritz λ, Aki, levels [V for Na] | **SRD copyright** [V terms page] | **no ACAO header** [V] | L: pipeline extracts the ~10 strongest visible lines per element once | Store only derived per-element emission colours if redistribution is a concern |
| refractive index | **refractiveindex.info database** (`polyanskiy/refractiveindex.info-database`) | YAML per material, raw GitHub | thousands of material entries [M] | **CC0-1.0** [V] | raw GitHub `*` [V] | L | Dispersion n(λ), k(λ); mostly solids/optical materials, ~100 liquids [M] |

**Broad predictive tool:** λmax/ε ML (Greenman models) → sTDA-xTB on the server → PubChem λmax text. For colour in the
renderer, a Gaussian band (λmax, ε, FWHM≈ 60–100 nm default) on the engine's 32-bin spectral grid is enough.

**Rejected:** PhotochemCAD (~550 compounds [M], too small), NIST WebBook UV/Vis (SRD, ~1,600 spectra [M]), QM8
(21,786 small molecules, mostly transparent in the visible), Wikidata (no λmax property; refractive index 233 items).

---

## 6. Organic thermochemistry at scale

| Rank | Source | Size | Licence | Effort | Caveats |
|---|---|---|---|---|---|
| 1 (tabulated, bundlable) | **NBS Tables** (C1/C2 organics plus all inorganics) [R] | part of 14,330 | NIST open [V] | as §1 | No C≥3 |
| 1 (gas phase, computed) | **ThermoG3 / ThermoCBS** (Dong et al., J Cheminform 2024): ΔfH° at G3MP2B3 (53,550 species incl. radicals) and CBS-QB3 (52,837) [R] | ~53k each | Zenodo; licence not verified [R] | L | Broader than QM9 (only 63 %/52 % in QM9's four classes) [R]; gas phase, so ΔsubH/ΔvapH still needed |
| 2 | **QM9-G4MP2** (Narayanan et al. 2019) 133k molecules ≤9 heavy atoms [M] | 133k | CC BY 4.0 [M] | L | C/H/O/N/F only |
| 2 | **RMG thermo libraries + Benson group values + RMG's own chemprop ΔHf ensemble** (`input/thermo/ml/main/hf298/model_*/model.pt`) [V paths]: 77 libraries (36 MB), 3.9 MB of group files [V] | thousands | **no licence file** [V]; RMG-Py MIT | M | Ask maintainers before bundling; group additivity typically ±4–8 kJ/mol for gas ΔfH [M] |
| 3 | **PubChemQC** (85.9 M B3LYP energies) [R] | 86 M | CC BY 4.0 [R] | H | Raw DFT energies, not calibrated ΔfH; needs atom-equivalent / isodesmic correction |
| — | Pedley tables, TRC, DIPPR | — | commercial | — | note only |

**Broad predictive tool:** gas ΔfH° from (a) GNN trained on ThermoG3/ThermoCBS (paper reports chemical accuracy,
~1 kcal/mol [R]) or RMG's chemprop ensemble, (b) Benson/Joback/Gani as fallback; condensed-phase via ΔfH°(g) −
ΔvapH (Gani or Joback-derived Tb + Trouton/Kistiakowsky) or ΔcH° from PubChem (already planned). S° and Cp(T) of
ideal gas: CHAOS ships ideal-gas Cp and S for 53,091 molecules [R]; otherwise Benson/Joback.

**Rejected:** ATcT for organics beyond small species (152 cr, 47 l rows); NASA CEA for organic solids; CCCBDB (~2k).

---

## 7. Solubility (organics and salts, across T and solvents) and pKa

### 7a. Solubility

| Rank | Source | Access | Size | Licence | CORS | Caveats |
|---|---|---|---|---|---|---|
| 1 | **BigSolDB 2.2** (Krasnov et al.; Zenodo 22648301, 2026-09-07) | `BigSolDBv2.2.csv` 24.7 MB, plus `_gamma` 12.7 MB, `_solid_forms`, `_densities`, `_methods` [V] | 111,505 rows, 1,522 solutes, 127 solvent names, 243–425 K, SMILES solute + solvent, mole fraction + mol/L + log S, DOI per row [V] | **CC BY 4.0** [V] | Zenodo API `*` [V] | Drug-like solutes dominate; water is one of the solvents |
| 1 (water) | **AqSolDB** (Sorkun et al. 2019; Harvard Dataverse doi:10.7910/DVN/OVHAW8) | `curated-solubility-dataset.tab` 3.8 MB [V] | 9,982 compounds (log S at ~25 °C) [R] | **CC0 1.0** [V] | Dataverse API: no ACAO [V] | Includes inorganic salts; single T |
| 2 (predictor) | **SolProp** (Vermeire, Chung, Green): ML ΔGsolv, ΔHsolv, Abraham descriptors + thermodynamic cycle → solubility at arbitrary T, any organic solvent | GitLab KU Leuven + Zenodo weights [R] | — | GitHub mirror has no licence field [V]; check | server | Organic solutes only; newer FASTPROP-based model (MIT news 2025; Nat Commun 2025) reports 2–3× lower extrapolation RMSE [R] |
| salts | **Derived from ΔrG°** (NBS ΔfG° of solid + ions) for Ksp; PHREEQC llnl/minteq log K(T) as existing | — | — | — | — | Already the plan in data-sources §5; NBS makes it near-complete for common salts |

**Rejected:** Open Notebook Science solubility challenge (~ a few thousand non-aqueous points [M], subsumed by
BigSolDB), SRD 106 (SRD copyright, no salts like PbI2 [data-sources]), Wikidata solubility (461 items).

### 7b. pKa

| Rank | Source / tool | Size | Licence | Notes |
|---|---|---|---|---|
| 1 data | **pKahub** (`pkahub.ttk.hu`, GitHub `keserulab/pkahub`, MIT code, 96 MB `db.sqlite3` [V]) | >90k aqueous pKa, >31k molecules, microstate-annotated [R] | **mixed**: datasets include AttenGpKa train (13,556), Baltruschat ChEMBL (7,752), DataWarrior (7,495), Hunt (2,430), **IUPAC digitized (18,513; CC BY-NC)**, OCHEM (20,708), QSAR Toolbox (24,609), SAMPL6/7/8, Settimo (622), Novartis (280) … [V counts] | Bulk TSV/JSON/SDF per dataset [V]. Bundle only the sets whose licence permits (e.g. ChEMBL-derived CC BY-SA, SAMPL); keep IUPAC/OCHEM/QSAR-Toolbox server-side |
| 2 data | **iBonD** (Cheng; Nankai/Tsinghua): >30k–40k pKa in ~39–46 solvents (DMSO, MeCN, water…) + BDEs [R] | free web lookup [R] | not bundlable (no licence/bulk) [M] | The only large non-aqueous pKa source; server lookup/validation only |
| 1 tool | **MolGpKa** (MIT, weights in repo `models/`) [V] | — | MIT | GCN, micro-pKa per ionisable site; ~0.5–0.8 log MAE on drug-like sets [R/M] |
| 1 tool | **QupKake** (BSD-3) [V] | — | BSD-3 | GFN2-xTB features + GNN: fits the installed xTB stack |
| 2 tool | pkasolver (MIT) [V]; Uni-pKa (weights on HF `Lai-ao/uni-pka-ckpt_v2` [V]; repo Apache-2.0 [V] but work reported CC BY-NC-ND [R]) | — | see left | The 2026 JCIM benchmark compares these four against commercial tools on pKahub [R] |

All pKa models above are drug-trained: inorganic oxoacids, metal aqua ions and carbon acids are out of domain. For
those, ΔfG° (NBS/SUPCRTBL) is the intrinsic route; for C–H acids pKalculator (2024) exists [R].

---

## 8. Elemental and inorganic solids thermochemistry

| Rank | Source | Access | Size | Licence | CORS | Fitted to experiment? | Caveats |
|---|---|---|---|---|---|---|---|
| 1 (experimental) | **NBS Tables digitised** (§0) | CSV | 14,330 species (solids, ions, gases) [R] | NIST open [V] | bundle | evaluated experimental | 1982; some superseded by CODATA/ATcT |
| 1 (experimental minerals) | **Robie & Hemingway 1995, USGS Bulletin 2131** (minerals and related substances, ΔfH, ΔfG, S, Cp(T) to high T) | PDF 21.8 MB at `pubs.usgs.gov/bul/2131/report.pdf` [V] | ~ hundreds of minerals/oxides [M] | **US gov public domain** [M: USGS works] | — | experimental | PDF only: needs table extraction (one-time, pipeline) |
| 1 alt | **NBS Technical Note 270-3…270-8** (the source of the 1982 tables) | PDFs on nvlpubs.nist.gov, e.g. 270-3 13.6 MB, 270-4 8.5 MB, 270-8 7.8 MB [V] | as NBS | NIST technical series: no US copyright, reprint allowed [V terms page] | — | experimental | Only needed if the CSV cannot be obtained |
| 2 (computed, broad) | **Materials Project** bulk release on AWS (`s3://materialsproject-build/collections/<date>/…` partitioned `jsonl.gz`, **no API key**, CORS `*`) [V listing incl. 2025-09-25 release, `thermo/`, `summary/`, `absorption/` collections] | ~150k+ materials [R] | AWS registry says "MP Terms of Use" [V]; data CC BY 4.0 [R] | S3 `*` [V] | **Yes: MP2020 compatibility scheme applies anion and GGA+U corrections fitted to experimental formation enthalpies** [M] | Use formation energies only through the corrected `thermo` docs; ΔfG needs an entropy estimate (MP gives 0 K energies) |
| 3 (computed, largest) | **Alexandria** (Schmidt, Botti, Marques; `alexandria.icams.rub.de`) | bulk JSON | ~5.8 M structures (4.49 M 3D), 175k on hull [R] | **CC BY 4.0** [R] | — | PBE, MP-compatible settings [R] | Mostly hypothetical compounds; useful only for formula lookup misses |
| — | OQMD | `oqmd.org/download` | ~1 M [M] | CC BY 4.0 [M] | — | fitted elemental chemical potentials [M] | **HTTP 502 again** on API and download page this session [V] |
| — | JARVIS-DFT (NIST) | figshare via jarvis-tools | ~80k 3D [M] | NIST data, terms not verified | — | no | Smaller than MP/Alexandria |
| — | Barin "Thermochemical Data of Pure Substances", FactSage/SGTE, HSC | — | — | **commercial** | — | — | note only |

**Broad predictive tool for missing solids:** MP/Alexandria ΔfH (corrected) + Jenkins–Glasser volume-based S°
(already in data-sources §3) gives ΔfG° for any crystalline salt; error ~10–30 kJ/mol on ΔfH for ionic solids [M],
which is ~2–5 log units in Ksp, so label it Estimated and prefer NBS/SUPCRTBL/llnl whenever present.

---

## 9. Licence summary of the new sources

| Bundle freely (attribution) | Bundle with care (share-alike / unclear) | Server-side / per-user only | Commercial (never) |
|---|---|---|---|
| NBS Tables digitised (NIST open) [V]; NBS TN 270 PDFs [V]; Robie & Hemingway (USGS) [M]; USPTO Lowe (CC0) [V]; AqSolDB (CC0) [V]; BigSolDB 2.2 (CC BY 4.0) [V]; RGD1 data (CC BY 4.0) [V]; Grambow (CC BY 4.0) [V]; Transition1x (MIT) [V]; refractiveindex.info (CC0) [V]; ReSpecTh (CC BY 4.0) [R]; Beard UV/Vis (CC BY 4.0) [R]; CHAOS (CC BY 4.0) [R]; MP/Alexandria (CC BY 4.0) [R]; PubChemQC (CC BY 4.0) [R]; models: ReactionT5v2 (MIT) [V], RXNMapper/RDChiral (MIT) [V], Chemformer (Apache-2.0) [V], Graph2SMILES (MIT) [V], MolGpKa (MIT) [V], QupKake (BSD-3) [V], pkasolver (MIT) [V], Greenman UV models (MIT) [V], COSMOSAC code (MIT) [V], ugropy (MIT) [V] | ORD (CC BY-SA 4.0) [V]; ChEMBL-derived pKa sets (CC BY-SA); openCOSMO-RS (LGPL-3.0) [V]; xtb4stda (LGPL-3.0) [V]; RMG-database (no licence file) [V]; UNIFAC 2.0 parameters (open-access SI, no explicit licence) [R]; Ceder text-mined (no repo licence) [V]; Joung optical DB (presumed CC BY) [M]; ThermoG3/CBS (Zenodo, licence unverified) | NIST SRD 17, SRD 78 ASD, WebBook UV/Vis (SRD copyright); IUPAC pKa (CC BY-NC); pKahub's IUPAC/OCHEM/QSAR-Toolbox subsets; Uni-pKa (reported CC BY-NC-ND); NIST COSMO-SAC profile DB (non-commercial) [R]; iBonD; UFZ-LSER; Mayr | Reaxys, CAS, Pistachio, DIPPR, Yaws, TRC/TDE, DDB, Barin, FactSage, HSC, Pedley, CRC tables inside `chemicals` |

---

## 10. Minimal large-source stack

The smallest set that covers the most needs (8 items, 4 of them already partly in the repo or the existing plan):

1. **NBS Tables digitised (NIST, 14,330 species)**: inorganic + C1/C2 ΔfH°/ΔfG°/S°/Cp → Ksp, E°, gas evolution,
   redox, acid strength of inorganic acids, solids thermo. Bundled (pipeline download once).
2. **SUPCRTBL + PHREEQC llnl/sit.dat** (already surveyed): aqueous species to high T, organics(aq), SIT activity
   parameters. Bundled.
3. **NASA CEA + ATcT** (already surveyed): gas-phase and high-T thermo for small species. Bundled (ATcT: cite/ask).
4. **Materials Project bulk S3 release** (no key, CORS `*`): computed ΔfH and structure/density for any inorganic solid
   missing from 1–3, with MP2020 experimental corrections. Bundle a filtered slice (CC BY 4.0).
5. **BigSolDB 2.2 + AqSolDB**: measured solubility across T and solvents (CC BY 4.0 / CC0). Bundled (~28 MB raw;
   ~3 MB after keeping SMILES/T/x).
6. **pKahub (licence-filtered subsets)**: measured aqueous pKa. Bundle the permissive subsets, server-only for the rest.
7. **Local-server model pack (one Python env, all permissive)**: ReactionT5v2-forward (products), chemprop barrier
   model trained on RGD1/Grambow (Ea), MolGpKa or QupKake (pKa), SolProp (solubility in any solvent/T), Greenman λmax
   model (colour), `ugropy` Abdulelah–Gani + Joback (Tc/Pc/ω/Tb/Tm), UNIFAC 2.0 parameters (activity), existing xTB
   workflow (barriers/ΔrE, sTDA for spectra).
8. **refractiveindex.info (CC0) + NIST ASD extract (derived per-element line colours)**: optics and flame colours.

### Per-need source-priority chains (left = highest; tiers as in data-sources.md §3)

| Need | Chain |
|---|---|
| Inorganic reaction outcome | ΔrG° from NBS ΔfG° (Tab) → SUPCRTBL/llnl log K (Tab) → MP-corrected ΔfH + Jenkins–Glasser S° (Est) → solubility rules / `auto_minerals()` (Spec) |
| Organic products | engine templates for the fast path (Tab) → ReactionT5v2-forward / Molecular Transformer on server, RDKit + element-balance validated (Est) → RDChiral templates from USPTO-CC0 (Est) → xTB ΔrE plausibility check (Spec) |
| E° | −ΔrG°/nF from NBS/SUPCRTBL (Tab) → PHREEQC redox half-reactions (Tab) → MP ion reference data (cross-check) |
| Kinetics (organic) | Mayr N/sN/E (Tab) → chemprop barrier model trained on RGD1/Grambow + solvent correction (Est) → server xTB barrier workflow (Refined) → Evans–Polanyi/Eyring defaults (Spec); RMG families only for radical/gas chemistry after licence clearance |
| Kinetics (ionic aqueous) | diffusion-limited cap + equilibrium solver (existing); no database needed |
| Activity (organic mixtures) | UNIFAC 2.0 / mod. UNIFAC 2.0 (Est) → COSMO-SAC / openCOSMO-RS with server-computed profiles (Est) → ideal (Spec) |
| Activity (electrolytes) | Pitzer (pitzer.dat ions) → SIT (sit.dat) → Davies (existing) |
| Abraham / solvation | RMG solute library (licence) → SolProp ML descriptors (Est) → UFZ-LSER (validation only) |
| Tc, Pc, Vc, ω | CoolProp (Tab) → IUPAC critical set (server, 810) → ML (Biswas/chemprop) (Est) → Abdulelah–Gani / Joback (Est) |
| Viscosity, k, σ, ρ(T) | CoolProp → ThermoML fits (Imp) → Chung / Rackett-COSTALD / Brock–Bird from (Tc, Pc, Vc, ω) (Est) |
| UV-Vis / colour | curated engine colours (ions) → Joung + Beard measured λmax/ε (Tab) → PubChem UV text (Imp) → Greenman ML λmax (Est) → sTDA-xTB (Spec); solids: MP absorption/band gap (Est) |
| Flame colour | NIST ASD strongest visible lines per element, reduced to an RGB once in the pipeline |
| Refractive index | refractiveindex.info (CC0) → Wikidata P1109 → Lorentz–Lorenz from density + group molar refraction (Est) |
| Organic ΔfH°, S°, Cp | ATcT / NASA / NBS (C1–C2) (Tab) → ThermoG3/CBS lookup (Tab-computed) → GNN on ThermoG3 or RMG chemprop ensemble (Est) → Benson/Joback/Gani (Est); condensed phase via ΔvapH/ΔsubH or PubChem ΔcH |
| Solubility (organics) | BigSolDB 2.2 rows matching solute+solvent, fitted ln x vs 1/T (Tab) → AqSolDB (water, 25 °C) → SolProp / FASTPROP model (Est) → OPERA (Est) |
| Solubility (salts) | ΔrG° from NBS/SUPCRTBL (Tab) → PHREEQC log K (Tab) → AqSolDB / PubChem text (Imp) → rules (Spec) |
| pKa | ΔfG° route for inorganic acids (Tab) → pKahub permissive subsets / PubChem text (Imp) → MolGpKa or QupKake (Est) → iBonD (server, non-aqueous) |
| Inorganic solids thermo | NBS → Robie & Hemingway (minerals) → NASA CEA condensed → MP corrected (Est) → Alexandria (Est) |

---

## Sources (URLs used)

- NBS Tables digitised: https://doi.org/10.18434/M32124 → https://data.nist.gov/od/id/mds2-2124 ; paper https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9097797/
- NIST licensing statement: https://www.nist.gov/open/copyright-fair-use-and-licensing-statements-srd-data-software-and-technical-series-publications
- NBS TN 270: https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote270-3.pdf ; Robie & Hemingway: https://pubs.usgs.gov/bul/2131/report.pdf
- USPTO (Lowe): https://api.figshare.com/v2/articles/5104873 ; ORD: https://github.com/open-reaction-database/ord-data
- ReactionT5v2: https://huggingface.co/sagawa/ReactionT5v2-forward ; Molecular Transformer: https://pubs.acs.org/doi/10.1021/acscentsci.9b00576
- Ceder text-mined: https://github.com/CederGroupHub/text-mined-synthesis_public ; https://www.nature.com/articles/s41597-022-01317-2
- MP Pourbaix ion data: https://contribs.materialsproject.org/projects/ion_ref_data ; MP S3: https://materialsproject-build.s3.amazonaws.com/
- RGD1: https://www.nature.com/articles/s41597-023-02043-z , figshare 21066901 ; Grambow: https://zenodo.org/records/3715478 ; Transition1x: figshare 19614657
- NIST SRD 17: https://kinetics.nist.gov/kinetics/index.jsp ; ReSpecTh: https://www.nature.com/articles/s41597-025-05272-6
- Mayr: https://www.cup.lmu.de/oc/mayr/reaktionsdatenbank/fe/ ; https://pubs.rsc.org/en/content/articlelanding/2025/ob/d5ob00686d
- UNIFAC 2.0: https://arxiv.org/pdf/2408.05220 ; Modified UNIFAC 2.0: https://arxiv.org/abs/2412.12962 ; `thermo`: https://github.com/CalebBell/thermo
- COSMO-SAC: https://www.nist.gov/publications/benchmark-open-source-implementation-cosmo-sac ; openCOSMO-RS: https://github.com/TUHH-TVT/openCOSMO-RS_py ; CHAOS: https://arxiv.org/abs/2511.19002
- UFZ-LSER: http://www.ufz.de/lserd ; PHREEQC databases: https://github.com/usgs-coupled/phreeqc3/tree/master/database
- Critical properties ML: https://dspace.mit.edu/handle/1721.1/151176 ; ugropy: https://github.com/ipqa-research/ugropy
- UV/Vis: https://www.nature.com/articles/s41597-020-00634-8 (Joung) ; https://www.nature.com/articles/s41597-019-0306-0 (Beard) ; https://zenodo.org/records/5573027 (Greenman)
- PubChemQC: https://arxiv.org/abs/2305.18454 ; NIST ASD: https://physics.nist.gov/cgi-bin/ASD/lines1.pl ; refractiveindex.info: https://github.com/polyanskiy/refractiveindex.info-database
- ThermoG3/CBS: https://link.springer.com/article/10.1186/s13321-024-00895-0
- BigSolDB 2.2: https://zenodo.org/records/22648301 ; AqSolDB: https://doi.org/10.7910/DVN/OVHAW8 ; SolProp: https://github.com/fhvermei/SolProp_ML , https://www.nature.com/articles/s41467-025-62717-7
- pKahub: http://pkahub.ttk.hu/ , https://github.com/keserulab/pkahub , JCIM 2026 benchmark https://pubs.acs.org/jcisd8/article/66/8/4607/5146194 ; iBonD: http://ibond.nankai.edu.cn ; Uni-pKa: https://github.com/dptech-corp/Uni-pKa
- Alexandria: https://alexandria.icams.rub.de/
