/**
 * Validation for POST /feedback, kept pure so it can be tested without a DB.
 *
 * Two kinds of row share the `feedback` table:
 *   - a thumb (`up` / `down`) on content a teacher was just shown, comment optional;
 *   - a feature idea (`idea`, materialType `feature_request`) from «اقترح ميزة».
 * An idea *is* its comment, so an empty one is refused — it would be a tap on a
 * button, not a suggestion, and would sit in the admin to-do list saying nothing.
 */
export const FEEDBACK_RATINGS = ["up", "down", "idea"] as const;
export type FeedbackRating = (typeof FEEDBACK_RATINGS)[number];

export const FEATURE_REQUEST_MATERIAL = "feature_request";

// A cap here isn't validation theater — it keeps one runaway paste from making
// a single feedback row unreasonably large in the list view.
const MAX_COMMENT = 2000;

export type FeedbackInput = {
  materialType: string;
  toolId: string;
  rating: FeedbackRating;
  comment: string;
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function isFeedbackRating(v: unknown): v is FeedbackRating {
  return typeof v === "string" && (FEEDBACK_RATINGS as readonly string[]).includes(v);
}

export function parseFeedbackInput(
  body: unknown,
): { ok: true; value: FeedbackInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const materialType = str(b.materialType);
  if (!materialType) return { ok: false, error: "materialType is required" };
  if (!isFeedbackRating(b.rating)) return { ok: false, error: "rating must be 'up', 'down' or 'idea'" };
  const comment = str(b.comment).slice(0, MAX_COMMENT);
  if (b.rating === "idea" && !comment) return { ok: false, error: "an idea needs a description" };
  return { ok: true, value: { materialType, toolId: str(b.toolId), rating: b.rating, comment } };
}
