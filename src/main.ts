import * as Phaser from 'phaser';
import { COLORS } from './config';
import { MarketScene } from './scenes/MarketScene';
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
  // Only the first scene starts automatically; MarketScene launches UIScene.
  scene: [MarketScene, UIScene],
});

// Handy for debugging in the browser console during development.
if (import.meta.env.DEV) {
  Object.assign(window, { game, state });
}
