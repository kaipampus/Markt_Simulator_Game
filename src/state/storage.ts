import type { GameState, SaveData } from './GameState';

/** Browser storage key; bump the suffix if the save format changes incompatibly. */
const KEY = 'spirit-night-market-save-v1';

/** The saved game, or null if there is none (or it cannot be read). */
export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    return data.version === 1 ? data : null;
  } catch {
    return null;
  }
}

export function writeSave(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state.toSave()));
  } catch {
    // Storage full or blocked (private window): the game simply is not saved.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Save automatically: every morning, and after changes made during the day
 * (the night itself is not saved; reloading at night continues from the morning).
 */
export function startAutosave(state: GameState): () => void {
  let timer: number | undefined;
  const soon = () => {
    if (state.phase !== 'day') return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => state.phase === 'day' && writeSave(state), 600);
  };
  const offs = [
    state.on('report', () => writeSave(state)),
    state.on('placed', soon),
    state.on('removed', soon),
    state.on('staff', soon),
    state.on('area', soon),
    state.on('money', soon),
  ];
  return () => {
    window.clearTimeout(timer);
    offs.forEach((off) => off());
  };
}
