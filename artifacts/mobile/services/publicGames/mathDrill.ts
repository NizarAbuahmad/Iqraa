/**
 * Quick arithmetic drills (× ÷ + −) — config, problems and the chat trigger.
 *
 * A drill is fully determined by its config, so the /play/multiply,
 * /play/divide, /play/add or /play/subtract link is the whole assignment a
 * teacher hands out:
 * no backend, no stored state. That also makes the URL params untrusted input
 * from anyone — `parseDrillParams` must never throw and never return an empty
 * drill.
 */

import type { TranslationKey } from '../i18n.ts';

export type DrillOp = 'mul' | 'div' | 'add' | 'sub';

export const DRILL_SECONDS = [30, 60, 90] as const;
export const DEFAULT_SECONDS = 60;
/** "Numbers up to" choices for + and − — they have no times tables. */
export const ADD_MAXES = [10, 20, 100] as const;
export const DEFAULT_ADD_MAX = 20;
const MIN_TABLE = 1;
const MAX_TABLE = 10;
const ALL_TABLES = Array.from({ length: MAX_TABLE }, (_, i) => i + MIN_TABLE);
const PROD_ORIGIN = 'https://app.iqrra.com';
const ZERO_ANSWER_SHARE = 0.1;

/** Route per operation. /play/multiply shipped first and its links are out there — never rename it. */
export const DRILL_ROUTES: Record<DrillOp, string> = {
  mul: '/play/multiply',
  div: '/play/divide',
  add: '/play/add',
  sub: '/play/subtract',
};
// U+2212 MINUS SIGN, not a hyphen: same width as + in the problem line.
export const DRILL_SYMBOL: Record<DrillOp, string> = { mul: '×', div: '÷', add: '+', sub: '−' };
export const DRILL_TITLE_KEYS: Record<DrillOp, TranslationKey> = {
  mul: 'playMultiplyTitle',
  div: 'playDivideTitle',
  add: 'playAddTitle',
  sub: 'playSubtractTitle',
};

/** + and − are set by a "numbers up to" range; × and ÷ by times tables. */
export const usesRange = (op: DrillOp): boolean => op === 'add' || op === 'sub';

/** `tables` drives × and ÷; `max` drives + and −. Both are always present so switching nothing breaks. */
export type DrillConfig = { op: DrillOp; tables: number[]; max: number; seconds: number };
export type DrillProblem = { op: DrillOp; a: number; b: number; answer: number };

type Param = string | string[] | undefined;
const first = (p: Param): string => (Array.isArray(p) ? p[0] : p) ?? '';

function parseTables(raw: string): number[] {
  const out = new Set<number>();
  for (const part of raw.split(',')) {
    const range = part.trim().match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
    if (range) {
      const lo = Number(range[1]);
      const hi = Number(range[2]);
      if (lo <= hi) for (let n = lo; n <= hi; n++) out.add(n);
      continue;
    }
    if (/^\d{1,2}$/.test(part.trim())) out.add(Number(part.trim()));
  }
  return [...out].filter(n => n >= MIN_TABLE && n <= MAX_TABLE).sort((x, y) => x - y);
}

const oneOf = (allowed: readonly number[], raw: Param, fallback: number): number => {
  const n = Number(first(raw));
  return allowed.includes(n) ? n : fallback;
};

export function parseDrillParams(
  op: DrillOp,
  params: { tables?: Param; max?: Param; secs?: Param },
): DrillConfig {
  const tables = parseTables(first(params.tables));
  return {
    op,
    tables: tables.length ? tables : ALL_TABLES,
    max: oneOf(ADD_MAXES, params.max, DEFAULT_ADD_MAX),
    seconds: oneOf(DRILL_SECONDS, params.secs, DEFAULT_SECONDS),
  };
}

/** Grades 1–2 start on the small tables; everyone else gets 1–10. */
export function defaultTablesForGrade(gradeId: string | null | undefined): number[] {
  return gradeId === 'grade-1' || gradeId === 'grade-2' ? [1, 2, 3, 4, 5] : ALL_TABLES;
}

/** Numbers up to 10 in grade 1, 20 in grade 2, 100 from grade 3; 20 when the grade is unknown. */
export function defaultMaxForGrade(gradeId: string | null | undefined): number {
  if (gradeId === 'grade-1') return 10;
  if (gradeId === 'grade-2' || !gradeId) return DEFAULT_ADD_MAX;
  return 100;
}

/** Path + query only — what chat pushes in-app. + and − carry their range, × and ÷ their tables. */
export function drillPath(config: DrillConfig): string {
  const detail = usesRange(config.op) ? `max=${config.max}` : `tables=${config.tables.join(',')}`;
  return `${DRILL_ROUTES[config.op]}?${detail}&secs=${config.seconds}`;
}

/** Empty `origin` is the native app (no window.location) — hand out the real site. */
export function drillShareUrl(config: DrillConfig, origin: string): string {
  return `${origin || PROD_ORIGIN}${drillPath(config)}`;
}

function drawProblem(config: DrillConfig, rng: () => number): DrillProblem {
  const pick = (n: number) => Math.floor(rng() * n);
  const { op } = config;
  if (op === 'add') {
    // Both addends ≥ 1 and the sum ≤ max: "0 + 7" drills nothing.
    const a = 1 + pick(config.max - 1);
    const b = 1 + pick(config.max - a);
    return { op, a, b, answer: a + b };
  }
  if (op === 'sub') {
    // Never negative. 0 is allowed (7 − 7) but kept to ~1 in 10 on purpose:
    // drawing b uniformly from 1..a made "x − x" ~3 in 10 at max 10.
    if (rng() < ZERO_ANSWER_SHARE) {
      const a = 1 + pick(config.max);
      return { op, a, b: a, answer: 0 };
    }
    const a = 2 + pick(config.max - 1);
    const b = 1 + pick(a - 1);
    return { op, a, b, answer: a - b };
  }
  const table = config.tables[pick(config.tables.length)]!;
  const other = pick(MAX_TABLE) + 1;
  // Division is built from a product, so it is always exact with a 1–10 quotient.
  if (op === 'div') return { op, a: table * other, b: table, answer: other };
  const [a, b] = rng() < 0.5 ? [table, other] : [other, table];
  return { op, a, b, answer: a * b };
}

export function nextProblem(config: DrillConfig, rng: () => number, prev?: DrillProblem): DrillProblem {
  for (;;) {
    const p = drawProblem(config, rng);
    if (!prev || p.a !== prev.a || p.b !== prev.b) return p;
  }
}

/** [1,2,3,4,5,8] → "1–5, 8" — the join is the caller's so Arabic can use «،». */
export function tablesLabel(tables: number[], sep = ', '): string {
  const runs: string[] = [];
  for (let i = 0; i < tables.length; ) {
    let j = i;
    while (j + 1 < tables.length && tables[j + 1] === tables[j]! + 1) j++;
    runs.push(j - i >= 2 ? `${tables[i]}–${tables[j]}` : tables.slice(i, j + 1).join(sep));
    i = j + 1;
  }
  return runs.join(sep);
}

export type DrillState = {
  problem: DrillProblem;
  typed: string;
  correct: number;
  attempted: number;
  /** A wrong answer is on screen; input is frozen until the `next` action. */
  wrong: boolean;
};

/** `upcoming` is drawn by the caller so this stays pure (no RNG inside). */
export type DrillAction =
  | { type: 'digit'; digit: string; upcoming: DrillProblem }
  | { type: 'backspace' }
  | { type: 'next'; upcoming: DrillProblem };

export function startDrill(problem: DrillProblem): DrillState {
  return { problem, typed: '', correct: 0, attempted: 0, wrong: false };
}

export function drillReducer(s: DrillState, action: DrillAction): DrillState {
  switch (action.type) {
    case 'digit': {
      if (s.wrong || !/^\d$/.test(action.digit)) return s;
      const typed = s.typed + action.digit;
      const answer = String(s.problem.answer);
      if (typed === answer) {
        return { problem: action.upcoming, typed: '', correct: s.correct + 1, attempted: s.attempted + 1, wrong: false };
      }
      if (typed.length >= answer.length) return { ...s, typed, attempted: s.attempted + 1, wrong: true };
      return { ...s, typed };
    }
    case 'backspace':
      return s.wrong ? s : { ...s, typed: s.typed.slice(0, -1) };
    case 'next':
      return { ...s, problem: action.upcoming, typed: '', wrong: false };
  }
}

// JS `\b` never matches next to Arabic letters, so Arabic words use explicit edges.
const GAME_WORDS = /game|drill|practi[cs]e|لعبة|لعبه|العب|تدريب|تمرين/i;
const AR_EDGE_BEFORE = '(?:^|[\\s،,.؟?!:(])';
const AR_EDGE_AFTER = '(?=$|[\\s،,.؟?!:)])';
const OP_WORDS: Array<[DrillOp, RegExp]> = [
  ['mul', /multipl|multib|times\s*tables?|ضرب/i],
  ['div', /\bdivi(?:de|des|ding|sion)\b|قسمة|قسمه/i],
  // Not bare "add": "add a practice game" is a request to add something, not an addition drill.
  // «جمع» only as a whole word, or «مجموعة»/«جماعي»-style words could trip it.
  // «طرح» also means "to put forward": «طرح سؤال/الأسئلة/الأفكار» is asking, not subtracting.
  ['sub', new RegExp(`\\bsubtract(?:ion|ing|s)?\\b|\\bminus\\b|\\btake\\s*away\\b|${AR_EDGE_BEFORE}(?:ال|و|بال)?طرح${AR_EDGE_AFTER}(?!\\s*(?:ال)?(?:سؤال|أسئلة|اسئلة|أفكار|افكار|فكرة))`, 'i')],
  ['add', new RegExp(`\\baddition\\b|\\badding\\b|\\bplus\\b|\\bsums?\\b|${AR_EDGE_BEFORE}(?:ال|و|بال)?جمع${AR_EDGE_AFTER}`, 'i')],
];

/**
 * The drill a chat message asks for, or null. Needs a game/practice word AND an
 * operation word, so "explain multiplication" is not a drill ask. When several
 * operations are named, the first one mentioned wins.
 */
export function drillAskOp(query: string): DrillOp | null {
  if (!GAME_WORDS.test(query)) return null;
  let best: { op: DrillOp; at: number } | null = null;
  for (const [op, re] of OP_WORDS) {
    const at = query.search(re);
    if (at >= 0 && (!best || at < best.at)) best = { op, at };
  }
  return best?.op ?? null;
}
