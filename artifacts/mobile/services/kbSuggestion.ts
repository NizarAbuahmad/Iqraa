/**
 * How a KB search result becomes either a grounding, a question, or nothing.
 *
 * Retrieval used to be a cliff. `isConfidentKbHit` was the only gate, so a top
 * hit scoring 9 was discarded exactly like a top hit scoring 0 — the system had
 * a good candidate in hand, threw it away, and asked the teacher to start over.
 * That is what made the chat feel like it demanded a lesson it could have
 * guessed.
 *
 * There are now three outcomes instead of two, and the middle one is the point:
 *
 *   confident  — ground on it silently, as before
 *   ambiguous  — we have plausible candidates but not certainty → ask
 *   none       — nothing worth showing → the caller's existing fallback
 *
 * `ambiguous` deliberately covers two different shapes of doubt, because the
 * teacher-facing answer is the same question either way:
 *
 *   weak      — the best hit clears KB_SUGGEST_SCORE but not KB_CONFIDENT_SCORE
 *   contested — the best hit is strong but a rival is nearly as strong
 *
 * Why ask rather than take the top hit: grounding is a claim. Silently
 * substituting a near-miss produces a lesson plan that says it follows NCCD
 * outcomes for a lesson the teacher never asked about, and they carry it into a
 * classroom before noticing. Guess loudly, never silently — the same rule that
 * governs `verified` elsewhere in this repo.
 *
 * Pure: takes ranked results as an argument and imports only types, so it does
 * not pull the curriculum data that makes `knowledgeBase.ts` heavy to load.
 * `knowledgeBase.ts` imports the threshold and predicate back from here, so
 * there is exactly one definition of "confident".
 */
import type { KBLesson, KBScoredLesson } from './knowledgeBase.ts';

/** Minimum lexical score to treat a KB hit as confident for grounding. */
export const KB_CONFIDENT_SCORE = 10;

/**
 * Minimum score to be worth *asking* about. Below this a hit is noise — a
 * single shared word like «معادلات» — and offering it wastes the teacher's turn
 * on a lesson they did not mean. Deliberately a separate knob from the
 * confidence bar: this one tunes how eager the app is to ask, and the other
 * tunes how eager it is to act without asking.
 */
export const KB_SUGGEST_SCORE = 5;

/**
 * How close a rival has to be before a strong top hit counts as contested.
 * Mirrors the margin `isConfidentKbHit` demands, so the two cannot disagree
 * about the same pair of results.
 */
const CONFIDENT_MARGIN = 1.2;

/** True when the top ranked hit clears the confidence bar vs the runner-up. */
export function isConfidentKbHit(ranked: KBScoredLesson[]): boolean {
  const top = ranked[0];
  if (!top || top.score < KB_CONFIDENT_SCORE) return false;
  const second = ranked[1];
  if (!second) return true;
  return top.score >= second.score * CONFIDENT_MARGIN;
}

export type KbCandidateResolution =
  /** Ground on this lesson without asking. */
  | { kind: 'confident'; lesson: KBLesson }
  /** Plausible but unproven — ask before grounding. `reason` is for telemetry. */
  | { kind: 'ambiguous'; candidates: KBLesson[]; reason: 'weak' | 'contested' }
  /** Nothing worth putting in front of the teacher. */
  | { kind: 'none' };

/**
 * Classify a ranked result list into ground / ask / nothing.
 *
 * `maxCandidates` caps how many chips a teacher is asked to choose between —
 * more than three on a phone is a menu, not a question.
 */
export function resolveKbCandidates(
  ranked: KBScoredLesson[],
  maxCandidates = 3,
): KbCandidateResolution {
  const top = ranked[0];
  if (!top) return { kind: 'none' };

  if (isConfidentKbHit(ranked)) return { kind: 'confident', lesson: top.lesson };

  if (top.score < KB_SUGGEST_SCORE) return { kind: 'none' };

  // A strong top hit that failed `isConfidentKbHit` failed on the margin, so a
  // rival is within CONFIDENT_MARGIN of it — genuinely two candidates, not one
  // weak one. Worth distinguishing: a contested pair means retrieval is working
  // and the query is short, which is a different tuning problem from a weak hit.
  const reason = top.score >= KB_CONFIDENT_SCORE ? 'contested' : 'weak';

  const candidates: KBLesson[] = [];
  const seen = new Set<string>();
  for (const scored of ranked) {
    if (candidates.length >= maxCandidates) break;
    if (scored.score < KB_SUGGEST_SCORE) break; // ranked desc — the rest are noise
    if (seen.has(scored.lesson.id)) continue;
    seen.add(scored.lesson.id);
    candidates.push(scored.lesson);
  }

  return candidates.length > 0
    ? { kind: 'ambiguous', candidates, reason }
    : { kind: 'none' };
}

/**
 * Should chat stop and ask which lesson the teacher meant?
 *
 * Lifted out of `iqra.tsx`'s `sendMessage` so it can be tested. The screen has
 * no test coverage of any kind — which is how this branch shipped unexercised
 * — and it cannot get any without a React renderer the repo does not have. The
 * decision, though, is just data in and a verdict out.
 *
 * Getting the conditions wrong is expensive in both directions: too eager and
 * the app interrogates a teacher who was perfectly clear, too shy and it builds
 * a worksheet on a guess and stamps NCCD grounding on it.
 *
 * Only artifact intent asks. For a teaching answer a near-miss costs one
 * sentence the teacher corrects on the next turn, so the question would cost
 * more than the mistake.
 */
export function shouldAskWhichLesson(opts: {
  intent: string;
  /** A pinned lesson, an explicit subject scope, or a stated teaching context. */
  hasHardContext: boolean;
  /** Teacher-uploaded documents are the topic; do not second-guess them. */
  hasDocuments: boolean;
  /** A bare "خطة" riding on the soft-pinned default lesson — already resolved. */
  isSoftBareArtifact: boolean;
  ranked: KBScoredLesson[];
}): { ask: false } | { ask: true; candidates: KBLesson[]; reason: 'weak' | 'contested' } {
  if (opts.intent !== 'artifact') return { ask: false };
  if (opts.hasHardContext) return { ask: false };
  if (opts.hasDocuments) return { ask: false };
  if (opts.isSoftBareArtifact) return { ask: false };

  const guess = resolveKbCandidates(opts.ranked);
  return guess.kind === 'ambiguous'
    ? { ask: true, candidates: guess.candidates, reason: guess.reason }
    : { ask: false };
}
