import * as Phaser from 'phaser';
import { COLORS } from './config';
import { MarketScene } from './scenes/MarketScene';
import { MenuScene } from './scenes/MenuScene';
import { UIScene } from './scenes/UIScene';
import { state } from './state/GameState';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.background,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  // Only the first scene starts automatically: the menu starts MarketScene, which launches UIScene.
  scene: [MenuScene, MarketScene, UIScene],
});

// Handy for debugging in the browser console during development.
if (import.meta.env.DEV) {
  Object.assign(window, { game, state });
}
