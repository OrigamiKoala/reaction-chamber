//! Electrochemistry of electrodes in a solution: corrosion and cementation (open-circuit mixed potential) and
//! electrolysis (applied voltage or current). One model serves both (master plan Stage 8 item 4 and Stage 11).
//!
//! **Half-reactions are discovered, not listed.** For every pair of species of the same element in different oxidation
//! states that the vessel (or the electrode material) can offer, the reduction `ox + n e- (+ H+, H2O) -> red` is balanced
//! from the species' formulas and charges, and its standard potential follows from the species' chemical potentials,
//! E0 = -dG0 / (n F), with mu0(e-) = 0 and mu0(H+) = 0 (the SHE scale). The Daniell cell, the metal activity series, the
//! 1.23 V of water splitting and the 1.36 V of chlorine all fall out of the same standard-state data.
//!
//! **Kinetics** are the mass-action Butler-Volmer form: `i_c = i0 prod a_ox^nu exp(-alpha_c f (E - E0))`,
//! `i_a = i0 prod a_red^nu exp(alpha_a f (E - E0))` with alpha_c + alpha_a = n, which reproduces the Nernst equation at
//! zero current for any n and activities (f = F / R T). Each branch is limited by the mass transport of its dissolved reactant (Koutecky-Levich with the stirring-dependent
//! k_m) and by the gas-blanketing current density `I_MAX_A_M2`.
//!
//! **The only per-material data** is the pair of small exchange-current tables of the hydrogen and oxygen evolution
//! reactions (Trasatti 1972; Conway & Bockris), keyed by the *electrode metal*, because no database covers them
//! (decision D3 of the master plan); every other couple takes a generic exchange current density labelled
//! speculative.

use crate::db::seed::{HYDROGEN_GAS, HYDROXIDE, OXYGEN_GAS, PROTON, WATER};
use crate::physics::{FARADAY, R_GAS};
use crate::thermo::functions::get_thermo_state;
use std::collections::{HashMap, HashSet};

/// Gas-blanketing / ohmic ceiling on the current density of any single electrode reaction, A/m2 (5 A/cm2: above this a
/// gas-evolving surface is covered by a film of gas).
pub const I_MAX_A_M2: f64 = 5.0e4;
/// Symmetry factor of the Butler-Volmer branches.
pub const ALPHA: f64 = 0.5;
/// Exchange current density of a couple with no tabulated value, A/m2 at unit activities (speculative: outer-sphere
/// couples and labile metal/ion couples span 1e-3 to 1e2 A/m2).
pub const I0_DEFAULT_A_M2: f64 = 1.0;
/// Fraction of its active dissolution current that a metal keeps when the passivating oxide / hydroxide film is stable
/// (passive current densities are 1e-3 to 1e-5 of the active ones).
pub const PASSIVE_FACTOR: f64 = 1e-3;
/// Smallest activity of a dissolved species used in a log (an absent species).
const A_FLOOR: f64 = 1e-14;

// ---------------------------------------------------------------------------------------------------- data tables

#[derive(Debug, serde::Deserialize)]
struct ElectrodeKineticsTable {
    /// log10 of the HER exchange current density, A/cm2, per electrode element (acid, ~1 M H+).
    her_log10_i0_a_cm2: HashMap<String, f64>,
    /// the same for the OER (oxide-covered surfaces).
    oer_log10_i0_a_cm2: HashMap<String, f64>,
    /// limiting ionic molar conductivities at 298.15 K, S cm2 / mol of the ion (CRC / Robinson & Stokes).
    limiting_conductivity_s_cm2_mol: HashMap<String, f64>,
}

fn table() -> &'static ElectrodeKineticsTable {
    static T: std::sync::OnceLock<ElectrodeKineticsTable> = std::sync::OnceLock::new();
    T.get_or_init(|| serde_json::from_str(include_str!("../../data/electrode_kinetics.json")).expect("electrode_kinetics.json"))
}

/// Limiting molar conductivity of an ion at 298.15 K (S cm2/mol), when tabulated.
pub fn limiting_conductivity_s_cm2_mol(species: &str) -> Option<f64> {
    table().limiting_conductivity_s_cm2_mol.get(species).copied()
}

/// Exchange current density (A/m2, unit activities) of the hydrogen evolution on an electrode element.
pub fn her_i0_a_m2(element: &str) -> Option<f64> {
    table().her_log10_i0_a_cm2.get(element).map(|l| 10f64.powf(*l) * 1e4)
}

pub fn oer_i0_a_m2(element: &str) -> Option<f64> {
    table().oer_log10_i0_a_cm2.get(element).map(|l| 10f64.powf(*l) * 1e4)
}

// -------------------------------------------------------------------------------------------- half-reactions

#[derive(Clone, Debug, PartialEq)]
pub struct HalfReaction {
    /// Species consumed in the reduction direction (coefficient > 0), electrons excluded.
    pub ox: Vec<(String, f64)>,
    /// Species produced in the reduction direction.
    pub red: Vec<(String, f64)>,
    pub n_e: f64,
    /// The redox element and the oxidation numbers on either side.
    pub element: String,
    pub ox_state: i32,
    pub red_state: i32,
    /// True when the stoichiometry is written with OH- / H2O (alkaline pathway) instead of H+ / H2O.
    pub alkaline: bool,
    /// The reduction would consume a gas (impossible: only dissolved species are reduced) -> cathodic branch disabled.
    pub cathodic_allowed: bool,
    pub anodic_allowed: bool,
}

impl HalfReaction {
    pub fn equation(&self) -> String {
        let side = |v: &Vec<(String, f64)>| -> String {
            v.iter()
                .map(|(s, c)| if (*c - 1.0).abs() < 1e-9 { s.clone() } else { format!("{} {}", fmt_coeff(*c), s) })
                .collect::<Vec<_>>()
                .join(" + ")
        };
        format!("{} + {} e- -> {}", side(&self.ox), fmt_coeff(self.n_e), side(&self.red))
    }

    /// Signature for de-duplication.
    fn signature(&self) -> String {
        let mut a: Vec<String> = self.ox.iter().map(|(s, c)| format!("{}:{:.3}", s, c)).collect();
        let mut b: Vec<String> = self.red.iter().map(|(s, c)| format!("{}:{:.3}", s, c)).collect();
        a.sort();
        b.sort();
        format!("{}->{}|{}", a.join(","), b.join(","), self.alkaline)
    }

    /// Standard potential (V vs SHE) at `t_k`, from the species' chemical potentials.
    pub fn e0(&self, t_k: f64, p_pa: f64) -> f64 {
        -self.delta_g0(t_k, p_pa) / (self.n_e * FARADAY)
    }

    /// Standard Gibbs energy of the reduction (J per mole of reaction).
    pub fn delta_g0(&self, t_k: f64, p_pa: f64) -> f64 {
        let mu = |sp: &str| get_thermo_state(sp, phase_of(sp), t_k, p_pa).mu0_j_mol;
        self.red.iter().map(|(s, c)| c * mu(s)).sum::<f64>() - self.ox.iter().map(|(s, c)| c * mu(s)).sum::<f64>()
    }

    /// Standard enthalpy of the reduction (J per mole of reaction).
    pub fn delta_h0(&self, t_k: f64, p_pa: f64) -> f64 {
        let h = |sp: &str| get_thermo_state(sp, phase_of(sp), t_k, p_pa).h_j_mol;
        self.red.iter().map(|(s, c)| c * h(s)).sum::<f64>() - self.ox.iter().map(|(s, c)| c * h(s)).sum::<f64>()
    }
}

fn fmt_coeff(c: f64) -> String {
    if (c - c.round()).abs() < 1e-9 { format!("{}", c.round() as i64) } else { format!("{:.2}", c) }
}

pub(crate) fn phase_of(sp: &str) -> &'static str {
    if sp.ends_with("(s)") {
        "s"
    } else if sp.ends_with("(g)") {
        "g"
    } else {
        "aq"
    }
}

fn is_solvent(sp: &str) -> bool {
    sp == WATER
}

fn gcd(a: i64, b: i64) -> i64 {
    if b == 0 { a.abs() } else { gcd(b, a % b) }
}

/// Balances `ox_sp + n e- (+ H+, H2O) -> red_sp` for the element `el` (acid scheme). None when the two species differ
/// in any other element or cannot be balanced with integer coefficients.
pub fn balance_half_acid(ox_sp: &str, red_sp: &str, el: &str) -> Option<HalfReaction> {
    let eo = crate::ions::species_elements(ox_sp)?;
    let er = crate::ions::species_elements(red_sp)?;
    let n_ox = *eo.get(el)?;
    let n_red = *er.get(el)?;
    if n_ox <= 0.0 || n_red <= 0.0 || (n_ox.fract().abs() > 1e-9) || (n_red.fract().abs() > 1e-9) {
        return None;
    }
    let (no, nr) = (n_ox.round() as i64, n_red.round() as i64);
    let g = gcd(no, nr);
    let (a, b) = ((nr / g) as f64, (no / g) as f64);
    // every element other than the redox element, H and O must balance as is
    for k in eo.keys().chain(er.keys()) {
        if k == el || k == "H" || k == "O" {
            continue;
        }
        let l = a * eo.get(k).copied().unwrap_or(0.0);
        let r = b * er.get(k).copied().unwrap_or(0.0);
        if (l - r).abs() > 1e-9 {
            return None;
        }
    }
    let (o_l, o_r) = (a * eo.get("O").copied().unwrap_or(0.0), b * er.get("O").copied().unwrap_or(0.0));
    let (mut w_l, mut w_r) = (0.0, 0.0);
    if o_l > o_r {
        w_r = o_l - o_r;
    } else {
        w_l = o_r - o_l;
    }
    let h_l = a * eo.get("H").copied().unwrap_or(0.0) + 2.0 * w_l;
    let h_r = b * er.get("H").copied().unwrap_or(0.0) + 2.0 * w_r;
    let (mut p_l, mut p_r) = (0.0, 0.0);
    if h_l > h_r {
        p_r = h_l - h_r;
    } else {
        p_l = h_r - h_l;
    }
    let q_l = a * crate::ions::species_charge(ox_sp) as f64 + p_l;
    let q_r = b * crate::ions::species_charge(red_sp) as f64 + p_r;
    let n_e = q_l - q_r;
    if n_e < 0.5 {
        return None; // not a reduction in this orientation
    }
    // cancel water and protons that appear on both sides
    let w = w_l.min(w_r);
    let (w_l, w_r) = (w_l - w, w_r - w);
    let p = p_l.min(p_r);
    let (p_l, p_r) = (p_l - p, p_r - p);
    let mut ox = vec![(ox_sp.to_string(), a)];
    let mut red = vec![(red_sp.to_string(), b)];
    if w_l > 0.0 {
        ox.push((WATER.to_string(), w_l));
    }
    if w_r > 0.0 {
        red.push((WATER.to_string(), w_r));
    }
    if p_l > 0.0 {
        ox.push((PROTON.to_string(), p_l));
    }
    if p_r > 0.0 {
        red.push((PROTON.to_string(), p_r));
    }
    // a species may be on both sides only through the redox pair itself (e.g. H+ <-> H2): merge the net
    let (ox, red) = merge_sides(ox, red);
    let sa = crate::gem::redox::determine_oxidation_states(ox_sp);
    let sb = crate::gem::redox::determine_oxidation_states(red_sp);
    Some(HalfReaction {
        ox_state: sa.get(el).copied().unwrap_or(0),
        red_state: sb.get(el).copied().unwrap_or(0),
        element: el.to_string(),
        n_e,
        alkaline: false,
        cathodic_allowed: !ox.iter().any(|(s, _)| s.ends_with("(g)")),
        anodic_allowed: !red.iter().any(|(s, _)| s.ends_with("(g)")),
        ox,
        red,
    })
}

fn merge_sides(ox: Vec<(String, f64)>, red: Vec<(String, f64)>) -> (Vec<(String, f64)>, Vec<(String, f64)>) {
    let mut net: HashMap<String, f64> = HashMap::new();
    for (s, c) in &ox {
        *net.entry(s.clone()).or_default() -= c;
    }
    for (s, c) in &red {
        *net.entry(s.clone()).or_default() += c;
    }
    let mut o = Vec::new();
    let mut r = Vec::new();
    let mut keys: Vec<_> = net.keys().cloned().collect();
    keys.sort();
    for k in keys {
        let v = net[&k];
        if v < -1e-9 {
            o.push((k, -v));
        } else if v > 1e-9 {
            r.push((k, v));
        }
    }
    (o, r)
}

/// The alkaline pathway of an acid-balanced half reaction: every H+ is replaced by H2O with an OH- on the other side.
pub fn alkaline_pathway(h: &HalfReaction) -> Option<HalfReaction> {
    let p_ox = h.ox.iter().find(|(s, _)| s == PROTON).map(|(_, c)| *c).unwrap_or(0.0);
    let p_red = h.red.iter().find(|(s, _)| s == PROTON).map(|(_, c)| *c).unwrap_or(0.0);
    if p_ox == 0.0 && p_red == 0.0 {
        return None;
    }
    let mut ox: Vec<(String, f64)> = h.ox.iter().filter(|(s, _)| s != PROTON).cloned().collect();
    let mut red: Vec<(String, f64)> = h.red.iter().filter(|(s, _)| s != PROTON).cloned().collect();
    if p_ox > 0.0 {
        ox.push((WATER.to_string(), p_ox));
        red.push((HYDROXIDE.to_string(), p_ox));
    }
    if p_red > 0.0 {
        red.push((WATER.to_string(), p_red));
        ox.push((HYDROXIDE.to_string(), p_red));
    }
    let (ox, red) = merge_sides(ox, red);
    let mut out = h.clone();
    out.ox = ox;
    out.red = red;
    out.alkaline = true;
    Some(out)
}

/// Discovers the half-reactions available among the species of a vessel. `present` are the species in the vessel (aqueous,
/// solid, gas ids); `extra_elements` are elements that electrode materials contribute. Candidate partners come from the
/// species store.
pub fn discover_half_reactions(present: &[String], extra_elements: &[String], t_k: f64) -> Vec<HalfReaction> {
    let mut elements: HashSet<String> = HashSet::new();
    for sp in present {
        if let Some(m) = crate::ions::species_elements(sp) {
            elements.extend(m.keys().cloned());
        }
    }
    elements.extend(extra_elements.iter().cloned());
    elements.insert("H".to_string());
    elements.insert("O".to_string());

    // candidate species from the store whose elements are all available
    let mut candidates: Vec<String> = Vec::new();
    if let Ok(store) = crate::db::SpeciesStore::global().read() {
        for rec in store.iter() {
            let el = rec.elements();
            if el.is_empty() || !el.keys().all(|e| elements.contains(e)) || el.get("C").copied().unwrap_or(0.0) > 1.0 {
                continue;
            }
            candidates.push(rec.id.clone());
        }
    }
    for sp in present {
        if !candidates.contains(sp) {
            candidates.push(sp.clone());
        }
    }
    candidates.sort();
    candidates.dedup();
    // a store species that the vessel does not hold and that is a metastable phase of another candidate (ice and steam at
    // room temperature, dissolved gas against the gas) is no electrode partner: the stable phase is
    let key_of = |sp: &str| -> String { format!("{}|{}", sp.trim_end_matches("(s)").trim_end_matches("(g)").trim_end_matches("(l)").trim_end_matches("(aq)"), crate::ions::species_charge(sp)) };
    let mut lowest: HashMap<String, f64> = HashMap::new();
    for c in &candidates {
        let mu = get_thermo_state(c, phase_of(c), t_k, 101_325.0).mu0_j_mol;
        let e = lowest.entry(key_of(c)).or_insert(f64::INFINITY);
        if mu < *e {
            *e = mu;
        }
    }
    candidates.retain(|c| {
        present.contains(c) || get_thermo_state(c, phase_of(c), t_k, 101_325.0).mu0_j_mol <= lowest[&key_of(c)] + 1e-6
    });

    // oxidation state of each candidate, per element
    let mut by_element: HashMap<String, Vec<(String, i32)>> = HashMap::new();
    for c in &candidates {
        if c == HYDROXIDE {
            continue; // OH- is a balancing species; the alkaline pathway is derived, not discovered
        }
        let states = crate::gem::redox::determine_oxidation_states(c);
        for (el, ox) in states {
            if el == "H" || el == "O" || elements.contains(&el) {
                by_element.entry(el).or_default().push((c.clone(), ox));
            }
        }
    }
    // only elements that a present species or an electrode actually carries can be redox partners
    let mut active: HashSet<String> = HashSet::new();
    for sp in present {
        if let Some(m) = crate::ions::species_elements(sp) {
            active.extend(m.keys().cloned());
        }
    }
    active.extend(extra_elements.iter().cloned());
    active.insert("H".to_string());
    active.insert("O".to_string());

    let mut out: Vec<HalfReaction> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for el in active {
        let list = match by_element.get(&el) {
            Some(l) => l,
            None => continue,
        };
        for (a, sa) in list {
            for (b, sb) in list {
                if sa <= sb {
                    continue; // a is the more oxidised
                }
                if (el == "H" || el == "O") && (is_solvent(a) && is_solvent(b)) {
                    continue;
                }
                // at least one partner must be present in the vessel (or be the electrode's own element)
                let a_present = present.contains(a) || a == WATER;
                let b_present = present.contains(b) || b == WATER;
                let own = extra_elements.contains(&el);
                if !(a_present || b_present || own) {
                    continue;
                }
                if let Some(h) = balance_half_acid(a, b, &el) {
                    if seen.insert(h.signature()) {
                        out.push(h.clone());
                    }
                    if let Some(alk) = alkaline_pathway(&h) {
                        if seen.insert(alk.signature()) {
                            out.push(alk);
                        }
                    }
                }
            }
        }
    }
    out
}

// ------------------------------------------------------------------------------------------------- electrodes

/// One conducting surface in contact with the solution.
#[derive(Clone, Debug)]
pub struct Electrode {
    pub id: String,
    /// Element symbol of the electrode material (selects the HER / OER exchange currents).
    pub element: String,
    pub area_m2: f64,
    /// The solid species the electrode itself can dissolve from ("Zn(s)"), if it is an active metal.
    pub active_species: Option<String>,
    /// A stable passivating film covers the surface (the metal's own dissolution is attenuated).
    pub passive: bool,
}

/// What the solution looks like to the electrodes.
pub struct ElectroCtx<'a> {
    pub t_k: f64,
    pub p_pa: f64,
    /// Activity of a species on the molar scale (aqueous), relative to the standard state; 1 for pure solids and the
    /// solvent, p / p0 for gases.
    pub activity: &'a dyn Fn(&str) -> f64,
    /// Bulk concentration (mol/m3) of a dissolved reactant; `f64::INFINITY` for solids, the solvent and gases.
    pub conc_mol_m3: &'a dyn Fn(&str) -> f64,
    /// Mass-transfer coefficient (m/s) of a dissolved species to a flat electrode.
    pub k_m: &'a dyn Fn(&str) -> f64,
    /// Whether a solid reactant exists at all.
    pub available: &'a dyn Fn(&str) -> bool,
    /// Amount (mol) of a solid reactant that a surface can draw on (`f64::INFINITY` for a macroscopic electrode's own
    /// material); a reaction cannot consume more than there is in the time step.
    pub solid_mol: &'a dyn Fn(&str, &Electrode) -> f64,
    /// The time step the currents will act for (s), and the total electrode area sharing the solid reactants (m2).
    pub dt_s: f64,
    pub total_area_m2: f64,
}

/// Exchange current density of a half-reaction on an electrode (A/m2), and whether it is tabulated.
pub fn exchange_current_a_m2(h: &HalfReaction, e: &Electrode) -> (f64, bool) {
    let is_her = h.red.iter().any(|(s, _)| s == HYDROGEN_GAS) || h.ox.iter().any(|(s, _)| s == HYDROGEN_GAS);
    let is_oer = h.ox.iter().any(|(s, _)| s == OXYGEN_GAS) || h.red.iter().any(|(s, _)| s == OXYGEN_GAS);
    if is_her {
        if let Some(i) = her_i0_a_m2(&e.element) {
            return (i, true);
        }
    }
    if is_oer {
        if let Some(i) = oer_i0_a_m2(&e.element) {
            return (i, true);
        }
        return (1e-6, false); // ~ 1e-10 A/cm2: sluggish on an unlisted surface
    }
    (I0_DEFAULT_A_M2, false)
}

/// Transfer coefficients (cathodic, anodic) of a half-reaction: they add up to the number of electrons so that the
/// rates reproduce the Nernst equation at zero current. A reaction that evolves a gas has its one-electron rate-
/// determining step in the evolving direction (0.5; the Volmer or Heyrovsky step of H2, the water-oxidation step of
/// O2, the Cl adsorption step of Cl2): Tafel slope 118 mV at 25 C. Everything else is symmetric, n / 2 each.
fn transfer_coefficients(h: &HalfReaction) -> (f64, f64) {
    let evolves_at_cathode = h.red.iter().any(|(s, _)| s.ends_with("(g)"));
    let evolves_at_anode = h.ox.iter().any(|(s, _)| s.ends_with("(g)"));
    if evolves_at_cathode {
        (ALPHA, h.n_e - ALPHA)
    } else if evolves_at_anode {
        (h.n_e - ALPHA, ALPHA)
    } else {
        (0.5 * h.n_e, 0.5 * h.n_e)
    }
}

/// Net oxidation current density (A/m2, positive = oxidation) of one half-reaction on one electrode at potential `e_v`,
/// together with the cathodic and anodic parts (both >= 0).
///
/// Mass-action rate of the overall electron-transfer step, with the transfer coefficients above:
/// `i_c = i0 prod a_ox^nu exp(-alpha_c f (E - E0))`, `i_a = i0 prod a_red^nu exp(alpha_a f (E - E0))`. The cathodic rate
/// depends only on the oxidised side and the anodic only on the reduced side; at E = E_Nernst they are equal.
pub fn channel_current(h: &HalfReaction, el: &Electrode, e_v: f64, ctx: &ElectroCtx) -> (f64, f64, f64) {
    let f = FARADAY / (R_GAS * ctx.t_k);
    let n = h.n_e;
    let act = |s: &str| (ctx.activity)(s).max(A_FLOOR);
    let mut prod_ox = 1.0;
    for (s, c) in &h.ox {
        prod_ox *= act(s).powf(*c);
    }
    let mut prod_red = 1.0;
    for (s, c) in &h.red {
        prod_red *= act(s).powf(*c);
    }
    let e0 = h.e0(ctx.t_k, ctx.p_pa);
    let (alpha_c, alpha_a) = transfer_coefficients(h);
    let (i0_ref, _) = exchange_current_a_m2(h, el);
    let own = el.active_species.as_deref();
    let dissolves_own = own.map_or(false, |s| h.red.iter().any(|(r, _)| r == s));
    let passivation = if dissolves_own && el.passive { PASSIVE_FACTOR } else { 1.0 };
    // the oxidising branch consumes the reduced side: a solid there is only oxidised on the electrode made of it
    let anodic_ok = h.anodic_allowed && h.red.iter().filter(|(s, _)| s.ends_with("(s)")).all(|(s, _)| own == Some(s.as_str()));
    // the reducing branch consumes the oxidised side: a solid there must exist
    let cathodic_ok = h.cathodic_allowed && h.ox.iter().filter(|(s, _)| s.ends_with("(s)")).all(|(s, _)| (ctx.available)(s));
    let dv = e_v - e0;
    let ex = |x: f64| x.clamp(-80.0, 80.0).exp();
    let mut i_a = if anodic_ok { i0_ref * passivation * prod_red * ex(alpha_a * f * dv) } else { 0.0 };
    let mut i_c = if cathodic_ok { i0_ref * prod_ox * ex(-alpha_c * f * dv) } else { 0.0 };
    // a solid reactant is used up: the current it can sustain over the step is n F amount / (nu dt A)
    let solid_cap = |side: &Vec<(String, f64)>, area: f64, own_only: bool| -> f64 {
        let mut cap = f64::INFINITY;
        for (s, c) in side.iter().filter(|(s, _)| s.ends_with("(s)")) {
            let amt = (ctx.solid_mol)(s, el);
            if amt.is_finite() {
                let a = if own_only { el.area_m2 } else { area };
                cap = cap.min(n * FARADAY * amt / (c * ctx.dt_s.max(1e-9) * a.max(1e-12)));
            }
        }
        cap
    };
    i_a = i_a.min(solid_cap(&h.red, ctx.total_area_m2, true));
    i_c = i_c.min(solid_cap(&h.ox, ctx.total_area_m2, false));
    // mass-transport limits of the dissolved reactants of each branch
    let lim = |side: &Vec<(String, f64)>| -> f64 {
        let mut l = I_MAX_A_M2;
        for (s, c) in side {
            let c_bulk = (ctx.conc_mol_m3)(s);
            if c_bulk.is_finite() {
                l = l.min(n * FARADAY * (ctx.k_m)(s) * c_bulk / c);
            }
        }
        l
    };
    let kl = |i: f64, l: f64| -> f64 {
        if i <= 0.0 { 0.0 } else { i * l / (i + l) }
    };
    i_c = kl(i_c, lim(&h.ox));
    i_a = kl(i_a, lim(&h.red));
    (i_a - i_c, i_c, i_a)
}

/// Net oxidation current (A) over the given electrodes at `e_v`, with the per-(half-reaction, electrode) breakdown.
pub fn net_current_a(electrodes: &[&Electrode], halves: &[HalfReaction], e_v: f64, ctx: &ElectroCtx, detail: Option<&mut Vec<ChannelFlow>>) -> f64 {
    let mut total = 0.0;
    let mut det = detail;
    for (ei, el) in electrodes.iter().enumerate() {
        for (hi, h) in halves.iter().enumerate() {
            let (net, ic, ia) = channel_current(h, el, e_v, ctx);
            total += net * el.area_m2;
            if let Some(d) = det.as_deref_mut() {
                if ic > 0.0 || ia > 0.0 {
                    d.push(ChannelFlow { half: hi, electrode: ei, net_oxidation_a: net * el.area_m2, cathodic_a: ic * el.area_m2, anodic_a: ia * el.area_m2 });
                }
            }
        }
    }
    total
}

#[derive(Clone, Debug)]
pub struct ChannelFlow {
    pub half: usize,
    pub electrode: usize,
    pub net_oxidation_a: f64,
    pub cathodic_a: f64,
    pub anodic_a: f64,
}

#[derive(Clone, Debug)]
pub struct PrecomputedChannel {
    pub half: usize,
    pub electrode: usize,
    pub area_m2: f64,
    pub anodic_ok: bool,
    pub cathodic_ok: bool,
    pub base_i_a: f64,
    pub base_i_c: f64,
    pub alpha_a_f: f64,
    pub alpha_c_f: f64,
    pub e0: f64,
    pub cap_red: f64,
    pub cap_ox: f64,
    pub lim_red: f64,
    pub lim_ox: f64,
}

impl PrecomputedChannel {
    pub fn new(h: &HalfReaction, hi: usize, el: &Electrode, ei: usize, ctx: &ElectroCtx) -> Self {
        let f = FARADAY / (R_GAS * ctx.t_k);
        let n = h.n_e;
        let act = |s: &str| (ctx.activity)(s).max(A_FLOOR);
        let mut prod_ox = 1.0;
        for (s, c) in &h.ox {
            prod_ox *= act(s).powf(*c);
        }
        let mut prod_red = 1.0;
        for (s, c) in &h.red {
            prod_red *= act(s).powf(*c);
        }
        let e0 = h.e0(ctx.t_k, ctx.p_pa);
        let (alpha_c, alpha_a) = transfer_coefficients(h);
        let (i0_ref, _) = exchange_current_a_m2(h, el);
        let own = el.active_species.as_deref();
        let dissolves_own = own.map_or(false, |s| h.red.iter().any(|(r, _)| r == s));
        let passivation = if dissolves_own && el.passive { PASSIVE_FACTOR } else { 1.0 };
        let anodic_ok = h.anodic_allowed && h.red.iter().filter(|(s, _)| s.ends_with("(s)")).all(|(s, _)| own == Some(s.as_str()));
        let cathodic_ok = h.cathodic_allowed && h.ox.iter().filter(|(s, _)| s.ends_with("(s)")).all(|(s, _)| (ctx.available)(s));

        let solid_cap = |side: &Vec<(String, f64)>, area: f64, own_only: bool| -> f64 {
            let mut cap = f64::INFINITY;
            for (s, c) in side.iter().filter(|(s, _)| s.ends_with("(s)")) {
                let amt = (ctx.solid_mol)(s, el);
                if amt.is_finite() {
                    let a = if own_only { el.area_m2 } else { area };
                    cap = cap.min(n * FARADAY * amt / (c * ctx.dt_s.max(1e-9) * a.max(1e-12)));
                }
            }
            cap
        };
        let cap_red = solid_cap(&h.red, ctx.total_area_m2, true);
        let cap_ox = solid_cap(&h.ox, ctx.total_area_m2, false);

        let lim = |side: &Vec<(String, f64)>| -> f64 {
            let mut l = I_MAX_A_M2;
            for (s, c) in side {
                let c_bulk = (ctx.conc_mol_m3)(s);
                if c_bulk.is_finite() {
                    l = l.min(n * FARADAY * (ctx.k_m)(s) * c_bulk / c);
                }
            }
            l
        };
        let lim_ox = lim(&h.ox);
        let lim_red = lim(&h.red);

        Self {
            half: hi,
            electrode: ei,
            area_m2: el.area_m2,
            anodic_ok,
            cathodic_ok,
            base_i_a: i0_ref * passivation * prod_red,
            base_i_c: i0_ref * prod_ox,
            alpha_a_f: alpha_a * f,
            alpha_c_f: alpha_c * f,
            e0,
            cap_red,
            cap_ox,
            lim_red,
            lim_ox,
        }
    }

    #[inline]
    pub fn current_at(&self, e_v: f64) -> (f64, f64, f64) {
        let dv = e_v - self.e0;
        let mut ia = if self.anodic_ok {
            let ea = (self.alpha_a_f * dv).clamp(-80.0, 80.0).exp();
            (self.base_i_a * ea).min(self.cap_red)
        } else {
            0.0
        };
        let mut ic = if self.cathodic_ok {
            let ec = (-self.alpha_c_f * dv).clamp(-80.0, 80.0).exp();
            (self.base_i_c * ec).min(self.cap_ox)
        } else {
            0.0
        };
        let kl = |i: f64, l: f64| -> f64 {
            if i <= 0.0 { 0.0 } else { i * l / (i + l) }
        };
        ic = kl(ic, self.lim_ox);
        ia = kl(ia, self.lim_red);
        (ia - ic, ic, ia)
    }
}

pub fn precompute_channels(electrodes: &[&Electrode], halves: &[HalfReaction], ctx: &ElectroCtx) -> Vec<PrecomputedChannel> {
    let mut channels = Vec::with_capacity(electrodes.len() * halves.len());
    for (ei, el) in electrodes.iter().enumerate() {
        for (hi, h) in halves.iter().enumerate() {
            channels.push(PrecomputedChannel::new(h, hi, el, ei, ctx));
        }
    }
    channels
}

#[inline]
pub fn fast_net_current_a(channels: &[PrecomputedChannel], e_v: f64) -> f64 {
    let mut total = 0.0;
    for ch in channels {
        let (net, _, _) = ch.current_at(e_v);
        total += net * ch.area_m2;
    }
    total
}

pub fn potential_for_current_fast(channels: &[PrecomputedChannel], current_a: f64) -> f64 {
    let (mut lo, mut hi) = (-6.0, 6.0);
    for _ in 0..45 {
        if hi - lo < 1e-8 {
            break;
        }
        let mid = 0.5 * (lo + hi);
        if fast_net_current_a(channels, mid) > current_a {
            hi = mid;
        } else {
            lo = mid;
        }
    }
    0.5 * (lo + hi)
}

/// Open-circuit mixed potential of all `electrodes` (electrically connected): the potential where the net current is zero.
pub fn solve_mixed_potential(electrodes: &[&Electrode], halves: &[HalfReaction], ctx: &ElectroCtx) -> (f64, Vec<ChannelFlow>) {
    let channels = precompute_channels(electrodes, halves, ctx);
    let (mut lo, mut hi) = (-4.5, 3.5);
    for _ in 0..50 {
        if hi - lo < 1e-8 {
            break;
        }
        let mid = 0.5 * (lo + hi);
        if fast_net_current_a(&channels, mid) > 0.0 {
            hi = mid;
        } else {
            lo = mid;
        }
    }
    let e = 0.5 * (lo + hi);
    let mut det = Vec::new();
    net_current_a(electrodes, halves, e, ctx, Some(&mut det));
    (e, det)
}

/// Potential of an electrode set carrying a prescribed net oxidation current (A, negative = reduction).
pub fn potential_for_current(electrodes: &[&Electrode], halves: &[HalfReaction], ctx: &ElectroCtx, current_a: f64) -> f64 {
    let channels = precompute_channels(electrodes, halves, ctx);
    potential_for_current_fast(&channels, current_a)
}

// ----------------------------------------------------------------------------------------------- electrolysis

/// How the supply drives the cell.
#[derive(Clone, Copy, Debug, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(tag = "mode", content = "value", rename_all = "snake_case")]
pub enum SupplyMode {
    /// Constant cell voltage (V).
    Voltage(f64),
    /// Constant current (A).
    Current(f64),
}

#[derive(Clone, Debug)]
pub struct ElectrolysisResult {
    pub current_a: f64,
    pub cell_voltage_v: f64,
    pub anode_potential_v: f64,
    pub cathode_potential_v: f64,
    pub ohmic_drop_v: f64,
    pub anode_flows: Vec<ChannelFlow>,
    pub cathode_flows: Vec<ChannelFlow>,
}

/// Solves an electrolysis cell: the supply mode, the anode and cathode surfaces, the solution resistance (ohm).
/// Voltage mode finds the current at which E_anode - E_cathode + I R equals the applied voltage.
pub fn solve_electrolysis(
    anode: &Electrode,
    cathode: &Electrode,
    halves: &[HalfReaction],
    ctx: &ElectroCtx,
    resistance_ohm: f64,
    mode: SupplyMode,
) -> ElectrolysisResult {
    let a = [anode];
    let c = [cathode];
    let a_channels = precompute_channels(&a, halves, ctx);
    let c_channels = precompute_channels(&c, halves, ctx);
    let cell = |i: f64| -> (f64, f64, f64) {
        let ea = potential_for_current_fast(&a_channels, i);
        let ec = potential_for_current_fast(&c_channels, -i);
        (ea, ec, ea - ec + i * resistance_ohm)
    };
    let i_cap = I_MAX_A_M2 * anode.area_m2.min(cathode.area_m2);
    let current = match mode {
        SupplyMode::Current(i) => i.max(0.0).min(i_cap.max(0.0)),
        SupplyMode::Voltage(v) => {
            let (_, _, v0) = cell(0.0);
            if v <= v0 {
                0.0
            } else {
                let (mut lo, mut hi) = (0.0, i_cap);
                for _ in 0..40 {
                    if hi - lo < 1e-7 * i_cap.max(1.0) {
                        break;
                    }
                    let mid = 0.5 * (lo + hi);
                    let v_mid = cell(mid).2;
                    if (v_mid - v).abs() < 1e-6 {
                        lo = mid;
                        hi = mid;
                        break;
                    }
                    if v_mid < v {
                        lo = mid;
                    } else {
                        hi = mid;
                    }
                }
                0.5 * (lo + hi)
            }
        }
    };
    let (ea, ec, v) = cell(current);
    let mut af = Vec::new();
    let mut cf = Vec::new();
    net_current_a(&a, halves, ea, ctx, Some(&mut af));
    net_current_a(&c, halves, ec, ctx, Some(&mut cf));
    ElectrolysisResult { current_a: current, cell_voltage_v: v, anode_potential_v: ea, cathode_potential_v: ec, ohmic_drop_v: current * resistance_ohm, anode_flows: af, cathode_flows: cf }
}

/// Conductivity (S/m) of a solution from its ions' limiting molar conductivities with the Kohlrausch-type attenuation
/// 1 / (1 + 0.5 sqrt(I)) and the Walden temperature scaling (kappa eta = const).
pub fn solution_conductivity_s_m(ions_mol_m3_and_species: &[(String, f64)], ionic_strength_mol_l: f64, t_k: f64) -> f64 {
    let mut sum = 0.0;
    for (sp, c) in ions_mol_m3_and_species {
        let z = crate::ions::species_charge(sp).abs() as f64;
        if z == 0.0 {
            continue;
        }
        // lambda per mole of ion; the table holds S cm2 per mole of the ion (already including its charge)
        let lam = limiting_conductivity_s_cm2_mol(sp).unwrap_or_else(|| {
            // Nernst-Einstein from a Stokes-Einstein diffusivity
            let d = crate::transfer::diffusion::species_diffusivity_water_m2_s(sp, 298.15);
            d * z * z * FARADAY * FARADAY / (R_GAS * 298.15) * 1e4
        });
        sum += c * lam * 1e-4;
    }
    let atten = 1.0 / (1.0 + 0.5 * ionic_strength_mol_l.max(0.0).sqrt());
    let walden = crate::transport::viscosity_water_pa_s(298.15) / crate::transport::viscosity_water_pa_s(t_k);
    sum * atten * walden
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn balances_hydrogen_and_oxygen_couples() {
        let her = balance_half_acid("H+", "H2(g)", "H").unwrap();
        assert_eq!(her.n_e, 2.0);
        let oer = balance_half_acid("O2(g)", "H2O", "O").unwrap();
        assert_eq!(oer.n_e, 4.0);
        assert!(oer.ox.iter().any(|(s, c)| s == "H+" && (*c - 4.0).abs() < 1e-9));
        let e_her = her.e0(298.15, 101325.0);
        let e_oer = oer.e0(298.15, 101325.0);
        assert!(e_her.abs() < 0.01, "HER E0 = {}", e_her);
        assert!((e_oer - 1.229).abs() < 0.02, "OER E0 = {}", e_oer);
    }

    #[test]
    fn standard_potentials_follow_from_formation_data() {
        let zn = balance_half_acid("Zn+2", "Zn(s)", "Zn").unwrap();
        assert!((zn.e0(298.15, 101325.0) + 0.762).abs() < 0.02);
        let cu = balance_half_acid("Cu+2", "Cu(s)", "Cu").unwrap();
        assert!((cu.e0(298.15, 101325.0) - 0.342).abs() < 0.02);
        let fe = balance_half_acid("Fe+3", "Fe+2", "Fe").unwrap();
        assert!((fe.e0(298.15, 101325.0) - 0.771).abs() < 0.03);
    }

    #[test]
    fn alkaline_pathway_has_the_same_potential() {
        let her = balance_half_acid("H+", "H2(g)", "H").unwrap();
        let alk = alkaline_pathway(&her).unwrap();
        assert!(alk.alkaline && alk.red.iter().any(|(s, _)| s == "OH-"));
        // the potential differs by the Kw term at unit activities: -0.828 V
        assert!((alk.e0(298.15, 101325.0) + 0.828).abs() < 0.02, "{}", alk.e0(298.15, 101325.0));
    }

    #[test]
    fn conductivity_of_salt_water() {
        // 0.1 M NaCl: measured 10.7 mS/cm
        let ions = vec![("Na+".to_string(), 100.0), ("Cl-".to_string(), 100.0)];
        let k = solution_conductivity_s_m(&ions, 0.1, 298.15);
        assert!(k > 0.9 && k < 1.3, "kappa = {} S/m", k);
    }
}
