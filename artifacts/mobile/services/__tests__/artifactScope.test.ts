/**
 * Subject and grade for a chat-generated material.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/artifactScope.test.ts
 *
 * Found 2026-10-02: chat's `buildRequest` fell back to الرياضيات / الصف
 * العاشر whenever no KB lesson was resolved — the document-upload path and
 * every ungrounded topic. Generators branch on the subject NAME (CLAUDE.md),
 * so a chemistry teacher's uploaded worksheet came back as a maths quiz headed
 * «الرياضيات». The screen knows the teacher's scope; it has to reach the
 * request.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveArtifactScope } from '../ai/artifactScope.ts';
import { getLessonById } from '../knowledgeBase.ts';
import { GRADES, SUBJECTS } from '../curriculumData.ts';

const chem = SUBJECTS.find(s => s.id === 'chemistry')!;
const g10 = GRADES.find(g => g.id === 'grade-10')!;
const g9 = GRADES.find(g => g.id === 'grade-9')!;

describe('resolveArtifactScope', () => {
  it('a resolved lesson names its own book', () => {
    const lesson = getLessonById('kbl-math-s2-nccd-u5_l4')!;
    const ar = resolveArtifactScope(lesson, { subjectId: 'chemistry', gradeId: 'grade-9' }, 'ar');
    assert.equal(ar.subject, SUBJECTS.find(s => s.id === 'mathematics')!.nameAr);
    assert.equal(ar.grade, g10.nameAr);
  });

  it('no lesson: the picked scope names the subject and grade', () => {
    const ar = resolveArtifactScope(null, { subjectId: 'chemistry', gradeId: 'grade-9' }, 'ar');
    assert.deepEqual(ar, { subject: chem.nameAr, grade: g9.nameAr });
    const en = resolveArtifactScope(null, { subjectId: 'chemistry', gradeId: 'grade-9' }, 'en');
    assert.deepEqual(en, { subject: chem.name, grade: g9.name });
  });

  it('a half-known scope fills only the half it knows', () => {
    const ar = resolveArtifactScope(null, { subjectId: 'chemistry', gradeId: null }, 'ar');
    assert.equal(ar.subject, chem.nameAr);
    assert.equal(ar.grade, g10.nameAr);
  });

  it('nothing known keeps the historical default', () => {
    assert.deepEqual(resolveArtifactScope(null, null, 'en'), { subject: 'Mathematics', grade: 'Grade 10' });
  });
});
