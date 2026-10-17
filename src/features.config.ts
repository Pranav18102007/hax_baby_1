import type { Feature } from './core/registry';

/** THE list of features. Flip `on` to add or drop one; nothing else needs to change. */
export const features: { load: () => Promise<{ default: Feature }>; on: boolean }[] = [
  { load: () => import('./features/daynight'), on: true },
  { load: () => import('./features/display-modes'), on: true },
  { load: () => import('./features/bathtime'), on: true },
  { load: () => import('./features/cursor'), on: true },
  { load: () => import('./apps/settings'), on: true },
  { load: () => import('./apps/lullaby-lab'), on: true },
  { load: () => import('./apps/nightlights'), on: true },
  { load: () => import('./apps/toybox'), on: true },
  { load: () => import('./apps/guestbook'), on: true },
  { load: () => import('./apps/mixtape'), on: true },
  { load: () => import('./features/secrets'), on: true },
  { load: () => import('./features/bad-dream'), on: true },
  { load: () => import('./features/pet'), on: true },
  { load: () => import('./features/peekers'), on: true },
  { load: () => import('./features/surprise'), on: true },
  { load: () => import('./features/stardust'), on: true },
];
