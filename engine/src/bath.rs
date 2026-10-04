//! A thermal bath as a real object (W5): a finite mass of water with ice that exchanges heat with the vessel and the room, so
//! an ice bath holds 273.15 K while ice is left and then warms, a hot bath cools, and the bath's ice fraction is visible.
//!
//! The bath is a lumped body at one temperature. While it holds ice (or freezes), its temperature is pinned at the melting
//! point of its liquid (`melt_k`: 273.15 K for water, lower for a salted ice bath, which the caller sets) and the heat it
//! takes up melts ice (latent heat 333.55 J/g); without ice it warms with the heat capacity of its water. The coupling to
//! the vessel and the loss to the room are supplied by the vessel (`heat_transfer`).

use serde::{Deserialize, Serialize};

/// Specific heat of liquid water, J/(g K), of ice, J/(g K), latent heat of fusion J/g.
const CP_WATER: f64 = 4.184;
const CP_ICE: f64 = 2.09;
const L_FUSION: f64 = 333.55;

/// What a caller asks for: a bath of `mass_g` of water-ice mixture at `temperature_k` with `ice_fraction` of its mass frozen.
/// A bath with ice sits at its melting point whatever `temperature_k` says.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BathSpec {
    pub temperature_k: f64,
    pub mass_g: f64,
    #[serde(default)]
    pub ice_fraction: f64,
    /// Melting point of the bath liquid (K); 273.15 K when absent (a salted ice bath is colder).
    #[serde(default)]
    pub melt_k: Option<f64>,
}

#[derive(Clone, Debug)]
pub struct BathState {
    pub t_k: f64,
    pub water_g: f64,
    pub ice_g: f64,
    pub melt_k: f64,
}

/// The part of the bath the snapshot carries.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BathVisual {
    pub temperature_k: f64,
    pub ice_fraction: f64,
    pub mass_g: f64,
}

impl BathState {
    pub fn new(spec: &BathSpec) -> Self {
        let melt_k = spec.melt_k.unwrap_or(273.15);
        let mass = spec.mass_g.max(1.0);
        // a bath at or below its melting point is frozen as far as its temperature says: at the plateau with the asked ice
        let ice_fraction = if spec.temperature_k < melt_k - 1e-9 { spec.ice_fraction.max(0.05) } else { spec.ice_fraction }.clamp(0.0, 1.0);
        // with ice the temperature is the melting point (a colder request is a salt bath whose `melt_k` the caller sets)
        let t_k = if ice_fraction > 0.0 { melt_k } else { spec.temperature_k };
        BathState { t_k, water_g: mass * (1.0 - ice_fraction), ice_g: mass * ice_fraction, melt_k }
    }

    pub fn mass_g(&self) -> f64 {
        self.water_g + self.ice_g
    }

    fn heat_capacity_j_k(&self) -> f64 {
        (self.water_g * CP_WATER + self.ice_g * CP_ICE).max(1.0)
    }

    /// Advances the bath by `dt_s` with the vessel drawing `q_to_vessel_w` out of it (negative: the vessel warms the bath)
    /// and the room exchanging heat through `g_room_w_k` at `t_room_k`.
    pub fn step(&mut self, q_to_vessel_w: f64, g_room_w_k: f64, t_room_k: f64, dt_s: f64) {
        let mut energy = (-q_to_vessel_w + g_room_w_k * (t_room_k - self.t_k)) * dt_s; // J into the bath
        if self.ice_g > 0.0 && (self.t_k - self.melt_k).abs() < 1e-6 {
            // at the plateau: the heat melts ice (or, drawn out of the bath, freezes water)
            if energy >= 0.0 {
                let melt = (energy / L_FUSION).min(self.ice_g);
                self.ice_g -= melt;
                self.water_g += melt;
                energy -= melt * L_FUSION;
            } else {
                let freeze = (-energy / L_FUSION).min(self.water_g);
                self.ice_g += freeze;
                self.water_g -= freeze;
                energy += freeze * L_FUSION;
            }
            if self.ice_g > 1e-12 && self.water_g > 1e-12 {
                return;
            }
            if self.ice_g <= 1e-12 {
                self.ice_g = 0.0;
            }
        }
        // no ice (or no liquid): sensible heat
        self.t_k += energy / self.heat_capacity_j_k();
        if self.ice_g == 0.0 && self.t_k < self.melt_k && self.water_g > 0.0 {
            // supercooled water freezes at its melting point, releasing the heat that lifts it back
            let excess = (self.melt_k - self.t_k) * self.heat_capacity_j_k();
            let freeze = (excess / L_FUSION).min(self.water_g);
            self.ice_g = freeze;
            self.water_g -= freeze;
            self.t_k = self.melt_k;
        }
    }

    pub fn visual(&self) -> BathVisual {
        BathVisual { temperature_k: self.t_k, ice_fraction: if self.mass_g() > 0.0 { self.ice_g / self.mass_g() } else { 0.0 }, mass_g: self.mass_g() }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ice_holds_the_plateau_then_the_bath_warms() {
        let mut b = BathState::new(&BathSpec { temperature_k: 273.15, mass_g: 1000.0, ice_fraction: 0.3, melt_k: None });
        assert_eq!(b.t_k, 273.15);
        for _ in 0..500 {
            b.step(-100.0, 0.0, 295.15, 1.0); // the vessel returns 100 W to the bath: 50 kJ melts 150 g
        }
        assert_eq!(b.t_k, 273.15, "plateau while ice is left");
        assert!((b.ice_g - (300.0 - 50_000.0 / 333.55)).abs() < 1e-6, "ice left {}", b.ice_g);
        for _ in 0..1000 {
            b.step(-100.0, 0.0, 295.15, 1.0);
        }
        assert_eq!(b.ice_g, 0.0);
        assert!(b.t_k > 273.15, "after the ice is gone the bath warms: {}", b.t_k);
    }

    #[test]
    fn a_hot_bath_cools_through_the_room_coupling() {
        let mut b = BathState::new(&BathSpec { temperature_k: 350.0, mass_g: 1000.0, ice_fraction: 0.0, melt_k: None });
        for _ in 0..3600 {
            b.step(0.0, 2.0, 295.15, 1.0);
        }
        // tau = m cp / G = 4184 / 2 = 2092 s: after 3600 s the excess 54.85 K has fallen by e^-1.72
        assert!((b.t_k - (295.15 + 54.85 * (-3600.0f64 / 2092.0).exp())).abs() < 0.5, "{}", b.t_k);
    }
}
