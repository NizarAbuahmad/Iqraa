/**
 * Voices every English-corner recording once — each hub word and each string a
 * grammar unit speaks (`audioPlan()` in `src/englishAudioPlan.ts`) — and puts the
 * MP3 in the public bucket, where the app plays it from
 * (`artifacts/mobile/services/englishAudio.ts`).
 *
 * Same shape as `upload-figures-r2.ts`: list the bucket, do only what is
 * missing, so a run that dies half way costs nothing to repeat. Every model result
 * is measured first and REJECTED — not uploaded, listed with its reason — when it is
 * blank, too short or too long (`clipVerdict`); a kept one is trimmed of its leading
 * and trailing silence, levelled to one speech level and re-encoded at 40 kbps
 * (`src/englishAudioProcess.ts`, run through ffmpeg by `audioFfmpeg.ts`) before it
 * is stored. `english-audio/_manifest.json` records how each clip was made (text,
 * register, model, voice, process version, speech length, bytes).
 *
 *   pnpm --filter @workspace/curriculum run english-audio [-- <flags>]
 *
 *   (none)         voice what is missing, process it, upload it
 *   --dry-run      report what would be done; touch nothing (no key or ffmpeg needed)
 *   --force        re-voice everything (after changing the voice or instructions —
 *                  the key is the text, not the recording; decide that on purpose)
 *   --only a,b     re-voice just these, for a recording that came out wrong (the model
 *                  said "share" for "chair", or "EE-ray-ser" for "eraser"; give the
 *                  word a `PRONUNCIATION` hint first). With --reprocess: reprocess just these.
 *   --reprocess    no model, no OpenAI key: download each stored clip, measure it,
 *                  trim, level and re-encode it, and put it back under the same key.
 *                  Skips clips the manifest says were made under the current
 *                  `PROCESS_VERSION`; a clip that fails the verdict is left as it is
 *                  and listed (re-voice it with --only). Not with --force.
 *   --no-process   upload the model's MP3 as returned (no ffmpeg needed); the
 *                  manifest records processVersion 0 so a later --reprocess picks it up.
 *
 * Needs OPENAI_API_KEY (except --reprocess and --dry-run), R2 credentials with
 * write access to `iqraa-public`, and ffmpeg with libmp3lame on PATH (except
 * --no-process and --dry-run). Coverage and quality can be checked with no keys
 * at all: `pnpm --filter @workspace/curriculum run english-audio-audit`.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { loadEnvFile } from '../../../scripts/load-env.mjs';
import { audioSlug } from '../src/englishHub.ts';
import {
  AUDIO_MODEL,
  AUDIO_VOICE,
  ENGLISH_AUDIO_MANIFEST_KEY,
  ENGLISH_AUDIO_PREFIX,
  audioPlan,
  emptyManifest,
  instructionsFor,
  needsReprocess,
  parseManifest,
  type AudioItem,
  type AudioManifest,
} from '../src/englishAudioPlan.ts';
import { PROCESS_VERSION, clipVerdict } from '../src/englishAudioProcess.ts';
import { assertFfmpeg, measureClip, processClip } from './audioFfmpeg.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(HERE, '..', '..', '..', '.env'));

const BUCKET = process.env.R2_PUBLIC_BUCKET || 'iqraa-public';
/** Matches `ENGLISH_AUDIO_BASE_URL` in the app (pinned by `englishAudioPlan.test.ts`). */
const PREFIX = ENGLISH_AUDIO_PREFIX;
/** Short, not immutable: `--force`, `--only` and `--reprocess` rewrite under the same key. */
const CLIP_CACHE = 'public, max-age=86400';

const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');
const reprocess = process.argv.includes('--reprocess');
const noProcess = process.argv.includes('--no-process');
const onlyArg = process.argv[process.argv.indexOf('--only') + 1];
const only = process.argv.includes('--only') ? new Set(onlyArg?.split(',').map(audioSlug)) : null;
/** Set on the first auth/access refusal; every worker stops at its next clip. */
let stopped = false;

if (reprocess && force) {
  console.error('--reprocess and --force do not go together: --reprocess cleans the stored clips, --force re-voices them.');
  process.exit(2);
}
if (reprocess && noProcess) {
  console.error('--reprocess and --no-process do not go together.');
  process.exit(2);
}

const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, OPENAI_API_KEY } = process.env;
if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('R2 is not configured — set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env.');
  process.exit(2);
}
// The committed .env.example value is `sk-your-…here`; checked-out .env files keep it.
if ((!OPENAI_API_KEY || OPENAI_API_KEY.startsWith('sk-your')) && !dryRun && !reprocess) {
  console.error('OPENAI_API_KEY is not set (or is still the placeholder) in the repo-root .env.');
  process.exit(2);
}
if (!noProcess && !dryRun) {
  try {
    assertFfmpeg();
  } catch (err) {
    console.error(`${(err as Error).message}\nOr pass --no-process to upload the model's MP3 untrimmed and unlevelled.`);
    process.exit(2);
  }
}

const client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

/** Slugs with a stored `.mp3` (the manifest and anything else under the prefix is not counted). */
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

/** The stored manifest; an empty one when there is none yet. Any other failure stops the run, so it cannot be overwritten. */
async function readManifest(): Promise<AudioManifest> {
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: ENGLISH_AUDIO_MANIFEST_KEY }));
    return parseManifest(await res.Body!.transformToString('utf8'));
  } catch (err) {
    if ((err as { name?: string }).name === 'NoSuchKey') return emptyManifest();
    throw err;
  }
}

async function speak(item: AudioItem): Promise<Buffer> {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AUDIO_MODEL, voice: AUDIO_VOICE, input: item.text, instructions: instructionsFor(item), response_format: 'mp3' }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    // A bad key, a missing scope or a project that can't use the model fails
    // every clip the same way — stop everything, not 4,000 errors. Print OpenAI's
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
      throw new Error(`TTS ${res.status} for "${item.text}": ${(await res.text()).slice(0, 200)}`);
    }
    await new Promise(r => setTimeout(r, 2000 * attempt));
  }
}

async function put(slug: string, body: Buffer, cacheControl = CLIP_CACHE): Promise<void> {
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: `${PREFIX}/${slug}.mp3`, Body: body, ContentType: 'audio/mpeg', CacheControl: cacheControl }),
  );
}

const plan = audioPlan();
const bySlug = new Map(plan.map(i => [i.slug, i]));

let already: Set<string>;
let manifest: AudioManifest;
try {
  already = await existingSlugs();
  manifest = await readManifest();
} catch (err) {
  const e = err as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  console.error(`cannot read ${BUCKET}/${PREFIX}/: ${e.name}${e.message ? ` (${e.message})` : ''}`);
  if (e.$metadata?.httpStatusCode === 403) {
    console.error('these credentials cannot reach that bucket — mint an R2 token with');
    console.error('Object Read & Write on iqraa-public (an iqraa-media token is scoped out)');
  }
  process.exit(2);
}

const unknown = [...(only ?? [])].filter(s => !bySlug.has(s));
if (unknown.length) {
  console.error(`not in the audio plan (hub words and grammar strings): ${unknown.join(', ')}`);
  process.exit(2);
}

let voiced = 0;
let reprocessed = 0;
let bytesBefore = 0;
let bytesAfter = 0;
let manifestChanged = false;
const rejected: { slug: string; reason: string }[] = [];
const failed: string[] = [];

function record(item: AudioItem, processVersion: number, speechS: number | null, bytes: number): void {
  manifest.items[item.slug] = { text: item.text, register: item.register, model: AUDIO_MODEL, voice: AUDIO_VOICE, processVersion, speechS, bytes };
  manifestChanged = true;
}

/** One model result → verdict → processed (or raw with --no-process) → stored. */
async function voiceOne(item: AudioItem): Promise<void> {
  const raw = await speak(item);
  let stored = raw;
  if (noProcess) {
    await put(item.slug, raw);
    record(item, 0, null, raw.length);
  } else {
    const verdict = clipVerdict(await measureClip(raw));
    if (!verdict.ok) {
      rejected.push({ slug: item.slug, reason: verdict.reason });
      return;
    }
    const p = await processClip(raw);
    stored = p.out;
    await put(item.slug, stored);
    record(item, PROCESS_VERSION, Math.round(p.after.speechS * 100) / 100, stored.length);
  }
  bytesBefore += raw.length;
  bytesAfter += stored.length;
  voiced += 1;
}

/** One stored clip → verdict → processed → stored again under the same key and cache header. A reject is left untouched. */
async function reprocessOne(item: AudioItem): Promise<void> {
  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: `${PREFIX}/${item.slug}.mp3` }));
  const stored = Buffer.from(await res.Body!.transformToByteArray());
  const verdict = clipVerdict(await measureClip(stored));
  if (!verdict.ok) {
    rejected.push({ slug: item.slug, reason: verdict.reason });
    return;
  }
  const p = await processClip(stored);
  await put(item.slug, p.out, res.CacheControl || CLIP_CACHE);
  // A clip with no manifest entry was made by this script before the manifest
  // existed: the same model and voice, and the register the plan gives it (checked
  // 2026-10-24 for all 1,050 then stored: every one was a hub word, voiced young
  // exactly when it is in a Grade 1–4 lesson).
  const prev = manifest.items[item.slug];
  manifest.items[item.slug] = {
    ...(prev ?? { text: item.text, register: item.register, model: AUDIO_MODEL, voice: AUDIO_VOICE }),
    processVersion: PROCESS_VERSION,
    speechS: Math.round(p.after.speechS * 100) / 100,
    bytes: p.out.length,
  };
  manifestChanged = true;
  bytesBefore += stored.length;
  bytesAfter += p.out.length;
  reprocessed += 1;
}

const CONCURRENCY = 4;
async function runAll(todo: AudioItem[], one: (item: AudioItem) => Promise<void>): Promise<void> {
  let n = 0;
  const slices = Array.from({ length: CONCURRENCY }, (_, i) => todo.filter((_, k) => k % CONCURRENCY === i));
  await Promise.all(
    slices.map(async slice => {
      for (const item of slice) {
        if (stopped) return;
        try {
          await one(item);
        } catch (err) {
          if (stopped) return;
          failed.push(item.slug);
          console.error(`${item.slug}: ${(err as Error).message}`);
        }
        if (++n % 50 === 0) console.log(`  ${n}/${todo.length}`);
      }
    }),
  );
}

let todo: AudioItem[];
let skipped: number;
if (reprocess) {
  const stored = [...already].filter(s => (only ? only.has(s) : true));
  const orphans = stored.filter(s => !bySlug.has(s));
  const missing = only ? [...only].filter(s => !already.has(s)) : [];
  const candidates = stored.filter(s => bySlug.has(s)).map(s => bySlug.get(s)!);
  todo = candidates.filter(i => needsReprocess(manifest, i.slug, PROCESS_VERSION));
  skipped = candidates.length - todo.length;
  console.log(
    `${already.size} clips stored, ${skipped} already at process version ${PROCESS_VERSION}, ${todo.length} to reprocess` +
      (orphans.length ? `, ${orphans.length} not in the plan (left as they are)` : ''),
  );
  if (missing.length) console.log(`  not stored, nothing to reprocess (voice them with --only): ${missing.join(', ')}`);
  if (orphans.length) console.log(`  not in the plan: ${orphans.slice(0, 20).join(', ')}${orphans.length > 20 ? ' …' : ''}`);
} else {
  todo = plan.filter(i => (only ? only.has(i.slug) : force || !already.has(i.slug)));
  skipped = plan.length - todo.length;
  const young = todo.filter(i => i.register === 'young').length;
  console.log(
    `${plan.length} recordings in the plan, ${skipped} already voiced, ${todo.length} to voice (${young} young, ${todo.length - young} teen)` +
      (noProcess ? ' — --no-process: stored as the model returns them' : ''),
  );
}

if (dryRun) {
  for (const i of todo.slice(0, 20)) console.log(`  ${i.slug}.mp3  ←  ${i.text}  [${i.register}]`);
  if (todo.length > 20) console.log(`  … and ${todo.length - 20} more`);
  console.log('dry run: nothing voiced, processed or written.');
  process.exit(0);
}

await runAll(todo, reprocess ? reprocessOne : voiceOne);

// Written once, also when some clips failed: the clips that did go up are stored
// and must be on record, or a later --reprocess would run them through again.
if (manifestChanged) {
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: ENGLISH_AUDIO_MANIFEST_KEY,
        Body: JSON.stringify(manifest, null, 1),
        ContentType: 'application/json',
        CacheControl: 'public, max-age=60',
      }),
    );
  } catch (err) {
    console.error(`could not write ${ENGLISH_AUDIO_MANIFEST_KEY}: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

const mb = (b: number) => (b / 1048576).toFixed(2);
if (stopped) process.exitCode = 2;
console.log(
  reprocess
    ? `reprocessed ${reprocessed}, skipped ${skipped}`
    : `voiced ${voiced}${noProcess ? ' (not processed: --no-process)' : ''}, skipped ${skipped}`,
);
if (voiced + reprocessed) console.log(`bytes ${mb(bytesBefore)} MB → ${mb(bytesAfter)} MB → ${BUCKET}/${PREFIX}/`);
if (rejected.length) {
  console.error(`${rejected.length} rejected (${reprocess ? 'left as stored' : 'not uploaded'}) — re-voice with --only:`);
  for (const r of rejected) console.error(`  ${r.slug}: ${r.reason}`);
  process.exitCode = process.exitCode || 1;
}
if (failed.length) {
  console.error(`${failed.length} failed — re-run to retry: ${failed.slice(0, 10).join(', ')}`);
  process.exitCode = process.exitCode || 1;
}
