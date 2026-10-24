import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ltr, renderGrammarReviewHtml } from '../englishGrammarReview.ts';

// The not-covered notes write the conjunction «و» straight in front of an English word («وafter»).
// In the printed form the English run is its own left-to-right span, and a «و» touching it reads
// like a stray letter. The renderer, not the data, puts the space in.
describe('Arabic «و» next to an English word in the printed forms', () => {
  it('gets a space when it is a word of its own', () => {
    assert.equal(ltr('when وafter'), '<span dir="ltr">when</span> و <span dir="ltr">after</span>');
    assert.equal(ltr('وshould'), 'و <span dir="ltr">should</span>');
    assert.ok(ltr('(وafter)').startsWith('(و '));
    assert.ok(ltr('كذا، وafter').includes('، و <span'));
    assert.ok(ltr('كذا؛ وafter').includes('؛ و <span'));
    assert.ok(ltr('كذا: وafter').includes(': و <span'));
  });
  it('leaves a «و» inside a longer Arabic word, and one already spaced, alone', () => {
    assert.equal(ltr('ورقة after'), 'ورقة <span dir="ltr">after</span>');
    assert.equal(ltr('و after'), 'و <span dir="ltr">after</span>');
    assert.equal(ltr('والمضارع after'), 'والمضارع <span dir="ltr">after</span>');
    assert.equal(ltr('وكتب'), 'وكتب');
  });
  for (const grade of [1, 2, 3, 4, 5, 9, 10]) {
    it(`Grade ${grade}: no rendered text has «و» glued to an English word`, () => {
      const text = renderGrammarReviewHtml(grade).replace(/<[^>]*>/g, '');
      const glued = text.match(/(?:^|[\s(،؛:])و[A-Za-z]\w*/g) ?? [];
      assert.deepEqual(glued, []);
      const html = renderGrammarReviewHtml(grade);
      assert.equal((html.match(/و<span dir="ltr">/g) ?? []).length, 0);
    });
  }
});
