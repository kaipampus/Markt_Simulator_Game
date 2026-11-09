import * as Phaser from 'phaser';
import { DEPTH, TILE } from '../config';
import { TEX } from '../gfx/textures';
import type { PlacedBuilding } from '../state/GameState';
import type { Cell } from '../state/pathfinding';
import type { Walker } from './Walker';

export type Bank = 'north' | 'south';

/**
 * A ferry boat shuttling across the river along its lane.
 * Spirits queue at either bank; the boat waits at its dock until it is full
 * or its waiting time is over, then crosses and unloads everyone.
 */
export class Ferry {
  private boat: Phaser.GameObjects.Image;
  private dock: Bank = 'south';
  private sailing = false;
  private progress = 0;
  private dockMs = 0;
  private queues: Record<Bank, Walker[]> = { north: [], south: [] };
  private riders: Walker[] = [];

  constructor(
    scene: Phaser.Scene,
    readonly building: PlacedBuilding,
  ) {
    this.boat = scene.add
      .image(this.x, this.dockY('south'), TEX.boat(building.def.id))
      .setDepth(DEPTH.boat);
  }

  private get crossing() {
    const c = this.building.def.crossing;
    if (c?.kind !== 'boat') throw new Error('Ferry without boat crossing');
    return c;
  }

  private get x(): number {
    return this.building.tx * TILE + TILE / 2;
  }

  private dockY(side: Bank): number {
    const b = this.building;
    return side === 'north' ? b.ty * TILE + TILE * 0.6 : (b.ty + b.def.h) * TILE - TILE * 0.6;
  }

  /** The land cell next to the lane on one side, where spirits wait and get off. */
  bankCell(side: Bank): Cell {
    const b = this.building;
    return side === 'north' ? { tx: b.tx, ty: b.ty - 1 } : { tx: b.tx, ty: b.ty + b.def.h };
  }

  /** A spirit standing at `side` wants to cross. */
  request(spirit: Walker, side: Bank): void {
    this.queues[side].push(spirit);
  }

  update(delta: number): void {
    // Forget spirits that were lost to the sun in the meantime.
    this.riders = this.riders.filter((s) => !s.isDone);
    this.queues.north = this.queues.north.filter((s) => !s.isDone);
    this.queues.south = this.queues.south.filter((s) => !s.isDone);

    const { capacity, tripMs, waitMs } = this.crossing;

    if (this.sailing) {
      this.progress = Math.min(1, this.progress + delta / tripMs);
      const from = this.dockY(this.dock);
      const to = this.dockY(this.dock === 'north' ? 'south' : 'north');
      const t = Phaser.Math.Easing.Sine.InOut(this.progress);
      this.boat.setY(Phaser.Math.Linear(from, to, t));
      this.placeRiders();
      if (this.progress >= 1) {
        this.sailing = false;
        this.dock = this.dock === 'north' ? 'south' : 'north';
        this.dockMs = 0;
        const exit = this.bankCell(this.dock);
        for (const r of this.riders) r.endRide(exit);
        this.riders = [];
      }
      return;
    }

    // Docked: let waiting spirits board.
    const queue = this.queues[this.dock];
    while (this.riders.length < capacity && queue.length > 0) {
      const s = queue.shift()!;
      s.startRide();
      this.riders.push(s);
    }
    this.placeRiders();

    this.dockMs += delta;
    const other = this.queues[this.dock === 'north' ? 'south' : 'north'];
    const full = this.riders.length >= capacity;
    const leaveWithGuests = this.riders.length > 0 && (full || this.dockMs >= waitMs);
    const fetchOthers = this.riders.length === 0 && other.length > 0 && this.dockMs >= waitMs * 0.4;
    if (leaveWithGuests || fetchOthers) {
      this.sailing = true;
      this.progress = 0;
    }
  }

  /** Riders stand on the deck in rows of three. */
  private placeRiders(): void {
    this.riders.forEach((r, i) => {
      const col = (i % 3) - 1;
      const row = Math.floor(i / 3);
      r.setRidePosition(this.x + col * 9, this.boat.y + 4 - row * 5);
    });
  }

  /** The ferry is demolished: everyone gets off where they are. */
  destroy(): void {
    const bank = this.bankCell(this.dock);
    for (const r of this.riders) r.endRide(bank, true);
    for (const s of [...this.queues.north, ...this.queues.south]) s.cancelRide();
    this.riders = [];
    this.queues = { north: [], south: [] };
    this.boat.destroy();
  }
}
