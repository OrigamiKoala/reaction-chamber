# Data acquisition plan

Status: 2026-10-06. Companion to `ALGORITHM-IMPROVEMENT.md` section 3 (the open items).

Every open item that is still open is open because the *model* exists or is a few lines of code, and what is missing is
**measured data to put in it or to fit it against**. Today those numbers are recalled from memory (tier `Estimated` or
`Speculative`). This plan says, for each item, **which data, in which shape, goes into which file, how it is checked**, so that
you can find the databases and I can write the parsers and the fits. Nothing here asks you to run anything: you obtain the
files, put them where section 1 says, and tell me; I do the rest.

## 1. How data enters the repository

One pattern for every source, so that nothing is ever typed in by hand again:

```
pipeline/raw/<source>/<original files>        raw download, NOT committed (add the directory to .gitignore)
pipeline/db/parse_<source>.py                  parser (I write it): raw file -> normalised rows, one row per datum
pipeline/data/<table>.csv                      normalised rows that ARE committed when the licence allows (see below)
pipeline/db/build_<target>.py                  generator: normalised rows -> the engine data file (with tier + source per row)
engine/data/<target>.json                      what the engine reads (include_str!, so the WASM is rebuilt)
engine/tests/<gate>.rs                         the numeric gate that proves the data did what it should
```

Rules that apply to every table (they are already the project's invariants, restated for the data):

1. **Intrinsic vs condition-dependent.** Store only intrinsic values (formation enthalpy / Gibbs energy at 298.15 K, S°, Cp
   parametrisation, structure, pKa at a reference state, Ksp at 25 °C with its dH, standard potentials, activity-model
   parameters) or labelled *points on a curve* (a rate constant with its T and ionic strength, a solubility with its T). Never a
   bare "boiling point" or "solubility".
2. **Provenance on every row:** `source` (a citation a person can look up: author, year, table or DOI) and `tier`
   (`Tabulated` = read from a critical compilation, `Imported` = from a database record verbatim, `Estimated` = fitted or
   predicted by us). A recalled number stays `Estimated` until it is checked against its source.
3. **Licence.** The repository must not redistribute data whose licence forbids it. Where a source is not redistributable
   (the existing precedent: NIST SRD 46 stability constants, NIST Webbook tables, NIST EI spectra) the **raw file stays local**
   and only values the licence allows (individual facts with citations, fitted parameters) are committed. Keep a ledger,
   `docs/data-licences.md`: one line per source with its licence and what is committed. *You* decide which sources are
   acceptable; tell me and I will mark each table accordingly. Candidates below are named by publication or database; check
   each licence yourself, I have not.
4. **Units.** kJ/mol, J/(mol K), M, mol/kg, K, Pa, S/m, as in the existing files; the parsers convert and say so in a comment.
5. **Gates before and after.** Each item names an existing or new test. The data is accepted when the gate passes with the
   new file and the previously passing gates still pass. Gates are numeric (error against held-out measurements), not "it runs".
6. **Held-out split.** For anything fitted (X1, V1, A1, P3, T1, O1, H1) set 20-30 % of the rows aside *before* fitting and
   report the error on them separately, as `analytical_nmr.rs` already does for the NMR increments.

## 2. Overview

| Item | What is missing | Target file(s) | Minimum useful size | Needs model work from me |
|---|---|---|---|---|
| X2 | species coverage (Sn, Hg, Ti, V, Mo, W, lanthanides, ...; sulfides, phosphates, silicates; oxo-halogen acids) | `engine/data/species_nbs.json` (new), `pipeline/data/solubility_products.csv`, `ion_interactions.json`, `ion_radii.json` | 800-1500 species | loader line in `db/seed.rs` |
| X1 | self-exchange constants of oxo-transfer couples | `engine/data/redox_couples.json` | 25-40 couples with >= 3 measured rates each | fit script |
| V1 | 13C / 1H shift and EI mass-spectrum validation and refit | increments in `analytical/nmr_shift.rs`, `ms_ei.rs` constants (to be moved to data files) | NMRShiftDB2 (all), 500-2000 EI spectra | validation scripts, data-file move |
| A1 | measured ion-association constants | `engine/data/complexes.json`, `ion_pairing.rs` calibration | 60-100 pairs | calibration fit |
| P3 | Pitzer parameters with T dependence; LLE parameters for hydrocarbons / water | `ion_interactions.json` (`pitzer_binary`), `unifac_vle.json` | ~150 binary + ~40 ternary parameter sets; 30 mutual-solubility curves | T-dependent Pitzer in `activity.rs`; LLE parameter set |
| H1 | measured excess enthalpies; ionic enthalpies | `engine/data/excess_enthalpy.json` | 100-200 binaries | none (ionic part shares P3) |
| P4 | aggregation / restructuring / floc density data | `engine/data/aggregation.json` (new) | 10 materials x (CCC, D_f, restructuring time, floc density law) | move constants of `transfer/settling.rs` to the file; restructuring rate |
| T1 | carbonyl hydration constants; hydration free energies | `engine/data/hydration_groups.json` (refit), `engine/data/carbonyl_hydration.json` (new) | 80 carbonyls; 600+ hydration free energies | Taft correlation in `hydration.rs` |
| O1 | rates of the newest organic templates | `engine/data/reaction_templates.json` (`rate_rules`) | 5-10 measured rates per template | none |
| E5 | ion transfer energies, ion pairing in organic layers, non-aqueous pKa | `engine/data/ion_transfer.json` (new), `pka_nonaqueous.json` (new) | 80 ions x 6 solvents; 150 pKa | ions as flash components (a real model change) |

Items that are **done in code and need no data** (this pass): T7 (glass node), I6 (probe film from the layer's own
properties), X3 (redundant redox candidates), and the vapour part of H1. U1 (browser) is yours.

Suggested order, by how much wrong behaviour each removes per unit of effort: **X2 -> X1 -> A1 -> H1 -> T1 -> P3 -> V1 -> O1 -> P4 -> E5**.
X2 first because every other table is keyed by species ids and half the "inert" behaviour is simply a species the store lacks.

## 3. Item by item

### X2 - species coverage

*Why:* a reagent the store does not hold is modelled as a visual-only or inert compound; ~190 species exist, a general-chemistry
course touches ~1000. The NBS / PHREEQC parsers in `pipeline/db` are stubs or run on a stub bundle.

*Data:* for each species: formula, phase, charge, standard enthalpy and Gibbs energy of formation, S°, Cp(298) (and a Cp(T)
parametrisation where the source has one), density for solids, InChIKey and SMILES for molecules.
Add the aqueous ions and the solids/gases of: Sn, Pb, Hg, Cd, Ti, V, Cr, Mn, Mo, W, Co, Ni, Zn, Ge, Sb, Bi, Se, Te, Ga, In, Tl, Zr,
Nb, Ru, Rh, Pd, Pt, Au, Ir, Os, the lanthanides (Ce, La, Nd, Eu, Gd...), U/Th if wanted; sulfides, phosphates, silicates,
carbonates, borates, arsenates; the oxo-halogen acids and anions (ClO2-, ClO3-, ClO4-, BrO-, BrO3-, IO3-, IO4-, H5IO6).
Plus, per solid, the **solubility product at 25 °C and its dissolution enthalpy** (these become `solubility_products.csv` rows).

*Candidate sources:*
- NBS "Tables of Chemical Thermodynamic Properties" (Wagman et al. 1982) - the standard; check redistribution terms.
- CODATA key values for thermodynamics (Cox, Wagman, Medvedev 1989) for the anchors.
- NIST-JANAF thermochemical tables (gases, Cp(T)).
- PHREEQC databases `llnl.dat`, `phreeqc.dat`, `minteq.v4.dat`, `Thermoddem`, `Thermochimie` (USGS/public or open licences): aqueous species with log K,
  dH and analytical log K(T); minerals with log Ksp - the most direct source of `solubility_products.csv` rows.
- SUPCRT92 / SLOP98 / HKF parameters (aqueous ions at high T and ion volumes; also feeds `ion_volume_v0_cm3_mol`).
- Shannon ionic radii for `ion_radii.json`; Marcus ionic radii and hydration enthalpies for `ion_interactions.json` size parameters.

*Where it goes:*
- `engine/data/species_nbs.json`, same row layout as `species_inorganic.json`: `aq: [id, formula, charge?, dfH, dfG, S, Cp, inchikey?]`,
  `s: [id, formula, dfH, dfG, S, Cp, density]`, `l`, `g` likewise, with a top-level `source` and `tier: "Tabulated"`. Generated by a
  new `pipeline/db/build_engine_species.py` from the parsers; hand-written rows of `species_inorganic.json` stay only for species
  the parsers do not cover (they are *replaced* where a tabulated row exists, never both).
- `pipeline/data/solubility_products.csv` (existing columns: `formula,name,ions,log_ksp,dh_kj,colour,kind,density`) then regenerate
  `engine/data/solubility.json` with `pipeline/build_solubility_table.py`. `colour` and `kind` need a second source (the optics and
  crystal records), blank is acceptable and falls back to the model.
- `engine/data/ion_interactions.json` (`ion_size_angstrom`, `ion_volume_v0_cm3_mol`) and `engine/data/ion_radii.json` for every new ion.
- `engine/data/optics_seed.json` via `pipeline/db/build_optics_seed.py`: band gap (Materials Project is the obvious source) and d-d
  data for new coloured species; without a row the Kubelka-Munk / ligand-field estimator still runs and says `Estimated`.
- Code from me: one `include_str!` and a loader after the seeds in `engine/src/db/seed.rs` (mirrors `species_inorganic.json`).

*Gates:* `equilibrium_rows_agree_with_the_formation_data` (test in `engine/tests`), `engine/tests/store_fuzz.rs` with `FUZZ_N=200`
(charge-balanced mixtures of any store species must keep the element / mass ledgers: new species are exactly what exposes bugs
there, see the eighth and ninth passes), `literal_ban.rs`. Acceptance: every new species has formation data of one consistent
source; a spot check of 30 random rows against the printed table.

### X1 - self-exchange constants of oxo-transfer couples

*Why:* oxo transfer has no measurable self-exchange; each couple needs a rate constant of its own, fitted so that the Marcus cross
relation (`gem/rates.rs`) reproduces measured cross reactions. Five couples have a row (peroxide, persulfate, hypochlorite /
hypobromite, sulfite, nitrite), each fitted to one recalled rate. Fenton chemistry comes out three orders slow; BrO3-, IO3-,
ClO3-, thiosulfate, hydrazine, S(IV) + O2, organic substrates + peroxide are inert.

*Data:* for each couple, **several measured second-order rate constants with different partners**, each with temperature, pH,
ionic strength and the stoichiometry the authors assumed, plus the formal potentials of the couples involved (these come from the
store, not from the rate paper).
Couples wanted: BrO3-/Br-, IO3-/I-, ClO3-/Cl-, ClO2/ClO2-, S2O3-2/S4O6-2, S2O8-2, H2O2 (with Fe2+, I-, Br-, HSO3-, Ce3+, organics),
N2H4, NH2OH, NO2-, HNO2, SO3-2 + O2 (uncatalysed), Cr(VI)/Cr(III), VO2+/VO2+, Mn(VII)/Mn(IV)/Mn(II), Ce(IV)/Ce(III), Fe(VI), As(III)/As(V), Sb, Se(IV).

*Candidate sources:* NIST Solution Kinetics Database (SRD 40; the NDRL/NIST compilation, free web interface), Stanbury's reviews
(Adv. Inorg. Chem. 1989; "Reduction potentials involving inorganic free radicals in aqueous solution"), Sutin's and Marcus-Sutin's
self-exchange compilations (Prog. Inorg. Chem. 1983; Biochim. Biophys. Acta 1985), Bielski and Cabelli for radicals, Buxton et al. 1988
(OH, H, e-aq rate constants), Edwards "Nucleophilic displacement on oxygen in peroxides" (oxo-transfer correlations), Wilkins
"The Study of Kinetics and Mechanism of Reactions of Transition Metal Complexes". Reaxys is the commercial alternative.

*Where it goes:*
- Raw: `pipeline/raw/solution_kinetics/`. Normalised: `pipeline/data/redox_kinetics.csv`, one row per rate:
  `couple_a, couple_b, k_M-1_s-1, T_K, I_M, pH, medium, stoichiometry_note, source, doi`.
- Generator: a fit script (`pipeline/fit_k_self.py`, from me) adjusts each couple's `k_self` to the whole set of its rates with the
  same cross relation as the engine (it imports the Rust function through a small example binary, so there is one implementation),
  writing `engine/data/redox_couples.json` rows: `id, reduced[], oxidised[], n_electrons, E0_V, k_self, tier, source, fit` where
  `fit` now lists the rates used and the residual in log units, `tier: Estimated` (fitted) with `n_points`.
- Couples whose forms differ by electrons only need no row (structure decides, `is_electron_transfer_couple`).

*Gates:* extend `engine/tests/eighth_pass.rs`: (1) held-out rates reproduced within one order of magnitude (the criterion M7 used for
barriers); (2) Fenton `H2O2 + Fe2+` within a factor 3 of 60 M-1 s-1; (3) the inert set stays inert (sulfate, nitrate, perchlorate, O2, N2).

### V1 - NMR and mass-spectrum validation

*Why:* 13C shift error is 4.4 ppm mean (median 2.4) on 421 NMRShiftDB2 molecules, the worst being perfluorinated carbons; the EI model was fitted to 29 recalled spectra and checked on 15, never against a database.

*Data:*
- 13C and 1H shifts with assignment: NMRShiftDB2 (open; `nmrshiftdb2withsignals.sd` - the existing validation script already downloads a
  prefix; take the whole file and 1H too). 19F shifts and J(C-F), J(H-F): Dolbier, *Guide to Fluorine NMR for Organic Chemists*, plus the
  fluorinated entries of NMRShiftDB2; the book values must be typed from the printed tables with citations.
- EI spectra: MassBank (EU) and MoNA (MassBank of North America; the GC-MS EI subsets) are open; the NIST EI library is not redistributable
  and may only be used locally for validation. Needed: 500-2000 EI spectra of compounds with SMILES, peak list (m/z, intensity), 70 eV.

*Where it goes:*
- Validation first, no repository data: `pipeline/validate_spectra.py` already measures 13C; add `pipeline/validate_ms.py` (spectrum
  similarity: base-peak match rate, cosine similarity of the top 20 peaks, per functional-group class) running the Rust example.
- Then refit: the increments are Rust constants in `analytical/nmr_shift.rs`; I move them to `engine/data/nmr_increments.json`
  (alkane / alkene / aromatic / carbonyl classes, substituent alpha-beta-gamma tables, each with `n`, `rms`) and the EI `EiParams`
  to `engine/data/ei_params.json`, both generated by a refit script from the training split.
- Committed: only the fitted parameters and the list of record identifiers used (no spectra) unless the licence allows more.

*Gates:* `analytical_nmr.rs` (13C MAE on a held-out 30 % of NMRShiftDB2 below 3 ppm; 1H below 0.15 ppm; perfluoro carbons below 8 ppm),
`analytical_ms.rs` (base peak right for >= 70 % on held-out EI spectra; cosine >= 0.6 median).

### A1 - ion-association constants

*Why:* the Fuoss model over-pairs (MgSO4: 63 % paired at 0.1 M against ~40 % measured); constants are within 0.4 log units of nothing in particular.

*Data:* log K_A at 25 °C and zero ionic strength (with dH where known) of 60-100 pairs: 2:2 (MgSO4, CaSO4, ZnSO4, CuSO4, CdSO4, MnSO4, NiSO4,
CoSO4), 2:1 and 1:2 (CaCl+, MgOH+, NaSO4-, KSO4-, NaCO3-, CaHCO3+, MgCO3), 3:1 (FeCl2+, AlSO4+, LaSO4+, FeSO4+), and phosphate / carbonate /
oxalate pairs. Also **activity or osmotic coefficient data** of the same salts at 0.01-1 m (to calibrate the contact distance against
activities, as the item suggests, rather than concentrations): Robinson & Stokes, Goldberg (J. Phys. Chem. Ref. Data evaluations of
osmotic coefficients), Pitzer-Mayorga.

*Candidate sources:* Marcus & Hefter, "Ion pairing", Chem. Rev. 106 (2006) 4585 (the compilation); Martell & Smith / NIST SRD 46 (not
redistributable: keep local, commit values with citations only if the licence allows); IUPAC Stability Constants Database (SC-Database,
commercial); `llnl.dat` / `minteq.v4.dat` ion pairs; Millero's seawater ion-pairing papers.

*Where it goes:* `engine/data/complexes.json` (rows exist: `metal, ligand, n, product, log_beta`; add `delta_h_kj` and `ionic_strength_ref`,
`source`, `tier`) and a calibration table `pipeline/data/ion_association.csv` (`cation, anion, log_KA, dH, I, source`) from which a fit of
the Fuoss contact distance per charge type is generated into `engine/data/ion_pairing_params.json` (read by `ion_pairing.rs`).

*Gates:* new `engine/tests/ion_pairing_calibration.rs`: fraction paired of 10 salts at 0.1 m within 8 percentage points of
measured (MgSO4, CaSO4, ZnSO4, CuSO4, NaSO4-, CaHCO3+ ...); the existing tests that read `CuSO4` / `FeSO4` pairs are re-baselined and say so.

### P3 - Pitzer temperature dependence and hydrocarbon / water liquid-liquid parameters

*Data (Pitzer):* binary parameters beta0, beta1, beta2, C_phi (and their temperature functions), theta and psi mixing parameters for
the major ions (Na, K, Mg, Ca, H, NH4, Li, Cl, Br, SO4, NO3, OH, HCO3, CO3, ClO4, phosphates). The PHREEQC distribution's `pitzer.dat`
holds exactly this in the engine's needed form (coefficients of the 6-term temperature function); the Harvie-Moller-Weare and
Moller (1988) parameter sets, Pabalan & Pitzer (1987) and Silvester & Pitzer (1977) are the printed sources; Clegg-Brimblecombe's
E-AIM is a validation oracle (activities at 25 °C and over temperature).

*Data (LLE):* mutual solubilities of water with n-alkanes, cycloalkanes, aromatics, alcohols C4-C8, esters, ketones, chlorinated
solvents, 0-100 °C: IUPAC-NIST Solubility Data Series (Hydrocarbons with Water and Seawater, vols. 37-38; Alcohols with Water, vol. 15),
Tsonopoulos & Wilson (1983), the NIST ThermoML Archive (open; LLE tables from JCED/JCT), Dortmund Data Bank (partly open), and the
published **modified UNIFAC (Dortmund)** interaction parameter tables (Gmehling et al. 1993, 1998, 2002, 2012): the temperature-dependent
form is what fixes hexane-in-water (45x too high today) without making them miscible.

*Where it goes:*
- `engine/data/ion_interactions.json` `pitzer_binary`: extend each entry from `{beta0, beta1, c_phi}` at 25 °C to
  `{beta0: [q1..q6], beta1: [...], c_phi: [...], theta, psi}` plus `T_ref`, `valid_T_range`, `source`. Generated by
  `pipeline/db/parse_pitzer.py` from `pitzer.dat`; `activity.rs` gets the T-function (a few lines I write).
- `engine/data/unifac_vle.json`: add a `modified_unifac` block (`groups`, `a_mn, b_mn, c_mn` per main-group pair, the group
  `R, Q`) and make the LLE flash use it for liquid-liquid splits (the VLE-fitted original table stays for vapour-liquid, which is
  what it was fitted for). Binary exceptions in `lle_overrides: [{a: InChIKey, b: InChIKey, a_mn, b_mn, ...}]`.

*Gates:* new `engine/tests/stage5b_lle.rs`: hexane in water mole fraction within a factor 3 of 1.8e-6 (25 °C) and water in hexane within 30 %;
the mutual solubility of 20 held-out pairs within a factor 3; NaCl, KCl, Na2SO4, MgSO4, CaCl2 osmotic coefficients at 25, 60, 100 °C within 0.01
of the evaluated values (Pitzer-Silvester, Archer); existing `stage5.rs` and `stage3.rs` gates re-baselined with a comment (their relaxed tolerances were set to the old model).

### H1 - excess enthalpies of mixing

*Done in code (this pass):* a vapour leaving a mixture is charged the excess enthalpy the liquid gains or loses (an ideal gas carries none), so the latent heat of a
mixture is the pure value minus the partial excess enthalpy.

*Data still wanted:* measured H^E(x) of binary liquid mixtures near 25 °C, fitted as Redlich-Kister coefficients, for pairs the model currently gets from the
sign-unreliable UNIFAC temperature derivative. Priority pairs: water with methanol, ethanol, 1-propanol, 2-propanol, acetone, acetonitrile, THF, DMSO, DMF, acetic acid,
pyridine, amines; alcohols with alkanes and aromatics; chloroform / acetone; benzene / cyclohexane; alkane / alkane; esters. Also the **ionic** part: apparent
relative molal enthalpies L_phi of aqueous electrolytes versus molality (Parker 1965 NSRDS-NBS 2 for uni-univalent salts; Pitzer's enthalpy
parameters from the same fits as P3 give it for free once the Pitzer T-derivatives are in).

*Candidate sources:* NIST ThermoML Archive (HE tables from JCED/JCT papers, open), Christensen, Hanks, Izatt "Handbook of Heats of Mixing" (book), Dortmund
modified-UNIFAC H^E parameters, DECHEMA Chemistry Data Series (commercial), Gmehling's Dortmund Data Bank (partly open).

*Where it goes:* `engine/data/excess_enthalpy.json` `pairs: [{a, b (InChIKeys), A_J_mol: [A0..Ak], T_K, source, tier, n_points, rms}]` - the schema exists;
the generator `pipeline/db/build_excess_enthalpy.py` fits Redlich-Kister to the digitised points (>= 9 compositions per pair) and records the fit residual.

*Gates:* `open_items_e.rs` / new `ninth_pass.rs` case: heat of mixing of 10 held-out pairs at x = 0.5 within 15 % (or 30 J/mol when small); the energy-audit cases of
`open_items_b.rs::p2_energy_audit_of_closed_vessels` stay within their tolerances for water + ethanol.

### P4 - aggregation and floc restructuring

*Why:* flocs are fractal (D_f 2.3) and never restructure, so a 10 nm AgCl colloid clears in ~15 min where real curds settle in minutes. The constants (D_f, collision
efficiencies, the Kolmogorov cap) live as literals in `transfer/settling.rs` and `vessel_ext.rs`.

*Data:*
- **Critical coagulation concentrations** (Schulze-Hardy) for the common precipitates (AgCl, AgBr, AgI, BaSO4, CaCO3, Fe(OH)3, Al(OH)3, SiO2, TiO2, Fe3O4, S, Au) with
  mono-, di-, trivalent counter-ions, and the zeta potentials / Hamaker constants behind them (Hunter, *Foundations of Colloid Science*; Overbeek's critical
  evaluation; Ohshima; Israelachvili for Hamaker constants; Hamaker constants of many materials from the Lifshitz tables, Bergstrom 1997).
- **Fractal dimension and its change with age**: DLCA 1.7-1.8, RLCA 2.0-2.2, restructured 2.3-2.6 and the time scale of restructuring (Sorensen, Meakin, Lin et al.
  1989 "Universality in colloid aggregation"; Gregory, "Particles in Water"; floc strength / breakage reviews: Jarvis et al. 2005 *Water Research* 39:3121).
- **Floc density versus size** (Tambo & Watanabe 1979, Li & Ganczarczyk 1989, Kranenburg 1994) and **settling velocities of real curds** (analytical-chemistry digestion
  of AgCl, BaSO4: Kolthoff; Walton & Hlavay) for the end-to-end check.

*Where it goes:* new `engine/data/aggregation.json`: per material class (`curds`, `gelatinous hydroxide`, `crystalline`, `metal colloid`) `{D_f_initial, D_f_final,
tau_restructure_s, ccc_mM: {z1, z2, z3}, hamaker_J, floc_density_law: {a, b}, source, tier}`; I move the literals to this file and add the restructuring rate
(`dD_f/dt = (D_f_final - D_f)/tau`) and sweep collection in `transfer/settling.rs`.

*Gates:* new `engine/tests/aggregation.rs`: AgCl formed in 0.1 M NaNO3 clears in 2-10 min (curds), a 10 nm colloid with no electrolyte stays stable for hours, Al(OH)3 gel floc in the
measured range; the existing `precipitate_psd.rs` and `section7.rs` settling gates re-baselined with a comment.

### T1 - aqueous state of neutral solutes: carbonyl hydration and hydration free energies

*Why:* acetone is 5 % hydrated (measured 0.14 %); no aldehyde / ketone distinction (K 0.055 vs 0.05 where 1 vs 0.0014 is measured); formaldehyde 9 vs 2300; secondary alcohols and
ethers off by 0.5-1 kcal/mol.

*Data:*
- Carbonyl hydration equilibrium constants K_hyd = [gem-diol]/[carbonyl] at 25 °C for >= 80 aldehydes and ketones (formaldehyde, acetaldehyde, higher aldehydes, haloacetaldehydes,
  chloral, acetone and substituted ketones, cyclic ketones, alpha-dicarbonyls, glyoxal, pyruvate, trifluoroacetone, hexafluoroacetone): Guthrie, Can. J. Chem. 53 (1975) 898 and 1978
  (the compilation with a Taft-type correlation), Bell, Adv. Phys. Org. Chem. 4 (1966), Wiberg, Morgan & Maltz JACS 116 (1994), Greenzaid, Luz & Samuel (1967), Hine's papers.
- Substituent constants: Taft sigma* and E_s (Newman 1956; Perrin, Dempsey & Serjeant, *pKa Prediction for Organic Acids and Bases*, 1981), Charton steric parameters.
- Hydration free energies of 600+ neutral solutes: FreeSolv (open, 642 compounds with experimental values), the Minnesota Solvation Database MNSol (3037 values), Cabani et al. 1981,
  Abraham & Liszi (open literature).

*Where it goes:*
- `engine/data/carbonyl_hydration.json` (new): `{classes: {aldehyde: {...}, ketone: {...}}, correlation: {a, rho_star, delta_Es, ...}, rows: [{smiles, inchikey, K_hyd, source}]}`;
  `hydration.rs` gets the Taft correlation (my code) and uses a measured row when the species has one.
- `engine/data/hydration_groups.json`: refit of the group contributions on FreeSolv + MNSol (the file already says how: the ignored test `fit_hydration_groups` in
  `tests/open_items_b.rs`; I extend it to read a CSV of `smiles, dG_hyd_kcal_mol, source`).

*Gates:* `open_items_c.rs`/new `ninth_pass.rs`: K_hyd of formaldehyde, acetaldehyde, acetone, chloral, hexafluoroacetone, pyruvic acid within a factor 3 (log within 0.5); hydration free energy
RMS on a held-out 20 % below 1.0 kcal/mol (leave-one-out was 1.13).

### O1 - rates of the newest organic templates

*Why:* Diels-Alder, Friedel-Crafts, organomagnesium, Wittig, aldol, EAS rates are class estimates (tier Estimated / Speculative); organic redox constants Speculative.

*Data:* for each template, **5-10 measured rate constants** across sub-classes (diene and dienophile substituents; arene and electrophile; Grignard and carbonyl; ylide and aldehyde),
with T, solvent, and the activation parameters (A, Ea) where reported. Mayr's reactivity parameters (N, s_N, E; free database, > 1200 nucleophiles and > 300 electrophiles) already
back the polar templates (`data/mayr_parameters.json`); extend that table to every nucleophile / electrophile class the templates use.

*Candidate sources:* the Mayr Database of Reactivity Parameters (Ludwig-Maximilians-Universitat; free), NIST Solution Kinetics Database (SRD 40), Sauer & Sustmann (1980) for
Diels-Alder, Olah (ed.) *Friedel-Crafts and Related Reactions*, Ashby & Laemmle (Grignard), Vedejs & Peterson (Wittig), Reaxys (commercial).

*Where it goes:* `engine/data/reaction_templates.json`: every `rate_rules` entry gains `{A, Ea_kJ_mol, n_points, rms_log10, source}` and its `tier` follows from `n_points`;
`engine/data/mayr_parameters.json` extended. A fit script `pipeline/fit_template_rates.py` (from me) turns a CSV `template, subclass, k, T_K, solvent, source` into the rules.

*Gates:* `engine/tests/stage9.rs` and `open_items_e.rs` families: held-out rate constants within a factor 5 (one order for the fastest / slowest classes).

### E5 - ions in organic layers

*Why:* ions leave the water layer only by a Born-energy difference; there is no ionic equilibrium inside an organic layer (ion-pair extraction, phase-transfer catalysis, strong electrolytes in a non-aqueous layer).

*Data:*
- Standard Gibbs energies of transfer of single ions from water to the common solvents (methanol, ethanol, acetonitrile, DMSO, DMF, acetone, THF, propylene carbonate, nitrobenzene, 1,2-dichloroethane,
  chloroform, hexane / octanol where defined): Marcus, *Ion Solvation* (1985) and *Ions in Solution and their Solvation* (2015), Kalidas / Fawcett / Izutsu for non-aqueous electrochemistry.
- Dissociation constants of electrolytes and ion-pair formation constants in low-permittivity solvents (conductance data): Kraus-Fuoss, Barthel, Izutsu.
- pKa of acids in DMSO (Bordwell table, free online), in acetonitrile (Kutt, Leito and co-workers; free tables), in methanol, in THF; autoprotolysis constants of the solvents; distribution constants of
  common salts and phase-transfer catalysts (Q+ X-) between water and organic layers.

*Where it goes:* `engine/data/ion_transfer.json` (new): `{ion, solvent, dG_tr_kJ_mol, scale (molar / mole fraction), source}`; `engine/data/pka_nonaqueous.json` (new): `{acid_inchikey, solvent, pKa, source}`.
Real model work from me first: ions as components of the phase flash (`phase_flash` / `lle.rs`) with their transfer energies and Fuoss pairing in the layer's permittivity (`dielectric.json` exists).

*Gates:* new `engine/tests/ion_partition.rs`: distribution of 8 salts / catalysts between water and 1,2-dichloroethane and between water and octanol within a factor 10; pKa ladder in DMSO of 15 held-out acids within 1.5 units.

## 4. What I need from you per source

For each database you decide to use, put the raw files under `pipeline/raw/<name>/` and tell me, in one line: the name, the licence you checked, the version/date, and whether the
raw data may be committed or must stay local. I will then (1) write the parser for the format you actually have (I will not guess formats), (2) write the generator and the fit,
(3) run the gate and report the held-out error, (4) update the tier and `source` strings of every row it replaces, and (5) delete the recalled rows it supersedes so that there is one number per datum.

If a database is commercial or cannot be redistributed, the pattern still works: raw files stay local, the fit runs on your machine (or here, if you place the files in the session), and
only the fitted parameters with their citations are committed.
