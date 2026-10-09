//! Shared helpers of the measured-rate harness (`tests/measured_rates.rs`, `examples/rates_coverage.rs`,
//! `examples/rates_probe.rs`): they build the network of a measured row's reactants and find the reaction the row
//! describes, so a row is evaluated against what the engine really generates, not against a copy of the row.
//!
//! Species are named by their SMILES (`network_generator::resolve_molecule` reads a species id as SMILES first), water is
//! the solvent, and the medium (pH) follows the template variant (base 13, acid 1, otherwise neutral).

use std::collections::HashMap;

use crate::network_generator::{GeneratedReaction, NetworkGenerator, NetworkGeneratorConfig};
use crate::physics::R_GAS;
use crate::rate_store;
use crate::smiles;

/// A template id with its variant tag as the rate store keys it (`acid_ester_hydrolysis_acid`).
pub fn is_acid_template(template: &str) -> bool {
    template.ends_with("_acid")
}

/// pH of the medium a template's rate is stated in.
pub fn ph_for(template: &str) -> f64 {
    if is_acid_template(template) {
        1.0
    } else if matches!(template, "base_ester_hydrolysis" | "amide_base_hydrolysis" | "carbamate_base_hydrolysis" | "phosphoryl_ester_base_hydrolysis" | "alkyl_sulfate_base_hydrolysis" | "sn2_substitution" | "e2_elimination") {
        13.0
    } else {
        7.0
    }
}

/// The species id of a SMILES: the store's id when it holds the molecule (`OH-`, `H2O`, ethyl acetate), else a new record
/// (`network_generator::register_or_find_species`; the generator needs every species registered).
pub fn species_id(smiles_str: &str) -> Option<String> {
    let mol = smiles::parse(smiles_str)?.perceived();
    Some(crate::network_generator::register_or_find_species(&mol))
}

/// The reactions (core and edge) the engine generates from `reactants` (SMILES) at `t_k` in a solvent class.
pub fn generate(template: &str, reactants: &[String], t_k: f64, solvent_class: &str) -> Vec<GeneratedReaction> {
    let ph = ph_for(template);
    let mut concs: HashMap<String, f64> = HashMap::new();
    for r in reactants {
        if let Some(id) = species_id(r) {
            concs.insert(id, 0.1);
        }
    }
    if solvent_class == "water" {
        concs.insert(crate::db::seed::WATER.to_string(), 55.5);
    }
    let net = NetworkGenerator::new(NetworkGeneratorConfig::default()).generate_network_in(&concs, t_k, ph, solvent_class);
    let mut all = net.reactions;
    all.extend(net.edge);
    all
}

/// The structural key (without the solvent suffix) a row's reaction has under its template variant.
pub fn row_key(template: &str, reactants: &[String], products: &[String]) -> Option<String> {
    let parse = |v: &[String]| v.iter().map(|s| smiles::parse(s).map(|m| m.perceived())).collect::<Option<Vec<_>>>();
    let (r, p) = (parse(reactants)?, parse(products)?);
    Some(rate_store::reaction_key(template, &r.iter().collect::<Vec<_>>(), &p.iter().collect::<Vec<_>>()))
}

/// The generated reaction that a row describes: same structural key under its template variant.
pub fn find_reaction(template: &str, reactants: &[String], products: &[String], t_k: f64, solvent_class: &str) -> Option<GeneratedReaction> {
    let key = row_key(template, reactants, products)?;
    generate(template, reactants, t_k, solvent_class).into_iter().find(|g| g.rate_key == key)
}

/// Rate constant (per unit of the template's catalysts, M^(1-n) s^-1) of the template rule's estimate at `t_k`, all
/// pathways of the reaction together (a Mayr rate is already per reaction).
pub fn rule_k(g: &GeneratedReaction, t_k: f64) -> f64 {
    let pathways = if g.rate_per_reaction { 1.0 } else { g.pathways.max(1) as f64 };
    g.template_a * pathways * (-g.template_ea_j_mol / (R_GAS * t_k)).exp()
}

/// Rate constant of what the engine uses (stored rate or rule), per unit of catalysts, at `t_k`.
pub fn engine_k(g: &GeneratedReaction, t_k: f64) -> f64 {
    g.arrhenius_a * (-g.arrhenius_ea / (R_GAS * t_k)).exp()
}
