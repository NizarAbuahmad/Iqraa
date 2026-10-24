import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The parent's page (`app/guardian.tsx`, `/guardian#{token}`) holds a bearer token for a child's account. The
 * runner cannot render React, so these rules are pinned at the source: the token is read once from the URL
 * fragment, lives in component state, and goes only into the body of the two `guardianApi` calls. It is never
 * logged, stored, put in a route, tracked or printed into the page. Comments are stripped before scanning, so a
 * comment may talk about all of this.
 */
const root = join(import.meta.dirname, '..', '..');
const raw = readFileSync(join(root, 'app', 'guardian.tsx'), 'utf8');
const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function forbid(rule: string, pattern: RegExp) {
  it(rule, () => {
    const m = src.match(pattern);
    assert.equal(m, null, `${rule} — found «${m?.[0]}» in app/guardian.tsx`);
  });
}

describe('parent page: the token stays in memory', () => {
  it('the page source is the real file, not an empty read', () => {
    assert.ok(src.includes('parseConsentFragment') && src.includes('guardianApi.lookup('), 'app/guardian.tsx did not load as expected');
  });

  forbid('rule: never console.* (the token must not reach a log)', /\bconsole\./);
  forbid('rule: never browser or device storage (localStorage, sessionStorage, AsyncStorage, SecureStore)', /localStorage|sessionStorage|AsyncStorage|SecureStore/);
  forbid('rule: never Linking (the token must not be handed to the OS or re-opened as a URL)', /\bLinking\b/);
  forbid('rule: never router.* (the token must not enter a path or query)', /\brouter\./);
  forbid('rule: never useRouter (the page does not navigate)', /\buseRouter\b/);
  forbid('rule: never useLocalSearchParams / useGlobalSearchParams (the fragment is read from window.location.hash once)', /useLocalSearchParams|useGlobalSearchParams/);
  forbid('rule: never analytics (trackEvent, trackScreen, identifyUser)', /trackEvent|trackScreen|identifyUser/);
  forbid('rule: no testID on this page (it would land in the DOM)', /\btestID\b/);
  forbid('rule: no accessibilityLabel / aria-label that references the token', /(accessibilityLabel|aria-label)\s*=\s*\{[^}]*\btoken\b/);
  forbid('rule: never print {token} or ${token} in JSX text or a template string', /\$?\{\s*token\s*\}/);

  it('rule: every line that mentions the token is the state read, a guard, or one of the two guardianApi calls', () => {
    const allowed: RegExp[] = [
      /^\s*const \[token\] = useState<string \| null>\(\(\) => readToken\(\)\);\s*$/,
      /^\s*if \(!token\)/,
      /^\s*setView\(viewForLookup\(await guardianApi\.lookup\(token\)\)\);\s*$/,
      /^\s*const out = await guardianApi\.decide\(token, decision, confirmed\);\s*$/,
    ];
    const offenders = src.split('\n').filter(line => /\btoken\b/.test(line) && !allowed.some(re => re.test(line)));
    assert.deepEqual(offenders, [], 'rule: the token appears only in its state declaration, the `if (!token)` guards and guardianApi.lookup(token) / guardianApi.decide(token, …)');
  });

  it('rule: decide() is called with the `confirmed` variable as its third argument', () => {
    assert.match(src, /guardianApi\.decide\(\s*token\s*,\s*decision\s*,\s*confirmed\s*\)/, 'guardianApi.decide must pass `confirmed` (the parent\'s tick) as the third argument');
  });

  it('rule: the `if (!token)` guard comes before the first guardianApi.lookup( — no call without a token', () => {
    const guard = src.indexOf('if (!token)');
    const lookup = src.indexOf('guardianApi.lookup(');
    assert.ok(guard >= 0, 'the `if (!token)` guard is missing');
    assert.ok(lookup >= 0, 'guardianApi.lookup( is missing');
    assert.ok(guard < lookup, 'the `if (!token)` guard must appear before the first guardianApi.lookup(');
  });
});
