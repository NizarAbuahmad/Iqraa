import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyBookFilter, facetIds, resolveBookFilter, NO_BOOK_FILTER } from '../evaluationBookFilter.ts';

const CATALOG: Record<string, { gradeId: string; subjectId: string }> = {
  chem10: { gradeId: 'g10', subjectId: 'chem' },
  math10: { gradeId: 'g10', subjectId: 'math' },
  math4: { gradeId: 'g4', subjectId: 'math' },
  eng4: { gradeId: 'g4', subjectId: 'eng' },
};
const lookup = (id: string) => CATALOG[id];
const books = [...Object.keys(CATALOG), 'orphan'].map(bookId => ({ bookId }));

describe('evaluation book filter', () => {
  it('lists distinct ids in catalog order, subjects only within the chosen grade', () => {
    assert.deepEqual(facetIds(books, lookup, 'gradeId'), ['g10', 'g4']);
    assert.deepEqual(facetIds(books, lookup, 'subjectId'), ['chem', 'math', 'eng']);
    assert.deepEqual(facetIds(books, lookup, 'subjectId', { gradeId: 'g4' }), ['math', 'eng']);
  });

  it('narrows by grade, then by subject, and by both', () => {
    const ids = (f: { gradeId: string; subjectId: string }) => applyBookFilter(books, lookup, f).map(b => b.bookId);
    assert.deepEqual(ids({ gradeId: 'g4', subjectId: '' }), ['math4', 'eng4']);
    assert.deepEqual(ids({ gradeId: '', subjectId: 'math' }), ['math10', 'math4']);
    assert.deepEqual(ids({ gradeId: 'g10', subjectId: 'math' }), ['math10']);
  });

  it('keeps an unknown book only while nothing is filtered', () => {
    assert.equal(applyBookFilter(books, lookup, NO_BOOK_FILTER).length, 5);
    assert.ok(!applyBookFilter(books, lookup, { gradeId: 'g4', subjectId: '' }).some(b => b.bookId === 'orphan'));
  });

  it('drops a subject that does not exist in the newly chosen grade', () => {
    // chem was picked under grade 10; switching to grade 4 has no chemistry.
    assert.deepEqual(resolveBookFilter(books, lookup, { gradeId: 'g4', subjectId: 'chem' }), { gradeId: 'g4', subjectId: '' });
    assert.deepEqual(resolveBookFilter(books, lookup, { gradeId: 'g10', subjectId: 'chem' }), { gradeId: 'g10', subjectId: 'chem' });
    assert.deepEqual(resolveBookFilter(books, lookup, { gradeId: 'gone', subjectId: 'math' }), { gradeId: '', subjectId: 'math' });
  });
});
