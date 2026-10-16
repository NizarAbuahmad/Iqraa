import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { quranAudioAyahs, quranAudioKey } from '../quranAudio.ts';
import {
  MIN_AUDIO_BYTES,
  QURAN_AUDIO_SOURCE_BASE,
  StorageAuthError,
  checkDownload,
  looksLikeMp3,
  mergeManifest,
  parseOnly,
  runUpload,
  selectTodo,
  sourceUrl,
  type ManifestEntry,
  type RunDeps,
} from '../../scripts/quranAudioUpload.ts';

const A = (surah: number, ayah: number) => ({ surah, ayah });
const mp3 = (n = MIN_AUDIO_BYTES + 100): Uint8Array => {
  const b = new Uint8Array(n);
  b[0] = 0xff;
  b[1] = 0xfb;
  return b;
};
const good = (bytes = mp3()) => ({ status: 200, contentType: 'audio/mpeg', bytes });

function fakeDeps(over: Partial<RunDeps> = {}) {
  const fetched: string[] = [];
  const put: string[] = [];
  const logs: string[] = [];
  const deps: RunDeps = {
    fetchAudio: async url => {
      fetched.push(url);
      return good();
    },
    put: async key => {
      put.push(key);
    },
    now: () => new Date('2026-10-16T00:00:00Z'),
    log: l => logs.push(l),
    ...over,
  };
  return { deps, fetched, put, logs };
}

describe('sourceUrl', () => {
  it('uses the source’s own SSSAAA.mp3 names', () => {
    assert.equal(sourceUrl(A(1, 1)), `${QURAN_AUDIO_SOURCE_BASE}/001001.mp3`);
    assert.equal(sourceUrl(A(2, 255)), `${QURAN_AUDIO_SOURCE_BASE}/002255.mp3`);
  });
});

describe('looksLikeMp3', () => {
  it('accepts an ID3 tag and an MPEG frame sync', () => {
    assert.equal(looksLikeMp3(Uint8Array.from([0x49, 0x44, 0x33, 4])), true);
    assert.equal(looksLikeMp3(Uint8Array.from([0xff, 0xfb, 0x90])), true);
  });
  it('rejects HTML, empty and too-short bodies', () => {
    assert.equal(looksLikeMp3(new TextEncoder().encode('<!doctype html>')), false);
    assert.equal(looksLikeMp3(new Uint8Array(0)), false);
    assert.equal(looksLikeMp3(Uint8Array.from([0xff, 0xfb])), false);
  });
});

describe('checkDownload', () => {
  it('passes a real-looking MP3', () => {
    assert.equal(checkDownload(good()), null);
    assert.equal(checkDownload({ ...good(), contentType: 'application/octet-stream' }), null);
    assert.equal(checkDownload({ ...good(), contentType: null }), null);
  });
  it('names the reason for each failure', () => {
    assert.equal(checkDownload({ ...good(), status: 404 }), 'HTTP 404');
    assert.match(checkDownload({ ...good(), contentType: 'text/html' }) ?? '', /^not audio/);
    assert.match(checkDownload({ ...good(mp3(10)) }) ?? '', /^too small/);
    const notMp3 = new Uint8Array(MIN_AUDIO_BYTES + 1);
    assert.equal(checkDownload({ ...good(notMp3) }), 'does not start like an MP3');
  });
});

describe('parseOnly', () => {
  const list = quranAudioAyahs();
  const first = list[0]!;
  const last = list[list.length - 1]!;

  it('is null when --only is absent', () => {
    assert.equal(parseOnly(undefined), null);
  });
  it('reads surah:ayah pairs the corner holds', () => {
    assert.deepEqual(parseOnly(`${first.surah}:${first.ayah},${last.surah}:${last.ayah}`), [first, last]);
  });
  it('throws on a malformed or unknown reference, so a typo never silently redoes nothing', () => {
    assert.throws(() => parseOnly('abc'));
    assert.throws(() => parseOnly('1'));
    assert.throws(() => parseOnly('1:99'));
    assert.throws(() => parseOnly(''));
  });
});

describe('selectTodo', () => {
  const all = quranAudioAyahs();
  const first = all[0]!;
  const existing = new Set([quranAudioKey(first.surah, first.ayah)]);

  it('does only what is missing', () => {
    const todo = selectTodo(all, existing, { force: false, only: null });
    assert.equal(todo.length, all.length - 1);
    assert.ok(!todo.some(a => a.surah === first.surah && a.ayah === first.ayah));
  });
  it('--force redoes everything', () => {
    assert.equal(selectTodo(all, existing, { force: true, only: null }).length, all.length);
  });
  it('--only redoes exactly those, even if they already exist', () => {
    assert.deepEqual(selectTodo(all, existing, { force: false, only: [first] }), [first]);
  });
});

describe('runUpload', () => {
  const todo = [A(1, 1), A(1, 2), A(1, 3)];

  it('fetches from the source, stores under the shared key and records a manifest entry', async () => {
    const { deps, fetched, put } = fakeDeps();
    const r = await runUpload(todo, deps, { concurrency: 1 });
    assert.deepEqual(put, todo.map(a => quranAudioKey(a.surah, a.ayah)));
    assert.deepEqual(fetched, todo.map(sourceUrl));
    assert.equal(r.uploaded.length, 3);
    assert.equal(r.rejected.length, 0);
    assert.equal(r.aborted, null);
    const e = r.uploaded[0]!;
    assert.equal(e.key, quranAudioKey(1, 1));
    assert.equal(e.bytes, MIN_AUDIO_BYTES + 100);
    assert.match(e.sha256, /^[0-9a-f]{64}$/);
    assert.equal(e.sourceUrl, sourceUrl(A(1, 1)));
    assert.equal(e.fetchedAt, '2026-10-16T00:00:00.000Z');
  });

  it('never stores a rejected download and exits the report with the reason', async () => {
    const html = { status: 200, contentType: 'text/html', bytes: new TextEncoder().encode('<html>') };
    let n = 0;
    const { deps, put } = fakeDeps({ fetchAudio: async () => (++n === 2 ? html : good()) });
    const r = await runUpload(todo, deps, { concurrency: 1 });
    assert.equal(put.length, 2);
    assert.ok(!put.includes(quranAudioKey(1, 2)));
    assert.deepEqual(r.rejected.map(x => x.key), [quranAudioKey(1, 2)]);
    assert.match(r.rejected[0]!.reason, /^not audio/);
  });

  it('rejects a body that is too small', async () => {
    const { deps, put } = fakeDeps({ fetchAudio: async () => good(mp3(10)) });
    const r = await runUpload([A(1, 1)], deps, { concurrency: 1 });
    assert.equal(put.length, 0);
    assert.match(r.rejected[0]!.reason, /^too small/);
  });

  it('turns a thrown fetch into a rejection and carries on', async () => {
    let n = 0;
    const { deps } = fakeDeps({
      fetchAudio: async () => {
        if (++n === 1) throw new Error('socket hang up');
        return good();
      },
    });
    const r = await runUpload(todo, deps, { concurrency: 1 });
    assert.equal(r.uploaded.length, 2);
    assert.match(r.rejected[0]!.reason, /socket hang up/);
  });

  it('stops at the first storage auth refusal and fetches nothing more', async () => {
    const { deps, fetched } = fakeDeps({
      put: async () => {
        throw new StorageAuthError('403 from iqraa-public');
      },
    });
    const r = await runUpload(todo, deps, { concurrency: 1 });
    assert.equal(r.aborted, '403 from iqraa-public');
    assert.equal(fetched.length, 1);
    assert.equal(r.uploaded.length, 0);
  });

  it('calls onUploaded once per successful upload, in order, with the entry that lands in the report', async () => {
    const html = { status: 200, contentType: 'text/html', bytes: new TextEncoder().encode('<html>') };
    let n = 0;
    const seen: ManifestEntry[] = [];
    const { deps } = fakeDeps({
      fetchAudio: async () => (++n === 2 ? html : good()),
      onUploaded: e => {
        seen.push(e);
      },
    });
    const r = await runUpload(todo, deps, { concurrency: 1 });
    assert.deepEqual(seen.map(e => e.key), [quranAudioKey(1, 1), quranAudioKey(1, 3)]);
    assert.deepEqual(seen, r.uploaded);
  });

  it('aborts when onUploaded throws, and fetches nothing more', async () => {
    const { deps, fetched, put } = fakeDeps({
      onUploaded: () => {
        throw new Error('disk full');
      },
    });
    const r = await runUpload(todo, deps, { concurrency: 1 });
    assert.match(r.aborted ?? '', /^manifest write failed: disk full/);
    assert.equal(fetched.length, 1);
    assert.equal(put.length, 1);
  });

  it('--dry-run neither fetches nor stores', async () => {
    const { deps, fetched, put } = fakeDeps();
    const r = await runUpload(todo, deps, { dryRun: true });
    assert.equal(fetched.length, 0);
    assert.equal(put.length, 0);
    assert.equal(r.planned, 3);
    assert.equal(r.uploaded.length, 0);
  });
});

describe('mergeManifest', () => {
  const entry = (key: string, bytes: number): ManifestEntry => ({
    surah: 1, ayah: 1, key, bytes, sha256: 'x', sourceUrl: 'u', fetchedAt: 't',
  });
  it('lets a fresh entry replace an old one, and sorts by key', () => {
    const merged = mergeManifest([entry('b', 1), entry('a', 1)], [entry('b', 2)]);
    assert.deepEqual(merged.map(e => [e.key, e.bytes]), [['a', 1], ['b', 2]]);
  });
});
