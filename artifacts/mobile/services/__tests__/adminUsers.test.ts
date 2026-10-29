/**
 * Who the admin screens call «جديد», which channel a user joined through, and
 * the link the dashboard's new-users tile opens.
 *
 * Run:
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/adminUsers.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NEW_USERS_HREF, channelOf, countNewUsers, isNewUser, newUsersFrom, parseNewUsersParam } from '../adminUsers.ts';

const TODAY = '2026-10-29';

describe('newUsersFrom', () => {
  it('is seven days including today, which is the «٧ أيام» chip (dayAgo(6))', () => {
    assert.equal(newUsersFrom(TODAY), '2026-10-23');
  });
  it('crosses a month and a year end', () => {
    assert.equal(newUsersFrom('2026-11-03'), '2026-10-28');
    assert.equal(newUsersFrom('2027-01-02'), '2026-12-27');
  });
});

describe('isNewUser', () => {
  it('counts anyone who joined in the window, on either end of it', () => {
    assert.equal(isNewUser('2026-10-29T08:00:00.000Z', TODAY), true);
    assert.equal(isNewUser('2026-10-23T00:00:00.000Z', TODAY), true);
  });
  it('does not count the day before the window', () => {
    assert.equal(isNewUser('2026-10-22T23:59:59.000Z', TODAY), false);
  });
  it('does not count a missing date', () => {
    assert.equal(isNewUser(null, TODAY), false);
    assert.equal(isNewUser(undefined, TODAY), false);
    assert.equal(isNewUser('', TODAY), false);
  });
});

describe('countNewUsers', () => {
  const rows = [
    { day: '2026-10-20', count: 5 }, // before the window
    { day: '2026-10-23', count: 2 }, // first day inside
    { day: '2026-10-23', count: 1 }, // the same day under another role
    { day: '2026-10-29', count: 4 },
  ];
  it('sums the days inside the window, across roles', () => {
    assert.equal(countNewUsers(rows, TODAY), 7);
  });
  it('is 0 for no rows', () => {
    assert.equal(countNewUsers([], TODAY), 0);
  });
  it('agrees with isNewUser on the same days', () => {
    for (const r of rows) assert.equal(r.day >= newUsersFrom(TODAY), isNewUser(`${r.day}T12:00:00.000Z`, TODAY));
  });
});

describe('channelOf', () => {
  it('web is web, the two app platforms are mobile, anything else is unknown', () => {
    assert.equal(channelOf('web'), 'web');
    assert.equal(channelOf('android'), 'mobile');
    assert.equal(channelOf('ios'), 'mobile');
    assert.equal(channelOf(null), 'unknown');
    assert.equal(channelOf(undefined), 'unknown');
    assert.equal(channelOf('tv'), 'unknown');
  });
});

describe('parseNewUsersParam', () => {
  it('only «1» opens the new window, and a repeated param reads its first value', () => {
    assert.equal(parseNewUsersParam('1'), true);
    assert.equal(parseNewUsersParam(['1', '0']), true);
    assert.equal(parseNewUsersParam(undefined), false);
    assert.equal(parseNewUsersParam('0'), false);
    assert.equal(parseNewUsersParam('yes'), false);
  });
  it('is what the tile links with', () => {
    assert.equal(NEW_USERS_HREF, '/admin/users?new=1');
  });
});
