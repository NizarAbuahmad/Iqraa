/**
 * A teacher's optional «عنك» answers — gender, age range, governorate, years teaching — for the
 * admin insights page (docs/superpowers/specs/2026-11-19-admin-user-insights-design.md).
 *
 * Every field is one value from a closed list, or null for "not answered"; never free text, so
 * nothing personal beyond the bucket is stored and the admin breakdowns group cleanly. The app's
 * copy of these lists (artifacts/mobile/services/teacherProfile.ts) is pinned equal to this file
 * by its test. Only teacher roles may set them — `PATCH /auth/users/profile` checks the role
 * before calling `parseTeacherProfile`.
 *
 * Pure — no database import — so `node --test` can load it.
 */

export const TEACHER_PROFILE_OPTIONS = {
  gender: ["male", "female", "unspecified"],
  ageRange: ["20-29", "30-39", "40-49", "50+"],
  governorate: [
    "amman",
    "irbid",
    "zarqa",
    "balqa",
    "mafraq",
    "karak",
    "jerash",
    "madaba",
    "ajloun",
    "aqaba",
    "maan",
    "tafilah",
  ],
  yearsTeaching: ["0-2", "3-5", "6-10", "11+"],
} as const satisfies Record<string, readonly string[]>;

export type TeacherProfileField = keyof typeof TEACHER_PROFILE_OPTIONS;
export const TEACHER_PROFILE_FIELDS = Object.keys(TEACHER_PROFILE_OPTIONS) as TeacherProfileField[];

export type TeacherProfile = Record<TeacherProfileField, string | null>;

export type ParsedTeacherProfile =
  | { ok: true; updates: Partial<TeacherProfile> }
  | { ok: false; error: string };

/**
 * The `teacherProfile` object of a profile update. A field set to a listed value is saved, `null`
 * clears it, an absent field is left alone; any other value refuses the whole update.
 */
export function parseTeacherProfile(raw: unknown): ParsedTeacherProfile {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "teacherProfile must be an object" };
  }
  const input = raw as Record<string, unknown>;
  const updates: Partial<TeacherProfile> = {};
  for (const field of TEACHER_PROFILE_FIELDS) {
    if (!(field in input)) continue;
    const value = input[field];
    if (value === null) {
      updates[field] = null;
      continue;
    }
    const allowed: readonly string[] = TEACHER_PROFILE_OPTIONS[field];
    if (typeof value !== "string" || !allowed.includes(value)) {
      return { ok: false, error: `teacherProfile.${field} must be one of: ${allowed.join(", ")}` };
    }
    updates[field] = value;
  }
  return { ok: true, updates };
}

/** The four columns of a user row, as the `teacherProfile` object the app reads. */
export function teacherProfileOf(user: {
  gender: string | null;
  ageRange: string | null;
  governorate: string | null;
  yearsTeaching: string | null;
}): TeacherProfile {
  return {
    gender: user.gender,
    ageRange: user.ageRange,
    governorate: user.governorate,
    yearsTeaching: user.yearsTeaching,
  };
}
