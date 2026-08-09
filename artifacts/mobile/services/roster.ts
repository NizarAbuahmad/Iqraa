/**
 * Roster service — classes and students.
 *
 * Unlike `workspace.ts` there is no AsyncStorage fallback here, and that is
 * deliberate: a roster is shared state that evaluations, attempts and results
 * all key off. A locally-invented student id would produce results the server
 * cannot attach to anyone. Roster editing requires the API to be reachable, and
 * says so when it isn't.
 */
import { apiFetch } from './apiClient.ts';

export interface ClassGroup {
  id: string;
  name: string;
  nameAr: string;
  gradeId: string;
  subjectId: string;
  academicYear: string;
  createdAt: string;
  studentCount: number;
}

export interface RosterStudent {
  id: string;
  displayName: string;
  externalRef: string | null;
  gradeId: string;
  createdAt: string;
}

export interface NewStudent {
  displayName: string;
  externalRef?: string;
}

async function readJson<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try {
      detail = ((await res.json()) as { error?: string }).error ?? '';
    } catch {
      /* body wasn't JSON — the status is all we have */
    }
    throw new Error(detail || `${action} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function listClasses(): Promise<ClassGroup[]> {
  const res = await apiFetch('/classes');
  const data = await readJson<{ classes: ClassGroup[] }>(res, 'Loading classes');
  return data.classes;
}

export async function createClass(input: {
  name: string;
  nameAr?: string;
  gradeId?: string;
  subjectId?: string;
  academicYear?: string;
}): Promise<ClassGroup> {
  const res = await apiFetch('/classes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const data = await readJson<{ class: ClassGroup }>(res, 'Creating class');
  return data.class;
}

export async function getClass(
  classId: string,
): Promise<{ group: ClassGroup; students: RosterStudent[] }> {
  const res = await apiFetch(`/classes/${classId}`);
  const data = await readJson<{ class: ClassGroup; students: RosterStudent[] }>(
    res,
    'Loading class',
  );
  return { group: data.class, students: data.students };
}

/**
 * Add students to a class. Send the whole list in one call — a teacher entering
 * a register of thirty should not generate thirty round trips, each of which
 * can fail separately and leave the roster half-built.
 */
export async function addStudents(
  classId: string,
  newStudents: NewStudent[],
): Promise<{ added: number; created: number; skipped: string[] }> {
  const res = await apiFetch(`/classes/${classId}/students`, {
    method: 'POST',
    body: JSON.stringify({ students: newStudents }),
  });
  return readJson<{ added: number; created: number; skipped: string[] }>(
    res,
    'Adding students',
  );
}

/** Removes from the class only — the student and their history are kept. */
export async function removeStudentFromClass(
  classId: string,
  studentId: string,
): Promise<void> {
  const res = await apiFetch(`/classes/${classId}/students/${studentId}`, {
    method: 'DELETE',
  });
  await readJson(res, 'Removing student');
}

export async function renameStudent(
  studentId: string,
  displayName: string,
): Promise<RosterStudent> {
  const res = await apiFetch(`/students/${studentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  });
  const data = await readJson<{ student: RosterStudent }>(res, 'Renaming student');
  return data.student;
}

export async function archiveClass(classId: string): Promise<void> {
  const res = await apiFetch(`/classes/${classId}`, { method: 'DELETE' });
  await readJson(res, 'Archiving class');
}

/** Re-exported so screens have one roster import. Lives apart to stay testable. */
export { parseStudentNames } from './rosterNames.ts';
