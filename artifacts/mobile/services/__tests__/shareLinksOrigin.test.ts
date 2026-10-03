import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { PROD_ORIGIN } from '../siteOrigin.ts';
import { composeClaimCodeMessage } from '../claimCodeMessage.ts';
import { drillShareUrl } from '../publicGames/mathDrill.ts';

const MOBILE_ROOT = join(import.meta.dirname, '..', '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '__tests__' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('shared links point at the live site', () => {
  it('PROD_ORIGIN is the production https origin, never a dev host', () => {
    assert.equal(PROD_ORIGIN, 'https://app.iqrra.com');
    assert.doesNotMatch(PROD_ORIGIN, /localhost|127\.0\.0\.1/);
  });

  it('no screen or service builds a link from location.origin', () => {
    // A parent invite once said «افتح http://localhost:8081» because the share
    // text followed whichever host the teacher happened to be browsing.
    const offenders = [
      ...sourceFiles(join(MOBILE_ROOT, 'app')),
      ...sourceFiles(join(MOBILE_ROOT, 'components')),
      ...sourceFiles(join(MOBILE_ROOT, 'services')),
    ].filter(file => /location\??\.origin/.test(readFileSync(file, 'utf8')));
    assert.deepEqual(offenders.map(f => relative(MOBILE_ROOT, f)), []);
  });

  it('the parent invite names the live site', () => {
    const message = composeClaimCodeMessage(
      { studentName: 'نزار', code: '4U6DN6', expiresOn: '11/2/2026', origin: PROD_ORIGIN, fieldLabel: 'رمز الربط' },
      true,
    );
    assert.match(message, /افتح https:\/\/app\.iqrra\.com\s/);
    assert.doesNotMatch(message, /localhost/);
  });

  it('a drill share link defaults to the live site', () => {
    assert.match(
      drillShareUrl({ op: 'mul', tables: [5], max: 20, seconds: 60 }),
      /^https:\/\/app\.iqrra\.com\/play\/multiply\?/,
    );
  });
});
