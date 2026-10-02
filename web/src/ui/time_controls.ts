// Bottom-centre time controls: pause/play, speed, and the *reaction timer* of the selected vessel.
// The timer does not run from vessel creation: it waits until a real reaction starts (detected in app/reaction_clock.ts)
// or until the user presses Start (stopwatch). Simulation stepping (pause, 1×/5×/20×) is independent of it.
import type { SimController } from '../sim/sim_controller';
import type { ClockInfo } from '../app/reaction_clock';
import { h, setText, fmtClock } from './dom';
import { icon } from './icons';

const SPEEDS = [1, 5, 20];

export class TimeControls {
  public readonly el: HTMLElement;
  /** Wired by main.ts to the selected vessel's clock (Lab.startReactionClock / stop / reset). */
  public onStart?: () => void;
  public onStop?: () => void;
  public onReset?: () => void;

  private playBtn: HTMLButtonElement;
  private clock: HTMLElement;
  private label: HTMLElement;
  private timer: HTMLElement;
  private startStopBtn: HTMLButtonElement;
  private resetBtn: HTMLButtonElement;
  private speedBtns: HTMLButtonElement[] = [];
  private phase: ClockInfo['phase'] | 'none' = 'none';

  constructor(private sim: SimController) {
    this.el = h('div', { class: 'timebar', role: 'toolbar', 'aria-label': 'Simulation time' });
    this.playBtn = h('button', { class: 'icon-btn time-play', type: 'button' });
    this.playBtn.addEventListener('click', () => this.togglePause());

    this.clock = h('span', { class: 'time-clock', 'aria-label': 'Reaction time', text: '00:00.0' });
    this.label = h('span', { class: 'time-label', text: 'waiting for reaction' });
    this.timer = h('div', { class: 'time-timer is-waiting', role: 'timer', 'aria-live': 'off' }, this.clock, this.label);

    this.startStopBtn = h('button', { class: 'time-act', type: 'button', text: 'Start', title: 'Start the reaction timer by hand' });
    this.startStopBtn.addEventListener('click', () => {
      if (this.phase === 'running') this.onStop?.();
      else this.onStart?.();
    });
    this.resetBtn = h('button', { class: 'time-act', type: 'button', text: 'Reset', title: 'Reset the reaction timer' });
    this.resetBtn.addEventListener('click', () => this.onReset?.());

    const speeds = h('div', { class: 'seg', role: 'group', 'aria-label': 'Speed' });
    for (const s of SPEEDS) {
      const b = h('button', { class: 'seg-btn', type: 'button', 'aria-pressed': String(s === sim.speedMultiplier), text: `${s}×`, 'aria-label': `${s} times speed` });
      b.addEventListener('click', () => this.setSpeed(s));
      speeds.append(b);
      this.speedBtns.push(b);
    }
    this.el.append(this.playBtn, this.timer, this.startStopBtn, this.resetBtn, speeds);
    this.setClock(null);
    this.paint();
  }

  public togglePause() {
    this.sim.isPaused = !this.sim.isPaused;
    this.paint();
  }

  public setSpeed(s: number) {
    this.sim.speedMultiplier = s;
    this.paint();
  }

  /**
   * Shows the selected vessel's reaction clock. `null` = no vessel selected. A bare number is accepted for
   * compatibility and treated as an already-running clock with that elapsed time.
   */
  public setClock(info: ClockInfo | number | null) {
    const ci: ClockInfo | null = typeof info === 'number' ? { phase: 'running', elapsedS: info, auto: true } : info;
    if (!ci) {
      this.phase = 'none';
      setText(this.clock, fmtClock(0));
      setText(this.label, 'no vessel selected');
      this.timer.dataset.phase = 'none';
      this.startStopBtn.disabled = true;
      this.resetBtn.disabled = true;
      setText(this.startStopBtn, 'Start');
      return;
    }
    setText(this.clock, fmtClock(ci.elapsedS));
    if (ci.phase !== this.phase) {
      this.phase = ci.phase;
      this.timer.dataset.phase = ci.phase;
      this.startStopBtn.disabled = false;
      setText(this.startStopBtn, ci.phase === 'running' ? 'Stop' : ci.phase === 'stopped' ? 'Resume' : 'Start');
      this.resetBtn.disabled = ci.phase === 'waiting';
    }
    const label = ci.phase === 'waiting' ? 'waiting for reaction' : ci.phase === 'stopped' ? 'stopped' : ci.auto ? 'since reaction began' : 'timing by hand';
    if (this.label.textContent !== label) setText(this.label, label);
    const title = ci.reason ? `Started by: ${ci.reason}` : '';
    if (this.timer.title !== title) this.timer.title = title;
  }

  private paint() {
    const paused = this.sim.isPaused;
    this.playBtn.innerHTML = icon(paused ? 'play' : 'pause', 16);
    this.playBtn.setAttribute('aria-label', paused ? 'Resume simulation (Space)' : 'Pause simulation (Space)');
    this.playBtn.title = paused ? 'Resume (Space)' : 'Pause (Space)';
    this.el.classList.toggle('is-paused', paused);
    this.speedBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(SPEEDS[i] === this.sim.speedMultiplier)));
  }
}
