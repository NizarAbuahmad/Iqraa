/**
 * Push local source PDFs up to R2, keyed by sourceId (see `r2.ts` and
 * `extract-text.ts`'s `ensureLocal`). One-time backfill for sources this
 * checkout already has on disk, and the way to hand a new/replacement source
 * to any future extraction run without going through Drive again.
 *
 * Run: pnpm --filter @workspace/curriculum run upload-r2 <sourceId> [<sourceId> ...]
 *  or: pnpm --filter @workspace/curriculum run upload-r2 --all
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isR2Configured, uploadToR2 } from './r2.ts';
import { LOCAL_FILES } from './localSources.ts';
import { loadEnvFile } from '../../../scripts/load-env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
loadEnvFile(path.join(repoRoot, '.env'));

async function main(): Promise<void> {
  if (!isR2Configured()) {
    console.error('R2 is not configured — set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env.');
    process.exitCode = 1;
    return;
  }

  const args = process.argv.slice(2);
  const ids = args.includes('--all') ? Object.keys(LOCAL_FILES) : args;
  if (!ids.length) {
    console.error('Usage: upload-to-r2.ts <sourceId> [<sourceId> ...] | --all');
    process.exitCode = 1;
    return;
  }

  for (const sourceId of ids) {
    const rel = LOCAL_FILES[sourceId];
    if (!rel) {
      console.log(`✗ ${sourceId} — not a known sourceId in extract-text.ts's LOCAL_FILES`);
      continue;
    }
    const abs = path.join(repoRoot, rel);
    if (!existsSync(abs)) {
      console.log(`✗ ${sourceId} — not on disk: ${rel}`);
      continue;
    }
    const buf = readFileSync(abs);
    const ok = await uploadToR2(`${sourceId}.pdf`, buf);
    console.log(ok ? `✓ ${sourceId} — uploaded (${buf.length} bytes)` : `✗ ${sourceId} — upload failed`);
  }
}

await main();
