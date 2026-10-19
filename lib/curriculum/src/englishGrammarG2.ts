/**
 * Grade 2 grammar units for the English corner
 * (spec: docs/superpowers/specs/2026-10-19-english-corner-grammar-g2-design.md).
 *
 * Patterns are the book's (`objectives` in data/iqra_curriculum_g2_english_sem{1,2}.json), restricted
 * to what the corner can picture. The rest is listed in `NOT_COVERED_G2`, which the teacher's form
 * prints, so nothing is missing silently. A unit is offered to nobody until `reviewedBy` is set.
 *
 * Imports only types from the engine: `englishGrammar.ts` imports this file.
 */
import type { GrammarUnit } from './englishGrammar.ts';

const L = (sem: 1 | 2, unit: number) => `kbl-g2-eng-s${sem}-nccd-u${unit}_l1`;

const YES_NO_IS = { kind: 'match', yes: 'Yes, it is.', no: "No, it isn't." } as const;
const YES_NO_LIKE = { kind: 'marker', yes: 'Yes, I do.', no: "No, I don't." } as const;

const COLOURS = ['black', 'blue', 'brown', 'green', 'orange', 'pink', 'purple', 'red', 'white', 'yellow'];
/** «swing» and «slide» have no picture; «action figure» and «building set» appear in Build the sentence only. */
const TOYS = ['action figure', 'building set', 'car', 'dinosaur', 'doll', 'plane', 'puzzle', 'robot', 'teddy', 'yoyo', 'ball', 'bike', 'kite', 'scooter'];
const PICTURED_TOYS = ['car', 'dinosaur', 'doll', 'plane', 'puzzle', 'robot', 'teddy', 'yoyo', 'ball', 'bike', 'kite', 'scooter'];
const SCHOOL = [
  'bag', 'book', 'chair', 'computer', 'crayon', 'cupboard', 'desk', 'eraser', 'pen', 'pencil',
  'pencil case', 'pencil sharpener', 'ruler', 'shelf', 'table',
];
/** «orange» is left out: its only picture is the colour 🟠. */
const FOOD = [
  'apple', 'banana', 'carrot', 'potato', 'tomato', 'rice', 'bread', 'cheese', 'chicken', 'eggs', 'fish', 'juice', 'milk', 'water',
];
/** «balcony» is left out: «on the balcony», not «in». */
const ROOMS = ['bathroom', 'bedroom', 'kitchen', 'house', 'garden', 'garage', 'hall', 'living room', 'flat'];

export const GRAMMAR_UNITS_G2: GrammarUnit[] = [
  {
    // What colour is it? / How old are you?
    lessonId: L(1, 0),
    reviewedBy: null,
    patterns: [
      { id: 'colour', text: "What colour is it? It's {colour}.", picture: 'colour', choose: { kind: 'slot', slot: 'colour' } },
      { id: 'age', text: "How old are you? I'm {age}.", picture: 'age', choose: { kind: 'slot', slot: 'age' } },
    ],
    slots: { colour: COLOURS, age: ['five', 'six', 'seven', 'eight', 'nine', 'ten'] },
  },
  {
    // What's this? It's a (car). It's an (action figure). / Is it a (car)? Yes, it is. No, it isn't.
    lessonId: L(1, 1),
    reviewedBy: null,
    patterns: [
      { id: 'this', text: "What's this? It's {a:toy}.", picture: 'toy', choose: { kind: 'slot', slot: 'toy' } },
      { id: 'is', text: 'Is it {a:pictured}? Yes, it is.', picture: 'pictured', yesNo: { ...YES_NO_IS, question: 'Is it {a:pictured}?' } },
    ],
    slots: { toy: TOYS, pictured: PICTURED_TOYS },
  },
  {
    // This is (my pencil case). These are (my books).
    lessonId: L(1, 2),
    reviewedBy: null,
    patterns: [
      { id: 'this', text: 'This is my {one}.', picture: 'one', choose: { kind: 'phrase', right: 'This is', wrong: 'These are' } },
      { id: 'these', text: 'These are my {s:many}.', picture: 'many', marker: 'many', choose: { kind: 'phrase', right: 'These are', wrong: 'This is' } },
    ],
    // «scissors» is plural in form, so only «These are» takes it.
    slots: { one: SCHOOL, many: [...SCHOOL, 'scissors'] },
  },
  {
    // Who's this? It's (my uncle). / He's got (blue eyes). She's got (green eyes).
    lessonId: L(1, 4),
    reviewedBy: null,
    patterns: [
      { id: 'who', text: "Who's this? It's my {family}.", picture: 'family', choose: { kind: 'phrase', right: "Who's", wrong: "What's" } },
      { id: 'he', text: "He's got {colour} eyes.", picture: 'colour', marker: 'boy', choose: { kind: 'phrase', right: "He's", wrong: "She's" } },
      { id: 'she', text: "She's got {colour} eyes.", picture: 'colour', marker: 'girl', choose: { kind: 'phrase', right: "She's", wrong: "He's" } },
    ],
    slots: { family: ['mum', 'dad', 'grandad', 'granny'], colour: ['blue', 'brown', 'green'] },
  },
  {
    // What are these? They're cats. — against «What's this? It's a cat.»
    lessonId: L(2, 5),
    reviewedBy: null,
    patterns: [
      { id: 'one', text: "What's this? It's {a:animal}.", picture: 'animal', choose: { kind: 'whole', other: 'many' } },
      { id: 'many', text: "What are these? They're {s:animal}.", picture: 'animal', marker: 'many', choose: { kind: 'whole', other: 'one' } },
    ],
    slots: { animal: ['cat', 'duck', 'fish', 'hamster', 'mouse', 'parrot', 'rabbit', 'snake', 'spider', 'tortoise'] },
  },
  {
    // I like apples. / I don't like pasta. / Do you like cheese? Yes, I do. No, I don't.
    lessonId: L(2, 6),
    reviewedBy: null,
    patterns: [
      { id: 'like', text: 'I like {s:food}.', picture: 'food', marker: 'yes', choose: { kind: 'phrase', right: 'like', wrong: "don't like" } },
      { id: 'dont', text: "I don't like {s:food}.", picture: 'food', marker: 'no', choose: { kind: 'phrase', right: "don't like", wrong: 'like' } },
      { id: 'ylike', text: 'Do you like {s:food}? Yes, I do.', picture: 'food', marker: 'yes', yesNo: { ...YES_NO_LIKE, question: 'Do you like {s:food}?' } },
      { id: 'ydont', text: "Do you like {s:food}? No, I don't.", picture: 'food', marker: 'no', yesNo: { ...YES_NO_LIKE, question: 'Do you like {s:food}?' } },
    ],
    slots: { food: FOOD },
  },
  {
    // What's the weather like? It's cloudy. / I'm wearing a T-shirt.
    lessonId: L(2, 7),
    reviewedBy: null,
    patterns: [
      { id: 'weather', text: "What's the weather like? It's {weather}.", picture: 'weather', choose: { kind: 'slot', slot: 'weather' } },
      { id: 'wear', text: "I'm wearing {a:garment}.", picture: 'garment', choose: { kind: 'slot', slot: 'garment' } },
    ],
    slots: {
      weather: ['cloudy', 'cold', 'foggy', 'hot', 'rainy', 'snowy', 'stormy', 'sunny', 'windy'],
      garment: ['boots', 'coat', 'jumper', 'shoes', 'shorts', 'skirt', 'T-shirt', 'trousers'],
    },
  },
  {
    // Where's my dad? He's in the garden. — two patterns: the pronoun follows the person.
    lessonId: L(2, 8),
    reviewedBy: null,
    patterns: [
      { id: 'he', text: "Where's my {male}? He's in the {room}.", picture: 'room', choose: { kind: 'phrase', right: "He's", wrong: "She's" } },
      { id: 'she', text: "Where's my {female}? She's in the {room}.", picture: 'room', choose: { kind: 'phrase', right: "She's", wrong: "He's" } },
    ],
    slots: { male: ['dad', 'grandad'], female: ['mum', 'granny'], room: ROOMS },
  },
];

/**
 * What a Grade 2 lesson does not cover, and why — printed on the teacher's form. One bullet per
 * item, Arabic with English phrases inline; no `"`, `&`, `<` or `>` (the form does not escape runs).
 */
export const NOT_COVERED_G2: Record<string, string[]> = {
  [L(1, 0)]: [
    "«What's your name? My name's …» و«How many …?»: لا توجد صورة تُظهرها.",
    '«How old are you?»: الأعمار المستخدمة من خمس إلى عشر فقط.',
  ],
  [L(1, 1)]: [
    'الكلمتان swing وslide ليس لهما صورة، وswing هي مثال الكتاب في «Is it a swing?»، لذلك تُستخدم ألعاب لها صور.',
    'action figure وbuilding set تظهران في «رتّب الجملة» فقط لأنه لا صورة لهما.',
    '«Can I play with it, please?»: حوار بلا صورة.',
  ],
  [L(1, 2)]: [
    "«Where's the pencil? It's in / on / under the desk»: لا يمكن لرمز تعبيري أن يُظهر in أو on أو under.",
    '«Can I borrow it, please?»: حوار بلا صورة.',
    'كلمة scissors تأتي مع «These are» فقط لأنها جمع دائمًا.',
  ],
  [L(1, 3)]: [
    'لا أنشطة قواعد في هذه الوحدة: لا توجد صور للكلمات face وtoes وfingers وhead وknees وtummy.',
    'الكلمات المصوّرة (arms وfeet وhands وlegs) مستخدمة في قواعد الصف الأول.',
    'أفعال الحركة مثل «Touch your head!» لا صور لها.',
  ],
  [L(1, 4)]: [
    "uncle وaunt وbrother وsister وcousin ليس لها صور، لذلك يقتصر «Who's this?» على mum وdad وgrandad وgranny.",
    "«His name's … / Her name's …»: لا صورة لها.",
    'لون العينين يظهر دائرة ملوّنة بجانب 👦 أو 👧؛ إن رأيتم ذلك غير واضح فيُحذف هذا النمط بسطر واحد.',
  ],
  [L(2, 5)]: [
    "«It's got big teeth»: لا صورة تُظهر big.",
  ],
  [L(2, 6)]: [
    'جمل «… and … too» و«… but …» و«… or …»: تحتاج صورتين، ويمكن تبديل الطعامين وتبقى الجملة صحيحة.',
    'bean وpea وpasta وmeat ليس لها صور.',
    'كلمة orange مستبعدة لأن صورتها الوحيدة هي اللون 🟠.',
    'في «Do you like …?» تُظهر الصورة ✅ أو ❌ ويختار الطالب الجواب المطابق (✅ = يحبّه). إن لم يكن ذلك واضحًا يبقى «نعم أم لا» على «Is it a …?» فقط.',
  ],
  [L(2, 7)]: [
    "«I'm wearing a T-shirt and shorts»: تحتاج صورتين.",
    'jumper وshorts وskirt وtrousers وfoggy وstormy ليس لها صور: تظهر في «رتّب الجملة» فقط.',
    'الوجهان 🥵 و🥶 يعبّران عن الحر والبرد، وليسا صورتين للطقس نفسه.',
  ],
  [L(2, 8)]: [
    "«He's / She's tidying up» وأعمال المنزل: لا صور لها.",
    'كلمة balcony مستبعدة لأن الجملة معها on the balcony وليست in.',
    'garden وgarage وhall وliving room وflat تظهر في «رتّب الجملة» فقط لأنه لا صور لها.',
    'الرمز 🍳 يمثّل المطبخ.',
  ],
};
