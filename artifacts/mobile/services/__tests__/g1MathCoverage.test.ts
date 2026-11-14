/**
 * Every Grade 1 maths lesson gets questions offline, about its own lesson.
 *
 * Swept 2026-11-13: six Grade 1 lessons refused («الموقع والاتجاه», the two
 * sorting lessons, two problem-solving lessons, «ترتيب الأعمال اليومية») and
 * several shared one bank. Each has a generator of its own now (`early.ts`).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { beginMathPracticeSession, takeElementaryMath } from '@workspace/math-practice';
import { KB_LESSONS, getBookForLesson } from '../knowledgeBase.ts';

const G1_MATH = KB_LESSONS.filter(l => { const b = getBookForLesson(l); return b?.gradeId === 'grade-1' && b.subjectId === 'mathematics'; });

describe('Grade 1 maths, offline', () => {
  it('has the two semesters of lessons', () => assert.ok(G1_MATH.length >= 60, String(G1_MATH.length)));

  it('every lesson gets a question of every type', () => {
    const refused: string[] = [];
    for (const l of G1_MATH) {
      beginMathPracticeSession();
      for (const type of ['multiple_choice', 'true_false', 'fill_blank', 'short_answer', 'word_problem'] as const) {
        if (!takeElementaryMath(type, l.titleAr, l, 1, 'easy', 'ar', 1)) refused.push(`${l.titleAr} (${type})`);
      }
    }
    assert.deepEqual(refused, []);
  });
});
