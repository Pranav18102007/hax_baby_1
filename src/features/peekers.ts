import type { Feature } from '../core/registry';
import { store } from '../core/store';
import { audio } from '../core/audio';
import { voice } from '../core/voice';
import { url } from '../core/assets';
import { isTouch, reducedMotion } from '../core/a11y';

/**
 * Little ghosts peek over the top of windows and plates, and duck when the pointer gets close.
 * Pip peeks up from the bottom when you scroll back up fast.
 */

const TARGETS = '.os-window, .room-plate, .parchment, .win:not([hidden])';

function visibleTargets(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(TARGETS)].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 140 && r.top > 90 && r.top < window.innerHeight - 140;
  });
}

const feature: Feature = {
  id: 'peekers',
  priority: 'should',
  init() {
    const blocked = () => store.get('chaos.active') || document.body.classList.contains('sheet-open') || document.hidden;

    const peek = () => {
      const opts = visibleTargets();
      if (blocked() || !opts.length) return;
      const host = opts[Math.floor(Math.random() * opts.length)];
      const r = host.getBoundingClientRect();
      const w = Math.min(110, r.width * 0.3);
      const g = document.createElement('button');
      g.type = 'button';
      g.className = 'peeker';
      g.setAttribute('aria-label', 'A peeking ghost');
      g.style.width = `${w}px`;
      g.style.left = `${r.left + 20 + Math.random() * (r.width - w - 40)}px`;
      g.style.top = `${r.top}px`;
      g.innerHTML = `<span><img src="${url('ghost-peek', 384)}" alt=""></span>`;
      document.body.appendChild(g);
      requestAnimationFrame(() => g.classList.add('up'));

      let caught = false;
      const near = (e: PointerEvent) => {
        if (caught) return;
        const gr = g.getBoundingClientRect();
        if (Math.hypot(e.clientX - (gr.left + gr.width / 2), e.clientY - (gr.top + gr.height / 2)) < 120 && !isTouch()) duck();
      };
      const duck = () => { g.classList.remove('up'); window.setTimeout(() => g.remove(), 400); window.removeEventListener('pointermove', near); };
      window.addEventListener('pointermove', near, { passive: true });
      const scrollOff = () => { g.remove(); window.removeEventListener('scroll', scrollOff); window.removeEventListener('pointermove', near); };
      window.addEventListener('scroll', scrollOff, { passive: true, once: true });
      g.addEventListener('pointerdown', () => {
        caught = true;
        g.classList.add('caught');
        audio.play('pop');
        voice.bubble('boo! (a nice boo)', g);
        window.setTimeout(duck, 1400);
      });
      window.setTimeout(() => { if (!caught) duck(); }, 4200);
    };

    const schedule = () => window.setTimeout(() => { peek(); schedule(); }, 25000 + Math.random() * 20000);
    window.setTimeout(() => { peek(); schedule(); }, 12000);

    // Pip peeks up when you scroll back up fast (at most every 30 s)
    let lastY = window.scrollY, lastT = performance.now(), lastPeek = 0;
    window.addEventListener('scroll', () => {
      const now = performance.now();
      const dy = window.scrollY - lastY, dt = now - lastT;
      lastY = window.scrollY; lastT = now;
      if (dt <= 0 || dy > -40 || dy / dt > -2.5 || now - lastPeek < 30000 || blocked()) return;
      if (window.scrollY < window.innerHeight) return;
      lastPeek = now;
      const p = document.createElement('div');
      p.className = 'pip-peek';
      p.setAttribute('aria-hidden', 'true');
      p.innerHTML = `<img src="${url('pip-peek', 384)}" alt="">`;
      document.body.appendChild(p);
      requestAnimationFrame(() => p.classList.add('up'));
      window.setTimeout(() => voice.bubble('hi again!', p), reducedMotion() ? 0 : 350);
      window.setTimeout(() => { p.classList.remove('up'); window.setTimeout(() => p.remove(), 500); }, 2600);
    }, { passive: true });
  },
};

export default feature;
