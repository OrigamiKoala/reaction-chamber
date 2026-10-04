// Titration + separatory-funnel setups for the "Setups" section of the Glassware menu. A click sets out the whole
// apparatus: the burette in its clamp over a flask on the magnetic stirrer + white tile (or a separatory funnel on
// its stand with a collecting beaker under the stopcock). Reuses pieces that are already on the station.
import type { Lab } from './lab';
import { registerSetup } from './setups';
import { toast } from '../ui/toast';

export async function spawnTitrationSetup(lab: Lab): Promise<void> {
  const st = lab.stationState();
  if (!st.burette) await lab.spawn('burette-50'); // goes straight into the station clamp
  if (!st.flask) {
    const flask = await lab.spawn('erlenmeyer-250');
    if (!lab.seatOnTitrationStirrer(flask.id)) throw new Error('The tile is already taken.');
    lab.select(flask.id);
  } else if (lab.stationState().flask) lab.select(lab.stationState().flask);
  const out = lab.setOutIndicators();
  if (out.length) toast('Indicator dropper bottles stand beside the titration station. Carry one over the flask and squeeze for drops.', 'info');
  lab.frameTitration(true);
}

export async function spawnFunnelSetup(lab: Lab): Promise<void> {
  const funnel = await lab.spawn('separatory-funnel-250');
  const cup = await lab.spawn('beaker-250');
  lab.seatBelowFunnel(cup.id, funnel.id);
  lab.select(funnel.id);
}

export function registerTitrationKits(): void {
  registerSetup({
    id: 'titration-setup',
    label: 'Titration setup',
    description: '50 mL burette in a clamp + 250 mL flask + magnetic stirrer + white tile + indicator bottles — drag the stopcock lever to titrate',
    keywords: 'titration titrate burette buret stopcock flask stirrer stir plate tile endpoint indicator stand clamp acid base',
    icon: 'burette',
    build: spawnTitrationSetup,
  });
  registerSetup({
    id: 'funnel-stand',
    label: 'Separatory funnel stand',
    description: '250 mL separatory funnel on a ring stand with a beaker under the stopcock — drains the lower layer first',
    keywords: 'separatory separating funnel extraction layers stopcock drain ring stand liquid liquid',
    icon: 'funnel',
    build: spawnFunnelSetup,
  });
}
