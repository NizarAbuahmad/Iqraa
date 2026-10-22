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
];

/**
 * What a Grade 4 lesson does not cover, and why — printed on the teacher's form. One bullet per item,
 * Arabic with English phrases inline; no `"`, `&`, `<` or `>` (the form does not escape runs).
 */
export const NOT_COVERED_G4: Record<string, string[]> = {
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
