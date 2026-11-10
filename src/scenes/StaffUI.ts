import * as Phaser from 'phaser';
import { BAR_HEIGHT, COLORS, FONT_TITLE, FONT_UI } from '../config';
import { getBuilding } from '../data/buildings';
import { ROLES, STAFF, type Role } from '../data/staff';
import { maxTier, TIER_LEVEL, upgradeCost } from '../data/upgrades';
import { STR } from '../data/strings';
import { TEX } from '../gfx/textures';
import { hasDoors, state, type PlacedBuilding, type StaffMember, type StaffStatus } from '../state/GameState';

const CARD_W = 86;
const CARD_H = 84;
const CARD_GAP = 6;
const CHIP_W = 118;
const CHIP_H = 22;
const INFO_W = 290;
const REFRESH_MS = 400;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Callbacks into the UI scene and the world. */
export interface UIHooks {
  /** Text for the hint line while hovering (null = clear). */
  hover(text: string | null): void;
  /** Short message in the hint line. */
  flash(text: string): void;
  /** Pan the world camera to a worker. */
  focusWorker(id: number): void;
}

/** Colour of the little dot next to a worker's name. */
const STATUS_COLOR: Record<StaffStatus, number> = {
  asleep: 0x6b6580,
  off: 0x6b6580,
  toPost: 0xf2c46a,
  toHome: 0xf2c46a,
  roam: 0x8fc4ff,
  cleaning: 0x9fe0a8,
  onDuty: 0x9fe0a8,
  idle: 0xa79fb8,
  stuck: 0xff8a7a,
};

/**
 * Everything about workers in the interface:
 * - the Workers tab of the bottom bar (one card per job to hire, plus the roster)
 * - the info panel for whatever the player clicked (a building or a worker)
 * Both are rebuilt from the game state a few times per second.
 */
export class StaffUI {
  private bar: Phaser.GameObjects.Container;
  private infoPanel: Phaser.GameObjects.Container;
  private infoRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private barArea: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private barShown = false;
  /** Element the pointer is over; panels are rebuilt often, so hover is tracked by key. */
  private hoverKey: string | null = null;

  constructor(
    private scene: Phaser.Scene,
    private hooks: UIHooks,
  ) {
    this.bar = scene.add.container(0, 0).setVisible(false);
    this.infoPanel = scene.add.container(0, 0).setVisible(false);
    const timer = scene.time.addEvent({ delay: REFRESH_MS, loop: true, callback: () => this.refresh() });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => timer.remove());
  }

  /** Show or hide the Workers tab content. */
  showBar(shown: boolean): void {
    this.barShown = shown;
    this.buildBar();
  }

  /** Area of the bottom bar below the tabs. */
  setBarArea(area: Rect): void {
    this.barArea = area;
    this.refresh();
  }

  /** Screen areas covered by floating panels. */
  rects(): Rect[] {
    return this.infoPanel.visible ? [this.infoRect] : [];
  }

  refresh(): void {
    const prev = this.hoverKey;
    this.hoverKey = null;
    this.restoring = prev;
    this.restoreCheck = null;
    this.buildBar();
    this.buildInfoPanel();
    this.restoring = null;
    // Check only now, when every element has its final position.
    const check = this.restoreCheck as (() => void) | null;
    this.restoreCheck = null;
    check?.();
    if (prev !== null && this.hoverKey === null) this.hooks.hover(null);
  }

  /** Key of the hovered element while rebuilding. */
  private restoring: string | null = null;
  private restoreCheck: (() => void) | null = null;

  /**
   * Hover text for an element. Rebuilt elements under the pointer keep their
   * text (Phaser only sends "pointer over" once the mouse moves again).
   */
  private track(obj: Phaser.GameObjects.Rectangle, key: string, info: string, onOver?: () => void, onOut?: () => void): void {
    obj.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      this.hoverKey = key;
      this.hooks.hover(info);
      onOver?.();
    });
    obj.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      if (this.hoverKey === key) {
        this.hoverKey = null;
        this.hooks.hover(null);
      }
      onOut?.();
    });
    if (this.restoring === key) {
      this.restoreCheck = () => {
        const p = this.scene.input.activePointer;
        if (!obj.active || !obj.getBounds().contains(p.x, p.y)) return;
        this.hoverKey = key;
        this.hooks.hover(info);
        onOver?.();
      };
    }
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

  /** Runs `fn` after the current input event, because rebuilding destroys the clicked object. */
  private later(fn: () => void): void {
    this.scene.time.delayedCall(0, () => {
      fn();
      this.refresh();
    });
  }

  private button(x: number, y: number, w: number, label: string, onClick: () => void, enabled = true, hover?: string): Phaser.GameObjects.GameObject[] {
    const h = 22;
    const bg = this.scene.add
      .rectangle(x, y, w, h, enabled ? COLORS.uiButton : COLORS.uiPanel)
      .setOrigin(0)
      .setStrokeStyle(1, COLORS.uiPanelEdge)
      .setInteractive({ useHandCursor: enabled });
    const t = this.text(x + w / 2, y + h / 2, label, enabled ? COLORS.uiText : COLORS.uiTextDim, 11, true).setOrigin(0.5);
    this.track(
      bg,
      `btn:${label}`,
      hover ?? '',
      () => enabled && bg.setStrokeStyle(1, COLORS.uiAccent),
      () => bg.setStrokeStyle(1, COLORS.uiPanelEdge),
    );
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.button !== 0 || !enabled) return;
      this.later(onClick);
    });
    return [bg, t];
  }

  private postName(m: StaffMember): string {
    if (m.role === 'cleaner') return m.focus ? STR.postArea : STR.postAnywhere;
    const b = m.post !== null ? state.buildings.get(m.post) : undefined;
    return b ? STR.buildings[b.def.id] : STR.postNone;
  }

  private statusOf(m: StaffMember): StaffStatus {
    return m.status === 'asleep' && m.role !== 'cleaner' && m.post === null ? 'off' : m.status;
  }

  private upgrade(uid: number): void {
    const result = state.upgrade(uid);
    const b = state.buildings.get(uid);
    if (result === 'ok' && b) this.hooks.flash(STR.upgraded(b.tier));
    else if (result === 'space') this.hooks.flash(STR.upgradeNoSpace);
  }

  /** Hire a worker; explains in the hint line why it did not work. */
  private hire(role: Role, post?: number): void {
    const result = state.hire(role, post);
    if (result === 'beds') this.hooks.flash(STR.hireNoBeds);
    else if (result === 'money') this.hooks.flash(STR.notEnoughCoins);
    else if (typeof result !== 'string') this.hooks.flash(STR.hired(result.name, STR.roles[role]));
  }

  // ---------------------------------------------------------------------------
  // Workers tab
  // ---------------------------------------------------------------------------

  private buildBar(): void {
    const bar = this.bar;
    bar.removeAll(true);
    bar.setVisible(this.barShown);
    if (!this.barShown) return;

    const { x, y, w, h } = this.barArea;
    const byRole = state.staffByRole();
    const cardsW = ROLES.length * (CARD_W + CARD_GAP) - CARD_GAP;
    const scale = Math.min(1, (w - 20) / (cardsW + CHIP_W + 20), h / CARD_H);
    const top = y + Math.round((h - CARD_H * scale) / 2);

    // One card per job: click to hire.
    ROLES.forEach((role, i) => {
      const card = this.roleCard(role, byRole[role]);
      card.setPosition(x + 10 + i * (CARD_W + CARD_GAP) * scale, top).setScale(scale);
      bar.add(card);
    });

    // Roster on the right: one chip per worker, click to select.
    const rx = x + 10 + cardsW * scale + 16;
    const rw = x + w - 10 - rx;
    const header = state.staffBeds() && rw < 260 ? STR.staffShort(state.staff.size, state.staffBeds()) : STR.staffTitle(state.staff.size, state.staffBeds(), state.wages());
    bar.add(this.text(rx, y + 2, header, COLORS.uiTextDim, 11));
    const cols = Math.max(0, Math.floor((rw + 4) / (CHIP_W + 4)));
    const rows = Math.max(1, Math.floor((h - 20) / (CHIP_H + 4)));
    const members = [...state.staff.values()];
    if (!members.length || cols === 0) {
      bar.add(this.text(rx, y + 22, members.length ? STR.staffCount(members.length) : STR.staffEmpty, COLORS.uiTextDim, 11).setWordWrapWidth(Math.max(120, rw)));
      return;
    }
    const slots = cols * rows;
    const shown = members.length > slots ? members.slice(0, slots - 1) : members;
    shown.forEach((m, i) => {
      const cx = rx + (i % cols) * (CHIP_W + 4);
      const cy = y + 20 + Math.floor(i / cols) * (CHIP_H + 4);
      bar.add(this.chip(m, cx, cy));
    });
    if (shown.length < members.length) {
      const i = shown.length;
      bar.add(
        this.text(rx + (i % cols) * (CHIP_W + 4) + 8, y + 24 + Math.floor(i / cols) * (CHIP_H + 4), STR.more(members.length - shown.length), COLORS.uiTextDim, 11),
      );
    }
  }

  private roleCard(role: Role, members: StaffMember[]): Phaser.GameObjects.Container {
    const r = STAFF[role];
    const check = state.canHire(role);
    const ok = check === 'ok';
    const c = this.scene.add.container(0, 0);
    const bg = this.scene.add.rectangle(0, 0, CARD_W, CARD_H, COLORS.uiButton).setOrigin(0).setStrokeStyle(1, COLORS.uiPanelEdge);
    const icon = this.scene.add.image(CARD_W / 2, 44, TEX.worker(role)).setOrigin(0.5, 1).setAlpha(ok ? 1 : 0.45);
    const name = this.text(CARD_W / 2, 48, `${STR.roleIcons[role]} ${STR.roles[role]}`, COLORS.uiText, 11).setOrigin(0.5, 0);
    const coin = this.scene.add.image(12, 72, TEX.coin).setScale(0.55);
    const cost = this.text(20, 72, String(r.hire), ok || check === 'beds' ? COLORS.uiGold : COLORS.uiRed, 11, true).setOrigin(0, 0.5);
    const wage = this.text(CARD_W - 6, 72, STR.perNight(r.wage), COLORS.uiTextDim, 10).setOrigin(1, 0.5);
    const count = this.text(CARD_W - 5, 4, members.length ? `×${members.length}` : '', COLORS.uiGold, 11, true).setOrigin(1, 0);
    const idle = members.filter((m) => m.role !== 'cleaner' && m.post === null).length;
    const info = STR.roleInfo(STR.roles[role], STR.roleWorksAt[role], r.hire, r.wage, members.length, idle);
    bg.setInteractive({ useHandCursor: true });
    c.add([bg, icon, name, coin, cost, wage, count]);
    this.track(
      bg,
      `card:${role}`,
      check === 'beds' ? `${info}  ·  ${STR.hireNoBeds}` : info,
      () => bg.setFillStyle(COLORS.uiButtonHover).setStrokeStyle(1, COLORS.uiAccent),
      () => bg.setFillStyle(COLORS.uiButton).setStrokeStyle(1, COLORS.uiPanelEdge),
    );
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.button !== 0) return;
      this.later(() => this.hire(role));
    });
    return c;
  }

  private chip(m: StaffMember, x: number, y: number): Phaser.GameObjects.GameObject[] {
    const selected = state.selection?.kind === 'staff' && state.selection.id === m.id;
    const status = this.statusOf(m);
    const bg = this.scene.add
      .rectangle(x, y, CHIP_W, CHIP_H, selected ? COLORS.uiButtonActive : COLORS.uiButton)
      .setOrigin(0)
      .setStrokeStyle(1, selected ? COLORS.uiAccent : COLORS.uiPanelEdge)
      .setInteractive({ useHandCursor: true });
    const dot = this.scene.add.circle(x + 9, y + CHIP_H / 2, 4, STATUS_COLOR[status]);
    const label = this.text(x + 17, y + CHIP_H / 2, `${STR.roleIcons[m.role]} ${m.name}`, COLORS.uiText, 11, true).setOrigin(0, 0.5);
    const info = `${m.name} · ${STR.roles[m.role]} · ${STR.staffStatus[status]} · ${this.postName(m)}`;
    this.track(bg, `chip:${m.id}`, info);
    bg.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.button !== 0) return;
      this.later(() => {
        state.select({ kind: 'staff', id: m.id });
        this.hooks.focusWorker(m.id);
      });
    });
    return [bg, dot, label];
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
    const title = (s: string) => {
      parts.push(this.text(10, row, s, COLORS.uiGold, 15).setFontFamily(FONT_TITLE));
      row += 24;
    };
    const buttons: Array<[string, () => void, boolean?, string?]> = [];

    if (sel?.kind === 'building') {
      const b = state.buildings.get(sel.uid);
      if (!b) return this.hideInfo();
      title(STR.buildings[b.def.id]);
      this.describeBuilding(b, line, buttons);
    } else if (sel?.kind === 'staff') {
      const m = state.staff.get(sel.id);
      if (!m) return this.hideInfo();
      title(`${STR.roleIcons[m.role]} ${m.name} · ${STR.roles[m.role]}`);
      const status = this.statusOf(m);
      line(STR.staffStatus[status], status === 'stuck' ? COLORS.uiRed : COLORS.uiText);
      line(`${this.postName(m)}  ·  ${STR.perNight(STAFF[m.role].wage)}`, COLORS.uiTextDim);
      line(m.role === 'cleaner' ? STR.hintCleanerSelected : STR.hintStaffSelected(STR.roles[m.role].toLowerCase()), COLORS.uiTextDim);
      if (m.role !== 'cleaner' && m.post !== null) buttons.push([STR.unassign, () => state.assign(m.id, null)]);
      if (m.role === 'cleaner' && m.focus) buttons.push([STR.clearArea, () => state.setFocus(m.id, null)]);
      buttons.push([STR.fire, () => state.fire(m.id)]);
    } else {
      return this.hideInfo();
    }

    // Buttons, two per row.
    for (let i = 0; i < buttons.length; i += 2) {
      const pair = buttons.slice(i, i + 2);
      const bw = Math.floor((INFO_W - 20 - (pair.length - 1) * 6) / pair.length);
      pair.forEach(([label, fn, enabled, hover], j) => parts.push(...this.button(10 + j * (bw + 6), row + 2, bw, label, fn, enabled ?? true, hover)));
      row += 28;
    }
    if (buttons.length) row += 2;

    const h = row + 6;
    const x = this.scene.scale.width - INFO_W - 8;
    const y = this.scene.scale.height - BAR_HEIGHT - h - 34;
    const bg = this.scene.add.rectangle(0, 0, INFO_W, h, COLORS.uiPanel, 0.94).setOrigin(0).setStrokeStyle(1, COLORS.uiAccent);
    const close = this.text(INFO_W - 18, 6, '✕', COLORS.uiTextDim, 13).setInteractive({ useHandCursor: true });
    close.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.later(() => state.select(null)));
    panel.add([bg, ...parts, close]);
    panel.setPosition(x, y).setVisible(true);
    this.infoRect = { x, y, w: INFO_W, h };
  }

  private hideInfo(): void {
    this.infoPanel.setVisible(false);
  }

  /** Status lines and buttons for a building. */
  private describeBuilding(
    b: PlacedBuilding,
    line: (s: string, color?: string) => void,
    buttons: Array<[string, () => void, boolean?, string?]>,
  ): void {
    const { def } = b;
    if (hasDoors(def) && state.canBuild) buttons.push([STR.rotate, () => state.rotate(b.uid)]);
    // Upgrades (by day).
    const base = getBuilding(def.id);
    const max = maxTier(base);
    if (max > 1) {
      line(STR.tier(b.tier, max), COLORS.uiTextDim);
      if (b.tier < max && state.canBuild) {
        const next = b.tier + 1;
        const check = state.checkUpgrade(b.uid);
        const info = def.restaurant ? (next === 2 ? STR.upgradeInfo.restaurant2 : STR.upgradeInfo.restaurant3) : def.hotel ? STR.upgradeInfo.hotel : STR.upgradeInfo.stall;
        const label = check === 'level' ? STR.upgradeLocked(TIER_LEVEL[next]) : STR.upgrade(upgradeCost(base, next));
        const hover = check === 'space' ? `${info}  ·  ${STR.upgradeNoSpace}` : info;
        buttons.push([label, () => this.upgrade(b.uid), check === 'ok', hover]);
      }
    }
    if (def.provides) line(STR.sells(STR.needIcons[def.provides.need], def.provides.price), COLORS.uiTextDim);
    if (def.hotel) line(STR.bedsUsed(state.sleepersIn(b.uid), def.hotel.beds, def.hotel.price));
    if (def.staffBeds) line(STR.staffHouse(state.staff.size, state.staffBeds()));
    if (def.bin) line(STR.catchesLitter, COLORS.uiTextDim);
    if (def.restaurant && def.cuisine) {
      line(STR.restaurantInfo(STR.cuisines[def.cuisine], def.restaurant.tables), COLORS.uiTextDim);
      if (state.phase === 'night') line(STR.tables(state.servingCount(b.uid), def.restaurant.tables));
    }
    if (!def.staff) return;

    const missing = state.missingRoles(b);
    if (missing.length) line(STR.noStaff(missing.map((r) => STR.roles[r].toLowerCase()).join(' + ')), COLORS.uiRed);
    else if (state.phase === 'day') line(STR.dayClosed, COLORS.uiTextDim);
    else if (state.isOpen(b)) line(STR.open, COLORS.uiGreen);
    else line(STR.staffComing, COLORS.uiGold);

    for (const worker of state.staffOf(b.uid)) {
      line(STR.worker(`${STR.roleIcons[worker.role]} ${worker.name}`, STR.staffStatus[this.statusOf(worker)]), COLORS.uiTextDim);
    }

    // Free places: give the job to someone idle, or hire. Otherwise offer to unassign.
    const free = [...new Set(def.staff)].filter(
      (r) => state.staffOf(b.uid).filter((m) => m.role === r).length < state.slotsFor(b, r),
    );
    for (const role of free.slice(0, buttons.length ? 1 : 2)) {
      const idle = state.idleStaff(role)[0];
      if (idle) buttons.push([STR.assignIdle(idle.name), () => state.assign(idle.id, b.uid)]);
      else buttons.push([STR.hireAndAssign(STR.roles[role], STAFF[role].hire), () => this.hire(role, b.uid)]);
    }
    const first = state.staffOf(b.uid)[0];
    if (!free.length && first) buttons.push([STR.unassign, () => state.assign(first.id, null)]);
  }
}
