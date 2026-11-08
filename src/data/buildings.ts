/**
 * Building definitions. Gameplay values live here so balancing never needs
 * a code change elsewhere. Display names live in strings.ts.
 */

export type BuildingId =
  | 'path'
  | 'lantern'
  | 'bridge'
  | 'noodle'
  | 'tea'
  | 'charm'
  | 'shrine'
  | 'brazier'
  | 'restroom'
  | 'hotel';

/** What a spirit can want during the night. Sleep is handled by hotels. */
export type Need = 'hunger' | 'thirst' | 'luck' | 'warmth' | 'relief';
export const NEEDS: readonly Need[] = ['hunger', 'thirst', 'luck', 'warmth', 'relief'];

/** Where a building may be placed. 'land' = market or hotel district. */
export type Zone = 'market' | 'hotel' | 'land' | 'river';

/** How the placeholder texture for a building is drawn (see gfx/textures.ts). */
export type BuildingStyle = 'path' | 'bridge' | 'lantern' | 'stall' | 'house' | 'torii' | 'brazier' | 'restroom' | 'hotel';

export interface BuildingDef {
  id: BuildingId;
  cost: number;
  /** Footprint in grid cells. */
  w: number;
  h: number;
  /** How many pixels the building rises above its footprint (3/4 view). */
  rise: number;
  zone: Zone;
  style: BuildingStyle;
  colors: { main: string; roof: string; accent: string };
  /** Spirits can walk on it (paths, bridges); counts as fast terrain. */
  walkable?: boolean;
  /** Can be painted by dragging the mouse. */
  dragPlace?: boolean;
  /** Need this building satisfies, and what a visit pays. */
  provides?: { need: Need; price: number };
  /** Beds in a hotel and what one night costs. */
  hotel?: { beds: number; price: number };
  /** Warm glow drawn on top at night (position relative to the texture). */
  glow?: { x: number; y: number; radius: number };
}

export const BUILDINGS: readonly BuildingDef[] = [
  {
    id: 'path',
    cost: 5,
    w: 1,
    h: 1,
    rise: 0,
    zone: 'land',
    style: 'path',
    colors: { main: '#8d8a83', roof: '#6f6c66', accent: '#a7a39a' },
    walkable: true,
    dragPlace: true,
  },
  {
    id: 'lantern',
    cost: 15,
    w: 1,
    h: 1,
    rise: 44,
    zone: 'land',
    style: 'lantern',
    colors: { main: '#d9452b', roof: '#2a1d1a', accent: '#ffd27a' },
    glow: { x: 0.5, y: 0.32, radius: 90 },
  },
  {
    id: 'bridge',
    cost: 60,
    w: 1,
    h: 2,
    rise: 6,
    zone: 'river',
    style: 'bridge',
    colors: { main: '#8b5a36', roof: '#c8372d', accent: '#d9b98a' },
    walkable: true,
  },
  {
    id: 'noodle',
    cost: 80,
    w: 2,
    h: 1,
    rise: 40,
    zone: 'market',
    style: 'stall',
    colors: { main: '#8b5a36', roof: '#c8372d', accent: '#f4e6c8' },
    provides: { need: 'hunger', price: 12 },
  },
  {
    id: 'tea',
    cost: 150,
    w: 2,
    h: 2,
    rise: 46,
    zone: 'market',
    style: 'house',
    colors: { main: '#8a5a3c', roof: '#2f3f5a', accent: '#ffcf7a' },
    provides: { need: 'thirst', price: 10 },
    glow: { x: 0.5, y: 0.82, radius: 70 },
  },
  {
    id: 'charm',
    cost: 60,
    w: 1,
    h: 1,
    rise: 38,
    zone: 'market',
    style: 'stall',
    colors: { main: '#6e4a33', roof: '#6b4aa0', accent: '#f1e7d0' },
    provides: { need: 'luck', price: 15 },
  },
  {
    id: 'shrine',
    cost: 120,
    w: 1,
    h: 1,
    rise: 40,
    zone: 'market',
    style: 'torii',
    colors: { main: '#c8372d', roof: '#1e1a1a', accent: '#d8d2c4' },
    provides: { need: 'luck', price: 6 },
  },
  {
    id: 'brazier',
    cost: 40,
    w: 1,
    h: 1,
    rise: 26,
    zone: 'land',
    style: 'brazier',
    colors: { main: '#3a3236', roof: '#1e1a1a', accent: '#ff9a3c' },
    provides: { need: 'warmth', price: 4 },
    glow: { x: 0.5, y: 0.35, radius: 80 },
  },
  {
    id: 'restroom',
    cost: 50,
    w: 1,
    h: 1,
    rise: 40,
    zone: 'land',
    style: 'restroom',
    colors: { main: '#7a6650', roof: '#3b4f45', accent: '#e8dcc0' },
    provides: { need: 'relief', price: 3 },
  },
  {
    id: 'hotel',
    cost: 300,
    w: 4,
    h: 3,
    rise: 156,
    zone: 'hotel',
    style: 'hotel',
    colors: { main: '#c9a77a', roof: '#7a2e2a', accent: '#ffd48a' },
    hotel: { beds: 12, price: 8 },
    glow: { x: 0.5, y: 0.9, radius: 130 },
  },
];

export function getBuilding(id: BuildingId): BuildingDef {
  const def = BUILDINGS.find((b) => b.id === id);
  if (!def) throw new Error(`Unknown building: ${id}`);
  return def;
}

/** The market gate: fixed, not buildable, spirits arrive and leave here. */
export const GATE = {
  w: 2,
  h: 1,
  rise: 56,
} as const;
