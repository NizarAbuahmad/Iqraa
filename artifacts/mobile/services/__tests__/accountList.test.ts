/**
 * The saved-accounts list: ordering, the cap, and tolerance of a bad store.
 *
 * Run:
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/accountList.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_SAVED_ACCOUNTS,
  isSavedFull,
  parseSavedAccounts,
  sortSavedAccounts,
  upsertSavedAccount,
  withoutSavedAccount,
  type SavedAccountMeta,
} from '../accountList.ts';

const acct = (userId: string, lastUsedAt: number): SavedAccountMeta => ({
  userId,
  name: `User ${userId}`,
  email: `${userId}@example.com`,
  role: 'teacher',
  avatarUrl: null,
  lastUsedAt,
});

describe('sortSavedAccounts', () => {
  it('puts the most recently used first, which is the one that gets the badge', () => {
    const sorted = sortSavedAccounts([acct('a', 10), acct('b', 30), acct('c', 20)]);
    assert.deepEqual(sorted.map(a => a.userId), ['b', 'c', 'a']);
  });

  it('does not mutate its input', () => {
    const input = [acct('a', 1), acct('b', 2)];
    sortSavedAccounts(input);
    assert.deepEqual(input.map(a => a.userId), ['a', 'b']);
  });
});

describe('upsertSavedAccount', () => {
  it('replaces the same user instead of listing it twice', () => {
    const next = upsertSavedAccount([acct('a', 1), acct('b', 2)], { ...acct('a', 99), name: 'Renamed' });
    assert.ok(next);
    assert.equal(next.length, 2);
    assert.equal(next.find(a => a.userId === 'a')?.name, 'Renamed');
  });

  it('refuses a new account once the cap is reached', () => {
    const full = Array.from({ length: MAX_SAVED_ACCOUNTS }, (_, i) => acct(`u${i}`, i));
    assert.equal(upsertSavedAccount(full, acct('extra', 100)), null);
  });

  it('still lets a full list refresh an account it already holds', () => {
    const full = Array.from({ length: MAX_SAVED_ACCOUNTS }, (_, i) => acct(`u${i}`, i));
    assert.ok(upsertSavedAccount(full, acct('u0', 100)));
  });
});

describe('isSavedFull', () => {
  it('is false for an account already in a full list, true for a stranger', () => {
    const full = Array.from({ length: MAX_SAVED_ACCOUNTS }, (_, i) => acct(`u${i}`, i));
    assert.equal(isSavedFull(full, 'u1'), false);
    assert.equal(isSavedFull(full, 'stranger'), true);
  });
});

describe('withoutSavedAccount', () => {
  it('removes just that user', () => {
    assert.deepEqual(withoutSavedAccount([acct('a', 1), acct('b', 2)], 'a').map(a => a.userId), ['b']);
  });
});

describe('parseSavedAccounts', () => {
  it('round-trips a stored list', () => {
    const list = [acct('a', 5), acct('b', 6)];
    assert.deepEqual(parseSavedAccounts(JSON.stringify(list)), list);
  });

  it('treats null, garbage and the wrong shape as no accounts', () => {
    assert.deepEqual(parseSavedAccounts(null), []);
    assert.deepEqual(parseSavedAccounts('not json'), []);
    assert.deepEqual(parseSavedAccounts('{"userId":"a"}'), []);
  });

  it('drops malformed and duplicate entries but keeps the good ones', () => {
    const raw = JSON.stringify([acct('a', 1), { userId: 'x' }, null, acct('a', 2), acct('b', 3)]);
    assert.deepEqual(parseSavedAccounts(raw).map(a => a.userId), ['a', 'b']);
  });

  it('fills defaults for fields an older build did not write', () => {
    const [only] = parseSavedAccounts(JSON.stringify([{ userId: 'a', name: 'A', email: 'a@x.com' }]));
    assert.equal(only.role, 'teacher');
    assert.equal(only.avatarUrl, null);
    assert.equal(only.lastUsedAt, 0);
  });
});
