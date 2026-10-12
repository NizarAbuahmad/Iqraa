import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  ammanToday,
  applyDone,
  dueBadge,
  dueDatePresets,
  formatDueDate,
  homeworkDraftError,
  isValidYmd,
  normalizeChildHomework,
  normalizeFamilyHomework,
  normalizeTeacherHomework,
  normalizeTeacherList,
  splitHomework,
  type FamilyHomework,
} from '../homework.ts';

const hw = (over: Partial<FamilyHomework> = {}): FamilyHomework => ({
  id: 'h1',
  title: 'حل التمارين',
  instructions: '',
  dueDate: '2026-10-15',
  className: 'العاشر أ',
  teacherName: 'أ. سامي',
  done: false,
  state: 'open',
  examTitle: null,
  ...over,
});

// ─── ammanToday ──────────────────────────────────────────────────────────────

test('ammanToday rolls over at 21:00 UTC (midnight in Amman, UTC+3)', () => {
  assert.equal(ammanToday(new Date('2026-10-14T21:00:00Z')), '2026-10-15');
});

test('ammanToday is still the previous day one second earlier', () => {
  assert.equal(ammanToday(new Date('2026-10-14T20:59:59Z')), '2026-10-14');
});

// ─── addDays ─────────────────────────────────────────────────────────────────

test('addDays crosses a month boundary', () => {
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(addDays('2026-11-02', -3), '2026-10-30');
});

test('addDays crosses a leap day', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2028-02-28', 2), '2028-03-01');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
});

// ─── dueBadge ────────────────────────────────────────────────────────────────

test('dueBadge: a past due date is overdue with a negative distance', () => {
  assert.deepEqual(dueBadge('2026-10-12', '2026-10-15'), { kind: 'overdue', days: -3 });
});

test('dueBadge: due today', () => {
  assert.deepEqual(dueBadge('2026-10-15', '2026-10-15'), { kind: 'today', days: 0 });
});

test('dueBadge: due tomorrow', () => {
  assert.deepEqual(dueBadge('2026-10-16', '2026-10-15'), { kind: 'tomorrow', days: 1 });
});

test('dueBadge: further out is later, with the distance', () => {
  assert.deepEqual(dueBadge('2026-10-22', '2026-10-15'), { kind: 'later', days: 7 });
});

test('dueBadge counts across a month boundary', () => {
  assert.deepEqual(dueBadge('2026-11-02', '2026-10-30'), { kind: 'later', days: 3 });
});

// ─── dueDatePresets ──────────────────────────────────────────────────────────

test('dueDatePresets are +1, +2, +3 and +7 days, starting tomorrow', () => {
  assert.deepEqual(dueDatePresets('2026-10-15'), [
    { days: 1, date: '2026-10-16' },
    { days: 2, date: '2026-10-17' },
    { days: 3, date: '2026-10-18' },
    { days: 7, date: '2026-10-22' },
  ]);
});

// ─── isValidYmd ──────────────────────────────────────────────────────────────

test('isValidYmd accepts a real date, including a leap day', () => {
  assert.equal(isValidYmd('2026-10-14'), true);
  assert.equal(isValidYmd('2028-02-29'), true);
});

test('isValidYmd rejects a date that does not exist', () => {
  assert.equal(isValidYmd('2026-02-30'), false);
  assert.equal(isValidYmd('2027-02-29'), false);
});

test('isValidYmd rejects unpadded and empty input', () => {
  assert.equal(isValidYmd('2026-1-1'), false);
  assert.equal(isValidYmd(''), false);
});

// ─── normalizeFamilyHomework ─────────────────────────────────────────────────

const rawItem = {
  id: 'h1',
  title: 'حل التمارين',
  instructions: 'ص ٤٠',
  dueDate: '2026-10-15',
  dueAt: '2026-10-15T20:59:59.999Z',
  className: 'العاشر أ',
  teacherName: 'أ. سامي',
  done: true,
  doneAt: '2026-10-14T10:00:00Z',
  state: 'done',
  exam: null,
};

test('normalizeFamilyHomework keeps a well-formed row', () => {
  assert.deepEqual(normalizeFamilyHomework([rawItem]), [
    {
      id: 'h1',
      title: 'حل التمارين',
      instructions: 'ص ٤٠',
      dueDate: '2026-10-15',
      className: 'العاشر أ',
      teacherName: 'أ. سامي',
      done: true,
      state: 'done',
      examTitle: null,
    },
  ]);
});

test('normalizeFamilyHomework drops a row without an id, title or dueDate', () => {
  const out = normalizeFamilyHomework([
    { ...rawItem, id: undefined },
    { ...rawItem, title: undefined },
    { ...rawItem, dueDate: undefined },
    rawItem,
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.id, 'h1');
});

test('normalizeFamilyHomework drops a non-object row without throwing', () => {
  assert.deepEqual(normalizeFamilyHomework([null, 7, 'x', rawItem]).length, 1);
});

test('normalizeFamilyHomework coerces missing optional strings to empty', () => {
  const [row] = normalizeFamilyHomework([
    { id: 'h2', title: 'واجب', dueDate: '2026-10-15', done: false, state: 'open' },
  ]);
  assert.equal(row!.instructions, '');
  assert.equal(row!.className, '');
  assert.equal(row!.teacherName, '');
});

test('normalizeFamilyHomework treats an unknown state as open', () => {
  const [row] = normalizeFamilyHomework([{ ...rawItem, done: false, state: 'archived' }]);
  assert.equal(row!.state, 'open');
  assert.equal(row!.done, false);
});

test('normalizeFamilyHomework maps exam.title to examTitle', () => {
  const [row] = normalizeFamilyHomework([{ ...rawItem, exam: { title: 'اختبار الوحدة الأولى' } }]);
  assert.equal(row!.examTitle, 'اختبار الوحدة الأولى');
});

test('normalizeFamilyHomework reads exam null or missing as no exam', () => {
  const { exam: _exam, ...withoutExam } = rawItem;
  assert.equal(normalizeFamilyHomework([{ ...rawItem, exam: null }])[0]!.examTitle, null);
  assert.equal(normalizeFamilyHomework([withoutExam])[0]!.examTitle, null);
  assert.equal(normalizeFamilyHomework([{ ...rawItem, exam: { title: 5 } }])[0]!.examTitle, null);
});

test('normalizeFamilyHomework returns [] for null and non-arrays', () => {
  assert.deepEqual(normalizeFamilyHomework(null), []);
  assert.deepEqual(normalizeFamilyHomework(undefined), []);
  assert.deepEqual(normalizeFamilyHomework({ homework: [rawItem] }), []);
  assert.deepEqual(normalizeFamilyHomework('x'), []);
});

// ─── normalizeTeacherHomework ────────────────────────────────────────────────

const rawTeacher = {
  id: 't1',
  classGroupId: 'c1',
  title: 'واجب',
  instructions: '',
  dueDate: '2026-10-15',
  dueAt: '2026-10-15T20:59:59.999Z',
  evaluationId: 'e1',
  examTitle: 'اختبار',
  doneCount: 3,
  studentCount: 20,
};

test('normalizeTeacherHomework keeps a well-formed row and ignores extra fields', () => {
  assert.deepEqual(normalizeTeacherHomework([rawTeacher]), [
    {
      id: 't1',
      title: 'واجب',
      instructions: '',
      dueDate: '2026-10-15',
      evaluationId: 'e1',
      examTitle: 'اختبار',
      doneCount: 3,
      studentCount: 20,
      trackableCount: 20,
    },
  ]);
});

test('normalizeTeacherHomework defaults missing counts to 0 and exam fields to null', () => {
  const [row] = normalizeTeacherHomework([{ id: 't2', title: 'واجب', dueDate: '2026-10-15' }]);
  assert.equal(row!.doneCount, 0);
  assert.equal(row!.studentCount, 0);
  assert.equal(row!.evaluationId, null);
  assert.equal(row!.examTitle, null);
  assert.equal(row!.instructions, '');
  assert.equal(row!.trackableCount, 0);
});

test('normalizeTeacherHomework trackableCount defaults to studentCount when the server omits it', () => {
  // An older server must not make every student look untrackable.
  const [row] = normalizeTeacherHomework([{ ...rawTeacher, studentCount: 7 }]);
  assert.equal(row!.trackableCount, 7);
});

test('normalizeTeacherHomework keeps a served trackableCount, including 0', () => {
  assert.equal(normalizeTeacherHomework([{ ...rawTeacher, trackableCount: 12 }])[0]!.trackableCount, 12);
  assert.equal(normalizeTeacherHomework([{ ...rawTeacher, trackableCount: 0 }])[0]!.trackableCount, 0);
});

test('normalizeTeacherHomework never lets trackableCount exceed studentCount', () => {
  assert.equal(normalizeTeacherHomework([{ ...rawTeacher, trackableCount: 99 }])[0]!.trackableCount, 20);
});

test('normalizeTeacherHomework drops malformed rows and tolerates non-arrays', () => {
  assert.equal(normalizeTeacherHomework([{ ...rawTeacher, id: 5 }, rawTeacher]).length, 1);
  assert.deepEqual(normalizeTeacherHomework(null), []);
  assert.deepEqual(normalizeTeacherHomework({}), []);
});

// ─── splitHomework ───────────────────────────────────────────────────────────

test('splitHomework puts overdue first, then by due date ascending', () => {
  const { todo } = splitHomework([
    hw({ id: 'later', dueDate: '2026-10-20' }),
    hw({ id: 'late-recent', dueDate: '2026-10-14', state: 'overdue' }),
    hw({ id: 'soon', dueDate: '2026-10-16' }),
    hw({ id: 'late-old', dueDate: '2026-10-10', state: 'overdue' }),
  ]);
  assert.deepEqual(
    todo.map(h => h.id),
    ['late-old', 'late-recent', 'soon', 'later'],
  );
});

test('splitHomework moves done items to done, whatever their date', () => {
  const { todo, done } = splitHomework([
    hw({ id: 'a', done: true, state: 'done' }),
    hw({ id: 'b' }),
  ]);
  assert.deepEqual(todo.map(h => h.id), ['b']);
  assert.deepEqual(done.map(h => h.id), ['a']);
});

test('splitHomework does not mutate its input', () => {
  const input = [hw({ id: 'z', dueDate: '2026-10-20' }), hw({ id: 'a', dueDate: '2026-10-16' })];
  splitHomework(input);
  assert.deepEqual(input.map(h => h.id), ['z', 'a']);
});

// ─── applyDone ───────────────────────────────────────────────────────────────

test('applyDone(true) marks the item done and sets its state', () => {
  const out = applyDone([hw({ id: 'a' }), hw({ id: 'b' })], 'a', true);
  assert.equal(out[0]!.done, true);
  assert.equal(out[0]!.state, 'done');
  assert.equal(out[1]!.done, false);
  assert.equal(out[1]!.state, 'open');
});

test('applyDone(false) reopens a future item as open', () => {
  const future = addDays(ammanToday(), 3);
  const out = applyDone([hw({ id: 'a', dueDate: future, done: true, state: 'done' })], 'a', false);
  assert.equal(out[0]!.done, false);
  assert.equal(out[0]!.state, 'open');
});

test('applyDone(false) reopens a late item as overdue', () => {
  const past = addDays(ammanToday(), -2);
  const out = applyDone([hw({ id: 'a', dueDate: past, done: true, state: 'done' })], 'a', false);
  assert.equal(out[0]!.done, false);
  assert.equal(out[0]!.state, 'overdue');
});

test('applyDone(false) on an item due today is open, not overdue', () => {
  const out = applyDone([hw({ id: 'a', dueDate: ammanToday(), done: true, state: 'done' })], 'a', false);
  assert.equal(out[0]!.state, 'open');
});

test('applyDone leaves the list alone for an unknown id and does not mutate', () => {
  const input = [hw({ id: 'a' })];
  const out = applyDone(input, 'nope', true);
  assert.deepEqual(out, input);
  assert.equal(input[0]!.done, false);
});

// ─── homeworkDraftError ──────────────────────────────────────────────────────

test('homeworkDraftError: a blank or whitespace title is a title error', () => {
  assert.equal(homeworkDraftError({ title: '', dueDate: '2026-10-15' }), 'title');
  assert.equal(homeworkDraftError({ title: '   ', dueDate: '2026-10-15' }), 'title');
});

test('homeworkDraftError: an invalid date is a dueDate error', () => {
  assert.equal(homeworkDraftError({ title: 'واجب', dueDate: '2026-02-30' }), 'dueDate');
  assert.equal(homeworkDraftError({ title: 'واجب', dueDate: '' }), 'dueDate');
});

test('homeworkDraftError: a good draft is null', () => {
  assert.equal(homeworkDraftError({ title: 'واجب', dueDate: '2026-10-15' }), null);
});

// ─── normalizeChildHomework ──────────────────────────────────────────────────

const rawChild = { key: 'k1', displayName: 'سارة', canTrack: true, homework: [rawItem] };

test('normalizeChildHomework keeps key, name, canTrack and the normalised homework', () => {
  const [c] = normalizeChildHomework([rawChild]);
  assert.equal(c!.key, 'k1');
  assert.equal(c!.displayName, 'سارة');
  assert.equal(c!.canTrack, true);
  assert.equal(c!.homework.length, 1);
  assert.equal(c!.homework[0]!.id, 'h1');
});

test('normalizeChildHomework reads canTrack: false as false', () => {
  assert.equal(normalizeChildHomework([{ ...rawChild, canTrack: false }])[0]!.canTrack, false);
});

test('normalizeChildHomework defaults canTrack to true when the field is absent', () => {
  // An older server that never sent canTrack must not hide state.
  const { canTrack: _c, ...legacy } = rawChild;
  assert.equal(normalizeChildHomework([legacy])[0]!.canTrack, true);
  assert.equal(normalizeChildHomework([{ ...rawChild, canTrack: 'no' }])[0]!.canTrack, true);
});

test('normalizeChildHomework drops an entry without a string key and tolerates non-arrays', () => {
  assert.equal(normalizeChildHomework([{ ...rawChild, key: 5 }, null, rawChild]).length, 1);
  assert.deepEqual(normalizeChildHomework(undefined), []);
  assert.deepEqual(normalizeChildHomework({}), []);
});

test('normalizeChildHomework coerces a missing name to empty and a missing list to []', () => {
  const [c] = normalizeChildHomework([{ key: 'k2' }]);
  assert.equal(c!.displayName, '');
  assert.deepEqual(c!.homework, []);
  assert.equal(c!.canTrack, true);
});

// ─── normalizeTeacherList ────────────────────────────────────────────────────

test('normalizeTeacherList reads both top-level counts and the rows', () => {
  const out = normalizeTeacherList({ studentCount: 2, trackableCount: 1, homework: [{ ...rawTeacher, studentCount: 2, trackableCount: 1 }] });
  assert.equal(out.studentCount, 2);
  assert.equal(out.trackableCount, 1);
  assert.equal(out.homework.length, 1);
});

test('normalizeTeacherList defaults trackableCount to studentCount when absent', () => {
  assert.equal(normalizeTeacherList({ studentCount: 9, homework: [] }).trackableCount, 9);
});

test('normalizeTeacherList survives garbage', () => {
  assert.deepEqual(normalizeTeacherList(null), { studentCount: 0, trackableCount: 0, homework: [] });
});

// ─── formatDueDate ───────────────────────────────────────────────────────────

test('formatDueDate is day-month-year, isolated left-to-right', () => {
  // U+2066 LRI … U+2069 PDI, so Arabic and English render the same digits order.
  assert.equal(formatDueDate('2026-10-15'), '\u206615-10-2026\u2069');
  assert.equal(formatDueDate('2027-01-05'), '\u206605-01-2027\u2069');
});

test('formatDueDate leaves an unparseable string untouched', () => {
  assert.equal(formatDueDate('soon'), 'soon');
  assert.equal(formatDueDate('2026-02-30'), '2026-02-30');
});
