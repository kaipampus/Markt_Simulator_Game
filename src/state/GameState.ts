import {
  BRIDGE_QUEUE_COST,
  DAWN_WARNING_MS,
  DAY_MS,
  DEMOLISH_REFUND,
  FERRY_CELL_COST,
  FIRST_DAY_MS,
  GRID_H,
  GRID_W,
  GUESTS_BASE,
  GUESTS_PER_REPUTATION,
  HAPPY_THRESHOLD,
  NIGHT_MS,
  REP_HAPPY,
  REP_LOST,
  REP_UNHAPPY,
  REPUTATION_MAX,
  REPUTATION_START,
  RIVER_TOP,
  RIVER_ROWS,
  SPEEDS,
  START_MONEY,
} from '../config';
import { GATE, getBuilding, type BuildingDef, type BuildingId, type Need, type Zone } from '../data/buildings';
import { ERAS, type Era } from '../data/eras';
import { Emitter } from './Emitter';
import type { Cell } from './pathfinding';

/** What the player currently has selected in the build bar. */
export type Tool = { kind: 'build'; id: BuildingId } | { kind: 'demolish' } | null;

export interface PlacedBuilding {
  uid: number;
  def: BuildingDef;
  tx: number;
  ty: number;
}

export type PlaceResult = 'ok' | 'blocked' | 'zone' | 'adjacent' | 'locked' | 'money';
export type Phase = 'day' | 'night';
export type Terrain = 'hotel' | 'river' | 'market';

export interface NightReport {
  day: number;
  safe: number;
  lost: number;
  happy: number;
  unhappy: number;
  earned: number;
  rooms: number;
  repDelta: number;
  reputation: number;
}

type StateEvents = {
  money: [number];
  tool: [Tool];
  placed: [PlacedBuilding];
  removed: [PlacedBuilding];
  reputation: [number];
  speed: [number];
  era: [Era];
  /** Night starts / day starts. */
  phase: [Phase];
  /** The dawn warning begins: everyone hurries home. */
  dawn: [];
  /** The sun rises: listeners must call recordLost() for every spirit still outside. */
  sunrise: [];
  report: [NightReport];
  earned: [number, Cell];
};

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
  spiritCount = 0;
  reputation = REPUTATION_START;
  era: Era = 0;

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

  private night = { safe: 0, lost: 0, happy: 0, unhappy: 0, earned: 0 };

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

    // Starter infrastructure: a path from the gate up to a wooden bridge and one step beyond.
    const cx = this.gate.tx + 1;
    this.place('bridge', cx, RIVER_TOP, true);
    for (let y = RIVER_TOP + RIVER_ROWS; y < this.gate.ty - 1; y++) this.place('path', cx, y, true);
    this.place('path', cx, RIVER_TOP - 1, true);
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

  /** Walkable cells around a building, where spirits stand to use it. */
  entranceCells(b: PlacedBuilding): Cell[] {
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
    return def.era <= this.era;
  }

  checkPlace(def: BuildingDef, tx: number, ty: number): 'ok' | 'blocked' | 'zone' | 'adjacent' {
    let zoneOk = true;
    for (let x = 0; x < def.w; x++) {
      for (let y = 0; y < def.h; y++) {
        if (!this.inBounds(tx + x, ty + y)) return 'blocked';
        if (this.cell(tx + x, ty + y) !== FREE) return 'blocked';
        if (!zoneAllows(def.zone, this.terrainAt(tx + x, ty + y))) zoneOk = false;
      }
    }
    if (!zoneOk) return 'zone';
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
    this.emit('tool', tool);
  }

  canAfford(cost: number): boolean {
    return this.money >= cost;
  }

  private addMoney(delta: number): void {
    this.money += delta;
    this.emit('money', this.money);
  }

  place(id: BuildingId, tx: number, ty: number, free = false): PlaceResult {
    const def = getBuilding(id);
    if (!free && !this.isUnlocked(def)) return 'locked';
    const check = this.checkPlace(def, tx, ty);
    if (check !== 'ok') return check;
    if (!free && !this.canAfford(def.cost)) return 'money';

    const building: PlacedBuilding = { uid: this.nextUid++, def, tx, ty };
    this.buildings.set(building.uid, building);
    for (let x = 0; x < def.w; x++) {
      for (let y = 0; y < def.h; y++) this.setCell(tx + x, ty + y, building.uid);
    }
    if (!free) this.addMoney(-def.cost);
    this.emit('placed', building);
    return 'ok';
  }

  /** Removes a building and refunds part of its cost. Returns the refund. */
  demolish(uid: number): number {
    const building = this.buildings.get(uid);
    if (!building) return 0;
    const { def, tx, ty } = building;
    for (let x = 0; x < def.w; x++) {
      for (let y = 0; y < def.h; y++) this.setCell(tx + x, ty + y, FREE);
    }
    this.buildings.delete(uid);
    // Sleeping guests simply move out; they are not lost.
    this.sleepers.delete(uid);
    this.reserved.delete(uid);
    this.onBridge.delete(uid);
    this.waitingAt.delete(uid);
    const refund = Math.floor(def.cost * DEMOLISH_REFUND);
    this.addMoney(refund);
    this.emit('removed', building);
    return refund;
  }

  /** Buildings that satisfy a need. */
  providersOf(need: Need): PlacedBuilding[] {
    return [...this.buildings.values()].filter((b) => b.def.provides?.need === need);
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
    if (!b?.def.hotel) return 0;
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
  // spirits, money, reputation
  // ---------------------------------------------------------------------------

  setSpiritCount(n: number): void {
    this.spiritCount = n;
  }

  /** A spirit paid at a building. */
  earn(amount: number, where: Cell): void {
    this.night.earned += amount;
    this.addMoney(amount);
    this.emit('earned', amount, where);
  }

  /** A spirit reached a hotel bed or left through the gate. */
  recordSafe(satisfaction: number): void {
    this.night.safe++;
    if (satisfaction >= HAPPY_THRESHOLD) this.night.happy++;
    else this.night.unhappy++;
  }

  recordLost(): void {
    this.night.lost++;
  }

  /** How many spirits should be out tonight (sleepers included). */
  guestsTonight(): number {
    return GUESTS_BASE + Math.floor(this.reputation / GUESTS_PER_REPUTATION);
  }

  // ---------------------------------------------------------------------------
  // eras
  // ---------------------------------------------------------------------------

  /** The next era, if there is one. */
  get nextEra(): { era: Era; reputation: number; cost: number } | null {
    const next = this.era + 1;
    if (next >= ERAS.length) return null;
    return { era: next as Era, ...ERAS[next] };
  }

  canAdvanceEra(): boolean {
    const n = this.nextEra;
    return !!n && this.reputation >= n.reputation && this.money >= n.cost;
  }

  advanceEra(): boolean {
    const n = this.nextEra;
    if (!n || !this.canAdvanceEra()) return false;
    this.addMoney(-n.cost);
    this.era = n.era;
    this.emit('era', this.era);
    return true;
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
    this.night = { safe: 0, lost: 0, happy: 0, unhappy: 0, earned: 0 };
    this.emit('phase', 'night');
  }

  private endNight(): void {
    // Listeners count the spirits still outside via recordLost().
    this.emit('sunrise');
    this.reserved.clear();
    this.onBridge.clear();
    this.waitingAt.clear();

    const rooms = this.hotels().reduce((sum, h) => sum + (this.sleepers.get(h.uid) ?? 0) * h.def.hotel!.price, 0);
    if (rooms > 0) this.addMoney(rooms);

    const n = this.night;
    const repDelta = n.happy * REP_HAPPY + n.unhappy * REP_UNHAPPY + n.lost * REP_LOST;
    this.reputation = Math.max(0, Math.min(REPUTATION_MAX, this.reputation + repDelta));
    this.emit('reputation', this.reputation);

    this.day++;
    this.phase = 'day';
    this.timeLeft = DAY_MS;
    this.emit('phase', 'day');
    this.emit('report', {
      day: this.day,
      safe: n.safe,
      lost: n.lost,
      happy: n.happy,
      unhappy: n.unhappy,
      earned: n.earned,
      rooms,
      repDelta,
      reputation: this.reputation,
    });
  }

  /** For testing in the browser console: jump close to the next phase change. */
  skip(toMs = 3000): void {
    this.timeLeft = Math.min(this.timeLeft, toMs);
  }
}

/** Single shared game state for now; saving/loading will build on this later. */
export const state = new GameState();
