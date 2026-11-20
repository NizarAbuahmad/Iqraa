/**
 * The admin insights screens' data and wording (app/admin/insights.tsx, insights-user.tsx):
 * the response types of GET /admin/insights and /admin/insights/users/:id
 * (api-server routes/adminInsights.ts), the names of usage areas, and how numbers are written.
 *
 * Operator UI, like the rest of app/admin: inline Arabic/English pairs rather than i18n keys.
 * Pure — no react-native import — so `node --test` can pin it.
 */
import type { UsageArea } from './usageAreas.ts';
import type { TeacherProfile } from './teacherProfile.ts';

export type InsightsDays = 7 | 30 | 90;
export const INSIGHTS_DAYS: readonly InsightsDays[] = [7, 30, 90];

/**
 * The page's role filter (`?role=`, api-server lib/insights.ts `INSIGHTS_ROLES`). A school admin
 * counts as a teacher; a system admin and an account marked internal are never counted.
 */
export type InsightsRole = 'all' | 'teacher' | 'student' | 'parent';
export const INSIGHTS_ROLES: readonly InsightsRole[] = ['all', 'teacher', 'student', 'parent'];

const ROLE_FILTER_NAMES: Record<InsightsRole, [string, string]> = {
  all: ['الكل', 'Everyone'],
  teacher: ['معلّمون', 'Teachers'],
  student: ['طلاب', 'Students'],
  parent: ['أولياء أمور', 'Parents'],
};

export function roleFilterLabel(role: InsightsRole, ar: boolean): string {
  return ROLE_FILTER_NAMES[role][ar ? 0 : 1];
}

/** The «who the teachers are» section describes teacher accounts, so it only fits these filters. */
export function showsTeacherSections(role: InsightsRole): boolean {
  return role === 'all' || role === 'teacher';
}

/**
 * The line under the filters saying who is left out of every number, whatever the role filter,
 * or '' when nobody is: «مستثنى من كل الأرقام: حساب لإدارة النظام و5 حسابات داخلية.»
 */
export function excludedNote(excluded: { admins: number; flagged: number }, ar: boolean): string {
  const { admins, flagged } = excluded;
  if (admins + flagged === 0) return '';
  if (!ar) {
    const parts = [
      admins ? `${admins} system admin account${admins === 1 ? '' : 's'}` : '',
      flagged ? `${flagged} internal account${flagged === 1 ? '' : 's'}` : '',
    ].filter(Boolean);
    return `Left out of every number: ${parts.join(' and ')}.`;
  }
  // Arabic counted-noun agreement by the last two digits: 3–10 plural, 11–99 accusative
  // singular, a round hundred (100, 200, 101…) genitive singular.
  const count = (n: number, one: string, two: string, few: string, acc: string, gen: string) => {
    if (n === 1) return one;
    if (n === 2) return two;
    const r = n % 100;
    if (r >= 3 && r <= 10) return `${n} ${few}`;
    if (r >= 11) return `${n} ${acc}`;
    return `${n} ${gen}`;
  };
  const parts = [
    admins
      ? count(admins, 'حساب لإدارة النظام', 'حسابان لإدارة النظام', 'حسابات لإدارة النظام', 'حسابًا لإدارة النظام', 'حساب لإدارة النظام')
      : '',
    flagged
      ? count(flagged, 'حساب داخلي واحد', 'حسابان داخليان', 'حسابات داخلية', 'حسابًا داخليًا', 'حساب داخلي')
      : '',
  ].filter(Boolean);
  return `مستثنى من كل الأرقام: ${parts.join(' و')}.`;
}

export interface BreakdownRow { key: string; count: number | null }
/** Both totals are null when any cell is hidden, so a hidden cell cannot be subtracted out. */
export interface Breakdown { answered: number | null; unanswered: number | null; rows: BreakdownRow[] }

export interface Insights {
  days: number;
  role: InsightsRole;
  since: string;
  /** Left out of every count, whatever the role filter. */
  excluded: { admins: number; flagged: number };
  trackingSince: string | null;
  time: {
    totalMinutes: number;
    avgMinutesPerActiveDay: number;
    byArea: { area: string; minutes: number; users: number }[];
    byDay: { day: string; minutes: number }[];
    byPlatform: { platform: string; minutes: number }[];
  };
  features: {
    generations: { kind: string; count: number; users: number }[];
    saved: { type: string; count: number; users: number }[];
    evaluations: number;
    homework: number;
    chatMessages: number;
  };
  retention: {
    active: number;
    returning: number;
    churned: number;
    cohorts: { week: string; size: number; active: number[] }[];
  };
  topUsers: {
    id: string;
    name: string;
    role: string;
    school: string | null;
    gradeIds: string[];
    subjectIds: string[];
    governorate: string | null;
    activeDays: number;
    minutes: number;
    topAreas: string[];
    generations: number;
    lastSeen: string | null;
  }[];
  likes: {
    byTool: { key: string; up: number; down: number }[];
    favourites: { type: string; count: number }[];
    subjects: Breakdown;
    grades: Breakdown;
  };
  teachers: {
    total: number;
    gender: Breakdown;
    ageRange: Breakdown;
    governorate: Breakdown;
    yearsTeaching: Breakdown;
    subjects: Breakdown;
    grades: Breakdown;
  };
}

export interface UserInsights {
  days: number;
  user: {
    id: string;
    name: string;
    email: string | null;
    role: string;
    school: string | null;
    gradeIds: string[];
    subjectIds: string[];
    teacherProfile: TeacherProfile;
    signupPlatform: string | null;
    /** Left out of the insights page: marked internal, or a system admin. */
    internal: boolean;
    createdAt: string;
    lastSeen: string | null;
  };
  activeDays: number;
  daily: { day: string; minutes: number; active: boolean }[];
  areas: { area: string; minutes: number }[];
  generations: { kind: string; count: number }[];
  saved: { type: string; count: number; favourites: number }[];
  feedback: { rating: string; toolId: string; materialType: string; comment: string; createdAt: string }[];
}

const AREA_NAMES: Record<UsageArea, [string, string]> = {
  'today': ['اليوم', 'Today'],
  'tools': ['قائمة الأدوات', 'Tools list'],
  'gen-quiz': ['مولّد الاختبار القصير', 'Quiz generator'],
  'gen-worksheet': ['مولّد ورقة العمل', 'Worksheet generator'],
  'gen-lesson-plan': ['مولّد خطة الدرس', 'Lesson plan generator'],
  'gen-activity': ['مولّد النشاط', 'Activity generator'],
  'gen-slides': ['مولّد العروض', 'Slides generator'],
  'gen-other': ['أدوات أخرى', 'Other tools'],
  'classroom': ['وضع الصف والسبورة', 'Classroom & whiteboard'],
  'chat': ['المساعد «إقرأ»', 'Iqrra assistant chat'],
  'curriculum': ['المنهاج', 'Curriculum'],
  'corner-math': ['ركن الرياضيات', 'Math corner'],
  'corner-lab': ['المختبر', 'Lab'],
  'corner-quran': ['ركن القرآن', 'Quran corner'],
  'corner-english': ['ركن الإنجليزية', 'English corner'],
  'play': ['الألعاب', 'Games'],
  'classes': ['الشُّعَب والطلبة', 'Classes & students'],
  'evaluations': ['الاختبارات', 'Exams'],
  'homework': ['مشاريع الواجبات', 'Homework projects'],
  'schedule': ['الجدول والتقويم', 'Schedule & calendar'],
  'teaching-plans': ['خطط التدريس', 'Teaching plans'],
  'workspace': ['مساحة العمل', 'Workspace'],
  'messaging': ['الرسائل', 'Messages'],
  'school': ['المدرسة (طالب/وليّ أمر)', 'School (student/parent)'],
  'notifications': ['الإشعارات', 'Notifications'],
  'profile': ['الملف الشخصي والإعدادات', 'Profile & settings'],
  'admin': ['لوحة الإدارة', 'Admin'],
  'other': ['أخرى', 'Other'],
};

/** A usage area's name; an area this build does not know is shown as is. */
export function areaLabel(area: string, ar: boolean): string {
  const names = AREA_NAMES[area as UsageArea];
  return names ? names[ar ? 0 : 1] : area;
}

const ROLE_NAMES: Record<string, [string, string]> = {
  teacher: ['معلّم', 'Teacher'],
  student: ['طالب', 'Student'],
  parent: ['وليّ أمر', 'Parent'],
  school_admin: ['إدارة مدرسة', 'School admin'],
  system_admin: ['إدارة النظام', 'System admin'],
};

export function roleName(role: string, ar: boolean): string {
  return ROLE_NAMES[role]?.[ar ? 0 : 1] ?? role;
}

/** «يوم» with Arabic number agreement: 1 يوم، 2 يومان، 3–10 أيام، 11+ يومًا. */
export function arDays(n: number): string {
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومان';
  return n >= 3 && n <= 10 ? `${n} أيام` : `${n} يومًا`;
}

/** The period picker's label: «آخر 7 أيام» / «آخر 30 يومًا» / "Last 30 days". */
export function periodLabel(days: number, ar: boolean): string {
  return ar ? `آخر ${arDays(days)}` : `Last ${days} days`;
}

/** An instant's Amman calendar day (fixed UTC+3), not its UTC day. */
export function ammanDayOf(iso: string): string {
  return new Date(Date.parse(iso) + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 135 → "2h 15m" / "2 س 15 د". */
export function formatMinutes(total: number, ar: boolean): string {
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  const [hu, mu] = ar ? [' س', ' د'] : ['h', 'm'];
  if (h === 0) return `${m}${mu}`;
  return m === 0 ? `${h}${hu}` : `${h}${hu} ${m}${mu}`;
}

export function share(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';
}

/** A breakdown count; a group of fewer than three people is hidden by the server. */
export function breakdownCell(count: number | null): string {
  return count === null ? '<3' : String(count);
}

export function cohortCell(active: number, size: number): string {
  return size > 0 ? `${Math.round((active / size) * 100)}%` : '';
}
