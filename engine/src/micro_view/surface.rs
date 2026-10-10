//! Reactions on a surface and across a phase boundary, for the molecular viewer (docs/plans/reaction-viewer-plan.md, 4.3 and
//! 4.5; stage R4): precipitation and dissolution of a solid, electrode half-reactions, the metal / solution pairs of a corroding
//! or cementing metal, thermal decomposition of a solid, evaporation / condensation / Henry exchange / boiling, and combustion.
//!
//! - **Lattice.** A solid has a surface in the box when the engine can say what it is made of: the ions of a mineral record
//!   (`dissolved_products`), the ions of an ionic formula, or the atoms of an element. `micro_lattice` returns that composition
//!   with the ion radii; the viewer lays the schematic packing (the plan, 4.5: a real crystal structure needs crystallographic
//!   data and is out of scope for v1).
//! - **Surface reactions.** A reaction with a solid on a side is split from its atom map into the parts that happen *in the
//!   lattice* (a slab atom or ion leaves and becomes a dissolved or gas species: `SurfaceLeave`; dissolved ions dock and become
//!   a slab occupant: `SurfaceJoin`; a solid product that stays where the reactant solid was: `residue`) and the rest, the
//!   dissolved and gas species that react next to the surface, which is an ordinary mapped morph (`SurfaceDesc::morph`).
//! - **Rates.** Dissolution and precipitation of a mineral exchange across the particle surface in the film-limited form the
//!   engine's own transfer step uses (`vessel_transfer.rs`): dissolution `k A c_sat` and precipitation `k A c` in mol of formula
//!   units per second, their difference being the engine's `k A (c_sat - c)`. Electrode rows run at the Faraday extent of the
//!   half-reaction; decompositions at the extent the Gibbs discovery applied. Phase transfers use the gross exchange rates the
//!   steps record (`MicroTransfer`), combustion the burning rate of each fuel.

use super::*;
use crate::transfer::population;

// ------------------------------------------------------------------------------------------------ descriptions

/// A slab occupant that leaves the lattice and the dissolved / gas species it becomes.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct SurfaceLeave {
    pub occupant: String,
    pub becomes: Vec<String>,
}

/// Dissolved species that dock at the lattice and the occupant they become.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct SurfaceJoin {
    pub takes: Vec<String>,
    pub occupant: String,
}

/// What a reaction does at a solid surface. Read forward; a reverse event swaps leaves and joins (the viewer does that).
#[derive(Serialize, Clone, Debug)]
pub struct SurfaceDesc {
    /// The solid whose lattice the slab is (a mineral, a metal, an electrode material), as a species id `X(s)`.
    pub slab: String,
    /// "mineral" | "metal" | "electrode" | "none" (no lattice can be drawn for the slab species)
    pub slab_kind: String,
    /// "anode" | "cathode" for an electrode half-reaction: the electrode it happens at.
    pub electrode: Option<String>,
    /// The half-reaction gives electrons to the electrode (an oxidation). Usually the anode's, but a film on an anode can be reduced.
    pub oxidation: bool,
    pub leaves: Vec<SurfaceLeave>,
    pub joins: Vec<SurfaceJoin>,
    /// Solid products that stay on the surface in place of a reactant solid (a decomposition leaves its oxide behind).
    pub residue: Vec<String>,
    /// The dissolved and gas species that react at the surface (H+ turning into H2 at a cathode), mapped atom by atom.
    pub morph: Option<Box<MicroDescription>>,
}

/// What a solid is made of, for the viewer's schematic lattice.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct LatticeIon {
    pub species: String,
    pub count: u32,
    pub radius_a: f64,
    pub charge: i32,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct LatticeDesc {
    pub species: String,
    /// "mineral" (ions of a mineral record) | "salt" (ions of the formula) | "metal" (one element)
    pub kind: String,
    pub ions: Vec<LatticeIon>,
    pub source: String,
}

fn is_solid(s: &str) -> bool {
    s.ends_with("(s)")
}

/// Species of a row as a list of molecules, any phase, whole-number coefficients up to 8, at most `max` molecules.
fn expand_any(map: &HashMap<String, f64>, max: usize) -> Option<Vec<String>> {
    let mut keys: Vec<&String> = map.keys().collect();
    keys.sort();
    let mut out = Vec::new();
    for k in keys {
        let c = map[k];
        if (c - c.round()).abs() > 1e-9 || !(1.0..=8.0).contains(&c) {
            return None;
        }
        for _ in 0..(c.round() as usize) {
            out.push(k.clone());
        }
    }
    if out.is_empty() || out.len() > max {
        return None;
    }
    Some(out)
}

/// Scales a reaction whose coefficients are halves to whole numbers (`O2 + 4 H+ + 4 e- -> 2 H2O` has none; `0.5 O2` does).
fn integerise(l: &HashMap<String, f64>, r: &HashMap<String, f64>, e: f64) -> Option<(HashMap<String, f64>, HashMap<String, f64>, f64, f64)> {
    let all: Vec<f64> = l.values().chain(r.values()).copied().chain(std::iter::once(e.abs())).collect();
    for scale in [1.0, 2.0, 4.0] {
        if all.iter().all(|c| ((c * scale) - (c * scale).round()).abs() < 1e-9) {
            let f = |m: &HashMap<String, f64>| m.iter().map(|(k, c)| (k.clone(), (c * scale).round())).collect::<HashMap<_, _>>();
            return Some((f(l), f(r), (e * scale).round(), scale));
        }
    }
    None
}

/// Splits a reaction that has a solid on a side into its lattice parts and the rest (see the module documentation). None when a
/// product mixes atoms of a solid and of a dissolved reactant (the reaction then is not one lattice event), or when what is left
/// has no description of its own.
pub(super) fn split_surface(d: &MicroDescription, slab: Option<&str>, electrode: Option<&str>, lattice_kind: &dyn Fn(&str) -> Option<String>, hint: &dyn Fn(&str) -> Option<String>) -> Option<SurfaceDesc> {
    let n_r = d.reactants.len();
    let n_p = d.products.len();
    if d.atom_map.len() != n_p {
        return None;
    }
    let origin: Vec<BTreeSet<usize>> = d.atom_map.iter().map(|row| row.iter().map(|o| o[0]).collect()).collect();
    let mut used_r = vec![false; n_r];
    let mut used_p = vec![false; n_p];
    let mut leaves = Vec::new();
    let mut residue = Vec::new();
    for m in (0..n_r).filter(|&m| is_solid(&d.reactants[m])) {
        used_r[m] = true;
        let mut becomes = Vec::new();
        for p in 0..n_p {
            if used_p[p] || !origin[p].contains(&m) {
                continue;
            }
            // a product made of atoms of a solid and of a dissolved reactant is not a lattice event
            if origin[p].iter().any(|&q| !is_solid(&d.reactants[q])) {
                return None;
            }
            used_p[p] = true;
            if is_solid(&d.products[p]) {
                residue.push(d.products[p].clone());
            } else {
                becomes.push(d.products[p].clone());
            }
        }
        leaves.push(SurfaceLeave { occupant: d.reactants[m].clone(), becomes });
    }
    let mut joins = Vec::new();
    for p in 0..n_p {
        if !is_solid(&d.products[p]) || used_p[p] {
            continue;
        }
        used_p[p] = true;
        let mut takes = Vec::new();
        for &q in &origin[p] {
            if is_solid(&d.reactants[q]) {
                return None;
            }
            if used_r[q] {
                return None;
            }
            used_r[q] = true;
            takes.push(d.reactants[q].clone());
        }
        joins.push(SurfaceJoin { takes, occupant: d.products[p].clone() });
    }
    if leaves.is_empty() && joins.is_empty() && !d.reactants.iter().chain(d.products.iter()).any(|s| is_solid(s)) && slab.is_none() {
        return None;
    }
    let rest_r: Vec<String> = (0..n_r).filter(|&i| !used_r[i]).map(|i| d.reactants[i].clone()).collect();
    let rest_p: Vec<String> = (0..n_p).filter(|&i| !used_p[i]).map(|i| d.products[i].clone()).collect();
    let morph = if rest_r.is_empty() && rest_p.is_empty() {
        None
    } else if rest_r.is_empty() || rest_p.is_empty() {
        return None;
    } else {
        // the electrons of the surface (or the lattice parts) make up the charge difference of what is left
        let charge = |l: &[String]| -> i32 { l.iter().map(|s| structure3d::for_species(s, hint(s).as_deref()).charge).sum() };
        let dq = charge(&rest_p) - charge(&rest_r);
        let mut m = describe_skeleton_dq("surface_morph", rest_r, rest_p, hint, dq)?;
        m.electrons = 0;
        Some(Box::new(m))
    };
    let slab_id = slab.map(str::to_string).or_else(|| leaves.first().map(|l| l.occupant.clone())).or_else(|| joins.first().map(|j| j.occupant.clone()))?;
    let slab_kind = if electrode.is_some() { "electrode".to_string() } else { lattice_kind(&slab_id).unwrap_or_else(|| "none".into()) };
    Some(SurfaceDesc { slab: slab_id, slab_kind, electrode: electrode.map(str::to_string), oxidation: false, leaves, joins, residue, morph })
}

// ------------------------------------------------------------------------------------------------ lattice

/// The composition of the lattice of a solid given the mineral records (see `Vessel::micro_lattice`).
pub fn lattice_of(solid: &str, minerals: &[crate::chem_db::GeneralMineral]) -> Option<LatticeDesc> {
    let radius = |ion: &str| crate::crystal::ionic_radius_angstrom(ion).unwrap_or(1.5);
    if let Some(m) = minerals.iter().find(|m| m.solid_species == solid) {
        let mut ions = Vec::new();
        for (ion, &c) in &m.dissolved_products {
            let n = c.round();
            if n < 1.0 || (c - n).abs() > 1e-9 {
                return None;
            }
            ions.push(LatticeIon { species: ion.clone(), count: n as u32, radius_a: radius(ion), charge: crate::ions::species_charge(ion) });
        }
        ions.sort_by(|a, b| b.charge.cmp(&a.charge).then(a.species.cmp(&b.species)));
        if ions.is_empty() {
            return None;
        }
        return Some(LatticeDesc { species: solid.into(), kind: "mineral".into(), ions, source: format!("ions of the mineral record {}", m.mineral) });
    }
    let body = solid.trim_end_matches("(s)");
    let elems = crate::ions::parse_formula_strict(body)?;
    if elems.len() == 1 {
        let (el, &n) = elems.iter().next()?;
        if (n - 1.0).abs() > 1e-9 || structure3d::data::element(el).is_none() {
            return None;
        }
        // the metallic radius is approximated by the covalent radius; a light non-metal (graphite) gets a floor
        let r = structure3d::data::covalent_radius(el, 1.0).max(1.1);
        return Some(LatticeDesc { species: solid.into(), kind: "metal".into(), ions: vec![LatticeIon { species: solid.into(), count: 1, radius_a: r, charge: 0 }], source: "atoms of the element, covalent radius".into() });
    }
    let split = crate::ions::decompose_ionic(body)?;
    let mut ions = Vec::new();
    for ic in split.all() {
        let n = ic.n.round();
        if n < 1.0 || (ic.n - n).abs() > 1e-9 {
            return None;
        }
        ions.push(LatticeIon { species: ic.id.clone(), count: n as u32, radius_a: radius(&ic.id), charge: ic.charge });
    }
    ions.sort_by(|a, b| b.charge.cmp(&a.charge).then(a.species.cmp(&b.species)));
    Some(LatticeDesc { species: solid.into(), kind: "salt".into(), ions, source: "ions of the formula (no mineral record)".into() })
}

/// Kind of lattice a solid has by the default mineral records (a description made without a vessel).
pub(super) fn surface_lattice_kind(solid: &str) -> Option<String> {
    lattice_of(solid, &crate::chem_db::get_default_minerals()).map(|l| l.kind)
}

impl Vessel {
    /// The composition of the lattice of a solid, or None when the engine cannot say what it is made of (a molecular solid, an
    /// unknown formula). Minerals use their record's ions; an ionic formula its split into ions; an element its atoms.
    pub fn micro_lattice(&self, solid: &str) -> Option<LatticeDesc> {
        lattice_of(solid, &self.minerals)
    }

    fn lattice_kind(&self, solid: &str) -> Option<String> {
        self.micro_lattice(solid).map(|l| l.kind)
    }

    // -------------------------------------------------------------------------------------------- mineral exchange
    /// Precipitation / dissolution of every mineral that has a solid in the vessel: `solid <=> ions`, in mol of formula units per
    /// second of the whole vessel. The forward direction is dissolution.
    pub(super) fn mineral_rows(&self, layer: usize) -> Vec<MicroReaction> {
        let mut out = Vec::new();
        let vol_l = (self.solvent_volume_ml() / 1000.0).max(1e-12);
        let (mut gamma, _) = crate::activity::batch_aqueous_gamma_and_aw(&self.species_mol, self.temperature_k);
        self.apply_mixed_solvent_born(&mut gamma);
        let h = self.hydro_state();
        let t = self.temperature_k;
        for m in &self.minerals {
            let sp = &m.solid_species;
            if m.dissolved_products.is_empty() || self.solid_mol.get(sp).copied().unwrap_or(0.0) <= 1e-15 {
                continue;
            }
            let Some(pop) = self.particle_populations.get(sp) else { continue };
            let area = pop.surface_area_m2();
            if !(area > 0.0) {
                continue;
            }
            let Some(lat) = self.micro_lattice(sp) else { continue };
            let ions: Vec<String> = lat.ions.iter().flat_map(|i| std::iter::repeat(i.species.clone()).take(i.count as usize)).collect();
            if ions.len() > 8 {
                continue;
            }
            // formula-unit concentration at saturation (activities in) and now (concentrations only), mol/m3
            let nu_tot: f64 = m.dissolved_products.values().sum();
            let nu_prod: f64 = m.dissolved_products.values().map(|c| c * c.ln()).sum();
            let ln_ksp = m.log_ksp_at(t) * std::f64::consts::LN_10;
            let ln_gamma_sum: f64 = m.dissolved_products.iter().map(|(i, c)| c * gamma.get(i).copied().unwrap_or(0.0)).sum();
            let c_sat = ((ln_ksp - ln_gamma_sum - nu_prod) / nu_tot).exp() * 1000.0;
            let mut ln_conc = 0.0;
            let mut present = true;
            for (ion, &c) in &m.dissolved_products {
                let n = self.species_mol.get(ion).copied().unwrap_or(0.0);
                if n <= 0.0 {
                    present = false;
                    break;
                }
                ln_conc += c * (n / vol_l).ln();
            }
            let c_now = if present { ((ln_conc - nu_prod) / nu_tot).exp() * 1000.0 } else { 0.0 };
            let diff = self.solid_diffusivity(sp);
            let k = population::effective_transfer_coefficient(self.film_coefficient(sp, pop.sauter_diameter_m(), diff, &h));
            let (fwd, rev) = (k * area * c_sat, k * area * c_now);
            let leaves: Vec<SurfaceLeave> = ions.iter().map(|i| SurfaceLeave { occupant: i.clone(), becomes: vec![i.clone()] }).collect();
            let surface = SurfaceDesc { slab: sp.clone(), slab_kind: lat.kind.clone(), electrode: None, oxidation: false, leaves, joins: Vec::new(), residue: Vec::new(), morph: None };
            let mut d = MicroDescription::new("dissolution", None, vec![sp.clone()], ions.clone(), Vec::new(), Vec::new(), false);
            d.surface = Some(surface);
            let equation = format!("{} <=> {}", sp, ions.join(" + "));
            out.push(row_of(&format!("solid_{}", sp), &equation, layer, Some(&d), &HashMap::new(), &HashMap::new(), fwd, rev, "film-limited exchange of the particle surface, k A c_sat and k A c (vessel_transfer.rs)", true));
        }
        out
    }

    // -------------------------------------------------------------------------------------------- electrodes
    /// Half-reactions at the electrodes of a powered cell, one row each, at the Faraday extent per second.
    pub(super) fn electrode_rows(&self, layer: usize, hint: &dyn Fn(&str) -> Option<String>) -> Vec<MicroReaction> {
        let mut out = Vec::new();
        let Some(spec) = self.electro.spec.as_ref() else { return out };
        let lattice_kind = |s: &str| self.lattice_kind(s);
        for row in self.micro_electrodes.iter().filter(|r| r.rate_mol_s > 0.0) {
            let Some((l, r, e)) = parse_half_reaction(&row.equation) else { continue };
            let Some((l, r, e, scale)) = integerise(&l, &r, e) else { continue };
            let anodic = e > 0.0;
            let which = row.electrode;
            let material = if anodic { &spec.anode.material } else { &spec.cathode.material };
            let slab = format!("{}(s)", material.trim().trim_end_matches("(s)"));
            let pretty = |l: &HashMap<String, f64>, r: &HashMap<String, f64>| -> String {
                let side = |m: &HashMap<String, f64>| -> String {
                    let mut v: Vec<(&String, &f64)> = m.iter().collect();
                    v.sort_by(|a, b| a.0.cmp(b.0));
                    v.iter().map(|(k, c)| if (**c - 1.0).abs() < 1e-9 { (*k).clone() } else { format!("{} {}", c, k) }).collect::<Vec<_>>().join(" + ")
                };
                format!("{} -> {}", side(l), side(r))
            };
            let n_e = e.abs().round() as u32;
            let equation = format!("{} ({} e-, {})", pretty(&l, &r), n_e, which);
            let desc = (|| {
                let rr = expand_any(&l, 8)?;
                let pp = expand_any(&r, 8)?;
                let mut d = describe_skeleton_dq("electrode", rr, pp, hint, if anodic { n_e as i32 } else { -(n_e as i32) })?;
                d.electrons = n_e;
                let mut sd = split_surface(&d, Some(&slab), Some(which), &lattice_kind, hint)?;
                sd.oxidation = anodic;
                d.surface = Some(sd);
                Some(d)
            })();
            out.push(row_of(&format!("electrode_{}|{}", which, pretty(&l, &r)), &equation, layer, desc.as_ref(), &l, &r, row.rate_mol_s / scale, 0.0, "Faraday extent of the electrode half-reaction (Butler-Volmer, vessel_electro.rs)", false));
        }
        out
    }

    // -------------------------------------------------------------------------------------------- decomposition
    /// Thermal decompositions of solids that the Gibbs discovery ran in the last step.
    pub(super) fn decomposition_rows(&self, layer: usize, hint: &dyn Fn(&str) -> Option<String>) -> Vec<MicroReaction> {
        let mut out = Vec::new();
        let lattice_kind = |s: &str| self.lattice_kind(s);
        for row in self.active_reactions.iter().filter(|r| r.kind == "thermal_decomposition" && r.rate > 0.0) {
            let Some((l, r)) = parse_signed_equation(&row.equation) else { continue };
            let desc = (|| {
                let rr = expand_any(&l, 6)?;
                let pp = expand_any(&r, 6)?;
                let mut d = describe_skeleton("decomposition", rr, pp, hint)?;
                // the atoms are assigned by element: the real mechanism is a solid-state process
                d.schematic_mapping = true;
                d.surface = Some(split_surface(&d, None, None, &lattice_kind, hint)?);
                Some(d)
            })();
            let pretty = format!("{} -> {}", expand_any(&l, 99).map(|v| v.join(" + ")).unwrap_or_default(), expand_any(&r, 99).map(|v| v.join(" + ")).unwrap_or_default());
            out.push(row_of(&row.id, &pretty, layer, desc.as_ref(), &l, &r, row.rate, 0.0, "extent per second of the discovered decomposition (solid-state Arrhenius, gem/rates.rs)", false));
        }
        out
    }

    // -------------------------------------------------------------------------------------------- phase transfer
    /// Evaporation, condensation, Henry exchange and boiling recorded by the last step. `phase` selects the liquid phase whose
    /// molecules cross (None: all of them, the gas side's view).
    pub(super) fn transfer_rows(&self, phase: Option<usize>) -> Vec<MicroReaction> {
        let mut merged: Vec<MicroTransfer> = Vec::new();
        for t in &self.micro_transfers {
            if phase.map_or(false, |p| p != t.phase) {
                continue;
            }
            match merged.iter_mut().find(|m| m.liquid == t.liquid && m.gas == t.gas && m.origin == t.origin && m.phase == t.phase) {
                Some(m) => {
                    m.forward += t.forward;
                    m.reverse += t.reverse;
                }
                None => merged.push(t.clone()),
            }
        }
        let mut out = Vec::new();
        for t in merged {
            if t.forward + t.reverse <= 0.0 {
                continue;
            }
            let (ls, gs) = (structure3d::for_species(&t.liquid, self.smiles_of(Some(&t.liquid)).as_deref()), structure3d::for_species(&t.gas, self.smiles_of(Some(&t.gas)).as_deref()));
            if ls.source == "placeholder" || gs.source == "placeholder" || ls.atoms.len() != gs.atoms.len() {
                continue;
            }
            let atom_map = vec![(0..gs.atoms.len()).map(|i| [0usize, i]).collect::<Vec<_>>()];
            let d = MicroDescription::new("phase_transfer", None, vec![t.liquid.clone()], vec![t.gas.clone()], atom_map, Vec::new(), false);
            let source = match t.origin {
                "evaporation" => "evaporation and condensation at the free surface (mass-transfer coefficient of vessel_vle.rs)",
                "boiling" => "boiling: vapour leaving at the bubble point (vessel_vle.rs)",
                _ => "Henry exchange across the free surface (k_L a, vessel_vle.rs)",
            };
            let equation = format!("{} <=> {}", t.liquid, t.gas);
            out.push(row_of(&format!("transfer_{}_{}_{}", t.origin, t.liquid, t.gas), &equation, t.phase, Some(&d), &HashMap::new(), &HashMap::new(), t.forward, t.reverse, source, true));
        }
        out
    }

    // -------------------------------------------------------------------------------------------- combustion
    /// The fuels that burned in the last step, as one reaction each in the gas phase: fuel vapour + O2 -> CO2 + H2O (+ N2). A
    /// fuel whose balanced equation needs more than 8 molecules on a side is listed without a map.
    pub(super) fn combustion_rows(&self, hint: &dyn Fn(&str) -> Option<String>) -> Vec<MicroReaction> {
        use crate::db::seed::{CARBON_DIOXIDE_GAS, NITROGEN_GAS, OXYGEN_GAS, WATER_VAPOUR};
        let mut out = Vec::new();
        for (fuel, mol_s) in &self.micro_burns {
            let Some(el) = crate::ions::species_elements(fuel) else { continue };
            let Some(vol) = self.volatile_for(fuel) else { continue };
            let (c, h, n, o) = (el.get("C").copied().unwrap_or(0.0), el.get("H").copied().unwrap_or(0.0), el.get("N").copied().unwrap_or(0.0), el.get("O").copied().unwrap_or(0.0));
            let o2 = c + 0.25 * h - 0.5 * o;
            let mut co = [(vol.gas_id.clone(), 1.0), (OXYGEN_GAS.to_string(), o2)];
            let mut prod = [(CARBON_DIOXIDE_GAS.to_string(), c), (WATER_VAPOUR.to_string(), 0.5 * h), (NITROGEN_GAS.to_string(), 0.5 * n)];
            let scale = [1.0, 2.0, 4.0].into_iter().find(|s| co.iter().chain(prod.iter()).all(|(_, x)| ((x * s) - (x * s).round()).abs() < 1e-9));
            let fuel_gas = vol.gas_id.clone();
            let side = |v: &[(String, f64)], s: f64| -> HashMap<String, f64> { v.iter().filter(|(_, x)| *x > 1e-12).map(|(k, x)| (k.clone(), (x * s).round())).collect() };
            let Some(scale) = scale else { continue };
            for x in co.iter_mut() { x.1 *= scale; }
            for x in prod.iter_mut() { x.1 *= scale; }
            let (l, r) = (side(&co, 1.0), side(&prod, 1.0));
            let equation = format!("{} -> {}", expand_any(&l, 99).map(|v| v.join(" + ")).unwrap_or_default(), expand_any(&r, 99).map(|v| v.join(" + ")).unwrap_or_default());
            let fuel_for_hint = fuel.clone();
            let hint2 = |s: &str| if s == fuel_gas { hint(&fuel_for_hint) } else { hint(s) };
            let desc = (|| {
                let rr = expand_any(&l, 8)?;
                let pp = expand_any(&r, 8)?;
                let mut d = describe_skeleton("combustion", rr, pp, &hint2)?;
                // one step standing for a radical chain mechanism
                d.schematic_mapping = true;
                Some(d)
            })();
            out.push(row_of(&format!("burn_{}", fuel), &equation, 0, desc.as_ref(), &l, &r, mol_s / scale, 0.0, "pool burning rate of the fuel (transfer/combustion.rs)", false));
        }
        out
    }
}

