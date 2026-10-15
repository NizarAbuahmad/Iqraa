/**
 * The numeric half of the formula sheet's guarantees. `lib/curriculum`'s
 * `mathFormulas.test.ts` proves each formula is printed in its lesson; this
 * proves the identity holds, by running every `check` through the same
 * expression engine the calculator uses — on the book's own worked examples
 * where the book prints one (the 3-4-5 triangle, the circle (5, −3) with
 * r = 4, v = ⟨2, 8⟩ · w = ⟨−5, 4⟩ = 22, 0.85 = 0.65 + 0.75 − 0.55 …).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MATH_FORMULAS, type MathFormula } from '@workspace/curriculum/math-formulas';
import { evaluate } from '../mathExpr.ts';

const DEFAULT_TOL = 1e-9;

function valueOf(src: string, angle: 'deg' | 'rad', vars: Record<string, number>, where: string): number {
  const r = evaluate(src, { angle, vars });
  assert.ok(r.ok, `${where}: «${src}» did not evaluate (${r.ok ? '' : r.reason})`);
  return r.value;
}

function run(f: MathFormula): { sides: number[]; tol: number } {
  const check = f.check;
  assert.ok(check, `${f.id} has no check`);
  const angle = check.angle ?? 'deg';
  const vars: Record<string, number> = {};
  for (const [name, expr] of Object.entries(check.vars ?? {})) {
    vars[name] = typeof expr === 'number' ? expr : valueOf(expr, angle, vars, `${f.id} var ${name}`);
  }
  const sides = check.equal.map(src => valueOf(src, angle, vars, f.id));
  return { sides, tol: check.tol ?? DEFAULT_TOL };
}

const CHECKED = MATH_FORMULAS.filter(f => f.check);

describe('the formula sheet: numeric identities', () => {
  it('most formulas carry a check, so this suite cannot pass by checking nothing', () => {
    assert.ok(CHECKED.length >= 30, `only ${CHECKED.length} of ${MATH_FORMULAS.length} have a check`);
  });

  for (const f of CHECKED) {
    it(`${f.id}: every side of the identity is the same number`, () => {
      const { sides, tol } = run(f);
      const [first, ...rest] = sides;
      for (const other of rest) {
        const scale = Math.max(1, Math.abs(first), Math.abs(other));
        assert.ok(
          Math.abs(first - other) <= tol * scale,
          `${f.id}: ${JSON.stringify(f.check?.equal)} gave ${JSON.stringify(sides)}`,
        );
      }
    });
  }

  it('a deliberately wrong identity is caught (the harness can fail)', () => {
    const wrong: MathFormula = {
      ...MATH_FORMULAS[0],
      check: { equal: ['a^2', 'b^2+c^2'], vars: { a: 3, b: 4, c: 5 } }, // 9 ≠ 41: the cosine rule without its last term
    };
    const { sides } = run(wrong);
    assert.notEqual(sides[0], sides[1]);
  });
});
