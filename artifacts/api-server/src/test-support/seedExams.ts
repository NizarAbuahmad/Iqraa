/**
 * Exams on top of the family world (seedFamilies.ts): one row per rule the
 * family exam lists and the class mark book must keep. Raw SQL, like the other
 * fixtures — tests state the rows they depend on, and @workspace/db cannot load
 * under node --test. Exam days are Amman calendar days computed from the clock
 * (Amman is a fixed UTC+3), so "upcoming" rows stay upcoming whenever this runs.
 */
import type { Pool } from "pg";

import type { FamilyWorld } from "./seedFamilies.ts";

/** Unique titles (`title` and `title_ar`), so a test can find a row, or prove it absent, by title. */
export const EX_TITLES = {
  exDated: "ex-dated-c1",
  exDraftDated: "ex-draft-dated-c1",
  exNoClass: "ex-dated-no-class",
  exC3: "ex-dated-c3-family-b",
  exPaper: "ex-quick-paper-c1",
  exPaperMulti: "ex-paper-two-questions-c1",
  exPaperDraft: "ex-quick-paper-draft-c1",
  exPaperNoClass: "ex-quick-paper-no-class",
  exPaperArchived: "ex-quick-paper-archived-c1",
  exGroup: "ex-quick-paper-group-adam",
  exNoScale: "ex-quick-paper-no-scale",
  exEmpty: "ex-no-questions-c1",
  exReleased: "ex-released-c1",
  exUnreleased: "ex-unreleased-c1",
} as const;
export type ExamKey = keyof typeof EX_TITLES;

export const ZAIN = "زين";

/** The Amman calendar day `offsetDays` from today, as YYYY-MM-DD. */
export function ammanDay(offsetDays: number, now: Date = new Date()): string {
  return new Date(now.getTime() + 3 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export interface ExamWorld {
  scaleId: string;
  exams: Record<ExamKey, string>;
  /** Live question ids. */
  questions: {
    exDated: string;
    exPaper: string;
    exPaperMulti: [string, string];
    exGroup: string;
    exNoScale: string;
    exReleased: string;
    exUnreleased: string;
  };
  dates: { exDated: string; exDraftDated: string; exNoClass: string; exC3: string; exPaper: string };
  /** Zain's roster row: t1, class c1, no account. */
  zain: string;
  attempts: { saraReleased: string; adamReleased: string; saraUnreleased: string; zainPaper: string };
}

async function id(pool: Pool, sql: string, params: unknown[]): Promise<string> {
  const r = await pool.query<{ id: string }>(sql, params);
  return r.rows[0].id;
}

async function levelScale(pool: Pool): Promise<string> {
  const scaleId = await id(pool, `INSERT INTO level_scales (name, is_default) VALUES ('test scale', true) RETURNING id`, []);
  const bands: Array<[string, number, number, number]> = [
    ["beginner", 0, 49.99, 0],
    ["developing", 50, 69.99, 1],
    ["proficient", 70, 84.99, 2],
    ["advanced", 85, 100, 3],
  ];
  for (const [key, min, max, order] of bands) {
    await pool.query(
      `INSERT INTO level_bands (scale_id, key, label_ar, label_en, min_percent, max_percent, sort_order)
       VALUES ($1, $2, $2, $2, $3, $4, $5)`,
      [scaleId, key, min, max, order],
    );
  }
  return scaleId;
}

interface ExamSpec {
  teacherId: string;
  classId: string | null;
  title: string;
  status: "draft" | "published" | "closed";
  scaleId: string | null;
  totalMarks: number;
  shareCode?: string;
  examDate?: string;
  examTime?: string;
  release?: boolean;
  archived?: boolean;
}

function exam(pool: Pool, s: ExamSpec): Promise<string> {
  // grade_id, subject_id, book_id and teacher_id are the NOT NULL columns with no default.
  return id(
    pool,
    `INSERT INTO evaluations
       (teacher_id, class_group_id, title, title_ar, grade_id, subject_id, book_id, status,
        share_code, share_code_expires_at, exam_date, exam_time, release_results_to_student,
        level_scale_id, total_marks, published_at, closed_at, archived_at)
     VALUES ($1, $2, $3, $3, 'grade-10', 'mathematics', 'book-test', $4::text,
        $5::text, CASE WHEN $5::text IS NULL THEN NULL ELSE now() + interval '7 days' END,
        $6, $7, $8, $9, $10,
        CASE WHEN $4::text <> 'draft' THEN now() END,
        CASE WHEN $4::text = 'closed' THEN now() END,
        CASE WHEN $11::boolean THEN now() END)
     RETURNING id`,
    [
      s.teacherId,
      s.classId,
      s.title,
      s.status,
      s.shareCode ?? null,
      s.examDate ?? null,
      s.examTime ?? null,
      s.release ?? false,
      s.scaleId,
      s.totalMarks.toFixed(2),
      s.archived ?? false,
    ],
  );
}

/** A paper question is what PUT /evaluations/:id/questions/paper writes: open_ended, empty body, manual. */
function question(pool: Pool, evaluationId: string, order: number, kind: "paper" | "digital", marks: number): Promise<string> {
  const paper = kind === "paper";
  return id(
    pool,
    `INSERT INTO evaluation_questions
       (evaluation_id, order_index, type, body, expected_answer, objective_id, competency_key, marks, grading_mode, source)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 'obj-test', 'understanding', $6, $7, 'teacher') RETURNING id`,
    [
      evaluationId,
      order,
      paper ? "open_ended" : "multiple_choice",
      JSON.stringify(paper ? {} : { stem: "2 + 2 = ?", options: ["3", "4"] }),
      JSON.stringify(paper ? {} : { correctIndex: 1 }),
      marks.toFixed(2),
      paper ? "manual" : "deterministic",
    ],
  );
}

function sitting(
  pool: Pool,
  evaluationId: string,
  studentId: string,
  source: "teacher_entry" | "student_link",
  status: string,
  submitted: boolean,
): Promise<string> {
  return id(
    pool,
    `INSERT INTO attempts (evaluation_id, student_id, source, status, started_at, submitted_at)
     VALUES ($1, $2, $3, $4, now(), CASE WHEN $5::boolean THEN now() END) RETURNING id`,
    [evaluationId, studentId, source, status, submitted],
  );
}

async function result(pool: Pool, attemptId: string, earned: number, total: number, levelKey: string, provisional: boolean) {
  await pool.query(
    `INSERT INTO attempt_results (attempt_id, earned_marks, total_marks, percent, level_key, is_provisional)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [attemptId, earned.toFixed(2), total.toFixed(2), ((earned / total) * 100).toFixed(2), levelKey, provisional],
  );
}

export async function seedExams(pool: Pool, w: FamilyWorld): Promise<ExamWorld> {
  const { t1 } = w.users;
  const { c1, c3 } = w.classes;
  const scaleId = await levelScale(pool);
  const dates = {
    exDated: ammanDay(5),
    exDraftDated: ammanDay(4),
    exNoClass: ammanDay(4),
    exC3: ammanDay(6),
    exPaper: ammanDay(3),
  };
  const base = { teacherId: t1, scaleId };

  const exams = {
    exDated: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exDated, status: "published", totalMarks: 10, shareCode: "EXDAT1", examDate: dates.exDated, examTime: "09:30" }),
    exDraftDated: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exDraftDated, status: "draft", totalMarks: 0, examDate: dates.exDraftDated, examTime: "10:00" }),
    exNoClass: await exam(pool, { ...base, classId: null, title: EX_TITLES.exNoClass, status: "published", totalMarks: 10, shareCode: "EXNOC1", examDate: dates.exNoClass }),
    exC3: await exam(pool, { ...base, classId: c3, title: EX_TITLES.exC3, status: "published", totalMarks: 10, shareCode: "EXC3B1", examDate: dates.exC3 }),
    exPaper: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exPaper, status: "published", totalMarks: 20, shareCode: "EXPAP1", examDate: dates.exPaper, examTime: "08:00" }),
    exPaperMulti: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exPaperMulti, status: "published", totalMarks: 20, shareCode: "EXPAP2" }),
    exPaperDraft: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exPaperDraft, status: "draft", totalMarks: 20 }),
    exPaperNoClass: await exam(pool, { ...base, classId: null, title: EX_TITLES.exPaperNoClass, status: "published", totalMarks: 20, shareCode: "EXPAP3" }),
    exPaperArchived: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exPaperArchived, status: "closed", totalMarks: 20, shareCode: "EXPAP4", archived: true }),
    exGroup: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exGroup, status: "published", totalMarks: 20, shareCode: "EXGRP1" }),
    exNoScale: await exam(pool, { teacherId: t1, scaleId: null, classId: c1, title: EX_TITLES.exNoScale, status: "published", totalMarks: 20, shareCode: "EXNSC1" }),
    exEmpty: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exEmpty, status: "published", totalMarks: 0, shareCode: "EXEMP1" }),
    exReleased: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exReleased, status: "published", totalMarks: 10, shareCode: "EXREL1", examDate: ammanDay(-2), release: true }),
    exUnreleased: await exam(pool, { ...base, classId: c1, title: EX_TITLES.exUnreleased, status: "published", totalMarks: 10, shareCode: "EXUNR1", examDate: ammanDay(-1) }),
  } satisfies Record<ExamKey, string>;

  const questions = {
    exDated: await question(pool, exams.exDated, 0, "digital", 10),
    exPaper: await question(pool, exams.exPaper, 0, "paper", 20),
    exPaperMulti: [
      await question(pool, exams.exPaperMulti, 0, "paper", 10),
      await question(pool, exams.exPaperMulti, 1, "paper", 10),
    ] as [string, string],
    exGroup: await question(pool, exams.exGroup, 0, "paper", 20),
    exNoScale: await question(pool, exams.exNoScale, 0, "paper", 20),
    exReleased: await question(pool, exams.exReleased, 0, "digital", 10),
    exUnreleased: await question(pool, exams.exUnreleased, 0, "digital", 10),
  };
  await question(pool, exams.exNoClass, 0, "digital", 10);
  await question(pool, exams.exC3, 0, "digital", 10);
  await question(pool, exams.exPaperDraft, 0, "paper", 20);
  await question(pool, exams.exPaperNoClass, 0, "paper", 20);
  await question(pool, exams.exPaperArchived, 0, "paper", 20);

  // A group check for Adam alone (support groups): a student-level assignment row.
  await pool.query(`INSERT INTO evaluation_assignments (evaluation_id, student_id, assigned_by) VALUES ($1, $2, $3)`, [
    exams.exGroup,
    w.students.aA,
    t1,
  ]);

  const saraReleased = await sitting(pool, exams.exReleased, w.students.sA1, "student_link", "graded", true);
  await result(pool, saraReleased, 8, 10, "proficient", false);
  const adamReleased = await sitting(pool, exams.exReleased, w.students.aA, "student_link", "needs_review", true);
  await result(pool, adamReleased, 0, 10, "beginner", true);
  const saraUnreleased = await sitting(pool, exams.exUnreleased, w.students.sA1, "student_link", "graded", true);
  await result(pool, saraUnreleased, 9, 10, "advanced", false);

  const zain = await id(pool, `INSERT INTO students (teacher_id, display_name) VALUES ($1, $2) RETURNING id`, [t1, ZAIN]);
  await pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [c1, zain]);
  const zainPaper = await sitting(pool, exams.exPaper, zain, "student_link", "in_progress", false);
  await pool.query(`INSERT INTO attempt_answers (attempt_id, question_id, response) VALUES ($1, $2, '{"text":"on paper"}'::jsonb)`, [
    zainPaper,
    questions.exPaper,
  ]);

  return {
    scaleId,
    exams,
    questions,
    dates,
    zain,
    attempts: { saraReleased, adamReleased, saraUnreleased, zainPaper },
  };
}
