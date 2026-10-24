/**
 * The phone's saved English clips, against an in-memory file system (`FsLike`).
 * The real one (`audioCacheStore.ts`) is `expo-file-system`, which `node --test`
 * cannot load — so what is decided (hit or miss, what is kept, what is thrown
 * away) lives in `audioCache.ts` and is tested here.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createAudioCache, type FsEntry, type FsLike } from '../audioCache.ts';
import { MIN_CLIP_BYTES, RATE_LIMIT_COOLDOWN_MS, createFailureMemory, tempFileName } from '../audioCachePolicy.ts';

type Reply = { status: number; bytes: number } | { status: 'offline'; partial: number };

/** Files keyed by their path from the cache root ("english-audio/v1/cat.mp3"); a folder is a key with no size. */
function fakeFs(replies: Record<string, Reply> = {}, clock: () => number = () => 0) {
  const files = new Map<string, { size: number; mtime: number }>();
  const dirs = new Set<string>();
  const downloads: string[] = [];
  let running = 0;
  let peak = 0;
  let gate: Promise<void> | null = null;
  const key = (p: string[]) => p.join('/');
  const fs: FsLike = {
    listDir(path) {
      const prefix = key(path) + '/';
      const out = new Map<string, FsEntry>();
      for (const [k, v] of files) {
        if (!k.startsWith(prefix)) continue;
        const rest = k.slice(prefix.length);
        const [head, ...tail] = rest.split('/');
        out.set(head, tail.length ? { name: head, isDir: true, size: 0, mtime: 0 } : { name: head, isDir: false, size: v.size, mtime: v.mtime });
      }
      for (const d of dirs) {
        if (!d.startsWith(prefix)) continue;
        const head = d.slice(prefix.length).split('/')[0];
        if (!out.has(head)) out.set(head, { name: head, isDir: true, size: 0, mtime: 0 });
      }
      return [...out.values()];
    },
    ensureDir(path) {
      for (let i = 1; i <= path.length; i++) dirs.add(key(path.slice(0, i)));
    },
    exists: path => files.has(key(path)),
    size: path => files.get(key(path))?.size ?? 0,
    uri: path => `file:///cache/${key(path)}`,
    remove(path) {
      const k = key(path);
      files.delete(k);
      for (const f of [...files.keys()]) if (f.startsWith(k + '/')) files.delete(f);
      for (const d of [...dirs]) if (d === k || d.startsWith(k + '/')) dirs.delete(d);
    },
    move(from, to) {
      const f = files.get(key(from));
      if (!f) throw new Error('no source');
      if (files.has(key(to))) throw new Error('destination exists');
      files.delete(key(from));
      files.set(key(to), f);
    },
    async download(url, to) {
      downloads.push(url);
      running++;
      peak = Math.max(peak, running);
      try {
        if (gate) await gate;
        await Promise.resolve();
        const slug = url.split('/').pop()!.replace(/\.mp3$/, '');
        const r = replies[slug] ?? { status: 200, bytes: 5000 };
        if (r.status === 'offline') {
          // Android streams into the target: a dropped connection can leave part of it.
          if (r.partial) files.set(key(to), { size: r.partial, mtime: clock() });
          throw new Error('Unable to download a file: timeout');
        }
        if (r.status !== 200) throw new Error(`Unable to download a file: response has status: ${r.status}`);
        files.set(key(to), { size: r.bytes, mtime: clock() });
      } finally {
        running--;
      }
    },
  };
  return {
    fs,
    files,
    dirs,
    downloads,
    peak: () => peak,
    hold() {
      let open!: () => void;
      gate = new Promise(r => (open = r));
      return () => {
        gate = null;
        open();
      };
    },
  };
}

const url = (slug: string) => `https://example.test/english-audio/${slug}.mp3`;
const clip = (slug: string) => `english-audio/v1/${slug}.mp3`;

function setup(replies: Record<string, Reply> = {}, capBytes = 40 * 1024 * 1024) {
  let t = 1_000_000;
  const now = () => t;
  const f = fakeFs(replies, now);
  const cache = createAudioCache({ fs: f.fs, urlFor: url, now, capBytes, failures: createFailureMemory(now) });
  return { ...f, cache, advance: (ms: number) => (t += ms) };
}

describe('hit or miss', () => {
  it('a clip never saved is a miss; saving it makes the next tap a hit', async () => {
    const s = setup();
    assert.equal(s.cache.localUri('cat'), null);
    await s.cache.save('cat');
    assert.deepEqual(s.downloads, [url('cat')]);
    assert.equal(s.cache.localUri('cat'), `file:///cache/${clip('cat')}`);
  });

  it('a saved clip is not fetched again', async () => {
    const s = setup();
    await s.cache.save('cat');
    await s.cache.save('cat');
    await s.cache.prefetch(['cat']);
    assert.equal(s.downloads.length, 1);
  });

  it('two saves of one clip at once share one download', async () => {
    const s = setup();
    await Promise.all([s.cache.save('cat'), s.cache.save('cat')]);
    assert.equal(s.downloads.length, 1);
  });

  it('a file the OS cleared is a miss, and the next save fetches it again', async () => {
    const s = setup();
    await s.cache.save('cat');
    s.files.delete(clip('cat'));
    assert.equal(s.cache.localUri('cat'), null);
    await s.cache.save('cat');
    assert.equal(s.downloads.length, 2);
    assert.ok(s.cache.localUri('cat'));
  });

  it('a prefetch fetches again a clip the OS cleared, even with no tap in between', async () => {
    const s = setup();
    await s.cache.save('cat');
    s.files.delete(clip('cat'));
    await s.cache.prefetch(['cat']);
    assert.equal(s.downloads.length, 2);
  });

  it('copies saved in an earlier session are found', async () => {
    const s = setup();
    s.fs.ensureDir(['english-audio', 'v1']);
    s.files.set(clip('dog'), { size: 4000, mtime: 5 });
    assert.equal(s.cache.localUri('dog'), `file:///cache/${clip('dog')}`);
  });
});

describe('nothing partial is ever playable', () => {
  it('a dropped download leaves no clip and no temp file', async () => {
    const s = setup({ cat: { status: 'offline', partial: 2500 } });
    await s.cache.save('cat');
    assert.equal(s.cache.localUri('cat'), null);
    assert.deepEqual([...s.files.keys()], []);
  });

  it('a body under the floor is not kept', async () => {
    const s = setup({ cat: { status: 200, bytes: MIN_CLIP_BYTES - 1 }, dog: { status: 200, bytes: MIN_CLIP_BYTES } });
    await s.cache.save('cat');
    await s.cache.save('dog');
    assert.equal(s.cache.localUri('cat'), null);
    assert.ok(s.cache.localUri('dog'));
    assert.deepEqual([...s.files.keys()], [clip('dog')]);
  });

  it('a non-200 leaves nothing behind', async () => {
    const s = setup({ cat: { status: 404, bytes: 0 }, dog: { status: 500, bytes: 0 } });
    await s.cache.save('cat');
    await s.cache.save('dog');
    assert.deepEqual([...s.files.keys()], []);
  });

  it('downloads into a temp name, never straight into the clip name', async () => {
    const s = setup();
    const seen: string[] = [];
    const download = s.fs.download;
    s.fs.download = async (u, to) => {
      seen.push(to.join('/'));
      return download(u, to);
    };
    await s.cache.save('cat');
    assert.deepEqual(seen, [`english-audio/v1/${tempFileName('cat')}`]);
  });

  it('a temp file or a too-small clip left by a killed app is cleared on first use', () => {
    const s = setup();
    s.fs.ensureDir(['english-audio', 'v1']);
    s.files.set(`english-audio/v1/${tempFileName('cat')}`, { size: 3000, mtime: 1 });
    s.files.set(clip('dog'), { size: 10, mtime: 1 });
    s.files.set(clip('ok'), { size: 3000, mtime: 1 });
    assert.equal(s.cache.localUri('dog'), null);
    assert.deepEqual([...s.files.keys()], [clip('ok')]);
  });
});

describe('versions', () => {
  it('folders of other versions are deleted on first use, this one is kept', () => {
    const s = setup();
    s.fs.ensureDir(['english-audio', 'v0']);
    s.files.set('english-audio/v0/cat.mp3', { size: 3000, mtime: 1 });
    s.files.set('english-audio/v2/cat.mp3', { size: 3000, mtime: 1 });
    s.files.set(clip('dog'), { size: 3000, mtime: 1 });
    assert.ok(s.cache.localUri('dog'));
    assert.deepEqual([...s.files.keys()], [clip('dog')]);
    assert.ok(!s.dirs.has('english-audio/v0'));
  });
});

describe('the cap', () => {
  it('over the cap, the least recently used clips go first — a tap counts as a use', async () => {
    const s = setup({}, 3 * 5000);
    await s.cache.save('a');
    s.advance(10);
    await s.cache.save('b');
    s.advance(10);
    await s.cache.save('c');
    s.advance(10);
    assert.ok(s.cache.localUri('a')); // 'a' is now the most recently used
    s.advance(10);
    await s.cache.save('d');
    assert.equal(s.cache.localUri('b'), null, 'b was the least recently used');
    for (const k of ['a', 'c', 'd']) assert.ok(s.cache.localUri(k), k);
    const total = [...s.files.values()].reduce((n, f) => n + f.size, 0);
    assert.ok(total <= 3 * 5000);
  });

  it('a folder already over the cap from an earlier session is trimmed on first use, oldest first', () => {
    const s = setup({}, 8000);
    s.fs.ensureDir(['english-audio', 'v1']);
    s.files.set(clip('old'), { size: 4000, mtime: 1 });
    s.files.set(clip('mid'), { size: 4000, mtime: 2 });
    s.files.set(clip('new'), { size: 4000, mtime: 3 });
    assert.equal(s.cache.localUri('old'), null);
    assert.ok(s.cache.localUri('mid'));
    assert.ok(s.cache.localUri('new'));
  });
});

describe('the rate-limited link', () => {
  it('a 404 is not fetched again in the background this session', async () => {
    const s = setup({ gone: { status: 404, bytes: 0 } });
    await s.cache.save('gone');
    s.advance(10 * RATE_LIMIT_COOLDOWN_MS);
    await s.cache.save('gone');
    await s.cache.prefetch(['gone']);
    assert.equal(s.downloads.length, 1);
  });

  it('a 429 pauses background fetches for the cool-down, then they resume', async () => {
    const s = setup({ cat: { status: 429, bytes: 0 } });
    await s.cache.save('cat');
    await s.cache.prefetch(['dog', 'cow']);
    assert.deepEqual(s.downloads, [url('cat')]);
    s.advance(RATE_LIMIT_COOLDOWN_MS);
    await s.cache.prefetch(['dog', 'cow']);
    assert.equal(s.downloads.length, 3);
  });

  it('a 429 halfway through a prefetch stops the rest of it', async () => {
    const s = setup({ b: { status: 429, bytes: 0 } });
    await s.cache.prefetch(['a', 'b', 'c', 'd', 'e', 'f']);
    // 'a' and 'b' start together; 'b' answers 429, so of the rest at most the one
    // already in flight beside it runs.
    assert.ok(s.downloads.length <= 3, String(s.downloads.length));
    assert.equal(s.cache.localUri('f'), null);
  });

  it('a prefetch never has more than two downloads in flight', async () => {
    const s = setup();
    const open = s.hold();
    const done = s.cache.prefetch(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    await new Promise(r => setTimeout(r, 5));
    assert.equal(s.downloads.length, 2);
    open();
    await done;
    assert.equal(s.peak(), 2);
    assert.equal(s.downloads.length, 7);
  });

  it('a prefetch skips what is already saved and repeats in its own list', async () => {
    const s = setup();
    await s.cache.save('a');
    await s.cache.prefetch(['a', 'b', 'b', 'c']);
    assert.deepEqual(s.downloads, [url('a'), url('b'), url('c')]);
  });
});

describe('never rejects', () => {
  it('a file system that throws everywhere is a miss and a no-op', async () => {
    const boom = () => {
      throw new Error('disk gone');
    };
    const fs: FsLike = {
      listDir: boom,
      ensureDir: boom,
      exists: boom,
      size: boom,
      uri: boom,
      remove: boom,
      move: boom,
      download: async () => boom(),
    };
    const cache = createAudioCache({ fs, urlFor: url });
    assert.equal(cache.localUri('cat'), null);
    await cache.save('cat');
    await cache.prefetch(['cat', 'dog']);
  });

  it('a move that fails leaves no clip and resolves', async () => {
    const s = setup();
    s.fs.move = () => {
      throw new Error('rename failed');
    };
    await s.cache.save('cat');
    assert.equal(s.cache.localUri('cat'), null);
    assert.deepEqual([...s.files.keys()], []);
  });
});
