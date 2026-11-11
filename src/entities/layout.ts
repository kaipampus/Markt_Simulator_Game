/** Positions inside buildings, shared by game logic and graphics. */
import { TILE } from '../config';
import type { BuildingDef } from '../data/buildings';

type Pt = { x: number; y: number };
/** A point inside a building: x, y in world pixels, z = height above the ground in 3D units. */
export type P3 = { x: number; y: number; z: number };

/** Height of a restaurant's second floor (3D units). */
export const DECK_HEIGHT = 1.62;
/** The second floor covers the back of the room up to this share of its depth (over the kitchen). */
export const DECK_DEPTH = 0.5;

export interface RestaurantLayout {
  stoves: Pt[];
  /** Where cooks put finished dishes (kitchen side of the pass). */
  drop: Pt;
  /** Where waiters pick them up (dining side of the pass). */
  pass: Pt;
  /** Tables: where the table stands, where the guest sits, where the waiter serves. */
  tables: Array<{ table: P3; seat: P3; serve: P3; upper: boolean }>;
  /** Second floor: the stairs run along its front edge, from the bottom (left) up to the top. */
  stairs: { bottom: P3; top: P3 } | null;
}

/**
 * Where things are inside a restaurant, relative to the top-left corner of
 * its footprint: stoves (cooks), the pass (waiters pick up dishes), tables
 * with a seat (guest) and a serve spot (waiter). From tier 4 a second floor
 * covers the kitchen, with stairs in front of it and more tables on top.
 */
export function restaurantLayout(def: BuildingDef): RestaurantLayout {
  const W = def.w * TILE;
  const H = def.h * TILE;
  const cooks = Math.max(1, def.staff?.filter((r) => r === 'cook').length ?? 1);
  // Kitchen in the back part: stoves along the back wall, the pass counter in front of it.
  const stoves = Array.from({ length: cooks }, (_, i) => ({ x: W * (cooks === 1 ? 0.3 : 0.2 + (0.3 * i) / (cooks - 1)), y: H * 0.2 }));
  const n = def.restaurant?.tables ?? 0;
  const upperN = Math.min(n, def.restaurant?.upper ?? 0);
  const lowerN = n - upperN;

  const tables: RestaurantLayout['tables'] = [];
  const grid = (count: number, rowsY: number[], z: number) => {
    const cols = Math.max(1, Math.ceil(count / rowsY.length));
    for (let i = 0; i < count; i++) {
      const table = { x: (W * ((i % cols) + 0.5)) / cols + 6, y: rowsY[Math.floor(i / cols)], z };
      tables.push({ table, seat: { x: table.x - 17, y: table.y + 5, z }, serve: { x: table.x + 17, y: table.y + 4, z }, upper: z > 0 });
    }
  };
  if (upperN === 0) {
    // Deeper rooms (5 rows) get a third row of tables.
    const rows = def.h >= 5 && lowerN > 6 ? 3 : 2;
    grid(lowerN, Array.from({ length: rows }, (_, r) => H * (0.58 + (r * 0.3) / (rows - 1))), 0);
    return { stoves, drop: { x: W * 0.68, y: H * 0.3 }, pass: { x: W * 0.68, y: H * 0.47 }, tables, stairs: null };
  }
  // With a second floor the stairs take the strip in front of it, so the tables downstairs move forward.
  grid(lowerN, [H * 0.7, H * 0.9], 0);
  grid(upperN, upperN > def.w ? [H * 0.17, H * 0.38] : [H * 0.3], DECK_HEIGHT);
  const stairs = { bottom: { x: W * 0.12, y: H * 0.55, z: 0 }, top: { x: W * 0.5, y: H * 0.55, z: DECK_HEIGHT } };
  return { stoves, drop: { x: W * 0.68, y: H * 0.3 }, pass: { x: W * 0.68, y: H * 0.47 }, tables, stairs };
}

/**
 * Moves `p` up to `dist` pixels towards `to` inside a restaurant, taking the
 * stairs when `to` is on the other floor. `stairs` are in the same
 * coordinates as `p`. Returns true once `p` is at `to`.
 */
export function stepInside(p: P3, to: P3, dist: number, stairs: { bottom: P3; top: P3 } | null): boolean {
  let left = dist;
  for (let guard = 0; guard < 4; guard++) {
    const wp = nextWaypoint(p, to, stairs);
    const dx = wp.x - p.x;
    const dy = wp.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > left) {
      const k = left / d;
      p.x += dx * k;
      p.y += dy * k;
      p.z += (wp.z - p.z) * k;
      return false;
    }
    p.x = wp.x;
    p.y = wp.y;
    p.z = wp.z;
    left -= d;
    if (wp === to) return true;
  }
  return false;
}

const EPS = 1e-3;

/** Where to walk next: straight to `to` on the same floor, otherwise via the stairs. */
function nextWaypoint(p: P3, to: P3, stairs: { bottom: P3; top: P3 } | null): P3 {
  if (!stairs) return to;
  const pDown = p.z < EPS;
  const pUp = p.z > DECK_HEIGHT - EPS;
  const toUp = to.z > DECK_HEIGHT - EPS;
  if ((pDown && !toUp) || (pUp && toUp)) return to;
  const at = (q: P3) => Math.hypot(q.x - p.x, q.y - p.y) < 0.01;
  if (toUp) return pDown && !at(stairs.bottom) ? stairs.bottom : stairs.top;
  return pUp && !at(stairs.top) ? stairs.top : stairs.bottom;
}
