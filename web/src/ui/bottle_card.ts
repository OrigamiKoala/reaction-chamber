// Property card for PubChem-imported compounds: sourced values + user overrides (the engine re-models the compound on save).
import { BottleState } from '../types';
import { saveUserOverride, getUserOverrides } from '../pubchem/cache';
import { splitSaltsAndHydrates } from '../pubchem/splitter';
import { Modal } from './modal';
import { esc, prettyFormula } from './dom';
import { hazardWords } from '../app/reagent_library';
import { toast } from './toast';

type Key = 'mp_c' | 'bp_c' | 'density' | 'solubility';

const FIELDS: Array<{ key: Key; label: string; type: 'number' | 'text'; step?: string }> = [
  { key: 'mp_c', label: 'Melting point (°C)', type: 'number', step: '0.1' },
  { key: 'bp_c', label: 'Boiling point (°C)', type: 'number', step: '0.1' },
  { key: 'density', label: 'Density (g/cm³)', type: 'number', step: '0.001' },
  { key: 'solubility', label: 'Solubility', type: 'text' },
];

export class BottleCard {
  private modal: Modal;
  private bottle: BottleState | null = null;
  public onBottleUpdated?: (bottle: BottleState) => void;
  public onAddToVessel?: (bottle: BottleState) => void;

  constructor() {
    this.modal = new Modal('Compound', { className: 'modal-bottle' });
  }

  public async showBottle(bottle: BottleState) {
    this.bottle = bottle;
    try {
      const ov = await getUserOverrides(bottle.inchi_key);
      if (ov) bottle.userOverrides = { ...ov };
    } catch {
      /* cache unavailable */
    }
    this.render();
    this.modal.open();
  }

  public hide() {
    this.modal.close();
  }

  private render() {
    const b = this.bottle;
    if (!b) return;
    const ov = b.userOverrides || {};
    this.modal.setTitle(b.name);
    let fragments = '';
    try {
      const d = splitSaltsAndHydrates(b.smiles);
      fragments = d.components
        .map((c) => `<span class="pill mono">${esc(prettyFormula(c.formula))} ×${c.stoichiometry}</span>`)
        .join('');
    } catch {
      fragments = '';
    }
    const hz = hazardWords(b.ghs);
    const anyOverride = FIELDS.some((f) => ov[f.key] !== undefined);

    this.modal.body.innerHTML = `
      <p class="bc-sub"><span class="mono">${esc(prettyFormula(b.formula))}</span> · ${b.mw ? b.mw.toFixed(2) + ' g/mol' : ''}${b.cid ? ` · CID ${b.cid}` : ''}</p>
      <p class="add-note">Imported from PubChem. The engine derives melting, boiling and dissolving from these values; blank means PubChem had none.</p>
      ${hz.length ? `<p class="add-hazard is-warning"><span class="hz-dot" aria-hidden="true"></span>${esc(hz.join(', '))}</p>` : ''}
      <form class="form" novalidate>
        <div class="form-grid">
          ${FIELDS.map((f) => {
            // mp / bp / density that PubChem did not give are placeholders in the record: show them as missing, not as data.
            const missing = (f.key === 'mp_c' || f.key === 'bp_c' || f.key === 'density') && b.sourcedProperties.known?.[f.key] === false;
            const src = missing ? undefined : b.sourcedProperties[f.key];
            const cur = ov[f.key] !== undefined ? ov[f.key] : src;
            return `<label class="f">${f.label}${ov[f.key] !== undefined ? ' <span class="tag tag-user">edited</span>' : ''}
              <input name="${f.key}" type="${f.type}" ${f.step ? `step="${f.step}"` : ''} value="${esc(String(cur ?? ''))}" />
              <span class="f-hint">PubChem: ${esc(String(src ?? '—'))}</span></label>`;
          }).join('')}
        </div>
        ${fragments ? `<div class="bc-frag"><span class="eyebrow">Dissolves into</span><div class="pill-row">${fragments}</div></div>` : ''}
        <details class="bc-ids"><summary>Identifiers</summary>
          <dl class="kv"><dt>InChIKey</dt><dd class="mono">${esc(b.inchi_key)}</dd><dt>SMILES</dt><dd class="mono">${esc(b.smiles)}</dd></dl>
        </details>
        <div class="form-actions">
          <button class="btn btn-ghost" type="button" data-act="reset" ${anyOverride ? '' : 'disabled'}>Reset to PubChem values</button>
          <button class="btn btn-ghost" type="submit">Save changes</button>
          <button class="btn btn-primary" type="button" data-act="add">Add to a vessel</button>
        </div>
      </form>`;

    const form = this.modal.body.querySelector('form') as HTMLFormElement;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const next: Partial<Record<Key, number | string>> = {};
      for (const f of FIELDS) {
        const raw = (form.elements.namedItem(f.key) as HTMLInputElement).value.trim();
        const src = b.sourcedProperties[f.key];
        if (f.type === 'number') {
          const v = parseFloat(raw);
          if (isFinite(v) && v !== src) next[f.key] = v;
        } else if (raw && raw !== src) next[f.key] = raw;
      }
      b.userOverrides = next as BottleState['userOverrides'];
      await this.persist(b);
      toast('Saved changes.', 'success');
      this.render();
    });
    form.querySelector('[data-act="reset"]')?.addEventListener('click', async () => {
      b.userOverrides = {};
      await this.persist(b);
      toast('Reset to PubChem values.', 'success');
      this.render();
    });
    form.querySelector('[data-act="add"]')?.addEventListener('click', () => {
      this.hide();
      this.onAddToVessel?.(b);
    });
  }

  private async persist(b: BottleState) {
    try {
      await saveUserOverride(b.inchi_key, b.userOverrides as Record<string, unknown>);
    } catch {
      /* cache unavailable */
    }
    this.onBottleUpdated?.(b);
  }
}
