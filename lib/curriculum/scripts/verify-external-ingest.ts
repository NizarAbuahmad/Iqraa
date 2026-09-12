/**
 * Prove the manifest's `ingest` blocks describe bytes that are really there.
 *
 * `fetch-external.ts` prints what it uploaded and a human pastes that in, so
 * the manifest is a *claim* about the bucket, transcribed by hand. Two ways
 * that goes wrong and neither shows up anywhere else: a block pasted onto the
 * wrong entry, and a block kept after the object was removed or renamed.
 * Either way the lesson page renders nothing and the manifest looks fine.
 *
 * This re-downloads each object through a signed URL and compares the sha256
 * and byte count to what the manifest claims — the digest is the point, since
 * a key can exist and still hold different bytes than the entry describes.
 *
 * Run: pnpm --filter @workspace/curriculum run verify-ingest
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXTERNAL_RESOURCES } from '../src/external.ts';
import { isR2Configured, downloadFromR2 } from './r2.ts';
import { loadEnvFile } from '../../../scripts/load-env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.join(path.resolve(here, '../../..'), '.env'));

async function main(): Promise<void> {
  if (!isR2Configured()) {
    // Same reasoning as audit-r2: "no credentials" and "nothing there" must
    // not look alike, so this exits non-zero rather than reporting all-clear.
    console.error('R2 is not configured — cannot verify anything.');
    process.exitCode = 2;
    return;
  }

  const claimed = EXTERNAL_RESOURCES.filter(r => r.ingest);
  if (claimed.length === 0) {
    console.log('No resource claims an ingested copy. Nothing to verify.');
    return;
  }

  let bad = 0;
  for (const r of claimed) {
    const { r2Key, sha256, bytes } = r.ingest!;
    const buf = await downloadFromR2(r2Key);
    if (!buf) {
      console.log(`✗ ${r.id} — ${r2Key} is not in the bucket`);
      bad++;
      continue;
    }
    const actual = createHash('sha256').update(buf).digest('hex');
    const sizeOk = buf.length === bytes;
    const hashOk = actual === sha256;
    if (sizeOk && hashOk) {
      console.log(`✓ ${r.id} — ${buf.length} bytes, digest matches`);
      continue;
    }
    bad++;
    if (!sizeOk) console.log(`✗ ${r.id} — manifest says ${bytes} bytes, bucket has ${buf.length}`);
    if (!hashOk) console.log(`✗ ${r.id} — digest mismatch: the bucket holds different bytes`);
  }

  console.log(`\n${claimed.length - bad} verified, ${bad} wrong.`);
  if (bad) process.exitCode = 1;
}

await main();
