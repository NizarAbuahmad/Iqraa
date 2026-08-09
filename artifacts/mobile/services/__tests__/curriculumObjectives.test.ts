/**
 * The learning-objective index that the evaluation module generates and grades
 * against.
 *
 * Two things are guarded here. First, that the index actually resolves — every
 * objective reachable through the catalog must be reachable by id, or a teacher
 * picks an objective that generation then can't find. Second, and less obvious:
 * that `bloomsSource` keeps telling the truth. The NCCD catalog builders stamp
 * every derived objective `'Understand'` because the source JSON carries no
 * cognitive classification. If that flag ever silently reports 'authored' for
 * those, the competency breakdown collapses into a single bar while looking
 * perfectly healthy.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LESSONS,
  bloomsCoverage,
  getAllObjectives,
  getEvaluableBookIds,
  getObjectiveById,
  getObjectivesForBook,
  getObjectivesForLesson,
  getObjectivesForUnit,
  objectivesAreWithinBook,
  resolveObjectiveIds,
} from '../curriculumData.ts';

const MATH_S1_BOOK = 'book-math-10';
const CHEM_S1_BOOK = 'book-chem-10';

describe('objective index — resolution', () => {
  it('indexes every outcome reachable through LESSONS', () => {
    const fromLessons = LESSONS.flatMap(l => l.outcomes.map(o => o.id));
    const indexed = new Set(getAllObjectives().map(o => o.id));
    for (const id of fromLessons) {
      assert.ok(indexed.has(id), `outcome "${id}" is in a lesson but not in the index`);
    }
    assert.equal(indexed.size, fromLessons.length, 'duplicate objective ids in catalog');
  });

  it('resolves an objective to its lesson, unit, book, subject and grade', () => {
    const [first] = getObjectivesForBook(MATH_S1_BOOK);
    assert.ok(first, 'math S1 should have at least one objective');
    const hit = getObjectiveById(first.id);
    assert.ok(hit);
    assert.equal(hit.bookId, MATH_S1_BOOK);
    assert.equal(hit.gradeId, 'grade-10');
    assert.equal(hit.subjectId, 'mathematics');
    assert.ok(hit.unitId.length > 0);
    assert.ok(hit.descriptionAr.length > 0);
  });

  it('returns undefined rather than throwing for an unknown id', () => {
    assert.equal(getObjectiveById('o-does-not-exist'), undefined);
  });

  it('reports missing ids instead of silently dropping them', () => {
    const [real] = getAllObjectives();
    const { found, missing } = resolveObjectiveIds([real.id, 'o-ghost', 'o-ghost-2']);
    assert.deepEqual(found.map(o => o.id), [real.id]);
    assert.deepEqual(missing, ['o-ghost', 'o-ghost-2']);
  });

  it('lesson objectives match that lesson outcomes exactly, in order', () => {
    const lesson = LESSONS.find(l => l.outcomes.length > 1);
    assert.ok(lesson, 'expected at least one lesson with multiple outcomes');
    assert.deepEqual(
      getObjectivesForLesson(lesson.id).map(o => o.id),
      lesson.outcomes.map(o => o.id),
    );
  });

  it('unit objectives are the union of its lessons', () => {
    const lesson = LESSONS.find(l => l.outcomes.length > 0);
    assert.ok(lesson);
    const unitIds = new Set(getObjectivesForUnit(lesson.unitId).map(o => o.id));
    for (const o of lesson.outcomes) {
      assert.ok(unitIds.has(o.id), `unit is missing objective "${o.id}"`);
    }
  });
});

describe('objective index — scope enforcement', () => {
  it('accepts ids that all belong to the book', () => {
    const ids = getObjectivesForBook(MATH_S1_BOOK).slice(0, 3).map(o => o.id);
    assert.ok(ids.length > 0);
    assert.equal(objectivesAreWithinBook(ids, MATH_S1_BOOK), true);
  });

  it('rejects an id from a different book — this is the curriculum lock', () => {
    const mathId = getObjectivesForBook(MATH_S1_BOOK)[0]?.id;
    const chemId = getObjectivesForBook(CHEM_S1_BOOK)[0]?.id;
    assert.ok(mathId && chemId, 'need one objective from each book');
    assert.equal(objectivesAreWithinBook([mathId, chemId], MATH_S1_BOOK), false);
  });

  it('rejects an empty selection — generation must never run unscoped', () => {
    assert.equal(objectivesAreWithinBook([], MATH_S1_BOOK), false);
  });
});

describe('objective index — blooms provenance', () => {
  it('flags NCCD-derived objectives as defaulted, not authored', () => {
    const derived = getObjectivesForBook(MATH_S1_BOOK);
    assert.ok(derived.length > 0);
    for (const o of derived) {
      assert.equal(
        o.bloomsSource,
        'defaulted',
        `math S1 objective "${o.id}" claims an authored blooms level it does not have`,
      );
    }
  });

  it('flags hand-authored chemistry objectives as authored', () => {
    const authored = getObjectivesForBook(CHEM_S1_BOOK);
    assert.ok(authored.length > 0, 'chemistry should carry hand-authored outcomes');
    assert.ok(
      authored.some(o => o.bloomsSource === 'authored'),
      'expected at least one authored blooms level in chemistry',
    );
  });

  it('authored objectives span more than one blooms level', () => {
    // The value of the flag is that it separates a real spread from a constant.
    const levels = new Set(
      getAllObjectives()
        .filter(o => o.bloomsSource === 'authored')
        .map(o => o.bloomsLevel),
    );
    assert.ok(levels.size > 1, `authored objectives collapsed to one level: ${[...levels]}`);
  });

  it('coverage totals add up', () => {
    const c = bloomsCoverage();
    assert.equal(c.authored + c.defaulted, c.total);
    assert.equal(c.total, getAllObjectives().length);
  });
});

describe('objective index — evaluable books', () => {
  it('lists only books that actually have objectives to target', () => {
    const evaluable = getEvaluableBookIds();
    assert.ok(evaluable.length > 0);
    for (const bookId of evaluable) {
      assert.ok(
        getObjectivesForBook(bookId).length > 0,
        `book "${bookId}" is listed as evaluable but has no objectives`,
      );
    }
  });

  it('includes the math S1 book the demo runs on', () => {
    assert.ok(getEvaluableBookIds().includes(MATH_S1_BOOK));
  });
});
