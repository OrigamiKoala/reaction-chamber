// Custom chemistry: register a compound (becomes a reacting catalog reagent) or a reaction.
import { ReagentCatalogEntry } from '../types/sim';
import { Modal } from './modal';

export interface CustomReactionInput {
  id: string;
  equation: string;
  type: string;
  k: number;
  delta_h_kj: number;
  ea: number;
}

export class CustomReactionModal {
  private modal: Modal;
  public onRegisterCompound?: (entry: ReagentCatalogEntry) => Promise<boolean>;
  public onRegisterReaction?: (rxn: CustomReactionInput) => Promise<boolean>;

  constructor() {
    this.modal = new Modal('Custom chemistry', { className: 'modal-custom' });
    this.modal.body.innerHTML = `
      <div class="tabs" role="tablist" aria-label="What to register">
        <button class="tab" role="tab" id="cc-tab-comp" aria-controls="cc-pane-comp" aria-selected="true">Compound</button>
        <button class="tab" role="tab" id="cc-tab-rxn" aria-controls="cc-pane-rxn" aria-selected="false" tabindex="-1">Reaction</button>
      </div>

      <form class="form" id="cc-pane-comp" role="tabpanel" aria-labelledby="cc-tab-comp" novalidate>
        <p class="form-desc">Adds a reagent the engine can react with. The formula is parsed into elements automatically.</p>
        <div class="form-grid">
          <label class="f">Name<input name="id" type="text" placeholder="e.g. potassium permanganate" required /></label>
          <label class="f">Formula<input name="formula" type="text" placeholder="e.g. KMnO4" required spellcheck="false" /></label>
          <label class="f">Form
            <select name="form">
              <option value="solution">Aqueous solution</option>
              <option value="liquid">Pure liquid</option>
              <option value="solid">Solid</option>
            </select>
          </label>
          <label class="f">Concentration (M)<input name="conc" type="number" step="0.01" min="0" placeholder="0.10" /></label>
          <label class="f">Density (g/mL)<input name="density" type="number" step="0.01" min="0" value="1.0" /></label>
          <label class="f">Bottle
            <select name="bottle">
              <option value="clear">Clear glass</option>
              <option value="amber">Amber glass</option>
              <option value="white">White plastic</option>
            </select>
          </label>
        </div>
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Register compound</button></div>
      </form>

      <form class="form" id="cc-pane-rxn" role="tabpanel" aria-labelledby="cc-tab-rxn" hidden novalidate>
        <p class="form-desc">A reversible equilibrium or an irreversible (Arrhenius) reaction between registered species.</p>
        <div class="form-grid">
          <label class="f f-wide">Reaction ID<input name="id" type="text" placeholder="e.g. esterification" required /></label>
          <label class="f f-wide">Equation<input name="equation" type="text" placeholder="A + B <=> C + D   or   A + B -> C + D(g)" required spellcheck="false" /></label>
          <label class="f">Type
            <select name="type">
              <option value="equilibrium">Equilibrium</option>
              <option value="kinetic">Kinetic (Arrhenius)</option>
            </select>
          </label>
          <label class="f">log₁₀ K or Arrhenius A<input name="k" type="number" step="0.1" value="0" /></label>
          <label class="f">ΔH (kJ/mol)<input name="dh" type="number" step="1" value="0" /></label>
          <label class="f">Eₐ (J/mol)<input name="ea" type="number" step="1000" value="20000" /></label>
        </div>
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Register reaction</button></div>
      </form>`;
    this.bind();
  }

  public show() {
    this.modal.open();
    (this.modal.body.querySelector('form:not([hidden]) input') as HTMLInputElement | null)?.focus();
  }

  public hide() {
    this.modal.close();
  }

  private bind() {
    const body = this.modal.body;
    const tabs = Array.from(body.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const select = (i: number) => {
      tabs.forEach((t, j) => {
        t.setAttribute('aria-selected', String(i === j));
        t.tabIndex = i === j ? 0 : -1;
        (body.querySelector(`#${t.getAttribute('aria-controls')}`) as HTMLElement).hidden = i !== j;
      });
      tabs[i].focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          select((i + 1) % tabs.length);
        }
      });
    });

    const comp = body.querySelector('#cc-pane-comp') as HTMLFormElement;
    const rxn = body.querySelector('#cc-pane-rxn') as HTMLFormElement;
    const err = (form: HTMLFormElement, msg: string) => {
      const el = form.querySelector('.form-error') as HTMLElement;
      el.textContent = msg;
      el.hidden = !msg;
    };
    const val = (form: HTMLFormElement, name: string) =>
      ((form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null)?.value ?? '').trim();

    comp.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = val(comp, 'id');
      const formula = val(comp, 'formula');
      const form = val(comp, 'form') as ReagentCatalogEntry['form'];
      const conc = val(comp, 'conc') ? parseFloat(val(comp, 'conc')) : undefined;
      const density = parseFloat(val(comp, 'density')) || 1.0;
      const bottle = val(comp, 'bottle') as ReagentCatalogEntry['bottle_colour'];
      if (!name || !formula) return err(comp, 'Enter a name and a formula.');
      if (form === 'solution' && !(conc && conc > 0)) return err(comp, 'Enter a concentration for a solution.');
      err(comp, '');
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || formula;
      const composition: Record<string, number> = {};
      if (form === 'solution' && conc) {
        composition[formula] = conc / 1000.0;
        composition['H2O'] = 0.055;
      } else if (form === 'solid') {
        composition[`${formula}(s)`] = 0.01;
      } else {
        composition[formula] = 0.02;
      }
      const entry: ReagentCatalogEntry = {
        id,
        name,
        formula,
        form,
        concentration_m: conc,
        density_g_ml: density,
        ghs: ['GHS07'],
        signal_word: 'Warning',
        bottle_colour: bottle,
        composition,
        label: formula,
        by_mass: form === 'solid',
      };
      const ok = (await this.onRegisterCompound?.(entry)) ?? false;
      if (ok) {
        comp.reset();
        this.hide();
      }
    });

    rxn.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = val(rxn, 'id');
      const equation = val(rxn, 'equation');
      if (!id || !equation) return err(rxn, 'Enter a reaction ID and an equation.');
      if (!/(<=>|->|→|⇌)/.test(equation)) return err(rxn, 'Use “<=>” for an equilibrium or “->” for a one-way reaction.');
      err(rxn, '');
      const ok =
        (await this.onRegisterReaction?.({
          id,
          equation,
          type: val(rxn, 'type'),
          k: parseFloat(val(rxn, 'k')) || 0,
          delta_h_kj: parseFloat(val(rxn, 'dh')) || 0,
          ea: parseFloat(val(rxn, 'ea')) || 0,
        })) ?? false;
      if (ok) {
        rxn.reset();
        this.hide();
      }
    });
  }
}
