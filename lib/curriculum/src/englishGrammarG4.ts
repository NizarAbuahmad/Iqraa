/**
 * Grade 4 grammar for the English corner: 9 units, S1 U1–U5 and S2 U7–U10 (S2 U6 is a revision unit with no
 * word list, so it is not a hub lesson).
 *
 * Spec: docs/superpowers/specs/2026-10-22-english-corner-grammar-g4-design.md.
 * The book's grammar is comparison, modals, the past simple, so most lessons carry no pictures; a picture appears
 * only where it shows what the sentence says. Comparisons come from written rows a teacher checks (`RANKING`), the
 * past forms from `PAST_OVERRIDES` and `ADJECTIVE_FORMS` in the engine. Every unit ships `reviewedBy: null`: it is
 * offered to nobody until a teacher signs the printed form. `NOT_COVERED_G4` is what the form says is left out.
 *
 * Imports only types from the engine: `englishGrammar.ts` imports this file.
 */
import type { GrammarUnit } from './englishGrammar.ts';

const L = (sem: 1 | 2, unit: number) => `kbl-g4-eng-s${sem}-nccd-u${unit}_l1`;

// ─── S1 U1–U3 ─────────────────────────────────────────────────────────────

const COUNTRY_ROWS = [
  { country: 'Egypt', nat: 'Egyptian' }, { country: 'Jordan', nat: 'Jordanian' }, { country: 'Qatar', nat: 'Qatari' },
  { country: 'Spain', nat: 'Spanish' }, { country: 'the United Kingdom', nat: 'British' }, { country: 'the United Arab Emirates', nat: 'Emirati' },
];
const COUNTRIES = COUNTRY_ROWS.map(r => r.country);
const LIKES = ['canoeing', 'going shopping', 'playing basketball', 'playing football', 'playing table tennis', 'playing tennis', 'reading', 'swimming'];

/** An invented timetable: the subject, day and time are not information. The form says so. */
const TIMETABLE = [
  { subject: 'Arabic', day: 'Sunday', time: '8' }, { subject: 'Maths', day: 'Monday', time: '9' }, { subject: 'English', day: 'Tuesday', time: '10' },
  { subject: 'Science', day: 'Wednesday', time: '11' }, { subject: 'Art', day: 'Thursday', time: '12' }, { subject: 'PE', day: 'Sunday', time: '10' },
  { subject: 'Digital Skills', day: 'Monday', time: '11' }, { subject: 'Islamic Studies', day: 'Tuesday', time: '8' }, { subject: 'Social Studies', day: 'Wednesday', time: '9' },
];
const FREQ = ['always', 'never', 'often', 'sometimes'];
const WHEN = ['every day', 'at the weekend', 'once a week', 'twice a week', 'three times a week'];
const SPORTS5 = ['watch TV', 'read books', 'play tennis', 'play basketball', 'do karate'];
const HOW_OFTEN = [
  { act: 'play tennis', when: 'twice a week' }, { act: 'watch TV', when: 'every day' }, { act: 'read books', when: 'at the weekend' },
  { act: 'do karate', when: 'once a week' }, { act: 'play basketball', when: 'three times a week' },
];
const WHEN_ROWS = [
  { act: 'play tennis', when: 'twice a week' }, { act: 'watch TV', when: 'every day' }, { act: 'read books', when: 'at the weekend' },
  { act: 'do karate', when: 'once a week' }, { act: 'play basketball', when: 'three times a week' }, { act: 'roller skate', when: 'at the weekend' },
  { act: 'skateboard', when: 'every day' }, { act: 'play badminton', when: 'once a week' },
];

/** Countable plural and uncountable foods, classed by hand. `milkshake` is a singular countable and is left out of the quantity patterns. */
const FOOD_PL = ['cupcakes', 'noodles', 'olives', 'sandwiches', 'vegetables'];
const FOOD_UNC = ['cereal', 'fruit', 'salad', 'coffee', 'lemonade', 'tea'];
const CONTAINERS = [
  { cont: 'a bowl of', unc: 'salad' }, { cont: 'a glass of', unc: 'lemonade' }, { cont: 'a cup of', unc: 'coffee' },
  { cont: 'a cup of', unc: 'tea' }, { cont: 'a box of', unc: 'cereal' }, { cont: 'a bag of', unc: 'fruit' },
];
// ─── S1 U4–U5 ─────────────────────────────────────────────────────────────

/** Plainly true comparisons: the first is the bigger, higher, deeper or wider. Every pair is on the teacher's form; the swapped twin is the false statement. */
const RANKING = [
  { big: 'mountain', small: 'hill', adj: 'high' }, { big: 'lake', small: 'pool', adj: 'deep' }, { big: 'sea', small: 'lake', adj: 'deep' },
  { big: 'river', small: 'stream', adj: 'wide' }, { big: 'lion', small: 'rabbit', adj: 'dangerous' }, { big: 'shark', small: 'goldfish', adj: 'dangerous' },
];
const RANKING_SWAPPED = RANKING.map(r => ({ big: r.small, small: r.big, adj: r.adj }));
const LONG_ROWS = [
  { a: 'Swimming', b: 'walking', adj: 'exciting' }, { a: 'Canoeing', b: 'reading', adj: 'exciting' }, { a: 'Football', b: 'chess', adj: 'difficult' },
];
const SUPER_ROWS = [
  { adj: 'deep', n: 'lake', where: 'Jordan' }, { adj: 'high', n: 'mountain', where: 'Jordan' }, { adj: 'wide', n: 'river', where: 'Jordan' },
  { adj: 'beautiful', n: 'island', where: 'the world' }, { adj: 'interesting', n: 'town', where: 'Jordan' },
];
const JOBS4 = ['bus driver', 'carpenter', 'chef', 'doctor', 'farmer', 'firefighter', 'mechanic', 'police officer', 'scientist', 'teacher', 'vet'];
/** What a pupil must and mustn't do at school. Every rule is on the form, so a wrong rule cannot be generated. */
const MUST = ['arrive on time', 'be quiet in class', 'follow the rules', 'put litter in the bin'];
const MUSTNT = ['be late', 'break the rules', 'drop litter', 'shout in class'];
const WEAR = [
  { colour: 'green', clothes: 'coat' }, { colour: 'red', clothes: 'dress' }, { colour: 'blue', clothes: 'hat' },
  { colour: 'yellow', clothes: 'scarf' }, { colour: 'white', clothes: 'shirt' }, { colour: 'green', clothes: 'jacket' },
];
const COMPARE_FACT = { question: 'Is the {big} {cmp:adj} than the {small}?', yes: 'Yes, it is.', no: "No, it isn't." } as const;

const THERE_Q = (question: string, yes: string, no: string) => ({ kind: 'marker' as const, question, yes, no, hint: 'there' as const });

export const GRAMMAR_UNITS_G4: GrammarUnit[] = [
  {
    // to be and like: Where are you from? I'm from Jordan. I'm Jordanian. I like swimming. He likes reading.
    lessonId: L(1, 1),
    reviewedBy: null,
    patterns: [
      { id: 'from', text: "I'm from {v:country}.", picture: 'country', choose: { kind: 'slot', slot: 'country' } },
      { id: 'hefrom', text: "He's from {v:country}.", picture: 'country', marker: 'boy', choose: { kind: 'phrase', right: "He's", wrong: "She's" } },
      { id: 'shefrom', text: "She's from {v:country}.", picture: 'country', marker: 'girl', choose: { kind: 'phrase', right: "She's", wrong: "He's" } },
      { id: 'where', text: "Where are you from? I'm from {v:country}.", picture: 'country' },
      { id: 'isfrom', text: 'Are you from {v:country}? Yes, I am.', picture: 'country', yesNo: { kind: 'match', question: 'Are you from {v:country}?', yes: 'Yes, I am.', no: "No, I'm not." } },
      // No Choose: a nationality has no picture, so there is nothing to show the other option against.
      { id: 'nat', text: "I'm {nat}.", picture: 'country', rows: COUNTRY_ROWS },
      { id: 'like', text: 'I like {act}.', choose: { kind: 'phrase', right: 'like', wrong: 'likes' } },
      { id: 'helikes', text: 'He likes {act}.', choose: { kind: 'phrase', right: 'likes', wrong: 'like' } },
      { id: 'shelikes', text: 'She likes {act}.', choose: { kind: 'phrase', right: 'likes', wrong: 'like' } },
    ],
    slots: { country: COUNTRIES, act: LIKES },
  },
  {
    // present simple with days and times; adverbs of frequency. No pictures: school subjects and habits.
    lessonId: L(1, 2),
    reviewedBy: null,
    patterns: [
      { id: 'timetable', text: "We have {v:subject} on {s:day} at {time} o'clock.", rows: TIMETABLE, choose: { kind: 'phrase', right: 'on', wrong: 'at' } },
      { id: 'hefreq', text: 'He {freq} {3:act}.', choose: { kind: 'form', slot: 'act' } },
      { id: 'shewhen', text: 'She {3:act} {v:when}.', rows: WHEN_ROWS, choose: { kind: 'form', slot: 'act' } },
      { id: 'often', text: 'How often do you {v:act}? I {v:act} {v:when}.', rows: HOW_OFTEN, choose: { kind: 'phrase', right: 'do', wrong: 'does' } },
    ],
    slots: { freq: FREQ, act: SPORTS5, when: WHEN },
  },
  {
    // there is / are with countable and uncountable nouns; a lot of, a little, any.
    lessonId: L(1, 3),
    reviewedBy: null,
    patterns: [
      { id: 'lotu', text: "There's a lot of {unc}.", picture: 'unc', marker: 'yes', choose: { kind: 'phrase', right: "There's", wrong: 'There are' } },
      { id: 'lotp', text: 'There are a lot of {pl}.', picture: 'pl', marker: 'many', choose: { kind: 'phrase', right: 'There are', wrong: "There's" } },
      { id: 'little', text: "There's a little {unc}.", picture: 'unc', marker: 'yes', choose: { kind: 'phrase', right: 'a little', wrong: 'a few' } },
      { id: 'anyu', text: "There isn't any {unc}.", picture: 'unc', marker: 'no', choose: { kind: 'phrase', right: "isn't", wrong: "aren't" } },
      { id: 'anyp', text: "There aren't any {pl}.", picture: 'pl', marker: 'no', choose: { kind: 'phrase', right: "aren't", wrong: "isn't" } },
      { id: 'cont', text: "There's {v:cont} {unc}.", picture: 'unc', marker: 'yes', rows: CONTAINERS },
      { id: 'qpy', text: 'Are there any {pl}? Yes, there are.', picture: 'pl', marker: 'yes', yesNo: THERE_Q('Are there any {pl}?', 'Yes, there are.', "No, there aren't.") },
      { id: 'qpn', text: "Are there any {pl}? No, there aren't.", picture: 'pl', marker: 'no', yesNo: THERE_Q('Are there any {pl}?', 'Yes, there are.', "No, there aren't.") },
      { id: 'quy', text: 'Is there any {unc}? Yes, there is.', picture: 'unc', marker: 'yes', yesNo: THERE_Q('Is there any {unc}?', 'Yes, there is.', "No, there isn't.") },
      { id: 'qun', text: "Is there any {unc}? No, there isn't.", picture: 'unc', marker: 'no', yesNo: THERE_Q('Is there any {unc}?', 'Yes, there is.', "No, there isn't.") },
    ],
    slots: { unc: FOOD_UNC, pl: FOOD_PL },
  },
  {
    // comparatives and superlatives. No pictures; True or false and Yes or No only from the written ranking rows.
    lessonId: L(1, 4),
    reviewedBy: null,
    patterns: [
      { id: 'cmp', text: 'The {big} is {cmp:adj} than the {small}.', rows: RANKING, claim: { swap: ['big', 'small'] }, choose: { kind: 'form', slot: 'adj', wrong: 'base' } },
      { id: 'cmpy', text: 'Is the {big} {cmp:adj} than the {small}? Yes, it is.', rows: RANKING, yesNo: { kind: 'fact', ...COMPARE_FACT, answer: true } },
      { id: 'cmpn', text: "Is the {big} {cmp:adj} than the {small}? No, it isn't.", rows: RANKING_SWAPPED, yesNo: { kind: 'fact', ...COMPARE_FACT, answer: false } },
      { id: 'long', text: '{a} is {cmp:adj} than {b}.', rows: LONG_ROWS, choose: { kind: 'form', slot: 'adj', wrong: 'base' } },
      { id: 'sup', text: 'This is the {sup:adj} {n} in {v:where}.', rows: SUPER_ROWS, choose: { kind: 'form', slot: 'adj', wrong: 'comparative' } },
      { id: 'amman', text: 'Amman is the {sup:adj} city in the world.', choose: { kind: 'form', slot: 'adj', wrong: 'comparative' } },
    ],
    slots: { adj: ['exciting', 'beautiful', 'interesting'] },
  },
  {
    // present continuous with clothes and colours; must / mustn't
    lessonId: L(1, 5),
    reviewedBy: null,
    patterns: [
      { id: 'hejob', text: "He's {a:job}.", picture: 'job', marker: 'boy', choose: { kind: 'slot', slot: 'job' } },
      { id: 'shejob', text: "She's {a:job}.", picture: 'job', marker: 'girl', choose: { kind: 'slot', slot: 'job' } },
      { id: 'must', text: 'You must {v:rule}.', rows: MUST.map(rule => ({ rule })), choose: { kind: 'phrase', right: 'must', wrong: "mustn't" } },
      { id: 'mustnt', text: "You mustn't {v:rule}.", rows: MUSTNT.map(rule => ({ rule })), choose: { kind: 'phrase', right: "mustn't", wrong: 'must' } },
      { id: 'wear', text: "I'm wearing {a:colour} {clothes}.", picture: 'clothes', rows: WEAR, choose: { kind: 'slot', slot: 'clothes' } },
      { id: 'wearq', text: 'Are you wearing {a:colour} {clothes}? Yes, I am.', picture: 'clothes', rows: WEAR, yesNo: { kind: 'match', question: 'Are you wearing {a:colour} {clothes}?', yes: 'Yes, I am.', no: "No, I'm not." } },
    ],
    slots: { job: JOBS4 },
  },
];

/**
 * What a Grade 4 lesson does not cover, and why — printed on the teacher's form. One bullet per item,
 * Arabic with English phrases inline; no `"`, `&`, `<` or `>` (the form does not escape runs).
 */
export const NOT_COVERED_G4: Record<string, string[]> = {
  [L(1, 4)]: [
    'لا صور في هذه الوحدة: صورة جبل لا تقول إنه أعلى من تلّ. «صح أم خطأ» و«نعم أم لا» من قائمة المقارنات المكتوبة فقط، وكل زوج فيها مطبوع في صفحة البيانات لتتأكدوا أنه صحيح دون جدال.',
    'جملة A is more exciting than B وجمل أعلى وأعمق (the deepest) في «اختر الكلمة» و«رتّب الجملة» فقط: لا تُسأل صحةً، لأنها رأي لا معلومة.',
    'خيارا «اختر الكلمة» دائمًا صيغتان حقيقيتان: higher مقابل high، وthe deepest مقابل the deeper. لم تُكتب صيغة غير موجودة.',
  ],
  [L(1, 5)]: [
    'قواعد must وmustn\'t ثماني جمل مكتوبة جملة جملة في صفحة البيانات، فلا يمكن أن تُولَّد قاعدة خاطئة.',
    'jacket بلا صورة فلا تظهر جملتاها في «صح أم خطأ» و«نعم أم لا» ولا «اختر الكلمة».',
    'الجمل المستمرة عن الملابس والألوان من كلمات الصفوف السابقة: الصورة تدل على قطعة الملابس فقط، لا على لونها.',
  ],
  [L(1, 1)]: [
    'الجنسيات (Egyptian وJordanian…) بلا صور، فلا تظهر في «اختر الكلمة»: يظهر علم البلد في «صح أم خطأ» فقط.',
    'جملة Where are you from? I\'m from the United Arab Emirates. أطول من تسع كلمات، فيُرتَّب جوابها فقط.',
  ],
  [L(1, 2)]: [
    'لا صور لهذه الوحدة: كلماتها مواد دراسية وعادات وأوقات، فتبقى «اختر الكلمة» و«رتّب الجملة» فقط.',
    'الجدول الدراسي مخترَع: المادة واليوم والساعة ليست معلومة، وهي مكتوبة جملة جملة في القائمة.',
    'في «اختر الكلمة» يُسأل عن on وat، وعن plays وplay، وعن do وdoes.',
  ],
  [L(1, 3)]: [
    'milkshake اسم مفرد معدود، فلا يدخل في جمل a lot of وa little. بقية الأطعمة صُنِّفت يدويًا: معدودة بالجمع (cupcakes وnoodles وolives وsandwiches وvegetables) وغير معدودة (cereal وfruit وsalad وcoffee وlemonade وtea).',
    'الصورة تدل على وجود الطعام فقط، لا على مقداره: تظهر ✅ مع a lot of وa little، و❌ مع any في النفي.',
    'a few لا يظهر إلا خيارًا خاطئًا مقابل a little، ولم يُكتب جملةً صحيحة لأن الكتاب لا يدرّسه في هذه الوحدة.',
  ],
};
