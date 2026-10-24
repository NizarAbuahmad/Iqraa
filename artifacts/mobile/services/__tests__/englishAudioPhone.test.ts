/**
 * `englishAudio.ts` plays from the phone's saved clips on native and must leave
 * the web exactly as it was. It imports `expo-audio` and `react-native`, which
 * `node --test` cannot load, so the wiring is pinned by reading the source — like
 * `iconSystem.test.ts` and `englishAudioLocation.test.ts` do.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { audioSlug } from '@workspace/curriculum/englishHub';
import { cacheFileName } from '../audioCachePolicy.ts';

/** artifacts/mobile */
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const src = read('services/englishAudio.ts');

/** The body of `export async function playWord`, up to the next top-level function. */
function playWordBody(): string {
  const start = src.indexOf('export async function playWord(');
  assert.ok(start >= 0, 'playWord not found');
  const end = src.indexOf('\nexport ', start + 1);
  return src.slice(start, end < 0 ? undefined : end);
}

describe('the web path is untouched', () => {
  it('playWord’s web branch still goes straight to playRecordingOrSpeak with the remote URL', () => {
    const body = playWordBody();
    const web = body.match(/if \(Platform\.OS === 'web'\) \{([\s\S]*?)\n    \}/);
    assert.ok(web, 'web branch not found');
    assert.match(web[1], /stopWebWord = playRecordingOrSpeak\(englishAudioUrl\(word\), word\);/);
    assert.match(web[1], /\breturn;/);
    assert.doesNotMatch(web[1], /cache|nativeSource|localUri|prefetch/i);
  });

  it('the web branch returns before anything that touches the saved clips', () => {
    const body = playWordBody();
    const webAt = body.indexOf("Platform.OS === 'web'");
    const nativeAt = body.indexOf('nativeSource(word)');
    assert.ok(webAt >= 0 && nativeAt > webAt, 'nativeSource must come after the web branch has returned');
  });

  it('prefetchLessonAudio does nothing on the web', () => {
    const start = src.indexOf('export function prefetchLessonAudio(');
    assert.ok(start >= 0, 'prefetchLessonAudio not exported');
    const firstLine = src.slice(start).split('\n').slice(1).find(l => l.trim());
    assert.equal(firstLine?.trim(), "if (Platform.OS === 'web') return;");
  });
});

describe('the lesson screen fetches ahead', () => {
  const screen = read('app/curriculum/english/[lessonId].tsx');

  it('calls prefetchLessonAudio from one effect, above the not-found return (a hook after it would break)', () => {
    const calls = screen.match(/prefetchLessonAudio\(/g) ?? [];
    assert.equal(calls.length, 1, 'one call site');
    const call = screen.indexOf('prefetchLessonAudio(lessonId');
    const effect = screen.lastIndexOf('useEffect(', call);
    assert.ok(effect >= 0 && call - effect < 200, 'the call sits inside a useEffect');
    const notFound = screen.indexOf('if (!lesson) {');
    assert.ok(notFound > call, 'the effect runs before the early return');
  });
});

describe('the clip a word plays is the same file as before', () => {
  it('the base URL and the URL shape are unchanged', () => {
    assert.match(
      src,
      /^export const ENGLISH_AUDIO_BASE_URL = 'https:\/\/pub-d9ddd8f74e734a21824518b812652124\.r2\.dev\/english-audio';$/m,
    );
    assert.match(src, /return `\$\{ENGLISH_AUDIO_BASE_URL\}\/\$\{audioSlug\(word\)\}\.mp3`;/);
  });

  it('the saved copy is named like the remote object, and the cache asks for the same URL', () => {
    for (const [word, slug] of [
      ['pencil case', 'pencil-case'],
      ["I've got a pen.", 'i-ve-got-a-pen'],
      ['Jordan', 'jordan'],
    ] as const) {
      assert.equal(audioSlug(word), slug);
      assert.equal(cacheFileName(slug), `${slug}.mp3`);
    }
    assert.match(src, /englishAudioCache\(slug => `\$\{ENGLISH_AUDIO_BASE_URL\}\/\$\{slug\}\.mp3`\)/);
  });

  it('the recorder’s playback is not routed through the cache', () => {
    const start = src.indexOf('export async function playUri(');
    assert.ok(start >= 0);
    const body = src.slice(start);
    assert.match(body, /const source = \{ uri \};/);
    assert.doesNotMatch(body, /nativeSource|cache\(\)/);
  });
});
