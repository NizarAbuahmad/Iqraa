/**
 * Three-way KB resolution: ground / ask / nothing.
 *
 * The regression these exist to prevent is the cliff that was there before —
 * a top hit scoring just under the confidence bar being discarded exactly like
 * a top hit scoring zero, so the chat asked the teacher to supply a lesson it
 * already had a good candidate for.
 *
 * Pure module by design: it takes ranked results as an argument and imports
 * only types, so these run without the curriculum data that stops the other KB
 * suites from loading.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  KB_CONFIDENT_SCORE,
  KB_SUGGEST_SCORE,
  isConfidentKbHit,
  resolveKbCandidates,
  shouldAskWhichLesson,
} from '../kbSuggestion.ts';
import type { KBLesson } from '../knowledgeBase.ts';

/** Only `id` is read by the resolver; the rest is shape-filling. */
const lesson = (id: string): KBLesson =>
  ({ id, titleAr: `درس ${id}`, titleEn: `Lesson ${id}` }) as unknown as KBLesson;

const ranked = (...scores: number[]) =>
  scores.map((score, i) => ({ lesson: lesson(`l${i}`), score }));

describe('isConfidentKbHit', () => {
  it('accepts a clear winner', () => {
    assert.equal(isConfidentKbHit(ranked(20, 5)), true);
  });

  it('accepts a lone hit that clears the bar', () => {
    assert.equal(isConfidentKbHit(ranked(KB_CONFIDENT_SCORE)), true);
  });

  it('rejects a hit below the bar even with no rival', () => {
    assert.equal(isConfidentKbHit(ranked(KB_CONFIDENT_SCORE - 1)), false);
  });

  it('rejects a strong hit a rival is within the margin of', () => {
    assert.equal(isConfidentKbHit(ranked(20, 19)), false);
  });

  it('rejects an empty list', () => {
    assert.equal(isConfidentKbHit([]), false);
  });
});

describe('resolveKbCandidates', () => {
  it('grounds silently on a confident hit', () => {
    const out = resolveKbCandidates(ranked(30, 4));
    assert.equal(out.kind, 'confident');
    assert.equal(out.kind === 'confident' && out.lesson.id, 'l0');
  });

  it('asks instead of discarding a near-miss — the whole point of this module', () => {
    // Previously identical to a score of 0: dropped, teacher asked to start over.
    const out = resolveKbCandidates(ranked(KB_CONFIDENT_SCORE - 1));
    assert.equal(out.kind, 'ambiguous');
    assert.equal(out.kind === 'ambiguous' && out.reason, 'weak');
  });

  it('asks when two strong hits are within the margin of each other', () => {
    const out = resolveKbCandidates(ranked(20, 19));
    assert.equal(out.kind, 'ambiguous');
    assert.equal(out.kind === 'ambiguous' && out.reason, 'contested');
    assert.equal(out.kind === 'ambiguous' && out.candidates.length, 2);
  });

  it('stays silent on noise rather than burning a turn on it', () => {
    assert.equal(resolveKbCandidates(ranked(KB_SUGGEST_SCORE - 1, 1)).kind, 'none');
  });

  it('returns none for an empty list', () => {
    assert.equal(resolveKbCandidates([]).kind, 'none');
  });

  it('treats the suggest threshold as inclusive', () => {
    assert.equal(resolveKbCandidates(ranked(KB_SUGGEST_SCORE)).kind, 'ambiguous');
  });

  it('offers at most three chips — more is a menu, not a question', () => {
    const out = resolveKbCandidates(ranked(9, 8, 8, 7, 6));
    assert.equal(out.kind === 'ambiguous' && out.candidates.length, 3);
  });

  it('honours a caller-supplied cap', () => {
    const out = resolveKbCandidates(ranked(9, 8, 7), 2);
    assert.equal(out.kind === 'ambiguous' && out.candidates.length, 2);
  });

  it('never offers a candidate below the suggest bar', () => {
    const out = resolveKbCandidates(ranked(9, KB_SUGGEST_SCORE - 1, 1));
    assert.equal(out.kind === 'ambiguous' && out.candidates.length, 1);
  });

  it('does not offer the same lesson twice', () => {
    const dupe = lesson('same');
    const out = resolveKbCandidates([
      { lesson: dupe, score: 9 },
      { lesson: dupe, score: 8 },
      { lesson: lesson('other'), score: 7 },
    ]);
    assert.equal(out.kind === 'ambiguous' && out.candidates.length, 2);
  });

  it('keeps ranking order so the likeliest chip is first', () => {
    const out = resolveKbCandidates(ranked(9, 8, 7));
    assert.deepEqual(
      out.kind === 'ambiguous' && out.candidates.map(c => c.id),
      ['l0', 'l1', 'l2'],
    );
  });

  it('agrees with isConfidentKbHit — the two gates cannot disagree', () => {
    for (const scores of [[30, 4], [20, 19], [9], [4], [10], [10, 9]]) {
      const out = resolveKbCandidates(ranked(...scores));
      assert.equal(
        out.kind === 'confident',
        isConfidentKbHit(ranked(...scores)),
        `disagreement on ${JSON.stringify(scores)}`,
      );
    }
  });
});

describe('shouldAskWhichLesson', () => {
  const ambiguous = ranked(9, 8);      // plausible, under the confidence bar
  const confident = ranked(30, 4);     // a clear winner
  const noise = ranked(2);             // below the suggest bar

  const base = {
    intent: 'artifact',
    hasHardContext: false,
    hasDocuments: false,
    isSoftBareArtifact: false,
    ranked: ambiguous,
  };

  it('asks when an artifact would be built on a guess', () => {
    const out = shouldAskWhichLesson(base);
    assert.equal(out.ask, true);
    assert.equal(out.ask === true && out.candidates.length, 2);
    assert.equal(out.ask === true && out.reason, 'weak');
  });

  it('stays quiet for a teaching answer — the question costs more than the miss', () => {
    assert.equal(shouldAskWhichLesson({ ...base, intent: 'teaching' }).ask, false);
    assert.equal(shouldAskWhichLesson({ ...base, intent: 'refinement' }).ask, false);
  });

  it('does not second-guess a pinned lesson or an explicit scope', () => {
    assert.equal(shouldAskWhichLesson({ ...base, hasHardContext: true }).ask, false);
  });

  it('does not second-guess uploaded documents — they are the topic', () => {
    assert.equal(shouldAskWhichLesson({ ...base, hasDocuments: true }).ask, false);
  });

  it('does not re-ask a bare shortcut already riding the soft-pinned lesson', () => {
    assert.equal(shouldAskWhichLesson({ ...base, isSoftBareArtifact: true }).ask, false);
  });

  it('stays quiet on a confident hit — that is what confidence is for', () => {
    assert.equal(shouldAskWhichLesson({ ...base, ranked: confident }).ask, false);
  });

  it('stays quiet on noise rather than offering a lesson nobody meant', () => {
    assert.equal(shouldAskWhichLesson({ ...base, ranked: noise }).ask, false);
    assert.equal(shouldAskWhichLesson({ ...base, ranked: [] }).ask, false);
  });

  it('cannot loop: confirming a chip empties ranked, which silences the ask', () => {
    // iqra.tsx sets `ranked = []` whenever pinnedLessonId is present, and
    // tapping a chip re-sends with exactly that pin.
    assert.equal(shouldAskWhichLesson({ ...base, ranked: [] }).ask, false);
  });

  it('passes the reason through so contested and weak can be told apart', () => {
    const out = shouldAskWhichLesson({ ...base, ranked: ranked(20, 19) });
    assert.equal(out.ask === true && out.reason, 'contested');
  });
});
