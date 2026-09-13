/**
 * Read-aloud practice passages.
 *
 * Two files have to agree: a resource in `external_resources.json` carries the
 * flag, the licence and the credit; the prose lives in
 * `practice_passages.json`. Split deliberately — the manifest is re-exported to
 * the client and must not grow with the library — but a split is a thing that
 * drifts, and both directions fail quietly:
 *
 *   - a passage with no resource renders with **no credit**, which every
 *     licence here requires
 *   - a flagged resource with no passage puts a card on the lesson page that
 *     opens onto nothing
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_PRACTICE_WORDS,
  MIN_PRACTICE_WORDS,
  PRACTICE_PASSAGES,
  PRACTICE_QUESTIONS,
  countPassageWords,
  getPracticePassage,
  isPracticeAnswerCorrect,
  practicePassagesForLesson,
  practiceQuestionsForResource,
  validatePracticePassages,
  validatePracticeQuestions,
  type PracticePassage,
  type PracticeQuestion,
} from '../practice.ts';
import { EXTERNAL_RESOURCES } from '../external.ts';
import { usePolicy } from '../bank.ts';

describe('the shipped passages', () => {
  it('are structurally valid', () => {
    assert.deepEqual(validatePracticePassages(), []);
  });

  it('only ever reproduce something the licence permits reproducing', () => {
    // The whole reason a passage is allowed to exist. An embed-only or
    // reference-only source may be pointed at, never read aloud from.
    for (const p of PRACTICE_PASSAGES) {
      const resource = EXTERNAL_RESOURCES.find(r => r.id === p.resourceId);
      assert.ok(resource, `${p.resourceId} names no resource`);
      assert.equal(usePolicy(resource), 'quotable', `${p.resourceId} is not quotable`);
      assert.ok(resource.attribution.trim().length > 0, `${p.resourceId} has no credit to render`);
    }
  });

  it('fit inside a single recording', () => {
    // Past ~150 words a student is cut off at the 120-second ceiling and
    // scored on a fragment, which reads as the scorer being wrong.
    for (const p of PRACTICE_PASSAGES) {
      const words = countPassageWords(p.passage);
      assert.ok(
        words >= MIN_PRACTICE_WORDS && words <= MAX_PRACTICE_WORDS,
        `${p.resourceId}: ${words} words`,
      );
    }
  });
});

describe('validation catches the two ways the split drifts', () => {
  const check = (p: Partial<PracticePassage>) =>
    validatePracticePassages([
      { resourceId: 'voa-nutrients-and-nutrition', passage: 'word '.repeat(80).trim(), ...p },
    ]).join('\n');

  it('rejects a passage that names no resource', () => {
    assert.match(check({ resourceId: 'not-a-resource' }), /no licence or attribution/);
  });

  it('rejects a passage on a resource that is not flagged for practice', () => {
    // The flag is what the client reads to decide a lesson offers practice.
    // Prose without it is invisible; prose against an unflagged resource means
    // the two files disagree about what this resource is for.
    //
    // An image resource, because every *text* resource now carries the flag —
    // this assertion used to pass against the VOA article by accident, back
    // when nothing was flagged at all.
    assert.match(check({ resourceId: 'noaa-ocean-surface-currents' }), /not flagged readAloudPractice/);
  });

  it('rejects a passage outside the recordable length', () => {
    assert.match(check({ passage: 'too short' }), /outside/);
    assert.match(check({ passage: 'word '.repeat(400).trim() }), /outside/);
  });

  it('rejects two passages for one resource', () => {
    const one = { resourceId: 'voa-nutrients-and-nutrition', passage: 'word '.repeat(80).trim() };
    assert.match(validatePracticePassages([one, one]).join('\n'), /two passages for one resource/);
  });
});

describe('lookup', () => {
  it('returns nothing for an unknown id or an empty lesson', () => {
    assert.equal(getPracticePassage('nope'), undefined);
    assert.deepEqual(practicePassagesForLesson(''), []);
    assert.deepEqual(practicePassagesForLesson('kbl-does-not-exist'), []);
  });

  it('counts words the way the recorder and the scorer do', () => {
    assert.equal(countPassageWords('  one   two\nthree '), 3);
    assert.equal(countPassageWords(''), 0);
  });
});

describe('the shipped comprehension questions', () => {
  it('are structurally valid', () => {
    assert.deepEqual(validatePracticeQuestions(), []);
  });

  it('only ask about a passage the student can see', () => {
    // The point of the cross-check: a question on a resource with no passage is
    // a question about text that is not on screen.
    for (const q of PRACTICE_QUESTIONS) {
      assert.ok(
        getPracticePassage(q.resourceId),
        `${q.resourceId} has a question but no passage`,
      );
    }
  });

  it('reaches every passage', () => {
    // The other direction. A passage with no questions is not broken, but all
    // three have them today and silently losing one would not show up anywhere.
    for (const p of PRACTICE_PASSAGES) {
      assert.ok(
        practiceQuestionsForResource(p.resourceId).length > 0,
        `${p.resourceId} has a passage but no questions`,
      );
    }
  });

  it('does not put the answer in the same place every time', () => {
    // Authoring guard, not a data-shape guard. Writing options with the correct
    // one first is the natural way to type them, and it teaches a student to
    // pick the first option rather than to read — which is the opposite of the
    // exercise. Caught this in the first draft: every answerIndex was 0.
    const indices = PRACTICE_QUESTIONS
      .filter(q => q.kind === 'multiple_choice')
      .map(q => q.answerIndex);
    assert.ok(new Set(indices).size >= 3, `answers sit at only ${new Set(indices).size} position(s)`);
  });

  it('grades an answer, and only the right one', () => {
    for (const q of PRACTICE_QUESTIONS) {
      if (q.kind === 'true_false') {
        assert.equal(isPracticeAnswerCorrect(q, q.answer as boolean), true);
        assert.equal(isPracticeAnswerCorrect(q, !q.answer), false);
        // A wrong-typed answer must not read as correct: `0 === false` is true
        // in a loose comparison, and `false` is a legal pick on this kind.
        assert.equal(isPracticeAnswerCorrect(q, 0), false);
      } else {
        const right = q.answerIndex as number;
        assert.equal(isPracticeAnswerCorrect(q, right), true);
        for (let i = 0; i < (q.options ?? []).length; i++) {
          if (i !== right) assert.equal(isPracticeAnswerCorrect(q, i), false);
        }
        assert.equal(isPracticeAnswerCorrect(q, false), false);
      }
    }
  });

  it('returns nothing for an unknown or empty resource', () => {
    assert.deepEqual(practiceQuestionsForResource(''), []);
    assert.deepEqual(practiceQuestionsForResource('nope'), []);
  });
});

describe('question validation catches each way an item goes wrong', () => {
  const ok = PRACTICE_QUESTIONS.find(q => q.kind === 'multiple_choice')!;
  const check = (q: Partial<PracticeQuestion>) =>
    validatePracticeQuestions([{ ...ok, ...q }], PRACTICE_PASSAGES).join('\n');

  it('rejects an answerIndex outside the options', () => {
    assert.match(check({ answerIndex: 9 }), /outside the options/);
    assert.match(check({ answerIndex: -1 }), /outside the options/);
  });

  it('rejects too few or duplicate options', () => {
    assert.match(check({ options: ['a', 'b'], answerIndex: 0 }), /needs 3/);
    assert.match(check({ options: ['a', 'a', 'b'], answerIndex: 0 }), /duplicate options/);
  });

  it('rejects a question about a passage that does not exist', () => {
    assert.match(check({ resourceId: 'noaa-ocean-surface-currents' }), /not flagged readAloudPractice/);
    assert.match(check({ resourceId: 'not-a-resource' }), /names no resource/);
  });

  it('rejects a kind carrying the other kind’s answer', () => {
    assert.match(check({ answer: true }), /carries a true\/false answer/);
    assert.match(
      validatePracticeQuestions(
        [{ resourceId: ok.resourceId, kind: 'true_false', stem: 'x', options: ['a', 'b', 'c'] }],
        PRACTICE_PASSAGES,
      ).join('\n'),
      /carries options/,
    );
  });

  it('rejects an empty stem', () => {
    assert.match(check({ stem: '   ' }), /empty stem/);
  });
});
