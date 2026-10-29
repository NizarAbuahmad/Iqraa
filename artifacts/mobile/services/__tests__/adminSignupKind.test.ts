/**
 * The admin dashboard's overview tiles open «البريد المجمّع» with one filter
 * chip already selected. The chip comes from the URL, so a link someone typed
 * or pasted has to land on a real chip, never an empty list.
 *
 * Run:
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/adminSignupKind.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SIGNUP_KINDS, parseSignupKind, signupsHref } from '../adminSignupKind.ts';

describe('parseSignupKind', () => {
  it('keeps each of the four chips the screen has', () => {
    for (const kind of SIGNUP_KINDS) assert.equal(parseSignupKind(kind), kind);
  });

  it('opens on «الكل» when the link names no chip', () => {
    assert.equal(parseSignupKind(undefined), 'all');
    assert.equal(parseSignupKind(''), 'all');
  });

  it('opens on «الكل» for a chip the screen does not have, not on an empty list', () => {
    assert.equal(parseSignupKind('ideas'), 'all');
    assert.equal(parseSignupKind('IDEA'), 'all');
    assert.equal(parseSignupKind(' idea'), 'all');
  });

  it('does not read an Object.prototype name as a chip', () => {
    for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      assert.equal(parseSignupKind(name), 'all');
    }
  });

  it('takes the first value when the router hands back a repeated param', () => {
    assert.equal(parseSignupKind(['contact', 'idea']), 'contact');
    assert.equal(parseSignupKind([]), 'all');
  });
});

describe('signupsHref', () => {
  it('points the tile at the signups screen with the chip it counts', () => {
    assert.equal(signupsHref('idea'), '/admin/signups?kind=idea');
    assert.equal(signupsHref('waitlist'), '/admin/signups?kind=waitlist');
    assert.equal(signupsHref('contact'), '/admin/signups?kind=contact');
  });

  it('needs no param for «الكل»', () => {
    assert.equal(signupsHref('all'), '/admin/signups');
  });

  it('is read back as the same chip by the screen', () => {
    for (const kind of SIGNUP_KINDS) {
      const url = new URL(signupsHref(kind), 'http://localhost');
      assert.equal(url.pathname, '/admin/signups');
      assert.equal(parseSignupKind(url.searchParams.get('kind') ?? undefined), kind);
    }
  });
});
