/** Tiny reactive store. Some keys persist to localStorage under `pip.v1`. */

export interface Visitor {
  visits: number;
  firstSeen: number;
  lastSeen: number;
  secretsFound: string[];
}

export interface State {
  'sound.muted': boolean;
  'sound.theme': 'auto' | 'rattle' | 'chimes';
  'theme.mode': 'day' | 'night';
  'theme.userSet': boolean;
  'display.mode': 'normal' | 'crt' | 'lcd' | 'onebit';
  'motion.reduced': 'system' | 'on' | 'off';
  'fx.cursor': boolean;
  'pet.enabled': boolean;
  'pet.kind': 'kitten' | 'bunny' | 'bat';
  'chaos.active': boolean;
  'section.current': string;
  'audio.unlocked': boolean;
  visitor: Visitor;
}

type Key = keyof State;
type Listener<K extends Key> = (value: State[K]) => void;

const STORAGE_KEY = 'pip.v1';
const SAVED: Key[] = ['sound.muted', 'sound.theme', 'theme.mode', 'theme.userSet', 'display.mode', 'motion.reduced', 'fx.cursor', 'pet.enabled', 'pet.kind', 'visitor'];

function istHour(): number {
  const h = new Date().getUTCHours() + 5.5 + new Date().getUTCMinutes() / 60;
  return h % 24;
}

const defaults: State = {
  'sound.muted': false,
  'sound.theme': 'auto',
  'theme.mode': istHour() >= 19 || istHour() < 6 ? 'night' : 'day',
  'theme.userSet': false,
  'display.mode': 'normal',
  'motion.reduced': 'system',
  'fx.cursor': true,
  'pet.enabled': true,
  'pet.kind': 'kitten',
  'chaos.active': false,
  'section.current': 'hero',
  'audio.unlocked': false,
  visitor: { visits: 0, firstSeen: 0, lastSeen: 0, secretsFound: [] },
};

function load(): Partial<State> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<State>) : {};
  } catch {
    return {};
  }
}

const saved = load();
const state: State = { ...defaults, ...saved };
// Theme follows the clock until the visitor picks one themselves.
if (!state['theme.userSet']) state['theme.mode'] = defaults['theme.mode'];

const listeners = new Map<Key, Set<Listener<any>>>();

function persist(): void {
  try {
    const out: Partial<State> = {};
    for (const k of SAVED) (out as any)[k] = state[k];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch {
    /* storage blocked (private mode): the site still works, it just forgets */
  }
}

export const store = {
  get<K extends Key>(k: K): State[K] {
    return state[k];
  },
  set<K extends Key>(k: K, v: State[K]): void {
    if (state[k] === v) return;
    state[k] = v;
    if (SAVED.includes(k)) persist();
    listeners.get(k)?.forEach((fn) => fn(v));
  },
  on<K extends Key>(k: K, fn: Listener<K>): () => void {
    if (!listeners.has(k)) listeners.set(k, new Set());
    listeners.get(k)!.add(fn);
    return () => listeners.get(k)!.delete(fn);
  },
  /** Clear everything saved ("Forget me"). */
  reset(): void {
    // the store, plus what the extras keep on this device (stickers, wish jar, kept lullabies)
    try { [STORAGE_KEY, 'pip.stickers', 'pip.wishjar', 'pip.lullabies', 'pip.fit'].forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
  },
};
