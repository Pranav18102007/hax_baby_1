import { announce } from './a11y';
import { store } from './store';
import { audio } from './audio';
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
  V13: 'Wheeee!',
  V14: 'Zoooom!',
  V15: 'Shhh… nobody can sleep…',
  V16: 'Boop!',
  V17: 'Make a wish!',
  V18: 'Night-night, little ghost.',
  V19: 'Bath time! Splish splash!',
  V20: 'I made a tower!',
  V21: 'Unicorn power!',
  V22: 'You caught a dream!',
  V23: 'Hmm… let me think…',
  V24: "I don't know that one… yet!",
  V25: 'Ooh, you know the secret code!',
  V26: 'Good night, computer!',
  V27: 'Bunny!',
  V28: 'Batty!',
  V29: 'All the lights are on!',
  V30: "I'll keep your wish safe!",
  V31: 'Five more minutes…',
  V32: 'Ta-da!',
};

/** Recordings that exist in /public/assets/voice (written by scripts/process_voice.sh, so no 404s). */
const RECORDED = new Set<string>(voiceFiles.recorded as string[]);

const COOLDOWN_MS = 20_000;
const lastPlayed = new Map<string, number>();
let current: HTMLAudioElement | null = null;
let currentSrc: AudioBufferSourceNode | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

/** Decoded recording, cached. Web Audio keeps playing after the first tap on every browser (Safari blocks late HTMLAudio). */
function buffer(id: string): Promise<AudioBuffer | null> {
  const ctx = audio.ctx;
  if (!ctx || !RECORDED.has(id)) return Promise.resolve(null);
  let p = buffers.get(id);
  if (!p) {
    p = fetch(`/assets/voice/${id}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => new Promise<AudioBuffer>((res, rej) => ctx.decodeAudioData(b, res, rej)))
      .catch(() => { buffers.delete(id); return null; });
    buffers.set(id, p);
  }
  return p;
}

async function play(id: string): Promise<void> {
  const ctx = audio.ctx;
  const out = audio.sfx;
  if (ctx && out) {
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { /* ignore */ } }
    const buf = await buffer(id);
    if (buf && !store.get('sound.muted')) {
      try { currentSrc?.stop(); } catch { /* already stopped */ }
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      g.gain.value = 1.5; // master is 0.6, so this lands speech at ~0.9 like the old HTMLAudio volume
      src.buffer = buf;
      src.connect(g).connect(out);
      src.start();
      currentSrc = src;
      return;
    }
  }
  try {
    current?.pause();
    current = new Audio(`/assets/voice/${id}.mp3`);
    current.volume = 0.9;
    void current.play().catch(() => undefined);
  } catch { /* ignore */ }
}
let bubbleTimer = 0;

function bubble(text: string, anchor?: Element | null): void {
  const el = document.getElementById('bubble');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('show');
  const rect = anchor && (anchor as HTMLElement).getBoundingClientRect();
  const visible = rect && rect.bottom > 60 && rect.top < window.innerHeight - 80 && rect.width > 0;
  if (visible && rect.left + rect.width / 2 > window.innerWidth * 0.7) {
    // things on the right edge (the teddy on the ladder, the bin) talk to the left
    el.style.left = `${Math.max(rect.left - 10, 200)}px`;
    el.style.top = `${Math.max(rect.top + rect.height * 0.2, 70)}px`;
    el.dataset.dock = 'left';
  } else if (visible) {
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
    void play(id);
  },
  /** Fetch + decode recordings ahead of time (called once audio is unlocked). */
  preload(ids: string[] = [...RECORDED]): void { ids.forEach((id) => { void buffer(id); }); },
  /** Show a bubble with any text (no recording). */
  bubble(text: string, anchor?: Element | null): void { bubble(text, anchor ?? document.getElementById('pip')); },
  giggle(anchor?: Element | null): void {
    voice.say(Math.random() < 0.5 ? 'V03' : 'V04', anchor, true);
  },
};
