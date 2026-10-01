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
