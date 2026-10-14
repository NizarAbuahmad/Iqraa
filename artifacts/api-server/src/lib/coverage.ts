/**
 * The coverage clause of a wide-scope quiz / worksheet / homework prompt.
 *
 * A semester has far more lessons than a paper has questions, so the app picks
 * which lessons get one (`planCoverage` in the mobile app) and sends the lesson
 * table with a short code per lesson. The prompt renders that plan as
 * per-lesson COUNTS rather than a slot order: a quiz is re-sorted into type
 * blocks and a worksheet into difficulty bands, so "question 3 is about L7"
 * cannot hold.
 *
 * Everything here is request-controlled, so it is validated and bounded; titles
 * are folded to one line and truncated. The clause is '' for anything that is
 * not a valid wide-scope request, which leaves every lesson prompt byte-for-byte
 * as it was.
 *
 * The `lesson` tag the model writes on each question is passed through, never
 * enforced: nothing server-side counts, trims or rejects on it.
 *
 * Imports nothing that touches the OpenAI client.
 */
import { parseWideScope } from "./grounding.ts";

const MAX_LESSONS = 120;       // an English book has 100
const MAX_SLOTS = 60;          // the largest paper is 30
const MAX_TITLE = 160;
const CODE = /^L\d{1,3}$/;

export interface CoverageTable {
  lessons: { code: string; title: string }[];
  /** Questions per lesson code for `balanced`, in table order; `null` for `random` (no assignment is sent). */
  counts: Map<string, number> | null;
}

function cleanTitle(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
}

export function parseCoverage(body: Record<string, unknown>): CoverageTable | null {
  if (!parseWideScope(body.scope)) return null;
  const raw = body.coverage;
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (!Array.isArray(c.lessons) || c.lessons.length === 0 || c.lessons.length > MAX_LESSONS) return null;

  const lessons: { code: string; title: string }[] = [];
  const seen = new Set<string>();
  for (const item of c.lessons) {
    if (typeof item !== "object" || item === null) return null;
    const code = String((item as Record<string, unknown>).code ?? "");
    const title = cleanTitle((item as Record<string, unknown>).title);
    if (!CODE.test(code) || seen.has(code) || title === "") return null;
    seen.add(code);
    lessons.push({ code, title });
  }

  let counts: Map<string, number> | null = null;
  // `distribution` is in the cache key, so the prompt must agree with it: a
  // random request is rendered as random even if slots came along.
  if (body.distribution !== "random" && Array.isArray(c.slots) && c.slots.length > 0 && c.slots.length <= MAX_SLOTS) {
    const tally = new Map<string, number>();
    for (const slot of c.slots) {
      const code = String(slot);
      if (seen.has(code)) tally.set(code, (tally.get(code) ?? 0) + 1);
    }
    // Table order, not slot order: the clause reads the same however the plan was shuffled.
    const ordered = new Map<string, number>();
    for (const l of lessons) {
      const n = tally.get(l.code);
      if (n) ordered.set(l.code, n);
    }
    if (ordered.size > 0) counts = ordered;
  }
  return { lessons, counts };
}

function tableLines(c: CoverageTable, isAr: boolean): string {
  const row = (l: { code: string; title: string }) => {
    const n = c.counts?.get(l.code);
    if (c.counts && !n) return null;
    const suffix = n ? (isAr ? ` — ${n} ${n === 1 ? "سؤال" : "أسئلة"}` : ` — ${n} question${n === 1 ? "" : "s"}`) : "";
    return `${l.code}: ${l.title}${suffix}`;
  };
  return c.lessons.map(row).filter((r): r is string => r !== null).join("\n");
}

/**
 * `withExample`: the worksheet carries a worked example and a half-solved
 * question, which count INSIDE the picked number (see `worksheetShortfall`).
 * Without saying so, "exactly N" makes the model add them on top and
 * `trimWorksheet` then cuts the last lessons' questions off the tail.
 */
const EXAMPLE_NOTE_AR = "\nالمثال المحلول والسؤال الذي يُطلب من الطالب إكماله يُحسبان ضمن هذه الأعداد (اكتب كلًّا منهما عن الدرس المخصَّص له)؛ أما قسم المراجعة السابقة فإضافي ولا يُحسب من هذا الجدول.";
const EXAMPLE_NOTE_EN = "\nThe worked example and the question you ask the student to complete count toward these per-lesson numbers (write each about the lesson it is assigned); a prior-knowledge review is in addition and is not counted against this table.";

export function coverageClauseAr(b: Record<string, unknown>, withExample = false): string {
  const c = parseCoverage(b);
  if (!c) return "";
  const rule = c.counts
    ? "اكتب بالضبط عدد الأسئلة المذكور لكل درس (وليس غير ذلك)، وزّعها على أنواع الأسئلة كما يلزم."
    : "وزّع الأسئلة على هذه الدروس اختيارًا عشوائيًا، ولا تكرّر درسًا قبل أن تستعمل كل الدروس.";
  return `\nالنطاق يشمل عدة دروس. وزّع الأسئلة عليها ولا تحصرها في درس واحد:\n${tableLines(c, true)}\n${rule}${c.counts && withExample ? EXAMPLE_NOTE_AR : ""}\nأضف إلى كل سؤال الحقل "lesson" برمز الدرس الذي يخصّه السؤال (مثل "L3") — لا تضع نصًّا آخر فيه.`;
}

export function coverageClauseEn(b: Record<string, unknown>, withExample = false): string {
  const c = parseCoverage(b);
  if (!c) return "";
  const rule = c.counts
    ? "Write exactly the number of questions listed for each lesson (no others), spread over the question types as needed."
    : "Spread the questions over these lessons at random, and repeat no lesson before every lesson has been used.";
  return `\nThe scope covers several lessons. Spread the questions over them; do not confine them to one lesson:\n${tableLines(c, false)}\n${rule}${c.counts && withExample ? EXAMPLE_NOTE_EN : ""}\nGive every question a "lesson" field holding the code of the lesson it belongs to (e.g. "L3") — nothing else in that field.`;
}
