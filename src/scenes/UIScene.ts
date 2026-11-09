import * as Phaser from 'phaser';
import {
  BAR_HEIGHT,
  COLORS,
  ERA_PANEL_HEIGHT,
  ERA_PANEL_WIDTH,
  FONT_TITLE,
  FONT_UI,
  HUD_HEIGHT,
  SPEEDS,
  TIME_PANEL_HALF_WIDTH,
  TIME_PANEL_HEIGHT,
} from '../config';
import { BUILDINGS, CATEGORIES, getBuilding, type BuildingDef, type Category } from '../data/buildings';
import { STR } from '../data/strings';
import { TEX } from '../gfx/textures';
import { state, type NightReport, type Tool } from '../state/GameState';
import type { MarketScene } from './MarketScene';
import { FinanceUI } from './FinanceUI';
import { StaffUI } from './StaffUI';

const BTN_W = 86;
const BTN_H = 84;
const BTN_GAP = 6;
const TAB_H = 24;
const REPORT_MS = 8000;

interface ItemButton {
  def: BuildingDef;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  costText: Phaser.GameObjects.Text;
  keyText: Phaser.GameObjects.Text;
  lock: Phaser.GameObjects.Text;
  hovered: boolean;
}

interface SmallButton {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

/** Bottom bar tabs: building categories plus the workers. */
type Tab = Category | 'workers';
const TABS: readonly Tab[] = [...CATEGORIES, 'workers'];

const HOTKEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'] as const;

/** Screen-space interface: top bar, time controls, era panel, build bar with tabs, reports. */
export class UIScene extends Phaser.Scene {
  private hud!: Phaser.GameObjects.Graphics;
  private bar!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private coinIcon!: Phaser.GameObjects.Image;
  private spiritText!: Phaser.GameObjects.Text;
  private repText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  // time panel
  private timePanel!: Phaser.GameObjects.Container;
  private clockText!: Phaser.GameObjects.Text;
  private speedButtons: SmallButton[] = [];
  private nightButton!: SmallButton;

  // era panel
  private eraPanel!: Phaser.GameObjects.Container;
  private eraName!: Phaser.GameObjects.Text;
  private eraInfo!: Phaser.GameObjects.Text;
  private eraButton!: SmallButton;

  // build bar
  private category: Tab = 'transport';
  private tabs = new Map<Tab, SmallButton>();
  private demolishButton!: SmallButton;
  private financeButton!: SmallButton;
  private staffUI!: StaffUI;
  private financeUI!: FinanceUI;
  /** Short message in the hint line (e.g. "building resumes at daybreak"). */
  private flash: { text: string; until: number } | null = null;
  private items: ItemButton[] = [];
  private hoverInfo: string | null = null;

  private report?: Phaser.GameObjects.Container;
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
        backgroundColor: 'rgba(11,15,26,0.78)',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 1);

    this.createTimePanel();
    this.createEraPanel();
    this.staffUI = new StaffUI(this, {
      hover: (text) => (this.hoverInfo = text),
      flash: (text) => this.flashHint(text),
      focusWorker: (id) => (this.scene.get('MarketScene') as MarketScene).focusWorker(id),
    });
    this.financeUI = new FinanceUI(this, (x, w) => {
      // Below the time panel if they would overlap.
      const tp = this.timePanel;
      const overlaps = x < tp.x + TIME_PANEL_HALF_WIDTH * 2 && x + w > tp.x;
      return overlaps ? tp.y + TIME_PANEL_HEIGHT + 6 : HUD_HEIGHT + 6;
    });
    this.financeButton = this.smallButton(0, 8, 110, HUD_HEIGHT - 16, `${STR.financeButton} (I)`, () => this.toggleFinance());
    this.createBuildBar();
    this.setupKeys();

    this.unsubscribe.push(
      state.on('money', () => this.refreshMoney(true)),
      state.on('tool', () => this.refreshItems()),
      state.on('speed', () => this.refreshTime()),
      state.on('era', (era) => this.onEra(era)),
      state.on('report', (r) => this.showReport(r)),
      state.on('phase', () => {
        this.refreshItems();
        this.staffUI.refresh();
      }),
      state.on('staff', () => this.staffUI.refresh()),
      state.on('selection', () => this.staffUI.refresh()),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe.forEach((u) => u()));
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));

    this.refreshMoney(false);
    this.refreshTime();
    this.layout();
  }

  /** Texts that change continuously. */
  update(): void {
    let clock: string;
    if (state.phase === 'day') clock = STR.clockDay(state.day, state.timeLeft);
    else if (state.isDawn) clock = STR.clockDawn(state.timeLeft);
    else clock = STR.clockNight(state.day, state.timeLeft);
    if (state.speed === 0) clock = `${STR.paused} · ${clock}`;
    if (this.clockText.text !== clock) {
      this.clockText.setText(clock).setColor(state.isDawn ? COLORS.uiRed : COLORS.uiText);
    }
    const day = state.phase === 'day';
    this.nightButton.bg.setVisible(day);
    this.nightButton.label.setVisible(day);

    const rep = STR.reputation(state.reputation);
    const spirits = STR.spirits(state.spiritCount);
    if (this.repText.text !== rep || this.spiritText.text !== spirits) {
      this.repText.setText(rep);
      this.spiritText.setText(spirits);
      this.layoutHud();
      this.refreshEra();
    }

    const t = state.tool;
    const sel = state.selection;
    const member = sel?.kind === 'staff' ? state.staff.get(sel.id) : undefined;
    let hint: string;
    if (this.flash && this.time.now < this.flash.until) hint = this.flash.text;
    else if (this.hoverInfo) hint = this.hoverInfo;
    else if (member)
      hint = member.role === 'cleaner' ? STR.hintCleanerSelected : STR.hintStaffSelected(STR.roles[member.role].toLowerCase());
    else if (!t && state.phase === 'night') hint = STR.hintNight;
    else if (!t) hint = state.day === 1 ? STR.hintFirstDay : STR.hintIdle;
    else if (t.kind === 'demolish') hint = STR.hintDemolish;
    else hint = getBuilding(t.id).dragPlace ? STR.hintPainting : STR.hintPlacing;
    if (this.hint.text !== hint) this.hint.setText(hint);
  }

  // ---------------------------------------------------------------------------
  // small helpers
  // ---------------------------------------------------------------------------

  private smallButton(x: number, y: number, w: number, h: number, text: string, onClick: () => void): SmallButton {
    const bg = this.add
      .rectangle(x, y, w, h, COLORS.uiButton)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.uiPanelEdge)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x + w / 2, y + h / 2, text, { fontFamily: FONT_UI, fontSize: '12px', fontStyle: 'bold', color: COLORS.uiText })
      .setOrigin(0.5);
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => bg.setStrokeStyle(1, COLORS.uiAccent));
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => bg.setStrokeStyle(1, COLORS.uiPanelEdge));
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.button === 0) onClick();
    });
    return { bg, label };
  }

  private setActive(b: SmallButton, active: boolean): void {
    b.bg.setFillStyle(active ? COLORS.uiButtonActive : COLORS.uiButton);
  }

  // ---------------------------------------------------------------------------
  // time panel
  // ---------------------------------------------------------------------------

  private createTimePanel(): void {
    const w = TIME_PANEL_HALF_WIDTH * 2;
    const h = TIME_PANEL_HEIGHT;
    const bg = this.add.rectangle(0, 0, w, h, COLORS.uiPanel, 0.92).setOrigin(0).setStrokeStyle(1, COLORS.uiPanelEdge);
    this.clockText = this.add
      .text(12, h / 2, '', { fontFamily: FONT_UI, fontSize: '13px', fontStyle: 'bold', color: COLORS.uiText })
      .setOrigin(0, 0.5);
    const parts: Phaser.GameObjects.GameObject[] = [bg, this.clockText];

    // Speed buttons and "start night" on the right side of the panel.
    const nightW = 104;
    let x = w - 6 - nightW - 6 - SPEEDS.length * 32;
    SPEEDS.forEach((speed, i) => {
      const b = this.smallButton(x, 5, 30, h - 10, STR.speedLabels[i], () => state.setSpeed(speed));
      this.speedButtons.push(b);
      parts.push(b.bg, b.label);
      x += 32;
    });
    this.nightButton = this.smallButton(w - 6 - nightW, 5, nightW, h - 10, STR.startNight, () => state.startNightNow());
    parts.push(this.nightButton.bg, this.nightButton.label);

    this.timePanel = this.add.container(0, HUD_HEIGHT, parts);
  }

  private refreshTime(): void {
    SPEEDS.forEach((speed, i) => this.setActive(this.speedButtons[i], state.speed === speed));
  }

  // ---------------------------------------------------------------------------
  // era panel
  // ---------------------------------------------------------------------------

  private createEraPanel(): void {
    const w = ERA_PANEL_WIDTH;
    const h = ERA_PANEL_HEIGHT;
    const bg = this.add.rectangle(0, 0, w, h, COLORS.uiPanel, 0.92).setOrigin(0).setStrokeStyle(1, COLORS.uiPanelEdge);
    this.eraName = this.add.text(10, 6, '', { fontFamily: FONT_TITLE, fontSize: '15px', color: COLORS.uiGold });
    this.eraInfo = this.add.text(10, 34, '', { fontFamily: FONT_UI, fontSize: '11px', color: COLORS.uiTextDim });
    this.eraButton = this.smallButton(w - 168, 6, 160, 22, '', () => {
      if (state.advanceEra()) this.refreshEra();
    });
    this.eraButton.label.setFontSize(11);
    this.eraPanel = this.add.container(8, HUD_HEIGHT + 6, [bg, this.eraName, this.eraInfo, this.eraButton.bg, this.eraButton.label]);
    this.refreshEra();
  }

  private refreshEra(): void {
    this.eraName.setText(STR.eras[state.era]);
    const next = state.nextEra;
    if (!next) {
      this.eraInfo.setText(STR.eraFinal);
      this.eraButton.bg.setVisible(false);
      this.eraButton.label.setVisible(false);
      return;
    }
    const name = STR.eras[next.era];
    this.eraInfo.setText(STR.eraNext(name, next.reputation, next.cost));
    const ready = state.canAdvanceEra();
    this.eraButton.label.setText(STR.eraBuy(name, next.cost)).setColor(ready ? COLORS.uiText : COLORS.uiTextDim);
    this.eraButton.bg.setFillStyle(ready ? COLORS.uiButtonActive : COLORS.uiButton).setAlpha(ready ? 1 : 0.6);
  }

  private onEra(era: number): void {
    this.refreshEra();
    this.refreshItems();
    this.items.find((i) => i.def.id === 'path')?.icon.setTexture(TEX.path(era));
    this.toast(STR.eraStarted(STR.eras[era]));
  }

  private toast(text: string): void {
    const y = this.scale.height * 0.4;
    const t = this.add
      .text(this.scale.width / 2, y, text, {
        fontFamily: FONT_TITLE,
        fontSize: '30px',
        color: COLORS.uiGold,
        stroke: '#0b0f1a',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: y - 10, duration: 500 });
    this.tweens.add({ targets: t, alpha: 0, y: y - 40, delay: 2800, duration: 700, onComplete: () => t.destroy() });
  }

  // ---------------------------------------------------------------------------
  // build bar
  // ---------------------------------------------------------------------------

  private createBuildBar(): void {
    for (const tab of TABS) {
      const label = tab === 'workers' ? STR.workersTab : STR.categories[tab];
      this.tabs.set(tab, this.smallButton(0, 0, 92, TAB_H - 4, label, () => this.selectCategory(tab)));
    }
    this.demolishButton = this.smallButton(0, 0, 110, TAB_H - 4, `✖ ${STR.demolish} (X)`, () =>
      this.toggleTool({ kind: 'demolish' }),
    );
    for (const def of BUILDINGS) this.items.push(this.makeItem(def));
    this.selectCategory(this.category);
  }

  private makeItem(def: BuildingDef): ItemButton {
    const container = this.add.container(0, 0);
    const bg = this.add.rectangle(0, 0, BTN_W, BTN_H, COLORS.uiButton).setOrigin(0).setStrokeStyle(1, COLORS.uiPanelEdge);
    const texture = def.id === 'path' ? TEX.path(state.era) : TEX.building(def.id);
    const icon = this.add.image(BTN_W / 2, 46, texture).setOrigin(0.5, 1);
    icon.setScale(Math.min(56 / icon.width, 40 / icon.height, 1));
    const name = this.add
      .text(BTN_W / 2, 50, STR.buildings[def.id], { fontFamily: FONT_UI, fontSize: '11px', color: COLORS.uiText, align: 'center' })
      .setOrigin(0.5, 0);
    const coin = this.add.image(BTN_W / 2 - 12, 72, TEX.coin).setScale(0.55);
    const costText = this.add
      .text(BTN_W / 2 - 4, 72, String(def.cost), { fontFamily: FONT_UI, fontSize: '11px', fontStyle: 'bold', color: COLORS.uiGold })
      .setOrigin(0, 0.5);
    const keyText = this.add.text(5, 3, '', { fontFamily: FONT_UI, fontSize: '10px', color: COLORS.uiTextDim });
    const lock = this.add
      .text(BTN_W / 2, 28, `🔒 ${STR.eras[def.era]}`, {
        fontFamily: FONT_UI,
        fontSize: '10px',
        color: COLORS.uiText,
        backgroundColor: 'rgba(11,15,26,0.85)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5);
    container.add([bg, icon, name, coin, costText, keyText, lock]);

    const item: ItemButton = { def, container, bg, icon, costText, keyText, lock, hovered: false };
    bg.setInteractive({ useHandCursor: true });
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      item.hovered = true;
      this.hoverInfo = this.describe(def);
      this.styleItem(item);
    });
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      item.hovered = false;
      this.hoverInfo = null;
      this.styleItem(item);
    });
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.button === 0) this.toggleTool({ kind: 'build', id: def.id });
    });
    return item;
  }

  /** One-line description shown while hovering an item. */
  private describe(def: BuildingDef): string {
    const parts: string[] = [STR.buildings[def.id], `${def.cost} coins`];
    if (def.crossing?.kind === 'walk') parts.push(STR.capacity(def.crossing.capacity));
    if (def.crossing?.kind === 'boat') parts.push(STR.perTrip(def.crossing.capacity));
    if (def.hotel) parts.push(STR.beds(def.hotel.beds));
    if (def.staffBeds) parts.push(STR.staffBeds(def.staffBeds));
    if (def.staff) parts.push(STR.needsStaff(STR.roles[def.staff].toLowerCase()));
    if (def.bin) parts.push(STR.catchesLitter);
    if (def.provides) parts.push(`${STR.needIcons[def.provides.need]} +${def.provides.price}`);
    if (!state.isUnlocked(def)) parts.push(`🔒 ${STR.eras[def.era]}`);
    return parts.join('  ·  ');
  }

  private visibleItems(): ItemButton[] {
    return this.items.filter((i) => i.def.category === this.category);
  }

  private selectCategory(cat: Tab): void {
    this.category = cat;
    for (const [c, b] of this.tabs) this.setActive(b, c === cat);
    for (const i of this.items) i.container.setVisible(i.def.category === cat);
    this.staffUI.showBar(cat === 'workers');
    this.visibleItems().forEach((i, n) => i.keyText.setText(n < 9 ? String(n + 1) : ''));
    this.refreshItems();
    this.layoutBar();
  }

  private isSelected(def: BuildingDef): boolean {
    const t = state.tool;
    return t?.kind === 'build' && t.id === def.id;
  }

  private toggleTool(tool: NonNullable<Tool>): void {
    if (!state.canBuild) {
      this.flashHint(STR.nightNoBuild);
      return;
    }
    if (tool.kind === 'build' && !state.isUnlocked(getBuilding(tool.id))) return;
    const current = state.tool;
    const same =
      current !== null &&
      current.kind === tool.kind &&
      (tool.kind === 'demolish' || (current.kind === 'build' && current.id === tool.id));
    state.setTool(same ? null : tool);
  }

  private styleItem(item: ItemButton): void {
    const unlocked = state.isUnlocked(item.def);
    const selected = this.isSelected(item.def);
    const affordable = state.canAfford(item.def.cost);
    item.bg.setFillStyle(selected ? COLORS.uiButtonActive : item.hovered && unlocked ? COLORS.uiButtonHover : COLORS.uiButton);
    item.bg.setStrokeStyle(selected ? 2 : 1, selected ? COLORS.uiAccent : COLORS.uiPanelEdge);
    item.icon.setAlpha(!unlocked || !state.canBuild ? 0.25 : affordable ? 1 : 0.45);
    item.costText.setColor(affordable ? COLORS.uiGold : COLORS.uiRed);
    item.lock.setVisible(!unlocked);
  }

  private refreshItems(): void {
    this.items.forEach((i) => this.styleItem(i));
    this.setActive(this.demolishButton, state.tool?.kind === 'demolish');
  }

  private setupKeys(): void {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    kb.addCapture([K.SPACE, K.TAB]);
    HOTKEYS.forEach((key, n) =>
      kb.on(`keydown-${key}`, () => {
        const item = this.visibleItems()[n];
        if (item) this.toggleTool({ kind: 'build', id: item.def.id });
      }),
    );
    kb.on('keydown-TAB', () => {
      const i = TABS.indexOf(this.category);
      this.selectCategory(TABS[(i + 1) % TABS.length]);
    });
    kb.on('keydown-X', () => this.toggleTool({ kind: 'demolish' }));
    kb.on('keydown-ESC', () => {
      state.setTool(null);
      state.select(null);
      if (this.financeUI.isOpen) this.toggleFinance();
    });
    kb.on('keydown-P', () => this.selectCategory('workers'));
    kb.on('keydown-I', () => this.toggleFinance());
    kb.on('keydown-SPACE', () => state.togglePause());
    kb.on('keydown-F', () => state.cycleSpeed());
    kb.on('keydown-N', () => state.startNightNow());
  }

  private toggleFinance(): void {
    this.financeUI.toggle();
    this.setActive(this.financeButton, this.financeUI.isOpen);
  }

  private flashHint(text: string): void {
    this.flash = { text, until: this.time.now + 2500 };
  }

  private refreshMoney(pop: boolean): void {
    this.moneyText.setText(String(state.money));
    this.refreshItems();
    this.refreshEra();
    if (pop) {
      this.tweens.killTweensOf(this.moneyText);
      this.moneyText.setScale(1.2);
      this.tweens.add({ targets: this.moneyText, scale: 1, duration: 220, ease: 'Back.Out' });
    }
    this.layoutHud();
  }

  // ---------------------------------------------------------------------------
  // morning report
  // ---------------------------------------------------------------------------

  private showReport(r: NightReport): void {
    this.report?.destroy();
    const lines = [STR.report.guests(r.safe, r.lost), STR.report.happy(r.happy, r.unhappy)];
    if (r.staffLost > 0) lines.push(STR.report.staffLost(r.staffLost));
    lines.push(STR.report.cleaned(r.cleaned, r.dirty), STR.report.profit(r.net));
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
    const h = rep.y + rep.height + 16;
    const bg = this.add.rectangle(0, 0, 280, h, COLORS.uiPanel, 0.94).setOrigin(0.5, 0).setStrokeStyle(2, COLORS.uiAccent);
    const report = this.add
      .container(this.scale.width / 2, HUD_HEIGHT + TIME_PANEL_HEIGHT + 14, [bg, title, body, rep])
      .setAlpha(0);
    this.report = report;
    this.tweens.add({ targets: report, alpha: 1, duration: 400 });
    this.time.delayedCall(REPORT_MS, () => {
      this.tweens.add({ targets: report, alpha: 0, duration: 600, onComplete: () => report.destroy() });
      if (this.report === report) this.report = undefined;
    });
  }

  // ---------------------------------------------------------------------------
  // layout
  // ---------------------------------------------------------------------------

  /** True if a screen point lies on any UI element (so the world ignores the click). */
  isOverUI(x: number, y: number): boolean {
    const h = this.scale.height;
    if (y < HUD_HEIGHT || y > h - BAR_HEIGHT) return true;
    const inside = (cx: number, cy: number, w: number, hh: number) => x >= cx && x <= cx + w && y >= cy && y <= cy + hh;
    if (inside(this.eraPanel.x, this.eraPanel.y, ERA_PANEL_WIDTH, ERA_PANEL_HEIGHT)) return true;
    if (inside(this.timePanel.x, this.timePanel.y, TIME_PANEL_HALF_WIDTH * 2, TIME_PANEL_HEIGHT)) return true;
    return [...this.staffUI.rects(), ...this.financeUI.rects()].some((r) => inside(r.x, r.y, r.w, r.h));
  }

  private layoutHud(): void {
    const w = this.scale.width;
    const y = HUD_HEIGHT / 2;
    this.moneyText.setPosition(w - 16, y);
    this.coinIcon.setPosition(w - 16 - this.moneyText.width - 16, y);
    this.repText.setPosition(this.coinIcon.x - 22, y);
    this.spiritText.setPosition(this.repText.x - this.repText.width - 18, y);
    const fx = this.spiritText.x - this.spiritText.width - 18 - 110;
    this.financeButton.bg.setPosition(fx, 8);
    this.financeButton.label.setPosition(fx + 55, HUD_HEIGHT / 2);
    this.title.setVisible(this.title.width + 32 < fx);
  }

  private layoutBar(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const top = h - BAR_HEIGHT;

    // Tabs on the left (narrower on small screens), demolish on the right.
    const tabW = Math.max(56, Math.min(104, Math.floor((w - 20 - 124) / TABS.length) - 4));
    let tx = 10;
    for (const b of this.tabs.values()) {
      b.bg.setPosition(tx, top + 7).setSize(tabW, TAB_H - 4);
      b.bg.input?.hitArea.setSize(tabW, TAB_H - 4);
      b.label.setPosition(tx + tabW / 2, top + 7 + (TAB_H - 4) / 2).setFontSize(tabW < 80 ? 10 : 12);
      tx += tabW + 4;
    }
    this.demolishButton.bg.setPosition(w - 10 - 110, top + 7);
    this.demolishButton.label.setPosition(w - 10 - 55, top + 7 + (TAB_H - 4) / 2);
    this.staffUI.setBarArea({ x: 0, y: top + TAB_H + 8, w, h: BAR_HEIGHT - TAB_H - 12 });

    // Items of the current tab, centred.
    const items = this.visibleItems();
    const total = items.length * BTN_W + Math.max(0, items.length - 1) * BTN_GAP;
    const s = Math.min(1, (w - 16) / Math.max(1, total));
    let x = Math.round((w - total * s) / 2);
    const y = top + TAB_H + 8 + Math.round((BAR_HEIGHT - TAB_H - 8 - BTN_H * s) / 2);
    for (const i of items) {
      i.container.setPosition(x, y).setScale(s);
      x += (BTN_W + BTN_GAP) * s;
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

    // Time panel centred under the top bar; on narrow screens it sits below the era panel.
    const narrow = w < ERA_PANEL_WIDTH + TIME_PANEL_HALF_WIDTH * 2 + 40;
    const tpX = narrow ? 8 : w / 2 - TIME_PANEL_HALF_WIDTH;
    const tpY = narrow ? HUD_HEIGHT + ERA_PANEL_HEIGHT + 12 : HUD_HEIGHT;
    this.timePanel.setPosition(tpX, tpY);

    this.layoutBar();
    this.hint.setPosition(w / 2, h - BAR_HEIGHT - 10).setWordWrapWidth(w - 40);
    this.hint.setAlign('center');
    this.report?.setX(w / 2);
    this.layoutHud();
    this.financeUI.build();
  }
}
