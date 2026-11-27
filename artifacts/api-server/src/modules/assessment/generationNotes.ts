/**
 * The notes `POST /evaluations/:id/generate` adds about how a paper was made,
 * in English and in Arabic. They used to be English strings written inline in
 * the route, which an Arabic teacher read as they were. The English text is the
 * route's own, unchanged; the Arabic says the same to a teacher, leaving out
 * what only a developer reads (type ids, the books' internal names).
 */
import type { QuestionType } from "@workspace/db";
import type { GenerationWarning } from "@workspace/exam-paper";
import { arDigits } from "./arabicNotes.ts";

/** One note, said in both languages, and as the code the app words itself. */
export interface Note {
  /** Absent only for a note a producer raised without one; the app then shows `ar` / `en`. */
  code?: GenerationWarning;
  en: string;
  ar: string;
}

/**
 * A producer's three one-for-one lists as notes. An Arabic or a code missing at
 * a position (a producer that fell out of step) leaves the English, and no code,
 * there rather than shifting every later warning onto the wrong sentence.
 */
export function zipNotes(
  en: readonly string[],
  ar: readonly string[],
  codes: readonly GenerationWarning[],
): Note[] {
  const aligned = (n: number) => n === en.length;
  return en.map((text, i) => ({
    en: text,
    ar: aligned(ar.length) ? ar[i]! : text,
    ...(aligned(codes.length) ? { code: codes[i]! } : {}),
  }));
}

/** The response's three lists, one for one and in the same order. */
export function warningLists(all: readonly Note[]): {
  warnings: string[];
  warningsAr: string[];
  warningCodes: (GenerationWarning | null)[];
} {
  return {
    warnings: all.map(n => n.en),
    warningsAr: all.map(n => n.ar),
    warningCodes: all.map(n => n.code ?? null),
  };
}

/**
 * Question types by the names the app's type picker uses
 * (`artifacts/mobile/services/i18n.ts`, `type…` keys).
 */
export const TYPE_LABELS_AR: Record<QuestionType, string> = {
  multiple_choice: "اختيار متعدد",
  true_false: "صح / خطأ",
  short_answer: "إجابة قصيرة",
  fill_blank: "إكمال الفراغات",
  matching: "توصيل",
  open_ended: "سؤال مفتوح",
  problem_solving: "حل مسألة",
  practical_task: "مهمة عملية",
  read_aloud: "قراءة جهرية",
  dictation: "إملاء",
};

/** «اختيار متعدد، توصيل» — types by their Arabic names. */
export function typeListAr(types: readonly QuestionType[]): string {
  const names = types.map(t => `«${TYPE_LABELS_AR[t] ?? t}»`);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join("، ")} و${names[names.length - 1]}`;
}

export function firstGradeTypesDropped(used: readonly QuestionType[], dropped: readonly QuestionType[]): Note {
  return {
    code: { code: "first_grade_types_dropped", params: { used: [...used], dropped: [...dropped] } },
    en: `Grade 1: generated with ${used.join(", ")}; ${dropped.join(", ")} ask for written answers a Grade 1 child cannot give.`,
    ar: `الصف الأول: كُتب الاختبار بأسئلة ${typeListAr(used)}؛ أما ${typeListAr(dropped)} فتطلب إجابة مكتوبة لا يقدر عليها طفل في الصف الأول.`,
  };
}

export function groundedOn(sources: readonly { titleAr: string; page: number | string }[]): Note {
  return {
    code: { code: "grounded_on", params: { sources: sources.map(s => ({ title: s.titleAr, page: s.page })) } },
    en: `Grounded on ${sources.map(s => `${s.titleAr} p${s.page}`).join(", ")}.`,
    ar: `بُنيت الأسئلة على ${sources.map(s => `${s.titleAr} ص${arDigits(s.page)}`).join("، ")}.`,
  };
}

export function notGrounded(): Note {
  return {
    code: { code: "not_grounded", params: {} },
    en: "No official-book passages are extracted for these objectives' units — "
      + "the model wrote from the objectives alone. Review against the book "
      + "before publishing.",
    ar: "لا نصوص مستخرجة من الكتاب المدرسي لوحدات هذه النتاجات، فكُتبت الأسئلة من النتاجات وحدها. "
      + "راجعها مع الكتاب قبل النشر.",
  };
}

/** The model wrote more than its share (the book supplies the rest). */
export function modelSurplusTrimmed(trimmed: number, asked: number): Note {
  return {
    code: { code: "model_surplus_trimmed", params: { trimmed, asked } },
    en: `The generator returned ${trimmed} more question${trimmed === 1 ? "" : "s"} than the ${asked} asked of it; the extra ${trimmed === 1 ? "one was" : "ones were"} left out.`,
    ar: `أعاد المولِّد أسئلة أكثر مما طُلب منه (${arDigits(asked)})، فحُذفت الزيادة، وعددها ${arDigits(trimmed)}.`,
  };
}

export function bookItemsDrawn(drawn: number): Note {
  return {
    code: { code: "book_items_drawn", params: { count: drawn } },
    en: `${drawn} question${drawn === 1 ? " is a" : "s are"} real item${drawn === 1 ? "" : "s"} from the NCCD books; each is labelled with how its answer was established.`,
    ar: `من الأسئلة ما هو مأخوذ من كتب المركز الوطني لتطوير المناهج، وعدده ${arDigits(drawn)}، وعلى كل منها بيان بكيفية تحديد إجابته.`,
  };
}

export function bookItemsShort(drawn: number, planned: number): Note {
  return {
    code: { code: "book_items_short", params: { drawn, planned } },
    en: `Only ${drawn} of ${planned} planned book question${planned === 1 ? "" : "s"} could be added (the rest of the book's questions repeat ones already on the paper or the model's).`,
    ar: `أُضيف من أسئلة الكتاب ${arDigits(drawn)} فقط من أصل ${arDigits(planned)} كان مخططًا لها؛ فبقية أسئلته تكرر أسئلة موجودة في الاختبار.`,
  };
}

/** The whole paper came back longer than the teacher asked. */
export function surplusTrimmed(surplus: number, requested: number): Note {
  return {
    code: { code: "surplus_trimmed", params: { surplus, requested } },
    en: `The generator returned ${surplus} more question${surplus === 1 ? "" : "s"} than the ${requested} requested; the extra ${surplus === 1 ? "one was" : "ones were"} left out.`,
    ar: `أعاد المولِّد أسئلة أكثر مما طلبت (${arDigits(requested)})، فحُذفت الزيادة، وعددها ${arDigits(surplus)}.`,
  };
}

export function noKeyChecked(): Note {
  return {
    code: { code: "no_key_checked", params: {} },
    en: "No answer key on this maths paper could be checked — the generator supplied none in a form "
      + "the verifier reads, so every question here is unverified.",
    ar: "لم يُدقَّق أي مفتاح إجابة في اختبار الرياضيات هذا، لأن المولِّد لم يكتب أيًّا منها بصيغة يقرؤها المدقّق، "
      + "فكل أسئلته غير مدقَّقة.",
  };
}
