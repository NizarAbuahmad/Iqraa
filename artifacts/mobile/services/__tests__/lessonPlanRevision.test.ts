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


const allText = (p: ReturnType<typeof plan>) =>
  [...TEXT_FIELDS.map(f => p[f]), ...p.objectives, ...p.materials].join('\n');

/**
 * What a label spliced into a lesson-shaped sentence looks like: the lesson template's
 * «المفهوم الرئيسي», its English twin, or a semester / book label appearing at all
 * (a unit's label is its title, which the rounds name on purpose).
 */
function splicedLabel(text: string, sel: ScopeSelection, lang: 'ar' | 'en'): string[] {
  const hits: string[] = [];
  if (text.includes('المفهوم الرئيسي')) hits.push('lesson-shaped «المفهوم الرئيسي»');
  if (/key concept of/i.test(text)) hits.push('lesson-shaped "key concept of"');
  if (sel.kind !== 'unit' && text.includes(scopeLabel(sel, lang))) hits.push(`label «${scopeLabel(sel, lang)}» spliced in`);
  return hits;
}

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
          assert.deepEqual(splicedLabel(allText(p), sel, lang), []);
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
      for (const sel of [sem1, vectors]) {
        const mains = LESSON_STYLE_IDS.map(s => plan(sel, lang, s).mainActivity);
        assert.equal(new Set(mains).size, LESSON_STYLE_IDS.length, `${lang} ${sel.kind}`);
      }
    }
  });

  it('the splice detector itself bites: each way of splicing a label is reported', () => {
    for (const lang of LANGS) {
      for (const sel of [sem1, book]) {
        const label = scopeLabel(sel, lang);
        assert.equal(splicedLabel(`${plan(sel, lang, 'direct').introduction} ${label}`, sel, lang).length, 1, 'label');
      }
    }
    assert.equal(splicedLabel('المفهوم الرئيسي في الفصل', sem1, 'ar').length, 1);
    assert.equal(splicedLabel('The key concept of the book', book, 'en').length, 1);
    assert.deepEqual(splicedLabel('كلام عادي', sem1, 'ar'), []);
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

/** The guiding question of each round of an inquiry plan, read from the rendered text. */
const guidingQuestionsIn = (text: string, lang: 'ar' | 'en') =>
  [...text.matchAll(lang === 'ar' ? /بالقاعدة: «(.+?)» ثم يكتب/g : /restating the rule — "(.+?)" — and each trio/g)].map(m => m[1]!);

describe('the inquiry guiding question', () => {
  const wide = [sem1, sem2, chemBook, book];
  for (const lang of LANGS) {
    it(`${lang}: for every unit of Grade 10 maths and chemistry it names the unit and carries no KB fragment`, () => {
      let seen = 0;
      for (const sel of wide) {
        const units = revisionUnits(sel, lang);
        const qs = guidingQuestionsIn(plan(sel, lang, 'inquiry').mainActivity, lang);
        assert.equal(qs.length, units.length, `${sel.kind}:${sel.subjectId}`);
        units.forEach((u, i) => {
          const q = qs[i]!;
          assert.ok(q.includes(u.title), `«${q}» does not name «${u.title}»`);
          // The title is the unit's own and may carry punctuation; what must be absent is a spliced KB fragment.
          const rest = q.split(u.title).join('');
          for (const ch of [':', '=', '(', '²']) assert.ok(!rest.includes(ch), `«${q}» carries «${ch}» (a definition fragment)`);
          assert.match(rest.trim(), /[?؟]$/, q);
          seen++;
        });
      }
      assert.ok(seen >= 13, `only ${seen} units read`);
    });
  }
});

/** Phrases that only make sense with several units. */
const MULTI_UNIT = {
  ar: ['لكل وحدة', 'كل وحدة', 'من كل وحدة', 'الوحدات', 'وحدتين', 'وحدتها', 'وحدة غير', 'وحدة مجموعته', 'بطاقة وحدة', 'بطاقات الوحدات'],
  en: ['each unit', 'every unit', 'per unit', 'units', 'a unit other', 'unit card', 'two units', 'its unit'],
} as const;

describe('a one-unit scope never talks as if there were several', () => {
  for (const lang of LANGS) {
    for (const style of LESSON_STYLE_IDS) {
      it(`${lang} · ${style}`, () => {
        const units = revisionUnits(vectors, lang);
        assert.equal(units.length, 1, 'probe: one unit');
        const p = plan(vectors, lang, style);
        // The unit's own title may contain any word; the plan's wording may not.
        const text = [...TEXT_FIELDS.map(f => p[f]), ...p.objectives, ...p.materials].join('\n').split(units[0]!.title).join('«T»');
        for (const phrase of MULTI_UNIT[lang]) assert.ok(!text.includes(phrase), `«${phrase}» in a one-unit plan:\n${text}`);
        // One round, and it does not echo the section heading's minutes.
        const round = p.mainActivity.split('\n').find(l => l.startsWith(lang === 'ar' ? ROUND_MARK_AR : ROUND_MARK_EN))!;
        assert.ok(!/\(\d+ |\(.*(دقيقة|دقائق)/.test(round.split(': ')[0]!), round);
      });
    }
  }

  it('a several-unit scope keeps the per-unit wording (the branch is not always taken)', () => {
    assert.match(plan(sem1, 'ar', 'collaborative').independentPractice, /وحدة غير وحدة مجموعته/);
    assert.match(plan(sem1, 'en', 'collaborative').independentPractice, /a unit other than their group's/);
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
    // Independent of `revisionUnits`: the rounds name the semester's units as the scope table lists them.
    const expected = unitsInScope(sem2).map(u => u.titleAr);
    assert.ok(expected.length >= 3, 'probe');
    const named = [...out.mainActivity.matchAll(/^الجولة \d+ — «(.+?)»/gm)].map(m => m[1]);
    assert.deepEqual(named, expected);
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
