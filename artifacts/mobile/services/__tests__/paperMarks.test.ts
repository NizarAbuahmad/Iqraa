import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PAPER_TOTALS_CHUNK, PAPER_TOTAL_ERROR_KEY, buildTotalsRequest, chunkTotals, editRow, formatMark, gridSummary,
  initialGridRows, isPaperExam, isQuickPaperExam, mergeTotalsResponse, paperTotalsFailureKey, parsePaperMark,
  quickPaperQuestions, rowState,
} from '../paperMarks.ts';
import translations from '../i18n.ts';

const { ar, en } = translations;

const result = (earned: string, provisional = false) =>
  ({ attemptId: 'a', earnedMarks: earned, totalMarks: '20.00', percent: '0', competencyScores: {} as never, levelKey: null, isProvisional: provisional });

describe('parsePaperMark', () => {
  it('reads an empty box as "no mark"', () => {
    assert.deepEqual(parsePaperMark('', 20), { ok: true, value: null });
    assert.deepEqual(parsePaperMark('   ', 20), { ok: true, value: null });
  });
  it('reads Latin and Arabic-Indic digits, and three decimal separators', () => {
    for (const [text, value] of [['15', 15], ['١٥', 15], ['۱۵', 15], ['12.5', 12.5], ['12٫5', 12.5], ['12,5', 12.5], ['0', 0], ['20', 20]] as const) {
      assert.deepEqual(parsePaperMark(text, 20), { ok: true, value }, text);
    }
  });
  it('refuses more than two decimals, out-of-range marks and anything else', () => {
    assert.deepEqual(parsePaperMark('12.555', 20), { ok: false, error: 'precision' });
    assert.deepEqual(parsePaperMark('21', 20), { ok: false, error: 'range' });
    for (const bad of ['-1', 'abc', '1e1', '.', '1.2.3']) assert.deepEqual(parsePaperMark(bad, 20), { ok: false, error: 'invalid' }, bad);
  });
});

describe('the grid', () => {
  const roster = [{ id: 's1', displayName: 'آدم' }, { id: 's2', displayName: 'سارة' }, { id: 's3', displayName: 'زين' }];
  const attempts = [
    { studentId: 's1', submittedAt: '2026-10-12T10:00:00Z', result: result('15.00') },
    { studentId: 's2', submittedAt: null, result: result('12.50') },
    { studentId: 's3', submittedAt: null, result: result('0.00', true) },
  ];

  it('starts from what the server holds, in roster order', () => {
    const rows = initialGridRows(roster, attempts);
    assert.deepEqual(rows.map(r => [r.studentId, r.saved, r.pendingFinal, r.text]), [
      ['s1', 15, false, '15'],
      ['s2', 12.5, true, '12.5'],
      ['s3', null, false, ''],
    ]);
  });

  it('sends only what changed, plus marks typed but never handed in', () => {
    let rows = initialGridRows(roster, attempts);
    assert.deepEqual(buildTotalsRequest(rows, 20), { totals: [{ studentId: 's2', marks: 12.5 }], invalidIds: [] });
    rows = editRow(rows, 's1', '');
    rows = editRow(rows, 's3', '١٨');
    assert.deepEqual(buildTotalsRequest(rows, 20).totals, [
      { studentId: 's1', marks: null },
      { studentId: 's2', marks: 12.5 },
      { studentId: 's3', marks: 18 },
    ]);
    rows = editRow(rows, 's3', '99');
    assert.deepEqual(buildTotalsRequest(rows, 20).invalidIds, ['s3']);
    assert.deepEqual(rowState(rows[2]!, 20), { dirty: false, invalid: true, value: null });
  });

  it('takes the server answer row by row', () => {
    let rows = editRow(initialGridRows(roster, attempts), 's3', '18');
    rows = mergeTotalsResponse(rows, [
      { studentId: 's2', status: 'saved', marks: 12.5 },
      { studentId: 's3', status: 'error', code: 'not_in_class' },
    ]);
    assert.deepEqual([rows[1]!.saved, rows[1]!.pendingFinal, rows[1]!.status], [12.5, false, { kind: 'saved' }]);
    assert.deepEqual([rows[2]!.text, rows[2]!.status], ['18', { kind: 'error', code: 'not_in_class' }]);
    rows = mergeTotalsResponse(rows, [{ studentId: 's1', status: 'cleared', marks: null }]);
    assert.deepEqual([rows[0]!.saved, rows[0]!.text, rows[0]!.status], [null, '', { kind: 'cleared' }]);
    assert.deepEqual(gridSummary(rows, 20), { total: 3, entered: 1, dirty: 1, invalid: 0, errors: 1 });
  });

  it('formats a mark the way it is stored', () => {
    assert.equal(formatMark(15), '15');
    assert.equal(formatMark(12.5), '12.5');
    assert.equal(formatMark(16.25), '16.25');
  });

  it('names a message for every refusal the server can send', () => {
    for (const code of ['not_in_class', 'not_in_group', 'marks_out_of_range', 'kept_student_work', 'not_quick_paper', 'failed'] as const) {
      assert.ok(PAPER_TOTAL_ERROR_KEY[code], code);
    }
  });
});

describe('paper exams', () => {
  const PAPER = { gradingMode: 'manual' as const, body: {} };
  const TYPED = { gradingMode: 'manual' as const, body: { prompt: 'x' } };
  it('agrees with the server on what a paper exam is', () => {
    assert.equal(isPaperExam([PAPER, PAPER]), true);
    assert.equal(isPaperExam([PAPER, TYPED]), false);
    assert.equal(isPaperExam([]), false);
    assert.equal(isQuickPaperExam([PAPER]), true);
    assert.equal(isQuickPaperExam([PAPER, PAPER]), false);
  });

  it('builds the one question of a total-only paper', () => {
    const r = quickPaperQuestions('٢٠', ['obj-2', 'obj-1'], 'standard');
    assert.deepEqual(r, { ok: true, questions: [{ marks: 20, objectiveId: 'obj-2', competencyKey: 'understanding', difficulty: 'standard' }] });
    for (const bad of ['', '0', '101', 'x', '12.555']) assert.equal(quickPaperQuestions(bad, ['obj-1'], 'standard').ok, false, bad);
    assert.equal(quickPaperQuestions('20', [], 'standard').ok, false);
  });
});

describe('what the client will and will not send', () => {
  it('refuses a marks string longer than the server reads (16 characters) before sending it', () => {
    assert.deepEqual(parsePaperMark('0'.repeat(16), 20), { ok: true, value: 0 });
    assert.deepEqual(parsePaperMark('0000000000000015', 20), { ok: true, value: 15 });
    assert.deepEqual(parsePaperMark('0'.repeat(17), 20), { ok: false, error: 'length' });
    assert.deepEqual(parsePaperMark('٠'.repeat(17), 20), { ok: false, error: 'length' });
    assert.deepEqual(parsePaperMark('1'.repeat(5000), 20), { ok: false, error: 'length' });
  });

  it('puts only numbers and nulls on the wire, folded to Latin digits', () => {
    const roster = [{ id: 's1', displayName: 'أ' }, { id: 's2', displayName: 'ب' }, { id: 's3', displayName: 'ج' }];
    let rows = initialGridRows(roster, []);
    rows = editRow(rows, 's1', '١٢٫٥');
    rows = editRow(rows, 's2', '۱۸');
    rows = editRow(rows, 's3', '7,25');
    const { totals } = buildTotalsRequest(rows, 20);
    assert.deepEqual(totals, [
      { studentId: 's1', marks: 12.5 },
      { studentId: 's2', marks: 18 },
      { studentId: 's3', marks: 7.25 },
    ]);
    for (const t of totals) assert.equal(typeof t.marks, 'number');
  });

  it('treats a blank box as no change, unless the row had a saved mark', () => {
    const roster = [{ id: 's1', displayName: 'أ' }, { id: 's2', displayName: 'ب' }];
    const attempts = [{ studentId: 's2', submittedAt: '2026-10-12T10:00:00Z', result: result('9.00') }];
    let rows = initialGridRows(roster, attempts);
    rows = editRow(rows, 's1', '   ');
    assert.deepEqual(buildTotalsRequest(rows, 20), { totals: [], invalidIds: [] });
    rows = editRow(rows, 's2', '');
    assert.deepEqual(buildTotalsRequest(rows, 20).totals, [{ studentId: 's2', marks: null }]);
  });

  it('splits a long class into requests of at most 100 rows, in order', () => {
    assert.equal(PAPER_TOTALS_CHUNK, 100);
    const rows = Array.from({ length: 250 }, (_, i) => ({ studentId: `s${i}`, marks: i }));
    const chunks = chunkTotals(rows);
    assert.deepEqual(chunks.map(c => c.length), [100, 100, 50]);
    assert.deepEqual(chunks.flat(), rows);
    assert.deepEqual(chunkTotals([]), []);
    assert.deepEqual(chunkTotals(rows.slice(0, 100)).map(c => c.length), [100]);
  });
});

describe('what the teacher is told when the whole save is refused', () => {
  const refused = (status: number, code: string) => ({ status, code });
  it('names the specific reason for each 409 the route sends', () => {
    assert.equal(paperTotalsFailureKey(refused(409, 'not_published')), 'marksGridNeedsPublish');
    assert.equal(paperTotalsFailureKey(refused(409, 'no_class')), 'marksGridNeedsClass');
    assert.equal(paperTotalsFailureKey(refused(409, 'no_level_scale')), 'marksGridNoLevelScale');
    assert.equal(paperTotalsFailureKey(refused(409, 'not_quick_paper')), 'marksGridNotQuick');
  });
  it('falls back to the generic failure for anything else', () => {
    for (const e of [refused(400, 'too_many_rows'), refused(404, ''), refused(500, ''), refused(429, ''), new Error('offline'), null, undefined, 'x']) {
      assert.equal(paperTotalsFailureKey(e), 'marksGridSaveFailed');
    }
    // 409 is the status of the four; the same code on another status is not trusted.
    assert.equal(paperTotalsFailureKey(refused(400, 'no_class')), 'marksGridSaveFailed');
  });
  it('never tells a teacher to publish an exam that is closed (the server allows closed)', () => {
    assert.ok(!/(أغلق|مغلق|closed)/.test(String(ar.marksGridNeedsPublish) + String(en.marksGridNeedsPublish)));
    assert.equal(paperTotalsFailureKey(refused(409, 'no_class')), 'marksGridNeedsClass');
  });
});

describe('the copy', () => {
  it('has every mark-book key in both languages', () => {
    const keys = [...Object.values(PAPER_TOTAL_ERROR_KEY), 'marksGridNeedsPublish', 'marksGridNeedsClass', 'marksGridNoLevelScale', 'marksGridNotQuick', 'marksGridSaveFailed', 'marksGridUnsaved', 'marksGridEntered'] as const;
    for (const k of keys) {
      assert.ok((ar as Record<string, unknown>)[k], `ar.${k}`);
      assert.ok((en as Record<string, unknown>)[k], `en.${k}`);
    }
  });
  it('carries a noun with every count', () => {
    const unsaved = ar.marksGridUnsaved as (n: string) => string;
    assert.equal(unsaved('1'), 'علامة واحدة لم تُحفظ بعد');
    assert.equal(unsaved('2'), 'علامتان لم تُحفظا بعد');
    assert.equal(unsaved('5'), '5 علامات لم تُحفظ بعد');
    assert.equal(unsaved('12'), '12 علامة لم تُحفظ بعد');
    const unsavedEn = en.marksGridUnsaved as (n: string) => string;
    assert.equal(unsavedEn('1'), '1 mark not saved yet');
    assert.equal(unsavedEn('3'), '3 marks not saved yet');
    const entered = ar.marksGridEntered as (done: string, total: string) => string;
    assert.equal(entered('3', '25'), 'أُدخلت علامات 3 من 25 طالبًا');
    assert.equal(entered('1', '2'), 'أُدخلت علامات 1 من طالبين');
    assert.equal((en.marksGridEntered as (a: string, b: string) => string)('3', '25'), 'Marks entered for 3 of 25 students');
    assert.equal((en.marksGridEntered as (a: string, b: string) => string)('1', '1'), 'Marks entered for 1 of 1 student');
  });
});
