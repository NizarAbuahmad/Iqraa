/**
 * Figure notes on the class decks (quiz, worksheet, game), and the promise the
 * whole feature rests on: a note that is not approved changes nothing, on any
 * deck of any Grade 10 physics lesson, in either language.
 *
 * Run (from artifacts/mobile):
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/figureNoteDecks.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildDeckFromQuiz, buildDeckFromWorksheet, buildGameDeckFromQuiz } from '../classDeck.ts';
import { bookFigureCaption, buildLessonDeck, buildRevisionDeck } from '../lessonSlides.ts';
import { figuresForLesson } from '../bookFigures.ts';
import { NOTES_FILES, figureNoteReader, type FigureNoteReader, type NoteEntry, type NotesFile } from '../bookFigureNotes.ts';
import { KB_LESSONS, type KBLesson } from '../knowledgeBase.ts';
import { revisionUnitsFromLessons } from '../revisionScope.ts';
import type { ActivitySlide, QuizOutput, WorksheetOutput } from '../ai/AIService.ts';

const QUIZ: QuizOutput = {
  title: 'اختبار', duration: 10, totalPoints: 2,
  questions: [
    { id: 'q1', type: 'multiple_choice', text: 'ما وحدة القوة؟', options: ['N', 'kg'], correctAnswer: 'N', points: 1, explanation: '' },
    { id: 'q2', type: 'short_answer', text: 'عرّف المتجه.', correctAnswer: 'كمية لها مقدار واتجاه', points: 1, explanation: '' },
  ],
};
const WORKSHEET: WorksheetOutput = {
  title: 'ورقة عمل', instructions: 'أجب',
  sections: [{ type: 'short_answer', title: 'القسم الأول', questions: [{ text: 'س1', points: 1 }] }],
  answerKey: [{ num: 1, answer: 'إجابة' }],
};
const uri = (f: { file: string }) => `fig://${f.file}`;
const none: FigureNoteReader = () => null;
const PHYSICS: KBLesson[] = KB_LESSONS.filter(l => l.id.startsWith('kbl-phys-s') && figuresForLesson(l.id).length > 0);

/** The shipped files with every entry forced to `status` — text kept. */
function forced(status: NoteEntry['status']): FigureNoteReader {
  const files: NotesFile[] = NOTES_FILES.map(f => ({
    sourceId: f.sourceId,
    notes: Object.fromEntries(Object.entries(f.notes).map(([k, e]) => [k, { ...e, status }])),
  }));
  return figureNoteReader(files);
}
/** Every physics figure approved, with stand-in text: the opposite pole. */
const approveAll: FigureNoteReader = (figure, isAr) =>
  figure.sourceId.startsWith('phys-') ? { caption: isAr ? `شرح ${figure.file}` : `Caption ${figure.file}`, teacher: 'T' } : null;

type Build = (lesson: KBLesson, isAr: boolean, figureNote: FigureNoteReader | undefined) => { slides: ActivitySlide[] };
const DECKS: Record<string, Build> = {
  lesson: (lesson, isAr, figureNote) => buildLessonDeck(lesson.titleAr, isAr, { lesson, figureUri: uri, figureNote }),
  quiz: (lesson, isAr, figureNote) => buildDeckFromQuiz(QUIZ, lesson.titleAr, isAr, { lesson, figureUri: uri, figureNote }),
  worksheet: (lesson, isAr, figureNote) => buildDeckFromWorksheet(WORKSHEET, lesson.titleAr, isAr, { lesson, figureUri: uri, figureNote }),
  game: (lesson, isAr, figureNote) => buildGameDeckFromQuiz(QUIZ, lesson.titleAr, isAr, { teamCount: 3, lesson, figureUri: uri, figureNote }),
};

describe('probe', () => {
  it('Grade 10 physics has the twelve lessons with figures the map gives it', () => {
    assert.equal(PHYSICS.length, 12);
  });
});

describe('class decks carry an approved note', () => {
  const lesson = KB_LESSONS.find(l => l.id === 'kbl-phys-s2-nccd-u4_l2')!;
  const f0 = figuresForLesson(lesson.id)[0]!;
  for (const kind of ['quiz', 'worksheet', 'game'] as const) {
    it(`on the ${kind} deck`, () => {
      const deck = DECKS[kind]!(lesson, true, approveAll);
      const s = deck.slides.find(x => x.mediaUrl === uri(f0))!;
      const expected = `شرح ${f0.file}\n${bookFigureCaption(f0, true)}`;
      assert.equal(s.content, expected);
      assert.equal(s.mediaCaption, expected);
      assert.deepEqual(s.teacher, { expectedAnswer: '', teachingTips: 'T' });
    });
  }
});

describe('a note that is not approved changes nothing', () => {
  for (const status of ['draft', 'needs-fix', 'skip'] as const) {
    it(`every physics lesson, every deck, both languages — all notes ${status}`, () => {
      const reader = forced(status);
      for (const lesson of PHYSICS) {
        for (const isAr of [true, false]) {
          for (const [kind, build] of Object.entries(DECKS)) {
            assert.deepEqual(build(lesson, isAr, reader), build(lesson, isAr, none), `${lesson.id} ${kind} ${isAr ? 'ar' : 'en'}`);
          }
        }
      }
    });
  }

  it('and the revision deck over every physics unit, both languages', () => {
    const ids = KB_LESSONS.filter(l => l.id.startsWith('kbl-phys-s')).map(l => l.id);
    for (const lang of ['ar', 'en'] as const) {
      const units = revisionUnitsFromLessons(ids, lang);
      const build = (figureNote: FigureNoteReader) =>
        buildRevisionDeck(lang === 'ar', { units, phrase: 'x', plan: null, figureUri: uri, figureNote });
      assert.deepEqual(build(forced('draft')), build(none), lang);
    }
  });

  it('the shipped default reader (figureNote omitted) never lets a non-approved note\'s text onto a deck', () => {
    assert.ok(NOTES_FILES.some(f => Object.keys(f.notes).length > 0), 'probe: the shipped notes files hold drafts');
    const needles: string[] = [];
    for (const f of NOTES_FILES) {
      for (const e of Object.values(f.notes)) {
        if (e.status === 'approved') continue;
        for (const lang of [e.ar, e.en]) {
          for (const s of [lang?.caption, lang?.teacher]) {
            const t = (s ?? '').trim();
            // JSON.stringify escapes quotes and newlines, so match the escaped form.
            if (t) needles.push(JSON.stringify(t).slice(1, -1));
          }
        }
      }
    }
    assert.ok(needles.length > 0, 'probe: there are non-approved texts to look for');

    const dumps: string[] = [];
    for (const lesson of PHYSICS) {
      for (const isAr of [true, false]) {
        for (const build of Object.values(DECKS)) dumps.push(JSON.stringify(build(lesson, isAr, undefined)));
      }
    }
    const ids = KB_LESSONS.filter(l => l.id.startsWith('kbl-phys-s')).map(l => l.id);
    for (const lang of ['ar', 'en'] as const) {
      const units = revisionUnitsFromLessons(ids, lang);
      dumps.push(JSON.stringify(buildRevisionDeck(lang === 'ar', { units, phrase: 'x', plan: null, figureUri: uri })));
    }
    assert.equal(dumps.length, PHYSICS.length * 2 * Object.keys(DECKS).length + 2, 'probe: every deck was built');
    assert.ok(dumps.every(d => d.includes('fig://')), 'probe: every deck carries book figures');

    for (const needle of needles) {
      for (const d of dumps) assert.equal(d.includes(needle), false, `non-approved note text reached a deck: ${needle.slice(0, 40)}`);
    }
  });

  it('is not a vacuous check: approving every figure changes every physics lesson deck', () => {
    for (const lesson of PHYSICS) {
      assert.notDeepEqual(DECKS.lesson!(lesson, true, approveAll), DECKS.lesson!(lesson, true, none), lesson.id);
    }
  });

  it('with no note, a figure slide is today\'s: citation twice, no teacher block', () => {
    for (const lesson of PHYSICS) {
      for (const [kind, build] of Object.entries(DECKS)) {
        for (const s of build(lesson, true, none).slides.filter(x => x.type === 'media' && x.mediaUrl?.startsWith('fig://'))) {
          assert.equal(s.content, s.mediaCaption, `${lesson.id} ${kind}`);
          assert.equal('teacher' in s, false, `${lesson.id} ${kind}`);
        }
      }
    }
  });
});
