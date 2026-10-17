import type { Feature } from '../core/registry';
import { bus } from '../core/bus';
import { store } from '../core/store';
import { voice } from '../core/voice';
import { scrollToEl } from '../core/scroll';
import { setFace, type Face } from '../scenes/hero';

/** "I'm feeling sleepy": one random surprise per press, never the same twice in a row. */

let last = -1;

const SURPRISES: (() => void)[] = [
  () => { const s = ['#about', '#story', '#workshop', '#route', '#guestbook', '#dawn']; scrollToEl(s[Math.floor(Math.random() * s.length)]); },
  () => { const a = ['lullaby-lab', 'nightlights', 'toybox', 'mixtape']; bus.emit('app:open', a[Math.floor(Math.random() * a.length)]); },
  () => { scrollToEl('#hero'); const f: Face[] = ['happy', 'cheeky', 'surprised']; window.setTimeout(() => { setFace(f[Math.floor(Math.random() * 3)], 1600); voice.giggle(); }, 700); },
  () => bus.emit('mixtape:play-random'),
  () => {
    if (store.get('visitor').secretsFound.includes('crib')) voice.bubble('psst… you already know my secret. Try typing it again?');
    else voice.bubble(Math.random() < 0.5 ? 'psst… look up at the sky on my first page.' : 'psst… a sleepy sock knows a password.');
  },
  () => bus.emit('theme:toggle'),
];

const feature: Feature = {
  id: 'surprise',
  priority: 'should',
  startMenu: [{
    id: 'surprise', label: "I'm feeling sleepy", icon: 'icon-daynight', group: 'main', order: 1,
    run: () => {
      let i = Math.floor(Math.random() * SURPRISES.length);
      if (i === last) i = (i + 1) % SURPRISES.length;
      last = i;
      SURPRISES[i]();
    },
  }],
};

export default feature;
