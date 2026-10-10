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

/// A kinetic row as the families of its reactants and of its products.
struct RowFamilies {
    lhs: BTreeSet<String>,
    rhs: BTreeSet<String>,
    reversible: bool,
}

/// The family of a species: what the fast equilibria and the phases make of one another, i.e. the non-hydrogen elements in lowest
/// whole-number proportions, so I2(aq), I2(s) and I3- are one family (iodine), SO4-2 and HSO4- another (sulfate), while IO3- or
/// Br2 are not.
fn species_family(s: &str) -> String {
    let base = s.trim_end_matches("(g)").trim_end_matches("(aq)").trim_end_matches("(l)").trim_end_matches("(s)");
    match crate::ions::species_elements(s).or_else(|| crate::ions::species_elements(base)) {
        Some(el) => {
            let mut v: Vec<(String, i64)> = el.iter().filter(|(k, _)| k.as_str() != "H").map(|(k, &n)| (k.clone(), n.round().max(1.0) as i64)).collect();
            let gcd = |mut a: i64, mut b: i64| {
                while b != 0 {
                    (a, b) = (b, a % b);
                }
                a
            };
            let g = v.iter().fold(0, |acc, (_, n)| gcd(acc, *n)).max(1);
            v.iter_mut().for_each(|(_, n)| *n /= g);
            v.sort();
            format!("{:?}", v)
        }
        None => base.to_string(),
    }
}

/// True when a registered kinetic row is the same reaction as `rxn`: the same families on each side once the solvent and its
/// ions are set aside (either direction for a reversible row). A measured rate law replaces the estimated one of the reaction it
/// describes, whatever form its products leave in; otherwise every variant of the reaction would run beside it.
fn covered_by_rows(rows: &[RowFamilies], rxn: &DiscoveredReaction, cache: &mut std::collections::HashMap<String, String>) -> bool {
    if rows.is_empty() {
        return false;
    }
    let mut side = |positive: bool| -> BTreeSet<String> {
        let mut out = BTreeSet::new();
        for &(i, c) in &rxn.nu {
            if (c > 0.0) != positive {
                continue;
            }
            let sp = rxn.species_names[i].as_str();
            if is_helper(sp.trim_end_matches("(g)").trim_end_matches("(aq)").trim_end_matches("(l)")) {
                continue;
            }
            let fam = cache.entry(sp.to_string()).or_insert_with(|| species_family(sp)).clone();
            out.insert(fam);
        }
        out
    };
    let lhs = side(false);
    rows.iter().any(|k| k.lhs == lhs || (k.reversible && k.rhs == lhs))
}

impl Vessel {
    /// What a reaction quotient needs from the vessel at the start of a step: activity coefficients and water activity of
    /// the aqueous solution, its volume, and the partial pressure (Pa) of every gas the reactions can meet (the headspace
    /// when sealed, the atmosphere when open).
    pub(crate) fn activity_context(&self) -> ActivityContext {
        let (mut gamma, a_w) = crate::activity::batch_aqueous_gamma_and_aw(&self.species_mol, self.temperature_k);
            self.apply_mixed_solvent_born(&mut gamma);
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
        // the standard states of the formation data are molal: solutes enter the quotient as gamma m. A phase without
        // water has no molality; its volume stands in for the solvent mass (1 kg/L)
        let water_kg = self.species_mol.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0) * 0.01801528;
        let vol_l = (self.reaction_volume_ml() / 1000.0).max(1e-6);
        ActivityContext {
            solvent_kg: if water_kg > 1e-9 { water_kg } else { vol_l },
            gamma,
            ln_aw: a_w.max(1e-10).ln(),
            vol_l,
            gas_pa,
            sealed: self.sealed,
            head_m3,
        }
    }

    /// The registered kinetic rows as families (see `covered_by_rows`), computed once per step.
    fn kinetic_row_families(&self) -> Vec<RowFamilies> {
        let strip = |it: &mut dyn Iterator<Item = &str>| -> BTreeSet<String> { it.filter(|s| !is_helper(s.trim_end_matches("(g)").trim_end_matches("(aq)").trim_end_matches("(l)"))).map(species_family).collect() };
        self.kinetic_reactions
            .iter()
            .map(|k| RowFamilies {
                lhs: strip(&mut k.reactants.keys().map(|s| s.as_str())),
                rhs: strip(&mut k.products.keys().chain(k.gas_products.keys()).map(|s| s.as_str())),
                reversible: k.is_reversible,
            })
            .collect()
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
                (n.max(1e-30) / ctx.solvent_kg).ln() + ctx.gamma.get(sp).copied().unwrap_or(0.0)
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
        for _ in 0..56 {
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
    /// cross-relation rate constant, k12 x the concentration of the partner of the limiting reactant (which decays at that
    /// pseudo-first-order rate). A gas partner is represented by its dissolved twin.
    fn redox_homogeneous_rate(&self, rxn: &DiscoveredReaction, ctx: &ActivityContext, ionic_strength: f64) -> f64 {
        let (Some(p), DiscoveredRxnKind::Redox { z_electrons }) = (&rxn.partners, &rxn.kind) else { return 0.0 };
        let name = |i: usize| rxn.species_names[i].as_str();
        // the driving force of the electron transfer is the one at the solution's own acidity: the standard reaction Gibbs energy
        // (a_H+ = 1 for a reaction written with H+, a_OH- = 1 for one written with OH-) corrected by the activities of the
        // solvent's own ions and of the solvent (the formal potential at this pH, not the one at pH 0)
        let rt = R_GAS * self.temperature_k.max(1.0);
        let mut dg_j = rxn.delta_g0_j;
        for &(idx, c) in &rxn.nu {
            let sp = name(idx);
            if is_helper(sp) {
                let ln_a = if sp == AQUEOUS_SOLVENT { ctx.ln_aw } else { (self.species_mol.get(sp).copied().unwrap_or(0.0).max(1e-30) / ctx.solvent_kg).ln() + ctx.gamma.get(sp).copied().unwrap_or(0.0) };
                dg_j += rt * c * ln_a;
            }
        }
        let et = crate::gem::rates::electron_transfer_rate(name(p.donor), name(p.donor_product), name(p.acceptor), name(p.acceptor_product), *z_electrons, dg_j, self.temperature_k, ionic_strength);
        let conc = |sp: &str| -> f64 {
            if sp == AQUEOUS_SOLVENT {
                // the solvent is at unit activity: its 55 M does not multiply the rate of a reaction it takes part in (a
                // pseudo-first-order rate constant already contains it), or oxidising water would be 55 times too fast
                1.0
            } else if sp.ends_with("(s)") {
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
        // the reactant that runs out first (by amount per stoichiometric coefficient) is consumed at the pseudo-first-order rate
        // k12 [other], so the rate law is second order whichever partner is the scarcer one (the larger concentration is not
        // always the partner of the limiting reactant: 2 I- per H2O2 makes iodide the limiting one at equal amounts)
        let coeff = |i: usize| rxn.nu.iter().find(|&&(j, _)| j == i).map_or(1.0, |&(_, c)| c.abs().max(1e-9));
        let (e_d, e_a) = (c_d / coeff(p.donor), c_a / coeff(p.acceptor));
        let donor_limits = e_d <= e_a;
        // a measured rate law of this electron transfer (`data/rates_measured.json`) replaces the Marcus estimate:
        // -d[X]/dt = k [donor][acceptor][H+]^n, so the limiting reactant L decays at k (nu_L / nu_X) [other]
        if let Some(m) = crate::rate_data::redox_rate(name(p.donor), name(p.donor_product), name(p.acceptor), name(p.acceptor_product)) {
            let x = if m.rate_of == name(p.donor) { Some(p.donor) } else if m.rate_of == name(p.acceptor) { Some(p.acceptor) } else { None };
            if let Some(x) = x {
                let lim = if donor_limits { p.donor } else { p.acceptor };
                let other = if donor_limits { p.acceptor } else { p.donor };
                let mut sum_rate = 0.0;
                for term in m.all_terms() {
                    let k_term = term.k_at(self.temperature_k);
                    let mut factor = 1.0;
                    for (sp, &ord) in &term.orders {
                        if sp == name(lim) {
                            if ord != 1.0 {
                                factor *= conc(sp).max(0.0).powf(ord - 1.0);
                            }
                        } else if sp == name(other) {
                            if ord != 1.0 {
                                factor *= conc(sp).max(0.0).powf(ord - 1.0);
                            }
                        } else {
                            let c = if sp == crate::db::seed::PROTON {
                                self.species_mol.get(crate::db::seed::PROTON).copied().unwrap_or(0.0).max(0.0) / ctx.vol_l
                            } else if sp == crate::db::seed::HYDROXIDE {
                                self.species_mol.get(crate::db::seed::HYDROXIDE).copied().unwrap_or(0.0).max(0.0) / ctx.vol_l
                            } else {
                                conc(sp)
                            };
                            factor *= c.max(0.0).powf(ord);
                        }
                    }
                    sum_rate += k_term * factor * coeff(lim) / coeff(x) * if donor_limits { c_a } else { c_d };
                }
                return sum_rate;
            }
        }
        et.k12 * if donor_limits { c_a } else { c_d }
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
        let rows = self.kinetic_row_families();
        let mut family_cache: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        let items: Vec<(DiscoveredReaction, f64)> = rxns
            .into_iter()
            .filter(|r| !covered_by_rows(&rows, r, &mut family_cache))
            .map(|r| {
                let solid_reac = r.nu.iter().find(|&&(i, c)| c < 0.0 && r.species_names[i].ends_with("(s)"))
                    .map(|&(i, _)| r.species_names[i].as_str());
                let lam = crate::gem::rates::decomposition_rate_for(solid_reac, r.delta_h0_j, t_k, |cat| {
                    self.solid_mol.get(cat).copied().unwrap_or(0.0) > 0.0
                });
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
        let is_gas = |sp: &str| sp.ends_with("(g)");
        // The same reaction is found written with H+ and with OH- (and with neither): all of them relax to the same equilibrium, so
        // each would count its rate. One version of each reaction is kept, the one whose extent is largest: a version that
        // *consumes* H+ or OH- is limited by the small pool of that ion at the moment (the acid-base equilibria restore the pool
        // only after the step), a version that releases it is not, so in a neutral or basic solution the version that makes H+
        // is the one that can run, and in an acid one the version that uses it.
        let core_key = |r: &DiscoveredReaction| -> Vec<(String, i64)> {
            // the participants other than the solvent's own species, scaled to the largest coefficient (the versions are
            // balanced independently and come out with different multiples)
            let core: Vec<(&String, f64)> = r.nu.iter().filter(|&&(i, _)| !is_helper(&r.species_names[i])).map(|&(i, c)| (&r.species_names[i], c)).collect();
            let scale = core.iter().map(|(_, c)| c.abs()).fold(0.0, f64::max).max(1e-12);
            let mut k: Vec<(String, i64)> = core.iter().map(|(n, c)| ((*n).clone(), (c / scale * 1e6).round() as i64)).collect();
            k.sort();
            k
        };
        let rows = self.kinetic_row_families();
        let mut family_cache: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        let mut conducting: std::collections::HashMap<String, bool> = std::collections::HashMap::new();
        let mut best: BTreeMap<Vec<(String, i64)>, (f64, usize)> = BTreeMap::new();
        let mut candidates: Vec<(DiscoveredReaction, f64)> = Vec::new();
        for rxn in rxns.into_iter().filter(|r| matches!(r.kind, DiscoveredRxnKind::Redox { .. })) {
            // a conducting solid (a metal) reacts through its electrode reactions (`step_electrochemistry`)
            if rxn.nu.iter().any(|&(idx, c)| c < 0.0 && *conducting.entry(rxn.species_names[idx].clone()).or_insert_with(|| crate::vessel_electro::is_conducting_solid(&rxn.species_names[idx]))) {
                continue;
            }
            // measured kinetics replace the estimated rate of the same reaction
            if covered_by_rows(&rows, &rxn, &mut family_cache) {
                continue;
            }
            // a reaction without driving force at this composition is not worth a rate (most of the candidates)
            let ext = self.discovered_equilibrium_extent(&rxn, &ctx, &is_gas);
            if ext <= 1e-15 {
                continue;
            }
            // extents of versions with different multiples compare per electron transferred
            let z = match rxn.kind {
                DiscoveredRxnKind::Redox { z_electrons } => z_electrons.max(1.0),
                _ => 1.0,
            };
            let key = core_key(&rxn);
            let score = ext * z;
            let slot = best.entry(key).or_insert((-1.0, usize::MAX));
            if score > slot.0 * (1.0 + 1e-9) {
                *slot = (score, candidates.len());
            }
            candidates.push((rxn, score));
        }
        let ionic_strength = self.calc_ionic_strength();
        let keep: std::collections::BTreeSet<usize> = best.values().map(|&(_, i)| i).collect();
        // a measured rate law that names no products governs the whole donor / acceptor pair: only the most favourable
        // pathway of the pair runs (at the measured rate), the others would count the same loss again
        let mut pair_best: HashMap<(String, String), (f64, usize)> = HashMap::new();
        for (i, (rxn, score)) in candidates.iter().enumerate() {
            if !keep.contains(&i) {
                continue;
            }
            if let (Some(p), DiscoveredRxnKind::Redox { .. }) = (&rxn.partners, &rxn.kind) {
                let n = |j: usize| rxn.species_names[j].as_str();
                if let Some(m) = crate::rate_data::redox_rate(n(p.donor), n(p.donor_product), n(p.acceptor), n(p.acceptor_product)) {
                    if !m.product_specific() {
                        let slot = pair_best.entry((m.donor.clone(), m.acceptor.clone())).or_insert((-1.0, usize::MAX));
                        if *score > slot.0 {
                            *slot = (*score, i);
                        }
                    }
                }
            }
        }
        let pair_runner = |rxn: &DiscoveredReaction, i: usize| -> bool {
            let Some(p) = &rxn.partners else { return true };
            let key = (rxn.species_names[p.donor].clone(), rxn.species_names[p.acceptor].clone());
            pair_best.get(&key).map_or(true, |&(_, j)| j == i)
        };
        for (i, (rxn, _)) in candidates.into_iter().enumerate() {
            if !keep.contains(&i) || !pair_runner(&rxn, i) {
                continue;
            }
            // the electron transfer itself (Marcus encounter rate of the two couples) limits every reaction; one with a
            // (non-conducting) solid reactant is also limited by the surface of the solid: the film relaxation rate
            // k A / V of its particle population
            let lam_et = self.redox_homogeneous_rate(&rxn, &ctx, ionic_strength);
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
        let r = self.advance_discovered(items, "redox", dt_s, &ctx, &is_gas, "wall");
        r
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
        // a reaction whose extent in this step is a ten-millionth of the biggest one's moves nothing that can be seen and
        // costs as much as any other in the search for the common scale below: it is left out (its turn comes when the big
        // ones have run their course, since the comparison is relative)
        let x_biggest = xi.iter().cloned().fold(0.0, f64::max);
        for x in xi.iter_mut() {
            if *x < 1e-7 * x_biggest {
                *x = 0.0;
            }
        }
        // The search for the common scale below evaluates the reaction quotients of every reaction hundreds of times: the species
        // of the reactions in play are numbered once and the quotients are read from plain arrays (the same formula as
        // `discovered_ln_q_minus_ln_k`).
        let mut index: HashMap<&str, usize> = HashMap::new();
        let mut names: Vec<&str> = Vec::new();
        let mut dense: Vec<Vec<(usize, f64)>> = Vec::with_capacity(items.len());
        for (r, _) in &items {
            let mut v = Vec::with_capacity(r.nu.len());
            for &(i, c) in &r.nu {
                let sp = r.species_names[i].as_str();
                let k = *index.entry(sp).or_insert_with(|| {
                    names.push(sp);
                    names.len() - 1
                });
                v.push((k, c));
            }
            dense.push(v);
        }
        struct Sp {
            kind: u8, // 0 solid, 1 solvent, 2 gas, 3 solute
            n: f64,
            gamma: f64,
            p_pa: f64,
            avail: f64,
        }
        let sp_state: Vec<Sp> = names
            .iter()
            .map(|&sp| {
                let kind = if sp.ends_with("(s)") {
                    0
                } else if sp == AQUEOUS_SOLVENT {
                    1
                } else if gas_like(sp) {
                    2
                } else {
                    3
                };
                Sp {
                    kind,
                    n: self.species_mol.get(sp).copied().unwrap_or(0.0),
                    gamma: ctx.gamma.get(sp).copied().unwrap_or(0.0),
                    p_pa: ctx.gas_pa.get(sp).copied().unwrap_or(0.0),
                    avail: self.discovered_available(sp, ctx, gas_like),
                }
            })
            .collect();
        let rt = R_GAS * self.temperature_k.max(1.0);
        let ln_qk = |k: usize, delta: &[f64]| -> f64 {
            let mut ln_q = 0.0;
            for &(s, c) in &dense[k] {
                let st = &sp_state[s];
                let ln_a = match st.kind {
                    0 => 0.0,
                    1 => ctx.ln_aw,
                    2 => {
                        let mut p = st.p_pa;
                        if ctx.sealed {
                            p += delta[s] * rt / ctx.head_m3;
                        }
                        (p.max(1e-6) / crate::vle::P_BAR_PA).ln()
                    }
                    _ => ((st.n + delta[s]).max(1e-30) / ctx.solvent_kg).ln() + st.gamma,
                };
                ln_q += c * ln_a;
            }
            ln_q + items[k].0.delta_g0_j / rt
        };
        // 2. together: the net change of every species the reactions share, as one common scale (no species below zero)
        let net_of = |xi: &[f64], scale: f64| -> Vec<f64> {
            let mut net = vec![0.0; names.len()];
            for (k, x) in xi.iter().enumerate() {
                if *x <= 0.0 {
                    continue;
                }
                for &(s, c) in &dense[k] {
                    net[s] += c * x * scale;
                }
            }
            net
        };
        // the largest scale (<= 1) at which no species the reactions consume falls below zero
        let availability_scale = |xi: &[f64]| -> f64 {
            let net = net_of(xi, 1.0);
            let mut scale: f64 = 1.0;
            for (s, d) in net.iter().enumerate() {
                let have = sp_state[s].avail;
                if *d < 0.0 && have.is_finite() && -*d > have {
                    scale = scale.min((have / -*d).max(0.0));
                }
            }
            scale
        };
        let mut scale = availability_scale(&xi);
        // 3. no reaction may be driven past its own equilibrium by the others: the largest common scale at which none is
        // (bisection; the overshoot grows with the scale, so a few dozen evaluations find it to 1e-9). A reaction that the
        // others push past its equilibrium however small the step (it is at its own equilibrium already) would hold every
        // reaction back, so it sits this step out and the scale is found again for the rest.
        let overshoot_of = |xi: &[f64], sc: f64| -> Vec<f64> {
            let net = net_of(xi, sc);
            xi.iter().enumerate().map(|(k, x)| if *x > 1e-15 { ln_qk(k, &net) } else { f64::NEG_INFINITY }).collect()
        };
        let overshoots = |xi: &[f64], sc: f64| {
            let net = net_of(xi, sc);
            xi.iter().enumerate().any(|(k, x)| *x > 1e-15 && ln_qk(k, &net) > 1e-9)
        };
        let mut safe_scale = 0.0;
        for _ in 0..=items.len() {
            if !overshoots(&xi, scale) {
                break;
            }
            let (mut lo, mut hi) = (0.0, scale);
            for _ in 0..30 {
                let mid = 0.5 * (lo + hi);
                if overshoots(&xi, mid) {
                    hi = mid;
                } else {
                    lo = mid;
                }
            }
            safe_scale = lo;
            // The reaction pushed furthest past its equilibrium by the smallest scale that pushes any of them is found just above
            // the safe scale (below it nothing overshoots). A *trace* reaction (an extent a few percent of the biggest one's) that
            // sits at its equilibrium is pushed past it by any real progress of the others; it waits, and its reverse takes over
            // next step if the others moved its equilibrium (the reverse is a candidate of its own). Nothing small holds the big
            // reactions back. Among comparable reactions the old rule stays: a scale of at least 5 % is accepted, below it the
            // furthest one waits.
            let f = overshoot_of(&xi, hi);
            let worst = f.iter().enumerate().filter(|(_, v)| **v > 1e-9).max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal)).map(|(i, _)| i);
            let x_max = xi.iter().cloned().fold(0.0, f64::max);
            // every trace reaction pushed past its equilibrium at this scale waits at once (one search for all of them)
            let traces: Vec<usize> = f.iter().enumerate().filter(|(i, v)| **v > 1e-9 && xi[*i] <= 0.02 * x_max).map(|(i, _)| i).collect();
            if !traces.is_empty() {
                for i in traces {
                    xi[i] = 0.0;
                }
            } else {
                if lo >= 0.05 {
                    scale = lo;
                    break;
                }
                match worst {
                    Some(w) => xi[w] = 0.0,
                    None => {
                        scale = lo;
                        break;
                    }
                }
            }
            if xi.iter().all(|&x| x <= 1e-15) {
                return 0.0;
            }
            // the common scale of the shared species is found again for the reactions that remain
            scale = availability_scale(&xi);
        }
        if overshoots(&xi, scale) {
            // every reaction that overshoots had its turn to wait and some still do: take the largest safe common scale
            scale = safe_scale;
        }
        for x in xi.iter_mut() {
            *x *= scale;
        }
        // 4. apply: the net change of every species once (the common scale made it feasible; applying the reactions one
        // after another would clamp a species that a consumer empties before a producer refills it, and destroy atoms)
        let mut heat_j = 0.0;
        let vol_l = ctx.vol_l.max(0.001);
        let mut net: BTreeMap<String, f64> = BTreeMap::new();
        for ((rxn, _), extent) in items.iter().zip(&xi) {
            if *extent <= 1e-15 {
                continue;
            }
            for &(idx, coeff) in &rxn.nu {
                *net.entry(rxn.species_names[idx].clone()).or_default() += coeff * *extent;
            }
        }
        // what each species gains from the reactions that produce it (the solids' initial inventory counts only production)
        let mut produced: BTreeMap<String, f64> = BTreeMap::new();
        for ((rxn, _), extent) in items.iter().zip(&xi) {
            if *extent <= 1e-15 {
                continue;
            }
            for &(idx, coeff) in &rxn.nu {
                if coeff > 0.0 {
                    *produced.entry(rxn.species_names[idx].clone()).or_default() += coeff * *extent;
                }
            }
        }
        for (sp, change) in &net {
            if sp.ends_with("(s)") {
                let cur = self.solid_mol.entry(sp.clone()).or_insert(0.0);
                *cur = (*cur + change).max(0.0);
                if let Some(p) = produced.get(sp) {
                    *self.initial_solids.entry(sp.clone()).or_insert(0.0) += p;
                }
            } else if gas_like(sp) {
                self.release_gas(sp, *change, dt_s, nucleation);
            } else {
                let cur = self.species_mol.entry(sp.clone()).or_insert(0.0);
                *cur = (*cur + change).max(0.0);
            }
        }
        for ((rxn, _), extent) in items.iter().zip(&xi) {
            let extent = *extent;
            if extent <= 1e-15 {
                continue;
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
        if let (Some(p), DiscoveredRxnKind::Redox { z_electrons }) = (&rxn.partners, &rxn.kind) {
            if self.redox_partners.len() > 400 {
                self.redox_partners.clear();
            }
            // a disproportionation (2 Cu+ -> Cu + Cu2+) counts the electron once for each of its two roles
            let mut z = z_electrons.round().max(1.0) as u32;
            if p.donor == p.acceptor {
                z = (z / 2).max(1);
            }
            let n = |i: usize| rxn.species_names[i].clone();
            self.redox_partners.insert(eq_str.clone(), crate::vessel::RedoxRowInfo { donor: n(p.donor), donor_product: n(p.donor_product), acceptor: n(p.acceptor), acceptor_product: n(p.acceptor_product), electrons: z });
        }
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vessel::VesselConfig;

    fn beaker() -> Vessel {
        Vessel::new(VesselConfig {
            vessel_type: "beaker-250".into(),
            capacity_ml: 500.0,
            glass_mass_g: 110.0,
            inner_radius_cm: 3.5,
            temperature_k: Some(298.15),
            room_k: Some(298.15),
            sealed: Some(false),
            stopper_pop_atm: Some(1.0e4),
            burst_atm: Some(1.0e4),
        })
    }

    /// E1: the quotient of a discovered reaction uses molalities (the basis of the standard states and of the activity
    /// coefficients), not mol per litre of solution: in 5 m NaCl a litre holds 0.84 kg of water.
    #[test]
    fn discovered_quotients_are_molal() {
        let mut v = beaker();
        v.species_mol.insert("H2O".into(), 1000.0 / 18.01528);
        v.species_mol.insert("Na+".into(), 5.0);
        v.species_mol.insert("Cl-".into(), 5.0);
        v.species_mol.insert("A".into(), 1.0);
        v.species_mol.insert("B".into(), 1.0);
        let ctx = v.activity_context();
        assert!((ctx.solvent_kg - 1.0).abs() < 1e-6, "{}", ctx.solvent_kg);
        let vol_l = ctx.vol_l;
        assert!(vol_l > 1.1, "5 m NaCl occupies more than a litre per kg of water: {}", vol_l);
        // 2 A -> B with Delta_r G0 = 0
        let rxn = DiscoveredReaction {
            species_names: vec!["A".into(), "B".into()],
            nu: vec![(0, -2.0), (1, 1.0)],
            delta_h0_j: 0.0,
            delta_g0_j: 0.0,
            kind: DiscoveredRxnKind::Redox { z_electrons: 1.0 },
            partners: None,
        };
        let not_gas = |_: &str| false;
        let none = |_: &str| 0.0;
        let q = v.discovered_ln_q_minus_ln_k(&rxn, &ctx, &not_gas, &none);
        let g = |s: &str| ctx.gamma.get(s).copied().unwrap_or(0.0);
        let molal = (1.0f64 / 1.0).ln() - 2.0 * (1.0f64 / 1.0).ln() + g("B") - 2.0 * g("A");
        assert!((q - molal).abs() < 1e-9, "ln Q {} vs molal {}", q, molal);
        // the molar quotient would differ by ln(c_B / c_A^2) = ln(V) here
        assert!((q - (molal + vol_l.ln())).abs() > 0.1);
    }
}
