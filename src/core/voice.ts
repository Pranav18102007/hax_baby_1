import { announce } from './a11y';
import { store } from './store';
import voiceFiles from '../content/voice.json';

/**
 * Pip's voice: each line plays its recording (when we have it and sound is on)
 * and always shows a speech bubble + is announced to screen readers.
 */

export const LINES: Record<string, string> = {
  V01: "Hi! I'm Pip!",
  V02: 'You came back! I saved you a dream!',
  V03: 'hehe!',
  V04: 'hehehe!',
  V05: 'Ooh! Shiny!',
  V06: 'Ooh… a secret!',
  V07: 'Uh-oh…',
  V08: 'Yay! All better!',
  V09: 'Heyyy! I was sleeping!',
  V10: '*yaaawn*… nigh-night…',
  V11: 'Yay, noise!',
  V12a: 'Hi!',
  V12b: 'No, HI!',
  V12c: 'HI!',
  V12d: 'No, HIIII!',
  V12e: 'hehe… fine.',
};

/** Recordings that exist in /public/assets/voice (written by scripts/process_voice.sh, so no 404s). */
const RECORDED = new Set<string>(voiceFiles.recorded as string[]);

const COOLDOWN_MS = 20_000;
const lastPlayed = new Map<string, number>();
let current: HTMLAudioElement | null = null;
let bubbleTimer = 0;

function bubble(text: string, anchor?: Element | null): void {
  const el = document.getElementById('bubble');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('show');
  const rect = anchor && (anchor as HTMLElement).getBoundingClientRect();
  const visible = rect && rect.bottom > 60 && rect.top < window.innerHeight - 80 && rect.width > 0;
  if (visible) {
    const x = Math.min(Math.max(rect.left + rect.width * 0.6, 16), window.innerWidth - 16);
    el.style.left = `${x}px`;
    el.style.top = `${Math.max(rect.top + rect.height * 0.12, 70)}px`;
    el.dataset.dock = 'anchor';
  } else {
    el.style.left = '';
    el.style.top = '';
    el.dataset.dock = 'start';
  }
  void el.offsetWidth;
  el.classList.add('show');
  window.clearTimeout(bubbleTimer);
  bubbleTimer = window.setTimeout(() => el.classList.remove('show'), Math.max(2200, text.length * 70));
  announce(`Pip: ${text}`);
}

export const voice = {
  /** Say a line. `force` skips the 20 s repeat cooldown. */
  say(id: string, anchor?: Element | null, force = false): void {
    const text = LINES[id];
    if (!text) return;
    const now = Date.now();
    if (!force && now - (lastPlayed.get(id) ?? 0) < COOLDOWN_MS) return;
    lastPlayed.set(id, now);
    bubble(text, anchor ?? document.getElementById('pip'));
    if (store.get('sound.muted') || !store.get('audio.unlocked') || !RECORDED.has(id)) return;
    try {
      current?.pause();
      current = new Audio(`/assets/voice/${id}.mp3`);
      current.volume = 0.9;
      void current.play().catch(() => undefined);
    } catch { /* ignore */ }
  },
  /** Show a bubble with any text (no recording). */
  bubble(text: string, anchor?: Element | null): void { bubble(text, anchor ?? document.getElementById('pip')); },
  giggle(anchor?: Element | null): void {
    voice.say(Math.random() < 0.5 ? 'V03' : 'V04', anchor, true);
  },
};
