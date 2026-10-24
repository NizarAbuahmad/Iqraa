/**
 * The decisions behind `english-audio-check` (`scripts/check-english-audio.ts`),
 * which transcribes the English corner's recordings with a speech-to-text model and
 * reports where what is said differs from what the app expects. Pure: no I/O, no
 * keys, no network. The command only wires flags, the real fetch and the real
 * transcription call into `checkClips`.
 *
 * A verdict says «a person should listen», never «wrong»: single words are hard to
 * transcribe (homophones, rare words), and a recogniser forgives accent and stress,
 * so a clip can pass here and still sound wrong. See the report's own caveat.
 *
 * Known limits, left as they are: «prise»/«prize» fold together (-ise rule); a
 * difference only in spaces («fire fighter») is a mismatch; digit runs outside
 * 0-20, the tens and 100 are compared as written; contractions are not expanded
 * («I'm» / «I am» differ).
 */
import type { AudioItem } from './englishAudioPlan.ts';

export type SpokenVerdict = 'match' | 'close' | 'mismatch' | 'silent';

// ─── Normalising ───────────────────────────────────────────────────────────

const UNITS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];
const TENS: Record<string, string> = {
  '30': 'thirty', '40': 'forty', '50': 'fifty', '60': 'sixty', '70': 'seventy', '80': 'eighty', '90': 'ninety',
  '100': 'one hundred',
};

/** A whole-token digit run as words: 0–20, the tens to 90, and 100. Any other run is left as it is. */
function numberWords(token: string): string {
  if (!/^\d+$/.test(token)) return token;
  if (token !== '0' && token.startsWith('0')) return token; // "05" is not a number a clip says
  const n = Number(token);
  if (n <= 20) return UNITS[n] ?? token;
  return TENS[token] ?? token;
}

/**
 * British → American, one spelling per word. A transcriber writes either, and the
 * books are British, so both sides are folded to the American form before they are
 * compared (the form chosen does not matter, only that the two collide).
 *
 * «mum» is deliberately NOT folded to «mom»: the app teaches «mum», and a recogniser
 * that hears «mom» for it is giving a real accent signal, so `mom` stays a mismatch.
 */
const SPELLING: Record<string, string> = {
  grey: 'gray',
  greys: 'grays',
  programme: 'program',
  programmes: 'programs',
  travelling: 'traveling',
  travelled: 'traveled',
  traveller: 'traveler',
  travellers: 'travelers',
  cancelled: 'canceled',
  cancelling: 'canceling',
  labelled: 'labeled',
  modelling: 'modeling',
  modelled: 'modeled',
  jewellery: 'jewelry',
  pyjamas: 'pajamas',
  doughnut: 'donut',
  doughnuts: 'donuts',
  tyre: 'tire',
  tyres: 'tires',
  cosy: 'cozy',
  defence: 'defense',
  aluminium: 'aluminum',
  // Looked up before the -ise rule, which would otherwise make «practize».
  practise: 'practice',
  practised: 'practiced',
  practising: 'practicing',
  practises: 'practices',
};
/** Stems whose British «-our» becomes «-or» (colour, colourful, colours, favourite, neighbour's …). */
const OUR_STEMS = ['colour', 'favour', 'neighbour', 'honour', 'humour', 'behaviour', 'flavour', 'labour'];
/** «-re» → «-er» for these endings (centre, theatres, kilometre, millilitre …). */
const RE_ENDING = /(centre|theatre|metre|litre)(s?)$/;
/** Words of 5+ letters: «-ise/-ised/-ises/-ising/-isation(s)» → the «-ize» form (organise, organisation …). */
const ISE_SUFFIX = /^(.{2,})is(e|es|ed|ing|ation|ations)$/;

function americanSpelling(token: string): string {
  const direct = SPELLING[token];
  if (direct !== undefined) return direct;
  for (const stem of OUR_STEMS) {
    if (token.startsWith(stem)) return stem.slice(0, -3) + 'or' + token.slice(stem.length);
  }
  if (RE_ENDING.test(token)) return token.replace(RE_ENDING, (_m, w: string, s: string) => w.slice(0, -2) + 'er' + s);
  if ([...token].length >= 5) {
    const m = ISE_SUFFIX.exec(token);
    if (m) return `${m[1]}iz${m[2]}`;
  }
  return token;
}

/** Words that sound alike, each mapped to the first of its group. */
const HOMOPHONE_GROUPS: string[][] = [
  ['right', 'write'],
  ['there', 'their', "they're"],
  ['to', 'too', 'two'],
  ['no', 'know'],
  ['see', 'sea'],
  ['buy', 'by', 'bye'],
  ['hear', 'here'],
  ['one', 'won'],
  ['for', 'four'],
  ['sun', 'son'],
  ['flour', 'flower'],
  ['meet', 'meat'],
  ['week', 'weak'],
  ['which', 'witch'],
  ['new', 'knew'],
  ['whole', 'hole'],
  ['wait', 'weight'],
  ['tail', 'tale'],
  ['plane', 'plain'],
  ['pair', 'pear', 'pare'],
  ['sale', 'sail'],
  ['steal', 'steel'],
  ['break', 'brake'],
];
const HOMOPHONES: Record<string, string> = {};
for (const [head, ...rest] of HOMOPHONE_GROUPS) for (const w of rest) HOMOPHONES[w] = head as string;

const APOSTROPHES = /[‘’‛ʼ′`´]/g;

function normalizeToken(token: string): string {
  const spelt = americanSpelling(numberWords(token));
  // number words can be two words ("one hundred"): fold each
  return spelt
    .split(' ')
    .map(w => (Object.hasOwn(HOMOPHONES, w) ? (HOMOPHONES[w] as string) : w))
    .join(' ');
}

/**
 * The comparable form of a spoken or expected text: lowercase; Unicode apostrophes
 * straightened; punctuation and hyphens become spaces (the apostrophe inside a word
 * stays), runs of space one space; digits as number words (0–20, 30…90, 100; other
 * digit runs untouched); British spellings folded to American; homophones folded to
 * one form. `''` for empty or punctuation-only text.
 */
export function normalizeSpoken(text: string): string {
  const cleaned = text
    .normalize('NFC')
    .toLowerCase()
    .replace(APOSTROPHES, "'")
    .replace(/[^\p{L}\p{M}\p{N}']+/gu, ' ');
  const out: string[] = [];
  for (const raw of cleaned.split(' ')) {
    const token = raw.replace(/^'+|'+$/g, '');
    if (token) out.push(normalizeToken(token));
  }
  return out.join(' ');
}

// ─── Comparing ─────────────────────────────────────────────────────────────

export interface Comparison {
  verdict: SpokenVerdict;
  /** Character edits for a single word, word edits for a sentence. */
  distance: number;
  /** Both normalised. */
  expected: string;
  heard: string;
}

/** Levenshtein distance over any two sequences (characters or word tokens). */
function editDistance<T>(a: readonly T[], b: readonly T[]): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        (prev[j] as number) + 1,
        (cur[j - 1] as number) + 1,
        (prev[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length] as number;
}

/** A single expected word can be `close` only from this length. */
const CLOSE_MIN_LETTERS = 6;
/** The endings that make one word the other's inflection (firefighter / firefighters). */
const INFLECTION_SUFFIXES = ['s', 'es', 'd', 'ed', 'ing', 'er', 'ers'];

/** One word is the other plus one inflection ending. «loud» / «loudly» is not one. */
function isInflection(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return long.startsWith(short) && INFLECTION_SUFFIXES.includes(long.slice(short.length));
}

/**
 * - `silent`   nothing heard;
 * - `match`    equal once both are normalised;
 * - `close`    a single expected word of 6+ letters whose heard form is it plus or
 *              minus one inflection ending (s es d ed ing er ers); or a multi-word
 *              text within floor(10% of its words) word edits: none under 10 words,
 *              one for 10-19, two for 20-29. The report lists these for a glance,
 *              not for re-voicing;
 * - `mismatch` anything else, which is the point: «carrot» / «parrot», «I am ten» /
 *              «I am two» and «bit» / «bet» are exactly the confusions the check
 *              exists to find, so a one-letter or one-word difference is never
 *              close unless it is an inflection of a long word.
 */
export function compareSpoken(expected: string, heard: string): Comparison {
  const e = normalizeSpoken(expected);
  const h = normalizeSpoken(heard);
  if (h === '') return { verdict: 'silent', distance: e === '' ? 0 : [...e].length, expected: e, heard: h };
  if (e === h) return { verdict: 'match', distance: 0, expected: e, heard: h };

  const ew = e.split(' ');
  const hw = h.split(' ');
  if (ew.length === 1 && hw.length === 1) {
    const distance = editDistance([...e], [...h]);
    const close = [...e].length >= CLOSE_MIN_LETTERS && isInflection(e, h);
    return { verdict: close ? 'close' : 'mismatch', distance, expected: e, heard: h };
  }
  const distance = editDistance(ew, hw);
  const allowed = Math.floor(0.1 * ew.length);
  return { verdict: distance <= allowed ? 'close' : 'mismatch', distance, expected: e, heard: h };
}

// ─── Cost ──────────────────────────────────────────────────────────────────

/** List prices per audio minute as of 2026-10; check OpenAI's page before a big run. */
export const PRICE_PER_MINUTE_USD: Record<string, number> = {
  'gpt-4o-transcribe': 0.006,
  'gpt-4o-mini-transcribe': 0.003,
  'whisper-1': 0.006,
};

/** The cost of transcribing this many seconds, or `null` when the model's price is not known. */
export function estimateCostUsd(totalSeconds: number, model: string): number | null {
  if (!Object.hasOwn(PRICE_PER_MINUTE_USD, model)) return null;
  const seconds = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;
  return (seconds / 60) * (PRICE_PER_MINUTE_USD[model] as number);
}

/**
 * The clips in the bucket are 40 kbps (processed) or 128 kbps (the first 201, as the model
 * returned them). The lower the bitrate, the MORE seconds the same bytes hold, so 40 is the
 * assumption that can only over-count: an upper bound on seconds and on cost. (128 would
 * under-count the processed clips by a factor of 3: apples.mp3, 4,437 bytes, is 0.84 s.)
 */
export const ASSUMED_KBPS = 40;

export function secondsFromBytes(bytes: number, kbps: number = ASSUMED_KBPS): number {
  return (bytes * 8) / (kbps * 1000);
}

// ─── The API ───────────────────────────────────────────────────────────────

/**
 * A key that can go in an `Authorization` header: printable ASCII with no space, so no
 * control character, line break or non-ASCII letter. Anything else makes `fetch` throw an
 * error that carries the header value, which must never reach a screen or a report.
 */
export function isPlausibleApiKey(key: string): boolean {
  return /^[!-~]+$/.test(key);
}

/**
 * Whether a refusal from the transcription API will be the same for every clip, so the run
 * should stop once instead of filling the report with errors: a refused key (401/403), an
 * unknown endpoint or model (404, `model_not_found`) and an exhausted quota (429 with code
 * `insufficient_quota`; an ordinary 429 is a rate limit and is waited out).
 */
export function shouldStopRun(status: number, code: string | undefined): boolean {
  if (status === 401 || status === 403 || status === 404) return true;
  if (code === 'model_not_found') return true;
  return status === 429 && code === 'insufficient_quota';
}

// ─── Cache ─────────────────────────────────────────────────────────────────

/**
 * The cache to save after a `--refresh` run. A refreshed clip's new transcript replaces the
 * old one, and one that came back silent (so was not cached) drops the stale transcript
 * instead of letting it survive; an error, a missing clip or a clip the run never reached
 * keeps what it had, and so does every clip the run did not select.
 */
export function mergeRefreshed(stored: SpeechCache, fresh: SpeechCache, results: CheckResult[]): SpeechCache {
  const merged: SpeechCache = { ...stored };
  for (const r of results) {
    if (r.verdict === 'error' || r.verdict === 'missing') continue;
    const slug = r.item.slug;
    if (Object.hasOwn(fresh, slug)) merged[slug] = fresh[slug] as CacheEntry;
    else delete merged[slug];
  }
  return merged;
}

export interface CacheEntry {
  size: number;
  etag: string;
  heard: string;
}
/** Keyed by slug. Holds transcripts only, never a key. */
export type SpeechCache = Record<string, CacheEntry>;

/** The cached transcript, only while the clip is the one it was made from (size AND etag). */
export function cacheHit(cache: SpeechCache, slug: string, size: number, etag: string): string | null {
  if (!Object.hasOwn(cache, slug)) return null;
  const e = cache[slug] as CacheEntry;
  return e.size === size && e.etag === etag ? e.heard : null;
}

/** Tolerant: anything that is not a cache object is `{}`, and a malformed entry is dropped. */
export function parseSpeechCache(json: string): SpeechCache {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return {};
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SpeechCache = {};
  for (const [slug, v] of Object.entries(raw)) {
    if (slug === '__proto__' || !v || typeof v !== 'object') continue;
    const { size, etag, heard } = v as Partial<CacheEntry>;
    if (typeof size === 'number' && Number.isFinite(size) && typeof etag === 'string' && typeof heard === 'string') {
      out[slug] = { size, etag, heard };
    }
  }
  return out;
}

/** Keys sorted, so two runs diff cleanly. */
export function serializeSpeechCache(cache: SpeechCache): string {
  const sorted: SpeechCache = {};
  for (const slug of Object.keys(cache).sort()) sorted[slug] = cache[slug] as CacheEntry;
  return JSON.stringify(sorted, null, 2) + '\n';
}

// ─── The checking loop ─────────────────────────────────────────────────────

export interface CheckResult {
  item: AudioItem;
  heard: string;
  verdict: SpokenVerdict | 'missing' | 'error';
  detail?: string;
}

export interface CheckDeps {
  /** `'missing'` when the bucket has no such clip; throws on a transport failure. */
  fetchClip(item: AudioItem): Promise<{ bytes: Uint8Array; size: number; etag: string } | 'missing'>;
  /** Throws `StopRun` for a refusal that would repeat for every clip (`shouldStopRun`: a refused key, an unknown model or endpoint, an exhausted quota); any other throw is that one clip's error. */
  transcribe(bytes: Uint8Array, item: AudioItem): Promise<string>;
  /** Read and updated in place. */
  cache: SpeechCache;
  concurrency: number;
  onProgress?(done: number, total: number): void;
}

/** Thrown by `transcribe` when the API's refusal would be the same for every clip (a refused key, an unknown model, an exhausted quota; see `shouldStopRun`): every worker stops. */
export class StopRun extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'StopRun';
  }
}

/** An error's text for a report, with anything shaped like an API key removed. */
function describeError(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  return text.replace(/sk-[A-Za-z0-9_-]{6,}/g, 'sk-…');
}

/**
 * Fetches, looks up the cache for, transcribes and grades every item, with at most
 * `deps.concurrency` clips in flight. Results come back in the order of `items`.
 * A clip that fails is an `error` result and the run goes on. On `StopRun` no worker
 * takes a new clip; the clip that raised it gets no result, clips already finished
 * keep theirs, and `stopped` is true (so `results` may be shorter than `items`) with
 * `stopReason` the message of the first `StopRun` (key-shaped text removed).
 * A transcript with nothing in it is not cached, so a re-run tries that clip again.
 */
export async function checkClips(
  items: AudioItem[],
  deps: CheckDeps,
): Promise<{ results: CheckResult[]; stopped: boolean; stopReason?: string }> {
  const slots: Array<CheckResult | undefined> = new Array(items.length).fill(undefined);
  let next = 0;
  let done = 0;
  let stopped = false;
  let stopReason: string | undefined;

  const one = async (item: AudioItem): Promise<CheckResult | StopRun> => {
    try {
      const clip = await deps.fetchClip(item);
      if (clip === 'missing') return { item, heard: '', verdict: 'missing' };
      let heard = cacheHit(deps.cache, item.slug, clip.size, clip.etag);
      if (heard === null) {
        heard = await deps.transcribe(clip.bytes, item);
        if (normalizeSpoken(heard) !== '') deps.cache[item.slug] = { size: clip.size, etag: clip.etag, heard };
      }
      return { item, heard, verdict: compareSpoken(item.text, heard).verdict };
    } catch (e) {
      if (e instanceof StopRun) return e;
      return { item, heard: '', verdict: 'error', detail: describeError(e) };
    }
  };

  const worker = async () => {
    while (!stopped) {
      const i = next++;
      if (i >= items.length) return;
      const result = await one(items[i] as AudioItem);
      if (result instanceof StopRun) {
        if (!stopped) stopReason = describeError(result);
        stopped = true;
        return;
      }
      slots[i] = result;
      try {
        deps.onProgress?.(++done, items.length);
      } catch {
        // A broken progress display must not lose results or leave workers running.
      }
    }
  };

  const workers = Math.max(1, Math.min(Math.floor(deps.concurrency) || 1, items.length));
  await Promise.all(Array.from({ length: workers }, worker));
  const results = slots.filter((r): r is CheckResult => r !== undefined);
  return stopped ? { results, stopped, stopReason: stopReason ?? '' } : { results, stopped };
}

// ─── The report ────────────────────────────────────────────────────────────

const COLUMNS = ['match', 'close', 'mismatch', 'silent', 'missing', 'error'] as const;
type Column = (typeof COLUMNS)[number];

/** The `--only` command for what should be re-voiced and listened to: mismatch and silent slugs, sorted. */
export function onlyLine(results: CheckResult[]): string {
  const slugs = results.filter(r => r.verdict === 'mismatch' || r.verdict === 'silent').map(r => r.item.slug);
  if (slugs.length === 0) return '';
  return `pnpm --filter @workspace/curriculum run english-audio -- --only ${[...new Set(slugs)].sort().join(',')}`;
}

const tableLine = (cells: string[]) => `| ${cells.join(' | ')} |`;

/**
 * Markdown table lines: one row per grade × source, then an `All` row. A recording
 * used by two grades counts in both grades' rows; the `All` row counts it once. A
 * recording no grade uses sits under grade `-`.
 */
export function summarizeResults(results: CheckResult[]): string[] {
  type Counts = Record<Column | 'total', number>;
  const blank = (): Counts => ({ match: 0, close: 0, mismatch: 0, silent: 0, missing: 0, error: 0, total: 0 });
  const bump = (c: Counts, v: Column) => {
    c[v]++;
    c.total++;
  };
  const rows = new Map<string, { grade: string; source: string; counts: Counts }>();
  const all = blank();
  for (const r of results) {
    bump(all, r.verdict);
    const grades = r.item.grades.length > 0 ? r.item.grades.map(String) : ['-'];
    for (const grade of grades) {
      const key = `${grade}\u0000${r.item.source}`;
      let row = rows.get(key);
      if (!row) rows.set(key, (row = { grade, source: r.item.source, counts: blank() }));
      bump(row.counts, r.verdict);
    }
  }
  const order = (g: string) => (g === '-' ? Number.POSITIVE_INFINITY : Number(g));
  const sorted = [...rows.values()].sort(
    (a, b) => order(a.grade) - order(b.grade) || (a.source < b.source ? -1 : a.source > b.source ? 1 : 0),
  );
  const cells = (grade: string, source: string, c: Counts) => [
    grade,
    source,
    ...COLUMNS.map(k => String(c[k])),
    String(c.total),
  ];
  return [
    tableLine(['Grade', 'Source', ...COLUMNS, 'total']),
    tableLine(['---', '---', ...COLUMNS.map(() => '---:'), '---:']),
    ...sorted.map(r => tableLine(cells(r.grade, r.source, r.counts))),
    tableLine(cells('All', 'all', all)),
  ];
}

/** One table cell: a pipe or a line break in a transcript must not break the row. */
const cell = (text: string) => text.replace(/\r?\n|\r/g, ' ').replace(/\|/g, '\\|').trim();

export function renderReportMarkdown(results: CheckResult[], meta: { model: string; date: string }): string {
  const problems = results.filter(r => r.verdict === 'mismatch' || r.verdict === 'silent');
  const missing = results.filter(r => r.verdict === 'missing');
  const errors = results.filter(r => r.verdict === 'error');
  const lines: string[] = [
    '# English audio: speech check',
    '',
    `Model \`${meta.model}\` · ${meta.date} · ${results.length} recordings checked`,
    '',
    'A mismatch means a person should listen, not that the recording is wrong: single words are hard to transcribe ' +
      '(homophones, rare words), and a clip can be flagged although it is right.',
    '',
    'This check hears the word, not how it is said. It catches a wrong, dropped, added or garbled word and blank speech; ' +
      'it does not catch accent or stress errors, which still need an ear.',
    '',
    '## Summary',
    '',
    ...summarizeResults(results),
    '',
  ];

  lines.push('## To listen to (mismatch and silent)', '');
  if (problems.length === 0) {
    lines.push('Nothing needs a listen.', '');
  } else {
    lines.push(
      tableLine(['Verdict', 'Expected', 'Heard', 'Slug', 'Grades']),
      tableLine(['---', '---', '---', '---', '---']),
      ...problems.map(r =>
        tableLine([
          r.verdict,
          cell(r.item.text),
          cell(r.heard),
          cell(r.item.slug),
          r.item.grades.length > 0 ? r.item.grades.join(', ') : '-',
        ]),
      ),
      '',
      'Re-voice them (after listening):',
      '',
      '```',
      onlyLine(results),
      '```',
      '',
    );
  }

  const close = results.filter(r => r.verdict === 'close');
  if (close.length > 0) {
    lines.push(
      '## Close: worth a glance',
      '',
      'Within an inflection ending or a few words of a long text. Not re-voiced by the line above.',
      '',
      tableLine(['Expected', 'Heard', 'Slug', 'Grades']),
      tableLine(['---', '---', '---', '---']),
      ...close.map(r =>
        tableLine([
          cell(r.item.text),
          cell(r.heard),
          cell(r.item.slug),
          r.item.grades.length > 0 ? r.item.grades.join(', ') : '-',
        ]),
      ),
      '',
    );
  }

  if (missing.length > 0) {
    lines.push('## Missing from the bucket', '', ...missing.map(r => `- ${cell(r.item.slug)}`), '');
  }
  if (errors.length > 0) {
    lines.push(
      '## Could not be checked',
      '',
      ...errors.map(r => `- ${cell(r.item.slug)}: ${cell(describeError(r.detail ?? 'unknown error'))}`),
      '',
    );
  }
  return lines.join('\n');
}
