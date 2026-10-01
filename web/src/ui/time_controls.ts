// Bottom-centre time controls: pause/play, speed, simulation clock.
import type { SimController } from '../sim/sim_controller';
import { h, setText, fmtClock } from './dom';
import { icon } from './icons';

const SPEEDS = [1, 5, 20];

export class TimeControls {
  public readonly el: HTMLElement;
  private playBtn: HTMLButtonElement;
  private clock: HTMLElement;
  private speedBtns: HTMLButtonElement[] = [];

  constructor(private sim: SimController) {
    this.el = h('div', { class: 'timebar', role: 'toolbar', 'aria-label': 'Simulation time' });
    this.playBtn = h('button', { class: 'icon-btn time-play', type: 'button' });
    this.playBtn.addEventListener('click', () => this.togglePause());
    this.clock = h('span', { class: 'time-clock', 'aria-label': 'Simulated time', text: '00:00.0' });
    const speeds = h('div', { class: 'seg', role: 'group', 'aria-label': 'Speed' });
    for (const s of SPEEDS) {
      const b = h('button', { class: 'seg-btn', type: 'button', 'aria-pressed': String(s === sim.speedMultiplier), text: `${s}×`, 'aria-label': `${s} times speed` });
      b.addEventListener('click', () => this.setSpeed(s));
      speeds.append(b);
      this.speedBtns.push(b);
    }
    this.el.append(this.playBtn, this.clock, speeds);
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

  public setClock(tSimS: number) {
    setText(this.clock, fmtClock(tSimS));
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
