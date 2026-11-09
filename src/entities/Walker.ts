import type * as Phaser from 'phaser';
import { SPIRIT_SPEED, TILE } from '../config';
import type { GameState } from '../state/GameState';
import { searchFrom, type Cell, type Field } from '../state/pathfinding';
import type { Ferry } from './Ferry';
import type { Restaurant } from './Restaurant';

/** What the scene provides to everyone walking around. */
export interface WalkerWorld {
  glowLayer: Phaser.GameObjects.Layer;
  ferry(uid: number): Ferry | undefined;
  restaurant(uid: number): Restaurant | undefined;
}

/** World position of a figure's feet when standing on a cell. */
export function cellToWorld(c: Cell): { x: number; y: number } {
  return { x: c.tx * TILE + TILE / 2, y: c.ty * TILE + TILE * 0.72 };
}

/**
 * Anyone who walks along paths: guests and workers. Handles following a
 * path, queueing at full bridges and riding ferries. Subclasses decide where
 * to go (`replan`) and what happens at the end of a path (`arrive`).
 */
export abstract class Walker {
  protected x: number;
  protected y: number;
  protected path: Cell[] = [];
  protected speed = SPIRIT_SPEED;

  /** Waiting for or sitting on a ferry. */
  protected riding = false;
  /** On a ferry deck (true) or still waiting at the bank (false). */
  protected boarded = false;
  /** Bridge we are currently on (counts towards its capacity). */
  protected bridgeUid: number | null = null;
  /** Bridge we are queueing for. */
  protected waitingFor: number | null = null;

  constructor(
    protected scene: Phaser.Scene,
    protected state: GameState,
    protected world: WalkerWorld,
    start: Cell,
  ) {
    const p = cellToWorld(start);
    this.x = p.x;
    this.y = p.y;
  }

  /** True once the walker has left the map for good. Ferries drop such riders. */
  abstract get isDone(): boolean;
  /** Reached the end of the path. */
  protected abstract arrive(): void;
  /** The way ahead changed: pick a new path. */
  protected abstract replan(): void;
  /** Face left or right while walking. */
  protected abstract face(left: boolean): void;
  /** Stepped onto a new cell. */
  protected onEnterCell(_c: Cell): void {}

  protected get cell(): Cell {
    return { tx: Math.floor(this.x / TILE), ty: Math.floor(this.y / TILE) };
  }

  protected search(): Field {
    return searchFrom(this.cell, this.state.travelCost);
  }

  protected setWaitingFor(uid: number | null): void {
    if (this.waitingFor === uid) return;
    if (this.waitingFor !== null) this.state.setWaiting(this.waitingFor, -1);
    if (uid !== null) this.state.setWaiting(uid, 1);
    this.waitingFor = uid;
  }

  protected setPath(path: Cell[]): void {
    this.setWaitingFor(null);
    this.path = path;
  }

  /** Is the path ahead still walkable? */
  protected pathBlocked(): boolean {
    return this.path.some((c) => !this.state.isWalkable(c.tx, c.ty));
  }

  /** Is the walker queueing (bridge) or waiting at a ferry? */
  protected get queueing(): boolean {
    return this.waitingFor !== null || (this.riding && !this.boarded);
  }

  /** Move along the path; calls `arrive()` at its end. Does nothing while riding a ferry. */
  protected walk(delta: number): void {
    if (this.riding) return;
    const next = this.path[0];
    if (!next) {
      this.arrive();
      return;
    }

    const here = this.cell;
    const hereB = this.state.buildingAt(here.tx, here.ty);
    const nextB = this.state.buildingAt(next.tx, next.ty);
    const crossing = nextB?.def.crossing;
    if (nextB && crossing && nextB.uid !== hereB?.uid && nextB.uid !== this.bridgeUid) {
      if (crossing.kind === 'walk') {
        // Full bridge: stand in line.
        if (!this.state.tryEnterBridge(nextB.uid)) {
          this.setWaitingFor(nextB.uid);
          return;
        }
        this.setWaitingFor(null);
        this.bridgeUid = nextB.uid;
      } else {
        const ferry = this.world.ferry(nextB.uid);
        if (!ferry) {
          this.replan();
          return;
        }
        // Skip the lane cells; the ferry drops us at the other bank.
        while (this.path.length && this.state.buildingAt(this.path[0].tx, this.path[0].ty)?.uid === nextB.uid) {
          this.path.shift();
        }
        this.riding = true;
        this.boarded = false;
        ferry.request(this, here.ty < nextB.ty ? 'north' : 'south');
        return;
      }
    }

    const target = cellToWorld(next);
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = (this.speed * delta) / 1000;
    if (Math.abs(dx) > 0.5) this.face(dx < 0);
    if (dist <= step) {
      this.x = target.x;
      this.y = target.y;
      this.path.shift();
      if (this.bridgeUid !== null && this.state.buildingAt(next.tx, next.ty)?.uid !== this.bridgeUid) {
        this.state.leaveBridge(this.bridgeUid);
        this.bridgeUid = null;
      }
      this.onEnterCell(next);
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
  }

  /** Called by a ferry when the walker steps onto the deck. */
  startRide(): void {
    this.boarded = true;
  }

  /** Called by a ferry while sailing. */
  setRidePosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /** Called by a ferry at the other bank (or when the ferry is removed). */
  endRide(bank: Cell, stranded = false): void {
    if (this.isDone) return;
    const p = cellToWorld(bank);
    this.x = p.x;
    this.y = p.y;
    this.boarded = false;
    this.riding = false;
    if (stranded || this.path.length === 0) this.replan();
  }

  /** The ferry we were waiting for is gone. */
  cancelRide(): void {
    if (this.isDone) return;
    this.boarded = false;
    this.riding = false;
    this.replan();
  }

  /** Leave bridges and queues, e.g. before disappearing. */
  protected releaseCrossings(): void {
    this.setWaitingFor(null);
    if (this.bridgeUid !== null) this.state.leaveBridge(this.bridgeUid);
    this.bridgeUid = null;
  }

  /** World position, e.g. for floating texts and clicks. */
  get position(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}
