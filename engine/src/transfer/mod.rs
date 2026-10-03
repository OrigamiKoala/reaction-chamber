//! Heterogeneous and phase-transfer kinetics (Stage 8).
//!
//! Every model here takes intrinsic data (formula, thermodynamic records, solubility product, density) and the vessel's
//! state (temperature, stirring, liquid properties) and returns a rate; nothing is keyed by compound:
//!
//! - `hydro`: stirring power, just-suspended speed, slip velocity, Sherwood numbers, gas-liquid k_L
//! - `diffusion`: diffusivities from the formula (Hayduk-Laudie, Fuller-Schettler-Giddings, Nernst-Einstein)
//! - `population`: particle population moments, area and mean size, the semi-implicit relaxation law
//! - `psd`: log-normal closure of the population moments, equal-mass size classes (settling and scattering per class)
//! - `nucleation`: Mersmann interfacial energy, classical nucleation theory, nucleation + growth precipitation
//! - `electrochem`: discovered half-reactions, Butler-Volmer kinetics, mixed potential (corrosion, cementation) and
//!   electrolysis
//! - `gas_transfer`: dissolved-gas bubble release and surface exchange
//! - `evaporation`: sub-boiling evaporation with natural / forced convection
//! - `settling`: Stokes sedimentation, hindered settling, Brownian stability, Schulze-Hardy aggregation
//! - `combustion`: flammability, pool burning rate, flame temperature and luminosity of any CHON fuel

pub mod combustion;
pub mod diffusion;
pub mod electrochem;
pub mod evaporation;
pub mod gas_transfer;
pub mod hydro;
pub mod nucleation;
pub mod population;
pub mod psd;
pub mod settling;

pub use population::ParticlePopulation;
pub use psd::{LogNormal, N_CLASSES};
