//! Gases above a vessel: colour from absorption cross-sections, buoyancy from the mixture molar mass and temperature, and
//! aerosols ("fuming") from thermodynamics.
//!
//! - *Colour*: the transmittance of a plume of species `i` over a path `L` is `exp(-sum_i sigma_i(lambda) N_i L)`
//!   (`sigma` in cm2 per molecule, `N` in molecules per cm3), turned into a colour with the engine's colorimetry. A gas with
//!   no visible cross-section is transparent however much of it there is.
//! - *Buoyancy*: ideal-gas density `rho ~ M / T`; a plume is lighter than the room air when `M_mix / T_plume` is below
//!   `M_air / T_room` (hot steam rises, cold chlorine sinks and pools in the vessel).
//! - *Fuming*: a gas forms droplets of its aqueous solution when its partial pressure exceeds the equilibrium pressure over a
//!   droplet in hygroscopic equilibrium with the room humidity (`a_w = RH`); the equilibrium pressure comes from the
//!   standard chemical potentials of the gas and of its dissolved (or ionised) form. A gas-phase reaction that forms a
//!   solid (NH3 + HCl -> NH4Cl) is found the same way: from `Delta G` of the solid against the plume gases.

use super::cie::{bin_nm, spectrum_to_rgb_clamped, Spectrum, N_BINS};
use crate::db::SpeciesStore;
use crate::physics::R_GAS;

/// Avogadro constant, 1/mol.
pub const N_A: f64 = 6.02214076e23;
/// Mean molar mass of standard dry air, g/mol (the atmosphere's own composition overrides it when it is known).
pub const M_AIR_G_MOL: f64 = 28.96;
/// Eddy diffusivity of quiet laboratory air, m2/s: how fast a *stably stratified* (heavy) gas pooled in a vessel is mixed out
/// of it. An order-of-magnitude placeholder (room draughts), not a measured value.
pub const EDDY_DIFFUSIVITY_M2_S: f64 = 2e-4;
/// A droplet forms spontaneously above this supersaturation of the solution-droplet equilibrium (heterogeneous nucleation on
/// room dust); below it the vapour stays dissolved in the air.
pub const FUMING_SUPERSATURATION: f64 = 10.0;
/// Condensed mass per cubic metre of air at which a haze reads as fully opaque, g/m3 (dense fog is ~0.5 g/m3).
pub const OPAQUE_AEROSOL_G_M3: f64 = 0.5;

/// Cross-section spectrum of a gas, cm2 per molecule per bin; None when the species has no visible band record.
pub fn cross_sections(species: &str) -> Option<Spectrum> {
    let o = super::records::lookup(species)?;
    if o.gas_bands.is_empty() {
        return None;
    }
    let mut s = [0.0; N_BINS];
    for b in &o.gas_bands {
        let fwhm = b.fwhm.max(1.0);
        for (i, v) in s.iter_mut().enumerate() {
            let x = (bin_nm(i) - b.nm) / fwhm;
            let e = -2.772588722239781 * x * x;
            if e > -20.0 {
                *v += b.sigma_cm2 * e.exp();
            }
        }
    }
    Some(s)
}

/// What a plume looks like against a light background.
#[derive(Clone, Copy, Debug)]
pub struct PlumeLook {
    /// Transmitted colour of white light through the plume path, normalised to its largest channel (the hue of the fume).
    pub rgb: [f64; 3],
    /// 1 - luminance transmittance: how visible the plume is.
    pub opacity: f64,
    /// Optical depth at the most absorbed bin (natural log units).
    pub peak_optical_depth: f64,
}

/// Look of a plume of the given species through `path_cm`; `conc_mol_l` are mol/L of gas in the plume.
pub fn plume_look(species: &[(&str, f64)], path_cm: f64) -> Option<PlumeLook> {
    let mut od = [0.0; N_BINS];
    let mut any = false;
    for (id, c) in species {
        if *c <= 0.0 {
            continue;
        }
        if let Some(s) = cross_sections(id) {
            any = true;
            let n = c * N_A / 1000.0; // molecules per cm3
            for i in 0..N_BINS {
                od[i] += s[i] * n * path_cm;
            }
        }
    }
    if !any {
        return None;
    }
    let mut t = [1.0; N_BINS];
    for i in 0..N_BINS {
        t[i] = (-od[i]).exp();
    }
    let rgb = spectrum_to_rgb_clamped(&t);
    let y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    let m = rgb.iter().cloned().fold(1e-6, f64::max);
    Some(PlumeLook { rgb: rgb.map(|c| c / m), opacity: (1.0 - y).clamp(0.0, 1.0), peak_optical_depth: od.iter().cloned().fold(0.0, f64::max) })
}

/// Density of a plume relative to ambient air: `(M_mix / T_plume) / (M_air / T_room)`.
pub fn density_ratio(m_mix_g_mol: f64, t_plume_k: f64, m_air_g_mol: f64, t_room_k: f64) -> f64 {
    (m_mix_g_mol / t_plume_k.max(1.0)) / (m_air_g_mol / t_room_k.max(1.0))
}

/// Time (s) for the gas pooled in an open vessel of free height `head_m` to leave it. A light plume rises on its own
/// buoyancy (`sqrt(g' H)`); a heavy or neutral one is only removed by turbulent mixing of the room air (`H^2 / K`).
pub fn exchange_time_s(ratio: f64, head_m: f64) -> f64 {
    let h = head_m.max(1e-3);
    if ratio < 1.0 {
        let g_reduced = 9.80665 * (1.0 - ratio).max(1e-3);
        (h / (g_reduced * h).sqrt()).max(0.05)
    } else {
        (h * h / EDDY_DIFFUSIVITY_M2_S).max(0.05)
    }
}

// ------------------------------------------------------------------------------------------------ fuming

fn mu0(id: &str, phase: &str, t_k: f64) -> f64 {
    crate::thermo::functions::get_thermo_state(id, phase, t_k, 1e5).mu0_j_mol
}

/// Dissolved form of a gas in a hygroscopic droplet: (species id, count per gas molecule) of its ions or of the neutral
/// aqueous species. None when the store knows no dissolved form.
fn dissolved_form(gas_id: &str) -> Option<Vec<(String, f64)>> {
    let store = SpeciesStore::global();
    let g = store.read().ok()?;
    let rec = g.get(gas_id)?;
    // ionic dissolution: an acid gas gives H+ and its anion
    let formula = rec.identity.formula.clone();
    if let Some(split) = crate::ions::decompose_ionic(&formula) {
        let mut v: Vec<(String, f64)> = Vec::new();
        for c in &split.cations {
            v.push((c.id.clone(), c.n));
        }
        for a in &split.anions {
            v.push((a.id.clone(), a.n));
        }
        if v.iter().all(|(id, _)| g.get(id).map_or(false, |r| r.has_phase("aq"))) && v.len() >= 2 {
            return Some(v);
        }
    }
    // neutral: the aqueous twin by InChIKey
    let ik = rec.identity.inchikey.as_ref()?;
    let twin = g.all_by_inchikey(ik).into_iter().find(|r| r.id != rec.id && r.has_phase("aq") && r.identity.charge == 0)?;
    Some(vec![(twin.id.clone(), 1.0)])
}

/// Ratio of a gas's partial pressure to the pressure it would have over a droplet of its solution in hygroscopic equilibrium
/// with relative humidity `rh` (a_w = rh, ideal osmotic coefficient). Above `FUMING_SUPERSATURATION` the gas condenses into
/// aerosol droplets. Returns the ratio and the equilibrium molality (mol/kg) of the droplet; None without thermodynamic data.
pub fn solution_droplet_supersaturation(gas_id: &str, p_partial_pa: f64, rh: f64, t_k: f64) -> Option<(f64, f64)> {
    let form = dissolved_form(gas_id)?;
    let nu: f64 = form.iter().map(|(_, n)| n).sum();
    let rh = rh.clamp(0.05, 0.999);
    // a_w = exp(-nu m M_w) for an ideal solution of nu particles per solute
    let m_eq = -rh.ln() / (nu * 0.018015);
    let mu_dissolved: f64 = form.iter().map(|(id, n)| n * mu0(id, "aq", t_k)).sum();
    let ln_k = -(mu_dissolved - mu0(gas_id, "g", t_k)) / (R_GAS * t_k);
    // K = prod (nu_i m)^nu_i / p  [bar]  =>  p_eq = prod (nu_i m)^nu_i / K
    let ln_num: f64 = form.iter().map(|(_, n)| n * (n * m_eq).ln()).sum();
    let ln_p_eq_bar = ln_num - ln_k;
    let p_bar = p_partial_pa / 1e5;
    if p_bar <= 0.0 {
        return Some((0.0, m_eq));
    }
    Some(((p_bar.ln() - ln_p_eq_bar).exp(), m_eq))
}

/// A solid that forms from the plume gases by a gas-phase reaction: (solid id, moles per formula unit of each gas).
#[derive(Clone, Debug)]
pub struct GasPhaseSolid {
    pub solid_id: String,
    pub parts: Vec<(String, f64)>,
    pub mw: f64,
    /// Delta G of `sum a_i gas_i -> solid` at the temperature, J per mole of solid.
    pub dg_j_mol: f64,
}

/// Solids of the species store that are exactly `a gas_i + b gas_j` of two plume gases (a, b in 1..=3) and form
/// spontaneously from them at the plume partial pressures: `sum a_i ln(p_i / p0) > Delta G / RT`.
pub fn gas_phase_solids(gases: &[(String, f64)], t_k: f64) -> Vec<GasPhaseSolid> {
    let store = SpeciesStore::global();
    let Ok(guard) = store.read() else { return Vec::new() };
    let mut out = Vec::new();
    for i in 0..gases.len() {
        for j in (i + 1)..gases.len() {
            let (gi, pi) = (&gases[i].0, gases[i].1);
            let (gj, pj) = (&gases[j].0, gases[j].1);
            let (Some(ei), Some(ej)) = (crate::ions::species_elements(gi), crate::ions::species_elements(gj)) else { continue };
            for rec in guard.iter().filter(|r| r.id.ends_with("(s)") && r.has_phase("s") && r.identity.charge == 0) {
                let es = rec.elements();
                if es.is_empty() {
                    continue;
                }
                for a in 1..=3u32 {
                    for b in 1..=3u32 {
                        let mut sum = std::collections::HashMap::new();
                        for (e, n) in &ei {
                            *sum.entry(e.clone()).or_insert(0.0) += n * a as f64;
                        }
                        for (e, n) in &ej {
                            *sum.entry(e.clone()).or_insert(0.0) += n * b as f64;
                        }
                        if sum.len() != es.len() || es.iter().any(|(e, n)| (sum.get(e).copied().unwrap_or(-1.0) - n).abs() > 1e-9) {
                            continue;
                        }
                        let dg = mu0(&rec.id, "s", t_k) - a as f64 * mu0(gi, "g", t_k) - b as f64 * mu0(gj, "g", t_k);
                        let rt = R_GAS * t_k;
                        let lhs = a as f64 * (pi / 1e5).max(1e-300).ln() + b as f64 * (pj / 1e5).max(1e-300).ln();
                        if lhs > dg / rt {
                            out.push(GasPhaseSolid { solid_id: rec.id.clone(), parts: vec![(gi.clone(), a as f64), (gj.clone(), b as f64)], mw: rec.mw(), dg_j_mol: dg });
                        }
                    }
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coloured_gases_are_coloured_and_air_is_not() {
        // 10 % of 1 atm of NO2 at 25 C over 5 cm
        let c = 0.10 / (0.0820574 * 298.15);
        let no2 = plume_look(&[("NO2(g)", c)], 5.0).unwrap();
        assert!(no2.rgb[0] > no2.rgb[2] * 2.0, "NO2 is red-brown: {:?}", no2);
        assert!(no2.opacity > 0.1);
        assert!(plume_look(&[("N2(g)", 0.04)], 5.0).is_none());
    }

    #[test]
    fn buoyancy_follows_molar_mass_and_temperature() {
        // chlorine in room air is heavier, steam at 373 K mixed 1:1 with air at 293 K is lighter than air
        assert!(density_ratio(70.9, 293.0, M_AIR_G_MOL, 293.0) > 2.0);
        let m_mix = 0.5 * 18.0 + 0.5 * M_AIR_G_MOL;
        assert!(density_ratio(m_mix, 0.5 * 373.0 + 0.5 * 293.0, M_AIR_G_MOL, 293.0) < 1.0);
        // a light plume leaves in a second, a heavy one lingers for tens of seconds
        assert!(exchange_time_s(0.6, 0.06) < 1.0);
        assert!(exchange_time_s(2.4, 0.06) > 10.0);
    }

    #[test]
    fn hydrogen_chloride_fumes_and_ammonia_does_not() {
        let hcl = solution_droplet_supersaturation("HCl(g)", 0.05 * 101325.0, 0.5, 298.15).unwrap();
        assert!(hcl.0 > FUMING_SUPERSATURATION, "HCl supersaturation {}", hcl.0);
        let nh3 = solution_droplet_supersaturation("NH3(g)", 0.05 * 101325.0, 0.5, 298.15).unwrap();
        assert!(nh3.0 < FUMING_SUPERSATURATION, "NH3 supersaturation {}", nh3.0);
        let co2 = solution_droplet_supersaturation("CO2(g)", 0.05 * 101325.0, 0.5, 298.15).unwrap();
        assert!(co2.0 < 1.0, "CO2 {}", co2.0);
    }

    #[test]
    fn acid_and_base_gases_make_a_salt_smoke() {
        let gases = vec![("NH3(g)".to_string(), 0.01 * 101325.0), ("HCl(g)".to_string(), 0.01 * 101325.0)];
        let s = gas_phase_solids(&gases, 298.15);
        assert!(s.iter().any(|x| x.solid_id == "NH4Cl(s)"), "{:?}", s);
        let none = gas_phase_solids(&[("NH3(g)".to_string(), 1e5), ("CO2(g)".to_string(), 1e5)], 298.15);
        assert!(none.is_empty());
    }
}
