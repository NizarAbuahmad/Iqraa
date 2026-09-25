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
  | "prompt-slides"
  | "infographic";

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
  "prompt-slides": ["activityName", "slides"],
  // `subtitle` is decoration and may legitimately be short or absent.
  infographic: ["title", "keyFacts", "sections", "takeaway"],
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
  if (kind === "prompt-slides") assertUsableDeck(parsed);
}

/** A deck shorter than this is not a lesson, whatever the teacher asked for. */
const MIN_USABLE_DECK_SLIDES = 5;

/**
 * The structural floor for a slide deck, on top of the field list above.
 *
 * `REQUIRED_FIELDS` can only ask whether `slides` is a non-empty array, so a
 * deck of one slide reading `{title:"x"}` passed — and a teacher got six blank
 * cards behind a badge saying live AI had produced them. These are the two
 * things a deck cannot be usable without, and both are cheap for a working
 * generation to clear.
 *
 * Deliberately only these two. The softer bars — a `teacher` block on every
 * slide, at least one question, at least one divider — are prompt quality, and
 * failing a paid generation over them would spend the teacher's money and hand
 * back nothing. `logDeckShortfalls` reports those instead.
 */
export function assertUsableDeck(parsed: unknown): void {
  const slides = (parsed as { slides?: unknown })?.slides;
  if (!Array.isArray(slides) || slides.length < MIN_USABLE_DECK_SLIDES) {
    throw new UnusableGenerationError("prompt-slides", [
      `slides (need at least ${MIN_USABLE_DECK_SLIDES}, got ${Array.isArray(slides) ? slides.length : 0})`,
    ]);
  }
  const blank = slides.filter(s => {
    if (s === null || typeof s !== "object" || Array.isArray(s)) return true;
    const slide = s as Record<string, unknown>;
    const title = typeof slide.title === "string" ? slide.title.trim() : "";
    const content = typeof slide.content === "string" ? slide.content.trim() : "";
    return !title || !content;
  });
  if (blank.length > 0) {
    throw new UnusableGenerationError("prompt-slides", [
      `${blank.length} of ${slides.length} slides have an empty title or body`,
    ]);
  }
}

/** What a generated deck is missing that is worth knowing but not worth refusing. */
export function deckShortfalls(parsed: unknown): string[] {
  const slides = (parsed as { slides?: unknown })?.slides;
  if (!Array.isArray(slides)) return [];
  const out: string[] = [];
  const objects = slides.filter(
    (s): s is Record<string, unknown> => s !== null && typeof s === "object" && !Array.isArray(s),
  );
  const withTeacher = objects.filter(s => !!s.teacher).length;
  if (withTeacher < objects.length) {
    out.push(`${objects.length - withTeacher}/${objects.length} slides carry no teacher notes`);
  }
  if (!objects.some(s => s.type === "question" || s.type === "challenge")) {
    out.push("no question or worked-example slide");
  }
  if (!objects.some(s => s.type === "divider")) out.push("no divider slide");
  const thin = objects.filter(s => typeof s.content === "string" && !s.content.includes("\n")).length;
  if (thin > 0) out.push(`${thin}/${objects.length} slides are a single unbroken line`);
  return out;
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
