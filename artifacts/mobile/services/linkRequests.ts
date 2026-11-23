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

type SummaryClass = LinkRequestSummary['classes'][number];

/**
 * The bell's rows: one per class with requests, each opening that class (its
 * Students tab carries the banner). One row for all of them used to open the
 * class list, which shows no requests, so a teacher had to open each class to find them.
 */
export function linkRequestRows(summary: LinkRequestSummary, lang: 'ar' | 'en'): { key: string; route: string; className: string; count: number }[] {
  return summary.classes
    .filter(c => c.count > 0)
    .map(c => ({ key: c.classId, route: `/classes/${c.classId}`, className: classNameOf(c, lang), count: c.count }));
}

function classNameOf(c: SummaryClass, lang: 'ar' | 'en'): string {
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
