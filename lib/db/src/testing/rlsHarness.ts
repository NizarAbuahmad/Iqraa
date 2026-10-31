import { randomUUID } from "node:crypto";
import pg from "pg";

/**
 * Fixtures for the RLS suites. Everything is inserted as the connection's own
 * (owner) role, which bypasses RLS, then read back through a ScopedPool.
 * Rows are tied to throwaway users, so deleting the users cascades them all.
 */
export const TEST_URL = process.env.RLS_TEST_DATABASE_URL;

export interface Fixture {
  ids: Record<string, string>;
  cleanup(): Promise<void>;
}

export async function seed(owner: pg.Pool): Promise<Fixture> {
  const run = randomUUID().slice(0, 8);
  const id = (_: string) => randomUUID();
  const ids = {
    teacherA: id("teacherA"), teacherB: id("teacherB"),
    parentA: id("parentA"), parentB: id("parentB"),
    studentUser: id("studentUser"), studentUser2: id("studentUser2"), admin: id("admin"),
    studentA: id("studentA"), studentB: id("studentB"),
    classA: id("classA"), evalA: id("evalA"), questionA: id("questionA"), attemptA: id("attemptA"),
    threadDirect: id("threadDirect"), threadOther: id("threadOther"), threadClass: id("threadClass"),
    msgDirect: id("msgDirect"), msgOther: id("msgOther"),
    // hwA3 and hwA4 deliberately have NO submission: the INSERT cases need a free (homework, student) pair, or a
    // unique-key error could stand in for a policy refusal.
    hwA: id("hwA"), hwA2: id("hwA2"), hwA3: id("hwA3"), hwA4: id("hwA4"), subA: id("subA"), subDraftA: id("subDraftA"),
    // studentA's record changed hands: `formerStudent` wrote these and is no longer linked to it. Two more have no
    // author at all (written before the column existed, or by an account since deleted).
    formerStudent: id("formerStudent"),
    hwA5: id("hwA5"), hwA6: id("hwA6"), hwA7: id("hwA7"), hwA8: id("hwA8"),
    subForeignDraft: id("subForeignDraft"), subForeignHanded: id("subForeignHanded"),
    subOrphanDraft: id("subOrphanDraft"), subOrphanHanded: id("subOrphanHanded"),
  };
  const q = (text: string, values: unknown[] = []) => owner.query(text, values);

  const user = (key: keyof typeof ids, role: string) =>
    q(`INSERT INTO users (id, email, first_name, last_name, role) VALUES ($1, $2, 'T', $3, $4)`,
      [ids[key], `${key}.${run}@rls.test`, key, role]);
  await user("teacherA", "teacher"); await user("teacherB", "teacher");
  await user("parentA", "parent"); await user("parentB", "parent");
  await user("studentUser", "student"); await user("studentUser2", "student"); await user("admin", "system_admin");
  await user("formerStudent", "student");

  await q(`INSERT INTO students (id, teacher_id, display_name) VALUES ($1,$2,'Student A'), ($3,$4,'Student B')`,
    [ids.studentA, ids.teacherA, ids.studentB, ids.teacherB]);
  await q(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1,$2,'guardian'), ($1,$3,'self')`,
    [ids.studentA, ids.parentA, ids.studentUser]);
  // A student account waiting for studentA's teacher to approve its claim.
  await q(`INSERT INTO roster_link_requests (student_id, user_id, relation) VALUES ($1,$2,'self')`,
    [ids.studentA, ids.studentUser2]);
  await q(`INSERT INTO class_groups (id, teacher_id, name) VALUES ($1,$2,'Class A')`, [ids.classA, ids.teacherA]);
  await q(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1,$2)`, [ids.classA, ids.studentA]);
  await q(`INSERT INTO homework (id, teacher_id, class_group_id, title, due_at, requires_submission)
           VALUES ($1,$2,$3,'hw-a', now() + interval '3 days', true), ($4,$2,$3,'hw-a2', now() + interval '3 days', true),
                  ($5,$2,$3,'hw-a3', now() + interval '3 days', true), ($6,$2,$3,'hw-a4', now() + interval '3 days', true)`,
    [ids.hwA, ids.teacherA, ids.classA, ids.hwA2, ids.hwA3, ids.hwA4]);
  await q(`INSERT INTO homework (id, teacher_id, class_group_id, title, due_at, requires_submission)
           VALUES ($1,$2,$3,'hw-a5', now() + interval '3 days', true), ($4,$2,$3,'hw-a6', now() + interval '3 days', true),
                  ($5,$2,$3,'hw-a7', now() + interval '3 days', true), ($6,$2,$3,'hw-a8', now() + interval '3 days', true)`,
    [ids.hwA5, ids.teacherA, ids.classA, ids.hwA6, ids.hwA7, ids.hwA8]);
  await q(`INSERT INTO homework_submissions (id, homework_id, student_id, author_user_id, note, submitted_at) VALUES ($1,$2,$3,$4,'done', now())`,
    [ids.subA, ids.hwA, ids.studentA, ids.studentUser]);
  await q(`INSERT INTO homework_submissions (id, homework_id, student_id, author_user_id, note) VALUES ($1,$2,$3,$4,'unfinished')`,
    [ids.subDraftA, ids.hwA2, ids.studentA, ids.studentUser]);
  await q(`INSERT INTO homework_submissions (id, homework_id, student_id, author_user_id, note, submitted_at)
           VALUES ($1,$2,$3,$4,'old draft', NULL), ($5,$6,$3,$4,'old handed in', now()),
                  ($7,$8,$3,NULL,'nobody''s draft', NULL), ($9,$10,$3,NULL,'nobody''s handed in', now())`,
    [ids.subForeignDraft, ids.hwA5, ids.studentA, ids.formerStudent, ids.subForeignHanded, ids.hwA6,
     ids.subOrphanDraft, ids.hwA7, ids.subOrphanHanded, ids.hwA8]);
  await q(`INSERT INTO parent_contacts (teacher_id, student_id, kind, channel) VALUES ($1,$2,'note','copy')`,
    [ids.teacherA, ids.studentA]);

  await q(`INSERT INTO evaluations (id, teacher_id, grade_id, subject_id, book_id) VALUES ($1,$2,'g10','math','b1')`,
    [ids.evalA, ids.teacherA]);
  await q(`INSERT INTO evaluation_questions (id, evaluation_id, type, objective_id, competency_key) VALUES ($1,$2,'mcq','o1','c1')`,
    [ids.questionA, ids.evalA]);
  await q(`INSERT INTO attempts (id, evaluation_id, student_id) VALUES ($1,$2,$3)`,
    [ids.attemptA, ids.evalA, ids.studentA]);
  await q(`INSERT INTO attempt_results (attempt_id) VALUES ($1)`, [ids.attemptA]);

  await q(`INSERT INTO chat_threads (id, type, created_by, direct_key) VALUES ($1,'direct',$2,$5), ($3,'direct',$4,$6)`,
    [ids.threadDirect, ids.teacherA, ids.threadOther, ids.teacherB,
     [ids.teacherA, ids.parentA].sort().join(":"), [ids.teacherB, ids.parentB].sort().join(":")]);
  await q(`INSERT INTO chat_threads (id, type, class_group_id) VALUES ($1,'class_group',$2)`, [ids.threadClass, ids.classA]);
  await q(`INSERT INTO chat_participants (thread_id, user_id) VALUES ($1,$2), ($1,$3), ($4,$5)`,
    [ids.threadDirect, ids.teacherA, ids.parentA, ids.threadOther, ids.teacherB]);
  await q(`INSERT INTO chat_messages (id, thread_id, sender_id, body) VALUES ($1,$2,$3,'hi'), ($4,$5,$6,'other')`,
    [ids.msgDirect, ids.threadDirect, ids.teacherA, ids.msgOther, ids.threadOther, ids.teacherB]);
  await q(`INSERT INTO chat_blocks (blocker_user_id, blocked_user_id) VALUES ($1,$2), ($3,$4)`,
    [ids.parentA, ids.teacherA, ids.teacherB, ids.parentB]);
  await q(`INSERT INTO chat_reports (reporter_user_id, reported_user_id, thread_id) VALUES ($1,$2,$3), ($4,$5,$6)`,
    [ids.parentA, ids.teacherA, ids.threadDirect, ids.teacherB, ids.parentB, ids.threadOther]);

  return {
    ids,
    async cleanup() {
      const users = [ids.teacherA, ids.teacherB, ids.parentA, ids.parentB, ids.studentUser, ids.studentUser2, ids.admin, ids.formerStudent];
      await q(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [users]);
    },
  };
}
