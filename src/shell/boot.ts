import { audio } from '../core/audio';
import { preload } from '../core/assets';
import { reducedMotion } from '../core/a11y';
import { store } from '../core/store';

const LINES = [
  'DreamOS 93  (c) Midnight Nursery',
  'Checking nightlights ........ OK',
  'Warming up lullabies ........ OK',
  'Counting sheep .... 1, 2, 3, zzz',
];

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** Runs the boot screen; resolves once the visitor taps "wake" (or "enter quietly"). */
export async function runBoot(critical: HTMLImageElement[]): Promise<void> {
  const boot = document.getElementById('boot')!;
  const pre = boot.querySelector<HTMLElement>('.boot-lines')!;
  const bar = boot.querySelector<HTMLElement>('.boot-bar')!;
  const fill = bar.querySelector<HTMLElement>('span')!;
  const wake = boot.querySelector<HTMLElement>('.boot-wake')!;
  const visits = store.get('visitor').visits;
  const lines = [...LINES];
  if (visits > 0) lines[0] = `Welcome back! Visit #${visits + 1}`;

  let pct = 0;
  const setPct = (p: number) => {
    pct = Math.max(pct, Math.round(p * 100));
    fill.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(pct));
  };

  const loading = preload(critical, setPct);
  const started = performance.now();

  if (reducedMotion()) pre.textContent = lines.join('\n');
  else {
    for (const line of lines) {
      pre.textContent += (pre.textContent ? '\n' : '') + line;
      await sleep(220);
    }
  }
  // at least 1.2 s on screen, at most 3 s before the button appears
  await Promise.race([loading, sleep(3000)]);
  const elapsed = performance.now() - started;
  if (elapsed < 1200) await sleep(1200 - elapsed);
  setPct(1);
  pre.textContent += `\nLoading dreams ......... 100%`;

  wake.classList.add('show');
  const btn = document.getElementById('wake-btn') as HTMLButtonElement;
  const quiet = document.getElementById('quiet-btn') as HTMLButtonElement;
  btn.focus();

  await new Promise<void>((resolve) => {
    const go = (muted: boolean) => {
      if (muted) store.set('sound.muted', true);
      audio.unlock();
      audio.play('startup');
      resolve();
    };
    btn.addEventListener('click', () => go(false), { once: true });
    quiet.addEventListener('click', () => go(true), { once: true });
  });

  boot.classList.add('waking');
  document.body.classList.remove('booting');
  await sleep(reducedMotion() ? 0 : 650);
  boot.remove();
}
