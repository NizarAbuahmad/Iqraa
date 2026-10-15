/**
 * Homework rows on top of the family world (seedFamilies.ts), for the teacher
 * routes and — later — the student and parent ones.
 *
 * Each row exists to be either visible to exactly one family or to nobody, and
 * the comments say which. Raw SQL on purpose, like seedFamilies: tests should
 * state the rows they depend on, and @workspace/db cannot load under node --test.
 * Dates are relative to now() in SQL so the "14-day window" rows stay correct
 * whenever the suite runs.
 */
import type { Pool } from "pg";

import type { FamilyWorld } from "./seedFamilies.ts";

/** Unique titles, so a test can look a row up in a response body by title. */
export const HW_TITLES = {
  hwC1: "hw-c1",
  hwC1Exam: "hw-c1-exam",
  hwC1Draft: "hw-c1-draft",
  hwC2: "hw-c2",
  hwC3: "hw-c3",
  hwC5: "hw-c5",
  hwC4: "hw-c4-archived-class",
  hwArchived: "hw-archived",
  hwOld: "hw-old",
  hwRecentOverdue: "hw-recent-overdue",
} as const;

export const EXAM_TITLES = {
  examPublished: "exam-published-c1",
  examDraft: "exam-draft-c1",
  examOtherClass: "exam-published-c3",
  examOtherTeacher: "exam-published-c2-t2",
} as const;

export interface HomeworkWorld {
  /** Homework ids by key. */
  hw: {
    /** t1/c1, +3d — family A through Sara's row sA1 (and Adam); student A. */
    hwC1: string;
    /** t1/c1, +5d — carries the published exam. */
    hwC1Exam: string;
    /** t1/c1, +6d — carries a DRAFT exam, which a family must not be pointed at. */
    hwC1Draft: string;
    /** t2/c2, +2d — family A only through Sara's SECOND row sA2; student A (linked to sA1) must not see it. */
    hwC2: string;
    /** t1/c3, +4d — family B (Noor). */
    hwC3: string;
    /** t2/c5, +4d — family B (Yazan). */
    hwC5: string;
    /** t1/c4, +4d — c4 is an archived class: nobody. */
    hwC4: string;
    /** t1/c1, +4d, archived — nobody. */
    hwArchived: string;
    /** t1/c1, 30 days ago — outside the 14-day family window. */
    hwOld: string;
    /** t1/c1, 3 days ago — inside the window, overdue. */
    hwRecentOverdue: string;
  };
  exams: {
    /** Published, t1, attached to c1. */
    examPublished: string;
    /** Draft, t1, attached to c1. */
    examDraft: string;
    /** Published, t1, attached to c3 — t1's, but the wrong class for c1 homework. */
    examOtherClass: string;
    /** Published, t2, attached to c2 — another teacher's. */
    examOtherTeacher: string;
  };
}

async function id(pool: Pool, sql: string, params: unknown[]): Promise<string> {
  const r = await pool.query<{ id: string }>(sql, params);
  return r.rows[0].id;
}

function exam(
  pool: Pool,
  teacherId: string,
  classId: string,
  title: string,
  status: "draft" | "published",
  shareCode: string | null,
): Promise<string> {
  // grade_id, subject_id, book_id and teacher_id are the NOT NULL columns with no default.
  return id(
    pool,
    `INSERT INTO evaluations (teacher_id, class_group_id, title, grade_id, subject_id, book_id, status, share_code)
     VALUES ($1, $2, $3, 'grade-10', 'mathematics', 'book-test', $4, $5) RETURNING id`,
    [teacherId, classId, title, status, shareCode],
  );
}

function homework(
  pool: Pool,
  teacherId: string,
  classId: string,
  title: string,
  dueOffset: string,
  opts: { evaluationId?: string; archived?: boolean } = {},
): Promise<string> {
  // dueOffset is one of this file's own literals ('3 days', '-30 days'), never input.
  return id(
    pool,
    `INSERT INTO homework (teacher_id, class_group_id, title, due_at, evaluation_id, archived_at)
     VALUES ($1, $2, $3, now() + $4::interval, $5, CASE WHEN $6::boolean THEN now() END) RETURNING id`,
    [teacherId, classId, title, dueOffset, opts.evaluationId ?? null, opts.archived ?? false],
  );
}

export async function seedHomework(pool: Pool, w: FamilyWorld): Promise<HomeworkWorld> {
  const { t1, t2 } = w.users;
  const { c1, c2, c3, c4, c5 } = w.classes;

  const examPublished = await exam(pool, t1, c1, EXAM_TITLES.examPublished, "published", "HWPUB1");
  const examDraft = await exam(pool, t1, c1, EXAM_TITLES.examDraft, "draft", null);
  const examOtherClass = await exam(pool, t1, c3, EXAM_TITLES.examOtherClass, "published", "HWPUB3");
  const examOtherTeacher = await exam(pool, t2, c2, EXAM_TITLES.examOtherTeacher, "published", "HWPUB2");

  const hw = {
    hwC1: await homework(pool, t1, c1, HW_TITLES.hwC1, "3 days"),
    hwC1Exam: await homework(pool, t1, c1, HW_TITLES.hwC1Exam, "5 days", { evaluationId: examPublished }),
    hwC1Draft: await homework(pool, t1, c1, HW_TITLES.hwC1Draft, "6 days", { evaluationId: examDraft }),
    hwC2: await homework(pool, t2, c2, HW_TITLES.hwC2, "2 days"),
    hwC3: await homework(pool, t1, c3, HW_TITLES.hwC3, "4 days"),
    hwC5: await homework(pool, t2, c5, HW_TITLES.hwC5, "4 days"),
    hwC4: await homework(pool, t1, c4, HW_TITLES.hwC4, "4 days"),
    hwArchived: await homework(pool, t1, c1, HW_TITLES.hwArchived, "4 days", { archived: true }),
    hwOld: await homework(pool, t1, c1, HW_TITLES.hwOld, "-30 days"),
    hwRecentOverdue: await homework(pool, t1, c1, HW_TITLES.hwRecentOverdue, "-3 days"),
  };

  return { hw, exams: { examPublished, examDraft, examOtherClass, examOtherTeacher } };
}
