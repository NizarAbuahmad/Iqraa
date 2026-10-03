/**
 * Where a student's exam-sitting token lives between reloads.
 *
 * The token used to live only in the screen's React state. On web a reload
 * is a cold boot, so a student who refreshed mid-paper came back to the name
 * picker with their own name greyed out as taken, and the only way through
 * was the teacher deleting the attempt — answers and all. Keyed by the share
 * code, so two exams on one device do not hand each other their tokens.
 *
 * Still not the shared token store: this is an exam sitting, never a
 * session, and `apiFetch` must never pick it up. Six hours on the server
 * bounds how long a token left on a borrowed device keeps working.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ExamSession {
  token: string;
  studentName: string;
}

const key = (code: string) => `take:${code.trim().toUpperCase()}`;

export async function loadExamSession(code: string): Promise<ExamSession | null> {
  try {
    const raw = await AsyncStorage.getItem(key(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ExamSession>;
    return typeof parsed.token === 'string' && parsed.token
      ? { token: parsed.token, studentName: typeof parsed.studentName === 'string' ? parsed.studentName : '' }
      : null;
  } catch {
    return null;
  }
}

export async function saveExamSession(code: string, session: ExamSession): Promise<void> {
  try {
    await AsyncStorage.setItem(key(code), JSON.stringify(session));
  } catch {
    /* storage is a convenience; the sitting still works without it */
  }
}

export async function clearExamSession(code: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(code));
  } catch {
    /* nothing to clear */
  }
}
