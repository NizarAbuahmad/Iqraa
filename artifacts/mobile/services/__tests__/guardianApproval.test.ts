/**
 * What this guards: the app's reading of the server's parent-approval answer. A status we do not know is treated
 * as "not required" (the server still enforces and the first 403 re-reads /auth/me), and the 403 detector must
 * not fire on any other 403.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { guardianFromApi, isGuardianRequiredBody, looksLikeEmail } from '../guardianApproval.ts';

describe('guardianFromApi', () => {
  it('passes the five known statuses and the masked address through', () => {
    for (const s of ['not_required', 'approved', 'needed', 'waiting', 'declined'] as const) {
      assert.deepEqual(guardianFromApi({ guardianStatus: s, guardianParentEmailMasked: 'mu***@example.test' }), {
        guardianStatus: s,
        guardianParentEmailMasked: 'mu***@example.test',
      });
    }
  });
  it('drops an unknown status and a non-string address', () => {
    assert.deepEqual(guardianFromApi({ guardianStatus: 'banana', guardianParentEmailMasked: 7 }), {});
    assert.deepEqual(guardianFromApi({}), {});
    assert.deepEqual(guardianFromApi({ guardianStatus: null }), {});
  });
});

describe('isGuardianRequiredBody', () => {
  it('is true only for the guardian_approval_required code', () => {
    assert.equal(isGuardianRequiredBody('{"code":"guardian_approval_required","error":"x"}'), true);
    assert.equal(isGuardianRequiredBody('{"code":"account_suspended"}'), false);
    assert.equal(isGuardianRequiredBody('{"error":"Forbidden"}'), false);
    assert.equal(isGuardianRequiredBody('not json'), false);
    assert.equal(isGuardianRequiredBody(''), false);
    assert.equal(isGuardianRequiredBody('null'), false);
  });
});

describe('looksLikeEmail', () => {
  it('accepts an ordinary address and refuses obvious non-addresses', () => {
    assert.equal(looksLikeEmail('mum@example.test'), true);
    assert.equal(looksLikeEmail('  mum@example.test  '), true);
    for (const bad of ['', 'mum', 'mum@', '@example.test', 'mum@example', 'mu m@example.test']) {
      assert.equal(looksLikeEmail(bad), false, JSON.stringify(bad));
    }
  });
});
