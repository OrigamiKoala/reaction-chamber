//! Rates of discovered reactions: how fast a thermodynamically allowed reaction actually goes.
//!
//! Eligibility is thermodynamic (`discovery.rs`: Delta_r G(T, P, composition) < 0). Speed is a separate model, because
//! two couples with the same driving force can differ by twenty orders of magnitude in rate (MnO4- and Fe2+ react at
//! once, MnO4- and Cl- in neutral water do not). No couple is excluded by name; a couple that must rearrange bonds is
//! simply slow.
//!
//! * Homogeneous electron transfer: the Marcus cross relation `k12 = sqrt(k11 k22 K12 f12)` with the self-exchange rate
//!   constants of the two couples (a datum of the species record when it has one, else an estimate by couple class) and
//!   the diffusion ceiling of the encounter.
//! * Thermal decomposition of a solid: a first-order rate with an Arrhenius activation energy taken from the reaction
//!   enthalpy (the barrier of a solid-state decomposition is at least its endothermicity).
//!
//! Every constant here is a documented default of tier Speculative; records override them with data.

use crate::physics::R_GAS;

/// Bimolecular collision frequency in solution, M^-1 s^-1 (Marcus' Z).
pub const Z_COLLISION: f64 = 1.0e11;
/// Self-exchange rate constant (M^-1 s^-1) of a couple whose two forms differ only in charge: outer-sphere electron
/// transfer between solvated ions (aqua and ammine couples span 1e-4 to 1e5, cyanide and polypyridine couples 1e3 to 1e8).
pub const K_SELF_OUTER_SPHERE: f64 = 1.0;
/// Self-exchange rate constant of a couple of a *labile* element (`redox_lability.json`) whose forms differ in composition
/// (MnO4- / Mn2+, I2 / I-, Cu(OH)2 / Cu+): the transfer needs an oxygen or ligand rearrangement but the element is known to
/// react on bench time scales, so the barrier is moderate.
pub const K_SELF_LABILE_REARRANGING: f64 = 1.0e-3;
/// Self-exchange rate constant of a couple whose forms differ in composition (atom or bond transfer: oxo-anions, halogens,
/// peroxides): the bond rearrangement adds a barrier that makes the apparent self-exchange rate tiny (O-O and
/// oxo-anion couples exchange on the scale of days to years; with the cross relation an uncatalysed peroxide
/// disproportionation comes out at ~1e-8 /s and permanganate / chloride at neutral pH is inert).
pub const K_SELF_BOND_REARRANGING: f64 = 1.0e-14;
/// Pre-exponential factor of a solid-state decomposition, 1/s (a lattice vibration frequency).
pub const NU_SOLID_STATE: f64 = 1.0e13;
/// Lowest activation energy assumed for a decomposition, J/mol: the bond-breaking and lattice-rearrangement barrier of a
/// solid-state reaction even when the reaction itself is nearly thermoneutral (dehydrations of hydroxides, 80-100 kJ/mol;
/// metastable Cu(OH)2 turns to CuO over hours at room temperature, not at once).
pub const EA_DECOMPOSITION_MIN: f64 = 100_000.0;

/// A rate constant with the tier of the data behind it.
#[derive(Clone, Debug)]
pub struct EtRate {
    /// M^-1 s^-1
    pub k12: f64,
    pub speculative: bool,
    pub note: String,
}

/// Self-exchange rate constant of the couple `a` / `b` (two forms of one redox element): the record's datum when the store
/// has one, else the class value of the oxidation half-reaction template that relates the two structures
/// (`data/reaction_templates.json`, tier Speculative), else the estimate by composition. Returns (k, from_data), where
/// `from_data` is true for the first two.
pub fn self_exchange_k(a: &str, b: &str) -> (f64, bool) {
    if let Ok(store) = crate::db::SpeciesStore::global().read() {
        for (x, y) in [(a, b), (b, a)] {
            if let Some(rec) = store.get(x) {
                if let Some(c) = rec.redox.iter().find(|c| c.partner == y) {
                    if let Some(k) = c.k_self.as_ref().filter(|d| d.value > 0.0) {
                        return (k.value, true);
                    }
                }
            }
        }
    }
    // a couple that an oxidation half-reaction template relates (alcohol / carbonyl, aldehyde / acid): the class value
    if let Some(k) = crate::network_generator::class_self_exchange_k(a, b) {
        return (k, true);
    }
    let same_atoms = match (crate::ions::species_elements(a), crate::ions::species_elements(b)) {
        (Some(ea), Some(eb)) => ea == eb,
        _ => false,
    };
    let labile = match (crate::ions::species_elements(a), crate::ions::species_elements(b)) {
        (Some(ea), Some(eb)) => ea.keys().any(|e| eb.contains_key(e) && crate::gem::redox::is_labile_redox_element(e) && e != "H" && e != "O"),
        _ => false,
    };
    (if same_atoms { K_SELF_OUTER_SPHERE } else if labile { K_SELF_LABILE_REARRANGING } else { K_SELF_BOND_REARRANGING }, false)
}

/// Encounter radius (m) of a species from its size.
fn radius_m(sp: &str) -> f64 {
    crate::ions::species_elements(sp).and(crate::crystal::ionic_radius_angstrom(sp)).unwrap_or(2.5).clamp(1.0, 5.0) * 1e-10
}

/// Rate constant (M^-1 s^-1) of the electron transfer from `donor` (turning into `donor_product`) to `acceptor` (turning
/// into `acceptor_product`) at `t_k`, for a reaction transferring `n_e` electrons with standard Gibbs energy `dg0_j`.
pub fn electron_transfer_rate(
    donor: &str,
    donor_product: &str,
    acceptor: &str,
    acceptor_product: &str,
    n_e: f64,
    dg0_j: f64,
    t_k: f64,
    ionic_strength_mol_l: f64,
) -> EtRate {
    let (k11, d1) = self_exchange_k(donor, donor_product);
    let (k22, d2) = self_exchange_k(acceptor, acceptor_product);
    let rt = R_GAS * t_k.max(1.0);
    // equilibrium constant of one electron transferred
    let ln_k12 = -dg0_j / (n_e.max(1.0) * rt);
    // Marcus: ln f = (ln K)^2 / (4 ln(k11 k22 / Z^2)); the cross relation holds in the normal region, so the driving
    // force is capped where the formula stops increasing
    let l = (k11 * k22 / (Z_COLLISION * Z_COLLISION)).ln(); // negative
    let ln_k = ln_k12.clamp(l, -l);
    let ln_f = ln_k * ln_k / (4.0 * l);
    let k_marcus = (0.5 * ((k11 * k22).ln() + ln_k + ln_f)).exp();
    let (z_a, z_b) = (crate::ions::species_charge(donor) as f64, crate::ions::species_charge(acceptor) as f64);
    let k_diff = crate::transport::k_diffusion_limit_screened(radius_m(donor), radius_m(acceptor), z_a, z_b, t_k, crate::transport::viscosity_water_pa_s(t_k), crate::transport::dielectric_water(t_k), ionic_strength_mol_l);
    let k12 = if k_diff > 0.0 { k_marcus * k_diff / (k_marcus + k_diff) } else { k_marcus };
    EtRate {
        k12,
        speculative: !(d1 && d2),
        note: format!("Marcus cross relation, k11 = {:.1e}{} k22 = {:.1e}{} M^-1 s^-1", k11, if d1 { "" } else { " (class estimate)" }, k22, if d2 { "" } else { " (class estimate)" }),
    }
}

/// First-order rate constant (1/s) of the thermal decomposition of a solid at `t_k`: `NU exp(-Ea / RT)` with the activation
/// energy equal to the reaction enthalpy per extent (the barrier of a decomposition is at least its endothermicity; at
/// least `EA_DECOMPOSITION_MIN`).
pub fn decomposition_rate(delta_h_j: f64, t_k: f64) -> f64 {
    let ea = delta_h_j.max(0.0).max(EA_DECOMPOSITION_MIN);
    NU_SOLID_STATE * (-ea / (R_GAS * t_k.max(1.0))).exp()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exergonic_outer_sphere_transfer_is_fast_and_bond_breaking_is_slow() {
        // two outer-sphere couples with 0.5 V of driving force
        let dg = -0.5 * 96485.0;
        let fast = electron_transfer_rate("Fe(CN)6-4", "Fe(CN)6-3", "Ce+4", "Ce+3", 1.0, dg, 298.15, 0.01);
        // the same driving force for couples of inert elements that must rearrange bonds on both sides
        let slow = electron_transfer_rate("S2O3-2", "S4O6-2", "NO3-", "NH3", 1.0, dg, 298.15, 0.01);
        assert!(fast.k12 > 1e3 * slow.k12, "outer sphere {:e} vs bond rearranging {:e}", fast.k12, slow.k12);
        assert!(fast.k12 <= 1e10);
    }

    #[test]
    fn like_charged_ions_still_meet_in_salt() {
        // Fe2+ + Ce4+ would be limited to ~0.1 /M/s by the unscreened Coulomb repulsion; 0.1 M salt screens it
        let dg = -0.5 * 96485.0;
        let bare = electron_transfer_rate("Fe+2", "Fe+3", "Ce+4", "Ce+3", 1.0, dg, 298.15, 0.0);
        let salty = electron_transfer_rate("Fe+2", "Fe+3", "Ce+4", "Ce+3", 1.0, dg, 298.15, 0.1);
        assert!(salty.k12 > 1e2 * bare.k12, "bare {:e} vs 0.1 M salt {:e}", bare.k12, salty.k12);
    }

    #[test]
    fn decomposition_needs_heat() {
        // 130 kJ per extent: k rises by many orders of magnitude between 330 K and 480 K
        let (lo, hi) = (decomposition_rate(130_000.0, 330.0), decomposition_rate(130_000.0, 480.0));
        assert!(lo < 1e-5 && hi > 1e-2, "k(330 K) {:e}, k(480 K) {:e}", lo, hi);
    }
}
