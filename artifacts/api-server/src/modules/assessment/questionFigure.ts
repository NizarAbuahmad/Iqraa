/**
 * A teacher-attached book figure, as a student may receive it.
 *
 * Worksheets carry one per question (`WorksheetQuestion.figure`, picked by the
 * teacher from the lesson's own book figures) and keep it when sent to a class.
 * A question body is stored as-is, so the check lives at the point every
 * student-facing question passes: only a URL under the book-figure origin, with
 * its citation, gets through.
 */
import { BOOK_FIGURE_BASE_URL } from "@workspace/curriculum";

export interface StudentFigure {
  uri: string;
  caption: string;
}

export function studentFigure(body: Record<string, unknown>): StudentFigure | null {
  const f = body["figure"];
  if (!f || typeof f !== "object") return null;
  const raw = f as Record<string, unknown>;
  const uri = typeof raw["uri"] === "string" ? raw["uri"] : "";
  const caption = typeof raw["caption"] === "string" ? raw["caption"].trim() : "";
  return uri.startsWith(`${BOOK_FIGURE_BASE_URL}/`) && caption ? { uri, caption } : null;
}
