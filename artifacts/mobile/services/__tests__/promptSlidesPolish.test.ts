/**
 * The local repairs made to a generated deck — no network, no model.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/promptSlidesPolish.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { polishDeck } from '../promptSlidesPolish.ts';
import { resolveSlideLayout } from '../slideLayout.ts';
import type { ActivitySlide, ClassroomActivity } from '../ai/AIService.ts';

const slide = (over: Partial<ActivitySlide> = {}): ActivitySlide => ({
  slideNumber: 1, type: 'intro', title: 'عنوان', content: '• سطر أول\n• سطر ثانٍ', durationSeconds: 0, ...over,
});

const deck = (slides: ActivitySlide[]): ClassroomActivity => ({
  activityName: 'عرض', activityType: 'prompt-slides', grade: 'العاشر', subject: 'الرياضيات',
  lesson: 'المستقيمات', duration: 30, difficulty: 'standard', groupType: 'whole-class',
  learningObjective: 'هدف', materials: [], teacherPreparation: '', slides,
  teacherNotes: [], answerKey: [], printables: [], assessment: '', extensionChallenge: '',
});

/** Enough filler to keep a deck clear of the MIN_SLIDES floor. */
const padding = (n: number) => Array.from({ length: n }, () => slide());

describe('polishDeck — inferring a layout', () => {
  it('draws a one-sentence slide as a statement instead of a lonely bullet', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ content: 'الدالة الخطية تربط بين متغيرين بعلاقة ثابتة المعدل.' }),
      ...padding(4),
    ]));
    assert.equal(out.slides[1]!.layout, 'statement');
  });

  it('never infers a layout a renderer would then refuse to draw', () => {
    // The guarantee that matters: whatever this pass sets, the gate all three
    // renderers ask must accept — otherwise the slide draws blank on a wall.
    const out = polishDeck(deck([
      slide(),
      slide({ content: 'جملة قصيرة.' }),
      slide({ title: 'خطوات الحل', content: '• اجمع الحدود\n• اقسم على المعامل' }),
      ...padding(3),
    ]));
    for (const s of out.slides) {
      if (s.layout) assert.ok(resolveSlideLayout(s), `layout ${s.layout} does not resolve`);
    }
  });

  it('numbers a bulleted procedure as steps, and leaves an unordered list alone', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ title: 'خطوات الحل', content: '• اجمع الحدود\n• اقسم على المعامل' }),
      slide({ title: 'أمثلة', content: '• مثال أول\n• مثال ثانٍ' }),
      ...padding(3),
    ]));
    assert.equal(out.slides[1]!.layout, 'steps');
    assert.equal(out.slides[2]!.layout, undefined, 'a plain list is not a process');
  });

  it('leaves the model’s own choice of layout untouched', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ layout: 'stat', content: 'سطر واحد', stat: { value: '70%', label: 'من الطلبة' } }),
      ...padding(4),
    ]));
    assert.equal(out.slides[1]!.layout, 'stat');
  });

  it('does not take the layout of a slide that is getting a photo', () => {
    // A layout renders through its own branch and never reaches the side-image
    // column, so taking it here would silently cost the slide its picture.
    const out = polishDeck(deck([
      slide(),
      slide({ content: 'جملة واحدة قصيرة.', mediaPrompt: 'straight line graph' }),
      slide({ content: 'جملة أخرى قصيرة.', sideImageUrl: 'https://img/x.jpg' }),
      ...padding(3),
    ]));
    assert.equal(out.slides[1]!.layout, undefined);
    assert.equal(out.slides[2]!.layout, undefined);
  });

  it('leaves an equation in the ordinary layout, which already boxes it', () => {
    const out = polishDeck(deck([slide(), slide({ content: 'y = 2x + 1' }), ...padding(4)]));
    assert.equal(out.slides[1]!.layout, undefined);
  });

  it('leaves the cover and the non-prose slides alone', () => {
    const out = polishDeck(deck([
      slide({ content: 'عنوان العرض' }),
      slide({ type: 'question', content: 'ما الناتج؟', options: ['1', '2'], correctIndex: 0 }),
      slide({ type: 'divider', content: 'القسم الثاني' }),
      ...padding(3),
    ]));
    assert.equal(out.slides[0]!.layout, undefined);
    assert.equal(out.slides[1]!.layout, undefined);
    assert.equal(out.slides[2]!.layout, undefined);
  });
});

describe('polishDeck — dropping what says nothing', () => {
  it('drops a hollow prose slide and renumbers what is left', () => {
    const out = polishDeck(deck([slide(), slide({ content: '•' }), ...padding(5)]));
    assert.equal(out.slides.length, 6);
    assert.ok(!out.slides.some(s => s.content.trim() === '•'));
    out.slides.forEach((s, i) => assert.equal(s.slideNumber, i + 1));
  });

  it('keeps the deck at the server’s five-slide floor rather than going under it', () => {
    const before = deck([slide(), ...Array.from({ length: 4 }, () => slide({ content: '•' }))]);
    const out = polishDeck(before);
    assert.equal(out.slides.length, before.slides.length);
  });

  it('never drops the cover or the closing summary, however thin', () => {
    const out = polishDeck(deck([
      slide({ content: '•' }),
      ...padding(5),
      slide({ type: 'summary', content: '•' }),
    ]));
    assert.equal(out.slides[0]!.content, '•');
    assert.equal(out.slides.at(-1)!.type, 'summary');
  });

  it('never drops a short slide that carries a payload instead of prose', () => {
    const out = polishDeck(deck([
      slide(),
      slide({ type: 'graph', content: '', graphCommands: ['y=2x+1'] }),
      slide({ type: 'divider', content: 'القسم الثاني' }),
      ...padding(4),
    ]));
    assert.ok(out.slides.some(s => s.type === 'graph'));
    assert.ok(out.slides.some(s => s.type === 'divider'));
  });

  it('leaves a deck with nothing wrong with it exactly as it was', () => {
    const before = deck(padding(6));
    const out = polishDeck(before);
    assert.equal(out.slides.length, 6);
    assert.ok(!out.slides.some(s => s.layout));
  });
});
