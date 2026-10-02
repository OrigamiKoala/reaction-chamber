# Generalization audit (2026-10-01): evidence for `../generalization-master-plan.md`

| File | Area | IDs |
|---|---|---|
| `A_reactions.md` | which reactions happen, products, cascades, identity | A1–A16 |
| `B_thermo.md` | equilibrium constants, solver, activities, pH, energy balance | B1–B15 |
| `C_phases.md` | phase determination, VLE/SLE/LLE, volume, gas phase, transfer | C1–C21 |
| `D_kinetics.md` | rate laws, integrator, catalysis, heterogeneous rates, server barriers | D1–D22 |
| `E_appearance.md` | colour, solids, gases, flames, layers, log text | E1–E20 |
| `I_ingestion.md` | data ingestion, identity, provenance (its findings are numbered G1–G18; the master plan calls them I1–I18) | I1–I18 |
| `S_sources.md` | large external databases, licences, minimal source stack | — |

`probes/` holds the scripts that produced the numbers quoted in the reports, with their saved output (`*.out`).
- The `.mjs` probes load the built WASM from `web/src/wasm/engine/` through an absolute path in `common.mjs` / `lib.mjs`.
  Rebuild the WASM first, then run `node probes/<file>.mjs`.
- `pubchem_probe.mjs` and `pubchem_strings.mjs` need `pc.mjs`, an esbuild bundle of `web/src/pubchem/record_builder.ts`
  that was not copied here. Rebuild it with esbuild from `entry.ts`.
- The Python probes downloaded `llnl.dat`, `minteq.v4.dat` and NASA `thermo.inp` into a scratch directory. Those files,
  and any NIST WebBook pages, were deliberately not copied into the repo.

The numbers describe the working tree on 2026-10-01 (uncommitted changes included). They will change as the plan's
stages land; the corresponding gates in the master plan replace them as the source of truth.
