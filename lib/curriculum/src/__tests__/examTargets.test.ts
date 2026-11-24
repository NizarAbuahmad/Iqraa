/**
 * Grade 10 history, geography, civic and PE books print no outcomes list, so
 * their lessons carry no `objectives` — on purpose (each catalog's known_gaps).
 * An evaluation is scoped by objectives, so those books used to be unreachable
 * from the exam builder. `examTargetsFromBook` gives them exam-only targets
 * built from what the book does print, and these tests pin that the targets
 * stay labelled, stay apart from real outcomes, and come from the book.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getAllObjectives, getEvaluableBookIds, getObjectivesForBook, getObjectiveById } from '../objectives.ts';
import { nccdHistSem1 } from '../catalogs/g10HistSem1.ts';
import { nccdGeoSem2 } from '../catalogs/g10GeoSem2.ts';
import { nccdG10PeSem1 as nccdPeSem1 } from '../catalogs/g10PeSem1.ts';

const TARGET_BOOKS = [
  'book-hist-10-s1', 'book-hist-10-s2',
  'book-geo-10-s1', 'book-geo-10-s2',
  'book-civ-10-s1', 'book-civ-10-s2',
  'book-pe-10-s1',
];

describe('exam targets for books that print no outcomes', () => {
  it('makes every one of the seven books evaluable', () => {
    const evaluable = new Set(getEvaluableBookIds());
    for (const id of TARGET_BOOKS) assert.ok(evaluable.has(id), `${id} is not evaluable`);
  });

  it('labels every target by its source and keeps its id apart from a real outcome id', () => {
    for (const id of TARGET_BOOKS) {
      const objectives = getObjectivesForBook(id);
      assert.ok(objectives.length > 0, id);
      for (const o of objectives) {
        assert.ok(o.examTargetSource, `${o.id} has no examTargetSource`);
        assert.match(o.id, /-t-\d+$/, `${o.id} is not in the target id space`);
      }
    }
  });

  it('takes the text from the book: main idea, or PE’s own self-assessment box', () => {
    const histLesson = nccdHistSem1.units[0]!.lessons[0]!;
    const hist = getObjectiveById('o-hist-s1-u1_l1-t-0');
    assert.equal(hist?.examTargetSource, 'main-idea');
    assert.equal(hist?.descriptionAr, histLesson.main_idea_ar);

    const geoLesson = nccdGeoSem2.units[0]!.lessons[0]!;
    assert.equal(getObjectiveById('o-geo-s2-u4_l1-t-0')?.descriptionAr, geoLesson.main_idea_ar);

    const peLesson = nccdPeSem1.units[0]!.lessons[0]!;
    const pe = getObjectivesForBook('book-pe-10-s1').filter(o => o.id.startsWith('o-pe-s1-u1_l1-t-'));
    assert.deepEqual(pe.map(o => o.descriptionAr), peLesson.self_assessment_ar);
    assert.ok(pe.every(o => o.examTargetSource === 'self-assessment'));
  });

  it('touches no other book: a real outcome never carries the label', () => {
    const books = new Set(TARGET_BOOKS);
    for (const o of getAllObjectives()) {
      if (books.has(o.bookId)) continue;
      assert.equal(o.examTargetSource, undefined, `${o.id} (${o.bookId}) is labelled as a target`);
    }
  });

  it('leaves the lessons’ own objectives empty, so nothing is called an official outcome', () => {
    for (const file of [nccdHistSem1, nccdGeoSem2, nccdPeSem1]) {
      for (const u of file.units) for (const l of u.lessons) assert.deepEqual(l.objectives, [], `${u.id}/${l.id}`);
    }
  });
});
