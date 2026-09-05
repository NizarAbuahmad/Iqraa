/**
 * What is in the R2 bucket that the manifest has never heard of — and what
 * the manifest claims that has no bytes anywhere.
 *
 * A PDF uploaded through the Cloudflare dashboard leaves no trace in the
 * repo: no manifest row, no `LOCAL_FILES` entry, no extracted text. Nothing
 * fails, nothing warns, and the book is simply invisible to the app. The only
 * way to notice was to already know the filename, which is exactly what you
 * don't when someone else did the uploading.
 *
 * Run:
 *   pnpm --filter @workspace/curriculum run audit-r2
 *   pnpm --filter @workspace/curriculum run audit-r2 -- --bucket iqraa-public
 *
 * Needs `R2_ENDPOINT`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` in
 * `.env`; without them it says so and exits 2 rather than reporting an empty
 * bucket, because "no credentials" and "nothing there" must not look alike.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { G10_SOURCES } from '../src/sources.ts';
import { LOCAL_FILES } from './localSources.ts';
import { listR2Keys } from './r2.ts';
import { loadEnvFile } from '../../../scripts/load-env.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(HERE, '..', '..', '..', '.env'));
const EXTRACTED = path.join(HERE, '..', 'src', 'data', 'extracted');

const bucketArg = process.argv.indexOf('--bucket');
const bucketName = bucketArg !== -1 ? process.argv[bucketArg + 1] : undefined;

function sourceIdFromKey(key: string): string {
  return key.replace(/\.pdf$/i, '');
}

async function main(): Promise<void> {
  const keys = await listR2Keys(bucketName);
  if (keys === null) {
    console.error(
      'R2 is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID and\n' +
        'R2_SECRET_ACCESS_KEY in .env (R2_BUCKET optional, defaults iqraa-media),\n' +
        'then re-run. Nothing was checked.',
    );
    process.exit(2);
  }

  const manifestIds = new Set(G10_SOURCES.map(s => s.id));
  const pdfKeys = keys.filter(k => /\.pdf$/i.test(k));
  const otherKeys = keys.filter(k => !/\.pdf$/i.test(k));

  const unknown = pdfKeys.filter(k => !manifestIds.has(sourceIdFromKey(k)));
  const inR2 = new Set(pdfKeys.map(sourceIdFromKey));

  const noBytes = G10_SOURCES.filter(s => {
    if (inR2.has(s.id)) return false;
    const local = LOCAL_FILES[s.id];
    return !local || !existsSync(path.join(HERE, '..', '..', '..', local));
  });

  const noText = G10_SOURCES.filter(
    s => s.status === 'ingested' && !existsSync(path.join(EXTRACTED, `${s.id}.json`)),
  );

  console.log(`Bucket: ${bucketName ?? process.env.R2_BUCKET ?? 'iqraa-media'}`);
  console.log(`${keys.length} object(s), ${pdfKeys.length} PDF(s); manifest has ${manifestIds.size} source(s).\n`);

  console.log(`## In R2, no manifest row — ${unknown.length}`);
  console.log(unknown.length ? unknown.map(k => `  ${k}`).join('\n') : '  (none)');
  console.log('\n  → each needs a g10_sources.json row + a LOCAL_FILES entry.');
  console.log('    See docs/adding-a-book.md, steps 3-4.\n');

  console.log(`## In the manifest, no bytes in R2 or on disk — ${noBytes.length}`);
  console.log(noBytes.length ? noBytes.map(s => `  ${s.id}  (${s.status})`).join('\n') : '  (none)');
  console.log('\n  → upload-r2 these, or they cannot be re-extracted elsewhere.\n');

  console.log(`## Claims "ingested", no extracted text — ${noText.length}`);
  console.log(noText.length ? noText.map(s => `  ${s.id}`).join('\n') : '  (none)');

  if (otherKeys.length) {
    console.log(`\n## Non-PDF objects — ${otherKeys.length}`);
    console.log(otherKeys.map(k => `  ${k}`).join('\n'));
  }
}

await main();
