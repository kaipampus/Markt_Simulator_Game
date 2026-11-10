import { TILE } from '../config';
import type { Role } from '../data/staff';
import type { GameState, PlacedBuilding } from '../state/GameState';
import { restaurantLayout, stepInside, type P3 } from './layout';

/** A guest sitting at a table. */
export interface Diner {
  readonly isDone: boolean;
  /** The waiter put the food on the table. */
  foodServed(): void;
}

type TableState = 'free' | 'seated' | 'ordered' | 'cooking' | 'ready' | 'served';

/** A cook or waiter inside the restaurant (logic only; views draw it). */
export interface StaffFigure {
  readonly role: Role;
  x: number;
  y: number;
  /** Height above the ground (3D units): above 0 on the stairs and the second floor. */
  z: number;
  facingLeft: boolean;
  /** Carrying a dish. */
  plate: boolean;
  /** Cooking or carrying (views animate faster). */
  busy: boolean;
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
 * to the table. The cooks and waiters on duty are listed in `figures` for
 * the views; the worker entities themselves wait hidden at the door.
 */
export class Restaurant {
  private tables: Array<{ guest: Diner | null; state: TableState }>;
  private orders: number[] = [];
  private ready: number[] = [];
  private cooks: StaffFigure[] = [];
  private waiters: StaffFigure[] = [];
  private readonly layout;
  private readonly ox: number;
  private readonly oy: number;

  constructor(
    private state: GameState,
    readonly building: PlacedBuilding,
  ) {
    const def = building.def;
    this.layout = restaurantLayout(def);
    this.ox = building.tx * TILE;
    this.oy = building.ty * TILE;
    this.tables = Array.from({ length: def.restaurant?.tables ?? 0 }, () => ({ guest: null, state: 'free' as TableState }));
    const st = this.layout.stairs;
    this.stairs = st ? { bottom: this.world(st.bottom), top: this.world(st.top) } : null;
  }

  /**
   * Moves a point (world pixels, z in 3D units) towards `to`, using the
   * stairs between the floors. True once it got there.
   */
  stepTowards(p: P3, to: P3, dist: number): boolean {
    return stepInside(p, to, dist, this.stairs);
  }

  /** Cooks and waiters on duty, for drawing. */
  get figures(): readonly StaffFigure[] {
    return [...this.cooks, ...this.waiters];
  }

  private readonly stairs: { bottom: P3; top: P3 } | null;

  private world(p: { x: number; y: number; z?: number }): P3 {
    return { x: this.ox + p.x, y: this.oy + p.y, z: p.z ?? 0 };
  }

  /** Take a free table; returns its number or null. */
  seat(guest: Diner): number | null {
    const i = this.tables.findIndex((t) => t.state === 'free');
    if (i < 0) return null;
    this.tables[i] = { guest, state: 'seated' };
    return i;
  }

  /** Where a guest sits at table i (world position of the feet, z = floor height). */
  seatPos(i: number): P3 {
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
        f.plate = false;
      }
    }
  }

  /** Moves a figure towards a point (up or down the stairs if needed); true when it got there. */
  private walk(f: StaffFigure, to: P3, delta: number): boolean {
    const x0 = f.x;
    const done = this.stepTowards(f, to, (WALK_SPEED * delta) / 1000);
    if (Math.abs(f.x - x0) > 0.01) f.facingLeft = f.x < x0;
    return done;
  }

  /** `delta` is already scaled by the game speed. */
  update(delta: number): void {
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
          c.plate = true;
        }
      } else if (t?.stage === 'carry') {
        if (this.walk(c, drop, delta)) {
          if (this.tables[t.table].state === 'cooking') {
            this.tables[t.table].state = 'ready';
            this.ready.push(t.table);
          }
          t.stage = 'back';
          c.plate = false;
        }
      } else if (this.walk(c, stove, delta)) {
        c.task = null;
      }
      c.busy = !!c.task;
    });

    // Waiters: take ready dishes from the pass to the tables.
    const pass = this.world(this.layout.pass);
    for (const w of this.waiters) {
      if (!w.task && this.ready.length && Math.hypot(w.x - pass.x, w.y - pass.y) < 2) {
        w.task = { table: this.ready.shift()!, stage: 'carry', ms: 0 };
        w.plate = true;
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
          w.plate = false;
        }
      } else if (this.walk(w, pass, delta)) {
        w.task = null;
      }
      w.busy = !!w.task;
    }
  }

  /** Match the figures to the workers on duty. */
  private sync(list: StaffFigure[], role: Role, n: number): void {
    while (list.length < n) {
      const start = role === 'cook' ? this.world(this.layout.stoves[list.length % this.layout.stoves.length]) : this.world(this.layout.pass);
      list.push({ role, x: start.x, y: start.y, z: 0, facingLeft: false, plate: false, busy: false, task: null });
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
    }
  }
}
