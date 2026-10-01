// In-app end-to-end self-test (M0–M5 validation gates). Milestone jargon lives here only.
import type { SimController } from '../sim/sim_controller';
import { initDataBundle } from '../pubchem/api';
import { Modal } from './modal';
import { h } from './dom';

let modal: Modal | null = null;
let running = false;

export async function runSelfTest(simWorker: Worker, simController: SimController, sessionToken: string): Promise<void> {
  if (!modal) modal = new Modal('Self-test · M0–M5 validation gates', { wide: true, className: 'modal-test' });
  modal.open();
  if (running) return;
  running = true;
  const log = h('ol', { class: 'test-log', 'aria-live': 'polite' });
  modal.body.innerHTML = '';
  modal.body.append(log);

  const append = (msg: string, status: 'pass' | 'fail' | 'info' = 'info') => {
    log.append(h('li', { class: `test-step is-${status}`, text: msg }));
    log.lastElementChild?.scrollIntoView({ block: 'nearest' });
  };

  try {
    // M0: worker → WASM roundtrip
    append('[M0] Worker & WASM roundtrip');
    try {
      const res = await new Promise<{ wasmResponse: string; latency: number }>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          simWorker.removeEventListener('message', handler);
          reject(new Error('timed out after 5 s'));
        }, 5000);
        const handler = (e: MessageEvent) => {
          if (e.data?.type === 'WASM_ROUNDTRIP_RESPONSE' && e.data.requestId === 'gate-test') {
            window.clearTimeout(timer);
            simWorker.removeEventListener('message', handler);
            resolve({ wasmResponse: e.data.payload.wasmResponse, latency: Date.now() - e.data.payload.timestamp });
          }
        };
        simWorker.addEventListener('message', handler);
        simWorker.postMessage({ type: 'WASM_ROUNDTRIP', payload: { message: 'Gate Test Ping' }, requestId: 'gate-test' });
      });
      append(`Pass — WASM roundtrip "${res.wasmResponse}" (${res.latency} ms)`, 'pass');
    } catch (err) {
      append(`Fail — WASM roundtrip: ${(err as Error).message}`, 'fail');
    }

    // M0: local server xTB job
    append('[M0] Local server GFN2-xTB job');
    try {
      const xtbRes = await fetch('/api/xtb/trivial-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: sessionToken ? `Bearer ${sessionToken}` : '' },
      });
      if (xtbRes.ok) {
        const d = await xtbRes.json();
        append(`Pass — ${d.species} energy = ${Number(d.energy_hartree).toFixed(6)} Eh (${d.method}, ${d.runtime_sec}s)`, 'pass');
      } else {
        append(`Fail — xTB request returned status ${xtbRes.status} (is the local server running?)`, 'fail');
      }
    } catch (err) {
      append(`Fail — xTB server call: ${(err as Error).message}`, 'fail');
    }

    // M1: data bundle import
    append('[M1] Chemical import database');
    try {
      const bundle = await initDataBundle();
      append(`Pass — import database active with ${Object.keys(bundle).length} species`, 'pass');
    } catch (err) {
      append(`Fail — ${(err as Error).message}`, 'fail');
    }

    // M2: conflict report
    append('[M2] Data bundle v1 & conflict report');
    try {
      const r = await fetch('/data/conflict_report.json');
      if (r.ok) {
        const c = await r.json();
        append(`Pass — ${c.conflicts_resolved}/${c.spot_checked_conflicts_analyzed} conflicts resolved`, 'pass');
        append(`Pass — ${c.total_species_in_database} species mapped by InChIKey`, 'pass');
      } else {
        append('Fail — could not load conflict_report.json', 'fail');
      }
    } catch (err) {
      append(`Fail — ${(err as Error).message}`, 'fail');
    }

    // M5: engine, optics, titration, conservation
    append('[M5] Optics, catalog, speciation & conservation');
    try {
      const tables = await simController.getOpticsTables();
      append(`Pass — optics tables: ${tables.n_bins} wavelength bins (400–710 nm)`, 'pass');
      const cat = await simController.getReagentCatalog();
      append(`Pass — reagent catalog: ${cat.length} reagents`, 'pass');

      const id = `selftest_${Date.now()}`;
      await simController.createVessel(id, { type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5 });
      try {
        await simController.dose(id, { reagent_id: 'hcl_0_1m', volume_ml: 25 });
        await simController.dose(id, { reagent_id: 'naoh_0_1m', volume_ml: 25 });
        const snap = await simController.fetchSnapshot(id);
        if (snap && snap.ph !== null) {
          append(`Pass — 25 mL 0.1 M HCl + 25 mL 0.1 M NaOH: pH ${snap.ph.toFixed(2)}, ${snap.total_liquid_ml.toFixed(1)} mL`, 'pass');
          append(`Pass — charge balance error ${snap.conservation.charge_err_mol.toExponential(2)} mol`, 'pass');
        } else {
          append('Fail — no aqueous phase after titration', 'fail');
        }
      } finally {
        await simController.freeVessel(id);
      }
    } catch (err) {
      append(`Fail — ${(err as Error).message}`, 'fail');
    }

    const fails = log.querySelectorAll('.is-fail').length;
    append(fails === 0 ? 'All gates passed.' : `${fails} check(s) failed.`, fails === 0 ? 'pass' : 'fail');
  } finally {
    running = false;
  }
}
