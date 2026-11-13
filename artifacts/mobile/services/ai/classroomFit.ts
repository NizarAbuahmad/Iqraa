/**
 * The offline escape challenge and error detective.
 *
 * Both types were one hand-written set of quadratic equations, served whatever
 * the lesson (all 397 Grade 7 lessons, by the 2026-11-13 audit): an English
 * vocabulary lesson was asked to «solve Vocabulary equations». Each is now built
 * from the lesson's own bank when it has one (a quadratics lesson gets its own
 * quadratics that way), or from its own outcomes and concepts when it does not —
 * never from a template's maths.
 */
import type { ActivitySlide, ClassroomActivity, ClassroomActivityRequest } from './AIService.ts';
import type { KBLesson } from '../knowledgeBase.ts';

export interface FitContext {
  req: ClassroomActivityRequest;
  /** The lesson's title, or a revision's phrase. */
  topic: string;
  isAr: boolean;
  /** A maths lesson: the detective keeps the card's name, «المحقق الرياضي». */
  math: boolean;
  dur: number;
  slideDuration: number;
}

/** A banked item: the stem and its key. */
export interface FitItem { text: string; answer: string }
/** A banked multiple-choice item with one of its deliberate wrong options. */
export interface FitMistake extends FitItem { wrong: string }

/** The escape room's five secret digits, in order. */
const CODES = ['8', '4', '7', '3', '6'];

const ARABIC_LETTER = /[ء-ي]/;

/**
 * What a bankless activity asks about. Arabic: the lesson's outcomes, or its
 * concepts when the book lists none. English: its English concepts, leaving out
 * any that are Arabic glosses — an English paper never prints the Arabic
 * outcomes. Nothing at all: the topic itself.
 */
export function activityPoints(kb: KBLesson | null, topic: string, isAr: boolean): string[] {
  const list = isAr
    ? (kb?.objectives?.length ? kb.objectives : kb?.keyConceptsAr ?? [])
    : (kb?.keyConceptsEn ?? []).filter(c => !ARABIC_LETTER.test(c));
  const clean = list.map(s => s.trim()).filter(Boolean);
  return clean.length ? clean : [topic];
}

function shell(ctx: FitContext, fields: Omit<ClassroomActivity, 'grade' | 'subject' | 'lesson' | 'duration' | 'difficulty' | 'groupType'>): ClassroomActivity {
  const { req, topic, dur } = ctx;
  return {
    ...fields,
    grade: req.grade, subject: req.subject, lesson: topic, duration: dur,
    difficulty: req.difficulty, groupType: req.groupType,
  };
}

const number = (slides: Omit<ActivitySlide, 'slideNumber'>[]): ActivitySlide[] =>
  slides.map((s, i) => ({ ...s, slideNumber: i + 1 }) as ActivitySlide);

// ── Escape challenge ─────────────────────────────────────────────────────────

interface EscapeStage {
  content: string;
  hint: string;
  answer: string;
  teacher: NonNullable<ActivitySlide['teacher']>;
}

function escapeActivity(ctx: FitContext, stages: EscapeStage[], o: {
  objective: string; key: string[]; practised: string; extension: string;
}): ClassroomActivity {
  const { isAr, dur, slideDuration } = ctx;
  const n = stages.length;
  const codes = CODES.slice(0, n);
  const challengeTitle = (i: number) => isAr
    ? (i === n - 1 ? `التحدي الأخير ${i + 1} من ${n}` : `التحدي ${i + 1} من ${n}`)
    : (i === n - 1 ? `Final Challenge ${i + 1} of ${n}` : `Challenge ${i + 1} of ${n}`);
  const revealText = (i: number) => isAr
    ? `أحسنتم! الرقم السري ${i + 1}: ${codes[i]}\nسجّلوه في ورقتكم.`
    : `Well done! Secret digit ${i + 1}: ${codes[i]}\nWrite it down on your sheet.`;
  return shell(ctx, {
    activityName: isAr ? `تحدي الهروب – ${ctx.topic}` : `Escape Challenge – ${ctx.topic}`,
    activityType: 'escape-challenge',
    learningObjective: o.objective,
    materials: isAr
      ? ['السبورة', 'أوراق التحديات المطبوعة', 'مؤقت', 'أقلام ملونة']
      : ['Whiteboard', 'Printed challenge cards', 'Timer', 'Coloured markers'],
    teacherPreparation: isAr
      ? `اطبع بطاقات التحديات (${n}) مسبقًا. رتّب الطلبة في مجموعات من 3-4 أفراد. اكشف الرقم السري لكل مجموعة حين تقبل إجابتها.`
      : `Print the ${n} challenge cards in advance. Arrange students into groups of 3-4. Reveal each group's secret digit when you accept its answer.`,
    teacherNotes: isAr
      ? ['راقب المجموعات وقدّم تلميحات إضافية عند الحاجة', 'شجّع الطلبة على مناقشة إجاباتهم المختلفة']
      : ['Monitor groups and provide extra hints if needed', 'Encourage groups to compare their different answers'],
    answerKey: o.key,
    printables: isAr ? ['بطاقات التحديات', 'مفتاح الإجابات', 'شهادات الإنجاز'] : ['Challenge cards', 'Answer key', 'Completion certificates'],
    assessment: isAr
      ? 'راقب دقة الإجابات وسرعة الإنجاز. ناقش الأخطاء الشائعة مع الصف في الختام.'
      : 'Monitor accuracy and speed. Discuss common mistakes with the class at the end.',
    extensionChallenge: o.extension,
    slides: number([
      {
        type: 'intro',
        title: isAr ? '🔐 مهمتكم' : '🔐 Your Mission',
        content: isAr
          ? `فريقكم محاصر في غرفة التحديات!\nعليكم حل ${n} تحديات للهروب في غضون ${dur} دقيقة.\nكل تحدٍّ صحيح يمنحكم رقمًا سريًا.`
          : `Your team is locked in the Challenge Room!\nComplete ${n} challenges to escape within ${dur} minutes.\nEach correct answer unlocks a secret digit.`,
        durationSeconds: 0,
      },
      {
        type: 'intro',
        title: isAr ? '🧭 كيف نلعب؟' : '🧭 How to Play',
        content: isAr
          ? `• تعملون في مجموعات، ولكل مجموعة ورقة واحدة تسجّلون فيها الأرقام.\n• أمامكم ${n} تحديات، لكل تحدٍّ وقت محدّد يظهر على الشاشة.\n• كل تحدٍّ تحلّونه حلًّا صحيحًا يكشف رقمًا سريًا واحدًا — اكتبوه فورًا بالترتيب.\n• لا تُدخلون الأرقام في أي مكان: الكود يُجمع على ورقتكم أنتم.\n• في النهاية تقرؤون الأرقام بالترتيب نفسه، فيكتمل كود الهروب.`
          : `• Work in groups. One sheet per group — that is where the digits go.\n• There are ${n} challenges, each with its own timer on screen.\n• Answer a challenge correctly and one secret digit is revealed — write it down straight away, in order.\n• There is nothing to type the digits into: the code is collected on your own sheet.\n• At the end, read your digits back in the same order to complete the escape code.`,
        durationSeconds: 0,
      },
      ...stages.flatMap((s, i): Omit<ActivitySlide, 'slideNumber'>[] => [
        {
          type: 'challenge', title: challengeTitle(i), content: s.content, hint: s.hint, answer: s.answer,
          unlockCode: codes[i], durationSeconds: slideDuration, teacher: s.teacher,
        },
        {
          type: 'reveal',
          title: isAr ? `🔓 الرقم ${codes[i]} مفتوح!` : `🔓 Digit ${codes[i]} Unlocked!`,
          content: revealText(i), unlockCode: codes[i], durationSeconds: 0,
        },
      ]),
      {
        type: 'summary',
        title: isAr ? '🎉 لقد هربتم!' : '🎉 You Escaped!',
        content: isAr
          ? `أحسنتم! فريقكم نجح في الهروب!\nالكود الكامل: ${codes.join(' – ')}\n\n${o.practised}`
          : `Outstanding! Your team escaped!\nFull code: ${codes.join(' – ')}\n\n${o.practised}`,
        durationSeconds: 0,
      },
    ]),
  });
}

/** An escape challenge whose stages are the lesson's own banked problems. */
export function escapeFromItems(ctx: FitContext, items: FitItem[]): ClassroomActivity {
  const { isAr, topic } = ctx;
  const stages = items.slice(0, CODES.length).map((item): EscapeStage => ({
    content: item.text,
    hint: isAr ? 'اكتبوا خطواتكم قبل أن تطلبوا الرقم السري' : 'Write your steps before asking for the secret digit',
    answer: item.answer,
    teacher: {
      expectedAnswer: item.answer,
      teachingTips: isAr ? 'اقبل الإجابة حين تكون الخطوات صحيحة، ثم اكشف الرقم' : 'Accept the answer when the steps are right, then reveal the digit',
      suggestedQuestions: isAr ? ['ما خطوتكم الأولى؟', 'كيف تتحققون من الإجابة؟'] : ['What is your first step?', 'How can you check your answer?'],
    },
  }));
  return escapeActivity(ctx, stages, {
    objective: isAr ? `حل مسائل محددة في ${topic} ضمن فريق` : `Solve specific ${topic} problems as a team`,
    key: stages.map((s, i) => isAr ? `التحدي ${i + 1}: ${s.answer}` : `Challenge ${i + 1}: ${s.answer}`),
    practised: isAr ? `حللتم اليوم ${stages.length} مسائل في ${topic}.` : `Today you solved ${stages.length} ${topic} problems.`,
    extension: isAr ? `اطلب من كل فريق صياغة مسألة جديدة في ${topic} لفريق آخر.` : `Ask each team to write a new ${topic} problem for another team.`,
  });
}

/**
 * An escape challenge with no bank: five tasks on the lesson's own outcomes or
 * concepts, each a different kind of thinking. The teacher accepts an answer;
 * nothing pretends to a single right one.
 */
export function escapeFromPoints(ctx: FitContext, points: string[]): ClassroomActivity {
  const { isAr, topic } = ctx;
  const flexible = isAr ? 'إجابة مرنة: اقبلها إن كانت صحيحة ودقيقة' : 'Flexible answer: accept it if it is accurate and clear';
  const tasks: Array<(p: string) => Omit<EscapeStage, 'answer' | 'teacher'> & { tip: string }> = isAr
    ? [
        p => ({ content: `اشرحوا بكلماتكم:\n${p}`, hint: 'ابدؤوا بمثال ثم صوغوا الفكرة', tip: 'اطلب شرحًا بكلمات المجموعة لا نسخًا من الكتاب' }),
        p => ({ content: `أعطوا مثالًا واحدًا يوضّح:\n${p}`, hint: 'فكّروا في مثال من الكتاب المدرسي أو من حياتكم', tip: 'المثال الصحيح الواحد يكفي لفتح الرقم' }),
        p => ({ content: `اكتبوا سؤالًا عن الفكرة الآتية، ثم أجيبوا عنه:\n${p}`, hint: 'سؤال يبدأ بـ«لماذا» أو «كيف» أقوى من سؤال يبدأ بـ«ما»', tip: 'تأكد أن السؤال والإجابة كليهما صحيحان' }),
        p => ({ content: `لخّصوا الفكرة الآتية في جملة واحدة:\n${p}`, hint: 'اختاروا أهم كلمة في الفكرة وابنوا الجملة حولها', tip: 'اطلب من المجموعة قراءة جملتها بصوت مسموع' }),
        p => ({ content: `التحدي الأخير!\nاربطوا الفكرة الآتية بموقف من الحياة اليومية:\n${p}`, hint: 'أين يمكن أن تصادفوا هذه الفكرة خارج المدرسة؟', tip: 'اقبل كل موقف منطقي، واطلب تبريره' }),
      ]
    : [
        p => ({ content: `Explain in your own words:\n${p}`, hint: 'Start with an example, then state the idea', tip: 'Ask for the group\'s own words, not a copy from the textbook' }),
        p => ({ content: `Give one example that shows:\n${p}`, hint: 'Think of an example from the textbook or from your own life', tip: 'One correct example is enough to unlock the digit' }),
        p => ({ content: `Write a question about this idea, then answer it:\n${p}`, hint: 'A "why" or "how" question is stronger than a "what" question', tip: 'Check that both the question and the answer are correct' }),
        p => ({ content: `Sum up this idea in one sentence:\n${p}`, hint: 'Pick the most important word and build the sentence around it', tip: 'Have the group read its sentence aloud' }),
        p => ({ content: `FINAL CHALLENGE!\nLink this idea to a situation from everyday life:\n${p}`, hint: 'Where might you meet this idea outside school?', tip: 'Accept any sensible situation, and ask for the reason' }),
      ];
  const picked = tasks.map((task, i) => ({ p: points[i % points.length]!, ...task(points[i % points.length]!) }));
  const stages = picked.map(({ p, content, hint, tip }): EscapeStage => ({
    content, hint, answer: flexible,
    teacher: { expectedAnswer: p, teachingTips: tip },
  }));
  return escapeActivity(ctx, stages, {
    objective: isAr ? `مراجعة أفكار ${topic} الأساسية وتطبيقها ضمن فريق` : `Review and apply the key ideas of ${topic} as a team`,
    key: picked.map(({ p }, i) => isAr ? `التحدي ${i + 1}: ${p}` : `Challenge ${i + 1}: ${p}`),
    practised: isAr ? `راجعتم اليوم أفكار ${topic} الأساسية.` : `Today you reviewed the key ideas of ${topic}.`,
    extension: isAr ? `اطلب من كل فريق تصميم تحدٍّ سادس عن ${topic} لفريق آخر.` : `Ask each team to design a sixth ${topic} challenge for another team.`,
  });
}

// ── Error detective ──────────────────────────────────────────────────────────

interface DetectiveCase {
  content: string;
  hint: string;
  answer: string;
  reveal: string;
  teacher: NonNullable<ActivitySlide['teacher']>;
}

function detectiveActivity(ctx: FitContext, cases: DetectiveCase[], o: {
  objective: string; key: string[]; intro: string; summary: string; preparation: string; extension: string;
  materials: string[]; printables: string[];
}): ClassroomActivity {
  const { isAr, slideDuration } = ctx;
  const name = isAr ? (ctx.math ? 'المحقق الرياضي' : 'محقق الأخطاء') : 'Error Detective';
  return shell(ctx, {
    activityName: `${name} – ${ctx.topic}`,
    activityType: 'error-detective',
    learningObjective: o.objective,
    materials: o.materials,
    teacherPreparation: o.preparation,
    teacherNotes: isAr
      ? ['ناقش سبب الخطأ وليس فقط الإجابة الصحيحة', 'استخدم أخطاء حقيقية من اختبارات سابقة']
      : ['Discuss WHY the error occurred, not just what the correct answer is', 'Use real errors from previous tests when possible'],
    answerKey: o.key,
    printables: o.printables,
    assessment: isAr
      ? 'قيّم قدرة الطلبة على تحديد الخطأ وشرح سببه وتقديم التصحيح.'
      : 'Assess whether students can identify the error, explain its cause, and give the correction.',
    extensionChallenge: o.extension,
    slides: number([
      { type: 'intro', title: `🔍 ${name}`, content: o.intro, durationSeconds: 0 },
      ...cases.flatMap((c, i): Omit<ActivitySlide, 'slideNumber'>[] => [
        {
          type: 'challenge',
          title: isAr ? `🕵️ الحالة ${i + 1} – أوجد الخطأ` : `🕵️ Case ${i + 1} – Find the Error`,
          content: c.content, hint: c.hint, answer: c.answer, durationSeconds: slideDuration, teacher: c.teacher,
        },
        { type: 'reveal', title: isAr ? '✅ نراجع معًا' : '✅ Let\'s Check', content: c.reveal, durationSeconds: 0 },
      ]),
      { type: 'summary', title: isAr ? '🏆 التحقيق اكتمل!' : '🏆 Investigation Complete!', content: o.summary, durationSeconds: 0 },
    ]),
  });
}

/** Three cases, each a banked question answered with one of its deliberate wrong options. */
export function detectiveFromMistakes(ctx: FitContext, mistakes: FitMistake[]): ClassroomActivity {
  const { isAr, topic } = ctx;
  const cases = mistakes.slice(0, 3).map((m): DetectiveCase => ({
    content: isAr
      ? `طالب أجاب عن هذا السؤال:\n\n${m.text}\n\nإجابته: ${m.wrong}\n\n❓ أين الخطأ؟ وما الإجابة الصحيحة؟`
      : `A student answered this question:\n\n${m.text}\n\nTheir answer: ${m.wrong}\n\n❓ Where is the error, and what is the correct answer?`,
    hint: isAr ? 'حلّوا السؤال بأنفسكم أولًا، ثم قارنوا' : 'Solve it yourselves first, then compare',
    answer: isAr ? `الإجابة الصحيحة: ${m.answer}` : `Correct answer: ${m.answer}`,
    reveal: isAr
      ? `الإجابة الصحيحة:\n${m.answer}\n\nإجابة الطالب «${m.wrong}» خطأ شائع — ناقشوا من أين جاء.\n\n🏅 نقطة لمن اكتشف الخطأ!`
      : `Correct answer:\n${m.answer}\n\nThe student's “${m.wrong}” is a common error — discuss where it comes from.\n\n🏅 A point to whoever caught it!`,
    teacher: {
      expectedAnswer: m.answer,
      commonMisconceptions: isAr ? `«${m.wrong}» — خطأ شائع مقصود` : `“${m.wrong}” — a deliberate common error`,
      teachingTips: isAr ? 'اطلب من الثنائي تسمية الخطوة التي أخطأ فيها الطالب' : 'Ask the pair to name the step where the student went wrong',
    },
  }));
  return detectiveActivity(ctx, cases, {
    objective: isAr ? `تحديد الأخطاء الشائعة في مسائل ${topic} وتصحيحها بمنهجية` : `Identify and correct common mistakes in ${topic} problems`,
    key: cases.map((c, i) => isAr ? `الحالة ${i + 1}: ${mistakes[i]!.answer}` : `Case ${i + 1}: ${mistakes[i]!.answer}`),
    intro: isAr
      ? 'مهمتكم: اكشفوا الخطأ في كل إجابة!\nكل إجابة تحتوي على خطأ.\nحدّدوا الخطأ، اشرحوا سببه، وقدّموا الإجابة الصحيحة.\n\nعمل ثنائي – دقيقتان لكل بطاقة'
      : 'Your mission: spot the mistake in each answer!\nEvery answer contains an error.\nIdentify it, explain why it is wrong, and give the correct answer.\n\nWork in pairs — 2 minutes per card',
    summary: isAr
      ? `أحسنتم يا محققون!\n\nكشفنا اليوم ${cases.length} أخطاء شائعة في ${topic}.\n\nناقشوا: أي خطأ كان الأصعب اكتشافًا؟`
      : `Outstanding detectives!\n\nToday we uncovered ${cases.length} common ${topic} errors.\n\nDiscuss: which error was hardest to spot?`,
    preparation: isAr ? 'اطبع بطاقات الحالات مسبقًا. اطلب من الطلبة العمل في ثنائيات.' : 'Print the case cards in advance. Students work in pairs.',
    materials: isAr ? ['السبورة', 'بطاقات الحالات المطبوعة', 'أقلام تصحيح حمراء'] : ['Whiteboard', 'Printed case cards', 'Red correction pens'],
    printables: isAr ? ['بطاقات الحالات', 'نموذج التقرير التحقيقي'] : ['Case cards (one set per pair)', 'Investigation report template'],
    extension: isAr ? `اطلب من الطلبة تصميم إجابة خاطئة متعمدة في ${topic} وتبادلها مع مجموعة أخرى.` : `Ask students to write a deliberately wrong ${topic} answer and swap with another pair.`,
  });
}

/**
 * Three cases with no bank: each student answers a point of the lesson, and
 * the partner hunts for what is wrong or missing in it. The errors are the
 * class's own — nothing is invented for a subject the template does not know.
 */
export function detectiveFromPoints(ctx: FitContext, points: string[]): ClassroomActivity {
  const { isAr, topic } = ctx;
  const picked = [0, 1, 2].map(i => points[i % points.length]!);
  const cases = picked.map((p): DetectiveCase => ({
    content: isAr
      ? `الخطوة 1: يكتب كل طالب إجابة قصيرة عن:\n${p}\n\nالخطوة 2: بادل ورقتك مع زميلك، وابحث في إجابته عن خطأ أو نقص.\n\n❓ ما الذي يحتاج إلى تصحيح في إجابة زميلك؟`
      : `Step 1: Each student writes a short answer about:\n${p}\n\nStep 2: Swap papers with your partner and look for an error or a gap in their answer.\n\n❓ What needs correcting in your partner's answer?`,
    hint: isAr ? 'قارن إجابة زميلك بما في الكتاب المدرسي' : 'Compare your partner\'s answer with the textbook',
    answer: isAr ? 'تُقبل كل ملاحظة دقيقة مع تصحيحها' : 'Accept any accurate correction',
    reveal: isAr
      ? `يقرأ ثنائيان ما وجداه من أخطاء وكيف صحّحاها.\n\nالهدف الذي نتحقق منه:\n${p}\n\n🏅 نقطة لكل خطأ اكتُشف وصُحّح بدقة!`
      : `Two pairs read out the errors they found and how they fixed them.\n\nThe goal we are checking:\n${p}\n\n🏅 A point for every error found and fixed accurately!`,
    teacher: {
      expectedAnswer: p,
      commonMisconceptions: isAr ? 'الخلط بين مفهومين متقاربين، أو إجابة صحيحة لكنها ناقصة' : 'Mixing up two close ideas, or an answer that is right but incomplete',
      teachingTips: isAr ? 'تجوّل بين الثنائيات واختر خطأين مختلفين للنقاش أمام الصف' : 'Walk between pairs and pick two different errors to discuss with the class',
    },
  }));
  return detectiveActivity(ctx, cases, {
    objective: isAr ? `اكتشاف الأخطاء في إجابات عن ${topic} وتصحيحها بمنهجية` : `Spot and correct errors in answers about ${topic}`,
    key: picked.map((p, i) => isAr ? `الحالة ${i + 1}: ${p}` : `Case ${i + 1}: ${p}`),
    intro: isAr
      ? 'مهمتكم: كونوا محققين في إجابات زملائكم!\nفي كل حالة: اكتب إجابتك، ثم بادلها مع زميلك.\nابحث عن الخطأ، اشرح سببه، وقدّم التصحيح.\n\nعمل ثنائي – دقيقتان لكل حالة'
      : 'Your mission: be detectives in each other\'s answers!\nIn each case: write your answer, then swap with your partner.\nFind the error, explain it, and give the correction.\n\nWork in pairs — 2 minutes per case',
    summary: isAr
      ? `أحسنتم يا محققون!\n\nراجعنا اليوم ${topic} بالبحث عن الأخطاء وتصحيحها.\n\nناقشوا: أي خطأ كان الأصعب اكتشافًا؟`
      : `Outstanding detectives!\n\nToday we reviewed ${topic} by finding and fixing errors.\n\nDiscuss: which error was hardest to spot?`,
    preparation: isAr ? 'لا تحتاج طباعة: يكفي ورق وأقلام. اطلب من الطلبة العمل في ثنائيات.' : 'Nothing to print: paper and pens are enough. Students work in pairs.',
    materials: isAr ? ['السبورة', 'ورق وأقلام', 'أقلام تصحيح حمراء'] : ['Whiteboard', 'Paper and pens', 'Red correction pens'],
    printables: [],
    extension: isAr ? `اطلب من الطلبة كتابة إجابة خاطئة متعمدة عن ${topic} وتبادلها مع مجموعة أخرى.` : `Ask students to write a deliberately wrong answer about ${topic} and swap with another pair.`,
  });
}
