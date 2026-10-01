// Chemistry Worker: Structure perception, parameter resolution, and PubChem caching
import init, { init_engine, echo_message } from '../wasm/engine/reaction_chamber_engine.js';

let wasmReady = false;

async function bootstrapWasm() {
  try {
    await init();
    const status = init_engine();
    wasmReady = true;
    self.postMessage({ type: 'CHEM_WASM_READY', payload: status });
  } catch (err) {
    self.postMessage({ type: 'CHEM_WASM_ERROR', error: String(err) });
  }
}

bootstrapWasm();

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, requestId } = e.data;

  if (type === 'PING') {
    self.postMessage({ type: 'PONG', payload: 'Chemistry worker online', requestId });
    return;
  }

  if (type === 'RESOLVE_PARAMETERS') {
    self.postMessage({
      type: 'RESOLVE_PARAMETERS_RESPONSE',
      payload: {
        species: payload.species,
        resolved: true,
        tier: 'tabulated',
      },
      requestId,
    });
    return;
  }
};
