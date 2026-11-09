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
type Pt = { x: number; y: number };

/** A cook or waiter figure inside the restaurant. */
interface Figure {
  img: Phaser.GameObjects.Image;
  plate: Phaser.GameObjects.Image;
  x: number;
  y: number;
  /**
   * Cooks: 'cook' at the stove, 'carry' to the pass, 'back' to the stove.
   * Waiters: 'carry' to the table, 'back' to the pass.
   */
  task: { table: number; stage: 'cook' | 'carry' | 'back'; ms: number } | null;
}

const WALK_SPEED = 110;

/**
 * Runs one restaurant. Guests take a table and order. A cook cooks the dish
 * at the stove and carries it to the pass; a waiter takes it from the pass
 * to the table. Cooks and waiters on duty are drawn inside the room; the
 * worker figures themselves wait hidden at the door.
 */
export class Restaurant {
  private tables: Array<{ guest: Diner | null; state: TableState }>;
  private orders: number[] = [];
  private ready: number[] = [];
  private cooks: Figure[] = [];
  private waiters: Figure[] = [];
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

  private world(p: Pt): Pt {
    return { x: this.ox + p.x, y: this.oy + p.y };
  }

  /** Take a free table; returns its number or null. */
  seat(guest: Diner): number | null {
    const i = this.tables.findIndex((t) => t.state === 'free');
    if (i < 0) return null;
    this.tables[i] = { guest, state: 'seated' };
    return i;
  }

  /** Where a guest sits at table i (world position of the feet). */
  seatPos(i: number): Pt {
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
    for (const f of [...this.cooks, ...this.waiters]) {
      if (f.task?.table === i && f.task.stage !== 'back') {
        f.task.stage = 'back';
        f.plate.setVisible(false);
      }
    }
  }

  /** Moves a figure towards a point; true when it got there. */
  private walk(f: Figure, to: Pt, delta: number): boolean {
    const dx = to.x - f.x;
    const dy = to.y - f.y;
    const dist = Math.hypot(dx, dy);
    const step = (WALK_SPEED * delta) / 1000;
    if (dist <= step) {
      f.x = to.x;
      f.y = to.y;
      return true;
    }
    f.x += (dx / dist) * step;
    f.y += (dy / dist) * step;
    if (Math.abs(dx) > 0.5) f.img.setFlipX(dx < 0);
    return false;
  }

  private draw(f: Figure, time: number, busy: boolean): void {
    const bob = Math.sin(time / (busy ? 120 : 300) + f.x) * (busy ? 1.5 : 1);
    f.img.setPosition(f.x, f.y - 3 + bob).setDepth(f.y);
    f.plate.setPosition(f.x + 9, f.y - 24 + bob).setDepth(f.y + 0.1);
  }

  /** `delta` is already scaled by the game speed. */
  update(delta: number, time: number): void {
    this.sync(this.cooks, 'cook', this.state.onDutyCount(this.building.uid, 'cook'));
    this.sync(this.waiters, 'waiter', this.state.onDutyCount(this.building.uid, 'waiter'));

    // Drop guests who vanished (lost to the sun) without leaving properly.
    this.tables.forEach((t, i) => {
      if (t.guest?.isDone) this.leave(i);
    });

    // Cooks: cook at the stove, carry the dish to the pass, go back.
    const cookMs = this.building.def.restaurant?.cookMs ?? 3000;
    const drop = this.world(this.layout.drop);
    this.cooks.forEach((c, i) => {
      const stove = this.world(this.layout.stoves[i % this.layout.stoves.length]);
      if (!c.task && this.orders.length && Math.hypot(c.x - stove.x, c.y - stove.y) < 2) {
        const table = this.orders.shift()!;
        this.tables[table].state = 'cooking';
        c.task = { table, stage: 'cook', ms: cookMs };
      }
      const t = c.task;
      if (t?.stage === 'cook') {
        t.ms -= delta;
        if (t.ms <= 0) {
          t.stage = 'carry';
          c.plate.setVisible(true);
        }
      } else if (t?.stage === 'carry') {
        if (this.walk(c, drop, delta)) {
          if (this.tables[t.table].state === 'cooking') {
            this.tables[t.table].state = 'ready';
            this.ready.push(t.table);
          }
          t.stage = 'back';
          c.plate.setVisible(false);
        }
      } else if (this.walk(c, stove, delta)) {
        c.task = null;
      }
      this.draw(c, time, t?.stage === 'cook');
    });

    // Waiters: take ready dishes from the pass to the tables.
    const pass = this.world(this.layout.pass);
    for (const w of this.waiters) {
      if (!w.task && this.ready.length && Math.hypot(w.x - pass.x, w.y - pass.y) < 2) {
        w.task = { table: this.ready.shift()!, stage: 'carry', ms: 0 };
        w.plate.setVisible(true);
      }
      const t = w.task;
      if (t?.stage === 'carry') {
        if (this.walk(w, this.world(this.layout.tables[t.table].serve), delta)) {
          const table = this.tables[t.table];
          if (table.state === 'ready' && table.guest) {
            table.state = 'served';
            table.guest.foodServed();
          }
          t.stage = 'back';
          w.plate.setVisible(false);
        }
      } else if (this.walk(w, pass, delta)) {
        w.task = null;
      }
      this.draw(w, time, !!t);
    }
  }

  /** Match the figures to the workers on duty. */
  private sync(list: Figure[], role: Role, n: number): void {
    const start = role === 'cook' ? this.world(this.layout.stoves[list.length % this.layout.stoves.length]) : this.world(this.layout.pass);
    while (list.length < n) {
      const img = this.scene.add.image(start.x, start.y, TEX.worker(role)).setOrigin(0.5, 1).setScale(0.9).setDepth(start.y);
      const plate = this.scene.add.image(start.x, start.y, TEX.plate).setVisible(false);
      list.push({ img, plate, x: start.x, y: start.y, task: null });
    }
    while (list.length > n) {
      const f = list.pop()!;
      // Unfinished work goes back into the queues.
      const t = f.task;
      if (t && t.stage !== 'back') {
        const table = this.tables[t.table];
        if (role === 'cook' && table?.state === 'cooking') {
          table.state = 'ordered';
          this.orders.unshift(t.table);
        } else if (role === 'waiter' && table?.state === 'ready') this.ready.unshift(t.table);
      }
      f.img.destroy();
      f.plate.destroy();
    }
  }

  destroy(): void {
    this.sync(this.cooks, 'cook', 0);
    this.sync(this.waiters, 'waiter', 0);
  }
}
