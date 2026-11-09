/**
 * Eras: the world develops from old-fashioned to modern.
 * The next era is unlocked by reputation and then bought with coins.
 */
export interface EraDef {
  /** Reputation needed before the era can be bought. */
  reputation: number;
  cost: number;
}

/** Index 0 is the starting era. Names live in strings.ts. */
export const ERAS: readonly EraDef[] = [
  { reputation: 0, cost: 0 }, // Lantern Age
  { reputation: 60, cost: 1200 }, // Steam Age
  { reputation: 75, cost: 3000 }, // Neon Age
];

export type Era = 0 | 1 | 2;
