#!/bin/bash
# NMR environment tables: parse NMRShiftDB2 -> splits -> shipped tables (all splits) -> held-out validation (tables from train+dev only).
# Needs pipeline/raw/nmrshiftdb2/nmrshiftdb2withsignals.sd (see docs/plans/data-acquisition-plan.md) and the .venv with RDKit.
set -e
cd "$(dirname "$0")/.."
.venv/bin/python pipeline/db/parse_nmrshiftdb2.py
S=pipeline/data/nmr_splits
cd engine
cargo build --release --example build_hose --example validate_nmr
cat ../$S/13c_train.jsonl ../$S/13c_dev.jsonl > /tmp/13c_trainall.jsonl
cat ../$S/1h_train.jsonl ../$S/1h_dev.jsonl > /tmp/1h_trainall.jsonl
MIN=1,1,1,1,2,2; MIN1=1,1,2,3,3,3; RED=0.5
./target/release/examples/build_hose --c13 ../$S/13c_train.jsonl,../$S/13c_dev.jsonl,../$S/13c_test.jsonl --h1 ../$S/1h_train.jsonl,../$S/1h_dev.jsonl,../$S/1h_test.jsonl --min-n $MIN --min-n-h1 $MIN1 --redundant $RED --shrink 0 --out data
cargo build --release --example validate_nmr
for nuc in 13c 1h; do
  echo "== $nuc held-out test (increments only, then increments + environment table built from train+dev)"
  ./target/release/examples/validate_nmr ../$S/${nuc}_test.jsonl $nuc --no-table | grep -E "molecules,|^ALL"
  ./target/release/examples/validate_nmr ../$S/${nuc}_test.jsonl $nuc --train13 /tmp/13c_trainall.jsonl --train1 /tmp/1h_trainall.jsonl --min-n $MIN --min-n-h1 $MIN1 --redundant $RED --shrink 0 2>&1 | grep -E "tables built|molecules,|^ALL"
done
