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
/// Self-exchange rate constant of a couple whose forms differ by electrons only (see `redox::is_electron_transfer_couple`) or
/// of a *labile* element (`redox_lability.json`) whose forms differ in composition
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
    // memoised per store generation: the answer depends on the species records, and discovery asks for the same few couples
    // for every reaction of every step
    thread_local! {
        static MEMO: std::cell::RefCell<(u64, std::collections::HashMap<(String, String), (f64, bool)>)> = Default::default();
    }
    let generation = crate::db::SpeciesStore::generation();
    let key = (a.to_string(), b.to_string());
    let hit = MEMO.with(|m| {
        let mut m = m.borrow_mut();
        if m.0 != generation {
            m.0 = generation;
            m.1.clear();
        }
        m.1.get(&key).copied()
    });
    if let Some(v) = hit {
        return v;
    }
    let v = self_exchange_k_uncached(a, b);
    MEMO.with(|m| {
        let mut m = m.borrow_mut();
        if m.1.len() > 20_000 {
            m.1.clear();
        }
        m.1.insert(key, v);
    });
    v
}

fn self_exchange_k_uncached(a: &str, b: &str) -> (f64, bool) {
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
    // forms that differ by electrons only (X2 / X-, S2O8-2 / SO4-2): a like-atom bond is made or broken, nothing is transferred
    let electrons_only = crate::gem::redox::is_electron_transfer_couple(a, b);
    (if same_atoms { K_SELF_OUTER_SPHERE } else if labile || electrons_only { K_SELF_LABILE_REARRANGING } else { K_SELF_BOND_REARRANGING }, false)
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

#[derive(serde::Deserialize, Clone, Debug)]
pub struct SolidDecompEntry {
    pub solid: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    pub a: f64,
    pub ea_j_mol: f64,
    pub onset_temp_k: f64,
    pub catalyst: Option<String>,
    pub source: String,
    /// `recalled` (written from memory, not checked against its source) or `verified`.
    #[serde(default)]
    pub verification: Option<String>,
}

#[derive(serde::Deserialize)]
struct SolidDecompFile {
    decompositions: Vec<SolidDecompEntry>,
}

pub fn solid_decomp_entries() -> &'static [SolidDecompEntry] {
    static ENTRIES: std::sync::OnceLock<Vec<SolidDecompEntry>> = std::sync::OnceLock::new();
    ENTRIES.get_or_init(|| {
        let f: SolidDecompFile = serde_json::from_str(include_str!("../../data/solid_decomposition.json"))
            .expect("solid_decomposition.json is valid");
        f.decompositions
    })
}

/// Lookup measured solid decomposition Arrhenius rate constant (1/s) at `t_k`.
/// `has_mno2` indicates whether MnO2 catalyst is present.
pub fn solid_decomposition_rate(solid: &str, t_k: f64, has_mno2: bool) -> Option<f64> {
    let entries = solid_decomp_entries();
    let matches = |e: &SolidDecompEntry| {
        e.solid == solid || e.aliases.iter().any(|a| a == solid)
    };

    if has_mno2 {
        if let Some(entry) = entries.iter().find(|e| matches(e) && e.catalyst.is_some()) {
            let k = entry.a * (-entry.ea_j_mol / (R_GAS * t_k.max(1.0))).exp();
            return Some(k);
        }
    }

    let entry = entries.iter().find(|e| matches(e) && e.catalyst.is_none())?;
    let k = entry.a * (-entry.ea_j_mol / (R_GAS * t_k.max(1.0))).exp();
    Some(k)
}

/// Computes decomposition rate for a reactant solid (if known, using measured Arrhenius parameters),
/// falling back to reaction enthalpy placeholder if unmeasured.
pub fn decomposition_rate_for<F>(solid: Option<&str>, delta_h_j: f64, t_k: f64, mut has_catalyst: F) -> f64
where
    F: FnMut(&str) -> bool,
{
    if let Some(s) = solid {
        let entries = solid_decomp_entries();
        let matches = |e: &SolidDecompEntry| {
            e.solid == s || e.aliases.iter().any(|a| a == s)
        };
        if let Some(entry) = entries.iter().find(|e| matches(e) && e.catalyst.as_deref().map_or(false, &mut has_catalyst)) {
            return entry.a * (-entry.ea_j_mol / (R_GAS * t_k.max(1.0))).exp();
        }
        if let Some(entry) = entries.iter().find(|e| matches(e) && e.catalyst.is_none()) {
            return entry.a * (-entry.ea_j_mol / (R_GAS * t_k.max(1.0))).exp();
        }
    }
    decomposition_rate(delta_h_j, t_k)
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

    /// Temperature (K) at which a first-order decomposition `k = A exp(-Ea / RT)` reaches conversion `alpha` in a TGA run at
    /// `beta` K/min.
    fn tga_temperature_k(a: f64, ea_j_mol: f64, beta_k_min: f64, alpha: f64) -> f64 {
        let beta = beta_k_min / 60.0;
        let (mut t, mut integral) = (250.0, 0.0);
        while t < 2000.0 {
            integral += a * (-ea_j_mol / (R_GAS * t)).exp() * 0.05 / beta;
            t += 0.05;
            if 1.0 - (-integral).exp() >= alpha {
                return t;
            }
        }
        f64::INFINITY
    }

    /// The stated onset of a row has to follow from its own Arrhenius parameters (T at 5 % conversion in a 10 K/min TGA run within
    /// 20 K). A row that does not may not claim to be verified, and says so by its tier: the data of this file were written from
    /// memory and most of them fail this check (CaCO3: 709 K against 1020 K).
    #[test]
    fn a_decomposition_row_that_contradicts_its_own_onset_is_not_labelled_verified() {
        let mut inconsistent = 0;
        for e in solid_decomp_entries() {
            let t5 = tga_temperature_k(e.a, e.ea_j_mol, 10.0, 0.05);
            let off = (t5 - e.onset_temp_k).abs();
            println!("{:<16} catalyst {:?}: stated onset {:.0} K, T(5 %) at 10 K/min {:.0} K ({:+.0} K)", e.solid, e.catalyst, e.onset_temp_k, t5, t5 - e.onset_temp_k);
            if off > 20.0 {
                inconsistent += 1;
                assert_ne!(e.verification.as_deref(), Some("verified"), "{}: Arrhenius gives {:.0} K, the row states {:.0} K", e.solid, t5, e.onset_temp_k);
            }
        }
        assert!(solid_decomp_entries().iter().all(|e| e.verification.is_some()), "every row states its verification");
        println!("{inconsistent} of {} rows are inconsistent with their own onset", solid_decomp_entries().len());
    }

    #[test]
    fn kclo3_mno2_catalysis_lowers_decomposition_temperature() {
        let t = 500.0;
        let k_uncat = solid_decomposition_rate("KClO3(s)", t, false).unwrap();
        let k_cat = solid_decomposition_rate("KClO3(s)", t, true).unwrap();
        assert!(
            k_cat > 1e5 * k_uncat,
            "MnO2 should accelerate KClO3 decomposition by >10^5 at 500 K: {:e} vs {:e}",
            k_cat,
            k_uncat
        );
    }
}
