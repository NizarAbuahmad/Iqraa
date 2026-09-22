/**
 * The catalogs store lesson titles fully vowelled; teachers type them plain.
 * The scorer compares tokens without folding tashkeel, so the unvowelled form
 * of a title used to score 0 against its own lesson and be filtered out before
 * the diacritic-insensitive exact-title check ever ran.
 *
 * That mattered well beyond search: no lesson meant `groundedSubjectConflict`
 * had nothing to compare, so a science topic sailed past the subject guard and
 * generated a maths paper under a science title.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveGroundedKbLesson,
  getBookForLesson,
  searchKBRanked,
} from '../knowledgeBase.ts';
import { groundedSubjectConflict } from '../lessonPrep.ts';

// Grade 3 science, unit 1 lesson 1. Stored as «تَكاثُرُ الْكائِناتِ الْحَيَّةِ وَدَوْراتُ حَياتِها».
const LESSON_ID = 'kbl-g3-science-s1-nccd-u1_l1';
const VOWELLED = 'تَكاثُرُ الْكائِناتِ الْحَيَّةِ وَدَوْراتُ حَياتِها';
const PLAIN = 'تكاثر الكائنات الحية ودورات حياتها';

describe('grounding a title typed without tashkeel', () => {
  it('resolves the plain form to the same lesson as the vowelled one', () => {
    assert.equal(resolveGroundedKbLesson(VOWELLED, 'ar')?.id, LESSON_ID);
    assert.equal(resolveGroundedKbLesson(PLAIN, 'ar')?.id, LESSON_ID);
  });

  it('reaches the lesson even though the scorer never surfaces it', () => {
    // The point of the fix: the exact-title check must look past `ranked`.
    // If this ever starts finding it, the scorer changed and the fallback is
    // no longer what is carrying this case.
    const ranked = searchKBRanked(PLAIN, 'ar');
    assert.ok(
      !ranked.some(r => r.lesson.id === LESSON_ID),
      'scorer now surfaces the lesson — re-check whether the fallback is still needed',
    );
    assert.equal(resolveGroundedKbLesson(PLAIN, 'ar')?.id, LESSON_ID);
  });

  it('lets the subject guard see the conflict, in both spellings', () => {
    // This is the bug as a teacher met it: a science topic, Mathematics
    // picked, and nothing objecting.
    for (const topic of [VOWELLED, PLAIN]) {
      const conflict = groundedSubjectConflict(topic, 'ar', 'mathematics');
      assert.equal(conflict?.id, 'science', `no conflict raised for: ${topic}`);
    }
  });

  it('raises nothing when the picked subject is the right one', () => {
    for (const topic of [VOWELLED, PLAIN]) {
      assert.equal(groundedSubjectConflict(topic, 'ar', 'science'), null);
    }
  });

  it('keeps a same-named lesson in another subject out of it', () => {
    // «التفاعلات الكيميائية» is a grade 10 chemistry lesson AND, vowelled, a
    // grade 8 science one. Folding tashkeel inside the SCORER promoted the
    // science lesson over the chemistry one for a chemistry topic — which is
    // why the fix is a fallback that only adds resolutions, never re-ranks.
    const lesson = resolveGroundedKbLesson('التفاعلات الكيميائية', 'ar');
    assert.equal(lesson?.id, 'kbl-chem-s2-nccd-u4_l1');
    assert.equal(getBookForLesson(lesson!)?.subjectId, 'chemistry');
  });

  it('stays ungrounded rather than guessing when a title is ambiguous', () => {
    // Ungrounded is recoverable. Grounding to the wrong subject is the thing
    // this whole path exists to prevent.
    assert.equal(resolveGroundedKbLesson('موضوع لا وجود له في المنهاج', 'ar'), null);
  });
});
