import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  AUDIO_CACHE_CAP_BYTES,
  AUDIO_CACHE_VERSION,
  MIN_CLIP_BYTES,
  PREFETCH_CONCURRENCY,
  RATE_LIMIT_COOLDOWN_MS,
  audioCacheFolder,
  cacheFileName,
  createFailureMemory,
  isTempFile,
  lruVictims,
  runLimited,
  slugFromCacheFile,
  staleVersionEntries,
  statusFromDownloadError,
  tempFileName,
} from '../audioCachePolicy.ts';

describe('names', () => {
  it('a cached clip is named like the object it copies', () => {
    assert.equal(cacheFileName('pencil-case'), 'pencil-case.mp3');
    assert.equal(slugFromCacheFile('pencil-case.mp3'), 'pencil-case');
    assert.equal(slugFromCacheFile(tempFileName('pencil-case')), null);
    assert.equal(slugFromCacheFile('notes.txt'), null);
  });

  it('the temp name is never a playable clip name', () => {
    const t = tempFileName('cat');
    assert.ok(isTempFile(t));
    assert.ok(!t.endsWith('.mp3'));
    assert.ok(!isTempFile(cacheFileName('cat')));
  });

  it('the constants the brief fixed', () => {
    assert.equal(AUDIO_CACHE_VERSION, 1);
    assert.equal(audioCacheFolder(), 'v1');
    assert.equal(AUDIO_CACHE_CAP_BYTES, 40 * 1024 * 1024);
    assert.equal(MIN_CLIP_BYTES, 1024);
    assert.equal(PREFETCH_CONCURRENCY, 2);
    assert.equal(RATE_LIMIT_COOLDOWN_MS, 60_000);
  });

  it('every entry under the root that is not this version is stale — folders and strays alike', () => {
    assert.deepEqual(staleVersionEntries(['v1', 'v0', 'v2', 'junk.mp3']).sort(), ['junk.mp3', 'v0', 'v2']);
    assert.deepEqual(staleVersionEntries(['v1']), []);
    assert.deepEqual(staleVersionEntries(['v1', 'v2'], 2), ['v1']);
  });
});

describe('lruVictims', () => {
  const f = (name: string, size: number, lastUsed: number) => ({ name, size, lastUsed });

  it('nothing to remove at or under the cap', () => {
    assert.deepEqual(lruVictims([f('a', 10, 1), f('b', 10, 2)], 20), []);
  });

  it('removes least recently used first, only until it fits', () => {
    const files = [f('new', 10, 30), f('old', 10, 10), f('mid', 10, 20), f('newest', 10, 40)];
    assert.deepEqual(lruVictims(files, 25), ['old', 'mid']);
    assert.deepEqual(lruVictims(files, 39), ['old']);
  });

  it('ties break by name so the order is stable', () => {
    assert.deepEqual(lruVictims([f('b', 10, 5), f('a', 10, 5)], 10), ['a']);
  });
});

describe('statusFromDownloadError', () => {
  it('reads the status out of both platforms’ messages', () => {
    assert.equal(statusFromDownloadError(new Error('Unable to download a file: response has status: 404')), 404); // Android
    assert.equal(statusFromDownloadError(new Error('Unable to download a file: response has status 429')), 429); // iOS
    assert.equal(statusFromDownloadError(new Error('The Internet connection appears to be offline.')), null);
    assert.equal(statusFromDownloadError('nonsense'), null);
    assert.equal(statusFromDownloadError(undefined), null);
  });
});

describe('createFailureMemory', () => {
  it('a 404 is skipped for the rest of the session', () => {
    let t = 0;
    const m = createFailureMemory(() => t);
    assert.equal(m.shouldSkip('gone'), false);
    m.note('gone', 404);
    assert.equal(m.shouldSkip('gone'), true);
    t += 24 * 60 * 60 * 1000;
    assert.equal(m.shouldSkip('gone'), true);
    assert.equal(m.shouldSkip('other'), false);
  });

  it('a 429 cools every background fetch down, then lets them try again', () => {
    let t = 1_000;
    const m = createFailureMemory(() => t);
    m.note('cat', 429);
    assert.equal(m.shouldSkip('cat'), true);
    assert.equal(m.shouldSkip('dog'), true, 'the rate limit is the link’s, not the clip’s');
    t += RATE_LIMIT_COOLDOWN_MS - 1;
    assert.equal(m.shouldSkip('cat'), true);
    t += 1;
    assert.equal(m.shouldSkip('cat'), false);
    assert.equal(m.shouldSkip('dog'), false);
  });

  it('anything else (offline, a 500, null) is not remembered', () => {
    const m = createFailureMemory(() => 0);
    m.note('a', null);
    m.note('b', 500);
    m.note('c', 200);
    assert.equal(m.shouldSkip('a') || m.shouldSkip('b') || m.shouldSkip('c'), false);
  });
});

describe('runLimited', () => {
  it('never runs more than the limit at once, and runs everything', async () => {
    let running = 0;
    let peak = 0;
    const done: number[] = [];
    await runLimited([1, 2, 3, 4, 5, 6, 7], 2, async n => {
      running++;
      peak = Math.max(peak, running);
      await new Promise(r => setTimeout(r, (n % 3) + 1));
      running--;
      done.push(n);
    });
    assert.equal(peak, 2);
    assert.deepEqual(done.sort(), [1, 2, 3, 4, 5, 6, 7]);
  });

  it('one failure does not stop the rest, and nothing rejects', async () => {
    const done: number[] = [];
    await runLimited([1, 2, 3], 2, async n => {
      if (n === 1) throw new Error('boom');
      done.push(n);
    });
    assert.deepEqual(done.sort(), [2, 3]);
  });

  it('an empty list resolves', async () => {
    await runLimited([], 2, async () => {});
  });
});
