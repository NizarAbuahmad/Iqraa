import { usesWorkedExample } from "./lessonKinds.ts";

/**
 * Question types the MODEL is asked to write. صِل / رتّب / أين الخطأ؟ / ارسم
 * are built from the question bank by the app (`worksheetFormats.ts` in
 * artifacts/mobile) and appended to the paper afterwards — each counts inside
 * the teacher's total, which the client has already reduced by that many. A
 * model told to write them would invent unverified items, so they never reach
 * the prompt; a list left empty falls back to short answer.
 */
export const BANK_ONLY_TYPES = new Set(["match", "order", "spot_error", "graph"]);

export function worksheetModelTypes(raw: unknown): string[] {
  const types = (Array.isArray(raw) && raw.length ? (raw as string[]) : ["short_answer"]).filter(t => !BANK_ONLY_TYPES.has(t));
  if (types.length === 0) types.push("short_answer");
  return types;
}

/**
 * How many questions the sections hold: the picked number, less the worked
 * example, which sits inside it (`workedExampleRuleAr`). Homework and a subject
 * with no calculation to model have no example.
 */
export function worksheetSectionTotal(b: Record<string, unknown> & { numQuestions?: number; homework?: boolean }): number {
  const n = b.numQuestions ?? 8;
  const example = !b.homework && usesWorkedExample(b as { subject?: string; subjectId?: string });
  return Math.max(1, example ? n - 1 : n);
}

/**
 * Each ticked type's share of the sections, as an even split with the
 * remainder going to the earlier types. A type with no room (more types
 * ticked than questions) is left out rather than listed at 0.
 *
 * The prompt used to name the types and say "spread the questions across
 * them", with every section carrying ONE `type` — and sections are difficulty
 * bands, so the model gave each band a single type and filled it. Five types
 * ticked came back as twenty multiple-choice questions. A number per type is
 * what it can be held to, and what `worksheetMissingTypes` checks against.
 */
export function worksheetTypeQuota(types: string[], total: number): Array<[string, number]> {
  if (types.length === 0 || total <= 0) return [];
  const base = Math.floor(total / types.length);
  const extra = total % types.length;
  return types
    .map((t, i): [string, number] => [t, base + (i < extra ? 1 : 0)])
    .filter(([, k]) => k > 0);
}
