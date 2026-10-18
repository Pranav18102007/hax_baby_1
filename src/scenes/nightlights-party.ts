import { audio, musicBoxNote } from '../core/audio';
import { voice } from '../core/voice';
import { store } from '../core/store';
import { announce, reducedMotion } from '../core/a11y';
import { SONGS, semitoneFreq } from '../core/music';

/**
 * The Nightlight Collection comes alive: every lamp you find does its own trick
 * (spores, escaping stars, a jellyfish that swims off round the room, sparkle rain, a ghost that says boo,
 * a moon that pops out of its bottle). Find all six and the gallery throws a Nap Party: spinning light beams,
 * dancing lamps and a double-time Frère Jacques on the music box.
 */

let room: HTMLElement | null = null;
let fx: HTMLElement | null = null;

function at(lamp: HTMLElement): { x: number; y: number; w: number; h: number } {
  const r = lamp.getBoundingClientRect(), rr = room!.getBoundingClientRect();
  return { x: r.left - rr.left + r.width / 2, y: r.top - rr.top + r.height / 2, w: r.width, h: r.height };
}

function spawn(cls: string, x: number, y: number, html = '', life = 2400): HTMLElement {
  const el = document.createElement('span');
  el.className = `nl-fx ${cls}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.innerHTML = html;
  fx!.appendChild(el);
  if (life) window.setTimeout(() => el.remove(), life);
  return el;
}

const TRICKS: ((lamp: HTMLElement) => void)[] = [
  // 0 Mushroom Snoozelight: boing + glowing spores
  (lamp) => {
    const p = at(lamp);
    lamp.classList.add('nl-boing');
    audio.play('boing');
    for (let i = 0; i < 10; i++) { const sp = spawn('nl-spore', p.x + (Math.random() - 0.5) * p.w, p.y, '', 2600); sp.style.setProperty('--d', `${i * 0.08}s`); sp.style.setProperty('--sx', `${(Math.random() - 0.5) * 80}px`); }
  },
  // 1 Star Jar: the stars escape and stick to the ceiling
  (lamp) => {
    const p = at(lamp);
    audio.play('sparkle');
    for (let i = 0; i < 9; i++) {
      const s = spawn('nl-star', p.x, p.y - p.h * 0.3, '★', 0);
      s.style.setProperty('--tx', `${(Math.random() - 0.5) * room!.clientWidth * 0.7}px`);
      s.style.setProperty('--ty', `${-p.y + 40 + Math.random() * room!.clientHeight * 0.18}px`);
      s.style.setProperty('--d', `${i * 0.07}s`);
    }
  },
  // 2 Jellyfish Lamp: swims off round the room (tap it)
  (lamp) => {
    const p = at(lamp);
    const img = lamp.cloneNode(true) as HTMLImageElement;
    img.removeAttribute('data-lamp');
    img.className = 'nl-jelly-img';
    const j = document.createElement('button');
    j.type = 'button';
    j.className = 'nl-fx nl-jelly';
    j.setAttribute('aria-label', 'The jellyfish lamp, swimming');
    j.style.left = `${p.x}px`; j.style.top = `${p.y}px`;
    j.appendChild(img);
    fx!.appendChild(j);
    j.addEventListener('click', () => { voice.bubble('blub blub! (that means hi)', j); audio.play('pop'); });
    lamp.classList.add('nl-gone');
  },
  // 3 Cloud Nap Lamp: sparkle rain
  (lamp) => {
    const p = at(lamp);
    audio.play('shimmer');
    for (let i = 0; i < 24; i++) spawn('nl-drop', p.x + (Math.random() - 0.5) * p.w * 0.9, p.y + p.h * 0.1, '', 1800).style.setProperty('--d', `${(i % 12) * 0.12}s`);
  },
  // 4 Ghost Candle: boo!
  (lamp) => {
    lamp.classList.add('nl-hop');
    audio.play('boing');
    voice.bubble('boo! …was that scary? I tried.', lamp);
  },
  // 5 Moon in a Bottle: pop goes the cork, out flies the moon
  (lamp) => {
    const p = at(lamp);
    audio.play('pop');
    window.setTimeout(() => audio.play('chime'), 250);
    const m = spawn('nl-moon', p.x, p.y - p.h * 0.4, '☾', 0);
    m.style.setProperty('--tx', `${room!.clientWidth * 0.82 - p.x}px`);
    m.style.setProperty('--ty', `${70 - p.y}px`);
  },
];

let partyTimer = 0;

function party(): void {
  if (!room || room.classList.contains('nl-party')) return;
  room.classList.add('nl-party');
  announce('All six nightlights found. Nap party!');
  voice.say('V29', room, true);
  const ctx = audio.ctx;
  if (ctx && !store.get('sound.muted')) {
    const song = SONGS.find((s) => s.id === 'jacques')!;
    const spb = 60 / 168;
    let t = ctx.currentTime + 0.15;
    for (const [n, d] of song.notes) { if (n !== null) musicBoxNote(semitoneFreq(n), t, undefined, 0.2); t += d * spb; }
  }
  window.clearTimeout(partyTimer);
  partyTimer = window.setTimeout(() => room?.classList.remove('nl-party'), reducedMotion() ? 3000 : 11_000);
}

export function initNightlightTricks(): void {
  room = document.querySelector<HTMLElement>('.room-dark');
  if (!room) return;
  fx = document.createElement('div');
  fx.className = 'nl-fx-layer';
  room.appendChild(fx);
  room.insertAdjacentHTML('beforeend', '<div class="nl-beams" aria-hidden="true"></div>');
  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'os-button nl-again';
  again.textContent = '🪩 Nap party!';
  again.hidden = true;
  room.querySelector('.plate-row')?.appendChild(again);
  again.addEventListener('click', party);
}

/** Called by the scene when a lamp switches on (index = which lamp, found = how many so far). */
export function lampTrick(lamp: HTMLElement, index: number, found: number, quiet = false): void {
  if (!room || !fx) return;
  if (!quiet && !reducedMotion()) TRICKS[index]?.(lamp);
  if (found === 6) {
    room.querySelector<HTMLElement>('.nl-again')!.hidden = false;
    window.setTimeout(party, quiet ? 200 : 900);
  }
}
