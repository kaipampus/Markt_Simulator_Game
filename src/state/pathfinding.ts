import { GRID_H, GRID_W } from '../config';

export interface Cell {
  tx: number;
  ty: number;
}

/**
 * Travel cost of stepping onto a cell: Infinity = blocked,
 * 1 = normal ground, smaller = faster (paths, bridges).
 */
export type CostFn = (tx: number, ty: number) => number;

/** Result of a search over the grid from one start cell. */
export interface Field {
  start: Cell;
  /** Travel cost from start, Infinity = unreachable. Indexed by ty * GRID_W + tx. */
  cost: Float32Array;
  /** Previous cell index on the cheapest path, -1 = none. */
  parent: Int32Array;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Tiny binary min-heap of cell indices, ordered by a cost array. */
class Heap {
  private items: number[] = [];
  constructor(private cost: Float32Array) {}

  get size(): number {
    return this.items.length;
  }

  push(i: number): void {
    const a = this.items;
    a.push(i);
    let n = a.length - 1;
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (this.cost[a[p]] <= this.cost[a[n]]) break;
      [a[p], a[n]] = [a[n], a[p]];
      n = p;
    }
  }

  pop(): number {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let n = 0;
      for (;;) {
        const l = n * 2 + 1;
        const r = l + 1;
        let m = n;
        if (l < a.length && this.cost[a[l]] < this.cost[a[m]]) m = l;
        if (r < a.length && this.cost[a[r]] < this.cost[a[m]]) m = r;
        if (m === n) break;
        [a[m], a[n]] = [a[n], a[m]];
        n = m;
      }
    }
    return top;
  }
}

/**
 * Cheapest-path search (Dijkstra, 4 directions) from `start`.
 * The start cell itself is always usable, even if something was built on it.
 */
export function searchFrom(start: Cell, costOf: CostFn): Field {
  const size = GRID_W * GRID_H;
  const cost = new Float32Array(size).fill(Infinity);
  const parent = new Int32Array(size).fill(-1);
  const done = new Uint8Array(size);
  const heap = new Heap(cost);

  const s = start.ty * GRID_W + start.tx;
  cost[s] = 0;
  heap.push(s);

  while (heap.size > 0) {
    const i = heap.pop();
    if (done[i]) continue;
    done[i] = 1;
    const x = i % GRID_W;
    const y = (i - x) / GRID_W;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
      const step = costOf(nx, ny);
      if (step === Infinity) continue;
      const n = ny * GRID_W + nx;
      const c = cost[i] + step;
      if (c < cost[n]) {
        cost[n] = c;
        parent[n] = i;
        heap.push(n);
      }
    }
  }
  return { start, cost, parent };
}

export function costTo(field: Field, cell: Cell): number {
  return field.cost[cell.ty * GRID_W + cell.tx];
}

/** Path from the field's start to `target` (start excluded), or null if unreachable. */
export function pathTo(field: Field, target: Cell): Cell[] | null {
  let i = target.ty * GRID_W + target.tx;
  if (field.cost[i] === Infinity) return null;
  const s = field.start.ty * GRID_W + field.start.tx;
  const path: Cell[] = [];
  while (i !== s && i !== -1) {
    const x = i % GRID_W;
    path.push({ tx: x, ty: (i - x) / GRID_W });
    i = field.parent[i];
  }
  return path.reverse();
}

/** The cheapest reachable cell among `cells`, or null. */
export function cheapest(field: Field, cells: readonly Cell[]): Cell | null {
  let best: Cell | null = null;
  let bestCost = Infinity;
  for (const c of cells) {
    const k = costTo(field, c);
    if (k < bestCost) {
      bestCost = k;
      best = c;
    }
  }
  return best;
}

/** All reachable cells whose cost lies within [min, max]. */
export function cellsInRange(field: Field, min: number, max: number): Cell[] {
  const out: Cell[] = [];
  for (let i = 0; i < field.cost.length; i++) {
    const d = field.cost[i];
    if (d >= min && d <= max) {
      const x = i % GRID_W;
      out.push({ tx: x, ty: (i - x) / GRID_W });
    }
  }
  return out;
}
