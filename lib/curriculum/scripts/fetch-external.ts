/**
 * Take our own copy of the external resources whose licence permits it.
 *
 * Ingesting is redistribution. That is the whole risk here, and it is why this
 * script is a gate rather than a downloader: every refusal below is a case
 * where taking the bytes would be the wrong thing to do, and the failure mode
 * of getting it wrong is silent — a working feature serving material we had no
 * right to serve.
 *
 * Four gates, all failing closed:
 *
 *  1. **The manifest is the allowlist.** Nothing is fetched that a person did
 *     not write into `data/external_resources.json` with a licence and a date.
 *     There is no discovery, no crawl, no "while we're here".
 *  2. **The licence must permit redistribution** — `REDISTRIBUTABLE_LICENSES`.
 *     A CC-BY-NC or embed-only resource is skipped with its reason printed.
 *  3. **The licence check must be fresh.** PhET relicensed its entire library
 *     on 2026-03-29; a manifest entry written the week before was accurate
 *     when written and wrong seven days later. A check older than
 *     `LICENSE_CHECK_MAX_AGE_DAYS` is refused, and so is an unparseable date.
 *  4. **`fetchUrl` must exist and be https.** No inferring the asset from the
 *     article page: a wrong guess ingests the wrong bytes under a licence that
 *     was read for something else.
 *
 * Like `extract-text.ts`, this does **not** write the manifest. It prints the
 * `ingest` block for a human to paste, so that taking a copy and recording
 * that we took it stay two deliberate acts — the manifest is the audit trail,
 * and a script that edits its own audit trail is not one.
 *
 * Run: pnpm --filter @workspace/curriculum run fetch-external [--force] [<id> ...]
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EXTERNAL_RESOURCES,
  ingestRefusal,
  validateExternalResources,
  type ExternalResource,
} from '../src/external.ts';
import { isR2Configured, uploadToR2 } from './r2.ts';
import { loadEnvFile } from '../../../scripts/load-env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
loadEnvFile(path.join(repoRoot, '.env'));

/** Content types we are willing to store, mapped to the key's extension. */
const EXTENSION_BY_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
};

/** 40 MB. A listening passage is ~3 MB; anything this large is a mistake. */
const MAX_BYTES = 40 * 1024 * 1024;

type Skip = { id: string; why: string };

async function ingestOne(r: ExternalResource): Promise<string> {
  const res = await fetch(r.fetchUrl!, { redirect: 'follow' });
  if (!res.ok) return `HTTP ${res.status} from ${r.fetchUrl}`;

  const mime = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  const ext = EXTENSION_BY_MIME[mime];
  if (!ext) return `unsupported content-type "${mime || '(none)'}"`;

  const body = Buffer.from(await res.arrayBuffer());
  if (!body.length) return 'empty response body';
  if (body.length > MAX_BYTES) return `${body.length} bytes exceeds the ${MAX_BYTES}-byte ceiling`;

  // Keyed by resource id, not by the origin's filename: the id is ours and
  // stable, and an origin filename can collide or carry someone's timestamp.
  const key = `external/${r.id}.${ext}`;
  const ok = await uploadToR2(key, body, mime);
  if (!ok) return 'R2 upload failed';

  const block = {
    r2Key: key,
    sha256: createHash('sha256').update(body).digest('hex'),
    bytes: body.length,
    ingestedAt: new Date().toISOString().slice(0, 10),
  };
  console.log(`✓ ${r.id} — ${body.length} bytes, ${mime}`);
  console.log(`    "ingest": ${JSON.stringify(block)}`);
  return '';
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const force = process.argv.includes('--force');
  const only = args.length ? new Set(args) : null;

  const structural = validateExternalResources();
  if (structural.length) {
    // A malformed manifest is not a thing to fetch around. Refusing whole
    // stops a run from half-ingesting a file whose licence line is wrong.
    console.error('Manifest is invalid — fix these before ingesting:');
    for (const e of structural) console.error(`  ${e}`);
    process.exitCode = 1;
    return;
  }

  if (!isR2Configured()) {
    // `isR2Configured` returns false rather than throwing, so without this a
    // credential-less run prints nothing but successes-that-did-nothing.
    console.error('R2 is not configured (R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET).');
    process.exitCode = 1;
    return;
  }

  const skipped: Skip[] = [];
  const failed: Skip[] = [];
  let done = 0;

  for (const r of EXTERNAL_RESOURCES) {
    if (only && !only.has(r.id)) continue;
    if (r.ingest && !force) {
      console.log(`· ${r.id} — already ingested as ${r.ingest.r2Key} (use --force to redo)`);
      continue;
    }
    const why = ingestRefusal(r);
    if (why) {
      skipped.push({ id: r.id, why });
      console.log(`✗ ${r.id} — ${why}`);
      continue;
    }
    const error = await ingestOne(r);
    if (error) {
      failed.push({ id: r.id, why: error });
      console.log(`✗ ${r.id} — ${error}`);
      continue;
    }
    done += 1;
  }

  console.log(`\n${done} ingested, ${skipped.length} skipped by licence, ${failed.length} failed.`);
  if (done) {
    console.log('\nPaste each "ingest" block above onto its entry in'
      + ' lib/curriculum/src/data/external_resources.json.');
  }
  // A fetch that broke is an error; a licence refusal is the script working.
  if (failed.length) process.exitCode = 1;
}

await main();
