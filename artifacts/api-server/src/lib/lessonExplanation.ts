/**
 * What a student may see of a stored `lesson-teaching` artifact, and which
 * stored row they are given.
 *
 * Pure on purpose: no database and no OpenAI client, both of which throw at
 * module scope without their env vars and would make this untestable under
 * `node --test` (CLAUDE.md). The route and the store are thin shells around it.
 *
 * Students are only ever served what a `system_admin` approved
 * (`ai_artifacts.student_approved_at`); the store filters on that, so every
 * row reaching `pickExplanation` is already approved and live.
 */

export type ExplanationRow = {
  id: string;
  createdAt: Date;
  timesServed: number;
  content: unknown;
};

/**
 * The newest row wins, so rerunning the prefill after a prompt bump replaces
 * the old text instead of splitting students across versions. Rows created at
 * the same instant go to the least-served, as the teacher pool does.
 */
export function pickExplanation(rows: readonly ExplanationRow[]): ExplanationRow | null {
  if (rows.length === 0) return null;
  return [...rows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.timesServed - b.timesServed,
  )[0]!;
}

/**
 * `teacherNote` is stage direction for whoever is projecting the slide
 * («ابدأ بسؤال…»). A student reading alone has no use for it and it reads as
 * an instruction to someone else. Removed at every depth; nothing else is.
 */
export function stripTeacherNotes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTeacherNotes);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (key === "teacherNote") continue;
      out[key] = stripTeacherNotes(inner);
    }
    return out;
  }
  return value;
}

const LESSON_REF = /^[A-Za-z0-9_.:-]{1,120}$/;

/** Shape only. The KB lesson list lives in the mobile app, and an id that is
 *  not a lesson can only ever match an approved row, of which there are none. */
export function isLessonRef(value: unknown): value is string {
  return typeof value === "string" && LESSON_REF.test(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** The prompt builders' own rule (`language !== "english"`): anything but
 *  'english' is keyed as Arabic. See `generationKeys`. */
export function parseLanguage(value: unknown): "arabic" | "english" {
  return value === "english" ? "english" : "arabic";
}

export const APPROVE_MAX = 200;

/** `{ variantIds: string[] }` with 1..200 uuids; lower-cased and de-duplicated. */
export function parseApproveBody(body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const ids = (body as { variantIds?: unknown }).variantIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > APPROVE_MAX) return null;
  if (!ids.every(isUuid)) return null;
  return [...new Set((ids as string[]).map((id) => id.toLowerCase()))];
}
