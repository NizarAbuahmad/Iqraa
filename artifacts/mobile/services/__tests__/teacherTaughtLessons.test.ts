/**
 * Forty-third live pass: «اعطني اختبارا قصيرا عن التفاعلات الكيميائية» asked a grade 10
 * teacher «كيمياء أم علوم؟». Grade 8 Science has a lesson of the same title; she does
 * not teach it, so the question was about a choice she did not have.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getBookForLesson, searchKBRanked } from '../knowledgeBase.ts';
import { detectSubjectAmbiguity, lessonsTheTeacherTeaches } from '../kbContext.ts';

const ASK = 'اعطني اختبارا قصيرا عن التفاعلات الكيميائية';
const results = searchKBRanked(ASK, 'ar').slice(0, 3).map(r => r.lesson);
const subjects = (ls: typeof results) => ls.map(l => getBookForLesson(l)?.subjectId);

describe('only subjects the teacher teaches are worth asking about', () => {
  it('the ask spans Chemistry and Science for a teacher who has no narrower scope', () => {
    assert.deepEqual(new Set(detectSubjectAmbiguity(results)), new Set(['chemistry', 'science']));
  });

  it('a grade 10 teacher is not asked: only the Chemistry lessons remain', () => {
    const taught = lessonsTheTeacherTeaches(results, (_s, g) => g === 'grade-10');
    assert.equal(detectSubjectAmbiguity(taught), null);
    assert.ok(taught.length > 0 && subjects(taught).every(s => s === 'chemistry'));
  });

  it('a teacher of both grades is still asked', () => {
    const taught = lessonsTheTeacherTeaches(results, () => true);
    assert.notEqual(detectSubjectAmbiguity(taught), null);
  });

  it('a teacher who teaches none of them keeps the list as it was', () => {
    const taught = lessonsTheTeacherTeaches(results, () => false);
    assert.deepEqual(taught.map(l => l.id), results.map(l => l.id));
  });

  it('the subject is checked together with the grade', () => {
    const taught = lessonsTheTeacherTeaches(results, (s, g) => s === 'science' && g === 'grade-8');
    assert.ok(taught.length > 0 && subjects(taught).every(s => s === 'science'));
  });
});
