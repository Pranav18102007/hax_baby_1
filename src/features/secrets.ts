import type { Feature } from '../core/registry';
import { bus } from '../core/bus';
import { store } from '../core/store';
import { audio } from '../core/audio';
import { voice } from '../core/voice';
import { url } from '../core/assets';
import { announce, reducedMotion, trapFocus } from '../core/a11y';
import { musicBoxNote } from '../core/music';

/**
 * The Easter egg. Two ways in, one secret room:
 *  - the tiny eclipse ring in the hero sky (portal)
 *  - typing SILENCE (the thing Pip hates most; clue held by the sock-ghost)
 */

const CODE = 'silence';

function found(): boolean { return store.get('visitor').secretsFound.includes('crib'); }

function markFound(): void {
  const v = store.get('visitor');
  if (!v.secretsFound.includes('crib')) store.set('visitor', { ...v, secretsFound: [...v.secretsFound, 'crib'] });
}

let open = false;

function playSecretLullaby(btn: HTMLElement): void {
  const ctx = audio.ctx;
  if (!ctx || store.get('sound.muted')) { voice.bubble('Turn the sound on for the secret lullaby…', btn); return; }
  // a little rising-and-resting tune only heard in here
  const tune = [783.99, 659.25, 783.99, 1046.5, 987.77, 783.99, 659.25, 587.33, 659.25, 523.25];
  tune.forEach((f, i) => musicBoxNote(f, ctx.currentTime + 0.1 + i * 0.38, undefined, 0.24));
}

function openCrib(origin?: Element | null): void {
  if (open) return;
  open = true;
  const first = !found();
  markFound();
  const opener = document.activeElement as HTMLElement | null;

  const r = origin?.getBoundingClientRect();
  const ox = r ? r.left + r.width / 2 : window.innerWidth / 2;
  const oy = r ? r.top + r.height / 2 : window.innerHeight / 2;

  const el = document.createElement('div');
  el.className = 'crib';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'crib-title');
  el.style.setProperty('--ox', `${ox}px`);
  el.style.setProperty('--oy', `${oy}px`);
  el.innerHTML = `
    <img class="crib-bg" src="${url('secret-crib', 1536)}" alt="" />
    <div class="crib-ghosts" aria-hidden="true">
      <button type="button" class="crib-ghost g1" tabindex="-1"><img src="${url('ghost-yawn', 256)}" alt=""></button>
      <button type="button" class="crib-ghost g2" tabindex="-1"><img src="${url('ghost-nightcap', 256)}" alt=""></button>
      <button type="button" class="crib-ghost g3" tabindex="-1"><img src="${url('ghost-teddy', 256)}" alt=""></button>
    </div>
    <div class="crib-panel">
      <h2 id="crib-title" class="wordart crib-title">The Secret Crib</h2>
      <p class="crib-badge">${first ? '★ You found the Secret Crib! ★' : '★ Welcome back to the Secret Crib ★'}</p>
      <p class="crib-text">Pip's hiding place inside a cloud. The ghosts nap here when the town is too loud.</p>
      <div class="crib-actions">
        <button type="button" class="os-button" data-play>▶ Play Pip's secret lullaby</button>
        <button type="button" class="os-button" data-back>← Back to the nursery</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add('sheet-open');
  const untrap = trapFocus(el);
  requestAnimationFrame(() => el.classList.add('in'));
  audio.play('sparkle');
  announce(first ? 'You found the Secret Crib!' : 'Back in the Secret Crib');
  bus.emit('secret:found', 'crib');

  el.querySelectorAll<HTMLButtonElement>('.crib-ghost').forEach((g) => g.addEventListener('click', () => {
    voice.bubble('zzz…', g);
    audio.play('pop');
  }));
  const play = el.querySelector<HTMLButtonElement>('[data-play]')!;
  play.addEventListener('click', () => playSecretLullaby(play));
  play.focus();

  const close = () => {
    if (!open) return;
    open = false;
    untrap();
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('popstate', onPop);
    el.classList.remove('in');
    el.classList.add('out');
    document.body.classList.remove('sheet-open');
    window.setTimeout(() => el.remove(), reducedMotion() ? 0 : 450);
    opener?.focus?.({ preventScroll: true });
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  // phone back gesture closes the room instead of leaving the site
  const onPop = () => close();
  try { history.pushState({ crib: true }, ''); } catch { /* ignore */ }
  window.addEventListener('popstate', onPop);
  document.addEventListener('keydown', onKey);
  el.querySelector('[data-back]')!.addEventListener('click', () => { if (history.state?.crib) history.back(); else close(); });
}

function openWhisper(): void {
  bus.emit('app:open', 'whisper');
}

const feature: Feature = {
  id: 'secrets',
  priority: 'must',
  init() {
    bus.on('secret:open', (d?: { via?: string }) => openCrib(d?.via === 'portal' ? document.querySelector('.portal-ring') : null));
    bus.on('secret:clue', () => window.setTimeout(openWhisper, 1600));

    // typing S-I-L-E-N-C-E anywhere (not inside a field)
    let buf = '';
    document.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-CODE.length);
      if (buf === CODE) {
        buf = '';
        voice.bubble('NOOO, not silence!', document.getElementById('pip'));
        if (!reducedMotion()) { document.body.classList.add('shake'); window.setTimeout(() => document.body.classList.remove('shake'), 500); }
        window.setTimeout(() => openCrib(), 900);
      }
    });
  },
  apps: [{
    id: 'whisper',
    title: 'whisper.exe',
    icon: 'icon-portal',
    width: 360,
    height: 240,
    mount(body, ctx) {
      body.innerHTML = `
        <form class="whisper">
          <label for="whisper-in">Whisper the password:</label>
          <input id="whisper-in" name="pw" autocomplete="off" autocapitalize="off" spellcheck="false" autofocus>
          <button type="submit" class="os-button">Whisper</button>
          <p class="whisper-msg" role="status"></p>
        </form>`;
      const form = body.querySelector('form')!;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = String(new FormData(form).get('pw') || '').trim().toLowerCase();
        if (v === CODE) {
          ctx.windows.close('whisper', true);
          voice.bubble('NOOO, not silence!');
          window.setTimeout(() => openCrib(), 700);
        } else {
          body.querySelector('.whisper-msg')!.textContent = 'hmm… no. (Pip yawns)';
          audio.play('error');
        }
      });
    },
  }],
  startMenu: [{
    id: 'crib', label: 'Secret Crib', icon: 'icon-portal', group: 'special', order: 90,
    locked: () => !found(),
    run: () => openCrib(),
  }],
};

export default feature;
