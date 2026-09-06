/**
 * The guard that makes a second grade safe to add.
 *
 * Every curriculum id omits the grade: a unit is `kbu-math-s1-nccd-u2`, and
 * Grade 9 maths semester 1 unit 2 wants that identical string. Nothing would
 * have noticed — there was no uniqueness check anywhere, so a second grade
 * would have silently overwritten the first in every `Map` keyed by unit id,
 * and the first symptom would have been a teacher seeing another year's
 * lesson.
 *
 * Two properties are asserted, and the second matters more than the first:
 *
 *  1. Ids are globally unique, and a second grade's ids collide with nothing.
 *  2. **Every Grade 10 id is byte-identical to what it has always been.**
 *     `evaluations.unitId`, `evaluations.lessonId`, `evaluations.objectiveIds`
 *     and `evaluation_questions.objectiveId` are free-text Postgres columns
 *     holding these exact strings. Changing one is a migration over live
 *     student work, so the ids are pinned here literally rather than derived —
 *     a test that recomputes them the same way the code does would agree with
 *     any rename.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BOOKS, LESSONS, UNITS } from '../catalog.ts';
import { getAllObjectives } from '../objectives.ts';
import { bankTagsForUnit } from '../bank.ts';
import {
  IMPLICIT_GRADE_ID,
  bankTagsForParsedUnit,
  isNccdUnitId,
  lessonKbId,
  objectiveId,
  parseUnitKbId,
  unitKbId,
  type CurriculumIdScope,
} from '../curriculumIds.ts';

const G10_MATH_S1: CurriculumIdScope = { gradeId: 'grade-10', subject: 'math', semester: 1 };
const G9_MATH_S1: CurriculumIdScope = { gradeId: 'grade-9', subject: 'math', semester: 1 };

describe('ids are unique across the whole catalog', () => {
  const dupes = (ids: string[]): string[] =>
    [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];

  it('no two units, lessons or objectives share an id', () => {
    assert.deepEqual(dupes(UNITS.map(u => u.id)), []);
    assert.deepEqual(dupes(LESSONS.map(l => l.id)), []);
    assert.deepEqual(dupes(getAllObjectives().map(o => o.id)), []);
  });

  it('every unit reaches a grade', () => {
    // The grade was never missing from the *data* — only from the id strings.
    // If that stops being true, deriving a grade from a unit stops working and
    // the whole approach below is unsound.
    const grade = new Map(BOOKS.map(b => [b.id, b.gradeId]));
    const orphans = UNITS.filter(u => !grade.get(u.bookId)).map(u => u.id);
    assert.deepEqual(orphans, []);
  });

  it('already spans more than one grade', () => {
    // grade-8 (a science stub) is in there beside grade-10, so "one grade" was
    // never the assumption — the ids just behaved as though it were.
    const grade = new Map(BOOKS.map(b => [b.id, b.gradeId]));
    const grades = new Set(UNITS.map(u => grade.get(u.bookId)));
    assert.ok(grades.size >= 2, `only ${grades.size} grade(s) in the catalog`);
  });
});

describe('Grade 10 ids did not move', () => {
  it('pins the unit ids literally', () => {
    // Spelled out, not computed. A test that built these with `unitKbId` would
    // pass through a rename and prove nothing.
    for (const id of [
      'kbu-math-s1-nccd-u2',
      'kbu-math-s2-nccd-u5',
      'kbu-chem-s1-nccd-u1',
      'kbu-chem-s2-nccd-u4',
      'kbu-finlit-s1-nccd-u1',
    ]) {
      assert.ok(UNITS.some(u => u.id === id), `${id} is no longer a unit id`);
    }
  });

  it('pins a lesson and an objective id from each subject', () => {
    const lessons = new Set(LESSONS.map(l => l.id));
    for (const id of ['kbl-math-s1-nccd-u2_l1', 'kbl-chem-s1-nccd-u1_l1']) {
      assert.ok(lessons.has(id), `${id} is no longer a lesson id`);
    }
    const objectives = new Set(getAllObjectives().map(o => o.id));
    for (const id of ['o-nccd-s1-u2_l1-0', 'o-nccd-chem-s1-u1_l1-0']) {
      assert.ok(objectives.has(id), `${id} is no longer an objective id`);
    }
  });

  it('builds them from the shared helpers unchanged', () => {
    assert.equal(unitKbId(G10_MATH_S1, 'u2'), 'kbu-math-s1-nccd-u2');
    assert.equal(lessonKbId(G10_MATH_S1, 'u2_l1'), 'kbl-math-s1-nccd-u2_l1');
    assert.equal(objectiveId(G10_MATH_S1, 'u2_l1', 0), 'o-nccd-s1-u2_l1-0');
    // math-s2 is the odd one: no semester segment in its objective ids. Pinned
    // because it is exactly the kind of inconsistency a tidy-up would erase.
    assert.equal(
      objectiveId({ ...G10_MATH_S1, semester: 2 }, 'u5_l3', 0),
      'o-nccd-u5_l3-0',
    );
  });

  it('carries no grade segment, and says which grade that means', () => {
    assert.equal(parseUnitKbId('kbu-math-s1-nccd-u2')?.gradeId, IMPLICIT_GRADE_ID);
  });
});

describe('a second grade collides with nothing', () => {
  it('gets an explicit grade segment', () => {
    assert.equal(unitKbId(G9_MATH_S1, 'u2'), 'kbu-g9-math-s1-nccd-u2');
    assert.equal(lessonKbId(G9_MATH_S1, 'u2_l1'), 'kbl-g9-math-s1-nccd-u2_l1');
    assert.equal(objectiveId(G9_MATH_S1, 'u2_l1', 0), 'o-g9-math-s1-u2_l1-0');
  });

  it('produces ids no existing id already uses', () => {
    // The whole point. Build a plausible Grade 9 maths catalog over the same
    // unit and lesson numbering Grade 10 uses, and assert nothing lands on top
    // of anything real *outside Grade 9* — Grade 9 Math S1 is real content now
    // (see g9MathSem1.ts), so its own ids naturally reappear in this sweep,
    // which is the id scheme working, not a collision. Scoped out by grade,
    // not by subject/semester, so a future Grade 9 subject still gets the
    // real protection this test exists for.
    const bookGrade = new Map(BOOKS.map(b => [b.id, b.gradeId]));
    const unitGrade = new Map(UNITS.map(u => [u.id, bookGrade.get(u.bookId)]));
    const lessonGrade = new Map(LESSONS.map(l => [l.id, unitGrade.get(l.unitId)]));
    const nonG9Units = UNITS.filter(u => unitGrade.get(u.id) !== 'grade-9');
    const nonG9Lessons = LESSONS.filter(l => lessonGrade.get(l.id) !== 'grade-9');
    const nonG9Objectives = getAllObjectives().filter(o => lessonGrade.get(o.lessonId) !== 'grade-9');
    const taken = new Set<string>([
      ...nonG9Units.map(u => u.id),
      ...nonG9Lessons.map(l => l.id),
      ...nonG9Objectives.map(o => o.id),
    ]);
    const clashes: string[] = [];
    for (let u = 1; u <= 8; u += 1) {
      for (const semester of [1, 2] as const) {
        const scope: CurriculumIdScope = { gradeId: 'grade-9', subject: 'math', semester };
        const candidates = [unitKbId(scope, `u${u}`)];
        for (let l = 1; l <= 6; l += 1) {
          candidates.push(lessonKbId(scope, `u${u}_l${l}`));
          for (let i = 0; i < 4; i += 1) candidates.push(objectiveId(scope, `u${u}_l${l}`, i));
        }
        for (const c of candidates) if (taken.has(c)) clashes.push(c);
      }
    }
    assert.deepEqual(clashes, [], `${clashes.length} Grade 9 ids collide with Grade 10`);
  });

  it('round-trips through the parser', () => {
    const parsed = parseUnitKbId('kbu-g9-math-s1-nccd-u2');
    assert.deepEqual(parsed, { gradeId: 'grade-9', subject: 'math', semester: 1, unit: 2 });
  });
});

describe('bank tags', () => {
  it('are unchanged for every unit on file', () => {
    // Pinned against the vocabulary already written into all 78 manifest rows:
    // maths bare, chemistry prefixed, financial literacy semester-only.
    assert.deepEqual(bankTagsForUnit('kbu-math-s1-nccd-u2'), ['s1-u2', 's1']);
    assert.deepEqual(bankTagsForUnit('kbu-chem-s2-nccd-u4'), ['chem-s2-u4', 'chem-s2']);
    assert.deepEqual(bankTagsForUnit('kbu-finlit-s1-nccd-u1'), ['finlit-s1']);
    // The three sciences added 2026-09-03 carry semester-only tags under their
    // own manifest stems, which are abbreviations of the slug, not the slug:
    // `bio-s1`, not `biology-s1`. Nothing in the bank is unit-level for them.
    assert.deepEqual(bankTagsForUnit('kbu-phys-s2-nccd-u4'), ['phys-s2']);
    assert.deepEqual(bankTagsForUnit('kbu-biology-s1-nccd-u1'), ['bio-s1']);
    assert.deepEqual(bankTagsForUnit('kbu-earth-science-s2-nccd-u3'), ['earth-s2']);
    // Every real unit still resolves to something, or to nothing on purpose.
    for (const u of UNITS.filter(x => isNccdUnitId(x.id))) {
      assert.ok(bankTagsForUnit(u.id).length > 0, `${u.id} lost its bank tags`);
    }
  });

  it('are grade-qualified for a second grade, and maths stops being implicit', () => {
    assert.deepEqual(
      bankTagsForParsedUnit({ gradeId: 'grade-9', subject: 'math', semester: 1, unit: 2 }),
      ['g9-math-s1-u2', 'g9-math-s1'],
    );
    assert.deepEqual(
      bankTagsForParsedUnit({ gradeId: 'grade-9', subject: 'finlit', semester: 1, unit: 1 }),
      ['g9-finlit-s1'],
    );
  });

  it('share no tag between two grades', () => {
    const g10 = new Set(bankTagsForUnit('kbu-math-s1-nccd-u2'));
    const g9 = bankTagsForParsedUnit({ gradeId: 'grade-9', subject: 'math', semester: 1, unit: 2 });
    assert.deepEqual(g9.filter(t => g10.has(t)), [], 'a Grade 9 tag would match Grade 10 documents');
  });
});

describe('isNccdUnitId', () => {
  it('accepts both forms and rejects the legacy namespace', () => {
    assert.ok(isNccdUnitId('kbu-math-s1-nccd-u2'));
    assert.ok(isNccdUnitId('kbu-g9-chem-s2-nccd-u11'));
    // The app's hardcoded KB rows. Not in this namespace, resolve to no bank
    // material, and must not be mistaken for a unit the bank can scope by.
    assert.ok(!isNccdUnitId('kbu-chem-1'));
    assert.ok(!isNccdUnitId('unit-sci-8-1'));
    assert.ok(!isNccdUnitId(''));
    assert.ok(!isNccdUnitId(null));
    assert.ok(!isNccdUnitId(undefined));
  });

  it('accepts every NCCD-shaped unit id the catalog actually holds', () => {
    // The check above and `bankTagsForUnit`'s loop both start from
    // `isNccdUnitId`, so a subject the predicate does not know about is
    // filtered out before either can notice it — which is how physics, earth
    // science and biology shipped on 2026-09-03 with all 15 of their units
    // rejected. Grounding resolved no book passages for any of them and
    // nothing failed. So match on the id's *shape*, independently of the
    // predicate under test, and assert the predicate agrees.
    const shaped = UNITS.filter(u => /^kbu-(?:g\d+-)?[a-z-]+-s[12]-nccd-u\d+$/.test(u.id));
    assert.ok(shaped.length >= 68, `only ${shaped.length} NCCD-shaped units found`);
    assert.deepEqual(shaped.filter(u => !isNccdUnitId(u.id)).map(u => u.id), []);
  });
});
