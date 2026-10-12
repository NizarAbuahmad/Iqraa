/**
 * The fixture for cross-family access tests: two families whose children are
 * taught by two teachers, plus the awkward rows that must NOT show up — an
 * archived roster row, an archived class, a class with no slots, a slot with
 * no class, and teachers' private slot notes.
 *
 * Raw SQL on purpose: @workspace/db cannot be imported under node --test
 * (extensionless re-exports), and tests should state the rows they depend on.
 */
import type { Pool } from "pg";

export const CHILDREN = { sara: "سارة", adam: "آدم", noor: "نور", yazan: "يزن" } as const;
export const TEACHER_NAMES = { t1: "Omar Haddad", t2: "Lina Saleh" } as const;

/** A note a teacher might write about one child — it must never reach any family. */
export const SECRET_NOTE = "غياب سارة متكرر — كلّم وليّ الأمر";
export const B_ONLY_NOTE = "b-only-note";
export const ARCHIVED_CLASS_NOTE = "archived-class-note";
export const FREE_PERIOD_NOTE = "free-period-note";

export interface FamilyWorld {
  users: {
    t1: string;
    t2: string;
    parentA: string;
    parentB: string;
    studentA: string;
    studentB: string;
    studentUnlinked: string;
    suspendedParent: string;
  };
  /** c4 is the archived class. */
  classes: { c1: string; c2: string; c3: string; c4: string; c5: string };
  /** Roster rows: Sara under t1 (sA1) and t2 (sA2), Adam live (aA) and archived (aArch), Noor, Yazan. */
  students: { sA1: string; sA2: string; aA: string; aArch: string; nB1: string; yB: string };
}

async function id(pool: Pool, sql: string, params: unknown[]): Promise<string> {
  const r = await pool.query<{ id: string }>(sql, params);
  return r.rows[0].id;
}

function user(
  pool: Pool,
  first: string,
  last: string,
  role: string,
  email: string | null = null,
  suspended = false,
): Promise<string> {
  return id(
    pool,
    `INSERT INTO users (first_name, last_name, role, email, suspended_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $5::boolean THEN now() END) RETURNING id`,
    [first, last, role, email, suspended],
  );
}

function classGroup(pool: Pool, teacherId: string, name: string, subject: string, archived = false): Promise<string> {
  return id(
    pool,
    `INSERT INTO class_groups (teacher_id, name, subject_id, subject_ids, archived_at)
     VALUES ($1, $2, $3, $4::jsonb, CASE WHEN $5::boolean THEN now() END) RETURNING id`,
    [teacherId, name, subject, JSON.stringify([subject]), archived],
  );
}

function rosterRow(pool: Pool, teacherId: string, displayName: string, archived = false): Promise<string> {
  return id(
    pool,
    `INSERT INTO students (teacher_id, display_name, archived_at)
     VALUES ($1, $2, CASE WHEN $3::boolean THEN now() END) RETURNING id`,
    [teacherId, displayName, archived],
  );
}

async function member(pool: Pool, classId: string, studentId: string): Promise<void> {
  await pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [classId, studentId]);
}

async function link(pool: Pool, studentId: string, userId: string, relation: "self" | "guardian"): Promise<void> {
  await pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, $3)`, [
    studentId,
    userId,
    relation,
  ]);
}

async function period(pool: Pool, teacherId: string, n: number, start: string, minutes: number): Promise<void> {
  await pool.query(
    `INSERT INTO schedule_periods (teacher_id, period_number, start_time, duration_minutes) VALUES ($1, $2, $3, $4)`,
    [teacherId, n, start, minutes],
  );
}

async function slot(
  pool: Pool,
  teacherId: string,
  day: number,
  n: number,
  classId: string | null,
  subject: string,
  notes: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO schedule_slots (teacher_id, day_of_week, period_number, class_group_id, subject_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [teacherId, day, n, classId, subject, notes],
  );
}

export async function seedFamilyWorld(pool: Pool): Promise<FamilyWorld> {
  const t1 = await user(pool, "Omar", "Haddad", "teacher", "t1@example.test");
  const t2 = await user(pool, "Lina", "Saleh", "teacher", "t2@example.test");
  // Parents/students may have no email at all (code-only accounts).
  const parentA = await user(pool, "Parent", "A", "parent", null);
  const parentB = await user(pool, "Parent", "B", "parent", "parent-b@example.test");
  const studentA = await user(pool, "Student", "A", "student", null);
  const studentB = await user(pool, "Student", "B", "student", null);
  const studentUnlinked = await user(pool, "Student", "Unlinked", "student", null);
  const suspendedParent = await user(pool, "Parent", "Suspended", "parent", null, true);

  const c1 = await classGroup(pool, t1, "10A maths", "mathematics");
  const c2 = await classGroup(pool, t2, "10A physics", "physics");
  const c3 = await classGroup(pool, t1, "9B maths", "mathematics");
  const c4 = await classGroup(pool, t1, "old maths", "mathematics", true);
  const c5 = await classGroup(pool, t2, "9B physics", "physics");

  // The same child, Sara, is two roster rows: one per teacher.
  const sA1 = await rosterRow(pool, t1, CHILDREN.sara);
  const sA2 = await rosterRow(pool, t2, CHILDREN.sara);
  const aA = await rosterRow(pool, t1, CHILDREN.adam);
  const aArch = await rosterRow(pool, t2, CHILDREN.adam, true);
  const nB1 = await rosterRow(pool, t1, CHILDREN.noor);
  const yB = await rosterRow(pool, t2, CHILDREN.yazan);

  await member(pool, c1, sA1);
  await member(pool, c2, sA2);
  await member(pool, c1, aA);
  await member(pool, c4, aA);
  await member(pool, c2, aArch);
  await member(pool, c3, nB1);
  await member(pool, c5, yB);

  for (const row of [sA1, sA2, aA, aArch]) await link(pool, row, parentA, "guardian");
  for (const row of [nB1, yB]) await link(pool, row, parentB, "guardian");
  await link(pool, sA1, studentA, "self");
  await link(pool, nB1, studentB, "self");

  await period(pool, t1, 1, "08:00", 45);
  await period(pool, t1, 2, "08:50", 45);
  await period(pool, t2, 1, "10:30", 50);

  await slot(pool, t1, 0, 1, c1, "", SECRET_NOTE);
  await slot(pool, t1, 2, 2, c1, "", "");
  await slot(pool, t1, 1, 1, c3, "", B_ONLY_NOTE);
  await slot(pool, t1, 3, 1, c4, "", ARCHIVED_CLASS_NOTE);
  await slot(pool, t1, 4, 1, null, "", FREE_PERIOD_NOTE);
  await slot(pool, t2, 0, 1, c2, "physics", "");

  return {
    users: { t1, t2, parentA, parentB, studentA, studentB, studentUnlinked, suspendedParent },
    classes: { c1, c2, c3, c4, c5 },
    students: { sA1, sA2, aA, aArch, nB1, yB },
  };
}
