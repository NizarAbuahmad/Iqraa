import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { groupSurahsByGrade, isWholeSurah, segmentsText, surahGradeIds } from '../quranView.ts';

const lesson = (gradeId: string) => ({ lessonId: `kbl-${gradeId}`, gradeId, semester: 1 as const, from: 1, to: 1 });

describe('isWholeSurah', () => {
  it('is true only for one segment covering the whole surah', () => {
    assert.equal(isWholeSurah({ ayahCount: 5, segments: [{ from: 1, to: 5 }] }), true);
    assert.equal(isWholeSurah({ ayahCount: 5, segments: [{ from: 1, to: 4 }] }), false);
    assert.equal(isWholeSurah({ ayahCount: 5, segments: [{ from: 2, to: 5 }] }), false);
    assert.equal(isWholeSurah({ ayahCount: 5, segments: [{ from: 1, to: 2 }, { from: 4, to: 5 }] }), false);
  });
});

describe('segmentsText', () => {
  it('writes ranges and single ayahs', () => {
    assert.equal(segmentsText([{ from: 1, to: 8 }, { from: 20, to: 20 }, { from: 43, to: 44 }]), '1–8, 20, 43–44');
    assert.equal(segmentsText([{ from: 1, to: 2 }, { from: 4, to: 5 }], '، '), '1–2، 4–5');
    assert.equal(segmentsText([]), '');
  });
});

describe('groupSurahsByGrade', () => {
  const s = (number: number, ...grades: string[]) => ({ number, lessons: grades.map(lesson) });

  it('files a surah under the first grade that assigns it, in grade order', () => {
    const groups = groupSurahsByGrade([s(62, 'grade-6', 'grade-4'), s(1, 'grade-1'), s(2, 'grade-10'), s(96, 'grade-3')]);
    assert.deepEqual(groups.map(g => [g.gradeId, g.surahs.map(x => x.number)]), [
      ['grade-1', [1]],
      ['grade-3', [96]],
      ['grade-4', [62]],
      ['grade-10', [2]],
    ]);
  });

  it('sorts grade 10 after grade 9, not as a string', () => {
    assert.deepEqual(groupSurahsByGrade([s(2, 'grade-10'), s(17, 'grade-9')]).map(g => g.gradeId), ['grade-9', 'grade-10']);
  });

  it('orders surahs by number inside a group', () => {
    assert.deepEqual(groupSurahsByGrade([s(114, 'grade-1'), s(103, 'grade-1')])[0]!.surahs.map(x => x.number), [103, 114]);
  });
});

describe('surahGradeIds', () => {
  it('lists each grade once, ascending', () => {
    assert.deepEqual(surahGradeIds({ lessons: [lesson('grade-6'), lesson('grade-4'), lesson('grade-4')] }), ['grade-4', 'grade-6']);
  });
});
