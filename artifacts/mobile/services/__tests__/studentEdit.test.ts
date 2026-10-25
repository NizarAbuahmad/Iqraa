/**
 * The edit sheet sends only what changed: the PATCH handler tells an absent
 * field from an empty one, so `teacherNote: ''` clears a note and omitting it
 * leaves it. Sending everything would also needlessly re-run the rename check.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canSaveStudent, draftOf, studentChanges } from '../studentEdit.ts';
import type { RosterStudent } from '../roster.ts';

const student: RosterStudent = {
  id: 's1',
  displayName: 'خالد التيس',
  externalRef: '1042',
  gradeId: 'grade-10',
  teacherNote: 'يستعجل',
  gender: 'male',
  createdAt: '2026-09-01T00:00:00.000Z',
};

describe('draftOf', () => {
  it('copies the editable fields, with empty strings for the optional ones', () => {
    assert.deepEqual(draftOf({ ...student, externalRef: null, gender: undefined }), {
      displayName: 'خالد التيس',
      externalRef: '',
      gender: '',
      teacherNote: 'يستعجل',
    });
  });
});

describe('studentChanges', () => {
  it('is empty for an untouched draft', () => {
    assert.deepEqual(studentChanges(student, draftOf(student)), {});
  });

  it('names only the fields that changed, trimmed', () => {
    const draft = { ...draftOf(student), displayName: '  خالد التيس الأحمد ', teacherNote: 'يتحسّن' };
    assert.deepEqual(studentChanges(student, draft), { displayName: 'خالد التيس الأحمد', teacherNote: 'يتحسّن' });
  });

  it('sends an empty string to clear the note or the register number', () => {
    const draft = { ...draftOf(student), externalRef: '', teacherNote: '   ' };
    assert.deepEqual(studentChanges(student, draft), { externalRef: '', teacherNote: '' });
  });

  it('treats whitespace-only edits to the note as no change when the note was empty', () => {
    const empty = { ...student, teacherNote: '' };
    assert.deepEqual(studentChanges(empty, { ...draftOf(empty), teacherNote: '  ' }), {});
  });
});

describe('canSaveStudent', () => {
  it('needs a name and at least one change', () => {
    assert.equal(canSaveStudent(student, draftOf(student)), false);
    assert.equal(canSaveStudent(student, { ...draftOf(student), gender: 'female' }), true);
    assert.equal(canSaveStudent(student, { ...draftOf(student), displayName: '   ' }), false);
  });
});
