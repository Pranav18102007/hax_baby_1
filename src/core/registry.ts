import { store } from './store';
import { bus } from './bus';
import { audio } from './audio';
import { voice } from './voice';
import { api } from './api';
import type { WindowManager } from './windows';

/** Everything a feature may use. Features never reach into each other directly. */
export interface Ctx {
  store: typeof store;
  bus: typeof bus;
  audio: typeof audio;
  voice: typeof voice;
  api: typeof api;
  windows: WindowManager;
}

export interface StartItem {
  id: string;
  label: string;
  icon?: string; // asset name, e.g. 'icon-settings'
  group: 'programs' | 'main' | 'special';
  order?: number;
  run: () => void;
  /** Return true to show the item greyed out with a padlock. */
  locked?: () => boolean;
}

export interface AppDef {
  id: string;
  title: string;
  icon: string;
  width?: number;
  height?: number;
  /** Build the window body. Return a cleanup function (stop loops, sounds). */
  mount: (body: HTMLElement, ctx: Ctx) => void | (() => void) | Promise<void | (() => void)>;
}

export interface Feature {
  id: string;
  priority: 'must' | 'should' | 'could';
  init?: (ctx: Ctx) => void | Promise<void>;
  startMenu?: StartItem[];
  apps?: AppDef[];
}

export const startItems: StartItem[] = [];
export const apps = new Map<string, AppDef>();

export async function loadFeatures(
  list: { load: () => Promise<{ default: Feature }>; on: boolean }[],
  ctx: Ctx,
): Promise<void> {
  for (const entry of list) {
    if (!entry.on) continue;
    try {
      const { default: f } = await entry.load();
      f.apps?.forEach((a) => apps.set(a.id, a));
      f.startMenu?.forEach((s) => startItems.push(s));
      await f.init?.(ctx);
    } catch {
      /* a broken feature switches itself off; the rest of the site keeps working */
    }
  }
  bus.emit('features:ready');
}
