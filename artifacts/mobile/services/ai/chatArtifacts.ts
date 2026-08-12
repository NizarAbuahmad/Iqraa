/**
 * Generate real teaching artifacts from chat (same path as AI Tools screens).
 * Returns chat-ready text + next-step CTA — not thin outline stubs.
 */

import type {
  ActivityOutput,
  AIRequest,
  LessonPlanOutput,
  QuizOutput,
  WorksheetOutput,
} from '@/services/ai/AIService';
import { remoteAIService } from '@/services/ai/RemoteAIService';
import {
  resolveCurriculumContext,
  type SessionArtifact,
} from '@/services/ai/teachingAssistant';
import type { KBLesson } from '@/services/knowledgeBase';
import {
  formatActivityText,
  formatLessonPlanText,
  formatQuizText,
  formatWorksheetText,
} from '@/services/share';

/**
 * The structured output, kept alongside the text.
 *
 * Chat calls the same generators as the tool screens, so it has always had the
 * real object — and used to discard it one line later in favour of a formatted
 * string. Keeping it means chat can render a lesson plan as a plan, and edit
 * it, instead of showing a paragraph that only looks like one.
 */
export type ChatArtifactData =
  | { kind: 'lesson-plan'; plan: LessonPlanOutput }
  | { kind: 'worksheet'; worksheet: WorksheetOutput }
  | { kind: 'quiz'; quiz: QuizOutput }
  | { kind: 'activity'; activity: ActivityOutput };

export type ChatArtifactResult = {
  /** The whole material as text — what copy and export hand over. */
  text: string;
  /**
   * Just the conversation around the material: the lead-in and the next-step
   * line. A bubble that renders `data` as a document shows this instead of
   * `text`, otherwise the plan appears twice — once as an editable document and
   * again as the formatted wall it was built from.
   */
  prose: string;
  artifact: SessionArtifact;
  topic: string;
  lessonId?: string;
  /** Present for the kinds that have a structured renderer. */
  data?: ChatArtifactData;
  /**
   * Heading and context the formatters need. Kept so an edited document can be
   * re-serialised on export; without it, export would ship the version as first
   * generated and quietly drop the teacher's edits.
   */
  title: string;
  meta: { subject: string; grade: string; duration?: number };
};

function nextStepLine(artifact: SessionArtifact, isAr: boolean): string {
  const tips: Record<SessionArtifact, { ar: string; en: string }> = {
    'lesson-plan': {
      ar: 'الخطوة التالية: جهّز ورقة عمل أو نشاطاً صفياً لنفس الدرس.',
      en: 'Next: prepare a worksheet or class activity for the same lesson.',
    },
    worksheet: {
      ar: 'الخطوة التالية: جهّز اختباراً قصيراً أو واجباً منزلياً.',
      en: 'Next: prepare a short quiz or homework.',
    },
    quiz: {
      ar: 'الخطوة التالية: اجعل الأسئلة أصعب، أو صدّر الاختبار للطباعة.',
      en: 'Next: make the quiz harder, or export it for printing.',
    },
    homework: {
      ar: 'الخطوة التالية: أضف مفتاح إجابة، أو اربط الواجب بخطة الدرس.',
      en: 'Next: add an answer key, or link homework to the lesson plan.',
    },
    activity: {
      ar: 'الخطوة التالية: اضبط زمن النشاط داخل خطة الدرس.',
      en: 'Next: fit this activity into the lesson plan timing.',
    },
  };
  const t = tips[artifact];
  return isAr ? t.ar : t.en;
}

function buildRequest(
  topic: string,
  lesson: KBLesson | null,
  lang: 'ar' | 'en',
  documentContext?: string | null,
): AIRequest {
  const ctx = lesson ? resolveCurriculumContext(lesson) : null;
  const grade = lang === 'ar'
    ? (ctx?.gradeAr ?? 'الصف العاشر')
    : (ctx?.gradeEn ?? 'Grade 10');
  const subject = lang === 'ar'
    ? (ctx?.subjectAr ?? 'الرياضيات')
    : (ctx?.subjectEn ?? 'Mathematics');

  return {
    grade,
    subject,
    topic,
    duration: 45,
    language: lang === 'ar' ? 'arabic' : 'english',
    teachingStyle: 'direct',
    difficulty: 'medium',
    numQuestions: 8,
    questionTypes: ['multiple_choice', 'short_answer', 'true_false'],
    totalMarks: 20,
    activityType: 'group',
    additionalContext: documentContext?.trim() || undefined,
  };
}

function leadIn(
  topic: string,
  isAr: boolean,
  fromSoftPin: boolean,
  fromDocuments: boolean,
): string {
  if (fromDocuments) {
    return isAr
      ? `جهّزت خطة الدرس اعتمادًا على الملفات التي رفعتها — موضوع «${topic}».\n\n`
      : `Prepared the lesson plan from your uploaded files — topic “${topic}”.\n\n`;
  }
  if (fromSoftPin) {
    return isAr
      ? `جهّزت المادة لدرس «${topic}» (الدرس الحالي في البطاقة). قل لي إن أردت درساً آخر.\n\n`
      : `Prepared for “${topic}” (current lesson on the card). Tell me if you meant a different lesson.\n\n`;
  }
  return isAr
    ? `المادة جاهزة لدرس «${topic}».\n\n`
    : `Ready for “${topic}”.\n\n`;
}

/**
 * Run the same generators as AI Tools and format for the chat bubble.
 */
export async function generateChatArtifact(opts: {
  artifact: SessionArtifact;
  topic: string;
  lesson?: KBLesson | null;
  lang: 'ar' | 'en';
  documentContext?: string | null;
  /** Soft-pin default lesson was used without an explicit topic. */
  fromSoftPin?: boolean;
}): Promise<ChatArtifactResult> {
  const {
    artifact,
    topic,
    lesson = null,
    lang,
    documentContext,
    fromSoftPin = false,
  } = opts;
  const isAr = lang === 'ar';
  const fromDocuments = !!documentContext?.trim();
  // When docs are the primary context, don't let a soft curriculum lesson override generators
  const lessonForGen = fromDocuments && fromSoftPin ? null : lesson;
  const req = buildRequest(topic, lessonForGen, lang, documentContext);
  const meta = { subject: req.subject, grade: req.grade, duration: req.duration };
  const titleBase = topic.trim();

  const TITLES: Record<SessionArtifact, { ar: string; en: string }> = {
    'lesson-plan': { ar: 'خطة درس', en: 'Lesson plan' },
    worksheet: { ar: 'ورقة عمل', en: 'Worksheet' },
    homework: { ar: 'واجب منزلي', en: 'Homework' },
    quiz: { ar: 'أداة تقييم', en: 'Short quiz' },
    activity: { ar: 'نشاط صفي', en: 'Class activity' },
  };
  const artifactTitle = `${isAr ? TITLES[artifact].ar : TITLES[artifact].en}: ${titleBase}`;

  let body = '';
  let data: ChatArtifactData | undefined;
  switch (artifact) {
    case 'lesson-plan': {
      const out: LessonPlanOutput = await remoteAIService.generateLessonPlan(req);
      data = { kind: 'lesson-plan', plan: out };
      body = formatLessonPlanText(
        out,
        artifactTitle,
        meta,
        isAr,
      );
      break;
    }
    case 'worksheet': {
      const out: WorksheetOutput = await remoteAIService.generateWorksheet(req);
      data = { kind: 'worksheet', worksheet: out };
      body = formatWorksheetText(
        out,
        artifactTitle,
        meta,
        isAr,
      );
      break;
    }
    case 'homework': {
      const out: WorksheetOutput = await remoteAIService.generateHomework(req);
      data = { kind: 'worksheet', worksheet: out };
      body = formatWorksheetText(
        out,
        artifactTitle,
        meta,
        isAr,
      );
      break;
    }
    case 'quiz': {
      const out: QuizOutput = await remoteAIService.generateQuiz(req);
      data = { kind: 'quiz', quiz: out };
      body = formatQuizText(
        out,
        artifactTitle,
        meta,
        isAr,
      );
      break;
    }
    case 'activity': {
      const out: ActivityOutput = await remoteAIService.generateActivity(req);
      data = { kind: 'activity', activity: out };
      body = formatActivityText(
        out,
        artifactTitle,
        meta,
        isAr,
      );
      break;
    }
    default:
      body = isAr ? 'تعذر تجهيز هذه المادة.' : 'Could not prepare this material.';
  }

  const lead = leadIn(titleBase, isAr, fromSoftPin && !fromDocuments, fromDocuments);
  const nextStep = `→ ${nextStepLine(artifact, isAr)}`;
  const text = `${lead}${body}\n\n${nextStep}`;
  const prose = `${lead}${nextStep}`;
  return {
    text,
    prose,
    title: artifactTitle,
    meta,
    artifact,
    data,
    topic: titleBase,
    lessonId: lessonForGen?.id,
  };
}

/** Resolve topic string for generation from lesson / docs / query. */
export function resolveArtifactTopic(opts: {
  lang: 'ar' | 'en';
  query: string;
  lesson: KBLesson | null;
  activeTopicAr: string | null;
  activeTopicEn: string | null;
  docTopic?: string | null;
  /** When true, uploaded materials beat a soft-pinned curriculum lesson. */
  preferDocuments?: boolean;
}): string {
  const {
    lang,
    query,
    lesson,
    activeTopicAr,
    activeTopicEn,
    docTopic,
    preferDocuments = false,
  } = opts;

  if (preferDocuments && docTopic?.trim()) return docTopic.trim();

  // Explicit topic left in the query after stripping artifact verbs
  // Include حضر/جهز without shadda — teachers often type without tashkeel.
  const stripped = query
    .replace(
      /خطة(\s*درس)?|ورقة(\s*عمل)?|اختبار(\s*قصير)?|واجب(\s*منزلي)?|نشاط(\s*صفي)?|lesson\s*plan|worksheet|quiz|homework|activity|أنشئ|انشئ|ولّد|ولد|اعمل|أعمل|حضّ?ر|جهز|جهّز|أعد|اعد|إعداد|اعداد|كاملة|كامل|prepare|create|make|generate|build/gi,
      ' ',
    )
    .replace(/^(عن|حول|about|for)\s+/i, '')
    .replace(/\b(عن|حول|about|for)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Prefer an explicit topic in the message over soft-pinned / default lesson
  if (stripped && stripped.length >= 3) {
    const lessonTitle = lesson
      ? (lang === 'ar' ? lesson.titleAr : lesson.titleEn)
      : '';
    const looksLikeBareVerbOnly = /^(حضّ?ر|أنشئ|جهز|أعد|prepare|create)$/i.test(stripped);
    if (!looksLikeBareVerbOnly && stripped !== lessonTitle) {
      return stripped;
    }
  }

  if (docTopic?.trim()) return docTopic.trim();
  if (lesson) return lang === 'ar' ? lesson.titleAr : lesson.titleEn;
  if (lang === 'ar' && activeTopicAr) return activeTopicAr;
  if (lang === 'en' && activeTopicEn) return activeTopicEn;
  return stripped || query.trim();
}
