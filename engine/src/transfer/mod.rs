//! Heterogeneous and phase transfer kinetics (Stage 8).
//!
//! Provides models for:
//! - Solid dissolution and crystal growth (particle population moments mu0-mu3, Sherwood correlation)
//! - Nucleation (Classical Nucleation Theory + Mersmann interfacial energy)
//! - Electrochemical metal corrosion and cementation (Butler-Volmer mixed potential, Trasatti i0)
//! - Gas-liquid interfacial exchange and CO2 hydration delay
//! - Sub-boiling evaporation with natural-convection mass transfer and latent cooling
//! - Sedimentation and hindered settling with actual layer properties and Brownian stability
//! - Pool fire combustion with Babrauskas burning rates, flammability limits, and extinction

pub mod dissolution;
pub mod nucleation;
pub mod corrosion;
pub mod gas_transfer;
pub mod evaporation;
pub mod settling;
pub mod combustion;

pub use dissolution::*;
pub use nucleation::*;
pub use corrosion::{get_metal_corrosion_props, metal_corrosion_rates_mol_s, solve_mixed_potential, MetalCorrosionProps, FARADAY_C_MOL};
pub use gas_transfer::*;
pub use evaporation::{fuller_gas_diffusivity_m2_s, natural_convection_evaporation_kg, sub_boiling_evaporation_rates};
pub use settling::*;
pub use combustion::*;
