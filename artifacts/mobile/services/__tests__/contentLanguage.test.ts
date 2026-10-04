import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { contentLang, topicInLang } from '../contentLanguage.ts';
import { getBookForLesson, getLessonById } from '../knowledgeBase.ts';

describe('contentLang', () => {
  it('writes English material in English inside an Arabic UI', () => {
    assert.equal(contentLang('english', 'ar'), 'en');
  });

  it('leaves every other subject on the UI language', () => {
    assert.equal(contentLang('mathematics', 'ar'), 'ar');
    assert.equal(contentLang('arabic', 'en'), 'en');
    assert.equal(contentLang(undefined, 'ar'), 'ar');
  });
});

describe('topicInLang', () => {
  // A real Grade 10 English lesson: its Arabic title is a gloss.
  const lesson = getLessonById('kbl-eng-agri-s1-nccd-u1_l1')!;
  const book = getBookForLesson(lesson)!;
  const scope = { gradeId: book.gradeId, subjectId: book.subjectId };

  it("restates an English lesson's Arabic gloss as its English title", () => {
    assert.equal(topicInLang(lesson.titleAr, 'ar', 'en', scope), lesson.titleEn);
  });

  it('leaves a topic alone when nothing changes or it names no lesson', () => {
    assert.equal(topicInLang(lesson.titleAr, 'ar', 'ar', scope), lesson.titleAr);
    assert.equal(topicInLang('موضوع حرّ لا يطابق درسًا', 'ar', 'en', scope), 'موضوع حرّ لا يطابق درسًا');
  });
});
