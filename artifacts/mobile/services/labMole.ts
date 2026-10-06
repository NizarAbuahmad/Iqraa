/**
 * Formula parsing and mole conversions for the lab calculator.
 *
 * Pure and dependency-light on purpose: the mobile test runner is bare
 * `node --test`, so nothing here may import `react-native`. Everything is
 * latin; the screen converts digits for display (`labFormat.ts`).
 *
 * The parser fails closed. A symbol it does not know (anything past element
 * 20) or a shape it cannot read comes back as a named reason, never as a
 * number — a wrong molar mass looks exactly like a right one.
 */
import { elementBySymbol } from '@workspace/curriculum/elements';

export type FormulaFailure = 'empty' | 'syntax' | 'unknown-element';

export type FormulaResult =
  | { ok: true; counts: Record<string, number> }
  | { ok: false; reason: FormulaFailure; detail?: string };

/** Avogadro's number, particles per mole. Compare to the book's printed value. */
export const AVOGADRO = 6.022e23;

const MAX_COUNT = 1000;

const SYNTAX: FormulaResult = { ok: false, reason: 'syntax' };

export function parseFormula(input: string): FormulaResult {
  const s = input.replace(/\s+/g, '').replace(/[₀-₉]/g, d => String(d.charCodeAt(0) - 0x2080));
  if (!s) return { ok: false, reason: 'empty' };

  const stack: Array<Record<string, number>> = [{}];
  let i = 0;

  // Reads a run of digits as a count; no digits means 1, and 0 or huge is a syntax error.
  const readCount = (): number | null => {
    const start = i;
    while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
    if (i === start) return 1;
    const n = Number(s.slice(start, i));
    return n >= 1 && n <= MAX_COUNT ? n : null;
  };

  while (i < s.length) {
    const ch = s[i];
    if (ch === '(') {
      stack.push({});
      i++;
    } else if (ch === ')') {
      if (stack.length < 2) return SYNTAX;
      i++;
      const mult = readCount();
      if (mult === null) return SYNTAX;
      const group = stack.pop() as Record<string, number>;
      if (Object.keys(group).length === 0) return SYNTAX;
      const top = stack[stack.length - 1];
      for (const [symbol, c] of Object.entries(group)) top[symbol] = (top[symbol] ?? 0) + c * mult;
    } else if (ch >= 'A' && ch <= 'Z') {
      let symbol = ch;
      i++;
      if (i < s.length && s[i] >= 'a' && s[i] <= 'z') {
        symbol += s[i];
        i++;
      }
      if (!elementBySymbol(symbol)) return { ok: false, reason: 'unknown-element', detail: symbol };
      const c = readCount();
      if (c === null) return SYNTAX;
      const top = stack[stack.length - 1];
      top[symbol] = (top[symbol] ?? 0) + c;
    } else {
      return SYNTAX;
    }
  }

  if (stack.length !== 1) return SYNTAX;
  return { ok: true, counts: stack[0] };
}

export function molarMass(counts: Record<string, number>): number {
  let total = 0;
  for (const [symbol, c] of Object.entries(counts)) {
    total += (elementBySymbol(symbol)?.atomicMass ?? 0) * c;
  }
  return total;
}

export type MoleKnown = 'grams' | 'moles' | 'particles';

export type MoleResult =
  | { ok: true; molarMass: number; grams: number; moles: number; particles: number }
  | { ok: false; reason: FormulaFailure | 'bad-value'; detail?: string };

export function solveMole(input: { formula: string; known: MoleKnown; value: number }): MoleResult {
  const parsed = parseFormula(input.formula);
  if (!parsed.ok) return parsed;
  if (!Number.isFinite(input.value) || input.value < 0) return { ok: false, reason: 'bad-value' };

  const mm = molarMass(parsed.counts);
  let moles: number;
  if (input.known === 'grams') moles = input.value / mm;
  else if (input.known === 'moles') moles = input.value;
  else moles = input.value / AVOGADRO;

  return { ok: true, molarMass: mm, grams: moles * mm, moles, particles: moles * AVOGADRO };
}
