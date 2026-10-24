# English audio: a speech-to-text check of every recording — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only command, `english-audio-check`, that transcribes the recordings in the public bucket with a speech-to-text model and reports where what is said differs from what the app expects.

**Architecture:** All decisions (normalising, comparing, verdicts, the report, the cost estimate, the cache key and the checking loop with its dependencies injected) are pure code in `lib/curriculum/src/englishAudioCheck.ts`, fully unit-tested with a fake transcriber. `lib/curriculum/scripts/check-english-audio.ts` only wires flags, the real fetch and the real OpenAI call. The fetch-with-backoff code that the keyless audit already has moves into a shared `scripts/audioHttp.ts` that both scripts use.

**Tech Stack:** TypeScript, `node --test`, Node's built-in `fetch`/`FormData`/`Blob`; no new dependency.

**Spec:** `docs/superpowers/specs/2026-10-24-english-audio-speech-check-design.md` (approved).

## Global Constraints

- **Read-only.** The command writes nothing to the bucket and never re-voices; it writes only its local report and cache files (git-ignored).
- **The model is never told the expected text.** The transcription request carries `language: en`, `temperature: 0` and a generic prompt only («An English vocabulary word or sentence, spoken with a British accent.»).
- **Key handling:** `OPENAI_API_KEY` is read from the process environment after `loadEnvFile(<repo-root>/.env)` (as `generate-english-audio.ts` does) and is never printed, logged or written to the report/cache. The placeholder `sk-your…` and an empty key are refused (exit 2) unless `--dry-run`. `OPENAI_BASE_URL` (default `https://api.openai.com/v1`) overrides the endpoint — that is how the smoke test points the script at a local fake server.
- **Tests never touch the network, ffmpeg or a key.**
- A mismatch means «a person should listen», never «wrong»: the report text says so.
- A 401/403 from the transcription API stops the run once, prints OpenAI's reason (not the key), exit code 2 — as the generator does.
- Extensionless relative imports do not work under `node --test`: use explicit `.ts`.
- No `sed -i`/`perl -pi` on source; Edit/Write only; `git diff --stat` must show no `Bin N -> M bytes`; stage named paths only (never `git add -A`/`.`); the repo is public: no secret anywhere.
- Commits end with the trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez`. Do not push from a subagent; the controller pushes.
- With the sandbox's `R2_*` variables set, `r2.test.ts` fails by design: run the curriculum suite as `cd lib/curriculum && env -u R2_ACCESS_KEY_ID -u R2_BUCKET -u R2_ENDPOINT -u R2_SECRET_ACCESS_KEY -u OPENAI_API_KEY pnpm test`. Never print or read `.env` or environment values.
- Work in the worktree/branch the controller names; the repo is a pnpm monorepo (`pnpm run typecheck` at the root).

## Ruling made while planning (refines the spec)

The spec says `close` = «a one-letter difference for a single word». In short words a one-letter difference IS the confusion the check exists to find (`bit`/`bet`, `ship`/`sheep` is 2 but `cap`/`cop` is 1). So: **single-word `close` applies only when the expected word has 6 or more letters**; for shorter words any difference is a `mismatch`. Sentences keep «at most one word edit, or 10% of the words, whichever is larger». The spec is updated to say so in Task 2.

**Superseded after Task 1's review (the code and the spec have the final rule):** a single word is `close` only when the expected word has 6+ letters AND the heard word is the expected one plus or minus an inflection ending (`s es d ed ing er ers`); a text of several words allows floor(10% of its words) word edits (none under 10 words). The sentence rule above («at most one word edit») let «I am ten» / «I am two» pass as `close`.

## File Structure

- Create `lib/curriculum/src/englishAudioCheck.ts`: pure logic (below).
- Create `lib/curriculum/src/__tests__/englishAudioCheck.test.ts`.
- Create `lib/curriculum/scripts/audioHttp.ts`: `retryAfterMs`, `backoffMs`, `requestWithBackoff`, `pool` (moved from `audit-english-audio.ts`).
- Modify `lib/curriculum/scripts/audit-english-audio.ts`: import them from `./audioHttp.ts` (behaviour unchanged).
- Create `lib/curriculum/scripts/check-english-audio.ts`: the command.
- Modify `lib/curriculum/package.json` (script `english-audio-check`), `.gitignore` (the default output/cache files).
- Docs: top of `docs/status-log.md`, a `STATUS.md` «Recent changes» line, the spec (the `close` refinement, status «implemented»).

## Interfaces (all in `englishAudioCheck.ts`; Task 1 produces, Task 2 consumes)

```ts
import type { AudioItem } from './englishAudioPlan.ts';

export type SpokenVerdict = 'match' | 'close' | 'mismatch' | 'silent';

/** Lowercase, apostrophes straightened, punctuation removed, hyphens/space runs → one space, digits → number words (0–20, 30, 40, 50 …100 as words; other digit runs left as is), British→American spelling and homophones mapped to one canonical form. */
export function normalizeSpoken(text: string): string;

export interface Comparison { verdict: SpokenVerdict; distance: number; expected: string; heard: string } // normalised texts
export function compareSpoken(expected: string, heard: string): Comparison;

export interface CheckResult { item: AudioItem; heard: string; verdict: SpokenVerdict | 'missing' | 'error'; detail?: string }

export const PRICE_PER_MINUTE_USD: Record<string, number>;           // 'gpt-4o-transcribe' 0.006, 'gpt-4o-mini-transcribe' 0.003, 'whisper-1' 0.006 — list prices as of 2026-10, check before a big run
export function estimateCostUsd(totalSeconds: number, model: string): number | null; // null for an unknown model
export const ASSUMED_KBPS = 128;                                    // clips made before the 40 kbps processing; an upper bound on seconds
export function secondsFromBytes(bytes: number, kbps?: number): number;

export interface CacheEntry { size: number; etag: string; heard: string }
export type SpeechCache = Record<string, CacheEntry>;               // key = slug
export function cacheHit(cache: SpeechCache, slug: string, size: number, etag: string): string | null; // the cached transcript or null
export function parseSpeechCache(json: string): SpeechCache;        // tolerant: bad/old JSON → {}
export function serializeSpeechCache(cache: SpeechCache): string;

export interface CheckDeps {
  fetchClip(item: AudioItem): Promise<{ bytes: Uint8Array; size: number; etag: string } | 'missing'>;   // throws on transport failure
  transcribe(bytes: Uint8Array, item: AudioItem): Promise<string>;                                       // throws {stop:true} class for 401/403
  cache: SpeechCache;
  concurrency: number;
  onProgress?(done: number, total: number): void;
}
export class StopRun extends Error {}                                // thrown by transcribe on 401/403; stops all workers
export function checkClips(items: AudioItem[], deps: CheckDeps): Promise<{ results: CheckResult[]; stopped: boolean }>;

export function summarizeResults(results: CheckResult[]): string[];  // table lines by grade × source × verdict (a recording used by two grades counts in both rows; a total row counts it once)
export function onlyLine(results: CheckResult[]): string;            // 'pnpm --filter @workspace/curriculum run english-audio -- --only a,b,c' for mismatch+silent slugs ('' when none)
export function renderReportMarkdown(results: CheckResult[], meta: { model: string; date: string }): string;
```

---

### Task 1: The pure logic and its tests

**Files:**
- Create: `lib/curriculum/src/englishAudioCheck.ts`
- Test: `lib/curriculum/src/__tests__/englishAudioCheck.test.ts`

**Interfaces:** Produces everything in the Interfaces block above. Consumes `AudioItem` from `englishAudioPlan.ts`.

- [ ] **Step 1: Write the failing tests** (`node:test`, `assert/strict`, explicit `.ts` imports). Cover at least these cases, with real assertions:
  - `normalizeSpoken`: `"Mum's got a CAT."` → `"mum's got a cat"`; `"Mum’s"` (curly apostrophe) equals `"Mum's"`; hyphen/space runs: `"well-dressed"` = `"well dressed"`; `"I've got 5 pens."` → contains `five`; `"colour"` = `"color"`; `"organise"` = `"organize"`; `"grey"` = `"gray"`; `"programme"` = `"program"`; homophones map to one canonical form: `"write"` ≡ `"right"`, `"their"` ≡ `"there"` (pick a canonical and assert equality of the two normalised strings, not the canonical itself); empty and whitespace-only → `""`.
  - `compareSpoken` verdicts: equal → `match` (also across case/punctuation/spelling/number-word); empty `heard` (or only punctuation) → `silent`; `chair` vs `share` → `mismatch` (distance 2); **short word, one letter off: `bit` vs `bet` → `mismatch`**; **long word, one letter off: `firefighter` vs `firefighters` → `close`** (expected ≥ 6 letters); `ship` vs `sheep` → `mismatch`; sentence with one word substituted out of ten words → `close`; sentence with one word substituted out of four words → `close` only if one edit is allowed (rule: allowed edits = max(1, floor(0.1 × words)) so 4 words → 1 allowed → `close`; 2 substitutions in 4 words → `mismatch`); a dropped word in a sentence counts as one edit; a heard text that is a completely different sentence → `mismatch`; heard longer by two words → `mismatch`.
  - `estimateCostUsd`: 600 s with `gpt-4o-transcribe` = 0.06; unknown model → `null`; `secondsFromBytes(16000)` at 128 kbps = 1 s.
  - Cache: `cacheHit` returns the transcript only when size AND etag both equal; a changed size or etag → `null`; `parseSpeechCache('not json')` → `{}`; round trip via `serializeSpeechCache`/`parseSpeechCache` is identity; the serialized cache never contains the string `sk-` (guard against a key leaking in).
  - `checkClips` with fake deps (no network): (a) a clip whose transcript matches → `match`; (b) a missing clip → `missing`, `transcribe` not called; (c) a cache hit → `transcribe` not called and the cached transcript is used; (d) a `fetchClip` that throws → `error` with a `detail`, the run continues; (e) `transcribe` throwing `StopRun` on the 3rd clip with concurrency 1 → `stopped: true`, later clips not attempted, earlier results kept; (f) peak concurrency of `transcribe` never exceeds `deps.concurrency` (count in-flight with a gate promise); (g) the cache is updated with new transcripts (`size`, `etag`, `heard`); (h) results come back in the order of `items`.
  - `summarizeResults` / `onlyLine` / `renderReportMarkdown`: with a small fixture (one match, one close, two mismatches incl. one silent, one missing) assert the summary has a row per grade/source with the right counts and a total row; `onlyLine` lists exactly the mismatch+silent slugs sorted, comma-separated, and is `''` when there are none; the Markdown contains the caveat sentence «A mismatch means a person should listen» and a table with expected / heard / slug, and does not contain the API key placeholder text.
- [ ] **Step 2: Run to verify they fail.**
  `cd lib/curriculum && env -u R2_ACCESS_KEY_ID -u R2_BUCKET -u R2_ENDPOINT -u R2_SECRET_ACCESS_KEY -u OPENAI_API_KEY node --experimental-strip-types --test src/__tests__/englishAudioCheck.test.ts`
  Expected: FAIL (`Cannot find module '../englishAudioCheck.ts'`).
- [ ] **Step 3: Implement `englishAudioCheck.ts`** to the Interfaces block. Notes: spelling and homophone tables are small explicit `Record<string,string>` constants (British→American: colour, favourite, neighbour, organise/organize family via a suffix rule `-ise`→`-ize` and `-isation`→`-ization` on words ≥ 5 letters, grey, programme, centre, theatre, metre, litre, travelling, cancelled, jewellery, mum→mom is **not** mapped (a transcriber hearing «mom» for «mum» is a real accent signal — but «mum» is a real British word the app teaches: treat `mom` as a **mismatch**, say so in a comment); homophones: right/write, there/their/they're, to/too/two, no/know, see/sea, buy/by/bye, hear/here, one/won, for/four, sun/son, flour/flower, meet/meat, week/weak, which/witch, new/knew, whole/hole, wait/weight, tail/tale, plane/plain, pair/pear/pare, sale/sail, steal/steel, break/brake — each group mapped to its first member). Edit distance: Levenshtein on characters for single words, on word tokens for sentences. `checkClips` uses a shared index counter and N workers like the audit's `pool`; results are written by index. Number words: digits 0–20 and tens to 100 → words; digit runs of other lengths are left alone.
- [ ] **Step 4: Run to verify they pass** (same command; then the whole curriculum suite as in Global Constraints). Expected: PASS.
- [ ] **Step 5: Typecheck and commit.**
  ```bash
  pnpm run typecheck
  git add lib/curriculum/src/englishAudioCheck.ts lib/curriculum/src/__tests__/englishAudioCheck.test.ts
  git diff --cached --stat
  git commit -m "English audio check: the comparison, verdicts, cache and report logic (pure, tested)"
  ```

---

### Task 2: The command, the shared fetch helper, docs

**Files:**
- Create: `lib/curriculum/scripts/audioHttp.ts`, `lib/curriculum/scripts/check-english-audio.ts`
- Modify: `lib/curriculum/scripts/audit-english-audio.ts`, `lib/curriculum/package.json`, `.gitignore`, `docs/status-log.md`, `STATUS.md`, `docs/superpowers/specs/2026-10-24-english-audio-speech-check-design.md`

**Interfaces:**
- Consumes: Task 1's whole module; `audioPlan()`, `AudioItem` (`englishAudioPlan.ts`); `loadEnvFile` (`../../../scripts/load-env.mjs`).
- Produces: the command `pnpm --filter @workspace/curriculum run english-audio-check`.

- [ ] **Step 1: Move the shared fetch helper.** Create `scripts/audioHttp.ts` exporting `retryAfterMs`, `backoffMs`, `requestWithBackoff(url, method, opts?)` (the audit's `request`; `opts.maxAttempts` default 8, `opts.headers`) and `pool(items, fn, concurrency, onProgress?)` (the audit's, with the concurrency passed in). Change `audit-english-audio.ts` to import them; its output must be unchanged — verify with the audit's own `--help`-free run in Step 6.
- [ ] **Step 2: Write `check-english-audio.ts`.** Header comment: usage, flags, key handling, honest limits (copy the spec's «Known limits»), cost note. Flags: `--only a,b` (slugs or words → `audioSlug`), `--grade N`, `--source word|grammar`, `--limit N`, `--model <name>` (default `gpt-4o-transcribe`), `--cache <file>` (default `./english-audio-check.cache.json`), `--refresh` (ignore the cache), `--out <file>` (default `./english-audio-check.report.md`; also write the same name with `.json`), `--dry-run`, `--fail-on-mismatch`. Behaviour:
  1. `loadEnvFile(<repo-root>/.env)`; select items from `audioPlan()` by the flags.
  2. `--dry-run`: `HEAD` every selected clip (public URL, `AUDIO_BASE_URL` override as in the audit), print the count present/missing, the total bytes, `secondsFromBytes` total as an upper bound, and `estimateCostUsd` (print «price unknown for this model» when null) — calls no transcription API, needs no key; exit 0.
  3. Otherwise require the key (refuse empty / `sk-your…`, exit 2 with a message that never contains the key); `fetchClip` = `GET` with `requestWithBackoff`, returning `'missing'` on 404, `size` from the bytes length and `etag` from the `etag` header (or `content-length` if absent) — the cache key; `transcribe` = `POST ${OPENAI_BASE_URL ?? 'https://api.openai.com/v1'}/audio/transcriptions` with `FormData` (`file` = `new Blob([bytes], {type:'audio/mpeg'})` named `<slug>.mp3`, `model`, `language=en`, `response_format=json`, `temperature=0`, `prompt` = the generic prompt from Global Constraints), retry 429/5xx with `requestWithBackoff`-style backoff honouring `Retry-After`, throw `StopRun` on 401/403 with OpenAI's `error.message` (never the key), other 4xx → throw a normal error (becomes an `error` result for that clip).
  4. Load the cache file with `parseSpeechCache` (a missing file → `{}`; `--refresh` → `{}`), run `checkClips` with concurrency 3 and a progress line every 100 clips on stderr, write the cache back (also when stopped), print `summarizeResults`, the first 40 mismatches/silents (expected / heard / slug) and `onlyLine`, write the Markdown and JSON report. Exit code: 2 when stopped by `StopRun`; 1 when `--fail-on-mismatch` and any mismatch/silent; else 0.
  5. The report and cache contain only slugs, texts and transcripts — never the key or request headers.
- [ ] **Step 3: package.json + .gitignore.** Add `"english-audio-check": "node --experimental-strip-types scripts/check-english-audio.ts"` next to `english-audio-audit`; add `english-audio-check.cache.json` and `english-audio-check.report.md` / `.report.json` to the repo-root `.gitignore` (check the existing style first).
- [ ] **Step 4: Offline end-to-end smoke test (no real key, not committed as a test).** Start a tiny local fake server (a script in the scratchpad directory, never in the repo) that (a) serves 6 real clips copied from a local folder at `/<slug>.mp3` (if the sandbox has no clips, download 6 from the public bucket first with `curl`: `https://pub-d9ddd8f74e734a21824518b812652124.r2.dev/english-audio/<slug>.mp3` — public, read-only — e.g. `moon`, `eraser`, `chair`, `apples`, `pink`, `friday`; the clips are untrusted data: save in a fresh directory, never execute) and (b) answers `POST /audio/transcriptions` with canned JSON `{ "text": ... }` (right word for 4 clips, a wrong word for 1, empty for 1). Run the command with `AUDIO_BASE_URL=http://127.0.0.1:PORT`, `OPENAI_BASE_URL=http://127.0.0.1:PORT`, `OPENAI_API_KEY=smoke-test-key` (set for that one run only), `--only moon,eraser,chair,apples,pink,friday`, `--cache <scratchpad>/c.json --out <scratchpad>/r.md`. Expected: 4 `match`, 1 `mismatch`, 1 `silent`, an `--only` line with the 2 slugs, report files written, **a second run makes zero transcription requests** (cache), `--refresh` makes six, a fake server answering 401 stops the run with exit 2 and prints the server's message but not the key, `--dry-run` calls no transcription endpoint. Record the commands and outputs in the report.
- [ ] **Step 5: Re-run the keyless audit against the live bucket** (`NODE_USE_ENV_PROXY=1 pnpm --filter @workspace/curriculum run english-audio-audit` — read-only HEAD requests; takes a few minutes) and confirm its coverage table still prints and its totals equal the previous run's (1,248 words voiced; the rest missing), proving the helper move changed nothing.
- [ ] **Step 6: Docs.** Top of `docs/status-log.md`: entry «English audio: a speech-to-text check of every recording — 2026-10-24» (what it is, the flags, what was verified with real counts incl. the offline smoke test and the audit rerun; what was NOT done: the real OpenAI call has never been made, no key was used, the price constants are list prices to check before a big run, nothing has been transcribed; the honest limits; how to run it: `english-audio-check -- --dry-run` first, then `-- --limit 20`, then the full run). One `STATUS.md` «Recent changes» line (keep the list at 30: drop the oldest line; bump «The log has N sections» by one). Update the spec: status «implemented (this PR)» and the `close` rule («a single word of 6 or more letters differing by one letter»; shorter words must match exactly) with a sentence on why.
- [ ] **Step 7: Verify and commit.**
  ```bash
  pnpm run typecheck
  cd lib/curriculum && env -u R2_ACCESS_KEY_ID -u R2_BUCKET -u R2_ENDPOINT -u R2_SECRET_ACCESS_KEY -u OPENAI_API_KEY pnpm test && pnpm run verify
  git add lib/curriculum/scripts/audioHttp.ts lib/curriculum/scripts/check-english-audio.ts lib/curriculum/scripts/audit-english-audio.ts lib/curriculum/package.json .gitignore docs/status-log.md STATUS.md docs/superpowers/specs/2026-10-24-english-audio-speech-check-design.md docs/superpowers/plans/2026-10-24-english-audio-speech-check.md
  git diff --cached --stat
  git commit -m "English audio: english-audio-check command (speech-to-text comparison of the recordings)"
  ```
