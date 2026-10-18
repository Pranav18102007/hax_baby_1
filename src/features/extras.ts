import type { Feature } from '../core/registry';
import { bus } from '../core/bus';
import { store } from '../core/store';
import { audio } from '../core/audio';
import { voice } from '../core/voice';
import { url } from '../core/assets';
import { announce, reducedMotion, trapFocus } from '../core/a11y';
import { musicBoxNote, semitoneFreq } from '../core/music';
import { setFace } from '../scenes/hero';

/**
 * Small COULDs that hang off the shell:
 *  - the Konami code (↑ ↑ ↓ ↓ ← → ← → B A): a second secret, a star party
 *  - Start → Shut down…: "It's now safe to go to sleep"
 *  - magnetic dream motes that drift toward the lantern in the dark gallery
 */

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

function starParty(): void {
  const v = store.get('visitor');
  if (!v.secretsFound.includes('konami')) store.set('visitor', { ...v, secretsFound: [...v.secretsFound, 'konami'] });
  voice.say('V25', document.getElementById('pip'), true);
  announce('Secret code! Star party!');
  setFace('cheeky', 3000);
  audio.unlock();
  // Twinkle Twinkle, double time, on the music box
  const ctx = audio.ctx;
  if (ctx && !store.get('sound.muted')) {
    [0, 0, 7, 7, 9, 9, 7, null, 5, 5, 4, 4, 2, 2, 0].forEach((n, i) => { if (n !== null) musicBoxNote(semitoneFreq(n), ctx.currentTime + 0.1 + i * 0.16, undefined, 0.22); });
  }
  if (reducedMotion()) return;
  const party = document.createElement('div');
  party.className = 'star-party';
  party.setAttribute('aria-hidden', 'true');
  party.innerHTML = Array.from({ length: 60 }, (_, i) => `<i style="--x:${Math.random() * 100}vw;--d:${Math.random() * 1.6}s;--r:${Math.random() * 720 - 360}deg;--c:${['#f3d27a', '#f6b5c8', '#c9b6e4', '#bfe8d6', '#fff5e8'][i % 5]}">${['★', '✦', '♥', '☾', '✧'][i % 5]}</i>`).join('');
  document.body.appendChild(party);
  document.body.classList.add('party');
  window.setTimeout(() => { party.remove(); document.body.classList.remove('party'); }, 4200);
}

function shutDown(): void {
  const el = document.createElement('div');
  el.className = 'shutdown';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'DreamOS has shut down');
  el.innerHTML = `
    <p class="sd-line">Pip is saving your dreams…</p>
    <div class="sd-safe" hidden>
      <img src="${url('pip-asleep', 512)}" alt="Pip, fast asleep">
      <p class="sd-title">It's now safe to go to sleep.</p>
      <button type="button" class="sd-wake">☾ Tap anywhere to wake DreamOS</button>
    </div>`;
  document.body.appendChild(el);
  const untrap = trapFocus(el);
  voice.say('V26', null, true);
  audio.play('close');
  const t = window.setTimeout(() => {
    el.querySelector<HTMLElement>('.sd-line')!.hidden = true;
    el.querySelector<HTMLElement>('.sd-safe')!.hidden = false;
    el.querySelector<HTMLElement>('.sd-wake')!.focus();
  }, reducedMotion() ? 200 : 1600);
  const wake = () => {
    window.clearTimeout(t);
    untrap();
    el.classList.add('out');
    audio.play('startup');
    window.setTimeout(() => el.remove(), 400);
    document.removeEventListener('keydown', onKey);
    voice.say(store.get('visitor').visits > 1 ? 'V02' : 'V01', document.getElementById('pip'), true);
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') wake(); };
  el.addEventListener('click', wake);
  document.addEventListener('keydown', onKey);
}

function motes(): void {
  const room = document.querySelector<HTMLElement>('.room-dark');
  if (!room || reducedMotion()) return;
  const layer = document.createElement('div');
  layer.className = 'motes';
  layer.setAttribute('aria-hidden', 'true');
  const N = 22;
  const ps = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), vx: 0, vy: 0, el: document.createElement('i') }));
  ps.forEach((p) => layer.appendChild(p.el));
  room.appendChild(layer);
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) requestAnimationFrame(tick); }).observe(room);
  const light = () => {
    const cs = getComputedStyle(room);
    const parse = (v: string, size: number) => (v.endsWith('%') ? (parseFloat(v) / 100) : parseFloat(v) / size);
    return { x: parse(cs.getPropertyValue('--lx').trim() || '50%', room.clientWidth), y: parse(cs.getPropertyValue('--ly').trim() || '45%', room.clientHeight) };
  };
  const tick = (now: number) => {
    if (!visible) return;
    const L = light();
    ps.forEach((p, i) => {
      const dx = L.x - p.x, dy = L.y - p.y, d = Math.hypot(dx, dy) + 0.02;
      // gentle pull toward the lantern, a little swirl so they orbit instead of piling up
      p.vx += (dx / d) * 0.00006 - dy * 0.00004 + Math.sin(now / 900 + i) * 0.00002;
      p.vy += (dy / d) * 0.00006 + dx * 0.00004 + Math.cos(now / 1100 + i) * 0.00002;
      p.vx *= 0.97; p.vy *= 0.97;
      p.x += p.vx * 16; p.y += p.vy * 16;
      if (d < 0.04) { p.x = Math.random(); p.y = Math.random() < 0.5 ? 0 : 1; }
      p.el.style.transform = `translate(${p.x * room.clientWidth}px, ${p.y * room.clientHeight}px)`;
      p.el.style.opacity = String(Math.max(0.15, 1 - d * 1.6));
    });
    requestAnimationFrame(tick);
  };
}

const feature: Feature = {
  id: 'extras',
  priority: 'could',
  init() {
    let i = 0;
    document.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      i = k === KONAMI[i] ? i + 1 : k === KONAMI[0] ? 1 : 0;
      if (i === KONAMI.length) { i = 0; starParty(); }
    });
    bus.on('konami', starParty);
    motes();
  },
  startMenu: [{ id: 'shutdown', label: 'Shut down…', icon: 'pip-pixel', group: 'special', order: 99, run: shutDown }],
};

export default feature;
