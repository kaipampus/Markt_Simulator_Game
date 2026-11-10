/**
 * Building tiers: restaurants, stalls and hotels can be upgraded twice.
 * A placed building keeps its base definition's id; `applyTier` returns the
 * improved definition that the game then uses for that building.
 */
import type { BuildingDef } from './buildings';
import type { Role } from './staff';

export const MAX_TIER = 3;
/** Level needed for tier 1, 2, 3 (index = tier). */
export const TIER_LEVEL = [0, 1, 3, 5] as const;
/** Upgrade cost as a share of the building's base cost (index = new tier). */
export const TIER_COST = [0, 0, 0.8, 1.5] as const;
/** Price factor per tier (index = tier). */
export const TIER_PRICE = [1, 1, 1.2, 1.4] as const;
/** Extra tables per upgrade step for restaurants. */
export const TIER_TABLES = 2;

/** Highest tier a building can reach (1 = cannot be upgraded). */
export function maxTier(def: BuildingDef): number {
  return def.restaurant || def.service || def.hotel ? MAX_TIER : 1;
}

export function upgradeCost(base: BuildingDef, toTier: number): number {
  return Math.round(base.cost * (TIER_COST[toTier] ?? 0));
}

/**
 * The definition of a building at a tier:
 * - restaurants: +2 tables and a waiter place at tier 2; at tier 3 the room
 *   grows by one row, +2 tables and a cook place
 * - stalls: one more service place per tier
 * - hotels: 1.5× and 2× the beds
 * - everything: higher prices
 */
export function applyTier(base: BuildingDef, tier: number): BuildingDef {
  if (tier <= 1) return base;
  const d: BuildingDef = { ...base, tier };
  if (base.provides) d.provides = { ...base.provides, price: Math.round(base.provides.price * TIER_PRICE[tier]) };
  if (base.restaurant) {
    d.restaurant = { ...base.restaurant, tables: base.restaurant.tables + TIER_TABLES * (tier - 1) };
    const extra: Role[] = tier >= 3 ? ['waiter', 'cook'] : ['waiter'];
    d.staff = [...(base.staff ?? []), ...extra];
    if (tier >= 3) d.h = base.h + 1;
  } else if (base.service) {
    d.service = { ...base.service, slots: base.service.slots + (tier - 1) };
  }
  if (base.hotel) d.hotel = { ...base.hotel, beds: Math.round(base.hotel.beds * (tier === 2 ? 1.5 : 2)) };
  return d;
}
