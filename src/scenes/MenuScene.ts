import * as Phaser from 'phaser';
import { COLORS, FONT_TITLE, FONT_UI } from '../config';
import { STR } from '../data/strings';
import { state } from '../state/GameState';
import { clearSave, loadSave } from '../state/storage';

/**
 * Title screen. With a saved game it offers "Continue" and "New game";
 * without one it goes straight into the market.
 */
export class MenuScene extends Phaser.Scene {
  private confirmNew = false;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    const save = loadSave();
    if (!save) {
      this.scene.start('MarketScene');
      return;
    }

    const { width, height } = this.scale;
    const cx = width / 2;
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.add
      .text(cx, height * 0.3, STR.title, { fontFamily: FONT_TITLE, fontSize: '42px', color: COLORS.uiGold })
      .setOrigin(0.5)
      .setShadow(0, 3, '#000000', 6, false, true);
    this.add
      .text(cx, height * 0.3 + 46, STR.menu.saved(save.day, save.level, save.money), {
        fontFamily: FONT_UI,
        fontSize: '14px',
        color: COLORS.uiTextDim,
      })
      .setOrigin(0.5);

    this.button(cx, height * 0.5, STR.menu.continue, () => {
      state.restore(save);
      this.scene.start('MarketScene');
    });
    const newGame = this.button(cx, height * 0.5 + 56, STR.menu.newGame, () => {
      // A second click confirms, so a saved game is not lost by accident.
      if (!this.confirmNew) {
        this.confirmNew = true;
        newGame.setText(STR.menu.confirmNew);
        return;
      }
      clearSave();
      this.scene.start('MarketScene');
    });
  }

  private button(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    const bg = this.add
      .rectangle(x, y, 300, 42, COLORS.uiButton)
      .setStrokeStyle(1, COLORS.uiPanelEdge)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, { fontFamily: FONT_UI, fontSize: '16px', fontStyle: 'bold', color: COLORS.uiText })
      .setOrigin(0.5);
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => bg.setStrokeStyle(2, COLORS.uiAccent));
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => bg.setStrokeStyle(1, COLORS.uiPanelEdge));
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, onClick);
    return text;
  }
}
