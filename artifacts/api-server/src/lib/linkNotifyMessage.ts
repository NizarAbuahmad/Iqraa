/**
 * The words of the push a teacher gets when someone links to one of their
 * students. Pure — split from linkNotify.ts, which imports the database, so it
 * can be tested (see the note at the top of claimDecision.ts).
 *
 * The email is in the body on purpose: a class code is shared with a whole
 * class, so the teacher's question is "do I know this person?", and a name
 * alone is often not enough to answer it.
 */
export function buildLinkNotification(args: {
  relation: "self" | "guardian";
  joinerName: string;
  joinerEmail: string;
  studentName: string;
  studentId: string;
}): { title: string; body: string; data: Record<string, unknown> } {
  const who = args.relation === "self" ? "طالب" : "ولي أمر";
  const joiner = args.joinerName.trim() || args.joinerEmail;
  return {
    title: "ربط حساب جديد",
    body: `${joiner} (${who}) ربط حسابه بـ «${args.studentName}» — ${args.joinerEmail}. إن لم يكن هو، افتح الطالب لإلغاء الربط.`,
    data: { screen: "student-link", studentId: args.studentId },
  };
}
