import type { Feature } from '../core/registry';
import { store } from '../core/store';
import { voice } from '../core/voice';
import { url } from '../core/assets';
import { isTouch, reducedMotion } from '../core/a11y';
import { scrollToY } from '../core/scroll';

/**
 * The scroll bar is a ladder, and a teddy climbs it as you scroll.
 * Scroll down fast and it opens a parachute; scroll up fast and it rides a rocket.
 * Desktop: it replaces the native scrollbar (drag the teddy or click a rung to jump).
 * Phone: a slim decorative ladder that never steals touches.
 * Art: uses T01 sprites (teddy-climb-a/b, teddy-parachute, teddy-rocket) when they exist, else draws its own teddy.
 */

type Pose = 'climb-a' | 'climb-b' | 'parachute' | 'rocket';

const BEAR = `
  <g class="tb-bear">
    <circle cx="20" cy="9" r="4.2" fill="#c9b6e4"/><circle cx="44" cy="9" r="4.2" fill="#c9b6e4"/>
    <circle cx="20" cy="9" r="2" fill="#f6b5c8"/><circle cx="44" cy="9" r="2" fill="#f6b5c8"/>
    <ellipse cx="32" cy="38" rx="13" ry="14" fill="#c9b6e4"/>
    <ellipse cx="32" cy="41" rx="7.5" ry="8.5" fill="#fff5e8"/>
    <path d="M32 37.2l1.2 2.5 2.7.3-2 1.8.6 2.7-2.5-1.4-2.5 1.4.6-2.7-2-1.8 2.7-.3z" fill="#f3d27a"/>
    <circle cx="32" cy="18" r="12" fill="#c9b6e4"/>
    <ellipse cx="32" cy="22" rx="5.6" ry="4.4" fill="#fff5e8"/>
    <circle cx="27.5" cy="16.5" r="1.7" fill="#3b2a5c"/><circle cx="36.5" cy="16.5" r="1.7" fill="#3b2a5c"/>
    <ellipse cx="32" cy="20.6" rx="1.6" ry="1.1" fill="#3b2a5c"/>
    <circle cx="25" cy="21" r="1.6" fill="#f6b5c8" opacity=".7"/><circle cx="39" cy="21" r="1.6" fill="#f6b5c8" opacity=".7"/>
    <path d="M21 12c2-8 16-11 22-2-3 1-6 0-8 1-5-1-10 0-14 1z" fill="#f6b5c8"/><circle cx="45" cy="9" r="2.6" fill="#fff5e8"/>
  </g>`;

const LIMBS: Record<'climb-a' | 'climb-b', string> = {
  'climb-a': `<ellipse cx="20" cy="27" rx="3.6" ry="6" transform="rotate(25 20 27)" fill="#b9a3dc"/><ellipse cx="45" cy="34" rx="3.6" ry="6" transform="rotate(-20 45 34)" fill="#b9a3dc"/>
              <ellipse cx="25" cy="52" rx="4.2" ry="3.4" fill="#b9a3dc"/><ellipse cx="40" cy="48" rx="4.2" ry="3.4" fill="#b9a3dc"/>`,
  'climb-b': `<ellipse cx="19" cy="34" rx="3.6" ry="6" transform="rotate(20 19 34)" fill="#b9a3dc"/><ellipse cx="44" cy="27" rx="3.6" ry="6" transform="rotate(-25 44 27)" fill="#b9a3dc"/>
              <ellipse cx="24" cy="48" rx="4.2" ry="3.4" fill="#b9a3dc"/><ellipse cx="39" cy="52" rx="4.2" ry="3.4" fill="#b9a3dc"/>`,
};

function svgPose(pose: Pose): string {
  if (pose === 'climb-a' || pose === 'climb-b') return `<svg viewBox="0 0 64 64">${LIMBS[pose]}${BEAR}</svg>`;
  if (pose === 'parachute') {
    return `<svg viewBox="0 -40 64 104">
      <path d="M4 -10a28 24 0 0 1 56 0z" fill="#f6b5c8"/><path d="M4 -10a28 24 0 0 1 18.7 -21.5L22 -10z" fill="#c9b6e4"/><path d="M41.3 -31.5a28 24 0 0 1 18.7 21.5H42z" fill="#f3d27a"/>
      <path d="M4 -10q4 -3 9 0q4 -3 9 0q5 -3 10 0q5 -3 10 0q4 -3 9 0q4 -3 9 0" fill="none" stroke="#fff5e8" stroke-width="1.5"/>
      <path d="M5 -9L22 24M59 -9L42 24M23 -9L28 22M41 -9L36 22" stroke="#fff5e8" stroke-width="1"/>
      <ellipse cx="22" cy="26" rx="3.4" ry="5.6" fill="#b9a3dc"/><ellipse cx="42" cy="26" rx="3.4" ry="5.6" fill="#b9a3dc"/>
      <ellipse cx="25" cy="52" rx="4" ry="3.4" fill="#b9a3dc"/><ellipse cx="39" cy="52" rx="4" ry="3.4" fill="#b9a3dc"/>${BEAR}</svg>`;
  }
  return `<svg viewBox="0 0 64 104">
    <ellipse cx="18" cy="40" rx="3.6" ry="5.6" transform="rotate(-30 18 40)" fill="#b9a3dc"/><ellipse cx="46" cy="40" rx="3.6" ry="5.6" transform="rotate(30 46 40)" fill="#b9a3dc"/>
    ${BEAR}
    <g transform="translate(0 46)"><path d="M32 0c9 6 12 18 10 34H22C20 18 23 6 32 0z" fill="#f3d27a"/><circle cx="32" cy="16" r="5" fill="#bfe8d6" stroke="#fff5e8" stroke-width="2"/>
    <path d="M22 26l-7 10 8-2zM42 26l7 10-8-2z" fill="#f6b5c8"/>
    <path class="tb-flame" d="M25 34q7 20 7 22q0 -2 7 -22z" fill="#ffc873"/><path class="tb-flame" d="M28 34q4 12 4 14q0 -2 4 -14z" fill="#fff5e8"/></g></svg>`;
}

const ART: Record<Pose, string> = { 'climb-a': 'teddy-climb-a', 'climb-b': 'teddy-climb-b', parachute: 'teddy-parachute', rocket: 'teddy-rocket' };

const feature: Feature = {
  id: 'teddy',
  priority: 'should',
  init() {
    const touch = isTouch();
    const root = document.createElement('div');
    root.className = `ladder${touch ? ' phone' : ''}`;
    root.setAttribute('aria-hidden', 'true'); // decorative: keyboard and screen readers scroll the page as usual
    const poses = (Object.keys(ART) as Pose[]).map((p) => {
      const art = url(ART[p], 256);
      return `<span class="teddy-pose tp-${p}">${art ? `<img src="${art}" alt="" draggable="false">` : svgPose(p)}</span>`;
    }).join('');
    root.innerHTML = `<div class="ladder-rails"></div><div class="teddy" data-pose="climb-a">${poses}</div>`;
    document.body.appendChild(root);
    document.documentElement.classList.toggle('ladder-scroll', !touch);
    const teddy = root.querySelector<HTMLElement>('.teddy')!;

    let lastY = window.scrollY, lastT = performance.now(), fastUntil = 0, fastPose: Pose | null = null;
    let steps = 0, pose: Pose = 'climb-a';
    let sayDown = 0, sayUp = 0;

    const setPose = (p: Pose) => { if (p !== pose) { pose = p; teddy.dataset.pose = p; } };
    const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

    const update = () => {
      const now = performance.now();
      const y = window.scrollY;
      const dt = Math.max(1, now - lastT);
      const v = (y - lastY) / dt; // px per ms
      const p = Math.min(1, Math.max(0, y / maxScroll()));
      root.style.setProperty('--p', p.toFixed(4));
      if (!reducedMotion() && Math.abs(v) > 2.4) {
        fastPose = v > 0 ? 'parachute' : 'rocket';
        fastUntil = now + 450;
        if (fastPose === 'parachute' && now > sayDown) { sayDown = now + 60_000; voice.say('V13', teddy); }
        if (fastPose === 'rocket' && now > sayUp) { sayUp = now + 60_000; voice.say('V14', teddy); }
      }
      if (now < fastUntil && fastPose) setPose(fastPose);
      else if (Math.abs(y - lastY) > 0) {
        steps += Math.abs(y - lastY);
        if (steps > 70) { steps = 0; setPose(pose === 'climb-a' ? 'climb-b' : 'climb-a'); }
        else if (pose !== 'climb-a' && pose !== 'climb-b') setPose('climb-a');
      }
      lastY = y; lastT = now;
    };
    window.addEventListener('scroll', update, { passive: true });
    // settle back to climbing once a fast scroll stops
    window.setInterval(() => { if (performance.now() > fastUntil && (pose === 'parachute' || pose === 'rocket')) setPose('climb-a'); }, 250);
    update();

    // desktop: the ladder works as a scrollbar
    if (!touch) {
      let dragging = false;
      const jump = (clientY: number) => {
        const r = root.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
        scrollToY(p * maxScroll(), dragging);
      };
      root.addEventListener('pointerdown', (e) => { dragging = true; root.setPointerCapture(e.pointerId); root.classList.add('drag'); jump(e.clientY); });
      root.addEventListener('pointermove', (e) => { if (dragging) jump(e.clientY); });
      const end = () => { dragging = false; root.classList.remove('drag'); };
      root.addEventListener('pointerup', end);
      root.addEventListener('pointercancel', end);
    }
    const hide = () => { root.hidden = store.get('chaos.active'); };
    store.on('chaos.active', hide);
  },
};

export default feature;
