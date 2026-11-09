import * as Phaser from 'phaser';
import { COLORS, FONT_TITLE, FONT_UI } from '../config';
import { ROLES, STAFF } from '../data/staff';
import { STR } from '../data/strings';
import { state, type Sale } from '../state/GameState';
import type { Rect } from './StaffUI';

const W = 310;
const REFRESH_MS = 500;
const MAX_SALES = 6;

/**
 * Finances at a glance: what the staff costs per night, what guests bought
 * last night (and tonight so far), hotel rooms, wages and the profit.
 */
export class FinanceUI {
  private panel: Phaser.GameObjects.Container;
  private rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private open = false;

  constructor(
    private scene: Phaser.Scene,
    /** Top edge for the panel at screen x with width w. */
    private topFor: (x: number, w: number) => number,
  ) {
    this.panel = scene.add.container(0, 0).setVisible(false);
    const timer = scene.time.addEvent({ delay: REFRESH_MS, loop: true, callback: () => this.open && this.build() });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => timer.remove());
  }

  get isOpen(): boolean {
    return this.open;
  }

  toggle(open = !this.open): void {
    this.open = open;
    this.build();
  }

  rects(): Rect[] {
    return this.open ? [this.rect] : [];
  }

  build(): void {
    const panel = this.panel;
    panel.removeAll(true);
    panel.setVisible(this.open);
    if (!this.open) return;

    const parts: Phaser.GameObjects.GameObject[] = [];
    let row = 8;
    const text = (x: number, s: string, color: string = COLORS.uiText, size = 12, bold = false) =>
      this.scene.add.text(x, row, s, { fontFamily: FONT_UI, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color });
    /** Label on the left, value on the right. */
    const pair = (label: string, value: string, color: string = COLORS.uiText, bold = false) => {
      parts.push(text(14, label, COLORS.uiText, 12, bold), text(W - 12, value, color, 12, true).setOrigin(1, 0));
      row += 17;
    };
    const heading = (s: string) => {
      row += 6;
      parts.push(text(10, s, COLORS.uiGold, 13, true));
      row += 19;
    };
    const note = (s: string) => {
      const t = text(14, s, COLORS.uiTextDim, 11).setWordWrapWidth(W - 28);
      parts.push(t);
      row += t.height + 3;
    };
    const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
    const sales = (list: Sale[]) => {
      for (const s of list.slice(0, MAX_SALES)) pair(`${STR.buildings[s.id]}  ×${s.count}`, `+${s.coins}`, COLORS.uiGold);
      if (list.length > MAX_SALES) {
        const rest = list.slice(MAX_SALES).reduce((sum, s) => sum + s.coins, 0);
        pair(STR.finance.otherSales, `+${rest}`, COLORS.uiGold);
      }
    };

    parts.push(text(10, STR.finance.title, COLORS.uiGold, 17).setFontFamily(FONT_TITLE));
    const close = text(W - 22, '✕', COLORS.uiTextDim, 14).setInteractive({ useHandCursor: true });
    close.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.scene.time.delayedCall(0, () => this.toggle(false)));
    parts.push(close);
    row += 26;
    pair(STR.finance.coins, String(state.money), COLORS.uiGold, true);

    // Staff costs: paid every morning, for everyone on the payroll.
    heading(STR.finance.staffHeading);
    const byRole = state.staffByRole();
    let any = false;
    for (const role of ROLES) {
      const n = byRole[role].length;
      if (!n) continue;
      any = true;
      pair(STR.finance.roleLine(STR.roleIcons[role], STR.roles[role], n, STAFF[role].wage), `−${n * STAFF[role].wage}`, COLORS.uiRed);
    }
    if (!any) note(STR.finance.noStaff);
    pair(STR.finance.wagesTotal, `−${state.wages()}`, COLORS.uiRed, true);
    note(STR.finance.wagesNote);

    // Tonight so far.
    if (state.phase === 'night') {
      const t = state.salesTonight();
      heading(STR.finance.tonight);
      if (t.sales.length) sales(t.sales);
      else note(STR.finance.noSales);
      pair(STR.finance.guestsSpent, `+${t.earned}`, COLORS.uiGold, true);
    }

    // Last night's result.
    const r = state.lastReport;
    heading(r ? STR.finance.lastNight(r.day - 1) : STR.finance.lastNight(0));
    if (!r) note(STR.finance.noReport);
    else {
      if (r.sales.length) sales(r.sales);
      else note(STR.finance.noSales);
      pair(STR.finance.guestsSpent, `+${r.earned}`, COLORS.uiGold);
      pair(STR.finance.rooms, `+${r.rooms}`, COLORS.uiGold);
      pair(STR.finance.wagesPaid, `−${r.wages}`, COLORS.uiRed);
      row += 2;
      parts.push(this.scene.add.rectangle(14, row, W - 26, 1, COLORS.uiPanelEdge).setOrigin(0));
      row += 5;
      pair(STR.finance.profit, signed(r.net), r.net >= 0 ? COLORS.uiGreen : COLORS.uiRed, true);
    }

    const h = row + 10;
    const x = Math.max(8, this.scene.scale.width - W - 8);
    const y = this.topFor(x, W);
    const bg = this.scene.add.rectangle(0, 0, W, h, COLORS.uiPanel, 0.95).setOrigin(0).setStrokeStyle(1, COLORS.uiAccent);
    panel.add([bg, ...parts]);
    panel.setPosition(x, y);
    this.rect = { x, y, w: W, h };
  }
}
