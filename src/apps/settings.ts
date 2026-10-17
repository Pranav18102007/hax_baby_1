import type { Feature } from '../core/registry';
import { store } from '../core/store';
import { bus } from '../core/bus';
import { isTouch } from '../core/a11y';

function radios(name: string, legend: string, options: [string, string][], value: string): string {
  return `<fieldset class="set-group"><legend>${legend}</legend>${options
    .map(([v, label]) => `<label class="set-radio"><input type="radio" name="${name}" value="${v}" ${v === value ? 'checked' : ''}><span>${label}</span></label>`)
    .join('')}</fieldset>`;
}

function toggle(name: string, label: string, on: boolean): string {
  return `<label class="set-toggle"><input type="checkbox" name="${name}" role="switch" ${on ? 'checked' : ''}><span>${label}</span></label>`;
}

const feature: Feature = {
  id: 'settings',
  priority: 'must',
  apps: [{
    id: 'settings',
    title: 'Settings',
    icon: 'icon-settings',
    width: 420,
    height: 560,
    mount(body) {
      const theme = store.get('theme.userSet') ? store.get('theme.mode') : 'clock';
      body.innerHTML = `
        <form class="settings" onsubmit="return false">
          ${toggle('sound', 'Sound on', !store.get('sound.muted'))}
          ${radios('stheme', 'Sound theme', [['auto', 'Auto (follows day/night)'], ['rattle', 'Rattle'], ['chimes', 'Chimes']], store.get('sound.theme'))}
          ${radios('theme', 'Day or night', [['day', 'Day'], ['night', 'Night'], ['clock', 'Follow the clock']], theme)}
          ${radios('display', 'Display', [['normal', 'Normal'], ['crt', 'CRT'], ['lcd', 'LCD'], ['onebit', '1-bit']], store.get('display.mode'))}
          ${radios('motion', 'Motion', [['system', 'Follow my device'], ['on', 'Reduce motion'], ['off', 'Full motion']], store.get('motion.reduced'))}
          ${isTouch() ? '' : toggle('cursor', 'Cursor sparkles', store.get('fx.cursor'))}
          ${toggle('pet', 'Ghost kitten', store.get('pet.enabled'))}
          <div class="set-forget">
            <button type="button" class="os-button" data-forget>Forget me</button>
            <p class="set-confirm" hidden>Forget your visits, secrets and settings?
              <button type="button" class="os-button" data-forget-yes>Yes, forget</button>
              <button type="button" class="os-button" data-forget-no>Keep them</button></p>
          </div>
        </form>`;
      const form = body.querySelector('form')!;
      form.addEventListener('change', (e) => {
        const t = e.target as HTMLInputElement;
        switch (t.name) {
          case 'sound': store.set('sound.muted', !t.checked); break;
          case 'stheme': store.set('sound.theme', t.value as any); break;
          case 'display': store.set('display.mode', t.value as any); break;
          case 'motion': store.set('motion.reduced', t.value as any); break;
          case 'cursor': store.set('fx.cursor', t.checked); break;
          case 'pet': store.set('pet.enabled', t.checked); break;
          case 'theme':
            if (t.value === 'clock') {
              store.set('theme.userSet', false);
              const h = (new Date().getUTCHours() + 5.5) % 24;
              store.set('theme.mode', h >= 19 || h < 6 ? 'night' : 'day');
            } else { store.set('theme.userSet', true); store.set('theme.mode', t.value as any); }
            break;
        }
      });
      const confirm = body.querySelector<HTMLElement>('.set-confirm')!;
      body.querySelector('[data-forget]')!.addEventListener('click', () => { confirm.hidden = false; });
      body.querySelector('[data-forget-no]')!.addEventListener('click', () => { confirm.hidden = true; });
      body.querySelector('[data-forget-yes]')!.addEventListener('click', () => {
        store.reset();
        confirm.textContent = 'Done. Pip has forgotten everything (except you, a little).';
        bus.emit('memory:forgotten');
      });
    },
  }],
  startMenu: [{ id: 'settings', label: 'Settings', icon: 'icon-settings', group: 'main', order: 10, run: () => bus.emit('app:open', 'settings') }],
};

export default feature;
