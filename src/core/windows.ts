import { audio } from './audio';
import { bus } from './bus';
import { isPhone, reducedMotion, trapFocus } from './a11y';
import { url } from './assets';
import type { AppDef, Ctx } from './registry';

/**
 * Window manager. Desktop: floating, draggable (springy), resizable 90s windows.
 * Phone: one full-screen sheet at a time, swipe down or × to close.
 */

interface OpenWin {
  id: string;
  el: HTMLElement;
  cleanup?: () => void;
  opener: Element | null;
  untrap?: () => void;
  minimized: boolean;
}

const MAX_OPEN = 4;

export class WindowManager {
  private layer: HTMLElement;
  private open = new Map<string, OpenWin>();
  private z = 50;
  private cascade = 0;
  ctx!: Ctx;

  constructor(private apps: Map<string, AppDef>) {
    this.layer = document.getElementById('windows')!;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.open.size) {
        const top = this.topmost();
        if (top) { e.preventDefault(); this.close(top.id); }
      }
    });
  }

  isOpen(id: string): boolean { return this.open.has(id); }
  hasApp(id: string): boolean { return this.apps.has(id); }
  list(): { id: string; title: string; minimized: boolean }[] {
    return [...this.open.values()].map((w) => ({ id: w.id, title: this.apps.get(w.id)?.title ?? w.id, minimized: w.minimized }));
  }

  private topmost(): OpenWin | undefined {
    let best: OpenWin | undefined;
    for (const w of this.open.values()) if (!w.minimized && (!best || Number(w.el.style.zIndex) > Number(best.el.style.zIndex))) best = w;
    return best;
  }

  async openApp(id: string): Promise<void> {
    const app = this.apps.get(id);
    if (!app) return;
    const existing = this.open.get(id);
    if (existing) { this.restore(id); return; }

    const phone = isPhone();
    if (phone) [...this.open.keys()].forEach((k) => this.close(k, true));
    else if (this.open.size >= MAX_OPEN) this.close(this.open.keys().next().value!, true);

    const opener = document.activeElement;
    const el = document.createElement('section');
    el.className = `win${phone ? ' sheet' : ''}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-labelledby', `win-title-${id}`);
    if (phone) el.setAttribute('aria-modal', 'true');
    el.dataset.app = id;
    el.innerHTML = `
      <header class="win-bar">
        <img class="win-icon" src="${url(app.icon, 64)}" alt="" width="20" height="20">
        <h2 class="win-title" id="win-title-${id}">${app.title}</h2>
        <div class="win-ctrls">
          ${phone ? '' : `<button class="win-btn" data-act="min" aria-label="Minimise ${app.title}">–</button>
          <button class="win-btn" data-act="max" aria-label="Maximise ${app.title}">□</button>`}
          <button class="win-btn win-close" data-act="close" aria-label="Close ${app.title}">×</button>
        </div>
      </header>
      <div class="win-body"></div>
      ${phone ? '' : '<div class="win-grip" aria-hidden="true"></div>'}`;

    if (!phone) {
      const w = Math.min(app.width ?? 520, window.innerWidth - 32);
      const h = Math.min(app.height ?? 440, window.innerHeight - 120);
      const off = (this.cascade++ % 5) * 28;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.left = `${Math.max(16, (window.innerWidth - w) / 2 - 60 + off)}px`;
      el.style.top = `${Math.max(16, (window.innerHeight - h) / 2 - 60 + off)}px`;
    }
    el.style.zIndex = String(++this.z);
    this.layer.appendChild(el);

    const win: OpenWin = { id, el, opener, minimized: false };
    this.open.set(id, win);
    this.wire(win, phone);
    if (phone) { win.untrap = trapFocus(el); document.body.classList.add('sheet-open'); }

    audio.play('open');
    requestAnimationFrame(() => el.classList.add('in'));
    const body = el.querySelector<HTMLElement>('.win-body')!;
    try {
      const c = await app.mount(body, this.ctx);
      if (typeof c === 'function') win.cleanup = c;
    } catch {
      body.innerHTML = '<p class="win-oops">This program fell asleep. Try again later!</p>';
    }
    (el.querySelector<HTMLElement>('.win-body [autofocus], .win-body button, .win-body input') ?? el.querySelector<HTMLElement>('.win-close'))?.focus({ preventScroll: true });
    bus.emit('windows:changed');
  }

  close(id: string, silent = false): void {
    const w = this.open.get(id);
    if (!w) return;
    try { w.cleanup?.(); } catch { /* ignore */ }
    w.untrap?.();
    this.open.delete(id);
    if (!silent) audio.play('close');
    w.el.classList.remove('in');
    w.el.classList.add('out');
    window.setTimeout(() => w.el.remove(), reducedMotion() ? 0 : 220);
    if (![...this.open.values()].some((o) => o.el.classList.contains('sheet'))) document.body.classList.remove('sheet-open');
    if (!silent && w.opener instanceof HTMLElement && document.contains(w.opener)) w.opener.focus({ preventScroll: true });
    bus.emit('windows:changed');
  }

  minimize(id: string): void {
    const w = this.open.get(id);
    if (!w) return;
    w.minimized = true;
    w.el.hidden = true;
    bus.emit('windows:changed');
  }

  restore(id: string): void {
    const w = this.open.get(id);
    if (!w) return;
    w.minimized = false;
    w.el.hidden = false;
    w.el.style.zIndex = String(++this.z);
    w.el.querySelector<HTMLElement>('.win-close')?.focus({ preventScroll: true });
    bus.emit('windows:changed');
  }

  toggleFromTaskbar(id: string): void {
    const w = this.open.get(id);
    if (!w) return;
    if (w.minimized) this.restore(id);
    else if (this.topmost() === w) this.minimize(id);
    else this.restore(id);
  }

  private wire(win: OpenWin, phone: boolean): void {
    const { el, id } = win;
    el.addEventListener('pointerdown', () => { if (!phone) el.style.zIndex = String(++this.z); });
    el.querySelectorAll<HTMLButtonElement>('.win-btn').forEach((b) =>
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'close') this.close(id);
        else if (act === 'min') this.minimize(id);
        else if (act === 'max') el.classList.toggle('maxed');
      }),
    );
    const bar = el.querySelector<HTMLElement>('.win-bar')!;
    if (phone) this.swipeToClose(bar, el, id);
    else { this.drag(bar, el); this.resize(el.querySelector('.win-grip')!, el); }
  }

  /** Springy drag: squash/stretch with speed, elastic settle on release. */
  private drag(bar: HTMLElement, el: HTMLElement): void {
    let sx = 0, sy = 0, ox = 0, oy = 0, lastX = 0, lastT = 0, active = false;
    bar.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button') || el.classList.contains('maxed')) return;
      active = true;
      bar.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY;
      ox = el.offsetLeft; oy = el.offsetTop;
      lastX = e.clientX; lastT = performance.now();
      el.classList.add('dragging');
    });
    bar.addEventListener('pointermove', (e) => {
      if (!active) return;
      const maxX = window.innerWidth - 80, maxY = window.innerHeight - 80;
      el.style.left = `${Math.min(Math.max(ox + e.clientX - sx, -el.offsetWidth + 80), maxX)}px`;
      el.style.top = `${Math.min(Math.max(oy + e.clientY - sy, 0), maxY)}px`;
      if (!reducedMotion()) {
        const now = performance.now();
        const v = (e.clientX - lastX) / Math.max(1, now - lastT); // px per ms
        const s = Math.min(Math.abs(v) * 0.05, 0.07);
        el.style.transform = `scale(${1 + s}, ${1 - s * 0.7}) skewX(${Math.max(-6, Math.min(6, -v * 3))}deg)`;
        lastX = e.clientX; lastT = now;
      }
    });
    const end = () => {
      if (!active) return;
      active = false;
      el.classList.remove('dragging');
      el.style.transform = '';
    };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  }

  private resize(grip: HTMLElement, el: HTMLElement): void {
    let sx = 0, sy = 0, w = 0, h = 0, active = false;
    grip.addEventListener('pointerdown', (e) => {
      active = true; grip.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY; w = el.offsetWidth; h = el.offsetHeight;
    });
    grip.addEventListener('pointermove', (e) => {
      if (!active) return;
      el.style.width = `${Math.max(280, w + e.clientX - sx)}px`;
      el.style.height = `${Math.max(200, h + e.clientY - sy)}px`;
    });
    grip.addEventListener('pointerup', () => { active = false; });
  }

  private swipeToClose(bar: HTMLElement, el: HTMLElement, id: string): void {
    let sy = 0, dy = 0, active = false;
    bar.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      active = true; sy = e.clientY; dy = 0; bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', (e) => {
      if (!active) return;
      dy = Math.max(0, e.clientY - sy);
      el.style.transform = `translateY(${dy}px)`;
    });
    const end = () => {
      if (!active) return;
      active = false;
      el.style.transform = '';
      if (dy > 110) this.close(id);
    };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  }
}
