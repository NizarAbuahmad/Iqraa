/**
 * The pre-made practice-sheet manifest (`premade.ts`).
 *
 * These sheets are generated once, offline, and then frozen — nothing
 * regenerates them at browse time, so a defect committed here is served to
 * every teacher until someone regenerates the entry by hand. The three ways
 * that goes wrong are all silent:
 *
 * - a lesson carried as a title rather than a `kbl-` id, which re-resolves to
 *   a *different* lesson later (`searchKBSemantic` drifts on 16 of 63 titles);
 * - an answer key whose numbering does not line up with the questions, which
 *   renders as a key for the wrong question rather than as an error;
 * - a key claiming verification nothing actually checked.
 *
 * All three look like a working worksheet.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  allPremade,
  premadeForLesson,
  premadeForGradeSubject,
  PREMADE_LEVELS,
  VERIFICATION_SOURCES,
  type PremadeWorksheet,
} from '../premade.ts';

describe('the pre-made sheet manifest', () => {
  it('carries a KB lesson id, never a title', () => {
    for (const sheet of allPremade()) {
      assert.match(
        sheet.lessonId,
        /^kbl-/,
        `${sheet.id}: lessonId must be a KB id — a title re-resolves to another lesson`,
      );
    }
  });

  it('uses a known level, and an id derivable from lesson and level', () => {
    for (const sheet of allPremade()) {
      assert.ok(
        (PREMADE_LEVELS as readonly string[]).includes(sheet.level),
        `${sheet.id}: unknown level ${sheet.level}`,
      );
      assert.equal(
        sheet.id,
        `pw-${sheet.lessonId}-${sheet.level}`,
        `${sheet.id}: id must be derivable, so nothing has to store a mapping`,
      );
    }
  });

  it('has unique ids', () => {
    const ids = allPremade().map(s => s.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate sheet id');
  });

  it('numbers the answer key to cover every question exactly once', () => {
    for (const sheet of allPremade()) {
      const questionCount = sheet.content.sections.reduce(
        (n, section) => n + section.questions.length,
        0,
      );
      const nums = sheet.content.answerKey.map(k => k.num).sort((a, b) => a - b);
      assert.deepEqual(
        nums,
        Array.from({ length: questionCount }, (_, i) => i + 1),
        `${sheet.id}: answer key does not line up with the questions`,
      );
    }
  });

  it('records how every key was established, and never invents it', () => {
    for (const sheet of allPremade()) {
      assert.equal(
        sheet.keyVerification.length,
        sheet.content.answerKey.length,
        `${sheet.id}: every key needs a verification record`,
      );
      for (const entry of sheet.keyVerification) {
        assert.ok(
          (VERIFICATION_SOURCES as readonly string[]).includes(entry.verificationSource),
          `${sheet.id} q${entry.num}: ${entry.verificationSource} is not a source we can stand behind`,
        );
      }
    }
  });
});

describe('the accessors', () => {
  it('returns nothing for a lesson with no sheet', () => {
    assert.deepEqual(premadeForLesson('kbl-does-not-exist'), []);
  });

  it('filters by lesson', () => {
    for (const sheet of allPremade()) {
      const found: PremadeWorksheet[] = premadeForLesson(sheet.lessonId);
      assert.ok(
        found.some(s => s.id === sheet.id),
        `${sheet.id}: premadeForLesson did not return it`,
      );
    }
  });

  it('filters by grade and subject together', () => {
    for (const sheet of premadeForGradeSubject('grade-10', 'mathematics')) {
      assert.equal(sheet.gradeId, 'grade-10');
      assert.equal(sheet.subjectId, 'mathematics');
    }
  });
});
