import type { CompoundRecord, RejectedDatum } from './record';

export interface GateResult {
  accepted: boolean;
  rejected: RejectedDatum[];
}

export function applyConsistencyGates(record: CompoundRecord): GateResult {
  const rejected: RejectedDatum[] = [];

  // 1. Check phase thermo consistency: delta G = delta H - T * delta S at 298.15 K
  for (const [phaseKey, phaseData] of Object.entries(record.phases)) {
    if (phaseData.thermo) {
      const { dfH, dfG, S } = phaseData.thermo;
      if (dfH && dfG && S) {
        const T = 298.15;
        // dfH in kJ/mol, S in J/(mol K) -> S / 1000 in kJ/(mol K)
        const calcG = dfH.value - (T * S.value) / 1000.0;
        const diff = Math.abs(calcG - dfG.value);
        if (diff > 50.0) { // allow margin for reference states
          rejected.push({
            datum: { phase: phaseKey, dfH: dfH.value, dfG: dfG.value, S: S.value },
            reason: `Thermodynamic inconsistency in phase ${phaseKey}: ΔG (${dfG.value}) differs from ΔH - TΔS (${calcG.toFixed(1)}) by ${diff.toFixed(1)} kJ/mol`,
          });
        }
      }
    }
  }

  // 2. Check Trouton ratio if we have Tb point and dh_vap
  const tbPoint = record.points?.find((p) => p.kind === 'tb' && p.T_K && p.T_K > 0);
  const psatPoints = record.points?.filter((p) => p.kind === 'psat');
  if (tbPoint?.T_K && record.phases.l?.thermo?.dfH && record.phases.g?.thermo?.dfH) {
    const dhVapJ = (record.phases.g.thermo.dfH.value - record.phases.l.thermo.dfH.value) * 1000.0;
    const trouton = dhVapJ / tbPoint.T_K;
    if (trouton < 40.0 || trouton > 180.0) {
      rejected.push({
        datum: { tb: tbPoint.T_K, dh_vap_j_mol: dhVapJ, trouton },
        reason: `Trouton ratio ${trouton.toFixed(1)} J/(mol K) outside physical bounds (40 - 180 J/(mol K))`,
      });
    }
  }

  // 3. Walden rule check for melting if Tm and dh_fus are present
  const tmPoint = record.points?.find((p) => p.kind === 'tm' && p.T_K && p.T_K > 0);
  if (tmPoint?.T_K && record.phases.s?.thermo?.dfH && record.phases.l?.thermo?.dfH) {
    const dhFusJ = (record.phases.l.thermo.dfH.value - record.phases.s.thermo.dfH.value) * 1000.0;
    const walden = dhFusJ / tmPoint.T_K;
    if (walden < 10.0 || walden > 150.0) {
      rejected.push({
        datum: { tm: tmPoint.T_K, dh_fus_j_mol: dhFusJ, walden },
        reason: `Walden entropy of fusion ${walden.toFixed(1)} J/(mol K) outside physical bounds (10 - 150 J/(mol K))`,
      });
    }
  }

  // Append any rejected data to record
  if (rejected.length > 0) {
    if (!record.rejected) {
      record.rejected = [];
    }
    record.rejected.push(...rejected);
  }

  return {
    accepted: rejected.length === 0,
    rejected,
  };
}
