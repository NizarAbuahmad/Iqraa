import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { channelsFor, PUSH_CHANNELS, pushPromptDecision } from '../pushPolicy.ts';

const base = { web: false, status: 'undetermined' as const, canAskAgain: true, askedBefore: false, explicit: false };

describe('pushPromptDecision', () => {
  it('never prompts on web, which has no push', () => {
    assert.equal(pushPromptDecision({ ...base, web: true, explicit: true }), 'skip');
  });

  it('registers straight away once permission is granted', () => {
    assert.equal(pushPromptDecision({ ...base, status: 'granted' }), 'register');
    assert.equal(pushPromptDecision({ ...base, status: 'granted', askedBefore: true }), 'register');
  });

  it('explains before the first OS prompt', () => {
    assert.equal(pushPromptDecision(base), 'explain');
  });

  it('asks on its own only once — later moments stay quiet', () => {
    assert.equal(pushPromptDecision({ ...base, askedBefore: true }), 'skip');
    assert.equal(pushPromptDecision({ ...base, status: 'denied', askedBefore: true }), 'skip');
  });

  it('asks again whenever the user taps the settings row', () => {
    assert.equal(pushPromptDecision({ ...base, askedBefore: true, explicit: true }), 'explain');
  });

  it('sends a blocked user to system settings only when they asked to', () => {
    const blocked = { ...base, status: 'denied' as const, canAskAgain: false };
    assert.equal(pushPromptDecision(blocked), 'skip');
    assert.equal(pushPromptDecision({ ...blocked, explicit: true }), 'open-settings');
  });
});

describe('notification channels', () => {
  it('has a distinct id and both names for every channel', () => {
    const ids = PUSH_CHANNELS.map(c => c.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const c of PUSH_CHANNELS) {
      assert.ok(c.nameAr && c.nameEn && c.descriptionAr && c.descriptionEn, c.id);
    }
  });

  it('shows the content-report channel to system admins only', () => {
    assert.ok(!channelsFor(false).some(c => c.id === 'admin'));
    assert.ok(channelsFor(true).some(c => c.id === 'admin'));
  });

  // The server names a channel by id on every push (PUSH_CHANNEL in
  // api-server/src/lib/pushNotifications.ts). An id the app never created
  // still arrives, but in Android's catch-all channel — exactly the mixing
  // these channels exist to stop, and nothing would say so.
  it('creates every channel the server sends to', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const serverSrc = readFileSync(path.join(here, '../../../api-server/src/lib/pushNotifications.ts'), 'utf8');
    const block = serverSrc.match(/export const PUSH_CHANNEL = \{([^}]*)\}/);
    assert.ok(block, 'PUSH_CHANNEL not found in pushNotifications.ts');
    const serverIds = [...block[1].matchAll(/:\s*"([^"]+)"/g)].map(m => m[1]);
    assert.ok(serverIds.length >= 3);
    const appIds = new Set<string>(PUSH_CHANNELS.map(c => c.id));
    for (const id of serverIds) assert.ok(appIds.has(id), `server channel «${id}» is never created by the app`);
  });
});
