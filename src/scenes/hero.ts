import { audio, musicBoxNote } from '../core/audio';
import { bus } from '../core/bus';
import { isTouch, reducedMotion } from '../core/a11y';
import { store } from '../core/store';
import { voice } from '../core/voice';

export type Face = 'default' | 'happy' | 'surprised' | 'sleepy' | 'cheeky' | 'worried';

const pip = () => document.getElementById('pip')!;
let restingFace: Face = 'default';
let faceTimer = 0;

/** Show a face; `ms` = return to the resting face afterwards. */
export function setFace(face: Face, ms = 0): void {
  const el = pip();
  const img = face === 'worried' ? 'default' : face;
  el.querySelectorAll<HTMLImageElement>('.face').forEach((f) => f.classList.toggle('on', f.classList.contains(`face-${img}`)));
  el.dataset.face = face;
  window.clearTimeout(faceTimer);
  if (ms) faceTimer = window.setTimeout(() => setFace(restingFace), ms);
}

export function setRestingFace(face: Face): void {
  restingFace = face;
  setFace(face);
}

/** Leave the site alone for a minute and Pip dozes off ("five more minutes…"); any input wakes Pip up. */
function initIdle(): void {
  let timer = 0, dozing = false;
  const doze = () => {
    if (document.hidden || store.get('chaos.active')) return arm();
    dozing = true;
    setFace('sleepy');
    voice.say('V31', pip());
  };
  const arm = () => { window.clearTimeout(timer); timer = window.setTimeout(doze, 60_000); };
  const wake = () => {
    if (dozing) { dozing = false; setFace(restingFace); }
    arm();
  };
  ['pointermove', 'pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
  arm();
}

function initEyes(): void {
  const el = pip();
  const eyes = [...el.querySelectorAll<HTMLElement>('.eye i')];
  let tx = window.innerWidth / 2, ty = window.innerHeight / 2;
  let cx = 0, cy = 0; // current offset (fraction of max)
  let lastMove = performance.now();
  let raf = 0;
  let visible = true;

  const aim = (x: number, y: number) => { tx = x; ty = y; lastMove = performance.now(); };
  if (isTouch()) window.addEventListener('pointerdown', (e) => aim(e.clientX, e.clientY), { passive: true });
  else window.addEventListener('pointermove', (e) => aim(e.clientX, e.clientY), { passive: true });

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const r = el.getBoundingClientRect();
    const ex = r.left + r.width * 0.53, ey = r.top + r.height * 0.39;
    let gx = tx, gy = ty;
    if (now - lastMove > 3500) { // idle: wander slowly
      gx = ex + Math.sin(now / 1700) * 160;
      gy = ey + Math.cos(now / 2300) * 90;
    }
    const dx = gx - ex, dy = gy - ey;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 260);
    const nx = (dx / d) * k, ny = (dy / d) * k;
    const ease = reducedMotion() ? 1 : 0.12;
    cx += (nx - cx) * ease;
    cy += (ny - cy) * ease;
    eyes.forEach((i) => { i.style.setProperty('--ex', cx.toFixed(3)); i.style.setProperty('--ey', cy.toFixed(3)); });
  };
  raf = requestAnimationFrame(frame);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(el);

  // blink every 4–7 s
  const blink = () => {
    if (!reducedMotion() && visible) {
      el.classList.add('blink');
      window.setTimeout(() => el.classList.remove('blink'), 140);
    }
    window.setTimeout(blink, 4000 + Math.random() * 3000);
  };
  window.setTimeout(blink, 3000);
  void raf;
}

function sparkleBurst(x: number, y: number, n = 10): void {
  if (reducedMotion()) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'burst';
    s.textContent = i % 3 ? '✦' : '★';
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const dist = 40 + Math.random() * 50;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.setProperty('--dx', `${Math.cos(a) * dist}px`);
    s.style.setProperty('--dy', `${Math.sin(a) * dist}px`);
    document.body.appendChild(s);
    window.setTimeout(() => s.remove(), 800);
  }
}
export { sparkleBurst };

function initPoke(): void {
  const el = pip();
  const faces: Face[] = ['happy', 'cheeky', 'surprised'];
  el.addEventListener('click', (e) => {
    const f = faces[Math.floor(Math.random() * faces.length)];
    setFace(f, 1200);
    voice.giggle(el);
    audio.play('pop');
    const r = el.getBoundingClientRect();
    const x = e.clientX || r.left + r.width / 2, y = e.clientY || r.top + r.height / 3;
    sparkleBurst(x, y);
  });
}

function initLetters(): void {
  const notes = [523.25, 659.25, 783.99];
  let seq: number[] = [];
  let seqTimer = 0;
  document.querySelectorAll<HTMLButtonElement>('.hero-letters .letter').forEach((b) => {
    b.addEventListener('click', () => {
      const i = Number(b.dataset.note);
      b.classList.remove('boing');
      void b.offsetWidth;
      b.classList.add('boing');
      if (audio.ctx && !store.get('sound.muted')) musicBoxNote(notes[i]);
      seq.push(i);
      window.clearTimeout(seqTimer);
      seqTimer = window.setTimeout(() => { seq = []; }, 2000);
      if (seq.slice(-3).join('') === '012') {
        seq = [];
        const ctx = audio.ctx;
        if (ctx && !store.get('sound.muted')) [659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, k) => musicBoxNote(f, ctx.currentTime + 0.25 + k * 0.16));
        voice.giggle(pip());
      }
    });
  });
}

function initPortal(): void {
  const ring = document.querySelector<HTMLButtonElement>('.portal-ring');
  ring?.addEventListener('click', () => {
    voice.say('V06', ring, true);
    audio.play('sparkle');
    bus.emit('secret:open', { via: 'portal' });
  });
}

export function initHero(): void {
  initEyes();
  initIdle();
  initPoke();
  initLetters();
  initPortal();
}
