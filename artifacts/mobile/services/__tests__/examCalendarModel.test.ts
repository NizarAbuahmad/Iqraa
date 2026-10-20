/**
 * What this guards: the calendar screen turns one fetched list into three
 * different views — which days carry a dot, which carry the clash warning, and
 * what the agenda lists — and a "show school exams" toggle that must hide
 * colleagues' rows without hiding a clash the teacher still needs to hear
 * about. The server decides what is a clash; these helpers only ever read
 * `clash`, so they cannot disagree with it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  clashDates,
  conflictingExams,
  examDates,
  examsOnDate,
  maskTypedDate,
  maskTypedTime,
  monthFetchRange,
  normalizeTypedDate,
  normalizeTypedTime,
  type ExamCalendarEntry,
} from '../examCalendarModel.ts';

function own(over: Partial<Extract<ExamCalendarEntry, { own: true }>> = {}): ExamCalendarEntry {
  return {
    own: true,
    id: 'e1',
    title: 'Quiz',
    titleAr: 'اختبار',
    examDate: '2026-10-12',
    examTime: null,
    gradeId: 'grade-10',
    subjectId: 'mathematics',
    className: '10A',
    classNameAr: 'العاشر أ',
    clash: false,
    ...over,
  };
}

function colleague(over: Partial<Extract<ExamCalendarEntry, { own: false }>> = {}): ExamCalendarEntry {
  return {
    own: false,
    teacherName: 'Sami K',
    examDate: '2026-10-12',
    examTime: null,
    gradeId: 'grade-10',
    subjectId: 'chemistry',
    className: '10B',
    classNameAr: 'العاشر ب',
    clash: false,
    ...over,
  };
}

describe('examsOnDate', () => {
  it('returns the exams on that exact date, in the order given', () => {
    const a = own({ id: 'a' });
    const b = colleague();
    const other = own({ id: 'c', examDate: '2026-10-13' });
    assert.deepEqual(examsOnDate('2026-10-12', [a, b, other], true), [a, b]);
  });

  it('hides colleagues\' exams when the toggle is off, keeping the teacher\'s own', () => {
    const a = own({ id: 'a' });
    const b = colleague();
    assert.deepEqual(examsOnDate('2026-10-12', [a, b], false), [a]);
  });

  it('is empty for a day with no exam', () => {
    assert.deepEqual(examsOnDate('2026-10-20', [own()], true), []);
  });
});

describe('examDates', () => {
  it('lists each day that has an exam once', () => {
    const dates = examDates([own({ id: 'a' }), colleague(), own({ id: 'c', examDate: '2026-10-14' })], true);
    assert.deepEqual([...dates].sort(), ['2026-10-12', '2026-10-14']);
  });

  it('leaves a colleague-only day off the map while the toggle is off', () => {
    const dates = examDates([own({ id: 'a' }), colleague({ examDate: '2026-10-15' })], false);
    assert.deepEqual([...dates], ['2026-10-12']);
  });
});

describe('clashDates', () => {
  it('marks a day where the server flagged a clash', () => {
    const dates = clashDates([own({ clash: true }), colleague({ clash: true })], true);
    assert.deepEqual([...dates], ['2026-10-12']);
  });

  it('does not mark a day with no flagged exam', () => {
    assert.deepEqual([...clashDates([own(), colleague({ examDate: '2026-10-13' })], true)], []);
  });

  it('still warns about the teacher\'s own exam that clashes when colleagues are hidden', () => {
    const dates = clashDates([own({ clash: true }), colleague({ clash: true })], false);
    assert.deepEqual([...dates], ['2026-10-12']);
  });

  it('does not warn about a clash that exists only between hidden exams', () => {
    const dates = clashDates([colleague({ clash: true }), colleague({ clash: true, className: '10C' })], false);
    assert.deepEqual([...dates], []);
  });
});

describe('monthFetchRange', () => {
  it('spans the whole 6-week grid, lead-in and lead-out days included', () => {
    // October 2026 starts on a Thursday, so its grid opens on Sunday 27 Sept.
    const grid = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(2026, 8, 27 + i);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${mm}-${dd}`;
    });
    assert.deepEqual(monthFetchRange(grid), { from: '2026-09-27', to: '2026-11-07' });
  });
});

describe('conflictingExams', () => {
  it('finds a colleague\'s exam for the same grade on the chosen day', () => {
    const c = colleague();
    assert.deepEqual(conflictingExams('2026-10-12', 'grade-10', [c], 'e1'), [c]);
  });

  it('ignores the exam being edited, so saving a date does not warn about itself', () => {
    assert.deepEqual(conflictingExams('2026-10-12', 'grade-10', [own({ id: 'e1' })], 'e1'), []);
  });

  it('finds another of the teacher\'s own exams for the grade that day', () => {
    const other = own({ id: 'e2' });
    assert.deepEqual(conflictingExams('2026-10-12', 'grade-10', [other], 'e1'), [other]);
  });

  it('ignores other grades and other days', () => {
    const entries = [colleague({ gradeId: 'grade-9' }), colleague({ examDate: '2026-10-13' })];
    assert.deepEqual(conflictingExams('2026-10-12', 'grade-10', entries, 'e1'), []);
  });
});

describe('normalizeTypedDate', () => {
  it('leaves a latin date alone and trims it', () => {
    assert.equal(normalizeTypedDate(' 2026-10-12 '), '2026-10-12');
  });

  it('turns Arabic-Indic digits typed on an Arabic keyboard into latin ones', () => {
    assert.equal(normalizeTypedDate('٢٠٢٦-١٠-١٢'), '2026-10-12');
  });

  it('turns Eastern Arabic-Indic (Persian) digits into latin ones too', () => {
    assert.equal(normalizeTypedDate('۲۰۲۶-۱۰-۱۲'), '2026-10-12');
  });

  it('accepts a slash or a dot as the separator', () => {
    assert.equal(normalizeTypedDate('2026/10/12'), '2026-10-12');
    assert.equal(normalizeTypedDate('2026.10.12'), '2026-10-12');
  });
});

describe('normalizeTypedTime', () => {
  it('converts Arabic digits and pads a single-digit hour', () => {
    assert.equal(normalizeTypedTime('٩:٣٠'), '09:30');
    assert.equal(normalizeTypedTime('9:30'), '09:30');
  });

  it('keeps an already well-formed time', () => {
    assert.equal(normalizeTypedTime('13:05'), '13:05');
  });

  it('returns unrecognisable input unchanged, for the validator to refuse', () => {
    assert.equal(normalizeTypedTime('half past nine'), 'half past nine');
  });
});

describe('maskTypedDate', () => {
  it('puts the dashes in as the teacher types digits, and keeps them', () => {
    assert.equal(maskTypedDate('2'), '2');
    assert.equal(maskTypedDate('2026'), '2026-');
    assert.equal(maskTypedDate('2026-1', '2026-'), '2026-1');
    assert.equal(maskTypedDate('2026-10', '2026-1'), '2026-10-');
    assert.equal(maskTypedDate('2026-10-1', '2026-10-'), '2026-10-1');
    assert.equal(maskTypedDate('2026-10-15', '2026-10-1'), '2026-10-15');
  });

  it('accepts digits only, so a letter or a stray symbol never lands in the box', () => {
    assert.equal(maskTypedDate('20a26'), '2026-');
    assert.equal(maskTypedDate('2026-10-15-9'), '2026-10-15');
  });

  it('formats a pasted date, whatever separator it came with', () => {
    assert.equal(maskTypedDate('2026/10/12'), '2026-10-12');
    assert.equal(maskTypedDate('2026.10.12'), '2026-10-12');
    assert.equal(maskTypedDate('٢٠٢٦-١٠-١٢'), '2026-10-12');
  });

  it('lets backspace take the dash away instead of putting it straight back', () => {
    assert.equal(maskTypedDate('2026', '2026-'), '2026');
    assert.equal(maskTypedDate('2026-10', '2026-10-'), '2026-10');
    assert.equal(maskTypedDate('202', '2026'), '202');
  });

  it('keeps a dash the teacher left behind after deleting the digit beside it', () => {
    assert.equal(maskTypedDate('2026-', '2026-1'), '2026-');
  });

  it('empties cleanly', () => {
    assert.equal(maskTypedDate(''), '');
    assert.equal(maskTypedDate('-'), '');
  });
});

describe('maskTypedTime', () => {
  it('puts the colon in as the teacher types, and keeps it', () => {
    assert.equal(maskTypedTime('1'), '1');
    assert.equal(maskTypedTime('12'), '12:');
    assert.equal(maskTypedTime('12:3', '12:'), '12:3');
    assert.equal(maskTypedTime('12:30', '12:3'), '12:30');
  });

  it('pads an hour that can only be one digit', () => {
    assert.equal(maskTypedTime('9'), '09:');
    assert.equal(maskTypedTime('9:3', '09:'), '09:3');
  });

  it('drops anything past HH:MM and anything that is not a digit', () => {
    assert.equal(maskTypedTime('12:300'), '12:30');
    assert.equal(maskTypedTime('1x2'), '12:');
  });

  it('formats Arabic digits', () => {
    assert.equal(maskTypedTime('١٢٣٠'), '12:30');
  });

  it('lets backspace take the colon away', () => {
    assert.equal(maskTypedTime('12', '12:'), '12');
    assert.equal(maskTypedTime('1', '12'), '1');
  });

  it('empties cleanly', () => {
    assert.equal(maskTypedTime(''), '');
  });
});
