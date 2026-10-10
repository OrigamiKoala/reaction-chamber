# Reaction viewer: molecular view of a vessel (plan, 2026-10-09)

A **Molecules** tab in the right panel shows a small 3D box of the selected vessel's contents at the molecular level, with
ball-and-stick molecules drifting about, and reactions taking place between them as the engine runs them.

Status: **R0 done (2026-10-09): 3D structures of every species, engine side and worker plumbing. R1 done (2026-10-09): Molecules tab, renderer, sampler, Brownian box. R2 done (2026-10-09): template reactions and proton transfers play as morphs. R3 done (2026-10-10): complexation, ion pairs and electron transfer. R4 done (2026-10-10): solid surfaces (lattice patch), precipitation / dissolution, electrodes, phase transfer, decomposition, combustion, generic swap. R5 done (2026-10-10): replay from the legend, floating tags, charge labels, performance pass. All of it still unverified in a browser.**
Progress is logged in section 9.

## 1. Decisions (user, 2026-10-09)

| Question | Decision |
|---|---|
| Fidelity | **Illustration driven by the engine.** The engine sets which molecules are present, in what proportions, and how often each reaction fires. The motion is stylised Brownian motion, not molecular dynamics, and time is slowed down by a factor shown on screen. |
| Scope of v1 | **Everything**: organic template reactions, acid-base / proton transfer, precipitation / dissolution, redox, complexation (plus gas release and electrode reactions, which reuse the same pieces). |
| Mechanism detail | **Single-step morph**: reactants meet, atoms glide from the reactant geometry to the product geometry, breaking bonds fade out, forming bonds grow in. No curly arrows, no intermediates. |
| Placement | **Tab in the right panel** (`Vessel | Molecules`) of the vessel panel. |
| Solvent | **Faint water with a toggle**: a few dozen semi-transparent water molecules around the solutes; a toggle hides them or shows them solid. Water that takes part in a reaction is drawn solid. |
| Trace species and slow reactions | **Enriched and labelled**: every species present gets at least one molecule, every active reaction fires at a rate you can watch, and a legend gives the true concentrations, the true rates, and states that the view is enriched. |

## 2. Feasibility

Yes, it can be built, as an illustration. The parts it needs mostly exist already:

- **Structures.** Organic species carry a SMILES (imports from PubChem, products of the network generator, seeded
  organics), and the engine already parses it into a graph with hydrogen counts, aromaticity and rings (`smiles.rs`,
  `analytical/graph.rs`). What is missing is **3D coordinates** (section 4.1) and a structure for the **inorganic
  species with no SMILES** (`species_inorganic.json` rows have only a formula; section 4.2).
- **Which atoms go where.** The 43 reaction templates are explicit graph edits on mapped atoms
  (`reaction_templates.rs::Template::products`: `break`, `bond`, `set_bond`, `charge`, `h_delta`, `solvent_proton`), so
  the atom mapping of every generated organic reaction is known; it only has to be returned instead of discarded (an
  atom-mapped variant, `products_mapped`, existed and was deleted with the rate-request queue on 2026-10-07). For the
  other kinds of reaction (proton transfer, complexation, precipitation, electron transfer) the mapping follows from
  the kind of reaction and is simple (section 4.3).
- **How often.** `VesselSnapshot.species` (amounts, concentrations, phase) and `VesselSnapshot.reactions` (net rate,
  `log_q_over_k`, kind) arrive at 20 Hz already. What is missing: the **structured stoichiometry** of each row (it only
  carries an equation string), what **kind** of microscopic event it is, and for equilibria a **gross (exchange) rate**:
  at equilibrium the net rate is zero but molecules keep reacting in both directions (section 4.4).
- **Drawing.** A few hundred molecules (~2-4 thousand atoms) as instanced spheres and cylinders is light work for
  Three.js r170, which the bench already uses.

What it cannot be: a simulation of where atoms really are. Real reactive molecular dynamics covers picoseconds to
nanoseconds of a few thousand atoms on a GPU cluster; a lab reaction takes seconds to hours. The box therefore never
claims to be a trajectory: the panel says "Illustration: composition and reaction frequencies from the simulation,
motion is schematic, rare events are enriched".

## 3. Architecture

```
engine (Rust/WASM)                            web (TypeScript)
-------------------                           -----------------
structure3d.rs   SMILES/formula -> 3D atoms   app/micro_sampler.ts   which molecules are in the box (enrichment)
micro_view.rs    reactions -> MicroReaction   app/micro_events.ts    when each reaction fires (rate compression)
  (kind, stoichiometry, atom map,             render/micro_scene.ts  own WebGLRenderer, instanced atoms + bonds
   gross rate)                                render/micro_motion.ts Brownian rigid bodies, steering, morph force field
wasm: vessel_micro_structures(ids)            render/micro_morph.ts  topology-blend relaxation of a reacting cluster
      vessel_micro_reactions(handle, layer)   ui/molecule_view.ts    the tab: canvas, legend, toggles, phase selector
worker: MICRO_STRUCTURES / MICRO_REACTIONS    SimController.microStructures / microReactions
```

The engine computes structures and reaction descriptions on request only (when the set of species or reactions
changes, plus a 1 Hz refresh of the rates), never in the 20 Hz loop. Amounts and net rates come from the snapshot that
already arrives. The viewer runs only while its tab is visible.

## 4. Engine side

### 4.1 3D coordinates (`engine/src/structure3d.rs`, new)

Input: a `smiles::Molecule` (or the formula builder's graph, 4.2). Output: `Structure3d { atoms: [{el, x, y, z,
charge}], bonds: [{a, b, order, aromatic}], source }` with **explicit hydrogens**, atom order = the graph's heavy-atom
order followed by the hydrogens of each heavy atom in order (so a template's heavy-atom map still applies).

Method (no external library; works offline, also for generated products):
1. Hybridisation from the bonds (sp / sp2 / sp3, aromatic = sp2), steric number from neighbours + lone pairs (valence
   electrons, charge). Ideal bond lengths from covalent radii by bond order (a table of ~50 elements in
   `data/covalent_radii.json`, with source), ideal angles from VSEPR (180 / 120 / 109.5, 90 / 180 for octahedral metal
   centres).
2. Distance geometry: exact 1-2 and 1-3 distances, 1-4 bounds from the torsion range, a van der Waals lower bound for
   the rest; random start in 4D, projected to 3D.
3. Refinement with a small force field (bond stretch, angle bend, out-of-plane term that keeps sp2 centres and aromatic
   rings flat, soft repulsion between non-bonded atoms, a staggered-torsion term for sp3-sp3), steepest descent then
   FIRE, fixed seed so the result is deterministic.
4. Cached per species id and structure-store generation.

Stereochemistry is ignored (the same limit as the NMR / MS predictors); rings come out as whatever conformer the
refinement finds (cyclohexane chair is likely but not guaranteed). Budget: < 5 ms for 60 heavy atoms natively.

Fallback: a species with neither SMILES nor a formula the builder understands is one sphere, sized by its molar
volume, with its formula as a label (`source: "placeholder"`).

### 4.2 Inorganic species without a SMILES

1. **Monatomic ions and atoms** (Na+, Cl-, Cu2+, Ag(s) atoms in a lattice): one sphere, radius from `ion_radii.json`.
2. **Formula builder** for simple molecules and oxo-ions: one central atom (the least electronegative atom that is not
   H or O) with the other atoms as ligands, hydrogens on oxygen, lone pairs from the electron count, VSEPR geometry:
   SO4 2- tetrahedral, NO3- / CO3 2- trigonal planar, ClO3- pyramidal, HSO4- with its H on an O. Covers most of
   `species_inorganic.json`.
3. **A small data file** `engine/data/structure_smiles.json` (InChIKey or species id -> SMILES, with source) for what the
   rule gets wrong: S2O3 2-, S2O8 2-, Cr2O7 2-, H2O2, N2O4, P4O10, polyatomic metal complexes with fixed structures
   (Fe(CN)6 4-, Cu(NH3)4 2+). Rows read from PubChem, never written from memory (project rule).
4. **Metal complexes and aqua ions** (Cu(NH3)4+2, FeSCN+2, Al(OH)4-, hydrated cations): central metal + ligands at
   the coordination geometry; the coordination number of an aqua ion from `water_exchange.json` where it has one, else
   6. The ligands are themselves embedded (NH3, SCN-) and attached by their donor atom.

### 4.3 Reaction descriptions (`engine/src/micro_view.rs`, new)

`vessel_micro_reactions(handle, layer)` returns, for every active reaction row in that phase:

```
MicroReaction {
  id, equation, kind,                 // kind below
  reactants: [{species, coeff}], products: [{species, coeff}],
  net_rate_mol_s, gross_forward_mol_s, gross_reverse_mol_s, rate_source,   // 4.4
  atom_map?: [[product_slot, product_atom, reactant_slot, reactant_atom]], // heavy atoms; H handled in the viewer
  moving_h?: [{from: [slot, atom], to: [slot, atom] | "solvent"}],         // from h_delta / solvent_proton
  electrons?: number,                 // redox
  mineral?: string, layer?: number,   // precipitation / dissolution
}
```

`kind` and how each one is recognised (from data the engine already holds, not from compound names):

| kind | Source in the engine | Mapping |
|---|---|---|
| `template` | generated kinetic rows (`network_generator.rs`, `GeneratedReaction.family_id`) | template edits, mapped (restore `products_mapped`: keep the concatenated-atom index through `Template::products` and return product atom -> reactant atom); `h_delta` pairs become `moving_h` |
| `proton_transfer` | equilibria and kinetic rows whose reactant and product differ only by H+ (formula and charge), including autoprotolysis and neutralisation (`ReactionRow.role`) | the acidic atom: the heavy atom whose H count differs between the two graphs (graph comparison via `smiles::Molecule::is_isomorphic` after removing one H); for formula-built ions, the O that carries the H |
| `complexation` / `ion_pair` | complexation rows (`complexes.json`, `auto_associations`, `ensure_complex_record`) | ligand binds by its donor atom; one aqua ligand leaves |
| `precipitation` / `dissolution` | mineral IAP = Ksp rows and transfer rates (`vessel_transfer.rs`) | ions join / leave a lattice patch (4.5) |
| `electron_transfer` | discovered homogeneous redox (`vessel_discovered.rs`), Marcus / measured laws | atoms keep their partners; electrons hop; for oxo-transfer couples (MnO4- -> Mn2+, sulfite -> sulfate) atoms are mapped by element, greedily by distance in the viewer, and the event is flagged `schematic_mapping` |
| `electrode` | electrode half-reactions (`vessel_electro.rs`) | as `electron_transfer`, with the electrode surface as the partner |
| `phase_transfer` | evaporation, Henry exchange, gas evolution, LLE partitioning (`vessel_vle.rs`, `phase_flash`) | the molecule leaves through the top of the box (gas) or a side (other layer) |
| `decomposition` / `combustion` | discovered thermal decomposition, `vessel_burn.rs` | element-wise mapping, `schematic_mapping` |
| `other` | anything not recognised | drawn as a generic swap (reactants fade, products fade in at the same spot), labelled |

The micro view needs the vessel to keep each row's stoichiometry (kinetic rows already have `reactants` / `products`
maps; equilibria have their species list; discovered reactions their stoichiometric vector). One thing to verify first:
the species' structure (parsed from its SMILES) and the template instance (`Instance.mols`, maybe `perceived()`) have
the same atom order; if not, map one onto the other by graph isomorphism.

### 4.4 Gross rates for equilibria

At equilibrium the net rate is zero but the forward and reverse reactions keep going, and that exchange is what the
box should show. `gross_forward = k_f * product of activities` where a forward rate constant is known:

- proton transfer: diffusion-limited encounter rate (`transport.rs`, already used for H+ + OH-);
- complexation: Eigen-Wilkins first step (`substitution.rs`, `EquilibriumRate.first_step`);
- electron transfer: the Marcus / measured rate the engine already computes;
- precipitation / dissolution at saturation: the growth / dissolution flux of the particle population (`transfer/`);
- kinetic rows: the forward term `F` of `r = F (1 - Q/K)`.

`gross_reverse = gross_forward - net`. Where no forward constant exists, `rate_source = "none"`; the viewer then shows
the exchange at a fixed slow pace, labelled "exchange rate not modelled".

### 4.5 Solids and surfaces

For precipitation / dissolution the box shows a **lattice patch** on one face: a small slab of the mineral, built from
the formula ratio and the ion radii as a schematic packing (rock-salt for 1:1, fluorite-like for 1:2, ...), labelled
"schematic packing". Real crystal structures need crystallographic data (COD); that is out of scope for v1 and listed
in section 8. Electrodes use the same slab (the electrode metal) as a surface where ions are reduced / atoms oxidised.

### 4.6 WASM and worker

- `vessel_micro_structures(handle, species_ids_json) -> Structure3d[]` (cached; the handle gives the vessel's imports'
  SMILES), `vessel_micro_reactions(handle, layer)`.
- Worker messages `MICRO_STRUCTURES`, `MICRO_REACTIONS`; `SimController.microStructures(ids)`,
  `SimController.microReactions(vesselId, layer)`; types in `types/sim.ts`.

## 5. Web side

### 5.1 The tab (`ui/molecule_view.ts`)

- Tab bar at the top of `VesselPanel` (`Vessel | Molecules`); the Molecules tab holds the canvas (panel width x ~360
  px, can be enlarged), a phase selector (each liquid layer, headspace / gas, each solid surface; default: the phase
  where the fastest reaction runs), and toggles: pause, playback speed, water (faint / solid / hidden), spectator ions
  on / off, ball-and-stick / space-filling, labels.
- Legend under the canvas: each species shown, the number of molecules in the box, its true concentration; each
  reaction, its true net and gross rate, how often it fires in the box; the time scale ("1 s here ~ 1 ps of motion;
  reaction events enriched by ~1e9"); the enrichment note. Clicking a reaction in the legend plays its next event
  in the middle of the box with the camera following it (a replay mode for free).
- Event captions: a short floating label at the event ("SN2: OH- + bromoethane -> ethanol + Br-"), using
  `prettyEquation`.

### 5.2 Rendering (`render/micro_scene.ts`)

- Its own `THREE.WebGLRenderer` on the tab's canvas (a second WebGL context; the bench keeps its own), rendering only
  while the tab is visible and the panel is open; `OrbitControls` on the canvas.
- Atoms: one `InstancedMesh` of spheres, CPK / Jmol colours by element, radius 0.3 x covalent radius (ball-and-stick)
  or van der Waals radius (space-filling). Bonds: instanced cylinders, two per bond split at the middle so each half
  takes its atom's colour; double / triple bonds as offset parallel cylinders in the sp2 plane, aromatic bonds with a
  dashed second line. Water: a separate instanced mesh with low opacity. Charges: small `+` / `-` sprites. Electron
  hops: a glowing point sprite on an arc. Box: faint wireframe; the top face is the liquid surface (gas leaves through
  it) when the phase has a free surface.
- Lighting: hemisphere + one directional light; no shadows (cheap). Budget: < 3 ms per frame at 300 molecules on the
  target hardware (8 GB RAM machine).

### 5.3 Who is in the box (`app/micro_sampler.ts`, pure)

- Budget ~150 solute molecules + ~40 faint waters (the waters are scenery: their number is not the true ratio and the
  legend says so).
- Enriched allocation: each species of the phase above a floor (> 1e-12 mol) gets `n_i = max(1, round(B * w_i / sum w))`
  with `w_i = x_i ^ alpha` (alpha ~0.3: compresses 1 : 1e6 into ~1 : 60), capped at 30 species (the most abundant plus
  every species that takes part in an active reaction). Pure function, unit tested.
- Reconciliation: when the targets change, the box does not pop molecules in and out; surplus molecules drift out
  through the box walls and missing ones drift in, at a few per second, so the box follows the vessel smoothly. Reaction
  events change the counts directly (reactants turn into products in place), and the reconciliation corrects any drift
  between that and the engine.

### 5.4 When reactions fire (`app/micro_events.ts`, pure)

- Each reaction r with gross rates F_r, R_r (mol/s in the phase) gets a visual frequency that keeps the ranking but
  compresses the range: `f_r = f_min * (F_r / F_min) ^ beta` with beta chosen so the fastest active reaction fires at
  ~1 / s and the slowest shown at ~1 per 20 s; reactions below a floor are listed in the legend but not played.
- Equilibria near Q = K fire forward and reverse alternately at equal frequency (dynamic equilibrium); a reaction away
  from equilibrium fires in proportion `F : R`.
- At most 3 events in progress at a time; an event needs its reactants in the box (if one is missing it drifts in first).
- Pure functions, unit tested (ranking preserved, forward / reverse balance, never more than the cap).

### 5.5 Motion (`render/micro_motion.ts`, `render/micro_morph.ts`)

- **Free molecules** are rigid bodies (the conformer from 4.1): random translation and rotation steps (Brownian, with
  a slight inertia so it looks smooth), soft repulsion between molecules, periodic or soft walls. No per-atom work for
  molecules that are not reacting.
- **Approach**: the two (or three) reactants are steered together over ~1 s by a spring between their reacting atoms
  (from the atom map), and turned so the reacting atoms face each other.
- **Morph** (single step, ~1.5 s): the cluster switches to per-atom motion under a small force field whose bond terms
  blend from the reactant topology to the product topology: breaking bonds weaken to zero and fade, forming bonds ramp
  up and grow in, bond orders change (a double bond's second cylinder fades), equilibrium lengths and angles move from
  the reactant values to the product values; the moving H travels from donor to acceptor. Product geometry from 4.1
  aligned to the reactant positions by a Kabsch fit on the mapped atoms. The force field gives smooth, physically
  plausible motion (no atoms passing through each other) without a hand-made path. SN2 back-side attack and the
  Walden inversion are not modelled (stereo is ignored); a template-specific approach direction is a later option.
- **Separation**: products are released as rigid bodies with a small push apart and a brief glow on the atoms whose
  bonds changed.
- Per kind: proton transfer = only the H moves (between two molecules, or via a water); complexation = an aqua water
  leaves, the ligand docks; electron transfer = partners touch, an electron sprite hops, charges / oxidation-state
  labels change, `schematic_mapping` ones morph by element; precipitation = an ion sheds its waters and docks into the
  next lattice site (dissolution the reverse); gas release = a molecule leaves through the top face (into a bubble when
  the vessel is bubbling); phase transfer between layers = through the side face.

## 6. Implementation stages

Each stage ends with `cargo check`, `tsc`, `npm run build` and its own tests; the full suites run once at the end (project
rule). Nothing is verified in a browser by the agent; the user tests the visuals.

| Stage | Content | Gate |
|---|---|---|
| R0 | `structure3d.rs`, formula builder, `structure_smiles.json` (from PubChem), `covalent_radii.json`, `vessel_micro_structures`, worker message | `engine/tests/structure3d.rs`: the 48 structures of `analytical_nmr.rs` and every store species embed; bond lengths within 3 % and angles within 6 degrees of ideal, aromatic rings flat within 0.05 A, no non-bonded pair closer than 0.8 x the vdW sum, deterministic, < 5 ms for 60 heavy atoms; SO4 2- tetrahedral, NO3- planar, H2O 104-110 degrees |
| R1 | Molecules tab, renderer, sampler, Brownian box, legend, water toggle, phase selector (no reactions yet) | `tests/micro_sampler.mjs` (enrichment, floor, cap, reconciliation converges); headless bundle check like `instrument_controls.mjs` (tab builds, instanced counts match the sample, frame time) |
| R2 | `micro_view.rs` with `template` and `proton_transfer`, gross rates for those, event scheduler, approach / morph / separation | `engine/tests/micro_view.rs`: every template of the rate harness yields an atom map that conserves elements and charge and matches the products' graphs; acetic acid, ammonia, phosphate, autoprotolysis recognised as proton transfer with the right acidic atom; `tests/micro_events.mjs` (rank kept, F : R balance, cap); `tests/micro_morph.mjs` (atoms conserved through a morph, end geometry = product conformer within 0.1 A RMSD, no clash) |
| R3 | `complexation`, `ion_pair`, `electron_transfer` (+ `schematic_mapping`), Eigen-Wilkins and Marcus gross rates | Cu2+ + NH3, Fe3+ + SCN-, Fe2+ + MnO4-, Zn + Cu2+ descriptions conserve atoms and electrons |
| R4 | lattice patch, `precipitation` / `dissolution`, `electrode`, `phase_transfer`, `decomposition` / `combustion`, `other` | AgCl, BaSO4 events; gas release in NaHCO3 + HCl; electrolysis of brine; renderer fuzz (`renderer_fuzz.mjs` style): random vessels from the real engine run 60 s of viewer time without NaN, lost atoms or exceptions |
| R5 | Replay from the legend, captions, labels, performance pass, CLAUDE.md entry | frame time < 3 ms at 300 molecules in the headless check; full suites once |

## 7. Risks

- **Conformer quality.** A home-made embedder can produce strained or tangled structures for fused rings, cages and
  large molecules. Mitigation: the R0 gate on 48 + store structures; fallback to PubChem's 3D SDF for imported
  compounds that have a CID (downloaded and cached like other PubChem data) if the gate cannot be met for some class.
- **Atom order mismatch** between a species' SMILES parse and the template instance (4.3); checked first in R2.
- **Inorganic structures by rule** can be wrong (S2O3 2-, polyoxo anions); the data file covers the known exceptions,
  and anything else is labelled `formula-rule`.
- **Gross rates** are only as good as the forward constants behind them; many rows will be "exchange rate not
  modelled". This affects how often an event plays, not what it shows.
- **Second WebGL context** in the panel: fine on desktop browsers; on low-memory devices the tab pauses the bench's
  render loop while it is open if needed.
- **Busy vessels** (network with 100+ reactions): the scheduler plays only the top reactions by rate; the legend lists
  the rest.

## 8. Out of scope for v1

Curly-arrow electron pushing; multi-step mechanisms with intermediates and transition states; stereochemistry
(Walden inversion, cis / trans products); real crystal structures; explicit hydrogen-bond networks and Grotthuss proton
hopping through chains of water; a molecular view of the headspace above a sealed vessel beyond simple gas molecules.

## 9. Progress log

- 2026-10-09: plan written, decisions in section 1. No code yet.
- 2026-10-09, **R0 done** (gates in `engine/tests/structure3d.rs`, 8 tests; `tests/micro_structures.mjs` against the built WASM).
  - Module `engine/src/structure3d/` (`mod.rs` API, resolution chain and cache; `graph.rs` build graph, SMILES conversion,
    Lewis assignment; `formula.rs` formula rule; `geometry.rs` hybridisation and ideal angles; `embed.rs` embedder;
    `data.rs` tables). Resolution order: the caller's SMILES (a vessel's import) -> the store record's SMILES -> the SMILES of
    another record with the same InChIKey -> a `structure_smiles.json` row -> the formula rule -> a placeholder sphere. A
    SMILES whose composition contradicts the record's formula is skipped (the seed record `HS-` carries `[S-]`,
    `db/seed.rs`; not changed here).
  - Data: `engine/data/covalent_radii.json` (103 elements: Pyykko single / double / triple covalent radii, Bondi vdW radius
    else Alvarez, Pauling electronegativity, group, Jmol colour), generated by `pipeline/db/build_covalent_radii.py` from the
    element table of the `mendeleev` package (its SQLite data file, read as data). `engine/data/structure_smiles.json`
    (21 rows: pyrophosphates, thiosulfates, disulfite, peroxodisulfate, tri-/tetra-/pentathionate, tetraborate, N2O,
    dichromate, (hydrogen)chromate, permanganate, molybdate, tungstate), generated by `pipeline/db/build_structure_smiles.py`
    from PubChem PUG REST with formula and charge checked; bifluoride has no PubChem record by name and stays with the rule.
  - Formula rule (deviations from 4.2 noted): the ionic splitter now takes a charge (`ions::decompose_elems_with_charge`,
    e.g. CeH2PO4+2 = Ce+3 + H2PO4-); fragments take the store's SMILES of the ion, a structure row, or the central-atom rule
    (several centres bridged by O when electropositive, else bonded directly; H on terminal O first); a Lewis assignment
    picks valences, bond orders and formal charges; metals bind their fragments by a donor atom as a tree (no chelate rings;
    HSAB preference for heavy donors on soft metals; carbon donors for cyanide), high-valent metals (>= +4) bind oxo
    ligands covalently with double bonds; hydrate waters coordinate up to six per metal, the rest is lattice water. A donor
    bound to a metal keeps at most one stereo-active lone pair (M-O-S ~120, M-NCS linear). Aqua coordination numbers (4.2
    item 4) are not built: `water_exchange.json` has no coordination numbers, and the bare ion is what the engine holds; a
    monatomic ion carries its Shannon radius (`radius_a`) for the viewer.
  - Geometry (deviations from 4.1): conjugated N (amide, aniline) is planar and an ester / aryl-ether O (two heavy
    neighbours, one in a pi system) is treated as sp2; ring angles of three- to six-rings come from a planar polygon with the
    ideal bond lengths as sides (thiophene C-S-C 100, not 108), sp3 four- and five-rings with a puckering deficit. The
    embedder is a hybrid instead of whole-molecule distance geometry + FIRE: distance geometry (4D, squeezed to 3D) + force
    field only for each ring system with its first shell of substituents and its ring hydrogens (least strained of 3 seeds);
    acyclic parts are built outward with ideal bond vectors (largest branch anti, the free rotation chosen to avoid atoms
    already placed), ring systems docked rigidly; then hydrogens and one L-BFGS refinement of everything (bonds, cosine
    angles, out-of-plane, torsions, soft repulsion on a Verlet list). Up to 4 attempts with other seeds when a result is
    outside the quality limits. Deterministic.
  - Gate results: the 48 zoo structures and all 1343 store species meet bonds within 3 %, angles within 6 degrees,
    aromatic rings flat within 0.05 A, no pair three or more bonds apart closer than 0.8 x the vdW sum, atom charges adding
    to the species charge, every formula atom present. Exception, asserted by name: the bicyclo[2.2.1] systems (norbornene,
    camphor) reach 11.7 degrees at the one-atom bridge (real norbornane C1-C7-C4 is 94 degrees, a five-ring "ideal" is
    105), checked against 13 degrees; adamantane is bridged too and stays within 6. Thin margins: paracetamol 5.7 degrees
    (planar anilide pressed against an ortho H; the real molecule opens to ~128), cholesterol 5.7 (stereochemistry is
    ignored, so an arbitrary stereoisomer is built). Textbook shapes: sulfate tetrahedral, nitrate planar, water 105,
    chlorate 107, CO2 linear, Cu(NH3)4 2+ square planar, SF6 octahedral, Fe-NCS through N. 60 heavy atoms: 2.0 ms
    (triglyceride, 164 atoms) and 2.7 ms (hexapeptide, 112 atoms), best of five, natively.
  - WASM / worker: `vessel_micro_structures(handle, species_ids_json)` (the handle is needed because an import's SMILES lives
    in the vessel's compound table, keyed by its Hill formula as in the snapshot), worker message `MICRO_STRUCTURES`,
    `SimController.microStructures(vesselId, speciesIds)`, types `Structure3dData` / `Atom3dData` / `Bond3dData` in
    `web/src/types/sim.ts`. Nothing in the UI calls it yet (R1).
  - Verification at the end of R0: `cargo rtest --no-fail-fast` 567 passed / 0 failed, 28 node suites pass
    (`pubchem_solid_live` not run: network), pytest 85 passed, `tsc` and `npm run build` clean, WASM rebuilt. Not verified
    in a browser (nothing visible yet).
- 2026-10-09, **R1 done** (gates: `tests/micro_sampler.mjs` 15 checks, `tests/micro_view.mjs` 9 checks against the built WASM; nothing verified in a browser).
  - Files: `web/src/app/micro_sampler.ts` (pure: `allocate` = x^0.3 enrichment with floor 1e-12 mol, species cap with forced species, budget trim, hysteresis against the previous allocation; `reconcileStep` = at most N add / remove ops per call, missing species first, converges), `app/micro_phases.ts` (pure: `phasesOf(snapshot)` -> aqueous / organic / gas phases from `species` rows and `gas_phase`, solids listed apart; the solvent water of an aqueous phase is `scenery`; `sampleInput`, `defaultPhase`), `render/micro_shape.ts` (engine `Structure3dData` -> centred shape, bounding radius, element colours / radii, bond cylinders: double = two parallel lines in the plane of the neighbours, triple = three, aromatic = one plus a shorter thinner line on the ring side, coordinate bond thinner), `render/micro_motion.ts` (`MicroMotion`: rigid bodies, Ornstein-Uhlenbeck velocity and spin, soft pair repulsion, reflecting walls, gas = near-free flight; bodies `addEntering` through a side wall (a gas through any face) and `removeOne` leaves through the nearest wall; seeded, deterministic), `render/micro_scene.ts` (`MicroScene(canvas | null)`: own WebGLRenderer + OrbitControls, instanced spheres and half-cylinders per group, solutes and waters as separate meshes (faint / solid / hidden), wireframe box, liquid free surface on the top face; `null` canvas = same scene graph without a renderer, used by the tests), `ui/molecule_view.ts` (`MoleculeView`: canvas, phase selector, pause, speed 0.5 / 1 / 2x, water modes, ball-and-stick / space-filling, status line, legend with true concentration and molecules in the box, honesty note; runs only while the tab is visible), `data/element_view.ts` (generated by `pipeline/db/build_element_view.py` from `engine/data/covalent_radii.json`). `ui/vessel_panel.ts` has the `Vessel | Molecules` tab bar (`VesselPanel.setHidden` also stops the view when the instrument panel covers it); `Lab.microStructures` passes through to the worker.
  - Deviations from the plan: ball radius is 0.3 x the van der Waals radius (0.3 x covalent radius, as written in 5.2, would be smaller than the bond cylinders); a monatomic ion is drawn at 0.8 x its ionic radius from the engine; the aromatic second line is drawn shorter instead of dashed; charge sprites, labels and the spectator-ion toggle are deferred (R2 knows which ions take part); solid phases are only listed in the legend until the lattice patch (R4); the phase selector defaults to the aqueous layer (the "fastest reaction" default needs R2); the organic layer of an immiscible mixture is one phase (the snapshot's species rows carry the phase tag, not the layer index). Molecule counts: budget 150 solutes + 40 scenery waters; the targets are recomputed at 1 Hz and the box follows at 4 molecules per second.
  - Measured (headless, native node): 190 molecules / 704 atoms, motion step + instance write 0.2 ms per frame. Real data seen through the viewer: hexane over aqueous NaCl / HCl shows 0.0045 M hexane dissolved in the water (the engine's UNIFAC value, far above the real ~1e-4 M; not a viewer matter), so the aqueous box carries a few hexanes.
  - Known limits: the second WebGL context and the real renderer path (instanced colours, transparency of the faint waters, camera framing, panel layout) are NOT verified in a browser; the box size is fixed when the phase is built, so a very large change of composition keeps the old size; a phase with a single huge molecule can fill the box.
- 2026-10-09, **R2 done** (gates: `engine/tests/micro_view.rs` 6 tests, `tests/micro_events.mjs` 8 checks, `tests/micro_morph.mjs` 8 checks, `tests/micro_view.mjs` extended to 13; nothing verified in a browser).
  - Engine (`engine/src/micro_view.rs`, wasm `vessel_micro_reactions(handle, phase)` with phase "aqueous" | "organic", worker `MICRO_REACTIONS`, `SimController.microReactions`, types `MicroReactionData` / `MicroMovingH`): the description is an atom map of *every* atom, hydrogens included (`atom_map[p][j]` = the reactant `[molecule, atom]` that product atom `j` of molecule `p` was), plus `moving_h` (the hydrogens that change owner, with donor and acceptor), and gross forward / reverse / net rates in mol/s of the phase. Deviations from the plan's 4.3: no separate heavy-atom map and viewer-side hydrogen handling (the engine does the whole map, so it is testable); `kind` is `template` | `proton_transfer` | `other` (`other` rows are only the *active* kinetic rows the viewer cannot map yet, without a map; unrecognised equilibria are not returned); `layer` is chosen by the phase key because the web only knows aqueous / organic.
  - Template reactions: a vessel's generated rows do not keep their template match, so it is found again (`Template::products_mapped`, new: `Template::products` now delegates to it; each product atom carries its reactant origin; the extras `[H+]` and the hydroxide of `solvent_proton` have none). The template is named by the row's rate key (`generated_rate_keys`), the first slot / match combination that reproduces the row (same species ids after the generator's spectator cancellation) is the mapping. The solvent proton's hydroxide adds a water to the reactants. Reactant and product structures are `structure3d` (R0); a `Molecule` is matched onto a structure's skeleton by isomorphism (strict on charge and hydrogens, then relaxed), so SMILES atom order does not matter (the risk noted in section 7 is closed by this).
  - Proton transfers: molecules that pair up one-to-one by skeleton (non-hydrogen atoms and bonds; element and connectivity only) and differ by hydrogens and charge. Symmetric skeletons are resolved by least change of bond orders and formal charges (acetate keeps its C=O and C-O-). The surplus hydrogens of one side form a pool handed to the other side's atoms that need one (`finish_map`, shared with the template path; it checks bijection, elements and charge). Recognised: 26 of the default equilibria (water, acetic / formic / carbonic / oxalic / phosphoric / sulfurous acids, HF, HCN, HNO2, HClO, HBrO, H2S, HSO4-, HCrO4-, ammonia, the four indicators). Not proton transfers (R3 / R4): complexation, hydroxo complexes (`Fe+3 + H2O <=> FeOH+2 + H+`), CO2 hydration, Cl2 / Br2 / SO2 hydrolysis, dichromate.
  - Rates: kinetic rows use `KineticExtentSystem::gross_rates` (new; the forward term of `r = F (1 - Q/K)` and the reverse as F - net; `forward_rate` is now shared with `rates_sparse`). A proton-transfer equilibrium has the encounter-limited constant in the direction that brings two molecules together (or the downhill one when both sides have as many) and the detailed-balance value in the other, on molal activities of the vessel's own activity model and the water activity (the solute-only version showed a spurious net rate at 0.1 M ionic strength): H+ + OH- uses `transport::h_oh_recombination_rate`, H+ with another species the same form with Grotthuss D(H+) and the partner's Stokes-Einstein diffusion (radius from the structure), anything else the screened Smoluchowski rate. Water's ionisation gives 1.4e-3 M/s forward = reverse (gate: 0.5-3e-3). Unknown (3 species on a side, 1:1 isomerisation) = `rate_source: "none"`, the legend then says "exchange rate not modelled".
  - Web: `app/micro_events.ts` (pure: `visualRates` keeps the ranking and maps the gross total to f = fMax (G / Gmax)^beta with fMax 1 / s and fMin 1 / 20 s, rows below 1e-15 of the fastest or beyond 12 rows are listed but not played; `EventScheduler` Poisson firing, direction by error diffusion of the forward share so an equilibrium alternates, at most 3 events in progress), `render/micro_morph.ts` (`ReactionEvent`: approach, morph, release, `invertSpec` for reverse events, `fitRigid` by Horn's quaternion method), `render/micro_scene.ts` (`EventLayer`: the event's atoms and bond lines drawn solid, bonds fade / grow by weight, atoms whose bonds change glow), `render/micro_motion.ts` (`reacting` body state, `pick`, `place`, `release`), `ui/molecule_view.ts` (rows asked every second, structures fetched ahead, events started from the scheduler, reactant bodies taken over and released, products placed with a small push apart, caption overlay, reactions table in the legend with true rates).
  - Morph (all schematic): the approach docks the reactants so the atoms that form a bond across molecules (else the reacting centre) meet at the forming bond length + 1 A, searching 48 orientations per molecule jointly for the most room between the molecules (a buried reacting atom like an ester's carbonyl carbon needs the attack from the open side); the approach lasts 1-2.6 s by distance. The morph (1.6 s) guides every atom along a straight path to its place in the product conformer (fitted to the docked atoms by a rigid-body fit of the mapped atoms; product molecules that would overlap are pushed apart first), bond springs blending from the reactant to the product topology and a soft repulsion keep neighbours sensible, the final 18 % locks to the product geometry exactly. The pose handed to the product bodies reproduces their conformer (RMSD 0.0000 A).
  - Gate numbers: all 922 reactions the network generator makes from the 138 measured rows + 18 held-out rows and the textbook reactants of the other templates are described (every kinetic template except the anion `carbocation_trapping`, below); 20 events (forward and reverse, two start poses) of a saponification / buffer vessel: clearance of non-bonded atoms >= 0.6 of the van der Waals sum, largest step 0.83 A per 1/30 s frame (the approach), reacting atoms docked within 3.4 A, bonds drawn at the end = the products' bonds; in the view, 60 events in 70 s of a real vessel, never more than 3 at once, 0.26 ms per frame with 3 events; `micro_reactions` 0.1 ms warm (10 ms cold) on a 7-reagent vessel.
  - Found, not fixed (spun off as a separate task): `network_generator::resolve_molecule("Cl-")` returns a neutral chlorine atom (the minimal SMILES reader accepts a trailing `-`), so halide ions never match template slots written for charged atoms (SN2 halide exchange is never generated); and the nucleophile slot of `carbocation_trapping` (`[OX2-;H0,H1]`, `[SX2-;A]`, `[Cl-,...]`) matches no species a vessel can hold (an alkoxide has one connection, not two), so the anion version of that template never fires. The template test leaves it out for that reason.
  - Known limits: reverse events of an irreversible row never fire (its reverse rate is zero); an event whose reactant is not in the box sends one in through a wall and is skipped this time; water that takes part is a scenery water when the box has any, a fresh molecule otherwise; charge labels and the glow of the "released" products are not drawn (only the glow of reacting atoms); an approach between large molecules (60 heavy atoms each) reduces the orientation search to 12 per molecule; gas and solid phases play no reactions; the `other` rows are listed in the legend as "not drawn yet".
- 2026-10-10, **R3 done** (gates: `engine/tests/micro_view.rs` 15 tests, `tests/micro_morph.mjs` 13 checks, `tests/micro_view.mjs` 16 checks; nothing verified in a browser).
  - Engine (`micro_view.rs`, new kinds `complexation`, `ion_pair`, `electron_transfer`; `MicroReaction` gains `electrons`, `electron_hops` (donor and acceptor atoms of the reactant molecules) and `note`; web type `MicroReactionData` and `MicroElectronHop`). Deviations from 4.3: one generic skeleton mapper (`map_by_skeleton`) serves complexation and electron transfer instead of per-kind rules, and finishes through the same `finish_map` as R2 (hydrogens through the pool, so a hydroxo complex `Fe3+ + H2O <=> FeOH2+ + H+` has one moving hydrogen and a free proton). Reactants are laid largest first onto the product skeleton by a bond-preserving embedding (a monomorphism, 200 000 node budget); a reactant that has none is laid by element (bond-keeping score, then same molecule as its neighbours) and the description is `schematic_mapping`. A complexation must make a bond between two reactant molecules, may not be schematic, and needs a metal in a reactant (`Atom3d.ox`) or only charged skeleton-bearing reactants (then `ion_pair`); Fuoss rows are always `ion_pair` (source starts "Fuoss"). The table sweep (`every_complexation_row_of_the_data_table_has_an_exact_description`) describes 606 of 616 rows of `complexes.json`; the 10 left have 5-6 ligands of one species (`expand` allows 4 per species), `Fe(HSeO3)` has no structure.
  - Gross rates (4.4): `complexation_gross_rates`. Metal and ligand from `substitution::complexation_parts`, `k_f` from `eigen_wilkins_rate` at the actual temperature and ionic strength (hydroxo path included), reverse `k_f a_ML / K^(1/n)` and forward `k_f K^((n-1)/n) a_M a_L^n` (K^(1/n) is the engine's own stepwise constant in its relaxation; the pair makes forward = reverse at equilibrium for any n, the 1:1 rows are exact). A metal without a water-exchange row, a neutral ligand pair and the hydroxo rows use the R2 encounter-limited rate (`equilibrium_gross_rates`); `Fe3+ + 2 H2O <=> Fe(OH)2+ + 2 H+` has three solute species in the association direction and so `rate_source: "none"`. Electron transfer has no reverse (a reaction that has reached its equilibrium has no active row): forward = the row's net rate, times the electrons when the event is a single hop.
  - Electron transfer (`describe_electron_transfer`): whole reaction when both sides have at most 6 molecules (`MAX_WHOLE_EVENT_MOLECULES`), else the hop of one electron from the donor to the acceptor (`shift_charge`: `Fe+2` -> `Fe+3`, `MnO4-` -> `MnO4-2`, `Zn(s)` -> `Zn+`) with a `note`; the products of a hop are intermediates that are not species of the vessel (the box reconciles them away). Donor and acceptor atoms are the atoms whose element changes oxidation state most (`gem::redox::determine_oxidation_states_exact`). The partners of a discovered redox reaction are stored in `Vessel::redox_partners` (keyed by the row's equation) when the row is made, because the reaction is rediscovered at every step and its reactant may be used up by the time the viewer asks (found when a 1 mM permanganate was gone after one 0.05 s step). A disproportionation counts its electron once (`z_electrons / 2`). Ids of redox rows are `redox_<lead>|<equation>` (two reactions of one lead species had the same id). Metal / solution cells (the `corrosion` rows of the mixed-potential model: `Zn(s) -> Zn2+ + 2 e-` with `Cu2+ + 2 e- -> Cu(s)` and `Cu2+ + e- -> Cu+`) are paired by their electron flows: pair rate = a_i c_j / sum(a), events = flux / lcm of the electron numbers, at most 6 pairs and 1e-6 of the biggest; `electrolysis` rows (the electrode with a potentiostat) are R4. Gate numbers: zinc + copper(II) maps atom for atom (0 bond changes, 2 electrons from Zn to Cu, lost = gained = 2 by oxidation states through the atom map), Cu2+ + 4 NH3 makes four Cu-N bonds, Fe3+ + SCN- one Fe-N bond, MnO4- + 5 Fe2+ + 8 H+ is the Fe2+ + MnO4- step (1 electron, Fe -> Mn), sulfite + hypochlorite is schematic with 2 electrons, 2 Cu+ + H2O2 + 2 H+ conserves atoms and electrons.
  - Web: `ReactionEvent` docks a molecule that bonds with every other reactant in the middle (`hub`), the others on a Fibonacci sphere at the forming-bond length + 1 A (docked N-Cu 1.8-3.4 A, the four ligand centroid within 1 A of the copper), outer-sphere electron transfers 4.4 A apart, electron points (up to 3 per hop, 0.34 A radius, light blue to white) along an arc during the middle of the morph (`electronSprites`; the event layer draws them as extra instances), the redox centres glow; `invertSpec` also inverts the hops. `ui/molecule_view.ts`: kind labels, caption with the electron count ("2 e- Zn -> Cu2+") and "atoms assigned by element (schematic)", rows that involve a solid are listed with "needs the solid surface (not drawn yet)" and are not scheduled. A 120 s view of a Cu2+ + NH3 vessel plays 141 events (copper_tetraammine 19 times, the ammonium sulfate ion pair 50 times); a permanganate vessel shows the electron points and the caption.
  - Known limits and what is left: charge / oxidation-state labels on the atoms are not drawn (the caption and the glow only); a reaction whose reactant has gone (consumed within the last step) is listed with a stale rate and not played; multi-electron reactions are one-electron hops (no intermediates of the real mechanism); electrolysis, precipitation, dissolution, phase transfer, decomposition and the lattice patch are R4; the sign of a net rate in a complexation row can differ from the engine's relaxation direction for n > 1 (the stepwise-constant convention); the legend shows `Eigen-Wilkins` for ions whose `k_ex` is only recalled (`water_exchange.json` tier) without saying so.
- 2026-10-10, **R4 done** (gates: `engine/tests/micro_surface.rs` 10 tests, `tests/micro_slab.mjs` 9 checks, `tests/micro_surface_view.mjs` 16 checks; the R2/R3 suites still pass; nothing verified in a browser).
  - Engine (`engine/src/micro_view/surface.rs`, a child module of `micro_view.rs`; wasm `vessel_micro_lattice(handle, solid)`, `vessel_micro_reactions` also takes `"gas"`, worker `MICRO_LATTICE`, `SimController.microLattice`, `Lab.microLattice`, types `MicroLatticeData` / `MicroSurfaceData` / `MicroMorphData` / `MicroPhase`). New row kinds (deviations from the table in 4.3: the names follow what the row does):
    - **`dissolution`** (one row per mineral with a solid in the vessel, `solid_<species>`; forward = dissolution, the precipitation is its reverse event): rates are the film-limited exchange of the engine's own transfer step (`vessel_transfer.rs`): forward `k A c_sat` (activities in), reverse `k A c` (concentrations of the ions now), k from `effective_transfer_coefficient(film_coefficient(...))` and A the particle surface, in mol of formula units per second; their difference is the engine's `k A (c_sat - c)` and the two are equal at saturation (gate: AgCl; ten times the chloride raises the precipitation side 3x and leaves the dissolution side alone).
    - **`electrode`** (a powered cell): one row per electrode and half-reaction from `Vessel::micro_electrodes`, recorded in `apply_flows` from the per-electrode flows, because the cell rows the vessel reports are the *net* of both electrodes (copper dissolving at one and plating at the other cancel and the plating row did not exist). Rate = the Faraday extent per second (gate: the cathode rows carry the readout's current). `SurfaceDesc.oxidation` says whether the electrons go to the electrode (a film on an anode can be reduced).
    - **electron transfer with a solid** (the `corrosion` pairs, homogeneous redox with a metal): the whole-reaction description now allows gases (`Zn + 2 H+ -> Zn2+ + H2(g)`), and a reaction with a solid on a side is split by its atom map (`split_surface`) into **leaves** (a slab occupant becomes dissolved / gas species), **joins** (dissolved ions become a slab occupant), a **residue** (a solid product that stays where the reactant solid was) and a **morph** (the species left over, mapped atom by atom with `describe_skeleton_dq`: a half-reaction's products carry the electrons' charge). A product made of atoms of a solid and of a dissolved reactant is not a lattice event (the row stays unmapped).
    - **`decomposition`** (discovered thermal decomposition: leaves + residue + a gas that leaves), **`phase_transfer`** (evaporation / condensation of every volatile liquid, Henry exchange of dissolved gases, boiling; gross rates recorded by the steps in `Vessel::micro_transfers`: evaporation `unit * p_surface` out and `unit * p_air` in with `unit` the mass-transfer coefficient per pascal, Henry exchange the surface rate constant times what each side holds with the net as the engine actually moved it, boiling out only), **`combustion`** (the fuels that burned in the step, `Vessel::micro_burns`: fuel vapour + O2 -> CO2 + H2O (+ N2), balanced from the elements, one schematic step; a fuel that needs more than 8 molecules a side to balance is listed without a map), and unmapped but active rows (`other`, now also equilibria without a description, with their net rate).
    - Lattices (`lattice_of`): the ions and counts of the mineral record, else the ionic split of the formula, else the atoms of an element (covalent radius as metallic radius, floor 1.1 A for graphite); a molecular solid has none. All three records are `dissolved_products` / `decompose_ionic` / `parse_formula_strict` data, no compound is named.
  - Web: `app/micro_lattice.ts` (the patch: rock-salt for 1 : 1, fluorite / anti-fluorite for 1 : 2 / 2 : 1, close-packed layers for an element, a greedy cubic fill in the formula ratio otherwise; sites that lose their support at the open edge of a fluorite patch are dropped; labelled "schematic packing"), `render/micro_slab.ts` (occupancy: the starting surface is full below the top two layers, 70 % of the next one and 10 % adatoms on top; a vacancy needs an occupied site below it that no event is about to lift, an occupant leaves only when nothing rests on it or is about to, so crystals grow layer by layer and the invariant "every occupant is held up" holds through any sequence of events; reserved sites; residues), `render/micro_surface_event.ts` (`SurfaceEvent`: ions glide to a point above their site and in, occupants lift off, electrons run on arcs between where they leave and arrive; `SwapEvent`: a reaction without an atom map shrinks its reactants away and grows the products in), `ReactionEvent` takes an `anchor` (the species next to a surface meet just above the lattice), `render/micro_motion.ts` (`docking` state, `sendThrough` / `addEnteringAt` for the free surface), `render/micro_scene.ts` (the slab as a fourth instanced group under the box floor with a translucent bedrock block, camera framing of box and slab), `app/micro_phases.ts` (a solid with a known lattice, and each electrode of a powered cell, is a *surface phase* in the selector: the box of the fluid over the slab), `app/micro_plan.ts` (pure: whether a row can be played here and why not, a surface description read forward or backward, the words for each kind of event), `ui/molecule_view.ts` (dispatch by kind: morph, crossing, swap, surface; surface events take their sites and bodies together or not at all; gas made in a liquid rises out through the top; a reactant the snapshot does not list, such as a fuel vapour, is sent in and kept as a guest).
  - Deviations from the plan: the slab sits *below* the floor of the box instead of on one of its faces, and an electrode is the same horizontal slab (not a vertical one); each surface is its own view (the fluid's reactions plus the ones at that surface), so a precipitate and a cathode are not drawn together; an ion does not shed a hydration shell (the faint waters are scenery); crossings of the free surface are ranked and scheduled apart from the chemistry (their mol/s dwarf it): at most two at a time beside the three chemical events, fastest 0.5 per second.
  - Gate numbers: `micro_surface.rs`: lattices of 3 minerals / a metal / a salt / none for glucose; AgCl exchange `net = fwd - rev`, small near saturation; Cu|Cu cell: cathode `Cu2+ + 2 e- -> Cu(s)` joins, anode `Cu(s) -> Cu2+` leaves, Faraday current within 5 % of the readout; water cell: strongest cathode row has H2(g) and the anode O2 in the mapped morph; Zn + Cu2+ pair = one leave, one join, no morph; Zn + 2 H+ = a leave and a morph of two H+ into H2(g); CaCO3 at 1200 K = leave + residue CaO(s) + CO2(g); warm water in humid air: evaporation exceeds condensation, both nonzero, and the net matches the engine's `evaporation_g_s` within 30 %; ethanol pool = combustion row; every surface description balances in elements and in charge against the electrons (`check_surface_balance`, also over a busy vessel). `micro_slab.mjs`: packing by formula for 8 solids, no overlap (nearest >= 0.95 of the contact spacing), support below every site above the bottom layer, 400 random precipitation / dissolution steps keep every occupant held up, events take and give back their sites. `micro_surface_view.mjs`: AgCl / Zn / Cu / brine / bicarbonate + acid / warm water / burning ethanol / NaHCO3 at 420 K in the real view, plus a fuzz of 5 random vessels x every offered phase x 60 s without a non-finite body, an unsupported ion or a site held without an event.
  - Known limits: the lattice is a schematic packing, not a crystal structure (real ones need COD data); no layer-to-layer (LLE) or solid sublimation crossing; a mineral that has no solid yet (the first nuclei) has no row, so the first crystals are not shown forming; the reverse of an electrode row never runs; the combustion of a fuel that needs more than 8 molecules to balance (hexane) is listed only; a decomposition lasting one engine step shows its rows only for that step; hydroxide / oxide residues of a decomposition are one rigid cluster per formula unit; NOT verified in a browser (slab look, camera framing, bedrock block, tag and label legibility).
- 2026-10-10, **R5 done** (gates: `tests/micro_surface_view.mjs`, `tests/micro_view.mjs`, `tests/micro_slab.mjs`; nothing verified in a browser).
  - Replay: every row of the legend has a play button; the event of that row starts as soon as its reactants are in the box (one that is missing is sent in, up to 12 s), picked nearest the middle of the box, ignoring the cap, and the camera target follows its centre until it ends and then returns (`MicroScene.followPoint`); a row of another solid surface takes the view to that surface first ("(▶ goes there)" in the legend).
  - Captions and labels: a floating tag at each running event (at most 4; the kind, the electrons, "precipitates", ...) positioned by projecting the event's centre onto the canvas (`MicroScene.project`), the bottom caption keeps the full equation and the words "atoms assigned by element (schematic)", "atoms not tracked", "schematic packing: ...". Charge labels: `Charges on/off` puts a sign and charge on every ion of the box (one instanced plane per label text, turned toward the camera, no depth test, 96 per text), and the atoms whose charge an event changes always carry one (the old charge, then the new one from half way).
  - Performance: the instanced groups hash the uids to decide whether colours need rewriting (the string of uids built each frame is gone); CPU cost of step + events + sync with 305 molecules, 3 events, a 176-atom slab and 145 labels: 0.3 ms per frame in node (gate < 3 ms). The GPU side is not measured.
  - Known limits: the guest keeps a missing reactant in the box for 15 s; the replay of a row whose reactants never arrive gives up after 12 s silently; oxidation-state labels are formal charges (no separate oxidation-state label); NOT verified in a browser.
  - Verification at the end of R5: `cargo rtest --no-fail-fast` 54 binaries, 592 tests, 0 failures; 34 node suites against the rebuilt WASM exit 0 (`pubchem_solid_live` not run: network); pytest 85 passed; `tsc` and `npm run build` clean. Not verified in a browser.
