import { audio, musicBoxNote } from '../core/audio';
import { api } from '../core/api';
import { bus } from '../core/bus';
import { isTouch, reducedMotion } from '../core/a11y';
import { store } from '../core/store';
import { voice } from '../core/voice';
import type { WindowManager } from '../core/windows';
import { setFace, sparkleBurst } from './hero';
import { scrollToEl } from '../core/scroll';

/** Track which scene is on screen → store 'section.current' (cursor, theme hooks use it). */
function initSections(): void {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) store.set('section.current', (e.target as HTMLElement).dataset.section!); }),
    { rootMargin: '-45% 0px -45% 0px' },
  );
  document.querySelectorAll('[data-section]').forEach((s) => io.observe(s));

  const reveal = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('seen'); reveal.unobserve(e.target); } }),
    { threshold: 0.25 },
  );
  document.querySelectorAll('.room, .growth, .profile, .route, .gb-window, .dawn').forEach((s) => reveal.observe(s));

  const moon = document.querySelector<HTMLElement>('.night-moon');
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    moon?.style.setProperty('--p', String(max > 0 ? window.scrollY / max : 0));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initOpeners(windows: WindowManager): void {
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-open]');
    if (!el) return;
    const id = el.dataset.open!;
    if (windows.hasApp(id)) void windows.openApp(id);
    else { audio.play('error'); voice.bubble('Pip is still building this one!', el); }
  });
}

function initStory(): void {
  document.querySelector('.first-lullaby')?.addEventListener('click', () => {
    const ctx = audio.ctx;
    if (!ctx || store.get('sound.muted')) { voice.bubble('Turn the sound on to hear it!'); return; }
    // the first lullaby: 8 gentle notes
    const tune = [659.25, 587.33, 523.25, 587.33, 659.25, 659.25, 659.25, 523.25];
    tune.forEach((f, i) => musicBoxNote(f, ctx.currentTime + 0.1 + i * 0.42, undefined, 0.26));
  });
}

function initLamps(): void {
  const lamps = [...document.querySelectorAll<HTMLElement>('.lamp')];
  const count = document.querySelector<HTMLElement>('.lamp-count');
  const room = document.querySelector<HTMLElement>('.room-dark');
  let found = 0;
  const light = (l: HTMLElement, silent = false) => {
    if (l.classList.contains('lit')) return;
    l.classList.add('lit');
    found++;
    if (count) count.textContent = `${found} / 6 found`;
    if (!silent) {
      audio.play('chirp');
      if (found === 1) voice.say('V05', l, true);
    }
    if (found === 6) { room?.classList.add('all-lit'); audio.play('sparkle'); voice.say('V29', room, true); }
  };
  document.querySelector('.light-all')?.addEventListener('click', () => lamps.forEach((l) => light(l, true)));

  // Flashlight: the lantern light follows the pointer (desktop) or the dragging finger (phone).
  if (!room) return;
  const move = (x: number, y: number) => {
    const r = room.getBoundingClientRect();
    room.style.setProperty('--lx', `${x - r.left}px`);
    room.style.setProperty('--ly', `${y - r.top}px`);
    for (const l of lamps) {
      const lr = l.getBoundingClientRect();
      if (Math.hypot(lr.left + lr.width / 2 - x, lr.top + lr.height / 2 - y) < 110) light(l);
    }
  };
  room.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
  if (isTouch()) room.addEventListener('pointerdown', (e) => move(e.clientX, e.clientY));
}

/** Light a delivery stop (called by taps and by Pip flying past). */
export let routeLight: (b: HTMLButtonElement) => void = () => undefined;

function initRoute(): void {
  let tonight = 0;
  const out = document.querySelector<HTMLElement>('.tonight');
  routeLight = (b) => {
    if (b.classList.contains('done')) return;
    b.classList.add('done');
    tonight++;
    if (out) out.textContent = String(tonight);
    audio.play('chirp');
  };
  document.querySelectorAll<HTMLButtonElement>('.stop').forEach((b) => {
    b.addEventListener('click', () => { voice.bubble(b.dataset.dream!, b); routeLight(b); });
  });
}

function initPinboard(): void {
  const steps = ['V12a', 'V12b', 'V12c', 'V12d', 'V12e'];
  let i = 0;
  document.querySelectorAll<HTMLElement>('[data-argue]').forEach((b) =>
    b.addEventListener('click', () => { voice.say(steps[i % steps.length], b, true); i++; }),
  );
  document.querySelectorAll<HTMLElement>('.pinboard .badge:not([data-argue])').forEach((b) =>
    b.addEventListener('click', () => {
      audio.play('click');
      b.classList.remove('wiggle'); void b.offsetWidth; b.classList.add('wiggle');
    }),
  );
}

function initDawn(): void {
  const pipBtn = document.querySelector<HTMLElement>('.dawn-pip');
  const wake = () => {
    if (!pipBtn) return;
    pipBtn.classList.add('awake');
    voice.say('V09', pipBtn, true);
    window.setTimeout(() => pipBtn.classList.remove('awake'), 2000);
  };
  pipBtn?.addEventListener('click', wake);

  // the one mischievous button: dodges the pointer 5 times, phone taps twice; never dodges keyboard
  const btn = document.querySelector<HTMLButtonElement>('.wake-mischief');
  if (btn) {
    let dodges = 0;
    const dodge = () => {
      dodges++;
      const dx = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 80);
      const dy = (Math.random() - 0.5) * 60;
      btn.style.transform = `translate(${dx}px, ${dy}px)`;
      audio.play('boing');
    };
    if (!isTouch()) {
      btn.addEventListener('pointerenter', () => { if (dodges < 5 && !reducedMotion()) dodge(); });
    }
    let taps = 0;
    btn.addEventListener('click', (e) => {
      const keyboard = e.detail === 0; // Enter / Space
      if (isTouch() && !keyboard && taps < 2) { taps++; dodge(); return; }
      btn.style.transform = '';
      wake();
    });
  }

  document.getElementById('back-top')?.addEventListener('click', (e) => {
    e.preventDefault();
    scrollToEl('#hero');
    window.setTimeout(() => setFace('happy', 1500), 800);
  });
}

function initSock(): void {
  const sock = document.querySelector<HTMLElement>('.sock-ghost');
  sock?.addEventListener('click', () => {
    audio.play('pop');
    voice.bubble('psst… type the thing Pip hates most', sock);
    bus.emit('secret:clue');
  });
}

/** Global dream counter in the taskbar + footer. Falls back to a cached or seed number. */
async function initCounter(): Promise<void> {
  const KEY = 'pip.counter';
  const fmt = (n: number) => String(n).padStart(6, '0').replace(/(\d{3})(?=\d{3}$)/, '$1,');
  const show = (n: number) => document.querySelectorAll('.odometer').forEach((o) => { o.textContent = fmt(n); });
  let cached = 1204;
  try { cached = Number(localStorage.getItem(KEY)) || 1204; } catch { /* ignore */ }
  show(cached);
  if (!api.enabled) return;
  const today = new Date().toISOString().slice(0, 10);
  let hit = false;
  try { hit = localStorage.getItem(`${KEY}.day`) === today; } catch { /* ignore */ }
  const res = hit ? await api.getCounter() : await api.hitCounter();
  if (res?.dreams) {
    show(res.dreams);
    const all = document.querySelector<HTMLElement>('.alltime');
    const n = document.querySelector<HTMLElement>('.alltime-n');
    if (all && n) { n.textContent = res.dreams.toLocaleString('en-IN'); all.hidden = false; }
    try { localStorage.setItem(KEY, String(res.dreams)); localStorage.setItem(`${KEY}.day`, today); } catch { /* ignore */ }
  }
}

export function initScenes(windows: WindowManager): void {
  initSections();
  initOpeners(windows);
  initStory();
  initLamps();
  initRoute();
  initPinboard();
  initDawn();
  initSock();
  void initCounter();
  void sparkleBurst;
}
