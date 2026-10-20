/**
 * Generate real teaching artifacts from chat (same path as AI Tools screens).
 * Returns chat-ready text + next-step CTA — not thin outline stubs.
 */

import type {
  ActivityOutput,
  AIRequest,
  InfographicOutput,
  LessonPlanOutput,
  QuizOutput,
  WorksheetOutput,
} from '@/services/ai/AIService';
import { remoteAIService } from '@/services/ai/RemoteAIService';
import type { SessionArtifact } from '@/services/ai/teachingAssistant';
import { buildGeneratorContext, nccdUnitId } from '@/services/kbContext';
import { getBookForLesson, type KBLesson } from '@/services/knowledgeBase';
import { contentLang } from '@/services/contentLanguage';
import {
  formatActivityText,
  formatLessonPlanText,
  formatQuizText,
  formatWorksheetText,
} from '@/services/share';
import { formatInfographicText } from './infographic.ts';
import { resolveArtifactScope, type ArtifactScope } from './artifactScope.ts';
import { questionCountFromAsk, quizTypesFromAsk } from './examAsk.ts';

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
  | { kind: 'activity'; activity: ActivityOutput }
  | { kind: 'infographic'; infographic: InfographicOutput };

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
  /** `lang` is the material's own language, which can differ from the chat's — see `materialLang`. */
  meta: { subject: string; grade: string; duration?: number; lang: 'ar' | 'en' };
};

/**
 * The material's language and the topic restated in it. English is written in
 * English inside an Arabic chat; the conversation around it is not.
 */
function materialLang(
  topic: string,
  lesson: KBLesson | null,
  scope: ArtifactScope | null,
  lang: 'ar' | 'en',
): { lang: 'ar' | 'en'; topic: string } {
  const matLang = contentLang((lesson ? getBookForLesson(lesson)?.subjectId : null) ?? scope?.subjectId, lang);
  if (matLang === lang || !lesson) return { lang: matLang, topic: topic.trim() };
  return { lang: matLang, topic: matLang === 'ar' ? lesson.titleAr : lesson.titleEn };
}

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
  scope?: ArtifactScope | null,
  ask?: string,
): AIRequest {
  // The lesson's own book, else the picked scope — never a bare maths default
  // for a chemistry teacher's upload. See `resolveArtifactScope`.
  const { subject, grade } = resolveArtifactScope(lesson, scope, lang);

  return {
    grade,
    subject,
    topic,
    duration: 45,
    language: lang === 'ar' ? 'arabic' : 'english',
    teachingStyle: 'direct',
    difficulty: 'medium',
    // What the teacher typed wins over the defaults: «اختبار صح وخطأ» is a
    // true/false paper, not the usual three-type mix. See `examAsk.ts`.
    numQuestions: (ask && questionCountFromAsk(ask)) || 8,
    questionTypes: (ask && quizTypesFromAsk(ask)) || ['multiple_choice', 'short_answer', 'true_false'],
    totalMarks: 20,
    activityType: 'group',
    // Chat was the one generation path sending no curriculum context at all:
    // whatever a teacher had attached, and nothing about the lesson itself. The
    // teacher's own documents stay first — they are the more specific source —
    // and the curriculum block (or the note saying there isn't one) follows.
    additionalContext: [documentContext?.trim(), buildGeneratorContext(topic, lang)]
      .filter(Boolean)
      .join('\n\n') || undefined,
    unitId: nccdUnitId(lesson?.unitId),
    lessonId: lesson?.id,
    // The one generation path that can carry a teacher's own document. When it
    // does, the artifact is derived from their material and must never be
    // pooled for anyone else; with no attachment it is the lesson like every
    // other screen. See AIRequest.contextSource.
    contextSource: documentContext?.trim() ? 'teacher' : 'curriculum',
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
      ? `جهّزت المادة اعتمادًا على الملفات التي رفعتها — موضوع «${topic}».\n\n`
      : `Prepared the material from your uploaded files — topic “${topic}”.\n\n`;
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
  /** The picked subject and grade, for when no lesson grounds the request. */
  scope?: ArtifactScope | null;
  /** The teacher's own message, for the question types and count it names. */
  ask?: string;
}): Promise<ChatArtifactResult> {
  const {
    artifact,
    topic,
    lesson = null,
    lang,
    documentContext,
    fromSoftPin = false,
    scope = null,
    ask,
  } = opts;
  const isAr = lang === 'ar';
  const fromDocuments = !!documentContext?.trim();
  // When docs are the primary context, don't let a soft curriculum lesson override generators
  const lessonForGen = fromDocuments && fromSoftPin ? null : lesson;
  const material = materialLang(topic, lessonForGen, scope, lang);
  const matAr = material.lang === 'ar';
  const req = buildRequest(material.topic, lessonForGen, material.lang, documentContext, scope, ask);
  const meta = { subject: req.subject, grade: req.grade, duration: req.duration, lang: material.lang };
  const titleBase = material.topic;

  const TITLES: Record<SessionArtifact, { ar: string; en: string }> = {
    'lesson-plan': { ar: 'خطة درس', en: 'Lesson plan' },
    worksheet: { ar: 'ورقة عمل', en: 'Worksheet' },
    homework: { ar: 'واجب بيتي', en: 'Homework' },
    quiz: { ar: 'اختبار قصير', en: 'Short quiz' },
    activity: { ar: 'نشاط صفي', en: 'Class activity' },
  };
  const artifactTitle = `${matAr ? TITLES[artifact].ar : TITLES[artifact].en}: ${titleBase}`;

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
        matAr,
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
        matAr,
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
        matAr,
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
        matAr,
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
        matAr,
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

/**
 * A lesson infographic for the chat bubble.
 *
 * Kept apart from `generateChatArtifact` rather than added to
 * `SessionArtifact`: that union keys the prep board, the next-step table and
 * the composer chips, none of which have a slot for an infographic.
 */
export async function generateChatInfographic(opts: {
  topic: string;
  lesson?: KBLesson | null;
  lang: 'ar' | 'en';
  scope?: ArtifactScope | null;
}): Promise<Omit<ChatArtifactResult, 'artifact'> & { data: ChatArtifactData }> {
  const { lesson = null, lang, scope = null } = opts;
  const isAr = lang === 'ar';
  const { lang: matLang, topic } = materialLang(opts.topic, lesson, scope, lang);
  const req = buildRequest(topic, lesson, matLang, undefined, scope);
  const out = await remoteAIService.generateInfographic(req);
  const prose = isAr
    ? `جهّزت إنفوجرافيك لدرس «${topic}». انسخه أو صدّره للطباعة من الأزرار بالأسفل.`
    : `Here is an infographic for “${topic}”. Copy it or export it for printing below.`;
  const title = `${matLang === 'ar' ? 'إنفوجرافيك' : 'Infographic'}: ${topic}`;
  return {
    text: `${prose}\n\n${formatInfographicText(out, matLang === 'ar')}`,
    prose,
    title,
    meta: { subject: req.subject, grade: req.grade, lang: matLang },
    data: { kind: 'infographic', infographic: out },
    topic,
    lessonId: lesson?.id,
  };
}

/**
 * Re-exported so `generateChatArtifact`'s callers keep one import.
 *
 * The function itself lives in `artifactTopic.ts` because this module imports
 * `RemoteAIService` at value level, which `node:test` cannot load — the same
 * split `routeGating.ts` and `docxOutline.ts` already made. Topic resolution
 * is pure string work and is worth testing directly.
 */
export { resolveArtifactTopic } from './artifactTopic.ts';
