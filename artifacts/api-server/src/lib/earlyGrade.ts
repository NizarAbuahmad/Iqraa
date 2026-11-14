/**
 * What a difficulty level means for grades 2–4 (children of seven to nine).
 *
 * The all-grades meanings in `prompts.ts` ask for "two or three steps" at medium
 * and for "comparison, analysis, or an unfamiliar situation where the method must
 * be chosen first" at hard — pitched at the secondary classes they were written
 * for. Grade 1 has its own (`FIRST_GRADE_DIFFICULTY_*` in `firstGrade.ts`); these
 * are the step between (Grade 2–4 sweep, 2026-11-14). A level moves within the
 * lesson's own range, as the offline generators now do (`earlyDifficulty.ts` in
 * `@workspace/math-practice`), and hard stays a short task: two steps at most in
 * Grade 2, three in Grades 3–4, never an abstract analysis or a proof.
 */
import { isFirstGrade } from "./firstGrade.ts";

type GradeFields = { grade?: unknown; gradeId?: unknown; lessonId?: unknown; unitId?: unknown };

export type EarlyGrade = 2 | 3 | 4;

const NAMES: Record<string, EarlyGrade> = {
  "الصف الثاني": 2, "الثاني": 2, "grade 2": 2, "second grade": 2, "2": 2,
  "الصف الثالث": 3, "الثالث": 3, "grade 3": 3, "third grade": 3, "3": 3,
  "الصف الرابع": 4, "الرابع": 4, "grade 4": 4, "fourth grade": 4, "4": 4,
};

const bare = (s: string) => s.replace(/[ً-ْٰـ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/** Grade 2, 3 or 4 when the request is for one of them, by the same fields `isFirstGrade` reads; else null. */
export function earlyGradeOf(b: GradeFields): EarlyGrade | null {
  if (isFirstGrade(b as never)) return null;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const byId = /^kb[lu]-g([234])-/.exec(str(b.lessonId)) ?? /^kb[lu]-g([234])-/.exec(str(b.unitId)) ?? /^grade-([234])$/.exec(str(b.gradeId));
  if (byId) return Number(byId[1]) as EarlyGrade;
  if (b.grade === 2 || b.grade === 3 || b.grade === 4) return b.grade;
  const name = str(b.grade);
  return name ? NAMES[bare(name)] ?? null : null;
}

const STEPS_AR: Record<EarlyGrade, string> = { 2: "خطوتين على الأكثر", 3: "ثلاث خطوات على الأكثر", 4: "ثلاث خطوات على الأكثر" };
const STEPS_EN: Record<EarlyGrade, string> = { 2: "two steps at most", 3: "three steps at most", 4: "three steps at most" };

export function earlyDifficultyAr(g: EarlyGrade): Record<string, string> {
  return {
    easy: "سؤال مباشر من خطوة واحدة: تذكّر أو تعرّف أو حساب بسيط، بأعداد صغيرة من مدى الدرس وجملة قصيرة.",
    medium: "تطبيق مهارة الدرس على موقف مألوف من حياة الطفل، في خطوة أو خطوتين، بأعداد من مدى الدرس كله.",
    hard: `أكبر أعداد مدى الدرس، أو عدد مجهول، أو مسألة قصيرة من ${STEPS_AR[g]}، أو مقارنة بين شيئين يذكر الطالب سببها بجملة قصيرة — دون تحليل مجرّد أو برهان، ودون الخروج عن مدى الدرس.`,
    mixed: "وزّع الأسئلة على المستويات الثلاثة (سهل / متوسط / صعب)، وكلها ضمن مدى الدرس وبجمل قصيرة.",
  };
}

export function earlyDifficultyEn(g: EarlyGrade): Record<string, string> {
  return {
    easy: "A direct one-step question — recall, recognise or a simple calculation — with small numbers from the lesson's range, in a short sentence.",
    medium: "Use the lesson's skill in a familiar situation from a child's life, in one or two steps, with numbers from the lesson's whole range.",
    hard: `The lesson's largest numbers, an unknown number, a short problem of ${STEPS_EN[g]}, or comparing two things with the reason in one short sentence — never an abstract analysis or a proof, and never past the lesson's range.`,
    mixed: "Spread the questions across the three levels (easy / medium / hard), all within the lesson's range and in short sentences.",
  };
}

/** An evaluation's levels for grades 2–4 (`DIFFICULTY_NOTE` in `llmGenerator.ts` for grade 5 and up). */
export function earlyEvaluationDifficultyEn(g: EarlyGrade): Record<"basic" | "standard" | "advanced", string> {
  const m = earlyDifficultyEn(g);
  return { basic: m.easy!, standard: m.medium!, advanced: m.hard! };
}

/** The kinds whose prompt states a difficulty level (`difficultyClause*`, `quizDifficultyClause*`). */
export const EARLY_DIFFICULTY_KINDS: ReadonlySet<string> = new Set(["worksheet", "homework", "quiz"]);
/** Keys a grade 2–4 request of those kinds, so a paper pooled under the old level wording is not served again. */
export const EARLY_DIFFICULTY_VERSION = "2026-11-14";
