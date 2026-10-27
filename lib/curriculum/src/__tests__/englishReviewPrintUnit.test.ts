import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderGrammarReviewHtml } from '../englishGrammarReview.ts';
import { renderReadingReviewHtml } from '../englishReadingReview.ts';

// On screen a unit is a grid (heading, table, sign-off). In Chromium's print layout a grid places the
// next item where the table would have ended WITHOUT the page break, so when a unit's table runs onto a
// second page the sign-off box (verdict ticks, name / date / signature) was drawn over the table's last
// one to three rows, hiding sentences and tick boxes, and left blank pages behind it. In print the unit
// is an ordinary block, with the same 14 px between its parts. Measured on all 7 grammar forms and the
// 4 reading forms: overlaps down to 0, no blank page, same page counts. The measurement needs a browser;
// this is the structural half.

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

const RULE_BLOCK = /\.unit \{ display: block; \}/;
const RULE_GAP = /\.unit > \* \+ \* \{ margin-top: 14px; \}/;

const forms: [string, string][] = [
  ...[1, 2, 3, 4, 5, 9, 10].map((g): [string, string] => [`grammar Grade ${g}`, renderGrammarReviewHtml(g)]),
  ...[1, 2, 3, 4].map((g): [string, string] => [`reading Grade ${g}`, renderReadingReviewHtml(g)]),
];

describe('printed review forms: the sign-off sits under the unit table', () => {
  for (const [name, html] of forms) {
    it(`${name}: in print a unit is a block with 14 px between its parts`, () => {
      const { print, screen } = printSplit(html);
      assert.match(print, RULE_BLOCK);
      assert.match(print, RULE_GAP);
      // the screen layout keeps its grid and gets neither rule
      assert.match(screen, /\.unit \{ display: grid; gap: 14px; \}/);
      assert.ok(!RULE_BLOCK.test(screen), name);
      assert.ok(!RULE_GAP.test(screen), name);
    });
  }
});
