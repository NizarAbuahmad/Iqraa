/**
 * How much a generated deck gives the class to do — measured, not judged.
 *
 * `checkDeck` reads back the prompt's contract and `deckShortfalls` the gaps
 * worth a warning; neither says whether a deck is a lecture. Almost every slide
 * change in the log closes with "not verified: a live model choosing these", so
 * the prompt-slides route logs these numbers for every deck it serves, and
 * `scripts/provider-eval.ts` prints them per run. They are the before-and-after
 * for any change to the prompt.
 *
 * An activity is a `question` or a `challenge` — the two types the presenter
 * gives a timer and a reveal. A passive run is consecutive `intro` slides after
 * the cover; any other type ends it, a divider included (a section break is a
 * pause, and the prompt counts concept slides per section).
 */

/** The prompt allows two explanation slides in a row; the third must be the class's turn. */
export const MAX_PASSIVE_RUN = 2;

export interface DeckEngagement {
  slides: number;
  /**
   * Has a `question` slide. The prompt's teaching arc requires one and its
   * general arc (an event, a parents' evening) usually has none, so this is how
   * the log tells the two apart when comparing before and after.
   */
  hasCheck: boolean;
  /** `question` + `challenge` slides. */
  activities: number;
  /** 1-based slide number of the first activity, or null when there is none. */
  firstActivity: number | null;
  longestPassiveRun: number;
  /** `intro` and `summary` slides after the cover. */
  contentSlides: number;
  /** Content slides drawn with a `layout`. */
  laidOut: number;
  /** Content slides with no layout and a single line of text. */
  singleLine: number;
  /** Mean words of `content` per content slide, one decimal. */
  wordsPerContentSlide: number;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const ACTIVITY = new Set(["question", "challenge"]);
const CONTENT = new Set(["intro", "summary"]);

export function deckEngagement(deck: unknown): DeckEngagement {
  const raw = isRec(deck) && Array.isArray(deck.slides) ? deck.slides : [];
  const slides = raw.filter(isRec);
  let activities = 0;
  let hasCheck = false;
  let firstActivity: number | null = null;
  let run = 0;
  let longestPassiveRun = 0;
  let contentSlides = 0;
  let laidOut = 0;
  let singleLine = 0;
  let words = 0;
  slides.forEach((s, i) => {
    const type = str(s.type);
    if (type === "question") hasCheck = true;
    if (ACTIVITY.has(type)) {
      activities += 1;
      if (firstActivity === null) firstActivity = i + 1;
    }
    if (i > 0 && type === "intro") {
      run += 1;
      longestPassiveRun = Math.max(longestPassiveRun, run);
    } else {
      run = 0;
    }
    if (i === 0 || !CONTENT.has(type)) return;
    const content = str(s.content);
    contentSlides += 1;
    words += content.split(/\s+/).filter(Boolean).length;
    if (str(s.layout)) laidOut += 1;
    else if (content && !content.includes("\n")) singleLine += 1;
  });
  return {
    slides: slides.length,
    hasCheck,
    activities,
    firstActivity,
    longestPassiveRun,
    contentSlides,
    laidOut,
    singleLine,
    wordsPerContentSlide: contentSlides ? Math.round((words / contentSlides) * 10) / 10 : 0,
  };
}
