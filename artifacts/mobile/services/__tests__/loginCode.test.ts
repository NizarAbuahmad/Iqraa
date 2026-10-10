/**
 * What this guards: the field a parent or student types their personal login
 * code into. It mirrors `normalizeLoginCode` on the server
 * (api-server/src/lib/loginCode.ts), which is strict — so the screen must not
 * offer "Sign in" for something the server can only refuse, and must accept the
 * ways a person actually types a code that is shown as `ABCD-EFGH-JKMN`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatLoginCode,
  isCompleteLoginCode,
  LOGIN_CODE_LENGTH,
  normalizeLoginCodeInput,
} from '../loginCode.ts';

describe('normalizeLoginCodeInput', () => {
  it('uppercases and drops the separators a person types or pastes', () => {
    assert.equal(normalizeLoginCodeInput('abcd-2345-efgh'), 'ABCD2345EFGH');
    assert.equal(normalizeLoginCodeInput(' abcd 2345 efgh '), 'ABCD2345EFGH');
  });

  it('never keeps more than a code holds, so a paste cannot overshoot the field', () => {
    assert.equal(normalizeLoginCodeInput('ABCD2345EFGHJKMN').length, LOGIN_CODE_LENGTH);
  });

  it('is empty for nothing', () => {
    assert.equal(normalizeLoginCodeInput(''), '');
  });
});

describe('formatLoginCode', () => {
  it('shows groups of four as the code was first displayed', () => {
    assert.equal(formatLoginCode('abcd2345efgh'), 'ABCD-2345-EFGH');
  });

  it('shows a partial code grouped as far as it goes, with no trailing dash', () => {
    assert.equal(formatLoginCode('abcd'), 'ABCD');
    assert.equal(formatLoginCode('abcd23'), 'ABCD-23');
    assert.equal(formatLoginCode('abcd2345e'), 'ABCD-2345-E');
  });
});

describe('isCompleteLoginCode', () => {
  it('is true for twelve characters from the unambiguous alphabet', () => {
    assert.equal(isCompleteLoginCode('ABCD-2345-EFGH'), true);
    assert.equal(isCompleteLoginCode('abcd2345efgh'), true);
  });

  it('is false while short, so Sign in stays off', () => {
    assert.equal(isCompleteLoginCode('ABCD-2345'), false);
    assert.equal(isCompleteLoginCode(''), false);
  });

  it('is false for a teacher-length code, which is not a login code', () => {
    assert.equal(isCompleteLoginCode('QWXTK2'), false);
  });

  it('is false when a character the alphabet never uses is in it', () => {
    // O, 0, I, 1 and L cannot appear in a code; one of them means a misread, and
    // the server would refuse it, so the button should not pretend otherwise.
    assert.equal(isCompleteLoginCode('ABCD-2345-EFG0'), false);
    assert.equal(isCompleteLoginCode('ABCD-2345-EFGL'), false);
  });
});
