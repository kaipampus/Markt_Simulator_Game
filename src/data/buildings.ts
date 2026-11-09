/**
 * Building definitions. Gameplay values live here so balancing never needs
 * a code change elsewhere. Display names live in strings.ts.
 */
import type { Era } from './eras';
import type { Role } from './staff';

export type BuildingId =
  // transport
  | 'path'
  | 'bridge'
  | 'bridge_stone'
  | 'ferry_steam'
  | 'bridge_steel'
  | 'ferry_motor'
  // market
  | 'noodle'
  | 'tea'
  | 'charm'
  | 'shrine'
  | 'cafe'
  | 'vending'
  | 'arcade'
  // services
  | 'brazier'
  | 'restroom'
  | 'bin'
  // hotels
  | 'hotel'
  | 'hotel_grand'
  | 'hotel_sky'
  | 'staff_lodge'
  | 'staff_dorm'
  // decor
  | 'lantern'
  | 'gaslamp'
  | 'neon';

/** What a spirit can want during the night. Sleep is handled by hotels. */
export type Need = 'hunger' | 'thirst' | 'luck' | 'warmth' | 'relief';
export const NEEDS: readonly Need[] = ['hunger', 'thirst', 'luck', 'warmth', 'relief'];

/** Where a building may be placed. 'land' = market or hotel district. */
export type Zone = 'market' | 'hotel' | 'land' | 'river';

/** Tabs of the build bar. */
export type Category = 'transport' | 'market' | 'services' | 'hotels' | 'decor';
export const CATEGORIES: readonly Category[] = ['transport', 'market', 'services', 'hotels', 'decor'];

/** How the placeholder texture for a building is drawn (see gfx/textures.ts). */
export type BuildingStyle =
  | 'path'
  | 'bridge'
  | 'ferry'
  | 'lantern'
  | 'gaslamp'
  | 'neon'
  | 'stall'
  | 'house'
  | 'torii'
  | 'brazier'
  | 'restroom'
  | 'vending'
  | 'arcade'
  | 'hotel'
  | 'lodge'
  | 'bin';

/** River crossings: walk across with limited capacity, or ride a shuttling boat. */
export type Crossing =
  | { kind: 'walk'; capacity: number }
  | { kind: 'boat'; capacity: number; tripMs: number; waitMs: number };

export interface BuildingDef {
  id: BuildingId;
  era: Era;
  category: Category;
  cost: number;
  /** Footprint in grid cells. */
  w: number;
  h: number;
  /** How many pixels the building rises above its footprint (3/4 view). */
  rise: number;
  zone: Zone;
  style: BuildingStyle;
  colors: { main: string; roof: string; accent: string };
  /** Spirits can walk on it (paths, bridges, ferry lanes). */
  walkable?: boolean;
  /** Can be painted by dragging the mouse. */
  dragPlace?: boolean;
  crossing?: Crossing;
  /** Need this building satisfies, and what a visit pays. */
  provides?: { need: Need; price: number };
  /** Beds in a hotel and what one night costs. */
  hotel?: { beds: number; price: number };
  /** Needs a worker with this job on duty to be open. */
  staff?: Role;
  /** Beds for workers (staff houses). */
  staffBeds?: number;
  /** Catches litter around it. */
  bin?: boolean;
  /** Warm glow drawn on top at night (position relative to the texture). */
  glow?: { x: number; y: number; radius: number; color?: number };
}

const RIVER_SPAN = 3; // must match RIVER_ROWS in config.ts

export const BUILDINGS: readonly BuildingDef[] = [
  // --- transport ---------------------------------------------------------
  {
    id: 'path',
    era: 0,
    category: 'transport',
    cost: 5,
    w: 1,
    h: 1,
    rise: 0,
    zone: 'land',
    style: 'path',
    colors: { main: '#8a7458', roof: '#6f5d46', accent: '#a08a6a' },
    walkable: true,
    dragPlace: true,
  },
  {
    id: 'bridge',
    era: 0,
    category: 'transport',
    cost: 60,
    w: 1,
    h: RIVER_SPAN,
    rise: 6,
    zone: 'river',
    style: 'bridge',
    colors: { main: '#8b5a36', roof: '#c8372d', accent: '#d9b98a' },
    walkable: true,
    crossing: { kind: 'walk', capacity: 3 },
  },
  {
    id: 'bridge_stone',
    era: 1,
    category: 'transport',
    cost: 180,
    w: 1,
    h: RIVER_SPAN,
    rise: 6,
    zone: 'river',
    style: 'bridge',
    colors: { main: '#7d7a80', roof: '#5a5760', accent: '#a9a5ad' },
    walkable: true,
    crossing: { kind: 'walk', capacity: 6 },
  },
  {
    id: 'ferry_steam',
    era: 1,
    category: 'transport',
    cost: 250,
    w: 1,
    h: RIVER_SPAN,
    rise: 0,
    zone: 'river',
    style: 'ferry',
    colors: { main: '#6b4a32', roof: '#2a2226', accent: '#e0c79a' },
    walkable: true,
    crossing: { kind: 'boat', capacity: 12, tripMs: 5000, waitMs: 2500 },
  },
  {
    id: 'bridge_steel',
    era: 2,
    category: 'transport',
    cost: 400,
    w: 1,
    h: RIVER_SPAN,
    rise: 6,
    zone: 'river',
    style: 'bridge',
    colors: { main: '#3d4652', roof: '#2a9fd6', accent: '#8fa3b5' },
    walkable: true,
    crossing: { kind: 'walk', capacity: 10 },
  },
  {
    id: 'ferry_motor',
    era: 2,
    category: 'transport',
    cost: 500,
    w: 1,
    h: RIVER_SPAN,
    rise: 0,
    zone: 'river',
    style: 'ferry',
    colors: { main: '#e8e4dc', roof: '#c8372d', accent: '#6fd3ff' },
    walkable: true,
    crossing: { kind: 'boat', capacity: 20, tripMs: 3000, waitMs: 2000 },
  },

  // --- market --------------------------------------------------------------
  {
    id: 'noodle',
    era: 0,
    category: 'market',
    cost: 80,
    w: 2,
    h: 1,
    rise: 40,
    zone: 'market',
    style: 'stall',
    colors: { main: '#8b5a36', roof: '#c8372d', accent: '#f4e6c8' },
    provides: { need: 'hunger', price: 12 },
    staff: 'cook',
  },
  {
    id: 'tea',
    era: 0,
    category: 'market',
    cost: 150,
    w: 2,
    h: 2,
    rise: 46,
    zone: 'market',
    style: 'house',
    colors: { main: '#8a5a3c', roof: '#2f3f5a', accent: '#ffcf7a' },
    provides: { need: 'thirst', price: 10 },
    glow: { x: 0.5, y: 0.82, radius: 70 },
    staff: 'cook',
  },
  {
    id: 'charm',
    era: 0,
    category: 'market',
    cost: 60,
    w: 1,
    h: 1,
    rise: 38,
    zone: 'market',
    style: 'stall',
    colors: { main: '#6e4a33', roof: '#6b4aa0', accent: '#f1e7d0' },
    provides: { need: 'luck', price: 15 },
    staff: 'clerk',
  },
  {
    id: 'shrine',
    era: 0,
    category: 'market',
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
    id: 'cafe',
    era: 1,
    category: 'market',
    cost: 220,
    w: 2,
    h: 2,
    rise: 50,
    zone: 'market',
    style: 'house',
    colors: { main: '#6d4c3d', roof: '#3d5a46', accent: '#ffd9a0' },
    provides: { need: 'thirst', price: 16 },
    glow: { x: 0.5, y: 0.82, radius: 80 },
    staff: 'cook',
  },
  {
    id: 'vending',
    era: 2,
    category: 'market',
    cost: 90,
    w: 1,
    h: 1,
    rise: 30,
    zone: 'market',
    style: 'vending',
    colors: { main: '#d93a3a', roof: '#2a2a33', accent: '#bff6ff' },
    provides: { need: 'thirst', price: 6 },
    glow: { x: 0.5, y: 0.5, radius: 50, color: 0x9fe8ff },
  },
  {
    id: 'arcade',
    era: 2,
    category: 'market',
    cost: 450,
    w: 2,
    h: 2,
    rise: 56,
    zone: 'market',
    style: 'arcade',
    colors: { main: '#2b2440', roof: '#ff4fa3', accent: '#5ff2ff' },
    provides: { need: 'luck', price: 22 },
    glow: { x: 0.5, y: 0.4, radius: 110, color: 0xff6fc0 },
    staff: 'clerk',
  },

  // --- services ------------------------------------------------------------
  {
    id: 'brazier',
    era: 0,
    category: 'services',
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
    era: 0,
    category: 'services',
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
    id: 'bin',
    era: 0,
    category: 'services',
    cost: 20,
    w: 1,
    h: 1,
    rise: 14,
    zone: 'land',
    style: 'bin',
    colors: { main: '#5a6b4a', roof: '#3a4632', accent: '#c9c2a8' },
    bin: true,
  },

  // --- hotels --------------------------------------------------------------
  {
    id: 'hotel',
    era: 0,
    category: 'hotels',
    cost: 300,
    w: 4,
    h: 3,
    rise: 120,
    zone: 'hotel',
    style: 'hotel',
    colors: { main: '#c9a77a', roof: '#7a2e2a', accent: '#ffd48a' },
    hotel: { beds: 12, price: 8 },
    glow: { x: 0.5, y: 0.88, radius: 110 },
    staff: 'host',
  },
  {
    id: 'hotel_grand',
    era: 1,
    category: 'hotels',
    cost: 900,
    w: 5,
    h: 3,
    rise: 170,
    zone: 'hotel',
    style: 'hotel',
    colors: { main: '#a8553e', roof: '#3b3b46', accent: '#ffe0a0' },
    hotel: { beds: 24, price: 10 },
    glow: { x: 0.5, y: 0.9, radius: 140 },
    staff: 'host',
  },
  {
    id: 'hotel_sky',
    era: 2,
    category: 'hotels',
    cost: 2400,
    w: 5,
    h: 4,
    rise: 240,
    zone: 'hotel',
    style: 'hotel',
    colors: { main: '#3a4a66', roof: '#22283a', accent: '#bfe8ff' },
    hotel: { beds: 40, price: 12 },
    glow: { x: 0.5, y: 0.3, radius: 170, color: 0xff6fc0 },
    staff: 'host',
  },
  {
    id: 'staff_lodge',
    era: 0,
    category: 'hotels',
    cost: 120,
    w: 2,
    h: 2,
    rise: 50,
    zone: 'market',
    style: 'lodge',
    colors: { main: '#7a5a40', roof: '#4a3a5a', accent: '#ffd48a' },
    staffBeds: 6,
    glow: { x: 0.5, y: 0.85, radius: 60 },
  },
  {
    id: 'staff_dorm',
    era: 1,
    category: 'hotels',
    cost: 320,
    w: 3,
    h: 2,
    rise: 80,
    zone: 'market',
    style: 'lodge',
    colors: { main: '#8a4a3a', roof: '#3b3b46', accent: '#ffe0a0' },
    staffBeds: 14,
    glow: { x: 0.5, y: 0.85, radius: 80 },
  },

  // --- decor ---------------------------------------------------------------
  {
    id: 'lantern',
    era: 0,
    category: 'decor',
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
    id: 'gaslamp',
    era: 1,
    category: 'decor',
    cost: 30,
    w: 1,
    h: 1,
    rise: 56,
    zone: 'land',
    style: 'gaslamp',
    colors: { main: '#2a2d33', roof: '#1a1c20', accent: '#fff1c4' },
    glow: { x: 0.5, y: 0.2, radius: 110, color: 0xfff0c0 },
  },
  {
    id: 'neon',
    era: 2,
    category: 'decor',
    cost: 60,
    w: 1,
    h: 1,
    rise: 58,
    zone: 'land',
    style: 'neon',
    colors: { main: '#ff4fa3', roof: '#22222a', accent: '#5ff2ff' },
    glow: { x: 0.5, y: 0.3, radius: 100, color: 0xff6fc0 },
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
