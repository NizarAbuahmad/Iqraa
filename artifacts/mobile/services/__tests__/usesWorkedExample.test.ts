/**
 * Which subjects a deck's «أمثلة محلولة» is offered for. A history deck used to
 * carry the chip, and the flag behind it (true by default) built an example slide
 * whether or not the chip was drawn. The rule is the API's `usesWorkedExample`
 * (`artifacts/api-server/src/lib/lessonKinds.ts`): maths, physics, chemistry, and
 * a subject we cannot place.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { usesWorkedExample } from '../ai/lessonPlanKinds.ts';
import { buildLessonDeck } from '../lessonSlides.ts';
import { deckSections } from '../generatorSummary.ts';

describe('usesWorkedExample', () => {
  it('is true where there is a problem to work step by step', () => {
    for (const id of ['mathematics', 'physics', 'chemistry']) assert.equal(usesWorkedExample(id), true, id);
  });

  it('is false for subjects that read, observe, recite, speak or make', () => {
    for (const id of [
      'history', 'geography', 'social', 'civic-education', 'financial-literacy',
      'islamic', 'arabic', 'english', 'biology', 'earth-science', 'science',
      'physical-education', 'creative-arts', 'vocational-education', 'digital-literacy',
    ]) assert.equal(usesWorkedExample(id), false, id);
  });

  it('keeps an unplaced subject as it was, so a free-typed topic is not changed by accident', () => {
    assert.equal(usesWorkedExample(undefined), true);
    assert.equal(usesWorkedExample('not-a-subject'), true);
  });
});

describe('a deck with examples switched off', () => {
  const lesson = {
    id: 'x', titleAr: 'درس', titleEn: 'Lesson', examplesAr: ['مثال أول = ٤'], examplesEn: ['First example = 4'],
  } as any;

  it('has no example slide, and the preview does not list one', () => {
    const on = buildLessonDeck('درس', true, { lesson, includeExamples: true });
    const off = buildLessonDeck('درس', true, { lesson, includeExamples: false });
    const examples = (d: typeof on) => d.slides.filter(s => /^مثال\s*\d/.test(s.title ?? '')).length;
    assert.ok(examples(on) > 0, 'fixture: the book example should appear when examples are on');
    assert.equal(examples(off), 0);
    assert.ok(!deckSections({ wide: false, examples: false, practice: true }).includes('examples'));
  });
});
