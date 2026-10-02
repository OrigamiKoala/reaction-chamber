// Filtration on the bench: a funnel sits on a flask (its own stand is put away) and filtrate drips from the stem into
// the flask. The chemistry (liquid through the filter, solids kept back) is driven by the Lab; this file places the
// funnel on the flask and draws the drips.
import * as THREE from 'three';
import type { VesselBundle } from './glassware';
import { DropFall } from './animations';

export interface FilterHost {
  scene: THREE.Scene;
  vessels(): Map<string, VesselBundle>;
  markDirty(): void;
}

const DROP_ML = 0.05;
/** How far the stem reaches into the neck of the flask (cm below its rim). */
const STEM_INTO_NECK = 1.4;

const warned = new Set<string>();
function warnOnce(key: string, e: unknown) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[filtration] ${key}`, e);
}

interface Rig {
  funnel: string;
  receiver: string;
  drops: DropFall | null;
  acc: number;
  flow: number;
  flowUntil: number;
}

export class FilterRigs {
  private rigs = new Map<string, Rig>(); // by funnel id
  private now = 0;

  constructor(private host: FilterHost) {}

  public dispose() {
    for (const r of this.rigs.values()) r.drops?.dispose();
    this.rigs.clear();
  }

  /** The funnel's stem tip, in group coordinates (null for anything that is not a funnel). */
  private tipOf(b: VesselBundle): THREE.Vector3 | null {
    return b.tipLocal();
  }

  /**
   * Sits `funnelId` on `receiverId`: the stem goes into the neck, the funnel's own stand is hidden. Returns false if
   * either vessel is missing.
   */
  public stack(funnelId: string, receiverId: string): boolean {
    const f = this.host.vessels().get(funnelId);
    const r = this.host.vessels().get(receiverId);
    if (!f || !r) return false;
    this.unstack(funnelId, false);
    const tip = this.tipOf(f);
    const rim = r.group.position.y + r.profile.rimY + r.profile.baseOffsetY;
    f.group.position.set(r.group.position.x, rim - STEM_INTO_NECK - (tip?.y ?? 0), r.group.position.z);
    f.group.quaternion.identity();
    f.setRackVisible(false);
    this.rigs.set(funnelId, { funnel: funnelId, receiver: receiverId, drops: null, acc: 0, flow: 0, flowUntil: 0 });
    this.host.markDirty();
    return true;
  }

  /** Takes the funnel off its flask (the funnel's stand comes back). Does not move the funnel. */
  public unstack(funnelId: string, showStand = true) {
    const rig = this.rigs.get(funnelId);
    if (!rig) return;
    this.rigs.delete(funnelId);
    rig.drops?.dispose();
    const f = this.host.vessels().get(funnelId);
    if (f && showStand) f.setRackVisible(true);
    this.host.markDirty();
  }

  public receiverOf(funnelId: string): string | null {
    return this.rigs.get(funnelId)?.receiver ?? null;
  }

  /** A vessel left the bench: forget rigs that touched it. */
  public removeVessel(id: string) {
    for (const rig of Array.from(this.rigs.values())) if (rig.funnel === id || rig.receiver === id) this.unstack(rig.funnel);
  }

  /** Filtrate flow (mL/s) for the drips; keeps showing for a moment so a 10 Hz driver gives a steady drip. */
  public setFlow(funnelId: string, mlPerS: number) {
    const rig = this.rigs.get(funnelId);
    if (!rig) return;
    rig.flow = Math.max(0, mlPerS);
    rig.flowUntil = this.now + 0.35;
  }

  public update(dt: number, time: number) {
    this.now = time;
    for (const rig of this.rigs.values()) {
      try {
        const vs = this.host.vessels();
        const f = vs.get(rig.funnel);
        const r = vs.get(rig.receiver);
        if (!f || !r) continue;
        const color = f.getLiquidColorHex();
        if (!rig.drops) rig.drops = new DropFall(this.host.scene, color);
        const flow = time < rig.flowUntil ? rig.flow : 0;
        rig.acc += (flow * dt) / DROP_ML;
        const tip = this.tipOf(f);
        if (tip && rig.acc >= 1) {
          f.group.updateWorldMatrix(true, false);
          const w = tip.clone().applyMatrix4(f.group.matrixWorld);
          w.y -= 0.15;
          while (rig.acc >= 1) {
            rig.acc -= 1;
            rig.drops.drop(w.clone());
          }
        }
        rig.drops.update(dt, time, r);
      } catch (e) {
        warnOnce('update failed', e);
      }
    }
  }
}
