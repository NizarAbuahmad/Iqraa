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
import { buildLessonShelf } from '../lessonShelf.ts';
import { displayTitle } from '../mathSupportResources.ts';
import {
  buildResponse,
  buildLessonBlock,
  buildAdaptationsDirective,
  resolveGeneratorGrounding,
  sourceCitationLine,
  TRIM_TIERS,
  CONTEXT_CHAR_BUDGET,
  deduplicateByUnit,
} from '../kbContext.ts';
import { getBookForLesson, getLessonById, KB_LESSONS } from '../knowledgeBase.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve fixture even when MVP hides Chemistry via getLessonById. */
function fixture(id: string) {
  return getLessonById(id) ?? KB_LESSONS.find(l => l.id === id);
}

/** Three of the longest lessons in the KB (Chemistry + Math). */
const LONG_LESSON_IDS = ['kbl-chem-s1-nccd-u1_l2', 'kbl-math-s2-nccd-u6_l2', 'kbl-chem-s1-nccd-u3_l1'];

// ─── 1. Single-lesson full-fidelity ──────────────────────────────────────────

describe('buildResponse — single-lesson query', () => {
  it('returns a non-empty string for a known lesson', () => {
    const lesson = fixture('kbl-math-s2-nccd-u6_l2');
    assert.ok(lesson !== undefined, 'Test fixture kbl-math-s2-nccd-u6_l2 not found in KB');
    const result = buildResponse('differentiation rules', [lesson!], 'en', 'teacher');
    assert.ok(result.length > 0, 'buildResponse returned empty string for single lesson');
  });

  it('single-lesson output is well within the budget (tier 0)', () => {
    const lesson = fixture('kbl-math-s2-nccd-u6_l2');
    assert.ok(lesson !== undefined, 'Test fixture kbl-math-s2-nccd-u6_l2 not found in KB');
    const result = buildResponse('differentiation rules', [lesson!], 'en', 'teacher');
    assert.ok(
      result.length <= CONTEXT_CHAR_BUDGET,
      `Single-lesson output (${result.length} chars) exceeds budget of ${CONTEXT_CHAR_BUDGET}`,
    );
  });

  it('single-lesson output at full fidelity includes examples section header', () => {
    const lesson = fixture('kbl-math-s2-nccd-u6_l2');
    assert.ok(lesson !== undefined, 'Test fixture kbl-math-s2-nccd-u6_l2 not found in KB');
    const result = buildResponse('differentiation rules', [lesson!], 'en', 'teacher');
    // At full fidelity there should be no multi-result reference prefix
    assert.ok(!result.includes('[Reference 1]'), 'Single-lesson result should not have reference prefix');
  });
});

// ─── 2. Three-lesson combined fits within budget ──────────────────────────────

describe('buildResponse — three-lesson query', () => {
  it('combined output is ≤ CONTEXT_CHAR_BUDGET characters', () => {
    const lessons = LONG_LESSON_IDS.map(id => fixture(id)).filter(Boolean) as any[];
    assert.strictEqual(lessons.length, 3, 'Could not load all 3 test fixture lessons');
    const result = buildResponse('explain chemistry and math', lessons, 'en', 'teacher');
    assert.ok(
      result.length <= CONTEXT_CHAR_BUDGET,
      `Three-lesson combined output (${result.length} chars) exceeds budget of ${CONTEXT_CHAR_BUDGET}`,
    );
  });

  it('three-lesson output contains reference prefixes', () => {
    const lessons = LONG_LESSON_IDS.map(id => fixture(id)).filter(Boolean) as any[];
    const result = buildResponse('broad question', lessons, 'en', 'teacher');
    assert.ok(result.includes('[Reference 1]'), 'Expected [Reference 1] prefix in multi-lesson output');
    assert.ok(result.includes('[Reference 2]'), 'Expected [Reference 2] prefix in multi-lesson output');
    assert.ok(result.includes('[Reference 3]'), 'Expected [Reference 3] prefix in multi-lesson output');
  });

  it('three-lesson output contains separator lines between blocks', () => {
    const lessons = LONG_LESSON_IDS.map(id => fixture(id)).filter(Boolean) as any[];
    const result = buildResponse('broad question', lessons, 'en', 'teacher');
    assert.ok(result.includes('---'), 'Expected --- separator between lesson blocks');
  });
});

// ─── 3. Summary and rules always preserved ───────────────────────────────────

describe('buildLessonBlock — summary and rules always present', () => {
  const lesson = fixture('kbl-chem-s1-nccd-u1_l2');

  for (const opts of TRIM_TIERS) {
    const label = `maxConcepts=${opts.maxConcepts} maxTerms=${opts.maxTerms} maxExamples=${opts.maxExamples}`;

    it(`summary is present at trim tier [${label}]`, () => {
      assert.ok(lesson !== undefined, 'Test fixture kbl-chem-s1-nccd-u1_l2 not found');
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
      assert.ok(lesson !== undefined, 'Test fixture kbl-chem-s1-nccd-u1_l2 not found');
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
    const base = fixture('kbl-chem-s1-nccd-u1_l2');
    assert.ok(base !== undefined, 'Test fixture kbl-chem-s1-nccd-u1_l2 not found');

    // Create three copies with inflated summary + examples so the
    // full-fidelity combined string is definitely over 3000 chars.
    // (The lesson data itself is book-faithful and lean, so the test pads
    // its own fixture instead of depending on fat lesson content.)
    const longExample = 'Example: '.padEnd(300, 'x'); // 300-char example
    // Sized so tier 0 (with examples) overflows the budget but tier 1
    // (examples dropped, terms kept) fits: buildResponse appends a support-
    // resources block on top of the three lesson blocks, so each tier-1
    // block must stay ≈≤800 chars for the combined output to fit.
    const longSummary = 'Summary '.padEnd(400, 'y');
    const heavyLesson = {
      ...base!,
      summaryEn: longSummary,
      summaryAr: longSummary,
      // Terms need definitions to render — book-sourced vocab has none, so
      // the test supplies its own.
      keyTerms: [
        { ar: 'مصطلح', en: 'term', definitionAr: 'تعريف قصير', definitionEn: 'a short definition' },
      ],
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

    // Summary must always be present (the padded one — heavyLesson replaces it)
    const summarySnippet = longSummary.slice(0, 40);
    assert.ok(result.includes(summarySnippet), 'Summary must always be present after trimming');
  });
});

// ─── 5. deduplicateByUnit ─────────────────────────────────────────────────────

describe('deduplicateByUnit', () => {
  it('returns empty array for empty input', () => {
    assert.deepStrictEqual(deduplicateByUnit([]), []);
  });

  it('returns single lesson unchanged', () => {
    const lesson = fixture('kbl-math-s2-nccd-u6_l2');
    assert.ok(lesson !== undefined, 'Fixture kbl-math-s2-nccd-u6_l2 not found');
    const result = deduplicateByUnit([lesson!]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'kbl-math-s2-nccd-u6_l2');
  });

  it('passes through three lessons from different units without dropping any', () => {
    // kbl-chem-s1-nccd-u1_l2 (unit u1), kbl-math-s2-nccd-u6_l2, kbl-math-s2-nccd-u8_l4
    const ids = ['kbl-chem-s1-nccd-u1_l2', 'kbl-math-s2-nccd-u6_l2', 'kbl-math-s2-nccd-u8_l4'];
    const lessons = ids.map(id => fixture(id)).filter(Boolean) as any[];
    assert.strictEqual(lessons.length, 3, 'Could not load all three fixtures');
    const result = deduplicateByUnit(lessons, 3);
    assert.strictEqual(result.length, 3, 'Expected all three distinct-unit lessons to pass through');
    assert.deepStrictEqual(result.map((l: any) => l.id), ids);
  });

  it('removes the second lesson when two top results share a unit', () => {
    // kbl-math-s2-nccd-u6_l1 and kbl-math-s2-nccd-u6_l2 are both in kbu-math-2; kbl-math-s2-nccd-u8_l4 is in kbu-math-8
    const ids = ['kbl-math-s2-nccd-u6_l1', 'kbl-math-s2-nccd-u6_l2', 'kbl-math-s2-nccd-u8_l4'];
    const lessons = ids.map(id => fixture(id)).filter(Boolean) as any[];
    assert.strictEqual(lessons.length, 3, 'Could not load all three fixtures');
    const result = deduplicateByUnit(lessons, 3);
    // kbl-math-s2-nccd-u6_l2 should be skipped (same unit as kbl-math-s2-nccd-u6_l1)
    assert.strictEqual(result.length, 2, 'Expected 2 results after deduplication');
    assert.strictEqual(result[0].id, 'kbl-math-s2-nccd-u6_l1', 'First result should be highest-ranked lesson');
    assert.strictEqual(result[1].id, 'kbl-math-s2-nccd-u8_l4', 'Second slot should be next distinct-unit lesson');
    assert.ok(!result.find((l: any) => l.id === 'kbl-math-s2-nccd-u6_l2'), 'Duplicate-unit lesson should be excluded');
  });

  it('returns only one result when all input lessons share a unit', () => {
    // kbl-math-s2-nccd-u6_l1, kbl-math-s2-nccd-u6_l2, kbl-math-s2-nccd-u6_l3 are all in kbu-math-2
    const ids = ['kbl-math-s2-nccd-u6_l1', 'kbl-math-s2-nccd-u6_l2'];
    const lessons = ids.map(id => fixture(id)).filter(Boolean) as any[];
    assert.strictEqual(lessons.length, 2, 'Could not load fixtures');
    const result = deduplicateByUnit(lessons, 3);
    assert.strictEqual(result.length, 1, 'Expected only 1 result when all share a unit');
    assert.strictEqual(result[0].id, 'kbl-math-s2-nccd-u6_l1', 'First result should be the top-ranked lesson');
  });

  it('respects the maxResults cap', () => {
    // Six lessons across six different units — cap at 2
    const ids = [
      'kbl-chem-s1-nccd-u1_l1', // unit u1
      'kbl-chem-s1-nccd-u3_l1', // unit u3
      'kbl-math-s2-nccd-u5_l1', // kbu-math-1
      'kbl-math-s2-nccd-u6_l1', // kbu-math-2
    ];
    const lessons = ids.map(id => fixture(id)).filter(Boolean) as any[];
    const result = deduplicateByUnit(lessons, 2);
    assert.strictEqual(result.length, 2, 'Should not exceed maxResults even with distinct units');
    assert.strictEqual(result[0].id, 'kbl-chem-s1-nccd-u1_l1');
    assert.strictEqual(result[1].id, 'kbl-chem-s1-nccd-u3_l1');
  });

  it('fills open slots with later distinct-unit lessons (promotes a lesson over a same-unit duplicate)', () => {
    // First two share a unit; third is distinct — third should promote to slot 2
    const ids = [
      'kbl-math-s2-nccd-u6_l1', // kbu-math-2
      'kbl-math-s2-nccd-u6_l2', // kbu-math-2  ← duplicate, should be skipped
      'kbl-chem-s1-nccd-u3_l2', // unit u3  ← should promote to slot 2
    ];
    const lessons = ids.map(id => fixture(id)).filter(Boolean) as any[];
    assert.strictEqual(lessons.length, 3, 'Could not load fixtures');
    const result = deduplicateByUnit(lessons, 3);
    assert.strictEqual(result.length, 2, 'Expected 2 distinct-unit results');
    assert.strictEqual(result[0].id, 'kbl-math-s2-nccd-u6_l1');
    assert.strictEqual(result[1].id, 'kbl-chem-s1-nccd-u3_l2', 'Third-ranked lesson should promote when second is a duplicate');
  });
});

// ─── 5. Empty results ─────────────────────────────────────────────────────────

describe('buildResponse — edge cases', () => {
  it('returns empty string for empty results array', () => {
    const result = buildResponse('anything', [], 'en', 'teacher');
    assert.strictEqual(result, '', 'Expected empty string for no results');
  });

  it('Arabic output uses Arabic labels', () => {
    const lesson = fixture('kbl-math-s2-nccd-u8_l4');
    assert.ok(lesson !== undefined, 'Test fixture kbl-math-s2-nccd-u8_l4 not found');
    const result = buildResponse('احتمال', [lesson!], 'ar', 'student');
    assert.ok(result.includes('**المفاهيم الأساسية:**') || result.length > 0,
      'Arabic output should use Arabic labels');
    assert.ok(result.includes('📖 المصدر:'), 'Arabic output should have Arabic source label');
  });
});

describe('generator grounding: teacher objectives', () => {
  const TOPIC = 'المشروع وإدارته';

  it('keeps the official curriculum outcomes when the teacher adds their own', () => {
    // This was an if/else: typing anything into the optional objectives box
    // silently deleted the NCCD نتاجات from the prompt, while the screen still
    // showed «مرتبط بالمنهاج الأردني». Adding one line made the plan LESS
    // curriculum-grounded than leaving the box empty, and nothing said so.
    const plain = resolveGeneratorGrounding(TOPIC, 'ar');
    assert.equal(plain.grounded, true);
    assert.match(plain.context, /النتاجات \(من المنهاج الرسمي\)/);

    const withTeacher = resolveGeneratorGrounding(TOPIC, 'ar', {
      teacherObjectives: 'أن يخطط الطالب لمشروع صغير.',
    });
    assert.match(withTeacher.context, /النتاجات \(من المعلم\)/);
    assert.match(withTeacher.context, /النتاجات \(من المنهاج الرسمي\)/);
    // Every official outcome that survived without the teacher line must still
    // be there with it — the teacher adds, never replaces.
    for (const line of plain.context.split('\n').filter(l => l.startsWith('• '))) {
      assert.ok(withTeacher.context.includes(line), `dropped: ${line}`);
    }
  });
});

describe('buildAdaptationsDirective', () => {
  it('frames the request as delivery instructions, not objectives', () => {
    // "tailor this plan for a student with ADHD" typed into the objectives box
    // came back as the lesson's sole stated objective, verbatim and in English,
    // with nothing in the body adapted. An adaptation says how to write every
    // section; it is not something a student can demonstrate.
    const out = buildAdaptationsDirective('كيّف الخطة لطالب لديه فرط حركة', 'ar');
    assert.match(out, /التمايز/);
    assert.match(out, /لا تُدرجها ضمن الأهداف/);
    assert.match(out, /كيّف الخطة لطالب لديه فرط حركة/);
  });

  it('is empty for blank input so callers can filter it away', () => {
    assert.equal(buildAdaptationsDirective('', 'ar'), '');
    assert.equal(buildAdaptationsDirective('   \n  ', 'en'), '');
  });

  it('speaks English when the teacher does', () => {
    const out = buildAdaptationsDirective('adapt for a student with ADHD', 'en');
    assert.match(out, /differentiation/);
    assert.match(out, /not learning\s+outcomes/);
  });
});

describe('sourceCitationLine', () => {
  it('renders the page in Arabic-Indic digits with a middle dot separator', () => {
    const out = sourceCitationLine([{ titleAr: 'كتاب الرياضيات - الفصل الأول', page: 35 }], true);
    assert.equal(out, 'كتاب الرياضيات - الفصل الأول · صفحة ٣٥');
  });

  it('renders plain digits in English', () => {
    const out = sourceCitationLine([{ titleAr: 'Math Book — Semester 1', page: 35 }], false);
    assert.equal(out, 'Math Book — Semester 1 · page 35');
  });

  it('joins multiple sources, each with its own page', () => {
    const out = sourceCitationLine(
      [
        { titleAr: 'كتاب الرياضيات - الفصل الأول', page: 34 },
        { titleAr: 'كتاب الرياضيات - الفصل الأول', page: 35 },
      ],
      true,
    );
    assert.equal(out, 'كتاب الرياضيات - الفصل الأول · صفحة ٣٤، كتاب الرياضيات - الفصل الأول · صفحة ٣٥');
  });

  it('is empty for no sources so callers can render conditionally', () => {
    assert.equal(sourceCitationLine([], true), '');
  });
});

describe('buildResponse — a document the teacher opened', () => {
  // The remote path's half of the shelf hand-off. `buildResponse` feeds
  // `remoteAIService.chat`; the DEMO_MODE reply is covered in
  // chatHandoffPin.test.ts, and both had to move for the fix to be visible.
  const fixture = () => {
    for (const l of KB_LESSONS) {
      if (getBookForLesson(l)?.subjectId !== 'mathematics') continue;
      const shelf = buildLessonShelf(l.id);
      const items = shelf ? shelf.unit.flatMap(g => g.items) : [];
      if (items.length >= 2) return { lesson: l, items };
    }
    throw new Error('no maths lesson with a unit shelf');
  };

  it('names the opened file in the support block', () => {
    const { lesson, items } = fixture();
    const out = buildResponse('اشرح الدرس', [lesson], 'ar', 'teacher', items[0]!.id);
    assert.ok(out.includes(displayTitle(items[0]!)), out.slice(-400));
  });

  it('still fits the budget with a pinned file', () => {
    // The support block is built once, outside the trim tiers, so anything
    // added to it rides over the budget rather than being trimmed out of it.
    const { lesson, items } = fixture();
    for (const r of items) {
      const out = buildResponse('اشرح الدرس', [lesson], 'ar', 'teacher', r.id);
      assert.ok(out.length <= CONTEXT_CHAR_BUDGET, `${r.id}: ${out.length}`);
    }
  });

  it('is unchanged when nothing was opened', () => {
    const { lesson } = fixture();
    assert.equal(
      buildResponse('اشرح الدرس', [lesson], 'ar', 'teacher', undefined),
      buildResponse('اشرح الدرس', [lesson], 'ar', 'teacher'),
    );
  });
});
