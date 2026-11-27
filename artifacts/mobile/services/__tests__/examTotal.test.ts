/**
 * The totals the new-exam screen offers for a generated paper («العلامة الكلية»).
 * The API scales the generated questions' marks to the chosen total in whole marks,
 * at least one per question, and refuses a total below the question count — so the
 * picker never offers one, and a choice the count has outgrown falls back to «تلقائي».
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TOTAL_CHOICES, totalChoicesFor, totalToSend } from '../examTotal.ts';

describe('totalChoicesFor', () => {
  it('starts with «automatic» and offers round totals', () => {
    assert.equal(TOTAL_CHOICES[0], null);
    assert.ok(TOTAL_CHOICES.includes(20) && TOTAL_CHOICES.includes(100));
  });

  it('offers only totals that give every question at least one mark', () => {
    assert.deepEqual(totalChoicesFor(25), [null, 25, 30, 40, 50, 60, 100]);
    assert.deepEqual(totalChoicesFor(5), TOTAL_CHOICES);
  });
});

describe('totalToSend', () => {
  it('sends a chosen total that still fits the count', () => {
    assert.equal(totalToSend(20, 15), 20);
  });

  it('sends nothing for «automatic» or a total the count outgrew', () => {
    assert.equal(totalToSend(null, 15), undefined);
    assert.equal(totalToSend(20, 25), undefined);
  });
});
