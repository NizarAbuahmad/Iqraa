/**
 * A worksheet, as the app generates or saves it, turned into evaluation
 * questions a class can take on `take/[code]`.
 *
 * The rule for what is marked automatically: only what the existing graders
 * judge without guessing.
 *  - multiple choice, ≥3 options, the key matching one of them → by option id;
 *  - «صح / خطأ» → true_false;
 *  - a key that is a plain number or `<letter> = <number>` → fill_blank, marked
 *    by `answersMatch` (digit styles, spacing, minus signs);
 *  - everything else → short_answer, for the teacher.
 * The printed writing space under a question is dropped first — on screen it
 * is a box, and its rules would read as a blank to fill.
 * A key that matches no option, an Arabic or expression answer, a half-solved
 * question: all short answers. A wrong automatic mark is worse than a question
 * waiting for a person. A question with no key at all stops the conversion —
 * inventing one is the only thing worse than asking.
 *
 * Questions are numbered straight through the sections and matched to the
 * answer key by that number, as every other worksheet consumer does.
 */
import { normalizeArabic } from "./normalize.ts";
import { studentFigure } from "./questionFigure.ts";

export interface WorksheetInput {
  sections: {
    questions: {
      text: string;
      options?: string[];
      points: number;
      figure?: { uri: string; caption: string };
    }[];
  }[];
  answerKey: { num: number; answer: string; solution?: string[] }[];
}

export interface ConvertedQuestion {
  type: "multiple_choice" | "true_false" | "fill_blank" | "short_answer";
  body: Record<string, unknown>;
  expectedAnswer: Record<string, unknown>;
  marks: number;
}

export type ConvertResult =
  | { ok: true; questions: ConvertedQuestion[]; autoMarked: number; teacherMarked: number }
  /** 1-based numbers on the paper. */
  | { ok: false; missingKey: number[] };

/** «أ) », «ب. », "a) ", "1- " — a marker a model baked into an option's text. */
const OPTION_MARKER = /^\s*(?:[ء-يa-dA-D]|\d{1,2})\s*[).:\-]\s+/u;
/** `3`, `-0.5`, `٣`, `x = 2` — one Latin letter at most, no other words. */
const NUMERIC_KEY = /^\s*(?:([A-Za-z])\s*=\s*)?([-−]?[0-9٠-٩]+(?:[.,٫][0-9٠-٩]+)?)\s*$/u;
/** A line that is only a blank — the half-solved question's «3) __________». */
const BLANK_LINE = /^\s*(\(?[0-9٠-٩]+[).]?)?\s*_{5,}\s*$/mu;
/**
 * The writing space a printed sheet leaves under a question — «الإجابة:» or
 * «مساحة العمل:» and its rules (`generateWorksheet`, homework). On screen the
 * student has a box, and left in, its rules read as blanks above.
 */
const WRITING_SPACE = /\s*(?:الإجابة|مساحة العمل|Answer|Work space)\s*:\s*(?:\n\s*_{5,}\s*)+$/iu;
const OPTION_IDS = "abcdefghij";

const comparable = (s: string) => normalizeArabic(s.replace(OPTION_MARKER, ""));
const TRUE_WORDS = new Set(["صح", "صحيح", "true"].map(comparable));
const FALSE_WORDS = new Set(["خطأ", "خطا", "false"].map(comparable));
const isTruthWord = (s: string) => TRUE_WORDS.has(comparable(s)) || FALSE_WORDS.has(comparable(s));

export function convertWorksheet(ws: WorksheetInput, lang: "ar" | "en" = "ar"): ConvertResult {
  const flat = ws.sections.flatMap(s => s.questions);
  const keyFor = (n: number) => ws.answerKey.find(k => k.num === n);

  const missingKey = flat.map((_, i) => i + 1).filter(n => !keyFor(n)?.answer?.trim());
  if (missingKey.length > 0) return { ok: false, missingKey };

  const questions = flat.map((paper, i): ConvertedQuestion => {
    const q = { ...paper, text: paper.text.replace(WRITING_SPACE, "").trim() };
    const entry = keyFor(i + 1)!;
    const answer = entry.answer.trim();
    const options = q.options ?? [];
    const marks = q.points > 0 ? q.points : 1;
    const figure = studentFigure(q as unknown as Record<string, unknown>);
    const withFigure = (body: Record<string, unknown>) => (figure ? { ...body, figure } : body);

    if (options.length === 2 && options.every(isTruthWord) && isTruthWord(answer)) {
      return {
        type: "true_false",
        body: withFigure({ statement: q.text }),
        expectedAnswer: { value: TRUE_WORDS.has(comparable(answer)) },
        marks,
      };
    }

    const hit = options.findIndex(o => comparable(o) === comparable(answer));
    if (options.length >= 3 && options.length <= OPTION_IDS.length && hit >= 0) {
      return {
        type: "multiple_choice",
        body: withFigure({
          stem: q.text,
          options: options.map((o, j) => ({ id: OPTION_IDS[j], text: o.replace(OPTION_MARKER, "").trim() })),
        }),
        expectedAnswer: { optionIds: [OPTION_IDS[hit]] },
        marks,
      };
    }

    const numeric = NUMERIC_KEY.exec(answer);
    if (options.length === 0 && numeric && !BLANK_LINE.test(q.text)) {
      return {
        type: "fill_blank",
        body: withFigure({ template: `${q.text}\n${lang === "en" ? "Answer" : "الإجابة"}: {{1}}` }),
        expectedAnswer: { blanks: [{ accept: numeric[1] ? [answer, numeric[2]!] : [answer] }] },
        marks,
      };
    }

    return {
      type: "short_answer",
      body: withFigure({ prompt: q.text }),
      expectedAnswer: { modelAnswer: [answer, ...(entry.solution ?? [])].join("\n"), keyConcepts: [answer] },
      marks,
    };
  });

  const autoMarked = questions.filter(q => q.type !== "short_answer").length;
  return { ok: true, questions, autoMarked, teacherMarked: questions.length - autoMarked };
}
