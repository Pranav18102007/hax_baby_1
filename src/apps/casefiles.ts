import type { Feature, AppDef } from '../core/registry';
import { bus } from '../core/bus';
import { url } from '../core/assets';

/**
 * Project files: a short case study for each of Pip's five projects, in a DreamOS window.
 * The problem, how it works, the numbers and the changelog — the portfolio part of the portfolio.
 */

interface CaseFile {
  id: string; title: string; icon: string; app?: string; appLabel?: string;
  role: string; problem: string; how: string[]; numbers: [string, string][]; log: [string, string][];
}

const FILES: CaseFile[] = [
  {
    id: 'case-lab', title: 'Lullaby Lab', icon: 'icon-musicbox', app: 'lullaby-lab', appLabel: 'Open Lullaby Lab.exe',
    role: 'Composer, engineer, chief knob-turner',
    problem: 'Every ghost in town was falling asleep to the same three lullabies. By week two they could hum them backwards, and humming backwards keeps you awake.',
    how: [
      'Each wind of the key writes a brand-new 16-note tune: a gentle random walk over a pentatonic or Lydian scale, always ending back home on the root.',
      'The notes play on a music box made of pure maths (a sine wave plus two bell overtones), through a soft generated reverb.',
      'Like a real music box, the tempo sags as the spring runs down. That part was Pip’s favourite to build.',
    ],
    numbers: [['Different lullabies', '4,294,967,296'], ['Knobs', '3'], ['Sneezes during testing', '2'], ['Ghosts asleep by the end of the first test', 'all of them']],
    log: [['v0.1', 'Played one note. Very loudly.'], ['v0.4', 'Added the Dreaminess knob (it’s reverb, don’t tell anyone).'], ['v1.0', 'Slows down like a real spring. Now with star keys to play your own tune.']],
  },
  {
    id: 'case-nightlights', title: 'Nightlight Collection', icon: 'icon-lantern', app: 'nightlights', appLabel: 'Open Nightlights.exe',
    role: 'Lamp designer, professional un-scarer',
    problem: 'There are six kinds of scared: the floor, the big quiet, the dark that floats, being small, closets, and thunder. One lamp can’t fix all six, so Pip made six.',
    how: [
      'Each lamp is designed around one fear: the Mushroom Snoozelight sits low for ghosts scared of the floor; the Jellyfish Lamp floats so the dark has company.',
      'In the gallery, the room is pitch black and your cursor is a lantern: a soft circle of light that reveals the lamps when you bring it close.',
      'Find one and it stays on for good. Find all six and the whole room glows.',
    ],
    numbers: [['Lamps', '6'], ['Kinds of scared fixed', '6 of 6'], ['Stars in the Star Jar', '41, all sleepy'], ['Lamps that were an accident', '1 (Moon in a Bottle)']],
    log: [['v0.1', 'A torch. Too bright, woke everyone up.'], ['v0.3', 'Dimmer, warmer, rounder. Ghosts approved.'], ['v1.0', 'The full six, plus a gallery you explore by lantern light.']],
  },
  {
    id: 'case-toys', title: 'Rattle & Block Toys', icon: 'icon-block', app: 'toybox', appLabel: 'Open Toy Box.exe',
    role: 'Toymaker, physics enthusiast, tower architect',
    problem: 'Pip kept trying to stack clouds. Clouds do not stack. Pip needed toys that fall, bounce and pile up properly, and make a satisfying noise when they do.',
    how: [
      'A real physics engine runs the toy box: every block and rattle has its own weight, bounce and friction.',
      'Grab, throw and stack with a mouse or a finger. Hits make a wooden knock that gets louder the harder they land.',
      'Stack four blocks that stay standing for two seconds and Pip calls it a tower. Flip the gravity to Moon and everything floats.',
    ],
    numbers: [['Toys in the box', '8 (up to 20)'], ['Gravity settings', 'Earth, Moon'], ['Tallest tower so far', '7 blocks'], ['Toys that hurt when they fall on you', '0, they’re all soft']],
    log: [['v0.1', 'Clouds. Did not stack.'], ['v0.5', 'Blocks with stars, moons and hearts. Stacked!'], ['v1.0', 'Rattles, throwing, Moon gravity and a tidy-up button for bedtime.']],
  },
  {
    id: 'case-route', title: 'Dream Delivery Route', icon: 'icon-portal',
    role: 'Night courier, route planner, lantern carrier',
    problem: 'Dreams have to arrive while people are asleep, still warm, and at the right house. Pip has one lantern, one pair of tiny arms and a whole town.',
    how: [
      'Every night Pip flies one golden route across the rooftops, drawn by the scroll as you follow along.',
      'Each house lights up as its dream lands. Tap a house to peek at the dream inside.',
      'The counter keeps score for tonight, and a little server remembers every dream delivered, all-time, by every visitor.',
    ],
    numbers: [['Houses per night', '5'], ['Average delivery time', '9 minutes'], ['Dreams lost', '0'], ['Dreams delivered to a cat by mistake', '1 (the cat loved it)']],
    log: [['v0.1', 'Walked. Too slow.'], ['v0.6', 'Flying, with the lantern for directions.'], ['v1.0', 'A live all-time counter, so every visit adds a dream.']],
  },
  {
    id: 'case-growth', title: 'Growth Chart', icon: 'pip-pixel',
    role: 'Junior Dream Engineer (in training)',
    problem: 'How do you know you’re getting better at things? You draw a line on the wall. Pip draws lines for skills instead of height.',
    how: [
      'Each pencil mark on the wall is a skill, drawn in as you scroll past. Tap a mark to read Pip’s honest self-review.',
      'Giggling is maxed out. Staying awake is very much a work in progress.',
    ],
    numbers: [['Skills tracked', '5'], ['Skills at 100%', '1 (giggling)'], ['Skills below 15%', '1 (staying awake)'], ['Next goals', 'Whistling; staying up until 23:01']],
    log: [['Age 0', 'Arrived by falling star.'], ['Week 1', 'First lullaby. Whole town asleep.'], ['Now', 'Five projects, one portfolio, zero naps skipped.']],
  },
];

function mount(f: CaseFile) {
  return (body: HTMLElement) => {
    body.classList.add('casefile');
    body.innerHTML = `
      <header class="cf-head"><img src="${url(f.icon, 128)}" alt="" width="40" height="40"><div><p class="cf-kicker">Project file</p><h3>${f.title}</h3><p class="cf-role">${f.role}</p></div></header>
      <h4>The problem</h4><p>${f.problem}</p>
      <h4>How it works</h4><ul>${f.how.map((h) => `<li>${h}</li>`).join('')}</ul>
      <h4>By the numbers</h4><dl class="cf-nums">${f.numbers.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <h4>Changelog</h4><ol class="cf-log">${f.log.map(([v, t]) => `<li><b>${v}</b> ${t}</li>`).join('')}</ol>
      ${f.app ? `<p><button type="button" class="os-button" data-go>▶ ${f.appLabel}</button></p>` : ''}`;
    body.querySelector('[data-go]')?.addEventListener('click', () => bus.emit('app:open', f.app));
  };
}

const apps: AppDef[] = FILES.map((f) => ({ id: f.id, title: `${f.title}.txt`, icon: f.icon, width: 480, height: 580, mount: mount(f) }));

const feature: Feature = { id: 'casefiles', priority: 'should', apps };

export default feature;
