> **Superseded 2026-10-07**: the rate-calculation part of this plan (xTB transition-state search, ORCA refinement, rate queue, anchoring table) was removed after the timing test; see `docs/plans/rates-from-data-plan.md` section 8. The static-build, provider and licence parts still stand.

# Local full engine (`python3 run.py`) and the static web build

Goal: `python3 run.py` serves the same app as GitHub Pages, plus everything that is too expensive or not
redistributable for a static site. Both use the one Rust/WASM engine and the one TypeScript frontend; the
difference is only which *providers* feed the engine data.

| Provider | Local (`run.py`) | Static (GitHub Pages) |
|---|---|---|
| Engine, all chemistry | WASM in the browser | same WASM |
| Engine data files (`engine/data`, `web/public/data`) | yes | yes, if the licence allows redistribution |
| Reaction rates beyond the template rules | live xTB transition-state search on the server, cached in SQLite | shipped rate table exported from the local DB; later an ML model for reactions not in the table |
| NIST WebBook proxy (not redistributable) | yes (not yet wired into imports) | no |

## State found (2026-10-06)

- `server/barrier_workflow.py` was not a transition-state calculation: it stretched the bond between atoms 0 and 1
  of the first reactant by 0.6 A and took the single-point energy difference; a missing imaginary frequency was
  replaced by -480 cm-1. `server/calibration.py` fitted invented "xTB" numbers. The M7 gate tested that table.
- The engine had `NetworkGeneratorConfig.precomputed_barriers` (template id -> barrier) that nothing filled.
- The web app only pinged `/api/health`; nothing on the bench asked the server for rates. `PropertyResolver`
  (NIST proxy) is defined but unused.

## Design

1. Engine `rate_store.rs`: global store of per-reaction rates keyed by a structural key
   (`template+variant | sorted reactant graph hashes >> sorted product graph hashes`), independent of species ids,
   so a table exported on one machine applies on another. Generation counter; a vessel re-applies stored rates to
   its generated rows and regenerates the network when the counter moves.
2. Engine queues a *rate request* for every generated reaction it uses that has no stored rate and that a TS search
   can address: atom-mapped reactant / product graphs (from the template edits), template estimate (A, Ea),
   pathway count, solvent class. Variants with catalysts (H+/OH- orders) and templates with unmapped extra products
   are not requested. WASM: `take_rate_requests`, `register_reaction_rates`, `rate_store_size`.
3. Server `ts_search.py`: mapped graphs -> RDKit with explicit, mapped hydrogens -> reactant complex by distance
   geometry with the forming bonds at start distance -> two-stage relaxed scan (form, then break) with GFN2-xTB +
   ALPB solvent (tblite) -> P-RFO refinement on a numerical Hessian -> exactly one imaginary mode that moves the
   reacting bonds. `thermo.py`: quasi-RRHO (Grimme 2012), rigid rotor, Sackur-Tetrode, 1 M standard state.
   Separate reactants: lowest of a few conformers. Eyring with Wigner tunnelling; Arrhenius A and Ea from
   dH++ and dS++.
3b. Energies (user decision 2026-10-06: the local engine must be as accurate as possible, no plain xTB numbers):
   xTB only finds the path and the TS guess; ORCA 6.1.1 (`~/orca_6_1_1_macosx_arm64_openmpi411/orca`, found on the
   machine) refines the TS at DFT level (r2SCAN-3c + CPCM/SMD, OptTS + Freq) and gives the barrier from
   DLPNO-CCSD(T)/def2-TZVP + SMD single points (DFT single point where CC does not fit in memory). Accuracy order the
   rate provider follows: measured rate > DLPNO-CCSD(T)//DFT anchored on the rule > rule > ML (web only) > xTB.
   ORCA helper binaries were blocked by Gatekeeper (`otool_gcp` killed); the user clears the quarantine flag.
4. Server `rate_table.py`: calculated absolute barriers are not trusted blindly; within one template/variant/solvent group the
   xTB rates are anchored on the template rule (mean ln k offset) and combined with the rule by inverse variance
   (`server/data/rate_combination.json`). One calculation in a group returns the rule itself.
5. Server: persistent request queue (SQLite), worker processes, endpoints `/api/rates/request`,
   `/api/rates/table`, `/api/rates/status`; `run.py --flywheel` drains the queue offline;
   `run.py --export-rates web/public/data/rates.json` writes the table the static build ships.
6. Web `rate_resolver.ts`: local mode = poll requests, send to server, register the table; static mode = register
   the shipped table. `run.py` rebuilds `web/dist` when it is stale and serves every file in it.

## Progress

- [x] 1 engine rate store + structural key (`engine/src/rate_store.rs`, WL graph hashes; gated by `engine/tests/rate_store.rs`)
- [x] 2 mapped requests + WASM API (`wasm_rates.rs`) + worker / SimController (`tests/rate_store_e2e.mjs`)
- [x] 3 xTB path + saddle (`server/ts_search.py`): SN2 validated (one imaginary mode, connects); E2 and ester
      hydrolysis still unreliable (see below)
- [x] 3b ORCA layer (`server/orca_refine.py`, `rate_calc.py`); OpenMPI 4.1.6 installed by conda at
      ~/.local/share/reaction-chamber/openmpi-4.1, forwarded to the ranks with OMPI_MCA_mca_base_env_list
- [x] 4 rate table / anchoring (`server/rate_table.py`, `server/data/rate_combination.json`)
- [x] 5 server queue + worker + endpoints (`rate_queue.py`, `main.py`), `run.py --flywheel / --rates-status /
      --export-rates / --retry-failed`; old fake modules deleted
- [x] 6 web `rate_resolver.ts`; `run.py` rebuilds WASM + web when stale (`server/build.py`) and serves all of dist
- [x] tests: `tests/test_rate_pipeline.py` (13), `engine/tests/rate_store.rs` (3), `tests/rate_store_e2e.mjs`
- [x] first complete ORCA run end to end (2026-10-07): bromoethane + OH- in water, xTB saddle -437 cm-1 (40 s), ORCA
      saddle -320 cm-1, dG++ 31.2 kcal/mol (dH++ 24.9, dS++ -21.2 cal/mol/K), k 9.7e-11 M-1 s-1, 26 min with 7 MPI ranks
      on a loaded machine. The template rule gives 8.5e-7 M-1 s-1 (dG++ 25.7): the absolute calculation is ~5.5 kcal/mol
      too high, the known overestimate of hydroxide desolvation by implicit solvent; the anchoring removes it, so absolute
      calculated barriers must never be used directly for ionic steps in water.
- [x] E2 and ester hydrolysis saddles validated on xTB after the checks (reaction-coordinate following, bond character
      >= 0.3, both ends relaxed, no foreign bonds): E2 -441 cm-1; ester -505 cm-1 on the addition / proton transfer /
      leaving-group path (the near-barrierless path's saddle does not converge and is skipped)
- [ ] cluster-continuum (explicit waters around small anions) would remove most of the 5 kcal/mol error at the source
- [x] CLAUDE.md: external dependencies section, requirements.txt, Pages workflow

## Decision 2026-10-07: no calculations during a session

The first full calculation took 26 min; the user would have closed the app. The server now only queues requests by
default (`run.py --compute-rates` opts in to background computing); rates are produced offline with `run.py --flywheel`
and shipped as the table both builds load (and as the ML training set). Coverage then depends on which reactions get
queued: from bench use, or from an offline enumeration of template reactions over the catalog (not built yet).

## Licences (user decision 2026-10-06: integrate first, resolve later)

The static build may ship any database the local build uses; licence questions are flagged here, not blocking.
Flagged: NIST WebBook / SRD data (`server/cache/nist_cache.db`), Mayr database (`engine/data/mayr_parameters.json`),
anything else the data agent adds with a restrictive licence. Academic use is not automatically fair use for
republishing a whole database on a public site; check before announcing the site.

## Later

- ML model for the static build: features from the mapped reaction (template, variant, centre environment) ->
  ln k correction over the template rule; trained on the exported table; runs inside the engine (one code path).
- NIST proxy into imports (local only), GitHub Pages workflow (relative `base`, `/data` paths).
