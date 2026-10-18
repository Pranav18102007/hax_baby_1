import { reducedMotion } from './a11y';

/** Smooth-scroll helper that uses Lenis when it's running (desktop), native scrolling otherwise. */
type LenisLike = { scrollTo: (target: Element | number, opts?: { offset?: number; immediate?: boolean }) => void };
let lenis: LenisLike | null = null;

export function setLenis(l: LenisLike | null): void { lenis = l; }

export function scrollToEl(target: Element | string): void {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  if (lenis && !reducedMotion()) lenis.scrollTo(el);
  else el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** Scroll the page to a y position (immediate while dragging the ladder). */
export function scrollToY(y: number, immediate = false): void {
  if (lenis && !reducedMotion()) lenis.scrollTo(y, { immediate });
  else window.scrollTo({ top: y, behavior: immediate || reducedMotion() ? 'auto' : 'smooth' });
}
