// Undo / redo history of app snapshots.
//
// Call `record()` *before* changing state. Repeated changes with the same `key`
// within a short time (e.g. pressing + several times) merge into one undo step.

export interface HistoryEntry<T, L> {
  snap: T;
  /** What the change was, for "Undone: …" messages. */
  label: L;
  /** Step the change was made on, so undo can show it. */
  step: number;
}

const MERGE_MS = 1000;
const LIMIT = 200;

export class History<T, L> {
  private past: HistoryEntry<T, L>[] = [];
  private future: HistoryEntry<T, L>[] = [];
  private lastKey: string | null = null;
  private lastAt = 0;

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  record(snap: T, label: L, step: number, key?: string): void {
    const now = Date.now();
    const merge = key !== undefined && key === this.lastKey && now - this.lastAt < MERGE_MS;
    this.lastKey = key ?? null;
    this.lastAt = now;
    this.future = [];
    if (merge) return;
    this.past.push({ snap, label, step });
    if (this.past.length > LIMIT) this.past.shift();
  }

  /** Returns the entry to restore, or null. `current` is saved for redo. */
  undo(current: T): HistoryEntry<T, L> | null {
    const e = this.past.pop();
    if (!e) return null;
    this.future.push({ snap: current, label: e.label, step: e.step });
    this.lastKey = null;
    return e;
  }

  redo(current: T): HistoryEntry<T, L> | null {
    const e = this.future.pop();
    if (!e) return null;
    this.past.push({ snap: current, label: e.label, step: e.step });
    this.lastKey = null;
    return e;
  }
}
