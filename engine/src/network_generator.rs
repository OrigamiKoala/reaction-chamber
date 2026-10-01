//! M6 Chemical Reaction Network Generator.
//! RMG-style rate-based expansion, candidate filtering via formation flux,
//! reversibility via thermodynamic K_eq(T), Stokes-Einstein diffusion capping,
//! and strict species & reaction bounds (hard caps: 200 species, 500 reactions).

use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};

use crate::types::ProvenanceTier;
use crate::templates::{
    self, CatalysisType, ReactionFamily, R_IDEAL,
    calculate_mayr_rate, apply_diffusion_cap,
};

pub const DEFAULT_MAX_ACTIVE_SPECIES: usize = 200;
pub const DEFAULT_MAX_REACTIONS: usize = 500;
pub const DEFAULT_FLUX_THRESHOLD_ABS: f64 = 1.0e-8; // M/s

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

    /// Primary M6 entrypoint:
    /// Given existing species and their concentrations (M), live pH, and temperature (K),
    /// generates an expanded, flux-filtered, thermodynamically reversible reaction network.
    pub fn generate_network(
        &self,
        initial_concs: &HashMap<String, f64>,
        temp_k: f64,
        ph: f64,
    ) -> GeneratedNetwork {
        let t = if temp_k <= 100.0 || temp_k.is_nan() { 298.15 } else { temp_k };
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

            // 1. Unimolecular candidate generation (e.g. keto-enol tautomerism, elimination, rearrangement)
            let unimol_rxns = self.match_unimolecular(&current_sp, t, ph, &mayr_db);
            for cand in unimol_rxns {
                if seen_reaction_ids.contains(&cand.id) {
                    continue;
                }

                let reactant_conc = species_concs.get(&current_sp).copied().unwrap_or(0.0);
                let flux = cand.k_fwd * reactant_conc;

                if flux >= self.config.flux_threshold_abs || generated_reactions.len() < 10 {
                    seen_reaction_ids.insert(cand.id.clone());
                    total_flux += flux;

                    // Promote candidate products
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

            // 2. Bimolecular candidate generation with all currently known active species
            let partners: Vec<String> = active_species_set.iter().cloned().collect();
            for partner_sp in partners {
                if generated_reactions.len() >= self.config.max_reactions {
                    cap_reached = true;
                    break;
                }

                let bimol_rxns = self.match_bimolecular(&current_sp, &partner_sp, t, ph, &mayr_db);
                for cand in bimol_rxns {
                    if seen_reaction_ids.contains(&cand.id) {
                        continue;
                    }

                    let c1 = species_concs.get(&current_sp).copied().unwrap_or(0.0);
                    let c2 = species_concs.get(&partner_sp).copied().unwrap_or(0.0);
                    let flux = cand.k_fwd * c1 * c2;

                    // Promote candidate products if flux exceeds threshold
                    if flux >= self.config.flux_threshold_abs || generated_reactions.len() < 10 {
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
        ph: f64,
        _mayr_db: &HashMap<String, templates::MayrParameter>,
    ) -> Vec<GeneratedReaction> {
        let mut results = Vec::new();

        // Check tautomerism, unimolecular eliminations, or rearrangements
        for fam in &self.families {
            if fam.category == "tautomerism" && (species.contains("CHO") || species.contains("CO") || species.contains("one")) {
                let (k_fwd, k_rev, k_eq, delta_g) = self.compute_rate_and_equilibrium(fam, temp_k, ph, false, false);
                let prod = format!("{}_enol", species);
                results.push(GeneratedReaction {
                    id: format!("{}_{}", fam.id, species),
                    name: format!("{} on {}", fam.name, species),
                    family_id: fam.id.clone(),
                    equation: format!("{} <-> {}", species, prod),
                    reactants: [(species.to_string(), 1.0)].into(),
                    products: [(prod, 1.0)].into(),
                    gas_products: HashMap::new(),
                    k_fwd,
                    k_rev,
                    delta_h_kj: fam.delta_h_kj,
                    delta_g_kj: delta_g,
                    k_eq,
                    tier: ProvenanceTier::Estimated,
                    source: "M6 Template Rate Rule".to_string(),
                    formation_flux: 0.0,
                });
            } else if fam.id == "sn1_solvolysis" && species.contains("tert") && (species.contains("Cl") || species.contains("Br")) {
                let (k_fwd, k_rev, k_eq, delta_g) = self.compute_rate_and_equilibrium(fam, temp_k, ph, false, false);
                let alcohol = format!("{}_alcohol", species.replace("Cl", "").replace("Br", ""));
                results.push(GeneratedReaction {
                    id: format!("{}_{}", fam.id, species),
                    name: format!("{} on {}", fam.name, species),
                    family_id: fam.id.clone(),
                    equation: format!("{} + H2O -> {} + HX", species, alcohol),
                    reactants: [(species.to_string(), 1.0), ("H2O".to_string(), 1.0)].into(),
                    products: [(alcohol, 1.0), ("H+".to_string(), 1.0), ("Cl-".to_string(), 1.0)].into(),
                    gas_products: HashMap::new(),
                    k_fwd,
                    k_rev,
                    delta_h_kj: fam.delta_h_kj,
                    delta_g_kj: delta_g,
                    k_eq,
                    tier: ProvenanceTier::Estimated,
                    source: "M6 Rate Rule".to_string(),
                    formation_flux: 0.0,
                });
            }
        }

        results
    }

    fn match_bimolecular(
        &self,
        sp1: &str,
        sp2: &str,
        temp_k: f64,
        ph: f64,
        mayr_db: &HashMap<String, templates::MayrParameter>,
    ) -> Vec<GeneratedReaction> {
        let mut results = Vec::new();

        // 1. Mayr parameter matching (Provider 2)
        let nuc_cand = mayr_db.values().find(|p| p.is_nucleophile && (sp1.contains(&p.id) || sp2.contains(&p.id)));
        let el_cand = mayr_db.values().find(|p| !p.is_nucleophile && (sp1.contains(&p.id) || sp2.contains(&p.id)));

        if let (Some(nuc), Some(el)) = (nuc_cand, el_cand) {
            let raw_k = calculate_mayr_rate(nuc, el, temp_k);
            let capped_k = apply_diffusion_cap(raw_k, temp_k, self.config.viscosity_pa_s);
            let adduct = format!("MayrAdduct_{}_{}", nuc.id, el.id);

            // Reversibility
            let delta_h = -55.0; // kJ/mol
            let delta_s = -70.0; // J/(mol·K)
            let delta_g = delta_h - (temp_k * delta_s / 1000.0);
            let k_eq = (-delta_g * 1000.0 / (R_IDEAL * temp_k)).exp().clamp(1e-15, 1e15);
            let k_rev = capped_k / k_eq;

            results.push(GeneratedReaction {
                id: format!("mayr_{}_{}", nuc.id, el.id),
                name: format!("Mayr Polar Addition: {} + {}", nuc.name, el.name),
                family_id: "mayr_carbocation_addition".to_string(),
                equation: format!("{} + {} <-> {}", sp1, sp2, adduct),
                reactants: [(sp1.to_string(), 1.0), (sp2.to_string(), 1.0)].into(),
                products: [(adduct, 1.0)].into(),
                gas_products: HashMap::new(),
                k_fwd: capped_k,
                k_rev,
                delta_h_kj: delta_h,
                delta_g_kj: delta_g,
                k_eq,
                tier: ProvenanceTier::Tabulated,
                source: "Mayr Reactivity Database".to_string(),
                formation_flux: 0.0,
            });
        }

        // 2. SN2 and E2 competition
        let is_halide = |s: &str| s.contains("Br") || s.contains("Cl") || s.contains("I") || s.contains("bromo") || s.contains("chloro");
        let is_base = |s: &str| s.contains("OH") || s.contains("oxide") || s.contains("O-") || s.contains("NH3") || s.contains("amine") || s.contains("BuO");
        let is_bulky = |s: &str| s.contains("tert") || s.contains("t-Bu") || s.contains("bulky") || s.contains("LDA");

        if (is_halide(sp1) && is_base(sp2)) || (is_halide(sp2) && is_base(sp1)) {
            let (halide, base) = if is_halide(sp1) { (sp1, sp2) } else { (sp2, sp1) };
            let bulky = is_bulky(base);

            // Family SN2
            if let Some(fam_sn2) = self.families.iter().find(|f| f.id == "sn2_secondary_halide") {
                let (mut k_fwd, k_rev, k_eq, delta_g) = self.compute_rate_and_equilibrium(fam_sn2, temp_k, ph, bulky, false);
                if bulky {
                    k_fwd *= fam_sn2.base_steric_penalty; // heavily penalize SN2
                }
                k_fwd = apply_diffusion_cap(k_fwd, temp_k, self.config.viscosity_pa_s);

                let subst_prod = format!("{}_subst", halide.replace("Br", "").replace("Cl", ""));
                results.push(GeneratedReaction {
                    id: format!("sn2_{}_{}", halide, base),
                    name: format!("SN2 Substitution: {} + {}", halide, base),
                    family_id: fam_sn2.id.clone(),
                    equation: format!("{} + {} -> {} + Halide-", halide, base, subst_prod),
                    reactants: [(halide.to_string(), 1.0), (base.to_string(), 1.0)].into(),
                    products: [(subst_prod, 1.0), ("Br-".to_string(), 1.0)].into(),
                    gas_products: HashMap::new(),
                    k_fwd,
                    k_rev,
                    delta_h_kj: fam_sn2.delta_h_kj,
                    delta_g_kj: delta_g,
                    k_eq,
                    tier: ProvenanceTier::Tabulated,
                    source: "M6 Template (Literature SN2)".to_string(),
                    formation_flux: 0.0,
                });
            }

            // Family E2
            if let Some(fam_e2) = self.families.iter().find(|f| f.id == "e2_elimination") {
                let (mut k_fwd, k_rev, k_eq, delta_g) = self.compute_rate_and_equilibrium(fam_e2, temp_k, ph, false, bulky);
                if bulky {
                    k_fwd *= fam_e2.base_elimination_boost; // boost E2 with bulky base
                }
                k_fwd = apply_diffusion_cap(k_fwd, temp_k, self.config.viscosity_pa_s);

                let alkene_prod = format!("{}_alkene", halide.replace("Br", "").replace("Cl", ""));
                results.push(GeneratedReaction {
                    id: format!("e2_{}_{}", halide, base),
                    name: format!("E2 Elimination: {} + {}", halide, base),
                    family_id: fam_e2.id.clone(),
                    equation: format!("{} + {} -> {} + BH + Halide-", halide, base, alkene_prod),
                    reactants: [(halide.to_string(), 1.0), (base.to_string(), 1.0)].into(),
                    products: [(alkene_prod, 1.0), ("Br-".to_string(), 1.0)].into(),
                    gas_products: HashMap::new(),
                    k_fwd,
                    k_rev,
                    delta_h_kj: fam_e2.delta_h_kj,
                    delta_g_kj: delta_g,
                    k_eq,
                    tier: ProvenanceTier::Tabulated,
                    source: "M6 Template (Literature E2)".to_string(),
                    formation_flux: 0.0,
                });
            }
        }

        // 3. Ester Hydrolysis & Saponification
        let is_ester = |s: &str| s.contains("acetate") || s.contains("benzoate") || s.contains("ester") || s.contains("EtOAc");
        let is_water_or_oh = |s: &str| s == "H2O" || s == "OH-" || s == "NaOH";

        if (is_ester(sp1) && is_water_or_oh(sp2)) || (is_ester(sp2) && is_water_or_oh(sp1)) {
            let (ester, water_or_oh) = if is_ester(sp1) { (sp1, sp2) } else { (sp2, sp1) };
            let is_basic = water_or_oh.contains("OH") || ph > 7.5;

            let fam_id = if is_basic { "base_ester_hydrolysis" } else { "acid_ester_hydrolysis" };
            if let Some(fam) = self.families.iter().find(|f| f.id == fam_id) {
                let (k_fwd, k_rev, k_eq, delta_g) = self.compute_rate_and_equilibrium(fam, temp_k, ph, false, false);
                let capped_k = apply_diffusion_cap(k_fwd, temp_k, self.config.viscosity_pa_s);

                let acid_prod = format!("{}_acid", ester);
                let alc_prod = format!("{}_alcohol", ester);

                results.push(GeneratedReaction {
                    id: format!("{}_{}_{}", fam.id, ester, water_or_oh),
                    name: format!("{} on {}", fam.name, ester),
                    family_id: fam.id.clone(),
                    equation: format!("{} + {} -> {} + {}", ester, water_or_oh, acid_prod, alc_prod),
                    reactants: [(ester.to_string(), 1.0), (water_or_oh.to_string(), 1.0)].into(),
                    products: [(acid_prod, 1.0), (alc_prod, 1.0)].into(),
                    gas_products: HashMap::new(),
                    k_fwd: capped_k,
                    k_rev,
                    delta_h_kj: fam.delta_h_kj,
                    delta_g_kj: delta_g,
                    k_eq,
                    tier: ProvenanceTier::Tabulated,
                    source: "M6 Template (Ester Hydrolysis)".to_string(),
                    formation_flux: 0.0,
                });
            }
        }

        // 4. Alkene Halogenation / Addition
        let is_alkene = |s: &str| s.contains("ene") || s.contains("Alkene") || s.contains("cyclohexene");
        let is_halogen = |s: &str| s == "Br2" || s == "Cl2" || s == "I2";

        if (is_alkene(sp1) && is_halogen(sp2)) || (is_alkene(sp2) && is_halogen(sp1)) {
            let (alkene, hal) = if is_alkene(sp1) { (sp1, sp2) } else { (sp2, sp1) };
            if let Some(fam) = self.families.iter().find(|f| f.id == "alkene_bromination") {
                let (k_fwd, k_rev, k_eq, delta_g) = self.compute_rate_and_equilibrium(fam, temp_k, ph, false, false);
                let capped_k = apply_diffusion_cap(k_fwd, temp_k, self.config.viscosity_pa_s);
                let dihalide = format!("{}_{}_adduct", alkene, hal);

                results.push(GeneratedReaction {
                    id: format!("halogenation_{}_{}", alkene, hal),
                    name: format!("Electrophilic Halogenation: {} + {}", alkene, hal),
                    family_id: fam.id.clone(),
                    equation: format!("{} + {} -> {}", alkene, hal, dihalide),
                    reactants: [(alkene.to_string(), 1.0), (hal.to_string(), 1.0)].into(),
                    products: [(dihalide, 1.0)].into(),
                    gas_products: HashMap::new(),
                    k_fwd: capped_k,
                    k_rev,
                    delta_h_kj: fam.delta_h_kj,
                    delta_g_kj: delta_g,
                    k_eq,
                    tier: ProvenanceTier::Tabulated,
                    source: "M6 Template (Alkene Halogenation)".to_string(),
                    formation_flux: 0.0,
                });
            }
        }

        results
    }

    /// Computes Arrhenius forward rate, thermodynamic equilibrium constant K_eq(T),
    /// reverse rate k_rev = k_fwd / K_eq, and Delta G°
    fn compute_rate_and_equilibrium(
        &self,
        fam: &ReactionFamily,
        temp_k: f64,
        ph: f64,
        _is_bulky_base_sn2: bool,
        _is_bulky_base_e2: bool,
    ) -> (f64, f64, f64, f64) {
        let t = if temp_k <= 100.0 || temp_k.is_nan() { 298.15 } else { temp_k };

        // Check if precomputed calibrated barrier exists in Provider 3
        let mut ea = fam.arrhenius_ea;
        let mut a = fam.arrhenius_a;
        if let Some(&delta_g_ddagger_kcal) = self.config.precomputed_barriers.get(&fam.id) {
            // Delta G‡ in J/mol:
            let delta_g_j = delta_g_ddagger_kcal * 4184.0;
            ea = delta_g_j;
            a = 1.0e11; // Eyring pre-exponential scale
        }

        // Base Arrhenius rate
        let exp_arg = (-ea / (R_IDEAL * t)).clamp(-100.0, 100.0);
        let mut k_fwd = a * t.powf(fam.arrhenius_n) * exp_arg.exp();

        // Acid / Base Catalysis Scaling
        match fam.catalysis {
            CatalysisType::Acid => {
                let h_conc = 10.0_f64.powf(-ph.clamp(0.0, 14.0));
                k_fwd *= h_conc / 0.1; // Normalized to 0.1 M H+
            }
            CatalysisType::Base => {
                let oh_conc = 10.0_f64.powf(-(14.0 - ph.clamp(0.0, 14.0)));
                k_fwd *= oh_conc / 0.1; // Normalized to 0.1 M OH-
            }
            CatalysisType::BothAcidBase => {
                let h_conc = 10.0_f64.powf(-ph.clamp(0.0, 14.0));
                let oh_conc = 10.0_f64.powf(-(14.0 - ph.clamp(0.0, 14.0)));
                let cat_factor = (h_conc * 10.0 + 1e-4 + oh_conc * 10.0).clamp(1e-4, 10.0);
                k_fwd *= cat_factor;
            }
            _ => {}
        }

        // Thermodynamics & Reversibility:
        // Delta G° = Delta H° - T * Delta S°
        let delta_h_j = fam.delta_h_kj * 1000.0;
        let delta_s_j = fam.delta_s_j_k;
        let delta_g_j = delta_h_j - (t * delta_s_j);
        let delta_g_kj = delta_g_j / 1000.0;

        // K_eq = exp(-Delta G° / (R * T))
        let k_eq_arg = (-delta_g_j / (R_IDEAL * t)).clamp(-50.0, 50.0);
        let k_eq = k_eq_arg.exp().max(1e-15);

        let k_rev = if fam.is_reversible {
            (k_fwd / k_eq).max(0.0)
        } else {
            0.0
        };

        (k_fwd, k_rev, k_eq, delta_g_kj)
    }
}
