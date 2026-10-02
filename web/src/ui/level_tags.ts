// Floating instrument readouts beside a vessel: burette delivered volume and gas-collector volume.
// Ordinary vessels get no tag (the glass graduations and the vessel panel already show the volume).
import { h } from './dom';

export interface LevelTagsHost {
  /** Vessels that should be labelled right now. */
  focusIds(): string[];
  /** Screen anchor (px, relative to the overlay) or null when the vessel is gone. */
  anchor(id: string): { x: number; y: number; visible: boolean } | null;
  /** Readout text for instrument vessels (burette, gas collector: "Gas: 37 mL" / "at 21 °C · H₂"); null = no tag. */
  label?(id: string): { text: string; sub: string } | null;
}

interface Tag {
  el: HTMLElement;
  vol: HTMLElement;
  sub: HTMLElement;
  last: string;
  lastSub: string;
}

export class LevelTags {
  public readonly el: HTMLElement;
  private tags = new Map<string, Tag>();
  private raf = 0;
  private lastTick = 0;

  constructor(private host: LevelTagsHost) {
    this.el = h('div', { class: 'level-tags', 'aria-hidden': 'true' });
  }

  public start() {
    if (this.raf) return;
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      if (t - this.lastTick < 33) return; // ~30 Hz is plenty for a label
      this.lastTick = t;
      try {
        this.update();
      } catch (e) {
        console.warn('[level_tags] update failed', e);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  public stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private update() {
    const ids = new Set(this.host.focusIds());
    for (const [id, tag] of this.tags) {
      if (!ids.has(id)) {
        tag.el.remove();
        this.tags.delete(id);
      }
    }
    for (const id of ids) {
      const custom = this.host.label?.(id) ?? null;
      if (!custom) {
        const old = this.tags.get(id);
        if (old) {
          old.el.remove();
          this.tags.delete(id);
        }
        continue;
      }
      const a = this.host.anchor(id);
      if (!a || !a.visible) {
        this.tags.get(id)?.el.classList.add('is-off');
        continue;
      }
      let tag = this.tags.get(id);
      if (!tag) {
        const vol = h('span', { class: 'lt-vol' });
        const sub = h('span', { class: 'lt-sub' });
        const el = h('div', { class: 'level-tag' }, vol, sub);
        this.el.append(el);
        tag = { el, vol, sub, last: '', lastSub: '' };
        this.tags.set(id, tag);
      }
      tag.el.classList.remove('is-off');
      const text = custom.text;
      if (text !== tag.last) {
        tag.last = text;
        tag.vol.textContent = text;
      }
      const sub = custom.sub;
      if (sub !== tag.lastSub) {
        tag.lastSub = sub;
        tag.sub.textContent = sub;
        tag.sub.hidden = !sub;
      }
      tag.el.style.transform = `translate(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px) translate(0, -50%)`;
    }
  }
}
