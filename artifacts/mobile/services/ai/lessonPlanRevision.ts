/**
 * The offline lesson plan for a unit, a semester or the whole book: ONE
 * revision session over the units in scope (spec
 * `2026-10-14-wide-scope-teaching-tools-design.md`, §1).
 *
 * It keeps the plan's own fields (no new ones — the viewer, the saved-plan type
 * and the exports are untouched) and the teaching style's shape, but the main
 * activity is a round per unit in that style's own form: `direct` a short
 * worked review per unit, `inquiry` one guiding question per unit,
 * `collaborative` one group card per unit. The introduction states the scope
 * and what the session leaves out (`leftOutSentence`). No prior-knowledge
 * review is produced: it belongs to one lesson's unit.
 *
 * The live twin is `revisionClauseAr/En(b, 'plan')` in
 * `artifacts/api-server/src/lib/revision.ts` — change one, change the other.
 * The Arabic teacher fields are first person, future («سأراجع… ثم سأطرح…»),
 * per the voice rule (`lessonPlanTeacherVoice.test.ts`); `homework` is the
 * students' and stays addressed to them.
 *
 * Deterministic: an offline Regenerate of a revision plan returns the same plan,
 * and `freshOnRegenerate` reports it as repeated rather than pretending.
 *
 * Free of react-native so `node --test` can load it.
 */
import type { AIRequest, LessonPlanOutput } from './AIService.ts';
import { arMinutes } from './lessonPlanTypes.ts';
import {
  leftOutSentence, revisionPhrase, revisionUnits, revisionUnitsFromLessons, scopeFromKey, splitShown,
  REVISION_SHOWN_PER_UNIT, type RevisionUnit,
} from '../revisionScope.ts';

export type RevisionStyle = 'direct' | 'inquiry' | 'collaborative';

export type RevisionPlanInput = {
  units: RevisionUnit[];
  /** `revisionPhrase(sel, lang)` — «موضوعات الفصل الأول». */
  phrase: string;
  lang: 'ar' | 'en';
  /** Any other value is read as `direct`, as `buildLessonStyleBlueprint` does. */
  style: string;
  duration: number;
  /** The teacher's own objectives, one per line — used verbatim, as on a single-lesson plan. */
  customObjectives?: string;
};

export type RevisionPlanFields = Pick<
  LessonPlanOutput,
  'objectives' | 'materials' | 'introduction' | 'mainActivity' | 'guidedPractice'
  | 'independentPractice' | 'closure' | 'assessment' | 'differentiation' | 'homework'
>;

/** The mark that opens each round of the main activity — one per unit. Tests count it. */
export const ROUND_MARK_AR = 'الجولة';
export const ROUND_MARK_EN = 'Round';

function styleOf(style: string): RevisionStyle {
  return style === 'inquiry' || style === 'collaborative' ? style : 'direct';
}

/** «وحدة واحدة» / «وحدتان» / «3 وحدات» / «11 وحدةً». */
function arUnits(n: number): string {
  if (n === 1) return 'وحدة واحدة';
  if (n === 2) return 'وحدتان';
  if (n >= 3 && n <= 10) return `${n} وحدات`;
  return `${n} وحدةً`;
}

type Ctx = {
  units: RevisionUnit[];
  isAr: boolean;
  min: (share: number) => number;
  label: (n: number) => string;
  q: (s: string) => string;
  list: (items: string[]) => string;
  roundMin: number;
};

function ctxFor(input: RevisionPlanInput): Ctx {
  const isAr = input.lang === 'ar';
  const min = (share: number) => Math.max(1, Math.round(input.duration * share));
  return {
    units: input.units,
    isAr,
    min,
    label: n => (isAr ? arMinutes(n) : `${n} min`),
    q: s => (isAr ? `«${s}»` : `“${s}”`),
    list: items => items.join(isAr ? '، ' : ', '),
    roundMin: Math.max(1, Math.floor(min(0.4) / Math.max(1, input.units.length))),
  };
}

/** The lessons a round names, quoted. */
function shownTitles(c: Ctx, u: RevisionUnit): string {
  return c.list(splitShown(u, REVISION_SHOWN_PER_UNIT).shown.map(l => c.q(l.title)));
}

function roundHead(c: Ctx, u: RevisionUnit, i: number): string {
  return `${c.isAr ? ROUND_MARK_AR : ROUND_MARK_EN} ${i + 1} — ${c.q(u.title)} (${c.label(c.roundMin)})`;
}

function objectives(input: RevisionPlanInput, c: Ctx): string[] {
  const own = input.customObjectives?.trim();
  if (own) return own.split('\n').map(s => s.trim()).filter(Boolean);
  // Every unit gets a line; with few units, more of each unit's outcomes fit.
  // `outcomes` are the NCCD official outcomes, which exist in Arabic only — so an
  // English plan quotes them as written; a unit with none (outside the MVP set)
  // gets a generic line in `lang` rather than an empty objective.
  const perUnit = c.units.length <= 2 ? 3 : 1;
  return c.units.flatMap(u => (u.outcomes.length
    ? u.outcomes.slice(0, perUnit).map(o => `${u.title}: ${o}`)
    : [c.isAr ? `مراجعة الأفكار الرئيسة في وحدة ${c.q(u.title)}` : `Review the key ideas of the ${c.q(u.title)} unit`]));
}

function introduction(input: RevisionPlanInput, c: Ctx): string {
  const left = leftOutSentence(c.units, REVISION_SHOWN_PER_UNIT, input.lang);
  const titles = c.list(c.units.map(u => c.q(u.title)));
  const n = c.units.length;
  const body = c.isAr
    ? `(${c.label(c.min(0.1))}) سأعلن في بداية الحصة أنها حصة مراجعة واحدة تغطي ${input.phrase}`
      + (n > 1 ? `، وهي ${arUnits(n)}: ${titles}.` : '.')
      + ' ثم سيكتب كل طالب في دقيقة واحدة أصعب فكرة يتذكّرها منها، وسأبدأ بما يتكرّر في الإجابات.'
    : `(${c.label(c.min(0.1))}) Announce that this is one revision session covering ${input.phrase}`
      + (n > 1 ? ` — ${n} units: ${titles}.` : '.')
      + ' Each student then writes, in one minute, the hardest idea they remember from it; start from what comes up most.';
  return left ? `${body} ${left}` : body;
}

function conceptsOf(c: Ctx, u: RevisionUnit, n: number): string {
  const cs = u.concepts.slice(0, n);
  return cs.length ? c.list(cs.map(c.q)) : (c.isAr ? 'الفكرة الرئيسة في هذه الوحدة' : 'the key idea of this unit');
}

function guidingQuestion(c: Ctx, u: RevisionUnit): string {
  const [a, b] = u.concepts;
  if (c.isAr) {
    if (a && b) return `ما العلاقة بين ${a} و${b}؟ ومتى نحتاج كلًّا منهما؟`;
    if (a) return `متى نحتاج ${a}؟ وكيف نعرف أن النتيجة صحيحة؟`;
    return 'ما أهم فكرة في هذه الوحدة؟ وأين نحتاجها؟';
  }
  if (a && b) return `How are ${a} and ${b} related, and when do we need each?`;
  if (a) return `When do we need ${a}, and how do we know the result is right?`;
  return 'What is the most important idea in this unit, and where do we need it?';
}

function mainActivity(style: RevisionStyle, c: Ctx): string {
  const m = c.label(c.min(0.4));
  if (c.isAr) {
    if (style === 'inquiry') {
      return `(${m}) – مراجعة استقصائية، سؤال موجّه واحد لكل وحدة (ثلاثيات):\n\n`
        + c.units.map((u, i) => `${roundHead(c, u, i)}: سأطرح سؤالًا موجّهًا دون أن أذكّر بالقاعدة: «${guidingQuestion(c, u)}» ثم يكتب كل ثلاثي إجابته مع دليل من دروس ${shownTitles(c, u)}.`).join('\n');
    }
    if (style === 'collaborative') {
      return `(${m}) – مراجعة تعاونية، بطاقة مجموعة لكل وحدة (مجموعات 3-4):\n\n`
        + 'سأعطي كل مجموعة بطاقة وحدة، وإن زادت المجموعات على الوحدات تكرّرت البطاقة:\n'
        + c.units.map((u, i) => `${roundHead(c, u, i)}: بطاقة فيها ${conceptsOf(c, u, 3)} من دروس ${shownTitles(c, u)}؛ تُعِدّ المجموعة ملخّصًا ومثالًا واحدًا، ثم تعرضه على الصف.`).join('\n')
        + '\nوبعد كل عرض سأسحب رقمًا: يجيب صاحبه عن سؤال من بطاقة مجموعة أخرى.';
    }
    return `(${m}) – مراجعة مباشرة، جولة لكل وحدة («أنا أفعل» ثم سؤال سريع):\n\n`
      + c.units.map((u, i) => `${roundHead(c, u, i)}: سأراجع دروس ${shownTitles(c, u)} بشرح قصير يتناول ${conceptsOf(c, u, 2)} ومثال واحد من الكتاب، ثم سأطرح سؤالًا سريعًا يجيب عنه الصف معًا.`).join('\n');
  }
  if (style === 'inquiry') {
    return `(${m}) – Inquiry review, one guiding question per unit (groups of three):\n\n`
      + c.units.map((u, i) => `${roundHead(c, u, i)}: pose a guiding question without restating the rule — "${guidingQuestion(c, u)}" — and each trio writes its answer with evidence from ${shownTitles(c, u)}.`).join('\n');
  }
  if (style === 'collaborative') {
    return `(${m}) – Collaborative review, one group card per unit (groups of 3-4):\n\n`
      + 'Give each group a unit card; with more groups than units, cards repeat:\n'
      + c.units.map((u, i) => `${roundHead(c, u, i)}: a card on ${conceptsOf(c, u, 3)} from ${shownTitles(c, u)}; the group prepares a summary and one example, then presents it.`).join('\n')
      + '\nAfter each presentation draw a number: that student answers a question from another group\'s card.';
  }
  return `(${m}) – Direct review, one round per unit (I do, then a quick check):\n\n`
    + c.units.map((u, i) => `${roundHead(c, u, i)}: review ${shownTitles(c, u)} with a short explanation of ${conceptsOf(c, u, 2)} and one textbook example, then pose a quick question the class answers together.`).join('\n');
}

function practice(style: RevisionStyle, c: Ctx): Pick<RevisionPlanFields, 'guidedPractice' | 'independentPractice'> {
  const g = c.label(c.min(0.2));
  const ind = c.label(c.min(0.15));
  const titles = c.list(c.units.map(u => c.q(u.title)));
  if (c.isAr) {
    if (style === 'inquiry') {
      return {
        guidedPractice: `(${g}) – اختبار الإجابات:\n\n• سأعرض إجابات الثلاثيات لكل وحدة جنبًا إلى جنب، وسأسأل: «ما دليلك؟ هل ينطبق هذا على مثال من الكتاب؟»\n• وسأقدّم لكل وحدة حالة تكشف خطأً شائعًا، ويعدّل الثلاثي إجابته بنفسه.\n• بعد أن يستقر الصف على صياغة، سأكتبها على السبورة تحت اسم وحدتها.`,
        independentPractice: `(${ind}) – حالة جديدة من كل وحدة:\n\n• يعمل كل طالب بمفرده على حالة لم تُناقَش من كل وحدة (${titles})، ويكتب: هل صمدت الصياغة التي توصّلنا إليها؟ وإن لم تصمد، ما الشرط الناقص؟\n• سأقبل الإجابة «لم تصمد» إن كان التبرير سليمًا.`,
      };
    }
    if (style === 'collaborative') {
      return {
        guidedPractice: `(${g}) – نقد متبادل بين المجموعات:\n\n• ستتبادل كل مجموعتين ملخّصيهما وتكتب كل منهما نقطة قوية واحدة وسؤالًا حقيقيًا واحدًا.\n• تردّ كل مجموعة على سؤال الأخرى أمام الصف في دقيقة واحدة.\n• سأدير الحوار ولن أقدّم الإجابة، وسأسأل: «هل أقنعك ردّهم؟ لماذا؟»`,
        independentPractice: `(${ind}) – مساءلة فردية:\n\n• الآن فقط يعمل كل طالب بمفرده وبصمت على ورقة قصيرة فيها سؤال من **كل** وحدة (${titles})، لا من بطاقة مجموعته وحدها.\n• وسأسحب رقمًا: يعرض صاحبه إجابته عن وحدة غير وحدة مجموعته.`,
      };
    }
    return {
      guidedPractice: `(${g}) – «نحن نفعل»:\n\n• سأختار من كل وحدة سؤالًا واحدًا من أسئلة الكتاب، وسنحلّه معًا والطلبة يوجّهون كل خطوة.\n• سأطرح أسئلة استرشادية: «من أي وحدة هذا السؤال؟ وما الذي نحتاجه منها؟»\n• وسأصحّح الأخطاء الشائعة فور ظهورها.`,
      independentPractice: `(${ind}) – «أنت تفعل»:\n\n• يعمل كل طالب بمفرده على ورقة مراجعة قصيرة فيها سؤال من كل وحدة (${titles}).\n• سأتجوّل وأقدّم تلميحات مكتوبة دون أن أعطي الحل.`,
    };
  }
  if (style === 'inquiry') {
    return {
      guidedPractice: `(${g}) – Testing the answers:\n\n• Post each unit's trio answers side by side and ask: "What is your evidence? Does it hold for an example from the book?"\n• Offer each unit one case that exposes a common error; the trio revises its own answer.\n• Once the class settles on a wording, write it on the board under its unit.`,
      independentPractice: `(${ind}) – A new case from every unit:\n\n• Each student works alone on an undiscussed case from each unit (${titles}) and writes: did our wording hold? If not, what condition was missing?\n• "It did not hold" is a fully acceptable answer when the reasoning is sound.`,
    };
  }
  if (style === 'collaborative') {
    return {
      guidedPractice: `(${g}) – Group-to-group critique:\n\n• Groups swap summaries in pairs and each writes one genuine strength and one genuine question.\n• Each group answers the other's question in front of the class, in one minute.\n• Run the exchange without supplying the answer: "Did their reply convince you? Why?"`,
      independentPractice: `(${ind}) – Individual accountability:\n\n• Only now does each student work alone and in silence, on a short sheet with a question from **every** unit (${titles}) — not just their group's card.\n• Draw a number: that student reports their answer on a unit other than their group's.`,
    };
  }
  return {
    guidedPractice: `(${g}) – We Do:\n\n• Pick one textbook question from each unit and solve it together, with students directing each step.\n• Guiding questions: "Which unit is this from? What do we need from it?"\n• Correct common errors the moment they surface.`,
    independentPractice: `(${ind}) – You Do:\n\n• Each student works alone on a short review sheet with a question from each unit (${titles}).\n• Circulate with written hints rather than answers.`,
  };
}

function assessment(style: RevisionStyle, c: Ctx): string {
  if (c.isAr) {
    if (style === 'inquiry') return 'المقياس جودة الاستدلال في كل وحدة لا سرعة الإجابة.\nتكويني: سأصنّف إجابات الثلاثيات: مبنية على دليل من الدروس، أم على تذكّر، أم على تخمين.\nختامي: سأنظر في ورقة الحالة الجديدة لكل وحدة: هل فحص الطالب الصياغة أم طبّقها دون تحقّق؟';
    if (style === 'collaborative') return 'سأقيّم المجموعة بورقة الفرد الذي سُحب رقمه، لا بأفضل أفرادها.\nتكويني: سأراجع ملخّصات المجموعات بحثًا عن وحدة ضعيفة باستمرار — تلك هي التي سأعيد شرحها للصف كله.\nختامي: سأرصد نتيجة الورقة الفردية لكل وحدة على حدة.';
    return 'تكويني: سأراقب في «نحن نفعل» أيّ الوحدات يتعثّر فيها الطلبة.\nختامي: سأصحّح ورقة المراجعة الفردية وأرصد النتيجة لكل وحدة على حدة، لا علامة واحدة للحصة.\nبطاقة الخروج: سأعدّ الوحدات التي يذكرها الطلبة لأقرّر ما أعيده.';
  }
  if (style === 'inquiry') return 'The measure is the quality of the reasoning in each unit, not the speed of answering.\nFormative: sort the trios\' answers — grounded in evidence from the lessons, in recall, or in guessing.\nSummative: the new-case sheet for each unit — did the student test the wording or apply it unchecked?';
  if (style === 'collaborative') return 'Grade the group on the sheet of the student whose number was drawn, not on its strongest member.\nFormative: scan the summaries for a unit that is consistently weak — that is the one to re-teach to the whole class.\nSummative: record the individual sheet\'s result for each unit separately.';
  return 'Formative: watch the We-Do stage for the units students stumble on.\nSummative: mark the individual review sheet and record the result per unit, not one mark for the session.\nExit ticket: count the units students name, to decide what to revisit.';
}

function differentiation(style: RevisionStyle, c: Ctx): string {
  const [u0, u1] = c.units;
  const pair = u0 && u1 ? `${c.q(u0.title)} ${c.isAr ? 'و' : 'and '}${c.q(u1.title)}` : '';
  if (c.isAr) {
    const link = pair ? `سؤال يربط وحدتين (مثل ${pair})` : 'سؤال يربط درسين من الوحدة';
    if (style === 'inquiry') return `دعم: سأضيّق السؤال الموجّه وأعطي بادئة جملة للإجابة.\nتحدٍّ: ${link} مع الشرط الذي يجعل الصياغة تصمد.\nالمبدأ: الجميع يستقصي — سأراعي الفروق في ضيق السؤال لا في من يُسمح له بالتفكير.`;
    if (style === 'collaborative') return `سأعطي بطاقات الوحدات بقصد لا عشوائيًا: البطاقة الأقصر لمجموعة تحتاج دعمًا، وتبقى مسؤولة عن جزء حقيقي يعتمد عليه الصف.\nتحدٍّ: ${link}، أو صياغة سؤال امتحان يغطي الوحدات كلها.`;
    return `دعم: سأعطي من يحتاج بطاقة مثال لكل وحدة يرجع إليها في الورقة الفردية.\nتحدٍّ: ${link}.\nالمبدأ: سأقلّل الحمل المعرفي بالأمثلة أولًا ثم أزيلها تدريجيًا.`;
  }
  const link = pair ? `a question that links two units (such as ${pair})` : 'a question that links two lessons of the unit';
  if (style === 'inquiry') return `Support: narrow the guiding question and give a sentence stem for the answer.\nStretch: ${link}, with the condition that makes the wording hold.\nThe principle: everyone investigates — differentiate the narrowness of the question, never who is allowed to think.`;
  if (style === 'collaborative') return `Hand out the unit cards deliberately, not at random: the shortest card to a group that needs support — it still owns a real part the class depends on.\nStretch: ${link}, or writing an exam question that covers every unit.`;
  return `Support: an example card per unit for students who need it during the individual sheet.\nStretch: ${link}.\nThe principle: cut cognitive load with examples first, then withdraw them.`;
}

function homework(input: RevisionPlanInput, c: Ctx): string {
  const left = c.units.some(u => splitShown(u, REVISION_SHOWN_PER_UNIT).left.length > 0);
  if (c.isAr) {
    return 'لكل وحدة من وحدات المراجعة: اكتب الفكرة الرئيسة في جملتين، وحلّ سؤالًا واحدًا من أسئلة مراجعتها في الكتاب.'
      + (left ? ' وابدأ بالدروس التي لم تتّسع لها الحصة.' : '');
  }
  return 'For each unit reviewed: write its key idea in two sentences and solve one question from its review exercises in the book.'
    + (left ? ' Start with the lessons the session could not fit.' : '');
}

const MATERIALS: Record<'ar' | 'en', Record<RevisionStyle, string[]>> = {
  ar: {
    direct: ['الكتاب المدرسي (صفحات مراجعة كل وحدة)', 'السبورة وأقلام ملوّنة', 'بطاقة مثال لكل وحدة', 'ورقة مراجعة فردية فيها سؤال من كل وحدة'],
    inquiry: ['بطاقة سؤال موجّه لكل وحدة', 'ورق كبير وأقلام لتسجيل الإجابات', 'الكتاب المدرسي (يُفتح بعد المحاولة لا قبلها)', 'ورقة حالة جديدة من كل وحدة'],
    collaborative: ['بطاقة وحدة لكل مجموعة', 'لوح إجابة لكل مجموعة', 'أقلام ملوّنة وشريط لاصق', 'كيس أرقام للمساءلة العشوائية', 'ورقة مراجعة فردية تغطي الوحدات كلها'],
  },
  en: {
    direct: ['Textbook (each unit\'s review pages)', 'Board and coloured markers', 'An example card per unit', 'Individual review sheet with a question from each unit'],
    inquiry: ['A guiding-question card per unit', 'Chart paper and markers for recording answers', 'Textbook (opened after the attempt, not before)', 'A new-case sheet from each unit'],
    collaborative: ['One unit card per group', 'One answer board per group', 'Coloured markers and tape', 'Number draw for random accountability', 'Individual review sheet covering every unit'],
  },
};

/** Every text field of a revision plan, for the units given. */
export function buildRevisionPlan(input: RevisionPlanInput): RevisionPlanFields {
  const c = ctxFor(input);
  const style = styleOf(input.style);
  return {
    objectives: objectives(input, c),
    materials: [...MATERIALS[input.lang][style]],
    introduction: introduction(input, c),
    mainActivity: mainActivity(style, c),
    ...practice(style, c),
    closure: c.isAr
      ? `(${c.label(c.min(0.1))}) سأختم ببطاقة خروج لكل طالب: «أي وحدة ما زلت تحتاج إلى مراجعتها؟ ولماذا؟» وسأجمع البطاقات لأبني عليها المراجعة القادمة.`
      : `(${c.label(c.min(0.1))}) Exit ticket for every student: "Which unit do you still need to review, and why?" Collect them to plan the next review.`,
    assessment: assessment(style, c),
    differentiation: differentiation(style, c),
    homework: homework(input, c),
  };
}

/**
 * The whole plan for a revision request, as `lessonPlanOnce` returns it.
 *
 * Units come from the request's lesson table (`coverage.lessons` ids — the
 * table the live prompt lists too), else from its scope key; the phrase from
 * the scope key. Never from `topic`: that is the scope's label, and it grounds
 * to the wrong lesson. Throws when neither yields a lesson, rather than
 * building a plan about nothing.
 */
export function revisionPlanFromRequest(req: AIRequest): LessonPlanOutput {
  const lang: 'ar' | 'en' = req.language === 'arabic' ? 'ar' : 'en';
  const sel = req.scope ? scopeFromKey(req.scope.scopeKey) : null;
  const fromTable = req.coverage?.lessons?.length
    ? revisionUnitsFromLessons(req.coverage.lessons.map(l => l.id), lang)
    : [];
  const units = fromTable.length ? fromTable : sel ? revisionUnits(sel, lang) : [];
  if (units.length === 0) {
    throw new Error('A revision plan needs the lessons of its scope, and none could be read from the request.');
  }
  const phrase = sel ? revisionPhrase(sel, lang) : (lang === 'ar' ? 'موضوعات المراجعة' : 'the review topics');
  const duration = req.duration ?? 45;
  const fields = buildRevisionPlan({
    units, phrase, lang, style: req.teachingStyle ?? 'direct', duration, customObjectives: req.objectives,
  });
  return {
    title: lang === 'ar'
      ? `${phrase} – خطة حصة مراجعة`
      : `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)} – Revision Lesson Plan`,
    grade: req.grade,
    subject: req.subject,
    duration,
    ...fields,
  };
}
