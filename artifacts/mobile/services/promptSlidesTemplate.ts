/**
 * The deterministic, non-AI deck behind `/ai-tools/prompt-slides`'s Free mode
 * (`PromptSlidesRequest.mode === 'free'`) — and, doubling as
 * `MockAIService.generatePromptSlides`, the offline/DEMO_MODE fallback for
 * its AI mode.
 *
 * Unlike every other offline mock in `services/ai/generators.ts`, this one
 * has no curriculum lesson to ground itself in — a free-text prompt like "6
 * slides on photosynthesis, fun tone, 2 quiz questions" has no rule-based way
 * to be honoured for its SPECIFIC content. What this can honestly do:
 * acknowledge the prompt, size the deck to the requested slide count, and
 * offer a plausible, clearly generic outline — never claim to have followed
 * content it did not generate. That is the accepted trade-off for this one
 * tool (see the plan this shipped from).
 */
import type { ActivitySlide, ClassroomActivity, PromptSlidesRequest } from './ai/AIService.ts';
import { rebuildAnswerKey } from './lessonSlides.ts';

const DEFAULT_SLIDE_COUNT = 6;
const MIN_SLIDE_COUNT = 3;
const MAX_SLIDE_COUNT = 20;

function clampSlideCount(n: number | undefined): number {
  if (!Number.isFinite(n) || !n || n <= 0) return DEFAULT_SLIDE_COUNT;
  return Math.max(MIN_SLIDE_COUNT, Math.min(MAX_SLIDE_COUNT, Math.floor(n)));
}

/** A short label for the deck title — the prompt itself, capped, since there
 *  is no model here to distill one out of it. */
function titleFrom(prompt: string, isAr: boolean): string {
  const trimmed = prompt.trim();
  const cap = 60;
  const short = trimmed.length > cap ? `${trimmed.slice(0, cap - 1).trim()}…` : trimmed;
  return short || (isAr ? 'عرض شرائح' : 'Slide deck');
}

/** Loose keyword check — good enough to decide whether to add placeholder
 *  quiz slides, not precise enough to claim it "understood" the prompt. */
function wantsQuestions(prompt: string): boolean {
  return /سؤال|أسئلة|اختبار|تحقق|quiz|question|test|check/i.test(prompt);
}

export function buildPromptSlidesTemplate(req: PromptSlidesRequest): ClassroomActivity {
  const isAr = req.language === 'arabic';
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const prompt = req.prompt.trim();
  const title = titleFrom(prompt, isAr);
  const slideCount = clampSlideCount(req.slideCount);
  const includeQuestion = wantsQuestions(prompt);
  // Reserve room for intro + summary (+ one question slide, when included);
  // whatever remains becomes generic concept slides, never fewer than one.
  const reserved = 2 + (includeQuestion ? 1 : 0);
  const conceptCount = Math.max(1, slideCount - reserved);

  const slides: ActivitySlide[] = [];
  let n = 1;

  slides.push({
    slideNumber: n++,
    type: 'intro',
    title,
    content: L(
      `عرض شرائح عام حول: "${prompt}". هذا القالب المجاني نص عام لا يتبع تفاصيل الطلب بدقة — للحصول على محتوى مطابق للطلب استخدم خيار "الذكاء الاصطناعي".`,
      `A general slide deck for: "${prompt}". This free template is generic prose that does not follow the request's specific details — for content that actually matches the prompt, use the "AI-generated" option.`,
    ),
    durationSeconds: 0,
  });

  for (let i = 1; i <= conceptCount; i++) {
    slides.push({
      slideNumber: n++,
      type: 'intro',
      title: L(`النقطة ${i}`, `Point ${i}`),
      content: L(
        `اشرح هنا الفكرة رقم ${i} المتعلقة بالموضوع — عدّل هذا النص ليطابق طلبك.`,
        `Explain point ${i} related to the topic here — edit this text to match your request.`,
      ),
      durationSeconds: 0,
    });
  }

  if (includeQuestion) {
    const options = isAr
      ? ['الخيار الأول', 'الخيار الثاني', 'الخيار الثالث', 'الخيار الرابع']
      : ['First option', 'Second option', 'Third option', 'Fourth option'];
    slides.push({
      slideNumber: n++,
      type: 'question',
      title: L('سؤال 1', 'Question 1'),
      content: L('عدّل نص هذا السؤال ليطابق الموضوع', 'Edit this question to match your topic'),
      options,
      correctIndex: 0,
      durationSeconds: 45,
    });
  }

  slides.push({
    slideNumber: n++,
    type: 'summary',
    title: L('الخلاصة', 'Summary'),
    content: L('لخّص أهم نقاط العرض هنا.', 'Summarize the deck\'s key points here.'),
    durationSeconds: 0,
  });

  return {
    activityName: title,
    activityType: 'prompt-slides',
    grade: req.grade,
    subject: req.subject,
    lesson: title,
    duration: 20,
    difficulty: 'standard',
    groupType: 'whole-class',
    learningObjective: L(
      'هدف تعليمي عام مشتق من طلب المعلّم — عدّله ليطابق الموضوع بدقة.',
      'A general objective derived from the teacher\'s request — edit it to match the topic precisely.',
    ),
    materials: [L('شاشة عرض', 'Projector')],
    teacherPreparation: L(
      'هذا عرض مجاني عام. راجع كل شريحة وعدّلها لتطابق طلبك قبل الحصة.',
      'This is a generic free deck. Review and edit every slide to match your request before class.',
    ),
    slides,
    teacherNotes: [
      L(
        'أُنشئ هذا العرض بالقالب المجاني، وليس بالذكاء الاصطناعي — راجع المحتوى وعدّله.',
        'This deck was built with the free template, not AI — review and edit the content.',
      ),
    ],
    answerKey: rebuildAnswerKey(slides, isAr),
    printables: [],
    assessment: L('راجع فهم الطلبة بالأسئلة أو المناقشة أثناء العرض.', 'Check understanding via questions or discussion during the deck.'),
    extensionChallenge: '',
  };
}
