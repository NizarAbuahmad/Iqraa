/**
 * What a student may write to their own paper, and for how long.
 *
 * `PUT /take/attempt/answers/:questionId` used to store any JSON object for any
 * question in the snapshot. Two things were wrong with that, and both are
 * closed here rather than in the route so they can be asserted by test:
 *
 * - A read-aloud answer is **composed by the server**: the upload route stores
 *   the audio, transcribes it, and writes `{ audioKey, transcript, takes }`.
 *   A client that can overwrite that row can hand in the passage as its own
 *   transcript (full marks) and set `takes` back to zero (unlimited paid
 *   transcriptions). So a read-aloud question is not writable here at all.
 * - Every other type is projected onto the keys its grader reads, with the
 *   value types the grader expects. Unknown keys are dropped, not refused —
 *   a client that sends `{ text, draftAt }` has not done anything wrong.
 *
 * The deadline lives here too: `timeLimitMin` used to be shown to the teacher
 * and enforced nowhere, so a twenty-minute quiz accepted answers for the six
 * hours the token lasts. The grace period is for the last autosave — a save
 * fired at 19:59 that arrives at 20:01 is the student's answer, not a late
 * edit.
 */

export const MAX_TEXT_CHARS = 20_000;
const MAX_LIST = 200;

type Accepted = { ok: true; response: Record<string, unknown> };
type Refused = { ok: false; status: number; code: string; error: string };

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX_LIST) : [];

export function acceptStudentResponse(type: string, raw: unknown): Accepted | Refused {
  if (type === "read_aloud") {
    return {
      ok: false,
      status: 400,
      code: "not_writable",
      error: "A recording is uploaded, not saved",
    };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, status: 400, code: "bad_response", error: "response must be an object" };
  }
  const r = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  switch (type) {
    case "multiple_choice":
      if ("optionIds" in r) out["optionIds"] = strings(r["optionIds"]);
      return { ok: true, response: out };

    case "true_false":
      if (typeof r["value"] === "boolean") out["value"] = r["value"];
      return { ok: true, response: out };

    case "matching":
      if (Array.isArray(r["pairs"])) {
        out["pairs"] = (r["pairs"] as unknown[])
          .filter(
            (p): p is { left: string; right: string } =>
              !!p &&
              typeof p === "object" &&
              typeof (p as Record<string, unknown>)["left"] === "string" &&
              typeof (p as Record<string, unknown>)["right"] === "string",
          )
          .map(p => ({ left: p.left, right: p.right }))
          .slice(0, MAX_LIST);
      }
      return { ok: true, response: out };

    case "fill_blank":
      if (Array.isArray(r["blanks"])) {
        // Positions matter: `fill_blank.grade` reads blanks[i] against the
        // i-th placeholder, so a non-string is blanked, never dropped.
        out["blanks"] = (r["blanks"] as unknown[])
          .slice(0, MAX_LIST)
          .map(b => (typeof b === "string" ? b.slice(0, MAX_TEXT_CHARS) : ""));
      }
      return { ok: true, response: out };

    case "dictation":
      if (typeof r["text"] === "string") {
        if (r["text"].length > MAX_TEXT_CHARS) return tooLong();
        out["text"] = r["text"];
      }
      if ("optionIds" in r) out["optionIds"] = strings(r["optionIds"]);
      if (typeof r["played"] === "number" && Number.isFinite(r["played"])) {
        out["played"] = Math.max(0, Math.floor(r["played"]));
      }
      return { ok: true, response: out };

    default:
      // short_answer, open_ended, problem_solving, practical_task — and any
      // type this file has never heard of, which gets the narrowest shape
      // rather than pass-through.
      if (typeof r["text"] === "string") {
        if (r["text"].length > MAX_TEXT_CHARS) return tooLong();
        out["text"] = r["text"];
      }
      return { ok: true, response: out };
  }
}

function tooLong(): Refused {
  return { ok: false, status: 413, code: "too_long", error: "That answer is too long" };
}

/** Default grace after the limit during which a late-arriving save still lands. */
export const DEADLINE_GRACE_MS = 60_000;

export function examDeadline(
  startedAt: Date | null | undefined,
  timeLimitMin: number | null | undefined,
  graceMs: number = DEADLINE_GRACE_MS,
): Date | null {
  if (!startedAt || !timeLimitMin || timeLimitMin <= 0) return null;
  return new Date(startedAt.getTime() + timeLimitMin * 60_000 + graceMs);
}

export function isPastDeadline(deadline: Date | null, now: Date = new Date()): boolean {
  return deadline !== null && now.getTime() > deadline.getTime();
}
