/**
 * The pure half of the day-before reminder (lib/homeworkReminders.ts).
 *
 * "Tomorrow" is the Amman calendar day after today's. A homework is due on it
 * when its stored instant (the end of its due day, Amman — rules.ts) falls
 * after the end of today and no later than the end of tomorrow; compared as
 * instants, so a row stored at any time of that day counts.
 */
import { addDays, dueAtToDueDate, dueDateToDueAt } from "../homework/rules.ts";

export function reminderWindow(now: Date): { dueDate: string; after: Date; upTo: Date } {
  const today = dueAtToDueDate(now);
  const tomorrow = addDays(today, 1);
  // Both are valid YYYY-MM-DD strings built just above, so never null.
  return { dueDate: tomorrow, after: dueDateToDueAt(today)!, upTo: dueDateToDueAt(tomorrow)! };
}

export type ReminderKind = "tracked" | "untracked";

/**
 * Per roster row: ticked → nothing; not ticked, with a student account that can
 * tick → "tracked" (we know it is not marked done); no such account →
 * "untracked": nobody can tick it, so nobody knows whether it is done, and the
 * reminder must not say it is not.
 */
export function reminderKind(row: { hasAccount: boolean; done: boolean }): ReminderKind | null {
  if (row.done) return null;
  return row.hasAccount ? "tracked" : "untracked";
}
