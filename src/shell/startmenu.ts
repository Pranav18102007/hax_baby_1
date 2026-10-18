import { audio } from '../core/audio';
import { url } from '../core/assets';
import { isPhone, trapFocus } from '../core/a11y';
import type { StartItem } from '../core/registry';
import { scrollToEl } from '../core/scroll';
import { voice } from '../core/voice';
import { bus } from '../core/bus';

/** Scene shortcuts are built in; everything else comes from features via the registry. */
const SCENES: [string, string][] = [
  ['hero', 'Hello'],
  ['about', 'Who is Pip'],
  ['story', "Pip's story"],
  ['workshop', 'Workshop'],
  ['route', 'Dream route'],
  ['guestbook', 'Guestbook'],
];

export function initStartMenu(items: StartItem[]): void {
  const btn = document.getElementById('start-btn') as HTMLButtonElement;
  const menu = document.getElementById('startmenu')!;
  const list = menu.querySelector<HTMLElement>('.sm-items')!;
  let untrap: (() => void) | null = null;

  const row = (label: string, icon: string | undefined, run: () => void, opts: { locked?: boolean; cls?: string } = {}) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.className = `sm-item ${opts.cls ?? ''}`;
    b.innerHTML = `${icon ? `<img src="${url(icon, 64)}" alt="" width="24" height="24">` : '<span class="sm-dot" aria-hidden="true">✦</span>'}<span>${label}</span>${opts.locked ? '<span class="sm-lock" aria-hidden="true">🔒</span>' : ''}`;
    if (opts.locked) {
      b.setAttribute('aria-disabled', 'true');
      b.addEventListener('click', () => audio.play('error'));
    } else {
      b.addEventListener('click', () => { close(); audio.play('click'); run(); });
    }
    return b;
  };

  const heading = (text: string) => {
    const h = document.createElement('p');
    h.className = 'sm-heading';
    h.setAttribute('role', 'presentation');
    h.textContent = text;
    return h;
  };

  function build(): void {
    list.replaceChildren();
    // Ask Pip search box (answered by the Ask Pip app)
    const f = document.createElement('form');
    f.className = 'sm-ask';
    f.innerHTML = '<label for="sm-ask-in" class="sr-only">Ask Pip</label><input id="sm-ask-in" placeholder="Ask Pip anything…" autocomplete="off" maxlength="120"><button type="submit" class="sm-ask-go" aria-label="Ask">✦</button>';
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = (f.querySelector('input') as HTMLInputElement).value.trim();
      if (!q) return;
      close();
      bus.emit('askpip:ask', q);
    });
    list.append(f);
    list.append(heading('Go to'));
    for (const [id, label] of SCENES) {
      list.append(row(label, undefined, () => scrollToEl(`#${id}`), { cls: 'sm-scene' }));
    }
    const phone = isPhone();
    const label = (i: StartItem) => i.dynamicLabel?.() ?? i.label;
    const byGroup = (g: StartItem['group']) => items.filter((i) => i.group === g && (!i.phoneOnly || phone)).sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
    const programs = byGroup('programs');
    if (programs.length) {
      list.append(heading('Programs'));
      programs.forEach((i) => list.append(row(label(i), i.icon, i.run, { locked: i.locked?.() })));
    }
    const main = [...byGroup('main'), ...byGroup('special')];
    if (main.length) {
      list.append(heading('More'));
      main.forEach((i) => list.append(row(label(i), i.icon, i.run, { locked: i.locked?.(), cls: i.group === 'special' ? 'sm-special' : '' })));
    }
    if (phone) {
      // the phone taskbar has no room for the hit counter, so it lives here
      const n = document.querySelector('.footer-counter .odometer')?.textContent?.trim() || '001,204';
      list.append(row(`Dreams delivered: ${n}`, undefined, () => voice.bubble(`${n} dreams delivered so far!`), { cls: 'sm-counter' }));
    }
  }

  function open(): void {
    build();
    menu.hidden = false;
    menu.classList.toggle('as-sheet', isPhone());
    btn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => menu.classList.add('in'));
    untrap = trapFocus(menu);
    menu.querySelector<HTMLElement>('.sm-item')?.focus();
  }

  function close(): void {
    if (menu.hidden) return;
    menu.classList.remove('in');
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    untrap?.();
    untrap = null;
  }

  btn.addEventListener('click', () => (menu.hidden ? open() : close()));
  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !menu.contains(e.target as Node) && !btn.contains(e.target as Node)) close();
  });
  menu.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).matches('input') && e.key !== 'Escape' && e.key !== 'ArrowDown') return;
    const all = [...menu.querySelectorAll<HTMLElement>('.sm-item')];
    const i = all.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); all[(i + 1) % all.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); all[(i - 1 + all.length) % all.length]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); btn.focus(); }
  });
}
