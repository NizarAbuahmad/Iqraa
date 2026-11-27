// A point or an interval prints with the Latin comma: «(2, −1)», «(1, 5]».
//
// The bank used to write «(2 ، −1)». The app lays maths out left to right
// inside Arabic text (`isolateForeignRuns` in artifacts/mobile/services/
// mathRender.ts), but it cannot do that for a pair with the Arabic comma:
// «،» between numbers is also Arabic prose — a verse citation «(79 ،78)», a
// numbered list «(3،2،1)» — which reads right to left. So the bank's points
// displayed right to left, «(1− ، 2)», beside left-to-right equations, and the
// English prompts carried an Arabic comma. Found 2026-11-27: 43,756 such tuples
// across 36 topics. A list of numbers in an Arabic sentence keeps «،»: only a
// bracketed tuple of exactly two maths atoms is a point or an interval.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem } from '../topics.ts';
import { MATH_BANK, type DiffTier } from '../index.ts';
import { MATH_A_STEPS } from '../steps-math-a.ts';
import { MATH_B_STEPS } from '../steps-math-b.ts';
import { MATH_C_STEPS } from '../steps-math-c.ts';

const ATOM = String.raw`[+−-]? *[A-Za-z0-9.^√/′'¹²³⁰⁴-⁹⁺⁻ⁿ₀-₉°∞α-ωΑ-Ω]+`;
const AR_COMMA_TUPLE = new RegExp(String.raw`[[(\]] *${ATOM} *، *${ATOM} *[\])[]`, 'g');
// A vector's components may be expressions («⟨4 − 1, 6 − 2⟩»), so any «⟨…⟩» holding «،».
const AR_COMMA_VECTOR = /[⟨〈][^⟩〉]*،[^⟩〉]*[⟩〉]/g;

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach(x => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, out));
  return out;
}

function offenders(where: string, texts: string[], found: string[]): void {
  for (const s of texts) {
    for (const re of [AR_COMMA_TUPLE, AR_COMMA_VECTOR]) {
      for (const m of s.matchAll(re)) if (found.length < 12) found.push(`${where}: ${m[0]} in «${s.slice(0, 90)}»`);
    }
  }
}

describe('points, intervals and vectors print with the Latin comma', () => {
  it('in every generated item, Arabic and English', () => {
    const found: string[] = [];
    const diffs: DiffTier[] = ['easy', 'medium', 'hard'];
    for (const t of TOPICS) for (let grade = 1; grade <= 10; grade++) for (const diff of diffs) for (let i = 0; i < 6; i++) {
      let item;
      try { item = makeTopicItem(t, grade, diff, new Set()); } catch { continue; }
      offenders(t.id, strings(item), found);
    }
    assert.deepEqual(found, []);
  });

  it('in the hand-written bank and its worked solutions', () => {
    const found: string[] = [];
    offenders('MATH_BANK', strings(MATH_BANK), found);
    offenders('steps', strings([MATH_A_STEPS, MATH_B_STEPS, MATH_C_STEPS]), found);
    assert.deepEqual(found, []);
  });

  it('still leaves a list of numbers in an Arabic sentence to «،»', () => {
    // Not a point: five numbers. The pattern must not reach it.
    assert.equal('(10، 20، 30، 40، 50)'.match(AR_COMMA_TUPLE), null);
  });
});
