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

/** Public-domain melodies as scale-free semitone offsets from C5 (null = rest). */
export const CLASSICS: Record<string, { title: string; notes: (number | null)[]; bpm: number }> = {
  brahms: { title: "Brahms' Lullaby", bpm: 84, notes: [4, 4, 7, null, 4, 4, 7, null, 4, 7, 12, 11, 9, 9, 7, null, 2, 4, 5, 2, 2, 4, 5, null, 2, 5, 11, 9, 7, 11, 12, null] },
  twinkle: { title: 'Twinkle Twinkle', bpm: 96, notes: [0, 0, 7, 7, 9, 9, 7, null, 5, 5, 4, 4, 2, 2, 0, null] },
};

export function semitoneFreq(s: number, root = ROOT): number { return root * Math.pow(2, s / 12); }

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
