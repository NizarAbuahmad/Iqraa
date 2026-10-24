import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { imageCountByGrade, imageCountBySubject, imageLessons } from '../bookImageFolders.ts';
import { getBookForLesson } from '../knowledgeBase.ts';

describe('bookImageFolders', () => {
  it('files every lesson under its own grade and subject, in book order, with counts that add up', () => {
    const grades = imageCountByGrade();
    assert.ok((grades.get('grade-10') ?? 0) > 0, 'grade 10 has book figures');
    for (const [gradeId, gradeCount] of grades) {
      const subjects = imageCountBySubject(gradeId);
      assert.equal([...subjects.values()].reduce((a, b) => a + b, 0), gradeCount, gradeId);
      for (const [subjectId, subjectCount] of subjects) {
        const lessons = imageLessons(gradeId, subjectId);
        assert.equal(lessons.reduce((n, l) => n + l.count, 0), subjectCount, `${gradeId}/${subjectId}`);
        for (const [i, l] of lessons.entries()) {
          assert.ok(l.count > 0);
          const book = getBookForLesson(l.lesson);
          assert.equal(book?.gradeId, gradeId);
          assert.equal(book?.subjectId, subjectId);
          const prev = lessons[i - 1];
          if (prev) {
            const [a, b] = [prev.sortKey, l.sortKey];
            assert.ok(a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] <= b[2]))), l.lesson.id);
          }
        }
      }
    }
  });

  it('is empty for a grade or subject with no figures', () => {
    assert.deepEqual(imageLessons('grade-10', 'no-such-subject'), []);
    assert.equal(imageCountBySubject('no-such-grade').size, 0);
  });
});
