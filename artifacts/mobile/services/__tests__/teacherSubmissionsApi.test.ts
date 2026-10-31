/** The teacher's three calls over `/homework/:id/submissions`. A fake `apiFetch` records what went out. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeTeacherSubmissionsApi, TeacherSubmissionsError } from '../teacherSubmissionsApi.ts';

type Call = { path: string; init?: { method?: string; body?: string; timeoutMs?: number } };

function harness(answer: (call: Call) => { status?: number; body?: unknown; raw?: string }) {
  const calls: Call[] = [];
  const api = makeTeacherSubmissionsApi({
    apiFetch: async (path, init) => {
      const call = { path, init };
      calls.push(call);
      const { status = 200, body, raw } = answer(call);
      return new Response(raw ?? JSON.stringify(body ?? {}), { status });
    },
  });
  return { api, calls };
}

async function rejection(p: Promise<unknown>): Promise<TeacherSubmissionsError> {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof TeacherSubmissionsError, `expected TeacherSubmissionsError, got ${String(e)}`);
    return e;
  }
  assert.fail('expected a rejection');
}

const LIST = {
  homework: { id: 'h 1', title: 'مشروع', dueDate: '2026-10-31' },
  submittedCount: 1,
  trackableCount: 7,
  submissions: [{ studentId: 's1', displayName: 'سارة', hasAccount: false, status: 'late', submittedAt: '2026-11-01T08:00:00.000Z', photoCount: 3 }],
};
const DETAIL = {
  student: { id: 's 1', displayName: 'سارة' },
  submission: { status: 'submitted', locked: false, note: 'n', photos: [], submittedAt: '2026-10-30T08:00:00.000Z' },
};

describe('list', () => {
  it('GETs /homework/:id/submissions with the id encoded, and normalizes', async () => {
    const { api, calls } = harness(() => ({ body: LIST }));
    const out = await api.list('h 1');
    assert.equal(calls[0]!.path, '/homework/h%201/submissions');
    assert.ok(!calls[0]!.init?.method || calls[0]!.init.method === 'GET');
    assert.equal(out.submittedCount, 1);
    assert.equal(out.submissions[0]!.status, 'late');
    assert.equal(out.trackableCount, 7);
    assert.equal(out.submissions[0]!.hasAccount, false);
  });

  it('carries the status of a 404 (no code on it)', async () => {
    const { api } = harness(() => ({ status: 404, body: { error: 'Not found' } }));
    const e = await rejection(api.list('h1'));
    assert.equal(e.status, 404);
    assert.equal(e.code, undefined);
    assert.equal(e.message, 'Not found');
  });

  it('throws on a 2xx that is not a list (a proxy page, an empty body)', async () => {
    for (const raw of ['', '<html>ok</html>', '[]', '{}']) {
      const { api } = harness(() => ({ raw }));
      const e = await rejection(api.list('h1'));
      assert.equal(e.status, 200);
    }
  });
});

describe('detail', () => {
  it('GETs /homework/:id/submissions/:studentId with both ids encoded', async () => {
    const { api, calls } = harness(() => ({ body: DETAIL }));
    const out = await api.detail('h 1', 's/1');
    assert.equal(calls[0]!.path, '/homework/h%201/submissions/s%2F1');
    assert.equal(out.student.displayName, 'سارة');
    assert.equal(out.submission.status, 'submitted');
  });

  it('throws on a 2xx without a student', async () => {
    const { api } = harness(() => ({ body: { submission: {} } }));
    assert.equal((await rejection(api.detail('h1', 's1'))).status, 200);
  });

  it('carries the status of a 404', async () => {
    const { api } = harness(() => ({ status: 404, body: { error: 'Not found' } }));
    assert.equal((await rejection(api.detail('h1', 's1'))).status, 404);
  });

  it('throws on a 2xx without a submission: a reply with no project is not an empty project', async () => {
    const student = { id: 's1', displayName: 'سارة' };
    for (const body of [{ student }, { student, submission: null }, { student, submission: 'x' }, { student, submission: [] }]) {
      const { api } = harness(() => ({ status: 201, body }));
      const e = await rejection(api.detail('h1', 's1'));
      assert.equal(e.status, 201, JSON.stringify(body));
    }
  });

  it('still reads {} as an empty project when the server sent a submission object', async () => {
    const { api } = harness(() => ({ body: { student: { id: 's1', displayName: 'x' }, submission: {} } }));
    assert.equal((await api.detail('h1', 's1')).submission.status, 'none');
  });
});

describe('the contract a screen can rely on for clear()', () => {
  it('is written down on clear(): a 404 is «already gone», an odd 2xx is uncertain, a 5xx can be retried', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'teacherSubmissionsApi.ts'), 'utf8');
    const doc = src.slice(0, src.indexOf('async clear('));
    const comment = doc.slice(doc.lastIndexOf('/**'));
    assert.match(comment, /404/);
    assert.match(comment, /already gone/i);
    assert.match(comment, /2xx/);
    assert.match(comment, /uncertain|may have/i);
    assert.match(comment, /5xx|500/);
  });
});

describe('clear', () => {
  it('DELETEs /homework/:id/submissions/:studentId', async () => {
    const { api, calls } = harness(() => ({ body: { cleared: true } }));
    await api.clear('h 1', 's 1');
    assert.equal(calls[0]!.path, '/homework/h%201/submissions/s%201');
    assert.equal(calls[0]!.init?.method, 'DELETE');
  });

  it('carries the status of a 500 and the code when the body has one', async () => {
    const { api } = harness(() => ({ status: 500, body: { error: 'Boom', code: 'storage_unavailable' } }));
    const e = await rejection(api.clear('h1', 's1'));
    assert.equal(e.status, 500);
    assert.equal(e.code, 'storage_unavailable');
  });

  it('leaves the code undefined when a failure body is not JSON', async () => {
    const { api } = harness(() => ({ status: 502, raw: '<html>bad gateway</html>' }));
    const e = await rejection(api.clear('h1', 's1'));
    assert.equal(e.status, 502);
    assert.equal(e.code, undefined);
  });

  it('throws on a 2xx that does not say it cleared (a proxy page must not read as cleared)', async () => {
    for (const raw of ['', '<html>ok</html>', '{}', '{"cleared":false}']) {
      const { api } = harness(() => ({ raw }));
      assert.equal((await rejection(api.clear('h1', 's1'))).status, 200);
    }
  });
});
