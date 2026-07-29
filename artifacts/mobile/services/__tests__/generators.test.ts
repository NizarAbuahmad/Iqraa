/**
 * Generator tests for the three new classroom activity types:
 *   error-detective, gallery-walk, exit-ticket
 *
 * Runs with Node's built-in test runner (no extra packages):
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/generators.test.ts
 *
 * Covers (for each activity type × each language = 6 combinations):
 *  1. Returns a non-empty slides array.
 *  2. Every slide has the required fields: slideNumber, type, title,
 *     content, durationSeconds — all with correct types.
 *  3. slideNumber values are consecutive starting from 1.
 *  4. durationSeconds is non-negative on every slide.
 *  5. The final slide has type === 'summary'.
 *  6. activityType on the result matches the request.
 *  7. Slide counts match the authored mock (regression guard).
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import type { ClassroomActivity, ClassroomActivityRequest } from '../ai/AIService.ts';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const service = new MockAIService();

const BASE_REQ = {
  grade: '10',
  subject: 'Math',
  topic: 'Quadratic Equations',
  duration: 20,
  difficulty: 'standard',
  groupType: 'groups',
  teachingGoal: 'practice',
} satisfies Omit<ClassroomActivityRequest, 'activityType' | 'language'>;

type ActivityType = 'error-detective' | 'gallery-walk' | 'exit-ticket';
type Language    = 'arabic' | 'english';

const ACTIVITY_TYPES: ActivityType[] = ['error-detective', 'gallery-walk', 'exit-ticket'];
const LANGUAGES: Language[]          = ['arabic', 'english'];

/** Number of slides authored in the mock for each activity type. */
const EXPECTED_SLIDE_COUNTS: Record<ActivityType, number> = {
  'error-detective': 8,
  'gallery-walk':    7,
  'exit-ticket':     5,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

for (const activityType of ACTIVITY_TYPES) {
  for (const language of LANGUAGES) {
    describe(`MockAIService.generateClassroomActivity — ${activityType} (${language})`, () => {
      let result: ClassroomActivity;

      before(async () => {
        result = await service.generateClassroomActivity({
          ...BASE_REQ,
          activityType,
          language,
        });
      });

      // ── 1. Non-empty slides array ──────────────────────────────────────────

      it('returns a non-empty slides array', () => {
        assert.ok(Array.isArray(result.slides), 'slides must be an array');
        assert.ok(result.slides.length > 0, 'slides array must not be empty');
      });

      // ── 2. Required fields on every slide ─────────────────────────────────

      it('every slide has required fields with correct types', () => {
        for (const slide of result.slides) {
          const id = `slide ${slide.slideNumber}`;

          assert.equal(
            typeof slide.slideNumber, 'number',
            `slideNumber must be a number (${id})`,
          );
          assert.equal(
            typeof slide.type, 'string',
            `type must be a string (${id})`,
          );
          assert.ok(
            slide.type.length > 0,
            `type must be non-empty (${id})`,
          );
          assert.equal(
            typeof slide.title, 'string',
            `title must be a string (${id})`,
          );
          assert.ok(
            slide.title.length > 0,
            `title must be non-empty (${id})`,
          );
          assert.equal(
            typeof slide.content, 'string',
            `content must be a string (${id})`,
          );
          assert.ok(
            slide.content.length > 0,
            `content must be non-empty (${id})`,
          );
          assert.equal(
            typeof slide.durationSeconds, 'number',
            `durationSeconds must be a number (${id})`,
          );
        }
      });

      // ── 3. Consecutive slideNumbers starting at 1 ─────────────────────────

      it('slideNumber values are consecutive starting from 1', () => {
        result.slides.forEach((slide, idx) => {
          assert.equal(
            slide.slideNumber,
            idx + 1,
            `slide at index ${idx} must have slideNumber ${idx + 1}, got ${slide.slideNumber}`,
          );
        });
      });

      // ── 4. durationSeconds is non-negative ────────────────────────────────

      it('durationSeconds is non-negative on every slide', () => {
        for (const slide of result.slides) {
          assert.ok(
            slide.durationSeconds >= 0,
            `durationSeconds must be >= 0 on slide ${slide.slideNumber}, got ${slide.durationSeconds}`,
          );
        }
      });

      // ── 5. Final slide is the summary ─────────────────────────────────────

      it('final slide has type === "summary"', () => {
        const lastSlide = result.slides[result.slides.length - 1];
        assert.equal(
          lastSlide.type,
          'summary',
          `last slide must have type "summary", got "${lastSlide.type}"`,
        );
      });

      // ── 6. activityType on result matches the request ─────────────────────

      it('activityType on the result matches the request', () => {
        assert.equal(
          result.activityType,
          activityType,
          `result.activityType must be "${activityType}", got "${result.activityType}"`,
        );
      });

      // ── 7. Slide count regression guard ───────────────────────────────────

      it(`has exactly ${EXPECTED_SLIDE_COUNTS[activityType]} slides`, () => {
        assert.equal(
          result.slides.length,
          EXPECTED_SLIDE_COUNTS[activityType],
          `expected ${EXPECTED_SLIDE_COUNTS[activityType]} slides for ${activityType} but got ${result.slides.length}`,
        );
      });
    });
  }
}
