/**
 * A drawing an exam question carries (`body.visual`), as a student may receive
 * it, and what an edit does to it.
 *
 * A question body is stored as-is, so the check lives at the point every
 * student-facing question passes (`studentView.ts`), beside `studentFigure`:
 * only a figure the gate accepts is sent. The drawing was made for one wording
 * and one key, so an edit to either removes it (the same precedent as a
 * worksheet's working, `worksheetEdits.ts`) — a drawing that may no longer
 * match is worse than none. It is also never taken from the client: it is put
 * back from the stored question or not at all.
 */
import { resolveFigure, type Figure } from "@workspace/figure";

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});

export function studentVisual(body: Rec): Figure | null {
  return resolveFigure(body["visual"]);
}

/** JSON with sorted keys, so two bodies that differ only in key order are equal. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const rec = value as Rec;
    return `{${Object.keys(rec).sort().map(k => `${JSON.stringify(k)}:${canonical(rec[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const text = (body: Rec): Rec => {
  const { visual: _visual, figure: _figure, ...rest } = body;
  return rest;
};

export function bodyAfterEdit(
  existing: { body: unknown; expectedAnswer: unknown },
  next: { body: unknown; expectedAnswer: unknown },
): Rec {
  const oldBody = asRec(existing.body);
  const { visual: _clientVisual, ...nextBody } = asRec(next.body);
  const unchanged =
    canonical(text(oldBody)) === canonical(text(nextBody)) &&
    canonical(existing.expectedAnswer ?? {}) === canonical(next.expectedAnswer ?? {});
  const kept = unchanged ? resolveFigure(oldBody["visual"]) : null;
  return kept ? { ...nextBody, visual: kept } : nextBody;
}
