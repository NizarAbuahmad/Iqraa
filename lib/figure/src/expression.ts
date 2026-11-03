/**
 * Evaluate a small arithmetic subset at a point.
 *
 * Deliberately tiny: `+ - * / ^`, parentheses, unary minus, and the implicit
 * multiplication school notation uses (`3x`, `2(x+1)`). It exists to plot the
 * polynomials the Grade 10 books are full of, not to be a computer algebra
 * system — SymPy already plays that role, server-side.
 *
 * Fails closed. Anything it cannot parse returns null and the caller omits the
 * plot, matching how the verifier declines to claim what it cannot prove. A
 * wrong curve on a classroom wall is worse than no curve.
 */
function tokenize(src: string): string[] | null {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === ' ') { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let n = '';
      while (i < src.length && /[0-9.]/.test(src[i]!)) n += src[i++]!;
      if ((n.match(/\./g) ?? []).length > 1) return null;
      out.push(n);
      continue;
    }
    // A run of letters is ONE token. Single characters would make `sin` into
    // `s*i*n` — three unknown symbols — which is why trig used to be
    // unplottable rather than merely unsupported. `xy` now tokenises as one
    // unknown identifier instead of `x*y`; both were refused before and both
    // are refused now, so nothing that used to draw stops drawing.
    if (/[a-zA-Z]/.test(c)) {
      let id = '';
      while (i < src.length && /[a-zA-Z]/.test(src[i]!)) id += src[i++]!;
      out.push(id);
      continue;
    }
    if ('+-*/^()'.includes(c)) { out.push(c); i++; continue; }
    return null; // anything else — give up rather than guess
  }
  return out;
}

/**
 * The functions this evaluator knows, in radians.
 *
 * **Radians, not degrees** — decided deliberately. The Grade 10 books write
 * «جا ٣٠ = ٠٫٥», which is degrees, but this module plots curves rather than
 * evaluating single values: `f(x)=sin(x)` sampled over a degree domain is a
 * nearly flat line, while over −2π..2π it is the wave a teacher expects to
 * point at. A value question is SymPy's job, server-side; this is the
 * projector's.
 */
const FUNCTIONS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
};

const isIdentifier = (t: string) => /^[a-zA-Z]+$/.test(t);
const isFunction = (t: string) => Object.prototype.hasOwnProperty.call(FUNCTIONS, t);

/** Insert the multiplication school notation leaves implicit: 3x → 3*x. */
function withImplicitMultiplication(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const next = tokens[i + 1];
    out.push(t);
    if (next === undefined) continue;
    // A function name is not a value: `sin(x)` must not become `sin*(x)`.
    // It still *starts* one, so `2sin(x)` and `xsin(x)` get their `*`.
    const endsValue = /^[0-9.]+$/.test(t) || (isIdentifier(t) && !isFunction(t)) || t === ')';
    const startsValue = /^[0-9.]+$/.test(next) || isIdentifier(next) || next === '(';
    if (endsValue && startsValue) out.push('*');
  }
  return out;
}

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };

/** Shunting-yard to RPN. `^` is right-associative, as in maths. */
function toRpn(tokens: string[]): string[] | null {
  const out: string[] = [];
  const ops: string[] = [];
  for (const t of tokens) {
    if (/^[0-9.]+$/.test(t)) { out.push(t); continue; }
    if (isIdentifier(t)) {
      // A function waits on the stack until its closing bracket; a plain
      // symbol is a value and goes straight out.
      if (isFunction(t)) ops.push(t);
      else out.push(t);
      continue;
    }
    if (t === '(') { ops.push(t); continue; }
    if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop()!);
      if (!ops.length) return null; // unbalanced
      ops.pop();
      // The bracket just closed may be a function's argument list.
      if (ops.length && isFunction(ops[ops.length - 1]!)) out.push(ops.pop()!);
      continue;
    }
    const p = PRECEDENCE[t];
    if (p === undefined) return null;
    while (ops.length) {
      const top = ops[ops.length - 1]!;
      const tp = PRECEDENCE[top];
      if (tp === undefined) break;
      if (tp > p || (tp === p && t !== '^')) out.push(ops.pop()!);
      else break;
    }
    ops.push(t);
  }
  while (ops.length) {
    const op = ops.pop()!;
    if (op === '(') return null; // unbalanced
    out.push(op);
  }
  return out;
}

function evalRpn(rpn: string[], variable: string, x: number): number | null {
  const st: number[] = [];
  for (const t of rpn) {
    if (/^[0-9.]+$/.test(t)) { st.push(Number(t)); continue; }
    if (isFunction(t)) {
      const arg = st.pop();
      if (arg === undefined) return null;
      st.push(FUNCTIONS[t]!(arg));
      continue;
    }
    if (isIdentifier(t)) {
      if (t !== variable) return null; // an unknown symbol is not something to guess at
      st.push(x);
      continue;
    }
    const b = st.pop();
    const a = st.pop();
    if (a === undefined || b === undefined) return null;
    switch (t) {
      case '+': st.push(a + b); break;
      case '-': st.push(a - b); break;
      case '*': st.push(a * b); break;
      case '/': st.push(b === 0 ? NaN : a / b); break;
      case '^': st.push(Math.pow(a, b)); break;
      default: return null;
    }
  }
  return st.length === 1 ? st[0]! : null;
}

/** Unary minus is rewritten as `0-…` so the RPN stage only sees binary ops. */
function normaliseUnaryMinus(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const prev = out[out.length - 1];
    const isUnary = t === '-' && (prev === undefined || prev === '(' || PRECEDENCE[prev] !== undefined);
    if (isUnary) { out.push('0', '-'); continue; }
    out.push(t);
  }
  return out;
}

export type CompiledExpression = (x: number) => number | null;

/** Compile once, evaluate many — sampling calls this hundreds of times. */
export function compileExpression(src: string, variable = 'x'): CompiledExpression | null {
  const tokens = tokenize(src);
  if (!tokens || tokens.length === 0) return null;
  // Brackets are required after a function. Without this, `sin x + 1` parses
  // as sin(x + 1) — the shunting-yard drains `sin` last and swallows the whole
  // sum — which is a different curve, drawn confidently. Refusing is the same
  // posture the rest of this module takes.
  for (let i = 0; i < tokens.length; i++) {
    if (isFunction(tokens[i]!) && tokens[i + 1] !== '(') return null;
  }
  const rpn = toRpn(withImplicitMultiplication(normaliseUnaryMinus(tokens)));
  if (!rpn) return null;
  // Reject up front rather than at render time: an expression that cannot be
  // evaluated at a sample point is not plottable at all.
  if (evalRpn(rpn, variable, 1) === null) return null;
  return (x: number) => evalRpn(rpn, variable, x);
}
