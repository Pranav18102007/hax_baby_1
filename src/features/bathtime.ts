import type { Feature } from '../core/registry';
import { bus } from '../core/bus';
import { audio } from '../core/audio';
import { url } from '../core/assets';
import { reducedMotion } from '../core/a11y';

/**
 * Bath Time: the day/night switch. Warm bathwater with rubber ducks floods up,
 * the theme swaps underneath, then it drains with a glug. Pop the bubbles on the way.
 * Press the toggle again (or Esc) to skip. Reduced motion: plain crossfade (not claimed).
 */

const RISE = 750, HOLD = 250, DRAIN = 700;

const feature: Feature = {
  id: 'bathtime',
  priority: 'should',
  init() {
    let active: { finish: () => void } | null = null;

    bus.on('theme:transition', (t: { next: 'day' | 'night'; swap: () => void; claim: () => void }) => {
      if (reducedMotion()) return;
      if (active) { t.claim(); active.finish(); return; } // second press = skip
      t.claim();

      const el = document.createElement('div');
      el.className = `bath ${t.next}`;
      el.setAttribute('aria-hidden', 'true');
      const ducks = ['duck-nightcap', 'duck-upside', 'duck-ring']
        .map((d, i) => `<img class="duck d${i}" src="${url(d, 384)}" alt="" draggable="false">`).join('');
      const bubbles = Array.from({ length: 14 }, (_, i) =>
        `<button type="button" class="bubble" tabindex="-1" style="--x:${5 + Math.random() * 90}%;--d:${(i % 7) * 0.12}s;--s:${18 + Math.random() * 34}px" aria-label="Pop bubble"></button>`).join('');
      el.innerHTML = `<div class="bath-water"><div class="bath-wave"></div>${ducks}${bubbles}</div>`;
      document.body.appendChild(el);
      el.querySelectorAll<HTMLButtonElement>('.bubble').forEach((b) =>
        b.addEventListener('pointerdown', () => { b.classList.add('popped'); audio.play('pop'); }),
      );

      let swapped = false, done = false;
      const timers: number[] = [];
      const doSwap = () => { if (!swapped) { swapped = true; t.swap(); } };
      const finish = () => {
        if (done) return;
        done = true;
        timers.forEach((id) => window.clearTimeout(id));
        doSwap();
        el.remove();
        active = null;
        document.removeEventListener('keydown', onKey);
      };
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(); };
      document.addEventListener('keydown', onKey);
      active = { finish };

      audio.play('splash');
      requestAnimationFrame(() => el.classList.add('rise'));
      timers.push(window.setTimeout(doSwap, RISE));
      timers.push(window.setTimeout(() => { el.classList.add('drain'); audio.play('glug'); }, RISE + HOLD));
      timers.push(window.setTimeout(finish, RISE + HOLD + DRAIN + 50));
    });
  },
};

export default feature;
