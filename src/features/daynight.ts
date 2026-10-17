import type { Feature } from '../core/registry';
import { store } from '../core/store';
import { bus } from '../core/bus';
import { audio } from '../core/audio';
import { voice } from '../core/voice';
import { announce } from '../core/a11y';
import { setRestingFace } from '../scenes/hero';

/**
 * Day/night (Tier 1). Applies the palette + Pip's resting face.
 * The Bath Time water transition plugs in through 'theme:transition' later;
 * until then the switch is a soft crossfade.
 */

function istHour(): number {
  const d = new Date();
  return (d.getUTCHours() + 5.5 + d.getUTCMinutes() / 60) % 24;
}

export function applyTheme(): void {
  const mode = store.get('theme.mode');
  document.documentElement.dataset.theme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'day' ? '#fdeee0' : '#1e1b3a');
  const h = istHour();
  setRestingFace(mode === 'day' ? 'happy' : h >= 23 || h < 5 ? 'sleepy' : 'default');
  document.getElementById('pip')?.classList.toggle('sleepy-eyes', mode === 'night' && (h >= 23 || h < 5));
}

const feature: Feature = {
  id: 'daynight',
  priority: 'must',
  init() {
    applyTheme();
    store.on('theme.mode', applyTheme);
    bus.on('theme:toggle', () => {
      const next = store.get('theme.mode') === 'day' ? 'night' : 'day';
      const swap = () => {
        store.set('theme.userSet', true);
        store.set('theme.mode', next);
        announce(next === 'night' ? 'Night mode on' : 'Day mode on');
        if (next === 'night') voice.say('V10', null, true);
        else voice.giggle();
      };
      // A transition feature (Bath Time) can take over by listening for this and calling swap() mid-way.
      let handled = false;
      bus.emit('theme:transition', { next, swap, claim: () => { handled = true; } });
      if (!handled) { audio.play('sparkle'); swap(); }
    });
  },
};

export default feature;
