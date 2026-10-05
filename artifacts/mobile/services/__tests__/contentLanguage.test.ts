import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { contentLang, isPreEnglishMaterial, materialSubjectId, topicInLang } from '../contentLanguage.ts';
import { getPickerSubjects } from '../curriculumData.ts';
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

describe('isPreEnglishMaterial', () => {
  const englishIdx = String(getPickerSubjects().findIndex(s => s.id === 'english'));
  const mathsIdx = String(getPickerSubjects().findIndex(s => s.id === 'mathematics'));
  const plan = { type: 'lesson', language: 'ar', subject: 'English', formState: { subjectIdx: englishIdx } };

  it('flags an English plan saved in Arabic', () => {
    assert.equal(isPreEnglishMaterial(plan), true);
  });

  it('reads the subject from its stored name when the form has no picker position', () => {
    assert.equal(isPreEnglishMaterial({ ...plan, subject: 'اللغة الإنجليزية', formState: {} }), true);
  });

  it('leaves English material already in English, other subjects, and kinds it cannot redo', () => {
    assert.equal(isPreEnglishMaterial({ ...plan, language: 'en' }), false);
    assert.equal(isPreEnglishMaterial({ ...plan, subject: 'Mathematics', formState: { subjectIdx: mathsIdx } }), false);
    assert.equal(isPreEnglishMaterial({ ...plan, type: 'flow' }), false);
    assert.equal(isPreEnglishMaterial({ ...plan, type: 'prompt-slides' }), false);
  });

  it('does not read an empty picker position as the first subject', () => {
    assert.equal(materialSubjectId({ subject: '', formState: { subjectIdx: '' } }), undefined);
  });
});
