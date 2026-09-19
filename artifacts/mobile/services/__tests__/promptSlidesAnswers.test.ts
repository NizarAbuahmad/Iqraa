/**
 * Folding clarifying answers back into the teacher's description.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/promptSlidesAnswers.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_SOURCE_CHARS, foldAnswersIntoPrompt, foldSourceIntoPrompt } from '../promptSlidesAnswers.ts';

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

describe('foldSourceIntoPrompt', () => {
  const passage = 'التمثيل الضوئي عملية تحوّل فيها النباتات الضوء إلى غذاء.';

  it('puts the passage under the description with the rules that keep it honest', () => {
    const out = foldSourceIntoPrompt('شرائح عن التمثيل الضوئي', passage, true);
    assert.match(out, /^شرائح عن التمثيل الضوئي/);
    assert.match(out, /نص مصدري من المعلّم/);
    assert.ok(out.includes(passage));
    // The three rules are the point. Without them a model fills the gaps the
    // source leaves and attributes the invention to the teacher's own text —
    // the same shape as a `verified` flag set from a fallback.
    assert.match(out, /كل حقيقة أو رقم أو تعريف في العرض يجب أن يكون مأخوذًا منه/);
    assert.match(out, /بدل اختراعه/);
    assert.match(out, /لا تنسخ فقرات كما هي/);
  });

  it('warns the model in english too, not just arabic', () => {
    const out = foldSourceIntoPrompt('A deck on photosynthesis', 'Plants turn light into food.', false);
    assert.match(out, /Source text from the teacher/);
    assert.match(out, /never attribute to the source what is not in it/);
  });

  it('returns the description untouched when nothing was pasted', () => {
    assert.equal(foldSourceIntoPrompt('شرائح عن الكسور', '   \n  ', true), 'شرائح عن الكسور');
  });

  it('announces the cut rather than letting the source appear to end there', () => {
    // A source truncated silently reads as a source that simply stops, and the
    // model will then write a closing slide about a conclusion it never saw.
    const long = Array.from({ length: 400 }, (_, i) => `سطر رقم ${i} من النص الطويل`).join('\n');
    const out = foldSourceIntoPrompt('شرائح', long, true);
    assert.match(out, /قُصّ النص هنا/);
    assert.ok(out.length < long.length, 'the long source should not travel whole');
  });

  it('cuts at a line break so the last line is not half a sentence', () => {
    const long = Array.from({ length: 400 }, (_, i) => `سطر رقم ${i} من النص الطويل`).join('\n');
    const body = foldSourceIntoPrompt('شرائح', long, true).split('\n');
    const lastKept = body[body.length - 2]!;
    assert.ok(long.split('\n').includes(lastKept), `cut mid-line: ${lastKept}`);
  });

  it('keeps a source that is exactly at the budget whole', () => {
    const exact = 'ن'.repeat(MAX_SOURCE_CHARS);
    const out = foldSourceIntoPrompt('شرائح', exact, true);
    assert.ok(out.includes(exact));
    assert.ok(!out.includes('قُصّ'));
  });
});
