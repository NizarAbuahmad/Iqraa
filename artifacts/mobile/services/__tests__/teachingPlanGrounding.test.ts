/**
 * The teaching-plan export grounds each lesson by its id, not its title.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/teachingPlanGrounding.test.ts
 *
 * Found by the 2026-11-13 grade 8 review. `app/teaching-plans/index.tsx`
 * grounded the Ministry form's lessons with `resolveGeneratorGrounding(title)`
 * alone. Every grade 8 English unit opens with «المفردات والقواعد», so a title
 * lookup lands on unit 1 (or another grade's book), the screen's guard saw the
 * mismatch and sent the lesson with NO curriculum context — about 62 grade 8
 * English and Arabic lessons. The screen imports react-native, so the runner
 * cannot load it; the call site is checked by reading its source.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolveGeneratorGrounding } from '../kbContext.ts';

const UNIT3_VOCAB = 'kbl-g8-eng-s1-nccd-u3_l1';
const TITLE = 'المفردات والقواعد';

describe('teaching-plan export grounding', () => {
  it('a repeated grade 8 title alone does not find its own lesson', () => {
    // The trap itself: if this ever starts passing by title, the guard below
    // is no longer what keeps the export honest, and that is worth knowing.
    const g = resolveGeneratorGrounding(TITLE, 'ar');
    assert.notEqual(g.lesson?.id, UNIT3_VOCAB);
  });

  it('the lesson id finds exactly that lesson, with its context', () => {
    const g = resolveGeneratorGrounding(TITLE, 'ar', { lessonId: UNIT3_VOCAB });
    assert.equal(g.lesson?.id, UNIT3_VOCAB);
    assert.ok(g.context.length > 0, 'the lesson carries curriculum context');
  });

  it('the export screen passes the lesson id when it grounds', () => {
    const src = readFileSync(join(import.meta.dirname, '..', '..', 'app', 'teaching-plans', 'index.tsx'), 'utf8');
    const calls = src.match(/resolveGeneratorGrounding\([^)]*\)/g) ?? [];
    assert.ok(calls.length > 0, 'the screen still grounds its lessons');
    for (const call of calls) {
      assert.match(call, /lessonId:/, `grounds by title alone: ${call}`);
    }
  });
});
