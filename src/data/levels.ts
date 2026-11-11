/**
 * Level, experience and what each level unlocks. Display texts live in strings.ts.
 */
import type { BuildingId } from './buildings';

/** Experience needed to reach level 1, 2, 3, ... (index = level - 1). */
export const LEVEL_XP = [0, 60, 160, 320, 540, 840, 1250, 1800, 2500, 3400, 4600, 6200] as const;

/** Experience per night: per coin earned by guests, and per happy guest. */
export const XP_PER_COIN = 0.3;
export const XP_PER_HAPPY = 2;

/** Level at which a building can be bought (default 1). */
export const UNLOCK_LEVEL: Partial<Record<BuildingId, number>> = {
  // level 2
  tea: 2,
  skewers: 2,
  shrine: 2,
  goldfish: 2,
  // level 3
  r_pho: 3,
  mochi: 3,
  masks: 3,
  // level 4
  r_dimsum: 4,
  bubbletea: 4,
  ringtoss: 4,
  // level 5
  r_curry: 5,
  fortune: 5,
  dreamfloss: 5,
  // level 6: the hotel district can be opened
  bridge: 6,
  hotel: 6,
  cafe: 6,
  gaslamp: 6,
  // level 7
  r_bbq: 7,
  bridge_stone: 7,
  staff_dorm: 7,
  // level 8
  r_sushi: 8,
  ferry_steam: 8,
  hotel_grand: 8,
  // level 10 (later the neon district)
  r_hotpot: 10,
  arcade: 10,
  vending: 10,
  neon: 10,
  bridge_steel: 10,
  ferry_motor: 10,
  hotel_sky: 10,
};

/** Areas beyond the starting market. The hotel district includes the river. */
export type AreaId = 'hotel';

export const AREAS: Record<AreaId, { level: number; cost: number; guestCap: number }> = {
  hotel: { level: 6, cost: 4000, guestCap: 400 },
};

/** Most guests per night while only the market is open. */
export const MARKET_GUEST_CAP = 100;
