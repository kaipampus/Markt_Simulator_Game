/**
 * The interface over the 3D world, as HTML/CSS: top bar, level and time
 * panels, build bar with tabs, info, finance and settings windows, morning
 * report, hint line and keyboard shortcuts. It reads the game state and calls
 * its methods; it never draws into the 3D world.
 */
import { SPEEDS } from '../config';
import { AREAS, LEVEL_XP } from '../data/levels';
import { BUILDINGS, CATEGORIES, getBuilding, type BuildingDef, type BuildingId, type Category } from '../data/buildings';
import type { Role } from '../data/staff';
import { STR } from '../data/strings';
import { state, unlockLevel, type NightReport, type PopularityParts, type Tool } from '../state/GameState';
import { setQuality, toggleQuality, type Quality } from '../world3d/quality';
import { makeThumbnails, type Thumbnails } from '../world3d/thumbnails';
import { button, coin, el, esc, setHtml, setText } from './dom';
import { financeHtml } from './finance';
import { settingsHtml } from './settings';
import { hire, infoHtml, upgrade, workersTrayHtml } from './staff';

/** Bottom bar tabs: building categories plus the workers. */
type Tab = Category | 'workers';
const TABS: readonly Tab[] = [...CATEGORIES, 'workers'];

const REPORT_MS = 8000;
const FLASH_MS = 2500;
/** Windows built from the state are rebuilt this often (ms). */
const REFRESH_MS = 250;

/** What the interface needs from the world. */
export interface UIHooks {
  /** Pan the camera to a worker. */
  focusWorker(id: number): void;
  /** Everyone is gone: jump to the morning. */
  skipToMorning(): void;
}

export class GameUI {
  private root: HTMLElement;
  private thumbs: Thumbnails;
  private tab: Tab = 'transport';
  private financeOpen = false;
  private settingsOpen = false;
  private flash: { text: string; until: number } | null = null;
  private pointer = { x: -1, y: -1 };
  private nextRefresh = 0;
  private reportTimer = 0;
  private unsubscribe: Array<() => void> = [];

  // elements
  private moneyEl: HTMLElement;
  private spiritsEl: HTMLElement;
  private popEl: HTMLElement;
  private financeBtn: HTMLElement;
  private settingsBtn: HTMLElement;
  private titleEl: HTMLElement;
  private levelEl: HTMLElement;
  private clockEl: HTMLElement;
  private speedBtns: HTMLElement[] = [];
  private nightBtn: HTMLElement;
  private hintEl: HTMLElement;
  private tabsEl: HTMLElement;
  private trayEl: HTMLElement;
  private infoEl: HTMLElement;
  private financeEl: HTMLElement;
  private settingsEl: HTMLElement;
  private reportEl: HTMLElement | null = null;

  constructor(
    parent: HTMLElement,
    private hooks: UIHooks,
  ) {
    this.thumbs = makeThumbnails();
    this.root = el('div');
    this.root.id = 'ui';
    parent.appendChild(this.root);

    // Top bar.
    const top = el('header', 'topbar wood ui-block');
    this.titleEl = el('div', 'game-title', esc(STR.title));
    this.financeBtn = el('button', 'btn', esc(`${STR.financeButton} (I)`));
    this.financeBtn.dataset.act = 'finance';
    this.spiritsEl = el('span', 'stat dim');
    this.popEl = el('span', 'stat');
    this.moneyEl = el('span', 'money', `${coin}<b></b>`);
    this.settingsBtn = el('button', 'btn icon', '⚙');
    this.settingsBtn.dataset.act = 'settings';
    this.settingsBtn.dataset.hint = STR.settings.button;
    top.append(this.titleEl, el('div', 'spacer'), this.financeBtn, this.spiritsEl, this.popEl, this.moneyEl, this.settingsBtn);

    // Level panel and time panel.
    this.levelEl = el('div', 'level-panel paper ui-block');
    const time = el('div', 'time-panel wood ui-block');
    this.clockEl = el('span', 'clock');
    time.append(this.clockEl);
    SPEEDS.forEach((speed, i) => {
      const b = el('button', 'btn speed', esc(STR.speedLabels[i]));
      b.dataset.act = 'speed';
      b.dataset.arg = String(speed);
      this.speedBtns.push(b);
      time.append(b);
    });
    this.nightBtn = el('button', 'btn night');
    this.nightBtn.dataset.act = 'night';
    time.append(this.nightBtn);

    // Build bar.
    const bar = el('footer', 'buildbar wood ui-block');
    this.tabsEl = el('nav', 'tabs');
    this.trayEl = el('div', 'tray');
    bar.append(this.tabsEl, this.trayEl);

    this.hintEl = el('div', 'hint');
    this.infoEl = el('div', 'window info-panel paper ui-block hidden');
    this.financeEl = el('div', 'window finance-panel paper ui-block hidden');
    this.settingsEl = el('div', 'window settings-panel paper ui-block hidden');
    this.root.append(top, this.levelEl, time, this.hintEl, this.infoEl, this.financeEl, bar, this.settingsEl);

    // Input: clicks by action name, hover texts, keys.
    this.root.addEventListener('click', this.onClick);
    // No focus on buttons, so Space and the other keys always reach the game.
    this.root.addEventListener('mousedown', (e) => e.preventDefault());
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('keydown', this.onKey);

    this.unsubscribe.push(
      state.on('money', () => {
        this.refreshMoney(true);
        this.refreshBar();
      }),
      state.on('tool', () => this.refreshBar()),
      state.on('speed', () => this.refreshTime()),
      state.on('level', (level) => {
        this.refreshBar();
        this.toast(STR.levelUp(level));
      }),
      state.on('area', () => this.toast(STR.areaOpened)),
      state.on('report', (r) => this.showReport(r)),
      state.on('phase', () => this.refreshBar()),
      // Windows follow selections and staff changes at once, not only on the next refresh.
      state.on('selection', () => (this.nextRefresh = 0)),
      state.on('staff', () => (this.nextRefresh = 0)),
    );

    this.refreshMoney(false);
    this.refreshTime();
    this.selectTab(this.tab);
  }

  dispose(): void {
    this.unsubscribe.forEach((u) => u());
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('keydown', this.onKey);
    window.clearTimeout(this.reportTimer);
    this.root.remove();
  }

  /** True if a screen point lies on the interface (so the world ignores the mouse there). */
  isOverUI(x: number, y: number): boolean {
    const hit = document.elementFromPoint(x, y);
    return !!hit && this.root.contains(hit) && !!hit.closest('.ui-block');
  }

  /** Called every frame. */
  update(): void {
    const now = performance.now();
    this.updateClock();
    setText(this.spiritsEl, STR.spirits(state.spiritCount));
    setText(this.popEl, STR.popularityHud(state.popularity, state.popularity >= state.guestCap()));
    const last = state.lastReport;
    this.popEl.dataset.hint = last?.popParts ? `${STR.popularityInfo}  ${STR.popularityLast(popPartsText(last.popParts))}` : STR.popularityInfo;

    if (now >= this.nextRefresh) {
      this.nextRefresh = now + REFRESH_MS;
      this.refreshLevel();
      if (this.tab === 'workers') setHtml(this.trayEl, workersTrayHtml(this.thumbs));
      const info = infoHtml();
      this.infoEl.classList.toggle('hidden', info === null);
      if (info !== null) setHtml(this.infoEl, info);
      if (this.financeOpen) setHtml(this.financeEl, financeHtml());
    }
    setText(this.hintEl, this.hintText(now));
  }

  // ---------------------------------------------------------------------------
  // top bar, clock, level
  // ---------------------------------------------------------------------------

  private refreshMoney(pop: boolean): void {
    const b = this.moneyEl.querySelector('b')!;
    b.textContent = String(state.money);
    if (pop) {
      b.classList.remove('pop');
      void b.offsetWidth; // restart the animation
      b.classList.add('pop');
    }
  }

  private updateClock(): void {
    let clock: string;
    if (state.phase === 'day') clock = STR.clockDay(state.day, state.timeLeft);
    else if (state.isDawn) clock = STR.clockDawn(state.timeLeft);
    else clock = STR.clockNight(state.day, state.timeLeft);
    if (state.speed === 0) clock = `${STR.paused} · ${clock}`;
    setText(this.clockEl, clock);
    this.clockEl.classList.toggle('dawn', state.isDawn);
    // Day: start the night. Night: skip to the morning once everyone is gone.
    const day = state.phase === 'day';
    this.nightBtn.classList.toggle('hidden', !day && !state.canSkipNight);
    setText(this.nightBtn, day ? STR.startNight : STR.skipNight);
  }

  private refreshTime(): void {
    SPEEDS.forEach((speed, i) => this.speedBtns[i].classList.toggle('active', state.speed === speed));
  }

  private refreshLevel(): void {
    const next = state.nextLevelXp;
    const prev = LEVEL_XP[state.level - 1] ?? 0;
    const share = next === null ? 1 : Math.min(1, Math.max(0, (state.xp - prev) / (next - prev)));
    let extra = '';
    // The hotel district can be opened once the level is reached.
    const area = AREAS.hotel;
    if (!state.areas.has('hotel') && state.level >= area.level) {
      const ready = state.canOpenArea('hotel');
      extra = button(STR.areaOpen(area.cost), 'area', { cls: ready ? 'active' : 'disabled', hint: STR.areaNeeds(area.level, area.cost) });
    } else {
      const unlocks = BUILDINGS.filter((d) => unlockLevel(d) === state.level + 1).map((d) => STR.buildings[d.id]);
      if (state.level + 1 === area.level) unlocks.unshift(STR.areaName);
      if (unlocks.length) extra = `<div class="next">${esc(STR.levelNext(unlocks.slice(0, 4).join(', ') + (unlocks.length > 4 ? ' …' : '')))}</div>`;
    }
    setHtml(
      this.levelEl,
      `<div class="row"><span class="name">${esc(STR.level(state.level))}</span>
        <span class="xpbar"><i style="width:${(share * 100).toFixed(1)}%"></i></span>
        <span class="xp">${esc(STR.levelXp(state.xp, next))}</span></div>${extra}`,
    );
  }

  private toast(text: string): void {
    const t = el('div', 'toast', esc(text));
    this.root.appendChild(t);
    t.addEventListener('animationend', () => t.remove());
  }

  // ---------------------------------------------------------------------------
  // build bar
  // ---------------------------------------------------------------------------

  private selectTab(tab: Tab): void {
    this.tab = tab;
    const tabs = TABS.map((t) =>
      button(t === 'workers' ? STR.workersTab : STR.categories[t], 'tab', { arg: t, cls: `tab ${t === tab ? 'active' : ''}` }),
    ).join('');
    const demolish = button(`✖ ${STR.demolish} (X)`, 'demolish', { cls: `demolish ${state.tool?.kind === 'demolish' ? 'active' : ''}` });
    setHtml(this.tabsEl, `${tabs}<span class="spacer"></span>${demolish}`);
    this.trayEl.classList.toggle('workers', tab === 'workers');
    if (tab === 'workers') setHtml(this.trayEl, workersTrayHtml(this.thumbs));
    else setHtml(this.trayEl, this.visibleItems().map((d, n) => this.itemHtml(d, n)).join(''));
  }

  /** Redraw the build bar (money, tool, level or phase changed). */
  private refreshBar(): void {
    this.selectTab(this.tab);
  }

  private visibleItems(): BuildingDef[] {
    return this.tab === 'workers' ? [] : BUILDINGS.filter((d) => d.category === this.tab);
  }

  private itemHtml(def: BuildingDef, n: number): string {
    const unlocked = state.isUnlocked(def);
    const t = state.tool;
    const selected = t?.kind === 'build' && t.id === def.id;
    const cost = state.buildCost(def);
    const cls = ['card', selected ? 'selected' : '', !unlocked ? 'locked' : '', !state.canAfford(cost) ? 'poor' : ''].join(' ');
    const img = this.thumbs.get(def.id);
    return `<div class="${cls}" data-act="build" data-arg="${def.id}" data-hint="${esc(describe(def))}">
      ${n < 9 ? `<span class="key">${n + 1}</span>` : ''}
      ${img ? `<img src="${img}" alt="">` : '<span class="noimg"></span>'}
      <span class="name">${esc(STR.buildings[def.id])}</span>
      <span class="cost">${coin}${cost}</span>
      ${unlocked ? '' : `<span class="lock">${esc(STR.lockedLevel(unlockLevel(def)))}</span>`}
    </div>`;
  }

  private toggleTool(tool: NonNullable<Tool>): void {
    if (tool.kind === 'build' && !state.isUnlocked(getBuilding(tool.id))) return;
    const current = state.tool;
    const same =
      current !== null && current.kind === tool.kind && (tool.kind === 'demolish' || (current.kind === 'build' && current.id === tool.id));
    state.setTool(same ? null : tool);
  }

  // ---------------------------------------------------------------------------
  // windows
  // ---------------------------------------------------------------------------

  private toggleFinance(open = !this.financeOpen): void {
    this.financeOpen = open;
    this.financeBtn.classList.toggle('active', open);
    this.financeEl.classList.toggle('hidden', !open);
    if (open) setHtml(this.financeEl, financeHtml());
  }

  private toggleSettings(open = !this.settingsOpen): void {
    this.settingsOpen = open;
    this.settingsBtn.classList.toggle('active', open);
    this.settingsEl.classList.toggle('hidden', !open);
    if (open) setHtml(this.settingsEl, settingsHtml());
  }

  private showReport(r: NightReport): void {
    this.reportEl?.remove();
    window.clearTimeout(this.reportTimer);
    const lines = [STR.report.guests(r.safe, r.lost), STR.report.happy(r.happy, r.unhappy)];
    if (r.angry > 0) lines.push(STR.report.angry(r.angry));
    lines.push(STR.report.xp(r.xp, r.level));
    if (r.staffLost > 0) lines.push(STR.report.staffLost(r.staffLost));
    lines.push(STR.report.cleaned(r.cleaned, r.dirty), STR.report.profit(r.net));
    const report = el(
      'div',
      'report paper',
      `<h2>${esc(STR.report.title(r.day))}</h2>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}
      <div class="pop ${r.popDelta >= 0 ? 'good' : 'bad'}">${esc(STR.report.popularity(r.popularity, r.popDelta))}
        <div class="parts">${esc(popPartsText(r.popParts))}</div></div>`,
    );
    this.root.appendChild(report);
    this.reportEl = report;
    this.reportTimer = window.setTimeout(() => {
      report.classList.add('out');
      window.setTimeout(() => report.remove(), 600);
      if (this.reportEl === report) this.reportEl = null;
    }, REPORT_MS);
  }

  // ---------------------------------------------------------------------------
  // hint line
  // ---------------------------------------------------------------------------

  private flashHint(text: string | null): void {
    if (text) this.flash = { text, until: performance.now() + FLASH_MS };
  }

  private hintText(now: number): string {
    if (this.flash && now < this.flash.until) return this.flash.text;
    // Text of the element under the pointer (works even when it was just rebuilt).
    const hit = this.pointer.x >= 0 ? document.elementFromPoint(this.pointer.x, this.pointer.y) : null;
    const hover = hit && this.root.contains(hit) ? hit.closest<HTMLElement>('[data-hint]')?.dataset.hint : undefined;
    if (hover) return hover;

    const t = state.tool;
    const sel = state.selection;
    const member = sel?.kind === 'staff' ? state.staff.get(sel.id) : undefined;
    if (member) return member.role === 'cleaner' ? STR.hintCleanerSelected : STR.hintStaffSelected(STR.roles[member.role].toLowerCase());
    if (!t && state.phase === 'night') return STR.hintNight;
    if (!t) return state.day === 1 ? STR.hintFirstDay : STR.hintIdle;
    if (t.kind === 'demolish') return STR.hintDemolish;
    if (state.phase === 'night') return STR.hintNightBuild;
    return getBuilding(t.id).dragPlace ? STR.hintPainting : STR.hintPlacing;
  }

  // ---------------------------------------------------------------------------
  // input
  // ---------------------------------------------------------------------------

  private onMove = (e: MouseEvent) => {
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
  };

  private onClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target || target.hasAttribute('disabled')) return;
    this.act(target.dataset.act!, target.dataset.arg ?? '');
  };

  private act(act: string, arg: string): void {
    const num = Number(arg);
    switch (act) {
      case 'finance':
        return this.toggleFinance();
      case 'settings':
        return this.toggleSettings();
      case 'quality':
        setQuality(arg as Quality);
        return this.toggleSettings(true);
      case 'speed':
        return state.setSpeed(num);
      case 'night':
        return this.nightOrMorning();
      case 'area':
        state.openArea('hotel');
        return this.refreshLevel();
      case 'tab':
        return this.selectTab(arg as Tab);
      case 'demolish':
        return this.toggleTool({ kind: 'demolish' });
      case 'build':
        return this.toggleTool({ kind: 'build', id: arg as BuildingId });
      case 'hire':
        return this.flashHint(hire(arg as Role));
      case 'hireAt': {
        const [role, uid] = arg.split(':');
        return this.flashHint(hire(role as Role, Number(uid)));
      }
      case 'selectStaff':
        state.select({ kind: 'staff', id: num });
        return this.hooks.focusWorker(num);
      case 'deselect':
        return state.select(null);
      case 'assign': {
        const [id, uid] = arg.split(':').map(Number);
        state.assign(id, uid);
        return;
      }
      case 'unassign':
        state.assign(num, null);
        return;
      case 'freeRoam':
        return state.setFocus(num, null);
      case 'fire':
        return state.fire(num);
      case 'rotate':
        if (!state.rotate(num)) this.flashHint(STR.cantTurn);
        return;
      case 'upgrade':
        return this.flashHint(upgrade(num));
    }
  }

  /** "Start night" by day, "skip to morning" once the night is over. */
  private nightOrMorning(): void {
    if (state.phase === 'day') state.startNightNow();
    else this.hooks.skipToMorning();
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const code = e.code;
    if (code === 'Space' || code === 'Tab') e.preventDefault();
    if (e.repeat) return;
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code);
    if (digit) {
      const def = this.visibleItems()[Number(digit[1]) - 1];
      if (def) this.toggleTool({ kind: 'build', id: def.id });
      return;
    }
    switch (code) {
      case 'Tab': {
        const i = TABS.indexOf(this.tab);
        return this.selectTab(TABS[(i + (e.shiftKey ? TABS.length - 1 : 1)) % TABS.length]);
      }
      case 'KeyX':
        return this.toggleTool({ kind: 'demolish' });
      case 'Escape':
        if (this.settingsOpen) return this.toggleSettings(false);
        state.setTool(null);
        state.select(null);
        if (this.financeOpen) this.toggleFinance(false);
        return;
      case 'KeyP':
        return this.selectTab('workers');
      case 'KeyR':
        // Turn the building being placed, or the selected one (by day).
        if (state.tool?.kind === 'build') state.rotateBuild();
        else if (state.selection?.kind === 'building' && state.canBuild && !state.rotate(state.selection.uid)) this.flashHint(STR.cantTurn);
        return;
      case 'KeyI':
        return this.toggleFinance();
      case 'KeyG':
        this.flashHint(STR.graphics(toggleQuality()));
        if (this.settingsOpen) setHtml(this.settingsEl, settingsHtml());
        return;
      case 'Space':
        return state.togglePause();
      case 'KeyF':
        return state.cycleSpeed();
      case 'KeyN':
        return this.nightOrMorning();
    }
  };
}

/** One-line description shown while hovering an item. */
function describe(def: BuildingDef): string {
  const parts: string[] = [STR.buildings[def.id], `${state.buildCost(def)} coins`];
  if (def.crossing?.kind === 'walk') parts.push(STR.capacity(def.crossing.capacity));
  if (def.crossing?.kind === 'boat') parts.push(STR.perTrip(def.crossing.capacity));
  if (def.hotel) parts.push(STR.beds(def.hotel.beds));
  if (def.staffBeds) parts.push(STR.staffBeds(def.staffBeds));
  if (def.restaurant && def.cuisine) parts.push(STR.restaurantInfo(STR.cuisines[def.cuisine], def.restaurant.tables));
  if (def.staff) parts.push(STR.needsJobs([...new Set(def.staff)].map((r) => STR.roles[r].toLowerCase()).join(' + ')));
  if (def.bin) parts.push(STR.catchesLitter);
  if (def.provides) parts.push(`${STR.needIcons[def.provides.need]} +${def.provides.price}`);
  if (!state.isUnlocked(def)) parts.push(STR.lockedLevel(unlockLevel(def)));
  return parts.join('  ·  ');
}

/** "😊 mood +4 · ⏳ waiting −2 · …" (only parts that changed something). */
function popPartsText(parts: PopularityParts): string {
  return (Object.keys(parts) as Array<keyof PopularityParts>)
    .filter((k) => Math.abs(parts[k]) >= 0.5)
    .map((k) => `${STR.popParts[k]} ${parts[k] > 0 ? '+' : '−'}${Math.abs(Math.round(parts[k]))}%`)
    .join('  ·  ');
}

