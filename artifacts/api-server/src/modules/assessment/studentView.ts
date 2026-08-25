/**
 * What a student is allowed to see, and how they are let in.
 *
 * Two separate jobs, kept in one place because both are the boundary between
 * a teacher's data and a device nobody owns.
 *
 * The sanitiser is **the** control on answer keys. Hiding `expectedAnswer` in
 * the client is not a control — the payload arrives on the student's phone
 * either way, and a browser devtools tab is all it takes.
 *
 * The projection itself is **not defined here**. Every entry in
 * `QUESTION_TYPES` already carries a `sanitizeForStudent`, declared in the same
 * object as its `validate` and `grade`, and the interface states it must never
 * include answers or rubric. Delegating to it means a new question type defines
 * its student view exactly once, beside the rest of its behaviour — a second
 * copy in this file would be one more place to forget, and the two would
 * disagree the first time a type gained a field.
 *
 * The local allowlist below survives only as the fallback for a type the
 * registry does not know, where failing safe matters more than completeness.
 */
import crypto from "node:crypto";
import { QUESTION_TYPES } from "./questionTypes.ts";

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
 * Fallback allowlist, used only when the type registry has never heard of this
 * question type. Deliberately meagre: a prompt and nothing else, because the
 * one thing worth guaranteeing about an unrecognised type is that it cannot
 * leak a field this file has never seen.
 */
const FALLBACK_BODY_FIELDS: readonly string[] = ["prompt", "stem", "statement"];

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
  const source = question.body ?? {};
  const typeModule = QUESTION_TYPES[question.type as keyof typeof QUESTION_TYPES];

  let body: Record<string, unknown>;
  if (typeModule) {
    body = typeModule.sanitizeForStudent({
      type: question.type as never,
      body: source,
      expectedAnswer: {},
      rubric: null,
    });
  } else {
    body = {};
    for (const key of FALLBACK_BODY_FIELDS) {
      if (key in source) body[key] = source[key];
    }
  }

  // Belt and braces on the one field that carries correctness inside itself.
  // The registry's projections already do this; re-doing it costs nothing and
  // means a future projection that forgets cannot leak through here.
  for (const key of ["options", "left", "right"]) {
    if (Array.isArray(body[key])) body[key] = (body[key] as unknown[]).map(safeOption);
  }

  return {
    id: question.id,
    orderIndex: question.orderIndex,
    type: question.type,
    marks: String(question.marks),
    body,
  };
}
