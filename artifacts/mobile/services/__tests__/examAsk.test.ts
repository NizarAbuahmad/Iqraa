/**
 * Chat sent the same three question types and eight questions for every quiz,
 * so «اختبار صح وخطأ» came back as a mixed paper. These pin what a teacher's
 * wording is read as — and, as importantly, what it is NOT read as: lesson
 * names that contain the same letters.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { questionCountFromAsk, quizTypesFromAsk } from '../ai/examAsk.ts';

describe('quizTypesFromAsk', () => {
  it('reads each type the message names', () => {
    assert.deepEqual(quizTypesFromAsk('جهّز لي اختبار صح وخطأ عن الروابط'), ['true_false']);
    assert.deepEqual(quizTypesFromAsk('اختبار اختيار من متعدد'), ['multiple_choice']);
    assert.deepEqual(quizTypesFromAsk('أسئلة أكمل الفراغ فقط'), ['fill_blank']);
    assert.deepEqual(quizTypesFromAsk('اختبار بأسئلة مقالية'), ['short_answer']);
    assert.deepEqual(quizTypesFromAsk('quiz with true or false questions'), ['true_false']);
    assert.deepEqual(quizTypesFromAsk('a multiple choice quiz'), ['multiple_choice']);
  });

  it('reads several types in one message', () => {
    assert.deepEqual(
      quizTypesFromAsk('اختبار فيه اختيار من متعدد وصح وخطأ وأكمل الفراغ'),
      ['multiple_choice', 'true_false', 'fill_blank'],
    );
  });

  it('names nothing for a message that names no type — the defaults stay', () => {
    assert.equal(quizTypesFromAsk('اعمل لي اختبار عن الاشتقاق'), null);
  });

  it('is not fooled by a lesson that shares the letters', () => {
    assert.equal(quizTypesFromAsk('اختبار عن متعددات الحدود'), null);
    assert.equal(quizTypesFromAsk('اختبار في الهندسة الفراغية'), null);
    assert.equal(quizTypesFromAsk('أكمل شرح الدرس'), null);
  });
});

describe('questionCountFromAsk', () => {
  it('reads Latin and Arabic-Indic digits', () => {
    assert.equal(questionCountFromAsk('اختبار من 12 سؤال'), 12);
    assert.equal(questionCountFromAsk('اختبار من ١٠ أسئلة'), 10);
    assert.equal(questionCountFromAsk('a quiz of 15 questions'), 15);
  });

  it('ignores a number that is not a plausible question count', () => {
    assert.equal(questionCountFromAsk('اختبار من 2 أسئلة'), null);
    assert.equal(questionCountFromAsk('اختبار من 50 سؤال'), null);
    assert.equal(questionCountFromAsk('اختبار للصف 10'), null);
  });
});
