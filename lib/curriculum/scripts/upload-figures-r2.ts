/**
 * Uploads the book figures to R2's anonymous-read bucket, which is where the
 * app reads them from since they stopped being bundled (see
 * `artifacts/mobile/services/bookFigureUri.ts`).
 *
 * Sibling of `upload-to-r2.ts`, and deliberately not folded into it: that one
 * puts source PDFs in the **private** `iqraa-media` under `<sourceId>.pdf` for
 * the extractor to read, this one puts figures in the **public** bucket under
 * `figures/<sourceId>/<file>` for a teacher's device to fetch. Different
 * bucket, different key shape, different reader — see `docs/adding-a-book.md`.
 *
 * The figure set is whatever `bookFigureAssets.ts` declares — parsed as text,
 * the same way the drift test reads it — so this script and the app cannot
 * disagree about which figures exist. Local bytes are found by matching each
 * key's `sourceId/file` against the PNGs under `knowledge-base/`.
 *
 * Idempotent and resumable: it lists the bucket first and uploads only what is
 * missing, so a run that dies at figure 1,900 costs nothing to repeat. Pass
 * `--force` to re-upload everything (after re-cropping a figure, say — the key
 * does not change when the bytes do).
 *
 *   pnpm --filter @workspace/curriculum run upload-figures-r2 [-- --force]
 *
 * Needs R2 credentials with **write access to `iqraa-public`**. A token scoped
 * to `iqraa-media` alone answers 403 AccessDenied here, which is the shape the
 * "cannot list" message below is written for.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { loadEnvFile } from '../../../scripts/load-env.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');

loadEnvFile(path.join(ROOT, '.env'));

const BUCKET = process.env.R2_PUBLIC_BUCKET || 'iqraa-public';
/** Matches `FIGURE_BASE_URL`'s path segment in `bookFigureUri.ts`. */
const PREFIX = 'figures';

const force = process.argv.includes('--force');
const concurrency = Number(process.argv[process.argv.indexOf('--concurrency') + 1]) || 16;

/**
 * The keys the app will ask for. Read as text rather than imported: the
 * generated file lives in the mobile app, which this package does not depend
 * on, and a set of strings needs no module graph to be trustworthy.
 */
function figureKeys(): string[] {
  const generated = readFileSync(
    path.join(ROOT, 'artifacts/mobile/services/bookFigureAssets.ts'),
    'utf8',
  );
  return [...generated.matchAll(/^ {2}'([^']+)',$/gm)].map(m => m[1]!);
}

/**
 * `sourceId/file` → absolute path, for every PNG under `knowledge-base`.
 *
 * Walks the tree rather than deriving the path from the key, because the key
 * deliberately does not carry the grade folder — `sourceId` is the contract,
 * exactly as it is for the PDFs in `iqraa-media`.
 */
function localFigures(): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.png')) found.set(`${path.basename(dir)}/${entry.name}`, full);
    }
  };
  walk(path.join(ROOT, 'knowledge-base'));
  return found;
}

/** Every key already in the bucket under `figures/`, following pagination. */
async function existingKeys(client: S3Client): Promise<Set<string>> {
  const keys = new Set<string>();
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `${PREFIX}/`, ContinuationToken: token }),
    );
    for (const o of page.Contents ?? []) {
      if (o.Key) keys.add(o.Key.slice(PREFIX.length + 1));
    }
    token = page.NextContinuationToken;
  } while (token);
  return keys;
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

const keys = figureKeys();
const local = localFigures();

const missingLocally = keys.filter(k => !local.has(k));
if (missingLocally.length > 0) {
  // The generated list and the disk disagree, which means a figure the app
  // will ask for has no bytes anywhere. Refusing is the point: uploading the
  // rest would leave a fleet rendering one broken image with nothing logged.
  console.error(`${missingLocally.length} figure(s) listed but not on disk, e.g.:`);
  for (const k of missingLocally.slice(0, 5)) console.error(`  ${k}`);
  console.error('run `node scripts/gen_book_figure_assets.mjs` and re-check knowledge-base/');
  process.exit(1);
}

let already: Set<string>;
try {
  already = force ? new Set<string>() : await existingKeys(client);
} catch (err) {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  console.error(`cannot list ${BUCKET}: ${e.name}`);
  if (e.$metadata?.httpStatusCode === 403) {
    console.error('these credentials cannot reach that bucket — mint an R2 token with');
    console.error('Object Read & Write on iqraa-public (an iqraa-media token is scoped out)');
  }
  process.exit(2);
}

const todo = keys.filter(k => !already.has(k));
console.log(`${keys.length} figures, ${already.size} already in ${BUCKET}/${PREFIX}, ${todo.length} to upload`);

let done = 0;
let bytes = 0;

async function worker(slice: string[]): Promise<void> {
  for (const key of slice) {
    const body = readFileSync(local.get(key)!);
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${PREFIX}/${key}`,
        Body: body,
        ContentType: 'image/png',
        // A figure never changes under a given key — a re-crop gets a new file
        // name, which `dropped-crops` in the extraction notes spells out — so
        // browsers and the CDN can hold it indefinitely.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    bytes += body.length;
    if (++done % 100 === 0) console.log(`  ${done}/${todo.length}`);
  }
}

const slices = Array.from({ length: concurrency }, (_, i) => todo.filter((_, n) => n % concurrency === i));
await Promise.all(slices.map(worker));

console.log(`uploaded ${done} figures (${(bytes / 1048576).toFixed(1)} MB) → ${BUCKET}/${PREFIX}/`);
