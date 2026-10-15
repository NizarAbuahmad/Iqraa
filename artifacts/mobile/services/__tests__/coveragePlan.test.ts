/**
 * Which lesson each question slot belongs to.
 *
 * `planCoverage` is pure: the offline generators and the live prompt both read
 * it, so these tests are the contract between the two. Maths grade 10 is used
 * for the real-scope cases; they are derived from the KB, not from lesson ids.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCoverage, coverageLessons, coverageSummary, lessonIdsFromTags, planCoverage, type PoolLesson,
} from '../coveragePlan.ts';
import type { ScopeSelection } from '../scopeSelection.ts';

const sem = (n: 1 | 2): ScopeSelection => ({ kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: n });

// Three units of 3, 1 and 2 lessons — uneven on purpose.
const pool: PoolLesson[] = [
  { id: 'a1', unitId: 'A' }, { id: 'a2', unitId: 'A' }, { id: 'a3', unitId: 'A' },
  { id: 'b1', unitId: 'B' },
  { id: 'c1', unitId: 'C' }, { id: 'c2', unitId: 'C' },
];
const ids = (idx: number[]) => idx.map(i => pool[i]!.id);

describe('planCoverage — balanced', () => {
  it('gives every unit a question before any unit gets a second', () => {
    assert.deepEqual(ids(planCoverage(pool, 3, 'balanced')), ['a1', 'b1', 'c1']);
    assert.deepEqual(ids(planCoverage(pool, 6, 'balanced')), ['a1', 'b1', 'c1', 'a2', 'b1', 'c2']);
  });

  it('is exactly `count` long and deterministic', () => {
    for (const n of [1, 2, 5, 12, 30]) assert.equal(planCoverage(pool, n, 'balanced').length, n);
    assert.deepEqual(planCoverage(pool, 9, 'balanced'), planCoverage(pool, 9, 'balanced'));
  });

  it('with fewer questions than units covers distinct units', () => {
    const units = ids(planCoverage(pool, 2, 'balanced')).map(id => pool.find(l => l.id === id)!.unitId);
    assert.equal(new Set(units).size, 2);
  });

  it('an offset changes the plan but still covers every unit once count >= units', () => {
    const base = ids(planCoverage(pool, 3, 'balanced'));
    const moved = ids(planCoverage(pool, 3, 'balanced', { offset: 1 }));
    assert.notDeepEqual(base, moved);
    assert.equal(new Set(moved.map(id => pool.find(l => l.id === id)!.unitId)).size, 3);
  });

  it('a one-lesson pool repeats that lesson', () => {
    assert.deepEqual(planCoverage([{ id: 'x', unitId: 'U' }], 4, 'balanced'), [0, 0, 0, 0]);
  });

  it('an empty pool or a zero count plans nothing', () => {
    assert.deepEqual(planCoverage([], 5, 'balanced'), []);
    assert.deepEqual(planCoverage(pool, 0, 'balanced'), []);
  });
});

describe('planCoverage — random', () => {
  /** A seeded generator so the test is reproducible. */
  const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  it('is reproducible with an injected generator and exactly `count` long', () => {
    const a = planCoverage(pool, 10, 'random', { random: seeded(7) });
    const b = planCoverage(pool, 10, 'random', { random: seeded(7) });
    assert.deepEqual(a, b);
    assert.equal(a.length, 10);
  });

  it('repeats no lesson until every lesson has been used', () => {
    const first = planCoverage(pool, pool.length, 'random', { random: seeded(3) });
    assert.equal(new Set(first).size, pool.length);
    const second = planCoverage(pool, pool.length * 2, 'random', { random: seeded(3) });
    assert.equal(new Set(second.slice(0, pool.length)).size, pool.length);
    assert.equal(new Set(second.slice(pool.length)).size, pool.length);
  });
});

describe('buildCoverage over a real scope', () => {
  it('lists the scope\'s lessons with L1..Ln codes in book order', () => {
    const lessons = coverageLessons(sem(1), 'ar');
    assert.ok(lessons.length > 4);
    assert.deepEqual(lessons.map(l => l.code), lessons.map((_, i) => `L${i + 1}`));
    assert.ok(lessons.every(l => l.id && l.unitId && l.title));
  });

  it('balanced sends slots (codes) of the picked length; random sends none', () => {
    const b = buildCoverage(sem(1), 'ar', 12, 'balanced');
    assert.equal(b.slots?.length, 12);
    assert.ok(b.slots!.every(c => b.lessons.some(l => l.code === c)));
    assert.equal(buildCoverage(sem(1), 'ar', 12, 'random').slots, undefined);
  });

  it('balanced covers every unit of the semester once count >= units', () => {
    const b = buildCoverage(sem(1), 'ar', 12, 'balanced');
    const unitOf = new Map(b.lessons.map(l => [l.code, l.unitId]));
    const allUnits = new Set(b.lessons.map(l => l.unitId));
    const used = new Set(b.slots!.map(c => unitOf.get(c)));
    assert.deepEqual([...used].sort(), [...allUnits].sort());
  });

  it('the two semesters give different lesson tables', () => {
    const a = coverageLessons(sem(1), 'ar').map(l => l.id);
    const b = coverageLessons(sem(2), 'ar').map(l => l.id);
    assert.equal(a.filter(id => b.includes(id)).length, 0);
  });
});

describe('lessonIdsFromTags / coverageSummary', () => {
  const lessons = [
    { code: 'L1', id: 'x1', unitId: 'U', title: 'one' },
    { code: 'L2', id: 'x2', unitId: 'U', title: 'two' },
    { code: 'L3', id: 'x3', unitId: 'V', title: 'three' },
  ];

  it('maps the model\'s codes to lesson ids and drops the raw tag', () => {
    const qs: { lesson?: string; lessonId?: string }[] = [{ lesson: 'L2' }, { lesson: ' l3 ' }, { lesson: 'L9' }, {}];
    lessonIdsFromTags(qs, lessons);
    assert.deepEqual(qs, [{ lessonId: 'x2' }, { lessonId: 'x3' }, {}, {}]);
  });

  it('leaves a question that already has a lessonId alone', () => {
    const qs = [{ lessonId: 'x1', lesson: 'L3' }];
    lessonIdsFromTags(qs, lessons);
    assert.deepEqual(qs, [{ lessonId: 'x1' }]);
  });

  it('summarises what was and was not covered', () => {
    const s = coverageSummary([{ lessonId: 'x1' }, { lessonId: 'x1' }, { lessonId: 'x3' }, {}], lessons);
    assert.deepEqual(s.covered.map(l => l.code), ['L1', 'L3']);
    assert.deepEqual(s.uncovered.map(l => l.code), ['L2']);
  });
});
