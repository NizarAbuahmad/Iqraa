import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { guardianWaitingView } from '../guardianWaitingView.ts';
import { getT } from '../i18n.ts';

const MASKED = 'mu***@example.test';

describe('guardianWaitingView', () => {
  it('editing: asks for an email under the needed title, whatever the status', () => {
    for (const status of ['needed', 'waiting', 'declined', undefined] as const) {
      const v = guardianWaitingView({ status, editing: true, maskedEmail: MASKED });
      assert.deepEqual(v, { titleKey: 'guardianNeededTitle', descKey: 'guardianNeededDesc', askForEmail: true, offerChange: false }, String(status));
    }
  });

  it('declined: the declined title and text, and the form', () => {
    const v = guardianWaitingView({ status: 'declined', editing: false, maskedEmail: MASKED });
    assert.deepEqual(v, { titleKey: 'guardianDeclinedTitle', descKey: 'guardianDeclinedDesc', askForEmail: true, offerChange: false });
  });

  it('waiting: the waiting title with the masked address, no form, offers a change', () => {
    const v = guardianWaitingView({ status: 'waiting', editing: false, maskedEmail: MASKED });
    assert.deepEqual(v, { titleKey: 'guardianWaitingTitle', descKey: 'guardianWaitingDesc', descArg: MASKED, askForEmail: false, offerChange: true });
  });

  it('needed with a masked address: the link expired, says so with the address, and asks for an email', () => {
    const v = guardianWaitingView({ status: 'needed', editing: false, maskedEmail: MASKED });
    assert.deepEqual(v, { titleKey: 'guardianNeededTitle', descKey: 'guardianExpiredDesc', descArg: MASKED, askForEmail: true, offerChange: false });
  });

  it('needed without an address (null, undefined or empty): the plain needed text', () => {
    for (const maskedEmail of [undefined, null, '']) {
      const v = guardianWaitingView({ status: 'needed', editing: false, maskedEmail });
      assert.deepEqual(v, { titleKey: 'guardianNeededTitle', descKey: 'guardianNeededDesc', askForEmail: true, offerChange: false }, String(maskedEmail));
    }
  });

  it('undefined status: the same as needed, with or without an address', () => {
    assert.deepEqual(
      guardianWaitingView({ status: undefined, editing: false }),
      guardianWaitingView({ status: 'needed', editing: false }),
    );
    assert.deepEqual(
      guardianWaitingView({ status: undefined, editing: false, maskedEmail: MASKED }),
      guardianWaitingView({ status: 'needed', editing: false, maskedEmail: MASKED }),
    );
  });

  it('every key it can return exists in both languages, and the argument is printed when given', () => {
    const inputs = [
      { status: 'needed' as const, editing: false },
      { status: 'needed' as const, editing: false, maskedEmail: MASKED },
      { status: 'waiting' as const, editing: false, maskedEmail: MASKED },
      { status: 'declined' as const, editing: false },
    ];
    for (const lang of ['ar', 'en'] as const) {
      const t = getT(lang) as (k: string, ...a: unknown[]) => string;
      for (const input of inputs) {
        const v = guardianWaitingView(input);
        assert.ok(t(v.titleKey) && t(v.titleKey) !== v.titleKey, `${lang}:${v.titleKey}`);
        const text = v.descArg !== undefined ? t(v.descKey, v.descArg) : t(v.descKey);
        assert.ok(text && text !== v.descKey, `${lang}:${v.descKey}`);
        if (v.descArg) assert.ok(text.includes(v.descArg), `${lang}:${v.descKey} prints the address`);
      }
    }
  });
});

describe('waiting screen: no teacher exit', () => {
  const root = join(import.meta.dirname, '..', '..');
  const src = readFileSync(join(root, 'app', 'guardian-waiting.tsx'), 'utf8');
  it('the screen offers "I am a parent" and no "I am a teacher"', () => {
    assert.ok(src.includes('guardianSwitchToParent'), 'the parent switch is gone');
    assert.ok(!/guardianSwitchToTeacher/.test(src), 'the teacher switch is back');
    assert.ok(!/leaveAs\(\s*'teacher'/.test(src), "leaveAs('teacher') is back");
  });
});
