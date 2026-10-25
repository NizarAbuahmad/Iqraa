import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderGrammarReviewHtml } from '../englishGrammarReview.ts';

// The forms are right-to-left and print one table per unit. The cells that hold English are
// `white-space: nowrap` on screen, so in print the widest row sets the table's width and the overflow
// is cut off the left edge of the page: the kind chip, the tick box, the notes. Measured in Chromium
// print media at 1032 px (A4 landscape less 12 mm margins), the overhang was Grade 3 38 px,
// Grade 4 726 px, Grade 5 403 px, Grade 9 799 px; with these rules it is 0 for every grade.
// This is the structural half of that check; the measurement itself needs a browser.

/** The CSS inside every `@media print { … }` block of the form's stylesheet, and what is left outside them. */
function printSplit(html: string): { print: string; screen: string } {
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  let print = '';
  let screen = '';
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf('@media print', i);
    if (at < 0) { screen += css.slice(i); break; }
    screen += css.slice(i, at);
    const open = css.indexOf('{', at);
    let depth = 0;
    let j = open;
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}' && --depth === 0) break;
    }
    print += css.slice(open + 1, j) + '\n';
    i = j + 1;
  }
  return { print, screen };
}

describe('printed grammar forms fit the page', () => {
  for (const grade of [3, 4, 5, 9, 10]) {
    it(`Grade ${grade}: the sentence and the false twin wrap in print, and the notes column is narrow`, () => {
      const { print } = printSplit(renderGrammarReviewHtml(grade));
      assert.match(print, /td\.sentence, \.yn \{ white-space: normal; \}/);
      assert.match(print, /th\.note, td\.note \{ width: 12%; \}/);
    });
  }
  for (const grade of [3, 4]) {
    it(`Grade ${grade}: the picture, «اختر الكلمة» and yes/no columns wrap in print too`, () => {
      const { print } = printSplit(renderGrammarReviewHtml(grade));
      assert.match(print, /td\.choose, td\.yesno, \.build-half \{ white-space: normal; \}/);
    });
  }
  it('screen rendering never gets the print rules', () => {
    for (const grade of [1, 2, 3, 4, 5, 9, 10]) {
      const { screen } = printSplit(renderGrammarReviewHtml(grade));
      assert.ok(!/th\.note, td\.note \{ width: 12%/.test(screen), `Grade ${grade}`);
      assert.ok(!/td\.sentence \{ font-size: \.9rem/.test(screen), `Grade ${grade}`);
      assert.ok(!/td\.choose, td\.yesno, \.build-half \{ white-space: normal/.test(screen), `Grade ${grade}`);
    }
  });
  it('Grades 1 and 2 already fit and get no extra print rule', () => {
    for (const grade of [1, 2]) {
      const { print } = printSplit(renderGrammarReviewHtml(grade));
      assert.ok(!/white-space: normal/.test(print), `Grade ${grade}`);
    }
  });
});
