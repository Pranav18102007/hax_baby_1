import type { Feature } from '../core/registry';
import { bus } from '../core/bus';
import { audio } from '../core/audio';
import { voice } from '../core/voice';
import { reducedMotion, announce } from '../core/a11y';
import { url } from '../core/assets';
import { store } from '../core/store';

/**
 * Fit Check.exe: Pip in 3D (Three.js, loaded only when this window opens).
 * Drag or swipe to spin Pip round, tap Pip for a wave and a hop, and dress Pip up:
 * five hats, five onesies, five extras. The eye-lights follow your pointer. Snap saves a PNG.
 */

const KEY = 'pip.fit';
audio.register('shutter', (t) => {
  const c = audio.ctx!;
  [1800, 900].forEach((f, i) => { const o = c.createOscillator(); const g = c.createGain(); o.type = 'square'; o.frequency.setValueAtTime(f, t + i * 0.07); g.gain.setValueAtTime(0.08, t + i * 0.07); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.05); o.connect(g).connect(audio.sfx!); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.06); });
});
const VERDICTS = [
  'Certified dreamy. ✨', '10/10, would nap in.', 'Serving cozy realness.', 'The ghosts are gasping.',
  'Runway: the Milky Way.', 'Bedtime couture!', 'Moon-approved.', 'So cute it’s a little bit illegal.',
];

function loadFit(): { hat: number; suit: number; extra: number } {
  try { const f = JSON.parse(localStorage.getItem(KEY) || 'null'); if (f && [f.hat, f.suit, f.extra].every((n) => Number.isInteger(n) && n >= 0 && n < 5)) return f; } catch { /* ignore */ }
  return { hat: 0, suit: 0, extra: 0 };
}
function saveFit(f: object): void { try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* ignore */ } }

function hasWebGL(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

async function mount(body: HTMLElement): Promise<() => void> {
  body.classList.add('fit');
  if (!hasWebGL()) {
    body.innerHTML = `<div class="fit-fallback"><img src="${url('pip-default', 512)}" alt="Pip in a starry nightcap" width="220" height="220"><p>Your browser can’t do 3D right now, so here’s Pip’s favourite outfit in 2D. Still a 10/10.</p></div>`;
    return () => {};
  }
  body.innerHTML = `
    <div class="fit-stage">
      <div class="fit-bg" aria-hidden="true"></div>
      <div class="fit-sign" aria-hidden="true"><span>FIT CHECK</span></div>
      <canvas tabindex="0" role="img" aria-label="Pip in 3D"></canvas>
      <p class="fit-hint" aria-hidden="true">drag to spin · tap Pip</p>
      <p class="fit-loading">Pip is getting dressed…</p>
    </div>
    <div class="fit-bar">
      ${[['hat', 'Hat'], ['suit', 'Onesie'], ['extra', 'Extra']].map(([k, label]) => `
        <div class="fit-row" data-k="${k}">
          <span class="fit-label">${label}</span>
          <button type="button" class="os-button fit-arrow" data-d="-1" aria-label="Previous ${label.toLowerCase()}">◀</button>
          <output class="fit-name" aria-live="polite"></output>
          <button type="button" class="os-button fit-arrow" data-d="1" aria-label="Next ${label.toLowerCase()}">▶</button>
        </div>`).join('')}
      <div class="fit-actions">
        <button type="button" class="os-button" data-act="random">🎲 Surprise fit</button>
        <button type="button" class="os-button" data-act="spin" aria-pressed="${!reducedMotion()}">⟳ Spin</button>
        <button type="button" class="os-button" data-act="snap">📸 Snap</button>
      </div>
      <p class="fit-verdict" aria-live="polite"></p>
    </div>`;

  const stage = body.querySelector<HTMLElement>('.fit-stage')!;
  const canvas = stage.querySelector('canvas')!;
  const verdict = body.querySelector<HTMLElement>('.fit-verdict')!;
  const spinBtn = body.querySelector<HTMLButtonElement>('[data-act="spin"]')!;

  const { createPipScene, HATS, SUITS, EXTRAS } = await import('./fit3d');
  const LISTS = { hat: HATS, suit: SUITS, extra: EXTRAS } as const;
  const still = reducedMotion();
  let pip: Awaited<ReturnType<typeof createPipScene>>;
  try {
    pip = await createPipScene(canvas, { still, modelUrl: '/models/pip.glb' });
  } catch {
    body.innerHTML = `<div class="fit-fallback"><img src="${url('pip-default', 512)}" alt="Pip in a starry nightcap" width="220" height="220"><p>Pip’s 3D wardrobe didn’t load this time, so here’s the 2D look. Still a 10/10. Close and reopen to try again.</p></div>`;
    return () => {};
  }
  if (!canvas.isConnected) { pip.dispose(); return () => {}; }
  stage.querySelector('.fit-loading')?.remove();

  let fit = loadFit();
  const describe = () => `Pip in 3D wearing: ${HATS[fit.hat]}, ${SUITS[fit.suit]} onesie${fit.extra ? `, with ${EXTRAS[fit.extra].toLowerCase()}` : ''}. Drag or use arrow keys to spin, Enter to poke.`;
  const apply = (say = false) => {
    pip.setFit(fit);
    saveFit(fit);
    body.querySelectorAll<HTMLElement>('.fit-row').forEach((r) => {
      const k = r.dataset.k as keyof typeof LISTS;
      r.querySelector('output')!.textContent = LISTS[k][fit[k]];
    });
    canvas.setAttribute('aria-label', describe());
    if (say) verdict.textContent = VERDICTS[Math.floor(Math.random() * VERDICTS.length)];
  };
  apply();

  body.querySelectorAll<HTMLElement>('.fit-row').forEach((r) => {
    const k = r.dataset.k as keyof typeof LISTS;
    r.querySelectorAll<HTMLButtonElement>('.fit-arrow').forEach((b) => b.addEventListener('click', () => {
      fit = { ...fit, [k]: (fit[k] + Number(b.dataset.d) + 5) % 5 };
      audio.play('pop');
      apply(true);
    }));
  });
  body.querySelector('[data-act="random"]')!.addEventListener('click', () => {
    const r = () => Math.floor(Math.random() * 5);
    fit = { hat: r(), suit: r(), extra: r() };
    audio.play('sparkle');
    pip.poke();
    apply(true);
    announce(describe());
  });
  spinBtn.addEventListener('click', () => {
    const on = spinBtn.getAttribute('aria-pressed') !== 'true';
    spinBtn.setAttribute('aria-pressed', String(on));
    pip.setAuto(on);
    audio.play('click');
  });
  // the painted nursery behind the studio follows the site's day / night mode
  const bgName = store.get('theme.mode') === 'day' ? 'nursery-day' : 'nursery-night';
  const bgSrc = url(bgName, 900);
  const bgEl = body.querySelector<HTMLElement>('.fit-bg')!;
  bgEl.style.backgroundImage = `url("${bgSrc}")`;
  body.querySelector('.fit-stage')!.classList.toggle('day', bgName === 'nursery-day');
  const bgImg = new Image(); bgImg.src = bgSrc;

  // Snap: the backdrop, Pip and the sign, flattened into one PNG
  body.querySelector('[data-act="snap"]')!.addEventListener('click', () => {
    const pipImg = new Image();
    pipImg.onload = () => {
      const w = canvas.width, h = canvas.height;
      const out = document.createElement('canvas'); out.width = w; out.height = h;
      const g = out.getContext('2d')!;
      g.fillStyle = '#2b2350'; g.fillRect(0, 0, w, h);
      if (bgImg.complete && bgImg.naturalWidth) {
        const s = Math.max(w / bgImg.naturalWidth, h / bgImg.naturalHeight) * 1.06;
        g.filter = `blur(${Math.round(w / 220)}px) brightness(0.72) saturate(1.1)`;
        g.drawImage(bgImg, (w - bgImg.naturalWidth * s) / 2, (h - bgImg.naturalHeight * s) / 2, bgImg.naturalWidth * s, bgImg.naturalHeight * s);
        g.filter = 'none';
      }
      const v = g.createRadialGradient(w / 2, h * 0.55, h * 0.2, w / 2, h * 0.55, Math.max(w, h) * 0.75);
      v.addColorStop(0, 'rgba(30,22,58,0.15)'); v.addColorStop(1, 'rgba(18,12,36,0.75)');
      g.fillStyle = v; g.fillRect(0, 0, w, h);
      g.drawImage(pipImg, 0, 0, w, h);
      const fs = Math.round(h * 0.06);
      g.font = `${fs}px VT323, monospace`; g.textBaseline = 'top';
      g.fillStyle = '#ffe9a8'; g.shadowColor = '#f6b5c8'; g.shadowBlur = fs * 0.6;
      g.fillText('✦ FIT CHECK ✦', fs * 0.7, fs * 0.6);
      const a = document.createElement('a');
      a.href = out.toDataURL('image/png');
      a.download = 'pip-fit-check.png';
      a.click();
    };
    pipImg.src = pip.snapshot();
    audio.play('shutter');
    verdict.textContent = 'Snap! Saved pip-fit-check.png 📸';
  });

  // drag to spin; a tap without much movement on Pip is a poke
  let down: { x: number; y: number; lx: number; ly: number; moved: number } | null = null;
  const toNdc = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }; };
  const poke = () => {
    pip.poke();
    audio.play('boing');
    voice.giggle(canvas);
  };
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0 };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const n = toNdc(e);
    pip.look(n.x, n.y);
    if (!down) return;
    const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
    down.lx = e.clientX; down.ly = e.clientY;
    down.moved += Math.abs(dx) + Math.abs(dy);
    pip.spinBy(dx * 0.012, dy * 0.004);
    if (down.moved > 6) { spinBtn.setAttribute('aria-pressed', 'false'); }
  });
  const up = (e: PointerEvent) => {
    if (down && down.moved < 8) { const n = toNdc(e); if (pip.hit(n.x, n.y)) poke(); }
    down = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { down = null; });
  canvas.addEventListener('pointerleave', () => { if (!down) pip.look(0, 0); });
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); pip.spinBy(e.key === 'ArrowLeft' ? -0.12 : 0.12); spinBtn.setAttribute('aria-pressed', 'false'); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(); }
  });

  // size + only render while visible
  const fitSize = () => { const r = stage.getBoundingClientRect(); if (r.width && r.height) pip.resize(r.width, r.height); };
  fitSize(); // size straight away; the observer keeps it right afterwards
  const ro = new ResizeObserver(fitSize);
  ro.observe(stage);
  const io = new IntersectionObserver(([en]) => { if (en.isIntersecting && !document.hidden) pip.start(); else pip.stop(); });
  io.observe(stage);
  const vis = () => { if (document.hidden) pip.stop(); else pip.start(); };
  document.addEventListener('visibilitychange', vis);
  pip.start();
  window.setTimeout(() => { if (canvas.isConnected) voice.bubble('Fit check! Spin me round!', canvas); }, 700);

  return () => {
    ro.disconnect(); io.disconnect();
    document.removeEventListener('visibilitychange', vis);
    pip.dispose();
  };
}

const feature: Feature = {
  id: 'fitcheck',
  priority: 'could',
  apps: [{ id: 'fitcheck', title: 'Fit Check.exe', icon: 'pip-pixel', width: 560, height: 640, mount }],
  startMenu: [{ id: 'fitcheck', label: 'Fit Check (3D)', icon: 'pip-pixel', group: 'programs', order: 7, run: () => bus.emit('app:open', 'fitcheck') }],
};

export default feature;
