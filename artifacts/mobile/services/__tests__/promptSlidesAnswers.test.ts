/**
 * Folding clarifying answers back into the teacher's description.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/promptSlidesAnswers.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { foldAnswersIntoPrompt } from '../promptSlidesAnswers.ts';

describe('foldAnswersIntoPrompt', () => {
  it('appends what the teacher tapped under a heading', () => {
    const out = foldAnswersIntoPrompt('شرائح عن الكسور', [
      { question: 'ما هدف الحصة؟', answer: 'مراجعة' },
      { question: 'ما المستوى؟', answer: 'متوسط' },
    ], true);
    assert.match(out, /^شرائح عن الكسور/);
    assert.match(out, /تفاصيل إضافية من المعلّم:/);
    assert.match(out, /- ما هدف الحصة؟ مراجعة/);
    assert.match(out, /- ما المستوى؟ متوسط/);
  });

  it('returns the description untouched when every question was skipped', () => {
    // A trailing heading with nothing under it reads as a bug to the model as
    // much as to a person.
    const prompt = 'شرائح عن الكسور';
    assert.equal(foldAnswersIntoPrompt(prompt, [], true), prompt);
    assert.equal(
      foldAnswersIntoPrompt(prompt, [{ question: 'ما الهدف؟', answer: '' }], true),
      prompt,
    );
  });

  it('drops half-answered pairs rather than emitting a dangling line', () => {
    const out = foldAnswersIntoPrompt('deck about fractions', [
      { question: 'Purpose?', answer: 'Revision' },
      { question: '', answer: 'orphan' },
      { question: 'Level?', answer: '   ' },
    ], false);
    assert.match(out, /- Purpose\? Revision/);
    assert.ok(!out.includes('orphan'));
    assert.ok(!out.includes('Level?'));
  });

  it('writes the heading in the teacher’s own language', () => {
    const en = foldAnswersIntoPrompt('deck', [{ question: 'Purpose?', answer: 'Revision' }], false);
    assert.match(en, /Extra detail from the teacher:/);
  });

  it('does not double the blank line when the description already ends in one', () => {
    const out = foldAnswersIntoPrompt('deck\n\n', [{ question: 'Q?', answer: 'A' }], false);
    assert.ok(!out.includes('\n\n\n'));
  });
});
