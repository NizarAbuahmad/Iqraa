/**
 * Is a generated artifact actually usable, or just valid JSON?
 *
 * `generateContent` ran `extractJSON` over the model's reply and handed the
 * result straight to `res.json()`. Nothing checked that the object had the
 * fields the app reads. Two ways that goes wrong, both silent:
 *
 *  • A truncated response — the model spends its ceiling reasoning and gets
 *    cut off mid-object. `extractJSON` recovers a partial object, or `{}`.
 *  • A well-formed object of the wrong shape — the model answers in prose
 *    wrapped in JSON, or invents its own field names.
 *
 * In both cases the route answered **200** and the screen rendered an empty
 * lesson plan. No error anywhere: not in the logs, not in the UI, not in the
 * provenance badge, which said «ذكاء اصطناعي مباشر» because the call did
 * succeed. The teacher just saw a blank plan and assumed the app was broken.
 *
 * Failing closed is the honest option and it costs nothing: `RemoteAIService`
 * already falls back to `MockAIService` on a non-2xx, and `aiProvenance` then
 * labels the result «تعذّر الاتصال · محتوى تجريبي». Sample content that says
 * it is sample content beats real-looking content that is empty.
 *
 * The field lists are the app's own contract — what the screens and exports
 * index into. They match `REQUIRED_FIELDS` in `scripts/provider-eval.ts`,
 * which measured 12/12 conformance for the shipped model, so this bar is one
 * a working generation clears comfortably. It only fires when something is
 * genuinely wrong.
 */

export type GenerationKind =
  | "lesson-plan"
  | "worksheet"
  | "homework"
  | "quiz"
  | "activity"
  | "classroom-activity";

/**
 * Fields whose absence leaves the screen with nothing to draw.
 *
 * Deliberately not the full type: cosmetic echoes of the request (a quiz's
 * `duration`, a lesson plan's `grade`) are not worth discarding an otherwise
 * complete artifact over. These are the load-bearing ones.
 */
export const REQUIRED_FIELDS: Record<GenerationKind, readonly string[]> = {
  "lesson-plan": [
    "title", "objectives", "materials", "introduction", "mainActivity",
    "guidedPractice", "independentPractice", "closure", "assessment",
    "differentiation", "homework",
  ],
  // Homework is built from the worksheet prompt and rendered by the worksheet
  // view, so it answers to the same contract.
  worksheet: ["title", "instructions", "sections", "answerKey"],
  homework: ["title", "instructions", "sections", "answerKey"],
  quiz: ["title", "questions"],
  activity: ["title", "objective", "materials", "steps"],
  "classroom-activity": ["activityName", "slides"],
};

/** Which required fields are missing or empty — [] means usable. */
export function missingFields(kind: GenerationKind, parsed: unknown): string[] {
  const required = REQUIRED_FIELDS[kind] ?? [];
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return [...required];
  }
  const obj = parsed as Record<string, unknown>;
  return required.filter((f) => {
    const v = obj[f];
    if (v === undefined || v === null) return true;
    // A whitespace-only string is the truncation signature, not a value.
    if (typeof v === "string") return v.trim() === "";
    if (Array.isArray(v)) return v.length === 0;
    return false;
  });
}

/**
 * Thrown when the model returned JSON the app cannot render.
 *
 * Carries the field list so the log names what was wrong — "generation failed"
 * with no detail is how the original bug stayed invisible.
 */
export class UnusableGenerationError extends Error {
  readonly kind: GenerationKind;
  readonly missing: string[];

  constructor(kind: GenerationKind, missing: string[]) {
    super(
      `The model returned JSON without the fields a ${kind} needs: ` +
        `${missing.join(", ")}. Nothing was rendered rather than rendering a blank ${kind}.`,
    );
    this.name = "UnusableGenerationError";
    this.kind = kind;
    this.missing = missing;
  }
}

/** Throws `UnusableGenerationError` unless every required field is present. */
export function assertUsableGeneration(kind: GenerationKind, parsed: unknown): void {
  const missing = missingFields(kind, parsed);
  if (missing.length > 0) throw new UnusableGenerationError(kind, missing);
}
