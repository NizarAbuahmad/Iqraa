/**
 * The Math Corner's unit converter. Pure and free of react-native.
 *
 * Every unit knows how to reach its category's base unit and come back, so a
 * conversion is `from → base → to`. Most are a plain factor; temperature is
 * affine, which is why this is a pair of functions and not a number.
 *
 * Fails closed: a conversion across categories, an unknown unit, an
 * unparseable number or a temperature below absolute zero returns a named
 * reason, never a number. The unit names are our own chrome text, not
 * curriculum Arabic. The dunum is 1000 m², the Jordanian land measure.
 */
import { toLatinDigits } from './latinDigits.ts';
import { parseLabNumber } from './labFormat.ts';

export const UNIT_CATEGORIES = [
  'length',
  'mass',
  'time',
  'area',
  'volume',
  'angle',
  'temperature',
  'speed',
] as const;
export type UnitCategory = (typeof UNIT_CATEGORIES)[number];

export type UnitDef = {
  id: string;
  category: UnitCategory;
  ar: string;
  en: string;
  /** Latin symbol, shown on the English chips. */
  symbol: string;
  toBase: (v: number) => number;
  fromBase: (v: number) => number;
};

const unit = (id: string, category: UnitCategory, ar: string, en: string, symbol: string, factor: number): UnitDef => ({
  id,
  category,
  ar,
  en,
  symbol,
  toBase: v => v * factor,
  // Divide, don't multiply by 1/factor: 1/3.6 is not exact and 36 km/h would
  // not come back as 10 m/s.
  fromBase: v => v / factor,
});

const affine = (
  id: string,
  ar: string,
  en: string,
  symbol: string,
  toKelvin: (v: number) => number,
  fromKelvin: (v: number) => number,
): UnitDef => ({ id, category: 'temperature', ar, en, symbol, toBase: toKelvin, fromBase: fromKelvin });

export const UNITS: UnitDef[] = [
  unit('mm', 'length', 'ملم', 'millimetre', 'mm', 0.001),
  unit('cm', 'length', 'سم', 'centimetre', 'cm', 0.01),
  unit('m', 'length', 'م', 'metre', 'm', 1),
  unit('km', 'length', 'كم', 'kilometre', 'km', 1000),
  unit('in', 'length', 'إنش', 'inch', 'in', 0.0254),
  unit('ft', 'length', 'قدم', 'foot', 'ft', 0.3048),
  unit('yd', 'length', 'ياردة', 'yard', 'yd', 0.9144),
  unit('mi', 'length', 'ميل', 'mile', 'mi', 1609.344),

  unit('mg', 'mass', 'ملغم', 'milligram', 'mg', 1e-6),
  unit('g', 'mass', 'غم', 'gram', 'g', 0.001),
  unit('kg', 'mass', 'كغم', 'kilogram', 'kg', 1),
  unit('t', 'mass', 'طن', 'tonne', 't', 1000),
  unit('oz', 'mass', 'أونصة', 'ounce', 'oz', 0.028349523125),
  unit('lb', 'mass', 'رطل', 'pound', 'lb', 0.45359237),

  unit('ms', 'time', 'مللي ثانية', 'millisecond', 'ms', 0.001),
  unit('s', 'time', 'ثانية', 'second', 's', 1),
  unit('min', 'time', 'دقيقة', 'minute', 'min', 60),
  unit('h', 'time', 'ساعة', 'hour', 'h', 3600),
  unit('d', 'time', 'يوم', 'day', 'd', 86400),

  unit('mm2', 'area', 'ملم²', 'square millimetre', 'mm²', 1e-6),
  unit('cm2', 'area', 'سم²', 'square centimetre', 'cm²', 1e-4),
  unit('m2', 'area', 'م²', 'square metre', 'm²', 1),
  unit('km2', 'area', 'كم²', 'square kilometre', 'km²', 1e6),
  unit('ha', 'area', 'هكتار', 'hectare', 'ha', 10000),
  unit('dunum', 'area', 'دونم', 'dunum', 'dunum', 1000),
  unit('ft2', 'area', 'قدم²', 'square foot', 'ft²', 0.09290304),

  unit('ml', 'volume', 'مل', 'millilitre', 'mL', 1e-6),
  unit('cm3', 'volume', 'سم³', 'cubic centimetre', 'cm³', 1e-6),
  unit('l', 'volume', 'لتر', 'litre', 'L', 0.001),
  unit('m3', 'volume', 'م³', 'cubic metre', 'm³', 1),

  unit('deg', 'angle', 'درجة', 'degree', '°', Math.PI / 180),
  unit('rad', 'angle', 'راديان', 'radian', 'rad', 1),
  unit('turn', 'angle', 'دورة', 'turn', 'turn', 2 * Math.PI),

  affine('celsius', 'سلسيوس', 'degree Celsius', '°C', v => v + 273.15, k => k - 273.15),
  affine('fahrenheit', 'فهرنهايت', 'degree Fahrenheit', '°F', v => ((v - 32) * 5) / 9 + 273.15, k => ((k - 273.15) * 9) / 5 + 32),
  affine('kelvin', 'كلفن', 'kelvin', 'K', v => v, k => k),

  unit('mps', 'speed', 'م/ث', 'metre per second', 'm/s', 1),
  unit('kmh', 'speed', 'كم/س', 'kilometre per hour', 'km/h', 1000 / 3600),
  unit('mph', 'speed', 'ميل/س', 'mile per hour', 'mph', 0.44704),
  unit('kn', 'speed', 'عقدة', 'knot', 'kn', 1852 / 3600),
];

const BY_ID: ReadonlyMap<string, UnitDef> = new Map(UNITS.map(u => [u.id, u]));

/** A `Map` lookup, so `constructor` and `__proto__` are not units. */
export function getUnit(id: string): UnitDef | undefined {
  return BY_ID.get(id);
}

export function unitsFor(category: UnitCategory): UnitDef[] {
  return UNITS.filter(u => u.category === category);
}

/** The pair a category opens with: what a classroom converts most often. */
const DEFAULT_PAIRS: Record<UnitCategory, [string, string]> = {
  length: ['cm', 'm'],
  mass: ['kg', 'g'],
  time: ['h', 'min'],
  area: ['m2', 'dunum'],
  volume: ['l', 'ml'],
  angle: ['deg', 'rad'],
  temperature: ['celsius', 'fahrenheit'],
  speed: ['kmh', 'mps'],
};

export function defaultPair(category: UnitCategory): [string, string] {
  return DEFAULT_PAIRS[category];
}

export type ConvertFailure =
  | 'empty'
  | 'bad-number'
  | 'unknown-unit'
  | 'category-mismatch'
  | 'below-absolute-zero'
  | 'overflow';

export type ConvertResult = { ok: true; value: number } | { ok: false; reason: ConvertFailure };

/** A signed number as typed. `parseLabNumber` refuses signs, so peel one off first. */
function parseSigned(raw: string): number {
  const s = toLatinDigits(raw).trim().replace(/[−–]/g, '-');
  const m = /^([+-])?\s*(.*)$/.exec(s) as RegExpExecArray;
  const magnitude = parseLabNumber(m[2]);
  return m[1] === '-' ? -magnitude : magnitude;
}

/** 12 significant digits, so 100 °C is 212 °F and not 211.99999999999994. */
function tidy(n: number): number {
  const r = Number(n.toPrecision(12));
  return r === 0 ? 0 : r;
}

/** Kelvin values this close to zero are the rounding residue of an exact 0 K. */
const ZERO_KELVIN_TOLERANCE = 1e-9;

export function convert(raw: string, fromId: string, toId: string): ConvertResult {
  const from = getUnit(fromId);
  const to = getUnit(toId);
  if (!from || !to) return { ok: false, reason: 'unknown-unit' };
  if (from.category !== to.category) return { ok: false, reason: 'category-mismatch' };
  if (toLatinDigits(raw).trim() === '') return { ok: false, reason: 'empty' };

  const value = parseSigned(raw);
  if (!Number.isFinite(value)) return { ok: false, reason: 'bad-number' };

  let base = from.toBase(value);
  if (from.category === 'temperature') {
    if (base < -ZERO_KELVIN_TOLERANCE) return { ok: false, reason: 'below-absolute-zero' };
    if (Math.abs(base) <= ZERO_KELVIN_TOLERANCE) base = 0;
  }
  const result = to.fromBase(base);
  if (!Number.isFinite(result)) return { ok: false, reason: 'overflow' };
  return { ok: true, value: tidy(result) };
}
