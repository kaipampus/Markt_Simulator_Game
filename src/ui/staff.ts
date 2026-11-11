/**
 * Workers in the interface: the Workers tab of the build bar (one card per
 * job to hire, plus the roster) and the info window for whatever the player
 * clicked (a building or a worker). Both are plain HTML built from the state.
 */
import { getBuilding, type BuildingDef } from '../data/buildings';
import { ROLES, STAFF, type Role } from '../data/staff';
import { STR } from '../data/strings';
import { applyTier, maxTier, TIER_LEVEL, TIER_PRICE, upgradeCost } from '../data/upgrades';
import { hasDoors, state, type PlacedBuilding, type StaffMember, type StaffStatus } from '../state/GameState';
import type { Thumbnails } from '../world3d/thumbnails';
import { button, coin, esc } from './dom';

/** Colour of the little dot next to a worker's name. */
const STATUS_COLOR: Record<StaffStatus, string> = {
  asleep: '#8a8299',
  off: '#8a8299',
  toPost: '#f2c46a',
  toHome: '#f2c46a',
  roam: '#8fc4ff',
  cleaning: '#9fe0a8',
  onDuty: '#9fe0a8',
  idle: '#c9bfd9',
  stuck: '#ff6b5a',
};

export function statusOf(m: StaffMember): StaffStatus {
  return m.status === 'asleep' && m.role !== 'cleaner' && m.post === null ? 'off' : m.status;
}

function postName(m: StaffMember): string {
  if (m.role === 'cleaner') return m.focus ? STR.postArea : STR.postAnywhere;
  const b = m.post !== null ? state.buildings.get(m.post) : undefined;
  return b ? STR.buildings[b.def.id] : STR.postNone;
}

const dot = (s: StaffStatus) => `<i class="dot" style="background:${STATUS_COLOR[s]}"></i>`;

// ---------------------------------------------------------------------------
// Workers tab
// ---------------------------------------------------------------------------

export function workersTrayHtml(thumbs: Thumbnails): string {
  const byRole = state.staffByRole();
  const jobs = ROLES.map((role) => roleCard(role, byRole[role], thumbs)).join('');

  const members = [...state.staff.values()];
  const head = STR.staffTitle(state.staff.size, state.staffBeds(), state.wages());
  const chips = members.length
    ? members
        .map((m) => {
          const status = statusOf(m);
          const selected = state.selection?.kind === 'staff' && state.selection.id === m.id;
          const info = `${m.name} · ${STR.roles[m.role]} · ${STR.staffStatus[status]} · ${postName(m)}`;
          return `<button class="chip ${selected ? 'active' : ''}" data-act="selectStaff" data-arg="${m.id}" data-hint="${esc(info)}">${dot(status)}${esc(`${STR.roleIcons[m.role]} ${m.name}`)}</button>`;
        })
        .join('')
    : `<div class="empty">${esc(STR.staffEmpty)}</div>`;
  return `<div class="jobs">${jobs}</div><div class="roster"><div class="head">${esc(head)}</div><div class="chips">${chips}</div></div>`;
}

function roleCard(role: Role, members: StaffMember[], thumbs: Thumbnails): string {
  const r = STAFF[role];
  const check = state.canHire(role);
  const poor = check === 'money';
  const idle = members.filter((m) => m.role !== 'cleaner' && m.post === null).length;
  let info = STR.roleInfo(STR.roles[role], STR.roleWorksAt[role], r.hire, r.wage, members.length, idle);
  if (check === 'beds') info += `  ·  ${STR.hireNoBeds}`;
  const img = thumbs.get(`worker:${role}`);
  return `<div class="card ${poor || check === 'beds' ? 'poor' : ''}" data-act="hire" data-arg="${role}" data-hint="${esc(info)}">
    ${members.length ? `<span class="count">×${members.length}</span>` : ''}
    ${img ? `<img src="${img}" alt="">` : '<span class="noimg"></span>'}
    <span class="name">${esc(`${STR.roleIcons[role]} ${STR.roles[role]}`)}</span>
    <span class="cost">${coin}${r.hire} <span class="wage">· ${esc(STR.perNight(r.wage))}</span></span>
  </div>`;
}

// ---------------------------------------------------------------------------
// info window
// ---------------------------------------------------------------------------

/** HTML of the info window, or null if nothing is selected. */
export function infoHtml(): string | null {
  const sel = state.selection;
  const lines: string[] = [];
  const line = (s: string, cls = '') => lines.push(`<p class="${cls}">${esc(s)}</p>`);
  const buttons: string[] = [];
  let title: string;

  if (sel?.kind === 'building') {
    const b = state.buildings.get(sel.uid);
    if (!b) return null;
    title = STR.buildings[b.def.id];
    describeBuilding(b, line, buttons);
  } else if (sel?.kind === 'staff') {
    const m = state.staff.get(sel.id);
    if (!m) return null;
    title = `${STR.roleIcons[m.role]} ${m.name} · ${STR.roles[m.role]}`;
    const status = statusOf(m);
    lines.push(`<p class="${status === 'stuck' ? 'bad' : ''}">${dot(status)}${esc(STR.staffStatus[status])}</p>`);
    line(`${postName(m)}  ·  ${STR.perNight(STAFF[m.role].wage)}`, 'dim');
    line(m.role === 'cleaner' ? STR.hintCleanerSelected : STR.hintStaffSelected(STR.roles[m.role].toLowerCase()), 'note');
    if (m.role !== 'cleaner' && m.post !== null) buttons.push(button(STR.unassign, 'unassign', { arg: m.id }));
    if (m.role === 'cleaner' && m.focus) buttons.push(button(STR.clearArea, 'freeRoam', { arg: m.id }));
    buttons.push(button(STR.fire, 'fire', { arg: m.id }));
  } else {
    return null;
  }

  return `<button class="close" data-act="deselect" data-hint="${esc(STR.close)}">✕</button>
    <h2>${esc(title)}</h2>${lines.join('')}
    ${buttons.length ? `<div class="buttons">${buttons.join('')}</div>` : ''}`;
}

/** Status lines and buttons for a building. */
function describeBuilding(b: PlacedBuilding, line: (s: string, cls?: string) => void, buttons: string[]): void {
  const { def } = b;
  if (hasDoors(def) && state.canBuild) buttons.push(button(STR.rotate, 'rotate', { arg: b.uid }));

  // Upgrades (by day).
  const base = getBuilding(def.id);
  const max = maxTier(base);
  if (max > 1) {
    line(STR.tier(b.tier, max), 'dim');
    if (b.tier < max && state.canBuild) {
      const next = b.tier + 1;
      const check = state.checkUpgrade(b.uid);
      const info = def.restaurant ? restaurantUpgradeInfo(base, b.tier) : def.hotel ? STR.upgradeInfo.hotel : STR.upgradeInfo.stall;
      const label = check === 'level' ? STR.upgradeLocked(TIER_LEVEL[next]) : STR.upgrade(upgradeCost(base, next));
      const hint = check === 'space' ? `${info}  ·  ${STR.upgradeNoSpace}` : info;
      buttons.push(button(label, 'upgrade', { arg: b.uid, hint, disabled: check !== 'ok', cls: check === 'ok' ? 'active' : '' }));
    }
  }
  if (def.provides) line(STR.sells(STR.needIcons[def.provides.need], def.provides.price), 'dim');
  if (def.hotel) line(STR.bedsUsed(state.sleepersIn(b.uid), def.hotel.beds, def.hotel.price));
  if (def.staffBeds) line(STR.staffHouse(state.staff.size, state.staffBeds()));
  if (def.bin) line(STR.catchesLitter, 'dim');
  if (def.restaurant && def.cuisine) {
    line(STR.restaurantInfo(STR.cuisines[def.cuisine], def.restaurant.tables), 'dim');
    if (state.phase === 'night') line(STR.tables(state.servingCount(b.uid), def.restaurant.tables));
  }
  if (!def.staff) return;

  const missing = state.missingRoles(b);
  if (missing.length) line(STR.noStaff(missing.map((r) => STR.roles[r].toLowerCase()).join(' + ')), 'bad');
  else if (state.phase === 'day') line(STR.dayClosed, 'dim');
  else if (state.isOpen(b)) line(STR.open, 'good');
  else line(STR.staffComing, 'gold');

  for (const worker of state.staffOf(b.uid)) {
    line(STR.worker(`${STR.roleIcons[worker.role]} ${worker.name}`, STR.staffStatus[statusOf(worker)]), 'dim');
  }

  // Free places: give the job to someone idle, or hire. Otherwise offer to unassign.
  const free = [...new Set(def.staff)].filter((r) => state.staffOf(b.uid).filter((m) => m.role === r).length < state.slotsFor(b, r));
  for (const role of free.slice(0, buttons.length ? 1 : 2)) {
    const idle = state.idleStaff(role)[0];
    if (idle) buttons.push(button(STR.assignIdle(idle.name), 'assign', { arg: `${idle.id}:${b.uid}` }));
    else buttons.push(button(STR.hireAndAssign(STR.roles[role], STAFF[role].hire), 'hireAt', { arg: `${role}:${b.uid}` }));
  }
  const first = state.staffOf(b.uid)[0];
  if (!free.length && first) buttons.push(button(STR.unassign, 'unassign', { arg: first.id }));
}

/** What the next restaurant tier adds, worked out from the tier data. */
function restaurantUpgradeInfo(base: BuildingDef, tier: number): string {
  const now = applyTier(base, tier);
  const next = applyTier(base, tier + 1);
  const r0 = now.restaurant!;
  const r1 = next.restaurant!;
  const count = (d: BuildingDef, role: Role) => d.staff?.filter((r) => r === role).length ?? 0;
  const upper0 = r0.upper ?? 0;
  const upper1 = r1.upper ?? 0;
  return STR.upgradeInfo.restaurant(tier + 1, {
    tables: r1.tables - upper1 - (r0.tables - upper0),
    upstairs: upper1 - upper0,
    newFloor: upper0 === 0 && upper1 > 0,
    waiter: count(next, 'waiter') > count(now, 'waiter'),
    cook: count(next, 'cook') > count(now, 'cook'),
    grows: next.h > now.h,
    faster: r1.cookMs < r0.cookMs,
    pricePct: Math.round((TIER_PRICE[tier + 1] - 1) * 100),
  });
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

/** Hire a worker; returns the message for the hint line. */
export function hire(role: Role, post?: number): string | null {
  const result = state.hire(role, post);
  if (result === 'beds') return STR.hireNoBeds;
  if (result === 'money') return STR.notEnoughCoins;
  if (typeof result !== 'string') return STR.hired(result.name, STR.roles[role]);
  return null;
}

/** Upgrade a building; returns the message for the hint line. */
export function upgrade(uid: number): string | null {
  const result = state.upgrade(uid);
  const b = state.buildings.get(uid);
  if (result === 'ok' && b) return STR.upgraded(b.tier);
  if (result === 'space') return STR.upgradeNoSpace;
  return null;
}
