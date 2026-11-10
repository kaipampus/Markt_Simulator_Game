/**
 * Building tiers: stalls and hotels can be upgraded twice, restaurants four
 * times (up to a second floor). A placed building keeps its base
 * definition's id; `applyTier` returns the improved definition that the
 * game then uses for that building.
 */
import type { BuildingDef } from './buildings';
import type { Role } from './staff';

/** Highest tier of stalls and hotels. */
export const MAX_TIER = 3;
/** Highest tier of restaurants. */
export const RESTAURANT_MAX_TIER = 5;
/** Level needed for tier 1, 2, 3, ... (index = tier). */
export const TIER_LEVEL = [0, 1, 3, 5, 6, 8] as const;
/** Upgrade cost as a share of the building's base cost (index = new tier). */
export const TIER_COST = [0, 0, 0.8, 1.5, 2.2, 3] as const;
/** Price factor per tier (index = tier). */
export const TIER_PRICE = [1, 1, 1.2, 1.4, 1.55, 1.7] as const;

/** What each restaurant tier adds to the base restaurant (index = tier). */
export const RESTAURANT_TIERS = [
  { tables: 0, upper: 0, waiter: false, cook: false, rows: 0, cookSpeed: 1 },
  { tables: 0, upper: 0, waiter: false, cook: false, rows: 0, cookSpeed: 1 },
  // +2 tables, a second waiter
  { tables: 2, upper: 0, waiter: true, cook: false, rows: 0, cookSpeed: 1 },
  // the room grows by one row: +2 more tables, a second cook
  { tables: 4, upper: 0, waiter: true, cook: true, rows: 1, cookSpeed: 1 },
  // second floor with stairs and 4 tables up there, better stoves
  { tables: 4, upper: 4, waiter: true, cook: true, rows: 1, cookSpeed: 0.85 },
  // 8 tables upstairs, even better stoves
  { tables: 4, upper: 8, waiter: true, cook: true, rows: 1, cookSpeed: 0.7 },
] as const;
/** Upgrades never add a cook or waiter beyond this many per restaurant. */
export const RESTAURANT_STAFF_MAX = 2;

/** Highest tier a building can reach (1 = cannot be upgraded). */
export function maxTier(def: BuildingDef): number {
  if (def.restaurant) return RESTAURANT_MAX_TIER;
  return def.service || def.hotel ? MAX_TIER : 1;
}

export function upgradeCost(base: BuildingDef, toTier: number): number {
  return Math.round(base.cost * (TIER_COST[toTier] ?? 0));
}

/**
 * The definition of a building at a tier:
 * - restaurants: see RESTAURANT_TIERS (more tables, at most 2 cooks and
 *   2 waiters, one more row at tier 3, a second floor from tier 4)
 * - stalls: one more service place per tier
 * - hotels: 1.5× and 2× the beds
 * - everything: higher prices
 */
export function applyTier(base: BuildingDef, tier: number): BuildingDef {
  if (tier <= 1) return base;
  const d: BuildingDef = { ...base, tier };
  if (base.provides) d.provides = { ...base.provides, price: Math.round(base.provides.price * TIER_PRICE[tier]) };
  if (base.restaurant) {
    const t = RESTAURANT_TIERS[tier];
    d.restaurant = {
      ...base.restaurant,
      tables: base.restaurant.tables + t.tables + t.upper,
      upper: t.upper,
      cookMs: Math.round(base.restaurant.cookMs * t.cookSpeed),
    };
    const staff = base.staff ?? [];
    const extra: Role[] = [];
    const has = (role: Role) => staff.filter((r) => r === role).length;
    if (t.waiter && has('waiter') < RESTAURANT_STAFF_MAX) extra.push('waiter');
    if (t.cook && has('cook') < RESTAURANT_STAFF_MAX) extra.push('cook');
    d.staff = [...staff, ...extra];
    d.h = base.h + t.rows;
  } else if (base.service) {
    d.service = { ...base.service, slots: base.service.slots + (tier - 1) };
  }
  if (base.hotel) d.hotel = { ...base.hotel, beds: Math.round(base.hotel.beds * (tier === 2 ? 1.5 : 2)) };
  return d;
}
