/**
 * A lesson plan has a second wording for the sections that used to be fixed.
 *
 * Five of a plan's eight narrative sections (main activity, guided and
 * independent practice, assessment, differentiation) came from ONE blueprint
 * per teaching style and kind of lesson, so «أعد التجهيز» could never change
 * them (see `lessonPlanRegenerateStems.test.ts`). Each Arabic blueprint now has
 * a "variant 1": the same teaching shape, a different way of doing it.
 *
 * What is pinned:
 *  - variant 0 is exactly what a plan has always been (a first generation
 *    never changes), and English is untouched;
 *  - variant 1 differs from variant 0 in all five fields, for every style and
 *    every kind of lesson;
 *  - variant 1 keeps the style's own contract (the markers `lessonPlanStyle.test.ts`
 *    pins for variant 0) and the teacher's first-person voice;
 *  - regenerating an Arabic plan changes all of it, so nothing is reported as
 *    repeated.
 * Whether the wording is GOOD teaching is not something a test can say: this
 * needs a Jordanian teacher's read before it ships.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '../ai/generators.ts';
import { LESSON_STYLE_IDS, buildLessonStyleBlueprint } from '../ai/lessonPlanBlueprints.ts';
import { lessonKindFor } from '../ai/lessonPlanKinds.ts';
import type { LessonStyleContext } from '../ai/lessonPlanTypes.ts';
import { KB_LESSONS, getBookForLesson } from '../knowledgeBase.ts';
import type { AIRequest, LessonPlanOutput } from '../ai/AIService.ts';
import { FIRST_PERSON, imperativesIn, norm } from './teacherVoiceCheck.ts';

(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const FIVE = ['mainActivity', 'guidedPractice', 'independentPractice', 'assessment', 'differentiation'] as const;

/** One lesson per subject, so every `LessonKind` is covered. */
const lessons = (() => {
  const seen = new Set<string>();
  const out: Array<{ subjectId: string; gradeId: string; id: string; title: string }> = [];
  for (const l of KB_LESSONS) {
    const b = getBookForLesson(l);
    if (!b || seen.has(b.subjectId)) continue;
    seen.add(b.subjectId);
    out.push({ subjectId: b.subjectId, gradeId: b.gradeId, id: l.id, title: l.titleAr });
  }
  return out;
})();

const ctxFor = (l: (typeof lessons)[number], lang: 'ar' | 'en', variant?: number): LessonStyleContext => {
  const kb = KB_LESSONS.find(x => x.id === l.id) ?? null;
  return {
    topic: l.title, kb, lang, subject: l.subjectId, duration: 45,
    kind: lessonKindFor(l.subjectId), subjectId: l.subjectId,
    ...(variant === undefined ? {} : { variant }),
  };
};

describe('variant 0 is what a plan has always been', () => {
  for (const l of lessons) {
    for (const style of LESSON_STYLE_IDS) {
      it(`${l.subjectId} · ${style}: no variant and variant 0 are identical; English ignores the variant`, () => {
        assert.deepEqual(buildLessonStyleBlueprint(style, ctxFor(l, 'ar')), buildLessonStyleBlueprint(style, ctxFor(l, 'ar', 0)));
        assert.deepEqual(buildLessonStyleBlueprint(style, ctxFor(l, 'en', 1)), buildLessonStyleBlueprint(style, ctxFor(l, 'en', 0)));
      });
    }
  }
});

describe('variant 1 is a different way of teaching the same shape', () => {
  for (const l of lessons) {
    for (const style of LESSON_STYLE_IDS) {
      it(`${l.subjectId} · ${style}: all five sections differ from variant 0`, () => {
        const a = buildLessonStyleBlueprint(style, ctxFor(l, 'ar', 0));
        const b = buildLessonStyleBlueprint(style, ctxFor(l, 'ar', 1));
        for (const f of FIVE) assert.notEqual(b[f], a[f], `${l.subjectId}/${style}: ${f} is the same in both variants`);
      });

      it(`${l.subjectId} · ${style}: variant 1 is in the teacher's first-person voice`, () => {
        const b = buildLessonStyleBlueprint(style, ctxFor(l, 'ar', 1));
        for (const f of FIVE) assert.deepEqual(imperativesIn(b[f]), [], `${l.subjectId}/${style} · ${f} addresses the teacher in the imperative:\n${b[f]}`);
        for (const f of ['mainActivity', 'guidedPractice', 'assessment'] as const) {
          assert.match(norm(b[f]), FIRST_PERSON, `${l.subjectId}/${style} · ${f} never says «سأ…»:\n${b[f]}`);
        }
      });

      it(`${l.subjectId} · ${style}: no section is empty or carries an unfilled placeholder`, () => {
        const b = buildLessonStyleBlueprint(style, ctxFor(l, 'ar', 1));
        for (const f of [...FIVE, 'materials'] as const) {
          const text = Array.isArray(b[f]) ? (b[f] as string[]).join('\n') : (b[f] as string);
          assert.ok(text.trim().length > 40, `${l.subjectId}/${style} · ${f} is empty or tiny`);
          assert.doesNotMatch(text, /undefined|\[object|\$\{|NaN/, `${l.subjectId}/${style} · ${f} has a template leak:\n${text}`);
        }
      });
    }
  }

  it('the three styles stay distinct from one another in variant 1', () => {
    const l = lessons.find(x => lessonKindFor(x.subjectId) === 'calc') ?? lessons[0];
    const out = LESSON_STYLE_IDS.map(s => buildLessonStyleBlueprint(s, ctxFor(l, 'ar', 1)));
    for (const f of FIVE) {
      assert.equal(new Set(out.map(o => o[f])).size, LESSON_STYLE_IDS.length, `"${f}" is shared between styles in variant 1`);
    }
  });
});

describe('variant 1 keeps each style’s own contract', () => {
  const maths = lessons.find(x => lessonKindFor(x.subjectId) === 'calc') ?? lessons[0];
  const b = (style: string) => buildLessonStyleBlueprint(style, ctxFor(maths, 'ar', 1));

  it('direct: I-Do / We-Do / You-Do, and the independent stage is individual by design', () => {
    assert.match(b('direct').mainActivity, /أنا أفعل/);
    assert.match(b('direct').guidedPractice, /نحن نفعل/);
    assert.match(b('direct').independentPractice, /أنت تفعل/);
    assert.match(b('direct').independentPractice, /فردي/);
  });

  it('inquiry: a conjecture first, the rule withheld, then a new case', () => {
    assert.match(b('inquiry').mainActivity, /تخمين|تخمّن/);
    assert.match(b('inquiry').guidedPractice, /لن أشرح القاعدة/);
    assert.match(b('inquiry').independentPractice, /حالة جديدة|لم تُناقَش/);
  });

  it('collaborative: task cards, individual accountability, and peer discussion is never banned', () => {
    assert.match(b('collaborative').mainActivity, /بطاقات مهمة|بطاقة/);
    assert.match(b('collaborative').independentPractice, /مساءلة فردية/);
    assert.ok(!/المناقشة بين الطلبة مؤجّلة/.test(JSON.stringify(b('collaborative'))));
  });
});

describe('regenerating an Arabic plan reaches the second wording', () => {
  const PLAN_SECTIONS = [
    'introduction', 'mainActivity', 'guidedPractice', 'independentPractice',
    'closure', 'assessment', 'differentiation', 'homework',
  ] as const;
  const req = (l: (typeof lessons)[number], style: string, extra: Partial<AIRequest> = {}) =>
    ({ grade: l.gradeId, subject: l.subjectId, topic: l.title, lessonId: l.id, language: 'arabic', duration: 45, teachingStyle: style, ...extra }) as AIRequest;
  const sameSections = (a: LessonPlanOutput, c: LessonPlanOutput) => PLAN_SECTIONS.filter(f => a[f] === c[f]);

  for (const l of lessons) {
    for (const style of LESSON_STYLE_IDS) {
      it(`${l.subjectId} · ${style}: every regeneration changes all eight sections`, async () => {
        let prev = await aiService.generateLessonPlan(req(l, style));
        for (let i = 0; i < 10; i++) {
          const next = await aiService.generateLessonPlan(req(l, style, { regenerate: true }));
          assert.deepEqual(sameSections(prev, next), [], `regeneration ${i + 1} kept ${sameSections(prev, next).join(', ')}`);
          assert.equal(next.repeated, undefined, 'nothing is left to report as repeated');
          prev = next;
        }
      });
    }
  }

  it('a first generation is variant 0, never the alternative', async () => {
    const l = lessons[0];
    const first = await aiService.generateLessonPlan(req(l, 'direct'));
    const v0 = buildLessonStyleBlueprint('direct', ctxFor(l, 'ar', 0));
    // The first sentence of the phase identifies it; the full text carries the lesson's own concepts.
    assert.equal(first.mainActivity.split('\n')[0].replace(/\(.*?\)/, ''), v0.mainActivity.split('\n')[0].replace(/\(.*?\)/, ''));
  });
});
