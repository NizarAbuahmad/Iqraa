/**
 * Uploads each lesson's book pages to R2's anonymous-read bucket, where the
 * app's book-page view reads them (`BOOK_PAGES_BASE_URL` in
 * `artifacts/mobile/services/bookFigures.ts`), as `book-pages/<kbLessonId>/<n>.jpg`.
 *
 * The pages are rendered by `scripts/verify_book_pages.py`, which also writes
 * the list of lessons to `knowledge-base/book-page-links.json`. That list is
 * the contract: every page of every lesson in it must exist — on disk or
 * already in the bucket — or the upload refuses, since otherwise the app would
 * show a lesson with a hole in it. Pages only in the bucket are left alone, so
 * the render dir only has to hold what the latest run cut.
 *
 * Unlike figures, a page CAN change under its key: a re-issued edition is
 * re-cut to the same names. So a file is re-sent whenever its size differs
 * from the bucket's copy, and it is cached for a day, not forever.
 *
 *   pnpm --filter @workspace/curriculum run upload-book-pages-r2 -- <pages dir>
 *
 * Needs R2 credentials with write access to `iqraa-public` — the same ones
 * `upload-figures-r2.ts` uses.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { loadEnvFile } from '../../../scripts/load-env.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
loadEnvFile(path.join(ROOT, '.env'));

const BUCKET = process.env.R2_PUBLIC_BUCKET || 'iqraa-public';
const PREFIX = 'book-pages';
const dir = process.argv.slice(2).find(a => !a.startsWith('-'));
if (!dir) {
  console.error('usage: upload-book-pages-r2 <dir holding <kbLessonId>/<n>.jpg>');
  process.exit(2);
}

const links = JSON.parse(readFileSync(path.join(ROOT, 'knowledge-base/book-page-links.json'), 'utf8')) as {
  lessons: Record<string, { startPage: number; endPage: number }>;
};
const files = Object.entries(links.lessons).flatMap(([id, l]) =>
  Array.from({ length: l.endPage - l.startPage + 1 }, (_, n) => `${id}/${n + 1}.jpg`));
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

/** Size of every object already under `book-pages/`, by file name. */
const remote = new Map<string, number>();
let token: string | undefined;
do {
  const page = await client.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `${PREFIX}/`, ContinuationToken: token }));
  for (const o of page.Contents ?? []) if (o.Key) remote.set(o.Key.slice(PREFIX.length + 1), o.Size ?? -1);
  token = page.NextContinuationToken;
} while (token);

const local = (f: string) => existsSync(path.join(dir, f));
const missing = files.filter(f => !local(f) && !remote.has(f));
if (missing.length > 0) {
  console.error(`${missing.length} page(s) listed but neither in ${dir} nor in ${BUCKET}, e.g. ${missing.slice(0, 3).join(', ')}`);
  console.error('re-run scripts/verify_book_pages.py with this directory');
  process.exit(1);
}

const todo = files.filter(f => local(f) && remote.get(f) !== statSync(path.join(dir, f)).size);
console.log(`${files.length} pages, ${files.length - todo.length} already current in ${BUCKET}/${PREFIX}, ${todo.length} to upload`);

let bytes = 0;
for (const [i, f] of todo.entries()) {
  const body = readFileSync(path.join(dir, f));
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `${PREFIX}/${f}`,
    Body: body,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=86400',
  }));
  bytes += body.length;
  if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${todo.length}`);
}
console.log(`uploaded ${todo.length} pages (${(bytes / 1048576).toFixed(1)} MB) → ${BUCKET}/${PREFIX}/`);
