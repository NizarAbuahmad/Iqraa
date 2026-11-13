/**
 * A Grade 1 maths paper is easier at «سهل» than at «صعب», offline.
 *
 * Swept 2026-11-13: the Grade 1 generators take their numbers from the lesson's
 * range and nearly all ignored the difficulty, so 50 of the 64 lessons drew the
 * same largest numbers at easy and at hard. `firstGradeDifficulty.ts` now keeps
 * one of several draws by difficulty. Measured here by `firstGradeLoad` (the
 * largest number, then the words to read) over whole five-question papers, the
 * way a quiz draws them.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { beginMathPracticeSession, firstGradeLoad, takeElementaryMath } from '@workspace/math-practice';
import { KB_LESSONS, getBookForLesson } from '../knowledgeBase.ts';

const G1_MATH = KB_LESSONS.filter(l => { const b = getBookForLesson(l); return b?.gradeId === 'grade-1' && b.subjectId === 'mathematics'; });
const PAPERS = 16;

function meanLoad(lesson: (typeof G1_MATH)[number], diff: 'easy' | 'medium' | 'hard'): number {
  let sum = 0, n = 0;
  for (let p = 0; p < PAPERS; p++) {
    beginMathPracticeSession();
    for (let i = 0; i < 5; i++) {
      const q = takeElementaryMath('short_answer', lesson.titleAr, lesson, 1, diff, 'ar', 1);
      if (!q) continue;
      sum += firstGradeLoad({ ar: q.text.split('\n')[0]!, answer: String(q.answer ?? '') }); n++;
    }
  }
  return n ? sum / n : 0;
}

describe('Grade 1 maths difficulty, offline', () => {
  // One pass over every lesson, shared by the assertions (each lesson draws 3 × 16 papers).
  const rows = G1_MATH.map(l => ({ l, easy: meanLoad(l, 'easy'), medium: meanLoad(l, 'medium'), hard: meanLoad(l, 'hard') }));

  it('no lesson is harder at «سهل» than at «صعب»', () => {
    // A few lessons have no harder version (the parts of 10, half past, a shape's sides,
    // solids, the days): their numbers are the lesson's own, so the margin is noise.
    const worse = rows.filter(r => r.hard < 0.85 * r.easy).map(r => `${r.l.titleAr}: ${r.easy.toFixed(0)} → ${r.hard.toFixed(0)}`);
    assert.deepEqual(worse, []);
  });

  it('most lessons are clearly harder at «صعب», with «متوسط» between', () => {
    const clear = rows.filter(r => r.hard >= 1.25 * r.easy);
    // 53 of 64 measured 2026-11-13; before the change, none was by design.
    assert.ok(clear.length >= 48, `only ${clear.length} of ${rows.length}`);
    const outOfOrder = clear.filter(r => r.medium < 0.95 * r.easy || r.medium > 1.05 * r.hard).map(r => r.l.titleAr);
    assert.deepEqual(outOfOrder, []);
  });
});
