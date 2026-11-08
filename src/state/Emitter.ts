// Internal storage type; the public `on`/`emit` signatures stay fully typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyListener = (...args: any[]) => void;

/** Minimal typed event emitter, so game state does not depend on Phaser. */
export class Emitter<E extends Record<string, unknown[]>> {
  private listeners = new Map<keyof E, Set<AnyListener>>();

  /** Subscribe; returns a function that unsubscribes again. */
  on<K extends keyof E>(event: K, fn: (...args: E[K]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
    return () => set.delete(fn);
  }

  emit<K extends keyof E>(event: K, ...args: E[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) fn(...args);
  }

  clearListeners(): void {
    this.listeners.clear();
  }
}
