import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { url } from '../core/assets';
import { isTouch, reducedMotion } from '../core/a11y';
import { store } from '../core/store';

/**
 * Dream Delivery Route (Tier 2): a golden path draws itself across the map as you scroll,
 * Pip flies along its tip, and each house lights up as Pip passes it.
 */

type Pt = [number, number];

/** Smooth path through the points (Catmull-Rom → cubic Bézier), in 0–100 units. */
function curve(pts: Pt[]): string {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function initRoute(lightStop: (b: HTMLButtonElement) => void): void {
  const route = document.getElementById('route');
  if (!route) return;
  const stops = [...route.querySelectorAll<HTMLButtonElement>('.stop')];
  const pts: Pt[] = stops.map((b) => {
    const li = b.parentElement as HTMLElement;
    return [parseFloat(li.style.getPropertyValue('--x')), parseFloat(li.style.getPropertyValue('--y'))];
  });
  const all: Pt[] = [[3, 86], ...pts, [97, 30]];

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'route-svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path class="route-glow"/><path class="route-line"/>';
  route.querySelector('.stops')!.before(svg);
  const lines = [...svg.querySelectorAll<SVGPathElement>('path')];

  const flyer = document.createElement('img');
  flyer.className = 'route-pip';
  flyer.src = url('pip-flying', 512);
  flyer.alt = '';
  flyer.setAttribute('aria-hidden', 'true');
  route.appendChild(flyer);

  // The path is built in real pixels (so the draw-on dash works) and rebuilt on resize.
  let len = 1;
  let stopAt: number[] = [];
  let progress = 0;
  const build = () => {
    const W = route.clientWidth, H = route.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const px = all.map(([x, y]) => [(x / 100) * W, (y / 100) * H] as Pt);
    const d = curve(px);
    lines.forEach((l) => l.setAttribute('d', d));
    len = lines[1].getTotalLength() || 1;
    lines.forEach((l) => { l.style.strokeDasharray = `${len}`; });
    stopAt = pts.map(([x, y]) => {
      const tx = (x / 100) * W, ty = (y / 100) * H;
      let best = 0, bd = Infinity;
      for (let s = 0; s <= 240; s++) {
        const q = lines[1].getPointAtLength((len * s) / 240);
        const dd = Math.hypot(q.x - tx, q.y - ty);
        if (dd < bd) { bd = dd; best = s / 240; }
      }
      return best;
    });
    place(progress);
  };

  const place = (t: number) => {
    progress = t;
    const off = len * (1 - t);
    lines.forEach((l) => { l.style.strokeDashoffset = `${off}`; });
    const p = lines[1].getPointAtLength(len * t);
    const ahead = lines[1].getPointAtLength(Math.min(len, len * t + 12));
    flyer.style.left = `${p.x}px`;
    flyer.style.top = `${p.y}px`;
    flyer.style.setProperty('--tilt', `${Math.max(-25, Math.min(25, Math.atan2(ahead.y - p.y, ahead.x - p.x) * 57))}deg`);
    stopAt.forEach((at, i) => { if (t >= at - 0.01 && !stops[i].classList.contains('done')) lightStop(stops[i]); });
  };
  new ResizeObserver(build).observe(route);
  build();

  const setup = () => {
    ScrollTrigger.getById('route-fly')?.kill();
    if (reducedMotion()) { place(1); return; }
    place(0);
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.create({
      id: 'route-fly',
      trigger: route,
      start: 'top top',
      end: isTouch() ? '+=90%' : '+=140%',
      pin: true,
      scrub: 0.4,
      onUpdate: (self) => place(self.progress),
    });
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  };
  setup();
  store.on('motion.reduced', setup);
}
