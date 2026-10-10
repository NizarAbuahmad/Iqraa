import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isNationalBookSubject, nationalBookNoteKey } from '../nationalBook.ts';
import { getPickerSubjects } from '../curriculumData.ts';
import { KB_BOOKS } from '../knowledgeBase.ts';

describe('isNationalBookSubject', () => {
  it('flags English as the Ministry-approved national book', () => {
    assert.equal(isNationalBookSubject('english'), true);
  });

  it('leaves every other subject unflagged', () => {
    assert.equal(isNationalBookSubject('mathematics'), false);
    assert.equal(isNationalBookSubject('chemistry'), false);
    assert.equal(isNationalBookSubject(undefined), false);
    assert.equal(isNationalBookSubject(''), false);
  });

  it('matches a real English entry in the picker', () => {
    const english = getPickerSubjects().find(s => s.id === 'english');
    assert.ok(english, 'English is in the MVP picker');
    assert.equal(isNationalBookSubject(english.id), true);
  });

  it('covers every English book in the knowledge base, tracks included', () => {
    const englishBooks = KB_BOOKS.filter(b => b.subjectId === 'english');
    assert.ok(englishBooks.length > 0);
    for (const b of englishBooks) assert.equal(isNationalBookSubject(b.subjectId), true, b.id);
  });
});

describe('nationalBookNoteKey', () => {
  it('returns the i18n key for English and null otherwise', () => {
    assert.equal(nationalBookNoteKey('english'), 'nationalBookNote');
    assert.equal(nationalBookNoteKey('mathematics'), null);
  });
});
