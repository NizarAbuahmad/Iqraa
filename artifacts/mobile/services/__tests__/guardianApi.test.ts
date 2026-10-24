import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { GuardianApiError, makeGuardianApi } from '../guardianApi.ts';

function res(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function api(fetchImpl: (url: string, init: RequestInit) => Promise<Response>, apiJson?: any) {
  return makeGuardianApi({ baseUrl: async () => 'https://api.test/api', fetchImpl: fetchImpl as any, apiJson });
}

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';

describe('guardianApi', () => {
  it('config: GETs /guardian-consent/config and reads enabled', async () => {
    let seen = '';
    const g = api(async (url, init) => { seen = `${init.method ?? 'GET'} ${url}`; return res(200, { enabled: true }); });
    assert.deepEqual(await g.config(), { enabled: true });
    assert.equal(seen, 'GET https://api.test/api/guardian-consent/config');
  });

  it('config: anything but a boolean true is off', async () => {
    assert.deepEqual(await api(async () => res(200, { enabled: 'yes' })).config(), { enabled: false });
    assert.deepEqual(await api(async () => res(200, {})).config(), { enabled: false });
  });

  it('lookup: POSTs the token in the body, never in the URL', async () => {
    let url = ''; let body = '';
    const g = api(async (u, init) => { url = u; body = String(init.body); return res(200, { status: 'open', childFirstName: 'Sami' }); });
    assert.deepEqual(await g.lookup(TOKEN), { status: 'open', childFirstName: 'Sami' });
    assert.equal(url, 'https://api.test/api/guardian-consent/lookup');
    assert.ok(!url.includes(TOKEN));
    assert.deepEqual(JSON.parse(body), { token: TOKEN });
  });

  it('lookup: an unknown status or a malformed answer is "invalid"', async () => {
    assert.deepEqual(await api(async () => res(200, { status: 'weird' })).lookup(TOKEN), { status: 'invalid' });
    assert.deepEqual(await api(async () => res(200, null)).lookup(TOKEN), { status: 'invalid' });
  });

  it('decide: sends decision and confirmation, returns the decision', async () => {
    let body = ''; let url = '';
    const g = api(async (u, init) => { url = u; body = String(init.body); return res(200, { decision: 'approved' }); });
    assert.deepEqual(await g.decide(TOKEN, 'approved', true), { decision: 'approved' });
    assert.equal(url, 'https://api.test/api/guardian-consent/decide');
    assert.ok(!url.includes(TOKEN));
    assert.deepEqual(JSON.parse(body), { token: TOKEN, decision: 'approved', confirmGuardian: true });
  });

  it('decide: a 200 without a valid decision is a GuardianApiError, not a TypeError', async () => {
    for (const body of [{}, null, { decision: 'maybe' }]) {
      await assert.rejects(api(async () => res(200, body)).decide(TOKEN, 'approved', true), (e: any) => e instanceof GuardianApiError && e.message === 'Unexpected response' && e.status === 200);
    }
  });

  it('errors: a non-string error field falls back to "HTTP <status>"', async () => {
    const g = api(async () => res(500, { error: { x: 1 }, code: 7 }));
    await assert.rejects(g.decide(TOKEN, 'declined', false), (e: any) => e instanceof GuardianApiError && e.message === 'HTTP 500' && e.status === 500 && e.code === undefined);
  });

  it('config: a GET carries no Content-Type', async () => {
    let init: RequestInit = {};
    await api(async (_u, i) => { init = i; return res(200, { enabled: true }); }).config();
    assert.equal(init.headers, undefined);
  });

  it('lookup: expired and decided pass through', async () => {
    assert.deepEqual(await api(async () => res(200, { status: 'expired' })).lookup(TOKEN), { status: 'expired' });
    assert.deepEqual(await api(async () => res(200, { status: 'decided' })).lookup(TOKEN), { status: 'decided' });
  });

  it('lookup: open without a string childFirstName is "invalid"', async () => {
    assert.deepEqual(await api(async () => res(200, { status: 'open' })).lookup(TOKEN), { status: 'invalid' });
    assert.deepEqual(await api(async () => res(200, { status: 'open', childFirstName: 5 })).lookup(TOKEN), { status: 'invalid' });
  });

  it('lookup: approval switched off (404 guardian_approval_disabled) is "invalid"; other failures still throw', async () => {
    const off = api(async () => res(404, { code: 'guardian_approval_disabled', error: 'Not available' }));
    assert.deepEqual(await off.lookup(TOKEN), { status: 'invalid' });
    await assert.rejects(api(async () => res(404, { error: 'nope' })).lookup(TOKEN), (e: any) => e instanceof GuardianApiError && e.status === 404);
    await assert.rejects(api(async () => res(500, { error: 'x' })).lookup(TOKEN), (e: any) => e instanceof GuardianApiError && e.status === 500);
  });

  it('decide: a non-200 throws a GuardianApiError carrying status and code', async () => {
    const g = api(async () => res(410, { code: 'consent_link_unusable', error: 'x' }));
    await assert.rejects(g.decide(TOKEN, 'declined', false), (e: any) => e instanceof GuardianApiError && e.status === 410 && e.code === 'consent_link_unusable');
  });

  it('decide: a network failure is a GuardianApiError with status 0', async () => {
    const g = api(async () => { throw new TypeError('Failed to fetch'); });
    await assert.rejects(g.decide(TOKEN, 'declined', false), (e: any) => e instanceof GuardianApiError && e.status === 0);
  });

  it('request: goes through the authenticated client with the parent address in the body', async () => {
    let call: any;
    const g = api(async () => res(500, {}), async (path: string, init: any) => { call = { path, init }; return { parentEmailMasked: 'mu***@example.test', emailSent: true, expiresAt: '2026-11-01T00:00:00Z' }; });
    const out = await g.request('mum@example.test');
    assert.equal(call.path, '/auth/guardian-request');
    assert.equal(call.init.method, 'POST');
    assert.deepEqual(JSON.parse(call.init.body), { parentEmail: 'mum@example.test' });
    assert.deepEqual(out, { parentEmailMasked: 'mu***@example.test', emailSent: true, expiresAt: '2026-11-01T00:00:00Z' });
  });
});
