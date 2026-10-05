import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  isSessionLost,
  isTokenRemovedByOtherTab,
} from '../sessionLoss.ts';

describe('isSessionLost', () => {
  it('a 401 with no refresh token to try is a lost session', () => {
    assert.equal(isSessionLost('/feedback', false), true);
    assert.equal(isSessionLost('/messaging/threads', false), true);
  });

  it('a refresh token that merely failed to refresh is not decided here', () => {
    assert.equal(isSessionLost('/feedback', true), false);
  });

  it('/auth/* 401s are credentials problems, not a lost session', () => {
    assert.equal(isSessionLost('/auth/login', false), false);
    assert.equal(isSessionLost('/auth/me', false), false);
  });
});

describe('isTokenRemovedByOtherTab', () => {
  it('a removed token key is a sign-out', () => {
    assert.equal(isTokenRemovedByOtherTab({ key: ACCESS_TOKEN_KEY, newValue: null }), true);
    assert.equal(isTokenRemovedByOtherTab({ key: REFRESH_TOKEN_KEY, newValue: null }), true);
  });

  it('localStorage.clear() is a sign-out', () => {
    assert.equal(isTokenRemovedByOtherTab({ key: null, newValue: null }), true);
  });

  it('a token written by another tab (refresh rotation) is not', () => {
    assert.equal(isTokenRemovedByOtherTab({ key: ACCESS_TOKEN_KEY, newValue: 'abc' }), false);
    assert.equal(isTokenRemovedByOtherTab({ key: REFRESH_TOKEN_KEY, newValue: 'def' }), false);
  });

  it('unrelated keys are ignored', () => {
    assert.equal(isTokenRemovedByOtherTab({ key: 'iqra_theme', newValue: null }), false);
  });
});
