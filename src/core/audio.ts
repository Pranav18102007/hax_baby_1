import { store } from './store';

/**
 * Sound engine: one AudioContext (created on the wake tap), everything synthesized.
 * Two themes: 'rattle' (day, wooden toys) and 'chimes' (night, soft bells).
 * Any element with data-sfx="name" plays that sound when activated.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

const MASTER = 0.6;

type Theme = 'rattle' | 'chimes';
type SoundFn = (t: number, theme: Theme) => void;
const sounds = new Map<string, SoundFn>();

function theme(): Theme {
  const pref = store.get('sound.theme');
  if (pref !== 'auto') return pref;
  return store.get('theme.mode') === 'day' ? 'rattle' : 'chimes';
}

interface ToneOpts { type?: OscillatorType; dur?: number; gain?: number; attack?: number; to?: number; dest?: AudioNode }

function tone(freq: number, at: number, o: ToneOpts = {}): void {
  if (!ctx || !sfxBus) return;
  const { type = 'sine', dur = 0.15, gain = 0.25, attack = 0.004, to, dest = sfxBus } = o;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(dest);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function noise(at: number, dur: number, freq: number, q = 2, gain = 0.3, type: BiquadFilterType = 'bandpass'): void {
  if (!ctx || !sfxBus) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.02);
}

/** A music-box note: a sine with bell partials and a long decay. Exported for the Lullaby Lab. */
export function musicBoxNote(freq: number, at?: number, dest?: AudioNode, level = 0.22): void {
  if (!ctx) return;
  const t = at ?? ctx.currentTime;
  const out = dest ?? sfxBus!;
  tone(freq, t, { dur: 1.4, gain: level, attack: 0.002, dest: out });
  tone(freq * 2, t, { dur: 0.6, gain: level * 0.3, attack: 0.002, dest: out });
  tone(freq * 4.2, t, { dur: 0.25, gain: level * 0.12, attack: 0.001, dest: out });
}

// ---- built-in sounds ----
sounds.set('click', (t, th) => {
  if (th === 'rattle') { noise(t, 0.05, 1900, 5, 0.35); tone(880, t, { type: 'triangle', dur: 0.04, gain: 0.08 }); }
  else { tone(1760, t, { dur: 0.14, gain: 0.12 }); tone(2640, t, { dur: 0.08, gain: 0.04 }); }
});
sounds.set('open', (t, th) => {
  const f = th === 'rattle' ? [1200, 1600, 2100] : [784, 988, 1319];
  f.forEach((fr, i) => (th === 'rattle' ? noise(t + i * 0.06, 0.06, fr, 6, 0.3) : tone(fr, t + i * 0.07, { dur: 0.3, gain: 0.12 })));
});
sounds.set('close', (t, th) => {
  const f = th === 'rattle' ? [2100, 1600, 1200] : [1319, 988, 784];
  f.forEach((fr, i) => (th === 'rattle' ? noise(t + i * 0.05, 0.05, fr, 6, 0.25) : tone(fr, t + i * 0.06, { dur: 0.25, gain: 0.1 })));
});
sounds.set('error', (t, th) => {
  if (th === 'rattle') tone(260, t, { type: 'square', dur: 0.22, gain: 0.06, to: 150 });
  else { tone(330, t, { dur: 0.2, gain: 0.12 }); tone(311, t + 0.12, { dur: 0.3, gain: 0.12 }); }
});
sounds.set('pop', (t) => tone(420, t, { dur: 0.08, gain: 0.25, to: 1100 }));
sounds.set('boing', (t) => tone(260, t, { type: 'triangle', dur: 0.28, gain: 0.18, to: 620 }));
sounds.set('splash', (t) => { noise(t, 0.7, 900, 0.6, 0.35, 'lowpass'); noise(t + 0.1, 0.5, 2500, 1, 0.12); });
sounds.set('glug', (t) => [0, 0.16, 0.34].forEach((d) => tone(190, t + d, { dur: 0.14, gain: 0.25, to: 90 })));
sounds.set('sparkle', (t) => [1319, 1568, 1976, 2637].forEach((f, i) => tone(f, t + i * 0.05, { type: 'triangle', dur: 0.25, gain: 0.08 })));
sounds.set('startup', (t) => [523, 659, 784, 1047].forEach((f, i) => musicBoxNote(f, t + i * 0.12)));
sounds.set('beep', (t) => tone(1046, t, { type: 'square', dur: 0.07, gain: 0.05 }));
sounds.set('purr', (t) => { for (let i = 0; i < 10; i++) noise(t + i * 0.09, 0.08, 140, 1, 0.35, 'lowpass'); });
sounds.set('chirp', (t) => tone(1400, t, { dur: 0.12, gain: 0.1, to: 2200 }));

function applyMute(): void {
  if (!ctx || !master) return;
  const target = store.get('sound.muted') ? 0 : MASTER;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(target, ctx.currentTime, 0.03);
}

export const audio = {
  /** Call from a user gesture (the wake tap). Safe to call more than once. */
  unlock(): void {
    try {
      if (!ctx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = store.get('sound.muted') ? 0 : MASTER;
        master.connect(ctx.destination);
        sfxBus = ctx.createGain(); sfxBus.connect(master);
        musicBus = ctx.createGain(); musicBus.gain.value = 0.7; musicBus.connect(master);
        store.on('sound.muted', applyMute);
      }
      if (ctx.state === 'suspended') void ctx.resume();
      store.set('audio.unlocked', true);
    } catch { /* no audio: the site still works silently */ }
  },
  play(name: string): void {
    if (!ctx || store.get('sound.muted')) return;
    const fn = sounds.get(name);
    if (fn) { try { fn(ctx.currentTime + 0.005, theme()); } catch { /* ignore */ } }
  },
  register(name: string, fn: SoundFn): void { sounds.set(name, fn); },
  get ctx(): AudioContext | null { return ctx; },
  get music(): GainNode | null { return musicBus; },
  get sfx(): GainNode | null { return sfxBus; },
};

/** data-sfx="name" on any element plays that sound on click / tap / Enter. */
export function initSfxDelegation(): void {
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-sfx]');
    if (el) audio.play(el.dataset.sfx!);
  });
}
