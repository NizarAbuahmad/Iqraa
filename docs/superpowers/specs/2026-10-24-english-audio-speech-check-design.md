# English audio: a speech-to-text check of every recording — design

**Status:** approved in conversation (design), awaiting spec review. **Scope:** a new read-only command that listens to the
recordings in the public bucket with a speech-to-text model and reports where what is said differs from what the app expects.
Builds on `lib/curriculum/src/englishAudioPlan.ts` (`audioPlan()`, the list of what the app plays), the keyless audit
(`scripts/audit-english-audio.ts`, its fetch-with-backoff) and the measurement in `englishAudioProcess.ts`. Not in this spec:
re-voicing anything, scoring pronunciation at the sound level, any app change.

## Why

A recording can be the wrong word: the first voicing of «chair» came out as «share», and «eraser» as «EE-ray-ser». Today only a
person listening finds that, and there are 1,248 word recordings and, soon, 3,383 sentences. The audit measures silence and
level but cannot tell what was said.

## Decisions taken (and why)

1. **A separate command, `english-audio-check`** (not a step inside the generator). The generator already rejects blank, short
   and long takes; a transcription pass costs money and time and must be runnable on what already exists.
2. **It reports, it never acts.** It writes nothing to the bucket and never re-voices. It prints a ready-to-paste
   `english-audio -- --only a,b,c` line for the mismatches.
3. **The model is not told the expected text.** Passing it would bias the transcript towards agreeing and make the check
   prove nothing. Only a generic prompt («an English vocabulary word or sentence, British accent») and `language: en`.
4. **Model `gpt-4o-transcribe` by default**, `--model` to change. Cost is small (clips average about 2 s; a full pass should be
   under a dollar — the price is checked against OpenAI's current page before the first large run, not assumed).
5. **A mismatch means «a person should listen», not «wrong».** Isolated single words are hard to transcribe (homophones, rare
   words such as «doughnut», «sitcom»). The report says so.
6. **Honest limit.** It catches a wrong word, a dropped or added word, garbled or blank speech. It does **not** catch stress or
   accent errors («EE-ray-ser» would still be heard as «eraser»): speech recognisers forgive accents. Those still need an ear.

## How it works

`pnpm --filter @workspace/curriculum run english-audio-check [-- flags]`

- **Input:** `audioPlan()` filtered by `--only a,b` (slugs or words), `--grade N`, `--source word|grammar`, `--limit N`; each
  clip is downloaded from the public base URL with the audit's backoff (`Retry-After` honoured and capped, concurrency 6).
  A clip that is missing from the bucket is reported as `missing`, not checked.
- **Transcription:** `POST /v1/audio/transcriptions` (multipart, the MP3 as is), concurrency 3, retry on 429/5xx with backoff,
  stop at the first 401/403 with OpenAI's reason (as the generator does). The API call sits behind an injectable
  `transcribe(bytes, opts)` function so tests never touch the network.
- **Comparison (pure, tested):** normalise both texts — lowercase; Unicode apostrophes to `'`; strip punctuation; hyphens and
  runs of spaces to one space; digits to number words and back (`5` ≡ `five`); British/American spelling pairs
  (`colour/color`, `-ise/-ize`, `grey/gray`, `programme/program`…) from a short table; a short homophone table
  (`right/write`, `their/there`…). Verdict:
  - `match` — equal after normalising;
  - `close` — a one-letter difference for a single word, or a word-level edit distance of at most one for a sentence
    (or ≤ 10% of the words, whichever is larger);
  - `mismatch` — anything else;
  - `silent` — the transcript is empty.
- **Cache:** transcripts are kept in a local JSON (`--cache <file>`, default `./english-audio-check.cache.json`, git-ignored),
  keyed by slug and the clip's size and `ETag`/`Content-Length`, so a re-run only pays for clips that changed. `--refresh`
  ignores it.
- **Output:** a summary table (grade × source × verdict), then the mismatches and silents (expected / heard / slug), written
  also to `--out <file>` as Markdown and JSON (default `./english-audio-check.report.{md,json}`, git-ignored), and the
  `--only` line. Exit code 0 always, unless `--fail-on-mismatch` (1) or a refusal from the API (2).
- **`--dry-run`:** counts the clips that would be sent and prints an estimated cost from the total audio seconds
  (read from the clip sizes), calls nothing, needs no key.
- **Key:** `OPENAI_API_KEY` read from the repo-root `.env` through `loadEnvFile` (as the generator does) and never printed.
  The placeholder `sk-your…` is refused.

## Where it lives

- `lib/curriculum/src/englishAudioCheck.ts` — pure: `normalizeSpoken`, `compareSpoken`, `verdictFor`, the cost estimate,
  the report renderer (Markdown and the `--only` line), the cache key. No I/O.
- `lib/curriculum/scripts/check-english-audio.ts` — the command: flags, fetching, transcription call, cache file, output.
- `lib/curriculum/package.json` — script `english-audio-check`; `.gitignore` — the two default output files.
- Tests in `lib/curriculum/src/__tests__/englishAudioCheck.test.ts` (normalisation cases, each verdict incl. boundary cases,
  the report and `--only` line, the cost estimate, the cache key) and a fake-`transcribe` test of the loop in the script’s
  testable core if it is split out.
- Docs: entry at the top of `docs/status-log.md`, a line in `STATUS.md`.

No app, server, schema or migration change; nothing is uploaded; no new dependency (Node's `fetch` and `FormData`).

## Known limits

- It cannot judge accent, stress or naturalness; it hears the word, not how it is said.
- A homophone or a rare word can be flagged although it is right, and a wrong clip can pass if the wrong word is a
  homophone of the right one.
- The first full run costs money and time (about 4,600 requests); the cache and `--dry-run` exist for that.
- The `r2.dev` link rate-limits; the check inherits the audit's backoff.

## Not done here

- Automatic re-voicing from the report.
- A phoneme-level pronunciation score.
- Running it in CI.
