use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::vessel::{LiquidLayer, PhaseKind, SolidKind};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GasPhase {
    pub species_mol: HashMap<String, f64>,
    pub temperature_k: f64,
    pub pressure_atm: f64,
    pub volume_ml: f64,
}

impl Default for GasPhase {
    fn default() -> Self {
        Self {
            species_mol: HashMap::new(),
            temperature_k: 298.15,
            pressure_atm: 1.0,
            volume_ml: 250.0,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LiquidPhase {
    pub id: String,
    pub kind: PhaseKind,
    pub solvent_species: Option<String>,
    pub species_mol: HashMap<String, f64>,
    pub volume_ml: f64,
    pub mass_g: f64,
    pub density_g_ml: f64,
    pub refractive_index: f64,
    pub dielectric_constant: f64,
    pub viscosity_cp: f64,
    pub heat_capacity_j_g_k: f64,
    pub absorbance_per_cm: Vec<f64>,
    pub scatter_per_cm: Vec<f64>,
    pub scatter_albedo: Vec<f64>,
    pub neat_species: Option<String>,
    pub name: Option<String>,
}

impl LiquidPhase {
    pub fn new_aqueous() -> Self {
        Self {
            id: "aqueous".to_string(),
            kind: PhaseKind::Aqueous,
            solvent_species: Some("H2O".to_string()),
            species_mol: HashMap::new(),
            volume_ml: 0.0,
            mass_g: 0.0,
            density_g_ml: 1.0,
            refractive_index: 1.333,
            dielectric_constant: 78.4,
            viscosity_cp: 0.89,
            heat_capacity_j_g_k: 4.184,
            absorbance_per_cm: vec![0.0; crate::optics::N_BINS],
            scatter_per_cm: vec![0.0; crate::optics::N_BINS],
            scatter_albedo: vec![1.0; crate::optics::N_BINS],
            neat_species: None,
            name: None,
        }
    }

    pub fn new_organic(id: &str, solvent: Option<&str>, name: Option<&str>) -> Self {
        Self {
            id: id.to_string(),
            kind: PhaseKind::Organic,
            solvent_species: solvent.map(|s| s.to_string()),
            species_mol: HashMap::new(),
            volume_ml: 0.0,
            mass_g: 0.0,
            density_g_ml: 0.789,
            refractive_index: 1.361,
            dielectric_constant: 24.3,
            viscosity_cp: 1.1,
            heat_capacity_j_g_k: 2.44,
            absorbance_per_cm: vec![0.0; crate::optics::N_BINS],
            scatter_per_cm: vec![0.0; crate::optics::N_BINS],
            scatter_albedo: vec![1.0; crate::optics::N_BINS],
            neat_species: solvent.map(|s| s.to_string()),
            name: name.map(|s| s.to_string()),
        }
    }

    pub fn to_layer(&self) -> LiquidLayer {
        LiquidLayer {
            phase: self.kind,
            volume_ml: self.volume_ml,
            density_g_ml: self.density_g_ml,
            refractive_index: self.refractive_index,
            absorbance_per_cm: self.absorbance_per_cm.clone(),
            scatter_per_cm: self.scatter_per_cm.clone(),
            scatter_albedo: self.scatter_albedo.clone(),
            colour_tier: Default::default(),
            colour_sources: Vec::new(),
            solvent_class: String::new(),
            species: self.neat_species.clone(),
            name: self.name.clone(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SolidPhase {
    pub species: String,
    pub name: String,
    pub mol: f64,
    pub mass_g: f64,
    pub density_g_cm3: f64,
    pub volume_ml: f64,
    pub kind: SolidKind,
    pub rgb: [f64; 3],
    pub particle_diameter_um: f64,
    pub suspended_fraction: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PhaseState {
    pub gas: GasPhase,
    pub liquids: Vec<LiquidPhase>,
    pub solids: Vec<SolidPhase>,
}

impl Default for PhaseState {
    fn default() -> Self {
        Self::new(298.15)
    }
}

impl PhaseState {
    pub fn new(temp_k: f64) -> Self {
        Self {
            gas: GasPhase {
                temperature_k: temp_k,
                ..Default::default()
            },
            liquids: Vec::new(),
            solids: Vec::new(),
        }
    }

    pub fn aqueous_phase(&self) -> Option<&LiquidPhase> {
        self.liquids.iter().find(|l| l.kind == PhaseKind::Aqueous)
    }

    pub fn aqueous_phase_mut(&mut self) -> Option<&mut LiquidPhase> {
        self.liquids.iter_mut().find(|l| l.kind == PhaseKind::Aqueous)
    }

    pub fn ensure_aqueous_phase(&mut self) -> &mut LiquidPhase {
        let idx = self.liquids.iter().position(|l| l.kind == PhaseKind::Aqueous);
        if let Some(i) = idx {
            &mut self.liquids[i]
        } else {
            self.liquids.insert(0, LiquidPhase::new_aqueous());
            &mut self.liquids[0]
        }
    }

    pub fn total_liquid_volume_ml(&self) -> f64 {
        self.liquids.iter().map(|l| l.volume_ml).sum()
    }

    pub fn total_liquid_mass_g(&self) -> f64 {
        self.liquids.iter().map(|l| l.mass_g).sum()
    }

    pub fn rebuild_layers(&self) -> Vec<LiquidLayer> {
        let mut layers: Vec<LiquidLayer> = self.liquids
            .iter()
            .filter(|l| l.volume_ml > 0.001)
            .map(|l| l.to_layer())
            .collect();
        // Densest at the bottom (first in list for rendering order)
        layers.sort_by(|a, b| b.density_g_ml.partial_cmp(&a.density_g_ml).unwrap_or(std::cmp::Ordering::Equal));
        layers
    }
}
