//! M6/Stage 9 Chemical Reaction Network Generator.
//! Structure-based reaction network generation using atom-mapped Molecule graphs,
//! dynamic Arrhenius kinetics ($A, E_a$) recomputed each tick, thermodynamic detailed balance,
//! automatic Hill formula and SMILES product registration in SpeciesStore,
//! and strict element and charge conservation assertions.

use std::collections::{HashMap, HashSet, VecDeque};
use serde::{Deserialize, Serialize};

use crate::types::ProvenanceTier;
use crate::smiles::{self, Atom, Molecule};
use crate::templates::{
    self, CatalysisType, Medium, ReactionFamily, R_IDEAL,
    calculate_mayr_rate, apply_diffusion_cap,
};

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

        let mut generated_reactions: Vec<GeneratedReaction> = Vec::new();
        let mut seen_reaction_ids: HashSet<String> = HashSet::new();
        let mut candidates_rejected = 0;
        let mut cap_reached = false;
        let mut total_flux = 0.0;

        let mayr_db = templates::get_mayr_database();

        // Iterative expansion queue (RMG rate-based expansion)
        let mut queue: Vec<String> = initial_concs.keys().cloned().collect();

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

                let reactant_conc = species_concs.get(&current_sp).copied().unwrap_or(0.0);
                let flux = cand.k_fwd * reactant_conc;

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

                let bimol_rxns = self.match_bimolecular(&current_sp, &partner_sp, t, medium, &mayr_db);
                for cand in bimol_rxns {
                    if seen_reaction_ids.contains(&cand.id) {
                        continue;
                    }

                    // Balance verification
                    let bal = crate::chem_db::check_balance(&cand.reactants, &cand.products, &cand.gas_products);
                    if !bal.balanced {
                        continue;
                    }

                    let c1 = species_concs.get(&current_sp).copied().unwrap_or(0.0);
                    let c2 = species_concs.get(&partner_sp).copied().unwrap_or(0.0);
                    let flux = cand.k_fwd * c1 * c2;

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

        // Keto-enol tautomerism: C(=O)-C(H) <=> C(OH)=C
        let enolizable = find_enolizable_carbonyls(&mol);
        for (c_carb, o_carb, c_alpha) in enolizable {
            let enol_mol = create_enol(&mol, c_carb, o_carb, c_alpha);
            let enol_id = register_or_find_species(&enol_mol);

            let (arr_a, arr_ea, k_fwd, k_rev, k_eq, delta_g) = self.eval_kinetics("keto_enol_tautomerism", temp_k, medium);

            results.push(GeneratedReaction {
                id: format!("tautomerism_{}_{}", species, enol_id),
                name: format!("Keto-Enol Tautomerism on {}", species),
                family_id: "keto_enol_tautomerism".to_string(),
                equation: format!("{} <=> {}", species, enol_id),
                reactants: [(species.to_string(), 1.0)].into(),
                products: [(enol_id, 1.0)].into(),
                gas_products: HashMap::new(),
                k_fwd,
                k_rev,
                arrhenius_a: arr_a,
                arrhenius_ea: arr_ea,
                delta_h_kj: 25.0,
                delta_g_kj: delta_g,
                k_eq,
                tier: ProvenanceTier::Estimated,
                source: "Stage 9 Organic Structure Generator".to_string(),
                formation_flux: 0.0,
            });
        }

        results
    }

    fn match_bimolecular(
        &self,
        sp1: &str,
        sp2: &str,
        temp_k: f64,
        medium: Medium,
        mayr_db: &HashMap<String, templates::MayrParameter>,
    ) -> Vec<GeneratedReaction> {
        let mut results = Vec::new();

        // 1. Mayr parameter matching
        let nuc_cand = mayr_db.values().find(|p| p.is_nucleophile && (sp1.contains(&p.id) || sp2.contains(&p.id)));
        let el_cand = mayr_db.values().find(|p| !p.is_nucleophile && (sp1.contains(&p.id) || sp2.contains(&p.id)));
        if let (Some(nuc), Some(el)) = (nuc_cand, el_cand) {
            let raw_k = calculate_mayr_rate(nuc, el, temp_k);
            let capped_k = apply_diffusion_cap(raw_k, temp_k, self.config.viscosity_pa_s);
            let adduct = format!("MayrAdduct_{}_{}", nuc.id, el.id);

            let delta_h = -55.0;
            let delta_s = -70.0;
            let delta_g = delta_h - (temp_k * delta_s / 1000.0);
            let k_eq = (-delta_g * 1000.0 / (R_IDEAL * temp_k)).exp().clamp(1e-15, 1e15);
            let k_rev = capped_k / k_eq;

            results.push(GeneratedReaction {
                id: format!("mayr_{}_{}", nuc.id, el.id),
                name: format!("Mayr Addition: {} + {}", nuc.name, el.name),
                family_id: "mayr_carbocation_addition".to_string(),
                equation: format!("{} + {} <=> {}", sp1, sp2, adduct),
                reactants: [(sp1.to_string(), 1.0), (sp2.to_string(), 1.0)].into(),
                products: [(adduct, 1.0)].into(),
                gas_products: HashMap::new(),
                k_fwd: capped_k,
                k_rev,
                arrhenius_a: capped_k,
                arrhenius_ea: 0.0,
                delta_h_kj: delta_h,
                delta_g_kj: delta_g,
                k_eq,
                tier: ProvenanceTier::Tabulated,
                source: "Mayr Reactivity Database".to_string(),
                formation_flux: 0.0,
            });
        }

        // 2. Structure-based Organic Transformations
        let mol1 = resolve_molecule(sp1);
        let mol2 = resolve_molecule(sp2);

        // Check if one partner is base/nucleophile OH- (or a hydroxide salt)
        let get_hydroxide_anion = |s: &str| -> Option<String> {
            if s == "OH-" {
                Some("OH-".to_string())
            } else if let Some(split) = crate::ions::decompose_ionic(s) {
                split.anions.into_iter().find(|a| a.id == "OH-").map(|a| a.id)
            } else {
                None
            }
        };
        let is_oh_base = |s: &str| get_hydroxide_anion(s).is_some();
        let is_water = |s: &str| {
            crate::ions::species_elements(s).map_or(false, |e| {
                e.get("H") == Some(&2.0) && e.get("O") == Some(&1.0) && e.len() == 2
            })
        };
        let is_halogen = |s: &str| {
            crate::ions::species_elements(s).map_or(false, |e| {
                e.len() == 1 && matches!(e.iter().next(), Some((sym, &2.0)) if matches!(sym.as_str(), "F" | "Cl" | "Br" | "I"))
            })
        };

        // --- A. Ester Hydrolysis (Base Saponification & Acid Hydrolysis) ---
        let ester_match = if let Some(ref m1) = mol1 {
            let esters = find_ester_groups(m1);
            if !esters.is_empty() { Some((sp1, m1, sp2, esters)) } else { None }
        } else {
            None
        }.or_else(|| {
            if let Some(ref m2) = mol2 {
                let esters = find_ester_groups(m2);
                if !esters.is_empty() { Some((sp2, m2, sp1, esters)) } else { None }
            } else {
                None
            }
        });

        if let Some((ester_id, ester_mol, other_id, esters)) = ester_match {
            for (c_carb, _o_carb, o_alkoxy, _c_alkyl) in esters {
                if is_oh_base(other_id) || medium.oh_conc > 10.0 * medium.h_conc {
                    // Saponification: ester + OH- -> carboxylate + alcohol
                    let (acyl_mol, alkoxy_mol) = cleave_ester(ester_mol, c_carb, o_alkoxy, true);
                    let acyl_id = register_or_find_species(&acyl_mol);
                    let alc_id = register_or_find_species(&alkoxy_mol);

                    // Arrhenius: A ~ 2.3e7, Ea ~ 47.5 kJ/mol -> k(298.15) = 0.1098 M^-1 s^-1 (~ 0.11 M^-1 s^-1 Gate 1)
                    let arr_a = 2.3e7;
                    let arr_ea = 47_500.0;
                    let k_fwd = arr_a * (-arr_ea / (R_IDEAL * temp_k)).exp();
                    let k_fwd_capped = apply_diffusion_cap(k_fwd, temp_k, self.config.viscosity_pa_s);
                    let delta_h_kj = -55.0;
                    let delta_g_kj = -50.0;
                    let k_eq = 1.0e8;
                    let k_rev = k_fwd_capped / k_eq;

                    let base_species = get_hydroxide_anion(other_id).unwrap_or_else(|| other_id.to_string());

                    results.push(GeneratedReaction {
                        id: format!("saponification_{}_{}", ester_id, base_species),
                        name: format!("Saponification of {} with {}", ester_id, base_species),
                        family_id: "base_ester_hydrolysis".to_string(),
                        equation: format!("{} + {} -> {} + {}", ester_id, base_species, acyl_id, alc_id),
                        reactants: [(ester_id.to_string(), 1.0), (base_species.to_string(), 1.0)].into(),
                        products: [(acyl_id, 1.0), (alc_id, 1.0)].into(),
                        gas_products: HashMap::new(),
                        k_fwd: k_fwd_capped,
                        k_rev,
                        arrhenius_a: arr_a,
                        arrhenius_ea: arr_ea,
                        delta_h_kj,
                        delta_g_kj,
                        k_eq,
                        tier: ProvenanceTier::Tabulated,
                        source: "Stage 9 Structure Template (Ester Saponification)".to_string(),
                        formation_flux: 0.0,
                    });
                } else if is_water(other_id) || medium.h_conc > 0.01 {
                    // Acid-catalyzed hydrolysis: ester + H2O -> carboxylic_acid + alcohol
                    let (acyl_mol, alkoxy_mol) = cleave_ester(ester_mol, c_carb, o_alkoxy, false);
                    let acid_id = register_or_find_species(&acyl_mol);
                    let alc_id = register_or_find_species(&alkoxy_mol);

                    let arr_a = 1.1e6 * (medium.h_conc / 0.1).clamp(0.01, 100.0);
                    let arr_ea = 62_000.0;
                    let k_fwd = arr_a * (-arr_ea / (R_IDEAL * temp_k)).exp();
                    let k_fwd_capped = apply_diffusion_cap(k_fwd, temp_k, self.config.viscosity_pa_s);
                    let delta_h_kj = 3.0;
                    let delta_g_kj = 2.5;
                    let k_eq = 0.25;
                    let k_rev = k_fwd_capped / k_eq;

                    results.push(GeneratedReaction {
                        id: format!("acid_hydrolysis_{}", ester_id),
                        name: format!("Acid-Catalyzed Hydrolysis of {}", ester_id),
                        family_id: "acid_ester_hydrolysis".to_string(),
                        equation: format!("{} + H2O <=> {} + {}", ester_id, acid_id, alc_id),
                        reactants: [(ester_id.to_string(), 1.0), ("H2O".to_string(), 1.0)].into(),
                        products: [(acid_id, 1.0), (alc_id, 1.0)].into(),
                        gas_products: HashMap::new(),
                        k_fwd: k_fwd_capped,
                        k_rev,
                        arrhenius_a: arr_a,
                        arrhenius_ea: arr_ea,
                        delta_h_kj,
                        delta_g_kj,
                        k_eq,
                        tier: ProvenanceTier::Tabulated,
                        source: "Stage 9 Structure Template (Acid Ester Hydrolysis)".to_string(),
                        formation_flux: 0.0,
                    });
                }
            }
        }

        // --- B. Haloalkane SN2 Substitution & E2 Elimination ---
        let halide_match = if let Some(ref m1) = mol1 {
            let halides = find_haloalkane_groups(m1);
            if !halides.is_empty() { Some((sp1, m1, sp2, halides)) } else { None }
        } else {
            None
        }.or_else(|| {
            if let Some(ref m2) = mol2 {
                let halides = find_haloalkane_groups(m2);
                if !halides.is_empty() { Some((sp2, m2, sp1, halides)) } else { None }
            } else {
                None
            }
        });

        if let Some((halide_id, halide_mol, base_id, halides)) = halide_match {
            if is_oh_base(base_id) || base_id.contains("O-") || base_id.contains("oxide") {
                let actual_base = get_hydroxide_anion(base_id).unwrap_or_else(|| base_id.to_string());
                let is_bulky_base = base_id.contains("tert") || base_id.contains("t-Bu") || base_id.contains("LDA");

                for (c_alpha, x_idx, halogen_sym) in halides {
                    let leaving_group = format!("{}-", halogen_sym);

                    // 1. SN2: R-X + OH- -> R-OH + X-
                    let alcohol_mol = haloalkane_sn2(halide_mol, c_alpha, x_idx);
                    let alc_id = register_or_find_species(&alcohol_mol);

                    // SN2 parameters: Ea = 89.5 kJ/mol, A = 4.0e9 M^-1 s^-1
                    let mut arr_a_sn2 = 4.0e9;
                    if is_bulky_base {
                        arr_a_sn2 *= 0.005; // 200x steric hindrance
                    }
                    let arr_ea_sn2 = 89_500.0;
                    let k_sn2 = arr_a_sn2 * (-arr_ea_sn2 / (R_IDEAL * temp_k)).exp();
                    let k_sn2_capped = apply_diffusion_cap(k_sn2, temp_k, self.config.viscosity_pa_s);

                    results.push(GeneratedReaction {
                        id: format!("sn2_{}_{}", halide_id, actual_base),
                        name: format!("SN2 Substitution on {}: {} + {}", halide_id, halide_id, actual_base),
                        family_id: "sn2_substitution".to_string(),
                        equation: format!("{} + {} -> {} + {}", halide_id, actual_base, alc_id, leaving_group),
                        reactants: [(halide_id.to_string(), 1.0), (actual_base.to_string(), 1.0)].into(),
                        products: [(alc_id, 1.0), (leaving_group.clone(), 1.0)].into(),
                        gas_products: HashMap::new(),
                        k_fwd: k_sn2_capped,
                        k_rev: 0.0,
                        arrhenius_a: arr_a_sn2,
                        arrhenius_ea: arr_ea_sn2,
                        delta_h_kj: -80.0,
                        delta_g_kj: -85.0,
                        k_eq: 1.0e12,
                        tier: ProvenanceTier::Tabulated,
                        source: "Stage 9 Structure Template (SN2)".to_string(),
                        formation_flux: 0.0,
                    });

                    // 2. E2: R-CH-CH-X + OH- -> R-C=C + H2O + X-
                    if let Some(alkene_mol) = haloalkane_e2(halide_mol, c_alpha, x_idx) {
                        let alkene_id = register_or_find_species(&alkene_mol);

                        // E2 parameters: Ea = 105.0 kJ/mol, A = 8.0e11 M^-1 s^-1 (Ea_E2 > Ea_SN2 -> elimination rises with T)
                        let mut arr_a_e2 = 8.0e11;
                        if is_bulky_base {
                            arr_a_e2 *= 3.0; // boosted with bulky base
                        }
                        let arr_ea_e2 = 105_000.0;
                        let k_e2 = arr_a_e2 * (-arr_ea_e2 / (R_IDEAL * temp_k)).exp();
                        let k_e2_capped = apply_diffusion_cap(k_e2, temp_k, self.config.viscosity_pa_s);

                        results.push(GeneratedReaction {
                            id: format!("e2_{}_{}", halide_id, actual_base),
                            name: format!("E2 Elimination on {}: {} + {}", halide_id, halide_id, actual_base),
                            family_id: "e2_elimination".to_string(),
                            equation: format!("{} + {} -> {} + H2O + {}", halide_id, actual_base, alkene_id, leaving_group),
                            reactants: [(halide_id.to_string(), 1.0), (actual_base.to_string(), 1.0)].into(),
                            products: [(alkene_id, 1.0), ("H2O".to_string(), 1.0), (leaving_group.clone(), 1.0)].into(),
                            gas_products: HashMap::new(),
                            k_fwd: k_e2_capped,
                            k_rev: 0.0,
                            arrhenius_a: arr_a_e2,
                            arrhenius_ea: arr_ea_e2,
                            delta_h_kj: -35.0,
                            delta_g_kj: -45.0,
                            k_eq: 1.0e10,
                            tier: ProvenanceTier::Tabulated,
                            source: "Stage 9 Structure Template (E2)".to_string(),
                            formation_flux: 0.0,
                        });
                    }
                }
            }
        }

        // --- C. Alkene Additions (Hydration & Halogenation) ---
        let alkene_match = if let Some(ref m1) = mol1 {
            let alkenes = find_alkene_groups(m1);
            if !alkenes.is_empty() { Some((sp1, m1, sp2, alkenes)) } else { None }
        } else {
            None
        }.or_else(|| {
            if let Some(ref m2) = mol2 {
                let alkenes = find_alkene_groups(m2);
                if !alkenes.is_empty() { Some((sp2, m2, sp1, alkenes)) } else { None }
            } else {
                None
            }
        });

        if let Some((alkene_id, alkene_mol, other_id, alkenes)) = alkene_match {
            for (c1, c2) in alkenes {
                if is_water(other_id) {
                    // Hydration: alkene + H2O -> alcohol
                    let alc_mol = alkene_hydration(alkene_mol, c1, c2);
                    let alc_id = register_or_find_species(&alc_mol);

                    let arr_a = 1.0e6 * (medium.h_conc / 0.1).clamp(0.01, 100.0);
                    let arr_ea = 70_000.0;
                    let k_fwd = arr_a * (-arr_ea / (R_IDEAL * temp_k)).exp();
                    let k_fwd_capped = apply_diffusion_cap(k_fwd, temp_k, self.config.viscosity_pa_s);

                    results.push(GeneratedReaction {
                        id: format!("hydration_{}", alkene_id),
                        name: format!("Hydration of {}: {} + H2O", alkene_id, alkene_id),
                        family_id: "alkene_hydration".to_string(),
                        equation: format!("{} + H2O <=> {}", alkene_id, alc_id),
                        reactants: [(alkene_id.to_string(), 1.0), ("H2O".to_string(), 1.0)].into(),
                        products: [(alc_id, 1.0)].into(),
                        gas_products: HashMap::new(),
                        k_fwd: k_fwd_capped,
                        k_rev: k_fwd_capped / 100.0,
                        arrhenius_a: arr_a,
                        arrhenius_ea: arr_ea,
                        delta_h_kj: -45.0,
                        delta_g_kj: -15.0,
                        k_eq: 100.0,
                        tier: ProvenanceTier::Tabulated,
                        source: "Stage 9 Structure Template (Alkene Hydration)".to_string(),
                        formation_flux: 0.0,
                    });
                } else if is_halogen(other_id) {
                    // Halogenation: alkene + X2 -> dihaloalkane
                    let hal_sym = crate::ions::species_elements(other_id)
                        .and_then(|e| e.into_keys().next())
                        .unwrap_or_else(|| "Br".to_string());
                    let dihalo_mol = alkene_halogenation(alkene_mol, c1, c2, &hal_sym);
                    let dihalo_id = register_or_find_species(&dihalo_mol);

                    let arr_a = 5.0e8;
                    let arr_ea = 28_000.0;
                    let k_fwd = arr_a * (-arr_ea / (R_IDEAL * temp_k)).exp();
                    let k_fwd_capped = apply_diffusion_cap(k_fwd, temp_k, self.config.viscosity_pa_s);

                    results.push(GeneratedReaction {
                        id: format!("halogenation_{}_{}", alkene_id, other_id),
                        name: format!("Halogenation of {}: {} + {}", alkene_id, alkene_id, other_id),
                        family_id: "alkene_halogenation".to_string(),
                        equation: format!("{} + {} -> {}", alkene_id, other_id, dihalo_id),
                        reactants: [(alkene_id.to_string(), 1.0), (other_id.to_string(), 1.0)].into(),
                        products: [(dihalo_id, 1.0)].into(),
                        gas_products: HashMap::new(),
                        k_fwd: k_fwd_capped,
                        k_rev: 0.0,
                        arrhenius_a: arr_a,
                        arrhenius_ea: arr_ea,
                        delta_h_kj: -120.0,
                        delta_g_kj: -95.0,
                        k_eq: 1.0e14,
                        tier: ProvenanceTier::Tabulated,
                        source: "Stage 9 Structure Template (Alkene Halogenation)".to_string(),
                        formation_flux: 0.0,
                    });
                }
            }
        }

        results
    }

    fn eval_kinetics(&self, family_id: &str, temp_k: f64, medium: Medium) -> (f64, f64, f64, f64, f64, f64) {
        let fam = self.families.iter().find(|f| f.id == family_id);
        let (mut a, mut ea, n, delta_h_kj, delta_s_j_k, is_rev) = match fam {
            Some(f) => (f.arrhenius_a, f.arrhenius_ea, f.arrhenius_n, f.delta_h_kj, f.delta_s_j_k, f.is_reversible),
            None => (1.0e8, 65_000.0, 0.0, 0.0, 0.0, true),
        };

        if let Some(&dg_kcal) = self.config.precomputed_barriers.get(family_id) {
            ea = dg_kcal * 4184.0;
            a = 1.0e11;
        }

        let exp_arg = (-ea / (R_IDEAL * temp_k)).clamp(-100.0, 100.0);
        let mut k_fwd = a * temp_k.powf(n) * exp_arg.exp();

        if let Some(f) = fam {
            match f.catalysis {
                CatalysisType::Acid => k_fwd *= (medium.h_conc / 0.1).clamp(0.01, 100.0),
                CatalysisType::Base => k_fwd *= (medium.oh_conc / 0.1).clamp(0.01, 100.0),
                CatalysisType::BothAcidBase => k_fwd *= (medium.h_conc * 10.0 + 1e-4 + medium.oh_conc * 10.0).clamp(1e-4, 10.0),
                _ => {}
            }
        }

        let delta_g_j = delta_h_kj * 1000.0 - temp_k * delta_s_j_k;
        let delta_g_kj = delta_g_j / 1000.0;
        let k_eq = (-delta_g_j / (R_IDEAL * temp_k)).clamp(-50.0, 50.0).exp().max(1e-15);
        let k_rev = if is_rev { (k_fwd / k_eq).max(0.0) } else { 0.0 };

        (a, ea, k_fwd, k_rev, k_eq, delta_g_kj)
    }
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
            let mut phases = HashMap::new();
            let phase_tag = if net_charge != 0 { "aq" } else { "l" };
            let df_h = -100.0;
            let cp = 75.0;
            let s = 150.0;
            phases.insert(phase_tag.to_string(), crate::db::record::PhaseData {
                thermo: Some(crate::db::record::PhaseThermo {
                    model: "point+cp".to_string(),
                    tier: ProvenanceTier::Estimated,
                    source: "Stage 9 Organic Structure Generator".to_string(),
                    dfH: Some(crate::db::record::Datum::new(df_h, "kJ/mol", ProvenanceTier::Estimated, "Estimated")),
                    dfG: Some(crate::db::record::Datum::new(df_h - 298.15 * s / 1000.0, "kJ/mol", ProvenanceTier::Estimated, "Estimated")),
                    S: Some(crate::db::record::Datum::new(s, "J/(mol K)", ProvenanceTier::Estimated, "Estimated")),
                    cp: Some(crate::db::record::Datum::new(cp, "J/(mol K)", ProvenanceTier::Estimated, "Estimated")),
                    ranges: None,
                    params: None,
                }),
                volume: None,
                rho: None,
                polymorph: None,
            });

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
                points: Vec::new(),
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
                if (order - 1.0).abs() < 1e-9 && mol.atoms[c_alpha].element == "C" && !mol.atoms[c_alpha].aromatic {
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

/// E2 elimination: eliminates halogen and adjacent beta-hydrogen, forming a C=C double bond.
pub fn haloalkane_e2(mol: &Molecule, c_alpha: usize, x_idx: usize) -> Option<Molecule> {
    // Find adjacent beta-carbon with at least one hydrogen
    let nb = mol.neighbours(c_alpha);
    let c_beta = nb.iter().find(|&&(nbr, _)| {
        nbr != x_idx && mol.atoms[nbr].element == "C" && !mol.atoms[nbr].aromatic && mol.hydrogens(nbr) >= 1
    }).map(|&(nbr, _)| nbr)?;

    let keep_atoms: HashSet<usize> = (0..mol.atoms.len()).filter(|&i| i != x_idx).collect();
    let mut sub = extract_submolecule(mol, &keep_atoms);

    // Modify bond between c_alpha and c_beta in submolecule to double bond (2.0)
    // Find old-to-new mapping for c_alpha and c_beta
    let mut sorted: Vec<usize> = keep_atoms.into_iter().collect();
    sorted.sort();
    let na = sorted.iter().position(|&x| x == c_alpha)?;
    let nb = sorted.iter().position(|&x| x == c_beta)?;

    for b in sub.bonds.iter_mut() {
        if (b.0 == na && b.1 == nb) || (b.0 == nb && b.1 == na) {
            b.2 = 2.0;
            break;
        }
    }

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

/// Alkene hydration: adds H to c1 and OH to c2, turning C=C into C-C alcohol.
pub fn alkene_hydration(mol: &Molecule, c1: usize, c2: usize) -> Molecule {
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
