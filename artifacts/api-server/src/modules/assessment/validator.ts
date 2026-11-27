/**
 * Validation gate between a generator and the database.
 *
 * Generated questions are never persisted raw, whether a template or a model
 * produced them. The failure this prevents is specific: an evaluation that
 * looks entirely reasonable on screen while measuring the wrong objective,
 * asking the same thing twice, or carrying a key the teacher never checked.
 *
 * Rejections are reported, not swallowed. A teacher who asked for 15 questions
 * and gets 12 must see that it was 12 — silently shipping a short evaluation is
 * how a level ends up computed from less evidence than anyone thinks.
 */
import type { QuestionType } from "@workspace/db";
import { normalizeArabic } from "@workspace/curriculum";
import { stemFrame } from "@workspace/math-practice";
import { hasSentence, sameAsk } from "@workspace/exam-paper";
import { QUESTION_TYPES } from "./questionTypes.ts";
import type { GeneratedQuestion } from "./mockGenerator.ts";
import { COMPETENCY_KEYS, COMPETENCY_LABELS_AR, type CompetencyKey } from "./competency.ts";
import { arDigits, optionLetterAr } from "./arabicNotes.ts";

/** Two per competency: the length from which `allocateQuestions` seeds all four. */
const SEED_EVERY_COMPETENCY_FROM = 2 * COMPETENCY_KEYS.length;

export interface ValidationIssue {
  index: number;
  reason: string;
}

export interface ValidationResult {
  accepted: GeneratedQuestion[];
  rejected: ValidationIssue[];
  warnings: string[];
  /** The same warnings in Arabic, one for one and in the same order. */
  warningsAr: string[];
}

/**
 * Similarity of two stems, 0–1, on normalized token overlap (Jaccard).
 *
 * Cheap and good enough for the job: two questions generated from the same
 * objective differ by a word or two, and that is exactly the duplicate a
 * teacher would otherwise have to spot by reading all fifteen.
 *
 * Short words («في», «ما») are noise and are dropped, but a number or a piece
 * of maths is kept whatever its length. Dropping those too made «حلّ المعادلة
 * x² + 3x − 18 = 0 بالتحليل» and «… x² − 11x + 28 = 0 …» score 1.0, so a
 * second, different equation was rejected as a duplicate — up to a third of a
 * maths paper's bank questions (measured 2026-10-15). The same sentence with
 * different numbers is a different question; `dominantKind` is what notices
 * when a paper has too many of them.
 */
export function stemSimilarity(a: string, b: string): number {
  const tokens = (s: string) =>
    new Set(
      normalizeArabic(s)
        .toLowerCase()
        .split(/[\s،,.:؛?؟!]+/)
        .filter(w => w.length > 2 || /[^\p{L}]/u.test(w)),
    );
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / (ta.size + tb.size - shared);
}

export const DUPLICATE_THRESHOLD = 0.85;

export function promptOf(q: GeneratedQuestion): string {
  const body = q.body;
  return (
    (body["prompt"] as string) ??
    (body["stem"] as string) ??
    (body["statement"] as string) ??
    (body["template"] as string) ??
    ""
  );
}

export interface ValidateOptions {
  allowedObjectiveIds: readonly string[];
  allowedTypes: readonly QuestionType[];
}

export function validateGenerated(
  questions: GeneratedQuestion[],
  options: ValidateOptions,
): ValidationResult {
  const accepted: GeneratedQuestion[] = [];
  const rejected: ValidationIssue[] = [];
  const warnings: string[] = [];
  const warningsAr: string[] = [];
  /** Each warning is said in both languages, so the two lists stay one for one. */
  const warn = (en: string, ar: string) => {
    warnings.push(en);
    warningsAr.push(ar);
  };

  const allowedObjectives = new Set(options.allowedObjectiveIds);
  const allowedTypes = new Set(options.allowedTypes);

  questions.forEach((q, index) => {
    const reject = (reason: string) => rejected.push({ index, reason });

    // 1. Scope. The single most important check: a question against an
    // objective the teacher did not choose is off-syllabus by definition.
    if (!allowedObjectives.has(q.objectiveId)) {
      reject(`Objective ${q.objectiveId} was not selected for this evaluation`);
      return;
    }

    // 2. Requested types only.
    if (!allowedTypes.has(q.type)) {
      reject(`Question type ${q.type} was not requested`);
      return;
    }

    // 3. Structure, per type.
    const typeModule = QUESTION_TYPES[q.type];
    if (!typeModule) {
      reject(`Unknown question type ${q.type}`);
      return;
    }
    const structural = typeModule.validate({
      type: q.type,
      body: q.body,
      expectedAnswer: q.expectedAnswer,
      rubric: q.rubric,
    });
    if (structural.length > 0) {
      reject(structural.join("; "));
      return;
    }

    // 4. A rubric is mandatory wherever a model decides the mark, or the
    // grader has nothing to justify its judgement against.
    if (q.gradingMode === "ai_rubric" && !q.rubric) {
      reject("AI-graded question has no rubric");
      return;
    }

    // 5. Marks must be positive — a zero-mark question contributes nothing to
    // a competency yet still occupies a student's time, and division by a zero
    // total breaks scoring outright.
    if (!(q.marks > 0)) {
      reject("Question carries no marks");
      return;
    }

    // 6. Near-duplicate stems.
    const prompt = promptOf(q);
    const clash = accepted.find(a => stemSimilarity(promptOf(a), prompt) > DUPLICATE_THRESHOLD);
    if (clash) {
      reject("Near-duplicate of an earlier question");
      return;
    }

    accepted.push(q);
  });

  // 7. Objective coverage. Not a rejection — a warning, because the teacher may
  // legitimately want a short evaluation. But they should know which of their
  // objectives went unmeasured before they publish.
  const covered = new Set(accepted.map(q => q.objectiveId));
  const uncovered = options.allowedObjectiveIds.filter(id => !covered.has(id));
  if (uncovered.length > 0) {
    warn(
      `${uncovered.length} selected objective(s) have no questions: ${uncovered.join(", ")}`,
      `من النتاجات التي اخترتها نتاجات لا يقيسها أي سؤال، وعددها ${arDigits(uncovered.length)}.`,
    );
  }

  // 8. Competency spread. A competency resting on one question is noise rather
  // than measurement, and the scoring rules will drop it from the level.
  const byCompetency = new Map<string, number>();
  for (const q of accepted) {
    byCompetency.set(q.competencyKey, (byCompetency.get(q.competencyKey) ?? 0) + 1);
  }
  for (const [competency, n] of byCompetency) {
    if (n < 2) {
      warn(
        `Competency "${competency}" has only ${n} question — too few to report a score from`,
        `في كفاية «${COMPETENCY_LABELS_AR[competency as CompetencyKey] ?? competency}» سؤال واحد فقط، وهو لا يكفي لحساب علامة لها.`,
      );
    }
  }

  // 8b. A competency with no questions at all. Check 8 only sees competencies
  // that are present, so one the writer skipped entirely went unmentioned. From
  // eight questions `allocateQuestions` seeds every competency with two, so a
  // paper that long has room for each; a shorter one may leave one out.
  if (accepted.length >= SEED_EVERY_COMPETENCY_FROM) {
    for (const competency of COMPETENCY_KEYS) {
      if (!byCompetency.has(competency)) {
        warn(
          `Competency "${competency}" has no questions — the paper cannot report a score for it`,
          `لا سؤال في كفاية «${COMPETENCY_LABELS_AR[competency]}»، فلن يُحسب لها مستوى من هذا الاختبار.`,
        );
      }
    }
  }

  // 8c. True/false statements nearly all one way. The prompt asks for about
  // half false; a paper where they are all true is answered by guessing "true".
  const tfValues = accepted
    .filter(q => q.type === "true_false" && typeof q.expectedAnswer["value"] === "boolean")
    .map(q => q.expectedAnswer["value"] as boolean);
  if (tfValues.length >= 4) {
    const trues = tfValues.filter(Boolean).length;
    const falses = tfValues.length - trues;
    if (Math.min(trues, falses) * 4 < tfValues.length) {
      const [count, word] = trues >= falses ? [trues, "true"] : [falses, "false"];
      const answer = word === "true" ? "صح" : "خطأ";
      warn(
        `${count} of ${tfValues.length} true/false statements are ${word} — a student who always answers «${answer}» passes them`,
        `إجابة ${arDigits(count)} من أصل ${arDigits(tfValues.length)} من عبارات الصواب والخطأ «${answer}»، فمن يجيب «${answer}» دائمًا يحصل على علاماتها.`,
      );
    }
  }

  // 8d. The right multiple-choice answer mostly in one position, among the
  // questions whose options were NOT shuffled (`choiceOrder.ts` stamps the ones
  // it shuffled): a textbook item, or options that point at each other.
  const positions: number[] = [];
  for (const q of accepted) {
    if (q.type !== "multiple_choice" || q.body["multiSelect"] === true) continue;
    // A fair shuffle bunches by chance; only an order someone chose says anything.
    if (q.aiMetadata["choiceOrder"] === "shuffled") continue;
    const options = q.body["options"];
    const key = q.expectedAnswer["optionIds"];
    if (!Array.isArray(options) || !Array.isArray(key) || key.length !== 1) continue;
    const at = options.findIndex(o => (o as { id?: unknown })?.id === key[0]);
    if (at >= 0) positions.push(at);
  }
  if (positions.length >= 5) {
    const tally = new Map<number, number>();
    for (const p of positions) tally.set(p, (tally.get(p) ?? 0) + 1);
    const [top, count] = [...tally.entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
    if (count * 2 > positions.length) {
      warn(
        `${count} of ${positions.length} multiple-choice answers are option ${top + 1} — a student could guess the position`,
        `الإجابة الصحيحة في ${arDigits(count)} من أصل ${arDigits(positions.length)} من أسئلة الاختيار من متعدد هي الخيار «${optionLetterAr(top)}»، فقد يخمّن الطالب موضعها.`,
      );
    }
  }

  // 9. One kind of question carrying the paper. Not a rejection: each question
  // is a real one, and two «حلّ المعادلة … بالتحليل» with different numbers is
  // ordinary practice. But when that one ask — in one sentence or reworded —
  // is a quarter of the paper, the teacher should know before they publish
  // what reads like a long exam and measures one skill.
  const dominant = dominantKind(accepted.map(promptOf));
  if (dominant) {
    warn(
      `${dominant.count} of ${accepted.length} questions ask the same thing, with different numbers or ` +
        `in other words: «${dominant.example}»`,
      `يسأل ${arDigits(dominant.count)} من أصل ${arDigits(accepted.length)} من الأسئلة الشيءَ نفسه بأرقام أخرى أو بصياغة أخرى: «${dominant.example}»`,
    );
  }

  return { accepted, rejected, warnings, warningsAr };
}

/**
 * The kind of question most of a paper asks, when it is at least three
 * questions and more than a quarter of them: the largest set of stems that are
 * each the same kind as one of them (`sameKind` on `stemFrame`), capped at
 * three words changed. «أوجد الكتلة المولية لغاز الأكسجين O₂» and «… لكربونات
 * الصوديوم Na₂CO₃» are one ask with a different compound, and «ما العدد الأكبر
 * بين…» / «ما العدد الأصغر بين…» one ask turned round; exact frames counted
 * them apart. The cap is what keeps a paper whose every stem quotes the
 * objective from counting as one ask (see `sameKind`). Measured 2026-10-17 on
 * the offline generator's 15-question papers for every lesson: exact frames
 * warned on 2.9%, uncapped kinds on 10% (nearly all for that reason), capped
 * kinds on 3.2%.
 *
 * Measured from each stem rather than by chaining, so two asks that each sit
 * near a third are not joined through it. Stems that are only symbols —
 * «٣ + ٤ = ؟» — have no sentence to share and are not counted.
 */
export function dominantKind(prompts: readonly string[]): { count: number; example: string } | null {
  const framed = prompts
    .map(prompt => ({ prompt, frame: stemFrame(prompt) }))
    .filter(({ frame }) => hasSentence(frame));
  let top: { count: number; example: string } = { count: 0, example: "" };
  for (const centre of framed) {
    const count = framed.filter(({ frame }) => sameAsk(centre.frame, frame)).length;
    if (count > top.count) top = { count, example: centre.prompt };
  }
  return top.count >= 3 && top.count * 4 > prompts.length ? top : null;
}
