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
 */

export type FirstGradeUse = "plan" | "paper" | "activity";

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

export function firstGradeClauseAr(b: GradeFields, use: FirstGradeUse): string {
  if (!isFirstGrade(b)) return "";
  const subject = subjectOf(b);
  const group = use === "activity" ? groupLineAr(b) : "";
  return `\n${BASE_AR[use]}${group}${subject ? `\n${SUBJECT_AR[subject]}` : ""}\n${OVERRIDE_AR}`;
}

export function firstGradeClauseEn(b: GradeFields, use: FirstGradeUse): string {
  if (!isFirstGrade(b)) return "";
  const subject = subjectOf(b);
  const group = use === "activity" ? groupLineEn(b) : "";
  return `\n${BASE_EN[use]}${group}${subject ? `\n${SUBJECT_EN[subject]}` : ""}\n${OVERRIDE_EN}`;
}
