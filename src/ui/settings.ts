/** Settings window (graphics quality), used in the game and on the title screen. */
import { STR } from '../data/strings';
import { getQuality } from '../world3d/quality';
import { button, esc } from './dom';

export function settingsHtml(): string {
  const q = getQuality();
  return `<button class="close" data-act="settings" data-hint="${esc(STR.close)}">✕</button>
    <h2>${esc(STR.settings.title)}</h2>
    <h3>${esc(STR.settings.graphics)}</h3>
    <div class="choice">
      ${button(STR.settings.high, 'quality', { arg: 'high', cls: q === 'high' ? 'active' : '' })}
      ${button(STR.settings.low, 'quality', { arg: 'low', cls: q === 'low' ? 'active' : '' })}
    </div>
    <p class="note">${esc(q === 'high' ? STR.settings.highNote : STR.settings.lowNote)}</p>`;
}
