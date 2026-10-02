import type { CompoundRecord, Datum, PhaseData, CurvePoint } from './record';
import { applyConsistencyGates } from './checks';

const TIER_WEIGHT: Record<string, number> = {
  'user-set': 6,
  'refined': 5,
  'tabulated': 4,
  'imported': 3,
  'estimated': 2,
  'speculative': 1,
};

function pickPreferredDatum(a?: Datum, b?: Datum): Datum | undefined {
  if (!a) return b;
  if (!b) return a;
  const wA = TIER_WEIGHT[a.tier] || 0;
  const wB = TIER_WEIGHT[b.tier] || 0;
  return wB > wA ? b : a;
}

export function mergeRecords(base: CompoundRecord, incoming: CompoundRecord): CompoundRecord {
  const merged: CompoundRecord = {
    id: base.id || incoming.id,
    identity: {
      ...base.identity,
      ...incoming.identity,
      names: Array.from(new Set([...(base.identity.names || []), ...(incoming.identity.names || [])])),
      db_names: { ...(base.identity.db_names || {}), ...(incoming.identity.db_names || {}) },
    },
    phases: { ...base.phases },
    critical: { ...base.critical, ...incoming.critical },
    points: [...(base.points || [])],
    acid_base: [...(base.acid_base || [])],
    redox: [...(base.redox || [])],
    optics: base.optics || incoming.optics,
    transport: base.transport || incoming.transport,
    kinetics_refs: Array.from(new Set([...(base.kinetics_refs || []), ...(incoming.kinetics_refs || [])])),
    rejected: [...(base.rejected || []), ...(incoming.rejected || [])],
  };

  // Merge phase data
  for (const [phaseKey, incPhase] of Object.entries(incoming.phases)) {
    const basePhase = merged.phases[phaseKey] as PhaseData | undefined;
    if (!basePhase) {
      merged.phases[phaseKey] = incPhase;
    } else {
      merged.phases[phaseKey] = {
        thermo: incPhase.thermo || basePhase.thermo,
        volume: incPhase.volume || basePhase.volume,
        rho: pickPreferredDatum(basePhase.rho, incPhase.rho),
        polymorph: incPhase.polymorph || basePhase.polymorph,
      };
    }
  }

  // Merge curve points (dedup by kind + T_K + P_Pa + solvent)
  if (incoming.points) {
    for (const p of incoming.points) {
      const exists = merged.points?.some(
        (existing) =>
          existing.kind === p.kind &&
          Math.abs((existing.T_K || 0) - (p.T_K || 0)) < 0.1 &&
          Math.abs((existing.P_Pa || 0) - (p.P_Pa || 0)) < 1.0 &&
          existing.solvent === p.solvent,
      );
      if (!exists) {
        merged.points?.push(p);
      }
    }
  }

  // Merge acid-base sites
  if (incoming.acid_base) {
    for (const ab of incoming.acid_base) {
      const exists = merged.acid_base?.some((existing) => existing.site === ab.site);
      if (!exists) {
        merged.acid_base?.push(ab);
      }
    }
  }

  // Run consistency gates
  applyConsistencyGates(merged);

  return merged;
}
