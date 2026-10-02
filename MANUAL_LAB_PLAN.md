# Manual Lab Rework Plan

Goal (user request): the bench should be operated by hand, like a real lab — pick a bottle off the shelf with the mouse,
carry it to a vessel, lift (tilt) it to pour, release to stop; measure everything with graduated glassware and a real mass
balance; a large menu of glassware (volumetric flasks, burettes, cylinders, pipettes, gas tubes, titration setup, …); the
reaction timer must not run until a reaction actually starts.

## Phases

| Phase | Work | Owner (agent) | Status |
|---|---|---|---|
| 0 | Shared contract: `VesselType` union (`types/index.ts`), `VesselConfig.type` widened | lead | done |
| 1a | Lathe profiles for every `VesselType`; obvious graduation lines / level line / reading | glass-profiles agent | done (52 profiles; bundle: levelReadingMl, scaleReadingMl, readingAnchorLocal, tipLocal, setStopcock, setPlungerMl, setLidVisible) |
| 1b | Glassware catalog (`app/glassware_catalog.ts`) + Glassware menu panel (tab beside Reagents) | catalog-menu agent | done (52 types, tsc+build pass) |
| 1c | Balance rework (pan load, tare key) + reaction timer (starts at first real reaction) | balance-timer agent | done (tests/reaction_clock.mjs passes); scene must wire pan load + tare pick (handling agent) |
| 1d | Manual handling: grab/carry/drop, tilt-to-pour (liquids, solids, droppers, vessel→vessel), balance/hot-plate placement | handling agent | done (tests/handling_math.mjs, tests/flow_e2e.mjs) |
| 2a | Titration station (manual stopcock), indicators, separatory funnel | titration agent | done (tests/titration.mjs, titration_rig.mjs, engine/tests/titration_funnel.rs) |
| 2b | Pipettes (draw/dispense), gas collection, filtration | pipette-gas agent | done |
| 3 | Integration: build, engine/e2e checks, CLAUDE.md update | lead | done (all tests green; browser verification by user pending) |

## Contracts (Phase 1 agents code against these)

### Balance (`equipment/balance.ts`)
```ts
class Balance {
  group: THREE.Group;
  setLoad(totalMassG: number | null): void;     // everything on the pan (glass + contents); null = empty pan
  tare(): void;                                  // zero the display at the current load (T key / TARE key / vessel panel)
  panWorld(): { center: THREE.Vector3; radius: number; topY: number };  // pan surface in world coords (group is positioned by BenchScene)
  tareKey: THREE.Mesh;                           // clickable key; mesh.userData.pick = { type: 'balance-tare', id: 'balance' }
  update(snap: VesselSnapshot | null, dt: number): void;  // kept for compatibility; may be a no-op apart from lag smoothing
  readout(): { mass_g: number; formatted: string; stable: boolean; tared: boolean };
}
```
Lab: `lab.totalMassG(vesselId): number` = catalog glass mass + `snapshot.contents_mass_g`.

### Glassware catalog (`app/glassware_catalog.ts`; `app/lab.ts` re-exports `GLASSWARE`, `glasswareSpec`, `GlasswareSpec`)
```ts
type GlasswareCategory = 'beakers'|'flasks'|'cylinders'|'volumetric'|'burettes'|'pipettes'|'tubes'|'gas'|'funnels'|'dishes';
interface GlasswareSpec {
  type: VesselType; label: string; category: GlasswareCategory;
  capacityMl: number; glassMassG: number; innerRadiusCm: number;
  description: string;          // one line, e.g. "Class A, ±0.08 mL — to contain 100 mL at 20 °C"
  tolerance?: string; icon: IconName;
}
```

### Handling (`bench/handling.ts`, owned by the handling agent)
See that agent's brief; scene exposes `onHint(text|null)`, `onPourState(state|null)` callbacks for the UI and a
`flow` sink the Lab implements (`Lab.openFlow(...)`).

## Progress log
- 2026-10-01: plan written, contract types added.
- 2026-10-01: 1b catalog + Glassware tab finished. Waiting on 1a (profiles), 1c (balance/timer), 1d (handling).
- 2026-10-01: 1c balance + reaction clock finished (`app/reaction_clock.ts`, `Lab.reactionClock*`, `Lab.totalMassG`, `T` = tare).
- 2026-10-01: 1a profiles finished. Burette/funnel/pipette support stands are built into the vessel bundle (setRackVisible hides them). Waiting on 1d handling.
- 2026-10-01: Phase 1 integrated (build + 4 test scripts green). Phase 2 agents launched. Known engine issues from 1d: pH depends on solid dose increment (NaHCO3 2.5 g one-shot 6.24 vs 7.13 incremental); `solid_dissolved` events flood the 80-entry log on long solid pours.
- 2026-10-01: titration agent finished: `bench/titration.ts` (+`titration_math.ts`, `equipment/stir_plate.ts`, `app/titration_kit.ts`, `ui/titration_hud.ts`). Station = clamp + burette + stirrer/tile at (-44, -3); stopcock levers (drag / click / wheel / Esc) drive real engine drains (`Lab.openDrain`, `DrainSink`); separatory funnel drains the densest layer first (engine `remove_liquid_bottom`, worker msg `VESSEL_REMOVE_LIQUID_BOTTOM`); methyl red added to the engine catalog; tall targets (burette top) are captured by screen position in `handling.ts`. Tests: `tests/titration.mjs`, `tests/titration_rig.mjs`, `engine/tests/titration_funnel.rs`.
- 2026-10-01 (pipettes / gas / filtration agent): pipettes (`bench/pipetting.ts`, `pipetting_math.ts`, `equipment/pipette_bulb.ts`; handling `mode: 'pour' | 'pipette' | 'syringe'` by `profile.kind`; drag up = draw, drag down = dispense, Shift = fine). Gas collection: engine `gas.rs` (delivery-tube links, `vessel_gas_link/unlink/vent`, `snapshot.gas`), `bench/gas_collection.ts` (bent-tube mesh, drag the tube end onto a collector, plunger / gas column visuals), `ui/gas_section.ts`, `app/setups.ts` + `app/gas_kit.ts` ("Setups" at the top of the Glassware menu). Filtration: `bench/filtration*.ts`, `Lab.connectFilter` (funnel on flask, liquid runs through, solid stays), `app/filter_kit.ts`. Tests: `tests/pipetting_math.mjs`, `tests/pipette_e2e.mjs`, `tests/gas_collection.mjs`, `cargo test gas`. Not verified in a browser.
