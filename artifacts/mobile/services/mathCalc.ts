/**
 * The scientific calculator's keypad model. Pure and free of react-native.
 *
 * The line is a list of atomic entries, one per key press, so DEL removes a
 * whole «sin(» and not a letter of it. Entries are latin (`sin(`, `*`, `pi`);
 * `entriesToDisplay` is the only place they become «جا(» «×» «π» and Arabic
 * digits, and `entriesToSource` hands the latin form to `mathExpr`.
 */
import { evaluate, autoCloseBrackets, type AngleMode, type EvalResult } from './mathExpr.ts';
import { formatScientific, toArabicDigits } from './labFormat.ts';

type Lang = 'ar' | 'en';

/** Key id → the atom it appends to the line. */
const ENTRY_KEYS = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '.': '.',
  '+': '+', '-': '-', '*': '*', '/': '/',
  '(': '(', ')': ')', '^': '^', '!': '!', '%': '%', ',': ',',
  x2: '^2',
  sin: 'sin(', cos: 'cos(', tan: 'tan(',
  asin: 'asin(', acos: 'acos(', atan: 'atan(',
  sqrt: 'sqrt(', cbrt: 'cbrt(', abs: 'abs(',
  ln: 'ln(', log: 'log(', exp: 'exp(',
  nCr: 'nCr(', nPr: 'nPr(',
  pi: 'pi', e: 'e', ans: 'Ans',
} as const;

export type EntryKey = keyof typeof ENTRY_KEYS;
export type CalcKey = EntryKey | 'DEL' | 'AC' | '=';

/** After «=», these continue from the answer; anything else starts a fresh line. */
const CONTINUES_FROM_ANS: ReadonlySet<CalcKey> = new Set<CalcKey>(['+', '-', '*', '/', '^', '!', '%', 'x2']);

export const HISTORY_LIMIT = 20;

export type HistoryItem = { entries: string[]; value: number };

export type CalcState = {
  entries: string[];
  /** The last «=»; null while the line is being typed. */
  result: EvalResult | null;
  /** Last successful answer, for the Ans key. */
  ans: number | null;
  /** Newest first. */
  history: HistoryItem[];
};

export function initialCalcState(): CalcState {
  return { entries: [], result: null, ans: null, history: [] };
}

/**
 * Wrap display text in a left-to-right *override* (LRO … PDF). An isolate is not
 * enough here: Arabic-Indic digits (bidi type AN) have no «weak → L» rule the
 * way Latin digits do, so inside even an LTR isolate the neutrals between two
 * numbers resolve right-to-left and «٩٫٥ × ١٠» is laid out as «١٠ × ٩٫٥». The
 * web document is pinned `dir="ltr"` and react-native-web stamps `dir="auto"`
 * on every `Text`, so no style can fix it either. An override makes every
 * character L, which also stops a lone «(» being drawn as «)». Display only:
 * never feed the result to `mathExpr`.
 */
export function forceLtr(text: string): string {
  return text === '' ? '' : `\u202D${text}\u202C`;
}

// Letters only: the Arabic-Indic digits are Script=Arabic too, and must not count.
const ARABIC_LETTER = /(?=\p{L})\p{Script=Arabic}/u;

/**
 * `forceLtr` for anything that may hold an Arabic word. An override lays Arabic
 * letters out left-to-right too, so «جا» would print as «اج»; words are left to
 * the ordinary algorithm and only digit/operator text is forced.
 */
export function displayLtr(text: string): string {
  return ARABIC_LETTER.test(text) ? text : forceLtr(text);
}

export function entriesToSource(entries: string[]): string {
  return entries.join('');
}

const DISPLAY: Record<Lang, Record<string, string>> = {
  en: {
    '*': '×', '/': '÷', '-': '−', 'pi': 'π', '^2': '²',
    'sqrt(': '√(', 'asin(': 'sin⁻¹(', 'acos(': 'cos⁻¹(', 'atan(': 'tan⁻¹(',
  },
  ar: {
    '*': '×', '/': '÷', '-': '−', 'pi': 'π', '^2': '²',
    'sqrt(': '√(', 'sin(': 'جا(', 'cos(': 'جتا(', 'tan(': 'ظا(',
    'asin(': 'جا⁻¹(', 'acos(': 'جتا⁻¹(', 'atan(': 'ظا⁻¹(',
  },
};

export function entriesToDisplay(entries: string[], lang: Lang): string {
  return entries
    .map(atom => {
      const mapped = DISPLAY[lang][atom];
      if (mapped !== undefined) return mapped;
      return lang === 'ar' && /^[0-9.]$/.test(atom) ? toArabicDigits(atom) : atom;
    })
    .join('');
}

export type DisplaySegment = { text: string; word: boolean };

const WORD_PREFIX = /^((?:(?=\p{L})\p{Script=Arabic})+[⁻¹]*)(.*)$/u;

/**
 * The line as runs for the screen. Each Arabic function word is its own run and
 * everything else (digits, operators, brackets) is merged, so the screen can
 * lay the runs out in a row in typed order and force LTR only on the non-word
 * ones. Mixing «جا» with digits inside one string leaves the order to the bidi
 * algorithm, which swaps the runs (see `forceLtr`). Rejoined, the segments are
 * exactly `entriesToDisplay`.
 */
export function entriesToSegments(entries: string[], lang: Lang): DisplaySegment[] {
  const out: DisplaySegment[] = [];
  const add = (text: string, word: boolean) => {
    const last = out[out.length - 1];
    if (!word && last && !last.word) last.text += text;
    else out.push({ text, word });
  };
  for (const atom of entries) {
    const shown = entriesToDisplay([atom], lang);
    const m = WORD_PREFIX.exec(shown);
    if (m) {
      add(m[1], true);
      if (m[2] !== '') add(m[2], false);
    } else {
      add(shown, false);
    }
  }
  return out;
}

export function press(state: CalcState, key: CalcKey, angle: AngleMode): CalcState {
  if (key === 'AC') return { ...state, entries: [], result: null };

  if (key === 'DEL') {
    if (state.entries.length === 0) return state;
    return { ...state, entries: state.entries.slice(0, -1), result: null };
  }

  if (key === '=') {
    if (state.entries.length === 0) return state;
    const source = autoCloseBrackets(entriesToSource(state.entries));
    const result = evaluate(source, { angle, vars: { Ans: state.ans ?? 0 } });
    if (!result.ok) return { ...state, result };
    return {
      ...state,
      result,
      ans: result.value,
      history: [{ entries: state.entries, value: result.value }, ...state.history].slice(0, HISTORY_LIMIT),
    };
  }

  const atom = ENTRY_KEYS[key];
  const justEvaluated = state.result !== null && state.result.ok;
  if (justEvaluated) {
    const head = CONTINUES_FROM_ANS.has(key) ? ['Ans'] : [];
    return { ...state, entries: [...head, atom], result: null };
  }
  return { ...state, entries: [...state.entries, atom], result: null };
}

/** Put a history line back on the line, to be edited and evaluated again. */
export function recall(state: CalcState, item: HistoryItem): CalcState {
  return { ...state, entries: [...item.entries], result: null };
}

export function pressAll(state: CalcState, keys: CalcKey[], angle: AngleMode): CalcState {
  return keys.reduce((s, k) => press(s, k, angle), state);
}

const MINUS = '−';
const TIMES_TEN: Record<Lang, string> = { ar: ' × ١٠', en: ' × 10' };

/**
 * A result for the display. Ordinary magnitudes print in up to 10 significant
 * digits; below 1e-6 or from 1e10 up it is scientific, and the exponent comes
 * back separately so the screen can raise it (Arabic-Indic digits have no
 * superscript forms).
 */
export function formatCalcNumber(n: number, lang: Lang): { text: string; exponent: string | null } {
  if (!Number.isFinite(n)) return { text: '—', exponent: null };
  const sign = n < 0 ? MINUS : '';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e10)) {
    const { mantissa, exponent } = formatScientific(abs, lang, 10);
    return { text: `${sign}${mantissa}${TIMES_TEN[lang]}`, exponent };
  }
  const plain = String(Number(abs.toPrecision(10)));
  const body = lang === 'ar' ? toArabicDigits(plain) : plain;
  return { text: abs === 0 ? body : `${sign}${body}`, exponent: null };
}
