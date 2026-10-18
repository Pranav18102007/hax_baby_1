import type { Feature } from '../core/registry';
import { bus } from '../core/bus';
import { audio } from '../core/audio';
import { url } from '../core/assets';
import { announce } from '../core/a11y';

/**
 * Stickers & Notes.exe: stick Pip's stickers anywhere on the page and leave sticky notes.
 * Everything is saved on this device. Drag to move; the × removes (it shows on hover or focus).
 */

const KEY = 'pip.stickers';
const STICKERS = ['sticker-asleep', 'sticker-duck', 'sticker-kitten', 'sticker-lantern', 'sticker-unicorn', 'sticker-wave'];
const NOTE_COLORS = ['#fff1a8', '#fde3ee', '#e3f6ec', '#ece3fb'];
const FIRST_NOTE = "Pip's to-do:\n☐ learn to whistle\n☐ deliver 5 dreams\n☑ nap";

interface Item { id: string; kind: 'sticker' | 'note'; name?: string; text?: string; color?: string; fx: number; y: number; rot: number }

const read = (): Item[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (items: Item[]) => { try { localStorage.setItem(KEY, JSON.stringify(items.slice(-40))); } catch { /* ignore */ } };

let layer: HTMLElement | null = null;

function ensureLayer(): HTMLElement {
  if (layer) return layer;
  layer = document.createElement('div');
  layer.className = 'sticker-layer';
  document.getElementById('page')!.appendChild(layer);
  return layer;
}

function render(item: Item): HTMLElement {
  const L = ensureLayer();
  const el = document.createElement('div');
  el.className = `stuck ${item.kind}`;
  el.dataset.id = item.id;
  el.style.left = `${item.fx * 100}%`;
  el.style.top = `${item.y}px`;
  el.style.setProperty('--rot', `${item.rot}deg`);
  if (item.kind === 'sticker') {
    el.innerHTML = `<img src="${url(item.name!, 256)}" alt="" draggable="false"><button type="button" class="stuck-x" aria-label="Peel off this sticker">×</button>`;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'A sticker you placed');
  } else {
    el.style.setProperty('--note', item.color!);
    el.innerHTML = `<div class="note-grip" aria-hidden="true"></div><textarea aria-label="Sticky note" maxlength="200" spellcheck="false"></textarea><button type="button" class="stuck-x" aria-label="Throw away this note">×</button>`;
    const ta = el.querySelector('textarea')!;
    ta.value = item.text ?? '';
    ta.addEventListener('input', () => { const all = read(); const it = all.find((x) => x.id === item.id); if (it) { it.text = ta.value; write(all); } });
  }
  el.querySelector('.stuck-x')!.addEventListener('click', () => {
    write(read().filter((x) => x.id !== item.id));
    el.remove();
    audio.play('close');
  });
  // drag (stickers anywhere, notes by their grip)
  const handle = item.kind === 'note' ? el.querySelector<HTMLElement>('.note-grip')! : el;
  let sx = 0, sy = 0, ox = 0, oy = 0, drag = false;
  handle.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('.stuck-x')) return;
    drag = true; sx = e.clientX; sy = e.clientY;
    ox = el.offsetLeft; oy = el.offsetTop;
    handle.setPointerCapture(e.pointerId);
    el.classList.add('lift');
  });
  handle.addEventListener('pointermove', (e) => {
    if (!drag) return;
    el.style.left = `${ox + e.clientX - sx}px`;
    el.style.top = `${oy + e.clientY - sy}px`;
  });
  const end = () => {
    if (!drag) return;
    drag = false; el.classList.remove('lift');
    const all = read(); const it = all.find((x) => x.id === item.id);
    if (it) { it.fx = el.offsetLeft / L.clientWidth; it.y = el.offsetTop; write(all); }
    el.style.left = `${(el.offsetLeft / L.clientWidth) * 100}%`;
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  L.appendChild(el);
  return el;
}

function place(kind: 'sticker' | 'note', name?: string): void {
  const L = ensureLayer();
  const pageTop = L.getBoundingClientRect().top + window.scrollY;
  const y = window.scrollY - pageTop + window.innerHeight * (0.3 + Math.random() * 0.3);
  const item: Item = {
    id: Math.random().toString(36).slice(2, 9), kind, name,
    text: kind === 'note' ? (read().some((x) => x.kind === 'note') ? '' : FIRST_NOTE) : undefined,
    color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
    fx: 0.2 + Math.random() * 0.55, y, rot: Math.round((Math.random() - 0.5) * 16),
  };
  write([...read(), item]);
  const el = render(item);
  el.classList.add('pop');
  audio.play(kind === 'note' ? 'click' : 'pop');
  announce(kind === 'note' ? 'Sticky note added to the page.' : 'Sticker stuck to the page.');
  if (kind === 'note') el.querySelector('textarea')?.focus();
}

function mount(body: HTMLElement): void {
  body.classList.add('stickers');
  body.innerHTML = `
    <p>Pick a sticker and Pip sticks it on the page. Drag it anywhere you like.</p>
    <div class="sticker-grid">${STICKERS.map((s) => `<button type="button" class="sticker-pick" data-s="${s}" aria-label="Stick a ${s.replace('sticker-', '')} sticker"><img src="${url(s, 256)}" alt=""></button>`).join('')}</div>
    <div class="plate-row">
      <button type="button" class="os-button" data-note>📝 New sticky note</button>
      <button type="button" class="os-button" data-clear>Peel everything off</button>
    </div>`;
  body.querySelectorAll<HTMLButtonElement>('.sticker-pick').forEach((b) => b.addEventListener('click', () => place('sticker', b.dataset.s)));
  body.querySelector('[data-note]')!.addEventListener('click', () => place('note'));
  body.querySelector('[data-clear]')!.addEventListener('click', () => { write([]); layer?.replaceChildren(); audio.play('close'); announce('All stickers and notes removed.'); });
}

const feature: Feature = {
  id: 'stickers',
  priority: 'could',
  init() {
    read().forEach(render);
    bus.on('memory:forgotten', () => { layer?.replaceChildren(); });
  },
  apps: [{ id: 'stickers', title: 'Stickers & Notes.exe', icon: 'sticker-duck', width: 420, height: 440, mount }],
  startMenu: [{ id: 'stickers', label: 'Stickers & Notes', icon: 'sticker-duck', group: 'programs', order: 7, run: () => bus.emit('app:open', 'stickers') }],
};

export default feature;
