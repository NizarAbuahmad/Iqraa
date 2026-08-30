/**
 * Pure gates deciding whether a question may CLAIM symbolic verification.
 *
 * Kept free of Expo/network imports so they are unit-testable: a false
 * positive here projects "تم التحقق رياضيًا" on a classroom wall for
 * something no verifier proved, so both gates fail closed.
 */

/** Topics the verifier can prove today. */
export type VerifiableTopic =
  | 'derivative_polynomial'
  | 'derivative_at_point'
  | 'circle_center'
  | 'circle_radius'
  | 'equation_linear'
  | 'equation_quadratic'
  | 'equation_exponential';

/** True when the text looks like a derivative question the verifier supports. */
export function isDerivativeQuestion(text: string): boolean {
  // The prime is three different characters in practice: the ASCII apostrophe
  // this used to accept, and U+2032/U+2019, which is what the Arabic question
  // bank actually writes — «أوجد f′(x) إذا كان f(x) = x³ − 4x.». That item
  // carries no «مشتق» either, so the sole marker that it is a derivative
  // question was a character this guard did not recognise, and it classified
  // as an equation instead.
  return /مشتق|اشتقاق|derivative|d\/dx|f\s*['′’]\s*\(/i.test(text);
}

const MATH_SAFE = /^[0-9a-zA-Z+\-*/^(). =]+$/;

/**
 * Typographic maths → the ASCII SymPy parses.
 *
 * The brace rewrite is load-bearing, not cosmetic. `{` and `}` are absent from
 * the math-safe character class, so `2^{x+1} = 32` used to cut the extracted
 * run short at `2^` and hand the verifier `4^x=2^` — a truncated fragment that
 * syntax-errors. The item then degraded to the 'bank' label even though it is
 * exactly the kind of equation the verifier can prove. Fold braces into
 * parentheses first and the whole equation survives extraction.
 */
const SUPERSCRIPTS = '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079';

function normaliseMath(text: string): string {
  return text
    // Every superscript digit, not just ² and ³. `x⁴` used to lose its
    // exponent entirely — the character is outside the math-safe class, so
    // extraction returned `x` and the verifier was asked to differentiate the
    // wrong function. It failed closed against the real key, but silently, and
    // «عند x = 2» questions on x⁴ are ordinary Grade-10 material.
    .replace(new RegExp(`[${SUPERSCRIPTS}]+`, 'g'), run =>
      `^${Array.from(run, ch => String(SUPERSCRIPTS.indexOf(ch))).join('')}`)
    .replace(/[−–—]/g, '-')
    .replace(/×/g, '*')
    .replace(/\^\s*\{([^}]*)\}/g, '^($1)');
}

/**
 * Drop trailing sentence punctuation from an extracted payload.
 *
 * `.` is inside the math-safe class (decimals need it), so a question ending
 * in a full stop — "أوجد مشتقة f(x) = x²." — extracted as `x^2.`, which SymPy
 * rejects outright. No item in the banks legitimately ends in a dot.
 */
function trimTrailingPunctuation(body: string): string {
  return body.replace(/[.\s]+$/u, '');
}

/**
 * True when "solving" the equation would just restate it.
 *
 * `P = 1/6` is not a question the verifier answers — it is the answer, and
 * SymPy dutifully "solves" it to 1/6, matching the key by construction. The
 * probability item behind it (`ما احتمال ظهور 5؟`) then carried a green
 * "تم التحقق من الإجابة رياضيًا (SymPy)" badge for reasoning nothing did.
 * A bare unknown against a constant proves nothing, so it never qualifies.
 */
function isTautology(lhs: string, rhs: string): boolean {
  const bareSymbol = /^[a-zA-Z]\w*$/;
  const hasUnknown = (side: string): boolean => /[a-zA-Z]/.test(side);
  return (
    (bareSymbol.test(lhs) && !hasUnknown(rhs)) || (bareSymbol.test(rhs) && !hasUnknown(lhs))
  );
}

/**
 * The distinct unknowns in an equation body.
 *
 * `f(x)`-style calls and named functions are not unknowns, so an identifier
 * immediately followed by '(' is dropped — otherwise `sin(x) = 0.5` would
 * count `sin` and `x` and be rejected as a two-unknown equation.
 */
function unknownsIn(body: string): Set<string> {
  const found = new Set<string>();
  for (const m of body.matchAll(/([A-Za-z]\w*)\s*(\()?/g)) {
    if (!m[2]) found.add(m[1]!);
  }
  return found;
}

/**
 * Pull a single-unknown equation out of question text, e.g.
 * "ما ناتج / حل: 2x + 5 = 17؟" → "2x+5=17".
 *
 * Returns null for systems (the bank joins two equations with '،'), for
 * anything with more or fewer than one '=', and for non-Latin content —
 * all cases the set-comparison verifier cannot judge.
 */
function equationFrom(
  text: string,
  accept: (body: string, unknowns: Set<string>) => boolean,
): string | null {
  const normalised = normaliseMath(text);
  // A comma (Arabic or Latin) means two equations — a system, not our case.
  if (/[،,]/.test(normalised)) return null;

  // Longest run of math-safe characters containing exactly one '='.
  const candidates = normalised.match(/[0-9a-zA-Z+\-*/^(). ]*=[0-9a-zA-Z+\-*/^(). ]*/g) ?? [];
  for (const raw of candidates) {
    const body = trimTrailingPunctuation(raw.trim());
    if (!body || !MATH_SAFE.test(body)) continue;
    if ((body.match(/=/g) ?? []).length !== 1) continue;
    const [lhs, rhs] = body.split('=').map(s => s.trim());
    if (!lhs || !rhs) continue;
    // Needs an unknown on one side, and both sides must be real content.
    if (!/[a-zA-Z]/.test(lhs) && !/[a-zA-Z]/.test(rhs)) continue;
    if (!accept(body, unknownsIn(body))) continue;
    if (isTautology(lhs, rhs)) continue;
    return body.replace(/\s+/g, '');
  }
  return null;
}

export function latinEquationFrom(text: string): string | null {
  // Exactly one unknown. «معادلة الدائرة (x-4)² + (y+1)² = 9» has one '=', a
  // '^2' and Latin letters, so it used to classify as a quadratic — and the
  // prover then refused it for having two unknowns. It failed closed, so no
  // false badge was ever shown, but the item was reported as a key the
  // verifier rejected, which is indistinguishable from a wrong answer.
  // Circles have their own topics below; anything else with two unknowns is
  // still outside what this verifier can judge.
  return equationFrom(text, (_body, unknowns) => unknowns.size === 1);
}

/**
 * Pull a circle equation out of question text — standard or general form.
 *
 * Requires both squares present, so `x + y = 10` cannot pass as a circle. The
 * strict test (equal square coefficients, no cross term, positive radius) is
 * the verifier's, but claiming a topic it will refuse would report the item as
 * a rejected key, so the gate here is deliberately more than "has an =".
 */
export function circleEquationFrom(text: string): string | null {
  return equationFrom(text, (body, unknowns) => {
    if (unknowns.size !== 2 || !unknowns.has('x') || !unknowns.has('y')) return false;
    // Two squares, counted rather than matched against `x^2` / `y^2`, because
    // standard form writes them as `(x-4)^2`. An ellipse would also pass this
    // and then be refused by the verifier's own test; that costs a badge, not
    // a wrong one, and no Grade-10 NCCD item asks for one.
    return (body.match(/\^\s*2/g) ?? []).length >= 2;
  });
}

/**
 * The point a derivative question asks to be evaluated at, e.g.
 * «ما قيمة مشتقة f(x) = x⁴ عند x = 2؟» → "2". Null when the question asks
 * for the derivative itself.
 *
 * Without this the extractor returned only `x^4`, the verifier computed
 * `4x^3`, and the key `32` was rejected — a correct answer reported as a
 * wrong one, on a question shape the curriculum uses constantly.
 */
export function derivativePointFrom(text: string): string | null {
  const normalised = normaliseMath(text);
  const named = normalised.match(/(?:عندما|عند|at)\s*x\s*=\s*(-?\d+(?:\.\d+)?)/u);
  if (named) return named[1]!;
  // The other half of the curriculum's phrasing writes the point as the
  // argument: «أوجد f′(2) إذا كانت f(x) = x⁴». Only a NUMERIC argument is a
  // point — `f'(x)` is the derivative itself and must not match.
  const applied = normalised.match(/[A-Za-z]\s*['′’]\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)/u);
  return applied?.[1] ?? null;
}

const CIRCLE_MARKER = /دائرة|circle/i;
const CENTRE_MARKER = /مركز|cent(?:re|er)/i;
const RADIUS_MARKER = /نصف\s*(?:ال)?قطر|radius/i;

/**
 * Centre or radius of a circle, both exactly computable from its equation.
 *
 * A question naming both — «أوجد المركز ونصف القطر» — has a compound answer
 * no single comparison can judge, so it stays unclaimed. «القطر» alone is the
 * diameter, which the radius marker deliberately does not match.
 */
function classifyCircle(
  text: string,
): { topic: VerifiableTopic; payload: string } | null {
  if (!CIRCLE_MARKER.test(text)) return null;
  const wantsCentre = CENTRE_MARKER.test(text);
  const wantsRadius = RADIUS_MARKER.test(text);
  if (wantsCentre === wantsRadius) return null;
  const equation = circleEquationFrom(text);
  if (!equation) return null;
  return { topic: wantsCentre ? 'circle_center' : 'circle_radius', payload: equation };
}

/**
 * Decide which verifier topic (if any) a question belongs to.
 * Returns null when nothing can be honestly claimed.
 */
export function classifyVerifiableTopic(
  text: string,
): { topic: VerifiableTopic; payload: string } | null {
  if (isDerivativeQuestion(text)) {
    const expr = latinExpressionFrom(text);
    if (!expr) return null;
    const point = derivativePointFrom(text);
    // '@' cannot appear in an expression, so the two halves of the payload
    // can never be mistaken for one.
    if (point) return { topic: 'derivative_at_point', payload: `${expr}@${point}` };
    return { topic: 'derivative_polynomial', payload: expr };
  }
  const circle = classifyCircle(text);
  if (circle) return circle;
  const equation = latinEquationFrom(text);
  if (!equation) return null;
  // A digit or symbol raised to the unknown, e.g. 2^n = 16.
  if (/[0-9a-zA-Z]\^[a-zA-Z]/.test(equation)) {
    return { topic: 'equation_exponential', payload: equation };
  }
  if (/\^\s*2|\^\s*3/.test(equation)) {
    return { topic: 'equation_quadratic', payload: equation };
  }
  return { topic: 'equation_linear', payload: equation };
}

/**
 * Extract the Latin expression to differentiate, e.g. "أوجد مشتقة f(x)=3x^2"
 * → "3x^2". Returns null when nothing safely parseable is present.
 * The verifier rejects Arabic notation, so only Latin math survives here.
 */
export function latinExpressionFrom(text: string): string | null {
  const normalised = normaliseMath(text);
  const m = normalised.match(/(?:f\s*\(\s*x\s*\)|y)\s*=\s*([0-9a-zA-Z+\-*/^(). ]+)/);
  const body = trimTrailingPunctuation((m?.[1] ?? '').trim());
  if (!body) return null;
  // Must involve x and contain only math-safe characters.
  if (!/x/i.test(body)) return null;
  if (!/^[0-9a-zA-Z+\-*/^(). ]+$/.test(body)) return null;
  return body.replace(/\s+/g, '');
}
