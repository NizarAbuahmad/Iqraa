/**
 * Put the actual book on the prompt.
 *
 * Until now every generator's "curriculum grounding" was the lesson's
 * objectives, restated. `lib/curriculum` holds 682 pages of real NCCD text and
 * ranked retrieval over it (`passagesForUnit`), and nothing read it. This is
 * the join: resolve the unit a request is about, pull its best pages, and
 * append them to `additionalContext` with their page numbers.
 *
 * ## Why here and not in a prompt builder
 *
 * All eight builders in `prompts.ts` — and the nine classroom-activity prompts
 * in `routes/generate.ts` — already inject `b.additionalContext` under a
 * textbook heading. Enriching the body before the builder runs reaches every
 * one of them without editing any.
 *
 * ## Why not middleware
 *
 * `routes/index.ts` mounts `router.use(generateRouter)` with **no path
 * prefix**, so a `generateRouter.use(mw)` would become API-wide middleware and
 * shadow every router mounted after it. That is the failure CLAUDE.md records
 * and `routes/__tests__/mountOrder.test.ts` guards. Each route calls
 * `withGrounding` explicitly instead.
 *
 * ## Why quotable-only
 *
 * A generated worksheet is an export path: whatever reaches the model can end
 * up printed and handed to a class. Teacher-authored documents in the bank are
 * `reference-only` and must not be reproduced verbatim, so retrieval here is
 * restricted to NCCD material. See `usePolicy()` in `lib/curriculum/src/bank.ts`.
 *
 * Imports nothing that touches the OpenAI client — that throws at module scope
 * without a key, which would make this untestable under `node --test`.
 */
import { G10_SOURCES, isNccdUnitId, sourceLabel } from "@workspace/curriculum";
import {
  passagesForUnit,
  resolveUnitByTopic,
  type Passage,
} from "@workspace/curriculum/passages";

/**
 * Pages per request. Three is roughly 4,500 characters — enough for a model to
 * work from, small enough to leave the request's own instructions dominant.
 */
const PASSAGE_LIMIT = 3;

/**
 * Hard ceiling on the appended block. A page is usually ~1,500 characters but
 * the extractor makes no promise about that, and an unbounded prompt is a
 * budget problem (`AI_BUDGET_USD`) before it is a quality one.
 */
const PASSAGE_CHAR_BUDGET = 6_000;

export interface GroundedSource {
  sourceId: string;
  /** The document as a teacher would name it. */
  titleAr: string;
  /** 1-based page in that document — a citation that can be checked. */
  page: number;
}

export interface Grounding {
  unitId: string;
  sources: GroundedSource[];
  /** The text appended to `additionalContext`. Never empty when this exists. */
  block: string;
}

/**
 * A document named as a teacher would name it.
 *
 * `sourceLabel` builds this from `kind`/`subject`/`semester` rather than the
 * filename, which for `chem-s1-student-book` is «10th grade, alchamy1st
 * semester.pdf» — English, misspelled, and no use as a citation in an Arabic
 * worksheet. Falls back to the id, which is at least checkable.
 */
function labelFor(sourceId: string, isAr: boolean): string {
  const source = G10_SOURCES.find(s => s.id === sourceId);
  return source ? sourceLabel(source, isAr ? "ar" : "en") : sourceId;
}

function renderBlock(passages: Passage[], isAr: boolean): { block: string; used: Passage[] } {
  // The extractor is honest but imperfect: the lam-alef ligature comes apart,
  // so «العلاقات» arrives as «العالقات», and RTL columns interleave. A model
  // reads through both — but only if it is told the text is machine-extracted,
  // otherwise it copies the artefacts into what it writes. The text is passed
  // raw regardless: re-spelling a textbook on the way to a prompt is a silent
  // edit of a source document.
  const header = isAr
    ? "=== نص حرفي من الكتاب المدرسي الرسمي (اعتمد عليه ولا تخالفه) ===\n"
      + "(نص مستخرَج آليًّا من ملف PDF: قد تتداخل الأسطر وتنقلب بعض الحروف — اقرأ المعنى ولا تنسخ أخطاء الاستخراج.)"
    : "=== Verbatim text from the official textbook (ground your answer in it) ===\n"
      + "(Machine-extracted from a PDF: lines may interleave and some letters may be transposed — read for meaning, do not copy extraction artefacts.)";
  const footer = isAr
    ? "استند إلى النص أعلاه في الصياغة والأمثلة والمصطلحات. وإن لم يغطِّ النص جزءًا مما طُلب، فاذكر ذلك بدل تأليفه."
    : "Base your wording, examples and terminology on the text above. If it does not cover part of what was asked, say so rather than inventing it.";

  const parts: string[] = [];
  const used: Passage[] = [];
  let spent = 0;

  for (const p of passages) {
    const cite = isAr
      ? `[${used.length + 1}] ${labelFor(p.sourceId, isAr)} — صفحة ${p.page}`
      : `[${used.length + 1}] ${labelFor(p.sourceId, isAr)} — page ${p.page}`;
    const room = PASSAGE_CHAR_BUDGET - spent;
    // A page that does not fit is truncated and *said* to be truncated, rather
    // than dropped silently or cut mid-sentence and passed off as complete.
    if (room < 400) break;
    const text = p.text.length <= room
      ? p.text
      : `${p.text.slice(0, room).trimEnd()}${isAr ? " […بقية الصفحة غير مُدرجة]" : " […rest of page omitted]"}`;
    parts.push(`${cite}\n${text}`);
    spent += text.length;
    used.push(p);
  }

  if (!used.length) return { block: "", used };
  return { block: [header, ...parts, footer].join("\n\n"), used };
}

/**
 * The book pages for a request, or `null` when there are none.
 *
 * `null` is a real answer and the common one: only six of 78 documents have
 * been read, and `resolveUnitByTopic` refuses an ambiguous topic rather than
 * guessing. A wrong unit would attach the wrong book to a prompt, which reads
 * as authoritative and is worse than no grounding at all.
 */
export function groundingFor(
  input: { unitId?: unknown; topic?: unknown },
  isAr: boolean,
): Grounding | null {
  // An explicit unit id beats a title match — the caller knows which lesson the
  // teacher picked, and a resolver working from free text can only infer it.
  const explicit = typeof input.unitId === "string" && isNccdUnitId(input.unitId)
    ? input.unitId
    : null;
  const topic = typeof input.topic === "string" ? input.topic : "";
  const unitId = explicit ?? resolveUnitByTopic(topic)?.unitId ?? null;
  if (!unitId) return null;

  const passages = passagesForUnit({
    unitId,
    terms: topic ? [topic] : [],
    limit: PASSAGE_LIMIT,
    quotableOnly: true,
  });
  if (!passages.length) return null;

  const { block, used } = renderBlock(passages, isAr);
  if (!block) return null;

  return {
    unitId,
    block,
    sources: used.map(p => ({
      sourceId: p.sourceId,
      titleAr: labelFor(p.sourceId, true),
      page: p.page,
    })),
  };
}

/**
 * Book pages for a set of objectives — the exam generator's way in.
 *
 * `llmGenerator` is handed objectives rather than a topic, and each one already
 * names its unit. Almost always that is a single unit; when a paper spans two,
 * the pages are pooled and re-ranked by the same score so the split reflects
 * which unit the request actually leans on rather than a fixed quota.
 */
export function groundingForObjectives(
  objectives: readonly { unitId: string }[],
  isAr: boolean,
): Grounding | null {
  const unitIds = [...new Set(objectives.map(o => o.unitId).filter(isNccdUnitId))];
  if (!unitIds.length) return null;

  const pooled = unitIds
    .flatMap(unitId => passagesForUnit({ unitId, limit: PASSAGE_LIMIT, quotableOnly: true }))
    // Scores from `passagesForUnit` are only comparable within one query, but
    // the scale is the same function of the same term lengths, so across units
    // of the same corpus this orders sensibly. Ties break on id then page so a
    // paper generated twice reads the same pages twice.
    .sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId) || a.page - b.page)
    .slice(0, PASSAGE_LIMIT);
  if (!pooled.length) return null;

  const { block, used } = renderBlock(pooled, isAr);
  if (!block) return null;
  return {
    unitId: unitIds[0]!,
    block,
    sources: used.map(p => ({ sourceId: p.sourceId, titleAr: labelFor(p.sourceId, true), page: p.page })),
  };
}

/**
 * The request body with book text appended to `additionalContext`.
 *
 * The caller's own context is kept first and byte-identical: a teacher's
 * "focus on weak students" must not be reworded or displaced by a retrieval
 * result. When nothing is found the body is returned unchanged, so an
 * ungrounded request is exactly the request that was sent.
 */
export function withGrounding<T extends Record<string, unknown>>(
  body: T,
  isAr: boolean,
): { body: T; grounding: Grounding | null } {
  const grounding = groundingFor(body, isAr);
  if (!grounding) return { body, grounding: null };

  const existing = typeof body.additionalContext === "string" ? body.additionalContext.trim() : "";
  return {
    body: {
      ...body,
      additionalContext: existing ? `${existing}\n\n${grounding.block}` : grounding.block,
    },
    grounding,
  };
}
