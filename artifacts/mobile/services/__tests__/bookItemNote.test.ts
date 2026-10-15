/**
 * Run: node --experimental-strip-types --test artifacts/mobile/services/__tests__/bookItemNote.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bookItemNote } from '../bookItemNote.ts';

const META = {
  generator: 'book',
  bookCitationAr: 'كتاب التمارين ص ١١، س ٣',
  bookCitationEn: 'Exercise book p. 11, Q3',
  bookLabelAr: 'الحل محسوب من نص السؤال',
  bookLabelEn: 'Answer computed from the question text',
};

describe('bookItemNote', () => {
  it('gives the citation and the key label, in the reader’s language', () => {
    assert.equal(bookItemNote(META, 'ar'), 'كتاب التمارين ص ١١، س ٣ · الحل محسوب من نص السؤال');
    assert.equal(bookItemNote(META, 'en'), 'Exercise book p. 11, Q3 · Answer computed from the question text');
  });

  it('gives the citation alone when there is nothing to caveat', () => {
    assert.equal(bookItemNote({ ...META, bookLabelAr: null }, 'ar'), 'كتاب التمارين ص ١١، س ٣');
  });

  it('says nothing for a question that did not come from a book', () => {
    assert.equal(bookItemNote({ generator: 'mock', note: 'template' }, 'ar'), null);
    assert.equal(bookItemNote({ generator: 'llm' }, 'en'), null);
  });

  it('says nothing once the teacher has edited the question', () => {
    assert.equal(bookItemNote(META, 'ar', true), null);
    assert.equal(bookItemNote(META, 'en', true), null);
    assert.equal(bookItemNote(META, 'ar', false), 'كتاب التمارين ص ١١، س ٣ · الحل محسوب من نص السؤال');
  });

  it('never throws on the bag an older question has', () => {
    for (const meta of [null, undefined, {}, { generator: 'book' }, { generator: 'book', bookCitationAr: 5 }]) {
      assert.equal(bookItemNote(meta as never, 'ar'), null);
    }
  });
});
