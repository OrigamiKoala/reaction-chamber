// Glassware catalog: one entry per `VesselType`. Pure data (no DOM, no three.js) so the Lab, the Glassware menu,
// the balance (glass mass) and the profile builders can all read it. 1 unit of length = 1 cm, as everywhere else.
//
// glassMassG        empty mass of the piece (what sits on the balance pan before any contents)
// innerRadiusCm     true inner radius where the liquid surface normally sits (engine: flame/evaporation area).
//                   Flasks with a neck use the barrel/neck-at-the-mark radius, round bodies their mean radius.
// tolerance         real-world accuracy of the graduations (ISO/ASTM Class A/B figures, rounded)
import type { VesselType } from '../types';
import type { IconName } from '../ui/icons';

export type GlasswareCategory =
  | 'beakers'
  | 'flasks'
  | 'cylinders'
  | 'volumetric'
  | 'burettes'
  | 'pipettes'
  | 'tubes'
  | 'gas'
  | 'funnels'
  | 'dishes';

export interface GlasswareSpec {
  type: VesselType;
  label: string;
  category: GlasswareCategory;
  capacityMl: number;
  /** Printed volume when it differs from the brim-full capacity (a 50 mL burette holds ~55 mL above its 0 mark). */
  nominalMl?: number;
  glassMassG: number;
  innerRadiusCm: number;
  /** One line, e.g. "Class A, ±0.08 mL — to contain 100 mL at 20 °C". */
  description: string;
  tolerance?: string;
  icon: IconName;
  /** Absolute pressure (atm) at which the closure lets go (stopper pop). Open-mouth ware has only a loose cover. */
  popAtm: number;
  /** Absolute pressure (atm) at which the glass bursts (engine: vessel `burst_atm`). */
  burstAtm: number;
}

export const GLASSWARE_CATEGORIES: ReadonlyArray<{ id: GlasswareCategory; label: string; icon: IconName }> = [
  { id: 'beakers', label: 'Beakers', icon: 'beaker' },
  { id: 'flasks', label: 'Flasks', icon: 'erlenmeyer' },
  { id: 'cylinders', label: 'Cylinders', icon: 'cylinder' },
  { id: 'volumetric', label: 'Volumetric', icon: 'volumetric' },
  { id: 'burettes', label: 'Burettes', icon: 'burette' },
  { id: 'pipettes', label: 'Pipettes', icon: 'pipette' },
  { id: 'tubes', label: 'Tubes', icon: 'testTube' },
  { id: 'gas', label: 'Gas', icon: 'gasTube' },
  { id: 'funnels', label: 'Funnels', icon: 'funnel' },
  { id: 'dishes', label: 'Dishes', icon: 'dish' },
];

/** "1 L" for litre-scale pieces, "100 mL" otherwise (2 mL, 0.5 mL …). */
export function formatCapacity(ml: number): string {
  if (ml >= 1000) return `${+(ml / 1000).toFixed(2)} L`;
  return `${+ml.toFixed(1)} mL`;
}

/**
 * Closure and glass pressure limits by family (absolute atm). Rough bench figures, not ratings: ordinary lab glass is
 * not pressure ware; heavy-wall tubes and filter flasks take more, open-mouth beakers and dishes almost nothing.
 */
const PRESSURE_LIMITS: Record<GlasswareCategory, { popAtm: number; burstAtm: number }> = {
  beakers: { popAtm: 1.3, burstAtm: 2.0 },
  flasks: { popAtm: 2.2, burstAtm: 6.0 },
  cylinders: { popAtm: 1.5, burstAtm: 3.0 },
  volumetric: { popAtm: 1.8, burstAtm: 4.0 },
  burettes: { popAtm: 2.0, burstAtm: 5.0 },
  pipettes: { popAtm: 1.5, burstAtm: 3.0 },
  tubes: { popAtm: 2.5, burstAtm: 8.0 },
  gas: { popAtm: 1.5, burstAtm: 4.0 },
  funnels: { popAtm: 1.5, burstAtm: 3.0 },
  dishes: { popAtm: 1.3, burstAtm: 2.0 },
};

type Row = Omit<GlasswareSpec, 'label' | 'description' | 'popAtm' | 'burstAtm'> & {
  name: string;
  blurb: string;
  showCap?: boolean;
  popAtm?: number;
  burstAtm?: number;
};

// Row shorthand: name is prefixed to the capacity unless `showCap` is false (e.g. "Test tube").
const rows: Row[] = [
  // ---------------------------------------------------------------- beakers (Griffin low form, borosilicate 3.3)
  { type: 'beaker-50', name: 'Beaker', category: 'beakers', icon: 'beaker', capacityMl: 50, glassMassG: 32, innerRadiusCm: 2.1, tolerance: '±5 % (approximate)', blurb: 'Griffin low form, spout, rough graduations' },
  { type: 'beaker-100', name: 'Beaker', category: 'beakers', icon: 'beaker', capacityMl: 100, glassMassG: 52, innerRadiusCm: 2.5, tolerance: '±5 % (approximate)', blurb: 'Griffin low form, spout, rough graduations' },
  { type: 'beaker-250', name: 'Beaker', category: 'beakers', icon: 'beaker', capacityMl: 250, glassMassG: 110, innerRadiusCm: 3.3, tolerance: '±5 % (approximate)', blurb: 'Griffin low form, spout, rough graduations' },
  { type: 'beaker-400', name: 'Beaker', category: 'beakers', icon: 'beaker', capacityMl: 400, glassMassG: 160, innerRadiusCm: 3.8, tolerance: '±5 % (approximate)', blurb: 'Griffin low form, spout, rough graduations' },
  { type: 'beaker-600', name: 'Beaker', category: 'beakers', icon: 'beaker', capacityMl: 600, glassMassG: 215, innerRadiusCm: 4.4, tolerance: '±5 % (approximate)', blurb: 'Griffin low form, spout, rough graduations' },
  { type: 'beaker-1000', name: 'Beaker', category: 'beakers', icon: 'beaker', capacityMl: 1000, glassMassG: 330, innerRadiusCm: 5.2, tolerance: '±5 % (approximate)', blurb: 'Griffin low form, spout, rough graduations' },

  // ---------------------------------------------------------------- flasks
  { type: 'erlenmeyer-50', name: 'Erlenmeyer flask', category: 'flasks', icon: 'erlenmeyer', capacityMl: 50, glassMassG: 40, innerRadiusCm: 2.3, tolerance: '±5 % (approximate)', blurb: 'Conical, narrow neck — swirl without splashing' },
  { type: 'erlenmeyer-125', name: 'Erlenmeyer flask', category: 'flasks', icon: 'erlenmeyer', capacityMl: 125, glassMassG: 70, innerRadiusCm: 2.9, tolerance: '±5 % (approximate)', blurb: 'Conical, narrow neck — swirl without splashing' },
  { type: 'erlenmeyer-250', name: 'Erlenmeyer flask', category: 'flasks', icon: 'erlenmeyer', capacityMl: 250, glassMassG: 105, innerRadiusCm: 3.6, tolerance: '±5 % (approximate)', blurb: 'Conical, narrow neck — swirl without splashing' },
  { type: 'erlenmeyer-500', name: 'Erlenmeyer flask', category: 'flasks', icon: 'erlenmeyer', capacityMl: 500, glassMassG: 190, innerRadiusCm: 4.6, tolerance: '±5 % (approximate)', blurb: 'Conical, narrow neck — swirl without splashing' },
  { type: 'round-bottom-50', name: 'Round-bottom flask', category: 'flasks', icon: 'roundFlask', capacityMl: 50, glassMassG: 35, innerRadiusCm: 2.3, blurb: 'Even heating, no graduations' },
  { type: 'round-bottom-100', name: 'Round-bottom flask', category: 'flasks', icon: 'roundFlask', capacityMl: 100, glassMassG: 55, innerRadiusCm: 2.8, blurb: 'Even heating, no graduations' },
  { type: 'round-bottom-250', name: 'Round-bottom flask', category: 'flasks', icon: 'roundFlask', capacityMl: 250, glassMassG: 105, innerRadiusCm: 4.0, blurb: 'Even heating, no graduations' },
  { type: 'round-bottom-500', name: 'Round-bottom flask', category: 'flasks', icon: 'roundFlask', capacityMl: 500, glassMassG: 190, innerRadiusCm: 5.0, blurb: 'Even heating, no graduations' },
  { type: 'florence-500', name: 'Florence flask', category: 'flasks', icon: 'roundFlask', capacityMl: 500, glassMassG: 180, innerRadiusCm: 5.0, blurb: 'Flat-bottom boiling flask, long neck, stands on the bench' },
  { type: 'buchner-flask-250', name: 'Büchner flask', category: 'flasks', icon: 'erlenmeyer', capacityMl: 250, glassMassG: 200, innerRadiusCm: 3.6, burstAtm: 8.0, blurb: 'Heavy-wall filter flask with a side arm for vacuum' },

  // ---------------------------------------------------------------- graduated cylinders (ISO 6706 class B)
  { type: 'cylinder-10', name: 'Graduated cylinder', category: 'cylinders', icon: 'cylinder', capacityMl: 10, glassMassG: 30, innerRadiusCm: 0.6, tolerance: 'Class B, ±0.2 mL', blurb: 'Tall form, hexagonal base' },
  { type: 'cylinder-25', name: 'Graduated cylinder', category: 'cylinders', icon: 'cylinder', capacityMl: 25, glassMassG: 60, innerRadiusCm: 0.9, tolerance: 'Class B, ±0.5 mL', blurb: 'Tall form, hexagonal base' },
  { type: 'cylinder-50', name: 'Graduated cylinder', category: 'cylinders', icon: 'cylinder', capacityMl: 50, glassMassG: 95, innerRadiusCm: 1.2, tolerance: 'Class B, ±1.0 mL', blurb: 'Tall form, hexagonal base' },
  { type: 'cylinder-100', name: 'Graduated cylinder', category: 'cylinders', icon: 'cylinder', capacityMl: 100, glassMassG: 140, innerRadiusCm: 1.5, tolerance: 'Class B, ±1.0 mL', blurb: 'Tall form, hexagonal base' },
  { type: 'cylinder-250', name: 'Graduated cylinder', category: 'cylinders', icon: 'cylinder', capacityMl: 250, glassMassG: 270, innerRadiusCm: 2.2, tolerance: 'Class B, ±2.0 mL', blurb: 'Tall form, hexagonal base' },
  { type: 'cylinder-500', name: 'Graduated cylinder', category: 'cylinders', icon: 'cylinder', capacityMl: 500, glassMassG: 480, innerRadiusCm: 2.7, tolerance: 'Class B, ±5.0 mL', blurb: 'Tall form, hexagonal base' },
  { type: 'cylinder-1000', name: 'Graduated cylinder', category: 'cylinders', icon: 'cylinder', capacityMl: 1000, glassMassG: 850, innerRadiusCm: 3.3, tolerance: 'Class B, ±10 mL', blurb: 'Tall form, hexagonal base' },

  // ---------------------------------------------------------------- volumetric flasks (Class A, to contain at 20 °C)
  // innerRadiusCm is the neck radius at the calibration ring (that is where the surface ends up).
  { type: 'volumetric-25', name: 'Volumetric flask', category: 'volumetric', icon: 'volumetric', capacityMl: 25, glassMassG: 35, innerRadiusCm: 0.65, tolerance: 'Class A, ±0.03 mL', blurb: 'to contain 25 mL at 20 °C, one ring on the neck' },
  { type: 'volumetric-50', name: 'Volumetric flask', category: 'volumetric', icon: 'volumetric', capacityMl: 50, glassMassG: 50, innerRadiusCm: 0.75, tolerance: 'Class A, ±0.05 mL', blurb: 'to contain 50 mL at 20 °C, one ring on the neck' },
  { type: 'volumetric-100', name: 'Volumetric flask', category: 'volumetric', icon: 'volumetric', capacityMl: 100, glassMassG: 60, innerRadiusCm: 0.85, tolerance: 'Class A, ±0.08 mL', blurb: 'to contain 100 mL at 20 °C, one ring on the neck' },
  { type: 'volumetric-250', name: 'Volumetric flask', category: 'volumetric', icon: 'volumetric', capacityMl: 250, glassMassG: 105, innerRadiusCm: 1.0, tolerance: 'Class A, ±0.12 mL', blurb: 'to contain 250 mL at 20 °C, one ring on the neck' },
  { type: 'volumetric-500', name: 'Volumetric flask', category: 'volumetric', icon: 'volumetric', capacityMl: 500, glassMassG: 170, innerRadiusCm: 1.2, tolerance: 'Class A, ±0.20 mL', blurb: 'to contain 500 mL at 20 °C, one ring on the neck' },
  { type: 'volumetric-1000', name: 'Volumetric flask', category: 'volumetric', icon: 'volumetric', capacityMl: 1000, glassMassG: 265, innerRadiusCm: 1.4, tolerance: 'Class A, ±0.30 mL', blurb: 'to contain 1 L at 20 °C, one ring on the neck' },

  // ---------------------------------------------------------------- burettes (Class A, 0 at the top, stopcock below)
  { type: 'burette-25', name: 'Burette', category: 'burettes', icon: 'burette', capacityMl: 28, nominalMl: 25, glassMassG: 160, innerRadiusCm: 0.38, tolerance: 'Class A, ±0.03 mL', blurb: 'to deliver, 0.1 mL graduations, PTFE stopcock' },
  { type: 'burette-50', name: 'Burette', category: 'burettes', icon: 'burette', capacityMl: 55.5, nominalMl: 50, glassMassG: 190, innerRadiusCm: 0.52, tolerance: 'Class A, ±0.05 mL', blurb: 'to deliver, 0.1 mL graduations, PTFE stopcock' },

  // ---------------------------------------------------------------- pipettes (radius = stem bore)
  { type: 'pipette-volumetric-10', name: 'Volumetric pipette', category: 'pipettes', icon: 'pipette', capacityMl: 10, glassMassG: 12, innerRadiusCm: 0.3, tolerance: 'Class A, ±0.02 mL', blurb: 'to deliver 10 mL, single mark above the bulb' },
  { type: 'pipette-volumetric-25', name: 'Volumetric pipette', category: 'pipettes', icon: 'pipette', capacityMl: 25, glassMassG: 20, innerRadiusCm: 0.35, tolerance: 'Class A, ±0.03 mL', blurb: 'to deliver 25 mL, single mark above the bulb' },
  { type: 'pipette-graduated-5', name: 'Graduated pipette', category: 'pipettes', icon: 'pipette', capacityMl: 5, glassMassG: 8, innerRadiusCm: 0.3, tolerance: 'Class A, ±0.03 mL', blurb: 'to deliver, 0.05 mL graduations' },
  { type: 'pipette-graduated-10', name: 'Graduated pipette', category: 'pipettes', icon: 'pipette', capacityMl: 10, glassMassG: 12, innerRadiusCm: 0.4, tolerance: 'Class A, ±0.05 mL', blurb: 'to deliver, 0.1 mL graduations' },
  { type: 'pipette-pasteur', name: 'Pasteur pipette', category: 'pipettes', icon: 'pipette', capacityMl: 2, glassMassG: 2.5, innerRadiusCm: 0.2, blurb: 'Uncalibrated dropper, about 20 drops per mL', showCap: false },

  // ---------------------------------------------------------------- tubes
  { type: 'test-tube', name: 'Test tube', category: 'tubes', icon: 'testTube', capacityMl: 30, glassMassG: 20, innerRadiusCm: 0.8, blurb: '18 × 150 mm borosilicate, uncalibrated', showCap: false },
  { type: 'test-tube-small', name: 'Small test tube', category: 'tubes', icon: 'testTube', capacityMl: 8, glassMassG: 8, innerRadiusCm: 0.55, blurb: '13 × 100 mm borosilicate, uncalibrated', showCap: false },
  { type: 'boiling-tube-25', name: 'Boiling tube', category: 'tubes', icon: 'testTube', capacityMl: 25, glassMassG: 25, innerRadiusCm: 0.95, blurb: 'Wide, thick-wall tube for heating in a flame' },
  { type: 'centrifuge-tube-15', name: 'Centrifuge tube', category: 'tubes', icon: 'centrifuge', capacityMl: 15, glassMassG: 6, innerRadiusCm: 0.7, tolerance: '±10 % (printed marks)', blurb: 'Polypropylene, conical bottom, screw cap' },
  { type: 'centrifuge-tube-50', name: 'Centrifuge tube', category: 'tubes', icon: 'centrifuge', capacityMl: 50, glassMassG: 13, innerRadiusCm: 1.35, tolerance: '±10 % (printed marks)', blurb: 'Polypropylene, conical bottom, screw cap' },

  // ---------------------------------------------------------------- gas handling
  { type: 'gas-collection-tube-50', name: 'Gas collection tube', category: 'gas', icon: 'gasTube', capacityMl: 50, glassMassG: 45, innerRadiusCm: 1.0, tolerance: '±0.5 mL', blurb: 'Graduated, closed at the top, for collecting over water' },
  { type: 'gas-syringe-100', name: 'Gas syringe', category: 'gas', icon: 'syringe', capacityMl: 100, glassMassG: 140, innerRadiusCm: 1.5, tolerance: '±1 mL', blurb: 'Glass barrel with a free-moving plunger' },
  { type: 'gas-jar-250', name: 'Gas jar', category: 'gas', icon: 'cylinder', capacityMl: 250, glassMassG: 200, innerRadiusCm: 2.75, blurb: 'Wide-mouth jar with ground rim, covered with a glass plate', showCap: true },

  // ---------------------------------------------------------------- funnels
  { type: 'separatory-funnel-250', name: 'Separatory funnel', category: 'funnels', icon: 'funnel', capacityMl: 250, glassMassG: 230, innerRadiusCm: 3.3, blurb: 'Pear shape, PTFE stopcock — drain the lower layer' },
  { type: 'filter-funnel-75', name: 'Filter funnel', category: 'funnels', icon: 'funnel', capacityMl: 75, glassMassG: 40, innerRadiusCm: 3.0, blurb: '75 mm conical funnel for gravity filtration' },
  { type: 'buchner-funnel-90', name: 'Büchner funnel', category: 'funnels', icon: 'funnel', capacityMl: 150, glassMassG: 180, innerRadiusCm: 4.0, blurb: '90 mm porcelain, perforated plate for vacuum filtration' },

  // ---------------------------------------------------------------- dishes / open vessels
  { type: 'evaporating-dish-100', name: 'Evaporating dish', category: 'dishes', icon: 'dish', capacityMl: 100, glassMassG: 90, innerRadiusCm: 4.0, blurb: 'Glazed porcelain with a spout, for boiling down solutions' },
  { type: 'petri-dish-90', name: 'Petri dish', category: 'dishes', icon: 'dish', capacityMl: 50, glassMassG: 40, innerRadiusCm: 4.4, blurb: '90 mm borosilicate dish for crystals and thin layers', showCap: false },
  { type: 'watch-glass-75', name: 'Watch glass', category: 'dishes', icon: 'dish', capacityMl: 10, glassMassG: 20, innerRadiusCm: 2.5, blurb: '75 mm curved disc — holds a few mL or a pinch of solid', showCap: false },
  { type: 'crucible-30', name: 'Crucible', category: 'dishes', icon: 'dish', capacityMl: 30, glassMassG: 28, innerRadiusCm: 1.5, blurb: 'Porcelain, withstands strong heating' },
  { type: 'weigh-boat', name: 'Weigh boat', category: 'dishes', icon: 'dish', capacityMl: 25, glassMassG: 1, innerRadiusCm: 2.0, blurb: 'Disposable polystyrene tray for weighing solids', showCap: false },
];

export const GLASSWARE: GlasswareSpec[] = rows.map((r) => {
  const label = r.showCap === false ? r.name : `${r.name} ${formatCapacity(r.nominalMl ?? r.capacityMl)}`;
  const description = r.tolerance && !r.tolerance.startsWith('Class') ? `${r.blurb} (${r.tolerance})` : r.tolerance ? `${r.tolerance} — ${r.blurb}` : r.blurb;
  const { name: _n, blurb: _b, showCap: _s, popAtm, burstAtm, ...spec } = r;
  const lim = PRESSURE_LIMITS[r.category];
  return { ...spec, label, description, popAtm: popAtm ?? lim.popAtm, burstAtm: burstAtm ?? lim.burstAtm };
});

const BY_TYPE = new Map<VesselType, GlasswareSpec>(GLASSWARE.map((g) => [g.type, g]));

/** Spec for a vessel type; unknown types (old saves) fall back to the 250 mL beaker. */
export function glasswareSpec(type: VesselType): GlasswareSpec {
  return BY_TYPE.get(type) ?? BY_TYPE.get('beaker-250')!;
}

// ---------------------------------------------------------------------------------------------- search
// Words people type that are not in the labels ("conical", "titration", "rbf", "measuring"…).
const ALIASES: Record<GlasswareCategory, string> = {
  beakers: 'beaker griffin',
  flasks: 'flask conical erlenmeyer rbf',
  cylinders: 'cylinder measuring graduated grad',
  volumetric: 'volumetric flask standard solution make up dilution',
  burettes: 'burette buret titration titrant titrate stopcock',
  pipettes: 'pipette pipet dropper transfer',
  tubes: 'tube falcon',
  gas: 'gas collection collect syringe jar eudiometer',
  funnels: 'funnel filter filtration separating extraction',
  dishes: 'dish evaporating evaporation petri watch glass crucible weigh boat weighing',
};

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(litres?|liters?)\b/g, 'l')
    .replace(/(\d)\s+(ml|l|mm)\b/g, '$1$2');
}

interface Indexed {
  spec: GlasswareSpec;
  text: string;
  words: Set<string>;
}

let index: Indexed[] | null = null;

function buildIndex(): Indexed[] {
  return GLASSWARE.map((spec) => {
    const cat = GLASSWARE_CATEGORIES.find((c) => c.id === spec.category)!;
    const text = fold(`${spec.label} ${spec.type} ${spec.description} ${cat.label} ${ALIASES[spec.category]}`);
    return { spec, text, words: new Set(text.split(/[^a-z0-9.]+/).filter(Boolean)) };
  });
}

/**
 * Glassware matching a free-text query ("100 mL burette", "conical", "1l volumetric", "titration"). Every token must
 * match; plain numbers match the capacity (or a number in the description, e.g. a 75 mm funnel), "100ml"/"1l" match the capacity.
 */
export function searchGlassware(query: string, category?: GlasswareCategory | null): GlasswareSpec[] {
  index ??= buildIndex();
  const tokens = fold(query).split(/[\s,]+/).filter((t) => t && t !== 'ml' && t !== 'l');
  return index
    .filter(({ spec, text, words }) => {
      if (category && spec.category !== category) return false;
      return tokens.every((t) => {
        const m = t.match(/^(\d+(?:\.\d+)?)(ml|l)?$/);
        if (m) {
          const n = parseFloat(m[1]) * (m[2] === 'l' ? 1000 : 1);
          if (spec.capacityMl === n || spec.nominalMl === n) return true;
          return !m[2] && words.has(m[1]);
        }
        return text.includes(t);
      });
    })
    .map((x) => x.spec);
}
