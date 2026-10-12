/**
 * «الواجبات» — pure types and helpers shared by the student, parent and
 * teacher screens. No imports on purpose: this file is loaded by bare
 * `node --test`, so nothing here may touch react-native, expo or `apiClient`.
 * The fetchers live in `homeworkApi.ts`.
 *
 * A due date is a calendar day (`YYYY-MM-DD`) in Asia/Amman, never a
 * timestamp. Amman has been on UTC+3 all year since 2022, so "today" is the UTC
 * clock plus three hours; a device in another timezone must still agree with
 * the server about whether a homework is late.
 *
 * Compare dates as strings or through `Date.UTC` — never `new Date('YYYY-MM-DD')`
 * in local time, which shifts the day in any zone west of UTC.
 */

export type HomeworkState = 'done' | 'overdue' | 'open';

export interface FamilyHomework {
  id: string;
  title: string;
  instructions: string;
  /** YYYY-MM-DD, Asia/Amman. */
  dueDate: string;
  className: string;
  teacherName: string;
  done: boolean;
  state: HomeworkState;
  examTitle: string | null;
  /**
   * Whether anyone can tick THIS item off — the server's per-item rule (some
   * roster row of the child in this item's class has a student account). False
   * means «متأخّر» / «لم يُنجز» would be claims the system cannot back, so the
   * item shows its date only. Ticking is per class, so this is per item, not
   * per child. Absent on the wire (an older server) reads as true.
   */
  canTrack: boolean;
}

export interface ChildHomework {
  key: string;
  displayName: string;
  /**
   * Informational aggregate (any item trackable; with no items, any row has an
   * account). NOT the rule for a given item — use `FamilyHomework.canTrack`.
   * Absent on the wire (an older server) reads as true.
   */
  canTrack: boolean;
  homework: FamilyHomework[];
}

export interface TeacherHomework {
  id: string;
  title: string;
  instructions: string;
  dueDate: string;
  evaluationId: string | null;
  examTitle: string | null;
  doneCount: number;
  studentCount: number;
  /**
   * Students in the class who have an account and so can tick it. `doneCount`
   * can only ever reach this, so it — not `studentCount` — is the denominator.
   */
  trackableCount: number;
}

export interface TeacherHomeworkList {
  studentCount: number;
  trackableCount: number;
  homework: TeacherHomework[];
}

/** `days` is the signed distance from today: negative = late. */
export type DueBadge = { kind: 'overdue' | 'today' | 'tomorrow' | 'later'; days: number };

const AMMAN_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's date in Amman as YYYY-MM-DD. */
export function ammanToday(now: Date = new Date()): string {
  return new Date(now.getTime() + AMMAN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Midnight UTC of a YYYY-MM-DD, or NaN when it is not a real date. */
function ymdToUtc(ymd: string): number {
  const m = YMD.exec(ymd);
  if (!m) return NaN;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  // Date.UTC rolls 2026-02-30 over to 2026-03-02; a round trip catches that.
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? t : NaN;
}

export function isValidYmd(s: string): boolean {
  return typeof s === 'string' && !Number.isNaN(ymdToUtc(s));
}

export function addDays(ymd: string, days: number): string {
  return new Date(ymdToUtc(ymd) + days * DAY_MS).toISOString().slice(0, 10);
}

export function dueBadge(dueDate: string, today: string): DueBadge {
  const days = Math.round((ymdToUtc(dueDate) - ymdToUtc(today)) / DAY_MS);
  if (days < 0) return { kind: 'overdue', days };
  if (days === 0) return { kind: 'today', days };
  if (days === 1) return { kind: 'tomorrow', days };
  return { kind: 'later', days };
}

/** The teacher's quick picks: tomorrow, in two days, in three, in a week. */
export function dueDatePresets(today: string): { days: number; date: string }[] {
  return [1, 2, 3, 7].map(days => ({ days, date: addDays(today, days) }));
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function normalizeState(state: unknown, done: boolean): HomeworkState {
  if (done) return 'done';
  return state === 'overdue' ? 'overdue' : 'open';
}

/**
 * Takes the `homework` array of `GET /student/homework` (or one child's, from
 * `/parent/homework`). A row that cannot be shown — no id, title or real due
 * date — is dropped rather than rendered half-empty. Never throws.
 */
export function normalizeFamilyHomework(raw: unknown): FamilyHomework[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): FamilyHomework[] => {
    if (!isRecord(r)) return [];
    const id = str(r['id']);
    const title = str(r['title']);
    const dueDate = str(r['dueDate']);
    if (!id || !title || !isValidYmd(dueDate)) return [];
    const done = r['done'] === true;
    const exam = r['exam'];
    const examTitle = isRecord(exam) && typeof exam['title'] === 'string' ? exam['title'] : null;
    return [
      {
        id,
        title,
        instructions: str(r['instructions']),
        dueDate,
        className: str(r['className']),
        teacherName: str(r['teacherName']),
        done,
        // A done row is `done` whatever the server's label says, so the two
        // fields can never disagree on screen.
        state: normalizeState(r['state'], done),
        examTitle,
        canTrack: r['canTrack'] !== false,
      },
    ];
  });
}

/** Takes the `homework` array of `GET /classes/:id/homework`. Extra fields are ignored. */
export function normalizeTeacherHomework(raw: unknown): TeacherHomework[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): TeacherHomework[] => {
    if (!isRecord(r)) return [];
    const id = str(r['id']);
    const title = str(r['title']);
    const dueDate = str(r['dueDate']);
    if (!id || !title || !isValidYmd(dueDate)) return [];
    const studentCount = count(r['studentCount']);
    return [
      {
        id,
        title,
        instructions: str(r['instructions']),
        dueDate,
        evaluationId: str(r['evaluationId']) || null,
        examTitle: str(r['examTitle']) || null,
        doneCount: count(r['doneCount']),
        studentCount,
        trackableCount: trackable(r['trackableCount'], studentCount),
      },
    ];
  });
}

/** A server that omits `trackableCount` is read as "everyone can tick" — never as "no one". */
function trackable(raw: unknown, studentCount: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? Math.min(raw, studentCount) : studentCount;
}

/**
 * `doneCount` can exceed `trackableCount`: a completion is kept after the
 * account's roster link is removed, so the numerator still counts it while the
 * denominator no longer does. Shown as it came that reads «5 of 4».
 */
export function clampedDone(done: number, trackable: number): number {
  return Math.max(0, Math.min(done, trackable));
}

/** The whole body of `GET /classes/:id/homework`. Never throws. */
export function normalizeTeacherList(raw: unknown): TeacherHomeworkList {
  const r = isRecord(raw) ? raw : {};
  const studentCount = count(r['studentCount']);
  return {
    studentCount,
    trackableCount: trackable(r['trackableCount'], studentCount),
    homework: normalizeTeacherHomework(r['homework']),
  };
}

/** The `children` array of `GET /parent/homework`. An entry with no string key is dropped. */
export function normalizeChildHomework(raw: unknown): ChildHomework[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((c): ChildHomework[] => {
    if (!isRecord(c) || typeof c['key'] !== 'string') return [];
    return [
      {
        key: c['key'],
        displayName: str(c['displayName']),
        canTrack: c['canTrack'] !== false,
        homework: normalizeFamilyHomework(c['homework']),
      },
    ];
  });
}

/**
 * A due date for display: `DD-MM-YYYY` inside a left-to-right isolate
 * (U+2066 … U+2069). Left to the bidi algorithm the digits and hyphens of a
 * date in an Arabic sentence come out in an order nobody chose; the isolate
 * makes it read the same in Arabic and English. An unparseable string is
 * returned as it came. Display only — never feed this back to the server.
 */
export function formatDueDate(ymd: string): string {
  if (!isValidYmd(ymd)) return ymd;
  return `\u2066${ymd.slice(8, 10)}-${ymd.slice(5, 7)}-${ymd.slice(0, 4)}\u2069`;
}

/**
 * `todo`: overdue first, then by due date ascending. `done`: kept in the order
 * given — the interface carries no completion time to sort by. Pure.
 */
export function splitHomework(items: FamilyHomework[]): { todo: FamilyHomework[]; done: FamilyHomework[] } {
  const rank = (h: FamilyHomework) => (h.state === 'overdue' ? 0 : 1);
  const todo = items
    .filter(h => !h.done)
    .sort((a, b) => rank(a) - rank(b) || (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  return { todo, done: items.filter(h => h.done) };
}

export type HomeworkSection = { key: 'todo' | 'done' | 'all'; items: FamilyHomework[] };

/**
 * What the family list shows. Normally the «المطلوب» / «تم إنجازه» groups. When
 * EVERY item is untracked (`canTrack === false`) nobody can ever tick any of
 * them, so a «المطلوب» heading would present them as actionable: the list is
 * flat instead (`key: 'all'`, soonest due first, no heading). A mix keeps the
 * groups. `anyUntracked` says whether to explain why some rows have no status.
 */
export function homeworkSections(items: FamilyHomework[]): { sections: HomeworkSection[]; anyUntracked: boolean } {
  const anyUntracked = items.some(h => !h.canTrack);
  if (items.length > 0 && items.every(h => !h.canTrack)) {
    const all = [...items].sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
    return { sections: [{ key: 'all', items: all }], anyUntracked };
  }
  const { todo, done } = splitHomework(items);
  return {
    sections: [{ key: 'todo' as const, items: todo }, { key: 'done' as const, items: done }].filter(g => g.items.length > 0),
    anyUntracked,
  };
}

/**
 * The optimistic update for a tap. Reopening cannot ask the server whether the
 * homework is late, so it recomputes that from the due date and today in Amman.
 */
export function applyDone(items: FamilyHomework[], id: string, done: boolean): FamilyHomework[] {
  const today = ammanToday();
  return items.map(h => {
    if (h.id !== id) return h;
    if (done) return { ...h, done: true, state: 'done' };
    return { ...h, done: false, state: h.dueDate < today ? 'overdue' : 'open' };
  });
}

export function homeworkDraftError(d: { title: string; dueDate: string }): 'title' | 'dueDate' | null {
  if (d.title.trim() === '') return 'title';
  if (!isValidYmd(d.dueDate)) return 'dueDate';
  return null;
}
