/**
 * Staff and cleanliness values. Display names live in strings.ts.
 */

/** Jobs a worker can have. Cooks, clerks and hosts work at one building each. */
export type Role = 'cook' | 'waiter' | 'clerk' | 'host' | 'cleaner';
export const ROLES: readonly Role[] = ['cook', 'waiter', 'clerk', 'host', 'cleaner'];

export interface RoleDef {
  /** One-time cost when hiring. */
  hire: number;
  /** Paid every morning. */
  wage: number;
  /** Walking speed factor. */
  speed: number;
  /** Coat and headband colours of the placeholder figure. */
  coat: string;
  band: string;
}

export const STAFF: Record<Role, RoleDef> = {
  cook: { hire: 40, wage: 6, speed: 1, coat: '#efe6d2', band: '#c8372d' },
  waiter: { hire: 35, wage: 5, speed: 1.15, coat: '#2a2a33', band: '#f3e9d2' },
  clerk: { hire: 30, wage: 5, speed: 1, coat: '#6b4aa0', band: '#f2c46a' },
  host: { hire: 50, wage: 8, speed: 1, coat: '#7a2e2a', band: '#f2c46a' },
  cleaner: { hire: 30, wage: 4, speed: 1.1, coat: '#3d6b8a', band: '#e8dcc0' },
};

/** Litter, slime and how they affect guests. */
export const DIRT = {
  /** Most dirt a single cell can hold. */
  max: 3,
  /** Chance that a guest drops litter after eating or drinking (no bin nearby). */
  litterChance: 0.45,
  /** A bin catches litter within this many cells (square around the bin). */
  binRadius: 3,
  /** Chance per cell that a slimy guest leaves a trail. */
  slimeChance: 0.35,
  /** Mood lost for every dirty cell a guest walks over... */
  moodPerCell: 0.05,
  /** ...but never more than this. */
  moodMax: 0.3,
  /** How long cleaning one cell takes (ms). */
  cleanMs: 1500,
  /** A cleaner sent somewhere cleans everything within this radius first. */
  focusRadius: 3,
} as const;

/** How long a guest waits at a closed stall or hotel before giving up (ms). */
export const HOLD_MS = 12_000;
