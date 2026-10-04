import * as THREE from 'three';
import { BottleAssembly, BottleInput, BottleKind, bottleKindFor, createBottleAssembly } from '../equipment/bottle';

/**
 * Capped reagent shelf with least-recently-used eviction. The catalog can hold thousands of reagents; only
 * `capacity` bottles are ever instantiated. Bottle metadata is remembered for every id ever added so that
 * animations can build a matching temporary bottle for evicted / never-shelved reagents.
 */
interface ShelfEntry {
  input: BottleInput;
  asm: BottleAssembly;
  tier: number;
  slot: number;
  lastUsed: number;
  /** Stands at a fixed spot on the bench instead of a shelf slot; never evicted. */
  pinned?: boolean;
  home?: THREE.Vector3;
}

const TIER_PREF: Record<BottleKind, number[]> = {
  liquid: [0, 1, 2],
  dropper: [1, 0, 2],
  jar: [2, 1, 0],
};

export class ReagentShelf {
  private entries = new Map<string, ShelfEntry>();
  private meta = new Map<string, BottleInput>();
  private occupied: (string | null)[][];
  private clock = 0;
  /** Bottles currently used by an animation (never evicted while busy). */
  private busy = new Set<string>();
  public onChange?: () => void;

  constructor(private scene: THREE.Scene, private slots: THREE.Vector3[][]) {
    this.occupied = slots.map((row) => row.map(() => null));
  }

  get capacity(): number {
    return this.slots.reduce((s, r) => s + r.length, 0);
  }

  public getMeta(id: string): BottleInput | undefined {
    return this.meta.get(id);
  }

  public get(id: string): BottleAssembly | undefined {
    return this.entries.get(id)?.asm;
  }

  public assemblies(): BottleAssembly[] {
    return Array.from(this.entries.values(), (e) => e.asm);
  }

  public touch(id: string) {
    const e = this.entries.get(id);
    if (e) e.lastUsed = ++this.clock;
  }

  public setBusy(id: string, on: boolean) {
    if (on) this.busy.add(id);
    else this.busy.delete(id);
  }

  /** Add or refresh a bottle. Re-adding an id already shelved only marks it most-recently-used. */
  public add(input: BottleInput): BottleAssembly | undefined {
    // keep a previously learned contents colour if the caller doesn't supply one
    const prev = this.meta.get(input.id);
    if (prev?.colorHex && !input.colorHex) input = { ...input, colorHex: prev.colorHex };
    this.meta.set(input.id, input);
    const existing = this.entries.get(input.id);
    if (existing) {
      existing.lastUsed = ++this.clock;
      return existing.asm;
    }
    const kind = bottleKindFor(input);
    let place = this.freeSlot(kind);
    if (!place) {
      const victim = this.lru();
      if (!victim) return undefined;
      place = { tier: victim.tier, slot: victim.slot };
      this.evict(victim.input.id);
    }
    const asm = createBottleAssembly(input);
    const pos = this.slots[place.tier][place.slot];
    asm.group.position.copy(pos);
    // slight random turn so labels don't look stamped
    asm.group.rotation.y = (hash(input.id) % 100) / 100 * 0.3 - 0.15;
    this.scene.add(asm.group);
    this.occupied[place.tier][place.slot] = input.id;
    this.entries.set(input.id, { input, asm, tier: place.tier, slot: place.slot, lastUsed: ++this.clock });
    this.onChange?.();
    return asm;
  }

  /** A bottle with a fixed home (e.g. the distilled-water bottle on the bench): outside the shelf slots and the LRU. */
  public pin(input: BottleInput, pos: THREE.Vector3, yaw = 0): BottleAssembly {
    this.meta.set(input.id, input);
    const existing = this.entries.get(input.id);
    if (existing?.pinned) return existing.asm;
    if (existing) this.evict(input.id); // it stood on the shelf: it moves to its bench spot
    const asm = createBottleAssembly(input);
    asm.group.position.copy(pos);
    asm.group.rotation.y = yaw;
    this.scene.add(asm.group);
    this.entries.set(input.id, { input, asm, tier: -1, slot: -1, lastUsed: ++this.clock, pinned: true, home: pos.clone() });
    this.onChange?.();
    return asm;
  }

  public evict(id: string) {
    const e = this.entries.get(id);
    if (!e || e.pinned) return;
    this.occupied[e.tier][e.slot] = null;
    this.entries.delete(id);
    e.asm.dispose();
    this.onChange?.();
  }

  /** Home position of a shelved bottle (world). */
  public homeOf(id: string): THREE.Vector3 | undefined {
    const e = this.entries.get(id);
    if (!e) return undefined;
    return e.pinned && e.home ? e.home.clone() : this.slots[e.tier][e.slot].clone();
  }

  private freeSlot(kind: BottleKind): { tier: number; slot: number } | null {
    for (const tier of TIER_PREF[kind]) {
      if (tier >= this.slots.length) continue;
      const row = this.occupied[tier];
      for (let i = 0; i < row.length; i++) if (!row[i]) return { tier, slot: i };
    }
    return null;
  }

  private lru(): ShelfEntry | null {
    let best: ShelfEntry | null = null;
    for (const e of this.entries.values()) {
      if (e.pinned || this.busy.has(e.input.id)) continue;
      if (!best || e.lastUsed < best.lastUsed) best = e;
    }
    return best;
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
