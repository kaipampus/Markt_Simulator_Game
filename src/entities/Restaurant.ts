import * as Phaser from 'phaser';
import { TILE } from '../config';
import type { Role } from '../data/staff';
import { restaurantLayout, TEX } from '../gfx/textures';
import type { GameState, PlacedBuilding } from '../state/GameState';

/** A guest sitting at a table. */
export interface Diner {
  readonly isDone: boolean;
  /** The waiter put the food on the table. */
  foodServed(): void;
}

type TableState = 'free' | 'seated' | 'ordered' | 'cooking' | 'ready' | 'served';

interface Waiter {
  img: Phaser.GameObjects.Image;
  plate: Phaser.GameObjects.Image;
  x: number;
  y: number;
  /** Table we are bringing food to, and whether we are on the way back. */
  task: { table: number; back: boolean } | null;
}

const WAITER_SPEED = 120;

/**
 * Runs one restaurant: guests take a table and order, cooks cook one dish
 * each at a time, waiters carry the dishes from the pass to the tables.
 * Cooks and waiters on duty are drawn inside the room; the worker figures
 * themselves wait hidden at the door.
 */
export class Restaurant {
  private tables: Array<{ guest: Diner | null; state: TableState }>;
  private cooking: Array<{ table: number; ms: number }> = [];
  private orders: number[] = [];
  private ready: number[] = [];
  private cooks: Phaser.GameObjects.Image[] = [];
  private waiters: Waiter[] = [];
  private readonly layout;
  private readonly ox: number;
  private readonly oy: number;

  constructor(
    private scene: Phaser.Scene,
    private state: GameState,
    readonly building: PlacedBuilding,
  ) {
    const def = building.def;
    this.layout = restaurantLayout(def);
    this.ox = building.tx * TILE;
    this.oy = building.ty * TILE;
    this.tables = Array.from({ length: def.restaurant?.tables ?? 0 }, () => ({ guest: null, state: 'free' as TableState }));
  }

  private world(p: { x: number; y: number }): { x: number; y: number } {
    return { x: this.ox + p.x, y: this.oy + p.y };
  }

  /** Free tables right now. */
  get freeTables(): number {
    return this.tables.filter((t) => t.state === 'free').length;
  }

  /** Take a free table; returns its number or null. */
  seat(guest: Diner): number | null {
    const i = this.tables.findIndex((t) => t.state === 'free');
    if (i < 0) return null;
    this.tables[i] = { guest, state: 'seated' };
    return i;
  }

  /** Where a guest sits at table i (world position of the feet). */
  seatPos(i: number): { x: number; y: number } {
    return this.world(this.layout.tables[i].seat);
  }

  /** The guest at table i is seated and orders. */
  order(i: number): void {
    if (this.tables[i]?.state !== 'seated') return;
    this.tables[i].state = 'ordered';
    this.orders.push(i);
  }

  /** The guest leaves table i (finished, angry or going home). */
  leave(i: number): void {
    if (!this.tables[i]) return;
    this.tables[i] = { guest: null, state: 'free' };
    this.orders = this.orders.filter((t) => t !== i);
    this.ready = this.ready.filter((t) => t !== i);
    this.cooking = this.cooking.filter((c) => c.table !== i);
    for (const w of this.waiters) {
      if (w.task?.table === i && !w.task.back) {
        w.task.back = true;
        w.plate.setVisible(false);
      }
    }
  }

  /** `delta` is already scaled by the game speed. */
  update(delta: number, time: number): void {
    const cookCount = this.state.onDutyCount(this.building.uid, 'cook');
    const waiterCount = this.state.onDutyCount(this.building.uid, 'waiter');
    this.syncCooks(cookCount);
    this.syncWaiters(waiterCount);

    // Drop guests who vanished (lost to the sun) without leaving properly.
    this.tables.forEach((t, i) => {
      if (t.guest?.isDone) this.leave(i);
    });

    // Kitchen: every cook works on one dish.
    const cookMs = this.building.def.restaurant?.cookMs ?? 3000;
    while (this.cooking.length < cookCount && this.orders.length) {
      const table = this.orders.shift()!;
      this.tables[table].state = 'cooking';
      this.cooking.push({ table, ms: cookMs });
    }
    for (const c of this.cooking) c.ms -= delta;
    for (const c of this.cooking.filter((c) => c.ms <= 0)) {
      this.tables[c.table].state = 'ready';
      this.ready.push(c.table);
    }
    this.cooking = this.cooking.filter((c) => c.ms > 0);

    // Service: waiters carry ready dishes from the pass to the tables.
    const pass = this.world(this.layout.pass);
    for (const w of this.waiters) {
      if (!w.task && this.ready.length && Math.hypot(w.x - pass.x, w.y - pass.y) < 2) {
        w.task = { table: this.ready.shift()!, back: false };
        w.plate.setVisible(true);
      }
      const target = !w.task || w.task.back ? pass : this.world(this.layout.tables[w.task.table].serve);
      const dx = target.x - w.x;
      const dy = target.y - w.y;
      const dist = Math.hypot(dx, dy);
      const step = (WAITER_SPEED * delta) / 1000;
      if (dist > step) {
        w.x += (dx / dist) * step;
        w.y += (dy / dist) * step;
        if (Math.abs(dx) > 0.5) w.img.setFlipX(dx < 0);
      } else {
        w.x = target.x;
        w.y = target.y;
        if (w.task && !w.task.back) {
          const t = this.tables[w.task.table];
          if (t.state === 'ready' && t.guest) {
            t.state = 'served';
            t.guest.foodServed();
          }
          w.task.back = true;
          w.plate.setVisible(false);
        } else if (w.task?.back) {
          w.task = null;
        }
      }
      const bob = Math.sin(time / 140 + w.x) * 1.5;
      w.img.setPosition(w.x, w.y - 3 + bob).setDepth(w.y);
      w.plate.setPosition(w.x + 9, w.y - 24 + bob).setDepth(w.y + 0.1);
    }

    // Cooks bob at their stoves.
    this.cooks.forEach((c, i) => {
      const p = this.world(this.layout.stoves[i % this.layout.stoves.length]);
      c.setPosition(p.x, p.y - 3 + Math.sin(time / 260 + i) * 1.5).setDepth(p.y);
    });
  }

  private figure(role: Role, x: number, y: number): Phaser.GameObjects.Image {
    return this.scene.add.image(x, y, TEX.worker(role)).setOrigin(0.5, 1).setScale(0.9).setDepth(y);
  }

  private syncCooks(n: number): void {
    while (this.cooks.length < n) {
      const p = this.world(this.layout.stoves[this.cooks.length % this.layout.stoves.length]);
      this.cooks.push(this.figure('cook', p.x, p.y));
    }
    while (this.cooks.length > n) this.cooks.pop()!.destroy();
  }

  private syncWaiters(n: number): void {
    const pass = this.world(this.layout.pass);
    while (this.waiters.length < n) {
      const img = this.figure('waiter', pass.x, pass.y);
      const plate = this.scene.add.image(pass.x, pass.y, TEX.plate).setVisible(false);
      this.waiters.push({ img, plate, x: pass.x, y: pass.y, task: null });
    }
    while (this.waiters.length > n) {
      const w = this.waiters.pop()!;
      // A dish on its way goes back to the pass.
      if (w.task && !w.task.back && this.tables[w.task.table]?.state === 'ready') this.ready.unshift(w.task.table);
      w.img.destroy();
      w.plate.destroy();
    }
  }

  destroy(): void {
    this.syncCooks(0);
    this.syncWaiters(0);
  }
}
