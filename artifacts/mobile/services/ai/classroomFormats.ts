/**
 * The offline classroom formats that are built from a list of challenges
 * rather than written out by hand.
 *
 * Before this, escape / error-detective / gallery-walk / exit-ticket were fixed
 * templates and the templates were maths — a quadratics escape room set in
 * «the Math Lab» for any topic. These builders take their content as input, so
 * the same structure serves a banked maths item and a teacher-checked task
 * about a history lesson alike. WHICH content a lesson gets is decided by the
 * caller (`generateClassroomActivity`); nothing here knows a subject.
 *
 * RN-free on purpose (explicit `.ts` imports): `node --test` loads it.
 */
import type { ActivitySlide, ClassroomActivity, ClassroomActivityRequest } from './AIService.ts';
import type { LessonTask } from './classroomTasks.ts';

export interface FormatCtx {
  req: ClassroomActivityRequest;
  topic: string;
  isAr: boolean;
  dur: number;
  /** Seconds per timed slide. */
  slideDuration: number;
  /** 0 on a first generation, +1 per Regenerate. */
  variant: number;
}

/** One challenge: a prompt and what the answer is, and who vouches for it. */
export interface Challenge {
  prompt: string;
  answer: string;
  hint: string;
  /** Shown to the teacher alongside the answer. */
  tip?: string;
  /** true — a banked item whose answer was computed or reviewed;
   *  false — a task the teacher checks against the textbook. */
  banked: boolean;
}

/** A banked question with a real wrong answer a student might give. */
export interface ErrorCase {
  question: string;
  wrong: string;
  right: string;
}

function base(ctx: FormatCtx, activityType: string): Omit<
  ClassroomActivity,
  'activityName' | 'learningObjective' | 'materials' | 'teacherPreparation' | 'teacherNotes'
  | 'answerKey' | 'printables' | 'assessment' | 'extensionChallenge' | 'slides'
> {
  const { req, topic, dur } = ctx;
  return {
    activityType,
    grade: req.grade,
    subject: req.subject,
    lesson: topic,
    duration: dur,
    difficulty: req.difficulty,
    groupType: req.groupType,
  };
}

const numbered = (slides: Omit<ActivitySlide, 'slideNumber'>[]): ActivitySlide[] =>
  slides.map((s, i) => ({ ...s, slideNumber: i + 1 }));

// ── Escape challenge ─────────────────────────────────────────────────────────

/** One digit per challenge; shifts with the variant so a Regenerate changes the code too. */
const codeFor = (i: number, variant: number) => String((variant * 3 + i * 7 + 2) % 10);

export function buildEscape(ctx: FormatCtx, challenges: Challenge[]): ClassroomActivity {
  const { isAr, topic, dur, slideDuration, variant } = ctx;
  const n = challenges.length;
  const checked = challenges.every(c => c.banked);
  const codes = challenges.map((_, i) => codeFor(i, variant));

  const slides: Omit<ActivitySlide, 'slideNumber'>[] = [
    {
      type: 'intro',
      title: isAr ? '🔐 مهمتكم' : '🔐 Your mission',
      content: isAr
        ? `فريقك محاصر في غرفة مغلقة!\nعليكم إنجاز ${n} تحديات حول «${topic}» للهروب في غضون ${dur} دقيقة.\nكل تحدٍّ ${checked ? 'تحلّونه حلًّا صحيحًا' : 'تُجيبون عنه ويصادق المعلم على إجابتكم'} يمنحكم كودًا سريًا.`
        : `Your team is locked in! Complete ${n} challenges on “${topic}” to escape within ${dur} minutes.\nEach challenge ${checked ? 'you solve correctly' : 'you answer and your teacher approves'} gives you a secret code.`,
      durationSeconds: 0,
    },
    {
      type: 'intro',
      title: isAr ? '🧭 كيف نلعب؟' : '🧭 How to play',
      content: isAr
        ? `• تعملون في مجموعات، ولكل مجموعة ورقة واحدة تسجّلون فيها الأرقام.\n• أمامكم ${n} تحديات، لكل تحدٍّ وقت محدّد يظهر على الشاشة.\n• ${checked ? 'كل تحدٍّ تحلّونه حلًّا صحيحًا' : 'كل تحدٍّ تُجيبون عنه ويوافق عليه المعلم'} يكشف رقمًا سريًا واحدًا — اكتبوه فورًا بالترتيب.\n• في النهاية تقرؤون الأرقام بالترتيب نفسه، فيكتمل كود الهروب.`
        : `• Work in groups, with one sheet per group to record the digits.\n• There are ${n} challenges, each with a timer on the screen.\n• Each challenge ${checked ? 'you solve correctly' : 'you answer and your teacher approves'} reveals one secret digit — write it down in order.\n• At the end, read the digits in order to complete the escape code.`,
      durationSeconds: 0,
    },
  ];

  challenges.forEach((c, i) => {
    const last = i === n - 1;
    slides.push({
      type: 'challenge',
      title: isAr
        ? (last ? `التحدي الأخير ${i + 1} من ${n}` : `التحدي ${i + 1} من ${n}`)
        : (last ? `Final challenge ${i + 1} of ${n}` : `Challenge ${i + 1} of ${n}`),
      content: c.banked
        ? (isAr ? `حلّ المسألة:\n${c.prompt}` : `Solve:\n${c.prompt}`)
        : (isAr
            ? `${c.prompt}\n\nاعرضوا إجابتكم على المعلم لتحصلوا على الكود.`
            : `${c.prompt}\n\nShow your answer to your teacher to get the code.`),
      hint: c.hint,
      answer: c.answer,
      unlockCode: codes[i],
      durationSeconds: slideDuration,
      teacher: {
        expectedAnswer: c.answer,
        ...(c.tip ? { teachingTips: c.tip } : {}),
      },
    });
    slides.push({
      type: 'reveal',
      title: isAr ? `🔓 الكود ${codes[i]} مفتوح!` : `🔓 Code ${codes[i]} unlocked!`,
      content: isAr
        ? `أحسنتم! حصلتم على الكود رقم ${i + 1}: ${codes[i]}\nسجّلوه في ورقتكم.`
        : `Well done! Code number ${i + 1}: ${codes[i]}\nWrite it on your sheet.`,
      unlockCode: codes[i],
      durationSeconds: 0,
    });
  });

  slides.push({
    type: 'summary',
    title: isAr ? '🎉 لقد هربتم!' : '🎉 You escaped!',
    content: isAr
      ? `أحسنتم! فريقكم نجح في الهروب!\nالكود الكامل: ${codes.join(' – ')}\n\nراجعنا اليوم ${n} أفكار من «${topic}».`
      : `Well done! Your team escaped!\nThe full code: ${codes.join(' – ')}\n\nToday we revisited ${n} ideas from “${topic}”.`,
    durationSeconds: 0,
  });

  return {
    ...base(ctx, 'escape-challenge'),
    activityName: isAr ? `تحدي الهروب – ${topic}` : `Escape Challenge – ${topic}`,
    learningObjective: isAr
      ? `مراجعة أفكار «${topic}» عبر سلسلة تحديات ضمن فريق`
      : `Revisit the ideas of “${topic}” through a chain of team challenges`,
    materials: isAr
      ? ['السبورة', 'أوراق التحديات المطبوعة', 'مؤقت', 'أقلام ملونة']
      : ['Whiteboard', 'Printed challenge cards', 'Timer', 'Coloured markers'],
    teacherPreparation: isAr
      ? `اطبع بطاقات التحديات الـ${n} مسبقًا. رتّب الطلبة في مجموعات من 3-4 أفراد. اكشف كل كود عند إنجاز تحدّيه.${checked ? '' : ' الإجابات هنا مهام يحكم عليها المعلم، فاحتفظ بكتاب الطالب بين يديك.'}`
      : `Print the ${n} challenge cards in advance. Arrange groups of 3-4. Reveal each code when its challenge is done.${checked ? '' : ' These are tasks you judge yourself — keep the textbook to hand.'}`,
    teacherNotes: isAr
      ? ['راقب المجموعات وقدّم تلميحات إضافية عند الحاجة', 'شجّع الطلبة على مناقشة أساليبهم المختلفة']
      : ['Monitor groups and give extra hints when needed', 'Encourage groups to discuss their different approaches'],
    answerKey: challenges.map((c, i) => (isAr ? `التحدي ${i + 1}: ${c.answer}` : `Challenge ${i + 1}: ${c.answer}`)),
    printables: isAr ? ['بطاقات التحديات', 'مفتاح الإجابات'] : ['Challenge cards', 'Answer key'],
    assessment: isAr
      ? 'راقب دقة الإجابات وسرعة الإنجاز، وناقش الأخطاء الشائعة مع الصف في الختام.'
      : 'Watch accuracy and speed, and discuss the common mistakes with the class at the end.',
    extensionChallenge: isAr
      ? `اطلب من كل مجموعة تأليف تحدٍّ جديد عن «${topic}» لمجموعة أخرى.`
      : `Ask each group to write a new challenge on “${topic}” for another group.`,
    slides: numbered(slides),
  };
}

// ── Relay ────────────────────────────────────────────────────────────────────

export function buildRelay(ctx: FormatCtx, challenges: Challenge[]): ClassroomActivity {
  const { isAr, topic, dur, slideDuration } = ctx;
  const n = challenges.length;
  const slides: Omit<ActivitySlide, 'slideNumber'>[] = [
    {
      type: 'intro',
      title: isAr ? '🏃 سباق التتابع' : '🏃 Relay Race',
      content: isAr
        ? `سباق «${topic}» التتابعي!\nكل فريق يُنجز ${n} مهام متتالية، وكل طالب مهمة واحدة.\nقبل أن تبدأ مهمتك، راجع إجابة زميلك السابق وصحّحها إن لزم.\nالفريق الأسرع بإجابات صحيحة يفوز.`
        : `The “${topic}” relay!\nEach team completes ${n} tasks in turn, one student per task.\nBefore you start yours, check the previous runner's answer and fix it if needed.\nThe fastest team with correct answers wins.`,
      durationSeconds: 0,
    },
  ];
  challenges.forEach((c, i) => {
    slides.push({
      type: 'relay-problem',
      title: c.banked
        ? (isAr ? `المسألة ${i + 1} من ${n}` : `Problem ${i + 1} of ${n}`)
        : (isAr ? `المهمة ${i + 1} من ${n}` : `Task ${i + 1} of ${n}`),
      content: c.prompt,
      hint: c.hint,
      answer: c.answer,
      durationSeconds: slideDuration,
      teacher: { expectedAnswer: c.answer, ...(c.tip ? { teachingTips: c.tip } : {}) },
    });
  });
  slides.push({
    type: 'summary',
    title: isAr ? '🎉 اكتمل التتابع!' : '🎉 Relay complete!',
    content: isAr
      ? `أحسنتم!\nراجعنا ${n} أفكار من «${topic}».\nناقش: أي مهمة كانت الأصعب؟`
      : `Well done!\nWe revisited ${n} ideas from “${topic}”.\nDiscuss: which task was the hardest?`,
    durationSeconds: 0,
  });

  return {
    ...base(ctx, 'relay'),
    activityName: isAr ? `سباق التتابع – ${topic}` : `Relay Race – ${topic}`,
    learningObjective: isAr
      ? `مراجعة أفكار «${topic}» في سلسلة مهام ضمن فرق تنافسية`
      : `Revisit the ideas of “${topic}” in a chain of tasks within competing teams`,
    materials: isAr
      ? ['السبورة', 'أوراق التتابع المطبوعة', 'مؤقت', 'أقلام ملونة (لون لكل فريق)']
      : ['Whiteboard', 'Printed relay sheets (one per team)', 'Timer', 'Coloured markers (one per team)'],
    teacherPreparation: isAr
      ? `قسّم الطلبة إلى فرق من ${n} أفراد أو أكثر. اطبع ورقة تتابع لكل فريق. كل طالب يجيب عن مهمة واحدة ثم يمرّر الورقة.`
      : `Split students into teams of ${n} or more. Print a relay sheet per team. Each student answers one task, then passes the sheet on.`,
    teacherNotes: isAr
      ? ['وازن بين الفرق في المستوى', 'شجّع مراجعة إجابة الزميل قبل التمرير']
      : ['Balance teams by ability', "Encourage checking the teammate's answer before passing"],
    answerKey: challenges.map((c, i) => (isAr ? `المهمة ${i + 1}: ${c.answer}` : `Task ${i + 1}: ${c.answer}`)),
    printables: isAr ? ['أوراق التتابع', 'لوحة النتائج'] : ['Relay sheets', 'Scoreboard'],
    assessment: isAr
      ? `قيّم صحة إجابات المهام الـ${n} وسرعة الإنجاز.`
      : `Assess the correctness of all ${n} answers and the speed.`,
    extensionChallenge: isAr
      ? 'اطلب من الفريق الفائز صياغة مهمة جديدة للفريق الآخر'
      : 'Ask the winning team to write a new task for the other team',
    slides: numbered(slides),
  };
}

// ── Error detective (banked questions only) ──────────────────────────────────

export function buildErrorDetective(ctx: FormatCtx, cases: ErrorCase[]): ClassroomActivity {
  const { isAr, topic, slideDuration } = ctx;
  const slides: Omit<ActivitySlide, 'slideNumber'>[] = [
    {
      type: 'intro',
      title: isAr ? '🔍 المحقق' : '🔍 Error Detective',
      content: isAr
        ? 'مهمتك: اكشف الخطأ في الإجابات التالية!\nكل إجابة مكتوبة هنا خاطئة.\nحدّد لماذا هي خطأ، وقدّم الإجابة الصحيحة.\n\nعمل ثنائي – دقيقتان لكل حالة'
        : 'Your mission: spot the mistake in each answer!\nEvery answer shown here is wrong.\nSay why it is wrong and give the correct one.\n\nWork in pairs — 2 minutes per case',
      durationSeconds: 0,
    },
  ];
  cases.forEach((c, i) => {
    const right = isAr ? `الإجابة الصحيحة: ${c.right}` : `Correct answer: ${c.right}`;
    slides.push({
      type: 'challenge',
      title: isAr ? `🕵️ الحالة ${i + 1} – أوجد الخطأ` : `🕵️ Case ${i + 1} – Find the Error`,
      content: isAr
        ? `السؤال:\n${c.question}\n\nكتب طالب هذه الإجابة: ${c.wrong}\n\n❓ أين الخطأ؟`
        : `The question:\n${c.question}\n\nA student answered: ${c.wrong}\n\n❓ Where is the error?`,
      hint: isAr ? 'أعد حلّ السؤال بنفسك ثم قارن' : 'Solve it yourself first, then compare',
      answer: right,
      durationSeconds: slideDuration,
      teacher: {
        expectedAnswer: right,
        commonMisconceptions: isAr
          ? `«${c.wrong}» خطأ شائع مقصود في بنك الأسئلة`
          : `“${c.wrong}” is a deliberate common error from the question bank`,
        teachingTips: isAr
          ? 'ناقش لماذا يقع الطلبة في هذا الخطأ، وليس الإجابة الصحيحة فقط.'
          : 'Discuss WHY students make this error, not just the correct answer.',
      },
    });
    slides.push({
      type: 'reveal',
      title: isAr ? '✅ الإجابة الصحيحة' : '✅ The correct answer',
      content: isAr
        ? `${right}\n\nالإجابة «${c.wrong}» خطأ شائع.\n\n🏅 نقطة لمن اكتشف الخطأ!`
        : `${right}\n\n“${c.wrong}” is a common error.\n\n🏅 A point for whoever caught it!`,
      durationSeconds: 0,
    });
  });
  slides.push({
    type: 'summary',
    title: isAr ? '🏆 اكتمل التحقيق!' : '🏆 Investigation complete!',
    content: isAr
      ? `أحسنتم يا محققون!\nكشفنا اليوم ${cases.length} أخطاء شائعة في «${topic}».\n\n💡 هذه الأخطاء تتكرر في الامتحانات — الآن تعرفون كيف تتجنبونها.`
      : `Outstanding detectives!\nWe uncovered ${cases.length} common errors in “${topic}”.\n\n💡 They show up in exams — now you know how to avoid them.`,
    durationSeconds: 0,
  });

  return {
    ...base(ctx, 'error-detective'),
    activityName: isAr ? `المحقق – ${topic}` : `Error Detective – ${topic}`,
    learningObjective: isAr
      ? `تحديد الأخطاء الشائعة في «${topic}» وتصحيحها`
      : `Identify and correct common mistakes in “${topic}”`,
    materials: isAr
      ? ['السبورة', 'بطاقات الإجابات الخاطئة المطبوعة', 'أقلام تصحيح حمراء']
      : ['Whiteboard', 'Printed error cards', 'Red correction pens'],
    teacherPreparation: isAr
      ? `اطبع الحالات الـ${cases.length} مسبقًا. اطلب من الطلبة العمل في ثنائيات.`
      : `Print the ${cases.length} cases in advance. Students work in pairs.`,
    teacherNotes: isAr
      ? ['ناقش سبب الخطأ وليس فقط الإجابة الصحيحة', 'الإجابات الخاطئة هنا من بنك الأسئلة، وهي أخطاء يقع فيها الطلبة فعلًا']
      : ['Discuss why the error happens, not only the right answer', 'The wrong answers come from the question bank and are errors students really make'],
    answerKey: cases.map((c, i) => (isAr ? `الحالة ${i + 1}: ${c.right}` : `Case ${i + 1}: ${c.right}`)),
    printables: isAr ? ['بطاقات الإجابات الخاطئة', 'نموذج التقرير'] : ['Error cards', 'Investigation report template'],
    assessment: isAr
      ? 'قيّم قدرة الطلبة على تحديد الخطأ وشرح سببه وتقديم الإجابة الصحيحة.'
      : 'Assess whether students can spot the error, explain its cause and give the correct answer.',
    extensionChallenge: isAr
      ? `اطلب من الطلبة تأليف إجابة خاطئة متعمّدة عن «${topic}» وتبادلها مع زوج آخر.`
      : `Ask students to write a deliberately wrong answer on “${topic}” and swap it with another pair.`,
    slides: numbered(slides),
  };
}

// ── Bingo from term names ────────────────────────────────────────────────────

/**
 * A bingo whose cards carry the lesson's key-term NAMES. The clue is read by
 * the teacher from the textbook (the catalog has the names, almost never the
 * definitions), so the call says so rather than printing a definition nobody
 * wrote.
 */
export function buildTermBingo(ctx: FormatCtx, names: string[]): ClassroomActivity {
  const { isAr, topic } = ctx;
  const slides: Omit<ActivitySlide, 'slideNumber'>[] = [
    {
      type: 'intro',
      title: isAr ? '🎱 بينجو المصطلحات' : '🎱 Term Bingo',
      content: isAr
        ? `بينجو «${topic}»!\nلكل طالب بطاقة فيها مصطلحات الدرس.\nأقرأ لكم وصف مصطلح، فغطّوا المصطلح المطابق على بطاقتكم.\nأول من يكمل صفًا يصرخ بينجو!`
        : `“${topic}” Bingo!\nEach student has a card of the lesson's terms.\nI read a description of a term; cover the matching term on your card.\nFirst to complete a row shouts BINGO!`,
      durationSeconds: 0,
    },
  ];
  names.forEach((name, i) => {
    slides.push({
      type: 'bingo-call',
      title: isAr ? `الاستدعاء ${i + 1}` : `Call ${i + 1}`,
      content: isAr
        ? `اقرأ للصف تعريف «${name}» من كتاب الطالب، أو صِفه بكلماتك دون أن تذكر اسمه.`
        : `Read the class the textbook's definition of “${name}”, or describe it in your own words without saying its name.`,
      hint: isAr ? 'فكّر في المصطلح الذي يطابق الوصف' : 'Think of the term that matches the description',
      answer: name,
      durationSeconds: 30,
      teacher: {
        expectedAnswer: name,
        teachingTips: isAr ? 'امنح 20–30 ثانية قبل الكشف' : 'Allow 20–30 seconds before revealing',
      },
    });
  });
  slides.push({
    type: 'summary',
    title: isAr ? '🎉 انتهت الجولة!' : '🎉 Round complete!',
    content: isAr
      ? `أحسنتم!\nراجعنا مصطلحات «${topic}».\nناقش مع زميلك: أي مصطلح كان الأصعب؟`
      : `Well done!\nWe reviewed the terms of “${topic}”.\nDiscuss with a partner: which term was hardest?`,
    durationSeconds: 0,
  });

  return {
    ...base(ctx, 'bingo'),
    activityName: isAr ? `بينجو – ${topic}` : `Bingo – ${topic}`,
    learningObjective: isAr
      ? `التعرّف على مصطلحات «${topic}» من أوصافها بأسلوب تنافسي`
      : `Recognise the terms of “${topic}” from their descriptions in a competitive format`,
    materials: isAr
      ? ['بطاقات بينجو مطبوعة (بطاقة لكل طالب)', 'قصاصات ورقية للتغطية', 'كتاب الطالب']
      : ['Printed bingo cards (one per student)', 'Paper scraps for covering', "Student's textbook"],
    teacherPreparation: isAr
      ? `اطبع بطاقات بمصطلحات الدرس (${names.join('، ')}) مرتّبة بشكل مختلف لكل طالب. جهّز تعريفات المصطلحات من كتاب الطالب لتقرأها عند كل استدعاء.`
      : `Print cards of the lesson's terms (${names.join(', ')}), shuffled differently per student. Have the textbook's definitions ready to read at each call.`,
    teacherNotes: isAr
      ? ['ناقش المصطلح بعد كل استدعاء', 'يمكن اللعب لجولتين مع تبديل البطاقات']
      : ['Discuss each term after its call', 'Play two rounds with swapped cards'],
    answerKey: names.map((name, i) => (isAr ? `الاستدعاء ${i + 1}: ${name}` : `Call ${i + 1}: ${name}`)),
    printables: isAr ? ['بطاقات بينجو', 'قائمة الاستدعاء للمعلم'] : ['Bingo cards', "Teacher's caller list"],
    assessment: isAr
      ? 'قيّم سرعة التعرّف على المصطلحات ودقتها، وراقب من يحتاج مراجعة.'
      : 'Assess how quickly and accurately students recognise the terms; note who needs review.',
    extensionChallenge: isAr
      ? 'اطلب من الفائز شرح ثلاثة مصطلحات من بطاقته بكلماته'
      : 'Ask the winner to explain three terms from their card in their own words',
    slides: numbered(slides),
  };
}

// ── Gallery walk ─────────────────────────────────────────────────────────────

/** Five stations from the lesson's tasks; the stations' roles are fixed, their content is the lesson's. */
export function buildGalleryWalk(ctx: FormatCtx, tasks: LessonTask[]): ClassroomActivity {
  const { isAr, topic, slideDuration } = ctx;
  const t = (i: number) => tasks[i % tasks.length]!;
  // Only key terms are named inside a sentence — an outcome is a whole sentence
  // and reads wrongly in quotes. With no term the station is about the lesson.
  const termsIn = tasks.map(x => x.about).filter(Boolean);
  const about = (i: number) => termsIn.length ? termsIn[i % termsIn.length]! : topic;

  // Two distinct things to compare; a lesson with a single named idea compares
  // it with how it shows up outside the classroom instead of with itself.
  const [cmpA, cmpB] = about(0) !== about(1)
    ? [about(0), about(1)]
    : isAr ? [`«${topic}» في الدرس`, `«${topic}» في الحياة اليومية`] : [`“${topic}” in the lesson`, `“${topic}” in everyday life`];

  const stations: Array<{ title: string; content: string; hint: string }> = isAr
    ? [
        { title: '📌 المحطة 1 – الأساس', content: `${t(0).prompt}\n\nاكتبوا إجابتكم الجماعية على الورقة.\nهل تتفقون مع المجموعة السابقة؟`, hint: t(0).hint },
        { title: '📌 المحطة 2 – التطبيق', content: `اذكروا مثالًا من الدرس أو من حياتكم يوضّح «${about(1)}».\n\nدوّنوه على الورقة. ما الفرق بين مثالكم ومثال المحطة 1؟`, hint: 'ابحثوا عن مثال يعرفه الجميع' },
        { title: '📌 المحطة 3 – التحليل', content: `قارنوا بين ${cmpA.startsWith('«') ? cmpA : `«${cmpA}»`} و${cmpB.startsWith('«') ? cmpB : `«${cmpB}»`} في «${topic}».\n\nارسموا مخطط فِن على الورقة، وأضيفوا تشابهين واختلافين على الأقل.`, hint: 'فكّروا فيما يجمعهما وما يفرّقهما' },
        { title: '📌 المحطة 4 – التقييم', content: `${t(2).prompt}\n\nثم اكتبوا ما قد يخطئ فيه الطلبة عند تناول هذا الموضوع، وكيف يمكن تصحيحه.`, hint: 'تحقّقوا من كل نقطة على حدة' },
        { title: '📌 المحطة 5 – الإبداع', content: `ألّفوا سؤالًا عن «${about(3)}» لمجموعة أخرى، وضعوا إجابته على ظهر الورقة.\n\nستقرأ المجموعات الأخرى سؤالكم!`, hint: 'اختاروا سؤالًا له إجابة واضحة' },
      ]
    : [
        { title: '📌 Station 1 – Foundations', content: `${t(0).prompt}\n\nWrite your group's answer on the poster.\nDo you agree with the previous group?`, hint: t(0).hint },
        { title: '📌 Station 2 – Application', content: `Give an example from the lesson or your own life that shows “${about(1)}”.\n\nRecord it on the poster. How does it differ from the example at Station 1?`, hint: 'Look for an example everyone knows' },
        { title: '📌 Station 3 – Analysis', content: `Compare ${cmpA.startsWith('“') ? cmpA : `“${cmpA}”`} and ${cmpB.startsWith('“') ? cmpB : `“${cmpB}”`} in “${topic}”.\n\nDraw a Venn diagram on the poster with at least 2 similarities and 2 differences.`, hint: 'Think about what joins them and what sets them apart' },
        { title: '📌 Station 4 – Evaluate', content: `${t(2).prompt}\n\nThen write what students might get wrong about this, and how to put it right.`, hint: 'Check each point one by one' },
        { title: '📌 Station 5 – Create', content: `Write a question about “${about(3)}” for another group, and put its answer on the back of the poster.\n\nOther groups will read and answer your question!`, hint: 'Pick a question with a clear answer' },
      ];

  const slides: Omit<ActivitySlide, 'slideNumber'>[] = [
    {
      type: 'intro',
      title: isAr ? '🖼️ جولة المعارض' : '🖼️ Gallery Walk',
      content: isAr
        ? `مرحبًا بكم في معرض «${topic}»!\n\n5 محطات حول الغرفة.\nكل مجموعة تتنقل بين المحطات وتناقش المهمة وتكتب على الورقة.\nوقت كل محطة: 3-4 دقائق.`
        : `Welcome to the “${topic}” gallery!\n\n5 stations around the room.\nEach group rotates, discusses the task and writes on the poster.\nTime per station: 3–4 minutes.`,
      durationSeconds: 0,
    },
    ...stations.map(s => ({
      type: 'challenge' as const,
      title: s.title,
      content: s.content,
      hint: s.hint,
      answer: isAr ? 'انظر الورقة الكبيرة في المحطة' : 'See the large poster at this station',
      durationSeconds: slideDuration,
      teacher: {
        expectedAnswer: isAr ? 'إجابات الطلبة تُقارن بكتاب الطالب' : "Compare students' answers with the textbook",
        teachingTips: isAr ? 'تأكد أن المجموعات تكتب على الورقة وليس فقط تناقش شفهيًا' : 'Make sure groups write on the poster, not only discuss aloud',
      },
    })),
    {
      type: 'summary',
      title: isAr ? '🎨 اكتملت الجولة!' : '🎨 Gallery walk complete!',
      content: isAr
        ? `أحسنتم! زرتم جميع محطات «${topic}».\n\nلنستعرض أبرز ما كتبتموه:\n• أفضل إجابة في المحطة 1؟\n• أجمل مثال في المحطة 2؟\n• أفضل سؤال في المحطة 5؟\n\nناقشوا: ما أكثر ما تعلمتموه؟`
        : `Well done! You visited every “${topic}” station.\n\nLet's review the highlights:\n• Best answer at Station 1?\n• Best example at Station 2?\n• Best question at Station 5?\n\nDiscuss: what was your biggest takeaway?`,
      durationSeconds: 0,
    },
  ];

  return {
    ...base(ctx, 'gallery-walk'),
    activityName: isAr ? `جولة المعارض – ${topic}` : `Gallery Walk – ${topic}`,
    learningObjective: isAr
      ? `استكشاف جوانب متعددة من «${topic}» عبر نقاش جماعي في محطات دوّارة`
      : `Explore several sides of “${topic}” through group discussion at rotating stations`,
    materials: isAr
      ? ['5 أوراق كبيرة مثبّتة على الجدران', 'أقلام ملونة', 'ملصقات لاصقة']
      : ['5 large sheets of paper posted on walls', 'Coloured markers', 'Sticky notes'],
    teacherPreparation: isAr
      ? 'اكتب مهمة كل محطة على ورقة كبيرة. رتّب المجموعات (4-5 أفراد). كل محطة: 3-4 دقائق.'
      : 'Write each station task on a large sheet. Arrange groups of 4-5. Allow 3-4 minutes per station.',
    teacherNotes: isAr
      ? ['ابدأ المجموعات في محطات مختلفة لتجنب الازدحام', 'شجّع إضافة ملاحظات على ما كتبته المجموعات السابقة']
      : ['Start groups at different stations to avoid crowding', "Encourage adding comments to previous groups' answers"],
    answerKey: stations.map((_, i) => (isAr ? `المحطة ${i + 1}: إجابات الطلبة تُقارن بكتاب الطالب` : `Station ${i + 1}: compare students' answers with the textbook`)),
    printables: isAr ? ['بطاقات المحطات (A3)', 'ورقة تتبع المجموعات'] : ['Station cards (A3)', 'Group tracking sheet'],
    assessment: isAr
      ? 'راجع ما كتبته المجموعات على الأوراق وناقش الإجابات المثيرة في الختام.'
      : 'Review what groups wrote on the posters and discuss the interesting answers in the debrief.',
    extensionChallenge: isAr
      ? 'اطلب من كل مجموعة إضافة محطة جديدة بسؤالها الخاص.'
      : 'Ask each group to add a new station with their own question.',
    slides: slides.map((s, i) => ({ ...s, slideNumber: i + 1 })),
  };
}

// ── Exit ticket ──────────────────────────────────────────────────────────────

export function buildExitTicket(ctx: FormatCtx, tasks: LessonTask[]): ClassroomActivity {
  const { isAr, topic, dur } = ctx;
  const t = (i: number) => tasks[i % tasks.length]!;
  const termsIn = tasks.map(x => x.about).filter(Boolean);
  const about = (i: number) => termsIn.length ? termsIn[i % termsIn.length]! : topic;
  const check = isAr ? 'إجابة مفتوحة — يُقيَّم الفهم وليس الحفظ الحرفي' : 'Open answer — assess understanding, not word-for-word recall';

  const slides: Omit<ActivitySlide, 'slideNumber'>[] = [
    {
      type: 'intro',
      title: isAr ? '🎫 بطاقة الخروج' : '🎫 Exit Ticket',
      content: isAr
        ? `قبل أن تغادر الفصل اليوم،\nأثبت ما تعلمته عن «${topic}».\n\n3 أسئلة سريعة — عمل فردي\nاترك ورقتك عند الباب عند انتهاء الوقت.`
        : `Before you leave today,\nshow what you learned about “${topic}”.\n\n3 quick questions — individual work\nLeave your paper at the door when time is up.`,
      durationSeconds: 0,
    },
    {
      type: 'challenge',
      title: isAr ? '❓ السؤال 1 – تذكّر' : '❓ Question 1 – Recall',
      content: `${t(0).prompt}\n\n${isAr ? '(جملة أو جملتان تكفيان)' : '(One or two sentences is enough)'}`,
      hint: t(0).hint,
      answer: check,
      durationSeconds: Math.round(dur * 20),
      teacher: { expectedAnswer: t(0).check, teachingTips: isAr ? 'ابحث عن الفهم المفاهيمي وليس الحفظ' : 'Look for conceptual understanding, not memorised text' },
    },
    {
      type: 'challenge',
      title: isAr ? '❓ السؤال 2 – تطبيق' : '❓ Question 2 – Apply',
      content: isAr
        ? `اذكر مثالًا من الدرس أو من حياتك يوضّح «${about(1)}» واشرح لماذا يوضّحه.\n\n(ثلاث جمل أو أقل)`
        : `Give an example from the lesson or your life that shows “${about(1)}”, and explain why it does.\n\n(Three sentences or fewer)`,
      hint: isAr ? 'اختر مثالًا تعرفه جيدًا' : 'Pick an example you know well',
      answer: check,
      durationSeconds: Math.round(dur * 25),
      teacher: { expectedAnswer: t(1).check, teachingTips: isAr ? 'قيّم التعليل وليس المثال وحده' : 'Assess the reasoning, not only the example' },
    },
    {
      type: 'challenge',
      title: isAr ? '❓ السؤال 3 – تفكير' : '❓ Question 3 – Think',
      content: isAr
        ? `ما الجزء الذي ما زال غير واضح لك في «${topic}»؟\nاكتب سؤالًا واحدًا تريد أن نبدأ به الحصة القادمة.`
        : `Which part of “${topic}” is still unclear to you?\nWrite one question you want us to start the next lesson with.`,
      hint: isAr ? 'لا بأس إن لم يكن لديك سؤال — اكتب ما كان أصعب' : 'It is fine if you have none — write what was hardest',
      answer: check,
      durationSeconds: Math.round(dur * 20),
      teacher: { expectedAnswer: check, teachingTips: isAr ? 'هذا السؤال يوجّه تخطيط الحصة القادمة' : 'This answer steers the next lesson' },
    },
    {
      type: 'summary',
      title: isAr ? '🎫 انتهى الوقت!' : '🎫 Time is up!',
      content: isAr
        ? `ضع قلمك وسلّم ورقتك.\n\nشكرًا على عملك اليوم في «${topic}»!\nسأراجع إجاباتكم قبل الحصة القادمة.`
        : `Pens down and hand in your paper.\n\nThank you for your work on “${topic}” today!\nI will review your tickets before the next lesson.`,
      durationSeconds: 0,
    },
  ];

  return {
    ...base(ctx, 'exit-ticket'),
    activityName: isAr ? `بطاقة الخروج – ${topic}` : `Exit Ticket – ${topic}`,
    learningObjective: isAr
      ? `التحقق من مستوى فهم الطلبة لـ«${topic}» في نهاية الحصة`
      : `Check student understanding of “${topic}” at the end of the lesson`,
    materials: isAr ? ['ورقة بطاقة الخروج المطبوعة (1 لكل طالب)', 'قلم'] : ['Printed exit ticket (1 per student)', 'Pen'],
    teacherPreparation: isAr
      ? 'اطبع بطاقة الخروج (3 أسئلة). خصّص 5-7 دقائق في نهاية الحصة.'
      : 'Print the exit ticket (3 questions). Reserve 5-7 minutes at the end of the lesson.',
    teacherNotes: isAr
      ? ['اجمع البطاقات عند الباب', 'راجعها قبل الحصة القادمة لتعديل خطتك']
      : ['Collect tickets at the door', 'Review before the next lesson to adjust your plan'],
    answerKey: isAr
      ? ['السؤال 1: تذكّر — يُقارن بكتاب الطالب', 'السؤال 2: تطبيق — يُقيَّم التعليل', 'السؤال 3: تفكير — سؤال الطالب يوجّه الحصة القادمة']
      : ['Q1: Recall — compare with the textbook', 'Q2: Apply — assess the reasoning', "Q3: Think — the student's question steers the next lesson"],
    printables: isAr ? ['بطاقة الخروج (نسخة لكل طالب)'] : ['Exit ticket (one per student)'],
    assessment: isAr
      ? 'افرز البطاقات إلى 3 مجموعات: فهم كامل / فهم جزئي / يحتاج دعمًا.'
      : 'Sort tickets into 3 piles: full understanding / partial understanding / needs support.',
    extensionChallenge: isAr
      ? 'استخدم أسئلة الطلبة في السؤال 3 لتصميم نشاط افتتاحي للحصة القادمة.'
      : "Use the students' Question 3 answers to design the next lesson's opener.",
    slides: slides.map((s, i) => ({ ...s, slideNumber: i + 1 })),
  };
}
