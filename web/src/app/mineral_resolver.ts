// Closes the loop for solids whose Ksp is only a rule-of-thumb guess: polls the engine for such precipitates, looks
// them up on PubChem (solubility, colour, density, name), feeds the data back so the engine refines Ksp and appearance,
// and offers the product to the reagent library like any hand-imported compound (it may be a reactant next).
import type { SimController } from '../sim/sim_controller';
import type { SpeciesRecord } from '../types';
import type { MineralLookup, MineralResolution } from '../types/sim';
import { fetchSolidData } from '../pubchem/solid_data';

const POLL_MS = 1500;

type Notify = (msg: string, kind?: 'info' | 'warn') => void;

const fmtKsp = (log: number) => {
  const e = Math.floor(log);
  const m = Math.pow(10, log - e);
  return `${m.toFixed(1)}e${e}`;
};

export class MineralResolver {
  /** Adds the formed product to the reagent library; resolves true when it was newly added (false = already there). */
  public onProduct?: (record: SpeciesRecord) => Promise<boolean>;

  private timer: number | null = null;
  private polling = false;
  private warned = false;
  private seen = new Set<string>();

  constructor(
    private sim: SimController,
    private notify: Notify,
  ) {}

  start() {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => void this.poll(), POLL_MS);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      const lookups = await this.sim.takeMineralLookups();
      for (const lk of lookups ?? []) {
        if (this.seen.has(lk.solid_species)) continue; // already in flight / done this session
        this.seen.add(lk.solid_species);
        await this.resolveOne(lk);
      }
    } catch (err) {
      // Transient worker error: try again next tick.
      if (!this.warned) console.warn('[mineral-resolver]', err);
      this.warned = true;
    } finally {
      this.polling = false;
    }
  }

  private async resolveOne(lk: MineralLookup) {
    const found = await fetchSolidData(lk); // never throws
    if (!found) return; // nothing on PubChem (or offline): the engine keeps its estimate, stay quiet
    const { data, record } = found;

    // 1. Engine first, so its solubility / appearance data is in place before the product is imported as a reagent.
    let res: MineralResolution | null = null;
    try {
      res = await this.sim.resolveMineral(data);
    } catch (err) {
      console.warn('[mineral-resolver] resolve failed', lk.solid_species, err);
    }

    // 2. The product becomes a reagent (full PubChem record), unless the library already has it.
    let added = false;
    if (record && this.onProduct) {
      try {
        added = await this.onProduct(record);
      } catch (err) {
        console.warn('[mineral-resolver] adding product failed', lk.solid_species, err);
      }
    }

    // 3. Tell the user.
    const ksp = res?.registered && res.log_ksp !== null && res.log_ksp !== undefined ? `Ksp ≈ ${fmtKsp(res.log_ksp)}` : '';
    const src = res?.source || data.source;
    if (added) {
      this.notify(`Formed ${lk.formula} — added to your reagents (${src}).${ksp ? ' ' + ksp : ''}`, 'info');
    } else if (res?.registered) {
      const what = data.solubility_g_per_l !== undefined ? `solubility ${data.solubility_g_per_l.toPrecision(2)} g/L` : data.qualitative ? data.qualitative.replace(/_/g, ' ') : 'appearance updated';
      this.notify(`${src}: ${lk.formula} ${what}${ksp ? ' → ' + ksp : ''}`, 'info');
    }
  }
}
