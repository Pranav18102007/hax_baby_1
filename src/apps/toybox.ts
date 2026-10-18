import type { Feature } from '../core/registry';
import { bus } from '../core/bus';
import { audio } from '../core/audio';
import { url } from '../core/assets';
import { voice } from '../core/voice';
import { isPhone } from '../core/a11y';
import type { Body as MBody } from 'matter-js';

/** Toy Box.exe: Rattle & Block Toys. Matter.js loads only when this window opens. */

const TOYS = ['toy-star', 'toy-moon', 'toy-heart', 'toy-cloud', 'toy-bone', 'toy-note'];
const RATTLES = ['rattle-round', 'rattle-star'];

audio.register('knock', (t) => { const c = audio.ctx!; const o = c.createOscillator(); const g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(320 + Math.random() * 80, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(g).connect(audio.sfx!); o.start(t); o.stop(t + 0.12); });
audio.register('shake', (t) => { for (let i = 0; i < 4; i++) audio.play('click'); void t; });

async function mount(body: HTMLElement): Promise<() => void> {
  const M = await import('matter-js');
  const { Engine, Bodies, Composite, Body, Mouse, MouseConstraint, Events } = M;

  body.classList.add('toy');
  body.innerHTML = `
    <div class="toy-bar">
      <button type="button" class="os-button" data-more>+ More blocks</button>
      <button type="button" class="os-button" data-shake>Shake the box</button>
      <button type="button" class="os-button" data-grav aria-pressed="false">Gravity: Earth</button>
      <button type="button" class="os-button" data-tidy>Tidy up</button>
      <span class="toy-goal" aria-live="polite">Stack 4 blocks into a tower!</span>
    </div>
    <div class="toy-stage"><canvas aria-label="Toy box: drag and throw the blocks and rattles"></canvas></div>`;
  const stage = body.querySelector<HTMLElement>('.toy-stage')!;
  const canvas = stage.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const goal = body.querySelector<HTMLElement>('.toy-goal')!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const MAX = isPhone() ? 12 : 20;

  const imgs = new Map<string, HTMLImageElement>();
  await Promise.all([...TOYS, ...RATTLES].map((n) => new Promise<void>((res) => {
    const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = url(n, 384); imgs.set(n, im);
  })));

  const engine = Engine.create({ enableSleeping: false });
  engine.gravity.y = 1;
  let W = 0, H = 0, size = 56;
  let walls: MBody[] = [];
  const toys: { body: MBody; img: string; w: number; h: number }[] = [];

  const layout = () => {
    W = stage.clientWidth; H = stage.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    size = Math.max(44, Math.min(72, W / 9));
    Composite.remove(engine.world, walls);
    const t = 200;
    walls = [
      Bodies.rectangle(W / 2, H + t / 2 - 6, W * 3, t, { isStatic: true, friction: 0.8 }), // floor
      Bodies.rectangle(-t / 2, H / 2, t, H * 4, { isStatic: true }),
      Bodies.rectangle(W + t / 2, H / 2, t, H * 4, { isStatic: true }),
      Bodies.rectangle(W / 2, -H * 1.5, W * 3, t, { isStatic: true }),
    ];
    Composite.add(engine.world, walls);
  };

  const addToy = (name?: string) => {
    if (toys.length >= MAX) {
      const old = toys.shift()!;
      Composite.remove(engine.world, old.body);
    }
    const rattle = name ? RATTLES.includes(name) : Math.random() < 0.25;
    const img = name ?? (rattle ? RATTLES[Math.floor(Math.random() * 2)] : TOYS[Math.floor(Math.random() * TOYS.length)]);
    const x = W * (0.2 + Math.random() * 0.6), y = -size;
    let b: MBody, w: number, h: number;
    if (rattle) {
      w = size * 0.6; h = size * 1.05;
      b = Bodies.rectangle(x, y, w, h, { chamfer: { radius: w / 2.2 }, restitution: 0.5, friction: 0.3, density: 0.0012, label: 'rattle' });
    } else {
      w = h = size;
      b = Bodies.rectangle(x, y, w, h, { chamfer: { radius: 8 }, restitution: 0.25, friction: 0.7, density: 0.002, label: 'block' });
    }
    Body.setAngle(b, (Math.random() - 0.5) * 0.6);
    Composite.add(engine.world, b);
    toys.push({ body: b, img, w, h });
  };

  layout();
  TOYS.forEach((t) => addToy(t));
  RATTLES.forEach((r) => addToy(r));

  // drag and throw (Matter's mouse handles touch too)
  const mouse = Mouse.create(canvas);
  mouse.pixelRatio = dpr; // canvas is drawn at dpr × CSS size; Matter scales pointer coords by this
  const mc = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2, damping: 0.1, render: { visible: false } } });
  Composite.add(engine.world, mc);
  Events.on(mc, 'startdrag', () => audio.play('click'));
  if (import.meta.env.DEV) Object.assign(canvas, { __toys: toys, __mc: mc }); // test hook (dev builds only)

  // collision sounds, scaled by impact speed and throttled
  let lastSound = 0;
  Events.on(engine, 'collisionStart', (e) => {
    const now = performance.now();
    if (now - lastSound < 60) return;
    for (const p of e.pairs) {
      const v = Math.hypot(p.bodyA.velocity.x - p.bodyB.velocity.x, p.bodyA.velocity.y - p.bodyB.velocity.y);
      if (v < 2.2) continue;
      lastSound = now;
      audio.play(p.bodyA.label === 'rattle' || p.bodyB.label === 'rattle' ? 'shake' : 'knock');
      break;
    }
  });

  // tower detection: 4 resting blocks stacked for 2 s
  let towerSince = 0, celebrated = false;
  const checkTower = () => {
    if (celebrated) return;
    const blocks = toys.filter((t) => t.body.label === 'block' && t.body.speed < 0.25 && !mc.body);
    let best = 1;
    for (const b of blocks) {
      let n = 1, cur = b;
      for (;;) {
        const above = blocks.find((o) => o !== cur && Math.abs(o.body.position.x - cur.body.position.x) < size * 0.6 && cur.body.position.y - o.body.position.y > size * 0.7 && cur.body.position.y - o.body.position.y < size * 1.3);
        if (!above) break;
        n++; cur = above;
      }
      best = Math.max(best, n);
    }
    if (best >= 4) {
      if (!towerSince) towerSince = performance.now();
      else if (performance.now() - towerSince > 2000) {
        celebrated = true;
        goal.textContent = 'Tower! Pip is very impressed. ★';
        goal.classList.add('won');
        audio.play('sparkle');
        voice.giggle(canvas);
      }
    } else towerSince = 0;
  };

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const t of toys) {
      const im = imgs.get(t.img);
      ctx.save();
      ctx.translate(t.body.position.x, t.body.position.y);
      ctx.rotate(t.body.angle);
      ctx.shadowColor = 'rgba(40, 20, 70, 0.35)';
      ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
      if (im?.complete && im.naturalWidth) {
        const scale = Math.max(t.w / im.naturalWidth, t.h / im.naturalHeight) * (t.body.label === 'rattle' ? 1.05 : 1.08);
        ctx.drawImage(im, (-im.naturalWidth * scale) / 2, (-im.naturalHeight * scale) / 2, im.naturalWidth * scale, im.naturalHeight * scale);
      } else { ctx.fillStyle = '#f6b5c8'; ctx.fillRect(-t.w / 2, -t.h / 2, t.w, t.h); }
      ctx.restore();
    }
  };

  let raf = 0, last = performance.now(), frame = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (!body.isConnected || body.offsetParent === null) { last = now; return; } // minimised/hidden: pause
    const dt = Math.min(32, now - last); last = now;
    Engine.update(engine, dt);
    draw();
    if (++frame % 15 === 0) checkTower();
  };
  raf = requestAnimationFrame(loop);

  const ro = new ResizeObserver(() => layout());
  ro.observe(stage);

  body.querySelector('[data-more]')!.addEventListener('click', () => { for (let i = 0; i < 3; i++) addToy(); audio.play('pop'); });
  body.querySelector('[data-shake]')!.addEventListener('click', () => {
    toys.forEach((t) => Body.setVelocity(t.body, { x: (Math.random() - 0.5) * 12, y: -10 - Math.random() * 8 }));
    audio.play('shake');
  });
  const grav = body.querySelector<HTMLButtonElement>('[data-grav]')!;
  grav.addEventListener('click', () => {
    const moon = engine.gravity.y > 0.5;
    engine.gravity.y = moon ? 0.16 : 1;
    grav.textContent = moon ? 'Gravity: Moon' : 'Gravity: Earth';
    grav.setAttribute('aria-pressed', String(moon));
    audio.play(moon ? 'sparkle' : 'click');
  });
  body.querySelector('[data-tidy]')!.addEventListener('click', () => {
    toys.splice(0).forEach((t) => Composite.remove(engine.world, t.body));
    TOYS.forEach((t) => addToy(t));
    RATTLES.forEach((r) => addToy(r));
    celebrated = false; towerSince = 0;
    goal.textContent = 'Stack 4 blocks into a tower!';
    goal.classList.remove('won');
  });

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    Events.off(engine, 'collisionStart');
    Composite.clear(engine.world, false);
    Engine.clear(engine);
  };
}

const feature: Feature = {
  id: 'toybox',
  priority: 'should',
  apps: [{ id: 'toybox', title: 'Toy Box.exe', icon: 'icon-block', width: 680, height: 520, mount }],
  startMenu: [{ id: 'toybox', label: 'Toy Box', icon: 'icon-block', group: 'programs', order: 3, run: () => bus.emit('app:open', 'toybox') }],
};

export default feature;
