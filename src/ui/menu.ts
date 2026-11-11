/**
 * Title screen. With a saved game it offers "Continue" and "New game";
 * without one the game starts straight away.
 */
import { STR } from '../data/strings';
import type { SaveData } from '../state/GameState';
import { setQuality, type Quality } from '../world3d/quality';
import { button, el, esc, setHtml } from './dom';
import { settingsHtml } from './settings';

export function showMenu(parent: HTMLElement, save: SaveData, choose: (choice: 'continue' | 'new') => void): void {
  const menu = el('div', 'ui-block');
  menu.id = 'menu';
  menu.innerHTML = `
    <div class="lanterns">🏮🏮🏮</div>
    <h1>${esc(STR.title)}</h1>
    <div class="saved">${esc(STR.menu.saved(save.day, save.level, save.money))}</div>
    ${button(STR.menu.continue, 'continue', { cls: 'active' })}
    ${button(STR.menu.newGame, 'new')}
    ${button(STR.menu.settings, 'settings', { cls: 'secondary' })}`;
  // The settings window uses the paper styles of the game interface.
  const ui = el('div');
  ui.id = 'ui';
  const settings = el('div', 'window settings-panel paper ui-block hidden');
  ui.appendChild(settings);
  menu.appendChild(ui);
  parent.appendChild(menu);

  let confirmNew = false;
  const close = () => {
    window.removeEventListener('keydown', onKey);
    menu.remove();
  };
  const toggleSettings = (open: boolean) => {
    settings.classList.toggle('hidden', !open);
    if (open) setHtml(settings, settingsHtml());
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Escape') toggleSettings(false);
    if (e.code === 'Enter' && settings.classList.contains('hidden')) {
      close();
      choose('continue');
    }
  };
  window.addEventListener('keydown', onKey);
  menu.addEventListener('mousedown', (e) => e.preventDefault());

  menu.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target) return;
    switch (target.dataset.act) {
      case 'continue':
        close();
        return choose('continue');
      case 'new':
        // A second click confirms, so a saved game is not lost by accident.
        if (!confirmNew) {
          confirmNew = true;
          target.textContent = STR.menu.confirmNew;
          return;
        }
        close();
        return choose('new');
      case 'settings':
        return toggleSettings(settings.classList.contains('hidden'));
      case 'quality':
        setQuality(target.dataset.arg as Quality);
        return toggleSettings(true);
    }
  });
}
