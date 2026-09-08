/**
 * The invariant that made the Grade 9 English breakdown derivable.
 *
 * These two files were generated, not hand-transcribed: the book prints one
 * `□ I can …` statement per lesson and exactly 35 per semester, so lesson
 * numbering follows the order of those statements within a unit. The generator
 * refused to emit unless every unit yielded exactly seven — but the generator
 * lives in a scratchpad and the JSON is what ships, so the invariant is
 * restated here against the committed data.
 *
 * Without this, the claim "35 = 5 units x 7 lessons, verified" is only true of
 * a run nobody can repeat. With it, an edit that drops or duplicates a lesson
 * fails loudly instead of quietly changing what a teacher is shown.
 *
 * Grade 10 English is deliberately NOT covered: it ships one lesson per unit,
 * for the reason its own provenance_note gives.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { nccdG9EngSem1 } from '../catalogs/g9EngSem1.ts';
import { nccdG9EngSem2 } from '../catalogs/g9EngSem2.ts';

const FILES = [
  { name: 'g9 english S1', doc: nccdG9EngSem1, units: [1, 2, 3, 4, 5] },
  { name: 'g9 english S2', doc: nccdG9EngSem2, units: [6, 7, 8, 9, 10] },
];

describe('Grade 9 English lesson shape', () => {
  it('gives every unit exactly seven lessons, numbered 1-7 in order', () => {
    for (const { name, doc, units } of FILES) {
      assert.deepEqual(doc.units.map(u => u.number), units, `${name}: unit numbers`);
      for (const u of doc.units) {
        assert.equal(u.lessons.length, 7, `${name} unit ${u.number}: lesson count`);
        assert.deepEqual(
          u.lessons.map(l => l.order), [1, 2, 3, 4, 5, 6, 7],
          `${name} unit ${u.number}: lesson order`,
        );
        assert.deepEqual(
          u.lessons.map(l => l.id),
          [1, 2, 3, 4, 5, 6, 7].map(n => `u${u.number}_l${n}`),
          `${name} unit ${u.number}: lesson ids`,
        );
      }
    }
  });

  it('carries exactly one printed outcome per lesson, and keeps it in English', () => {
    // The outcome is the book's own sentence. Translating it would change what
    // a teacher is told the lesson delivers, so it stays verbatim — and that
    // is checkable: every one of them starts "I can".
    for (const { name, doc } of FILES) {
      for (const u of doc.units) {
        for (const l of u.lessons) {
          assert.equal(l.objectives.length, 1, `${name} ${l.id}: one outcome`);
          assert.match(l.objectives[0], /^I can .+\.$/, `${name} ${l.id}: outcome text`);
          assert.equal(l.main_idea_ar, l.objectives[0], `${name} ${l.id}: main idea mirrors outcome`);
        }
      }
    }
  });

  it('totals 35 lessons a semester — the count the derivation rested on', () => {
    for (const { name, doc } of FILES) {
      const total = doc.units.reduce((n, u) => n + u.lessons.length, 0);
      assert.equal(total, 35, `${name}: total lessons`);
    }
  });
});
