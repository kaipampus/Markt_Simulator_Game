import { DEMOLISH_REFUND, GRID_H, GRID_W, START_MONEY } from '../config';
import { GATE, getBuilding, type BuildingDef, type BuildingId } from '../data/buildings';
import { Emitter } from './Emitter';

/** What the player currently has selected in the build bar. */
export type Tool = { kind: 'build'; id: BuildingId } | { kind: 'demolish' } | null;

export interface PlacedBuilding {
  uid: number;
  def: BuildingDef;
  tx: number;
  ty: number;
}

export type PlaceResult = 'ok' | 'blocked' | 'money';

type StateEvents = {
  money: [number];
  tool: [Tool];
  placed: [PlacedBuilding];
  removed: [PlacedBuilding];
  spirits: [number];
};

/** Cell values in the occupancy grid. Positive numbers are building uids. */
const FREE = 0;
/** Walkable but not buildable (in front of the gate). */
const RESERVED = -1;
/** Not walkable, not buildable (the gate itself). */
const BLOCKED = -2;

/**
 * The whole game state, independent of rendering.
 * Scenes read from it and listen to its events.
 */
export class GameState extends Emitter<StateEvents> {
  money = START_MONEY;
  tool: Tool = null;
  spiritCount = 0;

  readonly buildings = new Map<number, PlacedBuilding>();
  private grid = new Int32Array(GRID_W * GRID_H);
  private nextUid = 1;

  /** Top-left cell of the gate (bottom centre of the market). */
  readonly gate = { tx: Math.floor(GRID_W / 2) - 1, ty: GRID_H - GATE.h };

  /** Cells right in front of the gate where spirits appear. */
  readonly spawnCells: ReadonlyArray<{ tx: number; ty: number }>;

  constructor() {
    super();
    const spawn: { tx: number; ty: number }[] = [];
    for (let x = 0; x < GATE.w; x++) {
      for (let y = 0; y < GATE.h; y++) {
        this.setCell(this.gate.tx + x, this.gate.ty + y, BLOCKED);
      }
      const front = { tx: this.gate.tx + x, ty: this.gate.ty - 1 };
      this.setCell(front.tx, front.ty, RESERVED);
      spawn.push(front);
    }
    this.spawnCells = spawn;
  }

  // ---------- grid ----------

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < GRID_W && ty < GRID_H;
  }

  private cell(tx: number, ty: number): number {
    return this.grid[ty * GRID_W + tx];
  }

  private setCell(tx: number, ty: number, value: number): void {
    this.grid[ty * GRID_W + tx] = value;
  }

  isWalkable(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return false;
    const c = this.cell(tx, ty);
    return c === FREE || c === RESERVED;
  }

  /** Building standing on a cell, if any. */
  buildingAt(tx: number, ty: number): PlacedBuilding | undefined {
    if (!this.inBounds(tx, ty)) return undefined;
    const c = this.cell(tx, ty);
    return c > 0 ? this.buildings.get(c) : undefined;
  }

  canPlace(def: BuildingDef, tx: number, ty: number): boolean {
    for (let x = 0; x < def.w; x++) {
      for (let y = 0; y < def.h; y++) {
        if (!this.inBounds(tx + x, ty + y)) return false;
        if (this.cell(tx + x, ty + y) !== FREE) return false;
      }
    }
    return true;
  }

  // ---------- actions ----------

  setTool(tool: Tool): void {
    this.tool = tool;
    this.emit('tool', tool);
  }

  setSpiritCount(n: number): void {
    if (n === this.spiritCount) return;
    this.spiritCount = n;
    this.emit('spirits', n);
  }

  canAfford(cost: number): boolean {
    return this.money >= cost;
  }

  private addMoney(delta: number): void {
    this.money += delta;
    this.emit('money', this.money);
  }

  place(id: BuildingId, tx: number, ty: number): PlaceResult {
    const def = getBuilding(id);
    if (!this.canPlace(def, tx, ty)) return 'blocked';
    if (!this.canAfford(def.cost)) return 'money';

    const building: PlacedBuilding = { uid: this.nextUid++, def, tx, ty };
    this.buildings.set(building.uid, building);
    for (let x = 0; x < def.w; x++) {
      for (let y = 0; y < def.h; y++) this.setCell(tx + x, ty + y, building.uid);
    }
    this.addMoney(-def.cost);
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
    const refund = Math.floor(def.cost * DEMOLISH_REFUND);
    this.addMoney(refund);
    this.emit('removed', building);
    return refund;
  }
}

/** Single shared game state for now; saving/loading will build on this later. */
export const state = new GameState();
