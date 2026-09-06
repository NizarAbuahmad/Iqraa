/**
 * Making a regenerated artifact actually different from the one it replaces.
 *
 * Before this, "regenerate" re-sent a byte-identical body to the same prompt.
 * The model is not deterministic, so the paper came back reworded — and with
 * broadly the same questions in broadly the same order, which is exactly what
 * a teacher pressing the button is asking not to get.
 *
 * Three levers, applied together, weakest first:
 *
 * 1. **A named variation profile.** A raw integer seed does nothing to a
 *    language model; a named angle ("draw contexts from sport and travel",
 *    "open from a common student error") does. The profile is chosen by the
 *    variant's slot in the pool, so it is reproducible from what is stored —
 *    `ai_artifacts.variantIndex` is the seed, and it is written down.
 * 2. **An explicit exclusion list.** The stems the teacher has already been
 *    shown, quoted back with an instruction not to reuse them. This is the
 *    lever that actually moves the output, and it is why only *signatures* are
 *    sent rather than whole artifacts: a full prior worksheet in the prompt
 *    costs more input tokens than the generation it is varying.
 * 3. **A check that it worked.** `overlapRatio` measures how much of the new
 *    artifact the teacher had already seen. Nothing here trusts the directive
 *    to have been obeyed — this repo has been bitten before by a flag that
 *    described an intention rather than a result (see CLAUDE.md on `verified`),
 *    and "regenerated" is that same kind of claim.
 *
 * Pure and import-free by design: no database, no OpenAI client, so it runs
 * under `node --test` (see CLAUDE.md on module-scope throwers).
 */
import { normalizeText } from "./generationKey.ts";

/**
 * The angles a regeneration can be pushed along, indexed by pool slot.
 *
 * Slot 0 is empty on purpose: the first artifact for a key is the neutral one,
 * generated from the prompt as written. Steering it would mean no teacher ever
 * sees the baseline the prompts were tuned against.
 *
 * The angles change *what the questions are about*, never what they assess.
 * A profile that shifted difficulty or coverage would make the pool's variants
 * non-interchangeable, and the whole premise of serving variant 3 to a teacher
 * who asked the same question as variant 0 is that they are equally good
 * answers to one request.
 */
const PROFILES_AR: readonly string[] = [
  "",
  "غيّر سياقات الأمثلة والمسائل تمامًا (السوق، الرياضة، السفر، المصنع) وغيّر الأعداد المستخدمة، مع بقاء المفاهيم والأهداف كما هي.",
  "ابدأ من خطأ شائع يقع فيه الطلبة في هذا الدرس وابنِ الأسئلة حوله، مع بقاء المفاهيم والأهداف كما هي.",
  "غيّر طريقة عرض المسائل: استخدم جداول وتمثيلات بيانية وصياغات لفظية بدل الصياغة الرمزية المباشرة، مع بقاء المفاهيم والأهداف كما هي.",
  "اجعل الأسئلة تطبيقية متعددة الخطوات مبنية على مواقف حياتية أردنية، دون رفع مستوى الصعوبة المطلوب.",
];

const PROFILES_EN: readonly string[] = [
  "",
  "Change the contexts of every example and problem completely (market, sport, travel, factory) and change the numbers used, keeping the concepts and objectives identical.",
  "Build the questions around a common student error in this lesson, keeping the concepts and objectives identical.",
  "Change how the problems are presented: use tables, graphs and verbal framings instead of direct symbolic ones, keeping the concepts and objectives identical.",
  "Make the questions applied and multi-step, set in everyday Jordanian situations, without raising the requested difficulty level.",
];

/** How many distinct angles exist. A slot past the end wraps, so the pool cap
 *  and the profile count do not have to be kept in lockstep. */
export const VARIATION_PROFILE_COUNT = PROFILES_AR.length;

export function variationProfile(variantIndex: number, isArabic: boolean): string {
  const table = isArabic ? PROFILES_AR : PROFILES_EN;
  const slot = ((Math.trunc(variantIndex) % table.length) + table.length) % table.length;
  return table[slot] ?? "";
}

/** Keys whose string values identify what an artifact *asks*, as opposed to how
 *  it is dressed. Walked generically rather than per-kind: the six generation
 *  kinds have six different shapes, and a per-kind extractor is one more place
 *  to forget when a seventh arrives — it would fail by silently finding nothing
 *  to avoid, which reads exactly like a successful regeneration. */
const SIGNATURE_KEYS = new Set(["title", "text", "question", "objective", "description"]);

/** Enough of a stem to identify it; past this it is prompt weight for nothing. */
const SIGNATURE_MAX_CHARS = 120;
/** Cap on lines quoted back to the model. Beyond ~24 the exclusion list is
 *  larger than the artifact it is varying. */
const SIGNATURE_MAX_LINES = 24;

/**
 * The question stems and section titles of one artifact, normalized.
 *
 * Order is preserved and duplicates dropped, so two calls on the same artifact
 * give the same list — `overlapRatio` compares these, and a set that shuffled
 * would make the comparison noise.
 */
export function signatureLines(content: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const walk = (node: unknown, key: string | null, depth: number): void => {
    if (out.length >= SIGNATURE_MAX_LINES || depth > 8) return;
    if (typeof node === "string") {
      if (!key || !SIGNATURE_KEYS.has(key)) return;
      const line = normalizeText(node).slice(0, SIGNATURE_MAX_CHARS);
      // Single words are section labels ("الأسئلة", "Answers"), shared by every
      // artifact of a kind. Counting them would report overlap between two
      // papers that have nothing in common.
      if (line.length < 12 || seen.has(line)) return;
      seen.add(line);
      out.push(line);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, key, depth + 1);
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        walk(v, k, depth + 1);
      }
    }
  };

  walk(content, null, 0);
  return out;
}

/**
 * How much of `next` the teacher had already seen, 0 (all new) to 1 (nothing
 * new).
 *
 * Containment, not Jaccard: the lists are different lengths — three prior
 * artifacts against one new one — and Jaccard would report a low score for a
 * new paper wholly contained in what came before, which is the exact failure
 * this is here to catch. Returns 0 when either side is empty, because "no
 * evidence of repetition" and "proven fresh" have to look the same to a caller
 * that can only act on the number, and refusing a generation on absent
 * evidence would fail teachers whose artifact simply has no extractable stems.
 */
export function overlapRatio(next: readonly string[], seen: readonly string[]): number {
  if (next.length === 0 || seen.length === 0) return 0;
  const before = new Set(seen);
  const repeated = next.filter((line) => before.has(line)).length;
  return repeated / next.length;
}

/**
 * Above this share of repeated stems, a "new" artifact is the old one.
 *
 * Set at half rather than at anything stricter because legitimate overlap
 * exists: a lesson with one canonical worked example will carry it in every
 * variant, and a threshold that treated that as failure would spend a second
 * model call on every regeneration forever.
 */
export const OVERLAP_REJECT_ABOVE = 0.5;

/**
 * Clean a client-sent "do not repeat these" list into signature lines.
 *
 * The screen holds the artifact the teacher is looking at, so it can say what
 * to avoid without the server reading anything back. That matters more than it
 * sounds: it is the path that still varies a regeneration when the database is
 * unreachable, when the request carries teacher material and is never pooled,
 * and on the very first regeneration of a key. Normalised through the same
 * function as stored signatures so the two lists are comparable.
 */
export function normalizeAvoidInput(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const line = normalizeText(item).slice(0, SIGNATURE_MAX_CHARS);
    if (line.length < 12 || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= SIGNATURE_MAX_LINES) break;
  }
  return out;
}

/**
 * The block appended to a generation prompt to steer a regeneration.
 *
 * Returns "" when there is nothing to say, so the first generation for a key
 * sends the prompt exactly as it was written and this whole file is a no-op on
 * the common path.
 */
export function variationBlock(args: {
  variantIndex: number;
  isArabic: boolean;
  avoid: readonly string[];
  /** Set on the one retry after `overlapRatio` found the "new" artifact was
   *  mostly the old one. The first directive was evidently read as a
   *  suggestion; this says the quiet part out loud. */
  insistent?: boolean;
}): string {
  const profile = variationProfile(args.variantIndex, args.isArabic);
  const avoid = args.avoid.slice(0, SIGNATURE_MAX_LINES);
  if (!profile && avoid.length === 0) return "";

  const parts: string[] = [];
  if (args.isArabic) {
    parts.push("\nهذه نسخة جديدة يطلبها المعلّم بديلًا عن نسخة سابقة، فيجب أن تختلف عنها اختلافًا حقيقيًا لا في الصياغة فقط.");
    if (args.insistent) {
      parts.push("المحاولة السابقة أعادت الأسئلة نفسها تقريبًا ورُفضت. ابدأ من صفر: أسئلة مختلفة كليًا، بسياقات وأعداد وترتيب مختلف.");
    }
    if (profile) parts.push(profile);
    if (avoid.length) {
      parts.push(
        "لا تُعِد أيًّا من هذه الأسئلة أو العناوين، ولا صيغة مكافئة لها بأرقام مختلفة:\n- "
          + avoid.join("\n- "),
      );
    }
  } else {
    parts.push("\nThis is a replacement the teacher asked for in place of an earlier version. It must differ substantively, not just in wording.");
    if (args.insistent) {
      parts.push("The previous attempt returned substantially the same questions and was rejected. Start over: entirely different questions, contexts, numbers and order.");
    }
    if (profile) parts.push(profile);
    if (avoid.length) {
      parts.push(
        "Do not reuse any of these questions or headings, nor an equivalent with different numbers:\n- "
          + avoid.join("\n- "),
      );
    }
  }
  return parts.join("\n");
}
