import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/os.css';
import './styles/scenes.css';
import './styles/story.css';

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
import { initScenes, routeLight } from './scenes/misc';
import { initRoute } from './scenes/route';
import { initStoryScroll } from './scenes/story';
import { initMotion } from './scenes/motion';

function hydrate(): void {
  hydrateImages();
  document.querySelectorAll<HTMLSourceElement>('source[data-src-img]').forEach((s) => {
    s.srcset = srcset(s.dataset.srcImg!);
    s.sizes = '100vw';
  });
}

/** "Saturday night", "Friday afternoon"… in the visitor's own time. */
function whenWas(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const part = h >= 21 || h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return `${d.toLocaleDateString('en-IN', { weekday: 'long' })} ${part}`;
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
  bus.on('app:close', (id: string) => windows.close(id));

  // features load while the boot screen runs
  const ready = loadFeatures(features, ctx);
  initHero();

  const critical = [...document.querySelectorAll<HTMLImageElement>('#hero img[loading="eager"], #boot img')];
  await runBoot(critical);
  await ready;

  initTaskbar(windows, apps, () => bus.emit('theme:toggle'));
  initStartMenu(startItems);
  initScenes(windows);
  initMotion();
  initStoryScroll();
  initRoute(routeLight);

  const lastSeen = store.get('visitor').lastSeen;
  const returning = rememberVisit();
  const pip = document.getElementById('pip');
  window.setTimeout(() => {
    voice.say(returning ? 'V02' : 'V01', pip, true);
    if (!returning) return;
    let wait = 3000;
    if (lastSeen) { window.setTimeout(() => voice.bubble(`Last time you visited on ${whenWas(lastSeen)}!`, pip), wait); wait += 3200; }
    if (store.get('visitor').secretsFound.length) window.setTimeout(() => voice.bubble('You know my secret!', pip), wait);
  }, 500);
}

void start();
