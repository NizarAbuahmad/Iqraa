/**
 * The rules for homework that need no database: reading a teacher's input,
 * converting between the calendar day a teacher means and the instant we store,
 * and deciding what state an item is in.
 *
 * The school day is Asia/Amman. Jordan stopped changing its clocks in 2022 and
 * sits at a fixed UTC+3, so "end of the due day" is 20:59:59.999Z of that date
 * — no tz database needed, and no client ever converts a due date itself.
 */
export const TITLE_MAX = 120;
export const INSTRUCTIONS_MAX = 2000;
/** Attached Library items per homework. */
export const RESOURCES_MAX = 10;
/** Families see homework due this many days ago or later; older work drops off. */
export const FAMILY_WINDOW_DAYS = 14;
export const FAMILY_LIMIT = 200;

const AMMAN_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// Copied from lib/classResource.ts rather than imported: that file pulls in
// @workspace/curriculum, which `node --test` cannot load.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** `YYYY-MM-DD` that names a real day → that day's last millisecond in Amman; else null. */
export function dueDateToDueAt(date: unknown): Date | null {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const probe = new Date(Date.UTC(y, m - 1, d));
  // Date.UTC rolls 2026-02-30 into March; a real date survives the round trip.
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - AMMAN_OFFSET_MS);
}

/** The Amman calendar date an instant falls on, as `YYYY-MM-DD`. */
export function dueAtToDueDate(dueAt: Date): string {
  return new Date(dueAt.getTime() + AMMAN_OFFSET_MS).toISOString().slice(0, 10);
}

export type HomeworkState = "done" | "overdue" | "open";

export function homeworkState(input: { dueAt: Date; done: boolean; now: Date }): HomeworkState {
  if (input.done) return "done";
  return input.now.getTime() > input.dueAt.getTime() ? "overdue" : "open";
}

/** How far back and ahead a teacher may set a due date, in Amman calendar days from today (inclusive). */
export const DUE_PAST_DAYS = 30;
export const DUE_FUTURE_DAYS = 366;
const DUE_RANGE_ERROR = `dueDate must be within the last ${DUE_PAST_DAYS} days and the next year`;

/** `YYYY-MM-DD` plus `days` calendar days (negative goes back). Pure date arithmetic, no clock. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * A due date is in range when, as an Amman calendar day, it falls between
 * today - 30 days and today + 366 days inclusive ("today" being the Amman date
 * of `now`). Judged on the day, not the instant, so it reads the way a teacher
 * counts. Only a cap against typos like 2062: it does not stop a deliberate
 * far-off date inside the year.
 */
function dueDateInRange(date: string, now: Date): boolean {
  const today = dueAtToDueDate(now);
  return date >= addDays(today, -DUE_PAST_DAYS) && date <= addDays(today, DUE_FUTURE_DAYS);
}

export function familyCutoff(now: Date): Date {
  return new Date(now.getTime() - FAMILY_WINDOW_DAYS * DAY_MS);
}

export interface CreateInput {
  classGroupId: string;
  title: string;
  instructions: string;
  dueAt: Date;
  evaluationId: string | null;
  /** Raw items, each checked by the route (parseClassResourceInput needs @workspace/curriculum). */
  resources: unknown[];
}
export interface PatchInput {
  title?: string;
  instructions?: string;
  dueAt?: Date;
  evaluationId?: string | null;
  resources?: unknown[];
}
/** `code` is a machine-readable reason a client can branch on; absent for the ordinary field errors. */
type Parsed<T> = { ok: true; value: T } | { ok: false; error: string; code?: string };

/** Machine code for a due date outside the allowed window (POST and PATCH 400 bodies carry it next to `error`). */
export const DUE_RANGE_CODE = "due_date_out_of_range";
const DUE_RANGE_FAIL = { ok: false, error: DUE_RANGE_ERROR, code: DUE_RANGE_CODE } as const;

function record(body: unknown): Record<string, unknown> | null {
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

function parseTitle(v: unknown): Parsed<string> {
  if (typeof v !== "string" || v.trim() === "") return { ok: false, error: "title is required" };
  const t = v.trim();
  if (t.length > TITLE_MAX) return { ok: false, error: `title must be at most ${TITLE_MAX} characters` };
  return { ok: true, value: t };
}
function parseInstructions(v: unknown): Parsed<string> {
  if (typeof v !== "string") return { ok: false, error: "instructions must be text" };
  const t = v.trim();
  if (t.length > INSTRUCTIONS_MAX) return { ok: false, error: `instructions must be at most ${INSTRUCTIONS_MAX} characters` };
  return { ok: true, value: t };
}
function parseEvaluationId(v: unknown): Parsed<string | null> {
  if (v === null || v === "") return { ok: true, value: null };
  return isUuid(v) ? { ok: true, value: v } : { ok: false, error: "evaluationId must be an exam id or null" };
}

function parseResources(v: unknown): Parsed<unknown[]> {
  if (!Array.isArray(v)) return { ok: false, error: "resources must be a list" };
  if (v.length > RESOURCES_MAX) return { ok: false, error: `at most ${RESOURCES_MAX} resources` };
  return { ok: true, value: v };
}

export function parseCreate(body: unknown, now: Date = new Date()): Parsed<CreateInput> {
  const b = record(body);
  if (!b) return { ok: false, error: "A JSON object is required" };
  if (!isUuid(b["classGroupId"])) return { ok: false, error: "classGroupId is required" };
  const title = parseTitle(b["title"]);
  if (!title.ok) return title;
  const instructions = b["instructions"] === undefined ? ({ ok: true, value: "" } as const) : parseInstructions(b["instructions"]);
  if (!instructions.ok) return instructions;
  const dueAt = dueDateToDueAt(b["dueDate"]);
  if (!dueAt) return { ok: false, error: "dueDate must be a real date, YYYY-MM-DD" };
  if (!dueDateInRange(b["dueDate"] as string, now)) return DUE_RANGE_FAIL;
  const evaluationId = b["evaluationId"] === undefined ? ({ ok: true, value: null } as const) : parseEvaluationId(b["evaluationId"]);
  if (!evaluationId.ok) return evaluationId;
  const resources = parseResources(b["resources"] ?? []);
  if (!resources.ok) return resources;
  return {
    ok: true,
    value: {
      classGroupId: b["classGroupId"],
      title: title.value,
      instructions: instructions.value,
      dueAt,
      evaluationId: evaluationId.value,
      resources: resources.value,
    },
  };
}

/**
 * `existing` is the stored row. A due date on the same Amman calendar day as the
 * stored one (not the same instant: a row from SQL or an import may hold any
 * time of day) is not
 * re-bounded: the mobile edit form always resends the date, so bounding it
 * would make every edit of a homework due more than 30 days ago a 400 — a
 * teacher could not fix a typo in an old one. A CHANGED date is still bounded.
 */
export function parsePatch(body: unknown, now: Date = new Date(), existing?: { dueAt: Date }): Parsed<PatchInput> {
  const b = record(body);
  if (!b) return { ok: false, error: "A JSON object is required" };
  const out: PatchInput = {};
  if (b["title"] !== undefined) {
    const r = parseTitle(b["title"]);
    if (!r.ok) return r;
    out.title = r.value;
  }
  if (b["instructions"] !== undefined) {
    const r = parseInstructions(b["instructions"]);
    if (!r.ok) return r;
    out.instructions = r.value;
  }
  if (b["dueDate"] !== undefined) {
    const d = dueDateToDueAt(b["dueDate"]);
    if (!d) return { ok: false, error: "dueDate must be a real date, YYYY-MM-DD" };
    const unchanged = existing !== undefined && dueAtToDueDate(existing.dueAt) === dueAtToDueDate(d);
    if (!unchanged && !dueDateInRange(b["dueDate"] as string, now)) return DUE_RANGE_FAIL;
    out.dueAt = d;
  }
  if (b["evaluationId"] !== undefined) {
    const r = parseEvaluationId(b["evaluationId"]);
    if (!r.ok) return r;
    out.evaluationId = r.value;
  }
  if (b["resources"] !== undefined) {
    const r = parseResources(b["resources"]);
    if (!r.ok) return r;
    out.resources = r.value;
  }
  if (Object.keys(out).length === 0) return { ok: false, error: "Nothing to change" };
  return { ok: true, value: out };
}
