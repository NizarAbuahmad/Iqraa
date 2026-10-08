/**
 * Does a generated deck keep the promises its own prompt made?
 *
 * `assertUsableDeck` refuses a blank deck and `deckShortfalls` counts a few
 * soft gaps, but the prompt (`promptSlidesPrompt.ts`) states a much longer
 * contract that nothing reads back: four options and a zero-based
 * `correctIndex`, exactly three `mediaPrompt`s and none on a laid-out slide,
 * a `teacher` block on every slide, one-line `statement` slides, a closing
 * summary. Each one is a rule the prompt had to add after a real failure, so
 * each is checked here.
 *
 * Returns issues and never throws or edits — same stance as
 * `modules/assessment/groundingCheck.ts`, whose word-support function this
 * reuses for the one thing a deck can get wrong that structure cannot see:
 * saying something the lesson's book does not.
 *
 * `error` is a deck the app will render wrongly (a `correctIndex` past the
 * options marks nothing right); `warn` is worth a teacher's glance.
 */
import { sourceWordSet, supportIn, WEAK_BELOW } from "../modules/assessment/groundingCheck.ts";

export type DeckIssueSeverity = "error" | "warn";

export interface DeckIssue {
  severity: DeckIssueSeverity;
  code: string;
  /** 1-based slide number as the deck shows it; absent for deck-level issues. */
  slide?: number;
  detail?: string;
}

const SLIDE_TYPES = new Set(["intro", "divider", "challenge", "question", "summary"]);
const MEDIA_PROMPTS_REQUIRED = 3;
/** A projector slide past this is a page of text, not an idea. */
const WALL_WORDS_MAX = 60;
const LATIN_ONLY = /^[\x20-\x7E]+$/;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const count = (s: string) => s.split(/\s+/).filter(Boolean).length;
const lines = (s: string) => s.split("\n").map(l => l.trim()).filter(Boolean);

export function checkDeck(deck: unknown, sourceText = ""): DeckIssue[] {
  const issues: DeckIssue[] = [];
  const add = (severity: DeckIssueSeverity, code: string, slide?: number, detail?: string) =>
    issues.push({ severity, code, slide, detail });

  if (!isRec(deck) || !Array.isArray(deck.slides)) {
    return [{ severity: "error", code: "no_slides" }];
  }
  const slides = deck.slides.filter(isRec);
  const source = sourceWordSet(sourceText);

  // ── Deck level ────────────────────────────────────────────────────────────
  const queries = Array.isArray(deck.deckPhotoQueries) ? deck.deckPhotoQueries.map(str) : [];
  if (queries.length !== 4 || new Set(queries).size !== 4 || !queries.every(q => LATIN_ONLY.test(q))) {
    add("warn", "deck_photo_queries", undefined, "need four distinct English queries");
  }
  const mediaCount = slides.filter(s => str(s.mediaPrompt)).length;
  if (mediaCount !== MEDIA_PROMPTS_REQUIRED) {
    add("warn", "media_prompt_count", undefined, `${mediaCount} of ${MEDIA_PROMPTS_REQUIRED} required`);
  }
  const last = slides[slides.length - 1];
  if (last && last.type !== "summary") add("warn", "no_closing_summary", slides.length);

  // ── Per slide ─────────────────────────────────────────────────────────────
  const seenTitles = new Map<string, number>();
  slides.forEach((s, i) => {
    const n = i + 1;
    const type = str(s.type);
    const content = str(s.content);

    if (!SLIDE_TYPES.has(type)) add("error", "unknown_type", n, type);
    if (s.slideNumber !== n) add("warn", "slide_number", n, `says ${String(s.slideNumber)}`);
    if (!isRec(s.teacher) || Object.values(s.teacher).every(v => !str(v))) add("error", "no_teacher_block", n);
    if ("verified" in s || "verifiedBy" in s) add("error", "claims_verification", n);
    if ("mediaUrl" in s) add("warn", "model_wrote_media_url", n);

    const title = str(s.title);
    if (title && seenTitles.has(title)) add("warn", "duplicate_title", n, `same as slide ${seenTitles.get(title)}`);
    if (title) seenTitles.set(title, n);

    if (count(content) > WALL_WORDS_MAX) add("warn", "too_dense", n, `${count(content)} words`);

    // A laid-out slide fills the screen with its own shape, so a photo has no room.
    const layout = str(s.layout);
    if (layout && str(s.mediaPrompt)) add("warn", "media_on_layout_slide", n);
    if (str(s.mediaPrompt) && !LATIN_ONLY.test(str(s.mediaPrompt))) add("warn", "media_prompt_not_english", n);
    if (layout === "statement" && lines(content).length > 1) add("warn", "statement_not_one_line", n);
    if (layout === "stat" && !(isRec(s.stat) && str(s.stat.value) && str(s.stat.label))) add("error", "stat_incomplete", n);
    if (layout === "compare") {
      const c = isRec(s.compare) ? s.compare : null;
      const full = (v: unknown) => Array.isArray(v) && v.map(str).filter(Boolean).length > 0;
      if (!c || !str(c.leftTitle) || !str(c.rightTitle) || !full(c.left) || !full(c.right)) {
        add("error", "compare_incomplete", n);
      }
    }
    if (layout === "steps" && lines(content).length < 2) add("warn", "steps_too_few", n);

    if (type === "challenge" && !str(s.answer) && !(isRec(s.teacher) && str(s.teacher.expectedAnswer))) {
      add("error", "challenge_without_answer", n);
    }

    if (type === "question") {
      const options = Array.isArray(s.options) ? s.options.map(str) : [];
      if (options.length !== 4) add("error", "option_count", n, `${options.length} options`);
      if (options.some(o => !o) || new Set(options).size !== options.length) add("error", "bad_options", n);
      const ci = s.correctIndex;
      if (!Number.isInteger(ci) || (ci as number) < 0 || (ci as number) >= options.length) {
        add("error", "correct_index_out_of_range", n, String(ci));
      } else {
        const support = supportIn(options[ci as number]!, source);
        if (support !== null && support < WEAK_BELOW) add("warn", "weak_book_support", n, options[ci as number]);
      }
    }

    // Explanation slides are where the lesson content lives; check they sound like the book.
    if (type === "intro" && !layout && i > 2) {
      const support = supportIn(`${title} ${content}`, source);
      if (support !== null && support < WEAK_BELOW) add("warn", "weak_book_support", n, `${support.toFixed(2)}`);
    }
  });

  return issues;
}
