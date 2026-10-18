import type { Feature } from '../core/registry';
import { bus } from '../core/bus';
import { store } from '../core/store';
import { audio } from '../core/audio';
import { url } from '../core/assets';
import voiceFiles from '../content/voice.json';
import { SONGS, chordsFor, freq, makeMelody, makeReverb, musicBoxNote, padNote, semitoneFreq, type Song, type ScaleId } from '../core/music';

/**
 * Pip's Mixtape. Side A: music-box lullabies (generated + public domain).
 * Side B: Pip's Silly Tapes (voice outtakes, listed here as files land).
 * Playback lives at module level, so music keeps going after the window closes.
 */

/** A track = timed notes (in beats) plus a chord per bar, played on the music box with a soft pad underneath. */
interface Ev { at: number; f: number; dur: number }
interface Track { title: string; bpm: number; length: number; notes: Ev[]; chords: { at: number; fs: number[]; bass: number }[] }

function fromSong(song: Song): Track {
  let t = 0;
  const notes: Ev[] = [];
  for (const [n, d] of song.notes) { if (n !== null) notes.push({ at: t, f: semitoneFreq(n), dur: d }); t += d; }
  const chords = chordsFor(song).map((c) => ({ at: c.at, fs: c.tones.map((pc) => semitoneFreq(pc - 12)), bass: semitoneFreq(c.root - 24) }));
  return { title: song.title, bpm: song.bpm, length: Math.ceil(t / song.meter) * song.meter, notes, chords };
}

function generated(title: string, seed: number, scale: ScaleId, bpm: number): Track {
  const mel = makeMelody(seed, scale, 32);
  const notes: Ev[] = [];
  mel.forEach((d, i) => { if (d !== null) notes.push({ at: i * 0.5, f: freq(d, scale), dur: 0.5 }); });
  const chords = Array.from({ length: 4 }, (_, i) => ({ at: i * 4, fs: [semitoneFreq(-12), semitoneFreq(-8), semitoneFreq(-5)], bass: semitoneFreq(-24) }));
  return { title, bpm, length: 16, notes, chords };
}

const SIDE_A: Track[] = [...SONGS.map(fromSong), generated("Pip's own: Moonlight", 1204, 'moonlight', 72)];
/** Recorded outtakes in /public/assets/voice/outtakes (add filenames as they land). */
const SIDE_B: { title: string; file: string }[] = voiceFiles.outtakes as { title: string; file: string }[];

const player = {
  side: 'A' as 'A' | 'B',
  index: 0,
  playing: false,
  timer: 0,
  step: 0,
  next: 0,
  verb: null as ReturnType<typeof makeReverb>,
  el: null as HTMLAudioElement | null,
  listeners: new Set<() => void>(),
  emit() { this.listeners.forEach((f) => f()); },
};

function stop(): void {
  window.clearInterval(player.timer);
  player.el?.pause();
  player.playing = false;
  player.emit();
}

function playA(): void {
  const ctx = audio.ctx;
  if (!ctx || !audio.music) return;
  if (!player.verb) { player.verb = makeReverb(audio.music); if (player.verb) { player.verb.wet.gain.value = 0.5; player.verb.dry.gain.value = 0.8; } }
  const t = SIDE_A[player.index];
  const spb = 60 / t.bpm; // seconds per beat
  const start = ctx.currentTime + 0.08;
  let ni = 0, ci = 0, loops = 0;
  player.playing = true;
  window.clearInterval(player.timer);
  player.timer = window.setInterval(() => {
    const horizon = ctx.currentTime + 0.15;
    const base = start + loops * t.length * spb;
    while (ci < t.chords.length && base + t.chords[ci].at * spb < horizon) {
      const c = t.chords[ci++];
      const at = base + c.at * spb, len = (t.chords[ci]?.at ?? t.length) - c.at;
      if (!store.get('sound.muted') && player.verb) {
        c.fs.forEach((f) => padNote(f, at, len * spb, player.verb!.input, 0.035));
        padNote(c.bass, at, Math.min(len, 2) * spb, player.verb.input, 0.06);
      }
    }
    while (ni < t.notes.length && base + t.notes[ni].at * spb < horizon) {
      const n = t.notes[ni++];
      if (!store.get('sound.muted')) musicBoxNote(n.f, base + n.at * spb, player.verb?.input, 0.2);
    }
    if (ni >= t.notes.length && ci >= t.chords.length && ctx.currentTime > base + t.length * spb - 0.1) {
      if (++loops >= 2) { // each song plays twice, then the next one starts
        player.index = (player.index + 1) % SIDE_A.length;
        player.emit();
        playA();
        return;
      }
      ni = 0; ci = 0;
    }
  }, 25);
  player.emit();
}

function playB(): void {
  const t = SIDE_B[player.index];
  if (!t) return;
  player.el?.pause();
  player.el = new Audio(`/assets/voice/outtakes/${t.file}`);
  player.el.muted = store.get('sound.muted');
  player.el.addEventListener('ended', () => { player.index = (player.index + 1) % SIDE_B.length; playB(); });
  void player.el.play().catch(() => undefined);
  player.playing = true;
  player.emit();
}

function play(): void {
  audio.unlock();
  if (player.side === 'A') playA(); else playB();
}

store.on('sound.muted', (m) => {
  if (player.el) player.el.muted = m;
  if (m && player.playing) stop(); // the spec: muting pauses the Mixtape
});

function toggle(): void { if (player.playing) stop(); else play(); }

/** Taskbar mini player (desktop): cassette opens the window, ▶ / ⏸ controls the same playback. */
function mountMini(): void {
  const tray = document.querySelector('#taskbar .tb-tray');
  if (!tray || tray.querySelector('.tb-mix')) return;
  const box = document.createElement('div');
  box.className = 'tb-mix desk-only';
  box.innerHTML = `<button type="button" class="tb-btn" data-open aria-label="Open Mixtape" data-tip="Pip's Mixtape"><img src="${url('icon-cassette', 64)}" alt="" width="22" height="22"></button>`
    + '<button type="button" class="tb-btn tb-mix-play" data-toggle aria-label="Play lullaby"><span aria-hidden="true">▶</span></button>';
  tray.prepend(box);
  const btn = box.querySelector<HTMLButtonElement>('[data-toggle]')!;
  const render = () => {
    btn.setAttribute('aria-label', player.playing ? 'Pause' : 'Play lullaby');
    btn.querySelector('span')!.textContent = player.playing ? '⏸' : '▶';
    btn.classList.toggle('on', player.playing);
  };
  player.listeners.add(render);
  render();
  btn.addEventListener('click', () => { audio.play('click'); toggle(); });
  box.querySelector('[data-open]')!.addEventListener('click', () => { audio.play('click'); bus.emit('app:open', 'mixtape'); });
}

function mount(body: HTMLElement): () => void {
  body.classList.add('mix');
  const render = () => {
    const tracks = player.side === 'A' ? SIDE_A.map((t) => t.title) : SIDE_B.map((t) => t.title);
    body.innerHTML = `
      <div class="mix-tape ${player.playing ? 'spin' : ''}">
        <img src="${url('cassette', 1024)}" alt="" draggable="false">
        <span class="reel r1" aria-hidden="true"></span><span class="reel r2" aria-hidden="true"></span>
        <span class="mix-label">PIP'S MIXTAPE — SIDE ${player.side}</span>
      </div>
      <div class="mix-controls">
        <button type="button" class="os-button" data-prev aria-label="Previous track">⏮</button>
        <button type="button" class="os-button" data-play aria-pressed="${player.playing}">${player.playing ? '⏸ Pause' : '▶ Play'}</button>
        <button type="button" class="os-button" data-next aria-label="Next track">⏭</button>
        <button type="button" class="os-button" data-flip>Flip tape</button>
      </div>
      <label class="mix-vol">Music volume <input type="range" min="0" max="100" value="${Math.round((audio.music?.gain.value ?? 0.7) * 100)}" data-vol></label>
      ${tracks.length ? `<ol class="mix-list">${tracks.map((t, i) => `<li><button type="button" class="${i === player.index ? 'now' : ''}" data-track="${i}">${t}</button></li>`).join('')}</ol>`
        : '<p class="mix-empty">Side B: Pip\'s Silly Tapes are still being recorded. Check back soon!</p>'}`;
  };
  render();
  player.listeners.add(render);
  body.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t) return;
    const list = player.side === 'A' ? SIDE_A.length : SIDE_B.length;
    if (t.matches('[data-play]')) player.playing ? stop() : play();
    else if (t.matches('[data-next]') && list) { player.index = (player.index + 1) % list; if (player.playing) play(); else player.emit(); }
    else if (t.matches('[data-prev]') && list) { player.index = (player.index - 1 + list) % list; if (player.playing) play(); else player.emit(); }
    else if (t.matches('[data-flip]')) { stop(); player.side = player.side === 'A' ? 'B' : 'A'; player.index = 0; audio.play('beep'); player.emit(); }
    else if (t.dataset.track) { player.index = Number(t.dataset.track); play(); }
  });
  body.addEventListener('input', (e) => {
    const r = e.target as HTMLInputElement;
    if (r.matches('[data-vol]') && audio.music) audio.music.gain.value = Number(r.value) / 100;
  });
  return () => player.listeners.delete(render);
}

const feature: Feature = {
  id: 'mixtape',
  priority: 'should',
  init() {
    mountMini();
    bus.on('mixtape:play-random', () => { player.side = 'A'; player.index = Math.floor(Math.random() * SIDE_A.length); play(); bus.emit('app:open', 'mixtape'); });
  },
  apps: [{ id: 'mixtape', title: 'Mixtape.exe', icon: 'icon-cassette', width: 460, height: 560, mount }],
  startMenu: [
    { id: 'mixtape', label: 'Mixtape', icon: 'icon-cassette', group: 'programs', order: 4, run: () => bus.emit('app:open', 'mixtape') },
    { id: 'mixtape-mini', label: 'Play Mixtape', dynamicLabel: () => (player.playing ? '⏸ Pause Mixtape' : '▶ Play Mixtape'), icon: 'icon-cassette', group: 'main', order: 5, phoneOnly: true, run: toggle },
  ],
};

export default feature;
