import init, {
  init_engine,
  echo_message,
  pour_volume,
  calculate_equilibrium,
  calculate_titration,
  calculate_calorimetry_mixing,
  run_iodine_clock_sim,
  run_wasm_benchmark,
  vessel_new,
  vessel_free,
  vessel_dose,
  vessel_add_portion,
  vessel_remove_liquid,
  vessel_gas_link,
  vessel_gas_unlink,
  vessel_gas_vent,
  vessel_remove_liquid_bottom,
  vessel_control,
  vessel_step,
  vessel_snapshot,
  vessel_equilibrate,
  step_all,
  optics_tables_json,
  vessel_uvvis_scan,
  vessel_nmr_spectrum,
  vessel_ms_spectrum,
  vessel_flame_test,
  colour_to_absorbance,
  reagent_catalog_json,
  register_compound,
  register_reaction,
  register_equilibrium,
  register_mineral,
  take_mineral_lookups,
  resolve_mineral,
  import_compound,
  m6_get_reaction_families,
  m6_calculate_mayr_rate,
  m6_sn2_e2_competition,
  m6_ester_hydrolysis_rate_vs_ph,
  m6_generate_reaction_network,
  m6_stress_test_mixture,
  m6_diffusion_capped_rate,
} from '../wasm/engine/reaction_chamber_engine.js';

let wasmReady = false;

async function bootstrapWasm() {
  try {
    await init();
    const statusMsg = init_engine();
    wasmReady = true;
    console.log('[SimulationWorker] WASM initialized:', statusMsg);
    self.postMessage({ type: 'WASM_READY', payload: statusMsg });
  } catch (err) {
    console.error('[SimulationWorker] WASM initialization failed:', err);
    self.postMessage({ type: 'WASM_ERROR', error: String(err) });
  }
}

bootstrapWasm();

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, requestId } = e.data;

  if (type === 'PING') {
    self.postMessage({ type: 'PONG', payload: 'Simulation worker alive', requestId });
    return;
  }

  if (!wasmReady) {
    await bootstrapWasm();
  }

  try {
    switch (type) {
      case 'WASM_ROUNDTRIP': {
        const wasmResponse = echo_message(payload.message || 'hello from main thread');
        self.postMessage({
          type: 'WASM_ROUNDTRIP_RESPONSE',
          payload: {
            received: payload.message,
            wasmResponse,
            timestamp: Date.now(),
          },
          requestId,
        });
        break;
      }

      case 'POUR_CALC': {
        const { sourceVol, targetVol, transferAmount } = payload;
        const wasmRes = pour_volume(sourceVol, targetVol, transferAmount);
        self.postMessage({
          type: 'POUR_CALC_RESPONSE',
          payload: JSON.parse(wasmRes),
          requestId,
        });
        break;
      }

      case 'CALCULATE_EQUILIBRIUM': {
        const res = calculate_equilibrium(JSON.stringify(payload));
        self.postMessage({
          type: 'CALCULATE_EQUILIBRIUM_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'CALCULATE_TITRATION': {
        const { curveType, volAcidMl, cAcid, cBase, extraParam, maxTitrantMl, steps, tempK } = payload;
        const res = calculate_titration(
          curveType,
          volAcidMl,
          cAcid,
          cBase,
          typeof extraParam === 'string' ? extraParam : JSON.stringify(extraParam ?? ''),
          maxTitrantMl,
          steps || 100,
          tempK || 298.15
        );
        self.postMessage({
          type: 'CALCULATE_TITRATION_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'CALCULATE_MIXING': {
        const { vol1Ml, temp1K, vol2Ml, temp2K } = payload;
        const res = calculate_calorimetry_mixing(vol1Ml, temp1K, vol2Ml, temp2K);
        self.postMessage({
          type: 'CALCULATE_MIXING_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'RUN_IODINE_CLOCK': {
        const { initialS2O8, initialI, initialS2O3, tempK, dt, maxTimeSec } = payload;
        const res = run_iodine_clock_sim(
          initialS2O8,
          initialI,
          initialS2O3,
          tempK || 298.15,
          dt || 0.1,
          maxTimeSec || 120.0
        );
        self.postMessage({
          type: 'RUN_IODINE_CLOCK_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'RUN_BENCHMARK': {
        const { ticks } = payload || { ticks: 50 };
        const res = run_wasm_benchmark(ticks || 50);
        self.postMessage({
          type: 'RUN_BENCHMARK_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'VESSEL_NEW': {
        const handle = vessel_new(JSON.stringify(payload.config));
        self.postMessage({
          type: 'VESSEL_NEW_RESPONSE',
          payload: { handle },
          requestId,
        });
        break;
      }

      case 'VESSEL_FREE': {
        const ok = vessel_free(payload.handle);
        self.postMessage({
          type: 'VESSEL_FREE_RESPONSE',
          payload: { ok },
          requestId,
        });
        break;
      }

      case 'VESSEL_DOSE': {
        const res = vessel_dose(payload.handle, JSON.stringify(payload.dose));
        self.postMessage({
          type: 'VESSEL_DOSE_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'VESSEL_ADD_PORTION': {
        const res = vessel_add_portion(payload.handle, JSON.stringify(payload.portion));
        self.postMessage({
          type: 'VESSEL_ADD_PORTION_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'VESSEL_REMOVE_LIQUID': {
        const res = vessel_remove_liquid(payload.handle, payload.volume_ml, payload.include_solids ?? false);
        self.postMessage({
          type: 'VESSEL_REMOVE_LIQUID_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'VESSEL_REMOVE_LIQUID_BOTTOM': {
        // separatory-funnel stopcock: the densest layer leaves first
        const res = vessel_remove_liquid_bottom(payload.handle, payload.volume_ml, payload.include_solids ?? false);
        self.postMessage({
          type: 'VESSEL_REMOVE_LIQUID_BOTTOM_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'GAS_LINK': {
        // delivery tube: stoppers `src` and routes its evolved gas into the collector `dst`
        const ok = vessel_gas_link(payload.src, payload.dst);
        self.postMessage({ type: 'GAS_LINK_RESPONSE', payload: { ok }, requestId });
        break;
      }

      case 'GAS_UNLINK': {
        const ok = vessel_gas_unlink(payload.src);
        self.postMessage({ type: 'GAS_UNLINK_RESPONSE', payload: { ok }, requestId });
        break;
      }

      case 'GAS_VENT': {
        const mol = vessel_gas_vent(payload.handle);
        self.postMessage({ type: 'GAS_VENT_RESPONSE', payload: { mol }, requestId });
        break;
      }

      case 'VESSEL_CONTROL': {
        const res = vessel_control(payload.handle, JSON.stringify(payload.controls));
        self.postMessage({
          type: 'VESSEL_CONTROL_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'VESSEL_STEP': {
        const res = vessel_step(payload.handle, payload.dt_s);
        self.postMessage({
          type: 'VESSEL_STEP_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'VESSEL_SNAPSHOT': {
        const res = vessel_snapshot(payload.handle);
        self.postMessage({
          type: 'VESSEL_SNAPSHOT_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'VESSEL_EQUILIBRATE': {
        const res = vessel_equilibrate(payload.handle, payload.max_sim_s ?? 60.0);
        self.postMessage({
          type: 'VESSEL_EQUILIBRATE_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'STEP_ALL': {
        const res = step_all(JSON.stringify(payload.handles), payload.dt_s);
        self.postMessage({
          type: 'STEP_ALL_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'OPTICS_TABLES': {
        const res = optics_tables_json();
        self.postMessage({
          type: 'OPTICS_TABLES_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'UVVIS_SCAN': {
        const res = vessel_uvvis_scan(payload.handle, payload.layer ?? 0, payload.nm_min, payload.nm_max, payload.step_nm, payload.path_cm);
        self.postMessage({ type: 'UVVIS_SCAN_RESPONSE', payload: JSON.parse(res), requestId });
        break;
      }

      case 'NMR_SPECTRUM': {
        const res = vessel_nmr_spectrum(payload.handle, payload.layer ?? 0, payload.nucleus, payload.solvent, payload.scans, payload.seed >>> 0);
        self.postMessage({ type: 'NMR_SPECTRUM_RESPONSE', payload: JSON.parse(res), requestId });
        break;
      }

      case 'MS_SPECTRUM': {
        const res = vessel_ms_spectrum(payload.handle, payload.layer ?? 0, payload.mode, payload.seed >>> 0);
        self.postMessage({ type: 'MS_SPECTRUM_RESPONSE', payload: JSON.parse(res), requestId });
        break;
      }

      case 'FLAME_TEST': {
        const res = vessel_flame_test(payload.handle, payload.t_flame_k);
        self.postMessage({ type: 'FLAME_TEST_RESPONSE', payload: JSON.parse(res), requestId });
        break;
      }

      case 'COLOUR_TO_ABSORBANCE': {
        const a = colour_to_absorbance(payload.r, payload.g, payload.b, payload.path_cm);
        self.postMessage({ type: 'COLOUR_TO_ABSORBANCE_RESPONSE', payload: Array.from(a), requestId });
        break;
      }

      case 'REAGENT_CATALOG': {
        const res = reagent_catalog_json();
        self.postMessage({
          type: 'REAGENT_CATALOG_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'REGISTER_COMPOUND': {
        const res = register_compound(JSON.stringify(payload));
        self.postMessage({
          type: 'REGISTER_COMPOUND_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'REGISTER_REACTION': {
        const res = register_reaction(JSON.stringify(payload));
        self.postMessage({
          type: 'REGISTER_REACTION_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'REGISTER_EQUILIBRIUM': {
        const res = register_equilibrium(JSON.stringify(payload));
        self.postMessage({
          type: 'REGISTER_EQUILIBRIUM_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'IMPORT_COMPOUND': {
        const res = import_compound(JSON.stringify(payload));
        self.postMessage({
          type: 'IMPORT_COMPOUND_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'REGISTER_MINERAL': {
        const res = register_mineral(JSON.stringify(payload));
        self.postMessage({
          type: 'REGISTER_MINERAL_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'TAKE_MINERAL_LOOKUPS': {
        const res = take_mineral_lookups();
        self.postMessage({
          type: 'TAKE_MINERAL_LOOKUPS_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'RESOLVE_MINERAL': {
        const res = resolve_mineral(JSON.stringify(payload));
        self.postMessage({
          type: 'RESOLVE_MINERAL_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'M6_GET_FAMILIES': {
        const res = m6_get_reaction_families();
        self.postMessage({
          type: 'M6_GET_FAMILIES_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'M6_MAYR_RATE': {
        const { nucId, elId, tempK } = payload;
        const res = m6_calculate_mayr_rate(nucId, elId, tempK || 298.15);
        self.postMessage({
          type: 'M6_MAYR_RATE_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'M6_SN2_E2': {
        const { substrate, isBulky, tempK } = payload;
        const res = m6_sn2_e2_competition(substrate, !!isBulky, tempK || 298.15);
        self.postMessage({
          type: 'M6_SN2_E2_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'M6_ESTER_HYDROLYSIS': {
        const { ester, ph, tempK } = payload;
        const res = m6_ester_hydrolysis_rate_vs_ph(ester, ph ?? 7.0, tempK || 298.15);
        self.postMessage({
          type: 'M6_ESTER_HYDROLYSIS_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'M6_GENERATE_NETWORK': {
        const { concs, tempK, ph } = payload;
        const res = m6_generate_reaction_network(JSON.stringify(concs), tempK || 298.15, ph ?? 7.0);
        self.postMessage({
          type: 'M6_GENERATE_NETWORK_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      case 'M6_STRESS_TEST': {
        const { speciesList } = payload;
        const res = m6_stress_test_mixture(JSON.stringify(speciesList));
        self.postMessage({
          type: 'M6_STRESS_TEST_RESPONSE',
          payload: JSON.parse(res),
          requestId,
        });
        break;
      }

      default:
        self.postMessage({
          type: 'UNKNOWN_COMMAND',
          error: `Unknown simulation worker message type: ${type}`,
          requestId,
        });
    }
  } catch (err) {
    self.postMessage({
      type: `${type}_ERROR`,
      error: String(err),
      requestId,
    });
  }
};
