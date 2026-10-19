import type { Feature } from '../core/registry';

/**
 * Autopilot demo tour for the video: open the site with ?tour and it plays itself through every feature,
 * with an animated cursor and small captions (?tour&nocaptions hides them). Normal visitors never load it.
 */
const feature: Feature = {
  id: 'tour',
  priority: 'could',
  init(ctx) {
    const q = new URLSearchParams(location.search);
    if (!q.has('tour')) return;
    // fire and forget: the tour waits for the boot screen itself, so loading carries on as normal
    void import('./tour-run').then((m) => m.runTour(ctx, { captions: !q.has('nocaptions') }));
  },
};

export default feature;
