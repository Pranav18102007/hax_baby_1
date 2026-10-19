import type { Ctx } from '../core/registry';
import { scrollToY } from '../core/scroll';

/**
 * The autopilot tour (about 6½ minutes). A friendly cursor glides around and really uses the site:
 * every click, hover and drag is sent as a pointer/mouse event, so Pip reacts, talks and plays music
 * exactly as for a visitor. Small captions name each feature.
 */

type Target = string | Element | null | undefined;
interface Opts { captions: boolean }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

let cur: HTMLElement, cap: HTMLElement;
let cx = 0, cy = 0, hovered: Element | null = null, captured: Element | null = null, buttons = 0;

function css(): void {
  const s = document.createElement('style');
  s.textContent = `
    html.touring, html.touring * { cursor: none !important; }
    .tour-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none; width: 44px; height: 44px; transform: translate(-200px, -200px); filter: drop-shadow(0 3px 4px rgba(20,10,40,.45)); transition: scale .12s; }
    .tour-cursor img { width: 100%; height: 100%; image-rendering: pixelated; }
    .tour-cursor.down { scale: .86; }
    .tour-ripple { position: fixed; z-index: 2147483646; pointer-events: none; width: 54px; height: 54px; margin: -27px 0 0 -27px; border-radius: 50%; border: 3px solid #f6b5c8; box-shadow: 0 0 14px #f3d27a; animation: tourrip .6s ease-out forwards; }
    @keyframes tourrip { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.5); opacity: 0; } }
    .tour-cap { position: fixed; left: 50%; bottom: 64px; z-index: 2147483645; pointer-events: none; max-width: min(760px, 88vw); translate: -50% 20px; opacity: 0; transition: opacity .45s, translate .45s;
      background: rgba(30, 24, 62, .88); border: 2px solid #c9b6e4; border-radius: 14px; padding: 10px 18px 12px; box-shadow: 0 8px 28px rgba(10, 6, 30, .45), 0 0 0 4px rgba(201, 182, 228, .18); text-align: center; }
    .tour-cap.on { opacity: 1; translate: -50% 0; }
    .tour-cap b { display: block; font-family: 'Lilita One', var(--font-display), sans-serif; font-weight: 400; font-size: 26px; color: #ffe9a8; letter-spacing: .3px; }
    .tour-cap span { display: block; margin-top: 2px; font-family: var(--font-pixel, monospace); font-size: 21px; line-height: 1.15; color: #fff5e8; }
    .tour-start, .tour-end { position: fixed; inset: 0; z-index: 2147483644; display: grid; place-items: center; text-align: center; background: radial-gradient(ellipse at 50% 45%, #3b2a5c, #120f26); color: #fff5e8; font-family: var(--font-pixel, monospace); }
    .tour-start button { font: inherit; font-size: 30px; padding: 18px 34px; border-radius: 16px; border: 3px solid #f3d27a; background: #2b2350; color: #ffe9a8; cursor: pointer !important; box-shadow: 0 0 30px rgba(243,210,122,.4); }
    .tour-start p { margin-top: 16px; font-size: 20px; opacity: .8; }
    .tour-end { opacity: 0; transition: opacity 1.4s; }
    .tour-end.on { opacity: 1; }
    .tour-end h1 { margin: 0; font-family: 'Lilita One', sans-serif; font-weight: 400; font-size: clamp(36px, 6vw, 72px); color: #ffe9a8; text-shadow: 0 0 24px rgba(246,181,200,.6); }
    .tour-end p { margin: 10px 0 0; font-size: clamp(18px, 2.4vw, 28px); }
    .tour-end .u { margin-top: 26px; font-size: clamp(22px, 3vw, 34px); color: #bfe8d6; }`;
  document.head.appendChild(s);
}

/* ---------- low-level input ---------- */
function at(x: number, y: number): Element {
  return document.elementFromPoint(x, y) ?? document.body;
}
function send(target: Element, type: string, x: number, y: number): void {
  const isPointer = type.startsWith('pointer');
  const bubbles = !/enter|leave/.test(type);
  const init = { bubbles, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y, buttons, button: 0, view: window };
  const ev = isPointer ? new PointerEvent(type, { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true, width: 1, height: 1, pressure: buttons ? 0.5 : 0 }) : new MouseEvent(type, init);
  try { target.dispatchEvent(ev); } catch { /* a handler threw: carry on */ }
}
function hover(x: number, y: number): void {
  const t = captured ?? at(x, y);
  if (t !== hovered) {
    if (hovered) { send(hovered, 'pointerout', x, y); send(hovered, 'pointerleave', x, y); send(hovered, 'mouseout', x, y); send(hovered, 'mouseleave', x, y); }
    send(t, 'pointerover', x, y); send(t, 'pointerenter', x, y); send(t, 'mouseover', x, y); send(t, 'mouseenter', x, y);
    hovered = t;
  }
  send(t, 'pointermove', x, y);
  send(t, 'mousemove', x, y);
}
function place(x: number, y: number): void {
  cx = x; cy = y;
  cur.style.transform = `translate(${x - 4}px, ${y - 3}px)`;
}

/* ---------- choreography helpers ---------- */
function el(t: Target): HTMLElement | null {
  if (!t) return null;
  if (typeof t !== 'string') return t as HTMLElement;
  const all = [...document.querySelectorAll<HTMLElement>(t)];
  return all.find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }) ?? null;
}
function center(e: Element): { x: number; y: number } {
  const r = e.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
async function move(x: number, y: number, ms = 700): Promise<void> {
  const x0 = cx, y0 = cy, t0 = performance.now();
  if (ms <= 0) { place(x, y); hover(x, y); return; }
  for (;;) {
    const t = Math.min(1, (performance.now() - t0) / ms), k = ease(t);
    // a gentle arc, like a hand moving a mouse
    const arc = Math.sin(t * Math.PI) * Math.min(60, Math.hypot(x - x0, y - y0) * 0.12);
    place(x0 + (x - x0) * k, y0 + (y - y0) * k - arc);
    hover(cx, cy);
    if (t >= 1) break;
    await new Promise(requestAnimationFrame);
  }
}
async function moveTo(t: Target, ms = 700, dx = 0, dy = 0): Promise<HTMLElement | null> {
  const e = el(t);
  if (!e) return null;
  const c = center(e);
  await move(c.x + dx, c.y + dy, ms);
  return e;
}
function ripple(): void {
  const r = document.createElement('span');
  r.className = 'tour-ripple'; r.style.left = `${cx}px`; r.style.top = `${cy}px`;
  document.body.appendChild(r); setTimeout(() => r.remove(), 650);
}
async function down(): Promise<void> {
  buttons = 1; cur.classList.add('down');
  const t = at(cx, cy); captured = t;
  send(t, 'pointerdown', cx, cy); send(t, 'mousedown', cx, cy);
}
async function up(click = true): Promise<void> {
  const t = captured ?? at(cx, cy);
  buttons = 0; cur.classList.remove('down');
  send(t, 'pointerup', cx, cy); send(t, 'mouseup', cx, cy);
  captured = null;
  if (click) (t as HTMLElement).click?.();
}
/** Glide to an element and click it like a person would (press, release, click). */
async function click(t: Target, ms = 650, after = 350, press = true): Promise<boolean> {
  const e = await moveTo(t, ms);
  if (!e) return false;
  await sleep(120);
  ripple();
  buttons = 1; cur.classList.add('down');
  if (press) { send(e, 'pointerdown', cx, cy); send(e, 'mousedown', cx, cy); }
  await sleep(90);
  buttons = 0; cur.classList.remove('down');
  if (press) { send(e, 'pointerup', cx, cy); send(e, 'mouseup', cx, cy); }
  e.click();
  await sleep(after);
  return true;
}
/** Click at the cursor's spot (canvases). */
async function tapHere(): Promise<void> { ripple(); await down(); await sleep(90); await up(true); }
async function drag(x1: number, y1: number, x2: number, y2: number, ms = 900): Promise<void> {
  await move(x1, y1, 450); await down(); await move(x2, y2, ms); await up(false);
}
async function type(t: Target, text: string, per = 70): Promise<void> {
  const e = el(t) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!e) return;
  await click(e, 500, 150);
  e.focus();
  for (const ch of text) {
    e.value += ch;
    e.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' }));
    await sleep(per + Math.random() * 40);
  }
}
function key(k: string, target: Element = document.activeElement ?? document.body): void {
  for (const type of ['keydown', 'keyup']) target.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }));
}
async function scrollTo(y: number, ms = 1400): Promise<void> {
  const y0 = window.scrollY, t0 = performance.now();
  y = Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight));
  for (;;) {
    const t = Math.min(1, (performance.now() - t0) / ms);
    scrollToY(y0 + (y - y0) * ease(t), true);
    hover(cx, cy);
    if (t >= 1) break;
    await new Promise(requestAnimationFrame);
  }
  await sleep(120);
}
const topOf = (t: Target) => { const e = el(t) ?? (typeof t === 'string' ? document.querySelector(t) : null); return e ? e.getBoundingClientRect().top + window.scrollY : 0; };
async function scrollToEl(t: Target, ms = 1400, offset = 0): Promise<void> { await scrollTo(topOf(t) + offset, ms); }
async function waitFor(sel: string, ms = 8000): Promise<HTMLElement | null> {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) { const e = el(sel); if (e) return e; await sleep(120); }
  return null;
}
async function waitGone(sel: string, ms = 15000): Promise<void> {
  const t0 = performance.now();
  while (performance.now() - t0 < ms && document.querySelector(sel)) await sleep(150);
}

let showCaps = true;
async function caption(title: string, text = '', hold = 0): Promise<void> {
  if (!showCaps) { if (hold) await sleep(hold); return; }
  cap.classList.remove('on');
  await sleep(cap.textContent ? 260 : 0);
  cap.innerHTML = `<b>${title}</b>${text ? `<span>${text}</span>` : ''}`;
  cap.classList.add('on');
  if (hold) await sleep(hold);
}
function uncaption(): void { cap.classList.remove('on'); }

async function startMenu(label: string): Promise<boolean> {
  await click('#start-btn', 650, 600);
  const item = [...document.querySelectorAll<HTMLElement>('.sm-item')].find((i) => i.textContent?.includes(label));
  if (!item) { key('Escape'); return false; }
  return click(item, 600, 700);
}
async function closeWin(title: string): Promise<void> {
  await click(`[aria-label="Close ${title}"]`, 600, 500);
}
/** Wiggle the cursor around a point so the eyes and lantern have something to follow. */
async function circle(x: number, y: number, rx: number, ry: number, ms: number): Promise<void> {
  const t0 = performance.now();
  await move(x + rx, y, 500);
  for (;;) {
    const t = (performance.now() - t0) / ms;
    if (t >= 1) break;
    const a = t * Math.PI * 2;
    place(x + Math.cos(a) * rx, y + Math.sin(a * 2) * ry);
    hover(cx, cy);
    await new Promise(requestAnimationFrame);
  }
}

/* ---------- the tour ---------- */
const sections: [string, () => Promise<void>][] = [];
const step = (name: string, fn: () => Promise<void>) => sections.push([name, fn]);
const W = () => innerWidth, H = () => innerHeight;

export async function runTour(ctx: Ctx, opts: Opts): Promise<void> {
  const q = new URLSearchParams(location.search);
  // start from a clean slate so the tour looks like a first visit (secrets locked, no saved outfits…)
  if (!q.has('fresh')) {
    ctx.store.reset();
    location.replace(`${location.pathname}?tour&fresh${opts.captions ? '' : '&nocaptions'}`);
    return;
  }
  showCaps = opts.captions;
  css();
  document.documentElement.classList.add('touring');
  cur = document.createElement('div');
  cur.className = 'tour-cursor';
  cur.innerHTML = '<img src="/cursors/c1.png" alt="">';
  cap = document.createElement('div');
  cap.className = 'tour-cap';
  cap.setAttribute('aria-hidden', 'true');
  document.body.append(cap, cur);
  place(W() * 0.72, H() * 0.7);

  // one real click starts it (browsers only allow sound after a real click)
  if (!q.has('auto')) {
    const s = document.createElement('div');
    s.className = 'tour-start';
    s.innerHTML = '<div><button type="button">▶ Start the tour</button><p>Then don’t touch the mouse. Press F11 for full screen first.</p></div>';
    document.body.appendChild(s);
    await new Promise<void>((res) => s.querySelector('button')!.addEventListener('click', () => { ctx.audio.unlock(); s.remove(); res(); }, { once: true }));
  }
  const t0 = performance.now();
  const only = q.get('only')?.split(',');
  for (const [name, fn] of sections) {
    if (only && name !== 'boot' && !only.includes(name)) continue;
    const s0 = performance.now();
    try { await fn(); } catch (e) { console.warn('[tour] step failed:', name, e); }
    console.info(`[tour] ${name}: ${((performance.now() - s0) / 1000).toFixed(1)}s (t=${((performance.now() - t0) / 1000).toFixed(0)}s)`);
  }
  uncaption();
  const end = document.createElement('div');
  end.className = 'tour-end';
  end.innerHTML = '<div><h1>Pip’s Midnight Renaissance</h1><p>Made by Anushka Bhalekar &amp; Pranav Shinde · guided by Atharva Baodhankar</p><p>haX.baby · Baby’s First Website · Track 1</p><p class="u">hax-baby-1.vercel.app</p></div>';
  document.body.appendChild(end);
  requestAnimationFrame(() => end.classList.add('on'));
  cur.style.opacity = '0';
  console.info(`[tour] done in ${((performance.now() - t0) / 1000).toFixed(0)}s`);
}

/* 1 · boot */
step('boot', async () => {
  await caption('DreamOS 93 is booting…', 'A cosy 90s desktop wrapped around Pip’s painted dream world');
  await waitFor('#wake-btn', 15000);
  await sleep(1200);
  await click('#wake-btn', 900, 1800);
});

/* 2 · hero: eyes, poke, letters */
step('hero', async () => {
  await caption('Hi, I’m Pip!', 'A Junior Dream Engineer — and Pip’s glowing eye-lights follow you everywhere');
  const p = el('#pip');
  const c = p ? center(p) : { x: W() / 2, y: H() / 2 };
  await circle(c.x, c.y - 40, W() * 0.3, H() * 0.25, 4300);
  await caption('Poke Pip', 'Pip reacts with a new face, sparkles and a giggle');
  await click('#pip', 700, 1700);
  await click('#pip', 300, 1600);
  await caption('P · I · P', 'Each letter plays a music-box note — play them in order');
  for (const i of [0, 1, 2]) await click(`.hero-letters .letter[data-note="${i}"]`, 500, 450);
  await sleep(1800);
});

/* 3 · day / night bath time */
step('daynight', async () => {
  await caption('Day ↔ Night', 'Switching runs Bath Time, and Pip’s face and the whole palette change');
  await click('#tb-theme', 900, 6200);
});

/* 4 · who is Pip */
step('about', async () => {
  await scrollToEl('#about', 1700, 20);
  await caption('Who is Pip?', 'A profile.txt window, a growth chart… and a very sleepy sock');
  await sleep(1200);
  await click('.sock-ghost', 800, 2000);
  await closeWin('whisper.exe');
  await moveTo('.growth-marks li:nth-child(5) .mark', 700); await sleep(1000);
  await moveTo('.growth-marks li:nth-child(1) .mark', 500); await sleep(900);
  await click('[data-open="case-growth"]', 700, 2300);
  await closeWin('Growth Chart.txt');
  await caption('Back to night', '', 0);
  await click('#tb-theme', 700, 4600);
});

/* 5 · the story */
step('story', async () => {
  const spacer = document.getElementById('story')!.parentElement!;
  const st = spacer.getBoundingClientRect().top + window.scrollY;
  const u = (k: number) => st + k * innerHeight * 1.1;
  await caption('Pip’s story', 'Told by scrolling — with one thing to do in every chapter');
  await scrollTo(st, 1600);
  await scrollTo(u(0.6), 2200);
  await caption('Chapter 1 · The town can’t sleep', 'Knock on the windows to say hello to the sleepless ghosts');
  const spots = [...document.querySelectorAll<HTMLElement>('#story .hotspot')].slice(0, 3);
  for (const s of spots) await click(s, 600, 900);
  await scrollTo(u(1.45), 2300);
  await caption('Chapter 2 · The Moon reaches down', 'Help the little hand reach up — and the hands spark');
  await click('.hand-pip-btn', 800, 2300);
  await scrollTo(u(2.12), 1600);
  await caption('Chapter 3 · A star falls', 'Make a wish on it before it lands');
  await click('.falling-star', 600, 1400);
  await scrollTo(u(2.98), 3800);
  await caption('…and Pip wakes up', 'The star lands in an empty cradle. Hehe!');
  await sleep(2400);
  await click('.cradle-pip', 700, 1700);
  await scrollTo(u(4.78), 3200);
  await caption('Chapter 4 · The first lullaby', 'Tuck the little ghosts in, and Pip makes up a lullaby');
  for (const g of ['.sg1', '.sg2', '.sg3']) await click(`#story ${g}`, 600, 950);
  await click('.first-lullaby', 800, 3800);
  await caption('It’s reversible', 'Scroll back and the falling star flies home');
  await scrollTo(u(2.3), 1900);
  await sleep(400);
  await scrollTo(u(5.0), 2100);
});

/* 6 · the dome */
step('dome', async () => {
  await caption('Into Pip’s workshop…');
  await scrollToEl('#dome', 1800, 0);
  await scrollTo(window.scrollY + innerHeight * 1.6, 3600);
});

/* 7 · lullaby lab */
step('lab', async () => {
  await scrollToEl('[data-room="lab"]', 1800, -innerHeight * 0.08);
  await caption('The Lullaby Lab', 'Each invention builds itself from stardust as you arrive');
  await sleep(1600);
  await click('.os-button[data-open="lullaby-lab"]', 800, 1300);
  await caption('Wind it up', 'It composes a brand-new lullaby every time — and slows as the spring runs down');
  await click('[data-wind]', 700, 600);
  await click('[data-wind]', 300, 3200);
  await caption('Make it yours', 'Pick a scale, tap the star keys, roll a new one, keep your favourites');
  for (const i of [2, 5, 3]) await click(`.star-key[data-deg="${i}"]`, 380, 250);
  await click('[data-new]', 700, 2300);
  await click('[data-keep]', 700, 1500);
  const play = el('[data-play][aria-pressed="true"]');
  if (play) await click(play, 600, 400);
  await closeWin('Lullaby Lab.exe');
});

/* 8 · nightlight gallery */
step('nightlights', async () => {
  await scrollToEl('[data-room="nightlights"]', 1800, -innerHeight * 0.06);
  await caption('The Nightlight Gallery', 'It’s pitch dark — your cursor is the lantern');
  const room = el('.room-dark');
  if (room) { const r = room.getBoundingClientRect(); await circle(r.left + r.width / 2, r.top + r.height / 2, r.width * 0.32, r.height * 0.22, 3400); }
  await caption('Six lamps, six tricks', 'Spores, escaping stars, a swimming jellyfish, a moon that pops out…');
  const lamps = [...document.querySelectorAll<HTMLElement>('[data-lamp]')];
  for (const [i, l] of lamps.entries()) { if (i === 5) await caption('Find all six…', '…and it’s a Nap Party!'); await click(l, 650, 1150); }
  await sleep(3800);
});

/* 9 · toy box */
step('toys', async () => {
  await scrollToEl('[data-room="toys"]', 1800, -innerHeight * 0.06);
  await caption('Rattle & Block Toys', 'A toy box with real physics');
  await sleep(900);
  await click('.os-button[data-open="toybox"]', 800, 1600);
  await click('[data-more]', 700, 1300);
  await click('[data-shake]', 700, 1800);
  await caption('Moon gravity', 'Flip the gravity and watch everything float');
  await click('[data-grav]', 700, 2600);
  await click('[data-grav]', 400, 1200);
  await closeWin('Toy Box.exe');
});

/* 10 · delivery route */
step('route', async () => {
  const route = document.getElementById('route')!;
  const top = route.getBoundingClientRect().top + window.scrollY;
  await caption('Dream Delivery Route', 'The golden path draws itself as you scroll');
  await scrollTo(top, 1800);
  await scrollTo(top + Math.max(innerHeight * 0.6, route.offsetHeight - innerHeight) * 0.85, 4400);
  await caption('Deliver a dream', 'Tap a house — every delivery counts towards tonight’s total');
  const stops = [...route.querySelectorAll<HTMLElement>('.stop')].filter((s) => { const r = s.getBoundingClientRect(); return r.top > 60 && r.bottom < innerHeight - 60; }).slice(0, 2);
  for (const s of stops) await click(s, 650, 1300);
  await sleep(500);
});

/* 11 · guestbook */
step('guestbook', async () => {
  await scrollToEl('#guestbook', 1800, -10);
  await caption('A real, live guestbook', 'Wishes are saved on our server (Vercel Functions + Redis)');
  await sleep(1000);
  const fields = [...document.querySelectorAll<HTMLInputElement>('#guestbook .gb-field input, #guestbook .gb-field textarea')];
  if (fields[0]) await type(fields[0], 'Dreamer', 90);
  if (fields[1]) await type(fields[1], 'Sweet dreams, Pip ✦', 70);
  const st = [...document.querySelectorAll<HTMLElement>('#guestbook .gb-stickers button, #guestbook .gb-stickers label')];
  if (st[2]) await click(st[2], 600, 900);
  await caption('Sign it yourself', 'on the live site — leave Pip a wish');
  await sleep(1300);
});

/* 12 · dawn */
step('dawn', async () => {
  await scrollToEl('#dawn', 2000, 0);
  await caption('Dawn', 'The town falls asleep… and so does Pip');
  await sleep(3800);
  await click('.dawn-pip', 800, 2200);
  await caption('This button is a little shy', '');
  const b = el('.wake-mischief');
  if (b) { for (let i = 0; i < 3; i++) { await moveTo('.wake-mischief', 550); await sleep(350); } }
  await sleep(500);
});

/* 13 · footer */
step('footer', async () => {
  await scrollTo(document.documentElement.scrollHeight, 1800);
  await caption('The 90s details', 'A hit-counter odometer, a webring, and credits for everyone who helped');
  await click('.credits summary', 800, 3000);
});

/* 14 · the ladder */
step('ladder', async () => {
  await caption('The scrollbar is a ladder', 'A teddy climbs it — parachute down, rocket up');
  await move(W() - 30, H() * 0.5, 700);
  await scrollTo(0, 2600);
  await sleep(600);
});

/* 15 · DreamOS apps */
step('mixtape', async () => {
  await caption('Everything is also an app', 'Pip’s Start menu opens real little programs');
  await startMenu('Mixtape');
  await caption('Pip’s Mixtape', 'Real lullabies, sung by Anushka as Pip');
  const sung = [...document.querySelectorAll<HTMLElement>('[data-track]')].find((b) => /Pip sings/.test(b.textContent ?? '')) ?? el('[data-track]');
  if (sung) await click(sung, 700, 6200);
  await click('[data-flip]', 700, 900);
  await caption('Side B', 'The bloopers 😄');
  await click('[data-track="0"]', 600, 3000);
  const playing = el('.win-body [data-play][aria-pressed="true"]');
  if (playing) await click(playing, 600, 300);
  await closeWin('Mixtape.exe');
});

step('askpip', async () => {
  await startMenu('Ask Pip');
  await caption('Ask Pip', 'Pip chats back, in character');
  await type('#ap-in', 'Who are you?', 55); el('#ap-in')?.closest('form')?.requestSubmit();
  await sleep(2800);
  await type('#ap-in', 'Tell me a joke', 55); el('#ap-in')?.closest('form')?.requestSubmit();
  await sleep(3100);
  await closeWin('Ask Pip.exe');
});

step('fitcheck', async () => {
  await startMenu('Fit Check');
  await caption('Fit Check.exe', 'Pip in 3D — sculpted by us in code, lit like a little vinyl toy');
  await waitGone('.fit-loading', 15000);
  await sleep(1600);
  const cv = el('.fit-stage canvas');
  if (cv) {
    const r = cv.getBoundingClientRect();
    await drag(r.left + r.width * 0.3, r.top + r.height * 0.55, r.left + r.width * 0.75, r.top + r.height * 0.55, 1100);
    await sleep(1400);
    await move(r.left + r.width / 2, r.top + r.height * 0.42, 600);
    await tapHere();
    await sleep(1800);
  }
  await caption('125 outfits', '5 hats × 5 onesies × 5 extras');
  await click('.fit-row[data-k="hat"] [data-d="1"]', 650, 1000);
  await click('.fit-row[data-k="hat"] [data-d="1"]', 300, 1000);
  await click('.fit-row[data-k="suit"] [data-d="1"]', 500, 1000);
  await click('.fit-row[data-k="extra"] [data-d="1"]', 500, 1300);
  await caption('…or let Pip surprise you', '');
  await click('[data-act="random"]', 650, 2000);
  await click('[data-act="random"]', 300, 2200);
  await closeWin('Fit Check.exe');
});

step('stickers', async () => {
  await startMenu('Stickers');
  await caption('Stickers & sticky notes', 'Decorate Pip’s desktop — they stay put');
  const picks = [...document.querySelectorAll<HTMLElement>('.sticker-pick')];
  if (picks[1]) await click(picks[1], 600, 700);
  if (picks[4]) await click(picks[4], 500, 700);
  await click('.win-body [data-note]', 600, 700);
  await closeWin('Stickers & Notes.exe');
  await sleep(800);
});

step('display', async () => {
  await caption('Display modes', 'CRT, LCD and 1-bit, like an old monitor');
  for (let i = 0; i < 3; i++) await click('#tb-display', i ? 350 : 800, 2000);
  await click('#tb-display', 400, 900);
});

step('pets', async () => {
  await caption('Desktop pets', 'A ghost kitten, a moon bunny and a sleepy bat follow you around');
  await startMenu('Switch pet');
  await sleep(1600);
  await startMenu('Switch pet');
  await click('.pet', 700, 1500);
});

step('konami', async () => {
  await caption('Secret code', '↑ ↑ ↓ ↓ ← → ← → B A');
  (document.activeElement as HTMLElement | null)?.blur?.();
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) { key(k, document.body); await sleep(170); }
  await caption('Star party!', '');
  await sleep(4200);
});

step('baddream', async () => {
  await caption('Whatever you do…', 'don’t open totally_not_a_nightmare.exe');
  await startMenu('nightmare');
  await sleep(1100);
  await click('[data-yes]', 700, 400);
  await caption('Bad Dream Mode', 'Nightmares take over the whole site');
  await sleep(3200);
  await waitFor('.chaos-layer .blob', 8000);
  const blobs = [...document.querySelectorAll<HTMLElement>('.chaos-layer .blob')];
  for (const b of blobs) await click(b, 500, 600, false);
  const clean = await waitFor('[data-clean]', 12000);
  await caption('Unicorn Antivirus 93', 'to the rescue!');
  if (clean) await click(clean, 800, 5200);
});

step('crib', async () => {
  await scrollTo(0, 800);
  await caption('Psst…', 'There’s a tiny eclipse ring hiding in the sky');
  await click('.portal-ring', 1000, 2600);
  await caption('The Secret Crib', 'Pip’s hiding place: a musical mobile, a wish jar and a note from Pip');
  for (const c of [...document.querySelectorAll<HTMLElement>('.cm-charm')].slice(0, 3)) await click(c, 450, 350);
  await click('.crib-ghost.g2', 600, 1100);
  await caption('Catch the Falling Dreams', 'A little mini-game hidden in the crib');
  const game = [...document.querySelectorAll<HTMLElement>('.crib-actions button')].find((b) => /Catch/.test(b.textContent ?? ''));
  if (game) await click(game, 700, 400);
  const field = await waitFor('.dg-field', 3000);
  if (field) {
    const r = field.getBoundingClientRect();
    await move(r.left + r.width / 2, r.bottom - 40, 500);
    const tEnd = performance.now() + 12000;
    let last = performance.now();
    while (performance.now() < tEnd) {
      const now = performance.now(), dt = Math.min(100, now - last); last = now;
      // chase the lowest dream (not the nightmares)
      const drops = [...field.querySelectorAll<HTMLElement>('.dg-drop:not(.blob)')].map((d) => d.getBoundingClientRect()).filter((b) => b.top < r.bottom - 30).sort((a, b) => b.top - a.top);
      const tx = drops[0] ? drops[0].left + drops[0].width / 2 : r.left + r.width / 2;
      place(cx + (tx - cx) * Math.min(1, dt / 70), r.bottom - 40);
      hover(cx, cy);
      await new Promise(requestAnimationFrame);
    }
    await click('.dream-game [data-quit]', 600, 900);
    await click('.dream-game [data-done]', 500, 500);
  }
  await click('.crib [data-back], [data-back]', 700, 1500);
});

step('shutdown', async () => {
  await caption('Good night, DreamOS', '');
  await startMenu('Shut down');
  await sleep(4600);
});
