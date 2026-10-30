/**
 * The student's project calls. A fake `apiFetch` records what went out and answers a canned `Response`,
 * so the paths, the bodies and the order of `handIn`'s two calls are pinned without a network.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  makeHomeworkSubmissionApi,
  SubmissionError,
  UPLOAD_TIMEOUT_MS,
} from '../homeworkSubmissionApi.ts';

type Call = { path: string; init?: { method?: string; body?: string; timeoutMs?: number } };

function harness(answer: (call: Call) => { status?: number; body?: unknown; raw?: string }) {
  const calls: Call[] = [];
  const api = makeHomeworkSubmissionApi({
    apiFetch: async (path, init) => {
      const call = { path, init };
      calls.push(call);
      const { status = 200, body, raw } = answer(call);
      return new Response(raw ?? JSON.stringify(body ?? {}), { status });
    },
  });
  return { api, calls };
}

const VIEW = {
  status: 'submitted',
  locked: false,
  note: 'done',
  photos: [{ id: 'p1', url: 'https://x/p1.jpg', mime: 'image/jpeg', sizeBytes: 10 }],
  submittedAt: '2026-10-30T08:00:00.000Z',
};
const GOOD_URL = 'data:image/jpeg;base64,AAAA';

async function rejection(p: Promise<unknown>): Promise<SubmissionError> {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof SubmissionError, 'expected a SubmissionError');
    return e;
  }
  assert.fail('expected a rejection');
}

describe('get', () => {
  it('reads the encoded path and returns a normalized view with the due day', async () => {
    const { api, calls } = harness(() => ({ body: { submission: VIEW, dueDate: '2026-11-02' } }));
    const out = await api.get('h 1');
    assert.equal(calls[0]!.path, '/student/homework/h%201/submission');
    assert.ok(!calls[0]!.init?.method || calls[0]!.init.method === 'GET');
    assert.equal(out.dueDate, '2026-11-02');
    assert.equal(out.submission.status, 'submitted');
    assert.equal(out.submission.photos[0]!.id, 'p1');
  });

  it('normalizes a junk body rather than trusting it', async () => {
    const { api } = harness(() => ({ body: { submission: 'nope' } }));
    const out = await api.get('h1');
    assert.equal(out.submission.status, 'none');
    assert.deepEqual(out.submission.photos, []);
    assert.equal(out.dueDate, '');
  });

  it('throws a SubmissionError with the status on a 404', async () => {
    const { api } = harness(() => ({ status: 404, body: { error: 'Homework not found' } }));
    const e = await rejection(api.get('h1'));
    assert.equal(e.status, 404);
    assert.equal(e.message, 'Homework not found');
    assert.equal(e.code, undefined);
    assert.equal(e.name, 'SubmissionError');
  });
});

describe('uploadPhoto', () => {
  it('posts the data URL with the long timeout and returns the photo and the count', async () => {
    const photo = { id: 'p2', url: 'https://x/p2.jpg', mime: 'image/jpeg', sizeBytes: 3 };
    const { api, calls } = harness(() => ({ status: 201, body: { photo, photoCount: 2 } }));
    const out = await api.uploadPhoto('h1', GOOD_URL);
    assert.equal(calls[0]!.path, '/student/homework/h1/submission/photos');
    assert.equal(calls[0]!.init?.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0]!.init!.body!), { photoDataUrl: GOOD_URL });
    assert.equal(calls[0]!.init?.timeoutMs, UPLOAD_TIMEOUT_MS);
    assert.equal(UPLOAD_TIMEOUT_MS, 45_000);
    assert.equal(out.photoCount, 2);
    assert.equal(out.photo.id, 'p2');
  });

  it('refuses a data URL that fails photoDataUrlOk without calling the network', async () => {
    const { api, calls } = harness(() => ({ body: {} }));
    for (const bad of ['data:image/heic;base64,AAAA', 'https://x/y.jpg', '']) {
      const e = await rejection(api.uploadPhoto('h1', bad));
      assert.equal(e.status, 400);
      assert.equal(e.code, 'unsupported_type');
    }
    assert.equal(calls.length, 0);
  });

  it('carries status and code for each refusal the server sends', async () => {
    const cases: Array<[number, unknown, string | undefined]> = [
      [409, { error: 'x', code: 'photo_limit' }, 'photo_limit'],
      [409, { error: 'x', code: 'locked' }, 'locked'],
      [413, { error: 'x', code: 'file_too_large' }, 'file_too_large'],
      [503, { error: 'x', code: 'storage_unavailable' }, 'storage_unavailable'],
      [429, { error: 'Too many requests' }, undefined],
    ];
    for (const [status, body, code] of cases) {
      const { api } = harness(() => ({ status, body }));
      const e = await rejection(api.uploadPhoto('h1', GOOD_URL));
      assert.equal(e.status, status);
      assert.equal(e.code, code);
    }
  });

  it('leaves code undefined when the error body is not JSON', async () => {
    const { api } = harness(() => ({ status: 502, raw: '<html>bad gateway</html>' }));
    const e = await rejection(api.uploadPhoto('h1', GOOD_URL));
    assert.equal(e.status, 502);
    assert.equal(e.code, undefined);
    assert.ok(e.message.length > 0);
  });

  it('does not accept a 200 whose photo is missing as a saved photo', async () => {
    const { api } = harness(() => ({ status: 201, body: { photoCount: 1 } }));
    const e = await rejection(api.uploadPhoto('h1', GOOD_URL));
    assert.equal(e.status, 201);
  });
});

describe('removePhoto', () => {
  it('sends DELETE to the encoded photo path', async () => {
    const { api, calls } = harness(() => ({ body: { removed: true } }));
    await api.removePhoto('h 1', 'p/1');
    assert.equal(calls[0]!.path, '/student/homework/h%201/submission/photos/p%2F1');
    assert.equal(calls[0]!.init?.method, 'DELETE');
  });

  it('surfaces 409 empty as a SubmissionError', async () => {
    const { api } = harness(() => ({ status: 409, body: { error: 'A handed-in project cannot be emptied', code: 'empty' } }));
    const e = await rejection(api.removePhoto('h1', 'p1'));
    assert.equal(e.status, 409);
    assert.equal(e.code, 'empty');
  });
});

describe('saveNote', () => {
  it('sends PUT with the note and returns the view', async () => {
    const { api, calls } = harness(() => ({ body: { submission: VIEW } }));
    const out = await api.saveNote('h1', 'hello');
    assert.equal(calls[0]!.path, '/student/homework/h1/submission');
    assert.equal(calls[0]!.init?.method, 'PUT');
    assert.deepEqual(JSON.parse(calls[0]!.init!.body!), { note: 'hello' });
    assert.equal(out.note, 'done');
  });
});

describe('submit', () => {
  it('posts to /submit and returns the view', async () => {
    const { api, calls } = harness(() => ({ body: { submission: VIEW } }));
    const out = await api.submit('h1');
    assert.equal(calls[0]!.path, '/student/homework/h1/submission/submit');
    assert.equal(calls[0]!.init?.method, 'POST');
    assert.equal(out.status, 'submitted');
  });
});

describe('handIn', () => {
  it('only submits when the note is unchanged after trimming', async () => {
    const { api, calls } = harness(() => ({ body: { submission: VIEW } }));
    await api.handIn('h1', 'a', 'a ');
    assert.deepEqual(calls.map(c => `${c.init?.method} ${c.path}`), ['POST /student/homework/h1/submission/submit']);
  });

  it('saves a changed note first, then hands in, in that order', async () => {
    const { api, calls } = harness(() => ({ body: { submission: VIEW } }));
    await api.handIn('h1', 'a', 'b');
    assert.deepEqual(calls.map(c => `${c.init?.method} ${c.path}`), [
      'PUT /student/homework/h1/submission',
      'POST /student/homework/h1/submission/submit',
    ]);
    assert.deepEqual(JSON.parse(calls[0]!.init!.body!), { note: 'b' });
  });

  it('does not submit when saving the note failed', async () => {
    const { api, calls } = harness(call =>
      call.init?.method === 'PUT' ? { status: 409, body: { error: 'locked', code: 'locked' } } : { body: { submission: VIEW } },
    );
    const e = await rejection(api.handIn('h1', 'a', 'b'));
    assert.equal(e.code, 'locked');
    assert.deepEqual(calls.map(c => c.init?.method), ['PUT']);
  });
});
