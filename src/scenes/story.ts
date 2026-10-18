import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { audio } from '../core/audio';
import { voice } from '../core/voice';
import { store } from '../core/store';
import { announce, isTouch, reducedMotion } from '../core/a11y';
import { sparkleBurst } from './hero';
import { url } from '../core/assets';

/** Swap the CSS quilts for Anushka's painted blankets (O20) when they exist. */
export function paintBlankets(root: ParentNode): void {
  const art = ['blanket-pink', 'blanket-lavender', 'blanket-gold', 'blanket-mint'];
  root.querySelectorAll<HTMLElement>('.blanket').forEach((b, i) => {
    const src = url(art[i % art.length], 256);
    if (!src) return;
    b.classList.add('painted');
    b.innerHTML = `<img src="${src}" alt="" draggable="false">`;
  });
}

/**
 * Pip's story, told by the scroll. Each beat gets a progress value p (0 → 1) from its own
 * ScrollTrigger (pinned on desktop, scrubbed in place on phones), and everything in the beat
 * is a pure function of p — so scrolling back up plays it all in reverse (the star flies home).
 * Each beat also has one thing to do with your hands: wake-up calls, a hand to reach, a wish, ghosts to tuck in.
 */

const NAT_W = 1536, NAT_H = 1024; // every painting is processed at 3:2

/** Where a point of the painting (in 1536×1024 space) lands inside an object-fit: cover image box. */
function coverPoint(img: HTMLImageElement, x: number, y: number): { x: number; y: number; s: number } {
  const bw = img.clientWidth, bh = img.clientHeight;
  const s = Math.max(bw / NAT_W, bh / NAT_H);
  const pos = getComputedStyle(img).objectPosition.split(' ').map((v) => (v.endsWith('%') ? parseFloat(v) / 100 : 0.5));
  return { x: (bw - NAT_W * s) * (pos[0] ?? 0.5) + x * s, y: (bh - NAT_H * s) * (pos[1] ?? 0.5) + y * s, s };
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const canHear = () => store.get('audio.unlocked') && !store.get('sound.muted');

/* ---------- Beat 1: the too-quiet town ---------- */
const SLEEPLESS: { x: number; y: number; line: string }[] = [
  { x: 153, y: 440, line: "Can't sleep… it's TOO quiet." },
  { x: 447, y: 460, line: "I've counted 4,012 sheep. They're all awake too." },
  { x: 380, y: 580, line: 'Is anyone else up? …Hello?' },
  { x: 613, y: 567, line: 'I tried humming. Ghosts can’t hum.' },
  { x: 173, y: 753, line: 'My blanket is too blankety.' },
  { x: 560, y: 867, line: 'Wake me up when there’s a lullaby.' },
  { x: 913, y: 880, line: 'Shhh… I’m listening for crickets.' },
  { x: 1413, y: 460, line: 'Night 41 of no sleep. Send cocoa.' },
  { x: 1433, y: 693, line: 'If I close my eyes, the quiet gets LOUDER.' },
  { x: 1400, y: 920, line: 'Somebody please make a noise. Any noise.' },
];

function beat1(beat: HTMLElement): (p: number) => void {
  const img = beat.querySelector<HTMLImageElement>('.paint img')!;
  const layer = beat.querySelector<HTMLElement>('.hotspots')!;
  const count = beat.querySelector<HTMLElement>('.awake-count')!;
  const met = new Set<number>();
  const spots = SLEEPLESS.map((g, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hotspot btn-reset';
    b.setAttribute('aria-label', `Knock on a glowing window (${i + 1})`);
    b.style.setProperty('--d', `${(i % 5) * -0.6}s`);
    b.addEventListener('click', () => {
      voice.bubble(g.line, b);
      audio.play('pop');
      b.classList.add('met');
      met.add(i);
      const visible = spots.filter((s) => !s.hidden).length;
      const left = Math.max(0, visible - [...met].filter((m) => !spots[m].hidden).length);
      count.textContent = left ? `${left} still awake` : 'Nobody can sleep. Somebody needs to do something…';
      if (!left) announce('Every ghost in town is awake.');
    });
    layer.appendChild(b);
    return b;
  });
  const place = () => {
    let shown = 0;
    SLEEPLESS.forEach((g, i) => {
      const pt = coverPoint(img, g.x, g.y);
      const out = pt.x < 24 || pt.x > beat.clientWidth - 24 || pt.y < 60 || pt.y > beat.clientHeight - 40;
      spots[i].hidden = out;
      spots[i].style.left = `${pt.x}px`;
      spots[i].style.top = `${pt.y}px`;
      if (!out) shown++;
    });
    const left = spots.filter((s, i) => !s.hidden && !met.has(i)).length;
    count.textContent = `${left || shown} still awake`;
  };
  new ResizeObserver(place).observe(beat);
  img.addEventListener('load', place);
  place();

  let crickets = false;
  return (p) => {
    beat.style.setProperty('--zoom', String(1.14 - 0.14 * smooth(0, 1, p)));
    beat.classList.toggle('on', p > 0.04);
    if (p > 0.3 && !crickets) { crickets = true; if (canHear()) { audio.play('cricket'); voice.say('V15', beat.querySelector('.parchment')); } }
    if (p < 0.1) crickets = false;
  };
}

/* ---------- Beat 2: a hand in the clouds ---------- */
function beat2(beat: HTMLElement): (p: number) => void {
  const btn = beat.querySelector<HTMLButtonElement>('.hand-pip-btn')!;
  const spark = beat.querySelector<HTMLElement>('.spark')!;
  let scrollP = 0, dragP = 0, met = false, shimmered = false;

  const render = () => {
    const m = Math.max(smooth(0.05, 0.85, scrollP), dragP);
    beat.style.setProperty('--m', m.toFixed(3));
    beat.style.setProperty('--part', smooth(0, 0.7, scrollP).toFixed(3));
    if (m > 0.97 && !met) {
      met = true;
      spark.classList.add('boop');
      const r = spark.getBoundingClientRect();
      sparkleBurst(r.left + r.width / 2, r.top + r.height / 2, 14);
      if (canHear()) { audio.play('chime'); voice.say('V16', spark, true); }
      announce('The hands touch. A spark!');
    }
    if (m < 0.6 && met) { met = false; spark.classList.remove('boop'); }
  };

  // drag the little hand upward toward the Moon (mouse), or press it (keyboard / tap: phones keep their scroll)
  let startY = 0, startP = 0, dragging = false;
  if (isTouch()) beat.querySelector('.beat-hint')!.textContent = 'Tap the little hand to reach up.';
  btn.addEventListener('pointerdown', (e) => {
    if (isTouch()) return;
    dragging = true; startY = e.clientY; startP = dragP;
    btn.setPointerCapture(e.pointerId);
    btn.classList.add('grab');
  });
  btn.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dragP = clamp(startP + (startY - e.clientY) / (beat.clientHeight * 0.35));
    render();
  });
  const end = () => { dragging = false; btn.classList.remove('grab'); };
  btn.addEventListener('pointerup', end);
  btn.addEventListener('pointercancel', end);
  btn.addEventListener('click', () => {
    if (dragP > 0.97) return;
    const from = dragP, t0 = performance.now();
    const step = (now: number) => {
      dragP = from + (1 - from) * smooth(0, 1, (now - t0) / (reducedMotion() ? 1 : 700));
      render();
      if (dragP < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  return (p) => {
    scrollP = p;
    if (p < 0.05) dragP = 0;
    beat.classList.toggle('on', p > 0.04);
    if (p > 0.15 && !shimmered) { shimmered = true; if (canHear()) audio.play('shimmer'); }
    if (p < 0.05) shimmered = false;
    render();
  };
}

/* ---------- Beat 3: plip! (the star falls, and flies home when you scroll back) ---------- */
const WISHES = [
  'A wish for warm socks for every ghost.',
  'A wish for a lullaby that never ends.',
  'A wish for one extra minute of sleep.',
  'A wish that nobody is ever scared of the dark.',
  'A wish for pancakes. Big ones.',
  'A wish for a friend who giggles at the same things.',
];

function beat3(beat: HTMLElement): (p: number) => void {
  const img = beat.querySelector<HTMLImageElement>('.paint img')!;
  const star = beat.querySelector<HTMLButtonElement>('.falling-star')!;
  const starArt = url('wish-star', 256);
  if (starArt) { star.innerHTML = `<img src="${starArt}" alt="" draggable="false">`; star.classList.add('painted'); }
  const trail = [...beat.querySelectorAll<HTMLElement>('.star-trail i')];
  const glow = beat.querySelector<HTMLElement>('.cradle-glow')!;
  const cradle = beat.querySelector<HTMLButtonElement>('.cradle-pip')!;
  const S = { x: 300, y: 440 }, C = { x: 840, y: 330 }, E = { x: 1246, y: 640 }; // window → arc under the text → cradle
  let landed = false, wish = 0, lastP = 0;

  const at = (t: number) => {
    const s = coverPoint(img, S.x, S.y), c = coverPoint(img, C.x, C.y), e = coverPoint(img, E.x, E.y);
    const u = 1 - t;
    return { x: u * u * s.x + 2 * u * t * c.x + t * t * e.x, y: u * u * s.y + 2 * u * t * c.y + t * t * e.y, e };
  };

  const render = (p: number) => {
    const t = smooth(0.08, 0.82, p);
    const pt = at(t);
    star.style.left = `${pt.x}px`;
    star.style.top = `${pt.y}px`;
    star.style.setProperty('--sc', String(0.7 + 0.5 * Math.sin(t * Math.PI)));
    star.classList.toggle('gone', t >= 0.999 || p < 0.04);
    trail.forEach((d, i) => {
      const q = at(Math.max(0, t - (i + 1) * 0.035));
      d.style.left = `${q.x}px`; d.style.top = `${q.y}px`;
      d.style.opacity = t > 0.02 && t < 0.999 ? String(0.55 - i * 0.08) : '0';
    });
    glow.style.left = cradle.style.left = `${pt.e.x}px`;
    glow.style.top = cradle.style.top = `${pt.e.y}px`;
    glow.style.opacity = String(smooth(0.4, 0.95, t) * (p > 0.04 ? 1 : 0));
    beat.classList.toggle('pip-asleep', t >= 0.999 && p < 0.92);
    beat.classList.toggle('pip-awake', p >= 0.92);
    if (t >= 0.999 && !landed) {
      landed = true;
      const r = star.getBoundingClientRect();
      if (p > lastP) sparkleBurst(r.left, r.top, 16);
      if (canHear()) audio.play('twinkle');
    }
    if (t < 0.95) landed = false;
    if (p >= 0.92 && lastP < 0.92 && canHear()) voice.say('V03', cradle, true);
    lastP = p;
  };

  star.addEventListener('click', () => {
    const r = star.getBoundingClientRect();
    sparkleBurst(r.left + r.width / 2, r.top + r.height / 2, 12);
    audio.play('sparkle');
    voice.say('V17', star, true);
    window.setTimeout(() => voice.bubble(WISHES[wish++ % WISHES.length], star), 1400);
  });
  cradle.addEventListener('click', () => {
    voice.giggle(cradle);
    cradle.classList.remove('wiggle'); void cradle.offsetWidth; cradle.classList.add('wiggle');
  });

  let current = 0;
  new ResizeObserver(() => render(current)).observe(beat);
  return (p) => { current = p; beat.classList.toggle('on', p > 0.04); render(p); };
}

/* ---------- Beat 4: tuck them in ---------- */
function beat4(beat: HTMLElement): (p: number) => void {
  paintBlankets(beat);
  const ghosts = [...beat.querySelectorAll<HTMLButtonElement>('.sg')];
  const text = beat.querySelector<HTMLElement>('.ch4-text')!;
  const hint = beat.querySelector<HTMLElement>('.tuck-hint')!;
  const tucked = new Set<HTMLButtonElement>();
  ghosts.forEach((g) => g.addEventListener('click', () => {
    if (tucked.has(g)) { audio.play('pop'); voice.bubble('zzz… five more minutes…', g); return; }
    tucked.add(g);
    g.classList.add('tucked');
    g.setAttribute('aria-label', g.getAttribute('aria-label')!.replace('Tuck in', 'Fast asleep:'));
    voice.say('V18', g, true);
    audio.play('chime');
    if (tucked.size === ghosts.length) {
      beat.classList.add('all-asleep');
      text.textContent = 'Pip didn’t know any lullabies yet, so Pip made one up. One by one, the little ghosts yawned, snuggled down… and the whole town fell fast asleep.';
      hint.textContent = 'Shh… they’re all asleep.';
      announce('All the ghosts are asleep. The whole town fell asleep.');
      audio.play('sparkle');
    } else hint.textContent = `${ghosts.length - tucked.size} more to tuck in.`;
  }));
  return (p) => {
    beat.classList.toggle('on', p > 0.04);
    ghosts.forEach((g, i) => g.style.setProperty('--in', smooth(0.05 + i * 0.12, 0.45 + i * 0.12, p).toFixed(3)));
    beat.style.setProperty('--notes', smooth(0.3, 0.8, p).toFixed(3));
  };
}

/* ---------- wiring ---------- */
let triggers: ScrollTrigger[] = [];

export function initStoryScroll(): void {
  const beats = [...document.querySelectorAll<HTMLElement>('#story .beat')];
  const dots = [...document.querySelectorAll<HTMLElement>('.story-dots li')];
  const renderers = beats.map((b) => ({ '1': beat1, '2': beat2, '3': beat3, '4': beat4 }[b.dataset.beat!]!(b)));

  const story = document.getElementById('story')!;
  let lastActive = -1;
  // stacked chapters are hidden until they dissolve in, so lazy images would never start loading: fetch them early
  new IntersectionObserver((entries, io) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    story.querySelectorAll<HTMLImageElement>('img[loading="lazy"], img:not([loading])').forEach((im) => { im.loading = 'eager'; });
    io.disconnect();
  }, { rootMargin: '150% 0px' }).observe(story);
  /**
   * One pinned stage: the four chapters are stacked and each dissolves into the next as you scroll (P = 0..1).
   * Each chapter gets its own share of the scroll (W); chapter 3 is longer so Pip can land, sit up in the cradle
   * and giggle before chapter 4 starts to cover it (ACT = the part spent animating, the rest is a hold).
   */
  const W = beats.map((b) => (b.dataset.beat === '3' ? 2 : 1));
  const ACT = W.map((w) => (w > 1 ? 1 : 0.92));
  const A = W.map((_, i) => W.slice(0, i).reduce((x, y) => x + y, 0)); // where each chapter starts
  const TOTAL = W.reduce((x, y) => x + y, 0);
  const renderStage = (P: number) => {
    const u = P * TOTAL;
    let active = 0;
    beats.forEach((b, i) => {
      const fadeIn = i === 0 ? 1 : smooth(A[i] - 0.2, A[i] + 0.02, u); // later chapters dissolve in on top
      const gone = i < beats.length - 1 && u > A[i + 1] + 0.05; // and the one underneath is put away once covered
      const o = gone ? 0 : fadeIn;
      b.style.opacity = o.toFixed(3);
      b.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
      if (o > 0.6) active = i;
      renderers[i](clamp((u - A[i]) / ACT[i]));
    });
    beats.forEach((b, i) => { b.inert = i !== active; });
    if (active !== lastActive) { lastActive = active; dots.forEach((d, j) => d.classList.toggle('on', j === active)); }
  };

  const build = () => {
    triggers.forEach((t) => t.kill());
    triggers = [];
    const still = reducedMotion();
    story.classList.toggle('still', still);
    story.classList.toggle('stage', !still);
    if (still) {
      beats.forEach((b) => { b.style.opacity = ''; b.style.visibility = ''; b.inert = false; });
      renderers.forEach((r) => r(1));
      return;
    }
    triggers.push(ScrollTrigger.create({
      trigger: story,
      start: 'top top',
      end: () => `+=${window.innerHeight * (isTouch() ? 0.85 : 1.1) * TOTAL}`,
      pin: true,
      anticipatePin: 1,
      refreshPriority: 10,
      onUpdate: (self) => renderStage(self.progress),
      onRefresh: (self) => renderStage(self.progress),
    }));
    renderStage(0);
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  };
  build();
  store.on('motion.reduced', build);
  // first lullaby button lives in beat 4; the rest of its behaviour is in misc.ts
}
