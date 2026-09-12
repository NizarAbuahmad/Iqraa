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
  countPassageWords,
  getPracticePassage,
  practicePassagesForLesson,
  validatePracticePassages,
  type PracticePassage,
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
    assert.match(check({}), /not flagged readAloudPractice/);
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
