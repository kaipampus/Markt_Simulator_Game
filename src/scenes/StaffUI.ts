import * as Phaser from 'phaser';
import { BAR_HEIGHT, COLORS, FONT_TITLE, FONT_UI } from '../config';
import { ROLES, STAFF } from '../data/staff';
import { STR } from '../data/strings';
import { state, type PlacedBuilding, type StaffMember } from '../state/GameState';

const STAFF_W = 300;
const INFO_W = 290;
const ROW_H = 22;
const REFRESH_MS = 400;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The staff panel (hire, list, dismiss) and the info panel for whatever the
 * player clicked (a building or a worker). Both are rebuilt from the game
 * state a few times per second; there are only a handful of objects.
 */
export class StaffUI {
  private staffPanel: Phaser.GameObjects.Container;
  private infoPanel: Phaser.GameObjects.Container;
  private staffRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private infoRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private open = false;
  private timer: Phaser.Time.TimerEvent;

  constructor(
    private scene: Phaser.Scene,
    /** Shows a message in the hint line (null = clear). */
    private setHover: (text: string | null) => void,
    /** Pan the world camera to a worker. */
    private focusWorker: (id: number) => void,
    /** Top edge for the staff panel at screen x with width w. */
    private topFor: (x: number, w: number) => number,
  ) {
    this.staffPanel = scene.add.container(0, 0).setVisible(false);
    this.infoPanel = scene.add.container(0, 0).setVisible(false);
    this.timer = scene.time.addEvent({ delay: REFRESH_MS, loop: true, callback: () => this.refresh() });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.timer.remove());
  }

  get isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    this.open = !this.open;
    this.refresh();
  }

  /** Screen areas covered by the panels. */
  rects(): Rect[] {
    const out: Rect[] = [];
    if (this.staffPanel.visible) out.push(this.staffRect);
    if (this.infoPanel.visible) out.push(this.infoRect);
    return out;
  }

  refresh(): void {
    this.buildStaffPanel();
    this.buildInfoPanel();
  }

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------

  private text(x: number, y: number, s: string, color: string = COLORS.uiText, size = 12, bold = false): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, s, {
      fontFamily: FONT_UI,
      fontSize: `${size}px`,
      fontStyle: bold ? 'bold' : 'normal',
      color,
    });
  }

  private button(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    enabled = true,
    hover?: string,
  ): Phaser.GameObjects.GameObject[] {
    const bg = this.scene.add
      .rectangle(x, y, w, h, enabled ? COLORS.uiButton : COLORS.uiPanel)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.uiPanelEdge)
      .setInteractive({ useHandCursor: enabled });
    const t = this.text(x + w / 2, y + h / 2, label, enabled ? COLORS.uiText : COLORS.uiTextDim, 11, true).setOrigin(0.5);
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      if (enabled) bg.setStrokeStyle(1, COLORS.uiAccent);
      if (hover) this.setHover(hover);
    });
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      bg.setStrokeStyle(1, COLORS.uiPanelEdge);
      if (hover) this.setHover(null);
    });
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.button !== 0 || !enabled) return;
      if (hover) this.setHover(null);
      // Rebuilding destroys this button: act after the input event is done.
      this.scene.time.delayedCall(0, () => {
        onClick();
        this.refresh();
      });
    });
    return [bg, t];
  }

  private hireButton(x: number, y: number, w: number, role: (typeof ROLES)[number], post?: number, label?: string) {
    const r = STAFF[role];
    const check = state.canHire(role);
    const hover = check === 'beds' ? STR.hireNoBeds : STR.hireInfo(r.hire, r.wage);
    const text = label ?? `${STR.roleIcons[role]} ${STR.roles[role]} ${r.hire}`;
    return this.button(x, y, w, 22, text, () => state.hire(role, post), check === 'ok', hover);
  }

  private postName(m: StaffMember): string {
    if (m.role === 'cleaner') return m.focus ? STR.postArea : STR.postAnywhere;
    const b = m.post !== null ? state.buildings.get(m.post) : undefined;
    return b ? STR.buildings[b.def.id] : STR.postNone;
  }

  private statusText(m: StaffMember): string {
    if (m.status === 'asleep' && m.role !== 'cleaner' && m.post === null) return STR.staffStatus.off;
    return STR.staffStatus[m.status];
  }

  // ---------------------------------------------------------------------------
  // staff panel
  // ---------------------------------------------------------------------------

  private buildStaffPanel(): void {
    const panel = this.staffPanel;
    panel.removeAll(true);
    panel.setVisible(this.open);
    if (!this.open) return;

    const x = Math.max(8, this.scene.scale.width - STAFF_W - 8);
    const y = this.topFor(x, STAFF_W);
    const maxH = this.scene.scale.height - BAR_HEIGHT - y - 50;
    const parts: Phaser.GameObjects.GameObject[] = [];

    parts.push(this.text(10, 8, STR.staffTitle(state.staff.size, state.staffBeds()), COLORS.uiGold, 15).setFontFamily(FONT_TITLE));
    parts.push(this.text(10, 30, `Wages ${state.wages()} per night`, COLORS.uiTextDim, 11));

    // Hire buttons, two per row.
    let row = 48;
    ROLES.forEach((role, i) => {
      const bx = 10 + (i % 2) * 142;
      const by = row + Math.floor(i / 2) * 26;
      parts.push(...this.hireButton(bx, by, 138, role));
    });
    row += 2 * 26 + 6;

    const members = [...state.staff.values()];
    if (!members.length) {
      parts.push(this.text(10, row, STR.staffEmpty, COLORS.uiTextDim, 11).setWordWrapWidth(STAFF_W - 20));
      row += 30;
    }
    const fit = Math.max(1, Math.floor((maxH - row - 10) / ROW_H));
    const shown = members.slice(0, fit);
    const selected = state.selection?.kind === 'staff' ? state.selection.id : null;
    for (const m of shown) {
      const bg = this.scene.add
        .rectangle(6, row, STAFF_W - 12, ROW_H - 2, m.id === selected ? COLORS.uiButtonActive : COLORS.uiButton, 0.8)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
        if (p.button !== 0) return;
        this.scene.time.delayedCall(0, () => {
          state.select({ kind: 'staff', id: m.id });
          this.focusWorker(m.id);
          this.refresh();
        });
      });
      const color = m.status === 'stuck' ? COLORS.uiRed : COLORS.uiTextDim;
      parts.push(
        bg,
        this.text(12, row + 3, `${STR.roleIcons[m.role]} ${m.name}`, COLORS.uiText, 12, true),
        this.text(96, row + 4, `${this.statusText(m)} · ${this.postName(m)}`, color, 10),
        ...this.button(STAFF_W - 30, row + 1, 22, ROW_H - 4, '✕', () => state.fire(m.id), true, `${STR.fire} ${m.name}`),
      );
      row += ROW_H;
    }
    if (members.length > shown.length) {
      parts.push(this.text(10, row + 2, `+${members.length - shown.length} more`, COLORS.uiTextDim, 11));
      row += 18;
    }

    const h = row + 8;
    const bg = this.scene.add.rectangle(0, 0, STAFF_W, h, COLORS.uiPanel, 0.94).setOrigin(0).setStrokeStyle(1, COLORS.uiPanelEdge);
    panel.add([bg, ...parts]);
    panel.setPosition(x, y);
    this.staffRect = { x, y, w: STAFF_W, h };
  }

  // ---------------------------------------------------------------------------
  // info panel
  // ---------------------------------------------------------------------------

  private buildInfoPanel(): void {
    const panel = this.infoPanel;
    panel.removeAll(true);
    const sel = state.selection;
    const parts: Phaser.GameObjects.GameObject[] = [];
    let row = 8;
    const line = (s: string, color: string = COLORS.uiText) => {
      const t = this.text(10, row, s, color, 12).setWordWrapWidth(INFO_W - 20);
      parts.push(t);
      row += t.height + 4;
    };
    const buttons = (list: Phaser.GameObjects.GameObject[][]) => {
      if (!list.length) return;
      row += 2;
      parts.push(...list.flat());
      row += 28;
    };

    if (sel?.kind === 'building') {
      const b = state.buildings.get(sel.uid);
      if (!b) return this.hideInfo();
      parts.push(this.text(10, row, STR.buildings[b.def.id], COLORS.uiGold, 15).setFontFamily(FONT_TITLE));
      row += 24;
      this.describeBuilding(b, line);
      if (b.def.staff) buttons(this.buildingButtons(b, row + 2));
    } else if (sel?.kind === 'staff') {
      const m = state.staff.get(sel.id);
      if (!m) return this.hideInfo();
      parts.push(this.text(10, row, `${STR.roleIcons[m.role]} ${m.name} · ${STR.roles[m.role]}`, COLORS.uiGold, 15).setFontFamily(FONT_TITLE));
      row += 24;
      line(this.statusText(m), m.status === 'stuck' ? COLORS.uiRed : COLORS.uiText);
      line(this.postName(m), COLORS.uiTextDim);
      line(m.role === 'cleaner' ? STR.hintCleanerSelected : STR.hintStaffSelected(STR.roles[m.role].toLowerCase()), COLORS.uiTextDim);
      const list: Phaser.GameObjects.GameObject[][] = [];
      let bx = 10;
      const add = (label: string, fn: () => void) => {
        list.push(this.button(bx, row + 2, 100, 22, label, fn));
        bx += 106;
      };
      if (m.role !== 'cleaner' && m.post !== null) add(STR.unassign, () => state.assign(m.id, null));
      if (m.role === 'cleaner' && m.focus) add(STR.clearArea, () => state.setFocus(m.id, null));
      add(STR.fire, () => state.fire(m.id));
      buttons(list);
    } else {
      return this.hideInfo();
    }

    const w = this.scene.scale.width;
    const h = row + 6;
    const x = w - INFO_W - 8;
    const y = this.scene.scale.height - BAR_HEIGHT - h - 34;
    const bg = this.scene.add.rectangle(0, 0, INFO_W, h, COLORS.uiPanel, 0.94).setOrigin(0).setStrokeStyle(1, COLORS.uiAccent);
    panel.add([bg, ...parts]);
    panel.setPosition(x, y).setVisible(true);
    this.infoRect = { x, y, w: INFO_W, h };
  }

  private hideInfo(): void {
    this.infoPanel.setVisible(false);
  }

  /** Status lines for a building. */
  private describeBuilding(b: PlacedBuilding, line: (s: string, color?: string) => void): void {
    const { def } = b;
    if (def.hotel) line(STR.bedsUsed(state.sleepersIn(b.uid), def.hotel.beds));
    if (def.staffBeds) line(STR.staffHouse(state.staff.size, state.staffBeds()));
    if (def.bin) line(STR.catchesLitter, COLORS.uiTextDim);
    const role = def.staff;
    if (!role) return;

    const roleName = STR.roles[role].toLowerCase();
    const worker = state.staffAt(b.uid);
    if (!worker) line(STR.noStaff(roleName), COLORS.uiRed);
    else if (state.phase === 'day') line(STR.dayClosed, COLORS.uiTextDim);
    else if (state.isOpen(b)) line(STR.open, COLORS.uiGreen);
    else line(STR.staffComing, COLORS.uiGold);
    if (worker) line(STR.worker(`${STR.roleIcons[role]} ${worker.name}`, this.statusText(worker)), COLORS.uiTextDim);
  }

  /** Assign / hire / unassign buttons for a staffed building, at panel row `rowY`. */
  private buildingButtons(b: PlacedBuilding, rowY: number): Phaser.GameObjects.GameObject[][] {
    const role = b.def.staff!;
    const roleName = STR.roles[role].toLowerCase();
    const worker = state.staffAt(b.uid);
    const list: Phaser.GameObjects.GameObject[][] = [];
    if (worker) {
      list.push(this.button(10, rowY, 120, 22, STR.unassign, () => state.assign(worker.id, null)));
    } else {
      const idle = state.idleStaff(role)[0];
      if (idle) list.push(this.button(10, rowY, 132, 22, STR.assignIdle(roleName), () => state.assign(idle.id, b.uid)));
      list.push(this.hireButton(idle ? 148 : 10, rowY, 132, role, b.uid, STR.hireAndAssign(roleName, STAFF[role].hire)));
    }
    return list;
  }
}
