// Gas collection setups: a flask with a stopper and delivery tube already connected to a gas syringe, a gas collection
// tube (over water) or a gas jar. Add a reagent to the flask and the gas the reaction gives off flows into the
// collector (engine: gas.rs), where it is read like the real instrument.
import type { Lab } from './lab';
import type { VesselType } from '../types';
import { registerSetup } from './setups';

export interface GasKit {
  id: string;
  label: string;
  description: string;
  keywords: string;
  icon: 'syringe' | 'gasTube' | 'cylinder';
  flask: VesselType;
  collector: VesselType;
}

export const GAS_KITS: GasKit[] = [
  {
    id: 'gas-kit-syringe',
    label: 'Gas collection: gas syringe',
    description: 'Flask + stopper + delivery tube into a 100 mL gas syringe (reads to 1 mL)',
    keywords: 'gas collect syringe hydrogen carbon dioxide volume delivery tube stopper',
    icon: 'syringe',
    flask: 'erlenmeyer-125',
    collector: 'gas-syringe-100',
  },
  {
    id: 'gas-kit-tube',
    label: 'Gas collection: tube over water',
    description: 'Flask + stopper + delivery tube into a 50 mL graduated gas tube (reads include water vapour)',
    keywords: 'gas collect eudiometer tube water displacement hydrogen delivery tube stopper',
    icon: 'gasTube',
    flask: 'erlenmeyer-125',
    collector: 'gas-collection-tube-50',
  },
  {
    id: 'gas-kit-jar',
    label: 'Gas collection: gas jar',
    description: 'Flask + stopper + delivery tube into a 250 mL gas jar with a cover plate',
    keywords: 'gas collect jar carbon dioxide displacement delivery tube stopper',
    icon: 'cylinder',
    flask: 'erlenmeyer-250',
    collector: 'gas-jar-250',
  },
];

/** Sets out the flask and the collector side by side, connected by a delivery tube; returns their ids. */
export async function spawnGasKit(lab: Lab, kit: GasKit): Promise<{ flask: string; collector: string }> {
  const f = await lab.spawn(kit.flask);
  const c = await lab.spawn(kit.collector);
  lab.placeBeside(c.id, f.id, 16);
  await lab.connectGas(f.id, c.id);
  lab.select(f.id);
  return { flask: f.id, collector: c.id };
}

export function registerGasKits(): void {
  for (const k of GAS_KITS) {
    registerSetup({
      id: k.id,
      label: k.label,
      description: k.description,
      keywords: k.keywords,
      icon: k.icon,
      build: async (lab) => {
        await spawnGasKit(lab, k);
      },
    });
  }
}
