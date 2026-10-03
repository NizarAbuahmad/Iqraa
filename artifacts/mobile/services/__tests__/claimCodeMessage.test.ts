/**
 * The invite a teacher sends with a link code.
 *
 * Before this composer the share button did not exist and the copy button put
 * six bare characters on the clipboard — a parent received `ABC234` and no way
 * to know what it was. The assertions here pin the three things that made it
 * useless or wrong, not the prose.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { composeClaimCodeMessage } from '../claimCodeMessage.ts';
import translations from '../i18n.ts';

const BASE = {
  studentName: 'سارة',
  code: 'ABC234',
  expiresOn: '٦/١٠/٢٠٢٦',
  fieldLabel: 'رمز الربط',
};

describe('composeClaimCodeMessage', () => {
  it('carries the code and the student, in both languages', () => {
    const ar = composeClaimCodeMessage(BASE, true);
    assert.match(ar, /ABC234/);
    assert.match(ar, /سارة/);

    const en = composeClaimCodeMessage({ ...BASE, fieldLabel: 'Link code' }, false);
    assert.match(en, /ABC234/);
    assert.match(en, /سارة/);
  });

  it('puts the code alone on its line so a long-press selects it cleanly', () => {
    const line = composeClaimCodeMessage(BASE, true)
      .split('\n')
      .find(l => l.includes('ABC234'));
    assert.equal(line, 'ABC234');
  });

  it('drops the link line rather than emitting a hostless URL', () => {
    // Native has no window.location, so origin arrives undefined. A half-built
    // "open  ← create account" line is worse than no line.
    const native = composeClaimCodeMessage(BASE, true);
    assert.doesNotMatch(native, /http/);
    assert.doesNotMatch(native, /افتح/);

    const web = composeClaimCodeMessage({ ...BASE, origin: 'https://iqraa-web.onrender.com' }, true);
    assert.match(web, /افتح https:\/\/iqraa-web\.onrender\.com/);
  });

  it('closes without a dangling blank line when there is no teacher name', () => {
    const out = composeClaimCodeMessage(BASE, true);
    assert.doesNotMatch(out, /\n\n$/);
    assert.match(out, /وتفضّلوا بقبول فائق الاحترام،$/);

    const named = composeClaimCodeMessage({ ...BASE, teacherName: 'أ. نزار' }, true);
    assert.match(named, /وتفضّلوا بقبول فائق الاحترام،\nأ\. نزار$/);
  });

  it('describes where the code is actually asked for', () => {
    // Registration stopped taking a code: it is asked only on /claim-required,
    // after the email is verified. The message used to say "create an account,
    // pick Parent, and enter the code" — a field that no longer exists — and
    // was handed to students too, whom it told to sign up as a parent.
    const ar = composeClaimCodeMessage({ ...BASE, origin: 'https://iqraa.example' }, true);
    assert.match(ar, /بعد تأكيد/);
    assert.match(ar, /طالب/);
    assert.doesNotMatch(ar, /«إنشاء حساب»، واختر «وليّ أمر»، وأدخل/);

    const en = composeClaimCodeMessage({ ...BASE, fieldLabel: 'Link code', origin: 'https://iqraa.example' }, false);
    assert.match(en, /[Aa]fter verifying your email/);
    assert.match(en, /Student/);
    assert.doesNotMatch(en, /pick "Parent", and enter the code/);
  });

  it('names the field the recipient will actually see', () => {
    // The teacher's screen said «رمز الربط» while the sign-up field said
    // «رمز الصف», so the instruction sent parents hunting for a label that did
    // not exist. The screen passes t('classCode') in; this pins that the label
    // it passes is the one the register form renders, in both locales.
    for (const [locale, isAr] of [['ar', true], ['en', false]] as const) {
      const label = translations[locale].classCode as string;
      const out = composeClaimCodeMessage({ ...BASE, fieldLabel: label }, isAr);
      assert.ok(out.includes(label), `${locale}: message should name the field «${label}»`);
    }
  });
});
