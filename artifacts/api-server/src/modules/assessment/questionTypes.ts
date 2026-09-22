/**
 * The question-type registry.
 *
 * Every type-specific behaviour lives behind this one interface, so adding a
 * ninth assessment type is a new entry here rather than a migration and a
 * scattering of switch statements. Three things matter per type:
 *
 *  validate         — is this question well-formed enough to put in front of a
 *                     student? Run before anything is persisted, on AI output
 *                     and teacher edits alike.
 *  sanitizeForStudent — the projection a student may receive. This is the
 *                     control that keeps answer keys off a student's device;
 *                     it is asserted by test, because a code review will
 *                     eventually miss a field and a test will not.
 *  defaultGradingMode — how marks get decided, which drives whether a grade is
 *                     a fact or a judgement.
 */
import type { GradingMode, QuestionType } from "@workspace/db";
import { matchesAny, normalizeArabic } from "./normalize.ts";
import { MAX_WORDS, normalizeForReading, scoreReading } from "./readAloud.ts";
import {
  dictationDetail,
  dictationWords,
  normalizeForDictation,
  scoreDictation,
} from "./dictation.ts";

/** Below this a single mispronounced word moves the score too far to mean anything. */
const MIN_PASSAGE_WORDS = 10;

export interface QuestionDraft {
  type: QuestionType;
  body: Record<string, unknown>;
  expectedAnswer: Record<string, unknown>;
  rubric?: Record<string, unknown> | null;
}

/**
 * The outcome of marking one response.
 *
 * `fraction` is of the question's marks, not a mark count: the question owns how
 * much it is worth, the type module owns how much of it was earned.
 */
export interface GradeResult {
  fraction: number;
  status: "correct" | "partial" | "incorrect" | "unanswered";
  /** Why, in a form the review screen can show a teacher. */
  detail?: string;
}

export interface TypeModule {
  /** Problems that make the question unusable. Non-empty means reject. */
  validate(q: QuestionDraft): string[];
  /** Student-facing projection. Must never include answers or rubric. */
  sanitizeForStudent(q: QuestionDraft): Record<string, unknown>;
  defaultGradingMode: GradingMode;
  /** False when a mock generator cannot honestly produce this type. */
  mockable: boolean;
  /**
   * Marks a response — present only where marking is not a judgement call.
   * Its absence is the signal that a question needs a rubric grader or a
   * teacher, and callers must treat it as such rather than defaulting to zero.
   */
  grade?(q: QuestionDraft, response: Record<string, unknown>): GradeResult;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const UNANSWERED: GradeResult = { fraction: 0, status: "unanswered" };

/** Marks earned, with the status the dashboard needs to tell apart 0-of-3 from
 *  not-attempted: those are different diagnoses and drive different advice. */
function scored(fraction: number, attempted: boolean, detail?: string): GradeResult {
  if (!attempted) return UNANSWERED;
  const f = Math.max(0, Math.min(1, fraction));
  const status = f >= 1 ? "correct" : f > 0 ? "partial" : "incorrect";
  return { fraction: f, status, ...(detail ? { detail } : {}) };
}

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const multipleChoice: TypeModule = {
  defaultGradingMode: "deterministic",
  // Plausible distractors cannot be invented from an objective's title without
  // fabricating subject content. The existing quick-check generator already
  // takes this line for non-math topics; the evaluation module holds it too.
  mockable: false,
  validate(q) {
    const errors: string[] = [];
    const options = Array.isArray(q.body["options"]) ? (q.body["options"] as unknown[]) : [];
    if (!str(q.body["stem"])) errors.push("Question stem is empty");
    if (options.length < 3) errors.push("Multiple choice needs at least 3 options");

    const texts = options.map(o => str((o as Record<string, unknown>)?.["text"]));
    if (texts.some(t => !t)) errors.push("An option has no text");
    if (new Set(texts).size !== texts.length) errors.push("Duplicate options");

    const correct = Array.isArray(q.expectedAnswer["optionIds"])
      ? (q.expectedAnswer["optionIds"] as unknown[])
      : [];
    const ids = new Set(options.map(o => str((o as Record<string, unknown>)?.["id"])));
    if (correct.length === 0) errors.push("No correct option marked");
    if (!q.body["multiSelect"] && correct.length > 1) {
      errors.push("Single-answer question marks more than one option correct");
    }
    if (correct.some(id => !ids.has(str(id)))) errors.push("Correct option is not in the list");
    return errors;
  },
  sanitizeForStudent(q) {
    const options = Array.isArray(q.body["options"]) ? (q.body["options"] as unknown[]) : [];
    return {
      stem: q.body["stem"],
      multiSelect: q.body["multiSelect"] === true,
      options: options.map(o => ({
        id: (o as Record<string, unknown>)["id"],
        text: (o as Record<string, unknown>)["text"],
      })),
    };
  },
  grade(q, response) {
    const picked = asList(response["optionIds"]).map(str).filter(Boolean);
    if (picked.length === 0) return UNANSWERED;

    const correct = new Set(asList(q.expectedAnswer["optionIds"]).map(str));
    const chosen = new Set(picked);

    if (q.body["multiSelect"] !== true) {
      return scored(chosen.has([...correct][0] ?? "\u0000") && chosen.size === 1 ? 1 : 0, true);
    }

    // Multi-select: credit for each correct option, penalty for each wrong one,
    // floored at zero. Without the penalty, ticking every box scores full marks.
    const hits = [...chosen].filter(id => correct.has(id)).length;
    const misses = [...chosen].filter(id => !correct.has(id)).length;
    const fraction = correct.size === 0 ? 0 : (hits - misses) / correct.size;
    return scored(fraction, true);
  },
};

const trueFalse: TypeModule = {
  defaultGradingMode: "deterministic",
  // A true/false item needs a statement that is definitely true or definitely
  // false. Restating an objective as a claim produces something that is either
  // trivially true or accidentally wrong; neither measures anything.
  mockable: false,
  validate(q) {
    const errors: string[] = [];
    if (!str(q.body["statement"])) errors.push("Statement is empty");
    if (typeof q.expectedAnswer["value"] !== "boolean") errors.push("Answer must be true or false");
    return errors;
  },
  sanitizeForStudent(q) {
    return { statement: q.body["statement"] };
  },
  grade(q, response) {
    const given = response["value"];
    if (typeof given !== "boolean") return UNANSWERED;
    return scored(given === q.expectedAnswer["value"] ? 1 : 0, true);
  },
};

const matching: TypeModule = {
  defaultGradingMode: "deterministic",
  mockable: false,
  validate(q) {
    const errors: string[] = [];
    const left = Array.isArray(q.body["left"]) ? (q.body["left"] as unknown[]) : [];
    const right = Array.isArray(q.body["right"]) ? (q.body["right"] as unknown[]) : [];
    const pairs = Array.isArray(q.expectedAnswer["pairs"])
      ? (q.expectedAnswer["pairs"] as unknown[])
      : [];
    if (left.length < 2) errors.push("Matching needs at least 2 items on the left");
    if (right.length < 2) errors.push("Matching needs at least 2 items on the right");
    if (pairs.length !== left.length) errors.push("Every left item needs a matching pair");
    return errors;
  },
  sanitizeForStudent(q) {
    // Order here is the stored one. `shuffleForDelivery` in `studentView.ts`
    // reorders the right-hand column on the way out — it needs the question id
    // to keep that order stable across a resume, and a draft has no id.
    return { left: q.body["left"], right: q.body["right"] };
  },
  grade(q, response) {
    const given = asList(response["pairs"]);
    if (given.length === 0) return UNANSWERED;

    const key = new Map<string, string>();
    for (const p of asList(q.expectedAnswer["pairs"])) {
      const pair = p as Record<string, unknown>;
      key.set(str(pair["left"]), str(pair["right"]));
    }
    if (key.size === 0) return scored(0, true);

    // Per-pair credit: getting four of five links right is not the same as
    // getting none, and an all-or-nothing mark would report it as none.
    let hits = 0;
    for (const p of given) {
      const pair = p as Record<string, unknown>;
      const expected = key.get(str(pair["left"]));
      if (expected !== undefined && expected === str(pair["right"])) hits++;
    }
    return scored(hits / key.size, true);
  },
};

const fillBlank: TypeModule = {
  defaultGradingMode: "deterministic",
  mockable: false,
  validate(q) {
    const errors: string[] = [];
    const template = str(q.body["template"]);
    if (!template) errors.push("Template is empty");
    const placeholders = (template.match(/\{\{\d+\}\}/g) ?? []).length;
    if (placeholders === 0) errors.push("Template has no blanks");
    const blanks = Array.isArray(q.expectedAnswer["blanks"])
      ? (q.expectedAnswer["blanks"] as unknown[])
      : [];
    if (blanks.length !== placeholders) {
      errors.push(`Template has ${placeholders} blanks but ${blanks.length} answers`);
    }
    for (const b of blanks) {
      const accept = (b as Record<string, unknown>)?.["accept"];
      if (!Array.isArray(accept) || accept.length === 0) {
        errors.push("A blank has no accepted answers");
      }
    }
    return errors;
  },
  sanitizeForStudent(q) {
    // `template` only. The answers live in `expectedAnswer.blanks` and never
    // come near this projection, but `body.blanks` was passed through
    // unexamined and nothing renders it — the student screen builds its inputs
    // by counting {{n}} placeholders in the template. That made it a free
    // parking space for a generator to leave answers in, which stops being
    // hypothetical the moment a model writes these bodies.
    return { template: q.body["template"] };
  },
  grade(q, response) {
    const blanks = asList(q.expectedAnswer["blanks"]);
    const given = asList(response["blanks"]);
    if (blanks.length === 0) return scored(0, given.length > 0);
    if (given.every(v => !normalizeArabic(v))) return UNANSWERED;

    let hits = 0;
    for (let i = 0; i < blanks.length; i++) {
      const accept = asList((blanks[i] as Record<string, unknown>)?.["accept"]);
      if (accept.length === 0) continue;
      if (matchesAny(given[i], accept)) hits++;
    }
    return scored(hits / blanks.length, true);
  },
};

/** Open-response types share their shape; only the prompt fields differ. */
function openResponse(
  gradingMode: GradingMode,
  extraBodyKeys: string[],
  requireRubric: boolean,
): TypeModule {
  return {
    defaultGradingMode: gradingMode,
    mockable: true,
    validate(q) {
      const errors: string[] = [];
      if (!str(q.body["prompt"])) errors.push("Prompt is empty");
      if (!str(q.expectedAnswer["modelAnswer"])) errors.push("No model answer");
      const concepts = q.expectedAnswer["keyConcepts"];
      if (!Array.isArray(concepts) || concepts.length === 0) {
        // Without key concepts the AI grader has nothing to check meaning
        // against, and falls back to comparing wording — the exact failure the
        // brief forbids.
        errors.push("No key concepts to grade meaning against");
      }
      if (requireRubric && !q.rubric) errors.push("Open-ended question needs a rubric");
      return errors;
    },
    sanitizeForStudent(q) {
      const out: Record<string, unknown> = { prompt: q.body["prompt"] };
      for (const key of extraBodyKeys) out[key] = q.body[key];
      return out;
    },
  };
}

const practicalTask: TypeModule = {
  // Often performed away from a screen, so the teacher marks it. Treating it
  // as auto-gradable would measure whether the student typed something.
  defaultGradingMode: "manual",
  mockable: true,
  validate(q) {
    const errors: string[] = [];
    if (!str(q.body["prompt"])) errors.push("Prompt is empty");
    const criteria = q.expectedAnswer["successCriteria"];
    if (!Array.isArray(criteria) || criteria.length === 0) {
      errors.push("Practical task needs success criteria");
    }
    return errors;
  },
  sanitizeForStudent(q) {
    return {
      prompt: q.body["prompt"],
      materials: q.body["materials"],
      steps: q.body["steps"],
      submission: q.body["submission"] ?? "text",
    };
  },
};

/**
 * Read a passage aloud.
 *
 * The odd one out in two ways, both deliberate.
 *
 * **The reference text lives in `body`, and `expectedAnswer` stays empty.**
 * Every other type hides its key from the student; here the student must read
 * the passage off the screen, so the "answer" is the prompt. Putting it in
 * `body` means `sanitizeForStudent` can hand it over without a special case,
 * and — more usefully — there is no key left to leak. `studentView.test.ts`
 * blacklists any field whose name contains "answer" precisely so a future
 * refactor cannot quietly reintroduce one here.
 *
 * **It grades deterministically.** The passage is known, so word accuracy is a
 * measurement, not a judgement. A model asked to rate the reading would be
 * inferring fluency from a transcript that has already discarded the
 * pronunciation, and would return a confident number for it.
 *
 * `grade` stays synchronous like the rest of the registry: transcription
 * happens at upload time in `studentAttempt.ts`, which writes the transcript
 * into the stored response. Making one type async would turn `gradeAttempt`
 * and both its callers async for the other eight.
 */
const readAloud: TypeModule = {
  defaultGradingMode: "deterministic",
  // A mock generator would have to invent English prose at a controlled
  // reading level, which is exactly the "invent subject content" line the
  // other types decline to cross. Passages come from the curated manifest.
  mockable: false,
  validate(q) {
    const errors: string[] = [];
    const passage = str(q.body["passage"]);
    if (!passage) {
      errors.push("Passage is empty");
    } else {
      const words = normalizeForReading(passage).length;
      // Too short and one mispronounced word swings the score wildly; too long
      // and the student is reciting, not reading, well past the point the score
      // says anything new.
      if (words < MIN_PASSAGE_WORDS) errors.push(`Passage is ${words} words, minimum ${MIN_PASSAGE_WORDS}`);
      if (words > MAX_WORDS) errors.push(`Passage is ${words} words, maximum ${MAX_WORDS}`);
    }
    if (Object.keys(q.expectedAnswer).length > 0) {
      // Not pedantry: the passage is the reference, so anything parked in
      // `expectedAnswer` is either duplicated (and will drift out of sync with
      // what the student was shown) or is a key that does not belong here.
      errors.push("Read-aloud grades against body.passage; expectedAnswer must be empty");
    }
    return errors;
  },
  sanitizeForStudent(q) {
    return {
      passage: q.body["passage"],
      maxSeconds: q.body["maxSeconds"],
    };
  },
  grade(q, response) {
    const transcript = str(response["transcript"]);
    const attempted = Boolean(str(response["audioKey"]));
    // No recording at all is unanswered. A recording that transcribed to
    // nothing is an attempt that earned nothing — a different diagnosis, and
    // one a teacher should see, because it usually means a microphone problem
    // rather than a student who cannot read.
    if (!attempted) return UNANSWERED;

    const score = scoreReading(str(q.body["passage"]), transcript);
    const pct = Math.round(score.accuracy * 100);
    return scored(
      score.accuracy,
      true,
      `${pct}% of ${score.referenceWords} words matched (${score.errors} error${score.errors === 1 ? "" : "s"})`,
    );
  },
};

/**
 * Dictation (إملاء).
 *
 * Two response modes behind one type, because a teacher picks a *grade*, not a
 * response modality — the mode is a consequence of it. Grades 1–2 tap the
 * correctly spelled word among near misses (they cannot yet type); grades 3 and
 * up write what they heard.
 *
 * `mode` is read explicitly and never inferred from whether `options` is
 * present. Inferring would make a dropped array silently become write mode,
 * which is a six-year-old facing an Arabic keyboard. Fail loud instead.
 *
 * **Not folded into `fill_blank` with an audio field**, which looks like the
 * smaller change and is not: `fillBlank.grade` routes through `matchesAny` →
 * `normalizeArabic`, which marks «مدرسه» correct for «مدرسة». Reusing it would
 * mean a comparator-switching flag in jsonb, putting every fill-blank question
 * in the system one boolean away from marking differently. `short_answer` has
 * no deterministic grader at all, so a ten-word list would become ten
 * hand-marked questions.
 *
 * `audioUrl` is optional on purpose. Absent means the teacher reads the word
 * aloud, which covers demo mode, a spent AI budget, an unconfigured bucket, a
 * native device that cannot play audio, and a classroom with one screen — all
 * without a second code path.
 */
const dictation: TypeModule = {
  defaultGradingMode: "deterministic",
  // The key IS a spelling. A model that misspells it ships a wrong answer to a
  // whole class, and unlike maths there is no verifier to catch it — the words
  // come from the curriculum bank or from the teacher. Same line `read_aloud`
  // draws, for the same reason.
  mockable: false,
  validate(q) {
    const errors: string[] = [];
    const mode = str(q.body["mode"]);
    if (mode !== "write" && mode !== "choice") {
      errors.push('Dictation mode must be "write" or "choice"');
    }

    const audioUrl = str(q.body["audioUrl"]);
    if (audioUrl) {
      // This becomes an <audio src> on a student's device, so an unchecked
      // value is a fetch to any origin a generator or a paste can name. The
      // bucket-host pin lives on the route that mints these, which knows its
      // own bucket — validation must not depend on env or it would reject in
      // a test what it accepts in production.
      let parsed: URL | null = null;
      try {
        parsed = new URL(audioUrl);
      } catch {
        parsed = null;
      }
      if (!parsed || parsed.protocol !== "https:") errors.push("Audio URL must be https");
    }

    const playLimit = q.body["playLimit"];
    if (playLimit !== undefined) {
      if (typeof playLimit !== "number" || !Number.isInteger(playLimit) || playLimit < 1 || playLimit > 10) {
        errors.push("Play limit must be a whole number between 1 and 10");
      }
    }

    if (mode === "choice") {
      const options = asList(q.body["options"]);
      const texts = options.map(o => str((o as Record<string, unknown>)?.["text"]));
      const ids = options.map(o => str((o as Record<string, unknown>)?.["id"]));
      if (options.length < 3) errors.push("Dictation choice needs at least 3 spellings");
      if (options.length > 5) errors.push("Dictation choice takes at most 5 spellings");
      if (texts.some(t => !t)) errors.push("A spelling option has no text");
      if (new Set(texts).size !== texts.length) errors.push("Duplicate spellings");
      if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
        errors.push("Every spelling option needs a unique id");
      }

      const correct = asList(q.expectedAnswer["optionIds"]).map(str).filter(Boolean);
      if (correct.length !== 1) errors.push("Exactly one spelling is correct");
      if (correct.some(id => !ids.includes(id))) errors.push("Correct spelling is not in the list");
      // The correct spelling already lives in `body.options`. A second copy in
      // the key would drift from what the student was shown — the same
      // reasoning read_aloud gives for keeping its passage in `body`.
      if (str(q.expectedAnswer["text"])) {
        errors.push("Choice dictation grades by option id; expectedAnswer.text must be empty");
      }
    }

    if (mode === "write") {
      const text = q.expectedAnswer["text"];
      if (!normalizeForDictation(text)) errors.push("Dictation text is empty");
      if (asList(q.body["options"]).length > 0) {
        errors.push("Write dictation has no options to choose from");
      }
      const wordCount = q.body["wordCount"];
      if (wordCount !== undefined) {
        const actual = dictationWords(text).length;
        if (wordCount !== actual) errors.push(`wordCount says ${String(wordCount)} but the text has ${actual}`);
      }
    }
    return errors;
  },
  sanitizeForStudent(q) {
    const common = {
      mode: q.body["mode"],
      audioUrl: q.body["audioUrl"],
      playLimit: q.body["playLimit"],
    };
    if (str(q.body["mode"]) === "choice") {
      return {
        ...common,
        options: asList(q.body["options"]).map(o => ({
          id: (o as Record<string, unknown>)["id"],
          text: (o as Record<string, unknown>)["text"],
        })),
      };
    }
    // `wordCount` so the student screen can size its input without ever
    // holding the spelling it is sizing for.
    return { ...common, wordCount: q.body["wordCount"] };
  },
  grade(q, response) {
    if (str(q.body["mode"]) === "choice") {
      const picked = asList(response["optionIds"]).map(str).filter(Boolean);
      if (picked.length === 0) return UNANSWERED;
      const correct = asList(q.expectedAnswer["optionIds"]).map(str);
      const right = picked.length === 1 && correct.includes(picked[0]!);
      if (right) return scored(1, true);
      const chosen = asList(q.body["options"])
        .map(o => o as Record<string, unknown>)
        .find(o => str(o["id"]) === picked[0]);
      const answer = asList(q.body["options"])
        .map(o => o as Record<string, unknown>)
        .find(o => correct.includes(str(o["id"])));
      return scored(0, true, `اختار «${str(chosen?.["text"])}» والصواب «${str(answer?.["text"])}»`);
    }

    const written = response["text"];
    // An empty box is unanswered. Anything typed is an attempt that earned
    // what it earned — a different diagnosis, and one a teacher should see.
    if (!normalizeForDictation(written)) return UNANSWERED;

    const expected = str(q.expectedAnswer["text"]);
    const requireTashkeel = q.body["requireTashkeel"] === true;
    const score = scoreDictation(expected, written, { requireTashkeel });
    return scored(score.accuracy, true, dictationDetail(expected, written, score));
  },
};

export const QUESTION_TYPES: Record<QuestionType, TypeModule> = {
  multiple_choice: multipleChoice,
  true_false: trueFalse,
  matching,
  fill_blank: fillBlank,
  short_answer: openResponse("ai_rubric", [], false),
  open_ended: openResponse("ai_rubric", [], true),
  problem_solving: openResponse("ai_rubric", ["scenario"], true),
  practical_task: practicalTask,
  read_aloud: readAloud,
  dictation,
};

export function moduleFor(type: QuestionType): TypeModule | undefined {
  return QUESTION_TYPES[type];
}

/** Types a mock generator can produce without inventing subject content. */
export function mockableTypes(types: readonly QuestionType[]): QuestionType[] {
  return types.filter(t => QUESTION_TYPES[t]?.mockable);
}
