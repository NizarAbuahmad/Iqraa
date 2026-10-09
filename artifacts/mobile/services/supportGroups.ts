/**
 * Support groups (مجموعات الدعم) on the class screen — pure, so it runs under
 * the bare node test runner. The server decides who is in a group
 * (`supportGroups()` in api-server); this file only shapes cards and links.
 */
import { arCountPhrase } from './arCount.ts';
import { worksheetAction } from './studentRecord.ts';

export type CheckOutcome = 'passed' | 'still_weak' | 'not_yet';

export interface SupportGroup {
  objectiveId: string;
  titleAr: string;
  lessonId: string | null;
  lessonTitleAr: string;
  classPercent: number;
  members: { studentId: string; displayName: string; percent: number }[];
  latestCheck: null | {
    evaluationId: string;
    title: string;
    status: 'published' | 'closed';
    createdAt: string;
    outcomes: { studentId: string; displayName: string; outcome: CheckOutcome; percent: number | null }[];
  };
  draftCheck: null | { evaluationId: string };
}

export const SUPPORT_GROUPS_SHOWN = 3;

export function visibleGroups(groups: SupportGroup[], showAll: boolean): SupportGroup[] {
  return showAll ? groups : groups.slice(0, SUPPORT_GROUPS_SHOWN);
}

export function outcomeKey(o: CheckOutcome): 'supportOutcomePassed' | 'supportOutcomeStillWeak' | 'supportOutcomeNotYet' {
  switch (o) {
    case 'passed': return 'supportOutcomePassed';
    case 'still_weak': return 'supportOutcomeStillWeak';
    case 'not_yet': return 'supportOutcomeNotYet';
  }
}

export function groupCheckAction(classId: string, g: SupportGroup) {
  return {
    pathname: '/evaluations/mini' as const,
    params: { classId, objectiveId: g.objectiveId, studentIds: g.members.map(m => m.studentId).join(',') },
  };
}

/** An unfinished group check for this objective: finish it, do not start another. */
export function groupDraftAction(g: SupportGroup) {
  return g.draftCheck ? { pathname: '/evaluations/[id]' as const, params: { id: g.draftCheck.evaluationId } } : null;
}

export function groupWorksheetAction(g: SupportGroup) {
  return worksheetAction({ lessonId: g.lessonId });
}

export function parseStudentIds(raw: string | string[] | undefined): string[] {
  const parts = (Array.isArray(raw) ? raw : [raw ?? ''])
    .flatMap(s => s.split(','))
    .map(s => s.trim())
    .filter(Boolean);
  return [...new Set(parts)];
}

/** A group check's marking list is its group; a class exam's is the class. */
export function filterToAudience<T extends { id: string }>(rows: T[], audience: string[] | null): T[] {
  if (!audience) return rows;
  const ids = new Set(audience);
  return rows.filter(r => ids.has(r.id));
}

function studentsAr(n: number): string {
  // arCountPhrase's 11+ branch reuses the singular («12 طالب واحد»); Arabic
  // takes the accusative singular there.
  return n >= 11 ? `${n} طالبًا` : arCountPhrase(n, 'طالب واحد', 'طالبان', 'طلاب');
}

export function groupSizeLabel(n: number, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? `للمجموعة: ${studentsAr(n)}` : `For the group: ${n} ${n === 1 ? 'student' : 'students'}`;
}

export function membersBelowLabel(n: number, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? `${studentsAr(n)} دون 60%` : `${n} ${n === 1 ? 'student' : 'students'} below 60%`;
}
