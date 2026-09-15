/**
 * Re-probe every QR link the books print, and write back what answered.
 *
 * `book-qr-links.json` carries an `httpStatus` per row, and `bookQrLinks.ts`
 * renders only the rows that answered 200 or 206. That made the library correct
 * on the day the statuses were captured and wrong every day after: the field
 * was recorded on 2026-09-12 and by 2026-09-15 `qr.nccd.gov.jo` refused
 * connections over both http and https, so the screen was offering ~163 dead
 * links with no way for anyone to tell.
 *
 * A status captured once is a claim about the past. This turns it back into a
 * claim about now — run it, read the summary, commit the result. If the host
 * stays down the library empties itself, which is the honest outcome: we do not
 * host this material and cannot serve it when the ministry does not.
 *
 * Deliberately does NOT edit the file when every probe fails. A laptop on a
 * captive portal, a DNS outage or a blocked egress all look exactly like "the
 * ministry took it down", and zeroing 186 rows on that evidence would delete
 * the library for everyone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, '../../../knowledge-base/book-qr-links.json');

const TIMEOUT_MS = 20_000;
/** Ministry media is large; a HEAD is enough and a GET would pull the file. */
const METHOD = 'HEAD';
/** Below this share answering, assume the problem is this machine, not the host. */
const SANITY_FLOOR = 0.05;

interface Entry {
  workingUrl?: string;
  printedUrl?: string;
  httpStatus?: string | number;
  note?: string;
  [k: string]: unknown;
}

const absolute = (url: string) => (/^https?:\/\//i.test(url) ? url : `http://${url}`);

async function probe(url: string): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(absolute(url), { method: METHOD, signal: ac.signal, redirect: 'follow' });
    return String(res.status);
  } catch {
    // curl reports an unreachable host as 000 and the existing rows use that
    // spelling, so a refusal stays distinguishable from a 404.
    return '000';
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const doc = JSON.parse(fs.readFileSync(FILE, 'utf8')) as { entries: Entry[]; checkedAt?: string };
  const entries = doc.entries;
  const probes = entries.map(e => e.workingUrl ?? e.printedUrl ?? '');

  const results: string[] = [];
  for (let i = 0; i < probes.length; i += 1) {
    const url = probes[i];
    results.push(url ? await probe(url) : '000');
    if ((i + 1) % 20 === 0) process.stdout.write(`  probed ${i + 1}/${probes.length}\n`);
  }

  const alive = results.filter(s => s === '200' || s === '206').length;
  const before = entries.filter(e => ['200', '206'].includes(String(e.httpStatus))).length;
  process.stdout.write(`\n${alive} of ${entries.length} answered (was ${before})\n`);

  const byStatus: Record<string, number> = {};
  for (const s of results) byStatus[s] = (byStatus[s] ?? 0) + 1;
  for (const [s, n] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  ${s}: ${n}\n`);
  }

  if (alive / entries.length < SANITY_FLOOR && before / entries.length > SANITY_FLOOR) {
    process.stdout.write(
      `\nREFUSED to write: ${alive}/${entries.length} answered but ${before} did last time.\n` +
        'That is more likely to be this machine than the ministry. Check the network,\n' +
        'then re-run. Nothing has been changed.\n',
    );
    process.exitCode = 1;
    return;
  }

  entries.forEach((e, i) => { e.httpStatus = results[i]; });
  doc.checkedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(FILE, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  process.stdout.write(`\nwrote ${path.relative(process.cwd(), FILE)} (checkedAt ${doc.checkedAt})\n`);
}

await main();
