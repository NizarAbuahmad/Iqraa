/**
 * Unit tests for the subject-ambiguity detection functions in kbContext.ts:
 *   - detectSubjectAmbiguity(results)
 *   - filterResultsBySubject(results, subjectId)
 *
 * Runs with Node's built-in test runner (no extra packages):
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/kbAmbiguity.test.ts
 *
 * Covers:
 *  detectSubjectAmbiguity:
 *   1. Returns null for an empty results array.
 *   2. Returns null when all results belong to Chemistry (no ambiguity).
 *   3. Returns null when all results belong to Mathematics (no ambiguity).
 *   4. Returns both subject IDs when results mix Chemistry and Mathematics.
 *   5. Returned array contains exactly 'chemistry' and 'mathematics' (no extras).
 *   6. Inspects only the first 5 results — lesson at index 5+ does not affect outcome.
 *
 *  filterResultsBySubject:
 *   7. Returns empty array for empty input.
 *   8. Filters a mixed list down to only Chemistry lessons.
 *   9. Filters a mixed list down to only Mathematics lessons.
 *  10. Returns empty array when no lesson matches the requested subject.
 *  11. Preserves the relative ordering of matching lessons.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectSubjectAmbiguity,
  filterResultsBySubject,
} from '../kbContext.ts';
import { getLessonById, KB_LESSONS } from '../knowledgeBase.ts';
import type { KBLesson } from '../knowledgeBase.ts';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
// Use real KB lessons so we exercise the actual unit→book→subjectId lookup chain.
// Falls back to KB_LESSONS (bypasses MVP visibility filter used by getLessonById).

function fixture(id: string): KBLesson {
  const lesson = getLessonById(id) ?? KB_LESSONS.find(l => l.id === id);
  if (!lesson) throw new Error(`Test fixture missing: lesson "${id}" not found in KB`);
  return lesson;
}

// Chemistry lessons (book: kb-chem-10-s1, subjectId: 'chemistry')
const CHEM_A = fixture('kbl-chem-1-1'); // Bohr's Model
const CHEM_B = fixture('kbl-chem-3-2'); // Covalent Bonding

// Mathematics lessons (book: kb-math-10-s2 NCCD, subjectId: 'mathematics')
const MATH_A = fixture('kbl-math-s2-nccd-u5_l1'); // اقترانات كثيرات الحدود
const MATH_B = fixture('kbl-math-s2-nccd-u6_l2'); // تقدير ميل المنحنى

// ─── detectSubjectAmbiguity ───────────────────────────────────────────────────

describe('detectSubjectAmbiguity()', () => {

  it('returns null for an empty results array', () => {
    assert.strictEqual(detectSubjectAmbiguity([]), null);
  });

  it('returns null when all results belong to Chemistry (single subject)', () => {
    assert.strictEqual(detectSubjectAmbiguity([CHEM_A, CHEM_B]), null);
  });

  it('returns null when all results belong to Mathematics (single subject)', () => {
    assert.strictEqual(detectSubjectAmbiguity([MATH_A, MATH_B]), null);
  });

  it('returns null for a single Chemistry lesson', () => {
    assert.strictEqual(detectSubjectAmbiguity([CHEM_A]), null);
  });

  it('returns null for a single Mathematics lesson', () => {
    assert.strictEqual(detectSubjectAmbiguity([MATH_A]), null);
  });

  it('returns a non-null array when results mix Chemistry and Mathematics', () => {
    const result = detectSubjectAmbiguity([CHEM_A, MATH_A]);
    assert.ok(result !== null, 'should detect ambiguity for mixed-subject results');
    assert.ok(Array.isArray(result), 'return value must be an array');
    assert.equal(result.length, 2, 'should return exactly 2 subject IDs');
  });

  it('returned array contains exactly "chemistry" and "mathematics" for a mixed set', () => {
    const result = detectSubjectAmbiguity([CHEM_A, MATH_A, CHEM_B, MATH_B])!;
    assert.ok(result !== null);
    const sorted = [...result].sort();
    assert.deepStrictEqual(sorted, ['chemistry', 'mathematics']);
  });

  it('detects ambiguity when the first result is Math and the second is Chemistry', () => {
    const result = detectSubjectAmbiguity([MATH_B, CHEM_B]);
    assert.ok(result !== null, 'order should not matter');
  });

  it('ignores results beyond the first 5 — index-5+ lessons do not affect the result', () => {
    // Build a list: 5 Chemistry-only lessons at indices 0–4, then one Math lesson at index 5.
    // detectSubjectAmbiguity inspects only top-5, so the Math lesson is invisible.
    const top5AllChem = [CHEM_A, CHEM_B, CHEM_A, CHEM_B, CHEM_A];
    const withMathBeyond5 = [...top5AllChem, MATH_A];
    assert.strictEqual(
      detectSubjectAmbiguity(withMathBeyond5),
      null,
      'Math lesson at index 5 must not trigger ambiguity',
    );
  });

  it('detects ambiguity when mixed subjects appear within the first 5 results', () => {
    // Indices 0–3 are Chemistry; index 4 introduces Math.
    const fiveWithOneMath = [CHEM_A, CHEM_B, CHEM_A, CHEM_B, MATH_A];
    const result = detectSubjectAmbiguity(fiveWithOneMath);
    assert.ok(result !== null, 'Math at index 4 must trigger ambiguity');
  });
});

// ─── filterResultsBySubject ────────────────────────────────────────────────────

describe('filterResultsBySubject()', () => {

  it('returns an empty array for empty input', () => {
    assert.deepStrictEqual(filterResultsBySubject([], 'chemistry'), []);
    assert.deepStrictEqual(filterResultsBySubject([], 'mathematics'), []);
  });

  it('returns only Chemistry lessons from a mixed list', () => {
    const mixed = [CHEM_A, MATH_A, CHEM_B, MATH_B];
    const result = filterResultsBySubject(mixed, 'chemistry');
    assert.equal(result.length, 2, 'should return 2 Chemistry lessons');
    for (const lesson of result) {
      assert.ok(
        lesson.unitId.startsWith('kbu-chem-'),
        `lesson ${lesson.id} should belong to a Chemistry unit`,
      );
    }
  });

  it('returns only Mathematics lessons from a mixed list', () => {
    const mixed = [CHEM_A, MATH_A, CHEM_B, MATH_B];
    const result = filterResultsBySubject(mixed, 'mathematics');
    assert.equal(result.length, 2, 'should return 2 Mathematics lessons');
    for (const lesson of result) {
      assert.ok(
        lesson.unitId.startsWith('kbu-math-'),
        `lesson ${lesson.id} should belong to a Mathematics unit`,
      );
    }
  });

  it('returns empty array when no lesson matches the requested subject', () => {
    const chemOnly = [CHEM_A, CHEM_B];
    assert.deepStrictEqual(filterResultsBySubject(chemOnly, 'mathematics'), []);
  });

  it('returns empty array for an unknown subject ID', () => {
    const mixed = [CHEM_A, MATH_A];
    assert.deepStrictEqual(filterResultsBySubject(mixed, 'biology'), []);
  });

  it('preserves relative ordering of matching lessons', () => {
    // MATH_B before MATH_A — order must be preserved in output.
    const input = [CHEM_A, MATH_B, CHEM_B, MATH_A];
    const result = filterResultsBySubject(input, 'mathematics');
    assert.equal(result.length, 2);
    assert.equal(result[0].id, MATH_B.id, 'MATH_B should appear first');
    assert.equal(result[1].id, MATH_A.id, 'MATH_A should appear second');
  });

  it('returns all lessons when every lesson matches the requested subject', () => {
    const mathOnly = [MATH_A, MATH_B];
    const result = filterResultsBySubject(mathOnly, 'mathematics');
    assert.equal(result.length, 2);
  });
});
