import type { Feature } from '../core/registry';
import { store } from '../core/store';
import { isTouch, reducedMotion } from '../core/a11y';

/**
 * Cursor trail engine (+2 side quest). One canvas, one preset per section.
 * Desktop: particles trail the pointer (system cursor stays visible).
 * Touch: every tap spawns a small burst instead.
 */

interface Preset { glyphs: string[]; colors: string[]; size: [number, number]; gravity: number; life: number }

const PRESETS: Record<string, Preset> = {
  hero: { glyphs: ['✦', '★', '·'], colors: ['#f3d27a', '#f6b5c8', '#fff5e8'], size: [10, 18], gravity: 0.02, life: 900 },
  about: { glyphs: ['♥'], colors: ['#f6b5c8', '#ff9fbd'], size: [10, 16], gravity: -0.02, life: 900 },
  story: { glyphs: ['•', '·'], colors: ['#ffd98a', '#fff1c4'], size: [5, 10], gravity: -0.01, life: 1200 },
  dome: { glyphs: ['✦', '✧'], colors: ['#f3d27a', '#c9b6e4'], size: [10, 16], gravity: 0, life: 900 },
  lab: { glyphs: ['♪', '♫'], colors: ['#f3d27a', '#f6b5c8', '#c9b6e4'], size: [14, 20], gravity: -0.03, life: 1000 },
  nightlights: { glyphs: ['·'], colors: ['#ffd98a'], size: [6, 9], gravity: -0.01, life: 700 },
  toys: { glyphs: ['★', '●'], colors: ['#f3d27a', '#bfe8d6', '#f6b5c8'], size: [8, 14], gravity: 0.05, life: 800 },
  route: { glyphs: ['☁'], colors: ['#ffffff', '#e8dcf7'], size: [12, 18], gravity: -0.01, life: 1100 },
  guestbook: { glyphs: ['•'], colors: ['#3b2a5c', '#6c5a95'], size: [5, 9], gravity: 0.06, life: 700 },
  dawn: { glyphs: ['✦', '·'], colors: ['#ffd1a8', '#f6b5c8'], size: [8, 14], gravity: 0.01, life: 900 },
  chaos: { glyphs: ['👻', '✖', '?'], colors: ['#bfe8d6', '#c9b6e4'], size: [14, 22], gravity: 0.03, life: 900 },
};

interface P { x: number; y: number; vx: number; vy: number; born: number; life: number; g: string; c: string; s: number; rot: number; vr: number; grav: number }

const feature: Feature = {
  id: 'cursor',
  priority: 'must',
  init() {
    const canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const touch = isTouch();
    const MAX = touch ? 20 : 40;
    const parts: P[] = [];
    let running = false;
    let lastX = -1, lastY = -1;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const enabled = () => store.get('fx.cursor') && !reducedMotion();
    const preset = () => PRESETS[store.get('chaos.active') ? 'chaos' : store.get('section.current')] ?? PRESETS.hero;

    const spawn = (x: number, y: number, burst = false) => {
      const p = preset();
      const n = burst ? 8 : 1;
      for (let i = 0; i < n; i++) {
        if (parts.length >= MAX) parts.shift();
        const a = burst ? (Math.PI * 2 * i) / n : Math.random() * Math.PI * 2;
        const sp = burst ? 1.6 + Math.random() : 0.3 + Math.random() * 0.5;
        parts.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: performance.now(), life: p.life * (0.7 + Math.random() * 0.5),
          g: p.glyphs[Math.floor(Math.random() * p.glyphs.length)], c: p.colors[Math.floor(Math.random() * p.colors.length)],
          s: p.size[0] + Math.random() * (p.size[1] - p.size[0]), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.1, grav: p.gravity,
        });
      }
      if (!running) { running = true; requestAnimationFrame(frame); }
    };

    const frame = (now: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        const t = (now - p.born) / p.life;
        if (t >= 1) { parts.splice(i, 1); continue; }
        p.vy += p.grav; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.shadowColor = p.c;
        ctx.shadowBlur = 6;
        ctx.font = `${p.s}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.g, 0, 0);
        ctx.restore();
      }
      if (parts.length) requestAnimationFrame(frame);
      else { running = false; ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); }
    };

    if (touch) {
      window.addEventListener('pointerdown', (e) => { if (enabled()) spawn(e.clientX, e.clientY, true); }, { passive: true });
    } else {
      window.addEventListener('pointermove', (e) => {
        if (!enabled() || store.get('section.current') === 'nightlights' && !store.get('chaos.active')) return;
        if (Math.hypot(e.clientX - lastX, e.clientY - lastY) < 14) return;
        lastX = e.clientX; lastY = e.clientY;
        spawn(e.clientX, e.clientY);
      }, { passive: true });
      window.addEventListener('pointerdown', (e) => { if (enabled()) spawn(e.clientX, e.clientY, true); }, { passive: true });
    }
  },
};

export default feature;
