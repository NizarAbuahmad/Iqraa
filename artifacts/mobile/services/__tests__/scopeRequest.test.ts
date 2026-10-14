import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scopeRequestFields } from '../generatorRequests.ts';
import { resolveScopeGrounding } from '../scopeGrounding.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../knowledgeBase.ts';

const G = 'grade-10';

describe('scopeRequestFields', () => {
  it('a wide scope sends the digest as curriculum context, plus its key and NCCD units', () => {
    const g = resolveScopeGrounding({ kind: 'semester', gradeId: G, subjectId: 'mathematics', semester: 1 }, 'ar');
    const f = scopeRequestFields(g);
    assert.deepEqual(f.scope, { kind: 'semester', scopeKey: g.scopeKey, unitIds: g.unitIds });
    assert.equal(f.additionalContext, g.context);
    assert.equal(f.contextSource, 'curriculum');
  });

  it('an ungrounded wide scope sends the honest note and no scope', () => {
    const g = resolveScopeGrounding({ kind: 'unit', gradeId: G, subjectId: 'mathematics', unitId: 'no-such-unit' }, 'ar');
    const f = scopeRequestFields(g);
    assert.equal(f.scope, undefined);
    assert.equal(f.additionalContext, g.ungroundedNote);
    assert.equal(f.contextSource, 'curriculum');
  });

  it('a single lesson adds nothing — the request stays exactly what it is today', () => {
    const lesson = getLessonsForUnit(getUnitsForSubjectGrade('mathematics', G)[0]!.id)[0]!;
    const g = resolveScopeGrounding({ kind: 'lesson', gradeId: G, subjectId: 'mathematics', lessonId: lesson.id }, 'ar');
    assert.deepEqual(scopeRequestFields(g), {});
  });
});
