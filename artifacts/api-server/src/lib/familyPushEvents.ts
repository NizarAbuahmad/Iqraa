/**
 * The teacher actions that tell families something, one function each, which
 * the route awaits through `pushWithin`. Here: WHICH children the news is
 * about (the class, an exam's audience, the rows whose result is final).
 * lib/familyPush.ts: which of their accounts want it, and on what device.
 */
import { classGroups, db } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { accountsLinkedTo, liveClassStudentIds } from "./familyAccess.ts";
import { assignedStudentsByEvaluation } from "./evaluationAudience.ts";
import { sendFamilyPush, type FamilyPushOutcome } from "./familyPush.ts";
import { releaseAnnouncement } from "./resultsRelease.ts";
import { finalResultStudentIds } from "./resultsReleaseNotify.ts";
import { dueAtToDueDate } from "../modules/homework/rules.ts";
import { audienceFor, inAudience } from "../modules/assessment/audience.ts";
import type { ExamDateNotice } from "../modules/notifications/examDateNotice.ts";
import { classLabel, examDateText, homeworkPostedText } from "../modules/notifications/familyPushText.ts";

const NOTHING: FamilyPushOutcome = { recipients: 0, messages: 0, delivered: 0, pruned: 0 };

/**
 * Homework posted: every live child of the class, their own account and their
 * guardians. Homework whose due day has already passed (a back-dated entry —
 * the API allows 30 days back) is a record, not news: no push, no query.
 * "Today" is the Amman day, the same `dueAtToDueDate` the due dates use; both
 * are `YYYY-MM-DD`, so a string comparison is the calendar comparison.
 */
export async function announceHomeworkPosted(
  hw: { title: string; dueAt: Date; classGroupId: string },
  klass: { name: string; nameAr: string },
  now: Date = new Date(),
): Promise<FamilyPushOutcome> {
  const dueDate = dueAtToDueDate(hw.dueAt);
  if (dueDate < dueAtToDueDate(now)) return NOTHING;
  const text = homeworkPostedText({ title: hw.title, className: classLabel(klass), dueDate });
  return sendFamilyPush({
    category: "homework",
    accounts: await accountsLinkedTo(await liveClassStudentIds(hw.classGroupId)),
    data: { screen: "school" },
    text: r => (r.relation === "guardian" ? text.guardian(r.childName) : text.student),
  });
}

/**
 * An exam's date set, changed or cleared: the live children of its (live)
 * class, narrowed to its audience — a group check reaches its own students
 * only, the same rule the family exam list applies (`examVisibleTo`).
 *
 * A date already behind today (a back-dated entry) is a record, not news: no
 * push, no query — the same rule `announceHomeworkPosted` keeps, with the same
 * Amman "today". A cleared date carries no day and is always told.
 */
export async function announceExamDate(
  exam: { id: string; title: string; titleAr: string; classGroupId: string | null },
  notice: ExamDateNotice,
  now: Date = new Date(),
): Promise<FamilyPushOutcome | null> {
  if (!exam.classGroupId) return null;
  if (notice.kind !== "cleared" && notice.examDate < dueAtToDueDate(now)) return null;
  const [klass] = await db
    .select({ name: classGroups.name, nameAr: classGroups.nameAr })
    .from(classGroups)
    .where(and(eq(classGroups.id, exam.classGroupId), isNull(classGroups.archivedAt)))
    .limit(1);
  if (!klass) return null;
  const audience = audienceFor((await assignedStudentsByEvaluation([exam.id])).get(exam.id));
  const studentIds = (await liveClassStudentIds(exam.classGroupId)).filter(id => inAudience(audience, id));
  const text = examDateText({ examTitle: exam.titleAr || exam.title, className: classLabel(klass), notice });
  return sendFamilyPush({
    category: "exams",
    accounts: await accountsLinkedTo(studentIds),
    data: { screen: "school" },
    text: r => (r.relation === "guardian" ? text.guardian(r.childName) : text.student),
    now,
  });
}

/**
 * Paper marks typed after the release: the release's own words, to the
 * children whose mark this request saved and whose result is now final.
 */
export async function announcePaperResults(
  exam: { id: string; title: string; titleAr: string },
  savedStudentIds: readonly string[],
): Promise<FamilyPushOutcome> {
  const text = releaseAnnouncement(exam);
  return sendFamilyPush({
    category: "results",
    accounts: await accountsLinkedTo(await finalResultStudentIds(exam.id, savedStudentIds)),
    data: { screen: "my-exams" },
    text: r => (r.relation === "guardian" ? text.guardianPush(r.childName) : { title: text.pushTitle, body: text.pushBody }),
  });
}
