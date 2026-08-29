/**
 * The `{{1}}` tokens in fill-blank templates are storage syntax, and they
 * leaked to every reader of a question: the teacher's preview, the student's
 * exam, the marking screen. In RTL text the braces mirror and read as arrows —
 * a teacher reported them as exactly that. These tests pin the display rule:
 * a token never survives to a reader, one gap shows a bare line, several gaps
 * keep their numbers so the answer boxes below can be matched to the sentence.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countBlanks, showBlanks } from '../evaluationBlanks.ts';

describe('countBlanks', () => {
  it('counts each token once', () => {
    assert.equal(countBlanks('اكتب {{1}} هنا'), 1);
    assert.equal(countBlanks('المحيط = {{1}} × نصف القطر، والوحدة {{2}}'), 2);
    assert.equal(countBlanks('لا فراغ هنا'), 0);
  });

  it('is not stateful across calls', () => {
    // The regex carries /g; a lastIndex leak would make every second call
    // miss the first token. Same input twice must count the same.
    const s = '{{1}} و {{2}}';
    assert.equal(countBlanks(s), 2);
    assert.equal(countBlanks(s), 2);
  });
});

describe('showBlanks', () => {
  it('never lets a {{n}} token reach the reader', () => {
    assert.ok(!showBlanks('The measurement is {{1}} meters.').includes('{{'));
    assert.ok(!showBlanks('{{1}} + ٢ = ٤').includes('}}'));
  });

  it('shows one gap as a bare line', () => {
    assert.equal(showBlanks('What is your {{1}}?'), 'What is your ______?');
  });

  it('numbers the lines when there are several gaps', () => {
    assert.equal(
      showBlanks('المحيط = {{1}} × نصف القطر، والوحدة {{2}}'),
      'المحيط = ______ (1) × نصف القطر، والوحدة ______ (2)',
    );
  });

  it('leaves text without tokens alone', () => {
    assert.equal(showBlanks('اذكره بصيغة لفظية بسيطة.'), 'اذكره بصيغة لفظية بسيطة.');
  });
});
