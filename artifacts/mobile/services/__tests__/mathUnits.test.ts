import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNITS,
  UNIT_CATEGORIES,
  convert,
  defaultPair,
  getUnit,
  unitsFor,
  type UnitCategory,
} from '../mathUnits.ts';

function ok(raw: string, from: string, to: string): number {
  const r = convert(raw, from, to);
  assert.ok(r.ok, `expected ${raw} ${from}→${to} to convert, got ${JSON.stringify(r)}`);
  return r.value;
}
function fail(raw: string, from: string, to: string): string {
  const r = convert(raw, from, to);
  assert.ok(!r.ok, `expected ${raw} ${from}→${to} to fail, got ${JSON.stringify(r)}`);
  return r.reason;
}
function close(actual: number, expected: number, rel = 1e-12) {
  const tol = Math.max(Math.abs(expected) * rel, 1e-12);
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);
}

describe('the unit table', () => {
  it('has unique ids and a name in both languages and a symbol for every unit', () => {
    const ids = UNITS.map(u => u.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const u of UNITS) {
      assert.ok(u.ar.trim().length > 0, `${u.id} ar`);
      assert.ok(u.en.trim().length > 0, `${u.id} en`);
      assert.ok(u.symbol.trim().length > 0, `${u.id} symbol`);
    }
  });
  it('every category has at least two units, so there is something to convert to', () => {
    for (const c of UNIT_CATEGORIES) assert.ok(unitsFor(c).length >= 2, c);
  });
  it('every unit belongs to a listed category', () => {
    for (const u of UNITS) assert.ok((UNIT_CATEGORIES as readonly string[]).includes(u.category), u.id);
  });
  it('round-trips through the base unit for every unit', () => {
    for (const u of UNITS) {
      for (const v of [0.001, 1, 36.6, 1234.5]) {
        close(u.fromBase(u.toBase(v)), v, 1e-12);
      }
    }
  });
  it('getUnit resolves a known id and nothing else, not even inherited keys', () => {
    assert.equal(getUnit('cm')?.category, 'length');
    assert.equal(getUnit('nope'), undefined);
    assert.equal(getUnit('constructor'), undefined);
    assert.equal(getUnit('__proto__'), undefined);
  });
});

describe('convert: values', () => {
  it('length', () => {
    close(ok('1', 'mi', 'm'), 1609.344);
    close(ok('1', 'km', 'm'), 1000);
    close(ok('1', 'in', 'cm'), 2.54);
    close(ok('12', 'in', 'ft'), 1);
    close(ok('1', 'yd', 'ft'), 3);
  });
  it('mass', () => {
    close(ok('1', 'lb', 'g'), 453.59237);
    close(ok('1', 't', 'kg'), 1000);
    close(ok('16', 'oz', 'lb'), 1);
  });
  it('time', () => {
    close(ok('1', 'h', 'min'), 60);
    close(ok('1', 'd', 'h'), 24);
    close(ok('1500', 'ms', 's'), 1.5);
  });
  it('area, including the Jordanian dunum (1000 m²)', () => {
    close(ok('1', 'dunum', 'm2'), 1000);
    close(ok('1', 'ha', 'm2'), 10000);
    close(ok('1', 'ha', 'dunum'), 10);
    close(ok('1', 'km2', 'ha'), 100);
    close(ok('1', 'm2', 'cm2'), 10000);
  });
  it('volume', () => {
    close(ok('1', 'l', 'cm3'), 1000);
    close(ok('1', 'm3', 'l'), 1000);
    close(ok('1', 'ml', 'cm3'), 1);
  });
  it('angle', () => {
    close(ok('180', 'deg', 'rad'), Math.PI);
    close(ok('1', 'turn', 'deg'), 360);
    close(ok('90', 'deg', 'turn'), 0.25);
  });
  it('speed', () => {
    close(ok('36', 'kmh', 'mps'), 10);
    close(ok('1', 'mph', 'kmh'), 1.609344);
    close(ok('1', 'kn', 'kmh'), 1.852);
  });
  it('temperature is affine, not a factor', () => {
    close(ok('0', 'celsius', 'fahrenheit'), 32);
    close(ok('100', 'celsius', 'fahrenheit'), 212);
    close(ok('0', 'celsius', 'kelvin'), 273.15);
    close(ok('32', 'fahrenheit', 'celsius'), 0);
    close(ok('-40', 'celsius', 'fahrenheit'), -40);
    close(ok('300', 'kelvin', 'celsius'), 26.85);
  });
  it('the same unit gives the same number back', () => {
    assert.equal(ok('12.5', 'cm', 'cm'), 12.5);
  });
  it('trims floating-point noise', () => {
    assert.equal(ok('100', 'celsius', 'fahrenheit'), 212);
    assert.equal(ok('1', 'in', 'cm'), 2.54);
  });
});

describe('convert: what a teacher types', () => {
  it('Arabic-Indic digits and the Arabic decimal mark', () => {
    close(ok('١٢٫٥', 'cm', 'm'), 0.125);
  });
  it('a comma as the decimal mark, but never a thousands mark', () => {
    close(ok('1,5', 'm', 'cm'), 150);
    assert.equal(fail('1,000', 'm', 'cm'), 'bad-number');
  });
  it('signs, including the real minus sign', () => {
    close(ok('-5', 'celsius', 'fahrenheit'), 23);
    close(ok('−5', 'celsius', 'fahrenheit'), 23);
    close(ok('+3', 'm', 'cm'), 300);
  });
  it('scientific notation', () => {
    close(ok('1e3', 'm', 'km'), 1);
  });
  it('surrounding spaces are fine', () => {
    close(ok('  7  ', 'km', 'm'), 7000);
  });
});

describe('convert: fails closed with a named reason', () => {
  it('empty and unparseable input', () => {
    assert.equal(fail('', 'cm', 'm'), 'empty');
    assert.equal(fail('   ', 'cm', 'm'), 'empty');
    assert.equal(fail('abc', 'cm', 'm'), 'bad-number');
    assert.equal(fail('1.2.3', 'cm', 'm'), 'bad-number');
    assert.equal(fail('Infinity', 'cm', 'm'), 'bad-number');
    assert.equal(fail('-', 'cm', 'm'), 'bad-number');
    assert.equal(fail('--5', 'cm', 'm'), 'bad-number');
  });
  it('unknown units', () => {
    assert.equal(fail('1', 'nope', 'm'), 'unknown-unit');
    assert.equal(fail('1', 'm', 'nope'), 'unknown-unit');
    assert.equal(fail('1', 'constructor', 'm'), 'unknown-unit');
  });
  it('a conversion across categories is refused, never computed', () => {
    assert.equal(fail('1', 'cm', 'kg'), 'category-mismatch');
    assert.equal(fail('1', 'celsius', 'm'), 'category-mismatch');
    assert.equal(fail('1', 'm2', 'm'), 'category-mismatch');
  });
  it('below absolute zero', () => {
    assert.equal(fail('-300', 'celsius', 'kelvin'), 'below-absolute-zero');
    assert.equal(fail('-500', 'fahrenheit', 'celsius'), 'below-absolute-zero');
    assert.equal(fail('-0.01', 'kelvin', 'celsius'), 'below-absolute-zero');
    close(ok('-273.15', 'celsius', 'kelvin'), 0);
  });
  it('a result too large to represent', () => {
    assert.equal(fail('1e308', 'm', 'mm'), 'overflow');
  });
});

describe('unitsFor', () => {
  it('returns only that category, in table order', () => {
    const lengths = unitsFor('length' satisfies UnitCategory).map(u => u.id);
    assert.deepEqual(lengths, ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi']);
  });
});

describe('defaultPair', () => {
  it('is two different units of the category, so the converter opens with a real conversion', () => {
    for (const c of UNIT_CATEGORIES) {
      const [from, to] = defaultPair(c);
      assert.equal(getUnit(from)?.category, c, `${c} from`);
      assert.equal(getUnit(to)?.category, c, `${c} to`);
      assert.notEqual(from, to, c);
      assert.ok(convert('1', from, to).ok, c);
    }
  });
  it('starts from the units a Jordanian classroom reaches for', () => {
    assert.deepEqual(defaultPair('length'), ['cm', 'm']);
    assert.deepEqual(defaultPair('temperature'), ['celsius', 'fahrenheit']);
    assert.deepEqual(defaultPair('area'), ['m2', 'dunum']);
  });
});
