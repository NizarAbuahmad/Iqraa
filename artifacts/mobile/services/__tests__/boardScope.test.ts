/**
 * Which grade and subject a new whiteboard is saved under (services/boardScope.ts). A board
 * opened from Today or the Tools tab used to be filed with neither.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { boardScope } from '../boardScope.ts';
import { getPickerGrades, getPickerSubjects } from '../curriculumData.ts';
import { lessonPickerParams } from '../lessonPrep.ts';

const grades = getPickerGrades();
const subjects = getPickerSubjects();

describe('boardScope', () => {
  it('files a board from Today under its lesson\'s own grade and subject', () => {
    const idx = lessonPickerParams('kbl-math-s2-nccd-u5_l3', 'ar');
    assert.ok(idx, 'the lesson resolves');
    const scope = boardScope(idx!);
    assert.equal(scope.grade, grades[Number(idx!.gradeIdx)]!.name);
    assert.equal(scope.subject, subjects[Number(idx!.subjectIdx)]!.name);
    assert.ok(scope.grade && scope.subject);
    assert.equal(subjects.find(s => s.name === scope.subject)!.id, 'mathematics');
  });

  it('files a chemistry lesson under chemistry, not under whatever sits at index 0', () => {
    const chem = subjects.findIndex(s => s.id === 'chemistry');
    assert.ok(chem > 0);
    assert.equal(boardScope({ gradeIdx: '0', subjectIdx: String(chem) }).subject, subjects[chem]!.name);
    assert.notEqual(boardScope({ gradeIdx: '0', subjectIdx: String(chem) }).subject, subjects[0]!.name);
  });

  it('lets the presentation\'s names win over positions', () => {
    const s = boardScope({ subject: 'Physics', grade: 'Grade 9', gradeIdx: '0', subjectIdx: '0' });
    assert.deepEqual(s, { subject: 'Physics', grade: 'Grade 9' });
  });

  it('treats a position the lists cannot honour as absent, never as index 0', () => {
    assert.deepEqual(boardScope({ gradeIdx: '999', subjectIdx: '-1' }), { subject: '', grade: '' });
    assert.deepEqual(boardScope({ gradeIdx: 'x', subjectIdx: '' }), { subject: '', grade: '' });
  });

  it('resolves grade and subject independently', () => {
    assert.deepEqual(boardScope({ subjectIdx: '0' }), { subject: subjects[0]!.name, grade: '' });
    assert.deepEqual(boardScope({ gradeIdx: '0' }), { subject: '', grade: grades[0]!.name });
    assert.deepEqual(boardScope({ subject: 'Physics', gradeIdx: '0' }), { subject: 'Physics', grade: grades[0]!.name });
  });

  it('files a bare topic, or no params at all, under nothing, as before', () => {
    assert.deepEqual(boardScope({}), { subject: '', grade: '' });
    assert.deepEqual(boardScope({ subject: '  ', grade: '' }), { subject: '', grade: '' });
  });
});

describe('the board screen uses it', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'ai-tools', 'whiteboard.tsx'), 'utf8');

  it('saves with the resolved scope, not the raw params', () => {
    assert.match(src, /subject: scope\.subject/);
    assert.match(src, /grade: scope\.grade/);
    // The old save read the raw params with a `?? ''` fallback.
    assert.doesNotMatch(src, /subject: params\.subject \?\?/);
    assert.doesNotMatch(src, /grade: params\.grade \?\?/);
  });

  it('reads the positions the quick tools pass', () => {
    assert.match(src, /gradeIdx\?: string; subjectIdx\?: string/);
  });
});
