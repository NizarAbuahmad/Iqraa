/**
 * Grade 1 grammar sentences for the English corner, generated from the book's
 * patterns and the lessons' own words.
 *
 * Spec: docs/superpowers/specs/2026-10-16-english-corner-grammar-g1-design.md.
 * A Grade 1 English teacher asked for grammar practice (2026-10-15); every
 * "Vocabulary & Grammar" lesson names its target in the curriculum data
 * («I've got … / I haven't got …») and nothing practised it.
 *
 * The set of sentences is finite: each unit's patterns times its slot words.
 * `renderGrammarSheet` lists all of it for a teacher to read, and a test pins
 * the committed sheet (`docs/english-grammar-g1-sheet.md`) to the generator,
 * so a sign-off always refers to the text that ships. A unit is offered to
 * nobody until `reviewedBy` is set — the only switch.
 *
 * Free of react-native.
 */
import { hubLesson } from './englishHub.ts';
import { wordPicture } from './englishPictures.ts';
import { GRAMMAR_UNITS_G2 } from './englishGrammarG2.ts';
import { GRAMMAR_UNITS_G3 } from './englishGrammarG3.ts';
import { GRAMMAR_UNITS_G4 } from './englishGrammarG4.ts';
import { GRAMMAR_UNITS_G5 } from './englishGrammarG5.ts';
import { GRAMMAR_UNITS_G9 } from './englishGrammarG9.ts';

export type GrammarMarker = 'yes' | 'no' | 'boy' | 'girl' | 'many';

export interface GrammarPattern {
  id: string;
  /** `{slot}` bare, `{a:slot}` with a/an, `{s:slot}` plural, `{v:slot}` a verb phrase split into tiles, `{3:slot}` its third-person form, `{ing:slot}` its -ing form, `{cmp:slot}` / `{sup:slot}` an adjective's comparative / superlative, `{ed:slot}` a verb's past. */
  text: string;
  /** Explicit slot values for this pattern instead of every combination of its slots (a routine with its time, an animal with its ability). */
  rows?: Record<string, string>[];
  /** The slot whose word is pictured. */
  picture?: string;
  /** What the picture adds: ✓/✗, a boy or a girl, or two of the thing. */
  marker?: GrammarMarker;
  /**
   * A picture-free True or false (Grade 4, S1 U4): the sentence is the true claim, and its false twin is the same
   * sentence with these two slots' fills swapped («The hill is higher than the mountain.»). Rows must make the
   * unswapped sentence true. Several pairs may be swapped at once (Grade 9: a capitalised first word swaps with
   * its own capitalised twin, and the lower-case word with its lower-case twin).
   */
  claim?: { swap: [string, string] | [string, string][] };
  /**
   * What Choose the word blanks: a fixed phrase and its contrast, the slot's
   * word (the picture says which), or the whole answer after the question
   * (the question is then not shown — it would give the answer away).
   * Absent on a pattern with `yesNo`: Yes or No is its judging.
   */
  choose?:
    | { kind: 'phrase'; right: string; wrong: string }
    | { kind: 'slot'; slot: string }
    | { kind: 'whole'; other: string }
    /**
     * The slot's word in the form the text uses against another form of the same word. Without `wrong`: the verb's
     * third-person form against its base («plays» / «play»; the text uses {3:slot}). With `wrong`: the slot as realised
     * against its `base` form («higher» / «high», «used» / «use»), its `past` («use» / «used») or its `comparative`
     * («the deepest» / «the deeper»). The wrong option is always a real form.
     */
    | { kind: 'form'; slot: string; wrong?: 'base' | 'past' | 'comparative' };
  /**
   * Yes or No (Grade 2). `match` («Is it a car?»): the picture stays and the
   * question names the pictured word (Yes) or the next pictured word of the
   * slot (No). `marker` («Do you like cheese?»): the pattern's ✅ / ❌ is the
   * truth. `fact` (Grade 3, «Can penguins swim?»): the picture is only the subject and the child
   * answers from what they know; the pattern's `answer` is the truth. `question` takes the pattern's slots.
   */
  yesNo?: {
    kind: 'match' | 'marker' | 'fact';
    question: string;
    yes: string;
    no: string;
    /** `fact` only: the truth, e.g. «Can penguins swim?» → true. The picture is the subject, with no ✅ / ❌. */
    answer?: boolean;
    /** The line shown above a `marker` question: ✅ = the child likes it (the default), ✅ = it's there, or ✅ = it was there. */
    hint?: 'likes' | 'there' | 'was';
  };
}

/** A hand-written Grade 9 item: the whole sentence, the words a child must choose, and the distractor it is offered against. */
export interface GrammarItem {
  /** The sub-topic it belongs to (printed on the teacher's form; the sentence's `patternId`). */
  topic: string;
  text: string;
  /** The correct word or phrase, exactly once in `text`. */
  answer: string;
  /** Offered against `answer` in Choose; `text` with `answer` replaced by it is the false twin of True or false. */
  distractor: string;
  /** `form`: the distractor is ungrammatical. `meaning`: it is grammatical but excluded by something in the sentence itself. */
  kind: 'form' | 'meaning';
}

export interface GrammarUnit {
  lessonId: string;
  /** A teacher's sign-off. `null` → the unit is offered to nobody. */
  reviewedBy: { name: string; date: string } | null;
  /** Empty on a unit of authored `items` (Grade 9, S1 U1–U10 except U4's two). */
  patterns: GrammarPattern[];
  /** Hand-written sentences, each with its answer and distractor; expanded after the patterns. */
  items?: GrammarItem[];
  /** Words of this lesson or an earlier lesson of the same grade, never a later one. */
  slots: Record<string, string[]>;
}

export interface GrammarSentence {
  key: string;
  lessonId: string;
  patternId: string;
  text: string;
  /** Word tiles. A multi-word slot word ("pencil case") is one tile; punctuation stays on its word. */
  tokens: string[];
  /** Null when the pictured word has no picture. */
  picture: { word: string; count: 1 | 2 } | null;
  marker: GrammarMarker | null;
  /** Null when the choice needs a picture the word does not have. */
  choose: { kind: 'phrase' | 'slot' | 'whole' | 'form'; start: number; length: number; right: string; wrong: string } | null;
  /** Another word of the picture slot, with a picture, for True or false. */
  falsePicture: string | null;
  /** The false twin of a picture-free claim, for True or false; null for every other sentence. */
  claim: { falseText: string; /** `false`: the twin is ungrammatical, so True or false plays no sound for this sentence. */ voiced?: false } | null;
  /** Null unless the pattern has `yesNo` and the picture exists. `otherQuestion` is a `match` item's No question. */
  yesNo: {
    kind: 'match' | 'marker' | 'fact';
    question: string;
    otherQuestion: string | null;
    yes: string;
    no: string;
    /** True when the sentence's own answer is «yes». */
    answer: boolean;
    /** Which line the app shows above a `marker` question; null for the others. */
    hint: 'likes' | 'there' | 'was' | null;
  } | null;
  /**
   * What Build the sentence puts in order: the whole sentence, or, over the grade's cap, its answer
   * half with the question as `prompt`. Null when it can be built neither way.
   */
  build: { tokens: string[]; text: string; prompt: string | null } | null;
  /** An authored item's kind (`form` or `meaning`); absent on a pattern sentence. */
  kind?: 'form' | 'meaning';
}

// ─── Articles and plurals ─────────────────────────────────────────────────

/**
 * Words that take no article and no extra "s": plural in form («boots», «eggs») or
 * uncountable («rice», «milk»). "I like rice", "I'm wearing shorts".
 */
const PLURAL_FORMS = new Set([
  'boots', 'jeans', 'socks', 'arms', 'feet', 'hands', 'legs',
  'apples', 'cakes', 'carrots', 'grapes', 'lemons', 'sweets',
  'eggs', 'scissors', 'shoes', 'shorts', 'trousers',
  'rice', 'bread', 'cheese', 'chicken', 'juice', 'milk', 'water',
  // Grade 3: plural in form, or uncountable.
  'glasses', 'sandals', 'trainers', 'pyjamas', 'keys', 'shampoo', 'toothpaste', 'sunscreen',
]);
/** Words whose article the first letter gets wrong. None yet; "a uniform", "an hour" later. */
const ARTICLE_OVERRIDES: Record<string, 'a' | 'an'> = {};
/** Irregular plurals (Grade 2) and words the rules below get wrong. «fish» is an animal in Unit 5 and a food in Unit 6; both take the same plural. */
const PLURAL_OVERRIDES: Record<string, string> = {
  mouse: 'mice', fish: 'fish', potato: 'potatoes', tomato: 'tomatoes', shelf: 'shelves', mango: 'mangoes', sheep: 'sheep',
};

function articleFor(word: string): 'a' | 'an' | null {
  if (PLURAL_FORMS.has(word)) return null;
  return ARTICLE_OVERRIDES[word] ?? (/^[aeiou]/i.test(word) ? 'an' : 'a');
}

export function withArticle(word: string): string {
  const a = articleFor(word);
  return a ? `${a} ${word}` : word;
}

export function pluralOf(word: string): string {
  if (PLURAL_FORMS.has(word)) return word;
  if (PLURAL_OVERRIDES[word]) return PLURAL_OVERRIDES[word];
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

// ─── Verb forms (Grade 3) ─────────────────────────────────────────────────

const THIRD_WORDS: Record<string, string> = { have: 'has', go: 'goes', do: 'does' };
/** A phrase whose verb is not its first word. */
const THIRD_PHRASES: Record<string, string> = { 'roller skate': 'roller skates' };
const ING_WORDS: Record<string, string> = { get: 'getting', run: 'running', swim: 'swimming', sit: 'sitting', stop: 'stopping' };

function inflectFirst(phrase: string, fn: (word: string) => string): string {
  const [first, ...rest] = phrase.split(' ');
  return [fn(first), ...rest].join(' ');
}

function thirdWord(word: string): string {
  if (THIRD_WORDS[word]) return THIRD_WORDS[word];
  if (/(s|sh|ch|x|z|o)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

function ingWord(word: string): string {
  if (ING_WORDS[word]) return ING_WORDS[word];
  if (/ie$/.test(word)) return `${word.slice(0, -2)}ying`;
  if (/[^e]e$/.test(word)) return `${word.slice(0, -1)}ing`;
  return `${word}ing`;
}

/** «watch TV» → «watches TV». The first word is the verb unless the whole phrase is listed. */
export function thirdPerson(phrase: string): string {
  return THIRD_PHRASES[phrase] ?? inflectFirst(phrase, thirdWord);
}

/** «brush the horses» → «brushing the horses». */
export function presentParticiple(phrase: string): string {
  return inflectFirst(phrase, ingWord);
}

// ─── Adjective and past forms (Grade 4) ───────────────────────────────────

/** The comparative and superlative of every adjective a Grade 4 pattern compares, written out: a rule would guess `quieter` against `more quiet`. */
export const ADJECTIVE_FORMS: Record<string, [string, string]> = {
  high: ['higher', 'highest'], deep: ['deeper', 'deepest'], wide: ['wider', 'widest'],
  beautiful: ['more beautiful', 'most beautiful'], boring: ['more boring', 'most boring'],
  colourful: ['more colourful', 'most colourful'], dangerous: ['more dangerous', 'most dangerous'],
  delicious: ['more delicious', 'most delicious'], difficult: ['more difficult', 'most difficult'],
  exciting: ['more exciting', 'most exciting'], interesting: ['more interesting', 'most interesting'],
  // Grade 9, S1 U4 (food and shopping adjectives).
  cheap: ['cheaper', 'cheapest'], healthy: ['healthier', 'healthiest'], tasty: ['tastier', 'tastiest'],
  expensive: ['more expensive', 'most expensive'], fattening: ['more fattening', 'most fattening'],
  filling: ['more filling', 'most filling'], nutritious: ['more nutritious', 'most nutritious'],
  popular: ['more popular', 'most popular'],
};

export function comparativeOf(adj: string): string {
  const forms = ADJECTIVE_FORMS[adj];
  if (!forms) throw new Error(`no comparative for «${adj}»: add it to ADJECTIVE_FORMS`);
  return forms[0];
}

export function superlativeOf(adj: string): string {
  const forms = ADJECTIVE_FORMS[adj];
  if (!forms) throw new Error(`no superlative for «${adj}»: add it to ADJECTIVE_FORMS`);
  return forms[1];
}

/** Irregular and doubled past forms. A regular verb the rule below gets right is not listed. */
export const PAST_OVERRIDES: Record<string, string> = {
  stop: 'stopped', wear: 'wore', see: 'saw', get: 'got', go: 'went', eat: 'ate', have: 'had', give: 'gave', make: 'made', buy: 'bought',
};

function pastWord(word: string): string {
  if (PAST_OVERRIDES[word]) return PAST_OVERRIDES[word];
  if (/e$/.test(word)) return `${word}d`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ied`;
  return `${word}ed`;
}

/** «visit the museum» → «visited the museum». The first word is the verb. */
export function pastTense(phrase: string): string {
  return inflectFirst(phrase, pastWord);
}

// ─── The data ─────────────────────────────────────────────────────────────

const HAVE: GrammarPattern[] = [
  { id: 'have', text: "I've got {a:thing}.", picture: 'thing', marker: 'yes', choose: { kind: 'phrase', right: "I've got", wrong: "I haven't got" } },
  { id: 'not', text: "I haven't got {a:thing}.", picture: 'thing', marker: 'no', choose: { kind: 'phrase', right: "I haven't got", wrong: "I've got" } },
];
const FAVOURITE_TOY: GrammarPattern = {
  id: 'toy', text: "What's your favourite toy? It's my {toy}.", picture: 'toy', choose: { kind: 'slot', slot: 'toy' },
};
const SCHOOL_THINGS = ['bag', 'book', 'crayon', 'eraser', 'pen', 'pencil', 'pencil case', 'ruler'];
const TOYS = ['ball', 'car', 'doll', 'plane', 'robot', 'teddy', 'train', 'yoyo'];
const PLACES = ['chair', 'desk', 'floor'];

const L = (sem: 1 | 2, unit: number) => `kbl-g1-eng-s${sem}-nccd-u${unit}_l1`;

const GRAMMAR_UNITS_G1: GrammarUnit[] = [
  {
    // Who's this? This is (my) … — "cat" left out: a pet can be «What's this?» too.
    lessonId: L(1, 1),
    reviewedBy: null,
    patterns: [
      { id: 'who', text: "Who's this? This is my {family}.", picture: 'family', choose: { kind: 'phrase', right: "Who's", wrong: "What's" } },
    ],
    slots: { family: ['mum', 'dad', 'brother', 'sister', 'friend'] },
  },
  {
    // I've got … / I haven't got …
    lessonId: L(1, 2),
    reviewedBy: null,
    patterns: HAVE,
    slots: { thing: SCHOOL_THINGS },
  },
  {
    // What's this? It's a … / The book is on the chair. The pens are on the floor.
    // The objects are Unit 2's school things, as the book's own example uses:
    // Unit 3's words (door, wall, window) cannot sit on a desk.
    lessonId: L(1, 3),
    reviewedBy: null,
    patterns: [
      { id: 'this', text: "What's this? It's {a:thing}.", picture: 'thing', choose: { kind: 'slot', slot: 'thing' } },
      { id: 'is', text: 'The {object} is on the {place}.', picture: 'object', choose: { kind: 'phrase', right: 'is', wrong: 'are' } },
      { id: 'are', text: 'The {s:object} are on the {place}.', picture: 'object', marker: 'many', choose: { kind: 'phrase', right: 'are', wrong: 'is' } },
    ],
    slots: {
      thing: ['chair', 'desk', 'door', 'wall', 'whiteboard', 'window'],
      object: ['book', 'pen', 'pencil', 'ruler'],
      place: PLACES,
    },
  },
  {
    // I'm happy/sad. What's your favourite toy? It's my …
    lessonId: L(1, 4),
    reviewedBy: null,
    patterns: [
      { id: 'feel', text: "I'm {feeling}.", picture: 'feeling', choose: { kind: 'slot', slot: 'feeling' } },
      FAVOURITE_TOY,
    ],
    slots: { feeling: ['happy', 'sad'], toy: TOYS },
  },
  {
    // Welcome: This is (my) … / I've got … — this lesson's words are school
    // things and toys only, so it takes Unit 2's and Unit 4's patterns.
    lessonId: L(2, 0),
    reviewedBy: null,
    patterns: [...HAVE, FAVOURITE_TOY],
    slots: { thing: SCHOOL_THINGS, toy: TOYS },
  },
  {
    // He's got … / She's got …
    lessonId: L(2, 5),
    reviewedBy: null,
    patterns: [
      { id: 'he', text: "He's got two {pair}.", picture: 'pair', marker: 'boy', choose: { kind: 'phrase', right: "He's", wrong: "She's" } },
      { id: 'she', text: "She's got two {pair}.", picture: 'pair', marker: 'girl', choose: { kind: 'phrase', right: "She's", wrong: "He's" } },
    ],
    slots: { pair: ['arms', 'feet', 'hands', 'legs'] },
  },
  {
    // I'm wearing … / Where's my …? It's on the … — only single clothes ask
    // «Where's my …?» («Where's my boots?» is wrong). Places are Unit 3's.
    lessonId: L(2, 6),
    reviewedBy: null,
    patterns: [
      { id: 'wear', text: "I'm wearing {a:garment}.", picture: 'garment', choose: { kind: 'slot', slot: 'garment' } },
      { id: 'where', text: "Where's my {single}? It's on the {place}.", picture: 'single', choose: { kind: 'slot', slot: 'single' } },
    ],
    slots: {
      garment: ['boots', 'dress', 'jacket', 'jeans', 'jumper', 'skirt', 'socks', 'T-shirt'],
      single: ['dress', 'jacket', 'jumper', 'skirt', 'T-shirt'],
      place: PLACES,
    },
  },
  {
    // What are these? They're … — against «What's this? It's a …».
    lessonId: L(2, 7),
    reviewedBy: null,
    patterns: [
      { id: 'one', text: "What's this? It's {a:animal}.", picture: 'animal', choose: { kind: 'whole', other: 'many' } },
      { id: 'many', text: "What are these? They're {s:animal}.", picture: 'animal', marker: 'many', choose: { kind: 'whole', other: 'one' } },
    ],
    slots: { animal: ['frog', 'giraffe', 'lizard', 'monkey', 'snake', 'spider', 'tiger', 'zebra'] },
  },
  {
    // I like … / I don't like …
    lessonId: L(2, 8),
    reviewedBy: null,
    patterns: [
      { id: 'like', text: 'I like {food}.', picture: 'food', marker: 'yes', choose: { kind: 'phrase', right: 'like', wrong: "don't like" } },
      { id: 'dont', text: "I don't like {food}.", picture: 'food', marker: 'no', choose: { kind: 'phrase', right: "don't like", wrong: 'like' } },
    ],
    slots: { food: ['apples', 'cakes', 'carrots', 'grapes', 'juice', 'lemonade', 'lemons', 'sweets'] },
  },
];

/** Grade 1 first, then 2, then 3: the order the lessons come in. */
export const GRAMMAR_UNITS: GrammarUnit[] = [...GRAMMAR_UNITS_G1, ...GRAMMAR_UNITS_G2, ...GRAMMAR_UNITS_G3, ...GRAMMAR_UNITS_G4, ...GRAMMAR_UNITS_G5, ...GRAMMAR_UNITS_G9];

export function grammarUnit(lessonId: string): GrammarUnit | undefined {
  return GRAMMAR_UNITS.find(u => u.lessonId === lessonId);
}

export function unitGrade(unit: GrammarUnit): number {
  return hubLesson(unit.lessonId)!.grade;
}

export function grammarUnitsForGrade(grade: number): GrammarUnit[] {
  return GRAMMAR_UNITS.filter(u => unitGrade(u) === grade);
}

/** Tiles a child can order: Grade 3 reads longer sentences than Grades 1 and 2. */
export function buildCap(grade: number): 7 | 9 {
  return grade >= 3 ? 9 : 7;
}

function buildOf(tokens: string[], cap: number): GrammarSentence['build'] {
  const part = (t: string[], prompt: string | null) => ({ tokens: t, text: t.join(' '), prompt });
  if (tokens.length >= 2 && tokens.length <= cap) return part(tokens, null);
  const q = tokens.findIndex(t => t.endsWith('?'));
  if (q < 0) return null;
  const answer = tokens.slice(q + 1);
  return answer.length >= 2 && answer.length <= cap ? part(answer, tokens.slice(0, q + 1).join(' ')) : null;
}

/** A lesson's sentences, or null unless a teacher has signed the unit off. */
export function offeredGrammar(lessonId: string): GrammarSentence[] | null {
  const unit = grammarUnit(lessonId);
  return unit?.reviewedBy ? unitSentences(unit) : null;
}

/**
 * Is this hub lesson shown to students? A lesson with words always is. A grammar-only lesson (too few words for the
 * word activities) is only once a teacher has signed its grammar unit: otherwise it would be an empty page in the
 * public index. `offered` is `offeredGrammar` unless a test passes a stand-in.
 */
export function hubLessonVisible(lessonId: string, offered: (id: string) => unknown = offeredGrammar): boolean {
  const lesson = hubLesson(lessonId);
  if (!lesson) return false;
  return !lesson.grammarOnly || Boolean(offered(lessonId));
}

// ─── Realising a pattern ──────────────────────────────────────────────────

const SLOT = /\{(?:(a|s|v|3|ing|cmp|sup|ed):)?([A-Za-z0-9]+)\}/g;

interface Realised {
  tokens: string[];
  /** Where each slot's fill sits in `tokens`: [start, length]. */
  spans: Record<string, [number, number]>;
}

function realise(text: string, fill: Record<string, string>): Realised {
  const tokens: string[] = [];
  const spans: Record<string, [number, number]> = {};
  const literal = (s: string) => {
    // Punctuation straight after a slot («pen.», «T-shirt?») stays on its word.
    const lead = /^[^\s]+/.exec(s);
    if (lead && tokens.length && /^[.?!,]+$/.test(lead[0])) {
      tokens[tokens.length - 1] += lead[0];
      s = s.slice(lead[0].length);
    }
    tokens.push(...s.split(/\s+/).filter(Boolean));
  };
  let last = 0;
  for (const m of text.matchAll(SLOT)) {
    literal(text.slice(last, m.index));
    const [, form, slot] = m;
    const word = fill[slot];
    const start = tokens.length;
    if (form === 's') tokens.push(pluralOf(word));
    else if (form === 'v') tokens.push(...word.split(' '));
    else if (form === '3') tokens.push(...thirdPerson(word).split(' '));
    else if (form === 'ing') tokens.push(...presentParticiple(word).split(' '));
    else if (form === 'cmp') tokens.push(...comparativeOf(word).split(' '));
    else if (form === 'sup') tokens.push(...superlativeOf(word).split(' '));
    else if (form === 'ed') tokens.push(...pastTense(word).split(' '));
    else {
      const article = form === 'a' ? articleFor(word) : null;
      if (article) tokens.push(article);
      tokens.push(word);
    }
    spans[slot] = [start, tokens.length - start];
    last = m.index! + m[0].length;
  }
  literal(text.slice(last));
  return { tokens, spans };
}

const strip = (s: string) => s.replace(/[.?!,]+$/, '');
const spanText = (tokens: string[], [start, length]: [number, number]) => strip(tokens.slice(start, start + length).join(' '));

/** The tokens after the question, if the sentence asks one — what a `whole` choice blanks. */
function answerSpan(tokens: string[]): [number, number] {
  const q = tokens.findIndex(t => t.endsWith('?'));
  const start = q < 0 ? 0 : q + 1;
  return [start, tokens.length - start];
}

function phraseSpan(tokens: string[], phrase: string): [number, number] {
  const want = phrase.split(' ').length;
  for (let i = 0; i + want <= tokens.length; i += 1) {
    if (spanText(tokens, [i, want]) === phrase) return [i, want];
  }
  throw new Error(`"${phrase}" is not in «${tokens.join(' ')}»`);
}

/** The next word after `word` in `list` that has a picture, cyclically; null if none. */
function nextPictured(list: string[], word: string): string | null {
  const i = list.indexOf(word);
  for (let k = 1; k < list.length; k += 1) {
    const w = list[(i + k) % list.length];
    if (wordPicture(w)) return w;
  }
  return null;
}

function slotsIn(text: string): string[] {
  return [...new Set([...text.matchAll(SLOT)].map(m => m[2]))];
}

function fills(slots: string[], words: Record<string, string[]>): Record<string, string>[] {
  return slots.reduce<Record<string, string>[]>(
    (acc, slot) => acc.flatMap(f => words[slot].map(w => ({ ...f, [slot]: w }))),
    [{}],
  );
}

/** A slot's words: the unit's own list, or, for a slot that only the rows name, the values the rows give it. */
function slotList(unit: GrammarUnit, p: GrammarPattern, slot: string): string[] {
  return unit.slots[slot] ?? [...new Set((p.rows ?? []).map(r => r[slot]).filter(Boolean))];
}

export function unitSentences(unit: GrammarUnit): GrammarSentence[] {
  const out: GrammarSentence[] = [];
  const grade = hubLesson(unit.lessonId)!.grade;
  const cap = buildCap(grade);
  for (const p of unit.patterns) {
    const slots = slotsIn(p.text);
    for (const fill of p.rows ?? fills(slots, unit.slots)) {
      const { tokens, spans } = realise(p.text, fill);
      const picWord = p.picture ? fill[p.picture] : null;
      const picture = picWord && wordPicture(picWord) ? { word: picWord, count: (p.marker === 'many' ? 2 : 1) as 1 | 2 } : null;
      const otherWord = picture && p.picture ? nextPictured(slotList(unit, p, p.picture), picture.word) : null;
      // A pattern with `yesNo` is judged by Yes or No, so it has no True or false item.
      const falsePicture = p.yesNo ? null : otherWord;

      let choose: GrammarSentence['choose'] = null;
      const c = p.choose;
      if (c?.kind === 'phrase') {
        const [start, length] = phraseSpan(tokens, c.right);
        choose = { kind: 'phrase', start, length, right: c.right, wrong: c.wrong };
      } else if (c?.kind === 'slot' && picture) {
        const other = nextPictured(slotList(unit, p, c.slot), fill[c.slot]);
        if (other) {
          const span = spans[c.slot];
          const otherRealised = realise(p.text, { ...fill, [c.slot]: other });
          // Grades 1–2 measured the other word with this word's span, so «boots» was offered against «a» (the
          // article of «a coat»). Their forms are signed off as printed, so that stays until they are re-reviewed;
          // Grade 3 measures the other word's own span («glasses» against «a dress»).
          const wrong = spanText(otherRealised.tokens, grade >= 3 ? otherRealised.spans[c.slot] : span);
          choose = { kind: 'slot', start: span[0], length: span[1], right: spanText(tokens, span), wrong };
        }
      } else if (c?.kind === 'whole' && picture) {
        const other = unit.patterns.find(q => q.id === c.other)!;
        const otherTokens = realise(other.text, fill).tokens;
        const span = answerSpan(tokens);
        choose = { kind: 'whole', start: span[0], length: span[1], right: spanText(tokens, span), wrong: spanText(otherTokens, answerSpan(otherTokens)) };
      } else if (c?.kind === 'form' && c.wrong) {
        // The right option is the slot as realised; the wrong one is the same slot in the named form.
        const formRe = new RegExp(`\\{(?:3|cmp|sup|ed|v):${c.slot}\\}`);
        if (!formRe.test(p.text)) throw new Error(`"${p.text}" has no form of «${c.slot}» to choose`);
        const code = { base: 'v', past: 'ed', comparative: 'cmp' }[c.wrong];
        const wrongRealised = realise(p.text.replace(formRe, `{${code}:${c.slot}}`), fill);
        const span = spans[c.slot];
        choose = { kind: 'form', start: span[0], length: span[1], right: spanText(tokens, span), wrong: spanText(wrongRealised.tokens, wrongRealised.spans[c.slot]) };
      } else if (c?.kind === 'form') {
        // The same sentence with the base verb: the one token that differs is what Choose blanks.
        const base = realise(p.text.replace(`{3:${c.slot}}`, `{v:${c.slot}}`), fill).tokens;
        const at = tokens.findIndex((t, i) => t !== base[i]);
        if (at < 0 || tokens.length !== base.length) throw new Error(`"${p.text}" has no verb form to choose in «${tokens.join(' ')}»`);
        choose = { kind: 'form', start: at, length: 1, right: strip(tokens[at]), wrong: strip(base[at]) };
      }

      const claim = p.claim
        ? (() => {
            const pairs = (Array.isArray(p.claim.swap[0]) ? p.claim.swap : [p.claim.swap]) as [string, string][];
            const swapped = { ...fill };
            for (const [a, b] of pairs) { swapped[a] = fill[b]; swapped[b] = fill[a]; }
            return { falseText: realise(p.text, swapped).tokens.join(' ') };
          })()
        : null;

      let yesNo: GrammarSentence['yesNo'] = null;
      const y = p.yesNo;
      // A `fact` about the world needs no picture (S1 U4 of Grade 4); every other kind judges the picture.
      if (y && (picture || (y.kind === 'fact' && !p.picture))) {
        const question = realise(y.question, fill).tokens.join(' ');
        const otherQuestion = y.kind === 'match' && otherWord && p.picture
          ? realise(y.question, { ...fill, [p.picture]: otherWord }).tokens.join(' ')
          : null;
        const answer = y.kind === 'match' ? true : y.kind === 'fact' ? Boolean(y.answer) : p.marker === 'yes';
        yesNo = { kind: y.kind, question, otherQuestion, yes: y.yes, no: y.no, answer, hint: y.hint ?? (y.kind === 'marker' ? 'likes' : null) };
      }

      out.push({
        key: `${unit.lessonId}|${p.id}|${slots.map(s => fill[s]).join('+')}`,
        lessonId: unit.lessonId,
        patternId: p.id,
        text: tokens.join(' '),
        tokens,
        picture,
        marker: p.marker ?? null,
        choose,
        falsePicture,
        claim,
        yesNo,
        build: buildOf(tokens, cap),
      });
    }
  }
  for (const it of unit.items ?? []) {
    const tokens = it.text.split(/\s+/).filter(Boolean);
    if (it.answer === it.distractor) throw new Error(`"${it.text}": the distractor differs from the answer or the item is not a choice`);
    const want = it.answer.split(' ').length;
    let found = 0;
    for (let i = 0; i + want <= tokens.length; i += 1) if (spanText(tokens, [i, want]) === it.answer) found += 1;
    if (found > 1) throw new Error(`"${it.answer}" appears more than once in «${it.text}»`);
    const [start, length] = phraseSpan(tokens, it.answer);
    // Punctuation on the last answer word («reading.», «was walking,») moves to the distractor's last word.
    const tail = /[.?!,]+$/.exec(tokens[start + length - 1])?.[0] ?? '';
    const twin = [...tokens.slice(0, start), ...(it.distractor + tail).split(' '), ...tokens.slice(start + length)];
    out.push({
      key: `${unit.lessonId}|${it.topic}|${it.text}`,
      lessonId: unit.lessonId,
      patternId: it.topic,
      text: tokens.join(' '),
      tokens,
      picture: null,
      marker: null,
      choose: { kind: 'phrase', start, length, right: it.answer, wrong: it.distractor },
      falsePicture: null,
      claim: { falseText: twin.join(' '), voiced: false },
      yesNo: null,
      build: buildOf(tokens, cap),
      kind: it.kind,
    });
  }
  return out;
}

/** Every sentence any unit can produce — reviewed or not, since a unit is voiced before it is signed off. */
export function allGrammarSentences(): string[] {
  return [...new Set(GRAMMAR_UNITS.flatMap(u => unitSentences(u).map(s => s.text)))];
}

/**
 * Every string the grammar activities speak: each sentence, and for Yes or No the
 * question alone and the No exchange («Is it a plane? No, it isn't.»). Voiced before
 * a unit is signed off, like the sentences.
 */
export function allGrammarSpoken(): string[] {
  const out = new Set<string>();
  for (const u of GRAMMAR_UNITS) {
    for (const s of unitSentences(u)) {
      out.add(s.text);
      if (s.claim && s.claim.voiced !== false) out.add(s.claim.falseText);
      if (s.build?.prompt) out.add(s.build.prompt);
      const y = s.yesNo;
      if (!y) continue;
      out.add(y.question);
      if (y.otherQuestion) {
        out.add(y.otherQuestion);
        out.add(`${y.otherQuestion} ${y.no}`);
      }
    }
  }
  return [...out];
}

// ─── The teacher's sheet ──────────────────────────────────────────────────

const MARKER_GLYPH: Record<GrammarMarker, string> = { yes: '✅', no: '❌', boy: '👦', girl: '👧', many: '' };

export function renderGrammarSheet(grade = 1): string {
  const lines = [
    `# English corner — Grade ${grade} grammar sentences`,
    '',
    'Generated from `lib/curriculum/src/englishGrammar.ts` by',
    '`pnpm --filter @workspace/curriculum run grammar-sheet`. Do not edit by hand.',
    '',
    'This is every sentence the grammar activities can show a pupil. A unit is',
    'shown to nobody until a teacher has read its list and it is signed off',
    '(`reviewedBy`). «Choose» shows the right option in bold and the wrong one',
    'it is offered beside; «True or false» shows the sentence beside its own',
    'picture, or beside the «wrong picture».',
    '',
  ];
  const units = grammarUnitsForGrade(grade);
  const hasYesNo = (u: GrammarUnit) => unitSentences(u).some(s => s.yesNo);
  if (units.some(hasYesNo)) {
    lines.push(
      '«Yes or No» shows the question, the answer it expects and, for «Is it …?», the question the «No»',
      'item asks about the same picture.',
      '',
    );
  }
  for (const unit of units) {
    const lesson = hubLesson(unit.lessonId);
    lines.push(
      `## Semester ${lesson?.semester} · Unit ${lesson?.unitNumber} — ${lesson?.unitTitle}`,
      '',
      unit.reviewedBy ? `Reviewed by ${unit.reviewedBy.name}, ${unit.reviewedBy.date}.` : 'Not reviewed yet — shown to nobody.',
      '',
      hasYesNo(unit)
        ? '| Sentence | Picture | Choose | True or false: wrong picture | Yes or No |'
        : '| Sentence | Picture | Choose | True or false: wrong picture |',
      hasYesNo(unit) ? '|---|---|---|---|---|' : '|---|---|---|---|',
    );
    for (const s of unitSentences(unit)) {
      const pic = s.picture
        ? `${s.picture.word}${s.picture.count === 2 ? ' ×2' : ''}${s.marker && MARKER_GLYPH[s.marker] ? ` ${MARKER_GLYPH[s.marker]}` : ''}`
        : s.marker && MARKER_GLYPH[s.marker] ? MARKER_GLYPH[s.marker] : '—';
      const choose = s.choose ? `**${s.choose.right}** / ${s.choose.wrong}` : '—';
      const y = s.yesNo;
      const yesNoText = !y ? '—'
        : y.kind !== 'match' ? `${y.question} → ${y.answer ? y.yes : y.no}`
          : `${y.question} → ${y.yes}${y.otherQuestion ? `<br>${y.otherQuestion} → ${y.no}` : ''}`;
      const text = s.build?.prompt ? `${s.text} _(Build: ${s.build.text})_` : s.text;
      lines.push(`| ${text} | ${pic} | ${choose} | ${s.falsePicture ?? (s.claim ? `_${s.claim.falseText}_` : '—')} |${hasYesNo(unit) ? ` ${yesNoText} |` : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
