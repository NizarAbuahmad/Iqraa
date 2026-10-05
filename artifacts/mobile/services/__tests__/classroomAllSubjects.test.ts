/**
 * The offline classroom activity must be about the lesson it was asked for.
 *
 * `generateClassroomActivity` used to be ~700 lines of fixed templates, and the
 * templates were maths: the escape challenge for ANY topic was a quadratics
 * escape room set in «the Math Lab», the error detective's cases were
 * quadratic misconceptions, and relay/bingo for a subject with no bank were
 * «Term 1 … Term 8» placeholders.
 *
 * What the lesson data can honestly support, measured over the real catalog
 * (grade 10): maths and chemistry have a question bank (answers computed or
 * reviewed); every other subject has key-term NAMES and official objectives,
 * but almost never a definition (0 of 72 biology terms). So for those subjects
 * a format is built from the lesson's own terms/objectives and the answer is
 * checked by the TEACHER against the textbook — never an invented key. The two
 * formats that cannot be built without content refuse, like the worksheet does.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService, NoQuestionBankError } from '../ai/generators.ts';
import type { ClassroomActivity, ClassroomActivityRequest } from '../ai/AIService.ts';
import { KB_LESSONS, getBookForLesson, type KBLesson } from '../knowledgeBase.ts';

const service = new MockAIService();
(service as unknown as { delay: () => Promise<void> }).delay = async () => {};

type Fmt =
  | 'escape-challenge' | 'error-detective' | 'relay' | 'bingo'
  | 'gallery-walk' | 'exit-ticket' | 'quick-check';
const FORMATS: Fmt[] = [
  'escape-challenge', 'error-detective', 'relay', 'bingo',
  'gallery-walk', 'exit-ticket', 'quick-check',
];
/** Formats that need answerable content; the rest are open and never refuse. */
const NEEDS_CONTENT: Fmt[] = ['error-detective', 'bingo'];

const lessonsOf = (subjectId: string, gradeId = 'grade-10'): KBLesson[] =>
  KB_LESSONS.filter(l => {
    const b = getBookForLesson(l);
    return b?.subjectId === subjectId && b.gradeId === gradeId;
  });

const MATHS_LEAK =
  /x²|س²|Math Lab|مختبر الرياضيات|quadratic|تربيع|equation|معادلة|المميّز|discriminant/i;

const SUBJECT_NAME: Record<string, string> = {
  biology: 'Biology', history: 'History', arabic: 'Arabic',
  english: 'English', geography: 'Geography',
};

function req(
  lesson: KBLesson, subjectId: string, activityType: Fmt,
  language: 'arabic' | 'english', extra: Partial<ClassroomActivityRequest> = {},
): ClassroomActivityRequest {
  return {
    grade: '10',
    subject: SUBJECT_NAME[subjectId] ?? subjectId,
    topic: language === 'arabic' ? lesson.titleAr : lesson.titleEn || lesson.titleAr,
    lessonId: lesson.id,
    activityType,
    duration: 20,
    difficulty: 'standard',
    groupType: 'groups',
    teachingGoal: 'practice',
    language,
    ...extra,
  };
}

const blob = (a: ClassroomActivity) => JSON.stringify(a);
const slideText = (a: ClassroomActivity) =>
  a.slides.map(s => [s.title, s.content, s.hint, s.answer].filter(Boolean).join('\n')).join('\n');

// A lesson with several named terms AND objectives (biology), and one with only
// objectives (Arabic language), and one with nothing but a summary (grade 9 English).
const bio = lessonsOf('biology').find(l => l.keyTerms.length >= 6 && l.objectives.length >= 2)!;
const hist = lessonsOf('history').find(l => l.keyTerms.length >= 6)!;
const arabic = lessonsOf('arabic').find(l => l.objectives.length >= 2)!;
const bare = lessonsOf('english', 'grade-9')[0]!;

const SUBJECT_CASES: Array<[string, string, KBLesson]> = [
  ['biology', 'biology', bio],
  ['history', 'history', hist],
  ['Arabic language', 'arabic', arabic],
  ['a lesson with no material but a title', 'english', bare],
];

describe('fixtures are what the tests assume', () => {
  it('the lessons exist and none of them is secretly about maths', () => {
    for (const l of [bio, hist, arabic, bare]) {
      assert.ok(l, 'a fixture lesson is missing from the catalog');
      assert.doesNotMatch(
        `${l.titleAr} ${l.titleEn} ${l.objectives.join(' ')} ${l.keyTerms.map(t => t.ar).join(' ')}`,
        MATHS_LEAK,
        `${l.id} reads like maths — pick another fixture`,
      );
    }
  });
});

describe('no format serves another subject its maths', () => {
  for (const [label, subjectId, lesson] of SUBJECT_CASES) {
    for (const language of ['arabic', 'english'] as const) {
      for (const fmt of FORMATS) {
        it(`${label} · ${fmt} · ${language}`, async () => {
          let act: ClassroomActivity;
          try {
            act = await service.generateClassroomActivity(req(lesson, subjectId, fmt, language));
          } catch (e) {
            // A refusal is not a leak; whether it is allowed is asserted below.
            assert.ok(e instanceof NoQuestionBankError, `threw ${String(e)}`);
            return;
          }
          assert.doesNotMatch(blob(act), MATHS_LEAK, `${fmt} leaked maths into ${label}`);
        });
      }
    }
  }
});

describe('which formats refuse, and which never do', () => {
  it('open formats always produce something, even with only a title to go on', async () => {
    for (const fmt of ['gallery-walk', 'exit-ticket', 'quick-check', 'escape-challenge', 'relay'] as Fmt[]) {
      for (const [, subjectId, lesson] of SUBJECT_CASES) {
        const act = await service.generateClassroomActivity(req(lesson, subjectId, fmt, 'arabic'));
        assert.ok(act.slides.length >= 3, `${fmt} gave ${act.slides.length} slides for ${lesson.id}`);
      }
    }
  });

  it('the error detective refuses outside maths and chemistry — it has no wrong work to show', async () => {
    for (const [, subjectId, lesson] of SUBJECT_CASES) {
      await assert.rejects(
        service.generateClassroomActivity(req(lesson, subjectId, 'error-detective', 'arabic')),
        (e: unknown) => e instanceof NoQuestionBankError && e.code === 'no_question_bank',
      );
    }
  });

  it('bingo is built from the lesson’s term names, and refuses when there are fewer than four', async () => {
    const act = await service.generateClassroomActivity(req(bio, 'biology', 'bingo', 'arabic'));
    const calls = act.slides.filter(s => s.type === 'bingo-call');
    assert.ok(calls.length >= 4, `only ${calls.length} bingo calls`);
    const names = new Set(bio.keyTerms.map(t => t.ar));
    for (const c of calls) {
      assert.ok(names.has(c.answer ?? ''), `call answer «${c.answer}» is not one of the lesson's terms`);
    }
    await assert.rejects(
      service.generateClassroomActivity(req(bare, 'english', 'bingo', 'arabic')),
      (e: unknown) => e instanceof NoQuestionBankError,
    );
  });
});

describe('the activity is about the lesson that was picked', () => {
  for (const fmt of ['escape-challenge', 'relay', 'gallery-walk', 'exit-ticket', 'bingo'] as Fmt[]) {
    it(`${fmt} (biology, Arabic) uses the lesson’s own terms or objectives`, async () => {
      const act = await service.generateClassroomActivity(req(bio, 'biology', fmt, 'arabic'));
      const text = slideText(act) + '\n' + act.answerKey.join('\n');
      const own = [...bio.keyTerms.map(t => t.ar), ...bio.objectives];
      assert.ok(
        own.some(s => text.includes(s)),
        `${fmt} mentions none of «${bio.titleAr}»'s own terms or objectives:\n${text.slice(0, 600)}`,
      );
    });
  }

  it('English output names the terms in English, not Arabic', async () => {
    const act = await service.generateClassroomActivity(req(bio, 'biology', 'escape-challenge', 'english'));
    const names = bio.keyTerms.map(t => t.en).filter(Boolean);
    assert.ok(names.some(n => slideText(act).includes(n)), 'no English term appears');
  });
});

describe('an unchecked answer is never presented as checked', () => {
  it('teacher-checked content carries no verification claim and says who checks it', async () => {
    for (const fmt of ['escape-challenge', 'relay', 'bingo'] as Fmt[]) {
      const act = await service.generateClassroomActivity(req(bio, 'biology', fmt, 'arabic'));
      assert.doesNotMatch(blob(act), /"verified":true|"verifiedBy"|symbolic/, `${fmt} claims verification`);
    }
    const esc = await service.generateClassroomActivity(req(bio, 'biology', 'escape-challenge', 'arabic'));
    assert.match(esc.answerKey.join('\n'), /كتاب الطالب/, 'the key does not say it is checked against the textbook');
  });
});

describe('escape challenge structure', () => {
  it('every challenge is followed by a reveal of the same code, and the summary lists them all', async () => {
    const act = await service.generateClassroomActivity(req(bio, 'biology', 'escape-challenge', 'arabic'));
    const challenges = act.slides.filter(s => s.type === 'challenge');
    assert.ok(challenges.length >= 3, `only ${challenges.length} challenges`);
    for (const ch of challenges) {
      const next = act.slides[ch.slideNumber]; // slideNumber is 1-based, so this is the next slide
      assert.equal(next?.type, 'reveal');
      assert.ok(ch.unlockCode, 'a challenge has no unlock code');
      assert.equal(next?.unlockCode, ch.unlockCode);
    }
    const summary = act.slides[act.slides.length - 1]!;
    assert.equal(summary.type, 'summary');
    for (const ch of challenges) assert.ok(summary.content.includes(ch.unlockCode!), 'summary omits a code');
    assert.equal(act.slides.every((s, i) => s.slideNumber === i + 1), true);
  });
});

describe('maths and chemistry are built from their bank, whatever the lesson', () => {
  const trig = KB_LESSONS.find(l => l.titleAr === 'النسب المثلثية' && getBookForLesson(l)?.gradeId === 'grade-10')!;
  const mathsReq = (fmt: Fmt, extra: Partial<ClassroomActivityRequest> = {}) =>
    ({ ...req(trig, 'mathematics', fmt, 'arabic'), subject: 'Mathematics', ...extra });

  it('a trigonometry escape challenge is not the quadratics escape room', async () => {
    const act = await service.generateClassroomActivity(mathsReq('escape-challenge'));
    const text = slideText(act);
    assert.doesNotMatch(text, /س²\s*\+\s*7س|مختبر الرياضيات|x²\s*\+\s*7x/, 'the fixed quadratics room is back');
    const challenges = act.slides.filter(s => s.type === 'challenge');
    assert.ok(challenges.length >= 3);
    for (const ch of challenges) assert.ok(ch.answer, 'a bank challenge has no answer');
  });

  it('a trigonometry error detective shows a bank question with a real wrong answer', async () => {
    const act = await service.generateClassroomActivity(mathsReq('error-detective'));
    const cases = act.slides.filter(s => s.type === 'challenge');
    assert.ok(cases.length >= 2, `only ${cases.length} cases`);
    assert.doesNotMatch(slideText(act), /الجذر السالب|القسمة على المتغير|x² − 9|س² - 9/);
    for (const c of cases) {
      const reveal = act.slides[c.slideNumber]!;
      assert.equal(reveal.type, 'reveal');
      assert.ok(c.answer, 'a case has no correct answer');
      assert.ok(reveal.content.includes(c.answer), 'the reveal does not show the correct answer');
    }
  });

  it('a chemistry error detective and escape challenge use chemistry, not algebra', async () => {
    for (const fmt of ['error-detective', 'escape-challenge'] as Fmt[]) {
      const act = await service.generateClassroomActivity({
        grade: '10', subject: 'Chemistry', topic: 'التوزيع الإلكتروني للذرات',
        activityType: fmt, duration: 20, difficulty: 'standard', groupType: 'groups',
        teachingGoal: 'practice', language: 'arabic',
      } as ClassroomActivityRequest);
      assert.doesNotMatch(slideText(act), /س²\s*\+\s*7س|مختبر الرياضيات|الجذر السالب/, fmt);
      assert.ok(act.slides.filter(s => s.type === 'challenge').length >= 2, `${fmt} has no challenges`);
    }
  });

  it('a maths lesson with no bank is not served default algebra', async () => {
    const noBank = KB_LESSONS.find(l => l.titleAr === 'أوتار الدائرة وأقطارها ومماساتها')!;
    const r = { ...req(noBank, 'mathematics', 'escape-challenge', 'arabic'), subject: 'Mathematics' };
    const act = await service.generateClassroomActivity(r);
    assert.doesNotMatch(slideText(act), /س²\s*\+\s*7س|مختبر الرياضيات/);
    assert.ok(slideText(act).includes('أوتار'), 'not about the picked lesson');
    await assert.rejects(
      service.generateClassroomActivity({ ...r, activityType: 'error-detective' }),
      (e: unknown) => e instanceof NoQuestionBankError,
    );
  });
});

describe('Regenerate gives a different activity', () => {
  for (const fmt of ['escape-challenge', 'relay', 'gallery-walk', 'exit-ticket', 'bingo'] as Fmt[]) {
    it(`${fmt}: 10 regenerations in a row, none equal to the one before`, async () => {
      const base = req(bio, 'biology', fmt, 'arabic');
      let prev = await service.generateClassroomActivity({ ...base });
      for (let i = 0; i < 10; i++) {
        const next = await service.generateClassroomActivity({ ...base, regenerate: true });
        assert.notEqual(blob(next), blob(prev), `regeneration ${i + 1} repeated the previous activity`);
        prev = next;
      }
    });
  }

  it('a plain request starts over at the first version', async () => {
    const base = req(bio, 'biology', 'escape-challenge', 'arabic');
    const first = await service.generateClassroomActivity({ ...base });
    await service.generateClassroomActivity({ ...base, regenerate: true });
    const again = await service.generateClassroomActivity({ ...base });
    assert.equal(blob(again), blob(first));
  });
});
