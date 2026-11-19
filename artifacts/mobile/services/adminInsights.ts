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

export interface BreakdownRow { key: string; count: number | null }
export interface Breakdown { answered: number | null; unanswered: number; rows: BreakdownRow[] }

export interface Insights {
  days: number;
  since: string;
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
