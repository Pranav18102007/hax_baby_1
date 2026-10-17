import { bus } from '../core/bus';
import { store } from '../core/store';
import { voice } from '../core/voice';
import { shortcut } from '../core/a11y';
import { url } from '../core/assets';
import type { WindowManager } from '../core/windows';
import type { AppDef } from '../core/registry';

const BEDTIME_H = 23;

function istNow(): Date {
  const d = new Date();
  return new Date(d.getTime() + (d.getTimezoneOffset() + 330) * 60_000);
}

function pad(n: number): string { return String(n).padStart(2, '0'); }

function clockTick(): void {
  const t = istNow();
  const h = t.getHours(), m = t.getMinutes();
  const time = document.querySelector<HTMLTimeElement>('#tb-clock time')!;
  time.textContent = `${pad(h)}:${pad(m)}`;
  time.dateTime = `${pad(h)}:${pad(m)}`;
  const note = document.querySelector<HTMLElement>('#tb-clock .clock-note')!;
  if (h >= BEDTIME_H || h < 6) note.textContent = '· Pip is dreaming';
  else if (h < 10) note.textContent = '· good morning';
  else {
    const mins = (BEDTIME_H - h) * 60 - m;
    note.textContent = mins <= 180 ? `· bedtime in ${mins >= 60 ? `${Math.floor(mins / 60)}h ` : ''}${mins % 60}m` : '· awake and building';
  }
}

/** Moon phase (0 = new, 0.5 = full) from a known new moon. Good enough for a tooltip. */
function moonPhase(): string {
  const days = (Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86_400_000;
  const p = (days % 29.530588) / 29.530588;
  const names = ['new moon', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full moon', 'waning gibbous', 'last quarter', 'waning crescent'];
  return names[Math.round(p * 8) % 8];
}

export function initTaskbar(windows: WindowManager, apps: Map<string, AppDef>, toggleTheme: () => void): void {
  // clock
  clockTick();
  window.setInterval(clockTick, 20_000);
  document.getElementById('tb-clock')!.addEventListener('click', (e) => {
    const t = istNow();
    const date = t.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    voice.bubble(`${date}. Tonight: ${moonPhase()}.`, e.currentTarget as Element);
  });

  // mute
  const mute = document.getElementById('tb-mute')!;
  const renderMute = () => {
    const m = store.get('sound.muted');
    mute.setAttribute('aria-pressed', String(m));
    mute.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
    mute.classList.toggle('muted', m);
  };
  const toggleMute = () => {
    const next = !store.get('sound.muted');
    store.set('sound.muted', next);
    if (next) voice.bubble('nooo, not silence…', mute);
    else voice.say('V11', mute, true);
  };
  mute.addEventListener('click', toggleMute);
  store.on('sound.muted', renderMute);
  renderMute();
  shortcut('m', toggleMute);

  // day / night
  const themeBtn = document.getElementById('tb-theme')!;
  const renderTheme = () => {
    const day = store.get('theme.mode') === 'day';
    themeBtn.setAttribute('aria-pressed', String(day));
    themeBtn.setAttribute('aria-label', day ? 'Switch to night' : 'Switch to day');
  };
  themeBtn.addEventListener('click', toggleTheme);
  store.on('theme.mode', renderTheme);
  renderTheme();
  shortcut('d', toggleTheme);

  // open-window buttons
  const holder = document.getElementById('tb-windows')!;
  const renderWins = () => {
    holder.replaceChildren(
      ...windows.list().map((w) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `tb-win${w.minimized ? ' min' : ''}`;
        const icon = apps.get(w.id)?.icon;
        b.innerHTML = `${icon ? `<img src="${url(icon, 64)}" alt="" width="18" height="18">` : ''}<span>${w.title}</span>`;
        b.setAttribute('aria-label', `${w.title}${w.minimized ? ' (minimised)' : ''}`);
        b.addEventListener('click', () => windows.toggleFromTaskbar(w.id));
        return b;
      }),
    );
  };
  bus.on('windows:changed', renderWins);
}
