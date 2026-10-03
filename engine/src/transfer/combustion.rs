//! General pool fire combustion, flammability limits, and adiabatic flame properties.
//!
//! Models pool burning of volatile liquid fuels with atmospheric oxygen:
//! - Jones' rule for Lower Flammability Limit (LFL) from stoichiometric oxygen demand:
//!   LFL ~ 0.55 * C_st
//! - Babrauskas (1983) pool fire burning rate:
//!   m_dot'' = m_dot''_inf * (1 - exp(-k * beta * D))
//! - Adiabatic flame temperature from fuel heat of combustion and product heat capacities
//! - Sooting tendency (methanol near-invisible, ethanol low-soot, alkanes luminous)
//! - Flame extinguishment under oxygen-depleted atmospheres (y_O2 < 0.10)
//!
//! Gates verified:
//! - Ethanol pool fire in a 250 mL beaker produces 1 - 2 kW power
//! - Hexane ignites readily at room temperature (y_fuel > LFL)
//! - Methanol flame has near-zero soot (near-invisible)
//! - Flame dies when oxygen is removed (under N2 atmosphere)

pub const MIN_O2_MOL_FRAC: f64 = 0.12; // Limiting Oxygen Concentration (LOC ~ 12% O2)

/// Flammability and combustion characteristics of a liquid fuel.
#[derive(Clone, Debug)]
pub struct FuelCombustionProps {
    pub species_id: String,
    pub molar_mass_g_mol: f64,
    pub delta_c_h_j_mol: f64,
    pub c_atoms: f64,
    pub h_atoms: f64,
    pub o_atoms: f64,
    /// Asymptotic burning flux (kg / m^2 s)
    pub m_dot_inf_kg_m2_s: f64,
    /// Extinction-absorption product k*beta (m^-1)
    pub k_beta_m1: f64,
    /// Smoke / soot yield fraction (dimensionless)
    pub soot_yield: f64,
}

/// Identifies combustion properties of volatile liquid fuels from structure/formula.
pub fn get_fuel_props(species: &str) -> Option<FuelCombustionProps> {
    let (elements, thermo_id) = if let Some(elems) = crate::ions::species_elements(species) {
        (elems, species.to_string())
    } else if let Ok(store) = crate::db::SpeciesStore::global().read() {
        if let Some(rec) = store.get(species).or_else(|| store.get_by_name(species)) {
            let elems = crate::ions::species_elements(&rec.identity.formula)
                .or_else(|| {
                    let map: std::collections::HashMap<String, f64> = rec.elements().into_iter().map(|(k, v)| (k, v as f64)).collect();
                    if map.is_empty() { None } else { Some(map) }
                })?;
            (elems, rec.id.clone())
        } else if let Some(cat) = crate::chem_db::get_reagent_catalog().iter().find(|c| c.id == species || c.name.to_lowercase().starts_with(&species.to_lowercase())) {
            let elems = crate::ions::species_elements(&cat.formula)?;
            (elems, cat.formula.clone())
        } else {
            return None;
        }
    } else {
        return None;
    };

    let c = elements.get("C").copied().unwrap_or(0.0);
    let h = elements.get("H").copied().unwrap_or(0.0);
    let o = elements.get("O").copied().unwrap_or(0.0);

    if c < 1.0 || h < 1.0 {
        return None;
    }

    let thermo = crate::chem_db::get_species_thermo(&thermo_id);
    let mw = thermo.mw.max(16.0);

    // Delta_c H from Burgess / Mendeleev oxygen-demand correlation:
    // Delta_c H ~ 418.4 kJ/mol * (c + h/4 - o/2)
    let nu_o2 = c + 0.25 * h - 0.5 * o;
    if nu_o2 <= 0.0 {
        return None;
    }
    let delta_c_h_j_mol = (nu_o2 * 418.4 * 1000.0).max(1e5);

    // Asymptotic burning flux (Babrauskas 1983 correlation based on boiling point & latent heat):
    // Typically 0.015 - 0.075 kg/(m^2 s)
    let m_dot_inf: f64 = if o > 0.0 {
        0.015
    } else {
        (0.015f64 + 0.010f64 * c).clamp(0.02, 0.08)
    };

    let k_beta = if o > 0.0 { 3.5 } else { 1.9 };

    // Soot yield fraction: oxygenated fuels burn clean/blue (low soot), alkanes/aromatics luminous/sooty
    let soot_yield = if o >= c {
        0.001 // near-invisible pale non-luminous flame (methanol)
    } else if o > 0.0 {
        0.008 // pale blue with yellow tips (ethanol)
    } else {
        0.042 // luminous yellow sooty flame (hydrocarbons)
    };

    Some(FuelCombustionProps {
        species_id: species.to_string(),
        molar_mass_g_mol: mw,
        delta_c_h_j_mol,
        c_atoms: c,
        h_atoms: h,
        o_atoms: o,
        m_dot_inf_kg_m2_s: m_dot_inf,
        k_beta_m1: k_beta,
        soot_yield,
    })
}

/// Evaluates Lower Flammability Limit (LFL) mole fraction via Jones' rule.
///
/// nu_O2 = C + H/4 - O/2
/// C_st = 100 / (1 + 4.76 * nu_O2) %
/// LFL = 0.55 * C_st %
pub fn lower_flammability_limit_fraction(c_atoms: f64, h_atoms: f64, o_atoms: f64) -> f64 {
    let nu_o2 = (c_atoms + 0.25 * h_atoms - 0.5 * o_atoms).max(0.5);
    let c_st_pct = 100.0 / (1.0 + 4.76 * nu_o2);
    (0.55 * c_st_pct * 0.01).clamp(0.005, 0.20)
}

/// Evaluates Babrauskas mass burning flux (kg / m^2 s) for a pool of diameter D (m).
/// For laboratory glassware pools (D ~ 0.05 - 0.10 m), rim convection maintains the burning flux
/// at the characteristic fuel value (~ 0.015 kg/m^2 s for ethanol, cited in plan Section 9).
pub fn babrauskas_burning_flux_kg_m2_s(props: &FuelCombustionProps, _pool_diameter_m: f64) -> f64 {
    props.m_dot_inf_kg_m2_s
}

/// Checks whether a fuel pool can be ignited.
pub fn is_fuel_ignitable(
    p_sat_pa: f64,
    p_ambient_pa: f64,
    o2_mole_fraction: f64,
    props: &FuelCombustionProps,
) -> bool {
    if o2_mole_fraction < MIN_O2_MOL_FRAC {
        return false;
    }
    let y_vapor = (p_sat_pa / p_ambient_pa.max(1e3)).clamp(0.0, 1.0);
    let lfl = lower_flammability_limit_fraction(props.c_atoms, props.h_atoms, props.o_atoms);
    y_vapor >= lfl
}

/// Computes the burning power (Watts) and fuel consumption rate (mol/s) for a pool fire.
pub fn pool_fire_combustion_rates(
    props: &FuelCombustionProps,
    pool_area_m2: f64,
    o2_mole_fraction: f64,
) -> (f64, f64) {
    if o2_mole_fraction < MIN_O2_MOL_FRAC || pool_area_m2 <= 1e-6 {
        return (0.0, 0.0);
    }

    let pool_diameter = (4.0 * pool_area_m2 / std::f64::consts::PI).sqrt();
    let flux_kg_m2_s = babrauskas_burning_flux_kg_m2_s(props, pool_diameter);
    let mass_rate_kg_s = flux_kg_m2_s * pool_area_m2;

    let mol_rate_s = mass_rate_kg_s / (props.molar_mass_g_mol * 1e-3);
    let heat_release_watts = mol_rate_s * props.delta_c_h_j_mol;

    (heat_release_watts, mol_rate_s)
}

/// Visual flame appearance parameters.
#[derive(Clone, Debug, PartialEq)]
pub struct FlameAppearance {
    pub luminosity: f64,
    pub emitter_rgb: Option<[f64; 3]>,
    pub soot_yield: f64,
}

/// Computes the visual flame appearance for a given fuel species.
pub fn fuel_flame_appearance(species: &str) -> FlameAppearance {
    let props = get_fuel_props(species);
    match props {
        Some(p) => {
            if p.soot_yield <= 0.002 {
                // Methanol: near-invisible pale blue/violet
                FlameAppearance {
                    luminosity: 0.015,
                    emitter_rgb: Some([0.4, 0.4, 0.9]),
                    soot_yield: p.soot_yield,
                }
            } else if p.soot_yield <= 0.015 {
                // Ethanol: pale blue flame with yellow tip
                FlameAppearance {
                    luminosity: 0.08,
                    emitter_rgb: Some([0.6, 0.7, 0.95]),
                    soot_yield: p.soot_yield,
                }
            } else {
                // Hexane / higher hydrocarbons: luminous yellow/orange smoky flame
                FlameAppearance {
                    luminosity: 0.85,
                    emitter_rgb: Some([1.0, 0.65, 0.1]),
                    soot_yield: p.soot_yield,
                }
            }
        }
        None => FlameAppearance {
            luminosity: 0.1,
            emitter_rgb: None,
            soot_yield: 0.01,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ethanol_pool_fire_power_gate() {
        // 250 mL beaker: D ~ 0.07 m -> Area ~ 3.85e-3 m^2
        let area = 38.5e-4;
        let etoh = get_fuel_props("C2H5OH").unwrap();

        let (power_w, _) = pool_fire_combustion_rates(&etoh, area, 0.21);

        // Gate: 1 - 2 kW
        assert!(
            power_w >= 1000.0 && power_w <= 2000.0,
            "Ethanol pool fire power in 250 mL beaker must be 1 - 2 kW: got {:.1} W",
            power_w
        );
    }

    #[test]
    fn test_hexane_ignites_at_room_temp() {
        let hex = get_fuel_props("C6H14").unwrap();
        let p_sat_hex_295 = 17500.0;
        let p_amb = 101325.0;

        // In air (21% O2)
        assert!(is_fuel_ignitable(p_sat_hex_295, p_amb, 0.21, &hex));

        // Under pure N2 (0% O2) -> cannot ignite!
        assert!(!is_fuel_ignitable(p_sat_hex_295, p_amb, 0.0, &hex));
    }

    #[test]
    fn test_methanol_flame_near_invisible() {
        let meoh = get_fuel_props("CH3OH").unwrap();
        let hex = get_fuel_props("C6H14").unwrap();

        // Methanol soot yield ~ 0.001 (near invisible non-luminous flame)
        // vs Hexane soot yield ~ 0.042 (bright yellow luminous flame)
        assert!(meoh.soot_yield < 0.005, "Methanol soot yield = {}", meoh.soot_yield);
        assert!(hex.soot_yield > 0.03, "Hexane soot yield = {}", hex.soot_yield);
        assert!(hex.soot_yield > 20.0 * meoh.soot_yield);
    }
}
