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
  attachmentProblem,
  attachmentKind,
  composeParentMessage,
  detailsExample,
  detailsLanguageMismatch,
  parentMessageReady,
  guardiansForStudent,
  MAX_LETTER_LENGTH,
  outgoingLetter,
  kindLabel,
  matchRosterStudents,
  MESSAGE_KINDS,
  needsDetails,
  parseSavedSignature,
  pickRecipients,
  rosterGender,
  seedDetailsFromNote,
  suggestMeeting,
  summarizeClassContacts,
  summarizeContacts,
  type MessageKind,
  type ParentMessageInput,
} from '../parentMessage.ts';
import type { ContactStudent } from '../messaging.ts';

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
  it('uses ابنتكم and feminine forms for a female student', () => {
    const msg = composeParentMessage({ ...BASE, studentGender: 'female', kind: 'praise', strengths: ['effort'] }, true);
    assert.ok(msg.includes('ابنتكم'));
    assert.ok(msg.includes('اجتهادها'));
    assert.equal(msg.includes('ابنكم '), false);
  });

  it('uses ابنكم and masculine forms for a male student', () => {
    const msg = composeParentMessage({ ...BASE, studentGender: 'male', kind: 'praise', strengths: ['effort'] }, true);
    assert.ok(msg.includes('ابنكم'));
    assert.ok(msg.includes('اجتهاده'));
    assert.equal(msg.includes('ابنتكم'), false);
    assert.equal(msg.includes('اجتهادها'), false);
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

describe('seedDetailsFromNote', () => {
  // Picking a student off the roster offers the teacher's standing note on
  // that child as a starting point. The failure that matters is silent, so it
  // is the first case here.
  it('never overwrites details the teacher is already writing', () => {
    assert.equal(
      seedDetailsFromNote('لم يسلّم واجب الأربعاء', 'يتحسّن في المسائل اللفظية'),
      'لم يسلّم واجب الأربعاء',
    );
  });

  it('offers the note when the box is empty', () => {
    assert.equal(seedDetailsFromNote('', 'يتحسّن في المسائل اللفظية'), 'يتحسّن في المسائل اللفظية');
  });

  it('treats whitespace as empty — a stray newline is not writing', () => {
    assert.equal(seedDetailsFromNote('  \n ', 'يتحسّن'), 'يتحسّن');
  });

  it('leaves the box alone when the student has no note', () => {
    assert.equal(seedDetailsFromNote('', ''), '');
    assert.equal(seedDetailsFromNote('', '   '), '');
  });
});

/**
 * This is the branch that decides who receives a letter about a named child, so
 * it is worth more than a click-through. The failure that matters is not
 * "delivered nothing" — it is "delivered to the wrong person", which no toast
 * would catch and no teacher could take back.
 */
describe('guardiansForStudent', () => {
  const CONTACTS: ContactStudent[] = [
    {
      studentId: 's1',
      studentName: 'سارة',
      contacts: [
        { userId: 'u-parent', firstName: 'هدى', lastName: 'العلي', role: 'parent' },
        { userId: 'u-self', firstName: 'سارة', lastName: 'العلي', role: 'student' },
      ],
    },
    {
      studentId: 's2',
      studentName: 'أحمد',
      contacts: [{ userId: 'u-other', firstName: 'ماجد', lastName: 'الحاج', role: 'parent' }],
    },
    { studentId: 's3', studentName: 'ليان', contacts: [] },
  ];

  it('returns nothing when the teacher typed the name by hand', () => {
    // No roster row picked, so there is no student to look a guardian up behind.
    assert.deepEqual(guardiansForStudent(CONTACTS, null), []);
  });

  it('returns nothing for a student outside this teacher’s contacts', () => {
    assert.deepEqual(guardiansForStudent(CONTACTS, 'nope'), []);
  });

  it('excludes the student’s own account — the letter is written about them', () => {
    const found = guardiansForStudent(CONTACTS, 's1');
    assert.deepEqual(found.map(c => c.userId), ['u-parent']);
  });

  it('never leaks another student’s guardian', () => {
    assert.deepEqual(guardiansForStudent(CONTACTS, 's2').map(c => c.userId), ['u-other']);
  });

  it('returns nothing for a student nobody has linked yet', () => {
    assert.deepEqual(guardiansForStudent(CONTACTS, 's3'), []);
  });
});

describe('summarizeContacts / suggestMeeting', () => {
  const NOW = new Date('2026-09-25T12:00:00Z');
  const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

  it('reports no history for a student never contacted', () => {
    const s = summarizeContacts([], NOW);
    assert.equal(s.last, null);
    assert.deepEqual(s.recent, {});
    assert.equal(suggestMeeting(s, 'missing-homework'), false);
  });

  it('picks the newest contact regardless of input order', () => {
    const s = summarizeContacts([
      { kind: 'praise', createdAt: daysAgo(10) },
      { kind: 'absence', createdAt: daysAgo(2) },
    ], NOW);
    assert.deepEqual(s.last, { kind: 'absence', createdAt: daysAgo(2) });
  });

  it('counts only the last 30 days', () => {
    const s = summarizeContacts([
      { kind: 'missing-homework', createdAt: daysAgo(5) },
      { kind: 'missing-homework', createdAt: daysAgo(29) },
      { kind: 'missing-homework', createdAt: daysAgo(31) },
    ], NOW);
    assert.equal(s.recent['missing-homework'], 2);
  });

  it('suggests a meeting on the third same-kind concern, not the second', () => {
    const one = summarizeContacts([{ kind: 'absence', createdAt: daysAgo(3) }], NOW);
    assert.equal(suggestMeeting(one, 'absence'), false);
    const two = summarizeContacts([
      { kind: 'absence', createdAt: daysAgo(3) },
      { kind: 'absence', createdAt: daysAgo(9) },
    ], NOW);
    assert.equal(suggestMeeting(two, 'absence'), true);
    // Different kinds don't add up, and praise never escalates.
    assert.equal(suggestMeeting(two, 'missing-homework'), false);
    const praise = summarizeContacts([
      { kind: 'praise', createdAt: daysAgo(1) },
      { kind: 'praise', createdAt: daysAgo(2) },
    ], NOW);
    assert.equal(suggestMeeting(praise, 'praise'), false);
  });
});

describe('summarizeClassContacts', () => {
  const NOW = new Date('2026-09-25T12:00:00Z');
  const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
  const ROSTER = [
    { id: 'a', displayName: 'Amal' },
    { id: 'b', displayName: 'Basel' },
    { id: 'c', displayName: 'Carim' },
    { id: 'd', displayName: 'Dana' },
  ];

  it('lists never-contacted students first, then the longest silence, and skips recent ones', () => {
    const s = summarizeClassContacts(ROSTER, [
      { studentId: 'a', kind: 'praise', createdAt: daysAgo(3) },
      { studentId: 'b', kind: 'absence', createdAt: daysAgo(40) },
      { studentId: 'c', kind: 'absence', createdAt: daysAgo(90) },
    ], NOW);
    assert.deepEqual(s.quiet.map(q => q.id), ['d', 'c', 'b']);
    assert.equal(s.quiet[0].lastAt, null);
  });

  it('flags students whose parents only ever got concerns, most concerns first', () => {
    const s = summarizeClassContacts(ROSTER, [
      { studentId: 'a', kind: 'absence', createdAt: daysAgo(3) },
      { studentId: 'a', kind: 'praise', createdAt: daysAgo(2) },
      { studentId: 'b', kind: 'behaviour', createdAt: daysAgo(5) },
      { studentId: 'c', kind: 'missing-homework', createdAt: daysAgo(5) },
      { studentId: 'c', kind: 'absence', createdAt: daysAgo(6) },
      { studentId: 'd', kind: 'meeting', createdAt: daysAgo(1) },
    ], NOW);
    assert.deepEqual(s.concernOnly.map(x => [x.id, x.concerns]), [['c', 2], ['b', 1]]);
    // A meeting invitation is neither praise nor concern.
    assert.equal(s.positive, 1);
    assert.equal(s.concern, 4);
  });

  it('ignores log rows for students no longer on the roster', () => {
    const s = summarizeClassContacts([{ id: 'a', displayName: 'Amal' }], [
      { studentId: 'gone', kind: 'absence', createdAt: daysAgo(1) },
    ], NOW);
    assert.deepEqual(s.concernOnly, []);
    assert.deepEqual(s.quiet.map(q => q.id), ['a']);
  });
});

describe('read state', () => {
  const NOW = new Date('2026-09-25T12:00:00Z');
  const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
  const ROSTER = [
    { id: 'a', displayName: 'Amal' },
    { id: 'b', displayName: 'Basel' },
    { id: 'c', displayName: 'Carim' },
    { id: 'd', displayName: 'Dana' },
  ];

  it('carries the latest letter\'s read flag into the per-student summary', () => {
    const s = summarizeContacts([
      { kind: 'absence', createdAt: daysAgo(1), read: false },
      { kind: 'praise', createdAt: daysAgo(5), read: true },
    ], NOW);
    assert.equal(s.last?.read, false);
  });

  it('lists students whose latest in-app letter is unread after two days, oldest first', () => {
    const s = summarizeClassContacts(ROSTER, [
      // Amal: unread for 5 days → listed.
      { studentId: 'a', kind: 'absence', createdAt: daysAgo(5), channel: 'in_app', read: false },
      // Basel: unread but only 1 day old → too soon.
      { studentId: 'b', kind: 'praise', createdAt: daysAgo(1), channel: 'in_app', read: false },
      // Carim: an old unread letter, but the newer one was read → not listed.
      { studentId: 'c', kind: 'absence', createdAt: daysAgo(9), channel: 'in_app', read: false },
      { studentId: 'c', kind: 'praise', createdAt: daysAgo(3), channel: 'in_app', read: true },
      // Dana: shared via WhatsApp — read state unknowable, never listed.
      { studentId: 'd', kind: 'absence', createdAt: daysAgo(8), channel: 'share', read: null },
    ], NOW);
    assert.deepEqual(s.unread.map(u => u.id), ['a']);
  });
});

describe('remembered answers', () => {
  it('reads back a saved signature and rejects anything malformed', () => {
    assert.deepEqual(
      parseSavedSignature(JSON.stringify({ teacherName: 'أ. نزار', teacherGender: 'male' })),
      { teacherName: 'أ. نزار', teacherGender: 'male' },
    );
    for (const raw of [null, '', '{', '"x"', '{"teacherName":"a","teacherGender":"x"}', '{"teacherGender":"female"}']) {
      assert.equal(parseSavedSignature(raw), null, `should reject ${raw}`);
    }
  });

  it('treats an unrecorded roster gender as unknown, never as male', () => {
    assert.equal(rosterGender('female'), 'female');
    assert.equal(rosterGender('male'), 'male');
    assert.equal(rosterGender(''), null);
    assert.equal(rosterGender(undefined), null);
  });
});

describe('hand-edited letter', () => {
  const generated = 'أهلاً بكم، ... ابنتكم سارة ...';

  it('sends the generated letter until the teacher edits it', () => {
    assert.deepEqual(outgoingLetter(generated, null, 'سارة'), { text: generated, edited: false, stale: false });
  });

  it('sends the edit verbatim, not the regenerated text, once there is one', () => {
    const edit = { text: 'نص كتبته بنفسي عن سارة', studentName: 'سارة' };
    assert.deepEqual(outgoingLetter(generated, edit, 'سارة'), { text: edit.text, edited: true, stale: false });
  });

  // The edit names the child in free text. Picking another student must not
  // quietly send Sara's letter to Basel's parent.
  it('marks an edit stale when the student changed after it was made', () => {
    const edit = { text: 'نص عن سارة', studentName: 'سارة' };
    assert.equal(outgoingLetter(generated, edit, 'باسل').stale, true);
    assert.equal(outgoingLetter(generated, edit, '  سارة ').stale, false);
  });

  it('caps the letter at what the server accepts', () => {
    assert.equal(MAX_LETTER_LENGTH, 4000);
  });
});

describe('attachment', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const pdf = 'data:application/pdf;base64,JVBERi0=';

  it('names what kind of file is attached', () => {
    assert.equal(attachmentKind(png), 'image');
    assert.equal(attachmentKind(pdf), 'pdf');
    assert.equal(attachmentKind('data:audio/mpeg;base64,AA=='), null);
    assert.equal(attachmentKind('not a data url'), null);
  });

  it('refuses a type parents cannot be sent, and a file over the server limit', () => {
    assert.equal(attachmentProblem(png), null);
    assert.equal(attachmentProblem(pdf), null);
    assert.equal(attachmentProblem('data:application/zip;base64,AA=='), 'unsupported');
    assert.equal(attachmentProblem('data:image/png;base64,' + 'A'.repeat(8_000_000)), 'too_large');
  });
});

describe('parentMessageReady — a concern letter needs its details', () => {
  // The details label already says "required" for concern kinds; the Send,
  // Share and Copy buttons used to ignore it and let an empty concern reach a
  // real parent.
  it('is false for a concern kind with no details, whatever the message says', () => {
    assert.equal(parentMessageReady('absence', '', 'some composed text'), false);
    assert.equal(parentMessageReady('absence', '   ', 'some composed text'), false);
  });

  it('is true for a concern kind once details are typed', () => {
    assert.equal(parentMessageReady('absence', 'غاب ثلاثة أيام', 'some composed text'), true);
  });

  it('does not need details for praise or progress', () => {
    assert.equal(parentMessageReady('praise', '', 'some composed text'), true);
    assert.equal(parentMessageReady('progress', '', 'some composed text'), true);
  });

  it('is never true without a composed message', () => {
    assert.equal(parentMessageReady('praise', '', ''), false);
    assert.equal(parentMessageReady('absence', 'details', ''), false);
  });
});

// ─── Wording pass (2026-10-17) ───────────────────────────────────────────────
// Each block below pins one defect found by rendering the composer: praise that
// asserted diligence and attendance nobody typed, a woman signing «مستعد» and
// «شاكرًا», a «warm» tone that changed only the greeting.

describe('praise states only what the teacher ticked or typed', () => {
  it('asserts no quality in Arabic when nothing was ticked', () => {
    const msg = composeParentMessage({ ...BASE, kind: 'praise' }, true);
    for (const claim of ['اجتهاد', 'التزام', 'حضور', 'أظهر']) {
      assert.equal(msg.includes(claim), false, `praise claimed «${claim}»: ${msg}`);
    }
  });

  it('asserts no quality in English when nothing was ticked', () => {
    const msg = composeParentMessage({ ...BASE, studentName: 'Sara', kind: 'praise' }, false);
    for (const claim of ['effort', 'commitment', 'attendance']) {
      assert.equal(msg.toLowerCase().includes(claim), false, `praise claimed «${claim}»: ${msg}`);
    }
  });

  it('names exactly the ticked strengths, in a fixed order, agreeing with the student', () => {
    const f = composeParentMessage(
      { ...BASE, studentGender: 'female', kind: 'praise', strengths: ['homework', 'effort'] }, true,
    );
    assert.ok(f.includes('اجتهادها والتزامها بالواجبات'), f);
    assert.equal(f.includes('مشاركتها'), false);
    const m = composeParentMessage(
      { ...BASE, studentGender: 'male', kind: 'praise', strengths: ['participation', 'improvement'] }, true,
    );
    assert.ok(m.includes('مشاركته وتحسّنه'), m);
  });

  it('lists the ticked strengths in English too', () => {
    const msg = composeParentMessage(
      { ...BASE, studentName: 'Omar', studentGender: 'male', kind: 'praise', strengths: ['effort', 'conduct'] }, false,
    );
    assert.ok(msg.includes('his effort and good conduct'), msg);
  });

  it('ignores strengths on any other kind, duplicates and unknown ids', () => {
    const concern = composeParentMessage(
      { ...BASE, kind: 'academic-concern', strengths: ['effort'] }, true,
    );
    assert.equal(concern.includes('اجتهاد'), false);
    const praise = composeParentMessage(
      { ...BASE, kind: 'praise', strengths: ['effort', 'effort', 'nonsense' as never] }, true,
    );
    assert.equal(praise.split('اجتهادها').length - 1, 1);
  });
});

describe('the teacher\'s own gender', () => {
  it('never leaves a woman a masculine self-reference', () => {
    for (const kind of MESSAGE_KINDS) {
      const msg = composeParentMessage({ ...BASE, kind, teacherGender: 'female', details: 'تفصيل.' }, true);
      assert.equal(/مستعد(?!ة)/.test(msg), false, `${kind}: ${msg}`);
      assert.equal(msg.includes('شاكرًا'), false, `${kind}: ${msg}`);
    }
  });

  it('asks for the meeting once, not twice', () => {
    const msg = composeParentMessage({ ...BASE, kind: 'meeting' }, true);
    assert.equal(msg.split('تحديد').length - 1, 1, msg);
  });
});

describe('formal-letter conventions', () => {
  it('follows the salam with وبعد in the formal greeting', () => {
    const msg = composeParentMessage({ ...BASE, tone: 'formal' }, true);
    assert.ok(msg.includes('ورحمة الله وبركاته، وبعد،'), msg);
  });

  it('opens a warm letter with the salam, before the welcome', () => {
    const msg = composeParentMessage({ ...BASE, tone: 'warm' }, true);
    assert.ok(msg.indexOf('السلام عليكم') >= 0);
    assert.ok(msg.indexOf('السلام عليكم') < msg.indexOf('أهلًا'), msg);
  });

  it('closes a warm letter differently from a formal one', () => {
    const warm = composeParentMessage({ ...BASE, tone: 'warm' }, true);
    assert.equal(warm.includes('فائق الاحترام'), false);
    assert.ok(warm.includes('مودّتي'), warm);
  });

  it('gives a bare teacher name its title, and leaves a titled one alone', () => {
    const bare = (g: 'male' | 'female') =>
      composeParentMessage({ ...BASE, teacherName: 'نزار', teacherGender: g }, true);
    assert.ok(bare('male').includes('الأستاذ نزار'));
    assert.ok(bare('female').includes('الأستاذة نزار'));
    const titled = composeParentMessage({ ...BASE, teacherName: 'أ. نزار' }, true);
    assert.equal(titled.includes('الأستاذ أ.'), false);
    assert.ok(titled.includes('أ. نزار'));
  });

  it('keeps translated phrasing out of every kind', () => {
    for (const kind of MESSAGE_KINDS) {
      const msg = composeParentMessage({ ...BASE, kind, details: 'تفصيل.' }, true);
      for (const calque of ['لا تتردّدوا', 'أن أشارككم', 'الدافعية', 'البيتي']) {
        assert.equal(msg.includes(calque), false, `${kind} still says «${calque}»`);
      }
    }
  });
});

describe('the details the teacher typed', () => {
  it('ends them with a full stop when the teacher left it off', () => {
    const msg = composeParentMessage({ ...BASE, kind: 'absence', details: 'ثلاث حصص هذا الأسبوع' }, true);
    assert.ok(msg.includes('ثلاث حصص هذا الأسبوع.\n'), msg);
  });

  it('does not stack punctuation on details that already end in it', () => {
    for (const d of ['انتهى بنجاح.', 'هل وصلكم؟', 'ثلاثة أيام!', 'منها: ']) {
      const msg = composeParentMessage({ ...BASE, kind: 'absence', details: d }, true);
      assert.equal(/[.؟!:]\./.test(msg), false, `${d} → ${msg}`);
    }
  });

  it('flags Latin-only details inside an Arabic letter, and the reverse', () => {
    assert.equal(detailsLanguageMismatch('Attention', true), true);
    assert.equal(detailsLanguageMismatch('انتباه', true), false);
    assert.equal(detailsLanguageMismatch('اختبار PISA', true), false);
    assert.equal(detailsLanguageMismatch('', true), false);
    assert.equal(detailsLanguageMismatch('تفصيل', false), true);
    assert.equal(detailsLanguageMismatch('Late again', false), false);
  });

  it('has a worked example for every kind in both languages', () => {
    for (const kind of MESSAGE_KINDS) {
      assert.ok(detailsExample(kind, true).length > 10, kind);
      assert.ok(detailsExample(kind, false).length > 10, kind);
    }
  });
});

// ─── Linking a typed name to the roster, and choosing guardians ─────────────
// Typing a name by hand drops the picked student on purpose (so the letter can
// never go to the previous child's parent), which also turned in-app send off
// with nothing close to the field saying why. The remedy is a *suggestion* the
// teacher taps — never an automatic link.

describe('matchRosterStudents', () => {
  const roster = [
    { id: 'a', displayName: 'أحمد خالد' },
    { id: 's', displayName: 'سارة علي' },
    { id: 'o', displayName: 'Omar Saleh' },
  ];

  it('suggests the one student a typed name points at', () => {
    assert.deepEqual(matchRosterStudents('أحمد خالد', roster).map(r => r.id), ['a']);
  });

  it('matches across hamza, ya, ta marbuta, diacritics and spacing', () => {
    assert.deepEqual(matchRosterStudents('احمد   خالد', roster).map(r => r.id), ['a']);
    assert.deepEqual(matchRosterStudents('ساره', roster).map(r => r.id), ['s']);
    assert.deepEqual(matchRosterStudents('سَارَة', roster).map(r => r.id), ['s']);
    assert.deepEqual(matchRosterStudents('على', [{ id: 'x', displayName: 'علي' }]).map(r => r.id), ['x']);
  });

  it('matches a first name, a name still being typed, and Latin case-insensitively', () => {
    assert.deepEqual(matchRosterStudents('سارة', roster).map(r => r.id), ['s']);
    assert.deepEqual(matchRosterStudents('أحمد خا', roster).map(r => r.id), ['a']);
    assert.deepEqual(matchRosterStudents('omar', roster).map(r => r.id), ['o']);
  });

  it('offers every candidate when a first name is shared, so the teacher picks', () => {
    const twins = [...roster, { id: 'a2', displayName: 'أحمد سمير' }];
    assert.deepEqual(matchRosterStudents('أحمد', twins).map(r => r.id).sort(), ['a', 'a2']);
  });

  it('prefers a full-name match over longer names that merely start with it', () => {
    const r = [{ id: 'short', displayName: 'أحمد' }, { id: 'long', displayName: 'أحمد خالد' }];
    assert.deepEqual(matchRosterStudents('أحمد', r).map(x => x.id), ['short']);
  });

  it('says nothing when it is too vague or matches nothing', () => {
    const many = ['أ', 'ب', 'ج', 'د'].map((x, i) => ({ id: String(i), displayName: `أحمد ${x}` }));
    assert.deepEqual(matchRosterStudents('أحمد', many), [], 'four candidates is noise, not help');
    assert.deepEqual(matchRosterStudents('Aad', roster), []);
    assert.deepEqual(matchRosterStudents('', roster), []);
    assert.deepEqual(matchRosterStudents('أ', roster), [], 'one letter matches everyone');
    assert.deepEqual(matchRosterStudents('أحمد', []), []);
  });
});

describe('pickRecipients', () => {
  const g = (userId: string) => ({ userId, firstName: userId, lastName: '', role: 'parent' as const });
  const all = [g('mother'), g('father')];

  it('reaches every guardian until one is unticked', () => {
    assert.deepEqual(pickRecipients(all, new Set()).map(x => x.userId), ['mother', 'father']);
  });

  it('drops the unticked guardian and keeps the order', () => {
    assert.deepEqual(pickRecipients(all, new Set(['mother'])).map(x => x.userId), ['father']);
  });

  it('can end up empty, which is what disables the send', () => {
    assert.deepEqual(pickRecipients(all, new Set(['mother', 'father'])), []);
  });

  it('ignores ids that are not guardians of this student', () => {
    assert.deepEqual(pickRecipients(all, new Set(['someone-else'])).map(x => x.userId), ['mother', 'father']);
  });
});
