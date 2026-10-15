/**
 * The offline sentences that assume ONE lesson, reworded for a revision.
 *
 * A unit, a semester or the whole book reaches the offline makers as a
 * revision session whose topic is the scope's phrase («موضوعات الفصل الأول»),
 * never the picker's label. Most sentences read correctly with it
 * («موضوعات الفصل الأول – عمل فردي»). A few were written for one lesson and
 * would claim one: «من درس «موضوعات الفصل الأول»», «من الحصة السابقة».
 * Those, and only those, are rewritten here after the template has run. The
 * templates stay exactly as a lesson needs them, because no format gets a
 * second blueprint (piece-3 spec, decision 4).
 *
 * Each entry is the template's exact text with the phrase in place of the
 * topic. Editing one of those template sentences makes its entry dead. The
 * tests fail on a dead entry, so the table cannot quietly stop applying.
 *
 * Free of react-native so `node --test` can load it.
 */

export type Reword = [string, string];

/** The activity blueprints' one-lesson sentences (`activityBlueprints.ts`). */
export function activityRevisionRewords(phrase: string, lang: 'ar' | 'en'): Reword[] {
  const p = phrase;
  return lang === 'ar'
    ? [
        [`من درس «${p}»`, `من ${p}`],
        [`عن ${p} من الحصة السابقة`, `عن ${p} من الحصص السابقة`],
        [`ما أهم ما تعلّمته عن ${p} في الحصة السابقة؟`, `ما أهم ما تعلّمته عن ${p} في الحصص السابقة؟`],
        [`قبل الدخول في ${p}`, `قبل مراجعة ${p}`],
        [`واليوم سنستخدمه لـ ${p}`, `واليوم سنستخدمه في مراجعة ${p}`],
        // The warm-up's third step and its assessment name «today's lesson» / «the new lesson».
        [`اربط بدرس اليوم`, `اربط بحصة اليوم`],
        [`ستبدأ الدرس الجديد`, `ستبدأ جولات المراجعة`],
      ]
    : [
        [`from the “${p}” lesson`, `from ${p}`],
        [`about ${p} from last lesson`, `about ${p} from earlier lessons`],
        [`learned about ${p} last lesson?`, `learned about ${p} in earlier lessons?`],
        [`before ${p} begins`, `before the revision of ${p} begins`],
        [`today we use it for ${p}.`, `today we use it to revise ${p}.`],
      ];
}

/**
 * The classroom templates' one-lesson sentences (`classroomActivityOnce` in
 * generators.ts): the vocabulary bingo's clues, the unbanked relay's chain,
 * the gallery walk's stations and the exit ticket's three questions. Each
 * assumes a single concept or method («المفهوم الرئيسي لـ…», «أسلوب … الذي
 * درسناه اليوم», «من وحدة …»). `units` is how many units the scope has: a unit
 * scope has one, and must not be told it holds «another unit».
 */
export function classroomRevisionRewords(phrase: string, lang: 'ar' | 'en', units: number): Reword[] {
  const p = phrase;
  // A unit scope has ONE unit, so «two different units» / «another unit» would
  // be false there: the same sentences speak of two topics / another rule of it.
  const several = units > 1;
  return lang === 'ar'
    ? [
        [`المصطلح 1: تعريف ${p}`, `المصطلح 1: مصطلح من ${p} وتعريفه`],
        [`المصطلح 2: خاصية ${p}`, `المصطلح 2: خاصية من ${p}`],
        [`المصطلح 3: تطبيق ${p}`, `المصطلح 3: تطبيق من ${p}`],
        [`فكّر في تعريف ${p}`, `فكّر في تعريفات ${p}`],
        [`من وحدة ${p}`, `من ${p}`],
        [`خاصية: ${p} يُستخدم عندما…`, `خاصية: مفهوم من ${p} يُستخدم عندما…`],
        [`ما الفرق بين المفهومين الرئيسيين في ${p}؟`, several ? `ما الفرق بين مفهومين من وحدتين مختلفتين في ${p}؟` : `ما الفرق بين مفهومين من موضوعين مختلفين في ${p}؟`],
        [`الفرق بين مفهومَي ${p}`, `الفرق بين مفهومين من ${p}`],
        [`أي خاصية من خصائص ${p} تنطبق`, `أي خاصية مما راجعناه في ${p} تنطبق`],
        [`طبّق ${p} على المعطيات التالية`, `طبّق قاعدة من ${p} على المعطيات التالية`],
        [`القيمة الأولى (أ) من تطبيق ${p}`, `القيمة الأولى (أ) من تطبيق قاعدة من ${p}`],
        [`الآن طبّق ${p} مرة أخرى مع (أ)`, several ? `الآن طبّق قاعدة من وحدة أخرى في ${p} مع (أ)` : `الآن طبّق قاعدة أخرى من ${p} مع (أ)`],
        [`طبّق خاصية ${p} الثانية مع (ب)`, `طبّق خاصية من ${p} مع (ب)`],
        [`طبّق ${p} بالكامل لإيجاد الإجابة النهائية`, `اجمع ما طبّقته من ${p} لإيجاد الإجابة النهائية`],
        [`اليوم طبّقتم ${p} في سلسلة متكاملة`, `اليوم راجعتم ${p} في سلسلة متكاملة`],
        // The hints and tips that point back at «the lesson» we «studied».
        [`هل تتذكر هذا المصطلح من الدرس؟`, `هل تتذكر هذا المصطلح مما راجعناه؟`],
        [`أين طبّقنا هذا في الدرس؟`, `أين طبّقنا هذا فيما راجعناه؟`],
        [`تذكّر صيغ وحدتنا`, `تذكّر الصيغ التي راجعناها`],
        [`اربط السؤال بخطوة الحل التي درسناها`, `اربط السؤال بخطوة الحل التي راجعناها`],
        [`استخدم الخطوات التي درسناها اليوم`, `استخدم الخطوات التي راجعناها اليوم`],
        [`تذكّر الخاصية الثانية التي درسناها`, `تذكّر الخاصية الثانية التي راجعناها`],
        [`طبّق التعريف الأساسي لـ${p}`, `طبّق تعريفًا أساسيًا من ${p}`],
        [`تطبيق مباشر للتعريف الأساسي لـ${p}`, `تطبيق مباشر لتعريف أساسي من ${p}`],
        [`كيف يُستخدم ${p} لحل هذا الموقف الحياتي؟`, `كيف يُستخدم مفهوم من ${p} لحل هذا الموقف الحياتي؟`],
        [`بين مفهومين رئيسيين في ${p}؟`, several ? `بين مفهومين رئيسيين من وحدتين مختلفتين في ${p}؟` : `بين مفهومين رئيسيين من موضوعين مختلفين في ${p}؟`],
        [`عرّف المفهوم الرئيسي لـ${p}.`, `اختر مفهومًا رئيسيًا من ${p} وعرّفه.`],
        [`تعريف دقيق بكلمات الطالب لـ${p}`, `تعريف دقيق بكلمات الطالب لمفهوم من ${p}`],
        [`طبّق ${p} على مثال من الكتاب المدرسي`, `طبّق قاعدة من ${p} على مثال من الكتاب المدرسي`],
        [`متى لا ينجح أسلوب ${p} الذي درسناه اليوم؟`, `متى لا تنجح قاعدة من ${p} راجعناها اليوم؟`],
        [`اذكر موقفًا حياتيًا يستخدم ${p}.`, `اذكر موقفًا حياتيًا يستخدم مفهومًا من ${p}.`],
      ]
    : [
        [`Term 1: definition of ${p}`, `Term 1: a term from ${p} and its definition`],
        [`Term 2: property of ${p}`, `Term 2: a property from ${p}`],
        [`Term 3: application of ${p}`, `Term 3: an application from ${p}`],
        [`Think about the definition of ${p}`, `Think about the definitions in ${p}`],
        [`from the ${p} unit`, `from ${p}`],
        [`Property: ${p} is used when…`, `Property: a concept from ${p} is used when…`],
        [`The distinction between the two concepts in ${p}`, `The distinction between two concepts from ${p}`],
        [`Which property of ${p} applies`, `Which property from ${p} applies`],
        [`Apply ${p} to the given data`, `Apply a rule from ${p} to the given data`],
        [`First value (a) from applying ${p}`, `First value (a) from applying a rule from ${p}`],
        [`Now apply ${p} again with (a)`, several ? `Now apply a rule from another unit of ${p} with (a)` : `Now apply another rule from ${p} with (a)`],
        [`Apply the second property of ${p} with (b)`, `Apply a property from ${p} with (b)`],
        [`Apply the full ${p} process to find the final answer`, `Combine what you applied from ${p} to find the final answer`],
        [`Today you applied ${p} across a full connected chain`, `Today you revised ${p} across a full connected chain`],
        [`Do you remember this term from the lesson?`, `Do you remember this term from what we revised?`],
        [`Recall the formulas from our unit`, `Recall the formulas we revised`],
        [`Connect the clue to the solution steps we studied`, `Connect the clue to the solution steps we revised`],
        [`Use the steps we practised today`, `Use the steps we revised today`],
        [`Recall the second property we studied`, `Recall the second property we revised`],
        [`Think about what we covered at the start of the lesson`, `Think about what we reviewed at the start of the session`],
        [`Apply the core definition of ${p}`, `Apply a core definition from ${p}`],
        [`Direct application of the core ${p} definition`, `Direct application of a core definition from ${p}`],
        [`How does ${p} apply to this real-world scenario?`, `How does a concept from ${p} apply to this real-world scenario?`],
        // Also the tail of «What is the main difference between the two key concepts in …?».
        [`between the two key concepts in ${p}?`, several ? `between two key concepts from different units of ${p}?` : `between two key concepts from two different topics in ${p}?`],
        [`Define the main concept of ${p}.`, `Pick one key concept from ${p} and define it.`],
        [`An accurate student-worded definition of ${p}`, `An accurate student-worded definition of a concept from ${p}`],
        [`Apply ${p} to an example from the textbook`, `Apply a rule from ${p} to an example from the textbook`],
        [`When does the ${p} method we learned today NOT work?`, `When does a rule from ${p} that we revised today NOT work?`],
        [`Name a real-world situation that uses ${p}.`, `Name a real-world situation that uses a concept from ${p}.`],
      ];
}

/** Every string inside `value` with each `from` replaced by its `to`, in table order. Other values are copied as they are. */
export function reviseWording<T>(value: T, rewords: readonly Reword[]): T {
  const fix = (s: string) => rewords.reduce((acc, [from, to]) => acc.split(from).join(to), s);
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return fix(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}
