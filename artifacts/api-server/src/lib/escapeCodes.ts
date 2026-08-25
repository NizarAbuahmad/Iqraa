/**
 * Makes an escape-challenge deck's unlock codes actually usable.
 *
 * The escape activity's whole structure is: solve a challenge, a reveal slide
 * shows one secret digit, groups write it on paper, and the digits read in
 * order are the escape code. Nothing in the app validates a code — there is no
 * input, no lock, no gate. The digit on screen IS the mechanic, so a digit that
 * cannot be read on a projector breaks the activity outright.
 *
 * `classroomPromptAr`/`classroomPromptEn` ask the model for a distinct digit
 * ١–٩ per challenge. A prompt asks; it does not guarantee. Live generation
 * shipped a reveal slide whose code was `٠` — Arabic-Indic zero, which renders
 * as a dot and at 48px green on a light board is invisible. It also repeats the
 * example digit across every challenge when it is copying the shape rather than
 * writing content, which collapses a five-digit code into one repeated number.
 *
 * So this repairs what is unambiguously broken and leaves everything else
 * alone:
 *
 *  • a code that is empty, zero, multi-character or not a digit → replaced
 *  • a code already used by an earlier challenge → replaced
 *  • a valid, distinct code → kept exactly as the model wrote it
 *
 * A reveal slide takes the code of the challenge immediately before it (that
 * pairing is the deck's contract, and the model does get it wrong), and its
 * title is rewritten to name the digit — a slide headed "تم فتح الكود!" with
 * the number only in the badge reads as a template that was never filled in.
 *
 * When a code did change, the summary's full-code line is rewritten too:
 * a stale summary sends the class out with the wrong final code, which is a
 * worse failure than the one being fixed.
 */

/** Arabic-Indic ٠–٩, indexed by value. */
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";

/** The digits a code may be. Zero is excluded — see the header. */
const USABLE = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

type Digit = (typeof USABLE)[number];

/**
 * The digit a raw code represents, or null if it is not a usable one.
 *
 * Accepts both numeral systems whichever language the deck is in: the model
 * writes `7` into an Arabic deck often enough that rejecting it would discard a
 * perfectly good code over its glyph.
 */
export function readDigit(raw: unknown): Digit | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw).trim();
  if (s.length !== 1) return null;
  const latin = s.charCodeAt(0) - 48;
  const arabic = ARABIC_INDIC.indexOf(s);
  const value = latin >= 0 && latin <= 9 ? latin : arabic;
  return (USABLE as readonly number[]).includes(value) ? (value as Digit) : null;
}

/** `7` → `"٧"` for an Arabic deck, `"7"` otherwise. */
export function writeDigit(d: Digit, isAr: boolean): string {
  return isAr ? ARABIC_INDIC[d]! : String(d);
}

/** Canonical reveal heading. The digit is in the title, not only the badge. */
function revealTitle(code: string, isAr: boolean): string {
  return isAr ? `🔓 الكود ${code} مفتوح!` : `🔓 Code ${code} unlocked!`;
}

/** The line the summary slide ends on, listing the whole code in order. */
function fullCodeLine(codes: string[], isAr: boolean): string {
  return isAr
    ? `كود الهروب الكامل: ${codes.join(" – ")}`
    : `Full escape code: ${codes.join(" - ")}`;
}

/** Prefixes of a full-code line, so a stale one can be dropped before adding. */
const FULL_CODE_PREFIXES = ["كود الهروب الكامل", "الكود الكامل", "Full escape code", "Full code"];

type Slide = Record<string, unknown>;

/**
 * Repairs the unlock codes on a generated classroom activity, in place-safe
 * fashion (a new object is returned; the input is not mutated).
 *
 * Anything that is not an escape-style deck — no slide carries an
 * `unlockCode` — is returned untouched, so this is safe to run over every
 * classroom activity rather than only the ones whose `activityType` says
 * escape-challenge. That matters because the activity type is also model
 * output and is not always the one that was asked for.
 */
export function normalizeEscapeCodes(activity: unknown, isAr: boolean): unknown {
  if (activity === null || typeof activity !== "object" || Array.isArray(activity)) {
    return activity;
  }
  const deck = activity as Record<string, unknown>;
  const slides = deck.slides;
  if (!Array.isArray(slides)) return activity;
  if (!slides.some(s => s && typeof s === "object" && "unlockCode" in (s as Slide))) {
    return activity;
  }

  const used = new Set<Digit>();
  /** Next digit no challenge has claimed. Wraps once all nine are spent. */
  const nextFree = (): Digit => {
    const free = USABLE.find(d => !used.has(d));
    if (free !== undefined) return free;
    used.clear();
    return USABLE[0];
  };

  let changed = false;
  /** Code set by the most recent challenge, awaiting its reveal slide. */
  let pending: string | null = null;
  const ordered: string[] = [];

  const out = slides.map(raw => {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return raw;
    const slide = { ...(raw as Slide) };

    if (slide.type === "challenge" && "unlockCode" in slide) {
      const asked = readDigit(slide.unlockCode);
      const digit = asked !== null && !used.has(asked) ? asked : nextFree();
      used.add(digit);
      const code = writeDigit(digit, isAr);
      if (slide.unlockCode !== code) changed = true;
      slide.unlockCode = code;
      pending = code;
      ordered.push(code);
      return slide;
    }

    if (slide.type === "reveal" && (pending !== null || "unlockCode" in slide)) {
      // A reveal with no challenge before it keeps its own code if that code is
      // usable — there is nothing better to pair it with.
      let code = pending;
      if (code === null) {
        const own = readDigit(slide.unlockCode);
        if (own === null) return slide;
        code = writeDigit(own, isAr);
      }
      if (slide.unlockCode !== code) changed = true;
      slide.unlockCode = code;
      const title = typeof slide.title === "string" ? slide.title : "";
      // Leave a title that already names the digit: the model's own wording is
      // better than a template when it did the job.
      if (!title.includes(code)) {
        slide.title = revealTitle(code, isAr);
        changed = true;
      }
      pending = null;
      return slide;
    }

    return slide;
  });

  if (!changed || ordered.length === 0) return { ...deck, slides: out };

  // The summary now disagrees with the slides it summarises. Replace its
  // full-code line rather than leaving the class with two different answers.
  const last = out[out.length - 1];
  if (last && typeof last === "object" && !Array.isArray(last) && (last as Slide).type === "summary") {
    const summary = { ...(last as Slide) };
    const body = typeof summary.content === "string" ? summary.content : "";
    const kept = body
      .split("\n")
      .filter(line => !FULL_CODE_PREFIXES.some(p => line.trim().startsWith(p)));
    summary.content = [...kept, fullCodeLine(ordered, isAr)].join("\n").trim();
    out[out.length - 1] = summary;
  }

  return { ...deck, slides: out };
}
