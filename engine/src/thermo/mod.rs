//! Thermodynamic models for Reaction Chamber.
//!
//! Provides:
//! - `water`: IAPWS-IF97 / Bandura-Lvov water properties (Kw, density, dielectric, Psat).
//! - `functions`: h(T), s(T), cp(T), mu0(T, P) from polynomials (NASA, Shomate) and point data.
//! - `k_sp`: mineral solubility products Ksp(T) from species chemical potentials.

pub mod water;
pub mod functions;
pub mod k_sp;

pub use water::*;
pub use functions::*;
pub use k_sp::*;
