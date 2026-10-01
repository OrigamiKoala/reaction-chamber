// Native <dialog> shell: focus trapping, Esc-to-close and backdrop click come for free.
import { icon } from './icons';

export class Modal {
  public readonly dialog: HTMLDialogElement;
  public readonly body: HTMLElement;
  public readonly footer: HTMLElement;
  private titleEl: HTMLElement;
  public onClose?: () => void;

  constructor(title: string, opts: { wide?: boolean; className?: string } = {}) {
    this.dialog = document.createElement('dialog');
    this.dialog.className = `modal ${opts.wide ? 'modal-wide' : ''} ${opts.className ?? ''}`;
    const titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`;
    this.dialog.setAttribute('aria-labelledby', titleId);
    this.dialog.innerHTML = `
      <header class="modal-head">
        <h2 class="modal-title" id="${titleId}"></h2>
        <button class="icon-btn modal-x" aria-label="Close">${icon('close', 18)}</button>
      </header>
      <div class="modal-body"></div>
      <footer class="modal-foot" hidden></footer>`;
    this.titleEl = this.dialog.querySelector('.modal-title') as HTMLElement;
    this.titleEl.textContent = title;
    this.body = this.dialog.querySelector('.modal-body') as HTMLElement;
    this.footer = this.dialog.querySelector('.modal-foot') as HTMLElement;
    this.dialog.querySelector('.modal-x')?.addEventListener('click', () => this.close());
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.close(); // backdrop
    });
    this.dialog.addEventListener('close', () => this.onClose?.());
    document.body.appendChild(this.dialog);
  }

  public setTitle(t: string) {
    this.titleEl.textContent = t;
  }

  public open() {
    if (!this.dialog.open) this.dialog.showModal();
  }

  public close() {
    if (this.dialog.open) this.dialog.close();
  }

  public get isOpen(): boolean {
    return this.dialog.open;
  }
}

export function anyModalOpen(): boolean {
  return document.querySelector('dialog[open]') !== null;
}
