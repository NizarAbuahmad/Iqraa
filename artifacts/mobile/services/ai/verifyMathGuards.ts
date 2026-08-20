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
function normaliseMath(text: string): string {
  return text
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
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
 * Pull a single-unknown equation out of question text, e.g.
 * "ما ناتج / حل: 2x + 5 = 17؟" → "2x+5=17".
 *
 * Returns null for systems (the bank joins two equations with '،'), for
 * anything with more or fewer than one '=', and for non-Latin content —
 * all cases the set-comparison verifier cannot judge.
 */
export function latinEquationFrom(text: string): string | null {
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
    if (isTautology(lhs, rhs)) continue;
    return body.replace(/\s+/g, '');
  }
  return null;
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
    return expr ? { topic: 'derivative_polynomial', payload: expr } : null;
  }
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
