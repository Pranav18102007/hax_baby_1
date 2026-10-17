import type { Feature } from './core/registry';

/** THE list of features. Flip `on` to add or drop one; nothing else needs to change. */
export const features: { load: () => Promise<{ default: Feature }>; on: boolean }[] = [
  { load: () => import('./features/daynight'), on: true },
  { load: () => import('./features/display-modes'), on: true },
  { load: () => import('./features/bathtime'), on: true },
  { load: () => import('./features/cursor'), on: true },
  { load: () => import('./apps/settings'), on: true },
  { load: () => import('./apps/lullaby-lab'), on: true },
];
