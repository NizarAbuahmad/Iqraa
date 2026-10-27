/**
 * Listens to the English-corner recordings and says where what is spoken differs from
 * what the app expects. Each clip in `audioPlan()` is downloaded from the PUBLIC bucket
 * the app plays from, transcribed by a speech-to-text model, and the transcript is
 * compared with the text (`src/englishAudioCheck.ts`: the normalising, the verdicts, the
 * cache and the report are all there, pure and tested; this file only wires flags, the
 * real fetch and the real API call). Read-only: nothing is written to the bucket, nothing
 * is re-voiced; the only files written are the report and the cache, both git-ignored.
 *
 *   pnpm --filter @workspace/curriculum run english-audio-check [-- <flags>]
 *
 * First run, in this order: `-- --dry-run --source word`, then `-- --source word --limit 50`
 * (read the report), then `-- --source word`. Today that is about 1,248 transcriptions
 * (the hub words) and roughly 15-20 minutes. The 3,383 grammar sentences are not voiced
 * yet: a run without `--source word` asks the bucket for each, is answered 404 and lists
 * them under «Missing». Once they are voiced the full run is about 4,600 transcriptions
 * and roughly 30-50 minutes. The first report may be noisy (see the limits below).
 *
 *   --dry-run         no key and no transcription: `HEAD` every selected clip, print how
 *                      many exist, their bytes, an upper bound on the audio minutes and
 *                      an estimate of the cost (audio only; see Cost below). Run this first.
 *   --only a,b         just these (slugs, or the words themselves → `audioSlug`)
 *   --grade N          just the recordings a grade N lesson or grammar unit uses
 *   --source word|grammar   just hub words, or just grammar strings
 *   --limit N          the first N after the filters above (try 20 before a full run)
 *   --model <name>     default `gpt-4o-transcribe`; `gpt-4o-mini-transcribe` and `whisper-1`
 *                      also have a known price
 *   --cache <file>     transcripts already paid for, default ./english-audio-check.cache.json.
 *                      Keyed by slug plus the clip's size and ETag, so a re-run pays only
 *                      for clips that changed. Saved every 100 clips, on Ctrl+C and when
 *                      the API stops the run.
 *   --refresh          ignore the cache (transcribe everything again; the new transcripts
 *                      replace the old ones, a clip that now comes back silent loses its
 *                      old one, other cache entries are kept)
 *   --out <file>       the report, default ./english-audio-check.report.md; the same
 *                      report is written as JSON beside it (.json)
 *   --fail-on-mismatch exit 1 when anything is a mismatch or silent, or could not be
 *                      checked at all (an error row): for a release check, where an
 *                      unchecked clip is not a pass
 *
 * Exit code: 0; 1 with --fail-on-mismatch and a mismatch, silent or error row; 2 for a
 * refusal (no key, a bad flag, a cache path that would lose a file, or the API refusing
 * every request: 401/403, an unknown model or endpoint, an exhausted quota; the run stops
 * once and leaves a PARTIAL report and the cache).
 *
 * Key: `OPENAI_API_KEY`, from the environment or the repo-root `.env` (as the generator
 * does). An empty one or the `sk-your…` placeholder is refused. The key is never printed,
 * logged, or written to the report or the cache, which hold slugs, texts and transcripts
 * only. `OPENAI_BASE_URL` overrides `https://api.openai.com/v1` and `AUDIO_BASE_URL` the
 * place the clips are fetched from (a local fixture server, for example). Nothing is sent
 * to the API when you pass --dry-run.
 *
 * The model is NEVER told the expected text: only `language: en`, `temperature: 0` and a
 * generic prompt. Telling it would bias the transcript towards agreeing and prove nothing.
 *
 * A mismatch means «a person should listen», not «wrong». Honest limits:
 *  - It hears the word, not how it is said. Accent and stress errors («EE-ray-ser» for
 *    «eraser») pass: recognisers forgive them. Those still need an ear.
 *  - A homophone or a rare word can be flagged although it is right, and a wrong clip
 *    passes when the wrong word sounds the same as the right one (pair/pear/pare,
 *    flower/flour, plane/plain): the recogniser hears one sound for both.
 *  - `close` (an inflection ending on a long word, a word or two in a long text) is
 *    listed for a glance and never re-voiced by the line this prints. The `er`/`ing`
 *    endings can land a different word there (number/numb).
 *  - Cost. `PRICE_PER_MINUTE_USD` holds OpenAI's per-minute ESTIMATES as of 2026-10, for the
 *    audio only. The gpt-4o models bill by tokens: the audio, plus the prompt as text in
 *    and the transcript as text out, so on 1-2 second clips expect up to about double.
 *    Check OpenAI's pricing page before a big run; no figure printed here is a ceiling.
 *    The dry-run minutes assume 40 kbps, the lowest bitrate in the bucket: a lower bitrate
 *    holds MORE seconds in the same bytes, so for any clip (the first 201 are 128 kbps and
 *    shorter than their bytes suggest at 40) it can only over-count the minutes.
 *  - A host that cannot be reached at all stops the run after 10 clips in a row fail to
 *    connect (exit 2, «the transcription API is unreachable»), not after every clip has
 *    burned its five attempts.
 *  - The public r2.dev link rate-limits; the fetch inherits the audit's backoff. Node's
 *    `fetch` may ignore `HTTPS_PROXY`; behind a proxy run with `NODE_USE_ENV_PROXY=1`.
 */
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnvFile } from '../../../scripts/load-env.mjs';
import {
  StopRun,
  TransportError,
  checkClips,
  estimateCostUsd,
  isPlausibleApiKey,
  mergeRefreshed,
  onlyLine,
  parseSpeechCache,
  renderReportMarkdown,
  secondsFromBytes,
  serializeSpeechCache,
  shouldStopRun,
  summarizeResults,
  type CheckResult,
  type SpeechCache,
} from '../src/englishAudioCheck.ts';
import { audioPlan, type AudioItem } from '../src/englishAudioPlan.ts';
import { audioSlug } from '../src/englishHub.ts';
import { pool, requestWithBackoff } from './audioHttp.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(HERE, '..', '..', '..', '.env'));

/**
 * Duplicated from `ENGLISH_AUDIO_BASE_URL` in `artifacts/mobile/services/englishAudio.ts`
 * (the app and this library do not share code); `englishAudioLocation.test.ts` pins it equal.
 */
const DEFAULT_AUDIO_BASE_URL = 'https://pub-d9ddd8f74e734a21824518b812652124.r2.dev/english-audio';
const AUDIO_BASE = (process.env.AUDIO_BASE_URL || DEFAULT_AUDIO_BASE_URL).replace(/\/+$/, '');
const OPENAI_BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');

/** Generic on purpose: it must not name the expected text. */
const GENERIC_PROMPT = 'An English vocabulary word or sentence, spoken with a British accent.';
const DEFAULT_MODEL = 'gpt-4o-transcribe';
const CLIP_TIMEOUT_MS = 30_000;
const TRANSCRIBE_TIMEOUT_MS = 60_000;
const FETCH_CONCURRENCY = 6; // HEAD requests in --dry-run
const CHECK_CONCURRENCY = 3; // downloads + transcriptions in flight
const TRANSCRIBE_ATTEMPTS = 5;
const SHOWN_PROBLEMS = 40;

// ─── Flags ────────────────────────────────────────────────────────────────

const VALUE_FLAGS = new Set(['--only', '--grade', '--source', '--limit', '--model', '--cache', '--out']);
const BOOLEAN_FLAGS = new Set(['--refresh', '--dry-run', '--fail-on-mismatch']);

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

const argv = process.argv.slice(2);
const values = new Map<string, string>();
const switches = new Set<string>();
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i] as string;
  if (arg === '--') continue;
  if (BOOLEAN_FLAGS.has(arg)) {
    switches.add(arg);
  } else if (VALUE_FLAGS.has(arg)) {
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) fail(`${arg} needs a value.`);
    values.set(arg, value);
    i += 1;
  } else {
    fail(`unknown flag ${arg}. See the header of scripts/check-english-audio.ts.`);
  }
}

const dryRun = switches.has('--dry-run');
const refresh = switches.has('--refresh');
const failOnMismatch = switches.has('--fail-on-mismatch');
const model = values.get('--model') ?? DEFAULT_MODEL;
const cachePath = path.resolve(values.get('--cache') ?? 'english-audio-check.cache.json');
const outPath = path.resolve(values.get('--out') ?? 'english-audio-check.report.md');
const jsonPath = outPath.replace(/\.md$/i, '') + '.json';
if (cachePath === outPath || cachePath === jsonPath) {
  fail('--cache and --out would write the same file (the JSON report sits beside --out, with .json). Give them different names.');
}

function positiveInt(flag: string): number | undefined {
  const raw = values.get(flag);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) fail(`${flag} needs a whole number of 1 or more, not "${raw}".`);
  return n;
}

const grade = positiveInt('--grade');
const limit = positiveInt('--limit');
const source = values.get('--source');
if (source !== undefined && source !== 'word' && source !== 'grammar') fail('--source is word or grammar.');

// ─── Which clips ──────────────────────────────────────────────────────────

const plan = audioPlan();
let selected: AudioItem[] = plan;

const onlyArg = values.get('--only');
if (onlyArg !== undefined) {
  const wanted = onlyArg.split(',').map(s => s.trim()).filter(Boolean).map(audioSlug);
  if (wanted.length === 0) fail('--only needs at least one slug or word.');
  const bySlug = new Map(plan.map(i => [i.slug, i]));
  const unknown = wanted.filter(s => !bySlug.has(s));
  if (unknown.length) fail(`not in the audio plan (hub words and grammar strings): ${unknown.join(', ')}`);
  selected = [...new Set(wanted)].map(s => bySlug.get(s) as AudioItem);
}
if (grade !== undefined) selected = selected.filter(i => i.grades.includes(grade));
if (source !== undefined) selected = selected.filter(i => i.source === source);
if (limit !== undefined) selected = selected.slice(0, limit);

if (selected.length === 0) {
  console.log('no recording in the audio plan matches those flags; nothing to do.');
  process.exit(0);
}

const clipUrl = (item: AudioItem) => `${AUDIO_BASE}/${item.slug}.mp3`;

// ─── Dry run: HEAD every clip, no key, no transcription ───────────────────

if (dryRun) {
  console.log(`dry run: ${selected.length} of ${plan.length} recordings selected — checking ${AUDIO_BASE}/ (HEAD only)`);
  type Head = { state: 'present' | 'missing' | 'error'; bytes: number };
  const heads = await pool(
    selected,
    async (item): Promise<Head> => {
      try {
        const res = await requestWithBackoff(clipUrl(item), 'HEAD');
        if (res.ok) return { state: 'present', bytes: Number(res.headers.get('content-length') ?? 0) || 0 };
        return { state: res.status === 404 ? 'missing' : 'error', bytes: 0 };
      } catch {
        return { state: 'error', bytes: 0 };
      }
    },
    FETCH_CONCURRENCY,
    (done, total) => {
      if (done % 500 === 0) console.error(`  ${done}/${total}`);
    },
  );
  const present = heads.filter(h => h.state === 'present');
  const missing = heads.filter(h => h.state === 'missing').length;
  const errors = heads.filter(h => h.state === 'error').length;
  const bytes = present.reduce((sum, h) => sum + h.bytes, 0);
  const seconds = secondsFromBytes(bytes);
  const cost = estimateCostUsd(seconds, model);
  console.log(`  would be sent: ${present.length} present, ${missing} missing from the bucket${errors ? `, ${errors} could not be checked (re-run)` : ''}`);
  console.log(`  total ${(bytes / 1048576).toFixed(2)} MB, at most ${(seconds / 60).toFixed(1)} min of audio (assuming 40 kbps, the lowest bitrate in the bucket, so no more than this)`);
  console.log(
    cost === null
      ? `  cost with ${model}: price unknown for this model`
      : `  estimated cost with ${model}: about $${cost.toFixed(cost < 1 ? 3 : 2)} (audio only; the gpt-4o models also bill the prompt and the transcript as text tokens, so expect up to about double on very short clips — check OpenAI's pricing page before a big run)`,
  );
  console.log('dry run: nothing was transcribed, no key was used, nothing was written.');
  process.exit(0);
}

// ─── The key ──────────────────────────────────────────────────────────────

const apiKey = (process.env.OPENAI_API_KEY ?? '').trim();
// The committed .env.example value is `sk-your-…here`; checked-out .env files keep it.
if (!apiKey || apiKey.startsWith('sk-your')) {
  fail('OPENAI_API_KEY is not set (or is still the placeholder) in the environment or the repo-root .env. Use --dry-run to count without a key.');
}
// A space, line break, control or non-ASCII character in the key makes `fetch` throw an error
// that carries the whole header value. Refuse it here, without saying anything about the key.
if (!isPlausibleApiKey(apiKey)) {
  fail('OPENAI_API_KEY has a character that cannot be in a key (a space, line break, control or non-ASCII character). Check the environment or the repo-root .env.');
}

/** Text from the API or the network for printing: the key and anything shaped like one removed. */
function scrub(text: string): string {
  return text.split(apiKey).join('[key]').replace(/sk-[A-Za-z0-9_*.-]{3,}/g, 'sk-…');
}

// ─── The real dependencies ────────────────────────────────────────────────

async function fetchClip(item: AudioItem) {
  const res = await requestWithBackoff(clipUrl(item), 'GET', { timeoutMs: CLIP_TIMEOUT_MS });
  if (res.status === 404) {
    await res.body?.cancel();
    return 'missing' as const;
  }
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`clip download: HTTP ${res.status}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  // The cache key is the clip as it is now: size plus its ETag (its length when there is none).
  const etag = res.headers.get('etag') ?? res.headers.get('content-length') ?? String(bytes.length);
  return { bytes, size: bytes.length, etag };
}

let requestsSent = 0;

async function transcribe(bytes: Uint8Array, item: AudioItem): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' }), 'clip.mp3');
  form.append('model', model);
  form.append('language', 'en');
  form.append('response_format', 'json');
  form.append('temperature', '0');
  form.append('prompt', GENERIC_PROMPT);
  requestsSent += 1;
  let res: Response;
  try {
    res = await requestWithBackoff(`${OPENAI_BASE}/audio/transcriptions`, 'POST', {
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      maxAttempts: TRANSCRIBE_ATTEMPTS,
      timeoutMs: TRANSCRIBE_TIMEOUT_MS,
    });
  } catch (e) {
    // A transport error can quote what it was given (a header value); nothing of it gets out
    // unscrubbed. It is a TransportError so ten in a row mean the host is unreachable.
    throw new TransportError(scrub(String((e as { message?: unknown } | null)?.message ?? e)));
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let reason = '';
    let code: string | undefined;
    try {
      const err = (JSON.parse(body) as { error?: { message?: unknown; code?: unknown } }).error;
      if (typeof err?.message === 'string') reason = err.message;
      if (typeof err?.code === 'string') code = err.code;
    } catch {
      // not JSON
    }
    // A refused key, a missing model or an exhausted quota fails every clip the same way:
    // stop once, with OpenAI's reason, instead of thousands of error rows.
    if (shouldStopRun(res.status, code)) {
      throw new StopRun(scrub(`transcription API ${res.status}${code ? ` (${code})` : ''}: ${reason || 'refused'}`));
    }
    throw new Error(scrub(`transcription API ${res.status}: ${reason || body.slice(0, 200)}`));
  }
  const json = (await res.json().catch(() => null)) as { text?: unknown } | null;
  if (!json || typeof json.text !== 'string') throw new Error('transcription API: reply had no text');
  return json.text;
}

// ─── The cache ────────────────────────────────────────────────────────────

// A folder that does not exist would fail every cache save and then the report write, after
// the money is spent: make them now, or stop now.
for (const file of [cachePath, outPath]) {
  try {
    mkdirSync(path.dirname(file), { recursive: true });
  } catch (err) {
    fail(`cannot create the folder for ${file} (${(err as Error).message}). Nothing was sent.`);
  }
}

let stored: SpeechCache = {};
if (existsSync(cachePath)) {
  try {
    const raw = readFileSync(cachePath, 'utf8');
    stored = parseSpeechCache(raw);
    // Something is in the file but none of it is a cache (an old format, a damaged file, the
    // wrong file): saving would replace it, so keep a copy once.
    if (Object.keys(stored).length === 0 && raw.trim() !== '' && raw.trim() !== '{}') {
      const bak = `${cachePath}.bak`;
      try {
        copyFileSync(cachePath, bak, constants.COPYFILE_EXCL);
        console.error(`${cachePath} holds no transcripts that could be read; a copy is kept as ${bak} before it is replaced.`);
      } catch {
        // A backup is already there. Replacing is safe only when it is a copy of this very file;
        // otherwise this file would be lost for good, so stop before anything is written.
        if (!existsSync(bak) || readFileSync(bak, 'utf8') !== raw) {
          fail(`${cachePath} holds no transcripts that could be read, and ${bak} already holds something else. Nothing was written. Move one of them away, or pass another --cache.`);
        }
        console.error(`${cachePath} holds no transcripts that could be read; it will be replaced (${bak} is already a copy of it).`);
      }
    }
  } catch (err) {
    console.error(`could not read ${cachePath} (${(err as Error).message}); starting without it.`);
  }
}
/** What the run reads and updates in place: empty with --refresh, so nothing is reused. */
const working: SpeechCache = refresh ? {} : stored;

/**
 * Atomic (written beside, then renamed over), so a kill mid-write cannot leave half a cache.
 * With --refresh the new transcripts replace the old ones and entries for other clips stay;
 * `results` (the finished run) also lets a clip that came back silent drop its stale one.
 */
function saveCache(results?: CheckResult[]): void {
  try {
    const tmp = `${cachePath}.tmp`;
    const out = refresh ? (results ? mergeRefreshed(stored, working, results) : { ...stored, ...working }) : stored;
    writeFileSync(tmp, serializeSpeechCache(out));
    renameSync(tmp, cachePath);
  } catch (err) {
    console.error(`could not write ${cachePath}: ${(err as Error).message}`);
  }
}

process.on('SIGINT', () => {
  saveCache();
  console.error(`\ninterrupted — transcripts so far are kept in ${cachePath}`);
  process.exit(130);
});

// ─── Run ──────────────────────────────────────────────────────────────────

/** Only the host of a URL, for the banner: where the clips go, never a path or a credential. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '(not a valid URL)';
  }
}

console.log(
  `${selected.length} of ${plan.length} recordings selected — model ${model} via ${hostOf(OPENAI_BASE)}, clips from ${AUDIO_BASE}/` +
    (refresh ? ', cache ignored (--refresh)' : `, ${Object.keys(stored).length} transcripts cached`),
);

const run = await checkClips(selected, {
  fetchClip,
  transcribe,
  cache: working,
  concurrency: CHECK_CONCURRENCY,
  onProgress: (done, total) => {
    if (done % 100 === 0) {
      console.error(`  ${done}/${total}`);
      saveCache();
    }
  },
});
const { results, stopped } = run;
saveCache(results);
// `results` may be shorter than `selected` after a stop; `stopped` decides, never the length.
const partial = stopped;
/** Why it stopped, without a trailing full stop (the API's own message ends with one). */
const stopText = (run.stopReason || 'the transcription API refused the request').replace(/[.\s]+$/, '');
const date = new Date().toISOString().slice(0, 10);

const markdown = renderReportMarkdown(results, { model, date, stopped: partial, selected: selected.length }).split('\n');
if (partial) {
  // After the title and its blank line.
  markdown.splice(
    2,
    0,
    `> **PARTIAL REPORT.** The run was stopped: ${stopText}. ` +
      `${results.length} of ${selected.length} selected recordings were checked; the rest were not attempted.`,
    '',
  );
}
writeFileSync(outPath, markdown.join('\n'));

const only = onlyLine(results);
const report = {
  model,
  date,
  partial,
  stopReason: partial ? stopText : null,
  selected: selected.length,
  checked: results.length,
  transcriptionRequests: requestsSent,
  results: results.map(r => ({
    slug: r.item.slug,
    text: r.item.text,
    source: r.item.source,
    register: r.item.register,
    grades: r.item.grades,
    verdict: r.verdict,
    heard: r.heard,
    ...(r.detail ? { detail: r.detail } : {}),
  })),
  only,
};
writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');

// ─── Print ────────────────────────────────────────────────────────────────

console.log('');
for (const line of summarizeResults(results)) console.log(line);
if (partial) console.log(`\nPARTIAL: stopped after ${results.length} of ${selected.length} (${stopText}).`);

const problems = results.filter((r: CheckResult) => r.verdict === 'mismatch' || r.verdict === 'silent');
if (problems.length) {
  console.log(`\nto listen to (${problems.length}) — expected / heard / slug:`);
  for (const r of problems.slice(0, SHOWN_PROBLEMS)) {
    console.log(`  ${r.verdict === 'silent' ? '[silent]' : '        '} ${r.item.text}  /  ${r.heard || '(nothing)'}  /  ${r.item.slug}`);
  }
  if (problems.length > SHOWN_PROBLEMS) console.log(`  … and ${problems.length - SHOWN_PROBLEMS} more in the report`);
  console.log(`\nre-voice them, after listening:\n  ${only}`);
}
const errored = results.filter(r => r.verdict === 'error');
const closeRows = results.filter(r => r.verdict === 'close');
const missingRows = results.filter(r => r.verdict === 'missing');
if (closeRows.length) console.log(`\n${closeRows.length} close — see «Close: worth a glance» in ${outPath}`);
if (missingRows.length) {
  console.log(`\n${missingRows.length} missing from the bucket — voice them first (english-audio) or ignore; the report lists the first 50, the JSON all.`);
}
if (problems.length === 0 && errored.length === 0 && !partial) console.log('\nnothing needs a listen.');
if (errored.length) {
  console.log(`\n${errored.length} could not be checked (re-run to retry): ${errored.slice(0, 5).map(r => `${r.item.slug}: ${r.detail ?? ''}`).join('; ')}`);
}

console.log(`\nclips sent to the transcriber: ${requestsSent} (retries not counted); report: ${outPath} and ${jsonPath}; cache: ${cachePath}`);

if (partial) {
  console.error(
    `\nSTOPPED: ${stopText}. Nothing more was sent. ` +
      `The report above is PARTIAL (${results.length} of ${selected.length} checked); the cache keeps what was paid for.`,
  );
  process.exitCode = 2;
} else if (failOnMismatch && problems.length + errored.length > 0) {
  process.exitCode = 1;
}
