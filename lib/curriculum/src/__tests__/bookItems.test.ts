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
  unmatchedPrinted: string[];
  notes: Record<string, string>;
  quarantined: { id: string; reason: string }[];
};
const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
/** The one Arabic answer the data may hold: what the guide prints for a system with no real solution. */
const NO_SOLUTION = 'لا يوجد حل';

/**
 * The extractor's `flat` (scripts/extract_book_items.py): the fraction bar becomes a gap and
 * every gap goes EXCEPT one between two digits. The text layer splits `-11/3` into «- 11» over
 * «3», so both spellings meet at `-11 3`, while `12` and `1/2` stay apart (deleting the bar made
 * `(12, 3)` equal `(1/2, 3)`). Keep the two in step.
 */
const flat = (s: string) => s.replace(/\//g, ' ').replace(/\s+/g, ' ').replace(/(?<![0-9])\s+|\s+(?![0-9])/g, '');
/** A list of `(a,b)` points as a sorted set; the book prints its points in its own order. */
const points = (s: string): string[] | null => {
  const f = flat(s);
  const pts = f.match(/\([^()]*\)/g) ?? [];
  return pts.length > 0 && pts.join(',') === f ? [...pts].sort() : null;
};
const sameValue = (printed: string, computed: string) => {
  if (flat(printed) === flat(computed)) return true;
  const a = points(printed);
  const b = points(computed);
  return a !== null && b !== null && a.join('|') === b.join('|');
};
/** The ids of verified items whose printed answer is not their computed answer, by value. */
const verifiedDisagreements = (list: BookItem[]) =>
  list.filter(i => i.status === 'verified' && !sameValue(i.printedAnswer ?? '', i.computedAnswer)).map(i => i.id);

describe('book items — comparing a printed answer by value', () => {
  it('keeps values apart that only collide once the fraction bar is deleted', () => {
    for (const [printed, computed] of [
      ['(12, 3)', '(1/2, 3)'],
      ['c < -13', 'c < -1/3'],
      ['( - 1 13 , 0)', '(-11/3, 0)'],
      ['( - 11 3 , 0)', '(-1/13, 0)'],
      ['(1 2, 3)', '(12, 3)'],
    ]) {
      assert.equal(sameValue(printed, computed), false, `${printed} vs ${computed}`);
      assert.equal(sameValue(computed, printed), false, `${computed} vs ${printed}`);
    }
  });

  it('still matches a split printed fraction to its value', () => {
    assert.equal(sameValue('(3, 1), ( - 11 3 , - 7 3 )', '(-11/3, -7/3), (3, 1)'), true);
    assert.equal(sameValue('c < - 1 3', 'c < -1/3'), true);
    assert.equal(flat('( - 11 3 , - 7 3 )'), '(-11 3,-7 3)');
    assert.equal(flat('(-11/3, -7/3)'), '(-11 3,-7 3)');
  });

  it('does not take a duplicated point for a single point', () => {
    assert.equal(sameValue('(1, 4), (1, 4)', '(1, 4)'), false);
    assert.equal(sameValue('(1, 4)', '(1, 4), (1, 4)'), false);
  });
});

describe('book items — the committed data', () => {
  it('has enough items that a run which quarantines everything fails here', () => {
    assert.ok(items.length >= 30, `only ${items.length} served items`);
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
      assert.ok(i.computedAnswer.length > 0, i.id);
      if (i.computedAnswer === NO_SOLUTION) {
        // the sentinel is allowed on a unit-test open question only, where the book prints it
        assert.equal(i.kind, 'unit-test', `${i.id}: «${NO_SOLUTION}» on a ${i.kind}`);
        assert.equal(i.printedAnswer, NO_SOLUTION, i.id);
      } else {
        assert.ok(!ARABIC.test(i.computedAnswer), `${i.id}: ${i.computedAnswer}`);
      }
    }
  });

  it('never claims verified without the book’s printed answer, and never carries a check otherwise', () => {
    for (const i of items) {
      if (i.status === 'verified') assert.ok(i.printedAnswer, `${i.id}: verified with no printed answer`);
      if (i.status === 'verified') assert.equal(i.verificationSource, 'sympy+book', i.id);
      if (i.status !== 'verified') assert.equal(i.printedAnswer, null, `${i.id}: a ${i.status} item has no printed answer`);
      if (i.status !== 'verified') assert.equal(i.check, null, `${i.id}: a ${i.status} item must not reach the verification pass`);
      assert.ok(SERVED_STATUSES.includes(i.status), `${i.id}: ${i.status} is not servable`);
    }
  });

  it('verifies only where the printed answer is the computed one, compared by value', () => {
    const verified = items.filter(i => i.status === 'verified');
    assert.ok(verified.length >= 5, `only ${verified.length} verified`);
    assert.deepEqual(verifiedDisagreements(items), []);
    for (const i of verified) {
      // the printed text is the book’s own, whitespace-normalised and nothing else
      assert.equal(i.printedAnswer, i.printedAnswer!.replace(/\s+/g, ' ').trim(), i.id);
    }
  });

  it('catches a data edit that makes a verified item disagree with its printed answer', () => {
    const edit = (id: string, over: Partial<BookItem>) => items.map(i => (i.id === id ? { ...i, ...over } : i));
    const ten = items.find(i => i.id === 'bi-math-s1-teacher-guide-u1l2-10')!;
    const eleven = items.find(i => i.id === 'bi-math-s1-teacher-guide-u1l2-11')!;
    assert.equal(ten.status, 'verified');
    assert.equal(eleven.status, 'verified');
    // the fraction bar read as nothing: -11/3 printed as -113
    assert.deepEqual(
      verifiedDisagreements(edit(ten.id, { printedAnswer: '(3, 1), (-113, -73)' })),
      [ten.id],
    );
    // 1/3 computed as the integer 13 against a printed «- 1 3»
    assert.deepEqual(
      verifiedDisagreements(edit(eleven.id, { computedAnswer: 'c < -13' })),
      [eleven.id],
    );
    // the unmodified data is untouched by the helper
    assert.deepEqual(verifiedDisagreements(items), []);
  });

  it('keeps the page-47 item whose printed answer disagrees as computed, and says so', () => {
    const eight = items.find(i => i.id === 'bi-math-s1-teacher-guide-u1l3-8')!;
    assert.deepEqual([eight.status, eight.printedAnswer, eight.computedAnswer], ['computed', null, '(0, 5), (2, 1)']);
    assert.deepEqual(report.unmatchedPrinted, ['(0, 5), (2. 1)']);
    assert.deepEqual(Object.keys(report.notes), [eight.id]);
    for (const [id, note] of Object.entries(report.notes)) {
      assert.equal(items.find(i => i.id === id)?.status, 'computed', id);
      assert.ok(note.length > 0, id);
    }
  });

  it('cites a unit-test open question as the unit test, from the guide page that prints it', () => {
    const open = items.filter(i => i.kind === 'unit-test');
    assert.deepEqual(open.map(i => i.source.number).sort((a, b) => a - b), [6, 7, 8, 9, 10, 11]);
    for (const i of open) {
      assert.deepEqual([i.source.sourceId, i.source.page, i.source.bookPage, i.source.unit], ['math-s1-teacher-guide', 47, 34, 1], i.id);
      assert.equal(bookCitation(i, 'ar'), `اختبار نهاية الوحدة ١، س ${String(i.source.number).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)])}`, i.id);
      assert.equal(bookCitation(i, 'en'), `Unit 1 test, Q${i.source.number}`, i.id);
      assert.deepEqual([i.tier, i.tierSource, i.check], ['medium', 'default', null], i.id);
      assert.equal(i.lessonId, [8, 9].includes(i.source.number) ? 'kbl-math-s1-nccd-u1_l2' : 'kbl-math-s1-nccd-u1_l1', i.id);
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

/** A synthetic unit-test short-answer item, so the reader can be tested apart from the served data. */
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
