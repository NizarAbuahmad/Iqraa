/**
 * One revision session, two builders (CLAUDE.md: "two places move together").
 *
 * The offline plan (`lessonPlanRevision.ts`) runs a round per unit over the
 * units it rebuilds from the request's lesson table; the live prompt
 * (`revisionClauseAr/En(b, 'plan')`) lists the same table and points the model
 * at the digest's «الوحدة:» headings for its rounds. For the same request they
 * must agree on which lessons are in scope and how many units there are.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AIRequest } from '../ai/AIService.ts';
import { revisionPlanFromRequest, ROUND_MARK_AR, ROUND_MARK_EN } from '../ai/lessonPlanRevision.ts';
import { revisionUnitsFromLessons } from '../revisionScope.ts';
import { buildScopeRequest } from '../wideScopeRequest.ts';
import type { ScopeSelection } from '../scopeSelection.ts';
import { lessonPlanPromptAr, lessonPlanPromptEn } from '../../../api-server/src/lib/prompts.ts';
import { revisionClauseAr, revisionClauseEn } from '../../../api-server/src/lib/revision.ts';

const G = 'grade-10';
const SCOPES: ScopeSelection[] = [
  { kind: 'semester', gradeId: G, subjectId: 'mathematics', semester: 1 },
  { kind: 'book', gradeId: G, subjectId: 'mathematics' },
  { kind: 'book', gradeId: G, subjectId: 'chemistry' },
];

for (const lang of ['ar', 'en'] as const) {
  describe(`offline plan and live prompt agree (${lang})`, () => {
    for (const sel of SCOPES) {
      it(`${sel.kind}:${sel.subjectId}`, () => {
        const req = {
          grade: 'Grade 10', subject: sel.subjectId === 'chemistry' ? 'Chemistry' : 'Mathematics', topic: 'label',
          language: lang === 'ar' ? 'arabic' : 'english', duration: 45, teachingStyle: 'direct',
          ...buildScopeRequest(sel, lang)!.fields,
        } as AIRequest;
        const prompt = (lang === 'ar' ? lessonPlanPromptAr : lessonPlanPromptEn)(req as unknown as Record<string, unknown>);
        const clause = (lang === 'ar' ? revisionClauseAr : revisionClauseEn)(req as unknown as Record<string, unknown>, 'plan');
        assert.ok(clause && prompt.includes(clause), 'the live plan prompt carries no revision clause');
        const units = revisionUnitsFromLessons(req.coverage!.lessons.map(l => l.id), lang);
        // Every lesson the offline plan draws on is listed by the live clause itself (not only by the digest).
        for (const u of units) for (const l of u.lessons) assert.ok(clause.includes(`- ${l.title}`), `live clause lacks «${l.title}»`);
        // The live prompt's unit headings (from the digest) are the offline plan's rounds.
        const headings = (prompt.match(new RegExp(`^${lang === 'ar' ? 'الوحدة' : 'Unit'}: `, 'gm')) ?? []).length;
        const plan = revisionPlanFromRequest(req);
        const rounds = (plan.mainActivity.match(new RegExp(`^${lang === 'ar' ? ROUND_MARK_AR : ROUND_MARK_EN} \\d+ — `, 'gm')) ?? []).length;
        assert.equal(rounds, units.length);
        assert.equal(headings, units.length, 'the digest names a different number of units than the offline plan rounds');
      });
    }
  });
}
