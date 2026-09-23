/**
 * Turning spelling rules into questions.
 *
 * Deterministic, and emitting only question types the assessment registry
 * already has — `multiple_choice`, `true_false`, `dictation` — so nothing here
 * needs a renderer, a migration or a new student input.
 *
 * Deterministic in the strict sense: same rule, same count, same seed, same
 * questions. A teacher who regenerates a worksheet and gets a different paper
 * cannot check the one they printed, and two classes sitting "the same" test
 * on different papers is not the same test. The seed is what varies them on
 * purpose — by lesson, by class, by attempt — rather than by luck.
 */
import { wordsForGrade, type SpellingRule, type SpellingWord, type VariantClass } from "./rules.ts";

/**
 * The shape the assessment layer stores, mirrored rather than imported.
 *
 * This package must not depend on `@workspace/db` or on the api-server: the
 * mobile bundle imports it too, and pulling a Postgres driver towards a phone
 * is the same trade `services/evaluations.ts` already refuses. The cost is a
 * copy of three field names, and `items.test.ts` builds every draft through the
 * real registry's `validate` so the copy cannot drift unnoticed.
 */
export interface SpellingItem {
  type: "multiple_choice" | "true_false" | "dictation";
  body: Record<string, unknown>;
  expectedAnswer: Record<string, unknown>;
}

export type SpellingItemKind = "choose" | "judge" | "write" | "tap";

export interface TakeOptions {
  /** Which item shapes to draw from. Defaults to all four. */
  kinds?: readonly SpellingItemKind[];
  /** Varies which words are picked without making the result unrepeatable. */
  seed?: number;
  /**
   * Draw only words this grade should have met, cumulatively.
   *
   * Omit to use the whole rule — which is right when a teacher chose the rule
   * themselves rather than the app inferring it from a lesson.
   */
  grade?: number;
}

/**
 * A small deterministic shuffle.
 *
 * `Math.random` would make a worksheet unreproducible, and pulling in a PRNG
 * library for one line of arithmetic is the kind of dependency this repo
 * declines. A linear congruential step is enough to decorrelate the order of a
 * fifteen-word list — this picks questions, it does not protect anything.
 */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = (seed >>> 0) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Strips harakat for display where the child must supply the letters, not the marks. */
function bare(word: string): string {
  return word.normalize("NFKC").replace(/[ً-ْٰ]/g, "");
}

/**
 * Near misses of a word that a child could plausibly write.
 *
 * Generated rather than hand-authored because a three-option question needs two
 * distractors per word, and most words have exactly one *canonical* misspelling
 * worth writing down. Deriving the rest halves what each new rule costs to
 * author, and it invents no content: a variant is the same word with one letter
 * swapped for the letter the curriculum says it is confused with.
 *
 * **Position is half the rule.** A first pass swapped confusable letters
 * anywhere in the word and produced impossible orthography — «مىاه», «حدىقة»:
 * ى is a word-final letter and cannot occur in the middle of anything. It also
 * produced «فأطمة» and «جلصوا», which are either nonsense or belong to a
 * different lesson entirely. So each swap below is pinned to the position where
 * Arabic actually allows it:
 *
 *   final ة to ه or ت    التاء المربوطة والمفتوحة والهاء
 *   final ى to ي         الألف اللينة
 *   initial ا أ إ آ      همزة الوصل وهمزة القطع
 *   final وا to و        الألف الفارقة
 *
 * Medial and final hamza are deliberately absent: they sit on their own
 * carriers (ؤ ئ) under their own rules, so a swap there is a different
 * question rather than a distractor for this one. The sound-alike consonants
 * (ض/ظ, س/ص, ت/ط) are absent for the same reason — «جلصوا» as a distractor in
 * an alif-fariqa question tests the wrong lesson and reads as a typo.
 *
 * A word that yields fewer than two variants simply gets no choice question.
 * الألف الفارقة admits exactly one plausible misspelling per word, so it is
 * taught by true/false and by writing — which is how the book teaches it too.
 */
export function orthographicVariants(correct: string, only?: VariantClass): string[] {
  const word = bare(correct);
  const out: string[] = [];
  const push = (v: string) => {
    if (v !== word && v.length > 0 && !out.includes(v)) out.push(v);
  };
  const swapLast = (to: string) => push(word.slice(0, -1) + to);
  const swapFirst = (to: string) => push(to + word.slice(1));
  const allows = (cls: VariantClass) => only === undefined || only === cls;

  if (allows("final-taa")) {
    switch (word[word.length - 1]) {
      case "ة": swapLast("ه"); swapLast("ت"); break;
      case "ه": swapLast("ة"); break;
    }
  }

  if (allows("final-alif-layyina")) {
    switch (word[word.length - 1]) {
      case "ى": swapLast("ي"); break;
      case "ي": swapLast("ى"); break;
    }
  }

  if (allows("initial-hamza")) {
    switch (word[0]) {
      case "ا": swapFirst("أ"); swapFirst("إ"); break;
      case "أ": swapFirst("ا"); swapFirst("إ"); break;
      case "إ": swapFirst("ا"); swapFirst("أ"); break;
      case "آ": swapFirst("ا"); swapFirst("أ"); break;
    }
  }

  if (allows("final-waw")) {
    // The silent alif after a plural waw: adding one where it does not belong
    // and dropping one where it does are the two halves of the same lesson.
    if (word.endsWith("وا")) push(word.slice(0, -1));
    else if (word.endsWith("و")) push(word + "ا");
  }

  return out;
}

/**
 * Options for a choice question, or null when the word cannot make one.
 *
 * Null rather than a short list: a two-option "multiple choice" is a true/false
 * question wearing the wrong clothes, and the registry rejects it anyway. The
 * caller drops the word and uses another — which is why some rules (الألف
 * الفارقة, whose words admit exactly one plausible misspelling each) produce
 * judge and write items and no choice items at all. That is the right answer
 * for that rule, not a gap.
 */
function optionsFor(
  word: SpellingWord,
  seed: number,
  max: number,
  taken: ReadonlySet<string>,
  variantClass: VariantClass | undefined,
): { id: string; text: string }[] | null {
  const correct = bare(word.correct);
  const listed = word.wrong.map(bare);
  // Authored misspellings first — they are the ones a teacher vouched for —
  // then derived ones, restricted to the rule's own confusion, to fill the
  // question out.
  const pool: string[] = [];
  for (const candidate of [...listed, ...orthographicVariants(word.correct, variantClass)]) {
    // A distractor that is another word's correct spelling would be a second
    // right answer on the page.
    if (candidate === correct || pool.includes(candidate) || taken.has(candidate)) continue;
    pool.push(candidate);
  }
  if (pool.length < 2) return null;

  const texts = shuffled([correct, ...pool.slice(0, max - 1)], seed);
  return texts.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));
}

function chooseItem(
  word: SpellingWord,
  seed: number,
  taken: ReadonlySet<string>,
  variantClass: VariantClass | undefined,
): SpellingItem | null {
  const options = optionsFor(word, seed, 4, taken, variantClass);
  if (!options) return null;
  const correct = options.find(o => o.text === bare(word.correct))!;
  return {
    type: "multiple_choice",
    body: { stem: "اخْتَرِ الكِتابَةَ الصَّحيحَةَ:", options, multiSelect: false },
    expectedAnswer: { optionIds: [correct.id] },
  };
}

function judgeItem(word: SpellingWord, seed: number): SpellingItem {
  // Half the items show the right spelling and half a wrong one. Always showing
  // the misspelling teaches a pupil that the answer is "خطأ" every time, which
  // measures nothing — and repeatedly printing a wrong spelling beside no right
  // one is poor practice in a subject where children learn by sight.
  const showCorrect = (seed & 1) === 0;
  const shown = showCorrect ? bare(word.correct) : (word.wrong[0] ?? bare(word.correct));
  return {
    type: "true_false",
    body: { statement: `الكَلِمَةُ «${shown}» مَكْتوبَةٌ كِتابَةً صَحيحَةً.` },
    expectedAnswer: { value: showCorrect || shown === bare(word.correct) },
  };
}

function writeItem(word: SpellingWord): SpellingItem {
  // No audioUrl: the teacher reads it. Synthesis is attached later, by the
  // authoring screen, and its absence is a valid question rather than a
  // degraded one.
  const text = word.sentenceAr ?? word.correct;
  return {
    type: "dictation",
    body: { mode: "write", wordCount: text.trim().split(/\s+/).length },
    expectedAnswer: { text },
  };
}

function tapItem(
  word: SpellingWord,
  seed: number,
  taken: ReadonlySet<string>,
  variantClass: VariantClass | undefined,
): SpellingItem | null {
  const options = optionsFor(word, seed, 3, taken, variantClass);
  if (!options) return null;
  const correct = options.find(o => o.text === bare(word.correct))!;
  return {
    type: "dictation",
    body: { mode: "choice", options },
    expectedAnswer: { optionIds: [correct.id] },
  };
}

/**
 * Draw `count` questions for one rule.
 *
 * Words are drawn without replacement before any repeats, so a ten-question
 * worksheet on a fifteen-word rule asks about ten different words rather than
 * the same three. Asking for more questions than the rule has words returns
 * what it has — padding a spelling test with repeats is worse than a shorter
 * test, and silently returning fewer is honest about a bank that needs more
 * words rather than hiding it.
 */
export function takeSpellingItems(
  rule: SpellingRule,
  count: number,
  opts: TakeOptions = {},
): SpellingItem[] {
  const kinds: readonly SpellingItemKind[] = opts.kinds?.length
    ? opts.kinds
    : ["choose", "judge", "write", "tap"];
  const seed = opts.seed ?? 1;
  // Grade filters the pool, not the questions: a rule the books revisit for
  // four years holds words a seven-year-old has never met, and before this a
  // Grade 2 worksheet could draw «اِجْتَمَعَ».
  const pool = wordsForGrade(rule, opts.grade);
  // Every correct spelling in the rule — including the ones this grade is not
  // being asked about — so a derived distractor can never be another word's
  // answer.
  const taken = new Set(rule.words.map(w => bare(w.correct)));

  /**
   * Drop kinds no word in this pool can produce, before drawing anything.
   *
   * Without this the rotation sticks. الألف الفارقة admits exactly one
   * plausible misspelling per word, so no word makes a three-option question —
   * every word failed `choose`, the kind index never advanced past it, and a
   * grade 3 worksheet came back **empty**. A shifted mix is a compromise a
   * teacher can see on the preview list; an empty worksheet is a broken
   * feature, and the tests now pin both.
   */
  const usableKinds = kinds.filter(kind => {
    if (kind === "write") return true;
    if (kind === "judge") return pool.some(w => w.wrong.length > 0);
    const max = kind === "choose" ? 4 : 3;
    return pool.some(w => optionsFor(w, seed, max, taken, rule.variantClass) !== null);
  });
  if (usableKinds.length === 0) return [];

  const items: SpellingItem[] = [];
  let kindIndex = 0;
  for (const word of shuffled(pool, seed)) {
    if (items.length >= Math.max(0, count)) break;
    const kind = usableKinds[kindIndex % usableKinds.length]!;
    const wordSeed = seed + items.length * 7919;

    let item: SpellingItem | null;
    switch (kind) {
      case "choose":
        item = chooseItem(word, wordSeed, taken, rule.variantClass);
        break;
      case "judge":
        item = word.wrong.length > 0 ? judgeItem(word, wordSeed) : null;
        break;
      case "tap":
        item = tapItem(word, wordSeed, taken, rule.variantClass);
        break;
      case "write":
        item = writeItem(word);
        break;
    }

    // A word that cannot make this kind is skipped rather than downgraded to
    // another kind: rotating the kind would quietly rewrite the mix a teacher
    // asked for, and an إملاء worksheet that is secretly all true/false is not
    // the paper they chose.
    if (!item) continue;
    items.push(item);
    kindIndex++;
  }
  return items;
}

/**
 * Whether a lesson is a spelling lesson, and which rules it carries.
 *
 * The caller decides what to do with the answer — the mobile generator uses it
 * to take the deterministic path instead of the model, the same way
 * `isMathContext` does. Returning the rules rather than a boolean means the
 * caller never has to look them up a second time.
 */
export function spellingRulesForLesson(
  grade: number,
  semester: number,
  lessonId: string,
  rules: readonly SpellingRule[],
): SpellingRule[] {
  const ref = `g${grade}s${semester}:${lessonId}`;
  return rules.filter(r => r.lessonIds.includes(ref));
}
