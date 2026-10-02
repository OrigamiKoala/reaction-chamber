// Small floating readout while a stopcock (burette, separatory funnel) is open: how fast it runs and a Close button
// (Esc does the same). It only reads `states()` and calls `close()`; chemistry and 3D live in bench/titration.ts.
import { h, setText } from './dom';
import type { DispenserState } from '../bench/titration';

export interface TitrationHudHost {
  states(): DispenserState[];
  /** Close every open stopcock. */
  close(): void;
}

export class TitrationHud {
  public readonly el: HTMLElement;
  private text: HTMLElement;
  private btn: HTMLButtonElement;
  private raf = 0;
  private last = 0;

  constructor(private host: TitrationHudHost) {
    this.text = h('span', { class: 'sh-text' });
    this.btn = h('button', { class: 'sh-close', type: 'button', title: 'Close the stopcock (Esc)', text: 'Close stopcock' });
    this.btn.addEventListener('click', () => this.host.close());
    this.el = h('div', { class: 'stopcock-hud', role: 'status', 'aria-live': 'off' }, this.text, this.btn);
  }

  public start() {
    if (this.raf) return;
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      if (t - this.last < 100) return;
      this.last = t;
      try {
        this.update();
      } catch (e) {
        console.warn('[titration_hud] update failed', e);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  private update() {
    const open = this.host.states();
    this.el.classList.toggle('is-on', open.length > 0);
    if (!open.length) return;
    const line = open
      .map((s) => {
        const what = s.kind === 'burette' ? 'Burette' : 'Funnel';
        const rate = s.flow >= 0.995 ? s.flow.toFixed(1) : s.flow.toFixed(2);
        return s.flowing ? `${what} stopcock: ${s.word} · ${rate} mL/s` : `${what} stopcock: ${s.word}`;
      })
      .join('   |   ');
    setText(this.text, line);
  }
}
