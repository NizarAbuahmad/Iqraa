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
  /** The class's shared join code, null until a teacher mints one. Both fields come free on GET /classes/:id, which selects the whole row. */
  joinCode?: string | null;
  joinCodeExpiresAt?: string | null;
}

export interface RosterStudent {
  id: string;
  displayName: string;
  externalRef: string | null;
  gradeId: string;
  /** The teacher's running note on this child. Empty string, never null. */
  teacherNote: string;
  createdAt: string;
  /** Somebody has signed up against this name. Absent from the class list endpoint, which does not compute it. */
  linked?: boolean;
}

export interface NewStudent {
  displayName: string;
  externalRef?: string;
}

/**
 * A roster failure the screen can translate.
 *
 * The server replies in English; the app is Arabic-first. Echoing `error`
 * straight into the UI is how "Failed to create class" ended up in an Arabic
 * dialog. Carry the status and the server's machine-readable `code` instead,
 * and let the screen choose the wording.
 */
export class RosterError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'RosterError';
    this.status = status;
    this.code = code;
  }

  /** The database this server talks to has no roster tables yet. */
  get isStorageUnavailable(): boolean {
    return this.code === 'roster_storage_unavailable';
  }
}

async function readJson<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) {
    let detail = '';
    let code = '';
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      detail = body.error ?? '';
      code = body.code ?? '';
    } catch {
      /* body wasn't JSON — the status is all we have */
    }
    throw new RosterError(
      detail || `${action} failed (${res.status})`,
      res.status,
      code,
    );
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

/**
 * Edit a student. Replaces `renameStudent`, which took only a name and which
 * no screen ever called — one PATCH endpoint, one client function.
 *
 * Send only what changed: the handler distinguishes an absent field from an
 * empty one, so `teacherNote: ''` clears the note while omitting it leaves it.
 */
export async function updateStudent(
  studentId: string,
  changes: { displayName?: string; externalRef?: string; teacherNote?: string },
): Promise<RosterStudent> {
  const res = await apiFetch(`/students/${studentId}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
  const data = await readJson<{ student: RosterStudent }>(res, 'Updating student');
  return data.student;
}

export async function archiveClass(classId: string): Promise<void> {
  const res = await apiFetch(`/classes/${classId}`, { method: 'DELETE' });
  await readJson(res, 'Archiving class');
}

/**
 * Mints a fresh code so a parent or the student can link to this exact
 * roster row when they sign up — see services/messaging.ts. Regenerating
 * invalidates any code shared before.
 */
export async function generateClaimCode(
  studentId: string,
): Promise<{ claimCode: string; claimCodeExpiresAt: string }> {
  const res = await apiFetch(`/students/${studentId}/claim-code`, { method: 'POST' });
  return readJson(res, 'Generating class code');
}

/**
 * Mints one code for the whole class instead of one per child. Same
 * overwrite-on-regenerate rule as the per-student code above, but longer-lived
 * — it goes on a whiteboard, not into a single message.
 */
export async function generateJoinCode(
  classId: string,
): Promise<{ joinCode: string; joinCodeExpiresAt: string }> {
  const res = await apiFetch(`/classes/${classId}/join-code`, { method: 'POST' });
  return readJson(res, 'Generating join code');
}

/**
 * The undo for a wrong claim. Drops the account's link to this roster row and
 * rebuilds the class threads it derived — it does not remove them from any
 * custom group a teacher put them in by hand (see the route's comment).
 */
export async function unlinkAccount(studentId: string, userId: string): Promise<void> {
  const res = await apiFetch(`/students/${studentId}/links/${userId}`, { method: 'DELETE' });
  await readJson(res, 'Unlinking account');
}

export interface JoinRosterEntry {
  id: string;
  displayName: string;
  /** A student account already holds this name. Parents may still claim it; a second student may not. */
  taken: boolean;
}

/**
 * Reads the class behind a join code so the joiner can pick their own name.
 * Public — called from the signup screen before any account exists. A 404 here
 * is the normal answer for a per-student claim code, which names its own
 * student and needs no picker; callers should treat it as "not a class code"
 * rather than an error.
 */
export async function lookupJoinCode(
  code: string,
): Promise<{ class: { name: string; nameAr: string }; students: JoinRosterEntry[] }> {
  const res = await apiFetch(`/auth/join/${encodeURIComponent(code)}`);
  return readJson(res, 'Opening class code');
}

/** Re-exported so screens have one roster import. Lives apart to stay testable. */
export { parseStudentNames } from './rosterNames.ts';
