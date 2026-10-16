/**
 * Every grade 1–9 maths lesson the offline generators serve asks at least three
 * kinds of question.
 *
 * Measured 2026-10-16: of 414 such lessons, 203 could ask only one kind — every
 * item the same sentence with new numbers («أوجد ناتج: 2 × 6», twenty times) — and
 * 99 only two. The generators were given the kinds their lessons' NCCD outcomes
 * list (a missing number, a word problem, the inverse question…); this keeps any
 * lesson from sliding back, including a new lesson routed to an old generator.
 *
 * A kind is a group of `stemFrame`s (the stem with its numbers masked) that
 * `sameKind` links: sentences a few words apart are one ask. Counted by frame
 * alone, 64 lessons passed on rewordings — «بعد ساعتين» / «بعد 3 ساعات», sin /
 * cos / tan of one triangle — and were given real kinds the same day.
 *
 * Draws go through `takeElementaryMath`, the route a quiz or worksheet takes for
 * these grades. Grade 10 is pinned in lib/math-practice (`lessonKinds.test.ts`).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { beginMathPracticeSession, elementaryOpsForTitle, lessonTitleBlob, sameKind, stemFrame, takeElementaryMath, topicFor } from '@workspace/math-practice';
import { KB_LESSONS } from '../knowledgeBase.ts';

const TIERS = ['easy', 'medium', 'hard'] as const;

function kinds(lesson: (typeof KB_LESSONS)[number], grade: number): number {
  const frames = new Set<string>();
  for (let run = 0; run < 4; run++) {
    beginMathPracticeSession();
    for (let i = 0; i < 30; i++) {
      const q = takeElementaryMath('short_answer', lesson.titleAr, lesson, grade, TIERS[i % 3]!, 'ar', 1);
      if (!q) break;
      frames.add(stemFrame(q.text));
    }
  }
  // Group linked frames (single linkage: `sameKind` is not transitive).
  const kinds: string[][] = [];
  for (const f of frames) {
    const near = kinds.filter(k => k.some(g => sameKind(f, g)));
    if (near.length === 0) { kinds.push([f]); continue; }
    near[0]!.push(f, ...near.slice(1).flat());
    for (const k of near.slice(1)) kinds.splice(kinds.indexOf(k), 1);
  }
  return kinds.length;
}

describe('grade 1–9 maths lessons ask several kinds of question', () => {
  const served = KB_LESSONS
    .filter(l => /^kbu-g[1-9]-math/.test(l.unitId))
    .map(l => ({ lesson: l, grade: Number(l.unitId.match(/^kbu-g(\d)/)![1]) }))
    .filter(({ lesson, grade }) =>
      (grade <= 6 && elementaryOpsForTitle(lessonTitleBlob(lesson.titleAr, lesson)).length > 0) || topicFor(lesson.titleAr, grade) !== null);

  it('covers the lessons it should (a routing change would show here)', () => {
    assert.ok(served.length >= 400, `only ${served.length} lessons are served`);
  });

  it('every served lesson has three kinds or more', () => {
    const thin = served
      .map(({ lesson, grade }) => ({ lesson, grade, n: kinds(lesson, grade) }))
      .filter(r => r.n < 3)
      .map(r => `g${r.grade} ${r.lesson.titleAr}: ${r.n}`);
    assert.deepEqual(thin, [], `${thin.length} lessons ask fewer than three kinds:\n${thin.join('\n')}`);
  });
});
