/**
 * What chat does with an ask for material when no curriculum lesson grounds it.
 *
 * «نشاط صفي 15 دقيقة للصف السادس: لو كنت وزير التربية ليوم واحد» is a fair ask
 * with no lesson behind it. Chat used to answer it with chips for lessons in
 * other grades, and then with «حاضر — عن أي درس نجهّز هذه المادة؟», which led
 * nowhere: the teacher had already said what the material is about. The
 * activity tool takes a topic the curriculum does not have and says so
 * («الموضوع غير موجود في المنهاج»). Chat now does the same: the topic the
 * teacher typed, in the grade and subject the ask is in, labelled.
 *
 * Pure, and apart from `chatArtifacts.ts` for the reason `artifactTopic.ts` is:
 * that module imports `RemoteAIService` at value level, which `node:test`
 * cannot load.
 */
import { stripSubjectNames } from '../lessonCopilot.ts';
import { quotedTopic, topicFromQuery } from './artifactTopic.ts';

/**
 * The lesson-chip id that means «build it on what I typed», offered next to
 * guessed lessons so a guess is never the only way on.
 */
export const AS_TYPED_CHOICE = 'as-typed';

/** The chip's label. */
export function asTypedChoiceLabel(lang: 'ar' | 'en'): string {
  return lang === 'ar' ? 'على موضوعي كما كتبته' : 'On my topic as typed';
}

/**
 * The topic an ask for material names, with the asking, the grade, the length
 * and the subject taken out — or '' when nothing is left worth building on.
 * The subject is scope (the request carries it), not topic.
 */
export function freeArtifactTopic(query: string): string {
  // Taking the subject out can leave the colon that followed it
  // («في اللغة العربية: لو كنت…»).
  const topic = stripSubjectNames(topicFromQuery(query))
    .replace(/\s+/g, ' ')
    .replace(/^[\s:\uFF1A،,\-–—]+|[\s:\uFF1A،,\-–—]+$/g, '')
    .trim();
  return topic.replace(/[\sً-ْـ]/g, '').length >= 3 ? topic : '';
}

/**
 * Build the material on the typed topic, with no lesson? Only for an ask for
 * material, or a change to one that was built on a typed topic (the caller
 * passes that topic, see `refinementFreeTopic`) — never a question — when nothing else
 * grounds it — no lesson in scope, no upload, not a bare «خطة» riding on the
 * card's lesson — and the ask names a topic. Otherwise the caller's other
 * branches answer, and a bare «نشاط» with nothing picked still asks for the
 * topic.
 */
/**
 * The topic a refinement («اجعله أقصر») changes, when the last material was
 * built on a typed topic and not a lesson: that topic, unless the message fences
 * another in quotes (then the usual path reads it). Without this the refinement
 * went back to the lesson on the card, or, with none, asked «أي درس؟».
 */
export function refinementFreeTopic(query: string, lastFreeTopic: string | null | undefined): string {
  if (!lastFreeTopic?.trim() || quotedTopic(query)) return '';
  return lastFreeTopic.trim();
}

/**
 * The subject a material is labelled with when no lesson grounds it, from the
 * lessons the chat holds (the picked one, the card's): the first one IN the
 * request's grade. A grade 10 maths lesson on the card does not make a grade 6
 * «لو كنت وزير التربية» activity a maths one — generators read the subject NAME
 * (`isMathContext`) and would write maths. Null when none is in that grade.
 */
export function pickedSubjectInGrade(
  gradeId: string | null | undefined,
  picked: ReadonlyArray<{ gradeId?: string | null; subjectId?: string | null } | null | undefined>,
): string | null {
  for (const p of picked) {
    if (!p?.subjectId) continue;
    if (!gradeId || p.gradeId === gradeId) return p.subjectId;
  }
  return null;
}

export function isFreeTopicArtifactAsk(opts: {
  intent: string;
  hasArtifactType: boolean;
  hasKBMatch: boolean;
  hasDocuments: boolean;
  isSoftBareArtifact: boolean;
  typedTopic: string;
}): boolean {
  return (opts.intent === 'artifact' || opts.intent === 'refinement')
    && opts.hasArtifactType
    && !opts.hasKBMatch
    && !opts.hasDocuments
    && !opts.isSoftBareArtifact
    && opts.typedTopic.length > 0;
}

/**
 * The sentence above a chat-made material. Says where it came from, and when
 * no lesson grounds it, says that: a generic activity reads exactly like a
 * curriculum one, and the teacher carries it into a class believing it follows
 * the book.
 */
export function chatArtifactLeadIn(opts: {
  topic: string;
  isAr: boolean;
  fromSoftPin: boolean;
  fromDocuments: boolean;
  /** A curriculum lesson grounds the material. */
  inCurriculum: boolean;
}): string {
  const { topic, isAr, fromSoftPin, fromDocuments, inCurriculum } = opts;
  if (fromDocuments) {
    return isAr
      ? `جهّزت المادة اعتمادًا على الملفات التي رفعتها — موضوع «${topic}».\n\n`
      : `Prepared the material from your uploaded files — topic “${topic}”.\n\n`;
  }
  if (!inCurriculum) {
    return isAr
      ? `المادة جاهزة لموضوع «${topic}» كما كتبته. لم أجد هذا الموضوع درسًا في المنهاج، فالمادة عامة وليست مبنية على درس من الكتاب.\n\n`
      : `Ready for “${topic}”, as you typed it. I found no curriculum lesson on it, so the material is general, not built on a textbook lesson.\n\n`;
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
