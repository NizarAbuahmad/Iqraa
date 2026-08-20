/**
 * Investor MVP chat voice — collaborative Jordanian teaching assistant.
 * Demo Mode: fully local KB grounding. No OpenAI / network.
 */

import type { KBLesson } from '../knowledgeBase';
import { getBookForLesson, getUnitForLesson } from '../knowledgeBase';
import { SUBJECTS } from '../curriculumData';
import {
  formatSupportResourcesBlock,
  searchSupportResources,
} from '../mathSupportResources';

export type TeachingAssistantMode = 'teacher' | 'student';

export type TeachingActionType =
  | 'lesson-plan'
  | 'worksheet'
  | 'quiz'
  | 'homework'
  | 'activity';

export type TeachingAction = {
  type: TeachingActionType;
  labelAr: string;
  labelEn: string;
  emoji: string;
};

export type CurriculumContext = {
  curriculumAr: string;
  curriculumEn: string;
  gradeAr: string;
  gradeEn: string;
  subjectAr: string;
  subjectEn: string;
  semester: 1 | 2;
  semesterLabelAr: string;
  semesterLabelEn: string;
  unitTitleAr: string;
  unitTitleEn: string;
  lessonTitleAr: string;
  lessonTitleEn: string;
  lessonId: string;
};

export type SessionArtifact = TeachingActionType;

/** Guided lesson-preparation checklist steps (session-only, Demo Mode). */
export type PrepStepId =
  | 'explanation'
  | 'lesson-plan'
  | 'worksheet'
  | 'quiz'
  | 'activity'
  | 'homework';

export const PREP_ARTIFACT_STEPS: PrepStepId[] = [
  'lesson-plan',
  'worksheet',
  'quiz',
  'activity',
  'homework',
];

export const PREP_ALL_STEPS: PrepStepId[] = ['explanation', ...PREP_ARTIFACT_STEPS];

export type PrepProgressView = {
  lessonTitle: string;
  done: { id: PrepStepId; label: string }[];
  remaining: { id: PrepStepId; label: string }[];
  allReady: boolean;
  recommendation: string | null;
};

/** Lightweight ref to a resource produced in this chat session (no workspace layer). */
export type GeneratedResourceRef = {
  type: SessionArtifact;
  updatedAt: number;
  /** Optional SavedMaterial id when the teacher saved/exported it. */
  savedId?: string;
};

/** How strongly the active lesson should bias retrieval. */
export type LessonPinStrength = 'none' | 'soft' | 'hard';

export type ChatSessionMemory = {
  activeLessonId: string | null;
  activeTopicAr: string | null;
  activeTopicEn: string | null;
  /**
   * soft = suggested default for the lesson card (do not override clear KB hits).
   * hard = teacher chose the lesson or a high-confidence match was accepted.
   */
  lessonPin: LessonPinStrength;
  recentQueries: string[];
  discussedArtifacts: SessionArtifact[];
  /** Resources generated/refined in this session around the active lesson. */
  generatedResources: GeneratedResourceRef[];
  /** Last artifact the teacher created or refined — used for "make it harder" etc. */
  lastGeneratedResource: SessionArtifact | null;
  lastIntent: Intent | null;
  clarifiedLessonIds: string[];
  /** Lesson the preparation checklist is tracking. */
  prepLessonId: string | null;
  /** Completed preparation steps for prepLessonId. */
  prepCompleted: PrepStepId[];
  /** Most recently completed step — drives the next recommendation. */
  lastCompletedPrepStep: PrepStepId | null;
};

export type TeachingAssistantInput = {
  query: string;
  lessons: KBLesson[];
  lang: 'ar' | 'en';
  mode: TeachingAssistantMode;
  teachingContext?: string | null;
  memory?: ChatSessionMemory;
  /** From Intent Router — refinement / artifact / teaching. */
  routeIntent?: 'teaching' | 'artifact' | 'refinement';
  /**
   * Teacher-uploaded materials (PDF/DOCX/PPTX/TXT/image) as a prompt block.
   * When present, replies ground on these files in addition to / instead of KB.
   */
  documentContext?: string | null;
  /** Display names of ready uploaded files. */
  documentNames?: string[];
};

export type ClarificationOption = {
  id: string;
  labelAr: string;
  labelEn: string;
};

export type TeachingAssistantResult = {
  text: string;
  actions: TeachingAction[];
  needsClarification: boolean;
  clarificationOptions?: ClarificationOption[];
  clarificationQuery?: string;
  activeLesson: KBLesson | null;
  memoryPatch: Partial<ChatSessionMemory>;
};

type Intent =
  | 'explain'
  | 'lesson_plan'
  | 'worksheet'
  | 'quiz'
  | 'homework'
  | 'activity'
  | 'example'
  | 'short'
  | 'follow_up'
  | 'general';

export function emptyChatSessionMemory(): ChatSessionMemory {
  return {
    activeLessonId: null,
    activeTopicAr: null,
    activeTopicEn: null,
    lessonPin: 'none',
    recentQueries: [],
    discussedArtifacts: [],
    generatedResources: [],
    lastGeneratedResource: null,
    lastIntent: null,
    clarifiedLessonIds: [],
    prepLessonId: null,
    prepCompleted: [],
    lastCompletedPrepStep: null,
  };
}

/** Record or refresh a generated resource on the active lesson session. */
export function recordGeneratedResource(
  memory: ChatSessionMemory,
  type: SessionArtifact,
  savedId?: string,
): ChatSessionMemory {
  const now = Date.now();
  const others = memory.generatedResources.filter(r => r.type !== type);
  const prev = memory.generatedResources.find(r => r.type === type);
  const next: GeneratedResourceRef = {
    type,
    updatedAt: now,
    savedId: savedId ?? prev?.savedId,
  };
  const discussed = memory.discussedArtifacts.includes(type)
    ? memory.discussedArtifacts
    : [...memory.discussedArtifacts.filter(a => a !== type), type].slice(-6);
  let patched: ChatSessionMemory = {
    ...memory,
    generatedResources: [...others, next],
    lastGeneratedResource: type,
    discussedArtifacts: discussed,
  };
  const lessonId = memory.activeLessonId ?? memory.prepLessonId;
  if (lessonId) {
    patched = markPrepStep(patched, lessonId, type);
  }
  return patched;
}

export function hasGeneratedResource(
  memory: ChatSessionMemory,
  type: SessionArtifact,
): boolean {
  return memory.generatedResources.some(r => r.type === type)
    || memory.discussedArtifacts.includes(type)
    || memory.prepCompleted.includes(type);
}

function prepStepLabel(step: PrepStepId, isAr: boolean): string {
  const ar: Record<PrepStepId, string> = {
    explanation: 'شرح الفكرة',
    'lesson-plan': 'خطة درس',
    worksheet: 'ورقة عمل',
    quiz: 'اختبار قصير',
    activity: 'نشاط صفي',
    homework: 'واجب منزلي',
  };
  const en: Record<PrepStepId, string> = {
    explanation: 'Explain the idea',
    'lesson-plan': 'Lesson plan',
    worksheet: 'Worksheet',
    quiz: 'Short quiz',
    activity: 'Classroom activity',
    homework: 'Homework',
  };
  return isAr ? ar[step] : en[step];
}

/** Next suggested action after the latest completed prep step. */
export function nextPrepRecommendation(
  completed: PrepStepId[],
  lastStep: PrepStepId | null,
  isAr: boolean,
): string | null {
  const remaining = PREP_ALL_STEPS.filter(s => !completed.includes(s));
  if (remaining.length === 0) {
    return isAr
      ? 'اكتملت مواد الدرس — يمكنك تصديرها جميعاً إلى PDF.'
      : 'You can now export all materials to PDF.';
  }
  if (!lastStep) {
    const next = remaining[0]!;
    return isAr
      ? `أقترح الآن: ${prepStepLabel(next, true)}.`
      : `I suggest next: ${prepStepLabel(next, false)}.`;
  }

  // Prefer a logical teaching sequence after the last completion
  const preferAfter: Record<PrepStepId, PrepStepId[]> = {
    explanation: ['lesson-plan', 'worksheet', 'activity'],
    'lesson-plan': ['worksheet', 'activity', 'quiz'],
    worksheet: ['quiz', 'homework', 'activity'],
    quiz: ['homework', 'activity', 'worksheet'],
    activity: ['worksheet', 'quiz', 'homework'],
    homework: ['quiz', 'activity', 'lesson-plan'],
  };

  const preferred = preferAfter[lastStep].find(s => remaining.includes(s));
  const next = preferred ?? remaining[0]!;

  if (isAr) {
    if (next === 'worksheet') return 'لنجهّز الآن ورقة عمل.';
    if (next === 'quiz') return 'أنصح باختبار قصير قبل أن نغلق تحضير الدرس.';
    if (next === 'lesson-plan') return 'أقترح الآن: حضّر خطة الدرس.';
    if (next === 'activity') return 'لنصمّم نشاطاً صفياً قصيراً.';
    if (next === 'homework') return 'أضف واجباً منزلياً خفيفاً لتثبيت الفكرة.';
    return `أقترح الآن: ${prepStepLabel(next, true)}.`;
  }
  if (next === 'worksheet') return 'I suggest creating a worksheet next.';
  if (next === 'quiz') return 'I recommend a short quiz before you wrap up.';
  if (next === 'lesson-plan') return 'I suggest creating a lesson plan next.';
  if (next === 'activity') return 'I suggest a short classroom activity next.';
  if (next === 'homework') return 'You can prepare a light homework set next.';
  return `I suggest next: ${prepStepLabel(next, false)}.`;
}

/**
 * Mark a preparation step complete for the active lesson (session-only).
 * Resets the checklist when the teacher switches lessons.
 */
export function markPrepStep(
  memory: ChatSessionMemory,
  lessonId: string | null | undefined,
  step: PrepStepId,
): ChatSessionMemory {
  if (!lessonId) return memory;
  const sameLesson = memory.prepLessonId === lessonId;
  const baseCompleted = sameLesson ? memory.prepCompleted : [];
  if (baseCompleted.includes(step)) {
    return {
      ...memory,
      prepLessonId: lessonId,
      prepCompleted: baseCompleted,
      lastCompletedPrepStep: step,
    };
  }
  return {
    ...memory,
    prepLessonId: lessonId,
    prepCompleted: [...baseCompleted, step],
    lastCompletedPrepStep: step,
  };
}

export function buildPrepProgressView(
  memory: ChatSessionMemory,
  lang: 'ar' | 'en',
): PrepProgressView | null {
  if (!memory.prepLessonId && !memory.activeLessonId) return null;
  if (memory.prepCompleted.length === 0 && !memory.activeLessonId) return null;

  const isAr = lang === 'ar';
  const lessonTitle = isAr
    ? (memory.activeTopicAr ?? '')
    : (memory.activeTopicEn ?? memory.activeTopicAr ?? '');

  // Show progress once preparation has started (explanation or any artifact)
  if (memory.prepCompleted.length === 0) return null;

  const done = memory.prepCompleted.map(id => ({
    id,
    label: prepStepLabel(id, isAr),
  }));
  const remaining = PREP_ALL_STEPS
    .filter(s => !memory.prepCompleted.includes(s))
    .map(id => ({ id, label: prepStepLabel(id, isAr) }));

  const allReady = remaining.length === 0;
  const recommendation = allReady
    ? (isAr
        ? 'اكتملت مواد الدرس — يمكنك تصديرها جميعاً إلى PDF.'
        : 'You can now export all materials to PDF.')
    : nextPrepRecommendation(memory.prepCompleted, memory.lastCompletedPrepStep, isAr);

  return {
    lessonTitle,
    done,
    remaining,
    allReady,
    recommendation,
  };
}

export function artifactTypeToPrepStep(
  type: TeachingActionType | 'lesson',
): PrepStepId | null {
  if (type === 'lesson') return null;
  return type;
}

export function resolveCurriculumContext(lesson: KBLesson): CurriculumContext {
  const book = getBookForLesson(lesson);
  const unit = getUnitForLesson(lesson);
  const semester = (book?.semester === 2 ? 2 : 1) as 1 | 2;
  // Subject follows the lesson's book — this used to hardcode الرياضيات,
  // which stamped chemistry/finlit replies with the wrong subject line.
  const subject = book ? SUBJECTS.find(s => s.id === book.subjectId) : undefined;
  return {
    curriculumAr: 'المنهاج الأردني',
    curriculumEn: 'Jordan Curriculum',
    gradeAr: 'الصف العاشر',
    gradeEn: 'Grade 10',
    subjectAr: subject?.nameAr ?? 'الرياضيات',
    subjectEn: subject?.name ?? 'Mathematics',
    semester,
    semesterLabelAr: semester === 1 ? 'الفصل الأول' : 'الفصل الثاني',
    semesterLabelEn: semester === 1 ? 'Semester 1' : 'Semester 2',
    unitTitleAr: unit?.titleAr ?? '',
    unitTitleEn: unit?.titleEn ?? '',
    lessonTitleAr: lesson.titleAr,
    lessonTitleEn: lesson.titleEn,
    lessonId: lesson.id,
  };
}

/** Short follow-ups that refer to the active lesson ("أضف نشاطاً", "also a quiz"). */
export function isReferentialQuery(query: string): boolean {
  const q = query.trim();
  if (q.length <= 28 && /^(أضف|ضيف|كمان|أيضاً?|ايضا|نفس|للدرس|لهذا|عليها|عليه|continue|also|add|more|same)\b/i.test(q)) {
    return true;
  }
  return /أضف|ضيف|كمان|أيضاً?|لنفس|لهذا الدرس|في نفس|continue with|add (a |an )?|also (make|create|add)|for this lesson|same lesson/i.test(q);
}

export function detectIntent(query: string): Intent {
  const q = query.trim();
  if (/مختصر|باختصار|فقط\s*الإجابة|short\s*answer|briefly|just\s*the\s*answer|اختصره|اجعله\s*أبسط|أجعله\s*أبسط|simplify|shorten/i.test(q)) {
    return 'short';
  }
  // Bare "خطة" / "إعداد خطة" must map to lesson_plan (chip + short typed shortcuts)
  if (/^(إعداد\s*)?خطة(\s*درس)?$/i.test(q) || /خطة\s*درس|lesson\s*plan|(^|[\s،,])خطة([\s،,]|$)/i.test(q)) {
    return 'lesson_plan';
  }
  if (/واجب|homework/i.test(q)) return 'homework';
  if (/ورقة(\s*عمل)?|worksheet/i.test(q)) return 'worksheet';
  if (/اختبار|تقويم|quiz|assessment/i.test(q)) return 'quiz';
  if (/نشاط|activity|تعاوني|جماعي|لعبة/i.test(q)) return 'activity';
  if (/مثال|example|تمارين?\s*محلول|أضف\s*مثالاً?|اضف\s*مثال|add\s*an?\s*example/i.test(q)) {
    return 'example';
  }
  if (/كيف\s*أشرح|شرح|explain|simplify|بسّ?ط|سهلة|بطريقة|للطلاب\s*الضعفاء|للطلاب\s*المتفوقين/i.test(q)) {
    return 'explain';
  }
  if (isReferentialQuery(q)) return 'follow_up';
  return 'general';
}

function intentToArtifact(intent: Intent): SessionArtifact | null {
  switch (intent) {
    case 'lesson_plan': return 'lesson-plan';
    case 'worksheet': return 'worksheet';
    case 'quiz': return 'quiz';
    case 'homework': return 'homework';
    case 'activity': return 'activity';
    default: return null;
  }
}

/** Public helper — map a teacher ask to an artifact type when applicable. */
export function artifactFromQuery(query: string): SessionArtifact | null {
  return intentToArtifact(detectIntent(query));
}

function hashPick<T>(items: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * (i + 1)) % 997;
  return items[h % items.length]!;
}

function pickAck(isAr: boolean, intent: Intent, seed: string): string {
  const ar: Record<string, string[]> = {
    explain: [
      'لنبسّطها لطلابك خطوة بخطوة.',
      'فكرة ممتازة — الشرح الواضح يوفّر وقت الحصة.',
      'حاضر، نبدأ من زاوية تناسب الصف العاشر.',
    ],
    lesson_plan: [
      'تمام، نرتّب الحصة معاً بشكل عملي.',
      'حسناً، نبني خطة واضحة يسهل تنفيذها غداً.',
    ],
    worksheet: [
      'ممتاز، ورقة العمل تثبّت المهارة بعد الشرح.',
      'حاضر، نرتّب تمارين متدرجة الصعوبة.',
    ],
    quiz: [
      'حسناً، نجهّز تقويماً سريعاً يقيس الفهم.',
      'تمام، اختبار قصير يساعدنا على معرفة أين وصل الطلاب.',
    ],
    homework: [
      'حاضر، واجب قصير ومركّز خير من واجب طويل.',
      'ممتاز، نختار تمارين تعزّز ما شُرح في الحصة.',
    ],
    activity: [
      'رائع — النشاط التعاوني يحرّك الصف.',
      'تمام، نصمّم نشاطاً جماعياً قصيراً وواضحاً.',
    ],
    follow_up: [
      'مفهوم، نكمل ضمن نفس الدرس.',
      'حاضر، سأكمل من حيث توقفنا.',
    ],
    general: [
      'حاضر، لنربط الإجابة بدرسك الحالي.',
      'تمام، سأجهّز لك اقتراحاً جاهزاً للتدريس.',
      'حسناً، نتناوله ضمن سياق المنهاج.',
    ],
  };
  const en: Record<string, string[]> = {
    explain: [
      'Let’s simplify this for your Grade 10 class.',
      'Good call — a clear explanation saves class time.',
    ],
    lesson_plan: ['Let’s build a practical plan you can run tomorrow.'],
    worksheet: ['Great — practice will lock in the skill.'],
    quiz: ['Sure — a short check will show what stuck.'],
    homework: ['Perfect — a short homework set beats a long one.'],
    activity: ['Nice — a cooperative activity will energize the room.'],
    follow_up: ['Got it — continuing with the same lesson.'],
    general: ['Sure — I’ll keep this tied to your current lesson.'],
  };
  const key = intent in ar ? intent : 'general';
  return hashPick(isAr ? ar[key]! : en[key]!, seed);
}

function contextLine(ctx: CurriculumContext, isAr: boolean): string {
  if (isAr) {
    const unit = ctx.unitTitleAr ? `، وحدة «${ctx.unitTitleAr}»` : '';
    return `بناءً على درس «${ctx.lessonTitleAr}»${unit} — ${ctx.curriculumAr} · ${ctx.gradeAr} · ${ctx.subjectAr} · ${ctx.semesterLabelAr}:`;
  }
  const unit = ctx.unitTitleEn ? `, unit “${ctx.unitTitleEn}”` : '';
  return `Based on the lesson “${ctx.lessonTitleEn}”${unit} — ${ctx.curriculumEn} · ${ctx.gradeEn} · ${ctx.subjectEn} · ${ctx.semesterLabelEn}:`;
}

function memoryHint(isAr: boolean, memory: ChatSessionMemory, intent: Intent): string | null {
  if (memory.discussedArtifacts.length === 0 && memory.recentQueries.length < 2) return null;
  const arts = memory.discussedArtifacts;
  if (isAr) {
    if (arts.length > 0 && intent === 'follow_up') {
      const labels: Record<SessionArtifact, string> = {
        'lesson-plan': 'خطة الدرس',
        worksheet: 'ورقة العمل',
        quiz: 'الاختبار',
        homework: 'الواجب',
        activity: 'النشاط',
      };
      const named = arts.slice(-2).map(a => labels[a]).join(' و');
      return `سأبني على ما جهّزناه سابقاً (${named}) لنفس الدرس.`;
    }
    if (memory.activeTopicAr && isReferentialQuery(memory.recentQueries[memory.recentQueries.length - 1] ?? '')) {
      return `سأكمل على «${memory.activeTopicAr}» دون أن تعيد شرح السياق.`;
    }
  } else {
    if (arts.length > 0 && intent === 'follow_up') {
      return `Building on what we already prepared for this lesson.`;
    }
  }
  return null;
}

function actionMenu(isAr: boolean, omitted?: TeachingActionType): string {
  const lines = isAr
    ? [
        'أستطيع أيضاً أن أجهّز لك:',
        '• خطة درس',
        '• ورقة عمل',
        '• اختبار قصير',
        '• واجب منزلي',
        '• نشاط صفي تعاوني',
      ]
    : [
        'I can also:',
        '• Create a lesson plan',
        '• Prepare a worksheet',
        '• Build a short quiz',
        '• Design homework',
        '• Design a cooperative activity',
      ];
  if (!omitted) return lines.join('\n');
  const drop: Record<TeachingActionType, RegExp> = {
    'lesson-plan': /خطة درس|lesson plan/i,
    worksheet: /ورقة عمل|worksheet/i,
    quiz: /أداة تقييم|اختبار|quiz/i,
    homework: /واجب|homework/i,
    activity: /نشاط|activity/i,
  };
  return lines.filter((line, i) => i === 0 || !drop[omitted].test(line)).join('\n');
}

export function defaultTeachingActions(): TeachingAction[] {
  return [
    { type: 'lesson-plan', labelAr: 'خطة درس', labelEn: 'Create lesson plan', emoji: '📄' },
    { type: 'worksheet', labelAr: 'ورقة عمل', labelEn: 'Create worksheet', emoji: '📝' },
    { type: 'quiz', labelAr: 'اختبار قصير', labelEn: 'Create quiz', emoji: '❓' },
    { type: 'homework', labelAr: 'واجب منزلي', labelEn: 'Create homework', emoji: '🏠' },
    { type: 'activity', labelAr: 'نشاط صفي', labelEn: 'Classroom activity', emoji: '🎯' },
  ];
}

function prioritizeActions(intent: Intent): TeachingAction[] {
  const all = defaultTeachingActions();
  const primary: TeachingActionType | null = intentToArtifact(intent);
  if (!primary) return all;
  return [...all.filter(a => a.type === primary), ...all.filter(a => a.type !== primary)];
}

function pickFollowUp(
  isAr: boolean,
  intent: Intent,
  title: string,
  memory: ChatSessionMemory,
): string {
  const hasPlan = memory.discussedArtifacts.includes('lesson-plan');
  const hasWs = memory.discussedArtifacts.includes('worksheet');
  if (isAr) {
    if (intent === 'activity') {
      return hasPlan
        ? 'هل أضبط زمن النشاط داخل خطة الدرس الحالية؟'
        : `هل نضمّ هذا النشاط إلى خطة درس «${title}»؟`;
    }
    if (intent === 'explain') {
      return hasWs
        ? 'هل نضيف تقويماً قصيراً في آخر الحصة؟'
        : `هل تحب أن أجهّز ورقة عمل قصيرة على «${title}»؟`;
    }
    if (intent === 'lesson_plan') {
      return 'هل نرفق ورقة عمل لنفس أهداف الحصة؟';
    }
    if (intent === 'worksheet' || intent === 'homework') {
      return 'هل أرفق معها مفتاح الإجابة؟';
    }
    if (intent === 'quiz') {
      return 'هل تفضّل أسئلة اختيار من متعدد أم أسئلة قصيرة؟';
    }
    if (intent === 'follow_up') {
      return 'هل ننتقل إلى الخطوة التالية في تحضير الحصة؟';
    }
    return `ما الخطوة التالية التي تريدها لدرس «${title}»؟`;
  }
  if (intent === 'activity') {
    return hasPlan
      ? 'Should I fit this activity into the current lesson plan timing?'
      : `Want me to fold this into a full lesson plan for “${title}”?`;
  }
  if (intent === 'explain') {
    return hasWs
      ? 'Shall we add a short exit ticket at the end?'
      : `Would you like a short worksheet on “${title}”?`;
  }
  if (intent === 'lesson_plan') return 'Shall I attach a worksheet for the same objectives?';
  if (intent === 'worksheet' || intent === 'homework') return 'Want a teacher answer key included?';
  if (intent === 'quiz') return 'Multiple-choice or short-answer items?';
  if (intent === 'follow_up') return 'What should we prepare next for this lesson?';
  return `What would you like to prepare next for “${title}”?`;
}

function nextStepsBlock(isAr: boolean, intent: Intent): string {
  if (isAr) {
    if (intent === 'worksheet' || intent === 'homework') {
      return [
        'أقترح هذا التسلسل:',
        '• سؤالان تمهيديان',
        '• 3 أسئلة متدرجة',
        '• سؤال سياقي من حياة الطالب',
        '• مفتاح إجابة للمعلم',
      ].join('\n');
    }
    if (intent === 'quiz') {
      return [
        'تقويم سريع مقترح:',
        '• سؤالان اختيار من متعدد',
        '• سؤال مهارة قصيرة',
        '• سؤال تحدٍّ خفيف',
        '• مراجعة جماعية في آخر 5 دقائق',
      ].join('\n');
    }
    if (intent === 'activity' || intent === 'follow_up') {
      return [
        'نشاط تعاوني مقترح:',
        '• تهيئة (3 دقائق)',
        '• مجموعات ثنائية أو رباعية (10–12 دقيقة)',
        '• مشاركة سريعة للنتائج',
        '• تلخيص جماعي لنقطة واحدة أساسية',
      ].join('\n');
    }
    return [
      'مسار حصة مقترح:',
      '• نشاط افتتاحي (5 دقائق)',
      '• شرح تدريجي (15 دقيقة)',
      '• مثال محلول',
      '• نشاط جماعي',
      '• تقويم سريع ختامي',
    ].join('\n');
  }
  if (intent === 'worksheet' || intent === 'homework') {
    return [
      'Suggested sequence:',
      '• Two warm-up items',
      '• Three rising-difficulty questions',
      '• One real-life contextual item',
      '• Teacher answer key',
    ].join('\n');
  }
  if (intent === 'quiz') {
    return [
      'Suggested quick check:',
      '• Two multiple-choice items',
      '• One short skill check',
      '• One light challenge',
      '• 5-minute class review',
    ].join('\n');
  }
  if (intent === 'activity' || intent === 'follow_up') {
    return [
      'Suggested cooperative activity:',
      '• Warm-up (3 minutes)',
      '• Pairs/groups (10–12 minutes)',
      '• Quick share-out',
      '• One-point class summary',
    ].join('\n');
  }
  return [
    'Suggested lesson flow:',
    '• Warm-up (5 minutes)',
    '• Guided explanation (15 minutes)',
    '• Worked example',
    '• Group activity',
    '• Exit ticket',
  ].join('\n');
}

function shortReply(isAr: boolean, lesson: KBLesson, ctx: CurriculumContext): string {
  const summary = isAr ? lesson.summaryAr : lesson.summaryEn;
  const rules = (isAr ? lesson.rulesAr : lesson.rulesEn) ?? [];
  const head = isAr
    ? `باختصار — درس «${ctx.lessonTitleAr}»:`
    : `Briefly — lesson “${ctx.lessonTitleEn}”:`;
  const lines = [head, summary];
  if (rules[0]) {
    lines.push('');
    lines.push(isAr ? `الصيغة الأساسية: ${rules[0]}` : `Key rule: ${rules[0]}`);
  }
  return lines.join('\n');
}

function shouldAskPedagogicalClarify(
  query: string,
  intent: Intent,
  lessonId: string,
  memory: ChatSessionMemory,
): boolean {
  if (intent !== 'explain') return false;
  if (memory.clarifiedLessonIds.includes(lessonId)) return false;
  if (/لأول\s*مرة|مراجعة|قبل\s*الاختبار|first\s*time|review|revision|introduc/i.test(query)) {
    return false;
  }
  return true;
}

function buildClarification(
  query: string,
  ctx: CurriculumContext,
  isAr: boolean,
): TeachingAssistantResult {
  const text = isAr
    ? `${contextLine(ctx, true)}\n\nقبل أن أبدأ: هل هذا شرح للمفهوم لأول مرة، أم مراجعة قبل الاختبار؟`
    : `${contextLine(ctx, false)}\n\nQuick check so I help precisely: is this a first-time introduction, or a review before the test?`;

  return {
    text,
    actions: [],
    needsClarification: true,
    clarificationOptions: [
      {
        id: 'first_time',
        labelAr: 'شرح لأول مرة',
        labelEn: 'First-time explanation',
      },
      {
        id: 'review',
        labelAr: 'مراجعة قبل الاختبار',
        labelEn: 'Review before the test',
      },
    ],
    clarificationQuery: query,
    activeLesson: null,
    memoryPatch: {
      activeLessonId: ctx.lessonId,
      activeTopicAr: ctx.lessonTitleAr,
      activeTopicEn: ctx.lessonTitleEn,
      clarifiedLessonIds: [ctx.lessonId],
    },
  };
}

/**
 * Resolve which lesson the teacher is collaborating on for this turn.
 */
export function resolveActiveLesson(
  lessons: KBLesson[],
  memory: ChatSessionMemory,
  query: string,
): KBLesson | null {
  if (isReferentialQuery(query) && memory.activeLessonId) {
    const pinned = lessons.find(l => l.id === memory.activeLessonId);
    if (pinned) return pinned;
  }
  return lessons[0] ?? null;
}

/**
 * Build a collaborative teaching-assistant reply (Demo Mode / offline).
 */
function buildDocumentGroundedReply(
  query: string,
  documentContext: string,
  documentNames: string[],
  isAr: boolean,
  intent: Intent,
): string {
  const files = documentNames.length
    ? documentNames.map(n => `«${n}»`).join(isAr ? ' و' : ' & ')
    : (isAr ? 'الملفات المرفوعة' : 'the uploaded files');

  const ask = query.trim();
  const lead = isAr
    ? `اعتمادًا على ${files} التي رفعتها:`
    : `Based on ${files} you uploaded:`;

  const excerpt = documentContext.trim().slice(0, 900);
  const bodyByIntent: Record<Intent, string> = {
    lesson_plan: isAr
      ? `${lead}\n\n**خطة درس مقترحة من ملفاتك**\n1) تمهيد (5 دقائق): ربط سريع بمفاهيم الملف.\n2) شرح أساسي (15 دقيقة): الأهداف والمفاهيم المستخرجة.\n3) تطبيق موجّه (15 دقيقة): مثال من المحتوى.\n4) تقويم تكويني (5 دقائق): سؤالان قصيران.\n5) إغلاق (5 دقائق): جملة تلخيصية.\n\n(مقتطف من الملفات)\n${excerpt}\n\nاضغط «خطة درس» أو اكتب: حضّر خطة درس — لخطة كاملة مفصّلة.`
      : `${lead}\n\n**Suggested lesson plan from your files**\n1) Warm-up (5 min): connect to file concepts.\n2) Core explain (15 min): extracted objectives & ideas.\n3) Guided practice (15 min): example from the material.\n4) Formative check (5 min): two short questions.\n5) Close (5 min): summary sentence.\n\n(File excerpt)\n${excerpt}\n\nTap “Lesson plan” or type: prepare a lesson plan — for a full structured plan.`,
    worksheet: isAr
      ? `${lead}\n\n**ورقة عمل صفية**\nأ) تمهيد سهل · ب) تدريب متوسط · ج) سؤال أصعب.\nكلها مبنية على مفاهيم الملفات — بدون ملاحظات معلم في ورقة الطالب.\n\nهل تريد نسخة أصعب أو أبسط؟`
      : `${lead}\n\n**In-class worksheet**\nA) Easy warm-up · B) Medium practice · C) Stretch item.\nAll grounded in the uploaded concepts — student sheet only.\n\nWant a harder or simpler version?`,
    homework: isAr
      ? `${lead}\n\n**واجب منزلي مستقل** (~25 دقيقة)\n1) تدريب مستقل · 2) سؤال تحدٍّ · 3) تأمل قصير.\nمصمم للإنجاز في المنزل اعتمادًا على ${files}.`
      : `${lead}\n\n**Independent homework** (~25 min)\n1) Independent practice · 2) Challenge · 3) Short reflection.\nDesigned for home completion using ${files}.`,
    quiz: isAr
      ? `${lead}\n\n**اختبار قصير**\n• اختيار من متعدد · صح/خطأ · سؤال قصير.\nمبني على الأهداف والمفاهيم المستخرجة من الملفات.\nهل أضيف أسئلة بلوم أعلى؟`
      : `${lead}\n\n**Short quiz**\n• Multiple choice · True/False · Short answer.\nGrounded in objectives/concepts from the files.\nAdd higher Bloom items?`,
    activity: isAr
      ? `${lead}\n\n**نشاط صفي**\nعمل ثنائي 3–5 دقائق: يشرح كل طالب مفهومًا من الملف لزميله ثم يتبادلان.\nبديل: معرض سريع لأمثلة من المحتوى.`
      : `${lead}\n\n**Classroom activity**\n3–5 min pair share: each student explains one concept from the file, then swap.\nAlt: mini gallery of examples from the content.`,
    explain: isAr
      ? `${lead}\n\n**شرح مبسّط**\n${ask ? `طلبك: ${ask}\n\n` : ''}أشرح الفكرة الأساسية بلغة صفّية واضحة، مع مثال واحد وخطأ شائع للتجنّب — استنادًا إلى الملفات.\n\nهل تريد تبسيطًا إضافيًا للمتعثرين؟`
      : `${lead}\n\n**Clear explanation**\n${ask ? `Your ask: ${ask}\n\n` : ''}I’ll explain the core idea in plain classroom language, with one example and one misconception to avoid — grounded in the files.\n\nWant an even simpler version for struggling students?`,
    example: isAr
      ? `${lead}\n\n**مثال صفّي**\nمثال محلول مبني على محتوى الملفات، مع خطوات تفكير بصوت عالٍ.\nاطلب مثالًا من الحياة أو مثالًا أصعب.`
      : `${lead}\n\n**Classroom example**\nA worked example grounded in the files, with think-aloud steps.\nAsk for a real-life or harder example.`,
    short: isAr
      ? `${lead}\nنعم — الملفات جاهزة كسياق. اطلب تلخيصًا، خطة درس، ورقة عمل، أو تبسيطًا.`
      : `${lead}\nYes — files are ready as context. Ask for a summary, lesson plan, worksheet, or simplification.`,
    follow_up: isAr
      ? `${lead}\nنكمل على نفس المواد: أستطيع تعديل الصعوبة، أو الترجمة، أو إضافة أمثلة، أو تجهيز مادة جديدة دون إعادة الرفع.\n\nطلبك: ${ask}`
      : `${lead}\nContinuing on the same materials: I can adjust difficulty, translate, add examples, or generate another tool — no re-upload.\n\nYour ask: ${ask}`,
    general: isAr
      ? `${lead}\n\nفهمت طلبك: «${ask}».\n\nمن الملفات استخرجت أهدافًا ومفاهيم وأمثلة جاهزة للتحضير.\nأقترح التالي:\n• تلخيص سريع\n• خطة درس\n• ورقة عمل / واجب / اختبار\n• تبسيط الشرح\n\n(مقتطف السياق)\n${documentContext.slice(0, 900)}`
      : `${lead}\n\nGot it: “${ask}”.\n\nFrom the files I extracted objectives, concepts, and classroom-ready examples.\nSuggested next:\n• Quick summary\n• Lesson plan\n• Worksheet / homework / quiz\n• Simplify explanation\n\n(Context excerpt)\n${documentContext.slice(0, 900)}`,
  };

  return bodyByIntent[intent] || bodyByIntent.general;
}

export function buildTeachingAssistantReply(
  input: TeachingAssistantInput,
): TeachingAssistantResult {
  const {
    query,
    lessons,
    lang,
    mode,
    teachingContext,
    memory = emptyChatSessionMemory(),
    routeIntent,
    documentContext,
    documentNames = [],
  } = input;
  const isAr = lang === 'ar';
  let intent = detectIntent(query);

  // Refinement from Intent Router — stay on the active lesson; don't restart from scratch
  if (routeIntent === 'refinement') {
    if (/مثال|example/i.test(query)) intent = 'example';
    else if (/ضعف|struggl|أبسط|ابسط|simpl/i.test(query)) intent = 'explain';
    else if (/متفوق|advanced/i.test(query)) intent = 'explain';
    else intent = memory.lastIntent && memory.lastIntent !== 'follow_up'
      ? memory.lastIntent
      : 'explain';
  }

  // Follow-ups inherit the prior teaching intent when the new ask is only "add activity"
  if (intent === 'follow_up') {
    if (/نشاط|activity|تعاوني|جماعي/i.test(query)) intent = 'activity';
    else if (/واجب|homework/i.test(query)) intent = 'homework';
    else if (/ورقة|worksheet/i.test(query)) intent = 'worksheet';
    else if (/اختبار|quiz/i.test(query)) intent = 'quiz';
    else if (/خطة|lesson\s*plan/i.test(query)) intent = 'lesson_plan';
    else if (memory.lastIntent && memory.lastIntent !== 'follow_up' && memory.lastIntent !== 'short') {
      // keep follow_up for generic "continue" but content uses activity-style if last was explain
      intent = memory.lastIntent === 'general' ? 'follow_up' : memory.lastIntent;
    }
  }

  const lesson = resolveActiveLesson(lessons, memory, query);
  const hasDocs = !!documentContext?.trim();

  // Soft-pinned curriculum lesson must not steal replies when the teacher uploaded files.
  // Prefer document grounding unless the teacher hard-pinned a lesson or KB hit is intentional.
  const softPinOnly = memory.lessonPin === 'soft' || memory.lessonPin === 'none';
  if (hasDocs && (!lesson || softPinOnly)) {
    const docIntent = intent === 'short' && /ملخص|summar/i.test(query) ? 'general' : intent;
    const docTopic = documentNames[0]?.replace(/\.[^.]+$/, '') ?? null;
    return {
      text: buildDocumentGroundedReply(
        query,
        documentContext!,
        documentNames,
        isAr,
        docIntent,
      ),
      actions: mode === 'teacher' ? prioritizeActions(
        docIntent === 'worksheet' ? 'worksheet'
          : docIntent === 'quiz' ? 'quiz'
          : docIntent === 'homework' ? 'homework'
          : docIntent === 'activity' ? 'activity'
          : docIntent === 'lesson_plan' ? 'lesson_plan'
          : 'general',
      ) : [],
      needsClarification: false,
      activeLesson: softPinOnly ? null : lesson,
      memoryPatch: {
        recentQueries: [...memory.recentQueries, query].slice(-8),
        lastIntent: docIntent,
        activeTopicAr: docTopic ?? memory.activeTopicAr,
        activeTopicEn: docTopic ?? memory.activeTopicEn,
        // Keep soft pin; don't hard-pin a curriculum lesson over uploads
        lessonPin: memory.lessonPin === 'hard' ? 'hard' : 'soft',
      },
    };
  }

  if (!lesson) {
    return {
      text: '',
      actions: [],
      needsClarification: false,
      activeLesson: null,
      memoryPatch: {
        recentQueries: [...memory.recentQueries, query].slice(-8),
      },
    };
  }

  const ctx = resolveCurriculumContext(lesson);

  if (mode === 'teacher' && shouldAskPedagogicalClarify(query, intent, lesson.id, memory)) {
    const clarify = buildClarification(query, ctx, isAr);
    clarify.activeLesson = lesson;
    clarify.memoryPatch = {
      ...clarify.memoryPatch,
      recentQueries: [...memory.recentQueries, query].slice(-8),
      lastIntent: intent,
      clarifiedLessonIds: [...new Set([...memory.clarifiedLessonIds, lesson.id])],
    };
    return clarify;
  }

  if (intent === 'short') {
    const prepAfter = mode === 'teacher'
      ? markPrepStep(memory, lesson.id, 'explanation')
      : memory;
    return {
      text: shortReply(isAr, lesson, ctx),
      actions: mode === 'teacher' ? prioritizeActions('general') : [],
      needsClarification: false,
      activeLesson: lesson,
      memoryPatch: {
        activeLessonId: lesson.id,
        activeTopicAr: lesson.titleAr,
        activeTopicEn: lesson.titleEn,
        lessonPin: 'hard',
        recentQueries: [...memory.recentQueries, query].slice(-8),
        lastIntent: intent,
        prepLessonId: prepAfter.prepLessonId,
        prepCompleted: prepAfter.prepCompleted,
        lastCompletedPrepStep: prepAfter.lastCompletedPrepStep,
      },
    };
  }

  const title = isAr ? lesson.titleAr : lesson.titleEn;
  const summary = isAr ? lesson.summaryAr : lesson.summaryEn;
  const concepts = (isAr ? lesson.keyConceptsAr : lesson.keyConceptsEn)?.slice(0, 3) ?? [];
  const rules = ((isAr ? lesson.rulesAr : lesson.rulesEn) ?? []).slice(0, 2);
  const examples = ((isAr ? lesson.examplesAr : lesson.examplesEn) ?? []).slice(0, 2);
  const artifact = intentToArtifact(intent);
  const seed = `${query}|${lesson.id}|${memory.recentQueries.length}`;

  const parts: string[] = [];

  // 1) Natural acknowledgement (varied)
  parts.push(pickAck(isAr, intent, seed));
  parts.push('');

  // 1b) Uploaded materials — hard-pinned lesson path still must acknowledge docs
  if (hasDocs) {
    const files = documentNames.length
      ? documentNames.map(n => `«${n}»`).join(isAr ? ' و' : ' & ')
      : (isAr ? 'ملفاتك المرفوعة' : 'your uploaded files');
    parts.push(
      isAr
        ? `سأدمج ${files} مع درس المنهاج «${title}».`
        : `I’ll merge ${files} with curriculum lesson “${title}”.`,
    );
    parts.push('');
  }

  // 2) Curriculum context — never isolated
  parts.push(contextLine(ctx, isAr));

  const mem = memoryHint(isAr, memory, intent);
  if (mem) {
    parts.push(mem);
  } else if (teachingContext && teachingContext.trim() && teachingContext.trim() !== title) {
    parts.push(
      isAr
        ? `وسأراعي تركيزك الحالي: «${teachingContext.trim()}».`
        : `I’ll also respect your pinned teaching focus: “${teachingContext.trim()}”.`,
    );
  }

  // Pedagogical angle if clarified via chip text in query
  if (/لأول\s*مرة|first_time|first-time|First-time/i.test(query)) {
    parts.push(
      isAr
        ? 'سأعامل هذا كشرح تأسيسي لأول مرة: أمثلة بسيطة ثم القاعدة.'
        : 'Treating this as a first-time introduction: simple examples, then the rule.',
    );
  } else if (/مراجعة|قبل\s*الاختبار|review/i.test(query)) {
    parts.push(
      isAr
        ? 'سأعامل هذا كمراجعة قبل الاختبار: تركيز على الأخطاء الشائعة وتمارين سريعة.'
        : 'Treating this as pre-test review: common mistakes and quick practice.',
    );
  }

  parts.push('');

  // 3) Direct answer grounded in KB (+ doc excerpt when present)
  if (intent === 'activity' || (intent === 'follow_up' && artifact === 'activity')) {
    parts.push(
      isAr
        ? `أقترح أن تبدأ بنشاط جماعي قصير يطبّق فكرة «${title}» مباشرة داخل الصف.`
        : `I suggest starting with a short group activity that applies “${title}” right away.`,
    );
  } else {
    parts.push(isAr ? summary : summary);
  }

  if (hasDocs && intent === 'lesson_plan') {
    const excerpt = documentContext!.trim().slice(0, 700);
    parts.push('');
    parts.push(
      isAr
        ? `من الملفات المرفوعة (مقتطف للتحضير):\n${excerpt}`
        : `From uploaded files (prep excerpt):\n${excerpt}`,
    );
  }

  // 4) Educational context (concise)
  if (intent === 'explain') {
    parts.push('');
    parts.push(
      isAr
        ? 'ابدأ بموقف قريب من الطالب، ثم انتقل إلى الصيغة، ثم مثال محلول على السبورة.'
        : 'Start with a familiar situation, then the formal rule, then one board example.',
    );
  }

  if (rules.length > 0 && intent !== 'activity') {
    parts.push('');
    parts.push(isAr ? 'ثبّت هذه النقاط:' : 'Anchor these points:');
    rules.forEach(r => parts.push(`• ${r}`));
  }

  if (examples.length > 0) {
    parts.push('');
    parts.push(isAr ? `مثال جاهز للسبورة:\n• ${examples[0]}` : `Board-ready example:\n• ${examples[0]}`);
  } else if (concepts[0] && intent === 'explain') {
    parts.push('');
    parts.push(
      isAr
        ? `مفهوم محوري للصياغة الصفية: ${concepts[0]}`
        : `Core idea for class language: ${concepts[0]}`,
    );
  }

  // 4b) Library support pack (worksheets / quizzes linked to this unit)
  if (mode === 'teacher') {
    const pack = searchSupportResources({
      query,
      lesson,
      limit: 3,
      types:
        intent === 'worksheet' ? ['worksheet']
          : intent === 'quiz' ? ['quiz', 'answer_key']
            : intent === 'lesson_plan' ? ['summary', 'worksheet', 'quiz']
              : undefined,
    });
    const packBlock = formatSupportResourcesBlock(pack, isAr ? 'ar' : 'en');
    if (packBlock) {
      parts.push('');
      parts.push(packBlock);
    }
  }

  // 5) Actionable next steps
  parts.push('');
  if (mode === 'teacher') {
    parts.push(nextStepsBlock(isAr, intent));
    parts.push('');
    parts.push(actionMenu(isAr, artifact ?? undefined));
  } else {
    parts.push(
      isAr
        ? 'للتثبيت: أعد صياغة الفكرة ثم حل مثالاً مشابهاً دون النظر إلى الحل.'
        : 'To lock it in: restate the idea, then try a similar example without looking.',
    );
  }

  // 6) One follow-up question
  parts.push('');
  parts.push(
    mode === 'teacher'
      ? pickFollowUp(isAr, intent, title, memory)
      : isAr
        ? `هل تريد مثالاً محلولاً خطوة بخطوة عن «${title}»؟`
        : `Want a step-by-step worked example on “${title}”?`,
  );

  const discussed = artifact
    ? [...memory.discussedArtifacts.filter(a => a !== artifact), artifact].slice(-6)
    : memory.discussedArtifacts;

  // Meaningful teaching turn → mark "شرح الفكرة" for guided preparation (Demo Mode).
  // Artifact boxes are completed when the teacher generates them via action chips.
  const prepAfter = mode === 'teacher'
    ? markPrepStep(memory, lesson.id, 'explanation')
    : memory;

  return {
    text: parts.join('\n').trim(),
    actions: mode === 'teacher' ? prioritizeActions(intent) : [],
    needsClarification: false,
    activeLesson: lesson,
    memoryPatch: {
      activeLessonId: lesson.id,
      activeTopicAr: lesson.titleAr,
      activeTopicEn: lesson.titleEn,
      lessonPin: 'hard',
      recentQueries: [...memory.recentQueries, query].slice(-8),
      discussedArtifacts: discussed,
      lastIntent: intent,
      clarifiedLessonIds: memory.clarifiedLessonIds,
      prepLessonId: prepAfter.prepLessonId,
      prepCompleted: prepAfter.prepCompleted,
      lastCompletedPrepStep: prepAfter.lastCompletedPrepStep,
    },
  };
}

/** Convenience wrapper for call sites that only need the text string. */
export function buildTeachingAssistantReplyText(input: TeachingAssistantInput): string {
  return buildTeachingAssistantReply(input).text;
}
