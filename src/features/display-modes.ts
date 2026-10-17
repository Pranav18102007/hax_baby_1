import type { Feature } from '../core/registry';
import { store } from '../core/store';
import { audio } from '../core/audio';
import { voice } from '../core/voice';

const MODES = ['normal', 'crt', 'lcd', 'onebit'] as const;
const LABEL: Record<(typeof MODES)[number], string> = { normal: 'Normal', crt: 'CRT', lcd: 'LCD', onebit: '1-bit' };

function apply(): void {
  const m = store.get('display.mode');
  document.documentElement.dataset.display = m;
  const next = MODES[(MODES.indexOf(m) + 1) % MODES.length];
  const btn = document.getElementById('tb-display');
  btn?.setAttribute('aria-label', `Display mode: ${LABEL[m]}. Switch to ${LABEL[next]}`);
  if (btn) btn.dataset.tip = `Screen: ${LABEL[m]} → ${LABEL[next]}`;
}

function cycle(): void {
  const m = store.get('display.mode');
  const next = MODES[(MODES.indexOf(m) + 1) % MODES.length];
  store.set('display.mode', next);
  audio.play('beep');
  voice.bubble(`Screen: ${LABEL[next]}`, document.getElementById('tb-display'));
}

const feature: Feature = {
  id: 'display-modes',
  priority: 'should',
  init() {
    apply();
    store.on('display.mode', apply);
    document.getElementById('tb-display')?.addEventListener('click', cycle);
  },
  startMenu: [{ id: 'display', label: 'Display mode', icon: 'icon-monitor', group: 'main', order: 20, run: cycle }],
};

export default feature;
