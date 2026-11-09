/**
 * Guest types and the rhythm of the night. Display texts live in strings.ts.
 */
import type { Need } from './buildings';

export type SpiritKind = 'wisp' | 'elder' | 'sprite' | 'ooze' | 'glutton';

export interface SpiritKindDef {
  /** Share of arriving guests (relative weight). */
  weight: number;
  /** Walking speed factor. */
  speed: number;
  scale: number;
  alpha: number;
  tints: number[];
  /** How long the guest waits in a queue before getting angry (ms). */
  patience: number;
  /** How likely each wish is (relative weights, default 1). */
  needs?: Partial<Record<Need, number>>;
  /** Leaves slime on the paths and does not mind dirt. */
  slimy?: boolean;
}

export const SPIRIT_KINDS: Record<SpiritKind, SpiritKindDef> = {
  /** The usual guest. */
  wisp: {
    weight: 48,
    speed: 1,
    scale: 1,
    alpha: 0.92,
    tints: [0xffffff, 0xd8e6ff, 0xe6d8ff, 0xd8fff0, 0xffdbe8],
    patience: 20_000,
  },
  /** Old and slow, very patient, but often needs the restroom. */
  elder: {
    weight: 18,
    speed: 0.55,
    scale: 1.2,
    alpha: 0.92,
    tints: [0xb8c0d0, 0xc4bccb],
    patience: 35_000,
    needs: { relief: 3, warmth: 2 },
  },
  /** Quick and small, hates waiting, loves luck charms. */
  sprite: {
    weight: 14,
    speed: 1.35,
    scale: 0.8,
    alpha: 0.92,
    tints: [0xfff0c8, 0xd0fff4],
    patience: 9_000,
    needs: { luck: 2.5 },
  },
  /** Slimy: leaves trails on the paths. */
  ooze: {
    weight: 10,
    speed: 0.8,
    scale: 1.05,
    alpha: 0.82,
    tints: [0x9fe8a0, 0xb8f0a0, 0x8fd8b8],
    patience: 25_000,
    slimy: true,
  },
  /** Always hungry, and quickly angry when the food takes too long. */
  glutton: {
    weight: 10,
    speed: 0.85,
    scale: 1.18,
    alpha: 0.92,
    tints: [0xffd8b0, 0xffc8a0],
    patience: 12_000,
    needs: { hunger: 4, thirst: 2 },
  },
};

/** Wishes per guest and night (the same wish can come up again later). */
export const WISHES = { min: 3, max: 6 } as const;

/** Chance that a hunger wish is a craving for one cuisine. */
export const CRAVING_CHANCE = 0.5;
/** A craving fulfilled by another kitchen counts only this much. */
export const CRAVING_MISS = 0.6;
/** Path cost a guest accepts to reach the kitchen it craves. */
export const CRAVING_DETOUR = 8;
/** At a restaurant, a guest waits this many times its patience for the food. */
export const FOOD_PATIENCE = 2;

/**
 * How much a wish the market does not offer at all counts against the guest's
 * mood (0 = not at all). Missing variety costs income, not reputation.
 */
export const UNAVAILABLE_WEIGHT = 0;

/** How common each wish is for every guest (multiplied with the kind's own weights). */
export const BASE_WISH_WEIGHTS: Record<Need, number> = {
  hunger: 2.5,
  thirst: 1.5,
  fun: 1,
  luck: 1,
  relief: 0.8,
  warmth: 0.7,
};

/** Random extra path cost when picking a stall, so guests spread over several stalls. */
export const CHOICE_NOISE = 6;

/** Mood lost every time a guest leaves a queue in anger. */
export const ANGER_MOOD = 0.25;

/** Short stroll between two purchases (ms of waiting after the stroll). */
export const STROLL_PAUSE = { min: 800, max: 2500 } as const;

/**
 * New guests arrive in waves during the night. Each wave is a bell curve:
 * `at` = centre (share of the arrival window), `spread` = width, `share` = part of all guests.
 */
export const WAVES = [
  { at: 0.12, spread: 0.07, share: 0.35 }, // evening rush
  { at: 0.45, spread: 0.1, share: 0.45 }, // midnight peak
  { at: 0.78, spread: 0.08, share: 0.2 }, // late guests
] as const;
