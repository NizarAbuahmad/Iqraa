/**
 * Quick multiplication drill — config, problems and the chat trigger.
 *
 * A drill is fully determined by its config, so the /play/multiply link is the
 * whole assignment a teacher hands out: no backend, no stored state. That also
 * makes the URL params untrusted input from anyone — `parseDrillParams` must
 * never throw and never return an empty table set.
 */

export const DRILL_SECONDS = [30, 60, 90] as const;
export const DEFAULT_SECONDS = 60;
const MIN_TABLE = 1;
const MAX_TABLE = 10;
const ALL_TABLES = Array.from({ length: MAX_TABLE }, (_, i) => i + MIN_TABLE);
const PROD_ORIGIN = 'https://app.iqrra.com';

export type DrillConfig = { tables: number[]; seconds: number };
export type DrillProblem = { a: number; b: number; answer: number };

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

export function parseDrillParams(params: { tables?: Param; secs?: Param }): DrillConfig {
  const tables = parseTables(first(params.tables));
  const secs = Number(first(params.secs));
  return {
    tables: tables.length ? tables : ALL_TABLES,
    seconds: (DRILL_SECONDS as readonly number[]).includes(secs) ? secs : DEFAULT_SECONDS,
  };
}

/** Grades 1–2 start on the small tables; everyone else gets 1–10. */
export function defaultTablesForGrade(gradeId: string | null | undefined): number[] {
  return gradeId === 'grade-1' || gradeId === 'grade-2' ? [1, 2, 3, 4, 5] : ALL_TABLES;
}

export function drillParams(config: DrillConfig): { tables: string; secs: string } {
  return { tables: config.tables.join(','), secs: String(config.seconds) };
}

/** Empty `origin` is the native app (no window.location) — hand out the real site. */
export function drillShareUrl(config: DrillConfig, origin: string): string {
  const { tables, secs } = drillParams(config);
  return `${origin || PROD_ORIGIN}/play/multiply?tables=${tables}&secs=${secs}`;
}

export function nextProblem(tables: number[], rng: () => number, prev?: DrillProblem): DrillProblem {
  const pick = (n: number) => Math.floor(rng() * n);
  for (;;) {
    const table = tables[pick(tables.length)]!;
    const other = pick(MAX_TABLE) + 1;
    const [a, b] = rng() < 0.5 ? [table, other] : [other, table];
    if (!prev || a !== prev.a || b !== prev.b) return { a, b, answer: a * b };
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

// Plain-text word lists: JS `\b` never matches next to Arabic letters.
const GAME_WORDS = /game|drill|practi[cs]e|لعبة|لعبه|العب|تدريب|تمرين/i;
const MULTIPLY_WORDS = /multipl|multib|times\s*tables?|ضرب/i;

/** A request for a multiplication game/drill — needs both halves, so "explain multiplication" is not one. */
export function isMultiplicationDrillAsk(query: string): boolean {
  return GAME_WORDS.test(query) && MULTIPLY_WORDS.test(query);
}
