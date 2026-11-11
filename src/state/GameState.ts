import {
  BRIDGE_QUEUE_COST,
  DAWN_WARNING_MS,
  DAY_MS,
  DEMOLISH_REFUND,
  NIGHT_BUILD_COST,
  FERRY_CELL_COST,
  FIRST_DAY_MS,
  GRID_H,
  GRID_W,
  HAPPY_THRESHOLD,
  NIGHT_MS,
  RIVER_TOP,
  RIVER_ROWS,
  SPEEDS,
  START_MONEY,
} from '../config';
import { GATE, getBuilding, type BuildingDef, type BuildingId, type Need, type Zone } from '../data/buildings';
import { expectedOffers, POP, POPULARITY_MIN, POPULARITY_START } from '../data/popularity';
import { applyTier, maxTier, TIER_LEVEL, upgradeCost } from '../data/upgrades';
import { AREAS, LEVEL_XP, MARKET_GUEST_CAP, UNLOCK_LEVEL, XP_PER_COIN, XP_PER_HAPPY, type AreaId } from '../data/levels';
import { DIRT, ROLES, STAFF, type Role } from '../data/staff';
import { STR } from '../data/strings';
import { Emitter } from './Emitter';
import type { Cell } from './pathfinding';

/** What the player currently has selected in the build bar. */
export type Tool = { kind: 'build'; id: BuildingId } | { kind: 'demolish' } | null;

/** Which side the (main) door faces: 0 = front/south, 1 = west, 2 = back/north, 3 = east. */
export type Rot = 0 | 1 | 2 | 3;

export interface PlacedBuilding {
  uid: number;
  def: BuildingDef;
  tx: number;
  ty: number;
  rot: Rot;
  /** 1 = as built; upgrades raise it (def is then the upgraded definition). */
  tier: number;
}

export type UpgradeResult = 'ok' | 'max' | 'level' | 'money' | 'night' | 'space';

/** Buildings guests or workers go into have doors; restaurants and stalls have two opposite ones. */
export function hasDoors(def: BuildingDef): boolean {
  return !!(def.provides || def.hotel || def.staffBeds || def.staff);
}

/**
 * A building turned so its door faces side `rot`. Turned sideways (west or
 * east), an oblong building also turns its footprint (a 2 × 1 stall becomes
 * 1 × 2). Restaurants keep their footprint and just move their doors.
 */
export function orient(def: BuildingDef, rot: Rot): BuildingDef {
  if (!hasDoors(def) || def.restaurant || rot % 2 === 0 || def.w === def.h) return def;
  return { ...def, w: def.h, h: def.w };
}

export type PlaceResult = 'ok' | 'blocked' | 'zone' | 'adjacent' | 'locked' | 'money' | 'night' | 'area';
export type DemolishResult = { result: 'ok'; refund: number } | { result: 'night' | 'occupied' };
export type HireResult = 'ok' | 'beds' | 'money';

/** What a worker is doing right now (set by the worker entity, shown in the UI). */
export type StaffStatus = keyof typeof STR.staffStatus;

export interface StaffMember {
  id: number;
  name: string;
  role: Role;
  /** Building the worker is assigned to (cooks, clerks, hosts). */
  post: number | null;
  /** Standing at the post, so the building is open. */
  onDuty: boolean;
  /** Cleaners: spot the player sent them to. */
  focus: Cell | null;
  /** Building the worker sleeps in (a staff house, or the hotel for hosts). */
  restAt: number | null;
  status: StaffStatus;
}

/** What the player clicked on (without a build tool). */
export type Selection = { kind: 'building'; uid: number } | { kind: 'staff'; id: number } | null;

export type DirtKind = 'litter' | 'slime';
export type Phase = 'day' | 'night';
export type Terrain = 'hotel' | 'river' | 'market';

/** What guests bought at one kind of building during a night. */
export interface Sale {
  id: BuildingId;
  count: number;
  coins: number;
}

/** The parts of one night's popularity change (percent of the popularity). */
export interface PopularityParts {
  satisfaction: number;
  waiting: number;
  cleanliness: number;
  lost: number;
  offer: number;
  novelty: number;
  /** Building at night. */
  construction: number;
}

/** What a guest reports when it leaves safely. */
export interface GuestStats {
  satisfaction: number;
  /** Time waited in queues and for food, as a share of its patience. */
  waitShare: number;
  /** Dirty cells walked over. */
  dirt: number;
}

export interface NightReport {
  day: number;
  safe: number;
  lost: number;
  happy: number;
  unhappy: number;
  angry: number;
  earned: number;
  rooms: number;
  wages: number;
  staffLost: number;
  cleaned: number;
  dirty: number;
  xp: number;
  level: number;
  /** Guest spending per kind of building, biggest first. */
  sales: Sale[];
  /** earned + rooms - wages */
  net: number;
  /** Popularity after the night, its change and where the change came from. */
  popularity: number;
  popDelta: number;
  popParts: PopularityParts;
}

type StateEvents = {
  money: [number];
  tool: [Tool];
  placed: [PlacedBuilding];
  removed: [PlacedBuilding];
  popularity: [number];
  speed: [number];
  /** Night starts / day starts. */
  phase: [Phase];
  /** The dawn warning begins: everyone hurries home. */
  dawn: [];
  /** The sun rises: listeners must call recordLost() for every spirit still outside. */
  sunrise: [];
  report: [NightReport];
  earned: [number, Cell];
  /** Roster or assignments changed. */
  staff: [];
  hired: [StaffMember];
  fired: [StaffMember];
  selection: [Selection];
  /** Dirt on a cell changed. */
  dirt: [Cell];
  /** Reached a new level. */
  level: [number];
  /** An area was opened. */
  area: [AreaId];
};

/** Everything needed to continue a game, written each morning (see state/storage.ts). */
export interface SaveData {
  version: 1;
  savedAt: number;
  day: number;
  money: number;
  popularity: number;
  /** Older saves stored this instead of popularity. */
  reputation?: number;
  level: number;
  xp: number;
  areas: AreaId[];
  buildings: Array<{ uid: number; id: BuildingId; tx: number; ty: number; rot: Rot; tier: number }>;
  staff: Array<{ name: string; role: Role; post: number | null; restAt: number | null; focus: Cell | null }>;
  /** Hotel uid -> guests sleeping there. */
  sleepers: Array<[number, number]>;
  /** Dirty cells: [cell index, litter, slime]. */
  dirt: Array<[number, number, number]>;
  lastReport: NightReport | null;
}

/**
 * How many guests a building draws per night. Follows its capacity, so the
 * crowd grows with what the market can actually serve: restaurants per
 * table, stalls per service place, decoration a little.
 */
export function capacityOf(def: BuildingDef): number {
  if (def.popularity !== undefined) return def.popularity;
  if (def.restaurant) return def.restaurant.tables * 2.5;
  if (def.provides) return (def.service?.slots ?? 1) * 2;
  if (def.category === 'decor') return 0.5;
  return 0;
}

export function unlockLevel(def: BuildingDef): number {
  return UNLOCK_LEVEL[def.id] ?? 1;
}

/** Door cells of a building placed at (tx, ty) with rotation `rot` (also used for previews). */
export function doorCellsFor(def: BuildingDef, tx: number, ty: number, rot: Rot): Cell[] {
  if (!hasDoors(def)) return [];
  const mx = tx + Math.floor(def.w / 2);
  const my = ty + Math.floor(def.h / 2);
  const side = (r: number): Cell =>
    r === 0 ? { tx: mx, ty: ty + def.h } : r === 1 ? { tx: tx - 1, ty: my } : r === 2 ? { tx: mx, ty: ty - 1 } : { tx: tx + def.w, ty: my };
  // Restaurants and stalls are open on two opposite sides.
  return def.restaurant || def.style === 'stall' ? [side(rot), side((rot + 2) % 4)] : [side(rot)];
}

/** Cell values in the occupancy grid. Positive numbers are building uids. */
const FREE = 0;
/** Walkable but not buildable (in front of the gate). */
const RESERVED = -1;
/** Not walkable, not buildable (the gate itself). */
const BLOCKED = -2;

const TERRAIN: readonly Terrain[] = ['hotel', 'river', 'market'];

function terrainOfRow(ty: number): Terrain {
  if (ty < RIVER_TOP) return 'hotel';
  if (ty < RIVER_TOP + RIVER_ROWS) return 'river';
  return 'market';
}

function zoneAllows(zone: Zone, terrain: Terrain): boolean {
  if (zone === 'land') return terrain !== 'river';
  return zone === terrain;
}

/**
 * The whole game state, independent of rendering.
 * Scenes read from it, call its actions and listen to its events.
 */
export class GameState extends Emitter<StateEvents> {
  money = START_MONEY;
  tool: Tool = null;
  /** Rotation for the next building to place (R). */
  buildRot: Rot = 0;
  spiritCount = 0;
  /** How many guests come per night; changes every morning (see data/popularity.ts). */
  popularity = POPULARITY_START;
  /** New stalls and restaurants built since the last night (bonus for novelty). */
  private newAttractions = 0;
  /** Buildings placed or torn down tonight (costs popularity). */
  private nightWork = 0;
  level = 1;
  xp = 0;
  readonly areas = new Set<AreaId>();

  // --- clock ---
  phase: Phase = 'day';
  day = 1;
  /** Milliseconds until the phase changes. */
  timeLeft = FIRST_DAY_MS;
  /** Game speed multiplier, 0 = paused. */
  speed: number = 1;
  private dawnStarted = false;

  readonly buildings = new Map<number, PlacedBuilding>();
  private grid = new Int32Array(GRID_W * GRID_H);
  private terrain = new Uint8Array(GRID_W * GRID_H);
  private nextUid = 1;

  // --- hotels: uid -> count ---
  private sleepers = new Map<number, number>();
  private reserved = new Map<number, number>();

  // --- bridges: uid -> spirits on it / waiting in front of it ---
  private onBridge = new Map<number, number>();
  private waitingAt = new Map<number, number>();

  // --- staff ---
  readonly staff = new Map<number, StaffMember>();
  private nextStaffId = 1;
  selection: Selection = null;

  // --- cleanliness: per cell ---
  private litter = new Uint8Array(GRID_W * GRID_H);
  /** Dirty cells a cleaner is already on the way to (cell index -> staff id), so cleaners split up. */
  private cleanClaims = new Map<number, number>();
  private slime = new Uint8Array(GRID_W * GRID_H);

  private night = { safe: 0, lost: 0, happy: 0, unhappy: 0, angry: 0, earned: 0, staffLost: 0, cleaned: 0, waitShare: 0, dirt: 0 };
  /** Guests the scene still plans to let in tonight. */
  pendingArrivals = 0;

  // --- queues at buildings: uid -> spirit ids in line / guests being served ---
  private lines = new Map<number, number[]>();
  private serving = new Map<number, number>();
  private sales = new Map<BuildingId, Sale>();
  /** The last morning report (for the finances panel). */
  lastReport: NightReport | null = null;

  /** Top-left cell of the gate (bottom centre of the market). */
  readonly gate = { tx: Math.floor(GRID_W / 2) - 1, ty: GRID_H - GATE.h };

  /** Cells right in front of the gate where spirits appear and leave. */
  readonly gateCells: ReadonlyArray<Cell>;

  constructor() {
    super();
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) this.terrain[y * GRID_W + x] = TERRAIN.indexOf(terrainOfRow(y));
    }

    const front: Cell[] = [];
    for (let x = 0; x < GATE.w; x++) {
      for (let y = 0; y < GATE.h; y++) this.setCell(this.gate.tx + x, this.gate.ty + y, BLOCKED);
      const c = { tx: this.gate.tx + x, ty: this.gate.ty - 1 };
      this.setCell(c.tx, c.ty, RESERVED);
      front.push(c);
    }
    this.gateCells = front;

    // Starter infrastructure: a path from the gate up through the market.
    const cx = this.gate.tx + 1;
    for (let y = RIVER_TOP + RIVER_ROWS; y < this.gate.ty - 1; y++) this.place('path', cx, y, true);
    // A small staff lodge next to the path, so the first workers have a home.
    this.place('staff_lodge', cx + 1, this.gate.ty - 3, true, 1); // door faces the path
  }

  // ---------------------------------------------------------------------------
  // grid
  // ---------------------------------------------------------------------------

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < GRID_W && ty < GRID_H;
  }

  private cell(tx: number, ty: number): number {
    return this.grid[ty * GRID_W + tx];
  }

  private setCell(tx: number, ty: number, value: number): void {
    this.grid[ty * GRID_W + tx] = value;
  }

  terrainAt(tx: number, ty: number): Terrain {
    return TERRAIN[this.terrain[ty * GRID_W + tx]];
  }

  /**
   * Cost of stepping onto a cell for pathfinding (Infinity = impossible).
   * Spirits only walk on paths, bridges, ferry lanes and the cells at the gate.
   */
  readonly travelCost = (tx: number, ty: number): number => {
    if (!this.inBounds(tx, ty)) return Infinity;
    const c = this.cell(tx, ty);
    if (c === RESERVED) return 1;
    if (c <= 0) return Infinity;
    const b = this.buildings.get(c);
    if (!b?.def.walkable) return Infinity;
    const crossing = b.def.crossing;
    if (crossing?.kind === 'walk') return 1 + (this.waitingAt.get(c) ?? 0) * BRIDGE_QUEUE_COST;
    if (crossing?.kind === 'boat') return FERRY_CELL_COST;
    return 1;
  };

  isWalkable(tx: number, ty: number): boolean {
    return this.travelCost(tx, ty) !== Infinity;
  }

  /** Building standing on a cell, if any. */
  buildingAt(tx: number, ty: number): PlacedBuilding | undefined {
    if (!this.inBounds(tx, ty)) return undefined;
    const c = this.cell(tx, ty);
    return c > 0 ? this.buildings.get(c) : undefined;
  }

  /**
   * Cells right outside the doors of a building. Restaurants have two opposite
   * doors, everything else one, in the middle of the side the rotation points to.
   */
  doorCells(b: PlacedBuilding): Cell[] {
    return doorCellsFor(b.def, b.tx, b.ty, b.rot);
  }

  /** Walkable cells where spirits stand to use a building (its doors, if it has any). */
  entranceCells(b: PlacedBuilding): Cell[] {
    if (hasDoors(b.def)) {
      return this.doorCells(b).filter((c) => this.isWalkable(c.tx, c.ty) && !this.buildingAt(c.tx, c.ty)?.def.crossing);
    }
    const out: Cell[] = [];
    const { tx, ty, def } = b;
    for (let x = tx; x < tx + def.w; x++) out.push({ tx: x, ty: ty + def.h }, { tx: x, ty: ty - 1 });
    for (let y = ty; y < ty + def.h; y++) out.push({ tx: tx - 1, ty: y }, { tx: tx + def.w, ty: y });
    return out.filter((c) => {
      if (!this.isWalkable(c.tx, c.ty)) return false;
      // Standing on a bridge or ferry lane does not count as being at a building.
      return !this.buildingAt(c.tx, c.ty)?.def.crossing;
    });
  }

  isUnlocked(def: BuildingDef): boolean {
    return unlockLevel(def) <= this.level;
  }

  /** Is the area this cell belongs to open? (The market is always open.) */
  isAreaOpen(tx: number, ty: number): boolean {
    const t = this.terrainAt(tx, ty);
    return t === 'market' || this.areas.has('hotel');
  }

  checkPlace(def: BuildingDef, tx: number, ty: number): 'ok' | 'blocked' | 'zone' | 'adjacent' | 'area' {
    let zoneOk = true;
    let areaOk = true;
    for (let x = 0; x < def.w; x++) {
      for (let y = 0; y < def.h; y++) {
        if (!this.inBounds(tx + x, ty + y)) return 'blocked';
        if (this.cell(tx + x, ty + y) !== FREE) return 'blocked';
        if (!zoneAllows(def.zone, this.terrainAt(tx + x, ty + y))) zoneOk = false;
        if (!this.isAreaOpen(tx + x, ty + y)) areaOk = false;
      }
    }
    if (!zoneOk) return 'zone';
    if (!areaOk) return 'area';
    // Crossings need a free column on both sides, so spirits can't hop between them.
    if (def.crossing) {
      for (let y = 0; y < def.h; y++) {
        for (const nx of [tx - 1, tx + def.w]) {
          if (this.buildingAt(nx, ty + y)?.def.crossing) return 'adjacent';
        }
      }
    }
    return 'ok';
  }

  // ---------------------------------------------------------------------------
  // building actions
  // ---------------------------------------------------------------------------

  setTool(tool: Tool): void {
    this.tool = tool;
    if (tool) this.select(null);
    this.emit('tool', tool);
  }

  /** R while placing: turn the next building. */
  rotateBuild(): void {
    this.buildRot = ((this.buildRot + 1) % 4) as Rot;
    this.emit('tool', this.tool);
  }

  /** Turning and upgrading only happen during the day (building works at night too, at a price). */
  get canBuild(): boolean {
    return this.phase === 'day';
  }

  /** What placing a building costs right now (more at night). */
  buildCost(def: BuildingDef): number {
    return this.phase === 'night' ? def.cost * NIGHT_BUILD_COST : def.cost;
  }

  canAfford(cost: number): boolean {
    return this.money >= cost;
  }

  private addMoney(delta: number): void {
    this.money += delta;
    this.emit('money', this.money);
  }

  place(id: BuildingId, tx: number, ty: number, free = false, rot: Rot = 0): PlaceResult {
    const def = orient(getBuilding(id), rot);
    if (!free && !this.isUnlocked(def)) return 'locked';
    const check = this.checkPlace(def, tx, ty);
    if (check !== 'ok') return check;
    const cost = this.buildCost(def);
    if (!free && !this.canAfford(cost)) return 'money';

    const building: PlacedBuilding = { uid: this.nextUid++, def, tx, ty, rot, tier: 1 };
    this.buildings.set(building.uid, building);
    for (let x = 0; x < def.w; x++) {
      for (let y = 0; y < def.h; y++) this.setCell(tx + x, ty + y, building.uid);
    }
    if (!free) this.addMoney(-cost);
    if (!free && this.phase === 'night') this.nightWork++;
    if (!free && def.provides) this.newAttractions++;
    this.emit('placed', building);
    if (def.staff) this.autoAssign(building);
    return 'ok';
  }

  /** What upgrading a building to the next tier would cost, or why it cannot be done. */
  checkUpgrade(uid: number): UpgradeResult {
    const b = this.buildings.get(uid);
    if (!b) return 'max';
    const base = getBuilding(b.def.id);
    if (b.tier >= maxTier(base)) return 'max';
    if (!this.canBuild) return 'night';
    if (this.level < TIER_LEVEL[b.tier + 1]) return 'level';
    if (!this.canAfford(upgradeCost(base, b.tier + 1))) return 'money';
    const next = orient(applyTier(base, b.tier + 1), b.rot);
    // A bigger building needs the extra row below it to be free.
    for (let y = b.ty + b.def.h; y < b.ty + next.h; y++) {
      for (let x = b.tx; x < b.tx + next.w; x++) {
        if (!this.inBounds(x, y) || this.cell(x, y) !== FREE || !this.isAreaOpen(x, y)) return 'space';
        if (!zoneAllows(next.zone, this.terrainAt(x, y))) return 'space';
      }
    }
    return 'ok';
  }

  /** Upgrade a building to the next tier (by day only). */
  upgrade(uid: number): UpgradeResult {
    const check = this.checkUpgrade(uid);
    const b = this.buildings.get(uid);
    if (check !== 'ok' || !b) return check;
    const base = getBuilding(b.def.id);
    this.addMoney(-upgradeCost(base, b.tier + 1));
    this.emit('removed', b);
    this.setTier(b, b.tier + 1);
    this.emit('placed', b);
    this.autoAssign(b);
    if (this.selection?.kind === 'building' && this.selection.uid === uid) this.emit('selection', this.selection);
    return 'ok';
  }

  /** Switch a building to a tier, taking the extra cells if it grows. */
  private setTier(b: PlacedBuilding, tier: number): void {
    const next = orient(applyTier(getBuilding(b.def.id), tier), b.rot);
    for (let y = b.ty; y < b.ty + next.h; y++) {
      for (let x = b.tx; x < b.tx + next.w; x++) this.setCell(x, y, b.uid);
    }
    b.def = next;
    b.tier = tier;
  }

  /** Turn a building so its door(s) face the next side (by day only). */
  rotate(uid: number): boolean {
    const b = this.buildings.get(uid);
    if (!b || !this.canBuild || !hasDoors(b.def)) return false;
    const rot = ((b.rot + 1) % 4) as Rot;
    const next = orient(applyTier(getBuilding(b.def.id), b.tier), rot);
    // A turned oblong building needs its new cells to be free.
    for (let y = b.ty; y < b.ty + next.h; y++) {
      for (let x = b.tx; x < b.tx + next.w; x++) {
        if (!this.inBounds(x, y)) return false;
        const c = this.cell(x, y);
        if (c !== FREE && c !== uid) return false;
        if (!this.isAreaOpen(x, y) || !zoneAllows(next.zone, this.terrainAt(x, y))) return false;
      }
    }
    this.emit('removed', b);
    for (let y = b.ty; y < b.ty + b.def.h; y++) for (let x = b.tx; x < b.tx + b.def.w; x++) this.setCell(x, y, FREE);
    for (let y = b.ty; y < b.ty + next.h; y++) for (let x = b.tx; x < b.tx + next.w; x++) this.setCell(x, y, uid);
    b.def = next;
    b.rot = rot;
    this.emit('placed', b);
    if (this.selection?.kind === 'building' && this.selection.uid === uid) this.emit('selection', this.selection);
    return true;
  }

  // ---------------------------------------------------------------------------
  // level and areas
  // ---------------------------------------------------------------------------

  /** Experience needed for the next level (null at the top). */
  get nextLevelXp(): number | null {
    return LEVEL_XP[this.level] ?? null;
  }

  addXp(amount: number): void {
    this.xp += Math.round(amount);
    let up = false;
    while (this.nextLevelXp !== null && this.xp >= this.nextLevelXp) {
      this.level++;
      up = true;
    }
    if (up) this.emit('level', this.level);
  }

  canOpenArea(id: AreaId): boolean {
    const a = AREAS[id];
    return !this.areas.has(id) && this.level >= a.level && this.money >= a.cost;
  }

  openArea(id: AreaId): boolean {
    if (!this.canOpenArea(id)) return false;
    this.addMoney(-AREAS[id].cost);
    this.areas.add(id);
    this.emit('area', id);
    return true;
  }

  /** Removes a building and refunds part of its cost. */
  demolish(uid: number): DemolishResult {
    const building = this.buildings.get(uid);
    if (!building) return { result: 'ok', refund: 0 };
    if (this.phase === 'night') this.nightWork++;
    const { def, tx, ty } = building;
    if (def.staffBeds && this.staffBeds() - def.staffBeds < this.staff.size) return { result: 'occupied' };
    for (let x = 0; x < def.w; x++) {
      for (let y = 0; y < def.h; y++) {
        this.setCell(tx + x, ty + y, FREE);
        this.clearDirt(tx + x, ty + y);
      }
    }
    this.buildings.delete(uid);
    // Sleeping guests simply move out; they are not lost.
    this.sleepers.delete(uid);
    this.reserved.delete(uid);
    this.onBridge.delete(uid);
    this.waitingAt.delete(uid);
    this.lines.delete(uid);
    this.serving.delete(uid);
    const refund = Math.floor(def.cost * DEMOLISH_REFUND);
    this.addMoney(refund);
    this.emit('removed', building);

    // Workers lose their job there, or move to another staff house.
    let staffChanged = false;
    for (const m of this.staff.values()) {
      if (m.post === uid) {
        m.post = null;
        m.onDuty = false;
        staffChanged = true;
      }
      if (m.restAt === uid) {
        m.restAt = this.staffHouses()[0]?.uid ?? null;
        staffChanged = true;
      }
    }
    if (staffChanged) this.emit('staff');
    if (this.selection?.kind === 'building' && this.selection.uid === uid) this.select(null);
    return { result: 'ok', refund };
  }

  /** Buildings that satisfy a need and have (or need no) staff. */
  providersOf(need: Need): PlacedBuilding[] {
    return [...this.buildings.values()].filter((b) => b.def.provides?.need === need && this.isServed(b));
  }

  select(selection: Selection): void {
    this.selection = selection;
    this.emit('selection', selection);
  }

  // ---------------------------------------------------------------------------
  // staff
  // ---------------------------------------------------------------------------

  staffHouses(): PlacedBuilding[] {
    return [...this.buildings.values()].filter((b) => b.def.staffBeds);
  }

  staffBeds(): number {
    return this.staffHouses().reduce((sum, b) => sum + (b.def.staffBeds ?? 0), 0);
  }

  canHire(role: Role): HireResult {
    if (this.staff.size >= this.staffBeds()) return 'beds';
    if (!this.canAfford(STAFF[role].hire)) return 'money';
    return 'ok';
  }

  /** Hire a worker; they start at the first building that still needs their job. */
  hire(role: Role, post?: number): HireResult | StaffMember {
    const check = this.canHire(role);
    if (check !== 'ok') return check;
    this.addMoney(-STAFF[role].hire);
    const used = new Set([...this.staff.values()].map((m) => m.name));
    const free = STR.staffNames.filter((n) => !used.has(n));
    const pool = free.length ? free : STR.staffNames;
    const member: StaffMember = {
      id: this.nextStaffId++,
      name: pool[Math.floor(Math.random() * pool.length)],
      role,
      post: null,
      onDuty: false,
      focus: null,
      restAt: this.staffHouses()[0]?.uid ?? null,
      status: 'asleep',
    };
    this.staff.set(member.id, member);
    this.emit('hired', member);
    if (role !== 'cleaner') {
      const target = post ?? this.unstaffed(role)[0]?.uid;
      if (target !== undefined) this.assign(member.id, target);
    }
    if (this.selection?.kind === 'building' && post !== undefined) this.emit('selection', this.selection);
    this.emit('staff');
    return member;
  }

  fire(id: number): void {
    const m = this.staff.get(id);
    if (!m) return;
    this.staff.delete(id);
    if (this.selection?.kind === 'staff' && this.selection.id === id) this.select(null);
    this.emit('fired', m);
    this.emit('staff');
  }

  /** The sun caught a worker outside. */
  loseStaff(id: number): void {
    if (!this.staff.has(id)) return;
    this.night.staffLost++;
    this.staff.delete(id);
    if (this.selection?.kind === 'staff' && this.selection.id === id) this.select(null);
    this.emit('staff');
  }

  /** How many places for a job a building has. */
  slotsFor(b: PlacedBuilding, role: Role): number {
    return b.def.staff?.filter((r) => r === role).length ?? 0;
  }

  /**
   * Move a worker to a building (null = no job). If all places for that job
   * are taken, the worker who was there first loses the job.
   */
  assign(id: number, uid: number | null): boolean {
    const m = this.staff.get(id);
    if (!m || m.role === 'cleaner') return false;
    if (uid !== null) {
      const b = this.buildings.get(uid);
      if (!b || this.slotsFor(b, m.role) === 0) return false;
      const same = this.staffOf(uid).filter((o) => o.role === m.role && o.id !== id);
      if (m.post !== uid && same.length >= this.slotsFor(b, m.role)) {
        same[0].post = null;
        same[0].onDuty = false;
      }
    }
    if (m.post !== uid) {
      m.post = uid;
      m.onDuty = false;
    }
    this.emit('staff');
    return true;
  }

  /** Workers assigned to a building. */
  staffOf(uid: number): StaffMember[] {
    return [...this.staff.values()].filter((m) => m.post === uid);
  }

  /** Jobs at a building that have nobody yet (each job listed once). */
  missingRoles(b: PlacedBuilding): Role[] {
    const roles = [...new Set(b.def.staff ?? [])];
    const here = this.staffOf(b.uid);
    return roles.filter((r) => !here.some((m) => m.role === r));
  }

  /** Workers of a role without a job. */
  idleStaff(role: Role): StaffMember[] {
    return [...this.staff.values()].filter((m) => m.role === role && m.post === null);
  }

  /**
   * Buildings with a free place for this job: first those that lack the job
   * completely (they are closed without it), then those with extra places.
   */
  unstaffed(role: Role): PlacedBuilding[] {
    const list = [...this.buildings.values()].filter(
      (b) => this.staffOf(b.uid).filter((m) => m.role === role).length < this.slotsFor(b, role),
    );
    const lacking = (b: PlacedBuilding) => (this.missingRoles(b).includes(role) ? 0 : 1);
    return list.sort((a, b) => lacking(a) - lacking(b));
  }

  /** Fill the places of a new building with workers who have no job. */
  private autoAssign(b: PlacedBuilding): void {
    for (const role of b.def.staff ?? []) {
      if (this.staffOf(b.uid).filter((m) => m.role === role).length >= this.slotsFor(b, role)) continue;
      const idle = this.idleStaff(role)[0];
      if (idle) this.assign(idle.id, b.uid);
    }
  }

  /** Every job here has someone (who may still be on the way), or nobody is needed. */
  isServed(b: PlacedBuilding): boolean {
    return this.missingRoles(b).length === 0;
  }

  /** Staffed buildings only work while at least one worker of every job is on duty. */
  isOpen(b: PlacedBuilding): boolean {
    if (!b.def.staff) return true;
    const here = this.staffOf(b.uid);
    return [...new Set(b.def.staff)].every((r) => here.some((m) => m.role === r && m.onDuty));
  }

  /** Workers of a job on duty at a building. */
  onDutyCount(uid: number, role: Role): number {
    return this.staffOf(uid).filter((m) => m.role === role && m.onDuty).length;
  }

  setOnDuty(id: number, onDuty: boolean): void {
    const m = this.staff.get(id);
    if (m) m.onDuty = onDuty;
  }

  setStatus(id: number, status: StaffStatus): void {
    const m = this.staff.get(id);
    if (m) m.status = status;
  }

  setRestAt(id: number, uid: number | null): void {
    const m = this.staff.get(id);
    if (m) m.restAt = uid;
  }

  /** Send a cleaner to a spot (null = roam freely). */
  setFocus(id: number, cell: Cell | null): void {
    const m = this.staff.get(id);
    if (!m || m.role !== 'cleaner') return;
    m.focus = cell;
    this.emit('staff');
  }

  /** Wages for everyone on the payroll. */
  wages(): number {
    let sum = 0;
    for (const m of this.staff.values()) sum += STAFF[m.role].wage;
    return sum;
  }

  staffByRole(): Record<Role, StaffMember[]> {
    const out = Object.fromEntries(ROLES.map((r) => [r, [] as StaffMember[]])) as Record<Role, StaffMember[]>;
    for (const m of this.staff.values()) out[m.role].push(m);
    return out;
  }

  // ---------------------------------------------------------------------------
  // cleanliness
  // ---------------------------------------------------------------------------

  /** Litter and slime only stay on paths (not on bridges or ferry lanes). */
  canGetDirty(tx: number, ty: number): boolean {
    if (!this.isWalkable(tx, ty)) return false;
    return !this.buildingAt(tx, ty)?.def.crossing;
  }

  dirtAt(tx: number, ty: number): { litter: number; slime: number } {
    if (!this.inBounds(tx, ty)) return { litter: 0, slime: 0 };
    const i = ty * GRID_W + tx;
    return { litter: this.litter[i], slime: this.slime[i] };
  }

  isDirty(tx: number, ty: number): boolean {
    const d = this.dirtAt(tx, ty);
    return d.litter + d.slime > 0;
  }

  addDirt(c: Cell, kind: DirtKind): void {
    if (!this.canGetDirty(c.tx, c.ty)) return;
    const arr = kind === 'litter' ? this.litter : this.slime;
    const i = c.ty * GRID_W + c.tx;
    if (arr[i] >= DIRT.max) return;
    arr[i]++;
    this.emit('dirt', { tx: c.tx, ty: c.ty });
  }

  /** A cleaner reserves a dirty cell (and gives up any earlier one). */
  claimDirt(staffId: number, c: Cell): void {
    this.releaseDirt(staffId);
    this.cleanClaims.set(c.ty * GRID_W + c.tx, staffId);
  }

  releaseDirt(staffId: number): void {
    for (const [cell, id] of this.cleanClaims) if (id === staffId) this.cleanClaims.delete(cell);
  }

  /** Is another cleaner already taking care of this cell? */
  isDirtClaimed(c: Cell, staffId: number): boolean {
    const id = this.cleanClaims.get(c.ty * GRID_W + c.tx);
    return id !== undefined && id !== staffId && this.staff.has(id);
  }

  /** A cleaner cleaned a cell. */
  clean(c: Cell): void {
    if (!this.isDirty(c.tx, c.ty)) return;
    this.clearDirt(c.tx, c.ty);
    this.night.cleaned++;
  }

  private clearDirt(tx: number, ty: number): void {
    const i = ty * GRID_W + tx;
    if (this.litter[i] + this.slime[i] === 0) return;
    this.litter[i] = 0;
    this.slime[i] = 0;
    this.emit('dirt', { tx, ty });
  }

  dirtyCells(): Cell[] {
    const out: Cell[] = [];
    for (let i = 0; i < this.litter.length; i++) {
      if (this.litter[i] + this.slime[i] > 0) out.push({ tx: i % GRID_W, ty: Math.floor(i / GRID_W) });
    }
    return out;
  }

  /** Is there a litter bin close to this cell? */
  nearBin(c: Cell): boolean {
    const r = DIRT.binRadius;
    for (const b of this.buildings.values()) {
      if (!b.def.bin) continue;
      if (Math.abs(b.tx - c.tx) <= r && Math.abs(b.ty - c.ty) <= r) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // queues
  // ---------------------------------------------------------------------------

  /** Get in line at a building. */
  joinQueue(uid: number, spiritId: number): void {
    const line = this.lines.get(uid) ?? [];
    if (!line.includes(spiritId)) line.push(spiritId);
    this.lines.set(uid, line);
  }

  leaveQueue(uid: number, spiritId: number): void {
    const line = this.lines.get(uid);
    if (!line) return;
    const i = line.indexOf(spiritId);
    if (i >= 0) line.splice(i, 1);
  }

  /** Place in line (0 = next), or -1. */
  queuePosition(uid: number, spiritId: number): number {
    return this.lines.get(uid)?.indexOf(spiritId) ?? -1;
  }

  queueLength(uid: number): number {
    return this.lines.get(uid)?.length ?? 0;
  }

  /** The first guest in line gets served if the building is open and has a free place. */
  tryServe(uid: number, spiritId: number): boolean {
    const b = this.buildings.get(uid);
    if (!b || !this.isOpen(b)) return false;
    const line = this.lines.get(uid);
    if (!line || line[0] !== spiritId) return false;
    const busy = this.serving.get(uid) ?? 0;
    if (busy >= (b.def.restaurant?.tables ?? b.def.service?.slots ?? 1)) return false;
    line.shift();
    this.serving.set(uid, busy + 1);
    return true;
  }

  /** Guests being served right now (taken tables in a restaurant). */
  servingCount(uid: number): number {
    return this.serving.get(uid) ?? 0;
  }

  endServe(uid: number): void {
    const n = this.serving.get(uid) ?? 0;
    if (n > 0) this.serving.set(uid, n - 1);
  }

  /** A guest gave up waiting. */
  recordAngry(): void {
    this.night.angry++;
  }

  // ---------------------------------------------------------------------------
  // bridges
  // ---------------------------------------------------------------------------

  /** Try to step onto a bridge; false if it is full. */
  tryEnterBridge(uid: number): boolean {
    const b = this.buildings.get(uid);
    if (b?.def.crossing?.kind !== 'walk') return true;
    const n = this.onBridge.get(uid) ?? 0;
    if (n >= b.def.crossing.capacity) return false;
    this.onBridge.set(uid, n + 1);
    return true;
  }

  leaveBridge(uid: number): void {
    const n = this.onBridge.get(uid) ?? 0;
    if (n > 0) this.onBridge.set(uid, n - 1);
  }

  bridgeLoad(uid: number): number {
    return this.onBridge.get(uid) ?? 0;
  }

  /** Spirits waiting in front of a bridge make pathfinding prefer other crossings. */
  setWaiting(uid: number, delta: 1 | -1): void {
    const n = (this.waitingAt.get(uid) ?? 0) + delta;
    this.waitingAt.set(uid, Math.max(0, n));
  }

  // ---------------------------------------------------------------------------
  // hotels
  // ---------------------------------------------------------------------------

  hotels(): PlacedBuilding[] {
    return [...this.buildings.values()].filter((b) => b.def.hotel);
  }

  freeBeds(uid: number): number {
    const b = this.buildings.get(uid);
    if (!b?.def.hotel || !this.isServed(b)) return 0;
    return b.def.hotel.beds - (this.sleepers.get(uid) ?? 0) - (this.reserved.get(uid) ?? 0);
  }

  reserveBed(uid: number): boolean {
    if (this.freeBeds(uid) <= 0) return false;
    this.reserved.set(uid, (this.reserved.get(uid) ?? 0) + 1);
    return true;
  }

  releaseBed(uid: number): void {
    const n = this.reserved.get(uid) ?? 0;
    if (n > 0) this.reserved.set(uid, n - 1);
  }

  sleepersIn(uid: number): number {
    return this.sleepers.get(uid) ?? 0;
  }

  /** A spirit with a reservation arrives and goes to sleep. */
  checkIn(uid: number): void {
    this.releaseBed(uid);
    if (!this.buildings.has(uid)) return;
    this.sleepers.set(uid, (this.sleepers.get(uid) ?? 0) + 1);
  }

  /** Total sleeping guests over all hotels. */
  get sleeperCount(): number {
    let n = 0;
    for (const v of this.sleepers.values()) n += v;
    return n;
  }

  /** Wakes everyone up: returns how many come out of each hotel. */
  takeSleepers(): Array<{ hotel: PlacedBuilding; count: number }> {
    const out: Array<{ hotel: PlacedBuilding; count: number }> = [];
    for (const [uid, count] of this.sleepers) {
      const hotel = this.buildings.get(uid);
      if (hotel && count > 0) out.push({ hotel, count });
    }
    this.sleepers.clear();
    return out;
  }

  // ---------------------------------------------------------------------------
  // spirits, money, popularity
  // ---------------------------------------------------------------------------

  setSpiritCount(n: number): void {
    this.spiritCount = n;
  }

  /** A spirit paid at a building. */
  earn(amount: number, where: Cell, source?: BuildingId): void {
    this.night.earned += amount;
    if (source) {
      const sale = this.sales.get(source) ?? { id: source, count: 0, coins: 0 };
      sale.count++;
      sale.coins += amount;
      this.sales.set(source, sale);
    }
    this.addMoney(amount);
    this.emit('earned', amount, where);
  }

  /** A spirit reached a hotel bed or left through the gate. */
  recordSafe(g: GuestStats): void {
    this.night.safe++;
    this.night.waitShare += g.waitShare;
    this.night.dirt += g.dirt;
    if (g.satisfaction >= HAPPY_THRESHOLD) this.night.happy++;
    else this.night.unhappy++;
  }

  recordLost(): void {
    this.night.lost++;
  }

  /** Sales of the running night, biggest first. */
  salesTonight(): { sales: Sale[]; earned: number } {
    return { sales: [...this.sales.values()].sort((a, b) => b.coins - a.coins), earned: this.night.earned };
  }

  /** How many guests the market can serve per night: sum over all buildings. */
  capacity(): number {
    let sum = 0;
    for (const b of this.buildings.values()) sum += capacityOf(b.def);
    return sum;
  }

  /** Different offers: kinds of wishes served plus different kitchens. */
  offers(): number {
    const needs = new Set<string>();
    const kitchens = new Set<string>();
    for (const b of this.buildings.values()) {
      if (b.def.provides) needs.add(b.def.provides.need);
      if (b.def.cuisine) kitchens.add(b.def.cuisine);
    }
    return needs.size + kitchens.size;
  }

  /**
   * How many spirits come tonight (sleepers included): exactly the popularity,
   * as long as the open areas allow that many.
   */
  guestsTonight(): number {
    return Math.min(this.guestCap(), this.popularity);
  }

  /** Most guests the open areas allow. */
  guestCap(): number {
    return this.areas.has('hotel') ? AREAS.hotel.guestCap : MARKET_GUEST_CAP;
  }



  // ---------------------------------------------------------------------------
  // clock
  // ---------------------------------------------------------------------------

  get isDawn(): boolean {
    return this.phase === 'night' && this.timeLeft <= DAWN_WARNING_MS;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.emit('speed', speed);
  }

  /** Space bar: pause, or resume at normal speed. */
  togglePause(): void {
    this.setSpeed(this.speed === 0 ? 1 : 0);
  }

  /** Cycle through 1× → 2× → 4× → 1×. */
  cycleSpeed(): void {
    const steps = SPEEDS.filter((s) => s > 0);
    const i = steps.indexOf(this.speed as (typeof steps)[number]);
    this.setSpeed(steps[(i + 1) % steps.length]);
  }

  /** The night can be skipped once every guest is gone and nobody else is coming. */
  get canSkipNight(): boolean {
    return this.phase === 'night' && this.spiritCount === 0 && this.pendingArrivals === 0;
  }

  /** Jump straight to the morning (the scene sends workers home first). */
  endNightNow(): void {
    if (this.phase === 'night') this.endNight();
  }

  /** Skip the rest of the day. */
  startNightNow(): void {
    if (this.phase === 'day') this.timeLeft = 0;
    if (this.speed === 0) this.setSpeed(1);
  }

  /** Advances game time by real milliseconds (scaled by the game speed). */
  tick(realDelta: number): void {
    this.timeLeft -= realDelta * this.speed;

    if (this.phase === 'night' && !this.dawnStarted && this.timeLeft <= DAWN_WARNING_MS) {
      this.dawnStarted = true;
      this.emit('dawn');
    }
    if (this.timeLeft > 0) return;

    if (this.phase === 'day') this.startNight();
    else this.endNight();
  }

  private startNight(): void {
    this.phase = 'night';
    this.timeLeft = NIGHT_MS;
    this.dawnStarted = false;
    this.night = { safe: 0, lost: 0, happy: 0, unhappy: 0, angry: 0, earned: 0, staffLost: 0, cleaned: 0, waitShare: 0, dirt: 0 };
    this.sales.clear();
    if (this.tool) this.setTool(null);
    this.emit('phase', 'night');
  }

  /** How tonight changes the popularity, part by part (rounded to tenths). */
  private popularityParts(): PopularityParts {
    const n = this.night;
    const guests = n.safe + n.lost;
    const r = (v: number) => Math.round(v * 10) / 10;
    if (guests === 0) {
      return {
        satisfaction: 0,
        waiting: 0,
        cleanliness: 0,
        lost: 0,
        offer: 0,
        novelty: 0,
        construction: r(Math.max(POP.nightWorkMax, this.nightWork * POP.nightWork)),
      };
    }
    const happyShare = n.safe ? n.happy / n.safe : 0;
    const avgWait = n.safe ? n.waitShare / n.safe : 0;
    const avgDirt = n.safe ? n.dirt / n.safe : 0;
    const offerRatio = this.offers() / expectedOffers(this.day);
    return {
      satisfaction: r(
        POP.satisfaction *
          Math.max(-1, Math.min(1, (happyShare - POP.satisfactionNeutral) / (happyShare >= POP.satisfactionNeutral ? 1 - POP.satisfactionNeutral : POP.satisfactionNeutral))),
      ),
      waiting: r(POP.anger * (n.angry / guests) + POP.waiting * Math.max(0, avgWait - POP.waitFree)),
      cleanliness: r(Math.max(POP.dirtMax, POP.dirtPerCell * avgDirt)),
      lost: r(POP.lost * (n.lost / guests)),
      offer: r(offerRatio >= 1 ? 0 : Math.max(POP.offerPenalty, (1 - offerRatio) * POP.offerPenalty)),
      // Shown as a percentage like the rest, but worth a fixed number of guests.
      novelty: r((Math.min(POP.noveltyMaxGuests, this.newAttractions * POP.noveltyGuests) / Math.max(1, this.popularity)) * 100),
      construction: r(Math.max(POP.nightWorkMax, this.nightWork * POP.nightWork)),
    };
  }

  private endNight(): void {
    // Listeners count the spirits still outside via recordLost().
    this.emit('sunrise');
    this.reserved.clear();
    this.onBridge.clear();
    this.waitingAt.clear();
    this.lines.clear();
    this.serving.clear();
    this.cleanClaims.clear();
    this.pendingArrivals = 0;

    const rooms = this.hotels().reduce((sum, h) => sum + (this.sleepers.get(h.uid) ?? 0) * h.def.hotel!.price, 0);
    if (rooms > 0) this.addMoney(rooms);
    const wages = this.wages();
    if (wages > 0) this.addMoney(-wages);
    for (const m of this.staff.values()) m.onDuty = false;

    const n = this.night;
    const xpGained = Math.round(n.earned * XP_PER_COIN + n.happy * XP_PER_HAPPY);
    this.addXp(xpGained);
    // Popularity changes by a percentage; at least one guest more or less when anything changed.
    const popParts = this.popularityParts();
    const percent = Object.values(popParts).reduce((sum, v) => sum + v, 0);
    const before = this.popularity;
    let change = Math.round((before * percent) / 100);
    if (change === 0 && Math.abs(percent) >= 0.5) change = Math.sign(percent);
    this.popularity = Math.max(POPULARITY_MIN, Math.min(this.guestCap(), before + change));
    const popDelta = this.popularity - before;
    this.newAttractions = 0;
    this.nightWork = 0;
    this.emit('popularity', this.popularity);

    this.day++;
    this.phase = 'day';
    this.timeLeft = DAY_MS;
    // The day always starts at normal speed, so nobody races into the next night by accident.
    if (this.speed > 1) this.setSpeed(1);
    this.emit('phase', 'day');
    const report: NightReport = {
      day: this.day,
      safe: n.safe,
      lost: n.lost,
      happy: n.happy,
      unhappy: n.unhappy,
      angry: n.angry,
      earned: n.earned,
      rooms,
      wages,
      staffLost: n.staffLost,
      cleaned: n.cleaned,
      dirty: this.dirtyCells().length,
      xp: xpGained,
      level: this.level,
      sales: this.salesTonight().sales,
      net: n.earned + rooms - wages,
      popularity: this.popularity,
      popDelta,
      popParts,
    };
    this.lastReport = report;
    this.emit('report', report);
  }

  // ---------------------------------------------------------------------------
  // saving and loading
  // ---------------------------------------------------------------------------

  /** A snapshot of the game. Taken by day, when nobody is out on the map. */
  toSave(): SaveData {
    const dirt: Array<[number, number, number]> = [];
    for (let i = 0; i < this.litter.length; i++) {
      if (this.litter[i] + this.slime[i] > 0) dirt.push([i, this.litter[i], this.slime[i]]);
    }
    return {
      version: 1,
      savedAt: Date.now(),
      day: this.day,
      money: this.money,
      popularity: this.popularity,
      level: this.level,
      xp: this.xp,
      areas: [...this.areas],
      buildings: [...this.buildings.values()].map((b) => ({ uid: b.uid, id: b.def.id, tx: b.tx, ty: b.ty, rot: b.rot, tier: b.tier })),
      staff: [...this.staff.values()].map((m) => ({ name: m.name, role: m.role, post: m.post, restAt: m.restAt, focus: m.focus })),
      sleepers: [...this.sleepers.entries()],
      dirt,
      lastReport: this.lastReport,
    };
  }

  /** Replace the current game with a saved one (before the scenes start). */
  restore(data: SaveData): void {
    for (const b of this.buildings.values()) {
      for (let x = 0; x < b.def.w; x++) for (let y = 0; y < b.def.h; y++) this.setCell(b.tx + x, b.ty + y, FREE);
    }
    this.buildings.clear();
    this.staff.clear();
    this.sleepers.clear();
    this.litter.fill(0);
    this.slime.fill(0);
    this.areas.clear();
    for (const a of data.areas) this.areas.add(a);

    // Buildings get new uids; remember how old ones map to new ones.
    const uids = new Map<number, number>();
    for (const sb of data.buildings) {
      if (this.place(sb.id, sb.tx, sb.ty, true, sb.rot) !== 'ok') continue;
      const b = [...this.buildings.values()].pop()!;
      if (sb.tier > 1) this.setTier(b, sb.tier);
      uids.set(sb.uid, b.uid);
    }
    const map = (uid: number | null) => (uid === null ? null : (uids.get(uid) ?? null));
    for (const sm of data.staff) {
      const id = this.nextStaffId++;
      this.staff.set(id, {
        id,
        name: sm.name,
        role: sm.role,
        post: map(sm.post),
        onDuty: false,
        focus: sm.focus,
        restAt: map(sm.restAt) ?? this.staffHouses()[0]?.uid ?? null,
        status: 'asleep',
      });
    }
    // Older saves may have more workers at a building than it now has places for.
    for (const m of this.staff.values()) {
      const b = m.post !== null ? this.buildings.get(m.post) : undefined;
      if (!b) continue;
      const same = [...this.staff.values()].filter((o) => o.post === b.uid && o.role === m.role);
      if (same.indexOf(m) >= this.slotsFor(b, m.role)) m.post = null;
    }
    for (const [uid, count] of data.sleepers) {
      const n = map(uid);
      if (n !== null) this.sleepers.set(n, count);
    }
    for (const [i, l, sl] of data.dirt) {
      this.litter[i] = l;
      this.slime[i] = sl;
    }
    this.day = data.day;
    this.money = data.money;
    this.popularity = Math.max(POPULARITY_MIN, data.popularity ?? data.reputation ?? POPULARITY_START);
    this.level = data.level;
    this.xp = data.xp;
    this.lastReport = data.lastReport;
    this.phase = 'day';
    this.timeLeft = DAY_MS;
    this.tool = null;
    this.selection = null;
  }

  /** For testing in the browser console: jump close to the next phase change. */
  skip(toMs = 3000): void {
    this.timeLeft = Math.min(this.timeLeft, toMs);
  }
}

/** Single shared game state for now; saving/loading will build on this later. */
export const state = new GameState();
