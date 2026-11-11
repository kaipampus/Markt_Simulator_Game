import '@fontsource/kaisei-decol/latin-700.css';
import './ui/style.css';
import * as Phaser from 'phaser';
import { MarketScene } from './scenes/MarketScene';
import { state } from './state/GameState';
import { clearSave, loadSave } from './state/storage';
import { showMenu } from './ui/menu';

/** Start the market. Phaser only runs the game loop and the mouse on the map; it draws nothing. */
function startGame(): void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    transparent: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    scene: [MarketScene],
  });
  // Handy for debugging in the browser console during development.
  if (import.meta.env.DEV) Object.assign(window, { game, state });
}

// Title screen only with a saved game; otherwise straight into the market.
const save = loadSave();
if (save) {
  showMenu(document.body, save, (choice) => {
    if (choice === 'continue') state.restore(save);
    else clearSave();
    startGame();
  });
} else {
  startGame();
}
