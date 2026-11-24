/**
 * The offline lesson plan for a Grade 1 lesson: six-year-olds learning to read.
 *
 * Every other plan in this folder is written for a class that reads a text,
 * writes a paragraph and fills in an exit ticket. Swept on 2026-11-13, the
 * Grade 1 «حرف الباء» plan said «أن يكتب الطالب فقرة قصيرة», «يكتب كل طالب فقرة
 * قصيرة (٤–٥ جمل)» and «3-2-1 … يكتب قبل الخروج» — the wrong lesson for a child
 * who is meeting the letter ب that day. A science plan asked first-graders to
 * «design a controlled experiment that changes one variable».
 *
 * So a Grade 1 lesson gets its own plan, every field of it:
 * - short, concrete phases the teacher leads (objects, pictures, songs, movement);
 * - writing is copying a letter, a word or a number, never sentences;
 * - assessment is the teacher watching and asking aloud;
 * - homework is something done with the family, not a page of writing.
 *
 * What the lesson is made of still comes from its kind (`lessonPlanKinds.ts`),
 * and the Arabic book — a primer — splits into letter and mark lessons («حرف
 * الباء (ب)», «تنوين الضمة», «الشدة») and the unit's skill lessons («أستمع»,
 * «أتحدث», «أقرأ», «أكتب», «أبني لغتي»). The teaching style still decides the
 * shape (show → together → alone; explore first; pairs with one job each).
 *
 * The live prompt says the same thing (`artifacts/api-server/src/lib/firstGrade.ts`);
 * change one, change the other. The teacher's text is first person, future,
 * like every plan (`lessonPlanTeacherVoice.test.ts`).
 *
 * **Grade 2 uses it too (since 2026-11-15).** Swept that day, every Grade 2 plan and
 * activity came from the all-grades templates: «اكتب من ذاكرتك — الدفاتر مغلقة», a
 * claim to defend, teams betting points, a controlled experiment for «الصوت وخصائصه».
 * Seven-year-olds read a short text and write words or a short sentence, so a Grade 2
 * lesson gets these plans with three differences (`EarlyGrade`): Arabic is the
 * book's strands built from the lesson's own text or spelling rule (`arabicContent`),
 * a child writes a word or a short sentence where Grade 1 copies one, and the writing
 * limit says so.
 *
 * **And Grade 3 (since 2026-11-20).** Swept that day, all 254 Grade 3 lessons got the same
 * all-grades templates as Grade 2 had, and all 13 science lessons a controlled experiment.
 * Eight-year-olds multiply, divide and read a short book text, so Grade 3 is its own level
 * here: maths, science, social studies and English have Grade 3 content
 * (`thirdGradeContent`) instead of Grade 1's counting and colouring, the Arabic strands
 * write two or three sentences of the child's own, and a child answers in a sentence, not
 * a word or a gesture (`ANSWER`).
 */
import { getBookForLesson, type KBLesson } from '../knowledgeBase.ts';
import type { Lang } from './mathPractice.ts';
import { arPrefixed, type LessonKind } from './lessonPlanKinds.ts';
import { arMinutes } from './lessonPlanTypes.ts';

/** Harakat, tatweel and hamza forms folded, for matching titles. */
const fold = (s: string) =>
  s.replace(/[ً-ْٰـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();

const FIRST_GRADE_NAMES = new Set(['الصف الاول', 'الاول', 'grade 1', 'grade-1', 'first grade', '1']);
const SECOND_GRADE_NAMES = new Set(['الصف الثاني', 'الثاني', 'grade 2', 'grade-2', 'second grade', '2']);
const THIRD_GRADE_NAMES = new Set(['الصف الثالث', 'الثالث', 'grade 3', 'grade-3', 'third grade', '3']);

/** The grades these plans are written for. */
export type EarlyGrade = 1 | 2 | 3;

/**
 * Grade 1, 2 or 3, or null for any other grade. The lesson's own book decides; a typed
 * topic with no lesson falls back to the grade the request names.
 */
export function earlyGradeOf(kb: KBLesson | null, grade?: string): EarlyGrade | null {
  if (kb) {
    const id = getBookForLesson(kb)?.gradeId;
    return id === 'grade-1' ? 1 : id === 'grade-2' ? 2 : id === 'grade-3' ? 3 : null;
  }
  const g = fold(grade ?? '').toLowerCase().replace(/\s+/g, ' ');
  if (!g) return null;
  return FIRST_GRADE_NAMES.has(g) ? 1 : SECOND_GRADE_NAMES.has(g) ? 2 : THIRD_GRADE_NAMES.has(g) ? 3 : null;
}

/** Is this a Grade 1 lesson? (`earlyGradeOf` for Grades 1 to 3.) */
export function isFirstGradeLesson(kb: KBLesson | null, grade?: string): boolean {
  return earlyGradeOf(kb, grade) === 1;
}

type Pair = { ar: string; en: string };

/** What a Grade 1 lesson of one kind is made of — the style wraps it. */
interface Content {
  materials: { ar: string[]; en: string[] };
  intro: Pair;
  /** What the teacher shows and names — a first-person sentence. */
  show: Pair;
  /** What the inquiry style puts in front of the children before naming anything. */
  explore: Pair;
  /** What the class does together — the children in the third person. */
  together: Pair;
  /** What each child does alone: point, colour, match, say, copy. */
  alone: Pair;
  /** One job for each child in a pair. */
  pairRoles: Pair;
  homework: Pair;
  objectives: { ar: string[]; en: string[] };
}

type ArabicLesson =
  | { type: 'letter'; letter: string }
  | { type: 'mark'; mark: string }
  | { type: 'listen' | 'speak' | 'read' | 'write' | 'build' | 'other' };

/** Which kind of Grade 1 Arabic lesson a title is. */
export function arabicLessonType(title: string): ArabicLesson {
  const t = fold(title);
  if (/^حرف/.test(t)) {
    const m = title.match(/\(([^)]+)\)/);
    const letter = (m?.[1] ?? '').split(/[،,]/)[0]!.trim();
    if (letter) return { type: 'letter', letter };
  }
  // The strand comes first: Grade 2's «أكتب (التنوين)» is a spelling lesson, not Grade 1's «تنوين الضمة».
  if (/^استمع/.test(t)) return { type: 'listen' };
  if (/^اتحدث/.test(t)) return { type: 'speak' };
  if (/^اقرا/.test(t)) return { type: 'read' };
  if (/^اكتب/.test(t)) return { type: 'write' };
  if (/^ابني لغتي/.test(t)) return { type: 'build' };
  if (/تنوين|الشده|السكون|الحركات/.test(t)) return { type: 'mark', mark: title.trim() };
  return { type: 'other' };
}

const SURAH = /سوره/;

/** What a Grade 1 or 2 lesson of this kind is made of — shared with the early-grade activities. */
export function firstGradeContent(kind: LessonKind, topic: string, titleAr: string, grade: EarlyGrade = 1): Content {
  return contentFor(kind, topic, titleAr, grade);
}

/**
 * The text in a title's brackets: «أقرأ بطلاقة وفهم (حكايا للوطن)» → «حكايا للوطن». It runs to
 * the last closing bracket, so Grade 3's «أكتب (علامتا الترقيم (:) و(؛))» keeps its marks.
 */
export function titleDetail(title: string): string | null {
  const m = title.match(/\((.+)\)/);
  return m ? m[1]!.trim() : null;
}

/**
 * Grade 2 writes a little where Grade 1 only says or colours: the same activity, plus a
 * word or a short sentence of the child's own.
 */
const SECOND_GRADE_WRITING: Partial<Record<LessonKind, Pair>> = {
  science: { ar: ' ثم يكتب اسم الشيء تحت صورته.', en: ' Then they write the thing’s name under its picture.' },
  social: { ar: ' ثم يكتب جملة قصيرة عنه.', en: ' Then they write one short sentence about it.' },
  recitation: { ar: ' ثم يكتب جملته تحت الصورة.', en: ' Then they write that sentence under the picture.' },
};

/**
 * Grade 3 Islamic education: the shared content, with an eight-year-old's own work — a surah
 * recited and one verse's meaning written in a sentence; any other lesson's two questions
 * answered in sentences — where Grade 1 colours a picture.
 */
function thirdGradeRecitation(c: Content, titleAr: string, topic: string): Content {
  const q = `«${topic}»`;
  const qEn = `“${topic}”`;
  if (SURAH.test(fold(titleAr))) {
    return {
      ...c,
      alone: {
        ar: 'يتلو كل طفل ما حفظه أمامي أو أمام زميله، ثم يكتب في دفتره معنى آية واحدة بجملة من عنده.',
        en: 'Each child recites what they have learned to me or a classmate, then writes the meaning of one verse in a sentence of their own in the notebook.',
      },
      homework: {
        ar: `يتلو الطفل ${q} لأسرته، ويكتب جملتين عمّا تعلّمه من معانيها.`,
        en: `The child recites ${qEn} to the family and writes two sentences about what they learned from its meanings.`,
      },
    };
  }
  return {
    ...c,
    alone: {
      ar: 'يجيب كل طفل في دفتره عن سؤالين من الدرس بجملة لكل منهما، ويكتب سلوكًا واحدًا سيعمل به.',
      en: 'Each child answers two questions from the lesson in their notebook, one sentence each, and writes one thing they will do.',
    },
    homework: {
      ar: `يحكي الطفل لأسرته ما تعلّمه في ${q}، ويكتب جملتين عمّا سيعمل به.`,
      en: `The child tells the family what they learned in ${qEn} and writes two sentences about what they will do.`,
    },
  };
}

function withEarlyWriting(kind: LessonKind, c: Content, titleAr: string, table: Partial<Record<LessonKind, Pair>>): Content {
  const add = table[kind];
  // A surah is recited, not written about.
  if (!add || (kind === 'recitation' && SURAH.test(fold(titleAr)))) return c;
  return { ...c, alone: { ar: c.alone.ar + add.ar, en: c.alone.en + add.en } };
}

export type FirstGradeContent = Content;

function contentFor(kind: LessonKind, topic: string, titleAr: string, grade: EarlyGrade = 1): Content {
  if (grade === 3) {
    const own = thirdGradeContent(kind, topic);
    if (own) return own;
    const c = baseContent(kind, topic, titleAr, grade);
    // Movement and the arts are done, not written: they keep the shared content.
    return kind === 'recitation' ? thirdGradeRecitation(c, titleAr, topic) : c;
  }
  const c = baseContent(kind, topic, titleAr, grade);
  return grade === 2 ? withEarlyWriting(kind, c, titleAr, SECOND_GRADE_WRITING) : c;
}

/**
 * How a child answers the teacher's spoken questions. Grades 1 and 2 answer with a word or
 * by pointing; an eight-year-old answers in a sentence.
 */
export const ANSWER: Record<EarlyGrade, Pair> = {
  1: { ar: 'بكلمة أو بإشارة', en: 'with a word or by pointing' },
  2: { ar: 'بكلمة أو بإشارة', en: 'with a word or by pointing' },
  3: { ar: 'بجملة قصيرة', en: 'in a short sentence' },
};

/**
 * Grade 3's own content for the kinds where Grade 1's is too young: an eight-year-old
 * multiplies and divides, reads a short text and writes two or three sentences, so maths is
 * models, then numbers on a small board; science observes, predicts and records in a simple
 * table (never a controlled experiment or a variable); social studies reads a picture, a map
 * or the book's short text; English reads and writes words and a short sentence. Arabic,
 * Islamic education, movement and the arts keep the shared content (Arabic with Grade 3
 * writing, see `secondGradeArabic`).
 */
function thirdGradeContent(kind: LessonKind, topic: string): Content | null {
  const q = `«${topic}»`;
  const qEn = `“${topic}”`;
  switch (kind) {
    case 'calc':
      return {
        materials: {
          ar: ['أدوات محسوسة تناسب الدرس (قطع العشرات والمئات، أو أزرار لمصفوفة، أو أشكال ومسطرة، أو شرائط كسور)', 'لوح صغير وقلم لكل طفل', 'السبورة وأقلام ملوّنة', 'كتاب الطالب'],
          en: ['Concrete materials for the lesson (tens and hundreds blocks, buttons for an array, shapes and a ruler, or fraction strips)', 'A small board and pen for each child', 'Board and coloured markers', 'Student book'],
        },
        intro: {
          ar: `سأبدأ بمسألة قصيرة من حياة الأطفال تتصل ${arPrefixed('ب', topic)} (في السوق أو في المدرسة أو في البيت)، وأسأل: «كيف نعرف الجواب؟» وأستمع إلى طريقتين.`,
          en: `I will open with a short problem from the children’s lives linked to ${topic} (at the shop, at school or at home) and ask: “How can we find out?”, listening to two ways.`,
        },
        show: {
          ar: `سأحلّ مثالًا على ${q} أمام الأطفال بالأدوات أو بالرسم (مصفوفة أو خط أعداد أو شكل)، ثم أكتب الخطوات نفسها بالأرقام على السبورة وأنا أقول كل خطوة بصوت واضح.`,
          en: `I will work an example of ${qEn} in front of the children with the materials or a drawing (an array, a number line or a shape), then write the same steps in numbers on the board, saying each step aloud.`,
        },
        explore: { ar: 'أدوات محسوسة ومسألة قصيرة من الدرس', en: 'concrete materials and a short problem from the lesson' },
        together: {
          ar: 'نحلّ معًا مثالين: يقترح الأطفال الخطوة التالية، ويمثّلها أحدهم بالأدوات أو بالرسم ويكتبها آخر بالأرقام على السبورة، ثم نتحقق من الناتج معًا.',
          en: 'We work two examples together: the children suggest the next step, one shows it with the materials or a drawing and another writes it in numbers on the board, then we check the answer together.',
        },
        alone: {
          ar: 'يحلّ كل طفل على لوحه ثلاثة أمثلة أكتبها على السبورة، ويرسم لأحدها مصفوفة أو خط أعداد أو شكلًا يبيّن طريقته، ويرفع لوحه بعد كل مثال.',
          en: 'Each child solves three examples I write on the board on their small board, draws an array, a number line or a shape for one of them to show how, and holds the board up after each one.',
        },
        pairRoles: { ar: 'طفل يمثّل المثال بالأدوات أو بالرسم، وصاحبه يكتبه بالأرقام ويتحقق من الناتج', en: 'one child shows the example with materials or a drawing, the other writes it in numbers and checks the answer' },
        homework: {
          ar: `يحلّ الطفل ثلاثة أمثلة من كتابه على ${q}، ويكتب مسألة قصيرة من حياته عليه ويحلّها.`,
          en: `The child solves three examples of ${qEn} from the book and writes and solves one short problem about it from their own life.`,
        },
        objectives: {
          ar: [`أن يمثّل الطفل ${q} بالأدوات أو بالرسم ثم بالأرقام`, `أن يحلّ الطفل أمثلة على ${q} ويتحقق من ناتجها`, 'أن يحلّ الطفل مسألة قصيرة من حياته اليومية'],
          en: [`The child will show ${qEn} with materials or a drawing, then in numbers`, `The child will solve examples of ${qEn} and check the answers`, 'The child will solve a short problem from daily life'],
        },
      };
    case 'science':
      return {
        materials: {
          ar: ['أشياء حقيقية أو صور كبيرة من الدرس', 'عدسة مكبّرة وأدوات بسيطة حسب الدرس', 'جدول ملاحظة بسيط من عمودين', 'كتاب الطالب'],
          en: ['Real objects or large pictures from the lesson', 'A magnifying glass and simple tools for the lesson', 'A simple two-column observation table', 'Student book'],
        },
        intro: {
          ar: `سأحضر إلى الصف شيئًا حقيقيًا أو صورة تتصل ${arPrefixed('ب', topic)}، وأسأل: «ماذا تلاحظون؟ ماذا تتوقعون أن يحدث؟»`,
          en: `I will bring in a real object or a picture linked to ${topic} and ask: “What do you notice? What do you think will happen?”`,
        },
        show: {
          ar: `سأعرض ${q} بأشياء حقيقية أو صور أو نشاط قصير أؤدّيه أمام الأطفال، وأسمّي كل جزء أو مرحلة، وأكتب الكلمات الجديدة على السبورة.`,
          en: `I will show ${qEn} with real objects, pictures or a short activity I do in front of the children, naming each part or stage and writing the new words on the board.`,
        },
        explore: { ar: 'أشياء حقيقية أو صورًا تتصل بالدرس', en: 'real objects or pictures linked to the lesson' },
        together: {
          ar: 'نتوقع معًا ماذا سيحدث، ثم نلاحظ ونجرّب بأدوات بسيطة، ونسجّل ما لاحظناه في جدول من عمودين على السبورة، ونقارن ما حدث بتوقعنا.',
          en: 'We predict together what will happen, then observe and try it with simple tools, record what we saw in a two-column table on the board, and compare it with our prediction.',
        },
        alone: {
          ar: 'يصنّف كل طفل الصور أو يصلها في كتابه، ويكتب جملتين عمّا لاحظه، إحداهما تبدأ بـ«لأنّ…».',
          en: 'Each child sorts or matches the pictures in the book and writes two sentences about what they noticed, one starting “Because…”.',
        },
        pairRoles: { ar: 'طفل يلاحظ ويصف، وصاحبه يسجّل في الجدول', en: 'one child observes and describes, the other records in the table' },
        homework: {
          ar: `يلاحظ الطفل في البيت أو الحديقة شيئًا يتصل ${arPrefixed('ب', topic)}، ويكتب عنه جملتين في دفتره.`,
          en: `The child observes something at home or in the garden linked to ${topic} and writes two sentences about it in the notebook.`,
        },
        objectives: {
          ar: [`أن يلاحظ الطفل ما يتصل ${arPrefixed('ب', topic)} ويصفه بجمل قصيرة`, 'أن يتوقع الطفل ما سيحدث ويقارن توقعه بما لاحظه', 'أن يسجّل الطفل ملاحظته في جدول بسيط'],
          en: [`The child will observe what is linked to ${topic} and describe it in short sentences`, 'The child will predict what will happen and compare it with what they see', 'The child will record an observation in a simple table'],
        },
      };
    case 'social':
      return {
        materials: {
          ar: ['صور أو خريطة بسيطة من الدرس', 'كتاب الطالب', 'بطاقات كلمات الدرس', 'دفتر لكل طفل'],
          en: ['Pictures or a simple map from the lesson', 'Student book', 'Cards with the lesson words', 'A notebook for each child'],
        },
        intro: {
          ar: `سأبدأ بصورة أو بخريطة من درس ${q}، وأسأل: «ماذا ترون؟ أين رأيتم مثل هذا؟»`,
          en: `I will open with a picture or a map linked to ${topic} and ask: “What do you see? Where have you seen something like this?”`,
        },
        show: {
          ar: `سأقرأ مع الأطفال الجمل القصيرة عن ${q} في كتابهم، وأعرض صورها أو أشير إليها على الخريطة، وأكتب الكلمات الجديدة على السبورة.`,
          en: `I will read the short sentences about ${qEn} in the book with the children, show their pictures or point to them on the map, and write the new words on the board.`,
        },
        explore: { ar: 'صورًا أو خريطة بسيطة من الدرس', en: 'pictures or a simple map from the lesson' },
        together: {
          ar: 'يتحدث الأطفال عن تجاربهم بجمل قصيرة، ونصنّف معًا صورًا أو أمثلة في عمودين على السبورة، ويمثّل بعضهم موقفًا من الدرس.',
          en: 'The children talk about their own experience in short sentences; we sort pictures or examples into two columns on the board, and some act out a situation from the lesson.',
        },
        alone: {
          ar: 'يجيب كل طفل في دفتره عن سؤالين من الدرس بجملة لكل منهما، ويرسم ما يدل على أحدهما.',
          en: 'Each child answers two questions from the lesson in their notebook, one sentence each, and draws something for one of them.',
        },
        pairRoles: { ar: 'طفل يسأل سؤالًا من الدرس، وصاحبه يجيب بجملة', en: 'one child asks a question from the lesson, the other answers in a sentence' },
        homework: {
          ar: `يتحدث الطفل مع أسرته عن ${q}، ويكتب جملتين عمّا قالوه.`,
          en: `The child talks with the family about ${qEn} and writes two sentences about what they said.`,
        },
        objectives: {
          ar: [`أن يتعرّف الطفل ${q} من صور وخرائط ونصوص قصيرة`, `أن يعبّر الطفل عن ${q} بجمل قصيرة شفويًا وكتابةً`, 'أن يربط الطفل ما تعلّمه بحياته وبوطنه'],
          en: [`The child will recognise ${qEn} in pictures, maps and short texts`, `The child will talk and write about ${qEn} in short sentences`, 'The child will link what they learned to their own life and country'],
        },
      };
    case 'english':
      return {
        materials: {
          ar: ['بطاقات صور وكلمات لمفردات الدرس', 'تسجيل الدرس أو أنشودته', 'كتاب الطالب ودفتر النشاط'],
          en: ['Picture and word cards for the lesson', 'The lesson recording or song', 'Pupil’s book and activity book'],
        },
        intro: {
          ar: 'سأبدأ بأنشودة الدرس أو بسؤال قصير بالإنجليزية («What can you see?»)، ويجيب الأطفال بكلمة أو جملة قصيرة.',
          en: 'I will open with the lesson song or a short question (“What can you see?”), and the children answer with a word or a short sentence.',
        },
        show: {
          ar: 'سأعرض بطاقات صور المفردات مع كلماتها مكتوبة، وأنطق كل كلمة ثم أقولها في جملة قصيرة من الدرس، ويردّد الأطفال بعدي.',
          en: 'I will show the picture cards with their words written, say each word and then use it in a short sentence from the lesson; the children repeat after me.',
        },
        explore: { ar: 'بطاقات صور وكلمات مقلوبة على الطاولة', en: 'picture and word cards face down on the table' },
        together: {
          ar: 'نطابق معًا كل صورة بكلمتها، ثم نقرأ جمل الدرس القصيرة بصوت واحد، ويسأل طفل زميله سؤال الدرس ويجيبه.',
          en: 'We match each picture to its word together, then read the lesson’s short sentences in one voice, and one child asks a classmate the lesson question and they answer.',
        },
        alone: {
          ar: 'يكتب كل طفل في دفتر النشاط كلمة تحت كل صورة، ويكمل جملة قصيرة من الدرس، ثم يقرؤها لي.',
          en: 'Each child writes a word under each picture in the activity book and completes a short sentence from the lesson, then reads it to me.',
        },
        pairRoles: { ar: 'طفل يسأل سؤال الدرس بالإنجليزية، وصاحبه يجيب بجملة قصيرة', en: 'one child asks the lesson question, the other answers in a short sentence' },
        homework: {
          ar: 'يكتب الطفل ثلاث كلمات من الدرس وجملة قصيرة فيها إحداها، ويقرؤها لأسرته.',
          en: 'The child writes three lesson words and one short sentence using one of them, and reads it to the family.',
        },
        objectives: {
          ar: ['أن يقرأ الطفل مفردات الدرس ويكتبها', 'أن يستعمل الطفل مفردات الدرس في جملة قصيرة', 'أن يسأل الطفل سؤال الدرس ويجيب عنه'],
          en: ['The child will read and write the lesson words', 'The child will use the lesson words in a short sentence', 'The child will ask and answer the lesson question'],
        },
      };
    default:
      return null;
  }
}

function baseContent(kind: LessonKind, topic: string, titleAr: string, grade: EarlyGrade): Content {
  const q = `«${topic}»`;
  const qEn = `“${topic}”`;
  switch (kind) {
    case 'calc':
      return {
        materials: {
          ar: ['مكعبات أو حبات أو أقلام للعدّ', 'بطاقات أعداد كبيرة', 'السبورة وأقلام ملوّنة', 'كتاب الطالب'],
          en: ['Cubes, beads or pencils to count', 'Large number cards', 'Board and coloured markers', 'Student book'],
        },
        intro: {
          ar: `سأبدأ بلعبة قصيرة: سأضع على الطاولة عددًا من المكعبات، ويعدّها الأطفال معي بصوت واحد، ثم سأقول: «اليوم نتعلّم ${topic}».`,
          en: `I will open with a short game: I put some cubes on the table and the children count them with me aloud, then I say “Today we learn ${topic}.”`,
        },
        show: {
          ar: `سأعرض فكرة ${q} بالمكعبات أو بالأصابع أمام الأطفال، وأقول كل خطوة بصوت واضح وأنا أحرّك الأشياء.`,
          en: `I will show ${qEn} with cubes or fingers in front of the children, saying each step aloud as I move the objects.`,
        },
        explore: { ar: 'مجموعات صغيرة من المكعبات أو الحبات', en: 'small sets of cubes or beads' },
        together: {
          ar: 'سأقدّم مثالين بالأشياء نفسها: أحرّك المكعبات، ويعدّ الأطفال معي، ويقول أحدهم الناتج بصوت عالٍ.',
          en: 'I will work two examples with the same objects: I move the cubes, the children count with me, and one of them says the answer aloud.',
        },
        alone: {
          ar: 'يمثّل كل طفل بمكعباته مثالًا أقوله، ثم يكتب العدد الناتج بالأرقام أو يلوّنه في كتاب الطالب.',
          en: 'Each child shows an example I say with their own cubes, then writes the answer as a number or colours it in the student book.',
        },
        pairRoles: { ar: 'طفل يحرّك المكعبات، وطفل يعدّ ويقول العدد', en: 'one child moves the cubes, the other counts and says the number' },
        homework: {
          ar: `يعدّ الطفل مع أسرته أشياء من البيت (ملاعق، أزرار، ألعاب) في مثالين عن ${q}، ويقول العدد بصوت عالٍ.`,
          en: `The child counts things at home with the family (spoons, buttons, toys) in two examples of ${qEn} and says the number aloud.`,
        },
        objectives: {
          ar: [`أن يمثّل الطفل ${q} بأشياء محسوسة`, 'أن يقول الطفل الناتج ويكتبه بالأرقام', 'أن يستعمل الطفل ما تعلّمه في موقف من حياته'],
          en: [`The child will show ${qEn} with concrete objects`, 'The child will say the answer and write it as a number', 'The child will use what they learned in a situation from daily life'],
        },
      };
    case 'arabic':
      return arabicContent(topic, titleAr, grade);
    case 'english':
      return {
        materials: {
          ar: ['بطاقات صور لمفردات الدرس', 'أنشودة الدرس أو تسجيلها', 'كتاب الطالب', 'ألوان'],
          en: ['Picture cards for the lesson words', 'The lesson song or its recording', 'Pupil’s book', 'Crayons'],
        },
        intro: {
          ar: 'سأبدأ بأنشودة الدرس أو بتحية قصيرة بالإنجليزية («Hello! How are you?»)، ويردّد الأطفال معي مع الحركات.',
          en: 'I will open with the lesson song or a short greeting (“Hello! How are you?”), and the children join in with the actions.',
        },
        show: {
          ar: 'سأعرض بطاقات صور مفردات الدرس واحدة بعد الأخرى، وأنطق كل كلمة بوضوح، ويردّد الأطفال بعدي مع حركة تدل على معناها.',
          en: 'I will show the picture cards one at a time and say each word clearly; the children repeat after me with an action for its meaning.',
        },
        explore: { ar: 'بطاقات صور المفردات مقلوبة على الطاولة', en: 'the picture cards face down on the table' },
        together: {
          ar: 'سأقول كلمة، ويشير الأطفال إلى صورتها أو يؤدّون حركتها، ثم أعكس اللعبة: أرفع الصورة ويقولون الكلمة.',
          en: 'I will say a word and the children point to its picture or do its action; then I swap: I hold up a picture and they say the word.',
        },
        alone: {
          ar: 'يشير كل طفل إلى الصورة التي أسمّيها في كتابه ويلوّنها، ويقول كلمة أو عبارة قصيرة عنها («It’s a …»).',
          en: 'Each child points to the picture I name in their book and colours it, then says a word or short chunk about it (“It’s a …”).',
        },
        pairRoles: { ar: 'طفل يرفع بطاقة، وصاحبه يقول كلمتها بالإنجليزية', en: 'one child holds up a card, the other says its word in English' },
        homework: {
          ar: 'يُري الطفل أسرته صور مفردات الدرس في كتابه، ويقول اسم كل صورة بالإنجليزية.',
          en: 'The child shows the family the lesson pictures in the book and says each one’s name in English.',
        },
        objectives: {
          ar: ['أن يتعرّف الطفل مفردات الدرس من صورها', 'أن ينطق الطفل مفردات الدرس نطقًا سليمًا', 'أن يستعمل الطفل كلمة أو عبارة قصيرة من الدرس في موقف بسيط'],
          en: ['The child will recognise the lesson words from their pictures', 'The child will say the lesson words clearly', 'The child will use a word or short chunk from the lesson in a simple situation'],
        },
      };
    case 'recitation':
      return SURAH.test(fold(titleAr)) ? surahContent(topic) : islamicContent(topic);
    case 'science':
      return {
        materials: {
          ar: ['أشياء حقيقية أو صور كبيرة من الدرس', 'عدسة مكبّرة إن وُجدت', 'كتاب الطالب', 'ألوان'],
          en: ['Real objects or large pictures from the lesson', 'A magnifying glass if there is one', 'Student book', 'Crayons'],
        },
        intro: {
          ar: `سأحضر إلى الصف شيئًا حقيقيًا أو صورة كبيرة تتصل ${arPrefixed('ب', topic)}، وأسأل: «ماذا ترون؟»`,
          en: `I will bring in a real object or a large picture linked to ${topic} and ask: “What do you see?”`,
        },
        show: {
          ar: `سأعرض أشياء حقيقية أو صورًا تتصل ${arPrefixed('ب', topic)}، وأسمّي كل جزء أو فكرة بكلمة واحدة واضحة وأنا أشير إليه.`,
          en: `I will show real objects or pictures linked to ${topic}, naming each part or idea with one clear word as I point to it.`,
        },
        explore: { ar: 'أشياء حقيقية أو صورًا تتصل بالدرس', en: 'real objects or pictures linked to the lesson' },
        together: {
          ar: 'نلاحظ معًا بالحواس (ننظر ونلمس ونستمع)، ويقول كل طفل كلمة عمّا لاحظه، ثم نصنّف الصور معًا في مجموعتين على السبورة.',
          en: 'We observe together with our senses (look, touch, listen); each child says one word about what they noticed, then we sort the pictures into two groups on the board.',
        },
        alone: {
          ar: 'يلوّن كل طفل الصورة الصحيحة في كتابه أو يصلها باسمها، ويقول لي كلمة عن السبب.',
          en: 'Each child colours the right picture in the book or matches it to its name, and tells me one word about why.',
        },
        pairRoles: { ar: 'طفل يختار صورة، وصاحبه يقول في أي مجموعة تكون', en: 'one child picks a picture, the other says which group it belongs to' },
        homework: {
          ar: `يبحث الطفل مع أسرته في البيت أو الحديقة عن شيء يتصل ${arPrefixed('ب', topic)}، ويخبرهم باسمه.`,
          en: `The child looks at home or in the garden, with the family, for something linked to ${topic} and tells them its name.`,
        },
        objectives: {
          ar: [`أن يلاحظ الطفل بحواسه ما يتصل ${arPrefixed('ب', topic)} ويسمّيه`, 'أن يصنّف الطفل الأشياء أو الصور في مجموعتين', 'أن يربط الطفل ما تعلّمه بشيء من حياته اليومية'],
          en: [`The child will observe with their senses what is linked to ${topic} and name it`, 'The child will sort objects or pictures into two groups', 'The child will link what they learned to something in daily life'],
        },
      };
    case 'social':
      return {
        materials: {
          ar: ['صور من حياة الأطفال (الأسرة والحي والوطن)', 'كتاب الطالب', 'ألوان'],
          en: ['Pictures from the children’s lives (family, neighbourhood, country)', 'Student book', 'Crayons'],
        },
        intro: {
          ar: `سأبدأ بصورة من حياة الأطفال تتصل ${arPrefixed('ب', topic)}، وأسأل: «من رأى مثل هذا؟»`,
          en: `I will open with a picture from the children’s lives linked to ${topic} and ask: “Who has seen something like this?”`,
        },
        show: {
          ar: `سأتحدث عن ${q} بجمل قصيرة وأنا أعرض صورًا من حياة الأطفال، وأسمّي ما فيها.`,
          en: `I will talk about ${qEn} in short sentences while showing pictures from the children’s lives, naming what is in them.`,
        },
        explore: { ar: 'صورًا لمواقف من الحياة اليومية', en: 'pictures of everyday situations' },
        together: {
          ar: 'يتحدث الأطفال عن تجاربهم بجمل قصيرة، ويمثّل بعضهم موقفًا من الدرس (مثل التحية أو عبور الشارع) وأنا أوجّههم.',
          en: 'The children talk about their own experience in short sentences, and some act out a situation from the lesson (a greeting, crossing the road) as I guide them.',
        },
        alone: {
          ar: 'يلوّن كل طفل الصورة التي تدل على السلوك الصحيح أو يرسم ما يحبه في الدرس، ويقول جملة واحدة عنه.',
          en: 'Each child colours the picture that shows the right behaviour, or draws what they like in the lesson, and says one sentence about it.',
        },
        pairRoles: { ar: 'طفل يمثّل الموقف، وصاحبه يقول ماذا فعل', en: 'one child acts out the situation, the other says what they did' },
        homework: {
          ar: `يتحدث الطفل مع أسرته عن ${q}، ويطبّق ما تعلّمه في موقف من يومه.`,
          en: `The child talks with the family about ${qEn} and does what they learned in a moment of their day.`,
        },
        objectives: {
          ar: [`أن يتعرّف الطفل ${q} من صور ومواقف قريبة منه`, 'أن يعبّر الطفل شفويًا بجملة قصيرة عن تجربته', 'أن يمارس الطفل السلوك الذي تعلّمه في موقف من حياته'],
          en: [`The child will recognise ${qEn} in pictures and situations close to them`, 'The child will say a short sentence about their own experience', 'The child will practise the behaviour they learned in a situation from daily life'],
        },
      };
    case 'movement':
      return {
        materials: {
          ar: ['ساحة آمنة', 'أقماع أو أطواق أو كرات حسب اللعبة', 'صافرة'],
          en: ['A safe open space', 'Cones, hoops or balls for the game', 'A whistle'],
        },
        intro: {
          ar: 'سأبدأ بإحماء في شكل لعبة: يقلّد الأطفال حركات حيوانات أؤدّيها أمامهم، وأتأكد من المسافات الآمنة بينهم.',
          en: 'I will open with a warm-up game: the children copy animal movements I do in front of them, and I check the safe spaces between them.',
        },
        show: {
          ar: `سأؤدّي حركة ${q} أمام الأطفال ببطء ثم بسرعتها، وأسمّي نقطة واحدة مهمة فيها.`,
          en: `I will do ${qEn} in front of the children slowly, then at full speed, and name one key point in it.`,
        },
        explore: { ar: 'مساحة وأدوات اللعب، ليجرّبوا الحركة بطريقتهم', en: 'the space and the equipment, to try the movement their own way' },
        together: {
          ar: 'يؤدّي الأطفال الحركة معي في صفوف أو في دائرة، على إيقاع تصفيق أو أنشودة، وأصحّح بلطف.',
          en: 'The children do the movement with me in lines or a circle, to a clap or a song, and I correct gently.',
        },
        alone: {
          ar: 'يلعب الأطفال لعبة قصيرة تستعمل الحركة، ويؤدّيها كل طفل في دوره وأنا أراقب وأشجّع.',
          en: 'The children play a short game that uses the movement; each child does it in turn while I watch and encourage.',
        },
        pairRoles: { ar: 'طفل يؤدّي الحركة، وصاحبه يقلّده', en: 'one child does the movement, the other copies it' },
        homework: {
          ar: `يُري الطفل أسرته حركة ${q} ويؤدّيها معهم مرة واحدة.`,
          en: `The child shows the family ${qEn} and does it with them once.`,
        },
        objectives: {
          ar: [`أن يؤدّي الطفل حركة ${q} أداءً صحيحًا`, 'أن يلتزم الطفل بقواعد السلامة وبدوره في اللعب', 'أن يتعاون الطفل مع زملائه في لعبة جماعية'],
          en: [`The child will perform ${qEn} correctly`, 'The child will follow the safety rules and wait for their turn', 'The child will cooperate with classmates in a group game'],
        },
      };
    case 'making':
      return makingContent(topic, titleAr) ?? {
        materials: {
          ar: ['أوراق وألوان أو أدوات إيقاع حسب الدرس', 'نموذج جاهز أعرضه', 'كتاب الطالب'],
          en: ['Paper and colours, or rhythm instruments, as the lesson needs', 'A finished example to show', 'Student book'],
        },
        intro: {
          ar: `سأبدأ بعرض نموذج جميل أو مقطع صوتي قصير يتصل ${arPrefixed('ب', topic)}، وأسأل: «ماذا ترون؟ ماذا تسمعون؟»`,
          en: `I will open with a lovely example or a short sound clip linked to ${topic} and ask: “What do you see? What do you hear?”`,
        },
        show: {
          ar: `سأعرض ${q} بمثال أصنعه أو أؤدّيه أمام الأطفال خطوة بخطوة، وأسمّي الأداة أو الصوت أو الحركة.`,
          en: `I will show ${qEn} by making or performing an example in front of the children step by step, naming the tool, sound or movement.`,
        },
        explore: { ar: 'الأدوات والمواد نفسها، ليجرّبوها بحرية', en: 'the tools and materials themselves, to try freely' },
        together: {
          ar: 'يجرّب الأطفال معي الخطوة نفسها: نرسم أو نلوّن أو نصفّق أو نمثّل معًا، وأشير إلى ما أحسنوه.',
          en: 'The children try the same step with me: we draw, colour, clap or act together, and I point out what they did well.',
        },
        alone: {
          ar: 'يصنع كل طفل عمله الصغير (رسمًا أو تلوينًا أو أداءً قصيرًا)، ويُريه لزميل ويقول عنه كلمة.',
          en: 'Each child makes their own small piece (a drawing, colouring or short performance), shows it to a classmate and says one word about it.',
        },
        pairRoles: { ar: 'طفل يؤدّي أو يرسم، وصاحبه يقول ما أعجبه', en: 'one child performs or draws, the other says what they liked' },
        homework: {
          ar: 'يُري الطفل أسرته ما صنعه أو أدّاه اليوم، ويحكي لهم عنه.',
          en: 'The child shows the family what they made or performed today and tells them about it.',
        },
        objectives: {
          ar: [`أن يتعرّف الطفل ${q} من مثال يراه أو يسمعه`, 'أن ينفّذ الطفل عملًا صغيرًا بخطواته', 'أن يعبّر الطفل بكلمة عمّا صنعه أو أدّاه'],
          en: [`The child will recognise ${qEn} from an example they see or hear`, 'The child will carry out a small piece of work step by step', 'The child will say a word about what they made or performed'],
        },
      };
  }
}

/**
 * An arts lesson is a picture, a piece of music or a scene, and each is taught its own way:
 * swept 2026-11-15, «خشبة المسرح» and «آلة (البيانو)» both got «ينفّذ الطفل عملًا صغيرًا بخطواته».
 */
const MUSIC = /ايقاع|اله|نشيد|اغنيه|الاصوات|الموسيقي|غناء|القوه والضعف/;
const THEATRE = /مسرح|تمثيل|ممثل|مشاهد/;

function makingContent(topic: string, titleAr: string): Content | null {
  const t = fold(titleAr || topic);
  const q = `«${topic}»`, qEn = `“${topic}”`;
  if (THEATRE.test(t)) {
    return {
      materials: { ar: ['مساحة مفتوحة في الصف أو الساحة', 'أدوات بسيطة للتمثيل (قبعة، وشاح، دمية)', 'كتاب الطالب'], en: ['An open space in the class or yard', 'Simple props (a hat, a scarf, a puppet)', 'Student book'] },
      intro: { ar: `سأبدأ بتمثيل موقف قصير أمام الأطفال بلا كلام، وأسأل: «ماذا كنت أفعل؟» ثم أقول: «اليوم نتعلّم ${topic}».`, en: `I will open by acting out a short situation without words and ask: “What was I doing?” Then I say: “Today we learn ${topic}.”` },
      show: { ar: `سأعرض ${q} بمثال أؤدّيه أمام الأطفال، وأسمّي ما أفعله: أين أقف، وإلى أين أنظر، وكيف أتحرك وأتكلم.`, en: `I will show ${qEn} by performing an example, naming what I do: where I stand, where I look, how I move and speak.` },
      explore: { ar: 'مساحة التمثيل وأدوات بسيطة، ليجرّبوا الوقوف والحركة فيها', en: 'the acting space and simple props, to try standing and moving in it' },
      together: { ar: 'يقف الأطفال معي في المساحة، ونؤدّي معًا الحركة أو الجملة نفسها مرتين، وأشير إلى من أدّاها بوضوح.', en: 'The children stand with me in the space and we do the same movement or line together twice; I point out who did it clearly.' },
      alone: { ar: 'يؤدّي كل طفل في دوره أمام زملائه حركة أو جملة قصيرة من الموقف، ويصفّق له الصف.', en: 'Each child in turn performs a movement or a short line from the scene for the class, who clap for them.' },
      pairRoles: { ar: 'طفل يمثّل، وصاحبه جمهور يقول ما فهمه من التمثيل', en: 'one child acts, the other is the audience and says what they understood' },
      homework: { ar: 'يمثّل الطفل لأسرته الموقف الذي تعلّمه اليوم، ويطلب منهم أن يكونوا جمهوره.', en: 'The child acts out today’s scene for the family and asks them to be the audience.' },
      objectives: { ar: [`أن يتعرّف الطفل ${q} من مثال يشاهده`, 'أن يؤدّي الطفل حركة أو جملة قصيرة أمام زملائه بوضوح', 'أن يحترم الطفل دوره ودور زملائه في التمثيل'], en: [`The child will recognise ${qEn} from an example they watch`, 'The child will perform a movement or short line clearly for classmates', 'The child will respect their own and their classmates’ turns'] },
    };
  }
  if (MUSIC.test(t)) {
    return {
      materials: { ar: ['تسجيل صوتي أو آلة يعزف عليها المعلم', 'أدوات إيقاع بسيطة (دف، أعواد، قوارير)', 'كتاب الطالب'], en: ['A recording or an instrument the teacher plays', 'Simple rhythm instruments (a drum, sticks, shakers)', 'Student book'] },
      intro: { ar: `سأُسمع الأطفال مقطعًا قصيرًا يتصل ${arPrefixed('ب', topic)}، وأسأل: «ماذا تسمعون؟ هل هو سريع أم بطيء؟ عالٍ أم هادئ؟»`, en: `I will play a short piece linked to ${topic} and ask: “What do you hear? Is it fast or slow, loud or soft?”` },
      show: { ar: `سأعرض ${q} بالاستماع والتصفيق: أؤدّي الإيقاع أو الصوت ببطء، وأسمّيه، ويقلّدني الأطفال.`, en: `I will show ${qEn} by listening and clapping: I play the rhythm or sound slowly, name it, and the children copy me.` },
      explore: { ar: 'تسجيلًا قصيرًا وأدوات إيقاع، ليستمعوا ويجرّبوا', en: 'a short recording and rhythm instruments, to listen and try' },
      together: { ar: 'نصفّق أو نعزف معًا الإيقاع نفسه، ثم نغنّي المقطع ونحن نحافظ عليه، وأشير إلى من أدّاه بدقة.', en: 'We clap or play the same rhythm together, then sing the piece keeping it; I point out who kept it well.' },
      alone: { ar: 'يؤدّي كل طفل الإيقاع أو المقطع بأداته أو بالتصفيق في دوره، ويرفع بطاقة «سريع/بطيء» أو «عالٍ/هادئ» لما يسمعه.', en: 'Each child plays the rhythm or piece on an instrument or by clapping in turn, and holds up a “fast/slow” or “loud/soft” card for what they hear.' },
      pairRoles: { ar: 'طفل يؤدّي إيقاعًا قصيرًا، وصاحبه يعيده كما سمعه', en: 'one child plays a short rhythm, the other plays it back as they heard it' },
      homework: { ar: 'يغنّي الطفل لأسرته ما تعلّمه اليوم، ويصفّق معهم الإيقاع.', en: 'The child sings today’s piece to the family and claps the rhythm with them.' },
      objectives: { ar: [`أن يميّز الطفل ${q} بالاستماع`, 'أن يؤدّي الطفل الإيقاع أو المقطع مع زملائه', 'أن يعبّر الطفل بكلمة عمّا سمعه'], en: [`The child will recognise ${qEn} by listening`, 'The child will perform the rhythm or piece with classmates', 'The child will say a word about what they heard'] },
    };
  }
  return {
    materials: { ar: ['أوراق وألوان وأقلام رصاص', 'نموذج جاهز أعرضه', 'كتاب الطالب'], en: ['Paper, colours and pencils', 'A finished example to show', 'Student book'] },
    intro: { ar: `سأعرض لوحة أو صورة جميلة تتصل ${arPrefixed('ب', topic)}، وأسأل: «ماذا ترون؟ ما الألوان والخطوط فيها؟»`, en: `I will show a picture linked to ${topic} and ask: “What do you see? What colours and lines are in it?”` },
    show: { ar: `سأرسم أمام الأطفال مثالًا على ${q} خطوة بخطوة، وأسمّي الخط أو اللون أو الشكل في كل خطوة.`, en: `I will draw an example of ${qEn} in front of the children step by step, naming the line, colour or shape at each step.` },
    explore: { ar: 'أوراقًا وألوانًا وصورًا لأعمال فنية', en: 'paper, colours and pictures of artworks' },
    together: { ar: 'يجرّب الأطفال معي الخطوة نفسها على أوراقهم، وأمرّ عليهم وأشير إلى ما أحسنوه.', en: 'The children try the same step with me on their paper; I go round and point out what they did well.' },
    alone: { ar: 'يرسم كل طفل عمله الصغير ويلوّنه، ثم يُريه لزميله ويقول عنه كلمة.', en: 'Each child draws and colours their own small piece, shows it to a classmate and says one word about it.' },
    pairRoles: { ar: 'طفل يرسم، وصاحبه يقول ما أعجبه في الرسم', en: 'one child draws, the other says what they liked in the drawing' },
    homework: { ar: 'يُري الطفل أسرته رسمه، ويرسم معهم شيئًا من البيت بالطريقة نفسها.', en: 'The child shows the family the drawing and draws something at home the same way with them.' },
    objectives: { ar: [`أن يتعرّف الطفل ${q} في عمل فني يراه`, 'أن ينفّذ الطفل رسمًا صغيرًا بخطواته', 'أن يعبّر الطفل بكلمة عن عمله'], en: [`The child will recognise ${qEn} in an artwork they see`, 'The child will make a small drawing step by step', 'The child will say a word about their work'] },
  };
}

function surahContent(topic: string): Content {
  return {
    materials: { ar: ['تسجيل تلاوة مجوّدة إن وُجد', 'كتاب الطالب', 'صور تعبّر عن معانٍ قريبة', 'ألوان'], en: ['A recording of the recitation if available', 'Student book', 'Pictures of meanings close to the children', 'Crayons'] },
    intro: {
      ar: `سأبدأ بالاستماع مع الأطفال إلى ${topic} بصوت هادئ، وأسأل: «هل سمعتموها من قبل؟ أين؟»`,
      en: `I will open by listening with the children to ${topic} calmly and ask: “Have you heard it before? Where?”`,
    },
    show: {
      ar: `سأتلو ${topic} تلاوة واضحة متأنّية من الكتاب، ثم أقسمها إلى مقاطع قصيرة يردّدها الأطفال بعدي مقطعًا مقطعًا.`,
      en: `I will recite ${topic} clearly and slowly from the book, then split it into short parts the children repeat after me one by one.`,
    },
    explore: { ar: 'تلاوة السورة مسجّلة أو بصوتي', en: 'the surah, recorded or in my voice' },
    together: {
      ar: 'نتلو معًا بصوت واحد، ثم تتلو كل مجموعة صغيرة مقطعًا، وأصحّح النطق بلطف.',
      en: 'We recite together in one voice, then each small group recites a part, and I correct pronunciation gently.',
    },
    alone: {
      ar: 'يتلو كل طفل ما حفظه أمامي أو أمام زميله، ويلوّن صورة تعبّر عن معنى قريب منه.',
      en: 'Each child recites what they have learned to me or a classmate, and colours a picture of a meaning close to it.',
    },
    pairRoles: { ar: 'طفل يتلو مقطعًا، وصاحبه يستمع ويتابع في الكتاب', en: 'one child recites a part, the other listens and follows in the book' },
    homework: { ar: `يتلو الطفل ما حفظه من ${topic} أمام أسرته.`, en: `The child recites what they have learned of ${topic} to the family.` },
    objectives: {
      ar: [`أن يتلو الطفل ${topic} تلاوة سليمة`, 'أن يحفظ الطفل ما تقرّر منها', 'أن يذكر الطفل معنى قريبًا منها بكلمات بسيطة'],
      en: [`The child will recite ${topic} correctly`, 'The child will learn the set part by heart', 'The child will say a simple meaning of it in their own words'],
    },
  };
}

function islamicContent(topic: string): Content {
  return {
    materials: { ar: ['صور ومواقف من حياة الطفل', 'كتاب الطالب', 'ألوان'], en: ['Pictures and situations from the child’s life', 'Student book', 'Crayons'] },
    intro: {
      ar: `سأبدأ بسؤال قريب من حياة الطفل عن «${topic}»، وأستمع إلى إجابات قصيرة من ثلاثة أطفال.`,
      en: `I will open with a question close to the child’s life about “${topic}” and listen to short answers from three children.`,
    },
    show: {
      ar: `سأروي للأطفال ما يتعلّق ${arPrefixed('ب', topic)} بقصة قصيرة أو موقف من حياتهم، وأعرض صورة تعبّر عنه.`,
      en: `I will tell the children about ${topic} through a short story or a situation from their lives, showing a picture of it.`,
    },
    explore: { ar: 'صورًا لمواقف من حياة الطفل', en: 'pictures of situations from the child’s life' },
    together: {
      ar: 'نتحدث معًا عن الموقف: «ماذا فعل؟ وماذا نفعل نحن؟»، ويمثّل بعض الأطفال الموقف أمام الصف.',
      en: 'We talk together about the situation — “What did he do? What do we do?” — and some children act it out for the class.',
    },
    alone: {
      ar: 'يلوّن كل طفل الصورة التي تدل على السلوك الصحيح، ويقول جملة واحدة عمّا تعلّمه.',
      en: 'Each child colours the picture that shows the right behaviour and says one sentence about what they learned.',
    },
    pairRoles: { ar: 'طفل يمثّل الموقف، وصاحبه يقول ماذا نتعلّم منه', en: 'one child acts out the situation, the other says what we learn from it' },
    homework: { ar: 'يحكي الطفل لأسرته ما تعلّمه اليوم، ويطبّقه في موقف من يومه.', en: 'The child tells the family what they learned today and does it in a moment of their day.' },
    objectives: {
      ar: [`أن يتعرّف الطفل «${topic}» من قصة أو موقف قريب منه`, 'أن يعبّر الطفل شفويًا عمّا تعلّمه بجملة قصيرة', 'أن يمارس الطفل السلوك الذي تعلّمه في حياته'],
      en: [`The child will recognise “${topic}” through a story or a situation close to them`, 'The child will say in a short sentence what they learned', 'The child will practise the behaviour they learned in daily life'],
    },
  };
}

/**
 * Grade 2 Arabic: the book's five strands, each from the lesson's own text or rule. Grade 1
 * reads «كلمات الدرس وجمله القصيرة»; Grade 2 reads the unit's text by name and spells by rule
 * («أكتب (اللام الشمسية واللام القمرية)»), and writes words and a short sentence.
 */
function secondGradeArabic(type: 'listen' | 'speak' | 'read' | 'write' | 'build', detail: string | null): Omit<Content, 'materials' | 'intro' | 'explore' | 'pairRoles'> {
  const text = detail ? `نص «${detail}»` : 'نص الدرس';
  const textEn = detail ? `the text “${detail}”` : 'the lesson’s text';
  const rule = detail ? `«${detail}»` : 'قاعدة الدرس';
  const ruleEn = detail ? `“${detail}”` : 'the lesson’s rule';
  switch (type) {
    case 'listen':
      return {
        show: { ar: 'سأقرأ نص الاستماع في الوحدة قراءة معبّرة مرتين وأنا أعرض صوره، بعد أن أطلب من الأطفال الإصغاء بانتباه.', en: 'I will read the unit’s listening text expressively twice while showing its pictures, after asking the children to listen carefully.' },
        together: { ar: 'سأسأل: «من؟ أين؟ ماذا حدث؟ لماذا؟» ويجيب الأطفال بجمل قصيرة، ثم نرتّب معًا صور الأحداث على السبورة.', en: 'I will ask “Who? Where? What happened? Why?” and the children answer in short sentences; then we put the event pictures in order on the board.' },
        alone: { ar: 'يرتّب كل طفل صور الأحداث في كتابه، ويكتب جملة قصيرة عن الحدث الذي أحبّه.', en: 'Each child orders the event pictures in the book and writes one short sentence about the event they liked.' },
        homework: { ar: 'يعيد الطفل سرد ما سمعه لأسرته بترتيب أحداثه.', en: 'The child retells what they heard to the family, in order.' },
        objectives: { ar: ['أن يُصغي الطفل إلى نص مسموع بانتباه', 'أن يجيب الطفل عن أسئلة النص بجمل قصيرة', 'أن يرتّب الطفل أحداث النص ويكتب جملة عن أحدها'], en: ['The child will listen carefully to a heard text', 'The child will answer questions about the text in short sentences', 'The child will order the events and write a sentence about one'] },
      };
    case 'speak':
      return {
        show: { ar: 'سأعرض صور الوحدة، وأتحدث عن إحداها بجملتين أو ثلاث متتابعة نموذجًا.', en: 'I will show the unit’s pictures and talk about one of them in two or three connected sentences as a model.' },
        together: { ar: 'يتحدث الأطفال واحدًا بعد الآخر عن صورة بجملتين أو ثلاث، ثم يمثّل طفلان حوارًا قصيرًا من موضوع الوحدة، وأساعد ببداية جملة.', en: 'The children take turns to talk about a picture in two or three sentences; then two children act out a short dialogue on the unit’s theme, with my sentence starters.' },
        alone: { ar: 'يحكي كل طفل لزميله ما يراه في صورة بجمل متتابعة، ويكتب جملة واحدة منها.', en: 'Each child tells a classmate what they see in a picture in connected sentences, and writes one of them down.' },
        homework: { ar: 'يتحدث الطفل مع أسرته عن موضوع الوحدة بثلاث جمل.', en: 'The child talks with the family about the unit’s theme in three sentences.' },
        objectives: { ar: ['أن يتحدث الطفل عن صورة بجمل متتابعة', 'أن يشارك الطفل في حوار قصير وينتظر دوره', 'أن يكتب الطفل جملة مما قاله'], en: ['The child will talk about a picture in connected sentences', 'The child will take part in a short dialogue and wait for their turn', 'The child will write down one sentence they said'] },
      };
    case 'read':
      return {
        show: { ar: `سأقرأ ${text} قراءة جهرية معبّرة وأنا أشير إلى الكلمات، وأوضّح الكلمات الجديدة بالصور.`, en: `I will read ${textEn} aloud expressively, pointing to the words, and explain new words with pictures.` },
        together: { ar: 'نقرأ النص معًا جملة جملة، ثم يقرأ الأطفال في ثنائيات بالتناوب، ونجيب شفويًا عن أسئلة: من؟ أين؟ ماذا حدث؟', en: 'We read the text together sentence by sentence; then the children read in pairs, taking turns, and we answer aloud: Who? Where? What happened?' },
        alone: { ar: 'يقرأ كل طفل لي جملتين أو ثلاثًا من النص بصوته، ويجيب كتابةً عن سؤال بكلمة أو جملة قصيرة.', en: 'Each child reads me two or three sentences of the text aloud and answers one question in writing, in a word or short sentence.' },
        homework: { ar: `يقرأ الطفل ${text} لأسرته قراءة جهرية، ويحكي لهم ما حدث فيه.`, en: `The child reads ${textEn} aloud to the family and tells them what happens in it.` },
        objectives: { ar: [`أن يقرأ الطفل ${text} قراءة جهرية سليمة معبّرة`, 'أن يجيب الطفل عن أسئلة النص شفويًا وكتابةً بجملة قصيرة', 'أن يستعمل الطفل كلمة جديدة من النص في جملة من عنده'], en: [`The child will read ${textEn} aloud correctly and with expression`, 'The child will answer questions on the text aloud and in a short written sentence', 'The child will use a new word from the text in a sentence of their own'] },
      };
    case 'write':
      return {
        show: { ar: `سأكتب على السبورة كلمات فيها ${rule} وأقرؤها، وألوّن موضع القاعدة في كل كلمة، وأسأل: «ماذا تلاحظون؟»`, en: `I will write words with ${ruleEn} on the board, read them, colour where the rule is in each word, and ask: “What do you notice?”` },
        together: { ar: `نصنّف معًا بطاقات كلمات في عمودين حسب ${rule}، ويقرأ الأطفال كل كلمة قبل أن نضعها في مكانها.`, en: `We sort word cards into two columns by ${ruleEn}; the children read each word before we place it.` },
        alone: { ar: `يكتب كل طفل في دفتره ثلاث كلمات فيها ${rule}، ثم جملة قصيرة فيها واحدة منها.`, en: `Each child writes three words with ${ruleEn} in their notebook, then a short sentence using one of them.` },
        homework: { ar: `يبحث الطفل في كتابه عن كلمتين فيهما ${rule}، ويكتبهما في جملة قصيرة.`, en: `The child finds two words with ${ruleEn} in the book and writes them in a short sentence.` },
        objectives: { ar: [`أن يميّز الطفل ${rule} في كلمات يقرؤها`, `أن يكتب الطفل كلمات فيها ${rule} كتابة صحيحة`, 'أن يكتب الطفل جملة قصيرة فيها كلمة من الدرس'], en: [`The child will recognise ${ruleEn} in words they read`, `The child will spell words with ${ruleEn} correctly`, 'The child will write a short sentence using a word from the lesson'] },
      };
    case 'build':
      return {
        show: { ar: 'سأعرض جملًا قصيرة من الدرس على بطاقات، وأقرؤها وألوّن ما يتكرر فيها، وأسمّي النمط.', en: 'I will show short sentences from the lesson on cards, read them, colour what repeats, and name the pattern.' },
        together: { ar: 'نكوّن معًا جملًا جديدة على النمط نفسه من بطاقات كلمات، ويقرؤها الأطفال معي.', en: 'We build new sentences on the same pattern from word cards, and the children read them with me.' },
        alone: { ar: 'يكمل كل طفل جملًا ناقصة على نمط الدرس في كتابه، ويكتب جملة واحدة من عنده على النمط نفسه.', en: 'Each child completes unfinished sentences on the lesson’s pattern in the book and writes one sentence of their own on it.' },
        homework: { ar: 'يكتب الطفل جملتين على نمط الدرس، ويقرؤهما لأسرته.', en: 'The child writes two sentences on the lesson’s pattern and reads them to the family.' },
        objectives: { ar: ['أن يتعرّف الطفل نمط الدرس في جمل يقرؤها', 'أن يكوّن الطفل جملًا على النمط نفسه', 'أن يكتب الطفل جملة صحيحة من عنده على النمط'], en: ['The child will recognise the lesson’s pattern in sentences they read', 'The child will build sentences on the same pattern', 'The child will write a correct sentence of their own on the pattern'] },
      };
  }
}

/**
 * Grade 3 Arabic: Grade 2's strands, with two or three sentences of the child's own where
 * Grade 2 writes one — the reading answered in sentences, the spelling rule used in
 * sentences, the pattern built into sentences.
 */
function thirdGradeArabic(type: 'listen' | 'speak' | 'read' | 'write' | 'build', detail: string | null): Omit<Content, 'materials' | 'intro' | 'explore' | 'pairRoles'> {
  const base = secondGradeArabic(type, detail);
  const text = detail ? `نص «${detail}»` : 'نص الدرس';
  const textEn = detail ? `the text “${detail}”` : 'the lesson’s text';
  const rule = detail ? `«${detail}»` : 'قاعدة الدرس';
  const ruleEn = detail ? `“${detail}”` : 'the lesson’s rule';
  const set = (alone: Pair, homework: Pair, last: Pair) => ({
    ...base, alone, homework,
    objectives: { ar: [...base.objectives.ar.slice(0, 2), last.ar], en: [...base.objectives.en.slice(0, 2), last.en] },
  });
  switch (type) {
    case 'listen':
      return set(
        { ar: 'يرتّب كل طفل صور الأحداث في كتابه، ويكتب جملتين عن الحدث الذي أحبّه ولماذا أحبّه.', en: 'Each child orders the event pictures in the book and writes two sentences about the event they liked and why.' },
        { ar: 'يعيد الطفل سرد ما سمعه لأسرته بترتيب أحداثه، ويكتب جملتين عن أحد أحداثه.', en: 'The child retells what they heard to the family, in order, and writes two sentences about one event.' },
        { ar: 'أن يرتّب الطفل أحداث النص ويكتب جملتين عن أحدها', en: 'The child will order the events and write two sentences about one' },
      );
    case 'speak':
      return set(
        { ar: 'يحكي كل طفل لزميله ما يراه في صورة بجمل متتابعة، ثم يكتب جملتين أو ثلاثًا منها في دفتره.', en: 'Each child tells a classmate what they see in a picture in connected sentences, then writes two or three of them in the notebook.' },
        { ar: 'يتحدث الطفل مع أسرته عن موضوع الوحدة، ويكتب ثلاث جمل مما قاله.', en: 'The child talks with the family about the unit’s theme and writes three sentences of what they said.' },
        { ar: 'أن يكتب الطفل جملتين أو ثلاثًا مما قاله', en: 'The child will write two or three sentences of what they said' },
      );
    case 'read':
      return set(
        { ar: `يقرأ كل طفل لي فقرة قصيرة من ${text} بصوته، ثم يجيب في دفتره عن سؤالين عن النص بجملة لكل منهما.`, en: `Each child reads me a short part of ${textEn} aloud, then answers two questions about the text in the notebook, one sentence each.` },
        { ar: `يقرأ الطفل ${text} لأسرته قراءة جهرية، ويكتب جملتين عمّا أعجبه فيه.`, en: `The child reads ${textEn} aloud to the family and writes two sentences about what they liked in it.` },
        { ar: 'أن يستعمل الطفل كلمتين جديدتين من النص في جملتين من عنده', en: 'The child will use two new words from the text in two sentences of their own' },
      );
    case 'write':
      if (isPunctuation(detail)) return punctuationLesson(detail!);
      return set(
        { ar: `يكتب كل طفل في دفتره أربع كلمات فيها ${rule}، ثم جملتين تستعمل كل منهما واحدة منها.`, en: `Each child writes four words with ${ruleEn} in their notebook, then two sentences each using one of them.` },
        { ar: `يبحث الطفل في كتابه عن ثلاث كلمات فيها ${rule}، ويكتبها في جملتين.`, en: `The child finds three words with ${ruleEn} in the book and uses them in two sentences.` },
        { ar: 'أن يكتب الطفل جملتين صحيحتين فيهما كلمات من الدرس', en: 'The child will write two correct sentences using words from the lesson' },
      );
    case 'build':
      return set(
        { ar: 'يكمل كل طفل جملًا ناقصة على نمط الدرس في كتابه، ويكتب جملتين من عنده على النمط نفسه.', en: 'Each child completes unfinished sentences on the lesson’s pattern in the book and writes two sentences of their own on it.' },
        { ar: 'يكتب الطفل ثلاث جمل على نمط الدرس، ويقرؤها لأسرته.', en: 'The child writes three sentences on the lesson’s pattern and reads them to the family.' },
        { ar: 'أن يكتب الطفل جملتين صحيحتين من عنده على النمط', en: 'The child will write two correct sentences of their own on the pattern' },
      );
  }
}

/** Is an «أكتب» lesson's rule a punctuation mark? Then it is taught in sentences, not words. */
export function isPunctuation(detail: string | null): boolean {
  return !!detail && /ترقيم/.test(fold(detail));
}

/** A punctuation lesson («أكتب (علامتا الترقيم (:) و(؛))»): the marks sit in sentences, not in words. */
function punctuationLesson(detail: string): Omit<Content, 'materials' | 'intro' | 'explore' | 'pairRoles'> {
  const r = `«${detail}»`;
  const rEn = `“${detail}”`;
  return {
    show: { ar: `سأكتب على السبورة جملًا من الكتاب فيها ${r} وأقرؤها، وألوّن كل علامة، وأسأل: «أين وقعت العلامة؟ وماذا جاء بعدها؟»`, en: `I will write sentences from the book with ${rEn} on the board, read them, colour each mark and ask: “Where is the mark? What comes after it?”` },
    together: { ar: `نقرأ معًا جملًا بلا علامات، ويقترح الأطفال أين نضع ${r}، ويكتبها أحدهم في موضعها على السبورة.`, en: `We read sentences with no marks together; the children suggest where ${rEn} go and one of them writes each in place on the board.` },
    alone: { ar: `ينسخ كل طفل في دفتره جملتين من السبورة ويضع فيهما ${r} في موضعها، ثم يكتب جملة من عنده فيها إحدى العلامتين.`, en: `Each child copies two sentences from the board into the notebook and puts ${rEn} in place, then writes a sentence of their own with one of the marks.` },
    homework: { ar: `يبحث الطفل في كتابه عن جملتين فيهما ${r}، وينسخهما ويضع دائرة حول كل علامة.`, en: `The child finds two sentences with ${rEn} in the book, copies them and circles each mark.` },
    objectives: { ar: [`أن يميّز الطفل ${r} في جمل يقرؤها`, `أن يضع الطفل ${r} في موضعها من الجملة`, `أن يكتب الطفل جملة صحيحة من عنده فيها إحدى العلامتين`], en: [`The child will recognise ${rEn} in sentences they read`, `The child will put ${rEn} in the right place in a sentence`, `The child will write a correct sentence of their own with one of the marks`] },
  };
}

function arabicContent(topic: string, titleAr: string, grade: EarlyGrade = 1): Content {
  const lesson = arabicLessonType(titleAr || topic);
  if (grade >= 2 && lesson.type !== 'letter' && lesson.type !== 'mark' && lesson.type !== 'other') {
    const detail = titleDetail(titleAr || topic);
    const g2 = grade === 3 ? thirdGradeArabic(lesson.type, detail) : secondGradeArabic(lesson.type, detail);
    return {
      materials: { ar: ['كتاب الطالب', 'بطاقات كلمات وجمل من الدرس', 'صور من موضوع الوحدة', 'دفتر لكل طفل'], en: ['Student book', 'Word and sentence cards from the lesson', 'Pictures of the unit’s theme', 'A notebook for each child'] },
      intro: { ar: 'سأبدأ بصورة كبيرة من موضوع الوحدة أو بسؤال قريب من حياة الأطفال، وأستمع إلى ثلاث إجابات بجمل قصيرة.', en: 'I will open with a large picture of the unit’s theme or a question close to the children’s lives, and listen to three answers in short sentences.' },
      explore: { ar: 'صورًا وبطاقات كلمات وجمل من الدرس', en: 'pictures and word and sentence cards from the lesson' },
      pairRoles: { ar: 'طفل يقرأ أو يتحدث، وصاحبه يُصغي ويسأله سؤالًا', en: 'one child reads or speaks, the other listens and asks a question' },
      ...g2,
    };
  }
  const materials = {
    ar: ['بطاقات كبيرة للحروف والكلمات', 'صور لكلمات مألوفة', 'لوح صغير وقلم لكل طفل', 'كتاب الطالب'],
    en: ['Large letter and word cards', 'Pictures of familiar words', 'A small board and pen for each child', 'Student book'],
  };
  if (lesson.type === 'letter') {
    const L = lesson.letter;
    return {
      materials: { ar: [`بطاقة كبيرة لحرف ${L} بأشكاله`, `صور لكلمات مألوفة فيها حرف ${L}`, 'لوح صغير وقلم لكل طفل', 'كتاب الطالب'], en: [`A large card of the letter ${L} in its forms`, `Pictures of familiar words with ${L}`, 'A small board and pen for each child', 'Student book'] },
      intro: {
        ar: `سأبدأ بأنشودة قصيرة أو بصورة مألوفة لكلمة تبدأ بحرف ${L}، وأسأل: «ما أول صوت تسمعونه؟» ثم أقول: «اليوم نتعلّم حرف ${L}».`,
        en: `I will open with a short song or a familiar picture of a word that starts with ${L} and ask: “What is the first sound you hear?” Then I say: “Today we learn the letter ${L}.”`,
      },
      show: {
        ar: `سأعرض بطاقة حرف ${L} وأنطقه مع الحركات الثلاث (الفتحة والضمة والكسرة) ومع المدود، ويردّد الأطفال بعدي، ثم سأريهم شكله في أول الكلمة ووسطها وآخرها.`,
        en: `I will show the card for ${L} and say it with the three short vowels and the long vowels; the children repeat after me. Then I show its form at the start, middle and end of a word.`,
      },
      explore: { ar: `صورًا لكلمات مألوفة، بعضها فيه صوت حرف ${L} وبعضها لا`, en: `pictures of familiar words, some with the sound of ${L} and some without` },
      together: {
        ar: `سأقول كلمات مألوفة، ويرفع الأطفال أيديهم عندما يسمعون صوت حرف ${L}، ثم نركّب معًا على السبورة مقاطع وكلمات قصيرة منه ونقرؤها بصوت واحد.`,
        en: `I will say familiar words and the children raise their hands when they hear the sound of ${L}; then we build short syllables and words with it on the board and read them together.`,
      },
      alone: {
        ar: `ينسخ كل طفل حرف ${L} بأشكاله على لوحه أو في كتابه، ويضع دائرة حول الحرف في كلمات الدرس، ويصل الصورة بالحرف الذي تبدأ به.`,
        en: `Each child copies ${L} in its forms on their board or in the book, circles the letter in the lesson words, and matches pictures to their first letter.`,
      },
      pairRoles: { ar: `طفل يُري صاحبه صورة، وصاحبه يقول هل فيها صوت حرف ${L}`, en: `one child shows a picture, the other says whether it has the sound of ${L}` },
      homework: {
        ar: `يبحث الطفل مع أسرته عن ثلاثة أشياء في البيت فيها صوت حرف ${L} ويقولها لهم، وينسخ الحرف سطرًا واحدًا.`,
        en: `The child finds three things at home, with the family, that have the sound of ${L}, says them aloud, and copies the letter on one line.`,
      },
      objectives: {
        ar: [`أن ينطق الطفل حرف ${L} نطقًا سليمًا مع الحركات والمدود`, `أن يميّز الطفل شكل حرف ${L} في أول الكلمة ووسطها وآخرها`, `أن يقرأ الطفل مقاطع وكلمات قصيرة فيها حرف ${L} وينسخ الحرف`],
        en: [`The child will say ${L} correctly with the short and long vowels`, `The child will recognise the form of ${L} at the start, middle and end of a word`, `The child will read short syllables and words with ${L} and copy the letter`],
      },
    };
  }
  if (lesson.type === 'mark') {
    const M = lesson.mark;
    return {
      materials,
      intro: {
        ar: `سأبدأ بكلمتين مألوفتين أنطقهما مرة بلا العلامة ومرة بها، وأسأل: «هل سمعتم الفرق؟» ثم أقول: «اليوم نتعلّم «${M}»».`,
        en: `I will open with two familiar words said once without the mark and once with it and ask: “Did you hear the difference?” Then I say: “Today we learn ${M}.”`,
      },
      show: {
        ar: `سأكتب على السبورة كلمات مألوفة فيها «${M}» وأنطقها ببطء، وأريهم شكل العلامة وصوتها، ويردّد الأطفال بعدي.`,
        en: `I will write familiar words with ${M} on the board, say them slowly, and show the mark and its sound; the children repeat after me.`,
      },
      explore: { ar: 'بطاقات كلمات، بعضها فيه العلامة وبعضها لا', en: 'word cards, some with the mark and some without' },
      together: {
        ar: 'أرفع بطاقة كلمة، ويقرؤها الأطفال معي، ويصفّقون عندما يسمعون صوت العلامة.',
        en: 'I hold up a word card, the children read it with me, and they clap when they hear the mark’s sound.',
      },
      alone: {
        ar: 'يضع كل طفل العلامة على كلمات ناقصة في كتابه، وينسخ كلمة واحدة فيها العلامة، ويقرؤها لي.',
        en: 'Each child adds the mark to unfinished words in the book, copies one word with it, and reads it to me.',
      },
      pairRoles: { ar: 'طفل يقرأ كلمة من بطاقة، وصاحبه يقول هل فيها العلامة', en: 'one child reads a word card, the other says whether it has the mark' },
      homework: { ar: `يقرأ الطفل لأسرته ثلاث كلمات فيها «${M}» من كتابه، وينسخ واحدة منها.`, en: `The child reads three words with ${M} from the book to the family and copies one of them.` },
      objectives: {
        ar: [`أن يميّز الطفل «${M}» شكلًا وصوتًا`, `أن يقرأ الطفل كلمات مألوفة فيها «${M}»`, 'أن يضع الطفل العلامة في كلمة ناقصة'],
        en: [`The child will recognise ${M} by its shape and sound`, `The child will read familiar words with ${M}`, 'The child will add the mark to an unfinished word'],
      },
    };
  }
  const SKILL: Record<'listen' | 'speak' | 'read' | 'write' | 'build' | 'other', { show: Pair; together: Pair; alone: Pair; homework: Pair; objectives: { ar: string[]; en: string[] } }> = {
    listen: {
      show: { ar: 'سأروي للأطفال قصة قصيرة عن موضوع الوحدة وأنا أعرض صورها، بعد أن أطلب منهم الإصغاء بانتباه.', en: 'I will tell a short story about the unit’s theme while showing its pictures, after asking the children to listen carefully.' },
      together: { ar: 'سأسأل أسئلة قصيرة عمّا سمعوه («من؟ أين؟ ماذا حدث؟») ويجيب الأطفال شفويًا، ويشيرون إلى الصورة المناسبة.', en: 'I will ask short questions about what they heard (“Who? Where? What happened?”); the children answer aloud and point to the right picture.' },
      alone: { ar: 'يرتّب كل طفل صور القصة أو يلوّن الصورة التي تدل على ما سمعه.', en: 'Each child puts the story pictures in order or colours the picture that shows what they heard.' },
      homework: { ar: 'يحكي الطفل لأسرته القصة التي سمعها اليوم بكلماته.', en: 'The child tells the family the story they heard today in their own words.' },
      objectives: { ar: ['أن يُصغي الطفل إلى قصة قصيرة بانتباه', 'أن يجيب الطفل شفويًا عن أسئلة بسيطة عمّا سمعه', 'أن يرتّب الطفل صور القصة'], en: ['The child will listen carefully to a short story', 'The child will answer simple questions aloud about what they heard', 'The child will put the story pictures in order'] },
    },
    speak: {
      show: { ar: 'سأعرض صورة كبيرة من موضوع الوحدة، وأتحدث عنها بجملة قصيرة نموذجًا.', en: 'I will show a large picture from the unit’s theme and talk about it in one short sentence as a model.' },
      together: { ar: 'يتحدث الأطفال واحدًا بعد الآخر عن الصورة بجملة قصيرة، وأساعد من يتوقف ببداية جملة («في الصورة…»).', en: 'The children take turns to say one short sentence about the picture; I help anyone who stops with a sentence starter (“In the picture…”).' },
      alone: { ar: 'يرسم كل طفل ما يحبه من موضوع الوحدة، ويتحدث عن رسمه بجملة لزميله.', en: 'Each child draws something they like from the unit’s theme and tells a classmate about it in one sentence.' },
      homework: { ar: 'يتحدث الطفل مع أسرته عن صورة من كتابه بجملتين قصيرتين.', en: 'The child talks with the family about a picture in the book in two short sentences.' },
      objectives: { ar: ['أن يتحدث الطفل عن صورة بجملة قصيرة', 'أن ينتظر الطفل دوره ويُصغي إلى زملائه', 'أن يعبّر الطفل عن رسمه بجملة'], en: ['The child will say a short sentence about a picture', 'The child will wait for their turn and listen to classmates', 'The child will describe their drawing in a sentence'] },
    },
    read: {
      show: { ar: 'سأقرأ الكلمات والجمل القصيرة في الدرس قراءة واضحة وأنا أشير إلى كل كلمة، ويقرأ الأطفال بعدي.', en: 'I will read the lesson’s words and short sentences clearly, pointing to each word; the children read after me.' },
      together: { ar: 'نقرأ معًا كلمة كلمة، ثم أشير إلى كلمة ويقرؤها طفل، ونصل الكلمة بصورتها.', en: 'We read together word by word; then I point to a word, a child reads it, and we match it to its picture.' },
      alone: { ar: 'يقرأ كل طفل لي جملة قصيرة بصوته، ويضع دائرة حول كلمة أذكرها.', en: 'Each child reads me one short sentence aloud and circles a word I name.' },
      homework: { ar: 'يقرأ الطفل لأسرته كلمات الدرس وجمله القصيرة من كتابه.', en: 'The child reads the lesson’s words and short sentences from the book to the family.' },
      objectives: { ar: ['أن يقرأ الطفل كلمات الدرس وجمله القصيرة قراءة سليمة', 'أن يصل الطفل الكلمة بصورتها', 'أن يجد الطفل كلمة يسمعها في الجملة'], en: ['The child will read the lesson’s words and short sentences correctly', 'The child will match a word to its picture', 'The child will find a word they hear in the sentence'] },
    },
    write: {
      show: { ar: 'سأنسخ على السبورة كلمات الدرس ببطء، وأريهم من أين يبدأ كل حرف وكيف يتصل بما بعده.', en: 'I will copy the lesson words slowly on the board, showing where each letter starts and how it joins the next.' },
      together: { ar: 'يكتب الأطفال الكلمة في الهواء بأصابعهم معي، ثم على ألواحهم الصغيرة.', en: 'The children write the word in the air with their fingers along with me, then on their small boards.' },
      alone: { ar: 'ينسخ كل طفل كلمتين أو ثلاثًا من الدرس في كتابه، ويكمل كلمة بحرف ناقص.', en: 'Each child copies two or three lesson words in the book and completes a word with a missing letter.' },
      homework: { ar: 'ينسخ الطفل كلمتين من الدرس سطرًا واحدًا، ويقرؤهما لأسرته.', en: 'The child copies two lesson words on one line and reads them to the family.' },
      objectives: { ar: ['أن ينسخ الطفل كلمات الدرس نسخًا سليمًا', 'أن يصل الطفل الحروف في الكلمة', 'أن يكمل الطفل كلمة بحرف ناقص'], en: ['The child will copy the lesson words correctly', 'The child will join the letters in a word', 'The child will complete a word with a missing letter'] },
    },
    build: {
      show: { ar: 'سأعرض أمثلة قصيرة من الدرس على بطاقات وأنطقها، وأسمّي ما يتكرر فيها.', en: 'I will show short examples from the lesson on cards, say them, and name what repeats in them.' },
      together: { ar: 'نكوّن معًا كلمات وجملًا قصيرة من البطاقات، ويقرؤها الأطفال معي.', en: 'We build words and short sentences from the cards together, and the children read them with me.' },
      alone: { ar: 'يرتّب كل طفل بطاقتين أو ثلاثًا في كلمة أو جملة قصيرة، ويقرؤها لي.', en: 'Each child puts two or three cards in order to make a word or short sentence and reads it to me.' },
      homework: { ar: 'يكوّن الطفل مع أسرته كلمة جديدة على مثال الدرس ويقرؤها لهم.', en: 'The child makes one new word on the lesson’s pattern with the family and reads it to them.' },
      objectives: { ar: ['أن يكوّن الطفل كلمة أو جملة قصيرة من بطاقات', 'أن يقرأ الطفل ما كوّنه', 'أن يستعمل الطفل مثال الدرس في كلمة جديدة'], en: ['The child will build a word or short sentence from cards', 'The child will read what they built', 'The child will use the lesson’s pattern in a new word'] },
    },
    other: {
      show: { ar: `سأعرض ${arPrefixed('ل', topic)} أمثلة قصيرة على بطاقات وصور، وأنطقها بوضوح، ويردّد الأطفال بعدي.`, en: `I will show short examples of ${topic} on cards and pictures and say them clearly; the children repeat after me.` },
      together: { ar: 'نقرأ البطاقات معًا، ونصل كل بطاقة بصورتها على السبورة.', en: 'We read the cards together and match each card to its picture on the board.' },
      alone: { ar: 'يصل كل طفل الكلمة بصورتها في كتابه، وينسخ كلمة واحدة ويقرؤها لي.', en: 'Each child matches words to pictures in the book, copies one word, and reads it to me.' },
      homework: { ar: 'يقرأ الطفل لأسرته كلمات الدرس من كتابه.', en: 'The child reads the lesson words from the book to the family.' },
      objectives: { ar: ['أن يقرأ الطفل كلمات الدرس من صورها', 'أن يصل الطفل الكلمة بصورتها', 'أن ينسخ الطفل كلمة من الدرس'], en: ['The child will read the lesson words with the help of pictures', 'The child will match a word to its picture', 'The child will copy a word from the lesson'] },
    },
  };
  const s = SKILL[lesson.type];
  return {
    materials,
    intro: {
      ar: `سأبدأ بنشيد الوحدة أو بصورة كبيرة من موضوعها، وأسأل: «ماذا ترون؟» وأستمع إلى ثلاث إجابات قصيرة.`,
      en: 'I will open with the unit song or a large picture of its theme and ask: “What do you see?”, listening to three short answers.',
    },
    show: s.show,
    explore: { ar: 'صورًا وبطاقات من موضوع الوحدة', en: 'pictures and cards from the unit’s theme' },
    together: s.together,
    alone: s.alone,
    pairRoles: { ar: 'طفل يرفع بطاقة أو صورة، وصاحبه يقرؤها أو يتحدث عنها', en: 'one child holds up a card or picture, the other reads it or talks about it' },
    homework: s.homework,
    objectives: s.objectives,
  };
}

export interface FirstGradePlanArgs {
  topic: string;
  kb: KBLesson | null;
  lang: Lang;
  kind: LessonKind;
  style: string;
  duration: number;
  /** 0 or 1 — the wording a regenerate may draw (see `freshOnRegenerate`). */
  variant: number;
  /** Teacher-typed objectives, which win as they do everywhere. */
  customObjectives?: string;
  /** Grade 1 (the default), 2 or 3: what the content asks for and how much a child writes. */
  grade?: EarlyGrade;
}

/** How much a child writes, by grade — the last line of every early-grade assessment. */
export const WRITING_LIMIT: Record<EarlyGrade, Pair> = {
  1: { ar: 'لن أطلب كتابة إلا نسخ حرف أو كلمة أو عدد.', en: 'The only writing is copying a letter, a word or a number.' },
  2: { ar: 'ولا تزيد الكتابة على كلمات أو جملة قصيرة يكتبها الطفل بنفسه.', en: 'Writing is no more than words or a short sentence the child writes on their own.' },
  3: { ar: 'ولا تزيد الكتابة على جملتين أو ثلاث جمل قصيرة يكتبها الطفل بنفسه.', en: 'Writing is no more than two or three short sentences the child writes on their own.' },
};

export interface FirstGradePlan {
  objectives: string[];
  materials: string[];
  introduction: string;
  mainActivity: string;
  guidedPractice: string;
  independentPractice: string;
  closure: string;
  assessment: string;
  differentiation: string;
  homework: string;
}

const minutes = (lang: Lang, duration: number, share: number) => {
  const n = Math.max(1, Math.round(duration * share));
  return lang === 'ar' ? arMinutes(n) : `${n} min`;
};

export function firstGradePlan(a: FirstGradePlanArgs): FirstGradePlan {
  const grade = a.grade ?? 1;
  const c = contentFor(a.kind, a.topic, a.kb?.titleAr ?? a.topic, grade);
  const limit = WRITING_LIMIT[grade];
  const say = ANSWER[grade];
  const ar = a.lang === 'ar';
  const m = (share: number) => minutes(a.lang, a.duration, share);
  const pickL = (p: Pair) => (ar ? p.ar : p.en);
  const style = a.style === 'inquiry' || a.style === 'collaborative' ? a.style : 'direct';

  const objectives = a.customObjectives?.trim()
    ? a.customObjectives.trim().split('\n').filter(Boolean)
    : a.kb?.objectives?.length ? [...a.kb.objectives] : (ar ? c.objectives.ar : c.objectives.en);

  let mainActivity: string, guidedPractice: string, independentPractice: string, assessment: string;
  if (ar) {
    if (style === 'inquiry') {
      mainActivity = `(${m(0.3)}) – نكتشف أولًا:\n\n1. سأضع أمام الأطفال ${c.explore.ar} دون أن أقول الفكرة، وسأسأل: «ماذا ترون؟ ما الذي يتشابه؟»\n2. يشير الأطفال ويقولون ما لاحظوه بكلمة أو جملة قصيرة، وسأكرّر كلماتهم بصوت واضح.\n3. بعد ذلك سأسمّي ما اكتشفوه: ${c.show.ar}`;
      guidedPractice = `(${m(0.22)}) – نجرّب ما اكتشفناه:\n\n• ${c.together.ar}\n• وسأسأل: «كيف عرفتم؟» ويجيب الأطفال شفويًا.`;
      independentPractice = `(${m(0.18)}) – كل طفل يجرّب مثالًا جديدًا:\n\n• ${c.alone.ar}\n• وسأسأل كل طفل: «لماذا اخترت هذا؟» ويجيب ${say.ar}.`;
      assessment = 'سأقيّم بالملاحظة: هل يصف الطفل ما لاحظه بكلمة صحيحة؟ وسأسأل كل طفل «كيف عرفت؟» ويجيب شفويًا، وأسجّل ملاحظتي في قائمة الصف.\n' + limit.ar;
    } else if (style === 'collaborative') {
      mainActivity = `(${m(0.3)}) – نعمل في ثنائيات:\n\n1. ${c.show.ar}\n2. سأقسم الأطفال ثنائيات، ولكل طفل دور واحد واضح: ${c.pairRoles.ar}.\n3. يتبادل الطفلان الدورين عند إشارتي.`;
      guidedPractice = `(${m(0.22)}) – ثنائيات أمام الصف:\n\n• يعرض ثنائيان أو ثلاثة ما فعلاه أمام الصف، ويصفّق الصف لهما.\n• ${c.together.ar}\n• وسأسأل الصف: «هل نتفق؟» ويرفع الأطفال أيديهم.`;
      independentPractice = `(${m(0.18)}) – كل طفل وحده:\n\n• ${c.alone.ar}\n• هذه الخطوة تُظهر لي ما تعلّمه كل طفل وحده، لا ما فعله صاحبه.`;
      assessment = 'سأقيّم كل طفل وحده لا الثنائي: سأمرّ على الثنائيات وأسأل كل طفل سؤالًا شفويًا عن دوره، وأسجّل في قائمة الصف من أتقن ومن يحتاج إلى مساعدة.\n' + limit.ar;
    } else {
      mainActivity = `(${m(0.3)}) – أعرض وأنمذج:\n\n1. ${c.show.ar}\n2. سأعيد النموذج مرة ثانية ببطء، ويقلّدني الأطفال.\n3. وسأسأل سؤالًا قصيرًا بعد كل خطوة، ويجيب الأطفال ${say.ar}.`;
      guidedPractice = `(${m(0.22)}) – نفعل معًا:\n\n• ${c.together.ar}\n• وسأصحّح فورًا وبلطف، وأمدح المحاولة.`;
      independentPractice = `(${m(0.18)}) – كل طفل يجرّب وحده:\n\n• ${c.alone.ar}\n• وسأمرّ على كل طفل وأساعده بإشارة أو بكلمة.`;
      assessment = 'سأقيّم بالملاحظة: سأتابع كل طفل في أثناء العمل وأسأله سؤالًا شفويًا قصيرًا، وأسجّل في قائمة الصف من أتقن ومن يحتاج إلى مساعدة.\n' + limit.ar;
    }
  } else if (style === 'inquiry') {
    mainActivity = `(${m(0.3)}) – Explore first:\n\n1. I will put ${c.explore.en} in front of the children without naming the idea, and ask: “What do you see? What is the same?”\n2. The children point and say what they noticed in a word or short sentence, and I will repeat their words clearly.\n3. Then I will name what they found: ${c.show.en}`;
    guidedPractice = `(${m(0.22)}) – Try what we found:\n\n• ${c.together.en}\n• I will ask “How did you know?” and the children answer aloud.`;
    independentPractice = `(${m(0.18)}) – Each child tries a new example:\n\n• ${c.alone.en}\n• I will ask each child “Why did you choose this?” and they answer ${say.en}.`;
    assessment = 'I will assess by watching: does the child describe what they noticed with the right word? I will ask each child “How did you know?” and note it on the class list.\n' + limit.en;
  } else if (style === 'collaborative') {
    mainActivity = `(${m(0.3)}) – Work in pairs:\n\n1. ${c.show.en}\n2. I will put the children in pairs with one clear job each: ${c.pairRoles.en}.\n3. The two swap jobs at my signal.`;
    guidedPractice = `(${m(0.22)}) – Pairs in front of the class:\n\n• Two or three pairs show what they did, and the class claps for them.\n• ${c.together.en}\n• I will ask the class “Do we agree?” and the children raise their hands.`;
    independentPractice = `(${m(0.18)}) – Each child alone:\n\n• ${c.alone.en}\n• This step shows me what each child learned on their own, not what their partner did.`;
    assessment = 'I will assess each child, not the pair: I will visit the pairs, ask each child one spoken question about their job, and note on the class list who has it and who needs help.\n' + limit.en;
  } else {
    mainActivity = `(${m(0.3)}) – Show and model:\n\n1. ${c.show.en}\n2. I will model it a second time slowly, and the children copy me.\n3. I will ask one short question after each step; the children answer ${say.en}.`;
    guidedPractice = `(${m(0.22)}) – Do it together:\n\n• ${c.together.en}\n• I will correct straight away and gently, and praise the try.`;
    independentPractice = `(${m(0.18)}) – Each child tries alone:\n\n• ${c.alone.en}\n• I will go round each child and help with a gesture or a word.`;
    assessment = 'I will assess by watching: I will follow each child at work, ask a short spoken question, and note on the class list who has it and who needs help.\n' + limit.en;
  }

  const t = m(0.1);
  const closure = ar
    ? (a.variant === 1
      ? `(${t}) غلق الدرس: سنلعب «صح أم خطأ» بثلاث عبارات عن الدرس، يقف الأطفال للصح ويجلسون للخطأ، ثم سأختم بجملة واحدة عمّا تعلّمناه.`
      : `(${t}) غلق الدرس: سأسأل الأطفال سؤالًا واحدًا عن الدرس، ويجيب من يرفع يده شفويًا، ثم سنردّد معًا ما تعلّمناه بجملة قصيرة أو بأنشودة.`)
    : (a.variant === 1
      ? `(${t}) Closing: we will play “true or false” with three sentences about the lesson — children stand for true and sit for false — then I will end with one sentence about what we learned.`
      : `(${t}) Closing: I will ask the children one question about the lesson, those who raise a hand answer aloud, then we will say together what we learned in one short sentence or a song.`);

  const differentiation = ar
    ? 'دعم: سأُجلس من يحتاج قريبًا مني، وأعطيه أشياء محسوسة أكثر ومثالًا أسهل، وأكرّر التعليمات بجملة أقصر.\nتحدٍّ: سأعطي من ينهي مبكرًا مثالًا إضافيًا أصعب قليلًا، أو دور «المعلّم الصغير» مع زميله.\nالمبدأ: نشاط قصير محسوس لكل طفل، بلا كتابة طويلة ولا انتظار طويل.'
    : 'Support: I will seat children who need it near me, give them more concrete objects and an easier example, and repeat instructions in shorter sentences.\nChallenge: I will give early finishers one slightly harder example, or the job of “little teacher” with a classmate.\nPrinciple: a short, concrete task for every child, with no long writing and no long waiting.';

  return {
    objectives,
    materials: ar ? c.materials.ar : c.materials.en,
    introduction: pickL(c.intro),
    mainActivity,
    guidedPractice,
    independentPractice,
    closure,
    assessment,
    differentiation,
    homework: pickL(c.homework),
  };
}
