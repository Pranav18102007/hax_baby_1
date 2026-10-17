import manifest from '../content/assets.json';

interface Entry { w: number; h: number; sizes: number[] }
const M = manifest as Record<string, Entry>;
const BASE = '/assets/img/';

/** URL of the smallest size of `name` whose longest side is at least `want` px. */
export function url(name: string, want = 9999): string {
  const e = M[name];
  if (!e) return '';
  if (!e.sizes.length) return `${BASE}${name}.webp`;
  const sorted = [...e.sizes].sort((a, b) => a - b);
  const pick = sorted.find((s) => s >= want) ?? sorted[sorted.length - 1];
  return `${BASE}${name}-${pick}.webp`;
}

/** srcset with width descriptors for responsive <img>. */
export function srcset(name: string): string {
  const e = M[name];
  if (!e || !e.sizes.length) return '';
  const longest = Math.max(e.w, e.h);
  return e.sizes
    .map((s) => `${BASE}${name}-${s}.webp ${Math.round((e.w * Math.min(s, longest)) / longest)}w`)
    .join(', ');
}

export function ratio(name: string): number {
  const e = M[name];
  return e ? e.w / e.h : 1;
}

/**
 * Fill every <img data-img="name" data-sizes="…"> in the page from the manifest,
 * so markup stays readable and sizes never drift from the processed files.
 */
export function hydrateImages(root: ParentNode = document): void {
  root.querySelectorAll<HTMLImageElement>('img[data-img]').forEach((img) => {
    const name = img.dataset.img!;
    const set = srcset(name);
    if (set) { img.srcset = set; img.sizes = img.dataset.sizes || '100vw'; }
    img.src = url(name, Number(img.dataset.want) || 900);
    const e = M[name];
    if (e && !img.hasAttribute('width')) { img.width = e.w; img.height = e.h; }
    if (!img.hasAttribute('loading')) img.loading = 'lazy';
    img.decoding = 'async';
  });
}

/** Resolve when the given images have loaded (or failed), with progress callbacks. */
export function preload(imgs: HTMLImageElement[], onProgress: (p: number) => void): Promise<void> {
  let done = 0;
  const total = imgs.length || 1;
  return new Promise((resolve) => {
    if (!imgs.length) { onProgress(1); resolve(); return; }
    const tick = () => { done++; onProgress(done / total); if (done >= total) resolve(); };
    imgs.forEach((img) => {
      if (img.complete && img.naturalWidth) tick();
      else { img.addEventListener('load', tick, { once: true }); img.addEventListener('error', tick, { once: true }); }
    });
  });
}
