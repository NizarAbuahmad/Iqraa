/**
 * Shared shape and helpers for the text-prompt /play games (opposites,
 * plurals, which-number, compare-fractions, states of matter, governorates).
 * They all run on TriviaBoard: a question is a prompt (an i18n key, plus an
 * optional word or place shown in a tile) and a set of options with exactly
 * one correct id.
 */
import { shuffle } from './rng.ts';
import type { TriviaOption } from './countries.ts';
import type { TranslationKey } from '../i18n.ts';

export interface TextQuestion {
  promptKey: TranslationKey;
  /** A word, number or place shown in a tile above the prompt. Absent when the options are the whole question. */
  subject?: string;
  options: TriviaOption[];
  correctId: string;
  /** One line shown under the revealed answer, already in the question's language. Never holds an operator next to Arabic-Indic digits. */
  explanation?: string;
  /** A pure number line (digits, `/`, `=`, `≈`), drawn in its own left-to-right Text. Already wrapped in `forceLtr`. */
  explanationLtr?: string;
}

/** One random item. Throws on an empty list: a game with no data is a bug, not an empty round. */
export function pickOne<T>(items: T[], rng: () => number = Math.random): T {
  if (items.length === 0) throw new Error('pickOne: empty list');
  return items[Math.floor(rng() * items.length)]!;
}

/**
 * The correct option plus up to `n` distractors from `pool`, shuffled. A pool
 * entry is skipped when its id or label matches the correct option or one
 * already chosen, so two options can never read the same.
 */
export function withDistractors(
  correct: TriviaOption,
  pool: TriviaOption[],
  n: number,
  rng: () => number = Math.random,
): TriviaOption[] {
  const ids = new Set([correct.id]);
  const labels = new Set([correct.label]);
  const chosen: TriviaOption[] = [];
  for (const o of shuffle(pool, rng)) {
    if (chosen.length >= n) break;
    if (ids.has(o.id) || labels.has(o.label)) continue;
    ids.add(o.id);
    labels.add(o.label);
    chosen.push(o);
  }
  return shuffle([correct, ...chosen], rng);
}
