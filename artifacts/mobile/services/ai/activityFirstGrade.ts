/**
 * Offline classroom activities and quick checks for a Grade 1 lesson.
 *
 * The six activity formats in `activityBlueprints.ts` are written for a class
 * that reads and writes: swept on 2026-11-13, a Grade 1 «حرف الباء» activity
 * opened with «استرجاع صامت: الدفاتر مغلقة. اكتب من ذاكرتك…», its discussion
 * asked six-year-olds to defend «يمكن تطبيق حرف الباء في كل الحالات دون
 * استثناء» with a written justification, and its game asked teams to «عرّف حرف
 * الباء» on a whiteboard and bet points. The quick check a slide deck places
 * («اشرح بكلماتك… اكتب إجابتك على لوحك») had the same problem.
 *
 * So a Grade 1 lesson gets its own version of each format, built from the same
 * per-kind content as its lesson plan (`firstGradeContent` in
 * `lessonPlanFirstGrade.ts`): short teacher-led steps with objects, pictures,
 * songs and movement; children answer by pointing, saying, colouring or
 * copying. The formats still differ in what defines them — alone, small groups
 * with one job each, a whole-class circle that votes with thumbs, making with
 * the hands, a game with rounds and a winner, a short warm-up.
 *
 * Maths keeps its concrete items (now the lesson's own, `earlyG1Ops`), read
 * aloud and answered with fingers or number cards. The live prompt carries the
 * same rule (`artifacts/api-server/src/lib/firstGrade.ts`).
 */
import type { ActivitySlide } from './AIService.ts';
import type { KBLesson } from '../knowledgeBase.ts';
import type { Lang, PracticeWQ } from './mathPractice.ts';
import { distributeMinutes, type ActivityBlueprint, type ActivityBlueprintId } from './activityBlueprints.ts';
import { arabicLessonType, firstGradeContent } from './lessonPlanFirstGrade.ts';
import type { LessonKind } from './lessonPlanKinds.ts';

export interface FirstGradeActivityContext {
  topic: string;
  lang: Lang;
  kind: LessonKind;
  kb: KBLesson | null;
  /** Concrete items already drawn (maths); empty for every other subject. */
  practice: PracticeWQ[];
  duration: number;
  variant?: number;
  /** A unit or semester review: its warm-up looks back over the units, not at «yesterday's lesson». */
  revision?: boolean;
}

type Pair = { ar: string; en: string };

/** A quiz item's stem without its options or answer lines, to be read aloud. */
function spoken(item: PracticeWQ | undefined): string | null {
  if (!item) return null;
  return item.text.split('\n\n')[0]!.trim() || null;
}

/** One round of the game per kind: what the teacher says and how the children answer. */
function gameRound(ctx: FirstGradeActivityContext): Pair {
  const t = ctx.topic;
  switch (ctx.kind) {
    case 'arabic': {
      const lesson = arabicLessonType(ctx.kb?.titleAr ?? t);
      if (lesson.type === 'letter') {
        return {
          ar: `سأقول كلمات مألوفة واحدة بعد الأخرى: إذا كان فيها صوت حرف ${lesson.letter} يقف الفريق، وإن لم يكن يبقى جالسًا.`,
          en: `I will say familiar words one at a time: if a word has the sound of ${lesson.letter}, the team stands up; if not, they stay seated.`,
        };
      }
      return {
        ar: 'سأرفع بطاقة كلمة أو صورة، ويقرؤها الفريق أو يسمّيها بصوت واحد.',
        en: 'I will hold up a word or picture card, and the team reads or names it together.',
      };
    }
    case 'english':
      return {
        ar: 'لعبة «Simon says»: أقول كلمة من الدرس مع «Simon says» فيؤدّي الفريق حركتها، ومن دونها لا يتحرك أحد.',
        en: 'A “Simon says” game: when I say a lesson word with “Simon says” the team does its action; without it, nobody moves.',
      };
    case 'recitation':
      return {
        ar: `سأبدأ مقطعًا مما تعلّمناه في «${t}»، ويكمله الفريق بصوت واحد.`,
        en: `I will start a part of what we learned in “${t}”, and the team finishes it together.`,
      };
    case 'movement':
      return {
        ar: `سباق تتابع قصير: يؤدّي كل طفل في الفريق حركة «${t}» إلى القمع ويعود ويلمس يد زميله.`,
        en: `A short relay: each child in the team does “${t}” to the cone, comes back and touches the next child’s hand.`,
      };
    case 'making':
      return {
        ar: 'سأؤدّي إيقاعًا أو حركة أو أعرض لونًا، ويقلّده الفريق كما هو.',
        en: 'I will play a rhythm, do a movement or show a colour, and the team copies it exactly.',
      };
    case 'science':
    case 'social':
      return {
        ar: 'سأرفع صورة من الدرس، ويركض طفل من الفريق ليضعها في الصندوق الصحيح من صندوقين.',
        en: 'I will hold up a picture from the lesson, and one child from the team runs to put it in the right one of two boxes.',
      };
    case 'calc':
    default: {
      const q = spoken(ctx.practice[0]);
      return {
        ar: `سأقرأ سؤالًا بصوت عالٍ${q ? ` (مثل: «${q}»)` : ''}، ويرفع الفريق بطاقة العدد الصحيح أو يُظهره بالأصابع.`,
        en: `I will read a question aloud${q ? ` (like: “${q}”)` : ''}, and the team holds up the right number card or shows it with fingers.`,
      };
    }
  }
}

/** A hands-on task per kind: something the children make or handle. */
function handsOnTask(ctx: FirstGradeActivityContext): Pair {
  const t = ctx.topic;
  switch (ctx.kind) {
    case 'arabic': {
      const lesson = arabicLessonType(ctx.kb?.titleAr ?? t);
      if (lesson.type === 'letter') {
        return {
          ar: `يشكّل كل طفل حرف ${lesson.letter} بالصلصال أو بالخيط على ورقة، ثم يتتبّعه بإصبعه وهو ينطق صوته.`,
          en: `Each child shapes the letter ${lesson.letter} with clay or string on paper, then traces it with a finger while saying its sound.`,
        };
      }
      return {
        ar: 'يقصّ كل طفل صورًا ويلصقها بجانب الكلمة المناسبة على ورقة، ثم يقرأ الكلمات لي.',
        en: 'Each child cuts out pictures and sticks them next to the right word on a sheet, then reads the words to me.',
      };
    }
    case 'english':
      return {
        ar: 'يصنع كل طفل بطاقة صورة لكلمة من الدرس (يرسمها ويلوّنها)، ثم يرفعها ويقول كلمتها بالإنجليزية.',
        en: 'Each child makes a picture card for a lesson word (draws and colours it), then holds it up and says the word.',
      };
    case 'calc':
      return {
        ar: `يمثّل كل طفل «${t}» بالمكعبات أو الحبات على الطاولة، ثم يعدّ ويقول الناتج، ويقارنه بما أمثّله أنا على السبورة.`,
        en: `Each child builds “${t}” with cubes or beads on the table, counts and says the answer, and checks it against what I show on the board.`,
      };
    case 'science':
      return {
        ar: 'يتفحّص الأطفال أشياء حقيقية من الدرس بالعدسة واللمس، ويصنّفونها في صحنين، ثم يقول كل طفل لماذا وضع شيئه هنا.',
        en: 'The children examine real objects from the lesson with a magnifying glass and by touch, sort them onto two plates, and each says why they put theirs there.',
      };
    case 'social':
      return {
        ar: 'يصنع الأطفال من الورق المقوّى نموذجًا بسيطًا لما في الدرس (إشارة مرور، علم، بيت في الحي) ويلوّنونه، ثم يحكي كل طفل عنه بجملة.',
        en: 'The children make a simple card model of something in the lesson (a traffic light, a flag, a house in the neighbourhood) and colour it, then each says one sentence about it.',
      };
    case 'recitation':
      return {
        ar: `يلوّن كل طفل بطاقة صغيرة تعبّر عن «${t}» ليعلّقها في الصف أو في البيت، ويقول ما تذكّره به.`,
        en: `Each child colours a small card about “${t}” to hang in the class or at home, and says what it reminds them of.`,
      };
    case 'movement':
      return {
        ar: 'يرتّب الأطفال مع المعلم مسارًا بالأقماع والأطواق، ثم يمرّ كل طفل فيه مؤدّيًا الحركة.',
        en: 'The children set out a course of cones and hoops with me, then each child goes through it doing the movement.',
      };
    case 'making':
    default:
      return {
        ar: 'يصنع كل طفل عمله الصغير بالمواد المتاحة (رسمًا أو قصًّا ولصقًا أو آلة إيقاع بسيطة)، ويعرضه على زميله.',
        en: 'Each child makes their own small piece with the materials (a drawing, a cut-and-paste or a simple rhythm instrument) and shows it to a classmate.',
      };
  }
}

const TIPS: Pair[] = [
  { ar: 'تعليمات قصيرة، جملة واحدة في كل مرة، مع نموذج أؤدّيه قبل أن يبدأ الأطفال.', en: 'Short instructions, one sentence at a time, with a model I do before the children start.' },
  { ar: 'الإجابة بالإشارة أو بصوت واحد أو بالإبهام تشرك الصف كله، والكتابة لا تزيد على نسخ حرف أو كلمة أو عدد.', en: 'Answers by pointing, in one voice or with thumbs involve the whole class; writing is no more than copying a letter, word or number.' },
  { ar: 'أمدح المحاولة باسم الطفل، وأصحّح بإعادة النموذج لا بقول «خطأ».', en: 'Praise the try by the child’s name, and correct by repeating the model rather than saying “wrong”.' },
];

const L = (ctx: FirstGradeActivityContext, p: Pair) => (ctx.lang === 'ar' ? p.ar : p.en);

/**
 * A review covers several lessons, so everything it says names them all
 * («مفردات الدروس», never «مفردات الدرس»). The specific phrases go first; the
 * last rule of each language catches the rest («من الدرس» → «من الدروس»).
 */
const REVIEW_WORDING: Array<[RegExp, string]> = [
  [/أنشودة الدرس أو تسجيلها/g, 'أناشيد الدروس أو تسجيلاتها'],
  [/أنشودة الدرس/g, 'أناشيد الدروس'],
  [/الدرس/g, 'الدروس'],
  [/The lesson song or its recording/g, 'The lessons’ songs or their recordings'],
  [/as the lesson needs/g, 'as the lessons need'],
  [/the lesson words/g, 'the lessons’ words'],
  [/\b([Tt])he lesson\b(?![s’])/g, '$1he lessons'],
];
const forReview = (x: string) => REVIEW_WORDING.reduce((y, [re, to]) => y.replace(re, to), x);

export function buildFirstGradeActivity(id: ActivityBlueprintId, ctx: FirstGradeActivityContext): ActivityBlueprint {
  const b = oneLesson(id, ctx);
  if (!ctx.revision) return b;
  return {
    ...b,
    titleSuffix: forReview(b.titleSuffix), groupSize: forReview(b.groupSize), objective: forReview(b.objective),
    materials: b.materials.map(forReview), teacherTips: b.teacherTips.map(forReview),
    differentiation: forReview(b.differentiation), assessment: forReview(b.assessment),
    steps: b.steps.map(st => ({ ...st, title: forReview(st.title), description: forReview(st.description) })),
  };
}

function oneLesson(id: ActivityBlueprintId, ctx: FirstGradeActivityContext): ActivityBlueprint {
  const c = firstGradeContent(ctx.kind, ctx.topic, ctx.kb?.titleAr ?? ctx.topic);
  const ar = ctx.lang === 'ar';
  const t = ctx.topic;
  const tip = (i: number) => L(ctx, TIPS[(i + (ctx.variant ?? 0)) % TIPS.length]!);
  const mk = (pairs: Array<[string, string]>, weights: number[]) => {
    const minutes = distributeMinutes(ctx.duration, weights);
    return pairs.map(([title, description], i) => ({ stepNumber: i + 1, title, description, durationMin: minutes[i]! }));
  };
  const materials = ar ? c.materials.ar : c.materials.en;

  switch (id) {
    case 'individual':
      return {
        titleSuffix: ar ? 'عمل فردي' : 'Individual work',
        groupSize: ar ? 'فردي — كل طفل مع أشيائه' : 'Individual — each child with their own materials',
        objective: ar ? `أن يجرّب كل طفل «${t}» بنفسه بأشياء محسوسة` : `Each child tries “${t}” on their own with concrete materials`,
        materials: [...materials, ar ? 'سلة صغيرة من الأشياء لكل طفل' : 'A small tray of materials for each child'],
        steps: mk(ar ? [
          ['أعرض النموذج', c.show.ar],
          ['كل طفل يجرّب', c.alone.ar],
          ['أمرّ على كل طفل', 'سأمرّ على الأطفال واحدًا واحدًا، وأسأل كل طفل سؤالًا قصيرًا عمّا يفعله، ويجيب بكلمة أو بإشارة.'],
          ['يُري الطفل عمله', 'يرفع كل طفل عمله أو يُريه لي، وأمدح محاولته باسمه.'],
        ] : [
          ['I show the model', c.show.en],
          ['Each child tries', c.alone.en],
          ['I visit each child', 'I will go round the children one by one and ask each a short question about what they are doing; they answer with a word or by pointing.'],
          ['The child shows their work', 'Each child holds up or shows me their work, and I praise the try by name.'],
        ], [3, 4, 3, 2]),
        teacherTips: [tip(0), tip(1)],
        differentiation: ar
          ? 'دعم: أجلس قرب من يحتاج وأعطيه أشياء أقل ومثالًا أسهل. تحدٍّ: أعطي من ينهي مبكرًا مثالًا ثانيًا أصعب قليلًا.'
          : 'Support: I sit near children who need it and give fewer objects and an easier example. Challenge: early finishers get a second, slightly harder example.',
        assessment: ar
          ? 'ملاحظتي لكل طفل وهو يعمل، وإجابته الشفوية عن سؤالي، أسجّلهما في قائمة الصف.'
          : 'What I see each child do and their spoken answer to my question, noted on the class list.',
      };
    case 'group':
      return {
        titleSuffix: ar ? 'عمل في مجموعات صغيرة' : 'Small-group work',
        groupSize: ar ? 'مجموعات من 3 أطفال، لكل طفل دور واحد' : 'Groups of 3, one job per child',
        objective: ar ? `أن يتعاون الأطفال في «${t}» ولكل منهم دور واضح` : `Children work together on “${t}”, each with a clear job`,
        materials: [...materials, ar ? 'بطاقة دور مصوّرة لكل طفل (يحمل، يقول، يشير)' : 'A picture role card for each child (holds, says, points)'],
        steps: mk(ar ? [
          ['أعرض وأوزّع الأدوار', `${c.show.ar}\nثم سأوزّع الأطفال في مجموعات ثلاثية، وأعطي كل طفل بطاقة دور مصوّرة: «أحمل البطاقات»، «أقول»، «أشير».`],
          ['تعمل المجموعة', `في كل مجموعة: ${c.pairRoles.ar}، والطفل الثالث يشير إلى الصورة الصحيحة. يتبادلون الأدوار عند صفّارتي.`],
          ['كل مجموعة تُرينا', 'تقف كل مجموعة وتُري الصف شيئًا واحدًا فعلته، ويصفّق الصف لها.'],
          ['سؤال لكل طفل', 'سأسأل طفلًا من كل مجموعة سؤالًا شفويًا قصيرًا، وأختار كل مرة طفلًا مختلفًا.'],
        ] : [
          ['I show and hand out jobs', `${c.show.en}\nThen I will put the children in groups of three and give each child a picture job card: “I hold the cards”, “I say”, “I point”.`],
          ['The group works', `In each group: ${c.pairRoles.en}, and the third child points to the right picture. They swap jobs at my whistle.`],
          ['Each group shows us', 'Each group stands and shows the class one thing they did, and the class claps.'],
          ['A question for each child', 'I will ask one child from each group a short spoken question, choosing a different child each time.'],
        ], [3, 5, 3, 2]),
        teacherTips: [tip(1), ar ? 'أشكّل المجموعات بنفسي، وأضع في كل مجموعة طفلًا يقرأ وطفلًا يحتاج إلى دعم.' : 'I form the groups myself, with a confident reader and a child who needs support in each.'],
        differentiation: ar
          ? 'دعم: الطفل الذي يحتاج دعمًا يأخذ دور «أشير» أولًا. تحدٍّ: الطفل المتمكّن يأخذ دور «أقول» ويساعد زميليه.'
          : 'Support: the child who needs help takes the “I point” job first. Challenge: a confident child takes “I say” and helps the other two.',
        assessment: ar
          ? 'أقيّم كل طفل وحده بسؤالي الشفوي في الخطوة الأخيرة، لا المجموعة.'
          : 'I assess each child alone through my spoken question in the last step, not the group.',
      };
    case 'discussion':
      return {
        titleSuffix: ar ? 'حلقة حوار' : 'Talking circle',
        groupSize: ar ? 'الصف كله في دائرة' : 'The whole class in a circle',
        objective: ar ? `أن يتحدث الأطفال عن «${t}» بجمل قصيرة ويصوّتوا بالإبهام` : `Children talk about “${t}” in short sentences and vote with thumbs`,
        materials: [...materials, ar ? 'صورة كبيرة من الدرس' : 'A large picture from the lesson'],
        steps: mk(ar ? [
          ['نجلس في دائرة', 'سأجلس مع الأطفال في دائرة، وأضع الصورة الكبيرة في الوسط، وأسأل: «ماذا ترون؟» ويقول كل طفل كلمة.'],
          ['صح أم خطأ؟', 'سأقول جملة قصيرة عن الدرس، صحيحة مرة وخاطئة مرة، ويرفع الأطفال الإبهام للأعلى إن كانت صحيحة وللأسفل إن كانت خاطئة.'],
          ['لماذا؟', 'سأسأل طفلين أو ثلاثة: «لماذا؟» ويجيب كل منهم بكلمة أو جملة قصيرة تبدأ بـ«لأنّ…»، وأساعد من يتوقف.'],
          ['نصوّت مرة ثانية', 'نعيد التصويت بالإبهام على الجملة نفسها، ثم سأقول الجملة الصحيحة ويردّدها الأطفال معي.'],
        ] : [
          ['We sit in a circle', 'I will sit with the children in a circle, put the large picture in the middle and ask “What do you see?”; each child says one word.'],
          ['True or false?', 'I will say a short sentence about the lesson, sometimes true and sometimes false; the children show thumbs up for true and thumbs down for false.'],
          ['Why?', 'I will ask two or three children “Why?”; each answers with a word or a short sentence starting “Because…”, and I help anyone who stops.'],
          ['We vote again', 'We vote again with thumbs on the same sentence, then I say the right sentence and the children repeat it with me.'],
        ], [3, 3, 4, 2]),
        teacherTips: [tip(2), ar ? 'أنتظر ثلاث ثوانٍ بعد كل سؤال قبل أن أختار طفلًا ليجيب.' : 'I wait three seconds after each question before choosing a child to answer.'],
        differentiation: ar
          ? 'دعم: أعطي الطفل المتردّد بداية الجملة («أرى…»، «لأنّ…»). تحدٍّ: أطلب من طفل أن يقول جملة صحيحة جديدة عن الصورة.'
          : 'Support: I give a hesitant child a sentence starter (“I see…”, “Because…”). Challenge: I ask a child to say a new true sentence about the picture.',
        assessment: ar
          ? 'الإبهام في التصويتين يُظهر لي من فهم، وأسجّل من أجاب عن «لماذا؟».'
          : 'The thumbs in the two votes show me who understood, and I note who answered “Why?”.',
      };
    case 'hands-on': {
      const task = handsOnTask(ctx);
      return {
        titleSuffix: ar ? 'نشاط عملي' : 'Hands-on activity',
        groupSize: ar ? 'ثنائيات، ولكل طفل عمله' : 'Pairs, each child with their own piece',
        objective: ar ? `أن يصنع الأطفال أو يحرّكوا بأيديهم ما يتعلّق بـ«${t}»` : `Children make or handle with their hands what “${t}” is about`,
        materials: [...materials, ar ? 'صلصال أو مكعبات أو ورق مقوّى ومقص آمن وصمغ حسب الدرس' : 'Clay, cubes, or card with safe scissors and glue, as the lesson needs'],
        steps: mk(ar ? [
          ['أُري المواد', 'سأعرض المواد على الطاولة وأسمّي كل واحدة، وأذكّر بقاعدة السلامة: «نستعمل المقص والصمغ بهدوء».'],
          ['نصنع بأيدينا', task.ar],
          ['نقارن بالنموذج', 'يضع كل طفل عمله بجانب النموذج الذي صنعته أنا، ويقول ما المتشابه.'],
          ['نرتّب ونعرض', 'يرتّب الأطفال المكان، ونضع الأعمال على طاولة العرض.'],
        ] : [
          ['I show the materials', 'I will lay out the materials and name each one, with the safety rule: “We use scissors and glue calmly.”'],
          ['We make it with our hands', task.en],
          ['We compare with the model', 'Each child puts their piece next to the model I made and says what is the same.'],
          ['We tidy and display', 'The children tidy up, and we put the work on the display table.'],
        ], [2, 6, 3, 2]),
        teacherTips: [tip(0), ar ? 'أجهّز المواد في سلال قبل الحصة، سلة لكل ثنائي.' : 'I prepare the materials in trays before the lesson, one per pair.'],
        differentiation: ar
          ? 'دعم: أعطي الطفل نموذجًا جاهزًا نصفه ليكمله. تحدٍّ: يصنع الطفل قطعة ثانية مختلفة.'
          : 'Support: I give the child a half-finished model to complete. Challenge: the child makes a second, different piece.',
        assessment: ar
          ? 'ما صنعه كل طفل وما قاله عنه في المقارنة، وأسجّل ملاحظتي في قائمة الصف.'
          : 'What each child made and what they said about it in the comparison, noted on the class list.',
      };
    }
    case 'game': {
      const round = gameRound(ctx);
      return {
        titleSuffix: ar ? 'لعبة تعليمية' : 'Learning game',
        groupSize: ar ? 'فريقان أو ثلاثة فرق' : 'Two or three teams',
        objective: ar ? `أن يتذكّر الأطفال «${t}» في لعبة بجولات وفريق فائز` : `Children recall “${t}” in a game with rounds and a winning team`,
        materials: [...materials, ar ? 'لوحة نقاط بالنجوم على السبورة' : 'A star score board on the board'],
        steps: mk(ar ? [
          ['القواعد بمثال', 'سأقسم الصف إلى فرق، وأؤدّي جولة تجريبية أمامهم لأُريهم كيف نلعب، وأعلن: «كل إجابة صحيحة نجمة للفريق».'],
          ['الجولة الأولى', round.ar],
          ['الجولة الثانية — أسرع', 'نعيد اللعبة بأمثلة جديدة وبسرعة أكبر، وأضيف نجمة للفريق الذي يجيب كله معًا.'],
          ['الفائز ونشيد', 'نعدّ النجوم معًا بصوت واحد، ونصفّق للفريق الفائز ولكل الفرق، ثم نردّد ما تعلّمناه بجملة.'],
        ] : [
          ['Rules by example', 'I will split the class into teams and play a practice round in front of them to show how we play: “Every right answer is a star for the team.”'],
          ['Round one', round.en],
          ['Round two — faster', 'We play again with new examples and faster, with an extra star for a team that answers all together.'],
          ['The winner and a song', 'We count the stars together aloud, clap for the winning team and for every team, then say what we learned in one sentence.'],
        ], [2, 5, 4, 2]),
        teacherTips: [tip(2), ar ? 'أحدّث النجوم على السبورة بعد كل سؤال أمام الجميع، وأنهي اللعبة والجميع فرِح.' : 'I update the stars on the board after every question, and end the game with everyone happy.'],
        differentiation: ar
          ? 'دعم: أوزّع الفرق متكافئة، وأعطي كل طفل دورًا في الإجابة. تحدٍّ: يقرأ طفل متمكّن سؤال الجولة الثانية بدلًا مني.'
          : 'Support: I make balanced teams and give every child a turn to answer. Challenge: a confident child reads a round-two question instead of me.',
        assessment: ar
          ? 'الأمثلة التي أخطأت فيها الفرق هي التي أعيدها مع الصف في الحصة القادمة.'
          : 'The examples the teams got wrong are the ones I go over with the class next lesson.',
      };
    }
    case 'warmup':
    default:
      if (ctx.revision) {
        return {
          titleSuffix: ar ? 'تهيئة' : 'Warm-up',
          groupSize: ar ? 'الصف كله' : 'The whole class',
          objective: ar ? `أن يتهيّأ الأطفال لمراجعة «${t}» بنشيد وصور مما تعلّموه` : `Children get ready to review “${t}” with a song and pictures of what they learned`,
          materials: ar ? ['أنشودة قصيرة', 'صور من الدروس التي نراجعها'] : ['A short song', 'Pictures from the lessons we are reviewing'],
          steps: mk(ar ? [
            ['نشيد وحركة', 'سننشد معًا أنشودة قصيرة مع حركات، ليقف الأطفال ويتحركوا.'],
            ['ماذا نتذكّر؟', 'سأرفع صورًا مما تعلّمناه في هذه الدروس واحدة بعد واحدة، وأسأل: «ماذا تذكرون؟» ويجيب طفلان أو ثلاثة بكلمة.'],
            ['إلى المراجعة', 'سأقول للأطفال إننا سنلعب اليوم ونتذكّر معًا ما تعلّمناه، وأرتّب الصور على السبورة لنعود إليها.'],
          ] : [
            ['A song and actions', 'We will sing a short song with actions, so the children stand and move.'],
            ['What do we remember?', 'I will hold up pictures of what we learned in these lessons one by one and ask “What do you remember?”; two or three children answer with a word.'],
            ['Into the review', 'I will tell the children that today we play and remember together what we learned, and put the pictures up on the board to come back to.'],
          ], [2, 2, 2]),
          teacherTips: [tip(1)],
          differentiation: ar
            ? 'أعطي الطفل المتردّد فرصة الإجابة بالإشارة إلى الصورة.'
            : 'I let a hesitant child answer by pointing at the picture.',
          assessment: ar
            ? 'الصور التي لم يتذكّرها الأطفال هي التي أبدأ بها المراجعة.'
            : 'The pictures the children did not remember are where I start the review.',
        };
      }
      return {
        titleSuffix: ar ? 'تهيئة' : 'Warm-up',
        groupSize: ar ? 'الصف كله' : 'The whole class',
        objective: ar ? `أن يتهيّأ الأطفال لـ«${t}» بنشيد وسؤال من الدرس السابق` : `Children get ready for “${t}” with a song and a question from the last lesson`,
        materials: ar ? ['أنشودة قصيرة', 'صورة من الدرس السابق'] : ['A short song', 'A picture from the last lesson'],
        steps: mk(ar ? [
          ['نشيد وحركة', 'سننشد معًا أنشودة قصيرة مع حركات، ليقف الأطفال ويتحركوا.'],
          ['ماذا تعلّمنا أمس؟', 'سأرفع صورة من الدرس السابق، وأسأل: «ماذا تذكرون؟» ويجيب طفلان أو ثلاثة بكلمة.'],
          ['إلى درس اليوم', `${c.intro.ar}`],
        ] : [
          ['A song and actions', 'We will sing a short song with actions, so the children stand and move.'],
          ['What did we learn last time?', 'I will hold up a picture from the last lesson and ask “What do you remember?”; two or three children answer with a word.'],
          ['Into today’s lesson', `${c.intro.en}`],
        ], [2, 2, 2]),
        teacherTips: [tip(1)],
        differentiation: ar
          ? 'أعطي الطفل المتردّد فرصة الإجابة بالإشارة إلى الصورة.'
          : 'I let a hesitant child answer by pointing at the picture.',
        assessment: ar
          ? 'من تذكّر الدرس السابق ومن لم يتذكّره، لأبدأ به اليوم.'
          : 'Who remembered the last lesson and who did not, so I start with them today.',
      };
  }
}

/** Spoken quick-check prompts for a Grade 1 lesson with no question bank. */
export function firstGradeCheckPrompts(kind: LessonKind, topic: string, titleAr: string, lang: Lang): Array<{ prompt: string; expected: string }> {
  const ar = lang === 'ar';
  const out = (rows: Array<[string, string, string, string]>) => rows.map(([pa, ea, pe, ee]) => (ar ? { prompt: pa, expected: ea } : { prompt: pe, expected: ee }));
  if (kind === 'arabic') {
    const lesson = arabicLessonType(titleAr || topic);
    if (lesson.type === 'letter') {
      const l = lesson.letter;
      return out([
        [`قولوا كلمة تبدأ بصوت حرف ${l}.`, `أي كلمة مألوفة تبدأ بصوت ${l}.`, `Say a word that starts with the sound of ${l}.`, `Any familiar word starting with ${l}.`],
        [`صفّقوا عندما تسمعون صوت حرف ${l} في الكلمة.`, `يصفّق الأطفال للكلمات التي فيها ${l} فقط.`, `Clap when you hear the sound of ${l} in the word.`, `The children clap only for words with ${l}.`],
        [`أين حرف ${l} في الكلمة: في أولها أم في وسطها أم في آخرها؟ أشيروا.`, 'يشير الأطفال إلى موضع الحرف في كلمة أكتبها على السبورة.', `Where is ${l} in the word: at the start, the middle or the end? Point.`, 'The children point to where the letter is in a word I write on the board.'],
      ]);
    }
    return out([
      ['ماذا ترون في الصورة؟ قولوا كلمة واحدة.', 'كلمة صحيحة من موضوع الدرس.', 'What do you see in the picture? Say one word.', 'A right word from the lesson’s theme.'],
      ['اقرؤوا الكلمة معي بصوت واحد.', 'يقرأ الأطفال كلمة من الدرس أشير إليها.', 'Read the word with me together.', 'The children read a lesson word I point to.'],
      ['أشيروا إلى الصورة التي تناسب الكلمة.', 'يشير الأطفال إلى الصورة الصحيحة.', 'Point to the picture that matches the word.', 'The children point to the right picture.'],
    ]);
  }
  if (kind === 'english') {
    return out([
      ['What’s this? (أرفع بطاقة صورة)', 'يقول الأطفال اسم الصورة بالإنجليزية.', 'What’s this? (I hold up a picture card)', 'The children say the picture’s name in English.'],
      ['Point to … (أقول كلمة من الدرس)', 'يشير الأطفال إلى الصورة الصحيحة.', 'Point to … (I say a lesson word)', 'The children point to the right picture.'],
      ['Show me! (أقول كلمة ويؤدّون حركتها)', 'يؤدّي الأطفال حركة الكلمة.', 'Show me! (I say a word and they do its action)', 'The children do the word’s action.'],
    ]);
  }
  if (kind === 'recitation' && /سوره|سورة/.test(titleAr)) {
    return out([
      [`لنتلُ معًا ${topic}.`, 'يتلو الأطفال ما حفظوه بصوت واحد.', `Let’s recite ${topic} together.`, 'The children recite what they have learned in one voice.'],
      ['أكملوا ما أبدؤه من الآيات.', 'يكمل الأطفال المقطع الذي أبدؤه.', 'Finish the part I start.', 'The children finish the part I start.'],
      ['ارفعوا أيديكم: من يتلوها وحده؟', 'يتلو طفلان أو ثلاثة أمام الصف.', 'Hands up: who can recite it alone?', 'Two or three children recite to the class.'],
    ]);
  }
  return out([
    ['ما اسم هذا؟ (أعرض صورة من الدرس)', 'يقول الأطفال اسم الصورة بكلمة.', 'What is this called? (I show a picture from the lesson)', 'The children name the picture in a word.'],
    ['صح أم خطأ؟ ارفعوا الإبهام للصح وأنزلوه للخطأ. (أقول جملة عن الدرس)', 'الإبهام للأعلى للجملة الصحيحة وللأسفل للخاطئة.', 'True or false? Thumbs up for true, down for false. (I say a sentence about the lesson)', 'Thumbs up for a true sentence, down for a false one.'],
    ['أشيروا إلى الصورة الصحيحة.', 'يشير الأطفال إلى الصورة التي تناسب الدرس.', 'Point to the right picture.', 'The children point to the picture that fits the lesson.'],
  ]);
}

/** The quick-check slides for a Grade 1 lesson with no bank: spoken, answered all together, no writing. */
export function firstGradeCheckSlides(kind: LessonKind, topic: string, titleAr: string, lang: Lang): ActivitySlide[] {
  const ar = lang === 'ar';
  const prompts = firstGradeCheckPrompts(kind, topic, titleAr, lang);
  return [
    {
      slideNumber: 1,
      type: 'intro',
      title: ar ? '🙋 تحقق سريع' : '🙋 Quick Check',
      content: ar
        ? `${topic}\n\nكيف نلعب:\n• أسأل سؤالًا\n• نجيب كلنا معًا: بالإشارة أو بصوت واحد أو بالإبهام\n• لا نكتب شيئًا`
        : `${topic}\n\nHow we play:\n• I ask a question\n• We all answer together: by pointing, in one voice or with thumbs\n• No writing`,
      durationSeconds: 0,
    },
    ...prompts.map((p, i) => ({
      slideNumber: i + 2,
      type: 'challenge' as const,
      title: ar ? `سؤال ${i + 1}` : `Question ${i + 1}`,
      content: p.prompt,
      durationSeconds: 30,
      teacher: {
        expectedAnswer: p.expected,
        teachingTips: ar
          ? 'أنظر إلى الصف كله وهو يجيب: من أشار أو قال الإجابة الصحيحة، ومن ينتظر غيره.'
          : 'Watch the whole class answer: who points to or says the right answer, and who waits for others.',
      },
    })),
    {
      slideNumber: prompts.length + 2,
      type: 'summary',
      title: ar ? '🎉 أحسنتم!' : '🎉 Well done!',
      content: ar ? `أجبنا كلنا عن ${topic}. نصفّق لأنفسنا!` : `We all answered about ${topic}. Let’s clap for ourselves!`,
      durationSeconds: 0,
    },
  ];
}
