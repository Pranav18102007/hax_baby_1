import type { Feature } from '../core/registry';
import { api, type Wish } from '../core/api';
import { audio } from '../core/audio';
import { bus } from '../core/bus';
import { url } from '../core/assets';
import { voice } from '../core/voice';
import { announce } from '../core/a11y';

/**
 * Guestbook.exe (+2 side quest, Tier 3 with the backend on).
 * Without the backend it still works: wishes are kept on this device and marked as such.
 */

const STICKERS: Record<string, string> = {
  ghost: 'ghost-plain', duck: 'duck-nightcap', star: 'toy-star', moon: 'toy-moon', kitten: 'sticker-kitten', unicorn: 'sticker-unicorn',
};

const SEED: Wish[] = [
  { id: 's1', name: 'a sleepy ghost', wish: 'Thank you for the whale dream. 10/10 would float again.', sticker: 'ghost', createdAt: Date.parse('2026-10-17T21:30:00+05:30') },
  { id: 's2', name: 'Moon', wish: 'Proud of you, little one. Now go to bed.', sticker: 'moon', createdAt: Date.parse('2026-10-17T22:10:00+05:30') },
  { id: 's3', name: 'rubber duck #3', wish: 'More bath dreams please. Quack.', sticker: 'duck', createdAt: Date.parse('2026-10-17T23:05:00+05:30') },
];

const LOCAL_KEY = 'pip.wishes';
const DRAFT_KEY = 'pip.wishdraft';
const BLOCK = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'slut', 'whore', 'chutiya', 'madarchod', 'bhenchod', 'randi'];

function localWishes(): Wish[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as Wish[]; } catch { return []; }
}
function saveLocal(w: Wish[]): void { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(w.slice(0, 30))); } catch { /* ignore */ } }

function ago(t: number): string {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

function card(w: Wish, pending = false, local = false): HTMLLIElement {
  const li = document.createElement('li');
  li.className = `wish${pending ? ' pending' : ''}`;
  const img = document.createElement('img');
  img.src = url(STICKERS[w.sticker] ?? 'ghost-plain', 128);
  img.alt = '';
  img.width = 44; img.height = 44;
  const box = document.createElement('div');
  const head = document.createElement('p');
  head.className = 'wish-head';
  const name = document.createElement('b'); name.textContent = w.name; // textContent only: never HTML
  const when = document.createElement('span'); when.textContent = pending ? ' · sending…' : ` · ${ago(w.createdAt)}${local ? ' · saved on this device' : ''}`;
  head.append(name, when);
  const text = document.createElement('p'); text.className = 'wish-text'; text.textContent = w.wish;
  box.append(head, text);
  li.append(img, box);
  return li;
}

let gbCount = 0;
function render(root: HTMLElement): () => void {
  const errId = `gb-err-${++gbCount}`;
  root.innerHTML = `
    <form class="gb-form" novalidate>
      <div class="gb-fields">
        <label class="gb-field"><span>Your name</span><input name="name" maxlength="24" required autocomplete="nickname" aria-describedby="${errId}"></label>
        <label class="gb-field gb-wish"><span>Your dream wish <i class="gb-left" aria-live="polite">140 left</i></span><textarea name="wish" maxlength="140" rows="2" required aria-describedby="${errId}"></textarea></label>
      </div>
      <fieldset class="gb-stickers"><legend>Pick a sticker</legend>
        ${Object.entries(STICKERS).map(([id, img], i) => `<label><input type="radio" name="sticker" value="${id}" ${i === 0 ? 'checked' : ''}><img src="${url(img, 128)}" alt="${id}" width="40" height="40"></label>`).join('')}
      </fieldset>
      <input class="gb-hp" name="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="gb-actions"><button type="submit" class="os-button gb-send">Send wish ✦</button><p class="gb-err" id="${errId}" role="alert"></p></div>
    </form>
    <ul class="gb-wall" aria-label="Dream wishes"></ul>
    <button type="button" class="os-button gb-more" hidden>Load older wishes</button>`;

  const form = root.querySelector<HTMLFormElement>('form')!;
  const wall = root.querySelector<HTMLUListElement>('.gb-wall')!;
  const err = root.querySelector<HTMLElement>('.gb-err')!;
  const left = root.querySelector<HTMLElement>('.gb-left')!;
  const more = root.querySelector<HTMLButtonElement>('.gb-more')!;
  const send = root.querySelector<HTMLButtonElement>('.gb-send')!;
  const wishEl = form.elements.namedItem('wish') as HTMLTextAreaElement;
  const nameEl = form.elements.namedItem('name') as HTMLInputElement;
  let cursor: number | null = 0;

  try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); if (d) { nameEl.value = d.name ?? ''; wishEl.value = d.wish ?? ''; } } catch { /* ignore */ }
  const updateLeft = () => { left.textContent = `${140 - wishEl.value.length} left`; };
  updateLeft();
  form.addEventListener('input', () => {
    updateLeft();
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ name: nameEl.value, wish: wishEl.value })); } catch { /* ignore */ }
  });

  const load = async () => {
    if (!api.enabled) {
      wall.replaceChildren(...localWishes().map((w) => card(w, false, true)), ...SEED.map((w) => card(w)));
      return;
    }
    const res = await api.getWishes(cursor ?? 0);
    if (!res || !('items' in res)) {
      if (cursor === 0) wall.replaceChildren(...SEED.map((w) => card(w)));
      return;
    }
    if (cursor === 0) wall.replaceChildren();
    res.items.forEach((w) => wall.append(card(w)));
    if (cursor === 0 && res.items.length < 3) SEED.forEach((w) => wall.append(card(w)));
    cursor = res.next;
    more.hidden = cursor === null;
  };
  void load();
  more.addEventListener('click', () => void load());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const fd = new FormData(form);
    const w = { name: String(fd.get('name') || '').trim(), wish: String(fd.get('wish') || '').trim(), sticker: String(fd.get('sticker') || 'ghost'), hp: String(fd.get('hp') || '') };
    if (!w.name || !w.wish) { err.textContent = 'Pip needs a name and a wish!'; audio.play('error'); (w.name ? wishEl : nameEl).focus(); return; }
    const flat = (w.name + w.wish).toLowerCase().replace(/[^a-z]/g, '');
    if (/(https?:|www\.|\.(com|net|org|in|io)\b)/i.test(w.name + ' ' + w.wish) || BLOCK.some((b) => flat.includes(b))) {
      err.textContent = "Pip doesn't know that word. Try a kinder one?"; audio.play('error'); return;
    }
    const temp: Wish = { id: 'tmp', ...w, createdAt: Date.now() };
    const pending = card(temp, true);
    wall.prepend(pending);
    send.disabled = true; send.textContent = 'Sending…';
    const done = (ok: boolean, local = false) => {
      send.disabled = false; send.textContent = 'Send wish ✦';
      if (!ok) { pending.remove(); return; }
      pending.replaceWith(card(temp, false, local));
      form.reset(); updateLeft();
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      audio.play('sparkle');
      voice.say('V30', send, true);
      announce('Your wish was sent');
    };

    if (!api.enabled) { saveLocal([temp, ...localWishes()]); done(true, true); return; }
    const res = await api.postWish(w);
    if (res?.item || (res && !res.error)) done(true);
    else if (res?.error === 'slow_down') { err.textContent = 'Slow down, the dream post is still flying! Try again in a minute.'; done(false); }
    else if (res?.error === 'blocked') { err.textContent = "Pip doesn't know that word. Try a kinder one?"; done(false); }
    else if (res?.error) { err.textContent = 'Hmm, that wish is a little too long.'; done(false); }
    else { err.textContent = 'The dream post fell asleep. Your wish is saved; tap Send to try again.'; done(false); }
  });

  return () => undefined;
}

const feature: Feature = {
  id: 'guestbook',
  priority: 'must',
  init() {
    const inPage = document.getElementById('gb-body');
    if (inPage) render(inPage);
  },
  apps: [{ id: 'guestbook', title: 'Guestbook.exe', icon: 'icon-guestbook', width: 560, height: 600, mount: (b) => render(b) }],
  startMenu: [{ id: 'guestbook', label: 'Guestbook', icon: 'icon-guestbook', group: 'programs', order: 5, run: () => bus.emit('app:open', 'guestbook') }],
};

export default feature;
