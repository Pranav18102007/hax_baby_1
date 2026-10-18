import type { Feature } from '../core/registry';
import { bus } from '../core/bus';
import { voice } from '../core/voice';
import { audio } from '../core/audio';
import { url } from '../core/assets';
import { scrollToEl } from '../core/scroll';

/**
 * Ask Pip.exe: a tiny rule-based chat (keywords → answers in Pip's voice). Tier 3 "chats back".
 * Also reachable from the search box at the top of the Start menu.
 */

interface Rule { k: RegExp; a: string | (() => string); go?: { label: string; run: () => void } }

const JOKES = [
  'Why did the ghost go to the party? For the boos! …I’ll see myself out.',
  'What do you call a sleeping dinosaur? A dino-snore!',
  'Why don’t moons ever get lonely? They have lots of fans. Well, stars.',
  'What do clouds wear under their clothes? Thunderwear!',
];
const open = (id: string) => () => bus.emit('app:open', id);

const RULES: Rule[] = [
  { k: /\b(hi|hello|hey|hiya|yo)\b/, a: 'Hi hi! I’m Pip, Junior Dream Engineer. Ask me anything (I know about six things).' },
  { k: /\b(who|what) are you|your name|about you/, a: 'I’m Pip! A baby made of starlight who builds the dreams you fall asleep inside. I arrived by falling star.' },
  { k: /\b(age|old|born|birthday)\b/, a: 'I’m only a few weeks old. A star landed in an empty cradle, and plip, there I was.' },
  { k: /\b(silence|quiet|shh)\b/, a: 'Please don’t say that word. It gives me the shivers. Noise is much nicer!' },
  { k: /\b(lullab|music|song|sing|hum)/, a: 'I compose new lullabies in my Lullaby Lab, and my Mixtape has all the nursery rhymes!', go: { label: '▶ Open Lullaby Lab', run: open('lullaby-lab') } },
  { k: /\b(nightlight|lamp|dark|scared|afraid|fear)/, a: 'Six lamps for six kinds of scared. The dark is much friendlier with a little light.', go: { label: '▶ Open Nightlights', run: open('nightlights') } },
  { k: /\b(toy|block|rattle|tower|stack|physics)/, a: 'I invent toys between naps! Try stacking four blocks into a tower.', go: { label: '▶ Open Toy Box', run: open('toybox') } },
  { k: /\b(dream|deliver|route|house)/, a: 'Every night I fly one golden route over the rooftops and drop a dream at five houses.', go: { label: '↓ Go to the route', run: () => scrollToEl('#route') } },
  { k: /\b(secret|easter|hidden|egg)/, a: 'A secret? Me? Hmm… try looking up at the sky. Or ask the sleepy sock what I hate most.' },
  { k: /\b(ghost|boo)/, a: 'The little ghosts are my friends. They can’t sleep without a lullaby, so I hum them one every night.' },
  { k: /\bmoon\b/, a: 'The Moon reached down and helped make me. She’s sort of my mum. She’s very sleepy.' },
  { k: /\b(colou?r|favou?rite)/, a: 'Lavender. And the colour of warm milk. And gold, the sparkly kind.' },
  { k: /\b(eat|food|milk|hungry|pancake|snack)/, a: 'Warm milk and pancakes. Not at the same time. …Okay, sometimes at the same time.' },
  { k: /\b(sleep|tired|nap|bed|yawn)/, a: 'I LOVE naps. My growth chart says I’m only 12% good at staying awake. Working on it. Zzz.' },
  { k: /\b(made|built|build|code|hackathon|hax|creator|team)/, a: 'Anushka Bhalekar dreamed up my world, painted it and gave me my voice. Pranav Shinde built it with Claude Code, with guidance from Atharva Baodhankar. For haX.baby’s Baby’s First Website!' },
  { k: /\b(joke|funny|laugh)/, a: () => JOKES[Math.floor(Math.random() * JOKES.length)] },
  { k: /\b(unicorn|nightmare|bad dream|virus)/, a: 'Don’t open totally_not_a_nightmare.exe. …Okay, open it. The unicorn will save us.' },
  { k: /\b(cat|kitten|pet|bunny|bat)/, a: 'My ghost kitten follows your cursor around. Stroke it gently and it purrs.' },
  { k: /\b(time|clock|late)/, a: () => { const t = new Date(); return `It’s ${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} where you are. My bedtime is 11pm. Shh.`; } },
  { k: /\b(love|like you|cute|best)/, a: 'Aww! I love you too. And blankets. You and blankets.' },
  { k: /\b(bye|good ?night|night night|see you)/, a: 'Nigh-night! Come back tomorrow, I’ll save you a dream.' },
  { k: /\b(help|what can|how)/, a: 'Ask me about lullabies, nightlights, toys, dreams, the Moon, ghosts, or… secrets. Or ask for a joke!' },
];

function answer(q: string): Rule | null {
  const s = q.toLowerCase();
  return RULES.find((r) => r.k.test(s)) ?? null;
}

let pending: string | null = null;

function mount(body: HTMLElement): () => void {
  body.classList.add('askpip');
  body.innerHTML = `
    <div class="ap-log" role="log" aria-live="polite"></div>
    <div class="ap-chips">${['Who are you?', 'Tell me a joke', 'Any secrets?', 'What do you eat?'].map((c) => `<button type="button" class="os-button ap-chip">${c}</button>`).join('')}</div>
    <form class="ap-form"><label for="ap-in" class="sr-only">Ask Pip a question</label><input id="ap-in" maxlength="120" placeholder="Ask Pip anything…" autocomplete="off"><button class="os-button" type="submit">Ask</button></form>`;
  const log = body.querySelector<HTMLElement>('.ap-log')!;
  const form = body.querySelector<HTMLFormElement>('form')!;
  const input = form.querySelector('input')!;
  let alive = true;

  const add = (who: 'me' | 'pip', text: string) => {
    const m = document.createElement('div');
    m.className = `ap-msg ap-${who}`; // not plain `.pip`: that's the hero Pip's class
    if (who === 'pip') m.innerHTML = `<img src="${url('pip-pixel', 64)}" alt="" width="28" height="28">`;
    const p = document.createElement('p');
    p.textContent = text;
    m.appendChild(p);
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return m;
  };
  const ask = (q: string) => {
    q = q.trim();
    if (!q) return;
    add('me', q);
    audio.play('click');
    const thinking = add('pip', 'Hmm… let me think…');
    thinking.classList.add('thinking');
    voice.say('V23', null);
    window.setTimeout(() => {
      if (!alive) return;
      thinking.remove();
      const r = answer(q);
      if (!r) {
        add('pip', 'I don’t know that one… yet! I’m only a baby. Try asking about lullabies, ghosts or secrets.');
        voice.say('V24', null, true);
        return;
      }
      const m = add('pip', typeof r.a === 'function' ? r.a() : r.a);
      audio.play('pop');
      if (r.go) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'os-button ap-go'; b.textContent = r.go.label;
        b.addEventListener('click', r.go.run);
        m.appendChild(b);
      }
    }, 900);
  };

  add('pip', 'Hi! I’m Pip. What do you want to know?');
  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); input.value = ''; });
  body.querySelectorAll<HTMLButtonElement>('.ap-chip').forEach((c) => c.addEventListener('click', () => ask(c.textContent!)));
  if (pending) { const q = pending; pending = null; window.setTimeout(() => ask(q), 250); }
  input.focus();
  const off = bus.on('askpip:ask-open', (q: string) => ask(q));
  return () => { alive = false; off(); };
}

const feature: Feature = {
  id: 'ask-pip',
  priority: 'could',
  init() {
    bus.on('askpip:ask', (q: string) => {
      const win = document.querySelector('.askpip');
      if (win) bus.emit('askpip:ask-open', q);
      else { pending = q; bus.emit('app:open', 'ask-pip'); }
    });
  },
  apps: [{ id: 'ask-pip', title: 'Ask Pip.exe', icon: 'pip-pixel', width: 420, height: 520, mount }],
  startMenu: [{ id: 'ask-pip', label: 'Ask Pip', icon: 'pip-pixel', group: 'programs', order: 6, run: () => bus.emit('app:open', 'ask-pip') }],
};

export default feature;
