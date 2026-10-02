# Audit C: phase determination, phase equilibria and transport

Scope: what phase each species is in, and how matter moves between phases (VLE/SLE/LLE, solubility, volume and
density, gas and headspace, rates of dissolution, evaporation, degassing, precipitation and settling).
Checked against the **current working tree** (uncommitted, 2026-10-01). The WASM in `web/src/wasm/engine/` was built
at 21:50, after the last engine source edit (vessel.rs 21:45), so the probes exercise the current code.
`cargo test`: all suites pass (41 + 9 + 5 + 2 + 6 + 9 + 12 + 1 + 4 tests). None of them covers the failures below.

Probe scripts and raw output:
`/private/tmp/claude-501/-Users-carlliu-reaction-chamber/f26e8c67-1a98-4c46-88a1-a51d179e5f1f/scratchpad/audit/probes/`
(`phase_probes.mjs` → `phase_probes.out`, `probes2.mjs` → `probes2.out`). They are referenced below as P1–P20 and Q1–Q9.

Severity: **B** = blocks a class of conditions, or gives silently wrong results. **D** = degrades accuracy or
generality. **C** = cosmetic or visual only.

---

## 1. Inventory: how phase and transport are decided today

There are **three separate phase mechanisms**, and they do not share a model:

| Who | Where | Phase rule | Transport rule |
|---|---|---|---|
| Water `"H2O"` | vessel.rs:860-884 (boiling), 915-961 (headspace), 1198-1212 (volume) | Always liquid. Boils at `Tb = 1/(1/373.15 − R/40660·ln P)` (constant-ΔH Clausius–Clapeyron), only when unsealed, with open P forced to 1 atm. Never freezes. No sub-boiling evaporation | Boil-off = excess sensible heat / 40660. Vapour in a sealed headspace = Antoine 8.07131/1730.63/233.426 (valid 1-100 °C), clamped to 10 atm, 0 below 0 °C, and **carries no moles** |
| Ethanol `"C2H5OH"` | vessel.rs:887-911, 1214-1217, 990-1002 | Always a separate "organic" layer (ρ 0.789, n 1.361), but counted as reaction solvent for equilibria. Boils at the pure-ethanol Tb (351.5 K, ΔH 38 560) | Same latent-heat clamp. No vapour pressure in a sealed vessel |
| Inert imports (`phase_model:"inert"`) | vessel_phase.rs, compound_thermo.rs | `neat_phase(T,P)`: solid if T < Tm(P) (Clapeyron, linear in ΔP), else gas if P_sat(T) ≥ P_ambient, else liquid. Each neat liquid is its own layer | Melt/freeze plateau with ΔHfus. Boil-off only unsealed, at the compound's own pure Tb. Dissolution: instantaneous, capped by `solubility_g_per_l` × litres of **water** (0.1 g/L if unknown, ≥500 g/L = miscible). Dissolved part never evaporates |
| Ionic solids / precipitates | vessel_eq.rs:115-147, solubility.rs | Solid if IAP ≥ Ksp(T) (van't Hoff, constant ΔH; 92/128 table rows have ΔH = 0). Solved only if water > 0.05 g. Ksp from table → PubChem → rule guess 10^−(4+2·zc·za) → 3 mol/L default cap | Instantaneous (coupled Newton). Settling: Stokes with ρ_liquid 1.0, η 1e-3 (vessel_ext.rs:231) |
| Known neutral molecules (`I2(aq)`, `CO2(aq)`, `NH3`, `CH3COOH`, `C2H5OH`, `H2O2`, ...) | compound_model.rs:123-140, 246-270, 337-349 | **No condensed or gas phase at all.** A solid import becomes the dissolved species even with no solvent; a liquid or gas import becomes a 0.10 M aqueous solution | None, except CO2(aq) |
| Gases | vessel.rs:649-674 (CO2 only), 754-771 (kinetic gas products), gas.rs | No gas phase or atmosphere. CO2(aq) degasses above k_H = 0.034 M/atm × total P. Kinetic gas products leave instantly (open) or enter the headspace (sealed) | First-order degassing, 0.15 s⁻¹ (×3.5 when stirred). Delivery tube: τ = 0.08 s. Collector held at exactly 1 atm |

Other places that set condition-dependent values:

- **Volume** (vessel.rs:1198-1217): `V = n(H2O)·18.015 + Σ_solutes n·M/2 + n(EtOH)·46.069/0.789 + Σ_neat n·M/ρ_liq`.
  - Every solute is assumed to have density 2 g/mL, organics included.
  - There is no temperature dependence and no excess volume.
- **Layer density** (vessel.rs:978, 532): `1 + 0.03·I` for the aqueous layer. 0.789 for ethanol. The neat liquid takes `rho_liquid`, which is `0.9·ρ_solid` when only a solid density is known (compound_thermo.rs build).
- **Headspace** (vessel.rs:915-961):
  - Volume floor of 10 mL.
  - `P = 1·T/T_room + p_sat,water + n_evolved·RT/V`.
  - Pop at 2.2 atm and burst at 6 atm by default. On pop the headspace is cleared and P is reset to 1.
- **Dissolution visuals** (web/src/app/visual_contents.ts:59, 102-109): a "ghost pile" shrinks at a constant
  `DISSOLVE_C = 0.2 g^(1/3)/s` (×3 when stirred). The engine has already dissolved the solid.
- **PubChem solubility** (web/src/pubchem/solubility_parser.ts:193-210): one water value, the one closest to 25 °C. All other solvents and temperatures are discarded.
- **NIST proxy** (web/src/pubchem/api.ts:121-184):
  - Antoine ranges are sampled into points and the range is lost.
  - `t_crit_k` is parsed by `server/data_proxy.py:134-135` but never forwarded. The engine uses `Tc = Tb/0.65`, which is not labelled as estimated.
  - ΔfH and S° are collapsed with `solid ?? liquid ?? gas`, so the phase they refer to is lost.

---

## 2. Status of prior F items in this area (verified against the working tree)

| F | Claimed | True status | Evidence |
|---|---|---|---|
| F3 volume | fixed | **Partial.** The fake 10 mL is gone: a dry solid shows 0 mL. The volume model is otherwise unchanged and wrong for most mixtures | vessel.rs:1203-1216. P13: 50 mL water + 20 mL acetone = **57.8 mL** (real ≈ 69). P14: 100 mL water at 295 → 352 K = 100.000 mL (real +2.9 %). P3: 50 + 50 mL water/ethanol = 100 mL in two layers (real ≈ 96.5 mL, one phase). P7c: 10 g NaCl in 50 mL gives 55.0 mL and ρ 1.093 (real ≈ 53.1 mL, 1.13) |
| F4 ethanol layer | open | **Open, and generalised to every organic.** Each neat inert liquid is also its own layer | P3/Q7: ethanol and water form two layers. P12: hexane + toluene form two layers |
| F5 boiling | fixed | **Partial / superficial.** Tb(P) exists for H2O and C2H5OH as constant-ΔH Clausius–Clapeyron, but P is forced to 1.0 in open vessels and sealed vessels never boil. Mixtures boil component by component at the pure-component Tb. No elevation | vessel.rs:858-911. P3b: a 50/50 water/ethanol mix holds 351.5 K until every ethanol molecule is gone, then 373.1 K (real: the bubble point rises continuously from ~353 K). P13b: dissolved acetone never leaves; water boils at 373.1 K |
| F6 sealed pressure | fixed | **Partial.** The T/T_room scaling of air was added. Still: no air moles and no O2/N2, no vapour pressure of any volatile except water, Antoine clamped at 10 atm, no critical point, no P_ext input | vessel.rs:923-945. P5: sealed water at 627 K reads **12.1 atm** (real ≈ 180 atm; past 647 K it would be supercritical). P19: sealed ethanol at **561 K** (above Tc = 514 K) reads 1.9 atm. Q5: sealed hexane at 454 K reads 1.54 atm (real ≈ 14 atm) |
| F7 Henry | open | **Open.** Henry's law covers CO2 only, uses k_H 0.034 with ΔH −20 kJ and T clamped to 273–400 K, and is driven by total P, not p_CO2. No other dissolved gas is volatile | phase_transfer.rs:4, 28-35. vessel.rs:649-674. P16: 2 M NH3 boiled for 10 min: NH3 is fully retained (0.0998 mol, now 3.8 M, pH 13.9). Real: ammonia is expelled first |
| F8 Cp | fixed | **Partial** (not my area, but it drives the phase plateaus). Cp is a constant per gram per species, `add_portion` uses `4.184 × volume`, and the glass factor is 0.84 in `dose` but 0.84 × 0.15 elsewhere | vessel_phase.rs:126-158. vessel.rs:416, 460-462, 831 |
| F13 pH | fixed | **Superficial, with a new bug.** The pKw(T) correction has the **wrong sign**: pKw = 14 − (ΔH/R ln10)(1/T − 1/298) | vessel.rs:1238. Q2: pure water reads pH **9.29 at 353 K** (real 6.3), **3.52 at 241 K**, 5.66 at 273 K (real 7.47), and 6.85 at 295 K (real 7.08). Any solution with [OH⁻] ≥ [H⁺] is affected (see C19) |
| F14 water-only minerals | open | **Open.** The `has_water` gate (> 0.05 g) is unchanged. Ksp is applied over water + ethanol volume. pH and optics use the aqueous volume only | vessel_eq.rs:118-131. Q7: 10 g NaCl **fully dissolves** in 25 mL water + 25 mL ethanol, although even 25 g of pure water dissolves only 9.0 g. P7: no NaCl chemistry at all in neat ethanol |
| F16 phase stamped at import | in progress | **Partial.** Inert liquids are now dosed neat (good). Acids, bases, known molecules and **all gases** are still a 0.10 M aqueous solution with ρ 0.997. Known molecular solids dissolve with no solvent | compound_model.rs:337-349, 278-283. Q3: neat H2SO4 becomes "H2O4S (0.10 M)". Q4: PubChem ethanol becomes 0.10 M ethanol in water. P10: CO2 (dry ice) becomes 0.1 M CO2(aq). P11: "10 mL methane" adds 10 mL of water. Q1: 1 g I2 in a dry beaker becomes I2(aq) with 0 mL of liquid and no visible solid |
| F17 micro-scale | fixed | **Partial.** Solids are no longer zeroed below 1e-15 mol. But the volume floor of 1 mL (`.max(0.001)` L), the water gate of 0.05 g and the snapshot cut-off `mol <= 1e-7` remain | vessel_eq.rs:118, 120. vessel.rs:1008. P17: 11 µL 0.1 M AgNO3 + 11 µL 0.1 M NaCl gives **no AgCl** (real ≈ 1.1 µmol). The water gate blocks it |
| F18 freezing/melting | open | **Partial.** Inert compounds melt and freeze with latent heat at a Clapeyron-shifted Tm (P8b: naphthalene plateau at 353.4 K, correct). Still missing: water and solutions never freeze, no colligative depression, no sublimation, salts never melt, no decomposition | P1: water in a 240 K bath stays liquid (241 K, 50 mL). P2: 0.1 M NaCl at 260 K stays liquid. P18b: glucose solution at 268.7 K stays liquid |
| F27 rule solubility | open | **Open.** The rule Ksp 10^−(4+2·zc·za), the 3 mol/L cap for unlisted soluble salts, density M/38 (clamped 1.5–8) and ΔH = 0 are unchanged | solubility.rs:110-189 |
| F28 water-only Antoine | fixed (per CLAUDE.md) | **Open.** Water Antoine appears twice (vessel.rs:929, gas.rs:92) and is clamped at 10 atm. The collector is at 1 atm. There is no vapour pressure for any other liquid in a closed space | P5, P19, Q5 |
| F29 settling | open | **Open.** ρ_l = 1.0 and η = 1e-3 are hardcoded. A ×10 "aggregate" factor is applied. The density difference is floored at +0.05, so even solids lighter than the liquid sink | vessel_ext.rs:230-233 |
| F30 instant dissolution | open | **Open.** The ghost pile is a visual constant, decoupled from the chemistry (pH and conductivity jump at once) | visual_contents.ts:59, 102-110 |
| F31 evaporation | open | **Open.** `evaporation_g_s` is a reported constant (0.5 or 0.001). No species evaporates below its boiling point | vessel.rs:1162. P12b/P20: 10 mL hexane open for 2 h at 295 K stays 10.00 mL (real: gone within ~1 h). P8a: naphthalene does not sublime |
| F36 solubility parser | open | **Open.** Only the water value closest to 25 °C is kept | solubility_parser.ts:193-210 |
| F38 environment | open | **Open.** Room 295.15 K, ice bath 273.15 K, pop 2.2 atm, burst 6 atm, open P = 1 atm | lab.ts:219-222, 320. vessel.rs:582, 917 |
| F40 n, ρ | open | **Open.** Hardcoded n: 1.333 (aqueous), 1.361 (ethanol), 1.45 (neat). Layer density 1 + 0.03·I | vessel.rs:978-994. vessel_phase.rs:204 |
| F41 drop | open | **Open.** One drop is 0.05 mL for every liquid | vessel.rs:400 |
| F42 vapour cues | open | **Open.** Vapour is visible from 330 to 373 K. Boiling is shown only if T ≥ 373.15 K **and** water is present: boiling ethanol (351.5 K) shows `boil_intensity 0` | vessel.rs:1095-1104 |
| F43 water events | open | **Open.** Events exclude `H2O(g)` and treat T ≥ 372 K as "heating" | vessel_ext.rs:325, 375 |
| F47 morphology | open | **Open.** Particle size and kind are per-compound defaults. A solid "floats" if ρ < 1.0 (water's density), whatever the liquid is | solubility.rs:119-142. vessel.rs:1030 |

---

## 3. New findings (C1–C21)

### C1 (B) No vapour–liquid equilibrium for mixtures. Each component boils at its pure-compound Tb
- **Where:**
  - vessel.rs:858-911 (H2O, C2H5OH)
  - vessel_phase.rs:327-354 (inert, `c.boil_k(p)`)
  - vessel_phase.rs header: "Dissolved compounds do not evaporate or boil off"
- **Model:** a pure-component boiling clamp per species. No Raoult's law or activity coefficients, no bubble or dew point, and no vapour composition.
- **Wrong results:**
  - P3b: water/ethanol shows a 351.5 K plateau until ethanol reaches 0, then a 373.1 K plateau. A real 50/50 v/v mixture starts boiling near 353 K, the temperature rises continuously, and the vapour is about 65 mol % ethanol.
  - P12c: hexane/toluene boils at 341.9 K (pure hexane) until hexane is gone, then at 383.8 K.
  - P13b: acetone dissolved in water stays in solution forever; the water boils at 373.1 K.
  - P16: ammonia never leaves.
  - Not represented at all: azeotropes, steam distillation, salting out.
- **Invariant:** a boiling point is a condition-dependent value (it depends on composition and P), but it is used here as a per-species property.

### C2 (B) Sealed vessels have no vapour–liquid equilibrium, no vapour moles, no critical point
- **Where:** vessel.rs:915-961, vessel_phase.rs:327 (`if !self.sealed`), vessel.rs:865 and 892 (`!self.sealed`).
- **Model:**
  - Pressure: `P = T/T_room + Antoine_water(T).clamp(0,10) + n_evolved·RT/V_head`.
  - Ethanol and inert compounds contribute nothing to P.
  - The water vapour has no moles, so it is not in mass conservation and not in the gas link.
  - Liquid never converts to vapour.
- **Wrong results:**
  - P5: water reaches 627 K at 12.1 atm. P saturates near 11.6 atm because of the 10 atm clamp; real is about 180 atm.
  - P19: ethanol reaches 561 K at 1.9 atm (supercritical in reality, many tens of atm).
  - Q5: hexane reaches 454 K at 1.54 atm (real ≈ 14 atm).
  - Consequence: stopper pop and burst never trigger for solvents other than water, and are under-triggered for water above about 450 K.
- **Domain:** Antoine 8.07131/1730.63/233.426 is only valid for 1–100 °C. It returns 0 below 0 °C, where ice and supercooled water still have a vapour pressure.

### C3 (B) No solid–liquid equilibrium for the solvent: water never freezes, no colligative properties
- **Where:** absent. Only `step_inert_thermal` freezes inert neat liquids.
- **Wrong results:**
  - P1: water at 241 K is liquid.
  - P2: 0.1 M NaCl at 260 K is liquid.
  - P18b: a glucose solution (2.2 m) at 268.7 K is liquid. The real freezing point is about 269 K, so it would partly freeze.
  - Ice baths, freezing-point depression, cryoscopy, salt-and-ice baths, eutectics and recrystallisation by cooling (beyond Ksp(T)) are all impossible.
- Boiling-point elevation is also absent (C1).

### C4 (B) No sub-boiling evaporation and no sublimation for any species
- **Where:**
  - vessel.rs:1162 (`evaporation_g_s` is cosmetic).
  - `neat_phase` (compound_thermo.rs) returns Solid whenever T < Tm, whatever the vapour pressure.
  - The vapour curve is the liquid one, also used below Tm (it should be the sublimation curve).
- **Wrong results:**
  - P20: 10 mL hexane open for 2 h at 295 K loses nothing. The real loss is of order 10 mL/h from 38 cm².
  - P8a: naphthalene does not sublime.
  - P8b: molten naphthalene at 415 K (p_sat ≈ 15 kPa) loses 0 g.
  - P9b: iodine heated to 355 K gives no violet vapour (p_sat ≈ 1 kPa).
  - P14: open water at 352 K loses nothing in 15 min.
  - Crystallisation by evaporation and drying a precipitate are impossible.
- **Dry ice** (P10): it cannot exist. If it were an inert compound, the stored melting reference (216.6 K, which is really the triple point at 5.1 atm) would make it **melt** at 1 atm.

### C5 (B) Known neutral molecules have no condensed or gas phase
- **Where:** compound_model.rs:246-270 (`kind = "molecule"`), 299-307 (solid import → dissolved species when no `(s)` id exists), 337-349 (liquid or gas → 0.10 M solution).
- **Wrong results:**
  - Q1: 1 g iodine in a dry beaker becomes 3.94e-3 mol "I2(aq)" in 0 mL of liquid. It is invisible: no solid, no layer.
  - Q1b: 1 g I2 fully dissolves in 50 mL water. The real solubility is 0.33 g/L, so about 0.016 g should dissolve.
  - Q4: PubChem ethanol becomes 0.10 M aqueous.
  - Q3: neat H2SO4 becomes 0.10 M.
  - P10: CO2 becomes 0.1 M CO2(aq).
  - In a dry vessel, the leftover H⁺/OH⁻ (8.9e-11 mol) still exist (Q1).
- **Invariant:** phase is stamped by "has chemistry" and not derived. This is exactly the problem COMPOUND_PHASE_PLAN solved for inert compounds; the fix was not extended to reacting molecules.

### C6 (B) Gases are dosed as water
- **Where:** compound_model.rs:337-349 (any non-solid, non-inert-liquid becomes a 0.1 M solution, with water ≈ 1 g/mL).
- **Wrong result:** P11: "10 mL methane" adds 9.96 mL of water. The 1 mmol of CH4 above its solubility is then vented, giving `mass_lost` 0.0147 g.
- There is no way to put a gas (CO2, Cl2, NH3, HCl, O2) into a headspace or bubble it through a liquid.

### C7 (B) No liquid–liquid equilibrium: miscibility is hardwired, and solutes cannot partition
- **Where:**
  - `PhaseKind {Aqueous, Organic}` (vessel.rs:17-20).
  - Ethanol is always "organic" (vessel.rs:496, 547, 1069).
  - `neat_layers()` creates one layer per neat compound (vessel_phase.rs:188-212).
  - Inert compounds dissolve only into water (vessel_phase.rs:235).
- **Wrong results:**
  - P3/Q7: water and ethanol form two layers.
  - P12: hexane and toluene form two layers.
  - Not possible: iodine extraction into hexane, phase-transfer, salting out of an organic phase, or partition coefficients.
  - The separatory funnel (`remove_liquid_bottom`) treats every non-aqueous liquid as one phase with one averaged density, while the snapshot shows them as separate layers (vessel.rs:523-525 vs 1003-1004).
- **Layer order** is sorted by density (vessel.rs:1004) using hardcoded or estimated densities. This is fine in principle, but the densities are wrong (C8).

### C8 (D) The volume and density model is a set of constants
- **Where:** vessel.rs:1198-1217, 978, 532. compound_thermo.rs `build` (ρ_l = 0.9·ρ_s, or defaults of 1.0/1.1/1.35/1.5). compound_model.rs:343, 370 (0.997).
- **Model:**
  - Water occupies 18.015 mL/mol at every T.
  - Every dissolved species is M/2 mL/mol. For Na⁺ that gives 11.5 (real V̄° ≈ −1.2). For acetone, 29 (real 74). For glucose, 90 (real 112).
  - Ethanol is fixed at 0.789 g/mL.
  - No thermal expansion and no excess volume.
- **Wrong results:**
  - P13: 57.8 mL vs ≈ 69 mL.
  - P18: 60.0 mL vs 62.4 mL.
  - P7b: 25 g NaCl in 50 mL gives 60.6 mL (real 56.8 mL), and 21.2 g dissolves (real 17.9). The excess comes from Ksp being evaluated in molarity over the inflated volume.
  - P8b: molten naphthalene shows 4.87 mL (real 5.12 mL, ρ_l 0.976).
- **Knock-on effects:** every concentration, pH, Ksp test, colour path length and layer order inherits these errors.

### C9 (B) The solvent's boiling is special-cased and pinned to 1 atm when open
- **Where:** vessel.rs:858-859 (`p_atm = 1.0` when not sealed), vessel_phase.rs:94-96 (`ambient_atm`), vessel.rs:917 and 584.
- **What it blocks:** reduced-pressure distillation, rotavap, altitude, vacuum desiccator, pressurised reactor.
- Water and ethanol keep their own hardcoded Tb/ΔH and do not use the `CompoundThermo` machinery. Their ΔHvap is constant (water 40.66 kJ/mol at all T; the real value is 44.0 kJ/mol at 298 K).

### C10 (B) Gas–liquid transfer exists only for CO2, against total pressure, and products leave instantly
- **Where:** vessel.rs:649-674, phase_transfer.rs:15-55, vessel.rs:754-771 (kinetic gas products).
- **Model:** `c_sat = k_H(T)·P_total` with k_H CO2 0.034 M/atm, ΔH −20 kJ, T clamped to [273, 400] K. Degassing is first-order at 0.15 s⁻¹. Kinetic gas products (H2, O2, CO2 from the kinetic rules) never exist dissolved; they leave or go to the headspace at once.
- **Wrong results:**
  - In an open vessel, CO2 should relax toward p_CO2(air) ≈ 4e-4 atm, i.e. 1.4e-5 M. The code relaxes toward 0.034 M.
  - In a sealed vessel, CO2 is never reabsorbed from the headspace.
  - NH3 (P16), SO2, H2S, Cl2, HCl and O2 never exchange.
  - Bubbles nucleate without supersaturation.
- **Rates:** the 0.15 s⁻¹ constant does not depend on volume, area, stirring speed or gas.

### C11 (D) Solubility of molecular solids is a single water value at 25 °C
- **Where:** compound_thermo.rs `solubility_limit_g_per_l`, `is_miscible_liquid`. vessel_phase.rs:229-266.
- **Model:**
  - `s(T) = s_ref·exp(−ΔH_sol/R·(1/T − 1/T_ref))`, clamped to [1e-3, 1e3] g/L. The clamp caps sucrose (2000 g/L) at 1000 when a ΔH is given.
  - 0.1 g/L when unknown.
  - Miscible if s ≥ 500 g/L.
  - The basis is litres of water, not the solvent present.
  - Not used: the ideal-solubility model (Schröder–van Laar), although Tm and ΔHfus are already stored.
- **Domain:** water at 25 °C only. Mixed solvents, other solvents and temperature without ΔH_sol are not covered.
- **Wrong result:** naphthalene in hexane, or a sugar in ethanol, cannot be represented.

### C12 (B) Salt solubility is evaluated with the wrong solvent and volume, and with a hard water gate
- **Where:** vessel_eq.rs:118-131. solubility.rs:150-189 (rule and 3 mol/L cap), 345-362 (ideal molarity-based Ksp from g/L).
- **Wrong results:**
  - Q7: all of the 10 g NaCl dissolves in 25 mL water + 25 mL ethanol. That is impossible: the same 25 g of water alone can only hold 9.0 g.
  - P17: a 22 µL droplet has 0.022 g of water, below the 0.05 g gate, so no AgCl forms.
- **Solubility-limit Ksp:** it is ideal (no γ±). NaCl's log Ksp = 1.57 happens to work only because γ± ≈ 1 near saturation for NaCl. For CaCl2 or MgSO4 it fails.
- **Temperature dependence:** 92/128 table rows have ΔH = 0. Rule-guessed Ksp and the 3 mol/L cap are temperature-independent.

### C13 (D) Dissolution, precipitation and degassing happen in one step; the visual is a separate constant
- **Where:** `settle_after_addition` (vessel.rs:426-446) runs equilibria to convergence right after a dose. Ghost piles: visual_contents.ts:59, 102-110.
- **Wrong results:**
  - 5 g of NaCl reaches its final pH or conductivity at once, while the pile still shows for 15–50 s.
  - A 1 g lump and a fine powder behave the same.
  - Dissolution rate does not depend on undersaturation, T, stirring speed, particle size or solubility. The ghost rate is the same for sugar and for gypsum.
  - Precipitation has no supersaturation, no induction time and no Ostwald ripening, so particle size cannot be derived (F47).

### C14 (D) Settling uses a water-only Stokes law with fudge factors
- **Where:** vessel_ext.rs:224-240.
- **Model:** `v = (ρs − 1.0).max(0.05)·g·(10·d)²/(18·1e-3)`, with τ clamped to 8–300 s over a fixed 4 cm height.
- **Wrong results:** settling in ethanol (η 1.1e-3, ρ 0.79), glycerol (η 1.4) or hot water (η 0.28e-3 at 100 °C) is unchanged. Floating solids (ρs < ρl) still settle. Settling time does not depend on liquid height.

### C15 (D) Vapour-pressure curve: extrapolated without a range, and inconsistent with the latent heat
- **Where:** compound_thermo.rs `fit_vapor_curve`, `dh_vap_at`, `tc_k = Tb/0.65`.
- **Model:**
  - Two-parameter Clausius–Clapeyron, or Antoine with a grid-searched C.
  - No (Tmin, Tmax) is stored and no Tc cut-off is applied, so P_sat keeps growing past Tc and a liquid can exist above Tc.
  - Latent heat comes from Watson's correlation with an *estimated* Tc that is not listed in `estimated[]`, while the boiling T comes from the curve. The two are not linked by Clapeyron, so the energy balance and Tb are mutually inconsistent.
  - A single (Tb, 1 atm) point gives a Trouton line. Trouton's rule fails for H-bonded liquids: water's ΔSvap is 109 J/mol/K, not 88, so ln P is off by ~25 % slope.
  - The liquid curve is applied below Tm, where the sublimation curve applies.
- **Data loss:** NIST Antoine ranges and Tc from the proxy are dropped in `enrichWithLocalDataProxy` (api.ts:156-170).

### C16 (D) Melting: Clapeyron with estimated volumes, inert compounds only, no impurity depression
- **Where:** compound_thermo.rs `melt_k`, `build` (ρ_l = 0.9·ρ_s).
- **Model:** linear Clapeyron in ΔP. Valid for the bench (ΔP < 10 atm), but the estimated ΔV is always positive, so ice, Ga and Bi cannot be represented.
- **Not covered:**
  - Minerals and imported salts have no melting data path (KNO3, NaNO3, waxes as "ionic", eutectic mixtures).
  - The melt plateau in `step_inert_thermal` happens at pure Tm even when the solid is wet or mixed: no mp depression and no mixed melting point test.

### C17 (D) The headspace and gas-collection model has no gas phase
- **Where:** vessel.rs:915-961. gas.rs:86-95, 122-126, 196-235.
- **Model:**
  - Air is a pressure term (`1·T/T_room`) with no moles and no composition: no O2 for combustion or oxidation, no N2.
  - Headspace volume floor of 10 mL.
  - On a stopper pop the headspace is deleted (`headspace_gas_mol.clear()`, which does not count toward `mass_lost_g`) and P jumps to 1.
  - Collectors sit at exactly 1 atm, with water vapour only (Antoine, 0 below 0 °C).
  - No solubility in the trough water: NH3 or HCl collected over water would be fully absorbed in reality.
  - Delivery-tube flow uses a fixed τ of 0.08 s with no ΔP or viscosity dependence.
- **Wrong result:** an "inert atmosphere" or "under O2" condition cannot be set, and nothing can be bubbled into a liquid.

### C18 (C) Visual phase cues are hardcoded to water
- **Where:**
  - vessel.rs:1095-1104: `is_boiling = T ≥ 373.15 && aqueous`; vapour visible over 330–373 K; condensation from `T − room`.
  - vessel.rs:1162: `evaporation_g_s` is 0.5 or 0.001.
  - Bubble diameters per species: 2.0 mm (CO2), 3.0, 3.5, 4.0.
  - Refractive indices 1.333 / 1.361 / 1.45; scatter medium index 1.333 (vessel.rs:1296).
- **Wrong result:** P4: ethanol boiling at 351.5 K, losing 37 g, shows `boil_intensity 0` and low vapour visibility.

### C19 (B, cross-area) pKw(T) has the wrong sign
- **Where:** vessel.rs:1238.
- **Fix:** `pKw = 14 + (ΔH/(R ln 10))·(1/T − 1/298.15)` (ΔH = +55.84 kJ/mol). Better, take it from ΔfG of H2O(l), H⁺ and OH⁻.
- **Wrong results (Q2):**

  | T | Reported pH | Real pH |
  |---|---|---|
  | 241 K | 3.52 | ≈ 8.2 (supercooled) |
  | 273 K | 5.66 | 7.47 |
  | 353 K | 9.29 | 6.3 |

- **Secondary bug:** when [H⁺] = [OH⁻] the code takes the OH⁻ branch.

### C20 (D) Phase-change energetics rely on constant per-gram Cp
- **Where:** vessel_phase.rs:126-168, vessel.rs:460-462.
- **Model:** plateaus are computed from the excess heat over `cp_total` (correct form), but Cp and ΔHvap are constants. `add_portion` assumes 4.184 J/g/K and 1 g/mL for any transferred liquid.
- **Wrong result:** the mixing temperature when pouring ethanol or a hot melt between vessels is off.

### C21 (D) Data and provenance leaks in the phase path
- **Where:**
  - compound_thermo.rs build: defaults ρ (1.0/1.1 liquid, 1.35/1.5 solid), Cp 1.3/2.0 J/g/K and solubility 0.1 g/L are labelled `estimated`, but they reach the physics with no tier on the species rows (`tier: Tabulated` is hardcoded at vessel.rs:1074 and 1088).
  - `tc_k` is not in `estimated`.
  - The NIST ΔfH/S° phase is collapsed (api.ts:146-153).
  - solubility_parser.ts drops temperatures and solvents (F36).
- **Wrong result:** the UI shows estimated physics as "Tabulated".

---

## 4. Recommendations: one Gibbs-energy phase framework

### 4.1 Target model (replace every mechanism above with one)

1. **Per-species intrinsic record, per phase.** For each species i and phase π ∈ {g, l, s, aq}:
   - g°ᵢ,π(T) = h° − T s°, from NASA 7/9-coefficient or Shomate Cp(T) polynomials with the phase's T range.
   - Molar volume model: gas → EOS; liquid → Rackett/COSTALD from (Tc, Pc, ω, Z_RA); solid → ρs; aqueous → HKF V°(T, P) or Masson V̄°.
   - Everything condition-dependent (Tb, Tm, P_sat, k_H, solubility, density at T) **falls out of μ° differences**:
     - P_sat(T) = P° exp(−(g°_l − g°_g)/RT), with a fugacity correction at high P.
     - Sublimation: the same with g°_s.
     - Tm(P): where g°_s + ∫V_s dP = g°_l + ∫V_l dP. This is the general Clapeyron and handles negative ΔV (ice).
     - Henry: k_H = exp((g°_aq − g°_g)/RT).
     - Salt Ksp: exp(−(Σνg°_ions − g°_s)/RT).
     - Molecular-solid solubility: ln(xγ) = (g°_s − g°_l)/RT. This is Schröder–van Laar when only ΔHfus, Tm and ΔCp are known.
   - When only a curve is available (a PubChem vapour-pressure point set, a NIST Antoine fit with its range), store it as a *labelled anchor* that **defines** g°_l − g°_g, valid in its range with a tier. This is already the spirit of `CompoundThermo`; generalise it from "inert only" to every species, ionic and neutral included (fixes C5, C6, F16).
2. **Phases in the vessel:**
   - One gas phase: the headspace, plus for open vessels an infinite atmosphere reservoir with p_N2, p_O2, p_Ar, p_CO2 and p_H2O (relative humidity) at P_ext.
   - N liquid phases, from a stability test.
   - Pure solids.
   - Species amounts live **per phase**, replacing `species_mol` + suffix conventions.
3. **Equilibrium condition:** μᵢ,π = μᵢ,π′ for every species present in two phases, plus the existing reaction equilibria.
   - Implement phase transfers as extra "reactions" (X(l) ⇌ X(g), X(s) ⇌ X(aq), X(org) ⇌ X(aq), H2O(l) ⇌ H2O(s)) in the existing coupled Newton in `vessel_eq.rs::solve_coupled_equilibria`.
   - Activities: γx for liquids, fᵢ/P° for gas, 1 for pure solids.
   - This yields Raoult/bubble points, azeotropes, colligative ΔTf/ΔTb, Henry for every gas, sublimation and freezing, all from one solver.
4. **Gas EOS:**
   - Ideal gas by default.
   - Peng–Robinson (Tc, Pc, ω; van der Waals mixing rule, k_ij = 0) for P > ~5 atm or near Tc. At T > Tc the cubic has one root, so a supercritical fluid appears automatically.
   - A sealed vessel is an isochoric flash (V_head, T, n) → P, which fixes C2.
5. **Activity models (pluggable `ActivityModel` per liquid phase):**
   - Electrolytes in water: Truesdell–Jones / B-dot as in PHREEQC `llnl.dat`, upgrading to Pitzer (`pitzer.dat`) for brines. The A and B parameters come from ε(T) and ρ(T) of the solvent.
   - Non-electrolytes and mixed solvents: UNIFAC (original Hansen/Fredenslund for VLE; UNIFAC-LLE (Magnussen) for LLE; Dortmund modified UNIFAC where its public parameters exist). Groups come from SMILES via RDKit in the pipeline (`pipeline/joback_estimator.py` already does SMARTS group decomposition).
   - Ions in non-aqueous or mixed solvents: Born solvation correction from ε of the phase. This is a labelled "Estimated" tier and is broad and cheap.
6. **LLE:** a Michelsen tangent-plane-distance stability test, run when composition changes by more than a threshold (dose, pour, ΔT > 2 K), then a Rachford–Rice-style split. Layer order comes from the computed phase densities. This replaces `PhaseKind::{Aqueous, Organic}` and the per-compound neat layer (C7, F4).
7. **Volume/density** (C8, F3, F40):
   - V = Σ nᵢ V̄ᵢ(T, x).
   - Water: IAPWS-95/IF97, or the Kell polynomial for 0–150 °C (one formula, broad).
   - Organic liquids: COSTALD (Hankinson–Thomson) from Tc, Pc, ω_SRK and V* (or Rackett with Z_RA).
   - Ions: infinite-dilution V̄° (HKF, or Millero's tables via PHREEQC `-Vm`) plus the Debye–Hückel limiting slope.
   - Excess volume: neglect at first (labelled), or Redlich–Kister from data later.
   - Refractive index: Lorentz–Lorenz from molar refraction R_D, which is intrinsic and computable from atom/group increments. This lets the optics use real n for every layer.
8. **Rates toward equilibrium** (C10, C13, C14, F30, F31): every phase transfer is rate-limited, with ΔC* computed by the equilibrium solve:
   - Dissolution and growth of particles: dm/dt = −k_s·A·(c_sat − c). Use Ranz–Marshall Sh = 2 + 0.6 Re^½ Sc^⅓, with Re from the stirring speed via a slip-velocity correlation (Levins–Glastonbury). The particle population is tracked with 3 moments (number, area, mass), so A is known and size is derived (F47).
   - Precipitation:
     - Classical nucleation, J = A exp(−16πσ³v²/(3k³T³ ln²S)), with σ from the Mersmann estimate σ ≈ 0.414 kT (ρs N_A/M)^(2/3) ln(cs/c_eq). It needs only solubility and density, so it is broad.
     - Growth by diffusion-limited k_d.
   - Evaporation (open surface): J = k_g·A·(Σγxp_sat − p_∞)/RT, with k_g from a natural-convection Sherwood correlation (Sh = 0.54 (Gr·Sc)^¼) and D_gas from Fuller.
   - Boiling: the bubble-point energy surplus, split by vapour composition y.
   - Gas–liquid exchange: dC/dt = k_L·a·(C* − C), C* = p_i/k_H(T). k_L from the Higbie/Calderbank correlation, a from the surface (unstirred) or bubble swarm (sparging).
   - Diffusivities: Wilke–Chang (liquid) and Fuller (gas). Viscosity: IAPWS 2008 for water, Orrick–Erbar/Joback group contribution or DIPPR-101 coefficients for organics, Chung for gases, Grunberg–Nissan mixing.
   - Settling: Stokes, then Schiller–Naumann drag and Richardson–Zaki hindrance, with the actual layer's ρ and η, and the actual liquid height.
9. **Energy:** one enthalpy balance, H = Σ nᵢ hᵢ,π(T). T is solved from H, so latent heats are H_g − H_l at the actual T and plateaus emerge. This replaces the per-species clamps (and F8). The pKw sign bug (C19) disappears once Kw comes from ΔfG.

### 4.2 Broad vs narrow: equations used today and their replacements

| Today | Domain / failure | Broad replacement |
|---|---|---|
| Constant-ΔH Clausius–Clapeyron (H2O, EtOH, 2-point fits) | ±10–20 % in P beyond ±50 K of the anchor; diverges past Tc | Integrated Clapeyron with ΔCp (from Cp polynomials), or Wagner/DIPPR-101 with its range; above Tc, the EOS |
| Antoine (water, fitted C) | Only inside the fit range | Same fit, but store its range; outside it, fall back to g°-based P_sat with a tier |
| Trouton (88 J/mol/K) | Fails for H-bonded liquids (H2O 109, EtOH 110) and for small molecules | Joback/Constantinou–Gani Tb plus Riedel/Vetere ΔHvap; or the g° difference when ΔfH(g,l) is known (NIST) |
| Watson with Tc = Tb/0.65 | Tc estimate ±10 % | Real Tc from NIST/ChemSep/Wikidata, else Joback Tc (labelled) |
| Walden ΔSfus = 56.5 | Rigid molecules ±50 % | Measured ΔHfus (NIST, PubChem), else Chickos group additivity |
| Linear Clapeyron for Tm(P) | Fine below ~100 atm. ΔV sign is forced positive by the 0.9·ρs default | ΔV from real ρs and ρl (COSTALD at Tm) |
| van't Hoff Ksp, constant ΔH (or 0) | Poor beyond ±30 K. ΔH = 0 for 72 % of rows | ΔrG°(T) from species g°(T) (HKF for ions to 300 °C), or llnl.dat analytic logK(T) |
| Ideal Ksp from g/L solubility | Wrong for 2:1, 2:2 and concentrated salts | Activity-corrected Ksp (Pitzer/B-dot) when deriving from solubility |
| Henry 0.034 M/atm CO2 | One gas | Sander compilation k_H° and d ln k_H/d(1/T) for any gas; or g°_aq − g°_g |
| V̄ = M/2 | Not a model | V̄ from COSTALD (molecular solutes ≈ their liquid V), HKF/Millero V° (ions) |
| Stokes with water | Water at 25 °C only | Stokes/Schiller–Naumann with η(T, x) and ρ(T, x) |

### 4.3 Data: few large databases, mapped to parameters

| Parameter | Primary large source | Fallback / estimate |
|---|---|---|
| g°(T) for gas, liquid and solid phases with T ranges (NASA 7/9) | **NASA CEA thermo.inp** (~2000 species incl. condensed phases with transition T), **Burcat's Third-Millennium database** (~3000 species, NASA-7) | NIST WebBook Shomate (already scraped by `server/data_proxy.py`) |
| ΔfH°, S°, Cp (aqueous ions/complexes), V°, HKF | **SUPCRT/slop16** (HKF, 0–1000 °C, to 5 kbar), **PHREEQC llnl.dat** (≈1500 species and minerals, analytic logK(T)), `pitzer.dat` | `data/solubility.json` as the last tier |
| Tc, Pc, ω, Z_RA, V*, DIPPR-form P_sat, ρ_l, η_l, Cp_l, ΔHvap | **ChemSep pure-component databank** (free; ~450 compounds with DIPPR coefficients), **NIST WebBook** (Tc, Pc, Antoine with range), **Wikidata** (Tc, Pc, Tb, Tm for ~10⁴ compounds); the MIT-licensed Python `chemicals`/`thermo` packages aggregate these and can run in `pipeline/` | Joback (already in `pipeline/joback_estimator.py`) for Tb, Tc, Pc, ΔfH, Cp; Constantinou–Gani |
| Reference EOS for validation (water, CO2, NH3, ethanol, acetone, hexane, toluene, ...) | **CoolProp** (~120 fluids; offline in the pipeline to generate gates and fit tables, not in the WASM) | IAPWS-95/IF97 formulas for water in-engine |
| Henry constants | **Sander 2023 compilation** (≈4600 species, with T-dependence) | g°_aq − g°_g (HKF or ΔsolvG estimates) |
| UNIFAC group parameters | **DDBST public UNIFAC / Dortmund matrices** (published), UNIFAC-LLE (Magnussen) | none (ideal solution, labelled) |
| Solubility points (T, solvent) | PubChem PUG View (keep **all** points: fix F36), IUPAC-NIST Solubility Data Series | Schröder–van Laar + UNIFAC |
| ρs, colour, mp, ΔHfus | PubChem, NIST (condensed phase), CRC via Wikidata | Chickos ΔHfus groups |
| Dielectric constant ε(T) | ChemSep/DIPPR, IAPWS for water | Onsager estimate from dipole moment |

Wiring:
- Send `tc_k`, `pc_pa`, `omega`, `antoine{a, b, c, tmin, tmax}`, phase-tagged `dhf`/`s0`, `shomate[]` and `solubility_points[(solvent, T, value)]` through `CompoundRequest` (`web/src/types/sim.ts`, `compound_model.rs`). Stop collapsing them in `api.ts:121-184`.
- Seed the store from the pipeline bundle (F35).

### 4.4 Implementation steps (each stage shippable, with gates)

**Stage 0: bug-level fixes (≈1 day)**
- C19: fix the pKw sign in `current_ph` (vessel.rs:1238). Gate: neutral water pH 7.47 ± 0.03 at 273 K, 7.00 ± 0.02 at 298 K, 6.31 ± 0.03 at 353 K.
- F17/C12: replace the `has_water > 0.05 g` gate and the `.max(0.001)` L floor with scale-relative tolerances (vessel_eq.rs:118, 120; vessel.rs:341, 679). Lower the snapshot cut-off `mol <= 1e-7` (vessel.rs:1008) to a mass/visibility test. Gate: 11 µL + 11 µL 0.1 M AgNO3/NaCl gives ≥ 1.0 µmol AgCl(s).
- C12: Ksp must use the aqueous phase volume only (or, at Stage 3, activities in the phase). Gate (Q7): 10 g NaCl in 25 mL water + 25 mL EtOH leaves ≥ 1 g undissolved.
- C2 quick fix: sealed vapour pressure = Σ over volatile liquids of x·P_sat(T) (water: the existing curve without the 10 atm clamp; inert compounds: their `vapor_curve`; ethanol: a curve record), capped at Tc. Gate: sealed water at 473 K gives P = 16.8 ± 0.8 atm (P_sat 15.3 + air 1.6). Sealed ethanol at 400 K gives 6.3 ± 0.6 atm (P_sat ≈ 4.9 atm + air 1.36).
- C5: give known neutral molecules a `CompoundThermo` with phases. "Molecule" means the species reacts; it must not decide the phase. Gate: 1 g I2 into a dry beaker shows a 1 g solid. In 50 mL water, 0.016 ± 0.005 g dissolves.

**Stage 1: species store and μ°(T) (≈1 week)**
- New `engine/src/species_store.rs`: `SpeciesRecord { id (InChIKey), formula, smiles, phases: {g, l, s, aq}: PhaseData { nasa: Vec<NasaInterval> | shomate | anchor_curve, t_range, v_model }, tc, pc, omega, zra, vstar, unifac_groups, hkf, henry, rho_s, tier per field }`.
- `register_species` / `load_species_bundle` in lib.rs (F33). Build the bundle in the pipeline from NASA CEA + ChemSep + llnl.dat + Sander.
- New `engine/src/thermo_fn.rs`: g, h, s, cp(T) per phase, with cached values per vessel tick (recompute only when |ΔT| > 0.05 K).
- Derived P_sat(T), Tm(P), k_H(T) and Ksp(T) helpers. `CompoundThermo` becomes a view on this.
- Gates:
  - Water P_sat(298.15) = 3.17 kPa ± 2 %; P_sat(373.15) = 101.3 kPa ± 1 %.
  - Ethanol Tb = 351.4 ± 0.5 K; naphthalene Tb = 491 ± 3 K.
  - Ice Tm(1 atm) = 273.15 ± 0.1 K with dTm/dP < 0.
  - CO2 sublimation T at 1 atm = 194.7 ± 1 K.
  - I2 P_sub(298) = 41 ± 8 Pa.

**Stage 2: gas phase, atmosphere, EOS, Henry (≈1 week)**
- New `engine/src/gas_phase.rs`: headspace moles including air (N2/O2/Ar/CO2/H2O), V_head from capacity minus condensed volume, ideal or PR EOS (`eos.rs`).
- Open vessels exchange with an infinite atmosphere at `P_ext` and composition, which become vessel/room inputs (F38). `step_headspace` becomes a flash. A pop vents to P_ext, with the vented mass counted.
- Henry and degassing for every volatile solute. Delete `phase_transfer::step_gas_evolution` and the CO2 special case.
- Gas dosing: a gas import doses moles into the headspace, or sparges through the liquid (C6).
- Gates:
  - Open water + NaHCO3 + acid: CO2(aq) relaxes toward 1.4e-5 M (±50 %) with τ = 10–60 min unstirred.
  - 2 M NH3 at 363 K for 10 min stirred loses ≥ 50 % of NH3.
  - Sealed flask: CO2 reabsorbs after cooling.
  - Gas collected over water at 293 K: dry-gas fraction = 1 − 0.023 ± 0.002.
  - NH3 collected over water is mostly absorbed.

**Stage 3: liquid mixtures, VLE and SLE (≈2 weeks)**
- New `engine/src/activity.rs`: an `ActivityModel` trait; `BDot`/`Davies` with A(ε, ρ, T); `Unifac` (original + LLE parameter sets).
- New `engine/src/volume.rs`: IAPWS/Kell water, COSTALD, ionic V̄° + DH slope.
- Extend `solve_coupled_equilibria` with phase-transfer rows: H2O(l) ⇌ H2O(s) gives freezing and colligative effects; X(l) ⇌ X(g) gives VLE (bubble point when ΣP_i ≥ P_ext); X(s) ⇌ X(solvent) gives solubility via Schröder–van Laar + γ.
- Replace the hardcoded water/ethanol boiling in `step_thermal` (vessel.rs:858-911) and the inert boiling/melting clamps in `vessel_phase.rs` with the enthalpy balance + equilibrium (see F8).
- Gates:
  - 0.1 M NaCl freezes at −0.35 ± 0.05 °C.
  - 1 m glucose freezes at −1.86 ± 0.1 °C.
  - 1 m NaCl boils at +1.0 ± 0.15 K.
  - Ethanol/water at x = 0.2 has its bubble point at 356 ± 1.5 K.
  - The azeotrope lies at x_EtOH = 0.89 ± 0.03, 351.3 ± 0.5 K.
  - Hexane/toluene 50/50 mol has its bubble point at 355 ± 2 K.
  - 50 + 50 mL water/ethanol gives 1 phase and a volume of 100 ± 4 mL (ideal tier) or 96.5 ± 1 (with excess volume).
  - 100 mL water at 295 → 353 K expands 2.9 ± 0.2 %.
  - Naphthalene water solubility from Schröder–van Laar + UNIFAC is within a factor of 3 of 0.031 g/L.
  - NaCl in ethanol: 0.65 g/L within a factor of 3 (Born tier).

**Stage 4: LLE (≈1 week)**
- New `engine/src/lle.rs`: TPD stability test plus a two- or three-phase split. Liquid phases are generic and replace `PhaseKind`. Layers are sorted by computed ρ. `remove_liquid_bottom` drains phases in that order.
- Gates:
  - Hexane/water: 2 phases, water in hexane < 0.01 wt %, hexane on top.
  - Hexane/toluene: 1 phase.
  - I2 partition between hexane and water: K_D within a factor of 2 of 85 (hexane/water, 25 °C).
  - Water/ethanol: 1 phase at any ratio.
  - Salting out: 20 wt % K2CO3 splits ethanol/water.

**Stage 5: transport rates (≈1–2 weeks)**
- New `engine/src/transfer.rs`: particle moments per solid (replace `initial_solids` / `remaining_fraction`), Sherwood-based k for dissolution/growth, CNT nucleation, evaporation flux, k_L·a degassing, settling with real ρ/η.
- `settle_after_addition` stops jumping to equilibrium. It computes targets; `step` relaxes toward them semi-implicitly: n ← n* + (n − n*)·exp(−k·dt).
- Delete the ghost pile (visual_contents.ts:59-110); the snapshot carries the engine's undissolved mass.
- Gates:
  - 1 g NaCl (300 µm) in 50 mL stirred water dissolves in 10–60 s; unstirred takes 3–10× longer.
  - 10 mL hexane from 38 cm² at 295 K loses 3–20 mL/h.
  - 10 µm BaSO4 settles 4 cm in 150–300 s in water, ~1000× slower in glycerol.
  - The AgCl particle size distribution depends on mixing concentration: high S gives a smaller mean size.

### 4.5 Performance (20 Hz, several vessels)

- Problem size per vessel: ≤ 50 species, ≤ 4 phases, ≤ 80 equilibrium + phase rows. A dense Newton with LU on 80×80 is about 0.2 Mflop; 3 warm-started iterations is about 0.6 Mflop, < 0.3 ms in WASM. UNIFAC for 10 components and 20 groups is about 10⁴ flops. The PR cubic is closed-form.
- Cache g°(T) per species per tick. Recompute activity coefficients only when T or composition moves by > 0.1 %. Run the LLE stability test only on dose, pour or ΔT > 2 K (not every tick). Run the full solve on dose; per tick, take one Newton correction warm-started from the previous solution.
- Rate-limited transfer with exponential relaxation is unconditionally stable at dt = 50 ms, so no sub-stepping is needed. Reserve sub-stepping for the boiling and nucleation onset.
- Budget gate: `benchmark.rs`, 10 vessels × 30 species × 3 phases, < 2 ms per 50 ms tick (WASM, node).

---

## 5. Probes and results (built WASM, 2026-10-01 21:50 build)

| ID | Scenario | Engine | Reality |
|---|---|---|---|
| P1 | 50 mL water, 240 K bath, 20 min | 241.1 K, 50 mL liquid, pH 3.53 | Ice (freezes at 273.15 K) |
| P2 | 0.1 M NaCl, 260 K bath | 260.7 K, liquid | Frozen (f.p. −0.35 °C) |
| P3 | 50 mL water + 50 mL ethanol | Two layers, 50 + 50 mL | One phase, ≈ 96.5 mL |
| P3b | Same mix, heated at 150 W | 351.5 K plateau until EtOH = 0, then 373.1 K | Bubble point ≈ 353 K, rising continuously |
| P4 | 50 mL ethanol, open, 150 W, 300 s | Boils at 351.5 K, but `boil_intensity` 0 | Boils at 351.4 K (correct T); visual wrong |
| P5 | Sealed water, 300 W | 627 K at 12.1 atm, still 50 mL liquid | ~180 atm; supercritical above 647 K |
| P6 | Sealed water, default pop | Pops at 2.21 atm, then boils open | OK |
| P7 | 5 g NaCl in 50 mL ethanol | 5.0 g solid (via the water gate) | ≈ 0.03 g dissolves (right answer, wrong reason) |
| P7b | 25 g NaCl in 50 mL water | 21.2 g dissolved, V 60.6 mL, ρ 1.179 | 17.9 g, 56.8 mL, ρ 1.197 |
| P7c | 10 g NaCl in 50 mL water | V 55.0 mL, ρ 1.093 | ≈ 53.1 mL, 1.13 |
| P8 | Naphthalene model | Tb 485.7 K (supplied 491.15), Tm 353.35 K, ΔHfus 20.0 (Walden) | Tb 491.1, ΔHfus 19.0 |
| P8a | 5 g naphthalene, open, 1 h at 295 K | No loss | Slow sublimation (~mg/h) |
| P8b | Heated at 60 W | Melts at 353.4 K ✓, layer 4.87 mL, no loss at 415 K | Liquid ≈ 5.12 mL; evaporates (p_sat ≈ 15 kPa) |
| P9 | Iodine import | "molecule: I2(aq)" | Molecular solid |
| P9b | 1 g iodine heated to 355 K | Nothing shown (no solid, no gas) | Violet vapour, solid remains |
| Q1 | 1 g I2 in a dry beaker | I2(aq) 3.94e-3 mol in 0 mL | Solid |
| Q1b | 1 g I2 in 50 mL water | Fully dissolved | 0.016 g dissolves |
| P10 | CO2 import | 0.1 M CO2(aq) solution | Dry ice (solid at 1 atm) |
| P11 | "10 mL methane" | Adds 9.96 mL water; 0.92 mmol vented | Gas |
| P12 | 30 mL hexane + 30 mL toluene | Two layers | One phase |
| P12b / P20 | Hexane, open, 1–2 h | No loss | ~10 mL/h |
| P12c | Heat hexane + toluene | 341.9 K plateau, then 383.8 K | Continuous bubble-point rise |
| P13 | 50 mL water + 20 mL acetone | 57.8 mL, one phase ✓ | ≈ 69 mL |
| P13b | Heat it | Acetone stays; water boils at 373.1 K | Acetone distils first (≈ 333–350 K) |
| P14 | 100 mL water, 295 → 352 K | 100.000 mL | 102.9 mL |
| P15 | Vinegar + NaHCO3, 10 min | CO2(aq) 1.8e-6 M | Mostly via the kinetic gas rule; Henry path not exercised |
| P16 | 2 M NH3, boiled 10 min | NH3 retained (0.0998 mol), pH 13.9 | NH3 expelled |
| P17 | 11 µL + 11 µL AgNO3/NaCl | No AgCl | 1.1 µmol AgCl |
| P18 | 20 g glucose in 50 mL water | 60.0 mL | 62.4 mL |
| P18b | Same, at 268.7 K | Liquid | Partly frozen (f.p. ≈ 269 K) |
| P19 | Sealed ethanol, 200 W, 240 s | 561 K at 1.9 atm | Supercritical, > 60 atm (burst) |
| Q2 | pH of pure water at 241 / 273 / 295 / 353 K | 3.52 / 5.66 / 6.85 / 9.29 | 8.2 / 7.47 / 7.08 / 6.31 |
| Q3 | Neat H2SO4 import | "H2O4S (0.10 M)" | Neat liquid, 18 M |
| Q4 | PubChem ethanol import | 0.10 M aqueous | Neat liquid |
| Q5 | Sealed hexane, 150 W | 454 K at 1.54 atm | ≈ 14 atm |
| Q6 | Water in an ice bath, 1 h | 273.6 K liquid | OK (bath at 0 °C, no net freezing) |
| Q7 | 10 g NaCl in 25 mL water + 25 mL EtOH | All dissolved; two layers | < 9 g even in 25 g of pure water; one liquid phase |
| Q8 | NaCl 25 g / 50 mL at 273 / 373 K | 5.16 g left / 0 g left | 7.2 g / ≈ 5 g left (35.7 → 39.2 g per 100 g) |
| Q9 | KNO3 40 g / 50 mL at 273 / 325 K | 31.2 g left / 0 g | 33.4 g / ≈ 0 g (good: the table has ΔH) |

What works:
- Inert-compound melting and freezing with latent heat (P8b).
- Pressure-shifted Tm.
- Imported vapour curves for open-vessel boiling of a single neat liquid.
- Salt solubility vs T where the table has ΔH (Q9).
- Gas-collection mole conservation (gas.rs tests).

Everything above that requires *mixing* of phases or species, closed systems, sub-boiling transfer, or the solvent's own SLE is missing or wrong.
