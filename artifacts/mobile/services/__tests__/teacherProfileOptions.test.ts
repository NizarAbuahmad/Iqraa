/**
 * The «عنك» options the app offers are exactly the ones the API accepts
 * (artifacts/api-server/src/lib/teacherProfile.ts) — a value the server does not know is a 400,
 * so a drift would make Save fail for everyone who picked it. And every option has a label in
 * both languages, so no raw id ("tafilah", "6-10") reaches the screen.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TEACHER_PROFILE_FIELDS,
  TEACHER_PROFILE_OPTIONS,
  changedTeacherProfile,
  teacherProfileFrom,
  teacherProfileLabel,
} from '../teacherProfile.ts';

const here = dirname(fileURLToPath(import.meta.url));
const apiFile = join(here, '..', '..', '..', 'api-server', 'src', 'lib', 'teacherProfile.ts');

describe('teacher profile options', () => {
  it('match the API, field by field', () => {
    const src = readFileSync(apiFile, 'utf8');
    for (const field of TEACHER_PROFILE_FIELDS) {
      const start = src.indexOf(`${field}: [`);
      assert.ok(start >= 0, `API has no ${field} list`);
      const block = src.slice(start, src.indexOf(']', start));
      const apiList = [...block.matchAll(/"([^"]+)"/g)].map(m => m[1]);
      assert.deepEqual([...TEACHER_PROFILE_OPTIONS[field]], apiList, field);
    }
  });

  it('label every option in Arabic and English', () => {
    for (const field of TEACHER_PROFILE_FIELDS) {
      for (const value of TEACHER_PROFILE_OPTIONS[field]) {
        assert.notEqual(teacherProfileLabel(value, 'ar'), value, `${value} has no Arabic label`);
        assert.match(teacherProfileLabel(value, 'ar'), /[؀-ۿ]/, `${value} Arabic label is not Arabic`);
        assert.ok(teacherProfileLabel(value, 'en').length > 0);
      }
    }
  });

  it('never writes an Arabic range as digits around a dash, which RTL text shows reversed', () => {
    for (const field of TEACHER_PROFILE_FIELDS) {
      for (const value of TEACHER_PROFILE_OPTIONS[field]) {
        assert.doesNotMatch(teacherProfileLabel(value, 'ar'), /[٠-٩0-9]\s*[-–—]\s*[٠-٩0-9]/, value);
      }
    }
  });

  it('saves only the fields the teacher touched, so an answer not yet loaded is never blanked', () => {
    const answers = { gender: null, ageRange: null, governorate: 'karak', yearsTeaching: null };
    assert.deepEqual(changedTeacherProfile(answers, new Set(['governorate'])), { governorate: 'karak' });
    // A cleared answer is sent as null; an untouched one is not sent at all.
    assert.deepEqual(changedTeacherProfile(answers, new Set(['yearsTeaching'])), { yearsTeaching: null });
    assert.deepEqual(changedTeacherProfile(answers, new Set()), {});
  });

  it('reads an absent profile as all unanswered', () => {
    assert.deepEqual(teacherProfileFrom(undefined), { gender: null, ageRange: null, governorate: null, yearsTeaching: null });
    assert.equal(teacherProfileFrom({ governorate: 'karak' }).governorate, 'karak');
  });
});
