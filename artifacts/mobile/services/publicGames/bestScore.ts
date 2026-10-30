/**
 * A personal best per /play game, kept on the device. Compared by share right,
 * so a retry-length round and a full one are measured fairly (the board still
 * records full rounds only). The first play sets the best without calling it new.
 * Best-effort: a store that fails never throws into a game.
 */
import type { KeyValueStore } from './kvStore.ts';

export interface Best {
  score: number;
  total: number;
}
export interface BestResult {
  best: Best;
  previous: Best | null;
  isNewBest: boolean;
}

export const bestKey = (gameKey: string): string => `@iqra_play_best_v1:${gameKey}`;

const valid = (b: unknown): b is Best =>
  typeof b === 'object' && b !== null &&
  Number.isInteger((b as Best).score) && Number.isInteger((b as Best).total) &&
  (b as Best).total > 0 && (b as Best).score >= 0 && (b as Best).score <= (b as Best).total;

/** `next` has a strictly larger share right than `prev`. */
export const isBetter = (next: Best, prev: Best): boolean => next.score * prev.total > prev.score * next.total;

export async function loadBest(store: KeyValueStore, gameKey: string): Promise<Best | null> {
  try {
    const raw = await store.getItem(bestKey(gameKey));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return valid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function recordBest(store: KeyValueStore, gameKey: string, result: Best): Promise<BestResult> {
  const previous = await loadBest(store, gameKey);
  if (!valid(result)) return { best: previous ?? result, previous, isNewBest: false };
  const better = previous === null || isBetter(result, previous);
  if (better) {
    try {
      await store.setItem(bestKey(gameKey), JSON.stringify(result));
    } catch {
      // the best is lost, the game is not
    }
  }
  return { best: better ? result : previous!, previous, isNewBest: previous !== null && better };
}
