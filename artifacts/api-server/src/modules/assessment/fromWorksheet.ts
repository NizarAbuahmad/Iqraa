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
 * A question carrying a structured `format` is read first: «صِل» and «رتّب» →
 * matching, «أين الخطأ؟» → multiple choice over the step numbers, «ارسم» → a
 * short answer for the teacher. A format that fails its own validation is
 * ignored and the question goes through the rules above on its `text`.
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

/**
 * A structured question format, as the app sends it. The same union as the
 * app's `WorksheetQuestionFormat` (`services/ai/AIService.ts`) — the two
 * packages share no types, so this is a copy and both must move together.
 * `stem` is the instruction plus the problem, without the lines inlined into
 * `text`.
 */
export type WorksheetFormatInput =
  | { kind: "match"; stem: string; left: string[]; right: string[]; pairs: number[] }
  | { kind: "order"; stem: string; steps: string[]; order: number[] }
  | { kind: "spot_error"; stem: string; steps: string[]; wrongStep: number; fix: string; why: string }
  | { kind: "graph"; stem: string; exprs: string[]; window: { xMin: number; xMax: number; yMin: number; yMax: number } };

export interface WorksheetInput {
  sections: {
    questions: {
      text: string;
      options?: string[];
      points: number;
      figure?: { uri: string; caption: string };
      format?: WorksheetFormatInput;
    }[];
  }[];
  answerKey: { num: number; answer: string; solution?: string[] }[];
}

export interface ConvertedQuestion {
  type: "multiple_choice" | "true_false" | "fill_blank" | "short_answer" | "matching";
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

const ORDER_POSITIONS = {
  ar: ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة"],
  en: ["1st", "2nd", "3rd", "4th", "5th", "6th"],
} as const;
const ORDER_INSTRUCTION = { ar: "طابق كل خطوة بترتيبها في الحل.", en: "Match each step to its position in the solution." } as const;
const toArabicDigits = (n: number) => String(n).replace(/[0-9]/g, d => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
const stepLabel = (n: number, lang: "ar" | "en") => (lang === "en" ? `Step ${n}` : `الخطوة ${toArabicDigits(n)}`);

type Built = Pick<ConvertedQuestion, "type" | "body" | "expectedAnswer">;

const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isTexts = (v: unknown, min: number, max: number): v is string[] =>
  Array.isArray(v) && v.length >= min && v.length <= max && v.every(isText);
const isIndex = (v: unknown, n: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;

/**
 * A format turned into an evaluation question, or null when it fails its own
 * validation — the caller then falls through to the text rules, since `text`
 * still holds the whole question. Nothing here guesses: a pairing that is out
 * of range, an order that is not a permutation, a wrong step that does not
 * exist, all become the teacher's short answer rather than a stored question
 * that grades wrongly.
 *
 * The student's view is the type's own projection of `body`; the key lives in
 * `expectedAnswer` only. `fix` and `why` are never carried into either — a
 * multiple-choice key holds option ids and nothing else.
 */
function fromFormat(format: unknown, answer: string, entry: { solution?: string[] }, lang: "ar" | "en"): Built | null {
  if (!format || typeof format !== "object") return null;
  const f = format as Record<string, unknown>;
  if (!isText(f["stem"])) return null;
  const stem = f["stem"].trim();

  if (f["kind"] === "match") {
    const { left, right, pairs } = f;
    if (!isTexts(left, 2, 10) || !isTexts(right, 2, 10) || !Array.isArray(pairs)) return null;
    if (pairs.length !== left.length || !pairs.every(j => isIndex(j, right.length))) return null;
    if (new Set(pairs).size !== pairs.length) return null; // one left item per right item
    return {
      type: "matching",
      body: {
        stem,
        left: left.map((t, i) => ({ id: `l${i}`, text: t })),
        right: right.map((t, j) => ({ id: `r${j}`, text: t })),
      },
      expectedAnswer: { pairs: (pairs as number[]).map((j, i) => ({ left: `l${i}`, right: `r${j}` })) },
    };
  }

  if (f["kind"] === "order") {
    const { steps, order } = f;
    if (!isTexts(steps, 2, ORDER_POSITIONS.ar.length) || !Array.isArray(order) || order.length !== steps.length) return null;
    if (!order.every(k => isIndex(k, steps.length)) || new Set(order).size !== order.length) return null;
    return {
      type: "matching",
      body: {
        stem: `${ORDER_INSTRUCTION[lang]}\n${stem}`,
        left: steps.map((t, i) => ({ id: `s${i}`, text: t })),
        right: steps.map((_, k) => ({ id: `p${k}`, text: ORDER_POSITIONS[lang][k]! })),
      },
      expectedAnswer: { pairs: (order as number[]).map((stepIdx, k) => ({ left: `s${stepIdx}`, right: `p${k}` })) },
    };
  }

  if (f["kind"] === "spot_error") {
    const { steps, wrongStep } = f;
    if (!isTexts(steps, 3, OPTION_IDS.length) || !isIndex(wrongStep, steps.length)) return null;
    return {
      type: "multiple_choice",
      body: {
        // Numbered as the paper is («١)» on an Arabic one), so «الخطوة ٢» names a line the student can see.
        stem: `${stem}\n${steps.map((s, i) => `${lang === "ar" ? toArabicDigits(i + 1) : i + 1}) ${s}`).join("\n")}`,
        options: steps.map((_, i) => ({ id: OPTION_IDS[i]!, text: stepLabel(i + 1, lang) })),
      },
      expectedAnswer: { optionIds: [OPTION_IDS[wrongStep]!] },
    };
  }

  if (f["kind"] === "graph") {
    const { exprs, window: w } = f;
    if (!isTexts(exprs, 1, 10)) return null;
    const win = w as Record<string, unknown> | null;
    if (!win || !["xMin", "xMax", "yMin", "yMax"].every(k => Number.isFinite(win[k]))) return null;
    return {
      type: "short_answer",
      body: { prompt: [stem, ...exprsMissingFromStem(stem, exprs)].join("\n") },
      expectedAnswer: { modelAnswer: [answer, ...(entry.solution ?? [])].join("\n"), keyConcepts: [answer] },
    };
  }

  return null;
}

/**
 * The graph's equations a stem does not already state, as «y = …». A system
 * item's stem lists its equations, so appending every expression printed each
 * one twice. Spacing and notation do not count («y=x^2-2x» is «y = x² − 2x»).
 * Mirrors `exprsMissingFromStem` in the app's `services/ai/worksheetFormats.ts`.
 */
function exprsMissingFromStem(stem: string, exprs: string[]): string[] {
  const notation = (t: string) => t.replace(/−/g, "-").replace(/²/g, "^2").replace(/³/g, "^3").replace(/×/g, "*");
  const text = notation(stem);
  return exprs.filter(e => !statedIn(text, notation(`y = ${e}`).replace(/\s+/g, ""))).map(e => `y = ${e}`);
}

/**
 * `eq` (spacing removed) appears in `text` as a whole equation: what follows
 * the match is the end, or something that cannot continue the expression — so
 * «y=x» is not found inside «y = x + 1», while «y = x² − 2x» on one line and
 * «y = x» on the next are still two equations. Mirrors the app's copy.
 */
function statedIn(text: string, eq: string): boolean {
  const chars: string[] = [];
  const spaceBefore: boolean[] = [];
  let pending = false;
  for (const ch of text.split("")) {
    if (/\s/.test(ch)) { pending = true; continue; }
    chars.push(ch);
    spaceBefore.push(pending);
    pending = false;
  }
  const have = chars.join("");
  for (let i = have.indexOf(eq); i >= 0; i = have.indexOf(eq, i + 1)) {
    const k = i + eq.length;
    const next = have[k];
    if (next === undefined) return true;
    if (/[+\-*/^]/.test(next)) continue; // an operator continues it
    if (next === "." && /\d/.test(have[k + 1] ?? "")) continue; // so does a decimal point
    if (spaceBefore[k] || !/[0-9A-Za-z(_√]/.test(next)) return true;
  }
  return false;
}

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

    const built = fromFormat(paper.format, answer, entry, lang);
    if (built) return { ...built, body: withFigure(built.body), marks };

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
