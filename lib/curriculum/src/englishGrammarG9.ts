/**
 * Grade 9 grammar for the English corner: the pilot, S1 U4 «A good buy», on two hub lessons — comparatives and
 * superlatives (`u4_l1`) and quantifiers (`u4_l3`). The other Grade 9 units are separate specs.
 *
 * Spec: docs/superpowers/specs/2026-10-23-english-corner-grammar-g9-pilot-design.md.
 * The book's JSON gives objectives only, so every sentence here is written by us, as rows through the Grade 4
 * engine, and every row is a claim a teacher checks on the printed form (its data page). Nothing is pictured: a
 * food does not show «healthier». True or false and Yes or No come only from `PLURAL_PAIRS` / `MASS_PAIRS`, pairs
 * that are plainly true; opinion rows are never judged. Both units ship `reviewedBy: null`: they are offered to
 * nobody until a teacher signs the printed form. `NOT_COVERED_G9` is what the form says is left out.
 *
 * Imports only types from the engine: `englishGrammar.ts` imports this file.
 */
import type { GrammarUnit } from './englishGrammar.ts';

const L = (unit: number, lesson: number) => `kbl-g9-eng-s1-nccd-u${unit}_l${lesson}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

type Pair = { big: string; small: string; adj: string };

/** Plainly true comparisons. Both foods share a class (plural or uncountable), so the verb agrees in the swapped twin. */
const PLURAL_PAIRS: Pair[] = [
  { big: 'carrots', small: 'doughnuts', adj: 'healthy' }, { big: 'cucumbers', small: 'muffins', adj: 'healthy' },
  { big: 'doughnuts', small: 'cucumbers', adj: 'fattening' }, { big: 'croissants', small: 'melons', adj: 'fattening' },
  { big: 'carrots', small: 'croissants', adj: 'nutritious' },
];
const MASS_PAIRS: Pair[] = [
  { big: 'salmon', small: 'bread', adj: 'expensive' }, { big: 'honey', small: 'sugar', adj: 'expensive' },
  { big: 'bread', small: 'salmon', adj: 'cheap' }, { big: 'sugar', small: 'honey', adj: 'cheap' },
  { big: 'porridge', small: 'water', adj: 'filling' },
];
/** The statement starts with a capital, so the row carries both cases; the false twin swaps both pairs. */
const withCaps = (rows: Pair[]) => rows.map(r => ({ ...r, bigC: cap(r.big), smallC: cap(r.small) }));
const swapped = (rows: Pair[]) => rows.map(r => ({ big: r.small, small: r.big, adj: r.adj }));
const SWAP: [string, string][] = [['bigC', 'smallC'], ['big', 'small']];
const FACT = (be: 'Is' | 'Are') => ({
  question: `${be} {big} {cmp:adj} than {small}?`,
  yes: be === 'Is' ? 'Yes, it is.' : 'Yes, they are.',
  no: be === 'Is' ? "No, it isn't." : "No, they aren't.",
});

/** Superlatives are claims about «here», not facts a child is asked to judge: Choose and Build only. */
const SUPER_ROWS = [
  { x: 'Salmon', adj: 'expensive', n: 'dish', where: 'on the menu' }, { x: 'Water', adj: 'cheap', n: 'drink', where: 'in the café' },
  { x: 'The doughnut', adj: 'fattening', n: 'snack', where: 'here' }, { x: 'Porridge', adj: 'filling', n: 'breakfast', where: 'at the café' },
  { x: 'The muffin', adj: 'popular', n: 'cake', where: 'here' }, { x: 'The salad', adj: 'healthy', n: 'dish', where: 'on the menu' },
];
/** Opinions: Choose and Build only, never judged true or false. */
const OPINION_ROWS = [
  { a: 'Pancakes', be: 'are', adj: 'tasty', b: 'porridge' }, { a: 'Muffins', be: 'are', adj: 'popular', b: 'croissants' },
  { a: 'Doughnuts', be: 'are', adj: 'tasty', b: 'cucumbers' }, { a: 'Jam', be: 'is', adj: 'popular', b: 'honey' },
  { a: 'Salmon', be: 'is', adj: 'tasty', b: 'rice' }, { a: 'Grapes', be: 'are', adj: 'popular', b: 'melons' },
];

/** Hand-classed foods for the quantifiers. Plurals are formed by `{s:}` from the singular hub word. */
const FOOD_COUNT = ['grapes', 'olive', 'mushroom', 'pancake', 'doughnut', 'croissant', 'muffin', 'carrots'];
const FOOD_MASS = ['cream', 'honey', 'jam', 'salt', 'sugar', 'porridge', 'milk', 'rice'];
const phrase = (right: string, wrong: string) => ({ kind: 'phrase' as const, right, wrong });
const FORM = (wrong: 'base' | 'comparative') => ({ kind: 'form' as const, slot: 'adj', wrong });

export const GRAMMAR_UNITS_G9: GrammarUnit[] = [
  {
    // Comparatives and superlatives. No pictures; True or false and Yes or No only from the written pairs.
    lessonId: L(4, 1),
    reviewedBy: null,
    patterns: [
      { id: 'cmppl', text: '{bigC} are {cmp:adj} than {small}.', rows: withCaps(PLURAL_PAIRS), claim: { swap: SWAP }, choose: FORM('base') },
      { id: 'cmpmass', text: '{bigC} is {cmp:adj} than {small}.', rows: withCaps(MASS_PAIRS), claim: { swap: SWAP }, choose: FORM('base') },
      { id: 'ypl', text: 'Are {big} {cmp:adj} than {small}? Yes, they are.', rows: PLURAL_PAIRS, yesNo: { kind: 'fact', ...FACT('Are'), answer: true } },
      { id: 'ymass', text: 'Is {big} {cmp:adj} than {small}? Yes, it is.', rows: MASS_PAIRS, yesNo: { kind: 'fact', ...FACT('Is'), answer: true } },
      { id: 'npl', text: "Are {big} {cmp:adj} than {small}? No, they aren't.", rows: swapped(PLURAL_PAIRS), yesNo: { kind: 'fact', ...FACT('Are'), answer: false } },
      { id: 'nmass', text: "Is {big} {cmp:adj} than {small}? No, it isn't.", rows: swapped(MASS_PAIRS), yesNo: { kind: 'fact', ...FACT('Is'), answer: false } },
      { id: 'sup', text: '{v:x} is the {sup:adj} {v:n} {v:where}.', rows: SUPER_ROWS, choose: FORM('comparative') },
      { id: 'opinion', text: '{a} {be} {cmp:adj} than {b}.', rows: OPINION_ROWS, choose: FORM('base') },
    ],
    slots: {},
  },
  {
    // Quantifiers. No pictures; the noun decides the choice.
    lessonId: L(4, 3),
    reviewedBy: null,
    patterns: [
      { id: 'howmany', text: 'How many {s:pl} are there?', choose: phrase('many', 'much') },
      { id: 'howmuch', text: 'How much {mass} is there?', choose: phrase('much', 'many') },
      { id: 'notmany', text: "There aren't many {s:pl}.", choose: phrase('many', 'much') },
      { id: 'notmuch', text: "There isn't much {mass}.", choose: phrase('much', 'many') },
      { id: 'toomany', text: 'There are too many {s:pl}.', choose: phrase('many', 'much') },
      { id: 'toomuch', text: "There's too much {mass}.", choose: phrase('much', 'many') },
      { id: 'qmany', text: 'Are there many {s:pl}?', choose: phrase('many', 'much') },
      { id: 'qmuch', text: 'Is there much {mass}?', choose: phrase('much', 'many') },
      { id: 'afew', text: "I'd like a few {s:pl}, please.", choose: phrase('a few', 'a little') },
      { id: 'alittle', text: "I'd like a little {mass}, please.", choose: phrase('a little', 'a few') },
    ],
    slots: { pl: FOOD_COUNT, mass: FOOD_MASS },
  },
];

/** The written rows a teacher checks, printed on the form's data page (built there, so the page cannot drift from the units). */
export const G9_TABLES = {
  plural: PLURAL_PAIRS,
  mass: MASS_PAIRS,
  superRows: SUPER_ROWS,
  opinionRows: OPINION_ROWS,
  foodCount: FOOD_COUNT,
  foodMass: FOOD_MASS,
};

/**
 * What a Grade 9 lesson does not cover, and why — printed on the teacher's form. One bullet per item,
 * Arabic with English phrases inline; no `"`, `&`, `<` or `>` (the form does not escape runs).
 */
export const NOT_COVERED_G9: Record<string, string[]> = {
  [L(4, 1)]: [
    'لا صور في هذه الوحدة: صورة جزرة لا تقول إنها أصح من دونات. «صح أم خطأ» و«نعم أم لا» من أزواج المقارنات المكتوبة فقط، وكل زوج منها مطبوع في صفحة البيانات لتتأكدوا أنه صحيح دون جدال، وتوأمه الخاطئ هو الجملة نفسها بعد تبديل الطرفين.',
    'جمل الرأي (Pancakes are tastier than porridge.) وجمل الصيغة العليا (the most expensive dish) في «اختر الكلمة» و«رتّب الجملة» فقط: لا تُسأل صحةً لأنها رأي لا معلومة.',
    'خيارا «اختر الكلمة» دائمًا صيغتان حقيقيتان: healthier مقابل healthy، وthe cheapest مقابل the cheaper.',
  ],
  [L(4, 3)]: [
    'لا صور في هذه الوحدة، والاسم هو الذي يحدد الاختيار: many مع المعدود بالجمع وmuch مع غير المعدود، وa few مع الأول وa little مع الثاني.',
    'الأطعمة صُنِّفت يدويًا في صفحة البيانات: معدودة بالجمع (grapes وolives وmushrooms وpancakes وdoughnuts وcroissants وmuffins وcarrots) وغير معدودة (cream وhoney وjam وsalt وsugar وporridge وmilk وrice).',
    'some وany وenough غير مشمولة: اقتصرنا على many وmuch وa few وa little مع too many وtoo much.',
  ],
};
