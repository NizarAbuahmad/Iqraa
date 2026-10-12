/**
 * Book items: the committed data's invariants, and the reader.
 *
 * These read the REAL committed JSON and the real exercise index. The data is a
 * script's output, so a fixture would agree with itself while the books did not.
 *
 * Run: node --experimental-strip-types --test src/__tests__/bookItems.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LESSONS } from '../catalog.ts';
import { G10_SOURCES } from '../sources.ts';
import { usePolicy } from '../bank.ts';
import {
  SERVED_STATUSES,
  bookCitation,
  bookItemsForLesson,
  bookStatusLabel,
  displayMath,
  takeBookItem,
  type BookItem,
} from '../bookItems.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => JSON.parse(readFileSync(join(HERE, rel), 'utf8'));
const SOURCES = ['math-s1-exercise-book', 'math-s2-exercise-book', 'math-s1-teacher-guide'];
const items: BookItem[] = SOURCES.flatMap(id => read(`../data/book-items/${id}.json`).items);
const report = read('../data/book-items/report.json') as {
  counts: Record<string, number>;
  quarantined: { id: string; reason: string }[];
};
const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

describe('book items — the committed data', () => {
  it('has enough items that a run which quarantines everything fails here', () => {
    assert.ok(items.length >= 20, `only ${items.length} served items`);
  });

  it('joins every item to a real curriculum lesson', () => {
    const lessons = new Set(LESSONS.map(l => l.id));
    for (const i of items) assert.ok(lessons.has(i.lessonId), `${i.id} → ${i.lessonId}`);
  });

  it('cites the page and number the exercise index says exist', () => {
    for (const source of ['math-s1-exercise-book', 'math-s2-exercise-book']) {
      const index = read(`../../../../knowledge-base/grade-10-math/exercises/${source}/index.json`) as {
        lessons: { page: number; unit: number; lesson: number; exerciseCount: number }[];
      };
      for (const i of items.filter(x => x.source.sourceId === source)) {
        const [, unit, lesson] = /-u(\d+)l(\d+)-\d+$/.exec(i.id)!.map(Number);
        const row = index.lessons.find(l => l.unit === unit && l.lesson === lesson);
        assert.ok(row, `${i.id}: no index row`);
        assert.equal(i.source.page, row.page, i.id);
        assert.ok(i.source.number >= 1 && i.source.number <= row.exerciseCount, i.id);
      }
    }
  });

  it('keeps every stem Latin and every id unique', () => {
    assert.equal(new Set(items.map(i => i.id)).size, items.length);
    for (const i of items) {
      assert.ok(i.stem.length > 0 && !ARABIC.test(i.stem), `${i.id}: ${i.stem}`);
      assert.ok(i.computedAnswer.length > 0 && !ARABIC.test(i.computedAnswer), i.id);
    }
  });

  it('never claims verified without the book’s printed answer, and never carries a check otherwise', () => {
    for (const i of items) {
      if (i.status === 'verified') assert.ok(i.printedAnswer, `${i.id}: verified with no printed answer`);
      if (i.status !== 'verified') assert.equal(i.check, null, `${i.id}: a ${i.status} item must not reach the verification pass`);
      assert.ok(SERVED_STATUSES.includes(i.status), `${i.id}: ${i.status} is not servable`);
    }
  });

  it('gives a unit-test question four options with its key among them', () => {
    for (const i of items.filter(x => x.kind === 'unit-test-mcq')) {
      assert.equal(i.options?.length, 4, i.id);
      assert.ok(i.options!.includes(i.computedAnswer), i.id);
    }
  });

  it('comes only from sources that may be quoted', () => {
    for (const id of SOURCES) {
      const source = G10_SOURCES.find(s => s.id === id);
      assert.ok(source, id);
      assert.equal(usePolicy(source), 'quotable', id);
    }
  });

  it('agrees with its own report', () => {
    for (const status of ['computed', 'verified', 'book-key'] as const) {
      assert.equal(items.filter(i => i.status === status).length, report.counts[status] ?? 0, status);
    }
    assert.equal(report.counts['quarantined'], report.quarantined.length);
    for (const q of report.quarantined) assert.ok(q.reason.length > 0, q.id);
  });
});

describe('book items — the reader', () => {
  const lessonId = 'kbl-math-s1-nccd-u1_l1';

  it('serves nothing for a lesson without items, and for no lesson', () => {
    assert.deepEqual(bookItemsForLesson('kbl-math-s1-nccd-u4_l1'), []);
    assert.deepEqual(bookItemsForLesson(null), []);
    assert.equal(takeBookItem({ lessonId: undefined, session: new Set() }), null);
  });

  it('spends each item once per session', () => {
    const session = new Set<string>();
    const seen = new Set<string>();
    for (let n = 0; n < bookItemsForLesson(lessonId).length; n++) {
      const got = takeBookItem({ lessonId, session });
      assert.ok(got);
      assert.ok(!seen.has(got.id));
      seen.add(got.id);
    }
    assert.equal(takeBookItem({ lessonId, session }), null);
  });

  it('filters by kind and prefers the requested tier', () => {
    const mcq = takeBookItem({ lessonId, kind: 'unit-test-mcq', session: new Set() });
    assert.equal(mcq?.kind, 'unit-test-mcq');
    const hard = takeBookItem({ lessonId, kind: 'exercise', tier: 'hard', session: new Set(), rng: () => 0 });
    assert.equal(hard?.tier, 'hard');
  });

  it('is deterministic for a given rng', () => {
    const a = takeBookItem({ lessonId, kind: 'exercise', session: new Set(), rng: () => 0.5 });
    const b = takeBookItem({ lessonId, kind: 'exercise', session: new Set(), rng: () => 0.5 });
    assert.equal(a?.id, b?.id);
  });

  it('cites in Arabic digits at display time only', () => {
    const exercise = items.find(i => i.id === 'bi-math-s1-exercise-book-u1l2-3')!;
    assert.equal(bookCitation(exercise, 'ar'), 'كتاب التمارين ص ١١، س ٣');
    assert.equal(bookCitation(exercise, 'en'), 'Exercise book p. 11, Q3');
    const test = items.find(i => i.id === 'bi-math-s1-teacher-guide-u1l2-1')!;
    assert.equal(bookCitation(test, 'ar'), 'اختبار نهاية الوحدة ١، س ١');
  });

  it('labels what is not verified, and says nothing about what is', () => {
    const computed = items.find(i => i.status === 'computed')!;
    assert.equal(bookStatusLabel(computed, 'ar'), 'الحل محسوب من نص السؤال');
    assert.equal(bookStatusLabel({ ...computed, status: 'verified' }, 'ar'), null);
  });
});

describe('displayMath — typing notation to display notation', () => {
  it('turns ^digits into superscripts', () => {
    assert.equal(displayMath('x^2'), 'x²');
    assert.equal(displayMath('x^12'), 'x¹²');
    assert.equal(displayMath('y^2 = 0.5x^2'), 'y² = 0.5x²');
    assert.equal(displayMath('a^0 b^3 c^45 d^6789'), 'a⁰ b³ c⁴⁵ d⁶⁷⁸⁹');
  });

  it('turns every ASCII hyphen into a minus sign', () => {
    assert.equal(displayMath('y = x^2 - 3x + 2'), 'y = x² − 3x + 2');
    assert.equal(displayMath('y = -x^2 -5x- 6'), 'y = −x² −5x− 6');
    assert.equal(displayMath('(1, 4), (-5, -20)'), '(1, 4), (−5, −20)');
  });

  it('closes the gap in f (x)', () => {
    assert.equal(displayMath('f (x) = -6x'), 'f(x) = −6x');
    assert.equal(displayMath('f (x) = 3.2x'), 'f(x) = 3.2x');
  });

  it('leaves everything else alone', () => {
    for (const same of ["√2 + 3", "x/2 = 0.75", "f'(x) = 2x", "2x + y = 7", "x ^ y", "x^", "g (x)", ""]) {
      assert.equal(displayMath(same), same);
    }
    assert.equal(displayMath('x^2\ny = 3'), 'x²\ny = 3');
  });

  it('is idempotent', () => {
    const once = displayMath('f (x) = -x^2 - 3');
    assert.equal(displayMath(once), once);
  });
});

/** A synthetic unit-test short-answer item: no data file holds one yet. */
const unitTestOpen = (id: string, over: Partial<BookItem> = {}): BookItem => ({
  id,
  lessonId: 'kbl-synthetic-lesson',
  source: { sourceId: 'math-s1-teacher-guide', page: 47, bookPage: 47, unit: 1, number: 6 },
  kind: 'unit-test',
  instruction: 'أحل نظام المعادلتين الآتي',
  stem: 'y = 4x\ny = 5 - x^2',
  printedAnswer: '(1, 4), (-5, -20)',
  computedAnswer: '(1, 4), (-5, -20)',
  check: null,
  tier: 'medium',
  tierSource: 'default',
  status: 'verified',
  verificationSource: 'sympy+book',
  ...over,
});

describe('book items — the unit-test short-answer kind', () => {
  it('cites like the unit-test multiple choice, not like the exercise book', () => {
    const open = unitTestOpen('syn-1');
    assert.equal(bookCitation(open, 'ar'), 'اختبار نهاية الوحدة ١، س ٦');
    assert.equal(bookCitation(open, 'en'), 'Unit 1 test, Q6');
    const mcq = items.find(i => i.kind === 'unit-test-mcq')!;
    const sameSlot = { ...mcq, source: { ...mcq.source, ...open.source } };
    assert.equal(bookCitation(open, 'ar'), bookCitation(sameSlot, 'ar'));
    assert.equal(bookCitation(open, 'en'), bookCitation(sameSlot, 'en'));
  });

  it('is taken by kind from an injected pool, once, and not by the other kinds', () => {
    const pool = [
      unitTestOpen('syn-a'),
      unitTestOpen('syn-b'),
      unitTestOpen('syn-ex', { kind: 'exercise' }),
    ];
    const session = new Set<string>();
    const lessonId = 'kbl-synthetic-lesson';
    const first = takeBookItem({ lessonId, kind: 'unit-test', session, rng: () => 0, pool });
    assert.equal(first?.id, 'syn-a');
    const second = takeBookItem({ lessonId, kind: 'unit-test', session, rng: () => 0, pool });
    assert.equal(second?.id, 'syn-b');
    assert.equal(takeBookItem({ lessonId, kind: 'unit-test', session, pool }), null);
    assert.equal(takeBookItem({ lessonId, kind: 'unit-test-mcq', session: new Set(), pool }), null);
  });

  it('accepts a list of kinds, drawing from their union', () => {
    const pool = [
      unitTestOpen('syn-ex', { kind: 'exercise' }),
      unitTestOpen('syn-ut'),
      unitTestOpen('syn-mcq', { kind: 'unit-test-mcq' }),
    ];
    const lessonId = 'kbl-synthetic-lesson';
    const got = new Set<string>();
    const session = new Set<string>();
    for (let n = 0; n < 3; n++) {
      const item = takeBookItem({ lessonId, kind: ['exercise', 'unit-test'], session, rng: () => 0, pool });
      if (item) got.add(item.id);
    }
    assert.deepEqual([...got].sort(), ['syn-ex', 'syn-ut']);
  });

  it('a one-element list draws exactly what the single kind draws', () => {
    const lessonId = 'kbl-math-s1-nccd-u1_l1';
    for (const r of [0, 0.3, 0.5, 0.99]) {
      const single = takeBookItem({ lessonId, kind: 'exercise', session: new Set(), rng: () => r });
      const list = takeBookItem({ lessonId, kind: ['exercise'], session: new Set(), rng: () => r });
      assert.equal(list?.id, single?.id);
    }
  });

  it('a pool given explicitly replaces the lesson lookup', () => {
    assert.equal(takeBookItem({ lessonId: null, kind: 'unit-test', session: new Set(), pool: [unitTestOpen('x')] })?.id, 'x');
  });
});
