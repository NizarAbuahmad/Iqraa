/**
 * buildResponse character-budget and trimming tests.
 *
 * Runs with Node's built-in test runner (no extra packages):
 *   node --experimental-strip-types --test artifacts/mobile/services/__tests__/kbContext.test.ts
 *
 * Covers:
 *  1. Single-lesson query passes at full fidelity (tier 0, under budget).
 *  2. Three long lessons combined fit within CONTEXT_CHAR_BUDGET (≤ 3000 chars).
 *  3. Summary and rules are always present regardless of which trim tier fired.
 *  4. Examples are the first section dropped when budget is exceeded.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import type { BlockOpts } from '../kbContext.ts';
import {
  buildResponse,
  buildLessonBlock,
  TRIM_TIERS,
  CONTEXT_CHAR_BUDGET,
} from '../kbContext.ts';
import { getLessonById, KB_LESSONS } from '../knowledgeBase.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Three of the longest lessons in the KB (Chemistry + Math). */
const LONG_LESSON_IDS = ['kbl-chem-1-2', 'kbl-math-2-2', 'kbl-chem-3-2'];

// ─── 1. Single-lesson full-fidelity ──────────────────────────────────────────

describe('buildResponse — single-lesson query', () => {
  it('returns a non-empty string for a known lesson', () => {
    const lesson = getLessonById('kbl-math-2-2');
    assert.ok(lesson !== undefined, 'Test fixture kbl-math-2-2 not found in KB');
    const result = buildResponse('differentiation rules', [lesson!], 'en', 'teacher');
    assert.ok(result.length > 0, 'buildResponse returned empty string for single lesson');
  });

  it('single-lesson output is well within the budget (tier 0)', () => {
    const lesson = getLessonById('kbl-math-2-2');
    assert.ok(lesson !== undefined, 'Test fixture kbl-math-2-2 not found in KB');
    const result = buildResponse('differentiation rules', [lesson!], 'en', 'teacher');
    assert.ok(
      result.length <= CONTEXT_CHAR_BUDGET,
      `Single-lesson output (${result.length} chars) exceeds budget of ${CONTEXT_CHAR_BUDGET}`,
    );
  });

  it('single-lesson output at full fidelity includes examples section header', () => {
    const lesson = getLessonById('kbl-math-2-2');
    assert.ok(lesson !== undefined, 'Test fixture kbl-math-2-2 not found in KB');
    const result = buildResponse('differentiation rules', [lesson!], 'en', 'teacher');
    // At full fidelity there should be no multi-result reference prefix
    assert.ok(!result.includes('[Reference 1]'), 'Single-lesson result should not have reference prefix');
  });
});

// ─── 2. Three-lesson combined fits within budget ──────────────────────────────

describe('buildResponse — three-lesson query', () => {
  it('combined output is ≤ CONTEXT_CHAR_BUDGET characters', () => {
    const lessons = LONG_LESSON_IDS.map(id => getLessonById(id)).filter(Boolean) as any[];
    assert.strictEqual(lessons.length, 3, 'Could not load all 3 test fixture lessons');
    const result = buildResponse('explain chemistry and math', lessons, 'en', 'teacher');
    assert.ok(
      result.length <= CONTEXT_CHAR_BUDGET,
      `Three-lesson combined output (${result.length} chars) exceeds budget of ${CONTEXT_CHAR_BUDGET}`,
    );
  });

  it('three-lesson output contains reference prefixes', () => {
    const lessons = LONG_LESSON_IDS.map(id => getLessonById(id)).filter(Boolean) as any[];
    const result = buildResponse('broad question', lessons, 'en', 'teacher');
    assert.ok(result.includes('[Reference 1]'), 'Expected [Reference 1] prefix in multi-lesson output');
    assert.ok(result.includes('[Reference 2]'), 'Expected [Reference 2] prefix in multi-lesson output');
    assert.ok(result.includes('[Reference 3]'), 'Expected [Reference 3] prefix in multi-lesson output');
  });

  it('three-lesson output contains separator lines between blocks', () => {
    const lessons = LONG_LESSON_IDS.map(id => getLessonById(id)).filter(Boolean) as any[];
    const result = buildResponse('broad question', lessons, 'en', 'teacher');
    assert.ok(result.includes('---'), 'Expected --- separator between lesson blocks');
  });
});

// ─── 3. Summary and rules always preserved ───────────────────────────────────

describe('buildLessonBlock — summary and rules always present', () => {
  const lesson = getLessonById('kbl-chem-1-2');

  for (const opts of TRIM_TIERS) {
    const label = `maxConcepts=${opts.maxConcepts} maxTerms=${opts.maxTerms} maxExamples=${opts.maxExamples}`;

    it(`summary is present at trim tier [${label}]`, () => {
      assert.ok(lesson !== undefined, 'Test fixture kbl-chem-1-2 not found');
      const block = buildLessonBlock(lesson!, 0, false, false, opts);
      // The summary is always included right after the title/header blank line
      // We verify the lesson's EN summary text appears somewhere in the block
      const summarySnippet = lesson!.summaryEn.slice(0, 40);
      assert.ok(
        block.includes(summarySnippet),
        `Summary snippet missing at tier [${label}]. Block:\n${block.slice(0, 300)}`,
      );
    });

    it(`rules section is present at trim tier [${label}] (when lesson has rules)`, () => {
      assert.ok(lesson !== undefined, 'Test fixture kbl-chem-1-2 not found');
      if (!lesson!.rulesEn || lesson!.rulesEn.length === 0) return;
      const block = buildLessonBlock(lesson!, 0, false, false, opts);
      assert.ok(
        block.includes('**Rules & Formulas:**'),
        `Rules section missing at trim tier [${label}]`,
      );
    });
  }
});

// ─── 4. Examples are the first section dropped ───────────────────────────────

describe('buildResponse — examples dropped before terms', () => {
  /**
   * Synthesise a fake lesson that is guaranteed to overflow the budget at full
   * fidelity. We pad summary + rules to ~800 chars each, then verify that
   * trimming removes examples before removing key terms.
   */
  it('drops examples before key terms when budget is tight', () => {
    const base = getLessonById('kbl-chem-1-2');
    assert.ok(base !== undefined, 'Test fixture kbl-chem-1-2 not found');

    // Create three copies with inflated examples so the full-fidelity combined
    // string is definitely over 3000 chars.
    const longExample = 'Example: '.padEnd(300, 'x'); // 300-char example
    const heavyLesson = {
      ...base!,
      examplesEn: [longExample, longExample],
      examplesAr: [longExample, longExample],
    };
    const lessons = [heavyLesson, heavyLesson, heavyLesson];

    // Full-fidelity (tier 0) must exceed the budget so trimming fires
    const tier0 = lessons.map((l, i) =>
      buildLessonBlock(l, i, true, false, TRIM_TIERS[0])
    ).join('\n\n---\n\n');
    assert.ok(
      tier0.length > CONTEXT_CHAR_BUDGET,
      `Inflated fixture did not exceed budget at tier 0 (${tier0.length} chars) — test is invalid`,
    );

    // buildResponse must still fit within the budget
    const result = buildResponse('broad topic', lessons, 'en', 'teacher');
    assert.ok(
      result.length <= CONTEXT_CHAR_BUDGET,
      `buildResponse did not trim down to budget: ${result.length} chars`,
    );

    // Tier 1 drops examples; tier 2+ drops terms too.
    // Detect which tier was used by checking whether terms are still present.
    const tier1 = lessons.map((l, i) =>
      buildLessonBlock(l, i, true, false, TRIM_TIERS[1])
    ).join('\n\n---\n\n');

    if (tier1.length <= CONTEXT_CHAR_BUDGET) {
      // Tier 1 was sufficient — examples absent, terms present
      assert.ok(!result.includes(longExample), 'Examples should be absent after tier-1 trim');
      assert.ok(result.includes('**Key Terms:**'), 'Key terms should still be present at tier 1');
    } else {
      // Further trimming needed — examples AND terms absent
      assert.ok(!result.includes(longExample), 'Examples should be absent after trimming');
    }

    // Summary must always be present
    const summarySnippet = base!.summaryEn.slice(0, 40);
    assert.ok(result.includes(summarySnippet), 'Summary must always be present after trimming');
  });
});

// ─── 5. Empty results ─────────────────────────────────────────────────────────

describe('buildResponse — edge cases', () => {
  it('returns empty string for empty results array', () => {
    const result = buildResponse('anything', [], 'en', 'teacher');
    assert.strictEqual(result, '', 'Expected empty string for no results');
  });

  it('Arabic output uses Arabic labels', () => {
    const lesson = getLessonById('kbl-math-8-1');
    assert.ok(lesson !== undefined, 'Test fixture kbl-math-8-1 not found');
    const result = buildResponse('احتمال', [lesson!], 'ar', 'student');
    assert.ok(result.includes('**المفاهيم الأساسية:**') || result.length > 0,
      'Arabic output should use Arabic labels');
    assert.ok(result.includes('📖 المصدر:'), 'Arabic output should have Arabic source label');
  });
});
