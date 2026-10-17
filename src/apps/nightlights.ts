import type { Feature } from '../core/registry';
import { bus } from '../core/bus';
import { audio } from '../core/audio';
import { url } from '../core/assets';

const LAMPS = [
  ['lamp-mushroom', 'Mushroom Snoozelight', 'For ghosts who are scared of the floor.'],
  ['lamp-starjar', 'Star Jar', 'Contains 41 stars. All of them sleepy.'],
  ['lamp-jellyfish', 'Jellyfish Lamp', 'Floats above the bed so the dark has company.'],
  ['lamp-cloud', 'Cloud Nap Lamp', 'Dims itself when you yawn.'],
  ['lamp-candle', 'Ghost Candle', "A candle that is also a tiny ghost. It doesn't mind."],
  ['lamp-moonbottle', 'Moon in a Bottle', 'A spare moon, for cloudy nights.'],
];

const feature: Feature = {
  id: 'nightlights',
  priority: 'must',
  apps: [{
    id: 'nightlights',
    title: 'Nightlights.exe',
    icon: 'icon-lantern',
    width: 620,
    height: 560,
    mount(body) {
      body.classList.add('nl');
      body.innerHTML = `
        <div class="nl-bar">
          <button type="button" class="os-button" data-all>All on</button>
          <button type="button" class="os-button" data-dark aria-pressed="false">Lights out</button>
        </div>
        <ul class="nl-grid">${LAMPS.map(([img, name, line], i) => `
          <li class="nl-card on">
            <img src="${url(img, 256)}" alt="" width="120" height="140">
            <h3>${name}</h3>
            <p>${line}</p>
            <label class="nl-switch"><input type="checkbox" role="switch" checked data-i="${i}" aria-label="${name}"><span>on</span></label>
          </li>`).join('')}
        </ul>`;
      const cards = [...body.querySelectorAll<HTMLElement>('.nl-card')];
      body.querySelectorAll<HTMLInputElement>('.nl-switch input').forEach((cb) => {
        cb.addEventListener('change', () => {
          const card = cards[Number(cb.dataset.i)];
          card.classList.toggle('on', cb.checked);
          cb.nextElementSibling!.textContent = cb.checked ? 'on' : 'off';
          audio.play(cb.checked ? 'chirp' : 'click');
        });
      });
      body.querySelector('[data-all]')!.addEventListener('click', () => {
        body.querySelectorAll<HTMLInputElement>('.nl-switch input').forEach((cb) => { cb.checked = true; cb.dispatchEvent(new Event('change')); });
        audio.play('sparkle');
      });
      const dark = body.querySelector<HTMLButtonElement>('[data-dark]')!;
      dark.addEventListener('click', () => {
        const on = body.classList.toggle('lights-out');
        dark.setAttribute('aria-pressed', String(on));
        dark.textContent = on ? 'Lights on' : 'Lights out';
      });
    },
  }],
  startMenu: [{ id: 'nightlights', label: 'Nightlights', icon: 'icon-lantern', group: 'programs', order: 2, run: () => bus.emit('app:open', 'nightlights') }],
};

export default feature;
