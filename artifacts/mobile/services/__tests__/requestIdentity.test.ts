import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requestIdentity } from '../ai/generators.ts';
import { buildCoverage } from '../coveragePlan.ts';
import type { ScopeSelection } from '../scopeSelection.ts';

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const wide = (offset: number) => ({
  topic: 'الفصل الأول كاملًا', numQuestions: 12, coverage: buildCoverage(sem1, 'ar', 12, 'balanced', { offset }),
});

describe('requestIdentity', () => {
  it('two wide requests that differ only in the slot plan are the same request', () => {
    const a = wide(0);
    const b = wide(7);
    assert.notDeepEqual(a.coverage.slots, b.coverage.slots, 'precondition: the offset changes the plan');
    assert.equal(requestIdentity('quiz', a), requestIdentity('quiz', b));
  });

  it('a different lesson table or topic is a different request', () => {
    const a = wide(0);
    const fewer = { ...a, coverage: { ...a.coverage, lessons: a.coverage.lessons.slice(1) } };
    assert.notEqual(requestIdentity('quiz', a), requestIdentity('quiz', fewer));
    assert.notEqual(requestIdentity('quiz', a), requestIdentity('quiz', { ...a, topic: 'x' }));
    assert.notEqual(requestIdentity('quiz', a), requestIdentity('worksheet', a));
  });

  it('a request without coverage keeps its identity: regenerate/avoid are ignored, the rest is kept', () => {
    const req = { topic: 't', numQuestions: 5 };
    assert.equal(requestIdentity('quiz', req), `quiz|${JSON.stringify(req)}`);
    assert.equal(requestIdentity('quiz', { ...req, regenerate: true, avoid: ['a'], excludeVariantIds: ['v'] }), requestIdentity('quiz', req));
  });
});
