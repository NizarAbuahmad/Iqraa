/**
 * What one row of «تقييماتي» is allowed to say about an exam.
 *
 * The screen this serves showed title + status + marks and nothing else, so a
 * teacher with seven exams saw four rows reading «تقييم جديد» and no way to
 * tell them apart. Everything needed was already on the wire and simply not
 * rendered.
 *
 * Split out here because there are no screen tests, and each of these has a
 * silent-failure mode: an unresolvable book id, a timestamp the server did not
 * send, and a field the list endpoint does not actually return.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { bookLabel, formatListDate } from '../evaluationRow.ts';

describe('bookLabel', () => {
  it('names the book an exam was built from, in Arabic', () => {
    assert.equal(bookLabel('book-math-10', 'ar'), 'الرياضيات – الصف العاشر – الفصل الأول');
  });

  it('names it in English when the app is in English', () => {
    const label = bookLabel('book-math-10', 'en');
    assert.ok(label && label.length > 0);
    assert.notEqual(label, 'الرياضيات – الصف العاشر – الفصل الأول');
  });

  it('returns null for a book id the catalog does not have, rather than the raw id', () => {
    // A raw id on screen reads as corruption; an absent line reads as "no
    // book", which is the truth when the catalog cannot resolve it.
    assert.equal(bookLabel('book-does-not-exist', 'ar'), null);
  });

  it('returns null when the list row carries no bookId at all', () => {
    assert.equal(bookLabel(undefined, 'ar'), null);
    assert.equal(bookLabel('', 'ar'), null);
  });
});

describe('formatListDate', () => {
  it('gives a day, month and year for a real timestamp', () => {
    const out = formatListDate('2026-09-07T00:32:19.000Z', 'en');
    assert.ok(out && /2026/.test(out), `expected a year in ${out}`);
    assert.ok(out && /7/.test(out), `expected the day in ${out}`);
  });

  it('formats the same instant differently per language', () => {
    const ar = formatListDate('2026-09-07T00:32:19.000Z', 'ar');
    const en = formatListDate('2026-09-07T00:32:19.000Z', 'en');
    assert.ok(ar && en);
    assert.notEqual(ar, en);
  });

  it('returns null for a missing timestamp rather than "Invalid Date"', () => {
    assert.equal(formatListDate(undefined, 'ar'), null);
    assert.equal(formatListDate('', 'ar'), null);
  });

  it('returns null for an unparseable timestamp rather than "Invalid Date"', () => {
    // The failure this prevents is visible and absurd on a card: RN renders
    // the string "Invalid Date" happily.
    assert.equal(formatListDate('not-a-date', 'ar'), null);
  });
});
