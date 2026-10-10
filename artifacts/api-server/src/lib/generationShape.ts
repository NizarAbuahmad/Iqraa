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
  | "lesson-teaching"
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
  // The explanation is the whole point of the call. A missing hook, example or
  // practice problem only costs the deck that one slide, so those are optional.
  "lesson-teaching": ["concepts"],
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

/**
 * Throws `UnusableGenerationError` unless every required field is present.
 *
 * A quiz is also normalised in place against the request body (see
 * `normalizeQuiz`); the returned lines say what that changed, for the log.
 * Empty for every other kind and for a quiz that needed nothing.
 */
export function assertUsableGeneration(
  kind: GenerationKind,
  parsed: unknown,
  body?: Record<string, unknown>,
): string[] {
  const missing = missingFields(kind, parsed);
  if (missing.length > 0) throw new UnusableGenerationError(kind, missing);
  if (kind === "prompt-slides") assertUsableDeck(parsed);
  if (kind === "quiz") return normalizeQuiz(parsed, body?.questionTypes);
  return [];
}

/**
 * The order a ministry exam paper puts its question types in — the «السؤال
 * الأول: ضع دائرة…», «السؤال الثاني: ضع إشارة ✓/✗…» structure every Jordanian
 * school exam follows. The prompt asks for it and `normalizeQuiz` enforces it,
 * so the app's screen, PDF, Word file and shared text all print the same
 * grouped paper from the same array. Keep in step with `QUIZ_TYPE_ORDER` in
 * `artifacts/mobile/services/quizPaper.ts`, which the offline generator uses.
 */
export const QUIZ_TYPE_ORDER = ["multiple_choice", "true_false", "fill_blank", "short_answer"] as const;
export type QuizType = (typeof QUIZ_TYPE_ORDER)[number];

const TRUE_RE = /^\s*(?:[أ-يa-z]\s*[).\-:]\s*)?(?:صح|صحيح|صحيحة|صواب|نعم|true|t|yes|✓|✔)\s*[.!]?\s*$/i;
const FALSE_RE = /^\s*(?:[أ-يa-z]\s*[).\-:]\s*)?(?:خطأ|خاطئ|خاطئة|لا|false|f|no|✗|✘|×)\s*[.!]?\s*$/i;

/** The model's name for a type, mapped onto ours; `null` for anything else. */
function quizTypeOf(raw: unknown, options: unknown[]): QuizType | null {
  const t = typeof raw === "string" ? raw.toLowerCase() : "";
  if (/multi|mcq|choice|اختيار/.test(t)) return "multiple_choice";
  if (/true|false|tf|صح|خطأ/.test(t)) return "true_false";
  if (/blank|fill|complet|فراغ|أكمل/.test(t)) return "fill_blank";
  if (/short|open|essay|answer|قصير|مقال/.test(t)) return "short_answer";
  // No usable label: read the shape instead of discarding a sound question.
  if (options.length >= 3) return "multiple_choice";
  if (options.length === 2 && options.every(o => TRUE_RE.test(String(o)) || FALSE_RE.test(String(o)))) return "true_false";
  if (options.length === 0 && t === "") return "short_answer";
  return null;
}

/**
 * Make a generated quiz honour what the teacher asked for, before it is
 * stored and served to every teacher who asks for that lesson.
 *
 * The prompt states the allowed types, the order and the true/false shape;
 * this is what happens when the model treats that as a suggestion. Three
 * things, all in place on `parsed.questions`:
 *
 *  - a question of a type the teacher did not tick is dropped (the model's
 *    own labels are mapped first, so "True/False" is not thrown away for
 *    not being spelled `true_false`);
 *  - a true/false question always carries exactly the two options the app
 *    renders and marks against, with `correctAnswer` one of them, whether the
 *    model wrote `options`, wrote «صحيح»/"T", or wrote nothing;
 *  - questions are grouped by type in `QUIZ_TYPE_ORDER`, stably, so the paper
 *    reads as a ministry exam rather than an interleaved list.
 *
 * `requested` absent or unrecognised means every type is allowed — a caller
 * that does not send `questionTypes` has not asked for a restriction.
 *
 * Throws when nothing survives: an all-MCQ reply to a صح/خطأ request is not a
 * quiz the teacher can use, and serving it would also pool it.
 */
export function normalizeQuiz(parsed: unknown, requested: unknown): string[] {
  const obj = parsed as Record<string, unknown>;
  const list = Array.isArray(obj.questions) ? (obj.questions as unknown[]) : [];
  const asked = Array.isArray(requested)
    ? requested.filter((t): t is QuizType => (QUIZ_TYPE_ORDER as readonly string[]).includes(String(t)))
    : [];
  const allowed = new Set<QuizType>(asked.length ? asked : QUIZ_TYPE_ORDER);
  const notes: string[] = [];
  const dropped: string[] = [];

  const kept: { q: Record<string, unknown>; rank: number }[] = [];
  list.forEach((item, i) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return;
    const q = item as Record<string, unknown>;
    const options = Array.isArray(q.options) ? q.options : [];
    const type = quizTypeOf(q.type, options);
    if (!type || !allowed.has(type)) {
      dropped.push(`#${i + 1} ${String(q.type ?? "?")}`);
      return;
    }
    q.type = type;
    if (type === "true_false") {
      const answer = String(q.correctAnswer ?? "");
      const arabic = /[؀-ۿ]/.test(`${String(q.text ?? "")}${answer}${options.join("")}`);
      const pair = arabic ? ["صح", "خطأ"] : ["True", "False"];
      q.options = pair;
      if (TRUE_RE.test(answer)) q.correctAnswer = pair[0];
      else if (FALSE_RE.test(answer)) q.correctAnswer = pair[1];
      else if (answer === "" && typeof q.answer === "boolean") q.correctAnswer = q.answer ? pair[0] : pair[1];
    } else if (type !== "multiple_choice" && options.length === 0) {
      delete q.options;
    }
    kept.push({ q, rank: QUIZ_TYPE_ORDER.indexOf(type) });
  });

  if (kept.length === 0) {
    throw new UnusableGenerationError("quiz", [
      `questions (none of the ${list.length} returned were of the requested types: ${[...allowed].join(", ")})`,
    ]);
  }
  if (dropped.length) notes.push(`dropped ${dropped.length} question(s) of unrequested types: ${dropped.join(", ")}`);
  const ordered = kept.map((k, i) => ({ ...k, i })).sort((a, b) => a.rank - b.rank || a.i - b.i).map(k => k.q);
  if (ordered.some((q, i) => q !== kept[i]!.q)) notes.push("reordered questions into ministry type order");
  obj.questions = ordered;
  return notes;
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
  // A laid-out slide is meant to be one line (statement) or keeps its body
  // outside `content` (stat, compare), so it is not a thin slide.
  const thin = objects.filter(s => !s.layout && typeof s.content === "string" && !s.content.includes("\n")).length;
  if (thin > 0) out.push(`${thin}/${objects.length} slides are a single unbroken line`);
  return out;
}

/**
 * The most lines a worked solution or worked example may run to.
 *
 * Eight is two more than the longest the offline bank carries. Past that the
 * model is rambling or has put a whole lesson in one field, and a pooled
 * artifact would show it to every teacher who asks for that lesson.
 */
const MAX_WORKING_LINES = 8;
/** One line is an answer, not working. */
const MIN_EXAMPLE_STEPS = 2;

const isLine = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isLines = (v: unknown, min: number): v is string[] =>
  Array.isArray(v) && v.length >= min && v.length <= MAX_WORKING_LINES && v.every(isLine);

/**
 * Drop the optional teaching extras on a worksheet that are not well formed.
 *
 * `workedExample` and each answer-key row's `solution` are asked for by the
 * worksheet prompt but are deliberately NOT in `REQUIRED_FIELDS`: a paper
 * without them is still a usable paper, and refusing a paid generation over a
 * missing extra would spend the teacher's allowance for nothing. Letting a
 * malformed one through is worse, though — this artifact is stored in the
 * shared pool and projected to a class, and a worked example is the one thing
 * on the page students are told to study. So a bad extra is removed and the
 * rest of the paper kept, rather than failing either way.
 *
 * Whitelists the fields it keeps, so a model that invents a sibling field does
 * not get it stored.
 */
export function sanitizeWorksheetExtras<T>(kind: GenerationKind, parsed: T): T {
  if (kind !== "worksheet" && kind !== "homework") return parsed;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const out: Record<string, unknown> = { ...(parsed as Record<string, unknown>) };

  if ("workedExample" in out) {
    const ex = out.workedExample as Record<string, unknown> | null;
    const ok =
      ex !== null && typeof ex === "object" && !Array.isArray(ex) &&
      isLine(ex.problem) && isLine(ex.answer) && isLines(ex.steps, MIN_EXAMPLE_STEPS);
    if (ok) {
      out.workedExample = {
        problem: ex.problem,
        steps: ex.steps,
        answer: ex.answer,
        ...(isLine(ex.selfExplain) ? { selfExplain: ex.selfExplain } : {}),
      };
    } else {
      delete out.workedExample;
    }
  }

  if (Array.isArray(out.answerKey)) {
    out.answerKey = out.answerKey.map(row => {
      if (row === null || typeof row !== "object" || Array.isArray(row) || !("solution" in row)) return row;
      if (isLines((row as Record<string, unknown>).solution, 1)) return row;
      const { solution: _dropped, ...rest } = row as Record<string, unknown>;
      return rest;
    });
  }
  return out as T;
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
    return parseRepairing(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return parseRepairing(match[0]);
    throw new Error("Could not parse JSON from AI response");
  }
}

/**
 * A maths lesson makes the model write LaTeX, and a lone backslash in a JSON
 * string («\(x^2\)», «\sqrt») is an illegal escape: `JSON.parse` throws and
 * the teacher got a 500 for a reply that was otherwise fine (seen in
 * production 2026-09-30, one lesson plan of 32). Strict parse first, so a valid
 * reply is never touched; only on failure are the illegal escapes doubled.
 *
 * The other half of the same mistake is silent: \b \f \t \n \r are legal JSON
 * escapes, so a LaTeX «\frac» or «\theta» parses without error as a form feed
 * or a tab and the lesson prints «rac{1}{2}». `restoreLatexEscapes` turns those
 * back into a literal backslash, but only when the letters after the escape
 * spell a LaTeX command — an ordinary «\n» followed by a word is left alone.
 * The prompts also tell the model not to write LaTeX; this is the backstop.
 */
const LATEX_AFTER: Record<string, RegExp> = {
  f: /^(?:rac|orall)(?![a-z])/,
  t: /^(?:heta|imes|ext|frac|ilde|riangle)(?![a-z])/,
  n: /^(?:eq|abla)(?![a-z])/,
  r: /^(?:ight|angle)(?![a-z])/,
  b: /^(?:eta|inom|egin|oldsymbol)(?![a-z])/,
};

/** Exported for the test: a JSON text in, the same text with LaTeX escapes made literal. */
export function restoreLatexEscapes(text: string): string {
  // Pairs are consumed whole, so «\\frac» (an escaped backslash) is never touched.
  return text.replace(/\\(["\\/]|u[0-9a-fA-F]{4}|[bfnrt]|[\s\S])/g, (m, esc: string, offset: number) => {
    const after = LATEX_AFTER[esc];
    if (after && after.test(text.slice(offset + 2, offset + 12))) return "\\\\" + esc;
    return m;
  });
}

function parseRepairing(text: string): unknown {
  text = restoreLatexEscapes(text);
  try {
    return JSON.parse(text);
  } catch (err) {
    // Valid escapes are consumed as pairs, so «\\alpha» keeps its one literal backslash.
    const repaired = text.replace(
      /\\(["\\/bfnrt]|u[0-9a-fA-F]{4})|\\/g,
      (m, ok) => (ok ? m : "\\\\"),
    );
    if (repaired === text) throw err;
    return JSON.parse(repaired);
  }
}
