/**
 * The Math Corner's expression engine: a tokenizer and a recursive-descent
 * evaluator for calculator input. Free of react-native so `node --test` loads it.
 *
 * Fails closed. Every failure is a named reason, never a guessed number, and
 * an unknown word is refused rather than read as a product of letters (SymPy
 * does the latter with Arabic, and it made a right answer look wrong — see
 * CLAUDE.md). There is no `eval`/`Function`: the input is typed by a student.
 *
 * Maths is computed in latin digits and `x`; Arabic digits, `س`, `×÷−` and the
 * book's جا/جتا/ظا are folded in `normaliseInput` and converted back only for
 * display (`mathCalc.ts`).
 */
import { toLatinDigits } from './latinDigits.ts';

export type MathFailure =
  | 'empty'
  | 'too-long'
  | 'syntax'
  | 'unbalanced'
  | 'unknown-symbol'
  | 'function-needs-brackets'
  | 'wrong-arity'
  | 'domain'
  | 'divide-by-zero'
  | 'overflow'
  | 'factorial-domain';

export type AngleMode = 'deg' | 'rad';

export type EvalResult = { ok: true; value: number } | { ok: false; reason: MathFailure };

export type EvalOptions = {
  /** Default `deg`: the Jordanian books write «جا ٣٠ = ٠٫٥». */
  angle?: AngleMode;
  /** Named values: `x` for the grapher, `Ans` for the calculator. */
  vars?: Record<string, number>;
};

export const MAX_EXPR_LENGTH = 200;
const MAX_DEPTH = 40;

class MathError extends Error {
  reason: MathFailure;
  constructor(reason: MathFailure) {
    super(reason);
    this.reason = reason;
  }
}

// ---------------------------------------------------------------------------
// Input normalisation

/** Display glyphs and Arabic input → the ASCII the evaluator reads. */
export function normaliseInput(src: string): string {
  let s = toLatinDigits(src);
  s = s
    .replace(/٫/g, '.')
    .replace(/،/g, ',')
    .replace(/٪/g, '%')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/π/g, 'pi')
    .replace(/س/g, 'x')
    // Longest first: «جتا» must not be read as «جا» plus a stray letter.
    .replace(/جتا/g, 'cos')
    .replace(/جا/g, 'sin')
    .replace(/ظا/g, 'tan')
    // «√9» is a prefix with no brackets; «√(16)» already has them.
    .replace(/√\s*(\d+\.?\d*|\.\d+|pi|e|x)/g, 'sqrt($1)')
    .replace(/√/g, 'sqrt');
  return s.trim();
}

/** Close whatever the user left open, as a calculator does on «=». */
export function autoCloseBrackets(src: string): string {
  let open = 0;
  for (const ch of src) {
    if (ch === '(') open += 1;
    else if (ch === ')' && open > 0) open -= 1;
  }
  return src + ')'.repeat(open);
}

// ---------------------------------------------------------------------------
// Tokenizer

type Token = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

const OPS = '+-*/^!%(),';

/**
 * `dry` walks the grammar and checks arity and symbols but not values, so a
 * structural mistake is found whatever x is (see `compile`). Every value check
 * (`finite`, division by zero, factorial, domain) is skipped in it.
 */
type Ctx = { angle: AngleMode; vars: Record<string, number>; dry?: boolean };

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

function knownNames(vars: Record<string, number>): string[] {
  return [...Object.keys(FUNCTIONS), ...Object.keys(CONSTANTS), ...Object.keys(vars)].sort(
    (a, b) => b.length - a.length,
  );
}

function tokenize(s: string, vars: Record<string, number>): Token[] {
  const names = knownNames(vars);
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i += 1;
    } else if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(s[i + 1] ?? ''))) {
      const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i)) as RegExpExecArray;
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
    } else if (/[A-Za-z]/.test(ch)) {
      const run = /^[A-Za-z]+/.exec(s.slice(i)) as RegExpExecArray;
      let rest = run[0];
      while (rest.length > 0) {
        const hit = names.find(n => rest.startsWith(n));
        if (!hit) throw new MathError('unknown-symbol');
        out.push({ t: 'id', v: hit });
        rest = rest.slice(hit.length);
        if (hit in FUNCTIONS) {
          // «sinx» / «sin 30»: name the missing bracket, not whatever follows.
          const after = rest.length > 0 ? rest : s.slice(i + run[0].length).trimStart();
          if (!after.startsWith('(')) throw new MathError('function-needs-brackets');
        }
      }
      i += run[0].length;
    } else if (OPS.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i += 1;
    } else if (/\p{L}/u.test(ch)) {
      throw new MathError('unknown-symbol');
    } else {
      throw new MathError('syntax');
    }
  }
  return out;
}

function checkBalanced(s: string): void {
  let depth = 0;
  for (const ch of s) {
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth < 0) throw new MathError('unbalanced');
    }
  }
  if (depth !== 0) throw new MathError('unbalanced');
}

// ---------------------------------------------------------------------------
// Numeric helpers

function finite(n: number): number {
  if (Number.isNaN(n)) throw new MathError('domain');
  if (!Number.isFinite(n)) throw new MathError('overflow');
  return n;
}

const SIN_30K = [0, 0.5, Math.sqrt(3) / 2, 1, Math.sqrt(3) / 2, 0.5, 0, -0.5, -Math.sqrt(3) / 2, -1, -Math.sqrt(3) / 2, -0.5];

/** sin in degrees, exact at every multiple of 30° (`Math.sin(Math.PI)` is 1.2e-16). */
function sinDeg(a: number): number {
  const r = ((a % 360) + 360) % 360;
  if (r % 30 === 0) return SIN_30K[r / 30];
  return Math.sin((r * Math.PI) / 180);
}
const cosDeg = (a: number): number => sinDeg(a + 90);

/** Radian results this small are floating-point residue (`sin(π)`), not values. */
function snapTiny(n: number): number {
  return Math.abs(n) < 1e-15 ? 0 : n;
}

function sin(a: number, c: Ctx): number {
  return c.angle === 'deg' ? sinDeg(a) : snapTiny(Math.sin(a));
}
function cos(a: number, c: Ctx): number {
  return c.angle === 'deg' ? cosDeg(a) : snapTiny(Math.cos(a));
}
function tan(a: number, c: Ctx): number {
  const s = sin(a, c);
  const co = cos(a, c);
  // cos is exactly 0 at 90°/270° in degrees; in radians π/2 is never exact, so
  // a huge tan(π/2) is the honest answer there.
  if (co === 0) throw new MathError('domain');
  return s / co;
}
const toAngle = (rad: number, c: Ctx): number => (c.angle === 'deg' ? (rad * 180) / Math.PI : rad);

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw new MathError('factorial-domain');
  let r = 1;
  for (let i = 2; i <= n; i += 1) r *= i;
  return r;
}

function wholeNonNeg(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new MathError('domain');
  return n;
}

function nCr(n: number, r: number): number {
  wholeNonNeg(n);
  wholeNonNeg(r);
  if (r > n) throw new MathError('domain');
  const k = Math.min(r, n - r);
  let res = 1;
  for (let i = 1; i <= k; i += 1) res = (res * (n - k + i)) / i;
  return finite(Math.round(res));
}

function nPr(n: number, r: number): number {
  wholeNonNeg(n);
  wholeNonNeg(r);
  if (r > n) throw new MathError('domain');
  let res = 1;
  for (let i = 0; i < r; i += 1) res *= n - i;
  return finite(res);
}

function logBase(x: number, b: number): number {
  if (x <= 0 || b <= 0 || b === 1) throw new MathError('domain');
  return Math.log(x) / Math.log(b);
}

type FnDef = { min: number; max: number; run: (a: number[], c: Ctx) => number };

const FUNCTIONS: Record<string, FnDef> = {
  sin: { min: 1, max: 1, run: ([a], c) => sin(a, c) },
  cos: { min: 1, max: 1, run: ([a], c) => cos(a, c) },
  tan: { min: 1, max: 1, run: ([a], c) => tan(a, c) },
  asin: {
    min: 1,
    max: 1,
    run: ([a], c) => {
      if (Math.abs(a) > 1) throw new MathError('domain');
      return toAngle(Math.asin(a), c);
    },
  },
  acos: {
    min: 1,
    max: 1,
    run: ([a], c) => {
      if (Math.abs(a) > 1) throw new MathError('domain');
      return toAngle(Math.acos(a), c);
    },
  },
  atan: { min: 1, max: 1, run: ([a], c) => toAngle(Math.atan(a), c) },
  sqrt: {
    min: 1,
    max: 1,
    run: ([a]) => {
      if (a < 0) throw new MathError('domain');
      return Math.sqrt(a);
    },
  },
  cbrt: { min: 1, max: 1, run: ([a]) => Math.cbrt(a) },
  abs: { min: 1, max: 1, run: ([a]) => Math.abs(a) },
  exp: { min: 1, max: 1, run: ([a]) => Math.exp(a) },
  ln: { min: 1, max: 1, run: ([a]) => logBase(a, Math.E) },
  log: {
    min: 1,
    max: 2,
    run: ([a, b]) => (b === undefined ? logBase(a, 10) : logBase(a, b)),
  },
  nCr: { min: 2, max: 2, run: ([n, r]) => nCr(n, r) },
  nPr: { min: 2, max: 2, run: ([n, r]) => nPr(n, r) },
};

// ---------------------------------------------------------------------------
// Parser + evaluator (evaluates as it parses; there is no AST yet)

function run(tokens: Token[], ctx: Ctx): number {
  let pos = 0;
  let depth = 0;
  const fin = (n: number): number => (ctx.dry ? 0 : finite(n));

  const peek = (): Token | undefined => tokens[pos];
  const isOp = (v: string): boolean => {
    const t = peek();
    return t !== undefined && t.t === 'op' && t.v === v;
  };

  function expr(): number {
    depth += 1;
    if (depth > MAX_DEPTH) throw new MathError('too-long');
    let v = term();
    while (isOp('+') || isOp('-')) {
      const op = (tokens[pos++] as { v: string }).v;
      const r = term();
      v = fin(op === '+' ? v + r : v - r);
    }
    depth -= 1;
    return v;
  }

  function startsOperand(t: Token | undefined): boolean {
    return t !== undefined && (t.t === 'id' || (t.t === 'op' && t.v === '('));
  }

  function term(): number {
    let v = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = (tokens[pos++] as { v: string }).v;
        const r = unary();
        if (op === '/') {
          if (r === 0 && !ctx.dry) throw new MathError('divide-by-zero');
          v = fin(v / r);
        } else {
          v = fin(v * r);
        }
      } else if (startsOperand(peek())) {
        // Implicit multiplication, same precedence as `*`: 2(3+4), 2pi, 3x.
        v = fin(v * unary());
      } else {
        return v;
      }
    }
  }

  function unary(): number {
    if (isOp('-')) {
      pos += 1;
      return -unary();
    }
    if (isOp('+')) {
      pos += 1;
      return unary();
    }
    return power();
  }

  function power(): number {
    const base = postfix();
    if (isOp('^')) {
      pos += 1;
      const exp = unary();
      if (ctx.dry) return 0;
      if (base === 0 && exp < 0) throw new MathError('divide-by-zero');
      return finite(Math.pow(base, exp));
    }
    return base;
  }

  function postfix(): number {
    let v = atom();
    for (;;) {
      if (isOp('!')) {
        pos += 1;
        v = ctx.dry ? v : factorial(v);
      } else if (isOp('%')) {
        pos += 1;
        v = v / 100;
      } else {
        return v;
      }
    }
  }

  function atom(): number {
    const t = tokens[pos];
    if (t === undefined) throw new MathError('syntax');
    if (t.t === 'num') {
      pos += 1;
      return t.v;
    }
    if (t.t === 'op') {
      if (t.v !== '(') throw new MathError('syntax');
      pos += 1;
      const v = expr();
      depth -= 1;
      if (!isOp(')')) throw new MathError('unbalanced');
      pos += 1;
      return v;
    }
    // identifier
    pos += 1;
    const fn = FUNCTIONS[t.v];
    if (fn) {
      if (!isOp('(')) throw new MathError('function-needs-brackets');
      pos += 1;
      const args: number[] = [];
      if (!isOp(')')) {
        for (;;) {
          args.push(expr());
          depth -= 1;
          if (isOp(',')) {
            pos += 1;
            continue;
          }
          break;
        }
      }
      if (!isOp(')')) throw new MathError('syntax');
      pos += 1;
      if (args.length < fn.min || args.length > fn.max) throw new MathError('wrong-arity');
      return ctx.dry ? 0 : finite(fn.run(args, ctx));
    }
    if (t.v in ctx.vars) return ctx.vars[t.v];
    if (t.v in CONSTANTS) return CONSTANTS[t.v];
    throw new MathError('unknown-symbol');
  }

  const result = expr();
  depth -= 1;
  if (pos < tokens.length) throw new MathError('syntax');
  return result;
}

/** 15 significant digits, the way a hand calculator shows `0.1+0.2` as 0.3. */
function tidy(n: number): number {
  const r = Number(n.toPrecision(15));
  return r === 0 ? 0 : r;
}

export function evaluate(src: string, opts: EvalOptions = {}): EvalResult {
  try {
    const s = normaliseInput(src);
    if (s === '') throw new MathError('empty');
    if (s.length > MAX_EXPR_LENGTH) throw new MathError('too-long');
    checkBalanced(s);
    const vars = opts.vars ?? {};
    const tokens = tokenize(s, vars);
    const value = run(tokens, { angle: opts.angle ?? 'deg', vars });
    return { ok: true, value: tidy(finite(value)) };
  } catch (err) {
    if (err instanceof MathError) return { ok: false, reason: err.reason };
    throw err;
  }
}

export type CompiledFn = (x: number) => number;
export type CompileResult = { ok: true; f: CompiledFn } | { ok: false; reason: MathFailure };

/**
 * Turn a typed function of `x` into something a plot can call a few hundred
 * times a frame. Tokenizes once.
 *
 * Refuses only what is wrong whatever x is — a syntax error, an unknown word, a
 * missing bracket, the wrong number of arguments (a dry pass checks the grammar
 * without checking values, so a mistake hiding behind `sqrt(-x^2-1)` is still
 * found). `sqrt(x-5)` compiles: it is undefined for x < 5, and that is a gap in
 * the curve, not an error in the input. At a point where the value is undefined
 * or not finite the function returns NaN, never throws, and does not tidy: a
 * plot wants the raw number.
 */
export function compile(src: string, opts: { angle?: AngleMode } = {}): CompileResult {
  try {
    const s = normaliseInput(src);
    if (s === '') throw new MathError('empty');
    if (s.length > MAX_EXPR_LENGTH) throw new MathError('too-long');
    checkBalanced(s);
    const angle = opts.angle ?? 'deg';
    const tokens = tokenize(s, { x: 0 });
    run(tokens, { angle, vars: { x: 0 }, dry: true });
    const f: CompiledFn = x => {
      try {
        const v = run(tokens, { angle, vars: { x } });
        return Number.isFinite(v) ? v : Number.NaN;
      } catch (err) {
        if (err instanceof MathError) return Number.NaN;
        throw err;
      }
    };
    return { ok: true, f };
  } catch (err) {
    if (err instanceof MathError) return { ok: false, reason: err.reason };
    throw err;
  }
}
