/**
 * Memory-match game deck. Emoji instead of images: no assets to bundle, no
 * network fetch, and (unlike flag emoji) plain object/animal/school emoji
 * render consistently across iOS, Android and web.
 */
import { shuffle } from './rng.ts';

export const MEMORY_ICONS = [
  '📚', '✏️', '🔬', '🎨', '⚽', '🎵', '🧮', '🌍',
  '🧪', '📐', '🖍️', '🎭', '🏆', '🔭', '🧭', '📏',
] as const;

export interface MemoryCard {
  id: string;
  icon: string;
  pairId: number;
}

/** `pairCount` icons, each duplicated once, shuffled into a play deck. */
export function buildMemoryDeck(pairCount: number, rng: () => number = Math.random): MemoryCard[] {
  const n = Math.min(pairCount, MEMORY_ICONS.length);
  const icons = MEMORY_ICONS.slice(0, n);
  const cards: MemoryCard[] = icons.flatMap((icon, pairId) => [
    { id: `${pairId}-a`, icon, pairId },
    { id: `${pairId}-b`, icon, pairId },
  ]);
  return shuffle(cards, rng);
}

export function isMatch(a: MemoryCard, b: MemoryCard): boolean {
  return a.id !== b.id && a.pairId === b.pairId;
}
