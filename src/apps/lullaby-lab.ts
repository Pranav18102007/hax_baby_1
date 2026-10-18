import type { Feature } from '../core/registry';
import { audio } from '../core/audio';
import { store } from '../core/store';
import { bus } from '../core/bus';
import { url } from '../core/assets';
import { reducedMotion } from '../core/a11y';
import { voice } from '../core/voice';
import { SCALES, type ScaleId, freq, makeMelody, makeReverb, musicBoxNote } from '../core/music';

/**
 * Lullaby Lab.exe (Tier 2: real audio). Wind the key, the music box plays a generated
 * lullaby that slows down as the spring unwinds. Knobs: tempo, dreaminess (reverb), sparkle.
 */

interface Knob { id: string; label: string; min: number; max: number; value: number; step: number; unit?: string }

function knobHTML(k: Knob): string {
  return `<div class="knob-wrap">
    <div class="knob" role="slider" tabindex="0" data-knob="${k.id}" aria-label="${k.label}"
      aria-valuemin="${k.min}" aria-valuemax="${k.max}" aria-valuenow="${k.value}" aria-valuetext="${k.value}${k.unit ?? ''}">
      <span class="knob-dial"></span>
    </div>
    <span class="knob-label">${k.label}</span>
    <span class="knob-value">${k.value}${k.unit ?? ''}</span>
  </div>`;
}

function mount(body: HTMLElement): () => void {
  const knobs: Record<string, Knob> = {
    tempo: { id: 'tempo', label: 'Tempo', min: 40, max: 100, value: 66, step: 5, unit: ' bpm' },
    dream: { id: 'dream', label: 'Dreaminess', min: 0, max: 100, value: 45, step: 5 },
    sparkle: { id: 'sparkle', label: 'Sparkle', min: 0, max: 100, value: 30, step: 5 },
  };
  let scale: ScaleId = 'moonlight';
  let seed = Math.floor(Math.random() * 1e6);
  let melody = makeMelody(seed, scale);
  let spring = 0; // 0..1
  let playing = false;
  let oneLoop = false;
  let step = 0;
  let nextTime = 0;
  let timer = 0;
  let lastTick = 0;

  body.classList.add('lab');
  body.innerHTML = `
    <div class="lab-muted" hidden>Sound is off — Pip can't hear the lab! <button type="button" class="os-button" data-unmute>Unmute</button></div>
    <div class="lab-stage">
      <div class="lab-box">
        <img src="${url('musicbox', 512)}" alt="Pip's music box" class="lab-box-img" draggable="false">
        <button type="button" class="lab-key" aria-label="Wind-up key: drag in circles to wind" data-tip="Drag me round and round!"></button>
        <div class="lab-notes" aria-hidden="true"></div>
        <div class="lab-bubbles"></div>
      </div>
      <div class="lab-spring">
        <span>Spring</span>
        <div class="lab-meter" role="progressbar" aria-label="Spring wound" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
      </div>
      <div class="lab-row">
        <button type="button" class="os-button" data-wind>Wind up</button>
        <button type="button" class="os-button" data-play aria-pressed="false">▶ Play</button>
        <button type="button" class="os-button" data-new>🎲 New lullaby</button>
        <button type="button" class="os-button" data-keep>♥ Keep</button>
      </div>
    </div>
    <div class="lab-knobs">${Object.values(knobs).map(knobHTML).join('')}</div>
    <fieldset class="lab-scales"><legend>Scale</legend>
      ${(Object.keys(SCALES) as ScaleId[]).map((s) => `<label><input type="radio" name="lab-scale" value="${s}" ${s === scale ? 'checked' : ''}><span>${SCALES[s].label}</span></label>`).join('')}
    </fieldset>
    <div class="lab-keys" role="group" aria-label="Star keys: play your own tune (keys 1 to 8)">
      ${Array.from({ length: 8 }, (_, i) => `<button type="button" class="star-key" data-deg="${i}" aria-label="Note ${i + 1}">★</button>`).join('')}
    </div>
    <section class="lab-saved" aria-label="Lullabies you kept"><h4>My lullabies</h4><ol></ol><p class="lab-saved-empty">Press ♥ Keep to save a lullaby you like.</p></section>`;

  const $ = <T extends HTMLElement>(s: string) => body.querySelector<T>(s)!;
  const meter = $('.lab-meter');
  const playBtn = $<HTMLButtonElement>('[data-play]');
  const notesLayer = $('.lab-notes');
  const mutedBar = $('.lab-muted');

  // audio graph: notes → reverb → music bus
  audio.unlock();
  const verb = audio.music ? makeReverb(audio.music) : null;
  const applyDream = () => {
    if (!verb) return;
    const v = knobs.dream.value / 100;
    verb.wet.gain.value = v * 0.9;
    verb.dry.gain.value = 1 - v * 0.35;
  };
  applyDream();

  const renderMuted = () => { mutedBar.hidden = !store.get('sound.muted'); };
  renderMuted();
  const offMute = store.on('sound.muted', renderMuted);
  $('[data-unmute]').addEventListener('click', () => store.set('sound.muted', false));

  const renderSpring = () => {
    meter.querySelector<HTMLElement>('i')!.style.width = `${Math.round(spring * 100)}%`;
    meter.setAttribute('aria-valuenow', String(Math.round(spring * 100)));
  };

  const floatNote = (i: number) => {
    if (reducedMotion()) return;
    const n = document.createElement('span');
    n.textContent = i % 2 ? '♫' : '♪';
    n.style.left = `${30 + Math.random() * 40}%`;
    notesLayer.appendChild(n);
    window.setTimeout(() => n.remove(), 1600);
  };

  const sparkleLevel = () => knobs.sparkle.value / 100;
  const playDeg = (d: number, at?: number) => {
    const f = freq(d, scale);
    musicBoxNote(f, at, verb?.input, 0.22);
    if (sparkleLevel() > 0.05) musicBoxNote(f * 2, at, verb?.input, 0.08 * sparkleLevel());
  };

  const stop = () => {
    playing = false;
    oneLoop = false;
    window.clearInterval(timer);
    playBtn.textContent = '▶ Play';
    playBtn.setAttribute('aria-pressed', 'false');
  };

  const schedule = () => {
    const ctx = audio.ctx;
    if (!ctx) return;
    const now = performance.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    if (!oneLoop) {
      spring = Math.max(0, spring - dt / 30);
      renderSpring();
      if (spring <= 0) { stop(); return; }
    }
    const bpm = knobs.tempo.value * (oneLoop ? 1 : 0.55 + 0.45 * Math.min(1, spring * 1.5));
    const beat = 60 / bpm / 2; // eighth notes
    while (nextTime < ctx.currentTime + 0.12) {
      const d = melody[step % melody.length];
      if (d !== null && !store.get('sound.muted')) {
        playDeg(d, nextTime);
        const delay = Math.max(0, (nextTime - ctx.currentTime) * 1000);
        const idx = step;
        window.setTimeout(() => floatNote(idx), delay);
      }
      step++;
      nextTime += beat;
      if (oneLoop && step >= melody.length) { stop(); return; }
    }
  };

  const start = (loop: boolean) => {
    const ctx = audio.ctx;
    if (!ctx) return;
    if (playing) return;
    playing = true;
    oneLoop = loop;
    step = 0;
    nextTime = ctx.currentTime + 0.05;
    lastTick = performance.now();
    playBtn.textContent = '⏸ Pause';
    playBtn.setAttribute('aria-pressed', 'true');
    timer = window.setInterval(schedule, 25);
    schedule();
  };

  const wind = (amount: number) => {
    spring = Math.min(1, spring + amount);
    renderSpring();
    audio.play('click');
  };

  $('[data-wind]').addEventListener('click', () => { wind(0.25); if (!playing) start(false); });
  playBtn.addEventListener('click', () => (playing ? stop() : start(spring <= 0)));
  $('[data-new]').addEventListener('click', () => {
    seed = Math.floor(Math.random() * 1e6);
    melody = makeMelody(seed, scale);
    step = 0;
    audio.play('sparkle');
    voice.say('V32', body.querySelector('[data-new]'));
  });

  // the wind-up key: drag around in circles (4 turns = full)
  const key = $<HTMLButtonElement>('.lab-key');
  let lastAngle: number | null = null;
  let windAcc = 0;
  key.addEventListener('pointerdown', (e) => {
    key.setPointerCapture(e.pointerId);
    lastAngle = null;
  });
  key.addEventListener('pointermove', (e) => {
    if (!key.hasPointerCapture(e.pointerId)) return;
    const r = key.getBoundingClientRect();
    const a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    if (lastAngle !== null) {
      let d = a - lastAngle;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      const turn = Math.abs(d) / (Math.PI * 2);
      spring = Math.min(1, spring + turn / 4);
      windAcc += turn;
      key.style.setProperty('--rot', `${(parseFloat(key.style.getPropertyValue('--rot')) || 0) + (d * 180) / Math.PI}deg`);
      if (windAcc > 0.08) { audio.play('click'); windAcc = 0; }
      renderSpring();
    }
    lastAngle = a;
  });
  const keyUp = () => { lastAngle = null; if (spring > 0.02 && !playing) start(false); };
  key.addEventListener('pointerup', keyUp);
  key.addEventListener('pointercancel', keyUp);
  key.addEventListener('click', (e) => { if (e.detail === 0) { wind(0.25); if (!playing) start(false); } });

  // knobs: drag up/down, wheel, arrow keys
  body.querySelectorAll<HTMLElement>('.knob').forEach((el) => {
    const k = knobs[el.dataset.knob!];
    const valueEl = el.parentElement!.querySelector<HTMLElement>('.knob-value')!;
    const set = (v: number) => {
      k.value = Math.round(Math.min(k.max, Math.max(k.min, v)) / k.step) * k.step;
      const t = (k.value - k.min) / (k.max - k.min);
      el.style.setProperty('--turn', `${-135 + t * 270}deg`);
      el.setAttribute('aria-valuenow', String(k.value));
      el.setAttribute('aria-valuetext', `${k.value}${k.unit ?? ''}`);
      valueEl.textContent = `${k.value}${k.unit ?? ''}`;
      if (k.id === 'dream') applyDream();
    };
    set(k.value);
    el.addEventListener('setvalue', (e) => set((e as CustomEvent<number>).detail));
    let sy = 0, sv = 0;
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); sy = e.clientY; sv = k.value; });
    el.addEventListener('pointermove', (e) => { if (el.hasPointerCapture(e.pointerId)) set(sv + ((sy - e.clientY) / 150) * (k.max - k.min)); });
    el.addEventListener('wheel', (e) => { e.preventDefault(); set(k.value - Math.sign(e.deltaY) * k.step); }, { passive: false });
    el.addEventListener('keydown', (e) => {
      const big = (k.max - k.min) / 3;
      const map: Record<string, number> = { ArrowUp: k.step, ArrowRight: k.step, ArrowDown: -k.step, ArrowLeft: -k.step, PageUp: big, PageDown: -big };
      if (e.key in map) { e.preventDefault(); set(k.value + map[e.key]); }
      else if (e.key === 'Home') { e.preventDefault(); set(k.min); }
      else if (e.key === 'End') { e.preventDefault(); set(k.max); }
    });
  });

  body.querySelector('.lab-scales')!.addEventListener('change', (e) => {
    scale = (e.target as HTMLInputElement).value as ScaleId;
    melody = makeMelody(seed, scale);
  });

  const keys = [...body.querySelectorAll<HTMLButtonElement>('.star-key')];
  const pressKey = (i: number) => {
    if (!audio.ctx || store.get('sound.muted')) return;
    playDeg(i);
    floatNote(i);
    const b = keys[i];
    b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
  };
  keys.forEach((b, i) => b.addEventListener('pointerdown', () => pressKey(i)));
  keys.forEach((b, i) => b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pressKey(i); } }));
  const onDigit = (e: KeyboardEvent) => {
    const n = Number(e.key);
    if (n >= 1 && n <= 8 && body.contains(document.activeElement)) pressKey(n - 1);
  };
  document.addEventListener('keydown', onDigit);

  // ---- ♥ Keep: saved lullabies (seed + scale + tempo), stored on this device ----
  const SAVE_KEY = 'pip.lullabies';
  const NAMES = ['Moonbeam Waltz', 'Sleepy Socks', 'Cloud Nine-ish', 'Ghost Hug', 'Star Crumbs', 'Warm Milk Song', 'Pillow Fort', 'Yawn in G', 'Nap Time Rag', 'Owl Lullaby', 'Teddy Tango', 'Night-Night Nocturne'];
  type Saved = { seed: number; scale: ScaleId; tempo: number; name: string };
  const readSaved = (): Saved[] => { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]'); } catch { return []; } };
  const writeSaved = (l: Saved[]) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(l.slice(0, 12))); } catch { /* ignore */ } };
  const savedList = body.querySelector<HTMLElement>('.lab-saved ol')!;
  const savedEmpty = body.querySelector<HTMLElement>('.lab-saved-empty')!;
  const renderSaved = () => {
    const l = readSaved();
    savedEmpty.hidden = l.length > 0;
    savedList.innerHTML = l.map((x, i) => `<li><button type="button" class="os-button" data-load="${i}">▶ ${x.name}</button><button type="button" class="os-button lab-del" data-del="${i}" aria-label="Forget ${x.name}">✕</button></li>`).join('');
  };
  renderSaved();
  $('[data-keep]').addEventListener('click', () => {
    const l = readSaved();
    if (l.some((x) => x.seed === seed && x.scale === scale)) { voice.bubble('Already kept that one! ♥', $('[data-keep]')); return; }
    const name = NAMES[(seed + l.length) % NAMES.length];
    l.unshift({ seed, scale, tempo: knobs.tempo.value, name });
    writeSaved(l);
    renderSaved();
    audio.play('sparkle');
    voice.say('V32', $('[data-keep]'), true);
  });
  savedList.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b) return;
    const l = readSaved();
    if (b.dataset.load) {
      const x = l[Number(b.dataset.load)];
      if (!x) return;
      seed = x.seed; scale = x.scale; melody = makeMelody(seed, scale); step = 0;
      body.querySelector<HTMLInputElement>(`.lab-scales input[value="${scale}"]`)!.checked = true;
      body.querySelector<HTMLElement>('.knob[data-knob="tempo"]')?.dispatchEvent(new CustomEvent('setvalue', { detail: x.tempo }));
      if (playing) stop();
      start(true);
    } else if (b.dataset.del) {
      l.splice(Number(b.dataset.del), 1);
      writeSaved(l);
      renderSaved();
      audio.play('close');
    }
  });

  // ---- bubble notes: pop a rising bubble to play a note ----
  const bubbles = body.querySelector<HTMLElement>('.lab-bubbles')!;
  const spawnBubble = () => {
    if (reducedMotion() || bubbles.childElementCount > 5) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lab-bubble';
    b.tabIndex = -1;
    b.setAttribute('aria-hidden', 'true');
    b.style.left = `${8 + Math.random() * 84}%`;
    b.style.setProperty('--s', `${22 + Math.random() * 18}px`);
    const deg = Math.floor(Math.random() * 8);
    b.addEventListener('pointerdown', () => { if (audio.ctx && !store.get('sound.muted')) playDeg(deg); audio.play('pop'); floatNote(deg); b.remove(); });
    b.addEventListener('animationend', () => b.remove());
    bubbles.appendChild(b);
  };
  const bubbleTimer = window.setInterval(spawnBubble, 1700);

  return () => {
    window.clearInterval(bubbleTimer);
    stop();
    offMute();
    document.removeEventListener('keydown', onDigit);
    verb?.dispose();
  };
}

const feature: Feature = {
  id: 'lullaby-lab',
  priority: 'must',
  apps: [{ id: 'lullaby-lab', title: 'Lullaby Lab.exe', icon: 'icon-musicbox', width: 560, height: 640, mount }],
  startMenu: [{ id: 'lullaby-lab', label: 'Lullaby Lab', icon: 'icon-musicbox', group: 'programs', order: 1, run: () => bus.emit('app:open', 'lullaby-lab') }],
};

export default feature;
