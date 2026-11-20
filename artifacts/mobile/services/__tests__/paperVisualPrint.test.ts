import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuizHTML, buildQuizSlidesHTML, buildWorksheetHTML, buildWorksheetSlidesHTML, drawingSlideGroups, quizSlideGroups } from '../exportHtml.ts';
import type { QuizOutput, QuizQuestion, WorksheetOutput } from '../ai/AIService.ts';

const PROJ = { kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'H', 'R'] } as unknown as QuizQuestion['visual'];
const STEM = 'قُذفت كرة بسرعة 20 م/ث بزاوية 30° مع الأفق. احسب أقصى ارتفاع.';
const STEM_NO_SPEED = 'قُذفت كرة بزاوية 30° مع الأفق. احسب سرعتها الابتدائية.';
const meta = { subject: 'الفيزياء', grade: 'الصف العاشر' };
const q = (id: string, text: string, visual?: unknown): QuizQuestion => ({
  id, type: 'short_answer', text, correctAnswer: 'a', points: 2, explanation: '', ...(visual ? { visual: visual as QuizQuestion['visual'] } : {}),
});
const quiz = (questions: QuizQuestion[]): QuizOutput => ({ title: 't', duration: 20, totalPoints: questions.length * 2, questions });
const sheet = (questions: { text: string; visual?: unknown }[]): WorksheetOutput => ({
  title: 't', instructions: 'i',
  sections: [{ type: 'short_answer', title: 's', questions: questions.map(x => ({ text: x.text, points: 2, ...(x.visual ? { visual: x.visual as QuizQuestion['visual'] } : {}) })) }],
  answerKey: questions.map((_, i) => ({ num: i + 1, answer: 'a' })),
});
const count = (html: string, s: string) => html.split(s).length - 1;
const slideCount = (html: string) => (html.match(/<div class="slide( title-slide)?">/g) ?? []).length;

describe('drawings in the quiz paper', () => {
  for (const withKey of [false, true]) {
    it(`prints a shown drawing under its question, once, in the ${withKey ? 'teacher' : 'student'} copy`, () => {
      const html = buildQuizHTML(quiz([q('a', STEM, PROJ), q('b', 'سؤال بلا رسم')]), 't', meta, true, [], withKey);
      assert.equal(count(html, 'class="q-vis"'), 1);
      assert.equal(count(html, '<svg'), 1);
      // Match the markup, never the CSS: the page's <style> names the same classes first.
      const first = html.indexOf('class="q-card"');
      const card = html.slice(first, html.indexOf('class="q-card"', first + 1));
      assert.ok(card.includes('<figure class="q-vis"><svg'), 'the drawing sits in its own question card');
    });
  }
  it('does not print a drawing whose numbers the question does not state', () => {
    assert.equal(count(buildQuizHTML(quiz([q('a', STEM_NO_SPEED, PROJ)]), 't', meta, true), '<svg'), 0);
  });
  it('gives every drawing its own clip id', () => {
    const html = buildQuizHTML(quiz([q('a', STEM, PROJ), q('b', STEM, PROJ)]), 't', meta, true);
    const ids = [...html.matchAll(/clipPath id="([^"]+)"/g)].map(m => m[1]);
    assert.equal(ids.length, 2);
    assert.notEqual(ids[0], ids[1]);
  });
  it('prints the drawing in English with English labels', () => {
    const html = buildQuizHTML(quiz([q('a', 'A ball is thrown at 20 m/s at 30° to the horizontal. Find H.', PROJ)]), 't', meta, false);
    assert.equal(count(html, '<svg'), 1);
  });
});

describe('drawings in the worksheet / homework paper', () => {
  it('prints a shown drawing under its question text, in both copies', () => {
    for (const withKey of [false, true]) {
      const html = buildWorksheetHTML(sheet([{ text: STEM, visual: PROJ }, { text: 'بلا رسم' }]), 't', meta, true, [], withKey);
      assert.equal(count(html, 'class="q-vis"'), 1);
      // Markup positions, never the CSS ones.
      const vis = html.indexOf('class="q-vis"');
      assert.ok(vis > html.indexOf('class="q-text'), 'after the question text');
      assert.ok(vis < html.indexOf('class="q-lines"'), 'before the writing lines');
    }
  });
});

describe('drawings on the class-mode slides', () => {
  it('worksheet slides print the drawing in its card', () => {
    assert.equal(count(buildWorksheetSlidesHTML(sheet([{ text: STEM, visual: PROJ }]), 't', meta, true), 'class="q-vis"'), 1);
  });
  it('quiz slides print the drawing, at most one drawing per slide', () => {
    const qs = [q('a', STEM, PROJ), q('b', STEM, PROJ), q('c', 'بلا رسم'), q('d', 'بلا رسم'), q('e', 'بلا رسم')];
    const html = buildQuizSlidesHTML(quiz(qs), 't', meta, true);
    assert.equal(count(html, 'class="q-vis"'), 2);
    const groups = quizSlideGroups(qs);
    assert.deepEqual(groups.map(g => g.questions.map(x => x.id)), [['a'], ['b', 'c', 'd'], ['e']]);
    assert.deepEqual(groups.map(g => g.start), [0, 1, 4]);
  });
  it('a worksheet section with drawings spans several slides and loses no question', () => {
    const items = [{ text: STEM, visual: PROJ }, { text: STEM, visual: PROJ }, { text: STEM, visual: PROJ }, { text: 'بلا رسم' }];
    const ws = sheet(items);
    const groups = drawingSlideGroups(ws.sections[0].questions, Infinity);
    assert.deepEqual(groups.map(g => g.questions.length), [1, 1, 2]);
    assert.deepEqual(groups.map(g => g.start), [0, 1, 2]);
    const html = buildWorksheetSlidesHTML(ws, 't', meta, true, [], false);
    assert.equal(count(html, 'class="q-vis"'), 3);
    for (const n of [1, 2, 3, 4]) assert.ok(html.includes(`<span class="q-num">${n}.</span>`), `question ${n} is printed`);
    assert.equal(count(html, '(تابع)'), 2 * 2, 'header and section label of the 2nd and 3rd slide');
  });
  it('a worksheet without drawings keeps one slide per section and no continuation mark', () => {
    const ws: WorksheetOutput = {
      ...sheet([{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' }, { text: 'e' }]),
    };
    ws.sections.push({ type: 'short_answer', title: 's2', questions: [{ text: 'f', points: 2 }] });
    const html = buildWorksheetSlidesHTML(ws, 't', meta, true, [], false);
    assert.equal(count(html, '(تابع)'), 0);
    // title slide + instructions slide + one slide per section
    assert.equal(slideCount(html), 2 + ws.sections.length);
  });
  it('the footer total equals the number of slides in a drawn worksheet deck', () => {
    const ws = sheet([{ text: STEM, visual: PROJ }, { text: STEM, visual: PROJ }, { text: STEM, visual: PROJ }, { text: 'بلا رسم' }]);
    const html = buildWorksheetSlidesHTML(ws, 't', meta, true, [], false);
    const slides = slideCount(html);
    assert.ok(html.includes(`${slides} / ${slides}`), 'last footer reads n / n');
    assert.equal(count(html, `/ ${slides}</span>`), slides, 'every footer carries the real total');
  });
  it('without drawings the slides group in threes exactly as before', () => {
    const qs = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => q(id, 'x'));
    assert.deepEqual(quizSlideGroups(qs).map(g => g.questions.length), [3, 3, 1]);
  });
});
