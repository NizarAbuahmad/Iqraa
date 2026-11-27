/**
 * The exam screen's autosave, as a queue.
 *
 * It used to be one PUT per keystroke with nothing in between: thirty
 * students typing through a per-classroom rate limit, and no ordering, so a
 * slow early request could land after a later one and leave a truncated
 * answer on the server. Every assertion below is one of those two failures.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createSaveQueue, isRetryableSaveError, mergeUnsavedAnswers } from '../answerSaveQueue.ts';

/** Manual timers, so a test decides when the debounce fires. */
function fakeTimers() {
  const pending = new Map<number, () => void>();
  let next = 1;
  return {
    setTimeout: (fn: () => void, _ms: number) => {
      const id = next++;
      pending.set(id, fn);
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: (id: ReturnType<typeof setTimeout>) => {
      pending.delete(id as unknown as number);
    },
    fire() {
      const fns = [...pending.values()];
      pending.clear();
      fns.forEach(fn => fn());
    },
    get count() {
      return pending.size;
    },
  };
}

/** A save that resolves only when the test says so. */
function controlledSave() {
  const calls: { id: string; response: Record<string, unknown>; resolve: () => void; reject: () => void }[] = [];
  const save = (id: string, response: Record<string, unknown>) =>
    new Promise<void>((resolve, reject) => {
      calls.push({ id, response, resolve, reject: () => reject(new Error('net')) });
    });
  return { save, calls };
}

const tick = () => new Promise<void>(r => setImmediate(r));

describe('createSaveQueue', () => {
  it('debounces keystrokes into one request carrying the last value', async () => {
    const timers = fakeTimers();
    const { save, calls } = controlledSave();
    const q = createSaveQueue({ save, delayMs: 500, timers });

    q.set('q1', { text: 'a' });
    q.set('q1', { text: 'ab' });
    q.set('q1', { text: 'abc' });
    assert.equal(calls.length, 0);
    assert.equal(timers.count, 1);

    timers.fire();
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.response, { text: 'abc' });
  });

  it('saves a tap at once when asked to', () => {
    const timers = fakeTimers();
    const { save, calls } = controlledSave();
    const q = createSaveQueue({ save, delayMs: 500, timers });
    q.set('q1', { optionIds: ['b'] }, { immediate: true });
    assert.equal(calls.length, 1);
    assert.equal(timers.count, 0);
  });

  it('never has two requests in flight for one question, and the later value wins', async () => {
    const timers = fakeTimers();
    const { save, calls } = controlledSave();
    const q = createSaveQueue({ save, delayMs: 500, timers });

    q.set('q1', { text: 'first' }, { immediate: true });
    assert.equal(calls.length, 1);
    q.set('q1', { text: 'second' }, { immediate: true });
    // In flight: the second value waits rather than racing the first.
    assert.equal(calls.length, 1);

    calls[0]!.resolve();
    await tick();
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1]!.response, { text: 'second' });
    calls[1]!.resolve();
    await tick();
    assert.deepEqual(q.state(), { pending: [], failed: [] });
  });

  it('reports a failed save and keeps the value for retry', async () => {
    const timers = fakeTimers();
    const { save, calls } = controlledSave();
    const seen: { pending: string[]; failed: string[] }[] = [];
    const q = createSaveQueue({ save, delayMs: 500, timers, onChange: s => seen.push(s) });

    q.set('q1', { text: 'x' }, { immediate: true });
    calls[0]!.reject();
    await tick();
    assert.deepEqual(q.state(), { pending: ['q1'], failed: ['q1'] });

    const ok = q.flush();
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1]!.response, { text: 'x' });
    calls[1]!.resolve();
    assert.equal(await ok, true);
    assert.deepEqual(q.state(), { pending: [], failed: [] });
    assert.ok(seen.length >= 2);
  });

  it('flush sends everything still debouncing and reports false if any save fails', async () => {
    const timers = fakeTimers();
    const { save, calls } = controlledSave();
    const q = createSaveQueue({ save, delayMs: 500, timers });

    q.set('q1', { text: 'one' });
    q.set('q2', { text: 'two' });
    assert.equal(calls.length, 0);
    const done = q.flush();
    assert.equal(timers.count, 0);
    assert.equal(calls.length, 2);
    calls[0]!.resolve();
    calls[1]!.reject();
    assert.equal(await done, false);
    assert.deepEqual(q.state().failed, ['q2']);
  });

  it('flush waits for a request already in flight', async () => {
    const timers = fakeTimers();
    const { save, calls } = controlledSave();
    const q = createSaveQueue({ save, delayMs: 500, timers });
    q.set('q1', { text: 'x' }, { immediate: true });
    let settled = false;
    const done = q.flush().then(ok => { settled = true; return ok; });
    await tick();
    assert.equal(settled, false);
    calls[0]!.resolve();
    assert.equal(await done, true);
  });
});

describe('mergeUnsavedAnswers', () => {
  it('restores an answer the server never got and marks it for resending', () => {
    const server = { q1: { choice: 'a' } };
    const local = { q1: { choice: 'a' }, q2: { text: 'كتبتها قبل انقطاع الشبكة' } };
    const { answers, resend } = mergeUnsavedAnswers(server, local);
    assert.deepEqual(answers, { q1: { choice: 'a' }, q2: { text: 'كتبتها قبل انقطاع الشبكة' } });
    assert.deepEqual(resend, ['q2']);
  });

  it('prefers the newer local answer over a stale server one', () => {
    const { answers, resend } = mergeUnsavedAnswers({ q1: { text: 'نصف' } }, { q1: { text: 'نصف الجواب كاملًا' } });
    assert.deepEqual(answers.q1, { text: 'نصف الجواب كاملًا' });
    assert.deepEqual(resend, ['q1']);
  });

  it('resends nothing when nothing was kept', () => {
    assert.deepEqual(mergeUnsavedAnswers({ q1: { choice: 'b' } }, {}).resend, []);
  });
});

describe('createSaveQueue: automatic retry', () => {
  /** Timers that remember their delay, so backoff can be read off. */
  function delayTimers() {
    const pending = new Map<number, { fn: () => void; ms: number }>();
    let next = 1;
    return {
      setTimeout: (fn: () => void, ms: number) => {
        const id = next++;
        pending.set(id, { fn, ms });
        return id as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout: (id: ReturnType<typeof setTimeout>) => {
        pending.delete(id as unknown as number);
      },
      fireAll() {
        const all = [...pending.values()];
        pending.clear();
        all.forEach(x => x.fn());
      },
      delays: () => [...pending.values()].map(x => x.ms),
      get count() {
        return pending.size;
      },
    };
  }
  const noJitter = { random: () => 0.5 }; // jitter factor 1.0

  it('retries a failed save on its own, backing off and capping', async () => {
    const timers = delayTimers();
    const { save, calls } = controlledSave();
    const q = createSaveQueue({ save, delayMs: 500, timers, retry: { baseMs: 2000, maxMs: 30000, ...noJitter } });
    q.set('q1', { text: 'a' }, { immediate: true });
    const seen: number[] = [];
    for (let i = 0; i < 7; i++) {
      calls[i].reject();
      await tick();
      assert.deepEqual(q.state().failed, ['q1']);
      seen.push(timers.delays()[0]);
      timers.fireAll();
      assert.equal(calls.length, i + 2);
    }
    assert.deepEqual(seen, [2000, 4000, 8000, 16000, 30000, 30000, 30000]);
    calls[7].resolve();
    await tick();
    assert.deepEqual(q.state(), { pending: [], failed: [] });
    assert.equal(timers.count, 0);
  });

  it('adds jitter within the band and never past the cap', async () => {
    const timers = delayTimers();
    const { save, calls } = controlledSave();
    const q = createSaveQueue({ save, delayMs: 500, timers, retry: { baseMs: 2000, maxMs: 30000, random: () => 1 } });
    q.set('q1', { text: 'a' }, { immediate: true });
    calls[0].reject();
    await tick();
    assert.equal(timers.delays()[0], 2400);
    q.dispose();
  });

  it('does not retry an error that can never succeed', async () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      const timers = delayTimers();
      const q = createSaveQueue({
        save: async () => { throw Object.assign(new Error('no'), { status }); },
        delayMs: 500,
        timers,
      });
      q.set('q1', { text: 'a' }, { immediate: true });
      await tick();
      assert.deepEqual(q.state().failed, ['q1'], `status ${status}`);
      assert.equal(timers.count, 0, `status ${status} must not schedule a retry`);
    }
  });

  it('retries 408, 429, 5xx and errors with no status', async () => {
    for (const err of [{ status: 408 }, { status: 429 }, { status: 503 }, {}]) {
      const timers = delayTimers();
      const q = createSaveQueue({
        save: async () => { throw Object.assign(new Error('x'), err); },
        delayMs: 500,
        timers,
      });
      q.set('q1', { text: 'a' }, { immediate: true });
      await tick();
      assert.equal(timers.count, 1, JSON.stringify(err));
      q.dispose();
    }
  });

  it('sends the latest value when the retry fires, and one request at a time', async () => {
    const timers = delayTimers();
    const { save, calls } = controlledSave();
    const q = createSaveQueue({ save, delayMs: 500, timers, retry: { baseMs: 2000, maxMs: 30000, ...noJitter } });
    q.set('q1', { text: 'a' }, { immediate: true });
    calls[0].reject();
    await tick();
    q.set('q1', { text: 'ab' }); // debounced; supersedes the retry timer
    timers.fireAll(); // debounce fires -> one request
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].response, { text: 'ab' });
    timers.fireAll();
    assert.equal(calls.length, 2);
    calls[1].resolve();
    await tick();
    assert.deepEqual(q.state(), { pending: [], failed: [] });
  });

  it('a retry timer that fires while the question is in flight does not double-send', async () => {
    const timers = delayTimers();
    const { save, calls } = controlledSave();
    const q = createSaveQueue({ save, delayMs: 500, timers, retry: { baseMs: 2000, maxMs: 30000, ...noJitter } });
    q.set('q1', { text: 'a' }, { immediate: true });
    calls[0].reject();
    await tick();
    void q.flush(); // manual retry puts a request on the wire
    assert.equal(calls.length, 2);
    timers.fireAll();
    assert.equal(calls.length, 2);
    calls[1].resolve();
    await tick();
  });

  it('retryNow resends failed questions at once and skips non-retryable ones', async () => {
    const timers = delayTimers();
    const sent: string[] = [];
    const q = createSaveQueue({
      save: async id => {
        sent.push(id);
        if (sent.length <= 2) throw Object.assign(new Error('x'), { status: id === 'q1' ? 503 : 409 });
      },
      delayMs: 500,
      timers,
    });
    q.set('q1', { text: 'a' }, { immediate: true });
    q.set('q2', { text: 'b' }, { immediate: true });
    await tick();
    assert.deepEqual(q.state().failed.sort(), ['q1', 'q2']);
    q.retryNow();
    await tick();
    assert.deepEqual(sent, ['q1', 'q2', 'q1']);
    assert.deepEqual(q.state().failed, ['q2']);
  });

  it('dispose cancels every retry timer and nothing is sent after it', async () => {
    const timers = delayTimers();
    const { save, calls } = controlledSave();
    const q = createSaveQueue({ save, delayMs: 500, timers });
    q.set('q1', { text: 'a' }, { immediate: true });
    calls[0].reject();
    await tick();
    assert.equal(timers.count, 1);
    q.dispose();
    assert.equal(timers.count, 0);
    q.retryNow();
    timers.fireAll();
    assert.equal(calls.length, 1);
  });

  it('a failure arriving after dispose schedules nothing', async () => {
    const timers = delayTimers();
    const { save, calls } = controlledSave();
    const q = createSaveQueue({ save, delayMs: 500, timers });
    q.set('q1', { text: 'a' }, { immediate: true });
    q.dispose();
    calls[0].reject();
    await tick();
    assert.equal(timers.count, 0);
  });
});

describe('isRetryableSaveError', () => {
  it('follows the status', () => {
    assert.equal(isRetryableSaveError(new Error('offline')), true);
    assert.equal(isRetryableSaveError({ status: 500 }), true);
    assert.equal(isRetryableSaveError({ status: 408 }), true);
    assert.equal(isRetryableSaveError({ status: 429 }), true);
    assert.equal(isRetryableSaveError({ status: 409, code: 'time_up' }), false);
    assert.equal(isRetryableSaveError({ status: 403 }), false);
    assert.equal(isRetryableSaveError({ status: 401 }), false);
    assert.equal(isRetryableSaveError(null), true);
  });
});
