/**
 * Grade 10's four vocational-English coursebooks share `subjectId: 'english'`,
 * grade 10 and semester 1 with the English book itself. Grouped by semester
 * alone, the topic picker listed their 30 units unlabelled under «الفصل الأول»
 * after the book's 5, and a «الفصل الأول كاملًا» / «الكتاب كاملًا» paper spanned
 * all of them. `KBBook.track` marks those books; this pins what it changes.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { KB_BOOKS, getUnitsForSubjectGrade } from '../knowledgeBase.ts';
import { groupUnitsForPicker, parseScope, scopeKey, scopeLabel, semestersAvailable, unitsInScope } from '../scopeSelection.ts';
import { revisionPhrase, scopeFromKey } from '../revisionScope.ts';

const ENGLISH = { gradeId: 'grade-10', subjectId: 'english' };
const TRACK_BOOKS = ['kb-eng-commerce-10-s1', 'kb-eng-agriculture-10-s1', 'kb-eng-hospitality-10-s1', 'kb-eng-industry-10-s1'];

describe('Grade 10 vocational English tracks', () => {
  it('are the only books marked as a track', () => {
    assert.deepEqual(KB_BOOKS.filter(b => b.track).map(b => b.id).sort(), [...TRACK_BOOKS].sort());
  });

  it('get their own labelled picker groups, after the book’s two semesters', () => {
    const groups = groupUnitsForPicker(getUnitsForSubjectGrade(ENGLISH.subjectId, ENGLISH.gradeId));
    assert.deepEqual(
      groups.map(g => [g.semester, g.track?.titleAr ?? null, g.units.length]),
      [
        [1, null, 5],
        [2, null, 5],
        [1, 'القطاع الزراعي', 6],
        [1, 'القطاع التجاري', 6],
        [1, 'قطاع الضيافة والسياحة', 6],
        [1, 'القطاع الصناعي والتقني', 12],
      ],
    );
    assert.ok(groups[0]!.units.every(u => u.bookId === 'kb-eng-10-s1'), 'semester 1 holds only the English book');
  });

  it('are left out of a whole-semester or whole-book scope', () => {
    const s1 = unitsInScope({ kind: 'semester', ...ENGLISH, semester: 1 });
    assert.equal(s1.length, 5);
    assert.ok(s1.every(u => u.bookId === 'kb-eng-10-s1'));
    const book = unitsInScope({ kind: 'book', ...ENGLISH });
    assert.equal(book.length, 10);
    assert.ok(book.every(u => !TRACK_BOOKS.includes(u.bookId)));
    assert.deepEqual(semestersAvailable(ENGLISH.gradeId, ENGLISH.subjectId), [1, 2]);
  });

  it('can be picked whole, one track at a time', () => {
    const track = { kind: 'book' as const, ...ENGLISH, bookId: 'kb-eng-commerce-10-s1' };
    const units = unitsInScope(track);
    assert.equal(units.length, 6);
    assert.ok(units.every(u => u.bookId === 'kb-eng-commerce-10-s1'));
    assert.equal(scopeKey(track), 'book:grade-10:english:kb-eng-commerce-10-s1');
    assert.notEqual(scopeKey(track), scopeKey({ kind: 'book', ...ENGLISH }));
    assert.equal(scopeLabel(track, 'ar'), 'المسار كاملًا: القطاع التجاري');
    assert.equal(scopeLabel(track, 'en'), 'Entire Commerce track');
    assert.equal(revisionPhrase(track, 'en'), 'Commerce track topics');
    assert.equal(revisionPhrase(track, 'ar'), 'موضوعات مسار القطاع التجاري');
    assert.deepEqual(scopeFromKey(scopeKey(track)), track);
    assert.deepEqual(parseScope(JSON.parse(JSON.stringify(track))), track);
  });

  it('refuse a whole-track scope on a book that is not a track of that grade and subject', () => {
    assert.equal(parseScope({ kind: 'book', ...ENGLISH, bookId: 'kb-eng-10-s1' }), null);
    assert.equal(parseScope({ kind: 'book', gradeId: 'grade-10', subjectId: 'mathematics', bookId: 'kb-eng-commerce-10-s1' }), null);
    assert.equal(scopeFromKey('book:grade-10:english:no-such-book'), null);
  });

  it('can still be picked one unit at a time', () => {
    const unit = getUnitsForSubjectGrade(ENGLISH.subjectId, ENGLISH.gradeId).find(u => u.bookId === 'kb-eng-commerce-10-s1')!;
    assert.deepEqual(unitsInScope({ kind: 'unit', ...ENGLISH, unitId: unit.id }).map(u => u.id), [unit.id]);
  });

  it('leave a subject with no track exactly as it was', () => {
    const maths = { gradeId: 'grade-10', subjectId: 'mathematics' };
    const all = getUnitsForSubjectGrade(maths.subjectId, maths.gradeId);
    assert.equal(unitsInScope({ kind: 'book', ...maths }).length, all.length);
    assert.ok(groupUnitsForPicker(all).every(g => !g.track));
  });
});
