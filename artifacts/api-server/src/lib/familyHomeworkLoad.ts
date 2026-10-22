/**
 * The database half of a family's homework: given the roster rows an account
 * is linked to, fetch the live classes they sit in, those classes' homework
 * inside the family window, who has ticked it off, and the teachers and exams
 * it names — then hand it all to the pure builder.
 *
 * Only LIVE classes are joined in (`class_groups.archived_at is null`), so a
 * class that has ended contributes no membership; the builder also drops
 * homework whose class has no membership, but this query does not lean on that.
 * Completions are fetched for the family's own roster rows only, so one
 * family's ticks are never in memory while another's list is being built.
 */
import { db, classGroups, classMemberships, evaluations, gameResults, homework, homeworkCompletions, users } from "@workspace/db";
import { and, asc, gte, inArray, isNull, eq } from "drizzle-orm";
import {
  buildFamilyHomework,
  type CompletionRow,
  type ExamRow,
  type FamilyHomeworkItem,
  type GameResultRow,
  type HomeworkRow,
  type MembershipRow,
  type TeacherRow,
} from "../modules/homework/familyHomework.ts";
import { FAMILY_LIMIT, familyCutoff } from "../modules/homework/rules.ts";
import { studentIdsWithSelfAccount } from "./familyAccess.ts";

/**
 * `withAccount` is which of `studentIds` have a student account; a caller that
 * already has it (the parent route asks once for all children) passes it in,
 * otherwise it is fetched here. It feeds each item's `canTrack`.
 */
export async function loadFamilyHomework(
  studentIds: string[],
  now: Date = new Date(),
  withAccount?: ReadonlySet<string>,
): Promise<FamilyHomeworkItem[]> {
  if (studentIds.length === 0) return [];

  const memberships: MembershipRow[] = await db
    .select({
      classGroupId: classGroups.id,
      studentId: classMemberships.studentId,
      className: classGroups.name,
      teacherId: classGroups.teacherId,
    })
    .from(classMemberships)
    .innerJoin(classGroups, eq(classGroups.id, classMemberships.classGroupId))
    .where(and(inArray(classMemberships.studentId, studentIds), isNull(classGroups.archivedAt)));
  if (memberships.length === 0) return [];

  const classIds = [...new Set(memberships.map(m => m.classGroupId))];
  const homeworkRows: HomeworkRow[] = await db
    .select({
      id: homework.id,
      classGroupId: homework.classGroupId,
      title: homework.title,
      instructions: homework.instructions,
      dueAt: homework.dueAt,
      evaluationId: homework.evaluationId,
      resources: homework.resources,
    })
    .from(homework)
    .where(
      and(
        inArray(homework.classGroupId, classIds),
        isNull(homework.archivedAt),
        gte(homework.dueAt, familyCutoff(now)),
      ),
    )
    .orderBy(asc(homework.dueAt))
    .limit(FAMILY_LIMIT);
  if (homeworkRows.length === 0) return [];

  const accounts = withAccount ?? (await studentIdsWithSelfAccount(studentIds));
  const teacherIds = [...new Set(memberships.map(m => m.teacherId))];
  const examIds = [...new Set(homeworkRows.flatMap(h => (h.evaluationId ? [h.evaluationId] : [])))];
  const hwIds = homeworkRows.map(h => h.id);
  const [completions, gameRows, teachers, exams] = await Promise.all([
    db
      .select({
        homeworkId: homeworkCompletions.homeworkId,
        studentId: homeworkCompletions.studentId,
        doneAt: homeworkCompletions.doneAt,
      })
      .from(homeworkCompletions)
      .where(
        and(
          inArray(homeworkCompletions.homeworkId, homeworkRows.map(h => h.id)),
          inArray(homeworkCompletions.studentId, studentIds),
        ),
      ) as Promise<CompletionRow[]>,
    // Like completions: the family's own roster rows only.
    db
      .select({
        homeworkId: gameResults.homeworkId,
        studentId: gameResults.studentId,
        lessonId: gameResults.lessonId,
        game: gameResults.game,
        score: gameResults.score,
        total: gameResults.total,
        attempts: gameResults.attempts,
      })
      .from(gameResults)
      .where(and(inArray(gameResults.homeworkId, hwIds), inArray(gameResults.studentId, studentIds))) as Promise<GameResultRow[]>,
    db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(inArray(users.id, teacherIds)) as Promise<TeacherRow[]>,
    examIds.length === 0
      ? Promise.resolve([] as ExamRow[])
      : (db
          .select({
            id: evaluations.id,
            title: evaluations.title,
            titleAr: evaluations.titleAr,
            status: evaluations.status,
            archivedAt: evaluations.archivedAt,
            classGroupId: evaluations.classGroupId,
          })
          .from(evaluations)
          .where(inArray(evaluations.id, examIds)) as Promise<ExamRow[]>),
  ]);

  return buildFamilyHomework({ homework: homeworkRows, memberships, completions, gameResults: gameRows, teachers, exams, now, withAccount: accounts });
}
