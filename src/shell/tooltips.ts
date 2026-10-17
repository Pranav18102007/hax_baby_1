import { isTouch } from '../core/a11y';

/**
 * 90s tooltips for any [data-tip]. Desktop: hover 400 ms or keyboard focus.
 * Phone: long-press 500 ms; hides after 3 s or the next tap.
 */
export function initTooltips(): void {
  const tip = document.getElementById('tooltip')!;
  let timer = 0;
  let hideTimer = 0;
  let current: HTMLElement | null = null;
  let n = 0;

  const show = (el: HTMLElement) => {
    const text = el.dataset.tip;
    if (!text) return;
    current = el;
    tip.textContent = text;
    tip.hidden = false;
    if (!el.id) el.id = `tipped-${++n}`;
    tip.id = 'tooltip';
    el.setAttribute('aria-describedby', 'tooltip');
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
    let y = r.top - th - 8;
    if (y < 8) y = r.bottom + 8;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  };
  const hide = () => {
    window.clearTimeout(timer);
    tip.hidden = true;
    current?.removeAttribute('aria-describedby');
    current = null;
  };

  const target = (e: Event) => (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip]') ?? null;

  if (!isTouch()) {
    document.addEventListener('pointerover', (e) => {
      const el = target(e);
      if (!el || el === current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => show(el), 400);
    });
    document.addEventListener('pointerout', (e) => {
      const el = target(e);
      if (el && !el.contains(e.relatedTarget as Node)) hide();
    });
  } else {
    let pressTimer = 0;
    document.addEventListener('pointerdown', (e) => {
      const el = target(e);
      if (current && current !== el) hide();
      if (!el) return;
      pressTimer = window.setTimeout(() => {
        show(el);
        window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(hide, 3000);
      }, 500);
    });
    const cancel = () => window.clearTimeout(pressTimer);
    document.addEventListener('pointerup', cancel);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('scroll', hide, { passive: true });
  }
  document.addEventListener('focusin', (e) => { const el = target(e); if (el && el.matches(':focus-visible')) show(el); });
  document.addEventListener('focusout', (e) => { if (target(e)) hide(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
}
