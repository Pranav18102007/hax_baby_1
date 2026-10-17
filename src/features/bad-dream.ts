import type { Feature } from '../core/registry';
import { bus } from '../core/bus';
import { store } from '../core/store';
import { audio } from '../core/audio';
import { voice } from '../core/voice';
import { url } from '../core/assets';
import { announce, isPhone, reducedMotion } from '../core/a11y';
import { setFace } from '../scenes/hero';

/**
 * Bad Dream Mode = Responsive Chaos Mode (+5). Everything is placed with viewport units,
 * so the chaos reshapes itself to any screen. Squish the blobs or let Unicorn Antivirus clean up.
 * Esc ends it instantly.
 */

let running = false;
let cleanup: (() => void) | null = null;

function confirmDialog(): void {
  if (running) return;
  const d = document.createElement('div');
  d.className = 'chaos-dialog os-window';
  d.setAttribute('role', 'alertdialog');
  d.setAttribute('aria-modal', 'true');
  d.setAttribute('aria-labelledby', 'cd-title');
  d.innerHTML = `
    <header class="win-bar static"><img class="win-icon" src="${url('icon-nightmare', 64)}" alt=""><h2 class="win-title" id="cd-title">totally_not_a_nightmare.exe</h2></header>
    <div class="cd-body">
      <p>Are you SURE? This file is <b>totally</b> not a nightmare.</p>
      <div class="cd-actions"><button type="button" class="os-button" data-yes>Yes</button><button type="button" class="os-button" data-yes>Also yes</button></div>
    </div>`;
  document.body.appendChild(d);
  audio.play('error');
  const go = () => { d.remove(); document.removeEventListener('keydown', esc); start(); };
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { d.remove(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
  d.querySelectorAll<HTMLButtonElement>('[data-yes]').forEach((b) => b.addEventListener('click', go));
  d.querySelector<HTMLButtonElement>('[data-yes]')!.focus();
}

function start(): void {
  if (running) return;
  running = true;
  store.set('chaos.active', true);
  const calm = reducedMotion();
  const html = document.documentElement;
  html.classList.add('chaos');
  voice.say('V07', null, true);
  setFace('worried');
  audio.play('error');
  announce('Bad dream mode! Squish the three bad dreams, or wait for the antivirus.');

  // responsive tilt: each scene gets a random small rotation and offset in viewport units
  document.querySelectorAll<HTMLElement>('.scene, .room, .beat').forEach((s) => {
    s.style.setProperty('--cr', `${(Math.random() - 0.5) * 6}deg`);
    s.style.setProperty('--cx', `${(Math.random() - 0.5) * 4}vw`);
  });
  document.querySelectorAll<HTMLElement>('.wordart, .letter').forEach((w) => w.style.setProperty('--wr', `${(Math.random() - 0.5) * 16}deg`));

  const layer = document.createElement('div');
  layer.className = 'chaos-layer';
  layer.innerHTML = `
    <div class="chaos-marquee" aria-hidden="true"><span>!!! NIGHTMARE DETECTED !!! &nbsp; ✖ &nbsp; too many dreams &nbsp; ✖ &nbsp; !!! NIGHTMARE DETECTED !!! &nbsp; ✖ &nbsp; please do not panic (Pip is panicking) &nbsp; ✖ &nbsp;</span></div>
    <div class="chaos-count" role="status">Nightmares squished: <b>0</b>/3</div>
    <div class="chaos-pip os-window"><header class="win-bar static"><h2 class="win-title">pip.exe is scared</h2></header><img src="${url('pip-worried', 512)}" alt="Pip looking worried"></div>
    ${Array.from({ length: isPhone() ? 1 : 3 }, (_, i) => `<div class="chaos-err os-window" style="--i:${i}"><header class="win-bar static"><h2 class="win-title">Error</h2></header><p>error: too many dreams (${i + 1})</p></div>`).join('')}
    ${['blob-tongue', 'blob-storm', 'blob-grump'].map((b, i) => `<button type="button" class="blob" data-i="${i}" aria-label="Squish bad dream ${i + 1}"><img src="${url(b, 384)}" alt=""></button>`).join('')}`;
  document.body.appendChild(layer);

  // DVD-screensaver bounce, measured against the current viewport every frame
  const blobs = [...layer.querySelectorAll<HTMLButtonElement>('.blob')];
  const st = blobs.map((_, i) => ({ x: 0.15 + i * 0.3, y: 0.25 + (i % 2) * 0.3, vx: (0.0011 + Math.random() * 0.0008) * (i % 2 ? -1 : 1), vy: 0.0013 + Math.random() * 0.0008, alive: true }));
  let raf = 0, last = performance.now();
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(40, now - last); last = now;
    blobs.forEach((b, i) => {
      const s = st[i];
      if (!s.alive) return;
      if (!calm) {
        s.x += s.vx * dt; s.y += s.vy * dt;
        const bw = b.offsetWidth / window.innerWidth, bh = b.offsetHeight / window.innerHeight;
        if (s.x < 0 || s.x > 1 - bw) { s.vx *= -1; s.x = Math.max(0, Math.min(1 - bw, s.x)); }
        if (s.y < 0.08 || s.y > 0.85 - bh) { s.vy *= -1; s.y = Math.max(0.08, Math.min(0.85 - bh, s.y)); }
      }
      b.style.left = `${s.x * 100}vw`;
      b.style.top = `${s.y * 100}vh`;
    });
  };
  raf = requestAnimationFrame(tick);

  let squished = 0;
  const count = layer.querySelector<HTMLElement>('.chaos-count b')!;
  blobs.forEach((b, i) => b.addEventListener('click', () => {
    if (!st[i].alive) return;
    st[i].alive = false;
    b.classList.add('squished');
    audio.play('pop');
    squished++;
    count.textContent = String(squished);
    if (squished === 3) antivirus();
  }));

  let avShown = false;
  const avTimer = window.setTimeout(() => antivirus(), 8000);
  function antivirus(): void {
    if (avShown) return;
    avShown = true;
    window.clearTimeout(avTimer);
    const av = document.createElement('div');
    av.className = 'chaos-av os-window';
    av.setAttribute('role', 'alertdialog');
    av.setAttribute('aria-labelledby', 'av-title');
    av.innerHTML = `
      <header class="win-bar static"><img class="win-icon" src="${url('icon-unicorn', 64)}" alt=""><h2 class="win-title" id="av-title">Unicorn Antivirus 93</h2></header>
      <div class="av-body"><img src="${url('unicorn', 512)}" alt="A tiny unicorn superhero with a heart shield">
      <p>${squished === 3 ? 'All 3 bad dreams squished! Let me sparkle up the mess.' : `Threats found: <b>${3 - squished}</b> bad dream${3 - squished === 1 ? '' : 's'}.`}</p>
      <button type="button" class="os-button" data-clean>Clean ✨</button></div>`;
    layer.appendChild(av);
    audio.play('sparkle');
    const btn = av.querySelector<HTMLButtonElement>('[data-clean]')!;
    btn.focus();
    btn.addEventListener('click', clean);
  }

  function clean(): void {
    const fly = document.createElement('div');
    fly.className = 'av-fly';
    fly.innerHTML = `<img src="${url('unicorn', 512)}" alt="">`;
    document.body.appendChild(fly);
    audio.play('sparkle');
    window.setTimeout(() => { end(); voice.say('V08', null, true); }, calm ? 0 : 900);
    window.setTimeout(() => fly.remove(), calm ? 0 : 1800);
  }

  function end(): void {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    window.clearTimeout(avTimer);
    layer.remove();
    html.classList.remove('chaos');
    store.set('chaos.active', false);
    bus.emit('theme:refresh');
    setFace('happy', 1500);
    document.removeEventListener('keydown', onKey);
    announce('All better!');
  }
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') end(); };
  document.addEventListener('keydown', onKey);
  cleanup = end;
}

const feature: Feature = {
  id: 'bad-dream',
  priority: 'should',
  init() { bus.on('chaos:start', confirmDialog); },
  startMenu: [{ id: 'nightmare', label: 'totally_not_a_nightmare.exe', icon: 'icon-nightmare', group: 'special', order: 80, run: confirmDialog }],
};

export function endChaos(): void { cleanup?.(); }
export default feature;
