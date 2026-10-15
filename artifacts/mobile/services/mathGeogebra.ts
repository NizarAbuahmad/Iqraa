/**
 * The grapher's functions as GeoGebra commands, for the «open in GeoGebra»
 * link-out. Pure and free of react-native.
 *
 * GeoGebra reads our syntax differently in three ways that would silently draw
 * a different curve: its trig functions take radians (so a degree argument gets
 * a `°`, and an inverse trig result is divided by `°`), its `log(x)` is the
 * natural log (base 10 is `lg`), and a two-argument `log` puts the base first.
 * Whatever cannot be said faithfully — percent, `nPr`, an unknown word,
 * unbalanced brackets — is left out and the result is marked incomplete, never
 * sent as something else.
 */
import { normaliseInput, type AngleMode } from './mathExpr.ts';

export type GraphCurve = { kind: 'explicit'; expr: string } | { kind: 'vertical'; x: number };

const NAMES = ['f', 'g', 'h', 'k'];
// Longest first, so «asin» is not read as «a» + «sin».
const FUNCTIONS = ['asin', 'acos', 'atan', 'sqrt', 'cbrt', 'sin', 'cos', 'tan', 'abs', 'exp', 'nCr', 'nPr', 'ln', 'log'];
const CONSTANTS = ['pi', 'e', 'x'];

const isLetter = (c: string): boolean => /[A-Za-z]/.test(c);

/** Index of the `)` closing the `(` at `open`, or -1. */
function matching(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth += 1;
    else if (src[i] === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTop(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '(') depth += 1;
    else if (inner[i] === ')') depth -= 1;
    else if (inner[i] === ',' && depth === 0) {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts;
}

/** «pix» → «pi*x». Null if any of it is not a constant or the variable. */
function constantsProduct(run: string): string | null {
  const out: string[] = [];
  let rest = run;
  while (rest.length > 0) {
    const hit = CONSTANTS.find(c => rest.startsWith(c));
    if (!hit) return null;
    out.push(hit);
    rest = rest.slice(hit.length);
  }
  return out.join('*');
}

function callOut(name: string, args: string[], angle: AngleMode): string | null {
  const one = args.length === 1 ? args[0] : null;
  switch (name) {
    case 'sin':
    case 'cos':
    case 'tan':
      if (one === null) return null;
      return angle === 'deg' ? `${name}((${one})°)` : `${name}(${one})`;
    case 'asin':
    case 'acos':
    case 'atan':
      if (one === null) return null;
      return angle === 'deg' ? `(${name}(${one})/°)` : `${name}(${one})`;
    case 'log':
      if (args.length === 1) return `lg(${args[0]})`;
      if (args.length === 2) return `log(${args[1]}, ${args[0]})`;
      return null;
    case 'ln':
    case 'exp':
    case 'sqrt':
    case 'cbrt':
    case 'abs':
      return one === null ? null : `${name}(${one})`;
    case 'nCr':
      return args.length === 2 ? `nCr(${args[0]}, ${args[1]})` : null;
    default:
      return null; // nPr and anything unknown
  }
}

function translate(src: string, angle: AngleMode): string | null {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];

    if (isLetter(ch)) {
      let j = i;
      while (j < src.length && isLetter(src[j])) j++;
      const run = src.slice(i, j);

      if (src[j] === '(') {
        const fn = FUNCTIONS.find(f => run.endsWith(f)) ?? null;
        const prefix = fn === null ? run : run.slice(0, run.length - fn.length);
        if (prefix !== '') {
          const product = constantsProduct(prefix);
          if (product === null) return null;
          out += `${product}*`;
        }
        const close = matching(src, j);
        if (close < 0) return null;
        const inner = src.slice(j + 1, close);
        if (fn === null) {
          // «x(x+1)»: the constants multiply the bracket.
          const group = translate(inner, angle);
          if (group === null) return null;
          out += `(${group})`;
        } else {
          const args = splitTop(inner).map(a => translate(a, angle));
          if (args.some(a => a === null)) return null;
          const call = callOut(fn, args as string[], angle);
          if (call === null) return null;
          out += call;
        }
        i = close + 1;
        continue;
      }

      const product = constantsProduct(run);
      if (product === null) return null;
      out += product;
      i = j;
      continue;
    }

    if (ch === '(') {
      const close = matching(src, i);
      if (close < 0) return null;
      const group = translate(src.slice(i + 1, close), angle);
      if (group === null) return null;
      out += `(${group})`;
      i = close + 1;
      continue;
    }
    if (ch === ')' || ch === '%') return null;

    out += ch;
    i += 1;
  }
  return out;
}

export function geogebraCommands(
  curves: GraphCurve[],
  angle: AngleMode,
): { commands: string[]; complete: boolean } {
  const commands: string[] = [];
  let complete = true;
  let named = 0;
  for (const curve of curves) {
    if (curve.kind === 'vertical') {
      commands.push(`x=${curve.x}`);
      continue;
    }
    const body = translate(normaliseInput(curve.expr), angle);
    if (body === null || named >= NAMES.length) {
      complete = false;
      continue;
    }
    commands.push(`${NAMES[named]}(x)=${body}`);
    named += 1;
  }
  return { commands, complete };
}
