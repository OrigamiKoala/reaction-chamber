import type { CompoundRecord, CurvePoint, PhaseData, PhaseThermo } from '../record';
import type { SpeciesRecord as LegacySpeciesRecord } from '../../types';
import { generateCanonicalId } from '../identity';

export class PubchemTextProvider {
  /**
   * Converts a parsed legacy SpeciesRecord (from pubchem/record_builder.ts) into the canonical CompoundRecord.
   */
  convertLegacy(legacy: LegacySpeciesRecord): CompoundRecord {
    const points: CurvePoint[] = [];

    // Melting point -> CurvePoint kind: 'tm'
    if (legacy.known?.mp_c && legacy.mp_c !== undefined) {
      points.push({
        kind: 'tm',
        T_K: legacy.mp_c + 273.15,
        P_Pa: 101325,
        tier: 'imported',
        source: 'PubChem Experimental Melting Point',
      });
    }

    // Boiling point -> CurvePoint kind: 'tb' and 'psat'
    if (legacy.known?.bp_c && legacy.bp_c !== undefined) {
      const tb_k = legacy.bp_c + 273.15;
      points.push({
        kind: 'tb',
        T_K: tb_k,
        P_Pa: 101325,
        tier: 'imported',
        source: 'PubChem Experimental Boiling Point',
      });
      points.push({
        kind: 'psat',
        T_K: tb_k,
        P_Pa: 101325,
        tier: 'imported',
        source: 'PubChem Boiling Point (1 atm)',
      });
    }

    // Additional vapour pressure points
    if (legacy.physical?.vapor_pressure_points) {
      for (const [t_k, p_pa] of legacy.physical.vapor_pressure_points) {
        points.push({
          kind: 'psat',
          T_K: t_k,
          P_Pa: p_pa,
          tier: 'imported',
          source: 'PubChem Vapor Pressure text',
        });
      }
    }

    // Solubility in water
    if (legacy.physical?.solubility_g_per_l !== undefined) {
      points.push({
        kind: 'solubility',
        solvent: 'water',
        T_K: 298.15,
        value: legacy.physical.solubility_g_per_l,
        unit: 'g/L',
        tier: 'imported',
        source: 'PubChem Water Solubility',
      });
    }

    // Phases
    const phases: Record<string, PhaseData> = {};

    if (legacy.physical?.dhf_kj_mol !== undefined) {
      const ph = legacy.physical.dhf_phase === 'solid' ? 's' : legacy.physical.dhf_phase === 'gas' ? 'g' : 'l';
      const thermo: PhaseThermo = {
        model: 'point+cp',
        tier: 'imported',
        source: 'PubChem / NIST',
        dfH: {
          value: legacy.physical.dhf_kj_mol,
          unit: 'kJ/mol',
          T_K: 298.15,
          tier: 'imported',
          source: 'PubChem / NIST via WebBook',
        },
      };
      phases[ph] = { thermo };
    }

    const identity = {
      inchikey: legacy.inchi_key,
      smiles: legacy.smiles,
      formula: legacy.formula,
      charge: legacy.charge,
      cid: legacy.cid,
      names: legacy.name ? [legacy.name] : [],
    };

    const id = generateCanonicalId(identity);

    return {
      id,
      identity,
      phases,
      points,
      acid_base: [],
      redox: [],
      rejected: (legacy.physical?.rejected || []).map((r) => ({ reason: r })),
    };
  }
}
