/**
 * Reading a teacher's marks off a photograph of the paper.
 *
 * The point of this is not cleverness, it is keystrokes. A class of thirty on a
 * ten-question paper is three hundred numbers typed by hand, and that is the
 * cost that decides whether a teacher keeps using any of this. The teacher
 * already marked the paper; they should not have to also type it.
 *
 * **Nothing here ever saves a mark.** This produces *proposals* that land in
 * the boxes on screen for the teacher to look at, and the existing marking
 * endpoint is still what writes them. That is the whole safety design: a
 * misread cannot become a mark without a human seeing the number first.
 *
 * Which is the risk worth naming. A wrong OCR does not throw an error — it
 * produces a confident wrong number attached to a real child. So this module
 * is built to under-claim:
 *
 * - A mark it cannot read is returned as **absent**, never as zero. A blank
 *   box is a teacher's cue to look; a zero is a mark.
 * - A number outside the question's range is **dropped**, not clamped.
 *   Clamping 50 to 5 invents a mark nobody wrote.
 * - Every proposal carries whatever the model claims it saw, so the teacher is
 *   checking a reading rather than trusting a total.
 */
import type { QuestionType } from "@workspace/db";

/** One question as it appears on the paper, in the order the teacher sees. */
export interface ScannableQuestion {
  questionId: string;
  /** 1-based, matching the number printed beside the question. */
  number: number;
  maxMarks: number;
  type: QuestionType;
}

export interface MarkProposal {
  questionId: string;
  number: number;
  awardedMarks: number;
  /** Exactly what the model reported reading, for the teacher to compare. */
  readAs: string;
}

export interface ScanParseResult {
  proposals: MarkProposal[];
  /** Questions the scan could not supply a usable mark for, and why. */
  skipped: { number: number; reason: string }[];
}

export function buildScanPrompt(questions: readonly ScannableQuestion[]): {
  system: string;
  user: string;
} {
  const system = [
    "You read a teacher's handwritten marks from a photograph of a marked exam paper.",
    "",
    "You are transcribing, not marking. Never judge whether a mark is correct,",
    "never infer a mark from the student's work, and never fill in a gap.",
    "",
    "Rules:",
    "1. Report only marks you can actually see written on the page.",
    "2. If a question has no visible mark, or you cannot read it with confidence,",
    "   omit that question entirely. Omitting is always better than guessing —",
    "   a guessed mark is attached to a real student.",
    "3. Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) and Western digits mean the same thing.",
    "   Report the numeric value.",
    "4. Half marks are common and are written many ways (٥٫٥, 5.5, 5½, ٥ و نصف).",
    "   Report them as a decimal.",
    "",
    'Return JSON only: {"marks":[{"number":1,"value":3.5,"readAs":"٣٫٥"}]}',
    "No prose, no markdown fence.",
  ].join("\n");

  const list = questions
    .map(q => `  ${q.number}. out of ${q.maxMarks}`)
    .join("\n");

  const user = [
    "This paper has these questions, numbered as they appear:",
    list,
    "",
    "Read the mark the teacher wrote for each one.",
    '"readAs" is the characters you saw, exactly as written.',
    '"value" is that as a number.',
    "Omit any question whose mark you cannot see or cannot read.",
  ].join("\n");

  return { system, user };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Arabic-Indic and Eastern Arabic digits, plus the Arabic decimal separator.
 * A model told to return numbers sometimes returns "٣٫٥" anyway.
 */
const DIGIT_MAP: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٫": ".", "،": ".",
};

export function parseArabicNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const western = raw
    .trim()
    .split("")
    .map(c => DIGIT_MAP[c] ?? c)
    .join("")
    // "5½" and "٥ ونصف" both mean five and a half.
    .replace(/½/g, ".5")
    .replace(/\s*و\s*نصف/g, ".5");
  const match = western.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

export function parseScanResponse(
  raw: unknown,
  questions: readonly ScannableQuestion[],
): ScanParseResult {
  const root = asRecord(raw);
  const list = Array.isArray(root?.["marks"]) ? (root!["marks"] as unknown[]) : [];
  const byNumber = new Map(questions.map(q => [q.number, q]));

  const proposals: MarkProposal[] = [];
  const skipped: { number: number; reason: string }[] = [];
  const seen = new Set<number>();

  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;

    const number = parseArabicNumber(row["number"]);
    if (number === null) continue;
    const question = byNumber.get(number);
    // A number for a question that is not on this paper is a misread of the
    // page, not a mark. Reporting it would put a mark on the wrong question.
    if (!question || seen.has(number)) continue;

    const value = parseArabicNumber(row["value"]);
    if (value === null) {
      skipped.push({ number, reason: "could not read the mark" });
      continue;
    }
    // Rejected, not clamped: turning a misread 50 into 5 invents a mark the
    // teacher never wrote, and it would look exactly like a correct reading.
    if (value < 0 || value > question.maxMarks) {
      skipped.push({
        number,
        reason: `read ${value}, which is outside 0–${question.maxMarks}`,
      });
      continue;
    }

    seen.add(number);
    proposals.push({
      questionId: question.questionId,
      number,
      awardedMarks: Math.round(value * 100) / 100,
      readAs: typeof row["readAs"] === "string" ? row["readAs"] : String(value),
    });
  }

  // Anything the model simply did not mention. Listed so the teacher is told
  // which questions still need them, rather than finding blanks later.
  for (const q of questions) {
    if (!seen.has(q.number) && !skipped.some(s => s.number === q.number)) {
      skipped.push({ number: q.number, reason: "no mark found on the page" });
    }
  }
  skipped.sort((a, b) => a.number - b.number);

  return { proposals, skipped };
}
