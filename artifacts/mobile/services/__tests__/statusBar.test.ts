// A dark band under the status bar needs light status-bar icons. The system
// default is dark icons in light mode, so the corners' bands, the games' accent
// headers and the library page showed dark icons on a dark band (Today had the
// same bug until it set light-content itself). The fix is one focus-scoped hook,
// useLightStatusBar, which every screen whose dark top sits under the status bar
// calls; it puts the default back when that screen loses focus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createBarStyleRequests } from '../statusBarRequests.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

test('the hook holds a request while focused, and is a no-op on web', () => {
  const src = read('hooks', 'useLightStatusBar.ts');
  assert.match(src, /useFocusEffect\(/);
  assert.match(src, /return requests\.request\(\)/, 'the focus effect must return the release as its cleanup');
  assert.match(src, /Platform\.OS === 'web'/, 'the web has no status bar; the hook must be a no-op there');
});

test('a push from one dark screen to another stays light', () => {
  const seen: string[] = [];
  const r = createBarStyleRequests(s => seen.push(s));
  const hub = r.request(); // the corner hub is focused
  const page = r.request(); // a corner page is pushed: its focus effect runs at mount…
  hub(); // …and only then does the navigator blur the hub
  assert.equal(seen.at(-1), 'light-content');
  page(); // back to a screen with a light top
  assert.equal(seen.at(-1), 'default');
});

test('a release counts once', () => {
  const seen: string[] = [];
  const r = createBarStyleRequests(s => seen.push(s));
  const a = r.request();
  const b = r.request();
  a(); a(); // a cleanup called twice must not release b's hold
  assert.equal(seen.at(-1), 'light-content');
  b();
  assert.equal(seen.at(-1), 'default');
});

test('every dark top under the status bar asks for light icons', () => {
  for (const parts of [
    ['components', 'corners', 'CornerFrame.tsx'],
    ['components', 'publicGames', 'GameShell.tsx'],
    ['components', 'today', 'PhoneToday.tsx'],
    ['app', 'curriculum', 'resources.tsx'],
  ]) {
    assert.match(read(...parts), /useLightStatusBar\(/, `${parts.join('/')} draws a dark band under the status bar`);
  }
});

test('a band that pays insets.top calls the hook (a new one cannot forget)', () => {
  for (const dir of ['app', 'components']) {
    for (const f of walk(join(ROOT, dir))) {
      const src = readFileSync(f, 'utf8');
      // Code lines only: profile explains in a comment why it does NOT pay insets.top.
      const code = src.split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');
      if (/<Band\b/.test(code) && /insets\.top/.test(code)) {
        assert.match(src, /useLightStatusBar\(/, `${relative(ROOT, f)} puts a Band under the status bar without useLightStatusBar`);
      }
    }
  }
});

test('nothing sets light-content by hand outside the hook', () => {
  for (const dir of ['app', 'components']) {
    for (const f of walk(join(ROOT, dir))) {
      assert.doesNotMatch(readFileSync(f, 'utf8'), /setBarStyle\('light-content'\)/, `${relative(ROOT, f)}: use useLightStatusBar`);
    }
  }
});
