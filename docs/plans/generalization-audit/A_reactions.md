# Audit A: reaction selection, product determination and cascades

Scope: how the bench engine decides **which reactions happen**, **what the products are**, and **what happens next**.
Verified against the working tree on 2026-10-01 (uncommitted changes included). The built WASM in
`web/src/wasm/engine/` (21:50:09) is newer than every `engine/src/*.rs` file (latest 21:45:12), so the probes exercise
the current code. `cargo test` in `engine/`: 89 tests, all pass.

Severity: **B** = blocks or gives wrong results, **D** = degrades generality or accuracy, **C** = cosmetic.

---

## 1. Inventory of the current mechanisms

### 1.1 Where reactions come from

There are six independent ways a reaction can happen. Each has its own data and its own way of matching species.

| # | Mechanism | Code | What decides that it happens | Data and coverage | Model | Valid domain |
|---|---|---|---|---|---|---|
| R1 | Hand-written equilibria | `chem_db.rs:274-470` (15 records) + `data/solubility.json` `equilibria` (17) = **32** | All listed species present (the coupled solve needs all of them > 1e-30 mol, `vessel_eq.rs:394-405`). Matched by **exact species-id string** | 4 acid/base (water, acetic, carbonic ×2), NH3, 6 complexes (Cu(NH3)4, Ag(NH3)2, FeSCN, CoCl4, I3-, starch-I3), 4 indicator pseudo-species, 17 table acids (HF, HCN, HNO2, HClO, HCOOH, H2S ×2, H2SO3 ×2, HSO4-, H3PO4 ×3, oxalic ×2, chromate ×2) | log K298 + constant ΔH van 't Hoff (`vessel_eq.rs:143-147`, `196-198`, `414-415`). Ideal concentrations. `H2O` is removed from every equilibrium (`vessel_eq.rs:211, 216, 397, 403`) | Water, dilute, near 25 °C |
| R2 | Minerals (precipitation and dissolution) | table: 128 rows in `solubility.json` + 5 in `chem_db.rs:472-568`; `auto_minerals` `vessel_ext.rs:190-222`; `mineral_for_pair` `solubility.rs:150-168` | Any **monatomic cation** (`is_simple_cation`, `vessel_ext.rs:426`: 45 elements with fixed charge lists, plus NH4+ and Hg2+2) meets any of the **48 anions** in `ions.rs:188-235`. If the pair is in the table, use its Ksp. Otherwise, if the hand-coded **solubility rules** (`solubility.rs:81-103`) say "insoluble", invent log Ksp = −(4 + 2·zc·za) (`solubility.rs:165`) | 92 of 128 table rows have ΔH = 0. Rule-based minerals: ΔH = 0, density M/38 (`:130`), colour from a 9-cation and 6-anion hue table (`ions.rs:473-500`), particle size and morphology chosen by anion | IAP = Ksp with ideal activities. Only binary 1-cation/1-anion solids. Only when water is present (`has_water`, `vessel_eq.rs:120`) | Water, 25 °C ± van 't Hoff, binary salts |
| R3 | Hand-written kinetics | `chem_db.rs:570-683` (**6**): NaHCO3+vinegar, H2O2/MnO2, persulfate+I-, I2+thiosulfate, Mg+H+, ethanol combustion | All reactants present (exact id). Catalyst present (exact id) | Arrhenius A, n, Ea, per-reaction ΔH | Explicit Euler, forward only. Order = min(coeff, 1) (`vessel.rs:724`). A solid catalyst *replaces* k by `0.08·clamp(100·n, 0.5, 10)` (`vessel.rs:701`). Solid reactant rate ∝ n^0.67 | The six demo reactions |
| R4 | M6 network generator | `network_generator.rs` (whole file), run by `Vessel::update_network` (`vessel.rs:340-374`), called **only** from `settle_after_addition` (`vessel.rs:444`) | **Substring tests on the species id**: tautomerism if the id contains "CO", "CHO" or "one" (`:230`); SN2/E2 if the id contains C and Cl/Br/I and is not in a 13-entry exclusion list (`:322-326`) and the partner contains "OH", "O-", "NH3", "oxide", "amine" or "BuO" (`:327`); ester if the id contains "acetate", "benzoate", "ester", "EtOAc" (`:399`); alkene if it contains "ene" (`:435`); Mayr if the id contains `nuc_*` / `el_*` (`:287`) | 45 family records in `templates.rs:162-885` (only **7 are reachable**: tautomerism, sn1_solvolysis, sn2_secondary_halide, e2_elimination, acid/base ester hydrolysis, alkene_bromination). Mayr: 15 nucleophiles + 11 electrophiles (`templates.rs:888-949`), keyed `nuc_*`/`el_*`, never matched by real ids | Family-level A, Ea, ΔH, ΔS. k computed once at generation T and stored with `arrhenius_ea: 0` (`vessel.rs:362`). pH catalysis uses pOH = 14 − pH (`:501, 506`) | None in practice (see A3) |
| R5 | Special-cased physics that act as reactions | CO2 degassing `vessel.rs:649-674`; ethanol flame `vessel.rs:797-826`; water and ethanol boiling `vessel.rs:860-912` | Literal ids `"CO2(aq)"`, `"C2H5OH"`, `"H2O"` | CO2 Henry constant only; ethanol 0.789 g/mL, 1367 kJ/mol, ignition at T ≥ 286 K | Per-compound code | Those compounds |
| R6 | Inert-compound physics | `vessel_phase.rs` (melt/boil/dissolve) | The compound is `phase_model: "inert"` | `CompoundThermo` from the import | Clausius–Clapeyron, Clapeyron, solubility limit (default **0.1 g/L** when unknown, `compound_thermo.rs:468`) | Physical only, no chemistry by design |

Runtime additions: `register_reaction`, `register_equilibrium`, `register_mineral` (lib.rs:447-485) accept new records of
the same shapes (same limits). `resolve_mineral` replaces a guessed Ksp with a PubChem solubility.

### 1.2 How species are recognised

| Question | How it is answered today | Where |
|---|---|---|
| Is it an acid? | The formula decomposes into only H+ and exactly one anion from the 48-entry table. Weak if the anion's `acid` parent appears as a reactant in some equilibrium, otherwise **strong** | `ions.rs:418-424`, `compound_model.rs:154-185` |
| Is it a base? | The decomposition contains OH- | `compound_model.rs:236` |
| Is it a salt? | The formula decomposes into table cations and anions (≤ 3 anion kinds, depth 2). For carbon compounds the SMILES must contain '.', '+' or '-' | `ions.rs:394-416`, `compound_model.rs:231-232` |
| Is it a known molecule? | Its element multiset equals that of a neutral species used by some equilibrium or kinetic record. Structure is checked only for `C2H5OH` and `CH3COOH`, by **SMILES substring** ("CCO", "CC(=O)O") or name | `compound_model.rs:124-146, 248-266` |
| Otherwise | "inert": a real engine species `Hill(s|l)` or dissolved `Hill`, with no chemistry | `compound_model.rs:268` |
| Unmodelable | Only unparseable formulas or unknown elements | `compound_model.rs:203-210, 357-361` |
| Species identity in the vessel | Formula-like id string. Imports use the Hill formula. Phase is a suffix "(s)/(l)/(g)/(aq)". Charge is a suffix. InChIKey is **not sent** to the engine (`web/src/main.ts:119-140`) | `ions.rs:112-140` |

Probe P1 (34 imports, §5): classification results.

| Import | Engine kind | Real chemistry |
|---|---|---|
| Methyl formate (C2H4O2, `COC=O`) | **acid → CH3COOH** | ester, neutral |
| Glycolaldehyde (C2H4O2) | **acid → CH3COOH** | neutral |
| Citric acid | acid, **fully dissociated** (3 H+ + C6H5O7-3) | weak, pKa 3.1/4.8/6.4 |
| Benzoic acid, phenol, boric acid | inert | weak acids |
| Sodium benzoate | inert solid | ionic salt |
| Zn, Fe, Na metal | inert, and they dissolve as neutral "Zn"/"Fe"/"Na" up to the 0.1 g/L default | react with acid or water |
| Mg metal | molecule `Mg(s)` (it happens to be in the Mg kinetics) | reacts |
| CuO, CaO, Ag2O, CaC2, NaH | inert | basic oxides, hydrolysing |
| KMnO4, FeSO4, NaClO, Na2S, Na2SO3, NH4Cl, K4Fe(CN)6 | salts (ions) | salts |
| Cl2 | inert, dosed as a 0.1 M solution | oxidant |
| Ethyl acetate, bromoethane, cyclohexene | inert neat liquids | reactive organics |
| Urea vs ammonium cyanate (both CH4N2O) | inert vs salt (correctly distinguished, by the SMILES charge rule) | |

### 1.3 Cascades: what happens after a product forms

| Path | Re-evaluated when | Consequence |
|---|---|---|
| Equilibria (R1) | Every `step` and after every dose | A product of kinetics that is in some equilibrium speciates at once (e.g. I2 → I3-, probe P4) |
| Minerals (R2) | `auto_minerals()` runs at the start of every `step_equilibria` (`vessel_eq.rs:117`) | Any new cation/anion pair (e.g. Mg+2 from Mg + acid, then OH-) can precipitate. This is the only truly general cascade |
| Kinetics (R3) | Fixed list. Every step | No discovery |
| Network generator (R4) | **Only after a user addition** (`vessel.rs:444`) | Products of kinetics or equilibria are not expanded until the next dose. Generated species get a fake seed concentration `max(flux·0.1, 1e-6)` (`network_generator.rs:134`), and the generated reactions are appended permanently (never pruned) |
| Gas products | Vented immediately (open) or stored in the headspace (sealed) | They never react again: no H2 + O2, no gas-phase chemistry, no re-dissolution except CO2 |
| Caps | 200 species / 500 reactions in the generator | `cap_reached` is dropped by `update_network` (not reported). Event list capped at 80 |

### 1.4 Products' data

| Product kind | Identity | Thermo | Phase | Colour | Source of data |
|---|---|---|---|---|---|
| Precipitate (table pair) | `formula(s)` from table | Ksp298 + ΔH (ΔH = 0 for 92/128) | solid by construction | table sRGB | CRC-style table (`pipeline/data/solubility_products.csv`) |
| Precipitate (rule pair) | `formula(s)` built from charges | rule Ksp, ΔH = 0 | solid | 15-entry hue table | PubChem lookup later (`mineral_resolver.ts`) replaces Ksp, colour, density, name |
| Complex / acid-base species | hand-listed ids only | per-reaction logK/ΔH | aqueous | `spectra.rs` static table | hand-written |
| Kinetic products | hand-listed | per-reaction ΔH | suffix | `spectra.rs` | hand-written |
| Gas products | `X(g)` | `get_species_thermo` (60-entry match) or fallback **ΔfH −100 kJ/mol, Cp 50** (`chem_db.rs:262-270`) | gas, vented | – | hand-written |
| Generated organics | `"<id>_subst"`, `"<id>_alkene"`, `"<id>_enol"`, `"MayrAdduct_…"`, `"<id>_acid"` | fallback (mass parsed from the id prefix, wrong) | aqueous by default | none | **none** |

`delta_h_f` and `cp` from `get_species_thermo` are **never read** by the engine (grep: only `.mw` is used). The ΔfH that
the web layer now obtains from the NIST proxy (`web/src/pubchem/api.ts:146-149`) is stored in `phys.dhf_kj_mol` but not
sent to the engine (`main.ts:119-140` has no `dhf` field), and `CompoundThermo`'s Hess ΔfH is only displayed.

### 1.5 Compound literals in logic (outside data tables)

Lines containing a species literal (`"H2O"`, `"H2O(g)"`, `"C2H5OH"`, `"CO2…"`, `"H+"`, `"OH-"`, `"O2…"`, `"H2(g)"`, halides,
carbonates, `"NH3"`, `"Mg(s)"`, …), excluding comments:

| File | Lines with literals | Notes |
|---|---|---|
| vessel.rs | 24 | 11 × `"C2H5OH"` (organic layer, flame, boiling), water boiling, CO2 degassing |
| solubility.rs | 14 | solubility rules by cation/anion id |
| spectra.rs | 13 | colour tables (out of scope here) |
| compound_model.rs | 12 | `"H+"`, `"OH-"`, `"C2H5OH"`/`"CH3COOH"` SMILES checks |
| network_generator.rs | 8 | `"H2O"`, `"OH-"`, `"NaOH"`, `"Br2"`… plus the halide exclusion list |
| gas.rs | 5 | water Antoine, CO2 |
| lib.rs | 5 | |
| vessel_eq.rs | 5 | `"H2O"` dropped from all equilibria |
| vessel_ext.rs | 4 | `"H2O(g)"`, `"H+"`/`"OH-"` in event logic |
| vessel_phase.rs | 3 | `"H2O"` as the only solvent |
| ions.rs | (tables) | ion tables are data, acceptable |

---

## 2. Status of prior findings in this area (F items)

| F | Topic | Claimed | Current status | Evidence |
|---|---|---|---|---|
| F1 | Network generator invents chemistry for ions | fixed | **Partially fixed, still B.** A 13-id exclusion list was added to `is_halide` (`network_generator.rs:322-326`). Everything else is unchanged: substring matching, formula-less products, tautomerism on any id containing "CO" | Probe P3: 29 of 406 catalog pairs still create formula-less species: `CH3COOH_enol` (22 pairs, even vinegar alone), `CO2(aq)_enol`, `CO3-2_enol`, `HCO3-_enol`, `CH3COO-_enol`, `Co4-2_subst` (CoCl4-2 + ethanol). Probe P2: AgCl + NH3 generates `sn2_AgCl(s)_OH-` and `sn2_AgCl(s)_NH3` and the species `Ag(s)_subst` (the exclusion list has `"AgCl"` but solids are `"AgCl(s)"`). Any id with "Cl" contains the letter C, so the `contains('C')` test is meaningless |
| F2 | Conservation is fake | fixed | **Partially fixed, D.** A real element sum now exists (`vessel.rs:1114-1145`). But: the baseline is reset after every dose (`record_elements_added`, `vessel.rs:419, 467, 1306`); vented gas counts as an error (NaHCO3 + HCl: `ok:false`, err 0.93, a false alarm); a 5 % tolerance hides real losses (neutralisation loses its water, 0.9 %, `ok:true`); `energy_rel_err` is still the constant 1.5e-5; a zero error is reported as 1.2e-6; formula-less species are silently skipped | Probes P2, P4, P5 |
| F9 | Per-reaction logK + constant ΔH, species ΔfH never read | – | **Open, B** | `vessel_eq.rs:143-147, 196-198, 414-415`; `delta_h_f` unread |
| F10 | Kinetics forward only, order = min(coeff, 1) | – | **Open, B** | `vessel.rs:676-795`: no reverse term, `is_reversible`/`k_eq_298` unused, `:724` |
| F11 | Combustion only for ethanol, no O2 needed | – | **Open, B** | Probe P2: 10 mL ethanol + igniter burns completely with no O2 in the model; the `ethanol_combustion` kinetic record needs species `"O2"`, which never exists |
| F15 | Identity by element multiset | fixed | **Superficial, B.** Only the "molecule" branch got a SMILES-substring check for two ids (`compound_model.rs:248-266`). The **acid branch runs first** and bypasses it | Probe P1: methyl formate and glycolaldehyde are both modelled as acetic acid (0.1 M methyl formate gives pH 2.88). The web's `catalogMatchFor` also matches by formula key (`reagent_library.ts:139-143`) and offers vinegar as "Also in stock" for methyl formate |
| F16 | Phase stamped at import; non-solids become 0.1 M solutions | partly | **Partially fixed, D.** Inert compounds now get a derived phase and dose neat. Acids, bases, salts and known molecules that are liquid or gas at room T still become **0.10 M aqueous solutions** (`compound_model.rs:226, 338-346`) | Probe P1: H2SO4 and HNO3 become 0.1 M; Cl2 becomes a 0.1 M solution |
| F18 | No decomposition on heating | – | **Open, B** | Probe P2: 5 g NaHCO3 heated to 887 K stays NaHCO3 |
| F20 | 32 hand-written equilibria; no hydroxo/chloro complexes | – | **Open, D (B for amphoteric metals)** | Probe P2: AlCl3 + excess NaOH keeps Al(OH)3 at pH 13.8 (no Al(OH)4-). FeCl3 alone still precipitates Fe(OH)3 |
| F21 | 6 hand-written kinetic reactions; only Mg reacts with acid | – | **Open, B**, and two of the six are **not atom-balanced** (new, A1) | Probes P2, P4 |
| F22 | Catalyst replaces k (T-independent) | – | **Open, D** | `vessel.rs:697-702` |
| F23 | Families with family-level ΔH/ΔS; Mayr never matches; generated k frozen | – | **Open, B** | Probe P6: the generated SN2 rate constant is identical at 298 K and 323 K (4.80e-7 vs 4.80e-7; Arrhenius would give ×14). Mayr keys `nuc_*` never occur in ids |
| F24 | No electrochemistry / redox | – | **Open, B.** No E°, no ΔG-driven electron transfer anywhere (grep) | Probe P2: Zn + HCl, Fe + CuSO4, FeSO4 + KMnO4, Cl2 + KI, Na + water: no reaction |
| F25 | No photochemistry | – | Open, B (not probed) | – |
| F27 | Solubility rules, rule Ksp, 3 mol/L cap, ΔH = 0 | – | **Open, D** | `solubility.rs:81-103, 165, 178`. Probe P2: AgOH (not Ag2O) forms, labelled "brown"; Prussian blue `Fe4(FeC6N6)3` is labelled **orange** |
| F32 | Caps reached silently | – | **Open, D** | `update_network` drops `cap_reached` |
| F33 | No runtime species/thermo registration | – | **Open, B.** `CompoundThermo` registration exists for inert compounds only; no ΔfG/E°/template ingestion | `lib.rs` |
| F44 | pOH = 14 − pH, fixed k_acid/k_base | – | **Open, D** | `network_generator.rs:497-510`; `templates.rs:136-158` |
| F45 | Server barrier workflow unused by the bench | – | **Open, D** | `NetworkGeneratorConfig::default()` always has empty `precomputed_barriers` |
| F47 | Morphology stored per compound | – | Open, C | `solubility.rs:115-122, 141` |

F3, F5, F6, F8, F13, F17, F28 belong to other areas. Note for F5: the "fix" is a second hard-coded clamp for ethanol
(351.5 K, 38.56 kJ/mol, `vessel.rs:888-912`), not a general boiling model.

---

## 3. New findings

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| A1 | **B** | **Two of the six hand-written kinetic reactions create atoms.** The `reactants` map is used both as the rate order and as stoichiometry: `iodine_clock_slow` consumes 1 I- but produces I2 (`chem_db.rs:610`). `h2o2_decomposition` consumes 1 H2O2 but produces 2 H2O + 1 O2 (`chem_db.rs:593`). The conservation check does flag the iodine clock but labels gas venting the same way, so it cannot be told apart | Probe P4: persulfate + KI (no thiosulfate), 300 s: **I atoms ×1.289**, `ok:false`. H2O2/MnO2: O2 vented = 1.76e-2 mol for 1.76e-2 mol H2O2 decomposed (should be 0.5×). H atoms rise from 2.2152 to 2.2504 mol |
| A2 | **B** | **Water is never produced or consumed by equilibria.** `"H2O"` is dropped from every equilibrium (`vessel_eq.rs:211, 216, 397, 403`), so neutralisation, dichromate formation, hydrolysis and condensation do not change the water amount, and liquid volume = n(H2O)·18 | Probe P5: 0.02 mol HCl + 0.02 mol NaOH, water 2.18000 → 2.18000 mol (expected +0.020). For neat or concentrated reagents this is a large mass and volume error |
| A3 | **B** | **The organic network generator only fires on accidental substrings of formula ids.** Imports are keyed by Hill formula, so the name-based tests ("acetate", "ester", "tert", "ene", "benzoate") can never match a real import. Only haloalkanes (C plus Cl/Br/I in the id) and anything with "CO" in the id match. Products have no formula (`C2H5_subst`, `C2H5_alkene`). The neat liquid `C2H5Br(l)` and the dissolved `C2H5Br` each get their own SN2/E2 reaction | Probe P2: ethyl acetate + NaOH, nothing happens. Bromoethane + NaOH gives `C2H5_subst`, `C2H5(l)_subst`, `C2H5_alkene`, `C2H5(l)_alkene`. The E2 equation text says "+ BH" but the products map omits it (unbalanced) |
| A4 | **B** | **The weak/strong acid decision is a side effect of which equilibria happen to be hand-listed.** An acid is weak only if its parent id appears in one of 32 equilibria. Every other acid that decomposes into H+ plus a table anion is treated as **fully dissociated**, including polyprotic weak acids. Carboxylic acids whose anion is not in the 48-entry table are inert | Probe P2: 0.1 M citric acid gives pH **0.52** (real ≈ 2.1). Benzoic acid and phenol: inert. Boric acid: inert |
| A5 | **B** | **There is no general redox.** Metals, oxides, hydrides and carbides are "inert" (`decompose_elems` refuses single-element formulas, and O-2, H-, C2-2 are not in the anion table). The only metal reaction is the hand-written Mg + 2H+. Oxidation states are fixed at decomposition time (e.g. Fe+2 vs Fe+3 are unrelated species) | Probe P2: Zn + HCl, Fe + CuSO4, CuO + H2SO4, CaO + water, Na + water, FeSO4 + KMnO4/H+, Cl2 + KI, NaOCl + HCl (no Cl2): no reaction in any of them |
| A6 | **B** | **Gas evolution exists only for CO2** (Henry step in `step_co2_degassing`), plus the `gas_products` of the 6 kinetic records. H2S, SO2, NH3, Cl2, HCN, NO2 stay dissolved for ever | Probe P2: Na2S + HCl (H2S stays aqueous, pH 0.84); Na2SO3 + HCl (H2SO3, no SO2); NH4Cl + NaOH heated to 47 °C (NH3 stays). No gas fluxes in any |
| A7 | **D** | **Inert compounds with no solubility data dissolve at 0.1 g/L** (`compound_thermo.rs:468`). Metals and oxides therefore appear as dissolved neutral "Zn", "Fe", "Na", "CuO", "CaO" species | Probe P2 species lists |
| A8 | **D** | **Mineral identity is "binary salt of a table cation and a table anion".** No oxides (Ag2O, HgO, Cu2O form instead of hydroxides), no basic/double salts, no hydrates as distinct solids, no solid solutions. Rule-based colour comes from a 9-cation and 6-anion hue table: `I-` tints every iodide yellow (CuI is white, HgI2 red). Fe+3 makes Prussian blue "orange" | Probe P2: `AgOH(s)` "Brown precipitate"; `Fe4(FeC6N6)3(s)` "Orange precipitate" |
| A9 | **D** | **Network expansion runs only on user additions** (`vessel.rs:444`). Products of kinetics or equilibria are not expanded until the next dose. Generated reactions are never removed, and a generated product is seeded at a fake concentration (`flux·0.1 ≥ 1e-6 M`) during generation | Code |
| A10 | **D** | **Complexation and speciation only for ids hand-listed in equilibria.** An imported ligand (EDTA, oxalate with Fe3+, CN- with Ag+, OH- with Zn/Al/Pb, Cl- with Cu/Fe/Hg/Au) forms nothing. The `complex_formed` event (`vessel_ext.rs:340-358`) is generic but has nothing to report | Probe P2 |
| A11 | **D** | **Kinetic double paths.** NaHCO3 + vinegar runs both the irreversible kinetic `baking_soda_vinegar` (HCO3- + CH3COOH → CO2(g) directly) and the equilibria HCO3- + H+ ⇌ CO2(aq) + CO2 degassing. The two disagree on rate and on when the reaction stops | Code `chem_db.rs:572-588` vs `vessel_eq.rs` + `vessel.rs:649` |
| A12 | **D** | **Formation data that now reaches the web is thrown away.** NIST ΔfH (proxy), Hess ΔfH from ΔcH, S° and Cp are stored in `CompoundThermo` or `phys` but no reaction uses them. `get_species_thermo` ΔfH/Cp (60 entries) is also unread. The fallback ΔfH −100 kJ/mol and Cp 50 still apply to every unlisted species | grep; `main.ts:119-140` |
| A13 | **D** | **Products of a generated or kinetic reaction never become reactants of non-hand-written chemistry**, except as minerals. Gas products are vented and never react (no H2 + O2 or H2 + Cl2; sealed headspace is inert) | Code |
| A14 | **C** | Ids such as `In_phph-2` or `HIn_btb` share prefixes with element symbols (`In` is a cation in `CATION_CHARGES`). They are safe today only because the underscore makes the formula parser fail | `ions.rs:244` |
| A15 | **C** | `"Temperature rose …"` is logged 3-4 times for one exotherm (Mg + HCl, H2O2), and `solid_dissolved` floods the log (already known) | Probe P2 |
| A16 | **D** | The conservation baseline is reset after every dose (see F2), so the audit cannot detect a loss that happens *during* a dose (e.g. the network generator running inside `settle_after_addition`) | `vessel.rs:419, 444, 467` |

---

## 4. Recommendations

### 4.0 Target architecture for reaction selection (one sentence)

Fast chemistry (acid–base, complexation, precipitation and dissolution, gas–liquid partitioning, fast redox couples,
phase changes) is decided by **Gibbs energy minimisation** over a candidate species set built automatically from the
elements present and a large species database. Slow chemistry (covalent bond making and breaking, slow redox,
decomposition, combustion) comes from **reaction rules applied to structures**, whose rates come from rate rules and
whose equilibrium constants come from the same species ΔfG°. A product is a species record exactly like a reactant, so
cascades follow automatically.

### 4.1 Mechanism-by-mechanism replacements

| Current | General replacement | Data needed | Large source(s) | Where no general model exists (least-bad option) |
|---|---|---|---|---|
| R1: 32 hand-written equilibria + R2 rule Ksp + per-pair minerals | **Gibbs energy minimisation (GEM) over a species basis.** Candidate set = every database species whose elements are a subset of the elements present (aqueous, gas, every pure solid and liquid), filtered by phase availability. Reactions are implicit (null space of the element+charge formula matrix). ln K(T) for any reaction = −Σνμ°(T)/RT | Per species: ΔfG°, ΔfH°, S°, Cp(T) (HKF for aqueous ions, NASA/Maier-Kelley for solids and gases). Activity model parameters | **PHREEQC `llnl.dat`** (~1,300 aqueous species incl. hydroxo/chloro/ammine/carbonate complexes, ~1,100 minerals and ~100 gases, logK at 0-300 °C or analytic logK(T)); **SUPCRTBL / slop16** via Reaktoro YAML (ΔfG/ΔfH/S/HKF, ~1,800 species); **Thermoddem**; **NASA CEA `thermo.inp`** (~2,000 gas and condensed species); **Materials Project** (≈150k inorganic solids, DFT ΔfH with MP2020 corrections; S from Kopp/Latimer as Estimated). One converter per source into a single `SpeciesRecord` store | Solid whose ΔfG is in no database: estimate from ions (Latimer / volume-based thermodynamics, Jenkins–Glasser: lattice energy from formula-unit volume, which is intrinsic), labelled Estimated. The 10^−(4+2zz) rule becomes the last, Speculative tier |
| R2 binary-salt identity | Minerals are database phases with any stoichiometry (oxides, basic salts, hydrates, double salts). Precipitation = the GEM saturation index SI = log(IAP/K) > 0 | as above | llnl.dat and Thermoddem contain oxides, hydroxides, basic carbonates, hydrates; MP for anything else | Polymorph and kinetic selection (e.g. aragonite vs calcite, Ag2O vs AgOH): use Ostwald's rule with a nucleation barrier from interfacial energy (γ ≈ estimated from solubility, Nielsen/Söhnel correlation), labelled Estimated |
| Acid/base by "parent appears in an equilibrium" (A4) | Acid–base = GEM over the protonation states of each species. Protonation sites from structure | Reference pKa (intrinsic per the invariant) or ΔfG of each protonation state | **IUPAC digitized pKa** (24,631 rows, CC-BY), PubChem "Dissociation Constants" text, llnl.dat inorganic acids | Organic acids with no measured pKa: an open ML predictor (e.g. pkasolver / MolGpKa) or Hammett/Taft group rules on SMILES, labelled Estimated. Never "strong by default"; the default for an unknown carboxylic acid should be pKa ≈ 4.5 (Estimated), not full dissociation |
| R5 CO2-only degassing (A6) | Gas–liquid partitioning in the GEM: μ°(aq) − μ°(g) gives k_H(T) for every volatile species. Transfer rate = kLa·A·(c − c_sat) | ΔfG°(g), ΔfG°(aq) | llnl.dat and SUPCRT have aqueous and gas forms of NH3, H2S, SO2, Cl2, HCN, CO2, O2, H2, N2, CH4… | Organics with no aqueous ΔfG: Henry constants from the **Sander compilation** (Henry's law constants, ~4,600 species, CC-BY), otherwise estimated as P_sat/(solubility) |
| R3 6 kinetic records, redox absent (A5, F24) | **Redox inside GEM, with kinetic gating per element oxidation state.** Treat each element's oxidation state as a separate component (as PHREEQC does with N(5)/N(−3), S(6)/S(−2), Fe(2)/Fe(3)). Couple two states only if a *labile couple* exists, or through an explicit kinetic step whose rate comes from a rule. The driving force is always ΔrG from ΔfG°, so E° = −ΔG°/nF falls out (Nernst included) | ΔfG° for every oxidation state (in llnl.dat and SUPCRT). A list of fast couples and metals | llnl.dat (has e− half-reactions), SUPCRT. Exchange current densities for metal dissolution: the Trasatti hydrogen-evolution volcano data (~30 metals) | **No general model of redox rates exists.** Least-bad: (1) outer-sphere aqueous couples: Marcus cross relation k12 = √(k11·k22·K12·f) with self-exchange rates k11 (a table of ~100 couples, Bard–Parsons–Jordan / Wherland compilations), labelled Estimated; (2) metal + oxidant: rate = A·i0·exp(αFη/RT) (Butler–Volmer with mixed potential), with i0 from the HER volcano and a passivation flag from Pourbaix (MP Pourbaix data); (3) everything else: a default slow first-order rate labelled Speculative, never "instant". This gives Zn + HCl, Fe + Cu2+, Na + water, KMnO4 + Fe2+ from data, and correctly leaves Cu + HCl and Au + anything inert |
| R5 ethanol flame (F11) | Combustion = gas-phase GEM over C/H/O/N/S species at adiabatic flame conditions (CEA approach), fed by fuel vapour (P_sat) and O2 from the atmosphere. Ignition when P_sat/P > LFL | ΔfH°, Cp(T) of fuels and products; LFL | NASA CEA (products), NIST WebBook/Burcat (fuels), PubChem "Flammable limits"/flash point text | Unknown LFL: Burgess–Wheeler (LFL·ΔcH ≈ constant), ΔcH from Hess with ΔfH (Estimated) |
| Decomposition on heating absent (F18) | It falls out of GEM with condensed phases: NaHCO3(s) → Na2CO3(s) + H2O(g) + CO2(g) once ΔrG(T, P_gas) < 0. The rate is a kinetic step (Arrhenius, solid-state) or heat-transfer limited | ΔfG(T) of solids and gases | NASA CEA condensed, llnl.dat, MP + estimates | Solid-state decomposition kinetics have no general model. Least-bad: rate limited by heat input (enthalpy needed) with an Arrhenius onset from a literature Ea when available; otherwise Speculative onset at the ΔG = 0 temperature + 50 K |
| R4 network generator (F1, F23, A3) | **Atom-mapped reaction templates on structures** (SMARTS via RDKit). Families from **RMG-database kinetics families** (~90 families with rate-rule trees, Evans–Polanyi), polar reactivity from the **Mayr database** (~1,300 N/sN/E entries, keyed by structure, not id), and product thermo from **RMG/Benson group additivity**. Generated product = new species record with SMILES, formula and estimated ΔfG; atom balance is asserted. k(T) is stored as A, n, Ea and reverse k from detailed balance | SMILES for every organic species (already available from PubChem). RDKit | RMG-database (MIT-licensed code, check data licences), Mayr DB, **USPTO-derived template sets** (rdchiral, ~100k templates from the CC0 Lowe USPTO set) for "which product" in bench-type conditions, **Open Reaction Database** (CC BY-SA) for validation | **No general first-principles model for organic selectivity.** Least-bad: RMG rate rules + Mayr; an ML forward predictor only as a labelled Speculative suggestion. The xTB barrier server (F45) can refine a single rate when the user asks |
| Catalysis (F22) | A catalyst species appears in the rate law of an explicit mechanism step; or a surface rate ∝ area × k(T) | Arrhenius A/Ea per catalysed step | NIST kinetics, RMG libraries | Heterogeneous catalysis has no general model; keep per-reaction records (registrable), always Arrhenius |
| Hydrolysis, complexation (A10, F20) | GEM with llnl.dat aqueous complexes | llnl.dat | llnl.dat (~1,300 aqueous species) | Organic ligands not in llnl: NIST SRD 46 critical stability constants (licensed; check), otherwise none |

### 4.2 Database consolidation (few large sources, as the user prefers)

1. **Inorganic and aqueous: PHREEQC `llnl.dat`** (public domain, USGS/LLNL) as the primary bundled thermo store.
   One file covers acids, bases, complexes, minerals, gases and redox half-reactions with logK(T) fits. Use
   **SUPCRTBL** (via Reaktoro's YAML) where HKF parameters are needed beyond 300 °C. Both go through one converter into
   `SpeciesRecord { id: InChIKey/formula+phase, ΔfG°, ΔfH°, S°, Cp(T) or logK(T) fit, tier, source }`.
2. **Gases and condensed pure phases: NASA CEA `thermo.inp`** (public, ~2,000 species), plus Materials Project for
   solids not in CEA or llnl.
3. **Organics: PubChem (identity + SMILES) + RMG thermo libraries / Benson group additivity** (estimates labelled), plus
   NIST WebBook through the existing proxy for measured ΔfH/S/Cp.
4. **Reaction rules: RMG-database kinetics families + Mayr**. These are the only rule sets with rates.
5. **pKa: IUPAC digitized pKa.**

These 5 replace: `chem_db.rs` equilibria/minerals/thermo, `solubility.json`, the solubility rules, the
ion hue tables (colour stays a separate concern), `templates.rs` hard-coded families and the Mayr stub.

### 4.3 Implementation steps

**Step 0: stop the wrong results (small, do first).**
- Fix A1: split `reactants` into `stoich` and `order` in `GeneralKineticRxn` (`chem_db.rs:105-121`). Set
  iodine clock stoich I- = 2 (order 1) and H2O2 stoich 2 (order 1). Add a load-time atom and charge balance assertion
  for every kinetic and equilibrium record (`ions::species_elements`), also for `register_reaction`.
- Fix A2: keep H2O in equilibria as a species with activity 1 for the mass-action term but **conserved in amounts**
  (`vessel_eq.rs:211, 216, 397, 403`: include it in `nu` but not in the ln Q term).
- Disable `update_network` in the bench (`vessel.rs:444`) until the structure-based generator exists, or gate it to
  species that carry a SMILES. This removes F1/A3 junk at once.
- Conservation (F2/A16): baseline = cumulative elements added minus elements vented (track vented gas by element).
  Report `ok:false` at 1e-6 relative. Real energy ledger or remove the field.
- Acids (A4): an acid whose parent has no equilibrium becomes weak with an Estimated pKa (structure-based default)
  rather than strong. Keep "strong" only for a short list of acids known to be strong (HCl, HBr, HI, HNO3, HClO4,
  H2SO4 first proton), and drive even that from pKa data (pKa < 0) once the IUPAC set is loaded.
- Identity (F15): pass `inchi_key` from `main.ts:119-140` into `CompoundRequest`. Match known species by InChIKey (store
  the InChIKey on each built-in species). Never decompose a carbon compound without charges in its SMILES into an acid
  (`compound_model.rs:231-232`).
- Gates: `tests/wasm_e2e.mjs` additions: iodine clock I atoms conserved to 1e-9; H2O2 gives 0.5 O2; HCl + NaOH
  produces 1 H2O; methyl formate is not acetic acid; 0.1 M citric acid pH within 0.2 of 2.1; no species id containing
  `_subst`, `_enol`, `_alkene` after any catalog pair (port probe P3 as a test).

**Step 1: one species store and a GEM equilibrium core.**
- New `engine/src/db/` module: `SpeciesRecord`, a `load_database(json)` wasm export, and a converter script
  `pipeline/build_species_db.py` (llnl.dat + CEA + IUPAC pKa → compact JSON, ~2-4 MB gzipped).
- New `engine/src/gem.rs`: generalise `vessel_eq.rs::solve_coupled_equilibria` (already a Newton solve over extents)
  to (a) build the candidate species set from the elements present, (b) build the reaction basis from the formula-matrix
  null space (SVD/RREF), (c) ln K from μ°(T) of the records, (d) solids as bounded extents (already there), (e) gases as
  a phase with partial pressures. Keep the current activity model (ideal) and add Davies/B-dot behind a trait.
- `auto_minerals` and `mineral_for_pair` become "add every database solid whose elements are present". The rule Ksp
  path stays as the last tier.
- Port the 32 equilibria and 133 minerals into the store as records (converted from logK to μ° of the product),
  labelled with their present source, so nothing is lost.
- Gates: llnl-based PHREEQC comparison on 20 standard solutions (pH, SI within 0.05); AlCl3 + excess NaOH redissolves;
  FeCl3 0.1 M shows no Fe(OH)3 at pH < 2; CuSO4 + NH3 gives Cu(OH)2 then Cu(NH3)4+2; Na2S + HCl evolves H2S; NH4Cl +
  NaOH heated evolves NH3.

**Step 2: redox through oxidation-state components.**
- `SpeciesRecord.ox_states` from the formula (assign by rules: H +1, O −2, alkali +1, …, with the rest by charge balance;
  for organics, from SMILES).
- GEM components = (element, oxidation state) pairs; a `labile_couples` data file (generic per couple, e.g. Fe3+/Fe2+,
  Cu2+/Cu+, I2/I-, Ag+/Ag(s), Hg2+/Hg2+2, Ce4+/Ce3+, MnO4-/MnO4-2) merges the components of fast couples.
- New `engine/src/redox_kinetics.rs`: Marcus cross relation for aqueous couples and a Butler–Volmer mixed-potential
  rate for metals in contact with an oxidant (H+, Cu2+, O2), surface area from the solid's mass and particle size.
- Replace `mg_acid_dissolution` by this path (Mg becomes one row of data).
- Gates: Zn + HCl gives H2 at a rate within an order of magnitude of a lab value; Cu + HCl does nothing; Fe + CuSO4
  deposits Cu; Daniell-type E° from ΔfG within 0.02 V; KMnO4 + Fe2+ in acid decolourises; Na + water gives H2 + OH-.

**Step 3: thermal decomposition, combustion and gas-phase chemistry.**
- A gas phase in the GEM (shared with the phase-transfer work); decomposition = solids leaving the stable set as T rises,
  rate limited by heat input (enthalpy of reaction from ΔfH).
- Combustion: GEM over C/H/O/N/S gas products at the flame, with O2 from the atmosphere and fuel from P_sat.
- Gates: NaHCO3 decomposes between 350 and 450 K at 1 atm P_CO2 ≈ small; CaCO3 above ~1100 K; a flame dies in N2; any
  liquid with a flash point below room T ignites, others do not.

**Step 4: structure-based organic chemistry.**
- RDKit: the Python server already has it; in the browser use RDKit MinimalLib (verify that its JS build supports
  running reactions, otherwise generate on the server with a browser fallback of "no organic chemistry", stated in the
  UI).
- `network_generator.rs` is rewritten to call a template runner on SMILES; families come from a data file converted
  from RMG kinetics families; Mayr parameters keyed by InChIKey.
- Every generated species gets a SMILES, formula, Benson ΔfG estimate and a tier. Generation runs whenever the set of
  species with SMILES changes (not just on dose), with flux-based pruning and the cap reported in the snapshot.
- Gates: ethyl acetate + NaOH gives ethanol + acetate with an atom-balanced equation; bromoethane + NaOH gives
  ethanol (SN2) and ethene (E2) with a T-dependent ratio; generated k follows Arrhenius after generation.

---

## 5. Probes run and results

All probes are under
`/private/tmp/claude-501/-Users-carlliu-reaction-chamber/f26e8c67-1a98-4c46-88a1-a51d179e5f1f/scratchpad/audit/probes/`
and load the built WASM from `web/src/wasm/engine/` (`lib.mjs` is the shared loader).

| Probe | What | Key result |
|---|---|---|
| `p1_imports.mjs` | `import_compound` classification of 34 compounds | Methyl formate and glycolaldehyde → acid CH3COOH. Citric acid → 3 H+ (strong). Benzoic acid, phenol, boric acid, sodium benzoate → inert. Zn, Fe, Na, CuO, CaO, Ag2O, CaC2, NaH → inert. Mg → `Mg(s)` molecule. H2SO4, HNO3, Cl2 → 0.1 M solutions. Urea (inert) vs ammonium cyanate (salt) correct |
| `p2_reactions.mjs` | 27 mixtures stepped 30 s | **Works:** AgCl, PbCl2, Al(OH)3, Cu(NH3)4+2, Ag(NH3)2+, CoCl4-2, Mg + HCl → H2, carbonate + HCl → CO2. **Missing:** Zn + HCl, Fe + CuSO4, CuO + H2SO4, FeSO4 + KMnO4, Cl2 + KI, NaOCl + HCl, CaO + water, Na + water, NaHCO3 at 887 K, ethyl acetate + NaOH, H2S/SO2/NH3 evolution, aluminate. **Wrong:** ethanol burns with no O2; AgOH (not Ag2O); Prussian blue "orange"; citric acid pH 0.52; methyl formate pH 2.88; `Ag(s)_subst`, `C2H5_subst`, `C2H5_alkene`, `CO2(aq)_enol` species. Na2CO3 + HCl reports `ok:false` (err 0.82) mainly because vented CO2 is counted as lost (p4: NaHCO3 + HCl, err 0.93) |
| `p3_junk.mjs` | All 406 pairs of the 28 catalog reagents, 5 s each | 29 pairs create formula-less species: `CH3COOH_enol` (22), `Co4-2_subst` (2), `CO2(aq)_enol` (2), `CO3-2_enol`, `CH3COO-_enol`, `HCO3-_enol` |
| `p4_balance.mjs` | Atom balance of the hand-written kinetics | Iodine clock (no thiosulfate, 300 s): I atoms ×**1.289**, `ok:false`. H2O2/MnO2: 2× the O2 it should give; H atoms +0.035 mol |
| `p5_water.mjs` | Water from neutralisation | 0.02 mol HCl + 0.02 mol NaOH: n(H2O) unchanged (2.18000 → 2.18000). Conservation error 0.9 %, reported `ok:true` |
| `p6_frozen_k.mjs`, `p6b.mjs` | T dependence of generated rates | k depends on the T at dose time (×628 from 280 to 340 K, consistent with Ea 85 kJ) but is then frozen: 4.799e-7 at 298 K and 4.796e-7 after heating to 323 K (Arrhenius ×14.4) |
| `cargo test` (engine) | Full suite | 89 passed, 0 failed |
