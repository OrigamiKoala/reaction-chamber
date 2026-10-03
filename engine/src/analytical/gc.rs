//! Gas-chromatography retention on a non-polar capillary column under a temperature programme.
//!
//! The retention factor follows the vapour pressure of the solute: k(T) = exp(B (1/T - 1/T1)) with B = dHvap / R (from the
//! saturation-pressure model, else Trouton's rule from the normal boiling point) and T1 ~ 0.92 Tb the temperature at which
//! k = 1 (calibrated on n-alkanes on a 5 % phenyl phase). The solute is integrated through the programme until it has
//! travelled the column length: sum over time of 1 / (t_M (1 + k)) = 1.

pub const T_HOLD_MIN: f64 = 1.0;
pub const T_START_C: f64 = 40.0;
pub const RAMP_C_PER_MIN: f64 = 20.0;
pub const T_END_C: f64 = 300.0;
pub const T_DEAD_MIN: f64 = 0.9;
pub const RUN_MIN: f64 = T_HOLD_MIN + (T_END_C - T_START_C) / RAMP_C_PER_MIN + 2.0;

pub fn oven_c(t_min: f64) -> f64 {
    if t_min <= T_HOLD_MIN {
        T_START_C
    } else {
        (T_START_C + RAMP_C_PER_MIN * (t_min - T_HOLD_MIN)).min(T_END_C)
    }
}

/// Retention time (min) of a solute of normal boiling point `tb_k` and `b_k` = dHvap/R (K); None if it does not elute in the run.
pub fn retention_time(tb_k: f64, b_k: Option<f64>) -> Option<f64> {
    let b = b_k.filter(|b| *b > 500.0).unwrap_or(10.58 * tb_k);
    let t1 = 0.92 * tb_k;
    let dt = 0.005;
    let mut t = 0.0;
    let mut x = 0.0; // fraction of the column travelled
    while t < RUN_MIN {
        let temp = oven_c(t) + 273.15;
        let k = (b * (1.0 / temp - 1.0 / t1)).exp();
        x += dt / (T_DEAD_MIN * (1.0 + k));
        t += dt;
        if x >= 1.0 {
            return Some(t.max(T_DEAD_MIN));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn heavier_elutes_later() {
        let hexane = retention_time(342.0, None).unwrap();
        let decane = retention_time(447.0, None).unwrap();
        let hexadecane = retention_time(560.0, None).unwrap();
        assert!(hexane < decane && decane < hexadecane, "{} {} {}", hexane, decane, hexadecane);
        assert!(hexane > T_DEAD_MIN && hexane < 3.0, "{}", hexane);
        assert!(decane > 3.0 && decane < 8.0, "{}", decane);
    }
}
