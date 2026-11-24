/**
 * The exam builder's «الكتاب كاملًا» row. In the exam builder a Grade 10
 * vocational English track is its own catalog book (`book-english-10-commerce`
 * and three more, 30–31 objectives each), so «the whole track» is every lesson
 * of that book — which used to take one tap per lesson.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getObjectivesForBook, objectivesAreWithinBook } from '@workspace/curriculum';

import { allObjectiveIds, isEverythingSelected, toggleEverything } from '../objectiveLessons.ts';

const TRACKS = ['book-english-10-commerce', 'book-english-10-agriculture', 'book-english-10-hospitality', 'book-english-10-industry'];

describe('selecting a whole book in the exam builder', () => {
  it('ticks every objective of a vocational English track, and the server would accept them', () => {
    for (const bookId of TRACKS) {
      const objectives = getObjectivesForBook(bookId);
      assert.ok(objectives.length >= 30, `${bookId} has its objectives`);
      const picked = toggleEverything(new Set(), objectives);
      assert.equal(picked.size, objectives.length, bookId);
      assert.ok(isEverythingSelected(picked, objectives));
      assert.ok(objectivesAreWithinBook([...picked], bookId), `${bookId}: every id belongs to the book`);
    }
  });

  it('turns everything off when everything is on, and on when only part is', () => {
    const objectives = getObjectivesForBook(TRACKS[0]!);
    const all = new Set(allObjectiveIds(objectives));
    assert.equal(toggleEverything(all, objectives).size, 0);
    const some = new Set([objectives[0]!.id]);
    assert.equal(isEverythingSelected(some, objectives), false);
    assert.equal(toggleEverything(some, objectives).size, objectives.length);
  });

  it('is never "everything" for a book with nothing to pick', () => {
    assert.equal(isEverythingSelected(new Set(), []), false);
  });
});
