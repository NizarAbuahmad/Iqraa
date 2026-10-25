/**
 * The edit-student sheet's draft, and what it sends. Pure, so the "only what
 * changed" rule is tested without a screen.
 */
import type { RosterStudent, StudentChanges } from './roster.ts';

export interface StudentDraft {
  displayName: string;
  externalRef: string;
  gender: '' | 'male' | 'female';
  teacherNote: string;
}

export function draftOf(s: RosterStudent): StudentDraft {
  return {
    displayName: s.displayName,
    externalRef: s.externalRef ?? '',
    gender: s.gender ?? '',
    teacherNote: s.teacherNote,
  };
}

/** Only the fields that differ, trimmed the way the server trims them. An empty string is a real change (it clears). */
export function studentChanges(s: RosterStudent, d: StudentDraft): StudentChanges {
  const changes: StudentChanges = {};
  const name = d.displayName.trim();
  if (name !== s.displayName) changes.displayName = name;
  const ref = d.externalRef.trim();
  if (ref !== (s.externalRef ?? '')) changes.externalRef = ref;
  if (d.gender !== (s.gender ?? '')) changes.gender = d.gender;
  const note = d.teacherNote.trim();
  if (note !== s.teacherNote) changes.teacherNote = note;
  return changes;
}

export function canSaveStudent(s: RosterStudent, d: StudentDraft): boolean {
  return d.displayName.trim() !== '' && Object.keys(studentChanges(s, d)).length > 0;
}
