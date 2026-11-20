/**
 * A teacher's optional «عنك» answers — gender, age range, governorate, years teaching — shown on
 * app/teacher-profile.tsx and saved through `PATCH /auth/users/profile` as `teacherProfile`.
 * They feed the admin insights page's "who the teachers are" breakdowns.
 *
 * Every field is a value from a closed list, or null for "not answered". The lists must equal the
 * API's (artifacts/api-server/src/lib/teacherProfile.ts) — `teacherProfileOptions.test.ts` reads
 * that file and compares — or the server refuses the save. Only teacher accounts are ever asked;
 * the API refuses these fields from a student or parent.
 *
 * The option labels live here rather than in i18n.ts: they are a fixed table read only by the
 * one screen and the admin page. Pure — no react-native import.
 */
import type { Lang } from './i18n.ts';

export const TEACHER_PROFILE_OPTIONS = {
  gender: ['male', 'female', 'unspecified'],
  ageRange: ['20-29', '30-39', '40-49', '50+'],
  governorate: ['amman', 'irbid', 'zarqa', 'balqa', 'mafraq', 'karak', 'jerash', 'madaba', 'ajloun', 'aqaba', 'maan', 'tafilah'],
  yearsTeaching: ['0-2', '3-5', '6-10', '11+'],
} as const;

export type TeacherProfileField = keyof typeof TEACHER_PROFILE_OPTIONS;
export const TEACHER_PROFILE_FIELDS: readonly TeacherProfileField[] = ['gender', 'ageRange', 'governorate', 'yearsTeaching'];

export type TeacherProfile = Record<TeacherProfileField, string | null>;

export const EMPTY_TEACHER_PROFILE: TeacherProfile = { gender: null, ageRange: null, governorate: null, yearsTeaching: null };

const LABELS: Record<string, { ar: string; en: string }> = {
  male: { ar: 'ذكر', en: 'Male' },
  female: { ar: 'أنثى', en: 'Female' },
  unspecified: { ar: 'أفضّل ألّا أقول', en: 'Prefer not to say' },
  // Ranges are written in words in Arabic: «٢٠–٢٩» (Arabic-Indic digits around a dash) is
  // reordered by the bidi algorithm and shows as «٢٩-٢٠» (CLAUDE.md, «Arabic-Indic digits…»).
  '20-29': { ar: 'من ٢٠ إلى ٢٩', en: '20–29' },
  '30-39': { ar: 'من ٣٠ إلى ٣٩', en: '30–39' },
  '40-49': { ar: 'من ٤٠ إلى ٤٩', en: '40–49' },
  '50+': { ar: '٥٠ فأكثر', en: '50+' },
  amman: { ar: 'عمّان', en: 'Amman' },
  irbid: { ar: 'إربد', en: 'Irbid' },
  zarqa: { ar: 'الزرقاء', en: 'Zarqa' },
  balqa: { ar: 'البلقاء', en: 'Balqa' },
  mafraq: { ar: 'المفرق', en: 'Mafraq' },
  karak: { ar: 'الكرك', en: 'Karak' },
  jerash: { ar: 'جرش', en: 'Jerash' },
  madaba: { ar: 'مادبا', en: 'Madaba' },
  ajloun: { ar: 'عجلون', en: 'Ajloun' },
  aqaba: { ar: 'العقبة', en: 'Aqaba' },
  maan: { ar: 'معان', en: "Ma'an" },
  tafilah: { ar: 'الطفيلة', en: 'Tafilah' },
  '0-2': { ar: 'أقل من ٣ سنوات', en: 'Under 3 years' },
  '3-5': { ar: 'من ٣ إلى ٥ سنوات', en: '3–5 years' },
  '6-10': { ar: 'من ٦ إلى ١٠ سنوات', en: '6–10 years' },
  '11+': { ar: 'أكثر من ١٠ سنوات', en: 'Over 10 years' },
};

/** The display label of one option value; an unknown value is shown as is. */
export function teacherProfileLabel(value: string, lang: Lang): string {
  return LABELS[value]?.[lang] ?? value;
}

/**
 * What Save sends: only the fields the teacher touched on the screen, with their current value
 * (null = cleared). Sending every field would overwrite answers the screen had not loaded yet
 * with blanks — found in a browser on 2026-11-19, where a reload opened the screen before
 * /auth/me returned and Save erased two stored answers.
 */
export function changedTeacherProfile(
  answers: TeacherProfile,
  touched: ReadonlySet<TeacherProfileField>,
): Partial<TeacherProfile> {
  const out: Partial<TeacherProfile> = {};
  for (const f of TEACHER_PROFILE_FIELDS) if (touched.has(f)) out[f] = answers[f];
  return out;
}

/** The profile as the API sent it, or every field unanswered when absent (an older server). */
export function teacherProfileFrom(raw: Partial<TeacherProfile> | null | undefined): TeacherProfile {
  return {
    gender: raw?.gender ?? null,
    ageRange: raw?.ageRange ?? null,
    governorate: raw?.governorate ?? null,
    yearsTeaching: raw?.yearsTeaching ?? null,
  };
}
