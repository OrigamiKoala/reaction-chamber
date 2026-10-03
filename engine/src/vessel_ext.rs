//! Vessel extensions: automatic solubility control for ion pairs that meet in the vessel, solid appearance lookup,
//! and the generic reaction log (events derived purely from state differences, with no per-reaction text).

use std::collections::{HashMap, HashSet};

use crate::chem_db;
use crate::compound_thermo::is_metal_element;
use crate::ions;
use crate::optics;
use crate::solubility;
use crate::spectra;
use crate::vessel::*;

/// A new solid is announced above this concentration-equivalent (mol per litre of aqueous solvent: 2.5 umol in 50 mL,
/// 1 nmol in a 22 uL droplet) and counts as gone below `SOLID_GONE_M`; both are also at least a few multiples of the
/// vessel's dust amount (`Vessel::dust_mol`). Scale-relative, so a droplet and a litre behave alike.
const SOLID_ANNOUNCE_M: f64 = 5e-5;
const SOLID_GONE_M: f64 = 6e-6;
const SOLID_ANNOUNCE_DUST: f64 = 20.0;
const SOLID_GONE_DUST: f64 = 3.0;
const MAX_EVENTS: usize = 80;

#[derive(Default, Clone, Debug)]
pub struct EventState {
    pub seq: u64,
    /// Solids already accounted for (user-added or announced).
    pub solids: HashSet<String>,
    /// Gas species currently evolving -> last sim time a flux was seen.
    pub gas_seen: HashMap<String, f64>,
    pub complexes: HashSet<String>,
    /// Display (sRGB) colour of the solution at the last colour report.
    pub colour_ref: Option<[f64; 3]>,
    pub colour_t: f64,
    pub colour_reported: bool,
    pub colour_eval_t: f64,
    pub temp_ref: Option<f64>,
    pub temp_ref_t: f64,
    pub checked_pairs: HashSet<(String, String)>,
    /// Fraction of each solid currently suspended (1 = freshly precipitated cloud, decays as it settles).
    pub susp: HashMap<String, f64>,
    /// Announced phase changes of inert compounds (bit flags, see `vessel_phase`).
    pub phase: HashMap<String, u8>,
}

#[derive(Clone, Debug)]
pub struct SolidProps {
    pub name: String,
    pub formula: String,
    pub rgb: [f64; 3],
    pub kind: SolidKind,
    pub density_g_ml: f64,
    pub particle_um: f64,
    pub refractive_index: f64,
}

fn kind_from_str(k: &str) -> SolidKind {
    match k {
        "crystal" => SolidKind::Crystal,
        "metal" => SolidKind::Metal,
        "gel" => SolidKind::Gel,
        "curds" => SolidKind::Curds,
        _ => SolidKind::Powder,
    }
}

/// Linear -> sRGB transfer for one channel.
fn to_srgb(c: f64) -> f64 {
    let c = c.clamp(0.0, 1.0);
    if c <= 0.0031308 {
        12.92 * c
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    }
}

/// Plain-English colour of an sRGB triple (generic hue/lightness naming, not per-compound text).
pub fn colour_name(srgb: [f64; 3]) -> String {
    let [r, g, b] = srgb;
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let chroma = max - min;
    let light = (max + min) * 0.5;
    if chroma < 0.08 {
        return if max < 0.18 {
            "black".to_string()
        } else if max < 0.55 {
            "grey".to_string()
        } else {
            "white".to_string()
        };
    }
    let mut h = if (max - r).abs() < 1e-12 {
        ((g - b) / chroma).rem_euclid(6.0)
    } else if (max - g).abs() < 1e-12 {
        (b - r) / chroma + 2.0
    } else {
        (r - g) / chroma + 4.0
    } * 60.0;
    if h < 0.0 {
        h += 360.0;
    }
    let base = if h < 15.0 || h >= 345.0 {
        "red"
    } else if h < 40.0 {
        if light < 0.45 { "brown" } else { "orange" }
    } else if h < 70.0 {
        if light < 0.4 { "brown" } else { "yellow" }
    } else if h < 160.0 {
        "green"
    } else if h < 200.0 {
        "teal"
    } else if h < 255.0 {
        "blue"
    } else if h < 290.0 {
        "purple"
    } else {
        "pink"
    };
    let sat_light = if light > 0.78 && chroma < 0.35 {
        "pale "
    } else if light < 0.25 {
        "dark "
    } else {
        ""
    };
    format!("{}{}", sat_light, base)
}

fn capitalise(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
        None => String::new(),
    }
}

impl Vessel {
    // ------------------------------------------------------------------------------------------ appearance
    /// Appearance of a solid species: hand-tuned spectra entries first, then the mineral registry (table or rules),
    /// then a neutral default.
    pub fn solid_props(&self, sp: &str) -> SolidProps {
        let formula = sp.trim_end_matches("(s)").to_string();
        let mineral = self.minerals.iter().find(|m| m.solid_species == sp);
        let name = mineral.map(|m| m.mineral.clone()).unwrap_or_else(|| formula.clone());
        if let Some(o) = spectra::solid_optics(sp) {
            return SolidProps {
                name,
                formula,
                rgb: o.rgb_linear,
                kind: kind_from_str(o.kind),
                density_g_ml: o.density_g_ml,
                particle_um: o.default_particle_um,
                refractive_index: o.refractive_index,
            };
        }
        if let Some(c) = self.compound_for(sp).filter(|c| c.phase_model != "ionic") {
            // metals are a bright grey sheet-like solid, other solids a fine pale powder unless the record has a colour
            let single_metal = ions::parse_formula_strict(&c.formula).map_or(false, |e| e.len() == 1 && e.keys().all(|k| is_metal_element(k)));
            return SolidProps {
                name: if c.name.is_empty() { name } else { c.name.clone() },
                formula,
                rgb: c.color_linear_rgb.unwrap_or(if single_metal { [0.55, 0.56, 0.58] } else { [0.85, 0.85, 0.85] }),
                kind: if single_metal { SolidKind::Metal } else { SolidKind::Powder },
                density_g_ml: c.rho_solid.max(0.3),
                particle_um: 30.0,
                refractive_index: 1.55,
            };
        }
        // a molecular solid the species store describes (ice, iodine): its record's name and density
        if mineral.is_none() {
            if let Some(lk) = self.liquid_key_of_solid(sp) {
                if let Some(mol) = self.molecule(&lk) {
                    let rec_name = crate::db::SpeciesStore::global().read().ok().and_then(|st| st.get(sp).and_then(|r| r.identity.names.first().cloned()));
                    return SolidProps {
                        name: rec_name.unwrap_or_else(|| mol.name.clone()),
                        formula,
                        rgb: [0.88, 0.9, 0.93],
                        kind: SolidKind::Crystal,
                        density_g_ml: mol.v_solid_m3_mol.map(|v| mol.mw / (v * 1e6)).unwrap_or(1.5).max(0.3),
                        particle_um: 150.0,
                        refractive_index: 1.5,
                    };
                }
            }
        }
        if let Some(m) = mineral {
            return SolidProps {
                name,
                formula,
                rgb: m.solid_color,
                kind: kind_from_str(&m.kind),
                density_g_ml: m.density_g_ml.max(0.3),
                particle_um: m.default_particle_um.max(0.5),
                refractive_index: if m.kind == "gel" { 1.55 } else { 1.65 },
            };
        }
        SolidProps {
            name,
            formula,
            rgb: [0.9, 0.9, 0.9],
            kind: SolidKind::Powder,
            density_g_ml: 2.5,
            particle_um: 20.0,
            refractive_index: 1.6,
        }
    }

    // ------------------------------------------------------------------------------------------ solubility control
    /// For every simple cation/anion pair dissolved in the vessel, makes sure the solubility table (or, failing
    /// that, the solubility rules) controls it. This is what lets arbitrary salts precipitate each other.
    pub fn auto_minerals(&mut self) {
        let mut cats: Vec<String> = Vec::new();
        let mut ans: Vec<String> = Vec::new();
        for (sp, &mol) in &self.species_mol {
            if mol <= 1e-12 {
                continue;
            }
            if is_simple_cation(sp) {
                cats.push(sp.clone());
            } else if ions::anion_def(sp).is_some() {
                ans.push(sp.clone());
            }
        }
        for c in &cats {
            for a in &ans {
                let key = (c.clone(), a.clone());
                if self.ev.checked_pairs.contains(&key) {
                    continue;
                }
                self.ev.checked_pairs.insert(key);
                if let Some(m) = solubility::mineral_for_pair(c, a) {
                    // A rule-based guess is queued so the web layer can replace it with PubChem data.
                    solubility::request_lookup(&m);
                    if !self.minerals.iter().any(|x| x.solid_species == m.solid_species) {
                        self.minerals.push(m);
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------------------------------ settling
    /// Stokes-like sedimentation of suspended solids: a fresh precipitate is a cloud that settles over tens of
    /// seconds (faster for large/dense particles, aggregated 10x); stirring keeps solids suspended.
    pub fn update_suspension(&mut self, dt_s: f64) {
        let stirring = self.controls.stirring.unwrap_or(false);
        let stir_rpm = self.controls.stir_rpm.unwrap_or(if stirring { 300.0 } else { 0.0 });
        let dust = self.dust_mol();
        let live: Vec<String> = self.solid_mol.iter().filter(|(_, m)| **m > dust).map(|(k, _)| k.clone()).collect();
        self.ev.susp.retain(|k, _| live.contains(k));
        let t_k = self.temperature_k;
        let r_cm = self.config.inner_radius_cm.max(0.5);
        let area_cm2 = std::f64::consts::PI * r_cm.powi(2);
        let liq_h_m = ((self.total_liquid_volume_ml() / area_cm2) * 0.01).max(0.01);
        let rho_fluid = 1000.0;
        let eta_fluid = crate::transport::viscosity_water_pa_s(t_k);

        for sp in live {
            let props = self.solid_props(&sp);
            let d_m = self.particle_populations.get(&sp)
                .map(|p| p.mean_diameter_m())
                .unwrap_or(props.particle_um * 1e-6);
            let rho_p = props.density_g_ml * 1000.0;
            let solid_vol_m3 = self.solid_mol.get(&sp).copied().unwrap_or(0.0) * chem_db::get_species_thermo(&sp).mw * 1e-3 / rho_p.max(100.0);
            let total_liq_m3 = (self.total_liquid_volume_ml() * 1e-6).max(1e-9);
            let phi_solid = (solid_vol_m3 / total_liq_m3).clamp(0.0, 0.5);
            let i_molal = self.ionic_strength_molal();
            let ccc = 0.01; // critical coagulation concentration ~ 10 mM for 1:1 electrolytes
            let agg_factor = if props.kind == SolidKind::Curds || props.kind == SolidKind::Gel {
                1.0 + 7.0 * (i_molal / (i_molal + ccc))
            } else {
                1.0 + 3.0 * (i_molal / (i_molal + ccc))
            };
            let d_eff = d_m * agg_factor;
            let tau = crate::transfer::settling::settling_time_s(liq_h_m, d_eff, rho_p, rho_fluid, eta_fluid, phi_solid, t_k);

            let cur = self.ev.susp.entry(sp).or_insert(1.0);
            if stirring || stir_rpm > 10.0 {
                let target = (stir_rpm / 300.0).clamp(0.2, 0.95);
                *cur += (target - *cur) * (1.0 - (-dt_s / 2.0).exp());
            } else {
                let floor = 0.02;
                *cur = floor + (*cur - floor) * (-dt_s / tau).exp();
            }
        }
    }

    // ------------------------------------------------------------------------------------------ events
    pub fn push_event_full(
        &mut self,
        kind: VesselEventKind,
        detail: String,
        severity: f64,
        species: Option<String>,
        rgb: Option<[f64; 3]>,
    ) {
        self.ev.seq += 1;
        self.events.push(VesselEvent {
            kind,
            t_sim_s: self.t_sim_s,
            detail: Some(detail),
            severity: Some(severity),
            seq: self.ev.seq,
            species,
            rgb,
        });
        if self.events.len() > MAX_EVENTS {
            let drop = self.events.len() - MAX_EVENTS;
            self.events.drain(0..drop);
        }
    }

    pub fn push_event(&mut self, kind: VesselEventKind, detail: String, severity: f64) {
        self.push_event_full(kind, detail, severity, None, None);
    }

    fn solid_gone_mol(&self) -> f64 {
        (SOLID_GONE_M * self.solvent_volume_ml() / 1000.0).max(SOLID_GONE_DUST * self.dust_mol())
    }

    /// Marks every solid currently present as known (user-added), so only later arrivals are reported as precipitates.
    pub fn sync_known_solids(&mut self) {
        let gone_mol = self.solid_gone_mol();
        for (sp, &mol) in &self.solid_mol {
            if mol > gone_mol {
                self.ev.solids.insert(sp.clone());
                self.ev.susp.entry(sp.clone()).or_insert(0.2);
            }
        }
    }

    /// Derives log entries from state differences. `force` also evaluates the solution colour right away.
    pub fn detect_events(&mut self, force: bool) {
        // --- solids appearing / disappearing
        let mut appeared: Vec<String> = Vec::new();
        let announce_mol = (SOLID_ANNOUNCE_M * self.solvent_volume_ml() / 1000.0).max(SOLID_ANNOUNCE_DUST * self.dust_mol());
        let gone_mol = self.solid_gone_mol();
        for (sp, &mol) in &self.solid_mol {
            if mol > announce_mol && !self.ev.solids.contains(sp) {
                appeared.push(sp.clone());
            }
        }
        appeared.sort();
        for sp in appeared {
            self.ev.solids.insert(sp.clone());
            let props = self.solid_props(&sp);
            let srgb = [to_srgb(props.rgb[0]), to_srgb(props.rgb[1]), to_srgb(props.rgb[2])];
            let cname = colour_name(srgb);
            let text = format!("{} precipitate formed: {}", capitalise(&cname), props.formula);
            self.push_event_full(VesselEventKind::PrecipitateFormed, text, 0.5, Some(sp), Some(props.rgb));
        }
        let gone: Vec<String> = self
            .ev
            .solids
            .iter()
            .filter(|sp| self.solid_mol.get(*sp).copied().unwrap_or(0.0) <= gone_mol)
            .cloned()
            .collect();
        let mut gone = gone;
        gone.sort();
        for sp in gone {
            self.ev.solids.remove(&sp);
            let props = self.solid_props(&sp);
            self.push_event_full(
                VesselEventKind::SolidDissolved,
                format!("Solid gone (dissolved or consumed): {}", props.formula),
                0.2,
                Some(sp),
                Some(props.rgb),
            );
        }

        // --- gas evolution (steam from boiling is reported by the boil display, not here)
        let t = self.t_sim_s;
        let fluxes: Vec<(String, f64)> = self.gas_fluxes.iter().map(|g| (g.species.clone(), g.rate_ml_s)).collect();
        for (sp, rate) in fluxes {
            if sp == "H2O(g)" || rate < 0.02 {
                continue;
            }
            if self.ev.gas_seen.insert(sp.clone(), t).is_none() {
                self.push_event_full(
                    VesselEventKind::GasEvolved,
                    format!("Gas evolving: {}", sp.trim_end_matches("(g)")),
                    0.4,
                    Some(sp),
                    None,
                );
            }
        }
        self.ev.gas_seen.retain(|_, last| t - *last < 3.0);

        // --- association complexes (A + nL <=> AL_n equilibria): announce when one first accumulates
        let assoc: Vec<String> = self
            .equilibria
            .iter()
            .filter_map(|eq| {
                let reac: Vec<&String> = eq.reactants.keys().filter(|k| k.as_str() != "H2O").collect();
                let prod: Vec<&String> = eq.products.keys().filter(|k| k.as_str() != "H2O").collect();
                if reac.len() >= 2 && prod.len() == 1 && !reac.iter().any(|r| r.as_str() == "H+" || r.as_str() == "OH-") {
                    Some(prod[0].clone())
                } else {
                    None
                }
            })
            .collect();
        for sp in assoc {
            let mol = self.species_mol.get(&sp).copied().unwrap_or(0.0);
            if mol > 5e-6 && !self.ev.complexes.contains(&sp) {
                self.ev.complexes.insert(sp.clone());
                self.push_event_full(VesselEventKind::ComplexFormed, format!("Complex formed: {}", sp), 0.3, Some(sp), None);
            } else if mol < 1e-6 {
                self.ev.complexes.remove(&sp);
            }
        }

        // --- solution colour
        if force || t - self.ev.colour_eval_t >= 0.5 {
            self.ev.colour_eval_t = t;
            self.detect_colour_change();
        }

        // --- temperature jumps from reaction heat (external heating / baths are silent)
        let temp = self.temperature_k;
        let external = self.controls.heater_w.unwrap_or(0.0) > 0.0
            || self.controls.burner_w.unwrap_or(0.0) > 0.0
            || self.bath_k.is_some()
            || temp >= 372.0;
        match self.ev.temp_ref {
            None => {
                self.ev.temp_ref = Some(temp);
                self.ev.temp_ref_t = t;
            }
            Some(r) => {
                if external || t - self.ev.temp_ref_t > 30.0 {
                    self.ev.temp_ref = Some(temp);
                    self.ev.temp_ref_t = t;
                } else if (temp - r).abs() >= 3.0 && self.total_liquid_volume_ml() > 0.5 {
                    let text = if temp > r {
                        format!("Temperature rose {:.1} °C (to {:.1} °C)", temp - r, temp - 273.15)
                    } else {
                        format!("Temperature fell {:.1} °C (to {:.1} °C)", r - temp, temp - 273.15)
                    };
                    self.ev.temp_ref = Some(temp);
                    self.ev.temp_ref_t = t;
                    self.push_event_full(VesselEventKind::TemperatureChange, text, 0.4, None, None);
                }
            }
        }
    }

    fn detect_colour_change(&mut self) {
        if !self.has_aqueous_phase() {
            return;
        }
        let a = optics::absorbance_per_cm(&self.concentrations_m());
        let lin = optics::transmitted_linear_rgb(&a, 2.0);
        let cur = [to_srgb(lin[0]), to_srgb(lin[1]), to_srgb(lin[2])];
        let reference = self.ev.colour_ref.unwrap_or([1.0, 1.0, 1.0]);
        let dist = ((cur[0] - reference[0]).powi(2) + (cur[1] - reference[1]).powi(2) + (cur[2] - reference[2]).powi(2)).sqrt();
        if dist > 0.12 && (!self.ev.colour_reported || self.t_sim_s - self.ev.colour_t >= 0.5) {
            self.ev.colour_reported = true;
            let chroma = cur.iter().cloned().fold(0.0, f64::max) - cur.iter().cloned().fold(1.0, f64::min);
            let text = if chroma < 0.06 {
                "Solution became colourless".to_string()
            } else {
                format!("Solution turned {}", colour_name(cur))
            };
            self.ev.colour_ref = Some(cur);
            self.ev.colour_t = self.t_sim_s;
            self.push_event_full(VesselEventKind::ColourChange, text, 0.4, None, Some(lin));
        } else if self.ev.colour_ref.is_none() {
            self.ev.colour_ref = Some(reference);
        }
    }
}

/// A monatomic (or Hg2/NH4) cation the solubility table / rules can reason about.
pub fn is_simple_cation(id: &str) -> bool {
    let (body, z) = ions::split_charge(id);
    if z <= 0 {
        return false;
    }
    if body == "NH4" || body == "Hg2" {
        return true;
    }
    ions::cation_charges(body).map_or(false, |cs| cs.contains(&z))
}
