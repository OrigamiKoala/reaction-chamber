import {
  VesselConfig,
  DoseRequest,
  Portion,
  VesselControls,
  VesselSnapshot,
  OpticsTables,
  ReagentCatalogEntry,
  CompoundRequest,
  CompoundModel,
  MineralLookup,
  MineralData,
  MineralResolution,
  UvVisScan,
  NmrSpectrumData,
  MsSpectrumData,
  FlameTestResult,
} from '../types/sim';

export class SimController {
  private worker: Worker;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private reqSeq = 0;
  private vesselHandles = new Map<string, number>();
  private activeVesselIds: string[] = [];

  public speedMultiplier: number = 1.0;
  public isPaused: boolean = false;
  private simIntervalId: any = null;
  public onSnapshotUpdated?: (id: string, snap: VesselSnapshot) => void;
  /** Total simulated seconds stepped so far (does not advance while paused; scales with speed). */
  public simTime = 0;
  /** Fired after every stepped batch (after the per-vessel snapshot callbacks) with the new `simTime`. */
  public onTick?: (simTime: number) => void;

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener('message', this.handleWorkerMessage);
    this.startSimulationClock();
  }

  private handleWorkerMessage = (e: MessageEvent) => {
    const { type, payload, requestId, error } = e.data;
    if (requestId && this.pendingRequests.has(requestId)) {
      const { resolve, reject } = this.pendingRequests.get(requestId)!;
      this.pendingRequests.delete(requestId);
      if (error) {
        reject(new Error(error));
      } else {
        resolve(payload);
      }
    }
  };

  private sendRequest<T>(type: string, payload: any = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = `req_${++this.reqSeq}_${Date.now()}`;
      this.pendingRequests.set(requestId, { resolve, reject });
      this.worker.postMessage({ type, payload, requestId });
    });
  }

  public async getOpticsTables(): Promise<OpticsTables> {
    return this.sendRequest<OpticsTables>('OPTICS_TABLES');
  }

  /** UV-vis scan of liquid layer `layer` of a vessel (engine `vessel_uvvis_scan`): species absorbance, turbidity, contributors. */
  public async uvvisScan(id: string, opts: { layer?: number; nmMin: number; nmMax: number; stepNm: number; pathCm: number }): Promise<UvVisScan> {
    const handle = this.vesselHandles.get(id);
    if (handle === undefined) throw new Error(`Vessel ${id} not found`);
    return this.sendRequest<UvVisScan>('UVVIS_SCAN', { handle, layer: opts.layer ?? 0, nm_min: opts.nmMin, nm_max: opts.nmMax, step_nm: opts.stepNm, path_cm: opts.pathCm });
  }

  /** NMR spectrum of liquid layer `layer` (or the solids of a dry vessel) dissolved in a deuterated solvent (engine `vessel_nmr_spectrum`). */
  public async nmrSpectrum(id: string, opts: { layer?: number; nucleus: '1H' | '13C'; solvent: string; scans: number }): Promise<NmrSpectrumData> {
    const handle = this.vesselHandles.get(id);
    if (handle === undefined) throw new Error(`Vessel ${id} not found`);
    return this.sendRequest<NmrSpectrumData>('NMR_SPECTRUM', { handle, layer: opts.layer ?? 0, nucleus: opts.nucleus, solvent: opts.solvent, scans: opts.scans, seed: Math.floor(Math.random() * 2 ** 31) });
  }

  /** GC/EI-MS ("EI") or ESI ("ESI+" / "ESI-") of liquid layer `layer` (engine `vessel_ms_spectrum`). */
  public async msSpectrum(id: string, opts: { layer?: number; mode: string }): Promise<MsSpectrumData> {
    const handle = this.vesselHandles.get(id);
    if (handle === undefined) throw new Error(`Vessel ${id} not found`);
    return this.sendRequest<MsSpectrumData>('MS_SPECTRUM', { handle, layer: opts.layer ?? 0, mode: opts.mode, seed: Math.floor(Math.random() * 2 ** 31) });
  }

  /** Flame-test colour of a vessel's liquid held in a gas flame at `tFlameK` (engine `vessel_flame_test`). */
  public async flameTest(id: string, tFlameK: number): Promise<FlameTestResult> {
    const handle = this.vesselHandles.get(id);
    if (handle === undefined) throw new Error(`Vessel ${id} not found`);
    return this.sendRequest<FlameTestResult>('FLAME_TEST', { handle, t_flame_k: tFlameK });
  }

  /** The engine's single (Speculative) RGB -> spectrum inversion: absorbance per cm whose transmission over `pathCm` has this colour. */
  public async colourToAbsorbance(rgb: [number, number, number], pathCm: number): Promise<number[]> {
    return this.sendRequest<number[]>('COLOUR_TO_ABSORBANCE', { r: rgb[0], g: rgb[1], b: rgb[2], path_cm: pathCm });
  }

  public async getReagentCatalog(): Promise<ReagentCatalogEntry[]> {
    return this.sendRequest<ReagentCatalogEntry[]>('REAGENT_CATALOG');
  }

  public async createVessel(id: string, config: VesselConfig): Promise<number> {
    const res = await this.sendRequest<{ handle: number }>('VESSEL_NEW', { config });
    this.vesselHandles.set(id, res.handle);
    if (!this.activeVesselIds.includes(id)) {
      this.activeVesselIds.push(id);
    }
    return res.handle;
  }

  public async freeVessel(id: string): Promise<boolean> {
    const handle = this.vesselHandles.get(id);
    if (handle === undefined) return false;
    const res = await this.sendRequest<{ ok: boolean }>('VESSEL_FREE', { handle });
    this.vesselHandles.delete(id);
    this.activeVesselIds = this.activeVesselIds.filter((vId) => vId !== id);
    return res.ok;
  }

  public async dose(id: string, dose: DoseRequest): Promise<any> {
    const handle = this.vesselHandles.get(id);
    if (handle === undefined) throw new Error(`Vessel ${id} not found`);
    const res = await this.sendRequest('VESSEL_DOSE', { handle, dose });
    await this.fetchSnapshot(id);
    return res;
  }

  public async removeLiquid(id: string, volume_ml: number, include_solids: boolean = false): Promise<Portion> {
    const handle = this.vesselHandles.get(id);
    if (handle === undefined) throw new Error(`Vessel ${id} not found`);
    const portion = await this.sendRequest<Portion>('VESSEL_REMOVE_LIQUID', { handle, volume_ml, include_solids });
    await this.fetchSnapshot(id);
    return portion;
  }

  /** Like `removeLiquid`, but takes the densest layer first (separatory funnel stopcock). */
  public async removeLiquidBottom(id: string, volume_ml: number, include_solids: boolean = false): Promise<Portion> {
    const handle = this.vesselHandles.get(id);
    if (handle === undefined) throw new Error(`Vessel ${id} not found`);
    const portion = await this.sendRequest<Portion>('VESSEL_REMOVE_LIQUID_BOTTOM', { handle, volume_ml, include_solids });
    await this.fetchSnapshot(id);
    return portion;
  }

  /** Connect a delivery tube from the stoppered flask `srcId` to the gas collector `dstId` (seals the source). */
  public async gasLink(srcId: string, dstId: string): Promise<boolean> {
    const src = this.vesselHandles.get(srcId);
    const dst = this.vesselHandles.get(dstId);
    if (src === undefined || dst === undefined) return false;
    const res = await this.sendRequest<{ ok: boolean }>('GAS_LINK', { src, dst });
    await this.fetchSnapshot(srcId);
    return res.ok;
  }

  /** Remove the delivery tube of `srcId` (it stays stoppered). */
  public async gasUnlink(srcId: string): Promise<boolean> {
    const src = this.vesselHandles.get(srcId);
    if (src === undefined) return false;
    const res = await this.sendRequest<{ ok: boolean }>('GAS_UNLINK', { src });
    return res.ok;
  }

  /** Empty a gas collector (plunger pushed home / jar flushed). Resolves to the moles discarded. */
  public async gasVent(id: string): Promise<number> {
    const handle = this.vesselHandles.get(id);
    if (handle === undefined) return 0;
    const res = await this.sendRequest<{ mol: number }>('GAS_VENT', { handle });
    await this.fetchSnapshot(id);
    return res.mol;
  }

  public async addPortion(id: string, portion: Portion): Promise<any> {
    const handle = this.vesselHandles.get(id);
    if (handle === undefined) throw new Error(`Vessel ${id} not found`);
    const res = await this.sendRequest('VESSEL_ADD_PORTION', { handle, portion });
    await this.fetchSnapshot(id);
    return res;
  }

  public async control(id: string, controls: VesselControls): Promise<any> {
    const handle = this.vesselHandles.get(id);
    if (handle === undefined) throw new Error(`Vessel ${id} not found`);
    return this.sendRequest('VESSEL_CONTROL', { handle, controls });
  }

  public async step(id: string, dt_s: number): Promise<any> {
    const handle = this.vesselHandles.get(id);
    if (handle === undefined) throw new Error(`Vessel ${id} not found`);
    const res = await this.sendRequest('VESSEL_STEP', { handle, dt_s });
    await this.fetchSnapshot(id);
    return res;
  }

  public async equilibrate(id: string, max_sim_s: number = 60.0): Promise<any> {
    const handle = this.vesselHandles.get(id);
    if (handle === undefined) throw new Error(`Vessel ${id} not found`);
    const res = await this.sendRequest('VESSEL_EQUILIBRATE', { handle, max_sim_s });
    await this.fetchSnapshot(id);
    return res;
  }

  public async fetchSnapshot(id: string): Promise<VesselSnapshot | null> {
    const handle = this.vesselHandles.get(id);
    if (handle === undefined) return null;
    const snap = await this.sendRequest<VesselSnapshot>('VESSEL_SNAPSHOT', { handle });
    if (this.onSnapshotUpdated) {
      this.onSnapshotUpdated(id, snap);
    }
    return snap;
  }

  public async registerCustomCompound(entry: ReagentCatalogEntry): Promise<any> {
    return this.sendRequest('REGISTER_COMPOUND', entry);
  }

  /** Models an imported compound (formula-driven) as a reacting reagent and registers it with the engine. */
  public async importCompound(req: CompoundRequest): Promise<CompoundModel> {
    return this.sendRequest<CompoundModel>('IMPORT_COMPOUND', req);
  }

  /** Drains the engine's queue of solids whose Ksp is only a rule-of-thumb guess (each call clears it). */
  public async takeMineralLookups(): Promise<MineralLookup[]> {
    return this.sendRequest<MineralLookup[]>('TAKE_MINERAL_LOOKUPS');
  }

  /** Feeds looked-up (PubChem) solubility / appearance data for a solid back to the engine. */
  public async resolveMineral(data: MineralData): Promise<MineralResolution> {
    return this.sendRequest<MineralResolution>('RESOLVE_MINERAL', data);
  }

  public async registerCustomReaction(rxn: any): Promise<any> {
    return this.sendRequest('REGISTER_REACTION', rxn);
  }

  private startSimulationClock() {
    let lastTime = performance.now();
    this.simIntervalId = setInterval(async () => {
      const now = performance.now();
      const realDt = (now - lastTime) / 1000.0;
      lastTime = now;

      if (this.isPaused || this.activeVesselIds.length === 0) return;

      const simDt = realDt * this.speedMultiplier;
      const handles = this.activeVesselIds
        .map((id) => this.vesselHandles.get(id))
        .filter((h): h is number => h !== undefined);

      if (handles.length > 0) {
        try {
          const snaps = await this.sendRequest<Record<string, VesselSnapshot>>('STEP_ALL', {
            handles,
            dt_s: Math.min(simDt, 1.0),
          });
          for (const id of this.activeVesselIds) {
            const h = this.vesselHandles.get(id);
            if (h !== undefined && snaps[String(h)]) {
              if (this.onSnapshotUpdated) {
                this.onSnapshotUpdated(id, snaps[String(h)]);
              }
            }
          }
          this.simTime += Math.min(simDt, 1.0);
          try {
            this.onTick?.(this.simTime);
          } catch (err) {
            console.warn('[sim] onTick failed', err);
          }
        } catch {
          // Ignore clock tick errors while transitioning
        }
      }
    }, 50); // 20 Hz sim loop
  }

  public dispose() {
    if (this.simIntervalId) {
      clearInterval(this.simIntervalId);
    }
  }
}
