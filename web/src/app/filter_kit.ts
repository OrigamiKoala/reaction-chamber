// Filtration setups: a funnel already sitting on its flask. Pour a suspension into the funnel: the liquid runs through
// into the flask (slowly by gravity, fast through a Büchner funnel on a Büchner flask under vacuum) and the solid stays.
import type { Lab } from './lab';
import type { VesselType } from '../types';
import { registerSetup } from './setups';

interface FilterKit {
  id: string;
  label: string;
  description: string;
  keywords: string;
  funnel: VesselType;
  flask: VesselType;
}

const KITS: FilterKit[] = [
  {
    id: 'filter-kit-gravity',
    label: 'Filtration: funnel on a flask',
    description: '75 mm filter funnel on a 125 mL flask (gravity: about half a mL per second)',
    keywords: 'filter filtration funnel paper gravity precipitate filtrate residue',
    funnel: 'filter-funnel-75',
    flask: 'erlenmeyer-125',
  },
  {
    id: 'filter-kit-vacuum',
    label: 'Vacuum filtration: Büchner funnel',
    description: 'Büchner funnel on a Büchner flask under vacuum (fast, dries the cake)',
    keywords: 'filter filtration vacuum buchner funnel suction precipitate filtrate residue',
    funnel: 'buchner-funnel-90',
    flask: 'buchner-flask-250',
  },
];

export async function spawnFilterKit(lab: Lab, kit: FilterKit): Promise<void> {
  const flask = await lab.spawn(kit.flask);
  const funnel = await lab.spawn(kit.funnel);
  await lab.connectFilter(funnel.id, flask.id);
  lab.select(funnel.id);
}

export function registerFilterKits(): void {
  for (const k of KITS) {
    registerSetup({
      id: k.id,
      label: k.label,
      description: k.description,
      keywords: k.keywords,
      icon: 'funnel',
      build: (lab) => spawnFilterKit(lab, k),
    });
  }
}
