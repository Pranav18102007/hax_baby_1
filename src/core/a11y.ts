import { store } from './store';

const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

export function reducedMotion(): boolean {
  const pref = store.get('motion.reduced');
  return pref === 'on' || (pref === 'system' && mq.matches);
}

function applyMotionClass(): void {
  document.documentElement.classList.toggle('reduce-motion', reducedMotion());
}

export function isTouch(): boolean {
  return window.matchMedia('(hover: none), (pointer: coarse)').matches;
}

export function isPhone(): boolean {
  return window.matchMedia('(max-width: 767px)').matches;
}

/** Announce text to screen readers (mirrors Pip's speech bubbles). */
export function announce(text: string): void {
  const el = document.getElementById('live');
  if (!el) return;
  el.textContent = '';
  window.setTimeout(() => { el.textContent = text; }, 30);
}

/** Single-key shortcuts that are ignored while typing. */
const shortcuts = new Map<string, () => void>();
export function shortcut(key: string, fn: () => void): void {
  shortcuts.set(key.toLowerCase(), fn);
}

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Keep Tab inside `root` until the returned function is called. */
export function trapFocus(root: HTMLElement): () => void {
  const sel = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = [...root.querySelectorAll<HTMLElement>(sel)].filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  root.addEventListener('keydown', onKey);
  return () => root.removeEventListener('keydown', onKey);
}

export function initA11y(): void {
  applyMotionClass();
  mq.addEventListener('change', applyMotionClass);
  store.on('motion.reduced', applyMotionClass);
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    const fn = shortcuts.get(e.key.toLowerCase());
    if (fn) { e.preventDefault(); fn(); }
  });
}
