/**
 * SymPy's verdict on a lesson explanation's worked example and practice answer.
 *
 * The first two prefill runs of student lesson explanations (2026-11-01) were
 * read line by line before approval: 20 of 50, then 12 of 37, were unfit — and
 * most of what was wrong was arithmetic or substitution, not understanding: 5 cm
 * for 10/√3, a mean of 4.8 for 5.2, a median of 20 for 20.9, (9, 63) for
 * (9, 135). A prompt asking the model to check its own work removed some of
 * them and not those. The verifier computes what the model gets wrong.
 *
 * How it works is the exam-question path's (`modules/assessment/keyVerification`),
 * kept as close as the two cases allow. The model attaches a Latin `check`
 * — `{ topic, question, answer }` — to the worked example and to the practice;
 * the verifier solves `question` and compares it with `answer`; and the check
 * only counts if the prose a student reads STATES that answer (`statesAnswer`),
 * because a verifier agreeing with a second copy of the key proves nothing about
 * the first.
 *
 * Rules, each there because breaking it is worse than not checking:
 *
 * 1. **Nothing is deleted.** A contradiction asks the model once more, and
 *    whatever comes back is stored with its verdict. The review file shows the
 *    verdict and `--approve` refuses a contradicted entry; nothing here decides
 *    what a student may see.
 * 2. **`verified` is only the verifier's word, and only when the prose states
 *    the checked answer.** Never defaulted, never inferred.
 * 3. **Cannot tell is not wrong.** `indeterminate`, `error` and
 *    `unsupported_topic` are `undecided` and change nothing: SymPy refusing a
 *    shape must never cost a correct explanation a retry, let alone its place.
 * 4. **An unreachable verifier changes nothing.** The service sleeps; the first
 *    unreachable answer stops the pass.
 *
 * What it cannot see: a model that sets the problem up wrongly and then computes
 * its wrong setup correctly. The `check` is the model's own statement of what it
 * computed, so a verdict is evidence about arithmetic, not about whether the
 * question asked is the question the lesson meant.
 */
import { isVerifierUnreachable } from "./derivativeVerified.ts";
import { relateAnswerKey, type KeyRelationResult } from "./mathVerifierClient.ts";
import { statesAnswer } from "../modules/assessment/keyLinking.ts";

export const CHECKED_ITEMS = ["workedExample", "practice"] as const;
export type CheckedItem = (typeof CHECKED_ITEMS)[number];

export type VerdictCode =
  /** The verifier agreed, and the prose states the checked answer. */
  | "verified"
  /** The verifier computed a different answer from the one written. */
  | "contradicted"
  /** The prose a student reads is not the answer the model checked. */
  | "unlinked"
  /** The verifier could not decide (or does not know the topic). */
  | "undecided"
  /** The verifier could not be reached, so nothing was checked. */
  | "unreachable"
  /** The model attached no usable check; this is the common, harmless case. */
  | "no_check";

export type ItemVerdict = {
  code: VerdictCode;
  /** What the verifier computed, for a reviewer. */
  computed?: string | null;
  /** The answer the explanation states, trimmed. */
  stated?: string;
};

export type TeachingVerification = Record<CheckedItem, ItemVerdict>;

export type RelateFn = (topic: string, question: string, answer: string) => Promise<KeyRelationResult>;

type Check = { topic: string; question: string; answer: string };

const MAX_FIELD = 400;
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function readCheck(value: unknown): Check | null {
  if (!isRecord(value)) return null;
  const topic = str(value.topic);
  const question = str(value.question);
  const answer = str(value.answer);
  if (!topic || !question || !answer) return null;
  if (question.length > MAX_FIELD || answer.length > MAX_FIELD) return null;
  return { topic, question, answer };
}

/** A Latin unit after a number is a unit: «5.77 cm», «12 cm²». */
const LATIN_UNIT = /(?<=[0-9٠-٩])\s*(?:cm|mm|km|kg|mol|kj|nm|pm|hz|ev|m|g|j|s)(?:\^?[23]|[²³])?(?![a-z])/gi;

/** The answer a student reads, with its unit taken off, ready to be looked for. */
const statedAnswer = (prose: string): string => prose.replace(LATIN_UNIT, "");

function empty(code: VerdictCode): TeachingVerification {
  return { workedExample: { code }, practice: { code } };
}

/**
 * Check the worked example and the practice. Never throws: a verifier that is
 * down, or content that is not even an object, is a verdict, not an exception.
 */
export async function verifyLessonTeaching(
  content: unknown,
  relate: RelateFn = relateAnswerKey,
): Promise<TeachingVerification> {
  const out = empty("no_check");
  if (!isRecord(content)) return out;

  let down = false;
  for (const item of CHECKED_ITEMS) {
    const block = content[item];
    if (!isRecord(block)) continue;
    const check = readCheck(block.check);
    if (!check) continue;
    const stated = str(block.answer).slice(0, 160);
    if (down) {
      out[item] = { code: "unreachable", stated };
      continue;
    }

    let result: KeyRelationResult;
    try {
      result = await relate(check.topic, check.question, check.answer);
    } catch {
      out[item] = { code: "undecided", stated };
      continue;
    }

    if (isVerifierUnreachable(result.error)) {
      down = true;
      out[item] = { code: "unreachable", stated };
      continue;
    }

    const computed = result.computed_answer ?? null;
    if (result.relation === "distinct") {
      out[item] = { code: "contradicted", computed, stated };
    } else if (result.relation === "equivalent") {
      out[item] = statesAnswer(statedAnswer(str(block.answer)), check.answer)
        ? { code: "verified", computed, stated }
        : { code: "unlinked", computed, stated };
    } else {
      out[item] = { code: "undecided", computed, stated };
    }
  }
  return out;
}

/** The items a second attempt should be asked to fix. */
export function problemsOf(v: TeachingVerification): Array<{ item: CheckedItem; verdict: ItemVerdict }> {
  return CHECKED_ITEMS
    .filter(item => v[item].code === "contradicted" || v[item].code === "unlinked")
    .map(item => ({ item, verdict: v[item] }));
}

/** Stamp the verdicts on the content that is stored; nothing else is touched. */
export function annotateVerification(content: Record<string, unknown>, v: TeachingVerification): void {
  content.verification = v;
}

const LABEL = {
  ar: { workedExample: "المثال المحلول", practice: "مسألة التدريب" },
  en: { workedExample: "the worked example", practice: "the practice problem" },
} as const;

/**
 * Appended to the prompt for the one second attempt. Says what the verifier
 * computed, from which expression, and what the explanation wrote — the model
 * cannot fix what it is not shown.
 */
export function correctionBlock(isAr: boolean, v: TeachingVerification, content: unknown): string {
  const lines: string[] = [];
  const record = isRecord(content) ? content : {};
  for (const { item, verdict } of problemsOf(v)) {
    const check = readCheck(isRecord(record[item]) ? (record[item] as Record<string, unknown>).check : null);
    const label = LABEL[isAr ? "ar" : "en"][item];
    const expression = check?.question ?? "";
    if (verdict.code === "contradicted") {
      lines.push(
        isAr
          ? `- ${label}: الحساب الآلي لـ «${expression}» يعطي ${verdict.computed ?? "قيمة مختلفة"}، بينما كتبتَ ${verdict.stated ?? ""}.`
          : `- ${label}: the automatic calculation of "${expression}" gives ${verdict.computed ?? "a different value"}, but you wrote ${verdict.stated ?? ""}.`,
      );
    } else {
      lines.push(
        isAr
          ? `- ${label}: الإجابة المكتوبة (${verdict.stated ?? ""}) ليست الإجابة نفسها التي كتبتَها في حقل check (${check?.answer ?? ""}).`
          : `- ${label}: the written answer (${verdict.stated ?? ""}) is not the same answer you gave in its check (${check?.answer ?? ""}).`,
      );
    }
  }
  if (lines.length === 0) return "";
  return isAr
    ? `\n\nتصحيح مطلوب: فحص الإجابات آليًا وجد ما يلي في ردّك السابق:\n${lines.join("\n")}\nأعد الرد كاملًا بالصيغة نفسها. اجعل المسألة والإجابة وحقل check متفقة؛ إن كانت الأرقام لا تعطي ناتجًا نظيفًا فغيّر أرقام المسألة لا الإجابة.`
    : `\n\nCorrection required: an automatic check of the answers in your previous reply found:\n${lines.join("\n")}\nReturn the whole reply again in the same shape. Make the problem, the answer and the check agree; if the numbers do not give a clean result, change the problem's numbers, not the answer.`;
}

/**
 * Check an attempt, ask once more if the check found a problem, keep the better
 * attempt, and stamp its verdicts on it.
 *
 * One retry, not a loop: a second failure means the model cannot get this
 * lesson's numbers right in this shape, and a third call would spend more to
 * prove it. The second attempt wins ties — it was written knowing what was
 * wrong — and the first wins only when the second is worse. Whatever is kept
 * carries its own verdicts, so a reviewer sees a contradiction that survived.
 *
 * `discarded` is the attempt not kept, returned so the caller can still bill
 * it: it was paid for even though it is not what is stored.
 */
export async function settleTeaching<T extends { parsed: unknown }>(
  first: T,
  retry: (correction: string) => Promise<T>,
  relate: RelateFn = relateAnswerKey,
  isAr = true,
): Promise<{ chosen: T; discarded?: T; verification: TeachingVerification }> {
  const v1 = await verifyLessonTeaching(first.parsed, relate);
  const finish = (chosen: T, verification: TeachingVerification, discarded?: T) => {
    if (isRecord(chosen.parsed)) annotateVerification(chosen.parsed, verification);
    return { chosen, discarded, verification };
  };

  const problems = problemsOf(v1);
  if (problems.length === 0) return finish(first, v1);

  let second: T;
  try {
    second = await retry(correctionBlock(isAr, v1, first.parsed));
  } catch {
    return finish(first, v1);
  }
  const v2 = await verifyLessonTeaching(second.parsed, relate);
  return problemsOf(v2).length <= problems.length
    ? finish(second, v2, first)
    : finish(first, v1, second);
}
