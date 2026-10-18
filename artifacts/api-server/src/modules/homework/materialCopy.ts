/**
 * What a student or parent may see of a teacher's saved material attached to a
 * homework: the paper without its answers. A quiz carries `correctAnswer` and
 * `explanation` per question, a worksheet an `answerKey` (and a structured
 * question's pairs/order/fix), a deck its reveal slides and a teacher companion
 * per slide — handing any of that to the class would hand them the homework.
 *
 * Stripped by field name, at any depth, so every material type is covered by
 * one rule. The flip side: a NEW answer-bearing field is served until its name
 * is added below (materialCopy.test.ts pins the known ones). Blanked rather than deleted where the app's renderers expect a value
 * (an array becomes [], a string ''), so the read-only viewer draws the same
 * shapes it draws for the teacher. Pure: no database, no generation code.
 */

const ANSWER_FIELDS = new Set([
  "answerKey", "answer", "correctAnswer", "correctIndex", "computedAnswer", "expectedAnswer",
  "explanation", "solution", "unlockCode", "teacherNotes", "teacherTips",
  // WorksheetQuestionFormat: match → pairs, spot_error → wrongStep/fix/why.
  "pairs", "wrongStep", "fix", "why",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function studentCopy(value: unknown): unknown {
  if (Array.isArray(value)) {
    // A deck's reveal slide IS the answer, in its body text.
    return value.filter(v => !(isRecord(v) && v["type"] === "reveal")).map(studentCopy);
  }
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    // Two names that are only answers in one place: an `order` question's
    // `order`, and a slide's `teacher` companion (a lesson plan's ministry
    // rows also have a `teacher`, a plain string, which stays).
    const answerHere = (k === "order" && value["kind"] === "order") || (k === "teacher" && isRecord(v));
    if (ANSWER_FIELDS.has(k) || answerHere) {
      if (Array.isArray(v)) out[k] = [];
      else if (typeof v === "string") out[k] = "";
      continue;
    }
    out[k] = studentCopy(v);
  }
  return out;
}
