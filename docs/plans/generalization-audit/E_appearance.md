# E. Appearance audit: how contents and products look, and where the look comes from

Scope: solution colour, solids and precipitates, gases, vapour and fumes, flames, liquid layers, bottle colours, and
reaction-log text. Checked against the current working tree, uncommitted changes included, on 2026-10-01. The probes
ran against the built WASM `web/src/wasm/engine/reaction_chamber_engine_bg.wasm`, which was built at 21:50, after the
newest engine source file (`vessel.rs`, 21:45). No repo file was modified. Probe scripts and their output are in
`scratchpad/audit/probes/` (section 5).

Verdict: the rendering pipeline is physically structured and general. It does spectral Beer–Lambert over 32 bins with
CIE weights, Van de Hulst scattering, bubbles from the engine's gas volume flux, and colour names and event text
derived from data. The data that feeds this pipeline is almost entirely hand-authored and keyed by species id:
- 21 species with absorption bands
- 9 solid-optics entries
- 11 fume species
- 128 solubility rows with a hand-picked colour, kind and particle size
- 15 cation/anion hue rules
- a 12-word colour vocabulary

There is no path from intrinsic data to a solution colour. In particular, every imported compound is colourless when
dissolved. Most condition-dependent visual cues (steam, boiling, condensation, flame, foam, floating) are fixed
thresholds on T or on hard-coded water and ethanol constants.

---------------------------------------------------------------------------------------------------------------------

## 1. Inventory

### 1.1 Solution colour (engine to shader)

| Piece | Where | How it works | Coverage |
|---|---|---|---|
| Band table | `engine/src/spectra.rs:28-82` (`bands()`), list at `:200-224` | Gaussian bands (centre, FWHM, ε at peak), keyed by **exact species id** | **21 ids**: Cu+2, Cu(NH3)4+2, 8 indicator pseudo-species (`HIn_*`/`In_*`), Co+2/Co(H2O)6+2, CoCl4-2, I2(aq), I3-, starch_I3, Fe+3, Fe(SCN)+2, MnO4-, Cr2O7-2, CrO4-2. Hand-entered, unsourced |
| Absorbance | `engine/src/optics.rs:58-84` `absorbance_per_cm` | Σ c·ε(λ) over species found in `bands()` | Only those 21 ids |
| Concentrations | `vessel.rs:1250-1257` `concentrations_m` | *every* `species_mol` entry ÷ **aqueous** volume | Organic and dissolved-inert species are divided by the water volume too |
| Colour weights | `optics.rs:10-44` `RGB_WEIGHTS` (D65, white-balanced) and TS fallback `liquid_shader.ts:47-67` (Wyman CIE fit, equal-energy) | Σ w_i·10^(−A_i·L) | 400–710 nm only. Bands outside it (Cu²⁺ at 800 nm) appear only as tails |
| Layer absorbance | `vessel.rs:973` (aqueous) | absorbance spectrum computed | Aqueous layer only |
| Ethanol "organic" layer | `vessel.rs:989` `org_a = [0.0; N_BINS]` | **always colourless** | – |
| Neat layers | `vessel_phase.rs:49-77,198` | `absorbance_for_colour(color_linear_rgb)` inverts one RGB colour at 2 cm into a smooth 3-lobe spectrum | Any import with a parsed colour word |
| Visual-only liquids | `visual_contents.ts:44-58` `absorbanceFromRgb` (3 cm, different lobes) | Same idea, second implementation | `modelable:false` imports |
| Shader | `liquid_material.ts:518-525` | Spectrum → `computeSpectralColor` at `Lref` → **3 per-channel k values** | Path-length hue change (dichroism) lost; see E11 |
| Legacy material | `liquid_shader.ts:8-38` `createLiquidMaterial` (uses `layer.refractive_index`) | **not used anywhere** (no importer) | dead |
| Pipeline colour table | `pipeline/curated_colors.py` (15 entries) → `bundle.json.colors` | **not consumed** by web or engine (`grep` finds no reader) | dead and inconsistent with `spectra.rs` (Fe³⁺ 350 nm/ε 200 here vs 400 nm/150 there; CrO4²⁻ 375/4800 vs 400/4200; Fe²⁺ only here) |

### 1.2 Solids and precipitates

`Vessel::solid_props` (`vessel_ext.rs:137-185`) resolves a solid's look from four sources, in this priority order:
1. **`spectra::solid_optics`** (9 hand entries, `spectra.rs:85-152`: AgCl, Cu(OH)2, NaHCO3, MnO2, Mg, CoCl2, NaCl, NaOH, KI). Each sets colour, kind, particle µm, n and ρ.
2. **Inert compound record** (`:152-164`). Colour comes from the PubChem colour word or `[0.85]` grey. Metals are `[0.55,0.56,0.58]`. **particle 30 µm, n 1.55 fixed**. ρ comes from the record.
3. **Mineral registry** (`:166-175`). Colour, kind and particle size come from `data/solubility.json` (128 rows, all hand-picked: 87 powder, 25 crystal, 12 gel, 4 curds). For a solid with no row, they come from `solubility.rs::make_mineral` (`:110-146`):
   - colour = `ions::anion_solid_tint` (6 anions: CrO4, Cr2O7, MnO4, I⁻, S²⁻, Fe(CN)6³⁻) else `ions::cation_solid_hue` (7 coloured cations, everything else white), `ions.rs:473-500`
   - kind from the anion alone: OH⁻ → gel, halide → curds, else powder (`:119-125`)
   - particle size from the kind (2/5/10 µm, `:141`); saturation solids are 40 µm "crystal" (`:185-186`)
   - **ρ = M/38 clamped to 1.5–8** (`:130`)
   - **n = 1.55 if gel, else 1.65** (`vessel_ext.rs:173`)
4. **Default** (`:177-184`): grey 0.9, powder, ρ 2.5, 20 µm, n 1.6.

The registry also has a duplicate: `chem_db.rs:483-550` holds five hard-coded minerals with their own colours. So AgCl has
three hand colours (spectra.rs 0.95, chem_db 0.95, solubility.json 0.905), and spectra.rs wins.

Other solid behaviour:
- **PubChem colour feedback** (`solubility.rs:399-400`, `mineral_resolver.ts`) replaces the colour of *guessed* minerals with a parsed colour word. This is the only place where external data reaches a precipitate's look.
- **Imported ionic salts ignore the import's own colour and density.** `compound_model` passes neither on: `color_linear_rgb` is in the request struct (`compound_model.rs:74`) but is never used for the ionic path, and `mineral_for_import` (`solubility.rs:434-444`) builds the solid from rules (probe P3).
- **Settling** (`vessel_ext.rs:225-243`): Stokes velocity with **ρ_liquid = 1.0, η = 1e-3 Pa·s, and diameter × 10 for "flocculation"**. τ is clamped to **8–300 s**, so every solid settles within 5 min and a colloid never stays suspended.
- **Turbidity** (`vessel.rs:1280-1304`, `optics.rs:87-128`): Van de Hulst at a **single 550 nm**, so it is wavelength-independent and gives no Tyndall blue. The medium has **n = 1.333 fixed**. It uses the *unflocculated* diameter, while settling uses ×10. **`scatter_rgb` is the colour of whichever solid comes last in HashMap iteration (`:1299`)**, which is non-deterministic when several solids are present.
- **Bed and heap** (`effects.ts:436-500`): settled volume = mass/ρ × 1.6, the same packing for gels, curds and crystals. Bed colour is the mass-weighted linear RGB mean, not Kubelka–Munk. `crystal` gets sparkles and `gel`/`curds` get lumps; both are driven by the stored kind.
- **Floating** (`vessel.rs:1030`): `density < 1.0`, which compares with water rather than the liquid it sits in. A metal floats whenever any gas flux exceeds 0.01 mL/s.
- **Web sprites**: suspended grains are 0.25–0.55 mm whatever `particle_diameter_um` says (`effects.ts:946`). A second, independent settling law runs in the web layer (`effects.ts:807`, 0.00025·d²).
- **Ghost piles** (`visual_contents.ts:61` `DISSOLVE_C = 0.2`, `particle_diameter_um: 30`, `kind:'powder'`). The dissolution speed is a constant that does not depend on solubility or stirring physics (only a ×3 factor for stirring).

### 1.3 Gases, vapour, bubbles and foam

- **Fumes** (`spectra.rs:154-198`) cover 11 species: NO2, Cl2, I2, HCl, NH3, H2O, CO2, O2, H2, N2. Each has a hand RGB, an opacity and a **stored `denser_than_air`**.
  - Fumes are emitted only from **`headspace_gas_mol`**, and that is filled only when **sealed** (`vessel.rs:670,775`; `vessel_phase.rs:222`). An open beaker never shows coloured fumes.
  - Intensity = `mol × 100` clamped (`vessel.rs:1042`).
  - Br2(g) has no entry: in a sealed flask at 128 °C, `fumes == []` (P2).
- **Steam** (`vessel.rs:1095-1106`):
  - `vapour_visibility = (T − 330)/43.15`, `condensation = (T − T_room)/40`, and `is_boiling = T ≥ 373.15 && aqueous`, with `boil_intensity = 0.85` constant.
  - None of these depends on the liquid, the pressure or whether there is any liquid at all. A dry beaker at 786 °C reports visibility 1.0 and condensation 1.0 (P2).
  - Ethanol boiling at 78 °C has `boil_intensity 0`.
  - `evaporation_g_s` is 0.5 / 0.001 (`:1162`).
- **Bubbles** (`effects.ts:1035-1092`) are the generic part: bubbles/s = gas flux ÷ bubble volume, from the engine's `GasFlux.rate_ml_s`. The bubble diameter, however, is hand-set per call site: 2.0 mm (CO2, `vessel.rs:666`), "CO2 ? 2 : 1" mm (`:766`), 4.0 (water steam, `:878`), 3.5 (ethanol, `:905`), 2.0/3.0 (inert, `vessel_phase.rs:227,377`).
- **Foam** = `total_gas_rate / 50` clamped to 0.95 (`vessel.rs:1112`), whatever the surface activity. NaHCO3 + 1 M HCl gives foam 0.95 (P2); real bicarbonate fizz makes little stable foam.

### 1.4 Flames

- **Engine** (`vessel.rs:797-824, 1052-1062`). Only `C2H5OH` can ignite, when `T ≥ 286 K` (the ethanol flash point, hard-coded). Burn rate = 0.04 mL·s⁻¹·cm⁻² × area, clamped. ΔcH = 1367 kJ/mol and ρ = 0.789 are literals.
  - Snapshot values: `fuel:"Ethanol"`, **`flame_temp_k: 1200`**, **`luminosity: 0.05`**, **`emitter_rgb: None`** in every case.
  - Probe P1: a 250 mL beaker gives **36 kW**. A real ethanol pool fire of that diameter is about 1–2 kW (mass burning rate about 0.015 kg m⁻² s⁻¹), so the flame is roughly 20× too high.
  - Hexane does not ignite at all (P1).
- **Web** (`flame.ts:47-90`): a shader with a blue premixed cone and orange luminous colours. `uEmit` is supported but nothing ever fills it, so there are no flame-test colours: NaCl in ethanol still burns blue (P1). The burner panel is a visual toggle only.

### 1.5 Layers

| Layer | n | ρ | colour |
|---|---|---|---|
| aqueous | **1.333** (`vessel.rs:979`) | **1 + 0.03·I, ≤ 1.2** (`:978`) | bands |
| ethanol "organic" | **1.361** (`:994`) | **0.789** (`:993`) | always clear |
| neat liquid compound | **1.45** for any compound (`vessel_phase.rs:203`) | compound record ρ (good) | one RGB from the colour word (no solutes) |
| visual-only liquid | **1.333** (`visual_contents.ts:148`) | record ρ | RGB word |

The renderer ignores `refractive_index` entirely. The surface material has `ior: 1.333` (`liquid_material.ts:332`), as do the pour stream (`animations.ts:131`) and the "edge darkening" refraction hint (`liquid_material.ts:306-310`), which is a fixed 0.45 factor.

### 1.6 Bottle colours, PubChem text and reaction-log text

- **`reagent_colors.ts`** doses each reagent into a throwaway engine vessel (2 g or 50 mL) and colours it at 6 cm. This method is general, but it can only reproduce what the engine knows (§1.1).
  - The cache key `rc.reagentColors.v1` is never invalidated when engine data changes, so stale colours persist.
  - A solid probe without water reports the solid's RGB (rules or table), not the PubChem colour.
- **`parser.ts:115-143` `parseColourWord`** maps the first of **12 English colour words** to a fixed hex, with pale/light/dark modifiers. It is applied to "Physical Description" and "Color/Form". Hue words such as "purplish", "bluish-green", "amber", "violet-black" and "orange-red" either fail to match or take the first word only. There is no notion of hydrate versus anhydrous, or of the solid's colour versus its solution's colour.
- **Bottle glass** (`chem_db.rs` `bottle_colour`: amber, clear or white) is hand-set per catalog reagent. Imports get white or clear (`compound_model.rs:382`).
- **Event text** (`vessel_ext.rs:282-420`) is **generic**, which is good. Precipitate, solid-gone, gas, complex, colour-change and temperature events are all derived from state differences. Colour names come from an HSV classifier (`colour_name`, `:72-122`). Limitations:
  - The colour-change detector looks only at the **aqueous** layer (`:400-403`), so it misses the organic layer, neat layers and turbidity.
  - Formula ids are shown raw ("Fe4(FeC6N6)3", "O5SV").
  - An "Orange precipitate" label is right only when the RGB is right.

---------------------------------------------------------------------------------------------------------------------

## 2. Status of the prior-audit items (current tree)

| Item | Prior claim | Current status | Evidence |
|---|---|---|---|
| **F26** spectra / solid / fume tables | 21 bands, 9 solid optics, 11 fumes in `match`; `denser_than_air` stored; imported coloured compounds colourless in solution | **OPEN, unchanged** in `spectra.rs`. Partial progress elsewhere: inert imports now get a colour for their *neat liquid layer* and *undissolved solid* from the PubChem colour word (`vessel_phase.rs:198`, `vessel_ext.rs:158`), and guessed precipitates get PubChem colours (`solubility.rs:399`). **Dissolved** imports are still colourless | P1: methylene blue 10 mg in 50 mL gives A_max = 0, white; I2 in hexane is white; K3Fe(CN)6, NiCl2, CrCl3 solutions are white. `spectra.rs:154-198` still stores `denser_than_air` |
| **F29** settling and diffusion viscosity | ρ_liq 1.0, η 1e-3; diffusion η 8.9e-4 | **OPEN**. Lines moved: `vessel_ext.rs:230-232` (plus the ×10 floc factor and the τ clamp 8–300 s); `network_generator.rs:62`; `templates.rs:86-91` default `VISCOSITY_WATER_298` | Code read |
| **F40** n = 1.333, ρ = 1 + 0.03 I, ethanol constants | – | **OPEN, slightly worse**: a new hard-code n = 1.45 for every neat layer (`vessel_phase.rs:203`). Partial progress: neat-layer ρ now comes from the compound record. The web still ignores n | `vessel.rs:978-979, 989-995`; `visual_contents.ts:148`; `liquid_material.ts:332` |
| **F42** vapour 330–373 K; condensation from T − room | – | **OPEN** and confirmed worse than stated. The cues appear in a dry vessel; water-only `is_boiling` at a fixed 373.15 K ignores pressure and the sealed state; ethanol boiling gets no boil cue | `vessel.rs:1095-1106`; P2 (dry beaker at 786 °C: vis 1.0, cond 1.0; ethanol at 78 °C: boil 0) |
| **F47** particle size and morphology per compound; floats if ρ < 1; unknown solid ρ 2.5, n 1.6 | – | **OPEN**. Same values: `vessel.rs:1030`; `vessel_ext.rs:157-183`; `solubility.rs:119-141, 185-186, 407-412`; json `kind`/`default_particle_um` (128 rows). Also: imported salt density ignored, M/38 used instead | P3: K2Cr2O7 ρ 7.74 (real 2.68), K3Fe(CN)6 ρ 8.0 (real 1.89), KMnO4 4.16 (real 2.70), even with `density: 2.0` passed |
| Ledger 8 (n = 1.333) | – | OPEN | as F40 |
| Ledger 28 (vapour 330–373 K, evaporation 0.001/0.5 g/s) | – | OPEN | `vessel.rs:1097-1101, 1162` |
| Ledger 29 (particle size, morphology) | – | OPEN | as F47 |
| Ledger 31 (`denser_than_air`) | – | OPEN | `spectra.rs:154-198`, used at `vessel.rs:1045`, `effects.ts:1099` |

---------------------------------------------------------------------------------------------------------------------

## 3. New findings

Severity key: **B** = wrong or blocks, **D** = degrades, **C** = cosmetic.

- **E1 (B): dissolved imported compounds are always colourless.** `optics::absorbance_per_cm` only knows the 21 `bands()` ids. An inert or neutral import contributes nothing once dissolved: methylene blue, azobenzene, any dye or indicator imported from PubChem, VOSO4 (modelled as inert O5SV). The PubChem colour is used only for the undissolved solid and the neat liquid. Example (P1): 10 mg methylene blue in 50 mL is water-clear, and the reaction log says only "Solid gone".
- **E2 (B): common coloured inorganic ions have no bands.** Measured on 0.5 g of the imported salt in 50 mL:
  - **Missing:** Ni²⁺ (green), Cr³⁺ (green/violet), Fe(CN)6³⁻ (yellow), Fe(CN)6⁴⁻, VO²⁺ (blue), Fe²⁺ (pale green), Mn²⁺ (pale pink), CuCl4²⁻ (yellow-green), Ni(NH3)6²⁺ (blue-violet), Co(NH3)6³⁺, the colour of Cu²⁺ in chloride, Fe³⁺ chloro/hydroxo complexes, polysulfides, Br2(aq) and Br3⁻ (orange), all dyes.
  - **Present:** KMnO4, K2Cr2O7, FeCl3, CoCl2, CuSO4 and Cu(NO3)2 do colour, because their ions happen to be in the table.
  - The dichromate/chromate spectra were authored as an independent band per species, and acid-base interconversion relies on the equilibria. That is fine, but it was not checked against data.
- **E3 (B): no solvent-dependent colour and no partitioning of colour into organic layers.**
  - The ethanol layer's absorbance is hard-zero (`vessel.rs:989`).
  - A neat layer's colour is fixed to its own compound, so solutes never colour it: I2 in hexane is clear (should be violet, λmax ≈ 520 nm); Br2 dropped onto water + hexane forms its own 0.2 mL dark-red bottom layer and the hexane stays clear (P1).
  - Solvatochromism (I2 brown in water/ethanol, violet in alkanes) needs ε(λ) keyed by (species, solvent).
- **E4 (B): Prussian blue is rendered orange.** FeCl3 + K4Fe(CN)6 → `Fe4(FeC6N6)3(s)` with RGB #cb8145, logged "Orange precipitate formed" (P1). The rules choose the Fe³⁺ hue, which is brown, because Fe(CN)6⁴⁻ has no tint. Intervalence charge-transfer colours cannot be derived from cation or anion hue rules. Other rule colours that are wrong:
  - Na2S solid is dark grey (the S²⁻ tint applies to *all* sulfides; real Na2S is white/yellowish). ZnS and CdS are only right because they are table rows.
  - Every iodide is yellow through the I⁻ tint (CuI is white).
  - CuCl2 anhydrous comes out blue (real: yellow-brown; the dihydrate is blue-green).
  - CuSO4 is pale blue (the table assumes the pentahydrate; anhydrous is white). There is no hydrate state, although hydration is condition-dependent (T, humidity).
- **E5 (B): fumes never appear from open vessels.** `headspace_gas_mol` is written only when sealed. Even for the 11 listed gases, an open beaker that evolves Cl2, NO2 or I2 vapour shows nothing coloured. The Br2(g) boiling probe, open and sealed, gives `fumes: []`.
- **E6 (D): steam, condensation and boiling cues are thresholds on T alone.**
  - They are independent of the liquid's vapour pressure, the vessel pressure and even liquid presence. A dry beaker at 786 °C "steams" (P2).
  - `is_boiling` is water-only and fixed at 373.15 K, so sealed superheated water shows boiling and ethanol at its bp shows none. Steam colour is always white.
- **E7 (D): flame is ethanol-only and its numbers are wrong.**
  - 36 kW from a 250 mL beaker, about 20× a real pool fire of that size.
  - 1200 K and luminosity 0.05 are constants. There is no adiabatic flame temperature, though the engine has ΔcH and Cp.
  - Hexane, acetone and other imported fuels with ΔcH and vapour-pressure data cannot ignite.
  - `emitter_rgb` is never set, so there are no flame tests, even though the field and the shader uniform exist.
- **E8 (D): imported salt solids ignore the import's density and colour.** The density is M/38 instead (K3Fe(CN)6 = 8.0 g/mL). This affects bed volume, settling speed and floating.
- **E9 (D): settling and suspension behaviour is clamped instead of derived.**
  - τ ∈ [8, 300] s.
  - ρ_liquid = 1.0 and η = 1e-3 at every T and solvent.
  - Flocculation is a fixed ×10.
  - A colloidal sol (gold, starch, sulfur from thiosulfate) cannot stay turbid, and a 2 µm AgCl curd settles on the same schedule at 20 °C and 90 °C.
  - The web runs a second settling law (`effects.ts:807`) that is not tied to the engine.
- **E10 (D): turbidity colour and spectrum.**
  - `scatter_rgb` = the last solid in HashMap order (non-deterministic with ≥2 solids; P1 FeCl3 + K4Fe(CN)6 has two).
  - Scattering is evaluated at 550 nm only, so there is no Rayleigh blue or red-transmission, and no opalescence of fine sols such as sulfur from thiosulfate + acid.
  - Turbidity uses the primary size while settling uses ×10, which is internally inconsistent.
- **E11 (D): the shader collapses the spectrum to three channel coefficients at `Lref`** (`liquid_material.ts:520-523`). Path-dependent hue is lost: dichromatic solutions change hue with depth (Cu(NH3)4²⁺, chlorophyll, bromophenol blue). Thin films and the meniscus get the same hue as the deep column. This is an approximation, not an invariant violation.
- **E12 (D): foam = gas flux / 50 with no surface-activity term.** CO2 fizz from bicarbonate produces a full foam head (0.95). Elephant-toothpaste-type foam (which needs a surfactant) is indistinguishable from plain fizz.
- **E13 (D): bubble diameter is hand-picked per call site** (1, 2, 3, 3.5 or 4 mm, plus a "CO2" string test). It is independent of surface tension, nucleation site and pressure.
- **E14 (C): two different RGB→spectrum inversions.** Rust (2 cm, linear-ramp lobes) and TS (3 cm, smoothstep lobes) disagree, so the same PubChem colour word renders differently as an inert neat layer and as a visual-only liquid. The inverted spectrum is also a fabricated broad-band ε. Mixing two such liquids gives physically meaningless subtractive colours, and concentration has no meaning because the colour belongs to the *neat* liquid.
- **E15 (C): the 12-word colour vocabulary** misses hue compounds ("purplish", "bluish green", "orange-red", "amber", "violet-black", "metallic lustre"). It takes the first word in up to four text snippets, so "colorless when pure, yellow on standing" → colourless. It has no confidence measure and no source tier on `color`.
- **E16 (C): dead or duplicate colour data.**
  - `pipeline/curated_colors.py` (15 entries) is shipped in `bundle.json.colors` but never read.
  - `createLiquidMaterial` (`liquid_shader.ts:8-38`) is unused.
  - `chem_db.rs:483-550` duplicates five minerals with their own colours.
  - The three sources disagree on AgCl, Fe³⁺ and CrO4²⁻.
- **E17 (C): the bottle-colour cache never invalidates.** It is keyed by reagent id only (`reagent_colors.ts:15`), so colours do not update after band, table or resolver changes.
- **E18 (C): indicator strength looks saturated.** 3 drops of phenolphthalein in 30 mL NaOH give A_max = 4.6 cm⁻¹ and render #ca00ff, logged "Solution turned purple" (P1). Phenolphthalein in base reads pink-magenta at typical indicator concentrations, so either the drop concentration or ε is too high, or the 3-channel reduction (E11) shifts saturated magenta to purple.
- **E19 (C): the colour-change event looks only at the aqueous layer.** Neat or organic layer colour and turbidity changes are never announced. Raw Hill or engine ids leak into log text ("O5SV", "Fe4(FeC6N6)3").
- **E20 (outside this area, affects appearance).** These belong to other audit areas, but they change what the user sees:
  - Imported CuSO4, Cu(NO3)2, FeCl3 and CrCl3 in pure water precipitate their hydroxides, so the solutions are turbid. There is no hydrolysis or hydroxo complexation.
  - HgCl2 + KI gives white "HgCl2 curds" although HgCl2 is soluble.
  - MnCl2 + Na2S gives Mn(OH)2 instead of salmon MnS.
  - CuSO4 + KI shows no CuI or I2 (no redox).

  A correct appearance pipeline will still show wrong colours until the chemistry is right.

---------------------------------------------------------------------------------------------------------------------

## 4. Recommendations: the most general approach for each quantity

Guiding principle: as for thermodynamics, store **intrinsic optical data per species (and per solvent where it
matters)**, and derive the look from the vessel's state.
- Store: ε(λ) spectra, the solid's complex refractive index or band edge, molar refraction, atomic emission lines.
- Derive: concentrations per phase, T, particle-size distribution, path length.
- Every optical datum carries a provenance tier (Tabulated, Imported, Estimated, Speculative), so hand-entered values
  are visibly the lowest tier rather than the default.

### 4.1 Solution colour: ε(λ) per (species, solvent) as intrinsic data

**Data model.** Add `OpticalRecord { species, solvent: "water" | "<InChIKey>" | "gas", bands: Vec<Band> | sampled
eps[32 or finer], tier, source }` to the species store, which is the same store `register_compound` writes to.
- `spectra::bands()` becomes the *seed rows* of that store (tier Tabulated, with the source cited once checked). It is
  no longer a `match`.
- Look-up by `(species, phase-solvent)` falls back to the water entry, then to "gas", with a Speculative tier.

**Sources, largest and most general first.**
1. **PubChem PUG View "UV Spectra" and "Spectral Properties"** (already in use). These give λmax and log ε text with
   the solvent named, e.g. `MAX ABSORPTION (ALCOHOL): 221 NM (LOG E= 5.04)`.
   - Coverage: thousands of compounds (HSDB-derived). Mostly UV, but the visible bands of dyes, indicators and
     permanganate are often present.
   - Turn each (λmax, ε, solvent) into a Gaussian band. FWHM can be estimated from the band type: about 60–90 nm for
     π→π*, and wider for d-d.
   - Gives tier Imported. Parser: `pubchem/uv_parser.ts`, sent in `import_compound` as `uv_bands: [[nm, eps, fwhm?, solvent]]`.
2. **ChemDataExtractor UV/vis database** (Beard et al., *Sci. Data* 2019) and **Deep4Chem / ChemFluor** (Joung et
   al. 2020).
   - Tens of thousands of experimental (λmax, ε) records for compound–solvent pairs, auto-extracted from the
     literature under open licences. They are keyed by SMILES and solvent, which matches what is needed.
   - Bundle them as a server-side lookup by InChIKey (pipeline step) or ship a compressed index. This is the largest
     open experimental source of visible-band data and **directly covers solvatochromism**.
3. **MPI-Mainz UV/VIS Spectral Atlas of Gaseous Molecules** (Keller-Rudek et al.).
   - Full gas-phase cross-sections for about 1,000 small molecules: NO2, Br2, I2, Cl2, O3, SO2, ClO2, organic vapours.
   - This is the right source for **fume colour** (§4.4). Check the licence: research use with citation.
4. **Computed spectra** on the local server for anything left: **sTDA-xTB** (Grimme; seconds per molecule, good for
   organic chromophores and dyes), escalating to TD-DFT for small molecules.
   - Gives tier Estimated. It fits the existing `server/barrier_workflow.py` job queue and SQLite flywheel.
   - Weakness: d-d bands of transition-metal ions are poor at the sTDA level.
5. **ML predictors** trained on sources 2 and 4 (Chemprop-style λmax/ε models). Use them as a fast first guess while
   the server job runs. Tier Speculative.
6. **Transition-metal aqua, ammine and chloro ions.** No large database covers d-d spectra.
   - *Narrow but cheap:* a ligand-field model, Tanabe–Sugano with Δo from the spectrochemical series (Jørgensen f·g
     factors) and the Racah B nephelauxetic factor. This generates the band positions for d¹–d⁹ first-row ions with
     about 10 ligands. It covers the classic lab colours (Ni²⁺ green, Ni(NH3)6²⁺ violet, Cr³⁺, VO²⁺, Co complexes)
     from a few dozen intrinsic parameters (f per ligand, g and B per metal ion).
   - **Judgement:** this is broader than per-species bands, but it is still a model of a narrow class. Charge-transfer
     colours (MnO4⁻, CrO4²⁻, Fe(SCN)²⁺, Prussian blue, I3⁻) must come from data (sources 1–4).
7. **Never** derive solution ε from a PubChem *solid* colour word. That is the solid's reflectance, not a molar
   absorptivity.

**Engine changes.**
- `optics.rs`: `absorbance_per_cm` takes `(species, conc)` per **phase**, together with that phase's solvent.
- `vessel.rs` computes concentrations per phase. Dissolved inert compounds and solutes partitioned into organic or
  neat phases contribute to *their* layer, which needs the partitioning work from the phase-equilibrium audit.
- Delete `org_a = [0.0; N]`.
- Snapshot: `LiquidLayer.absorbance_per_cm` stays as it is. Add `colour_tier: ProvenanceTier` and
  `colour_sources: Vec<String>` so the Details drawer can show where the colour came from.
- Make the bin grid 380–780 nm (41 bins at 10 nm) so near-IR d-d bands (Cu²⁺ at 800 nm) and violet bands are
  represented. `RGB_WEIGHTS` is regenerated from the CIE 1931 2° CMFs and D65; the TS fallback is regenerated likewise.

**Shader (E11).** Keep the spectrum to the end:
- Send 8 spectral coefficients per layer (sum-of-Gaussians fit, or 8 band-averaged absorbances). Evaluate
  T = Σ_i w_i·10^(−A_i·L) per pixel with 8×3 weights as a uniform.
- Or precompute a per-layer 1D LUT of colour against path length (32 texels, 0–20 cm) on the CPU at 20 Hz. This is
  cheap and exact.

**Tests.**
- `engine/tests/optics_records.rs`: register a dye from PubChem-style bands → aqueous colour within ΔE < 10 of a
  reference sRGB. Dissolved inert import → non-zero absorbance. I2 in an alkane layer peaks at 520 nm, and in water
  at 460 nm.
- `tests/uv_parser.mjs` against stored PubChem texts.
- A wasm_e2e step: methylene blue 10 mg/50 mL has A_max(660 nm) > 1.

### 4.2 Solids: colour, refractive index, density, size, morphology

**Colour.**
1. **Measured colour text** from PubChem "Color/Form", tier Imported. Fix the hydrate state, and use a richer parser
   built on a **large colour-name lexicon** (the XKCD colour survey of about 950 names, or CSS/X11 plus modifier
   grammar). It should map compound hues ("bluish green", "orange-red", "purplish") and record the phrase's subject:
   crystals versus solution, anhydrous versus hydrate.
   - Feed it to **ionic** imports too (`compound_model.rs` → `mineral_for_import`). This fixes E8 and part of E4.
2. **Band gap → absorption edge** for semiconducting and insulating solids. Sources:
   - **Materials Project** (≈150 k materials, CC BY; API key or AWS Open Data bulk)
   - **AFLOW** (≈3.5 M entries, open)
   - **OQMD** (≈1 M, open)
   - **JARVIS-DFT** (≈80 k with TBmBJ or optimised gaps, which are closer to experiment than PBE)

   Apply a scissor correction to PBE gaps (PBE underestimates them by about 30–50 %) or prefer TBmBJ/HSE where they
   exist. Model reflectance as Kubelka–Munk with an Urbach edge at E_g. This gives yellow CdS, PbI2 and AgI, red HgI2,
   black PbS and Ag2S, and white ZnS, BaSO4 and AgCl from **one intrinsic number per solid**.
   - **Breadth:** covers most simple binary and ternary salts. It does **not** cover d-d (Ni(OH)2 green, CuSO4·5H2O
     blue) or intervalence (Prussian blue) colours.
3. **Ion chromophore inheritance.** For d-d colours, take the solid's colour from the constituent ion's ε(λ) (§4.1,
   ligand-field or data) through Kubelka–Munk with an effective path set by grain size. This is how Ni(OH)2 and
   Cu(OH)2 look like their ions. Tier Estimated.
4. **Computed** (server): the absorption spectrum of a periodic solid is too expensive. Leave it as Speculative and
   fall back to white.

Retire `cation_solid_hue`/`anion_solid_tint` and the hand `solid_color` column once options 1–3 exist. Keep them only as
Speculative, and label them as such.

**Refractive index** (`n` is needed for scattering and the meniscus).
- **Lorentz–Lorenz** from molar refraction R_m = Σ atomic or ionic refractions, with n from (n²−1)/(n²+2) = R_m ρ/M.
  - Atomic and bond refractions (Vogel; Eisenlohr) cover organics.
  - Ionic polarisabilities (Shannon & Fischer 2006, about 270 ion/coordination entries) cover salts.
  - Both are intrinsic and additive. This is one general method for all solids and liquids.
- Measured n_D overrides it, in this order: PubChem "Refractive Index" text, then Wikidata P2105/refractive index,
  then Materials Project dielectric ε∞ (n = √ε∞, a few thousand materials).
- For mixtures, use Lorentz–Lorenz mixing by volume fraction (aqueous layer n from solute R_m), which replaces 1.333,
  1.361 and 1.45.

**Density.** Use, in order: the record's density (import) → Materials Project or AFLOW relaxed-structure density
(already planned in data-sources Stage 7) → ion-volume additivity (Jenkins–Glasser V_m). Delete `M/38`.

**Particle size and morphology** (replaces `kind` and `default_particle_um`).
- **Classical nucleation and growth**:
  - At precipitation, supersaturation S = (IAP/Ksp)^(1/ν) is already known in `vessel_eq.rs`.
  - Interfacial energy is estimated from solubility (Mersmann: γ ≈ 0.414 k_BT/v_m^(2/3) · ln(c_s/c_eq), where c_s is
    the solid's molar density). Both inputs are intrinsic.
  - Nucleation rate J = A·exp(−16πγ³v_m²/(3k³T³ ln²S)). The number of nuclei sets the mean size d ≈ (6·V_solid/(πN))^(1/3).
  - High S gives colloidal or "curdy" precipitates (AgCl, BaSO4 from concentrated solutions); low S gives crystals.
  - Particles grow while S > 1 (diffusion-limited growth with D from Stokes–Einstein).
- **Aggregation** from DLVO-style coagulation: aggregates form when the ionic strength exceeds the critical coagulation
  concentration (Schulze–Hardy ∝ z⁻⁶). This replaces the fixed ×10 floc factor.
- **Morphology:** "gel" is a highly hydrated amorphous solid formed at very high S. Map it from S plus hydration
  enthalpy instead of anion = OH⁻.
- Snapshot: `SolidVisual.particle_diameter_um` becomes the derived mean, plus `aggregate_um`. `kind` becomes derived
  `{dispersity, crystallinity}`.

**Settling.** Stokes with the *layer's* ρ(T) and η(T) (from the solvent model in the generality audit), with a hindered-
settling Richardson–Zaki factor. Remove the 8–300 s clamp, and use Brownian diffusion against sedimentation (Péclet) to
decide whether a colloid stays suspended.

**Floating.** Compare ρ_solid with the density of the layer it is in. For metals, use bubble attachment from the
gas-flux surface coverage instead of "any flux > 0.01".

**Scattering.** Evaluate per wavelength bin (Rayleigh–Gans–Debye or anomalous diffraction, and Mie for d ≈ λ; a small
Mie routine is cheap at 41 bins × few sizes) with complex m = n_solid/n_layer, where the imaginary part comes from the
solid's absorption.
- Returns `scatter_per_cm[bins]` instead of a scalar. Remove `scatter_rgb`. The scattered light's colour then follows
  from the spectrum (sulfur sols look bluish in reflected light and orange in transmission).
- Mass-weight across solids deterministically.

### 4.3 Bubbles, foam, boiling, steam and condensation

- **Bubble diameter**: Fritz departure diameter d = 0.0208·θ·√(σ/(gΔρ)) for wall and solid nucleation, and a
  supersaturation-dependent size for bulk nucleation. Needs surface tension σ(T): PubChem "Surface Tension" text,
  then Wikidata, then the Parachor estimate (Sugden; group-additive, intrinsic). Make `GasFlux.bubble_diameter_mm` a
  single function in `phase_transfer.rs`, and delete the per-call-site literals.
- **Boiling cue**: `boil_intensity` = the vapour volume flux of *any* compound whose P_sat(T) ≥ vessel P. The engine
  already computes this for inert compounds and for water/ethanol. Normalise by vessel cross-section. Delete
  `T ≥ 373.15`.
- **Visible vapour (steam/mist)**: use mixing-line supersaturation. The liquid surface evaporates at a rate set by a
  mass-transfer coefficient × (P_sat(T_liq) − p_ambient) for every volatile species. The plume mixes with room air
  at T_room, and it is visible when the mixture exceeds saturation at the mixed temperature (the same calculation that
  makes breath visible). Inputs are only the vapour-pressure curves already in `CompoundThermo`. The output is
  `vapour_flux_g_s` per species plus `mist_visibility`. Replaces `(T − 330)/43.15` and `evaporation_g_s` 0.5/0.001.
- **Condensation on the upper glass**: occurs when the wall temperature (between T_liq and T_room) is below the dew
  point of the headspace vapour. Same data. Report it per species so condensed bromine looks red and water looks clear.
- **Foam**: foam stability needs surface-active species. Add an intrinsic "surfactant" flag derived from structure (an
  amphiphile SMARTS: long alkyl chain plus an ionic or polyether head, via RDKit in the pipeline or server), and
  multiply the gas flux by a foamability from surface-tension lowering. Without surfactant, show transient fizz only.

### 4.4 Gases and fumes

- **Colour**: gas-phase cross-sections σ(λ) per species (MPI-Mainz Spectral Atlas; PubChem gas UV text; sTDA for the
  rest). Render through the same spectral → RGB path with column density n·L. This replaces `rgb_linear` and `opacity`.
- **Buoyancy**: `denser_than_air = M_gas_mixture > M_air(28.96)`, from the plume's composition and temperature
  (ideal gas: ρ ∝ M/T, so a hot vapour can rise even if heavy). Delete the stored flags.
- **Open vessels**: emit fumes from the evolved-gas *flux* (`gas_fluxes`), not only from the sealed headspace. Keep a
  short-lived "plume" inventory (mol, decaying with an exchange time set by the vessel opening) so open-beaker NO2,
  Cl2 and Br2 are visible.
- **"Fuming" (HCl, HNO3, SO3, NH3 + HCl smoke)**: derive the aerosol from chemistry instead of a flag.
  - A gas that is highly soluble in water (Henry constant) meets room humidity and forms droplets.
  - A gas-phase reaction that forms a solid (NH3 + HCl → NH4Cl(s)) becomes an engine reaction in a "plume" phase.
  - Both are generic.

### 4.5 Flames

- **What burns**: any species with ΔcH (already parsed from PubChem, or Hess from ΔfH). It ignites when the vapour
  above the liquid reaches the **lower flammability limit**:
  - LFL from Jones' rule (≈ 0.55 × stoichiometric fuel fraction, from the formula), or measured LFL/flash point from
    PubChem text.
  - Vapour concentration from P_sat(T)/P (existing Clausius–Clapeyron fit).
  - This is the general flash-point criterion. It replaces `C2H5OH` and `t_k ≥ 286`.
- **Burning rate**: Burgess/Babrauskas pool burning,
  m'' = m''∞(1 − e^(−kβD)) with m''∞ ≈ 1e-3·ΔHc/ΔHg kg m⁻² s⁻¹, where ΔHg = ΔHvap + ∫Cp dT to the boiling point.
  All the inputs are intrinsic and already in `CompoundThermo`. This replaces `0.04·area` and the 1367 kJ/mol literal,
  and fixes the 20× power error.
- **Flame temperature**: adiabatic flame temperature from ΔcH and product Cp(T) (CO2, H2O, N2 Shomate/NASA, which the
  data proxy already fetches), minus a radiative-loss fraction.
- **Luminosity (soot)**: from the sooting tendency, using the Yale **Yield Sooting Index** database (≈ 500 measured
  compounds, plus a group-contribution model for the rest) or the C/H ratio and aromaticity as a Speculative
  fallback. Hexane gives a slightly yellow flame, toluene a smoky orange one, methanol a blue/invisible one.
- **Flame-test colour**: use the **NIST Atomic Spectra Database** lines for every element (wavelengths, Einstein A,
  g_k, upper-level energies; ≈ 280 k lines).
  - Emission per line ∝ g_k·A_ki·exp(−E_k/kT_flame) × atomic number density.
  - The atomic number density comes from the cation inventory carried into the flame (aerosol/splatter fraction of
    the dissolved salt). Use a Saha correction for ionisation (alkali metals) at T_flame.
  - Bin into the spectral grid → RGB → `emitter_rgb` and its weight. This gives Na yellow (589 nm), K lilac, Li/Sr
    red, Ca orange-red and Cu blue-green **from one database and one formula**.
  - Molecular emitters (CuCl, SrOH, CaOH bands) are a second-order refinement; the Pearse & Gaydon band tables are
    narrow.
- **Snapshot**: `FlameVisual { fuel: species id, flame_temp_k, luminosity, emitter_rgb, emitter_weight, power_w }`,
  all derived. Run the burner panel's flame through the same function, using the gas fuel (methane/propane) and
  whatever is held in the flame.

### 4.6 Layers

- n from Lorentz–Lorenz mixing (§4.2). Pass it to the renderer: replace `ior: 1.333` in `liquid_material.ts:332` and
  `animations.ts:131` with `layer.refractive_index`, and scale the edge-darkening factor by |n_layer − n_glass|.
- ρ of the aqueous layer from apparent molar volumes (Pitzer/Laliberté density model). **Laliberté (2009)** has
  parameters for ≈ 100 electrolytes in one table, and a fallback from ion volume additivity. Delete `1 + 0.03·I`.
- Organic layers come from the compound records (as the neat layers already do), with the solutes' colour (§4.1).

### 4.7 PubChem colour text, bottles and log

- Replace `parseColourWord` with a lexicon parser (§4.2) that returns `{sRGB, subject: solid | solution | vapour,
  hydrate?: bool, confidence}`. Store it as Imported, and never feed it into ε(λ).
- Make the bottle colour a *view* of the same derivations: solids use the solid reflectance, solutions the spectral
  colour at the bottle path. Version the cache key by an engine "optics data version" hash (E17).
- Log: run colour-change detection per layer (aqueous, organic, neat) and include turbidity. Show the display names
  from the compound record instead of raw ids.

### 4.8 Clean-up (low effort)

- Delete `pipeline/curated_colors.py` → `bundle.colors`, `createLiquidMaterial`, and the `chem_db` mineral duplicates.
  Move the 21 band rows, the 9 solid rows and the 11 fume rows into the optical-record store as Tabulated seeds, with a
  source column so each can be spot-checked.
- Unify the two RGB→spectrum inversions into one engine function, used only for a Speculative "neat colour" fallback.
- Make `scatter_rgb` deterministic (mass-weighted) now, before the spectral rewrite.

### 4.9 Suggested order (each step can ship on its own)

1. **Quick fixes**: open-vessel fumes from flux; `is_boiling` / visibility from vapour flux; dry-vessel steam off; flame
   power from a pool-burning formula; deterministic scatter colour; import density and colour for ionic salts; cache
   versioning. Tests: extend `tests/wasm_e2e.mjs` with P2-style asserts.
2. **Optical-record store** plus PubChem UV parser, so dissolved imports and dyes get colour (E1). Add per-phase
   absorbance, which fixes I2 in hexane once partitioning exists (E3).
3. **Flame**: flash point from P_sat and LFL, adiabatic T, NIST ASD flame-test emission (E7).
4. **Solids**: band gap → edge colour (Materials Project/JARVIS) + Kubelka–Munk; Lorentz–Lorenz n; nucleation-based size;
   Stokes with layer ρ and η (E4, E8, E9, F47).
5. **Large spectral databases** (ChemDataExtractor UV/vis, Deep4Chem) bundled server-side, plus sTDA-xTB jobs and the
   ligand-field model for d-d ions (E2).
6. **Shader**: spectral LUT per layer (E11); 380–780 nm grid.

Databases this relies on, few and large:
- PubChem (in use): colour text, UV text, surface tension, refractive index, LFL, flash point.
- ChemDataExtractor UV/vis and Deep4Chem: ε(λ) by solvent.
- MPI-Mainz Spectral Atlas: gas cross-sections.
- Materials Project, JARVIS and AFLOW: band gaps, densities, ε∞.
- NIST ASD: atomic emission lines.
- Wikidata (CC0): n_D and other fallbacks.

Small but general parameter sets:
- Shannon polarisabilities and Vogel refractions (refractive index)
- Laliberté density
- Jørgensen f/g ligand-field
- YSI

Too narrow to be the main route: per-compound band tables, cation/anion hue rules, colour words as ε, and ligand
field alone (d-d only).

---------------------------------------------------------------------------------------------------------------------

## 5. Probes and results

Scripts: `scratchpad/audit/probes/appearance_probe.mjs` (P1), `probe2.mjs` (P2) and `probe3.mjs` (P3). Outputs are next
to them (`*.out`). Imports are made the way the app makes them (`import_compound` with a Hill formula and the
PubChem-style colour word as `color_linear_rgb`). Colours are the engine spectrum through `optics_tables_json`
weights at 3 cm.

**P1a: imported salts, 0.5 g in 50 mL water**

| Salt | Engine species | Solution colour | Expected | Note |
|---|---|---|---|---|
| KMnO4 | K⁺, MnO4⁻ | #a500a1 (A_max 265/cm) | deep purple | ok (table) |
| CuSO4 | Cu²⁺ | #76e2ff + Cu(OH)2(s) | pale blue, clear | colour ok; spurious precipitate (E20) |
| NiCl2 | Ni²⁺ | **#ffffff** | green | E2 |
| CoCl2 | Co²⁺ | #ff7dc0 | pink | ok |
| K2Cr2O7 | Cr2O7²⁻/HCrO4⁻/CrO4²⁻ | #ff8f00 | orange | ok |
| FeCl3 | Fe³⁺ | #fff900 + Fe(OH)3(s) | yellow-brown | approx.; precipitate (E20) |
| CrCl3 | Cr³⁺ | **#ffffff** + Cr(OH)3(s) | green | E2 |
| FeSO4 / MnSO4 | Fe²⁺ / Mn²⁺ | #ffffff | very pale green / pink | E2 (minor) |
| K3Fe(CN)6 | Fe(CN)6³⁻ | **#ffffff** | yellow | E2 |
| VOSO4 | inert "O5SV" | **#ffffff**; solid #3d6fc4 | blue | E1/E2 |

**P1b: imported molecules**

| Case | Result | Expected |
|---|---|---|
| Methylene blue 10 mg / 50 mL water | A_max 0, **#ffffff**; log only "Solid gone" | intense blue (E1) |
| I2 10 mg / 50 mL water (modelled as I2(aq)) | #ffc400, "Solution turned yellow" | yellow-brown (ok) |
| I2 10 mg / 30 mL hexane | hexane layer **#ffffff**, A_max 0 | violet (E3) |
| water + hexane + 0.2 mL Br2 | own Br2 layer at the bottom (#7d0003); hexane clear | Br2 extracts into hexane, orange (E3) |
| azobenzene dry solid | #e6aa27 powder, 30 µm | orange (ok, from the colour word) |

**P1c: catalog chemistry**
- CuSO4 0.1 M: #03d2ff "teal". Plus NH3: #1800ef "blue", "Complex formed: Cu(NH3)4+2". Plausible.
- NaOH + 3 drops phenolphthalein: A_max 4.6/cm, #ca00ff, "Solution turned purple" (E18).

**P1d: precipitates (25 + 25 mL, imported)**

| Pair | Solid(s), colour, kind | Expected |
|---|---|---|
| NiCl2 + NaOH | Ni(OH)2 #7fc78a gel 5 µm | green gel (ok, table) |
| ZnCl2 + Na2S | ZnS #f2f2ee | white (ok, table) |
| NiCl2 + Na3PO4 | NiHPO4 #89daa0 + Ni(OH)2 | pale green (ok, cation hue rule) |
| MnCl2 + Na2S | Mn(OH)2 #ebe3d8 | salmon MnS (chemistry, E20) |
| AgNO3 + NaOH | AgOH #6b4a2e | brown Ag2O (ok colour) |
| HgCl2 + KI | HgCl2 "curds" #f6f6f6 + HgI2 #d9392b | only HgI2 (E20) |
| FeCl3 + K4Fe(CN)6 | Fe4(FeC6N6)3 **#cb8145 "Orange precipitate"** + Fe(OH)3 | Prussian blue (E4) |
| CuSO4 + KI | Cu(OH)2 only | CuI + I2 (redox missing, E20) |

All of them settle to suspended fraction ≈ 0.02 within 60 s, whatever the particle type (τ clamp, E9).

**P2: vapour, fumes and flame**

| Case | Result | Expected |
|---|---|---|
| water, 400 W heating | vis 0.22 at 66 °C, 0.71 at 87 °C, 1.0 at 100 °C; boil 0.85 constant while the H2O flux is 272 mL/s | – |
| ethanol, 400 W heating | at 78 °C: boil **0** (flux 278 mL/s), vis 0.50 | E6 |
| ethanol, after boiling dry | beaker heats to **786 °C**, vis **1.0**, cond **1.0** with no liquid | E6 |
| sealed 1 mL Br2, 128 °C, 1.36 atm | `fumes: []` | E5 / F26 |
| open Br2 boiling | "Gas evolving: Br2", no fume, vis 0 below 57 °C | E5 |
| NaHCO3 2 g + 1 M HCl 30 mL | CO2 63 mL/s, bubble 2 mm, **foam 0.95** | E12 |
| Mg + 1 M HCl | H2 10 mL/s, 1 mm bubbles on solid, Mg "floating" | heuristic floating |
| ethanol 10 mL ignited | burns out within 2 s of sim; with NaCl: `{"fuel":"Ethanol","power_w":36040,"luminosity":0.05,"flame_temp_k":1200}`, no `emitter_rgb` | E7 |
| hexane 10 mL + igniter | no flame | E7 |

**P3: dry imported salts (1 g, PubChem colour passed as white, `density: 2.0` passed)**

The import's colour and density are ignored in every case. The solid comes from the table or the rules, with ρ = M/38.

| Salt | Rendered solid | Real |
|---|---|---|
| KMnO4 | #9527a0, ρ 4.16 | ρ 2.70 |
| CuSO4 | #c8d8e8, ρ 3.60 | anhydrous is white |
| NiCl2 | #89daa0 | – |
| CoCl2 | #897ccb | – |
| K2Cr2O7 | #ed953f, ρ 7.74 | ρ 2.68 |
| FeCl3 | #cb8145 | – |
| K3Fe(CN)6 | #e7a03f, ρ 8.00 | ρ 1.89 |
| KI | #f9f9f9 | – |
| CuCl2 | #59a0e7 | anhydrous is brown |
| CrCl3 | #89c495 | – |
| Na2S | #7c7c7c grey | white or yellowish |
