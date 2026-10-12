/**
 * What this guards: every screen that shows or edits memorisation progress
 * shares ONE store, so a rating made on one screen is on the others without a
 * remount; a rating can never be written before the person's saved marks have
 * been read (it would replace them with a one-mark blob); and a late read for a
 * previous person can never land on, or be saved under, the next person's key.
 * Surah/ayah numbers below are placeholders.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createProgressStore, type KeyValueStorage } from '../quranProgressStore.ts';
import { quranProgressKey, type QuranProgress } from '../quranProgress.ts';

const TODAY = '2026-01-02';

interface PendingRead {
  key: string;
  resolve: (raw: string | null) => void;
  reject: (e: unknown) => void;
}

/** A storage whose reads resolve only when the test releases them, so ordering is deterministic. */
function fakeStorage(opts: { failWrites?: boolean } = {}) {
  const reads: PendingRead[] = [];
  const writes: { key: string; value: string }[] = [];
  const storage: KeyValueStorage = {
    getItem(key) {
      return new Promise<string | null>((resolve, reject) => reads.push({ key, resolve, reject }));
    },
    setItem(key, value) {
      writes.push({ key, value });
      return opts.failWrites ? Promise.reject(new Error('quota')) : Promise.resolve();
    },
  };
  return { storage, reads, writes };
}

/** Let promise continuations run. */
const flush = () => new Promise<void>(r => setImmediate(r));

const blob = (p: QuranProgress) => JSON.stringify(p);
const mark = (status: 'learning' | 'memorised', at = '2025-12-31') => ({ status, at });

function setup(opts?: { failWrites?: boolean }) {
  const fake = fakeStorage(opts);
  const store = createProgressStore(fake.storage, () => TODAY);
  let notified = 0;
  store.subscribe(() => notified++);
  return { ...fake, store, notifications: () => notified };
}

describe('select', () => {
  it('is not loaded until the read lands, then holds the parsed marks, notifying on each change', async () => {
    const { store, reads, notifications } = setup();
    const key = quranProgressKey('A');

    store.select('A');
    assert.deepEqual(store.getSnapshot(), { forKey: key, progress: {}, loaded: false });
    assert.equal(notifications(), 1);
    assert.equal(reads.length, 1);
    assert.equal(reads[0].key, key);

    reads[0].resolve(blob({ '1': { '2': mark('memorised') } }));
    await flush();

    const snap = store.getSnapshot();
    assert.equal(snap.forKey, key);
    assert.equal(snap.loaded, true);
    assert.deepEqual(snap.progress, { '1': { '2': mark('memorised') } });
    assert.equal(notifications(), 2);
  });

  it('selecting the same person twice reads once', async () => {
    const { store, reads, notifications } = setup();
    store.select('A');
    store.select('A');
    assert.equal(reads.length, 1);
    assert.equal(notifications(), 1);

    reads[0].resolve(null);
    await flush();
    store.select('A');
    assert.equal(reads.length, 1);
    assert.equal(notifications(), 2);
  });

  it('undefined (session still restoring): nothing is read, nothing is saved; null then reads the bare key', async () => {
    const { store, reads, writes } = setup();
    store.select(undefined);
    assert.deepEqual(store.getSnapshot(), { forKey: null, progress: {}, loaded: false });
    assert.equal(reads.length, 0);

    store.rate(1, 1, 'learning');
    assert.equal(writes.length, 0);
    assert.deepEqual(store.getSnapshot().progress, {});

    store.select(null);
    assert.equal(reads.length, 1);
    assert.equal(reads[0].key, quranProgressKey(null));
    assert.equal(store.getSnapshot().forKey, quranProgressKey(null));
    assert.equal(store.getSnapshot().loaded, false);

    reads[0].resolve(null);
    await flush();
    assert.equal(store.getSnapshot().loaded, true);
  });

  it('a rejected read counts as loaded and empty', async () => {
    const { store, reads, writes } = setup();
    store.select('A');
    reads[0].reject(new Error('blocked'));
    await flush();

    const snap = store.getSnapshot();
    assert.equal(snap.loaded, true);
    assert.deepEqual(snap.progress, {});

    store.rate(3, 4, 'learning');
    assert.equal(writes.length, 1);
    assert.deepEqual(store.getSnapshot().progress, { '3': { '4': mark('learning', TODAY) } });
  });
});

describe('rate', () => {
  it('is ignored before the read lands: nothing written, and the saved marks survive the read intact', async () => {
    const { store, reads, writes } = setup();
    store.select('A');
    store.rate(5, 6, 'memorised');
    assert.equal(writes.length, 0);
    assert.deepEqual(store.getSnapshot().progress, {});

    const saved: QuranProgress = { '1': { '1': mark('memorised'), '2': mark('learning') } };
    reads[0].resolve(blob(saved));
    await flush();

    assert.deepEqual(store.getSnapshot().progress, saved);
    assert.equal(writes.length, 0);
  });

  it('after the read: updates the snapshot, writes the FULL merged blob once, and a second subscriber sees it with no re-read', async () => {
    const { store, reads, writes } = setup();
    const key = quranProgressKey('A');
    store.select('A');
    reads[0].resolve(blob({ '1': { '1': mark('memorised') } }));
    await flush();

    let secondScreenSaw: QuranProgress | null = null;
    store.subscribe(() => {
      secondScreenSaw = store.getSnapshot().progress;
    });

    store.rate(2, 3, 'learning');

    const expected: QuranProgress = {
      '1': { '1': mark('memorised') },
      '2': { '3': mark('learning', TODAY) },
    };
    assert.deepEqual(store.getSnapshot().progress, expected);
    assert.equal(store.getSnapshot().loaded, true);
    assert.deepEqual(secondScreenSaw, expected);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].key, key);
    assert.deepEqual(JSON.parse(writes[0].value), expected);
    assert.equal(reads.length, 1);
  });

  it('two quick ratings compose: the second write contains the first', async () => {
    const { store, reads, writes } = setup();
    store.select('A');
    reads[0].resolve(null);
    await flush();

    store.rate(1, 1, 'learning');
    store.rate(1, 2, 'memorised');
    assert.equal(writes.length, 2);
    assert.deepEqual(JSON.parse(writes[1].value), {
      '1': { '1': mark('learning', TODAY), '2': mark('memorised', TODAY) },
    });
  });

  it('a rejected write neither throws nor leaves an unhandled rejection', async () => {
    const { store, reads, writes } = setup({ failWrites: true });
    store.select('A');
    reads[0].resolve(null);
    await flush();

    assert.doesNotThrow(() => store.rate(1, 1, 'memorised'));
    await flush();
    assert.equal(writes.length, 1);
    assert.deepEqual(store.getSnapshot().progress, { '1': { '1': mark('memorised', TODAY) } });
  });

  it('is a stable closure: it works detached from the store object', async () => {
    const { store, reads, writes } = setup();
    const { rate } = store;
    store.select('A');
    reads[0].resolve(null);
    await flush();
    rate(1, 1, 'learning');
    assert.equal(writes.length, 1);
  });
});

describe('switching person', () => {
  it('A -> B: snapshot resets at once, A\'s late read is ignored, rate waits for B\'s read, and only B\'s data is written under B\'s key', async () => {
    const { store, reads, writes } = setup();
    const keyA = quranProgressKey('A');
    const keyB = quranProgressKey('B');

    store.select('A');
    store.select('B');
    assert.deepEqual(store.getSnapshot(), { forKey: keyB, progress: {}, loaded: false });
    assert.equal(reads.length, 2);
    assert.equal(reads[0].key, keyA);
    assert.equal(reads[1].key, keyB);

    // A's read lands late, after the switch.
    reads[0].resolve(blob({ '9': { '9': mark('memorised') } }));
    await flush();
    assert.deepEqual(store.getSnapshot(), { forKey: keyB, progress: {}, loaded: false });

    // B has not been read yet: a tap is ignored.
    store.rate(1, 1, 'learning');
    assert.equal(writes.length, 0);

    reads[1].resolve(blob({ '2': { '2': mark('learning') } }));
    await flush();
    assert.deepEqual(store.getSnapshot().progress, { '2': { '2': mark('learning') } });

    store.rate(3, 3, 'memorised');
    assert.equal(writes.length, 1);
    assert.equal(writes[0].key, keyB);
    assert.deepEqual(JSON.parse(writes[0].value), {
      '2': { '2': mark('learning') },
      '3': { '3': mark('memorised', TODAY) },
    });
    // A's marks were never written, anywhere.
    assert.ok(!writes.some(w => w.value.includes('"9"')));
  });

  it('A loaded, then B selected: A\'s marks are gone from the snapshot immediately', async () => {
    const { store, reads } = setup();
    store.select('A');
    reads[0].resolve(blob({ '1': { '1': mark('memorised') } }));
    await flush();
    assert.equal(store.getSnapshot().loaded, true);

    store.select('B');
    assert.deepEqual(store.getSnapshot(), { forKey: quranProgressKey('B'), progress: {}, loaded: false });
  });

  it('switching back to A reads A again (the marks are not cached across a switch)', async () => {
    const { store, reads } = setup();
    store.select('A');
    store.select('B');
    store.select('A');
    assert.equal(reads.length, 3);

    // The first A read is stale (generation changed twice); only the last counts.
    reads[0].resolve(blob({ '1': { '1': mark('learning') } }));
    await flush();
    assert.equal(store.getSnapshot().loaded, false);

    reads[2].resolve(blob({ '4': { '4': mark('memorised') } }));
    await flush();
    assert.deepEqual(store.getSnapshot().progress, { '4': { '4': mark('memorised') } });
  });
});

describe('snapshot and subscribe', () => {
  it('getSnapshot returns the identical object until something changes', async () => {
    const { store, reads } = setup();
    assert.equal(store.getSnapshot(), store.getSnapshot());

    store.select('A');
    const a = store.getSnapshot();
    assert.equal(store.getSnapshot(), a);
    store.select('A');
    assert.equal(store.getSnapshot(), a);

    reads[0].resolve(null);
    await flush();
    const b = store.getSnapshot();
    assert.notEqual(b, a);
    assert.equal(store.getSnapshot(), b);

    store.rate(1, 1, 'learning');
    assert.notEqual(store.getSnapshot(), b);
  });

  it('unsubscribe stops notifications, and unsubscribing twice is harmless', () => {
    const fake = fakeStorage();
    const store = createProgressStore(fake.storage, () => TODAY);
    let n = 0;
    const off = store.subscribe(() => n++);
    store.select('A');
    assert.equal(n, 1);

    off();
    off();
    store.select('B');
    assert.equal(n, 1);
  });

  it('a listener removed during a notification does not break iteration', () => {
    const fake = fakeStorage();
    const store = createProgressStore(fake.storage, () => TODAY);
    const calls: string[] = [];
    let offSecond: () => void = () => {};
    store.subscribe(() => {
      calls.push('first');
      offSecond();
    });
    offSecond = store.subscribe(() => calls.push('second'));
    const offThird = store.subscribe(() => calls.push('third'));

    assert.doesNotThrow(() => store.select('A'));
    assert.ok(calls.includes('first'));
    assert.ok(calls.includes('third'));
    assert.ok(!calls.includes('second'), 'a listener removed mid-notification is not called');
    offThird();
  });
});
