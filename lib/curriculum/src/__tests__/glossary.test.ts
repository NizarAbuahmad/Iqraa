import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getBookById, getLessonsForUnit, getUnitsForBook } from '../catalog.ts';
import {
  draftGlossary, findGlossaryEntry, glossaryForBook, glossaryKey, isSignedOff, servedGlossary, type GlossaryEntry,
} from '../glossary.ts';

const ARABIC = /[؀-ۿ]/;
const LATIN_OR_DIGIT = /[A-Za-z0-9٠-٩]/;

function balanced(s: string): boolean {
  return s.split('(').length === s.split(')').length && s.split('«').length === s.split('»').length;
}

function bookKeywords(bookId: string): Set<string> {
  const out = new Set<string>();
  for (const unit of getUnitsForBook(bookId)) {
    for (const lesson of getLessonsForUnit(unit.id)) for (const k of lesson.keywordsAr) out.add(glossaryKey(k));
  }
  return out;
}

describe('glossaryKey', () => {
  it('ignores vowels, hamza forms, ى/ي, ة/ه and the article', () => {
    assert.equal(glossaryKey('الأَيْض'), glossaryKey('ايض'));
    assert.equal(glossaryKey('الحركةُ الدائريةُ'), glossaryKey('حركة  الدائرية'));
    assert.equal(glossaryKey('مَدى'), glossaryKey('مدي'));
  });
});

describe('the book glossary (printed definitions)', () => {
  const book = servedGlossary().filter(e => e.source === 'book-glossary');

  it('is not empty and every entry belongs to a real catalog book', () => {
    assert.ok(book.length >= 400, `only ${book.length} entries`);
    for (const e of book) assert.ok(getBookById(e.bookId), `unknown book ${e.bookId} for «${e.ar}»`);
  });

  it('reads as plain Arabic prose: a term, a real definition, balanced brackets, no formula debris', () => {
    for (const e of book) {
      const where = `${e.bookId} p${e.page} «${e.ar}»`;
      assert.ok(ARABIC.test(e.ar) && !LATIN_OR_DIGIT.test(e.ar) && !/[():]/.test(e.ar), `bad term ${where}`);
      assert.ok(e.definitionAr.length >= 12, `short definition ${where}`);
      assert.ok(ARABIC.test(e.definitionAr) && !/[A-Za-z]/.test(e.definitionAr), `bad definition ${where}`);
      assert.ok(balanced(e.definitionAr), `unbalanced brackets ${where}`);
      assert.ok(/^[A-Za-z]/.test(e.en), `bad English ${where}`);
    }
  });

  it('carries none of the damage a reviewer found in the first extraction', () => {
    const TATWEEL = String.fromCodePoint(0x640);
    const SHADDA = String.fromCodePoint(0x651);
    for (const e of book) {
      const where = `${e.bookId} p${e.page} «${e.ar}»`;
      const text = `${e.ar} ${e.definitionAr}`;
      assert.ok(!text.includes(TATWEEL), `tatweel in ${where}`);
      // «اللّبة» for «اللابة»: a shadda straight on the lam of «ال» with no vowel after it.
      assert.ok(!new RegExp(`ال${String.fromCodePoint(0x644)}${SHADDA}(?![\\u064B-\\u0650])`).test(text), `lost lam-alef in ${where}`);
      assert.ok(!/(^| )ا( |$)/.test(text), `lone alef in ${where}`);
      assert.ok(!/[-–]/.test(e.ar), `hyphen in the term ${where}`);
      assert.ok(!new RegExp(`[\\u064B-\\u0652]{3,}`).test(text) && !/[ًٌٍ][َُِ]/.test(text), `doubled mark in ${where}`);
    }
    // The PDF reverses some multi-word terms; they are corrected, never served reversed. And none that is left
    // has its last word voweled with a damma while the first has no vowel at all (what a reversed one looks like).
    for (const e of book) {
      const words = e.ar.split(' ');
      assert.ok(!(words.length >= 2 && /[ٌُ]$/.test(words[words.length - 1]!) && !/[ً-ْ]/.test(words[0]!)), `looks reversed: ${e.ar}`);
    }
    for (const reversed of [
      'الحراري المحتوى', 'كوكبي سديم', 'زجاجي نسيج', 'فقاعي نسيج', 'التكوين القياسية حرارة', 'البروج دائرة',
      'فتاتية صخور رسوبية', 'خشن الحبيبات نسيج', 'المولية الكتلة', 'المئوي المردود', 'الصخور دورة',
      'رسوبية كيميائية صخور', 'غير متورق نسيج', 'ناعم الحبيبات نسيج',
    ]) {
      assert.ok(!book.some(e => glossaryKey(e.ar) === glossaryKey(reversed)), `reversed term «${reversed}» is served`);
    }
  });

  it('finds a keyword whose own spelling starts with «ال» without losing it to the term without the article', () => {
    // «الالتحام» (a lesson keyword) used to key as «تحام» while the entry «التحام» keyed as «تحام» too — and missed.
    const e = book.find(x => glossaryKey(x.ar) === glossaryKey('التحام') && x.bookId.includes('earth'));
    if (e) assert.equal(findGlossaryEntry(e.bookId, 'الالتحام'), e, 'the lesson keyword finds its entry');
  });

  it('has the lam-alef ligature restored (the PDF text layer reads «اللازمة» as «الازمة»)', () => {
    const e = findGlossaryEntry('book-phys-10-s1', 'التسارع');
    assert.ok(e, 'acceleration is missing from physics S1');
    assert.ok(e.definitionAr.includes('اللازمةِ'), e.definitionAr);
    assert.ok(!e.definitionAr.includes('الازمة'), e.definitionAr);
  });

  it('has one entry per term per book', () => {
    const seen = new Set<string>();
    for (const e of book) {
      const key = `${e.bookId}|${glossaryKey(e.ar)}`;
      assert.ok(!seen.has(key), `duplicate ${key}`);
      seen.add(key);
    }
  });

  it('is found by glossaryForBook / findGlossaryEntry', () => {
    const e = book[0]!;
    assert.ok(glossaryForBook(e.bookId).includes(e));
    assert.equal(findGlossaryEntry(e.bookId, e.ar), e);
    assert.equal(findGlossaryEntry(e.bookId, 'ليست في الكتاب أبدا'), undefined);
  });
});

describe('draft definitions stay hidden until a teacher signs them off', () => {
  const drafts = draftGlossary();

  it('every draft is a real key term of its book, so a draft cannot invent a term', () => {
    assert.ok(drafts.length > 0);
    for (const d of drafts) {
      assert.ok(getBookById(d.bookId), `unknown book ${d.bookId}`);
      assert.ok(bookKeywords(d.bookId).has(glossaryKey(d.ar)), `«${d.ar}» is not a keyword of ${d.bookId}`);
    }
  });

  it('serves a draft only with BOTH a reviewer and a date', () => {
    const base: GlossaryEntry = { bookId: 'x', ar: 'أ', en: 'a', definitionAr: 'تعريف طويل بما يكفي', source: 'draft' };
    assert.equal(isSignedOff(base), false);
    assert.equal(isSignedOff({ ...base, reviewedBy: 'معلمة' }), false);
    assert.equal(isSignedOff({ ...base, reviewedAt: '2026-10-25' }), false);
    assert.equal(isSignedOff({ ...base, reviewedBy: ' ', reviewedAt: '2026-10-25' }), false);
    assert.equal(isSignedOff({ ...base, reviewedBy: 'معلمة', reviewedAt: '2026-10-25' }), true);
  });

  it('serves no unsigned draft, and nothing is signed off yet', () => {
    assert.equal(servedGlossary().filter(e => e.source === 'draft' && !isSignedOff(e)).length, 0);
    // If this fails because a teacher signed entries off: good, update the count.
    assert.equal(servedGlossary().filter(e => e.source === 'draft').length, 0);
  });

  it('each draft is plain prose, so a signed-off one is as clean as a printed one', () => {
    for (const d of drafts) {
      assert.ok(d.definitionAr.length >= 12 && !/[A-Za-z]/.test(d.definitionAr.replace(/\b[sdp]\b|[sdp]/g, '')), `bad draft «${d.ar}»`);
      assert.ok(balanced(d.definitionAr), `unbalanced brackets «${d.ar}»`);
    }
  });
});
