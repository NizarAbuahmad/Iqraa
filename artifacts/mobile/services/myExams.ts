/**
 * The «اختباراتي» list, as the screen reads it.
 *
 * Types mirror `GET /student/exams` (`modules/assessment/studentExams.ts` on
 * the server, where the state and release rules live and are tested). What is
 * decided here is only presentation: which label a state shows and what
 * tapping a row does. Pure and free of React Native, so it runs under the
 * bare test runner like the rest of `services/`.
 */
import { SUBJECTS } from '@workspace/curriculum';
import type { StudentResult } from './studentExam.ts';

export type MyExamState = 'available' | 'in_progress' | 'submitted' | 'result' | 'closed' | 'paper';

export interface MyExam {
  evaluationId: string;
  title: string;
  titleAr: string;
  subjectId: string;
  gradeId: string;
  totalMarks: number;
  timeLimitMin: number | null;
  publishedAt: string | null;
  state: MyExamState;
  /** Present only while the exam link admits the student. */
  shareCode: string | null;
  submittedAt: string | null;
  deadlineAt: string | null;
  result: StudentResult | null;
  /** 'YYYY-MM-DD', a calendar day with no zone — compare as a string, never through `Date`. Absent from an older server. */
  examDate?: string | null;
  /** 'HH:MM', the teacher's wall-clock time. Absent from an older server. */
  examTime?: string | null;
  /** Sat on paper; never has a link. Absent from an older server. */
  paper?: boolean;
  /** «راجع إجاباتك» may open (`GET /student/exams/:id/review`). Absent from an older server. */
  review?: boolean;
}

/** One child's list, as `GET /parent/exams` returns it — no row carries a link. */
export interface ChildExams {
  /** The server's child key — one child's rows under two teachers share it; absent from an older server. */
  key?: string;
  studentId: string;
  displayName: string;
  exams: MyExam[];
}

export const MY_EXAM_STATE_KEY = {
  available: 'myExamsStateAvailable',
  in_progress: 'myExamsStateInProgress',
  submitted: 'myExamsStateSubmitted',
  result: 'myExamsStateResult',
  closed: 'myExamsStateClosed',
  paper: 'myExamsStatePaper',
} as const satisfies Record<MyExamState, string>;

export type MyExamAction = 'start' | 'continue' | 'toggle_result' | null;

/**
 * What tapping a row does. Only an open link is ever followed: a closed exam
 * answers `/take/:code` like an unknown code, so following it would land the
 * student on «هذا الرابط غير متاح» for an exam they can see right here.
 */
export function myExamAction(exam: MyExam): MyExamAction {
  if (exam.state === 'result' && exam.result) return 'toggle_result';
  if (exam.state === 'paper') return null;
  if (!exam.shareCode) return null;
  if (exam.state === 'available') return 'start';
  if (exam.state === 'in_progress') return 'continue';
  return null;
}

/**
 * Whether the row offers «أعد المحاولة». The server lists a quiz as retakeable
 * only once the teacher has released its result; the row checks it shows that
 * result too, so a retake bar can never sit beside «بانتظار النتيجة» and say
 * "failed" before the teacher has. A parent never retakes for a child.
 */
export function canRetakeExam(exam: Pick<MyExam, 'evaluationId' | 'state'>, retakeEvaluationIds: readonly string[], isParent: boolean): boolean {
  return !isParent && exam.state === 'result' && retakeEvaluationIds.includes(exam.evaluationId);
}

/** The exam's title in the reader's language, falling back to the other. */
export function myExamTitle(exam: Pick<MyExam, 'title' | 'titleAr'>, lang: 'ar' | 'en'): string {
  return (lang === 'ar' ? exam.titleAr || exam.title : exam.title || exam.titleAr) || '';
}

/** The subject's name, or null for an id the catalog no longer has. */
export function subjectLabel(subjectId: string, lang: 'ar' | 'en'): string | null {
  const s = SUBJECTS.find(x => x.id === subjectId);
  if (!s) return null;
  return (lang === 'ar' ? s.nameAr : s.name) || null;
}

/**
 * The list as two sections. «القادمة» is what can still be sat — soonest planned
 * day first, undated after the dated ones. «السابقة» is everything handed in or
 * over, newest first. The server already orders by state, so each section only
 * needs its own tiebreak; a stable sort keeps that order among equals.
 */
export function splitMyExams(exams: readonly MyExam[]): { upcoming: MyExam[]; past: MyExam[] } {
  const upcoming = exams.filter(e => e.state === 'available' || e.state === 'in_progress');
  const past = exams.filter(e => e.state !== 'available' && e.state !== 'in_progress');
  upcoming.sort((a, b) => {
    if (a.examDate && b.examDate) return a.examDate.localeCompare(b.examDate) || (a.examTime ?? '').localeCompare(b.examTime ?? '');
    if (a.examDate) return -1;
    if (b.examDate) return 1;
    return 0;
  });
  past.sort((a, b) => (b.submittedAt ?? b.publishedAt ?? '').localeCompare(a.submittedAt ?? a.publishedAt ?? ''));
  return { upcoming, past };
}

export interface SubjectAverage {
  subjectId: string;
  /** Rounded 0–100. */
  percent: number;
  count: number;
}

export interface ProgressSummary {
  /** Papers whose result the teacher has released. */
  taken: number;
  /** Rounded 0–100, or null when there is nothing released to average. */
  averagePercent: number | null;
  bySubject: SubjectAverage[];
}

/**
 * Where the student stands, from released results only. A row is `result`
 * only when the server's release rule passed, so a paper still waiting on the
 * teacher contributes nothing — not even to the count.
 */
export function progressSummary(exams: readonly MyExam[]): ProgressSummary {
  const done = exams.filter((e): e is MyExam & { result: NonNullable<MyExam['result']> } => e.state === 'result' && e.result !== null);
  if (done.length === 0) return { taken: 0, averagePercent: null, bySubject: [] };
  const sums = new Map<string, { total: number; count: number }>();
  for (const e of done) {
    const s = sums.get(e.subjectId) ?? { total: 0, count: 0 };
    s.total += e.result.percent;
    s.count += 1;
    sums.set(e.subjectId, s);
  }
  const bySubject = [...sums].map(([subjectId, s]) => ({ subjectId, percent: Math.round(s.total / s.count), count: s.count }));
  bySubject.sort((a, b) => b.count - a.count || a.subjectId.localeCompare(b.subjectId));
  return {
    taken: done.length,
    averagePercent: Math.round(done.reduce((n, e) => n + e.result.percent, 0) / done.length),
    bySubject,
  };
}

/** How many rows want something from the student now — for the entry tile. */
export function actionableCount(exams: readonly MyExam[]): number {
  return exams.filter(e => myExamAction(e) === 'start' || myExamAction(e) === 'continue').length;
}

/**
 * The facts under a row's title — subject, the exam day, when it was sent, the
 * limit, the marks — as separate pieces for a wrapping row, in order, with the
 * empty ones dropped. The row spaces them with a gap and draws no separator
 * character: a joined string under `numberOfLines` was cut mid-text («· 10 …»)
 * once the exam day joined it, and a « ·» glued to the end of each piece left a
 * line ending in a dangling dot wherever the row wrapped. With spacing only, no
 * line can begin or end on punctuation, and a piece wider than the row still
 * wraps inside itself.
 */
export function metaSegments(parts: readonly (string | null | undefined | false)[]): string[] {
  return parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '');
}

/**
 * How a state is coloured, by meaning rather than by hex: the screens map a
 * tone onto the live palette (`colors[tone]`, `mutedForeground` for `muted`) so
 * dark mode follows. «waiting» is blue, a released result green, an exam that
 * ended unsent red, and amber is left to «now» (see CLAUDE.md, *Amber*).
 */
export type ExamTone = 'primary' | 'warning' | 'info' | 'success' | 'destructive' | 'muted';

export const EXAM_STATE_TONE: Record<MyExamState, ExamTone> = {
  available: 'primary',
  in_progress: 'warning',
  submitted: 'info',
  result: 'success',
  closed: 'destructive',
  paper: 'muted',
};

/**
 * What each state says to a parent. «مُغلق» alone read as "locked"; the server's
 * `closed` is "the exam is over and nothing was handed in" (it cannot tell a
 * missed paper from one the teacher closed early), so the label says exactly
 * that and no more. Gender-neutral: the child may be a son or a daughter.
 */
export const PARENT_EXAM_STATE_KEY = {
  available: 'childResultsStateAvailable',
  in_progress: 'childResultsStateInProgress',
  submitted: 'childResultsStateSubmitted',
  result: 'myExamsStateResult',
  closed: 'childResultsStateClosed',
  paper: 'myExamsStatePaper',
} as const satisfies Record<MyExamState, string>;

const MONTHS_AR = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * An exam day's parts, read from the text — never through `Date`, which moves
 * a plain calendar day in any zone west of UTC. Null for anything that is not
 * a real 'YYYY-MM-DD'.
 */
export function examDayParts(ymd: string | null | undefined, lang: 'ar' | 'en'): { day: string; month: string; year: string } | null {
  const m = typeof ymd === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd) : null;
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { day: String(day), month: (lang === 'ar' ? MONTHS_AR : MONTHS_EN)[month - 1]!, year: m[1]! };
}

/** «11 تشرين الثاني 2026» — the one date style the family screens use for an exam day. */
export function formatExamDay(ymd: string | null | undefined, lang: 'ar' | 'en'): string | null {
  const p = examDayParts(ymd, lang);
  return p ? `${p.day} ${p.month} ${p.year}` : null;
}

export interface ChildExamCounts {
  /** Result released. */
  ready: number;
  /** Handed in, or sat on paper, and the teacher has not released a mark. */
  waiting: number;
  /** Still open to sit (not started, or started and not handed in). */
  open: number;
  /** Over, and nothing was handed in. */
  missed: number;
}

export function childExamCounts(exams: readonly Pick<MyExam, 'state'>[]): ChildExamCounts {
  const c: ChildExamCounts = { ready: 0, waiting: 0, open: 0, missed: 0 };
  for (const e of exams) {
    if (e.state === 'result') c.ready++;
    else if (e.state === 'submitted' || e.state === 'paper') c.waiting++;
    else if (e.state === 'available' || e.state === 'in_progress') c.open++;
    else c.missed++;
  }
  return c;
}

/** n × noun, with Arabic's one / two / 3–10 / 11+ forms. */
function arForms(n: number, one: string, two: string, few: (n: number) => string, many: (n: number) => string): string {
  return n === 1 ? one : n === 2 ? two : n <= 10 ? few(n) : many(n);
}

/**
 * One line under a child's name: what needs a parent's eye first. Empty for a
 * child with no exams (the screen says «لا اختبارات بعد» itself).
 */
export function childSummaryLine(exams: readonly Pick<MyExam, 'state'>[], lang: 'ar' | 'en'): string {
  const c = childExamCounts(exams);
  const parts: string[] = [];
  if (lang === 'ar') {
    if (c.ready) parts.push(arForms(c.ready, 'نتيجة واحدة جاهزة', 'نتيجتان جاهزتان', n => `${n} نتائج جاهزة`, n => `${n} نتيجة جاهزة`));
    if (c.waiting) parts.push(arForms(c.waiting, 'اختبار واحد بانتظار المعلّم', 'اختباران بانتظار المعلّم', n => `${n} اختبارات بانتظار المعلّم`, n => `${n} اختبارًا بانتظار المعلّم`));
    if (c.open) parts.push(arForms(c.open, 'اختبار واحد مفتوح', 'اختباران مفتوحان', n => `${n} اختبارات مفتوحة`, n => `${n} اختبارًا مفتوحًا`));
    if (c.missed) parts.push(arForms(c.missed, 'اختبار واحد لم يُسلَّم', 'اختباران لم يُسلَّما', n => `${n} اختبارات لم تُسلَّم`, n => `${n} اختبارًا لم يُسلَّم`));
  } else {
    const exam = (n: number) => (n === 1 ? 'exam' : 'exams');
    if (c.ready) parts.push(`${c.ready} ${c.ready === 1 ? 'result' : 'results'} ready`);
    if (c.waiting) parts.push(`${c.waiting} ${exam(c.waiting)} waiting for the teacher`);
    if (c.open) parts.push(`${c.open} open ${exam(c.open)}`);
    if (c.missed) parts.push(`${c.missed} ${exam(c.missed)} not handed in`);
  }
  return parts.join(' · ');
}
