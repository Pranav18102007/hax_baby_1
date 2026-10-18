import { audio, musicBoxNote } from './audio';

/** Shared music helpers for the Lullaby Lab and the Mixtape. */

export const SCALES = {
  moonlight: { label: 'Moonlight', steps: [0, 2, 4, 7, 9] }, // major pentatonic
  rainy: { label: 'Rainy', steps: [0, 3, 5, 7, 10] }, // minor pentatonic
  starry: { label: 'Starry', steps: [0, 2, 4, 6, 7, 9, 11] }, // lydian
} as const;
export type ScaleId = keyof typeof SCALES;

export const ROOT = 523.25; // C5: music boxes live up high

/** Deterministic random numbers so a seed always gives the same lullaby. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Frequency of scale degree `d` (0 = root, can be negative or > scale length). */
export function freq(d: number, scale: ScaleId, root = ROOT): number {
  const steps = SCALES[scale].steps;
  const n = steps.length;
  const oct = Math.floor(d / n);
  const semis = steps[((d % n) + n) % n] + 12 * oct;
  return root * Math.pow(2, semis / 12);
}

/** A gentle 16-step random walk; null = rest. Ends on the root so it resolves. */
export function makeMelody(seed: number, scale: ScaleId, length = 16): (number | null)[] {
  const r = rng(seed);
  const n = SCALES[scale].steps.length;
  let d = Math.floor(r() * n);
  const out: (number | null)[] = [];
  for (let i = 0; i < length; i++) {
    if (i === length - 1) { out.push(0); break; }
    if (i % 4 === 3 && r() < 0.35) { out.push(null); continue; }
    const step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(r() * 7)];
    d = Math.max(-2, Math.min(n * 2 - 1, d + step));
    out.push(d);
  }
  return out;
}

export function semitoneFreq(s: number, root = ROOT): number { return root * Math.pow(2, s / 12); }

/**
 * Real nursery rhymes and lullabies (all traditional / public domain), as [semitones from C5, beats] pairs.
 * `meter` = beats per bar, used to pick a soft chord for each bar underneath the music box.
 */
export type Note = [number | null, number];
export interface Song { id: string; title: string; bpm: number; meter: number; notes: Note[] }

const C = 0, D = 2, E = 4, F = 5, G = 7, A = 9, B = 11, C2 = 12, G0 = -5;
const run = (beats: number, ...ns: (number | null)[]): Note[] => ns.map((n) => [n, beats]);

export const SONGS: Song[] = [
  { id: 'twinkle', title: 'Twinkle, Twinkle, Little Star', bpm: 92, meter: 4, notes: [
    ...run(1, C, C, G, G, A, A), [G, 2], ...run(1, F, F, E, E, D, D), [C, 2],
    ...run(1, G, G, F, F, E, E), [D, 2], ...run(1, G, G, F, F, E, E), [D, 2],
    ...run(1, C, C, G, G, A, A), [G, 2], ...run(1, F, F, E, E, D, D), [C, 2]] },
  { id: 'brahms', title: "Brahms' Lullaby", bpm: 78, meter: 3, notes: [
    [E, 0.5], [E, 0.5], [G, 2], [E, 0.5], [E, 0.5], [G, 2], [E, 0.5], [G, 0.5], [C2, 1], [B, 1.5], [A, 0.5], [A, 1], [G, 1],
    [D, 0.5], [E, 0.5], [F, 1], [D, 1], [D, 0.5], [E, 0.5], [F, 2], [D, 0.5], [F, 0.5], [B, 0.5], [A, 0.5], [G, 1], [B, 1], [C2, 2], [null, 1]] },
  { id: 'mary', title: 'Mary Had a Little Lamb', bpm: 104, meter: 4, notes: [
    ...run(1, E, D, C, D, E, E), [E, 2], ...run(1, D, D), [D, 2], [E, 1], [G, 1], [G, 2],
    ...run(1, E, D, C, D, E, E, E, E, D, D, E, D), [C, 4]] },
  { id: 'jacques', title: 'Frère Jacques', bpm: 100, meter: 4, notes: [
    ...run(1, C, D, E, C, C, D, E, C, E, F), [G, 2], ...run(1, E, F), [G, 2],
    ...run(0.5, G, A, G, F), ...run(1, E, C), ...run(0.5, G, A, G, F), ...run(1, E, C),
    [C, 1], [G0, 1], [C, 2], [C, 1], [G0, 1], [C, 2]] },
  { id: 'rowboat', title: 'Row, Row, Row Your Boat', bpm: 100, meter: 3, notes: [
    [C, 1.5], [C, 1.5], [C, 1], [D, 0.5], [E, 1.5], [E, 1], [D, 0.5], [E, 1], [F, 0.5], [G, 3],
    ...run(0.5, C2, C2, C2, G, G, G, E, E, E, C, C, C), [G, 1], [F, 0.5], [E, 1], [D, 0.5], [C, 3]] },
  { id: 'london', title: 'London Bridge', bpm: 108, meter: 4, notes: [
    [G, 1.5], [A, 0.5], [G, 1], [F, 1], [E, 1], [F, 1], [G, 2], [D, 1], [E, 1], [F, 2], [E, 1], [F, 1], [G, 2],
    [G, 1.5], [A, 0.5], [G, 1], [F, 1], [E, 1], [F, 1], [G, 2], [D, 2], [G, 2], [E, 1], [C, 3]] },
  { id: 'buns', title: 'Hot Cross Buns', bpm: 96, meter: 4, notes: [
    [E, 1], [D, 1], [C, 2], [E, 1], [D, 1], [C, 2], ...run(0.5, C, C, C, C, D, D, D, D), [E, 1], [D, 1], [C, 2]] },
];

const CHORDS: { root: number; tones: number[] }[] = [
  { root: 0, tones: [0, 4, 7] }, { root: 5, tones: [5, 9, 0] }, { root: 7, tones: [7, 11, 2] }, { root: 9, tones: [9, 0, 4] },
];

/** One chord per bar: the one whose notes cover most of that bar's melody (C on the first and last bar). */
export function chordsFor(song: Song): { at: number; root: number; tones: number[] }[] {
  const bars: Map<number, Map<number, number>> = new Map();
  let t = 0;
  for (const [n, d] of song.notes) {
    if (n !== null) {
      const bar = Math.floor(t / song.meter);
      const pc = ((n % 12) + 12) % 12;
      const m = bars.get(bar) ?? new Map<number, number>();
      m.set(pc, (m.get(pc) ?? 0) + d);
      bars.set(bar, m);
    }
    t += d;
  }
  const last = Math.floor((t - 0.01) / song.meter);
  const out: { at: number; root: number; tones: number[] }[] = [];
  for (let bar = 0; bar <= last; bar++) {
    const m = bars.get(bar) ?? new Map();
    let best = CHORDS[0], score = -1;
    for (const c of CHORDS) {
      let s = 0;
      m.forEach((w, pc) => { if (c.tones.includes(pc)) s += w; });
      if (bar === 0 || bar === last) s += c.root === 0 ? 0.6 : 0;
      if (s > score) { score = s; best = c; }
    }
    out.push({ at: bar * song.meter, root: best.root, tones: best.tones });
  }
  return out;
}

/** A soft pad note (warm sine with a slow swell) for the chords under the music box. */
export function padNote(f: number, at: number, dur: number, dest: AudioNode, level = 0.05): void {
  const ctx = audio.ctx;
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = f;
  lp.type = 'lowpass'; lp.frequency.value = 900;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(level, at + Math.min(0.4, dur * 0.3));
  g.gain.setValueAtTime(level, at + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.3);
  o.connect(lp).connect(g).connect(dest);
  o.start(at); o.stop(at + dur + 0.35);
}

/** A soft generated-impulse reverb. Returns { input, wet } nodes wired to `dest`. */
export function makeReverb(dest: AudioNode): { input: GainNode; dry: GainNode; wet: GainNode; dispose: () => void } | null {
  const ctx = audio.ctx;
  if (!ctx) return null;
  const input = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const conv = ctx.createConvolver();
  const len = ctx.sampleRate * 2.4;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  conv.buffer = buf;
  input.connect(dry).connect(dest);
  input.connect(conv).connect(wet).connect(dest);
  return {
    input, dry, wet,
    dispose: () => { try { input.disconnect(); conv.disconnect(); wet.disconnect(); dry.disconnect(); } catch { /* ignore */ } },
  };
}

export { musicBoxNote };
