/**
 * The pure half of a saved material's share link (spec
 * docs/superpowers/specs/2026-11-20-material-share-link-design.md). The reads
 * and the copy are in lib/sharedMaterial.ts; the routes in routes/sharedMaterials.ts
 * and routes/workspace.ts.
 */
import crypto from "node:crypto";

import { SHARE_CODE_ALPHABET } from "./shareCodeAlphabet.ts";

/**
 * Two more than an exam's code. An exam link expires in 7 days; this one lives
 * until the teacher stops it, and it travels in WhatsApp messages that get
 * forwarded. 31⁸ ≈ 8.5 × 10¹¹, behind a per-IP rate limit.
 */
export const MATERIAL_SHARE_CODE_LENGTH = 8;

export function generateMaterialShareCode(): string {
  return Array.from({ length: MATERIAL_SHARE_CODE_LENGTH }, () =>
    SHARE_CODE_ALPHABET[crypto.randomInt(SHARE_CODE_ALPHABET.length)],
  ).join("");
}

const CODE_RE = new RegExp(`^[${SHARE_CODE_ALPHABET}]{${MATERIAL_SHARE_CODE_LENGTH}}$`);

/** Upper-cased and trimmed, or null unless it is exactly a code. */
export function normalizeMaterialShareCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/**
 * Free text a teacher typed into a generator's form. Saved with the material so
 * its owner can reopen the form, and never handed to anyone else: a lesson
 * plan's `adaptations` can name a pupil.
 */
const FREE_TEXT_KEYS = new Set(["priorTopicsNotes", "adaptations", "objectives", "objective", "notes", "additionalContext"]);
const MAX_KEPT_STRING = 200;

/**
 * The part of the owner's `formState` a colleague's copy may keep: the pickers
 * (grade, subject, lesson, scope, counts), which reopen the right lesson in the
 * tool. Only primitives, no known free-text field, and no long string — the
 * last is the catch for a free-text field added after this list.
 */
export function copyableFormState(formState: unknown): Record<string, string | number | boolean> {
  if (typeof formState !== "object" || formState === null || Array.isArray(formState)) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(formState)) {
    if (FREE_TEXT_KEYS.has(k)) continue;
    if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (typeof v === "string" && v.length <= MAX_KEPT_STRING) out[k] = v;
  }
  return out;
}
