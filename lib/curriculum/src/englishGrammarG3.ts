/**
 * Grade 3 grammar units for the English corner
 * (spec: docs/superpowers/specs/2026-10-21-english-corner-grammar-g3-design.md).
 *
 * Patterns are the book's (`objectives` in data/iqra_curriculum_g3_english_sem{1,2}.json). A picture appears
 * only where it shows what the sentence says, so four lessons carry none. What is left out is in
 * `NOT_COVERED_G3`, which the teacher's form prints. A unit is offered to nobody until `reviewedBy` is set.
 *
 * Imports only types from the engine: `englishGrammar.ts` imports this file.
 */
import type { GrammarUnit } from './englishGrammar.ts';

const L = (sem: 1 | 2, unit: number) => `kbl-g3-eng-s${sem}-nccd-u${unit}_l1`;

const ROUTINE = [
  'get up', 'have breakfast', 'go to school', 'have art lessons', 'play with my friends',
  'go home', 'have lunch', 'do homework', 'have dinner', 'go to bed',
];
/** Each routine with its time: a cross-product would say «We have dinner in the morning». */
const ROUTINE_TIMES: Record<string, string>[] = [
  { act: 'get up', pre: 'in the', time: 'morning' }, { act: 'have breakfast', pre: 'in the', time: 'morning' },
  { act: 'go to school', pre: 'in the', time: 'morning' }, { act: 'have art lessons', pre: 'in the', time: 'morning' },
  { act: 'play with my friends', pre: 'in the', time: 'afternoon' }, { act: 'go home', pre: 'in the', time: 'afternoon' },
  { act: 'have lunch', pre: 'in the', time: 'afternoon' }, { act: 'do homework', pre: 'in the', time: 'afternoon' },
  { act: 'have dinner', pre: 'in the', time: 'evening' }, { act: 'go to bed', pre: 'at', time: 'night' },
];

const WEARABLE = [
  'dress', 'hat', 'scarf', 'shirt', 'jeans', 'socks', 'glasses', 'sandals', 'pyjamas', 'trainers', 'baseball cap',
];
/** Whose things are what colour. «grey» is in the book's example but in no hub list, so it is not used. */
const OWNED: Record<string, string>[] = [
  { poss: 'Our', thing: 'glasses', colour: 'blue' }, { poss: 'Our', thing: 'phone', colour: 'green' },
  { poss: 'Our', thing: 'backpack', colour: 'red' }, { poss: 'Our', thing: 'computer', colour: 'black' },
  { poss: 'Your', thing: 'keys', colour: 'brown' }, { poss: 'Your', thing: 'handbag', colour: 'pink' },
  { poss: 'Your', thing: 'hat', colour: 'white' }, { poss: 'Your', thing: 'scarf', colour: 'purple' },
  { poss: 'Their', thing: 'phone', colour: 'yellow' }, { poss: 'Their', thing: 'backpack', colour: 'blue' },
  { poss: 'Their', thing: 'glasses', colour: 'green' }, { poss: 'Their', thing: 'handbag', colour: 'red' },
];

const SPORTS = [
  'watch TV', 'read books', 'play badminton', 'play video games', 'play tennis', 'play basketball', 'roller skate', 'skateboard', 'do karate',
];
const DOES_YES: Record<string, string>[] = [
  { act: 'watch TV', day: 'Friday' }, { act: 'read books', day: 'Tuesday' }, { act: 'play badminton', day: 'Monday' },
  { act: 'play tennis', day: 'Wednesday' }, { act: 'play basketball', day: 'Thursday' }, { act: 'roller skate', day: 'Sunday' },
  { act: 'skateboard', day: 'Saturday' }, { act: 'do karate', day: 'Saturday' },
];
const DOES_NO: Record<string, string>[] = [
  { act: 'watch TV', day: 'Sunday' }, { act: 'read books', day: 'Monday' }, { act: 'play badminton', day: 'Friday' },
  { act: 'play video games', day: 'Tuesday' }, { act: 'play tennis', day: 'Saturday' }, { act: 'play basketball', day: 'Sunday' },
  { act: 'roller skate', day: 'Wednesday' }, { act: 'do karate', day: 'Thursday' },
];

const JOBS = ['teacher', 'doctor', 'nurse', 'firefighter', 'astronaut', 'pilot', 'police officer', 'builder', 'chef', 'artist'];
const TRANSPORT = ['bus', 'boat', 'underground', 'train', 'motorbike', 'car'];

const FARM_JOBS = ['brush the horses', 'clean the cage', 'collect the eggs', 'fix the gate', 'milk the cows', 'sweep the barn'];

const CAMP = ['tent', 'sleeping bag', 'torch', 'shampoo', 'toothpaste', 'sunscreen'];

const FURNITURE = ['door', 'window', 'sofa', 'armchair', 'television', 'bed', 'wardrobe', 'mirror', 'clock', 'bookcase'];
const THERE: GrammarUnit['patterns'][number]['yesNo'] = {
  kind: 'marker', question: 'Is there {a:item}?', yes: 'Yes, there is.', no: "No, there isn't.", hint: 'there',
};

/** What a child can be asked about an animal, and the truth. Every row is on the teacher's form. */
const CAN_YES: Record<string, string>[] = [
  { animal: 'penguin', ability: 'swim' }, { animal: 'hippo', ability: 'swim' }, { animal: 'crocodile', ability: 'swim' },
  { animal: 'eagle', ability: 'fly' }, { animal: 'kangaroo', ability: 'jump' }, { animal: 'monkey', ability: 'climb' },
  { animal: 'tiger', ability: 'run' }, { animal: 'zebra', ability: 'run' },
];
const CAN_NO: Record<string, string>[] = [
  { animal: 'penguin', ability: 'fly' }, { animal: 'hippo', ability: 'fly' }, { animal: 'hippo', ability: 'jump' },
  { animal: 'elephant', ability: 'jump' }, { animal: 'elephant', ability: 'fly' }, { animal: 'crocodile', ability: 'fly' },
  { animal: 'monkey', ability: 'fly' }, { animal: 'giraffe', ability: 'fly' },
];
const CAN = { question: 'Can {s:animal} {ability}?', yes: 'Yes, they can.', no: "No, they can't." } as const;
const FOOD_ONE = ['coconut', 'burger', 'kiwi', 'mango', 'ice lolly'];
const FOOD_MANY = ['coconut', 'burger', 'kiwi', 'grapes', 'mango', 'ice lolly'];

export const GRAMMAR_UNITS_G3: GrammarUnit[] = [
  {
    // Present simple, daily routines: I play / don't play. We have lunch. When do you go home? We go home in the afternoon.
    lessonId: L(1, 2),
    reviewedBy: null,
    patterns: [
      { id: 'i', text: 'I {v:act}.' },
      { id: 'we', text: 'We {v:act}.' },
      { id: 'dont', text: "I don't {v:act}.", choose: { kind: 'phrase', right: "don't", wrong: "doesn't" } },
      { id: 'when', text: 'When do you {v:act}? We {v:act} {v:pre} {time}.', rows: ROUTINE_TIMES, choose: { kind: 'phrase', right: 'do', wrong: 'does' } },
    ],
    slots: { act: ROUTINE },
  },
  {
    // Present continuous with clothes: You're / They're wearing …; our / your / their.
    lessonId: L(1, 3),
    reviewedBy: null,
    patterns: [
      { id: 'you', text: "You're wearing {a:clothes}.", picture: 'clothes', choose: { kind: 'slot', slot: 'clothes' } },
      { id: 'they', text: "They're wearing {a:clothes}.", picture: 'clothes', choose: { kind: 'slot', slot: 'clothes' } },
      // Nothing in the picture says «our» or «your», so only «are» is asked, which the plural noun answers.
      { id: 'owned', text: '{poss} {s:thing} are {colour}.', picture: 'thing', rows: OWNED, choose: { kind: 'phrase', right: 'are', wrong: 'is' } },
    ],
    slots: { clothes: WEARABLE },
  },
  {
    // Present simple, third person: He plays … He doesn't watch TV. Does he do karate on Saturday? Yes, he does.
    lessonId: L(1, 4),
    reviewedBy: null,
    patterns: [
      { id: 'he', text: 'He {3:act}.', choose: { kind: 'form', slot: 'act' } },
      { id: 'she', text: 'She {3:act}.', choose: { kind: 'form', slot: 'act' } },
      { id: 'hedont', text: "He doesn't {v:act}.", choose: { kind: 'phrase', right: "doesn't", wrong: "don't" } },
      { id: 'shedont', text: "She doesn't {v:act}.", choose: { kind: 'phrase', right: "doesn't", wrong: "don't" } },
      { id: 'doesyes', text: 'Does he {v:act} on {day}? Yes, he does.', rows: DOES_YES, choose: { kind: 'phrase', right: 'Does', wrong: 'Do' } },
      { id: 'doesno', text: "Does she {v:act} on {day}? No, she doesn't.", rows: DOES_NO, choose: { kind: 'phrase', right: 'Does', wrong: 'Do' } },
    ],
    slots: { act: SPORTS },
  },
  {
    // want to be; goes to work by …
    lessonId: L(1, 5),
    reviewedBy: null,
    patterns: [
      { id: 'want', text: 'I want to be {a:job}.', picture: 'job', choose: { kind: 'slot', slot: 'job' } },
      { id: 'he', text: 'He goes to work by {transport}.', picture: 'transport', marker: 'boy', choose: { kind: 'phrase', right: 'goes', wrong: 'go' } },
      { id: 'she', text: 'She goes to work by {transport}.', picture: 'transport', marker: 'girl', choose: { kind: 'phrase', right: 'goes', wrong: 'go' } },
    ],
    slots: { job: JOBS, transport: TRANSPORT },
  },
  {
    // Present continuous, Yes / No questions. The animals are pictured but «brushing» is not: no pictures here.
    lessonId: L(2, 7),
    reviewedBy: null,
    patterns: [
      { id: 'theyyes', text: 'Are they {ing:act}? Yes, they are.', choose: { kind: 'phrase', right: 'Are', wrong: 'Is' } },
      { id: 'theyno', text: "Are they {ing:act}? No, they aren't.", choose: { kind: 'phrase', right: 'Are', wrong: 'Is' } },
      { id: 'heyes', text: 'Is he {ing:act}? Yes, he is.', choose: { kind: 'phrase', right: 'Is', wrong: 'Are' } },
      { id: 'sheno', text: "Is she {ing:act}? No, she isn't.", choose: { kind: 'phrase', right: 'Is', wrong: 'Are' } },
    ],
    slots: { act: FARM_JOBS },
  },
  {
    // have got, negative and Yes / No questions.
    lessonId: L(2, 8),
    reviewedBy: null,
    patterns: [
      { id: 'inot', text: "I haven't got {a:thing}.", choose: { kind: 'phrase', right: "haven't", wrong: "hasn't" } },
      { id: 'henot', text: "He hasn't got {a:thing}.", choose: { kind: 'phrase', right: "hasn't", wrong: "haven't" } },
      { id: 'shenot', text: "She hasn't got {a:thing}.", choose: { kind: 'phrase', right: "hasn't", wrong: "haven't" } },
      { id: 'youyes', text: 'Have you got {a:thing}? Yes, I have.', choose: { kind: 'phrase', right: 'Have', wrong: 'Has' } },
      { id: 'youno', text: "Have you got {a:thing}? No, I haven't.", choose: { kind: 'phrase', right: 'Have', wrong: 'Has' } },
      { id: 'heyes', text: 'Has he got {a:thing}? Yes, he has.', choose: { kind: 'phrase', right: 'Has', wrong: 'Have' } },
      { id: 'heno', text: "Has he got {a:thing}? No, he hasn't.", choose: { kind: 'phrase', right: 'Has', wrong: 'Have' } },
      { id: 'sheyes', text: 'Has she got {a:thing}? Yes, she has.', choose: { kind: 'phrase', right: 'Has', wrong: 'Have' } },
      { id: 'sheno', text: "Has she got {a:thing}? No, she hasn't.", choose: { kind: 'phrase', right: 'Has', wrong: 'Have' } },
    ],
    slots: { thing: CAMP },
  },
  {
    // there is / are, affirmative and negative. The prepositions of place have no picture, so they are not here.
    lessonId: L(2, 9),
    reviewedBy: null,
    patterns: [
      { id: 'is', text: "There's {a:item}.", picture: 'item', marker: 'yes', choose: { kind: 'phrase', right: "There's", wrong: "There isn't" } },
      { id: 'isnt', text: "There isn't {a:item}.", picture: 'item', marker: 'no', choose: { kind: 'phrase', right: "There isn't", wrong: "There's" } },
      { id: 'are', text: 'There are {s:item}.', picture: 'item', marker: 'many', choose: { kind: 'phrase', right: 'There are', wrong: "There's" } },
      // No picture or Choose: a picture of a bed does not say «there aren't any beds».
      { id: 'arent', text: "There aren't any {s:item}." },
      { id: 'yes', text: 'Is there {a:item}? Yes, there is.', picture: 'item', marker: 'yes', yesNo: THERE },
      { id: 'no', text: "Is there {a:item}? No, there isn't.", picture: 'item', marker: 'no', yesNo: THERE },
    ],
    slots: { item: FURNITURE },
  },
  {
    // can (ability) and there is / are, Yes / No questions.
    lessonId: L(2, 10),
    reviewedBy: null,
    patterns: [
      { id: 'canyes', text: 'Can {s:animal} {ability}? Yes, they can.', picture: 'animal', marker: 'many', rows: CAN_YES, yesNo: { kind: 'fact', ...CAN, answer: true } },
      { id: 'canno', text: "Can {s:animal} {ability}? No, they can't.", picture: 'animal', marker: 'many', rows: CAN_NO, yesNo: { kind: 'fact', ...CAN, answer: false } },
      { id: 'isyes', text: 'Is there {a:food}? Yes, there is.', picture: 'food', marker: 'yes', yesNo: { kind: 'marker', question: 'Is there {a:food}?', yes: 'Yes, there is.', no: "No, there isn't.", hint: 'there' } },
      { id: 'isno', text: "Is there {a:food}? No, there isn't.", picture: 'food', marker: 'no', yesNo: { kind: 'marker', question: 'Is there {a:food}?', yes: 'Yes, there is.', no: "No, there isn't.", hint: 'there' } },
      { id: 'areyes', text: 'Are there any {s:many}? Yes, there are.', picture: 'many', marker: 'yes', yesNo: { kind: 'marker', question: 'Are there any {s:many}?', yes: 'Yes, there are.', no: "No, there aren't.", hint: 'there' } },
      { id: 'areno', text: "Are there any {s:many}? No, there aren't.", picture: 'many', marker: 'no', yesNo: { kind: 'marker', question: 'Are there any {s:many}?', yes: 'Yes, there are.', no: "No, there aren't.", hint: 'there' } },
    ],
    // «grapes» is plural in form, so only the plural question takes it.
    slots: { food: FOOD_ONE, many: FOOD_MANY },
  },
];

/**
 * What a Grade 3 lesson does not cover, and why — printed on the teacher's form. One bullet per item,
 * Arabic with English phrases inline; no `"`, `&`, `<` or `>` (the form does not escape runs).
 */
export const NOT_COVERED_G3: Record<string, string[]> = {
  [L(1, 2)]: [
    'لا صور لهذه الوحدة: كلماتها أفعال وعبارات، فتبقى «اختر الكلمة» و«رتّب الجملة» فقط.',
    'الجمل الطويلة مثل «When do you go home? We go home in the afternoon.» تُرتَّب إجابتها فقط، ويظهر السؤال مكتوبًا ومسموعًا فوق الكلمات.',
    'ربط كل نشاط بوقته (go home مع afternoon وgo to bed مع night) مكتوب جملة جملة في القائمة، فتأكدوا منه.',
  ],
  [L(1, 3)]: [
    'our وyour وtheir لا تظهر في «اختر الكلمة»: لا شيء في الصورة يدل عليها. يُسأل عن are وis فقط، وهما جوابان بالجمع.',
    'sandals وpyjamas وtrainers وbaseball cap بلا صور فلا تظهر في «اختر الكلمة» ولا «صح أم خطأ».',
    'اللون الرمادي grey في مثال الكتاب غير موجود في أي قائمة كلمات، فاستُبدل بألوان من الصفين الأول والثاني.',
  ],
  [L(1, 4)]: [
    'لا صور لهذه الوحدة: كلماتها أفعال وعبارات.',
    'في «اختر الكلمة» يُسأل عن صيغة الفعل (plays مقابل play) وعن does وdo.',
    'أيام الأسبوع بلا صور، وتظهر في الأسئلة فقط. ارتباط كل نشاط بيوم عشوائي ولا يُقصد به معلومة.',
  ],
  [L(1, 5)]: [
    'جملة «He goes to work by bus.» تظهر بصورة الوسيلة فقط، ولا صورة للعمل نفسه.',
    'يُسأل في «اختر الكلمة» عن goes مقابل go، وجوابه من قاعدة الكتاب لا من الصورة.',
  ],
  [L(2, 7)]: [
    'لا صور لهذه الوحدة: الحيوانات لها صور لكن الأفعال (brushing وcollecting…) لا صور لها، فلا «صح أم خطأ» ولا «نعم أم لا».',
    'يُسأل عن Are وIs فقط، والجواب من ضمير الجملة.',
    'السؤال Is it flying? بلا نشاط له صورة، فلم يُستعمل.',
  ],
  [L(2, 8)]: [
    'لا صور لهذه الوحدة: tent وtorch وغيرهما بلا صور في القائمة المعتمدة.',
    'shampoo وtoothpaste وsunscreen تُكتب بلا أداة نكرة (Have you got sunscreen?).',
    'الصفات (dirty وclean وold…) لم تُستعمل لأن الكتاب لا يدرّسها في نمط have got.',
  ],
  [L(2, 9)]: [
    'الجمل عن الأثاث المصوّر فقط فيها صورة. armchair وbed وwardrobe وbookcase بلا صور: تظهر في «رتّب الجملة» فقط.',
    'in front of وbetween وopposite وbehind وnext to: لا يمكن لرمز تعبيري أن يُظهرها، فلا جمل لها.',
    'في «نعم أم لا» تُظهر الصورة ✅ أو ❌ ويختار الطالب الجواب المطابق (✅ = موجود). إن لم يكن ذلك واضحًا يُحذف النشاط من الوحدة.',
    'جملة There aren\'t any beds بلا صورة، لأن صورة سرير لا تدل على أنه غير موجود.',
  ],
  [L(2, 10)]: [
    'أسئلة can تستند إلى معلومة عن الحيوان (هل يسبح البطريق؟). كل معلومة مكتوبة في القائمة لتتأكدوا منها، والأفعال swim وfly وjump وrun وclimb من أمثلة الكتاب.',
    'لا ✅ ولا ❌ بجانب الصورة في أسئلة can: الصورة هي الحيوان فقط ويجيب الطالب مما يعرفه.',
    'ice lolly بلا صورة فلا يظهر في «نعم أم لا»، وgrapes جمع فقط فتأتي مع Are there any فقط.',
  ],
};
