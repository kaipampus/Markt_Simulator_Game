/**
 * Building definitions. Gameplay values live here so balancing never needs
 * a code change elsewhere. Display names live in strings.ts.
 */
import type { Role } from './staff';

export type BuildingId =
  // food (restaurants and food stalls)
  | RestaurantId
  | FoodStallId
  // fun and luck stalls
  | FunStallId
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

export type RestaurantId = 'r_ramen' | 'r_pho' | 'r_dimsum' | 'r_curry' | 'r_bbq' | 'r_sushi' | 'r_hotpot';
export type FoodStallId = 'skewers' | 'mochi' | 'dreamfloss' | 'bubbletea';
export type FunStallId = 'goldfish' | 'masks' | 'ringtoss' | 'fortune';

/** What a spirit can want during the night. Sleep is handled by hotels. */
export type Need = 'hunger' | 'thirst' | 'luck' | 'warmth' | 'relief' | 'fun';
export const NEEDS: readonly Need[] = ['hunger', 'thirst', 'luck', 'warmth', 'relief', 'fun'];

/** Kitchens of the restaurants. Guests sometimes crave one of them. */
export type Cuisine = 'japanese' | 'vietnamese' | 'chinese' | 'thai' | 'korean' | 'magic';

/** Where a building may be placed. 'land' = market or hotel district. */
export type Zone = 'market' | 'hotel' | 'land' | 'river';

/** Tabs of the build bar. */
export type Category = 'transport' | 'food' | 'market' | 'services' | 'hotels' | 'decor';
export const CATEGORIES: readonly Category[] = ['transport', 'food', 'market', 'services', 'hotels', 'decor'];

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
  | 'bin'
  | 'restaurant';

/** River crossings: walk across with limited capacity, or ride a shuttling boat. */
export type Crossing =
  | { kind: 'walk'; capacity: number }
  | { kind: 'boat'; capacity: number; tripMs: number; waitMs: number };

export interface BuildingDef {
  id: BuildingId;
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
  /** How many guests are served at once and how long one visit takes (ms). Others queue. */
  service?: { slots: number; ms: number };
  /** Beds in a hotel and what one night costs. */
  hotel?: { beds: number; price: number };
  /**
   * Jobs needed here, one entry per place. The building is open while at least
   * one worker of every listed job is on duty; extra places make it faster.
   */
  staff?: Role[];
  /**
   * Restaurant: guests sit at tables, the cook cooks, the waiter serves.
   * `upper` of the tables are on a second floor (from tier 4).
   */
  restaurant?: { tables: number; cookMs: number; eatMs: number; upper?: number };
  cuisine?: Cuisine;
  /** How many guests this building draws per night (default: from tables or service places, see GameState.popularityOf). */
  popularity?: number;
  /** Emoji painted on the sign of the placeholder graphic. */
  sign?: string;
  /** Set on upgraded copies of a definition (see data/upgrades.ts). */
  tier?: number;
  /** Beds for workers (staff houses). */
  staffBeds?: number;
  /** Catches litter around it. */
  bin?: boolean;
  /** Warm glow drawn on top at night (position relative to the texture). */
  glow?: { x: number; y: number; radius: number; color?: number };
}

const RIVER_SPAN = 3; // must match RIVER_ROWS in config.ts

/** A restaurant: open room with a kitchen at the back and tables in front. */
function restaurant(
  id: RestaurantId,
  cuisine: Cuisine,
  o: { cost: number; price: number; w: number; h: number; tables: number; cooks: number; waiters: number; popularity: number; sign: string; colors: BuildingDef['colors'] },
): BuildingDef {
  return {
    id,
    category: 'food',
    cost: o.cost,
    w: o.w,
    h: o.h,
    rise: 50,
    zone: 'market',
    style: 'restaurant',
    colors: o.colors,
    provides: { need: 'hunger', price: o.price },
    staff: [...Array<Role>(o.cooks).fill('cook'), ...Array<Role>(o.waiters).fill('waiter')],
    restaurant: { tables: o.tables, cookMs: 3500, eatMs: 15_000 },
    cuisine,
    sign: o.sign,
    glow: { x: 0.5, y: 0.3, radius: 60 + o.w * 14 },
  };
}

/** A small stall run by one worker (or none). */
function stall(
  id: FoodStallId | FunStallId,
  category: Category,
  o: { cost: number; need: Need; price: number; w?: number; staff?: Role; slots: number; ms: number; popularity: number; sign: string; colors: BuildingDef['colors'] },
): BuildingDef {
  return {
    id,
    category,
    cost: o.cost,
    w: o.w ?? 1,
    h: 1,
    rise: 40,
    zone: 'market',
    style: 'stall',
    colors: o.colors,
    provides: { need: o.need, price: o.price },
    service: { slots: o.slots, ms: o.ms },
    staff: o.staff ? [o.staff] : undefined,
    sign: o.sign,
  };
}

const RESTAURANTS: readonly BuildingDef[] = [
  restaurant('r_ramen', 'japanese', { cost: 260, price: 14, w: 4, h: 4, tables: 4, cooks: 1, waiters: 1, popularity: 10, sign: '🍜', colors: { main: '#8a5a3c', roof: '#c8372d', accent: '#f4e6c8' } }),
  restaurant('r_pho', 'vietnamese', { cost: 300, price: 15, w: 4, h: 4, tables: 4, cooks: 1, waiters: 1, popularity: 10, sign: '🍲', colors: { main: '#6e7a4a', roof: '#3d6b4a', accent: '#f3e9c8' } }),
  restaurant('r_dimsum', 'chinese', { cost: 340, price: 16, w: 4, h: 4, tables: 4, cooks: 1, waiters: 1, popularity: 11, sign: '🥟', colors: { main: '#9a3a2a', roof: '#d9a42b', accent: '#ffe6b0' } }),
  restaurant('r_curry', 'thai', { cost: 380, price: 17, w: 4, h: 4, tables: 4, cooks: 1, waiters: 1, popularity: 12, sign: '🍛', colors: { main: '#a8743a', roof: '#6b2a5a', accent: '#ffd98a' } }),
  restaurant('r_bbq', 'korean', { cost: 750, price: 22, w: 5, h: 5, tables: 6, cooks: 2, waiters: 2, popularity: 18, sign: '🔥', colors: { main: '#5a4a44', roof: '#2a2a33', accent: '#ffb070' } }),
  restaurant('r_sushi', 'japanese', { cost: 850, price: 24, w: 5, h: 5, tables: 6, cooks: 2, waiters: 2, popularity: 20, sign: '🍣', colors: { main: '#c9a77a', roof: '#2f3f5a', accent: '#f4f0e6' } }),
  restaurant('r_hotpot', 'magic', { cost: 1000, price: 26, w: 5, h: 5, tables: 6, cooks: 2, waiters: 2, popularity: 22, sign: '🫕', colors: { main: '#4a3a6a', roof: '#7a2e5a', accent: '#c8f0ff' } }),
];

const NEW_STALLS: readonly BuildingDef[] = [
  stall('skewers', 'food', { cost: 70, need: 'hunger', price: 5, staff: 'cook', slots: 2, ms: 1800, popularity: 3, sign: '🍢', colors: { main: '#6a4a33', roof: '#d9452b', accent: '#ffd27a' } }),
  stall('mochi', 'food', { cost: 80, need: 'hunger', price: 5, staff: 'cook', slots: 1, ms: 1600, popularity: 3, sign: '🍡', colors: { main: '#7a5a4a', roof: '#f29ab8', accent: '#fff4f8' } }),
  stall('dreamfloss', 'food', { cost: 90, need: 'hunger', price: 6, staff: 'clerk', slots: 2, ms: 1400, popularity: 4, sign: '🍭', colors: { main: '#5a4a7a', roof: '#b89aff', accent: '#ffe0f4' } }),
  stall('bubbletea', 'food', { cost: 110, need: 'thirst', price: 6, w: 2, staff: 'cook', slots: 2, ms: 1800, popularity: 4, sign: '🧋', colors: { main: '#6a5040', roof: '#3fb8a8', accent: '#f4e6c8' } }),
  stall('goldfish', 'market', { cost: 90, need: 'fun', price: 5, w: 2, staff: 'clerk', slots: 3, ms: 3500, popularity: 4, sign: '🎏', colors: { main: '#3a5a7a', roof: '#d9452b', accent: '#f4f8ff' } }),
  stall('masks', 'market', { cost: 100, need: 'fun', price: 7, staff: 'clerk', slots: 2, ms: 2200, popularity: 4, sign: '👺', colors: { main: '#5a3a33', roof: '#2a2a33', accent: '#ff6b5a' } }),
  stall('ringtoss', 'market', { cost: 120, need: 'fun', price: 6, w: 2, staff: 'clerk', slots: 3, ms: 3000, popularity: 5, sign: '🎯', colors: { main: '#4a3a2a', roof: '#f2b45a', accent: '#c8372d' } }),
  stall('fortune', 'market', { cost: 110, need: 'luck', price: 8, staff: 'clerk', slots: 1, ms: 2400, popularity: 4, sign: '🔮', colors: { main: '#2a2440', roof: '#6b4aa0', accent: '#e8d0ff' } }),
];

export const BUILDINGS: readonly BuildingDef[] = [
  ...RESTAURANTS,
  ...NEW_STALLS,
  // --- transport ---------------------------------------------------------
  {
    id: 'path',
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
    category: 'food',
    cost: 80,
    w: 2,
    h: 1,
    rise: 40,
    zone: 'market',
    style: 'stall',
    colors: { main: '#8b5a36', roof: '#c8372d', accent: '#f4e6c8' },
    provides: { need: 'hunger', price: 7 },
    service: { slots: 1, ms: 2200 },
    staff: ['cook'],
  },
  {
    id: 'tea',
    category: 'food',
    cost: 150,
    w: 2,
    h: 2,
    rise: 46,
    zone: 'market',
    style: 'house',
    colors: { main: '#8a5a3c', roof: '#2f3f5a', accent: '#ffcf7a' },
    provides: { need: 'thirst', price: 6 },
    service: { slots: 2, ms: 2800 },
    glow: { x: 0.5, y: 0.82, radius: 70 },
    staff: ['cook'],
  },
  {
    id: 'charm',
    category: 'market',
    cost: 60,
    w: 1,
    h: 1,
    rise: 38,
    zone: 'market',
    style: 'stall',
    colors: { main: '#6e4a33', roof: '#6b4aa0', accent: '#f1e7d0' },
    provides: { need: 'luck', price: 8 },
    service: { slots: 1, ms: 1800 },
    staff: ['clerk'],
  },
  {
    id: 'shrine',
    category: 'market',
    cost: 120,
    w: 1,
    h: 1,
    rise: 40,
    zone: 'market',
    style: 'torii',
    colors: { main: '#c8372d', roof: '#1e1a1a', accent: '#d8d2c4' },
    provides: { need: 'luck', price: 3 },
    service: { slots: 2, ms: 1600 },
  },
  {
    id: 'cafe',
    category: 'food',
    cost: 220,
    w: 2,
    h: 2,
    rise: 50,
    zone: 'market',
    style: 'house',
    colors: { main: '#6d4c3d', roof: '#3d5a46', accent: '#ffd9a0' },
    provides: { need: 'thirst', price: 9 },
    service: { slots: 3, ms: 2600 },
    glow: { x: 0.5, y: 0.82, radius: 80 },
    staff: ['cook'],
  },
  {
    id: 'vending',
    category: 'food',
    cost: 90,
    w: 1,
    h: 1,
    rise: 30,
    zone: 'market',
    style: 'vending',
    colors: { main: '#d93a3a', roof: '#2a2a33', accent: '#bff6ff' },
    provides: { need: 'thirst', price: 3 },
    service: { slots: 1, ms: 1000 },
    glow: { x: 0.5, y: 0.5, radius: 50, color: 0x9fe8ff },
  },
  {
    id: 'arcade',
    category: 'market',
    cost: 450,
    w: 2,
    h: 2,
    rise: 56,
    zone: 'market',
    style: 'arcade',
    colors: { main: '#2b2440', roof: '#ff4fa3', accent: '#5ff2ff' },
    provides: { need: 'luck', price: 12 },
    service: { slots: 4, ms: 4000 },
    glow: { x: 0.5, y: 0.4, radius: 110, color: 0xff6fc0 },
    staff: ['clerk'],
  },

  // --- services ------------------------------------------------------------
  {
    id: 'brazier',
    category: 'services',
    cost: 40,
    w: 1,
    h: 1,
    rise: 26,
    zone: 'land',
    style: 'brazier',
    colors: { main: '#3a3236', roof: '#1e1a1a', accent: '#ff9a3c' },
    provides: { need: 'warmth', price: 2 },
    service: { slots: 3, ms: 2500 },
    glow: { x: 0.5, y: 0.35, radius: 80 },
  },
  {
    id: 'restroom',
    category: 'services',
    cost: 50,
    w: 1,
    h: 1,
    rise: 40,
    zone: 'land',
    style: 'restroom',
    colors: { main: '#7a6650', roof: '#3b4f45', accent: '#e8dcc0' },
    provides: { need: 'relief', price: 2 },
    service: { slots: 1, ms: 1800 },
  },
  {
    id: 'bin',
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
    category: 'hotels',
    cost: 600,
    w: 4,
    h: 3,
    rise: 120,
    zone: 'hotel',
    style: 'hotel',
    colors: { main: '#c9a77a', roof: '#7a2e2a', accent: '#ffd48a' },
    hotel: { beds: 12, price: 5 },
    glow: { x: 0.5, y: 0.88, radius: 110 },
    staff: ['host'],
  },
  {
    id: 'hotel_grand',
    category: 'hotels',
    cost: 1800,
    w: 5,
    h: 3,
    rise: 170,
    zone: 'hotel',
    style: 'hotel',
    colors: { main: '#a8553e', roof: '#3b3b46', accent: '#ffe0a0' },
    hotel: { beds: 24, price: 6 },
    glow: { x: 0.5, y: 0.9, radius: 140 },
    staff: ['host'],
  },
  {
    id: 'hotel_sky',
    category: 'hotels',
    cost: 5000,
    w: 5,
    h: 4,
    rise: 240,
    zone: 'hotel',
    style: 'hotel',
    colors: { main: '#3a4a66', roof: '#22283a', accent: '#bfe8ff' },
    hotel: { beds: 40, price: 7 },
    glow: { x: 0.5, y: 0.3, radius: 170, color: 0xff6fc0 },
    staff: ['host'],
  },
  {
    id: 'staff_lodge',
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
