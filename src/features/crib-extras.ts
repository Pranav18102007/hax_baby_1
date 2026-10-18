import { audio } from '../core/audio';
import { voice } from '../core/voice';
import { url } from '../core/assets';
import { announce, reducedMotion } from '../core/a11y';
import { musicBoxNote, semitoneFreq } from '../core/music';
import { sparkleBurst } from '../scenes/hero';

/**
 * Extra things to do in the Secret Crib: a musical mobile, ghosts to tuck in, a wish jar,
 * a secret note from Pip, and the Catch the Falling Dreams mini-game.
 * Uses the round-2 art (crib-mobile, wish-jar, crib-note, dream orbs) when it exists; draws its own otherwise.
 */

const JAR_KEY = 'pip.wishjar';
const readJar = (): number => { try { return Number(localStorage.getItem(JAR_KEY)) || 0; } catch { return 0; } };
const writeJar = (n: number) => { try { localStorage.setItem(JAR_KEY, String(n)); } catch { /* private mode: the jar just forgets */ } };

const CHARMS = [
  { g: '☾', label: 'moon', note: 0 }, { g: '★', label: 'star', note: 4 }, { g: '☁', label: 'cloud', note: 7 },
  { g: '★', label: 'little star', note: 9 }, { g: '👻', label: 'ghost', note: 12 },
];

const NOTE = `Dear you,

If you found this, you know my secret room. Nobody else knows (except the ghosts, and they're asleep).

Thank you for visiting my workshop. I'm still very small and I'm still learning, but every night I try to make the dark a little cosier for someone.

Tonight, that someone is you.

Sweet dreams,
Pip ♡

P.S. Please don't tell anyone I'm scared of silence. It's embarrassing.`;

export function decorateCrib(el: HTMLElement): () => void {
  const cleanups: (() => void)[] = [];
  const art = (n: string, w = 512) => url(n, w);

  // ---------- the mobile ----------
  const mob = document.createElement('div');
  mob.className = 'crib-mobile';
  mob.innerHTML = `<span class="cm-ring" aria-hidden="true"></span>${CHARMS.map((c, i) =>
    `<button type="button" class="cm-charm c${i}" aria-label="Ring the ${c.label}" style="--i:${i}"><span class="cm-thread"></span><span class="cm-g">${c.g}</span></button>`).join('')}`;
  el.appendChild(mob);
  mob.querySelectorAll<HTMLButtonElement>('.cm-charm').forEach((b, i) => b.addEventListener('click', () => {
    musicBoxNote(semitoneFreq(CHARMS[i].note), undefined, undefined, 0.26);
    b.classList.remove('swing'); void b.offsetWidth; b.classList.add('swing');
  }));

  // ---------- tuck the ghosts in ----------
  const ghosts = [...el.querySelectorAll<HTMLButtonElement>('.crib-ghost')];
  const tucked = new Set<HTMLButtonElement>();
  ghosts.forEach((g, i) => {
    g.tabIndex = 0;
    g.setAttribute('aria-label', 'Tuck in a sleepy ghost');
    g.insertAdjacentHTML('beforeend', `<span class="blanket b${i + 1}" aria-hidden="true"></span><span class="sg-z" aria-hidden="true">z</span>`);
    g.addEventListener('click', () => {
      if (tucked.has(g)) return;
      tucked.add(g);
      g.classList.add('tucked');
      voice.say('V18', g, true);
      if (tucked.size === ghosts.length) { el.classList.add('all-tucked'); audio.play('sparkle'); announce('All the ghosts are tucked in.'); }
    }, { capture: true });
  });

  // ---------- the wish jar ----------
  const jarArt = art('wish-jar', 384);
  const jar = document.createElement('div');
  jar.className = 'crib-jar';
  jar.innerHTML = `
    <button type="button" class="jar-btn" aria-label="The wish jar">${jarArt ? `<img src="${jarArt}" alt="">` : '<span class="jar-glass" aria-hidden="true"><span class="jar-fill"></span><span class="jar-lid"></span></span>'}</button>
    <span class="jar-count" aria-live="polite"></span>
    <form class="jar-form" hidden><label for="jar-in" class="sr-only">Your wish</label><input id="jar-in" maxlength="60" placeholder="I wish…" autocomplete="off"><button class="os-button" type="submit">✦ Wish</button></form>`;
  el.appendChild(jar);
  const count = jar.querySelector<HTMLElement>('.jar-count')!;
  const form = jar.querySelector<HTMLFormElement>('.jar-form')!;
  const input = form.querySelector('input')!;
  const renderJar = () => {
    const n = readJar();
    count.textContent = n ? `${n} wish${n === 1 ? '' : 'es'} in the jar` : 'Make a wish';
    jar.style.setProperty('--fill', String(Math.min(1, n / 12)));
  };
  renderJar();
  jar.querySelector('.jar-btn')!.addEventListener('click', () => { form.hidden = !form.hidden; if (!form.hidden) { input.focus(); voice.say('V17', jar, true); } });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!input.value.trim()) { input.focus(); return; }
    writeJar(readJar() + 1);
    input.value = '';
    form.hidden = true;
    const r = jar.getBoundingClientRect();
    sparkleBurst(r.left + r.width / 2, r.top + 20, 14);
    audio.play('sparkle');
    jar.classList.remove('plink'); void jar.offsetWidth; jar.classList.add('plink');
    voice.bubble('Your wish is in the jar. I’ll keep it safe.', jar);
    renderJar();
  });

  // ---------- Pip's secret note ----------
  const noteArt = art('crib-note', 256);
  const note = document.createElement('button');
  note.type = 'button';
  note.className = 'crib-envelope';
  note.setAttribute('aria-label', 'A sealed note from Pip');
  note.innerHTML = noteArt ? `<img src="${noteArt}" alt="">` : '<span class="env" aria-hidden="true"><span class="env-seal">☾</span></span>';
  el.appendChild(note);
  const letter = document.createElement('div');
  letter.className = 'crib-letter';
  letter.hidden = true;
  letter.innerHTML = `<p class="letter-body"></p><button type="button" class="os-button" data-fold>Fold it back up</button>`;
  letter.querySelector('.letter-body')!.textContent = NOTE;
  el.appendChild(letter);
  note.addEventListener('click', () => { letter.hidden = false; audio.play('open'); (letter.querySelector('[data-fold]') as HTMLElement).focus(); });
  letter.querySelector('[data-fold]')!.addEventListener('click', () => { letter.hidden = true; audio.play('close'); note.focus(); });

  // ---------- Catch the Falling Dreams ----------
  const actions = el.querySelector('.crib-actions')!;
  const gameBtn = document.createElement('button');
  gameBtn.type = 'button';
  gameBtn.className = 'os-button';
  gameBtn.textContent = '☁ Catch the Falling Dreams';
  actions.insertBefore(gameBtn, actions.lastElementChild);
  gameBtn.addEventListener('click', () => cleanups.push(startGame(el)));

  return () => cleanups.forEach((c) => c());
}

/** 30 seconds: dream orbs drift down, catch them with a cloud. Nightmares cost a point. Mouse, finger or arrow keys. */
function startGame(crib: HTMLElement): () => void {
  const g = document.createElement('div');
  g.className = 'dream-game';
  g.setAttribute('role', 'application');
  g.setAttribute('aria-label', 'Catch the Falling Dreams. Move the cloud with the arrow keys or your pointer.');
  g.tabIndex = 0;
  g.innerHTML = `<div class="dg-hud"><span>Dreams caught: <b class="dg-score">0</b></span><span class="dg-time">30</span><button type="button" class="os-button" data-quit>✕ Stop</button></div>
    <div class="dg-field"><div class="dg-cloud" aria-hidden="true">☁</div></div>`;
  crib.appendChild(g);
  g.focus();
  const field = g.querySelector<HTMLElement>('.dg-field')!;
  const cloud = g.querySelector<HTMLElement>('.dg-cloud')!;
  const scoreEl = g.querySelector<HTMLElement>('.dg-score')!;
  const timeEl = g.querySelector<HTMLElement>('.dg-time')!;
  const ORBS = ['dream-orb-a', 'dream-orb-b', 'dream-orb-c'].map((n) => url(n, 128)).filter(Boolean);
  const GLYPHS = ['☾', '★', '☁', '♪', '♥'];
  let x = 0.5, score = 0, running = true, last = performance.now(), spawnIn = 0, ends = last + 30_000;
  const drops: { el: HTMLElement; x: number; y: number; v: number; bad: boolean }[] = [];
  const keys = new Set<string>();

  const onMove = (e: PointerEvent) => { const r = field.getBoundingClientRect(); x = Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width)); };
  field.addEventListener('pointermove', onMove);
  field.addEventListener('pointerdown', onMove);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); if (e.type === 'keydown') keys.add(e.key); else keys.delete(e.key); } };
  g.addEventListener('keydown', onKey);
  g.addEventListener('keyup', onKey);

  const end = (quit = false) => {
    if (!running) return;
    running = false;
    drops.forEach((d) => d.el.remove());
    g.querySelector('.dg-field')!.innerHTML = `<div class="dg-over"><p class="wordart">${score} dream${score === 1 ? '' : 's'}!</p><p>${score >= 15 ? 'Pip is SO impressed. Best dream-catcher in town.' : score >= 8 ? 'Lovely catching! The town will sleep well.' : 'Every dream counts. Try again?'}</p><button type="button" class="os-button" data-again>↻ Play again</button> <button type="button" class="os-button" data-done>Back to the crib</button></div>`;
    g.querySelector('[data-again]')?.addEventListener('click', () => { g.remove(); startGame(crib); });
    g.querySelector('[data-done]')?.addEventListener('click', () => g.remove());
    (g.querySelector('[data-again]') as HTMLElement | null)?.focus();
    if (!quit && score > 0) voice.say('V22', g, true);
    announce(`Game over. You caught ${score} dreams.`);
  };
  g.querySelector('[data-quit]')!.addEventListener('click', () => { end(true); g.remove(); });

  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min(50, now - last); last = now;
    if (keys.has('ArrowLeft')) x = Math.max(0.05, x - dt * 0.0011);
    if (keys.has('ArrowRight')) x = Math.min(0.95, x + dt * 0.0011);
    cloud.style.left = `${x * 100}%`;
    const left = Math.max(0, Math.ceil((ends - now) / 1000));
    timeEl.textContent = String(left);
    if (left <= 0) { end(); return; }
    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawnIn = 520 + Math.random() * 380;
      const bad = Math.random() < 0.18;
      const d = document.createElement('span');
      d.className = `dg-drop${bad ? ' bad' : ''}`;
      if (!bad && ORBS.length) d.innerHTML = `<img src="${ORBS[Math.floor(Math.random() * ORBS.length)]}" alt="">`;
      else d.textContent = bad ? '☁︎' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      field.appendChild(d);
      drops.push({ el: d, x: 0.06 + Math.random() * 0.88, y: -0.08, v: (reducedMotion() ? 0.00012 : 0.00018) + Math.random() * 0.00016, bad });
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += d.v * dt;
      d.el.style.left = `${d.x * 100}%`;
      d.el.style.top = `${d.y * 100}%`;
      if (d.y > 0.84 && d.y < 0.95 && Math.abs(d.x - x) < 0.09) {
        score = Math.max(0, score + (d.bad ? -1 : 1));
        scoreEl.textContent = String(score);
        audio.play(d.bad ? 'error' : 'chirp');
        d.el.remove(); drops.splice(i, 1);
      } else if (d.y > 1.05) { d.el.remove(); drops.splice(i, 1); }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return () => { running = false; g.remove(); };
}
