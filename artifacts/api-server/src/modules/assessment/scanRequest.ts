/**
 * Request checks for the evaluation-level scan routes.
 *
 * Both routes take photographs of minors' papers and spend model budget, so
 * every refusal has to happen before either is touched. They are pure
 * functions for the same reason `scanMarks.ts` is: the route files import the
 * database and the OpenAI client at module scope, which `node --test` cannot
 * load, so a decision made inline in a handler is a decision with no test.
 *
 * `MAX_SCAN_IMAGE_CHARS` repeats the figure `POST /attempts/:id/scan-marks`
 * uses (8MB of base64). That route is left alone on purpose; if one number
 * ever has to change, change both.
 */
import { isPaperQuestion } from "./paperExam.ts";

export const MAX_SCAN_IMAGE_CHARS = 8_000_000;
/** An exam paper is rarely one page; more than four is a different feature. */
export const MAX_SETUP_IMAGES = 4;
/** Under `express.json`'s 12MB ceiling (app.ts), with room for the rest of the body. */
export const MAX_SETUP_TOTAL_CHARS = 10_000_000;
export const MAX_SETUP_OBJECTIVES = 100;

export interface ScanRefusal {
  status: number;
  error: string;
  code: string;
}

const TOO_LARGE: ScanRefusal = {
  status: 413,
  error: "That photo is too large. Take it again at a lower quality.",
  code: "image_too_large",
};

/** One photograph, as a data URL. Null means acceptable. */
export function checkScanImage(image: unknown): ScanRefusal | null {
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return { status: 400, error: "image must be a data URL", code: "bad_image" };
  }
  if (image.length > MAX_SCAN_IMAGE_CHARS) return TOO_LARGE;
  return null;
}

export type PaperScanBody =
  | { ok: true; images: string[]; objectiveIds: string[] }
  | { ok: false; refusal: ScanRefusal };

const refuse = (status: number, error: string, code: string): PaperScanBody => ({
  ok: false,
  refusal: { status, error, code },
});

/**
 * Body of `POST /evaluations/scan-paper`: the pages of an exam the teacher set,
 * and the objectives they have picked in the form. The evaluation does not
 * exist yet (the grid is saved together with it), so the objectives travel in
 * the body instead of being read off a row.
 */
export function parsePaperScanBody(body: unknown): PaperScanBody {
  const root = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const images = root["images"];
  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_SETUP_IMAGES) {
    return refuse(400, `Send between 1 and ${MAX_SETUP_IMAGES} photos`, "bad_image");
  }
  let total = 0;
  for (const image of images) {
    const bad = checkScanImage(image);
    if (bad) return { ok: false, refusal: bad };
    total += (image as string).length;
  }
  if (total > MAX_SETUP_TOTAL_CHARS) return { ok: false, refusal: TOO_LARGE };

  const ids = root["objectiveIds"];
  if (!Array.isArray(ids)) {
    return refuse(400, "objectiveIds must be a list", "bad_objectives");
  }
  const trimmed = ids.map(v => (typeof v === "string" ? v.trim() : ""));
  // A blank entry is a client bug, not something to drop quietly: dropping it
  // would let the model be asked about fewer objectives than the teacher ticked.
  if (trimmed.some(v => v === "")) {
    return refuse(400, "objectiveIds must be non-empty strings", "bad_objectives");
  }
  const objectiveIds = [...new Set(trimmed)];
  if (objectiveIds.length === 0 || objectiveIds.length > MAX_SETUP_OBJECTIVES) {
    return refuse(
      400,
      `Choose between 1 and ${MAX_SETUP_OBJECTIVES} objectives`,
      "bad_objectives",
    );
  }

  return { ok: true, images: images as string[], objectiveIds };
}

/**
 * Whether a class can be scanned for this exam at all.
 *
 * Attempts only exist on a published exam, and the class is the roster the
 * student's name is matched against. An exam with no class has nobody to match.
 *
 * And only a paper exam: on an exam whose questions the app marks itself, a
 * blank cell plus submit would machine-grade every unanswered question as 0 —
 * a final, non-provisional score nobody read. The screen offers the scan only
 * on paper exams, but a deep link reaches the route regardless. An empty
 * question list passes here; the route has its own «no questions» refusal.
 */
export function classScanGate(
  evaluation: {
    status: string;
    classGroupId: string | null;
  },
  questions: ReadonlyArray<{ gradingMode: string; body: Record<string, unknown> | null | undefined }>,
): ScanRefusal | null {
  if (evaluation.status !== "published") {
    return {
      status: 409,
      error: "Publish this evaluation before scanning papers",
      code: "not_published",
    };
  }
  if (!evaluation.classGroupId) {
    return {
      status: 409,
      error: "Attach this exam to a class first — the class is the roster papers are matched against",
      code: "no_class",
    };
  }
  if (questions.length > 0 && !questions.every(isPaperQuestion)) {
    return {
      status: 409,
      error: "Class scanning is for paper exams only — this exam has questions the app marks itself",
      code: "not_paper_exam",
    };
  }
  return null;
}
