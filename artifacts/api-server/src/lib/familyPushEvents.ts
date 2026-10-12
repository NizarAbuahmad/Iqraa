/**
 * The teacher actions that tell families something, one function each, which
 * the route awaits through `pushWithin`. Here: WHICH children the news is
 * about (the class, an exam's audience, the rows whose result is final).
 * lib/familyPush.ts: which of their accounts want it, and on what device.
 */
import { accountsLinkedTo, liveClassStudentIds } from "./familyAccess.ts";
import { sendFamilyPush, type FamilyPushOutcome } from "./familyPush.ts";
import { dueAtToDueDate } from "../modules/homework/rules.ts";
import { classLabel, homeworkPostedText } from "../modules/notifications/familyPushText.ts";

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
