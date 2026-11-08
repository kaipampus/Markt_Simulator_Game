import { GRID_H, GRID_W } from '../config';

export interface Cell {
  tx: number;
  ty: number;
}

/** Result of a breadth-first search over the grid from one start cell. */
export interface Field {
  start: Cell;
  /** Steps from start, -1 = unreachable. Indexed by ty * GRID_W + tx. */
  dist: Int32Array;
  /** Previous cell index on the shortest path, -1 = none. */
  parent: Int32Array;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Breadth-first search from `start` over all walkable cells (4 directions).
 * The start cell itself is always used, even if something was built on it.
 */
export function floodFrom(start: Cell, isWalkable: (tx: number, ty: number) => boolean): Field {
  const size = GRID_W * GRID_H;
  const dist = new Int32Array(size).fill(-1);
  const parent = new Int32Array(size).fill(-1);
  const queue = new Int32Array(size);

  const s = start.ty * GRID_W + start.tx;
  dist[s] = 0;
  queue[0] = s;
  let head = 0;
  let tail = 1;

  while (head < tail) {
    const i = queue[head++];
    const x = i % GRID_W;
    const y = (i - x) / GRID_W;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
      const n = ny * GRID_W + nx;
      if (dist[n] !== -1 || !isWalkable(nx, ny)) continue;
      dist[n] = dist[i] + 1;
      parent[n] = i;
      queue[tail++] = n;
    }
  }
  return { start, dist, parent };
}

export function distanceTo(field: Field, cell: Cell): number {
  return field.dist[cell.ty * GRID_W + cell.tx];
}

/** Path from the field's start to `target` (start excluded), or null if unreachable. */
export function pathTo(field: Field, target: Cell): Cell[] | null {
  let i = target.ty * GRID_W + target.tx;
  if (field.dist[i] === -1) return null;
  const path: Cell[] = [];
  while (field.dist[i] > 0) {
    const x = i % GRID_W;
    path.push({ tx: x, ty: (i - x) / GRID_W });
    i = field.parent[i];
  }
  return path.reverse();
}

/** All reachable cells whose distance lies within [min, max]. */
export function cellsInRange(field: Field, min: number, max: number): Cell[] {
  const out: Cell[] = [];
  for (let i = 0; i < field.dist.length; i++) {
    const d = field.dist[i];
    if (d >= min && d <= max) {
      const x = i % GRID_W;
      out.push({ tx: x, ty: (i - x) / GRID_W });
    }
  }
  return out;
}
