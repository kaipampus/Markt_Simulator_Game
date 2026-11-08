import * as Phaser from 'phaser';
import { BAR_HEIGHT, COLORS, FONT_TITLE, FONT_UI, HUD_HEIGHT } from '../config';
import { BUILDINGS } from '../data/buildings';
import { STR } from '../data/strings';
import { TEX } from '../gfx/textures';
import { state, type Tool } from '../state/GameState';

const BTN_W = 98;
const BTN_H = 86;
const BTN_GAP = 8;

interface Button {
  tool: NonNullable<Tool>;
  cost: number;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  costText?: Phaser.GameObjects.Text;
  hovered: boolean;
}

const HOTKEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'] as const;

/** Screen-space interface on top of the market: top bar, hint line and build bar. */
export class UIScene extends Phaser.Scene {
  private hud!: Phaser.GameObjects.Graphics;
  private bar!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private coinIcon!: Phaser.GameObjects.Image;
  private spiritText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private buttons: Button[] = [];
  private unsubscribe: Array<() => void> = [];

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.hud = this.add.graphics();
    this.bar = this.add.graphics();

    this.title = this.add.text(16, HUD_HEIGHT / 2, STR.title, {
      fontFamily: FONT_TITLE,
      fontSize: '20px',
      color: COLORS.uiText,
    });
    this.title.setOrigin(0, 0.5).setShadow(0, 2, '#000000', 4, false, true);

    this.coinIcon = this.add.image(0, HUD_HEIGHT / 2, TEX.coin);
    this.moneyText = this.add
      .text(0, HUD_HEIGHT / 2, '', { fontFamily: FONT_UI, fontSize: '18px', fontStyle: 'bold', color: COLORS.uiGold })
      .setOrigin(1, 0.5);
    this.spiritText = this.add
      .text(0, HUD_HEIGHT / 2, '', { fontFamily: FONT_UI, fontSize: '15px', color: COLORS.uiTextDim })
      .setOrigin(1, 0.5);

    this.hint = this.add
      .text(0, 0, '', {
        fontFamily: FONT_UI,
        fontSize: '13px',
        color: COLORS.uiText,
        backgroundColor: 'rgba(11,15,26,0.72)',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 1);

    BUILDINGS.forEach((def, i) => {
      this.buttons.push(this.makeButton({ kind: 'build', id: def.id }, STR.buildings[def.id], def.cost, TEX.building(def.id), i + 1));
    });
    this.buttons.push(this.makeButton({ kind: 'demolish' }, STR.demolish, 0, TEX.dust, 'X'));

    this.setupKeys();

    this.unsubscribe.push(
      state.on('money', () => this.refreshMoney(true)),
      state.on('tool', () => this.refreshTool()),
      state.on('spirits', (n) => this.spiritText.setText(STR.spirits(n))),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe.forEach((u) => u()));
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));

    this.spiritText.setText(STR.spirits(state.spiritCount));
    this.refreshMoney(false);
    this.refreshTool();
    this.layout();
  }

  // ---------------------------------------------------------------------------

  private makeButton(tool: NonNullable<Tool>, label: string, cost: number, texture: string, hotkey: number | string): Button {
    const container = this.add.container(0, 0);
    const bg = this.add
      .rectangle(0, 0, BTN_W, BTN_H, COLORS.uiButton)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.uiPanelEdge);

    // Icon scaled to fit the upper part of the button.
    const icon = this.add.image(BTN_W / 2, 46, texture).setOrigin(0.5, 1);
    const fit = Math.min(60 / icon.width, 40 / icon.height, 1);
    icon.setScale(tool.kind === 'demolish' ? 2.2 : fit);
    if (tool.kind === 'demolish') {
      icon.setY(30).setOrigin(0.5).setTint(0xff8a7a);
    }

    const name = this.add
      .text(BTN_W / 2, 52, label, { fontFamily: FONT_UI, fontSize: '12px', color: COLORS.uiText, align: 'center' })
      .setOrigin(0.5, 0);
    const key = this.add
      .text(6, 4, String(hotkey), { fontFamily: FONT_UI, fontSize: '11px', color: COLORS.uiTextDim })
      .setOrigin(0, 0);

    const parts: Phaser.GameObjects.GameObject[] = [bg, icon, name, key];
    let costText: Phaser.GameObjects.Text | undefined;
    if (cost > 0) {
      const coin = this.add.image(BTN_W / 2 - 12, 75, TEX.coin).setScale(0.6);
      costText = this.add
        .text(BTN_W / 2 - 4, 75, String(cost), { fontFamily: FONT_UI, fontSize: '12px', fontStyle: 'bold', color: COLORS.uiGold })
        .setOrigin(0, 0.5);
      parts.push(coin, costText);
    }
    container.add(parts);

    const button: Button = { tool, cost, container, bg, icon, costText, hovered: false };

    bg.setInteractive({ useHandCursor: true });
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      button.hovered = true;
      this.styleButton(button);
    });
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      button.hovered = false;
      this.styleButton(button);
    });
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.button === 0) this.toggleTool(tool);
    });

    return button;
  }

  private isSelected(b: Button): boolean {
    const t = state.tool;
    if (!t) return false;
    if (t.kind === 'demolish') return b.tool.kind === 'demolish';
    return b.tool.kind === 'build' && b.tool.id === t.id;
  }

  private toggleTool(tool: NonNullable<Tool>): void {
    const current = state.tool;
    const same =
      current !== null &&
      current.kind === tool.kind &&
      (tool.kind === 'demolish' || (current.kind === 'build' && current.id === tool.id));
    state.setTool(same ? null : tool);
  }

  private styleButton(b: Button): void {
    const selected = this.isSelected(b);
    const affordable = b.cost === 0 || state.canAfford(b.cost);
    b.bg.setFillStyle(selected ? COLORS.uiButtonActive : b.hovered ? COLORS.uiButtonHover : COLORS.uiButton);
    b.bg.setStrokeStyle(selected ? 2 : 1, selected ? COLORS.uiAccent : COLORS.uiPanelEdge);
    b.icon.setAlpha(affordable ? 1 : 0.4);
    b.costText?.setColor(affordable ? COLORS.uiGold : COLORS.uiRed);
  }

  private setupKeys(): void {
    const kb = this.input.keyboard!;
    this.buttons.forEach((b, i) => {
      if (b.tool.kind === 'build' && i < HOTKEYS.length) kb.on(`keydown-${HOTKEYS[i]}`, () => this.toggleTool(b.tool));
    });
    kb.on('keydown-X', () => this.toggleTool({ kind: 'demolish' }));
    kb.on('keydown-ESC', () => state.setTool(null));
  }

  // ---------------------------------------------------------------------------

  private refreshMoney(pop: boolean): void {
    this.moneyText.setText(String(state.money));
    this.buttons.forEach((b) => this.styleButton(b));
    if (pop) {
      this.tweens.killTweensOf(this.moneyText);
      this.moneyText.setScale(1.2);
      this.tweens.add({ targets: this.moneyText, scale: 1, duration: 220, ease: 'Back.Out' });
    }
    this.layoutHud();
  }

  private refreshTool(): void {
    const t = state.tool;
    this.hint.setText(!t ? STR.hintIdle : t.kind === 'build' ? STR.hintPlacing : STR.hintDemolish);
    this.buttons.forEach((b) => this.styleButton(b));
  }

  private layoutHud(): void {
    const w = this.scale.width;
    this.moneyText.setPosition(w - 16, HUD_HEIGHT / 2);
    this.coinIcon.setPosition(w - 16 - this.moneyText.width - 16, HUD_HEIGHT / 2);
    this.spiritText.setPosition(this.coinIcon.x - 26, HUD_HEIGHT / 2);
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    this.hud.clear();
    this.hud.fillStyle(COLORS.uiPanel, 0.92).fillRect(0, 0, w, HUD_HEIGHT);
    this.hud.fillStyle(COLORS.uiAccent, 0.5).fillRect(0, HUD_HEIGHT - 2, w, 2);

    this.bar.clear();
    this.bar.fillStyle(COLORS.uiPanel, 0.94).fillRect(0, h - BAR_HEIGHT, w, BAR_HEIGHT);
    this.bar.fillStyle(COLORS.uiAccent, 0.5).fillRect(0, h - BAR_HEIGHT, w, 2);

    const total = this.buttons.length * BTN_W + (this.buttons.length - 1) * BTN_GAP;
    let x = Math.round((w - total) / 2);
    const y = h - BAR_HEIGHT + Math.round((BAR_HEIGHT - BTN_H) / 2) + 1;
    for (const b of this.buttons) {
      b.container.setPosition(x, y);
      x += BTN_W + BTN_GAP;
    }

    this.hint.setPosition(w / 2, h - BAR_HEIGHT - 10);
    this.layoutHud();
  }
}
