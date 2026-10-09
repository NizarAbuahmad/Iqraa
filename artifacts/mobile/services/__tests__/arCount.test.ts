import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { arCountPhrase, arMarksPhrase, arQuestionsPhrase, enMarksPhrase } from '../arCount.ts';

describe('arCountPhrase', () => {
  it('covers all four Arabic number classes', () => {
    assert.equal(arCountPhrase(1, 'نقطة', 'نقطتان', 'نقاط'), 'نقطة');
    assert.equal(arCountPhrase(2, 'نقطة', 'نقطتان', 'نقاط'), 'نقطتان');
    assert.equal(arCountPhrase(5, 'نقطة', 'نقطتان', 'نقاط'), '5 نقاط');
    assert.equal(arCountPhrase(10, 'نقطة', 'نقطتان', 'نقاط'), '10 نقاط');
    assert.equal(arCountPhrase(12, 'نقطة', 'نقطتان', 'نقاط'), '12 نقطة');
  });
});

describe('marks and question counts on the student exam', () => {
  it('declines «علامة» and drops the database decimals', () => {
    assert.equal(arMarksPhrase('1.00'), 'علامة واحدة');
    assert.equal(arMarksPhrase('2.00'), 'علامتان');
    assert.equal(arMarksPhrase('5'), '5 علامات');
    assert.equal(arMarksPhrase(10), '10 علامات');
    assert.equal(arMarksPhrase('20.00'), '20 علامة');
    assert.equal(arMarksPhrase('2.50'), '2.5 علامة');
  });

  it('takes the accusative dual after a verb («خسر علامتين»)', () => {
    assert.equal(arMarksPhrase(2, true), 'علامتين');
    assert.equal(arMarksPhrase(3, true), '3 علامات');
  });

  it('declines «سؤال»', () => {
    assert.equal(arQuestionsPhrase(1), 'سؤال واحد');
    assert.equal(arQuestionsPhrase(2), 'سؤالان');
    assert.equal(arQuestionsPhrase(7), '7 أسئلة');
    assert.equal(arQuestionsPhrase(15), '15 سؤالًا');
  });

  it('says «mark» for one in English', () => {
    assert.equal(enMarksPhrase('1.00'), '1 mark');
    assert.equal(enMarksPhrase('2.50'), '2.5 marks');
  });

  it('passes through a value it cannot read rather than inventing a count', () => {
    assert.equal(arMarksPhrase(''), '');
    assert.equal(enMarksPhrase(''), '');
  });
});
