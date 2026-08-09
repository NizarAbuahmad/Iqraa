/**
 * Delivery, grading and results.
 *
 * `attempts.source` is the seam that lets teacher answer-entry ship first and
 * the student link arrive later without a second pipeline: both produce the
 * same attempt rows, and nothing downstream of grading reads the field.
 *
 * Grades are append-only in spirit — a teacher override writes a row to
 * `gradeOverrides` and updates the grade, so "the AI said 2, the teacher said 3"
 * stays answerable. Silently mutating a mark loses the one piece of evidence
 * that shows whether the AI grader can be trusted.
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
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { students, classGroups } from "./students";
import { evaluations, evaluationQuestions } from "./evaluations";
import { levelScales, type LevelKey } from "./assessmentConfig";

export type AttemptSource = "teacher_entry" | "student_link";

export type AttemptStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "grading"
  | "graded"
  | "needs_review"
  | "abandoned";

export type Verdict = "correct" | "partial" | "incorrect" | "unanswered";

/** Who produced a mark. Drives the trust badge the teacher sees. */
export type Grader = "deterministic" | "math_verifier" | "ai" | "teacher";

export const evaluationAssignments = pgTable(
  "evaluation_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    /** Exactly one of studentId / classGroupId is set. */
    studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
    classGroupId: uuid("class_group_id").references(() => classGroups.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [index("evaluation_assignments_eval_idx").on(t.evaluationId)],
);

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    assignmentId: uuid("assignment_id").references(() => evaluationAssignments.id, {
      onDelete: "set null",
    }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),

    source: text("source").$type<AttemptSource>().notNull().default("teacher_entry"),
    /** Set when source is 'teacher_entry' — who typed the answers in. */
    enteredBy: uuid("entered_by").references(() => users.id, { onDelete: "set null" }),

    status: text("status").$type<AttemptStatus>().notNull().default("not_started"),

    /** Student-link only. The raw token is never stored, only its hash. */
    accessTokenHash: text("access_token_hash").unique(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),

    /**
     * Questions frozen at start. An attempt is graded against what the student
     * was actually shown, so editing a published evaluation cannot retroactively
     * change what someone was asked.
     */
    questionSnapshot: jsonb("question_snapshot").$type<unknown[]>().notNull().default([]),
    /** Level scale frozen at start — see assessmentConfig.ts for why. */
    levelScaleSnapshot: jsonb("level_scale_snapshot").$type<Record<string, unknown>>().notNull().default({}),

    startedAt: timestamp("started_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
    timeSpentSec: integer("time_spent_sec").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    index("attempts_evaluation_idx").on(t.evaluationId),
    index("attempts_student_idx").on(t.studentId),
    index("attempts_status_idx").on(t.status),
  ],
);

export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => evaluationQuestions.id, { onDelete: "cascade" }),
    /** Shape mirrors the question type. See the plan doc §2.5. */
    response: jsonb("response").$type<Record<string, unknown>>().notNull().default({}),
    isFinal: boolean("is_final").notNull().default(false),
    answeredAt: timestamp("answered_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [unique("attempt_answers_unique").on(t.attemptId, t.questionId)],
);

export const attemptQuestionGrades = pgTable(
  "attempt_question_grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => evaluationQuestions.id, { onDelete: "cascade" }),
    awardedMarks: numeric("awarded_marks", { precision: 5, scale: 2 }).notNull().default("0"),
    maxMarks: numeric("max_marks", { precision: 5, scale: 2 }).notNull().default("0"),
    verdict: text("verdict").$type<Verdict>().notNull(),
    grader: text("grader").$type<Grader>().notNull(),
    /**
     * Null for deterministic and math_verifier grades — those are not guesses,
     * and giving them a confidence number would imply they might be wrong in the
     * same way an AI judgement can be.
     */
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    needsReview: boolean("needs_review").notNull().default(false),
    rationaleAr: text("rationale_ar").notNull().default(""),
    rationaleEn: text("rationale_en").notNull().default(""),
    /** Matched key concepts, SymPy's computed answer, criteria breakdown. */
    evidence: jsonb("evidence").$type<Record<string, unknown> | null>(),
    gradedAt: timestamp("graded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    unique("attempt_question_grades_unique").on(t.attemptId, t.questionId),
    index("attempt_question_grades_review_idx").on(t.needsReview),
  ],
);

/** Append-only audit trail. Never mutate a grade without writing one of these. */
export const gradeOverrides = pgTable(
  "grade_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => evaluationQuestions.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    oldMarks: numeric("old_marks", { precision: 5, scale: 2 }).notNull(),
    newMarks: numeric("new_marks", { precision: 5, scale: 2 }).notNull(),
    oldVerdict: text("old_verdict").$type<Verdict>().notNull(),
    newVerdict: text("new_verdict").$type<Verdict>().notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [index("grade_overrides_attempt_idx").on(t.attemptId)],
);

export const attemptResults = pgTable("attempt_results", {
  attemptId: uuid("attempt_id")
    .primaryKey()
    .references(() => attempts.id, { onDelete: "cascade" }),
  earnedMarks: numeric("earned_marks", { precision: 6, scale: 2 }).notNull().default("0"),
  totalMarks: numeric("total_marks", { precision: 6, scale: 2 }).notNull().default("0"),
  percent: numeric("percent", { precision: 5, scale: 2 }).notNull().default("0"),
  /**
   * Per competency: { earned, total, percent, questionCount, sufficient }.
   * `sufficient` is false when the competency rests on fewer than two questions
   * or under 10% of total marks — reported as "not enough evidence" rather than
   * as a percentage, because one question is noise, not measurement.
   */
  competencyScores: jsonb("competency_scores").$type<Record<string, unknown>>().notNull().default({}),
  objectiveScores: jsonb("objective_scores").$type<Record<string, unknown>>().notNull().default({}),
  levelKey: text("level_key").$type<LevelKey | null>(),
  levelScaleId: uuid("level_scale_id").references(() => levelScales.id),
  levelScaleVersion: integer("level_scale_version").notNull().default(1),
  /** True while low-confidence AI marks await teacher review. */
  isProvisional: boolean("is_provisional").notNull().default(false),
  computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
});

export type RecommendationKind = "review" | "practice" | "activity" | "reassess";

export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    kind: text("kind").$type<RecommendationKind>().notNull(),
    objectiveId: text("objective_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** 'rule' recommendations are the floor — the panel is never empty. */
    generatedBy: text("generated_by").$type<"rule" | "ai">().notNull().default("rule"),
    confidence: numeric("confidence", { precision: 4, scale: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [index("recommendations_attempt_idx").on(t.attemptId)],
);

export const gradingJobs = pgTable(
  "grading_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    status: text("status")
      .$type<"queued" | "running" | "done" | "failed">()
      .notNull()
      .default("queued"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [index("grading_jobs_status_idx").on(t.status)],
);

export type EvaluationAssignment = typeof evaluationAssignments.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type AttemptAnswer = typeof attemptAnswers.$inferSelect;
export type AttemptQuestionGrade = typeof attemptQuestionGrades.$inferSelect;
export type GradeOverride = typeof gradeOverrides.$inferSelect;
export type AttemptResult = typeof attemptResults.$inferSelect;
export type Recommendation = typeof recommendations.$inferSelect;
export type GradingJob = typeof gradingJobs.$inferSelect;
