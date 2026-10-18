import type { Feature } from '../core/registry';
import { bus } from '../core/bus';
import { audio } from '../core/audio';
import { url } from '../core/assets';
import { reducedMotion } from '../core/a11y';
import { voice } from '../core/voice';

audio.register('squeak', (t) => {
  const c = audio.ctx!; const o = c.createOscillator(); const g = c.createGain();
  o.type = 'square'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(1500, t + 0.06); o.frequency.exponentialRampToValueAtTime(1100, t + 0.16);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(audio.sfx!); o.start(t); o.stop(t + 0.2);
});

/**
 * Bath Time: the day/night switch. Warm bathwater with rubber ducks floods up,
 * the theme swaps underneath, then it drains with a glug. Pop the bubbles on the way.
 * Press the toggle again (or Esc) to skip. Reduced motion: plain crossfade (not claimed).
 */

const RISE = 1300, HOLD = 1100, DRAIN = 1150;

/** Bath toys from the art pack when they exist (O19); otherwise the CSS fish swim alone. */
const TOYS = ['bath-boat', 'bath-soap', 'bath-sponge', 'bath-bubbles'];

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
      const DUCKS = ['duck-nightcap', 'duck-upside', 'duck-ring'];
      const ducks = Array.from({ length: 6 }, (_, i) =>
        `<button type="button" class="duck d${i}" tabindex="-1" aria-label="Squeak the duck" style="--dx:${6 + i * 15 + Math.random() * 6}%;--dd:${-i * 0.37}s;--ds:${0.7 + Math.random() * 0.5}"><img src="${url(DUCKS[i % 3], 384)}" alt="" draggable="false"></button>`).join('');
      const toys = TOYS.filter((n) => url(n)).map((n, i) =>
        `<img class="bath-toy" src="${url(n, 256)}" alt="" draggable="false" style="--tx:${12 + i * 19}%;--td:${-i * 0.5}s">`).join('');
      const FISH = ['bath-fish-a', 'bath-fish-b'].map((n) => url(n, 128)).filter(Boolean);
      const fish = Array.from({ length: 5 }, (_, i) => FISH.length
        ? `<img class="fish-img" src="${FISH[i % FISH.length]}" alt="" draggable="false" style="--fy:${30 + i * 12}%;--fd:${-i * 1.3}s;--fs:${3.6 + Math.random() * 2}s">`
        : `<span class="fish f${i % 3}" style="--fy:${30 + i * 12}%;--fd:${-i * 1.3}s;--fs:${3.6 + Math.random() * 2}s"></span>`).join('');
      const bubbles = Array.from({ length: 34 }, (_, i) =>
        `<button type="button" class="bubble" tabindex="-1" style="--x:${2 + Math.random() * 96}%;--d:${(i / 34) * 2.1}s;--s:${14 + Math.random() * 40}px;--w:${(Math.random() - 0.5) * 60}px" aria-label="Pop bubble"></button>`).join('');
      const foam = Array.from({ length: 26 }, (_, i) =>
        `<span class="foam" style="--fx:${i * 4}%;--fz:${18 + Math.random() * 26}px;--fd:${-Math.random() * 2}s"></span>`).join('');
      el.innerHTML = `<div class="bath-water"><div class="bath-wave back"></div><div class="bath-wave"></div>${foam}<div class="bath-caustics"></div>${fish}${toys}${ducks}${bubbles}</div>`;
      document.body.appendChild(el);
      el.querySelectorAll<HTMLButtonElement>('.bubble').forEach((b) =>
        b.addEventListener('pointerdown', () => { b.classList.add('popped'); audio.play('pop'); }),
      );
      el.querySelectorAll<HTMLButtonElement>('.duck').forEach((d) =>
        d.addEventListener('pointerdown', () => { d.classList.remove('squeak'); void d.offsetWidth; d.classList.add('squeak'); audio.play('squeak'); }),
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
      voice.say('V19', null);
      requestAnimationFrame(() => el.classList.add('rise'));
      timers.push(window.setTimeout(doSwap, RISE));
      timers.push(window.setTimeout(() => { el.classList.add('drain'); audio.play('glug'); }, RISE + HOLD));
      timers.push(window.setTimeout(finish, RISE + HOLD + DRAIN + 50));
    });
  },
};

export default feature;
