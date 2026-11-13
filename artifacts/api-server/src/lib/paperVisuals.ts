/**
 * Drawings on a generated quiz, worksheet or homework (physics only).
 *
 * The model may give a question one `"visual"` (a sibling of `"text"`). Nothing it
 * writes there is trusted: on the finished paper — after top-ups, merges and trims,
 * just before it is pooled — every drawing is gated (`resolvePhysicsFigure`), checked
 * against its own question's text (`figureNumbersInText`: every number it prints must
 * be stated, so it can repeat a given but never show an answer), and capped at
 * MAX_PAPER_VISUALS in paper order. A drawing that fails is removed; its question
 * always stays, which is why the prompt makes the text answerable without it.
 * Only a question may carry a drawing: a visual anywhere else (the paper root, a
 * section, an answerKey row) is removed uncounted, so the summary's reasons stay exact.
 * Spec: docs/superpowers/specs/2026-11-13-physics-figures-design.md §2.
 */
import { figureNumbersInText, resolvePhysicsFigure } from "@workspace/figure";

import { physicsFigureFormatAr, physicsFigureFormatEn } from "./figurePrompt.ts";
import { subjectIdOf } from "./lessonKinds.ts";

export const MAX_PAPER_VISUALS = 6;

export type VisualDropReason = "gate" | "numbers" | "cap" | "not-physics";
export type VisualsSummary = {
  physics: boolean;
  kept: Record<string, number>;
  dropped: Partial<Record<VisualDropReason, number>>;
};

const PAPER_KINDS = new Set(["quiz", "worksheet", "homework"]);

/** A physics request, by its subject id or its subject's name (either language). */
export function isPhysicsRequest(body: { subject?: unknown; subjectId?: unknown } | undefined): boolean {
  if (!body) return false;
  const subject = typeof body.subject === "string" ? body.subject : undefined;
  const subjectId = typeof body.subjectId === "string" ? body.subjectId : undefined;
  return subjectIdOf({ subject, subjectId }) === "physics";
}

/** The prompt's drawing rules, or "" for any other subject, so its prompt stays byte for byte the same. */
export function physicsVisualClauseAr(b: { subject?: unknown; subjectId?: unknown }): string {
  if (!isPhysicsRequest(b)) return "";
  return `\nالرسوم (للفيزياء فقط): يجوز أن يحمل السؤال حقلًا اختياريًا واحدًا "visual" بجانب "text" حيثما يفيد الرسم: قوى تؤثر في جسم، أو مقذوف، أو حركة دائرية، أو موجة، أو جسمان يتجاذبان، أو متجهات. ${MAX_PAPER_VISUALS} رسوم على الأكثر في الورقة كلها. يجب أن يذكر نص السؤال كل ما يلزم للإجابة دون الرسم، وألّا يشير إليه («في الشكل»، «المبيّن»): الرسم الذي يخالف أيّ قاعدة من هذه القواعد يُحذف ويبقى السؤال وحده.\n${physicsFigureFormatAr()}`;
}

export function physicsVisualClauseEn(b: { subject?: unknown; subjectId?: unknown }): string {
  if (!isPhysicsRequest(b)) return "";
  return `\nDrawings (physics only): a question MAY carry one optional "visual" field, a sibling of "text", where a drawing helps: forces on a body, a projectile, circular motion, a wave, two attracting bodies, or vectors. At most ${MAX_PAPER_VISUALS} drawings in the whole paper. The question text must state everything needed to answer without the drawing, and never refer to it ("in the figure", "shown"): a drawing that breaks any of these rules is removed and the question stands alone.\n${physicsFigureFormatEn()}`;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);

/** The paper's questions in paper order: a quiz's `questions`, or every section's `questions`. */
function paperQuestions(kind: string, parsed: unknown): Rec[] {
  if (!isRec(parsed)) return [];
  if (kind === "quiz") return Array.isArray(parsed.questions) ? parsed.questions.filter(isRec) : [];
  if (!Array.isArray(parsed.sections)) return [];
  return parsed.sections.filter(isRec).flatMap(s => (Array.isArray(s.questions) ? s.questions.filter(isRec) : []));
}

/** Remove a visual from the paper root, every section and every answerKey row (uncounted). */
function stripStrayVisuals(parsed: unknown): void {
  if (!isRec(parsed)) return;
  delete parsed.visual;
  for (const list of [parsed.sections, parsed.answerKey]) {
    if (Array.isArray(list)) for (const r of list) if (isRec(r)) delete r.visual;
  }
}

/**
 * Settle every question's drawing in place. Returns what was kept (by kind) and dropped
 * (by reason), or null for a kind that is not a paper. A visual outside the questions is
 * removed and not counted. Never throws.
 */
export function settlePaperVisuals(kind: string, parsed: unknown, body: Record<string, unknown>): VisualsSummary | null {
  if (!PAPER_KINDS.has(kind)) return null;
  stripStrayVisuals(parsed);
  const physics = isPhysicsRequest(body);
  const summary: VisualsSummary = { physics, kept: {}, dropped: {} };
  const drop = (q: Rec, reason: VisualDropReason) => {
    delete q.visual;
    summary.dropped[reason] = (summary.dropped[reason] ?? 0) + 1;
  };
  let kept = 0;
  for (const q of paperQuestions(kind, parsed)) {
    if (!("visual" in q)) continue;
    if (!physics) { drop(q, "not-physics"); continue; }
    const figure = resolvePhysicsFigure(q.visual);
    if (!figure) { drop(q, "gate"); continue; }
    if (typeof q.text !== "string" || !figureNumbersInText(figure, q.text)) { drop(q, "numbers"); continue; }
    if (kept >= MAX_PAPER_VISUALS) { drop(q, "cap"); continue; }
    q.visual = figure;
    kept += 1;
    summary.kept[figure.kind] = (summary.kept[figure.kind] ?? 0) + 1;
  }
  return summary;
}
