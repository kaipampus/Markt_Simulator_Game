/** Small random helpers for game logic (no graphics library needed). */

/** Whole number between min and max (both included). */
export function between(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function floatBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function shuffle<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
