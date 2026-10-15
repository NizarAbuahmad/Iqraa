import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  displayLtr,
  entriesToDisplay,
  entriesToSegments,
  entriesToSource,
  formatCalcNumber,
  initialCalcState,
  forceLtr,
  press,
  pressAll,
  recall,
  type CalcKey,
} from '../mathCalc.ts';

const keys = (s: string): CalcKey[] => s.split(' ') as CalcKey[];

describe('press: evaluating', () => {
  it('evaluates 2+3 and keeps the typed expression on screen', () => {
    const s = pressAll(initialCalcState(), keys('2 + 3 ='), 'deg');
    assert.deepEqual(s.result, { ok: true, value: 5 });
    assert.equal(entriesToSource(s.entries), '2+3');
    assert.equal(s.ans, 5);
    assert.equal(s.history.length, 1);
  });

  it('closes open brackets on =', () => {
    const s = pressAll(initialCalcState(), keys('sin 3 0 ='), 'deg');
    assert.deepEqual(s.result, { ok: true, value: 0.5 });
  });

  it('respects the angle mode', () => {
    const deg = pressAll(initialCalcState(), keys('sin 9 0 ='), 'deg');
    assert.deepEqual(deg.result, { ok: true, value: 1 });
    const rad = pressAll(initialCalcState(), keys('sin 0 ='), 'rad');
    assert.deepEqual(rad.result, { ok: true, value: 0 });
  });

  it('the square key appends ^2', () => {
    const s = pressAll(initialCalcState(), keys('5 x2 ='), 'deg');
    assert.deepEqual(s.result, { ok: true, value: 25 });
  });
});

describe('press: editing', () => {
  it('DEL removes a whole function key, not one letter of it', () => {
    let s = pressAll(initialCalcState(), keys('sin'), 'deg');
    assert.deepEqual(s.entries, ['sin(']);
    s = press(s, 'DEL', 'deg');
    assert.deepEqual(s.entries, []);
  });

  it('DEL removes the last digit', () => {
    const s = pressAll(initialCalcState(), keys('1 2 DEL'), 'deg');
    assert.equal(entriesToSource(s.entries), '1');
  });

  it('DEL on an empty line does nothing', () => {
    const s = press(initialCalcState(), 'DEL', 'deg');
    assert.deepEqual(s.entries, []);
  });

  it('AC clears the line but keeps history and Ans', () => {
    const s = pressAll(initialCalcState(), keys('2 + 3 = AC'), 'deg');
    assert.deepEqual(s.entries, []);
    assert.equal(s.result, null);
    assert.equal(s.ans, 5);
    assert.equal(s.history.length, 1);
  });
});

describe('press: after =', () => {
  it('a digit starts a fresh expression', () => {
    const s = pressAll(initialCalcState(), keys('2 + 3 = 7'), 'deg');
    assert.deepEqual(s.entries, ['7']);
    assert.equal(s.result, null);
  });

  it('an operator continues from the answer', () => {
    const s = pressAll(initialCalcState(), keys('2 + 3 = * 4 ='), 'deg');
    assert.equal(entriesToSource(s.entries), 'Ans*4');
    assert.deepEqual(s.result, { ok: true, value: 20 });
  });

  it('the Ans key recalls the last answer', () => {
    const s = pressAll(initialCalcState(), keys('2 + 3 = ans * 2 ='), 'deg');
    assert.deepEqual(s.result, { ok: true, value: 10 });
  });
});

describe('press: errors', () => {
  it('keeps the expression, the old Ans and the history, and names the failure', () => {
    const s = pressAll(initialCalcState(), keys('1 / 0 ='), 'deg');
    assert.deepEqual(s.result, { ok: false, reason: 'divide-by-zero' });
    assert.equal(entriesToSource(s.entries), '1/0');
    assert.equal(s.ans, null);
    assert.equal(s.history.length, 0);
  });

  it('an error leaves the line editable: the next digit extends it', () => {
    const s = pressAll(initialCalcState(), keys('1 / 0 = 5'), 'deg');
    assert.equal(entriesToSource(s.entries), '1/05');
  });

  it('a failed = after a good one leaves Ans alone', () => {
    const s = pressAll(initialCalcState(), keys('2 + 3 = AC sqrt - 4 ='), 'deg');
    assert.deepEqual(s.result, { ok: false, reason: 'domain' });
    assert.equal(s.ans, 5);
  });
});

describe('history', () => {
  it('is newest first and capped at 20', () => {
    let s = initialCalcState();
    for (let i = 1; i <= 25; i += 1) {
      s = pressAll(s, ['AC', ...String(i).split('')] as CalcKey[], 'deg');
      s = press(s, '=', 'deg');
    }
    assert.equal(s.history.length, 20);
    assert.equal(s.history[0].value, 25);
    assert.equal(s.history[19].value, 6);
  });
});

describe('recall', () => {
  it('puts a history line back on the line for editing', () => {
    const done = pressAll(initialCalcState(), keys('2 + 3 ='), 'deg');
    const s = recall(done, done.history[0]);
    assert.equal(entriesToSource(s.entries), '2+3');
    assert.equal(s.result, null);
    assert.equal(s.ans, 5);
    assert.equal(s.history.length, 1);
  });
  it('a digit typed after a recall extends the line instead of replacing it', () => {
    const done = pressAll(initialCalcState(), keys('2 + 3 ='), 'deg');
    const s = press(recall(done, done.history[0]), '4', 'deg');
    assert.equal(entriesToSource(s.entries), '2+34');
  });
});

describe('entriesToDisplay', () => {
  const entries = ['sin(', '3', '0', ')', '*', '2', '-', '1', '.', '5', '/', 'pi'];
  it('English keeps latin digits and uses × ÷ − π', () => {
    assert.equal(entriesToDisplay(entries, 'en'), 'sin(30)×2−1.5÷π');
  });
  it('Arabic uses Arabic-Indic digits, ٫, and the book names', () => {
    assert.equal(entriesToDisplay(entries, 'ar'), 'جا(٣٠)×٢−١٫٥÷π');
  });
  it('maps the other function keys', () => {
    assert.equal(entriesToDisplay(['sqrt(', '9', ')'], 'en'), '√(9)');
    assert.equal(entriesToDisplay(['cos(', '6', '0', ')'], 'ar'), 'جتا(٦٠)');
    assert.equal(entriesToDisplay(['tan(', '4', '5', ')'], 'ar'), 'ظا(٤٥)');
    assert.equal(entriesToDisplay(['asin(', '1', ')'], 'en'), 'sin⁻¹(1)');
    assert.equal(entriesToDisplay(['5', '^2'], 'en'), '5²');
  });
  it('the source side stays latin whatever the language', () => {
    assert.equal(entriesToSource(entries), 'sin(30)*2-1.5/pi');
  });
});

describe('formatCalcNumber', () => {
  it('prints ordinary numbers plainly', () => {
    assert.deepEqual(formatCalcNumber(0.3, 'en'), { text: '0.3', exponent: null });
    assert.deepEqual(formatCalcNumber(0, 'en'), { text: '0', exponent: null });
    assert.deepEqual(formatCalcNumber(12.5, 'ar'), { text: '١٢٫٥', exponent: null });
  });
  it('uses a real minus sign', () => {
    assert.equal(formatCalcNumber(-5, 'en').text, '−5');
    assert.equal(formatCalcNumber(-5, 'ar').text, '−٥');
  });
  it('trims binary noise to 10 significant digits', () => {
    assert.equal(formatCalcNumber(1 / 3, 'en').text, '0.3333333333');
  });
  it('switches to scientific notation for tiny and huge values', () => {
    assert.deepEqual(formatCalcNumber(1e-7, 'en'), { text: '1 × 10', exponent: '−7' });
    assert.deepEqual(formatCalcNumber(1e21, 'en'), { text: '1 × 10', exponent: '21' });
    assert.deepEqual(formatCalcNumber(123456789012, 'en'), { text: '1.23456789 × 10', exponent: '11' });
    assert.deepEqual(formatCalcNumber(1e-7, 'ar'), { text: '١ × ١٠', exponent: '−٧' });
  });
  it('a negative scientific value keeps its sign on the mantissa', () => {
    assert.equal(formatCalcNumber(-1e-7, 'en').text, '−1 × 10');
  });
});

describe('forceLtr', () => {
  it('wraps display text in a left-to-right override so Arabic-Indic runs keep their order', () => {
    assert.equal(forceLtr('٩٫٥ × ١٠'), '\u202D٩٫٥ × ١٠\u202C');
  });
  it('is applied around a lone bracket too, so it is not mirrored', () => {
    assert.equal(forceLtr('('), '\u202D(\u202C');
  });
  it('leaves an empty string empty', () => {
    assert.equal(forceLtr(''), '');
  });
  it('is display-only: the source side never contains the marks', () => {
    assert.ok(!/[\u202A-\u202E\u2066-\u2069]/.test(entriesToSource(['1', '+', '2'])));
  });
});

describe('displayLtr', () => {
  it('forces LTR on digit and operator text', () => {
    assert.equal(displayLtr('(٣٠)×٢'), '\u202D(٣٠)×٢\u202C');
  });
  it('leaves Arabic words alone: an override would print «جا» as «اج»', () => {
    assert.equal(displayLtr('جا'), 'جا');
    assert.equal(displayLtr('جتا⁻¹'), 'جتا⁻¹');
    assert.equal(displayLtr('س²'), 'س²');
  });
});

describe('entriesToSegments', () => {
  const entries = ['sin(', '3', '0', ')', '*', '2'];
  it('English is one plain run', () => {
    assert.deepEqual(entriesToSegments(entries, 'en'), [{ text: 'sin(30)×2', word: false }]);
  });
  it('Arabic puts each function word on its own, so layout (not bidi) orders it', () => {
    assert.deepEqual(entriesToSegments(entries, 'ar'), [
      { text: 'جا', word: true },
      { text: '(٣٠)×٢', word: false },
    ]);
  });
  it('splits an inverse function into its word and its bracket', () => {
    assert.deepEqual(entriesToSegments(['asin(', '1', ')'], 'ar'), [
      { text: 'جا⁻¹', word: true },
      { text: '(١)', word: false },
    ]);
  });
  it('several words alternate with the runs between them, in typed order', () => {
    assert.deepEqual(entriesToSegments(['sin(', '3', '0', ')', '+', 'cos(', '6', '0', ')'], 'ar'), [
      { text: 'جا', word: true },
      { text: '(٣٠)+', word: false },
      { text: 'جتا', word: true },
      { text: '(٦٠)', word: false },
    ]);
  });
  it('the segments rejoin to exactly entriesToDisplay', () => {
    for (const lang of ['ar', 'en'] as const) {
      const e = ['tan(', '4', '5', ')', '/', 'pi', '^2'];
      assert.equal(entriesToSegments(e, lang).map(x => x.text).join(''), entriesToDisplay(e, lang));
    }
  });
  it('an empty line has no segments', () => {
    assert.deepEqual(entriesToSegments([], 'ar'), []);
  });
});
