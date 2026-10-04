//! Reactions found by Gibbs-energy discovery (`gem::discovery`): electron transfer between redox couples and thermal
//! decomposition of solids. Nothing here names a reaction.
//!
//! One step of discovered chemistry:
//!  1. every discovered reaction relaxes toward *its own* equilibrium extent (Delta_r G = Delta_r G0 + RT ln Q = 0, with
//!     solids at unit activity, the solvent at a_w, gases at partial pressure and solutes at gamma c) at its own rate
//!     (`gem::rates`: Marcus cross relation for homogeneous electron transfer, film transfer for reactions of a solid,
//!     an Arrhenius solid-state rate for decompositions);
//!  2. the extents are applied *together*: a single common scale keeps every species non-negative (competing reactions
//!     share what is there instead of the first one taking it all), and a damping loop halves the step until no reaction
//!     is pushed past its own equilibrium by the others. The result does not depend on the order of the reactions.
//!
//! A reaction that a registered kinetic row already describes (same reactants and products apart from the solvent and
//! its ions) is left to that row: measured kinetics replace the estimated rate of the same reaction.

use std::collections::{BTreeMap, BTreeSet, HashMap};

use crate::chem_db;
use crate::gem::discovery::{DiscoveredReaction, DiscoveredRxnKind};
use crate::physics::R_GAS;
use crate::vessel::{ActivityContext, Vessel, AQUEOUS_SOLVENT};
use crate::vessel::{GasFlux, ReactionRow};

/// Concentration (mol/L) assumed for a gas that takes part in a homogeneous electron transfer when no dissolved twin of
/// it is in the solution (the order of the saturation concentration of a sparingly soluble gas in air-saturated water).
const GAS_PARTNER_CONC_M: f64 = 2.5e-4;

fn is_helper(sp: &str) -> bool {
    sp == crate::db::seed::WATER || sp == crate::db::seed::PROTON || sp == crate::db::seed::HYDROXIDE
}

impl Vessel {
    /// What a reaction quotient needs from the vessel at the start of a step: activity coefficients and water activity of
    /// the aqueous solution, its volume, and the partial pressure (Pa) of every gas the reactions can meet (the headspace
    /// when sealed, the atmosphere when open).
    pub(crate) fn activity_context(&self) -> ActivityContext {
        let (gamma, a_w) = crate::activity::batch_aqueous_gamma_and_aw(&self.species_mol, self.temperature_k);
        let mut gas_pa: HashMap<String, f64> = HashMap::new();
        let mut head_m3 = 0.0;
        if self.sealed {
            head_m3 = self.headspace_volume_m3().max(1e-9);
            for (sp, &n) in &self.headspace_gas_mol {
                gas_pa.insert(sp.clone(), n.max(0.0) * R_GAS * self.temperature_k / head_m3);
            }
        } else {
            for (sp, p) in self.atmosphere_partials() {
                gas_pa.insert(sp, p);
            }
        }
        ActivityContext {
            gamma,
            ln_aw: a_w.max(1e-10).ln(),
            vol_l: (self.reaction_volume_ml() / 1000.0).max(1e-6),
            gas_pa,
            sealed: self.sealed,
            head_m3,
        }
    }

    /// True when a registered kinetic row is the same reaction as `rxn` (reactants and products equal once the solvent and
    /// its ions are set aside; either direction for a reversible row).
    fn kinetic_row_covers(&self, rxn: &DiscoveredReaction) -> bool {
        // phase tags of dissolved / liquid / gaseous forms are set aside: a kinetic row that makes O2(g) is the reaction
        // that makes dissolved O2 (the gas leaves by Henry exchange)
        let norm = |s: &str| s.trim_end_matches("(g)").trim_end_matches("(aq)").trim_end_matches("(l)").to_string();
        let strip = |it: &mut dyn Iterator<Item = &str>| -> BTreeSet<String> { it.map(norm).filter(|s| !is_helper(s)).collect() };
        let lhs = strip(&mut rxn.nu.iter().filter(|&&(_, c)| c < 0.0).map(|&(i, _)| rxn.species_names[i].as_str()));
        let rhs = strip(&mut rxn.nu.iter().filter(|&&(_, c)| c > 0.0).map(|&(i, _)| rxn.species_names[i].as_str()));
        self.kinetic_reactions.iter().any(|k| {
            let kl = strip(&mut k.reactants.keys().map(|s| s.as_str()));
            let kr = strip(&mut k.products.keys().chain(k.gas_products.keys()).map(|s| s.as_str()));
            (kl == lhs && kr == rhs) || (k.is_reversible && kl == rhs && kr == lhs)
        })
    }

    /// Amount (mol) of the species `sp` the vessel can give to a reaction; infinite for the gas of an open atmosphere that
    /// is present in it (a reservoir that is not used up).
    fn discovered_available(&self, sp: &str, ctx: &ActivityContext, gas_like: &dyn Fn(&str) -> bool) -> f64 {
        if sp.ends_with("(s)") {
            self.solid_mol.get(sp).copied().unwrap_or(0.0)
        } else if gas_like(sp) {
            if ctx.sealed {
                self.headspace_gas_mol.get(sp).copied().unwrap_or(0.0)
            } else if ctx.gas_pa.get(sp).copied().unwrap_or(0.0) > 0.0 {
                f64::INFINITY
            } else {
                0.0
            }
        } else {
            self.species_mol.get(sp).copied().unwrap_or(0.0)
        }
    }

    /// ln Q - ln K of a discovered reaction in the vessel state changed by `delta` (mol per species): the sign of its
    /// driving force (negative while it can still go forward). Solids have unit activity, the solvent a_w, a gas p / 1 bar
    /// (the headspace pressure follows the change when sealed; an open atmosphere does not), a solute gamma c.
    fn discovered_ln_q_minus_ln_k(&self, rxn: &DiscoveredReaction, ctx: &ActivityContext, gas_like: &dyn Fn(&str) -> bool, delta: &dyn Fn(&str) -> f64) -> f64 {
        let rt = R_GAS * self.temperature_k.max(1.0);
        let mut ln_q = 0.0;
        for &(idx, coeff) in &rxn.nu {
            let sp = &rxn.species_names[idx];
            let ln_a = if sp.ends_with("(s)") {
                0.0
            } else if sp == AQUEOUS_SOLVENT {
                ctx.ln_aw
            } else if gas_like(sp) {
                let mut p = ctx.gas_pa.get(sp).copied().unwrap_or(0.0);
                if ctx.sealed {
                    p += delta(sp) * rt / ctx.head_m3;
                }
                (p.max(1e-6) / crate::vle::P_BAR_PA).ln()
            } else {
                let n = self.species_mol.get(sp).copied().unwrap_or(0.0) + delta(sp);
                (n.max(1e-30) / ctx.vol_l).ln() + ctx.gamma.get(sp).copied().unwrap_or(0.0)
            };
            ln_q += coeff * ln_a;
        }
        ln_q + rxn.delta_g0_j / rt
    }

    /// Extent (mol) at which a discovered reaction reaches its own equilibrium, never past the limiting reactant: the root
    /// of ln Q - ln K on [0, limiting extent]. Zero when its reactants are absent or it has no driving force.
    fn discovered_equilibrium_extent(&self, rxn: &DiscoveredReaction, ctx: &ActivityContext, gas_like: &dyn Fn(&str) -> bool) -> f64 {
        let mut max_xi = f64::INFINITY;
        for &(idx, coeff) in &rxn.nu {
            if coeff >= 0.0 {
                continue;
            }
            let amt = self.discovered_available(&rxn.species_names[idx], ctx, gas_like);
            if amt <= 1e-12 {
                return 0.0;
            }
            max_xi = max_xi.min(amt / (-coeff));
        }
        if !max_xi.is_finite() || max_xi <= 1e-15 {
            return 0.0;
        }
        let f = |xi: f64| -> f64 {
            let delta = |sp: &str| rxn.nu.iter().find(|&&(i, _)| rxn.species_names[i] == sp).map_or(0.0, |&(_, c)| c * xi);
            self.discovered_ln_q_minus_ln_k(rxn, ctx, gas_like, &delta)
        };
        // ln Q rises with the extent: the equilibrium extent is the root of f on [0, max_xi]
        if f(0.0) >= 0.0 {
            return 0.0;
        }
        if f(max_xi * (1.0 - 1e-12)) <= 0.0 {
            return max_xi;
        }
        let (mut lo, mut hi) = (0.0, max_xi);
        for _ in 0..80 {
            let mid = 0.5 * (lo + hi);
            if f(mid) < 0.0 {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        lo
    }

    /// Relaxation rate (1/s) of a homogeneous electron transfer: the encounter of donor and acceptor at the Marcus
    /// cross-relation rate constant, k12 x the concentration of the more abundant partner (the scarcer one decays at that
    /// pseudo-first-order rate). A gas partner is represented by its dissolved twin.
    fn redox_homogeneous_rate(&self, rxn: &DiscoveredReaction, ctx: &ActivityContext) -> f64 {
        let (Some(p), DiscoveredRxnKind::Redox { z_electrons }) = (&rxn.partners, &rxn.kind) else { return 0.0 };
        let name = |i: usize| rxn.species_names[i].as_str();
        let et = crate::gem::rates::electron_transfer_rate(name(p.donor), name(p.donor_product), name(p.acceptor), name(p.acceptor_product), *z_electrons, rxn.delta_g0_j, self.temperature_k, self.calc_ionic_strength());
        let conc = |sp: &str| -> f64 {
            if sp.ends_with("(s)") {
                // a solid takes part through its surface; its amount per volume bounds the encounter concentration
                self.solid_mol.get(sp).copied().unwrap_or(0.0) / ctx.vol_l
            } else if sp.ends_with("(g)") {
                let twin = format!("{}(aq)", sp.trim_end_matches("(g)"));
                let c = self.species_mol.get(&twin).copied().unwrap_or(0.0) / ctx.vol_l;
                if c > 0.0 { c } else { GAS_PARTNER_CONC_M }
            } else {
                self.species_mol.get(sp).copied().unwrap_or(0.0) / ctx.vol_l
            }
        };
        let (c_d, c_a) = (conc(name(p.donor)), conc(name(p.acceptor)));
        et.k12 * c_d.max(c_a)
    }

    /// Thermal decomposition of the solids present (solid -> solid + gas, solid -> gases), found by
    /// `gem::discovery::discover_thermal_decompositions`. Every non-solid product is released as a gas.
    pub(crate) fn step_thermal_decomposition(&mut self, dt_s: f64) -> f64 {
        let t_k = self.temperature_k;
        let p_pa = self.pressure_atm * crate::vle::P_BAR_PA;
        let rxns = crate::gem::discovery::discover_thermal_decompositions(&self.solid_mol, t_k, p_pa);
        if rxns.is_empty() {
            return 0.0;
        }
        let ctx = self.activity_context();
        let items: Vec<(DiscoveredReaction, f64)> = rxns
            .into_iter()
            .filter(|r| !self.kinetic_row_covers(r))
            .map(|r| {
                let lam = crate::gem::rates::decomposition_rate(r.delta_h0_j, t_k);
                (r, lam)
            })
            .collect();
        let not_solid = |sp: &str| !sp.ends_with("(s)");
        self.advance_discovered(items, "thermal_decomposition", dt_s, &ctx, &not_solid, "solid")
    }

    /// Generalized redox reactions: electron transfer between couples (non-conducting solids and dissolved species; metals
    /// react through their electrode reactions in `step_electrochemistry`).
    pub(crate) fn step_redox(&mut self, dt_s: f64) -> f64 {
        let t_k = self.temperature_k;
        let p_pa = self.pressure_atm * crate::vle::P_BAR_PA;
        let rxns = crate::gem::discovery::discover_reactions(&self.species_mol, &self.solid_mol, t_k, p_pa);
        let ctx = self.activity_context();
        let mut items: Vec<(DiscoveredReaction, f64)> = Vec::new();
        for rxn in rxns {
            if !matches!(rxn.kind, DiscoveredRxnKind::Redox { .. }) {
                continue;
            }
            // a conducting solid (a metal) reacts through its electrode reactions (`step_electrochemistry`)
            if rxn.nu.iter().any(|&(idx, c)| c < 0.0 && crate::vessel_electro::is_conducting_solid(&rxn.species_names[idx])) {
                continue;
            }
            if self.kinetic_row_covers(&rxn) {
                continue;
            }
            // the electron transfer itself (Marcus encounter rate of the two couples) limits every reaction; one with a
            // (non-conducting) solid reactant is also limited by the surface of the solid: the film relaxation rate
            // k A / V of its particle population
            let lam_et = self.redox_homogeneous_rate(&rxn, &ctx);
            let has_solid_reactant = rxn.nu.iter().any(|&(idx, c)| c < 0.0 && rxn.species_names[idx].ends_with("(s)"));
            let lam = if has_solid_reactant {
                let hyd = self.hydro_state();
                let mut lam = 0.0;
                for &(idx, coeff) in &rxn.nu {
                    let sp = &rxn.species_names[idx];
                    if coeff < 0.0 && sp.ends_with("(s)") {
                        if let Some(pop) = self.particle_populations.get(sp) {
                            let k = crate::transfer::population::effective_transfer_coefficient(self.film_coefficient(sp, pop.sauter_diameter_m(), self.solid_diffusivity(sp), &hyd));
                            lam += k * pop.surface_area_m2() / hyd.liquid_m3.max(1e-12);
                        }
                    }
                }
                lam.min(lam_et)
            } else {
                lam_et
            };
            items.push((rxn, lam));
        }
        let is_gas = |sp: &str| sp.ends_with("(g)");
        self.advance_discovered(items, "redox", dt_s, &ctx, &is_gas, "wall")
    }

    /// Advances a set of discovered reactions together (see the module comment) and returns the heat released (J).
    fn advance_discovered(
        &mut self,
        items: Vec<(DiscoveredReaction, f64)>,
        kind: &str,
        dt_s: f64,
        ctx: &ActivityContext,
        gas_like: &dyn Fn(&str) -> bool,
        nucleation: &str,
    ) -> f64 {
        if items.is_empty() || dt_s <= 0.0 {
            return 0.0;
        }
        // 1. each reaction alone: its relaxation toward its own equilibrium
        let mut xi: Vec<f64> = items
            .iter()
            .map(|(r, lam)| {
                // a reaction that would move less than a part in 1e10 of the vessel in this step is not evaluated
                if *lam * dt_s < 1e-10 {
                    return 0.0;
                }
                self.discovered_equilibrium_extent(r, ctx, gas_like) * (1.0 - (-lam * dt_s).exp())
            })
            .collect();
        if xi.iter().all(|&x| x <= 1e-15) {
            return 0.0;
        }
        // 2. together: the net change of every species the reactions share, as one common scale (no species below zero)
        let net_of = |xi: &[f64], scale: f64| -> BTreeMap<String, f64> {
            let mut net: BTreeMap<String, f64> = BTreeMap::new();
            for ((r, _), x) in items.iter().zip(xi) {
                if *x <= 0.0 {
                    continue;
                }
                for &(idx, c) in &r.nu {
                    *net.entry(r.species_names[idx].clone()).or_default() += c * x * scale;
                }
            }
            net
        };
        let net = net_of(&xi, 1.0);
        let mut scale: f64 = 1.0;
        for (sp, d) in &net {
            if *d < 0.0 {
                let have = self.discovered_available(sp, ctx, gas_like);
                if have.is_finite() && -*d > have {
                    scale = scale.min((have / -*d).max(0.0));
                }
            }
        }
        // 3. no reaction may be driven past its own equilibrium by the others: halve the step until none is
        for _ in 0..8 {
            let net = net_of(&xi, scale);
            let delta = |sp: &str| net.get(sp).copied().unwrap_or(0.0);
            let overshoot = items.iter().zip(&xi).any(|((r, _), x)| *x > 1e-15 && self.discovered_ln_q_minus_ln_k(r, ctx, gas_like, &delta) > 1e-9);
            if !overshoot {
                break;
            }
            scale *= 0.5;
        }
        for x in xi.iter_mut() {
            *x *= scale;
        }
        // 4. apply
        let mut heat_j = 0.0;
        let vol_l = ctx.vol_l.max(0.001);
        for ((rxn, _), extent) in items.iter().zip(&xi) {
            let extent = *extent;
            if extent <= 1e-15 {
                continue;
            }
            for &(idx, coeff) in &rxn.nu {
                let sp = &rxn.species_names[idx];
                let change = coeff * extent;
                if sp.ends_with("(s)") {
                    let cur = self.solid_mol.entry(sp.clone()).or_insert(0.0);
                    *cur = (*cur + change).max(0.0);
                    if coeff > 0.0 {
                        *self.initial_solids.entry(sp.clone()).or_insert(0.0) += change;
                    }
                } else if gas_like(sp) {
                    self.release_gas(sp, change, dt_s, nucleation);
                } else {
                    let cur = self.species_mol.entry(sp.clone()).or_insert(0.0);
                    *cur = (*cur + change).max(0.0);
                }
            }
            heat_j -= extent * rxn.delta_h0_j;
            let rate = if kind == "redox" { extent / (vol_l * dt_s.max(0.001)) } else { extent / dt_s.max(0.001) };
            self.push_discovered_row(rxn, kind, rate, if kind == "redox" { "Redox / GEM, Marcus rate (speculative)" } else { "Thermodynamics / GEM, solid-state rate (speculative)" });
        }
        heat_j
    }

    /// A gas produced (`mol` > 0) or consumed by a discovered reaction: into the headspace when sealed, out of an open vessel.
    pub(crate) fn release_gas(&mut self, sp: &str, mol: f64, dt_s: f64, nucleation: &str) {
        if self.sealed {
            let cur = self.headspace_gas_mol.entry(sp.to_string()).or_insert(0.0);
            *cur = (*cur + mol).max(0.0);
        } else {
            // leaves an open vessel (mol > 0) or is drawn from its atmosphere (mol < 0)
            let mw = chem_db::get_species_thermo(sp).mw;
            self.mass_lost_g += mol * mw;
            self.ledger.book_out(sp, mol);
        }
        if mol > 0.0 && dt_s > 0.0 {
            let ml_s = mol * R_GAS * self.temperature_k / self.p_ext_pa().max(1.0) * 1e6 / dt_s;
            self.gas_fluxes.push(GasFlux {
                species: if sp.ends_with("(g)") { sp.to_string() } else { format!("{}(g)", sp) },
                rate_ml_s: ml_s,
                bubble_diameter_mm: self.bubble_diameter_mm(nucleation),
                nucleation: nucleation.to_string(),
                origin: None,
            });
        }
    }

    fn push_discovered_row(&mut self, rxn: &DiscoveredReaction, kind: &str, rate: f64, source: &str) {
        let eq_str = rxn.nu.iter().map(|&(i, c)| format!("{} {}", c, rxn.species_names[i])).collect::<Vec<_>>().join(" + ");
        let lead = rxn.nu.iter().find(|&&(_, c)| c < 0.0).map(|&(i, _)| rxn.species_names[i].clone()).unwrap_or_default();
        self.active_reactions.push(ReactionRow {
            id: format!("{}_{}", if kind == "redox" { "redox" } else { "decomp" }, lead),
            equation: eq_str,
            kind: kind.to_string(),
            rate,
            log_q_over_k: None,
            tier: crate::types::ProvenanceTier::Speculative,
            source: source.to_string(),
            active: true,
            role: None,
        });
    }
}
