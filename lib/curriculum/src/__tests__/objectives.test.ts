/**
 * `bloomsSource` must say `defaulted` for every objective a catalog builder
 * stamped, or `bloomsCoverage()` reports human classification that never
 * happened. `DERIVED_OUTCOME_PREFIXES` was a literal list that missed the
 * Grade 9 (`o-g9-…`) and English vocational (`o-eng-…`) shapes: 170 of 366
 * objectives read `authored` while carrying the builder's `'Understand'`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllObjectives,
  lessonIdsForObjectiveIds,
} from '../objectives.ts';
import { BOOKS, LESSONS, UNITS, getLessonById, MVP_SUBJECT_IDS } from '../catalog.ts';
import { objectiveId, type CurriculumIdScope } from '../curriculumIds.ts';

/** One scope per id shape `objectiveId()` can emit. */
const SCOPES: CurriculumIdScope[] = [
  { gradeId: 'grade-10', subject: 'math', semester: 1 },
  { gradeId: 'grade-10', subject: 'math', semester: 2 },
  { gradeId: 'grade-10', subject: 'chem', semester: 1 },
  { gradeId: 'grade-10', subject: 'chem', semester: 2 },
  { gradeId: 'grade-10', subject: 'finlit', semester: 1 },
  { gradeId: 'grade-10', subject: 'phys', semester: 1 },
  { gradeId: 'grade-10', subject: 'phys', semester: 2 },
  { gradeId: 'grade-10', subject: 'earth-science', semester: 1 },
  { gradeId: 'grade-10', subject: 'earth-science', semester: 2 },
  { gradeId: 'grade-10', subject: 'biology', semester: 1 },
  { gradeId: 'grade-10', subject: 'biology', semester: 2 },
  // Grade 9 S2 is omitted: its catalog carries 0 objectives today (verify --gaps).
  { gradeId: 'grade-9', subject: 'math', semester: 1 },
  { gradeId: 'grade-10', subject: 'eng-commerce', semester: 1 },
  { gradeId: 'grade-10', subject: 'eng-industry', semester: 1 },
];

describe('bloomsSource', () => {
  it('every builder-minted objective reads as defaulted, never authored', () => {
    const all = getAllObjectives();
    for (const scope of SCOPES) {
      const prefix = objectiveId(scope, 'u1_l1', 0).replace(/u1_l1-0$/, '');
      const minted = all.filter(o => o.id.startsWith(prefix));
      // Math S2's legacy prefix `o-nccd-` is a prefix of the others, so it can
      // never be empty; every other scope has at least one lesson today.
      assert.ok(minted.length > 0, `no objectives found under ${prefix}`);
      const authored = minted.filter(o => o.bloomsSource === 'authored').map(o => o.id);
      assert.deepEqual(authored, [], `${prefix} objectives claiming authored: ${authored.slice(0, 5)}`);
    }
  });

  it('hand-authored catalog objectives still read as authored', () => {
    const authored = getAllObjectives().filter(o => o.bloomsSource === 'authored');
    assert.ok(authored.length > 0, 'catalog.ts hand-authored objectives vanished');
    assert.ok(authored.every(o => !/^o-(nccd-|finlit-|g\d+-|eng-)/.test(o.id)));
  });
});

describe('lessonIdsForObjectiveIds', () => {
  // The derivation an evaluation's book-figure panel depends on. An exam is
  // scoped by objectives and never by a lesson — `evaluations.lessonId` is a
  // real column that is always null, because no client has ever sent it — so
  // this is the only honest route from an exam to the lessons it covers.
  it('maps an objective onto the lesson that owns it', () => {
    const objective = getAllObjectives()[0]!;
    assert.deepEqual(lessonIdsForObjectiveIds([objective.id]), [objective.lessonId]);
  });

  it('dedupes, keeping the order the objectives name the lessons', () => {
    // Two objectives from one lesson, then one from another: the first lesson
    // must appear once, and first.
    const byLesson = new Map<string, string[]>();
    for (const o of getAllObjectives()) {
      byLesson.set(o.lessonId, [...(byLesson.get(o.lessonId) ?? []), o.id]);
    }
    const pair = [...byLesson.entries()].find(([, ids]) => ids.length >= 2);
    assert.ok(pair, 'some lesson carries two objectives');
    const [firstLesson, firstIds] = pair;
    const other = [...byLesson.entries()].find(([lessonId]) => lessonId !== firstLesson);
    assert.ok(other, 'and another lesson exists');

    assert.deepEqual(
      lessonIdsForObjectiveIds([firstIds[0]!, other[1][0]!, firstIds[1]!]),
      [firstLesson, other[0]],
    );
  });

  it('skips an id the curriculum no longer carries', () => {
    // An objective can be retired while an old evaluation still names it. An
    // exam that renders without a diagram beats one that will not open.
    const objective = getAllObjectives()[0]!;
    assert.deepEqual(
      lessonIdsForObjectiveIds([objective.id, 'o-nccd-s9-u9_l9-9']),
      [objective.lessonId],
    );
  });

  it('is empty for nothing at all', () => {
    assert.deepEqual(lessonIdsForObjectiveIds([]), []);
    assert.deepEqual(lessonIdsForObjectiveIds(undefined), []);
    assert.deepEqual(lessonIdsForObjectiveIds(null), []);
  });

  it('returns ids that resolve back to real lessons', () => {
    // The join that actually matters, and the one that could drift silently:
    // these ids are what `figuresForLesson` keys on in the app, and the figure
    // map is a hand-written file in knowledge-base/. If an objective ever
    // pointed at a lesson the catalog does not carry, the exam panel would go
    // quietly blank rather than fail.
    const lessonIds = lessonIdsForObjectiveIds(getAllObjectives().map(o => o.id));
    assert.ok(lessonIds.length > 0);
    for (const id of lessonIds) assert.ok(getLessonById(id), `${id} is a real lesson`);
  });

  it('mints every MVP subject id in the kbl- namespace', () => {
    // Asserted per-subject rather than globally because one legacy row is not:
    // `lesson-sci-1` (grade-8 science, `catalog.ts` « Other books ») is
    // hand-written rather than minted through `lessonKbId()`. It is outside
    // MVP_SUBJECT_IDS and carries no figures, so nothing reads it — but a
    // blanket /^kbl-/ here would fail on it and teach the next person to
    // loosen the assertion instead of noticing the row.
    const mvp = getAllObjectives().filter(o => MVP_SUBJECT_IDS.includes(o.subjectId));
    const lessonIds = lessonIdsForObjectiveIds(mvp.map(o => o.id));
    assert.ok(lessonIds.length > 50, 'the MVP subjects carry plenty of lessons');
    for (const id of lessonIds) assert.match(id, /^kbl-/);
  });
});

describe('general English is not a dead end', () => {
  // `book-english-10-s1` and `-s2` existed from the day this catalog was
  // written and carried zero lessons until 2026-09-05: a teacher who picked
  // English and opened either saw an empty book. That is one level below the
  // MVP-subject check in finlitCurriculum.test.ts, which only asks whether a
  // subject resolves to a *book*.
  it('every English book leads somewhere', () => {
    const books = BOOKS.filter(b => b.subjectId === 'english');
    assert.ok(books.length >= 6, 'general English plus the vocational tracks');
    for (const book of books) {
      const units = UNITS.filter(u => u.bookId === book.id);
      const lessons = LESSONS.filter(l => units.some(u => u.id === l.unitId));
      assert.ok(units.length > 0, `${book.id} has no units`);
      assert.ok(lessons.length > 0, `${book.id} has no lessons — dead end`);
    }
  });

  it('keeps the year\'s printed unit numbering across the two books', () => {
    // The book prints units 01-05 in semester 1 and 06-10 in semester 2, and
    // the catalog keeps those numbers rather than restarting — the same
    // convention physics and chemistry semester 2 follow. A teacher looking
    // for «Unit 8» must not be shown semester 2's third unit.
    const numbers = (bookId: string) =>
      UNITS.filter(u => u.bookId === bookId).map(u => u.order).sort((a, b) => a - b);
    assert.deepEqual(numbers('book-english-10-s1'), [1, 2, 3, 4, 5]);
    assert.deepEqual(numbers('book-english-10-s2'), [6, 7, 8, 9, 10]);
  });
});
