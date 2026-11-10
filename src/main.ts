import * as Phaser from 'phaser';
import { MarketScene } from './scenes/MarketScene';
import { MenuScene } from './scenes/MenuScene';
import { UIScene } from './scenes/UIScene';
import { state } from './state/GameState';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  // See-through: the 3D world is drawn below the Phaser canvas, which only shows the interface.
  transparent: true,
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
