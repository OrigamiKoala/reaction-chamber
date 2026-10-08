# NMR training / development / test splits

Experimental 13C and 1H shifts with atom assignments, read from **NMRShiftDB2** (https://nmrshiftdb2.sourceforge.io) by
`pipeline/db/parse_nmrshiftdb2.py`. Licence of the source: to be reviewed (see `docs/data-licences.md`).

| file | role |
|---|---|
| `13c_train.jsonl`, `1h_train.jsonl` | **training** (60 % of the connectivity classes, plus partially assigned spectra) |
| `13c_dev.jsonl`, `1h_dev.jsonl` | **development**: parameter choice (minimum counts, pruning) only |
| `13c_test.jsonl`, `1h_test.jsonl` | **held-out test** (30 %): fully assigned spectra, never used to fit or tune anything that is reported as held-out error |

The split is by the first block of the InChIKey (isomers stay together): `md5(block) mod 10` < 3 test, = 3 dev, else train.
A record: `id` (InChIKey), `smiles` (RDKit canonical, atoms numbered in string order), `solvent`, `complete`, and
`c13_by_atom` / `c13` (13C) or `h1_by_atom` / `h1` (1H). Held-out error figures come from tables built from train + dev
alone (`validate_nmr --train13 ... --train1 ...`); the tables shipped in `engine/data/nmr_hose_*.json` are built from all
three files, which is why their error on the test file is not an independent measurement.
