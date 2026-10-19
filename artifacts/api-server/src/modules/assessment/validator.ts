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

export interface ValidationIssue {
  index: number;
  reason: string;
}

export interface ValidationResult {
  accepted: GeneratedQuestion[];
  rejected: ValidationIssue[];
  warnings: string[];
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
    warnings.push(
      `${uncovered.length} selected objective(s) have no questions: ${uncovered.join(", ")}`,
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
      warnings.push(
        `Competency "${competency}" has only ${n} question — too few to report a score from`,
      );
    }
  }

  // 9. One kind of question carrying the paper. Not a rejection: each question
  // is a real one, and two «حلّ المعادلة … بالتحليل» with different numbers is
  // ordinary practice. But when that one ask — in one sentence or reworded —
  // is a quarter of the paper, the teacher should know before they publish
  // what reads like a long exam and measures one skill.
  const sameAsk = dominantKind(accepted.map(promptOf));
  if (sameAsk) {
    warnings.push(
      `${sameAsk.count} of ${accepted.length} questions ask the same thing, with different numbers or ` +
        `in other words: «${sameAsk.example}»`,
    );
  }

  return { accepted, rejected, warnings };
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
