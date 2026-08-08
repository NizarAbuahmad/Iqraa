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
import {
  getLessonById,
  getLessonsForUnit,
  getUnitsForSubjectGrade,
  KB_LESSONS,
  KB_UNITS,
  resolveGroundedKbLesson,
  searchKB,
} from '../knowledgeBase.ts';
import { INVESTOR_MVP_CURRICULUM } from '../curriculumData.ts';

// ─── 1. Chip lessonId integrity ───────────────────────────────────────────────
// These are the lessonIds used in the SUGGESTIONS constant in iqra.tsx.
// They must all resolve to a real KBLesson; if they don't, chips will silently
// fall back to a text search which may return a wrong lesson.
const CHIP_LESSON_IDS = [
  // teacher – Arabic
  'kbl-chem-s1-nccd-u1_l1',
  'kbl-chem-s1-nccd-u3_l1',
  'kbl-math-s2-nccd-u5_l4',
  'kbl-math-s2-nccd-u8_l4',
  'kbl-chem-s1-nccd-u1_l2',
  // teacher – English (same ids, listed for documentation)
  // student – Arabic
  'kbl-math-s2-nccd-u8_l4',
  'kbl-math-s2-nccd-u5_l2',
  // student – English (same ids)
];

// De-duplicate
const UNIQUE_CHIP_IDS = [...new Set(CHIP_LESSON_IDS)];

describe('getLessonById — chip lessonId integrity', () => {
  for (const id of UNIQUE_CHIP_IDS) {
    it(`lessonId "${id}" resolves to a real lesson`, () => {
      // MVP hides Chemistry from getLessonById — still assert the row exists in KB_LESSONS.
      const lesson = getLessonById(id) ?? KB_LESSONS.find(l => l.id === id);
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
  // Chemistry search is hidden under investor MVP visibility — skip when locked.
  const chemIt = INVESTOR_MVP_CURRICULUM ? it.skip : it;

  chemIt('"رابطة" (without ال) returns a unit-3 bonding lesson as top result', () => {
    const results = searchKB('رابطة', 'ar');
    assert.ok(results.length > 0, 'searchKB returned no results for "رابطة"');
    const topId = results[0].id;
    assert.ok(
      topId.startsWith('kbl-chem-s1-nccd-u3_'),
      `Expected a unit-3 bonding lesson (kbl-chem-s1-nccd-u3_*) to rank first for "رابطة", got "${topId}"`,
    );
  });

  chemIt('"الرابطة" (with ال) returns a chemical-bonding lesson first', () => {
    const results = searchKB('الرابطة', 'ar');
    assert.ok(results.length > 0, 'searchKB returned no results for "الرابطة"');
    const topId = results[0].id;
    assert.ok(
      topId.startsWith('kbl-chem-s1-nccd-u3_'),
      `Expected a unit-3 bonding lesson first for "الرابطة", got "${topId}"`,
    );
  });

  chemIt('"الأيونية" matches a unit-3 bonding/compounds lesson as top result', () => {
    const results = searchKB('الأيونية', 'ar');
    assert.ok(results.length > 0, 'searchKB returned no results for "الأيونية"');
    assert.ok(
      results[0].id.startsWith('kbl-chem-s1-nccd-u3_'),
      `Expected a unit-3 lesson for "الأيونية", got "${results[0].id}"`,
    );
  });

  chemIt('"أوفباو" (without ال) surfaces kbl-chem-s1-nccd-u2_l1 (التوزيع الإلكتروني — per the student book)', () => {
    const results = searchKB('أوفباو', 'ar');
    assert.ok(results.length > 0, 'searchKB returned no results for "أوفباو"');
    assert.strictEqual(results[0].id, 'kbl-chem-s1-nccd-u2_l1');
  });

  it('"الاحتمال" returns a probability lesson first', () => {
    const results = searchKB('الاحتمال', 'ar');
    assert.ok(results.length > 0, 'searchKB returned no results for "الاحتمال"');
    assert.ok(
      results[0].id.startsWith('kbl-math-s2-nccd-u8_'),
      `Expected a Sem2 probability lesson (kbl-math-s2-nccd-u8_*) first for "الاحتمال", got "${results[0].id}"`,
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
  // Math NCCD titles are Arabic-only. Chemistry search is hidden under MVP.
  const TEACHER_CHIPS: Array<{ text: string; expectedId: string; lang?: 'ar' | 'en'; chem?: boolean }> = [
    { text: "What is Bohr's model?",                    expectedId: 'kbl-chem-s1-nccd-u1_l1', chem: true },
    { text: 'Explain covalent bonding',                 expectedId: 'kbl-chem-s1-nccd-u3_l1', chem: true },
    { text: 'الاقتران العكسي',                          expectedId: 'kbl-math-s2-nccd-u5_l4', lang: 'ar' },
    { text: 'تمييز الحادثين المتنافيين',               expectedId: 'kbl-math-s2-nccd-u8_l4', lang: 'ar' },
    { text: 'Quantum numbers explained',                expectedId: 'kbl-chem-s1-nccd-u1_l2', chem: true },
  ];

  for (const { text, expectedId, lang, chem } of TEACHER_CHIPS) {
    const run = chem && INVESTOR_MVP_CURRICULUM ? it.skip : it;
    run(`teacher chip: "${text}" → ${expectedId} is top result`, () => {
      const results = searchKB(text, lang ?? 'en');
      assert.ok(results.length > 0, `searchKB returned no results for "${text}"`);
      assert.strictEqual(
        results[0].id,
        expectedId,
        `Expected "${expectedId}" as top result for "${text}", got "${results[0].id}"`,
      );
    });
  }

  const STUDENT_CHIPS: Array<{ text: string; expectedId: string; lang?: 'ar' | 'en'; chem?: boolean }> = [
    { text: "Help me understand Bohr's model",               expectedId: 'kbl-chem-s1-nccd-u1_l1', chem: true },
    { text: 'تمييز الحادثين المتنافيين من الحادثين غير المتنافيين', expectedId: 'kbl-math-s2-nccd-u8_l4', lang: 'ar' },
    { text: 'Difference between sigma and pi bonds?',        expectedId: 'kbl-chem-s1-nccd-u3_l1', chem: true },
    { text: 'قسمة كثيرات الحدود والاقترانات النسبية',       expectedId: 'kbl-math-s2-nccd-u5_l2', lang: 'ar' },
    { text: 'Explain Aufbau principle simply',               expectedId: 'kbl-chem-s1-nccd-u2_l1', chem: true },
  ];

  for (const { text, expectedId, lang, chem } of STUDENT_CHIPS) {
    const run = chem && INVESTOR_MVP_CURRICULUM ? it.skip : it;
    run(`student chip (pinned): "${text}" → ${expectedId} in top 3`, () => {
      const results = searchKB(text, lang ?? 'en');
      assert.ok(results.length > 0, `searchKB returned no results for "${text}"`);
      const top3Ids = results.slice(0, 3).map(l => l.id);
      assert.ok(
        top3Ids.includes(expectedId),
        `Expected "${expectedId}" to appear in top-3 for "${text}", got: [${top3Ids.join(', ')}]`,
      );
    });
  }
});

// ─── 4. Grounding confidence — never silently substitute unrelated lessons ────
describe('resolveGroundedKbLesson — confidence gate', () => {
  it('exact NCCD lesson title is grounded', () => {
    const lesson = resolveGroundedKbLesson('تركيب الاقترانات', 'ar');
    assert.ok(lesson, 'Expected grounded match for تركيب الاقترانات');
    assert.strictEqual(lesson!.id, 'kbl-math-s2-nccd-u5_l3');
  });

  it('unwired semester-1 equations topic is NOT grounded (no silent substitute)', () => {
    const lesson = resolveGroundedKbLesson('المعادلات-حل معادلات خاصة', 'ar');
    assert.equal(
      lesson,
      null,
      `Expected null (ungrounded), got "${lesson?.id}" / "${lesson?.titleAr}"`,
    );
  });

  it('weak fuzzy hit via searchKB must still fail grounding', () => {
    const ranked = searchKB('المعادلات-حل معادلات خاصة', 'ar');
    // search may still return weak hits — grounding must reject them
    const grounded = resolveGroundedKbLesson('المعادلات-حل معادلات خاصة', 'ar');
    assert.equal(grounded, null);
    if (ranked.length > 0) {
      assert.notEqual(
        ranked[0].titleAr,
        'المعادلات-حل معادلات خاصة',
        'Sanity: top fuzzy hit is not an exact title match',
      );
    }
  });

  it('Sem1 Unit 1 lesson title is grounded with per-lesson objectives', () => {
    const lesson = resolveGroundedKbLesson('حل المعادلة الأسية', 'ar');
    assert.ok(lesson, 'Expected grounded match for حل المعادلة الأسية');
    assert.equal(lesson!.id, 'kbl-math-s1-nccd-u1_l4');
    assert.ok(lesson!.objectives.length > 0, 'Unit 1 lesson should have per-lesson objectives');
  });

  it('TopicSelector data path: Sem1 Unit 1 is الأسس والمعادلات with 5 NCCD lessons', () => {
    const units = getUnitsForSubjectGrade('mathematics', 'grade-10');
    const u1 = units.find(u => u.id === 'kbu-math-s1-nccd-u1');
    assert.ok(u1, 'Expected NCCD Sem1 unit 1 in TopicSelector unit list');
    assert.equal(u1!.titleAr, 'الأسس والمعادلات');
    const lessons = getLessonsForUnit(u1!.id);
    assert.equal(lessons.length, 5);
    assert.ok(lessons.some(l => l.titleAr === 'تبسيط المقادير الأسية'));
    assert.ok(lessons.some(l => l.titleAr === 'حل المعادلة الأسية'));
    assert.equal(KB_UNITS.some(u => u.id === 'kbu-math-s2-1'), false, 'legacy المعادلات unit must not be exported');
    assert.equal(units.some(u => u.titleAr === 'المعادلات'), false, 'TopicSelector must not offer legacy المعادلات');
  });

  it('Sem1 Unit 2 title-only lesson is grounded but has empty objectives', () => {
    const lesson = resolveGroundedKbLesson('أوتار الدائرة وأقطارها ومماساتها', 'ar');
    assert.ok(lesson, 'Expected grounded match for أوتار الدائرة');
    assert.equal(lesson!.id, 'kbl-math-s1-nccd-u2_l1');
    assert.equal(lesson!.objectives.length, 0, 'Title-only lesson keeps empty per-lesson objectives');
  });
});
