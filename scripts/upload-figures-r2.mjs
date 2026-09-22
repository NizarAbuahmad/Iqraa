/**
 * Uploads the book figures to R2's anonymous-read bucket, which is where the
 * app reads them from since they stopped being bundled (see
 * `artifacts/mobile/services/bookFigureUri.ts`).
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
 *   node scripts/upload-figures-r2.mjs [--force] [--concurrency N]
 *
 * Needs R2 credentials with **write access to `iqraa-public`** in the root
 * `.env`. The token that reads `iqraa-media` is not enough: it is scoped to
 * that bucket and answers 403 AccessDenied here.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = process.env.R2_PUBLIC_BUCKET || 'iqraa-public';
/** Matches `FIGURE_BASE_URL`'s path segment in `bookFigureUri.ts`. */
const PREFIX = 'figures';

const force = process.argv.includes('--force');
const concurrency = Number(
  process.argv[process.argv.indexOf('--concurrency') + 1] || 16,
);

/** `R2_*` from the root `.env`, without pulling in a dotenv dependency. */
function r2Env() {
  const out = {};
  for (const line of readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    if (!/^R2_/.test(line)) continue;
    const i = line.indexOf('=');
    out[line.slice(0, i)] = line.slice(i + 1).trim();
  }
  return out;
}

/**
 * The keys the app will ask for. Read as text rather than imported: the
 * generated file is TypeScript, and this script has no build step.
 */
function figureKeys() {
  const generated = readFileSync(
    path.join(ROOT, 'artifacts/mobile/services/bookFigureAssets.ts'),
    'utf8',
  );
  return [...generated.matchAll(/^ {2}'([^']+)',$/gm)].map(m => m[1]);
}

/**
 * `sourceId/file` → absolute path, for every PNG under `knowledge-base`.
 *
 * Walks the tree rather than deriving the path from the key, because the key
 * deliberately does not carry the grade folder — `sourceId` is the contract,
 * exactly as it is for the PDFs in `iqraa-media`.
 */
function localFigures() {
  const found = new Map();
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.png')) {
        found.set(`${path.basename(dir)}/${entry.name}`, full);
      }
    }
  };
  walk(path.join(ROOT, 'knowledge-base'));
  return found;
}

/** Every key already in the bucket under `figures/`, following pagination. */
async function existingKeys(client) {
  const keys = new Set();
  let token;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: `${PREFIX}/`,
        ContinuationToken: token,
      }),
    );
    for (const o of page.Contents || []) keys.add(o.Key.slice(PREFIX.length + 1));
    token = page.NextContinuationToken;
  } while (token);
  return keys;
}

const env = r2Env();
if (!env.R2_ENDPOINT || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
  console.error('R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY missing from .env');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
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

let already;
try {
  already = force ? new Set() : await existingKeys(client);
} catch (err) {
  console.error(`cannot list ${BUCKET}: ${err.name}`);
  if (err.$metadata?.httpStatusCode === 403) {
    console.error('the credentials in .env cannot write to this bucket — mint an R2 token');
    console.error('with Object Read & Write on iqraa-public (the iqraa-media token is scoped out)');
  }
  process.exit(1);
}

const todo = keys.filter(k => !already.has(k));
console.log(
  `${keys.length} figures, ${already.size} already in ${BUCKET}/${PREFIX}, ${todo.length} to upload`,
);

let done = 0;
let bytes = 0;
async function worker(slice) {
  for (const key of slice) {
    const file = local.get(key);
    const body = readFileSync(file);
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${PREFIX}/${key}`,
        Body: body,
        ContentType: 'image/png',
        // A figure never changes under a given key — a re-crop is a new file
        // name (see `dropped-crops` in the extraction docs) — so it is safe to
        // let browsers and the CDN hold it indefinitely.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    bytes += body.length;
    if (++done % 100 === 0) console.log(`  ${done}/${todo.length}`);
  }
}

const slices = Array.from({ length: concurrency }, (_, i) =>
  todo.filter((_, n) => n % concurrency === i),
);
await Promise.all(slices.map(worker));

console.log(
  `uploaded ${done} figures (${(bytes / 1048576).toFixed(1)} MB) → ${BUCKET}/${PREFIX}/`,
);
