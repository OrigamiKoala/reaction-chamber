//! Fits Mayr reactivity parameter predictors (Section 5.6 of rates-from-data-plan.md).
//!
//! Featurizes Mayr nucleophiles and electrophiles from `data/mayr_parameters.json`, holds out whole compound CLASSES (the
//! database's `class` path, chosen by a hash of the class name, about a quarter of the rows), fits ridge regression models
//! for N, sN and E on the rest and evaluates them on the held-out classes, so the reported error is the error on new chemistry.
//! A model is enabled only when its held-out rms error is at most 0.8 times that of predicting the training mean (the weakest
//! sensible alternative); the table of each parameter's baseline is printed. Writes `data/mayr_predictor.json`.

use std::fs::File;
use std::io::Write;
use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct MayrRow {
    is_nucleophile: bool,
    n: f64,
    s_n: f64,
    e: f64,
    smiles: Option<String>,
    quality_stars: u32,
    #[serde(default)]
    class: String,
}

#[derive(Deserialize)]
struct MayrFile {
    parameters: Vec<MayrRow>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ModelCoefficients {
    pub weights: Vec<f64>,
    pub intercept: f64,
    pub held_out_rms: f64,
    pub enabled: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MayrPredictorFile {
    pub feature_names: Vec<String>,
    pub n_model: ModelCoefficients,
    pub sn_model: ModelCoefficients,
    pub e_model: ModelCoefficients,
}

/// Computes a standard 8-dimensional feature vector for a molecule.
fn featurize(smiles_str: &str) -> Option<Vec<f64>> {
    let mol = reaction_chamber_engine::smiles::parse(smiles_str)?;
    let charge: f64 = mol.atoms.iter().map(|a| a.charge as f64).sum();
    let n_heavy: f64 = mol.atoms.iter().filter(|a| a.element != "H").count() as f64;
    let n_rings: f64 = ((mol.bonds.len() as isize - mol.atoms.len() as isize + 1).max(0)) as f64;
    let n_mult_bonds: f64 = mol.bonds.iter().filter(|b| b.2 >= 2.0).count() as f64;
    let n_o: f64 = mol.atoms.iter().filter(|a| a.element == "O").count() as f64;
    let n_n: f64 = mol.atoms.iter().filter(|a| a.element == "N").count() as f64;
    let n_halogens: f64 = mol.atoms.iter().filter(|a| matches!(a.element.as_str(), "F" | "Cl" | "Br" | "I")).count() as f64;
    let n_aromatic: f64 = mol.atoms.iter().filter(|a| a.aromatic).count() as f64;

    Some(vec![
        charge,
        n_heavy,
        n_rings,
        n_mult_bonds,
        n_o,
        n_n,
        n_halogens,
        n_aromatic,
    ])
}

/// Fits a ridge regression model y = w^T x + b with regularization lambda = 1.0.
fn fit_ridge(x: &[Vec<f64>], y: &[f64], lambda: f64) -> (Vec<f64>, f64) {
    let n = x.len();
    if n == 0 {
        return (vec![0.0; 8], 0.0);
    }
    let p = x[0].len();

    // Compute means
    let mean_y = y.iter().sum::<f64>() / n as f64;
    let mut mean_x = vec![0.0; p];
    for row in x {
        for j in 0..p {
            mean_x[j] += row[j];
        }
    }
    for j in 0..p {
        mean_x[j] /= n as f64;
    }

    // Center data
    let mut x_c = vec![vec![0.0; p]; n];
    let mut y_c = vec![0.0; n];
    for i in 0..n {
        y_c[i] = y[i] - mean_y;
        for j in 0..p {
            x_c[i][j] = x[i][j] - mean_x[j];
        }
    }

    // Normal equations: (X_c^T X_c + lambda I) w = X_c^T y_c
    // Compute A = X_c^T X_c + lambda I and b = X_c^T y_c
    let mut a = vec![vec![0.0; p]; p];
    let mut b_vec = vec![0.0; p];
    for i in 0..n {
        for j in 0..p {
            b_vec[j] += x_c[i][j] * y_c[i];
            for k in 0..p {
                a[j][k] += x_c[i][j] * x_c[i][k];
            }
        }
    }
    for j in 0..p {
        a[j][j] += lambda;
    }

    // Solve via Gaussian elimination with partial pivoting
    let w = solve_linear_system(&mut a, &mut b_vec);
    let mut intercept = mean_y;
    for j in 0..p {
        intercept -= w[j] * mean_x[j];
    }
    (w, intercept)
}

fn solve_linear_system(a: &mut [Vec<f64>], b: &mut [f64]) -> Vec<f64> {
    let n = b.len();
    for i in 0..n {
        // Pivot
        let mut max_row = i;
        for k in (i + 1)..n {
            if a[k][i].abs() > a[max_row][i].abs() {
                max_row = k;
            }
        }
        a.swap(i, max_row);
        b.swap(i, max_row);

        let diag = a[i][i];
        if diag.abs() < 1e-12 {
            continue;
        }
        for k in (i + 1)..n {
            let factor = a[k][i] / diag;
            b[k] -= factor * b[i];
            for j in i..n {
                a[k][j] -= factor * a[i][j];
            }
        }
    }

    let mut x = vec![0.0; n];
    for i in (0..n).rev() {
        let mut sum = b[i];
        for j in (i + 1)..n {
            sum -= a[i][j] * x[j];
        }
        let diag = a[i][i];
        x[i] = if diag.abs() > 1e-12 { sum / diag } else { 0.0 };
    }
    x
}

fn eval_rms(x: &[Vec<f64>], y: &[f64], w: &[f64], intercept: f64) -> f64 {
    if x.is_empty() {
        return 0.0;
    }
    let mut sum_sq = 0.0;
    for i in 0..x.len() {
        let mut pred = intercept;
        for j in 0..w.len() {
            pred += w[j] * x[i][j];
        }
        sum_sq += (y[i] - pred).powi(2);
    }
    (sum_sq / x.len() as f64).sqrt()
}

fn main() {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let params_path = Path::new(manifest_dir).join("data/mayr_parameters.json");
    let out_path = Path::new(manifest_dir).join("data/mayr_predictor.json");

    let file = File::open(&params_path).expect("open mayr_parameters.json");
    let data: MayrFile = serde_json::from_reader(file).expect("parse mayr_parameters.json");

    let class_held = |class: &str| -> bool {
        let mut h: u64 = 0xcbf29ce484222325;
        for b in class.bytes() {
            h ^= b as u64;
            h = h.wrapping_mul(0x100000001b3);
        }
        h % 4 == 0
    };
    let (mut nuc_tr, mut nuc_ho, mut el_tr, mut el_ho) = (Vec::new(), Vec::new(), Vec::new(), Vec::new());
    for row in data.parameters {
        if row.quality_stars < 1 {
            continue;
        }
        let Some(smiles) = &row.smiles else { continue };
        let Some(feat) = featurize(smiles) else { continue };
        let held = class_held(&row.class);
        let entry = (feat, row.n, row.s_n, row.e);
        match (row.is_nucleophile, held) {
            (true, false) => nuc_tr.push(entry),
            (true, true) => nuc_ho.push(entry),
            (false, false) => el_tr.push(entry),
            (false, true) => el_ho.push(entry),
        }
    }
    println!("nucleophiles: {} train / {} held-out classes; electrophiles: {} train / {} held-out classes", nuc_tr.len(), nuc_ho.len(), el_tr.len(), el_ho.len());
    let col = |v: &Vec<(Vec<f64>, f64, f64, f64)>, f: fn(&(Vec<f64>, f64, f64, f64)) -> f64| -> Vec<f64> { v.iter().map(f).collect() };
    let xs = |v: &Vec<(Vec<f64>, f64, f64, f64)>| -> Vec<Vec<f64>> { v.iter().map(|e| e.0.clone()).collect() };
    let baseline = |train: &[f64], held: &[f64]| -> f64 {
        let m = train.iter().sum::<f64>() / train.len().max(1) as f64;
        (held.iter().map(|y| (y - m).powi(2)).sum::<f64>() / held.len().max(1) as f64).sqrt()
    };
    let fit = |tr: &Vec<(Vec<f64>, f64, f64, f64)>, ho: &Vec<(Vec<f64>, f64, f64, f64)>, f: fn(&(Vec<f64>, f64, f64, f64)) -> f64, label: &str, max_rms: f64| -> ModelCoefficients {
        let (ytr, yho) = (col(tr, f), col(ho, f));
        let (w, b) = fit_ridge(&xs(tr), &ytr, 10.0);
        let rms = eval_rms(&xs(ho), &yho, &w, b);
        let base = baseline(&ytr, &yho);
        let enabled = !ho.is_empty() && rms <= 0.8 * base && rms <= max_rms;
        println!("{label}: held-out rms {:.3}, predicting the training mean {:.3} -> {}", rms, base, if enabled { "ENABLED" } else { "off" });
        ModelCoefficients { weights: w, intercept: b, held_out_rms: rms, enabled }
    };
    let n_model = fit(&nuc_tr, &nuc_ho, |e| e.1, "N", 1.5);
    let sn_model = fit(&nuc_tr, &nuc_ho, |e| e.2, "sN", 0.15);
    let e_model = fit(&el_tr, &el_ho, |e| e.3, "E", 1.5);

    let feature_names = vec![
        "charge".to_string(),
        "n_heavy".to_string(),
        "n_rings".to_string(),
        "n_mult_bonds".to_string(),
        "n_o".to_string(),
        "n_n".to_string(),
        "n_halogens".to_string(),
        "n_aromatic".to_string(),
    ];

    let output = MayrPredictorFile { feature_names, n_model, sn_model, e_model };

    let json_bytes = serde_json::to_string_pretty(&output).expect("serialize predictor");
    let mut out_file = File::create(&out_path).expect("create mayr_predictor.json");
    out_file.write_all(json_bytes.as_bytes()).expect("write mayr_predictor.json");

    println!("Wrote predictor to {}", out_path.display());
}
