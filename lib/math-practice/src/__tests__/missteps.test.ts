import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MISSTEPS, misstepsFor } from '../missteps.ts';
import { stepsFor } from '../steps.ts';
import { MATH_BANK } from '../index.ts';

describe('missteps', () => {
  it('every entry names a solved item, a step that is not the last, and a line that differs', () => {
    for (const m of MISSTEPS) {
      const steps = stepsFor(m.itemId);
      assert.ok(steps, `${m.itemId} has no working`);
      assert.ok(m.stepIndex >= 0 && m.stepIndex < steps!.ar.length - 1, `${m.itemId}: step ${m.stepIndex} is the last or out of range`);
      assert.notEqual(m.wrongAr.trim(), steps!.ar[m.stepIndex]!.trim(), `${m.itemId}: ar wrong line equals the real one`);
      assert.notEqual(m.wrongEn.trim(), steps!.en[m.stepIndex]!.trim(), `${m.itemId}: en wrong line equals the real one`);
      assert.ok(m.whyAr.length > 10 && m.whyEn.length > 10, `${m.itemId}: explain the mistake`);
      assert.ok(!/اً/.test(m.wrongAr + m.whyAr), `${m.itemId}: write «ًا», not «اً»`);
    }
  });

  it('covers every Grade-10 maths family that has working, at least once', () => {
    const solvedFamilies = new Set(MATH_BANK.filter(i => stepsFor(i.id)).map(i => i.family));
    const covered = new Set(MISSTEPS.map(m => MATH_BANK.find(i => i.id === m.itemId)?.family));
    for (const f of solvedFamilies) assert.ok(covered.has(f), `family ${f} has working but no misstep`);
  });

  it('looks entries up by item', () => {
    const first = MISSTEPS[0]!;
    assert.ok(misstepsFor(first.itemId).includes(first));
    assert.deepEqual(misstepsFor('no-such-item'), []);
  });
});
