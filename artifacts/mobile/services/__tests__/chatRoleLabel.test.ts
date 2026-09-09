/**
 * The one non-obvious branch here is that `school_admin` and `system_admin`
 * collapse onto the same label as each other (but not as `teacher`) — every
 * other role is a 1:1 mapping. `getT` is a plain function, not a React hook,
 * so this needs no `LanguageContext` to exercise both languages directly.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { chatRoleLabel } from '../chatRoleLabel.ts';
import { getT, type Lang } from '../i18n.ts';
import type { ChatRole } from '../messaging.ts';

const LANGS: Lang[] = ['ar', 'en'];

describe('chatRoleLabel', () => {
  it('gives every role its own non-empty label, in both languages', () => {
    const roles: ChatRole[] = ['teacher', 'school_admin', 'system_admin', 'student', 'parent'];
    for (const lang of LANGS) {
      const t = getT(lang);
      for (const role of roles) {
        const label = chatRoleLabel(role, t);
        assert.ok(label.length > 0, `${role} (${lang}) produced an empty label`);
      }
    }
  });

  it('collapses school_admin and system_admin onto the same label', () => {
    for (const lang of LANGS) {
      const t = getT(lang);
      assert.equal(chatRoleLabel('school_admin', t), chatRoleLabel('system_admin', t));
    }
  });

  it('does not confuse admin with teacher', () => {
    for (const lang of LANGS) {
      const t = getT(lang);
      assert.notEqual(chatRoleLabel('teacher', t), chatRoleLabel('school_admin', t));
    }
  });

  it('does not confuse student with parent', () => {
    for (const lang of LANGS) {
      const t = getT(lang);
      assert.notEqual(chatRoleLabel('student', t), chatRoleLabel('parent', t));
    }
  });

  it('matches the exact i18n strings a teacher and a guardian already see elsewhere', () => {
    // Same keys ParticipantPickerSheet.tsx and messaging/claim/[studentId].tsx
    // already render inline — this pins that this helper reuses them rather
    // than drifting into a second copy of the translation.
    const ar = getT('ar');
    assert.equal(chatRoleLabel('student', ar), 'طالب/ة');
    assert.equal(chatRoleLabel('parent', ar), 'ولي أمر');
    assert.equal(chatRoleLabel('teacher', ar), 'معلم');
    assert.equal(chatRoleLabel('school_admin', ar), 'مدير المدرسة');

    const en = getT('en');
    assert.equal(chatRoleLabel('student', en), 'Student');
    assert.equal(chatRoleLabel('parent', en), 'Parent');
    assert.equal(chatRoleLabel('teacher', en), 'Teacher');
    assert.equal(chatRoleLabel('school_admin', en), 'School Admin');
  });
});
