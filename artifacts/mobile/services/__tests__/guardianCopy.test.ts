import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getT } from '../i18n.ts';

const KEYS = [
  'guardianNeededTitle', 'guardianNeededDesc', 'guardianWaitingTitle', 'guardianDeclinedTitle', 'guardianDeclinedDesc',
  'guardianParentEmailLabel', 'guardianParentEmailHint', 'guardianSend', 'guardianChangeEmail',
  'guardianSendFailed', 'guardianSavedNotSent', 'guardianCheckNow', 'guardianJoinWithCode', 'guardianWrongTypeTitle', 'guardianSwitchToParent',
  'guardianSwitchToTeacher', 'guardianSwitchFailed', 'guardianSwitchNote', 'registerParentEmailLabel',
  'registerParentEmailHint', 'registerParentEmailFirst', 'errParentEmailRequired', 'errParentEmailInvalid',
  'errParentEmailIsOwn', 'errEmailNotVerifiedYet', 'errGuardianRateLimited', 'errGuardianApprovalRequired',
  'parentConsentTitle', 'parentConsentMeaning', 'parentConsentConfirm', 'parentConsentConfirmFirst',
  'parentConsentApprove', 'parentConsentDecline', 'parentConsentApprovedDone', 'parentConsentDeclinedDone',
  'parentConsentExpired', 'parentConsentDecided', 'parentConsentInvalid', 'parentConsentRetry', 'parentConsentOpenInBrowser',
] as const;

describe('parent approval copy', () => {
  for (const lang of ['ar', 'en'] as const) {
    const t = getT(lang) as (k: string, ...a: unknown[]) => string;
    it(`${lang}: every key resolves to real text`, () => {
      for (const k of KEYS) {
        const v = t(k);
        assert.ok(v && v !== k, `${lang}:${k}`);
      }
    });
    it(`${lang}: the interpolating strings carry their argument`, () => {
      assert.ok(t('guardianWaitingDesc', 'mu***@example.test').includes('mu***@example.test'));
      assert.ok(t('guardianSentTo', 'mu***@example.test').includes('mu***@example.test'));
      assert.ok(t('parentConsentIntro', 'Sami').includes('Sami'));
    });
  }
  it('the Arabic brand is spelled with hamzat qatʿ, never the verb', () => {
    const ar = getT('ar') as (k: string, ...a: unknown[]) => string;
    const OLD = String.fromCodePoint(0x0627, 0x0642, 0x0631, 0x0623);
    for (const k of ['parentConsentTitle', 'parentConsentIntro']) assert.ok(!ar(k, 'x').includes(OLD), k);
  });
});
