/**
 * Parent message composer tests.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/parentMessage.test.ts
 *
 * The load-bearing property is the one in the module header: **the composer
 * never asserts anything about a student that the teacher did not type.** These
 * messages go to a parent under the teacher's name, so a test suite that only
 * checked formatting would be missing the point.
 *
 * Also covers Arabic gender agreement, which is why gender is an input at all —
 * a slash in "ابنكم/ابنتكم" is what makes a message read as a form letter.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  composeParentMessage,
  kindLabel,
  MESSAGE_KINDS,
  needsDetails,
  type MessageKind,
  type ParentMessageInput,
} from '../parentMessage.ts';

const BASE: ParentMessageInput = {
  studentName: 'سارة',
  studentGender: 'female',
  kind: 'praise',
  teacherName: 'أ. نزار',
  teacherGender: 'male',
  subject: 'الرياضيات',
  tone: 'formal',
};

describe('invents nothing', () => {
  it('adds no numbers, dates or counts the teacher did not supply', () => {
    for (const kind of MESSAGE_KINDS) {
      const msg = composeParentMessage({ ...BASE, kind }, true);
      // Any digit in the output could only have come from fabricated specifics —
      // no template here legitimately contains one.
      assert.equal(/[0-9٠-٩]/.test(msg), false, `${kind} produced a digit: ${msg}`);
    }
  });

  it('includes the teacher-supplied details verbatim', () => {
    const details = 'لم تُسلّم واجب الوحدة الثالثة يومي الأحد والثلاثاء.';
    const msg = composeParentMessage(
      { ...BASE, kind: 'missing-homework', details }, true,
    );
    assert.ok(msg.includes(details));
  });

  it('omits the details paragraph entirely when none were given', () => {
    const withOut = composeParentMessage({ ...BASE, kind: 'absence' }, true);
    const withIn = composeParentMessage({ ...BASE, kind: 'absence', details: 'ثلاث حصص' }, true);
    assert.ok(withIn.length > withOut.length);
    // No empty paragraph left behind where the details would have been.
    assert.equal(/\n\n\n/.test(withOut), false);
  });

  it('never claims a subject that was not provided', () => {
    const msg = composeParentMessage({ ...BASE, subject: undefined }, true);
    assert.equal(msg.includes('مادة'), false);
    assert.equal(msg.includes('في مادة'), false);
  });
});

describe('Arabic gender agreement', () => {
  it('uses ابنتكم and feminine verbs for a female student', () => {
    const msg = composeParentMessage({ ...BASE, studentGender: 'female', kind: 'praise' }, true);
    assert.ok(msg.includes('ابنتكم'));
    assert.ok(msg.includes('أظهرت'));
    assert.equal(msg.includes('ابنكم '), false);
  });

  it('uses ابنكم and masculine verbs for a male student', () => {
    const msg = composeParentMessage({ ...BASE, studentGender: 'male', kind: 'praise' }, true);
    assert.ok(msg.includes('ابنكم'));
    assert.ok(msg.includes('أظهر'));
    assert.equal(msg.includes('ابنتكم'), false);
  });

  it('agrees on the absence verb too', () => {
    const f = composeParentMessage({ ...BASE, studentGender: 'female', kind: 'absence' }, true);
    const m = composeParentMessage({ ...BASE, studentGender: 'male', kind: 'absence' }, true);
    assert.ok(f.includes('تغيّبت'));
    assert.ok(m.includes('تغيّب'));
    assert.equal(m.includes('تغيّبت'), false);
  });

  it('addresses the guardian with the right form in the formal greeting', () => {
    const f = composeParentMessage({ ...BASE, studentGender: 'female', tone: 'formal' }, true);
    const m = composeParentMessage({ ...BASE, studentGender: 'male', tone: 'formal' }, true);
    assert.ok(f.includes('ولي أمر الطالبة سارة'));
    assert.ok(m.includes('ولي أمر الطالب سارة'));
  });

  it('signs off as معلّمة for a female teacher', () => {
    const f = composeParentMessage({ ...BASE, teacherGender: 'female' }, true);
    const m = composeParentMessage({ ...BASE, teacherGender: 'male' }, true);
    assert.ok(f.includes('معلّمة الرياضيات'));
    assert.ok(m.includes('معلّم الرياضيات'));
  });

  it('leaves no slashed either/or forms in the body', () => {
    for (const kind of MESSAGE_KINDS) {
      const msg = composeParentMessage({ ...BASE, kind }, true);
      assert.equal(
        msg.includes('ابنكم/ابنتكم'), false,
        `${kind} left a slashed form`,
      );
    }
  });
});

describe('structure', () => {
  it('produces greeting, body, next step and sign-off for every kind', () => {
    for (const kind of MESSAGE_KINDS) {
      const msg = composeParentMessage({ ...BASE, kind }, true);
      assert.ok(msg.includes('السلام عليكم'), `${kind} lost its greeting`);
      assert.ok(msg.includes('وتفضّلوا بقبول فائق الاحترام'), `${kind} lost its sign-off`);
      assert.ok(msg.split('\n\n').length >= 4, `${kind} is missing a section`);
      assert.ok(msg.includes('سارة'), `${kind} never names the student`);
    }
  });

  it('warm tone drops the formal honorific but keeps the greeting', () => {
    const warm = composeParentMessage({ ...BASE, tone: 'warm' }, true);
    assert.equal(warm.includes('حضرة ولي أمر'), false);
    assert.ok(warm.includes('السلام عليكم'));
  });

  it('returns empty when there is no student name', () => {
    assert.equal(composeParentMessage({ ...BASE, studentName: '   ' }, true), '');
    assert.equal(composeParentMessage({ ...BASE, studentName: '' }, true), '');
  });

  it('trims a padded name rather than embedding the padding', () => {
    const msg = composeParentMessage({ ...BASE, studentName: '  سارة  ' }, true);
    assert.equal(msg.includes('  سارة'), false);
    assert.ok(msg.includes('سارة'));
  });
});

describe('English', () => {
  it('composes a complete message with matching pronouns', () => {
    const msg = composeParentMessage(
      { ...BASE, studentName: 'Sara', subject: 'Mathematics', teacherName: 'Mr. Nizar' }, false,
    );
    assert.ok(msg.includes('Dear Parent/Guardian of Sara'));
    assert.ok(msg.includes('your daughter'));
    assert.ok(msg.includes('Kind regards'));
    assert.ok(msg.includes('Mathematics Teacher'));
  });

  it('uses the male form for a male student', () => {
    const msg = composeParentMessage({ ...BASE, studentName: 'Omar', studentGender: 'male' }, false);
    assert.ok(msg.includes('your son'));
    assert.equal(msg.includes('your daughter'), false);
  });

  it('drops the subject clause when no subject is set', () => {
    const msg = composeParentMessage({ ...BASE, studentName: 'Sara', subject: undefined }, false);
    assert.equal(/\bin\s+\./.test(msg), false);
    assert.ok(msg.includes('Teacher'));
  });
});

describe('kind metadata', () => {
  it('labels every kind in both languages', () => {
    for (const kind of MESSAGE_KINDS) {
      assert.ok(kindLabel(kind, true).length > 0);
      assert.ok(kindLabel(kind, false).length > 0);
    }
  });

  it('asks for specifics only where the message carries a concern', () => {
    assert.equal(needsDetails('praise'), false);
    assert.equal(needsDetails('progress'), false);
    assert.equal(needsDetails('missing-homework'), true);
    assert.equal(needsDetails('behaviour'), true);
  });

  it('covers every declared kind in MESSAGE_KINDS', () => {
    const all: MessageKind[] = [
      'praise', 'progress', 'missing-homework',
      'academic-concern', 'absence', 'behaviour', 'meeting',
    ];
    assert.deepEqual([...MESSAGE_KINDS].sort(), all.sort());
  });
});
