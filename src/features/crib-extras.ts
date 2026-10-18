import { audio } from '../core/audio';
import { store } from '../core/store';
import { voice } from '../core/voice';
import { url } from '../core/assets';
import { announce, reducedMotion } from '../core/a11y';
import { musicBoxNote, semitoneFreq } from '../core/music';
import { sparkleBurst } from '../scenes/hero';
import { paintBlankets } from '../scenes/story';

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
  const mobArt = art('crib-mobile', 512);
  if (mobArt) {
    mob.classList.add('painted');
    mob.innerHTML = `<button type="button" class="cm-art" aria-label="Spin the musical mobile"><img src="${mobArt}" alt=""></button>`;
    const b = mob.querySelector<HTMLButtonElement>('.cm-art')!;
    b.addEventListener('click', () => {
      CHARMS.forEach((c, i) => musicBoxNote(semitoneFreq(c.note), (audio.ctx?.currentTime ?? 0) + 0.05 + i * 0.22, undefined, 0.24));
      b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin');
    });
  }
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
    paintBlankets(g);
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

/**
 * Catch the Falling Dreams: Pip flies along the bottom catching dream orbs.
 * Golden wish stars are worth 5, catches in a row build a combo (x2, x3), nightmares cost a heart.
 * 45 seconds, 3 hearts, it speeds up as you go, and your best score is remembered.
 * Mouse, finger or arrow keys.
 */
const BEST_KEY = 'pip.dreamgame.best';
const RANKS: [number, string][] = [[0, 'Dream Rookie'], [12, 'Night Courier'], [28, 'Star Catcher'], [50, 'Moon’s Favourite']];
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

function startGame(crib: HTMLElement): () => void {
  const g = document.createElement('div');
  g.className = 'dream-game';
  g.setAttribute('role', 'application');
  g.setAttribute('aria-label', 'Catch the Falling Dreams. Move Pip with the arrow keys or your pointer.');
  g.tabIndex = 0;
  const best = (() => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } })();
  g.innerHTML = `
    <div class="dg-hud">
      <span class="dg-hearts" aria-label="3 hearts left">♥♥♥</span>
      <span>Dreams: <b class="dg-score">0</b> <i class="dg-combo" hidden></i></span>
      <span class="dg-time">45</span>
      <button type="button" class="os-button" data-quit>✕ Stop</button>
    </div>
    <div class="dg-field">
      <div class="dg-stars"></div>
      <img class="dg-pip" src="${url('pip-flying', 256)}" alt="" draggable="false">
      <div class="dg-intro">
        <p class="wordart">Catch the Falling Dreams</p>
        <ul><li><img src="${url('dream-orb-a', 64)}" alt=""> dream = 1</li><li><img src="${url('wish-star', 64)}" alt=""> wish star = 5</li><li><img src="${url('blob-grump', 64)}" alt=""> nightmare = ouch!</li></ul>
        <p>Catch in a row for a combo. ${best ? `Best so far: <b>${best}</b>` : 'Move with your mouse, finger or ← →.'}</p>
        <p class="dg-count">3</p>
      </div>
    </div>`;
  crib.appendChild(g);
  g.focus();
  const field = g.querySelector<HTMLElement>('.dg-field')!;
  const pip = g.querySelector<HTMLElement>('.dg-pip')!;
  const scoreEl = g.querySelector<HTMLElement>('.dg-score')!;
  const comboEl = g.querySelector<HTMLElement>('.dg-combo')!;
  const timeEl = g.querySelector<HTMLElement>('.dg-time')!;
  const heartsEl = g.querySelector<HTMLElement>('.dg-hearts')!;
  const ORBS = ['dream-orb-a', 'dream-orb-b', 'dream-orb-c'].map((n) => url(n, 128)).filter(Boolean);
  const BLOBS = ['blob-grump', 'blob-storm', 'blob-tongue'].map((n) => url(n, 128)).filter(Boolean);
  const STAR = url('wish-star', 128);
  let x = 0.5, lastX = 0.5, score = 0, combo = 0, hearts = 3, running = false, alive = true;
  let last = 0, spawnIn = 0, ends = 0, startedAt = 0;
  type Drop = { el: HTMLElement; x: number; y: number; v: number; kind: 'orb' | 'star' | 'blob'; wob: number };
  const drops: Drop[] = [];
  const keys = new Set<string>();

  const onMove = (e: PointerEvent) => { const r = field.getBoundingClientRect(); x = Math.min(0.94, Math.max(0.06, (e.clientX - r.left) / r.width)); };
  field.addEventListener('pointermove', onMove);
  field.addEventListener('pointerdown', onMove);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); if (e.type === 'keydown') keys.add(e.key); else keys.delete(e.key); } };
  g.addEventListener('keydown', onKey);
  g.addEventListener('keyup', onKey);

  const pop = (text: string, px: number, cls = '') => {
    const p = document.createElement('span');
    p.className = `dg-pop ${cls}`;
    p.textContent = text;
    p.style.left = `${px * 100}%`;
    field.appendChild(p);
    window.setTimeout(() => p.remove(), 900);
  };
  const renderHUD = () => {
    scoreEl.textContent = String(score);
    const mult = combo >= 10 ? 3 : combo >= 5 ? 2 : 1;
    comboEl.hidden = mult === 1;
    comboEl.textContent = `combo x${mult}`;
    heartsEl.textContent = '♥'.repeat(hearts) + '♡'.repeat(3 - hearts);
    heartsEl.setAttribute('aria-label', `${hearts} heart${hearts === 1 ? '' : 's'} left`);
  };

  const end = (quit = false) => {
    if (!running && !quit) return;
    running = false;
    drops.forEach((d) => d.el.remove());
    drops.length = 0;
    if (quit) return;
    const newBest = score > best;
    if (newBest) { try { localStorage.setItem(BEST_KEY, String(score)); } catch { /* ignore */ } }
    const rank = [...RANKS].reverse().find(([min]) => score >= min)![1];
    field.insertAdjacentHTML('beforeend', `<div class="dg-over">${newBest && score > 0 ? '<p class="dg-best">★ NEW BEST! ★</p>' : ''}<p class="wordart">${score} dream${score === 1 ? '' : 's'}</p><p class="dg-rank">You're a <b>${rank}</b></p><p>${hearts ? 'Time’s up! The town is sleeping soundly.' : 'The nightmares got you this time…'}</p><div class="plate-row"><button type="button" class="os-button" data-again>↻ Play again</button><button type="button" class="os-button" data-done>Back to the crib</button></div></div>`);
    g.querySelector('[data-again]')?.addEventListener('click', () => { g.remove(); startGame(crib); });
    g.querySelector('[data-done]')?.addEventListener('click', () => g.remove());
    (g.querySelector('[data-again]') as HTMLElement | null)?.focus();
    if (score > 0) voice.say('V22', g, true);
    audio.play(newBest ? 'sparkle' : 'chime');
    announce(`Game over. ${score} dreams. You're a ${rank}.`);
  };
  g.querySelector('[data-quit]')!.addEventListener('click', () => { end(true); alive = false; g.remove(); });

  const catchIt = (d: Drop) => {
    const r = field.getBoundingClientRect();
    if (d.kind === 'blob') {
      hearts--; combo = 0;
      audio.play('error');
      g.classList.remove('hurt'); void g.offsetWidth; g.classList.add('hurt');
      pop('ouch!', d.x, 'bad');
      if (hearts <= 0) { renderHUD(); end(); return; }
    } else {
      combo++;
      const mult = combo >= 10 ? 3 : combo >= 5 ? 2 : 1;
      const pts = (d.kind === 'star' ? 5 : 1) * mult;
      score += pts;
      const ctx = audio.ctx;
      if (ctx && !store.get('sound.muted')) musicBoxNote(semitoneFreq(SCALE[Math.min(SCALE.length - 1, combo % SCALE.length)]), undefined, undefined, 0.22);
      if (d.kind === 'star') { audio.play('sparkle'); sparkleBurst(r.left + d.x * r.width, r.top + d.y * r.height, 14); }
      pop(`+${pts}`, d.x, d.kind === 'star' ? 'gold' : '');
      if (combo === 5 || combo === 10) pop(combo === 5 ? 'combo x2!' : 'combo x3!!', 0.5, 'combo');
    }
    renderHUD();
  };

  const frame = (now: number) => {
    if (!running || !alive) return;
    const dt = Math.min(50, now - last); last = now;
    const tElapsed = (now - startedAt) / 1000;
    const speedUp = 1 + tElapsed / 30; // gets busier as the night goes on
    if (keys.has('ArrowLeft')) x = Math.max(0.06, x - dt * 0.0012);
    if (keys.has('ArrowRight')) x = Math.min(0.94, x + dt * 0.0012);
    pip.style.left = `${x * 100}%`;
    pip.style.setProperty('--tilt', `${Math.max(-18, Math.min(18, (x - lastX) * 900))}deg`);
    lastX = x;
    const left = Math.max(0, Math.ceil((ends - now) / 1000));
    timeEl.textContent = String(left);
    timeEl.classList.toggle('hurry', left <= 10);
    if (left <= 0) { end(); return; }
    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawnIn = (620 + Math.random() * 380) / speedUp;
      const r = Math.random();
      const kind: Drop['kind'] = r < 0.07 ? 'star' : r < 0.07 + Math.min(0.32, 0.14 + tElapsed / 200) ? 'blob' : 'orb';
      const d = document.createElement('span');
      d.className = `dg-drop ${kind}`;
      const src = kind === 'star' ? STAR : kind === 'blob' ? BLOBS[Math.floor(Math.random() * BLOBS.length)] : ORBS[Math.floor(Math.random() * ORBS.length)];
      d.innerHTML = src ? `<img src="${src}" alt="" draggable="false">` : (kind === 'blob' ? '☁︎' : '★');
      field.appendChild(d);
      drops.push({ el: d, x: 0.06 + Math.random() * 0.88, y: -0.08, v: ((reducedMotion() ? 0.00011 : 0.00016) + Math.random() * 0.00012) * speedUp * (kind === 'star' ? 1.25 : 1), kind, wob: Math.random() * 6 });
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += d.v * dt;
      const wx = d.kind === 'blob' ? Math.sin(now / 300 + d.wob) * 0.015 : 0;
      d.el.style.left = `${(d.x + wx) * 100}%`;
      d.el.style.top = `${d.y * 100}%`;
      if (d.y > 0.8 && d.y < 0.93 && Math.abs(d.x + wx - x) < 0.085) {
        catchIt(d);
        d.el.remove(); drops.splice(i, 1);
        if (!running) return;
      } else if (d.y > 1.04) {
        if (d.kind !== 'blob' && combo) { combo = 0; renderHUD(); }
        d.el.remove(); drops.splice(i, 1);
      }
    }
    requestAnimationFrame(frame);
  };

  // 3… 2… 1… go
  const count = g.querySelector<HTMLElement>('.dg-count')!;
  let n = 3;
  const tick = () => {
    if (!alive) return;
    if (n > 0) { count.textContent = String(n); audio.play('beep'); n--; window.setTimeout(tick, reducedMotion() ? 300 : 700); return; }
    g.querySelector('.dg-intro')?.remove();
    audio.play('startup');
    running = true; last = performance.now(); startedAt = last; ends = last + 45_000;
    renderHUD();
    requestAnimationFrame(frame);
  };
  window.setTimeout(tick, 900);
  return () => { alive = false; running = false; g.remove(); };
}
