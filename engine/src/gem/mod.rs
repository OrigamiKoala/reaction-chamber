//! Gibbs Energy Minimization (GEM) core.
//!
//! Provides:
//! - `candidates`: candidate species discovery based on elements present.
//! - `basis`: stoichiometric reaction basis from the null space of the formula matrix.
//! - `solver`: projected Newton GEM solver with phase stability tests.

pub mod candidates;
pub mod basis;
pub mod solver;

pub use candidates::*;
pub use basis::*;
pub use solver::*;
