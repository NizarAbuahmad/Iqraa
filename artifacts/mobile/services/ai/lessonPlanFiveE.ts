/**
 * The 5E model as a teaching style: Engage · Explore · Explain · Elaborate ·
 * Evaluate.
 *
 * A teacher asked for «درس على نموذج 5E» (feedback, 2026-10-30) and the picker
 * had three styles, none of them it. The plan has no field per stage, so the
 * five stages share the fields the other styles already use, and every field
 * NAMES the stage it carries so a teacher can see the model in the document:
 *
 * | Stage | Where it lives |
 * | --- | --- |
 * | Engage — التشويق | `introduction`, labelled by `stageIntro` |
 * | Explore — الاستكشاف, then Explain — التفسير | `mainActivity`, in that order |
 * | Elaborate — التوسّع | `guidedPractice` |
 * | Evaluate — التقويم | `independentPractice` (the individual part) and `assessment` |
 *
 * What makes it its own style and not `inquiry` under another name: inquiry has
 * the class settle on a wording of the rule and withholds the term to the end;
 * 5E has a teacher-led EXPLAIN stage that builds on what the groups found and
 * names the idea, then a separate ELABORATE stage that takes it into a new
 * context. Explore always comes before Explain — students meet the idea before
 * it is named.
 *
 * The same contract is stated for the live path in `LESSON_STYLE_RULES_AR/_EN`
 * (`artifacts/api-server/src/lib/prompts.ts`); change one, change the other.
 * The Arabic teacher text is first person, future (`lessonPlanTeacherVoice.test.ts`).
 * It has NOT been read by a Jordanian teacher; that is the gate.
 */
import {
  firstConcept, fromDoc, phaseMinutes, term,
  type Lang, type LessonStyleBlueprint, type LessonStyleContext,
} from './lessonPlanTypes.ts';

type Builder = (ctx: LessonStyleContext) => LessonStyleBlueprint;
const m = phaseMinutes;

/** The style's id, as the picker, the request and the API carry it. */
export const FIVE_E_ID = '5e';

/**
 * Names the opening as the Engage stage. The introduction is written by the
 * plan's own opener and stays style-blind on purpose (the hook does not change
 * because the delivery does); 5E only labels it, so the model is visible. Any
 * other style gets the text back untouched.
 */
export function stageIntro(style: string, lang: Lang, intro: string): string {
  if (style !== FIVE_E_ID) return intro;
  const label = lang === 'ar' ? 'التشويق (Engage):' : 'Engage:';
  // A revision plan's opening starts with its minutes («(5 دقائق) …»), as every section does:
  // the label goes after them, so the time still leads.
  const time = /^\([^)]*\)\s*/.exec(intro)?.[0] ?? '';
  return `${time}${label} ${intro.slice(time.length)}`;
}

// ─── Arabic ──────────────────────────────────────────────────────────────────

export const fiveEAr: Builder = ctx => {
  const c0 = firstConcept(ctx);
  return {
    materials: [
      'مثير للفضول: صورة أو عرض قصير أو موقف غير متوقع يفتح الدرس',
      'أمثلة أو مواد للاستكشاف العملي لكل مجموعة',
      'ورق كبير وأقلام لتسجيل الملاحظات',
      'الكتاب المدرسي (يُفتح بعد مرحلتي الاستكشاف والتفسير لا قبلهما)',
      'ورقة تقويم فردية قصيرة',
    ],
    mainActivity: `(${m(ctx, 0.3)}) – نموذج 5E: الاستكشاف ثم التفسير${fromDoc(ctx)}:\n\n`
      + '**الاستكشاف (Explore):**\n'
      + `1. سأقسّم الصف إلى مجموعات ثلاثية وأعطي كل مجموعة أمثلة أو مواد حول «${c0}» مع سؤال واحد: «ما الذي تلاحظونه، وما الذي يتكرر؟»\n`
      + '2. سأتنقّل بين المجموعات وأسأل أسئلة مفتوحة دون أن أعطي الجواب أو أسمّي الفكرة بعد.\n'
      + '3. تسجّل كل مجموعة ملاحظاتها وتفسيرها المبدئي على ورقة كبيرة.\n\n'
      + '**التفسير (Explain):**\n'
      + '4. سأجمع ملاحظات المجموعات وأبني عليها: «ماذا وجدتم؟ وبأي كلمات تصفونه؟»\n'
      + `5. ثم سأسمّي الفكرة بمصطلحها العلمي (${term(ctx)}) وأشرحها بمثال محلول، وأصحّح ما يخالفها من تفسيرات الطلبة.`,
    guidedPractice: `(${m(ctx, 0.22)}) – التوسّع (Elaborate):\n\n`
      + `• سأقدّم موقفًا جديدًا لم يُناقش ليطبّق الطلبة فيه المصطلح (${term(ctx)}) وما فسّرناه معًا.\n`
      + `• تعمل المجموعات على مسألة جديدة تربط «${c0}» بسياق مختلف، وتشرح لماذا تنطبق الفكرة أو لا تنطبق.\n`
      + '• وسأسأل: «ماذا لو تغيّر هذا الشرط؟» «أين نرى هذه الفكرة في حياتنا؟» وأترك المجموعة تتحقق من إجابتها بنفسها.\n'
      + '• وسأربط الفكرة بما تعلّمه الطلبة في دروس سابقة.',
    independentPractice: `(${m(ctx, 0.18)}) – التقويم (Evaluate) — الجزء الفردي:\n\n`
      + '• يعمل كل طالب بمفرده على ورقة قصيرة فيها موقف جديد؛ يطبّق فيه الفكرة ويفسّر إجابته.\n'
      + '• يكتب في السطر الأخير: «ما الذي فهمته الآن ولم أكن أعرفه في بداية الحصة؟»\n'
      + '• من ينهي مبكرًا يصوغ سؤالًا واحدًا لزميله عن الفكرة نفسها.',
    assessment: 'التقويم (Evaluate) مستمر عبر المراحل الخمس:\n'
      + 'تكويني: سأراقب مرحلة الاستكشاف — ما الذي لاحظه الطلبة قبل أن أسمّي الفكرة — وأسجّل التصورات الخاطئة لأعالجها في مرحلة التفسير.\n'
      + 'ختامي: سأصحّح الورقة الفردية وفق أهداف الدرس.\n'
      + 'ذاتي: سأطلب من كل طالب أن يقارن فهمه في بداية الحصة بفهمه في نهايتها.',
    differentiation: 'دعم: سأقدّم في الاستكشاف أمثلة أقل وأسئلة موجّهة، وبداية جملة للوصف («لاحظنا أن…»).\n'
      + 'تحدٍّ: سأطلب في التوسّع ربط الفكرة بسياق جديد أو صياغة مسألة من تأليف الطالب.\n'
      + 'المبدأ: يمرّ كل الطلبة بالمراحل الخمس نفسها، وأغيّر مقدار التوجيه لا مَن يُسمح له بالاستكشاف.',
  };
};

/** The alternative wording: predict first, then explore; the teacher explains after the groups do; a rubric to evaluate. */
export const fiveEAr1: Builder = ctx => {
  const c0 = firstConcept(ctx);
  return {
    materials: [
      'موقف أو عرض قصير يفتح الدرس بسؤال «ماذا سيحدث؟»',
      'بطاقات توقّع صغيرة لكل طالب',
      'أمثلة أو مواد للتجريب لكل مجموعة',
      'ورق كبير لتفسير المجموعة',
      'معيار تقويم من ثلاثة مستويات',
    ],
    mainActivity: `(${m(ctx, 0.3)}) – نموذج 5E: الاستكشاف بالتوقّع ثم التفسير${fromDoc(ctx)}:\n\n`
      + '**الاستكشاف (Explore):**\n'
      + `1. سأعرض موقفًا عن «${c0}» وأطلب من كل طالب أن يكتب توقّعه وسببه قبل أي تجربة.\n`
      + '2. تجرّب المجموعات أو تفحص الأمثلة وتسجّل ما حدث فعلًا مقابل ما توقّعته.\n'
      + '3. سأمرّ على المجموعات وأسأل: «ما الذي فاجأكم؟» دون أن أصحّح بعد.\n\n'
      + '**التفسير (Explain):**\n'
      + '4. تكتب كل مجموعة تفسيرها بكلماتها وتعرضه على الصف.\n'
      + `5. بعد ذلك فقط سأقدّم الفكرة بمصطلحها (${term(ctx)}) في شرح قصير، وأربطها بتفسيرات الطلبة وأبيّن ما أصاب منها وما يحتاج تعديلًا.`,
    guidedPractice: `(${m(ctx, 0.22)}) – التوسّع (Elaborate) بتبادل المواقف:\n\n`
      + `• تأخذ كل مجموعة بطاقة موقف مختلفة تنقل الفكرة إلى سياق جديد حول «${c0}».\n`
      + '• تحلّ المجموعة الموقف وتكتب هل بقيت الفكرة صحيحة وما الذي تغيّر.\n'
      + '• وسأمرّ عليهم وأسأل: «كيف تعرفون أن تفسيركم يصلح هنا؟» وأشجّع ربط الفكرة بمعلومات من دروس سابقة.\n'
      + '• ثم تعلّق كل مجموعة ورقتها ونتجوّل معًا لنقارن بين السياقات.',
    independentPractice: `(${m(ctx, 0.18)}) – التقويم (Evaluate) بمعيار واضح:\n\n`
      + '• سأعرض معيار تقويم من ثلاثة مستويات للفكرة، ثم يجيب كل طالب بمفرده عن موقف جديد.\n'
      + '• يحدّد كل طالب مستوى إجابته وفق المعيار ويكتب ما سيحسّنه.\n'
      + '• تذكرة الخروج: «اكتب جملة تشرح بها الفكرة لزميل غاب اليوم.»',
    assessment: 'التقويم (Evaluate) يتوزّع على الحصة كلها:\n'
      + 'تكويني: سأقرأ توقّعات الطلبة وتفسيراتهم قبل الشرح وبعده، وأرصد كيف تغيّر فهمهم.\n'
      + 'ختامي: سأستعمل المعيار الثلاثي نفسه في تصحيح الورقة الفردية.\n'
      + 'تأمّل: سأسأل في آخر الحصة: «ما الذي تغيّر في فهمك؟»',
    differentiation: 'دعم: سأعطي من يحتاج دعمًا توقّعًا بالاختيار من متعدد في الاستكشاف، وبطاقة مصطلحات في التفسير.\n'
      + 'تحدٍّ: سأطلب من المتميزين اقتراح تجربة أو مثال يختبر حدود الفكرة في مرحلة التوسّع.\n'
      + 'المبدأ: المراحل نفسها للجميع، والفرق في مقدار الدعم لا في فرصة الاستكشاف.',
  };
};

// ─── English ─────────────────────────────────────────────────────────────────

export const fiveEEn: Builder = ctx => {
  const c0 = firstConcept(ctx);
  return {
    materials: [
      'A hook: a short image, demo or surprising situation to open the lesson',
      'Examples or materials for hands-on exploration, per group',
      'Chart paper and markers for recording observations',
      'Textbook (opened after Explore and Explain, not before)',
      'Short individual evaluation sheet',
    ],
    mainActivity: `(${m(ctx, 0.3)}) – 5E model: Explore, then Explain${fromDoc(ctx)}:\n\n`
      + '**Explore:**\n'
      + `1. Groups of three get examples or materials on "${c0}" and one question: "What do you notice, and what repeats?"\n`
      + '2. Circulate and ask open questions without giving the answer or naming the idea yet.\n'
      + '3. Each group records its observations and a first explanation on chart paper.\n\n'
      + '**Explain:**\n'
      + '4. Gather the groups\' findings and build on them: "What did you find? In what words would you describe it?"\n'
      + `5. Only now name the idea with its formal term (${term(ctx)}) and explain it with a worked example, correcting any student explanation that conflicts with it.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Elaborate:\n\n`
      + `• Offer a new situation that was not discussed, where students apply the term (${term(ctx)}) and what the class explained together.\n`
      + `• Groups work on a new problem linking "${c0}" to a different context and explain why the idea does or does not apply.\n`
      + '• Ask: "What if this condition changed?" "Where do we see this idea in life?" and let each group check its own answer.\n'
      + '• Connect the idea to what students learned in earlier lessons.',
    independentPractice: `(${m(ctx, 0.18)}) – Evaluate, the individual part:\n\n`
      + '• Each student works alone on a short sheet with a new situation, applies the idea and explains the answer.\n'
      + '• The last line: "What do I understand now that I did not at the start of the lesson?"\n'
      + '• Early finishers write one question about the same idea for a classmate.',
    assessment: 'Evaluate runs through all five stages:\n'
      + 'Formative: watch the Explore stage — what students notice before the idea is named — and note misconceptions to address in Explain.\n'
      + 'Summative: mark the individual sheet against the lesson objectives.\n'
      + 'Self-assessment: each student compares their understanding at the start of the lesson with the end.',
    differentiation: 'Support: fewer examples and guiding questions in Explore, plus a sentence stem for describing ("We noticed that…").\n'
      + 'Stretch: in Elaborate, link the idea to a new context or write a problem of their own.\n'
      + 'The principle: everyone goes through the same five stages — vary the amount of guidance, never who is allowed to explore.',
  };
};

export const fiveEEn1: Builder = ctx => {
  const c0 = firstConcept(ctx);
  return {
    materials: [
      'A situation or short demo that opens with "What will happen?"',
      'Small prediction cards, one per student',
      'Examples or materials to try, per group',
      'Chart paper for each group\'s explanation',
      'A three-level evaluation rubric',
    ],
    mainActivity: `(${m(ctx, 0.3)}) – 5E model: Explore by predicting, then Explain${fromDoc(ctx)}:\n\n`
      + '**Explore:**\n'
      + `1. Show a situation about "${c0}" and have each student write a prediction and a reason before any trial.\n`
      + '2. Groups try it or examine the examples and record what actually happened against what they predicted.\n'
      + '3. Circulate and ask: "What surprised you?" without correcting yet.\n\n'
      + '**Explain:**\n'
      + '4. Each group writes its explanation in its own words and presents it to the class.\n'
      + `5. Only after that, present the idea with its term (${term(ctx)}) in a short explanation, tie it to the students' explanations and show which parts held and which need revising.`,
    guidedPractice: `(${m(ctx, 0.22)}) – Elaborate by swapping situations:\n\n`
      + `• Each group takes a different situation card that moves the idea into a new context around "${c0}".\n`
      + '• The group works the situation and writes whether the idea still holds and what changed.\n'
      + '• Circulate and ask: "How do you know your explanation works here?" and encourage links to earlier lessons.\n'
      + '• Groups post their sheets and the class walks round to compare the contexts.',
    independentPractice: `(${m(ctx, 0.18)}) – Evaluate against a clear rubric:\n\n`
      + '• Share a three-level rubric for the idea, then each student answers a new situation alone.\n'
      + '• Each student places their own answer on the rubric and writes what they will improve.\n'
      + '• Exit ticket: "Write one sentence that explains the idea to a classmate who was absent."',
    assessment: 'Evaluate is spread across the whole lesson:\n'
      + 'Formative: read the predictions and explanations before and after the teaching and note how understanding changed.\n'
      + 'Summative: use the same three-level rubric to mark the individual sheet.\n'
      + 'Reflection: close by asking "What changed in your understanding?"',
    differentiation: 'Support: give a multiple-choice prediction in Explore and a term card in Explain.\n'
      + 'Stretch: ask stronger students to propose a trial or example that tests the limits of the idea in Elaborate.\n'
      + 'The principle: the same stages for everyone — the difference is the amount of support, not the chance to explore.',
  };
};
