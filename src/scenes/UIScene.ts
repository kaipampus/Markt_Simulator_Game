import * as Phaser from 'phaser';
import { BAR_HEIGHT, COLORS, FONT_TITLE, FONT_UI, HUD_HEIGHT } from '../config';
import { BUILDINGS, getBuilding } from '../data/buildings';
import { STR } from '../data/strings';
import { TEX } from '../gfx/textures';
import { state, type NightReport, type Tool } from '../state/GameState';

const BTN_W = 82;
const BTN_H = 84;
const BTN_GAP = 6;
const REPORT_MS = 8000;

interface Button {
  tool: NonNullable<Tool>;
  cost: number;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  costText?: Phaser.GameObjects.Text;
  hovered: boolean;
}

const HOTKEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'ZERO'] as const;
const HOTKEY_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/** Screen-space interface on top of the market: top bar, clock, hint line, build bar, reports. */
export class UIScene extends Phaser.Scene {
  private hud!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private bar!: Phaser.GameObjects.Graphics;
  private clockText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private coinIcon!: Phaser.GameObjects.Image;
  private spiritText!: Phaser.GameObjects.Text;
  private repText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private report?: Phaser.GameObjects.Container;
  private buttons: Button[] = [];
  private unsubscribe: Array<() => void> = [];

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.hud = this.add.graphics();
    this.bar = this.add.graphics();

    this.title = this.add
      .text(16, HUD_HEIGHT / 2, STR.title, { fontFamily: FONT_TITLE, fontSize: '19px', color: COLORS.uiText })
      .setOrigin(0, 0.5)
      .setShadow(0, 2, '#000000', 4, false, true);
    this.clockText = this.add
      .text(0, HUD_HEIGHT / 2, '', { fontFamily: FONT_UI, fontSize: '15px', fontStyle: 'bold', color: COLORS.uiText })
      .setOrigin(0.5, 0.5);

    this.coinIcon = this.add.image(0, HUD_HEIGHT / 2, TEX.coin);
    this.moneyText = this.add
      .text(0, HUD_HEIGHT / 2, '', { fontFamily: FONT_UI, fontSize: '18px', fontStyle: 'bold', color: COLORS.uiGold })
      .setOrigin(1, 0.5);
    this.repText = this.add
      .text(0, HUD_HEIGHT / 2, '', { fontFamily: FONT_UI, fontSize: '14px', color: COLORS.uiText })
      .setOrigin(1, 0.5);
    this.spiritText = this.add
      .text(0, HUD_HEIGHT / 2, '', { fontFamily: FONT_UI, fontSize: '14px', color: COLORS.uiTextDim })
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
      this.buttons.push(
        this.makeButton({ kind: 'build', id: def.id }, STR.buildings[def.id], def.cost, TEX.building(def.id), HOTKEY_LABELS[i] ?? ''),
      );
    });
    this.buttons.push(this.makeButton({ kind: 'demolish' }, STR.demolish, 0, TEX.dust, 'X'));

    this.setupKeys();

    this.unsubscribe.push(
      state.on('money', () => this.refreshMoney(true)),
      state.on('tool', () => this.refreshButtons()),
      state.on('report', (r) => this.showReport(r)),
      state.on('gameover', () => this.showGameOver()),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe.forEach((u) => u()));
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));

    this.refreshMoney(false);
    this.refreshButtons();
    this.layout();
  }

  /** Texts that change continuously (clock, counters, hint). */
  update(): void {
    let clock: string;
    if (state.phase === 'day') clock = STR.clockDay(state.day, state.timeLeft);
    else if (state.isDawn) clock = STR.clockDawn(state.timeLeft);
    else clock = STR.clockNight(state.day, state.timeLeft);
    if (this.clockText.text !== clock) {
      this.clockText.setText(clock).setColor(state.isDawn ? COLORS.uiRed : COLORS.uiText);
      this.layoutHud();
    }

    const rep = STR.reputation(state.reputation);
    if (this.repText.text !== rep) {
      this.repText.setText(rep).setColor(state.reputation <= 15 ? COLORS.uiRed : COLORS.uiText);
      this.layoutHud();
    }
    const spirits = STR.spirits(state.spiritCount);
    if (this.spiritText.text !== spirits) {
      this.spiritText.setText(spirits);
      this.layoutHud();
    }

    const t = state.tool;
    let hint: string;
    if (!t) hint = state.day === 1 && state.phase === 'day' ? STR.hintFirstDay : STR.hintIdle;
    else if (t.kind === 'demolish') hint = STR.hintDemolish;
    else hint = getBuilding(t.id).dragPlace ? STR.hintPainting : STR.hintPlacing;
    if (this.hint.text !== hint) this.hint.setText(hint);
  }

  // ---------------------------------------------------------------------------
  // build bar
  // ---------------------------------------------------------------------------

  private makeButton(tool: NonNullable<Tool>, label: string, cost: number, texture: string, hotkey: string): Button {
    const container = this.add.container(0, 0);
    const bg = this.add
      .rectangle(0, 0, BTN_W, BTN_H, COLORS.uiButton)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.uiPanelEdge);

    // Icon scaled to fit the upper part of the button.
    const icon = this.add.image(BTN_W / 2, 46, texture).setOrigin(0.5, 1);
    if (tool.kind === 'demolish') {
      icon.setScale(2.2).setY(30).setOrigin(0.5).setTint(0xff8a7a);
    } else {
      icon.setScale(Math.min(54 / icon.width, 38 / icon.height, 1));
    }

    const name = this.add
      .text(BTN_W / 2, 50, label, { fontFamily: FONT_UI, fontSize: '11px', color: COLORS.uiText, align: 'center' })
      .setOrigin(0.5, 0);
    const key = this.add
      .text(5, 3, hotkey, { fontFamily: FONT_UI, fontSize: '10px', color: COLORS.uiTextDim })
      .setOrigin(0, 0);

    const parts: Phaser.GameObjects.GameObject[] = [bg, icon, name, key];
    let costText: Phaser.GameObjects.Text | undefined;
    if (cost > 0) {
      const coin = this.add.image(BTN_W / 2 - 11, 72, TEX.coin).setScale(0.55);
      costText = this.add
        .text(BTN_W / 2 - 4, 72, String(cost), { fontFamily: FONT_UI, fontSize: '11px', fontStyle: 'bold', color: COLORS.uiGold })
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
    if (state.gameOver) return;
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

  private refreshButtons(): void {
    this.buttons.forEach((b) => this.styleButton(b));
  }

  private refreshMoney(pop: boolean): void {
    this.moneyText.setText(String(state.money));
    this.refreshButtons();
    if (pop) {
      this.tweens.killTweensOf(this.moneyText);
      this.moneyText.setScale(1.2);
      this.tweens.add({ targets: this.moneyText, scale: 1, duration: 220, ease: 'Back.Out' });
    }
    this.layoutHud();
  }

  // ---------------------------------------------------------------------------
  // morning report and game over
  // ---------------------------------------------------------------------------

  private showReport(r: NightReport): void {
    this.report?.destroy();
    const lines = [
      STR.report.safe(r.safe),
      STR.report.lost(r.lost),
      STR.report.happy(r.happy, r.unhappy),
      STR.report.income(r.earned),
      STR.report.rooms(r.rooms),
    ];
    const title = this.add
      .text(0, 14, STR.report.title(r.day), { fontFamily: FONT_TITLE, fontSize: '20px', color: COLORS.uiText })
      .setOrigin(0.5, 0);
    const body = this.add
      .text(0, 46, lines.join('\n'), { fontFamily: FONT_UI, fontSize: '14px', color: COLORS.uiText, align: 'center', lineSpacing: 4 })
      .setOrigin(0.5, 0);
    const rep = this.add
      .text(0, 46 + body.height + 8, STR.report.reputation(r.reputation, r.repDelta), {
        fontFamily: FONT_UI,
        fontSize: '15px',
        fontStyle: 'bold',
        color: r.repDelta >= 0 ? COLORS.uiGreen : COLORS.uiRed,
      })
      .setOrigin(0.5, 0);
    if (r.lost > 0) body.setColor(COLORS.uiText);

    const w = 280;
    const h = rep.y + rep.height + 16;
    const bg = this.add.rectangle(0, 0, w, h, COLORS.uiPanel, 0.94).setOrigin(0.5, 0).setStrokeStyle(2, COLORS.uiAccent);
    this.report = this.add.container(this.scale.width / 2, HUD_HEIGHT + 16, [bg, title, body, rep]).setAlpha(0);
    this.tweens.add({ targets: this.report, alpha: 1, duration: 400 });
    const report = this.report;
    this.time.delayedCall(REPORT_MS, () => {
      this.tweens.add({ targets: report, alpha: 0, duration: 600, onComplete: () => report.destroy() });
      if (this.report === report) this.report = undefined;
    });
  }

  private showGameOver(): void {
    state.setTool(null);
    const w = this.scale.width;
    const h = this.scale.height;
    const shade = this.add.rectangle(0, 0, w, h, 0x05070f, 0.8).setOrigin(0).setInteractive();
    const title = this.add
      .text(w / 2, h / 2 - 50, STR.gameOverTitle, { fontFamily: FONT_TITLE, fontSize: '30px', color: COLORS.uiText })
      .setOrigin(0.5);
    const text = this.add
      .text(w / 2, h / 2, STR.gameOverText(state.day - 1), { fontFamily: FONT_UI, fontSize: '16px', color: COLORS.uiTextDim })
      .setOrigin(0.5);
    const btn = this.add
      .rectangle(w / 2, h / 2 + 56, 160, 40, COLORS.uiButtonActive)
      .setStrokeStyle(2, COLORS.uiAccent)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(w / 2, h / 2 + 56, STR.tryAgain, { fontFamily: FONT_UI, fontSize: '16px', fontStyle: 'bold', color: COLORS.uiText })
      .setOrigin(0.5);
    btn.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => window.location.reload());
    for (const o of [shade, title, text, btn, label]) o.setDepth(1000);
  }

  // ---------------------------------------------------------------------------
  // layout
  // ---------------------------------------------------------------------------

  private layoutHud(): void {
    const w = this.scale.width;
    const y = HUD_HEIGHT / 2;
    this.moneyText.setPosition(w - 16, y);
    this.coinIcon.setPosition(w - 16 - this.moneyText.width - 16, y);
    this.repText.setPosition(this.coinIcon.x - 22, y);
    this.spiritText.setPosition(this.repText.x - this.repText.width - 18, y);

    // Narrow windows: drop the title, then move the clock below the top bar.
    const left = this.spiritText.x - this.spiritText.width;
    this.title.setVisible(w >= 1100);
    const fitsInBar = w / 2 + this.clockText.width / 2 + 16 < left && (this.title.visible ? w / 2 - this.clockText.width / 2 > 230 : true);
    if (fitsInBar) {
      this.clockText.setPosition(w / 2, y).setBackgroundColor('rgba(0,0,0,0)').setPadding(0, 0);
    } else {
      this.clockText.setPosition(w / 2, HUD_HEIGHT + 18).setBackgroundColor('rgba(11,15,26,0.8)').setPadding(10, 4);
    }
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

    // Shrink the buttons if the window is too narrow for all of them.
    const total = this.buttons.length * BTN_W + (this.buttons.length - 1) * BTN_GAP;
    const s = Math.min(1, (w - 16) / total);
    let x = Math.round((w - total * s) / 2);
    const y = h - BAR_HEIGHT + Math.round((BAR_HEIGHT - BTN_H * s) / 2) + 1;
    for (const b of this.buttons) {
      b.container.setPosition(x, y).setScale(s);
      x += (BTN_W + BTN_GAP) * s;
    }

    this.hint.setPosition(w / 2, h - BAR_HEIGHT - 10);
    this.report?.setX(w / 2);
    this.layoutHud();
  }
}
