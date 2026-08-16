/**
 * buildDeckSlidesHTML (deckSlidesHtml.ts) — the Slides Maker deck's PDF export.
 *
 * What this guards: the export must render the ACTUAL deck the teacher
 * built and edited, not a generic summary derived from something else. It
 * used to call buildLessonPlanSlidesHTML(plan, ...), which re-derived a
 * fixed 6-slide outline from the lesson plan alone — ignoring the graph
 * slide, the verification badges, and any per-slide edit. These tests pin
 * the deck's own content (titles, math, verification state) into the HTML.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildDeckSlidesHTML } from '../deckSlidesHtml.ts';
import type { ActivitySlide, ClassroomActivity } from '../ai/AIService.ts';

function deck(slides: ActivitySlide[]): ClassroomActivity {
  return {
    activityName: 'الاشتقاق',
    activityType: 'lesson-slides',
    grade: 'الصف العاشر',
    subject: 'الرياضيات',
    lesson: 'الاشتقاق',
    duration: 45,
    difficulty: 'standard',
    groupType: 'whole-class',
    learningObjective: '',
    materials: [],
    teacherPreparation: '',
    teacherNotes: [],
    answerKey: [],
    printables: [],
    assessment: '',
    extensionChallenge: '',
    slides,
  };
}

const titleSlide: ActivitySlide = {
  slideNumber: 1, type: 'intro', title: 'الاشتقاق',
  content: 'الرياضيات · الصف العاشر\n\nملخص الدرس', durationSeconds: 0,
};

describe('buildDeckSlidesHTML — structure', () => {
  it('emits one .deck-slide per slide, in order', () => {
    const html = buildDeckSlidesHTML(deck([
      titleSlide,
      { slideNumber: 2, type: 'intro', title: 'الفكرة 1', content: 'نص', durationSeconds: 0 },
    ]), true);
    assert.equal((html.match(/class="deck-slide/g) ?? []).length, 2);
  });

  it('page numbers reflect the deck size, not a fixed count', () => {
    const html = buildDeckSlidesHTML(deck([titleSlide]), true);
    assert.match(html, /1 \/ 1/);
  });
});

describe('buildDeckSlidesHTML — math rendering', () => {
  it('renders an equation line as structured HTML, not flat text', () => {
    const html = buildDeckSlidesHTML(deck([
      titleSlide,
      { slideNumber: 2, type: 'challenge', title: 'مثال 1', content: '3x^4 - 2x + 7', durationSeconds: 60 },
    ]), true);
    assert.match(html, /<sup>4<\/sup>/);
  });

  it('leaves prose lines as plain escaped text', () => {
    const html = buildDeckSlidesHTML(deck([
      titleSlide,
      { slideNumber: 2, type: 'intro', title: 'تمهيد', content: 'اسأل الطلاب عن رأيهم', durationSeconds: 0 },
    ]), true);
    assert.match(html, /اسأل الطلاب عن رأيهم/);
    assert.doesNotMatch(html, /class="mfrac"/);
  });
});

describe('buildDeckSlidesHTML — verification badge', () => {
  it('shows the symbolic shield and the computed evidence, prettified', () => {
    const html = buildDeckSlidesHTML(deck([
      titleSlide,
      {
        slideNumber: 2, type: 'challenge', title: 'مثال 1', content: 'f(x) = x³',
        answer: "f'(x) = 3x²", durationSeconds: 60,
        verified: true, verifiedBy: 'symbolic', computedAnswer: '3*x**2',
      },
    ]), true);
    assert.match(html, /تم التحقق من الإجابة رياضيًا/);
    assert.match(html, /3x<sup>2<\/sup>/, 'evidence line is prettified and math-rendered');
  });

  it('shows the bank label, not a false machine-verified claim', () => {
    const html = buildDeckSlidesHTML(deck([
      titleSlide,
      {
        slideNumber: 2, type: 'challenge', title: 'مثال 1', content: 'حل: x = 5',
        answer: 'x = 5', durationSeconds: 60, verified: true, verifiedBy: 'bank',
      },
    ]), true);
    assert.match(html, /من بنك الأسئلة المُراجَع/);
    assert.doesNotMatch(html, /تم التحقق من الإجابة رياضيًا/);
  });

  it('shows no badge at all for an unverified example — silence, not a false negative', () => {
    const html = buildDeckSlidesHTML(deck([
      titleSlide,
      { slideNumber: 2, type: 'challenge', title: 'مثال 1', content: 'س', answer: 'ص', durationSeconds: 60 },
    ]), true);
    assert.doesNotMatch(html, /من بنك الأسئلة المُراجَع/);
    assert.doesNotMatch(html, /تم التحقق من الإجابة رياضيًا/);
  });
});

describe('buildDeckSlidesHTML — graph slide', () => {
  it('lists the plotted commands and notes the export is not interactive', () => {
    const html = buildDeckSlidesHTML(deck([
      titleSlide,
      { slideNumber: 2, type: 'graph', title: '📈 الرسم البياني', content: 'الاشتقاق', graphCommands: ['f(x)=x^2'], durationSeconds: 0 },
    ]), true);
    assert.match(html, /f\(x\)=x\^2/);
    assert.match(html, /الرسم البياني تفاعلي داخل التطبيق/);
  });
});
