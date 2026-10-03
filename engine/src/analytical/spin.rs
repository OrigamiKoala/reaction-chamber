//! Spin-1/2 multiplet patterns: first-order (n+1 convolution) and exact (Hamiltonian diagonalisation, second-order effects).

/// One transition: frequency (Hz) and relative intensity.
#[derive(Clone, Copy, Debug)]
pub struct Line {
    pub hz: f64,
    pub w: f64,
}

/// First-order pattern of a nucleus coupled to groups of equivalent partners: `(n spins, J Hz)` each.
/// Lines are centred on 0 Hz, weights sum to 1.
pub fn first_order(partners: &[(u32, f64)]) -> Vec<Line> {
    let mut lines = vec![Line { hz: 0.0, w: 1.0 }];
    for &(n, j) in partners {
        if n == 0 || j.abs() < 1e-9 {
            continue;
        }
        let mut binom = vec![1.0f64];
        for k in 1..=n as usize {
            let mut next = vec![1.0f64; k + 1];
            for m in 1..k {
                next[m] = binom[m - 1] + binom[m];
            }
            binom = next;
        }
        let tot: f64 = binom.iter().sum();
        let mut out: Vec<Line> = Vec::with_capacity(lines.len() * binom.len());
        for l in &lines {
            for (k, b) in binom.iter().enumerate() {
                out.push(Line { hz: l.hz + (k as f64 - n as f64 / 2.0) * j, w: l.w * b / tot });
            }
        }
        lines = merge_lines(out, 0.05);
    }
    lines
}

/// Merges lines closer than `tol` Hz (weights added, positions averaged).
pub fn merge_lines(mut v: Vec<Line>, tol: f64) -> Vec<Line> {
    v.sort_by(|a, b| a.hz.partial_cmp(&b.hz).unwrap());
    let mut out: Vec<Line> = Vec::new();
    for l in v {
        match out.last_mut() {
            Some(last) if l.hz - last.hz < tol => {
                let w = last.w + l.w;
                last.hz = (last.hz * last.w + l.hz * l.w) / w;
                last.w = w;
            }
            _ => out.push(l),
        }
    }
    out
}

/// Conventional multiplet name of first-order partner groups (largest coupling first); "m" when it gets unwieldy.
pub fn multiplicity_label(partners: &[(u32, f64)]) -> String {
    let mut p: Vec<(u32, f64)> = partners.iter().copied().filter(|(n, j)| *n > 0 && j.abs() > 0.3).collect();
    if p.is_empty() {
        return "s".into();
    }
    // couplings within 0.8 Hz of one another act as one (n+1 rule)
    p.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    let mut merged: Vec<(u32, f64)> = Vec::new();
    for (n, j) in p {
        match merged.last_mut() {
            Some(last) if (last.1 - j).abs() < 0.8 => {
                let tot = last.0 + n;
                last.1 = (last.1 * last.0 as f64 + j * n as f64) / tot as f64;
                last.0 = tot;
            }
            _ => merged.push((n, j)),
        }
    }
    let name = |n: u32| match n {
        1 => "d",
        2 => "t",
        3 => "q",
        4 => "quint",
        5 => "sext",
        6 => "sept",
        _ => "",
    };
    let total_lines: u32 = merged.iter().map(|(n, _)| n + 1).product();
    if merged.iter().any(|(n, _)| name(*n).is_empty()) || total_lines > 16 {
        return "m".into();
    }
    if merged.len() == 1 {
        return name(merged[0].0).into();
    }
    if merged.len() > 3 {
        return "m".into();
    }
    // compound names: dd, dt, td, ddd, ... (letters of the single-letter forms only)
    if merged.iter().all(|(n, _)| *n <= 3) {
        return merged.iter().map(|(n, _)| name(*n)).collect::<Vec<_>>().join("");
    }
    "m".into()
}

fn jacobi(a: &mut [f64], n: usize) -> (Vec<f64>, Vec<f64>) {
    let mut v = vec![0.0; n * n];
    for i in 0..n {
        v[i * n + i] = 1.0;
    }
    for _sweep in 0..50 {
        let mut off = 0.0;
        let mut diag = 0.0;
        for i in 0..n {
            diag += a[i * n + i] * a[i * n + i];
            for j in (i + 1)..n {
                off += a[i * n + j] * a[i * n + j];
            }
        }
        if off <= 1e-22 * diag.max(1e-30) {
            break;
        }
        for p in 0..n.saturating_sub(1) {
            for q in (p + 1)..n {
                let apq = a[p * n + q];
                if apq.abs() < 1e-14 {
                    continue;
                }
                let theta = (a[q * n + q] - a[p * n + p]) / (2.0 * apq);
                let t = if theta >= 0.0 { 1.0 } else { -1.0 } / (theta.abs() + (theta * theta + 1.0).sqrt());
                let c = 1.0 / (t * t + 1.0).sqrt();
                let s = t * c;
                for k in 0..n {
                    let (akp, akq) = (a[k * n + p], a[k * n + q]);
                    a[k * n + p] = c * akp - s * akq;
                    a[k * n + q] = s * akp + c * akq;
                }
                for k in 0..n {
                    let (apk, aqk) = (a[p * n + k], a[q * n + k]);
                    a[p * n + k] = c * apk - s * aqk;
                    a[q * n + k] = s * apk + c * aqk;
                }
                for k in 0..n {
                    let (vkp, vkq) = (v[k * n + p], v[k * n + q]);
                    v[k * n + p] = c * vkp - s * vkq;
                    v[k * n + q] = s * vkp + c * vkq;
                }
            }
        }
    }
    let e: Vec<f64> = (0..n).map(|i| a[i * n + i]).collect();
    (e, v)
}

/// Exact spectrum of a system of spin-1/2 nuclei: `nu_hz[i]` Larmor offsets, `j[i][j]` couplings (Hz), `groups` index sets
/// whose detection operator gives one sub-spectrum each. Each group's lines sum to its size. At most 10 spins.
pub fn simulate_exact(nu_hz: &[f64], jm: &[Vec<f64>], groups: &[Vec<usize>]) -> Vec<Vec<Line>> {
    let n = nu_hz.len();
    assert!(n <= 10);
    let mean = nu_hz.iter().sum::<f64>() / n.max(1) as f64;
    let nu: Vec<f64> = nu_hz.iter().map(|x| x - mean).collect();
    let dim = 1usize << n;
    // blocks by number of up spins
    let mut states: Vec<Vec<usize>> = vec![Vec::new(); n + 1];
    let mut index = vec![0usize; dim];
    for s in 0..dim {
        let k = s.count_ones() as usize;
        index[s] = states[k].len();
        states[k].push(s);
    }
    let mut eig: Vec<(Vec<f64>, Vec<f64>)> = Vec::with_capacity(n + 1);
    for k in 0..=n {
        let st = &states[k];
        let m = st.len();
        let mut h = vec![0.0; m * m];
        for (a, &s) in st.iter().enumerate() {
            let mi = |i: usize| if (s >> i) & 1 == 1 { 0.5 } else { -0.5 };
            let mut d = 0.0;
            for i in 0..n {
                d += nu[i] * mi(i);
                for jj in (i + 1)..n {
                    d += jm[i][jj] * mi(i) * mi(jj);
                }
            }
            h[a * m + a] = d;
            for i in 0..n {
                for jj in (i + 1)..n {
                    if jm[i][jj] != 0.0 && ((s >> i) & 1) != ((s >> jj) & 1) {
                        let s2 = s ^ (1 << i) ^ (1 << jj);
                        let b = index[s2];
                        h[a * m + b] = 0.5 * jm[i][jj];
                    }
                }
            }
        }
        eig.push(jacobi(&mut h, m));
    }
    let norm = (1usize << (n.max(1) - 1)) as f64;
    let mut out: Vec<Vec<Line>> = vec![Vec::new(); groups.len()];
    for k in 1..=n {
        let (ea, va) = (&eig[k].0, &eig[k].1);
        let (eb, vb) = (&eig[k - 1].0, &eig[k - 1].1);
        let (ma, mb) = (states[k].len(), states[k - 1].len());
        // lowering transitions of every group: (b_state, a_state) pairs
        let ts: Vec<Vec<(usize, usize)>> = groups
            .iter()
            .map(|grp| {
                let mut t = Vec::new();
                for (ia, &s) in states[k].iter().enumerate() {
                    for &i in grp {
                        if (s >> i) & 1 == 1 {
                            t.push((index[s ^ (1 << i)], ia));
                        }
                    }
                }
                t
            })
            .collect();
        let mut w = vec![vec![0.0; mb]; groups.len()];
        let mut amps = vec![0.0; groups.len()];
        for a in 0..ma {
            for (gi, t) in ts.iter().enumerate() {
                for x in w[gi].iter_mut() {
                    *x = 0.0;
                }
                for &(ib, ia) in t {
                    w[gi][ib] += va[ia * ma + a];
                }
            }
            for b in 0..mb {
                let mut total = 0.0;
                for gi in 0..groups.len() {
                    let mut amp = 0.0;
                    for ib in 0..mb {
                        amp += vb[ib * mb + b] * w[gi][ib];
                    }
                    amps[gi] = amp;
                    total += amp;
                }
                // the observed intensity is coherent over all spins; it is attributed to groups by their amplitude shares
                let inten = total * total / norm;
                if inten > 1e-7 {
                    let sq: f64 = amps.iter().map(|x| x * x).sum::<f64>().max(1e-300);
                    for gi in 0..groups.len() {
                        let share = amps[gi] * amps[gi] / sq;
                        if share > 1e-6 {
                            out[gi].push(Line { hz: ea[a] - eb[b] + mean, w: inten * share });
                        }
                    }
                }
            }
        }
    }
    out.into_iter().map(|l| merge_lines(l, 0.03)).collect()
}

/// Names a set of resolved lines: s / d / t / q / quint ... when they are equally spaced with binomial weights, else "m".
pub fn label_lines(lines: &[Line]) -> (String, Vec<f64>) {
    let tot: f64 = lines.iter().map(|l| l.w).sum();
    let strong: Vec<Line> = merge_lines(lines.iter().copied().filter(|l| l.w > 0.01 * tot).collect(), 0.6);
    if strong.len() <= 1 {
        return ("s".into(), vec![]);
    }
    let spacings: Vec<f64> = strong.windows(2).map(|w| w[1].hz - w[0].hz).collect();
    let mean = spacings.iter().sum::<f64>() / spacings.len() as f64;
    let even = spacings.iter().all(|s| (s - mean).abs() < 0.2 * mean.abs().max(1.0));
    if even && strong.len() <= 7 {
        let n = strong.len() - 1;
        // binomial check, tolerant of roofing
        let mut binom = vec![1.0f64];
        for k in 1..=n {
            let mut next = vec![1.0f64; k + 1];
            for m in 1..k {
                next[m] = binom[m - 1] + binom[m];
            }
            binom = next;
        }
        let bt: f64 = binom.iter().sum();
        let ok = strong.iter().zip(&binom).all(|(l, b)| ((l.w / tot) - b / bt).abs() < 0.12 * (b / bt).max(0.15));
        if ok {
            let name = ["s", "d", "t", "q", "quint", "sext", "sept"];
            return (name[n].to_string(), vec![mean.abs()]);
        }
    }
    ("m".into(), vec![])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn triplet_pattern() {
        let l = first_order(&[(2, 7.0)]);
        assert_eq!(l.len(), 3);
        assert!((l[1].w - 0.5).abs() < 1e-9);
        assert!((l[2].hz - 7.0).abs() < 1e-9);
        assert_eq!(multiplicity_label(&[(2, 7.0)]), "t");
        assert_eq!(multiplicity_label(&[(1, 17.0), (1, 10.0)]), "dd");
        assert_eq!(multiplicity_label(&[(2, 7.0), (2, 7.2)]), "quint");
    }

    #[test]
    fn exact_ab_matches_analytic() {
        // AB quartet: lines at +-(J/2) +- D/2 with D = sqrt(dnu^2 + J^2)
        let (dnu, j) = (10.0, 8.0);
        let jm = vec![vec![0.0, j], vec![j, 0.0]];
        let res = simulate_exact(&[0.0, dnu], &jm, &[vec![0], vec![1]]);
        let all: Vec<Line> = merge_lines(res.iter().flatten().copied().collect(), 0.03);
        assert_eq!(all.len(), 4, "{:?}", all);
        let d = (dnu * dnu + j * j).sqrt();
        let expect = [dnu / 2.0 - (d + j) / 2.0, dnu / 2.0 - (d - j) / 2.0, dnu / 2.0 + (d - j) / 2.0, dnu / 2.0 + (d + j) / 2.0];
        for (a, e) in all.iter().zip(expect.iter()) {
            assert!((a.hz - e).abs() < 1e-6, "{} vs {}", a.hz, e);
        }
        // inner lines are stronger than outer (roofing)
        assert!(all[1].w > all[0].w);
        // total intensity is 2 (one per spin)
        let tot: f64 = all.iter().map(|l| l.w).sum();
        assert!((tot - 2.0).abs() < 1e-9);
    }

    #[test]
    fn exact_ethyl_is_first_order_at_large_shift_difference() {
        // CH3 (3 spins at 0 Hz) + CH2 (2 spins at 800 Hz), J = 7
        let nu = [0.0, 0.0, 0.0, 800.0, 800.0];
        let mut jm = vec![vec![0.0; 5]; 5];
        for i in 0..3 {
            for k in 3..5 {
                jm[i][k] = 7.0;
                jm[k][i] = 7.0;
            }
        }
        let res = simulate_exact(&nu, &jm, &[vec![0, 1, 2], vec![3, 4]]);
        let (lab, j) = label_lines(&res[0]);
        assert_eq!(lab, "t");
        assert!((j[0] - 7.0).abs() < 0.1);
        let (lab, _) = label_lines(&res[1]);
        assert_eq!(lab, "q");
        let t0: f64 = res[0].iter().map(|l| l.w).sum();
        let t1: f64 = res[1].iter().map(|l| l.w).sum();
        assert!((t0 + t1 - 5.0).abs() < 1e-3, "{} {}", t0, t1);
        assert!((t0 - 3.0).abs() < 0.02, "{}", t0);
    }
}
