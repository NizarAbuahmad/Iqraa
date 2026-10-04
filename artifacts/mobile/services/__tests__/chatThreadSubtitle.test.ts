/**
 * The second line of a direct chat row and of the chat header: not just the
 * other person's role, but which teacher (subject) and which student the chat
 * is about.
 *
 * A teacher once showed as «مدير المدرسة» because the line was a pure function
 * of `role` — an account stored as school_admin that also teaches looked like
 * the principal. These pin the rules: subject for a teaching account, student
 * names when the server sent them, the plain role label whenever it did not.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { chatThreadSubtitle } from '../chatThreadSubtitle.ts';
import { getT } from '../i18n.ts';
import type { ChatParticipantInfo } from '../messaging.ts';

const ar = getT('ar');
const en = getT('en');

function person(over: Partial<ChatParticipantInfo>): ChatParticipantInfo {
  return { userId: 'u1', firstName: 'Nixar', lastName: 'Ahmad', role: 'teacher', ...over };
}

describe('chatThreadSubtitle — teacher on the other side', () => {
  it('names the subject and the student the chat is about', () => {
    const other = person({ subjectIds: ['mathematics'], aboutStudents: ['خالد أحمد'] });
    assert.equal(chatThreadSubtitle(other, ar, 'ar'), 'معلم الرياضيات · بخصوص خالد');
    assert.equal(chatThreadSubtitle(other, en, 'en'), 'Mathematics teacher · About خالد');
  });

  it('uses the first name only', () => {
    const other = person({ subjectIds: ['mathematics'], aboutStudents: ['Khaled Ali Hassan'] });
    assert.equal(chatThreadSubtitle(other, en, 'en'), 'Mathematics teacher · About Khaled');
  });

  it('lists up to two subjects and two students, then counts the rest', () => {
    const other = person({
      subjectIds: ['mathematics', 'science', 'english'],
      aboutStudents: ['خالد', 'سارة', 'ليث'],
    });
    assert.equal(chatThreadSubtitle(other, ar, 'ar'), 'معلم الرياضيات، العلوم +1 · بخصوص خالد، سارة +1');
  });

  it('is just the subject when no student is attached', () => {
    const other = person({ subjectIds: ['science'], aboutStudents: [] });
    assert.equal(chatThreadSubtitle(other, ar, 'ar'), 'معلم العلوم');
  });

  it('falls back to «معلم» when the teacher has not set subjects', () => {
    assert.equal(chatThreadSubtitle(person({ subjectIds: [] }), ar, 'ar'), 'معلم');
  });

  it('ignores a subject id it does not know instead of printing it', () => {
    const other = person({ subjectIds: ['not-a-subject'], aboutStudents: [] });
    assert.equal(chatThreadSubtitle(other, ar, 'ar'), 'معلم');
  });
});

describe('chatThreadSubtitle — admin accounts', () => {
  it('labels an admin with no subjects «مسؤول», never «مدير المدرسة»', () => {
    for (const role of ['school_admin', 'system_admin'] as const) {
      const label = chatThreadSubtitle(person({ role, subjectIds: [] }), ar, 'ar');
      assert.equal(label, 'مسؤول');
      assert.notEqual(label, 'مدير المدرسة');
    }
    assert.equal(chatThreadSubtitle(person({ role: 'school_admin' }), en, 'en'), 'Admin');
  });

  it('shows a teaching admin as a teacher, with the subject', () => {
    const other = person({ role: 'school_admin', subjectIds: ['mathematics'], aboutStudents: ['خالد'] });
    assert.equal(chatThreadSubtitle(other, ar, 'ar'), 'معلم الرياضيات · بخصوص خالد');
  });
});

describe('chatThreadSubtitle — parent or student on the other side', () => {
  it('names the student the parent is linked through', () => {
    const other = person({ role: 'parent', aboutStudents: ['خالد أحمد'] });
    assert.equal(chatThreadSubtitle(other, ar, 'ar'), 'وليّ أمر · خالد');
  });

  it('does not attach a subject to a parent even if one is present', () => {
    const other = person({ role: 'parent', subjectIds: ['mathematics'], aboutStudents: [] });
    assert.equal(chatThreadSubtitle(other, ar, 'ar'), 'وليّ أمر');
  });
});

describe('chatThreadSubtitle — older server', () => {
  it('falls back to the plain role label when the new fields are absent', () => {
    assert.equal(chatThreadSubtitle(person({}), ar, 'ar'), 'معلم');
    assert.equal(chatThreadSubtitle(person({ role: 'student' }), en, 'en'), 'Student');
  });
});
