/** Positions inside buildings, shared by game logic and graphics. */
import { TILE } from '../config';
import type { BuildingDef } from '../data/buildings';

type Pt = { x: number; y: number };

/**
 * Where things are inside a restaurant, relative to the top-left corner of
 * its footprint: stoves (cooks), the pass (waiters pick up dishes), tables
 * with a seat (guest) and a serve spot (waiter). Shared by graphics and logic.
 */
export function restaurantLayout(def: BuildingDef): {
  stoves: Pt[];
  /** Where cooks put finished dishes (kitchen side of the pass). */
  drop: Pt;
  /** Where waiters pick them up (dining side of the pass). */
  pass: Pt;
  tables: Array<{ table: Pt; seat: Pt; serve: Pt }>;
} {
  const W = def.w * TILE;
  const H = def.h * TILE;
  const cooks = Math.max(1, def.staff?.filter((r) => r === 'cook').length ?? 1);
  // Kitchen in the back part: stoves along the back wall, the pass counter in front of it.
  const stoves = Array.from({ length: cooks }, (_, i) => ({ x: W * (cooks === 1 ? 0.3 : 0.2 + (0.3 * i) / (cooks - 1)), y: H * 0.2 }));
  const n = def.restaurant?.tables ?? 0;
  // Deeper rooms (5 rows) get a third row of tables.
  const rows = def.h >= 5 && n > 6 ? 3 : 2;
  const cols = Math.max(1, Math.ceil(n / rows));
  const tables = Array.from({ length: n }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const table = { x: (W * (col + 0.5)) / cols + 6, y: H * (0.58 + (row * 0.3) / (rows - 1)) };
    return { table, seat: { x: table.x - 17, y: table.y + 5 }, serve: { x: table.x + 17, y: table.y + 4 } };
  });
  return { stoves, drop: { x: W * 0.68, y: H * 0.3 }, pass: { x: W * 0.68, y: H * 0.47 }, tables };
}

