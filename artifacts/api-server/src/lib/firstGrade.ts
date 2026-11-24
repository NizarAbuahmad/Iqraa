/**
 * Grade 1 is six-year-olds who are learning to read — the live prompts must say so.
 *
 * Every live prompt sends the grade only as a name («الصف الأول»), and the
 * subject clauses beside it are grade-blind (`lessonKinds.ts`): an Arabic
 * lesson «starts from a text… students use the new vocabulary in sentences and
 * a paragraph of their own», an Arabic worksheet «is based on a short text…
 * comprehension and analysis», an English one ends in «a short paragraph», and
 * every quiz must hold «at least one item that requires analysis». For Grade 1
 * that is wrong on its face: the Arabic book is a primer that teaches one letter
 * per lesson (حرف الباء، تنوين الضمة…), and its English pupils know a handful of
 * words. The offline plan showed the same defect when it was swept on
 * 2026-11-13 — a «حرف الباء» plan asking six-year-olds for a 4–5 sentence
 * paragraph.
 *
 * So a Grade 1 request gets one more clause, placed after the subject clause
 * and saying that it overrides whatever above it does not fit the age. Other
 * grades are unchanged: `firstGradeClause*` returns "" for them.
 *
 * Grade 1 is recognised from any of the ids a request carries (`lessonId`
 * `kbl-g1-…`, `unitId` `kbu-g1-…`, `gradeId` `grade-1`) or the grade's name in
 * either language. Only an exact name counts, so «الصف الأول الثانوي» is not
 * Grade 1.
 *
 * **Grade 2 has a clause of its own (since 2026-11-15)**, recognised the same way
 * (`isSecondGrade`; «الصف الثاني عشر» is not Grade 2). Seven-year-olds read a short
 * text from the book and write words or a short sentence, so it allows what Grade 1's
 * forbids there and still rules out paragraphs, summaries, justifying, analysis and
 * controlled experiments. `firstGradeClause*` returns it for a Grade 2 request, so every
 * prompt that carries the Grade 1 clause carries this one; the offline plans say the same
 * (`artifacts/mobile/services/ai/lessonPlanFirstGrade.ts`, `EarlyGrade`).
 *
 * **And Grade 3 (since 2026-11-20)** (`isThirdGrade`; «الصف الثالث الثانوي» is not Grade 3).
 * Eight-year-olds read a short book text and write two or three sentences of their own; a
 * simple "why" answered in a sentence is fine, and a short prediction checked by looking.
 * It still rules out paragraphs, summaries, debates, written exit tickets and controlled
 * experiments with variables, and keeps a problem to two steps.
 */

/**
 * Which generator the clause is for: a lesson plan, a paper (worksheet, homework,
 * quiz, exam), an activity, a classroom game or quick check projected to the
 * class, the explanation section a deck or a student shows, or a visual (a slide
 * deck, an infographic).
 */
export type FirstGradeUse = "plan" | "paper" | "activity" | "classroom" | "explain" | "visual";

type GradeFields = {
  grade?: unknown;
  activityType?: unknown;
  activityVariant?: unknown;
  gradeId?: unknown;
  lessonId?: unknown;
  unitId?: unknown;
  subject?: string;
  subjectId?: string;
};

/** Harakat, tatweel and extra spaces stripped, so «الصَّفُّ الأَوَّلُ» still matches. */
function bareName(s: string): string {
  return s.replace(/[ً-ْٰـ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

const FIRST_GRADE_NAMES = new Set(["الصف الأول", "الأول", "grade 1", "first grade", "1"]);
const SECOND_GRADE_NAMES = new Set(["الصف الثاني", "الثاني", "grade 2", "second grade", "2"]);
const THIRD_GRADE_NAMES = new Set(["الصف الثالث", "الثالث", "grade 3", "third grade", "3"]);

/** A Grade 3 request, by the same fields and rules as `isFirstGrade`. */
export function isThirdGrade(b: GradeFields): boolean {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (/^kbl-g3-/.test(str(b.lessonId)) || /^kbu-g3-/.test(str(b.unitId))) return true;
  if (str(b.gradeId) === "grade-3") return true;
  if (b.grade === 3) return true;
  const name = str(b.grade);
  return name !== "" && THIRD_GRADE_NAMES.has(bareName(name));
}

/** A Grade 2 request, by the same fields and rules as `isFirstGrade`. */
export function isSecondGrade(b: GradeFields): boolean {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (/^kbl-g2-/.test(str(b.lessonId)) || /^kbu-g2-/.test(str(b.unitId))) return true;
  if (str(b.gradeId) === "grade-2") return true;
  if (b.grade === 2) return true;
  const name = str(b.grade);
  return name !== "" && SECOND_GRADE_NAMES.has(bareName(name));
}

export function isFirstGrade(b: GradeFields): boolean {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (/^kbl-g1-/.test(str(b.lessonId)) || /^kbu-g1-/.test(str(b.unitId))) return true;
  if (str(b.gradeId) === "grade-1") return true;
  if (b.grade === 1) return true;
  const name = str(b.grade);
  return name !== "" && FIRST_GRADE_NAMES.has(bareName(name));
}

/** The subject's id where the request names one we know the Grade 1 shape of. */
function subjectOf(b: GradeFields): "arabic" | "english" | "mathematics" | null {
  const id = (b.subjectId ?? "").trim();
  if (id === "arabic" || id === "english" || id === "mathematics") return id;
  const name = bareName(b.subject ?? "");
  if (/عربي|arabic/.test(name)) return "arabic";
  if (/انجليزي|إنجليزي|english/.test(name)) return "english";
  if (/رياضيات|math/.test(name)) return "mathematics";
  return null;
}

const OVERRIDE_AR = "هذا البند خاص بالصف الأول، وهو يحلّ محلّ أي مطلب أعلاه لا يناسب طفلًا في السادسة (نصّ للفهم والتحليل، فقرة مكتوبة، تعليل أو مقارنة أو تحليل، بطاقة خروج مكتوبة)؛ ويبقى ما سواه.";
const OVERRIDE_EN = "This section is for Grade 1 and replaces anything above that does not fit a six-year-old (a text to comprehend and analyse, a written paragraph, justifying, comparing or analysing, a written exit ticket); everything else above still applies.";

const BASE_AR: Record<FirstGradeUse, string> = {
  plan: `الصف الأول (أطفال في السادسة يتعلّمون القراءة والكتابة الآن):
- قسّم الحصة إلى نشاطات قصيرة (3-5 دقائق) محسوسة: صور ومجسّمات وبطاقات وحركة وأناشيد وألعاب، وكلام المعلم للطلبة جمل قصيرة بسيطة.
- لا تطلب من الطلبة كتابة فقرة أو جمل من إنتاجهم، ولا ملء جدول أو ورقة ملاحظات أو بطاقة خروج مكتوبة: الكتابة نسخ حرف أو كلمة أو عدد أو إكمال كلمة بحرف، وما سواها إجابة شفوية أو بالإشارة أو التلوين أو الوصل أو وضع دائرة.
- التقييم ملاحظة المعلم لأداء كل طفل وسؤاله شفويًا، والواجب البيتي مهمة قصيرة يؤدّيها الطفل مع أسرته (يشير، يعدّ، يلوّن، ينسخ سطرًا واحدًا)، لا صفحة كتابة.`,
  paper: `الصف الأول (أطفال في السادسة يتعلّمون القراءة الآن):
- كل سؤال جملة واحدة قصيرة بكلمات مألوفة، يُجاب عنه بحرف أو كلمة أو عدد أو اختيار أو صح/خطأ.
- لا أسئلة «علّل» أو «قارن» أو «حلّل» أو «اشرح» أو «اكتب فقرة»، ولا نص قصير يُقرأ ثم يُسأل عنه، ولا مسألة من أكثر من خطوة.
- ما يحتاج صورة صِفه بالكلمات أو ارسمه برموز في نص السؤال (★ ★ ★)، ولا تشر إلى «الصورة» أو «الشكل».
- الإجابة النموذجية كلمة أو عدد أو حرف، لا جملة.`,
  activity: `الصف الأول (أطفال في السادسة يتعلّمون القراءة والكتابة الآن):
- خطوات قصيرة محسوسة يقودها المعلم: صور وبطاقات ومجسّمات وحركة وأناشيد وألعاب، وتعليمات المعلم جمل قصيرة يقولها بصوته.
- لا قراءة نصوص ولا كتابة جمل أو فقرات ولا أوراق تُملأ: يشير الطفل أو يلوّن أو يصل أو يقول أو ينسخ حرفًا أو كلمة.
- التقييم ملاحظة المعلم وسؤاله الشفوي.`,
  classroom: `الصف الأول (أطفال في السادسة يتعلّمون القراءة الآن):
- كل ما على الشريحة كلمات قليلة يقرؤها المعلم بصوته، وكل سؤال جملة واحدة قصيرة بكلمات مألوفة.
- يجيب الأطفال معًا بالإشارة أو بصوت واحد أو برفع الإبهام أو بكلمة أو عدد؛ لا كتابة على الألواح إلا حرفًا أو عددًا.
- لا «اشرح» ولا «علّل» ولا «قارن»، ولا مسألة من أكثر من خطوة، وما يحتاج صورة يُرسم برموز (★ ★ ★) أو يصفه المعلم.`,
  explain: `الصف الأول (أطفال في السادسة يتعلّمون القراءة الآن، والمعلّم يقرأ الشاشة بصوته):
- كل ما يُعرض جمل قصيرة جدًا (خمس كلمات أو أقل) بكلمات يعرفها الطفل، وفكرة واحدة في كل شريحة.
- الشرح بأمثلة محسوسة من حياة الطفل (أشياء يعدّها، صور يصفها المعلم)، لا تعريفات ولا مصطلحات صعبة.
- المثال المحلول والتدريب خطوة أو خطوتان بأعداد الدرس وكلماته فقط، والإجابة كلمة أو عدد؛ والحلّ الخاطئ فيه خطأ واحد بسيط يراه الطفل.`,
  visual: `الصف الأول (أطفال في السادسة يتعلّمون القراءة الآن):
- كلمات قليلة في كل شريحة أو قسم (خمس كلمات أو أقل في السطر)، وصورة أو رمز يقول أكثر من الكلام.
- فكرة واحدة في كل شريحة أو قسم، وأسئلة يجيب عنها الطفل بالإشارة أو بكلمة؛ لا فقرات ولا قوانين ولا مصطلحات صعبة.`,
};

const BASE_EN: Record<FirstGradeUse, string> = {
  plan: `Grade 1 (six-year-olds who are learning to read and write now):
- Split the lesson into short, concrete activities (3–5 minutes): pictures, objects, cards, movement, songs and games; the teacher speaks to the children in short simple sentences.
- Never ask the children to write a paragraph or sentences of their own, or to fill in a table, an observation sheet or a written exit ticket: writing means copying a letter, word or number or completing a word with a letter; everything else is answered aloud, by pointing, colouring, matching or circling.
- Assessment is the teacher watching each child and asking aloud; homework is a short task done with the family (point, count, colour, copy one line), not a page of writing.`,
  paper: `Grade 1 (six-year-olds who are learning to read now):
- Every question is one short sentence in familiar words, answered with a letter, a word, a number, a choice or True/False.
- No "justify", "compare", "analyse", "explain" or "write a paragraph", no short text to read and then answer on, and no multi-step problem.
- Anything that needs a picture is described in words or drawn with symbols in the question text (★ ★ ★); never refer to "the picture" or "the figure".
- The model answer is a word, a number or a letter, not a sentence.`,
  activity: `Grade 1 (six-year-olds who are learning to read and write now):
- Short, concrete steps the teacher leads: pictures, cards, objects, movement, songs and games; the teacher gives instructions aloud in short sentences.
- No reading texts, no writing sentences or paragraphs, no sheets to fill in: a child points, colours, matches, says, or copies a letter or a word.
- Assessment is the teacher's observation and spoken questions.`,
  classroom: `Grade 1 (six-year-olds who are learning to read now):
- Everything on a slide is a few words the teacher reads aloud, and every question is one short sentence in familiar words.
- The children answer together by pointing, in one voice, with thumbs, or with a word or a number; nothing is written on boards but a letter or a number.
- No "explain", "justify" or "compare", no multi-step problem; anything that needs a picture is drawn with symbols (★ ★ ★) or described by the teacher.`,
  explain: `Grade 1 (six-year-olds who are learning to read now; the teacher reads the screen aloud):
- Everything shown is a very short sentence (five words or fewer) in words a child knows, one idea per slide.
- Explain with concrete examples from the child's life (things to count, pictures the teacher describes), not definitions or hard terms.
- The worked example and the practice are one or two steps with the lesson's own numbers and words, answered with a word or a number; the mistake has one simple error a child can see.`,
  visual: `Grade 1 (six-year-olds who are learning to read now):
- Few words on each slide or section (five words or fewer per line), and a picture or symbol that says more than the words.
- One idea per slide or section, and questions a child answers by pointing or with a word; no paragraphs, formulas or hard terms.`,
};

const SUBJECT_AR: Record<"arabic" | "english" | "mathematics", string> = {
  arabic: `- اللغة العربية في الصف الأول كتاب تهجٍّ: درس الحرف (مثل «حرف الباء») مادته الحرف نفسه — صوته مع الحركات الثلاث والمدود، وأشكاله في أول الكلمة ووسطها وآخرها، وتمييزه في كلمات مألوفة، وتركيب مقاطع وكلمات قصيرة منه، ونسخه — ودرس التنوين أو الشدة مادته علامته وصوتها. لا تبنِ الدرس أو الأسئلة على نص للفهم، واقرأ «أستمع» و«أتحدث» استماعًا لقصة قصيرة يرويها المعلم وحديثًا شفويًا عن صورة.`,
  english: `- اللغة الإنجليزية في الصف الأول: يعرف الطلبة كلمات قليلة؛ استعمل مفردات الدرس وتراكيبه القصيرة فقط مع الصور والأناشيد والاستجابة الجسدية، وإنتاج الطفل كلمة أو عبارة من كلمتين أو ثلاث يقولها أو يشير إليها أو يتتبّعها، لا جملة يكتبها ولا فقرة.`,
  mathematics: `- الرياضيات في الصف الأول: أعداد ضمن مدى الدرس فقط (لا تتجاوز ما يدرسه الدرس، ولا أكثر من 99 في أي حال)، وعدّ أشياء محسوسة، بلا ضرب أو قسمة أو كسور عشرية أو أعداد سالبة.`,
};

const SUBJECT_EN: Record<"arabic" | "english" | "mathematics", string> = {
  arabic: `- Grade 1 Arabic is a primer: a letter lesson (such as «حرف الباء») is about the letter itself — its sound with the three short vowels and the long vowels, its forms at the start, middle and end of a word, spotting it in familiar words, building short syllables and words with it, and copying it — and a tanween or shadda lesson is about that mark and its sound. Do not build the lesson or the questions on a text to comprehend; read «أستمع» and «أتحدث» as listening to a short story the teacher tells and talking aloud about a picture.`,
  english: `- Grade 1 English: the children know only a few words; use only the lesson's words and short chunks, with pictures, songs and total physical response; a child produces a word or a two- or three-word chunk by saying, pointing or tracing it — never a written sentence or paragraph.`,
  mathematics: `- Grade 1 mathematics: numbers only within the lesson's range (never beyond what the lesson teaches, and never above 99), counting concrete objects, no multiplication, division, decimals or negative numbers.`,
};

const SECOND_OVERRIDE_AR = "هذا البند خاص بالصف الثاني، وهو يحلّ محلّ أي مطلب أعلاه لا يناسب طفلًا في السابعة (فقرة مكتوبة، تلخيص، تعليل أو تحليل، تجربة مضبوطة، بطاقة خروج مكتوبة)؛ ويبقى ما سواه.";
const SECOND_OVERRIDE_EN = "This section is for Grade 2 and replaces anything above that does not fit a seven-year-old (a written paragraph, a summary, justifying or analysing, a controlled experiment, a written exit ticket); everything else above still applies.";

const SECOND_BASE_AR: Record<FirstGradeUse, string> = {
  plan: `الصف الثاني (أطفال في السابعة يقرؤون نصوصًا قصيرة ويكتبون جملًا قصيرة):
- قسّم الحصة إلى نشاطات قصيرة (5-8 دقائق) محسوسة: صور وبطاقات ومجسّمات وحركة وألعاب، وكلام المعلم للطلبة جمل قصيرة واضحة.
- القراءة نص قصير من الكتاب يقرؤه الطلبة جهرًا، والكتابة كلمات أو جملة قصيرة أو جملتان من إنتاج الطفل؛ لا فقرات ولا تلخيص ولا ملء جداول أو أوراق ملاحظات ولا بطاقة خروج مكتوبة.
- لا تعليل ولا مقارنة مجرّدة ولا تحليل ولا تجربة مضبوطة؛ الأسئلة «من؟ أين؟ ماذا؟ لماذا؟» يُجاب عنها بجملة قصيرة.
- التقييم ملاحظة المعلم وسؤاله الشفوي وما يكتبه الطفل من كلمات أو جملة، والواجب البيتي مهمة قصيرة مع الأسرة (يقرأ، يحكي، يكتب جملتين)، لا صفحة كتابة.`,
  paper: `الصف الثاني (أطفال في السابعة يقرؤون نصوصًا قصيرة):
- كل سؤال جملة قصيرة بكلمات مألوفة، يُجاب عنه بكلمة أو عدد أو اختيار أو صح/خطأ أو جملة قصيرة واحدة.
- لا أسئلة «علّل» أو «حلّل» أو «اكتب فقرة»؛ ونص القراءة إن وُجد جمل قليلة قصيرة، وأسئلته عمّا فيه صراحة (من؟ أين؟ ماذا؟).
- المسألة خطوة أو خطوتان على الأكثر بأعداد الدرس.
- ما يحتاج صورة صِفه بالكلمات أو ارسمه برموز في نص السؤال (★ ★ ★)، ولا تشر إلى «الصورة» أو «الشكل».
- الإجابة النموذجية كلمة أو عدد أو جملة قصيرة.`,
  activity: `الصف الثاني (أطفال في السابعة يقرؤون نصوصًا قصيرة ويكتبون جملًا قصيرة):
- خطوات قصيرة محسوسة يقودها المعلم: صور وبطاقات ومجسّمات وحركة وألعاب، وتعليمات المعلم جمل قصيرة يقولها بصوته.
- يقرأ الطفل جملًا قصيرة ويكتب كلمات أو جملة قصيرة؛ لا فقرات ولا أوراق عمل طويلة ولا تلخيص ولا دفاع عن رأي.
- التقييم ملاحظة المعلم وسؤاله الشفوي.`,
  classroom: `الصف الثاني (أطفال في السابعة يقرؤون نصوصًا قصيرة):
- ما على الشريحة جمل قصيرة يقرؤها الطلبة مع المعلم، وكل سؤال جملة قصيرة بكلمات مألوفة.
- يجيب الطلبة معًا بالإشارة أو بصوت واحد أو برفع الإبهام أو بكلمة أو عدد يكتبونه على ألواحهم؛ لا جمل طويلة تُكتب.
- لا «اشرح» ولا «علّل»، والمسألة خطوة أو خطوتان على الأكثر.`,
  explain: `الصف الثاني (أطفال في السابعة يقرؤون نصوصًا قصيرة):
- كل ما يُعرض جمل قصيرة (ثماني كلمات أو أقل) بكلمات يعرفها الطفل، وفكرة واحدة في كل شريحة.
- الشرح بأمثلة محسوسة من حياة الطفل، لا تعريفات مجرّدة ولا مصطلحات صعبة غير مصطلحات الدرس.
- المثال المحلول والتدريب خطوة أو خطوتان بأعداد الدرس وكلماته، والحلّ الخاطئ فيه خطأ واحد بسيط.`,
  visual: `الصف الثاني (أطفال في السابعة يقرؤون نصوصًا قصيرة):
- كلمات قليلة في كل شريحة أو قسم (ثماني كلمات أو أقل في السطر)، وصورة أو رمز يوضّح الفكرة.
- فكرة واحدة في كل شريحة أو قسم؛ لا فقرات ولا قوانين ولا مصطلحات صعبة.`,
};

const SECOND_BASE_EN: Record<FirstGradeUse, string> = {
  plan: `Grade 2 (seven-year-olds who read short texts and write short sentences):
- Split the lesson into short, concrete activities (5–8 minutes): pictures, cards, objects, movement and games; the teacher speaks in short, clear sentences.
- Reading is a short text from the book the children read aloud; writing is words or one or two short sentences of the child's own. No paragraphs, no summaries, no tables, observation sheets or written exit tickets.
- No justifying, abstract comparing, analysing or controlled experiments; "who? where? what? why?" questions are answered in a short sentence.
- Assessment is the teacher watching, asking aloud and reading the words or sentence a child writes; homework is a short task with the family (read, retell, write two sentences), not a page of writing.`,
  paper: `Grade 2 (seven-year-olds who read short texts):
- Every question is a short sentence in familiar words, answered with a word, a number, a choice, True/False or one short sentence.
- No "justify", "analyse" or "write a paragraph"; a reading text, if any, is a few short sentences, and its questions ask what it says (who? where? what?).
- A problem is one or two steps at most, with the lesson's numbers.
- Anything that needs a picture is described in words or drawn with symbols in the question text (★ ★ ★); never refer to "the picture" or "the figure".
- The model answer is a word, a number or a short sentence.`,
  activity: `Grade 2 (seven-year-olds who read short texts and write short sentences):
- Short, concrete steps the teacher leads: pictures, cards, objects, movement and games; the teacher gives instructions aloud in short sentences.
- A child reads short sentences and writes words or a short sentence; no paragraphs, long worksheets, summaries or defending an opinion.
- Assessment is the teacher's observation and spoken questions.`,
  classroom: `Grade 2 (seven-year-olds who read short texts):
- A slide holds short sentences the children read with the teacher, and every question is a short sentence in familiar words.
- The children answer together by pointing, in one voice, with thumbs, or with a word or number they write on their boards; no long sentences to write.
- No "explain" or "justify"; a problem is one or two steps at most.`,
  explain: `Grade 2 (seven-year-olds who read short texts):
- Everything shown is a short sentence (eight words or fewer) in words a child knows, one idea per slide.
- Explain with concrete examples from the child's life, not abstract definitions or hard terms beyond the lesson's own.
- The worked example and the practice are one or two steps with the lesson's numbers and words; the mistake has one simple error.`,
  visual: `Grade 2 (seven-year-olds who read short texts):
- Few words on each slide or section (eight words or fewer per line), and a picture or symbol that shows the idea.
- One idea per slide or section; no paragraphs, formulas or hard terms.`,
};

const SECOND_SUBJECT_AR: Record<"arabic" | "english" | "mathematics", string> = {
  arabic: `- اللغة العربية في الصف الثاني مقسّمة إلى «أستمع» و«أتحدث» و«أقرأ» و«أكتب» و«أبني لغتي»: درس «أقرأ» نص قصير من الكتاب (عنوانه بين القوسين) يقرؤه الطلبة جهرًا ويُسألون عمّا فيه، ودرس «أكتب» قاعدة إملائية (بين القوسين) يميّزها الطفل في كلمات ويكتب بها كلمات وجملة قصيرة، و«أبني لغتي» نمط لغوي تُبنى عليه جمل قصيرة. لا تحليل للنص ولا فقرات.`,
  english: `- اللغة الإنجليزية في الصف الثاني: مفردات الدرس وتراكيبه القصيرة مع الصور والأناشيد؛ ينتج الطفل كلمة أو جملة قصيرة على نمط الدرس يقولها أو ينسخها، لا فقرة.`,
  mathematics: `- الرياضيات في الصف الثاني: أعداد ضمن مدى الدرس (لا تتجاوز 999)، وجمع وطرح ضمن ثلاث منازل، وضرب وقسمة في حقائق 2 و3 و4 و5 و10 فقط حين يدرسها الدرس، وكسور الوحدة البسيطة؛ بلا كسور عشرية ولا أعداد سالبة.`,
};

const SECOND_SUBJECT_EN: Record<"arabic" | "english" | "mathematics", string> = {
  arabic: `- Grade 2 Arabic runs in the book's strands «أستمع», «أتحدث», «أقرأ», «أكتب» and «أبني لغتي»: an «أقرأ» lesson is a short text from the book (its title in brackets) the children read aloud and are asked about; an «أكتب» lesson is a spelling rule (in brackets) the child spots in words and uses to write words and a short sentence; «أبني لغتي» is a language pattern for building short sentences. No analysing the text, no paragraphs.`,
  english: `- Grade 2 English: the lesson's words and short structures, with pictures and songs; a child produces a word or a short sentence on the lesson's pattern by saying or copying it — never a paragraph.`,
  mathematics: `- Grade 2 mathematics: numbers within the lesson's range (never above 999), adding and subtracting within three places, multiplying and dividing only by the 2, 3, 4, 5 and 10 facts when the lesson teaches them, and simple unit fractions; no decimals or negative numbers.`,
};

const THIRD_OVERRIDE_AR = "هذا البند خاص بالصف الثالث، وهو يحلّ محلّ أي مطلب أعلاه لا يناسب طفلًا في الثامنة (فقرة مكتوبة طويلة، تلخيص، مناظرة أو دفاع عن ادّعاء، تجربة مضبوطة بمتغيرات، بطاقة خروج مكتوبة)؛ ويبقى ما سواه.";
const THIRD_OVERRIDE_EN = "This section is for Grade 3 and replaces anything above that does not fit an eight-year-old (a long written paragraph, a summary, a debate or defending a claim, a controlled experiment with variables, a written exit ticket); everything else above still applies.";

const THIRD_BASE_AR: Record<FirstGradeUse, string> = {
  plan: `الصف الثالث (أطفال في الثامنة يقرؤون نصًا قصيرًا ويكتبون جملتين أو ثلاثًا):
- نشاطات قصيرة (7-10 دقائق) يبدأ فيها المعلم بنموذج، ثم يعمل الطلبة معًا، ثم وحدهم؛ بأدوات محسوسة وصور ورسوم وألعاب حيث تفيد، وكلام المعلم جمل واضحة.
- القراءة نص قصير من الكتاب يقرؤه الطلبة جهرًا ويجيبون عن أسئلته، والكتابة جملتان أو ثلاث جمل من إنتاج الطفل؛ لا فقرات طويلة ولا تلخيص ولا بطاقة خروج مكتوبة.
- سؤال «لماذا؟» يُجاب عنه بجملة تبدأ بـ«لأنّ…»، والتوقع البسيط ثم الملاحظة مناسبان؛ لا مناظرة ولا دفاع عن ادّعاء ولا تجربة مضبوطة بمتغيرات.
- التقييم ملاحظة المعلم وسؤاله الشفوي وما يحلّه الطفل أو يكتبه في دفتره، والواجب البيتي قصير (ثلاثة أمثلة أو جملتان أو ثلاث)، لا صفحة كتابة.`,
  paper: `الصف الثالث (أطفال في الثامنة يقرؤون نصوصًا قصيرة):
- كل سؤال جملة أو جملتان بكلمات مألوفة، يُجاب عنه بعدد أو كلمة أو اختيار أو صح/خطأ أو جملة أو جملتين.
- «لماذا؟» يُجاب عنها بجملة واحدة؛ لا «حلّل» ولا «اكتب فقرة» ولا «لخّص»، ونص القراءة إن وُجد فقرة قصيرة وأسئلته عمّا فيه.
- المسألة خطوتان على الأكثر بأعداد الدرس.
- ما يحتاج صورة صِفه بالكلمات أو ارسمه برموز في نص السؤال، ولا تشر إلى «الصورة» أو «الشكل».
- الإجابة النموذجية عدد أو كلمة أو جملة أو جملتان.`,
  activity: `الصف الثالث (أطفال في الثامنة يقرؤون نصوصًا قصيرة ويكتبون جملتين أو ثلاثًا):
- خطوات قصيرة يقودها المعلم بنموذج: أدوات محسوسة وصور وبطاقات وحركة وألعاب، وتعليمات المعلم جمل واضحة.
- يقرأ الطفل جملًا ونصًا قصيرًا ويكتب جملتين أو ثلاثًا على الأكثر؛ لا فقرات ولا أوراق عمل طويلة ولا تلخيص ولا مناظرة ولا رهان على النقاط.
- التقييم ملاحظة المعلم وسؤاله الشفوي وما يكتبه الطفل على لوحه أو في دفتره.`,
  classroom: `الصف الثالث (أطفال في الثامنة يقرؤون نصوصًا قصيرة):
- ما على الشريحة جمل قصيرة، وكل سؤال جملة أو جملتان بكلمات مألوفة.
- يجيب الطلبة معًا برفع الإبهام أو بصوت واحد أو بعدد أو كلمة أو جملة قصيرة يكتبونها على ألواحهم.
- لا «اشرح بكلماتك» ولا «علّل» كتابةً، والمسألة خطوتان على الأكثر.`,
  explain: `الصف الثالث (أطفال في الثامنة يقرؤون نصوصًا قصيرة):
- كل ما يُعرض جمل قصيرة (عشر كلمات أو أقل) بكلمات يعرفها الطفل، وفكرة واحدة في كل شريحة.
- الشرح بأمثلة من حياة الطفل ونماذج ورسوم (مصفوفة، خط أعداد، شكل)، لا تعريفات مجرّدة.
- المثال المحلول والتدريب خطوتان على الأكثر بأعداد الدرس وكلماته، والحلّ الخاطئ فيه خطأ واحد بسيط.`,
  visual: `الصف الثالث (أطفال في الثامنة يقرؤون نصوصًا قصيرة):
- كلمات قليلة في كل شريحة أو قسم (عشر كلمات أو أقل في السطر)، وصورة أو رسم يوضّح الفكرة.
- فكرة واحدة في كل شريحة أو قسم؛ لا فقرات ولا مصطلحات صعبة غير مصطلحات الدرس.`,
};

const THIRD_BASE_EN: Record<FirstGradeUse, string> = {
  plan: `Grade 3 (eight-year-olds who read a short text and write two or three sentences):
- Short activities (7–10 minutes): the teacher models, the children work together, then alone; concrete materials, pictures, drawings and games where they help, and the teacher speaks in clear sentences.
- Reading is a short text from the book the children read aloud and answer questions on; writing is two or three sentences of the child's own. No long paragraphs, summaries or written exit tickets.
- "Why?" is answered in one sentence starting "Because…", and a simple prediction checked by observing is fine; no debates, defending a claim or controlled experiments with variables.
- Assessment is the teacher watching, asking aloud and reading what a child solves or writes in the notebook; homework is short (three examples, or two or three sentences), not a page of writing.`,
  paper: `Grade 3 (eight-year-olds who read short texts):
- Every question is one or two sentences in familiar words, answered with a number, a word, a choice, True/False, or one or two sentences.
- "Why?" is answered in one sentence; no "analyse", "write a paragraph" or "summarise"; a reading text, if any, is a short paragraph and its questions ask what it says.
- A problem is two steps at most, with the lesson's numbers.
- Anything that needs a picture is described in words or drawn with symbols in the question text; never refer to "the picture" or "the figure".
- The model answer is a number, a word, or one or two sentences.`,
  activity: `Grade 3 (eight-year-olds who read short texts and write two or three sentences):
- Short steps the teacher leads with a model: concrete materials, pictures, cards, movement and games; the teacher gives instructions in clear sentences.
- A child reads sentences and a short text and writes two or three sentences at most; no paragraphs, long worksheets, summaries, debates or betting points.
- Assessment is the teacher's observation, spoken questions and what a child writes on a board or in the notebook.`,
  classroom: `Grade 3 (eight-year-olds who read short texts):
- A slide holds short sentences, and every question is one or two sentences in familiar words.
- The children answer together with thumbs, in one voice, or with a number, word or short sentence on their boards.
- No "explain in your own words" or written "justify"; a problem is two steps at most.`,
  explain: `Grade 3 (eight-year-olds who read short texts):
- Everything shown is a short sentence (ten words or fewer) in words a child knows, one idea per slide.
- Explain with examples from the child's life and with models and drawings (an array, a number line, a shape), not abstract definitions.
- The worked example and the practice are two steps at most with the lesson's numbers and words; the mistake has one simple error.`,
  visual: `Grade 3 (eight-year-olds who read short texts):
- Few words on each slide or section (ten words or fewer per line), and a picture or drawing that shows the idea.
- One idea per slide or section; no paragraphs or hard terms beyond the lesson's own.`,
};

const THIRD_SUBJECT_AR: Record<"arabic" | "english" | "mathematics", string> = {
  arabic: `- اللغة العربية في الصف الثالث مقسّمة إلى «أستمع» و«أتحدث» و«أقرأ» و«أكتب» و«أبني لغتي»: درس «أقرأ» نص قصير من الكتاب (عنوانه بين القوسين) يقرؤه الطلبة جهرًا ويجيبون عن أسئلته بجمل، ودرس «أكتب» قاعدة إملائية أو علامة ترقيم (بين القوسين) يكتب بها الطفل كلمات وجملتين، و«أبني لغتي» نمط لغوي تُبنى عليه جمل. لا تحليل أدبي للنص ولا فقرات طويلة.`,
  english: `- اللغة الإنجليزية في الصف الثالث: مفردات الدرس وتراكيبه القصيرة مع الصور والأناشيد؛ يقرأ الطفل كلمات وجملًا قصيرة ويكتب كلمة أو جملة قصيرة على نمط الدرس، لا فقرة.`,
  mathematics: `- الرياضيات في الصف الثالث: أعداد ضمن مدى الدرس (لا تتجاوز 9999)، وجمع وطرح ضمن أربع منازل، وحقائق الضرب والقسمة حتى 10، وضرب عدد من منزلتين أو ثلاث في عدد من منزلة واحدة وقسمته عليه حين يدرسها الدرس، وكسور بسيطة (جزء من كل أو من مجموعة)؛ بلا كسور عشرية ولا أعداد سالبة.`,
};

const THIRD_SUBJECT_EN: Record<"arabic" | "english" | "mathematics", string> = {
  arabic: `- Grade 3 Arabic runs in the book's strands «أستمع», «أتحدث», «أقرأ», «أكتب» and «أبني لغتي»: an «أقرأ» lesson is a short text from the book (its title in brackets) the children read aloud and answer questions on in sentences; an «أكتب» lesson is a spelling rule or punctuation mark (in brackets) the child uses to write words and two sentences; «أبني لغتي» is a language pattern for building sentences. No literary analysis of the text, no long paragraphs.`,
  english: `- Grade 3 English: the lesson's words and short structures, with pictures and songs; a child reads words and short sentences and writes a word or a short sentence on the lesson's pattern — never a paragraph.`,
  mathematics: `- Grade 3 mathematics: numbers within the lesson's range (never above 9999), adding and subtracting within four places, multiplication and division facts to 10, multiplying and dividing a two- or three-digit number by a one-digit number when the lesson teaches it, and simple fractions (part of a whole or of a set); no decimals or negative numbers.`,
};

/** An activity's format, as the prompt reads it (`activityFormatKey` in prompts.ts). */
function activityFormat(b: GradeFields & { activityType?: unknown; activityVariant?: unknown }): string {
  return b.activityVariant === "warmup" ? "warmup" : typeof b.activityType === "string" ? b.activityType : "group";
}

/**
 * The format line for a Grade 1 activity. Small groups only where the format
 * is group work; an individual or a whole-class discussion keeps its own shape
 * (its rule in `ACTIVITY_FORMAT_RULES_*` must not be overridden into groups).
 */
const GROUPED = new Set(["group", "hands-on", "game"]);
const groupLineAr = (b: GradeFields) => (GROUPED.has(activityFormat(b)) ? "\n- مجموعات صغيرة (2-4) بدور واحد واضح لكل طفل." : "");
const groupLineEn = (b: GradeFields) => (GROUPED.has(activityFormat(b)) ? "\n- Small groups (2–4) with one clear job per child." : "");

/**
 * `ifLesson`: the request's grade is only what the teacher usually teaches (Prompt
 * Slides, whose description may be a parents' meeting), so the clause applies only
 * when the deck is a lesson for that class.
 */
type ClauseOptions = { ifLesson?: boolean };

/** Which early grade a request is for: 1, 2, 3, or null for any other. */
export function clauseGradeOf(b: GradeFields): 1 | 2 | 3 | null {
  return isFirstGrade(b) ? 1 : isSecondGrade(b) ? 2 : isThirdGrade(b) ? 3 : null;
}

const CLAUSE_AR = {
  1: [BASE_AR, SUBJECT_AR, OVERRIDE_AR],
  2: [SECOND_BASE_AR, SECOND_SUBJECT_AR, SECOND_OVERRIDE_AR],
  3: [THIRD_BASE_AR, THIRD_SUBJECT_AR, THIRD_OVERRIDE_AR],
} as const;
const CLAUSE_EN = {
  1: [BASE_EN, SUBJECT_EN, OVERRIDE_EN],
  2: [SECOND_BASE_EN, SECOND_SUBJECT_EN, SECOND_OVERRIDE_EN],
  3: [THIRD_BASE_EN, THIRD_SUBJECT_EN, THIRD_OVERRIDE_EN],
} as const;

export function firstGradeClauseAr(b: GradeFields, use: FirstGradeUse, opts: ClauseOptions = {}): string {
  const grade = clauseGradeOf(b);
  if (!grade) return "";
  const subject = subjectOf(b);
  const group = use === "activity" ? groupLineAr(b) : "";
  const lead = opts.ifLesson ? "\nإن كان العرض درسًا أو مراجعة لطلبة هذا الصف، فالتزم بما يأتي:" : "";
  const [base, subjects, override] = CLAUSE_AR[grade];
  return `${lead}\n${base[use]}${group}${subject ? `\n${subjects[subject]}` : ""}\n${override}`;
}

export function firstGradeClauseEn(b: GradeFields, use: FirstGradeUse, opts: ClauseOptions = {}): string {
  const grade = clauseGradeOf(b);
  if (!grade) return "";
  const subject = subjectOf(b);
  const group = use === "activity" ? groupLineEn(b) : "";
  const lead = opts.ifLesson ? "\nIf the deck is a lesson or a review for this class, follow this:" : "";
  const [base, subjects, override] = CLAUSE_EN[grade];
  return `${lead}\n${base[use]}${group}${subject ? `\n${subjects[subject]}` : ""}\n${override}`;
}

/**
 * How each question type a Grade 1 evaluation may hold looks for a six-year-old
 * (`FIRST_GRADE_EVALUATION_TYPES` in `@workspace/exam-paper`). The evaluation
 * prompt lists the lines for the paper's own types, after the "paper" clause.
 */
export const FIRST_GRADE_TYPE_NOTES_EN: Readonly<Record<string, string>> = {
  multiple_choice: "multiple_choice: three options, each a letter, a word, a number or a group of symbols (★ ★ ★); the teacher reads the question aloud.",
  true_false: "true_false: one short sentence the teacher reads aloud.",
  matching: "matching: three or four pairs, each side a letter, a word, a number or a group of symbols.",
  fill_blank: "fill_blank: the blank takes one letter, one word or one number, never a phrase.",
  practical_task: "practical_task: something the child does with objects while the teacher watches (count out 7 counters, point to the triangle, sort the cards); the teacher marks it.",
};

/** The type lines for a Grade 1 evaluation of these types; empty when none applies. */
export function firstGradeTypeNotesEn(types: readonly string[]): string {
  const lines = types.map(t => FIRST_GRADE_TYPE_NOTES_EN[t]).filter((x): x is string => !!x);
  return lines.length ? ["In this Grade 1 paper each type looks like this:", ...lines.map(l => `- ${l}`)].join("\n") : "";
}

/**
 * What a difficulty level means for a Grade 1 paper. The all-grades meanings
 * ask for two or three steps at medium and for analysis at hard, which the
 * Grade 1 clause forbids; here a level moves within the lesson's own range and
 * stays one step (Grade 1 sweep, 2026-11-13). The offline generators do the
 * same (`firstGradeDifficulty.ts` in `@workspace/math-practice`).
 */
export const FIRST_GRADE_DIFFICULTY_AR: Readonly<Record<string, string>> = {
  easy: "سؤال مباشر من خطوة واحدة: تعرّف أو عدّ أو اختيار، بأصغر أعداد الدرس وأكثر كلماته ألفة.",
  medium: "خطوة واحدة على مدى الدرس كله، بصيغة أخرى للسؤال أحيانًا (العدد أو الحرف المفقود، الترتيب، ما قبل وما بعد).",
  hard: "أكبر أعداد الدرس أو أقل كلماته ألفة، أو عدد أو حرف مفقود، أو قصة قصيرة من خطوة واحدة، أو مقارنة بين شيئين — دون تبرير أو تحليل أو خطوات متعددة، ودون الخروج عن مدى الدرس.",
  mixed: "وزّع الأسئلة على المستويات الثلاثة (سهل / متوسط / صعب)، وكلها من خطوة واحدة ضمن مدى الدرس.",
};

export const FIRST_GRADE_DIFFICULTY_EN: Readonly<Record<string, string>> = {
  easy: "A direct one-step question — recognise, count or choose — with the lesson's smallest numbers and most familiar words.",
  medium: "One step over the lesson's whole range, sometimes asked another way (the missing number or letter, order, before and after).",
  hard: "The lesson's largest numbers or least familiar words, a missing number or letter, a short one-step story, or comparing two things — never a justification, an analysis or several steps, and never past the lesson's range.",
  mixed: "Spread the questions across the three levels, every one a single step within the lesson's range.",
};

/** An evaluation's levels, for a Grade 1 paper (`DIFFICULTY_NOTE` in `llmGenerator.ts` for every other grade). */
export const FIRST_GRADE_EVALUATION_DIFFICULTY_EN: Readonly<Record<string, string>> = {
  basic: FIRST_GRADE_DIFFICULTY_EN.easy!,
  standard: FIRST_GRADE_DIFFICULTY_EN.medium!,
  advanced: FIRST_GRADE_DIFFICULTY_EN.hard!,
};
