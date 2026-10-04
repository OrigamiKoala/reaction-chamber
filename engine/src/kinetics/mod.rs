//! Kinetics: the extent-coordinate Rosenbrock integrator the vessel runs (`core`). The legacy concentration-space network
//! model and its hand-built iodine-clock network were removed: a reaction's rate law and detailed balance now come only
//! from `GeneralKineticRxn` rows and the generated network, through `KineticExtentSystem`.
pub mod core;
pub mod sparse;
pub use core::*;
