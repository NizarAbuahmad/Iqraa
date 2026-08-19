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

describe('buildDeckSlidesHTML — media slide', () => {
  it('renders the image and caption for an image media slide', () => {
    const html = buildDeckSlidesHTML(deck([
      titleSlide,
      {
        slideNumber: 2, type: 'media', title: '🖼️ صورة', content: 'caption',
        mediaKind: 'image', mediaUrl: 'https://images.unsplash.com/photo-1.jpg',
        mediaCaption: '📷 A. Photographer · Unsplash', durationSeconds: 0,
      },
    ]), true);
    assert.match(html, /src="https:\/\/images\.unsplash\.com\/photo-1\.jpg"/);
    assert.match(html, /📷 A\. Photographer · Unsplash/);
  });

  it('renders a video media slide as a real clickable link, not an image', () => {
    // A video can't play in a PDF — the link is the deliverable, and it has
    // to survive both on screen (clickable) and on paper (readable URL).
    const html = buildDeckSlidesHTML(deck([
      titleSlide,
      {
        slideNumber: 2, type: 'media', title: 'فيديو', content: 'فيديو خارجي — راجعه قبل العرض',
        mediaKind: 'video', mediaUrl: 'https://youtu.be/dQw4w9WgXcQ',
        mediaCaption: 'شرح الاشتقاق — قناة الرياضيات', durationSeconds: 0,
      },
    ]), true);
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /<a class="deck-video-link"[^>]*href="https:\/\/youtu\.be\/dQw4w9WgXcQ"/);
    assert.match(html, /شاهد الفيديو/);
    // The export has no player to read a title off, so mediaCaption (what the
    // video IS) and content (the preview warning) must BOTH survive — the
    // presenter can drop the title because the embed shows it, this can't.
    assert.match(html, /شرح الاشتقاق — قناة الرياضيات/);
    assert.match(html, /deck-video-note">فيديو خارجي — راجعه قبل العرض/);
    // The bare URL prints too, for the paper case where a link can't be clicked.
    assert.match(html, /deck-video-url">https:\/\/youtu\.be\/dQw4w9WgXcQ/);
  });
});

describe('buildDeckSlidesHTML — graph slide', () => {
  it('draws the curve instead of apologising for it', () => {
    // This used to assert the opposite: that the export printed the equation
    // as text beside a note saying the graph was interactive inside the app.
    // That note WAS the bug — the most valuable picture in a maths deck was
    // missing from the file that goes on the projector.
    const html = buildDeckSlidesHTML(deck([
      titleSlide,
      { slideNumber: 2, type: 'graph', title: '📈 الرسم البياني', content: 'الاشتقاق', graphCommands: ['f(x)=x^2'], durationSeconds: 0 },
    ]), true);
    assert.match(html, /f\(x\)=x\^2/);
    assert.match(html, /<svg/);
    assert.match(html, /<polyline/);
    assert.doesNotMatch(html, /الرسم البياني تفاعلي داخل التطبيق/);
  });

  it('keeps the note when the command is outside the plottable subset', () => {
    // Circle(...) is a real GeoGebra command this build cannot sample. The
    // honest output is the equation plus the note — never a guessed curve.
    const html = buildDeckSlidesHTML(deck([
      titleSlide,
      { slideNumber: 2, type: 'graph', title: '📈 الرسم البياني', content: 'الدائرة', graphCommands: ['Circle((0,0),3)'], durationSeconds: 0 },
    ]), true);
    assert.match(html, /الرسم البياني تفاعلي داخل التطبيق/);
    assert.doesNotMatch(html, /<polyline/);
  });
});

describe('buildDeckSlidesHTML — typography', () => {
  it('loads the app’s real typefaces and uses them, with Arial only as fallback', () => {
    const html = buildDeckSlidesHTML(deck([titleSlide]), true);
    assert.match(html, /fonts\.googleapis\.com\/css2\?family=Almarai[^"]*Cairo/);
    // Body copy in Almarai, headings in Cairo — the split the on-screen UI makes.
    assert.match(html, /body \{ font-family: 'Almarai'/);
    assert.match(html, /\.deck-title-main[^}]*\{ font-family: 'Cairo'|font-family: 'Cairo'[^}]*\}/);
    // Arial must survive as the offline fallback, not disappear entirely.
    assert.match(html, /'Almarai','Arial'/);
  });
});

describe('buildDeckSlidesHTML — hero backgrounds (title + divider)', () => {
  it('renders the title slide as a flat gradient when no photo was fetched', () => {
    const html = buildDeckSlidesHTML(deck([titleSlide]), true);
    assert.doesNotMatch(html, /<img class="deck-hero-img"/);
  });

  it('renders a full-bleed photo behind the title when mediaUrl is set', () => {
    const withPhoto: ActivitySlide = { ...titleSlide, mediaUrl: 'https://images.unsplash.com/photo-1.jpg' };
    const html = buildDeckSlidesHTML(deck([withPhoto]), true);
    assert.match(html, /class="deck-hero-img" src="https:\/\/images\.unsplash\.com\/photo-1\.jpg"/);
    assert.match(html, /deck-hero-gradient/);
  });

  it('renders a divider slide as a flat accent panel with no photo', () => {
    const html = buildDeckSlidesHTML(deck([
      titleSlide,
      { slideNumber: 2, type: 'divider', title: 'الاشتقاق', content: 'لنبدأ الشرح', durationSeconds: 0 },
    ]), true);
    assert.match(html, /deck-divider-slide/);
    assert.match(html, /لنبدأ الشرح/);
    assert.doesNotMatch(html, /<img class="deck-hero-img"/);
  });

  it('renders a divider slide with a background photo when mediaUrl is set', () => {
    const html = buildDeckSlidesHTML(deck([
      titleSlide,
      {
        slideNumber: 2, type: 'divider', title: 'الاشتقاق', content: 'لنبدأ الشرح', durationSeconds: 0,
        mediaUrl: 'https://images.unsplash.com/photo-2.jpg',
      },
    ]), true);
    assert.match(html, /class="deck-hero-img" src="https:\/\/images\.unsplash\.com\/photo-2\.jpg"/);
  });
});
