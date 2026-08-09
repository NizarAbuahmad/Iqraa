/**
 * Evaluation authoring — the evaluation and its questions.
 *
 * The one structural decision worth stating: everything type-specific about a
 * question lives in jsonb (`body`, `expectedAnswer`, `rubric`), and the columns
 * stay the same for all eight assessment types. A ninth type is then one module
 * in the question-type registry plus one string — not a migration and a new set
 * of nullable columns that only apply to some rows.
 */
import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  numeric,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";
import { levelScales, type CompetencyKey } from "./assessmentConfig";

export type EvaluationStatus = "draft" | "published" | "closed";
export type Difficulty = "basic" | "standard" | "advanced";

export type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "matching"
  | "fill_blank"
  | "short_answer"
  | "open_ended"
  | "problem_solving"
  | "practical_task";

/**
 * How a question's marks are decided.
 *  deterministic     — exact/normalized comparison. Not a judgement.
 *  math_equivalence  — SymPy proves the student's answer equals the key.
 *  ai_rubric         — a model judges against a rubric. Carries confidence.
 *  manual            — teacher only (e.g. an offline practical task).
 */
export type GradingMode = "deterministic" | "math_equivalence" | "ai_rubric" | "manual";

/** Where the question came from. Matters for trust and for regeneration. */
export type QuestionSource = "ai" | "teacher" | "ai_edited";

export const evaluations = pgTable(
  "evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    titleAr: text("title_ar").notNull().default(""),

    // Curriculum scope — ids from @workspace/curriculum, resolved server-side.
    gradeId: text("grade_id").notNull(),
    subjectId: text("subject_id").notNull(),
    bookId: text("book_id").notNull(),
    unitId: text("unit_id"),
    lessonId: text("lesson_id"),
    /** At least one. Generation refuses to run unscoped. */
    objectiveIds: jsonb("objective_ids").$type<string[]>().notNull().default([]),

    difficulty: text("difficulty").$type<Difficulty>().notNull().default("standard"),
    targetQuestionCount: integer("target_question_count").notNull().default(10),
    assessmentTypes: jsonb("assessment_types").$type<QuestionType[]>().notNull().default([]),
    language: text("language").notNull().default("ar"),

    status: text("status").$type<EvaluationStatus>().notNull().default("draft"),
    /**
     * Bumped when a published evaluation is edited. In-flight attempts keep the
     * snapshot they started with, so a mid-flight edit cannot corrupt a result
     * that is already half-answered.
     */
    version: integer("version").notNull().default(1),

    levelScaleId: uuid("level_scale_id").references(() => levelScales.id),
    timeLimitMin: integer("time_limit_min"),
    shuffleQuestions: boolean("shuffle_questions").notNull().default(false),
    releaseResultsToStudent: boolean("release_results_to_student").notNull().default(false),

    /** Denormalized sum of question marks; recomputed on every question write. */
    totalMarks: numeric("total_marks", { precision: 6, scale: 2 }).notNull().default("0"),

    /** Exact request handed to the generator — makes a result reproducible. */
    generationParams: jsonb("generation_params").$type<Record<string, unknown>>().notNull().default({}),
    generator: text("generator").$type<"mock" | "llm">().notNull().default("mock"),
    modelId: text("model_id"),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    index("evaluations_teacher_idx").on(t.teacherId),
    index("evaluations_status_idx").on(t.status),
  ],
);

export const evaluationQuestions = pgTable(
  "evaluation_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull().default(0),
    type: text("type").$type<QuestionType>().notNull(),

    /** Type-specific prompt/options/scenario. See the plan doc §2.5. */
    body: jsonb("body").$type<Record<string, unknown>>().notNull().default({}),
    /** Answer key. **Never** included in a student-facing projection. */
    expectedAnswer: jsonb("expected_answer").$type<Record<string, unknown>>().notNull().default({}),
    /** Required when gradingMode is 'ai_rubric'. Also never sent to a student. */
    rubric: jsonb("rubric").$type<Record<string, unknown> | null>(),

    objectiveId: text("objective_id").notNull(),
    /**
     * The competency this question actually measures. Carried per question
     * rather than inherited from the objective, because most catalog objectives
     * have a defaulted Bloom's level — inheriting would put nearly every
     * question in one competency and make the breakdown meaningless.
     */
    competencyKey: text("competency_key").$type<CompetencyKey>().notNull(),
    skill: text("skill"),
    difficulty: text("difficulty").$type<Difficulty>().notNull().default("standard"),
    marks: numeric("marks", { precision: 5, scale: 2 }).notNull().default("1"),
    gradingMode: text("grading_mode").$type<GradingMode>().notNull().default("deterministic"),
    source: text("source").$type<QuestionSource>().notNull().default("ai"),

    /** Model, prompt hash, generation timestamp — provenance for AI output. */
    aiMetadata: jsonb("ai_metadata").$type<Record<string, unknown> | null>(),
    /**
     * SymPy's verdict on the ANSWER KEY at authoring time. A key the verifier
     * contradicts is dropped before a teacher ever sees the question.
     */
    verification: jsonb("verification").$type<Record<string, unknown> | null>(),

    /** Soft delete: a published evaluation's questions may be referenced by attempts. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    index("evaluation_questions_eval_order_idx").on(t.evaluationId, t.orderIndex),
    index("evaluation_questions_objective_idx").on(t.objectiveId),
  ],
);

export const insertEvaluationSchema = createInsertSchema(evaluations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  closedAt: true,
});

export const insertEvaluationQuestionSchema = createInsertSchema(evaluationQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export type Evaluation = typeof evaluations.$inferSelect;
export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;
export type EvaluationQuestion = typeof evaluationQuestions.$inferSelect;
export type InsertEvaluationQuestion = z.infer<typeof insertEvaluationQuestionSchema>;
