/**
 * What a student is allowed to see, and how they are let in.
 *
 * Two separate jobs, kept in one place because both are the boundary between
 * a teacher's data and a device nobody owns.
 *
 * The sanitiser is **the** control on answer keys. Hiding `expectedAnswer` in
 * the client is not a control — the payload arrives on the student's phone
 * either way, and a browser devtools tab is all it takes. So the projection is
 * built by naming the fields that may leave, never by deleting the ones that
 * may not: a question type added later inherits the safe default instead of
 * quietly leaking a new field nobody remembered to strip.
 */
import crypto from "node:crypto";

/**
 * No I, L, O, 0 or 1. A teacher writes this on a whiteboard and thirty
 * students read it from the back of the room; a code that can be read two ways
 * is a code that produces "not found" and a raised hand.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateShareCode(): string {
  // rejection-free: 31 does not divide 256, so a plain modulo would bias the
  // first few letters. randomInt is uniform and this is not a hot path.
  return Array.from({ length: CODE_LENGTH }, () =>
    ALPHABET[crypto.randomInt(ALPHABET.length)],
  ).join("");
}

/**
 * Accepts what a student actually types: lower case, spaces, the dash they add
 * because it looks like a code. Anything outside the alphabet is dropped rather
 * than guessed at — mapping `O` to `0` would be inventing an intent.
 */
export function normalizeShareCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .toUpperCase()
    .split("")
    .filter(c => ALPHABET.includes(c))
    .join("");
}

export function hashAccessToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function issueAccessToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: hashAccessToken(token) };
}

/** Everything a student needs to answer a question, and nothing else. */
export interface StudentQuestion {
  id: string;
  orderIndex: number;
  type: string;
  marks: string;
  body: Record<string, unknown>;
}

/**
 * Body fields that are safe to show, per question type. An allowlist, because
 * the alternative — copying the body and deleting the dangerous keys — fails
 * open the first time a question type gains a field.
 */
const SAFE_BODY_FIELDS: Record<string, readonly string[]> = {
  multiple_choice: ["stem", "options", "multiSelect"],
  true_false: ["statement"],
  matching: ["left", "right", "instructions"],
  fill_blank: ["template", "wordBank", "instructions"],
  short_answer: ["prompt"],
  open_ended: ["prompt"],
  problem_solving: ["prompt", "scenario"],
  practical_task: ["prompt", "scenario", "materials"],
};

/**
 * An option carries the answer in `isCorrect` on some generators. Strip every
 * key that is not needed to render the choice, for the same allowlist reason.
 */
function safeOption(option: unknown): unknown {
  if (!option || typeof option !== "object") return option;
  const o = option as Record<string, unknown>;
  return { id: o["id"], text: o["text"] };
}

export function sanitizeQuestionForStudent(question: {
  id: string;
  orderIndex: number;
  type: string;
  marks: unknown;
  body: Record<string, unknown> | null | undefined;
}): StudentQuestion {
  const allowed = SAFE_BODY_FIELDS[question.type] ?? ["prompt", "stem", "statement"];
  const source = question.body ?? {};
  const body: Record<string, unknown> = {};

  for (const key of allowed) {
    if (!(key in source)) continue;
    const value = source[key];
    body[key] =
      (key === "options" || key === "left" || key === "right") && Array.isArray(value)
        ? value.map(safeOption)
        : value;
  }

  return {
    id: question.id,
    orderIndex: question.orderIndex,
    type: question.type,
    marks: String(question.marks),
    body,
  };
}
