/**
 * Classifying a learning objective's cognitive level from its wording.
 *
 * Needed because the catalog builders stamp every NCCD-derived objective
 * `'Understand'` — 112 of 116 — so a competency breakdown built on the stored
 * level would put nearly every question in one bar. See `objectives.ts`.
 *
 * The signal is the leading action word, and the important detail is that
 * Jordanian curriculum objectives are written as **masdar (verbal nouns)**, not
 * conjugated verbs. The real data reads:
 *
 *   «حل نظام مكوَّن من معادلة خطية وأخرى تربيعية»        solving   → Apply
 *   «تعرُّف عدد الحلول الممكنة»                          identifying → Understand
 *   «نمذجة مسألة حياتية… ثم حل النظام»                   modelling → Apply
 *   «استعمال برمجية جيوجبرا لحل نظام…»                   using     → Apply
 *
 * A classifier that only matched يحل / يتعرّف would score zero on this corpus.
 * Masdar forms come first here for that reason; conjugated forms are matched
 * too, since hand-authored objectives use them.
 *
 * This is a heuristic over wording, not a judgement about the lesson. It is
 * reported as `inferred` and never overwrites an authored level.
 */

export type BloomsLevel =
  | "Remember"
  | "Understand"
  | "Apply"
  | "Analyze"
  | "Evaluate"
  | "Create";

/**
 * Fold Arabic orthographic variation so matching does not miss on a hamza.
 *
 * This file used to carry its own copy of this. There were three: one here,
 * one in the api-server grading path, and — briefly — a third written for
 * passage retrieval. They agreed on Arabic and disagreed on Latin case and
 * Arabic-Indic digits, which is the shape of divergence nobody notices until
 * two features give different answers about the same string.
 *
 * Checked before merging them: over all 196 marker terms and catalog
 * objectives, the two implementations differ on 7 strings, every one of them
 * an English objective being lowercased. The markers below are Arabic verbs,
 * so nothing here changes.
 */
import { normalizeArabic } from './arabic.ts';

export { normalizeArabic };

/**
 * Action words by level, most specific first. Each entry is already normalized
 * by `normalizeArabic`, so the table and the input meet on the same footing.
 *
 * Order within the file matters: `MARKERS` is scanned in array order and the
 * first hit wins, so multi-word and higher-order phrases are listed before the
 * single words they contain ("يميز بين" before "يميز").
 */
interface Marker {
  level: BloomsLevel;
  terms: string[];
}

const MARKERS: Marker[] = [
  {
    // Create — producing something that did not exist before.
    level: "Create",
    terms: [
      "تصميم", "يصمم", "ابتكار", "يبتكر", "تاليف", "يؤلف", "يولف",
      "انتاج", "ينتج", "تطوير", "يطور", "اقتراح", "يقترح", "بناء", "يبني",
    ],
  },
  {
    // Evaluate — judging against criteria.
    level: "Evaluate",
    terms: [
      "تقويم", "يقوم بتقويم", "يقيم", "نقد", "ينقد", "الحكم", "يحكم",
      "تبرير", "يبرر", "الدفاع", "يدافع", "المفاضله", "يفاضل",
    ],
  },
  {
    // Analyze — taking apart, relating, distinguishing.
    level: "Analyze",
    terms: [
      "تمييز بين", "يميز بين", "المقارنه بين", "مقارنه", "يقارن",
      "تحليل", "يحلل", "تصنيف", "يصنف", "استنتاج", "يستنتج",
      "الربط بين", "يربط", "تعليل", "يعلل", "فحص", "يفحص",
    ],
  },
  {
    // Apply — carrying out a procedure. The bulk of school maths.
    level: "Apply",
    terms: [
      "حل", "يحل", "حساب", "يحسب", "ايجاد", "يجد", "اوجد",
      "تطبيق", "يطبق", "استعمال", "يستعمل", "استخدام", "يستخدم",
      "تبسيط", "يبسط", "رسم", "يرسم", "تمثيل", "يمثل",
      // Modelling a familiar situation with a known technique is applying it.
      "نمذجه", "ينمذج", "كتابه", "يكتب", "قياس", "يقيس", "اجراء", "يجري",
    ],
  },
  {
    // Understand — explaining, restating, recognising.
    level: "Understand",
    terms: [
      "تعرف", "يتعرف", "شرح", "يشرح", "توضيح", "يوضح", "تفسير", "يفسر",
      "وصف", "يصف", "تلخيص", "يلخص", "التعبير", "يعبر", "فهم", "يفهم",
      "ترجمه", "يترجم",
    ],
  },
  {
    // Remember — recall with no transformation.
    level: "Remember",
    terms: [
      "ذكر", "يذكر", "اذكر", "تعريف", "يعرف", "عرف", "تسميه", "يسمي",
      "تعداد", "يعدد", "سرد", "يسرد", "حفظ", "يحفظ", "استظهار",
    ],
  },
];

/** English fallback, for the hand-authored English objective text. */
const EN_MARKERS: Marker[] = [
  { level: "Create", terms: ["design", "create", "compose", "develop", "invent", "produce"] },
  { level: "Evaluate", terms: ["evaluate", "judge", "critique", "justify", "defend", "assess"] },
  { level: "Analyze", terms: ["analyze", "analyse", "compare", "contrast", "classify", "distinguish", "relate", "examine"] },
  { level: "Apply", terms: ["solve", "calculate", "compute", "apply", "use", "simplify", "draw", "write", "model", "find"] },
  { level: "Understand", terms: ["explain", "describe", "summarize", "summarise", "interpret", "identify", "recognize", "recognise", "understand"] },
  { level: "Remember", terms: ["list", "name", "state", "recall", "define", "label"] },
];

/**
 * Infer a cognitive level from objective text.
 *
 * Returns null when nothing matches — silence is the honest answer, and lets
 * callers fall back to the stored level instead of inheriting a wrong guess.
 */
export function classifyBlooms(text: string): BloomsLevel | null {
  if (!text) return null;

  const ar = normalizeArabic(text);
  for (const { level, terms } of MARKERS) {
    for (const term of terms) {
      // Match at a word boundary so "حل" does not fire inside "محلول".
      if (new RegExp(`(^|\\s|["'«(])${escapeRegExp(term)}(\\s|$|["'»),.:])`).test(ar)) {
        return level;
      }
    }
  }

  const en = text.toLowerCase();
  for (const { level, terms } of EN_MARKERS) {
    for (const term of terms) {
      if (new RegExp(`\\b${escapeRegExp(term)}\\b`).test(en)) return level;
    }
  }

  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
