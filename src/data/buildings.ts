/**
 * Building definitions. Gameplay values live here so balancing never needs
 * a code change elsewhere. Display names live in strings.ts.
 */

export type BuildingId = 'lantern' | 'noodle' | 'charm' | 'tea' | 'shrine' | 'bathhouse';

/** How the placeholder texture for a building is drawn (see gfx/textures.ts). */
export type BuildingStyle = 'lantern' | 'stall' | 'house' | 'torii' | 'bathhouse';

export interface BuildingDef {
  id: BuildingId;
  cost: number;
  /** Footprint in grid cells. */
  w: number;
  h: number;
  /** How many pixels the building rises above its footprint (3/4 view). */
  rise: number;
  style: BuildingStyle;
  colors: {
    main: string;
    roof: string;
    accent: string;
  };
  /** Whether a warm glow is drawn on top (lanterns, lit doors). */
  glow?: { x: number; y: number; radius: number };
}

export const BUILDINGS: readonly BuildingDef[] = [
  {
    id: 'lantern',
    cost: 15,
    w: 1,
    h: 1,
    rise: 44,
    style: 'lantern',
    colors: { main: '#d9452b', roof: '#2a1d1a', accent: '#ffd27a' },
    glow: { x: 0.5, y: 0.32, radius: 90 },
  },
  {
    id: 'noodle',
    cost: 80,
    w: 2,
    h: 1,
    rise: 40,
    style: 'stall',
    colors: { main: '#8b5a36', roof: '#c8372d', accent: '#f4e6c8' },
  },
  {
    id: 'charm',
    cost: 60,
    w: 1,
    h: 1,
    rise: 38,
    style: 'stall',
    colors: { main: '#6e4a33', roof: '#6b4aa0', accent: '#f1e7d0' },
  },
  {
    id: 'tea',
    cost: 150,
    w: 2,
    h: 2,
    rise: 46,
    style: 'house',
    colors: { main: '#8a5a3c', roof: '#2f3f5a', accent: '#ffcf7a' },
    glow: { x: 0.5, y: 0.82, radius: 70 },
  },
  {
    id: 'shrine',
    cost: 120,
    w: 1,
    h: 1,
    rise: 40,
    style: 'torii',
    colors: { main: '#c8372d', roof: '#1e1a1a', accent: '#d8d2c4' },
  },
  {
    id: 'bathhouse',
    cost: 400,
    w: 3,
    h: 3,
    rise: 96,
    style: 'bathhouse',
    colors: { main: '#c9b28a', roof: '#3f6b5e', accent: '#ffcf7a' },
    glow: { x: 0.5, y: 0.86, radius: 110 },
  },
];

export function getBuilding(id: BuildingId): BuildingDef {
  const def = BUILDINGS.find((b) => b.id === id);
  if (!def) throw new Error(`Unknown building: ${id}`);
  return def;
}

/** The market gate: fixed, not buildable, spirits arrive here. */
export const GATE = {
  w: 2,
  h: 1,
  rise: 56,
} as const;
