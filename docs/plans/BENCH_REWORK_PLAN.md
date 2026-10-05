# Bench Realism + UI Simplification Rework

Goal: make the 3D bench and reaction visuals as photoreal as practical in Three.js, and make the UI
much simpler to use. Chemistry stays in WASM; visuals only read `VesselSnapshot` (see `web/src/types/sim.ts`).

## Work split (strict file ownership — do not edit the other track's files)

| Track | Owns |
|---|---|
| **A. Rendering realism** | `web/src/bench/*`, `web/src/render/*`, `web/src/equipment/*` (new files under these dirs OK) |
| **B. UI/UX simplification** | `web/index.html`, `web/src/style.css`, `web/src/ui/*`, `web/src/main.ts` |

Shared, read-only for both: `web/src/types/*`, `web/src/sim/*`, `web/src/workers/*`, `web/src/pubchem/*`.
Gate for both: `cd web && npm run build` must pass (tsc strict + vite). Do NOT open a browser.

## Frozen API contract (`web/src/bench/scene.ts`, `web/src/bench/glassware.ts`)

Stubs already exist; Track A implements, Track B consumes. Signatures must not change.

```ts
class BenchScene {
  scene; camera; renderer;
  instruments: BenchInstruments;           // { thermometer, phMeter, balance, pressureGauge, hotPlate, burner } — created by the scene
  onSelectObject?: (type: 'vessel' | 'bottle', id: string) => void;   // bottle id = catalog entry id or PubChem BottleState id
  onDeselect?: () => void;                  // click (not drag) on empty space
  constructor(container: HTMLElement);
  setOpticsTables(t: OpticsTables): void;
  addVessel(state: VesselState, posX?: number, posZ?: number): GlasswareMeshBundle;  // positions may be ignored (auto bench slot)
  removeVessel(id: string): void;
  addReagentBottle(entry: ReagentCatalogEntry): void;       // auto-placed on reagent shelf
  addBottle(bottle: BottleState, posX?: number, posZ?: number): void;  // PubChem import, auto-placed
  getGlassware(id): GlasswareMeshBundle | undefined;
  getAllVessels(): VesselState[];
  setSelectedVessel(id: string | null): void;               // highlight + attach thermometer/pH probe (+gauge if sealed)
  updateInstruments(snap: VesselSnapshot, dt: number): void; // selected vessel only
  placeVesselOnHotPlate(id: string | null): string | null;   // returns displaced vessel id
  getHotPlateVesselId(): string | null;
  animatePour(sourceId, targetId, colorHex, onComplete?): void;     // source = vessel id or bottle id
  animateDrops(sourceBottleId, targetId, drops, colorHex, onComplete?): void;
  animateSolidAddition(sourceBottleId, targetId, colorHex, onComplete?): void;
  triggerBurst(id: string): void;
  focusVessel(id: string): void;
}
interface GlasswareMeshBundle {
  group; glassMesh; liquidMesh; vesselState; effects;
  updateLiquid(volMl, color, opacity?): void;
  applyVisual(snap, dtSeconds, opticsTables?): void;   // called at 20 Hz; animation must run per-frame internally
  setStirring(rpm: number): void;
  setSelected(on: boolean): void;
  getLiquidColorHex(): string;
}
```
Instrument readouts (unchanged): `thermometer.readout()`, `phMeter.readout()`, `balance.readout()`,
`pressureGauge.readout()`; `hotPlate.setPower(w)`, `hotPlate.setStir(on, rpm)`.

`onComplete` callbacks must ALWAYS fire exactly once (even if ids are unknown), because the UI performs the
actual chemistry dose inside them.

## User spec changes (2026-10-01)
- No plain-language "what you see" observation feed — must scale to thousands of reagents/compounds; no hand-authored per-compound text or visuals.
- Reagents panel is search-first (capped results, generic filter chips, recently used). 3D shelf is a capped LRU (~24 bottles), not the whole catalog.
- PubChem import lives inside the main reagent search (not buried in a menu); imported compounds are listed and addable like catalog reagents (marked visual-only).

## Progress
- [x] Survey + contract stubs
- [x] Track A: rendering realism (see Track A notes)
- [x] Track B: UI simplification (see Track B notes)
- [x] Integration build + CLAUDE.md update
  - Integrator: removed the name/formula colour heuristic (`guessContentColor`) — bottle contents now start neutral and
    are recoloured from the engine (`app/reagent_colors.ts` doses a throwaway vessel, Beer–Lambert over the snapshot
    spectrum / solid rgb, cached in localStorage `rc.reagentColors.v1`) via new `BenchScene.setBottleContentColor(id, hex)`.
  - Custom GLSL (glass, liquid, flame, particles, condensation, pour stream) reviewed against three r170 chunks; still
    needs a first in-browser check (no offline GLSL validator available).

## Track B notes
**Files.** New: `web/src/app/{lab.ts, reagent_library.ts, storage.ts}`, `web/src/ui/{add_card, reagent_panel, reagent_swatch,
vessel_panel, time_controls, top_bar, toast, modal, icons, dom, hint, self_test}.ts`. Rewritten: `index.html`, `style.css`,
`main.ts` (thin composition root + 20 Hz snapshot loop + shortcuts), `ui/advanced_view.ts` (floating Details drawer),
`ui/custom_reaction_modal.ts`, `ui/bottle_card.ts` (native `<dialog>` via `ui/modal.ts`). Removed: `ui/controls.ts`,
`ui/dosing_dialog.ts`, `ui/shelf.ts`, `ui/status.ts`. No observation feed (per spec change).

**UX.** Full-bleed bench; floating porcelain panels. Top bar: brand · engine status dot · Details (I) · More (⋯: Import from
PubChem → focuses search, Custom chemistry, Run self-test, engine/server status). Left "Reagents": one search box over catalog
(name/formula/id, ranked, capped at 50 + "N more") with generic filter chips (Solutions/Liquids/Solids/Indicators from
`form`/`dropper`; Imported), Recently used (localStorage, cap 24), and a PubChem section in the same results (autocomplete +
one-click import; Enter with no catalog match imports). Selecting a reagent (row or 3D shelf bottle) opens the inline Add card
(presets per mode mL/g/drops + custom amount, vessel chips defaulting to the selected vessel, inline overflow warning, one
"Add … to <vessel>" button). Imported compounds use the same card, flagged "visual only", with Properties (bottle card) and
"Use reacting version" when a catalog entry has the same formula. Glassware row at the panel foot. Right "Vessel": header
(focus, two-step remove), dark instrument-window readouts (Temp/pH/Volume+gauge/Mass, Pressure only when sealed), generic
Events log from `snap.events` (kind label + sim time), Controls (heat slider 0–1000 W step 50, Stir / Ice bath / Stopper
toggles, Ignite only when an organic phase or a GHS02 reagent is present), Contents (top 6 species, formula-prettified, M or
mol), Pour into (target chips, slider + number + presets 10/25/Half/All bounded by source volume & target free space, Empty
into waste with confirm). Bottom-centre time bar (pause/play, 1×/5×/20×, sim clock). Toasts replace alert(); one-time
dismissible hint. Keys: I details, WASD/arrows walk, Space pause (when not on a control), F focus vessel, / search, Esc closes menu → add card →
details → deselects. ≤760 px: panels become one bottom sheet at a time with a Reagents/Vessel switch.

**Contract usage / assumptions for the integrator.**
- `addVessel(state)` is called without positions (auto slot). The bundle's `vesselState` (if returned) is treated as canonical.
- Shelf: `addReagentBottle(entry)` is called on every select/add (LRU "mark recent"); at startup only Recently used are shelved,
  or the first 8 catalog entries for first-time visitors. `addBottle(bottle)` is called once per PubChem bottle id (`pc_<inchikey14>`).
- Pour/drop/solid streams use neutral `#e8f4fa` (PubChem bottles: their `color`); vessel→vessel pours use `getLiquidColorHex()`.
- Hot plate: UI tracks its own occupant as a fallback when `getHotPlateVesselId()` returns null, so only one vessel is ever
  heated/stirred; displaced vessels get `heater_w:0, stirring:false` + `setStirring(0)`. `hotPlate.setPower/setStir` are synced.
- `setSelectedVessel(id)` is re-called when a vessel's sealed state changes (stopper toggle or pop) so the gauge re-attaches.
- `bench.instruments` is optional-chained; readouts fall back to snapshot values when instruments are absent or throw.
- Animations are awaited via a once-guard with a 20 s safety timeout, then the dose/addPortion runs.
- `snap.burst` → `triggerBurst(id)` once + toast; notable new events (stopper pop, ignition, boil-over, dry-out…) toast.
- dt is computed per vessel (fixes the shared-dt bug). Imported PubChem bottles persist in localStorage (`rc.imported.v1`).

## Track A notes
**Units / frame.** 1 scene unit = **1 cm**, real dimensions (250 mL beaker 7 × 9.5 cm, 1000 mL 10.5 × 14.5, 50 mL 4.2 × 5.5,
Erlenmeyer 8.5 × 13.5 with 3.4 cm neck, 100 mL cylinder 25 cm on a hex foot, test tube 2.5 × 15 in a wooden rack). Bench top
is y = 0 (x −120…120, z −45…32). A vessel `group` origin is its bench contact point; `group.position` is world. Hot plate top
is y = 10 (`HOTPLATE_TOP_Y`). `addVessel` / `addBottle` ignore passed posX/posZ (auto slots).

**New files.** `render/glass_profiles.ts` (lathe profiles, volume↔height tables, graduations), `render/glass_material.ts`
(far/near split premultiplied glass, Fresnel alpha), `render/liquid_material.ts` (`LiquidBody`: per-pixel Beer–Lambert chord
through the inner profile, multi-layer, turbidity, meniscus/ripple/vortex/slosh, colour swirl), `render/particles.ts`
(`SpriteParticles`, instanced `BubbleSystem`), `render/flame.ts` (shader flame cluster), `render/textures.ts` (all procedural
CanvasTextures), `bench/lab_room.ts` (room, worktop, tiles, window, 3-tier shelf, lights, PMREM RoomEnvironment),
`bench/animations.ts` (`Animator`, pour / drops / spatula / ribbon / relocation tasks), `bench/shelf.ts` (LRU shelf),
`equipment/lcd.ts` (LCD canvas, rounded boxes, world-pose helper). Rewritten: `bench/scene.ts`, `bench/glassware.ts`,
`render/effects.ts`, all `equipment/*`. `render/liquid_shader.ts` kept (`computeSpectralColor` is reused).

**Renderer.** sRGB output, Neutral tone mapping, IBL from `RoomEnvironment`, PCF-soft key-light shadows (shadow map is
re-rendered only while things move / every 0.5 s), contact-shadow blobs, pixel ratio ≤ 2, `ResizeObserver` on the container.
Transparent assemblies (vessels, bottles, temp props) get a per-frame back-to-front `renderOrder` base (+1 far glass, +2/+3
liquid, +4 particles, +5 near glass, +6 decals/labels/smoke).

**API behaviour.**
- `addVessel` → sync bundle in the nearest free bench slot (front row either side of the hot plate, then back row).
- `removeVessel` disposes per-vessel materials/effects, frees the slot, clears hot plate / selection.
- `addReagentBottle(entry)` / `addBottle(bottle)` → **capped LRU shelf** (3 tiers × 9 = 27 slots; tier preference by kind:
  liquids bottom, droppers middle, jars top). Re-adding an id = mark most-recently-used. When full the least-recently-used,
  non-animating bottle is evicted and disposed (label texture + label material). Bottle kind/material come only from data
  (`form`, `by_mass`, `dropper`, `bottle_colour`); content colour is a generic formula/name heuristic (`guessContentColor`)
  or BottleState.color. Geometries/materials are shared per kind; only the label texture is per bottle. Metadata of every id
  ever added is remembered for temporary props.
- `setSelectedVessel(id)` → glow ring; thermometer + pH electrode fly (arc, ~1 s) into the vessel and then follow it (also
  while it is poured or moved); balance shows that vessel's glass + contents mass (no teleport); pressure gauge sits on the
  rubber stopper only while the vessel is sealed. Re-calling with the same id refreshes the gauge. `null` parks probes on the bench.
- `updateInstruments(snap, dt)` → lagged readouts; pH reads `---` until the bulb is under the surface and the probe has arrived.
- `placeVesselOnHotPlate(id)` → animated lift–slide–lower; previous occupant moves to a free slot; returns displaced id
  (`null` id clears the plate and returns the previous occupant).
- `animatePour(src, tgt, colour, cb)` (~2.4 s): vessel or shelf bottle lifts, yaws its spout toward the target, tilts until
  the (level, world-up) liquid surface reaches the lip, ballistic tapered stream; **cb fires when the stream lands**.
  Sources not on the shelf (evicted / never shelved), jars and droppers use a temporary pouring bottle beside the target.
  For bottles the stream uses the bottle's content colour if the passed colour is near-neutral; vessel sources use their own
  apparent colour once they have a snapshot.
- `animateDrops` → pipette taken from the dropper bottle (or a temporary one from above); ≤ 8 visual drops; **cb on first drop
  landing**. `animateSolidAddition` → spatula + falling powder (**cb on first contact**), or a falling metal ribbon when the
  shelf metadata looks like a bare metal (`looksLikeMetal(formula,name)` + `form/by_mass`; id regex only as a last-resort
  fallback). All `onComplete` are once-guarded, fire even for unknown ids, if a task throws, and after a 7 s wall-clock
  fallback (hidden tab pauses rAF).
- `triggerBurst(id)` → glass shards fly and settle, liquid spreads as a puddle; also triggered by `snap.burst` / `burst`
  event. Snapshot events handled: `stopper_pop` (stopper flies + puff), `boil_over` (spill down the outside + puddle),
  `splatter`.
- `focusVessel(id)` → 0.85 s tween of orbit target + distance (user drag cancels it).
- Picking via invisible proxies (`userData.pick = {type,id}`); click = < 5 px movement; empty click → `onDeselect`; hover →
  pointer cursor + ring (vessels) / label glow (bottles). OrbitControls: damping, no pan, polar ≤ 79°, distance 16–190 cm.
- Bundle: `applyVisual` (20 Hz) only sets targets (layer k, scatter, volume, effects); everything animates per frame inside
  the scene loop. `vesselState.currentVolumeMl/liquidColor/temperatureK/ph` are updated from snapshots
  (`liquidColor` = apparent colour). `updateLiquid(vol, colour, opacity)` still works (opacity = tint strength).
  `setStirring(rpm)` shows a spinning PTFE bar + vortex. `glassMesh` = near glass half (far half is its child),
  `liquidMesh` = absorb pass side mesh (other liquid passes are children).

**Known limitations.** No true refraction (edge darkening + reflections stand in); the liquid surface tilt during pours is a
plane through the axis (not volume-exact); shards land on the support the vessel stood on; Erlenmeyer chord uses a cone fit;
shader code is compiled only at runtime in the browser (not verified headlessly here).
