/**
 * The rules that stop a class scan putting marks on the wrong child.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignStudent,
  canDiscard,
  canSave,
  discardRow,
  newRow,
  parseMark,
  reportRows,
  rowFromScan,
  rosterLabels,
  rowTotal,
  saveSummary,
  savableRows,
  setMark,
  type ReviewContext,
  type ReviewRow,
} from '../classScanReview.ts';
import type { ClassScanResponse } from '../evaluations.ts';

const QS = [
  { id: 'q1', number: 1, maxMarks: 5 },
  { id: 'q2', number: 2, maxMarks: 10 },
];
const ctx = (hasAttempt: string[] = []): ReviewContext => ({ questions: QS, hasAttempt: new Set(hasAttempt) });

const scan = (over: Partial<ClassScanResponse> = {}): ClassScanResponse => ({
  nameRead: 'سارة أحمد',
  match: { status: 'confident', studentId: 's1', candidates: [{ studentId: 's1', displayName: 'سارة أحمد', score: 1, hasAttempt: false }] },
  proposals: [
    { questionId: 'q1', number: 1, awardedMarks: 4, readAs: '4' },
    { questionId: 'q2', number: 2, awardedMarks: 7.5, readAs: '٧٫٥' },
  ],
  skipped: [],
  writtenTotal: 11.5,
  model: 'm',
  saved: false,
  ...over,
});

const read = (key: string, over: Partial<ReviewRow> = {}): ReviewRow => ({
  ...rowFromScan(newRow(key), scan()),
  ...over,
});

describe('parseMark', () => {
  it('reads Latin and Arabic-Indic digits and the decimal marks teachers type', () => {
    assert.deepEqual(parseMark('4', 5), { kind: 'ok', value: 4 });
    assert.deepEqual(parseMark('٤', 5), { kind: 'ok', value: 4 });
    assert.deepEqual(parseMark('٣٫٥', 5), { kind: 'ok', value: 3.5 });
    assert.deepEqual(parseMark('3,5', 5), { kind: 'ok', value: 3.5 });
    assert.deepEqual(parseMark(' 0 ', 5), { kind: 'ok', value: 0 });
  });

  it('blank is blank — never zero', () => {
    assert.deepEqual(parseMark('', 5), { kind: 'blank' });
    assert.deepEqual(parseMark('   ', 5), { kind: 'blank' });
  });

  it('rejects out-of-range and non-numbers instead of clamping', () => {
    for (const bad of ['6', '5.01', '-1', 'abc', '1.234', '1/2', '٦']) {
      assert.deepEqual(parseMark(bad, 5), { kind: 'invalid' }, bad);
    }
  });
});

describe('rowFromScan', () => {
  it('a confident match arrives assigned, with the marks in the boxes', () => {
    const r = read('a');
    assert.equal(r.state, 'read');
    assert.equal(r.studentId, 's1');
    assert.deepEqual(r.marks, { q1: '4', q2: '7.5' });
  });

  it('a confirm or none match arrives UNASSIGNED — nothing is chosen without a tap', () => {
    for (const status of ['confirm', 'none'] as const) {
      const r = rowFromScan(newRow('a'), scan({ match: { status, studentId: null, candidates: [] } }));
      assert.equal(r.studentId, null, status);
    }
  });

  it('a question the scan did not read has no entry — blank, not zero', () => {
    const r = rowFromScan(newRow('a'), scan({ proposals: [{ questionId: 'q1', number: 1, awardedMarks: 4, readAs: '4' }] }));
    assert.equal(r.marks['q2'], undefined);
  });
});

describe('reportRows — blockers', () => {
  it('blocks a row with no student', () => {
    const r = assignStudent(read('a'), null);
    assert.deepEqual(reportRows([r], ctx()).get('a')!.blockers, ['no_student']);
    assert.equal(canSave([r], ctx()), false);
  });

  it('blocks BOTH rows when two papers are assigned to one student', () => {
    const rows = [read('a'), read('b')];
    const report = reportRows(rows, ctx());
    assert.deepEqual(report.get('a')!.blockers, ['duplicate_student']);
    assert.deepEqual(report.get('b')!.blockers, ['duplicate_student']);
    assert.equal(canSave(rows, ctx()), false);
    // Reassigning one clears both.
    assert.equal(canSave([rows[0]!, assignStudent(rows[1]!, 's2')], ctx()), true);
  });

  it('blocks a box holding an invalid mark', () => {
    const r = setMark(read('a'), 'q1', '9');
    assert.deepEqual(reportRows([r], ctx()).get('a')!.blockers, ['mark_invalid']);
    assert.equal(canSave([r], ctx()), false);
  });

  it('only rows that can be saved are judged — a failed photo blocks nothing', () => {
    const failed: ReviewRow = { ...newRow('f'), state: 'failed' };
    assert.equal(reportRows([failed], ctx()).has('f'), false);
    assert.equal(canSave([failed, read('a')], ctx()), true);
  });
});

describe('reportRows — flags, which never block', () => {
  it('flags a student who already has a paper, skips them, and does not block', () => {
    const r = read('a');
    const report = reportRows([r], ctx(['s1'])).get('a')!;
    assert.deepEqual(report.flags, ['has_attempt']);
    assert.deepEqual(report.blockers, []);
    assert.deepEqual(savableRows([r], ctx(['s1'])), []);
    // Nothing to write, so there is nothing to save.
    assert.equal(canSave([r], ctx(['s1'])), false);
  });

  it('two papers for a student who already has one do not block each other', () => {
    assert.equal(reportRows([read('a'), read('b')], ctx(['s1'])).get('a')!.blockers.length, 0);
  });

  it('flags blank cells but still allows the save', () => {
    const r = setMark(read('a'), 'q2', '');
    const report = reportRows([r], ctx()).get('a')!;
    assert.ok(report.flags.includes('blank_cells'));
    assert.equal(canSave([r], ctx()), true);
  });

  it('flags a total that disagrees with the one written on the paper', () => {
    assert.deepEqual(reportRows([read('a')], ctx()).get('a')!.flags, []);
    const off = setMark(read('a'), 'q1', '5');
    assert.ok(reportRows([off], ctx()).get('a')!.flags.includes('total_mismatch'));
  });

  it('does not flag a mismatch when the paper wrote no total', () => {
    const r = read('a', { writtenTotal: null });
    assert.ok(!reportRows([r], ctx()).get('a')!.flags.includes('total_mismatch'));
  });
});

describe('setMark', () => {
  it('forgets that the question was already written, so a retry writes the corrected mark', () => {
    const r = setMark(read('a', { savedQuestionIds: ['q1', 'q2'] }), 'q1', '3');
    assert.deepEqual(r.savedQuestionIds, ['q2']);
    assert.equal(r.marks['q1'], '3');
  });

  it('a new row has written nothing yet', () => {
    assert.deepEqual(newRow('a').writtenQuestionIds, []);
  });

  it('keeps the record of what was written when a box is edited', () => {
    const r = setMark(read('a', { writtenQuestionIds: ['q1'] }), 'q1', '');
    assert.deepEqual(r.writtenQuestionIds, ['q1']);
  });
});

describe('an own paper is never mistaken for an existing one', () => {
  it('a row holding its own attemptId is not flagged, is not blocked, and is savable', () => {
    const own = read('a', { attemptId: 'att-own', state: 'save_failed' });
    const report = reportRows([own], ctx(['s1'])).get('a')!;
    assert.deepEqual(report.flags, []);
    assert.deepEqual(report.blockers, []);
    assert.deepEqual(savableRows([own], ctx(['s1'])), [own]);
  });

  it('a row without its own paper in the same situation is still skipped', () => {
    const r = read('a');
    assert.deepEqual(reportRows([r], ctx(['s1'])).get('a')!.flags, ['has_attempt']);
    assert.deepEqual(savableRows([r], ctx(['s1'])), []);
  });
});

describe('rowTotal and saveSummary', () => {
  it('totals only the valid boxes', () => {
    assert.equal(rowTotal(read('a'), QS), 11.5);
    assert.equal(rowTotal(setMark(read('a'), 'q2', 'x'), QS), 4);
  });

  it('summarises what was saved, skipped and needs attention', () => {
    const rows: ReviewRow[] = [
      { ...newRow('1'), state: 'saved' },
      { ...newRow('2'), state: 'saved' },
      { ...newRow('3'), state: 'skipped_existing' },
      { ...newRow('4'), state: 'save_failed' },
      { ...newRow('5'), state: 'failed' },
      { ...newRow('6'), state: 'not_run' },
    ];
    assert.deepEqual(saveSummary(rows), { saved: 2, needAttention: 3, skipped: 1 });
  });
});

describe('discardRow — a photo the teacher can set aside', () => {
  it('discards a read row that has no paper yet', () => {
    const r = read('a');
    assert.equal(canDiscard(r), true);
    assert.equal(discardRow(r).state, 'discarded');
  });

  it('discards failed, not-run and save-failed rows without a paper', () => {
    for (const state of ['failed', 'not_run', 'save_failed'] as const) {
      const r = read('a', { state });
      assert.equal(canDiscard(r), true, state);
      assert.equal(discardRow(r).state, 'discarded', state);
    }
  });

  it('never discards a row that has started a paper, or one still in flight or done', () => {
    const started = read('a', { attemptId: 'att-1', state: 'save_failed' });
    assert.equal(canDiscard(started), false);
    assert.equal(discardRow(started), started);
    for (const state of ['queued', 'reading', 'saved', 'skipped_existing', 'discarded'] as const) {
      const r = read('a', { state });
      assert.equal(canDiscard(r), false, state);
      assert.equal(discardRow(r), r, state);
    }
  });

  it('discarding one of two papers for one student clears the duplicate on the other', () => {
    const rows = [read('a'), read('b')];
    assert.equal(canSave(rows, ctx()), false);
    const after = [rows[0]!, discardRow(rows[1]!)];
    assert.deepEqual(reportRows(after, ctx()).get('a')!.blockers, []);
    assert.equal(reportRows(after, ctx()).has('b'), false);
    assert.equal(canSave(after, ctx()), true);
    assert.deepEqual(savableRows(after, ctx()).map(r => r.key), ['a']);
  });

  it('discarding a photo with no student (a blank page) unblocks the batch', () => {
    const junk = rowFromScan(newRow('j'), scan({ nameRead: null, match: { status: 'none', studentId: null, candidates: [] } }));
    const rows = [read('a'), junk];
    assert.equal(canSave(rows, ctx()), false);
    assert.equal(canSave([rows[0]!, discardRow(junk)], ctx()), true);
  });

  it('a discarded row is neither saved nor needing attention in the summary', () => {
    const rows: ReviewRow[] = [
      { ...newRow('1'), state: 'saved' },
      discardRow({ ...newRow('2'), state: 'failed' }),
      discardRow(read('3')),
    ];
    assert.deepEqual(saveSummary(rows), { saved: 1, needAttention: 0, skipped: 0 });
  });
});

describe('rosterLabels — two children with one name must look different', () => {
  const s = (id: string, displayName: string, externalRef: string | null = null) => ({ id, displayName, externalRef });

  it('leaves a unique name as it is', () => {
    const labels = rosterLabels([s('a', 'سارة أحمد'), s('b', 'ليلى حسن', 'R7')]);
    assert.equal(labels.get('a'), 'سارة أحمد');
    assert.equal(labels.get('b'), 'ليلى حسن');
  });

  it('numbers twins with no reference in roster order', () => {
    const labels = rosterLabels([s('a', 'محمد خالد'), s('x', 'ليلى'), s('b', 'محمد خالد')]);
    assert.equal(labels.get('a'), 'محمد خالد (1)');
    assert.equal(labels.get('b'), 'محمد خالد (2)');
    assert.equal(labels.get('x'), 'ليلى');
  });

  it('uses the school reference when every twin has a different one', () => {
    const labels = rosterLabels([s('a', 'محمد خالد', '1042'), s('b', 'محمد خالد', '1077')]);
    assert.equal(labels.get('a'), 'محمد خالد (1042)');
    assert.equal(labels.get('b'), 'محمد خالد (1077)');
  });

  it('falls back to numbers when only one twin has a reference, or the references collide', () => {
    const one = rosterLabels([s('a', 'محمد خالد', '1042'), s('b', 'محمد خالد')]);
    assert.equal(one.get('a'), 'محمد خالد (1)');
    assert.equal(one.get('b'), 'محمد خالد (2)');
    const blank = rosterLabels([s('a', 'محمد خالد', '1042'), s('b', 'محمد خالد', '  ')]);
    assert.equal(blank.get('b'), 'محمد خالد (2)');
    const same = rosterLabels([s('a', 'محمد خالد', '1042'), s('b', 'محمد خالد', '1042')]);
    assert.equal(same.get('a'), 'محمد خالد (1)');
    assert.equal(same.get('b'), 'محمد خالد (2)');
  });

  it('numbers a name that appears three times', () => {
    const labels = rosterLabels([s('a', 'علي'), s('b', 'علي'), s('c', 'علي')]);
    assert.deepEqual(['a', 'b', 'c'].map(id => labels.get(id)), ['علي (1)', 'علي (2)', 'علي (3)']);
  });

  it('compares names after trimming, as the teacher sees them', () => {
    const labels = rosterLabels([s('a', 'محمد خالد '), s('b', ' محمد خالد')]);
    assert.equal(labels.get('a'), 'محمد خالد (1)');
    assert.equal(labels.get('b'), 'محمد خالد (2)');
  });
});
