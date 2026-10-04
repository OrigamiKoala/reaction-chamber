//! M6/Stage 9 Chemical Reaction Network Generator.
//! Structure-based reaction network generation using atom-mapped Molecule graphs,
//! dynamic Arrhenius kinetics ($A, E_a$) recomputed each tick, thermodynamic detailed balance,
//! automatic Hill formula and SMILES product registration in SpeciesStore,
//! and strict element and charge conservation assertions.

use std::collections::{HashMap, HashSet, VecDeque};
use serde::{Deserialize, Serialize};

use crate::types::ProvenanceTier;
use crate::smiles::{self, Atom, Molecule};
use crate::templates::{self, Medium, ReactionFamily, R_IDEAL, apply_diffusion_cap};

pub const DEFAULT_MAX_ACTIVE_SPECIES: usize = 200;
pub const DEFAULT_MAX_REACTIONS: usize = 500;
pub const DEFAULT_FLUX_THRESHOLD_ABS: f64 = 1.0e-11; // M/s

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeneratedReaction {
    pub id: String,
    pub name: String,
    pub family_id: String,
    pub equation: String,
    pub reactants: HashMap<String, f64>,
    pub products: HashMap<String, f64>,
    pub gas_products: HashMap<String, f64>,
    pub k_fwd: f64,
    pub k_rev: f64,
    pub arrhenius_a: f64,
    pub arrhenius_ea: f64,
    pub delta_h_kj: f64,
    pub delta_g_kj: f64,
    pub k_eq: f64,
    pub tier: ProvenanceTier,
    pub source: String,
    pub formation_flux: f64,
    /// Rate-law orders: every non-solvent reactant first order, plus the dissolved catalysts the reaction does not consume
    /// (H+ for acid catalysis, OH- for base catalysis); the solvent is zero order. `arrhenius_a` is per unit of these.
    pub orders: HashMap<String, f64>,
    /// Equilibrium constant at 298.15 K (concentration units, solids and solvent at unit activity) and whether it came
    /// from species data (true) or from the template's own estimate (false).
    pub k_eq_298: f64,
    pub k_eq_from_data: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeneratedNetwork {
    pub active_species: Vec<String>,
    pub reactions: Vec<GeneratedReaction>,
    pub candidates_rejected: usize,
    pub cap_reached: bool,
    pub total_flux: f64,
}

#[derive(Clone, Debug)]
pub struct NetworkGeneratorConfig {
    pub max_active_species: usize,
    pub max_reactions: usize,
    pub flux_threshold_abs: f64,
    pub viscosity_pa_s: f64,
    pub precomputed_barriers: HashMap<String, f64>, // family_or_rxn_id -> Delta G_ddagger (kcal/mol)
}

impl Default for NetworkGeneratorConfig {
    fn default() -> Self {
        Self {
            max_active_species: DEFAULT_MAX_ACTIVE_SPECIES,
            max_reactions: DEFAULT_MAX_REACTIONS,
            flux_threshold_abs: DEFAULT_FLUX_THRESHOLD_ABS,
            viscosity_pa_s: 8.9e-4,
            precomputed_barriers: HashMap::new(),
        }
    }
}

pub struct NetworkGenerator {
    pub config: NetworkGeneratorConfig,
    pub families: Vec<ReactionFamily>,
}

impl NetworkGenerator {
    pub fn new(config: NetworkGeneratorConfig) -> Self {
        Self {
            config,
            families: templates::get_reaction_families(),
        }
    }

    /// Primary Stage 9 entrypoint:
    /// Given existing species and their concentrations (M), live pH, and temperature (K),
    /// generates an expanded, flux-filtered, thermodynamically reversible reaction network.
    pub fn generate_network(
        &self,
        initial_concs: &HashMap<String, f64>,
        temp_k: f64,
        ph: f64,
    ) -> GeneratedNetwork {
        let t = if temp_k <= 100.0 || temp_k.is_nan() { 298.15 } else { temp_k };
        let medium = Medium::from_solution(ph, t, initial_concs);
        let mut active_species_set: HashSet<String> = initial_concs.keys().cloned().collect();
        let mut species_concs = initial_concs.clone();
        // an ionic compound named by its formula ("NaOH", "HCl") reacts as the ions it dissolves into
        for (sp, &c) in initial_concs {
            if resolve_molecule(sp).is_some() {
                continue;
            }
            if let Some(split) = crate::ions::decompose_ionic(sp) {
                for ion in split.cations.iter().chain(split.anions.iter()) {
                    *species_concs.entry(ion.id.clone()).or_insert(0.0) += ion.n * c;
                    active_species_set.insert(ion.id.clone());
                }
            }
        }

        let mut generated_reactions: Vec<GeneratedReaction> = Vec::new();
        let mut seen_reaction_ids: HashSet<String> = HashSet::new();
        let mut candidates_rejected = 0;
        let mut cap_reached = false;
        let mut total_flux = 0.0;

        // Iterative expansion queue (RMG rate-based expansion)
        let mut queue: Vec<String> = active_species_set.iter().cloned().collect();
        queue.sort();

        while let Some(current_sp) = queue.pop() {
            if active_species_set.len() >= self.config.max_active_species {
                cap_reached = true;
                break;
            }
            if generated_reactions.len() >= self.config.max_reactions {
                cap_reached = true;
                break;
            }

            // 1. Unimolecular candidate generation (e.g. keto-enol tautomerism, elimination)
            let unimol_rxns = self.match_unimolecular(&current_sp, t, medium);
            for cand in unimol_rxns {
                if seen_reaction_ids.contains(&cand.id) {
                    continue;
                }

                // Balance verification
                let bal = crate::chem_db::check_balance(&cand.reactants, &cand.products, &cand.gas_products);
                if !bal.balanced {
                    continue;
                }

                let flux = rate_at(&cand, &species_concs);

                if flux >= self.config.flux_threshold_abs {
                    seen_reaction_ids.insert(cand.id.clone());
                    total_flux += flux;

                    for prod in cand.products.keys() {
                        if !active_species_set.contains(prod) {
                            if active_species_set.len() < self.config.max_active_species {
                                active_species_set.insert(prod.clone());
                                species_concs.insert(prod.clone(), (flux * 0.1).max(1e-6));
                                queue.push(prod.clone());
                            } else {
                                cap_reached = true;
                            }
                        }
                    }

                    generated_reactions.push(GeneratedReaction {
                        formation_flux: flux,
                        ..cand
                    });
                } else {
                    candidates_rejected += 1;
                }

                if generated_reactions.len() >= self.config.max_reactions {
                    cap_reached = true;
                    break;
                }
            }

            // 2. Bimolecular candidate generation with all active species
            let partners: Vec<String> = active_species_set.iter().cloned().collect();
            for partner_sp in partners {
                if generated_reactions.len() >= self.config.max_reactions {
                    cap_reached = true;
                    break;
                }

                let bimol_rxns = self.match_bimolecular(&current_sp, &partner_sp, t, medium);
                for cand in bimol_rxns {
                    if seen_reaction_ids.contains(&cand.id) {
                        continue;
                    }

                    // Balance verification
                    let bal = crate::chem_db::check_balance(&cand.reactants, &cand.products, &cand.gas_products);
                    if !bal.balanced {
                        continue;
                    }

                    let flux = rate_at(&cand, &species_concs);

                    if flux >= self.config.flux_threshold_abs {
                        seen_reaction_ids.insert(cand.id.clone());
                        total_flux += flux;

                        for prod in cand.products.keys() {
                            if !active_species_set.contains(prod) {
                                if active_species_set.len() < self.config.max_active_species {
                                    active_species_set.insert(prod.clone());
                                    species_concs.insert(prod.clone(), (flux * 0.1).max(1e-6));
                                    queue.push(prod.clone());
                                } else {
                                    cap_reached = true;
                                }
                            }
                        }

                        generated_reactions.push(GeneratedReaction {
                            formation_flux: flux,
                            ..cand
                        });
                    } else {
                        candidates_rejected += 1;
                    }

                    if generated_reactions.len() >= self.config.max_reactions {
                        cap_reached = true;
                        break;
                    }
                }
            }
        }

        let mut active_list: Vec<String> = active_species_set.into_iter().collect();
        active_list.sort();

        GeneratedNetwork {
            active_species: active_list,
            reactions: generated_reactions,
            candidates_rejected,
            cap_reached,
            total_flux,
        }
    }

    /// Builds one generated reaction: Arrhenius rate rule of the template (overridden by a precomputed barrier when the
    /// flywheel has one), diffusion ceiling for bimolecular steps, dissolved-catalyst concentrations folded into `k_fwd`
    /// at the generation conditions (the vessel re-evaluates them every tick through `orders`), and K from the species'
    /// formation data when all of them have it, else from the template's estimate (`fallback_dh_kj`, `fallback_dg_kj` at
    /// 298.15 K), labelled.
    #[allow(clippy::too_many_arguments)]
    fn build(
        &self,
        id: String,
        name: String,
        family_id: &str,
        reactants: HashMap<String, f64>,
        products: HashMap<String, f64>,
        catalysts: &[(&str, f64)],
        mut arr_a: f64,
        mut arr_ea: f64,
        fallback_dh_kj: f64,
        fallback_dg_kj: f64,
        temp_k: f64,
        medium: Medium,
        source: &str,
    ) -> GeneratedReaction {
        if let Some(&dg_kcal) = self.config.precomputed_barriers.get(family_id) {
            arr_ea = dg_kcal * 4184.0;
            arr_a = 1.0e11;
        }
        let k_arr = arr_a * (-arr_ea / (R_IDEAL * temp_k)).clamp(-700.0, 700.0).exp();
        let mut orders: HashMap<String, f64> = HashMap::new();
        for sp in reactants.keys() {
            orders.insert(sp.clone(), if sp == crate::vessel::AQUEOUS_SOLVENT { 0.0 } else { 1.0 });
        }
        let mut cat_factor = 1.0;
        for &(cat, ord) in catalysts {
            orders.insert(cat.to_string(), ord);
            let c = match cat {
                "H+" => medium.h_conc,
                "OH-" => medium.oh_conc,
                _ => 0.0,
            };
            cat_factor *= c.max(0.0).powf(ord);
        }
        let total_order: f64 = orders.values().sum();
        let k_cap = if total_order >= 1.8 { apply_diffusion_cap(k_arr, temp_k, self.config.viscosity_pa_s) } else { k_arr };
        let k_fwd = k_cap * cat_factor;

        let (k_eq_298, dh_kj, from_data) = reaction_k_298(&reactants, &products, fallback_dh_kj, fallback_dg_kj);
        // K at the generation temperature by van 't Hoff
        let ln_k_t = k_eq_298.ln() - dh_kj * 1000.0 / R_IDEAL * (1.0 / temp_k - 1.0 / 298.15);
        let k_eq = ln_k_t.clamp(-690.0, 690.0).exp();
        let delta_g_kj = -R_IDEAL * temp_k * ln_k_t / 1000.0;
        let equation = format!(
            "{} <=> {}",
            reactants.keys().cloned().collect::<Vec<_>>().join(" + "),
            products.keys().cloned().collect::<Vec<_>>().join(" + ")
        );
        GeneratedReaction {
            id,
            name,
            family_id: family_id.to_string(),
            equation,
            reactants,
            products,
            gas_products: HashMap::new(),
            k_fwd,
            k_rev: if k_eq > 0.0 { k_fwd / k_eq } else { 0.0 },
            arrhenius_a: arr_a,
            arrhenius_ea: arr_ea,
            delta_h_kj: dh_kj,
            delta_g_kj,
            k_eq,
            tier: ProvenanceTier::Estimated,
            source: format!("{}; K from {}", source, if from_data { "species formation data" } else { "template estimate" }),
            formation_flux: 0.0,
            orders,
            k_eq_298,
            k_eq_from_data: from_data,
        }
    }

    fn match_unimolecular(
        &self,
        species: &str,
        temp_k: f64,
        medium: Medium,
    ) -> Vec<GeneratedReaction> {
        let mut results = Vec::new();

        let mol = match resolve_molecule(species) {
            Some(m) => m,
            None => return results,
        };

        // Keto-enol tautomerism C(=O)-C(H) <=> C(OH)=C, acid- and base-catalysed (two parallel paths)
        let fam = self.families.iter().find(|f| f.id == "keto_enol_tautomerism");
        let (a, ea, dh, ds) = fam.map_or((1.0e6, 70_000.0, 42.0, 5.0), |f| (f.arrhenius_a, f.arrhenius_ea, f.delta_h_kj, f.delta_s_j_k));
        for (c_carb, o_carb, c_alpha) in find_enolizable_carbonyls(&mol) {
            let enol_id = register_or_find_species(&create_enol(&mol, c_carb, o_carb, c_alpha));
            for (cat, tag) in [("H+", "acid"), ("OH-", "base")] {
                // rate rule: k = 10 A exp(-Ea/RT) per M of catalyst (the family's A is for 0.1 M catalyst)
                results.push(self.build(
                    format!("tautomerism_{}_{}_{}", tag, species, enol_id),
                    format!("Keto-enol tautomerism of {} ({}-catalysed)", species, tag),
                    "keto_enol_tautomerism",
                    [(species.to_string(), 1.0)].into(),
                    [(enol_id.clone(), 1.0)].into(),
                    &[(cat, 1.0)],
                    10.0 * a,
                    ea,
                    dh,
                    dh - 298.15 * ds / 1000.0,
                    temp_k,
                    medium,
                    "Stage 9 structure template (keto-enol)",
                ));
            }
        }

        results
    }

    fn match_bimolecular(
        &self,
        sp1: &str,
        sp2: &str,
        temp_k: f64,
        medium: Medium,
    ) -> Vec<GeneratedReaction> {
        let mut results = Vec::new();
        let mol1 = resolve_molecule(sp1);
        let mol2 = resolve_molecule(sp2);
        let is_water = |s: &str| {
            crate::ions::species_elements(s).map_or(false, |e| {
                e.get("H") == Some(&2.0) && e.get("O") == Some(&1.0) && e.len() == 2
            }) && crate::ions::species_charge(s) == 0
        };
        let is_halogen = |s: &str| {
            crate::ions::species_elements(s).map_or(false, |e| {
                e.len() == 1 && matches!(e.iter().next(), Some((sym, &2.0)) if matches!(sym.as_str(), "F" | "Cl" | "Br" | "I"))
            }) && crate::ions::species_charge(s) == 0
        };
        // the partner that carries a functional group of `find` (either order of the pair)
        let pick = |find: &dyn Fn(&Molecule) -> bool| -> Option<(&str, &Molecule, &str)> {
            if let Some(m) = mol1.as_ref().filter(|m| find(m)) {
                return Some((sp1, m, sp2));
            }
            mol2.as_ref().filter(|m| find(m)).map(|m| (sp2, m, sp1))
        };

        // --- A. Ester hydrolysis: saponification by hydroxide; acid-catalysed hydrolysis by water (rate ∝ [H+])
        if let Some((ester_id, ester_mol, other_id)) = pick(&|m: &Molecule| !find_ester_groups(m).is_empty()) {
            let nuc = nucleophile_of(other_id).filter(|(_, n)| n.class == NucClass::Hydroxide);
            for (c_carb, _o_carb, o_alkoxy, _c_alkyl) in find_ester_groups(ester_mol) {
                if let Some((other_id, _)) = nuc.as_ref() {
                    let other_id = other_id.as_str();
                    let (acyl_mol, alkoxy_mol) = cleave_ester(ester_mol, c_carb, o_alkoxy, true);
                    let acyl_id = register_or_find_species(&acyl_mol);
                    let alc_id = register_or_find_species(&alkoxy_mol);
                    // rate rule (BAc2): A 2.3e7 M^-1 s^-1, Ea 47.5 kJ/mol -> k(298) ~ 0.11 M^-1 s^-1 (ethyl acetate class)
                    results.push(self.build(
                        format!("saponification_{}_{}", ester_id, other_id),
                        format!("Saponification of {} with {}", ester_id, other_id),
                        "base_ester_hydrolysis",
                        [(ester_id.to_string(), 1.0), (other_id.to_string(), 1.0)].into(),
                        [(acyl_id, 1.0), (alc_id, 1.0)].into(),
                        &[],
                        2.3e7,
                        47_500.0,
                        -55.0,
                        -50.0,
                        temp_k,
                        medium,
                        "Stage 9 structure template (ester saponification)",
                    ));
                } else if is_water(other_id) {
                    let (acyl_mol, alkoxy_mol) = cleave_ester(ester_mol, c_carb, o_alkoxy, false);
                    let acid_id = register_or_find_species(&acyl_mol);
                    let alc_id = register_or_find_species(&alkoxy_mol);
                    // rate rule (AAc2): k = 1.1e7 exp(-62 kJ/mol / RT) [H+] -> 1.5e-4 M^-1 s^-1 at 298 K
                    results.push(self.build(
                        format!("acid_hydrolysis_{}", ester_id),
                        format!("Acid-catalysed hydrolysis of {}", ester_id),
                        "acid_ester_hydrolysis",
                        [(ester_id.to_string(), 1.0), (other_id.to_string(), 1.0)].into(),
                        [(acid_id, 1.0), (alc_id, 1.0)].into(),
                        &[("H+", 1.0)],
                        1.1e7,
                        62_000.0,
                        3.0,
                        2.5,
                        temp_k,
                        medium,
                        "Stage 9 structure template (acid ester hydrolysis)",
                    ));
                }
            }
        }

        // --- B. Haloalkane SN2 substitution and E2 elimination by any anionic O, S or C nucleophile / base
        if let Some((halide_id, halide_mol, nuc_id)) = pick(&|m: &Molecule| !find_haloalkane_groups(m).is_empty()) {
            if let Some((nuc_id, nuc)) = nucleophile_of(nuc_id) {
                let nuc_id = nuc_id.as_str();
                for (c_alpha, x_idx, halogen_sym) in find_haloalkane_groups(halide_mol) {
                    let leaving_group = format!("{}-", halogen_sym);
                    let sub = substrate_class(halide_mol, c_alpha, x_idx);
                    let bulky = nuc.bulky;

                    // 1. SN2: R-X + Nu- -> R-Nu + X-. Rate rule for a primary substrate with hydroxide (A 4e9 M^-1 s^-1,
                    // Ea 89.5 kJ/mol), scaled by the substrate's steric class and the nucleophile's Swain-Scott n.
                    let product = substitute(halide_mol, c_alpha, x_idx, &nuc);
                    let prod_id = register_or_find_species(&product);
                    let mut a_sn2 = 4.0e9 * sub.sn2_factor * 10f64.powf(nuc.class.swain_scott_n() - NucClass::Hydroxide.swain_scott_n());
                    if bulky {
                        a_sn2 *= 0.005; // backside attack hindered by a bulky nucleophile
                    }
                    if a_sn2 > 0.0 {
                        results.push(self.build(
                            format!("sn2_{}_{}", halide_id, nuc_id),
                            format!("SN2 substitution on {} by {}", halide_id, nuc_id),
                            "sn2_substitution",
                            [(halide_id.to_string(), 1.0), (nuc_id.to_string(), 1.0)].into(),
                            [(prod_id, 1.0), (leaving_group.clone(), 1.0)].into(),
                            &[],
                            a_sn2,
                            89_500.0,
                            -80.0,
                            -85.0,
                            temp_k,
                            medium,
                            "Stage 9 structure template (SN2; steric class and Swain-Scott nucleophilicity, estimated)",
                        ));
                    }

                    // 2. E2 by a strong base (hydroxide, alkoxide): one reaction per distinct alkene. Rate rule for a
                    // primary substrate (A 2e10 M^-1 s^-1, Ea 105 kJ/mol: ~1 % elimination for a primary bromide at 25 C;
                    // Ea_E2 > Ea_SN2, so elimination rises with T), scaled by the substrate class, the beta-H count and
                    // (small bases) Zaitsev substitution.
                    if nuc.class.is_strong_base() {
                        let conj_acid = conjugate_acid_id(&nuc);
                        let mut by_alkene: Vec<(String, f64)> = Vec::new();
                        for (beta, n_h, beta_subst) in beta_carbons(halide_mol, c_alpha, x_idx) {
                            if let Some(alkene) = haloalkane_e2_at(halide_mol, c_alpha, x_idx, beta) {
                                let alk_id = register_or_find_species(&alkene);
                                let orient = if bulky { 1.0 } else { 1.0 + beta_subst as f64 };
                                let f = sub.e2_factor * n_h as f64 / 3.0 * orient;
                                match by_alkene.iter_mut().find(|(id, _)| *id == alk_id) {
                                    Some(x) => x.1 += f,
                                    None => by_alkene.push((alk_id, f)),
                                }
                            }
                        }
                        for (alk_id, f) in by_alkene {
                            let a_e2 = 2.0e10 * f * if bulky { 3.0 } else { 1.0 };
                            if a_e2 <= 0.0 {
                                continue;
                            }
                            let mut products: HashMap<String, f64> = [(alk_id.clone(), 1.0), (leaving_group.clone(), 1.0)].into();
                            *products.entry(conj_acid.clone()).or_insert(0.0) += 1.0;
                            results.push(self.build(
                                format!("e2_{}_{}_{}", halide_id, nuc_id, alk_id),
                                format!("E2 elimination on {} by {} -> {}", halide_id, nuc_id, alk_id),
                                "e2_elimination",
                                [(halide_id.to_string(), 1.0), (nuc_id.to_string(), 1.0)].into(),
                                products,
                                &[],
                                a_e2,
                                105_000.0,
                                -35.0,
                                -45.0,
                                temp_k,
                                medium,
                                "Stage 9 structure template (E2; substrate class, beta-H count, Zaitsev/Hofmann, estimated)",
                            ));
                        }
                    }
                }
            }
        }

        // --- C. Alkene additions: acid-catalysed Markovnikov hydration, halogen addition
        if let Some((alkene_id, alkene_mol, other_id)) = pick(&|m: &Molecule| !find_alkene_groups(m).is_empty()) {
            for (c1, c2) in find_alkene_groups(alkene_mol) {
                if is_water(other_id) {
                    let alc_id = register_or_find_species(&alkene_hydration(alkene_mol, c1, c2));
                    // rate rule: k = 1e7 exp(-70 kJ/mol / RT) [H+]
                    results.push(self.build(
                        format!("hydration_{}_{}_{}", alkene_id, c1, c2),
                        format!("Acid-catalysed hydration of {}", alkene_id),
                        "alkene_hydration",
                        [(alkene_id.to_string(), 1.0), (other_id.to_string(), 1.0)].into(),
                        [(alc_id, 1.0)].into(),
                        &[("H+", 1.0)],
                        1.0e7,
                        70_000.0,
                        -45.0,
                        -15.0,
                        temp_k,
                        medium,
                        "Stage 9 structure template (alkene hydration, Markovnikov)",
                    ));
                } else if is_halogen(other_id) {
                    let hal_sym = crate::ions::species_elements(other_id).and_then(|e| e.into_keys().next()).unwrap_or_default();
                    let dihalo_id = register_or_find_species(&alkene_halogenation(alkene_mol, c1, c2, &hal_sym));
                    results.push(self.build(
                        format!("halogenation_{}_{}_{}_{}", alkene_id, other_id, c1, c2),
                        format!("Halogen addition: {} + {}", alkene_id, other_id),
                        "alkene_halogenation",
                        [(alkene_id.to_string(), 1.0), (other_id.to_string(), 1.0)].into(),
                        [(dihalo_id, 1.0)].into(),
                        &[],
                        5.0e8,
                        28_000.0,
                        -120.0,
                        -95.0,
                        temp_k,
                        medium,
                        "Stage 9 structure template (alkene halogenation)",
                    ));
                }
            }
        }

        results
    }
}

/// Rate of a candidate (M/s) at the generation concentrations: `k_fwd` already holds the catalysts, so only the consumed,
/// non-solvent reactants count.
fn rate_at(r: &GeneratedReaction, concs: &HashMap<String, f64>) -> f64 {
    let mut rate = r.k_fwd;
    for (sp, &ord) in &r.orders {
        if r.reactants.contains_key(sp) && ord > 0.0 {
            rate *= concs.get(sp).copied().unwrap_or(0.0).max(0.0).powf(ord);
        }
    }
    rate
}

/// K at 298.15 K and the reaction enthalpy (kJ/mol) from the species' formation data, or from the template estimate.
fn reaction_k_298(
    reactants: &HashMap<String, f64>,
    products: &HashMap<String, f64>,
    fallback_dh_kj: f64,
    fallback_dg_kj: f64,
) -> (f64, f64, bool) {
    use crate::thermo::functions::{phase_of_id, try_ln_k_equilibrium, try_thermo_state};
    if let Some(ln_k) = try_ln_k_equilibrium(reactants, products, 298.15, 1.0e5) {
        let mut dh = 0.0;
        let mut ok = true;
        for (sign, side) in [(1.0, products), (-1.0, reactants)] {
            for (sp, &c) in side {
                match try_thermo_state(sp, phase_of_id(sp), 298.15, 1.0e5) {
                    Some(st) => dh += sign * c * st.h_j_mol / 1000.0,
                    None => ok = false,
                }
            }
        }
        if ok {
            return (ln_k.clamp(-690.0, 690.0).exp(), dh, true);
        }
    }
    let ln_k = -fallback_dg_kj * 1000.0 / (R_IDEAL * 298.15);
    (ln_k.clamp(-690.0, 690.0).exp(), fallback_dh_kj, false)
}

/// Kind of nucleophilic / basic site, from the structure around the anionic atom.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum NucClass {
    Hydroxide,
    Alkoxide,
    Phenoxide,
    Carboxylate,
    Thiolate,
    Cyanide,
}

impl NucClass {
    /// Swain-Scott nucleophilicity n (CH3Br in water, s = 1): hydroxide 4.2, acetate 2.7, HS- 5.1, CN- 5.1 (Swain & Scott
    /// 1953); alkoxide taken as hydroxide and phenoxide as an estimate between hydroxide and carboxylate.
    pub fn swain_scott_n(self) -> f64 {
        match self {
            NucClass::Hydroxide | NucClass::Alkoxide => 4.2,
            NucClass::Phenoxide => 3.5,
            NucClass::Carboxylate => 2.7,
            NucClass::Thiolate | NucClass::Cyanide => 5.1,
        }
    }

    /// Strong enough a base (conjugate acid pKa >= ~15) for bimolecular elimination.
    pub fn is_strong_base(self) -> bool {
        matches!(self, NucClass::Hydroxide | NucClass::Alkoxide)
    }
}

/// The anionic O, S or C atom of a species' graph and its class.
#[derive(Clone, Debug)]
pub struct NucSite {
    pub mol: Molecule,
    pub atom: usize,
    pub class: NucClass,
    /// alkoxide on a carbon with three carbon neighbours (tert-butoxide): hinders SN2, favours Hofmann elimination
    pub bulky: bool,
}

/// The reacting id and nucleophilic site of a species: the species itself, or the hydroxide of a hydroxide salt written as
/// a formula ("NaOH", which the vessel holds as its ions).
pub fn nucleophile_of(species: &str) -> Option<(String, NucSite)> {
    if let Some(site) = nucleophile_site(species) {
        return Some((species.to_string(), site));
    }
    let split = crate::ions::decompose_ionic(species)?;
    let oh = split.anions.into_iter().find(|a| a.id == crate::db::seed::HYDROXIDE)?;
    nucleophile_site(&oh.id).map(|site| (oh.id, site))
}

pub fn nucleophile_site(species: &str) -> Option<NucSite> {
    let mol = resolve_molecule(species)?;
    if mol.atoms.iter().map(|a| a.charge).sum::<i32>() >= 0 {
        return None;
    }
    let (atom, a) = mol.atoms.iter().enumerate().find(|(_, a)| a.charge == -1 && matches!(a.element.as_str(), "O" | "S" | "C"))?;
    let nb = mol.neighbours(atom);
    let heavy: Vec<usize> = nb.iter().map(|&(j, _)| j).collect();
    let (class, bulky) = match a.element.as_str() {
        "S" => (NucClass::Thiolate, false),
        "C" => {
            if nb.iter().any(|&(j, o)| mol.atoms[j].element == "N" && (o - 3.0).abs() < 1e-9) {
                (NucClass::Cyanide, false)
            } else {
                return None;
            }
        }
        _ => {
            if heavy.is_empty() {
                (NucClass::Hydroxide, false)
            } else {
                let c = heavy[0];
                if mol.atoms[c].element != "C" {
                    return None;
                }
                let c_nb = mol.neighbours(c);
                if mol.atoms[c].aromatic {
                    (NucClass::Phenoxide, false)
                } else if c_nb.iter().any(|&(j, o)| j != atom && mol.atoms[j].element == "O" && (o - 2.0).abs() < 1e-9) {
                    (NucClass::Carboxylate, false)
                } else {
                    let n_c = c_nb.iter().filter(|&&(j, _)| mol.atoms[j].element == "C").count();
                    (NucClass::Alkoxide, n_c >= 3)
                }
            }
        }
    };
    Some(NucSite { mol, atom, class, bulky })
}

/// Species id of the conjugate acid of a base site (water for hydroxide).
fn conjugate_acid_id(nuc: &NucSite) -> String {
    if nuc.class == NucClass::Hydroxide {
        return crate::vessel::AQUEOUS_SOLVENT.to_string();
    }
    let mut m = nuc.mol.clone();
    let h = m.hydrogens(nuc.atom);
    m.atoms[nuc.atom].charge = 0;
    set_h(&mut m, nuc.atom, h + 1);
    register_or_find_species(&m)
}

/// Gives atom `i` exactly `h` hydrogens, implicitly when the valence model agrees, else as a bracket count.
fn set_h(m: &mut Molecule, i: usize, h: u32) {
    m.atoms[i].explicit_h = None;
    if m.hydrogens(i) != h {
        m.atoms[i].explicit_h = Some(h);
    }
}

/// Steric class of the carbon that carries the leaving group.
pub struct SubstrateClass {
    /// carbon neighbours of the alpha carbon (0 methyl, 1 primary, 2 secondary, 3 tertiary)
    pub degree: usize,
    pub sn2_factor: f64,
    pub e2_factor: f64,
}

/// Relative SN2 rates methyl 30 : primary 1 : secondary 0.025 : tertiary ~1e-5, times 0.04 per extra branch on a beta
/// carbon (isobutyl, neopentyl) (Streitwieser 1956; Ingold); relative E2 rates primary 1 : secondary 5 : tertiary 50 per
/// three beta hydrogens, which with the SN2 factors reproduce the Hughes-Ingold elimination fractions with ethoxide
/// (primary ~1 %, secondary ~80 %, tertiary ~100 %). No beta carbon, no E2. Tertiary and secondary substrates also react
/// by SN1/E1 in protic solvents, which no template covers yet.
pub fn substrate_class(mol: &Molecule, c_alpha: usize, x_idx: usize) -> SubstrateClass {
    let carbons: Vec<usize> = mol.neighbours(c_alpha).iter().filter(|&&(j, _)| j != x_idx && mol.atoms[j].element == "C").map(|&(j, _)| j).collect();
    let degree = carbons.len().min(3);
    let mut branch = 0i32;
    for &b in &carbons {
        let others = mol.neighbours(b).iter().filter(|&&(j, _)| j != c_alpha && mol.atoms[j].element == "C").count() as i32;
        branch += (others - 1).max(0);
    }
    let sn2 = [30.0, 1.0, 0.025, 1.0e-5][degree] * 0.04f64.powi(branch);
    let e2 = [0.0, 1.0, 5.0, 50.0][degree];
    SubstrateClass { degree, sn2_factor: sn2, e2_factor: e2 }
}

/// sp3 beta carbons that carry hydrogen: (atom, H count, carbon substituents other than the alpha carbon).
fn beta_carbons(mol: &Molecule, c_alpha: usize, x_idx: usize) -> Vec<(usize, u32, usize)> {
    mol.neighbours(c_alpha)
        .iter()
        .filter(|&&(j, o)| j != x_idx && (o - 1.0).abs() < 1e-9 && mol.atoms[j].element == "C" && !mol.atoms[j].aromatic && mol.hydrogens(j) >= 1)
        .map(|&(j, _)| {
            let subst = mol.neighbours(j).iter().filter(|&&(k, _)| k != c_alpha && mol.atoms[k].element == "C").count();
            (j, mol.hydrogens(j), subst)
        })
        .collect()
}

/// R-X + Nu- -> R-Nu: the leaving atom removed and the nucleophile's anionic atom (now neutral) bonded to the alpha carbon.
pub fn substitute(mol: &Molecule, c_alpha: usize, x_idx: usize, nuc: &NucSite) -> Molecule {
    let keep: HashSet<usize> = (0..mol.atoms.len()).filter(|&i| i != x_idx).collect();
    let mut out = extract_submolecule(mol, &keep);
    let new_alpha = (0..c_alpha).filter(|i| keep.contains(i)).count();
    let offset = out.atoms.len();
    let h = nuc.mol.hydrogens(nuc.atom);
    for a in &nuc.mol.atoms {
        out.atoms.push(a.clone());
    }
    for &(a, b, o) in &nuc.mol.bonds {
        out.bonds.push((a + offset, b + offset, o));
    }
    let n_atom = offset + nuc.atom;
    out.atoms[n_atom].charge = 0;
    out.bonds.push((new_alpha, n_atom, 1.0));
    set_h(&mut out, n_atom, h);
    out
}

// ==============================================================================================
// Structure Resolution & Registration
// ==============================================================================================

/// Resolves a species string to a molecular graph.
pub fn resolve_molecule(species: &str) -> Option<Molecule> {
    if let Some(m) = smiles::parse(species) {
        if !m.atoms.is_empty() {
            return Some(m);
        }
    }
    if let Ok(store) = crate::db::SpeciesStore::global().read() {
        if let Some(rec) = store.get(species).or_else(|| store.get_by_name(species)) {
            if let Some(ref smi) = rec.identity.smiles {
                if let Some(m) = smiles::parse(smi) {
                    return Some(m);
                }
            }
        }
    }
    for cat in crate::chem_db::get_reagent_catalog() {
        if cat.id == species || cat.name.eq_ignore_ascii_case(species) {
            if let Some(m) = smiles::parse(&cat.formula) {
                return Some(m);
            }
        }
    }
    None
}

/// Registers a generated product Molecule into SpeciesStore if not present.
/// Returns the canonical species id for this product.
pub fn register_or_find_species(mol: &Molecule) -> String {
    let formula = mol.formula();
    let smiles = mol.to_smiles();
    let net_charge = mol.atoms.iter().map(|a| a.charge).sum::<i32>();

    if let Ok(store) = crate::db::SpeciesStore::global().read() {
        for rec in store.iter() {
            if rec.identity.charge == net_charge && rec.identity.formula == formula {
                if let Some(ref s) = rec.identity.smiles {
                    if s == &smiles {
                        return rec.id.clone();
                    }
                    if let Some(rec_mol) = smiles::parse(s) {
                        if mol.is_isomorphic(&rec_mol) {
                            return rec.id.clone();
                        }
                    }
                }
            }
        }
    }

    let mut cand = formula.clone();
    if let Ok(store) = crate::db::SpeciesStore::global().read() {
        if let Some(existing) = store.get(&cand) {
            if existing.identity.smiles.as_deref() != Some(&smiles) {
                cand = format!("{}_{}", formula, smiles.replace(['(', ')', '=', '#', '[', ']', '+', '-'], ""));
            }
        }
    }
    let id = cand;

    if let Ok(mut store) = crate::db::SpeciesStore::global().write() {
        if store.get(&id).is_none() {
            // Thermodynamics of a created compound: Joback group contributions over its graph (ideal gas) and the liquid
            // reference state derived from them (Trouton + Clausius-Clapeyron), tier Estimated; its normal boiling point
            // is stored as a labelled point on the vapour-pressure curve. A molecule outside the method (an ion, an
            // uncovered atom) gets no thermodynamic data at all rather than an invented value: reactions that need it
            // then fall back to the template's own estimate, labelled as such.
            let mut phases = HashMap::new();
            let mut points = Vec::new();
            let joback = if net_charge == 0 { crate::joback::estimate(mol) } else { None };
            let datum = |v: f64, unit: &str| crate::db::record::Datum::new(v, unit, ProvenanceTier::Estimated, "Joback group contribution");
            let thermo = |dfh: f64, dfg: f64, cp: f64, source: &str| crate::db::record::PhaseThermo {
                model: "point+cp".to_string(),
                tier: ProvenanceTier::Estimated,
                source: source.to_string(),
                dfH: Some(datum(dfh, "kJ/mol")),
                dfG: Some(datum(dfg, "kJ/mol")),
                S: None,
                cp: Some(datum(cp, "J/(mol K)")),
                ranges: None,
                params: None,
            };
            let phase = |t: Option<crate::db::record::PhaseThermo>| crate::db::record::PhaseData { thermo: t, volume: None, rho: None, polymorph: None, specific_area: None };
            if let Some(j) = &joback {
                let cp = j.cp_gas(298.15);
                let (dfh_l, dfg_l) = j.liquid_formation_kj();
                phases.insert("g".to_string(), phase(Some(thermo(j.dhf_gas_kj, j.dgf_gas_kj, cp, "Joback (ideal gas, 298.15 K)"))));
                phases.insert("l".to_string(), phase(Some(thermo(dfh_l, dfg_l, cp, "Joback + Trouton + Clausius-Clapeyron (liquid, 298.15 K)"))));
                points.push(crate::db::record::CurvePoint {
                    kind: "psat".to_string(),
                    T_K: Some(j.tb_k),
                    P_Pa: Some(101_325.0),
                    solvent: None,
                    value: None,
                    unit: None,
                    tier: ProvenanceTier::Estimated,
                    source: "Joback normal boiling point".to_string(),
                    uncertainty: Some(25.0),
                });
            } else {
                phases.insert(if net_charge != 0 { "aq".to_string() } else { "l".to_string() }, phase(None));
            }

            store.register(crate::db::record::SpeciesRecord {
                id: id.clone(),
                identity: crate::db::record::Identity {
                    inchikey: None,
                    smiles: Some(smiles.clone()),
                    formula: formula.clone(),
                    charge: net_charge,
                    cas: None,
                    cid: None,
                    names: vec![id.clone(), formula.clone(), smiles.clone()],
                    db_names: HashMap::new(),
                },
                phases,
                critical: None,
                points,
                vapor_pressure: None,
                unifac_groups: None,
                acid_base: Vec::new(),
                redox: Vec::new(),
                optics: None,
                transport: None,
                kinetics_refs: Vec::new(),
                rejected: Vec::new(),
            });
        }
    }

    id
}

// ==============================================================================================
// Atom-Mapped Structural Transformations
// ==============================================================================================

/// Identifies ester functional groups: returns (c_carb, o_carbonyl, o_alkoxy, c_alkyl).
pub fn find_ester_groups(mol: &Molecule) -> Vec<(usize, usize, usize, usize)> {
    let mut results = Vec::new();
    for (c, atom) in mol.atoms.iter().enumerate() {
        if atom.element != "C" || atom.aromatic {
            continue;
        }
        let nb = mol.neighbours(c);
        let mut o_carb = None;
        let mut o_alkoxy = None;

        for &(nbr, order) in &nb {
            if mol.atoms[nbr].element == "O" {
                if (order - 2.0).abs() < 1e-9 {
                    o_carb = Some(nbr);
                } else if (order - 1.0).abs() < 1e-9 {
                    o_alkoxy = Some(nbr);
                }
            }
        }

        if let (Some(oc), Some(oa)) = (o_carb, o_alkoxy) {
            // Find c_alkyl bonded to o_alkoxy (other than c_carb)
            let oa_nb = mol.neighbours(oa);
            if let Some(&(c_alk, _)) = oa_nb.iter().find(|&&(n, _)| n != c && mol.atoms[n].element == "C") {
                results.push((c, oc, oa, c_alk));
            }
        }
    }
    results
}

/// Cleaves ester bond: returns (acyl_molecule, alkoxy_molecule).
/// For base saponification, acyl is carboxylate R-COO-. For acid hydrolysis, acyl is carboxylic acid R-COOH.
pub fn cleave_ester(mol: &Molecule, c_carb: usize, o_alkoxy: usize, is_base: bool) -> (Molecule, Molecule) {
    // 1. Acyl fragment: atoms reachable from c_carb ignoring (c_carb, o_alkoxy)
    let mut acyl_atoms = HashSet::new();
    let mut q = VecDeque::new();
    q.push_back(c_carb);
    acyl_atoms.insert(c_carb);
    while let Some(u) = q.pop_front() {
        for &(v, _) in &mol.neighbours(u) {
            if (u == c_carb && v == o_alkoxy) || (u == o_alkoxy && v == c_carb) {
                continue;
            }
            if acyl_atoms.insert(v) {
                q.push_back(v);
            }
        }
    }

    // 2. Alkoxy fragment: atoms reachable from o_alkoxy ignoring (c_carb, o_alkoxy)
    let mut alkoxy_atoms = HashSet::new();
    q.push_back(o_alkoxy);
    alkoxy_atoms.insert(o_alkoxy);
    while let Some(u) = q.pop_front() {
        for &(v, _) in &mol.neighbours(u) {
            if (u == c_carb && v == o_alkoxy) || (u == o_alkoxy && v == c_carb) {
                continue;
            }
            if alkoxy_atoms.insert(v) {
                q.push_back(v);
            }
        }
    }

    // Acyl submolecule: attach [O-] if base, or OH if acid
    let extra_o = if is_base {
        Atom { element: "O".to_string(), aromatic: false, charge: -1, explicit_h: Some(0) }
    } else {
        Atom { element: "O".to_string(), aromatic: false, charge: 0, explicit_h: None }
    };

    let acyl_mol = extract_submolecule_with_extra(mol, &acyl_atoms, c_carb, extra_o);
    let alkoxy_mol = extract_submolecule(mol, &alkoxy_atoms);

    (acyl_mol, alkoxy_mol)
}

/// Identifies haloalkane groups: returns (c_alpha, x_idx, halogen_symbol).
pub fn find_haloalkane_groups(mol: &Molecule) -> Vec<(usize, usize, String)> {
    let mut results = Vec::new();
    for (i, atom) in mol.atoms.iter().enumerate() {
        if matches!(atom.element.as_str(), "Cl" | "Br" | "I") && atom.charge == 0 {
            let nb = mol.neighbours(i);
            if let Some(&(c_alpha, order)) = nb.first() {
                // only an sp3 carbon substitutes / eliminates this way (vinyl and aryl halides do not)
                let sp3 = mol.neighbours(c_alpha).iter().all(|&(_, o)| (o - 1.0).abs() < 1e-9);
                if (order - 1.0).abs() < 1e-9 && mol.atoms[c_alpha].element == "C" && !mol.atoms[c_alpha].aromatic && sp3 {
                    results.push((c_alpha, i, atom.element.clone()));
                }
            }
        }
    }
    results
}

/// SN2 substitution: replaces halogen at c_alpha with OH group, yielding alcohol.
pub fn haloalkane_sn2(mol: &Molecule, c_alpha: usize, x_idx: usize) -> Molecule {
    let keep_atoms: HashSet<usize> = (0..mol.atoms.len()).filter(|&i| i != x_idx).collect();
    let extra_oh = Atom { element: "O".to_string(), aromatic: false, charge: 0, explicit_h: None };
    extract_submolecule_with_extra(mol, &keep_atoms, c_alpha, extra_oh)
}

/// E2 elimination: eliminates halogen and adjacent beta-hydrogen, forming a C=C double bond (first beta carbon with H).
pub fn haloalkane_e2(mol: &Molecule, c_alpha: usize, x_idx: usize) -> Option<Molecule> {
    let (beta, _, _) = *beta_carbons(mol, c_alpha, x_idx).first()?;
    haloalkane_e2_at(mol, c_alpha, x_idx, beta)
}

/// E2 elimination toward a given beta carbon: the C=C forms between the alpha and that beta carbon.
pub fn haloalkane_e2_at(mol: &Molecule, c_alpha: usize, x_idx: usize, c_beta: usize) -> Option<Molecule> {
    let keep_atoms: HashSet<usize> = (0..mol.atoms.len()).filter(|&i| i != x_idx).collect();
    let mut sub = extract_submolecule(mol, &keep_atoms);
    let mut sorted: Vec<usize> = keep_atoms.into_iter().collect();
    sorted.sort();
    let na = sorted.iter().position(|&x| x == c_alpha)?;
    let nb = sorted.iter().position(|&x| x == c_beta)?;
    let bond = sub.bonds.iter_mut().find(|b| (b.0 == na && b.1 == nb) || (b.0 == nb && b.1 == na))?;
    bond.2 = 2.0;
    Some(sub)
}

/// Identifies alkene C=C double bonds: returns (c1, c2).
pub fn find_alkene_groups(mol: &Molecule) -> Vec<(usize, usize)> {
    let mut results = Vec::new();
    for &(a, b, order) in &mol.bonds {
        if (order - 2.0).abs() < 1e-9 && mol.atoms[a].element == "C" && mol.atoms[b].element == "C" && !mol.atoms[a].aromatic && !mol.atoms[b].aromatic {
            results.push((a, b));
        }
    }
    results
}

/// Alkene hydration: H and OH add across C=C; the OH goes to the carbon with more carbon substituents (Markovnikov: the
/// more stable carbocation forms on protonation).
pub fn alkene_hydration(mol: &Molecule, c1: usize, c2: usize) -> Molecule {
    let n_c = |c: usize| mol.neighbours(c).iter().filter(|&&(j, _)| mol.atoms[j].element == "C").count();
    let (c1, c2) = if n_c(c1) > n_c(c2) { (c2, c1) } else { (c1, c2) };
    let keep_atoms: HashSet<usize> = (0..mol.atoms.len()).collect();
    let extra_oh = Atom { element: "O".to_string(), aromatic: false, charge: 0, explicit_h: None };
    let mut sub = extract_submolecule_with_extra(mol, &keep_atoms, c2, extra_oh);

    // Reduce bond order between c1 and c2 to 1.0
    for b in sub.bonds.iter_mut() {
        if (b.0 == c1 && b.1 == c2) || (b.0 == c2 && b.1 == c1) {
            b.2 = 1.0;
            break;
        }
    }
    sub
}

/// Alkene halogenation: adds halogen X to c1 and c2, turning C=C into 1,2-dihaloalkane.
pub fn alkene_halogenation(mol: &Molecule, c1: usize, c2: usize, hal_sym: &str) -> Molecule {
    let mut new_atoms = mol.atoms.clone();
    let mut new_bonds = mol.bonds.clone();

    for b in new_bonds.iter_mut() {
        if (b.0 == c1 && b.1 == c2) || (b.0 == c2 && b.1 == c1) {
            b.2 = 1.0;
            break;
        }
    }

    let x1 = new_atoms.len();
    new_atoms.push(Atom { element: hal_sym.to_string(), aromatic: false, charge: 0, explicit_h: None });
    new_bonds.push((c1, x1, 1.0));

    let x2 = new_atoms.len();
    new_atoms.push(Atom { element: hal_sym.to_string(), aromatic: false, charge: 0, explicit_h: None });
    new_bonds.push((c2, x2, 1.0));

    Molecule { atoms: new_atoms, bonds: new_bonds }
}

/// Identifies enolizable carbonyl groups C(=O)-C(alpha)(H): returns (c_carb, o_carb, c_alpha).
pub fn find_enolizable_carbonyls(mol: &Molecule) -> Vec<(usize, usize, usize)> {
    let mut results = Vec::new();
    for (c, atom) in mol.atoms.iter().enumerate() {
        if atom.element != "C" || atom.aromatic {
            continue;
        }
        let nb = mol.neighbours(c);
        let o_carb = nb.iter().find(|&&(n, o)| (o - 2.0).abs() < 1e-9 && mol.atoms[n].element == "O").map(|&(n, _)| n);
        if let Some(oc) = o_carb {
            // Exclude carboxylic acids, esters, carboxylates, amides, and acyl halides (only ketones and aldehydes)
            let has_heteroatom = nb.iter().any(|&(n, _)| n != oc && matches!(mol.atoms[n].element.as_str(), "O" | "N" | "S" | "Cl" | "Br" | "F"));
            if has_heteroatom {
                continue;
            }
            for &(ca, o) in &nb {
                if (o - 1.0).abs() < 1e-9 && mol.atoms[ca].element == "C" && mol.hydrogens(ca) >= 1 {
                    results.push((c, oc, ca));
                }
            }
        }
    }
    results
}

/// Creates enol tautomer: C(=O)-C(alpha) -> C(OH)=C(alpha).
pub fn create_enol(mol: &Molecule, c_carb: usize, o_carb: usize, c_alpha: usize) -> Molecule {
    let mut new_bonds = mol.bonds.clone();
    for b in new_bonds.iter_mut() {
        if (b.0 == c_carb && b.1 == o_carb) || (b.0 == o_carb && b.1 == c_carb) {
            b.2 = 1.0; // C=O -> C-OH
        }
        if (b.0 == c_carb && b.1 == c_alpha) || (b.0 == c_alpha && b.1 == c_carb) {
            b.2 = 2.0; // C-C -> C=C
        }
    }
    Molecule { atoms: mol.atoms.clone(), bonds: new_bonds }
}

// ----------------------------------------------------------------------------------------------
// Graph extraction helpers
// ----------------------------------------------------------------------------------------------

fn extract_submolecule(mol: &Molecule, keep_atoms: &HashSet<usize>) -> Molecule {
    let mut sorted: Vec<usize> = keep_atoms.iter().copied().collect();
    sorted.sort();

    let mut new_atoms = Vec::new();
    let mut old_to_new = HashMap::new();
    for old_idx in sorted {
        let new_idx = new_atoms.len();
        new_atoms.push(mol.atoms[old_idx].clone());
        old_to_new.insert(old_idx, new_idx);
    }

    let mut new_bonds = Vec::new();
    for &(a, b, o) in &mol.bonds {
        if let (Some(&na), Some(&nb)) = (old_to_new.get(&a), old_to_new.get(&b)) {
            new_bonds.push((na, nb, o));
        }
    }

    Molecule { atoms: new_atoms, bonds: new_bonds }
}

fn extract_submolecule_with_extra(
    mol: &Molecule,
    keep_atoms: &HashSet<usize>,
    attach_to_old: usize,
    extra_atom: Atom,
) -> Molecule {
    let mut sorted: Vec<usize> = keep_atoms.iter().copied().collect();
    sorted.sort();

    let mut new_atoms = Vec::new();
    let mut old_to_new = HashMap::new();
    for old_idx in sorted {
        let new_idx = new_atoms.len();
        new_atoms.push(mol.atoms[old_idx].clone());
        old_to_new.insert(old_idx, new_idx);
    }

    let extra_idx = new_atoms.len();
    new_atoms.push(extra_atom);

    let mut new_bonds = Vec::new();
    for &(a, b, o) in &mol.bonds {
        if let (Some(&na), Some(&nb)) = (old_to_new.get(&a), old_to_new.get(&b)) {
            new_bonds.push((na, nb, o));
        }
    }

    if let Some(&attach_idx) = old_to_new.get(&attach_to_old) {
        new_bonds.push((attach_idx, extra_idx, 1.0));
    }

    Molecule { atoms: new_atoms, bonds: new_bonds }
}
