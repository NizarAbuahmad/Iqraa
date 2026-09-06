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
  | "classroom-activity"
  | "simplified-explanation";

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
  // Dotted names because two of this artifact's load-bearing pieces are
  // objects, and a bare key check cannot tell `{}` from a filled one — see
  // `missingFields`. A student handout whose worked example has no answer is
  // worse than no handout.
  "simplified-explanation": [
    "title", "bigIdea", "explanation",
    "workedExample.text", "workedExample.answer",
    "misconception.claim", "misconception.correction",
    "checks",
  ],
};

/**
 * Which required fields are missing or empty — [] means usable.
 *
 * A name containing a dot walks into a nested object: `"workedExample.answer"`
 * asks that `workedExample` exist AND carry a non-empty `answer`. Without that,
 * the check could only ask whether the key was present, so a truncated
 * `"workedExample": {}` cleared the gate, got written to the shared artifact
 * pool, and rendered an empty card for every teacher who asked for that lesson
 * — a well-formed artifact that is wrong, which nothing downstream can catch.
 */
export function missingFields(kind: GenerationKind, parsed: unknown): string[] {
  const required = REQUIRED_FIELDS[kind] ?? [];
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return [...required];
  }
  return required.filter((f) => isEmptyAt(parsed, f.split(".")));
}

/** Walk `path` from `node`: true when it dead-ends or lands on an empty value. */
function isEmptyAt(node: unknown, path: readonly string[]): boolean {
  if (node === null || typeof node !== "object" || Array.isArray(node)) return true;
  const [head, ...rest] = path;
  const v = (node as Record<string, unknown>)[head!];
  if (v === undefined || v === null) return true;
  if (rest.length > 0) return isEmptyAt(v, rest);
  // A whitespace-only string is the truncation signature, not a value.
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
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

/**
 * Pull JSON out of a model response.
 *
 * Models wrap JSON in markdown fences, prepend "Here is the JSON:", or trail a
 * sentence after the closing brace — all of which are the model being helpful
 * and all of which break `JSON.parse`. The brace-matching fallback is for those
 * cases, not for truncation: a response cut off mid-object still parses to
 * something plausible, which is why `assertUsableGeneration` exists downstream.
 *
 * Lives here rather than in a route because two routes now need it, and a
 * second copy would drift the moment one of them met a new way of being
 * helpful.
 */
export function extractJSON(raw: string): unknown {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Could not parse JSON from AI response");
  }
}
