/**
 * Quick arithmetic drills (×, ÷, +, −) — the pure half (config, problems, chat trigger).
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/mathDrill.test.ts
 *
 * A drill is generated from its config, so a /play/multiply, /play/divide or
 * /play/add link *is* the assignment a teacher hands out. Its params are
 * therefore untrusted input from anyone, and must never crash the page or
 * yield an empty drill.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ADD_MAX,
  DEFAULT_SECONDS,
  defaultMaxForGrade,
  defaultTablesForGrade,
  drillAskOp,
  drillPath,
  drillReducer,
  drillShareUrl,
  nextProblem,
  parseDrillParams,
  startDrill,
  tablesLabel,
  type DrillConfig,
  type DrillOp,
  type DrillProblem,
} from '../publicGames/mathDrill.ts';
import { makeRng } from '../publicGames/rng.ts';

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('parseDrillParams', () => {
  it('defaults when nothing is given', () => {
    assert.deepEqual(parseDrillParams('mul', {}), { op: 'mul', tables: ALL, max: DEFAULT_ADD_MAX, seconds: DEFAULT_SECONDS });
    assert.deepEqual(parseDrillParams('add', {}), { op: 'add', tables: ALL, max: DEFAULT_ADD_MAX, seconds: DEFAULT_SECONDS });
  });

  it('reads lists and ranges, sorted and de-duplicated', () => {
    assert.deepEqual(parseDrillParams('mul', { tables: '2-5' }).tables, [2, 3, 4, 5]);
    assert.deepEqual(parseDrillParams('div', { tables: '5,2,2' }).tables, [2, 5]);
    assert.deepEqual(parseDrillParams('mul', { tables: '1-3,7' }).tables, [1, 2, 3, 7]);
  });

  it('drops junk and falls back when nothing valid is left', () => {
    assert.deepEqual(parseDrillParams('mul', { tables: '3,x,11,0' }).tables, [3]);
    assert.deepEqual(parseDrillParams('mul', { tables: '0,11,x' }).tables, ALL);
    assert.deepEqual(parseDrillParams('mul', { tables: '9-2' }).tables, ALL);
    assert.deepEqual(parseDrillParams('mul', { tables: '1-999999999' }).tables, ALL);
  });

  it('only allows 30, 60 or 90 seconds', () => {
    assert.equal(parseDrillParams('mul', { secs: '30' }).seconds, 30);
    assert.equal(parseDrillParams('add', { secs: '90' }).seconds, 90);
    assert.equal(parseDrillParams('mul', { secs: '999' }).seconds, DEFAULT_SECONDS);
    assert.equal(parseDrillParams('mul', { secs: 'abc' }).seconds, DEFAULT_SECONDS);
  });

  it('only allows sums up to 10, 20 or 100', () => {
    assert.equal(parseDrillParams('add', { max: '10' }).max, 10);
    assert.equal(parseDrillParams('add', { max: '100' }).max, 100);
    assert.equal(parseDrillParams('add', { max: '50' }).max, DEFAULT_ADD_MAX);
    assert.equal(parseDrillParams('add', { max: 'x' }).max, DEFAULT_ADD_MAX);
  });

  it('takes the first value when a param is repeated', () => {
    const c = parseDrillParams('mul', { tables: ['4', '9'], secs: ['30', '90'] });
    assert.deepEqual([c.tables, c.seconds], [[4], 30]);
  });
});

function drawMany(config: DrillConfig, n: number, seed: number, check: (p: DrillProblem) => void) {
  const rng = makeRng(seed);
  let prev: DrillProblem | undefined;
  for (let i = 0; i < n; i++) {
    const p = nextProblem(config, rng, prev);
    check(p);
    if (prev) assert.ok(!(p.a === prev.a && p.b === prev.b), `repeat ${p.a},${p.b}`);
    prev = p;
  }
}

describe('nextProblem', () => {
  const base = { tables: [3, 7], max: 20, seconds: 60 };

  it('multiplication: correct answer, a factor from the tables, no back-to-back repeat', () => {
    drawMany({ ...base, op: 'mul' }, 200, 42, p => {
      assert.equal(p.answer, p.a * p.b);
      assert.ok(base.tables.includes(p.a) || base.tables.includes(p.b), `${p.a}×${p.b}`);
      assert.ok(p.a >= 1 && p.a <= 10 && p.b >= 1 && p.b <= 10);
    });
  });

  it('division: always exact, divisor from the tables, quotient 1–10', () => {
    drawMany({ ...base, op: 'div' }, 200, 42, p => {
      assert.ok(base.tables.includes(p.b), `÷${p.b}`);
      assert.equal(p.a % p.b, 0);
      assert.equal(p.answer, p.a / p.b);
      assert.ok(p.answer >= 1 && p.answer <= 10);
    });
  });

  for (const max of [10, 20, 100]) {
    it(`addition: both addends positive and the sum never above ${max}`, () => {
      drawMany({ ...base, op: 'add', max }, 300, max, p => {
        assert.equal(p.answer, p.a + p.b);
        assert.ok(p.a >= 1 && p.b >= 1, `${p.a}+${p.b}`);
        assert.ok(p.answer <= max, `${p.a}+${p.b}`);
      });
    });
  }

  for (const max of [10, 20, 100]) {
    it(`subtraction: never negative, first number within ${max}, second at least 1`, () => {
      drawMany({ ...base, op: 'sub', max }, 300, max + 1, p => {
        assert.equal(p.answer, p.a - p.b);
        assert.ok(p.b >= 1 && p.b <= p.a, `${p.a}−${p.b}`);
        assert.ok(p.a <= max, `${p.a}−${p.b}`);
        assert.ok(p.answer >= 0);
      });
    });
  }

  it('subtraction includes zero answers (decided: 7 − 7 = 0 is allowed)', () => {
    const rng = makeRng(3);
    let zeros = 0;
    for (let i = 0; i < 300; i++) if (nextProblem({ ...base, op: 'sub', max: 10 }, rng).answer === 0) zeros++;
    assert.ok(zeros > 0);
  });

  it('still avoids a repeat with a single table', () => {
    drawMany({ ...base, op: 'mul', tables: [1] }, 50, 7, () => {});
    drawMany({ ...base, op: 'div', tables: [1] }, 50, 7, () => {});
  });
});

describe('grade defaults', () => {
  it('keeps the first two grades to the small tables', () => {
    assert.deepEqual(defaultTablesForGrade('grade-1'), [1, 2, 3, 4, 5]);
    assert.deepEqual(defaultTablesForGrade('grade-2'), [1, 2, 3, 4, 5]);
    assert.deepEqual(defaultTablesForGrade('grade-4'), ALL);
    assert.deepEqual(defaultTablesForGrade(null), ALL);
  });

  it('grows the addition range with the grade', () => {
    assert.equal(defaultMaxForGrade('grade-1'), 10);
    assert.equal(defaultMaxForGrade('grade-2'), 20);
    assert.equal(defaultMaxForGrade('grade-3'), 100);
    assert.equal(defaultMaxForGrade('grade-10'), 100);
    assert.equal(defaultMaxForGrade(null), DEFAULT_ADD_MAX);
  });
});

describe('drillShareUrl / drillPath', () => {
  const roundTrip = (url: string, op: DrillOp) => {
    const q = new URL(url).searchParams;
    const get = (k: string) => q.get(k) ?? undefined;
    return parseDrillParams(op, { tables: get('tables'), max: get('max'), secs: get('secs') });
  };

  it('multiplication and division links carry their tables', () => {
    const mul: DrillConfig = { op: 'mul', tables: [2, 3], max: 20, seconds: 30 };
    assert.equal(drillShareUrl(mul, 'http://localhost:8081'), 'http://localhost:8081/play/multiply?tables=2,3&secs=30');
    assert.deepEqual(roundTrip(drillShareUrl(mul, 'http://x'), 'mul'), mul);

    const div: DrillConfig = { op: 'div', tables: [5], max: 20, seconds: 60 };
    assert.equal(drillPath(div), '/play/divide?tables=5&secs=60');
    assert.deepEqual(roundTrip(drillShareUrl(div, 'http://x'), 'div'), div);
  });

  it('addition and subtraction links carry the range, not tables', () => {
    const add: DrillConfig = { op: 'add', tables: ALL, max: 10, seconds: 90 };
    assert.equal(drillPath(add), '/play/add?max=10&secs=90');
    assert.deepEqual(roundTrip(drillShareUrl(add, 'http://x'), 'add'), add);

    const sub: DrillConfig = { op: 'sub', tables: ALL, max: 20, seconds: 60 };
    assert.equal(drillPath(sub), '/play/subtract?max=20&secs=60');
    assert.deepEqual(roundTrip(drillShareUrl(sub, 'http://x'), 'sub'), sub);
  });

  it('falls back to production when there is no origin (native)', () => {
    assert.match(
      drillShareUrl({ op: 'mul', tables: [5], max: 20, seconds: 60 }, ''),
      /^https:\/\/app\.iqrra\.com\/play\/multiply\?/,
    );
  });
});

describe('drillReducer', () => {
  const p = (a: number, b: number): DrillProblem => ({ op: 'mul', a, b, answer: a * b });
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

describe('drillAskOp', () => {
  const asks: Array<[string, DrillOp]> = [
    ['help make game to teach my grade one studnet multibly in math', 'mul'],
    ['help make a game to teach my grade one student multiply in math', 'mul'],
    ['لعبة جدول الضرب', 'mul'],
    ['times table drill', 'mul'],
    ['multiplication practice for grade 3', 'mul'],
    ['division game for grade 4', 'div'],
    ['a drill to practice dividing', 'div'],
    ['لعبة القسمة للصف الرابع', 'div'],
    ['تدريب على القسمه', 'div'],
    ['addition game for grade one', 'add'],
    ['plus drill', 'add'],
    ['practice sums to 20', 'add'],
    ['لعبة الجمع للصف الأول', 'add'],
    ['تمرين جمع سريع', 'add'],
    ['a game for addition and multiplication', 'add'],
    ['لعبة ضرب وجمع', 'mul'],
    ['subtraction game for grade 2', 'sub'],
    ['minus drill', 'sub'],
    ['take away practice for grade one', 'sub'],
    ['a game to practice subtracting', 'sub'],
    ['لعبة الطرح للصف الأول', 'sub'],
    ['تدريب طرح سريع', 'sub'],
    ['لعبة جمع وطرح', 'add'],
  ];
  for (const [q, op] of asks) {
    it(`"${q}" → ${op}`, () => assert.equal(drillAskOp(q), op));
  }

  const notAsks = [
    'explain multiplication',
    'اشرح الضرب',
    'make a game about fractions',
    'لعبة عن الكسور',
    'خطة درس',
    'add a practice game about fractions',
    'a game to summarize the lesson',
    'explain long division',
    'نشاط جماعي للصف',
    // «طرح» also means "to put forward": asking questions, raising ideas.
    'لعبة لطرح الأسئلة على الطلبة',
    'لعبة طرح أسئلة سريعة',
    'نشاط تدريب على طرح الأفكار',
    'لعبة طرح سؤال',
  ];
  for (const q of notAsks) {
    it(`"${q}" is not a drill ask`, () => assert.equal(drillAskOp(q), null));
  }
});
