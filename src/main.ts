import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/vt323/latin-400.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/os.css';
import './styles/scenes.css';

import { store } from './core/store';
import { bus } from './core/bus';
import { audio, initSfxDelegation } from './core/audio';
import { voice } from './core/voice';
import { api } from './core/api';
import { initA11y } from './core/a11y';
import { hydrateImages, srcset } from './core/assets';
import { WindowManager } from './core/windows';
import { apps, loadFeatures, startItems, type Ctx } from './core/registry';
import { features } from './features.config';
import { runBoot } from './shell/boot';
import { initTaskbar } from './shell/taskbar';
import { initStartMenu } from './shell/startmenu';
import { initTooltips } from './shell/tooltips';
import { initHero } from './scenes/hero';
import { initScenes } from './scenes/misc';

function hydrate(): void {
  hydrateImages();
  document.querySelectorAll<HTMLSourceElement>('source[data-src-img]').forEach((s) => {
    s.srcset = srcset(s.dataset.srcImg!);
    s.sizes = '100vw';
  });
}

function rememberVisit(): boolean {
  const v = store.get('visitor');
  const returning = v.visits > 0;
  const now = Date.now();
  store.set('visitor', { ...v, visits: v.visits + 1, firstSeen: v.firstSeen || now, lastSeen: now });
  return returning;
}

async function start(): Promise<void> {
  initA11y();
  document.documentElement.dataset.theme = store.get('theme.mode');
  hydrate();
  initSfxDelegation();
  initTooltips();

  const windows = new WindowManager(apps);
  const ctx: Ctx = { store, bus, audio, voice, api, windows };
  windows.ctx = ctx;
  bus.on('app:open', (id: string) => void windows.openApp(id));

  // features load while the boot screen runs
  const ready = loadFeatures(features, ctx);
  initHero();

  const critical = [...document.querySelectorAll<HTMLImageElement>('#hero img[loading="eager"], #boot img')];
  await runBoot(critical);
  await ready;

  initTaskbar(windows, apps, () => bus.emit('theme:toggle'));
  initStartMenu(startItems);
  initScenes(windows);

  const returning = rememberVisit();
  const pip = document.getElementById('pip');
  window.setTimeout(() => {
    voice.say(returning ? 'V02' : 'V01', pip, true);
    if (returning && store.get('visitor').secretsFound.length) {
      window.setTimeout(() => voice.bubble('You know my secret!', pip), 3000);
    }
  }, 500);
}

void start();
