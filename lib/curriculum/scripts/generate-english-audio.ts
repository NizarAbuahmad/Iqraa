/**
 * Voices every English-hub word once and puts the MP3 in the public bucket,
 * where the app plays it from (`artifacts/mobile/services/englishAudio.ts`).
 *
 * Same shape as `upload-figures-r2.ts`: list the bucket, do only what is
 * missing, so a run that dies half way costs nothing to repeat. `--force`
 * re-voices everything (after changing the voice or instructions — the key is
 * the word, not the recording). `--only chair,cheese` re-voices just those
 * words, for a recording that came out wrong (the model said "share" for
 * "chair" — or "EE-ray-ser" for "eraser"; give the word a `PRONUNCIATION` hint
 * first). `--dry-run` reports and touches nothing.
 *
 *   pnpm --filter @workspace/curriculum run english-audio [-- --dry-run | --force | --only a,b | --out dir]
 *
 * `--out dir` writes the files there and uploads nothing: voice, listen, measure, then upload exactly those
 * files with `--only a,b --from dir` (a plain re-run would voice every word again, and the new takes would
 * not be the ones you checked).
 *
 * Needs OPENAI_API_KEY and R2 credentials with write access to `iqraa-public`.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { loadEnvFile } from '../../../scripts/load-env.mjs';
import { ENGLISH_HUB_LESSONS, allHubWords, audioSlug } from '../src/englishHub.ts';
import { allGrammarSpoken } from '../src/englishGrammar.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(HERE, '..', '..', '..', '.env'));

const BUCKET = process.env.R2_PUBLIC_BUCKET || 'iqraa-public';
/** Matches `ENGLISH_AUDIO_BASE_URL` in the app. */
const PREFIX = 'english-audio';
const MODEL = 'gpt-4o-mini-tts';
const VOICE = 'coral';
// The books are British ("mum", "colourful", "trainers"), so the voice is too.
//
// Two registers. The 458 Grade 1–4 words were first voiced on 2026-09-25 with a
// "reading to a young child" prompt; the Grade 9–10 words with the teenage one.
// A normal run skips words that already have a file, so each keeps the voice it
// was made in. A word that appears in any Grade 1–4 lesson is voiced for a young
// child (so `--only eraser` stays in the voice of the rest of its lesson);
// `--force` re-voices everything — decide that on purpose.
//
// Both end on a teacher's correction (2026-10-15): "apples" came out with its
// first sound hit hard and held apart from the rest ("A… pples"), which teaches
// a long, stressed vowel where the word has a short /æ/. "Clearly" on its own
// invites that over-articulation. A word already voiced keeps its recording
// until re-voiced with `--only`.
const SMOOTH =
  'Say it as one smooth word, the way it sounds in ordinary speech: do not stretch, ' +
  'hit or separate the first sound or any single letter, and keep short vowels short ' +
  '(the a in "apples" is a quick, short sound).';
const YOUNG_INSTRUCTIONS =
  'You are reading a vocabulary card to a six-year-old child learning English. ' +
  'Say only the given word or phrase, once, clearly and a little slowly, ' +
  'in a warm, friendly tone, with a British accent. ' + SMOOTH;
const TEEN_INSTRUCTIONS =
  'You are reading a vocabulary card to a teenage student learning English. ' +
  'Say only the given word or phrase, once, clearly and at a natural, unhurried pace, ' +
  'in a warm but not childish tone, with a British accent. ' + SMOOTH;

/**
 * Words the model has said wrongly, with how to say them. Added to the
 * instructions for that word only; re-voice with `--only <word>` after adding
 * one. Checked by ear or by a phoneme recogniser, never assumed.
 */
const PRONUNCIATION: Record<string, string> = {
  // A Grade 1 teacher flagged it (2026-10-15); the recording says /iːˈreɪsɚ/,
  // "EE-ray-ser".
  eraser:
    'Pronounce it the British way, ih-RAY-zuh (/ɪˈreɪzə/): a short "i" at the start, not "ee"; ' +
    'stress on "RAY"; a "z" sound in the middle, not "s"; no "r" sound at the end.',
  // A Grade 2 teacher (2026-10-24): "not accurate". The recording was GA-rzh: a short
  // "a" and then straight into the "zh" with the second vowel all but missing
  // (measured: its energy is a tenth of the first vowel's).
  garage:
    'Pronounce it the British way, GA-rahzh (/ˈɡærɑːʒ/): stress on the first syllable, a short "a" as in "cat"; ' +
    'then a clear, full, long "ah" as in "father" in the second syllable, ending in the "zh" of "measure". ' +
    'Do not swallow the second vowel, and do not stress the end ("ga-RAHZH").',
  // A Grade 4 teacher (2026-10-24): "loudly" is too slow. Measured across all 750 single
  // words, it and "firefighter" are the two worst: 1.7 s of speech for two syllables, 2.5
  // times "quietly" — "a little slowly" is read too literally on some words.
  loudly: 'Say it at a quick, natural speaking pace, LOUD-lee: two short syllables as one smooth word, nothing stretched.',
  firefighter: 'Say it at a quick, natural speaking pace, FIRE-fy-ter: one smooth word, no pause between the parts.',
};

/** Every string the grammar activities speak (Grades 1 and 2: sentences, Yes or No questions and the No exchange), voiced like the grade's words; all are Grade 1–2, so all are the young voice. */
const GRAMMAR_SENTENCES = allGrammarSpoken();

const YOUNG_WORDS = new Set([
  ...ENGLISH_HUB_LESSONS.filter(l => l.grade <= 4).flatMap(l => l.words.map(w => audioSlug(w.en))),
  ...GRAMMAR_SENTENCES.map(audioSlug),
]);

function instructionsFor(word: string): string {
  const base = YOUNG_WORDS.has(audioSlug(word)) ? YOUNG_INSTRUCTIONS : TEEN_INSTRUCTIONS;
  const hint = PRONUNCIATION[word.toLowerCase().trim()];
  return hint ? `${base} ${hint}` : base;
}

const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');
/** `--out <dir>`: write the MP3s there and upload nothing — to listen to or measure a take first. */
const outDir = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
if (outDir) fs.mkdirSync(outDir, { recursive: true });
/** `--from <dir>`: upload the checked MP3s already in `dir` (from `--out`) instead of voicing the words again. */
const fromDir = process.argv.includes('--from') ? process.argv[process.argv.indexOf('--from') + 1] : null;
const onlyArg = process.argv[process.argv.indexOf('--only') + 1];
const only = process.argv.includes('--only') ? new Set(onlyArg?.split(',').map(audioSlug)) : null;
/** Set on the first auth/access refusal; every worker stops at its next word. */
let stopped = false;

const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, OPENAI_API_KEY } = process.env;
if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('R2 is not configured — set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env.');
  process.exit(2);
}
// The committed .env.example value is `sk-your-…here`; checked-out .env files keep it.
if ((!OPENAI_API_KEY || OPENAI_API_KEY.startsWith('sk-your')) && !dryRun) {
  console.error('OPENAI_API_KEY is not set (or is still the placeholder) in the repo-root .env.');
  process.exit(2);
}

const client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function existingSlugs(): Promise<Set<string>> {
  const out = new Set<string>();
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `${PREFIX}/`, ContinuationToken: token }),
    );
    for (const o of page.Contents ?? []) {
      if (o.Key?.endsWith('.mp3')) out.add(o.Key.slice(PREFIX.length + 1, -4));
    }
    token = page.NextContinuationToken;
  } while (token);
  return out;
}

async function speak(text: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, voice: VOICE, input: text, instructions: instructionsFor(text), response_format: 'mp3' }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    // A bad key, a missing scope or a project that can't use the model fails
    // every word the same way — stop everything, not 458 errors. Print OpenAI's
    // reason: "does not have access to model" is fixed in the project's Limits,
    // not by a new key.
    if (res.status === 401 || res.status === 403) {
      const reason = ((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message;
      // A flag, not process.exit(): exiting under in-flight fetches trips a
      // libuv assertion on Windows and buries this message under a crash.
      if (!stopped) console.error(`TTS ${res.status}: ${reason ?? 'refused'}. Nothing more will be voiced.`);
      stopped = true;
      throw new Error('stopped');
    }
    // 429 and 5xx are worth waiting out; anything else (bad model, bad input) is not.
    if (attempt >= 4 || (res.status !== 429 && res.status < 500)) {
      throw new Error(`TTS ${res.status} for "${text}": ${(await res.text()).slice(0, 200)}`);
    }
    await new Promise(r => setTimeout(r, 2000 * attempt));
  }
}

// One recording per slug; case-only twins ("Jordan"/"jordan") share it.
const bySlug = new Map<string, string>();
// Grammar strings are keyed the same way («I've got a pen.» → i-ve-got-a-pen), so
// `playWord(text)` finds them; `englishGrammar.test.ts` pins that no two collide.
for (const w of [...allHubWords(), ...GRAMMAR_SENTENCES]) if (!bySlug.has(audioSlug(w))) bySlug.set(audioSlug(w), w);

let already: Set<string>;
try {
  already = force ? new Set() : await existingSlugs();
} catch (err) {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  console.error(`cannot list ${BUCKET}: ${e.name}`);
  if (e.$metadata?.httpStatusCode === 403) {
    console.error('these credentials cannot reach that bucket — mint an R2 token with');
    console.error('Object Read & Write on iqraa-public (an iqraa-media token is scoped out)');
  }
  process.exit(2);
}

const unknown = [...(only ?? [])].filter(s => !bySlug.has(s));
if (unknown.length) {
  console.error(`not hub words: ${unknown.join(', ')}`);
  process.exit(2);
}
const todo = [...bySlug].filter(([slug]) => (only ? only.has(slug) : !already.has(slug)));
console.log(`${bySlug.size} words, ${bySlug.size - todo.length} already voiced, ${todo.length} to voice`);
if (dryRun) {
  for (const [slug, word] of todo.slice(0, 20)) console.log(`  ${slug}.mp3  ←  ${word}`);
  if (todo.length > 20) console.log(`  … and ${todo.length - 20} more`);
  process.exit(0);
}

let done = 0;
let bytes = 0;
const failed: string[] = [];

async function worker(slice: [string, string][]): Promise<void> {
  for (const [slug, word] of slice) {
    if (stopped) return;
    try {
      const body = fromDir ? fs.readFileSync(path.join(fromDir, `${slug}.mp3`)) : await speak(word);
      if (outDir) {
        fs.writeFileSync(path.join(outDir, `${slug}.mp3`), body);
        bytes += body.length;
        done += 1;
        continue;
      }
      await client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: `${PREFIX}/${slug}.mp3`,
          Body: body,
          ContentType: 'audio/mpeg',
          // Short, not immutable: `--force` re-voices under the same key.
          CacheControl: 'public, max-age=86400',
        }),
      );
      bytes += body.length;
      if (++done % 50 === 0) console.log(`  ${done}/${todo.length}`);
    } catch (err) {
      if (stopped) return;
      failed.push(word);
      console.error((err as Error).message);
    }
  }
}

const CONCURRENCY = 4;
const slices = Array.from({ length: CONCURRENCY }, (_, i) => todo.filter((_, n) => n % CONCURRENCY === i));
await Promise.all(slices.map(worker));

if (stopped) process.exitCode = 2;
console.log(`voiced ${done} words (${(bytes / 1048576).toFixed(1)} MB) → ${outDir ?? `${BUCKET}/${PREFIX}/`}`);
if (failed.length) {
  console.error(`${failed.length} failed — re-run to retry: ${failed.slice(0, 10).join(', ')}`);
  process.exitCode = 1;
}
