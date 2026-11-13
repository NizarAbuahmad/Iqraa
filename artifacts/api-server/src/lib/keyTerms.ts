// artifacts/api-server/src/lib/keyTerms.ts
/**
 * The lesson's key terms, as its book prints them, and what the prompts do
 * with them.
 *
 * A Grade 10 physics teacher's review (2026-11-12) found generated material
 * that skipped what the book teaches: the «الحركة في بعدين» quiz had no
 * time-of-flight, range or maximum-height problem, and the «خصائص الحركة
 * الموجية» deck left out refraction, interference, diffraction and
 * polarisation. Every one of those is in the lesson's own vocabulary, which
 * already rode in `additionalContext` as a list nobody was told to cover.
 *
 * The app sends the list as `keyTerms` for physics and chemistry lessons only
 * (`scienceKeyTerms` in artifacts/mobile/services/kbContext.ts), because there
 * the vocabulary lists the ideas a lesson teaches. It is request-controlled,
 * so it is bounded here and anything else renders nothing: a request without
 * terms gets every prompt byte-for-byte as before. The cache key hashes what
 * `parseKeyTerms` returns (generationKey.ts), so what is hashed is what the
 * model is shown.
 *
 * `missingKeyTerms` is a measurement for the log, not a gate: nothing is
 * retried, trimmed or refused on it. See
 * docs/superpowers/specs/2026-11-13-lesson-key-terms-coverage-design.md.
 *
 * Imports nothing that touches the OpenAI client.
 */
import { parseWideScope } from "./grounding.ts";

export const KEY_TERMS_MAX = 12;
/** The most concept slides a lesson-teaching reply may carry when terms ask for more than five. */
export const TEACHING_CONCEPTS_MAX_WITH_TERMS = 8;
const TERM_MAX = 60;

export function parseKeyTerms(body: Record<string, unknown>): string[] | null {
  if (parseWideScope(body.scope)) return null;
  const raw = body.keyTerms;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > KEY_TERMS_MAX) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return null;
    const term = item.replace(/\s+/g, " ").trim();
    if (term.length === 0 || term.length > TERM_MAX) return null;
    if (!out.includes(term)) out.push(term);
  }
  return out;
}

const list = (terms: string[]) => terms.map(t => `- ${t}`).join("\n");

export function keyTermsQuestionClauseAr(b: Record<string, unknown>): string {
  const terms = parseKeyTerms(b);
  if (!terms) return "";
  return `\nمصطلحات الدرس كما في الكتاب:\n${list(terms)}\nوزّع الأسئلة على هذه المصطلحات بحيث يكون لكل مصطلح سؤال واحد على الأقل ما دام عدد الأسئلة يسمح؛ وإن كانت الأسئلة أقل من المصطلحات فاختر مصطلحات متباعدة في القائمة ولا تحصرها في أولها. المصطلح الذي يمثّل كمية تُقاس أو تُحسب (مثل زمن التحليق أو الكتلة المولية) يُسأل عنه بمسألة حسابية بأرقام، في سؤال من الأنواع المطلوبة أعلاه.`;
}

export function keyTermsQuestionClauseEn(b: Record<string, unknown>): string {
  const terms = parseKeyTerms(b);
  if (!terms) return "";
  return `\nThe lesson's key terms, as the book prints them:\n${list(terms)}\nSpread the questions over these terms so that every term gets at least one question while the count allows; if there are fewer questions than terms, pick terms spread across the list rather than the first few. A term that is a quantity to measure or calculate (such as time of flight or molar mass) is asked about as a calculation with numbers, in one of the question types requested above.`;
}

export function keyTermsTeachingClauseAr(b: Record<string, unknown>): string {
  const terms = parseKeyTerms(b);
  if (!terms) return "";
  return `\nمصطلحات الدرس كما في الكتاب (إلزامية):\n${list(terms)}\nاشرح كل مصطلح منها في فكرة واحدة على الأقل من "concepts"، ويجوز أن تجمع فكرةٌ مصطلحين متلازمين إذا شرحتهما معًا (مثل التداخل ومبدأ تراكب الموجات). لا تُسقط مصطلحًا. حين يكون للمصطلح علاقة رياضية في هذا الدرس فليكن مثاله في "points" مسألة قصيرة بأرقام. وإن كان بين المصطلحات كمية تُحسب فاجعل "workedExample" و"practice" مسألتين حسابيتين عن إحداها.${terms.length > TEACHING_CONCEPTS_MAX_WITH_TERMS ? ` المصطلحات أكثر من ${TEACHING_CONCEPTS_MAX_WITH_TERMS}: اجمع المصطلحات المتجاورة في القائمة، كل مصطلحين أو ثلاثة في فكرة واحدة، حتى لا يزيد عدد "concepts" على ${TEACHING_CONCEPTS_MAX_WITH_TERMS}، ولا تُسقط مصطلحًا.` : ""}\n`;
}

export function keyTermsTeachingClauseEn(b: Record<string, unknown>): string {
  const terms = parseKeyTerms(b);
  if (!terms) return "";
  return `\nThe lesson's key terms, as the book prints them (mandatory):\n${list(terms)}\nExplain every term in at least one item of "concepts"; one concept may cover two terms that belong together if it explains both (such as interference and the principle of superposition). Do not drop a term. When a term has a mathematical relation in this lesson, make its example in "points" a short problem with numbers. If any term is a quantity that is calculated, make "workedExample" and "practice" calculations about one of them.${terms.length > TEACHING_CONCEPTS_MAX_WITH_TERMS ? ` There are more than ${TEACHING_CONCEPTS_MAX_WITH_TERMS} terms: group neighbouring terms in the list, two or three to a concept, so that "concepts" never exceeds ${TEACHING_CONCEPTS_MAX_WITH_TERMS}, and drop no term.` : ""}\n`;
}

// ─── Measuring ───────────────────────────────────────────────────────────────

const HARAKAT = /[ً-ْٰـ]/g;
// A leading «و/ف», then «ب/ك» + «ال», or «لل» (ل + ال). Only when two letters
// remain, so «ال» itself is not emptied. Both sides go through this, so a word
// that merely starts with «ال» still matches itself.
const ARTICLE = /^[وف]?(?:[بك]?ال|لل)(?=..)/u;

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(HARAKAT, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map(t => t.replace(ARTICLE, ""));
}

function collectStrings(value: unknown, out: string[], depth = 0): void {
  if (typeof value === "string") out.push(value);
  else if (depth < 6 && Array.isArray(value)) value.forEach(v => collectStrings(v, out, depth + 1));
  else if (depth < 6 && value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(v => collectStrings(v, out, depth + 1));
  }
}

/** The terms whose whole phrase appears nowhere in the reply's text. */
export function missingKeyTerms(terms: string[], content: unknown): string[] {
  const parts: string[] = [];
  collectStrings(content, parts);
  const text = ` ${tokens(parts.join(" ")).join(" ")} `;
  return terms.filter(term => {
    const t = tokens(term);
    return t.length > 0 && !text.includes(` ${t.join(" ")} `);
  });
}

/**
 * What of a lesson-teaching reply reaches the slide: the first eight concepts'
 * title and points, the worked example and the practice. A term that appears
 * only in a teacher note, or in a ninth concept, is not covered for the pupil.
 */
export function teachingCoverageContent(content: unknown): unknown {
  const obj = (v: unknown): Record<string, unknown> | null =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  const pick = (v: unknown, keys: string[]): Record<string, unknown> | null => {
    const o = obj(v);
    if (!o) return null;
    const out: Record<string, unknown> = {};
    for (const k of keys) if (k in o) out[k] = o[k];
    return out;
  };
  const c = obj(content);
  const out: Record<string, unknown> = {};
  if (!c) return out;
  if (Array.isArray(c.concepts)) {
    out.concepts = c.concepts.slice(0, TEACHING_CONCEPTS_MAX_WITH_TERMS).map(x => pick(x, ["title", "points"]) ?? {});
  }
  const we = pick(c.workedExample, ["problem", "steps", "answer"]);
  if (we) out.workedExample = we;
  const pr = pick(c.practice, ["problem", "answer"]);
  if (pr) out.practice = pr;
  return out;
}
