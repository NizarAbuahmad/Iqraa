/**
 * The day-before homework reminder (spec Part 4), run once a day by Cloud
 * Scheduler through POST /internal/homework-reminders (routes/internal.ts).
 *
 * For each homework due tomorrow (Amman; modules/notifications/reminders.ts),
 * not archived, in a live class — per live roster row of that class:
 *  - ticked off → nothing;
 *  - not ticked, the child has a student account that can tick → the student
 *    and each guardian are told it is not marked done yet;
 *  - the child has no such account → only guardians, told when it is due,
 *    never that it is not done (nobody can tick it).
 *
 * At most once per homework per due day: the run CLAIMS a `homework_reminders`
 * row before sending and skips a homework it cannot claim, so a double fire,
 * a scheduler retry or two overlapping runs send nothing twice. Accepted
 * price: if the send fails after the claim, that day's reminder is lost.
 */
import { classGroups, db, homework, homeworkCompletions, homeworkReminders } from "@workspace/db";
import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { accountsLinkedTo, liveClassStudentIds } from "./familyAccess.ts";
import { sendFamilyPush } from "./familyPush.ts";
import { studentAccountsEnabled } from "./features.ts";
import { logger } from "./logger.ts";
import { classLabel, homeworkReminderText } from "../modules/notifications/familyPushText.ts";
import { reminderKind, reminderWindow } from "../modules/notifications/reminders.ts";

export interface ReminderRun {
  /** Homework reminded about in this run (claimed now). */
  homework: number;
  /** Messages handed to Expo. */
  pushed: number;
}

interface DueItem {
  id: string;
  title: string;
  classGroupId: string;
  name: string;
  nameAr: string;
}

export async function runHomeworkReminders(now: Date = new Date()): Promise<ReminderRun> {
  if (!studentAccountsEnabled()) return { homework: 0, pushed: 0 };
  const span = reminderWindow(now);
  const due: DueItem[] = await db
    .select({ id: homework.id, title: homework.title, classGroupId: homework.classGroupId, name: classGroups.name, nameAr: classGroups.nameAr })
    .from(homework)
    .innerJoin(classGroups, eq(classGroups.id, homework.classGroupId))
    .where(and(gt(homework.dueAt, span.after), lte(homework.dueAt, span.upTo), isNull(homework.archivedAt), isNull(classGroups.archivedAt)));

  const run: ReminderRun = { homework: 0, pushed: 0 };
  for (const item of due) {
    const claimed = await db
      .insert(homeworkReminders)
      .values({ homeworkId: item.id, dueDate: span.dueDate })
      .onConflictDoNothing()
      .returning({ id: homeworkReminders.id });
    if (claimed.length === 0) continue;
    run.homework++;
    try {
      run.pushed += await remindAbout(item, now);
    } catch (err) {
      logger.error({ err, homeworkId: item.id }, "homework reminder failed after its claim; not retried today");
    }
  }
  return run;
}

async function remindAbout(item: DueItem, now: Date): Promise<number> {
  const studentIds = await liveClassStudentIds(item.classGroupId);
  if (studentIds.length === 0) return 0;
  const [accounts, ticked] = await Promise.all([
    accountsLinkedTo(studentIds),
    db
      .select({ studentId: homeworkCompletions.studentId })
      .from(homeworkCompletions)
      .where(and(eq(homeworkCompletions.homeworkId, item.id), inArray(homeworkCompletions.studentId, studentIds))),
  ]);
  const done = new Set(ticked.map(t => t.studentId));
  // Only a NON-suspended self link counts. A suspended student cannot sign in
  // or tick, so nobody can mark this row done: telling the guardian it is "not
  // marked done" would be false. Such a child is untracked — the guardian gets
  // the softer reminder, and sendFamilyPush already drops the suspended
  // student themself.
  const hasAccount = new Set(accounts.filter(a => a.relation === "self" && !a.suspended).map(a => a.studentId));
  const text = homeworkReminderText({ title: item.title, className: classLabel(item) });
  const outcome = await sendFamilyPush({
    category: "homework",
    accounts,
    data: { screen: "school" },
    now,
    text: r => {
      const kind = reminderKind({ hasAccount: hasAccount.has(r.studentId), done: done.has(r.studentId) });
      if (kind === null) return null;
      if (r.relation === "self") return kind === "tracked" ? text.student : null;
      return kind === "tracked" ? text.guardianTracked(r.childName) : text.guardianUntracked(r.childName);
    },
  });
  return outcome.messages;
}
