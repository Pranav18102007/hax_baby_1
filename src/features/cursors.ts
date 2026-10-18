import type { Feature } from '../core/registry';
import { store } from '../core/store';
import { isTouch } from '../core/a11y';

/**
 * A different cursor in every scene (desktop only): a wand on the hero, a heart in "Who is Pip",
 * a shooting star in the story, a music note in the lab, a rattle in the playroom, and so on.
 * Buttons and links keep the normal pointer so it's always clear what can be clicked.
 * When the C01 pixel cursors arrive they live in /cursors/*.png and win over these drawings.
 */

const O = '#3b2a5c'; // plum outline
const svg = (body: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>${body}</svg>`)}")`;

const STAR = (cx: number, cy: number, r: number, fill: string) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ');
  return `<polygon points='${pts}' fill='${fill}' stroke='${O}' stroke-width='1.5' stroke-linejoin='round'/>`;
};

const CURSORS: Record<string, { body: string; hx: number; hy: number }> = {
  hero: { hx: 7, hy: 7, body: `<path d='M10 10L28 28' stroke='${O}' stroke-width='5' stroke-linecap='round'/><path d='M10 10L28 28' stroke='#f6b5c8' stroke-width='2.5' stroke-linecap='round'/>${STAR(7, 7, 6.5, '#f3d27a')}` },
  about: { hx: 4, hy: 4, body: `<path d='M16 28C4 20 2 13 6 9s9-2 10 2c1-4 6-6 10-2s2 11-10 19z' fill='#f6b5c8' stroke='${O}' stroke-width='1.6'/><path d='M3 3l6 2-4 4z' fill='${O}'/>` },
  story: { hx: 6, hy: 6, body: `<path d='M9 9L27 20M9 9L22 26' stroke='#ffd98a' stroke-width='3' stroke-linecap='round' opacity='.8'/>${STAR(7, 7, 6.5, '#fff1c4')}` },
  dome: { hx: 16, hy: 16, body: `${STAR(16, 16, 10, '#f3d27a')}<circle cx='16' cy='16' r='2' fill='#fff5e8'/>` },
  lab: { hx: 5, hy: 5, body: `<path d='M12 6v15' stroke='${O}' stroke-width='2.5'/><path d='M12 6l11-3v15' fill='none' stroke='${O}' stroke-width='2.5'/><ellipse cx='9' cy='22' rx='4.5' ry='3.5' fill='#f3d27a' stroke='${O}' stroke-width='1.5'/><ellipse cx='20' cy='19' rx='4.5' ry='3.5' fill='#f6b5c8' stroke='${O}' stroke-width='1.5'/><path d='M2 2l6 2-4 4z' fill='${O}'/>` },
  toys: { hx: 4, hy: 4, body: `<path d='M15 15L26 26' stroke='${O}' stroke-width='4.5' stroke-linecap='round'/><path d='M15 15L26 26' stroke='#c9b6e4' stroke-width='2' stroke-linecap='round'/><circle cx='11' cy='11' r='8' fill='#bfe8d6' stroke='${O}' stroke-width='1.6'/><circle cx='9' cy='9' r='2' fill='#fff5e8'/><circle cx='13' cy='13' r='1.5' fill='#f6b5c8'/>` },
  route: { hx: 3, hy: 3, body: `<path d='M3 3l26 9-11 3-3 11z' fill='#fff5e8' stroke='${O}' stroke-width='1.6' stroke-linejoin='round'/><path d='M18 15L3 3' stroke='#c9b6e4' stroke-width='1.2'/>` },
  guestbook: { hx: 3, hy: 29, body: `<path d='M4 28C8 16 16 6 29 3c-3 13-13 21-25 25z' fill='#fff5e8' stroke='${O}' stroke-width='1.6'/><path d='M4 28L20 12' stroke='#c9b6e4' stroke-width='1.4'/><path d='M3 29l3-5 2 2z' fill='${O}'/>` },
  dawn: { hx: 6, hy: 6, body: `<path d='M20 4a12 12 0 1 0 8 18A10 10 0 1 1 20 4z' fill='#fff1c4' stroke='${O}' stroke-width='1.6'/><text x='3' y='12' font-family='monospace' font-weight='bold' font-size='9' fill='#c9b6e4' stroke='${O}' stroke-width='.4'>z</text>` },
};

const feature: Feature = {
  id: 'cursors',
  priority: 'could',
  init() {
    if (isTouch()) return;
    const root = document.documentElement;
    // C01 pixel cursors (public/cursors/c1..c9.png, tip at ~3,2) by scene; the SVG drawings stay as the fallback
    const PIXEL: Record<string, number> = { hero: 1, about: 2, story: 3, dome: 3, lab: 4, nightlights: 5, toys: 6, route: 7, guestbook: 8, dawn: 9 };
    const compiled = new Map<string, string>(Object.keys(PIXEL).map((k) => {
      const c = CURSORS[k] ?? CURSORS.dome;
      return [k, `url("/cursors/c${PIXEL[k]}.png") 3 2, ${svg(c.body)} ${c.hx} ${c.hy}, auto`];
    }));
    const apply = () => {
      const s = store.get('chaos.active') ? '' : store.get('section.current');
      const c = compiled.get(s) ?? '';
      if (c) root.style.setProperty('--cur', c); else root.style.removeProperty('--cur');
    };
    store.on('section.current', apply);
    store.on('chaos.active', apply);
    apply();
  },
};

export default feature;
