/**
 * Join requests as a teacher reads them. Pure helpers for
 * `components/classes/LinkRequestsBanner.tsx` and the bell's «طلبات الانضمام»
 * row (`components/ui/NotificationBell.tsx`), kept free of React Native so
 * `node --test` can load them.
 */
import { arCountPhrase } from './arCount.ts';

/** What `GET /classes/link-requests` answers: what waits, per live class. */
export interface LinkRequestSummary {
  total: number;
  classes: { classId: string; name: string; nameAr: string; count: number }[];
}

/** Where the bell's row goes: straight to the class when only one has requests, else the class list. */
export function linkRequestsRoute(summary: LinkRequestSummary): string {
  return summary.classes.length === 1 ? `/classes/${summary.classes[0]!.classId}` : '/classes';
}

/** The one class to name on the bell's row, or '' when the requests sit in several. */
export function linkRequestsClassName(summary: LinkRequestSummary, lang: 'ar' | 'en'): string {
  if (summary.classes.length !== 1) return '';
  const c = summary.classes[0]!;
  return (lang === 'ar' ? c.nameAr.trim() : '') || c.name;
}

/** «طلب واحد» / «طلبان» / «٥ طلبات» / «١٢ طلبًا» بانتظار موافقتك, with the class when there is one. */
export function arJoinRequestsLine(n: number, className: string): string {
  const count = n === 1 ? 'طلب واحد' : arCountPhrase(n, 'طلبًا', 'طلبان', 'طلبات');
  return `${count} بانتظار موافقتك${className ? ` في ${className}` : ''}`;
}

export function enJoinRequestsLine(n: number, className: string): string {
  return `${n} ${n === 1 ? 'request' : 'requests'} waiting for your approval${className ? ` in ${className}` : ''}`;
}

/** How many waiting requests ask for this roster name (`students.id`). */
export function competingCount(requests: readonly { studentId: string }[], studentId: string): number {
  let n = 0;
  for (const r of requests) if (r.studentId === studentId) n += 1;
  return n;
}

/** The count to warn with, or 0 when this name has a single request and nothing competes. */
export function competingWarning(requests: readonly { studentId: string }[], studentId: string): number {
  const n = competingCount(requests, studentId);
  return n >= 2 ? n : 0;
}
