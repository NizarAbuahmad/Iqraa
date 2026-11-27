/**
 * An approved figure note on the lesson deck and the revision deck — and, with
 * none, the decks exactly as they were.
 *
 * Run (from artifacts/mobile):
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/figureNoteSlides.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { bookFigureCaption, buildLessonDeck, buildRevisionDeck } from '../lessonSlides.ts';
import { figuresForLesson, type BookFigure } from '../bookFigures.ts';
import { figureNoteReader, type FigureNoteReader, type NoteEntry } from '../bookFigureNotes.ts';
import { KB_LESSONS } from '../knowledgeBase.ts';
import type { ActivitySlide } from '../ai/AIService.ts';

const ID = 'kbl-phys-s1-nccd-u1_l2';
const LESSON = KB_LESSONS.find(l => l.id === ID)!;
const FIGS = figuresForLesson(ID);
const uri = (f: { file: string }) => `fig://${f.file}`;
const none: FigureNoteReader = () => null;

const entry = (file: string): NoteEntry => ({
  status: 'approved',
  ar: { caption: `شرح ${file}`, teacher: `ملاحظة ${file}` },
  en: { caption: `Caption ${file}`, teacher: `Note ${file}` },
  reviewedBy: 'معلم', reviewedAt: '2026-12-01',
});
/** Approves exactly these figures, wherever they come from. */
function approving(figs: BookFigure[]): FigureNoteReader {
  const bySource = new Map<string, Record<string, NoteEntry>>();
  for (const f of figs) {
    const notes = bySource.get(f.sourceId) ?? {};
    notes[f.file] = entry(f.file);
    bySource.set(f.sourceId, notes);
  }
  return figureNoteReader([...bySource].map(([sourceId, notes]) => ({ sourceId, notes })));
}

const figureSlides = (slides: ActivitySlide[]) => slides.filter(s => s.type === 'media' && s.mediaUrl?.startsWith('fig://'));
const noRules = { ...LESSON, rulesAr: [], rulesEn: [] };
const withRule = { ...LESSON, rulesAr: ['القاعدة'], rulesEn: ['The rule'] };

describe('probe', () => {
  it('the lesson exists and has several figures', () => {
    assert.ok(LESSON, ID);
    assert.ok(FIGS.length >= 2, 'probe: u1_l2 holds several figures');
  });
});

describe('a figure slide of its own', () => {
  for (const isAr of [true, false]) {
    it(`carries the approved note before the citation (${isAr ? 'ar' : 'en'})`, () => {
      const deck = buildLessonDeck('x', isAr, { lesson: noRules, figureUri: uri, figureNote: approving([FIGS[0]!]) });
      const shown = figureSlides(deck.slides);
      const first = shown.find(s => s.mediaUrl === uri(FIGS[0]!))!;
      const citation = bookFigureCaption(FIGS[0]!, isAr);
      const caption = isAr ? `شرح ${FIGS[0]!.file}` : `Caption ${FIGS[0]!.file}`;
      assert.equal(first.content, `${caption}\n${citation}`);
      assert.equal(first.mediaCaption, `${caption}\n${citation}`, 'the PDF and PowerPoint read mediaCaption, not content');
      assert.deepEqual(first.teacher, { expectedAnswer: '', teachingTips: isAr ? `ملاحظة ${FIGS[0]!.file}` : `Note ${FIGS[0]!.file}` });
      // the others have no approved note and are untouched
      for (const s of shown.filter(s => s !== first)) {
        assert.equal(s.content, s.mediaCaption);
        assert.equal('teacher' in s, false);
      }
    });
  }

  it('with no approved note, is exactly as before: citation twice, no teacher block', () => {
    const deck = buildLessonDeck('x', true, { lesson: noRules, figureUri: uri, figureNote: none });
    const shown = figureSlides(deck.slides);
    assert.ok(shown.length > 0);
    for (const s of shown) {
      const f = FIGS.find(g => uri(g) === s.mediaUrl)!;
      assert.equal(s.content, bookFigureCaption(f, true));
      assert.equal(s.mediaCaption, bookFigureCaption(f, true));
      assert.equal('teacher' in s, false);
    }
  });
});

describe('the figure beside the rule', () => {
  const ruleSlide = (slides: ActivitySlide[]) => slides.find(s => s.title === '📐 القاعدة')!;

  it('puts the caption above the citation and the speaker note in the teacher block', () => {
    const deck = buildLessonDeck('x', true, { lesson: withRule, figureUri: uri, figureNote: approving([FIGS[0]!]) });
    const rule = ruleSlide(deck.slides);
    assert.equal(rule.sideImageUrl, uri(FIGS[0]!));
    assert.equal(rule.sideImageCaption, `شرح ${FIGS[0]!.file}\n${bookFigureCaption(FIGS[0]!, true)}`);
    assert.deepEqual(rule.teacher, { expectedAnswer: '', teachingTips: `ملاحظة ${FIGS[0]!.file}` });
  });

  it('with no approved note, keeps the citation alone and gains no teacher block', () => {
    const deck = buildLessonDeck('x', true, { lesson: withRule, figureUri: uri, figureNote: none });
    const rule = ruleSlide(deck.slides);
    assert.equal(rule.sideImageCaption, bookFigureCaption(FIGS[0]!, true));
    assert.equal('teacher' in rule, false);
  });
});

describe('the revision deck', () => {
  const lessons = ['kbl-phys-s1-nccd-u1_l1', 'kbl-phys-s1-nccd-u1_l2'].map(id => ({ id, title: id, thin: false }));
  // Hand-built so the round has both an outcomes slide and a terms slide, and
  // terms worth asking about (which put tips on the outcomes slide already).
  const unit = {
    unitId: 'kbu-phys-s1-nccd-u1', title: 'المتجهات', lessons,
    outcomes: ['أميّز بين الكميات القياسية والكميات المتجهة.'],
    concepts: ['الكمية المتجهة', 'الكمية القياسية'],
    terms: ['المتجه'],
  };
  // unitFigures takes the first figure of each lesson in turn.
  const first = figuresForLesson('kbl-phys-s1-nccd-u1_l1')[0]!;
  const second = figuresForLesson('kbl-phys-s1-nccd-u1_l2')[0]!;
  const build = (figureNote: FigureNoteReader) =>
    buildRevisionDeck(true, { units: [unit], phrase: 'x', plan: null, figureUri: uri, figureNote });
  const byImage = (slides: ActivitySlide[], f: BookFigure) => slides.find(s => s.sideImageUrl === uri(f))!;

  it('appends the note to the outcomes slide\'s existing tips and captions both figures', () => {
    const base = build(none);
    const noted = build(approving([first, second]));
    const goals0 = byImage(base.slides, first);
    const goals = byImage(noted.slides, first);
    assert.ok(goals0.teacher?.teachingTips, 'probe: the outcomes slide already has tips');
    assert.equal(goals.sideImageCaption, `شرح ${first.file}\n${bookFigureCaption(first, true)}`);
    assert.equal(goals.teacher?.teachingTips, `${goals0.teacher!.teachingTips}\n\nملاحظة ${first.file}`);
    assert.equal(goals.teacher?.expectedAnswer, goals0.teacher?.expectedAnswer, 'the expected answer is kept');

    const terms = byImage(noted.slides, second);
    assert.equal(terms.sideImageCaption, `شرح ${second.file}\n${bookFigureCaption(second, true)}`);
    assert.deepEqual(terms.teacher, { expectedAnswer: '', teachingTips: `ملاحظة ${second.file}` });
  });

  it('with no approved note, is exactly as before', () => {
    const base = build(none);
    assert.equal(byImage(base.slides, first).sideImageCaption, bookFigureCaption(first, true));
    const terms = byImage(base.slides, second);
    assert.equal(terms.sideImageCaption, bookFigureCaption(second, true));
    assert.equal('teacher' in terms, false);
  });
});
