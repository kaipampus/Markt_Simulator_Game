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
import { DIRT, ROLES, STAFF, type Role } from '../data/staff';
import { STR } from '../data/strings';
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

export type PlaceResult = 'ok' | 'blocked' | 'zone' | 'adjacent' | 'locked' | 'money' | 'night';
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

export interface NightReport {
  day: number;
  safe: number;
  lost: number;
  happy: number;
  unhappy: number;
  earned: number;
  rooms: number;
  wages: number;
  staffLost: number;
  cleaned: number;
  dirty: number;
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
  /** Roster or assignments changed. */
  staff: [];
  hired: [StaffMember];
  fired: [StaffMember];
  selection: [Selection];
  /** Dirt on a cell changed. */
  dirt: [Cell];
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

  // --- staff ---
  readonly staff = new Map<number, StaffMember>();
  private nextStaffId = 1;
  selection: Selection = null;

  // --- cleanliness: per cell ---
  private litter = new Uint8Array(GRID_W * GRID_H);
  private slime = new Uint8Array(GRID_W * GRID_H);

  private night = { safe: 0, lost: 0, happy: 0, unhappy: 0, earned: 0, staffLost: 0, cleaned: 0 };

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
    // A small staff lodge next to the path, so the first workers have a home.
    this.place('staff_lodge', cx + 1, this.gate.ty - 3, true);
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
    if (tool) this.select(null);
    this.emit('tool', tool);
  }

  /** Building and demolishing only happen during the day. */
  get canBuild(): boolean {
    return this.phase === 'day';
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
    if (!free && !this.canBuild) return 'night';
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
    if (def.staff) this.autoAssign(building);
    return 'ok';
  }

  /** Removes a building and refunds part of its cost. */
  demolish(uid: number): DemolishResult {
    const building = this.buildings.get(uid);
    if (!building) return { result: 'ok', refund: 0 };
    if (!this.canBuild) return { result: 'night' };
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

  /** Move a worker to a building (null = no job). Whoever worked there before loses the job. */
  assign(id: number, uid: number | null): boolean {
    const m = this.staff.get(id);
    if (!m || m.role === 'cleaner') return false;
    if (uid !== null) {
      const b = this.buildings.get(uid);
      if (b?.def.staff !== m.role) return false;
      const previous = this.staffAt(uid);
      if (previous && previous.id !== id) {
        previous.post = null;
        previous.onDuty = false;
      }
    }
    if (m.post !== uid) {
      m.post = uid;
      m.onDuty = false;
    }
    this.emit('staff');
    return true;
  }

  /** Worker assigned to a building. */
  staffAt(uid: number): StaffMember | undefined {
    for (const m of this.staff.values()) if (m.post === uid) return m;
    return undefined;
  }

  /** Workers of a role without a job. */
  idleStaff(role: Role): StaffMember[] {
    return [...this.staff.values()].filter((m) => m.role === role && m.post === null);
  }

  /** Buildings that need a worker of this role and have none. */
  unstaffed(role: Role): PlacedBuilding[] {
    return [...this.buildings.values()].filter((b) => b.def.staff === role && !this.staffAt(b.uid));
  }

  private autoAssign(b: PlacedBuilding): void {
    const role = b.def.staff;
    if (!role || this.staffAt(b.uid)) return;
    const idle = this.idleStaff(role)[0];
    if (idle) this.assign(idle.id, b.uid);
  }

  /** Someone is (or will be) working here, or nobody is needed. */
  isServed(b: PlacedBuilding): boolean {
    return !b.def.staff || this.staffAt(b.uid) !== undefined;
  }

  /** Staffed buildings only work while their worker stands at the post. */
  isOpen(b: PlacedBuilding): boolean {
    return !b.def.staff || this.staffAt(b.uid)?.onDuty === true;
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
    this.night = { safe: 0, lost: 0, happy: 0, unhappy: 0, earned: 0, staffLost: 0, cleaned: 0 };
    if (this.tool) this.setTool(null);
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
    const wages = this.wages();
    if (wages > 0) this.addMoney(-wages);
    for (const m of this.staff.values()) m.onDuty = false;

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
      wages,
      staffLost: n.staffLost,
      cleaned: n.cleaned,
      dirty: this.dirtyCells().length,
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
