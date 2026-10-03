//! Combustion of any fuel the species data describes: ignition (flash point, lower flammability limit, limiting oxygen
//! concentration), the burning rate of a pool, the flame temperature and how luminous the flame is
//! (master plan Stage 8 item 8). Nothing here is keyed by compound: every quantity is derived from the fuel's formula,
//! its standard enthalpies of formation (Hess's law with CO2 and H2O), its vapour-pressure curve and its structure.
//!
//! * Stoichiometry: C_c H_h O_o N_n + nu_O2 O2 -> c CO2 + h/2 H2O + n/2 N2, nu_O2 = c + h/4 - o/2.
//! * LFL by Jones' rule, LFL = 0.55 C_st (C_st the stoichiometric vapour fraction in air); the limiting oxygen
//!   concentration by Zlochower's relation LOC = nu_O2 x LFL.
//! * Flash point: the temperature at which the fuel's saturation pressure reaches LFL x P (the pool is ignitable
//!   there, with a pilot).
//! * Pool burning rate: Spalding mass-transfer number B = (q_c Y_O2 / s - cp_g (T_s - T_inf)) / (L + cp_l (T_s - T_l)),
//!   m'' = (h_c / cp_g) ln(1 + B) with h_c from the natural-convection Nusselt number of the pool (laminar,
//!   Nu = 0.54 Ra^(1/4)), as in Drysdale, Introduction to Fire Dynamics ch. 6.
//! * Adiabatic flame temperature: heat of combustion = sum of product enthalpy rise, with a heat capacity that
//!   saturates toward its classical limit.
//! * Luminosity from a structure-based sooting index (C-C bonds, unsaturation, aromatic rings, oxygen content): a fuel
//!   with no C-C bond (methanol) burns with the faint blue of CH* emission, long-chain and aromatic fuels with the
//!   yellow of incandescent soot.

use crate::physics::R_GAS;
use std::collections::HashMap;

/// Mole fraction of oxygen below which hydrocarbons and oxygenates can not sustain a flame regardless of the fuel:
/// used only when the fuel's own LOC (Zlochower) is not computable.
pub const FALLBACK_LOC: f64 = 0.12;

/// Structure of a fuel for its sooting tendency.
#[derive(Clone, Copy, Debug, Default)]
pub struct SootStructure {
    pub n_carbon: f64,
    pub n_oxygen: f64,
    /// Carbon-carbon single bonds.
    pub cc_single: f64,
    /// Carbon-carbon double and triple bonds (counted once each).
    pub cc_multiple: f64,
    pub aromatic_rings: f64,
}

/// Counts the soot-relevant structure from a SMILES string; None when it can not be parsed.
pub fn soot_structure_from_smiles(smiles: &str) -> Option<SootStructure> {
    let mol = crate::smiles::parse(smiles)?.aromatized();
    let mut s = SootStructure::default();
    for a in &mol.atoms {
        if a.element == "C" {
            s.n_carbon += 1.0;
        } else if a.element == "O" {
            s.n_oxygen += 1.0;
        }
    }
    let mut arom_bonds = 0.0;
    for &(a, b, o) in &mol.bonds {
        if mol.atoms[a].element == "C" && mol.atoms[b].element == "C" {
            if (o - 1.5).abs() < 1e-9 {
                arom_bonds += 1.0;
            } else if o >= 2.0 {
                s.cc_multiple += 1.0;
            } else {
                s.cc_single += 1.0;
            }
        }
    }
    s.aromatic_rings = arom_bonds / 6.0;
    Some(s)
}

/// Structure estimate from the formula alone (no SMILES): every C-C pair is assumed bonded in a chain and the
/// unsaturation count adds multiple bonds.
pub fn soot_structure_from_formula(el: &HashMap<String, f64>) -> SootStructure {
    let c = el.get("C").copied().unwrap_or(0.0);
    let h = el.get("H").copied().unwrap_or(0.0);
    let o = el.get("O").copied().unwrap_or(0.0);
    let n = el.get("N").copied().unwrap_or(0.0);
    let dbe = ((2.0 * c + 2.0 + n - h) / 2.0).max(0.0);
    SootStructure { n_carbon: c, n_oxygen: o, cc_single: (c - 1.0).max(0.0), cc_multiple: dbe.min(c), aromatic_rings: 0.0 }
}

/// Structure-based sooting index (dimensionless, ~0 for methanol, a few for alkanes, > 10 for aromatics): each C-C
/// bond contributes, multiple bonds and aromatic rings contribute more, and oxygen in the molecule removes soot
/// precursors (about 1.6 of the carbon-carbon contribution per O/C).
pub fn sooting_index(s: &SootStructure) -> f64 {
    if s.n_carbon <= 0.0 {
        return 0.0;
    }
    let o_over_c = s.n_oxygen / s.n_carbon;
    let skeleton = s.cc_single + 2.0 * s.cc_multiple + 8.0 * s.aromatic_rings;
    (skeleton * (1.0 - 1.6 * o_over_c)).max(0.0)
}

/// Luminosity (0..1) of a flame from its sooting index.
pub fn luminosity_from_sooting(index: f64) -> f64 {
    1.0 - (-index / 4.0).exp()
}

/// Everything the combustion model needs to know about one fuel.
#[derive(Clone, Debug)]
pub struct FuelData {
    pub molar_mass_g_mol: f64,
    pub elements: HashMap<String, f64>,
    /// Net heat released burning one mole of liquid fuel to CO2(g), H2O(g), N2 at the liquid temperature, J/mol (> 0).
    pub dh_c_j_mol: f64,
    /// Latent heat at the normal boiling point, J/mol, and that boiling point, K.
    pub dh_vap_j_mol: f64,
    pub t_boil_k: f64,
    pub cp_liquid_j_mol_k: f64,
    pub soot: SootStructure,
}

impl FuelData {
    fn count(&self, el: &str) -> f64 {
        self.elements.get(el).copied().unwrap_or(0.0)
    }

    /// Moles of O2 per mole of fuel for complete combustion.
    pub fn o2_stoich(&self) -> f64 {
        (self.count("C") + 0.25 * self.count("H") - 0.5 * self.count("O")).max(0.0)
    }

    /// Mass of oxygen per mass of fuel for complete combustion.
    pub fn o2_mass_ratio(&self) -> f64 {
        self.o2_stoich() * 31.998 / self.molar_mass_g_mol
    }

    /// Heat of combustion per kg of fuel, J/kg.
    pub fn dh_c_j_kg(&self) -> f64 {
        self.dh_c_j_mol / (self.molar_mass_g_mol * 1e-3)
    }
}

/// Heat of combustion (J/mol, > 0) from the standard enthalpies of formation, Hess's law:
/// -dHc = c dfH(CO2) + h/2 dfH(H2O) - dfH(fuel). Products CO2(g), H2O(g) (net heating value); nitrogen leaves as N2,
/// other elements are not handled (the fuel is then not a simple CHON fuel and None is returned).
pub fn heat_of_combustion_j_mol(
    elements: &HashMap<String, f64>,
    dfh_fuel_j_mol: f64,
    dfh_co2_j_mol: f64,
    dfh_h2o_gas_j_mol: f64,
) -> Option<f64> {
    if elements.keys().any(|e| !matches!(e.as_str(), "C" | "H" | "O" | "N")) {
        return None;
    }
    let c = elements.get("C").copied().unwrap_or(0.0);
    let h = elements.get("H").copied().unwrap_or(0.0);
    if c <= 0.0 || h <= 0.0 {
        return None;
    }
    Some(dfh_fuel_j_mol - (c * dfh_co2_j_mol + 0.5 * h * dfh_h2o_gas_j_mol))
}

/// Lower flammability limit (mole fraction in air), Jones' rule: 0.55 x the stoichiometric fuel fraction.
pub fn lower_flammability_limit(f: &FuelData) -> f64 {
    let nu = f.o2_stoich().max(0.25);
    let c_st = 1.0 / (1.0 + nu / 0.2095);
    (0.55 * c_st).clamp(0.005, 0.30)
}

/// Limiting oxygen concentration (mole fraction of O2 in the oxidiser), Zlochower & Green: LOC = nu_O2 x LFL.
pub fn limiting_oxygen_concentration(f: &FuelData) -> f64 {
    (f.o2_stoich() * lower_flammability_limit(f)).clamp(0.05, 0.21)
}

/// Flash point (K): where the saturation pressure of the fuel reaches LFL x P_total. Bisection on `psat`.
pub fn flash_point_k(psat_pa: &dyn Fn(f64) -> f64, f: &FuelData, p_total_pa: f64) -> f64 {
    let target = lower_flammability_limit(f) * p_total_pa;
    let (mut lo, mut hi) = (120.0, f.t_boil_k.max(200.0));
    if psat_pa(hi) < target {
        return hi;
    }
    for _ in 0..60 {
        let mid = 0.5 * (lo + hi);
        if psat_pa(mid) < target {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    0.5 * (lo + hi)
}

/// True when a pool of the fuel at `t_liquid_k` can be ignited by a pilot in an atmosphere with oxygen mole fraction
/// `y_o2`: the vapour above it is above the LFL and the oxygen above the fuel's LOC.
pub fn is_ignitable(psat_pa: &dyn Fn(f64) -> f64, f: &FuelData, t_liquid_k: f64, p_total_pa: f64, y_o2: f64) -> bool {
    if y_o2 < limiting_oxygen_concentration(f) {
        return false;
    }
    psat_pa(t_liquid_k) >= lower_flammability_limit(f) * p_total_pa
}

/// Heat capacity of a product gas (J/mol/K) at `t_k` from its 298 K value, saturating toward the classical limit
/// (3n - 2) R for a nonlinear and (3n - 3/2) R for a linear molecule of n atoms, with a 1000 K relaxation scale.
fn product_cp(cp298: f64, n_atoms: f64, linear: bool, t_k: f64) -> f64 {
    let classical = (if linear { 3.0 * n_atoms - 1.5 } else { 3.0 * n_atoms - 2.0 }) * R_GAS;
    let cp_inf = classical.max(cp298);
    cp298 + (cp_inf - cp298) * (1.0 - (-(t_k - 298.15).max(0.0) / 1000.0).exp())
}

/// Product cp values (J/mol/K at 298 K) the flame temperature needs; the store supplies them for CO2(g), H2O(g), N2(g).
#[derive(Clone, Copy, Debug)]
pub struct ProductCp {
    pub co2: f64,
    pub h2o: f64,
    pub n2: f64,
}

/// Adiabatic flame temperature (K) of the fuel burning in an oxidiser with oxygen mole fraction `y_o2` (rest N2) at
/// `t0_k`, stoichiometric mixture.
pub fn adiabatic_flame_temperature_k(f: &FuelData, y_o2: f64, t0_k: f64, cp: ProductCp) -> f64 {
    let c = f.count("C");
    let h = f.count("H");
    let n = f.count("N");
    let nu = f.o2_stoich();
    let n_n2 = nu * (1.0 - y_o2.clamp(0.05, 1.0)) / y_o2.clamp(0.05, 1.0) + 0.5 * n;
    // enthalpy rise of the products from t0 to T: integral of cp(T') dT' with the saturating cp (closed form by trapezoids)
    let rise = |t: f64| -> f64 {
        let steps = 40;
        let dt = (t - t0_k) / steps as f64;
        let mut s = 0.0;
        for i in 0..steps {
            let t_mid = t0_k + (i as f64 + 0.5) * dt;
            s += (c * product_cp(cp.co2, 3.0, true, t_mid)
                + 0.5 * h * product_cp(cp.h2o, 3.0, false, t_mid)
                + n_n2 * product_cp(cp.n2, 2.0, true, t_mid))
                * dt;
        }
        s
    };
    let (mut lo, mut hi) = (t0_k, 4500.0);
    for _ in 0..60 {
        let mid = 0.5 * (lo + hi);
        if rise(mid) < f.dh_c_j_mol {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    0.5 * (lo + hi)
}

/// Mass burning flux (kg/m2/s) of a pool of the fuel of diameter `pool_d_m` at liquid temperature `t_liquid_k` (Spalding
/// number with natural-convection heat transfer).
pub fn pool_burning_flux_kg_m2_s(f: &FuelData, pool_d_m: f64, t_liquid_k: f64, t_inf_k: f64, y_o2: f64, t_flame_k: f64) -> f64 {
    let mw = f.molar_mass_g_mol * 1e-3;
    let y = y_o2.clamp(0.0, 1.0) * 31.998 / (y_o2.clamp(0.0, 1.0) * 31.998 + (1.0 - y_o2.clamp(0.0, 1.0)) * 28.014);
    let s = f.o2_mass_ratio().max(1e-6);
    let t_s = f.t_boil_k;
    let cp_g = 1200.0; // J/kg/K, mean of the hot gas around the pool
    let l_eff = f.dh_vap_j_mol / mw + f.cp_liquid_j_mol_k / mw * (t_s - t_liquid_k).max(0.0);
    let q_c = f.dh_c_j_kg();
    let b = ((q_c * y / s - cp_g * (t_s - t_inf_k).max(0.0)) / l_eff).max(0.0);
    if b <= 0.0 {
        return 0.0;
    }
    // natural convection of the hot gas over the pool at the film temperature
    let t_film = 0.5 * (t_flame_k + t_inf_k).max(t_inf_k + 1.0);
    let k_g = 0.026 * (t_film / 300.0).powf(0.8);
    let nu = crate::transfer::evaporation::air_kinematic_viscosity_m2_s(t_film, 101325.0);
    let alpha = nu / 0.7; // Pr ~ 0.7
    let d = pool_d_m.max(1e-3);
    let ra = super::hydro::G_ACCEL * (1.0 / t_film) * (t_flame_k - t_inf_k).max(1.0) * d.powi(3) / (nu * alpha);
    let nu_t = if ra < 1e7 { 0.54 * ra.max(1.0).powf(0.25) } else { 0.15 * ra.powf(1.0 / 3.0) };
    let h_over_cp = nu_t * k_g / (d * cp_g);
    h_over_cp * (1.0 + b).ln()
}

/// Colour of incandescent soot at temperature `t_k` (linear-ish sRGB triple, normalised to the largest channel):
/// the Planckian locus approximation of Tanner Helland.
pub fn blackbody_rgb(t_k: f64) -> [f64; 3] {
    let t = (t_k / 100.0).clamp(10.0, 400.0);
    let r = if t <= 66.0 { 255.0 } else { (329.698727446 * (t - 60.0).powf(-0.1332047592)).clamp(0.0, 255.0) };
    let g = if t <= 66.0 { (99.4708025861 * t.ln() - 161.1195681661).clamp(0.0, 255.0) } else { (288.1221695283 * (t - 60.0).powf(-0.0755148492)).clamp(0.0, 255.0) };
    let b = if t >= 66.0 { 255.0 } else if t <= 19.0 { 0.0 } else { (138.5177312231 * (t - 10.0).ln() - 305.0447927307).clamp(0.0, 255.0) };
    [r / 255.0, g / 255.0, b / 255.0]
}

/// Visual flame appearance from the fuel's sooting index and the flame temperature.
#[derive(Clone, Debug, PartialEq)]
pub struct FlameAppearance {
    pub luminosity: f64,
    pub emitter_rgb: [f64; 3],
    pub sooting_index: f64,
}

pub fn flame_appearance(f: &FuelData, t_flame_k: f64) -> FlameAppearance {
    let index = sooting_index(&f.soot);
    let lum = luminosity_from_sooting(index);
    // chemiluminescence of CH* and C2* gives a blue-violet base; incandescent soot adds its blackbody colour
    let blue = [0.35, 0.5, 1.0];
    let soot = blackbody_rgb(t_flame_k.min(1800.0));
    let rgb = [blue[0] * (1.0 - lum) + soot[0] * lum, blue[1] * (1.0 - lum) + soot[1] * lum, blue[2] * (1.0 - lum) + soot[2] * lum];
    FlameAppearance { luminosity: 0.015 + 0.85 * lum, emitter_rgb: rgb, sooting_index: index }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn el(pairs: &[(&str, f64)]) -> HashMap<String, f64> {
        pairs.iter().map(|(k, v)| (k.to_string(), *v)).collect()
    }

    fn fuel(formula: &[(&str, f64)], mw: f64, dhc_kj: f64, lv_kj: f64, tb: f64, cpl: f64, smiles: &str) -> FuelData {
        FuelData {
            molar_mass_g_mol: mw,
            elements: el(formula),
            dh_c_j_mol: dhc_kj * 1e3,
            dh_vap_j_mol: lv_kj * 1e3,
            t_boil_k: tb,
            cp_liquid_j_mol_k: cpl,
            soot: soot_structure_from_smiles(smiles).unwrap(),
        }
    }

    // The values below are *test inputs* of the generic model (intrinsic data of three arbitrary fuels), not model data.
    #[test]
    fn jones_and_zlochower_rules() {
        let hexane = fuel(&[("C", 6.0), ("H", 14.0)], 86.18, 3855.0, 28.9, 341.9, 195.0, "CCCCCC");
        let lfl = lower_flammability_limit(&hexane);
        assert!(lfl > 0.008 && lfl < 0.016, "hexane LFL = {}", lfl); // measured 1.1-1.2 %
        let loc = limiting_oxygen_concentration(&hexane);
        assert!(loc > 0.09 && loc < 0.14, "LOC = {}", loc); // measured ~ 11.9 %
    }

    #[test]
    fn methanol_barely_soots_hexane_does() {
        let meoh = fuel(&[("C", 1.0), ("H", 4.0), ("O", 1.0)], 32.04, 638.0, 35.2, 337.7, 81.0, "CO");
        let hexane = fuel(&[("C", 6.0), ("H", 14.0)], 86.18, 3855.0, 28.9, 341.9, 195.0, "CCCCCC");
        let etoh = fuel(&[("C", 2.0), ("H", 6.0), ("O", 1.0)], 46.07, 1235.0, 38.6, 351.4, 112.0, "CCO");
        let (lm, le, lh) = (
            flame_appearance(&meoh, 2000.0).luminosity,
            flame_appearance(&etoh, 2000.0).luminosity,
            flame_appearance(&hexane, 2000.0).luminosity,
        );
        assert!(lm < 0.1 && lm < le && le < lh, "{} {} {}", lm, le, lh);
    }

    #[test]
    fn small_ethanol_pool_burns_at_about_a_kilowatt() {
        let etoh = fuel(&[("C", 2.0), ("H", 6.0), ("O", 1.0)], 46.07, 1235.0, 38.6, 351.4, 112.0, "CCO");
        let t_f = 2000.0;
        let flux = pool_burning_flux_kg_m2_s(&etoh, 0.07, 295.0, 295.0, 0.2095, t_f);
        let area = std::f64::consts::PI * 0.035f64.powi(2);
        let power = flux * area * etoh.dh_c_j_kg();
        assert!(power > 800.0 && power < 2500.0, "pool fire power {} W (flux {} kg/m2/s)", power, flux);
    }

    #[test]
    fn no_flame_below_the_limiting_oxygen_concentration() {
        let hexane = fuel(&[("C", 6.0), ("H", 14.0)], 86.18, 3855.0, 28.9, 341.9, 195.0, "CCCCCC");
        let psat = |_t: f64| 20000.0;
        assert!(is_ignitable(&psat, &hexane, 295.0, 101325.0, 0.2095));
        assert!(!is_ignitable(&psat, &hexane, 295.0, 101325.0, 0.0));
    }
}
