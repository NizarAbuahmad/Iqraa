/**
 * What the live chat sends the model as «مرجع الكتاب المدرسي».
 *
 * The keyword search returns lessons for almost any sentence. «كيف أتعامل مع
 * طالب مشاغب في الصف؟» ranked an English-for-hospitality lesson, the quadratic
 * formula and gravity, and the model was told to answer "primarily" from them.
 * These cases are the questions that were measured doing it (2026-10-16), run
 * through the real search, shaped into `results` the way the chat screen does.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { searchKBRanked } from '../knowledgeBase.ts';
import { deduplicateByUnit, liveChatGrounding } from '../kbContext.ts';

function ground(q: string, lang: 'ar' | 'en' = 'ar', anchorIds: string[] = []) {
  const ranked = searchKBRanked(q, lang);
  const results = deduplicateByUnit(ranked.map(r => r.lesson), 3);
  return { ranked, results, grounded: liveChatGrounding({ ranked, results, anchorIds, scopedConfident: false }) };
}

describe('liveChatGrounding', () => {
  for (const q of [
    'كيف أتعامل مع طالب مشاغب في الصف؟',
    'ما الفرق بين التقويم التكويني والختامي؟',
    'كيف أدير الوقت في الحصة؟',
  ]) {
    it(`sends no lesson for a general teaching question: ${q}`, () => {
      const { results, grounded } = ground(q);
      assert.ok(results.length > 0, 'precondition: the search does return lessons for it');
      assert.deepEqual(grounded.map(l => l.titleAr), []);
    });
  }

  it('sends no lesson for an English general question', () => {
    const { results, grounded } = ground('how do I deal with a disruptive student', 'en');
    assert.ok(results.length > 0);
    assert.deepEqual(grounded, []);
  });

  it('keeps the lesson a curriculum question is about', () => {
    const { grounded } = ground('اشرح لي قانون جيب التمام');
    assert.equal(grounded[0]?.titleAr, 'قانون جيب التمام');
  });

  it('keeps close same-subject rivals — they are all the topic asked about', () => {
    // 45 / 40 / 37.5: not "confident" on margin, but every hit is a maths
    // lesson on functions, which is what was asked.
    const { grounded } = ground('اشرح الاقترانات');
    assert.ok(grounded.length > 0);
    assert.ok(grounded.every(l => l.titleAr.includes('اقتران')), grounded.map(l => l.titleAr).join(' | '));
  });

  it('drops hits from two subjects — a shared word, not a topic', () => {
    // «القواعد» is grammar in English and bases in chemistry; the English
    // vocabulary lesson outscored the chemistry one.
    const { grounded } = ground('الأحماض والقواعد');
    assert.deepEqual(grounded, []);
  });

  it('always keeps a lesson the teacher chose, and only that lesson', () => {
    const q = 'كيف أتعامل مع طالب مشاغب في الصف؟';
    const { results } = ground(q);
    const chosen = results[1]!;
    const { grounded } = ground(q, 'ar', [chosen.id]);
    assert.deepEqual(grounded.map(l => l.id), [chosen.id]);
  });

  it('trusts a confident subject-scoped search as it is', () => {
    const ranked = searchKBRanked('كيف أتعامل مع طالب مشاغب في الصف؟', 'ar');
    const results = deduplicateByUnit(ranked.map(r => r.lesson), 3);
    assert.deepEqual(
      liveChatGrounding({ ranked, results, anchorIds: [], scopedConfident: true }),
      results,
    );
  });
});
