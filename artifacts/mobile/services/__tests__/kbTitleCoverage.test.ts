/**
 * A lesson whose whole title is in the query outranks a lesson that only shares
 * one common word with it.
 *
 * Found 2026-11-01 on app.iqrra.com: «جهّز ورقة عمل … عن حل المعادلة التربيعية
 * بالتحليل» was answered «أيّ مادة تقصد؟» with Digital Skills on the menu.
 * `searchKBRanked` put «تحليل البيانات» (digital-literacy) first at 65 — the word
 * «تحليل» sits in its title, its unit title, six key concepts and six key terms —
 * and the exact lesson «حل المعادلات التربيعية بالتحليل» fifth at 26.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getBookForLesson, getLessonById, searchKBRanked, titleDecides } from '../knowledgeBase.ts';
import { isConfidentSingleSubjectHit, liveChatGrounding } from '../kbContext.ts';
import { isConfidentKbHit } from '../kbSuggestion.ts';

const T = /[ً-ٰٟـ]/g;
const plain = (s: string) => s.replace(T, '');

const TOPIC = 'حل المعادلة التربيعية بالتحليل';
const REQUEST = 'جهّز ورقة عمل من 4 أسئلة عن حل المعادلة التربيعية بالتحليل';

describe('a title the query contains whole wins', () => {
  for (const q of [TOPIC, REQUEST]) {
    it(`«${q}» ranks the maths lesson first`, () => {
      const ranked = searchKBRanked(q, 'ar');
      assert.equal(plain(ranked[0]!.lesson.titleAr), 'حل المعادلات التربيعية بالتحليل');
      assert.equal(getBookForLesson(ranked[0]!.lesson)?.subjectId, 'mathematics');
      assert.equal(ranked[0]!.titleCovered, true);
    });
    it(`«${q}» is a confident single-subject hit, so the chat does not ask «أيّ مادة؟»`, () => {
      const ranked = searchKBRanked(q, 'ar');
      assert.equal(titleDecides(ranked), true);
      assert.equal(isConfidentKbHit(ranked), true);
      assert.equal(isConfidentSingleSubjectHit(ranked), true);
    });
  }

  it('the live chat hands the model the maths lesson, not nothing', () => {
    const ranked = searchKBRanked(REQUEST, 'ar');
    const grounded = liveChatGrounding({ ranked, results: ranked.slice(0, 3).map(r => r.lesson), anchorIds: [], scopedConfident: false });
    assert.ok(grounded.length > 0);
    assert.ok(grounded.every(l => getBookForLesson(l)?.subjectId === 'mathematics'));
  });
});

describe('it does not decide what nobody named', () => {
  it('a lesson that is still named by its own title is first, as before', () => {
    const ranked = searchKBRanked('تحليل البيانات', 'ar');
    assert.equal(getBookForLesson(ranked[0]!.lesson)?.subjectId, 'digital-literacy');
    assert.equal(plain(ranked[0]!.lesson.titleAr), 'تحليل البيانات');
  });

  it('one shared word proves nothing: «تحليل» alone decides nothing', () => {
    const ranked = searchKBRanked('تحليل', 'ar');
    assert.equal(titleDecides(ranked), false);
    assert.equal(ranked.some(r => r.titleCovered), false);
  });

  it('a vowelled early-grade title still does not match a plain query across grades', () => {
    // groundingTashkeel.test.ts: folding harakat in the scorer promoted a grade 8
    // science lesson over grade 10 chemistry. The coverage rule folds them only
    // inside a grade-scoped search, like the scorer does.
    const ranked = searchKBRanked('تكاثر الكائنات الحية ودورات حياتها', 'ar');
    assert.equal(ranked.some(r => r.lesson.id === 'kbl-g3-science-s1-nccd-u1_l1'), false);
  });
});

// Found while measuring the rule: the query «حوار الفريق: توقع وظيفة أليكس
// المستقبلية» (a lesson's whole title) also contains the shorter title «حوار
// الفريق», and four lessons by that name took the bonus and pushed the named
// lesson from 1st to 5th; a vowelled Arabic debate lesson fell from 1st to 40th
// behind «الاستماع والتحدث». Only the most specific title the query contains
// may count, whether or not that title is itself eligible for the bonus.
describe('a longer title named whole is not shadowed by a shorter one inside it', () => {
  const rankOf = (id: string, q: string) => searchKBRanked(q, 'ar').findIndex(r => r.lesson.id === id) + 1;
  const strip = (t: string) => t.replace(/[\u064B-\u065F\u0670\u0640]/g, '');

  it('the lesson named by its whole title stays first', () => {
    for (const id of ['kbl-g7-eng-s1-nccd-u2_l2', 'kbl-g9-arabic-s2-nccd-u8_l2']) {
      const lesson = getLessonById(id)!;
      assert.equal(rankOf(id, strip(lesson.titleAr)), 1, id);
    }
  });

  it('the shorter title inside it takes no bonus while the longer one is named', () => {
    const ranked = searchKBRanked('حوار الفريق: توقع وظيفة أليكس المستقبلية', 'ar');
    assert.equal(ranked.some(r => r.titleCovered), false);
  });

  it('the shorter title still decides when only it is named', () => {
    const ranked = searchKBRanked('حوار الفريق', 'ar');
    assert.equal(ranked[0]!.score >= 10, true);
  });
});

