/**
 * Where the closing full stop of an Arabic note goes in the teacher's review forms (`ltr`).
 * It is the Arabic sentence's full stop, not the English phrase's: inside the last English span it stood against
 * the Arabic word before it («have got. نمط» mid-line) instead of ending the sentence at the left end of the line.
 * The «و» before English is pinned by englishGrammarReviewGlued.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ltr, notCoveredList, renderGrammarReviewHtml } from '../englishGrammarReview.ts';
import { NOT_COVERED_G2 } from '../englishGrammarG2.ts';
import { NOT_COVERED_G3 } from '../englishGrammarG3.ts';
import { NOT_COVERED_G4 } from '../englishGrammarG4.ts';
import { NOT_COVERED_G5 } from '../englishGrammarG5.ts';
import { NOT_COVERED_G9 } from '../englishGrammarG9.ts';
import { NOT_COVERED_G10 } from '../englishGrammarG10.ts';

const NOTES: string[] = [NOT_COVERED_G2, NOT_COVERED_G3, NOT_COVERED_G4, NOT_COVERED_G5, NOT_COVERED_G9, NOT_COVERED_G10]
  .flatMap(m => Object.values(m).flat());

const textOf = (html: string) =>
  html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('the closing full stop of an Arabic note stays outside the last English run', () => {
  assert.equal(ltr('لا صورة تُظهر big.'), 'لا صورة تُظهر <span dir="ltr">big</span>.');
  assert.equal(ltr('ولا مقارنة بـ as … as.'), 'ولا مقارنة بـ <span dir="ltr">as … as</span>.');
  assert.equal(ltr('تظهر face و toes وtummy.'), 'تظهر <span dir="ltr">face</span> و <span dir="ltr">toes</span> و <span dir="ltr">tummy</span>.');
});

test('a full stop that belongs to an English sentence stays inside its span', () => {
  assert.ok(ltr('في She can sew well. عن well مقابل good.').includes('<span dir="ltr">She can sew well.</span>'));
  assert.ok(ltr('مثل «When do you go home? We go home in the afternoon.» تُرتَّب').includes('afternoon.</span>»'));
  assert.equal(ltr('Can I borrow it, please.'), '<span dir="ltr">Can I borrow it, please.</span>', 'no Arabic around it: the full stop is English');
});

test('a question mark or an exclamation mark is never pulled out of its English run', () => {
  assert.equal(ltr('السؤال Is it a swing?'), 'السؤال <span dir="ltr">Is it a swing?</span>');
  assert.equal(ltr('قل Well done!'), 'قل <span dir="ltr">Well done!</span>');
});

test('every real not-covered note keeps exactly its text (plus the «و» spacing) and has no closing full stop inside a span', () => {
  assert.ok(NOTES.length > 100, 'the notes are found');
  for (const note of NOTES) {
    const html = ltr(note);
    assert.equal(textOf(html).replace(/ +/g, ' '), note.replace(/ +/g, ' ').replace(/(^|[\s(،؛:؟«])و(?=[A-Za-z])/g, '$1و '), `no character is lost or added: ${note}`);
    assert.ok(!/<span dir="ltr">[^<]*\.<\/span>$/.test(html), `the closing full stop is outside the span: ${note}`);
  }
});

test('notCoveredList draws its items through ltr', () => {
  assert.ok(notCoveredList(['تظهر big.']).includes('<li>تظهر <span dir="ltr">big</span>.</li>'));
  assert.equal(notCoveredList(undefined), '');
});

test('no grammar form has a closing full stop inside an English span in a not-covered list', () => {
  for (const grade of [2, 3, 4, 5, 9, 10]) {
    const page = renderGrammarReviewHtml(grade);
    const items = [...page.matchAll(/<li>(.*?)<\/li>/g)].map(m => m[1]).filter(h => /[؀-ۿ]/.test(h));
    assert.ok(items.length > 0, `Grade ${grade} form has notes`);
    for (const h of items) assert.ok(!/[A-Za-z]\.<\/span>$/.test(h), `Grade ${grade}: ${h.slice(-60)}`);
  }
});
