/**
 * How the teacher's review forms draw an Arabic note that quotes English
 * (`ltr`, `notCoveredList`). Two things used to go wrong in a bidi line:
 *  - «و» is written glued to the next word («وafter»), and glued to an LTR span it
 *    sat hard against the English and read as a stray Latin letter («whenو»);
 *  - the note's closing full stop was pulled inside the last English span, so it
 *    stood against the Arabic word before it instead of ending the sentence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WAW, ltr, notCoveredList, renderGrammarReviewHtml } from '../englishGrammarReview.ts';
import { renderReadingReviewHtml } from '../englishReadingReview.ts';
import { NOT_COVERED_G2 } from '../englishGrammarG2.ts';
import { NOT_COVERED_G3 } from '../englishGrammarG3.ts';
import { NOT_COVERED_G4 } from '../englishGrammarG4.ts';
import { NOT_COVERED_G9 } from '../englishGrammarG9.ts';

const NOTES: string[] = [NOT_COVERED_G2, NOT_COVERED_G3, NOT_COVERED_G4, NOT_COVERED_G9].flatMap(m => Object.values(m).flat());

const textOf = (html: string) =>
  html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('«و» before an English run is its own span, so it does not touch the English', () => {
  assert.equal(
    ltr('go home مع afternoon وgo to bed مع night'),
    `<span dir="ltr">go home</span> مع <span dir="ltr">afternoon</span> ${WAW}<span dir="ltr">go to bed</span> مع <span dir="ltr">night</span>`,
  );
  assert.equal(ltr('(وafter)'), `(${WAW}<span dir="ltr">after</span>)`);
  assert.equal(ltr('«وWhen»'), `«${WAW}<span dir="ltr">When</span>»`);
});

test('a «و» that belongs to an Arabic word, or has no English after it, is left alone', () => {
  assert.equal(ltr('ذلكوwhen'), 'ذلك' + 'و<span dir="ltr">when</span>', 'ends an Arabic word: not a conjunction');
  assert.equal(ltr('و في الصف'), 'و في الصف');
  assert.ok(!ltr('وبين when').includes('class="waw"'), '«وبين» is one Arabic word');
});

test('the closing full stop of an Arabic note stays outside the last English run', () => {
  assert.equal(ltr('لا صورة تُظهر big.'), 'لا صورة تُظهر <span dir="ltr">big</span>.');
  assert.equal(ltr('ولا مقارنة بـ as … as.'), 'ولا مقارنة بـ <span dir="ltr">as … as</span>.');
  assert.equal(
    ltr('تظهر face وtoes وtummy.'),
    `تظهر <span dir="ltr">face</span> ${WAW}<span dir="ltr">toes</span> ${WAW}<span dir="ltr">tummy</span>.`,
  );
});

test('a full stop that belongs to an English sentence stays inside its span', () => {
  assert.ok(ltr('في She can sew well. عن well مقابل good.').includes('<span dir="ltr">She can sew well.</span>'));
  assert.ok(ltr('مثل «When do you go home? We go home in the afternoon.» تُرتَّب').includes('afternoon.</span>»'));
  assert.equal(ltr('Can I borrow it, please.'), '<span dir="ltr">Can I borrow it, please.</span>', 'no Arabic around it: the full stop is English');
});

test('a question mark or an exclamation mark is never pulled out of its English run', () => {
  assert.equal(ltr('السؤال Is it a swing?'), 'السؤال <span dir="ltr">Is it a swing?</span>');
});

test('every real note keeps exactly its text, with no «و» glued to an LTR span and no closing full stop inside one', () => {
  assert.ok(NOTES.length > 100, 'the notes are found');
  for (const note of NOTES) {
    const html = ltr(note);
    assert.equal(textOf(html), note, `no character is lost or added: ${note}`);
    assert.ok(!html.includes('و<span dir="ltr">'), `«و» is not glued to an LTR span: ${note}`);
    assert.ok(!/<span dir="ltr">[^<]*\.<\/span>$/.test(html), `the closing full stop is outside the span: ${note}`);
  }
});

test('notCoveredList draws its items through ltr', () => {
  assert.ok(notCoveredList(['تظهر وbig.']).includes(`<li>تظهر ${WAW}<span dir="ltr">big</span>.</li>`));
  assert.equal(notCoveredList(undefined), '');
});

test('every grammar form carries the rule that spaces the «و», and none has one glued to an LTR span', () => {
  for (const grade of [1, 2, 3, 4, 9]) {
    const page = renderGrammarReviewHtml(grade);
    assert.ok(page.includes(WAW), `Grade ${grade} form draws «و» as its own span`);
    assert.ok(/\n\s*\.waw \{[^}]*margin-inline-end/.test(page), `Grade ${grade} form styles it`);
    assert.ok(!page.includes('و<span dir="ltr">'), `Grade ${grade} form has no «و» glued to an LTR span (note, intro or card)`);
  }
});

test('the reading forms share notCoveredList, so they carry the same rule and have no glued «و» either', () => {
  for (const grade of [1, 2, 3, 4]) {
    const page = renderReadingReviewHtml(grade);
    // Grade 1's reading form has no not-covered notes, so it draws no «و» span and needs no rule.
    assert.equal(page.includes(WAW), grade > 1, `Grade ${grade} reading form draws «و» as its own span only where it has a note`);
    if (page.includes(WAW)) assert.ok(/\n\s*\.waw \{[^}]*margin-inline-end/.test(page), `Grade ${grade} reading form styles it`);
    assert.ok(!page.includes('و<span dir="ltr">'), `Grade ${grade} reading form has no «و» glued to an LTR span`);
    assert.ok(!page.includes('${'), `Grade ${grade} reading form has no unfilled template`);
  }
});

test('Grade 1 notes, which are not in a not-covered list, go through the same drawing', () => {
  const page = renderGrammarReviewHtml(1);
  assert.ok(page.includes(`<span dir="ltr">mum</span> ${WAW}<span dir="ltr">dad</span>`), 'mum وdad is drawn apart');
  assert.ok(page.includes('<span dir="ltr">boy</span>.</p>'), 'the closing full stop is outside «boy»');
});
