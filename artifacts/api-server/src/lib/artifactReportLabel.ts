/**
 * Human words for a reported artifact. A report row only carries the raw
 * `kind` ("lesson-teaching") and `lessonRef` (a catalog id like
 * "kbl-g4-islamic-s2-nccd-u7_l2", or a free topic) — fine as keys, useless to
 * the admin reading the email, the push or the review screen.
 */
import { GRADES, SUBJECTS, getBookById, getLessonById, getUnitById } from "@workspace/curriculum";

const KIND_LABELS: Record<string, { ar: string; en: string }> = {
  "lesson-plan": { ar: "خطة درس", en: "lesson plan" },
  worksheet: { ar: "ورقة عمل", en: "worksheet" },
  homework: { ar: "واجب", en: "homework" },
  quiz: { ar: "اختبار قصير", en: "quiz" },
  activity: { ar: "نشاط", en: "activity" },
  "classroom-activity": { ar: "نشاط صفي", en: "classroom activity" },
  "prompt-slides": { ar: "عرض شرائح", en: "slide deck" },
  "lesson-teaching": { ar: "شرح الدرس", en: "lesson explanation" },
  infographic: { ar: "إنفوجرافيك", en: "infographic" },
  solve: { ar: "حل مسألة", en: "solved problem" },
};

export interface ArtifactReportLabel {
  kindAr: string;
  kindEn: string;
  /** Lesson title, or the stored free topic when it is not a catalog id. */
  lessonAr: string;
  lessonEn: string;
  /** "الصف الرابع · التربية الإسلامية", empty when the lesson is not in the catalog. */
  contextAr: string;
  contextEn: string;
}

export function artifactReportLabel(kind: string, lessonRef: string): ArtifactReportLabel {
  const k = KIND_LABELS[kind] ?? { ar: kind, en: kind };
  const lesson = lessonRef ? getLessonById(lessonRef) : undefined;
  const book = lesson ? getBookById(getUnitById(lesson.unitId)?.bookId ?? "") : undefined;
  const grade = book ? GRADES.find((g) => g.id === book.gradeId) : undefined;
  const subject = book ? SUBJECTS.find((s) => s.id === book.subjectId) : undefined;
  return {
    kindAr: k.ar,
    kindEn: k.en,
    lessonAr: lesson?.titleAr || lessonRef,
    lessonEn: lesson?.title || lesson?.titleAr || lessonRef,
    contextAr: [grade?.nameAr, subject?.nameAr].filter(Boolean).join(" · "),
    contextEn: [grade?.name, subject?.name].filter(Boolean).join(" · "),
  };
}
