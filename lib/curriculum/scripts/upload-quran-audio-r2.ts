/**
 * Copies the Quran Corner's recitation audio (Sheikh Mahmoud Khalil Al-Husary,
 * murattal, one MP3 per ayah, for the 585 ayahs in `quran_corner.json`) from
 * its public source into `iqraa-public`, where the app plays it from
 * (`artifacts/mobile/services/quranAudio.ts`). The key shape lives in
 * `src/quranAudio.ts`; the checks and the run loop live in
 * `quranAudioUpload.ts` and are unit-tested. This file is wiring only.
 *
 * Sibling of `upload-figures-r2.ts`: lists the bucket first and does only what
 * is missing, so a run that dies half way costs nothing to repeat.
 *
 *   pnpm --filter @workspace/curriculum run quran-audio [-- --dry-run | --force | --only 1:1,112:3 | --concurrency 4]
 *
 *   --dry-run   say what would be copied; fetch and write nothing.
 *   --force     redo every ayah (after changing the source).
 *   --only      redo just these surah:ayah pairs (a recording that came out wrong).
 *
 * Writes `sources/quran-audio/MANIFEST.json` (ayah, bytes, SHA-256, source URL,
 * fetched-at). COMMIT IT after a run: it is what makes the bucket auditable.
 *
 * Exit codes: 0 all done · 1 some downloads were rejected (listed) · 2 not
 * configured, or the bucket refused the credentials.
 *
 * Needs R2 credentials with write access to `iqraa-public` (see
 * `upload-figures-r2.ts`). THIS HAS NOT BEEN RUN: the build sandbox cannot
 * reach the source host. Run it where you can, then follow
 * `sources/quran-audio/VERIFY.md` before flipping `QURAN_AUDIO_UPLOADED`.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { loadEnvFile } from '../../../scripts/load-env.mjs';
import { QURAN_AUDIO_PREFIX, QURAN_AUDIO_RECITER, quranAudioAyahs } from '../src/quranAudio.ts';
import {
  QURAN_AUDIO_SOURCE_BASE,
  StorageAuthError,
  mergeManifest,
  parseOnly,
  runUpload,
  selectTodo,
  type ManifestEntry,
} from './quranAudioUpload.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
loadEnvFile(path.join(ROOT, '.env'));

const BUCKET = process.env.R2_PUBLIC_BUCKET || 'iqraa-public';
const MANIFEST_PATH = path.join(HERE, '..', 'sources', 'quran-audio', 'MANIFEST.json');

const argv = process.argv;
const force = argv.includes('--force');
const dryRun = argv.includes('--dry-run');
const flagValue = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
const concurrency = Number(flagValue('--concurrency')) || 4;

// `--only` with no value would read as absent and silently run the default job.
const onlyAt = argv.indexOf('--only');
if (onlyAt !== -1 && (argv[onlyAt + 1] === undefined || argv[onlyAt + 1].startsWith('--'))) {
  console.error('--only needs a value like 1:1,112:3');
  process.exit(2);
}

let only;
try {
  only = parseOnly(flagValue('--only'));
} catch (err) {
  console.error((err as Error).message);
  process.exit(2);
}

// Read the manifest before any network, and refuse one we cannot read: writing
// over it would lose the record of what is already in the bucket.
function readManifest(): ManifestEntry[] {
  if (!existsSync(MANIFEST_PATH)) return [];
  try {
    const parsed = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { files?: unknown };
    if (!parsed || !Array.isArray(parsed.files)) throw new Error('no "files" array');
    return parsed.files as ManifestEntry[];
  } catch (err) {
    console.error(`cannot read ${MANIFEST_PATH}: ${(err as Error).message}`);
    console.error('fix or restore it (git checkout) and run again; it was not touched.');
    process.exit(2);
  }
}
let manifest: ManifestEntry[] = readManifest();

/** Rewritten after EVERY upload, so an interrupted run still leaves each stored file recorded. */
function writeManifest(): void {
  mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  // Write beside it and rename over it: a crash mid-write must not leave
  // invalid JSON, which the next run would refuse to read.
  const tmp = `${MANIFEST_PATH}.tmp`;
  writeFileSync(
    tmp,
    JSON.stringify(
      { reciter: QURAN_AUDIO_RECITER, sourceBase: QURAN_AUDIO_SOURCE_BASE, files: manifest },
      null,
      2,
    ) + '\n',
  );
  renameSync(tmp, MANIFEST_PATH);
}

const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('R2 is not configured — set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env.');
  process.exit(2);
}

const client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

/** Every full key already in the bucket under the prefix, following pagination. */
async function existingKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `${QURAN_AUDIO_PREFIX}/`, ContinuationToken: token }),
    );
    for (const o of page.Contents ?? []) if (o.Key) keys.add(o.Key);
    token = page.NextContinuationToken;
  } while (token);
  return keys;
}

let already: Set<string>;
try {
  already = force || only ? new Set<string>() : await existingKeys();
} catch (err) {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  console.error(`cannot list ${BUCKET}: ${e.name}`);
  if (e.$metadata?.httpStatusCode === 403) {
    console.error('these credentials cannot reach that bucket — mint an R2 token with');
    console.error('Object Read & Write on iqraa-public (an iqraa-media token is scoped out)');
  }
  process.exit(2);
}

const todo = selectTodo(quranAudioAyahs(), already, { force, only });
console.log(
  `${quranAudioAyahs().length} ayahs, ${already.size} already in ${BUCKET}/${QURAN_AUDIO_PREFIX}, ${todo.length} to copy` +
    (dryRun ? ' (dry run — nothing will be fetched or written)' : ''),
);

const report = await runUpload(
  todo,
  {
    async fetchAudio(url) {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { 'user-agent': 'Iqraa-quran-audio-upload/1.0' },
      });
      return {
        status: res.status,
        contentType: res.headers.get('content-type'),
        bytes: new Uint8Array(await res.arrayBuffer()),
      };
    },
    async put(key, body) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: body,
            ContentType: 'audio/mpeg',
            // A day, not "immutable": `--only` re-uploads a recording that came
            // out wrong under the same key, and a year-long cache would keep
            // serving the bad one.
            CacheControl: 'public, max-age=86400',
          }),
        );
      } catch (err) {
        const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
        const status = e.$metadata?.httpStatusCode;
        if (status === 401 || status === 403) {
          throw new StorageAuthError(
            `${BUCKET} refused the write (${e.name ?? status}) — mint an R2 token with Object Read & Write on ${BUCKET}`,
          );
        }
        throw err;
      }
    },
    now: () => new Date(),
    log: line => console.log(line),
    onUploaded(entry) {
      manifest = mergeManifest(manifest, [entry]);
      writeManifest();
    },
  },
  { concurrency, dryRun },
);

if (dryRun) {
  console.log(`dry run: ${report.planned} ayah(s) would be copied.`);
  process.exit(0);
}

if (report.uploaded.length > 0) {
  console.log(`uploaded ${report.uploaded.length} → ${BUCKET}/${QURAN_AUDIO_PREFIX}/ ; wrote ${MANIFEST_PATH} — commit it.`);
}

if (report.aborted) {
  console.error(`stopped: ${report.aborted}`);
  process.exit(2);
}
if (report.rejected.length > 0) {
  console.error(`${report.rejected.length} download(s) rejected and NOT uploaded:`);
  for (const r of report.rejected) console.error(`  ${r.key}: ${r.reason}`);
  process.exit(1);
}
