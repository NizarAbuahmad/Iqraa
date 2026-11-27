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
const SOURCES = ['math-s1-exercise-book', 'math-s2-exercise-book', 'math-s1-teacher-guide', 'math-s2-student-book'];
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
/** The max/min family's labels (`EXTREMA_*_AR` in scripts/extract_book_items.py). Keep the two in step. */
const EXTREMA_PHRASES = new Set([
  'قيمة عظمى محلية:',
  'قيمة صغرى محلية:',
  'لا توجد قيمة عظمى محلية',
  'لا توجد قيمة صغرى محلية',
  'لا توجد قيم عظمى أو صغرى محلية',
]);

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
/**
 * A printed or computed derivative, `g '(x) = 27x8 )15` or `g'(x) = 27x^8`, as its name and
 * its polynomial's coefficients by power, or null when it is not one. Written separately from
 * the extractor's SymPy check on purpose: the guide prints the terms in its own order
 * (`-2 + 2x` for `2x - 2`) and drops the `^` (`27x8`, or `8x 7` with a gap), so only a
 * comparison of coefficients can tell agreement from a misreading. It reads polynomials with
 * integer coefficients and nothing else.
 */
const derivative = (s: string): { name: string; terms: string; label: number | null } | null => {
  const m = /^([a-z])\s*'\s*\(x\)\s*=\s*(.+?)(?:\s*\)\s*(\d{1,2}))?$/.exec(s.trim());
  if (!m) return null;
  const coef = new Map<number, number>();
  const body = m[2]!.replace(/x\s*\^?\s*(\d+)/g, 'x^$1').replace(/\s+/g, '');
  const pieces = body.match(/[+-]?[^+-]+/g) ?? [];
  if (pieces.join('') !== body) return null; // a lone or doubled sign: a cut-off or misread entry
  for (const term of pieces) {
    const t = /^([+-]?)(\d*)(x(?:\^(\d+))?)?$/.exec(term);
    if (!t || (t[2] === '' && !t[3])) return null;
    const power = t[3] ? Number(t[4] ?? 1) : 0;
    const value = (t[1] === '-' ? -1 : 1) * (t[2] === '' ? 1 : Number(t[2]));
    coef.set(power, (coef.get(power) ?? 0) + value);
  }
  const terms = [...coef].filter(([, c]) => c !== 0).sort(([a], [b]) => a - b).map(([p, c]) => `${c}x^${p}`).join(' ');
  return { name: m[1]!, terms, label: m[3] === undefined ? null : Number(m[3]) };
};
/** An exact rational as «p/q» in lowest terms: «2.5» and «5/2» meet; «1.296» never meets 35/27. */
const rational = (s: string): string | null => {
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:\/(\d+))?$/.exec(s.replace(/\s+/g, ''));
  if (!m || (m[3] && m[4])) return null;
  let p = BigInt(m[2]! + (m[3] ?? '')) * (m[1] ? -1n : 1n);
  let q = m[3] ? 10n ** BigInt(m[3].length) : BigInt(m[4] ?? '1');
  const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
  const g = gcd(p, q);
  return `${p / g}/${q / g}`;
};
/**
 * A max/min answer as a sorted list of «kind x y», or null. Reads both the computed key (the
 * extractor's fixed labels, then `f(a) = v` lines) and the guide's printed line
 * («: صغرى.(2.5, -0.25) )22», «لا توجد قيم عظمى وقيم صغرى. )20»). Exact rationals only, so a
 * rounded or surd value never matches. Written apart from the extractor on purpose.
 */
const extrema = (s: string): { points: string[]; label: number | null } | null => {
  const label = /\)\s*(\d{1,2})\s*$/.exec(s);
  const body = label ? s.slice(0, label.index) : s;
  if (body.replace(/[.:\s]/g, '') === 'لاتوجدقيمعظمىوقيمصغرى' || body === 'لا توجد قيم عظمى أو صغرى محلية') {
    return { points: [], label: label ? Number(label[1]) : null };
  }
  const points: string[] = [];
  if (label) {
    // the guide's line: whole «kind (x, y)» points and punctuation, nothing else
    const re = /(عظمى|صغرى)\s*\.?\s*\(([^()]*)\)/g;
    if (body.replace(re, '').replace(/[.:\s،]/g, '') !== '') return null;
    for (const [, kind, pair] of body.matchAll(re)) {
      const [x, y, more] = pair!.split(',').map(t => rational(t!));
      if (!x || !y || more !== undefined) return null;
      points.push(`${kind === 'عظمى' ? 'max' : 'min'} ${x} ${y}`);
    }
    return points.length ? { points: points.sort(), label: Number(label[1]) } : null;
  }
  let kind: string | null = null;
  for (const line of s.split('\n')) {
    if (line === 'قيمة عظمى محلية:' || line === 'قيمة صغرى محلية:') kind = line.includes('عظمى') ? 'max' : 'min';
    else if (line === 'لا توجد قيمة عظمى محلية' || line === 'لا توجد قيمة صغرى محلية') kind = null;
    else {
      const m = /^[a-z]\((.+)\) = (.+)$/.exec(line);
      const x = m && rational(m[1]!);
      const y = m && rational(m[2]!);
      if (!kind || !x || !y) return null;
      points.push(`${kind} ${x} ${y}`);
    }
  }
  return { points: points.sort(), label: null };
};
/**
 * A word problem's answer, part by part: `v(2) = 4 m/s, t = 3 s` (computed, «, »-joined) or
 * `4 m/s | t = 3 s` (the printed entries the extractor matched, «|»-joined), each part
 * `[name =] value [unit]` with an exact value of the form (p/q)·√r. «√50» meets «5√2»;
 * «942.8» never meets 2000√2/3. A printed part may leave the name out, never the unit.
 */
const surd = (s: string): string | null => {
  const m = /^(-?)(\d+(?:\.\d+)?)?(?:√(\d+))?(?:\/(\d+))?$/.exec(s.replace(/\s+/g, ''));
  if (!m || (!m[2] && !m[3])) return null;
  const r0 = rational(`${m[1]}${m[2] ?? '1'}${m[4] ? `/${m[4]}` : ''}`);
  if (!r0) return null;
  let [p, q] = r0.split('/').map(BigInt) as [bigint, bigint];
  let r = BigInt(m[3] ?? '1');
  for (let k = 2n; k * k <= r; k++) while (r % (k * k) === 0n) { r /= k * k; p *= k; }
  const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
  const g = gcd(p, q);
  return `${p / g}/${q / g}√${r}`;
};
const answerParts = (s: string, sep: RegExp) =>
  s.split(sep).map(part => {
    const m = /^(?:([A-Za-z]'?(?:\([^()=]*\))?)\s*=\s*)?(.+?)\s*(m\/s|cm\^?3|s)?$/.exec(part.trim());
    const value = m && surd(m[2]!);
    return m && value ? { name: m[1] ?? null, value, unit: m[3]?.replace(/^cm3$/, 'cm^3') ?? null } : null;
  });
const sameParts = (printed: string, computed: string) => {
  if (!printed.includes('|') && !/(m\/s|cm\^?3|\bs)$/.test(printed) && !/=/.test(printed)) return false;
  const p = answerParts(printed, /\s*\|\s*/);
  const c = answerParts(computed, /,\s+/);
  return p.length === c.length && p.every((pp, i) => {
    const cc = c[i];
    return pp && cc && pp.value === cc.value && pp.unit === cc.unit && (pp.name === null || pp.name === cc.name);
  });
};
const sameValue = (printed: string, computed: string) => {
  if (flat(printed) === flat(computed)) return true;
  if (sameParts(printed, computed)) return true;
  const ep = extrema(printed);
  const ec = extrema(computed);
  if (ep && ec) return ep.points.join('|') === ec.points.join('|');
  const p = derivative(printed);
  const c = derivative(computed);
  if (p && c) return p.name === c.name && p.terms === c.terms;
  const a = points(printed);
  const b = points(computed);
  return a !== null && b !== null && a.join('|') === b.join('|');
};
/** The ids of verified items whose printed answer is not their computed answer, by value. */
const verifiedDisagreements = (list: BookItem[]) =>
  list
    .filter(i => {
      if (i.status !== 'verified') return false;
      const printed = i.printedAnswer ?? '';
      const label = derivative(printed)?.label ?? extrema(printed)?.label ?? null;
      // a printed item number must be this item's own
      return !sameValue(printed, i.computedAnswer) || (label !== null && label !== i.source.number);
    })
    .map(i => i.id);

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

  it('matches a printed derivative in the guide’s own term order and spelling', () => {
    assert.equal(sameValue("t '(x) = -2 + 2x", "t'(x) = 2x - 2"), true);
    assert.equal(sameValue("f '(x) = -10x + 3x 2 )19", "f'(x) = 3x^2 - 10x"), true);
    assert.equal(sameValue("g '(x) = 27x8", "g'(x) = 27x^8"), true);
    assert.equal(sameValue("f '(x) = 0", "f'(x) = 0"), true);
  });

  it('keeps a derivative apart when the name, a power or a coefficient differs', () => {
    for (const [printed, computed] of [
      ["r '(x) = 27x8", "g'(x) = 27x^8"],
      ["g '(x) = 27x7", "g'(x) = 27x^8"],
      ["g '(x) = 2x8", "g'(x) = 27x^8"],
      ["f '(x) = 2x + 7", "f'(x) = 2x - 7"],
      ["f '(x) = 3x 2", "f'(x) = 3x^2 - 10x"],
      ["f '(x) = m", "f'(x) = 0"],
      ["f '(x) = 3x 2 -", "f'(x) = 3x^2"], // a cut-off entry
      ["f '(x) = 2x - -3", "f'(x) = 2x - 3"], // a lone sign is not dropped
    ]) {
      assert.equal(sameValue(printed, computed), false, `${printed} vs ${computed}`);
    }
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
        // The only other Arabic a key may hold: the max/min family's labels, each a whole line,
        // never sharing a line with maths (bidi scrambles a mixed line on web).
        for (const line of i.computedAnswer.split('\n')) {
          assert.ok(EXTREMA_PHRASES.has(line) || !ARABIC.test(line), `${i.id}: «${line}»`);
        }
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
    // and the s2 unit test's item 23, whose maximum the guide prints only rounded (1.296 for 35/27)
    // and the word problems no printed entry answers whole (5, 7: «see margin»; 6: half a sentence; 10: rounded)
    assert.deepEqual(Object.keys(report.notes), [
      eight.id,
      'bi-math-s2-student-book-u6l2-t5', 'bi-math-s2-student-book-u6l2-t6', 'bi-math-s2-student-book-u6l2-t7',
      'bi-math-s2-student-book-u6l3-t10', 'bi-math-s2-student-book-u6l3-t23',
    ]);
    for (const [id, note] of Object.entries(report.notes)) {
      assert.equal(items.find(i => i.id === id)?.status, 'computed', id);
      assert.ok(note.length > 0, id);
    }
  });

  it('cites a unit-test open question as the unit test, from the guide page that prints it', () => {
    const open = items.filter(i => i.kind === 'unit-test' && i.source.sourceId === 'math-s1-teacher-guide');
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

  it('cites a student-book exercise as the student book, never the exercise book', () => {
    const exercise = items.find(i => i.id === 'bi-math-s2-student-book-u6l2-2')!;
    assert.equal(bookCitation(exercise, 'ar'), 'كتاب الطالب ص ٦٨، س ٢');
    assert.equal(bookCitation(exercise, 'en'), 'Student book p. 68, Q2');
    // the page too: an older printing numbers this test's questions one higher
    const test = items.find(i => i.id === 'bi-math-s2-student-book-u6l2-t15')!;
    assert.equal(bookCitation(test, 'ar'), 'كتاب الطالب ص ٧٧، اختبار نهاية الوحدة ٦، س ١٥');
    assert.equal(bookCitation(test, 'en'), 'Student book p. 77, unit 6 test, Q15');
  });

  it('verifies the unit test’s max/min only where its own printed line holds the whole answer', () => {
    const t = (n: number) => items.find(i => i.id === `bi-math-s2-student-book-u6l3-t${n}`)!;
    assert.deepEqual([20, 21, 22, 23].map(n => t(n).status), ['verified', 'verified', 'verified', 'computed']);
    // the same reader, fed edits: a rounded value, a missing point, another item's label
    const edit = (over: Partial<BookItem>) => verifiedDisagreements([{ ...t(22), ...over }]);
    assert.deepEqual(edit({ printedAnswer: ': صغرى.(2.5, -0.3) )22' }), [t(22).id]);
    assert.deepEqual(edit({ printedAnswer: 'لا توجد قيم عظمى وقيم صغرى. )22' }), [t(22).id]);
    assert.deepEqual(edit({ printedAnswer: ': صغرى.(2.5, -0.25) )21' }), [t(22).id]);
    assert.deepEqual(edit({}), []);
  });

  it('catches a printed derivative labelled for another item', () => {
    const t15 = items.find(i => i.id === 'bi-math-s2-student-book-u6l2-t15')!;
    assert.equal(t15.status, 'verified');
    const edited = items.map(i => (i.id === t15.id ? { ...i, printedAnswer: "f '(x) = 8x 7 )16" } : i));
    assert.deepEqual(verifiedDisagreements(edited), [t15.id]);
  });

  it('serves the semester-2 student book’s derivatives to lesson 6.2, every one verified', () => {
    const fromStudentBook = bookItemsForLesson('kbl-math-s2-nccd-u6_l2').filter(
      // the derivatives: p.68-69's practice and the unit test's 14-19 (not its word problems)
      i => i.source.sourceId === 'math-s2-student-book' && i.kind !== 'unit-test-mcq' && !i.visual
        && (i.source.page !== 77 || (i.source.number >= 14 && i.source.number <= 19)) && i.source.page !== 76,
    );
    assert.equal(fromStudentBook.length, 13); // 14 verified minus t17, a near-duplicate (see the extractor's TABLE)
    for (const i of fromStudentBook) assert.equal(i.status, 'verified', i.id);
  });

  it('serves p.74’s max/min exercises to lesson 6.3 as computed, every label from the fixed set', () => {
    const extrema = bookItemsForLesson('kbl-math-s2-nccd-u6_l3').filter(
      i => i.source.sourceId === 'math-s2-student-book' && i.kind === 'exercise',
    );
    // 1 and 3-10: item 2 is a near-duplicate of item 1 (see the extractor's TABLE)
    assert.deepEqual(extrema.map(i => i.source.number).sort((a, b) => a - b), [1, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const i of extrema) {
      assert.deepEqual([i.status, i.printedAnswer, i.check], ['computed', null, null], i.id);
      const labels = i.computedAnswer.split('\n').filter(l => ARABIC.test(l));
      assert.ok(labels.length > 0 && labels.every(l => EXTREMA_PHRASES.has(l)), i.id);
    }
    const eight = extrema.find(i => i.source.number === 8)!;
    assert.equal(eight.computedAnswer, 'لا توجد قيم عظمى أو صغرى محلية'); // 2x³ + 7: f′ does not change sign
    assert.equal(bookCitation(eight, 'ar'), 'كتاب الطالب ص ٧٤، س ٨');
  });

  it('verifies a word problem only where every part of its key is printed, by exact value and unit', () => {
    const t = (id: string) => items.find(i => i.id === `bi-math-s2-student-book-${id}`)!;
    assert.deepEqual(
      ['u6l3-t9', 'u6l2-t11', 'u6l2-t12', 'u6l2-t24', 'u6l3-t25'].map(id => t(id).status),
      ['verified', 'verified', 'verified', 'verified', 'verified'],
    );
    assert.deepEqual(['u6l2-t5', 'u6l2-t6', 'u6l2-t7', 'u6l3-t10'].map(id => t(id).status), ['computed', 'computed', 'computed', 'computed']);
    // the same re-check, fed edits: a rounded value, another unit, a missing part, another name
    const edit = (id: string, printedAnswer: string) => verifiedDisagreements([{ ...t(id), printedAnswer }]);
    assert.deepEqual(edit('u6l3-t9', 'x = √51'), [t('u6l3-t9').id]);
    assert.deepEqual(edit('u6l2-t12', '-16 s'), [t('u6l2-t12').id]);
    assert.deepEqual(edit('u6l2-t11', '4 m/s'), [t('u6l2-t11').id]);
    assert.deepEqual(edit('u6l3-t25', 'c = 3'), [t('u6l3-t25').id]);
    assert.deepEqual(['u6l3-t9', 'u6l2-t11', 'u6l2-t12'].flatMap(id => verifiedDisagreements([t(id)])), []);
  });

  it('draws only the graph questions whose curve the question fixes, and never verifies them', () => {
    const drawn = items.filter(i => i.visual);
    assert.deepEqual(drawn.map(i => i.id).sort(), [
      'bi-math-s2-student-book-u6l1-t29',
      'bi-math-s2-student-book-u6l2-t32',
      'bi-math-s2-student-book-u6l2-t33',
      'bi-math-s2-student-book-u6l3-t34',
    ]);
    for (const i of drawn) {
      assert.equal(i.visual!.kind, 'function-graph', i.id);
      assert.deepEqual([i.kind, i.status, i.check], ['unit-test', 'computed', null], i.id);
    }
    // 26-28's curve has no formula: no drawing, no item
    for (const n of [26, 27, 28]) assert.ok(!items.some(i => i.id === `bi-math-s2-student-book-u6l3-t${n}`), String(n));
  });

  it('serves the unit-6 test’s six multiple choice as computed, across lessons 6.1-6.3', () => {
    const choices = ['u6_l1', 'u6_l2', 'u6_l3'].flatMap(l =>
      bookItemsForLesson(`kbl-math-s2-nccd-${l}`).filter(
        i => i.source.sourceId === 'math-s2-student-book' && i.kind === 'unit-test-mcq',
      ),
    );
    assert.deepEqual(choices.map(i => i.source.number).sort((a, b) => a - b), [1, 2, 3, 4, 30, 31]);
    for (const i of choices) {
      // the guide circles its key, which the text layer does not carry: never verified
      assert.deepEqual([i.status, i.printedAnswer, i.check], ['computed', null, null], i.id);
      assert.equal(bookStatusLabel(i, 'ar'), 'الحل محسوب من نص السؤال');
    }
    const three = choices.find(i => i.source.number === 3)!;
    assert.equal(bookCitation(three, 'ar'), 'كتاب الطالب ص ٧٦، اختبار نهاية الوحدة ٦، س ٣');
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
