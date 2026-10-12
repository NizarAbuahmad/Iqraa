import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PAPER_TOTALS_CHUNK, PAPER_TOTAL_ERROR_KEY, buildTotalsRequest, chunkTotals, editRow, formatMark, gridSummary,
  initialGridRows, isPaperExam, isQuickPaperExam, mergeTotalsResponse, paperTotalErrorText, paperTotalsFailureKey,
  parsePaperMark, quickPaperQuestions, rowState,
  MARKS_BLOCKER_KEY, countRefused, marksBlocker, refreshStoredMarks, rowProblemCode, saveOutcomeUncertain, savedMarksToClear,
} from '../paperMarks.ts';
import translations, { getT } from '../i18n.ts';

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

  it('splits a long class into requests of at most 50 rows, in order', () => {
    assert.equal(PAPER_TOTALS_CHUNK, 50);
    const rows = Array.from({ length: 250 }, (_, i) => ({ studentId: `s${i}`, marks: i }));
    const chunks = chunkTotals(rows);
    assert.deepEqual(chunks.map(c => c.length), [50, 50, 50, 50, 50]);
    assert.deepEqual(chunks.flat(), rows);
    assert.deepEqual(chunkTotals(rows.slice(0, 120)).map(c => c.length), [50, 50, 20]);
    assert.deepEqual(chunkTotals([]), []);
    assert.deepEqual(chunkTotals(rows.slice(0, 50)).map(c => c.length), [50]);
    assert.deepEqual(chunkTotals(rows.slice(0, 5), 2).map(c => c.length), [2, 2, 1]);
  });

  it('never loops forever on a size that makes no progress', () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => chunkTotals([1, 2, 3], bad), RangeError, String(bad));
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

describe('the grammar of a typed mark (the server reads these too)', () => {
  it('accepts a trailing point or a leading one, with either separator', () => {
    for (const [text, value] of [['12.', 12], ['.5', 0.5], ['٫5', 0.5], [',5', 0.5], ['١٢٫', 12], ['12,', 12]] as const) {
      assert.deepEqual(parsePaperMark(text, 20), { ok: true, value }, text);
    }
    for (const bad of ['.', '٫', '..5', '5..', '+5', '1 2']) assert.equal(parsePaperMark(bad, 20).ok, false, bad);
  });

  it('allows two SIGNIFICANT decimals: trailing zeros do not count', () => {
    assert.deepEqual(parsePaperMark('12.500', 20), { ok: true, value: 12.5 });
    assert.deepEqual(parsePaperMark('12.50', 20), { ok: true, value: 12.5 });
    assert.deepEqual(parsePaperMark('12.25', 20), { ok: true, value: 12.25 });
    assert.deepEqual(parsePaperMark('12.505', 20), { ok: false, error: 'precision' });
    assert.deepEqual(parsePaperMark('12.001', 20), { ok: false, error: 'precision' });
  });

  it('ignores direction marks a right-to-left keyboard leaves in the box', () => {
    for (const mark of ['\u200E', '\u200F', '\u061C', '\u2066', '\u2067', '\u2068', '\u2069']) {
      assert.deepEqual(parsePaperMark(`${mark}15${mark}`, 20), { ok: true, value: 15 }, mark.charCodeAt(0).toString(16));
      assert.deepEqual(parsePaperMark(`\u2067١٢٫٥\u2069 ${mark}`, 20), { ok: true, value: 12.5 });
    }
    assert.deepEqual(parsePaperMark('\u200F\u200E', 20), { ok: true, value: null });
    // They do not count towards the 16-character cap, and they never reach the wire (a number is sent).
    assert.deepEqual(parsePaperMark(`\u200F${'0'.repeat(14)}15`, 20), { ok: true, value: 15 });
  });
});

describe('merging the server answer into rows edited while it was in flight', () => {
  const roster = [{ id: 's1', displayName: 'أ' }, { id: 's2', displayName: 'ب' }];
  const sentOf = (rows: ReturnType<typeof initialGridRows>) =>
    new Map(buildTotalsRequest(rows, 20).totals.map(t => [t.studentId, t.marks] as const));

  it('keeps what the teacher typed after the send, and reports the row dirty against the new saved', () => {
    let rows = editRow(initialGridRows(roster, []), 's1', '15');
    const sent = sentOf(rows);
    rows = editRow(rows, 's1', '16'); // corrected while «حفظ الكل» was running
    rows = mergeTotalsResponse(rows, [{ studentId: 's1', status: 'saved', marks: 15 }], sent);
    assert.deepEqual([rows[0]!.saved, rows[0]!.pendingFinal, rows[0]!.text, rows[0]!.status], [15, false, '16', { kind: 'idle' }]);
    assert.deepEqual(rowState(rows[0]!, 20), { dirty: true, invalid: false, value: 16 });
    assert.deepEqual(buildTotalsRequest(rows, 20).totals, [{ studentId: 's1', marks: 16 }]);
  });

  it('does the same for a cleared answer', () => {
    const attempts = [{ studentId: 's1', submittedAt: '2026-10-12T10:00:00Z', result: result('9.00') }];
    let rows = editRow(initialGridRows(roster, attempts), 's1', '');
    const sent = sentOf(rows);
    assert.deepEqual([...sent], [['s1', null]]);
    rows = editRow(rows, 's1', '11');
    rows = mergeTotalsResponse(rows, [{ studentId: 's1', status: 'cleared', marks: null }], sent);
    assert.deepEqual([rows[0]!.saved, rows[0]!.text, rows[0]!.status], [null, '11', { kind: 'idle' }]);
    assert.equal(rowState(rows[0]!, 20).dirty, true);
  });

  it('does not stamp a refusal of the old text on the new text, but still tells the truth about what is stored', () => {
    const attempts = [{ studentId: 's1', submittedAt: null, result: result('8.00') }];
    let rows = editRow(initialGridRows(roster, attempts), 's1', '14');
    const sent = sentOf(rows);
    rows = editRow(rows, 's1', '13');
    rows = mergeTotalsResponse(rows, [{ studentId: 's1', status: 'error', code: 'kept_student_work' }], sent);
    assert.deepEqual([rows[0]!.saved, rows[0]!.pendingFinal, rows[0]!.text, rows[0]!.status], [8, true, '13', { kind: 'idle' }]);
  });

  it('applies the answer as usual when the box still says what was sent', () => {
    let rows = editRow(initialGridRows(roster, []), 's1', '١٥٫٠');
    rows = editRow(rows, 's2', '7');
    const sent = sentOf(rows);
    rows = editRow(rows, 's2', '7.0'); // a different spelling of the same mark is not an edit
    rows = mergeTotalsResponse(rows, [
      { studentId: 's1', status: 'saved', marks: 15 },
      { studentId: 's2', status: 'error', code: 'not_in_class' },
    ], sent);
    assert.deepEqual([rows[0]!.text, rows[0]!.status], ['15', { kind: 'saved' }]);
    assert.deepEqual([rows[1]!.text, rows[1]!.status], ['7.0', { kind: 'error', code: 'not_in_class' }]);
  });

  it('treats a row that was not in the request as edited, and an emptied box as a sent null', () => {
    let rows = editRow(initialGridRows(roster, []), 's1', '4');
    rows = mergeTotalsResponse(rows, [{ studentId: 's1', status: 'saved', marks: 4 }], new Map());
    assert.deepEqual([rows[0]!.text, rows[0]!.status], ['4', { kind: 'idle' }]);
    const blank = mergeTotalsResponse(initialGridRows(roster, []), [{ studentId: 's2', status: 'cleared', marks: null }], new Map([['s2', null]]));
    assert.deepEqual(blank[1]!.status, { kind: 'cleared' });
  });

  it('is two chunks, merged one after the other into the latest rows', () => {
    let rows = initialGridRows(roster, []);
    rows = editRow(editRow(rows, 's1', '1'), 's2', '2');
    const sent1 = new Map([['s1', 1]]);
    const sent2 = new Map([['s2', 2]]);
    rows = mergeTotalsResponse(rows, [{ studentId: 's1', status: 'saved', marks: 1 }], sent1);
    rows = mergeTotalsResponse(rows, [{ studentId: 's2', status: 'saved', marks: 2 }], sent2);
    assert.deepEqual(rows.map(r => r.status.kind), ['saved', 'saved']);
  });
});

describe('gaps in the brief', () => {
  const roster = [{ id: 's1', displayName: 'أ' }, { id: 's2', displayName: 'ب' }, { id: 's3', displayName: 'ج' }];

  it('merges the unchanged status as a saved row, and ignores a student the grid does not hold', () => {
    const before = editRow(initialGridRows(roster, []), 's1', '12');
    const rows = mergeTotalsResponse(before, [
      { studentId: 's1', status: 'unchanged', marks: 12 },
      { studentId: 'someone-else', status: 'saved', marks: 5 },
    ]);
    assert.deepEqual([rows[0]!.saved, rows[0]!.status], [12, { kind: 'saved' }]);
    assert.deepEqual(rows.slice(1), before.slice(1));
    assert.equal(rows.length, 3);
  });

  it('summarises invalid rows and rows saved but never handed in', () => {
    const attempts = [
      { studentId: 's1', submittedAt: '2026-10-12T10:00:00Z', result: result('10.00') },
      { studentId: 's2', submittedAt: null, result: result('5.00') },
    ];
    let rows = initialGridRows(roster, attempts);
    // entered counts only what families can see; the pending one is dirty (it still has to be handed in).
    assert.deepEqual(gridSummary(rows, 20), { total: 3, entered: 1, dirty: 1, invalid: 0, errors: 0 });
    rows = editRow(rows, 's3', '25');
    assert.deepEqual(gridSummary(rows, 20), { total: 3, entered: 1, dirty: 1, invalid: 1, errors: 0 });
    rows = editRow(rows, 's3', 'abc');
    assert.deepEqual(gridSummary(rows, 20), { total: 3, entered: 1, dirty: 1, invalid: 1, errors: 0 });
  });

  it('pins the total of a total-only paper to 1..100', () => {
    const ok = (text: string) => quickPaperQuestions(text, ['o'], 'standard');
    assert.deepEqual(ok('100'), { ok: true, questions: [{ marks: 100, objectiveId: 'o', competencyKey: 'understanding', difficulty: 'standard' }] });
    assert.deepEqual(ok('1'), { ok: true, questions: [{ marks: 1, objectiveId: 'o', competencyKey: 'understanding', difficulty: 'standard' }] });
    for (const bad of ['101', '100.5', '0', '0.0', '-5', '', '١٠١']) assert.equal(ok(bad).ok, false, bad);
    // The server takes a decimal total (marks > 0 and <= 100), so the app does too; the brief does not ask for an integer.
    assert.equal(ok('12.5').ok, true);
  });
});

describe('the words for a per-student refusal, through the real translations', () => {
  const codes = Object.keys(PAPER_TOTAL_ERROR_KEY) as (keyof typeof PAPER_TOTAL_ERROR_KEY)[];
  for (const lang of ['ar', 'en'] as const) {
    it(`gives every code a real sentence in ${lang}, including the one that needs the total`, () => {
      const t = getT(lang);
      for (const code of codes) {
        const text = paperTotalErrorText(t, code, 20);
        assert.equal(typeof text, 'string', code);
        assert.ok(text.trim().length > 0, code);
        assert.ok(!/undefined|NaN|\[object/.test(text), `${lang}.${code}: ${text}`);
        assert.notEqual(text, PAPER_TOTAL_ERROR_KEY[code], `${lang}.${code} fell back to its key`);
      }
      assert.ok(paperTotalErrorText(t, 'marks_out_of_range', 20).includes('20'));
    });
  }
  it('has real words for every whole-save refusal as well', () => {
    for (const lang of ['ar', 'en'] as const) {
      const t = getT(lang);
      for (const err of [{ status: 409, code: 'not_published' }, { status: 409, code: 'no_class' }, { status: 409, code: 'no_level_scale' }, { status: 409, code: 'not_quick_paper' }, new Error('x')]) {
        const key = paperTotalsFailureKey(err);
        const text = t(key);
        assert.ok(text.trim().length > 0 && text !== key && !/undefined/.test(text), `${lang}.${key}`);
      }
    }
  });
});


describe('what the mark book screen decides (Task 9)', () => {
  const roster = [{ id: 's1', displayName: 'أ' }, { id: 's2', displayName: 'ب' }, { id: 's3', displayName: 'ج' }];
  const paperQ = { gradingMode: 'manual', body: {} } as never;
  const typedQ = { gradingMode: 'auto', body: { stem: 'x' } } as never;

  describe('marksBlocker', () => {
    it('orders the blockers: not a quick paper, then a draft, then no class', () => {
      assert.equal(marksBlocker([typedQ], 'draft', null), 'not_quick');
      assert.equal(marksBlocker([paperQ, paperQ], 'published', 'c1'), 'not_quick');
      assert.equal(marksBlocker([], 'published', 'c1'), 'not_quick');
      assert.equal(marksBlocker([paperQ], 'draft', null), 'needs_publish');
      assert.equal(marksBlocker([paperQ], 'published', null), 'needs_class');
      assert.equal(marksBlocker([paperQ], 'published', 'c1'), null);
    });
    it('lets a CLOSED quick paper exam through (the route takes published or closed)', () => {
      assert.equal(marksBlocker([paperQ], 'closed', 'c1'), null);
      assert.equal(marksBlocker([paperQ], 'closed', null), 'needs_class');
    });
    it('has copy for every blocker, in both languages', () => {
      for (const key of Object.values(MARKS_BLOCKER_KEY)) {
        assert.ok(typeof ar[key] === 'string' && typeof en[key] === 'string', key);
      }
      // «انشر الامتحان أولاً» is for a draft only.
      assert.equal(MARKS_BLOCKER_KEY.needs_publish, 'marksGridNeedsPublish');
    });
  });

  describe('rowProblemCode', () => {
    it('words every way a box can fail to parse, the 16-character cap included', () => {
      let rows = initialGridRows(roster, []);
      for (const bad of ['abc', '21', '1.234', '1'.repeat(17), '-1']) {
        rows = editRow(rows, 's1', bad);
        assert.equal(rowProblemCode(rows[0]!, 20), 'marks_out_of_range', bad);
      }
      for (const lang of ['ar', 'en'] as const) {
        assert.ok(paperTotalErrorText(getT(lang), 'marks_out_of_range', 20).includes('20'));
      }
    });
    it('is quiet for a good or blank box, and reports a refusal the server sent', () => {
      let rows = initialGridRows(roster, []);
      assert.equal(rowProblemCode(rows[0]!, 20), null);
      rows = editRow(rows, 's1', '12.5');
      assert.equal(rowProblemCode(rows[0]!, 20), null);
      rows = mergeTotalsResponse(rows, [{ studentId: 's1', status: 'error', code: 'kept_student_work' }]);
      assert.equal(rowProblemCode(rows[0]!, 20), 'kept_student_work');
      // Typing again clears the refusal (editRow resets the status).
      assert.equal(rowProblemCode(editRow(rows, 's1', '13')[0]!, 20), null);
    });
  });

  describe('savedMarksToClear', () => {
    const attempts = [
      { studentId: 's1', submittedAt: '2026-10-12T10:00:00Z', result: result('10.00') },
      { studentId: 's2', submittedAt: null, result: result('5.00') },
    ];
    it('counts only blank boxes over a SAVED mark, never a blank row that had none', () => {
      let rows = initialGridRows(roster, attempts);
      assert.equal(savedMarksToClear(rows, 20), 0);
      rows = editRow(rows, 's1', '');
      assert.equal(savedMarksToClear(rows, 20), 1);
      rows = editRow(rows, 's2', '  ');
      assert.equal(savedMarksToClear(rows, 20), 2, 'a mark saved but never handed in is still a saved mark');
      // s3 never had a mark: blank, clean, not counted.
      assert.equal(rows[2]!.text, '');
      assert.equal(savedMarksToClear(rows, 20), 2);
    });
    it('does not count a changed mark, an unchanged one, or an invalid box', () => {
      let rows = initialGridRows(roster, attempts);
      rows = editRow(rows, 's1', '11');
      rows = editRow(rows, 's2', 'abc');
      assert.equal(savedMarksToClear(rows, 20), 0);
    });
  });

  describe('refreshStoredMarks (after a timeout)', () => {
    it('adopts what the server holds and keeps what was typed', () => {
      let rows = initialGridRows(roster, []);
      rows = editRow(rows, 's1', '12');
      rows = editRow(rows, 's2', '7');
      rows = editRow(rows, 's3', 'oops');
      // The server finished s1 (handed in), never saw s2.
      const after = refreshStoredMarks(rows, [{ studentId: 's1', submittedAt: '2026-10-12T10:00:00Z', result: result('12.00') }]);
      assert.deepEqual(after.map(r => r.text), ['12', '7', 'oops']);
      assert.deepEqual(after.map(r => r.saved), [12, null, null]);
      assert.equal(rowState(after[0]!, 20).dirty, false, 'the save that did land is clean');
      assert.equal(rowState(after[1]!, 20).dirty, true, 'the one that did not is still to save');
      assert.ok(after.every(r => r.status.kind === 'idle'));
    });
    it('sees a clear that landed, and a mark that is saved but not handed in', () => {
      let rows = initialGridRows(roster, [{ studentId: 's1', submittedAt: '2026-10-12T10:00:00Z', result: result('10.00') }]);
      rows = editRow(rows, 's1', '');
      const cleared = refreshStoredMarks(rows, []);
      assert.equal(cleared[0]!.saved, null);
      assert.equal(rowState(cleared[0]!, 20).dirty, false);
      const pending = refreshStoredMarks(rows, [{ studentId: 's1', submittedAt: null, result: result('10.00') }]);
      assert.equal(pending[0]!.pendingFinal, true);
    });
    it('treats a provisional result as no mark, like the first load', () => {
      const rows = initialGridRows(roster, []);
      const after = refreshStoredMarks(rows, [{ studentId: 's1', submittedAt: null, result: result('3.00', true) }]);
      assert.equal(after[0]!.saved, null);
    });
  });

  describe('saveOutcomeUncertain / countRefused', () => {
    it('a 4xx is a clean refusal; a timeout, a dropped connection and a 5xx are not', () => {
      assert.equal(saveOutcomeUncertain({ status: 409, code: 'no_class' }), false);
      assert.equal(saveOutcomeUncertain({ status: 400 }), false);
      assert.equal(saveOutcomeUncertain({ status: 429 }), false);
      assert.equal(saveOutcomeUncertain(Object.assign(new Error('x'), { name: 'AbortError' })), true);
      assert.equal(saveOutcomeUncertain(new TypeError('Network request failed')), true);
      assert.equal(saveOutcomeUncertain({ status: 502 }), true);
      assert.equal(saveOutcomeUncertain(null), true);
    });
    it('counts the per-student refusals in a chunk', () => {
      assert.equal(countRefused([
        { studentId: 'a', status: 'saved', marks: 1 },
        { studentId: 'b', status: 'error', code: 'failed' },
        { studentId: 'c', status: 'cleared', marks: null },
        { studentId: 'd', status: 'error', code: 'not_in_class' },
      ]), 2);
    });
  });

  describe('the new copy, through the real translations', () => {
    it('words the partial save, the re-read and the clear confirmation in both languages', () => {
      for (const lang of ['ar', 'en'] as const) {
        const t = getT(lang);
        const texts = [
          t('marksGridSavedWithErrors', '1'), t('marksGridSavedWithErrors', '2'), t('marksGridSavedWithErrors', '5'),
          t('marksGridCheckedAfterFailure'), t('marksGridClearTitle'), t('marksGridClearAction'),
          t('marksGridClearConfirm', '1', '0'), t('marksGridClearConfirm', '2', '1'), t('marksGridClearConfirm', '11', '1'),
        ];
        for (const text of texts) assert.ok(text.trim().length > 0 && !/undefined|NaN|\[object|marksGrid/.test(text), `${lang}: ${text}`);
        // The count carries its noun, and a released exam says families lose sight of it.
        assert.ok(t('marksGridClearConfirm', '2', '0').length < t('marksGridClearConfirm', '2', '1').length);
      }
      assert.match(ar.marksGridClearConfirm('2', '0'), /علامتان محفوظتان/);
      assert.match(ar.marksGridClearConfirm('1', '0'), /علامة واحدة محفوظة/);
      assert.match(ar.marksGridSavedWithErrors('2'), /علامتين/);
    });
  });
});
