//! Sparse LU for the Rosenbrock matrix W = I - gamma h J of the extent system.
//!
//! The Jacobian of a reaction network couples two reactions only when they share a species that enters a rate law, so
//! W has a few non-zeros per row however many reactions there are; a dense LU costs O(R^3) (about 40 ms per factorisation
//! for 500 reactions) where this costs roughly the number of non-zeros. Pivots are chosen by the Markowitz count
//! (fewest fill-ins) among entries that pass a threshold-partial-pivoting test (|a_ij| >= 0.1 max |a_.j|), so the
//! factorisation is as stable as partial pivoting and as sparse as the pattern allows.

use std::collections::{BTreeMap, BTreeSet};

/// Threshold of the partial-pivoting test (fraction of the largest entry of the column).
const PIVOT_THRESHOLD: f64 = 0.1;

pub struct SparseLu {
    n: usize,
    /// per elimination step: (pivot row, pivot column, pivot value, U row without the pivot: (column, value))
    steps: Vec<Step>,
}

struct Step {
    row: usize,
    col: usize,
    pivot: f64,
    u: Vec<(usize, f64)>,
    /// (row, multiplier): `y[row] -= multiplier * y[pivot row]` in the forward sweep
    l: Vec<(usize, f64)>,
}

impl SparseLu {
    /// Factorises the n x n matrix given by its rows (column, value); duplicate columns in a row are summed.
    pub fn new(n: usize, rows_in: &[Vec<(usize, f64)>]) -> Self {
        let mut rows: Vec<BTreeMap<usize, f64>> = vec![BTreeMap::new(); n];
        let mut col_rows: Vec<BTreeSet<usize>> = vec![BTreeSet::new(); n];
        for (i, r) in rows_in.iter().enumerate().take(n) {
            for &(j, v) in r {
                if v != 0.0 {
                    *rows[i].entry(j).or_insert(0.0) += v;
                    col_rows[j].insert(i);
                }
            }
        }
        let mut row_active = vec![true; n];
        let mut col_active = vec![true; n];
        let mut steps = Vec::with_capacity(n);

        // Invariant: an active row holds entries of active columns only (every pivot column is eliminated from all
        // active rows), and `col_rows[j]` lists active rows only (a pivot row is removed from its columns), so the
        // Markowitz counts are `rows[i].len()` and `col_rows[j].len()`.
        for _ in 0..n {
            let col_max = |j: usize, rows: &Vec<BTreeMap<usize, f64>>, col_rows: &Vec<BTreeSet<usize>>| -> f64 {
                col_rows[j].iter().map(|&r| rows[r].get(&j).map_or(0.0, |v| v.abs())).fold(0.0, f64::max)
            };
            let cost_of = |i: usize, j: usize, rows: &Vec<BTreeMap<usize, f64>>, col_rows: &Vec<BTreeSet<usize>>| -> f64 {
                ((rows[i].len().saturating_sub(1)) * (col_rows[j].len().saturating_sub(1))) as f64
            };
            let consider = |i: usize, j: usize, best: &mut Option<(usize, usize, f64, f64)>, rows: &Vec<BTreeMap<usize, f64>>, col_rows: &Vec<BTreeSet<usize>>, cmax: f64| {
                let v = rows[i][&j].abs();
                if v < PIVOT_THRESHOLD * cmax || v < 1e-300 {
                    return;
                }
                let cost = cost_of(i, j, rows, col_rows);
                let better = match *best {
                    None => true,
                    Some((_, _, bc, bv)) => cost < bc || (cost == bc && v > bv),
                };
                if better {
                    *best = Some((i, j, cost, v));
                }
            };

            let mut best: Option<(usize, usize, f64, f64)> = None;
            // cheapest row and cheapest column
            let min_row = (0..n).filter(|&i| row_active[i] && !rows[i].is_empty()).min_by_key(|&i| rows[i].len());
            let min_col = (0..n).filter(|&j| col_active[j] && !col_rows[j].is_empty()).min_by_key(|&j| col_rows[j].len());
            if let Some(i) = min_row {
                for (&j, _) in rows[i].iter() {
                    let cm = col_max(j, &rows, &col_rows);
                    consider(i, j, &mut best, &rows, &col_rows, cm);
                }
            }
            if let Some(j) = min_col {
                let cm = col_max(j, &rows, &col_rows);
                for &i in col_rows[j].iter() {
                    consider(i, j, &mut best, &rows, &col_rows, cm);
                }
            }
            if best.is_none() {
                // nothing admissible among the cheapest lines: full scan
                for i in 0..n {
                    if !row_active[i] {
                        continue;
                    }
                    for (&j, _) in rows[i].iter() {
                        let cm = col_max(j, &rows, &col_rows);
                        consider(i, j, &mut best, &rows, &col_rows, cm);
                    }
                }
            }
            let (pr, pc) = match best {
                Some((r, c, _, _)) => (r, c),
                None => {
                    // singular remainder: pair what is left arbitrarily with a zero pivot (solve returns 0 there)
                    let r = (0..n).find(|&i| row_active[i]).unwrap();
                    let c = (0..n).find(|&j| col_active[j]).unwrap();
                    for (&j, _) in rows[r].iter() {
                        col_rows[j].remove(&r);
                    }
                    row_active[r] = false;
                    col_active[c] = false;
                    steps.push(Step { row: r, col: c, pivot: 0.0, u: Vec::new(), l: Vec::new() });
                    continue;
                }
            };
            let pivot = rows[pr][&pc];
            let urow: Vec<(usize, f64)> = rows[pr].iter().filter(|(&j, _)| j != pc).map(|(&j, &v)| (j, v)).collect();
            // the pivot row leaves the active set
            for (&j, _) in rows[pr].iter() {
                col_rows[j].remove(&pr);
            }
            let targets: Vec<usize> = col_rows[pc].iter().copied().collect();
            let mut l = Vec::with_capacity(targets.len());
            for i in targets {
                let a_ic = match rows[i].get(&pc) {
                    Some(&v) => v,
                    None => continue,
                };
                let factor = a_ic / pivot;
                rows[i].remove(&pc);
                for &(j, u) in &urow {
                    let e = rows[i].entry(j).or_insert(0.0);
                    *e -= factor * u;
                    col_rows[j].insert(i);
                }
                l.push((i, factor));
            }
            col_rows[pc].clear();
            row_active[pr] = false;
            col_active[pc] = false;
            steps.push(Step { row: pr, col: pc, pivot, u: urow, l });
        }
        SparseLu { n, steps }
    }

    pub fn solve(&self, b: &[f64]) -> Vec<f64> {
        let mut y = b.to_vec();
        for s in &self.steps {
            let yp = y[s.row];
            if yp != 0.0 {
                for &(i, f) in &s.l {
                    y[i] -= f * yp;
                }
            }
        }
        let mut x = vec![0.0; self.n];
        for s in self.steps.iter().rev() {
            let mut sum = y[s.row];
            for &(j, u) in &s.u {
                sum -= u * x[j];
            }
            x[s.col] = if s.pivot.abs() > 1e-15 && s.pivot.is_finite() {
                let v = sum / s.pivot;
                if v.is_finite() { v } else { 0.0 }
            } else {
                0.0
            };
        }
        x
    }

    /// Number of stored non-zeros of the factors (a measure of fill-in).
    pub fn nnz(&self) -> usize {
        self.steps.iter().map(|s| 1 + s.u.len() + s.l.len()).sum()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kinetics::core::LuFactors;

    fn lcg(seed: &mut u64) -> f64 {
        *seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        ((*seed >> 33) as f64) / ((1u64 << 31) as f64)
    }

    #[test]
    fn matches_the_dense_factorisation_on_random_sparse_matrices() {
        let mut seed = 7;
        for &n in &[1usize, 2, 5, 20, 60] {
            let mut dense = vec![vec![0.0; n]; n];
            for i in 0..n {
                dense[i][i] = 1.0 + lcg(&mut seed);
                for _ in 0..3 {
                    let j = (lcg(&mut seed) * n as f64) as usize % n;
                    dense[i][j] += 0.8 * (lcg(&mut seed) - 0.5);
                }
            }
            let rows: Vec<Vec<(usize, f64)>> = dense
                .iter()
                .map(|r| r.iter().enumerate().filter(|(_, v)| **v != 0.0).map(|(j, v)| (j, *v)).collect())
                .collect();
            let b: Vec<f64> = (0..n).map(|_| lcg(&mut seed) - 0.5).collect();
            let xd = LuFactors::new(dense.clone()).solve(&b);
            let xs = SparseLu::new(n, &rows).solve(&b);
            for i in 0..n {
                assert!((xd[i] - xs[i]).abs() < 1e-9 * (1.0 + xd[i].abs()), "n={} i={} {} vs {}", n, i, xd[i], xs[i]);
            }
        }
    }

    #[test]
    fn a_banded_matrix_has_no_fill_beyond_the_band() {
        let n = 400;
        let rows: Vec<Vec<(usize, f64)>> = (0..n)
            .map(|i| {
                let mut r = vec![(i, 2.0)];
                if i > 0 { r.push((i - 1, -0.5)); }
                if i + 1 < n { r.push((i + 1, -0.5)); }
                r
            })
            .collect();
        let lu = SparseLu::new(n, &rows);
        assert!(lu.nnz() < 6 * n, "tridiagonal fill-in: {} non-zeros", lu.nnz());
        let b = vec![1.0; n];
        let x = lu.solve(&b);
        // residual of A x = b
        for i in 0..n {
            let mut ax = 2.0 * x[i];
            if i > 0 { ax -= 0.5 * x[i - 1]; }
            if i + 1 < n { ax -= 0.5 * x[i + 1]; }
            assert!((ax - 1.0).abs() < 1e-9);
        }
    }
}
