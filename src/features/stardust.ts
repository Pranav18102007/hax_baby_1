import type { Feature } from '../core/registry';
import { audio } from '../core/audio';
import { isTouch, reducedMotion } from '../core/a11y';

/**
 * The reel-1 signature moment: each workshop object assembles itself out of stardust
 * when its room scrolls into view (lantern, music box, block). Canvas 2D, fewer particles on phones.
 */

function assemble(img: HTMLImageElement): void {
  const host = img.closest<HTMLElement>('.room');
  if (!host || !img.complete || !img.naturalWidth) return;
  const r = img.getBoundingClientRect();
  const hr = host.getBoundingClientRect();
  const W = Math.round(r.width), H = Math.round(r.height);
  if (W < 20 || H < 20) return;

  // sample the image at its displayed size
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const octx = off.getContext('2d', { willReadFrequently: true });
  if (!octx) return;
  octx.drawImage(img, 0, 0, W, H);
  let data: Uint8ClampedArray;
  try { data = octx.getImageData(0, 0, W, H).data; } catch { return; }

  const target = isTouch() ? 600 : 1500;
  const stepGuess = Math.max(2, Math.round(Math.sqrt((W * H * 0.55) / target)));
  const parts: { tx: number; ty: number; x: number; y: number; c: string; d: number }[] = [];
  for (let y = 0; y < H; y += stepGuess) {
    for (let x = 0; x < W; x += stepGuess) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 140) continue;
      const a = Math.random() * Math.PI * 2, rad = 120 + Math.random() * 220;
      parts.push({ tx: x, ty: y, x: x + Math.cos(a) * rad, y: y + Math.sin(a) * rad - 60, c: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`, d: Math.random() * 0.35 });
    }
  }

  const pad = 260;
  const cv = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.className = 'stardust';
  cv.width = (W + pad * 2) * dpr; cv.height = (H + pad * 2) * dpr;
  cv.style.width = `${W + pad * 2}px`; cv.style.height = `${H + pad * 2}px`;
  cv.style.left = `${r.left - hr.left - pad}px`;
  cv.style.top = `${r.top - hr.top - pad}px`;
  host.appendChild(cv);
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  img.classList.add('assembling');
  audio.play('sparkle');

  const DUR = 1300;
  const t0 = performance.now();
  const sz = stepGuess + 0.6;
  const frame = (now: number) => {
    const t = (now - t0) / DUR;
    ctx.clearRect(0, 0, W + pad * 2, H + pad * 2);
    for (const p of parts) {
      const k = Math.min(1, Math.max(0, (t - p.d) / (1 - p.d)));
      const e = 1 - Math.pow(1 - k, 3);
      const x = p.x + (p.tx - p.x) * e + pad, y = p.y + (p.ty - p.y) * e + pad;
      ctx.globalAlpha = 0.25 + 0.75 * e;
      ctx.fillStyle = e < 0.75 ? '#ffe7a0' : p.c;
      ctx.fillRect(x, y, sz, sz);
    }
    if (t < 1.05) requestAnimationFrame(frame);
    else {
      img.classList.remove('assembling');
      cv.classList.add('fade');
      window.setTimeout(() => cv.remove(), 500);
    }
  };
  requestAnimationFrame(frame);
}

const feature: Feature = {
  id: 'stardust',
  priority: 'should',
  init() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting || reducedMotion()) return;
        const img = e.target as HTMLImageElement;
        io.unobserve(img);
        const go = () => assemble(img);
        if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', go, { once: true });
      });
    }, { threshold: 0.6 });
    document.querySelectorAll<HTMLImageElement>('.room-object img').forEach((img) => {
      img.loading = 'eager'; // decoded before it scrolls in, so the dust has something to become
      io.observe(img);
    });
  },
};

export default feature;
