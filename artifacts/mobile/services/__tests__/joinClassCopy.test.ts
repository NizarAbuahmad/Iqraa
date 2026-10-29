/**
 * What this guards: the words on `/join-class` for a student's first class.
 *
 * The screen was written for "add another class" — another child, another
 * parent for the same child, another teacher. A student who signed up with an
 * email has no class at all (since 2026-10-23), so «انضمام إلى شعبة أخرى» and
 * "another child" describe something they have not done. They get the plain
 * wording; everyone else keeps the original.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { joinClassCopyKeys } from '../joinClassCopy.ts';

describe('joinClassCopyKeys', () => {
  it('gives a student with no class the first-class wording', () => {
    assert.deepEqual(joinClassCopyKeys({ role: 'student', hasRosterLink: false }), {
      title: 'joinAClass',
      desc: 'joinFirstClassDesc',
    });
  });

  it('keeps the "another class" wording for anyone who already has a link', () => {
    for (const role of ['student', 'parent', 'teacher']) {
      assert.deepEqual(joinClassCopyKeys({ role, hasRosterLink: true }), {
        title: 'joinAnotherClass',
        desc: 'joinAnotherClassDesc',
      }, role);
    }
  });

  it('keeps it for a parent with no link, who is held on the claim screen and never reaches this one', () => {
    assert.equal(joinClassCopyKeys({ role: 'parent', hasRosterLink: false }).title, 'joinAnotherClass');
  });

  it('keeps it when the link flag is not answered yet — unknown is not "no class"', () => {
    assert.equal(joinClassCopyKeys({ role: 'student' }).title, 'joinAnotherClass');
    assert.equal(joinClassCopyKeys(null).title, 'joinAnotherClass');
    assert.equal(joinClassCopyKeys(undefined).title, 'joinAnotherClass');
  });
});
