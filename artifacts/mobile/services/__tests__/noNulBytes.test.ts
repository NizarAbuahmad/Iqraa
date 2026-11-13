// A NUL byte in a source file is the corruption signature CLAUDE.md warns about
// (a `sed -i` once turned spaces into NULs while every test stayed green), and it
// makes `grep` report "binary file matches" instead of the line. A deliberate NUL
// in a string is spelled `\u0000` — resolveGroundedKbLesson's cache key had three
// raw ones until 2026-11-13. This fails on any raw NUL in the app's own source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIRS = ['services', 'app', 'components', 'constants', 'context', 'hooks', 'scripts'];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

test('no .ts/.tsx source file under the app holds a raw NUL byte', () => {
  const files = DIRS.map((d) => join(ROOT, d)).filter(existsSync).flatMap((d) => sourceFiles(d));
  // The two folders CLAUDE.md names must be in the scan, or this passes on nothing.
  assert.ok(files.some((f) => relative(ROOT, f).startsWith('services')), 'scanned no services file');
  assert.ok(files.some((f) => relative(ROOT, f).startsWith('app')), 'scanned no app file');

  const offenders = files.flatMap((f) => {
    const bytes = readFileSync(f);
    const at = bytes.indexOf(0);
    if (at < 0) return [];
    const line = bytes.subarray(0, at).toString('utf8').split('\n').length;
    return [`${relative(ROOT, f)}:${line}`];
  });
  assert.deepEqual(offenders, [], `raw NUL byte (write \\u0000 instead) in: ${offenders.join(', ')}`);
});
