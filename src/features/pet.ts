import type { Feature } from '../core/registry';
import { store } from '../core/store';
import { audio } from '../core/audio';
import { voice } from '../core/voice';
import { isTouch, reducedMotion } from '../core/a11y';

/**
 * The ghost kitten: a 90s desktop pet. Desktop: floats after the pointer, sits, naps when idle.
 * Stroke it (wiggle the pointer over it) to make it purr. Phone: lives on the taskbar; press and hold.
 * Frames in kitten-strip: 0-1 idle, 2-5 float, 6-7 sleep, 8-9 purr.
 */

const FRAMES = 10;
const ANIM = { idle: [0, 1], float: [2, 3, 4, 5], sleep: [6, 7], purr: [8, 9] } as const;
type Anim = keyof typeof ANIM;

const feature: Feature = {
  id: 'pet',
  priority: 'should',
  init() {
    const pet = document.createElement('button');
    pet.type = 'button';
    pet.className = 'pet';
    pet.setAttribute('aria-label', 'Ghost kitten');
    pet.innerHTML = '<span class="pet-sprite"></span><span class="pet-hearts" aria-hidden="true"></span>';
    document.body.appendChild(pet);
    const sprite = pet.querySelector<HTMLElement>('.pet-sprite')!;
    const hearts = pet.querySelector<HTMLElement>('.pet-hearts')!;
    const touch = isTouch();
    const SIZE = touch ? 52 : 64;
    pet.style.setProperty('--size', `${SIZE}px`);

    let anim: Anim = 'idle';
    let frameI = 0;
    let x = window.innerWidth - 120, y = window.innerHeight - 140;
    let tx = x, ty = y;
    let lastMove = performance.now();
    let purrUntil = 0;
    let facing = 1;

    const setFrame = (f: number) => { sprite.style.backgroundPosition = `${(f / (FRAMES - 1)) * 100}% 0`; };
    const apply = () => {
      pet.hidden = !store.get('pet.enabled') || store.get('chaos.active');
    };
    apply();
    store.on('pet.enabled', apply);
    store.on('chaos.active', apply);

    const purr = () => {
      if (performance.now() < purrUntil) return;
      purrUntil = performance.now() + 2200;
      audio.play('purr');
      hearts.classList.remove('go'); void hearts.offsetWidth; hearts.classList.add('go');
      voice.giggle(pet);
    };

    // stroking: lots of pointer movement over the kitten within a second
    let strokeDist = 0, strokeStart = 0, lx = 0, ly = 0;
    pet.addEventListener('pointermove', (e) => {
      if (touch) return;
      const now = performance.now();
      if (now - strokeStart > 1000) { strokeStart = now; strokeDist = 0; }
      strokeDist += Math.hypot(e.clientX - lx, e.clientY - ly);
      lx = e.clientX; ly = e.clientY;
      if (strokeDist > 260) { strokeDist = 0; purr(); }
    });
    // phone: press and hold
    let hold = 0;
    pet.addEventListener('pointerdown', () => { hold = window.setTimeout(purr, 600); });
    pet.addEventListener('pointerup', () => window.clearTimeout(hold));
    pet.addEventListener('pointerleave', () => window.clearTimeout(hold));
    pet.addEventListener('click', () => {
      if (performance.now() < purrUntil) return;
      pet.classList.remove('hop'); void pet.offsetWidth; pet.classList.add('hop');
      audio.play('chirp');
    });

    if (!touch) {
      window.addEventListener('pointermove', (e) => {
        if (e.target === pet || pet.contains(e.target as Node)) return;
        tx = e.clientX + 28; ty = e.clientY + 18;
        lastMove = performance.now();
      }, { passive: true });
    }

    const taskbarH = () => (document.getElementById('taskbar')?.offsetHeight ?? 56);
    let raf = 0, tick = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (pet.hidden) return;
      const still = touch || reducedMotion();
      if (still) {
        // sit on the right end of the taskbar
        x = window.innerWidth - SIZE - 8;
        y = window.innerHeight - taskbarH() - SIZE + 6;
      } else {
        const dx = tx - x, dy = ty - y;
        const d = Math.hypot(dx, dy);
        if (d > 60) { x += dx * 0.016; y += dy * 0.016; if (Math.abs(dx) > 2) facing = dx > 0 ? 1 : -1; }
        x = Math.max(4, Math.min(window.innerWidth - SIZE - 4, x));
        y = Math.max(4, Math.min(window.innerHeight - taskbarH() - SIZE, y));
      }
      const moving = !still && Math.hypot(tx - x, ty - y) > 64;
      const next: Anim = now < purrUntil ? 'purr' : moving ? 'float' : now - lastMove > 10000 ? 'sleep' : 'idle';
      if (next !== anim) { anim = next; frameI = 0; }
      if (++tick % (anim === 'float' ? 13 : 26) === 0) frameI++;
      const fr = ANIM[anim];
      setFrame(fr[frameI % fr.length]);
      pet.style.transform = `translate(${x}px, ${y}px)`;
      sprite.style.transform = `scaleX(${facing})`;
    };
    raf = requestAnimationFrame(loop);
    void raf;
  },
};

export default feature;
