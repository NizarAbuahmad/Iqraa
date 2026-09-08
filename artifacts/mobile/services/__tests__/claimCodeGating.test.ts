/**
 * Every door to the per-student link code is gated on `studentAccounts`.
 *
 * The guard that was missing. `POST /students/:id/claim-code` is refused while
 * `STUDENT_ACCOUNTS` is false, which is v1 — so any control that leads a
 * teacher there is a dead end, and an easy-to-find dead end is worse than a
 * buried one. PR #281 added a second door (the class-chat header menu) while a
 * parallel branch was gating the first (the roster's key icon); the branches
 * merged cleanly, and the new door shipped ungated. A teacher found it in
 * production and could not mint a code.
 *
 * Asserted by reading the source rather than by rendering: the screens pull in
 * expo-router, Ionicons and the whole messaging service, so rendering one here
 * would cost more than it proves. What actually failed was a file offering the
 * route without consulting the flag, and that is exactly what this reads.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '../../app');

/** Anything that sends a teacher at the claim-code screen, by route or by label. */
const OFFERS_CODE = [
  /['"`]\/messaging\/claim/,
  /messagingStudentCodes/,
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('the link code is never offered where v1 refuses to mint it', () => {
  const files = walk(appDir).map(p => ({ p, body: readFileSync(p, 'utf8') }));

  it('finds the screens that offer it at all', () => {
    // If this drops to zero the test below is vacuously green — which is how a
    // source-reading guard rots. Fails loudly instead.
    const offering = files.filter(f => OFFERS_CODE.some(re => re.test(f.body)));
    assert.ok(
      offering.length >= 2,
      `only ${offering.length} screen(s) offer the claim code — has a route or key been renamed?`,
    );
  });

  it('gates every one of them on studentAccounts', () => {
    const ungated = files
      .filter(f => OFFERS_CODE.some(re => re.test(f.body)))
      // The claim screen itself is the destination, not a door to it: reaching
      // it already required passing one of these gates, and `routeGating.ts`
      // keeps non-teachers out.
      .filter(f => !f.p.includes(path.join('messaging', 'claim')))
      // The HOOK, not the word. A first draft matched /studentAccounts/ and a
      // mutation that replaced the hook call with `const studentAccounts =
      // true` still passed it — the variable kept the name. Only calling
      // `useStudentAccountsEnabled` actually reads the server's answer.
      .filter(f => !/useStudentAccountsEnabled\s*\(/.test(f.body))
      .map(f => path.relative(appDir, f.p));

    assert.deepEqual(
      ungated,
      [],
      `these offer the claim code without checking studentAccounts: ${ungated.join(', ')}`,
    );
  });
});
