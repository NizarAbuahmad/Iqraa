/**
 * Voices every English-hub word once and puts the MP3 in the public bucket,
 * where the app plays it from (`artifacts/mobile/services/englishAudio.ts`).
 *
 * Same shape as `upload-figures-r2.ts`: list the bucket, do only what is
 * missing, so a run that dies half way costs nothing to repeat. `--force`
 * re-voices everything (after changing the voice or instructions — the key is
 * the word, not the recording). `--dry-run` reports and touches nothing.
 *
 *   pnpm --filter @workspace/curriculum run english-audio [-- --dry-run | --force]
 *
 * Needs OPENAI_API_KEY and R2 credentials with write access to `iqraa-public`.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { loadEnvFile } from '../../../scripts/load-env.mjs';
import { allHubWords, audioSlug } from '../src/englishHub.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(HERE, '..', '..', '..', '.env'));

const BUCKET = process.env.R2_PUBLIC_BUCKET || 'iqraa-public';
/** Matches `ENGLISH_AUDIO_BASE_URL` in the app. */
const PREFIX = 'english-audio';
const MODEL = 'gpt-4o-mini-tts';
const VOICE = 'coral';
// The books are British ("mum", "colourful", "trainers"), so the voice is too.
const INSTRUCTIONS =
  'You are reading a vocabulary card to a young child learning English. ' +
  'Say only the given word or phrase, once, clearly and a little slowly, with a friendly British accent.';

const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

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
      body: JSON.stringify({ model: MODEL, voice: VOICE, input: text, instructions: INSTRUCTIONS, response_format: 'mp3' }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    // A bad key fails every word the same way — stop everything, not 458 errors.
    if (res.status === 401 || res.status === 403) {
      console.error(`TTS ${res.status}: the OpenAI key was refused. Nothing more will be voiced.`);
      process.exit(2);
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
for (const w of allHubWords()) if (!bySlug.has(audioSlug(w))) bySlug.set(audioSlug(w), w);

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

const todo = [...bySlug].filter(([slug]) => !already.has(slug));
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
    try {
      const body = await speak(word);
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
      failed.push(word);
      console.error((err as Error).message);
    }
  }
}

const CONCURRENCY = 4;
const slices = Array.from({ length: CONCURRENCY }, (_, i) => todo.filter((_, n) => n % CONCURRENCY === i));
await Promise.all(slices.map(worker));

console.log(`voiced ${done} words (${(bytes / 1048576).toFixed(1)} MB) → ${BUCKET}/${PREFIX}/`);
if (failed.length) {
  console.error(`${failed.length} failed — re-run to retry: ${failed.slice(0, 10).join(', ')}`);
  process.exit(1);
}
