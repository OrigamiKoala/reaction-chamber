# Audit F_data: data ingestion, identity and provenance

Scope: every path by which compound data enters the engine, checked against the **current working tree** (uncommitted
changes included, 2026-10-01). Line numbers refer to the working tree. Probes live in
`scratchpad/audit/probes/` (section 5); no repo file was modified (Python probes ran on scratch copies so their
SQLite cache and `__pycache__` stayed out of the repo).

Severity: **B** = blocks or gives wrong results, **D** = degrades generality or accuracy, **C** = cosmetic or hygiene.

---

## 1. Inventory of ingestion paths

| # | Path | Entry point | What comes in | Identity key | Cache | Reaches the engine? |
|---|---|---|---|---|---|---|
| P1 | PubChem hand import | `web/src/pubchem/api.ts:203` `importCompound(term)` → PUG REST property row (`record_builder.ts:29`: Title, IUPACName, MolecularFormula, MW, SMILES, InChIKey, Charge) + PUG View | mp, bp (or reduced-pressure bp as a VP point), density, state/colour words, GHS, ΔfusH, ΔvapH (+T), ΔcH, VP points, water solubility (one value) | InChIKey (library dedupe), but the engine gets the **formula** | IndexedDB `compounds` (no TTL; read only for bundle-named compounds, G11) | Yes, through `main.ts:112-140` `modelImported` → worker `IMPORT_COMPOUND` → `lib.rs:417 import_compound` |
| P2 | Static bundle | `api.ts:9 initDataBundle()` fetches `/data/bundle.json` (501 species) | mp/bp/density/solubility/GHS; `phreeqc`, `pka`, `joback_groups`, `colors` sections are never read | name (exact, case-insensitive) or `cid` (`api.ts:95-100`) | none | Indirectly: bundle values **override** PubChem text and are flagged `known` (`record_builder.ts:51-59, 82`) (G1) |
| P3 | Local data proxy | `api.ts:121 enrichWithLocalDataProxy` → `GET /api/data/properties` (`server/main.py:191`) → `data_proxy.py:471 UnifiedPropertyResolver` | core table (11 entries) → NIST WebBook HTML scrape → Wikidata SPARQL → Joback | formula **or** name **or** SMILES **or** CAS (first match wins, `data_proxy.py:491-497`) | SQLite `server/cache/nist_cache.db` (in the repo tree, untracked, no TTL) | Partly: bp/mp (→ VP point), ΔvapH, ΔfusH, Antoine-sampled VP points; S° and Cp coefficients are sent but unused; ΔfH° is collected but never sent (G12) |
| P4 | Proxy fallback | `api.ts:234-259` when PubChem fails and no bundle match | same as P3, with placeholders 20 °C / 100 °C / 1.0 g/mL | `name=term&formula=term` | IndexedDB | Yes |
| P5 | Formed products | engine `solubility::request_lookup` (guessed Ksp) → `take_mineral_lookups` (`lib.rs:487`) → `mineral_resolver.ts` → `solid_fetch.ts:92 fetchSolidDataWith` (fastformula on the Hill formula, ≤3 PUG View records) → `resolve_mineral` (`lib.rs:494`) + `onProduct(record)` | solubility (one g/L value), Ksp text, qualitative words, colour, density, morphology, name; plus a full `SpeciesRecord` | Hill formula + neutral charge | `solid_data.ts` memory + localStorage `rc.solid.v1:` (positives forever, negatives 24 h) | Yes (mineral registry). The product record does **not** go through P3 |
| P6 | Compiled solubility table | `solubility.rs:21-28` `include_str!("../data/solubility.json")` built by `pipeline/build_solubility_table.py` from `pipeline/data/*.csv` | 128 minerals (log Ksp298, ΔH, colour, density, particle µm, kind) + 17 equilibria | solid species id `X(s)` | compiled in | Yes |
| P7 | Hand-written Rust | `chem_db.rs` | 29 `ReagentCatalogEntry` literals (27 catalog reagents + variants), ~70 `SpeciesThermo` match arms (ΔfH, Cp), 15 equilibria, 6 kinetics, 5 minerals; fallback ΔfH −100 kJ/mol, Cp 50 for any other species (`chem_db.rs:258-266`) | species string | compiled in | Yes |
| P8 | Runtime registration | `lib.rs:402 register_compound`, `:447 register_reaction`, `:460 register_equilibrium`, `:473 register_mineral` | catalog entries, kinetics (A, n, Ea, ΔH), equilibria (logK298 + ΔH), minerals (Ksp298, ΔH, colour, density, morphology) | id string | none | Yes (only `import_compound` and `resolve_mineral` are wired from the web) |
| P9 | Pipeline bundle | `pipeline/build_bundle.py` (phreeqc_parser, pka_parser, joback_estimator, curated_colors, species_curation) | see P2 | InChIKey (RDKit) | n/a | Only via P2 |

What `import_compound` accepts (`compound_model.rs:20-75`): formula, SMILES, mw, density, state hint, molarity, GHS,
VP points `[T,P]`, ΔvapH (+T), Tm reference, ΔfusH, ΔcH, water solubility, ΔHsol, S°, Cp(298), Cp coefficients,
linear colour. What it **cannot** take: ΔfH° per phase (only via ΔcH and Hess for CHNOS, `compound_thermo.rs:275,391`),
ΔfG°, phase-specific S°/Cp, NASA/Shomate polynomials, Tc/Pc/ω, solubility curves (T, solvent), pKa / logK, E°,
ε(λ) or band data, refractive index, viscosity, dielectric constant, activity/UNIFAC parameters, Henry constants,
morphology inputs. S° and Cp are stored but unused by the physics (CLAUDE.md agrees).

---

## 2. Status of the relevant audit items and data-sources stages

### 2.1 Generality-audit F items

| ID | Claim in audit | Current status | Evidence |
|---|---|---|---|
| **F15** identity by element multiset | B | **Partly fixed, still open.** `known_neutral_species()` is still keyed by `element_key` (`compound_model.rs:124-147`). The "structure check" is two hard-coded string tests (`C2H5OH`: SMILES contains `CCO`/`OCC` or the name contains "ethanol"; `CH3COOH`: `CC(=O)O`) with `_ => true` for every other species (`compound_model.rs:249-265`). Inert compounds are keyed by Hill formula (`compound_model.rs:235`, `vessel_phase.rs:79`), so isomers overwrite each other. New collisions found outside the engine: proxy core table (G2), `ReagentLibrary.has()` / `catalogMatchFor` (G14) | probes 5.2, code |
| **F19** 27-entry hand-written catalog | D | **Open.** 29 `ReagentCatalogEntry {` literals in `chem_db.rs`, molarity/density at one T. Imports add catalog entries at runtime but they are built from the same per-mL composition model | `grep -c` |
| **F33** registration covers reagents/kinetics/equilibria/minerals only | B | **Partly addressed.** `import_compound` now takes S°, Cp, Cp coefficients, ΔcH, ΔHsol, VP points, ΔvapH, ΔfusH, colour. Still no `register_species` / `load_database`; no ΔfH°/ΔfG° per phase, no Tc/Pc, ε(λ), pKa, E°, activity or transport parameters. `get_species_thermo` (used for energy balances) ignores registered compounds and falls back to ΔfH −100, Cp 50 | `compound_model.rs:20-75`, `chem_db.rs:187-266` |
| **F34** solubility table compiled in | D | **Open.** `solubility.rs:25` `include_str!` unchanged | code |
| **F35** bundle stores mp/bp/ρ as plain properties; PHREEQC/pKa/Joback never reach the engine | D | **Open and worse than described.** Most of the bundle is synthetic (G1). Only `species` is read; `phreeqc`, `pka`, `joback_groups`, `colors` are dead | `api.ts:15`, probe 5.1 |
| **F36** solubility parser keeps only the water value nearest 25 °C | D | **Open.** `solubility_parser.ts:196-207` returns one number; temperature and other solvents discarded; Ksp derived from it as if at 298 K (G15) | code |
| **F37** placeholders mp 20 °C / bp 100 °C / ρ 1 | D | **Partly fixed.** `KnownFlags` + `effectiveThermo` (`parser.ts:184-195`) keep placeholders out of `import_compound`. New leaks: bundle values flagged `known` (G1); proxy fallback record built with 20/100/1.0 (`api.ts:247-249`); estimates and qualifier-laden strings ("decomposes", "sublimes", "greater than") flagged `known` (G9, G10) | probes 5.4 |

### 2.2 `docs/plans/data-sources.md` stages

| Stage | Plan | Actually integrated |
|---|---|---|
| 0 groundwork | align tiers, `PropertyRecord`/`PropertyProvider`, licence registry, show source per value | **Not done.** No `web/src/data/`, no `PropertyRecord`, no `licences.ts`. TS `ProvenanceTier` now has `'imported'`, but Rust serialises PascalCase (`"Tabulated"`) and the snapshot hard-codes `Tabulated` (G13). Values carry no per-field source |
| 1 PHREEQC + SUPCRTBL bundled | parse llnl/minteq/wateq4f + SUPCRTBL; Ksp(T) from ΔG; replace the CRC CSV | **Not done.** `pipeline/phreeqc_parser.py` is still a hand-typed list (11 equilibria, 5 minerals). `pipeline/data/solubility_products.csv` still carries the "CRC Handbook / Lange's" header; 92 of 128 rows have ΔH = 0. Gate check vs llnl (probe 5.3): PbI2 +0.03, BaSO4 0.00, CaCO3 ≈ +0.01 after the HCO3⁻ conversion, Fe(OH)3 ≈ −2.2 (fails), AgCl 0.00 (llnl −9.745); ZnF2 is absent from the engine table |
| 2 NASA CEA thermo.inp bundled | NASA-9 per phase | **Not done.** `CORE_TABULATED_THERMO` (`data_proxy.py:350-455`) is 11 hand-typed entries labelled "NASA CEA / ATcT / SUPCRT / PHREEQC". thermo.inp has ~2111 species blocks, ~815 condensed (probe 5.3) |
| 3 Wikidata browser provider | CC0, SPARQL by InChIKey with unit and phase qualifiers | **Partial, server-side only, and wrong.** `WikidataClient` (`data_proxy.py:288-344`) ignores units and qualifiers (density 790 "g/cm³", bp 173 = °F mixed with 78.29 °C, gas and liquid ΔfH in one list). Its output keys are not read by `api.ts`, so in practice nothing reaches the app (G6) |
| 4 server proxy + NIST WebBook | parse Mask pages into records; per-user cache; 5 s crawl delay; attribution | **Partial and buggy.** Endpoints exist (`main.py:174-215`) and are called from the web. Parser mis-assigns columns (G3); cache poisoning (G4); 1 s rate limit; the cache DB sits in the repo tree and is not git-ignored (G5) |
| 5 real estimators | RDKit SMARTS Joback, Benson, Walden/Trouton/Jenkins–Glasser/Kopp, xTB atomisation | **Partial.** Joback rewritten with SMARTS but it never runs (NameError on the default Python 3.13, no RDKit on 3.14) and its decomposition has errors (G7, G8). Walden/Trouton/Richards estimates exist in the engine (`compound_thermo.rs`, labelled `estimated`). No Benson, Kopp, Jenkins–Glasser or xTB |
| 6 pKa and solvents | PubChem dissociation-constant parser, Wikidata, OPERA | **Not done.** Wikidata `pka` is fetched but unused; `pka_parser.py` is 37 hand-typed rows labelled "IUPAC" that never reach the engine |
| 7 ionic-solid estimates (MP DFT + Jenkins–Glasser) | | **Not done** |
| 8 spectra / colour / kinetics | | **Not done** (colour is still a word → hex mapping, `parser.ts:115-142`) |

---

## 3. New findings

### G1 (B): the data bundle is mostly fabricated, labelled `tabulated`, and it overrides PubChem
- `pipeline/species_curation.py:300-355`: 241 salts with `mp_c = 500 + (c_mw + a_mw) % 300`,
  `bp_c = 1200 + (c_mw + a_mw) % 500`, `density = 2 + (mw % 100)/100`, `solubility: "soluble"` for every pair
  (AgCl, BaSO4 and PbS included), `tier: "tabulated"`, `source: "PHREEQC_Inorganic_Matrix"`. Formulas are tokens
  such as `"Salt_Sodium_bromide"`, `"Ester_C1_Methyl"`, `"AminoAcid_Glycine"`.
- Homologous series (alkenes, alkynes, aldehydes, ketones, esters, halides) use linear formulas, e.g. 1-alkene
  `bp = −103.7 + 25(n−2)`. They are labelled `Joback_Additivity` but were not computed with Joback. Amino acids use
  `bp = mp + 150`.
- Fake CIDs: 384 of 501 entries sit in 40000–95015 (probe 5.1). Only 67 primary entries look hand-curated.
- Typo: magnesium ion `"Mg+"` with charge 2 (`species_curation.py:290`).
- **How it reaches the physics:** `bundleEntryFor` matches an exact name (`api.ts:95-100`). `buildSpeciesRecord`
  then takes mp, bp, density, GHS and solubility from the bundle, sets `known = {mp, bp, density: true}`
  (`record_builder.ts:51-59`) and skips PubChem parsing (`:82`). Importing "Sodium fluoride" would give mp 542 °C
  (PubChem: 993 °C, probe 5.4) and a made-up density.
- `importCompoundByCid` matches `s.cid === cid` (`api.ts:98, 271`). A real PubChem CID in 40001–95015 for a formed
  product is therefore swapped for a fabricated record.
- `web/public/data/conflict_report.json` reports 10 "resolved conflicts" (CRC vs Perry's). These are also authored
  values, not computed ones.

### G2 (B): the proxy's core table matches by formula alone (isomer collisions)
- `data_proxy.py:491-505` takes the first entry whose `formula`, `name`, `smiles` or `cas` matches and **returns
  early**, so NIST, Wikidata and Joback are never asked.
- `api.ts:124-127` always sends `formula`. Probe 5.2:
  - dimethyl ether → ethanol (Tb 351.5 K, ΔfH, Antoine);
  - methyl formate → acetic acid;
  - propanal → acetone.
- In the web, `enrichWithLocalDataProxy` then:
  - adds the wrong compound's Antoine-sampled points to the import's own vapour-pressure points (`api.ts:156-172`);
  - fills ΔvapH and ΔfusH when PubChem had none;
  - can overwrite `rec.tier`.

  This is F15 reintroduced on the data side.

### G3 (B): the NIST WebBook parser mis-assigns table columns
`data_proxy.py:125-235`, live probe 5.2:
- **ΔfusH = T_fus.** Ethanol: `dh_fus_kj_mol = 159.0` (true 4.9). Ethyl acetate: 189.3. The row regex
  `<tr><t[dh]>(.*?)</t[dh]>\s*<td>(.*?)</td` with `re.S` spans the header row into the first data row and takes the
  temperature column.
- **"Antoine" picks up the ΔvapH(T) correlation table.** Ethyl acetate's first block is `A=54.26, B=0.2982,
  C=523.2` (the A, α, β, Tc table). `api.ts:162-166` samples it as `exp(136.45 − 0.6866/(T+523.2))` ≈ 10⁵⁹ Pa.
  `fit_vapor_curve` only checks `P > 0` and finite (`compound_thermo.rs:211`), so the absurd points are fitted.
- **`cp_tabulated`** takes any two-numeric-column table:
  - The cached ethyl butyrate record (`server/cache/nist_cache.db`) has `[270, 41.8], [345, 39.4], [394.6, 35.47]`,
    which are ΔvapH values, mixed with liquid Cp ≈ 228.
  - Ethanol mixes gas Cp with phase-transition rows at 111.4 K.
  - Phases are not separated.
- The first value of each quantity is kept (no evaluation, no median, no uncertainty). ΔvapH has no temperature
  attached. Shomate keeps only the first block (NaCl: the 2500–6000 K gas block). `t_fus_k` can be set to `None` by
  the glossary row "T fus → Fusion (melting) point", which then blocks later rows.

### G4 (D): NIST cache poisoning and junk records
- A formula search returns the multi-hit "Search Results" page. Parsed, it gives `{"name": "Search Results"}`,
  whose `len > 2` is accepted and cached (`data_proxy.py:278-281`; probe: formula `C4H8O2`).
- When the fetch fails, the offline fallback stores the **core table record under the NIST key** (`:266-275`). There
  is no TTL, so it survives after the network returns. The repo's DB already holds `nist:formula:h2o` = the core
  record labelled `"tabulated"/"CODATA Key Values / NASA CEA"`.
- Name lookups fall back to a formula search on a "Not Found" page. The 404 check is a substring test.

### G5 (B for licensing / D): NIST SRD data in the repo tree; crawl delay not respected
- `CACHE_DIR = server/cache` (`data_proxy.py:19-21`). `server/cache/nist_cache.db` exists, is **untracked and not
  in `.gitignore`**. The neighbouring `server/cache/barrier_*.json` files are tracked, so a routine `git add -A` would
  commit NIST SRD 69 data, which data-sources.md §7 forbids redistributing.
- `MIN_INTERVAL_SEC = 1.0` (`:78`) against the 5 s robots.txt crawl delay noted in data-sources.md.
- `CORE_TABULATED_THERMO` hard-codes values attributed to "NIST WebBook" in the source. These are few, and individual
  numeric facts are not copyrightable, but it sets the wrong precedent.
- The `/api/data/*` endpoints have no `verify_token` (`main.py:174-215`), unlike the xTB routes. Low risk on
  127.0.0.1, but any local page can trigger outbound scraping (C).

### G6 (D): Wikidata client ignores units and phase qualifiers; its output is dead
- `data_proxy.py:298-338` reads `wdt:` truthy values without `psv:`/`wikibase:quantityUnit` or P515 (phase).
  Probe 5.2 (ethanol):
  - `density_g_cm3: 790.0` (kg/m³);
  - `bp_c: [78.29, 79.0, 173.0]` (173 is °F);
  - `mp_c` includes −173 (°F);
  - `dhf_kj_mol: [−277.6, −234.8]` and `s_j_mol_k: [160.7, 281.6]` mix liquid and gas.
- The keys it produces (`dhf_kj_mol`, `s_j_mol_k`, `pka`, `mp_c`, `bp_c`, `density_g_cm3`) are never read by
  `api.ts`, which reads `dhf_solid/liquid/gas_kj_mol`, `t_boil_k`, ... So Wikidata currently contributes nothing.

### G7 (B): Joback never runs
- `pipeline/joback_estimator.py:8` imports `Dict, Any, List, Optional` but line 66 annotates with `Tuple`. On the
  default `python3` (3.13.11, which has RDKit 2026.03.1) the import raises `NameError: name 'Tuple' is not defined`.
  On 3.14 the import works (deferred annotations), but RDKit is not installed there.
- `data_proxy.py:532-555` wraps the import in `try/except: pass`, so the failure is silent.
- `pipeline/build_bundle.py:17` imports the same module and would crash on 3.13.
- `tests/test_data_proxy.py::test_resolve_compound_endpoint_with_joback` still passes because live NIST supplies
  `t_boil_k` and ΔfH. The test checks neither Joback nor the network-free path.

### G8 (D): Joback decomposition errors (once it runs)
Probe 5.1, patched scratch copy:
- **37 groups, not 41.** Missing: `=O` (other), `>N-` (ring), `-N=` (non-ring), `-N=` (ring), `=NH`, aromatic N.
- **Unassigned heavy atoms are silently ignored** and a value is returned anyway:
  - pyridine Tb −57 K;
  - DMSO −217 K (S and O unassigned);
  - formaldehyde −38 K (the aldehyde SMARTS needs an explicit `[#6,#1]` neighbour);
  - urea (amide N excluded from `-NH2`, carbonyl counted as `=C<`).
- **sp³ ring CH counted as aromatic `=CH- (ring)`**: `[c,C;R;H1]` is tried before `[CX4H1;R]`. Affects
  methylcyclohexane (+10 K), cyclohexanol (+20 K) and the five ring CHs of glucose.
- Nitrile carbon counted twice (`-CN` + `#C-`, acetonitrile +20 K).
- `cp_coeffs` is returned as a dict `{a,b,c,d}`. `data_proxy.py:548-549` passes it through and `api.ts:173`
  requires `Array.isArray`, so Joback Cp could never reach the engine even if the import worked.
- The `=C< (ring)` Cp coefficients equal the non-ring `=C<` row. Verify against Joback & Reid (1987).
- Results on fully covered molecules are typical Joback quality: acetic acid 0 K, toluene +3, chloroform 0, ethanol −14.

### G9 (B): estimates and borrowed values are promoted to "known data", and provenance is lost
- `api.ts:134-141` writes the proxy's `t_boil_k`/`t_fus_k` into `bp_c`/`mp_c` and sets `known = true`. These can be
  Joback estimates (`data_proxy.py:540-547`) or values from a formula-collided core record (G2).
- `vaporPressurePoints` (`parser.ts:204-213`) then sends Tb as a measured `(Tb, 101325 Pa)` point. The engine's
  `estimated[]` cannot know.
- `rec.tier` is replaced by the server's record-level tier (`api.ts:176-178`).
- There is no per-field source anywhere in `SpeciesRecord`/`PhysicalData`.

### G10 (B): PubChem text parsing errors that reach the physics
Probe 5.4 (live PubChem, real `record_builder.ts`):
- **Ranges parse as negative numbers.** `"122-123 °C"` → −123 °C (`parser.ts:16`). The same happens with `TEMP` in
  `thermo_parser.ts:38`: `"100-102 °C at 10 mm Hg"` becomes a vapour-pressure point at 171 K, which passes
  `sane()` (T ≥ 60 K). The median dampens this, but compounds with few strings are exposed.
- **`isStandardConditions` = "string contains 25"** (`parser.ts:13`). Glucose gets mp 83 °C (the monohydrate
  string mentions "at 25 °C") instead of 146 °C, because only the "standard" pool is used. "125 °C" also counts as
  standard.
- **Qualifiers ignored:**
  - aspirin "284 °F (decomposes)" → bp 140 °C, `known`;
  - caffeine "178 °C (sublimes)" → bp 178 °C;
  - glucose "greater than 212 °F" → bp 100 °C, `known`;
  - glucose "less than 32 °F" (a USCG solution entry) → mp pool.

  All of these become vapour-pressure points or melting points in the engine.
- **No physical consistency checks** (data-sources §4.4). Benzoic acid ΔvapH = 425 kJ/mol (the source string
  "534 KJ/mol at 140 °C, 425 Kj/mol at 249 °C" is itself wrong) is accepted. Trouton's rule gives ~46 kJ/mol, a
  factor of 9 apart.
- Unitless densities ("Relative density (water = 1): 0.79") are dropped. Aspirin, caffeine, naphthalene, glucose
  and NaF end with `density_known = false`.

### G11 (D): the IndexedDB compound cache is effectively write-only
- `getCachedCompound` is consulted only when the bundle already has the name (`api.ts:209-217`). Every other
  re-import repeats two PubChem requests and the proxy call.
- No TTL or schema version (`cache.ts`). Stale records built by older parsers live forever, including proxy-derived
  NIST data with no source tags.

### G12 (D): intrinsic data that is fetched never reaches the physics
- `api.ts:148-155` collapses ΔfH and S° to `solid ?? liquid ?? gas` with **no phase tag**. Gas ΔfH can be used as
  condensed.
- `main.ts:118-140` does not send `dhf_kj_mol`, and `CompoundRequest` has no such field. ΔfH comes only from ΔcH via
  Hess (CHNOS only).
- S° and Cp are stored in `CompoundThermo` but unused.
- `chem_db::get_species_thermo` (`:187-266`) is used for energy and conservation. It has ~70 hand-typed species and
  falls back to ΔfH −100 kJ/mol and Cp 50 J/(mol·K) for every imported, inert or product species, with no tier.
- Indicator pseudo-species use invented values (`HIn_phph` −500 kJ/mol).

### G13 (D): provenance tiers are broken end to end
- `engine/src/types.rs:4-13` has no `#[serde(rename_all)]`, so it serialises `"Tabulated"`, `"UserSet"`. TS expects
  `'tabulated' | ... | 'user-set'` and CSS defines `.tier-tabulated` (`style.css:2091-2116`), so the Details badges
  are unstyled.
- `vessel.rs:1077, 1091` hard-code `ProvenanceTier::Tabulated` for every species row, including rule-guessed
  minerals, inert PubChem imports and products.
- `solubility.rs` writes tiers as lowercase in `take_lookups` (`:284`) but as `{:?}` PascalCase in
  `MineralResolution` (`:424`).
- `record_builder.ts:134` stamps PubChem imports `tier: 'tabulated'`. They should be `'imported'`.
- Stage 0 of data-sources.md is unmet: no value carries `{source, retrieved, tier}`.

### G14 (D): formula-keyed identity in the web layer
- `ReagentLibrary.has(formula, inchiKey)` falls back to `formulaKey` (`reagent_library.ts:76-80`). A formed or
  imported isomer is treated as "already in the library".
- `catalogMatchFor` (`:139-142`) offers "Also in stock: Ethanol" when dimethyl ether is imported (`add_card.ts:142-146`).
- `solid_fetch.ts:39-53` takes the first neutral CID whose formula equals the Hill formula. This is acceptable for
  simple salts but ambiguous for polymorphs, hydrates and any organic product.
- Engine product ids are formula strings (`X(s)`), and inert compounds are Hill ids (F15). Nothing structural links a
  product to a PubChem record except the formula search.

### G15 (D): solubility → Ksp conversion stores a condition-dependent number as intrinsic
`solubility.rs:343-360` (`apply_solubility`, `resolve_mineral`):
- converts one g/L value (whatever temperature PubChem quoted; F36) to `log_ksp_298` with ideal activities;
- ignores hydrolysis and complexation (e.g. Pb²⁺, Fe³⁺);
- keeps the old ΔH, usually 0;
- labels the result `Imported`.

The qualitative USP band → Ksp path is `Estimated`.

### G16 (D): the property-request queue is mineral-specific
- `MineralLookup` (`solubility.rs:200-210`) has the fields cation, anion, n_c, n_a, molar_mass and tier
  speculative/estimated only.
- `SEEN` is per session (`:215`), and the web-side `seen` set (`mineral_resolver.ts`) is per session too. A lookup
  that fails while offline is never retried in that session; `solid_data.ts` keeps negatives for 24 h.
- No request can be raised for ΔfH/S°/Cp, Pˢᵃᵗ, pKa, spectra or Henry constants. The design generalises easily (§4.5).

### G17 (C): the hand-typed Ksp table drifts from PHREEQC
- 128 rows, all sourced "CRC Handbook ..." (130 mentions in `solubility.json`). 92 of 128 have ΔH = 0.
- Comparison with llnl.dat / minteq.v4.dat (probe 5.3; H⁺-based llnl reactions converted with
  pKw = 14, pK(HCO3⁻) = 10.33, pK(HS⁻) = 12.94):
  - PbF2 −2.28;
  - Fe(OH)3 ≈ −2.2 (llnl 5.66 − 42 = −36.3 vs −38.55);
  - MgF2 −0.91;
  - SrSO4 −0.78;
  - Al(OH)3 ≈ +0.74;
  - Mg(OH)2 ≈ +0.45;
  - CaF2 −0.42;
  - Ag2CrO4 −0.36 vs minteq;
  - everything else within 0.3.
- llnl.dat itself has 1327 solution-species reactions and 1215 phases (881 with analytic logK(T), most with
  `-delta_H`). minteq.v4 has 568 phases. Parsing these gives roughly 10× the current coverage, with ΔH.

### G18 (C): duplicated or unused pipeline artefacts
- `phreeqc_parser.py` is hand-typed (11 equilibria, 5 minerals, "source: phreeqc_llnl.dat").
- `pka_parser.py` has 37 hand-typed rows labelled "IUPAC".
- `curated_colors.py` and `joback_groups` ship in the bundle and are never read.
- Two ionic splitters exist: `web/src/pubchem/splitter.ts` (display only, bottle card) and `ions.rs`
  `decompose_ionic` (physics). They can disagree.

### Invariant violations: summary (condition-dependent stored as intrinsic)
- `SpeciesRecord.mp_c/bp_c/density/solubility` are single values at ~1 atm / ~25 °C (bundle, PubChem, proxy).
  Partly mitigated: bp → (Tb, 1 atm) point, mp → `t_melt_ref_k`.
- Solubility → `log_ksp_298` with ideal γ (G15).
- The proxy `CORE_TABULATED_THERMO` stores `t_boil_k`, `t_fus_k`, `log_ksp_298`, `henry_k_h_m_atm` and `pka` as
  plain fields.
- The bundle `solubility: "soluble"` strings.
- `CompoundRequest.molarity` default 0.1 M (from F16; out of scope here).

---

## 4. Recommended architecture

### 4.1 Principles
1. **One record type**, `CompoundRecord`, in Rust (`engine/src/species_store.rs`) and TS (`web/src/data/record.ts`),
   with the same JSON schema. Intrinsic data is per phase; condition-dependent data is stored only as labelled curve
   points. Every `Datum` carries `{value|params, unit (SI), model, T_range, tier, source_id, ref, retrieved,
   uncertainty}`.
2. **Identity first.**
   - Molecules: InChIKey, with canonical SMILES and Hill formula + charge as attributes, never as the key.
   - Ions and solids: `formula + charge + phase (+ polymorph name)`.
   - A mapping table (built offline) links database names (PHREEQC `Calcite`, NASA `CaCO3(cr)`, SUPCRT `Calcite`)
     to these keys.
   - Engine species ids become opaque stable ids (`ik:LFQSCWFLJHTTHZ` / `ion:Ca+2` / `s:CaCO3:calcite`) with the
     formula carried separately for element bookkeeping.
3. **Few large sources.**
   - Bundled, permissive licences:
     - NASA CEA `thermo.inp` (~2100 species, ~815 condensed; NASA-9 H/S/Cp per phase);
     - PHREEQC `llnl.dat` + `minteq.v4.dat` (~1330 aqueous reactions, ~1200 + ~570 phases with logK, ΔH and
       analytic logK(T));
     - SUPCRTBL (HKF ions and minerals; confirm terms first);
     - a Wikidata CC0 extract for the top ~5–10 k PubChem compounds (ΔfH°, S°, Cp, ΔcH, ΔvapH, mp/bp as points,
       vapour-pressure points, density with T, pKa), with units and phase qualifiers normalised at build time.
   - Runtime:
     - PubChem: identity hub, plus text for long-tail compounds;
     - Wikidata SPARQL from the browser (CORS works), for anything outside the extract;
     - NIST WebBook via the local proxy, per-user cache only, opt-in.
4. **Estimators last.** Joback (fixed), Kopp/Neumann, Walden, Trouton, Jenkins–Glasser, later Benson. Always tier
   `Estimated`; they never override a measured value. Each estimate records its inputs.
5. **Consistency gates before acceptance** (data-sources §4.4): ΔG = ΔH − TΔS, Tb reproduced by Pˢᵃᵗ within 3 K,
   ΔvapH/Tb within the Trouton band (60–130 J/(mol·K)), Hess ΔcH vs ΔfH within 5 kJ/mol, Ksp from ΔG vs logK within
   0.5. A failing datum is kept, labelled `rejected` and shown in Details, but it is not used.
6. **Products are reagents.** A product the engine forms emits a property request with its identity. The same
   resolver fills it, and the same `register_species` path delivers it.

### 4.2 Data flow
```
           build time (pipeline/)                              run time (web)
NASA thermo.inp ─┐                                  PubChem (identity: name/CID → InChIKey, SMILES, formula, CAS)
llnl/minteq.dat ─┼─► pipeline/db/build_core.py ─►   │
SUPCRTBL yaml   ─┤   (parse → CompoundRecord,       ▼
Wikidata extract ┘    identity map, consistency)   PropertyResolver (web/src/data/resolver.ts)
                      web/public/data/core.*.json     providers in priority order per kind:
                      (sharded by InChIKey prefix,     core bundle → Wikidata live → PubChem text → NIST proxy → estimators
                       + ions/minerals shard)          merge (§4.3 of data-sources) + consistency gates
                                                      │  CompoundRecord (+ per-datum provenance)
                                                      ▼
engine: register_species(record) / load_database(core shard)  ◄── take_property_requests() (generic queue)
        species_store: per-phase G(T) = H(T) − T·S(T); logK(T) from ΔrG; Pˢᵃᵗ from G_l − G_g; Ksp from G_s − ΣG_ions
        snapshot: each species row carries tier + source_id of the data actually used
```

### 4.3 Record schema (JSON, shared)
```jsonc
{
  "id": "ik:LFQSCWFLJHTTHZ-UHFFFAOYSA-N",          // or "ion:Ca+2", "s:CaCO3:calcite"
  "identity": { "inchikey": "...", "smiles": "CCO", "formula": "C2H6O", "charge": 0, "cas": "64-17-5", "cid": 702,
                "names": ["ethanol"], "db_names": { "nasa": "C2H5OH", "phreeqc": "Ethanol" } },
  "phases": {
    "g":  { "dfH": D, "S": D, "cp": { "model": "nasa9", "ranges": [...] , "tier": ..., "source_id": "nasa-cea" } },
    "l":  { "dfH": D, "S": D, "cp": D, "rho_ref": { "value": 789, "T_K": 293.15, ... } },
    "aq": { "dfG": D, "dfH": D, "S": D, "hkf": {...} }
  },
  "points": [ { "kind": "psat", "T_K": 351.4, "P_Pa": 101325, ... }, { "kind": "solubility", "solvent": "water",
              "T_K": 293.15, "value": 0.0019, "unit": "mol/kg", ... } ],
  "reactions_ref": [ "phreeqc:llnl:Ethanol" ],
  "pka": [ { "value": 15.9, "T_K": 298.15, "I": 0, ... } ],
  "optics": { "bands": [...], "n_D": D },
  "transport": { "eta": { "model": "andrade", ... } },
  "rejected": [ { "datum": D, "reason": "Trouton ratio 814 J/mol/K" } ]
}
```
`D` = `{ "value": -234.95, "unit": "kJ/mol", "tier": "tabulated", "source_id": "atct-1.130", "uncertainty": 0.2 }`.
Licences live in `web/src/data/licences.ts`, which both the pipeline (via JSON export) and the Details attribution
panel read.

### 4.4 Implementation steps (ordered, each shippable)

**Step 0: stop the bleeding (small, do first)**
1. Remove synthetic bundle content:
   - In `species_curation.py`, drop the salt matrix and the formula series (or regenerate them later from the core
     DB).
   - Stop `record_builder.ts:51-59, 82` from letting a bundle entry override PubChem, and never mark it `known`.
   - Remove the CID match in `bundleEntryFor`.
   - Test: importing "sodium fluoride" gives mp ≈ 993 °C.
2. `data_proxy.py`:
   - remove the formula match from the core lookup (InChIKey or CAS only);
   - do not cache non-compound pages ("Search Results") or fallback records under NIST keys;
   - add a TTL;
   - move the cache to a user data dir (`~/.cache/reaction-chamber/` or `platformdirs`);
   - add `server/cache/nist_cache.db` to `.gitignore`;
   - set the rate limit to 5 s;
   - add `verify_token` to `/api/data/*`.
3. Joback:
   - fix the `Tuple` import;
   - return `cp_coefficients` as `[a,b,c,d]`;
   - return `None` when any heavy atom is unassigned;
   - fix the ring sp³ order (`[c;R;H1]` aromatic vs `[CX4H1;R]`) and nitrile double-counting;
   - add the missing groups (=O, ring/non-ring -N=, =NH, aromatic N);
   - add a pytest with ~30 molecules vs literature Tb (|err| < 25 K for 80 %) that also asserts full coverage.
4. NIST parser: parse by table caption and header (ΔfusH, Antoine, Cp per phase), not by row regex; store every row
   with its T and reference. Test with saved HTML fixtures for ethanol, ethyl acetate and NaCl (fixtures stay
   per-user; tests can fetch live and skip offline).
5. `api.ts` enrichment:
   - keep each proxy value as a separate datum with its own source and tier;
   - never set `known` for estimated values;
   - keep the phase of ΔfH/S°;
   - sanity-filter VP points (P ≤ 10 × Pc or 10⁸ Pa, T inside the fit range).

   Engine `fit_vapor_curve` gets an upper P bound.
6. PubChem parsers:
   - treat ranges (`/(\d)\s*[-–]\s*(\d)/` → midpoint);
   - use a real "standard conditions" test (`at 25 °C`, `760 mm`, `1 atm`, or no condition);
   - drop or flag `decomposes|sublimes|greater than|less than|approx` strings (sublimation → a solid-vapour point
     labelled as such);
   - accept unitless relative densities.

   Add Trouton and Walden sanity gates for ΔvapH and ΔfusH. Extend `tests/thermo_parser.mjs` with the live strings
   captured in probe 5.4.
7. Tiers:
   - add `#[serde(rename_all = "kebab-case")]` to `ProvenanceTier`;
   - give snapshot species rows the tier of the data actually used (mineral tier, compound tier, `Estimated` for the
     `get_species_thermo` fallback);
   - make `record_builder` emit `'imported'`.

**Step 1: identity layer**
1. Add `web/src/data/identity.ts`: resolve name/CID → `{inchikey, smiles, formula, charge, cas}` via PubChem, with a
   CAS taken from synonyms.
2. Engine: an `identity` field on `CompoundRequest`. Compounds are keyed by InChIKey when present (stable short id,
   e.g. `C2H6O#LFQSCW`); `element_key` is used only to *suggest* candidates that are then confirmed by InChIKey.
   Replace the hard-coded `C2H5OH`/`CH3COOH` tests (`compound_model.rs:249-265`) with an InChIKey map for the engine's
   built-in neutral species (ethanol, acetic acid, NH3, H2O2, CO2, ...).
3. `ReagentLibrary.has`/`catalogMatchFor`: match on InChIKey first, formula only when the formula has a single
   PubChem isomer.
4. Tests:
   - `engine/tests/identity.rs`: dimethyl ether and methyl formate stay inert and do not collide with ethanol or
     acetic acid; two inert isomers keep separate `CompoundThermo`.
   - `tests/identity.mjs`.

**Step 2: core bundle from large databases (`pipeline/db/`)**
1. `parse_nasa_cea.py`: thermo.inp → per-species, per-phase NASA-9 → `CompoundRecord.phases`.
2. `parse_phreeqc.py`: `SOLUTION_MASTER_SPECIES`, `SOLUTION_SPECIES`, `PHASES` from llnl.dat and minteq.v4.dat, with
   logK, `-delta_H`/`delta_h`, `-analytic`, `-llnl_gamma`. Emits reactions and, where formation data exists,
   back-derived ΔfG° of solids. Handle the PHREEQC keyword set properly: phase names "B", "C", "K" look like section
   headers (probe 5.3 tripped on this).
3. `parse_supcrtbl.py` (after licence confirmation): HKF ions.
4. `build_identity_map.py`: formula/charge/phase ↔ InChIKey via PubChem batch (cached under `pipeline/cache/`, not
   shipped).
5. `wikidata_extract.py`: SPARQL batches with `p:/psv:` + `wikibase:quantityUnit` + P515 phase, unit conversion via
   a small QID→SI table, and point semantics (bp → (T, 101325 Pa) psat point).
6. `build_core.py`: merge with the data-sources §4.3 rules, run the §4.4 gates, emit `web/public/data/core/{ions,
   solids, gases, organics-XX}.json.gz` sharded by InChIKey prefix plus a `manifest.json` (version, sources,
   licences, counts).
7. Replace `build_solubility_table.py` / `solubility_products.csv`. During transition keep the old table only as a
   cross-check test: `tests/core_vs_legacy.py` reports |ΔlogK| > 0.3.
8. Gate (data-sources Stage 1): PbI2, AgCl, BaSO4, CaCO3, Fe(OH)3, ZnF2 within 0.3 log units of llnl, and existing
   precipitation tests unchanged.

**Step 3: engine species store (F33, F34)**
1. New `engine/src/species_store.rs`: a `CompoundRecord` registry with `G(T, phase)`, `H(T)`, `S(T)`, `Cp(T)` from
   NASA-9 / Shomate / HKF / Joback-polynomial / constant-Cp + reference point, in that preference order.
2. wasm functions:
   - `register_species(record_json)`;
   - `load_database(shard_json)`, which replaces `include_str!` (keep a tiny compiled seed for tests);
   - `species_record(id)` for Details.
3. Route `get_species_thermo` through the store, so the −100/50 fallback becomes an explicit `Speculative` datum.
4. Derive logK(T) for registered reactions from ΔrG when all species have data; otherwise use the stored logK +
   ΔH + analytic expression.
5. Derive mineral Ksp from G_s − ΣG_ions when available; otherwise PHREEQC logK.
6. Tests:
   - `engine/tests/species_store.rs`: water Pˢᵃᵗ(373.15) ≈ 101 kPa from NASA G_l/G_g; calcite logKsp(25 °C) ≈ −8.48;
     ethanol boiling within 2 K of 351.4;
   - a schema test that rejects plain mp/bp/solubility fields.

**Step 4: web `PropertyResolver` (`web/src/data/`)**
1. Files:
   - `record.ts` (types);
   - `providers/{core_bundle,wikidata,pubchem_text,nist_proxy,estimators}.ts`;
   - `merge.ts` (tier → median → MAD outlier rule, never average curve parameters);
   - `checks.ts` (§4.4 gates);
   - `licences.ts`.
2. The PubChem text parsers become the `pubchem_text` provider and emit **points**:
   - solubility (T, solvent);
   - VP (T, P);
   - mp and normal bp as points;
   - ΔvapH(T).

   This fixes F36 and F37.
3. Replace `enrichWithLocalDataProxy` and the `importCompound` assembly. The output is a `CompoundRecord` sent via
   `register_species`. `BottleState` keeps only identity, user overrides and the record id.
4. IndexedDB store `propertyRecords` keyed by (provider, key): 90-day TTL for imported data, bundle data versioned.
   Read the cache on every import (G11).

**Step 5: generic property-request queue (G16)**
1. Engine: `take_property_requests() -> [{ species_id, identity: {formula, charge, phase, inchikey?}, kinds:
   ["dfG_s","Ksp","psat","dfH","S","cp","pKa","spectrum"], reason, current_tier }]`, raised whenever the engine falls
   back to an estimate or rule (mineral rule Ksp, ΔfH fallback, no Pˢᵃᵗ curve, colourless default).
2. `resolve_properties(records_json)` takes `CompoundRecord`s, so the mineral-specific `MineralData` /
   `resolve_mineral` become one case of it.
3. Retry policy with exponential backoff instead of per-session `SEEN`.
4. Web: `mineral_resolver.ts` → `property_resolver_loop.ts` using the same `PropertyResolver`. Products are imported
   as reagents through the same path (`formedInLab` stays a flag).
5. Tests: `tests/property_queue.mjs` (mock providers): a guessed PbI2 gets its tabulated Ksp; a product C2H6O formed by
   a template is resolved by InChIKey, not by formula.

**Step 6: provenance in the UI**
1. Snapshot `SpeciesRow` gets `{tier, source_id, estimated_fields[]}`. `ReactionRow.source` points to the record's
   reaction source.
2. Details drawer: per-species "Data" tab listing each datum with tier badge, source and licence attribution,
   retrieved date, and rejected values with reasons.
3. Bottle card: show tier per property instead of one record tier.

**Step 7: estimators as a provider**
1. Fixed Joback (server or a TS port using OpenChemLib/RDKit-JS for in-browser SMARTS).
2. Kopp/Neumann for solid Cp; Jenkins–Glasser for ionic S° from density; Walden/Trouton already in the engine (move
   to the provider, label `Estimated`).
3. Later Benson (RMG group values if licence allows) and xTB atom-equivalent (`Speculative`).

### 4.5 Why this fits the "few large databases" preference
About 4 bundled sources (NASA CEA, PHREEQC llnl+minteq, SUPCRTBL, a Wikidata extract) and 2–3 runtime sources (PubChem,
Wikidata live, optional NIST proxy) replace these scattered pieces:
- the 11-entry `CORE_TABULATED_THERMO`;
- 128 hand-typed Ksp rows;
- ~70 hand-typed `SpeciesThermo` arms;
- the synthetic 501-species bundle;
- 37 hand-typed pKa rows;
- the hand-typed PHREEQC subset.

Each source is parsed by one build script with one test, and every value keeps its source id.

---

## 5. Probes and results

All under `scratchpad/audit/probes/`. Outputs are saved next to the scripts (`*.out`).

### 5.1 `joback_probe.py` (scratch copy of `pipeline/joback_estimator.py` with the `Tuple` import patched)
- Unpatched import on `python3` 3.13.11: `NameError: name 'Tuple' is not defined`. `python3.14`: import OK but
  `ModuleNotFoundError: rdkit`.
- Tb error vs literature (K):

  | Molecule | Error | Note |
  |---|---|---|
  | ethanol | −14 | |
  | acetic acid | 0 | |
  | acetone | −7 | |
  | dimethyl ether | +19 | |
  | benzene | +5 | |
  | toluene | +3 | |
  | benzoic acid | +10 | |
  | naphthalene | −17 | |
  | cyclohexane | +7 | |
  | methylcyclohexane | +10 | ring CH → "=CH- (ring)" |
  | cyclohexanol | +20 | same |
  | pyridine | −57 | N unassigned |
  | DMSO | −217 | S, O unassigned |
  | formaldehyde | −38 | |
  | methyl formate | −2 | |
  | nitrobenzene | +32 | |
  | acetonitrile | +20 | nitrile C double-counted |
  | triethylamine | −13 | |
  | phenol | −16 | |
  | chloroform | 0 | |
  | urea | n/a | 3 atoms unassigned |

- Bundle inspection (inline Python): 501 species; sources: `PHREEQC_Inorganic_Matrix` 241, `Joback_Additivity`
  173, `PubChem_Evaluated` 67, `CRC_Amino_Acids` 20.
- CID buckets: 40000–40999: 40; 50000s: 241; 60000s: 20; 70000s: 29; 80000s: 14; 85000s: 14; 90000s: 15;
  95000s: 11. That is 384 synthetic CIDs.
- Sample: "Sodium fluoride" mp 542.0, bp 1242.0, density 2.42, `tier: tabulated`.

### 5.2 `proxy_probe.py` (scratch copy of `server/data_proxy.py`; cache under `probes/server/cache`)
- `CORE_TABULATED_THERMO` has 11 entries.
- Isomer collisions: dimethyl ether → `{name: ethanol, t_boil_k: 351.5, dhf_gas: −234.8, antoine: 1}`;
  methyl formate → acetic acid; propanal → acetone.
- NIST live:
  - ethanol by CAS: `dh_fus_kj_mol: 159.0` (= T_fus); `cp_tabulated` mixes 37–41 J/(mol·K) gas values with
    3.1–28 J/(mol·K) transition rows.
  - ethyl acetate by InChIKey: `dh_fus_kj_mol: 189.3`; first "Antoine" block `A=54.26 B=0.2982 C=523.2`
    (a_pa = 136.45).
  - formula `C4H8O2`: `{name: "Search Results"}` (cached as a hit).
  - NaCl by name: Shomate first block 2500–6000 K only.
- Wikidata ethanol: `density_g_cm3: 790.0`, `bp_c: [78.29, 79.0, 173.0]`, `mp_c: [−173.0, −114.1, −114.0]`,
  `dhf_kj_mol: [−277.6, −234.8]`, `s_j_mol_k: [160.7, 281.6]`, `pka: 16.0`.
- Repo cache (read-only sqlite3): `nist:cas:105-54-4` (ethyl butyrate with ΔvapH rows inside `cp_tabulated`) and
  `nist:formula:h2o` = the core-table record (poisoned fallback).

### 5.3 `llnl_probe.py` (downloads llnl.dat, minteq.v4.dat, NASA thermo.inp to the probe dir)
- llnl.dat: 1327 SOLUTION_SPECIES reactions, 1215 PHASES (881 with `-analytic`); `-delta_H` present in 2559 lines.
- minteq.v4.dat: 1335 solution species, 568 phases.
- NASA thermo.inp: ~2111 species blocks, ~815 condensed.
- Engine Ksp vs llnl (direct Ksp rows):

  | Mineral | Difference |
  |---|---|
  | CuCl | 0.00 |
  | PbCl2 | +0.07 |
  | PbI2 | +0.03 |
  | PbF2 | −2.28 |
  | Hg2Cl2 | −0.02 |
  | CaF2 | −0.42 |
  | MgF2 | −0.91 |
  | SrF2 | +0.18 |
  | BaSO4 | 0.00 |
  | SrSO4 | −0.78 |
  | CaSO4 | 0.00 |
  | PbSO4 | +0.25 |

- Converted H⁺-based rows: CaCO3 ≈ +0.01, Mg(OH)2 ≈ +0.45, Ca(OH)2 ≈ +0.14, Al(OH)3 ≈ +0.74, Fe(OH)3 ≈ −2.2,
  CuS ≈ −0.33.
- AgCl matches llnl Chlorargyrite −9.7453 (ΔH 65.739). AgBr, AgI and Ag2CrO4 come from minteq (−12.3, −16.08,
  −11.59).

### 5.4 `pubchem_probe.mjs` + `pubchem_strings.mjs` (real `record_builder.ts` bundled with esbuild into `pc.mjs`; live PubChem)

| Compound | Parsed result | Raw string behind it / note |
|---|---|---|
| aspirin | bp 140 °C, known | "284 °F (decomposes)" |
| caffeine | bp 178 °C | "178 °C (sublimes)" |
| benzoic acid | ΔvapH 425 kJ/mol at 522 K | "534 KJ/mol at 140 °C, 425 Kj/mol at 249 °C" |
| glucose | mp 83 °C | the MP 83 °C string mentions "at 25 °C" and wins the standard pool |
| glucose | bp 100 °C, known | "greater than 212 °F" |
| naphthalene | ΔvapH 45.1, VP 4 points, density unknown | fine |
| ethyl acetate | ΔvapH 35.6 at 298 K, 4 VP points | fine |
| NaF | mp 993 °C | PubChem is right; the bundle would override with 542 °C |

Inline node check of the regexes: `"122-123 °C"` → −123 °C; `"78-79 °C"` → −79 °C (both parsers);
`"100-102 °C at 10 mm Hg"` → −102 °C.

### 5.5 Reachability (curl)
NIST WebBook 200 (0.37 s), Wikidata SPARQL 200, PubChem 200, raw.githubusercontent (PHREEQC) 200.
