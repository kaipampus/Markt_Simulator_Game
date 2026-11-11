/**
 * Graphics quality: "high" (default) or "low" for weaker computers.
 * The choice is kept in the browser (per device, not in the saved game).
 * The 3D world listens for changes; antialiasing only changes on the next start.
 */

export type Quality = 'high' | 'low';

export interface QualitySettings {
  /** Highest device pixel ratio used (Retina screens have 2). */
  pixelRatio: number;
  /** Real lights at night; they move to the lamps nearest the camera. */
  lights: number;
  /** Sun shadows by day. */
  shadows: boolean;
  /** Size of the shadow map (pixels per side). */
  shadowMap: number;
  /** Smooth edges (needs a restart to change). */
  antialias: boolean;
}

export const QUALITY: Record<Quality, QualitySettings> = {
  high: { pixelRatio: 1.5, lights: 10, shadows: true, shadowMap: 1024, antialias: true },
  low: { pixelRatio: 1, lights: 4, shadows: false, shadowMap: 512, antialias: false },
};

const KEY = 'spirit-night-market-graphics';
const listeners = new Set<(q: Quality) => void>();

function read(): Quality {
  try {
    return localStorage.getItem(KEY) === 'low' ? 'low' : 'high';
  } catch {
    return 'high';
  }
}

let current: Quality = read();

export function getQuality(): Quality {
  return current;
}

export function setQuality(q: Quality): void {
  current = q;
  try {
    localStorage.setItem(KEY, q);
  } catch {
    // Storage blocked: the choice only lasts until the page is reloaded.
  }
  for (const l of listeners) l(q);
}

/** G key: switch between high and low. Returns the new quality. */
export function toggleQuality(): Quality {
  setQuality(current === 'high' ? 'low' : 'high');
  return current;
}

/** Call `fn` whenever the quality changes; returns a function that stops it. */
export function onQuality(fn: (q: Quality) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
