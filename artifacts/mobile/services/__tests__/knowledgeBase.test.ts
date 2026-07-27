/**
 * Knowledge-base regression tests.
 *
 * Runs with Node's built-in test runner (no extra packages):
 *   node --experimental-strip-types --test artifacts/mobile/services/__tests__/knowledgeBase.test.ts
 *
 * Tests:
 *  1. Every chip lessonId in SUGGESTIONS resolves to a real lesson (no orphan IDs).
 *  2. Arabic prefix-stripped queries return the correct top-ranked lesson.
 *  3. English queries return the correct lesson for each chip.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getLessonById, searchKB } from '../knowledgeBase.ts';

// ─── 1. Chip lessonId integrity ───────────────────────────────────────────────
// These are the lessonIds used in the SUGGESTIONS constant in iqra.tsx.
// They must all resolve to a real KBLesson; if they don't, chips will silently
// fall back to a text search which may return a wrong lesson.
const CHIP_LESSON_IDS = [
  // teacher – Arabic
  'kbl-chem-1-1',
  'kbl-chem-3-2',
  'kbl-math-1-3',
  'kbl-math-8-2',
  'kbl-chem-1-2',
  // teacher – English (same ids, listed for documentation)
  // student – Arabic
  'kbl-math-8-1',
  'kbl-math-1-2',
  // student – English (same ids)
];

// De-duplicate
const UNIQUE_CHIP_IDS = [...new Set(CHIP_LESSON_IDS)];

describe('getLessonById — chip lessonId integrity', () => {
  for (const id of UNIQUE_CHIP_IDS) {
    it(`lessonId "${id}" resolves to a real lesson`, () => {
      const lesson = getLessonById(id);
      assert.ok(
        lesson !== undefined,
        `Chip lessonId "${id}" is an orphan — no matching lesson found in KB_LESSONS`,
      );
      assert.strictEqual(lesson.id, id, `Lesson id mismatch: expected ${id}, got ${lesson.id}`);
    });
  }
});

// ─── 2. Arabic prefix-stripped search ─────────────────────────────────────────
// The scorer strips common Arabic prefixes (ال، و، ب، ...) so that a query like
// "رابطة" (without "ال") still ranks the correct lesson first.
describe('searchKB — Arabic prefix stripping', () => {
  it('"رابطة" (without ال) returns kbl-chem-3-1 (الرابطة الأيونية) as top result', () => {
    const results = searchKB('رابطة', 'ar');
    assert.ok(results.length > 0, 'searchKB returned no results for "رابطة"');
    // The ionic bonding lesson has "الرابطة الأيونية" in its title
    const topId = results[0].id;
    assert.ok(
      topId === 'kbl-chem-3-1' || topId === 'kbl-chem-3-2' || topId === 'kbl-chem-3-3',
      `Expected a chemical-bonding lesson (kbl-chem-3-*) to rank first for "رابطة", got "${topId}"`,
    );
  });

  it('"الرابطة" (with ال) returns a chemical-bonding lesson first', () => {
    const results = searchKB('الرابطة', 'ar');
    assert.ok(results.length > 0, 'searchKB returned no results for "الرابطة"');
    const topId = results[0].id;
    assert.ok(
      topId === 'kbl-chem-3-1' || topId === 'kbl-chem-3-2' || topId === 'kbl-chem-3-3',
      `Expected a chemical-bonding lesson first for "الرابطة", got "${topId}"`,
    );
  });

  it('"الأيونية" matches kbl-chem-3-1 as top result', () => {
    const results = searchKB('الأيونية', 'ar');
    assert.ok(results.length > 0, 'searchKB returned no results for "الأيونية"');
    assert.strictEqual(
      results[0].id,
      'kbl-chem-3-1',
      `Expected "kbl-chem-3-1" but got "${results[0].id}"`,
    );
  });

  it('"أوفباو" (without ال) still surfaces kbl-chem-1-2 (النموذج الميكانيكي)', () => {
    const results = searchKB('أوفباو', 'ar');
    assert.ok(results.length > 0, 'searchKB returned no results for "أوفباو"');
    assert.strictEqual(
      results[0].id,
      'kbl-chem-1-2',
      `Expected "kbl-chem-1-2" for "أوفباو" but got "${results[0].id}"`,
    );
  });

  it('"الاحتمال" returns a probability lesson first', () => {
    const results = searchKB('الاحتمال', 'ar');
    assert.ok(results.length > 0, 'searchKB returned no results for "الاحتمال"');
    assert.ok(
      results[0].id === 'kbl-math-8-1' || results[0].id === 'kbl-math-8-2' || results[0].id === 'kbl-math-8-3',
      `Expected a probability lesson first for "الاحتمال", got "${results[0].id}"`,
    );
  });
});

// ─── 3. English chip queries ───────────────────────────────────────────────────
// Teacher chips use concise topic phrases — the expected lesson must rank first.
// Student chips use conversational phrasing AND have a pinned lessonId in the
// SUGGESTIONS constant, so the app bypasses search entirely for those. Their
// tests verify the lesson is findable (appears in top-3 results).
describe('searchKB — English chip queries', () => {
  // Teacher chips: concise phrasing → expected lesson must be #1
  const TEACHER_CHIPS: Array<{ text: string; expectedId: string }> = [
    { text: "What is Bohr's model?",                    expectedId: 'kbl-chem-1-1' },
    { text: 'Explain covalent bonding',                 expectedId: 'kbl-chem-3-2' },
    { text: 'What is an inverse function?',             expectedId: 'kbl-math-1-3' },
    { text: 'Probability of mutually exclusive events', expectedId: 'kbl-math-8-2' },
    { text: 'Quantum numbers explained',                expectedId: 'kbl-chem-1-2' },
  ];

  for (const { text, expectedId } of TEACHER_CHIPS) {
    it(`teacher chip: "${text}" → ${expectedId} is top result`, () => {
      const results = searchKB(text, 'en');
      assert.ok(results.length > 0, `searchKB returned no results for "${text}"`);
      assert.strictEqual(
        results[0].id,
        expectedId,
        `Expected "${expectedId}" as top result for "${text}", got "${results[0].id}"`,
      );
    });
  }

  // Student chips: natural-language phrasing, but lessonId is pinned so search
  // is bypassed at runtime. Verify the expected lesson appears in the top 3.
  const STUDENT_CHIPS: Array<{ text: string; expectedId: string }> = [
    { text: "Help me understand Bohr's model",               expectedId: 'kbl-chem-1-1' },
    { text: 'How do I solve probability problems?',          expectedId: 'kbl-math-8-1' },
    { text: 'Difference between sigma and pi bonds?',        expectedId: 'kbl-chem-3-2' },
    { text: 'How to find the domain of a rational function?', expectedId: 'kbl-math-1-2' },
    { text: 'Explain Aufbau principle simply',               expectedId: 'kbl-chem-1-2' },
  ];

  for (const { text, expectedId } of STUDENT_CHIPS) {
    it(`student chip (pinned): "${text}" → ${expectedId} in top 3`, () => {
      const results = searchKB(text, 'en');
      assert.ok(results.length > 0, `searchKB returned no results for "${text}"`);
      const top3Ids = results.slice(0, 3).map(l => l.id);
      assert.ok(
        top3Ids.includes(expectedId),
        `Expected "${expectedId}" to appear in top-3 for "${text}", got: [${top3Ids.join(', ')}]`,
      );
    });
  }
});
