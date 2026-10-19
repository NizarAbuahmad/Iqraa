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

export type GrammarMarker = 'yes' | 'no' | 'boy' | 'girl' | 'many';

export interface GrammarPattern {
  id: string;
  /** `{slot}` bare, `{a:slot}` with a/an, `{s:slot}` plural. */
  text: string;
  /** The slot whose word is pictured. */
  picture?: string;
  /** What the picture adds: ✓/✗, a boy or a girl, or two of the thing. */
  marker?: GrammarMarker;
  /**
   * What Choose the word blanks: a fixed phrase and its contrast, the slot's
   * word (the picture says which), or the whole answer after the question
   * (the question is then not shown — it would give the answer away).
   * Absent on a pattern with `yesNo`: Yes or No is its judging.
   */
  choose?:
    | { kind: 'phrase'; right: string; wrong: string }
    | { kind: 'slot'; slot: string }
    | { kind: 'whole'; other: string };
  /**
   * Yes or No (Grade 2). `match` («Is it a car?»): the picture stays and the
   * question names the pictured word (Yes) or the next pictured word of the
   * slot (No). `marker` («Do you like cheese?»): the pattern's ✅ / ❌ is the
   * truth. `question` takes the pattern's slots.
   */
  yesNo?: { kind: 'match' | 'marker'; question: string; yes: string; no: string };
}

export interface GrammarUnit {
  lessonId: string;
  /** A teacher's sign-off. `null` → the unit is offered to nobody. */
  reviewedBy: { name: string; date: string } | null;
  patterns: GrammarPattern[];
  /** Words of this lesson or an earlier Grade 1 lesson, never a later one. */
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
  choose: { kind: 'phrase' | 'slot' | 'whole'; start: number; length: number; right: string; wrong: string } | null;
  /** Another word of the picture slot, with a picture, for True or false. */
  falsePicture: string | null;
  /** Null unless the pattern has `yesNo` and the picture exists. `otherQuestion` is a `match` item's No question. */
  yesNo: {
    kind: 'match' | 'marker';
    question: string;
    otherQuestion: string | null;
    yes: string;
    no: string;
    /** True when the sentence's own answer is «yes». */
    answer: boolean;
  } | null;
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
]);
/** Words whose article the first letter gets wrong. None yet; "a uniform", "an hour" later. */
const ARTICLE_OVERRIDES: Record<string, 'a' | 'an'> = {};
/** Irregular plurals (Grade 2). «fish» is an animal in Unit 5 and a food in Unit 6; both take the same plural. */
const PLURAL_OVERRIDES: Record<string, string> = {
  mouse: 'mice', fish: 'fish', potato: 'potatoes', tomato: 'tomatoes', shelf: 'shelves',
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
  return PLURAL_OVERRIDES[word] ?? `${word}s`;
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

/** Grade 1 first, then Grade 2: the order the lessons come in. */
export const GRAMMAR_UNITS: GrammarUnit[] = [...GRAMMAR_UNITS_G1, ...GRAMMAR_UNITS_G2];

export function grammarUnit(lessonId: string): GrammarUnit | undefined {
  return GRAMMAR_UNITS.find(u => u.lessonId === lessonId);
}

export function unitGrade(unit: GrammarUnit): number {
  return hubLesson(unit.lessonId)!.grade;
}

export function grammarUnitsForGrade(grade: number): GrammarUnit[] {
  return GRAMMAR_UNITS.filter(u => unitGrade(u) === grade);
}

/** A lesson's sentences, or null unless a teacher has signed the unit off. */
export function offeredGrammar(lessonId: string): GrammarSentence[] | null {
  const unit = grammarUnit(lessonId);
  return unit?.reviewedBy ? unitSentences(unit) : null;
}

// ─── Realising a pattern ──────────────────────────────────────────────────

const SLOT = /\{(?:(a|s):)?([A-Za-z0-9]+)\}/g;

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

export function unitSentences(unit: GrammarUnit): GrammarSentence[] {
  const out: GrammarSentence[] = [];
  for (const p of unit.patterns) {
    const slots = slotsIn(p.text);
    for (const fill of fills(slots, unit.slots)) {
      const { tokens, spans } = realise(p.text, fill);
      const picWord = p.picture ? fill[p.picture] : null;
      const picture = picWord && wordPicture(picWord) ? { word: picWord, count: (p.marker === 'many' ? 2 : 1) as 1 | 2 } : null;
      const otherWord = picture && p.picture ? nextPictured(unit.slots[p.picture], picture.word) : null;
      // A pattern with `yesNo` is judged by Yes or No, so it has no True or false item.
      const falsePicture = p.yesNo ? null : otherWord;

      let choose: GrammarSentence['choose'] = null;
      const c = p.choose;
      if (c?.kind === 'phrase') {
        const [start, length] = phraseSpan(tokens, c.right);
        choose = { kind: 'phrase', start, length, right: c.right, wrong: c.wrong };
      } else if (c?.kind === 'slot' && picture) {
        const other = nextPictured(unit.slots[c.slot], fill[c.slot]);
        if (other) {
          const span = spans[c.slot];
          const wrong = spanText(realise(p.text, { ...fill, [c.slot]: other }).tokens, span);
          choose = { kind: 'slot', start: span[0], length: span[1], right: spanText(tokens, span), wrong };
        }
      } else if (c?.kind === 'whole' && picture) {
        const other = unit.patterns.find(q => q.id === c.other)!;
        const otherTokens = realise(other.text, fill).tokens;
        const span = answerSpan(tokens);
        choose = { kind: 'whole', start: span[0], length: span[1], right: spanText(tokens, span), wrong: spanText(otherTokens, answerSpan(otherTokens)) };
      }

      let yesNo: GrammarSentence['yesNo'] = null;
      const y = p.yesNo;
      if (y && picture) {
        const question = realise(y.question, fill).tokens.join(' ');
        const otherQuestion = y.kind === 'match' && otherWord && p.picture
          ? realise(y.question, { ...fill, [p.picture]: otherWord }).tokens.join(' ')
          : null;
        yesNo = { kind: y.kind, question, otherQuestion, yes: y.yes, no: y.no, answer: y.kind === 'match' ? true : p.marker === 'yes' };
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
        yesNo,
      });
    }
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
  for (const unit of grammarUnitsForGrade(grade)) {
    const lesson = hubLesson(unit.lessonId);
    lines.push(
      `## Semester ${lesson?.semester} · Unit ${lesson?.unitNumber} — ${lesson?.unitTitle}`,
      '',
      unit.reviewedBy ? `Reviewed by ${unit.reviewedBy.name}, ${unit.reviewedBy.date}.` : 'Not reviewed yet — shown to nobody.',
      '',
      '| Sentence | Picture | Choose | True or false: wrong picture |',
      '|---|---|---|---|',
    );
    for (const s of unitSentences(unit)) {
      const pic = s.picture
        ? `${s.picture.word}${s.picture.count === 2 ? ' ×2' : ''}${s.marker && MARKER_GLYPH[s.marker] ? ` ${MARKER_GLYPH[s.marker]}` : ''}`
        : s.marker && MARKER_GLYPH[s.marker] ? MARKER_GLYPH[s.marker] : '—';
      const choose = s.choose ? `**${s.choose.right}** / ${s.choose.wrong}` : '—';
      lines.push(`| ${s.text} | ${pic} | ${choose} | ${s.falsePicture ?? '—'} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
