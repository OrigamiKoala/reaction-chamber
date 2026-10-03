// Wires the physical controls on the 3D instruments (bench/controls3d.ts, equipment/*) to the lab and the simulation.
// The instruments only report knob / switch / button changes through callbacks; every decision that touches chemistry
// (which vessel, what to dose, what the engine measures) is made here, so the 3D classes stay free of lab logic.
import type * as THREE from 'three';
import type { Lab } from './lab';
import type { BenchInstruments } from '../bench/scene';
import type { SimController } from '../sim/sim_controller';
import type { ElectrolysisSpec } from '../types/sim';
import type { PotentiostatPanel } from '../equipment/electrochem';
import { toast } from '../ui/toast';

/** Temperature of a typical premixed gas-burner flame (K): a property of the burner, not of any sample (placeholder). */
const BUNSEN_FLAME_K = 2000;
const HEAT_DEBOUNCE_MS = 120;
const CELL_DEBOUNCE_MS = 120;

export interface InstrumentControlsDeps {
  lab: Lab;
  sim: SimController;
  instruments: () => BenchInstruments;
  /** Bench position of a vessel (for choosing the nearest vessel to bridge to). */
  vesselPosition: (id: string) => THREE.Vector3 | null;
}

export interface InstrumentControls {
  /** Pull the console state (potentiostat knobs, lamps) from the lab: selection or controls changed. */
  sync(): void;
}

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function wireInstrumentControls(deps: InstrumentControlsDeps): InstrumentControls {
  const { lab, sim } = deps;
  const ins = deps.instruments();
  const run = (p: Promise<unknown>, what: string) => p.catch((err: unknown) => toast(`Couldn't ${what}: ${errText(err)}`, 'error'));
  const selected = (): string | null => (lab.selectedId && lab.has(lab.selectedId) ? lab.selectedId : null);
  const nameOf = (id: string) => lab.get(id)?.name ?? 'Sample';
  const colourOf = (id: string) => lab.get(id)?.liquidColor;

  // ------------------------------------------------------------------ hot plate
  let heatTimer = 0;
  ins.hotPlate.onHeat = (watts) => {
    const id = lab.hotPlateVesselId();
    if (!id) {
      toast('Stand a vessel on the hot plate first, then turn the heat up.', 'info');
      return false;
    }
    window.clearTimeout(heatTimer);
    heatTimer = window.setTimeout(() => {
      if (lab.hotPlateVesselId() !== id) return; // lifted off meanwhile
      run(lab.setHeat(id, watts), 'set the heat');
    }, HEAT_DEBOUNCE_MS);
    return true;
  };
  ins.hotPlate.onStir = (on) => {
    const id = lab.hotPlateVesselId();
    if (!id) {
      toast('Stand a vessel on the hot plate first, then switch the stirrer on.', 'info');
      return false;
    }
    lab
      .setStir(id, on)
      .then(() => lab.onControlsChanged?.(id))
      .catch((err: unknown) => {
        ins.hotPlate.setStir(!on, ins.hotPlate.stirRpm);
        toast(`Couldn't change stirring: ${errText(err)}`, 'error');
      });
    return true;
  };

  // ------------------------------------------------------------------ burner: the gas tap lights it; the loop does the flame test
  ins.burner.onLoop = (into) => {
    if (!into) return true;
    const b = ins.burner;
    if (!b.isActive) {
      toast('Open the gas tap first: the burner has to be lit for a flame test.', 'info');
      return false;
    }
    const id = selected();
    if (!id) {
      toast('Select the vessel with the sample first (click it), then dip the loop.', 'info');
      return false;
    }
    b.flameTestInfo = `Dipping the loop in ${nameOf(id)}…`;
    sim.flameTest(id, BUNSEN_FLAME_K).then(
      (r) => {
        if (!b.loopInFlame) return; // withdrawn meanwhile
        b.setFlameTest(r.emitter_rgb, r.metal_share);
        b.flameTestInfo = r.emitters.length ? `${nameOf(id)}: emission from ${r.emitters.join(', ')}` : `${nameOf(id)}: no emitting metal, the flame keeps its own colour`;
      },
      (err) => {
        b.setLoopInFlame(false);
        toast(`Flame test failed: ${errText(err)}`, 'warning');
      }
    );
    return true;
  };

  // ------------------------------------------------------------------ potentiostat / galvanostat
  const ec = ins.electrochem;
  let bridgeTo: string | null = null;
  let cellTimer = 0;

  const specFrom = (p: PotentiostatPanel): ElectrolysisSpec => ({
    anode: { material: p.anode, area_cm2: 6.0 },
    cathode: { material: p.cathode, area_cm2: 6.0 },
    mode: p.mode,
    value: p.mode === 'current' ? p.amps : p.volts,
    on: p.on,
  });

  /** Push the console's settings to the selected vessel (dips the electrodes in if they were not). */
  const applyCell = (vid: string) => {
    const p = ec.panel;
    if (bridgeTo && bridgeTo !== vid && lab.has(bridgeTo)) run(lab.setGalvanicCell(vid, bridgeTo, p.anode, p.cathode), 'configure the galvanic cell');
    else run(lab.setElectrolysis(vid, specFrom(p)), 'configure the electrolysis');
    ec.setPanel({ dipped: true });
  };
  const dippedIn = (vid: string) => !!lab.ctl(vid).electrolysis;
  /** A knob / selector moved: when the electrodes are in the selected vessel the cell follows (debounced). */
  const live = () => {
    const vid = selected();
    if (!vid || !dippedIn(vid)) return;
    window.clearTimeout(cellTimer);
    cellTimer = window.setTimeout(() => {
      if (selected() === vid && dippedIn(vid)) applyCell(vid);
    }, CELL_DEBOUNCE_MS);
  };
  ec.onVoltage = live;
  ec.onCurrent = live;
  ec.onMode = live;
  ec.onMaterials = live;
  ec.onPower = (on) => {
    const vid = selected();
    if (!vid) {
      toast('Select the cell vessel first (click it): the electrodes dip into the selected vessel.', 'info');
      ec.setPanel({ on: false });
      return;
    }
    if (!on && !dippedIn(vid)) return;
    applyCell(vid);
  };
  ec.onDip = () => {
    const vid = selected();
    if (!vid) {
      toast('Select the cell vessel first (click it): the electrodes dip into the selected vessel.', 'info');
      return;
    }
    if (dippedIn(vid)) {
      run(lab.removeElectrodes(vid), 'lift the electrodes');
      bridgeTo = null;
      ec.removeSaltBridge();
      ec.setPanel({ dipped: false, on: false, bridged: false });
    } else {
      applyCell(vid);
    }
  };
  ec.onBridge = () => {
    const vid = selected();
    if (!vid) {
      toast('Select a vessel first (click it), then press BRIDGE to join it to a neighbour.', 'info');
      return;
    }
    const here = deps.vesselPosition(vid);
    const others = lab
      .list()
      .filter((v) => v.id !== vid)
      .map((v) => ({ id: v.id, d: here && deps.vesselPosition(v.id) ? here.distanceTo(deps.vesselPosition(v.id)!) : Infinity }))
      .sort((a, b) => a.d - b.d);
    if (!others.length) {
      toast('A salt bridge needs a second vessel on the bench.', 'info');
      return;
    }
    // cycle: none -> nearest -> next ... -> none (a bridge built by a setup, unknown here, is removed first)
    let next: string | null;
    if (bridgeTo === null) next = ec.hasSaltBridge ? null : others[0].id;
    else {
      const i = others.findIndex((o) => o.id === bridgeTo);
      next = i >= 0 && i + 1 < others.length ? others[i + 1].id : null;
    }
    bridgeTo = next;
    if (next) {
      applyCell(vid);
      ec.setPanel({ bridged: true });
      toast(`Salt bridge: ${nameOf(vid)} ↔ ${nameOf(next)}.`, 'info');
    } else {
      ec.removeSaltBridge();
      ec.setPanel({ bridged: false });
      if (dippedIn(vid)) applyCell(vid);
    }
  };

  // ------------------------------------------------------------------ UV-vis
  const sp = ins.spectrophotometer;
  sp.onBlank = () => {
    sp.blank();
    toast('Spectrophotometer blanked (100.0 % T, 0.000 Abs)', 'info');
  };
  sp.onScan = () => {
    if (sp.scanning) return;
    const id = selected();
    if (!id) {
      toast('Select the vessel to scan (click it), then press SCAN.', 'info');
      return;
    }
    const snap = lab.snapshot(id);
    if (!snap || snap.total_liquid_ml < 0.05) {
      toast('That vessel holds no liquid to scan.', 'warning');
      return;
    }
    const name = nameOf(id);
    sp.setSample(name);
    // the scan comes from the engine: the same optical data and models that colour the liquid in the 3D scene
    sp.scan(sim, id, name).then(undefined, (err) => toast(`Scan failed: ${errText(err)}`, 'warning'));
  };

  // ------------------------------------------------------------------ NMR
  const nmr = ins.nmr;
  let nmrVessel: string | null = null;
  const loadNmr = (id: string) => {
    nmrVessel = id;
    nmr.insert(nameOf(id), colourOf(id));
  };
  nmr.onLift = () => {
    if (nmr.lift === 'inserted') {
      nmr.eject();
      return;
    }
    const id = selected();
    if (!id) {
      toast('Select the vessel to run (click it), then press LIFT to load it into the magnet.', 'info');
      return;
    }
    loadNmr(id);
  };
  nmr.onAcquire = () => {
    if (nmr.isAcquiring) return;
    if (nmr.lift !== 'inserted') {
      const id = selected();
      if (!id) {
        toast('Select the vessel to run (click it), then press ACQUIRE.', 'info');
        return;
      }
      loadNmr(id);
    }
    const id = nmrVessel && lab.has(nmrVessel) ? nmrVessel : null;
    if (!id) {
      toast('The vessel in the tube is gone: eject the tube and load another vessel.', 'warning');
      return;
    }
    // the spectrum is predicted by the engine from the structure of everything in the vessel's liquid, when the tube is in the magnet
    nmr.startAcquisition((p) => sim.nmrSpectrum(id, { nucleus: p.nucleus, solvent: p.solvent, scans: p.scans }), nameOf(id));
  };
  nmr.onError = (msg) => toast(`NMR: ${msg}`, 'warning');

  // ------------------------------------------------------------------ mass spectrometer
  const ms = ins.massSpec;
  let msVessel: string | null = null;
  const loadVial = (id: string) => {
    msVessel = id;
    ms.loadVial(nameOf(id), colourOf(id));
  };
  ms.onLoad = () => {
    if (ms.isAcquiring) return;
    const id = selected();
    if (!id) {
      toast('Select the vessel to run (click it), then press LOAD to put a vial in the tray.', 'info');
      return;
    }
    loadVial(id);
  };
  ms.onInject = () => {
    if (ms.isAcquiring) return;
    if (!ms.vialLoaded) {
      const id = selected();
      if (!id) {
        toast('Select the vessel to run (click it), then press INJECT.', 'info');
        return;
      }
      loadVial(id);
    }
    const id = msVessel && lab.has(msVessel) ? msVessel : null;
    if (!id) {
      toast('The vessel in the vial is gone: load another vessel.', 'warning');
      return;
    }
    ms.startAcquisition((mode) => sim.msSpectrum(id, { mode }), nameOf(id));
  };
  ms.onError = (msg) => toast(`Mass spectrometer: ${msg}`, 'warning');

  return {
    sync() {
      const vid = selected();
      const spec = vid ? lab.ctl(vid).electrolysis : null;
      if (spec) {
        ec.setPanel({
          mode: spec.mode,
          ...(spec.mode === 'current' ? { amps: spec.value } : { volts: spec.value }),
          anode: spec.anode.material as PotentiostatPanel['anode'],
          cathode: spec.cathode.material as PotentiostatPanel['cathode'],
          on: spec.on,
          dipped: true,
          bridged: ec.hasSaltBridge,
        });
      } else {
        bridgeTo = null;
        ec.setPanel({ on: false, dipped: false, bridged: ec.hasSaltBridge });
      }
    },
  };
}
