/** A parent's read of their children's projects: `GET /parent/homework/:id/submissions`. A fake `apiFetch` records what went out. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ParentProjectError,
  childrenToShow,
  makeParentProjectApi,
  normalizeChildProjects,
  type ChildProject,
} from '../parentProjectApi.ts';

type Call = { path: string; init?: { method?: string } };

function harness(answer: () => { status?: number; body?: unknown; raw?: string }) {
  const calls: Call[] = [];
  const api = makeParentProjectApi({
    apiFetch: async (path, init) => {
      calls.push({ path, init });
      const { status = 200, body, raw } = answer();
      return new Response(raw ?? JSON.stringify(body ?? {}), { status });
    },
  });
  return { api, calls };
}

async function rejection(p: Promise<unknown>): Promise<ParentProjectError> {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof ParentProjectError, `expected ParentProjectError, got ${String(e)}`);
    return e;
  }
  assert.fail('expected a rejection');
}

const BODY = {
  children: [
    {
      key: 'k1',
      displayName: 'سارة',
      submission: {
        status: 'late',
        locked: true,
        note: 'رسمتُ الخلية',
        photos: [{ id: 'p1', url: 'https://r2.example/p1', mime: 'image/jpeg', sizeBytes: 10 }],
        submittedAt: '2026-11-01T08:00:00.000Z',
        otherAuthor: false,
      },
    },
    { key: 'k2', displayName: 'عمر', submission: { status: 'none', locked: false, note: '', photos: [], submittedAt: null } },
  ],
};

describe('get', () => {
  it('GETs the parent route with the id encoded, and nothing else', async () => {
    const { api, calls } = harness(() => ({ body: BODY }));
    await api.get('h 1');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.path, '/parent/homework/h%201/submissions');
    assert.equal(calls[0]!.init?.method, undefined);
  });

  it('normalizes each child and their project', async () => {
    const { api } = harness(() => ({ body: BODY }));
    const out = await api.get('h1');
    assert.equal(out.length, 2);
    assert.equal(out[0]!.key, 'k1');
    assert.equal(out[0]!.displayName, 'سارة');
    assert.equal(out[0]!.submission.status, 'late');
    assert.equal(out[0]!.submission.note, 'رسمتُ الخلية');
    assert.deepEqual(out[0]!.submission.photos.map(p => p.id), ['p1']);
    assert.equal(out[1]!.submission.status, 'none');
  });

  it('a 404 throws with its status and code, so the screen says «no longer available»', async () => {
    const { api } = harness(() => ({ status: 404, body: { error: 'Homework not found', code: 'not_found' } }));
    const e = await rejection(api.get('h1'));
    assert.equal(e.status, 404);
    assert.equal(e.code, 'not_found');
  });

  it('a non-JSON error still throws with its status', async () => {
    const { api } = harness(() => ({ status: 502, raw: '<html>bad gateway</html>' }));
    assert.equal((await rejection(api.get('h1'))).status, 502);
  });

  it('a 2xx that is not a list of children throws, never reads as «nobody handed in»', async () => {
    for (const raw of ['<html>proxy</html>', '{}', '{"children":"x"}', 'null']) {
      const { api } = harness(() => ({ raw }));
      assert.equal((await rejection(api.get('h1'))).message, 'Unexpected response', raw);
    }
  });
});

describe('normalizeChildProjects', () => {
  it('drops an entry with no key or no submission object instead of showing it blank', () => {
    const out = normalizeChildProjects({
      children: [
        { key: '', displayName: 'a', submission: {} },
        { displayName: 'b', submission: {} },
        { key: 'c', displayName: 'c' },
        { key: 'd', displayName: 'd', submission: 'x' },
        'nonsense',
        { key: 'e', submission: { status: 'submitted' } },
      ],
    });
    assert.deepEqual(out?.map(c => c.key), ['e']);
    assert.equal(out?.[0]!.displayName, '');
  });

  it('an empty list is an answer (no child of this account in the class), not a failure', () => {
    assert.deepEqual(normalizeChildProjects({ children: [] }), []);
  });
});

describe('childrenToShow', () => {
  const kids: ChildProject[] = (normalizeChildProjects(BODY) ?? []);

  it('shows only the child «المدرسة» opened it for', () => {
    assert.deepEqual(childrenToShow(kids, 'k2').map(c => c.key), ['k2']);
  });

  it('shows every child for no key, or a key that matches nobody — never an empty screen', () => {
    assert.deepEqual(childrenToShow(kids, null).map(c => c.key), ['k1', 'k2']);
    assert.deepEqual(childrenToShow(kids, '').map(c => c.key), ['k1', 'k2']);
    assert.deepEqual(childrenToShow(kids, 'gone').map(c => c.key), ['k1', 'k2']);
  });
});
