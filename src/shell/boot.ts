import { audio } from '../core/audio';
import { preload } from '../core/assets';
import { reducedMotion } from '../core/a11y';
import { store } from '../core/store';
import { voice } from '../core/voice';

const LINES = [
  'DreamOS 93  (c) Midnight Nursery',
  'Detecting baby ....... 1 found (Pip)',
  'Fluffing clouds ............... OK',
  'Checking nightlights .......... OK',
  'Warming up lullabies .......... OK',
  'Counting sheep ..... 1, 2, 3, zzz',
];

const TIPS = [
  'Tip: press M to mute, D for day and night.',
  'Tip: Pip hates silence. Like, really hates it.',
  'Tip: something in the sky is not just a star…',
  'Tip: windows can be dragged, squished and stacked.',
  'Tip: the Start menu has a very suspicious .exe.',
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

  // rotating tips under the bar
  const tip = boot.querySelector<HTMLElement>('.boot-tip')!;
  let ti = Math.floor(Math.random() * TIPS.length);
  tip.textContent = TIPS[ti];
  const tipTimer = window.setInterval(() => { ti = (ti + 1) % TIPS.length; tip.textContent = TIPS[ti]; }, 1600);

  if (reducedMotion()) pre.textContent = lines.join('\n');
  else {
    for (const line of lines) {
      pre.textContent += (pre.textContent ? '\n' : '') + line;
      audio.play('beep');
      await sleep(330);
    }
  }
  // at least 2.6 s on screen (it's a show, not a wait), at most 4 s before the button appears
  await Promise.race([loading, sleep(4000)]);
  const elapsed = performance.now() - started;
  const least = reducedMotion() ? 1500 : 2600;
  if (elapsed < least) await sleep(least - elapsed);
  window.clearInterval(tipTimer);
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
      voice.preload(['V01', 'V02', 'V03', 'V04']);
      window.setTimeout(() => voice.preload(), 4000);
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
