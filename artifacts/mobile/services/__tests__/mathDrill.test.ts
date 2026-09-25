/**
 * Quick multiplication drill — the pure half (config, problems, chat trigger).
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/mathDrill.test.ts
 *
 * The drill is generated from its config, so a /play/multiply link *is* the
 * assignment a teacher hands out. Its params are therefore untrusted input
 * from anyone, and must never crash the page or yield an empty table set.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SECONDS,
  defaultTablesForGrade,
  drillReducer,
  drillShareUrl,
  isMultiplicationDrillAsk,
  nextProblem,
  parseDrillParams,
  startDrill,
  tablesLabel,
} from '../publicGames/mathDrill.ts';
import { makeRng } from '../publicGames/rng.ts';

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('parseDrillParams', () => {
  it('defaults when nothing is given', () => {
    assert.deepEqual(parseDrillParams({}), { tables: ALL, seconds: DEFAULT_SECONDS });
  });

  it('reads lists and ranges, sorted and de-duplicated', () => {
    assert.deepEqual(parseDrillParams({ tables: '2-5' }).tables, [2, 3, 4, 5]);
    assert.deepEqual(parseDrillParams({ tables: '5,2,2' }).tables, [2, 5]);
    assert.deepEqual(parseDrillParams({ tables: '1-3,7' }).tables, [1, 2, 3, 7]);
  });

  it('drops junk and falls back when nothing valid is left', () => {
    assert.deepEqual(parseDrillParams({ tables: '3,x,11,0' }).tables, [3]);
    assert.deepEqual(parseDrillParams({ tables: '0,11,x' }).tables, ALL);
    assert.deepEqual(parseDrillParams({ tables: '9-2' }).tables, ALL);
    assert.deepEqual(parseDrillParams({ tables: '1-999999999' }).tables, ALL);
  });

  it('only allows 30, 60 or 90 seconds', () => {
    assert.equal(parseDrillParams({ secs: '30' }).seconds, 30);
    assert.equal(parseDrillParams({ secs: '90' }).seconds, 90);
    assert.equal(parseDrillParams({ secs: '999' }).seconds, DEFAULT_SECONDS);
    assert.equal(parseDrillParams({ secs: 'abc' }).seconds, DEFAULT_SECONDS);
  });

  it('takes the first value when a param is repeated', () => {
    assert.deepEqual(parseDrillParams({ tables: ['4', '9'], secs: ['30', '90'] }), { tables: [4], seconds: 30 });
  });
});

describe('nextProblem', () => {
  it('always has a correct answer, a factor from the tables, and no back-to-back repeat', () => {
    const rng = makeRng(42);
    const tables = [3, 7];
    let prev = undefined as ReturnType<typeof nextProblem> | undefined;
    for (let i = 0; i < 200; i++) {
      const p = nextProblem(tables, rng, prev);
      assert.equal(p.answer, p.a * p.b);
      assert.ok(tables.includes(p.a) || tables.includes(p.b), `${p.a}×${p.b}`);
      assert.ok(p.a >= 1 && p.a <= 10 && p.b >= 1 && p.b <= 10);
      if (prev) assert.ok(!(p.a === prev.a && p.b === prev.b), `repeat ${p.a}×${p.b}`);
      prev = p;
    }
  });

  it('still avoids a repeat with a single table', () => {
    const rng = makeRng(7);
    let prev = nextProblem([1], rng);
    for (let i = 0; i < 50; i++) {
      const p = nextProblem([1], rng, prev);
      assert.ok(!(p.a === prev.a && p.b === prev.b));
      prev = p;
    }
  });
});

describe('defaultTablesForGrade', () => {
  it('keeps the first two grades to the small tables', () => {
    assert.deepEqual(defaultTablesForGrade('grade-1'), [1, 2, 3, 4, 5]);
    assert.deepEqual(defaultTablesForGrade('grade-2'), [1, 2, 3, 4, 5]);
    assert.deepEqual(defaultTablesForGrade('grade-4'), ALL);
    assert.deepEqual(defaultTablesForGrade(null), ALL);
  });
});

describe('drillShareUrl', () => {
  it('builds a link that parses back to the same drill', () => {
    const url = drillShareUrl({ tables: [2, 3], seconds: 30 }, 'http://localhost:8081');
    assert.equal(url, 'http://localhost:8081/play/multiply?tables=2,3&secs=30');
    const q = new URL(url).searchParams;
    assert.deepEqual(
      parseDrillParams({ tables: q.get('tables') ?? undefined, secs: q.get('secs') ?? undefined }),
      { tables: [2, 3], seconds: 30 },
    );
  });

  it('falls back to production when there is no origin (native)', () => {
    assert.match(drillShareUrl({ tables: [5], seconds: 60 }, ''), /^https:\/\/app\.iqrra\.com\/play\/multiply\?/);
  });
});

describe('drillReducer', () => {
  const p = (a: number, b: number) => ({ a, b, answer: a * b });
  const upcoming = p(2, 2);

  it('counts a right answer the moment the digits match, and moves on', () => {
    let s = startDrill(p(7, 8));
    s = drillReducer(s, { type: 'digit', digit: '5', upcoming });
    assert.equal(s.typed, '5');
    s = drillReducer(s, { type: 'digit', digit: '6', upcoming });
    assert.deepEqual(s, { problem: upcoming, typed: '', correct: 1, attempted: 1, wrong: false });
  });

  it('marks a wrong answer once enough digits are typed, and freezes input', () => {
    let s = startDrill(p(7, 8));
    s = drillReducer(s, { type: 'digit', digit: '4', upcoming });
    s = drillReducer(s, { type: 'digit', digit: '9', upcoming });
    assert.equal(s.wrong, true);
    assert.equal(s.attempted, 1);
    assert.equal(s.correct, 0);
    assert.equal(drillReducer(s, { type: 'digit', digit: '1', upcoming }), s);
    assert.equal(drillReducer(s, { type: 'backspace' }), s);
    s = drillReducer(s, { type: 'next', upcoming });
    assert.deepEqual(s, { problem: upcoming, typed: '', correct: 0, attempted: 1, wrong: false });
  });

  it('lets a digit be corrected before the answer is complete', () => {
    let s = startDrill(p(7, 8));
    s = drillReducer(s, { type: 'digit', digit: '4', upcoming });
    s = drillReducer(s, { type: 'backspace' });
    s = drillReducer(s, { type: 'digit', digit: '5', upcoming });
    s = drillReducer(s, { type: 'digit', digit: '6', upcoming });
    assert.equal(s.correct, 1);
  });

  it('handles one-digit and three-digit answers', () => {
    let s = drillReducer(startDrill(p(2, 3)), { type: 'digit', digit: '6', upcoming });
    assert.equal(s.correct, 1);
    s = startDrill(p(10, 10));
    for (const d of '100') s = drillReducer(s, { type: 'digit', digit: d, upcoming });
    assert.equal(s.correct, 1);
  });

  it('ignores anything that is not a single digit', () => {
    const s = startDrill(p(3, 3));
    assert.equal(drillReducer(s, { type: 'digit', digit: 'a', upcoming }), s);
    assert.equal(drillReducer(s, { type: 'digit', digit: '12', upcoming }), s);
  });
});

describe('tablesLabel', () => {
  it('compresses runs of three or more', () => {
    assert.equal(tablesLabel([1, 2, 3, 4, 5]), '1–5');
    assert.equal(tablesLabel([2, 3]), '2, 3');
    assert.equal(tablesLabel([1, 2, 3, 7, 9, 10]), '1–3, 7, 9, 10');
    assert.equal(tablesLabel([2, 5], '، '), '2، 5');
  });
});

describe('isMultiplicationDrillAsk', () => {
  const asks = [
    'help make game to teach my grade one studnet multibly in math',
    'help make a game to teach my grade one student multiply in math',
    'لعبة جدول الضرب',
    'بدي تدريب على الضرب للصف الثالث',
    'times table drill',
    'multiplication practice for grade 3',
  ];
  for (const q of asks) {
    it(`"${q}" is a drill ask`, () => assert.equal(isMultiplicationDrillAsk(q), true));
  }

  const notAsks = [
    'explain multiplication',
    'اشرح الضرب',
    'make a game about fractions',
    'لعبة عن الكسور',
    'خطة درس',
  ];
  for (const q of notAsks) {
    it(`"${q}" is not`, () => assert.equal(isMultiplicationDrillAsk(q), false));
  }
});
