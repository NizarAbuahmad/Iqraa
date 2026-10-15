/**
 * The offline lesson plan for a unit, a semester or the whole book: one
 * revision session (spec 2026-10-14-wide-scope-teaching-tools-design.md §1).
 *
 * Pinned: every field of the plan is there for every style × language; the
 * main activity is one round per unit in each style; the introduction states
 * the scope and what is left out; the Arabic teacher fields are first person,
 * future (the same detector `lessonPlanTeacherVoice.test.ts` uses); and the
 * scope's label is never spliced into a lesson-shaped sentence. On the
 * generator: only a request WITH a scope takes this path.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '../ai/generators.ts';
import type { AIRequest, LessonPlanOutput } from '../ai/AIService.ts';
import { LESSON_STYLE_IDS } from '../ai/lessonPlanBlueprints.ts';
import { buildRevisionPlan, revisionPlanFromRequest, ROUND_MARK_AR, ROUND_MARK_EN } from '../ai/lessonPlanRevision.ts';
import { leftOutSentence, revisionPhrase, revisionUnits, REVISION_SHOWN_PER_UNIT, type RevisionUnit } from '../revisionScope.ts';
import { scopeLabel, unitsInScope, type ScopeSelection } from '../scopeSelection.ts';
import { buildScopeRequest } from '../wideScopeRequest.ts';
import { FIRST_PERSON, imperativesIn, norm } from './teacherVoiceCheck.ts';

(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const G = 'grade-10';
const sem1: ScopeSelection = { kind: 'semester', gradeId: G, subjectId: 'mathematics', semester: 1 };
const sem2: ScopeSelection = { kind: 'semester', gradeId: G, subjectId: 'mathematics', semester: 2 };
const book: ScopeSelection = { kind: 'book', gradeId: G, subjectId: 'mathematics' };
const chemBook: ScopeSelection = { kind: 'book', gradeId: G, subjectId: 'chemistry' };
// The vectors unit has three lessons: it fits one session, nothing is left out.
const vectors: ScopeSelection = { kind: 'unit', gradeId: G, subjectId: 'mathematics', unitId: unitsInScope(sem2)[2]!.id };
const SCOPES = [sem1, sem2, book, chemBook, vectors];
const LANGS = ['ar', 'en'] as const;

/** Every text field of `LessonPlanOutput` a plan must fill. */
const TEXT_FIELDS = [
  'introduction', 'mainActivity', 'guidedPractice', 'independentPractice',
  'closure', 'assessment', 'differentiation', 'homework',
] as const;
/** The fields the teacher acts in (homework is the students'). Same list as lessonPlanTeacherVoice.test.ts, minus priorReview. */
const TEACHER_FIELDS = TEXT_FIELDS.filter(f => f !== 'homework');

const plan = (sel: ScopeSelection, lang: 'ar' | 'en', style: string) =>
  buildRevisionPlan({ units: revisionUnits(sel, lang), phrase: revisionPhrase(sel, lang), lang, style, duration: 45 });

const roundsIn = (text: string, lang: 'ar' | 'en') =>
  (text.match(new RegExp(`^${lang === 'ar' ? ROUND_MARK_AR : ROUND_MARK_EN} \\d+ — `, 'gm')) ?? []).length;

describe('buildRevisionPlan', () => {
  for (const lang of LANGS) {
    for (const style of LESSON_STYLE_IDS) {
      it(`${lang} · ${style}: every field is filled, for every scope`, () => {
        for (const sel of SCOPES) {
          const p = plan(sel, lang, style);
          for (const f of TEXT_FIELDS) assert.ok(p[f].trim().length > 0, `${f} empty`);
          assert.ok(p.objectives.length > 0 && p.objectives.every(o => o.trim()), 'objectives');
          assert.ok(p.materials.length > 0 && p.materials.every(m => m.trim()), 'materials');
        }
      });

      it(`${lang} · ${style}: one round per unit, each naming its unit`, () => {
        for (const sel of SCOPES) {
          const units = revisionUnits(sel, lang);
          const p = plan(sel, lang, style);
          assert.equal(roundsIn(p.mainActivity, lang), units.length, p.mainActivity);
          units.forEach((u, i) => {
            const mark = `${lang === 'ar' ? ROUND_MARK_AR : ROUND_MARK_EN} ${i + 1} — ${lang === 'ar' ? `«${u.title}»` : `“${u.title}”`}`;
            assert.ok(p.mainActivity.includes(mark), `round ${i + 1} is not «${u.title}»`);
          });
        }
      });

      it(`${lang} · ${style}: the introduction states the scope and, when anything is cut, what`, () => {
        for (const sel of SCOPES) {
          const units = revisionUnits(sel, lang);
          const p = plan(sel, lang, style);
          assert.ok(p.introduction.includes(revisionPhrase(sel, lang)), p.introduction);
          const left = leftOutSentence(units, REVISION_SHOWN_PER_UNIT, lang);
          if (left) assert.ok(p.introduction.includes(left), `left-out sentence missing: ${p.introduction}`);
        }
        assert.equal(leftOutSentence(revisionUnits(vectors, lang), REVISION_SHOWN_PER_UNIT, lang), '', 'probe: vectors fits');
        assert.ok(leftOutSentence(revisionUnits(book, lang), REVISION_SHOWN_PER_UNIT, lang), 'probe: the book does not fit');
      });

      it(`${lang} · ${style}: the scope label is never spliced into a lesson-shaped sentence`, () => {
        for (const sel of SCOPES) {
          const p = plan(sel, lang, style);
          const all = [...TEXT_FIELDS.map(f => p[f]), ...p.objectives, ...p.materials].join('\n');
          assert.ok(!all.includes('المفهوم الرئيسي'), 'lesson-shaped «المفهوم الرئيسي»');
          assert.ok(!/key concept of/i.test(all), 'lesson-shaped "key concept of"');
          // A unit's label is its title, which the rounds name on purpose; a semester or book label must never appear.
          if (sel.kind !== 'unit') assert.ok(!all.includes(scopeLabel(sel, lang)), `label «${scopeLabel(sel, lang)}» spliced in`);
        }
      });
    }
  }

  for (const style of LESSON_STYLE_IDS) {
    it(`ar · ${style}: the teacher fields are first person, future`, () => {
      for (const sel of SCOPES) {
        const p = plan(sel, 'ar', style);
        for (const f of TEACHER_FIELDS) {
          assert.deepEqual(imperativesIn(p[f]), [], `${f} addresses the teacher in the imperative:\n${p[f]}`);
        }
        for (const f of ['mainActivity', 'guidedPractice', 'closure', 'assessment'] as const) {
          assert.match(norm(p[f]), FIRST_PERSON, `${f} never says «سأ…»:\n${p[f]}`);
        }
      }
    });
  }

  it('the three styles build three different main activities, in both languages', () => {
    for (const lang of LANGS) {
      const mains = LESSON_STYLE_IDS.map(s => plan(sem1, lang, s).mainActivity);
      assert.equal(new Set(mains).size, LESSON_STYLE_IDS.length, lang);
    }
  });

  it('an unknown style is read as direct', () => {
    assert.deepEqual(plan(sem1, 'ar', 'lecture'), plan(sem1, 'ar', 'direct'));
  });

  it('a unit with no outcomes, concepts or terms (outside the MVP set) still gets a full plan', () => {
    const bare: RevisionUnit = {
      unitId: 'bare', title: 'وحدة بلا بيانات', lessons: [{ id: 'l1', title: 'درس أ', thin: true }, { id: 'l2', title: 'درس ب', thin: true }],
      outcomes: [], concepts: [], terms: [],
    };
    for (const lang of LANGS) {
      const t = lang === 'ar' ? 'وحدة بلا بيانات' : 'Bare unit';
      for (const style of LESSON_STYLE_IDS) {
        const p = buildRevisionPlan({ units: [{ ...bare, title: t }], phrase: 'p', lang, style, duration: 45 });
        for (const f of TEXT_FIELDS) assert.ok(p[f].trim().length > 0, `${f} empty`);
        assert.equal(p.objectives.length, 1);
        assert.ok(p.objectives[0]!.includes(t));
        assert.ok(!/undefined|NaN/.test(JSON.stringify(p)));
        assert.equal(roundsIn(p.mainActivity, lang), 1);
      }
    }
    // And no units at all must not throw or divide by zero.
    assert.doesNotThrow(() => buildRevisionPlan({ units: [], phrase: 'p', lang: 'ar', style: 'direct', duration: 45 }));
  });

  it('the teacher\'s own objectives are used verbatim; otherwise every unit has one', () => {
    const units = revisionUnits(book, 'ar');
    const own = buildRevisionPlan({ units, phrase: 'x', lang: 'ar', style: 'direct', duration: 45, customObjectives: 'هدف أ\n\nهدف ب' });
    assert.deepEqual(own.objectives, ['هدف أ', 'هدف ب']);
    const auto = plan(book, 'ar', 'direct');
    for (const u of units) assert.ok(auto.objectives.some(o => o.startsWith(`${u.title}: `)), `${u.title} has no objective`);
  });
});

const base = { grade: 'الصف العاشر', subject: 'Mathematics', language: 'arabic', duration: 45, teachingStyle: 'inquiry' } as const;
const wideReq = (sel: ScopeSelection, extra: Partial<AIRequest> = {}): AIRequest => ({
  ...base, topic: scopeLabel(sel, 'ar'), ...extra, ...buildScopeRequest(sel, 'ar')!.fields,
} as AIRequest);

describe('generateLessonPlan — the wide branch', () => {
  it('a request with a scope gets the revision plan, built from its lesson table', async () => {
    const out = await aiService.generateLessonPlan(wideReq(sem1));
    assert.equal(roundsIn(out.mainActivity, 'ar'), revisionUnits(sem1, 'ar').length);
    assert.equal(out.title, 'موضوعات الفصل الأول – خطة حصة مراجعة');
    assert.equal(out.duration, 45);
  });

  it('never produces a prior-knowledge review, whatever the request asks', async () => {
    const out = await aiService.generateLessonPlan(wideReq(sem1, {
      includePriorReview: true, priorKnowledge: ['مفهوم سابق'], priorTopicsNotes: 'أعد شرح الكسور',
    }));
    assert.equal('priorReview' in out, false);
  });

  it('without a lesson table it rebuilds the units from the scope key', async () => {
    const { coverage: _c, ...noTable } = wideReq(sem2);
    const out = await aiService.generateLessonPlan(noTable as AIRequest);
    assert.equal(roundsIn(out.mainActivity, 'ar'), revisionUnits(sem2, 'ar').length);
  });

  it('refuses a scope it cannot read rather than plan about nothing', () => {
    const req = { ...base, topic: 'x', scope: { kind: 'unit', scopeKey: 'unit:gone', unitIds: [] } } as AIRequest;
    assert.throws(() => revisionPlanFromRequest(req), /lessons of its scope/);
  });

  it('a request with NO scope never takes the wide branch, even with a lesson table attached', async () => {
    const { scope: _s, ...noScope } = wideReq(sem1);
    const lessonPlan = await aiService.generateLessonPlan(noScope as AIRequest);
    assert.equal(roundsIn(lessonPlan.mainActivity, 'ar'), 0, 'a lesson request was built as a revision');
    assert.ok(lessonPlan.title.endsWith('– خطة درس'), lessonPlan.title);
  });

  it('an offline Regenerate says honestly that the revision plan could not change', async () => {
    const req = wideReq(vectors);
    await aiService.generateLessonPlan(req);
    const again = await aiService.generateLessonPlan({ ...req, regenerate: true });
    assert.deepEqual(again.repeated, { count: 8, of: 8 });
  });
});
