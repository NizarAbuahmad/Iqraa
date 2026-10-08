import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEAK_PERCENT, displayPercent, examStatusKey, focusObjectives, lessonAction, paperAction,
  recheckAction, sittingsLine, worksheetAction,
  type StudentRecordExam, type StudentRecordObjective,
} from '../studentRecord.ts';
import { formatListDate } from '../evaluationRow.ts';
import { lessonPickerParams, resolveLessonPrepContext } from '../lessonPrep.ts';

const CHEM = 'kbl-chem-s1-nccd-u1_l1';
const MATH = 'kbl-math-s1-nccd-u1_l1';

function obj(over: Partial<StudentRecordObjective>): StudentRecordObjective {
  return { objectiveId: 'o-nccd-chem-s1-u1_l1-0', titleAr: 'هدف', lessonId: CHEM, lessonTitleAr: 'درس',
    earned: 1, total: 4, percent: 25, marksLost: 3, sittings: 3, lastSeenAt: '2026-10-02T09:00:00.000Z', ...over };
}
function exam(over: Partial<StudentRecordExam>): StudentRecordExam {
  return { evaluationId: 'e1', title: 'اختبار', createdAt: '2026-10-01T00:00:00.000Z', status: 'marked',
    attemptId: 'a1', earned: 3, total: 4, percent: 75, provisional: false, teacherComment: null,
    submittedAt: '2026-10-01T09:00:00.000Z', ...over };
}

describe('student record — weak line', () => {
  it('mirrors the server gap line (STUDENT_GAP_PERCENT in classInsights.ts)', () => {
    assert.equal(WEAK_PERCENT, 60);
  });
  it('splits at 60 and shows the weakest one when nothing is weak', () => {
    const weak = obj({ percent: 59.99 });
    const ok = obj({ objectiveId: 'b', percent: 60 });
    assert.deepEqual(focusObjectives([weak, ok]), { weak: [weak], shown: [weak], allClear: false });
    assert.deepEqual(focusObjectives([ok]), { weak: [], shown: [ok], allClear: true });
    assert.deepEqual(focusObjectives([]), { weak: [], shown: [], allClear: true });
  });
});

describe('student record — displayed percentage', () => {
  it('never rounds a weak value up to the weak line', () => {
    assert.equal(displayPercent(59.6), 59);
    assert.equal(displayPercent(59.4), 59);
    assert.equal(displayPercent(60), 60);
    assert.equal(displayPercent(80.4), 80);
    assert.equal(displayPercent(0), 0);
  });
});

describe('student record — exams', () => {
  it('names each status', () => {
    assert.equal(examStatusKey('not_sat'), 'studentRecordNotSat');
    assert.equal(examStatusKey('in_progress'), 'studentRecordInProgress');
    assert.equal(examStatusKey('submitted'), 'studentRecordSubmitted');
    assert.equal(examStatusKey('marked'), 'studentRecordMarked');
  });
  it('never links an exam the student did not sit (the paper screen would create an attempt)', () => {
    assert.equal(paperAction(exam({ status: 'not_sat', attemptId: null }), 's1'), null);
    assert.deepEqual(paperAction(exam({}), 's1'), {
      pathname: '/evaluations/[id]/answers/[studentId]', params: { id: 'e1', studentId: 's1' },
    });
  });
  it('says how much evidence an objective rests on, dated as the exam lists are', () => {
    const iso = obj({}).lastSeenAt;
    // Intl output varies by Node ICU, so compare against the shared formatter.
    const ar = formatListDate(iso, 'ar')!;
    const en = formatListDate(iso, 'en')!;
    assert.ok(ar && en);
    assert.equal(sittingsLine(obj({ sittings: 1 }), 'ar'), `في ورقة · آخرها ${ar}`);
    assert.equal(sittingsLine(obj({ sittings: 3 }), 'ar'), `في 3 أوراق · آخرها ${ar}`);
    assert.equal(sittingsLine(obj({ sittings: 2 }), 'en'), `In 2 papers · latest ${en}`);
  });
});

describe('student record — actions', () => {
  it('opens the worksheet on the lesson’s own grade and subject, titled with the lesson', () => {
    const a = worksheetAction(obj({}))!;
    assert.equal(a.pathname, '/ai-tools/worksheet');
    assert.deepEqual({ gradeIdx: a.params.gradeIdx, subjectIdx: a.params.subjectIdx }, lessonPickerParams(CHEM, 'ar'));
    assert.equal(a.params.topic, resolveLessonPrepContext(CHEM, 'ar')!.topic);
    // The trap CLAUDE.md names: a chemistry objective must not land on maths.
    assert.notEqual(a.params.subjectIdx, lessonPickerParams(MATH, 'ar')!.subjectIdx);
  });
  it('hides worksheet and lesson when the lesson is unknown', () => {
    assert.equal(worksheetAction(obj({ lessonId: null })), null);
    assert.equal(worksheetAction(obj({ lessonId: 'kbl-nope' })), null);
    assert.equal(lessonAction(obj({ lessonId: null })), null);
  });
  it('opens the lesson and the quick re-check for this class', () => {
    assert.deepEqual(lessonAction(obj({})), { pathname: '/curriculum/lesson-detail', params: { lessonId: CHEM } });
    assert.deepEqual(recheckAction('c1', obj({})), {
      pathname: '/evaluations/mini', params: { classId: 'c1', objectiveId: 'o-nccd-chem-s1-u1_l1-0' },
    });
  });
});
