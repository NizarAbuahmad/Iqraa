/**
 * A grade 1–4 maths paper is easier at «سهل» than at «صعب», offline.
 *
 * Swept 2026-11-13: the early generators take their numbers from the lesson's
 * range and mostly ignored the difficulty. In Grade 1, 50 of 64 lessons drew the
 * same largest numbers at easy and at hard; over whole papers only 15 of 57
 * Grade 2, 25 of 66 Grade 3 and 34 of 48 Grade 4 lessons were clearly harder at
 * hard, and 8 were harder at easy. `earlyDifficulty.ts` now keeps one of several
 * draws by difficulty. Measured here by `difficultyLoad` (the largest number,
 * then the words to read) over whole five-question papers, the way a quiz draws.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { beginMathPracticeSession, difficultyLoad, takeElementaryMath } from '@workspace/math-practice';
import { KB_LESSONS, getBookForLesson } from '../knowledgeBase.ts';

type Lesson = (typeof KB_LESSONS)[number];
const PAPERS = 12;

function meanLoad(lesson: Lesson, grade: number, diff: 'easy' | 'medium' | 'hard'): number {
  let sum = 0, n = 0;
  for (let p = 0; p < PAPERS; p++) {
    beginMathPracticeSession();
    for (let i = 0; i < 5; i++) {
      const q = takeElementaryMath('short_answer', lesson.titleAr, lesson, grade, diff, 'ar', 1);
      if (!q) continue;
      sum += difficultyLoad({ ar: q.text.split('\n')[0]!, answer: String(q.answer ?? '') }); n++;
    }
  }
  return n ? sum / n : NaN;
}

/**
 * Lessons clearly harder at hard, at least: measured 2026-11-13 as 53 of 64,
 * 54 of 57, 65 of 66 and 48 of 48. The rest have no harder version (the parts
 * of 10, half past, a shape's sides, solids, the days, before and after noon).
 */
const MIN_CLEAR: Record<number, number> = { 1: 48, 2: 50, 3: 60, 4: 44 };

for (const grade of [1, 2, 3, 4]) {
  describe(`Grade ${grade} maths difficulty, offline`, () => {
    const lessons = KB_LESSONS.filter(l => { const b = getBookForLesson(l); return b?.gradeId === `grade-${grade}` && b.subjectId === 'mathematics'; });
    // One pass, shared by the assertions.
    const rows = lessons
      .map(l => ({ l, easy: meanLoad(l, grade, 'easy'), medium: meanLoad(l, grade, 'medium'), hard: meanLoad(l, grade, 'hard') }))
      .filter(r => !Number.isNaN(r.easy));

    it('no lesson is harder at «سهل» than at «صعب»', () => {
      const worse = rows.filter(r => r.hard < 0.85 * r.easy).map(r => `${r.l.titleAr}: ${r.easy.toFixed(0)} → ${r.hard.toFixed(0)}`);
      assert.deepEqual(worse, []);
    });

    it('most lessons are clearly harder at «صعب», with «متوسط» between', () => {
      const clear = rows.filter(r => r.hard >= 1.25 * r.easy);
      assert.ok(clear.length >= MIN_CLEAR[grade]!, `only ${clear.length} of ${rows.length}`);
      const outOfOrder = clear.filter(r => r.medium < 0.95 * r.easy || r.medium > 1.05 * r.hard).map(r => r.l.titleAr);
      assert.deepEqual(outOfOrder, []);
    });
  });
}
