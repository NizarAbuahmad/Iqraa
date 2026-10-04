/**
 * The second line of a direct chat row (inbox) and of the chat header: who the
 * other person is *in this conversation* — which teacher, for which subject,
 * about which student — instead of only their account role.
 *
 * `chatRoleLabel` is a pure function of `role`, so an account stored as
 * school_admin that also teaches was introduced as the school's manager, and a
 * parent with two children's teachers could not tell the rows apart. The server
 * now sends `subjectIds` (the other person's teaching subjects) and
 * `aboutStudents` (the roster students linking the two accounts); this turns
 * them into text, and falls back to `chatRoleLabel` whenever they are absent.
 *
 * Plain `.ts` with no RN/expo imports, for the same reason as `chatRoleLabel.ts`.
 */
import { SUBJECTS } from '@workspace/curriculum';
import { chatRoleLabel } from './chatRoleLabel.ts';
import type { Lang, TranslationKey } from './i18n.ts';
import type { ChatParticipantInfo } from './messaging.ts';

type T = (key: TranslationKey, ...args: any[]) => string;

/** More than this and a one-line row stops being a one-line row. */
const MAX_SHOWN = 2;

/** «a، b +1» — the first MAX_SHOWN, then how many were left out. */
function listWithOverflow(items: string[]): string {
  const shown = items.slice(0, MAX_SHOWN).join('، ');
  const rest = items.length - MAX_SHOWN;
  return rest > 0 ? `${shown} +${rest}` : shown;
}

function subjectNames(ids: string[], lang: Lang): string[] {
  const names: string[] = [];
  for (const id of ids) {
    const subject = SUBJECTS.find(s => s.id === id);
    // An id the catalog does not know is dropped, never printed raw.
    if (subject) names.push(lang === 'ar' ? subject.nameAr : subject.name);
  }
  return names;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? '';
}

export function chatThreadSubtitle(other: ChatParticipantInfo, t: T, lang: Lang): string {
  // «Teaching account» is decided by the subjects, not only the role: an admin
  // who has set up subjects is a teacher to the parent on the other end.
  const subjects = subjectNames(other.subjectIds ?? [], lang);
  const isAdmin = other.role === 'school_admin' || other.role === 'system_admin';
  const teaches = other.role === 'teacher' || (isAdmin && subjects.length > 0);

  const base = teaches
    ? subjects.length > 0
      ? t('chatTeacherOf', listWithOverflow(subjects))
      : t('roleTeacher')
    : chatRoleLabel(other.role, t);

  const students = (other.aboutStudents ?? []).map(firstName).filter(Boolean);
  if (students.length === 0) return base;
  const names = listWithOverflow(students);
  return teaches ? `${base} · ${t('chatAboutStudent', names)}` : `${base} · ${names}`;
}
